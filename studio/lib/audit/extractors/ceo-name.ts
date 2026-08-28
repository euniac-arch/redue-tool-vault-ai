/**
 * Sequential CEO / representative-name discovery.
 * Priority: footer → greeting/about (text + img alt/filename) → first doctor card (+ img alt) → safe fallback.
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { isNoiseRepresentativeName } from '@/lib/audit/extractors/entity';
import {
	FOOTER_REP_NAME_RE,
	extractSchemaPerson,
} from '@/lib/audit/extractors/universal-entity';
import {
	extractImageRepFromFilename,
	extractImageRepFromHtml,
	type ImageRepHit,
	normalizeRepTitle,
} from '@/lib/audit/extractors/image-rep-semantics';
import {
	isDoctorTeamPage,
	isGreetingCeoPage,
} from '@/lib/audit/extractors/representative-pages';

export const DEFAULT_CEO_NAME_FALLBACK = '대표원장';

export type CeoNameSource = 'schema' | 'footer' | 'greeting' | 'doctor' | 'fallback';

export type CeoNameHit = {
	name: string;
	jobTitle: string;
	source: CeoNameSource;
	isExtracted: boolean;
};

export type CeoSourcePage = {
	url?: string;
	title?: string;
	html?: string;
};

/** User-specified Step 1 regex (footer). Longer titles first so 대표원장 wins over 원장. */
export const FOOTER_CEO_NAME_RE = FOOTER_REP_NAME_RE;

const LABELED_CEO_RE =
	/(?:대표원장|대표자?|원장|수의사|CEO)\s*[:：|·ㆍ\s]\s*([가-힣]{2,4})/i;

const SIGNATURE_NAME_RE = /([가-힣]{2,4})\s*(?:배상|드림|올림|드림니다)/;

const TITLE_THEN_NAME_RE =
	/(?:대표원장|원장|수의사|대표자?)\s*[:：|·ㆍ\s]*([가-힣]{2,4})/;

const NAME_THEN_TITLE_RE = /([가-힣]{2,4})\s*(?:대표원장|원장|수의사|대표자?)/;

const CSS_URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

const FOOTER_SCOPES = [
	'footer',
	'#footer',
	'#ft',
	'.footer',
	'.copyright',
	'.ft_info',
	'.footer_info',
	'.business_info',
	'[class*="footer"]',
	'[id*="footer"]',
	'[class*="ft_"]',
	'[class*="copyright"]',
];

const FIRST_DOCTOR_CARD_SELECTORS = [
	'.doctor-list > :first-child',
	'.doctor_list > :first-child',
	'.doctor-card:first-child',
	'.doctor_card:first-child',
	'.staff-list > :first-child',
	'.staff_list > :first-child',
	'.medical-team > :first-child',
	'.team-list > :first-child',
	'.member_list > :first-child',
	'.member-list > :first-child',
	'.doc_list > :first-child',
	'ul.doctor > li:first-child',
	'[class*="doctor-list"] > :first-child',
	'[class*="doctor_list"] > :first-child',
	'[class*="doctor-card"]:first-child',
];

const CARD_NAME_SELECTORS = 'h1, h2, h3, h4, h5, .name, .doctor-name, .doctor_name, .doc_name, .staff-name, strong, b';

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function inferJobTitle(haystack: string, matchedTitle?: string): string {
	const fromMatch = normalizeRepTitle(matchedTitle);
	if (fromMatch) return fromMatch;
	if (/대표원장/.test(haystack)) return '대표원장';
	if (/대표이사/.test(haystack)) return '대표이사';
	if (/이사장/.test(haystack)) return '이사장';
	if (/수의사/.test(haystack)) return '수의사';
	if (/원장/.test(haystack)) return '원장';
	if (/대표자/.test(haystack)) return '대표자';
	if (/대표/.test(haystack) || /CEO/i.test(haystack)) return '대표';
	return '대표원장';
}

export function isValidKoreanCeoName(raw: string | null | undefined): boolean {
	const name = compact(raw);
	if (!/^[가-힣]{2,4}$/.test(name)) return false;
	if (isNoiseRepresentativeName(name)) return false;
	if (/^(대표원장|대표자명?|원장|수의사|의료진)$/.test(name)) return false;
	return true;
}

