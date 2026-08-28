import type { InsightsNewsCategory } from './insights-news-types';

/**
 * 수집 대상 키워드 그룹 (OR 조건).
 * 기사 제목/본문 요약에 이 중 하나라도 있으면 수집한다.
 */
export const AI_KEYWORDS = [
	// 글로벌 AI & 검색
	'생성형 AI',
	'AI 검색',
	'ChatGPT',
	'퍼플렉시티',
	'Gemini AI',
	// 국내 AI & 포털
	'네이버 클로바',
	'하이퍼클로바X',
	'네이버 큐',
	'뤼튼',
	'국내 AI',
	// 검색 최적화 & 테크
	'GEO 최적화',
	'AEO',
	'AI SEO',
	'검색엔진 최적화',
	'스키마 마크업',
	'구글 검색 알고리즘',
] as const;

/** 오탐 방지 제외 키워드 (NOT 필터). 하나라도 있으면 버린다. */
export const EXCLUDE_KEYWORDS = ['서인영', 'Geo Week', '지오위크', '연예', '스포츠', '부동산 분양'] as const;

type PoolRule = {
	keyword: (typeof AI_KEYWORDS)[number];
	category: InsightsNewsCategory;
	tag: string;
	/** Extra match strings — still OR, never required together. */
	aliases?: string[];
	extraCategories?: InsightsNewsCategory[];
	/** English Google News query. Omit = KR-only search. */
	enQuery?: string;
};

const POOL_RULES: PoolRule[] = [
	{
		keyword: '생성형 AI',
		category: 'AI Search',
		tag: 'AI',
		aliases: ['generative ai', '생성형 인공지능'],
		enQuery: '"generative AI"',
	},
	{
		keyword: 'AI 검색',
		category: 'AI Search',
		tag: 'AI Search',
		aliases: ['ai search', 'chatgpt search', 'ai overviews', 'ai overview'],
		enQuery: '"AI search" OR "AI Overviews" OR "ChatGPT Search"',
	},
	{
		keyword: 'ChatGPT',
		category: 'AI Search',
		tag: 'ChatGPT',
		aliases: ['챗gpt', 'searchgpt'],
		enQuery: 'ChatGPT',
	},
	{
		keyword: '퍼플렉시티',
		category: 'AI Search',
		tag: 'Perplexity',
		aliases: ['perplexity'],
		enQuery: 'Perplexity',
	},
	{
		keyword: 'Gemini AI',
		category: 'AI Search',
		tag: 'Gemini',
		aliases: ['gemini', '제미나이'],
		enQuery: 'Gemini',
	},
	{
		keyword: '네이버 클로바',
		category: 'AI Search',
		tag: 'AI',
		aliases: ['클로바x', 'clova x', 'naver clova'],
	},
	{
		keyword: '하이퍼클로바X',
		category: 'AI Search',
		tag: 'AI',
		aliases: ['하이퍼클로바', 'hyperclova', 'hyperclova x', 'hyperclovax'],
	},
	{ keyword: '네이버 큐', category: 'SEO', tag: 'SEO', aliases: ['naver cue'] },
	{ keyword: '뤼튼', category: 'AI Search', tag: 'AI', aliases: ['wrtn'] },
	{ keyword: '국내 AI', category: 'AI Search', tag: 'AI', aliases: ['korea ai', 'korean ai'] },
	{
		keyword: 'GEO 최적화',
		category: 'GEO',
		tag: 'GEO',
		aliases: ['generative engine optimization', 'geo optimization', 'llms.txt', 'llmstxt'],
		enQuery: '"GEO optimization" OR "generative engine optimization"',
	},
	{
		keyword: 'AEO',
		category: 'AEO',
		tag: 'AEO',
		aliases: ['answer engine optimization', 'answer engine', '답변 엔진'],
		enQuery: 'AEO OR "answer engine optimization"',
	},
	{
		keyword: 'AI SEO',
		category: 'SEO',
		tag: 'SEO',
		extraCategories: ['AI Search'],
		enQuery: '"AI SEO"',
	},
	{
		keyword: '검색엔진 최적화',
		category: 'SEO',
		tag: 'SEO',
		aliases: ['search engine optimization', 'seo'],
		enQuery: 'SEO OR "search engine optimization"',
	},
	{
		keyword: '스키마 마크업',
		category: 'Schema/Entity',
		tag: 'Schema',
		aliases: ['schema markup', 'json-ld', 'jsonld', 'structured data', '구조화 데이터', '지식 그래프', 'knowledge graph'],
		enQuery: '"schema markup" OR JSON-LD OR "structured data"',
	},
	{
		keyword: '구글 검색 알고리즘',
		category: 'SEO',
		tag: 'SEO',
		aliases: ['google search algorithm', 'google core update', '검색 알고리즘'],
		enQuery: 'Google search algorithm OR Google core update',
	},
];

const CATEGORY_ORDER: InsightsNewsCategory[] = ['GEO', 'AEO', 'AI Search', 'Schema/Entity', 'SEO'];

