import {
	lighthouseViewportOk,
	type LighthouseViewportAudit,
} from '@/lib/audit/viewport';

/**
 * PageSpeed Insights (Lighthouse) typed snapshot for audit UI.
 * Parsed from Google PSI v5 — used by Executive Summary cards + Tab 2 precision panel.
 */

export type PsiScoreTier = 'poor' | 'needs-improvement' | 'good';

export type PsiCategoryId = 'performance' | 'accessibility' | 'best-practices' | 'seo';

export interface PsiCategoryScore {
	id: PsiCategoryId;
	score: number | null;
	tier: PsiScoreTier;
}

export interface PsiCoreVital {
	id: 'lcp' | 'tbt' | 'cls' | 'inp' | 'fcp';
	/** Display value already unit-scaled (s for LCP/FCP, ms for TBT/INP, unitless for CLS). */
	value: number | null;
	displayValue: string | null;
	tier: PsiScoreTier;
	/** Good threshold used for UI (same units as `value`). */
	goodThreshold: number;
}

export interface PsiRenderBlockingResource {
	url: string;
	fileName: string;
	/** totalBytes / transfer size when available. */
	bytes: number | null;
	/** Bytes that could be saved (unused CSS/JS etc.). */
	wastedBytes: number | null;
	/** Wasted ms attributed by Lighthouse. */
	wastedMs: number | null;
}

/** Which Lighthouse image audits flagged this URL. */
export type PsiImageIssueReason =
	| 'compression'
	| 'modern-format'
	| 'responsive-size'
	| 'offscreen';

export interface PsiImageOpportunity {
	url: string;
	fileName: string;
	/** Display label: filename, alt text, or node snippet tag. */
	label: string;
	/** Current transfer / total size in bytes. */
	bytes: number | null;
	/** Max estimated savings across merged image audits (bytes). */
	wastedBytes: number | null;
	/** @deprecated Prefer wastedBytes — kept for older UI bindings. */
	webpSavingsBytes: number | null;
	/** Why this image was flagged (merged from 3+ audits). */
	reasons: PsiImageIssueReason[];
	/** Preformatted insight line for UI (KiB + reason). */
	insight: string;
}

export interface PsiCacheResource {
	url: string;
	fileName: string;
	/** Cache TTL in ms — 0 / null means None / no cache. */
	cacheLifetimeMs: number | null;
	totalBytes: number | null;
	wastedBytes: number | null;
	/** Human TTL label (`None`, `1h`, `1d`, …). */
	ttlLabel: string;
}

export interface PsiLcpElement {
	/** Short file / node label (e.g. logo-n.png). */
	label: string;
	selector: string | null;
	snippet: string | null;
	/** Raw nodeLabel from Lighthouse when present. */
	nodeLabel: string | null;
	/** True when LCP img has loading="lazy". */
	hasLazyLoading: boolean;
	/** True when fetchpriority="high" is missing on LCP media. */
	missingFetchPriority: boolean;
	/** Warning messages for the LCP card. */
	warnings: string[];
}

export interface PsiScriptExecution {
	url: string;
	fileName: string;
	/** Total CPU time (ms) from bootup-time. */
	totalMs: number | null;
	scriptingMs: number | null;
	parseCompileMs: number | null;
	/** Rough origin class for UI badges. */
	origin: 'first-party' | 'third-party' | 'unknown';
}

export interface PsiMainThreadTask {
	group: string;
	groupLabel: string;
	durationMs: number;
}

export interface PsiFontOpportunity {
	url: string;
	fileName: string;
	bytes: number | null;
	/** Rough CDN/subset savings estimate (bytes). */
	cdnSavingsBytes: number | null;
}

/** Parsed Lighthouse SEO `viewport` audit for mobile-readability cross-check. */
export interface PsiViewportAudit {
	score: number | null;
	scoreDisplayMode: string | null;
	/** True when LH reports viewport OK / N/A / informative. */
	ok: boolean | null;
}

export interface PageSpeedSnapshot {
	url: string;
	strategy: 'mobile' | 'desktop';
	fetchedAt: string;
	categories: PsiCategoryScore[];
	vitals: PsiCoreVital[];
	renderBlocking: PsiRenderBlockingResource[];
	images: PsiImageOpportunity[];
	fonts: PsiFontOpportunity[];
	/** uses-long-cache-ttl — short / missing browser cache. */
	cacheResources: PsiCacheResource[];
	/** Sum of wastedBytes from cache audit (bytes). */
	cacheTotalWastedBytes: number | null;
	/** largest-contentful-paint-element insight. */
	lcpElement: PsiLcpElement | null;
	/** bootup-time — high CPU scripts. */
	scriptExecution: PsiScriptExecution[];
	/** mainthread-work-breakdown top groups. */
	mainThreadWork: PsiMainThreadTask[];
	/** True when any category or vital is poor / needs-improvement. */
	hasWarnings: boolean;
	lighthouseVersion: string | null;
	/** Lighthouse `audits.viewport` — used to cross-validate mobile readability. */
	viewport: PsiViewportAudit | null;
}