export function bindCeoName(value: string | null | undefined): string {
	const name = compact(value);
	return name || DEFAULT_CEO_NAME_FALLBACK;
}

function hitFromName(
	name: string | null | undefined,
	source: Exclude<CeoNameSource, 'fallback'>,
	haystack = '',
	matchedTitle?: string,
): CeoNameHit | null {
	const cleaned = compact(name);
	if (!isValidKoreanCeoName(cleaned)) return null;
	return {
		name: cleaned,
		jobTitle: inferJobTitle(haystack || matchedTitle || '', matchedTitle),
		source,
		isExtracted: true,
	};
}

function hitFromImageRep(
	rep: ImageRepHit | null,
	source: Exclude<CeoNameSource, 'fallback'>,
	haystack = '',
): CeoNameHit | null {
	if (!rep) return null;
	return hitFromName(rep.name, source, haystack || rep.jobTitle, rep.jobTitle);
}

function firstLabeledName(text: string, source: Exclude<CeoNameSource, 'fallback' | 'schema'>): CeoNameHit | null {
	FOOTER_CEO_NAME_RE.lastIndex = 0;
	const footerExact = text.match(FOOTER_CEO_NAME_RE);
	if (footerExact?.[1]) {
		const prefix = compact(footerExact[0].replace(footerExact[1], ''));
		const title = prefix.match(/대표원장|대표이사|대표자명|대표자|원장|CEO/i)?.[0];
		const hit = hitFromName(footerExact[1], source, text, title);
		if (hit) return hit;
	}
	const labeled = text.match(LABELED_CEO_RE);
	if (labeled?.[1]) {
		const prefix = compact(labeled[0].replace(labeled[1], ''));
		const title = prefix.match(/대표원장|대표자?|원장|수의사|CEO/i)?.[0];
		const hit = hitFromName(labeled[1], source, text, title);
		if (hit) return hit;
	}
	return null;
}

export function extractFooterInnerHtml($: CheerioAPI): string {
	const chunks: string[] = [];
	const seen = new Set<string>();
	for (const sel of FOOTER_SCOPES) {
		$(sel).each((_, el) => {
			const html = compact($(el).html() || '');
			const text = compact($(el).text());
			const key = (text || html).slice(0, 80);
			if (!key || seen.has(key)) return;
			seen.add(key);
			chunks.push(html || text);
		});
	}
	return chunks.join('\n');
}

function nameFromImageRef(raw: string): string | null {
	let decoded = compact(raw).split('#')[0].split('?')[0];
	if (!decoded) return null;
	try {
		decoded = decodeURIComponent(decoded);
	} catch {
		/* keep raw */
	}
	const base = decoded.replace(/\\/g, '/').split('/').pop() || decoded;
	const stem = base.replace(/\.[a-z0-9]{2,5}$/i, '');
	const korean = stem.match(/([가-힣]{2,4})/);
	return korean?.[1] && isValidKoreanCeoName(korean[1]) ? korean[1] : null;
}

export function extractCeoNameFromImageRefs(html: string): string | null {
	if (!html) return null;
	const fromImgs = extractImageRepFromHtml(html);
	if (fromImgs && isValidKoreanCeoName(fromImgs.name)) return fromImgs.name;
	CSS_URL_RE.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = CSS_URL_RE.exec(html)) !== null) {
		const fromFile = extractImageRepFromFilename(match[1]);
		if (fromFile && isValidKoreanCeoName(fromFile.name)) return fromFile.name;
		const name = nameFromImageRef(match[1]);
		if (name) return name;
	}
	const srcHits = html.matchAll(/(?:src|data-src|data-bg)\s*=\s*['"]([^'"]+)['"]/gi);
	for (const hit of srcHits) {
		const fromFile = extractImageRepFromFilename(hit[1]);
		if (fromFile && isValidKoreanCeoName(fromFile.name)) return fromFile.name;
		const name = nameFromImageRef(hit[1]);
		if (name) return name;
	}
	return null;
}

