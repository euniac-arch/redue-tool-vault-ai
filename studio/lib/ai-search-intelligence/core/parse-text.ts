import { splitCompetitorEntities, type AsiEntityContext } from '@/lib/ai-search-intelligence/core/entity-role';
import { nameMatchesBrand, textMentionsBrand } from '@/lib/ai-search-intelligence/sov/match';
import type { AsiRecommendRank } from '@/lib/ai-search-intelligence/types';

const KO_SUFFIX = '의원|병원|클리닉|치과|한의원|피부과|성형외과|법률사무소|법무법인|로펌|호텔|리조트|식당|레스토랑|카페';
const ENTITY_SUFFIX = KO_SUFFIX;

const GENERIC_HEAD = new Set(
	[
		'다른',
		'여러',
		'인근',
		'주변',
		'근처',
		'추천',
		'유명',
		'좋은',
		'잘하는',
		'해당',
		'일부',
		'많은',
		'주요',
		'일반',
		'지역',
		'대형',
		'종합',
		'개인',
		'우리',
		'그',
		'이',
		'저',
		'타',
		'other',
		'some',
		'many',
		'local',
		'nearby',
		'recommended',
		'famous',
		'best',
		'top',
		'the',
		'our',
		'your',
		'this',
		'that',
	].map((item) => item.toLowerCase()),
);

const RECOMMEND_RE =
	/추천(합니다|드려요|해요|함|할|하는|드립니다)|1\s*위|1순위|가장\s*추천|우선\s*(추천|선택)|권장|권합니다|recommend(ed|s|ing)?|\btop\s+choice\b|\bbest\s+(option|choice|clinic|hospital)\b|\bfirst\s+choice\b|#\s*1/i;

const WEAK_MENTION_RE = /단순\s*언급|언급만|listed?\s+only|mentioned\s+only/i;

export type AsiTextParse = {
	mentions: string[];
	recommendations: string[];
	competitors: string[];
	landmarks: string[];
	brandMention: boolean;
	recommendation: boolean;
	rank: AsiRecommendRank;
};

function uniqueNames(names: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of names) {
		const name = raw.replace(/\s+/g, ' ').trim();
		if (!name) continue;
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(name);
	}
	return out;
}

