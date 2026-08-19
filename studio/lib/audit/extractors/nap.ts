/**
 * On-page NAP extractor — telephone, PostalAddress, and service keywords.
 *
 * Priority: JSON-LD → tel: links → footer/header/contact regions → whole-document regex.
 * Designed for Korean clinic / SMB footers (e.g. koreaionlab.co.kr).
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import {
	extractFooterLegalText,
	extractJsonLdScriptBodies,
	extractNavItems,
	parseJsonLdDocument,
} from '@/lib/audit/parser';
import { extractCoreSpecialties, filterNavMenuTexts } from '@/lib/geo/core-specialties';
import { isUiStopword } from '@/lib/geo/clean-medical-entities';

export const KR_PHONE_RE =
	/(?:02|0[3-6][1-5]|010|050[0-9]|070|080|15[0-9]{2}|16[0-9]{2}|18[0-9]{2})[ -\.]?[0-9]{3,4}[ -\.]?[0-9]{4}/g;

const KR_PHONE_NEAR_LABEL_RE =
	/(?:대표번호|대표전화|상담전화|고객센터|문의(?:전화)?|전화(?:번호)?|TEL|Tel|T)\s*[:：]?\s*((?:02|0[3-6][1-5]|010|050[0-9]|070|080|15[0-9]{2}|16[0-9]{2}|18[0-9]{2})[ -\.]?[0-9]{3,4}[ -\.]?[0-9]{4})/;

const ADDRESS_LABEL_RE =
	/(?:주소|소재지|주소지|본사(?:\s*주소)?|ADD(?:RESS)?)\s*[:：]?\s*([가-힣A-Za-z0-9()[\]\-.,·\s]{6,140})/i;

const KR_REGION_RE =
	/(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|제주특별자치도|강원특별자치도|전북특별자치도|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|서울시|부산시|대구시|인천시|광주시|대전시|울산시|세종시|제주시|서울|부산|대구|인천|광주|대전|울산|세종|제주|경기|강원|충북|충남|전북|전남|경북|경남)/;

const KR_LOCALITY_RE = /([가-힣]{1,10}(?:시|군|구))/;

const KR_STREET_RE =
	/([가-힣0-9]+(?:대로|로|길)\s*[0-9\-]*(?:\s*[가-힣0-9]+(?:길))?(?:\s*[0-9\-]+)?(?:\s*,?\s*[0-9가-힣호동층()]+)*)/;

const KR_JIBUN_RE = /([가-힣0-9]+(?:동|가|읍|면|리)\s*[0-9\-]+(?:번지)?(?:\s*[0-9호동층]+)*)/;

const NAP_REGION_SELECTORS = [
	'footer',
	'#ft',
	'.footer',
	'#footer',
	'.ft_info',
	'.footer_info',
	'.business_info',
	'#business',
	'address',
	'[class*="footer"]',
	'[id*="footer"]',
	'[class*="ft_"]',
	'header',
	'#hd',
	'.header',
	'nav',
	'[class*="contact"]',
	'[id*="contact"]',
	'[class*="상담"]',
	'[class*="문의"]',
].join(', ');

const PERSON_LINK_KEYS = ['founder', 'employee', 'employees', 'physician', 'alumni', 'member', 'director'] as const;

export interface ExtractedPostalAddress {
	full: string;
	streetAddress: string;
	addressLocality: string;
	addressRegion: string;
	addressCountry: 'KR';
}

export interface ExtractedNap {
	name: string;
	telephone: string;
	address: string;
	streetAddress: string;
	addressLocality: string;
	addressRegion: string;
	services: string[];
	/** True when the static DOM looks like an SPA shell with an empty footer. */
	needsJsRender: boolean;
}

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function textOf(value: unknown): string {
	if (typeof value === 'string' || typeof value === 'number') return compact(String(value));
	const obj = asRecord(value);
	if (!obj) return '';
	return textOf(obj.name) || textOf(obj.telephone) || textOf(obj.text) || textOf(obj.value);
}

export function walkJsonLdNodes(value: unknown, visit: (node: Record<string, unknown>) => void, depth = 0): void {
	if (value == null || depth > 10) return;
	if (Array.isArray(value)) {
		value.forEach((item) => walkJsonLdNodes(item, visit, depth + 1));
		return;
	}
	const obj = asRecord(value);
	if (!obj) return;
	visit(obj);
	if (obj['@graph'] != null) walkJsonLdNodes(obj['@graph'], visit, depth + 1);
	if (obj.mainEntity != null) walkJsonLdNodes(obj.mainEntity, visit, depth + 1);
	if (obj.address != null) walkJsonLdNodes(obj.address, visit, depth + 1);
	if (obj.contactPoint != null) walkJsonLdNodes(obj.contactPoint, visit, depth + 1);
	for (const key of PERSON_LINK_KEYS) {
		if (obj[key] != null) walkJsonLdNodes(obj[key], visit, depth + 1);
	}
}

