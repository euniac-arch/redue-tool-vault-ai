/**
 * Ready-to-paste JSON-LD fix snippets — generated only for schemas that the
 * live crawl actually found missing or incomplete (same fail/warn filter as
 * `buildPrioritizedActions`). Values are filled from crawled `siteMeta` /
 * NAP / specialties. Article/NewsArticle is emitted only for press/media.
 */

import { extractRepresentative } from '@/lib/audit/extractors/entity';
import { isNewsMediaVertical } from '@/lib/audit/recommended-schemas';
import { schemaMappingFromReport } from '@/lib/audit/live-criteria';
import { extractValidSpecialties } from '@/lib/geo/clean-medical-entities';
import {
	buildFaqEntities,
	canonicalSiteUrl,
	collectAuditTargetKeywords,
	domainFromUrl,
	napFromAuditReport,
	resolveSchemaOrgType,
} from '@/lib/geo/prescription-patches';
import { resolveIndustryConfigFromSite, toFaqPageJsonLd } from '@/lib/registry/universalIndustryRegistry';
import type { AuditCheckItem, AuditLang, AuditReport } from '@/lib/site-auditor';
import type { GeoNapInfo, GeoSiteContext, SchemaOrgPrimaryType } from '@/types/geo-prescription';

export type JsonLdSnippetSchema = 'organization' | 'article' | 'person' | 'faq';

export interface JsonLdFixSnippet {
	id: JsonLdSnippetSchema;
	schemaType: string;
	title: string;
	description: string;
	code: string;
}

const PLACEHOLDER_RE = /\{\{\s*[^}]+\s*\}\}/;

function resolveStatus(check: AuditCheckItem): 'pass' | 'fail' | 'warning' {
	return check.status ?? (check.passed ? 'pass' : 'fail');
}

function findCheck(checks: AuditCheckItem[], id: string): AuditCheckItem | undefined {
	return checks.find((c) => c.id === id);
}

function needsFix(checks: AuditCheckItem[], id: string): boolean {
	const check = findCheck(checks, id);
	return check ? resolveStatus(check) !== 'pass' : false;
}

function pretty(obj: unknown): string {
	return JSON.stringify(obj, null, 2);
}

function wrapScript(payload: Record<string, unknown>): string {
	return `<script type="application/ld+json">\n${pretty(payload)}\n</script>`;
}

function absoluteUrl(raw: string | undefined, fallback: string): string {
	const value = (raw || '').trim();
	if (/^https?:\/\//i.test(value)) return value;
	if (value.startsWith('//')) return `https:${value}`;
	return fallback;
}

function logoFromReport(report: AuditReport, siteUrl: string): string {
	const stored = (report.logoUrl || report.siteMeta?.logoUrl || '').trim();
	if (/^https?:\/\//i.test(stored)) return stored;
	const fallback = `${siteUrl}/logo.png`;
	for (const snippet of report.metrics?.jsonLdSnippets ?? []) {
		const logoObject = snippet.match(
			/"logo"\s*:\s*\{[^}]*"url"\s*:\s*"(https?:[^"]+)"/i,
		);
		if (logoObject?.[1]) return logoObject[1];
		const logoPlain = snippet.match(/"logo"\s*:\s*"(https?:[^"]+)"/i);
		if (logoPlain?.[1]) return logoPlain[1];
		const image = snippet.match(/"image"\s*:\s*"(https?:[^"]+)"/i);
		if (image?.[1]) return image[1];
	}
	return absoluteUrl(report.siteMeta?.ogImage, fallback);
}

function postalAddress(nap: GeoNapInfo, location: string): Record<string, unknown> | string | undefined {
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
	if (location) {
		return {
			'@type': 'PostalAddress',
			addressLocality: location,
			addressCountry: 'KR',
		};
	}
	return undefined;
}

