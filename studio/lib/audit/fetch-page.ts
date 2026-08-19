/**
 * Redirect-aware page fetch for the diagnosis collector.
 *
 * Tracks the full http→https / non-www→www chain, decodes EUC-KR/CP949
 * bodies, and captures security headers from the *final* response.
 */

import { decodeHtmlBuffer } from '@/lib/crawling/hybrid-scan';
import { coerceHttpUrl, resolveRedirectLocation } from '@/lib/audit/normalize-url';
import { assertPublicHttpUrl } from '@/lib/ssrf-guard';

export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
export const MAX_HTML_CHARS = 2_000_000;
export const MAX_REDIRECTS = 8;
export const AUDIT_USER_AGENT = 'Mozilla/5.0 (compatible; ReduAiAuditBot/1.0; +https://redue.ai/audit)';
/** Fallback when WAFs reject the audit bot UA (403/401) or TLS/timeout kills the first hop. */
export const BROWSER_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface RedirectHop {
	from: string;
	to: string;
	status: number;
}

export interface SecurityHeaderSnapshot {
	hsts: string | null;
	csp: string | null;
	xContentTypeOptions: string | null;
	xFrameOptions: string | null;
	referrerPolicy: string | null;
	permissionsPolicy: string | null;
	xRobotsTag: string | null;
	contentType: string | null;
	server: string | null;
	/** Selected geo / CDN country hints (lowercased keys). */
	extra: Record<string, string>;
}

export interface FetchedPage {
	ok: boolean;
	status: number | null;
	text: string;
	elapsedMs: number;
	bytes: number;
	/** Requested URL (after Punycode normalization). */
	requestedUrl: string;
	/** Final URL after the redirect chain. */
	finalUrl: string;
	redirectChain: RedirectHop[];
	headers: Record<string, string>;
	security: SecurityHeaderSnapshot;
	/** True when any hop went https → http. */
	unsafeRedirect: boolean;
	hasHsts: boolean;
	hasCsp: boolean;
}

const GEO_HEADER_KEYS = [
	'cf-ipcountry',
	'x-vercel-ip-country',
	'cloudfront-viewer-country',
	'x-country-code',
	'x-geo-country',
	'server',
] as const;

const SECURITY_HEADER_KEYS = [
	'strict-transport-security',
	'content-security-policy',
	'x-content-type-options',
	'x-frame-options',
	'referrer-policy',
	'permissions-policy',
	'x-robots-tag',
	'content-type',
] as const;

function headerValue(res: Response, key: string): string | null {
	const value = res.headers.get(key);
	return value && value.trim() ? value.trim() : null;
}

export function pickResponseHeaders(res: Response): Record<string, string> {
	const out: Record<string, string> = {};
	for (const key of [...GEO_HEADER_KEYS, ...SECURITY_HEADER_KEYS]) {
		const value = headerValue(res, key);
		if (value) out[key] = value;
	}
	return out;
}

export function readSecurityHeaders(res: Response): SecurityHeaderSnapshot {
	const extra: Record<string, string> = {};
	for (const key of GEO_HEADER_KEYS) {
		const value = headerValue(res, key);
		if (value) extra[key] = value;
	}
	return {
		hsts: headerValue(res, 'strict-transport-security'),
		csp: headerValue(res, 'content-security-policy'),
		xContentTypeOptions: headerValue(res, 'x-content-type-options'),
		xFrameOptions: headerValue(res, 'x-frame-options'),
		referrerPolicy: headerValue(res, 'referrer-policy'),
		permissionsPolicy: headerValue(res, 'permissions-policy'),
		xRobotsTag: headerValue(res, 'x-robots-tag'),
		contentType: headerValue(res, 'content-type'),
		server: headerValue(res, 'server'),
		extra,
	};
}

export function hasUnsafeRedirect(chain: readonly RedirectHop[]): boolean {
	return chain.some((hop) => {
		try {
			return new URL(hop.from).protocol === 'https:' && new URL(hop.to).protocol === 'http:';
		} catch {
			return false;
		}
	});
}

function withNocacheParam(url: string, forceRefresh: boolean): string {
	if (!forceRefresh) return url;
	try {
		const u = new URL(url);
		u.searchParams.set('_redue_nocache', String(Date.now()));
		return u.toString();
	} catch {
		const sep = url.includes('?') ? '&' : '?';
		return `${url}${sep}_redue_nocache=${Date.now()}`;
	}
}

function emptyResult(requestedUrl: string, elapsedMs: number): FetchedPage {
	return {
		ok: false,
		status: null,
		text: '',
		elapsedMs,
		bytes: 0,
		requestedUrl,
		finalUrl: requestedUrl,
		redirectChain: [],
		headers: {},
		security: {
			hsts: null,
			csp: null,
			xContentTypeOptions: null,
			xFrameOptions: null,
			referrerPolicy: null,
			permissionsPolicy: null,
			xRobotsTag: null,
			contentType: null,
			server: null,
			extra: {},
		},
		unsafeRedirect: false,
		hasHsts: false,
		hasCsp: false,
	};
}

export interface FetchPageOptions {
	timeoutMs?: number;
	forceRefresh?: boolean;
	accept?: string;
	maxRedirects?: number;
	/** Skip SSRF/DNS on same-origin follow-up files (robots / sitemap / llms). */
	skipSsrf?: boolean;
	maxChars?: number;
	/** Override User-Agent for this attempt. */
	userAgent?: string;
	/** Prevent recursive http→https upgrade retries. */
	skipProtocolUpgrade?: boolean;
}

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