export function collectJsonLdNodesFromHtml(html: string): Record<string, unknown>[] {
	if (!html) return [];
	const nodes: Record<string, unknown>[] = [];
	const bodies = extractJsonLdScriptBodies(html);
	const payloads = bodies.length
		? bodies
		: (() => {
				const trimmed = html.trim();
				return trimmed.startsWith('{') || trimmed.startsWith('[') ? [trimmed] : [];
			})();
	for (const body of payloads) {
		const parsed = parseJsonLdDocument(body);
		if (parsed) walkJsonLdNodes(parsed, (node) => nodes.push(node));
	}
	return nodes;
}

function digitsOnly(raw: string): string {
	let digits = raw.replace(/\D/g, '');
	if (digits.startsWith('82') && digits.length >= 11) {
		digits = `0${digits.slice(2)}`;
	}
	return digits;
}

/**
 * Normalize a Korean telephone number to hyphenated form (e.g. `02-1234-5678`).
 */
export function formatKoreanTelephone(raw: string | null | undefined): string {
	const trimmed = compact(raw)
		.replace(/^tel:/i, '')
		.split(/[?,;]/)[0]
		?.trim();
	if (!trimmed) return '';
	let digits = digitsOnly(trimmed);
	if (digits.startsWith('82') && digits.length >= 10) digits = `0${digits.slice(2)}`;
	if (!digits || digits.length < 8 || digits.length > 12) return '';
	if (/^(\d)\1+$/.test(digits)) return '';

	if (digits.startsWith('02')) {
		const rest = digits.slice(2);
		if (rest.length === 8) return `02-${rest.slice(0, 4)}-${rest.slice(4)}`;
		if (rest.length === 7) return `02-${rest.slice(0, 3)}-${rest.slice(3)}`;
	}
	if (/^050\d/.test(digits) && digits.length >= 11) {
		return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
	}
	if (/^01[016789]/.test(digits) && digits.length === 11) {
		return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
	}
	if (/^(15|16|18)\d{2}/.test(digits) && digits.length === 8) {
		return `${digits.slice(0, 4)}-${digits.slice(4)}`;
	}
	if (digits.length === 11) {
		return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
	}
	if (digits.length === 10) {
		return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
	}
	if (digits.length === 9 && digits.startsWith('02') === false) {
		return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
	}
	return trimmed.replace(/\s+/g, '-').replace(/\.+/g, '-').replace(/-+/g, '-');
}

function isPlausibleKoreanPhone(raw: string): boolean {
	const formatted = formatKoreanTelephone(raw);
	if (!formatted) return false;
	const digits = digitsOnly(formatted);
	KR_PHONE_RE.lastIndex = 0;
	return KR_PHONE_RE.test(formatted) || KR_PHONE_RE.test(digits) || /^(02|0[3-6]|01|050|070|080|15|16|18)/.test(digits);
}

function pushPhone(out: string[], raw: string | null | undefined): void {
	const formatted = formatKoreanTelephone(raw);
	if (!formatted || !isPlausibleKoreanPhone(formatted)) return;
	if (out.includes(formatted)) return;
	out.push(formatted);
}

function extractTelHrefs($: CheerioAPI): string[] {
	const found: string[] = [];
	$('a[href^="tel:"], a[href^="TEL:"], a[href^="Tel:"]').each((_, el) => {
		pushPhone(found, $(el).attr('href') || '');
		pushPhone(found, $(el).text());
	});
	return found;
}

function extractPhonesFromText(text: string): string[] {
	const found: string[] = [];
	const labeled = text.match(KR_PHONE_NEAR_LABEL_RE)?.[1];
	if (labeled) pushPhone(found, labeled);
	KR_PHONE_RE.lastIndex = 0;
	for (const match of text.matchAll(new RegExp(KR_PHONE_RE.source, 'g'))) {
		pushPhone(found, match[0]);
	}
	return found;
}