export interface PageSpeedApiErrorBody {
	error: string;
	code?: string;
}

const CATEGORY_KEYS: { id: PsiCategoryId; lhKey: string }[] = [
	{ id: 'performance', lhKey: 'performance' },
	{ id: 'accessibility', lhKey: 'accessibility' },
	{ id: 'best-practices', lhKey: 'best-practices' },
	{ id: 'seo', lhKey: 'seo' },
];

export function scoreTier(score: number | null): PsiScoreTier {
	if (score == null || Number.isNaN(score)) return 'poor';
	if (score <= 49) return 'poor';
	if (score <= 89) return 'needs-improvement';
	return 'good';
}

/** LCP: good ≤ 2.5s, needs-improvement ≤ 4s. Value in seconds. */
export function lcpTier(seconds: number | null): PsiScoreTier {
	if (seconds == null || Number.isNaN(seconds)) return 'poor';
	if (seconds <= 2.5) return 'good';
	if (seconds <= 4) return 'needs-improvement';
	return 'poor';
}

/** TBT / INP proxy: good ≤ 200ms, needs-improvement ≤ 600ms. */
export function tbtTier(ms: number | null): PsiScoreTier {
	if (ms == null || Number.isNaN(ms)) return 'poor';
	if (ms <= 200) return 'good';
	if (ms <= 600) return 'needs-improvement';
	return 'poor';
}

/** CLS: good ≤ 0.1, needs-improvement ≤ 0.25. */
export function clsTier(value: number | null): PsiScoreTier {
	if (value == null || Number.isNaN(value)) return 'poor';
	if (value <= 0.1) return 'good';
	if (value <= 0.25) return 'needs-improvement';
	return 'poor';
}

