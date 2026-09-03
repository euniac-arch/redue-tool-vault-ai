/**
 * Industry-agnostic competitor vs landmark split.
 * Exclusion is never "always drop hotels" — it compares the entity to the
 * current target vocabulary (brand + category + industry + services).
 */
import { nameMatchesBrand } from '@/lib/ai-search-intelligence/sov/match';

export type AsiEntityContext = {
	brand?: string;
	aliases?: readonly string[];
	category?: string;
	industry?: string;
	services?: readonly string[];
};

export type AsiEntitySplit = {
	competitors: string[];
	landmarks: string[];
};

/** Peer type groups expand the *target* vocabulary. They are not exclusion lists. */
const TYPE_PEERS: readonly (readonly string[])[] = [
	['의원', '병원', '클리닉', '치과', '한의원', '피부과', '성형외과', '의료', '피부', '시술', '치료', 'clinic', 'hospital', 'dermatology'],
	['호텔', '리조트', '모텔', '펜션', '숙박', '호텔리조트', 'hotel', 'resort', 'inn', 'lodge', 'stay'],
	['식당', '레스토랑', '카페', '맛집', '음식', '외식', 'restaurant', 'cafe', 'bistro'],
	['법률사무소', '법무법인', '로펌', '변호사', '법률', 'law', 'legal'],
	['솔루션', '소프트웨어', 'saas', '플랫폼', '마케팅', '자동화', 'it'],
	['백화점', '마트', '쇼핑몰', '스토어', '유통', 'retail', 'mall', 'store'],
];

const ALL_TYPE_TOKENS = TYPE_PEERS.flat().map((item) => item.toLowerCase());

const GEO_SUFFIX =
	/(역|터미널|정류장|사거리|오거리|교차로|톨게이트|나들목|출구|공원|광장)$/i;
const GEO_IC = /(?:[가-힣0-9]+)\s*IC$/i;
const GEO_EN =
	/\b(station|terminal|bus[\s-]?stop|intersection|plaza|square|tollgate|park)\b/i;
const TRANSPORT_HINTS = ['역', '터미널', '정류장', '교통', 'station', 'terminal', 'transit', 'airport'];

const POSITIONAL_AFTER =
	/\s*(?:의\s*)?(인근|근처|부근|맞은편|건너편|도보|앞|옆|뒤|출구|위치한|near(?:by)?|opposite|across(?:\s+from)?|beside)/i;
const POSITIONAL_BEFORE =
	/(인근|근처|부근|맞은편|건너편|near(?:by)?|opposite|across(?:\s+from)?|beside|next\s+to|in\s+front\s+of)\s*/i;

const SUBJECT_PARTICLE = '(?:을|를|이|가|와|과|도|은|는)?';
const SUBJECT_PREDICATE = '(?:추천|우수|선택|고려|권장|비교|대안|대신)';
const SUBJECT_EN =
	'(?:recommend(?:ed|s|ing)?|compared\\s+(?:to|with)|versus|vs\\.?|alternative\\s+to|top\\s+choice|best\\s+(?:option|choice))';

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

