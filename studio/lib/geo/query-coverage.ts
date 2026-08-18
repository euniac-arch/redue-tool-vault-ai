/**
 * AI Query Coverage Expansion — Level 1–3 keyword spectrum after GEO patches.
 *
 * Level 1: brand exact
 * Level 2: location + category (category-insensitive)
 * Level 3: location + meta specialty + need/situation words (conversational)
 */

import {
	buildToBeCategoryKeywords,
	shouldCapAsIsToBrandOnly,
} from '@/lib/geo/as-is-honesty';
import { cleanMedicalEntities, isUiStopword } from '@/lib/geo/clean-medical-entities';
import { extractCoreSpecialties, hasStrongPlasticSignal } from '@/lib/geo/core-specialties';
import { formatColloquialLocation } from '@/lib/geo/query-location';
import type {
	ExpandedQueryCombo,
	ExpandedQueryCoverage,
	GeoSiteContext,
	PrescriptionLang,
	QueryCoverageRank,
	SchemaOrgPrimaryType,
} from '@/types/geo-prescription';

const KR_PLACES = [
	'서울',
	'부산',
	'대구',
	'인천',
	'광주',
	'대전',
	'울산',
	'세종',
	'경기',
	'강원',
	'충북',
	'충남',
	'전북',
	'전남',
	'경북',
	'경남',
	'제주',
	'수원',
	'성남',
	'용인',
	'고양',
	'창원',
	'청주',
	'천안',
	'전주',
	'안성',
	'평택',
	'안산',
	'안양',
	'부천',
	'화성',
	'김포',
	'파주',
	'의정부',
	'광명',
	'군포',
	'하남',
	'오산',
	'이천',
	'양주',
	'구리',
	'여주',
	'시흥',
	'남양주',
	'분당',
	'판교',
	'일산',
	'동탄',
	'강남',
	'서초',
	'송파',
	'마포',
	'해운대',
	'센텀',
	'서면',
] as const;

const SPECIALTY_PHRASE_KO: Array<{ test: RegExp; phrase: string }> = [
	{ test: /스포츠\s*재활|sport/i, phrase: '스포츠재활' },
	{ test: /도수/, phrase: '도수치료' },
	{ test: /정형\s*[·・\/]?\s*통증|통증\s*[·・\/]?\s*정형/, phrase: '정형·통증클리닉' },
	{ test: /정형/, phrase: '정형클리닉' },
	{ test: /통증/, phrase: '통증클리닉' },
	{ test: /아동\s*발달|소아\s*재활|발달센터/, phrase: '아동발달센터' },
	{ test: /재활/, phrase: '재활의학 클리닉' },
	{ test: /피부과|피부시술/, phrase: '피부과 클리닉' },
	{ test: /성형외과|성형수술|미용성형/, phrase: '성형외과' },
	{ test: /치과|임플란트|교정/, phrase: '치과 클리닉' },
	{ test: /한의|추나/, phrase: '한의원' },
	{ test: /내과/, phrase: '내과 클리닉' },
	{ test: /산부|산과/, phrase: '산부인과' },
	{ test: /안과/, phrase: '안과 클리닉' },
	{ test: /이비인후/, phrase: '이비인후과' },
	{ test: /중입자|탄소이온/, phrase: '중입자치료 센터' },
	{ test: /암치료|종양|항암/, phrase: '암치료 전문' },
];

const SPECIALTY_PHRASE_EN: Array<{ test: RegExp; phrase: string }> = [
	{ test: /sport|rehab/i, phrase: 'sports rehab clinic' },
	{ test: /ortho|pain/i, phrase: 'pain & orthopedic clinic' },
	{ test: /pediatric|child|develop/i, phrase: 'child development center' },
	{ test: /dental|implant/i, phrase: 'dental clinic' },
	{ test: /skin|dermat/i, phrase: 'dermatology clinic' },
	{ test: /cancer|oncolog|particle|carbon/i, phrase: 'cancer treatment center' },
];

