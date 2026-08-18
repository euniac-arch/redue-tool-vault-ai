/**
 * GEO Prescription Copy Center — paste-ready Schema / FAQ / maps / blog payloads.
 * Bound to the current site's 1–3 ranked specialty menus (never hardcoded clinics).
 */

import { buildLlmsTxtContent } from '@/lib/audit/advancedGeoMetrics';
import { cleanMedicalEntities, extractValidSpecialties } from '@/lib/geo/clean-medical-entities';
import { contextFromDiagnostic, resolveGeneratedSchemaType, wrapJsonLdScript } from '@/lib/geo/prescription-patches';
import { buildKeywordWeights } from '@/lib/geo/prompt-insights';
import { buildExpandedQueryCoverage, clinicFacilityNoun, isMedicalSchema } from '@/lib/geo/query-coverage';
import { withJosa } from '@/lib/korean-josa';
import {
	resolveIndustryConfigFromSite,
	toFaqPageJsonLd,
	type IndustryConfig,
} from '@/lib/registry/universalIndustryRegistry';
import type { GeoDiagnosticReport } from '@/types/geo-diagnostic';
import type {
	GeoSiteContext,
	KeywordWeight,
	PrescriptionLang,
	SchemaOrgPrimaryType,
} from '@/types/geo-prescription';
import type { PrescriptionAfterOptions } from '@/lib/geo/prescription-after';

export interface CopyCenterMenu {
	rank: 1 | 2 | 3;
	name: string;
	/** schema.org MedicalSpecialty URL when mappable. */
	specialtyId?: string;
}

export interface CopyCenterPayload {
	brandName: string;
	location: string;
	url: string;
	schemaType: SchemaOrgPrimaryType;
	menus: CopyCenterMenu[];
	schemaScript: string;
	schemaJson: string;
	faqScript: string;
	faqJson: string;
	mapsText: string;
	blogArticle: string;
	/** Standard `/llms.txt` markdown for Answer Center module 5. */
	llmsTxt: string;
}

const SPECIALTY_MAP: Array<{ test: RegExp; id: string }> = [
	{ test: /스포츠\s*재활|재활|physiotherapy|rehab|sport/i, id: 'https://schema.org/Physiotherapy' },
	{ test: /아동|소아|발달|pediatric|child/i, id: 'https://schema.org/Pediatric' },
	{ test: /정형|통증|ortho|pain|musculo/i, id: 'https://schema.org/Musculoskeletal' },
	{ test: /치과|임플란트|교정|dental|implant/i, id: 'https://schema.org/Dentistry' },
	{ test: /피부|dermat/i, id: 'https://schema.org/Dermatology' },
	{ test: /성형외과|성형수술|미용성형|plastic\s*surg/i, id: 'https://schema.org/PlasticSurgery' },
	{ test: /암|종양|중입자|cancer|oncolog/i, id: 'https://schema.org/Oncologic' },
	{ test: /산부|산과|gyneco|obstetric/i, id: 'https://schema.org/Gynecologic' },
	{ test: /한의|추나/i, id: 'https://schema.org/Physiotherapy' },
];

function menuFallbacks(config: IndustryConfig): string[] {
	if (config.lang === 'en') {
		return [config.primaryKeyword || config.defaultCategory, 'consultation', 'booking'];
	}
	return [config.primaryKeyword || config.defaultCategory, config.actionName, `${config.defaultCategory} 안내`];
}

