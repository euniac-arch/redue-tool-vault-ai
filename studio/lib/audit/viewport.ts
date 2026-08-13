/**
 * Viewport meta cross-validation (PageSpeed Lighthouse audit + HTML scan).
 * Prevents false "Viewport 미확인" on responsive sites with atypical meta markup.
 */

export type ViewportCheckStatus = 'SUCCESS' | 'WARNING' | 'FAIL';

export type ViewportCheckResult = {
	status: ViewportCheckStatus;
	/** True when viewport is confirmed present / OK. */
	present: boolean;
	/** False when neither Lighthouse nor HTML could confirm presence/absence. */
	known: boolean;
	label: string;
	badge: string;
	color: 'emerald' | 'amber' | 'red';
};

/** Minimal Lighthouse `audits['viewport']` shape used for cross-validation. */
export type LighthouseViewportAudit = {
	score?: number | null;
	scoreDisplayMode?: string | null;
	details?: { items?: unknown[] | null } | null;
};

/**
 * Case / attribute-order tolerant HTML scan for `<meta name="viewport" …>`.
 * Also accepts content-first tags and optional `width=device-width`.
 */
export function detectViewportInHtml(htmlSource: string | null | undefined): boolean {
	if (!htmlSource) return false;

	// Fast path: name=viewport anywhere inside a meta tag (order-independent).
	const metaTagRe = /<meta\b[^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = metaTagRe.exec(htmlSource)) !== null) {
		const tag = match[0];
		if (!/\bname\s*=\s*["']?\s*viewport\s*["']?/i.test(tag)) continue;
		// Prefer device-width when content is present; bare viewport meta still counts.
		const contentMatch = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag);
		if (!contentMatch) return true;
		const content = contentMatch[1] || '';
		if (/width\s*=\s*device-width/i.test(content) || content.trim().length > 0) return true;
		return true;
	}

	// Fallback: name/content may span unusual whitespace; require device-width when using this path.
	return (
		/<meta\s+[^>]*name\s*=\s*["']viewport["'][^>]*content\s*=\s*["'][^"']*width\s*=\s*device-width[^"']*["']/i.test(
			htmlSource,
		) ||
		/<meta\s+[^>]*content\s*=\s*["'][^"']*width\s*=\s*device-width[^"']*["'][^>]*name\s*=\s*["']viewport["']/i.test(
			htmlSource,
		)
	);
}

/**
 * Interpret Lighthouse SEO `viewport` audit.
 * @returns `true` pass, `false` fail, `null` inconclusive / missing.
 */
export function lighthouseViewportOk(
	audit: LighthouseViewportAudit | null | undefined,
): boolean | null {
	if (!audit || typeof audit !== 'object') return null;

	const mode = String(audit.scoreDisplayMode ?? '')
		.trim()
		.toLowerCase();
	if (mode === 'notapplicable' || mode === 'informative') return true;

	if (audit.score === 1) return true;
	if (audit.score === 0) return false;

	// Some LH builds omit a binary score but leave an empty details list when OK.
	const items = audit.details?.items;
	if (Array.isArray(items) && items.length === 0 && audit.score == null) return true;

	return null;
}

/**
 * Cross-validate viewport: PageSpeed audit first, then HTML regex / stored flag.
 */
export function checkViewport(args: {
	lighthouse?: { audits?: Record<string, LighthouseViewportAudit | undefined> } | null;
	/** Direct audit object when already extracted from a PSI snapshot. */
	viewportAudit?: LighthouseViewportAudit | null;
	htmlSource?: string | null;
	/** Prior crawl result (`AuditReport.hasViewportMeta`). */
	hasViewportMeta?: boolean;
}): ViewportCheckResult {
	const viewportAudit =
		args.viewportAudit ??
		args.lighthouse?.audits?.['viewport'] ??
		null;

	const lh = lighthouseViewportOk(viewportAudit);
	if (lh === true) {
		return {
			status: 'SUCCESS',
			present: true,
			known: true,
			label: '모바일 화면 최적화 완료',
			badge: '정상',
			color: 'emerald',
		};
	}

	if (typeof args.hasViewportMeta === 'boolean' && args.hasViewportMeta) {
		return {
			status: 'SUCCESS',
			present: true,
			known: true,
			label: '모바일 화면 최적화 완료',
			badge: '정상',
			color: 'emerald',
		};
	}

	if (detectViewportInHtml(args.htmlSource)) {
		return {
			status: 'SUCCESS',
			present: true,
			known: true,
			label: '모바일 화면 최적화 완료',
			badge: '정상',
			color: 'emerald',
		};
	}

	if (typeof args.hasViewportMeta === 'boolean' && !args.hasViewportMeta) {
		// Explicit crawl miss — only treat as FAIL when LH also fails or is absent.
		if (lh === false || lh === null) {
			return {
				status: 'FAIL',
				present: false,
				known: true,
				label: '누락',
				badge: '누락',
				color: 'red',
			};
		}
	}

	if (lh === false) {
		return {
			status: 'FAIL',
			present: false,
			known: true,
			label: '누락',
			badge: '누락',
			color: 'red',
		};
	}

	return {
		status: 'WARNING',
		present: false,
		known: false,
		label: '미확인',
		badge: '재진단 권장',
		color: 'amber',
	};
}