export function extractCeoFromFooter(input: {
	html?: string;
	footerHtml?: string;
	footerText?: string;
	$?: CheerioAPI;
}): CeoNameHit | null {
	const $ = input.$ || (input.html ? cheerio.load(input.html) : null);
	const scopedHtml = input.footerHtml || ($ ? extractFooterInnerHtml($) : '');
	let scopedFromHtml = '';
	if (scopedHtml) {
		try {
			scopedFromHtml = compact(cheerio.load(scopedHtml).root().text());
		} catch {
			scopedFromHtml = compact(scopedHtml.replace(/<[^>]+>/g, ' '));
		}
	}
	const scopedText = [scopedFromHtml, input.footerText].map(compact).filter(Boolean).join('\n');
	if (!scopedText && !scopedHtml) return null;
	return (
		firstLabeledName(scopedText, 'footer') ||
		hitFromImageRep(extractImageRepFromHtml(scopedHtml), 'footer', scopedText) ||
		hitFromName(extractCeoNameFromImageRefs(scopedHtml), 'footer', scopedText)
	);
}

function extractCeoFromGreetingHtml(html: string): CeoNameHit | null {
	if (!html) return null;
	const $ = cheerio.load(html);
	$('script, style, noscript').remove();
	const body = compact($('body').text() || $.root().text());
	const fromImgAlt = hitFromImageRep(
		extractImageRepFromHtml(html, { attrs: true, filenames: false }),
		'greeting',
		body,
	);
	if (fromImgAlt) return fromImgAlt;
	const labeled = firstLabeledName(body, 'greeting');
	if (labeled) return labeled;
	const signed = body.match(SIGNATURE_NAME_RE);
	const fromSign = hitFromName(signed?.[1], 'greeting', body);
	if (fromSign) return fromSign;
	const titleThen = body.match(TITLE_THEN_NAME_RE);
	const fromTitle = hitFromName(titleThen?.[1], 'greeting', body, titleThen?.[0]?.match(/대표원장|원장|수의사|대표자?/)?.[0]);
	if (fromTitle) return fromTitle;
	const fromImgFile = hitFromImageRep(
		extractImageRepFromHtml(html, { attrs: false, filenames: true }),
		'greeting',
		body,
	);
	if (fromImgFile) return fromImgFile;
	const fromImage = hitFromName(extractCeoNameFromImageRefs(html), 'greeting', body);
	if (fromImage) return fromImage;
	return null;
}

function extractNameFromDoctorCard($: CheerioAPI, selector: string): CeoNameHit | null {
	const $card = $(selector).first();
	if (!$card.length) return null;
	const cardHtml = $card.html() || '';
	const cardText = compact($card.text());
	const labeled = firstLabeledName(cardText, 'doctor');
	if (labeled) return labeled;
	const titleThen = cardText.match(TITLE_THEN_NAME_RE);
	const fromTitle = hitFromName(
		titleThen?.[1],
		'doctor',
		cardText,
		titleThen?.[0]?.match(/대표원장|원장|수의사|대표자?/)?.[0],
	);
	if (fromTitle) return fromTitle;
	const nameThen = cardText.match(NAME_THEN_TITLE_RE);
	const fromNameThen = hitFromName(nameThen?.[1], 'doctor', cardText);
	if (fromNameThen) return fromNameThen;

	let found: CeoNameHit | null = null;
	$card.find(CARD_NAME_SELECTORS).each((_, el) => {
		if (found) return;
		const text = compact($(el).text());
		const labeledNode = firstLabeledName(text, 'doctor');
		if (labeledNode) {
			found = labeledNode;
			return;
		}
		if (isValidKoreanCeoName(text)) {
			found = hitFromName(text, 'doctor', cardText);
		}
	});
	if (found) return found;
	const fromCardImg = hitFromImageRep(extractImageRepFromHtml(cardHtml), 'doctor', cardText);
	if (fromCardImg) return fromCardImg;
	return hitFromName(extractCeoNameFromImageRefs(cardHtml), 'doctor', cardText);
}