export function industryConfigFromContext(ctx: GeoSiteContext, menus?: readonly CopyCenterMenu[]): IndustryConfig {
	const services = extractValidSpecialties((menus?.map((m) => m.name) ?? ctx.specialties).filter(Boolean));
	return resolveIndustryConfigFromSite({
		lang: ctx.lang,
		brandName: ctx.brandName,
		location: ctx.location,
		primaryKeyword: services[0] || ctx.primaryKeyword,
		category: ctx.category,
		services,
		domain: ctx.domain,
		url: ctx.url,
		legacyIndustry: ctx.industryType,
		title: ctx.title || ctx.brandName,
		description: ctx.description || ctx.ogDescription,
		keywords: [ctx.metaKeywords, ctx.category, ctx.primaryKeyword, ...(ctx.targetKeywords ?? [])].filter(Boolean).join(' '),
		schemaTypes: [ctx.schemaType, ...(ctx.existingSchemaTypes ?? [])],
		navMenuTexts: ctx.navMenuTexts,
	});
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactMenu(raw: string, location: string): string {
	const trimmed = (raw || '').replace(/\s+/g, ' ').trim();
	if (!trimmed) return '';
	if (!location) return trimmed;
	return trimmed.replace(new RegExp(`^${escapeRegExp(location)}\\s*[+·\\-]?\\s*`), '').trim() || trimmed;
}

function specialtyIdFor(name: string): string | undefined {
	return SPECIALTY_MAP.find((row) => row.test.test(name))?.id;
}

function menuNameFromWeight(row: KeywordWeight, location: string): string {
	const fromTokens = row.tokens.filter((token) => token && token !== location);
	if (fromTokens.length) return compactMenu(fromTokens[fromTokens.length - 1], location);
	if (row.label.includes('+')) {
		return compactMenu(row.label.split('+').pop() || row.label, location);
	}
	return compactMenu(row.label, location);
}

function pushUnique(target: string[], value: string): void {
	const v = value.replace(/\s+/g, ' ').trim();
	if (v.length < 2) return;
	if (target.some((item) => item.toLowerCase() === v.toLowerCase())) return;
	target.push(v);
}

function upgradeMenuName(name: string, pool: string[], used: string[]): string {
	const usedKey = new Set(used.map((item) => item.toLowerCase()));
	const richer = pool
		.filter((item) => {
			if (!item || item === name) return false;
			if (usedKey.has(item.toLowerCase())) return false;
			return item.includes(name) || name.includes(item);
		})
		.sort((a, b) => b.length - a.length)[0];
	return richer && richer.length > name.length ? richer : name;
}

function overlapsMenu(a: string, b: string): boolean {
	const left = a.toLowerCase();
	const right = b.toLowerCase();
	return left === right || left.includes(right) || right.includes(left);
}

function pushUniqueMenu(target: string[], value: string, pool: string[]): void {
	const compact = value.replace(/\s+/g, ' ').trim();
	if (compact.length < 2) return;
	const upgraded = upgradeMenuName(compact, pool, target);
	const overlapAt = target.findIndex((item) => overlapsMenu(item, upgraded));
	if (overlapAt >= 0) {
		if (upgraded.length > target[overlapAt].length) target[overlapAt] = upgraded;
		return;
	}
	target.push(upgraded);
}

export function resolveTopMenus(
	ctx: GeoSiteContext,
	weights?: readonly KeywordWeight[] | null,
): CopyCenterMenu[] {
	const loc = ctx.location;
	const coverage = buildExpandedQueryCoverage(ctx);
	const ranked = (weights && weights.length ? [...weights] : buildKeywordWeights(ctx, coverage)).sort(
		(a, b) => b.weight - a.weight,
	);
	const names: string[] = [];
	const pool = extractValidSpecialties(
		cleanMedicalEntities(
			[...ctx.specialties, ...coverage.specialties].map((spec) => compactMenu(spec, loc)),
			{ plasticOk: /성형외과|성형수술|미용성형|plastic\s*surg/i.test([...ctx.specialties, ...coverage.specialties].join(' ')), limit: 8 },
		),
	);

	for (const row of ranked) {
		pushUniqueMenu(names, menuNameFromWeight(row, loc), pool);
		if (names.length >= 3) break;
	}
	for (const spec of pool) {
		pushUniqueMenu(names, spec, pool);
		if (names.length >= 3) break;
	}
	pushUniqueMenu(names, compactMenu(ctx.primaryKeyword || ctx.category, loc), pool);

	const fallbacks = menuFallbacks(industryConfigFromContext(ctx));
	for (const extra of fallbacks) {
		if (names.length >= 3) break;
		pushUniqueMenu(names, extra, pool);
	}

	return names.slice(0, 3).map((name, index) => ({
		rank: (index + 1) as 1 | 2 | 3,
		name,
		specialtyId: specialtyIdFor(name),
	}));
}

function joinMenus(menus: CopyCenterMenu[], lang: PrescriptionLang): string {
	const names = menus.map((m) => m.name);
	if (lang === 'en') {
		if (names.length <= 1) return names[0] || 'core services';
		return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
	}
	return names.join('·');
}

function placePrefix(location: string, lang: PrescriptionLang): string {
	if (!location) return '';
	return lang === 'en' ? ` in ${location}` : ` ${location}`;
}

function naverCategory(menu1: string, schema: SchemaOrgPrimaryType, defaultCategory: string): string {
	if (/아동|소아|발달|pediatric|child/i.test(menu1)) return '소아청소년과';
	if (/스포츠\s*재활|재활|physiotherapy|rehab/i.test(menu1)) return '재활의학과';
	if (/정형|통증|ortho|pain/i.test(menu1)) return '정형외과';
	if (/치과|임플란트|dental|implant/i.test(menu1)) return '치과';
	if (/피부|dermat/i.test(menu1)) return '피부과';
	if (/성형외과|성형수술|미용성형|plastic\s*surg/i.test(menu1)) return '성형외과';
	if (/한의|추나/i.test(menu1)) return '한의원';
	if (/암|종양|cancer|oncolog/i.test(menu1)) return '병원';
	if (schema === 'Dentist') return '치과';
	if (schema === 'VeterinaryCare') return '동물병원';
	if (schema === 'Hospital') return '병원';
	if (schema === 'MedicalClinic') return '의원';
	if (schema === 'LegalService') return '변호사';
	if (schema === 'AccountingService') return '세무사';
	if (schema === 'HomeAndConstructionBusiness') return '인테리어';
	if (schema === 'HealthClub') return '피트니스';
	if (schema === 'EducationalOrganization') return '학원';
	if (schema === 'RealEstateAgent') return '부동산';
	if (schema === 'ProfessionalService') return '전문서비스';
	if (schema === 'Restaurant') return '음식점';
	if (schema === 'BeautySalon') return '미용실';
	if (schema === 'Store' || schema === 'OnlineStore') return '종합도소매';
	return defaultCategory || '서비스';
}

function googleCategory(menu1: string, schema: SchemaOrgPrimaryType, lang: PrescriptionLang): string {
	const en = lang === 'en';
	if (/아동|소아|발달|pediatric|child/i.test(menu1)) return en ? 'Child development center' : '아동발달센터 / Pediatric clinic';
	if (/스포츠\s*재활|재활|physiotherapy|rehab/i.test(menu1)) {
		return en ? 'Physical therapist / Rehabilitation center' : '재활의학과 / Physical therapist';
	}
	if (/정형|통증|ortho|pain/i.test(menu1)) return en ? 'Orthopedic clinic / Pain clinic' : '정형외과 / Orthopedic clinic';
	if (/치과|dental/i.test(menu1)) return en ? 'Dental clinic' : '치과 / Dental clinic';
	if (/피부|dermat/i.test(menu1)) return en ? 'Dermatologist' : '피부과 / Dermatologist';
	if (/성형외과|성형수술|미용성형|plastic\s*surg/i.test(menu1)) return en ? 'Plastic surgeon' : '성형외과 / Plastic surgeon';
	if (schema === 'VeterinaryCare') return en ? 'Veterinary care' : '동물병원 / Veterinary care';
	if (schema === 'Hospital') return en ? 'Hospital' : '병원 / Hospital';
	if (schema === 'MedicalClinic' || schema === 'Dentist') return en ? 'Medical clinic' : '의원 / Medical clinic';
	if (schema === 'LegalService') return en ? 'Law firm / Legal service' : '법률사무소 / Legal service';
	if (schema === 'AccountingService') return en ? 'Accountant / Tax office' : '세무회계 / Accounting service';
	if (schema === 'HomeAndConstructionBusiness') return en ? 'Interior contractor' : '인테리어 / Home & construction';
	if (schema === 'HealthClub') return en ? 'Health club / Gym' : '피트니스 / Health club';
	if (schema === 'EducationalOrganization') return en ? 'Educational organization' : '학원 / Educational organization';
	if (schema === 'RealEstateAgent') return en ? 'Real estate agent' : '부동산 / Real estate agent';
	if (schema === 'ProfessionalService') return en ? 'Professional service' : '전문 서비스 / Professional service';
	if (schema === 'Restaurant') return en ? 'Restaurant' : '음식점 / Restaurant';
	if (schema === 'BeautySalon') return en ? 'Beauty salon' : '미용실 / Beauty salon';
	if (schema === 'Store' || schema === 'OnlineStore') return en ? 'Store' : '스토어 / Store';
	return en ? 'Local business' : '지역 업체 / Local business';
}

function keywordTags(ctx: GeoSiteContext, menus: CopyCenterMenu[]): string[] {
	const loc = ctx.location;
	const tags: string[] = [];
	for (const menu of menus) {
		pushUnique(tags, loc ? `${loc}${menu.name}` : menu.name);
	}
	pushUnique(tags, loc ? `${loc}${clinicFacilityNoun(ctx.schemaType, ctx.brandName, ctx.lang)}` : ctx.brandName);
	const extra = (ctx.needSignals ?? []).find((n) => /야간|evening|상담|consult/i.test(n));
	if (extra) {
		pushUnique(tags, loc ? `${loc}${extra}` : extra);
	} else if (isMedicalSchema(ctx.schemaType) || ctx.industryType === 'MEDICAL') {
		pushUnique(tags, ctx.lang === 'en' ? 'official clinic' : `공식${clinicFacilityNoun(ctx.schemaType, ctx.brandName, 'ko')}`);
	} else {
		pushUnique(tags, ctx.lang === 'en' ? 'official site' : '공식사이트');
	}
	pushUnique(tags, ctx.brandName.replace(/\s+/g, ''));
	return tags.slice(0, 5);
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

function entityType(ctx: GeoSiteContext, config?: IndustryConfig): SchemaOrgPrimaryType {
	const generated = resolveGeneratedSchemaType(ctx);
	if (isMedicalSchema(generated) && generated !== 'Hospital') return generated;
	if (generated === 'Hospital') return 'MedicalClinic';
	const resolved = config ?? industryConfigFromContext(ctx);
	if (generated === 'SoftwareApplication' && (resolved.schemaType === 'ProfessionalService' || resolved.type === 'professional')) {
		return 'ProfessionalService';
	}
	return generated || (resolved.schemaType as SchemaOrgPrimaryType) || ctx.schemaType;
}

function serviceType(ctx: GeoSiteContext): 'MedicalTherapy' | 'Service' {
	return isMedicalSchema(ctx.schemaType) || ctx.industryType === 'MEDICAL' ? 'MedicalTherapy' : 'Service';
}

export function buildClinicJsonLd(ctx: GeoSiteContext, menus: CopyCenterMenu[]): Record<string, unknown> {
	const config = industryConfigFromContext(ctx, menus);
	const type = entityType(ctx, config);
	const medical = isMedicalSchema(type) || config.type === 'medical';
	const services = extractValidSpecialties(menus.map((m) => m.name));
	const description =
		ctx.ogDescription ||
		ctx.description ||
		(ctx.lang === 'en'
			? `${ctx.brandName} — ${joinMenus(menus, 'en')}${placePrefix(ctx.location, 'en')} ${config.defaultCategory}.`
			: `${ctx.brandName} —${placePrefix(ctx.location, 'ko')} ${config.defaultCategory}, ${joinMenus(menus, 'ko')} 전문.`);
	const address = postalAddress(ctx);
	const specialtyIds = menus.map((m) => m.specialtyId).filter((id): id is string => Boolean(id));
	const specialtyNodes = menus.map((menu) => ({
		'@type': 'MedicalSpecialty',
		...(menu.specialtyId ? { '@id': menu.specialtyId } : {}),
		name: menu.name,
	}));

	const entity: Record<string, unknown> = {
		'@type': type,
		'@id': `${ctx.url}#entity`,
		name: ctx.brandName,
		url: ctx.url,
		image: ctx.ogImage || `${ctx.url}/logo.png`,
		description,
		...(ctx.nap.telephone ? { telephone: ctx.nap.telephone } : {}),
		...(address ? { address } : {}),
		...(ctx.location ? { areaServed: ctx.location } : {}),
		knowsAbout: services,
		hasOfferCatalog: {
			'@type': 'OfferCatalog',
			name: ctx.lang === 'en' ? `${config.defaultCategory} services` : `${config.defaultCategory} 서비스`,
			itemListElement: services.map((name) => ({
				'@type': 'Offer',
				itemOffered: {
					'@type': serviceType(ctx),
					name,
					url: ctx.url,
				},
			})),
		},
		availableService: services.map((name) => ({
			'@type': serviceType(ctx),
			name,
			url: ctx.url,
		})),
	};

	if (ctx.nap.latitude && ctx.nap.longitude) {
		entity.geo = {
			'@type': 'GeoCoordinates',
			latitude: ctx.nap.latitude,
			longitude: ctx.nap.longitude,
		};
	}

	if (medical) {
		entity.medicalSpecialty = specialtyNodes.length ? specialtyNodes : specialtyIds;
	}

	return {
		'@context': 'https://schema.org',
		'@graph': [
			entity,
			{
				'@type': 'WebSite',
				'@id': `${ctx.url}#website`,
				name: ctx.brandName,
				url: ctx.url,
				publisher: { '@id': `${ctx.url}#entity` },
			},
		],
	};
}

function citeMissingServices(
	faqs: Array<{ question: string; answer: string }>,
	services: readonly string[],
	lang: PrescriptionLang,
): Array<{ question: string; answer: string }> {
	if (!faqs.length || !services.length) return faqs;
	const hay = faqs.map((faq) => `${faq.question} ${faq.answer}`).join(' ');
	const missing = services.filter((name) => name && !hay.includes(name));
	if (!missing.length) return faqs;
	const cited = lang === 'en' ? ` Ranked services: ${services.join(', ')}.` : ` 주력 서비스는 ${services.join(', ')}입니다.`;
	return faqs.map((faq, index) => (index === 1 ? { ...faq, answer: `${faq.answer}${cited}` } : faq));
}

export function buildCitationFaqs(
	ctx: GeoSiteContext,
	menus: CopyCenterMenu[],
): Array<{ question: string; answer: string }> {
	const config = industryConfigFromContext(ctx, menus);
	const services = extractValidSpecialties(menus.map((m) => m.name));
	const faqs = config.profile.faqGenerator({
		brandName: ctx.brandName,
		location: ctx.location,
		primaryKeyword: services[0] || config.primaryKeyword,
		services,
		domain: ctx.domain,
		url: ctx.url,
		lang: ctx.lang,
	});
	return citeMissingServices(faqs, services, ctx.lang);
}

export function buildFaqPageJsonLd(
	ctx: GeoSiteContext,
	faqs: Array<{ question: string; answer: string }>,
): Record<string, unknown> {
	return toFaqPageJsonLd(faqs, { url: ctx.url, lang: ctx.lang });
}

export function buildMapsText(ctx: GeoSiteContext, menus: CopyCenterMenu[]): string {
	const config = industryConfigFromContext(ctx, menus);
	const type = entityType(ctx, config);
	const tags = keywordTags(ctx, menus);
	const joined = joinMenus(menus, ctx.lang);
	const ranks = menus.map((m) => (ctx.lang === 'en' ? `#${m.rank} ${m.name}` : `${m.rank}순위 ${m.name}`)).join(ctx.lang === 'en' ? ', ' : ' · ');
	const naver = naverCategory(menus[0]?.name || ctx.category, type, config.defaultCategory);
	const google = googleCategory(menus[0]?.name || ctx.category, type, ctx.lang);
	const tagLine = tags.map((tag) => `#${tag.replace(/\s+/g, '')}`).join(' ');
	const noun = config.defaultCategory || clinicFacilityNoun(type, ctx.brandName, ctx.lang);

	if (ctx.lang === 'en') {
		const intro = `${ctx.brandName} is a ${noun}${placePrefix(ctx.location, 'en')} focused on ${joined}. Ranked services: ${ranks}. Hours, booking, and official details: ${ctx.url}.`;
		return [
			'[Recommended primary category]',
			`Naver Smart Place: ${naver}`,
			`Google Maps: ${google}`,
			'',
			'[Business description — ranks 1–3]',
			intro,
			'',
			'[Keyword tags (5)]',
			tagLine,
		].join('\n');
	}

	const intro = `${withJosa(ctx.brandName, '은/는')}${placePrefix(ctx.location, 'ko')} ${withJosa(joined, '을/를')} 주력으로 운영하는 ${noun}입니다. 대표 메뉴는 ${ranks}이며, 예약·위치·안내는 공식 사이트 ${ctx.url}에서 확인할 수 있습니다.`;
	return [
		'[추천 대표 카테고리]',
		`네이버 스마트플레이스: ${naver}`,
		`Google 지도: ${google}`,
		'',
		'[1~3순위 반영 업체 소개글]',
		intro,
		'',
		'[키워드 태그 5개]',
		tagLine,
	].join('\n');
}

export function buildBlogArticle(ctx: GeoSiteContext, menus: CopyCenterMenu[]): string {
	const config = industryConfigFromContext(ctx, menus);
	const faqs = buildCitationFaqs(ctx, menus);
	const m1 = menus[0]?.name || config.primaryKeyword || config.defaultCategory;
	const loc = ctx.location;
	const joined = joinMenus(menus, ctx.lang);
	const category = config.defaultCategory;

	if (ctx.lang === 'en') {
		const title = loc
			? `Looking for ${m1} in ${loc}? ${ctx.brandName} ${category} Q&A`
			: `Looking for ${m1}? ${ctx.brandName} ${category} Q&A`;
		const lead = `${ctx.brandName} is a ${category} that publishes official answers for ${joined}${placePrefix(loc, 'en')}. The source URL to cite is ${ctx.url}.`;
		const body = faqs
			.slice(0, 4)
			.map((faq) => `Q. ${faq.question}\nA. ${faq.answer}`)
			.join('\n\n');
		return `${title}\n\n${lead}\n\n${body}\n\nOfficial site: ${ctx.url}`;
	}

	const title = loc ? `${loc}에서 ${m1} 찾는다면? ${ctx.brandName} Q&A 가이드` : `${m1} 찾는다면? ${ctx.brandName} Q&A 가이드`;
	const lead = `${withJosa(ctx.brandName, '은/는')}${placePrefix(loc, 'ko')} ${category}로 ${withJosa(joined, '을/를')} 중심으로 안내합니다. ChatGPT·Perplexity·네이버 블로그에 그대로 붙여 넣을 수 있는 공식 답변이며, 출처 URL은 ${ctx.url}입니다.`;
	const body = faqs
		.slice(0, 4)
		.map((faq) => `Q. ${faq.question}\nA. ${faq.answer}`)
		.join('\n\n');
	return `${title}\n\n${lead}\n\n${body}\n\n공식 사이트: ${ctx.url}`;
}

export type RankedTargetKeywords = [string, string, string];

function siteContext(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang,
	opts?: PrescriptionAfterOptions,
): GeoSiteContext {
	return contextFromDiagnostic(report, lang, {
		industryType: opts?.industryType,
		category: opts?.category,
		location: opts?.location,
		targetKeywords: opts?.targetKeywords,
		existingSchemaTypes: opts?.existingSchemaTypes,
		description: opts?.description || opts?.ogDescription,
		ogTitle: opts?.ogTitle,
		ogDescription: opts?.ogDescription,
		businessEntity: opts?.businessEntity,
		entityPhrases: opts?.entityPhrases,
		needSignals: opts?.needSignals,
		nap: opts?.nap,
	});
}

export function padTargetKeywords(names: readonly string[]): RankedTargetKeywords {
	return [names[0] || '', names[1] || '', names[2] || ''];
}

/** Unique, trimmed rank-1~3 keywords (empty slots dropped). */
export function normalizeTargetKeywords(keywords: readonly string[]): string[] {
	const names: string[] = [];
	for (const raw of cleanMedicalEntities(keywords, { plasticOk: true, limit: 8 })) {
		pushUnique(names, raw);
		if (names.length >= 3) break;
	}
	return names;
}

export function menusFromTargetKeywords(keywords: readonly string[]): CopyCenterMenu[] {
	return extractValidSpecialties(normalizeTargetKeywords(keywords)).map((name, index) => ({
		rank: (index + 1) as 1 | 2 | 3,
		name,
		specialtyId: specialtyIdFor(name),
	}));
}

function assemblePayload(ctx: GeoSiteContext, menus: CopyCenterMenu[]): CopyCenterPayload {
	const filtered = menus
		.filter((menu) => extractValidSpecialties([menu.name]).length > 0)
		.map((menu, index) => ({ ...menu, rank: (index + 1) as 1 | 2 | 3 }));
	const clinic = buildClinicJsonLd(ctx, filtered);
	const faqs = buildCitationFaqs(ctx, filtered);
	const faqPage = buildFaqPageJsonLd(ctx, faqs);
	return {
		brandName: ctx.brandName,
		location: ctx.location,
		url: ctx.url,
		schemaType: entityType(ctx, industryConfigFromContext(ctx, filtered)),
		menus: filtered,
		schemaJson: JSON.stringify(clinic, null, 2),
		schemaScript: wrapJsonLdScript(clinic),
		faqJson: JSON.stringify(faqPage, null, 2),
		faqScript: wrapJsonLdScript(faqPage),
		mapsText: buildMapsText(ctx, filtered),
		blogArticle: buildBlogArticle(ctx, filtered),
		llmsTxt: buildLlmsTxtContent({
			brandName: ctx.brandName,
			location: ctx.location,
			services: filtered.map((menu) => menu.name),
			nap: ctx.nap,
			url: ctx.url,
			domain: ctx.domain,
			primaryKeyword: ctx.primaryKeyword,
			title: ctx.title,
			description: ctx.description || ctx.ogDescription,
			legacyIndustry: ctx.industryType,
			lang: ctx.lang,
		}),
	};
}

export function resolveCopyCenterMenus(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
	keywordWeights?: readonly KeywordWeight[] | null,
): CopyCenterMenu[] {
	return resolveTopMenus(siteContext(report, lang, opts), keywordWeights);
}

/** Select-box candidates: AI ranks, specialty tokens, and site keywords. */
export function collectCopyCenterKeywordOptions(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
	keywordWeights?: readonly KeywordWeight[] | null,
): string[] {
	const ctx = siteContext(report, lang, opts);
	const loc = ctx.location;
	const names: string[] = [];
	const ranked = (keywordWeights && keywordWeights.length ? [...keywordWeights] : buildKeywordWeights(ctx, buildExpandedQueryCoverage(ctx))).sort(
		(a, b) => b.weight - a.weight,
	);

	for (const menu of resolveTopMenus(ctx, ranked)) {
		pushUnique(names, menu.name);
	}
	for (const row of ranked) {
		pushUnique(names, menuNameFromWeight(row, loc));
		for (const token of row.tokens) {
			if (token && token !== loc) pushUnique(names, compactMenu(token, loc));
		}
	}
	for (const spec of ctx.specialties) pushUnique(names, compactMenu(spec, loc));
	for (const keyword of cleanMedicalEntities(ctx.targetKeywords, { plasticOk: ctx.specialties.some((s) => /성형외과|plastic/i.test(s)), limit: 12 })) {
		pushUnique(names, compactMenu(keyword, loc));
	}
	pushUnique(names, compactMenu(ctx.primaryKeyword || ctx.category, loc));
	return cleanMedicalEntities(names, {
		plasticOk: ctx.specialties.some((s) => /성형외과|plastic/i.test(s)),
		limit: 16,
	});
}

/**
 * Live re-generation: rebuild Schema / FAQ / maps / blog from explicit 1~3 keywords.
 * Clipboard copy must use these four strings after a keyword change.
 */
export function generatePrescriptionCode(
	report: GeoDiagnosticReport,
	keywords: readonly string[],
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
): CopyCenterPayload {
	const normalized = normalizeTargetKeywords(keywords);
	const ctx = siteContext(report, lang, {
		...opts,
		targetKeywords: normalized.length ? normalized : opts?.targetKeywords,
	});
	const menus = normalized.length ? menusFromTargetKeywords(normalized) : resolveTopMenus(ctx);
	return assemblePayload(ctx, menus);
}

/** The four paste payloads bound to the Copy buttons. */
export function copyCenterClipboardBundle(payload: CopyCenterPayload): {
	schema: string;
	faq: string;
	maps: string;
	blog: string;
	llms: string;
} {
	return {
		schema: payload.schemaScript,
		faq: payload.faqScript,
		maps: payload.mapsText,
		blog: payload.blogArticle,
		llms: payload.llmsTxt,
	};
}

/** Paste-ready copy-center payload for the current diagnostic site. */
export function buildCopyCenterPayload(
	report: GeoDiagnosticReport,
	lang: PrescriptionLang = 'ko',
	opts?: PrescriptionAfterOptions,
	keywordWeights?: readonly KeywordWeight[] | null,
): CopyCenterPayload {
	const ctx = siteContext(report, lang, opts);
	return assemblePayload(ctx, resolveTopMenus(ctx, keywordWeights));
}

export function isValidCopyCenterPayload(payload: CopyCenterPayload): boolean {
	if (payload.menus.length < 1 || payload.menus.length > 3) return false;
	const menuKeys = payload.menus.map((menu) => menu.name.toLowerCase());
	if (new Set(menuKeys).size !== menuKeys.length) return false;
	if (!payload.schemaScript.includes('application/ld+json')) return false;
	if (!payload.faqScript.includes('FAQPage')) return false;
	if (!payload.faqJson.includes('"@type": "Question"')) return false;
	const questionCount = payload.faqJson.split('"@type": "Question"').length - 1;
	if (questionCount !== 5) return false;
	if (!payload.schemaJson.includes(payload.brandName) || !payload.schemaJson.includes(payload.url)) return false;
	for (const menu of payload.menus) {
		if (!payload.schemaJson.includes(menu.name)) return false;
		if (!payload.mapsText.includes(menu.name)) return false;
		if (!payload.blogArticle.includes(menu.name)) return false;
	}
	const tagCount = (payload.mapsText.match(/#/g) || []).length;
	if (tagCount < 5) return false;
	try {
		JSON.parse(payload.schemaJson);
		JSON.parse(payload.faqJson);
	} catch {
		return false;
	}
	if (payload.llmsTxt && !payload.llmsTxt.includes(payload.brandName)) return false;
	return Boolean(payload.schemaScript && payload.faqScript && payload.mapsText && payload.blogArticle && payload.llmsTxt);
}
