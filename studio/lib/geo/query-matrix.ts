/**
 * Site-audit → keyword slots → Level 1–3 / SoV query matrix.
 *
 * Shared by the SoV leaderboard, AI trigger simulation, and GEO Answer Center.
 * Never emits an intent-modifier-only query; SoV / simulation targets always
 * include at least one category noun.
 */

import { extractValidSpecialties, isUiStopword } from '@/lib/geo/clean-medical-entities';
import {
	classifyMetaKeywords,
	collectBrandEntities,
	extractServicePhrases,
	isBrandStopword,
	type BrandEntitySet,
} from '@/lib/geo/brand-entities';
import { extractCoreSpecialties } from '@/lib/geo/core-specialties';
import { formatColloquialLocation } from '@/lib/geo/query-location';

export type QueryMatrixLang = 'ko' | 'en';

/** Flattened crawl / diagnosis packet accepted by the generator. */
export interface SiteAuditData {
	lang?: QueryMatrixLang;
	brandName?: string;
	category?: string;
	primaryKeyword?: string;
	location?: string;
	broadLocation?: string;
	businessEntity?: string;
	entityPhrases?: readonly string[];
	needSignals?: readonly string[];
	coreSpecialties?: readonly string[];
	detectedKeywords?: readonly string[];
	schemaKnowsAbout?: readonly string[];
	schemaEntityTypes?: readonly string[];
	schemaTypes?: readonly string[];
	title?: string;
	ogTitle?: string;
	metaDescription?: string;
	ogDescription?: string;
	metaKeywords?: string;
	representativeName?: string;
	ogSiteName?: string;
	domain?: string;
	navMenuTexts?: readonly string[];
	h1Texts?: readonly string[];
	h2Texts?: readonly string[];
	jsonLdSnippets?: readonly string[];
	nap?: {
		name?: string;
		address?: string;
		addressLocality?: string;
		addressRegion?: string;
	};
	siteMeta?: SiteAuditData | null;
	metrics?: {
		schemaTypes?: readonly string[];
		jsonLdSnippets?: readonly string[];
		pageTitle?: string;
		documentTitle?: string;
		ogTitle?: string;
		ogDescription?: string;
		metaDescription?: string;
		h1Texts?: readonly string[];
		h2Texts?: readonly string[];
	} | null;
}

export interface KeywordSlots {
	brandName: string;
	categoryNouns: string[];
	intentModifiers: string[];
	/** Colloquial geo token; omitted when NAP / meta has no place. */
	location?: string;
}

export interface QueryMatrix {
	slots: KeywordSlots;
	level1: string[];
	level2: string[];
	level3: string[];
	/** Ranking / simulation targets — every item contains ≥1 categoryNoun. */
	sovTargets: string[];
	/** Three SoV leaderboard chips. */
	sovPresets: [string, string, string];
	/** Representative singles for existing Level 1–3 consumers. */
	triggerQueries: { level1: string; level2: string; level3: string };
	/** Answer Center / prescription keyword list (category nouns only). */
	targetKeywords: string[];
}

export const INTENT_MODIFIERS_KO = ['믿을 만한 곳', '잘하는 곳', '추천', '비용', '전문'] as const;
export const INTENT_MODIFIERS_EN = ['trusted', 'best', 'recommended', 'cost', 'specialist'] as const;

const TITLE_SPLIT = /\s*[|\-–—·•\/,;]\s*/;
const GENERIC_NOUNS = new Set([
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
	'동네 업체',
	'organization',
	'website',
	'webpage',
	'localbusiness',
	'home',
	'메인',
	'소개',
	'about',
	'contact',
	'문의',
]);

