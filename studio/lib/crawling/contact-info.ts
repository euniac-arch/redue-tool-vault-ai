import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { extractRootDomain } from './domain';
import { decodeHtmlBuffer } from './hybrid-scan';
import { extractAddressesFromHtml, evaluatePagesLocation } from './location-filter';

const CRAWL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RedueBot/1.0';
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

const PAGE_TIMEOUT_MS = 8_000;
const MAX_CONTACT_PAGES = 2;
const MAX_LOCATION_PAGES = 3;
const MAX_HTML_BYTES = 1_500_000;

/**
 * Representative email pattern (global). Recreate per scan — `g` regexes keep lastIndex.
 * Same shape as `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g`.
 */
export function createEmailPattern(): RegExp {
	return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
}

/** GNB / footer / about-page keywords (EN + JP spec, plus KR equivalents). */
export const CONTACT_LINK_KEYWORDS = [
	'contact',
	'contact-us',
	'contactus',
	'inquiry',
	'enquire',
	'enquiry',
	'お問い合わせ',
	'会社概要',
	'about',
	'문의',
	'연락처',
	'회사소개',
	'회사개요',
	'고객문의',
] as const;

/** Extra GNB/footer keywords used when collecting company-address pages. */
export const LOCATION_LINK_KEYWORDS = [
	...CONTACT_LINK_KEYWORDS,
	'location',
	'directions',
	'company',
	'오시는길',
	'찾아오시는길',
	'찾아오시는 길',
	'회사정보',
] as const;

const WELL_KNOWN_LOCATION_PATHS = [
	'/contact',
	'/contact-us',
	'/about',
	'/about-us',
	'/company',
	'/intro',
	'/location',
] as const;

const NAV_LINK_SELECTORS = [
	'header a[href]',
	'nav a[href]',
	'footer a[href]',
	'#header a[href]',
	'#footer a[href]',
	'#gnb a[href]',
	'.gnb a[href]',
	'#lnb a[href]',
	'.lnb a[href]',
	'.header a[href]',
	'.footer a[href]',
	'#quick a[href]',
	'.quick a[href]',
].join(', ');

const FILE_EXT_TLDS = new Set([
	'png',
	'jpg',
	'jpeg',
	'gif',
	'svg',
	'webp',
	'ico',
	'bmp',
	'css',
	'js',
	'mjs',
	'woff',
	'woff2',
	'ttf',
	'eot',
	'otf',
	'mp4',
	'mp3',
	'pdf',
	'html',
	'htm',
	'xml',
	'json',
	'map',
]);

const JUNK_EMAIL_DOMAINS = new Set([
	'example.com',
	'example.org',
	'example.net',
	'domain.com',
	'email.com',
	'sentry.io',
	'wixpress.com',
	'schema.org',
	'googleapis.com',
	'gstatic.com',
	'w3.org',
	'cloudflare.com',
	'jquery.com',
	'sentry-next.wixpress.com',
]);

const SKIP_HREF_RE = /^(mailto:|tel:|javascript:|data:|about:|#)/i;
const ASSET_PATH_RE = /\.(?:png|jpe?g|gif|svg|webp|ico|pdf|css|js|woff2?|ttf|eot|mp4)(?:$|\?)/i;

export type ScrapedHtmlPage = {
	url: string;
	html: string;
};

export type ExtractedSocialLinks = {
	kakaoChannelUrl: string | null;
	instagramUrl: string | null;
	naverTalkUrl: string | null;
};

export type ExtractedContactInfo = {
	email: string | null;
	contactFormUrl: string | null;
	phoneNumber: string | null;
	address: string | null;
	kakaoChannelUrl: string | null;
	instagramUrl: string | null;
	naverTalkUrl: string | null;
	lastScrapedAt: Date;
	source: 'homepage' | 'subpage' | 'none';
	pagesVisited: string[];
	pages: ScrapedHtmlPage[];
};

export type ExtractContactInfoOptions = {
	/**
	 * Also fetch /contact · /about (and well-known paths) so address
	 * validation can run even when an email is already on the homepage.
	 * Skipped when `targetRegion` is set and the homepage already has a
	 * conclusive address (in-region or out-of-region).
	 */
	collectLocationPages?: boolean;
	/** Metro used to decide whether extra location pages are still needed. */
	targetRegion?: string | null;
};

function normalizeTargetUrl(raw: string): string {
	const trimmed = typeof raw === 'string' ? raw.trim() : '';
	if (!trimmed) return '';
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
		return true;
	}
	if (host === '0.0.0.0' || host === '::1') return true;
	const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (ipv4) {
		const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
		if (a === 10 || a === 127 || a === 0) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
	}
	return false;
}

