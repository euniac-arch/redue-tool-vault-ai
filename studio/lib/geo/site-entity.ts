/**
 * Site-entity parsing for GEO trigger queries.
 *
 * Builds brand / specialty / need phrases from crawled Title, Meta, headings,
 * and body snippets — never from static “야간 클리닉” style templates.
 */

import { isConsultResearchAgency } from '@/lib/geo/as-is-honesty';
import { formatColloquialLocation } from '@/lib/geo/query-location';

export type EntityLang = 'ko' | 'en';

export interface SiteEntityCorpus {
	title?: string;
	metaDescription?: string;
	ogTitle?: string;
	ogDescription?: string;
	headings?: readonly string[];
	bodySnippets?: readonly string[];
	keywords?: readonly string[];
	brandName?: string;
	primaryKeyword?: string;
	category?: string;
	location?: string;
	lang?: EntityLang;
}

export interface SiteEntityProfile {
	/** Most specific on-page business phrase (e.g. 해외 중입자 치료 상담). */
	businessEntity: string;
	entityPhrases: string[];
	/** Need/situation words that actually appear on the page. */
	needSignals: string[];
	/** True when the page is a consult/agency, not a walk-in clinic. */
	isConsultAgency: boolean;
	corpus: string;
}

const TITLE_SPLIT = /\s*[|\-–—·•\/]\s*/;

const GENERIC = new Set([
	'전문 서비스',
	'professional services',
	'서비스',
	'service',
	'services',
	'업체',
	'사이트',
	'홈페이지',
	'공식',
	'official',
	'welcome',
	'지역 비즈니스',
	'local business',
	'동네 추천',
	'local recommendation',
	'믿을 만한 곳',
	'trusted provider',
	'home',
	'메인',
	'소개',
	'about',
	'contact',
	'문의',
]);

const NEED_LEXICON: Array<{ test: RegExp; ko: string; en: string }> = [
	{ test: /야간\s*진료|야간에도|야간\s*운영|evening\s*hours|open\s*late/i, ko: '야간진료', en: 'evening hours' },
	{ test: /주말\s*진료|weekend/i, ko: '주말진료', en: 'weekend hours' },
	{ test: /상담|consultation|consulting/i, ko: '상담', en: 'consultation' },
	{ test: /해외|overseas|abroad/i, ko: '해외', en: 'overseas' },
	{ test: /에이전시|agency/i, ko: '에이전시', en: 'agency' },
	{ test: /후기|리뷰|reviews?/i, ko: '후기', en: 'reviews' },
	{ test: /예약|booking|reservation/i, ko: '예약', en: 'booking' },
	{ test: /견적|quote|quotation/i, ko: '견적', en: 'quote' },
	{ test: /도입\s*사례|case\s*study/i, ko: '도입 사례', en: 'case study' },
];

const ENTITY_PHRASES: Array<{ test: RegExp; ko: string; en: string }> = [
	{ test: /해외\s*중입자\s*치료\s*상담/i, ko: '해외 중입자 치료 상담', en: 'overseas carbon-ion therapy consultation' },
	{ test: /해외\s*중입자/i, ko: '해외 중입자 치료', en: 'overseas carbon-ion therapy' },
	{ test: /중입자\s*치료\s*상담/i, ko: '중입자 치료 상담', en: 'carbon-ion therapy consultation' },
	{ test: /중입자\s*치료|중입자|탄소이온|carbon[-\s]?ion|proton[-\s]?therap/i, ko: '중입자 치료', en: 'carbon-ion therapy' },
	{ test: /암치료\s*상담|암\s*상담/i, ko: '암치료 상담', en: 'cancer-treatment consultation' },
	{ test: /암치료|암센터|oncolog|cancer\s*(clinic|center|treatment)/i, ko: '암치료', en: 'cancer treatment' },
	{ test: /스포츠\s*재활/i, ko: '스포츠재활', en: 'sports rehabilitation' },
	{ test: /도수치료/i, ko: '도수치료', en: 'manual therapy' },
	{ test: /아동\s*발달|발달센터/i, ko: '아동발달센터', en: 'child development center' },
	{ test: /정형\s*[·・\/]?\s*통증|통증클리닉/i, ko: '정형·통증클리닉', en: 'ortho-pain clinic' },
	{ test: /정형외과/i, ko: '정형외과', en: 'orthopedics' },
];

