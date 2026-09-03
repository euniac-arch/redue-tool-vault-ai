/**
 * Insights news keyword tagging + 5h cache TTL helpers.
 * Run: npx tsx scripts/test-insights-news-cache.ts
 */
import { inferInsightsRegion, insightsArticleDocId } from '../lib/insights/insights-news-collect';
import { evaluateInsightsKeywords, evaluateInsightsSearchHit } from '../lib/insights/insights-news-keywords';
import { classifyArticle } from '../lib/insights/insights-news-classify';
import {
	INSIGHTS_NEWS_TTL_MS,
	filterInsightsNews,
	isInsightsNewsCacheFresh,
	parseInsightsNewsTab,
	type InsightsNewsItem,
} from '../lib/insights/insights-news-types';
import { toggleSavedNewsId } from '../lib/insights/saved-news';
import { expandTruncatedNewsTitle, looksTruncatedNewsTitle } from '../lib/insights/insights-news-title';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
}

const geoHit = evaluateInsightsKeywords(
	'How brands win citations with GEO and llms.txt',
	'Generative engine optimization plus JSON-LD entity markup.',
);
assert('GEO + Schema tags', geoHit.accepted && geoHit.categories.includes('GEO') && geoHit.categories.includes('Schema/Entity'), geoHit);
assert('llms.txt maps to GEO pool', geoHit.matchedTerms.includes('GEO 최적화'), geoHit.matchedTerms);

const aeoHit = evaluateInsightsKeywords('Answer engine optimization (AEO) for AI Overviews', 'ChatGPT Search citations');
assert('AEO + AI Search', aeoHit.accepted && aeoHit.categories.includes('AEO') && aeoHit.categories.includes('AI Search'), aeoHit);

const seoHit = evaluateInsightsKeywords('Google SEO core update notes', 'Search engine optimization ranking changes');
assert('SEO category', seoHit.accepted && seoHit.categories.includes('SEO'), seoHit);

const perplexityHit = evaluateInsightsKeywords('Perplexity citation patterns', 'AI search sources');
assert('Perplexity → AI Search', perplexityHit.accepted && perplexityHit.categories.includes('AI Search'), perplexityHit);

const knowledgeHit = evaluateInsightsKeywords('Knowledge Graph entity disambiguation', 'Schema.org JSON-LD');
assert('Schema/Entity from Knowledge Graph', knowledgeHit.accepted && knowledgeHit.categories.includes('Schema/Entity'), knowledgeHit);

const bareAi = evaluateInsightsKeywords('The future of AI', 'Robotics and chips');
assert('bare AI without search context is dropped', !bareAi.accepted, bareAi);

const celebritySeo = evaluateInsightsKeywords('Seo In-young Sells Luxury Bags', 'financial struggles');
assert('celebrity Seo name dropped', !celebritySeo.accepted, celebritySeo);

const geospatial = evaluateInsightsKeywords('Geo Week 2027 scholarship', 'geospatial mapping conference');
assert('geospatial Geo Week dropped', !geospatial.accepted, geospatial);

const aiTrend = evaluateInsightsKeywords('국내 AI 동향 리포트', '생성형 모델 경쟁이 가열되고 있습니다.');
assert('AI 동향 kept', aiTrend.accepted && aiTrend.categories.includes('AI Search'), aiTrend);

const aiSearchKo = evaluateInsightsKeywords('네이버 AI 검색이 바뀌는 이유', '포털 검색 결과와 생성형 답변');
assert('AI 검색 kept', aiSearchKo.accepted && aiSearchKo.categories.includes('AI Search'), aiSearchKo);

const chatgptOnly = evaluateInsightsKeywords('OpenAI, ChatGPT 주간 업데이트 발표', '새 모델 출시 소식만 담았습니다.');
assert('OR: ChatGPT alone is enough', chatgptOnly.accepted && chatgptOnly.matchedTerms.includes('ChatGPT'), chatgptOnly);

