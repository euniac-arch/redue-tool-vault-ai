/**
 * Root-domain (eTLD+1) normalization for B2B target discovery.
 *
 * `https://www.example.co.jp/about?id=1` → `example.co.jp`
 * Strips protocol, `www.`, path, query, and port.
 */

/** Multi-part public suffixes that must stay attached to the registrable label. */
const MULTI_PART_TLDS = new Set([
	// Korea
	'co.kr',
	'or.kr',
	'go.kr',
	'ac.kr',
	'ne.kr',
	're.kr',
	'pe.kr',
	'ms.kr',
	'es.kr',
	'hs.kr',
	'sc.kr',
	'kg.kr',
	'mil.kr',
	// Japan
	'co.jp',
	'or.jp',
	'ne.jp',
	'ac.jp',
	'go.jp',
	'ad.jp',
	'ed.jp',
	'gr.jp',
	'lg.jp',
	// UK / AU / common ccTLD compounds
	'co.uk',
	'org.uk',
	'ac.uk',
	'gov.uk',
	'ltd.uk',
	'me.uk',
	'net.uk',
	'com.au',
	'net.au',
	'org.au',
	'edu.au',
	'gov.au',
	'co.nz',
	'co.za',
	'co.in',
	'com.br',
	'com.mx',
	'com.tw',
	'com.hk',
	'com.sg',
	'co.th',
	'com.vn',
	'co.id',
	'com.my',
	'com.ph',
	'com.tr',
	'co.il',
	'com.ar',
	'com.pe',
	'com.eg',
	'com.sa',
	'com.ae',
	'com.cn',
	'com.pl',
	'co.ke',
	'com.ng',
	'com.pk',
]);

/**
 * Registrable-name (SLD) brands that are never B2B prospects,
 * regardless of TLD (`amazon.com`, `amazon.co.jp`, `google.co.kr`, …).
 */
const BLACKLIST_SLDS = new Set([
	'amazon',
	'yahoo',
	'wikipedia',
	'google',
	'youtube',
	'facebook',
	'instagram',
	'twitter',
	'linkedin',
	'naver',
	'daum',
	'kakao',
	'bing',
	'microsoft',
	'apple',
	'github',
	'gitlab',
	'reddit',
	'blogspot',
	'wordpress',
	'tistory',
]);

/** Exact root domains that should never be stored as leads. */
const BLACKLIST_ROOT_DOMAINS = new Set([
	'amazon.com',
	'amazon.co.jp',
	'amazon.co.kr',
	'amazon.co.uk',
	'yahoo.com',
	'yahoo.co.jp',
	'yahoo.co.kr',
	'wikipedia.org',
	'google.com',
	'google.co.kr',
	'google.co.jp',
	'google.co.uk',
	'youtu.be',
	'x.com',
	'fb.com',
	'namu.wiki',
	'modoo.at',
]);

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^\[?[0-9a-f:]+\]?$/i;

function stripWww(hostname: string): string {
	return hostname.replace(/^www\./i, '');
}

function isIpHostname(hostname: string): boolean {
	const bare = hostname.replace(/^\[|\]$/g, '');
	return IPV4_RE.test(bare) || (bare.includes(':') && IPV6_RE.test(bare));
}

/**
 * Parse a URL-or-host string into a lowercase hostname without `www.`.
 * Returns null for empty / unparseable / IP / localhost values.
 */
export function extractHostname(rawUrl: string): string | null {
	const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
	if (!trimmed) return null;

	const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;

	let hostname: string;
	try {
		hostname = new URL(withProtocol).hostname;
	} catch {
		return null;
	}

	hostname = hostname.toLowerCase().replace(/\.$/, '');
	if (!hostname || hostname === 'localhost') return null;
	if (isIpHostname(hostname)) return null;

	hostname = stripWww(hostname);
	if (!hostname.includes('.')) return null;
	return hostname;
}

/**
 * Extract the registrable root domain (eTLD+1) from a URL.
 *
 * @example extractRootDomain('https://www.example.co.jp/about?id=1') // 'example.co.jp'
 * @example extractRootDomain('https://shop.sub.example.com/a') // 'example.com'
 */
export function extractRootDomain(rawUrl: string): string | null {
	const host = extractHostname(rawUrl);
	if (!host) return null;

	const labels = host.split('.').filter(Boolean);
	if (labels.length < 2) return null;
	if (MULTI_PART_TLDS.has(host)) return null;

	let suffixLen = 1;
	const maxSuffix = Math.min(labels.length - 1, 3);
	for (let n = maxSuffix; n >= 2; n -= 1) {
		const suffix = labels.slice(-n).join('.');
		if (MULTI_PART_TLDS.has(suffix)) {
			suffixLen = n;
			break;
		}
	}

	if (labels.length <= suffixLen) return null;
	return labels.slice(-(suffixLen + 1)).join('.');
}

/** Second-level label of a root domain (`example.co.jp` → `example`). */
export function extractSld(rootDomain: string): string {
	const labels = rootDomain.split('.').filter(Boolean);
	if (labels.length < 2) return rootDomain;
	for (let n = Math.min(labels.length - 1, 3); n >= 2; n -= 1) {
		const suffix = labels.slice(-n).join('.');
		if (MULTI_PART_TLDS.has(suffix)) {
			return labels.slice(0, labels.length - n).join('.') || labels[0];
		}
	}
	return labels[0];
}

/**
 * True when the URL/host maps to a default-excluded portal / marketplace / SNS domain.
 */
export function isDefaultBlacklistedDomain(rawUrlOrDomain: string): boolean {
	const root = extractRootDomain(rawUrlOrDomain);
	if (!root) return true;
	if (BLACKLIST_ROOT_DOMAINS.has(root)) return true;
	return BLACKLIST_SLDS.has(extractSld(root));
}

export const DEFAULT_BLACKLIST_SLDS = BLACKLIST_SLDS;
export const DEFAULT_BLACKLIST_ROOT_DOMAINS = BLACKLIST_ROOT_DOMAINS;