function cleanText(value: unknown, max = 80): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function joinCorpus(input: SiteEntityCorpus): string {
	return [
		input.title,
		input.ogTitle,
		input.metaDescription,
		input.ogDescription,
		...(input.headings ?? []),
		...(input.bodySnippets ?? []),
		...(input.keywords ?? []),
		input.primaryKeyword,
		input.category,
	]
		.filter(Boolean)
		.join(' · ');
}

function uniq(items: string[], limit = 10): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = cleanText(raw, 40);
		if (!v || v.length < 2) continue;
		const key = v.toLowerCase();
		if (seen.has(key) || GENERIC.has(key)) continue;
		seen.add(key);
		out.push(v);
		if (out.length >= limit) break;
	}
	return out;
}

export function extractNeedSignals(corpus: string, lang: EntityLang = 'ko'): string[] {
	const out: string[] = [];
	for (const row of NEED_LEXICON) {
		if (row.test.test(corpus)) out.push(lang === 'en' ? row.en : row.ko);
	}
	return uniq(out, 8);
}

function phraseFromLexicon(corpus: string, lang: EntityLang): string {
	for (const row of ENTITY_PHRASES) {
		if (row.test.test(corpus)) return lang === 'en' ? row.en : row.ko;
	}
	return '';
}

function serviceSegment(input: SiteEntityCorpus, brandName: string): string {
	const brandNorm = brandName.replace(/\s+/g, '').toLowerCase();
	const segments = [
		...(input.title || '').split(TITLE_SPLIT),
		...(input.ogTitle || '').split(TITLE_SPLIT),
		...(input.headings ?? []),
	];
	for (const raw of segments) {
		const cleaned = cleanText(raw, 32);
		if (!cleaned || cleaned.length < 3) continue;
		const norm = cleaned.replace(/\s+/g, '').toLowerCase();
		if (brandNorm && (norm === brandNorm || brandNorm.includes(norm))) continue;
		if (GENERIC.has(cleaned.toLowerCase())) continue;
		if (/추천|잘하는|베스트|best|official|welcome/i.test(cleaned)) continue;
		if (/중입자|암치료|상담|치료|재활|도수|정형|통증|아동|발달|치과|피부과|성형외과|에이전시|agency|therapy|consult/i.test(cleaned)) {
			return cleaned;
		}
	}
	return '';
}