export function isSafePublicHttpUrl(raw: string): boolean {
	try {
		const url = new URL(normalizeTargetUrl(raw));
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
		if (isPrivateOrLocalHostname(url.hostname)) return false;
		return true;
	} catch {
		return false;
	}
}

function tldOfEmail(email: string): string {
	const at = email.lastIndexOf('@');
	const domain = at >= 0 ? email.slice(at + 1) : email;
	const parts = domain.split('.');
	return (parts[parts.length - 1] || '').toLowerCase();
}

function domainOfEmail(email: string): string {
	const at = email.lastIndexOf('@');
	return (at >= 0 ? email.slice(at + 1) : email).toLowerCase();
}

export function isPlausibleEmail(raw: string): boolean {
	const email = raw.trim().replace(/[>,;]+$/g, '').toLowerCase();
	if (!email || email.length > 254) return false;
	if (email.includes('..') || email.startsWith('.') || email.startsWith('@')) return false;
	if (FILE_EXT_TLDS.has(tldOfEmail(email))) return false;
	const domain = domainOfEmail(email);
	if (JUNK_EMAIL_DOMAINS.has(domain)) return false;
	if (domain.endsWith('.png') || domain.endsWith('.jpg')) return false;
	const local = email.slice(0, email.indexOf('@'));
	if (!local || local.length > 64) return false;
	return true;
}

/**
 * Scan raw HTML (and mailto hrefs) with the representative-email regex.
 * Returns unique addresses in first-seen order.
 */
export function extractEmailsFromHtml(html: string): string[] {
	if (!html) return [];
	const seen = new Set<string>();
	const ordered: string[] = [];

	const push = (value: string) => {
		const email = value.trim().replace(/^mailto:/i, '').split('?')[0]?.trim() ?? '';
		if (!isPlausibleEmail(email)) return;
		const key = email.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		ordered.push(email);
	};

	const pattern = createEmailPattern();
	for (const match of html.match(pattern) ?? []) {
		push(match);
	}

	return ordered;
}

const KAKAO_CHANNEL_HREF_RE = /(?:pf|open)\.kakao\.com/i;
const INSTAGRAM_HREF_RE = /(?:^|\/\/|\.)instagram\.com(?:[/:?#]|$)/i;
const NAVER_TALK_HREF_RE = /talk\.naver\.com/i;

const KR_PHONE_LABELED_RE =
	/(?:전화(?:번호)?|TEL|Tel|T)\s*[:：]?\s*((?:\+?82[-\s]?)?0?\d{1,2}[-\s.)]?\d{3,4}[-\s.]?\d{4})/;
const KR_PHONE_BARE_RE =
	/(?:^|[^\w@.])((?:0\d{1,2}|\+82[-\s]?\d{1,2})[-\s.)]?\d{3,4}[-\s.]?\d{4})(?:$|[^\w@])/;

export function emptySocialLinks(): ExtractedSocialLinks {
	return {
		kakaoChannelUrl: null,
		instagramUrl: null,
		naverTalkUrl: null,
	};
}

export function mergeSocialLinks(
	current: ExtractedSocialLinks,
	incoming: ExtractedSocialLinks,
): ExtractedSocialLinks {
	return {
		kakaoChannelUrl: current.kakaoChannelUrl || incoming.kakaoChannelUrl,
		instagramUrl: current.instagramUrl || incoming.instagramUrl,
		naverTalkUrl: current.naverTalkUrl || incoming.naverTalkUrl,
	};
}