function sameAsFromReport(report: AuditReport, siteUrl: string): string[] {
	const found = new Set<string>([siteUrl]);
	for (const snippet of report.metrics?.jsonLdSnippets ?? []) {
		const matches = snippet.matchAll(/"sameAs"\s*:\s*(\[[^\]]*\]|"(https?:[^"]+)")/gi);
		for (const match of matches) {
			const raw = match[1];
			if (!raw) continue;
			if (raw.startsWith('[')) {
				try {
					const list = JSON.parse(raw) as unknown;
					if (Array.isArray(list)) {
						for (const item of list) {
							if (typeof item === 'string' && /^https?:\/\//i.test(item)) found.add(item);
						}
					}
				} catch {
					/* truncated snippet */
				}
			} else if (match[2]) {
				found.add(match[2]);
			}
		}
	}
	return Array.from(found);
}

function siteContextFromReport(report: AuditReport, lang: AuditLang): GeoSiteContext {
	const url = canonicalSiteUrl(report.url);
	const domain = report.siteMeta?.domain || domainFromUrl(url);
	const brand = report.siteMeta?.brandName || domain;
	const category = report.siteMeta?.category || report.siteMeta?.primaryKeyword || (lang === 'en' ? 'clinic' : '의원');
	const primaryKeyword = report.siteMeta?.primaryKeyword || category;
	const location = report.siteMeta?.location || report.siteMeta?.broadLocation || '';
	const industryType = report.siteMeta?.industryType || 'GENERAL';
	const existingTypes = report.metrics?.schemaTypes ?? [];
	const nap = napFromAuditReport(report);
	if (!nap.name) nap.name = brand;
	const specialties = (report.siteMeta?.coreSpecialties?.length
		? report.siteMeta.coreSpecialties
		: collectAuditTargetKeywords(report)
	).slice(0, 5);

	return {
		url,
		domain,
		brandName: brand,
		category,
		primaryKeyword,
		location,
		industryType,
		schemaType: resolveSchemaOrgType({
			industryType,
			keyword: primaryKeyword,
			category,
			existingTypes,
			description: report.siteMeta?.metaDescription,
			brandName: brand,
		}),
		lang,
		description: report.siteMeta?.metaDescription,
		ogTitle: report.siteMeta?.ogTitle,
		ogDescription: report.siteMeta?.ogDescription,
		ogImage: report.siteMeta?.ogImage,
		existingSchemaTypes: existingTypes,
		nap,
		targetKeywords: collectAuditTargetKeywords(report),
		specialties,
		title: report.siteMeta?.title,
		metaKeywords: report.siteMeta?.metaKeywords,
		navMenuTexts: report.siteMeta?.navMenuTexts,
		businessEntity: report.siteMeta?.businessEntity,
		entityPhrases: report.siteMeta?.entityPhrases,
		needSignals: report.siteMeta?.needSignals,
	};
}

function buildEntitySnippet(report: AuditReport, ctx: GeoSiteContext, lang: AuditLang): JsonLdFixSnippet {
	const missing = report.metrics?.organizationMissing;
	const logo = logoFromReport(report, ctx.url);
	const address = postalAddress(ctx.nap, ctx.location);
	const schemaType: SchemaOrgPrimaryType = ctx.schemaType;
	const payload: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': schemaType,
		'@id': `${ctx.url}#entity`,
		name: ctx.brandName,
		url: ctx.url,
		logo,
		image: logo,
		...(ctx.nap.telephone ? { telephone: ctx.nap.telephone } : {}),
		...(address ? { address } : {}),
		sameAs: sameAsFromReport(report, ctx.url),
	};
	if (ctx.location) payload.areaServed = ctx.location;
	const knowsAbout = extractValidSpecialties(
		Array.from(new Set([...ctx.specialties, ctx.primaryKeyword, ctx.category])).filter(Boolean),
	).slice(0, 8);
	if (knowsAbout.length) payload.knowsAbout = knowsAbout;
	if (schemaType === 'MedicalClinic' || schemaType === 'Hospital' || schemaType === 'Dentist' || schemaType === 'VeterinaryCare') {
		payload.medicalSpecialty = ctx.specialties.length ? ctx.specialties : [ctx.primaryKeyword];
	}

	return {
		id: 'organization',
		schemaType,
		title:
			lang === 'en'
				? `${schemaType} (brand / NAP entity)`
				: `${schemaType} (상호·NAP 엔티티)`,
		description:
			lang === 'en'
				? missing?.length
					? `Currently missing: ${missing.join(', ')}. Paste this ${schemaType} block with the crawled brand and logo.`
					: `No ${schemaType} entity was detected. This block maps the live clinic/business name, domain, and logo.`
				: missing?.length
					? `현재 누락된 필드: ${missing.join(', ')}. 진단된 상호·로고를 넣은 ${schemaType} 블록입니다.`
					: `페이지에서 ${schemaType} 엔티티가 감지되지 않았습니다. 실제 상호·도메인·로고를 매핑한 완성형 코드입니다.`,
		code: wrapScript(payload),
	};
}

