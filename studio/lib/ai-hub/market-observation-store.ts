/**
 * Durable market observations live in Firestore.
 * Vercel /tmp is not a store for this data. The validated JSON seed is the
 * fallback when Firestore has no document. A file mirror is never success.
 */

import 'server-only';

import { randomUUID } from 'node:crypto';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { stripUndefinedDeep } from '@/lib/firebase/audit-projects-types';
import type { MarketBundle, MarketCheckCandidate, MarketCheckLog } from '@/lib/ai-hub/market-observations';
import {
	approvePending,
	queuePendingCandidate,
	rejectPending,
	type MarketPendingRecord,
	type MarketReviewActor,
} from '@/lib/ai-hub/market-review';
import { decideCommitGuard, decideRunClaim } from '@/lib/ai-hub/market-run-guard';
export const AI_MARKET_COLLECTION = 'ai_market_observations';
const STATE_DOC = 'current';
const PENDING_DOC = 'pending';
const LOCK_DOC = 'run_lock';
const LOCK_TTL_MS = 120_000;

export type MarketStateRecord = {
	bundle: MarketBundle;
	lastCheckDate: string | null;
	history: MarketBundle[];
	logs: MarketCheckLog[];
};

export type MarketPersistResult = {
	ok: boolean;
	durable: boolean;
	reason:
		| 'saved'
		| 'already_checked'
		| 'busy'
		| 'firestore_unconfigured'
		| 'firestore_write_failed'
		| 'not_pending'
		| 'invalid_candidate'
		| 'pending_conflict'
		| 'stale_result';
	pendingAction?: 'created' | 'kept' | 'conflict' | 'none';
};

export type MarketRunClaim =
	| { state: 'claimed'; token: string }
	| { state: 'done' }
	| { state: 'busy' }
	| { state: 'unavailable' }
	| { state: 'failed' };

const memory = new Map<string, MarketStateRecord>();

function isRecord(value: unknown): value is MarketStateRecord {
	if (!value || typeof value !== 'object') return false;
	const row = value as MarketStateRecord;
	return Boolean(row.bundle && Array.isArray(row.bundle.webTraffic?.rows));
}

function isPending(value: unknown): value is MarketPendingRecord {
	if (!value || typeof value !== 'object') return false;
	const row = value as MarketPendingRecord;
	return row.status === 'pending' || row.status === 'approved' || row.status === 'rejected';
}

function db() {
	return getAdminFirestore();
}

export function marketPersistenceAvailable(): boolean {
	return isFirebaseAdminConfigured();
}

function revisionOf(value: unknown): number | null {
	if (!isRecord(value) || typeof value.bundle.revision !== 'number') return null;
	return value.bundle.revision;
}

/** Published bundle from Firestore. Never reads /tmp or a local file. Memory is only a fallback when the read fails. */
export async function readPublishedMarketState(): Promise<MarketStateRecord | null> {
	if (!isFirebaseAdminConfigured()) return null;
	try {
		const snap = await db().collection(AI_MARKET_COLLECTION).doc(STATE_DOC).get();
		if (!snap.exists) {
			memory.delete(STATE_DOC);
			return null;
		}
		const data = snap.data();
		if (!isRecord(data)) {
			memory.delete(STATE_DOC);
			return null;
		}
		memory.set(STATE_DOC, data);
		return data;
	} catch (error) {
		console.error('[ai-market] Firestore read failed:', error instanceof Error ? error.message : error);
		return memory.get(STATE_DOC) ?? null;
	}
}

