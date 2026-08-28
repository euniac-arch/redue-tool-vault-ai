/**
 * Canonical URL extraction & coherence helpers.
 * Compare after stripping markdown/HTML wrappers, cache-bust/tracking query
 * params, a trailing `/index.php`, and unifying protocol + trailing slash.
 */

/** Cache-bust and click-tracking keys that must not affect Canonical match. */
const IGNORED_CANONICAL_QUERY_KEYS = new Set([
	'_redue_nocache',
	'_nocache',
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_content',
	'utm_term',
	'fbclid',
	'gclid',
]);

function isIgnoredCanonicalQueryKey(key: string): boolean {
	const lower = key.toLowerCase();
	return IGNORED_CANONICAL_QUERY_KEYS.has(lower) || lower.startsWith('utm_');
}

function stripIgnoredCanonicalParams(url: URL): void {
	for (const key of [...url.searchParams.keys()]) {
		if (isIgnoredCanonicalQueryKey(key)) url.searchParams.delete(key);
	}
}

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
 * trailing `/index.php`, force https, and unify a trailing slash.
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

export type CanonicalAccuracyResult =
	| { status: 'PASS'; canonical: string }
	| { status: 'FAIL'; reason: string }
	| { status: 'FAIL'; extracted: string; expected: string };

/**
 * Evaluate whether an extracted canonical href matches the target page URL.
 * `canonicalHref` may be raw href text (possibly markdown/HTML-wrapped).
 */
export function evaluateCanonicalAccuracy(
	canonicalHref: string | null | undefined,
	targetUrl: string,
): CanonicalAccuracyResult {
	if (!canonicalHref?.trim()) {
		return { status: 'FAIL', reason: 'Canonical 태그 없음' };
	}

	const pure = extractPureUrl(canonicalHref);
	if (!pure) {
		return { status: 'FAIL', reason: 'Canonical 태그 없음' };
	}

	let absolute: string;
	try {
		absolute = new URL(pure, targetUrl).toString();
	} catch {
		return {
			status: 'FAIL',
			extracted: pure,
			expected: normalizeCanonicalCompareUrl(targetUrl, targetUrl),
		};
	}

	const cleanExtracted = normalizeCanonicalCompareUrl(absolute, targetUrl);
	const cleanTarget = normalizeCanonicalCompareUrl(targetUrl, targetUrl);

	if (cleanExtracted === cleanTarget) {
		return { status: 'PASS', canonical: cleanExtracted };
	}

	// Same document when only host/path/query differ by www. or residual noise
	try {
		const a = new URL(cleanExtracted);
		const b = new URL(cleanTarget);
		const hostA = a.hostname.replace(/^www\./i, '');
		const hostB = b.hostname.replace(/^www\./i, '');
		if (
			hostA === hostB &&
			a.pathname.replace(/\/+$/, '') === b.pathname.replace(/\/+$/, '') &&
			a.search === b.search
		) {
			return { status: 'PASS', canonical: cleanExtracted };
		}
	} catch {
		// fall through to FAIL
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
