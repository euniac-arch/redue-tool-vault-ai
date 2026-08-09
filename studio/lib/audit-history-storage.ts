import type { AuditOverallStatus, AuditReport } from '@/lib/site-auditor';

export const AUDIT_HISTORY_STORAGE_KEY = 'redue_audit_history';
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

/** GOOD / EXCELLENT = healthy; FAIR / POOR / CRITICAL = needs improvement. */
export function isHealthyStatus(status: AuditOverallStatus): boolean {
	return status === 'GOOD' || status === 'EXCELLENT';
}

type ScanPayload = AuditReport & { id?: string | null };

/** Module-level in-flight map so React Strict Mode remounts reuse one network scan. */
const inflightScans = new Map<string, Promise<ScanPayload>>();

export function scanSiteOnce(targetUrl: string, lang: string): Promise<ScanPayload> {
	const key = `${targetUrl.trim()}|${lang}`;
	const existing = inflightScans.get(key);
	if (existing) return existing;

	const promise = (async () => {
		const res = await fetch('/api/audit/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: targetUrl, lang }),
		});
		const data = (await res.json()) as ScanPayload & { error?: string };
		if (!res.ok) throw new Error(data.error ?? 'Audit failed.');
		return data;
	})().finally(() => {
		// Keep briefly so a remount within Strict Mode still hits the cache.
		const clear = () => inflightScans.delete(key);
		if (typeof window !== 'undefined') {
			window.setTimeout(clear, 8_000);
		} else {
			clear();
		}
	});

	inflightScans.set(key, promise);
	return promise;
}