const clovaHit = evaluateInsightsKeywords('네이버 클로바, 기업용 AI 검색 강화', '');
assert('네이버 클로바 kept', clovaHit.accepted && clovaHit.matchedTerms.includes('네이버 클로바'), clovaHit);

const hyperHit = evaluateInsightsKeywords('하이퍼클로바X 새 버전 공개', '네이버 초거대 언어모델');
assert('하이퍼클로바X kept', hyperHit.accepted && hyperHit.matchedTerms.includes('하이퍼클로바X'), hyperHit);

const wrtnHit = evaluateInsightsKeywords('뤼튼, 생성형 글쓰기 도구 개편', '');
assert('뤼튼 kept', wrtnHit.accepted && wrtnHit.matchedTerms.includes('뤼튼'), wrtnHit);

const aeoOnly = evaluateInsightsKeywords('AEO가 바꾸는 검색 결과', '');
assert('OR: AEO alone is enough', aeoOnly.accepted && aeoOnly.categories.includes('AEO'), aeoOnly);

const entertain = evaluateInsightsKeywords('ChatGPT로 본 연예 가십', '아이돌 소식');
assert('exclude 연예', !entertain.accepted, entertain);

const sports = evaluateInsightsKeywords('프로야구 스포츠 중계', 'ChatGPT 해설');
assert('exclude 스포츠', !sports.accepted, sports);

const sportsInSnippet = evaluateInsightsKeywords(
	'네이버 클로바 기업용 기능 확대',
	'관련 섹션: 연예 스포츠 뉴스 더보기',
);
assert('snippet 연예/스포츠 does not drop KR AI', sportsInSnippet.accepted, sportsInSnippet);

assert(
	'hangul title is KR even on global host',
	inferInsightsRegion('https://medium.com/post', 'GLOBAL', '뤼튼이 공개한 생성형 AI 기능') === 'KR',
);

const schemaKo = evaluateInsightsKeywords('병원 사이트 스키마 마크업 도입 확산', 'JSON-LD 구조화 데이터');
assert('스키마 마크업 kept', schemaKo.accepted && schemaKo.categories.includes('Schema/Entity'), schemaKo);

const searchHit = evaluateInsightsSearchHit('초거대 언어모델 새 버전 나왔다', '네이버가 모델을 공개했다', '하이퍼클로바X');
assert('search hit kept without exact keyword in title', searchHit.accepted && searchHit.matchedTerms.includes('하이퍼클로바X'), searchHit);

const hashA = insightsArticleDocId('https://searchengineland.com/geo-guide?utm_source=rss', 'https://searchengineland.com/geo-guide');
const hashB = insightsArticleDocId('https://searchengineland.com/geo-guide', '');
assert('link hash ignores utm and matches guid permalink', hashA === hashB, { hashA, hashB });
assert('hash is sha256 hex', /^[a-f0-9]{64}$/.test(hashA), hashA);
assert('naver host is KR', inferInsightsRegion('https://n.news.naver.com/article/001/0001', 'GLOBAL') === 'KR');
assert('sel host stays GLOBAL', inferInsightsRegion('https://searchengineland.com/geo', 'GLOBAL') === 'GLOBAL');

const now = Date.parse('2026-08-26T12:00:00.000Z');
assert('fresh under 5h', isInsightsNewsCacheFresh(now - 4 * 60 * 60 * 1000, now));
assert('stale at 5h', !isInsightsNewsCacheFresh(now - INSIGHTS_NEWS_TTL_MS, now));
assert('stale over 5h', !isInsightsNewsCacheFresh(now - INSIGHTS_NEWS_TTL_MS - 1, now));
assert('empty cache is stale', !isInsightsNewsCacheFresh(null, now));

