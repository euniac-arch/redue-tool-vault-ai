/**
 * Map an observed URL to an Evidence Explorer source type.
 * Classification is DERIVED. The URL itself must already be observed.
 * Unknown hosts become `other` — never guessed as news/blog/directory.
 */
import { citationDomain, citationKindFromObservedUrl, isOwnedCitationDomain } from '@/lib/ai-search-intelligence/citations/classify';
import type { AsiEvidenceSourceType } from '@/lib/ai-search-intelligence/types';

const DIRECTORY_HOST =
	/yelp\.|yellowpages?|hotpepper|tripadvisor|booking\.com|store\.naver|smartplace|114\.co|mangoplate|siksinhot/;

export function evidenceSourceTypeFromUrl(url: string, siteUrl: string): AsiEvidenceSourceType | null {
	if (!citationDomain(url)) return null;
	if (isOwnedCitationDomain(url, siteUrl)) return 'official';
	const kind = citationKindFromObservedUrl(url);
	if (kind === 'youtube') return 'youtube';
	if (kind === 'sns') return 'social';
	if (kind === 'map') return 'map';
	if (kind === 'blog') return 'blog';
	if (kind === 'news') return 'news';
	if (kind === 'review') return 'review';
	const host = `${citationDomain(url)} ${url}`.toLowerCase();
	if (DIRECTORY_HOST.test(host)) return 'directory';
	return 'other';
}

export function relatedPageFromUrl(url: string, siteUrl: string): string | null {
	if (!isOwnedCitationDomain(url, siteUrl)) return null;
	return url;
}