export async function claimMarketRun(today: string, now: Date = new Date()): Promise<MarketRunClaim> {
	if (!isFirebaseAdminConfigured()) return { state: 'unavailable' };
	const token = randomUUID();
	try {
		const outcome = await db().runTransaction(async (tx) => {
			const currentRef = db().collection(AI_MARKET_COLLECTION).doc(STATE_DOC);
			const lockRef = db().collection(AI_MARKET_COLLECTION).doc(LOCK_DOC);
			const currentSnap = await tx.get(currentRef);
			const lockSnap = await tx.get(lockRef);
			const current = currentSnap.exists ? currentSnap.data() : null;
			const record = isRecord(current) ? current : null;
			const lock = lockSnap.exists ? (lockSnap.data() as { expiresAt?: string }) : null;
			const decision = decideRunClaim({
				lastCheckDate: record?.lastCheckDate ?? null,
				checkStatus: record?.bundle.checkStatus ?? null,
				lockExpiresAt: lock?.expiresAt ?? null,
				today,
				now: now.getTime(),
			});
			if (decision === 'done') return 'done' as const;
			if (decision === 'busy') return 'busy' as const;
			tx.set(lockRef, {
				date: today,
				token,
				expiresAt: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
			});
			return 'claimed' as const;
		});
		if (outcome === 'claimed') return { state: 'claimed', token };
		return { state: outcome };
	} catch (error) {
		console.error('[ai-market] run lock failed:', error instanceof Error ? error.message : error);
		return { state: 'failed' };
	}
}

export async function commitMarketRun(input: {
	token: string;
	state: MarketStateRecord;
	pending: MarketPendingRecord | null;
	baseRevision: number | null;
}): Promise<MarketPersistResult> {
	if (!isFirebaseAdminConfigured()) return { ok: false, durable: false, reason: 'firestore_unconfigured', pendingAction: 'none' };
	try {
		const pendingAction = await db().runTransaction(async (tx) => {
			const lockRef = db().collection(AI_MARKET_COLLECTION).doc(LOCK_DOC);
			const currentRef = db().collection(AI_MARKET_COLLECTION).doc(STATE_DOC);
			const pendingRef = db().collection(AI_MARKET_COLLECTION).doc(PENDING_DOC);
			const lockSnap = await tx.get(lockRef);
			const currentSnap = await tx.get(currentRef);
			const pendingSnap = await tx.get(pendingRef);
			const lock = lockSnap.exists ? (lockSnap.data() as { token?: string }) : null;
			const guard = decideCommitGuard({
				lockToken: lock?.token ?? null,
				expectedToken: input.token,
				storedRevision: revisionOf(currentSnap.data()),
				baseRevision: input.baseRevision,
			});
			if (guard === 'lock_lost') throw new Error('lock_lost');
			if (guard === 'stale_base') {
				tx.delete(lockRef);
				return { kind: 'stale' as const };
			}
			tx.set(currentRef, stripUndefinedDeep(input.state));
			let action: MarketPersistResult['pendingAction'] = 'none';
			if (input.pending) {
				const rawPending = pendingSnap.data();
				const existing = isPending(rawPending) ? rawPending : null;
				const queued = queuePendingCandidate(existing, input.pending);
				action = queued.action === 'create' ? 'created' : queued.action;
				if (queued.action === 'create') tx.set(pendingRef, stripUndefinedDeep(queued.record));
			}
			tx.delete(lockRef);
			return { kind: 'saved' as const, action };
		});
		if (pendingAction.kind === 'stale') {
			memory.delete(STATE_DOC);
			return { ok: false, durable: false, reason: 'stale_result', pendingAction: 'none' };
		}
		memory.set(STATE_DOC, input.state);
		return {
			ok: true,
			durable: true,
			reason: pendingAction.action === 'conflict' ? 'pending_conflict' : 'saved',
			pendingAction: pendingAction.action,
		};
	} catch (error) {
		console.error('[ai-market] Firestore write failed:', error instanceof Error ? error.message : error);
		return { ok: false, durable: false, reason: 'firestore_write_failed', pendingAction: 'none' };
	}
}

export async function readPendingReview(): Promise<MarketPendingRecord | null> {
	if (!isFirebaseAdminConfigured()) return null;
	try {
		const snap = await db().collection(AI_MARKET_COLLECTION).doc(PENDING_DOC).get();
		if (!snap.exists) return null;
		const data = snap.data();
		return isPending(data) ? data : null;
	} catch (error) {
		console.error('[ai-market] pending read failed:', error instanceof Error ? error.message : error);
		return null;
	}
}

