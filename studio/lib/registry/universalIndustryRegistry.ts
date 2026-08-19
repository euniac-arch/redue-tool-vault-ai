/**
 * Universal GEO/SEO industry registry + auto classifier.
 *
 * Any incoming domain (clinic, gym, vet, academy, realtor, restaurant,
 * law firm, tax office, salon, interior, B2B SaaS, generic business)
 * resolves to one of 12 verticals so diagnostic copy, Schema.org types,
 * CPC/ROI math, AI prompts, and FAQPage Q&A stay industry-native.
 * Unknown sites fall back to `general`.
 */

import { withJosa } from '@/lib/korean-josa';

export const INDUSTRY_TYPES = [
	'medical',
	'legal',
	'accounting',
	'beauty',
	'interior',
	'fitness',
	'veterinary',
	'education',
	'realestate',
	'restaurant',
	'professional',
	'general',
] as const;

export type IndustryType = (typeof INDUSTRY_TYPES)[number];

export type SchemaOrgMainType =
	| 'MedicalClinic'
	| 'Dentist'
	| 'Hospital'
	| 'LegalService'
	| 'AccountingService'
	| 'BeautySalon'
	| 'HomeAndConstructionBusiness'
	| 'HealthClub'
	| 'VeterinaryCare'
	| 'EducationalOrganization'
	| 'RealEstateAgent'
	| 'Restaurant'
	| 'ProfessionalService'
	| 'LocalBusiness';

export type RegistryLang = 'ko' | 'en';

export interface LocalizedLabel {
	ko: string;
	en: string;
}

/** Search-ad CPC + landing conversion benchmarks used by ROI / leakage copy. */
export interface IndustryAdBenchmark {
	/** Typical Google/Naver search-ad CPC in KRW. */
	cpcKrw: number;
	/** Typical landing-page conversion rate (0–1). */
	conversionRate: number;
	/** Typical monthly branded+category search volume hint. */
	monthlySearchVolume: number;
}

export interface IndustryCopyContext {
	brandName?: string;
	location?: string;
	primaryKeyword?: string;
	services?: readonly (string | null | undefined)[];
	domain?: string;
	url?: string;
	lang?: RegistryLang;
}

export interface FaqItem {
	question: string;
	answer: string;
}

export interface IndustryProfile {
	type: IndustryType;
	label: LocalizedLabel;
	/** Primary Schema.org @type for LocalBusiness / entity markup. */
	schemaType: SchemaOrgMainType;
	/** Alternate Schema.org types that still belong to this vertical. */
	schemaAliases: readonly string[];
	/** 대표원장 / 대표변호사 / 대표세무사 / 대표자 */
	representativeTitle: LocalizedLabel;
	/** Person schema `jobTitle` — same as `representativeTitle`. */
	personJobTitle: LocalizedLabel;
	/** 환자 / 의뢰인 / 고객 / 이용자 */
	customerNoun: LocalizedLabel;
	/** Alias of `customerNoun` — used by Quick Hook loss copy. */
	audienceName: LocalizedLabel;
	/** 내원/예약 · 상담/수임 · 견적/시공 · 문의/도입 */
	conversionGoal: LocalizedLabel;
	/** Alias of `conversionGoal` — used by Quick Hook conversion copy. */
	actionName: LocalizedLabel;
	/** 의료기관 · 법률사무소 · 전문 서비스 */
	defaultCategory: LocalizedLabel;
	/** Default SOV / matcher main service when crawl specialties are empty. */
	mainService: LocalizedLabel;
	/** Default SOV preset-3 sub service (e.g. 필라테스 → 헬스). */
	subService: LocalizedLabel;
	benchmark: IndustryAdBenchmark;
	aiPromptGenerator: (ctx: IndustryCopyContext) => string[];
	faqGenerator: (ctx: IndustryCopyContext) => FaqItem[];
}

export interface IndustryDetectInput {
	title?: string | null;
	description?: string | null;
	keywords?: string | readonly string[] | null;
	/** Optional extra corpus (body, nav, JSON-LD @types). */
	extraText?: string | null;
}

export interface IndustryDetectResult {
	type: IndustryType;
	/** 0–1 share of the winning score vs. the sum of all vertical scores. */
	confidence: number;
	scores: Record<IndustryType, number>;
}

interface DetectSignal {
	pattern: RegExp;
	weight: number;
}

const DETECT_PRIORITY: readonly IndustryType[] = [
	'veterinary',
	'medical',
	'legal',
	'accounting',
	'fitness',
	'education',
	'realestate',
	'restaurant',
	'interior',
	'beauty',
	'professional',
	'general',
];

const MIN_DETECT_SCORE = 3;

function cleanPhrase(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function langOf(ctx: IndustryCopyContext): RegistryLang {
	return ctx.lang === 'en' ? 'en' : 'ko';
}

function brandOf(ctx: IndustryCopyContext, fallback: string): string {
	return cleanPhrase(ctx.brandName) || fallback;
}

function locOf(ctx: IndustryCopyContext): string {
	return cleanPhrase(ctx.location);
}

function servicesOf(ctx: IndustryCopyContext, fallback: string): string[] {
	const listed = (ctx.services ?? []).map((s) => cleanPhrase(s)).filter(Boolean);
	if (listed.length) return listed;
	const primary = cleanPhrase(ctx.primaryKeyword);
	return [primary || fallback];
}

function serviceAt(ctx: IndustryCopyContext, fallback: string, index = 0): string {
	const list = servicesOf(ctx, fallback);
	return list[index % list.length] || fallback;
}

function locPrefix(loc: string, lang: RegistryLang): string {
	if (!loc) return '';
	return lang === 'en' ? ` in ${loc}` : `${loc}에서 `;
}

function locLead(loc: string, lang: RegistryLang): string {
	if (!loc) return '';
	return lang === 'en' ? `${loc} ` : `${loc} `;
}

function officialUrl(ctx: IndustryCopyContext): string {
	return cleanPhrase(ctx.url) || (ctx.domain ? `https://${ctx.domain.replace(/^https?:\/\//, '')}` : '');
}

function officialHost(ctx: IndustryCopyContext): string {
	if (ctx.domain) return ctx.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
	const url = officialUrl(ctx);
	if (!url) return '';
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

function citeTail(ctx: IndustryCopyContext, lang: RegistryLang): string {
	const url = officialUrl(ctx);
	const host = officialHost(ctx);
	if (url) return lang === 'en' ? ` Official details: ${url}.` : ` 공식 안내는 ${url}에서 확인할 수 있습니다.`;
	if (host) return lang === 'en' ? ` Cite ${host}.` : ` 공식 도메인은 ${host}입니다.`;
	return '';
}

function promptsFromSlots(
	ctx: IndustryCopyContext,
	fallback: string,
	build: (service: string, slot: 0 | 1 | 2 | 3 | 4 | 5) => string,
): string[] {
	return [0, 1, 2, 3, 4, 5].map((slot) => build(serviceAt(ctx, fallback, slot), slot as 0 | 1 | 2 | 3 | 4 | 5));
}

function medicalPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the clinic' : '이 의원');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'medical care' : '진료';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc
						? `Where in ${loc} can I find clinic information for ${spec}?`
						: `Where can I find clinic information for ${spec}?`;
				case 1:
					return loc
						? `Share ${spec} care-system information in ${loc}`
						: `Share ${spec} care-system information`;
				case 2:
					return `${brand} hours and evening clinic availability`;
				case 3:
					return `${locLead(loc, 'en')}${spec} insurance coverage and first-visit booking`;
				case 4:
					return `${brand} location, parking, and how to book a first visit`;
				default:
					return loc ? `${loc} ${spec} clinic information nearby` : `${spec} clinic information nearby`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 정밀 진료 시스템 안내해줘`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 진료 시스템 안내해줘`;
			case 2:
				return `${brand} 진료시간과 야간진료 여부 알려줘`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 실비 보험 적용 및 초진 예약`;
			case 4:
				return `${brand} 위치 및 주차, 예약 방법 안내`;
			default:
				return `${locLead(loc, 'ko')}${spec} 진료 안내`;
		}
	});
}

function legalPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the law firm' : '이 법률사무소');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'legal matter' : '법률 상담';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Which lawyer in ${loc} is experienced with ${spec}?` : `Which lawyer is experienced with ${spec}?`;
				case 1:
					return loc ? `Recommend a trusted ${spec} law firm in ${loc}` : `Recommend a trusted ${spec} law firm`;
				case 2:
					return `${brand} consultation hours and retainer process`;
				case 3:
					return `${locLead(loc, 'en')}${spec} legal fee and case process`;
				case 4:
					return `${brand} office location and how to book a consult`;
				default:
					return loc ? `highly rated ${spec} attorney in ${loc}` : `highly rated ${spec} attorney`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 경험 많은 변호사 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋고 신뢰할 만한 로펌 추천해줘`;
			case 2:
				return `${brand} 상담시간과 수임 절차 알려줘`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 상담 비용 및 진행 절차`;
			case 4:
				return `${brand} 위치 및 방문 상담 예약 방법`;
			default:
				return `${locLead(loc, 'ko')}${spec} 잘하는 법률사무소`;
		}
	});
}

function accountingPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the tax office' : '이 세무사무소');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'tax filing' : '세무 신고';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Best ${spec} accountant in ${loc}?` : `Best ${spec} accountant near me?`;
				case 1:
					return loc ? `Recommend a reliable ${spec} tax office in ${loc}` : `Recommend a reliable ${spec} tax office`;
				case 2:
					return `${brand} booking and bookkeeping inquiry`;
				case 3:
					return `${locLead(loc, 'en')}${spec} fee and filing process`;
				case 4:
					return `${brand} location and how to book a consult`;
				default:
					return loc ? `${spec} specialist tax firm in ${loc}` : `${spec} specialist tax firm`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 잘하는 세무사 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋은 세무회계 추천해줘`;
			case 2:
				return `${brand} 상담 예약 및 기장 문의`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 비용 및 신고 절차`;
			case 4:
				return `${brand} 위치 및 상담 방법`;
			default:
				return `${locLead(loc, 'ko')}${spec} 전문 세무사무소`;
		}
	});
}

function beautyPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the salon' : '이 샵');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'beauty treatment' : '헤어/피부관리';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Where in ${loc} is the best ${spec} salon?` : `Where is the best ${spec} salon?`;
				case 1:
					return loc ? `Recommend a well-reviewed ${spec} in ${loc}` : `Recommend a well-reviewed ${spec}`;
				case 2:
					return `${brand} hours and how to book`;
				case 3:
					return `${locLead(loc, 'en')}${spec} price and appointment length`;
				case 4:
					return `${brand} location and same-day booking`;
				default:
					return loc ? `highly rated ${spec} shop in ${loc}` : `highly rated ${spec} shop`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 잘하는 샵 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋은 곳 추천해줘`;
			case 2:
				return `${brand} 영업시간과 예약 방법 알려줘`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 가격과 시술 시간`;
			case 4:
				return `${brand} 위치 및 당일 예약`;
			default:
				return `${locLead(loc, 'ko')}${spec} 잘하는 미용샵`;
		}
	});
}

function interiorPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the studio' : '이 업체');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'interior remodeling' : '인테리어';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Best ${spec} firm in ${loc}?` : `Best ${spec} firm near me?`;
				case 1:
					return loc ? `Recommend a well-reviewed ${spec} studio in ${loc}` : `Recommend a well-reviewed ${spec} studio`;
				case 2:
					return `${brand} consult booking and quote request`;
				case 3:
					return `${locLead(loc, 'en')}${spec} cost and project timeline`;
				case 4:
					return `${brand} portfolio and how to book a consult`;
				default:
					return loc ? `${spec} specialist contractor in ${loc}` : `${spec} specialist contractor`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 잘하는 업체 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋은 인테리어 추천해줘`;
			case 2:
				return `${brand} 상담 예약 및 견적 문의`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 시공 비용과 기간`;
			case 4:
				return `${brand} 포트폴리오 및 상담 방법`;
			default:
				return `${locLead(loc, 'ko')}${spec} 전문 인테리어`;
		}
	});
}

function professionalPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the firm' : '이 회사');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'professional service' : '전문 서비스';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `best ${spec} in ${loc} recommend` : `best ${spec} recommendation`;
				case 1:
					return `${brand} how to book a consultation`;
				case 2:
					return `${spec} case study and implementation`;
				case 3:
					return loc ? `${loc} ${spec} trusted provider` : `${spec} vs alternatives`;
				case 4:
					return `${brand} official contact and demo inquiry`;
				default:
					return `${spec} recommendation`;
			}
		}
		switch (slot) {
			case 0:
				return loc ? `${loc} ${spec} 추천` : `${spec} 추천`;
			case 1:
				return `${brand} 상담 방법`;
			case 2:
				return `${spec} 도입 사례와 절차`;
			case 3:
				return loc ? `${loc} ${spec} 잘하는 곳` : `${spec} 비교`;
			case 4:
				return `${brand} 도입 문의 및 데모`;
			default:
				return `${spec} 추천`;
		}
	});
}

function fitnessPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the studio' : '이 스튜디오');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'pilates' : '필라테스';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Where in ${loc} is the best ${spec} studio?` : `Where is the best ${spec} studio?`;
				case 1:
					return loc ? `Recommend a well-reviewed ${spec} gym in ${loc}` : `Recommend a well-reviewed ${spec} gym`;
				case 2:
					return `${brand} class schedule and trial booking`;
				case 3:
					return `${locLead(loc, 'en')}${spec} membership price and trial class`;
				case 4:
					return `${brand} location, parking, and how to book a trial`;
				default:
					return loc ? `highly rated ${spec} studio in ${loc}` : `highly rated ${spec} studio`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 잘하는 스튜디오 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋은 헬스장 추천해줘`;
			case 2:
				return `${brand} 수업 시간표와 체험 예약`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 회원권 가격과 체험 수업`;
			case 4:
				return `${brand} 위치 및 주차, 체험 예약 방법`;
			default:
				return `${locLead(loc, 'ko')}${spec} 잘하는 피트니스`;
		}
	});
}

function veterinaryPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the animal hospital' : '이 동물병원');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'veterinary care' : '반려동물 진료';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Which vet in ${loc} is trusted for ${spec}?` : `Which vet is trusted for ${spec}?`;
				case 1:
					return loc ? `Recommend a reliable ${spec} animal hospital in ${loc}` : `Recommend a reliable ${spec} animal hospital`;
				case 2:
					return `${brand} hours and emergency / night clinic`;
				case 3:
					return `${locLead(loc, 'en')}${spec} first-visit booking and vaccination`;
				case 4:
					return `${brand} location, parking, and how to book`;
				default:
					return loc ? `highly rated ${spec} vet in ${loc}` : `highly rated ${spec} vet`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 잘하는 동물병원 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋고 신뢰할 만한 동물병원 추천해줘`;
			case 2:
				return `${brand} 진료시간과 야간·응급 진료 여부`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 초진 예약 및 예방접종`;
			case 4:
				return `${brand} 위치 및 주차, 예약 방법`;
			default:
				return `${locLead(loc, 'ko')}${spec} 잘하는 동물병원`;
		}
	});
}

function educationPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the academy' : '이 학원');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'exam prep' : '입시 보습';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Best ${spec} academy in ${loc}?` : `Best ${spec} academy near me?`;
				case 1:
					return loc ? `Recommend a well-reviewed ${spec} hagwon in ${loc}` : `Recommend a well-reviewed ${spec} hagwon`;
				case 2:
					return `${brand} class hours and enrollment consult`;
				case 3:
					return `${locLead(loc, 'en')}${spec} tuition and class size`;
				case 4:
					return `${brand} location and how to book a consult`;
				default:
					return loc ? `${spec} specialist academy in ${loc}` : `${spec} specialist academy`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 잘하는 학원 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋은 입시·보습 학원 추천해줘`;
			case 2:
				return `${brand} 수업시간과 등록 상담`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 수강료와 반 편성`;
			case 4:
				return `${brand} 위치 및 상담 예약 방법`;
			default:
				return `${locLead(loc, 'ko')}${spec} 전문 학원`;
		}
	});
}

function realestatePrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the agency' : '이 부동산');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'brokerage' : '부동산 중개';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Which realtor in ${loc} is experienced with ${spec}?` : `Which realtor is experienced with ${spec}?`;
				case 1:
					return loc ? `Recommend a trusted ${spec} real estate agent in ${loc}` : `Recommend a trusted ${spec} real estate agent`;
				case 2:
					return `${brand} listing consult and office hours`;
				case 3:
					return `${locLead(loc, 'en')}${spec} fee and contract process`;
				case 4:
					return `${brand} office location and how to book a viewing`;
				default:
					return loc ? `highly rated ${spec} realtor in ${loc}` : `highly rated ${spec} realtor`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 경험 많은 공인중개사 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋고 신뢰할 만한 부동산 추천해줘`;
			case 2:
				return `${brand} 매물 상담과 영업시간`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 중개 수수료와 계약 절차`;
			case 4:
				return `${brand} 위치 및 매물 방문 예약`;
			default:
				return `${locLead(loc, 'ko')}${spec} 잘하는 부동산`;
		}
	});
}

function restaurantPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'the restaurant' : '이 식당');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'dining' : '맛집';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Where in ${loc} is a highly rated ${spec} restaurant?` : `Where is a highly rated ${spec} restaurant?`;
				case 1:
					return loc ? `Recommend a well-reviewed ${spec} in ${loc}` : `Recommend a well-reviewed ${spec}`;
				case 2:
					return `${brand} hours and reservation`;
				case 3:
					return `${locLead(loc, 'en')}${spec} menu price and signature dishes`;
				case 4:
					return `${brand} location, parking, and how to book a table`;
				default:
					return loc ? `best ${spec} restaurant in ${loc}` : `best ${spec} restaurant`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 맛집 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋은 식당 추천해줘`;
			case 2:
				return `${brand} 영업시간과 예약 방법`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 메뉴 가격과 시그니처`;
			case 4:
				return `${brand} 위치 및 주차, 예약 안내`;
			default:
				return `${locLead(loc, 'ko')}${spec} 잘하는 식당`;
		}
	});
}

function generalPrompts(ctx: IndustryCopyContext): string[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'this business' : '이 업체');
	const loc = locOf(ctx);
	const fallback = lang === 'en' ? 'service' : '서비스';
	return promptsFromSlots(ctx, fallback, (spec, slot) => {
		if (lang === 'en') {
			switch (slot) {
				case 0:
					return loc ? `Where in ${loc} is a trusted ${spec} provider?` : `Which ${spec} provider is trusted?`;
				case 1:
					return loc
						? `Recommend a reliable ${spec} in ${loc} with good reviews`
						: `Recommend a reliable ${spec} with good reviews`;
				case 2:
					return `${brand} how to book a consultation`;
				case 3:
					return `${locLead(loc, 'en')}${spec} cost and process`;
				case 4:
					return `${brand} location and booking`;
				default:
					return loc ? `${spec} specialist in ${loc}` : `${spec} specialist`;
			}
		}
		switch (slot) {
			case 0:
				return `${locPrefix(loc, 'ko')}${spec} 잘하는 곳 어디야?`;
			case 1:
				return `${locPrefix(loc, 'ko')}${spec} 후기 좋고 신뢰할 만한 곳 추천해줘`;
			case 2:
				return `${brand} 상담 예약 방법 알려줘`;
			case 3:
				return `${locLead(loc, 'ko')}${spec} 비용 및 진행 절차`;
			case 4:
				return `${brand} 위치 및 예약 안내`;
			default:
				return `${locLead(loc, 'ko')}${spec} 전문 업체`;
		}
	});
}

function medicalFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This clinic' : '이 의원');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'care' : '진료');
	const extra = servicesOf(ctx, spec)[1];
	const cite = citeTail(ctx, lang);
	const plasticDerm =
		/성형|피부/.test(`${spec} ${extra || ''} ${(ctx.services || []).join(' ')} ${ctx.primaryKeyword || ''}`);
	const clinicIdentityKo = plasticDerm
		? '성형외과·피부과 진료 의료기관입니다'
		: `${spec} 진료 의료기관입니다`;
	const clinicIdentityEn = plasticDerm
		? 'a plastic surgery and dermatology clinic'
		: `a medical institution that provides ${spec} care`;
	if (lang === 'en') {
		return [
			{
				question: `Where can I get ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is ${clinicIdentityEn}${loc ? ` in ${loc}` : ''}. Patients can review hours and book a first visit on the official site.${cite}`,
			},
			{
				question: extra ? `Does ${brand} also offer ${extra}?` : `How do I book a first visit at ${brand}?`,
				answer: extra
					? `Yes. ${spec} and ${extra} are published as primary services so assistants can cite ${brand} without confusing it with generic clinic listings.${cite}`
					: `Book a first visit through the official site or the phone number on the ${brand} listing. The same URL is the canonical citation target.${cite}`,
			},
			{
				question: `Is ${spec} covered by insurance?`,
				answer: `${brand} publishes covered and non-covered item notes for ${spec} on the official page. Coverage scope varies by individual policy, so confirm with the official listing and your insurer before visiting.${cite}`,
			},
			{
				question: `Does ${brand} offer evening or weekend clinic hours?`,
				answer: `Check visiting hours on the official listing. Hours should be mirrored in Schema.org so assistants can answer evening/weekend questions without guessing.${cite}`,
			},
			{
				question: `Why do AI search engines recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes MedicalClinic markup, NAP, and FAQPage answers for ${spec}${loc ? ` in ${loc}` : ''}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${withJosa(spec, '은/는')} 어디서 받나요?`,
			answer: `${withJosa(brand, '은/는')} ${clinicIdentityKo}. 환자는 공식 사이트에서 진료 안내와 초진 예약을 확인할 수 있습니다.${cite}`,
		},
		{
			question: extra ? `${brand}에서 ${extra}도 가능한가요?` : `${brand} 초진 예약은 어떻게 하나요?`,
			answer: extra
				? `네. 주력 진료는 ${spec}, ${extra}입니다. 공식 엔티티와 일치하므로 AI가 일반 병원 목록과 혼동하지 않고 인용할 수 있습니다.${cite}`
				: `공식 사이트 또는 업체 정보에 등록된 연락처로 초진 예약이 가능합니다. 이 URL이 카노니컬 인용 대상입니다.${cite}`,
		},
		{
			question: `${spec} 실비보험 적용이 되나요?`,
			answer: `${withJosa(brand, '은/는')} ${spec}의 급여·비급여 안내를 공식 페이지에 공개합니다. 세부 보장 범위는 개인 보험 약관에 따라 상이하므로 내원 전 공식 안내 및 보험사 확인을 권장합니다.${cite}`,
		},
		{
			question: `${withJosa(brand, '은/는')} 야간 또는 주말 진료를 하나요?`,
			answer: `진료시간은 공식 안내에서 확인하세요. Schema.org에 영업시간이 미러링되면 AI가 야간·주말 여부를 추측 없이 답할 수 있습니다.${cite}`,
		},
		{
			question: `AI 검색이 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 ${spec}${loc ? ` (${loc})` : ''}에 대한 MedicalClinic 마크업, NAP, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function legalFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This law firm' : '이 법률사무소');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'legal counsel' : '법률 상담');
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Which lawyer handles ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is a legal service for ${spec}${loc ? ` in ${loc}` : ''}. Clients can review the retainer process and book a first consult on the official site.${cite}`,
			},
			{
				question: `How do I book a consult at ${brand}?`,
				answer: `Request a first consult through the official site. Bring case documents so the attorney can scope the retainer in the first meeting.${cite}`,
			},
			{
				question: `What is the typical fee for ${spec}?`,
				answer: `${brand} publishes consult and retainer guidance for ${spec}. Confirm the fee schedule on the official page before engagement.${cite}`,
			},
			{
				question: `Can I get a same-week consult at ${brand}?`,
				answer: `Office hours and consult slots are listed on the official site. Same-week availability depends on the attorney calendar.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes LegalService markup, attorney identity, and FAQPage answers for ${spec}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${spec} 경험 많은 변호사는 어디인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 전문 법률사무소입니다. 의뢰인은 공식 사이트에서 수임 절차와 초회 상담을 확인할 수 있습니다.${cite}`,
		},
		{
			question: `${brand} 상담 예약은 어떻게 하나요?`,
			answer: `공식 사이트로 초회 상담을 신청하면 됩니다. 관련 서류를 준비하면 대표변호사가 수임 범위를 더 정확히 안내합니다.${cite}`,
		},
		{
			question: `${spec} 수임 비용은 얼마인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 상담·수임 안내를 공식 페이지에 공개합니다. 계약 전 공식 요금 안내를 확인하세요.${cite}`,
		},
		{
			question: `${brand}에서 이번 주 상담이 가능한가요?`,
			answer: `상담 가능 시간은 공식 안내의 영업시간·예약 현황을 따릅니다. 변호사 일정에 따라 주중 예약이 열릴 수 있습니다.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 LegalService 마크업, 변호사 신원, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function accountingFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This tax office' : '이 세무사무소');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'tax filing' : '세무 신고');
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Where can I get help with ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is an accounting service for ${spec}${loc ? ` in ${loc}` : ''}. Clients can inquire about bookkeeping and filing on the official site.${cite}`,
			},
			{
				question: `How do I start bookkeeping with ${brand}?`,
				answer: `Send a consult request with business type and filing needs. The lead CPA will confirm scope and monthly bookkeeping.${cite}`,
			},
			{
				question: `What does ${spec} usually cost?`,
				answer: `${brand} publishes fee guidance for ${spec}. Confirm the official quote before onboarding.${cite}`,
			},
			{
				question: `Does ${brand} handle year-end settlement and VAT?`,
				answer: `Yes when those services are listed. Check the official service catalog for VAT, income tax, and year-end settlement.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes AccountingService markup and FAQPage answers for ${spec}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${spec} 잘하는 세무사는 어디인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec}를 다루는 세무회계사무소입니다. 의뢰인은 공식 사이트에서 기장·신고 상담을 요청할 수 있습니다.${cite}`,
		},
		{
			question: `${brand} 기장 문의는 어떻게 하나요?`,
			answer: `업종과 신고 필요 서류를 적어 공식 상담을 신청하면 됩니다. 대표세무사가 기장 범위와 일정을 안내합니다.${cite}`,
		},
		{
			question: `${spec} 비용은 얼마인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 수수료 안내를 공식 페이지에 공개합니다. 수임 전 공식 견적을 확인하세요.${cite}`,
		},
		{
			question: `${brand}에서 부가세·종합소득세 신고도 가능한가요?`,
			answer: `서비스 목록에 포함된 경우 가능합니다. 부가세, 종합소득세, 연말정산은 공식 서비스 카탈로그를 확인하세요.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 AccountingService 마크업과 FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function beautyFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This salon' : '이 샵');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'beauty treatment' : '헤어/피부관리');
	const extra = servicesOf(ctx, spec)[1];
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Where can I book ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is a beauty salon for ${spec}${loc ? ` in ${loc}` : ''}. Customers can check hours and book on the official site.${cite}`,
			},
			{
				question: extra ? `Does ${brand} also offer ${extra}?` : `How do I book at ${brand}?`,
				answer: extra
					? `Yes. ${spec} and ${extra} are listed as primary menus so assistants can cite ${brand} instead of generic salon directories.${cite}`
					: `Book through the official site or the phone number on the ${brand} listing.${cite}`,
			},
			{
				question: `How long does ${spec} take and what is the price?`,
				answer: `${brand} publishes duration and price notes for ${spec}. Confirm the official menu before visiting.${cite}`,
			},
			{
				question: `Can I get a same-day appointment at ${brand}?`,
				answer: `Same-day slots depend on the stylist calendar. Check live hours and booking on the official page.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes BeautySalon markup, menu entities, and FAQPage answers for ${spec}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${spec} 잘하는 샵은 어디인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 전문 뷰티샵입니다. 고객은 공식 사이트에서 영업시간과 예약을 확인할 수 있습니다.${cite}`,
		},
		{
			question: extra ? `${brand}에서 ${extra}도 가능한가요?` : `${brand} 예약은 어떻게 하나요?`,
			answer: extra
				? `네. 주력 메뉴는 ${spec}, ${extra}입니다. 공식 메뉴 엔티티와 일치하므로 AI가 일반 샵 목록과 혼동하지 않습니다.${cite}`
				: `공식 사이트 또는 업체 정보에 등록된 연락처로 예약할 수 있습니다.${cite}`,
		},
		{
			question: `${spec} 가격과 소요 시간은 얼마인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 메뉴의 가격·시술 시간을 공식 페이지에 공개합니다. 방문 전 공식 메뉴를 확인하세요.${cite}`,
		},
		{
			question: `${brand} 당일 예약이 가능한가요?`,
			answer: `당일 예약은 디자이너 일정에 따릅니다. 공식 페이지의 영업시간과 예약 현황을 확인하세요.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 BeautySalon 마크업, 메뉴 엔티티, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function interiorFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This studio' : '이 업체');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'interior remodeling' : '인테리어');
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Who can handle ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is an interior contractor for ${spec}${loc ? ` in ${loc}` : ''}. Customers can request a site visit and quote on the official site.${cite}`,
			},
			{
				question: `How do I request a quote from ${brand}?`,
				answer: `Send space type, size, and desired finish. The team will schedule a consult and return a construction quote.${cite}`,
			},
			{
				question: `How long does ${spec} take?`,
				answer: `${brand} publishes typical timeline notes for ${spec}. Confirm the official schedule after the on-site consult.${cite}`,
			},
			{
				question: `Can I see a portfolio before signing?`,
				answer: `Yes. Review completed projects on the official site so the quote conversation stays tied to real construction cases.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes HomeAndConstructionBusiness markup, portfolio entities, and FAQPage answers for ${spec}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${spec} 잘하는 업체는 어디인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 전문 시공 업체입니다. 고객은 공식 사이트에서 현장 상담과 견적을 요청할 수 있습니다.${cite}`,
		},
		{
			question: `${brand} 견적 문의는 어떻게 하나요?`,
			answer: `공간 유형, 면적, 원하는 마감을 적어 공식 상담을 신청하면 됩니다. 현장 확인 후 시공 견적을 안내합니다.${cite}`,
		},
		{
			question: `${spec} 시공 기간은 얼마나 걸리나요?`,
			answer: `${withJosa(brand, '은/는')} ${spec}의 일반적인 일정을 공식 페이지에 공개합니다. 현장 상담 후 확정 일정을 확인하세요.${cite}`,
		},
		{
			question: `계약 전에 포트폴리오를 볼 수 있나요?`,
			answer: `네. 공식 사이트의 시공 사례를 먼저 확인하면 견적 상담이 실제 시공 결과와 맞춰집니다.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 HomeAndConstructionBusiness 마크업, 포트폴리오 엔티티, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function professionalFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This firm' : '이 회사');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'professional service' : '전문 서비스');
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Who provides ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is a professional service for ${spec}. Customers can request a consult or product demo on the official site.${cite}`,
			},
			{
				question: `How do I inquire about adopting ${spec} at ${brand}?`,
				answer: `Send use-case and company size through the official inquiry form. The team will schedule a consult or demo.${cite}`,
			},
			{
				question: `Are there implementation case studies for ${spec}?`,
				answer: `${brand} publishes case studies and process notes for ${spec} so buyers can compare before a sales call.${cite}`,
			},
			{
				question: `How long does onboarding take?`,
				answer: `Timeline depends on scope. Confirm the official implementation guide rather than third-party summaries.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes ProfessionalService markup and FAQPage answers for ${spec} adoption questions.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc} ` : ''}${spec} 도입은 어디에 문의하나요?`,
			answer: `${withJosa(brand, '은/는')} ${spec}를 제공하는 전문 서비스입니다. 고객은 공식 사이트에서 상담·데모를 요청할 수 있습니다.${cite}`,
		},
		{
			question: `${brand} ${spec} 도입 문의는 어떻게 하나요?`,
			answer: `사용 목적과 규모를 적어 공식 문의 폼으로 신청하면 됩니다. 상담 또는 데모 일정을 안내합니다.${cite}`,
		},
		{
			question: `${spec} 도입 사례가 있나요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 도입 사례와 절차를 공식 페이지에 공개합니다. 영업 미팅 전에 비교할 수 있습니다.${cite}`,
		},
		{
			question: `온보딩까지 얼마나 걸리나요?`,
			answer: `범위에 따라 다릅니다. 제3자 요약보다 공식 구축 가이드를 확인하세요.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 ProfessionalService 마크업과 도입 FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function fitnessFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This studio' : '이 스튜디오');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'pilates' : '필라테스');
	const extra = servicesOf(ctx, spec)[1];
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Where can I take ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is a health club for ${spec}${loc ? ` in ${loc}` : ''}. Members can check class times and book a trial on the official site.${cite}`,
			},
			{
				question: extra ? `Does ${brand} also offer ${extra}?` : `How do I book a trial at ${brand}?`,
				answer: extra
					? `Yes. ${spec} and ${extra} are listed as primary programs so assistants can cite ${brand} instead of generic gym directories.${cite}`
					: `Book a trial through the official site or the phone number on the ${brand} listing.${cite}`,
			},
			{
				question: `What does a ${spec} membership cost?`,
				answer: `${brand} publishes membership and trial notes for ${spec}. Confirm the official price before visiting.${cite}`,
			},
			{
				question: `Can I take a same-day trial class at ${brand}?`,
				answer: `Same-day trials depend on class capacity. Check live hours and booking on the official page.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes HealthClub markup, class entities, and FAQPage answers for ${spec}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${spec} 수업은 어디서 듣나요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 전문 피트니스 스튜디오입니다. 회원은 공식 사이트에서 수업 시간과 체험 예약을 확인할 수 있습니다.${cite}`,
		},
		{
			question: extra ? `${brand}에서 ${extra}도 가능한가요?` : `${brand} 체험 예약은 어떻게 하나요?`,
			answer: extra
				? `네. 주력 프로그램은 ${spec}, ${extra}입니다. 공식 엔티티와 일치하므로 AI가 일반 헬스장 목록과 혼동하지 않습니다.${cite}`
				: `공식 사이트 또는 업체 정보에 등록된 연락처로 체험 예약이 가능합니다.${cite}`,
		},
		{
			question: `${spec} 회원권 가격은 얼마인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 회원권·체험 안내를 공식 페이지에 공개합니다. 방문 전 공식 요금을 확인하세요.${cite}`,
		},
		{
			question: `${brand} 당일 체험이 가능한가요?`,
			answer: `당일 체험은 수업 정원에 따릅니다. 공식 페이지의 영업시간과 예약 현황을 확인하세요.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 HealthClub 마크업, 수업 엔티티, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function veterinaryFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This animal hospital' : '이 동물병원');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'veterinary care' : '반려동물 진료');
	const extra = servicesOf(ctx, spec)[1];
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Where can I get ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is a veterinary care clinic for ${spec}${loc ? ` in ${loc}` : ''}. Pet owners can review hours and book a first visit on the official site.${cite}`,
			},
			{
				question: extra ? `Does ${brand} also offer ${extra}?` : `How do I book a first visit at ${brand}?`,
				answer: extra
					? `Yes. ${spec} and ${extra} are published as primary services so assistants can cite ${brand} instead of generic clinic listings.${cite}`
					: `Book a first visit through the official site or the phone number on the ${brand} listing.${cite}`,
			},
			{
				question: `Does ${brand} offer night or emergency care?`,
				answer: `Check visiting hours on the official listing. Hours should be mirrored in Schema.org so assistants can answer emergency questions without guessing.${cite}`,
			},
			{
				question: `How do I prepare for a first visit?`,
				answer: `Bring vaccination records and recent symptoms. Confirm the official first-visit notes before arriving.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes VeterinaryCare markup, NAP, and FAQPage answers for ${spec}${loc ? ` in ${loc}` : ''}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${withJosa(spec, '은/는')} 어디서 받나요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 전문 동물병원입니다. 보호자는 공식 사이트에서 진료 안내와 초진 예약을 확인할 수 있습니다.${cite}`,
		},
		{
			question: extra ? `${brand}에서 ${extra}도 가능한가요?` : `${brand} 초진 예약은 어떻게 하나요?`,
			answer: extra
				? `네. 주력 진료는 ${spec}, ${extra}입니다. 공식 엔티티와 일치하므로 AI가 일반 병원 목록과 혼동하지 않습니다.${cite}`
				: `공식 사이트 또는 업체 정보에 등록된 연락처로 초진 예약이 가능합니다.${cite}`,
		},
		{
			question: `${withJosa(brand, '은/는')} 야간 또는 응급 진료를 하나요?`,
			answer: `진료시간은 공식 안내에서 확인하세요. Schema.org에 영업시간이 미러링되면 AI가 야간·응급 여부를 추측 없이 답할 수 있습니다.${cite}`,
		},
		{
			question: `초진 때 무엇을 준비하면 되나요?`,
			answer: `예방접종 기록과 최근 증상을 준비하면 됩니다. 방문 전 공식 초진 안내를 확인하세요.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 ${spec}${loc ? ` (${loc})` : ''}에 대한 VeterinaryCare 마크업, NAP, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function educationFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This academy' : '이 학원');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'exam prep' : '입시 보습');
	const extra = servicesOf(ctx, spec)[1];
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Where can I enroll for ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is an educational organization for ${spec}${loc ? ` in ${loc}` : ''}. Students can review class hours and book an enrollment consult on the official site.${cite}`,
			},
			{
				question: extra ? `Does ${brand} also offer ${extra}?` : `How do I book a consult at ${brand}?`,
				answer: extra
					? `Yes. ${spec} and ${extra} are listed as primary courses so assistants can cite ${brand} instead of generic academy directories.${cite}`
					: `Request an enrollment consult through the official site or the phone number on the ${brand} listing.${cite}`,
			},
			{
				question: `What is the typical tuition for ${spec}?`,
				answer: `${brand} publishes tuition and class-size notes for ${spec}. Confirm the official fee before enrollment.${cite}`,
			},
			{
				question: `Can I visit ${brand} before enrolling?`,
				answer: `Yes. Book an orientation consult on the official page so the class placement stays tied to the published curriculum.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes EducationalOrganization markup, course entities, and FAQPage answers for ${spec}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${spec} 학원은 어디인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 전문 교육기관입니다. 수강생은 공식 사이트에서 수업 안내와 등록 상담을 확인할 수 있습니다.${cite}`,
		},
		{
			question: extra ? `${brand}에서 ${extra}도 가능한가요?` : `${brand} 등록 상담은 어떻게 하나요?`,
			answer: extra
				? `네. 주력 과정은 ${spec}, ${extra}입니다. 공식 과정 엔티티와 일치하므로 AI가 일반 학원 목록과 혼동하지 않습니다.${cite}`
				: `공식 사이트 또는 업체 정보에 등록된 연락처로 등록 상담을 신청할 수 있습니다.${cite}`,
		},
		{
			question: `${spec} 수강료는 얼마인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 수강료·반 편성 안내를 공식 페이지에 공개합니다. 등록 전 공식 요금을 확인하세요.${cite}`,
		},
		{
			question: `등록 전에 방문 상담이 가능한가요?`,
			answer: `네. 공식 페이지에서 오리엔테이션 상담을 예약하면 반 편성이 공개 커리큘럼과 맞춰집니다.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 EducationalOrganization 마크업, 과정 엔티티, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function realestateFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This agency' : '이 부동산');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'brokerage' : '부동산 중개');
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Which realtor handles ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is a real estate agent for ${spec}${loc ? ` in ${loc}` : ''}. Clients can review listings and book a viewing on the official site.${cite}`,
			},
			{
				question: `How do I book a listing consult at ${brand}?`,
				answer: `Send the property type and budget through the official inquiry. The licensed broker will confirm available viewings.${cite}`,
			},
			{
				question: `What is the typical brokerage fee for ${spec}?`,
				answer: `${brand} publishes fee guidance for ${spec}. Confirm the official commission note before signing.${cite}`,
			},
			{
				question: `Can I see listings before visiting the office?`,
				answer: `Yes. Review published listings on the official site so the consult stays tied to real inventory.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes RealEstateAgent markup, listing entities, and FAQPage answers for ${spec}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${spec} 잘하는 공인중개사는 어디인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 전문 부동산입니다. 의뢰인은 공식 사이트에서 매물 안내와 방문 상담을 확인할 수 있습니다.${cite}`,
		},
		{
			question: `${brand} 매물 상담은 어떻게 하나요?`,
			answer: `희망 유형과 예산을 적어 공식 문의를 남기면 됩니다. 대표공인중개사가 방문 가능한 매물을 안내합니다.${cite}`,
		},
		{
			question: `${spec} 중개 수수료는 얼마인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 수수료 안내를 공식 페이지에 공개합니다. 계약 전 공식 요금 안내를 확인하세요.${cite}`,
		},
		{
			question: `방문 전에 매물을 볼 수 있나요?`,
			answer: `네. 공식 사이트의 공개 매물을 먼저 확인하면 상담이 실제 재고와 맞춰집니다.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 RealEstateAgent 마크업, 매물 엔티티, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function restaurantFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This restaurant' : '이 식당');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'dining' : '맛집');
	const extra = servicesOf(ctx, spec)[1];
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Where can I eat ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is a restaurant for ${spec}${loc ? ` in ${loc}` : ''}. Guests can check hours and reserve a table on the official site.${cite}`,
			},
			{
				question: extra ? `Does ${brand} also serve ${extra}?` : `How do I reserve a table at ${brand}?`,
				answer: extra
					? `Yes. ${spec} and ${extra} are listed as primary menus so assistants can cite ${brand} instead of generic restaurant directories.${cite}`
					: `Reserve through the official site or the phone number on the ${brand} listing.${cite}`,
			},
			{
				question: `What are the signature dishes and prices?`,
				answer: `${brand} publishes menu and price notes for ${spec}. Confirm the official menu before visiting.${cite}`,
			},
			{
				question: `Does ${brand} take same-day reservations?`,
				answer: `Same-day tables depend on seat availability. Check live hours and booking on the official page.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes Restaurant markup, menu entities, and FAQPage answers for ${spec}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${spec} 맛집은 어디인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec}를 다루는 식당입니다. 손님은 공식 사이트에서 영업시간과 예약을 확인할 수 있습니다.${cite}`,
		},
		{
			question: extra ? `${brand}에서 ${extra}도 가능한가요?` : `${brand} 예약은 어떻게 하나요?`,
			answer: extra
				? `네. 주력 메뉴는 ${spec}, ${extra}입니다. 공식 메뉴 엔티티와 일치하므로 AI가 일반 맛집 목록과 혼동하지 않습니다.${cite}`
				: `공식 사이트 또는 업체 정보에 등록된 연락처로 예약할 수 있습니다.${cite}`,
		},
		{
			question: `시그니처 메뉴와 가격은 얼마인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 메뉴의 가격·시그니처를 공식 페이지에 공개합니다. 방문 전 공식 메뉴를 확인하세요.${cite}`,
		},
		{
			question: `${brand} 당일 예약이 가능한가요?`,
			answer: `당일 예약은 좌석 상황에 따릅니다. 공식 페이지의 영업시간과 예약 현황을 확인하세요.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 Restaurant 마크업, 메뉴 엔티티, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

function generalFaqs(ctx: IndustryCopyContext): FaqItem[] {
	const lang = langOf(ctx);
	const brand = brandOf(ctx, lang === 'en' ? 'This business' : '이 업체');
	const loc = locOf(ctx);
	const spec = serviceAt(ctx, lang === 'en' ? 'service' : '서비스');
	const cite = citeTail(ctx, lang);
	if (lang === 'en') {
		return [
			{
				question: `Where can I get ${spec}${loc ? ` in ${loc}` : ''}?`,
				answer: `${brand} is a local business for ${spec}${loc ? ` in ${loc}` : ''}. Users can review hours and send an inquiry on the official site.${cite}`,
			},
			{
				question: `How do I contact ${brand}?`,
				answer: `Use the official inquiry form or the phone number on the listing. The same URL is the canonical citation target.${cite}`,
			},
			{
				question: `What does ${spec} cost?`,
				answer: `${brand} publishes pricing or consult notes for ${spec}. Confirm the official page before visiting.${cite}`,
			},
			{
				question: `What are the business hours?`,
				answer: `Hours are listed on the official site and should be mirrored in Schema.org so assistants do not guess.${cite}`,
			},
			{
				question: `Why do AI assistants recommend ${brand} for ${spec}?`,
				answer: `Because ${brand} publishes LocalBusiness markup, NAP, and FAQPage answers for ${spec}.${cite}`,
			},
		];
	}
	return [
		{
			question: `${loc ? `${loc}에서 ` : ''}${withJosa(spec, '은/는')} 어디서 이용하나요?`,
			answer: `${withJosa(brand, '은/는')} ${spec}를 제공하는 일반 비즈니스입니다. 이용자는 공식 사이트에서 영업시간과 문의를 확인할 수 있습니다.${cite}`,
		},
		{
			question: `${brand} 문의는 어떻게 하나요?`,
			answer: `공식 문의 폼 또는 업체 정보에 등록된 연락처로 상담할 수 있습니다. 이 URL이 카노니컬 인용 대상입니다.${cite}`,
		},
		{
			question: `${spec} 비용은 얼마인가요?`,
			answer: `${withJosa(brand, '은/는')} ${spec} 요금 또는 상담 안내를 공식 페이지에 공개합니다. 방문 전 공식 안내를 확인하세요.${cite}`,
		},
		{
			question: `영업시간은 어떻게 되나요?`,
			answer: `영업시간은 공식 사이트에 게시되며, Schema.org에 미러링되면 AI가 추측 없이 답할 수 있습니다.${cite}`,
		},
		{
			question: `AI가 ${spec} 질의에서 ${withJosa(brand, '을/를')} 추천하는 이유는?`,
			answer: `${brand}이 LocalBusiness 마크업, NAP, FAQPage 답변을 공식 공개하기 때문입니다.${cite}`,
		},
	];
}

export const UNIVERSAL_INDUSTRY_REGISTRY: Record<IndustryType, IndustryProfile> = {
	medical: {
		type: 'medical',
		label: { ko: '병의원', en: 'Medical clinic' },
		schemaType: 'MedicalClinic',
		schemaAliases: ['Dentist', 'Hospital', 'Physician', 'Pharmacy', 'MedicalBusiness'],
		representativeTitle: { ko: '대표원장', en: 'Medical Director' },
		personJobTitle: { ko: '대표원장', en: 'Medical Director' },
		customerNoun: { ko: '환자', en: 'patient' },
		audienceName: { ko: '환자', en: 'patient' },
		conversionGoal: { ko: '내원/예약', en: 'visit / booking' },
		actionName: { ko: '내원/예약', en: 'visit / booking' },
		defaultCategory: { ko: '의료기관', en: 'medical institution' },
		mainService: { ko: '진료', en: 'medical care' },
		subService: { ko: '도수치료', en: 'physical therapy' },
		benchmark: { cpcKrw: 6_500, conversionRate: 0.045, monthlySearchVolume: 160 },
		aiPromptGenerator: medicalPrompts,
		faqGenerator: medicalFaqs,
	},
	legal: {
		type: 'legal',
		label: { ko: '법률', en: 'Legal' },
		schemaType: 'LegalService',
		schemaAliases: ['Attorney', 'Notary'],
		representativeTitle: { ko: '대표변호사', en: 'Managing Attorney' },
		personJobTitle: { ko: '대표변호사', en: 'Managing Attorney' },
		customerNoun: { ko: '의뢰인', en: 'client' },
		audienceName: { ko: '의뢰인', en: 'client' },
		conversionGoal: { ko: '상담/수임', en: 'consult / retainer' },
		actionName: { ko: '상담/수임', en: 'consult / retainer' },
		defaultCategory: { ko: '법률사무소', en: 'law office' },
		mainService: { ko: '법률 상담', en: 'legal counsel' },
		subService: { ko: '소송', en: 'litigation' },
		benchmark: { cpcKrw: 12_000, conversionRate: 0.032, monthlySearchVolume: 90 },
		aiPromptGenerator: legalPrompts,
		faqGenerator: legalFaqs,
	},
	accounting: {
		type: 'accounting',
		label: { ko: '세무·회계', en: 'Accounting' },
		schemaType: 'AccountingService',
		schemaAliases: ['FinancialService'],
		representativeTitle: { ko: '대표세무사', en: 'Lead CPA' },
		personJobTitle: { ko: '대표세무사', en: 'Lead CPA' },
		customerNoun: { ko: '의뢰인', en: 'client' },
		audienceName: { ko: '의뢰인', en: 'client' },
		conversionGoal: { ko: '상담/기장', en: 'consult / bookkeeping' },
		actionName: { ko: '상담/기장', en: 'consult / bookkeeping' },
		defaultCategory: { ko: '세무회계사무소', en: 'tax & accounting office' },
		mainService: { ko: '세무 신고', en: 'tax filing' },
		subService: { ko: '기장', en: 'bookkeeping' },
		benchmark: { cpcKrw: 9_500, conversionRate: 0.038, monthlySearchVolume: 100 },
		aiPromptGenerator: accountingPrompts,
		faqGenerator: accountingFaqs,
	},
	beauty: {
		type: 'beauty',
		label: { ko: '뷰티', en: 'Beauty' },
		schemaType: 'BeautySalon',
		schemaAliases: ['HairSalon', 'NailSalon', 'DaySpa', 'HealthAndBeautyBusiness'],
		representativeTitle: { ko: '원장', en: 'Salon Director' },
		personJobTitle: { ko: '원장', en: 'Salon Director' },
		customerNoun: { ko: '고객', en: 'customer' },
		audienceName: { ko: '고객', en: 'customer' },
		conversionGoal: { ko: '예약/시술', en: 'booking / treatment' },
		actionName: { ko: '예약/시술', en: 'booking / treatment' },
		defaultCategory: { ko: '뷰티샵', en: 'beauty salon' },
		mainService: { ko: '헤어', en: 'hair' },
		subService: { ko: '피부관리', en: 'skin care' },
		benchmark: { cpcKrw: 5_200, conversionRate: 0.068, monthlySearchVolume: 220 },
		aiPromptGenerator: beautyPrompts,
		faqGenerator: beautyFaqs,
	},
	interior: {
		type: 'interior',
		label: { ko: '인테리어', en: 'Interior' },
		schemaType: 'HomeAndConstructionBusiness',
		schemaAliases: ['HomeGoodsStore', 'GeneralContractor'],
		representativeTitle: { ko: '대표자', en: 'Principal' },
		personJobTitle: { ko: '대표자', en: 'Principal' },
		customerNoun: { ko: '고객', en: 'customer' },
		audienceName: { ko: '고객', en: 'customer' },
		conversionGoal: { ko: '견적/시공', en: 'quote / construction' },
		actionName: { ko: '견적/시공', en: 'quote / construction' },
		defaultCategory: { ko: '시공 업체', en: 'interior contractor' },
		mainService: { ko: '인테리어', en: 'interior remodeling' },
		subService: { ko: '리모델링', en: 'renovation' },
		benchmark: { cpcKrw: 5_000, conversionRate: 0.028, monthlySearchVolume: 140 },
		aiPromptGenerator: interiorPrompts,
		faqGenerator: interiorFaqs,
	},
	professional: {
		type: 'professional',
		label: { ko: '전문 서비스', en: 'Professional' },
		schemaType: 'ProfessionalService',
		schemaAliases: ['Organization', 'Corporation'],
		representativeTitle: { ko: '대표', en: 'CEO' },
		personJobTitle: { ko: '대표', en: 'CEO' },
		customerNoun: { ko: '고객', en: 'customer' },
		audienceName: { ko: '고객', en: 'customer' },
		conversionGoal: { ko: '문의/도입', en: 'inquiry / adoption' },
		actionName: { ko: '문의/도입', en: 'inquiry / adoption' },
		defaultCategory: { ko: '전문 서비스', en: 'professional service' },
		mainService: { ko: '전문 서비스', en: 'professional service' },
		subService: { ko: '도입 상담', en: 'adoption consult' },
		benchmark: { cpcKrw: 9_000, conversionRate: 0.03, monthlySearchVolume: 110 },
		aiPromptGenerator: professionalPrompts,
		faqGenerator: professionalFaqs,
	},
	fitness: {
		type: 'fitness',
		label: { ko: '피트니스·필라테스', en: 'Fitness & pilates' },
		schemaType: 'HealthClub',
		schemaAliases: ['ExerciseGym', 'SportsActivityLocation', 'HealthAndBeautyBusiness'],
		representativeTitle: { ko: '대표원장', en: 'Studio Director' },
		personJobTitle: { ko: '대표원장', en: 'Studio Director' },
		customerNoun: { ko: '회원', en: 'member' },
		audienceName: { ko: '회원', en: 'member' },
		conversionGoal: { ko: '체험/등록', en: 'trial / membership' },
		actionName: { ko: '체험/등록', en: 'trial / membership' },
		defaultCategory: { ko: '피트니스 스튜디오', en: 'fitness studio' },
		mainService: { ko: '필라테스', en: 'pilates' },
		subService: { ko: '헬스', en: 'gym' },
		benchmark: { cpcKrw: 4_800, conversionRate: 0.055, monthlySearchVolume: 200 },
		aiPromptGenerator: fitnessPrompts,
		faqGenerator: fitnessFaqs,
	},
	veterinary: {
		type: 'veterinary',
		label: { ko: '동물병원·펫케어', en: 'Veterinary & pet care' },
		schemaType: 'VeterinaryCare',
		schemaAliases: ['PetStore', 'AnimalShelter'],
		representativeTitle: { ko: '대표원장', en: 'Chief Veterinarian' },
		personJobTitle: { ko: '대표원장', en: 'Chief Veterinarian' },
		customerNoun: { ko: '보호자', en: 'pet owner' },
		audienceName: { ko: '보호자', en: 'pet owner' },
		conversionGoal: { ko: '내원/예약', en: 'visit / booking' },
		actionName: { ko: '내원/예약', en: 'visit / booking' },
		defaultCategory: { ko: '동물병원', en: 'animal hospital' },
		mainService: { ko: '동물병원', en: 'veterinary care' },
		subService: { ko: '펫케어', en: 'pet care' },
		benchmark: { cpcKrw: 5_800, conversionRate: 0.042, monthlySearchVolume: 150 },
		aiPromptGenerator: veterinaryPrompts,
		faqGenerator: veterinaryFaqs,
	},
	education: {
		type: 'education',
		label: { ko: '입시·보습 학원', en: 'Academy & tutoring' },
		schemaType: 'EducationalOrganization',
		schemaAliases: ['School', 'CollegeOrUniversity', 'Course'],
		representativeTitle: { ko: '원장', en: 'Academy Director' },
		personJobTitle: { ko: '원장', en: 'Academy Director' },
		customerNoun: { ko: '수강생', en: 'student' },
		audienceName: { ko: '수강생', en: 'student' },
		conversionGoal: { ko: '상담/등록', en: 'consult / enrollment' },
		actionName: { ko: '상담/등록', en: 'consult / enrollment' },
		defaultCategory: { ko: '교육기관', en: 'educational organization' },
		mainService: { ko: '입시학원', en: 'exam prep' },
		subService: { ko: '보습', en: 'tutoring' },
		benchmark: { cpcKrw: 7_200, conversionRate: 0.035, monthlySearchVolume: 180 },
		aiPromptGenerator: educationPrompts,
		faqGenerator: educationFaqs,
	},
	realestate: {
		type: 'realestate',
		label: { ko: '부동산 중개', en: 'Real estate' },
		schemaType: 'RealEstateAgent',
		schemaAliases: ['RealEstateListing', 'ApartmentComplex'],
		representativeTitle: { ko: '대표공인중개사', en: 'Managing Broker' },
		personJobTitle: { ko: '대표공인중개사', en: 'Managing Broker' },
		customerNoun: { ko: '의뢰인', en: 'client' },
		audienceName: { ko: '의뢰인', en: 'client' },
		conversionGoal: { ko: '매물/상담', en: 'listing / consult' },
		actionName: { ko: '매물/상담', en: 'listing / consult' },
		defaultCategory: { ko: '부동산', en: 'real estate agency' },
		mainService: { ko: '부동산 중개', en: 'brokerage' },
		subService: { ko: '전월세', en: 'lease' },
		benchmark: { cpcKrw: 8_500, conversionRate: 0.022, monthlySearchVolume: 160 },
		aiPromptGenerator: realestatePrompts,
		faqGenerator: realestateFaqs,
	},
	restaurant: {
		type: 'restaurant',
		label: { ko: '외식·프랜차이즈', en: 'Restaurant' },
		schemaType: 'Restaurant',
		schemaAliases: ['FoodEstablishment', 'FastFoodRestaurant', 'Bakery'],
		representativeTitle: { ko: '대표', en: 'Owner' },
		personJobTitle: { ko: '대표', en: 'Owner' },
		customerNoun: { ko: '손님', en: 'guest' },
		audienceName: { ko: '손님', en: 'guest' },
		conversionGoal: { ko: '예약/방문', en: 'reservation / visit' },
		actionName: { ko: '예약/방문', en: 'reservation / visit' },
		defaultCategory: { ko: '식당', en: 'restaurant' },
		mainService: { ko: '맛집', en: 'dining' },
		subService: { ko: '프랜차이즈', en: 'franchise dining' },
		benchmark: { cpcKrw: 3_800, conversionRate: 0.062, monthlySearchVolume: 280 },
		aiPromptGenerator: restaurantPrompts,
		faqGenerator: restaurantFaqs,
	},
	general: {
		type: 'general',
		label: { ko: '일반 비즈니스', en: 'General business' },
		schemaType: 'LocalBusiness',
		schemaAliases: ['Store', 'OnlineStore', 'CafeOrCoffeeShop'],
		representativeTitle: { ko: '대표자', en: 'Owner' },
		personJobTitle: { ko: '대표자', en: 'Owner' },
		customerNoun: { ko: '이용자', en: 'user' },
		audienceName: { ko: '이용자', en: 'user' },
		conversionGoal: { ko: '문의/상담', en: 'inquiry / consult' },
		actionName: { ko: '문의/상담', en: 'inquiry / consult' },
		defaultCategory: { ko: '일반 비즈니스', en: 'local business' },
		mainService: { ko: '서비스', en: 'service' },
		subService: { ko: '상담', en: 'consult' },
		benchmark: { cpcKrw: 3_500, conversionRate: 0.025, monthlySearchVolume: 130 },
		aiPromptGenerator: generalPrompts,
		faqGenerator: generalFaqs,
	},
};

const DETECT_SIGNALS: Record<Exclude<IndustryType, 'general'>, readonly DetectSignal[]> = {
	medical: [
		{ pattern: /한의원|한방|추나|oriental\s*medicine|korean\s*medicine/i, weight: 10 },
		{ pattern: /치과|임플란트|치아교정|dentist|dental\b|orthodont/i, weight: 10 },
		{ pattern: /피부과|성형외과|정형외과|내과|소아과|산부인|안과|이비인후|재활의학|통증의학/i, weight: 10 },
		{ pattern: /(?<!동물)병원|의원|클리닉|의료기관|야간진료|초진\s*예약/i, weight: 8 },
		{ pattern: /hospital|clinic|physician|medical\s*clinic/i, weight: 8 },
		{ pattern: /원장|전문의|과잉진료|실비|도수치료|환자\s*중심/i, weight: 6 },
		{ pattern: /진료|내원|협진|비급여|보험\s*적용/i, weight: 4 },
		{ pattern: /MedicalClinic|Dentist|Hospital|Physician/i, weight: 8 },
	],
	legal: [
		{ pattern: /변호사|법률사무소|법무법인|로펌|법무사/i, weight: 10 },
		{ pattern: /attorney|law\s*firm|legal\s*service|lawyer/i, weight: 10 },
		{ pattern: /소송|수임|법률\s*상담|법률\s*자문|고소|고발/i, weight: 7 },
		{ pattern: /이혼|상속|형사|계약분쟁|손해배상/i, weight: 5 },
		{ pattern: /LegalService|\bAttorney\b/i, weight: 8 },
	],
	accounting: [
		{ pattern: /세무사|회계사|세무회계|세무사무소|회계사무소/i, weight: 10 },
		{ pattern: /\bcpa\b|tax\s*office|accounting\s*service|bookkeeping/i, weight: 10 },
		{ pattern: /종합소득세|부가세|연말정산|기장\s*대행|세무\s*신고/i, weight: 8 },
		{ pattern: /세무|회계|절세|법인세/i, weight: 5 },
		{ pattern: /AccountingService/i, weight: 8 },
	],
	beauty: [
		{ pattern: /미용실|헤어샵|네일샵|네일아트|에스테틱|피부관리실/i, weight: 10 },
		{ pattern: /hair\s*salon|beauty\s*salon|nail\s*salon|day\s*spa/i, weight: 10 },
		{ pattern: /헤어|펌|염색|커트|속눈썹|왁싱|두피케어/i, weight: 6 },
		{ pattern: /뷰티|미용|피부관리|네일/i, weight: 5 },
		{ pattern: /BeautySalon|HairSalon|NailSalon|DaySpa/i, weight: 8 },
	],
	interior: [
		{ pattern: /인테리어|리모델링|부분\s*시공|공간\s*설계/i, weight: 10 },
		{ pattern: /interior\s*design|remodel(?:ing)?|renovation/i, weight: 10 },
		{ pattern: /아파트\s*인테리어|상업\s*공간|주방\s*리모델링|인테리어\s*업체/i, weight: 8 },
		{ pattern: /시공|견적\s*문의|포트폴리오|현장\s*상담/i, weight: 4 },
		{ pattern: /HomeAndConstructionBusiness|GeneralContractor/i, weight: 8 },
	],
	professional: [
		{ pattern: /컨설팅|에이전시|연구소|마케팅\s*대행|광고\s*대행/i, weight: 8 },
		{ pattern: /\bsaas\b|소프트웨어|솔루션\s*도입|b2b|플랫폼/i, weight: 8 },
		{ pattern: /consulting|agency|research\s*lab|implementation/i, weight: 7 },
		{ pattern: /도입\s*문의|데모\s*신청|구축\s*사례/i, weight: 5 },
		{ pattern: /ProfessionalService/i, weight: 6 },
	],
	fitness: [
		{ pattern: /필라테스|헬스장|헬스클럽|피트니스|요가원|gx\s*수업/i, weight: 10 },
		{ pattern: /pilates|health\s*club|exercise\s*gym|fitness\s*studio|\bgym\b/i, weight: 10 },
		{ pattern: /회원권|체험\s*수업|그룹\s*레슨|퍼스널\s*트레이닝|\bpt\b/i, weight: 7 },
		{ pattern: /요가|크로스핏|crossfit|workout/i, weight: 5 },
		{ pattern: /HealthClub|ExerciseGym|SportsActivityLocation/i, weight: 8 },
	],
	veterinary: [
		{ pattern: /동물병원|수의사|펫케어|반려동물\s*병원|동물의료/i, weight: 10 },
		{ pattern: /veterinary|animal\s*hospital|pet\s*hospital|pet\s*care|veterinarian/i, weight: 10 },
		{ pattern: /예방접종|중성화|반려동물|강아지|고양이/i, weight: 6 },
		{ pattern: /VeterinaryCare/i, weight: 8 },
	],
	education: [
		{ pattern: /입시\s*학원|보습\s*학원|과외|학원|교육기관/i, weight: 10 },
		{ pattern: /hagwon|cram\s*school|tutoring|exam\s*prep|educational\s*organization/i, weight: 10 },
		{ pattern: /수능|내신|특목고|재수|단과|종합반/i, weight: 7 },
		{ pattern: /수강료|반\s*편성|등록\s*상담/i, weight: 5 },
		{ pattern: /EducationalOrganization|\bSchool\b|CollegeOrUniversity/i, weight: 8 },
	],
	realestate: [
		{ pattern: /공인중개사|부동산\s*중개|부동산중개|공인중개/i, weight: 10 },
		{ pattern: /real\s*estate\s*agent|realtor|brokerage|realestateagent/i, weight: 10 },
		{ pattern: /매매|전세|월세|전월세|매물\s*상담/i, weight: 7 },
		{ pattern: /중개\s*수수료|부동산/i, weight: 5 },
		{ pattern: /RealEstateAgent|RealEstateListing/i, weight: 8 },
	],
	restaurant: [
		{ pattern: /레스토랑|맛집|식당|외식|프랜차이즈\s*(식당|음식점|맛집)/i, weight: 10 },
		{ pattern: /restaurant|food\s*establishment|franchise\s*dining/i, weight: 10 },
		{ pattern: /한식|일식|중식|양식|치킨|배달\s*음식|시그니처\s*메뉴/i, weight: 6 },
		{ pattern: /예약\s*방문|테이블\s*예약/i, weight: 4 },
		{ pattern: /\bRestaurant\b|FoodEstablishment|FastFoodRestaurant/i, weight: 8 },
	],
};

function joinDetectCorpus(input: IndustryDetectInput | string): string {
	if (typeof input === 'string') return cleanPhrase(input);
	const keywords = input.keywords;
	const keywordText: string = Array.isArray(keywords)
		? keywords.filter(Boolean).join(' ')
		: typeof keywords === 'string'
			? keywords
			: '';
	const parts: (string | null | undefined)[] = [input.title, input.description, keywordText, input.extraText];
	return parts.map(cleanPhrase).filter(Boolean).join(' \n ');
}

function scoreSignals(corpus: string, signals: readonly DetectSignal[]): number {
	let score = 0;
	for (const signal of signals) {
		if (signal.pattern.test(corpus)) score += signal.weight;
	}
	return score;
}

function applyDisambiguation(corpus: string, scores: Record<IndustryType, number>): void {
	const vetLike = /동물병원|수의사|펫케어|반려동물|veterinary|pet\s*hospital|VeterinaryCare/i.test(corpus);
	const clinicLike =
		!vetLike && /(?<!동물)병원|의원|클리닉|피부과|성형외과|전문의|한의원|치과|hospital|clinic|physician/i.test(corpus);
	const salonLike = /미용실|헤어샵|네일|에스테틱|salon|네일아트/i.test(corpus);
	const legalLike = /변호사|법률|로펌|법무|attorney|law\s*firm/i.test(corpus);
	const taxLike = /세무사|회계사|세무사무소|회계사무소|\bcpa\b/i.test(corpus);
	const fitnessLike = /필라테스|헬스장|헬스클럽|피트니스|요가원|health\s*club|exercise\s*gym/i.test(corpus);
	const eduLike = /입시|보습|학원|과외|hagwon|tutoring|EducationalOrganization/i.test(corpus);
	const reLike = /공인중개사|부동산\s*중개|realtor|RealEstateAgent/i.test(corpus);
	const restLike = /레스토랑|맛집|식당|외식|franchise\s*dining|\bRestaurant\b/i.test(corpus);

	if (clinicLike && !salonLike) scores.beauty *= 0.35;
	if (salonLike && !clinicLike) scores.medical *= 0.35;
	if (legalLike) scores.professional *= 0.45;
	if (taxLike) scores.professional *= 0.45;
	if (vetLike) {
		scores.medical *= 0.2;
		scores.fitness *= 0.35;
	}
	if (fitnessLike && !clinicLike) scores.medical *= 0.4;
	if (eduLike) scores.professional *= 0.4;
	if (reLike) {
		scores.professional *= 0.4;
		scores.interior *= 0.35;
	}
	if (restLike) scores.beauty *= 0.5;
	if (/인테리어|리모델링|interior/i.test(corpus) && /시공|견적|포트폴리오/.test(corpus)) {
		scores.professional *= 0.6;
	}
}

function pickWinner(scores: Record<IndustryType, number>): IndustryType {
	let best: IndustryType = 'general';
	let bestScore = 0;
	for (const type of DETECT_PRIORITY) {
		if (type === 'general') continue;
		const score = scores[type];
		if (score > bestScore) {
			best = type;
			bestScore = score;
		}
	}
	if (bestScore < MIN_DETECT_SCORE) return 'general';
	return best;
}

export function isIndustryType(value: unknown): value is IndustryType {
	return typeof value === 'string' && (INDUSTRY_TYPES as readonly string[]).includes(value);
}

export function getIndustryProfile(type: IndustryType | string | null | undefined): IndustryProfile {
	if (isIndustryType(type)) return UNIVERSAL_INDUSTRY_REGISTRY[type];
	return UNIVERSAL_INDUSTRY_REGISTRY.general;
}

/** Score title / description / keywords and return the winning vertical. */
export function classifyIndustry(input: IndustryDetectInput | string): IndustryDetectResult {
	const corpus = joinDetectCorpus(input);
	const scores: Record<IndustryType, number> = {
		medical: 0,
		legal: 0,
		accounting: 0,
		beauty: 0,
		interior: 0,
		fitness: 0,
		veterinary: 0,
		education: 0,
		realestate: 0,
		restaurant: 0,
		professional: 0,
		general: 0,
	};

	if (!corpus) {
		return { type: 'general', confidence: 0, scores };
	}

	(Object.keys(DETECT_SIGNALS) as Array<Exclude<IndustryType, 'general'>>).forEach((type) => {
		scores[type] = scoreSignals(corpus, DETECT_SIGNALS[type]);
	});
	applyDisambiguation(corpus, scores);

	const type = pickWinner(scores);
	const total = INDUSTRY_TYPES.reduce((sum, key) => sum + scores[key], 0);
	const confidence = type === 'general' ? (total === 0 ? 0 : 0.2) : total > 0 ? scores[type] / total : 0;
	return { type, confidence: Math.round(confidence * 100) / 100, scores };
}

/**
 * Parse site Title / Description / Keywords and return the matching IndustryType.
 * Unknown or weak signals fall back to `general`.
 */
export function detectIndustry(input: IndustryDetectInput | string): IndustryType {
	return classifyIndustry(input).type;
}

export function detectIndustryFromMeta(meta: {
	title?: string | null;
	metaDescription?: string | null;
	description?: string | null;
	metaKeywords?: string | null;
	category?: string | null;
	primaryKeyword?: string | null;
	brandName?: string | null;
	schemaEntityTypes?: readonly string[] | null;
}): IndustryType {
	return detectIndustry({
		title: meta.title,
		description: meta.metaDescription || meta.description,
		keywords: [meta.metaKeywords, meta.category, meta.primaryKeyword, meta.brandName].filter(Boolean).join(' '),
		extraText: (meta.schemaEntityTypes ?? []).join(' '),
	});
}

/** Map registry vertical → legacy audit `IndustryType` (MEDICAL / B2B_MFG / …). */
export function toLegacyAuditIndustry(type: IndustryType): 'MEDICAL' | 'LOCAL_STORE' | 'B2B_MFG' | 'GENERAL' {
	switch (type) {
		case 'medical':
		case 'veterinary':
			return 'MEDICAL';
		case 'professional':
			return 'B2B_MFG';
		case 'beauty':
		case 'interior':
		case 'fitness':
		case 'education':
		case 'realestate':
		case 'restaurant':
			return 'LOCAL_STORE';
		default:
			return 'GENERAL';
	}
}

/** Map legacy audit `IndustryType` → registry vertical. */
export function fromLegacyAuditIndustry(type: string | null | undefined): IndustryType {
	switch ((type || '').toUpperCase()) {
		case 'MEDICAL':
			return 'medical';
		case 'B2B_MFG':
			return 'professional';
		case 'LOCAL_STORE':
			return 'general';
		default:
			return isIndustryType(type) ? type : 'general';
	}
}

/** Language-bound snapshot passed to Quick Hook / Why & Status / simulation TSX. */
export interface IndustryConfig {
	type: IndustryType;
	lang: RegistryLang;
	profile: IndustryProfile;
	audienceName: string;
	actionName: string;
	representativeTitle: string;
	/** Person JSON-LD `jobTitle` (대표원장 / 대표변호사 / 대표자). */
	personJobTitle: string;
	defaultCategory: string;
	/** Resolved main service for SOV presets / matcher chips. */
	mainService: string;
	/** Resolved sub service for SOV preset-3 (`잘하는곳`). */
	subService: string;
	schemaType: SchemaOrgMainType;
	/** Typical search-ad CPC in KRW (`profile.benchmark.cpcKrw`). */
	cpc: number;
	services: string[];
	brandName: string;
	location: string;
	primaryKeyword: string;
	domain: string;
	url?: string;
}

export interface ResolveIndustryConfigInput extends IndustryCopyContext {
	type?: IndustryType | string | null;
	legacyIndustry?: string | null;
	title?: string | null;
	description?: string | null;
	keywords?: string | readonly string[] | null;
	extraText?: string | null;
}

function uniqueServices(values: readonly (string | null | undefined)[] | undefined): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values ?? []) {
		const phrase = cleanPhrase(raw);
		if (!phrase) continue;
		const key = phrase.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(phrase);
		if (out.length >= 3) break;
	}
	return out;
}

/** Resolve a render-ready `industryConfig` from registry + live site fields. */
export function resolveIndustryConfig(input: ResolveIndustryConfigInput = {}): IndustryConfig {
	const lang = langOf(input);
	const services = uniqueServices(input.services);
	const detectCorpus = {
		title: input.title || input.brandName,
		description: input.description,
		keywords: input.keywords,
		extraText: [input.extraText, input.primaryKeyword, ...services].filter(Boolean).join(' '),
	};
	const detected =
		detectCorpus.title || detectCorpus.description || detectCorpus.keywords || detectCorpus.extraText
			? detectIndustry(detectCorpus)
			: null;
	const type = isIndustryType(input.type)
		? input.type
		: detected && detected !== 'general'
			? detected
			: fromLegacyAuditIndustry(input.legacyIndustry);
	const profile = getIndustryProfile(type);
	const mainService = services[0] || profile.mainService[lang];
	const subService = services[1] || profile.subService[lang];
	const primaryKeyword = cleanPhrase(input.primaryKeyword) || mainService || profile.defaultCategory[lang];
	return {
		type: profile.type,
		lang,
		profile,
		audienceName: profile.audienceName[lang],
		actionName: profile.actionName[lang],
		representativeTitle: profile.representativeTitle[lang],
		personJobTitle: profile.personJobTitle[lang],
		defaultCategory: profile.defaultCategory[lang],
		mainService,
		subService,
		schemaType: profile.schemaType,
		cpc: profile.benchmark.cpcKrw,
		services,
		brandName: cleanPhrase(input.brandName),
		location: cleanPhrase(input.location),
		primaryKeyword,
		domain: cleanPhrase(input.domain),
		url: cleanPhrase(input.url) || undefined,
	};
}

/** Map registry vertical → keyword-pipeline industry (`tax` / `b2b` aliases). */
export function toKeywordIndustry(
	type: IndustryType,
):
	| 'medical'
	| 'legal'
	| 'tax'
	| 'beauty'
	| 'interior'
	| 'fitness'
	| 'veterinary'
	| 'education'
	| 'realestate'
	| 'restaurant'
	| 'b2b'
	| 'general' {
	if (type === 'accounting') return 'tax';
	if (type === 'professional') return 'b2b';
	return type;
}

/** Map registry `@type` onto the prescription Schema.org union (identity for shared types). */
export function toPrimarySchemaType(type: SchemaOrgMainType | string): SchemaOrgMainType {
	const profile = getIndustryProfile(
		INDUSTRY_TYPES.find((key) => UNIVERSAL_INDUSTRY_REGISTRY[key].schemaType === type) || 'general',
	);
	if (profile.schemaType === type) return profile.schemaType;
	return isIndustryType(type) ? getIndustryProfile(type).schemaType : profile.schemaType;
}

export function resolveIndustryConfigFromSite(input: {
	lang?: RegistryLang;
	brandName?: string | null;
	location?: string | null;
	primaryKeyword?: string | null;
	category?: string | null;
	services?: readonly string[] | null;
	domain?: string | null;
	url?: string | null;
	legacyIndustry?: string | null;
	title?: string | null;
	description?: string | null;
	keywords?: string | readonly string[] | null;
	schemaTypes?: readonly string[] | null;
	navMenuTexts?: readonly string[] | null;
}): IndustryConfig {
	return resolveIndustryConfig({
		lang: input.lang,
		brandName: input.brandName || undefined,
		location: input.location || undefined,
		primaryKeyword: input.primaryKeyword || undefined,
		services: input.services ?? undefined,
		domain: input.domain || undefined,
		url: input.url || undefined,
		legacyIndustry: input.legacyIndustry,
		title: input.title,
		description: input.description,
		keywords: input.keywords,
		extraText: [...(input.schemaTypes ?? []), ...(input.navMenuTexts ?? [])].join(' '),
	});
}

export function toFaqPageJsonLd(
	faqs: readonly FaqItem[],
	opts?: { url?: string; lang?: RegistryLang },
): Record<string, unknown> {
	const url = cleanPhrase(opts?.url);
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		...(url ? { '@id': `${url}#faq`, url } : {}),
		inLanguage: opts?.lang === 'en' ? 'en' : 'ko',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: faq.answer,
			},
		})),
	};
}