function normalizeHttpHref(href: string): string | null {
	const trimmed = href.trim();
	if (!trimmed || SKIP_HREF_RE.test(trimmed)) return null;
	try {
		const absolute = new URL(
			trimmed.startsWith('//') ? `https:${trimmed}` : trimmed,
			'https://placeholder.invalid',
		);
		if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return null;
		if (absolute.hostname === 'placeholder.invalid') return null;
		absolute.hash = '';
		return absolute.toString();
	} catch {
		return null;
	}
}

function firstAnchorHrefMatching(html: string, pattern: RegExp): string | null {
	if (!html) return null;
	const $ = cheerio.load(html);
	let found: string | null = null;
	$('a[href]').each((_, el) => {
		if (found) return;
		const href = $(el).attr('href');
		if (!href || !pattern.test(href)) return;
		const absolute = normalizeHttpHref(href);
		if (!absolute || !pattern.test(absolute)) return;
		found = absolute;
	});
	return found;
}

/**
 * Pull KakaoTalk channel / open-chat, Instagram, and Naver TalkTalk URLs
 * from `<a href>` on a page (footer / GNB / floating buttons included).
 */
export function extractSocialLinks(html: string): ExtractedSocialLinks {
	if (!html) return emptySocialLinks();
	return {
		kakaoChannelUrl: firstAnchorHrefMatching(html, KAKAO_CHANNEL_HREF_RE),
		instagramUrl: firstAnchorHrefMatching(html, INSTAGRAM_HREF_RE),
		naverTalkUrl: firstAnchorHrefMatching(html, NAVER_TALK_HREF_RE),
	};
}

