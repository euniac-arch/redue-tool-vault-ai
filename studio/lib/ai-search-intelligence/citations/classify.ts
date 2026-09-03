import type { AsiCitationKind, AsiCitationSourceClass } from '@/lib/ai-search-intelligence/types';

export function citationDomain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
	} catch {
		return '';
	}
}

export function isOwnedCitationDomain(url: string, siteUrl: string): boolean {
	const source = citationDomain(url);
	const site = citationDomain(siteUrl);
	if (!source || !site) return false;
	return source === site || source.endsWith(`.${site}`) || site.endsWith(`.${source}`);
}

export function citationKindFromObservedUrl(url: string): AsiCitationKind {
	const host = `${citationDomain(url)} ${url}`.toLowerCase();
	if (/youtube\.com|youtu\.be/.test(host)) return 'youtube';
	if (/instagram|facebook|x\.com|twitter|tiktok/.test(host)) return 'sns';
	if (/map\.naver|place\.naver|maps\.google|google\.[^/]+\/maps|map\.kakao|place\.kakao|place\.kakao/.test(host)) {
		return 'map';
	}
	if (/blog|tistory/.test(host)) return 'blog';
	if (/news|chosun|joongang|hani|ytn|mbc|kbs|sbs|yna\.co/.test(host)) return 'news';
	if (/review|smartstore|catchtable|diningcode/.test(host)) return 'review';
	if (/dcinside|reddit|clien|fmkorea|community|cafe\.naver/.test(host)) return 'third_party';
	return 'third_party';
}

export function classifyCitationSource(url: string, siteUrl: string): AsiCitationSourceClass {
	if (!citationDomain(url)) return 'unknown';
	if (isOwnedCitationDomain(url, siteUrl)) return 'owned';
	const kind = citationKindFromObservedUrl(url);
	if (kind === 'map') return 'local';
	if (kind === 'youtube' || kind === 'sns') return 'social';
	if (kind === 'blog' || kind === 'news' || kind === 'review' || kind === 'third_party') return 'third_party';
	return 'unknown';
}

export function sourceClassFromKind(kind: AsiCitationKind, url: string, siteUrl: string): AsiCitationSourceClass {
	if (isOwnedCitationDomain(url, siteUrl)) return 'owned';
	if (kind === 'map') return 'local';
	if (kind === 'youtube' || kind === 'sns') return 'social';
	if (kind === 'official' || kind === 'schema') return 'owned';
	if (kind === 'blog' || kind === 'news' || kind === 'review' || kind === 'third_party') return 'third_party';
	return 'unknown';
}