const RELATED_CLUSTER: Array<{ test: RegExp; extrasKo: string[]; extrasEn: string[] }> = [
	{
		test: /재활|정형|도수|통증|sport|ortho|pain|rehab/i,
		extrasKo: ['정형클리닉', '통증 치료'],
		extrasEn: ['orthopedic clinic', 'pain treatment'],
	},
	{
		test: /아동|소아|발달|pediatric|child/i,
		extrasKo: ['아동발달센터', '소아재활'],
		extrasEn: ['child development center', 'pediatric rehab'],
	},
	{
		test: /치과|임플란트|교정|dental|implant/i,
		extrasKo: ['임플란트', '치아교정'],
		extrasEn: ['implants', 'orthodontics'],
	},
	{
		test: /피부과|피부시술|dermatolog|skin\s*clinic/i,
		extrasKo: ['피부과 클리닉', '리프팅'],
		extrasEn: ['dermatology clinic', 'lifting'],
	},
	{
		test: /성형외과|성형수술|미용성형|plastic\s*surg/i,
		extrasKo: ['성형외과'],
		extrasEn: ['plastic surgery'],
	},
	{
		test: /암|중입자|종양|cancer|oncolog|particle/i,
		extrasKo: ['암치료 전문', '중입자치료'],
		extrasEn: ['cancer specialists', 'particle therapy'],
	},
];

function uniq(items: string[], limit = 12): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of items) {
		const v = (raw || '').replace(/\s+/g, ' ').trim();
		if (!v || v.length < 2) continue;
		const key = v.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(v);
		if (out.length >= limit) break;
	}
	return out;
}

export function isMedicalSchema(schema: SchemaOrgPrimaryType): boolean {
	return schema === 'MedicalClinic' || schema === 'Hospital' || schema === 'Dentist' || schema === 'VeterinaryCare';
}

export function entityNoun(schema: SchemaOrgPrimaryType, lang: PrescriptionLang): string {
	const ko: Record<SchemaOrgPrimaryType, string> = {
		Dentist: '치과',
		VeterinaryCare: '동물병원',
		Hospital: '병원',
		MedicalClinic: '의원',
		LegalService: '법률사무소',
		AccountingService: '세무사무소',
		HomeAndConstructionBusiness: '인테리어 업체',
		HealthClub: '피트니스',
		EducationalOrganization: '학원',
		RealEstateAgent: '부동산',
		Restaurant: '식당',
		BeautySalon: '살롱',
		OnlineStore: '스토어',
		Store: '스토어',
		SoftwareApplication: '솔루션',
		Manufacturer: '제조사',
		LocalBusiness: '업체',
		ProfessionalService: '전문기관',
		Organization: '기업',
	};
	const en: Record<SchemaOrgPrimaryType, string> = {
		Dentist: 'dental clinic',
		VeterinaryCare: 'pet hospital',
		Hospital: 'hospital',
		MedicalClinic: 'clinic',
		LegalService: 'law firm',
		AccountingService: 'tax office',
		HomeAndConstructionBusiness: 'interior contractor',
		HealthClub: 'fitness studio',
		EducationalOrganization: 'academy',
		RealEstateAgent: 'real estate agency',
		Restaurant: 'restaurant',
		BeautySalon: 'salon',
		OnlineStore: 'store',
		Store: 'store',
		SoftwareApplication: 'software',
		Manufacturer: 'manufacturer',
		LocalBusiness: 'local business',
		ProfessionalService: 'firm',
		Organization: 'company',
	};
	return lang === 'en' ? en[schema] : ko[schema];
}