function item(partial: Partial<InsightsNewsItem> & Pick<InsightsNewsItem, 'id'>): InsightsNewsItem {
	return {
		title: partial.id,
		summary: '',
		sourceName: 'SEL',
		sourceUrl: `https://example.com/${partial.id}`,
		guid: null,
		region: 'GLOBAL',
		publishedAt: '1시간 전',
		publishedAtIso: '2026-08-26T00:00:00.000Z',
		category: 'gen_ai_llm',
		categories: [],
		tags: [],
		...partial,
	};
}

const feed = [
	item({
		id: 'geo',
		title: 'GEO citations in Perplexity AI search',
		category: 'aeo_geo_search',
		categories: ['GEO', 'AEO'],
	}),
	item({
		id: 'llm',
		title: 'OpenAI GPT 모델 업데이트',
		category: 'gen_ai_llm',
		categories: ['AI Search'],
	}),
	item({
		id: 'schema',
		title: 'JSON-LD schema markup',
		category: 'schema_entity',
		categories: ['Schema/Entity'],
	}),
	item({
		id: 'seo',
		title: 'Google core update SEO notes',
		category: 'portal_seo',
		categories: ['SEO'],
	}),
	item({
		id: 'kr-ai',
		title: '하이퍼클로바X 새 버전',
		category: 'gen_ai_llm',
		categories: ['AI Search'],
		region: 'KR',
		sourceName: '아이뉴스',
	}),
];

assert('tab all keeps 5', filterInsightsNews(feed, 'all').length === 5);
assert(
	'tab aeo_geo_search',
	filterInsightsNews(feed, 'aeo_geo_search').map((row) => row.id).join(',') === 'geo',
);
assert(
	'tab gen_ai_llm',
	filterInsightsNews(feed, 'gen_ai_llm').map((row) => row.id).join(',') === 'llm,kr-ai',
);
assert(
	'tab schema_entity',
	filterInsightsNews(feed, 'schema_entity').map((row) => row.id).join(',') === 'schema',
);
assert(
	'tab portal_seo',
	filterInsightsNews(feed, 'portal_seo').map((row) => row.id).join(',') === 'seo',
);
assert(
	'legacy geo-aeo maps to aeo_geo_search',
	parseInsightsNewsTab('geo-aeo') === 'aeo_geo_search' &&
		filterInsightsNews(feed, 'geo-aeo').map((row) => row.id).join(',') === 'geo',
);
assert('region KR', filterInsightsNews(feed, 'all', 'KR').map((row) => row.id).join(',') === 'kr-ai');
assert('region GLOBAL', filterInsightsNews(feed, 'all', 'GLOBAL').length === 4);
assert(
	'topic JSON-LD',
	filterInsightsNews(feed, 'all', 'all', 'JSON-LD').map((row) => row.id).join(',') === 'schema',
);
assert(
	'topic 하이퍼클로바X',
	filterInsightsNews(feed, 'all', 'all', '하이퍼클로바X').map((row) => row.id).join(',') === 'kr-ai',
);
assert(
	'topic GEO 최적화',
	filterInsightsNews(feed, 'all', 'all', 'GEO 최적화').map((row) => row.id).join(',') === 'geo',
);
assert(
	'multi filter region+topic',
	filterInsightsNews(feed, 'all', 'KR', '하이퍼클로바X').map((row) => row.id).join(',') === 'kr-ai',
);
assert(
	'short tab alias aeo_geo',
	parseInsightsNewsTab('aeo_geo') === 'aeo_geo_search',
);

