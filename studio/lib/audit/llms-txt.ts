/**
 * Site diagnostic snapshot + standard `/llms.txt` markdown generator.
 *
 * Extractors pull NAP / representative / services from JSON-LD and on-page
 * footer HTML; the generator only renders what was found (empty → 미기재/미등록).
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { extractOnpageNap, extractNapFromCorpus } from '@/lib/audit/extractors/nap';
import { extractRepresentative } from '@/lib/audit/extractors/entity';
import { extractFooterLegalText } from '@/lib/audit/parser';
import { extractSiteMetadata } from '@/lib/audit/site-metadata';
import {
	resolveIndustryConfigFromSite,
	type FaqItem,
	type RegistryLang,
} from '@/lib/registry/universalIndustryRegistry';

export type SiteDiagnosticLang = RegistryLang;

export interface SiteDiagnosticFaq {
	question: string;
	answer: string;
}

export interface SiteDiagnosticResult {
	brandName: string;
	description: string;
	industry: string;
	schemaType: string;
	representativeTitle: string;
	representativeName: string;
	services: string[];
	address: string;
	telephone: string;
	url: string;
	faqs: SiteDiagnosticFaq[];
	location?: string;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	lang?: SiteDiagnosticLang;
	needsJsRender?: boolean;
}

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function missingAddress(lang: SiteDiagnosticLang): string {
	return lang === 'en' ? 'Not listed' : '미기재';
}

function missingTelephone(lang: SiteDiagnosticLang): string {
	return lang === 'en' ? 'Not listed' : '미기재';
}

function missingRepresentative(lang: SiteDiagnosticLang): string {
	return lang === 'en' ? 'Not listed' : '미등록';
}

function officialUrl(url: string, domain?: string): string {
	const direct = compact(url);
	if (direct) return direct;
	const host = compact(domain);
	if (!host) return '';
	return /^https?:\/\//i.test(host) ? host : `https://${host}`;
}

/**
 * Render the standard root `/llms.txt` markdown from a diagnostic snapshot.
 * Missing NAP / representative fields fall back to 미기재 / 미등록 (or EN equivalents).
 */
