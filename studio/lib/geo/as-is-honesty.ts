/**
 * As-Is honesty gates for GEO trigger diagnosis.
 *
 * Consult / research / agency sites, and sites with weak category indexing,
 * must not claim Level 2 appearance on queries such as “서초구 암치료 클리닉”.
 * Those keywords belong only in the post-prescription (To-Be) range.
 */

import type { GeoReputationSignals } from '@/lib/audit/geo-score';
import { specialtyQueryNoun } from '@/lib/geo/core-specialties';
import {
	flattenToBeKeywordPack,
	parseQueryLocation,
	uniqQueryPhrases,
	type ToBeKeywordPack,
} from '@/lib/geo/query-location';

const CONSULT_RESEARCH_RE =
	/연구소|컨설팅|상담소|에이전시|agency|consult(?:ing|ation)?|research(?:\s*institute)?/i;

const WALK_IN_CLINIC_RE = /의원|병원|클리닉|clinic|hospital|한의원|치과/i;

const CLINIC_SCHEMA_RE = /MedicalClinic|Hospital|Dentist|VeterinaryCare|Physician/i;

const CANCER_HAY_RE = /암|중입자|종양|항암|cancer|oncolog|particle|carbon/i;

export type HonestyLang = 'ko' | 'en';

export interface HonestySiteInput {
	brandName?: string;
	title?: string;
	corpus?: string;
	category?: string;
	primaryKeyword?: string;
	businessEntity?: string;
	schemaType?: string;
	existingSchemaTypes?: readonly string[];
	signals?: Pick<GeoReputationSignals, 'orgComplete' | 'faqPresent' | 'geoPct' | 'schemaPct' | 'schemaTypes'> | null;
	/** QA fixture: a walk-in clinic may keep a measured Level 2 As-Is. */
	allowCategoryAsIs?: boolean;
}

export function isWalkInClinicBrand(brandName: string): boolean {
	const brand = (brandName || '').trim();
	if (!brand) return false;
	return WALK_IN_CLINIC_RE.test(brand) && !CONSULT_RESEARCH_RE.test(brand);
}

/**
 * True when the site itself is consulting / research / agency —
 * not a walk-in hospital or clinic. Partner-hospital mentions in the
 * body must not flip this to “clinic”.
 */
export function isConsultResearchAgency(input: HonestySiteInput): boolean {
	const brand = input.brandName || '';
	if (isWalkInClinicBrand(brand)) return false;

	const identity = `${brand} ${input.title || ''} ${input.businessEntity || ''}`;
	if (CONSULT_RESEARCH_RE.test(identity)) return true;
	if (input.schemaType === 'ProfessionalService') return true;

	const hay = `${identity} ${input.category || ''} ${input.primaryKeyword || ''} ${input.corpus || ''}`;
	const consultLike = /에이전시|상담|컨설팅|연구소|agency|consult/i.test(hay);
	const ownClinicNoun = WALK_IN_CLINIC_RE.test(brand) || WALK_IN_CLINIC_RE.test(input.title || '');
	return consultLike && !ownClinicNoun;
}

/**
 * Category+location queries need a medical/local schema plus a supporting
 * NAP / FAQ / GEO signal. Missing those means the site is not indexed as
 * a general-category candidate.
 */
export function hasInsufficientCategoryIndex(input: HonestySiteInput): boolean {
	const types = [
		...(input.existingSchemaTypes || []),
		...(input.signals?.schemaTypes || []),
		input.schemaType || '',
	].join(' ');
	const hasClinicSchema = CLINIC_SCHEMA_RE.test(types);
	const geo = input.signals?.geoPct ?? 0;
	const orgComplete = input.signals?.orgComplete ?? false;
	const faq = input.signals?.faqPresent ?? false;
	if (hasClinicSchema && (orgComplete || faq || geo >= 60)) return false;
	return true;
}

export function shouldCapAsIsToBrandOnly(input: HonestySiteInput): boolean {
	if (input.allowCategoryAsIs && isWalkInClinicBrand(input.brandName || '')) return false;
	if (isConsultResearchAgency(input)) return true;
	return hasInsufficientCategoryIndex(input);
}

export interface ToBeKeywordInput {
	lang: HonestyLang;
	location?: string;
	category?: string;
	primaryKeyword?: string;
	brandName?: string;
	businessEntity?: string;
	needSignals?: readonly string[];
	/** Ranked 1–3 on-page specialties — drives region + service To-Be queries. */
	specialties?: readonly string[];
}

function serviceNoun(hay: string, fallback: string, lang: HonestyLang): string {
	if (lang === 'en') {
		if (CANCER_HAY_RE.test(hay)) return 'cancer treatment clinic';
		return (fallback || 'clinic').replace(/\s+/g, ' ').trim();
	}
	const cat = fallback.replace(/\s+/g, ' ').trim();
	if (cat && /클리닉|의원|병원|센터|연구소|상담/i.test(cat)) return cat;
	if (CANCER_HAY_RE.test(hay)) return '암치료 클리닉';
	if (!cat) return '클리닉';
	return `${cat} 클리닉`;
}