export function extractCeoFromDoctorHtml(html: string): CeoNameHit | null {
	if (!html) return null;
	const $ = cheerio.load(html);
	$('script, style, noscript').remove();
	for (const sel of FIRST_DOCTOR_CARD_SELECTORS) {
		const hit = extractNameFromDoctorCard($, sel);
		if (hit) return hit;
	}
	const body = compact($('body').text() || $.root().text());
	return (
		firstLabeledName(body, 'doctor') ||
		hitFromImageRep(extractImageRepFromHtml(html), 'doctor', body) ||
		hitFromName(extractCeoNameFromImageRefs(html), 'doctor', body)
	);
}

export function extractCeoFromGreetingPages(pages: CeoSourcePage[] | undefined): CeoNameHit | null {
	for (const page of pages || []) {
		const hay = `${page.url || ''} ${page.title || ''}`;
		if (page.url || page.title) {
			if (!isGreetingCeoPage(page.url || '', page.title) && !isGreetingCeoPage(hay)) continue;
		}
		const hit = extractCeoFromGreetingHtml(page.html || '');
		if (hit) return hit;
	}
	return null;
}

export function extractCeoFromDoctorPages(pages: CeoSourcePage[] | undefined): CeoNameHit | null {
	for (const page of pages || []) {
		const hay = `${page.url || ''} ${page.title || ''}`;
		if (page.url || page.title) {
			if (!isDoctorTeamPage(page.url || '', page.title) && !isDoctorTeamPage(hay)) continue;
		}
		const hit = extractCeoFromDoctorHtml(page.html || '');
		if (hit) return hit;
	}
	return null;
}

export function resolveCeoNameSequential(input: {
	html?: string;
	footerHtml?: string;
	footerText?: string;
	$?: CheerioAPI;
	greetingPages?: CeoSourcePage[];
	greetingHtml?: string;
	doctorPages?: CeoSourcePage[];
	doctorHtml?: string;
	fallback?: string;
}): CeoNameHit {
	const schema = extractSchemaPerson(input.html || input.footerHtml || input.footerText || '');
	if (schema?.name) {
		return {
			name: schema.name,
			jobTitle: schema.jobTitle || inferJobTitle(schema.jobTitle || input.html || ''),
			source: 'schema',
			isExtracted: true,
		};
	}

	const footer = extractCeoFromFooter({
		html: input.html,
		footerHtml: input.footerHtml,
		footerText: input.footerText,
		$: input.$,
	});
	if (footer) return footer;

	const greetingPages =
		input.greetingPages && input.greetingPages.length > 0
			? input.greetingPages
			: input.greetingHtml
				? [{ html: input.greetingHtml, url: '/about.php', title: '인사말' }]
				: [];
	const greeting = extractCeoFromGreetingPages(greetingPages);
	if (greeting) return greeting;

	const doctorPages =
		input.doctorPages && input.doctorPages.length > 0
			? input.doctorPages
			: input.doctorHtml
				? [{ html: input.doctorHtml, url: '/doctor.php', title: '의료진' }]
				: [];
	const doctor = extractCeoFromDoctorPages(doctorPages);
	if (doctor) return doctor;

	const fallback = compact(input.fallback) || DEFAULT_CEO_NAME_FALLBACK;
	return {
		name: fallback,
		jobTitle: '대표원장',
		source: 'fallback',
		isExtracted: false,
	};
}

export function applyCeoNameToSiteMeta<T extends { representativeName?: string; representativeJobTitle?: string; ceoName?: string; ceoNameSource?: CeoNameSource }>(
	siteMeta: T,
	hit: CeoNameHit,
): T {
	if (hit.isExtracted) {
		siteMeta.ceoName = hit.name;
		siteMeta.ceoNameSource = hit.source;
		siteMeta.representativeName = hit.name;
		if (hit.jobTitle) siteMeta.representativeJobTitle = hit.jobTitle;
		return siteMeta;
	}
	if (!siteMeta.representativeName) {
		siteMeta.ceoName = hit.name;
		siteMeta.ceoNameSource = hit.source;
		siteMeta.representativeName = hit.name;
		if (hit.jobTitle) siteMeta.representativeJobTitle = hit.jobTitle;
	} else if (!siteMeta.ceoName) {
		siteMeta.ceoName = siteMeta.representativeName;
	}
	return siteMeta;
}
