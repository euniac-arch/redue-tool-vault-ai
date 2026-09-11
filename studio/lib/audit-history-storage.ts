import { buildDiagnosisScoreSnapshot, measuredScoreFromParts } from '@/lib/audit/diagnosis-scores';
import {
	diagnosisHeadlineFromReport,
	reportToHistoryEntry,
	type AuditHistoryEntry,
} from '@/lib/audit/history-entry';
import { resolveReportTrack3Score, type PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import { resolveAuditScoreFromReport } from '@/lib/audit/resolveAuditScore';
import { gradeForScore, type ScoreGrade } from '@/lib/audit/score-grade';
import { clearLatestAuditPayload, loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { removeLocalProjectsByIds } from '@/lib/projects-local';
import type { AuditOverallStatus, AuditReport } from '@/lib/site-auditor';
import {
	AUDIT_LIMIT_CODE,
	AuditLimitError,
	writeGuestAuditCount,
	type AuditQuotaSnapshot,
} from '@/lib/audit/free-audit-quota';
import {
	consumeAuditScanResponse,
	type AuditScanProgressPayload,
} from '@/lib/audit/scan-stream-client';

export type { AuditScanProgressPayload };

export type { AuditHistoryEntry } from '@/lib/audit/history-entry';
export { reportToHistoryEntry } from '@/lib/audit/history-entry';

export const AUDIT_HISTORY_STORAGE_KEY = 'redue_audit_history';
/** Bumped when admin/frontend deletes audits so open tabs can refetch without a full reload. */
export const AUDIT_HISTORY_SYNC_KEY = 'redue_audit_history_rev';
export const AUDIT_HISTORY_SYNC_CHANNEL = 'redue-audit-history-sync';
export const AUDIT_HISTORY_MAX = 10;
/** Ids the user deleted in this browser — survive Firestore refetch so cards stay gone. */
export const AUDIT_HISTORY_DELETED_KEY = 'redue_audit_history_deleted';
const DELETED_IDS_MAX = 200;

/** Reuse a just-completed force-refresh so Strict Mode remounts do not start a second INSERT. */
const SCAN_SINGLE_FLIGHT_MS = 8_000;
/**
 * Client-side ceiling on the `/api/audit/scan` request. The server's own `maxDuration=90`
 * (plus its internal Track 1/2 + persistence safety timeouts, see `TRACK_1_2_DEADLINE_MS`
 * in `route.ts`) bounds how long it can take to respond, but without a matching
 * client-side abort a stalled connection (dead socket, proxy timeout that never surfaces
 * an error, etc.) would leave the result page's loading terminal spinning forever. Set
 * comfortably above the server ceiling so a menu-heavy site's genuinely slow-but-completing
 * full-audit crawl (up to `FULL_AUDIT_TIME_BUDGET_MS`) is never cut off early — the
 * `/api/audit/scan` response now streams NDJSON progress lines throughout the crawl (see
 * `consumeAuditScanResponse`), so this ceiling only needs to guard against a truly dead
 * connection, not a quiet-but-alive one.
 */
const SCAN_FETCH_TIMEOUT_MS = 100_000;

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function normalizeUrl(raw: string): string {
	try {
		const u = new URL(raw);
		u.hash = '';
		const path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`.toLowerCase();
	} catch {
		return raw.trim().toLowerCase().replace(/\/+$/, '');
	}
}

function historyHostPath(raw: string): string {
	try {
		const u = new URL(raw);
		return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '') || '/'}`;
	} catch {
		return normalizeUrl(raw);
	}
}

/**
 * Keep newest entry per site (host + path). One diagnosis / rescan = one history row.
 * Also collapses Strict Mode / AuditLead+AuditReport dual-write duplicates.
 */
export function dedupeHistoryEntries(entries: AuditHistoryEntry[]): AuditHistoryEntry[] {
	const sorted = [...entries].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
	const kept: AuditHistoryEntry[] = [];
	const seenIds = new Set<string>();
	const seenSites = new Set<string>();

	for (const entry of sorted) {
		if (seenIds.has(entry.id)) continue;
		const siteKey = historyHostPath(entry.url);
		if (seenSites.has(siteKey)) continue;
		seenIds.add(entry.id);
		seenSites.add(siteKey);
		kept.push(entry);
	}

	return kept;
}

function readRaw(): AuditHistoryEntry[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(AUDIT_HISTORY_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as AuditHistoryEntry[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/**
 * Full `AuditReport` rows (fullAudit census + checklist evidence) can be large, so a guest
 * with a handful of scans can realistically hit the ~5MB `localStorage` quota. Rather than
 * silently dropping the newest scan (the old behavior — this is exactly why a guest could
 * diagnose a site and never see it land in "최근 진단내역"), progressively drop the oldest
 * rows and retry before giving up.
 */
function writeRaw(entries: AuditHistoryEntry[]): void {
	if (!isBrowser()) return;
	const capped = entries.slice(0, AUDIT_HISTORY_MAX);
	for (let keep = capped.length; keep > 0; keep -= 1) {
		try {
			window.localStorage.setItem(AUDIT_HISTORY_STORAGE_KEY, JSON.stringify(capped.slice(0, keep)));
			return;
		} catch (err) {
			if (keep === 1) {
				console.error('[audit-history] localStorage write failed even for a single entry:', err);
			}
			// Quota exceeded — retry with fewer (newest-first) rows.
		}
	}
	try {
		window.localStorage.removeItem(AUDIT_HISTORY_STORAGE_KEY);
	} catch {
		// Private mode — nothing more we can do.
	}
}

/**
 * GEO headline (0–100 + grade) for a history row.
 * Prefers recomputing from the stored diagnosis report so the list stays
 * in sync with the result page; falls back to persisted fields on legacy rows.
 */
export type HistoryMeasuredScorePatch = {
	id: string;
	measuredScore: number;
	measuredGrade: ScoreGrade;
	coreWebVitalsScore?: number | null;
	pageSpeedDesktop?: PageSpeedSnapshot | null;
	pageSpeedMobile?: PageSpeedSnapshot | null;
};

function mergeReportTrack3(
	base: AuditReport | undefined,
	incoming?: Pick<AuditReport, 'pageSpeedDesktop' | 'pageSpeedMobile'> | null,
): AuditReport | undefined {
	if (!base) return undefined;
	if (!incoming?.pageSpeedDesktop && !incoming?.pageSpeedMobile) return base;
	return {
		...base,
		pageSpeedDesktop: incoming.pageSpeedDesktop ?? base.pageSpeedDesktop,
		pageSpeedMobile: incoming.pageSpeedMobile ?? base.pageSpeedMobile,
	};
}

/**
 * 종합 실측 점수 for a history row — same formula as the result-page hero.
 * Once Track 3 (PSI, ≤20s) lands the result page writes `measuredScore` + CWV;
 * that exact composite is the badge. Before PSI, fall back to the scan-time
 * blend (CWV ≈ technical) or recompute from a persisted `pageSpeed*` snapshot.
 */
export function resolveHistoryMeasuredHeadline(item: AuditHistoryEntry): { score: number; grade: ScoreGrade } {
	const reportCwv = item.report ? resolveReportTrack3Score(item.report) : null;
	const itemCwv = typeof item.coreWebVitalsScore === 'number' ? item.coreWebVitalsScore : null;
	const cwv = reportCwv ?? itemCwv;
	if (cwv != null && typeof item.measuredScore === 'number') {
		return { score: item.measuredScore, grade: item.measuredGrade ?? gradeForScore(item.measuredScore) };
	}
	if (item.report?.url && cwv != null) {
		try {
			const lang = item.report.lang === 'en' ? 'en' : 'ko';
			const snapshot = buildDiagnosisScoreSnapshot(item.report, null, lang, {
				coreWebVitalsScore100: cwv,
			});
			return { score: snapshot.measuredScore, grade: snapshot.grade };
		} catch {
			// Fall through to persisted fields.
		}
	}
	if (typeof item.measuredScore === 'number') {
		return { score: item.measuredScore, grade: item.measuredGrade ?? gradeForScore(item.measuredScore) };
	}
	const technical = resolveAuditScoreFromHistorySafe(item);
	const geo = item.geoScore ?? technical;
	const score = measuredScoreFromParts(geo, technical, { url: item.url, hasSsl: item.report?.hasSsl });
	return { score, grade: gradeForScore(score) };
}

function resolveAuditScoreFromHistorySafe(item: AuditHistoryEntry): number {
	try {
		return resolveAuditScoreFromReport(item.report).normalizedScore;
	} catch {
		return typeof item.normalizedScore === 'number' ? item.normalizedScore : item.score;
	}
}

export function applyMeasuredScorePatchToEntries(
	items: AuditHistoryEntry[],
	patch: HistoryMeasuredScorePatch,
): AuditHistoryEntry[] {
	const key = patch.id.trim();
	if (!key) return items;
	return items.map((item) => {
		if (item.id !== key) return item;
		const nextCwv = typeof patch.coreWebVitalsScore === 'number' ? patch.coreWebVitalsScore : item.coreWebVitalsScore;
		return {
			...item,
			measuredScore: patch.measuredScore,
			measuredGrade: patch.measuredGrade,
			coreWebVitalsScore: nextCwv ?? null,
			report: mergeReportTrack3(item.report, patch) ?? item.report,
		};
	});
}

export function applyLocalMeasuredScorePatches(
	items: AuditHistoryEntry[],
	patches: AuditHistoryEntry[] = [],
): AuditHistoryEntry[] {
	if (items.length === 0 || patches.length === 0) return items;
	const byId = new Map(patches.map((row) => [row.id, row]));
	return items.map((item) => {
		const patch = byId.get(item.id);
		if (!patch) return item;
		const patchCwv = typeof patch.coreWebVitalsScore === 'number' ? patch.coreWebVitalsScore : null;
		const patchHasPsi = Boolean(patch.report?.pageSpeedDesktop || patch.report?.pageSpeedMobile);
		if (patchCwv == null && !patchHasPsi) return item;
		const itemCwv = typeof item.coreWebVitalsScore === 'number' ? item.coreWebVitalsScore : null;
		const nextReport = mergeReportTrack3(item.report, patch.report) ?? item.report;
		if (
			itemCwv === patchCwv &&
			item.measuredScore === patch.measuredScore &&
			nextReport === item.report
		) {
			return item;
		}
		return {
			...item,
			measuredScore: patch.measuredScore ?? item.measuredScore,
			measuredGrade: patch.measuredGrade ?? item.measuredGrade,
			coreWebVitalsScore: patchCwv ?? itemCwv,
			report: nextReport,
		};
	});
}

export function resolveHistoryGeoHeadline(item: AuditHistoryEntry): { score: number; grade: string } | null {
	if (item.report?.url) {
		try {
			const geo = diagnosisHeadlineFromReport(item.report);
			return { score: geo.geoScore, grade: geo.geoGrade };
		} catch {
			// Fall through to persisted fields.
		}
	}
	if (typeof item.geoScore === 'number') {
		return { score: item.geoScore, grade: gradeForScore(item.geoScore) };
	}
	return null;
}

/** Prepend a completed guest audit; dedupe near-duplicates; keep newest-first, max 10. */
export function saveGuestAudit(id: string, report: AuditReport): AuditHistoryEntry | null {
	try {
		forgetDeletedAuditIds([id]);
		const entry = reportToHistoryEntry(id, report);
		const next = dedupeHistoryEntries([entry, ...filterDeletedHistoryEntries(readRaw())]);
		writeRaw(next);
		return entry;
	} catch {
		return null;
	}
}

/**
 * Force-refresh upsert: drop prior guest rows for the same URL (and optional replaceId),
 * then prepend the live report so history immediately shows the new score.
 *
 * Best-effort only — a diagnosis that finished and rendered on screen must never be treated
 * as failed just because this bookkeeping step choked on an unexpected report shape. Callers
 * should not let a thrown error here block `setReport`/UI updates for a successful scan.
 */
export function upsertGuestAuditOnRescan(
	id: string,
	report: AuditReport,
	opts?: { replaceId?: string | null },
): AuditHistoryEntry | null {
	try {
		forgetDeletedAuditIds([id]);
		const entry = reportToHistoryEntry(id, report);
		const targetUrl = normalizeUrl(report.url);
		const replaceId = opts?.replaceId?.trim() || '';
		const filtered = readRaw().filter((item) => {
			if (replaceId && item.id === replaceId) return false;
			if (item.id === id) return false;
			return normalizeUrl(item.url) !== targetUrl;
		});
		const next = dedupeHistoryEntries([entry, ...filtered]);
		writeRaw(next);
		return entry;
	} catch (err) {
		console.error('[audit-history] upsertGuestAuditOnRescan failed — guest history row not saved:', err);
		return null;
	}
}

/**
 * Patch a stored history row's `measuredScore`/`measuredGrade`/`coreWebVitalsScore`
 * once the live PageSpeed(Lighthouse) read lands on the result page — called from
 * `AuditReportDocument` so the history badge and the result-page headline never drift
 * apart after PSI resolves asynchronously. No-op for ids that fell out of the
 * (max 10) guest history window.
 */
export function updateHistoryMeasuredScore(
	id: string,
	patch: {
		measuredScore: number;
		measuredGrade: ScoreGrade;
		coreWebVitalsScore?: number | null;
		pageSpeedDesktop?: PageSpeedSnapshot | null;
		pageSpeedMobile?: PageSpeedSnapshot | null;
	},
): AuditHistoryEntry | null {
	const key = id.trim();
	if (!key || !isBrowser()) return null;
	const raw = readRaw();
	let changed = false;
	let updated: AuditHistoryEntry | null = null;
	const nextCwv = patch.coreWebVitalsScore ?? null;
	const next = raw.map((item) => {
		if (item.id !== key) return item;
		const nextReport = item.report
			? {
					...item.report,
					pageSpeedDesktop: patch.pageSpeedDesktop ?? item.report.pageSpeedDesktop,
					pageSpeedMobile: patch.pageSpeedMobile ?? item.report.pageSpeedMobile,
				}
			: item.report;
		if (
			item.measuredScore === patch.measuredScore &&
			item.measuredGrade === patch.measuredGrade &&
			(item.coreWebVitalsScore ?? null) === nextCwv &&
			nextReport?.pageSpeedDesktop === item.report?.pageSpeedDesktop &&
			nextReport?.pageSpeedMobile === item.report?.pageSpeedMobile
		) {
			updated = item;
			return item;
		}
		changed = true;
		updated = {
			...item,
			measuredScore: patch.measuredScore,
			measuredGrade: patch.measuredGrade,
			coreWebVitalsScore: nextCwv,
			report: nextReport,
		};
		return updated;
	});
	if (changed) writeRaw(next);
	const scorePatch: HistoryMeasuredScorePatch = {
		id: key,
		measuredScore: patch.measuredScore,
		measuredGrade: patch.measuredGrade,
		coreWebVitalsScore: nextCwv,
		pageSpeedDesktop: patch.pageSpeedDesktop,
		pageSpeedMobile: patch.pageSpeedMobile,
	};
	notifyAuditHistorySync({ ids: [key], entry: updated, scorePatch });
	return updated;
}

type ScanPayload = AuditReport & {
	id?: string | null;
	forceRefresh?: boolean;
	userId?: string | null;
	userType?: 'admin' | 'user' | 'guest';
	diagnosedAt?: string;
	quota?: AuditQuotaSnapshot;
};

function isScanReportPayload(data: unknown): data is ScanPayload {
	if (!data || typeof data !== 'object') return false;
	const row = data as Record<string, unknown>;
	return typeof row.url === 'string' && row.url.length > 0 && typeof row.score === 'number' && Array.isArray(row.categories);
}

/** Module-level in-flight map so React Strict Mode remounts reuse one network scan. */
const inflightScans = new Map<string, Promise<ScanPayload>>();

/** Drop guest history + latest-payload cache for a URL before a live re-scan. */
export function clearAuditClientCacheForUrl(rawUrl: string): void {
	if (!isBrowser()) return;
	const target = normalizeUrl(rawUrl);
	writeRaw(readRaw().filter((item) => normalizeUrl(item.url) !== target));

	const latest = loadLatestAuditPayload();
	if (latest?.report?.url && normalizeUrl(latest.report.url) === target) {
		clearLatestAuditPayload();
	}

	const trimmed = rawUrl.trim();
	for (const key of [...inflightScans.keys()]) {
		if (key.startsWith(`${trimmed}|`) || key.includes(`|${trimmed}|`)) {
			inflightScans.delete(key);
		}
	}
}

function readDeletedIds(): string[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(AUDIT_HISTORY_DELETED_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.map((id) => String(id || '').trim()).filter(Boolean);
	} catch {
		return [];
	}
}

function writeDeletedIds(ids: string[]): void {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(
			AUDIT_HISTORY_DELETED_KEY,
			JSON.stringify(ids.slice(0, DELETED_IDS_MAX)),
		);
	} catch {
		// ignore quota / private mode
	}
}

export function isDeletedAuditId(id: string | null | undefined): boolean {
	const key = String(id || '').trim();
	if (!key) return false;
	return readDeletedIds().includes(key);
}

/** Hide these ids from history lists even if the server still returns them. */
export function rememberDeletedAuditIds(ids: Iterable<string>): void {
	const incoming = [...ids].map((id) => String(id || '').trim()).filter(Boolean);
	if (incoming.length === 0) return;
	const next = [...incoming, ...readDeletedIds().filter((id) => !incoming.includes(id))];
	writeDeletedIds(next);
}

export function forgetDeletedAuditIds(ids: Iterable<string>): void {
	const drop = new Set([...ids].map((id) => String(id || '').trim()).filter(Boolean));
	if (drop.size === 0) return;
	writeDeletedIds(readDeletedIds().filter((id) => !drop.has(id)));
}

export function filterDeletedHistoryEntries<T extends { id: string }>(items: readonly T[]): T[] {
	const deleted = new Set(readDeletedIds());
	if (deleted.size === 0) return [...items];
	return items.filter((item) => !deleted.has(item.id));
}

export function getGuestAudits(): AuditHistoryEntry[] {
	const raw = readRaw();
	const deduped = filterDeletedHistoryEntries(dedupeHistoryEntries(raw));
	const dirty =
		raw.length !== deduped.length || raw.some((item, index) => item.id !== deduped[index]?.id);
	if (dirty) writeRaw(deduped);
	return deduped;
}

export function getGuestAuditById(id: string): AuditHistoryEntry | null {
	if (isDeletedAuditId(id)) return null;
	return getGuestAudits().find((item) => item.id === id) ?? null;
}

/** Remove one guest history row from localStorage and tombstone it against server refetch. */
export function removeGuestAudit(id: string): void {
	const key = id.trim();
	if (!key) return;
	rememberDeletedAuditIds([key]);
	writeRaw(readRaw().filter((item) => item.id !== key));
	removeLocalProjectsByIds([key]);
}

/**
 * Drop guest cache rows whose ids are absent from the authoritative server list.
 * Used after /api/audit/history (Firestore) so admin hard-deletes sync into the browser.
 */
export function pruneGuestAuditsToServerIds(serverIds: Iterable<string>): void {
	const keep = new Set([...serverIds].map((id) => String(id || '').trim()).filter(Boolean));
	writeRaw(readRaw().filter((item) => keep.has(item.id)));
}

/** Remove guest rows by id (admin bulk-delete) and notify other tabs to refetch. */
export function removeGuestAuditsByIds(ids: Iterable<string>): void {
	const remove = new Set([...ids].map((id) => String(id || '').trim()).filter(Boolean));
	if (remove.size === 0) return;
	rememberDeletedAuditIds(remove);
	writeRaw(readRaw().filter((item) => !remove.has(item.id)));
	removeLocalProjectsByIds(remove);
}

/** Clear all guest history rows (admin delete-all). */
export function clearGuestAudits(): void {
	writeRaw([]);
}

/**
 * Notify open `/audit/history` (and other) tabs that the shared audit store changed.
 * Uses BroadcastChannel + localStorage so same-tab and cross-tab listeners both fire.
 */
export function notifyAuditHistorySync(detail?: {
	all?: boolean;
	ids?: string[];
	entry?: AuditHistoryEntry | null;
	scorePatch?: HistoryMeasuredScorePatch;
}): void {
	if (!isBrowser()) return;
	const payload = {
		type: 'audit-history-changed' as const,
		at: Date.now(),
		all: detail?.all === true,
		ids: detail?.ids ?? [],
		entry: detail?.entry ?? null,
		scorePatch: detail?.scorePatch ?? null,
	};
	try {
		window.localStorage.setItem(AUDIT_HISTORY_SYNC_KEY, JSON.stringify(payload));
	} catch {
		// ignore quota / private mode
	}
	try {
		const channel = new BroadcastChannel(AUDIT_HISTORY_SYNC_CHANNEL);
		channel.postMessage(payload);
		channel.close();
	} catch {
		// BroadcastChannel unsupported — storage event still covers other tabs.
	}
	try {
		window.dispatchEvent(new CustomEvent(AUDIT_HISTORY_SYNC_CHANNEL, { detail: payload }));
	} catch {
		// ignore
	}
}

/**
 * Remove a diagnosis from the browser cache AND the server (Firestore
 * audit_projects + Prisma Project / AuditLead / AuditReport) so the admin
 * workspace and the public history list stay in sync.
 */
export async function deleteAuditHistoryEverywhere(id: string): Promise<void> {
	const key = id.trim();
	if (!key) return;
	removeGuestAudit(key);
	const res = await fetch(`/api/audit/${encodeURIComponent(key)}`, { method: 'DELETE' });
	const data = (await res.json().catch(() => ({}))) as { error?: string };
	if (!res.ok && res.status !== 404) {
		throw new Error(data.error || '삭제에 실패했습니다.');
	}
	notifyAuditHistorySync({ ids: [key] });
}

/** GOOD / EXCELLENT = healthy; FAIR / POOR / CRITICAL = needs improvement. */
export function isHealthyStatus(status: AuditOverallStatus): boolean {
	return status === 'GOOD' || status === 'EXCELLENT';
}

export interface ScanSiteOptions {
	forceRefresh?: boolean;
	/** Existing history / Firestore id to overwrite on the server. */
	replaceId?: string | null;
	/**
	 * Fires as each NDJSON progress line arrives from `/api/audit/scan` (crawl
	 * phase/page-by-page status — see `full-audit-engine.ts`'s `FullAuditProgress`).
	 * Lets a caller show real status during a menu-heavy site's longer full-audit crawl
	 * instead of a fixed "still computing" placeholder. Never fires for a cached/legacy
	 * plain-JSON response (no crawl happened).
	 */
	onProgress?: (progress: AuditScanProgressPayload) => void;
}

/**
 * POST /api/audit/scan with `forceRefresh: true` so the server recrawls live
 * HTML meta/schema instead of returning a stored diagnosis for the same URL.
 * `opts.forceRefresh` also drops guest cache and skips reuse of a completed scan.
 */
export function scanSiteOnce(
	targetUrl: string,
	lang: string,
	opts?: ScanSiteOptions,
): Promise<ScanPayload> {
	const forceRefresh = opts?.forceRefresh === true;
	const replaceId = opts?.replaceId?.trim() || '';
	const baseKey = `${targetUrl.trim()}|${lang}`;
	const forceKey = `${baseKey}|force`;
	const inflightKey = forceRefresh ? forceKey : baseKey;

	if (forceRefresh) {
		inflightScans.delete(baseKey);
		// Drop only the latest-payload cache + inflight map. History rows stay
		// until upsertGuestAuditOnRescan replaces them after a successful scan.
		if (isBrowser()) {
			const latest = loadLatestAuditPayload();
			if (latest?.report?.url && normalizeUrl(latest.report.url) === normalizeUrl(targetUrl)) {
				clearLatestAuditPayload();
			}
		}
		const existingForce = inflightScans.get(forceKey);
		if (existingForce) return existingForce;
	} else {
		const existing = inflightScans.get(baseKey);
		if (existing) return existing;
	}

	const promise = (async () => {
		const t = Date.now();
		let hintedUserId = '';
		let hintedRole = '';
		if (isBrowser()) {
			try {
				const { getSession } = await import('next-auth/react');
				const session = await getSession();
				hintedUserId = session?.user?.id?.trim() || '';
				const rawRole = session?.user?.role ? String(session.user.role) : '';
				if (rawRole.toUpperCase() === 'ADMIN' || rawRole.toLowerCase() === 'admin') {
					hintedRole = 'admin';
				} else if (hintedUserId) {
					hintedRole = 'user';
				}
			} catch {
				// Session lookup is best-effort — cookies still go with same-origin fetch.
			}
		}
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		};
		if (hintedUserId) {
			headers['X-Redue-User-Id'] = hintedUserId;
			if (hintedRole) headers['X-Redue-User-Role'] = hintedRole;
		}
		console.log('[audit/scan][client] fetch start', { targetUrl, lang, forceRefresh, replaceId: replaceId || null, t });

		let res: Response;
		try {
			res = await fetch(`/api/audit/scan?t=${t}`, {
				method: 'POST',
				cache: 'no-store',
				credentials: 'include',
				headers,
				body: JSON.stringify({
					url: targetUrl,
					lang,
					forceRefresh: true,
					t,
					...(replaceId ? { replaceId } : {}),
					...(hintedUserId ? { userId: hintedUserId } : {}),
					...(hintedRole ? { role: hintedRole } : {}),
				}),
				signal: AbortSignal.timeout(SCAN_FETCH_TIMEOUT_MS),
			});
		} catch (err) {
			const isTimeout =
				err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
			console.error('[audit/scan][client] fetch failed', {
				targetUrl,
				isTimeout,
				message: err instanceof Error ? err.message : String(err),
			});
			throw new Error(
				isTimeout
					? '진단 서버 응답이 지연되어 요청을 중단했습니다. 잠시 후 다시 시도해 주세요.'
					: '네트워크 오류로 진단 요청에 실패했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.',
			);
		}

		console.log('[audit/scan][client] response received', { targetUrl, status: res.status, ok: res.ok });

		type ScanApiResponse = Partial<ScanPayload> & {
			error?: string;
			code?: string;
			used?: number;
			remaining?: number;
			limit?: number;
			unlimited?: boolean;
			quota?: AuditQuotaSnapshot;
		};
		let status: number;
		let ok: boolean;
		let data: ScanApiResponse;
		try {
			// Reads either the NDJSON progress stream (typical path — a menu-heavy site's
			// crawl can take tens of seconds, and `onProgress` fires per phase/page as it
			// happens) or a legacy/pre-flight plain-JSON error body (400 invalid URL, 402
			// quota exceeded — those still return synchronously before the scan even starts).
			const consumed = await consumeAuditScanResponse(res, opts?.onProgress);
			status = consumed.status;
			ok = consumed.ok;
			data = consumed.data as ScanApiResponse;
		} catch (err) {
			console.error('[audit/scan][client] response stream read failed', {
				targetUrl,
				status: res.status,
				message: err instanceof Error ? err.message : String(err),
			});
			throw new Error('진단 응답을 해석하지 못했습니다. 잠시 후 다시 시도해 주세요.');
		}

		if (data.code === AUDIT_LIMIT_CODE || status === 402) {
			console.warn('[audit/scan][client] quota limit reached', { targetUrl, used: data.used });
			throw new AuditLimitError(data.error ?? 'AUDIT_LIMIT_REACHED', {
				used: data.used ?? data.quota?.used,
				unlimited: data.unlimited ?? data.quota?.unlimited,
				date: data.quota?.date,
			});
		}
		if (!ok && !isScanReportPayload(data)) {
			console.error('[audit/scan][client] non-ok response without a usable report', {
				targetUrl,
				status,
				error: data.error,
			});
			throw new Error(data.error ?? 'Audit failed.');
		}
		if (!isScanReportPayload(data)) {
			console.error('[audit/scan][client] response missing report shape', { targetUrl, status });
			throw new Error(data.error ?? 'Audit failed.');
		}
		if (data.quota && !data.quota.unlimited) {
			writeGuestAuditCount(data.quota.used);
		}
		console.log('[audit/scan][client] scan complete', {
			targetUrl,
			id: data.id ?? null,
			score: data.score,
		});
		return data;
	})().finally(() => {
		const clear = () => {
			inflightScans.delete(inflightKey);
			inflightScans.delete(forceKey);
			if (!forceRefresh) inflightScans.delete(baseKey);
		};
		if (typeof window !== 'undefined') {
			window.setTimeout(clear, SCAN_SINGLE_FLIGHT_MS);
		} else {
			clear();
		}
	});

	inflightScans.set(inflightKey, promise);
	return promise;
}
