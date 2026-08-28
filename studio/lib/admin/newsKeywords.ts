import type { GeoNewsCategory } from './geo-news-management';

export type NewsKeywordCategoryId =
	| 'GEO_AI_SEARCH'
	| 'SCHEMA_SEMANTIC'
	| 'WEB_VITALS_PERF'
	| 'DOMESTIC_PORTAL';

export type NewsKeywordCategory = {
	categoryName: string;
	tag: string;
	keywords: string[];
};

export const NEWS_KEYWORD_CATEGORIES: Record<NewsKeywordCategoryId, NewsKeywordCategory> = {
	GEO_AI_SEARCH: {
		categoryName: 'AI 검색 & GEO',
		tag: '#GEO',
		keywords: [
			'GEO 최적화',
			'AI 검색 최적화',
			'생성형 검색',
			'AI 오버뷰',
			'서치GPT',
			'SearchGPT',
			'퍼플렉시티 검색',
			'AI 검색 인용',
			'E-E-A-T',
		],
	},
	SCHEMA_SEMANTIC: {
		categoryName: '스키마 & 구조화 데이터',
		tag: '#스키마마크업',
		keywords: [
			'스키마 마크업',
			'구조화 데이터',
			'JSON-LD',
			'리치 스니펫',
			'시맨틱 태그',
			'llms.txt',
			'웹 접근성',
		],
	},
	WEB_VITALS_PERF: {
		categoryName: '웹 성능 & 코어 웹 바이탈',
		tag: '#CoreWebVitals',
		keywords: [
			'코어 웹 바이탈',
			'Core Web Vitals',
			'웹 성능 최적화',
			'LCP 개선',
			'PageSpeed',
			'구글 검색 알고리즘',
			'구글 코어 업데이트',
		],
	},
	DOMESTIC_PORTAL: {
		categoryName: '국내 포털 검색 트렌드',
		tag: '#국내검색',
		keywords: ['네이버 AI 검색', '네이버 큐', '네이버 서치어드바이저', '검색엔진 최적화 SEO'],
	},
};

/** Broad terms that pull off-topic hits unless another pool keyword / SEO context is present. */
export const BROAD_NEWS_KEYWORDS = new Set([
	'웹 접근성',
	'PageSpeed',
	'검색엔진 최적화 SEO',
	'구글 검색 알고리즘',
	'웹 성능 최적화',
]);

/**
 * English query expansions for Google News GLOBAL. Not added to the crawl pool itself —
 * Korean keywords rarely hit the EN index on their own.
 */
export const NEWS_KEYWORD_EN_ALIASES: Record<string, string[]> = {
	'GEO 최적화': ['GEO optimization', 'generative engine optimization'],
	'AI 검색 최적화': ['AI search optimization'],
	'생성형 검색': ['generative search'],
	'AI 오버뷰': ['AI Overviews', 'Google AI Overview'],
	서치GPT: ['SearchGPT'],
	'퍼플렉시티 검색': ['Perplexity search', 'Perplexity citation'],
	'AI 검색 인용': ['AI search citation'],
	'E-E-A-T': ['EEAT', 'E-E-A-T'],
	'스키마 마크업': ['schema markup'],
	'구조화 데이터': ['structured data'],
	'리치 스니펫': ['rich snippet', 'rich result'],
	'시맨틱 태그': ['semantic HTML'],
	'llms.txt': ['llms.txt'],
	'웹 접근성': ['web accessibility'],
	'코어 웹 바이탈': ['Core Web Vitals'],
	'웹 성능 최적화': ['web performance optimization'],
	'LCP 개선': ['LCP', 'Largest Contentful Paint'],
	'구글 검색 알고리즘': ['Google search algorithm'],
	'구글 코어 업데이트': ['Google core update'],
	'네이버 AI 검색': ['Naver AI search'],
	'네이버 큐': ['Naver Cue'],
	'네이버 서치어드바이저': ['Naver Search Advisor'],
	'검색엔진 최적화 SEO': ['search engine optimization'],
};

const PRECISION_CONTEXT_TERMS = [
	'seo',
	'geo',
	'schema',
	'json-ld',
	'json ld',
	'llms.txt',
	'llms txt',
	'검색 최적화',
	'구조화',
	'마크업',
	'core web vitals',
	'코어 웹',
	'ai overview',
	'ai 오버뷰',
	'생성형',
	'rich snippet',
	'리치 스니펫',
	'e-e-a-t',
	'eeat',
	'searchgpt',
	'perplexity',
	'페이지스피드',
];

export type NewsKeywordHit = {
	categoryId: NewsKeywordCategoryId;
	categoryName: string;
	tag: string;
	keyword: string;
};

export function listNewsKeywordCategories(): Array<{ id: NewsKeywordCategoryId } & NewsKeywordCategory> {
	return (Object.keys(NEWS_KEYWORD_CATEGORIES) as NewsKeywordCategoryId[]).map((id) => ({
		id,
		...NEWS_KEYWORD_CATEGORIES[id],
	}));
}

