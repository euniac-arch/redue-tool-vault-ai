/**
 * Search-query token extraction, stopword stripping, and [region + industry + intent]
 * recombination. Shared by the SoV query matrix so GNB/admin labels never become
 * user-facing search queries.
 */

import { extractValidSpecialties, stripUiStopwords } from '@/lib/geo/clean-medical-entities';

export type SearchQueryLang = 'ko' | 'en';

const TITLE_SPLIT = /\s*[|\-–—·•\/,;]\s*/;
const TOKEN_SPLIT = /[\s|/·,;•]+/;

const INDUSTRY_COLLOQUIAL: Array<{ test: RegExp; ko: string; en: string }> = [
	{ test: /동물병원|반려동물의료|동물의료원|veterinary|pet\s*hospital|pet\s*clinic/i, ko: '동물병원', en: 'pet hospital' },
	{ test: /치과의원|치과병원|치과|dentist|dental/i, ko: '치과', en: 'dental clinic' },
	{ test: /한의원|oriental\s*medicine/i, ko: '한의원', en: 'Korean medicine clinic' },
	{ test: /피부과|dermatolog/i, ko: '피부과', en: 'dermatology clinic' },
	{ test: /헤어\s*살롱|미용실|헤어샵|hair\s*salon/i, ko: '미용실', en: 'hair salon' },
	{ test: /학원|academy|hagwon/i, ko: '학원', en: 'academy' },
	{ test: /로펌|법무법인|변호사|attorney|law\s*firm/i, ko: '변호사', en: 'law firm' },
	{ test: /에이전시|agency/i, ko: '에이전시', en: 'agency' },
	{ test: /클리닉|clinic/i, ko: '클리닉', en: 'clinic' },
	{ test: /의원/i, ko: '의원', en: 'clinic' },
	{ test: /병원|hospital/i, ko: '병원', en: 'hospital' },
];

const SCHEMA_INDUSTRY: Record<string, { ko: string; en: string }> = {
	VeterinaryCare: { ko: '동물병원', en: 'pet hospital' },
	Dentist: { ko: '치과', en: 'dental clinic' },
	Pharmacy: { ko: '약국', en: 'pharmacy' },
	BeautySalon: { ko: '뷰티샵', en: 'beauty salon' },
	HairSalon: { ko: '미용실', en: 'hair salon' },
	HealthClub: { ko: '피트니스', en: 'gym' },
	ExerciseGym: { ko: '헬스장', en: 'gym' },
	EducationalOrganization: { ko: '학원', en: 'academy' },
	Restaurant: { ko: '맛집', en: 'restaurant' },
	CafeOrCoffeeShop: { ko: '카페', en: 'cafe' },
	Attorney: { ko: '변호사', en: 'law firm' },
	LegalService: { ko: '법률 자문', en: 'legal services' },
	AccountingService: { ko: '세무', en: 'accounting' },
	RealEstateAgent: { ko: '부동산', en: 'real estate' },
	EmploymentAgency: { ko: '에이전시', en: 'agency' },
	EventAgency: { ko: '에이전시', en: 'agency' },
	ProfessionalService: { ko: '에이전시', en: 'agency' },
};

const TRAILING_NOISE_RE = /(?:질환|질병|안내|소개)$/u;
const ANIMAL_TYPE_RE = /강아지|고양이|반려견|반려묘|애견|애묘|puppy|kitten|dog|cat/i;
const HOUR_INTENT_RE = /24\s*시|24시간|연중무휴|응급|emergency|24\s*hour/i;
const INDUSTRY_TOKEN_RE =
	/동물병원|병원|의원|치과|한의원|클리닉|학원|에이전시|살롱|미용실|약국|맛집|카페|헬스장|부동산|변호사|세무|샵|숍|hospital|clinic|agency|salon|academy/i;
const INTENT_TRAILING = new Set([
	'추천',
	'전문',
	'잘하는곳',
	'비용',
	'recommended',
	'best',
	'trusted',
	'cost',
	'specialist',
]);