export function normalizePhoneNumber(raw: string): string | null {
	const trimmed = raw.trim().replace(/^tel:/i, '').split('?')[0]?.trim() ?? '';
	if (!trimmed) return null;
	const compact = trimmed.replace(/[()]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');
	let digits = compact.replace(/\D/g, '');
	if (digits.startsWith('82') && digits.length >= 11) {
		digits = `0${digits.slice(2)}`;
	}
	if (digits.length < 9 || digits.length > 11) return null;
	if (!/^0[1-9]/.test(digits)) return null;
	if (/^(\d)\1+$/.test(digits)) return null;
	return compact.replace(/^\+?82-?/, '0').replace(/^-/, '').slice(0, 20);
}

/** Digit-only identity for phone-based lead dedup (`01012345678`). */
export function phoneIdentityKey(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const normalized = normalizePhoneNumber(raw);
	let digits = (normalized || raw).replace(/\D/g, '');
	if (digits.startsWith('82') && digits.length >= 11) {
		digits = `0${digits.slice(2)}`;
	}
	if (digits.length < 9 || digits.length > 11) return null;
	return digits;
}

/** Common stored formats used when looking up an existing `target_sites.phoneNumber`. */
export function phoneLookupVariants(raw: string | null | undefined): string[] {
	const key = phoneIdentityKey(raw);
	if (!key) return [];
	const variants = new Set<string>();
	const add = (value: string | null | undefined) => {
		const trimmed = (value || '').trim();
		if (trimmed) variants.add(trimmed);
	};
	add(raw);
	add(normalizePhoneNumber(raw || ''));
	add(key);
	if (key.length === 11) {
		add(`${key.slice(0, 3)}-${key.slice(3, 7)}-${key.slice(7)}`);
		add(`${key.slice(0, 3)}-${key.slice(3, 6)}-${key.slice(6)}`);
	} else if (key.length === 10) {
		add(`${key.slice(0, 3)}-${key.slice(3, 6)}-${key.slice(6)}`);
		add(`${key.slice(0, 2)}-${key.slice(2, 6)}-${key.slice(6)}`);
	} else if (key.length === 9) {
		add(`${key.slice(0, 2)}-${key.slice(2, 5)}-${key.slice(5)}`);
	}
	return Array.from(variants);
}

/**
 * Representative phone from `tel:` hrefs, then labeled / bare KR numbers in HTML.
 */
export function extractPhoneNumbersFromHtml(html: string): string[] {
	if (!html) return [];
	const seen = new Set<string>();
	const ordered: string[] = [];

	const push = (value: string) => {
		const phone = normalizePhoneNumber(value);
		if (!phone) return;
		const key = phone.replace(/\D/g, '');
		if (seen.has(key)) return;
		seen.add(key);
		ordered.push(phone);
	};

	const $ = cheerio.load(html);
	$('a[href^="tel:"], a[href^="TEL:"]').each((_, el) => {
		push($(el).attr('href') || '');
	});

	const text = $.root().text().replace(/\s+/g, ' ');
	const labeled = text.match(KR_PHONE_LABELED_RE)?.[1];
	if (labeled) push(labeled);
	const bare = text.match(KR_PHONE_BARE_RE)?.[1];
	if (bare) push(bare);

	return ordered;
}

function collectContactExtras(pages: ScrapedHtmlPage[]): ExtractedSocialLinks & {
	phoneNumber: string | null;
	address: string | null;
} {
	let social = emptySocialLinks();
	let phoneNumber: string | null = null;
	let address: string | null = null;
	for (const page of pages) {
		social = mergeSocialLinks(social, extractSocialLinks(page.html));
		if (!phoneNumber) {
			phoneNumber = extractPhoneNumbersFromHtml(page.html)[0] ?? null;
		}
		if (!address) {
			address = extractAddressesFromHtml(page.html)[0] ?? null;
		}
	}
	return { ...social, phoneNumber, address };
}

export function htmlHasForm(html: string): boolean {
	if (!html) return false;
	return /<form[\s>]/i.test(html);
}

function haystackMatchesKeywords(haystack: string, keywords: readonly string[]): boolean {
	const lower = haystack.toLowerCase();
	return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

export function isContactRelatedUrl(url: string): boolean {
	return haystackMatchesKeywords(url, CONTACT_LINK_KEYWORDS);
}

function linkMatchesKeywords(text: string, href: string, keywords: readonly string[]): boolean {
	return haystackMatchesKeywords(`${text} ${href}`, keywords);
}

function linkMatchesContactKeyword(text: string, href: string): boolean {
	return linkMatchesKeywords(text, href, CONTACT_LINK_KEYWORDS);
}

function resolveSameSiteUrl(href: string, pageUrl: string, rootDomain: string | null): string | null {
	const trimmed = href.trim();
	if (!trimmed || SKIP_HREF_RE.test(trimmed)) return null;
	if (ASSET_PATH_RE.test(trimmed)) return null;

	let absolute: URL;
	try {
		absolute = new URL(trimmed, pageUrl);
	} catch {
		return null;
	}
	if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return null;
	if (isPrivateOrLocalHostname(absolute.hostname)) return null;

	const linkRoot = extractRootDomain(absolute.toString());
	if (!rootDomain || !linkRoot || linkRoot !== rootDomain) return null;

	absolute.hash = '';
	return absolute.toString();
}

/**
 * Collect GNB / footer (then all-anchor fallback) links whose text or href
 * contains a contact / about keyword.
 */
export function findContactPageUrls(html: string, pageUrl: string, limit = MAX_CONTACT_PAGES): string[] {
	if (!html || !pageUrl) return [];
	const $ = cheerio.load(html);
	const rootDomain = extractRootDomain(pageUrl);
	const seen = new Set<string>();
	const urls: string[] = [];

	const consider = (href: string | undefined, text: string) => {
		if (urls.length >= limit) return;
		if (!href || !linkMatchesContactKeyword(text, href)) return;
		const absolute = resolveSameSiteUrl(href, pageUrl, rootDomain);
		if (!absolute) return;
		const key = absolute.replace(/\/$/, '').toLowerCase();
		if (seen.has(key)) return;
		try {
			const resolved = new URL(absolute);
			const page = new URL(pageUrl);
			if (resolved.pathname.replace(/\/$/, '') === page.pathname.replace(/\/$/, '') && resolved.search === page.search) {
				return;
			}
		} catch {
			return;
		}
		seen.add(key);
		urls.push(absolute);
	};

	$(NAV_LINK_SELECTORS).each((_, el) => {
		consider($(el).attr('href'), $(el).text().replace(/\s+/g, ' ').trim());
	});

	if (urls.length < limit) {
		$('a[href]').each((_, el) => {
			consider($(el).attr('href'), $(el).text().replace(/\s+/g, ' ').trim());
		});
	}

	return urls;
}

function wellKnownLocationUrls(pageUrl: string): string[] {
	try {
		const origin = new URL(pageUrl).origin;
		return WELL_KNOWN_LOCATION_PATHS.map((path) => `${origin}${path}`);
	} catch {
		return [];
	}
}

/**
 * Contact/about links plus well-known `/contact` · `/about` paths used for
 * company-address extraction (main + footer are already on the homepage).
 */
export function findLocationPageUrls(
	html: string,
	pageUrl: string,
	limit = MAX_LOCATION_PAGES,
): string[] {
	const linked = findContactPageUrls(html, pageUrl, limit);
	if (linked.length >= limit) return linked.slice(0, limit);

	const $ = cheerio.load(html);
	const rootDomain = extractRootDomain(pageUrl);
	const seen = new Set(linked.map((url) => url.replace(/\/$/, '').toLowerCase()));
	const urls = [...linked];

	const consider = (href: string | undefined, text: string) => {
		if (urls.length >= limit) return;
		if (!href || !linkMatchesKeywords(text, href, LOCATION_LINK_KEYWORDS)) return;
		const absolute = resolveSameSiteUrl(href, pageUrl, rootDomain);
		if (!absolute) return;
		const key = absolute.replace(/\/$/, '').toLowerCase();
		if (seen.has(key)) return;
		try {
			const resolved = new URL(absolute);
			const page = new URL(pageUrl);
			if (
				resolved.pathname.replace(/\/$/, '') === page.pathname.replace(/\/$/, '') &&
				resolved.search === page.search
			) {
				return;
			}
		} catch {
			return;
		}
		seen.add(key);
		urls.push(absolute);
	};

	$('a[href]').each((_, el) => {
		consider($(el).attr('href'), $(el).text().replace(/\s+/g, ' ').trim());
	});

	for (const candidate of wellKnownLocationUrls(pageUrl)) {
		if (urls.length >= limit) break;
		const key = candidate.replace(/\/$/, '').toLowerCase();
		if (seen.has(key)) continue;
		if (!isSafePublicHttpUrl(candidate)) continue;
		seen.add(key);
		urls.push(candidate);
	}

	return urls;
}

export function pickContactFormUrl(
	pages: Array<{ url: string; html: string; isContactPage?: boolean }>,
): string | null {
	for (const page of pages) {
		if (htmlHasForm(page.html) || page.isContactPage || isContactRelatedUrl(page.url)) {
			return page.url;
		}
	}
	return null;
}

async function fetchHtml(url: string): Promise<string> {
	const res = await axios.get<ArrayBuffer>(url, {
		headers: {
			'User-Agent': CRAWL_USER_AGENT,
			Accept: 'text/html,application/xhtml+xml',
		},
		timeout: PAGE_TIMEOUT_MS,
		responseType: 'arraybuffer',
		httpsAgent: insecureHttpsAgent,
		maxRedirects: 5,
		maxContentLength: MAX_HTML_BYTES,
		validateStatus: (status) => status >= 200 && status < 400,
	});
	const contentType =
		typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : undefined;
	if (contentType && !/html|xml|text\/plain/i.test(contentType) && !/charset=/i.test(contentType)) {
		return '';
	}
	return decodeHtmlBuffer(res.data, contentType);
}

/**
 * Fetch a domain (or full URL), extract a representative email, and fall back
 * to a contact-form URL when no mailbox is published.
 *
 * 1) Homepage HTML regex scan (footer included)
 * 2) GNB/Footer contact·about links → subpage rescan
 * 3) Optional `/contact` · `/about` fetches for address validation
 * 4) If still no email: store the contact/form page URL
 * 5) Same HTML pass: phone, address, Kakao / Instagram / Naver TalkTalk hrefs
 */
export async function extractContactInfo(
	domainUrl: string,
	options: ExtractContactInfoOptions = {},
): Promise<ExtractedContactInfo> {
	const lastScrapedAt = new Date();
	const empty: ExtractedContactInfo = {
		email: null,
		contactFormUrl: null,
		phoneNumber: null,
		address: null,
		kakaoChannelUrl: null,
		instagramUrl: null,
		naverTalkUrl: null,
		lastScrapedAt,
		source: 'none',
		pagesVisited: [],
		pages: [],
	};

	const homepageUrl = normalizeTargetUrl(domainUrl);
	if (!homepageUrl || !isSafePublicHttpUrl(homepageUrl)) {
		return empty;
	}

	let homepageHtml: string;
	try {
		homepageHtml = await fetchHtml(homepageUrl);
	} catch (error) {
		console.warn(
			'[contact-info] homepage fetch failed:',
			homepageUrl,
			error instanceof Error ? error.message : error,
		);
		return empty;
	}

	const pages: ScrapedHtmlPage[] = [{ url: homepageUrl, html: homepageHtml }];
	const pagesVisited = [homepageUrl];
	const homepageEmails = extractEmailsFromHtml(homepageHtml);
	const collectLocationPages = Boolean(options.collectLocationPages);
	const homepageLocation =
		collectLocationPages && options.targetRegion
			? evaluatePagesLocation(pages, options.targetRegion)
			: null;
	const locationResolved = Boolean(homepageLocation && homepageLocation.verdict !== 'unknown');
	const shouldFetchSubpages = !homepageEmails[0] || (collectLocationPages && !locationResolved);
	const subpageLimit = collectLocationPages ? MAX_LOCATION_PAGES : MAX_CONTACT_PAGES;
	const subpageUrls = shouldFetchSubpages
		? collectLocationPages
			? findLocationPageUrls(homepageHtml, homepageUrl, subpageLimit)
			: findContactPageUrls(homepageHtml, homepageUrl, subpageLimit)
		: [];

	const subpages: Array<{ url: string; html: string; isContactPage: boolean }> = [];
	let subpageEmail: string | null = null;

	for (const subUrl of subpageUrls) {
		if (!isSafePublicHttpUrl(subUrl)) continue;
		if (pagesVisited.some((visited) => visited.replace(/\/$/, '') === subUrl.replace(/\/$/, ''))) {
			continue;
		}
		try {
			const html = await fetchHtml(subUrl);
			pagesVisited.push(subUrl);
			pages.push({ url: subUrl, html });
			subpages.push({
				url: subUrl,
				html,
				isContactPage: isContactRelatedUrl(subUrl),
			});
			if (!subpageEmail) {
				const emails = extractEmailsFromHtml(html);
				if (emails[0]) subpageEmail = emails[0];
			}
			if (subpageEmail && !collectLocationPages) break;
		} catch (error) {
			console.warn(
				'[contact-info] subpage fetch failed:',
				subUrl,
				error instanceof Error ? error.message : error,
			);
		}
	}

	const extras = collectContactExtras(pages);
	const email = homepageEmails[0] || subpageEmail || null;
	if (email) {
		return {
			email,
			contactFormUrl: null,
			...extras,
			lastScrapedAt,
			source: homepageEmails[0] ? 'homepage' : 'subpage',
			pagesVisited,
			pages,
		};
	}

	const contactFormUrl = pickContactFormUrl([
		...subpages,
		{
			url: homepageUrl,
			html: homepageHtml,
			isContactPage: isContactRelatedUrl(homepageUrl),
		},
	]);

	return {
		email: null,
		contactFormUrl,
		...extras,
		lastScrapedAt,
		source: 'none',
		pagesVisited,
		pages,
	};
}

export async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	if (items.length === 0) return [];
	const concurrency = Math.max(1, Math.min(limit, items.length));
	const results = new Array<R>(items.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await mapper(items[index], index);
		}
	}

	await Promise.all(Array.from({ length: concurrency }, () => worker()));
	return results;
}
