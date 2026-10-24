import { urlMatchesSite } from '@/lib/audit/live-check-mentions';
import type { LiveCheckEngineId, LiveEngineCheckResult, LiveEngineChecksSnapshot } from '@/types/live-engine-check';

/**
 * Pure helpers shared by the server writer, the client panel, and the tests.
 * No store or framework access lives here.
 */

/** A real answer that also shows a web search ran. Only these rows count as a measurement. */
export function isGroundedSuccess(result: LiveEngineCheckResult | undefined | null): boolean {
	return Boolean(result && result.isLiveGrounded && !result.fallbackToRuleScore && !result.isMock);
}

/**
 * Merges a new attempt into the stored snapshot.
 *
 * - The latest attempt per engine always replaces the stored attempt, failures included,
 *   so the latest failure time is visible.
 * - A failed or ungrounded attempt never deletes an earlier grounded result. It moves to
 *   `lastGrounded`, so the UI can show it as an earlier measurement.
 * - A new grounded result clears that engine's `lastGrounded`.
 * - A different query drops `lastGrounded`, because the results are not comparable.
 */
export function mergeLiveSnapshots(
	prev: LiveEngineChecksSnapshot | null | undefined,
	next: LiveEngineChecksSnapshot,
): LiveEngineChecksSnapshot {
	const sameQuery = Boolean(prev) && prev?.targetQuery === next.targetQuery;
	const lastGrounded: Partial<Record<LiveCheckEngineId, LiveEngineCheckResult>> = sameQuery ? { ...(prev?.lastGrounded ?? {}) } : {};
	const prevByEngine = new Map<LiveCheckEngineId, LiveEngineCheckResult>((prev?.results ?? []).map((row) => [row.engine, row]));
	const nextEngines = new Set(next.results.map((row) => row.engine));

	const results: LiveEngineCheckResult[] = next.results.map((row) => {
		const stamped = { ...row, checkedAt: row.checkedAt ?? next.checkedAt };
		if (isGroundedSuccess(stamped)) {
			delete lastGrounded[stamped.engine];
			return stamped;
		}
		const before = prevByEngine.get(stamped.engine);
		const earlier = sameQuery && isGroundedSuccess(before) ? before : lastGrounded[stamped.engine];
		if (earlier) lastGrounded[stamped.engine] = earlier;
		else delete lastGrounded[stamped.engine];
		return stamped;
	});

	// An engine this run did not cover keeps its stored row.
	for (const [engine, row] of prevByEngine) {
		if (!nextEngines.has(engine) && sameQuery) results.push(row);
	}

	return {
		checkedAt: next.checkedAt,
		startedAt: next.startedAt,
		targetQuery: next.targetQuery,
		results,
		lastGrounded: Object.keys(lastGrounded).length > 0 ? lastGrounded : undefined,
	};
}

/**
 * A write is stale when the stored snapshot came from a request that started later.
 * Two overlapping requests then cannot let the older one overwrite the newer one.
 */
export function isStaleSnapshot(
	stored: Pick<LiveEngineChecksSnapshot, 'startedAt'> | null | undefined,
	incoming: Pick<LiveEngineChecksSnapshot, 'startedAt'>,
): boolean {
	return Boolean(stored?.startedAt && incoming.startedAt && stored.startedAt > incoming.startedAt);
}

function hostOf(url: unknown): string {
	if (typeof url !== 'string' || !url.trim()) return '';
	try {
		return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/\.$/, '').replace(/^www\./i, '').toLowerCase();
	} catch {
		return '';
	}
}

/**
 * The checked site must be the saved report's site (its original or post-redirect URL).
 * The audit id alone does not authorize a write for a different site.
 */
export function sameSiteAsReport(report: Record<string, unknown>, checkedUrl: string): boolean {
	const checked = hostOf(checkedUrl);
	if (!checked) return false;
	return [report.finalUrl, report.url].some((saved) => {
		const host = hostOf(saved);
		return Boolean(host) && (host === checked || urlMatchesSite(`https://${checked}`, `https://${host}`));
	});
}

export type ApplySnapshotOutcome =
	| { status: 'updated'; report: Record<string, unknown>; snapshot: LiveEngineChecksSnapshot }
	| { status: 'stale' }
	| { status: 'host_mismatch' };

/** Returns the report with only `liveEngineChecks` replaced. Every other field is untouched. */
export function applyLiveSnapshotToReport(
	report: Record<string, unknown>,
	siteUrl: string,
	incoming: LiveEngineChecksSnapshot,
): ApplySnapshotOutcome {
	if (!sameSiteAsReport(report, siteUrl)) return { status: 'host_mismatch' };
	const stored = readSavedSnapshot(report);
	if (isStaleSnapshot(stored, incoming)) return { status: 'stale' };
	const snapshot = mergeLiveSnapshots(stored, incoming);
	return { status: 'updated', report: { ...report, liveEngineChecks: snapshot }, snapshot };
}

/** Reads a stored snapshot off a saved report, or null when there is none. */
export function readSavedSnapshot(report: { liveEngineChecks?: unknown } | null | undefined): LiveEngineChecksSnapshot | null {
	const raw = report?.liveEngineChecks as Partial<LiveEngineChecksSnapshot> | undefined;
	if (!raw || !Array.isArray(raw.results) || raw.results.length === 0) return null;
	return {
		checkedAt: typeof raw.checkedAt === 'string' ? raw.checkedAt : '',
		startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : undefined,
		targetQuery: typeof raw.targetQuery === 'string' ? raw.targetQuery : '',
		results: raw.results,
		lastGrounded: raw.lastGrounded,
	};
}
