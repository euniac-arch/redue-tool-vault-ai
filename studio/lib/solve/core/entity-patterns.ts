/**
 * CMS-agnostic entity / SEO runtime patterns.
 * Shared by audit extractors (TS) and the PHP runtime helpers (string twins).
 */

export {
	TELEPHONE_BODY_RE,
	TELEPHONE_BODY_RE_PHP,
	TELEPHONE_UNIVERSAL_RE,
	TELEPHONE_UNIVERSAL_RE_PHP,
	bindTelephone,
	extractTelephoneFromText,
	formatKoreanTelephone,
} from '@/lib/solve/core/telephone';

/** Nationwide KR street address (optional 주소|위치 label → 시/도 → 로|길|동|리|…). */
export const KR_STREET_ADDRESS_RE =
	/(?:주소|위치|ADDRESS|소재지)?\s*[:：]?\s*((?:서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣\d\-~,()·\s]+(?:로|길|동|리|읍|면|가|층|호|번지))/u;

export const TITLE_MIN_CHARS = 10;
export const TITLE_GOLDEN_MIN = 15;
export const TITLE_GOLDEN_MAX = 35;
export const TITLE_HARD_MAX = 60;

export const SHORT_TITLE_SUFFIX = '— 공식 안내 및 전문 서비스';

/** PHP-source twin of KR_STREET_ADDRESS_RE. */
export const KR_STREET_ADDRESS_RE_PHP =
	'/(?:주소|위치|ADDRESS|소재지)?\\s*[:：]?\\s*((?:서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣\\d\\-~,()·\\s]+(?:로|길|동|리|읍|면|가|층|호|번지))/u';

export function extractStreetAddressFromText(text: string): string {
	if (!text) return '';
	const m = text.match(KR_STREET_ADDRESS_RE);
	if (!m) return '';
	let hit = (m[1] || m[0] || '').replace(/\s+/gu, ' ').trim();
	hit = hit.replace(/^(?:주소|위치|ADDRESS|소재지)\s*[:：]?\s*/u, '').trim();
	const after = text.slice((m.index || 0) + m[0].length);
	const num = after.match(/^\s*(\d[\d-]{0,8}(?:\s*[가-힣\d호층동번지]+)?)/u);
	if (num?.[1]) hit = `${hit} ${num[1].replace(/\s+/gu, ' ').trim()}`;
	return hit.trim();
}

export function composeFallbackTitle(siteName: string): string {
	const brand = (siteName || '').trim() || '웹사이트';
	let next = `${brand} ${SHORT_TITLE_SUFFIX}`.replace(/\s+/g, ' ').trim();
	if ([...next].length > TITLE_GOLDEN_MAX) {
		next = [...next].slice(0, TITLE_GOLDEN_MAX).join('').trim();
	}
	return next;
}

export function shouldExpandTitle(title: string): boolean {
	const len = [...(title || '').trim()].length;
	return len < TITLE_MIN_CHARS;
}

export function composeMissingImgAlt(siteName: string, pageName: string): string {
	const site = (siteName || '').trim() || '웹사이트';
	const page = (pageName || '').trim();
	if (page && page !== site) return `${site} ${page} 안내 이미지`;
	return `${site} 안내 이미지`;
}

/**
 * Absolute canonical from runtime-like env (HTTPS + host + REQUEST_URI).
 * Path `/` or `/index.php` with no identity query collapses to origin/.
 */
export function buildExactCanonicalFromEnv(input: {
	https?: boolean | string;
	httpHost?: string;
	serverName?: string;
	requestUri?: string;
	scriptName?: string;
	identityQuery?: Record<string, string>;
}): string {
	const hostRaw = String(input.httpHost || input.serverName || 'localhost')
		.replace(/^https?:\/\//i, '')
		.replace(/:\d+$/, '');
	const origin = `https://${hostRaw}`;
	let path = '';
	try {
		const parsed = new URL(input.requestUri || '/', 'https://local.test');
		path = parsed.pathname || '/';
	} catch {
		path = '/';
	}
	const script = String(input.scriptName || '').replace(/\\/g, '/');
	if ((path === '' || path === '/' || path === '/index.php') && script && script !== '/' && script !== '/index.php' && script.endsWith('.php')) {
		path = script;
	}
	if (!path) path = '/';

	const allowed = ['bo_table', 'wr_id', 'co_id', 'idx', 'p', 'page_id', 'id'] as const;
	const q = input.identityQuery || {};
	const filtered: Record<string, string> = {};
	for (const key of allowed) {
		const v = String(q[key] || '').trim();
		if (v) filtered[key] = v;
	}
	const qs = Object.keys(filtered).length
		? `?${new URLSearchParams(filtered).toString()}`
		: '';

	if ((path === '/' || path === '/index.php' || path === '') && !qs) {
		return `${origin}/`;
	}
	if (path === '/index.php') path = '/';
	return `${origin}${path}${qs}`;
}