assert(
	'classify AEO/GEO/AI search first',
	classifyArticle('퍼플렉시티 AI 검색 인용', 'ChatGPT Search와 GEO') === 'aeo_geo_search',
);
assert(
	'classify schema/entity',
	classifyArticle('병원 사이트 JSON-LD 스키마', '구조화 데이터와 지식그래프') === 'schema_entity',
);
assert(
	'classify portal SEO',
	classifyArticle('구글 코어 업데이트', '검색엔진 최적화와 백링크') === 'portal_seo',
);
assert(
	'classify gen AI / LLM',
	classifyArticle('하이퍼클로바X와 뤼튼', '생성형 AI 모델 경쟁') === 'gen_ai_llm',
);
assert(
	'classify fallback is gen_ai_llm',
	classifyArticle('업계 동향 브리핑', '관련 소식이 없습니다') === 'gen_ai_llm',
);
assert(
	'classify ChatGPT model news is gen_ai_llm',
	classifyArticle('OpenAI, ChatGPT 주간 업데이트 발표', '새 모델 출시') === 'gen_ai_llm',
);
assert(
	'classify Naver Cue is aeo_geo_search',
	classifyArticle('네이버 큐 대화형 검색 확대', 'Cue: 답변 엔진') === 'aeo_geo_search',
);

assert(
	'expand truncated title from snippet',
	expandTruncatedNewsTitle(
		'삼성30주년 기념주화 110만개 중 25만개, 1370원 차익...',
		'삼성30주년 기념주화 110만개 중 25만개, 1370원 차익 발생으로 논란이 커지고 있다.',
	) === '삼성30주년 기념주화 110만개 중 25만개, 1370원 차익 발생으로 논란이 커지고 있다.',
);
assert(
	'keep complete title',
	expandTruncatedNewsTitle('AI 검색, 브랜드가 인용되는 법', '본문 요약') === 'AI 검색, 브랜드가 인용되는 법',
);
assert(
	'strip ellipsis when snippet has no continuation',
	expandTruncatedNewsTitle('짧은 제목만 잘림...', '전혀 다른 요약입니다.') === '짧은 제목만 잘림',
);
assert(
	'detect mid-word Korean cut without ellipsis',
	looksTruncatedNewsTitle('"생명·평화·민주주의 가치, 숫자로 읽는다"… LPDI 개발 첫 공론장 열'),
);
assert(
	'complete mid-title ellipsis from snippet',
	expandTruncatedNewsTitle(
		'"생명·평화·민주주의 가치, 숫자로 읽는다"… LPDI 개발 첫 공론장 열',
		'"생명·평화·민주주의 가치, 숫자로 읽는다"… LPDI 개발 첫 공론장 열려. 본문이 이어집니다.',
	) === '"생명·평화·민주주의 가치, 숫자로 읽는다"… LPDI 개발 첫 공론장 열려',
);
assert(
	'complete cut title from publisher og:title',
	expandTruncatedNewsTitle(
		'"생명·평화·민주주의 가치, 숫자로 읽는다"… LPDI 개발 첫 공론장 열',
		'이로운넷 = 편집위원 김성환국내총생산(GDP)이 한 사회의 경제적 규모만 보여준다.',
		'“생명·평화·민주주의 가치, 숫자로 읽는다”… LPDI 개발 첫 공론장 열려 | 이로운넷',
	) === '“생명·평화·민주주의 가치, 숫자로 읽는다”… LPDI 개발 첫 공론장 열려',
);
assert(
	'keep complete Korean title ending with 열려',
	!looksTruncatedNewsTitle('“생명·평화·민주주의 가치, 숫자로 읽는다”… LPDI 개발 첫 공론장 열려'),
);
assert(
	'restore baseball title cut at 페덱·K',
	expandTruncatedNewsTitle(
		"[AI프리뷰] 29일 대구 삼성-KT전, 선두 자리 가를 '에이스' 삼성 페덱·K",
		'선발 맞대결',
		"[AI프리뷰] 29일 대구 삼성-KT전, 선두 자리 가를 '에이스' 삼성 페덱·KT 로건 맞대결 | 스포츠서울",
	) === "[AI프리뷰] 29일 대구 삼성-KT전, 선두 자리 가를 '에이스' 삼성 페덱·KT 로건 맞대결",
);

assert('saved news toggle add', toggleSavedNewsId('news-1', []).includes('news-1'));
assert('saved news toggle remove', toggleSavedNewsId('news-1', ['news-1']).length === 0);

if (failed > 0) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');