function clipAddressTail(raw: string): string {
	return compact(raw)
		.replace(/\s*(?:대표번호|대표전화|상담전화|전화(?:번호)?|TEL|Tel|이메일|E-?mail|메일|상호|사업자(?:등록)?번호|Copyright|All\s*Rights).*$/i, '')
		.replace(/[|,;·]+$/, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function parseKoreanAddress(raw: string): ExtractedPostalAddress | null {
	const blob = clipAddressTail(raw);
	if (!blob || blob.length < 4) return null;
	const regionHit = blob.match(KR_REGION_RE);
	const region = regionHit?.[1] || '';
	const afterRegion = regionHit ? blob.slice((regionHit.index || 0) + regionHit[0].length).trim() : blob;
	const localityHit = afterRegion.match(KR_LOCALITY_RE);
	const locality = localityHit?.[1] || '';
	const afterLocality = localityHit
		? afterRegion.slice((localityHit.index || 0) + localityHit[0].length).trim()
		: afterRegion;
	const streetHit = afterLocality.match(KR_STREET_RE) || afterLocality.match(KR_JIBUN_RE);
	const street = clipAddressTail(streetHit?.[1] || afterLocality);

	const parts = [region, locality, street].map(compact).filter(Boolean);
	if (!parts.length) return null;

	const full = clipAddressTail(parts.join(' '));
	if (full.length < 4) return null;
	return {
		full,
		streetAddress: street || '',
		addressLocality: locality || '',
		addressRegion: region || '',
		addressCountry: 'KR',
	};
}

function addressFromJsonLdNode(node: Record<string, unknown>): ExtractedPostalAddress | null {
	const address = node.address;
	if (typeof address === 'string') return parseKoreanAddress(address);
	const addr = asRecord(address);
	if (!addr) {
		if (typeof node.streetAddress === 'string' || typeof node.addressLocality === 'string') {
			const region = textOf(node.addressRegion);
			const locality = textOf(node.addressLocality);
			const street = textOf(node.streetAddress);
			const full = [region, locality, street].filter(Boolean).join(' ');
			if (!full) return null;
			return {
				full,
				streetAddress: street,
				addressLocality: locality,
				addressRegion: region,
				addressCountry: 'KR',
			};
		}
		return null;
	}
	const region = textOf(addr.addressRegion);
	const locality = textOf(addr.addressLocality);
	const street = textOf(addr.streetAddress);
	const fromParts = [region, locality, street].filter(Boolean).join(' ');
	const parsed = parseKoreanAddress(fromParts || textOf(addr.name) || textOf(address));
	if (parsed) {
		return {
			...parsed,
			streetAddress: parsed.streetAddress || street,
			addressLocality: parsed.addressLocality || locality,
			addressRegion: parsed.addressRegion || region,
		};
	}
	if (fromParts) {
		return {
			full: fromParts,
			streetAddress: street,
			addressLocality: locality,
			addressRegion: region,
			addressCountry: 'KR',
		};
	}
	return null;
}

function extractJsonLdNap(nodes: readonly Record<string, unknown>[]): {
	name: string;
	telephone: string;
	address: ExtractedPostalAddress | null;
} {
	let name = '';
	let telephone = '';
	let address: ExtractedPostalAddress | null = null;
	for (const node of nodes) {
		if (!name) name = textOf(node.name);
		if (!telephone) {
			telephone =
				formatKoreanTelephone(textOf(node.telephone) || textOf(node.phone) || textOf(asRecord(node.contactPoint)?.telephone)) ||
				'';
		}
		if (!address) address = addressFromJsonLdNode(node);
	}
	return { name, telephone, address };
}

function scopedText($: CheerioAPI): string {
	const chunks: string[] = [];
	$(NAP_REGION_SELECTORS).each((_, el) => {
		const text = compact($(el).text());
		if (text.length >= 4) chunks.push(text);
	});
	return chunks.join('\n');
}

function extractAddressFromText(text: string): ExtractedPostalAddress | null {
	if (!text) return null;
	const labeled = text.match(ADDRESS_LABEL_RE)?.[1];
	if (labeled) {
		const parsed = parseKoreanAddress(labeled);
		if (parsed) return parsed;
	}
	const regionHit = text.match(KR_REGION_RE);
	if (regionHit) {
		const windowStart = Math.max(0, (regionHit.index || 0) - 4);
		const window = text.slice(windowStart, windowStart + 140);
		const parsed = parseKoreanAddress(window);
		if (parsed) return parsed;
	}
	return null;
}

function headingPhrases($: CheerioAPI): string[] {
	const out: string[] = [];
	$('h1, h2, .sub_title').each((_, el) => {
		const text = compact($(el).text()).slice(0, 40);
		if (!text || text.length < 2 || text.length > 28) return;
		if (isUiStopword(text)) return;
		if (!out.includes(text)) out.push(text);
	});
	return out;
}

function extractServices($: CheerioAPI, pageUrl: string, html: string): string[] {
	const navNames = filterNavMenuTexts(extractNavItems($, pageUrl || 'https://example.com', 24).map((item) => item.name));
	const h1 = compact($('h1').first().text());
	const h2Texts = headingPhrases($).slice(0, 8);
	const title = compact($('title').first().text());
	const metaKeywords = compact($('meta[name="keywords"]').attr('content'));
	const ranked = extractCoreSpecialties({
		title,
		metaKeywords,
		navMenuTexts: navNames,
		h2Texts,
		description: compact($('meta[name="description"]').attr('content')),
	});
	const merged: string[] = [];
	const push = (value: string) => {
		const v = compact(value);
		if (!v || isUiStopword(v) || v.length > 28) return;
		if (merged.some((existing) => existing.toLowerCase() === v.toLowerCase())) return;
		merged.push(v);
	};
	ranked.forEach(push);
	navNames.forEach(push);
	h2Texts.forEach(push);
	if (h1) push(h1);
	if (!merged.length) {
		for (const phrase of html.match(/[가-힣A-Za-z]{2,16}(?:치료|상담|클리닉|센터|시공|서비스)/g) ?? []) {
			push(phrase);
			if (merged.length >= 5) break;
		}
	}
	return merged.slice(0, 5);
}

function detectNeedsJsRender($: CheerioAPI, html: string, footerText: string): boolean {
	const spa = /__NEXT_DATA__|__NUXT__|data-reactroot|id=["'](?:root|app|__next)["']/i.test(html);
	const footerEmpty = compact(footerText).length < 24 && $('footer, #ft, .footer, #footer').text().trim().length < 24;
	return spa && footerEmpty;
}

export function extractTelephone($: CheerioAPI, html = ''): string {
	const nodes = collectJsonLdNodesFromHtml(html || $.root().html() || '');
	const jsonLd = extractJsonLdNap(nodes);
	if (jsonLd.telephone) return jsonLd.telephone;
	const fromHref = extractTelHrefs($)[0];
	if (fromHref) return fromHref;
	const scoped = scopedText($);
	const fromScoped = extractPhonesFromText(scoped)[0];
	if (fromScoped) return fromScoped;
	const fromBody = extractPhonesFromText(compact($('body').text() || html))[0];
	return fromBody || '';
}

export function extractAddress($: CheerioAPI, html = ''): ExtractedPostalAddress | null {
	const nodes = collectJsonLdNodesFromHtml(html || $.root().html() || '');
	const jsonLd = extractJsonLdNap(nodes);
	if (jsonLd.address?.full) return jsonLd.address;
	$('address').each((_, el) => {
		const parsed = parseKoreanAddress($(el).text());
		if (parsed) jsonLd.address = jsonLd.address || parsed;
	});
	if (jsonLd.address?.full) return jsonLd.address;
	const scoped = scopedText($) || extractFooterLegalText($, 2500);
	return extractAddressFromText(scoped) || extractAddressFromText(compact($('body').text()));
}

/**
 * Parse NAP from a plain footer / 사업자 정보 corpus (no DOM required).
 */
export function extractNapFromCorpus(corpus: string): Pick<ExtractedNap, 'telephone' | 'address' | 'streetAddress' | 'addressLocality' | 'addressRegion'> {
	const text = compact(corpus);
	const telephone = extractPhonesFromText(text)[0] || '';
	const address = extractAddressFromText(text);
	return {
		telephone,
		address: address?.full || '',
		streetAddress: address?.streetAddress || '',
		addressLocality: address?.addressLocality || '',
		addressRegion: address?.addressRegion || '',
	};
}

export function extractOnpageNap($: CheerioAPI, html: string, pageUrl = ''): ExtractedNap {
	try {
		const rawHtml = html || $.root().html() || '';
		const nodes = collectJsonLdNodesFromHtml(rawHtml);
		const jsonLd = extractJsonLdNap(nodes);
		const footerText = extractFooterLegalText($, 2500);
		const fromFooter = extractNapFromCorpus([footerText, scopedText($)].filter(Boolean).join('\n'));
		const telHref = extractTelHrefs($)[0] || '';
		const telephone = jsonLd.telephone || telHref || fromFooter.telephone || extractTelephone($, rawHtml);
		const parsedAddress =
			jsonLd.address ||
			extractAddress($, rawHtml) ||
			(fromFooter.address
				? {
						full: fromFooter.address,
						streetAddress: fromFooter.streetAddress,
						addressLocality: fromFooter.addressLocality,
						addressRegion: fromFooter.addressRegion,
						addressCountry: 'KR' as const,
					}
				: null);
		return {
			name: jsonLd.name,
			telephone,
			address: parsedAddress?.full || '',
			streetAddress: parsedAddress?.streetAddress || '',
			addressLocality: parsedAddress?.addressLocality || '',
			addressRegion: parsedAddress?.addressRegion || '',
			services: extractServices($, pageUrl, rawHtml),
			needsJsRender: detectNeedsJsRender($, rawHtml, footerText),
		};
	} catch (error) {
		console.error('[nap] extractOnpageNap failed:', error);
		return {
			name: '',
			telephone: '',
			address: '',
			streetAddress: '',
			addressLocality: '',
			addressRegion: '',
			services: [],
			needsJsRender: false,
		};
	}
}

export function extractOnpageNapFromHtml(html: string, pageUrl = ''): ExtractedNap {
	const $ = cheerio.load(html || '<html></html>');
	return extractOnpageNap($, html, pageUrl);
}