function coreTechPhrase(hay: string, fallback: string, lang: HonestyLang): string {
	if (lang === 'en') {
		if (/중입자|탄소이온|carbon[-\s]?ion|particle/i.test(hay)) return 'carbon-ion institute';
		if (CANCER_HAY_RE.test(hay)) return 'cancer treatment center';
		return (fallback || 'specialist clinic').replace(/\s+/g, ' ').trim();
	}
	if (/중입자|탄소이온/i.test(hay) && /연구소|컨설팅|상담/i.test(hay)) return '중입자 연구소';
	if (/중입자|탄소이온/i.test(hay)) return '중입자치료';
	if (CANCER_HAY_RE.test(hay)) return '암치료 전문';
	const cat = fallback.replace(/\s+/g, ' ').trim();
	return cat || '전문 기관';
}

function nationwidePhrases(hay: string, fallback: string, lang: HonestyLang): string[] {
	if (lang === 'en') {
		if (/중입자|탄소이온|carbon[-\s]?ion|particle/i.test(hay)) {
			return ['recommended carbon-ion cancer treatment', 'Japan carbon-ion therapy consultation'];
		}
		if (CANCER_HAY_RE.test(hay)) return ['recommended cancer treatment', 'cancer treatment consultation'];
		const cat = (fallback || 'service').replace(/\s+/g, ' ').trim();
		return [`recommended ${cat}`, `${cat} consultation`];
	}
	if (/중입자|탄소이온/i.test(hay)) {
		const phrases = ['중입자 암치료 추천'];
		if (/해외|일본|상담|연계/i.test(hay)) phrases.push('국내 일본 중입자치료 연계 상담');
		else phrases.push('중입자치료 상담');
		return phrases;
	}
	if (CANCER_HAY_RE.test(hay)) return ['암치료 추천', '암치료 상담'];
	const cat = fallback.replace(/\s+/g, ' ').trim() || '서비스';
	const consult = /상담|컨설팅|연구소|agency|consult/i.test(hay);
	const medicalLike = WALK_IN_CLINIC_RE.test(hay) || /피부과|성형|치과|한의|재활|도수|통증|정형/.test(hay);
	return consult
		? [`${cat} 상담`, `${cat} 안내`]
		: [`${cat} 안내`, medicalLike ? `${cat} 진료 안내` : `${cat} 정보 안내`];
}

/**
 * Post-prescription (To-Be) keywords — three complementary patterns, not one
 * copied “region + category” template:
 *   1. local:    [단축지역] + [세부지역] + [서비스/클리닉]
 *   2. metro:    [광역/중심지] + [핵심 기술/기관]
 *   3. nationwide: [핵심 서비스] + [추천/상담/잘하는곳]
 */
function regionSpecialtyCluster(
	input: ToBeKeywordInput,
	loc: ReturnType<typeof parseQueryLocation>,
): ToBeKeywordPack | null {
	const specs = (input.specialties || []).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
	const consultLike = /연구소|컨설팅|상담소|에이전시|agency|consult/i.test(
		`${input.brandName || ''} ${input.businessEntity || ''} ${input.category || ''}`,
	);
	const cancerLike = CANCER_HAY_RE.test(`${input.category || ''} ${input.primaryKeyword || ''} ${input.businessEntity || ''}`);
	if (consultLike || cancerLike || !specs.length) return null;

	const region = loc.colloquial || loc.localFocus;
	if (!region) return null;

	const main = specialtyQueryNoun(specs[0], input.lang);
	const sub = specs[1] ? specialtyQueryNoun(specs[1], input.lang) : '';
	const third = specs[2] ? specialtyQueryNoun(specs[2], input.lang) : '';
	const evening = (input.needSignals || []).some((n) => /야간|evening/i.test(n));

	if (input.lang === 'en') {
		const local = uniqQueryPhrases([`${region} ${main} recommend`, sub ? `${region} ${sub}` : `${region} ${main} clinic`], 4);
		const metro = uniqQueryPhrases([`${region} ${main}`, third ? `${region} ${third}` : `${region} ${main} rehab`], 3);
		const nationwide = uniqQueryPhrases(
			[`${region} ${main} highly rated`, evening ? `${region} ${main} evening hours` : `${region} ${main} reviews`],
			4,
		);
		return { local, metro, nationwide, all: flattenToBeKeywordPack({ local, metro, nationwide, all: [] }) };
	}

	const medicalLike =
		WALK_IN_CLINIC_RE.test(`${input.brandName || ''} ${input.category || ''} ${main} ${sub} ${third}`) ||
		/피부과|성형|치과|한의|재활|도수|통증|정형/.test(`${main} ${sub} ${third} ${input.category || ''}`);
	const local = uniqQueryPhrases(
		[medicalLike ? `${region} ${main} 안내` : `${region} ${main} 추천`, sub ? `${region} ${sub}` : `${region} ${main} 클리닉`],
		4,
	);
	const metro = uniqQueryPhrases(
		[`${region} ${main}`, third ? `${region} ${third}` : `${region} ${main} 재활`],
		3,
	);
	const nationwideLead = /성형외과/.test(main)
		? `${region} ${main} 위치 및 진료시간 안내`
		: medicalLike
			? `${region} ${main} 진료 안내`
			: `${region} ${main} 안내`;
	const nationwide = uniqQueryPhrases(
		[
			nationwideLead,
			evening ? `${region} ${main} 야간진료` : /재활|정형|도수|통증/.test(`${main} ${sub} ${third}`)
				? `${region} ${main} 재활`
				: `${region} ${main} 정보 안내`,
		],
		4,
	);
	return { local, metro, nationwide, all: flattenToBeKeywordPack({ local, metro, nationwide, all: [] }) };
}