function cleanName(raw: string): string {
	return raw
		.replace(/^[\s"'“”‘’·•\-–—*]+|[\s"'“”‘’·•,.;:]+$/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function isGenericName(name: string): boolean {
	const folded = name.replace(/\s+/g, '').toLowerCase();
	if (folded.length < 2) return true;
	const head = name.split(/\s+/)[0]?.toLowerCase() || '';
	if (GENERIC_HEAD.has(head) || GENERIC_HEAD.has(folded)) return true;
	if (new RegExp(`^(${ENTITY_SUFFIX})$`, 'i').test(name)) return true;
	const stem = folded.replace(new RegExp(`(?:${ENTITY_SUFFIX})$`, 'i'), '');
	if (stem && GENERIC_HEAD.has(stem)) return true;
	return false;
}

function extractSubjectEntities(text: string): string[] {
	const found: string[] = [];
	const ko = /([가-힣A-Za-z][가-힣A-Za-z0-9&'.·\s-]{0,28}?)(?:을|를|이|가|와|과)\s*(?:추천|우수|선택|고려|대안|비교)/g;
	for (const match of text.matchAll(ko)) {
		const name = cleanName(match[1] || '');
		if (name && !isGenericName(name)) found.push(name);
	}
	const en =
		/(?:recommend(?:ed|s|ing)?|compared\s+(?:to|with)|versus|vs\.?|alternative\s+to)\s+([A-Z][A-Za-z0-9&'.-]{1,28}(?:\s+[A-Z][A-Za-z0-9&'.-]{1,20}){0,3})/g;
	for (const match of text.matchAll(en)) {
		const name = cleanName(match[1] || '');
		if (name && !isGenericName(name)) found.push(name);
	}
	return found;
}

export function extractBusinessNames(text: string): string[] {
	const found: string[] = [];
	const suffixRe = new RegExp(`([가-힣A-Za-z0-9]{2,16})\\s*(${KO_SUFFIX})`, 'g');
	for (const match of text.matchAll(suffixRe)) {
		const name = cleanName(`${match[1] || ''}${match[2] || ''}`);
		if (name && !isGenericName(name)) found.push(name);
	}
	const englishRe =
		/\b([A-Z][A-Za-z0-9&'.-]{0,24}(?:\s+[A-Z][A-Za-z0-9&'.-]{0,20}){0,3})\s+(Clinic|Hospital|Dermatology|Hotel|Resort|Inn)\b/g;
	for (const match of text.matchAll(englishRe)) {
		const name = cleanName(`${match[1] || ''} ${match[2] || ''}`);
		if (name && !isGenericName(name)) found.push(name);
	}
	const listedRe = /(?:^|\n)\s*(?:\d+[\.)]|[-*•])\s*([가-힣A-Za-z][가-힣A-Za-z0-9&'.-]{1,24})/g;
	for (const match of text.matchAll(listedRe)) {
		const line = cleanName(match[1] || '');
		const nested = extractBusinessNames(line);
		if (nested.length) found.push(...nested);
		else if (line.length >= 2 && !isGenericName(line)) found.push(line);
	}
	found.push(...extractSubjectEntities(text));
	return uniqueNames(found);
}

function splitSentences(text: string): string[] {
	return text
		.split(/(?<=[.!?。\n])\s+|(?<=다\.|요\.|니다\.|습니다\.)\s+/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function rankFromText(text: string, brand: string, aliases: readonly string[]): AsiRecommendRank {
	const numbered = [...text.matchAll(/(?:^|\n)\s*([1-3])[\.)]\s*([^\n]+)/g)];
	for (const match of numbered) {
		const slot = Number(match[1]) as 1 | 2 | 3;
		if (nameMatchesBrand(match[2] || '', brand, aliases) || textMentionsBrand(match[2] || '', brand, aliases)) {
			return slot;
		}
	}
	if (new RegExp(`(?:1\\s*위|1순위|#\\s*1)[^\\n]{0,40}${escapeReg(brand)}`, 'i').test(text)) return 1;
	if (aliases.some((alias) => alias && new RegExp(`(?:1\\s*위|1순위|#\\s*1)[^\\n]{0,40}${escapeReg(alias)}`, 'i').test(text))) {
		return 1;
	}
	return null;
}

function escapeReg(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** OBSERVED parse of free-text / markdown answers. Never invents names or ranks. */
export function parseAsiAnswerText(
	text: string,
	input: AsiEntityContext & { brand: string; aliases?: readonly string[] },
): AsiTextParse {
	const aliases = input.aliases ?? [];
	const names = extractBusinessNames(text);
	const brandMention = textMentionsBrand(text, input.brand, aliases);
	const sentences = splitSentences(text);
	const recommendSentences = sentences.filter((sentence) => RECOMMEND_RE.test(sentence) && !WEAK_MENTION_RE.test(sentence));
	const recommendedNames = uniqueNames(
		recommendSentences.flatMap((sentence) =>
			names.filter((name) => textMentionsBrand(sentence, name) || sentence.includes(name)),
		),
	);
	const brandInRecommendSentence = recommendSentences.some((sentence) =>
		textMentionsBrand(sentence, input.brand, aliases),
	);
	const rank = rankFromText(text, input.brand, aliases);
	const recommendation = brandInRecommendSentence || rank === 1;
	const mentions = uniqueNames([
		...names,
		...(brandMention ? [input.brand] : []),
	]);
	const rawCompetitors = mentions.filter((name) => !nameMatchesBrand(name, input.brand, aliases));
	const split = splitCompetitorEntities(rawCompetitors, text, input);
	return {
		mentions,
		recommendations: recommendation
			? uniqueNames([...recommendedNames, input.brand])
			: recommendedNames.filter((name) => !nameMatchesBrand(name, input.brand, aliases)),
		competitors: split.competitors,
		landmarks: split.landmarks,
		brandMention,
		recommendation,
		rank,
	};
}
