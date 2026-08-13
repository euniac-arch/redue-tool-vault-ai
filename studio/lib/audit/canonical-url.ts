/**
 * Canonical URL extraction & coherence helpers.
 * Mirrors the diagnostic PHP `evaluate_canonical_accuracy` rules:
 * strip markdown/HTML wrappers, unify protocol + trailing slash, then compare.
 */

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

/** Normalize protocol (http→https) and trailing slash for apples-to-apples compare. */
export function normalizeCanonicalCompareUrl(
	url: string,
	targetUrl: string,
): string {
	let cleaned = extractPureUrl(url).replace(/^http:\/\//i, 'https://');
	cleaned = cleaned.replace(/\/+$/, '');

	try {
		const path = new URL(targetUrl).pathname;
		if (path === '/' || path === '') {
			cleaned += '/';
		}
	} catch {
		// keep slash-stripped form
	}

	return cleaned;
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
