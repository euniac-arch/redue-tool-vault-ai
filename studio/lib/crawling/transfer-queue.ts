import type {
	CrawlCountryCode,
	CrawlIndustryCode,
	CrawlTargetTagCode,
} from '@/lib/crawling/taxonomy';
import type { CrawlCollectStatus, HybridCrawlScanData } from '@/lib/crawling/types';

/** Pending URLs queued from setup → list for hybrid scan */
export const CRAWL_TRANSFER_QUEUE_KEY = 'admin.crawling.transferQueue';
/** Persisted rows transferred into the diagnosis list (survives remount) */
export const CRAWL_IMPORTED_RECORDS_KEY = 'admin.crawling.importedListRecords';
/** Legacy flag: previously hid mock/demo seed rows after full reset */
export const CRAWL_LIST_CLEARED_KEY = 'admin.crawling.listCleared';

export type CrawlTransferSource = 'discovery' | 'single' | 'excel' | 'manual';

/** Hybrid scan metrics persisted on list rows */
export type CrawlScanMetrics = {
	cms?: string;
	ttfbMs?: number;
	hasViewport?: boolean;
	isIndexable?: boolean;
	seoScore?: number;
	psiUsed?: boolean;
	description?: string;
};

export type CrawlTransferItem = {
	url: string;
	siteName?: string;
	country?: CrawlCountryCode;
	region?: string;
	category?: CrawlIndustryCode;
	targetTag?: CrawlTargetTagCode;
	source: CrawlTransferSource;
	/** Prefetched hybrid scan result — list applies without re-calling API */
	scanResult?: HybridCrawlScanData;
};

export type CrawlTransferPayload = {
	queuedAt: string;
	items: CrawlTransferItem[];
	autoScan: boolean;
};

/** Row-level scan lifecycle shown on the diagnosis list */
export type CrawlScanLifecycle = 'IDLE' | 'SCANNING' | 'COMPLETED' | 'FAILED';

export type ImportedCrawlListRecord = {
	id: string;
	no: number;
	siteName: string;
	menuPath: string;
	title: string;
	url: string;
	crawledAt: string;
	status: CrawlCollectStatus;
	country: CrawlCountryCode;
	region: string;
	category: CrawlIndustryCode;
	targetTag: CrawlTargetTagCode;
	snippet: string;
	errorMessage?: string;
	auditPhase: 'PENDING' | 'RUNNING' | 'DONE';
	cms?: string;
	ttfbMs?: number;
	hasViewport?: boolean;
	isIndexable?: boolean;
	seoScore?: number;
	psiUsed?: boolean;
	description?: string;
	/** True while /api/crawling/scan is in flight */
	scanning?: boolean;
	/** Explicit lifecycle for transfer → auto-scan UI */
	scanLifecycle?: CrawlScanLifecycle;
	/** Root domain (eTLD+1) mirrored from `target_sites.domain` */
	domain?: string;
	/** Prisma `target_sites.id` — used by refresh / diagnose APIs */
	targetSiteId?: string;
	email?: string | null;
	contactFormUrl?: string | null;
	phoneNumber?: string | null;
	address?: string | null;
	kakaoChannelUrl?: string | null;
	instagramUrl?: string | null;
	naverTalkUrl?: string | null;
	googleRating?: number | null;
	googleReviewCount?: number | null;
	lastScrapedAt?: string | null;
	targetStatus?: 'PENDING' | 'DIAGNOSED' | 'CONTACTED' | 'EXCLUDED';
	/** Firestore / AuditLead id for `/audit/result?id=` */
	auditLeadId?: string | null;
	checkLocationNeeded?: boolean;
	parsedAddress?: string | null;
};

export function metricsFromScanData(data: HybridCrawlScanData): CrawlScanMetrics & {
	siteName: string;
	snippet: string;
	status: CrawlCollectStatus;
	crawledAt: string;
} {
	const status: CrawlCollectStatus =
		data.seoScore >= 70 ? 'success' : data.seoScore >= 40 ? 'warning' : 'failed';
	const viewportLabel = data.hasViewport ? 'OK' : '없음';
	const indexLabel = data.isIndexable ? '허용' : '차단';
	return {
		siteName: data.siteName,
		cms: data.cms,
		ttfbMs: data.ttfbMs,
		hasViewport: data.hasViewport,
		isIndexable: data.isIndexable,
		seoScore: data.seoScore,
		psiUsed: data.psiUsed,
		description: data.description,
		status,
		crawledAt: data.crawledAt,
		snippet: `CMS ${data.cms} · SEO ${data.seoScore} · TTFB ${data.ttfbMs}ms · Viewport ${viewportLabel} · 색인 ${indexLabel}`,
	};
}

function normalizeHttpUrl(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	try {
		const parsed = new URL(withProtocol);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
		if (!parsed.hostname.includes('.')) return null;
		return parsed.toString();
	} catch {
		return null;
	}
}

export function validateCrawlTransferUrl(raw: string): string | null {
	return normalizeHttpUrl(raw);
}

export function urlKey(url: string): string {
	return url.replace(/\/$/, '').toLowerCase();
}