const SCHEMA_TYPE_NOUN: Record<string, { ko: string; en: string; generic?: boolean }> = {
	Dentist: { ko: '치과', en: 'dental clinic' },
	MedicalClinic: { ko: '의원', en: 'medical clinic', generic: true },
	Physician: { ko: '병원', en: 'physician practice', generic: true },
	Hospital: { ko: '병원', en: 'hospital', generic: true },
	VeterinaryCare: { ko: '반려동물 병원', en: 'pet hospital' },
	Pharmacy: { ko: '약국', en: 'pharmacy' },
	BeautySalon: { ko: '뷰티 살롱', en: 'beauty salon' },
	HairSalon: { ko: '헤어 살롱', en: 'hair salon' },
	HealthClub: { ko: '피트니스', en: 'health club' },
	ExerciseGym: { ko: '헬스장', en: 'gym' },
	EducationalOrganization: { ko: '학원', en: 'academy' },
	Restaurant: { ko: '맛집', en: 'restaurant' },
	CafeOrCoffeeShop: { ko: '카페', en: 'cafe' },
	RealEstateAgent: { ko: '부동산', en: 'real estate' },
	Store: { ko: '매장', en: 'store', generic: true },
	Attorney: { ko: '법률 자문', en: 'law firm' },
	LegalService: { ko: '법률 자문', en: 'legal services' },
	AccountingService: { ko: '세무/회계', en: 'accounting' },
	SoftwareApplication: { ko: '소프트웨어', en: 'software' },
	Product: { ko: '제품 제조', en: 'product manufacturing' },
	EventAgency: { ko: '에이전시', en: 'agency' },
	EmploymentAgency: { ko: '에이전시', en: 'agency' },
	ProfessionalService: { ko: '에이전시', en: 'agency' },
};

const BIZ_TYPE_NOUN_RE = /에이전시|의원|병원|치과|클리닉|학원|salon|agency|clinic|hospital|dental/i;
const LOCAL_VERTICAL_RE = /치과|의원|병원|피부과|한의원|클리닉|도수|추나|재활|정형|임플란트|dental|clinic|therapy|ortho/i;

function clean(value: unknown, max = 60): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function fold(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

function uniq(items: readonly string[], limit = 12): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = clean(raw, 40);
		if (!v || v.length < 2) continue;
		const key = fold(v);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(v);
		if (out.length >= limit) break;
	}
	return out;
}

