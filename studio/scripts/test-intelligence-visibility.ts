/**
 * AI Visibility Monitor + Alert — stored snapshots, real deltas, config thresholds.
 * Run: npx tsx scripts/test-intelligence-visibility.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mockAsiEngine } from '../lib/ai-search-intelligence/adapters/mock-engine';
import { generateVisibilityAlerts } from '../lib/ai-search-intelligence/visibility/alerts';
import { buildVisibilityMonitorSnapshot, coreVisibilityFromRecord } from '../lib/ai-search-intelligence/visibility/analyze';
import { ASI_VISIBILITY_CONFIG } from '../lib/ai-search-intelligence/visibility/config';
import { dueVisibilityJobs, enrollVisibilityJob, clearVisibilityJobs } from '../lib/ai-search-intelligence/visibility/schedule';
import { buildVisibilityRecord } from '../lib/ai-search-intelligence/visibility/score';
import { appendAsiVisibilityStore, clearAsiVisibilityStore, readAsiVisibilityStore } from '../lib/ai-search-intelligence/visibility/store';
import { buildVisibilityTrend } from '../lib/ai-search-intelligence/visibility/trend';
import type { AIResponse, AsiVisibilityRecord } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const site = {
	url: 'https://sunshineclinic.kr',
	brandName: 'Sunshine',
	domain: 'sunshineclinic.kr',
	location: '대구',
	category: '흉터',
};

clearAsiVisibilityStore();
clearVisibilityJobs();

function response(input: {
	query: string;
	provider?: AIResponse['provider'];
	mentions?: string[];
	recommendations?: string[];
	citations?: AIResponse['citations'];
}): AIResponse {
	return {
		provider: input.provider ?? 'chatgpt',
		query: input.query,
		answer: `${(input.recommendations ?? ['덴서티']).join(', ')}를 추천합니다.`,
		mentions: input.mentions ?? ['덴서티'],
		recommendations: input.recommendations ?? ['덴서티'],
		citations: input.citations ?? [],
		confidence: 0.7,
		timestamp: '2026-03-01T00:00:00.000Z',
		source: 'live',
	};
}

const missBatch = [
	response({ query: '대구 흉터 치료 추천' }),
	response({ query: '대구 흉터 치료 추천', provider: 'gemini' }),
];
const winBatch = [
	response({
		query: '대구 흉터 치료 추천',
		mentions: ['Sunshine'],
		recommendations: ['Sunshine'],
		citations: [{ source: '공식', url: 'https://sunshineclinic.kr', type: 'official', relevance: 80, authority: 80 }],
	}),
	response({
		query: '대구 흉터 치료 추천',
		provider: 'gemini',
		mentions: ['Sunshine'],
		recommendations: ['Sunshine'],
		citations: [{ source: '공식', url: 'https://sunshineclinic.kr', type: 'official', relevance: 80, authority: 80 }],
	}),
];

const low = buildVisibilityRecord({ responses: missBatch, brand: 'Sunshine', source: 'live' });
const high = buildVisibilityRecord({ responses: winBatch, brand: 'Sunshine', source: 'live' });
assert('record query count is observed', low.queryCount === 1);
assert('win visibility higher than miss', high.visibility > low.visibility);
assert('competitor score only when observed', Object.keys(low.competitorScores).includes('덴서티'));
assert('no invented competitor on brand-only', Object.keys(high.competitorScores).length === 0);

const now = Date.parse('2026-03-10T12:00:00.000Z');
const older: AsiVisibilityRecord = { ...high, timestamp: '2026-03-01T12:00:00.000Z', visibility: 68, recommendation: 54, citation: 31, sov: 22 };
const newer: AsiVisibilityRecord = {
	...low,
	timestamp: '2026-03-10T12:00:00.000Z',
	visibility: 54,
	recommendation: 40,
	citation: 20,
	sov: 14,
	competitorScores: { 덴서티: 83 },
	providerScores: { chatgpt: 40, gemini: 38 },
	queries: [{ query: '대구 흉터 치료 추천', mentionRate: 10, recommendationRate: 0, citationRate: 0 }],
};
const olderFull: AsiVisibilityRecord = {
	...older,
	competitorScores: { 덴서티: 71 },
	providerScores: { chatgpt: 70, gemini: 66 },
	queries: [{ query: '대구 흉터 치료 추천', mentionRate: 80, recommendationRate: 50, citationRate: 40 }],
};

const singleTrend = buildVisibilityTrend({ records: [newer], window: '7d', brand: 'Sunshine', now });
assert('no invented previous on first snapshot', singleTrend.hasPrevious === false);
assert('no invented change %', singleTrend.kpis.visibility.change == null);

const sameDayNow = Date.parse('2026-03-10T18:00:00.000Z');
const morning: AsiVisibilityRecord = { ...olderFull, timestamp: '2026-03-10T08:00:00.000Z', visibility: 48 };
const evening: AsiVisibilityRecord = { ...newer, timestamp: '2026-03-10T16:00:00.000Z', visibility: 60 };
const sameDay = buildVisibilityTrend({ records: [morning, evening], window: 'today', brand: 'Sunshine', now: sameDayNow });
assert('same-day snapshots compare to the earlier one', sameDay.hasPrevious === true);
assert('same-day change is +12', sameDay.kpis.visibility.change === 12);
assert('same-day change % is +25', sameDay.kpis.visibility.changePct === 25);
assert('same-day chart has both points', sameDay.points.length === 2);
const sameDayAlerts = generateVisibilityAlerts({
	records: [
		{ ...morning, visibility: 62, recommendation: 50, citation: 30, sov: 20 },
		{ ...evening, visibility: 50, recommendation: 32, citation: 12, sov: 8, competitorScores: { 덴서티: 88 } },
	],
	trend: buildVisibilityTrend({
		records: [
			{ ...morning, visibility: 62 },
			{ ...evening, visibility: 50, competitorScores: { 덴서티: 88 } },
		],
		window: 'today',
		brand: 'Sunshine',
		now: sameDayNow,
	}),
	window: 'today',
	now: sameDayNow,
});
assert('same-day visibility drop fires alert', sameDayAlerts.some((row) => row.type === 'visibility_drop'));

const trend = buildVisibilityTrend({ records: [olderFull, newer], window: '7d', brand: 'Sunshine', now });
assert('current is latest', trend.kpis.visibility.current === 54);
assert('previous is pre-window', trend.kpis.visibility.previous === 68);
assert('change is observed', trend.kpis.visibility.change === -14 && trend.kpis.visibility.provenance === 'observed');
assert('gap widened when competitor pulled away', trend.gap.widened === true);

const alerts = generateVisibilityAlerts({ records: [olderFull, newer], trend, window: '7d', now });
assert('visibility drop fires from config', alerts.some((row) => row.type === 'visibility_drop'));
assert(
	'visibility drop uses threshold config',
	68 - 54 >= ASI_VISIBILITY_CONFIG.alerts.visibilityDrop,
);
assert('competitor surge fires', alerts.some((row) => row.type === 'competitor_surge' && row.relatedCompetitor === '덴서티'));
assert('query shift fires', alerts.some((row) => row.type === 'query_shift' && row.relatedQuery === '대구 흉터 치료 추천'));
assert('provider anomaly fires', alerts.some((row) => row.type === 'provider_anomaly'));
assert(
	'causes are derived',
	alerts.every((row) => row.causes.every((item) => item.provenance === 'derived')),
);

const tiny: AsiVisibilityRecord = { ...newer, visibility: 66, recommendation: 52, citation: 30, sov: 21, competitorScores: { 덴서티: 72 } };
const tinyTrend = buildVisibilityTrend({ records: [olderFull, tiny], window: '7d', brand: 'Sunshine', now });
const tinyAlerts = generateVisibilityAlerts({ records: [olderFull, tiny], trend: tinyTrend, window: '7d', now });
assert('no alert below config threshold', tinyAlerts.every((row) => row.type !== 'visibility_drop'));

const snapshot = buildVisibilityMonitorSnapshot({
	site,
	source: 'live',
	boundFromAudit: false,
	records: [olderFull, newer],
	now,
});
assert('today / 7d / 30d exist', Boolean(snapshot.trends.today && snapshot.trends['7d'] && snapshot.trends['30d']));
assert('adjacent remesasure compare exists', snapshot.comparison?.visibility.change === -14);
assert('core visibility score is derived', coreVisibilityFromRecord(newer).visibilityScore.provenance === 'derived');
assert('core query count is observed', coreVisibilityFromRecord(newer).totalQueries.provenance === 'observed');

const enrolled = enrollVisibilityJob({
	url: site.url,
	domain: site.domain,
	cadence: 'weekly',
	now: new Date(now),
});
assert('weekly job is in the future', Date.parse(enrolled.nextRunAt) > now);
assert('due list empty before next run', dueVisibilityJobs(new Date(now)).length === 0);
const enrolledAgain = enrollVisibilityJob({
	url: site.url,
	domain: site.domain,
	cadence: 'weekly',
	now: new Date(now + 60_000),
});
assert('re-enroll does not reset nextRunAt', enrolledAgain.nextRunAt === enrolled.nextRunAt);

assert('thresholds live in config', ASI_VISIBILITY_CONFIG.alerts.visibilityDrop > 0);
assert('min interval lives in config', ASI_VISIBILITY_CONFIG.minIntervalMs > 0);
assert('query limit lives in config', ASI_VISIBILITY_CONFIG.queryLimit <= 10);

void (async () => {
	clearAsiVisibilityStore(site.domain);
	appendAsiVisibilityStore(site.domain, { ...newer, timestamp: new Date().toISOString() });
	const first = await mockAsiEngine.loadVisibility({ url: site.url });
	assert('engine reuses inside min interval', Boolean(first?.reused));
	assert('engine snapshot has trends', Boolean(first?.trends['7d']));

	clearAsiVisibilityStore(site.domain);
	const fresh = await mockAsiEngine.loadVisibility({ url: site.url });
	assert('engine snapshot builds', Boolean(fresh));
	assert('engine stores a record', readAsiVisibilityStore(site.domain).length >= 1);

	const runSrc = readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/visibility/run.ts'), 'utf8');
	assert('runner uses query plan', runSrc.includes('runAsiQueryPlan'));
	assert(
		'runner has no vendor HTTP',
		!/api\.openai\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai|api\.anthropic\.com/.test(runSrc),
	);
	assert('runner uses minInterval', runSrc.includes('minIntervalMs'));
	assert('runner uses queryLimit', runSrc.includes('queryLimit'));
	assert('runner persists visibility snapshots', runSrc.includes('recordAsiVisibilitySnapshot'));

	const alertSrc = readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/visibility/alerts.ts'), 'utf8');
	assert('alerts read config not magic numbers', alertSrc.includes('ASI_VISIBILITY_CONFIG.alerts'));

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
