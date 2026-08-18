/**
 * Industry → recommended Schema.org types, aligned 1:1 with the
 * GEO Citation Algorithm 3-step badges and the universal industry registry:
 *   Step 1  registry.schemaType            — location & brand entity
 *   Step 2  FAQPage / QAPage               — Q&A citation unit
 *   Step 3  Person / Organization          — E-E-A-T publisher trust
 */

import { detectIndustry, getIndustryProfile } from '@/lib/registry/universalIndustryRegistry';

export type SchemaVertical =
	| 'medical-clinic'
	| 'medical-hospital'
	| 'dental'
	| 'legal'
	| 'local'
	| 'b2b'
	| 'news'
	| 'general';

export type GeoAlgorithmStep = 1 | 2 | 3;

export const GEO_ALGORITHM_STEP_BADGES: Record<GeoAlgorithmStep, string> = {
	1: 'LocalBusiness / MedicalClinic',
	2: 'FAQPage / QAPage',
	3: 'Person / Organization',
};

const STEP1_ENTITY = /^(LocalBusiness|MedicalClinic|MedicalBusiness|Dentist|Hospital|Physician|VeterinaryCare|LegalService|Attorney|AccountingService|BeautySalon|HomeAndConstructionBusiness|HealthClub|ExerciseGym|EducationalOrganization|RealEstateAgent|Restaurant|ProfessionalService|Organization)$/i;
const STEP2_QA = /^(FAQPage|QAPage)$/i;
const STEP3_EEAT = /^(Person|Organization)$/i;
const NEWS_ARTICLE_RE = /^(NewsArticle|Article|BlogPosting)$/i;

export interface SchemaMappingInput {
	industry?: string;
	category?: string;
	siteTitle?: string;
	brandName?: string;
	domain?: string;
	primaryKeyword?: string;
	industryType?: string;
	schemaTypes?: readonly string[];
}