function buildArticleSnippet(report: AuditReport, ctx: GeoSiteContext, lang: AuditLang): JsonLdFixSnippet {
	const missing = report.metrics?.articleMissing;
	const headline = report.metrics?.pageTitle || report.siteMeta?.title || ctx.brandName;
	const published = (report.fetchedAt || new Date().toISOString()).slice(0, 10);
	const logo = logoFromReport(report, ctx.url);

	const payload = {
		'@context': 'https://schema.org',
		'@type': 'NewsArticle',
		headline,
		author: {
			'@type': 'Person',
			name: lang === 'en' ? `${ctx.brandName} Editorial Team` : `${ctx.brandName} 편집팀`,
		},
		datePublished: published,
		dateModified: published,
		image: logo,
		publisher: {
			'@type': 'Organization',
			name: ctx.brandName,
			logo: { '@type': 'ImageObject', url: logo },
		},
		mainEntityOfPage: ctx.url,
	};

	return {
		id: 'article',
		schemaType: 'NewsArticle',
		title: lang === 'en' ? 'NewsArticle (press / media)' : 'NewsArticle (언론·보도)',
		description:
			lang === 'en'
				? missing?.length
					? `Currently missing: ${missing.join(', ')}`
					: 'No NewsArticle schema was detected on this press/media page.'
				: missing?.length
					? `현재 누락된 필드: ${missing.join(', ')}`
					: '언론·미디어 페이지에서 NewsArticle 스키마가 감지되지 않았습니다.',
		code: wrapScript(payload),
	};
}

function buildPersonSnippet(report: AuditReport, ctx: GeoSiteContext, lang: AuditLang): JsonLdFixSnippet {
	const missing = report.metrics?.personMissing;
	const config = resolveIndustryConfigFromSite({
		lang,
		brandName: ctx.brandName,
		location: ctx.location,
		primaryKeyword: ctx.primaryKeyword,
		category: ctx.category,
		services: ctx.specialties,
		domain: ctx.domain,
		url: ctx.url,
		legacyIndustry: ctx.industryType,
		title: ctx.title || ctx.brandName,
		description: ctx.description,
		keywords: ctx.metaKeywords,
		schemaTypes: ctx.existingSchemaTypes,
		navMenuTexts: ctx.navMenuTexts,
	});
	const extracted = extractRepresentative(
		[report.footerText, (report.metrics?.jsonLdSnippets ?? []).join('\n')].filter(Boolean).join('\n'),
		lang,
	);
	const jobTitle =
		report.siteMeta?.representativeJobTitle ||
		(extracted.isExtracted ? extracted.jobTitle : '') ||
		config.personJobTitle;
	const directorName =
		report.siteMeta?.representativeName ||
		(extracted.isExtracted ? extracted.name : `${ctx.brandName} ${jobTitle}`);
	const payload: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Person',
		'@id': `${ctx.url}#director`,
		name: directorName,
		jobTitle,
		worksFor: {
			'@type': ctx.schemaType,
			'@id': `${ctx.url}#entity`,
			name: ctx.brandName,
			url: ctx.url,
		},
		url: `${ctx.url}/#director`,
	};
	const knowsAbout = extractValidSpecialties(
		ctx.specialties.length ? ctx.specialties : [ctx.primaryKeyword],
	).slice(0, 5);
	if (knowsAbout.length) payload.knowsAbout = knowsAbout;

	return {
		id: 'person',
		schemaType: 'Person',
		title: lang === 'en' ? `Person (${jobTitle})` : `Person (${jobTitle} 프로필)`,
		description:
			lang === 'en'
				? missing?.length
					? `Currently missing: ${missing.join(', ')}`
					: `No Person schema was detected. This block is a ${jobTitle} profile bound to the live ${config.schemaType} entity.`
				: missing?.length
					? `현재 누락된 필드: ${missing.join(', ')}`
					: `페이지에서 Person 스키마가 감지되지 않았습니다. 실제 ${config.defaultCategory} 엔티티에 연결한 ${jobTitle} 프로필입니다.`,
		code: wrapScript(payload),
	};
}