function composeFromModifiers(corpus: string, keyword: string, lang: EntityLang): string {
	const parts: string[] = [];
	const hasOverseas = /해외|overseas|abroad/i.test(corpus);
	const hasConsult = /상담|consultation/i.test(corpus);
	const hasAgency = /에이전시|agency/i.test(corpus);
	const clinicNoun = /의원|병원|클리닉|clinic|hospital/i.test(corpus);

	if (hasOverseas && !/해외|overseas/i.test(keyword)) {
		parts.push(lang === 'en' ? 'overseas' : '해외');
	}
	parts.push(keyword);
	if (hasConsult && !/상담|consult/i.test(keyword)) {
		parts.push(lang === 'en' ? 'consultation' : '상담');
	}
	if (hasAgency && !clinicNoun && !/에이전시|agency/i.test(keyword)) {
		parts.push(lang === 'en' ? 'agency' : '에이전시');
	}
	return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function isConsultAgencyCorpus(corpus: string, brandName = ''): boolean {
	return isConsultResearchAgency({ brandName, corpus, title: corpus });
}

/**
 * Resolve the on-page business entity used in Level 2/3 queries.
 * Prefers title/H1 service segments, then known specialty phrases, then modifiers + keyword.
 */
export function buildSiteEntityProfile(input: SiteEntityCorpus): SiteEntityProfile {
	const lang: EntityLang = input.lang === 'en' ? 'en' : 'ko';
	const corpus = joinCorpus(input);
	const brand = cleanText(input.brandName, 40);
	const seedKeyword = cleanText(input.primaryKeyword || input.category, 40);
	const fromSegment = serviceSegment(input, brand);
	const fromLexicon = phraseFromLexicon(`${fromSegment} ${corpus}`, lang);
	const composed = seedKeyword ? composeFromModifiers(corpus, seedKeyword, lang) : '';

	let businessEntity = fromSegment || fromLexicon || composed || seedKeyword;
	if (fromLexicon && fromSegment && fromSegment.length > fromLexicon.length + 8) {
		businessEntity = fromSegment;
	} else if (fromLexicon && (!fromSegment || fromLexicon.length >= 4)) {
		const refined = composeFromModifiers(corpus, fromLexicon, lang);
		businessEntity = refined || fromLexicon;
	}

	if (!businessEntity || GENERIC.has(businessEntity.toLowerCase())) {
		businessEntity = seedKeyword || (lang === 'en' ? 'services' : '서비스');
	}

	const entityPhrases = uniq(
		[businessEntity, fromSegment, fromLexicon, seedKeyword, input.category, ...(input.keywords ?? [])].filter(
			(v): v is string => Boolean(v),
		),
		8,
	);

	return {
		businessEntity: cleanText(businessEntity, 36),
		entityPhrases,
		needSignals: extractNeedSignals(corpus, lang),
		isConsultAgency: isConsultResearchAgency({
			brandName: brand,
			title: input.title || input.ogTitle,
			corpus,
			category: input.category,
			primaryKeyword: input.primaryKeyword,
		}),
		corpus,
	};
}

export function resolveQueryEntity(
	profile: Pick<SiteEntityProfile, 'businessEntity'>,
	fallbackKeyword: string,
	fallbackCategory = '',
): string {
	const entity = (profile.businessEntity || '').trim();
	if (entity && !GENERIC.has(entity.toLowerCase())) return entity;
	const keyword = (fallbackKeyword || '').trim();
	if (keyword && !GENERIC.has(keyword.toLowerCase())) return keyword;
	const category = (fallbackCategory || '').trim();
	if (category && !GENERIC.has(category.toLowerCase())) return category;
	return keyword || category || entity;
}

/**
 * Level 3 conversational query — only uses need words found on the page.
 * Does not invent evening-hours / clinic nouns.
 */
export function buildConversationalQuery(input: {
	lang: EntityLang;
	location?: string;
	entity: string;
	needSignals?: readonly string[];
}): string {
	const loc = formatColloquialLocation(input.location || '');
	const entity = (input.entity || '').trim();
	const needs = input.needSignals ?? [];
	const hasEvening = needs.some((n) => /야간|evening/i.test(n));
	const hasConsult = needs.some((n) => /상담|consult/i.test(n));
	const entityHasConsult = /상담|consult/i.test(entity);

	if (input.lang === 'en') {
		const extra = hasEvening ? ' Ideally open in the evening.' : hasConsult && !entityHasConsult ? ' I need a consultation.' : '';
		return loc
			? `Can you recommend a trusted place in ${loc} for ${entity}?${extra}`.replace(/\s+/g, ' ').trim()
			: `Can you recommend a trusted place for ${entity}?${extra}`.replace(/\s+/g, ' ').trim();
	}

	if (hasConsult || entityHasConsult) {
		const focus = entityHasConsult ? entity : `${entity} 상담`;
		return loc ? `${loc}에서 ${focus} 받을 수 있는 곳 추천해줘` : `${focus} 받을 수 있는 곳 추천해줘`;
	}
	if (hasEvening) {
		return loc
			? `${loc}에서 ${entity} 잘하고 야간에도 이용 가능한 곳 추천해줘`
			: `${entity} 잘하고 야간에도 이용 가능한 곳 추천해줘`;
	}
	return loc ? `${loc}에서 ${entity} 잘하는 곳 추천해줘` : `${entity} 잘하는 곳 추천해줘`;
}

export function buildCategoryQuery(location: string, entity: string): string {
	const loc = formatColloquialLocation(location);
	const focus = entity.trim();
	if (loc && focus && !focus.startsWith(loc)) return `${loc} ${focus}`.replace(/\s+/g, ' ').trim();
	return focus || loc;
}

export function buildBrandQuery(brandName: string, lang: EntityLang): string {
	const brand = brandName.trim();
	return lang === 'en' ? `${brand} official site` : `${brand} 위치`;
}

export function profileFromText(corpus: string, lang: EntityLang = 'ko', extras?: Partial<SiteEntityCorpus>): SiteEntityProfile {
	return buildSiteEntityProfile({
		...extras,
		metaDescription: extras?.metaDescription || corpus,
		lang,
	});
}
