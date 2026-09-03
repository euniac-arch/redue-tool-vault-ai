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
	/**
	 * True when the returned body is a bot/WAF interstitial (Vercel Attack
	 * Challenge Mode, Cloudflare "Just a moment…", etc.) rather than the real
	 * page — the crawler was JS-challenged, not actually served the site.
	 * Downstream metadata extraction must NOT treat this body as real content.
	 */
	botChallenge: boolean;
	/**
	 * Classified fetch failure when `ok` is false and no HTTP status landed.
	 * Auxiliary collectors (sitemap / robots / llms.txt) treat this as
	 * `timeout_or_failed` and continue the diagnosis.
	 */
	error?: string | null;
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

/**
 * Known bot/WAF challenge interstitials that must never be mistaken for the
 * real page (title/OG/body all belong to the WAF, not the audited site).
 * Header check first (cheap + reliable); text markers cover WAFs that don't
 * set a distinctive header.
 */
function isBotChallengeResponse(res: Response, bodyHead: string): boolean {
	const mitigated = res.headers.get('x-vercel-mitigated');
	if (mitigated && /challenge/i.test(mitigated)) return true;
	const sample = bodyHead.slice(0, 4000);
	return /<title>\s*(?:vercel security checkpoint|just a moment\.\.\.|attention required!\s*\|\s*cloudflare|please wait\.\.\.\s*\|\s*cloudflare|checking your browser before accessing)\s*<\/title>/i.test(
		sample,
	);
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

function emptyResult(requestedUrl: string, elapsedMs: number, error?: string | null): FetchedPage {
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
		botChallenge: false,
		error: error || null,
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
	/**
	 * Skip the browser-UA retry. Use for auxiliary same-origin files
	 * (sitemap / robots / llms.txt) so a dead HTTPS hop cannot stack another timeout.
	 */
	skipUaRetry?: boolean;
}

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

/** Flatten `Error` + Node `cause.code` so undici `fetch failed` is classifiable. */
export function collectErrorText(err: unknown): string {
	const parts: string[] = [];
	let current: unknown = err;
	for (let depth = 0; depth < 5 && current != null; depth += 1) {
		if (current instanceof Error) {
			if (current.message) parts.push(current.message);
			if ('code' in current && current.code) parts.push(String(current.code));
			current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined;
			continue;
		}
		if (typeof current === 'object') {
			const row = current as { code?: unknown; message?: unknown; cause?: unknown };
			if (row.message) parts.push(String(row.message));
			if (row.code) parts.push(String(row.code));
			current = row.cause;
			if (current === undefined) break;
			continue;
		}
		parts.push(String(current));
		break;
	}
	return parts.join(' ');
}

const HARD_NETWORK_ERROR_RE =
	/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENOTFOUND|EPROTO|ETIMEDOUT|ERR_SSL|ERR_TLS|ERR_CERT|SSL_PROTOCOL|UNABLE_TO_VERIFY|CERT_|certificate|handshake|fetch failed/i;

const TIMEOUT_ERROR_RE = /timeout|aborted|AbortError|The operation was aborted/i;

/** Connection refused / TLS handshake / generic undici `fetch failed` — retrying will not help. */
export function isHardNetworkError(err: unknown): boolean {
	return HARD_NETWORK_ERROR_RE.test(collectErrorText(err));
}

export function isTimeoutError(err: unknown): boolean {
	return TIMEOUT_ERROR_RE.test(collectErrorText(err));
}

/** Stable token for auxiliary collectors (`sitemap` / robots / llms). */
export function classifyFetchError(err: unknown): string {
	if (isTimeoutError(err) || isHardNetworkError(err)) return 'timeout_or_failed';
	return collectErrorText(err).slice(0, 180) || 'timeout_or_failed';
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
		const remainingMs = timeoutMs - (Date.now() - started);
		if (remainingMs < 250) {
			return {
				...emptyResult(requestedUrl, Date.now() - started, 'timeout_or_failed'),
				redirectChain: chain,
				finalUrl: current,
				unsafeRedirect: hasUnsafeRedirect(chain),
			};
		}

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
								Expires: '0',
							}
						: {}),
				},
				cache: 'no-store',
				signal: AbortSignal.timeout(remainingMs),
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
			const text = decoded.slice(0, maxChars);
			return {
				ok: res.ok,
				status: res.status,
				text,
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
				botChallenge: isBotChallengeResponse(res, text),
			};
		} catch (err) {
			const classified = classifyFetchError(err);
			console.error('[fetch-page] hop failed:', {
				url: fetchUrl,
				hop,
				userAgent: userAgent === AUDIT_USER_AGENT ? 'audit-bot' : 'browser',
				message: errorMessage(err),
				classified,
			});
			return {
				...emptyResult(requestedUrl, Date.now() - started, classified),
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
 *
 * Fail-safe: hop / TLS / timeout errors never throw. HTTP-only hosts that
 * reject HTTPS (`ECONNREFUSED`, `ERR_SSL_PROTOCOL_ERROR`, `fetch failed`)
 * skip the browser-UA retry and do at most one protocol-upgrade attempt.
 */
export async function fetchPageResource(
	inputUrl: string,
	opts?: FetchPageOptions,
): Promise<FetchedPage> {
	const started = Date.now();

	try {
		let requested: URL;
		try {
			requested = opts?.skipSsrf ? coerceHttpUrl(inputUrl) : await assertPublicHttpUrl(inputUrl);
		} catch (err) {
			console.error('[fetch-page] URL rejected:', inputUrl, errorMessage(err));
			return emptyResult(inputUrl, Date.now() - started, classifyFetchError(err));
		}

		const primaryUa = opts?.userAgent ?? AUDIT_USER_AGENT;
		let result = await fetchRedirectChain(requested, opts, primaryUa, started);

		const blocked = isBlockedStatus(result.status) || result.botChallenge;
		const hardFail = Boolean(result.error);
		const timeoutMs = opts?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
		const retryBudgetMs = timeoutMs - (Date.now() - started);
		// UA retry is only for WAF / 401-403-429 — never for timeout or TLS refusal.
		// Also skip when the first hop already burned the budget; a second 6s chain
		// would push a single-page fetch past the 5–15s diagnosis target.
		if (
			!opts?.skipUaRetry &&
			blocked &&
			!hardFail &&
			primaryUa !== BROWSER_USER_AGENT &&
			retryBudgetMs >= 1_500
		) {
			console.warn('[fetch-page] retrying with browser User-Agent', {
				url: requested.href,
				status: result.status,
				botChallenge: result.botChallenge,
				retryBudgetMs,
			});
			const retry = await fetchRedirectChain(requested, opts, BROWSER_USER_AGENT, started);
			if (retry.text || retry.status != null) {
				result = retry;
			}
		}

		if (
			!result.text &&
			result.status == null &&
			requested.protocol === 'http:' &&
			!opts?.skipProtocolUpgrade
		) {
			const httpsUrl = new URL(requested.href);
			httpsUrl.protocol = 'https:';
			console.warn('[fetch-page] HTTP fetch empty, trying HTTPS', httpsUrl.href);
			const httpsResult = await fetchPageResource(httpsUrl.href, {
				...opts,
				skipProtocolUpgrade: true,
				skipUaRetry: true,
				skipSsrf: true,
			});
			if (httpsResult.text || httpsResult.ok) return httpsResult;
			// HTTPS refused / SSL handshake failed — keep the HTTP result and stop.
			if (httpsResult.error) {
				return { ...result, error: result.error || httpsResult.error };
			}
		}

		return result;
	} catch (err) {
		console.error('[fetch-page] unexpected failure:', inputUrl, errorMessage(err));
		return emptyResult(inputUrl, Date.now() - started, classifyFetchError(err));
	}
}
