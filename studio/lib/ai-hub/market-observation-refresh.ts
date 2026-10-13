/**
 * Authorized daily check. Public reads must not call this.
 * Firestore is the only durable store. A missing credential or a failed write
 * leaves the published bundle unchanged and is not reported as saved.
 */

import 'server-only';

import seedJson from '@/data/ai-market/web-traffic-observations.json';
import { getKstDateKey } from '@/lib/ai-hub/live-ai-rankings';
import {
	claimMarketRun,
	commitMarketRun,
	marketPersistenceAvailable,
	pendingFromCandidate,
	readPublishedMarketState,
	type MarketPersistResult,
	type MarketStateRecord,
} from '@/lib/ai-hub/market-observation-store';
import {
	assertValidBundle,
	CORROBORATION_SOURCE_URL,
	interpretLegacyMarketStatus,
	PRIMARY_SOURCE_URL,
	resolveMarketCheck,
	type MarketBundle,
} from '@/lib/ai-hub/market-observations';
import { bundleAfterRejectedWrite } from '@/lib/ai-hub/market-run-guard';

const seed = assertValidBundle(seedJson);
const ALLOWED = new Set([PRIMARY_SOURCE_URL, CORROBORATION_SOURCE_URL]);

let inflight: Promise<MarketCheckRun> | null = null;

export type MarketCheckRun = {
	bundle: MarketBundle;
	persistence: MarketPersistResult;
	ran: boolean;
};

export function getSeedMarketBundle(): MarketBundle {
	return seed;
}

export async function readPublishedMarketBundle(): Promise<MarketBundle> {
	const stored = await readPublishedMarketState();
	return interpretLegacyMarketStatus(stored?.bundle ?? seed, seed);
}

async function fetchAllowlisted(url: string): Promise<string> {
	if (!ALLOWED.has(url)) throw new Error(`source not allowlisted: ${url}`);
	let last: unknown;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 8000);
		try {
			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					Accept: 'text/html,application/xhtml+xml',
					'User-Agent': 'REDUE-GEO-MarketCheck/1.0',
				},
				cache: 'no-store',
			});
			if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
			return await response.text();
		} catch (error) {
			last = error;
		} finally {
			clearTimeout(timer);
		}
	}
	throw last instanceof Error ? last : new Error('source fetch failed');
}

export async function runAuthorizedMarketCheck(now: Date = new Date()): Promise<MarketCheckRun> {
	if (inflight) return inflight;
	inflight = runCheck(now).finally(() => {
		inflight = null;
	});
	return inflight;
}

async function runCheck(now: Date): Promise<MarketCheckRun> {
	const published = await readPublishedMarketBundle();
	if (!marketPersistenceAvailable()) {
		console.error('[ai-market] Firestore is not configured. The daily check was not saved.');
		return {
			bundle: published,
			persistence: { ok: false, durable: false, reason: 'firestore_unconfigured' },
			ran: false,
		};
	}

	const today = getKstDateKey(now);
	const claim = await claimMarketRun(today, now);
	if (claim.state === 'done') {
		return { bundle: published, persistence: { ok: true, durable: true, reason: 'already_checked' }, ran: false };
	}
	if (claim.state !== 'claimed') {
		const reason = claim.state === 'busy' ? 'busy' : claim.state === 'failed' ? 'firestore_write_failed' : 'firestore_unconfigured';
		return {
			bundle: published,
			persistence: { ok: false, durable: false, reason },
			ran: false,
		};
	}

	const stored = await readPublishedMarketState();
	const current = stored?.bundle ?? seed;
	const baseRevision = stored?.bundle.revision ?? null;
	const result = await resolveMarketCheck({
		current,
		lastCheckDate: stored?.lastCheckDate ?? null,
		today,
		now,
		fetchText: fetchAllowlisted,
	});
	const next: MarketStateRecord = {
		bundle: result.bundle,
		lastCheckDate: result.fetched ? result.lastCheckDate : stored?.lastCheckDate ?? null,
		history: stored?.history ?? [],
		logs: result.fetched ? [result.log, ...(stored?.logs ?? [])].slice(0, 30) : (stored?.logs ?? []),
	};
	const pending =
		result.log.candidate && result.log.status === 'review_required'
			? pendingFromCandidate({
					candidate: result.log.candidate,
					published: current,
					detectedAt: result.log.checkedAt,
					note: result.log.note,
				})
			: null;
	const persistence = await commitMarketRun({ token: claim.token, state: next, pending, baseRevision });
	const visible = bundleAfterRejectedWrite(current, persistence, next.bundle);
	if (!persistence.ok || !persistence.durable) {
		console.error('[ai-market] durable save failed:', persistence.reason);
		return { bundle: interpretLegacyMarketStatus(visible, seed), persistence, ran: true };
	}
	return { bundle: visible, persistence, ran: true };
}
