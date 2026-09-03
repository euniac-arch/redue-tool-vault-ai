/**
 * Run: npx tsx scripts/test-insights-ai-research.ts
 */
import {
	buildHeuristicResearchResult,
	canUseInsightsAiResearch,
	isInsightsProMember,
	normalizeAiResearchResult,
	researchArticleToNewsItem,
	resolveAiResearchArticleId,
} from '../lib/insights/insights-ai-research';
import {
	formatResearchAnalyzedAgo,
	formatResearchAnalyzedAt,
	isResearchCacheFresh,
} from '../lib/insights/insights-ai-research-cache';
import { prependRecentSearch } from '../lib/insights/insights-ai-recent-searches';
import {
	lastResearchToResult,
	parseLastAiResearch,
	snapshotFromResearchResult,
} from '../lib/insights/insights-last-research';
import { isItemScrapped, parseScrappedNewsItem, toScrappedNewsItem } from '../lib/insights/scrapped-news';
import { AI_SEARCH_DAILY_LIMIT, defaultInsightsAiUsage, resolveAiSearchUsed } from '../lib/insights/insights-ai-usage';
import { insightsPublicError } from '../lib/insights/insights-api-errors';
import {
	INSIGHTS_BOOKMARK_STORAGE_KEYS,
	INSIGHTS_LOCAL_RESET_FLAG_KEY,
	INSIGHTS_LOCAL_RESET_VERSION,
	INSIGHTS_USAGE_STORAGE_KEYS,
	applyInsightsLocalResetOnce,
	resetInsightsLocalData,
	shouldApplyInsightsLocalReset,
} from '../lib/insights/insights-local-reset';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
}

assert('guest can start AI research', canUseInsightsAiResearch({ isLoggedIn: false, isProMember: false }));
assert('logged-in member can use AI research', canUseInsightsAiResearch({ isLoggedIn: true, isProMember: false }));
assert('pro member can use AI research', canUseInsightsAiResearch({ isLoggedIn: true, isProMember: true }));
assert('daily free AI research quota is 5', AI_SEARCH_DAILY_LIMIT === 5);
assert('default usage is SSR-safe 5/5', defaultInsightsAiUsage().remaining === 5 && defaultInsightsAiUsage().used === 0);
assert('same-day usage is kept', resolveAiSearchUsed(2, '2026-08-29', '2026-08-29') === 2);
assert('new day resets usage', resolveAiSearchUsed(5, '2026-08-28', '2026-08-29') === 0);
assert('missing date resets usage', resolveAiSearchUsed(5, null, '2026-08-29') === 0);
assert('usage is clamped to daily limit', resolveAiSearchUsed(9, '2026-08-29', '2026-08-29') === AI_SEARCH_DAILY_LIMIT);
assert('one-time reset runs when version is missing', shouldApplyInsightsLocalReset(null) === true);
assert('one-time reset skips same version', shouldApplyInsightsLocalReset(INSIGHTS_LOCAL_RESET_VERSION) === false);
assert('bookmark reset keys include saved_news_ids', INSIGHTS_BOOKMARK_STORAGE_KEYS.includes('saved_news_ids'));
assert('usage reset keys include ai_search_usage_count', INSIGHTS_USAGE_STORAGE_KEYS.includes('ai_search_usage_count'));

const store = new Map<string, string>([
	['saved_news_ids', JSON.stringify(['dummy-1', 'dummy-2'])],
	['bookmarked_news', JSON.stringify(['legacy'])],
	['ai_search_usage_count', '3'],
	['today_date', '2026-08-28'],
	['ai_usage_date', '2026-08-28'],
]);
const memoryStorage = {
	getItem(key: string) {
		return store.has(key) ? store.get(key)! : null;
	},
	setItem(key: string, value: string) {
		store.set(key, String(value));
	},
	removeItem(key: string) {
		store.delete(key);
	},
};
(globalThis as { window?: unknown }).window = {
	localStorage: memoryStorage,
	dispatchEvent() {
		return true;
	},
};
resetInsightsLocalData();
assert('manual reset writes empty bookmark arrays', store.get('saved_news_ids') === '[]' && store.get('bookmarked_news') === '[]' && store.get('redue_scrapped_news') === '[]');
assert('manual reset removes usage keys', !store.has('ai_search_usage_count') && !store.has('today_date') && !store.has('ai_usage_date'));

store.set('saved_news_ids', JSON.stringify(['again']));
store.set('ai_search_usage_count', '4');
const firstPass = applyInsightsLocalResetOnce();
assert('one-time reset applies once', firstPass.applied === true);
assert('one-time reset stamps version flag', store.get(INSIGHTS_LOCAL_RESET_FLAG_KEY) === INSIGHTS_LOCAL_RESET_VERSION);
assert('one-time reset leaves bookmarks empty', store.get('saved_news_ids') === '[]');
store.set('saved_news_ids', JSON.stringify(['keep-after-reset']));
const secondPass = applyInsightsLocalResetOnce();
assert('one-time reset skips after version stamp', secondPass.applied === false);
assert('one-time reset preserves later bookmarks', store.get('saved_news_ids') === JSON.stringify(['keep-after-reset']));
assert('recent search drops empty query', prependRecentSearch(['GEO'], '   ').join('|') === 'GEO');
assert(
	'recent search prepends and dedupes',
	prependRecentSearch(['AIO', 'GEO'], 'GEO').join('|') === 'GEO|AIO',
);
assert(
	'recent search keeps latest 6',
	prependRecentSearch(['1', '2', '3', '4', '5', '6'], '7').join('|') === '7|1|2|3|4|5',
);
assert('cache is fresh within 2 hours', isResearchCacheFresh(1_000, 1_000 + 2 * 60 * 60 * 1000 - 1));
assert('cache expires after 2 hours', !isResearchCacheFresh(1_000, 1_000 + 2 * 60 * 60 * 1000));
assert('analyzed ago is just now', formatResearchAnalyzedAgo(10_000, 10_500) === '방금 전');
assert('analyzed clock uses Seoul date', /\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}/.test(formatResearchAnalyzedAt(Date.parse('2026-08-29T07:30:00.000Z'))));
assert('pro plan is pro member', isInsightsProMember('pro', 'user'));
assert('agency plan is pro member', isInsightsProMember('agency', 'user'));
assert('starter is not pro member', !isInsightsProMember('starter', 'user'));
assert('admin role is pro member', isInsightsProMember('starter', 'admin'));

