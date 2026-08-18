/**
 * HTML-source CMS heuristics (no Node/network deps — safe for audit + crawl).
 * Gnuboard 5 landing pages often omit board.php URLs, so detection must
 * read JS globals and theme asset paths from the document source.
 */

/** Gnuboard 5 JS globals + theme/core asset paths (landing pages without /bbs/). */
export const GNUBOARD_HTML_RE =
	/var\s+g5_url|var\s+g5_bbs_url|g5_is_member|g5_url\s*=|g5_bbs_url|g5_is_admin|g5_bo_table|g5_path|\/js\/wrest\.js|\/theme\/basic\/|\/theme\/[^/"'\s]+\/(?:css|js|skin)\b|gnuboard/i;

const YOUNG_CART_RE = /youngcart|yc4_|\/shop\/item\.php|\/shop\/list\.php/i;

export function isGnuboardHtml(html: string): boolean {
	if (!html) return false;
	return GNUBOARD_HTML_RE.test(html);
}

export function isYoungcartHtml(html: string): boolean {
	if (!html) return false;
	return YOUNG_CART_RE.test(html);
}

/**
 * Domestic CMS / framework / tech-stack heuristics from raw HTML.
 * Covers JSP, ASP, PHP boards, builders, and React/Next SPA signals.
 */
export function detectCmsFromHtml(html: string): string {
	const htmlString = html.toLowerCase();
	const sample = html.length > 12_000 ? html.slice(0, 12_000) : html;

	if (isGnuboardHtml(sample) || isGnuboardHtml(html)) {
		if (isYoungcartHtml(htmlString) || isYoungcartHtml(html)) {
			return '그누보드 / 영카트 (GNUBOARD)';
		}
		return '그누보드 (GNUBOARD)';
	}
	if (htmlString.includes('imweb') || htmlString.includes('cdn.imweb.me') || htmlString.includes('doothost')) {
		return '아임웹 (Imweb)';
	}
	if (htmlString.includes('cafe24') || htmlString.includes('cafe24.com')) {
		return '카페24 (Cafe24)';
	}
	if (
		htmlString.includes('wp-content') ||
		htmlString.includes('wp-includes') ||
		htmlString.includes('wordpress')
	) {
		return '워드프레스 (WordPress)';
	}
	if (
		htmlString.includes('.jsp') ||
		htmlString.includes('jsessionid') ||
		htmlString.includes('egovframe') ||
		htmlString.includes('egovframework')
	) {
		return 'JSP / 자체구축 (Legacy)';
	}
	if (
		htmlString.includes('.aspx') ||
		htmlString.includes('.asp') ||
		htmlString.includes('__viewstate') ||
		htmlString.includes('asp.net')
	) {
		return 'ASP.NET / Classic ASP';
	}
	if (
		htmlString.includes('_next') ||
		htmlString.includes('__next') ||
		htmlString.includes('__next_data__') ||
		htmlString.includes('/_next/')
	) {
		return 'Next.js / React (SPA)';
	}
	if (htmlString.includes('makeshop') || htmlString.includes('makeshop.co.kr')) {
		return '메이크샵 (Makeshop)';
	}
	if (htmlString.includes('godomall') || htmlString.includes('godo.co.kr')) {
		return '고도몰 (Godomall)';
	}

	return '자체구축 / 기타';
}

/** Map crawl/HTML detector labels onto audit-banner / solve CMS strings. */
export function toAuditCmsLabel(detected: string, lang: 'ko' | 'en' = 'ko'): string {
	const d = detected.toLowerCase();
	if (d.includes('youngcart') || detected.includes('영카트')) {
		return lang === 'ko' ? '그누보드 / 영카트' : 'Gnuboard / YoungCart';
	}
	if (d.includes('gnuboard') || detected.includes('그누보드')) {
		return lang === 'ko' ? '그누보드' : 'Gnuboard';
	}
	if (d.includes('imweb') || detected.includes('아임웹') || d.includes('doothost')) {
		return lang === 'ko' ? '아임웹' : 'Imweb';
	}
	if (d.includes('cafe24') || detected.includes('카페24')) {
		return 'Cafe24';
	}
	if (d.includes('wordpress') || detected.includes('워드프레스') || d.includes('wp-content')) {
		return 'WordPress';
	}
	if (d.includes('next.js') || d.includes('__next') || d.includes('/_next')) {
		return 'Next.js';
	}
	if (d.includes('laravel')) return 'Laravel';
	if (d.includes('makeshop') || detected.includes('메이크샵')) {
		return lang === 'ko' ? '메이크샵' : 'Makeshop';
	}
	if (d.includes('godomall') || detected.includes('고도몰')) {
		return lang === 'ko' ? '고도몰' : 'Godomall';
	}
	if (d.includes('jsp')) {
		return lang === 'ko' ? 'JSP / 자체구축' : 'JSP / custom';
	}
	if (d.includes('asp')) {
		return 'ASP.NET / Classic ASP';
	}
	return lang === 'ko' ? '커스텀 HTML/PHP' : 'Custom HTML/PHP';
}
