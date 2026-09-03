/**
 * News titles from Google News / Naver are often cut mid-word, with or without "...".
 * Recover a longer headline from the snippet or the publisher page title.
 * Never invent words that are not in title, snippet, or page title.
 */

const TRAILING_ELLIPSIS_RE = /(?:\.{3}|…|⋯)+\s*$/;

/** One-syllable tokens that are complete words, not a cut-off stem like `열`. */
const COMPLETE_SHORT_KO = new Set([
	'첫',
	'새',
	'왜',
	'곧',
	'또',
	'더',
	'및',
	'등',
	'중',
	'후',
	'전',
	'것',
	'수',
	'때',
	'점',
	'법',
	'말',
	'값',
	'글',
	'힘',
	'꿈',
	'약',
	'세',
	'명',
	'건',
	'년',
	'월',
	'일',
	'주',
	'번',
	'곳',
	'쪽',
	'안',
	'밖',
	'위',
	'앞',
	'뒤',
	'속',
	'내',
	'외',
]);

function collapseWs(value: string): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function foldTitle(value: string): string {
	return collapseWs(value)
		.replace(/[“”„‟«»]/g, '"')
		.replace(/[‘’‚‛]/g, "'")
		.replace(/[–—−]/g, '-')
		.replace(/[・･⋅•]/g, '·');
}

function stripTrailingEllipsis(value: string): string {
	return value.replace(TRAILING_ELLIPSIS_RE, '').trim();
}

export function cleanNewsPageHeadline(value: string): string {
	return collapseWs(value)
		.replace(/\s+<\s+.*$/u, '')
		.replace(/\s+\|\s+.{1,40}$/u, '')
		.replace(/\s+[-–—:]\s+[^\s|:]{1,40}$/u, '')
		.trim();
}

export function looksTruncatedNewsTitle(title: string): boolean {
	const raw = collapseWs(title);
	if (!raw) return false;
	if (TRAILING_ELLIPSIS_RE.test(raw)) return true;
	if (/[·・･⋅•]\s*[A-Za-z0-9]?$/.test(raw)) return true;
	if (/[가-힣]+[·・･][A-Za-z]{1,3}$/.test(raw)) return true;
	if (/[가-힣][A-Za-z]$/.test(raw)) return true;
	if (/[-–—,;:·]$/.test(raw)) return true;
	if (/['"“”‘’]$/.test(raw)) return true;
	const last = raw.split(/\s+/).pop() || '';
	if (/^[가-힣]$/.test(last) && !COMPLETE_SHORT_KO.has(last)) return true;
	if (/^[A-Za-z]{1,2}$/.test(last) && !/^(a|an|i|to|of|in|on|at|by|or)$/i.test(last)) return true;
	return false;
}

/** Keep existing `...`, or append it when the feed cut the headline mid-word. */
export function withNewsTitleEllipsis(title: string): string {
	const raw = collapseWs(title);
	if (!raw) return '';
	if (TRAILING_ELLIPSIS_RE.test(raw)) return raw;
	if (looksTruncatedNewsTitle(raw)) return `${raw}...`;
	return raw;
}

function takeHeadline(from: string): string {
	const text = collapseWs(from);
	if (!text) return '';
	let end = text.length;
	const sentence = /[.!?。]\s+\S/g;
	let match: RegExpExecArray | null;
	while ((match = sentence.exec(text))) {
		if (match.index >= 12) {
			end = match.index;
			break;
		}
	}
	const sourceSep = text.search(/\s[-–—]\s+\S{2,40}\s*$/);
	const sliced = (sourceSep > 12 ? text.slice(0, sourceSep) : text.slice(0, end)).trim();
	return stripTrailingEllipsis(sliced).trim();
}

function headlineFromSnippet(title: string, snippet: string): string | null {
	const t = foldTitle(title);
	const s = foldTitle(snippet);
	if (!t || !s) return null;

	const stems = [t, stripTrailingEllipsis(t)];
	for (let drop = 1; drop <= Math.min(12, Math.max(0, t.length - 12)); drop += 1) {
		stems.push(t.slice(0, -drop));
	}

	let best: string | null = null;
	for (const stem of stems) {
		if (stem.length < 10) continue;
		const at = s.indexOf(stem);
		if (at < 0) continue;
		const candidate = takeHeadline(s.slice(at));
		if (candidate.length > t.length && candidate.startsWith(stem.slice(0, Math.min(stem.length, 16)))) {
			if (!best || candidate.length > best.length) best = candidate;
		}
	}
	return best;
}

function headlineFromPageTitle(rssTitle: string, pageTitle: string): string | null {
	const rss = foldTitle(stripTrailingEllipsis(rssTitle));
	const page = cleanNewsPageHeadline(stripTrailingEllipsis(pageTitle));
	const pageFolded = foldTitle(page);
	if (!rss || !pageFolded || pageFolded === rss) return null;
	if (looksTruncatedNewsTitle(page) && pageFolded.length <= rss.length) return null;

	if (pageFolded.startsWith(rss) && pageFolded.length > rss.length) return page;
	if (rss.length >= 6 && pageFolded.includes(rss) && pageFolded.length > rss.length) return page;

	for (let drop = 1; drop <= Math.min(16, Math.max(0, rss.length - 12)); drop += 1) {
		const stem = rss.slice(0, -drop);
		if (stem.length < 12) break;
		if (pageFolded.startsWith(stem) && pageFolded.length >= rss.length) return page;
	}
	return null;
}

export function expandTruncatedNewsTitle(title: string, snippet = '', pageTitle = ''): string {
	const raw = collapseWs(title);
	if (!raw) return '';

	const fromPage = headlineFromPageTitle(raw, pageTitle);
	const fromSnippet = headlineFromSnippet(raw, snippet);
	const ranked = [fromPage, fromSnippet]
		.filter((item): item is string => Boolean(item))
		.sort((a, b) => b.length - a.length);
	const baseline = foldTitle(stripTrailingEllipsis(raw));
	if (ranked[0] && ranked[0].length > baseline.length) return ranked[0];

	if (TRAILING_ELLIPSIS_RE.test(raw)) return stripTrailingEllipsis(raw) || raw;
	return raw;
}
