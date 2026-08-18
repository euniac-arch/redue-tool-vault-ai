import type { IndustryType } from '@/lib/audit/site-metadata';
import type { AuditReport } from '@/lib/site-auditor';
import { buildToBeKeywordPack } from '@/lib/geo/as-is-honesty';
import { cleanMedicalEntities } from '@/lib/geo/clean-medical-entities';
import { buildEngineAnalysisTags } from '@/lib/geo/precision-diagnostics';
import { generateEngineSimulation } from '@/lib/geo/engine-simulation';
import { buildEngineOptimizationGuide } from '@/lib/geo/engine-optimization-guide';
import { pickExpandedTriggerQuery } from '@/lib/geo/query-location';
import { extractSpecialties } from '@/lib/geo/query-coverage';
import { generateQueryMatrix } from '@/lib/geo/query-matrix';
import { scoreFromDepthLevel } from '@/lib/geo/rating-meta';
import { withJosa } from '@/lib/korean-josa';
import {
	detectIndustry,
	fromLegacyAuditIndustry,
	getIndustryProfile,
	type SchemaOrgMainType,
} from '@/lib/registry/universalIndustryRegistry';
import {
	AI_ENGINE_CATALOG,
	AI_ENGINE_IDS,
	type AIEngineId,
	type AIEngineTestResult,
	type GeoDiagnosticReport,
	type KeywordDepthLevel,
} from '@/types/geo-diagnostic';
import type {
	AppliedGeoPatches,
	GeoMetaTag,
	GeoNapInfo,
	GeoSiteContext,
	PrescriptionAiSimulation,
	PrescriptionLang,
	SchemaOrgPrimaryType,
} from '@/types/geo-prescription';

const AFTER_LIFT: Record<AIEngineId, 1 | 2> = {
	chatgpt: 2,
	gemini: 1,
	claude: 1,
	perplexity: 2,
	copilot: 1,
	clova: 1,
};

const TRIGGER_LEVEL_LABEL: Record<PrescriptionLang, Record<0 | 1 | 2 | 3, string>> = {
	ko: {
		0: 'Level 0 미노출',
		1: 'Level 1 브랜드전용',
		2: 'Level 2 카테고리',
		3: 'Level 3 대화형 추천',
	},
	en: {
		0: 'Level 0 not indexed',
		1: 'Level 1 brand-only',
		2: 'Level 2 category',
		3: 'Level 3 unbranded conversational',
	},
};

export function canonicalSiteUrl(raw: string): string {
	const trimmed = (raw || '').trim();
	if (!trimmed) return 'https://example.com';
	try {
		const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		const u = new URL(withProtocol);
		u.hash = '';
		return u.toString().replace(/\/$/, '');
	} catch {
		return trimmed.replace(/\/$/, '');
	}
}

