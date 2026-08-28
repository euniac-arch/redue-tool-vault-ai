/**
 * Public "AI & GEO Insights" news feed — types and filter helpers.
 * Display tabs use the 5 insight categories; collection still tags GEO/AEO/SEO hits.
 */

import { classifyArticleCategory } from './insights-news-classify';

export { CATEGORY_RULES, classifyArticle, classifyArticleCategory } from './insights-news-classify';

export const INSIGHTS_NEWS_TTL_MS = 5 * 60 * 60 * 1000;

export const INSIGHT_CATEGORIES = [
	{ id: 'all', label: '전체' },
	{ id: 'aeo_geo_search', label: 'AEO·GEO' },
	{ id: 'gen_ai_llm', label: '생성형AI' },
	{ id: 'schema_entity', label: '스키마마크업' },
	{ id: 'portal_seo', label: '포털SEO' },
] as const;

export type InsightCategoryType = (typeof INSIGHT_CATEGORIES)[number]['id'];
export type InsightArticleCategory = Exclude<InsightCategoryType, 'all'>;

/** Keyword-pool tags written at collection time (legacy multi-label). */
export const INSIGHTS_NEWS_CATEGORIES = ['GEO', 'AEO', 'SEO', 'Schema/Entity', 'AI Search'] as const;

export type InsightsNewsCategory = (typeof INSIGHTS_NEWS_CATEGORIES)[number];
export type InsightsNewsRegion = 'KR' | 'GLOBAL';
export type InsightsNewsTab = InsightCategoryType;

export type InsightsNewsItem = {
	id: string;
	title: string;
	summary: string;
	sourceName: string;
	sourceUrl: string;
	guid: string | null;
	region: InsightsNewsRegion;
	/** Relative Korean time for display, e.g. '3시간 전'. */
	publishedAt: string;
	/** ISO timestamp kept for sorting / cache. */
	publishedAtIso: string;
	/** Primary tab category from title/summary classifier. */
	category: InsightArticleCategory;
	categories: InsightsNewsCategory[];
	tags: string[];
};

export type InsightsNewsFeedResult = {
	items: InsightsNewsItem[];
	total: number;
	lastFetchedAt: string | null;
	cached: boolean;
	source: 'cache' | 'live' | 'stale';
};

export const INSIGHTS_NEWS_REGION_TABS: { value: 'all' | InsightsNewsRegion; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'KR', label: '🇰🇷 국내 뉴스 (KR)' },
	{ value: 'GLOBAL', label: '🌐 해외 글로벌 (Global)' },
];

export const INSIGHTS_PAGE_SIZE_OPTIONS = [6, 12, 24] as const;
export type InsightsPageSize = (typeof INSIGHTS_PAGE_SIZE_OPTIONS)[number];

export const INSIGHTS_LIVE_TOPICS = [
	'GEO 최적화',
	'AEO 엔진',
	'JSON-LD',
	'SearchGPT',
	'Perplexity 인용',
	'llms.txt',
	'AI 오버뷰',
	'스키마 마크업',
	'구조화 데이터',
	'E-E-A-T 신뢰도',
	'지식 그래프',
	'엔티티 맵',
	'RAG 벡터검색',
	'네이버 Cue:',
	'하이퍼클로바X',
	'Gemini Search',
	'Core Web Vitals',
	'크롤러 정책',
	'FAQPage 스키마',
	'MedicalClinic',
	'로컬 SEO',
	'클로드 아티팩트',
	'브랜드 권위도',
] as const;

export type InsightsLiveTopic = (typeof INSIGHTS_LIVE_TOPICS)[number];