export async function decideMarketReview(input: {
	action: 'approve' | 'reject';
	actor: MarketReviewActor;
	now?: Date;
	seed: MarketBundle;
}): Promise<MarketPersistResult & { bundle?: MarketBundle }> {
	if (!isFirebaseAdminConfigured()) return { ok: false, durable: false, reason: 'firestore_unconfigured' };
	const at = (input.now ?? new Date()).toISOString();
	try {
		const result = await db().runTransaction(async (tx) => {
			const currentRef = db().collection(AI_MARKET_COLLECTION).doc(STATE_DOC);
			const pendingRef = db().collection(AI_MARKET_COLLECTION).doc(PENDING_DOC);
			const currentSnap = await tx.get(currentRef);
			const pendingSnap = await tx.get(pendingRef);
			const rawPending = pendingSnap.data();
			const rawCurrent = currentSnap.data();
			const existing = isPending(rawPending) ? rawPending : null;
			const stored = isRecord(rawCurrent) ? rawCurrent : null;
			const published = stored?.bundle ?? input.seed;
			if (input.action === 'reject') {
				const rejected = rejectPending(existing, input.actor, at);
				if (!rejected.ok) return { ok: false as const, reason: rejected.reason };
				tx.set(pendingRef, stripUndefinedDeep(rejected.record));
				return { ok: true as const, reason: 'saved' as const, bundle: published };
			}
			const livePending = existing
				? {
						...existing,
						publishedPeriodStart: published.webTraffic.periodStart,
						publishedPeriodEnd: published.webTraffic.periodEnd,
						publishedPeriodLabel: published.webTraffic.periodLabel,
						publishedRows: published.webTraffic.rows,
					}
				: null;
			const approved = approvePending(livePending, published, input.actor, at);
			if (!approved.ok) return { ok: false as const, reason: approved.reason };
			const next: MarketStateRecord = {
				bundle: approved.bundle,
				lastCheckDate: stored?.lastCheckDate ?? null,
				history: [published, ...(stored?.history ?? [])].slice(0, 24),
				logs: [
					{
						date: at.slice(0, 10),
						checkedAt: at,
						status: 'admin_approved' as const,
						note: approved.bundle.checkNote,
					},
					...(stored?.logs ?? []),
				].slice(0, 30),
			};
			tx.set(currentRef, stripUndefinedDeep(next));
			tx.set(pendingRef, stripUndefinedDeep(approved.record));
			return { ok: true as const, reason: 'saved' as const, bundle: approved.bundle, state: next };
		});
		if (result.ok && result.reason === 'saved' && 'state' in result && result.state) memory.set(STATE_DOC, result.state);
		if (!result.ok) return { ok: false, durable: true, reason: result.reason };
		return { ok: true, durable: true, reason: 'saved', bundle: result.bundle };
	} catch (error) {
		console.error('[ai-market] review decision failed:', error instanceof Error ? error.message : error);
		return { ok: false, durable: false, reason: 'firestore_write_failed' };
	}
}

export function pendingFromCandidate(input: {
	candidate: MarketCheckCandidate;
	published: MarketBundle;
	detectedAt: string;
	note: string;
}): MarketPendingRecord {
	return {
		status: 'pending',
		candidate: input.candidate,
		publishedPeriodStart: input.published.webTraffic.periodStart,
		publishedPeriodEnd: input.published.webTraffic.periodEnd,
		publishedPeriodLabel: input.published.webTraffic.periodLabel,
		publishedRows: input.published.webTraffic.rows.map((row) => ({ ...row })),
		sourceName: input.published.webTraffic.sourceName,
		metricLabel: input.published.webTraffic.metricLabel,
		detectedAt: input.detectedAt,
		note: input.note,
		decision: null,
	};
}
