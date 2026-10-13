/**
 * Pure review decisions. Publishing a candidate happens only after approval.
 * Firestore I/O stays in the observation store.
 */

import { rankShareRows, validateShareRows, WEB_TRAFFIC_COHORT, type MarketBundle, type MarketCheckCandidate, type ServiceShareRow } from '@/lib/ai-hub/market-observations';

export type MarketReviewActor = {
	id: string;
	email: string | null;
	name: string | null;
};

export type MarketReviewDecision = {
	action: 'approved' | 'rejected';
	actorId: string;
	actorEmail: string | null;
	actorName: string | null;
	at: string;
	previousPeriodStart: string;
	previousPeriodEnd: string;
	previousRows: ServiceShareRow[];
};

export type MarketPendingRecord = {
	status: 'pending' | 'approved' | 'rejected';
	candidate: MarketCheckCandidate;
	publishedPeriodStart: string;
	publishedPeriodEnd: string;
	publishedPeriodLabel: string;
	publishedRows: ServiceShareRow[];
	sourceName: string;
	metricLabel: string;
	detectedAt: string;
	note: string;
	decision: MarketReviewDecision | null;
};

export type PendingQueueResult =
	| { action: 'create'; record: MarketPendingRecord }
	| { action: 'kept'; record: MarketPendingRecord }
	| { action: 'conflict'; record: MarketPendingRecord };

function shareKey(rows: Array<{ serviceId: string; sharePct: number }>): string {
	return [...rows]
		.map((row) => `${row.serviceId}:${row.sharePct}`)
		.sort()
		.join('|');
}

export function samePendingCandidate(left: MarketCheckCandidate, right: MarketCheckCandidate): boolean {
	return left.periodStart === right.periodStart && left.periodEnd === right.periodEnd && left.sourceUrl === right.sourceUrl && shareKey(left.rows) === shareKey(right.rows);
}

export function queuePendingCandidate(existing: MarketPendingRecord | null, incoming: MarketPendingRecord): PendingQueueResult {
	if (!existing) return { action: 'create', record: incoming };
	if (samePendingCandidate(existing.candidate, incoming.candidate)) return { action: 'kept', record: existing };
	if (existing.status === 'pending') return { action: 'conflict', record: existing };
	return { action: 'create', record: incoming };
}

function decision(action: 'approved' | 'rejected', actor: MarketReviewActor, at: string, published: MarketPendingRecord): MarketReviewDecision {
	return {
		action,
		actorId: actor.id,
		actorEmail: actor.email,
		actorName: actor.name,
		at,
		previousPeriodStart: published.publishedPeriodStart,
		previousPeriodEnd: published.publishedPeriodEnd,
		previousRows: published.publishedRows.map((row) => ({ ...row })),
	};
}

export function rejectPending(existing: MarketPendingRecord | null, actor: MarketReviewActor, at: string): { ok: true; record: MarketPendingRecord } | { ok: false; reason: 'not_pending' } {
	if (!existing || existing.status !== 'pending') return { ok: false, reason: 'not_pending' };
	return { ok: true, record: { ...existing, status: 'rejected', decision: decision('rejected', actor, at, existing) } };
}

export function approvePending(
	existing: MarketPendingRecord | null,
	published: MarketBundle,
	actor: MarketReviewActor,
	at: string,
): { ok: true; record: MarketPendingRecord; bundle: MarketBundle } | { ok: false; reason: 'not_pending' | 'invalid_candidate' } {
	if (!existing || existing.status !== 'pending') return { ok: false, reason: 'not_pending' };
	const rows = rankShareRows(
		existing.candidate.rows.map((row) => ({
			serviceId: row.serviceId,
			serviceName: row.serviceName,
			sharePct: row.sharePct,
			momChangePp: null,
		})),
	);
	const validation = validateShareRows(rows, { allowedIds: WEB_TRAFFIC_COHORT, requireAll: true });
	if (!validation.ok) return { ok: false, reason: 'invalid_candidate' };
	const record: MarketPendingRecord = {
		...existing,
		status: 'approved',
		decision: decision('approved', actor, at, existing),
	};
	const bundle: MarketBundle = {
		...published,
		revision: published.revision + 1,
		checkedAt: at,
		checkStatus: 'admin_approved',
		checkNote: `${actor.name || actor.email || actor.id}가 ${at}에 승인했습니다. 이전 기간 ${existing.publishedPeriodLabel}. Similarweb 원문은 수집하지 않았습니다.`,
		webTraffic: {
			...published.webTraffic,
			periodStart: existing.candidate.periodStart,
			periodEnd: existing.candidate.periodEnd,
			periodLabel: existing.candidate.periodLabel,
			sourceUrl: existing.candidate.sourceUrl,
			validationStatus: 'passed',
			rows,
		},
	};
	return { ok: true, record, bundle };
}