export function loadImportedCrawlRecords(): ImportedCrawlListRecord[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(CRAWL_IMPORTED_RECORDS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as ImportedCrawlListRecord[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function saveImportedCrawlRecords(records: ImportedCrawlListRecord[]) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(CRAWL_IMPORTED_RECORDS_KEY, JSON.stringify(records));
	} catch {
		/* ignore quota */
	}
}

/** Wipe persisted diagnosis-list rows (used by full reset). */
export function clearImportedCrawlRecords() {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.removeItem(CRAWL_IMPORTED_RECORDS_KEY);
	} catch {
		/* ignore */
	}
}

export function isCrawlListCleared(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return window.localStorage.getItem(CRAWL_LIST_CLEARED_KEY) === '1';
	} catch {
		return false;
	}
}

export function markCrawlListCleared() {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(CRAWL_LIST_CLEARED_KEY, '1');
	} catch {
		/* ignore */
	}
}

/** Clear legacy list-cleared flag (no longer required; list never auto-seeds mocks). */
export function clearCrawlListClearedFlag() {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.removeItem(CRAWL_LIST_CLEARED_KEY);
	} catch {
		/* ignore */
	}
}

export function upsertImportedCrawlRecords(incoming: ImportedCrawlListRecord[]): ImportedCrawlListRecord[] {
	const existing = loadImportedCrawlRecords();
	const byUrl = new Map(existing.map((r) => [urlKey(r.url), r]));
	for (const row of incoming) {
		byUrl.set(urlKey(row.url), row);
	}
	const merged = Array.from(byUrl.values()).sort((a, b) => b.no - a.no);
	saveImportedCrawlRecords(merged);
	clearCrawlListClearedFlag();
	return merged;
}

export function patchImportedCrawlRecord(
	url: string,
	patch: Partial<ImportedCrawlListRecord>,
): void {
	const existing = loadImportedCrawlRecords();
	const key = urlKey(url);
	const next = existing.map((row) => (urlKey(row.url) === key ? { ...row, ...patch } : row));
	saveImportedCrawlRecords(next);
}

export function patchImportedCrawlRecordByTargetId(
	targetSiteId: string,
	patch: Partial<ImportedCrawlListRecord>,
): void {
	const id = targetSiteId.trim();
	if (!id) return;
	const existing = loadImportedCrawlRecords();
	const next = existing.map((row) => (row.targetSiteId === id || row.id === id ? { ...row, ...patch } : row));
	saveImportedCrawlRecords(next);
}

/** Mark a list row as DIAGNOSED after the public precision engine finishes. */
export function markImportedCrawlRecordDiagnosed(input: {
	targetSiteId?: string | null;
	url?: string | null;
	auditLeadId?: string | null;
	seoScore?: number;
}): void {
	const patch: Partial<ImportedCrawlListRecord> = {
		auditPhase: 'DONE',
		targetStatus: 'DIAGNOSED',
		...(input.auditLeadId ? { auditLeadId: input.auditLeadId } : {}),
		...(typeof input.seoScore === 'number' ? { seoScore: input.seoScore } : {}),
	};
	if (input.targetSiteId) patchImportedCrawlRecordByTargetId(input.targetSiteId, patch);
	if (input.url) patchImportedCrawlRecord(input.url, patch);
}

export function enqueueCrawlTransfers(
	items: CrawlTransferItem[],
	options?: { autoScan?: boolean },
): { ok: number; skipped: number } {
	if (typeof window === 'undefined') return { ok: 0, skipped: items.length };

	const seen = new Set<string>();
	const normalized: CrawlTransferItem[] = [];
	let skipped = 0;

	for (const item of items) {
		const url = validateCrawlTransferUrl(item.url);
		if (!url) {
			skipped += 1;
			continue;
		}
		const key = urlKey(url);
		if (seen.has(key)) {
			skipped += 1;
			continue;
		}
		seen.add(key);
		normalized.push({
			...item,
			url,
			siteName: item.siteName?.trim() || undefined,
		});
	}

	if (normalized.length === 0) return { ok: 0, skipped };

	const payload: CrawlTransferPayload = {
		queuedAt: new Date().toISOString(),
		items: normalized,
		autoScan: options?.autoScan ?? true,
	};

	try {
		window.localStorage.setItem(CRAWL_TRANSFER_QUEUE_KEY, JSON.stringify(payload));
	} catch {
		return { ok: 0, skipped: items.length };
	}

	return { ok: normalized.length, skipped };
}

export function peekCrawlTransferQueue(): CrawlTransferPayload | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(CRAWL_TRANSFER_QUEUE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CrawlTransferPayload;
		if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
		return {
			queuedAt: typeof parsed.queuedAt === 'string' ? parsed.queuedAt : new Date().toISOString(),
			items: parsed.items,
			autoScan: parsed.autoScan !== false,
		};
	} catch {
		return null;
	}
}

export function clearCrawlTransferQueue() {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.removeItem(CRAWL_TRANSFER_QUEUE_KEY);
	} catch {
		/* ignore */
	}
}

export function consumeCrawlTransferQueue(): CrawlTransferPayload | null {
	const payload = peekCrawlTransferQueue();
	if (payload) clearCrawlTransferQueue();
	return payload;
}
