/**
 * Per-page unique Description engine.
 * Step 1: main-container body text (100–130 chars).
 * Step 2: semantic category sentence from GNB / title / filename / URL.
 * Blocks identical template descriptions across subpages.
 */

import type { CheerioAPI } from 'cheerio';

export const BODY_DESC_MIN_CHARS = 30;
export const BODY_SUMMARY_MIN = 100;
export const BODY_SUMMARY_MAX = 130;
export const META_DESC_MIN = 75;
export const META_DESC_MAX = 150;

/** Preferred body containers — user list first, then common CMS scopes. */
export const BODY_CONTENT_SELECTORS = [
	'.sub_content',
	'.sub_con',
	'#contents',
	'#bo_v_con',
	'main',
	'article',
	'.content_area',
	'#sub_contents',
	'#container',
	'#content',
	'#wrapper',
	'[role="main"]',
	'.sub_contents',
	'.sub-content',
	'.content',
	'#bo_v',
	'#bo_list',
	'.board_list',
	'.board_view',
] as const;

const CHROME_STRIP_SELECTORS =
	'script, style, noscript, iframe, header, nav, footer, .gnb, #gnb, #hd, .header, #ft, .footer, #aside, aside, .lnb, #lnb';

export type DescriptionCategory =
	| 'service'
	| 'location'
	| 'about'
	| 'review'
	| 'notice'
	| 'generic';

export type DynamicDescriptionOpts = {
	gnb?: string;
	industryType?: string;
	fileName?: string;
};

function charLen(value: string): number {
	return [...value].length;
}

function sliceChars(value: string, max: number): string {
	return [...value].slice(0, max).join('');
}