function shortSchemaType(type: string): string {
	const trimmed = type.replace(/^https?:\/\/schema\.org\//i, '').trim();
	return trimmed.includes('/') ? trimmed.split('/').pop() || trimmed : trimmed;
}

function flattenAuditData(input: SiteAuditData | null | undefined): SiteAuditData {
	const nested = input?.siteMeta;
	const metrics = input?.metrics;
	return {
		lang: input?.lang || nested?.lang,
		brandName: input?.brandName || nested?.brandName,
		category: input?.category || nested?.category,
		primaryKeyword: input?.primaryKeyword || nested?.primaryKeyword,
		location: input?.location || nested?.location,
		broadLocation: input?.broadLocation || nested?.broadLocation,
		businessEntity: input?.businessEntity || nested?.businessEntity,
		entityPhrases: input?.entityPhrases ?? nested?.entityPhrases,
		needSignals: input?.needSignals ?? nested?.needSignals,
		coreSpecialties: input?.coreSpecialties ?? nested?.coreSpecialties,
		detectedKeywords: input?.detectedKeywords ?? nested?.detectedKeywords,
		schemaKnowsAbout: input?.schemaKnowsAbout ?? nested?.schemaKnowsAbout,
		schemaEntityTypes: input?.schemaEntityTypes ?? nested?.schemaEntityTypes ?? metrics?.schemaTypes,
		schemaTypes: input?.schemaTypes ?? metrics?.schemaTypes ?? nested?.schemaEntityTypes,
		title: input?.title || nested?.title || metrics?.documentTitle || metrics?.pageTitle,
		ogTitle: input?.ogTitle || nested?.ogTitle || metrics?.ogTitle,
		metaDescription: input?.metaDescription || nested?.metaDescription || metrics?.metaDescription,
		ogDescription: input?.ogDescription || nested?.ogDescription || metrics?.ogDescription,
		metaKeywords: input?.metaKeywords || nested?.metaKeywords,
		representativeName: input?.representativeName || nested?.representativeName,
		ogSiteName: input?.ogSiteName || nested?.ogSiteName,
		domain: input?.domain || nested?.domain,
		navMenuTexts: input?.navMenuTexts ?? nested?.navMenuTexts,
		h1Texts: input?.h1Texts ?? metrics?.h1Texts,
		h2Texts: input?.h2Texts ?? nested?.h2Texts ?? metrics?.h2Texts,
		jsonLdSnippets: input?.jsonLdSnippets ?? metrics?.jsonLdSnippets,
		nap: input?.nap || nested?.nap,
	};
}

function intentSet(lang: QueryMatrixLang): readonly string[] {
	return lang === 'en' ? INTENT_MODIFIERS_EN : INTENT_MODIFIERS_KO;
}

function isIntentOnly(phrase: string, lang: QueryMatrixLang): boolean {
	const key = fold(phrase);
	if (!key) return true;
	return intentSet(lang).some((mod) => fold(mod) === key);
}

function looksLikeLocation(phrase: string, location?: string): boolean {
	const key = fold(phrase);
	if (!key) return false;
	if (location) {
		const loc = fold(location);
		if (key === loc) return true;
		if (loc.includes(key) && key.length >= 2 && loc.length - key.length <= 4) return true;
	}
	return /특별시|광역시|특별자치/.test(phrase) || (/^[가-힣]{1,3}(시|군|구)$/.test(phrase) && !/에이전|전시|공시/.test(phrase));
}

function stripBrandAndLocation(phrase: string, brandName: string, location?: string): string {
	let next = phrase;
	if (brandName) {
		const brandRe = new RegExp(brandName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
		next = next.replace(brandRe, ' ');
	}
	if (location) {
		const locRe = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
		next = next.replace(locRe, ' ');
	}
	return clean(next, 40);
}

/**
 * Rank and clean morph / meta tokens into industry nouns.
 * Drops brand, geo, UI chrome, and intent-only modifiers.
 */
export function refineCategoryNouns(
	raw: readonly string[],
	opts?: {
		brandName?: string;
		location?: string;
		lang?: QueryMatrixLang;
		limit?: number;
		brandEntities?: BrandEntitySet;
	},
): string[] {
	const lang = opts?.lang === 'en' ? 'en' : 'ko';
	const brand = clean(opts?.brandName, 80);
	const location = clean(opts?.location, 40);
	const entities = opts?.brandEntities;
	const scored = new Map<string, { phrase: string; score: number }>();

	for (const token of raw) {
		const stripped = stripBrandAndLocation(clean(token, 40), brand, location);
		if (stripped.length < 2) continue;
		if (isUiStopword(stripped) || GENERIC_NOUNS.has(stripped.toLowerCase())) continue;
		if (isIntentOnly(stripped, lang)) continue;
		if (looksLikeLocation(stripped, location)) continue;
		if (brand && fold(stripped) === fold(brand)) continue;
		if (entities && isBrandStopword(stripped, entities)) continue;
		if (!/[가-힣]{2,}/.test(stripped) && !/^[A-Za-z][A-Za-z0-9 &\-/]{2,30}$/.test(stripped)) continue;

		const key = fold(stripped);
		const prior = scored.get(key);
		const score = stripped.length + (/[가-힣]{2,}/.test(stripped) ? 4 : 0);
		if (!prior || score > prior.score) scored.set(key, { phrase: stripped, score });
	}

	const ranked = [...scored.values()].sort((a, b) => b.score - a.score).map((row) => row.phrase);
	const compact: string[] = [];
	for (const phrase of ranked) {
		if (compact.some((existing) => fold(existing) === fold(phrase))) continue;
		compact.push(phrase);
		if (compact.length >= (opts?.limit ?? 8)) break;
	}
	return extractValidSpecialties(compact);
}

function tokenizeTitleNouns(text: string): string[] {
	const source = clean(text, 200);
	if (!source) return [];
	const parts = source.split(TITLE_SPLIT).flatMap((seg) => seg.split(/\s+/));
	const hangul = source.match(/[가-힣]{2,12}/g) ?? [];
	return uniq([...parts, ...hangul], 24);
}

function extractOfferCatalogNouns(snippets: readonly string[] | undefined): string[] {
	if (!snippets?.length) return [];
	const names: string[] = [];

	const walk = (node: unknown, depth = 0): void => {
		if (!node || depth > 8) return;
		if (Array.isArray(node)) {
			for (const item of node) walk(item, depth + 1);
			return;
		}
		if (typeof node !== 'object') return;
		const rec = node as Record<string, unknown>;
		const type = String(rec['@type'] ?? '');
		const inCatalog = /OfferCatalog|Offer|Service/i.test(type) || 'hasOfferCatalog' in rec;
		if (inCatalog && typeof rec.name === 'string') names.push(rec.name);
		if (rec.itemOffered) walk(rec.itemOffered, depth + 1);
		if (rec.hasOfferCatalog) walk(rec.hasOfferCatalog, depth + 1);
		if (rec.availableService) walk(rec.availableService, depth + 1);
		if (rec.itemListElement) walk(rec.itemListElement, depth + 1);
		if (rec.item) walk(rec.item, depth + 1);
	};

	for (const raw of snippets) {
		const text = clean(raw, 8_000);
		if (!text) continue;
		if (/hasOfferCatalog|OfferCatalog|availableService|itemOffered/i.test(text)) {
			try {
				walk(JSON.parse(text));
			} catch {
				const nameRe = /"(?:name|itemOffered)"\s*:\s*"([^"]{2,40})"/g;
				let match: RegExpExecArray | null;
				while ((match = nameRe.exec(text))) names.push(match[1]);
			}
		}
	}
	return uniq(names, 8);
}