export function normalizeInsightsHaystack(value: string): string {
	return value
		.toLowerCase()
		.replace(/json-ld/gi, 'jsonld')
		.replace(/llms\.txt/gi, 'llmstxt')
		.replace(/hyperclova[\s-]*x/gi, 'hyperclova')
		.replace(/e-e-a-t/gi, 'eeat')
		.replace(/[-_.]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTerm(haystack: string, term: string): boolean {
	const needle = normalizeInsightsHaystack(term);
	if (!needle) return false;
	if (needle.includes(' ') || /[가-힣]/.test(needle)) return haystack.includes(needle);
	const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:[^a-z0-9]|$)`, 'i');
	return pattern.test(haystack);
}

/** 제목에만 적용. 네이버/구글 요약 HTML에 포털 섹션명(연예·스포츠)이 섞여 국내 기사가 통째로 탈락하는 것을 막는다. */
const TITLE_ONLY_EXCLUDE = ['연예', '스포츠'] as const;

export function hitsExcludeKeyword(title: string, snippet = '', extra = ''): boolean {
	const extraAliases = ['seo in-young', 'seo in young', 'geoweek'];
	const titleHay = normalizeInsightsHaystack(title);
	const bodyHay = normalizeInsightsHaystack(`${snippet} ${extra}`);
	if (TITLE_ONLY_EXCLUDE.some((term) => hasTerm(titleHay, term))) return true;

	const hardTerms = EXCLUDE_KEYWORDS.filter(
		(term) => !(TITLE_ONLY_EXCLUDE as readonly string[]).includes(term),
	);
	const haystack = `${titleHay} ${bodyHay}`.trim();
	if (!haystack) return false;
	return [...hardTerms, ...extraAliases].some(
		(term) => hasTerm(haystack, term) || haystack.includes(normalizeInsightsHaystack(term)),
	);
}

export function categoriesForPoolKeyword(keyword: string): {
	categories: InsightsNewsCategory[];
	tags: string[];
} {
	const rule = POOL_RULES.find((item) => item.keyword === keyword);
	if (!rule) return { categories: ['AI Search'], tags: ['AI'] };
	const categories = new Set<InsightsNewsCategory>([rule.category, ...(rule.extraCategories ?? [])]);
	return {
		categories: CATEGORY_ORDER.filter((category) => categories.has(category)),
		tags: [rule.tag],
	};
}

/**
 * 네이버/구글에서 특정 키워드로 이미 찾아 온 기사.
 * 제목 표기가 풀 키워드와 달라도 OR 합집합으로 유지하고, NOT 제외만 적용한다.
 */
export function evaluateInsightsSearchHit(
	title: string,
	snippet: string,
	searchKeyword: string,
	extra = '',
): InsightsKeywordHit {
	if (hitsExcludeKeyword(title, snippet, extra)) {
		return { accepted: false, categories: [], tags: [], matchedTerms: [] };
	}
	const targeting = evaluateInsightsKeywords(title, snippet, extra);
	if (targeting.accepted) return targeting;
	const mapped = categoriesForPoolKeyword(searchKeyword);
	return {
		accepted: true,
		categories: mapped.categories,
		tags: mapped.tags,
		matchedTerms: [searchKeyword],
	};
}

export type InsightsKeywordHit = {
	accepted: boolean;
	categories: InsightsNewsCategory[];
	tags: string[];
	matchedTerms: string[];
};

/**
 * OR 매칭: 풀 키워드(또는 alias) 중 하나라도 있으면 수집.
 * NOT 필터: 제외 키워드가 하나라도 있으면 폐기.
 * 두 개 이상 키워드를 동시에 요구하지 않는다.
 */
export function evaluateInsightsKeywords(title: string, snippet = '', extra = ''): InsightsKeywordHit {
	const haystack = normalizeInsightsHaystack(`${title} ${snippet} ${extra}`);
	if (!haystack) {
		return { accepted: false, categories: [], tags: [], matchedTerms: [] };
	}

	if (hitsExcludeKeyword(title, snippet, extra)) {
		return { accepted: false, categories: [], tags: [], matchedTerms: [] };
	}

	const categories = new Set<InsightsNewsCategory>();
	const tags: string[] = [];
	const matchedTerms: string[] = [];

	for (const rule of POOL_RULES) {
		const terms = [rule.keyword, ...(rule.aliases ?? [])];
		if (!terms.some((term) => hasTerm(haystack, term))) continue;
		categories.add(rule.category);
		for (const extraCategory of rule.extraCategories ?? []) categories.add(extraCategory);
		matchedTerms.push(rule.keyword);
		tags.push(rule.tag);
	}

	if (categories.size === 0) {
		return { accepted: false, categories: [], tags: [], matchedTerms: [] };
	}

	return {
		accepted: true,
		categories: CATEGORY_ORDER.filter((category) => categories.has(category)),
		tags: [...new Set(tags)].slice(0, 4),
		matchedTerms: [...new Set(matchedTerms)],
	};
}

/** 키워드별 네이버 검색어 — 한 쿼리에 키워드 하나만 넣어 OR 합집합을 만든다. */
export function naverQueryForKeyword(keyword: string): string {
	return keyword.trim();
}

export function googleNewsKrQuery(keyword: string): string {
	return keyword.trim();
}

/** 국내 구글 뉴스 — 키워드별 16회 대신 OR 묶음 몇 개만 호출해 타임아웃을 피한다. */
export function listKoreanGoogleNewsQueries(): string[] {
	return [
		'ChatGPT OR 퍼플렉시티 OR "생성형 AI" OR "AI 검색" OR "Gemini AI"',
		'"네이버 클로바" OR 하이퍼클로바X OR 뤼튼 OR "네이버 큐" OR "국내 AI"',
		'"GEO 최적화" OR AEO OR "AI SEO" OR "검색엔진 최적화" OR "스키마 마크업" OR "구글 검색 알고리즘"',
	];
}

export function listEnglishGoogleNewsQueries(): string[] {
	return [...new Set(POOL_RULES.map((rule) => rule.enQuery).filter((query): query is string => Boolean(query)))];
}
