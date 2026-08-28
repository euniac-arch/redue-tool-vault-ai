/**
 * Universal Schema.org sameAs extractor + channel-signal validator.
 *
 * CMS-agnostic: Gnuboard, WordPress, Rhymix, custom SPA, Yoast @graph,
 * MedicalClinic / LocalBusiness / Organization, nested founder /
 * parentOrganization — every `sameAs` string or {@id} lands in one list.
 */

import { extractJsonLdScriptBodies, parseJsonLdDocument } from '@/lib/audit/parser';

/** Naver blog / post / cafe (PC, mobile, search-style hosts). */
export const NAVER_BLOG_CAFE_RE = /(blog|m\.blog|post|cafe)\.naver\.com/i;

/** Naver Place / map / short URL (PC, mobile, naver.me). */
export const NAVER_PLACE_MAP_RE =
	/(map\.naver\.com|place\.naver\.com|m\.place\.naver\.com|naver\.me)/i;

/** Google Maps / GBP share links. */
export const GOOGLE_MAPS_GBP_RE = /(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

/** Kakao channel / map / short URL. */
export const KAKAO_CHANNEL_MAP_RE = /(pf\.kakao\.com|map\.kakao\.com|kko\.to)/i;

const MAX_WALK_DEPTH = 24;
const HTTP_URL_RE = /https?:\/\/[^\s"'\\<>]+/gi;

export interface ChannelSignals {
	isNaverBlogLinked: boolean;
	isNaverPlaceLinked: boolean;
	isGoogleMapsLinked: boolean;
	isKakaoLinked: boolean;
	/** Either Naver blog/cafe or Naver Place/map is present. */
	hasNaverChannel: boolean;
	naverBlogUrls: string[];
	naverPlaceUrls: string[];
	googleMapsUrls: string[];
	kakaoUrls: string[];
	urls: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function stripTrailingPunct(raw: string): string {
	return raw.replace(/[.,);\]}>]+$/g, '').replace(/\\+$/g, '').trim();
}