const LIVE_TOPIC_ALIASES: Record<string, string[]> = {
	'GEO 최적화': ['geo 최적화', 'geo', 'generative engine optimization', 'generative engine'],
	'AEO 엔진': ['aeo', 'answer engine', 'answer engine optimization', '답변 엔진'],
	'JSON-LD': ['json-ld', 'jsonld', 'json ld'],
	SearchGPT: ['searchgpt', 'chatgpt search', '챗gpt 검색'],
	'Perplexity 인용': ['perplexity', '퍼플렉시티', 'perplexity citation'],
	'llms.txt': ['llms.txt', 'llmstxt', 'llms txt'],
	'AI 오버뷰': ['ai overview', 'ai overviews', 'ai 오버뷰', 'aio'],
	'스키마 마크업': ['schema markup', 'schema', '스키마'],
	'구조화 데이터': ['structured data', '구조화데이터'],
	'E-E-A-T 신뢰도': ['e-e-a-t', 'eeat', 'e-e-a-t 신뢰도', '경험 전문성'],
	'지식 그래프': ['knowledge graph', '지식그래프'],
	'엔티티 맵': ['entity map', 'entity', '엔티티'],
	'RAG 벡터검색': ['rag', 'vector search', '벡터검색', '벡터 검색'],
	'네이버 Cue:': ['네이버 큐', '네이버 ai 검색', 'naver cue', 'naver ai', 'cue:'],
	하이퍼클로바X: ['하이퍼클로바', 'hyperclova', '클로바x'],
	'Gemini Search': ['gemini search', 'gemini', '제미나이'],
	'Core Web Vitals': ['core web vitals', 'corewebvitals', '웹 바이탈', 'lcp', 'cwv'],
	'크롤러 정책': ['crawler', 'robots.txt', '크롤러', 'crawl policy'],
	'FAQPage 스키마': ['faqpage', 'faq schema', 'faq 스키마'],
	MedicalClinic: ['medicalclinic', 'medical clinic', '병원 스키마'],
	'로컬 SEO': ['local seo', '로컬seo', 'google business profile'],
	'클로드 아티팩트': ['claude artifact', 'claude', '클로드', 'anthropic'],
	'브랜드 권위도': ['brand authority', '브랜드 권위', 'authority'],
};

export const INSIGHTS_NEWS_TABS: { value: InsightsNewsTab; label: string }[] = INSIGHT_CATEGORIES.map((tab) => ({
	value: tab.id,
	label: tab.label,
}));

export const INSIGHT_CATEGORY_LABEL: Record<InsightArticleCategory, string> = {
	aeo_geo_search: 'AEO·GEO',
	gen_ai_llm: '생성형AI',
	schema_entity: '스키마마크업',
	portal_seo: '포털SEO',
};

export const INSIGHTS_CATEGORY_LABEL: Record<InsightsNewsCategory, string> = {
	GEO: 'GEO',
	AEO: 'AEO',
	SEO: 'SEO',
	'Schema/Entity': 'Schema',
	'AI Search': 'AI Search',
};

const LEGACY_TAB_MAP: Record<string, InsightCategoryType> = {
	'geo-aeo': 'aeo_geo_search',
	'ai-search': 'aeo_geo_search',
	'schema-entity': 'schema_entity',
	'portal-seo': 'portal_seo',
	'gen-ai-llm': 'gen_ai_llm',
	aeo_geo: 'aeo_geo_search',
	gen_ai: 'gen_ai_llm',
	schema: 'schema_entity',
	seo: 'portal_seo',
};

export function isInsightsNewsCategory(value: string): value is InsightsNewsCategory {
	return (INSIGHTS_NEWS_CATEGORIES as readonly string[]).includes(value);
}

export function isInsightArticleCategory(value: string): value is InsightArticleCategory {
	return value === 'aeo_geo_search' || value === 'gen_ai_llm' || value === 'schema_entity' || value === 'portal_seo';
}

export function isInsightsNewsRegion(value: string): value is InsightsNewsRegion {
	return value === 'KR' || value === 'GLOBAL';
}