function needTermsFor(ctx: GeoSiteContext): string[] {
	const en = ctx.lang === 'en';
	const onPage = (ctx.needSignals ?? []).filter(Boolean);
	if (onPage.length) {
		const extras = en ? ['recommend', 'highly rated'] : ['추천', '잘하는 곳'];
		return Array.from(new Set([...onPage, ...extras])).slice(0, 4);
	}
	if (ctx.schemaType === 'ProfessionalService' || /상담|에이전시|agency|consult/i.test(`${ctx.category} ${ctx.primaryKeyword}`)) {
		return en ? ['consultation', 'recommend', 'trusted'] : ['상담', '추천', '믿을 수 있는 곳'];
	}
	if (isMedicalSchema(ctx.schemaType) || ctx.industryType === 'MEDICAL') {
		return en
			? ['recommend', 'highly rated', 'opening hours']
			: ['추천', '잘하는 곳', '후기'];
	}
	if (ctx.schemaType === 'Restaurant') {
		return en ? ['reservation', 'highly rated', 'atmosphere'] : ['맛집', '예약', '분위기 좋은'];
	}
	if (ctx.schemaType === 'HealthClub') {
		return en ? ['trial class', 'membership', 'recommend'] : ['체험 수업', '회원권', '추천'];
	}
	if (ctx.schemaType === 'EducationalOrganization') {
		return en ? ['enrollment', 'tuition', 'recommend'] : ['등록 상담', '수강료', '추천'];
	}
	if (ctx.schemaType === 'RealEstateAgent') {
		return en ? ['listing', 'viewing', 'recommend'] : ['매물 상담', '전월세', '추천'];
	}
	if (ctx.schemaType === 'BeautySalon') {
		return en ? ['booking', 'reviews', 'best rated'] : ['예약', '후기 좋은', '잘하는 곳'];
	}
	if (ctx.schemaType === 'OnlineStore' || ctx.schemaType === 'Store') {
		return en ? ['highly rated', 'recommend', 'open today'] : ['후기 좋은', '추천', '오늘 방문'];
	}
	if (ctx.schemaType === 'SoftwareApplication' || ctx.schemaType === 'Manufacturer' || ctx.industryType === 'B2B_MFG') {
		return en ? ['case study', 'quote', 'recommend'] : ['도입 사례', '견적', '추천'];
	}
	return en ? ['recommend', 'best rated', 'reviews'] : ['추천', '잘하는 곳', '후기'];
}

function specialtyPhrase(raw: string, ctx: GeoSiteContext): string {
	const consultAgency =
		ctx.schemaType === 'ProfessionalService' ||
		/상담|에이전시|agency|consult/i.test(`${ctx.category} ${ctx.primaryKeyword} ${ctx.businessEntity || ''} ${raw}`);
	if (consultAgency) {
		const trimmed = raw.replace(/\s+/g, ' ').trim();
		if (trimmed) return trimmed;
	}
	const maps = ctx.lang === 'en' ? SPECIALTY_PHRASE_EN : SPECIALTY_PHRASE_KO;
	for (const row of maps) {
		if (row.test.test(raw)) return row.phrase;
	}
	const noun = entityNoun(ctx.schemaType, ctx.lang);
	const trimmed = raw.replace(/\s+/g, ' ').trim();
	if (!trimmed) return noun;
	if (trimmed.includes(noun)) return trimmed;
	return ctx.lang === 'en' ? `${trimmed} ${noun}` : `${trimmed} ${noun}`;
}

function inferLocation(ctx: GeoSiteContext): string {
	if (ctx.location?.trim()) return ctx.location.trim();
	const hay = `${ctx.ogTitle || ''} ${ctx.description || ''} ${ctx.category || ''} ${ctx.targetKeywords.join(' ')}`;
	for (const place of KR_PLACES) {
		if (hay.includes(place)) return place;
	}
	return '';
}

export function clinicFacilityNoun(
	schema: SchemaOrgPrimaryType,
	brand: string,
	lang: PrescriptionLang,
): string {
	if (lang === 'en') return entityNoun(schema, lang);
	if (/병원/.test(brand) && !/의원/.test(brand)) return '병원';
	if (/의원/.test(brand) || schema === 'MedicalClinic') return '의원';
	if (schema === 'Hospital') return '병원';
	return entityNoun(schema, lang);
}

