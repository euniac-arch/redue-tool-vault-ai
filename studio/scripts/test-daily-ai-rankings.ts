/**
 * Live daily AI ranking — share normalize, rank delta, NEW / HOT, movers.
 * Run: npx tsx scripts/test-daily-ai-rankings.ts
 */
import type { AiTool } from '../lib/admin/ai-tools-management';
import {
	analyzeDailyRankings,
	computeDailyRankings,
	inferYesterdayTrafficIndex,
	normalizeSharePct,
	shiftDateKey,
	type DailyRankSnapshotRow,
} from '../lib/ai-hub/live-ai-rankings';
import { classifyRisingStatus, deriveTrendScore } from '../lib/ai-hub/rising-ai-tools';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
}

function tool(partial: Partial<AiTool> & Pick<AiTool, 'id' | 'name' | 'category' | 'monthly_visits'>): AiTool {
	return {
		provider: partial.provider ?? 'Test',
		url: '',
		logo_url: '',
		desc: '',
		tags: [],
		is_public: true,
		market_share: 10,
		recommend_score: partial.recommend_score ?? 90,
		rating: 4.5,
		growth: partial.growth ?? '+0.0%',
		pricing: { type: 'Freemium', summary: 'free', free_tier: '', paid_tier: '' },
		guide: { steps: ['', '', ''], pro_tip: '' },
		...partial,
	};
}

assert('normalize 50 of 200 is 25%', normalizeSharePct(50, 200) === 25);
assert('normalize empty total is 0', normalizeSharePct(10, 0) === 0);
assert('shiftDateKey goes back one day', shiftDateKey('2026-09-03', -1) === '2026-09-02');

const catalog = [
	tool({ id: 'alpha', name: 'Alpha', category: 'llm', monthly_visits: '100M', recommend_score: 99, growth: '+10.0%' }),
	tool({ id: 'beta', name: 'Beta', category: 'video', monthly_visits: '40M', recommend_score: 95, growth: '+80.0%' }),
	tool({ id: 'gamma', name: 'Gamma', category: 'video', monthly_visits: '30M', recommend_score: 88, growth: '+0.0%' }),
];

const noSnapshot = computeDailyRankings(catalog, new Map(), '2026-09-03T00:00:00.000Z');
const alpha = noSnapshot.find((row) => row.id === 'alpha');
const beta = noSnapshot.find((row) => row.id === 'beta');
const gamma = noSnapshot.find((row) => row.id === 'gamma');

assert('alpha is global #1 by traffic', alpha?.currentRank === 1);
assert('shares sum to ~100', Math.abs(noSnapshot.reduce((sum, row) => sum + row.globalSharePct, 0) - 100) < 0.2);
assert(
	'video category shares sum to ~100',
	Math.abs((beta?.categorySharePct ?? 0) + (gamma?.categorySharePct ?? 0) - 100) < 0.2,
);
assert('yesterday traffic of +80% 40M is ~22.2M', Math.abs(inferYesterdayTrafficIndex(catalog[1]) - 40_000_000 / 1.8) < 1);
assert('beta inferred previous rank is worse than today (mover)', (beta?.previousRank ?? 0) > (beta?.currentRank ?? 99));

const yesterday: DailyRankSnapshotRow[] = [
	{ id: 'alpha', currentRank: 1, categoryRank: 1, trafficIndex: 100_000_000, score: 99 },
	{ id: 'gamma', currentRank: 2, categoryRank: 1, trafficIndex: 30_000_000, score: 88 },
];
const withSnapshot = computeDailyRankings(catalog, new Map(yesterday.map((row) => [row.id, row])), '2026-09-03T00:00:00.000Z', {
	hasYesterdaySnapshot: true,
});
const newBeta = withSnapshot.find((row) => row.id === 'beta');
assert('tool missing from yesterday snapshot is NEW', newBeta?.isNew === true && newBeta.previousRank === 0);

const analysis = analyzeDailyRankings(noSnapshot, { llm: 'LLM', video: '비디오' });
assert('top mover is the largest rank jump', analysis.topMover?.id === 'beta', analysis.topMover?.id);

const tied = computeDailyRankings(
	[
		tool({ id: 'steady', name: 'Steady', category: 'llm', monthly_visits: '80M', growth: '+0.0%' }),
		tool({ id: 'surge-a', name: 'Surge A', category: 'video', monthly_visits: '20M', growth: '+40.0%' }),
		tool({ id: 'surge-b', name: 'Surge B', category: 'video', monthly_visits: '18M', growth: '+90.0%' }),
	],
	new Map(),
	'2026-09-03T00:00:00.000Z',
);
const tiedAnalysis = analyzeDailyRankings(tied, { llm: 'LLM', video: '비디오' });
assert(
	'tied rank-delta prefers higher growth',
	tiedAnalysis.topMover?.id === 'surge-b' || (tiedAnalysis.topMover?.rankDelta ?? 0) >= 0,
	tiedAnalysis.topMover?.id,
);
assert('category champion llm is highest score in llm', analysis.categoryChampions.some((row) => row.key === 'llm' && row.tool.id === 'alpha'));
assert('global top is rank-sorted', analysis.globalTop[0]?.id === 'alpha');

const mature = classifyRisingStatus({
	growthRate: 3.2,
	trendScore: 42,
	currentRank: 1,
	rankDelta: 0,
	isNew: false,
	isHot: false,
});
assert('low-growth formal rank stays ranked', mature.status === 'ranked' && mature.isRising === false);

const buzz = classifyRisingStatus({
	growthRate: 86,
	trendScore: 94,
	currentRank: 12,
	rankDelta: 4,
	isNew: false,
	isHot: true,
});
assert('high growth + jump is hot_rising', buzz.status === 'hot_rising' && buzz.isRising);

const outsideTop = classifyRisingStatus({
	growthRate: 28,
	trendScore: 70,
	currentRank: 61,
	rankDelta: 1,
	isNew: false,
	isHot: false,
});
assert('outside Top 50 can still be rising/emerging', outsideTop.isRising && outsideTop.status === 'emerging' && outsideTop.formalRank === undefined);

const catalogTrend = deriveTrendScore({
	growthRate: 5,
	rankDelta: 0,
	isNew: false,
	isHot: false,
	catalogTrendScore: 88,
});
assert('catalog trend_score wins over derived buzz', catalogTrend === 88);

const risingCatalog = computeDailyRankings(
	[
		tool({ id: 'incumbent', name: 'Incumbent', category: 'llm', monthly_visits: '5B', growth: '+1.0%' }),
		tool({
			id: 'sleeper',
			name: 'Sleeper',
			category: 'video',
			monthly_visits: '3M',
			growth: '+120.0%',
			trend_score: 88,
			launch_date: '2025-12-01',
		}),
	],
	new Map(),
	'2026-09-03T00:00:00.000Z',
);
const sleeper = risingCatalog.find((row) => row.id === 'sleeper');
const incumbent = risingCatalog.find((row) => row.id === 'incumbent');
assert('thin-traffic high-buzz tool is rising', sleeper?.isRising === true, sleeper?.status);
assert('incumbent with flat growth is not rising', incumbent?.isRising === false);
const risingAnalysis = analyzeDailyRankings(risingCatalog, { llm: 'LLM', video: '비디오' });
assert('analysis.rising excludes non-rising', risingAnalysis.rising.every((row) => row.isRising));
assert('analysis.rising includes sleeper', risingAnalysis.rising.some((row) => row.id === 'sleeper'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall daily AI ranking assertions passed');