export function foldQueryToken(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

function compact(value: unknown, max = 80): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function shortSchemaType(type: string): string {
	const trimmed = type.replace(/^https?:\/\/schema\.org\//i, '').trim();
	return trimmed.includes('/') ? trimmed.split('/').pop() || trimmed : trimmed;
}

/** Split a phrase into search tokens without inventing new words. */
export function tokenizeSearchPhrase(value: string): string[] {
	const source = compact(value, 120);
	if (!source) return [];
	return source
		.split(TOKEN_SPLIT)
		.map((token) => compact(token, 24))
		.filter((token) => token.length >= 2);
}

function softenSpecialtyToken(token: string): string {
	const stripped = token.replace(TRAILING_NOISE_RE, '');
	return stripped.length >= 2 ? stripped : token;
}

/**
 * Drop duplicate tokens inside a query (`병원` twice, `반려동물 병원` + `병원`).
 * Longer industry forms win over shorter leftovers (`동물병원` over `병원`).
 */
export function dedupeQueryTokens(tokens: readonly string[]): string[] {
	const normalized = tokens
		.flatMap((token) => tokenizeSearchPhrase(stripUiStopwords(token)))
		.map(softenSpecialtyToken)
		.filter((token) => token.length >= 2);

	const out: string[] = [];
	for (const token of normalized) {
		const key = foldQueryToken(token);
		if (!key) continue;
		const containedIndex = out.findIndex((existing) => {
			const prev = foldQueryToken(existing);
			return prev !== key && (prev.includes(key) || key.includes(prev));
		});
		if (containedIndex >= 0) {
			const prev = out[containedIndex]!;
			if (key.length > foldQueryToken(prev).length) out[containedIndex] = token;
			continue;
		}
		if (out.some((existing) => foldQueryToken(existing) === key)) continue;
		out.push(token);
	}
	return out;
}

const MAX_SEARCH_TOKENS = 5;
const MIN_SEARCH_TOKENS = 2;

/**
 * Join [region + industry/specialty + intent] into a 2–5 token user query.
 * Trailing intent (`추천`, `잘하는곳`) is preserved when provided.
 */
export function composeSearchQuery(
	parts: Array<string | undefined | null>,
	opts?: { maxTokens?: number; trailingIntent?: string },
): string {
	const trailing = compact(opts?.trailingIntent, 12);
	const maxTokens = Math.max(MIN_SEARCH_TOKENS, opts?.maxTokens ?? MAX_SEARCH_TOKENS);
	const body = dedupeQueryTokens(parts.filter((part): part is string => Boolean(part)));
	const intentKey = trailing ? foldQueryToken(trailing) : '';
	const withoutIntent = intentKey ? body.filter((token) => foldQueryToken(token) !== intentKey) : body;
	const budget = trailing ? Math.max(1, maxTokens - 1) : maxTokens;
	const clipped = withoutIntent.slice(0, budget);
	if (trailing) clipped.push(trailing);
	return clipped.join(' ').replace(/\s+/g, ' ').trim();
}

export function extractIndustrySearchNoun(
	input: {
		brandName?: string;
		schemaTypes?: readonly string[];
		categoryNouns?: readonly string[];
		primaryKeyword?: string;
		lang?: SearchQueryLang;
	} | null
	| undefined,
): string {
	const lang: SearchQueryLang = input?.lang === 'en' ? 'en' : 'ko';
	for (const type of input?.schemaTypes ?? []) {
		const mapped = SCHEMA_INDUSTRY[shortSchemaType(type)];
		if (mapped) return lang === 'en' ? mapped.en : mapped.ko;
	}
	const hay = [input?.brandName, ...(input?.categoryNouns ?? []), input?.primaryKeyword]
		.filter(Boolean)
		.join(' ');
	for (const row of INDUSTRY_COLLOQUIAL) {
		if (row.test.test(hay)) return lang === 'en' ? row.en : row.ko;
	}
	return '';
}

export function extractHourIntent(corpus: string, lang: SearchQueryLang = 'ko'): string {
	if (!HOUR_INTENT_RE.test(corpus)) return '';
	return lang === 'en' ? '24 hour' : '24시';
}

export function extractAnimalTypeTokens(corpus: string, lang: SearchQueryLang = 'ko'): string[] {
	if (lang === 'en') {
		const out: string[] = [];
		if (/\bdogs?\b|puppy/i.test(corpus)) out.push('dog');
		if (/\bcats?\b|kitten/i.test(corpus)) out.push('cat');
		return out;
	}
	const out: string[] = [];
	if (/강아지|반려견|애견/.test(corpus)) out.push('강아지');
	if (/고양이|반려묘|애묘/.test(corpus)) out.push('고양이');
	return out;
}

function looksLikeServiceToken(token: string): boolean {
	if (token.length < 2 || token.length > 16) return false;
	if (!/[가-힣]{2,}/.test(token) && !/^[A-Za-z][A-Za-z0-9&\-]{2,20}$/.test(token)) return false;
	return true;
}

/**
 * Priority-1 token bag: title / meta description / keywords / og:description.
 * Navigation labels are never read here.
 */
export function extractMetaQueryTokens(input: {
	title?: string;
	ogTitle?: string;
	metaDescription?: string;
	ogDescription?: string;
	metaKeywords?: string;
	limit?: number;
}): string[] {
	const bags = [input.title, input.ogTitle, input.metaKeywords, input.metaDescription, input.ogDescription];
	const raw: string[] = [];
	for (const bag of bags) {
		const source = compact(bag, 400);
		if (!source) continue;
		for (const segment of source.split(TITLE_SPLIT)) {
			raw.push(segment);
			raw.push(...tokenizeSearchPhrase(segment));
			const hangul = segment.match(/[가-힣]{2,12}/g) ?? [];
			raw.push(...hangul);
		}
	}
	return extractValidSpecialties(raw)
		.map(softenSpecialtyToken)
		.filter(looksLikeServiceToken)
		.filter((token) => tokenizeSearchPhrase(token).length <= 3)
		.slice(0, input.limit ?? 16);
}

export function isIndustryToken(value: string): boolean {
	return INDUSTRY_TOKEN_RE.test(value);
}

export function isAnimalTypeToken(value: string): boolean {
	return ANIMAL_TYPE_RE.test(value);
}

export function isIntentToken(value: string): boolean {
	return INTENT_TRAILING.has(foldQueryToken(value));
}