export function buildToBeKeywordPack(input: ToBeKeywordInput): ToBeKeywordPack {
	const loc = parseQueryLocation(input.location || '');
	const fromSpecialties = regionSpecialtyCluster(input, loc);
	if (fromSpecialties) return fromSpecialties;

	const hay = `${input.category || ''} ${input.primaryKeyword || ''} ${input.brandName || ''} ${input.businessEntity || ''} ${(input.needSignals || []).join(' ')}`;
	const fallback = (input.category || input.primaryKeyword || '').replace(/\s+/g, ' ').trim();
	const service = serviceNoun(hay, fallback, input.lang);
	const tech = coreTechPhrase(hay, fallback, input.lang);
	const empty: ToBeKeywordPack = { local: [], metro: [], nationwide: [], all: [] };

	if (input.lang === 'en') {
		const city = loc.colloquial || loc.metro;
		const local = uniqQueryPhrases(
			[
				city ? `${city} ${service}` : service,
				loc.localFocus && loc.localFocus !== city ? `${loc.localFocus} ${service}` : '',
			],
			4,
		);
		const metro = uniqQueryPhrases([city ? `${city} ${tech}` : tech], 3);
		const nationwide = uniqQueryPhrases(nationwidePhrases(hay, fallback, 'en'), 4);
		return { local, metro, nationwide, all: flattenToBeKeywordPack({ local, metro, nationwide, all: [] }) };
	}

	if (!service && !fallback) return empty;

	const local = uniqQueryPhrases(
		[
			loc.colloquial ? `${loc.colloquial} ${service}` : '',
			loc.district ? `${loc.district} ${service}` : '',
			!loc.colloquial && !loc.district ? service : '',
			loc.localFocus ? `${loc.localFocus} ${CANCER_HAY_RE.test(hay) ? '암치료 추천' : `${fallback || service} 추천`}` : '',
		],
		4,
	);
	const metro = uniqQueryPhrases(
		[loc.metro ? `${loc.metro} ${tech}` : tech, loc.metro && tech !== service ? `${loc.metro} ${fallback || service}` : ''],
		3,
	);
	const nationwide = uniqQueryPhrases(nationwidePhrases(hay, fallback, 'ko'), 4);
	return { local, metro, nationwide, all: flattenToBeKeywordPack({ local, metro, nationwide, all: [] }) };
}

export function buildToBeCategoryKeywords(input: ToBeKeywordInput): string[] {
	return buildToBeKeywordPack(input).all;
}

export function categoryDisplacementWarning(input: {
	lang: HonestyLang;
	categoryQuery: string;
	recommendQuery: string;
	medicalField?: boolean;
}): string {
	const cat = input.categoryQuery;
	const rec = input.recommendQuery;
	if (input.lang === 'en') {
		const rival = input.medicalField ? 'large hospitals/clinics' : 'better-documented competitors';
		return `When non-brand category queries such as “${cat}” or “${rec}” were tested, the site is currently crowded out by ${rival} and missing from AI recommendations.`;
	}
	const rival = input.medicalField ? '대형병원/의원' : '상위 노출 업체';
	return `비브랜드 카테고리 질의(‘${cat}’, ‘${rec}’)를 테스트하면 현재 ${rival}에 밀려 AI 추천에서 누락·미노출됩니다.`;
}

export function isMedicalHonestyField(input: HonestySiteInput): boolean {
	const hay = `${input.brandName || ''} ${input.category || ''} ${input.primaryKeyword || ''} ${input.businessEntity || ''} ${input.corpus || ''}`;
	return CANCER_HAY_RE.test(hay) || /의료|병원|의원|클리닉|치료|medical|clinic|hospital/i.test(hay);
}