export function cleanDescriptionText(raw: string): string {
	return String(raw || '')
		.replace(/[\u0000-\u001f\u007f]/g, ' ')
		.replace(/[^\S\n]+/g, ' ')
		.replace(/\n+/g, ' ')
		.replace(/[·•※★☆▶▷◆◇■□●○◎◇※]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function normKey(value: string): string {
	return cleanDescriptionText(value).replace(/\s+/g, '').toLowerCase();
}

export function isMedicalIndustry(industryType?: string): boolean {
	return /MEDICAL|HOSPITAL|CLINIC|DENTAL|VET|VETERINARY/i.test(String(industryType || ''));
}

function cleanContainerText(root: ReturnType<CheerioAPI>): string {
	const clone = root.clone();
	clone.find(CHROME_STRIP_SELECTORS).remove();
	return cleanDescriptionText(clone.text());
}

/** Step 1 — extract visible text from the main content container. */
export function extractMainContentText($: CheerioAPI): string {
	for (const sel of BODY_CONTENT_SELECTORS) {
		const root = $(sel).first();
		if (!root.length) continue;
		const text = cleanContainerText(root);
		if (charLen(text) >= BODY_DESC_MIN_CHARS) return text;
	}

	const body = $('body').first();
	if (body.length) {
		const text = cleanContainerText(body);
		if (charLen(text) >= BODY_DESC_MIN_CHARS) return text;
	}

	return '';
}

function cutAtSentence(window: string): string {
	const min = BODY_SUMMARY_MIN;
	const hay = window;
	const marks = ['다.', '요.', '니다.', '.', '!', '?', '。'];
	let best = -1;
	for (const mark of marks) {
		const idx = hay.lastIndexOf(mark);
		if (idx + mark.length >= min && idx > best) best = idx + mark.length;
	}
	if (best >= min) return hay.slice(0, best).trim();
	const sp = hay.lastIndexOf(' ');
	if (sp >= min - 5) return hay.slice(0, sp).trim();
	return hay.trim();
}

/** Collapse cleaned body copy to ~100–130 characters. */
export function summarizeBodyText(raw: string): string {
	const cleaned = cleanDescriptionText(raw);
	if (!cleaned) return '';
	if (charLen(cleaned) <= BODY_SUMMARY_MAX) return cleaned;
	return cutAtSentence(sliceChars(cleaned, BODY_SUMMARY_MAX));
}

function fitUniqueDescription(raw: string, siteName: string, pageTitle: string): string {
	const site = (siteName || '').trim() || '공식 사이트';
	const title = (pageTitle || '').trim();
	let d = cleanDescriptionText(raw);
	if (!d) {
		d =
			title && title !== site
				? `${site} ${title} — 믿을 수 있는 전문 정보와 맞춤 안내를 확인하세요.`
				: `${site} 공식 안내 페이지 — 핵심 정보와 맞춤 안내를 확인하세요.`;
	}
	if (charLen(d) < META_DESC_MIN) {
		const extra = title && title !== site
			? ` ${title} 페이지에서 ${site}의 핵심 안내를 확인하세요.`
			: ` ${site}의 핵심 안내와 이용 방법을 확인하세요.`;
		d = `${d}${extra}`.trim();
	}
	if (charLen(d) > META_DESC_MAX) {
		const cut = sliceChars(d, META_DESC_MAX);
		const sp = cut.lastIndexOf(' ');
		d = (sp >= META_DESC_MIN - 5 ? cut.slice(0, sp) : cut).trim();
	}
	return d;
}

export function classifyDescriptionCategory(
	pageTitle: string,
	url: string,
	opts?: DynamicDescriptionOpts,
): DescriptionCategory {
	const text = [pageTitle, url, opts?.gnb, opts?.fileName].filter(Boolean).join(' ').toLowerCase();

	if (/후기|리뷰|사례|review|case|story/i.test(text)) {
		return 'review';
	}
	if (/오시는길|위치|지도|location|map|contact|방문|예약|reservation/i.test(text)) {
		return 'location';
	}
	if (/공지|뉴스|소식|게시판|notice|news|board|bbs/i.test(text)) {
		return 'notice';
	}
	if (/소개|인사말|의료진|원장|about|intro|doctor|team|ceo/i.test(text)) {
		return 'about';
	}
	if (/진료|클리닉|치료|수술|내과|외과|치과|피부|비뇨|검진|service|treatment|product/i.test(text)) {
		return 'service';
	}
	return 'generic';
}

/**
 * Step 2 — unique category sentence. Always includes pageTitle so two boards
 * never share one string. Medical copy only when industry or keywords say so.
 */
export function generateDynamicDescription(
	siteName: string,
	pageTitle: string,
	url: string,
	opts?: DynamicDescriptionOpts,
): string {
	const site = cleanDescriptionText(siteName) || '공식 사이트';
	const rawTitle = cleanDescriptionText(pageTitle);
	const titleLooksLikePath = /https?:\/\/|www\.|\/theme\/|\/bbs\/|\/contents\/|\.php(?:\?|$)|[?&]bo_table=/i.test(
		rawTitle,
	);
	const title =
		(!titleLooksLikePath && rawTitle) ||
		cleanDescriptionText(opts?.fileName || '') ||
		'안내';
	const category = classifyDescriptionCategory(title, url, opts);
	const medical =
		isMedicalIndustry(opts?.industryType) ||
		/진료|클리닉|치료|수술|내과|외과|치과|피부|비뇨|검진|의료/.test(`${title} ${url} ${opts?.gnb || ''}`);

	let sentence = '';
	switch (category) {
		case 'service':
			sentence = medical
				? `${site} ${title} 안내. 전문 의료진의 정밀 검진과 맞춤 치료 프로그램을 제공합니다.`
				: `${site} ${title} 안내. 핵심 서비스와 이용 절차를 한눈에 확인하실 수 있습니다.`;
			break;
		case 'location':
			sentence = medical
				? `${site} ${title} 안내. 상세 위치, 진료 시간, 주차 및 대중교통 안내.`
				: `${site} ${title} 안내. 상세 위치, 영업 시간, 주차 및 대중교통 안내.`;
			break;
		case 'about':
			sentence = medical
				? `${site} ${title}. 풍부한 임상 경험의 전문진과 첨단 의료 시스템을 소개합니다.`
				: `${site} ${title}. 조직 소개와 핵심 역량을 확인하실 수 있습니다.`;
			break;
		case 'review':
			sentence = medical
				? `${site} ${title}. 실제 치료 및 회복 사례를 확인하실 수 있습니다.`
				: `${site} ${title}. 실제 이용 후기와 적용 사례를 확인하실 수 있습니다.`;
			break;
		case 'notice':
			sentence = `${site} ${title} — 주요 공지사항과 새로운 소식을 신속하게 전해드립니다.`;
			break;
		default:
			sentence = `${site} ${title} — 믿을 수 있는 전문 정보와 맞춤 안내를 확인하세요.`;
	}

	return fitUniqueDescription(sentence, site, title);
}

export function isHomepageCopiedDescription(
	candidate: string,
	mainDescription?: string,
	siteName?: string,
): boolean {
	const n = normKey(candidate);
	if (!n) return true;
	const mainN = normKey(mainDescription || '');
	if (mainN && n === mainN) return true;
	const siteN = normKey(siteName || '');
	if (siteN && n === siteN) return true;
	return false;
}

/**
 * Orchestrator: body summary → unique existing meta → category sentence.
 */
export function resolvePageDescription(opts: {
	siteName: string;
	pageTitle: string;
	url: string;
	gnb?: string;
	industryType?: string;
	fileName?: string;
	existingMeta?: string;
	bodyText?: string;
	mainDescription?: string;
}): string {
	const site = (opts.siteName || '').trim() || '공식 사이트';
	const title = (opts.pageTitle || '').trim() || '안내';
	const body = summarizeBodyText(opts.bodyText || '');
	if (charLen(body) >= BODY_DESC_MIN_CHARS) {
		return fitUniqueDescription(body, site, title);
	}

	const meta = cleanDescriptionText(opts.existingMeta || '');
	if (charLen(meta) >= BODY_DESC_MIN_CHARS && !isHomepageCopiedDescription(meta, opts.mainDescription, site)) {
		return fitUniqueDescription(meta, site, title);
	}

	return generateDynamicDescription(site, title, opts.url || '', {
		gnb: opts.gnb,
		industryType: opts.industryType,
		fileName: opts.fileName,
	});
}