export function normalizeSameAsUrl(raw: string | null | undefined): string {
	let value = stripTrailingPunct(String(raw || '').replace(/\\u002f/gi, '/').replace(/\\\//g, '/'));
	if (!value) return '';
	if (/^(javascript|data|mailto|tel):/i.test(value)) return '';
	if (value.startsWith('//')) value = `https:${value}`;
	try {
		const url = new URL(value.startsWith('http') ? value : `https://${value.replace(/^\/\//, '')}`);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
		url.hash = '';
		url.protocol = 'https:';
		url.hostname = url.hostname.toLowerCase();
		return url.toString().replace(/\/$/, '');
	} catch {
		return '';
	}
}

function dedupeKey(url: string): string {
	return url.replace(/\/+$/, '').toLowerCase();
}

function pushUrl(out: Set<string>, raw: string | null | undefined): void {
	const url = normalizeSameAsUrl(raw);
	if (!url) return;
	out.add(url);
}

/** Collect URL strings from a sameAs value: string | string[] | {@id|url}. */
function collectSameAsValue(value: unknown, out: Set<string>, depth: number): void {
	if (value == null || depth > MAX_WALK_DEPTH) return;
	if (typeof value === 'string') {
		pushUrl(out, value);
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectSameAsValue(item, out, depth + 1);
		return;
	}
	const obj = asRecord(value);
	if (!obj) return;
	if (typeof obj['@id'] === 'string') pushUrl(out, obj['@id']);
	if (typeof obj.url === 'string') pushUrl(out, obj.url);
	if (obj.sameAs != null) collectSameAsValue(obj.sameAs, out, depth + 1);
}

function walkJsonLdForSameAs(value: unknown, out: Set<string>, depth = 0): void {
	if (value == null || depth > MAX_WALK_DEPTH) return;
	if (Array.isArray(value)) {
		for (const item of value) walkJsonLdForSameAs(item, out, depth + 1);
		return;
	}
	const obj = asRecord(value);
	if (!obj) return;
	if (obj.sameAs != null) collectSameAsValue(obj.sameAs, out, depth + 1);
	for (const child of Object.values(obj)) {
		if (child && typeof child === 'object') walkJsonLdForSameAs(child, out, depth + 1);
	}
}

function harvestSameAsWindows(text: string, out: Set<string>): void {
	const lower = text.toLowerCase();
	let from = 0;
	while (from < lower.length) {
		const idx = lower.indexOf('sameas', from);
		if (idx < 0) break;
		const window = text.slice(idx, idx + 2400);
		HTTP_URL_RE.lastIndex = 0;
		for (const match of window.match(HTTP_URL_RE) ?? []) {
			pushUrl(out, match);
		}
		from = idx + 6;
	}
}

function ingestJsonLdPayload(raw: string, out: Set<string>): void {
	const parsed = parseJsonLdDocument(raw);
	if (parsed != null) {
		walkJsonLdForSameAs(parsed, out);
		return;
	}
	harvestSameAsWindows(raw, out);
}

/**
 * Deep-collect every Schema.org `sameAs` URL from HTML, raw JSON-LD, or a
 * parsed node. Extra URLs (siteMeta.sameAs, footer harvest) are merged in.
 */
export function extractUniversalSameAs(
	input: string | unknown | null | undefined,
	extra: readonly string[] = [],
): string[] {
	const collected = new Set<string>();

	if (input != null && typeof input !== 'string') {
		walkJsonLdForSameAs(input, collected);
	} else if (typeof input === 'string' && input.trim()) {
		const html = input;
		const bodies = extractJsonLdScriptBodies(html);
		if (bodies.length) {
			for (const body of bodies) ingestJsonLdPayload(body, collected);
		} else {
			const trimmed = html.trim();
			if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
				ingestJsonLdPayload(trimmed, collected);
			} else {
				ingestJsonLdPayload(html, collected);
				harvestSameAsWindows(html, collected);
			}
		}
	}

	const seen = new Set<string>();
	const result: string[] = [];
	const add = (url: string) => {
		const key = dedupeKey(url);
		if (!key || seen.has(key)) return;
		seen.add(key);
		result.push(url);
	};
	for (const raw of extra) {
		const url = normalizeSameAsUrl(raw);
		if (url) add(url);
	}
	for (const url of collected) add(url);
	return result;
}

/** Harvest every http(s) URL from a raw corpus (footer, collectedUrls, snippets). */
export function harvestHttpUrls(text: string | null | undefined): string[] {
	if (!text) return [];
	const out = new Set<string>();
	HTTP_URL_RE.lastIndex = 0;
	for (const match of text.match(HTTP_URL_RE) ?? []) {
		pushUrl(out, match);
	}
	return Array.from(out);
}

export function isNaverBlogCafeUrl(url: string): boolean {
	return NAVER_BLOG_CAFE_RE.test(url);
}

export function isNaverPlaceMapUrl(url: string): boolean {
	return NAVER_PLACE_MAP_RE.test(url);
}

export function isGoogleMapsGbpUrl(url: string): boolean {
	return GOOGLE_MAPS_GBP_RE.test(url) || /maps\.google|g\.page\//i.test(url);
}

export function isKakaoChannelMapUrl(url: string): boolean {
	return KAKAO_CHANNEL_MAP_RE.test(url);
}

/**
 * Domain-pattern channel classifier — PC/mobile/short/search-style URLs
 * match by host, not exact path equality.
 */
export function validateChannelSignals(urls: readonly string[]): ChannelSignals {
	const naverBlogUrls: string[] = [];
	const naverPlaceUrls: string[] = [];
	const googleMapsUrls: string[] = [];
	const kakaoUrls: string[] = [];
	const normalized: string[] = [];
	const seen = new Set<string>();

	for (const raw of urls) {
		const url = normalizeSameAsUrl(raw) || String(raw || '').trim();
		if (!url) continue;
		const key = dedupeKey(url);
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push(url);
		if (isNaverBlogCafeUrl(url)) naverBlogUrls.push(url);
		if (isNaverPlaceMapUrl(url)) naverPlaceUrls.push(url);
		if (isGoogleMapsGbpUrl(url)) googleMapsUrls.push(url);
		if (isKakaoChannelMapUrl(url)) kakaoUrls.push(url);
	}

	const isNaverBlogLinked = naverBlogUrls.length > 0;
	const isNaverPlaceLinked = naverPlaceUrls.length > 0;
	return {
		isNaverBlogLinked,
		isNaverPlaceLinked,
		isGoogleMapsLinked: googleMapsUrls.length > 0,
		isKakaoLinked: kakaoUrls.length > 0,
		hasNaverChannel: isNaverBlogLinked || isNaverPlaceLinked,
		naverBlogUrls,
		naverPlaceUrls,
		googleMapsUrls,
		kakaoUrls,
		urls: normalized,
	};
}

export function naverSameAsStatusMessage(linked: boolean, lang: 'ko' | 'en' = 'ko'): string {
	if (linked) {
		return lang === 'en'
			? 'Official channel sameAs signal linked'
			: '공식 채널 sameAs 신호 연동 완료';
	}
	return lang === 'en'
		? 'No Naver Place or blog sameAs signal was found on the audited page.'
		: '감사 페이지에서 네이버 플레이스·블로그 sameAs 신호가 확인되지 않았습니다.';
}