function buildFaqSnippet(report: AuditReport, ctx: GeoSiteContext, lang: AuditLang): JsonLdFixSnippet {
	const config = resolveIndustryConfigFromSite({
		lang,
		brandName: ctx.brandName,
		location: ctx.location,
		primaryKeyword: ctx.primaryKeyword,
		category: ctx.category,
		services: extractValidSpecialties(ctx.specialties.length ? ctx.specialties : [ctx.primaryKeyword]),
		domain: ctx.domain,
		url: ctx.url,
		legacyIndustry: ctx.industryType,
		title: ctx.title || ctx.brandName,
		description: ctx.description,
		keywords: ctx.metaKeywords,
		schemaTypes: ctx.existingSchemaTypes,
	});
	const generated = config.profile.faqGenerator({
		brandName: ctx.brandName,
		location: ctx.location,
		primaryKeyword: config.primaryKeyword,
		services: config.services,
		domain: ctx.domain,
		url: ctx.url,
		lang,
	});
	const faqs = (generated.length >= 3 ? generated : buildFaqEntities(ctx).map(([question, answer]) => ({ question, answer }))).slice(0, 5);
	const payload = toFaqPageJsonLd(faqs, { url: ctx.url, lang });

	return {
		id: 'faq',
		schemaType: 'FAQPage',
		title: lang === 'en' ? 'FAQPage (GEO citation Q&A)' : 'FAQPage (서비스 기반 Q&A)',
		description:
			lang === 'en'
				? `No FAQPage schema was detected. ${faqs.length} industry Q&As were generated from the live crawl.`
				: `FAQPage 스키마가 감지되지 않았습니다. 업종 레지스트리와 사이트 서비스명으로 Q&A ${faqs.length}종을 완성했습니다.`,
		code: wrapScript(payload),
	};
}

/** True when generated code still contains unfinished `{{ }}` tokens. */
export function jsonLdSnippetHasPlaceholder(code: string): boolean {
	return PLACEHOLDER_RE.test(code);
}

/** Only returns snippets for schemas whose corresponding checklist item is fail/warning. */
export function buildJsonLdFixSnippets(report: AuditReport, lang: AuditLang = 'ko'): JsonLdFixSnippet[] {
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const newsVertical = isNewsMediaVertical(schemaMappingFromReport(report));
	const ctx = siteContextFromReport(report, lang);

	const snippets: JsonLdFixSnippet[] = [];
	if (needsFix(checks, 'organization') || needsFix(checks, 'jsonld-present')) {
		snippets.push(buildEntitySnippet(report, ctx, lang));
	}
	if (newsVertical && (needsFix(checks, 'article-fields') || needsFix(checks, 'news-article'))) {
		snippets.push(buildArticleSnippet(report, ctx, lang));
	}
	if (needsFix(checks, 'person-eeat')) snippets.push(buildPersonSnippet(report, ctx, lang));
	if (needsFix(checks, 'faq-howto-schema')) snippets.push(buildFaqSnippet(report, ctx, lang));
	return snippets;
}