export function parseInsightsNewsRegion(value: string | null | undefined): 'all' | InsightsNewsRegion {
	if (!value) return 'all';
	if (value === 'all' || value === 'KR' || value === 'GLOBAL') return value;
	const normalized = value.toLowerCase();
	if (normalized === 'kr') return 'KR';
	if (normalized === 'global') return 'GLOBAL';
	return 'all';
}

export function isInsightsNewsTab(value: string): value is InsightsNewsTab {
	return INSIGHT_CATEGORIES.some((tab) => tab.id === value);
}

export function parseInsightsNewsTab(value: string | null | undefined): InsightsNewsTab {
	if (!value) return 'all';
	if (INSIGHT_CATEGORIES.some((tab) => tab.id === value)) return value as InsightsNewsTab;
	return LEGACY_TAB_MAP[value] ?? 'all';
}

export function insightCategoryLabel(id: InsightCategoryType): string {
	return INSIGHT_CATEGORIES.find((tab) => tab.id === id)?.label ?? id;
}

export function resolveArticleCategory(
	item: Pick<InsightsNewsItem, 'title' | 'summary'> & { category?: string | null },
): InsightArticleCategory {
	return classifyArticleCategory(item.title, item.summary);
}

export function matchesInsightsTab(item: InsightsNewsItem, tab: InsightsNewsTab | string): boolean {
	const normalized = parseInsightsNewsTab(tab);
	if (normalized === 'all') return true;
	return resolveArticleCategory(item) === normalized;
}

export function matchesInsightsRegion(item: InsightsNewsItem, region: 'all' | InsightsNewsRegion): boolean {
	if (region === 'all') return true;
	return item.region === parseInsightsNewsRegion(region);
}

function compactTopicToken(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9가-힣]+/gi, '');
}

function topicHaystack(item: InsightsNewsItem): string {
	return [item.title, item.summary, item.sourceName, ...item.tags].join(' ').toLowerCase();
}

export function matchesInsightsTopic(item: InsightsNewsItem, topic: string | null | undefined): boolean {
	if (!topic) return true;
	const haystack = topicHaystack(item);
	const compactHay = compactTopicToken(haystack);
	const needles = [topic, ...(LIVE_TOPIC_ALIASES[topic] ?? [])];

	return needles.some((needle) => {
		const lower = needle.toLowerCase();
		if (haystack.includes(lower)) return true;
		const compact = compactTopicToken(needle);
		if (compact.length >= 3 && compactHay.includes(compact)) return true;
		if (compact === 'geo') return /(?:^|[^a-z0-9])geo(?:[^a-z0-9]|$)/i.test(haystack);
		return false;
	});
}

function keywordHaystack(item: InsightsNewsItem): string {
	return [item.title, item.summary, ...item.tags].join(' ').toLowerCase();
}

/** Matches the search box against title, summary, and tags — same fields the RSS feed exposes. */
export function matchesInsightsKeyword(item: InsightsNewsItem, keyword: string | null | undefined): boolean {
	const trimmed = keyword?.trim().toLowerCase();
	if (!trimmed) return true;
	return keywordHaystack(item).includes(trimmed);
}

export function filterInsightsNews(
	items: InsightsNewsItem[],
	tab: InsightsNewsTab | string,
	region: 'all' | InsightsNewsRegion = 'all',
	topic: string | null = null,
	keyword: string | null = null,
): InsightsNewsItem[] {
	return items.filter(
		(item) =>
			matchesInsightsTab(item, tab) &&
			matchesInsightsRegion(item, region) &&
			matchesInsightsTopic(item, topic) &&
			matchesInsightsKeyword(item, keyword),
	);
}

export function isInsightsNewsCacheFresh(lastFetchedAtMs: number | null, now = Date.now()): boolean {
	if (lastFetchedAtMs == null || !Number.isFinite(lastFetchedAtMs) || lastFetchedAtMs <= 0) return false;
	return now - lastFetchedAtMs < INSIGHTS_NEWS_TTL_MS;
}
