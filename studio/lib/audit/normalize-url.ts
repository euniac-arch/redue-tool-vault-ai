/**
 * Audit-target URL normalization — protocol, IDN/Punycode, trailing junk.
 *
 * `한국.kr` and `https://한국.kr/경로` both become a WHATWG URL whose
 * `hostname` is already Punycode (`xn--…`). Downstream fetch / DNS must
 * use that ASCII host so encoded Hangul domains never throw.
 */

export class InvalidAuditUrlError extends Error {
	constructor(message = '올바른 URL 형식이 아닙니다. (예: https://example.com)') {
		super(message);
		this.name = 'InvalidAuditUrlError';
	}
}

/** Strip wrapping quotes / zero-width / trailing punctuation users paste from chat. */
export function sanitizeUrlInput(raw: string): string {
	return (raw || '')
		.trim()
		.replace(/^['"`]+|['"`]+$/g, '')
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.replace(/[)\].,;]+$/g, '')
		.trim();
}

/**
 * Coerce a user-typed host or URL into a WHATWG `URL`.
 * Missing protocol → `https://`. Unicode hosts → Punycode via the URL parser.
 */
export function coerceHttpUrl(input: string): URL {
	const trimmed = sanitizeUrlInput(input);
	if (!trimmed) throw new InvalidAuditUrlError();

	const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed.replace(/^\/+/, '')}`;

	let url: URL;
	try {
		url = new URL(withProtocol);
	} catch {
		throw new InvalidAuditUrlError();
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new InvalidAuditUrlError('http 또는 https URL만 진단할 수 있습니다.');
	}

	url.hash = '';
	return url;
}

/** ASCII (Punycode) hostname — safe for DNS lookup and fetch. */
export function punycodeHostname(input: string | URL): string {
	const url = typeof input === 'string' ? coerceHttpUrl(input) : input;
	return url.hostname.toLowerCase().replace(/\.$/, '');
}

/** Absolute href after Punycode + protocol normalization. */
export function toPunycodeHref(input: string): string {
	return coerceHttpUrl(input).href;
}

export function isPunycodeHost(hostname: string): boolean {
	return /(?:^|\.)xn--/i.test(hostname);
}

/** Resolve a possibly-relative Location against the current request URL. */
export function resolveRedirectLocation(currentUrl: string, location: string): URL | null {
	const loc = (location || '').trim();
	if (!loc) return null;
	try {
		return new URL(loc, currentUrl);
	} catch {
		return null;
	}
}