export function generateLlmsTxt(data: SiteDiagnosticResult): string {
	const lang: SiteDiagnosticLang = data.lang === 'en' ? 'en' : 'ko';
	const brand = compact(data.brandName) || (lang === 'en' ? 'This business' : '이 업체');
	const description = compact(data.description);
	const industry = compact(data.industry);
	const schemaType = compact(data.schemaType);
	const representativeTitle = compact(data.representativeTitle) || (lang === 'en' ? 'Representative' : '대표자');
	const representativeName = compact(data.representativeName) || missingRepresentative(lang);
	const services = (data.services || []).map(compact).filter(Boolean).slice(0, 5);
	const address = compact(data.address) || missingAddress(lang);
	const telephone = compact(data.telephone) || missingTelephone(lang);
	const url = compact(data.url) || missingAddress(lang);
	const faqs = (data.faqs || []).filter((faq) => compact(faq.question) && compact(faq.answer));

	const lines: string[] = [
		`# ${brand}`,
		'',
		description ? `> ${description}` : '',
		description ? '' : '',
		lang === 'en'
			? `Industry: ${industry} · Schema.org: ${schemaType} · Region: ${compact(data.location) || 'Nationwide'} · ${representativeTitle}`
			: `업종: ${industry} · Schema.org: ${schemaType} · 지역: ${compact(data.location) || '전국'} · ${representativeTitle}`,
		'',
		lang === 'en' ? '## Services' : '## 서비스',
		'',
		...services.map((service, index) => `- ${index + 1}. ${service}`),
		'',
		'## NAP',
		'',
		`- name: ${brand}`,
		`- address: ${address}`,
		`- telephone: ${telephone}`,
		`- url: ${url}`,
		'',
		`## ${representativeTitle}`,
		'',
		`- name: ${representativeName}`,
		`- jobTitle: ${representativeTitle}`,
		'',
		'## FAQ',
		'',
	];

	for (const faq of faqs) {
		lines.push(`### ${compact(faq.question)}`, '', compact(faq.answer), '');
	}

	return `${lines.filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

export interface ExtractSiteDiagnosticOptions {
	url?: string;
	lang?: SiteDiagnosticLang;
	faqs?: readonly FaqItem[];
	$?: CheerioAPI;
}

/**
 * Cheerio-based on-page diagnostic: JSON-LD first, then footer/header/contact HTML.
 * Pass already-rendered HTML (Playwright/Puppeteer) when `needsJsRender` would be true.
 */
export function extractSiteDiagnostic(html: string, options: ExtractSiteDiagnosticOptions = {}): SiteDiagnosticResult {
	const lang: SiteDiagnosticLang = options.lang === 'en' ? 'en' : 'ko';
	const url = compact(options.url) || 'https://example.com';
	const $ = options.$ || cheerio.load(html || '<html></html>');
	const meta = extractSiteMetadata($, url, lang, html);
	const nap = extractOnpageNap($, html, url);
	const footerText = extractFooterLegalText($, 2500);
	const representative = extractRepresentative(
		[footerText, html, nap.name ? `"@type":"Person","name":"${nap.name}"` : ''].filter(Boolean).join('\n'),
		lang,
	);
	const services = (nap.services.length ? nap.services : meta.coreSpecialties || meta.serviceKeywords || []).slice(0, 5);
	const config = resolveIndustryConfigFromSite({
		lang,
		brandName: meta.brandName,
		location: meta.location || nap.addressLocality || nap.addressRegion,
		primaryKeyword: meta.primaryKeyword,
		category: meta.category,
		services,
		domain: meta.domain,
		url,
		legacyIndustry: meta.industryType,
		title: meta.title,
		description: meta.metaDescription || meta.ogDescription,
		keywords: meta.metaKeywords,
		schemaTypes: meta.schemaEntityTypes,
		navMenuTexts: meta.navMenuTexts,
	});
	const representativeName = representative.isExtracted
		? representative.name
		: compact(meta.representativeName);
	const representativeTitle =
		(representative.isExtracted ? representative.jobTitle : compact(meta.representativeJobTitle)) ||
		config.representativeTitle ||
		config.personJobTitle ||
		(lang === 'en' ? 'Representative' : '대표자');
	const faqs = (
		options.faqs?.length
			? options.faqs
			: config.profile.faqGenerator({
					brandName: meta.brandName || config.brandName,
					location: meta.location || config.location,
					primaryKeyword: config.primaryKeyword,
					services: services.length ? services : config.services,
					domain: meta.domain,
					url,
					lang,
				})
	)
		.filter((faq) => compact(faq.question) && compact(faq.answer))
		.slice(0, 8);

	const address =
		nap.address ||
		[nap.addressRegion, nap.addressLocality, nap.streetAddress].filter(Boolean).join(' ') ||
		meta.location ||
		'';

	return {
		brandName: meta.brandName,
		description: meta.metaDescription || meta.ogDescription || '',
		industry: config.profile.label[lang],
		schemaType: config.schemaType,
		representativeTitle,
		representativeName,
		services: services.length ? services : config.services.slice(0, 5),
		address,
		telephone: nap.telephone,
		url: officialUrl(url, meta.domain),
		faqs,
		location: meta.location || nap.addressLocality || nap.addressRegion,
		streetAddress: nap.streetAddress,
		addressLocality: nap.addressLocality,
		addressRegion: nap.addressRegion,
		lang,
		needsJsRender: nap.needsJsRender,
	};
}

/** Merge footer-corpus NAP into a diagnostic already built from stored audit fields. */
export function mergeFooterNap(
	data: SiteDiagnosticResult,
	footerText: string | undefined,
): SiteDiagnosticResult {
	if (!footerText || (data.telephone && data.address && data.representativeName)) return data;
	const fromFooter = extractNapFromCorpus(footerText);
	const representative = extractRepresentative(footerText, data.lang === 'en' ? 'en' : 'ko');
	return {
		...data,
		telephone: data.telephone || fromFooter.telephone,
		address: data.address || fromFooter.address,
		streetAddress: data.streetAddress || fromFooter.streetAddress,
		addressLocality: data.addressLocality || fromFooter.addressLocality,
		addressRegion: data.addressRegion || fromFooter.addressRegion,
		representativeName:
			data.representativeName && data.representativeName !== missingRepresentative(data.lang === 'en' ? 'en' : 'ko')
				? data.representativeName
				: representative.isExtracted
					? representative.name
					: data.representativeName,
		representativeTitle:
			data.representativeTitle ||
			(representative.isExtracted ? representative.jobTitle : '') ||
			data.representativeTitle,
	};
}

export type { FaqItem };