function nounsFromSchemaTypes(types: readonly string[] | undefined, lang: QueryMatrixLang): string[] {
	if (!types?.length) return [];
	const out: string[] = [];
	for (const type of types) {
		const mapped = SCHEMA_TYPE_NOUN[shortSchemaType(type)];
		if (!mapped || mapped.generic) continue;
		out.push(lang === 'en' ? mapped.en : mapped.ko);
	}
	return uniq(out, 4);
}

function resolveLocation(data: SiteAuditData): string | undefined {
	const napBits = [data.nap?.addressRegion, data.nap?.addressLocality, data.nap?.address]
		.map((v) => clean(v, 40))
		.filter(Boolean);
	const raw = clean(data.location, 40) || clean(data.broadLocation, 40) || napBits.join(' ');
	const colloquial = formatColloquialLocation(raw);
	return colloquial || undefined;
}

function joinQuery(...parts: Array<string | undefined>): string {
	return parts
		.map((part) => clean(part, 80))
		.filter(Boolean)
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** True when the query contains at least one category noun (never intent-only). */
export function queryHasCategoryNoun(query: string, categoryNouns: readonly string[]): boolean {
	const q = fold(query);
	if (!q || !categoryNouns.length) return false;
	return categoryNouns.some((noun) => {
		const n = fold(noun);
		return n.length >= 2 && q.includes(n);
	});
}

function adoptValid(query: string, nouns: readonly string[], lang: QueryMatrixLang, bag: string[]): void {
	const compact = clean(query, 80);
	if (!compact || isIntentOnly(compact, lang)) return;
	if (!queryHasCategoryNoun(compact, nouns)) return;
	if (bag.some((item) => fold(item) === fold(compact))) return;
	bag.push(compact);
}

export function extractKeywordSlots(siteAuditData: SiteAuditData | null | undefined): KeywordSlots {
	const data = flattenAuditData(siteAuditData);
	const lang: QueryMatrixLang = data.lang === 'en' ? 'en' : 'ko';
	const brandName = clean(data.brandName || data.nap?.name, 80);
	const location = resolveLocation(data);
	const schemaTypes = [...(data.schemaTypes ?? []), ...(data.schemaEntityTypes ?? [])];
	const brandEntities = collectBrandEntities({
		brandName,
		name: data.nap?.name,
		title: data.title,
		ogTitle: data.ogTitle,
		ogSiteName: data.ogSiteName,
		keywords: data.metaKeywords,
		keywordList: data.detectedKeywords,
		description: [data.metaDescription, data.ogDescription].filter(Boolean).join(' '),
		representativeName: data.representativeName,
		domain: data.domain,
	});
	const classified = classifyMetaKeywords({
		brandName,
		name: data.nap?.name,
		title: data.title || data.ogTitle,
		keywords: data.metaKeywords,
		keywordList: data.detectedKeywords,
		description: [data.metaDescription, data.ogDescription].filter(Boolean).join(' '),
		representativeName: data.representativeName,
		domain: data.domain,
	});

	const specialtyHits = extractCoreSpecialties({
		title: data.title,
		metaKeywords: data.metaKeywords,
		navMenuTexts: data.navMenuTexts,
		description: data.metaDescription,
		ogTitle: data.ogTitle,
		ogDescription: data.ogDescription,
		schemaTerms: [...(data.schemaKnowsAbout ?? []), ...schemaTypes],
		targetKeywords: classified.categoryNouns,
		category: data.category,
		primaryKeyword: data.primaryKeyword,
		h2Texts: data.h2Texts,
		lang,
	});

	const morphPool = [
		...tokenizeTitleNouns(data.ogTitle || ''),
		...tokenizeTitleNouns(data.title || ''),
		...tokenizeTitleNouns(data.metaKeywords || ''),
		...(data.h1Texts ?? []).flatMap((h) => tokenizeTitleNouns(h)),
	];

	const categoryNouns = refineCategoryNouns(
		[
			...classified.categoryNouns,
			...extractServicePhrases(data.metaDescription),
			...extractServicePhrases(data.ogDescription),
			...extractServicePhrases(data.metaKeywords),
			...(data.coreSpecialties ?? []),
			...specialtyHits,
			...extractOfferCatalogNouns(data.jsonLdSnippets),
			...nounsFromSchemaTypes(schemaTypes, lang),
			data.businessEntity,
			data.primaryKeyword,
			data.category,
			...(data.entityPhrases ?? []),
			...(data.schemaKnowsAbout ?? []),
			...(data.navMenuTexts ?? []),
			...morphPool,
		],
		{ brandName, location, lang, limit: 8, brandEntities },
	);

	return {
		brandName,
		categoryNouns,
		intentModifiers: [...intentSet(lang)],
		...(location ? { location } : {}),
	};
}

function assembleLevel1(slots: KeywordSlots): string[] {
	return slots.brandName ? [slots.brandName] : [];
}

function assembleLevel2(slots: KeywordSlots, lang: QueryMatrixLang): string[] {
	const out: string[] = [];
	const nouns = slots.categoryNouns;
	const loc = slots.location;
	for (const noun of nouns) {
		if (loc) adoptValid(joinQuery(loc, noun), nouns, lang, out);
		for (const modifier of slots.intentModifiers) {
			adoptValid(joinQuery(noun, modifier), nouns, lang, out);
			if (loc) adoptValid(joinQuery(loc, noun, modifier), nouns, lang, out);
		}
	}
	return out;
}

function assembleLevel3(slots: KeywordSlots, lang: QueryMatrixLang): string[] {
	const out: string[] = [];
	const nouns = slots.categoryNouns;
	const loc = slots.location;
	const consult = lang === 'en' ? 'quote/consult specialist recommendation' : '견적/상담 잘하는 곳 추천해줘';

	for (const noun of nouns) {
		for (const modifier of slots.intentModifiers.slice(0, 3)) {
			if (lang === 'en') {
				if (loc) adoptValid(`Where is a good ${noun} ${modifier} in ${loc}?`, nouns, lang, out);
				else adoptValid(`Where is a good ${noun} ${modifier}?`, nouns, lang, out);
			} else if (loc) {
				adoptValid(joinQuery(loc, noun, modifier, '어디가 좋아?'), nouns, lang, out);
			} else {
				adoptValid(joinQuery(noun, modifier, '어디가 좋아?'), nouns, lang, out);
			}
		}
		adoptValid(joinQuery(noun, consult), nouns, lang, out);
	}
	return out;
}

function preferLocalPrefix(nouns: readonly string[], location?: string): string {
	if (!location) return '';
	const corpus = nouns.join(' ');
	return LOCAL_VERTICAL_RE.test(corpus) ? location : '';
}

function complementaryNouns(nouns: readonly string[], limit = 3): string[] {
	const out: string[] = [];
	for (const noun of nouns) {
		if (out.some((existing) => fold(existing).includes(fold(noun)) || fold(noun).includes(fold(existing)))) {
			continue;
		}
		out.push(noun);
		if (out.length >= limit) break;
	}
	return out;
}

function pickIndustryNoun(nouns: readonly string[]): string {
	return nouns.find((noun) => BIZ_TYPE_NOUN_RE.test(noun)) || nouns[0] || '';
}

const CORE_INDUSTRY_SEEDS = ['행사', '섭외', '에이전시', 'event', 'booking', 'agency'] as const;
const DETAIL_SERVICE_SEEDS = ['연예인 섭외', '연예인', '현장 운영', '행사 기획'] as const;
const TAIL_SERVICE_SEEDS = ['행사 기획', '현장 운영', '행사 대행'] as const;

function firstMatchingPhrase(nouns: readonly string[], seeds: readonly string[]): string {
	for (const seed of seeds) {
		const hit = nouns.find((noun) => fold(noun) === fold(seed) || fold(noun).includes(fold(seed)));
		if (hit) return seed.length <= hit.length && fold(hit).includes(fold(seed)) ? seed : hit;
	}
	return '';
}

function assembleSovPhrases(nouns: readonly string[]): { core: string; detail: string; tail: string } {
	const parts = complementaryNouns(nouns, 4);
	const industry = pickIndustryNoun(nouns);
	const canCompound = Boolean(industry && BIZ_TYPE_NOUN_RE.test(industry) && parts.length >= 2);
	const seededCore = CORE_INDUSTRY_SEEDS.filter((seed) =>
		nouns.some((noun) => fold(noun).includes(fold(seed)) || fold(seed).includes(fold(noun))),
	);
	const core = canCompound
		? (seededCore.length >= 2 ? seededCore.slice(0, 3).join(' ') : parts.slice(0, 3).join(' '))
		: parts[0] || industry;
	const detail =
		firstMatchingPhrase(nouns, DETAIL_SERVICE_SEEDS) ||
		parts.find((noun) => fold(noun) !== fold(parts[0] || '') && fold(noun) !== fold(industry)) ||
		parts[1] ||
		parts[0] ||
		core;
	const tail =
		TAIL_SERVICE_SEEDS.filter((seed) =>
			nouns.some((noun) => fold(noun).includes(fold(seed)) || fold(seed).includes(fold(noun))),
		).join(' ') ||
		(canCompound && parts.length >= 2 ? parts.filter((noun) => fold(noun) !== fold(industry)).slice(0, 3).join(' ') : '') ||
		parts[1] ||
		parts[0] ||
		core;
	return { core, detail, tail };
}

function pickSovPresets(slots: KeywordSlots, level2: string[], lang: QueryMatrixLang): [string, string, string] {
	const nouns = slots.categoryNouns;
	const loc = preferLocalPrefix(nouns, slots.location);
	const { core, detail, tail } = assembleSovPhrases(nouns);
	const industry = pickIndustryNoun(nouns);
	const recommend = lang === 'en' ? 'recommended' : '추천';
	const best = '잘하는곳';

	const first = core ? joinQuery(loc, core, recommend) : '';
	const second =
		industry && BIZ_TYPE_NOUN_RE.test(industry) && fold(detail) !== fold(industry)
			? joinQuery(loc, detail, industry)
			: joinQuery(loc, detail || core);
	const third =
		lang === 'en'
			? joinQuery('best', tail || detail || core, loc ? `in ${loc}` : '')
			: joinQuery(loc, tail || detail || core, best);

	const fallbacks = [first, second, third, ...level2].filter((q) => queryHasCategoryNoun(q, nouns));
	return [fallbacks[0] || '', fallbacks[1] || fallbacks[0] || '', fallbacks[2] || fallbacks[1] || fallbacks[0] || ''];
}

/**
 * Build Level 1–3 queries and SoV targets from crawled site diagnosis data.
 * Site-specific hardcoding is not used — slots come from Title / Meta / JSON-LD / NAP.
 */
export function generateQueryMatrix(siteAuditData: SiteAuditData | null | undefined): QueryMatrix {
	const data = flattenAuditData(siteAuditData);
	const lang: QueryMatrixLang = data.lang === 'en' ? 'en' : 'ko';
	const slots = extractKeywordSlots(data);
	const level1 = assembleLevel1(slots);
	const level2 = assembleLevel2(slots, lang);
	const level3 = assembleLevel3(slots, lang);
	const sovTargets = [...level2, ...level3].filter((q) => queryHasCategoryNoun(q, slots.categoryNouns));
	const sovPresets = pickSovPresets(slots, level2, lang);
	const triggerQueries = {
		level1: level1[0] || slots.brandName,
		level2: level2[0] || '',
		level3: level3[0] || '',
	};

	return {
		slots,
		level1,
		level2,
		level3,
		sovTargets,
		sovPresets,
		triggerQueries,
		targetKeywords: slots.categoryNouns,
	};
}
