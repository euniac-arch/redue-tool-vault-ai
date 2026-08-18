import {
	auditStatusToStored,
	CATEGORY_TO_DIAGNOSTIC_ID,
} from '@/lib/audit/auditScoreCalculator';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { resolveAuditScoreFromReport } from '@/lib/audit/resolveAuditScore';
import { gradeForScore, type ScoreGrade } from '@/lib/audit/score-grade';
import { clearLatestAuditPayload, loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import type { AuditOverallStatus, AuditReport } from '@/lib/site-auditor';

export const AUDIT_HISTORY_STORAGE_KEY = 'redue_audit_history';
/** Bumped when admin/frontend deletes audits so open tabs can refetch without a full reload. */
export const AUDIT_HISTORY_SYNC_KEY = 'redue_audit_history_rev';
export const AUDIT_HISTORY_SYNC_CHANNEL = 'redue-audit-history-sync';
export const AUDIT_HISTORY_MAX = 10;
/** Ids the user deleted in this browser — survive Firestore refetch so cards stay gone. */
export const AUDIT_HISTORY_DELETED_KEY = 'redue_audit_history_deleted';
const DELETED_IDS_MAX = 200;

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
	/** 100-point technical headline — same as result-page `technicalScore`. */
	normalizedScore?: number;
	/** S / A / B / C/D from `normalizedScore` (HTTPS-capped). */
	grade?: ScoreGrade;
	gradeLabel?: string;
	/** GEO / AI-search trust score (0–100) from the diagnosis report. */
	geoScore?: number;
	/** GEO grade (S / A / B / C/D) matching the result-page headline. */
	geoGrade?: string;
	categories: Array<{
		id: string;
		label: string;
		score: number;
		maxScore: number;
		status: 'PASS' | 'WARN' | 'FAIL';
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

function geoHeadlineFromReport(report: AuditReport): { geoScore: number; geoGrade: string } {
	const lang = report.lang === 'en' ? 'en' : 'ko';
	const snapshot = buildDiagnosisScoreSnapshot(report, null, lang);
	return { geoScore: snapshot.externalTrustScore, geoGrade: snapshot.geoGrade };
}

/**
 * GEO headline (0–100 + grade) for a history row.
 * Prefers recomputing from the stored diagnosis report so the list stays
 * in sync with the result page; falls back to persisted fields on legacy rows.
 */
export function resolveHistoryGeoHeadline(item: AuditHistoryEntry): { score: number; grade: string } | null {
	if (item.report?.url) {
		try {
			const geo = geoHeadlineFromReport(item.report);
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

export function reportToHistoryEntry(id: string, report: AuditReport, createdAt?: string): AuditHistoryEntry {
	const geo = geoHeadlineFromReport(report);
	const auditScore = resolveAuditScoreFromReport(report);
	return {
		id,
		url: report.url,
		score: auditScore.totalEarnedScore,
		maxScore: auditScore.totalMaxScore,
		status: report.status,
		statusLabel: report.statusLabel,
		normalizedScore: auditScore.normalizedScore,
		grade: auditScore.grade,
		gradeLabel: auditScore.gradeLabel,
		geoScore: geo.geoScore,
		geoGrade: geo.geoGrade,
		categories: auditScore.categoryList.map((c) => ({
			id: CATEGORY_TO_DIAGNOSTIC_ID[c.id],
			label: c.name,
			score: c.score,
			maxScore: c.maxScore,
			status: auditStatusToStored(c.status),
		})),
		fetchedAt: report.fetchedAt,
		createdAt: createdAt ?? report.fetchedAt,
		report,
	};
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
 */
export function upsertGuestAuditOnRescan(
	id: string,
	report: AuditReport,
	opts?: { replaceId?: string | null },
): AuditHistoryEntry {
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
				forceRefresh: true,
				t,
				...(replaceId ? { replaceId } : {}),
			}),
		});
		const data = (await res.json()) as ScanPayload & { error?: string };
		if (!res.ok) throw new Error(data.error ?? 'Audit failed.');
		return data;
	})().finally(() => {
		const clear = () => {
			inflightScans.delete(inflightKey);
			inflightScans.delete(forceKey);
			if (!forceRefresh) inflightScans.delete(baseKey);
		};
		if (typeof window !== 'undefined') {
			// Reuse only an in-flight request (Strict Mode). Completed force-refresh
			// results are dropped immediately so the same URL can be recrawled.
			window.setTimeout(clear, forceRefresh ? 0 : 8_000);
		} else {
			clear();
		}
	});

	inflightScans.set(inflightKey, promise);
	return promise;
}
