/**
 * Dynamic content model for `GeoAeoWorkGuideModal`.
 *
 * The modal used to hardcode a single reference site (나인원의원 — a Daegu
 * dermatology clinic) into every section: hero copy, the 6-engine action
 * table, the on-page / local-index checklists, and the footer. Any other
 * diagnosed site (a law firm, a restaurant, a real-estate agency…) saw the
 * same clinic-specific copy regardless of its own brand, URL, industry, or
 * services.
 *
 * This module resolves one `GeoWorkGuideModel` from the *currently diagnosed*
 * `AuditReport` so every string in the modal is bound to the live brand
 * name, target URL, industry (via the shared `universalIndustryRegistry`),
 * detected keywords, and NAP data — with safe Korean fallbacks whenever a
 * field was never collected (crawl-blocked sites, legacy reports, etc.).
 */
import { resolveAuditSiteName } from '@/lib/audit/exec-brief';
import { siteLabelFromUrl } from '@/lib/audit/report-url';
import { withKoreanParticle } from '@/lib/utils/korean';
import {
	resolveIndustryConfig,
	type IndustryType as RegistryIndustryType,
} from '@/lib/registry/universalIndustryRegistry';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';

const FALLBACK_BRAND_KO = '해당 웹사이트';

export interface GeoWorkGuideChecklistItem {
	id: string;
	kicker: string;
	copy: string;
}

export interface GeoWorkGuideEngineRow {
	name: string;
	source: string;
	criteria: string;
	action: string;
}

export interface GeoWorkGuideFaq {
	question: string;
	answer: string;
}

export interface GeoWorkGuideEntityLabels {
	core: string;
	person: string;
	asset: string;
	location: string;
	service: string;
}

export interface GeoWorkGuideModel {
	brandName: string;
	domain: string;
	url: string;
	location: string;
	mainService: string;
	primaryKeyword: string;
	servicesLabel: string;
	representativeTitle: string;
	defaultCategory: string;
	schemaType: string;
	detailSchemaType: string;
	personSchemaType: string;
	platformsLabel: string;
	address: string;
	phone: string;
	hasNap: boolean;
	titleExample: string;
	metaExample: string;
	h1Example: string;
	jsonLdSample: string;
	faq: GeoWorkGuideFaq;
	checklistItems: GeoWorkGuideChecklistItem[];
	engines: GeoWorkGuideEngineRow[];
	entityLabels: GeoWorkGuideEntityLabels;
}

/** Schema.org type used for a service-detail page (paired with FAQPage). */
const DETAIL_SCHEMA_BY_INDUSTRY: Record<RegistryIndustryType, string> = {
	medical: 'MedicalProcedure',
	legal: 'Service',
	accounting: 'Service',
	beauty: 'Service',
	interior: 'Service',
	fitness: 'Service',
	veterinary: 'MedicalProcedure',
	education: 'Course',
	realestate: 'Product',
	restaurant: 'MenuItem',
	professional: 'Service',
	general: 'Service',
};

/** Person schema sub-type for the representative (원장/변호사/대표 등). */
const PERSON_SCHEMA_BY_INDUSTRY: Partial<Record<RegistryIndustryType, string>> = {
	medical: 'Physician',
	veterinary: 'Physician',
};

/** Representative 3rd-party review / booking platforms cited per industry. */
const PLATFORMS_BY_INDUSTRY: Record<RegistryIndustryType, string> = {
	medical: '모두닥·나만의닥터·굿닥·닥터나우',
	legal: '로톡·헬프미',
	accounting: '삼쩜삼·자비스·택스브레인',
	beauty: '강남언니·바비톡·헤어샵코리아',
	interior: '오늘의집·숨고·하우스텝',
	fitness: '스포애니·다노·오늘의PT',
	veterinary: '펫닥·마이펫플러스',
	education: '숨고·크몽·아이엠스쿨',
	realestate: '다방·직방·네이버 부동산',
	restaurant: '배달의민족·요기요·망고플레이트',
	professional: '숨고·크몽',
	general: '업종별 주요 리뷰·예약 플랫폼',
};

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