function isBlockedStatus(status: number | null): boolean {
	return status === 401 || status === 403 || status === 429;
}

async function fetchRedirectChain(
	requested: URL,
	opts: FetchPageOptions | undefined,
	userAgent: string,
	started: number,
): Promise<FetchedPage> {
	const timeoutMs = opts?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
	const maxRedirects = opts?.maxRedirects ?? MAX_REDIRECTS;
	const maxChars = opts?.maxChars ?? MAX_HTML_CHARS;
	const accept = opts?.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
	const requestedUrl = requested.href;
	const chain: RedirectHop[] = [];
	let current = requestedUrl;

	for (let hop = 0; hop <= maxRedirects; hop += 1) {
		let currentUrl: URL;
		try {
			currentUrl = hop === 0 || opts?.skipSsrf ? new URL(current) : await assertPublicHttpUrl(current);
		} catch (err) {
			console.error('[fetch-page] redirect target rejected:', current, errorMessage(err));
			return { ...emptyResult(requestedUrl, Date.now() - started), redirectChain: chain, finalUrl: current };
		}

		const fetchUrl = hop === 0 ? withNocacheParam(currentUrl.href, opts?.forceRefresh === true) : currentUrl.href;
		try {
			const res = await fetch(fetchUrl, {
				headers: {
					'User-Agent': userAgent,
					Accept: accept,
					...(opts?.forceRefresh && hop === 0
						? {
								'Cache-Control': 'no-cache, no-store, must-revalidate',
								Pragma: 'no-cache',
							}
						: {}),
				},
				cache: 'no-store',
				signal: AbortSignal.timeout(timeoutMs),
				redirect: 'manual',
			});

			if (res.status >= 300 && res.status < 400) {
				const next = resolveRedirectLocation(currentUrl.href, res.headers.get('location') || '');
				if (!next || (next.protocol !== 'http:' && next.protocol !== 'https:')) {
					console.error('[fetch-page] invalid redirect Location:', {
						from: currentUrl.href,
						location: res.headers.get('location'),
						status: res.status,
					});
					break;
				}
				chain.push({ from: currentUrl.href, to: next.href, status: res.status });
				current = next.href;
				continue;
			}

			const buffer = Buffer.from(await res.arrayBuffer());
			const decoded = decodeHtmlBuffer(buffer, res.headers.get('content-type') || undefined);
			const security = readSecurityHeaders(res);
			const headers = pickResponseHeaders(res);
			return {
				ok: res.ok,
				status: res.status,
				text: decoded.slice(0, maxChars),
				elapsedMs: Date.now() - started,
				bytes: buffer.length,
				requestedUrl,
				finalUrl: currentUrl.href,
				redirectChain: chain,
				headers,
				security,
				unsafeRedirect: hasUnsafeRedirect(chain),
				hasHsts: Boolean(security.hsts),
				hasCsp: Boolean(security.csp),
			};
		} catch (err) {
			console.error('[fetch-page] hop failed:', {
				url: fetchUrl,
				hop,
				userAgent: userAgent === AUDIT_USER_AGENT ? 'audit-bot' : 'browser',
				message: errorMessage(err),
			});
			return {
				...emptyResult(requestedUrl, Date.now() - started),
				redirectChain: chain,
				finalUrl: current,
				unsafeRedirect: hasUnsafeRedirect(chain),
			};
		}
	}

	console.error('[fetch-page] redirect loop exhausted:', { url: requestedUrl, hops: chain.length });
	return {
		...emptyResult(requestedUrl, Date.now() - started),
		redirectChain: chain,
		finalUrl: current,
		unsafeRedirect: hasUnsafeRedirect(chain),
	};
}

/**
 * Fetch a public URL, following redirects manually so the final DOM/headers
 * and the hop list are both available to the scorer.
 */
export async function fetchPageResource(
	inputUrl: string,
	opts?: FetchPageOptions,
): Promise<FetchedPage> {
	const started = Date.now();

	let requested: URL;
	try {
		requested = opts?.skipSsrf ? coerceHttpUrl(inputUrl) : await assertPublicHttpUrl(inputUrl);
	} catch (err) {
		console.error('[fetch-page] URL rejected:', inputUrl, errorMessage(err));
		return emptyResult(inputUrl, Date.now() - started);
	}

	const primaryUa = opts?.userAgent ?? AUDIT_USER_AGENT;
	let result = await fetchRedirectChain(requested, opts, primaryUa, started);

	const blocked = isBlockedStatus(result.status);
	const emptyBody = !result.text;
	if ((blocked || (emptyBody && result.status == null)) && primaryUa !== BROWSER_USER_AGENT) {
		console.warn('[fetch-page] retrying with browser User-Agent', {
			url: requested.href,
			status: result.status,
		});
		const retry = await fetchRedirectChain(requested, opts, BROWSER_USER_AGENT, started);
		if (retry.text || retry.status != null) {
			result = retry;
		}
	}

	if (!result.text && result.status == null && requested.protocol === 'http:' && !opts?.skipProtocolUpgrade) {
		const httpsUrl = new URL(requested.href);
		httpsUrl.protocol = 'https:';
		console.warn('[fetch-page] HTTP fetch empty, trying HTTPS', httpsUrl.href);
		const httpsResult = await fetchPageResource(httpsUrl.href, {
			...opts,
			skipProtocolUpgrade: true,
			skipSsrf: true,
		});
		if (httpsResult.text || httpsResult.ok) return httpsResult;
	}

	return result;
}