export function flattenNewsKeywords(): string[] {
	return listNewsKeywordCategories().flatMap((category) => category.keywords);
}

export function newsKeywordTagLabel(tag: string): string {
	return tag.replace(/^#/, '').trim();
}

export function toGeoNewsCategory(categoryId: NewsKeywordCategoryId, matchedKeywords: string[] = []): GeoNewsCategory {
	if (categoryId === 'SCHEMA_SEMANTIC') return 'Schema Markup';
	if (categoryId === 'WEB_VITALS_PERF' || categoryId === 'DOMESTIC_PORTAL') return 'Search Engine';
	const haystack = matchedKeywords.join(' ').toLowerCase();
	if (/(searchgpt|서치gpt|perplexity|퍼플렉시티)/i.test(haystack)) return 'AI Model';
	return 'GEO';
}

export function normalizeNewsMatchText(value: string): string {
	return value
		.toLowerCase()
		.replace(/e-e-a-t/gi, 'eeat')
		.replace(/json-ld/gi, 'jsonld')
		.replace(/llms\.txt/gi, 'llmstxt')
		.replace(/[-_.]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function matchTermsForKeyword(keyword: string): string[] {
	const aliases = NEWS_KEYWORD_EN_ALIASES[keyword] ?? [];
	return [keyword, ...aliases];
}

export function matchNewsKeywords(title: string, snippet = ''): NewsKeywordHit[] {
	const haystack = normalizeNewsMatchText(`${title} ${snippet}`);
	if (!haystack) return [];

	const hits: NewsKeywordHit[] = [];
	for (const category of listNewsKeywordCategories()) {
		for (const keyword of category.keywords) {
			const matched = matchTermsForKeyword(keyword).some((term) =>
				haystack.includes(normalizeNewsMatchText(term)),
			);
			if (!matched) continue;
			hits.push({
				categoryId: category.id,
				categoryName: category.categoryName,
				tag: category.tag,
				keyword,
			});
		}
	}
	return hits;
}

export function hasPrecisionContext(title: string, snippet = ''): boolean {
	const haystack = normalizeNewsMatchText(`${title} ${snippet}`);
	return PRECISION_CONTEXT_TERMS.some((term) => haystack.includes(normalizeNewsMatchText(term)));
}

export type NewsTargetingResult = {
	accepted: boolean;
	hits: NewsKeywordHit[];
	primaryCategoryId: NewsKeywordCategoryId | null;
	matchedKeywords: string[];
	tags: string[];
};

/**
 * Precise targeting: keep the article only when a pool keyword hits.
 * Broad keywords (PageSpeed, 웹 접근성, generic SEO) need a second signal.
 */
export function evaluateNewsTargeting(title: string, snippet = ''): NewsTargetingResult {
	const hits = matchNewsKeywords(title, snippet);
	if (hits.length === 0) {
		return { accepted: false, hits: [], primaryCategoryId: null, matchedKeywords: [], tags: [] };
	}

	const preciseHits = hits.filter((hit) => !BROAD_NEWS_KEYWORDS.has(hit.keyword));
	const accepted = preciseHits.length > 0 || (hits.length > 0 && hasPrecisionContext(title, snippet));
	const primaryHits = preciseHits.length > 0 ? preciseHits : hits;
	const primaryCategoryId = primaryHits[0]?.categoryId ?? null;
	const matchedKeywords = [...new Set(hits.map((hit) => hit.keyword))];
	const tags = [
		...new Set([
			...hits.map((hit) => newsKeywordTagLabel(hit.tag)),
			...matchedKeywords.slice(0, 3),
		]),
	].slice(0, 4);

	return { accepted, hits, primaryCategoryId, matchedKeywords, tags };
}

export function buildNaverNewsQuery(categoryId: NewsKeywordCategoryId): string {
	return NEWS_KEYWORD_CATEGORIES[categoryId].keywords.map((keyword) => `"${keyword}"`).join(' | ');
}

export function buildGoogleNewsQuery(categoryId: NewsKeywordCategoryId, locale: 'ko' | 'en'): string {
	const keywords = NEWS_KEYWORD_CATEGORIES[categoryId].keywords;
	const terms =
		locale === 'en'
			? uniqueNonEmpty(keywords.flatMap((keyword) => englishSearchTerms(keyword)))
			: keywords;
	const joined = terms.join(' OR ');
	return `${joined} when:30d`;
}

function englishSearchTerms(keyword: string): string[] {
	const aliases = NEWS_KEYWORD_EN_ALIASES[keyword] ?? [];
	const isLatinOnly = /[A-Za-z]/.test(keyword) && !/[가-힣]/.test(keyword);
	return isLatinOnly ? [keyword, ...aliases] : aliases;
}

function uniqueNonEmpty(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