export function resolveGeoWorkGuideModel(
	report: AuditReport,
	lang: AuditLang = 'ko',
): GeoWorkGuideModel {
	const siteMeta = report.siteMeta;
	const url = compact(report.finalUrl || report.url);
	const domain = compact(siteMeta?.domain) || siteLabelFromUrl(url) || '';
	const brandName = compact(resolveAuditSiteName(report)) || domain || FALLBACK_BRAND_KO;

	const industry = resolveIndustryConfig({
		legacyIndustry: siteMeta?.industryType,
		title: report.metrics?.pageTitle || siteMeta?.brandName,
		description: report.metrics?.metaDescription,
		keywords: [siteMeta?.category, siteMeta?.primaryKeyword, ...(siteMeta?.entityPhrases ?? [])].filter(
			(v): v is string => Boolean(v),
		),
		brandName: siteMeta?.brandName || brandName,
		location: siteMeta?.broadLocation || siteMeta?.location,
		primaryKeyword: siteMeta?.primaryKeyword,
		services: siteMeta?.serviceKeywords,
		domain,
		url,
		lang: lang === 'en' ? 'en' : 'ko',
	});

	const location = compact(industry.location) || compact(siteMeta?.broadLocation) || compact(siteMeta?.location);
	const mainService = compact(industry.mainService) || compact(industry.defaultCategory) || '핵심 서비스';
	const primaryKeyword = compact(industry.primaryKeyword) || mainService;
	const servicesLabel = industry.services.length > 0 ? industry.services.join('·') : mainService;
	const representativeTitle = compact(industry.representativeTitle) || '대표';
	const defaultCategory = compact(industry.defaultCategory) || '업체';
	const schemaType = industry.schemaType;
	const detailSchemaType = DETAIL_SCHEMA_BY_INDUSTRY[industry.type] || 'Service';
	const personSchemaType = PERSON_SCHEMA_BY_INDUSTRY[industry.type] || 'Person';
	const platformsLabel = PLATFORMS_BY_INDUSTRY[industry.type] || PLATFORMS_BY_INDUSTRY.general;

	const napCanonical = report.napMatrix?.canonical;
	const address = compact(napCanonical?.address);
	const phone = compact(napCanonical?.phone);
	const hasNap = Boolean(address || phone);

	const locPrefix = location ? `${location} ` : '';
	const titleExample = `${brandName} | ${locPrefix}${mainService} 전문 ${defaultCategory}`;
	const metaExample = `${withKoreanParticle(brandName, '은/는')} ${locPrefix}${mainService} 분야에서 ${servicesLabel} 서비스를 제공합니다. 공식 사이트에서 상담 및 예약 안내를 확인하세요.`;
	const h1Example = `${locPrefix}${mainService} · ${brandName}`;

	const jsonLdSampleObj: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': schemaType,
		name: brandName,
		...(url ? { url } : {}),
		...(address ? { address: { '@type': 'PostalAddress', streetAddress: address } } : {}),
		...(phone ? { telephone: phone } : {}),
		...(location ? { areaServed: location } : {}),
		knowsAbout: industry.services.length > 0 ? industry.services : [mainService],
	};
	const jsonLdSample = JSON.stringify(jsonLdSampleObj, null, 2);

	const faqCtx = {
		brandName,
		location,
		primaryKeyword,
		services: industry.services,
		domain,
		url,
		lang: industry.lang,
	};
	let faq: GeoWorkGuideFaq | undefined;
	try {
		faq = industry.profile.faqGenerator(faqCtx)[0];
	} catch {
		faq = undefined;
	}
	if (!faq) {
		faq = {
			question: `${locPrefix}${mainService} 잘하는 곳 추천해줘`,
			answer: `${withKoreanParticle(brandName, '은/는')} ${locPrefix}${mainService} 분야의 공식 정보를 제공합니다.`,
		};
	}

	const checklistItems: GeoWorkGuideChecklistItem[] = [
		{
			id: '1',
			kicker: '온페이지',
			copy: `${schemaType} + ${detailSchemaType} + FAQPage 통합 JSON-LD 삽입 완료 여부 검증`,
		},
		{
			id: '2',
			kicker: '검색 포털',
			copy: `Bing Places 등록 신청 및 Google 비즈니스 프로필 세부 ${mainService} 최적화`,
		},
		{
			id: '3',
			kicker: '업종 플랫폼',
			copy: `${platformsLabel} 프로필 정보 갱신 및 주요 ${mainService} 태그 설정`,
		},
		{
			id: '4',
			kicker: '콘텐츠',
			copy: `공식 사이트 ${mainService}별 페이지 내 핵심 근거 중심 텍스트 보강 및 담당 ${representativeTitle} 명시`,
		},
	];

	const engines: GeoWorkGuideEngineRow[] = [
		{
			name: 'Gemini',
			source: `Google 웹 인덱스, Google 지도(GBP), 공인 ${defaultCategory} 평가 플랫폼`,
			criteria: `E-E-A-T 신뢰도, ${representativeTitle} 프로필, 지식 그래프 일치 여부`,
			action: `GBP 정밀 등록, ${platformsLabel} 입점, ${schemaType} 스키마 주입`,
		},
		{
			name: 'ChatGPT',
			source: 'Bing 웹 인덱스, Bing Places, OpenAI SearchBot 수집 데이터',
			criteria: `세부 ${mainService}명 키워드 매칭, 공인 NAP 일치도`,
			action: `Bing Places 등록 필수, ${mainService} 관련 상세 설명 텍스트 명시, 관련 업종 플랫폼 노출 유지`,
		},
		{
			name: 'Perplexity',
			source: '멀티 웹 크롤러, 리뷰 집계 플랫폼, 소셜 및 블로그',
			criteria: '출처 교차 검증 — 공식 사이트와 제3자 채널 간 합의도',
			action: `${platformsLabel}·네이버 블로그 브랜드 풋프린트 유지, FAQPage 스키마 동기화`,
		},
		{
			name: 'Claude',
			source: '파트너 검색 엔진(Brave 등), 고품질 웹 문서',
			criteria: '도메인 엔티티 일치도, 텍스트 정보 밀도, 비광고성 객관 정보',
			action: `Title/Meta의 ${mainService} 쿼리 정합성 강화, 불필요한 수식어 배제·전문 정보화`,
		},
		{
			name: 'Copilot',
			source: 'Bing 웹 인덱스, Bing Places, Microsoft 지식 그래프',
			criteria: 'Bing 생태계 내 공식 상호·주소·연락처(NAP) 데이터',
			action: 'Bing 웹마스터 도구 색인 제출, Bing Places 프로필 100% 완성',
		},
		{
			name: 'Clova',
			source: '네이버 검색 인덱스, 네이버 스마트플레이스, 블로그/카페',
			criteria: '스마트플레이스 정확도, 플레이스 리뷰, 전문 지식인/공식 블로그',
			action: '네이버 플레이스 대표 키워드 등록, 브랜드 블로그 콘텐츠 발행 및 플레이스 연결',
		},
	];

	const entityLabels: GeoWorkGuideEntityLabels = {
		core: '브랜드명',
		person: representativeTitle || '핵심 인력',
		asset: '핵심 강점',
		location: '지역',
		service: mainService,
	};

	return {
		brandName,
		domain,
		url,
		location,
		mainService,
		primaryKeyword,
		servicesLabel,
		representativeTitle,
		defaultCategory,
		schemaType,
		detailSchemaType,
		personSchemaType,
		platformsLabel,
		address,
		phone,
		hasNap,
		titleExample,
		metaExample,
		h1Example,
		jsonLdSample,
		faq,
		checklistItems,
		engines,
		entityLabels,
	};
}
