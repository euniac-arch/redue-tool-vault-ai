/**
 * STEP 16 — automatic remesasure: same query panel → store → compare → alert.
 * Run: npx tsx scripts/test-intelligence-remeasure.ts
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appendAsiCitationStore, clearAsiCitationStore } from '../lib/ai-search-intelligence/citations/store';
import { readPersistedSchedule } from '../lib/ai-search-intelligence/persist/schedule-file';
import { runAsiQueryPlan } from '../lib/ai-search-intelligence/providers/query-plan';
import type { AIResponse, AsiVisibilityRecord } from '../lib/ai-search-intelligence/types';
import { compareAdjacentVisibility } from '../lib/ai-search-intelligence/visibility/compare';
import {
	clearVisibilityJobs,
	dueVisibilityJobs,
	enrollVisibilityJob,
	hydrateVisibilitySchedule,
	readVisibilityJob,
	readVisibilityPanel,
	resetVisibilityScheduleHydration,
	writeVisibilityPanel,
} from '../lib/ai-search-intelligence/visibility/schedule';
import { appendAsiVisibilityStore, clearAsiVisibilityStore, readAsiVisibilityStore } from '../lib/ai-search-intelligence/visibility/store';
import { runDueAsiVisibilityJobs } from '../lib/ai-search-intelligence/visibility/tick';

process.env.ASI_PERSIST = '1';
process.env.ASI_HISTORY_DIR = mkdtempSync(join(tmpdir(), 'asi-remeasure-'));

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function read(rel: string) {
	return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

const domain = 'remeasure-step16.example';
const url = `https://${domain}`;
const panel = ['대구 흉터 치료 추천', '대구 피부과 추천', 'Sunshine 후기'];

clearAsiVisibilityStore(domain);
clearAsiCitationStore(domain);
clearVisibilityJobs(domain);

function record(day: string, visibility: number, sov: number, competitor: number): AsiVisibilityRecord {
	return {
		timestamp: `${day}T12:00:00.000Z`,
		cadence: 'daily',
		queryCount: panel.length,
		mention: visibility,
		visibility,
		recommendation: visibility - 8,
		citation: 20,
		sov,
		providerScores: { chatgpt: visibility, gemini: visibility, perplexity: 0, claude: visibility },
		competitorScores: { 덴서티: competitor },
		queries: panel.map((query) => ({ query, mentionRate: visibility, recommendationRate: visibility - 10, citationRate: 20 })),
		source: 'live',
	};
}

appendAsiVisibilityStore(domain, record('2026-08-24', 51, 12, 40));
appendAsiVisibilityStore(domain, record('2026-08-25', 57, 16, 44));
appendAsiVisibilityStore(domain, record('2026-08-26', 61, 18, 70));

const monTue = compareAdjacentVisibility(readAsiVisibilityStore(domain).slice(0, 2));
const tueWed = compareAdjacentVisibility(readAsiVisibilityStore(domain));
assert('Mon→Tue visibility +6', monTue?.visibility.change === 6);
assert('Tue→Wed visibility +4', tueWed?.visibility.change === 4);
assert('Tue→Wed SOV +2', tueWed?.sov.change === 2);
assert(
	'Tue→Wed competitor surge alert',
	Boolean(tueWed?.alerts.some((row) => row.type === 'competitor_surge' && row.relatedCompetitor === '덴서티')),
);

writeVisibilityPanel(domain, panel);
assert('panel pins the same queries', readVisibilityPanel(domain).join('|') === panel.join('|'));

const monday = new Date('2026-08-24T00:00:00.000Z');
const enrolled = enrollVisibilityJob({ url, domain, cadence: 'daily', now: monday });
assert('first next run is Tuesday', enrolled.nextRunAt.startsWith('2026-08-25'));
assert('job persisted to disk', readPersistedSchedule(domain)?.job?.cadence === 'daily');
assert('panel persisted to disk', (readPersistedSchedule(domain)?.queries || []).join('|') === panel.join('|'));

clearVisibilityJobs();
resetVisibilityScheduleHydration();
hydrateVisibilitySchedule();
assert('hydrate restores due job', readVisibilityJob(domain)?.cadence === 'daily');
assert('hydrate restores query panel', readVisibilityPanel(domain).join('|') === panel.join('|'));
assert('Tuesday cron sees the job', dueVisibilityJobs(new Date('2026-08-25T12:00:00.000Z')).length === 1);

function liveRow(query: string, provider: AIResponse['provider'] = 'chatgpt'): AIResponse {
	return {
		provider,
		query,
		answer: '캐시된 월요일 답변',
		mentions: ['덴서티'],
		recommendations: ['덴서티'],
		citations: [],
		confidence: 0.5,
		timestamp: '2026-08-24T12:00:00.000Z',
		source: 'live',
	};
}

void (async () => {
	clearAsiCitationStore(domain);
	appendAsiCitationStore(
		domain,
		[liveRow(panel[0]), liveRow(panel[0], 'gemini')],
		{ brand: 'Sunshine', siteUrl: url, aliases: ['Sunshine'] },
	);
	const cached = await runAsiQueryPlan({
		queries: [panel[0]],
		url,
		brand: 'Sunshine',
		domain,
		limit: 1,
	});
	assert('same-day plan hits citation cache', cached[0]?.cacheHit === true);
	const refreshed = await runAsiQueryPlan({
		queries: [panel[0]],
		url,
		brand: 'Sunshine',
		domain,
		limit: 1,
		refresh: true,
	});
	assert('remesasure refresh bypasses citation cache', refreshed[0]?.cacheHit === false);
	assert(
		'refresh still returns engines after a miss',
		(refreshed[0]?.responses.length ?? 0) >= 1,
	);

	const before = readAsiVisibilityStore(domain).length;
	const tick = await runDueAsiVisibilityJobs(new Date('2026-08-25T12:00:00.000Z'));
	assert('due remesasure ran', tick.ran === 1 && tick.domains.includes(domain));
	assert('new visibility snapshot stored', readAsiVisibilityStore(domain).length === before + 1);
	assert('tick compare is last vs previous', Boolean(tick.comparisons[0]));
	assert('panel unchanged after remesasure', readVisibilityPanel(domain).join('|') === panel.join('|'));
	const afterJob = readVisibilityJob(domain);
	assert('next run moved forward', Boolean(afterJob && Date.parse(afterJob.nextRunAt) > Date.parse('2026-08-25T12:00:00.000Z')));

	const runSrc = read('lib/ai-search-intelligence/visibility/run.ts');
	const tickSrc = read('lib/ai-search-intelligence/visibility/tick.ts');
	const routeSrc = read('app/api/intelligence/route.ts');
	assert('runner remesasure uses query plan', runSrc.includes('runAsiQueryPlan') && runSrc.includes('refresh:'));
	assert('runner pins query panel', runSrc.includes('readVisibilityPanel') && runSrc.includes('writeVisibilityPanel'));
	assert('tick sets remesasure only', tickSrc.includes('remeasure: true') && !tickSrc.includes('queryAsiProviders'));
	assert('HTTP cannot remesasure', !/remeasure\s*:/.test(routeSrc) && routeSrc.includes('scheduler-only'));
	assert(
		'no vendor HTTP in remesasure path',
		!/api\.openai\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai|api\.anthropic\.com/.test(runSrc + tickSrc),
	);

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