/** True when a Lighthouse item field looks like real resource URL (not CSS/JS snippet). */
function isResourceUrl(raw: string): boolean {
	const s = raw.trim();
	if (!s || s.length > 2048) return false;
	// Inline style/script snippets often land in `source` — never treat as URL.
	if (/:root\s*\{|@media\b|@font-face\b|[{};]/.test(s) && !/^https?:\/\//i.test(s)) {
		return false;
	}
	if (/^(data|blob):/i.test(s)) return false;
	try {
		const u = new URL(s);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		// Relative path with a file-like segment (incl. images)
		return (
			/^\/[\w.-]/.test(s) ||
			/\.(css|js|mjs|cjs|jsx|ts|tsx|json|png|jpe?g|gif|webp|avif|svg|ico|woff2?)(\?|#|$)/i.test(s)
		);
	}
}

/** Extract URL from a Lighthouse opportunity / table item (url | src | source). */
function itemUrl(item: Record<string, unknown>): string {
	const candidates = [item.url, item.src, item.source];
	for (const c of candidates) {
		if (typeof c === 'string' && c.trim()) {
			const s = c.trim();
			if (isResourceUrl(s)) return s;
		}
	}
	const node = item.node;
	if (node && typeof node === 'object') {
		const snip = String((node as { snippet?: unknown }).snippet ?? '');
		const srcMatch = snip.match(/\b(?:src|href)=["']([^"']+)["']/i);
		if (srcMatch?.[1] && isResourceUrl(srcMatch[1])) return srcMatch[1].trim();
	}
	return '';
}

function itemNode(item: Record<string, unknown>): Record<string, unknown> | null {
	const node = item.node;
	if (node && typeof node === 'object') return node as Record<string, unknown>;
	return null;
}

function extractAltOrTag(item: Record<string, unknown>, fallbackFile: string): string {
	const node = itemNode(item);
	if (node) {
		const nodeLabel = String(node.nodeLabel ?? '').trim();
		const snippet = String(node.snippet ?? '').trim();
		const altMatch = snippet.match(/\balt=["']([^"']*)["']/i);
		if (altMatch && altMatch[1].trim()) return altMatch[1].trim();
		if (nodeLabel && !/^https?:/i.test(nodeLabel) && nodeLabel.length < 80) return nodeLabel;
		const tagMatch = snippet.match(/^<\s*([a-z0-9-]+)/i);
		if (tagMatch && fallbackFile) return `${fallbackFile} <${tagMatch[1].toLowerCase()}>`;
		if (tagMatch) return `<${tagMatch[1].toLowerCase()}>`;
	}
	return fallbackFile || '이미지';
}

/**
 * Sanitize Lighthouse resource URLs into a short display label.
 * Strips query strings / inline CSS so labels stay like `bootstrap.min.css`.
 */
export function getCleanFileName(url: string | null | undefined): string {
	if (!url) return 'Unknown Resource';
	const raw = url.trim();
	if (!raw) return 'Unknown Resource';

	if (/:root\s*\{|@media\b|@font-face\b/.test(raw) && !/^https?:\/\//i.test(raw)) {
		return 'Inline style';
	}

	try {
		const parsed = new URL(raw);
		if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
			return 'Inline resource';
		}
		let fileName = parsed.pathname.split('/').filter(Boolean).pop() || '';
		try {
			fileName = decodeURIComponent(fileName);
		} catch {
			/* keep raw segment */
		}
		// Drop accidental CSS/JS fragments stuck to the path segment
		if (!fileName || /[{};]|:root/i.test(fileName)) {
			return `${parsed.hostname}…`;
		}
		return fileName.length < 50 ? fileName : `${parsed.hostname}…`;
	} catch {
		const withoutQuery = raw.split('?')[0]?.split('#')[0] ?? raw;
		if (/[{};]|:root/i.test(withoutQuery)) return 'Inline style';
		const fileName = withoutQuery.split('/').filter(Boolean).pop() || raw;
		return fileName.length > 40 ? `${fileName.substring(0, 40)}…` : fileName;
	}
}

function asNumber(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
	return null;
}

function scoreFromCategory(cat: unknown): number | null {
	if (!cat || typeof cat !== 'object') return null;
	const score = asNumber((cat as { score?: unknown }).score);
	if (score == null) return null;
	return Math.round(score * 100);
}

type LhAudit = {
	score?: number | null;
	scoreDisplayMode?: string;
	numericValue?: number;
	displayValue?: string;
	details?: {
		items?: Array<Record<string, unknown>>;
		overallSavingsMs?: number;
		overallSavingsBytes?: number;
	};
};

function auditMap(raw: unknown): Record<string, LhAudit> {
	if (!raw || typeof raw !== 'object') return {};
	return raw as Record<string, LhAudit>;
}

/** Collect `details.items` from the first audit key that has rows (or merge all). */
function collectAuditItems(
	audits: Record<string, LhAudit>,
	keys: string[],
	mode: 'merge' | 'first-nonempty' = 'merge',
): Array<Record<string, unknown>> {
	if (mode === 'first-nonempty') {
		for (const key of keys) {
			const items = audits[key]?.details?.items;
			if (Array.isArray(items) && items.length > 0) return items;
		}
		return [];
	}
	const out: Array<Record<string, unknown>> = [];
	for (const key of keys) {
		const items = audits[key]?.details?.items;
		if (Array.isArray(items) && items.length) out.push(...items);
	}
	return out;
}

/** Parse "Est savings of 9,308 KiB" from Lighthouse displayValue when overallSavingsBytes is absent. */
function parseSavingsBytesFromDisplay(display: string | null | undefined): number | null {
	if (!display) return null;
	const kib = display.match(/([\d,]+(?:\.\d+)?)\s*KiB/i);
	if (kib?.[1]) return Math.round(Number(kib[1].replace(/,/g, '')) * 1024);
	const mib = display.match(/([\d,]+(?:\.\d+)?)\s*MiB/i);
	if (mib?.[1]) return Math.round(Number(mib[1].replace(/,/g, '')) * 1024 * 1024);
	return null;
}

/**
 * Map Lighthouse 12+ `image-delivery-insight` subItem reason strings → our reason tags.
 */
function reasonsFromImageDeliveryItem(item: Record<string, unknown>): PsiImageIssueReason[] {
	const reasons = new Set<PsiImageIssueReason>();
	const sub = item.subItems;
	const subItems =
		sub && typeof sub === 'object' && Array.isArray((sub as { items?: unknown }).items)
			? ((sub as { items: Array<Record<string, unknown>> }).items ?? [])
			: [];
	for (const s of subItems) {
		const reason = String(s.reason ?? '');
		if (/responsive|larger than it needs|displayed dimensions/i.test(reason)) {
			reasons.add('responsive-size');
		}
		if (/modern image format|webp|avif/i.test(reason)) {
			reasons.add('modern-format');
		}
		if (/compression/i.test(reason)) {
			reasons.add('compression');
		}
		if (/offscreen/i.test(reason)) {
			reasons.add('offscreen');
		}
	}
	if (!reasons.size) {
		// Consolidated insight without sub-reasons — treat as modern-format opportunity.
		reasons.add('modern-format');
		reasons.add('compression');
	}
	return Array.from(reasons);
}

/**
 * Merge render-blocking + unused CSS/JS opportunity items (dedupe by URL).
 * Lighthouse 12+ uses `render-blocking-insight` instead of `render-blocking-resources`.
 * Only real resource URLs are kept — never `source` snippets (`:root{…}` etc.).
 */
function pickRenderBlocking(audits: Record<string, LhAudit>): PsiRenderBlockingResource[] {
	const merged = [
		...collectAuditItems(audits, ['render-blocking-resources', 'render-blocking-insight']),
		...(audits['unused-css-rules']?.details?.items ?? []),
		...(audits['unused-javascript']?.details?.items ?? []),
	];
	const seen = new Set<string>();
	const out: PsiRenderBlockingResource[] = [];
	for (const item of merged) {
		const url = itemUrl(item) || String(item.url ?? '').trim();
		if (!url || !isResourceUrl(url) || seen.has(url)) continue;
		seen.add(url);
		const totalBytes =
			asNumber(item.totalBytes) ?? asNumber(item.transferSize);
		const wastedBytes = asNumber(item.wastedBytes);
		out.push({
			url,
			fileName: getCleanFileName(url),
			bytes: totalBytes,
			wastedBytes,
			wastedMs: asNumber(item.wastedMs),
		});
		if (out.length >= 20) break;
	}
	return out;
}

/**
 * Merge Lighthouse image opportunity audits (dedupe by URL).
 *
 * Legacy (pre-LH12): uses-optimized-images, uses-webp-images / modern-image-formats,
 * properly-size-images, offscreen-images.
 * Lighthouse 12+ / current PSI: single consolidated `image-delivery-insight`
 * (reasons live in item.subItems).
 *
 * Keeps items that have a URL and at least one of wastedBytes / totalBytes.
 */
function pickImages(audits: Record<string, LhAudit>): PsiImageOpportunity[] {
	type Src = {
		/** Fixed reason for legacy audits; null → derive from image-delivery-insight subItems. */
		reason: PsiImageIssueReason | null;
		items: Array<Record<string, unknown>>;
	};
	const sources: Src[] = [
		{ reason: 'compression', items: audits['uses-optimized-images']?.details?.items ?? [] },
		{ reason: 'modern-format', items: audits['uses-webp-images']?.details?.items ?? [] },
		{ reason: 'modern-format', items: audits['modern-image-formats']?.details?.items ?? [] },
		{ reason: 'responsive-size', items: audits['properly-size-images']?.details?.items ?? [] },
		{ reason: 'offscreen', items: audits['offscreen-images']?.details?.items ?? [] },
		{ reason: null, items: audits['image-delivery-insight']?.details?.items ?? [] },
	];

	const byUrl = new Map<
		string,
		{
			url: string;
			bytes: number | null;
			wastedBytes: number | null;
			reasons: Set<PsiImageIssueReason>;
			label: string;
			fileName: string;
		}
	>();

	for (const { reason, items } of sources) {
		for (const item of items) {
			if (!item || typeof item !== 'object') continue;
			const url = itemUrl(item);
			if (!url) continue;
			const bytes = asNumber(item.totalBytes) ?? asNumber(item.transferSize);
			const wasted = asNumber(item.wastedBytes);
			// Require measurable size signal (matches PSI opportunity rows).
			if (bytes == null && wasted == null) continue;

			const fileName = getCleanFileName(url);
			const label = extractAltOrTag(item, fileName);
			const addReasons =
				reason != null ? [reason] : reasonsFromImageDeliveryItem(item);

			const prev = byUrl.get(url);
			if (!prev) {
				byUrl.set(url, {
					url,
					bytes,
					wastedBytes: wasted,
					reasons: new Set(addReasons),
					label,
					fileName,
				});
			} else {
				for (const r of addReasons) prev.reasons.add(r);
				if (bytes != null && (prev.bytes == null || bytes > prev.bytes)) prev.bytes = bytes;
				if (wasted != null && (prev.wastedBytes == null || wasted > prev.wastedBytes)) {
					prev.wastedBytes = wasted;
				}
				if (label && label !== fileName) prev.label = label;
			}
		}
	}

	const out: PsiImageOpportunity[] = [];
	for (const row of byUrl.values()) {
		const reasons = Array.from(row.reasons);
		const insight = formatImageInsight({
			fileName: row.fileName,
			bytes: row.bytes,
			wastedBytes: row.wastedBytes,
			reasons,
		});
		out.push({
			url: row.url,
			fileName: row.fileName,
			label: row.label,
			bytes: row.bytes,
			wastedBytes: row.wastedBytes,
			webpSavingsBytes: row.wastedBytes,
			reasons,
			insight,
		});
		if (out.length >= 24) break;
	}

	// Largest savings first
	out.sort((a, b) => (b.wastedBytes ?? 0) - (a.wastedBytes ?? 0));
	return out;
}

const REASON_LABEL_KO: Record<PsiImageIssueReason, string> = {
	compression: '압축 미흡',
	'modern-format': '차세대 형식 미적용',
	'responsive-size': '반응형 크기 초과',
	offscreen: '오프스크린 지연 로드 가능',
};

/** `img-main.png (1,158.9 KiB → 1,104.1 KiB 절감 가능, 반응형 크기 초과)` */
export function formatImageInsight(opts: {
	fileName: string;
	bytes: number | null;
	wastedBytes: number | null;
	reasons: PsiImageIssueReason[];
}): string {
	const name = opts.fileName || '이미지';
	const sizePart =
		opts.bytes != null
			? opts.wastedBytes != null && opts.wastedBytes > 0
				? `${formatKiB(opts.bytes)} → ${formatKiB(opts.wastedBytes)} 절감 가능`
				: formatKiB(opts.bytes)
			: opts.wastedBytes != null
				? `${formatKiB(opts.wastedBytes)} 절감 가능`
				: null;
	const reasonPart = opts.reasons.map((r) => REASON_LABEL_KO[r]).join(' · ');
	const detail = [sizePart, reasonPart].filter(Boolean).join(', ');
	return detail ? `${name} (${detail})` : name;
}

/** Bytes → `1,158.9 KiB` (PSI-style binary kibibytes). */
export function formatKiB(bytes: number | null | undefined): string {
	if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
	const kib = bytes / 1024;
	return `${kib.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 0 })} KiB`;
}

function formatCacheTtl(ms: number | null): string {
	if (ms == null || !Number.isFinite(ms) || ms <= 0) return 'None';
	const sec = ms / 1000;
	if (sec < 60) return `${Math.round(sec)}s`;
	const min = sec / 60;
	if (min < 60) return `${Math.round(min)}m`;
	const hr = min / 60;
	if (hr < 48) return `${Math.round(hr)}h`;
	const day = hr / 24;
	if (day < 60) return `${Math.round(day)}d`;
	return `${Math.round(day / 30)}mo`;
}

/**
 * Browser caching / TTL — prefer legacy `uses-long-cache-ttl`, fall back to
 * Lighthouse 12+ `cache-insight` (same item shape: url, cacheLifetimeMs, totalBytes, wastedBytes).
 */
function pickCacheResources(audits: Record<string, LhAudit>): {
	items: PsiCacheResource[];
	totalWastedBytes: number | null;
} {
	const legacy = audits['uses-long-cache-ttl'];
	const insight = audits['cache-insight'];
	const primary =
		(legacy?.details?.items?.length ? legacy : null) ??
		(insight?.details?.items?.length ? insight : null) ??
		legacy ??
		insight;

	const rawItems = collectAuditItems(audits, ['uses-long-cache-ttl', 'cache-insight'], 'first-nonempty');
	const overall =
		asNumber(primary?.details?.overallSavingsBytes) ??
		asNumber(legacy?.details?.overallSavingsBytes) ??
		asNumber(insight?.details?.overallSavingsBytes) ??
		parseSavingsBytesFromDisplay(primary?.displayValue) ??
		parseSavingsBytesFromDisplay(insight?.displayValue) ??
		rawItems.reduce((sum, it) => sum + (asNumber(it.wastedBytes) ?? 0), 0);

	const out: PsiCacheResource[] = [];
	const seen = new Set<string>();
	for (const item of rawItems) {
		if (!item || typeof item !== 'object') continue;
		const url = itemUrl(item);
		if (!url || seen.has(url)) continue;
		const totalBytes = asNumber(item.totalBytes) ?? asNumber(item.transferSize);
		const wastedBytes = asNumber(item.wastedBytes);
		if (totalBytes == null && wastedBytes == null) continue;
		seen.add(url);
		const cacheLifetimeMs = asNumber(item.cacheLifetimeMs);
		out.push({
			url,
			fileName: getCleanFileName(url),
			cacheLifetimeMs,
			totalBytes,
			wastedBytes,
			ttlLabel: formatCacheTtl(cacheLifetimeMs),
		});
		if (out.length >= 24) break;
	}

	// Shortest TTL / largest waste first
	out.sort((a, b) => {
		const ttlA = a.cacheLifetimeMs ?? 0;
		const ttlB = b.cacheLifetimeMs ?? 0;
		if (ttlA !== ttlB) return ttlA - ttlB;
		return (b.wastedBytes ?? 0) - (a.wastedBytes ?? 0);
	});

	return {
		items: out,
		totalWastedBytes: overall > 0 ? overall : out.length ? overall : null,
	};
}

/** Walk Lighthouse list/table nesting to find the LCP node item. */
function findLcpNodeItem(items: Array<Record<string, unknown>> | undefined): Record<string, unknown> | null {
	if (!items?.length) return null;
	for (const item of items) {
		if (item.node && typeof item.node === 'object') return item;
		// Nested table inside list (LH 10+)
		if (item.type === 'table' && Array.isArray(item.items)) {
			const nested = findLcpNodeItem(item.items as Array<Record<string, unknown>>);
			if (nested) return nested;
		}
		if (Array.isArray(item.items)) {
			const nested = findLcpNodeItem(item.items as Array<Record<string, unknown>>);
			if (nested) return nested;
		}
	}
	// Fallback: first item even without node
	return items[0] ?? null;
}

function pickLcpElement(audits: Record<string, LhAudit>): PsiLcpElement | null {
	const items = audits['largest-contentful-paint-element']?.details?.items;
	const row = findLcpNodeItem(items as Array<Record<string, unknown>> | undefined);
	if (!row) return null;

	const node = itemNode(row);
	const snippet = node ? String(node.snippet ?? '').trim() || null : null;
	const selector = node ? String(node.selector ?? '').trim() || null : null;
	const nodeLabel = node ? String(node.nodeLabel ?? '').trim() || null : null;

	let label = nodeLabel || '';
	if (snippet) {
		const srcMatch = snippet.match(/\b(?:src|srcset)=["']([^"'\s,]+)/i);
		if (srcMatch?.[1]) label = getCleanFileName(srcMatch[1]);
	}
	if (!label) {
		const url = itemUrl(row);
		label = url ? getCleanFileName(url) : selector || 'LCP element';
	}

	const isImgOrMedia =
		/<\s*(img|image|video|picture|source)\b/i.test(snippet || '') ||
		/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(label);

	const hasLazyLoading =
		/\bloading\s*=\s*["']lazy["']/i.test(snippet || '') ||
		/\bloading\s*=\s*lazy\b/i.test(snippet || '');

	const hasFetchPriorityHigh = /\bfetchpriority\s*=\s*["']high["']/i.test(snippet || '');
	const missingFetchPriority = isImgOrMedia && !hasFetchPriorityHigh;

	const warnings: string[] = [];
	if (hasLazyLoading) {
		warnings.push(
			`LCP 요소 \`${label}\`에 loading="lazy"가 적용되어 최대 콘텐츠 렌더링이 지연됩니다.`,
		);
	}
	if (missingFetchPriority) {
		warnings.push(
			`LCP 이미지 \`${label}\`에 fetchpriority="high"가 없습니다. 우선 로드를 지정하세요.`,
		);
	}
	if (!warnings.length && snippet) {
		warnings.push(`LCP 요소: ${label}${selector ? ` (${selector})` : ''}`);
	}

	return {
		label,
		selector,
		snippet,
		nodeLabel,
		hasLazyLoading,
		missingFetchPriority,
		warnings,
	};
}

function classifyScriptOrigin(url: string, pageHost: string | null): PsiScriptExecution['origin'] {
	if (!url || url.startsWith('Unattributable') || url === 'Other') return 'unknown';
	try {
		const host = new URL(url).hostname.toLowerCase();
		if (pageHost && (host === pageHost || host.endsWith(`.${pageHost}`))) return 'first-party';
		if (
			/youtube|ytimg|googlevideo|jsdelivr|cloudflare|googleapis|gstatic|google\.com|facebook|doubleclick|googletagmanager|hotjar|cdn\.|unpkg|fontawesome/i.test(
				host,
			)
		) {
			return 'third-party';
		}
		if (pageHost) return 'third-party';
		return 'unknown';
	} catch {
		return 'unknown';
	}
}

function pickScriptExecution(
	audits: Record<string, LhAudit>,
	pageUrl: string,
): PsiScriptExecution[] {
	const items = audits['bootup-time']?.details?.items ?? [];
	let pageHost: string | null = null;
	try {
		pageHost = new URL(pageUrl).hostname.toLowerCase();
	} catch {
		pageHost = null;
	}

	const out: PsiScriptExecution[] = [];
	const seen = new Set<string>();
	for (const item of items) {
		const url = String(item.url ?? '').trim();
		if (!url || seen.has(url)) continue;
		// Skip tiny noise (< 30ms total)
		const totalMs = asNumber(item.total) ?? asNumber(item.scripting);
		if (totalMs != null && totalMs < 30) continue;
		seen.add(url);
		out.push({
			url,
			fileName: isResourceUrl(url) ? getCleanFileName(url) : url.slice(0, 48),
			totalMs,
			scriptingMs: asNumber(item.scripting),
			parseCompileMs: asNumber(item.scriptParseCompile),
			origin: classifyScriptOrigin(url, pageHost),
		});
		if (out.length >= 16) break;
	}
	out.sort((a, b) => (b.totalMs ?? 0) - (a.totalMs ?? 0));
	return out;
}

function pickMainThreadWork(audits: Record<string, LhAudit>): PsiMainThreadTask[] {
	const items = audits['mainthread-work-breakdown']?.details?.items ?? [];
	const out: PsiMainThreadTask[] = [];
	for (const item of items) {
		const durationMs = asNumber(item.duration) ?? 0;
		if (durationMs < 20) continue;
		out.push({
			group: String(item.group ?? 'other'),
			groupLabel: String(item.groupLabel ?? item.group ?? 'Other'),
			durationMs: Math.round(durationMs),
		});
		if (out.length >= 10) break;
	}
	out.sort((a, b) => b.durationMs - a.durationMs);
	return out;
}

function pickFonts(audits: Record<string, LhAudit>): PsiFontOpportunity[] {
	const fontDisplay = collectAuditItems(audits, ['font-display', 'font-display-insight']);
	const unused = audits['unused-css-rules']?.details?.items ?? [];
	const network =
		(audits['network-requests']?.details?.items as Array<Record<string, unknown>> | undefined) ?? [];

	const fromNetwork = network.filter((item) => {
		const url = String(item.url ?? '');
		const mime = String(item.mimeType ?? item.resourceType ?? '').toLowerCase();
		return (
			/\.(woff2?|ttf|otf)(\?|$)/i.test(url) ||
			mime.includes('font') ||
			String(item.resourceType ?? '').toLowerCase() === 'font'
		);
	});

	const candidates = [
		...fontDisplay.map((item) => ({
			url: String(item.url ?? ''),
			bytes: asNumber(item.wastedBytes) ?? asNumber(item.totalBytes),
		})),
		...fromNetwork.map((item) => ({
			url: String(item.url ?? ''),
			bytes: asNumber(item.transferSize) ?? asNumber(item.resourceSize),
		})),
		...unused
			.filter((item) => /\.(woff2?|ttf|otf)/i.test(String(item.url ?? '')))
			.map((item) => ({
				url: String(item.url ?? ''),
				bytes: asNumber(item.wastedBytes) ?? asNumber(item.totalBytes),
			})),
	];

	const seen = new Set<string>();
	const out: PsiFontOpportunity[] = [];
	for (const c of candidates) {
		if (!c.url || !isResourceUrl(c.url) || seen.has(c.url)) continue;
		seen.add(c.url);
		const bytes = c.bytes;
		out.push({
			url: c.url,
			fileName: getCleanFileName(c.url),
			bytes,
			cdnSavingsBytes: bytes != null ? Math.round(bytes * 0.55) : null,
		});
		if (out.length >= 8) break;
	}
	return out;
}

/**
 * Normalize a raw PSI v5 JSON payload into the UI snapshot.
 * Accepts either the full API envelope or a lighthouseResult object.
 */
export function parsePageSpeedPayload(
	payload: unknown,
	opts: { url: string; strategy: 'mobile' | 'desktop' },
): PageSpeedSnapshot {
	const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
	const lh =
		(root.lighthouseResult as Record<string, unknown> | undefined) ??
		(root.lighthouseResult === undefined && root.categories ? root : undefined) ??
		{};

	const categoriesRaw = (lh.categories as Record<string, unknown> | undefined) ?? {};
	const audits = auditMap(lh.audits);

	const categories: PsiCategoryScore[] = CATEGORY_KEYS.map(({ id, lhKey }) => {
		const score = scoreFromCategory(categoriesRaw[lhKey]);
		return { id, score, tier: scoreTier(score) };
	});

	const lcpMs = asNumber(audits['largest-contentful-paint']?.numericValue);
	const lcpSec = lcpMs != null ? lcpMs / 1000 : null;
	const fcpMs = asNumber(audits['first-contentful-paint']?.numericValue);
	const fcpSec = fcpMs != null ? fcpMs / 1000 : null;
	const tbtMs = asNumber(audits['total-blocking-time']?.numericValue);
	const inpMs =
		asNumber(audits['interaction-to-next-paint']?.numericValue) ??
		asNumber(audits['experimental-interaction-to-next-paint']?.numericValue);
	const clsVal = asNumber(audits['cumulative-layout-shift']?.numericValue);

	const blockingMs = inpMs ?? tbtMs;

	const vitals: PsiCoreVital[] = [
		{
			id: 'lcp',
			value: lcpSec != null ? Math.round(lcpSec * 100) / 100 : null,
			displayValue:
				audits['largest-contentful-paint']?.displayValue ||
				(lcpSec != null ? `${lcpSec.toFixed(1)}\u00a0s` : 'N/A'),
			tier: lcpTier(lcpSec),
			goodThreshold: 2.5,
		},
		{
			id: 'fcp',
			value: fcpSec != null ? Math.round(fcpSec * 100) / 100 : null,
			displayValue:
				audits['first-contentful-paint']?.displayValue ||
				(fcpSec != null ? `${fcpSec.toFixed(1)}\u00a0s` : 'N/A'),
			tier: lcpTier(fcpSec),
			goodThreshold: 1.8,
		},
		{
			id: 'tbt',
			value: blockingMs != null ? Math.round(blockingMs) : null,
			displayValue:
				(inpMs != null
					? audits['interaction-to-next-paint']?.displayValue ||
						audits['experimental-interaction-to-next-paint']?.displayValue
					: audits['total-blocking-time']?.displayValue) ||
				(blockingMs != null ? `${Math.round(blockingMs)}\u00a0ms` : 'N/A'),
			tier: tbtTier(blockingMs),
			goodThreshold: 200,
		},
		{
			id: 'cls',
			value: clsVal != null ? Math.round(clsVal * 1000) / 1000 : null,
			displayValue:
				audits['cumulative-layout-shift']?.displayValue ||
				(clsVal != null ? String(Math.round(clsVal * 1000) / 1000) : 'N/A'),
			tier: clsTier(clsVal),
			goodThreshold: 0.1,
		},
	];

	const renderBlocking = pickRenderBlocking(audits);
	const images = pickImages(audits);
	const fonts = pickFonts(audits);
	const cache = pickCacheResources(audits);
	const lcpElement = pickLcpElement(audits);
	const scriptExecution = pickScriptExecution(audits, opts.url);
	const mainThreadWork = pickMainThreadWork(audits);

	const viewportRaw = audits['viewport'] as LighthouseViewportAudit | undefined;
	const viewport: PsiViewportAudit | null = viewportRaw
		? {
				score: typeof viewportRaw.score === 'number' ? viewportRaw.score : null,
				scoreDisplayMode:
					typeof viewportRaw.scoreDisplayMode === 'string'
						? viewportRaw.scoreDisplayMode
						: null,
				ok: lighthouseViewportOk(viewportRaw),
			}
		: null;

	const hasWarnings =
		categories.some((c) => c.tier !== 'good') ||
		vitals.some((v) => v.tier !== 'good') ||
		renderBlocking.length > 0 ||
		images.length > 0 ||
		cache.items.length > 0 ||
		(lcpElement?.warnings.length ?? 0) > 0 ||
		scriptExecution.length > 0 ||
		fonts.some((f) => (f.bytes ?? 0) > 80_000);

	return {
		url: opts.url,
		strategy: opts.strategy,
		fetchedAt: new Date().toISOString(),
		categories,
		vitals,
		renderBlocking,
		images,
		fonts,
		cacheResources: cache.items,
		cacheTotalWastedBytes: cache.totalWastedBytes,
		lcpElement,
		scriptExecution,
		mainThreadWork,
		hasWarnings,
		lighthouseVersion: typeof lh.lighthouseVersion === 'string' ? lh.lighthouseVersion : null,
		viewport,
	};
}

/** Bytes → human label (`12.3 KB`, `1.2 MB`). Zero → `0 KB`. */
export function formatBytes(bytes: number | null | undefined): string {
	if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
	if (bytes === 0) return '0 KB';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB'] as const;
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
	const value = bytes / Math.pow(k, i);
	return `${parseFloat(value.toFixed(1))} ${sizes[i]}`;
}

export function formatMs(ms: number | null | undefined): string {
	if (ms == null || !Number.isFinite(ms)) return '—';
	if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
	return `${Math.round(ms)} ms`;
}
