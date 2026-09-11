/**
 * Universal Canonical URL diagnostic engine.
 *
 * Works identically across 그누보드 / 워드프레스 / 쇼피파이 / 웹플로우 / 커스텀 사이트—
 * the CMS never matters because everything is derived from the resolved
 * `URL` object (protocol / hostname / pathname / searchParams), never from
 * platform-specific markup.
 *
 * `diagnoseCanonicalUrl()` is the strict, code-based engine (6-stage ruleset
 * below). `evaluateCanonicalAccuracy()` / `canonicalMatches()` are thin
 * backward-compatible wrappers kept for existing call sites
 * (`lib/site-auditor.ts`, `lib/audit/parser.ts`) — they delegate to the same
 * engine so the false-positive regression is fixed everywhere at once.
 *
 * Strict rule stages:
 *   1. Existence & multiplicity      → MISSING_CANONICAL / DUPLICATE_CANONICAL
 *   2. Absolute URL well-formedness  → INVALID_ABSOLUTE_URL / MALFORMED_URL
 *   3. CMS-agnostic normalization    → index files, trailing slash, tracking params
 *   4. Subpage-to-root trap (★)      → SUBPAGE_POINTS_TO_ROOT
 *   5. Self-reference / domain check → CROSS_DOMAIN_CANONICAL / CANONICAL_PATH_MISMATCH / PROTOCOL_MISMATCH
 *   6. OG / JSON-LD cross-check      → OG_URL_MISMATCH / SCHEMA_URL_MISMATCH
 */

/** Click-tracking / campaign params — never part of a page's true identity. */
const TRACKING_QUERY_PATTERNS: RegExp[] = [
	/^utm_/i,
	/^fbclid$/i,
	/^gclid$/i,
	/^_ga$/i,
	/^ref$/i,
	/^_redue_nocache$/i,
	/^_nocache$/i,
];

/**
 * CMS identity params are intentionally NOT in the tracking list above, so
 * they always survive normalization and correctly cause a mismatch when the
 * value differs (e.g. two different 그누보드 게시글, 워드프레스 포스트, 쇼피파이 옵션):
 *   그누보드: bo_table, wr_id · 워드프레스: p, page_id · 쇼피파이: variant
 */
function isTrackingQueryKey(key: string): boolean {
	return TRACKING_QUERY_PATTERNS.some((pattern) => pattern.test(key));
}

function stripIgnoredCanonicalParams(url: URL): void {
	for (const key of [...url.searchParams.keys()]) {
		if (isTrackingQueryKey(key)) url.searchParams.delete(key);
	}
}

/** Directory-index filenames that are equivalent to their parent directory. */
const INDEX_FILE_PATTERN = /\/index\.(php|html?|asp|aspx)$/i;

