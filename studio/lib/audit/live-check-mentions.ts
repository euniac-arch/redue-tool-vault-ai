/**
 * Shared brand/URL mention detectors used by both the live-check parser and
 * the 4-tier grounding evaluator. Kept in a leaf module so scoring/evaluator
 * files can import them without a circular dependency.
 */

export function brandAliases(siteName: string, siteUrl: string): string[] {
	const aliases = new Set<string>();
	const name = siteName.trim();
	if (name) {
		aliases.add(name);
		aliases.add(name.replace(/\s+/g, ''));
		const stripped = name.replace(/(의원|병원|클리닉|한의원|치과)$/u, '').trim();
		if (stripped.length >= 2) aliases.add(stripped);
	}
	try {
		const host = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`).hostname.replace(/^www\./i, '');
		if (host.length >= 3) aliases.add(host);
		const head = host.split('.')[0] || '';
		if (head.length >= 3) aliases.add(head);
	} catch {
		/* ignore malformed URLs */
	}
	return [...aliases].filter((alias) => alias.length >= 2);
}

/**
 * Negation cues checked in a window around a brand mention so that sentences
 * like "나인원의원이 언급되지 않았습니다." or "X is not mentioned" are never
 * counted as a positive citation just because the brand name appears in them.
 */
const NEGATION_CUES = [
	'언급되지',
	'언급하지',
	'언급 되지',
	'언급 안',
	'포함되지',
	'포함하지',
	'포함되어 있지',
	'추천되지',
	'추천하지',
	'추천되어 있지',
	'인용되지',
	'인용하지',
	'확인되지',
	'노출되지',
	'찾을 수 없',
	'찾지 못',
	'정보가 없',
	'정보는 없',
	'정보 없음',
	'해당사항 없',
	'않았습니다',
	'않습니다',
	'않은',
	'않고',
	'없습니다',
	'없음',
	'없는',
	'없고',
	'no mention',
	'not mention',
	"doesn't mention",
	'does not mention',
	'not recommend',
	"doesn't recommend",
	'does not recommend',
	'not cited',
	'not included',
	'not found',
	'no information',
	'not available',
	'never mention',
	"isn't mentioned",
	'is not mentioned',
	'was not mentioned',
	'not appear',
];

const NEGATION_WINDOW = 45;

function isNegatedWindow(windowLower: string): boolean {
	return NEGATION_CUES.some((cue) => windowLower.includes(cue));
}

/**
 * True when `alias` occurs in `hayLower` at least once WITHOUT a nearby
 * negation cue (i.e. a genuine positive mention, not "X가 언급되지 않았습니다").
 */
function hasPositiveMention(hayLower: string, aliasLower: string): boolean {
	if (!aliasLower) return false;
	let idx = hayLower.indexOf(aliasLower);
	while (idx !== -1) {
		const windowStart = Math.max(0, idx - NEGATION_WINDOW);
		const windowEnd = Math.min(hayLower.length, idx + aliasLower.length + NEGATION_WINDOW);
		const window = hayLower.slice(windowStart, windowEnd);
		if (!isNegatedWindow(window)) return true;
		idx = hayLower.indexOf(aliasLower, idx + aliasLower.length);
	}
	return false;
}

/**
 * Negation-aware brand/site mention check. Unlike a naive `text.includes(name)`,
 * this ignores occurrences that sit inside a negated sentence (e.g.
 * "나인원의원이 언급되지 않았습니다."), which was the root cause of ChatGPT
 * live-check false positives (isCited flipping to true on negative answers).
 */
export function mentionsBrandOrSite(text: string, siteName: string, siteUrl: string): boolean {
	const hay = text.toLowerCase();
	if (!hay) return false;
	return brandAliases(siteName, siteUrl).some((alias) => hasPositiveMention(hay, alias.toLowerCase()));
}

export function urlMatchesSite(url: string, siteUrl: string): boolean {
	const raw = url.trim();
	if (!raw) return false;
	try {
		const cited = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
		const site = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`);
		const citedHost = cited.hostname.replace(/^www\./i, '').toLowerCase();
		const siteHost = site.hostname.replace(/^www\./i, '').toLowerCase();
		return citedHost === siteHost || citedHost.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${citedHost}`);
	} catch {
		return raw.toLowerCase().includes(siteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase());
	}
}

export function detectCitedRank(text: string, siteName: string, siteUrl: string): 1 | 2 | 3 | null {
	if (!mentionsBrandOrSite(text, siteName, siteUrl)) return null;
	const aliases = brandAliases(siteName, siteUrl)
		.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('|');
	if (!aliases) return null;
	const patterns: Array<{ rank: 1 | 2 | 3; re: RegExp }> = [
		{ rank: 1, re: new RegExp(`(?:^|[\\s,.)]|1[위등.]|1st|first|#1)[^\\n]{0,40}(?:${aliases})|(?:${aliases})[^\\n]{0,24}(?:1위|1등|1st|first)`, 'i') },
		{ rank: 2, re: new RegExp(`(?:2[위등.]|2nd|second|#2)[^\\n]{0,40}(?:${aliases})|(?:${aliases})[^\\n]{0,24}(?:2위|2등|2nd|second)`, 'i') },
		{ rank: 3, re: new RegExp(`(?:3[위등.]|3rd|third|#3)[^\\n]{0,40}(?:${aliases})|(?:${aliases})[^\\n]{0,24}(?:3위|3등|3rd|third)`, 'i') },
	];
	for (const pattern of patterns) {
		if (pattern.re.test(text)) return pattern.rank;
	}
	return null;
}
