import { clearLatestAuditPayload, loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import type { AuditOverallStatus, AuditReport } from '@/lib/site-auditor';

export const AUDIT_HISTORY_STORAGE_KEY = 'redue_audit_history';
/** Bumped when admin/frontend deletes audits so open tabs can refetch without a full reload. */
export const AUDIT_HISTORY_SYNC_KEY = 'redue_audit_history_rev';
export const AUDIT_HISTORY_SYNC_CHANNEL = 'redue-audit-history-sync';
export const AUDIT_HISTORY_MAX = 10;

/** Near-duplicate window: Strict Mode / effect re-runs often create multiple leads within seconds. */
const DEDUPE_WINDOW_MS = 90_000;

/** Lightweight list row — enough for history UI without storing the full report twice. */
export interface AuditHistoryEntry {
	id: string;
	url: string;
	score: number;
	maxScore: number;
	status: AuditOverallStatus;
	statusLabel: string;
	categories: Array<{
		id: string;
		label: string;
		score: number;
		maxScore: number;
		status: 'PASS' | 'FAIL';
	}>;
	fetchedAt: string;
	createdAt: string;
	/** Full report for offline/guest detail reload. */
	report: AuditReport;
}

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

/**
 * Keep newest entry per near-duplicate group (same URL + score within DEDUPE_WINDOW_MS).
 * Collapses Strict Mode / double-fetch duplicates while preserving intentional later rescans.
 */
export function dedupeHistoryEntries(entries: AuditHistoryEntry[]): AuditHistoryEntry[] {
	const sorted = [...entries].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
	const kept: AuditHistoryEntry[] = [];

	for (const entry of sorted) {
		const entryUrl = normalizeUrl(entry.url);
		const entryTime = new Date(entry.createdAt).getTime();
		const isDup = kept.some((existing) => {
			if (existing.id === entry.id) return true;
			if (normalizeUrl(existing.url) !== entryUrl) return false;
			if (existing.score !== entry.score) return false;
			const existingTime = new Date(existing.createdAt).getTime();
			return Math.abs(existingTime - entryTime) <= DEDUPE_WINDOW_MS;
		});
		if (!isDup) kept.push(entry);
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

function writeRaw(entries: AuditHistoryEntry[]): void {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(AUDIT_HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, AUDIT_HISTORY_MAX)));
	} catch {
		// Quota / private mode — ignore; DB still has the lead when available.
	}
}

export function reportToHistoryEntry(id: string, report: AuditReport, createdAt?: string): AuditHistoryEntry {
	return {
		id,
		url: report.url,
		score: report.score,
		maxScore: report.maxScore,
		status: report.status,
		statusLabel: report.statusLabel,
		categories: report.categories.map((c) => ({
			id: c.id,
			label: c.label,
			score: c.score,
			maxScore: c.maxScore,
			status: c.status,
		})),
		fetchedAt: report.fetchedAt,
		createdAt: createdAt ?? report.fetchedAt,
		report,
	};
}

/** Prepend a completed guest audit; dedupe near-duplicates; keep newest-first, max 10. */
export function saveGuestAudit(id: string, report: AuditReport): AuditHistoryEntry {
	const entry = reportToHistoryEntry(id, report);
	const next = dedupeHistoryEntries([entry, ...readRaw()]);
	writeRaw(next);
	return entry;
}

/**
 * Force-refresh upsert: drop prior guest rows for the same URL (and optional replaceId),
 * then prepend the live report so history immediately shows the new score.
 */
export function upsertGuestAuditOnRescan(
	id: string,
	report: AuditReport,
	opts?: { replaceId?: string | null },
): AuditHistoryEntry {
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
}

type ScanPayload = AuditReport & { id?: string | null; forceRefresh?: boolean };

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

export function getGuestAudits(): AuditHistoryEntry[] {
	const raw = readRaw();
	const deduped = dedupeHistoryEntries(raw);
	const dirty =
		raw.length !== deduped.length || raw.some((item, index) => item.id !== deduped[index]?.id);
	if (dirty) writeRaw(deduped);
	return deduped;
}

export function getGuestAuditById(id: string): AuditHistoryEntry | null {
	return getGuestAudits().find((item) => item.id === id) ?? null;
}

/** Remove one guest history row from localStorage. */
export function removeGuestAudit(id: string): void {
	writeRaw(readRaw().filter((item) => item.id !== id));
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
	writeRaw(readRaw().filter((item) => !remove.has(item.id)));
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
}): void {
	if (!isBrowser()) return;
	const payload = {
		type: 'audit-history-changed' as const,
		at: Date.now(),
		all: detail?.all === true,
		ids: detail?.ids ?? [],
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

/** GOOD / EXCELLENT = healthy; FAIR / POOR / CRITICAL = needs improvement. */
export function isHealthyStatus(status: AuditOverallStatus): boolean {
	return status === 'GOOD' || status === 'EXCELLENT';
}

export interface ScanSiteOptions {
	forceRefresh?: boolean;
	/** Existing history / Firestore id to overwrite on the server. */
	replaceId?: string | null;
}

/**
 * POST /api/audit/scan. With `forceRefresh`, bypasses in-flight reuse and sends
 * cache-bust body/headers so the crawler fetches live HTML.
 */
export function scanSiteOnce(
	targetUrl: string,
	lang: string,
	opts?: ScanSiteOptions,
): Promise<ScanPayload> {
	const forceRefresh = opts?.forceRefresh === true;
	const replaceId = opts?.replaceId?.trim() || '';
	const baseKey = `${targetUrl.trim()}|${lang}`;
	const key = forceRefresh ? `${baseKey}|force|${Date.now()}` : baseKey;

	if (!forceRefresh) {
		const existing = inflightScans.get(baseKey);
		if (existing) return existing;
	} else {
		inflightScans.delete(baseKey);
		clearAuditClientCacheForUrl(targetUrl);
	}

	const promise = (async () => {
		const t = Date.now();
		const res = await fetch(`/api/audit/scan?t=${t}`, {
			method: 'POST',
			cache: 'no-store',
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
			},
			body: JSON.stringify({
				url: targetUrl,
				lang,
				...(forceRefresh
					? {
							forceRefresh: true,
							t,
							...(replaceId ? { replaceId } : {}),
						}
					: {}),
			}),
		});
		const data = (await res.json()) as ScanPayload & { error?: string };
		if (!res.ok) throw new Error(data.error ?? 'Audit failed.');
		return data;
	})().finally(() => {
		// Keep briefly so a remount within Strict Mode still hits the cache.
		const clear = () => {
			inflightScans.delete(key);
			if (!forceRefresh) inflightScans.delete(baseKey);
		};
		if (typeof window !== 'undefined') {
			window.setTimeout(clear, forceRefresh ? 0 : 8_000);
		} else {
			clear();
		}
	});

	inflightScans.set(key, promise);
	if (!forceRefresh) inflightScans.set(baseKey, promise);
	return promise;
}