function looksLikeNoise(value: string, brand: string, location: string): boolean {
	const v = value.replace(/\s+/g, ' ').trim();
	if (v.length < 2 || v.length > 28) return true;
	if (isUiStopword(v)) return true;
	if (brand && v === brand) return true;
	if (location && v === location) return true;
	if (/^https?:/i.test(v) || /\.(com|kr|net|ai)\b/i.test(v)) return true;
	if (/믿을 만한|trusted provider|공식 사이트|official site/i.test(v)) return true;
	return false;
}

export function extractSpecialties(ctx: Pick<GeoSiteContext, 'brandName' | 'location' | 'category' | 'primaryKeyword' | 'targetKeywords' | 'description' | 'ogTitle' | 'ogDescription' | 'lang' | 'schemaType' | 'industryType'> & {
	title?: string;
	metaKeywords?: string;
	navMenuTexts?: string[];
	specialties?: string[];
}): string[] {
	const brand = ctx.brandName;
	const loc = ctx.location;
	const onPage = [ctx.title, ctx.ogTitle, ctx.ogDescription, ctx.description, ctx.metaKeywords, ...(ctx.navMenuTexts ?? [])]
		.filter(Boolean)
		.join(' · ');
	const plasticOk = hasStrongPlasticSignal(onPage);
	const ranked = extractCoreSpecialties({
		title: ctx.title || ctx.ogTitle,
		metaKeywords: ctx.metaKeywords,
		navMenuTexts: ctx.navMenuTexts,
		description: ctx.description,
		ogTitle: ctx.ogTitle,
		ogDescription: ctx.ogDescription,
		schemaTerms: ctx.targetKeywords,
		targetKeywords: ctx.targetKeywords,
		category: ctx.category,
		primaryKeyword: ctx.primaryKeyword,
		lang: ctx.lang,
	}).filter((kw) => !looksLikeNoise(kw, brand, loc));

	if (ranked.length) return cleanMedicalEntities(ranked, { plasticOk, limit: 3 });

	const corpus = [ctx.ogTitle, ctx.ogDescription, ctx.description, ctx.category, ctx.primaryKeyword, ...ctx.targetKeywords]
		.filter(Boolean)
		.join(' · ');

	const fromKeywords = ctx.targetKeywords
		.flatMap((kw) => kw.split(/[,|/·]/))
		.map((kw) => (loc ? kw.replace(new RegExp(loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '') : kw).trim())
		.filter((kw) => !looksLikeNoise(kw, brand, loc))
		.filter((kw) => plasticOk || !/성형외과|plastic/i.test(kw));

	const extras: string[] = [];
	for (const cluster of RELATED_CLUSTER) {
		if (cluster.test.test(corpus)) {
			if (/성형|plastic/i.test(cluster.test.source) && !plasticOk) continue;
			extras.push(...(ctx.lang === 'en' ? cluster.extrasEn : cluster.extrasKo));
		}
	}

	const seed = [ctx.primaryKeyword, ctx.category, ...fromKeywords, ...extras].filter(
		(v): v is string => Boolean(v && !looksLikeNoise(v, brand, loc) && (plasticOk || !/성형외과|plastic/i.test(v))),
	);

	return cleanMedicalEntities(uniq(seed, 6), { plasticOk, limit: 3 });
}

function pickDistinctSpecialty(specialties: string[], used: string[]): string | undefined {
	const usedKey = new Set(used.map((s) => s.toLowerCase()));
	const unused = specialties.filter((s) => !usedKey.has(s.toLowerCase()));
	if (!unused.length) return undefined;
	const painLike = /재활|정형|도수|통증|sport|ortho|pain|rehab/i;
	const childLike = /아동|소아|발달|pediatric|child/i;
	const usedPain = used.some((u) => painLike.test(u));
	if (usedPain) {
		const other = unused.find((s) => childLike.test(s) || !painLike.test(s));
		if (other) return other;
	}
	return unused[0];
}

function conversationalQuery(tokens: string[], loc: string, lang: PrescriptionLang): string {
	const body = tokens.filter((t) => t && t !== loc).join(' ');
	if (lang === 'en') {
		return loc
			? `Can you recommend a place in ${loc} for ${body}?`
			: `Can you recommend a place for ${body}?`;
	}
	return loc ? `${loc} ${body} 추천해줘` : `${body} 추천해줘`;
}

function combo(
	id: string,
	tokens: string[],
	rank: QueryCoverageRank,
	loc: string,
	lang: PrescriptionLang,
): ExpandedQueryCombo {
	const clean = uniq(tokens, 6);
	return {
		id,
		level: 3,
		tokens: clean,
		display: clean.join(' + '),
		query: conversationalQuery(clean, loc, lang),
		rank,
	};
}

function insightFor(attributes: string[], lang: PrescriptionLang): string {
	const listed = attributes.slice(0, 3).map((a) => `'${a}'`).join(', ');
	if (lang === 'en') {
		return `Schema and FAQ patches now let AI cite ${listed || 'new service attributes'} with confidence as a top-ranked recommendation.`;
	}
	return `스키마 및 FAQ 패치로 AI가 ${listed || '세부 서비스'} 속성까지 확신을 갖고 1순위 추천 답변으로 인용하기 시작했습니다.`;
}

function beforeSummary(brand: string, examples: string[], lang: PrescriptionLang, brandOnly: boolean): string {
	const quoted = examples.map((q) => `"${q}"`).join(', ');
	if (lang === 'en') {
		return brandOnly
			? `Word limit: only the brand name is currently recognized (${quoted}). Category queries are not exposed yet.`
			: `Word limit: only the brand name and simple keywords were recognized (${quoted}).`;
	}
	return brandOnly
		? `단어 제한: 현재 노출 가능한 쿼리는 브랜드명(Level 1)뿐입니다 (${quoted}). 카테고리 질의는 미노출입니다.`
		: `단어 제한: 브랜드명 및 단순 키워드만 인식 (${quoted})`;
}

/**
 * Builds the before/after AI query spectrum for the currently selected site.
 * Combos are derived from live brand / location / meta specialties — never hardcoded clinics.
 */
export function buildExpandedQueryCoverage(ctx: GeoSiteContext): ExpandedQueryCoverage {
	const lang = ctx.lang;
	const brand = ctx.brandName.trim() || ctx.domain;
	const loc = formatColloquialLocation(inferLocation(ctx));
	const rawCategory = (ctx.primaryKeyword || ctx.category || entityNoun(ctx.schemaType, lang)).trim();
	const category = loc
		? rawCategory.replace(new RegExp(`^${loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '').trim() || rawCategory
		: rawCategory;
	const specialties = extractSpecialties({ ...ctx, location: loc });
	const needs = needTermsFor(ctx);

	const level1 = brand;
	const level2 = loc ? `${loc} ${category}`.trim() : category;
	const specLabel = specialtyPhrase(category, ctx);
	const extraNeed = needs[0] && !/추천|recommend/i.test(needs[0]) && !specLabel.includes(needs[0]) ? needs[0] : '';
	const level3 = loc
		? lang === 'en'
			? `Can you recommend a place in ${loc} for ${specLabel}${extraNeed ? ` (${extraNeed})` : ''}?`
			: `${loc}에서 ${specLabel}${extraNeed ? ` ${extraNeed}` : ''} 잘하는 곳 추천해줘`
		: lang === 'en'
			? `Can you recommend a place for ${specLabel}${extraNeed ? ` (${extraNeed})` : ''}?`
			: `${specLabel}${extraNeed ? ` ${extraNeed}` : ''} 잘하는 곳 추천해줘`;

	const specA = specialties.find((s) => s !== category) || specialties[0] || category;
	const specB = pickDistinctSpecialty(specialties, [category, specA]) ||
		needs[needs.length - 1] ||
		(lang === 'en' ? 'highly rated' : '후기 좋은 곳');

	const afterCombos: ExpandedQueryCombo[] = [
		combo(
			'l3-primary',
			[loc, needs[0], specialtyPhrase(category, ctx)].filter(Boolean),
			1,
			loc,
			lang,
		),
		combo(
			'l3-specialty',
			[
				loc,
				specialtyPhrase(specA, ctx),
				/재활|정형|도수|통증|sport|ortho|pain|rehab/i.test(`${category} ${specA}`)
					? lang === 'en'
						? 'pain treatment specialist'
						: '통증 치료 잘하는 곳'
					: lang === 'en'
						? 'highly rated'
						: '잘하는 곳',
			].filter(Boolean),
			1,
			loc,
			lang,
		),
		combo(
			'l3-need',
			[loc, specialtyPhrase(specB, ctx), needs[needs.length - 1] || (lang === 'en' ? 'opening hours' : '진료 시간')].filter(
				Boolean,
			),
			2,
			loc,
			lang,
		),
	];

	const relatedCorpus = [category, ...specialties, ctx.description, ctx.ogTitle].filter(Boolean).join(' ');
	const painLike = /재활|정형|도수|통증|sport|ortho|pain|rehab/i.test(relatedCorpus);
	const insightAttributes = uniq(
		[
			needs[0],
			isMedicalSchema(ctx.schemaType) && painLike
				? lang === 'en'
					? 'pain clinic'
					: '통증클리닉'
				: specialtyPhrase(specA, ctx),
			...specialties.slice(0, 2),
		].filter((v) => v && v !== category),
		4,
	);

	const brandOnly = ctx.brandOnlyAsIs ?? shouldCapAsIsToBrandOnly({
		brandName: brand,
		title: ctx.ogTitle,
		corpus: `${ctx.ogTitle || ''} ${ctx.ogDescription || ''} ${ctx.description || ''}`,
		category,
		primaryKeyword: ctx.primaryKeyword,
		businessEntity: ctx.businessEntity,
		schemaType: ctx.schemaType,
		existingSchemaTypes: ctx.existingSchemaTypes,
	});
	const toBeKeywords = buildToBeCategoryKeywords({
		lang,
		location: loc,
		category,
		primaryKeyword: ctx.primaryKeyword,
		brandName: brand,
		businessEntity: ctx.businessEntity,
		needSignals: ctx.needSignals,
		specialties,
	});
	const beforeQueries = brandOnly ? uniq([brand], 4) : uniq([brand, level2], 4);

	return {
		brandName: brand,
		location: loc,
		category,
		specialties,
		needTerms: needs,
		insightAttributes,
		spectrum: { level1, level2, level3 },
		beforeQueries,
		beforeSummary: beforeSummary(brand, beforeQueries, lang, brandOnly),
		afterCombos,
		insight: insightFor(insightAttributes, lang),
		toBeKeywords,
		brandOnlyAsIs: brandOnly,
	};
}

export function attributeTagLabels(coverage: ExpandedQueryCoverage, lang: PrescriptionLang): string[] {
	const attrs = coverage.insightAttributes.length ? coverage.insightAttributes : coverage.needTerms;
	return attrs.slice(0, 2).map((attr) => {
		const compact = attr.replace(/\s+/g, '');
		return lang === 'en' ? `${compact}_attribute_added` : `${compact}_속성_추가`;
	});
}

export function isExpandedQueryCoverage(raw: unknown): raw is ExpandedQueryCoverage {
	if (!raw || typeof raw !== 'object') return false;
	const obj = raw as Record<string, unknown>;
	return Array.isArray(obj.afterCombos) && Array.isArray(obj.beforeQueries) && typeof obj.insight === 'string';
}