export function detectSchemaVertical(input: SchemaMappingInput): SchemaVertical {
	const hay = [
		input.industry,
		input.category,
		input.siteTitle,
		input.brandName,
		input.domain,
		input.primaryKeyword,
		input.industryType,
		(input.schemaTypes ?? []).join(' '),
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();

	if (isNewsMediaVertical(input)) return 'news';
	if (/법률|변호사|법무|attorney|law\s*firm|legalservice/.test(hay)) return 'legal';
	if (/치과|dental|implant|임플란트|dentist/.test(hay)) return 'dental';
	if (/종합병원|university hospital|tertiary|상급종합/.test(hay)) return 'medical-hospital';
	if (
		/의료|의원|병원|클리닉|피부|성형|한의|정형|통증|재활|clinic|hospital|medical|physician|veterinary|동물병원/.test(
			hay,
		) ||
		input.industryType === 'MEDICAL'
	) {
		return 'medical-clinic';
	}
	if (/쇼핑|커머스|쇼핑몰|store|shop|ecommerce|product/.test(hay) || input.industryType === 'LOCAL_STORE') {
		return 'local';
	}
	if (/제조|공장|haccp|manufactur|factory|b2b|소프트웨어|saas|platform/.test(hay) || input.industryType === 'B2B_MFG') {
		return 'b2b';
	}
	return 'general';
}

/** Press / media / newsroom — the only vertical that should require NewsArticle. */
export function isNewsMediaVertical(input: SchemaMappingInput): boolean {
	const domain = (input.domain || '').toLowerCase();
	const hay = [input.industry, input.category, input.siteTitle, input.brandName, input.primaryKeyword]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
	if (/\b(news|media|press|times|herald|daily|journal)\b/.test(domain.replace(/[-.]/g, ' '))) return true;
	return /뉴스|신문|언론사|미디어그룹|보도자료|뉴스룸|newsroom|newspaper|magazine|방송사|기자/.test(hay);
}

function registryTypeFromVertical(vertical: SchemaVertical): 'medical' | 'legal' | 'professional' | 'general' | null {
	switch (vertical) {
		case 'legal':
			return 'legal';
		case 'dental':
		case 'medical-clinic':
		case 'medical-hospital':
			return 'medical';
		case 'b2b':
			return 'professional';
		case 'local':
			return 'general';
		default:
			return null;
	}
}

function registrySchemaFor(input: SchemaMappingInput): string {
	const vertical = detectSchemaVertical(input);
	const fromVertical = registryTypeFromVertical(vertical);
	const detected = detectIndustry({
		title: input.siteTitle || input.brandName,
		description: [input.industry, input.category, input.primaryKeyword].filter(Boolean).join(' '),
		keywords: [input.category, input.primaryKeyword, input.industry].filter(Boolean).join(' '),
		extraText: [input.industryType, ...(input.schemaTypes ?? [])].join(' '),
	});
	const type =
		detected !== 'general'
			? detected
			: fromVertical ||
				(input.industryType === 'MEDICAL'
					? 'medical'
					: input.industryType === 'B2B_MFG'
						? 'professional'
						: 'general');
	return getIndustryProfile(type).schemaType;
}

/**
 * Canonical 3 recommended schemas for the detected vertical.
 * Step 1 is `registry.schemaType` — never force Hospital onto a non-hospital industry.
 */
export function resolveRecommendedSchemas(input: SchemaMappingInput): [string, string, string] {
	const vertical = detectSchemaVertical(input);
	if (vertical === 'news') return ['NewsArticle', 'FAQPage', 'Organization'];
	if (vertical === 'dental') return ['Dentist', 'FAQPage', 'Person'];

	const schemaType = registrySchemaFor(input);
	if (vertical === 'b2b') return [schemaType === 'ProfessionalService' ? 'ProfessionalService' : 'Organization', 'FAQPage', 'Person'];
	if (vertical === 'local' || schemaType === 'LocalBusiness') return [schemaType, 'FAQPage', 'Organization'];
	return [schemaType, 'FAQPage', 'Person'];
}

/** Extra recommended types shown as family hints (not the 3-step badge slots). */
export function recommendedSchemaFamily(input: SchemaMappingInput): string[] {
	const vertical = detectSchemaVertical(input);
	const core = resolveRecommendedSchemas(input);
	if (vertical === 'medical-clinic' || vertical === 'dental') {
		return Array.from(new Set([...core, 'MedicalBusiness']));
	}
	return core;
}

function remapClinicEntity(type: string, vertical: SchemaVertical, registryType: string): string {
	if (/^Hospital$/i.test(type)) return registryType || 'MedicalClinic';
	if (/^MedicalBusiness$/i.test(type) && (vertical === 'medical-clinic' || vertical === 'dental')) {
		return registryType || 'MedicalClinic';
	}
	return type;
}

/**
 * Force any incoming LLM/heuristic list into the 3 GEO algorithm slots.
 * Drops NewsArticle as a primary type for non-news verticals.
 */
export function alignRecommendedSchemas(
	incoming: readonly string[],
	input: SchemaMappingInput,
): [string, string, string] {
	const vertical = detectSchemaVertical(input);
	const fallback = resolveRecommendedSchemas(input);
	const registryType = fallback[0];
	const cleaned = incoming
		.map((s) => String(s).trim())
		.filter(Boolean)
		.map((s) => remapClinicEntity(s, vertical, registryType))
		.filter((s) => (vertical === 'news' ? true : !NEWS_ARTICLE_RE.test(s)));

	const step1 =
		cleaned.find((s) => STEP1_ENTITY.test(s)) ||
		fallback[0];
	const step2 = cleaned.find((s) => STEP2_QA.test(s)) || fallback[1];
	const step3 =
		cleaned.find((s) => STEP3_EEAT.test(s) && !new RegExp(`^${step1}$`, 'i').test(s)) || fallback[2];

	return [step1, step2, step3];
}

export function geoAlgorithmStepBadge(step: GeoAlgorithmStep, recommended?: readonly string[]): string {
	const slot = recommended?.[step - 1];
	if (step === 1 && slot) {
		if (/MedicalClinic|Dentist|Hospital|Physician|VeterinaryCare/i.test(slot)) {
			return `LocalBusiness / ${slot}`;
		}
		if (/LegalService|Attorney/i.test(slot)) return `LegalService / LocalBusiness`;
		if (/AccountingService/i.test(slot)) return 'AccountingService / LocalBusiness';
		if (/BeautySalon/i.test(slot)) return 'BeautySalon / LocalBusiness';
		if (/HomeAndConstructionBusiness/i.test(slot)) return 'HomeAndConstructionBusiness / LocalBusiness';
		if (/ProfessionalService/i.test(slot)) return 'ProfessionalService / LocalBusiness';
		if (/LocalBusiness/i.test(slot)) return 'LocalBusiness / MedicalClinic';
		if (/Organization/i.test(slot)) return 'LocalBusiness / Organization';
	}
	if (step === 2) return GEO_ALGORITHM_STEP_BADGES[2];
	if (step === 3 && slot) {
		if (/Person/i.test(slot)) return 'Person / Organization';
		if (/Organization/i.test(slot)) return 'Person / Organization';
	}
	return GEO_ALGORITHM_STEP_BADGES[step];
}

/** Page-level schema that substitutes for NewsArticle on non-media sites. */
export function pageSchemaAlternatives(vertical: SchemaVertical): string[] {
	if (vertical === 'news') return ['NewsArticle', 'Article'];
	if (vertical === 'medical-clinic' || vertical === 'medical-hospital' || vertical === 'dental') {
		return ['MedicalWebPage', 'AboutPage'];
	}
	return ['AboutPage'];
}

export function schemaTypesInclude(types: readonly string[] | undefined, ...needles: string[]): boolean {
	const set = new Set((types ?? []).map((t) => t.replace(/^https?:\/\/schema\.org\//i, '').trim().toLowerCase()));
	return needles.some((n) => set.has(n.toLowerCase()));
}

export function hasPageSchemaAlternative(
	types: readonly string[] | undefined,
	vertical: SchemaVertical,
): boolean {
	return schemaTypesInclude(types, ...pageSchemaAlternatives(vertical));
}

/** Industry-core entity @types that carry the 5-point schema weight (replaces NewsArticle). */
export function coreEntityTypes(vertical: SchemaVertical): string[] {
	switch (vertical) {
		case 'news':
			return ['NewsArticle', 'Article'];
		case 'medical-hospital':
			return ['Hospital', 'MedicalClinic', 'MedicalBusiness', 'Physician'];
		case 'dental':
			return ['Dentist', 'MedicalClinic', 'MedicalBusiness'];
		case 'medical-clinic':
			return ['MedicalClinic', 'MedicalBusiness', 'Physician', 'Hospital', 'VeterinaryCare'];
		case 'legal':
			return ['LegalService', 'Attorney', 'LocalBusiness'];
		case 'b2b':
			return ['ProfessionalService', 'Organization', 'Corporation'];
		case 'local':
			return ['LocalBusiness', 'Store', 'Organization'];
		default:
			return ['LocalBusiness', 'Organization', 'ProfessionalService'];
	}
}

export function hasCoreEntitySchema(
	types: readonly string[] | undefined,
	vertical: SchemaVertical,
): boolean {
	return schemaTypesInclude(types, ...coreEntityTypes(vertical));
}

export function coreEntityItemCopy(
	vertical: SchemaVertical,
	lang: 'ko' | 'en',
): { label: string; why: string; passWhy: string } {
	if (vertical === 'news') {
		return lang === 'en'
			? {
					label: 'NewsArticle schema (AI & Discover)',
					why: 'NewsArticle outperforms generic Article for Discover/AI news answers.',
					passWhy: 'NewsArticle schema is present and passed.',
				}
			: {
					label: 'NewsArticle 스키마 (AI·Discover 인용에 유리)',
					why: 'NewsArticle은 Discover·뉴스성 AI 인용에 Article보다 유리합니다.',
					passWhy: 'NewsArticle 스키마가 확인되어 정상 통과되었습니다.',
				};
	}
	if (vertical === 'medical-clinic' || vertical === 'medical-hospital' || vertical === 'dental') {
		const label = vertical === 'dental' ? 'Dentist / MedicalClinic' : 'MedicalClinic / LocalBusiness';
		return lang === 'en'
			? {
					label: `${label} core schema`,
					why: 'Clinic and hospital sites are scored on MedicalClinic/LocalBusiness — missing NewsArticle is not a fail.',
					passWhy: 'Industry core schema (MedicalClinic/LocalBusiness) is present, so this item passed. NewsArticle is not required.',
				}
			: {
					label: `${label} 핵심 스키마`,
					why: '병의원 사이트는 NewsArticle 대신 MedicalClinic/LocalBusiness 핵심 스키마로 가중치를 부여합니다.',
					passWhy: '업종 핵심 스키마(MedicalClinic/LocalBusiness)가 확인되어 정상 통과되었습니다. NewsArticle은 필수 항목이 아닙니다.',
				};
	}
	if (vertical === 'legal') {
		return lang === 'en'
			? {
					label: 'LegalService core schema',
					why: 'Law firms are scored on LegalService/LocalBusiness — NewsArticle is not required.',
					passWhy: 'LegalService/LocalBusiness core schema is present and passed. NewsArticle is not required.',
				}
			: {
					label: 'LegalService 핵심 스키마',
					why: '법률 사이트는 NewsArticle 대신 LegalService/LocalBusiness 핵심 스키마로 가중치를 부여합니다.',
					passWhy: '업종 핵심 스키마(LegalService)가 확인되어 정상 통과되었습니다. NewsArticle은 필수 항목이 아닙니다.',
				};
	}
	if (vertical === 'b2b') {
		return lang === 'en'
			? {
					label: 'ProfessionalService / Organization core schema',
					why: 'B2B sites are scored on ProfessionalService/Organization — NewsArticle is not required.',
					passWhy: 'ProfessionalService/Organization core schema is present and passed. NewsArticle is not required.',
				}
			: {
					label: 'ProfessionalService / Organization 핵심 스키마',
					why: 'B2B 사이트는 NewsArticle 대신 ProfessionalService/Organization 핵심 스키마로 가중치를 부여합니다.',
					passWhy: '업종 핵심 스키마(ProfessionalService/Organization)가 확인되어 정상 통과되었습니다. NewsArticle은 필수 항목이 아닙니다.',
				};
	}
	return lang === 'en'
		? {
				label: 'LocalBusiness / AboutPage core schema',
				why: 'Ordinary businesses are scored on LocalBusiness/AboutPage — missing NewsArticle is not a fail.',
				passWhy: 'LocalBusiness/AboutPage core schema criteria are used and this item passed. NewsArticle is not required.',
			}
		: {
				label: 'LocalBusiness / AboutPage 핵심 스키마',
				why: '일반 비즈니스는 NewsArticle 대신 LocalBusiness/AboutPage 핵심 스키마로 가중치를 부여합니다.',
				passWhy: '업종 핵심 스키마(LocalBusiness/AboutPage) 기준으로 정상 통과되었습니다. NewsArticle은 필수 항목이 아닙니다.',
			};
}

export function coreArticleIssueLabel(vertical: SchemaVertical, lang: 'ko' | 'en'): string {
	if (vertical === 'news') {
		return lang === 'en' ? 'NewsArticle/Article schema incomplete' : 'NewsArticle/Article 스키마 미흡';
	}
	if (vertical === 'medical-clinic' || vertical === 'medical-hospital' || vertical === 'dental') {
		return lang === 'en' ? 'MedicalWebPage/AboutPage schema missing' : 'MedicalWebPage/AboutPage 스키마 누락';
	}
	return lang === 'en' ? 'AboutPage schema missing' : 'AboutPage 스키마 누락';
}

export function coreArticleItemCopy(
	vertical: SchemaVertical,
	lang: 'ko' | 'en',
): { label: string; why: string } {
	if (vertical === 'news') {
		return lang === 'en'
			? {
					label: 'Article / NewsArticle schema',
					why: 'Article/NewsArticle markup is a primary trust signal for ChatGPT and Perplexity citations.',
				}
			: {
					label: 'Article / NewsArticle 스키마',
					why: 'Article·NewsArticle 스키마는 ChatGPT/Perplexity가 콘텐츠를 신뢰 출처로 인식하는 핵심 신호입니다.',
				};
	}
	if (vertical === 'medical-clinic' || vertical === 'medical-hospital' || vertical === 'dental') {
		return lang === 'en'
			? {
					label: 'MedicalWebPage / AboutPage schema',
					why: 'Clinics should publish MedicalWebPage or AboutPage — NewsArticle is not a core fail for hospital/clinic sites.',
				}
			: {
					label: 'MedicalWebPage / AboutPage 스키마',
					why: '병의원 사이트는 NewsArticle 대신 MedicalWebPage·AboutPage로 진료·소개 페이지를 구조화해야 AI가 공식 출처로 인용합니다.',
				};
	}
	return lang === 'en'
		? {
				label: 'AboutPage schema',
				why: 'General businesses should use AboutPage (or Organization) — missing NewsArticle is not a core fail.',
			}
		: {
				label: 'AboutPage 스키마',
				why: '일반 기업 사이트는 NewsArticle 누락을 핵심 결함으로 보지 않고, AboutPage로 공식 소개를 구조화하면 됩니다.',
			};
}

export function coreSuccessSummaryCopy(brand: string, lang: 'ko' | 'en', vertical: SchemaVertical): string {
	const page = pageSchemaAlternatives(vertical).join('/');
	if (lang === 'en') {
		return `Live audit confirms structured data (JSON-LD), FAQPage, ${page} schema, and essential SEO signals are fully applied. ${brand}'s information is structurally optimized for AI search engines (ChatGPT, Perplexity, etc.) and Google — highly favorable for top answer-card citation and new inquiry inflow.`;
	}
	return `실측 진단 결과 JSON-LD 구조화 데이터, FAQPage, ${page} 스키마 및 SEO 필수 항목 적용이 완벽히 확인되었습니다. ${brand}의 정보가 AI 검색엔진(ChatGPT, Perplexity 등) 및 구글에 구조적으로 최적화되어, AI 상단 정답 카드 선점 및 신규 상담 유입에 매우 유리한 상태입니다.`;
}

/**
 * Keep metro + city (경기 안성). Only strips formal admin suffixes.
 * Does not collapse to a standalone city the way formatColloquialLocation does.
 */
export function formatReportRegion(raw: string): string {
	return (raw || '')
		.replace(/서울특별시|서울시/g, '서울')
		.replace(/부산광역시|부산시/g, '부산')
		.replace(/대구광역시|대구시/g, '대구')
		.replace(/인천광역시|인천시/g, '인천')
		.replace(/광주광역시/g, '광주')
		.replace(/대전광역시|대전시/g, '대전')
		.replace(/울산광역시|울산시/g, '울산')
		.replace(/세종특별자치시|세종시/g, '세종')
		.replace(/제주특별자치도|제주도/g, '제주')
		.replace(/강원특별자치도|강원도/g, '강원')
		.replace(/전북특별자치도|전라북도/g, '전북')
		.replace(/전라남도/g, '전남')
		.replace(/충청북도/g, '충북')
		.replace(/충청남도/g, '충남')
		.replace(/경상북도/g, '경북')
		.replace(/경상남도/g, '경남')
		.replace(/경기도/g, '경기')
		.replace(/([가-힣])시\b/g, '$1')
		.replace(/특별자치시|특별자치도|광역시|특별시/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Spoken-region + specialty simulation query from the medical registry dictionary. */
export function buildMedicalSimulatorQuery(region: string, specialty: string, lang: 'ko' | 'en' = 'ko'): string {
	const loc = formatReportRegion(region);
	const focus = (specialty || '').trim() || (lang === 'en' ? 'clinic' : '클리닉');
	const prompts = getIndustryProfile('medical').aiPromptGenerator({
		location: loc,
		primaryKeyword: focus,
		services: [focus],
		lang,
	});
	return prompts[0] || (lang === 'en' ? `Recommend a trusted ${focus}` : `${focus} 추천해줘`);
}
