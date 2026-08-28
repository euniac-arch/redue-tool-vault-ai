import type { InsightArticleCategory, InsightCategoryType } from './insights-news-types';

/**
 * 카테고리 매칭 키워드 룰셋.
 * 우선순위: AEO·GEO / AI 검색 → Schema & 엔티티 → 포털 SEO → 생성형 AI & LLM.
 * 한국어 표기와 글로벌 RSS 영문 대응어를 함께 둔다.
 */
export const CATEGORY_RULES: Record<Exclude<InsightCategoryType, 'all'>, string[]> = {
	aeo_geo_search: [
		'AEO',
		'GEO',
		'AI 검색',
		'AI검색',
		'퍼플렉시티',
		'Perplexity',
		'ChatGPT Search',
		'챗GPT 검색',
		'AI Overview',
		'AI Overviews',
		'AI 오버뷰',
		'답변 엔진',
		'인용',
		'Cue:',
		'네이버 큐',
		'대화형 검색',
		'generative engine optimization',
		'answer engine optimization',
		'AI search',
		'conversational search',
		'Naver Cue',
		'SearchGPT',
	],
	schema_entity: [
		'Schema',
		'스키마',
		'JSON-LD',
		'구조화 데이터',
		'엔티티',
		'지식그래프',
		'Knowledge Graph',
		'llms.txt',
		'FAQPage',
		'Speakable',
		'시맨틱',
		'시맨틱 마크업',
		'structured data',
		'schema.org',
		'schema markup',
		'semantic markup',
		'entity',
	],
	portal_seo: [
		'SEO',
		'검색엔진 최적화',
		'검색엔진최적화',
		'서치어드바이저',
		'웹마스터',
		'구글 알고리즘',
		'코어 업데이트',
		'Core Web Vitals',
		'웹 성능',
		'포털 검색',
		'백링크',
		'크롤링',
		'search engine optimization',
		'Search Console',
		'core update',
		'Google algorithm',
		'webmaster',
		'backlink',
		'crawling',
		'web performance',
	],
	gen_ai_llm: [
		'생성형 AI',
		'생성형AI',
		'LLM',
		'하이퍼클로바',
		'HyperCLOVA',
		'클로바X',
		'뤼튼',
		'Wrtn',
		'업스테이지',
		'Claude',
		'클로드',
		'Gemini',
		'제미나이',
		'OpenAI',
		'GPT',
		'ChatGPT',
		'AI 에이전트',
		'AI 모델',
		'토종 AI',
		'generative AI',
		'AI agent',
		'AI model',
	],
};

const CLASSIFY_ORDER: InsightArticleCategory[] = [
	'aeo_geo_search',
	'schema_entity',
	'portal_seo',
	'gen_ai_llm',
];

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordMatches(content: string, keyword: string): boolean {
	const needle = keyword.toLowerCase();
	if (!needle) return false;

	if (/[가-힣]/.test(keyword) || /[^a-z0-9]/i.test(keyword)) {
		return content.includes(needle);
	}

	if (needle === 'gpt') {
		return content.includes('gpt');
	}

	const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:[^a-z0-9]|$)`, 'i');
	return pattern.test(content);
}

/** 기사 제목·요약 텍스트로 5대 카테고리 중 하나를 부여한다. */
export function classifyArticle(title: string, description: string): InsightCategoryType {
	const content = `${title} ${description}`.toLowerCase();

	for (const category of CLASSIFY_ORDER) {
		if (CATEGORY_RULES[category].some((kw) => keywordMatches(content, kw))) {
			return category;
		}
	}

	return 'gen_ai_llm';
}

export function classifyArticleCategory(title: string, description: string): InsightArticleCategory {
	const classified = classifyArticle(title, description);
	return classified === 'all' ? 'gen_ai_llm' : classified;
}