export function domainFromUrl(raw: string): string {
	try {
		const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
		return new URL(withProtocol).hostname.replace(/^www\./, '') || raw;
	} catch {
		return raw.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

export function toTriggerQueryRecord(queries: { level1: string; level2: string; level3: string }): Record<KeywordDepthLevel, string> {
	return { 1: queries.level1, 2: queries.level2, 3: queries.level3 };
}

export function triggerLevelLabel(level: KeywordDepthLevel | 0 | null, lang: PrescriptionLang): string {
	const key = (level ?? 0) as 0 | 1 | 2 | 3;
	return TRIGGER_LEVEL_LABEL[lang][key];
}

export function liftAfterLevel(before: KeywordDepthLevel | 0 | null | undefined, engineId: AIEngineId): 2 | 3 {
	const base = before == null ? 0 : before;
	const lifted = Math.min(3, base + AFTER_LIFT[engineId]);
	return (lifted < 2 ? 2 : lifted) as 2 | 3;
}

const REGISTRY_SCHEMA_TYPES: readonly SchemaOrgMainType[] = [
	'LegalService',
	'AccountingService',
	'BeautySalon',
	'HomeAndConstructionBusiness',
	'HealthClub',
	'VeterinaryCare',
	'EducationalOrganization',
	'RealEstateAgent',
	'Restaurant',
	'ProfessionalService',
	'MedicalClinic',
	'Dentist',
	'LocalBusiness',
];

function isTertiaryHospitalHay(hay: string): boolean {
	return /종합병원|university hospital|tertiary|상급종합/.test(hay);
}

export function resolveSchemaOrgType(input: {
	industryType?: IndustryType | string;
	keyword?: string;
	category?: string;
	existingTypes?: string[];
	description?: string;
	brandName?: string;
}): SchemaOrgPrimaryType {
	const hay = `${input.keyword || ''} ${input.category || ''} ${input.description || ''} ${(input.existingTypes || []).join(' ')}`.toLowerCase();
	const existing = (input.existingTypes || []).map((t) => t.replace(/^https?:\/\/schema\.org\//i, ''));

	const hasExisting = (type: SchemaOrgPrimaryType) => existing.some((t) => t.toLowerCase() === type.toLowerCase());
	const detected = detectIndustry({
		title: input.brandName,
		description: hay,
		keywords: [input.keyword, input.category].filter(Boolean).join(' '),
		extraText: existing.join(' '),
	});
	const type =
		detected !== 'general'
			? detected
			: input.industryType === 'MEDICAL'
				? 'medical'
				: fromLegacyAuditIndustry(input.industryType);
	const profile = getIndustryProfile(type);
	const registryType = profile.schemaType;
	const ignoreSoftwareApp = profile.type === 'professional' || registryType === 'ProfessionalService';

	for (const candidate of [
		'Dentist',
		'VeterinaryCare',
		'LegalService',
		'AccountingService',
		'HomeAndConstructionBusiness',
		'HealthClub',
		'EducationalOrganization',
		'RealEstateAgent',
		'MedicalClinic',
		'Restaurant',
		'BeautySalon',
		'OnlineStore',
		'SoftwareApplication',
		'Manufacturer',
		'Store',
		'ProfessionalService',
		'LocalBusiness',
	] as const) {
		if (candidate === 'SoftwareApplication' && ignoreSoftwareApp) continue;
		if (hasExisting(candidate)) return candidate;
	}
	if (hasExisting('Hospital')) {
		return isTertiaryHospitalHay(hay) ? 'Hospital' : 'MedicalClinic';
	}

	if (/치과|임플란트|dental|implant|orthodont/.test(hay)) return 'Dentist';
	if (/동물병원|반려동물|vet|pet\s*hospital/.test(hay)) return 'VeterinaryCare';

	if (profile.type === 'general' || profile.type === 'professional') {
		if (/쇼핑몰|온라인스토어|ecommerce|e-commerce|\bshop\b|스토어|장바구니|무료배송|상품/.test(hay)) {
			return 'OnlineStore';
		}
		if (/레스토랑|맛집|식당|카페|음식|restaurant|cafe|coffee/.test(hay)) return 'Restaurant';
		if (
			profile.type === 'general' &&
			/소프트웨어|saas|클라우드|software|cloud\b/.test(hay) &&
			!/상담|에이전시|컨설팅|agency|consult|연구소/.test(hay)
		) {
			return 'SoftwareApplication';
		}
		if (/제조|공장|oem|odm|부품|manufacturer|factory/.test(hay) || input.industryType === 'B2B_MFG') {
			return profile.type === 'professional' ? 'ProfessionalService' : 'Manufacturer';
		}
		if (/매장|\bstore\b/.test(hay)) return 'Store';
	}

	if ((REGISTRY_SCHEMA_TYPES as readonly string[]).includes(registryType)) {
		return registryType as SchemaOrgPrimaryType;
	}
	return 'LocalBusiness';
}

/** Single source of truth for generated JSON-LD @type (Answer Center + patches). */
export function resolveGeneratedSchemaType(ctx: Pick<
	GeoSiteContext,
	'industryType' | 'primaryKeyword' | 'category' | 'existingSchemaTypes' | 'description' | 'ogDescription' | 'brandName' | 'schemaType'
>): SchemaOrgPrimaryType {
	const resolved = resolveSchemaOrgType({
		industryType: ctx.industryType,
		keyword: ctx.primaryKeyword,
		category: ctx.category,
		existingTypes: ctx.existingSchemaTypes,
		description: ctx.description || ctx.ogDescription,
		brandName: ctx.brandName,
	});
	if (resolved === 'Hospital') return 'MedicalClinic';
	return resolved || ctx.schemaType;
}

export interface AppliedSchemaPropertyTag {
	key: string;
	value: string;
}

const SCHEMA_SUMMARY_KEYS = [
	'@type',
	'name',
	'url',
	'telephone',
	'address',
	'areaServed',
	'knowsAbout',
	'hasOfferCatalog',
	'availableService',
	'sameAs',
] as const;

function formatSchemaTagValue(value: unknown): string {
	if (value == null) return '';
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.map(formatSchemaTagValue).filter(Boolean).slice(0, 3).join(', ');
	}
	if (typeof value === 'object') {
		const rec = value as Record<string, unknown>;
		if (typeof rec.name === 'string' && rec.name.trim()) return rec.name;
		if (rec.streetAddress || rec.addressLocality || rec.addressRegion) {
			return [rec.streetAddress, rec.addressLocality, rec.addressRegion].filter(Boolean).join(' ');
		}
		if (typeof rec['@type'] === 'string') return rec['@type'];
	}
	return '';
}

function primaryEntityFromJsonLd(payload: Record<string, unknown>): Record<string, unknown> | null {
	const graph = payload['@graph'];
	if (Array.isArray(graph)) {
		const entity = graph.find((node) => {
			if (!node || typeof node !== 'object') return false;
			const type = (node as Record<string, unknown>)['@type'];
			return Boolean(type) && type !== 'WebSite' && type !== 'FAQPage';
		});
		return entity && typeof entity === 'object' ? (entity as Record<string, unknown>) : null;
	}
	return payload['@type'] ? payload : null;
}

export function summarizeAppliedSchemaTags(
	jsonLd: string | Record<string, unknown> | null | undefined,
	fallbackType?: string,
): AppliedSchemaPropertyTag[] {
	let payload: Record<string, unknown> | null = null;
	if (typeof jsonLd === 'string') {
		try {
			payload = JSON.parse(jsonLd) as Record<string, unknown>;
		} catch {
			payload = null;
		}
	} else if (jsonLd && typeof jsonLd === 'object') {
		payload = jsonLd;
	}
	const entity = payload ? primaryEntityFromJsonLd(payload) : null;
	const tags: AppliedSchemaPropertyTag[] = [];
	const seen = new Set<string>();
	const push = (key: string, value: string) => {
		const trimmed = value.trim();
		if (!trimmed || seen.has(key)) return;
		seen.add(key);
		tags.push({ key, value: trimmed });
	};
	if (entity) {
		for (const key of SCHEMA_SUMMARY_KEYS) {
			const formatted = formatSchemaTagValue(entity[key]);
			if (formatted) push(key, formatted);
		}
	}
	if (fallbackType) push('@type', fallbackType);
	return tags;
}

function entityNoun(ctx: GeoSiteContext): { ko: string; en: string } {
	switch (ctx.schemaType) {
		case 'Dentist':
			return { ko: '치과', en: 'dental clinic' };
		case 'VeterinaryCare':
			return { ko: '동물병원', en: 'pet hospital' };
		case 'Hospital':
			return { ko: '병원', en: 'hospital' };
		case 'MedicalClinic':
			return { ko: /병원/.test(ctx.brandName) && !/의원/.test(ctx.brandName) ? '병원' : '의원', en: 'clinic' };
		case 'LegalService':
			return { ko: '법률사무소', en: 'law firm' };
		case 'AccountingService':
			return { ko: '세무사무소', en: 'tax office' };
		case 'HomeAndConstructionBusiness':
			return { ko: '인테리어 업체', en: 'interior contractor' };
		case 'HealthClub':
			return { ko: '피트니스', en: 'fitness studio' };
		case 'EducationalOrganization':
			return { ko: '학원', en: 'academy' };
		case 'RealEstateAgent':
			return { ko: '부동산', en: 'real estate agency' };
		case 'Restaurant':
			return { ko: '식당', en: 'restaurant' };
		case 'BeautySalon':
			return { ko: '살롱', en: 'salon' };
		case 'OnlineStore':
		case 'Store':
			return { ko: '스토어', en: 'store' };
		case 'SoftwareApplication':
			return { ko: '소프트웨어 기업', en: 'software company' };
		case 'Manufacturer':
			return { ko: '제조 기업', en: 'manufacturer' };
		case 'LocalBusiness':
			return { ko: '지역 업체', en: 'local business' };
		default:
			return { ko: '기업', en: 'company' };
	}
}

export function buildFaqEntities(ctx: GeoSiteContext): Array<[string, string]> {
	const brand = ctx.brandName;
	const topic = ctx.primaryKeyword || ctx.category;
	const loc = ctx.location;
	const url = ctx.url;
	const en = ctx.lang === 'en';
	const noun = entityNoun(ctx);
	const place = loc ? (en ? ` in ${loc}` : ` ${loc}`) : '';

	switch (ctx.schemaType) {
		case 'Dentist':
		case 'VeterinaryCare':
		case 'Hospital':
		case 'MedicalClinic':
			return en
				? [
						[`Do you offer evening or weekend hours?`, `Yes. ${brand} publishes visiting hours in official schema so AI assistants can cite them accurately.`],
						[`How do I book an appointment?`, `Book through the official site ${url} or the phone number listed on the ${noun.en} entity.`],
						[`Where is ${brand} located?`, `${brand} lists NAP (name, address, phone)${loc ? ` for ${loc}` : ''} in Schema.org ${ctx.schemaType} markup.`],
						[`Which treatments or services are available?`, `${brand} structures core ${topic} services as FAQ and offer entities so AI search can quote them.`],
						[`Why should I choose ${brand}?`, `Official entity markup, consistent NAP, and citable FAQ pages help AI engines recommend ${brand} for ${topic}${place}.`],
					]
				: [
						['평일 야간 또는 주말 진료를 하나요?', `네. ${withJosa(brand, '은/는')} 공식 스키마에 진료/방문 시간을 명시해 AI가 정확히 인용할 수 있습니다.`],
						['예약은 어떻게 하나요?', `공식 사이트 ${url} 또는 스키마에 등록된 연락처로 예약할 수 있습니다.`],
						[`${brand} 위치는 어디인가요?`, `${brand}의 NAP(상호·주소·전화)${loc ? ` — ${loc}` : ''}는 Schema.org ${ctx.schemaType} 마크업에 포함되어 있습니다.`],
						['어떤 진료/서비스를 받을 수 있나요?', `${brand}의 핵심 ${topic} 서비스는 FAQ 및 Offer 엔티티로 구조화되어 AI가 인용할 수 있습니다.`],
						[`${withJosa(brand, '을/를')} 추천하는 이유는?`, `공식 엔티티 마크업, NAP 일치, 인용 가능한 FAQ가 ${place} ${topic} 질의에서 ${withJosa(brand, '을/를')} 추천 근거로 만듭니다.`],
					];
		case 'OnlineStore':
		case 'Store':
			return en
				? [
						[`What products does ${brand} sell?`, `${brand} focuses on ${topic}. Featured categories and offers are marked up for AI product citation.`],
						['How do shipping and returns work?', `Shipping, returns, and customer-service policies are published on ${url} and mirrored in FAQPage schema.`],
						['How do I place an order?', `Order directly on the official store ${url}. Entity markup points AI engines to this canonical checkout URL.`],
						[`Where is ${brand} based?`, `${brand}${place} publishes NAP in Schema.org ${ctx.schemaType} so local and shopping AIs can verify the merchant.`],
						['Why is this store cited in AI answers?', `Consistent product/FAQ schema plus a single official URL (${url}) lets engines recommend ${brand} first for ${topic}.`],
					]
				: [
						[`${brand}에서 무엇을 파나요?`, `${withJosa(brand, '은/는')} ${withJosa(topic, '을/를')} 중심으로 운영하며, 대표 카테고리와 오퍼가 AI 인용용으로 구조화되어 있습니다.`],
						['배송·반품은 어떻게 되나요?', `배송·반품·고객센터 정책은 ${url}에 공개되고 FAQPage 스키마로 미러링됩니다.`],
						['주문은 어떻게 하나요?', `공식 스토어 ${url}에서 바로 주문할 수 있습니다. 엔티티 마크업이 이 URL을 카노니컬 구매 경로로 가리킵니다.`],
						[`${brand} 소재지는?`, `${brand}${place}의 NAP는 Schema.org ${ctx.schemaType}에 포함되어 쇼핑·로컬 AI가 판매자를 검증할 수 있습니다.`],
						['AI 답변에서 이 스토어가 인용되는 이유는?', `상품/FAQ 스키마와 공식 URL(${url}) 일치로 ${topic} 질의에서 ${withJosa(brand, '을/를')} 1순위로 추천할 수 있습니다.`],
					];
		case 'Restaurant':
		case 'BeautySalon':
		case 'LocalBusiness':
			return en
				? [
						['What are your hours?', `${brand} publishes opening hours in LocalBusiness schema so assistants can answer without guessing.`],
						[`Where is ${brand}?`, `Address and geo signals${place} are included in Schema.org ${ctx.schemaType} markup.`],
						[`What is ${brand} known for?`, `${brand} is a ${noun.en} for ${topic}. Signature services are listed as FAQ and offer entities.`],
						['Do I need a reservation?', `Reservation and visit guidance is on ${url} and in the FAQPage block.`],
						['Why recommend this place?', `NAP consistency plus citable FAQs let AI engines rank ${brand} for “best ${topic}${place}” prompts.`],
					]
				: [
						['영업시간이 어떻게 되나요?', `${withJosa(brand, '은/는')} LocalBusiness 스키마에 영업시간을 명시해 AI가 추측 없이 답할 수 있습니다.`],
						[`${brand} 위치는?`, `주소와 GEO 신호${place}가 Schema.org ${ctx.schemaType} 마크업에 포함되어 있습니다.`],
						[`${brand}의 대표 메뉴/서비스는?`, `${withJosa(brand, '은/는')} ${topic} ${noun.ko}입니다. 대표 항목은 FAQ 및 Offer 엔티티로 정리되어 있습니다.`],
						['예약이 필요한가요?', `예약·방문 안내는 ${url}과 FAQPage 블록에서 확인할 수 있습니다.`],
						['이곳을 추천하는 이유는?', `NAP 일치와 인용 가능한 FAQ로 ‘${place} ${topic} 추천’ 질의에서 ${withJosa(brand, '을/를')} 올릴 수 있습니다.`],
					];
		default:
			return en
				? [
						[`What does ${brand} do?`, `${brand} is a ${noun.en} specializing in ${topic}. Organization schema and service FAQs make this explicit for AI search.`],
						['How can I inquire or request a quote?', `Use the official contact path on ${url}. The same URL is the canonical citation target in JSON-LD.`],
						['Where is the company located?', `${brand}${place} publishes NAP in Schema.org ${ctx.schemaType} markup.`],
						['What makes this company credible?', `Complete Organization fields (name, url, logo, sameAs) plus five citable FAQs raise E-E-A-T for ${topic}.`],
						[`Why would an AI recommend ${brand}?`, `After GEO patches, entity mentions and FAQPage data let engines cite ${brand} (${ctx.domain}) first for ${topic} prompts.`],
					]
				: [
						[`${withJosa(brand, '은/는')} 무엇을 하나요?`, `${withJosa(brand, '은/는')} ${topic} 전문 ${noun.ko}입니다. Organization 스키마와 서비스 FAQ가 AI 검색에 이를 명확히 전달합니다.`],
						['문의·견적은 어떻게 하나요?', `공식 경로 ${url}을 이용하세요. JSON-LD에서도 이 URL이 카노니컬 인용 대상입니다.`],
						['회사 위치는 어디인가요?', `${brand}${place}의 NAP는 Schema.org ${ctx.schemaType} 마크업에 포함되어 있습니다.`],
						['이 기업을 신뢰할 수 있는 이유는?', `Organization 필수 필드(name, url, logo, sameAs)와 인용 가능한 FAQ 5종이 ${topic} E-E-A-T를 높입니다.`],
						[`AI가 ${withJosa(brand, '을/를')} 추천하는 이유는?`, `GEO 패치 이후 엔티티 멘션과 FAQPage 데이터로 ${topic} 질의에서 ${brand}(${ctx.domain})을 1순위로 인용할 수 있습니다.`],
					];
	}
}

function postalAddress(ctx: GeoSiteContext): Record<string, unknown> | string | undefined {
	const nap = ctx.nap;
	if (nap.streetAddress || nap.addressLocality || nap.addressRegion) {
		return {
			'@type': 'PostalAddress',
			...(nap.streetAddress ? { streetAddress: nap.streetAddress } : {}),
			...(nap.addressLocality ? { addressLocality: nap.addressLocality } : {}),
			...(nap.addressRegion ? { addressRegion: nap.addressRegion } : {}),
			addressCountry: 'KR',
		};
	}
	if (nap.address) return nap.address;
	if (ctx.location) {
		return {
			'@type': 'PostalAddress',
			addressLocality: ctx.location,
			addressCountry: 'KR',
		};
	}
	return undefined;
}

export function buildPrescriptionJsonLd(ctx: GeoSiteContext): Record<string, unknown> {
	const schemaType = resolveGeneratedSchemaType(ctx);
	const address = postalAddress(ctx);
	const image = ctx.ogImage || `${ctx.url}/logo.png`;
	const description =
		ctx.ogDescription ||
		ctx.description ||
		(ctx.lang === 'en'
			? `${ctx.brandName} — ${ctx.primaryKeyword || ctx.category}`
			: `${ctx.brandName} — ${ctx.primaryKeyword || ctx.category}`);

	const primary: Record<string, unknown> = {
		'@type': schemaType,
		'@id': `${ctx.url}#entity`,
		name: ctx.brandName,
		url: ctx.url,
		image,
		description,
		...(ctx.nap.telephone ? { telephone: ctx.nap.telephone } : {}),
		...(address ? { address } : {}),
	};

	if (ctx.nap.latitude && ctx.nap.longitude) {
		primary.geo = {
			'@type': 'GeoCoordinates',
			latitude: ctx.nap.latitude,
			longitude: ctx.nap.longitude,
		};
	}
	if (ctx.location) primary.areaServed = ctx.location;
	if (ctx.primaryKeyword || ctx.specialties.length) {
		primary.knowsAbout = cleanMedicalEntities(
			[...ctx.specialties, ctx.primaryKeyword, ctx.category, ...ctx.targetKeywords],
			{ plasticOk: ctx.specialties.some((s) => /성형외과|plastic/i.test(s)), limit: 8 },
		);
	}

	if (schemaType === 'SoftwareApplication') {
		primary.applicationCategory = 'BusinessApplication';
		primary.operatingSystem = 'Web';
	}

	const website: Record<string, unknown> = {
		'@type': 'WebSite',
		'@id': `${ctx.url}#website`,
		name: ctx.brandName,
		url: ctx.url,
		publisher: { '@id': `${ctx.url}#entity` },
	};

	const faqPage: Record<string, unknown> = {
		'@type': 'FAQPage',
		'@id': `${ctx.url}#faq`,
		mainEntity: buildFaqEntities(ctx).map(([name, text]) => ({
			'@type': 'Question',
			name,
			acceptedAnswer: { '@type': 'Answer', text },
		})),
	};

	return {
		'@context': 'https://schema.org',
		'@graph': [primary, website, faqPage],
	};
}

export function wrapJsonLdScript(payload: Record<string, unknown>): string {
	return `<script type="application/ld+json">\n${JSON.stringify(payload, null, 2)}\n</script>`;
}

export function buildPrescriptionMetaTags(ctx: GeoSiteContext): GeoMetaTag[] {
	const title = ctx.ogTitle || `${ctx.brandName}${ctx.location ? ` | ${ctx.location}` : ''} ${ctx.primaryKeyword || ctx.category}`.trim();
	const description =
		ctx.ogDescription ||
		ctx.description ||
		(ctx.lang === 'en'
			? `${ctx.brandName} official site for ${ctx.primaryKeyword || ctx.category}${ctx.location ? ` in ${ctx.location}` : ''}.`
			: `${ctx.brandName} 공식 사이트. ${ctx.location ? `${ctx.location} ` : ''}${ctx.primaryKeyword || ctx.category} 정보·문의·FAQ.`);

	const tags: GeoMetaTag[] = [
		{ name: 'description', content: description },
		{ name: 'robots', content: 'index,follow,max-image-preview:large' },
		{ property: 'og:title', content: title },
		{ property: 'og:description', content: description },
		{ property: 'og:url', content: ctx.url },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:site_name', content: ctx.brandName },
		{ name: 'twitter:card', content: 'summary_large_image' },
	];
	if (ctx.ogImage) {
		tags.push({ property: 'og:image', content: ctx.ogImage });
		tags.push({ name: 'twitter:image', content: ctx.ogImage });
	}
	return tags;
}

export function buildEntityMentions(ctx: GeoSiteContext): string[] {
	return Array.from(
		new Set(
			[ctx.brandName, ctx.domain, ctx.url, ctx.location, ctx.primaryKeyword, ctx.category, ctx.schemaType, ...ctx.targetKeywords]
				.map((v) => (v || '').trim())
				.filter((v) => v.length >= 2),
		),
	).slice(0, 12);
}

export function buildAppliedPatches(ctx: GeoSiteContext): AppliedGeoPatches {
	const payload = buildPrescriptionJsonLd(ctx);
	const faqs = buildFaqEntities(ctx);
	return {
		jsonLd: JSON.stringify(payload, null, 2),
		jsonLdScript: wrapJsonLdScript(payload),
		faqCount: faqs.length,
		metaTags: buildPrescriptionMetaTags(ctx),
		schemaType: resolveGeneratedSchemaType(ctx),
		entityMentions: buildEntityMentions(ctx),
	};
}

function afterCopy(
	engineId: AIEngineId,
	ctx: GeoSiteContext,
	level: 2 | 3,
	l2: string,
	l3: string,
): { simulatedResponse: string; improvementTip: string } {
	const brand = ctx.brandName;
	const domain = ctx.domain;
	const url = ctx.url;
	const loc = ctx.location;
	const schema = ctx.schemaType;
	const en = ctx.lang === 'en';
	const engine = AI_ENGINE_CATALOG[engineId].name;
	const query = level === 3 ? l3 : l2;
	const attrHint = (ctx.attributeLabels || [])
		.map((label) => label.replace(/_속성_추가|_attribute_added/gi, ''))
		.filter(Boolean)
		.slice(0, 2)
		.join(en ? ', ' : '·');

	const sim = generateEngineSimulation(engineId, brand, loc, ctx.specialties, domain, {
		url,
		lang: ctx.lang,
		toBeQuery: query,
	});
	if (en) {
		const simulatedResponse =
			level === 3
				? `${sim.toBeResponse}${attrHint ? ` ${attrHint} is now citable via ${schema} + FAQPage.` : ''}`
				: `For “${query}”, ${brand} now appears in the local/category set. ${schema} entity data and NAP on ${domain} match the official site.`;
		const improvementTip =
			level === 3
				? `${engine} now cites ${brand} on unbranded conversational prompts. Keep FAQ, entity markup, and crawler access fresh to hold Level 3.`
				: `${engine} moved to category-level queries. Keep ${schema} JSON-LD and NAP in sync to push toward Level 3.`;
		return { simulatedResponse, improvementTip };
	}

	const simulatedResponse =
		level === 3
			? `${sim.toBeResponse}${attrHint ? ` ${attrHint} 속성이 ${schema}·FAQPage로 구조화되어 인용됩니다.` : ''}`
			: `‘${query}’ 질의에서 ${brand}이 카테고리 후보로 노출됩니다. ${schema} 엔티티와 NAP가 공식 사이트 ${domain}과 일치합니다.`;
	const improvementTip =
		level === 3
			? `${engine}가 비브랜드 대화형 질의에서 ${brand}을 1순위로 인용합니다. FAQ·엔티티·크롤러 신호를 유지해 Level 3를 지키세요.`
			: `${engine}가 카테고리 질의까지 올라왔습니다. ${schema} JSON-LD와 NAP를 유지하면 Level 3로 확장할 수 있습니다.`;
	return { simulatedResponse, improvementTip };
}

export function toAfterEngineResult(
	beforeEngine: AIEngineTestResult,
	ctx: GeoSiteContext,
	queries: GeoDiagnosticReport['triggerQueries'],
): AIEngineTestResult {
	const id = beforeEngine.engine.id;
	const depth = liftAfterLevel(beforeEngine.depthLevel, id);
	const copy = afterCopy(id, ctx, depth, queries[2], queries[3]);
	const prior = beforeEngine.analysisTags ?? [];
	const analysisTags = buildEngineAnalysisTags({
		lang: ctx.lang,
		engineId: id,
		statusBadge: depth === 3 ? 'optimal' : 'moderate',
		depthLevel: depth,
		improved: true,
		claudeBotBlocked: prior.some((tag) => tag.id === 'claude-bot' && tag.polarity === 'negative'),
		bingPlacesRegistered: prior.some((tag) => tag.id === 'bing' && tag.polarity === 'positive'),
		naverMentionIssue: prior.some((tag) => tag.id === 'naver' && tag.polarity === 'negative'),
		napMatchRate: 92,
		faqPresent: true,
		orgPresent: true,
		orgComplete: true,
		hasLocalBusinessSchema: true,
		googleMentionsLow: prior.some((tag) => tag.id === 'mentions' && tag.polarity === 'negative'),
		attributeLabels: ctx.attributeLabels,
	});
	const toBePack = buildToBeKeywordPack({
		lang: ctx.lang,
		location: ctx.location,
		category: ctx.specialties[0] || ctx.primaryKeyword || ctx.category,
		primaryKeyword: ctx.specialties[0] || ctx.primaryKeyword,
		brandName: ctx.brandName,
		businessEntity: ctx.businessEntity,
		needSignals: ctx.needSignals,
		specialties: ctx.specialties,
	});
	const syncedQueries = generateEngineSimulation(id, ctx.brandName, ctx.location, ctx.specialties, ctx.domain, {
		url: ctx.url,
		lang: ctx.lang,
	}).toBeQueries;
	const expandedTriggerQuery = pickExpandedTriggerQuery(id, toBePack, queries[depth] || syncedQueries[0] || '');
	const query =
		expandedTriggerQuery && !expandedTriggerQuery.toLowerCase().includes(ctx.brandName.toLowerCase())
			? expandedTriggerQuery
			: depth === 3
				? queries[3]
				: queries[2];
	const postOptimization = {
		targetLevel: 3 as const,
		targetLevelLabel: ctx.lang === 'en'
			? 'Level 3 excellent (unbranded recommend queries) — Answer Center 5 prescriptions (SSL + JSON-LD + /llms.txt)'
			: 'Level 3 우수 (비브랜드 추천 질의) — Answer Center 5대 처방(SSL + JSON-LD + /llms.txt)',
		expandedTriggerQuery: query,
		expectedSimulationResponse: depth === 3 ? copy.simulatedResponse : afterCopy(id, ctx, 3, queries[2], queries[3]).simulatedResponse,
		expandedCategoryQueries: toBePack.all.length ? toBePack.all : syncedQueries,
	};
	const shared = {
		engine: beforeEngine.engine,
		triggerQuery: query,
		simulatedResponse: copy.simulatedResponse,
		improvementTip: copy.improvementTip,
		analysisTags,
		currentStatus: beforeEngine.currentStatus,
		optimizationAdvice: beforeEngine.optimizationAdvice,
		optimizationGuide: buildEngineOptimizationGuide({
			engineId: id,
			currentLevel: depth,
			lang: ctx.lang,
			location: ctx.location,
			category: ctx.specialties[0] || ctx.primaryKeyword || ctx.category,
			specialties: ctx.specialties,
			needSignals: ctx.needSignals,
			brandName: ctx.brandName,
		}),
		postOptimization,
	};
	if (depth === 3) {
		return {
			...shared,
			score: Math.max(beforeEngine.score ?? 0, scoreFromDepthLevel(3)),
			statusBadge: 'optimal',
			depthLevel: 3,
		};
	}
	return {
		...shared,
		score: Math.max(beforeEngine.score ?? 0, scoreFromDepthLevel(2)),
		statusBadge: 'moderate',
		depthLevel: 2,
	};
}

export function buildAfterDiagnosticReport(
	before: GeoDiagnosticReport,
	ctx: GeoSiteContext,
	queries: GeoDiagnosticReport['triggerQueries'],
	lang: PrescriptionLang,
): GeoDiagnosticReport {
	const byId = new Map(before.engines.map((engine) => [engine.engine.id, engine]));
	const engines = AI_ENGINE_IDS.flatMap((id) => {
		const current = byId.get(id);
		if (current) return [toAfterEngineResult(current, ctx, queries)];
		const depth = liftAfterLevel(null, id);
		const stub: AIEngineTestResult = {
			engine: AI_ENGINE_CATALOG[id],
			score: scoreFromDepthLevel(null),
			triggerQuery: queries[1],
			simulatedResponse: '',
			improvementTip: '',
			statusBadge: 'not_indexed',
			depthLevel: null,
		};
		return [toAfterEngineResult(stub, ctx, queries)];
	});

	return {
		...before,
		caseId: 'high',
		caseLabel: lang === 'en' ? 'After GEO prescription' : 'GEO 처방전 적용 후',
		targetUrl: ctx.url,
		domain: ctx.domain,
		brandName: ctx.brandName,
		triggerQueries: queries,
		engines,
		engineAnalysisTags: Object.fromEntries(engines.map((engine) => [engine.engine.id, engine.analysisTags ?? []])),
		generatedAt: new Date().toISOString(),
	};
}

export function toAiSimulations(
	after: GeoDiagnosticReport,
	lang: PrescriptionLang,
): PrescriptionAiSimulation[] {
	return after.engines.map((engine) => ({
		engine: engine.engine.name,
		engineId: engine.engine.id,
		triggerLevel: triggerLevelLabel(engine.depthLevel, lang),
		triggerQuery: engine.triggerQuery,
		simulatedResponse: engine.simulatedResponse,
		officialUrl: after.targetUrl,
	}));
}

function textField(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'number') return String(value);
	if (value && typeof value === 'object' && 'name' in value) {
		return textField((value as { name?: unknown }).name);
	}
	return '';
}

function mergeNap(base: GeoNapInfo, extra: GeoNapInfo): GeoNapInfo {
	return {
		name: base.name || extra.name,
		telephone: base.telephone || extra.telephone,
		address: base.address || extra.address,
		streetAddress: base.streetAddress || extra.streetAddress,
		addressLocality: base.addressLocality || extra.addressLocality,
		addressRegion: base.addressRegion || extra.addressRegion,
		latitude: base.latitude || extra.latitude,
		longitude: base.longitude || extra.longitude,
	};
}

function napFromJsonLdNode(node: Record<string, unknown>): GeoNapInfo {
	const nap: GeoNapInfo = {};
	nap.name = textField(node.name) || undefined;
	nap.telephone = textField(node.telephone) || undefined;
	const geo = node.geo && typeof node.geo === 'object' ? (node.geo as Record<string, unknown>) : null;
	if (geo) {
		nap.latitude = textField(geo.latitude) || undefined;
		nap.longitude = textField(geo.longitude) || undefined;
	}
	const address = node.address;
	if (typeof address === 'string' && address.trim()) {
		nap.address = address.trim();
		return nap;
	}
	if (address && typeof address === 'object') {
		const addr = address as Record<string, unknown>;
		nap.streetAddress = textField(addr.streetAddress) || undefined;
		nap.addressLocality = textField(addr.addressLocality) || undefined;
		nap.addressRegion = textField(addr.addressRegion) || undefined;
		nap.address =
			[addr.addressRegion, addr.addressLocality, addr.streetAddress]
				.map((part) => textField(part))
				.filter(Boolean)
				.join(' ') || undefined;
	}
	return nap;
}

function collectJsonLdNodes(raw: unknown, out: Record<string, unknown>[]): void {
	if (!raw) return;
	if (Array.isArray(raw)) {
		for (const item of raw) collectJsonLdNodes(item, out);
		return;
	}
	if (typeof raw !== 'object') return;
	const node = raw as Record<string, unknown>;
	out.push(node);
	if (node['@graph']) collectJsonLdNodes(node['@graph'], out);
	if (node.mainEntity) collectJsonLdNodes(node.mainEntity, out);
}

/** NAP from the same crawled AuditReport used by Tab 1 / Tab 2 (JSON-LD snippets + siteMeta). */
export function napFromAuditReport(report: AuditReport): GeoNapInfo {
	const nap: GeoNapInfo = { name: report.siteMeta?.brandName || report.metrics?.pageTitle };
	for (const snippet of report.metrics?.jsonLdSnippets ?? []) {
		const body = snippet.replace(/\n…\s*$/, '').trim();
		if (!body.startsWith('{') && !body.startsWith('[')) continue;
		try {
			const nodes: Record<string, unknown>[] = [];
			collectJsonLdNodes(JSON.parse(body), nodes);
			for (const node of nodes) {
				Object.assign(nap, mergeNap(nap, napFromJsonLdNode(node)));
			}
		} catch {
			/* truncated or invalid snippet */
		}
	}
	if (!nap.addressLocality && report.siteMeta?.location) {
		nap.addressLocality = report.siteMeta.location;
	}
	if (!nap.address && (nap.streetAddress || nap.addressLocality || nap.addressRegion)) {
		nap.address = [nap.addressRegion, nap.addressLocality, nap.streetAddress].filter(Boolean).join(' ');
	}
	if (!nap.address && report.siteMeta?.location) {
		nap.address = report.siteMeta.location;
	}
	return nap;
}

/** Crawled specialty phrases for trigger / copy-center binding — never brand or location-only. */
export function collectAuditTargetKeywords(report: AuditReport): string[] {
	const matrix = generateQueryMatrix({
		lang: report.lang === 'en' ? 'en' : 'ko',
		siteMeta: report.siteMeta,
		metrics: report.metrics,
		detectedKeywords: report.detectedKeywords,
	});
	return cleanMedicalEntities(matrix.targetKeywords, {
		plasticOk: (report.siteMeta?.coreSpecialties || []).some((s) => /성형외과|plastic/i.test(s)),
		limit: 12,
	});
}

export function contextFromDiagnostic(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang,
	extra?: Partial<
		Pick<
			GeoSiteContext,
			| 'industryType'
			| 'category'
			| 'location'
			| 'targetKeywords'
			| 'existingSchemaTypes'
			| 'nap'
			| 'description'
			| 'ogTitle'
			| 'ogDescription'
			| 'businessEntity'
			| 'entityPhrases'
			| 'needSignals'
			| 'title'
			| 'metaKeywords'
			| 'navMenuTexts'
		>
	>,
): GeoSiteContext {
	const category = extra?.category || extra?.businessEntity || report.triggerQueries[2] || report.brandName;
	const keyword = extra?.businessEntity || extra?.category || category;
	const location = extra?.location || '';
	const industryType = extra?.industryType || 'GENERAL';
	const targetKeywords = cleanMedicalEntities(
		extra?.targetKeywords?.length ? extra.targetKeywords : [keyword].filter(Boolean),
		{ plasticOk: false, limit: 8 },
	);
	const draft: GeoSiteContext = {
		url: canonicalSiteUrl(report.targetUrl),
		domain: report.domain || domainFromUrl(report.targetUrl),
		brandName: report.brandName,
		category,
		primaryKeyword: keyword,
		location,
		industryType,
		schemaType: resolveGeneratedSchemaType({
			industryType,
			primaryKeyword: keyword,
			category,
			existingSchemaTypes: extra?.existingSchemaTypes || [],
			description: extra?.description,
			ogDescription: extra?.ogDescription,
			brandName: report.brandName,
			schemaType: 'LocalBusiness',
		}),
		lang,
		description: extra?.description || extra?.ogDescription,
		ogTitle: extra?.ogTitle,
		ogDescription: extra?.ogDescription,
		existingSchemaTypes: extra?.existingSchemaTypes || [],
		nap: extra?.nap || { name: report.brandName },
		targetKeywords,
		specialties: [],
		businessEntity: extra?.businessEntity || keyword,
		entityPhrases: extra?.entityPhrases,
		needSignals: extra?.needSignals,
		title: extra?.title,
		metaKeywords: extra?.metaKeywords,
		navMenuTexts: extra?.navMenuTexts,
	};
	draft.specialties = extractSpecialties(draft);
	draft.brandOnlyAsIs = extra && 'brandOnlyAsIs' in extra ? extra.brandOnlyAsIs : undefined;
	return draft;
}

export function emptyNap(): GeoNapInfo {
	return {};
}