/** Pull a bare http(s) URL out of markdown / HTML / noise wrappers. */
export function extractPureUrl(raw: string): string {
	let extracted = raw.trim();
	if (!extracted) return '';

	// Markdown link: [label](https://…)
	const md = extracted.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/i);
	if (md?.[1]) {
		extracted = md[1];
	}

	// HTML attribute: href="…" / content="…"
	const hrefAttr = extracted.match(
		/\b(?:href|content)=["'](https?:\/\/[^"']+)["']/i,
	);
	if (hrefAttr?.[1]) {
		extracted = hrefAttr[1];
	}

	// Angle-bracket URL: <https://…>
	const angled = extracted.match(/<(https?:\/\/[^>\s]+)>/i);
	if (angled?.[1]) {
		extracted = angled[1];
	}

	// Residual markup — take the first bare absolute URL
	if (/[[\]<>]/.test(extracted)) {
		const bare = extracted.match(/https?:\/\/[^\s"'<>\]]+/i);
		if (bare?.[0]) extracted = bare[0];
	}

	return extracted.trim();
}

/**
 * Canonical comparison sanitizer: drop cache-bust / tracking params, collapse
 * a trailing directory-index filename, force https, and unify a trailing
 * slash. Kept for display / backward compatibility with existing evidence
 * strings — always resolves the protocol to https so legacy PASS/FAIL
 * comparisons that predate the strict `PROTOCOL_MISMATCH` warning are
 * unaffected.
 */
export function normalizeCanonicalCompareUrl(
	url: string,
	targetUrl?: string,
): string {
	const extracted = extractPureUrl(url);
	if (!extracted) return '';

	try {
		const parsed = new URL(extracted, targetUrl || undefined);
		if (parsed.protocol === 'http:') parsed.protocol = 'https:';
		parsed.hash = '';
		stripIgnoredCanonicalParams(parsed);

		let cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
		cleanPath = cleanPath.replace(/\/index\.php$/i, '') || '/';
		if (!cleanPath.endsWith('/')) cleanPath += '/';
		parsed.pathname = cleanPath;

		const query = parsed.searchParams.toString();
		return `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ''}`;
	} catch {
		return extracted.replace(/^http:\/\//i, 'https://').replace(/\/+$/, '');
	}
}

// ---------------------------------------------------------------------------
// Strict diagnostic engine
// ---------------------------------------------------------------------------

export type CanonicalDiagnosticStatus = 'PASS' | 'WARN' | 'FAIL';

export type CanonicalDiagnosticCode =
	| 'MISSING_CANONICAL'
	| 'DUPLICATE_CANONICAL'
	| 'INVALID_ABSOLUTE_URL'
	| 'MALFORMED_URL'
	| 'SUBPAGE_POINTS_TO_ROOT'
	| 'CROSS_DOMAIN_CANONICAL'
	| 'CANONICAL_PATH_MISMATCH'
	| 'PROTOCOL_MISMATCH'
	| 'OG_URL_MISMATCH'
	| 'SCHEMA_URL_MISMATCH'
	| 'CANONICAL_OK';

export interface CanonicalDiagnosticDetails {
	requestUrl: string;
	canonicalUrl: string;
	cleanReqPath: string;
	cleanCanPath: string;
}

export interface CanonicalDiagnosticResult {
	status: CanonicalDiagnosticStatus;
	/** 0-100. FAIL is always 0. */
	score: number;
	code: CanonicalDiagnosticCode;
	message: string;
	details: CanonicalDiagnosticDetails;
}

export interface CanonicalDiagnosticInput {
	/** The URL that was actually requested/crawled (absolute). */
	requestUrl: string;
	/** Every `<link rel="canonical">` href found in this document's `<head>` (raw, unresolved is fine). */
	canonicalHrefs: string[];
	/** `<meta property="og:url">` content, if present. */
	ogUrl?: string | null;
	/** `url` values collected from JSON-LD nodes (WebPage / Article / Product / …). */
	schemaUrls?: readonly string[] | null;
}

type NormalizedUrlParts = {
	protocol: string;
	/** `www.` stripped, lowercased. */
	hostname: string;
	/** Directory-index stripped, trailing slash unified (root stays `/`). */
	path: string;
	/** Tracking params stripped, remaining params sorted for stable comparison. */
	query: string;
};

function normalizePathForCompare(pathname: string): string {
	let path = pathname || '/';
	path = path.replace(INDEX_FILE_PATTERN, '');
	if (path === '') path = '/';
	if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
	return path || '/';
}

function normalizeQueryForCompare(url: URL): string {
	const kept: Array<[string, string]> = [];
	for (const [key, value] of url.searchParams.entries()) {
		if (isTrackingQueryKey(key)) continue;
		kept.push([key, value]);
	}
	kept.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
	return kept.map(([key, value]) => `${key}=${value}`).join('&');
}

function normalizeUrlParts(url: URL): NormalizedUrlParts {
	return {
		protocol: url.protocol.replace(/:$/, '').toLowerCase(),
		hostname: url.hostname.replace(/^www\./i, '').toLowerCase(),
		path: normalizePathForCompare(url.pathname),
		query: normalizeQueryForCompare(url),
	};
}

/** Display string for `details.cleanReqPath` / `cleanCanPath` — path + query. */
function displayPath(parts: NormalizedUrlParts): string {
	return parts.query ? `${parts.path}?${parts.query}` : parts.path;
}

type AbsoluteUrlResolution =
	| { ok: true; url: URL }
	| { ok: false; code: 'INVALID_ABSOLUTE_URL' | 'MALFORMED_URL' };

/** Stage 2 — the href must be a well-formed, protocol-qualified absolute URL. */
function resolveAbsoluteUrl(raw: string): AbsoluteUrlResolution {
	const trimmed = extractPureUrl(raw) || raw.trim();
	if (!trimmed) return { ok: false, code: 'INVALID_ABSOLUTE_URL' };

	// Obviously relative paths (`/sub`, `../page`, `page.html`) never qualify.
	if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
		return { ok: false, code: 'INVALID_ABSOLUTE_URL' };
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return { ok: false, code: 'INVALID_ABSOLUTE_URL' };
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return { ok: false, code: 'MALFORMED_URL' };
	}
	return { ok: true, url: parsed };
}

const CODE_SCORE: Record<CanonicalDiagnosticCode, number> = {
	MISSING_CANONICAL: 0,
	DUPLICATE_CANONICAL: 0,
	INVALID_ABSOLUTE_URL: 0,
	MALFORMED_URL: 0,
	SUBPAGE_POINTS_TO_ROOT: 0,
	CROSS_DOMAIN_CANONICAL: 50,
	CANONICAL_PATH_MISMATCH: 0,
	PROTOCOL_MISMATCH: 80,
	OG_URL_MISMATCH: 85,
	SCHEMA_URL_MISMATCH: 85,
	CANONICAL_OK: 100,
};

const CODE_STATUS: Record<CanonicalDiagnosticCode, CanonicalDiagnosticStatus> = {
	MISSING_CANONICAL: 'FAIL',
	DUPLICATE_CANONICAL: 'FAIL',
	INVALID_ABSOLUTE_URL: 'FAIL',
	MALFORMED_URL: 'FAIL',
	SUBPAGE_POINTS_TO_ROOT: 'FAIL',
	CROSS_DOMAIN_CANONICAL: 'WARN',
	CANONICAL_PATH_MISMATCH: 'FAIL',
	PROTOCOL_MISMATCH: 'WARN',
	OG_URL_MISMATCH: 'WARN',
	SCHEMA_URL_MISMATCH: 'WARN',
	CANONICAL_OK: 'PASS',
};

function result(
	code: CanonicalDiagnosticCode,
	message: string,
	details: CanonicalDiagnosticDetails,
): CanonicalDiagnosticResult {
	return { status: CODE_STATUS[code], score: CODE_SCORE[code], code, message, details };
}

function emptyDetails(requestUrl: string, canonicalUrl = ''): CanonicalDiagnosticDetails {
	return { requestUrl, canonicalUrl, cleanReqPath: '', cleanCanPath: '' };
}

/**
 * Universal, CMS-agnostic canonical URL diagnostic.
 * Runs all 6 rule stages in order and returns as soon as a stage produces a
 * finding. If every stage passes cleanly, returns `CANONICAL_OK` (PASS).
 */
export function diagnoseCanonicalUrl(input: CanonicalDiagnosticInput): CanonicalDiagnosticResult {
	const requestUrl = (input.requestUrl || '').trim();
	const rawHrefs = (input.canonicalHrefs || []).map((h) => (h || '').trim()).filter(Boolean);

	// --- Stage 1: existence & multiplicity -----------------------------------
	if (rawHrefs.length === 0) {
		return result(
			'MISSING_CANONICAL',
			'<link rel="canonical"> 태그가 없습니다. 검색엔진이 중복/유사 페이지를 임의로 선택해 색인할 위험이 있습니다.',
			emptyDetails(requestUrl),
		);
	}
	if (rawHrefs.length > 1) {
		return result(
			'DUPLICATE_CANONICAL',
			`<link rel="canonical"> 태그가 ${rawHrefs.length}개 중복 선언되어 있습니다. 검색엔진이 어느 것을 신뢰할지 알 수 없어 canonical 신호 자체가 무효화됩니다.`,
			emptyDetails(requestUrl, rawHrefs.join(', ')),
		);
	}
	const canonicalHref = rawHrefs[0];

	// --- Stage 2: absolute URL well-formedness --------------------------------
	const canResolved = resolveAbsoluteUrl(canonicalHref);
	if (!canResolved.ok) {
		const message =
			canResolved.code === 'INVALID_ABSOLUTE_URL'
				? `canonical href="${canonicalHref}"가 비어있거나 상대 경로입니다. rel=canonical의 href는 항상 절대 URL(https://…)이어야 합니다.`
				: `canonical href="${canonicalHref}"가 http(s) 프로토콜이 아닙니다.`;
		return result(canResolved.code, message, emptyDetails(requestUrl, canonicalHref));
	}
	const canonicalUrl = canResolved.url;

	// Defensive: the request URL itself should already be absolute, but guard
	// against malformed input from upstream crawlers.
	const reqResolved = resolveAbsoluteUrl(requestUrl);
	if (!reqResolved.ok) {
		return result(
			'MALFORMED_URL',
			`요청 URL "${requestUrl}"이 올바른 절대 URL이 아니어서 canonical을 비교할 수 없습니다.`,
			emptyDetails(requestUrl, canonicalUrl.toString()),
		);
	}
	const requestParsed = reqResolved.url;

	// --- Stage 3: CMS-agnostic normalization ----------------------------------
	const reqParts = normalizeUrlParts(requestParsed);
	const canParts = normalizeUrlParts(canonicalUrl);
	const details: CanonicalDiagnosticDetails = {
		requestUrl,
		canonicalUrl: canonicalUrl.toString(),
		cleanReqPath: displayPath(reqParts),
		cleanCanPath: displayPath(canParts),
	};

	// --- Stage 4: subpage-to-root trap (★ most critical) ----------------------
	const requestIsRoot = reqParts.path === '/' && !reqParts.query;
	const canonicalIsRoot = canParts.path === '/' && !canParts.query;
	if (!requestIsRoot && canonicalIsRoot) {
		return result(
			'SUBPAGE_POINTS_TO_ROOT',
			`서브페이지(${details.cleanReqPath})의 canonical이 사이트 루트("/")를 가리킵니다. 이 페이지는 검색 결과에서 색인되지 않고 홈페이지로 병합될 위험이 있습니다.`,
			details,
		);
	}

	// --- Stage 5: self-reference / domain consistency ---------------------------
	if (reqParts.hostname !== canParts.hostname) {
		return result(
			'CROSS_DOMAIN_CANONICAL',
			`canonical이 요청 도메인(${reqParts.hostname})이 아닌 다른 도메인(${canParts.hostname})을 가리킵니다. 의도된 콘텐츠 신디케이션이 아니라면 확인이 필요합니다.`,
			details,
		);
	}
	if (reqParts.path !== canParts.path || reqParts.query !== canParts.query) {
		return result(
			'CANONICAL_PATH_MISMATCH',
			`canonical이 요청한 페이지(${details.cleanReqPath})가 아닌 다른 페이지(${details.cleanCanPath})를 가리킵니다.`,
			details,
		);
	}
	if (reqParts.protocol !== canParts.protocol) {
		return result(
			'PROTOCOL_MISMATCH',
			`canonical의 프로토콜(${canParts.protocol})이 요청 프로토콜(${reqParts.protocol})과 다릅니다. 동일 페이지이지만 http/https 통일이 필요합니다.`,
			details,
		);
	}

	// --- Stage 6: OpenGraph / JSON-LD cross-check -------------------------------
	const ogUrl = (input.ogUrl || '').trim();
	if (ogUrl) {
		const ogResolved = resolveAbsoluteUrl(ogUrl);
		if (ogResolved.ok) {
			const ogParts = normalizeUrlParts(ogResolved.url);
			if (ogParts.path !== canParts.path) {
				return result(
					'OG_URL_MISMATCH',
					`og:url("${ogParts.path}")이 canonical("${details.cleanCanPath}")과 다른 경로를 가리킵니다. 소셜 공유 미리보기와 검색 색인 대상이 어긋날 수 있습니다.`,
					details,
				);
			}
		}
	}

	const schemaUrls = (input.schemaUrls || []).map((u) => (u || '').trim()).filter(Boolean);
	for (const schemaUrl of schemaUrls) {
		const schemaResolved = resolveAbsoluteUrl(schemaUrl);
		if (!schemaResolved.ok) continue;
		const schemaParts = normalizeUrlParts(schemaResolved.url);
		if (schemaParts.path !== canParts.path) {
			return result(
				'SCHEMA_URL_MISMATCH',
				`JSON-LD 스키마의 url("${schemaParts.path}")이 canonical("${details.cleanCanPath}")과 다른 경로를 가리킵니다. AI/구조화 데이터 검증기에서 엔티티 불일치로 감지될 수 있습니다.`,
				details,
			);
		}
	}

	return result(
		'CANONICAL_OK',
		`canonical이 요청 페이지(${details.cleanReqPath})를 정확히 자체 참조합니다.`,
		details,
	);
}

// ---------------------------------------------------------------------------
// Backward-compatible wrappers (existing call sites: lib/site-auditor.ts,
// lib/audit/parser.ts, scripts/test-canonical-url.ts).
// ---------------------------------------------------------------------------

export type CanonicalAccuracyResult =
	| { status: 'PASS'; canonical: string }
	| { status: 'FAIL'; reason: string }
	| { status: 'FAIL'; extracted: string; expected: string };

/**
 * Evaluate whether an extracted canonical href matches the target page URL.
 * `canonicalHref` may be raw href text (possibly markdown/HTML-wrapped).
 *
 * Delegates to `diagnoseCanonicalUrl()` — WARN-level findings that have no
 * bearing on this 2-value (PASS/FAIL) legacy shape (`CROSS_DOMAIN_CANONICAL`,
 * `PROTOCOL_MISMATCH`) are treated as a pass here, exactly like before this
 * refactor. Every FAIL-level code (including the previously-missed
 * `SUBPAGE_POINTS_TO_ROOT` / `CANONICAL_PATH_MISMATCH` regression) now
 * reliably surfaces as FAIL.
 */
export function evaluateCanonicalAccuracy(
	canonicalHref: string | null | undefined,
	targetUrl: string,
): CanonicalAccuracyResult {
	if (!canonicalHref?.trim()) {
		return { status: 'FAIL', reason: 'Canonical 태그 없음' };
	}

	const diagnosis = diagnoseCanonicalUrl({
		requestUrl: targetUrl,
		canonicalHrefs: [canonicalHref],
	});

	const cleanTarget = normalizeCanonicalCompareUrl(targetUrl, targetUrl);

	if (diagnosis.code === 'MISSING_CANONICAL' || diagnosis.code === 'INVALID_ABSOLUTE_URL') {
		return { status: 'FAIL', reason: 'Canonical 태그 없음' };
	}
	if (diagnosis.code === 'MALFORMED_URL') {
		return {
			status: 'FAIL',
			extracted: extractPureUrl(canonicalHref) || canonicalHref,
			expected: cleanTarget,
		};
	}

	const cleanExtracted = normalizeCanonicalCompareUrl(diagnosis.details.canonicalUrl, targetUrl);

	if (diagnosis.status === 'PASS' || diagnosis.status === 'WARN') {
		return { status: 'PASS', canonical: cleanExtracted };
	}

	return {
		status: 'FAIL',
		extracted: cleanExtracted,
		expected: cleanTarget,
	};
}

export function canonicalMatches(
	pageUrl: string,
	canonical: string | null | undefined,
): boolean {
	return evaluateCanonicalAccuracy(canonical, pageUrl).status === 'PASS';
}