function escapeReg(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function namePattern(name: string): string {
	return name
		.trim()
		.replace(/\s+/g, '')
		.split('')
		.map((char) => escapeReg(char))
		.join('\\s*');
}

function fold(value: string): string {
	return value.toLowerCase().replace(/\s+/g, '');
}

function tokensOf(...values: Array<string | undefined | null | readonly string[]>): Set<string> {
	const out = new Set<string>();
	const push = (raw: string) => {
		const trimmed = raw.trim();
		if (!trimmed) return;
		out.add(trimmed.toLowerCase());
		out.add(fold(trimmed));
		for (const part of trimmed.toLowerCase().split(/[\s,/·|]+/)) {
			if (part.length >= 2) out.add(part);
		}
		const compact = fold(trimmed);
		for (const token of ALL_TYPE_TOKENS) {
			if (compact.includes(token)) out.add(token);
		}
	};
	for (const value of values) {
		if (!value) continue;
		if (typeof value === 'string') push(value);
		else for (const item of value) push(item);
	}
	return out;
}

function expandPeerVocabulary(tokens: Set<string>): Set<string> {
	const out = new Set(tokens);
	for (const group of TYPE_PEERS) {
		const hit = group.some((item) => {
			const needle = item.toLowerCase();
			return [...tokens].some((token) => token === needle || token.includes(needle) || needle.includes(token));
		});
		if (!hit) continue;
		for (const item of group) out.add(item.toLowerCase());
	}
	return out;
}

export function targetTypeVocabulary(context: AsiEntityContext): Set<string> {
	return expandPeerVocabulary(tokensOf(context.brand, context.category, context.industry, context.services));
}

function entityTypeTokens(name: string): string[] {
	const compact = fold(name);
	return ALL_TYPE_TOKENS.filter((token) => compact.endsWith(token) || compact.includes(token));
}

function targetHasTypeSignal(vocab: Set<string>): boolean {
	return ALL_TYPE_TOKENS.some((token) => vocab.has(token));
}

function targetLooksLikeTransport(vocab: Set<string>): boolean {
	return TRANSPORT_HINTS.some((hint) => [...vocab].some((token) => token.includes(hint)));
}

export function isGeographicLandmark(name: string, context: AsiEntityContext = {}): boolean {
	if (targetLooksLikeTransport(targetTypeVocabulary(context))) return false;
	const compact = fold(name);
	return GEO_SUFFIX.test(compact) || GEO_IC.test(name.trim()) || GEO_EN.test(name);
}

export function isPositionalLandmark(name: string, text: string): boolean {
	if (!name.trim() || !text.trim()) return false;
	const escaped = namePattern(name);
	const after = new RegExp(`${escaped}${POSITIONAL_AFTER.source}`, 'i');
	const before = new RegExp(`${POSITIONAL_BEFORE.source}${escaped}`, 'i');
	return after.test(text) || before.test(text);
}

export function isRecommendOrCompareSubject(name: string, text: string): boolean {
	if (!name.trim() || !text.trim()) return false;
	const escaped = namePattern(name);
	const attached = new RegExp(`${escaped}${SUBJECT_PARTICLE}\\s*(?:의\\s*)?${SUBJECT_PREDICATE}`, 'i');
	const english = new RegExp(`${SUBJECT_EN}\\s+${escaped}`, 'i');
	const framed = new RegExp(`(?:경쟁으로(?:는)?|대안으로)\\s+${escaped}`, 'i');
	return attached.test(text) || english.test(text) || framed.test(text);
}

export function isNumberedListSubject(name: string, text: string): boolean {
	if (!name.trim()) return false;
	return new RegExp(`(?:^|\\n)\\s*(?:\\d+[\\.)]|[-*•])\\s*${namePattern(name)}`, 'i').test(text);
}

function isForeignType(name: string, vocab: Set<string>): boolean {
	const types = entityTypeTokens(name);
	if (!types.length || !targetHasTypeSignal(vocab)) return false;
	return !types.some((token) => [...vocab].some((item) => item === token || item.includes(token) || token.includes(item)));
}

export function splitCompetitorEntities(
	names: readonly string[],
	text: string,
	context: AsiEntityContext = {},
): AsiEntitySplit {
	const vocab = targetTypeVocabulary(context);
	const competitors: string[] = [];
	const landmarks: string[] = [];
	for (const name of uniqueNames(names)) {
		if (context.brand && nameMatchesBrand(name, context.brand, context.aliases ?? [])) continue;
		const geo = isGeographicLandmark(name, context);
		const positional = isPositionalLandmark(name, text);
		const subject = isRecommendOrCompareSubject(name, text);
		const foreign = isForeignType(name, vocab);
		if (geo || (positional && (foreign || !subject)) || (foreign && !subject)) {
			landmarks.push(name);
			continue;
		}
		if (foreign && subject) {
			landmarks.push(name);
			continue;
		}
		if (!entityTypeTokens(name).length && !subject && !isNumberedListSubject(name, text)) {
			continue;
		}
		competitors.push(name);
	}
	return { competitors: uniqueNames(competitors), landmarks: uniqueNames(landmarks) };
}
