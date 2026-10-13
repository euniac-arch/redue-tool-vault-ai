/**
 * Verified global AI web-traffic observations.
 * Run: npx tsx scripts/test-market-observations.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import seedJson from '../data/ai-market/web-traffic-observations.json';
import { getKstDateKey } from '../lib/ai-hub/live-ai-rankings';
import {
	applyPublicMarketView,
	assertValidBundle,
	classifyWebTrafficPage,
	listWebTrafficRows,
	marketCacheToken,
	parseWebTrafficTable,
	periodGranularity,
	resolveMarketCheck,
	SHARE_UNAVAILABLE_LABEL,
	shouldRunDailyCheck,
	validateMetricBlock,
	validateShareRows,
	WEB_TRAFFIC_COHORT,
	type MarketBundle,
	type ServiceShareRow,
} from '../lib/ai-hub/market-observations';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
}

const bundle = assertValidBundle(seedJson);
const rows = listWebTrafficRows(bundle);
const sum = Math.round(rows.reduce((total, row) => total + row.sharePct, 0) * 10) / 10;

assert('web traffic shares sum near 100 without rescaling', Math.abs(sum - 100) <= 1.5 && sum !== 100, sum);
assert('chatgpt stays 56.4 and is rank 1', rows[0]?.serviceId === 'chatgpt' && rows[0].sharePct === 56.4 && rows[0].rank === 1);
assert(
	'ranks follow share order',
	rows.every((row, index) => row.rank === index + 1) && rows.every((row, index) => index === 0 || row.sharePct <= rows[index - 1].sharePct),
);
assert('perplexity is 7th at 0.9, not a second product', rows.find((row) => row.serviceId === 'perplexity')?.rank === 7);
assert(
	'no duplicate service ids',
	new Set(rows.map((row) => row.serviceId)).size === rows.length && !rows.some((row) => row.serviceId.includes('spaces')),
);
assert('cohort is exactly the published comparison set', WEB_TRAFFIC_COHORT.every((id) => rows.some((row) => row.serviceId === id)));
assert('referral share is a different metric', bundle.referral?.rows.find((row) => row.serviceId === 'perplexity')?.sharePct === 5.9);
assert('september observation is monthly, not daily', periodGranularity(bundle.webTraffic.periodStart, bundle.webTraffic.periodEnd) === 'monthly');
assert('source url is required on the published block', bundle.webTraffic.sourceUrl.startsWith('https://'));
assert(
	'a block without a source url fails validation',
	validateMetricBlock({ ...bundle.webTraffic, sourceUrl: '' }, { allowedIds: WEB_TRAFFIC_COHORT, requireAll: true }).length > 0,
);
assert('unavailable label is not a zero share', SHARE_UNAVAILABLE_LABEL !== '0%');

const missingCohort = validateShareRows(
	[{ serviceId: 'chatgpt', serviceName: 'ChatGPT', sharePct: 100, momChangePp: null, rank: 1 }],
	{ allowedIds: WEB_TRAFFIC_COHORT, requireAll: true },
);
assert('a one-service table is not the full cohort', missingCohort.ok === false);

const duplicate = validateShareRows(
	[
		{ serviceId: 'chatgpt', serviceName: 'ChatGPT', sharePct: 50, momChangePp: null, rank: 1 },
		{ serviceId: 'chatgpt', serviceName: 'ChatGPT', sharePct: 50, momChangePp: null, rank: 2 },
	],
	{ allowedIds: ['chatgpt'], requireAll: true },
);
assert('duplicate service id fails validation', duplicate.ok === false);

assert('kst date rolls at 15:00 UTC', getKstDateKey(new Date('2026-10-12T14:30:00.000Z')) === '2026-10-12');
assert('kst date is the next calendar day after 15:00 UTC', getKstDateKey(new Date('2026-10-12T15:30:00.000Z')) === '2026-10-13');
assert('same kst day does not check again', shouldRunDailyCheck('2026-10-13', '2026-10-13') === false);
assert('next kst day checks again', shouldRunDailyCheck('2026-10-13', '2026-10-14') === true);

const table = `
<h2>AI assistant web traffic share</h2>
<p>Similarweb, measured. September 2026 and October 2025</p>
<table>
<tr><td>ChatGPT</td><td>56.4%</td><td>71.8%</td></tr>
<tr><td>Gemini</td><td>25.0%</td><td>13.6%</td></tr>
<tr><td>Claude</td><td>9.6%</td><td>2.3%</td></tr>
<tr><td>DeepSeek</td><td>3.4%</td><td>4.1%</td></tr>
<tr><td>Grok</td><td>2.3%</td><td>2.8%</td></tr>
<tr><td>Copilot</td><td>1.5%</td><td>2.0%</td></tr>
<tr><td>Perplexity</td><td>0.9%</td><td>2.5%</td></tr>
</table>
`;
const parsed = parseWebTrafficTable(table);
assert('parser keeps september column and does not invent visits', parsed?.periodStart === '2026-09-01' && parsed.rows[0]?.sharePct === 56.4);
assert('parser does not emit a daily series', parsed ? periodGranularity(parsed.periodStart, parsed.periodEnd) === 'monthly' : false);
assert('parser uses the september column, not the october 2025 comparison column', parsed?.rows.find((row) => row.serviceId === 'chatgpt')?.sharePct === 56.4 && parsed?.rows.every((row) => row.sharePct !== 71.8));

const aprilReferralOnly = `
<h2>AI referral traffic to websites</h2>
<p>StatCounter, Apr 2026</p>
<table><tr><td>ChatGPT</td><td>76.9%</td><td>74.8%</td></tr></table>
`;
assert('an april referral table is not a september web-traffic observation', classifyWebTrafficPage(aprilReferralOnly).status === 'rejected');

const mixedPage = `
<p>Updated April 2026. StatCounter, Apr 2026. ChatGPT 76.9% Gemini 9.0%.</p>
<h2>AI referral traffic</h2>
<p>April 2026 ChatGPT 76.9% 74.8%</p>
<h2>AI assistant web traffic share</h2>
<p>Similarweb, measured. September 2026 October 2025</p>
${table.replace('<h2>AI assistant web traffic share</h2>', '').replace('<p>September 2026 and October 2025</p>', '')}
<h2>AI referral traffic to websites</h2>
<p>StatCounter, Sep 2026 StatCounter, Apr 2026 ChatGPT 80.5% 76.9%</p>
`;
const mixed = classifyWebTrafficPage(mixedPage);
assert(
	'september web-traffic column wins over the april referral column',
	mixed.status === 'parsed' && mixed.table.periodStart === '2026-09-01' && mixed.table.rows[0]?.sharePct === 56.4,
);

const octoberTable = table.replace('September 2026', 'October 2026').replace('56.4%', '57.0%');

async function main(): Promise<void> {
let fetches = 0;
const sameDay = await resolveMarketCheck({
	current: bundle,
	lastCheckDate: '2026-10-13',
	today: '2026-10-13',
	now: new Date('2026-10-13T01:00:00.000Z'),
	fetchText: async () => {
		fetches += 1;
		return table;
	},
});
assert('same-day check does not fetch', sameDay.fetched === false && fetches === 0 && sameDay.bundle.webTraffic.rows[0]?.sharePct === 56.4);

const failedFetch = await resolveMarketCheck({
	current: bundle,
	lastCheckDate: null,
	today: '2026-10-13',
	now: new Date('2026-10-13T02:00:00.000Z'),
	fetchText: async () => {
		throw new Error('timeout');
	},
});
assert(
	'fetch failure keeps the previous shares',
	failedFetch.bundle.checkStatus === 'check_failed' && failedFetch.bundle.webTraffic.rows[0]?.sharePct === 56.4,
);

function shiftedTable(chatgpt: string): string {
	return table.replace('56.4%', `${chatgpt}%`).replace('25.0%', '10.0%');
}
const jump = await resolveMarketCheck({
	current: bundle,
	lastCheckDate: null,
	today: '2026-10-14',
	now: new Date('2026-10-13T16:00:00.000Z'),
	fetchText: async () => shiftedTable('80.0'),
});
assert('abnormal jump is held for review and not published', jump.bundle.checkStatus === 'review_required' && jump.bundle.webTraffic.rows[0]?.sharePct === 56.4);

const confirmed = await resolveMarketCheck({
	current: bundle,
	lastCheckDate: null,
	today: '2026-10-13',
	now: new Date('2026-10-13T08:00:00.000Z'),
	fetchText: async (url) => {
		if (url.includes('officechai')) {
			return 'September 2026 ChatGPT 56.4% Gemini 25.0% Claude 9.6% DeepSeek 3.4% Grok 2.3% Copilot 1.5% Perplexity 0.9%';
		}
		return table;
	},
});
assert(
	'two secondary pages agree without claiming a primary verification',
	confirmed.bundle.checkStatus === 'secondary_corroborated' && confirmed.bundle.webTraffic.periodStart === '2026-09-01' && confirmed.bundle.webTraffic.rows[0]?.sharePct === 56.4,
);

const plateOnly = await resolveMarketCheck({
	current: bundle,
	lastCheckDate: null,
	today: '2026-10-14',
	now: new Date('2026-10-13T16:00:00.000Z'),
	fetchText: async (url) => {
		if (url.includes('officechai')) throw new Error('officechai down');
		return table;
	},
});
assert(
	'one readable secondary page is labeled single_secondary_source',
	plateOnly.bundle.checkStatus === 'single_secondary_source' && plateOnly.bundle.webTraffic.rows[0]?.sharePct === 56.4,
);

const discovered = await resolveMarketCheck({
	current: bundle,
	lastCheckDate: null,
	today: '2026-10-15',
	now: new Date('2026-10-14T16:00:00.000Z'),
	fetchText: async (url) => {
		if (url.includes('officechai')) return 'September 2026 ChatGPT 56.4%';
		return octoberTable;
	},
});
assert(
	'a newer month on the watched page is held for review',
	discovered.bundle.checkStatus === 'review_required' &&
		discovered.bundle.webTraffic.periodStart === '2026-09-01' &&
		discovered.bundle.webTraffic.rows[0]?.sharePct === 56.4 &&
		discovered.log.candidate?.periodStart === '2026-10-01' &&
		discovered.log.candidate.rows[0]?.sharePct === 57,
);

const stale = await resolveMarketCheck({
	current: { ...bundle, checkStatus: 'confirmed_unchanged' },
	lastCheckDate: '2026-10-13',
	today: '2026-10-13',
	now: new Date('2026-10-13T09:00:00.000Z'),
	fetchText: async (url) => {
		if (url.includes('officechai')) {
			return 'September 2026 ChatGPT 56.4% Gemini 25.0% Claude 9.6% DeepSeek 3.4% Grok 2.3% Copilot 1.5% Perplexity 0.9%';
		}
		return table;
	},
});
assert('a stored confirmed_unchanged status is rechecked instead of kept', stale.fetched === true && stale.bundle.checkStatus === 'secondary_corroborated');
assert('cache token changes when the check status changes', marketCacheToken(bundle) !== marketCacheToken(confirmed.bundle));

const viewed = applyPublicMarketView(
	[
		{ id: 'chatgpt', category: 'llm', name: 'ChatGPT', recommend_score: 90 },
		{ id: 'perplexity', category: 'llm', name: 'Perplexity', recommend_score: 95 },
		{ id: 'midjourney', category: 'image', name: 'Midjourney', recommend_score: 80 },
	],
	bundle,
);
const publicIds = listWebTrafficRows(bundle).map((row) => row.serviceId);
assert('image tools stay out of the web-traffic denominator', !publicIds.includes('midjourney'));
assert('midjourney share is unavailable rather than zero', viewed.find((tool) => tool.id === 'midjourney')?.webTrafficSharePct === null);
assert('perplexity web rank is 7 inside the llm category', viewed.find((tool) => tool.id === 'perplexity')?.webTrafficRank === 7);
assert(
	'main bar and modal read the same rows',
	listWebTrafficRows(confirmed.bundle).map((row: ServiceShareRow) => `${row.serviceId}:${row.sharePct}`).join('|') ===
		listWebTrafficRows(bundle).map((row) => `${row.serviceId}:${row.sharePct}`).join('|'),
);

const serviceSource = readFileSync(path.resolve(__dirname, '../lib/ai-hub/daily-ai-rankings-service.ts'), 'utf8');
assert('published ranking does not apply daily share jitter', !serviceSource.includes('applyDailyGlobalRanking') && !serviceSource.includes('applyDailyMarketShares'));

const bundleType: MarketBundle = confirmed.bundle;
assert('confirmed bundle still validates', assertValidBundle(bundleType).webTraffic.validationStatus === 'passed');

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall market observation assertions passed');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