const normalized = normalizeAiResearchResult(
	{
		summary: 'AI 오버뷰가 로컬 검색을 재편하고 있다.',
		insights: ['공식 페이지에 FAQPage를 추가하세요.', ''],
		articles: [
			{
				title: 'Google AI Overviews expand',
				url: 'https://searchengineland.com/ai-overviews',
				publisher: 'Search Engine Land',
				date: '2026-08-29T00:00:00.000Z',
				snippet: 'AI Overviews are showing more local results.',
			},
			{ title: 'bad', url: 'not-a-url' },
		],
	},
	[],
	'AI 오버뷰',
	'gpt-4o-mini',
);

assert('keeps summary', normalized.summary.includes('로컬 검색'));
assert('drops empty insights', normalized.insights.length === 1);
assert('keeps valid articles only', normalized.articles.length === 1 && normalized.articles[0]?.url.includes('searchengineland'));
assert('model is gpt-4o-mini', normalized.model === 'gpt-4o-mini');

const card = researchArticleToNewsItem(normalized.articles[0]!, 0);
assert('maps source url', card.sourceUrl === normalized.articles[0]?.url);
assert('maps publisher', card.sourceName === 'Search Engine Land');
assert('article id prefers url', resolveAiResearchArticleId({ url: 'https://example.com/a' }, 2) === 'https://example.com/a');
assert('article id falls back to ai_index', resolveAiResearchArticleId({}, 3) === 'ai_3');
assert('card id matches article url', card.id === normalized.articles[0]?.url);
assert('normalized article has publishedAt and summary', Boolean(normalized.articles[0]?.publishedAt && normalized.articles[0]?.summary));

// Regression: the model/scraper can hand back a bare ISO timestamp (e.g.
// "2026-09-01T06:10:00.000Z") for an article's date. The card's display
// `publishedAt` must never surface that raw ISO string verbatim — it should
// be a relative Korean label instead, matching the regular news feed.
assert('card publishedAt is not the raw ISO timestamp', card.publishedAt !== normalized.articles[0]?.date);
assert('card publishedAt is not ISO-formatted at all', !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(card.publishedAt));
assert('card publishedAt reads as a relative/absolute Korean date label', /전$|어제$|\d{4}\.\d{2}\.\d{2}$/.test(card.publishedAt), {
	publishedAt: card.publishedAt,
});
assert('card publishedAtIso still preserves the machine-readable timestamp', card.publishedAtIso === new Date(normalized.articles[0]!.date).toISOString());

const undatedArticle = { ...normalized.articles[0]!, date: '', publishedAt: '' };
const undatedCard = researchArticleToNewsItem(undatedArticle, 0);
assert('card with no source date falls back to an ISO string, not empty text', undatedCard.publishedAt.length > 0);

const scrapItem = toScrappedNewsItem(card, 'AI 오버뷰');
assert('scrap stores title/url/publisher', scrapItem.title === card.title && scrapItem.url === card.sourceUrl && scrapItem.publisher === card.sourceName);
assert(
	'scrap parser accepts mixed keys',
	parseScrappedNewsItem({ articleTitle: 'A', articleUrl: 'https://ex.com', source: 'SEL' })?.url === 'https://ex.com',
);
assert('scrap match by url', isItemScrapped({ id: 'other', sourceUrl: card.sourceUrl }, [scrapItem]));

const lastSnap = snapshotFromResearchResult({ ...normalized, searchedAt: 1_724_912_345_678 });
assert('last research snapshot has 1 article', lastSnap.articles.length === 1 && lastSnap.query === 'AI 오버뷰');
assert('last research snapshot keeps timestamp', lastSnap.timestamp === 1_724_912_345_678);
assert('last research parse restores query', parseLastAiResearch(lastSnap)?.query === 'AI 오버뷰');
assert('last research result has 5-or-fewer articles', lastResearchToResult(lastSnap).articles.length === 1);

const heuristic = buildHeuristicResearchResult('GEO', normalized.articles, 'timeout');
assert('heuristic keeps articles', heuristic.articles.length === 1);
assert('heuristic has warning', heuristic.warning === 'timeout');
assert('heuristic model', heuristic.model === 'heuristic');
assert(
	'public research error does not name env keys',
	!insightsPublicError('research').includes('OPENAI') &&
		!insightsPublicError('llm_unavailable').includes('API_KEY') &&
		insightsPublicError('research').includes('AI Provider'),
);
assert(
	'public youtube error does not name env keys',
	!insightsPublicError('youtube_unavailable').includes('YOUTUBE_API_KEY'),
);

if (failed > 0) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');
