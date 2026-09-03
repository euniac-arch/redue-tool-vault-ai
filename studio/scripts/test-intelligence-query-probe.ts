/**
 * Query generator → measured run → previous-run compare.
 * Run: npx tsx scripts/test-intelligence-query-probe.ts
 */
import { mockAsiEngine } from '../lib/ai-search-intelligence/adapters/mock-engine';
import { compareAsiQueryRuns } from '../lib/ai-search-intelligence/probe/compare';
import { extractAsiQueryResult, toAsiQueryProbeRecord } from '../lib/ai-search-intelligence/probe/extract';
import { ASI_QUERY_PROBE_MAX, buildAsiQueryRun, normalizeProbeQueries } from '../lib/ai-search-intelligence/probe/run';
import { appendAsiQueryRun, clearAsiQueryRuns } from '../lib/ai-search-intelligence/probe/store';
import { buildMockEvidenceSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-evidence';
import type { AIResponse, AsiQueryExtract, AsiQueryRun } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function extract(partial: Partial<AsiQueryExtract> = {}): AsiQueryExtract {
	return {
		mentioned: false,
		recommended: false,
		rank: null,
		mentionType: 'none',
		competitors: [],
		citations: [],
		...partial,
	};
}

function response(partial: Partial<AIResponse> = {}): AIResponse {
	return {
		provider: 'chatgpt',
		query: '대구 피부과 추천',
		answer: '대구에서는 선샤인클리닉을 추천합니다. A피부과도 자주 언급됩니다.',
		mentions: ['선샤인클리닉', 'A피부과'],
		recommendations: ['선샤인클리닉', 'A피부과'],
		citations: [
			{ source: '공식', url: 'https://sunshineclinic.kr', type: 'official', relevance: 80, authority: 80 },
		],
		confidence: 0.8,
		timestamp: '2026-08-30T00:00:00.000Z',
		source: 'live',
		...partial,
	};
}

function runFrom(records: AsiQueryRun['records'], extras: Partial<AsiQueryRun> = {}): AsiQueryRun {
	return {
		runId: extras.runId || 'run_a',
		timestamp: extras.timestamp || '2026-08-30T00:00:00.000Z',
		siteUrl: extras.siteUrl || 'https://sunshineclinic.kr',
		brand: extras.brand || '선샤인클리닉',
		queries: extras.queries || ['대구 피부과 추천'],
		records,
	};
}

clearAsiQueryRuns();

const extracted = extractAsiQueryResult(response(), { brand: '선샤인클리닉', aliases: ['sunshineclinic'] });
assert('extract mention', extracted.mentioned === true);
assert('extract recommend', extracted.recommended === true);
assert('extract rank 1', extracted.rank === 1);
assert('extract competitors', extracted.competitors.includes('A피부과'));
assert('extract citations observed only', extracted.citations[0] === 'https://sunshineclinic.kr');

const unusable = extractAsiQueryResult(
	response({ source: 'fallback', answer: '', mentions: [], recommendations: [], meta: { mode: 'hybrid', provider: 'openai', engine: 'chatgpt', fallback: true, error: 'timeout' } }),
	{ brand: '선샤인클리닉' },
);
assert('unusable stays empty mention', unusable.mentioned === false && unusable.recommended === false);

const record = toAsiQueryProbeRecord(response(), { runId: 'run_1', brand: '선샤인클리닉' });
assert(
	'record shape',
	Boolean(record.runId && record.timestamp && record.query && record.provider && record.response.answer && record.extracted.mentioned),
);

assert(
	'normalize cap',
	normalizeProbeQueries(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']).length === ASI_QUERY_PROBE_MAX,
);
assert('normalize dedupe', normalizeProbeQueries(['대구 피부과 추천', '대구 피부과 추천', ' 대구 피부과 추천 ']).length === 1);

const built = buildAsiQueryRun({
	runId: 'run_built',
	siteUrl: 'https://sunshineclinic.kr',
	brand: '선샤인클리닉',
	queries: ['대구 피부과 추천'],
	responses: [response(), response({ provider: 'gemini' })],
});
assert('built run id', built.runId === 'run_built');
assert('built two providers', built.records.length === 2 && built.records.every((item) => item.runId === 'run_built'));

const previous = runFrom(
	[
		{
			runId: 'run_old',
			timestamp: '2026-08-29T00:00:00.000Z',
			query: '대구 피부과 추천',
			provider: 'chatgpt',
			response: { answer: '이전', source: 'live', fallback: false },
			extracted: extract({ mentioned: false, recommended: false, rank: 3, mentionType: 'none' }),
		},
	],
	{ runId: 'run_old' },
);
const current = runFrom(
	[
		{
			runId: 'run_new',
			timestamp: '2026-08-30T00:00:00.000Z',
			query: '대구 피부과 추천',
			provider: 'chatgpt',
			response: { answer: '현재', source: 'live', fallback: false },
			extracted: extract({ mentioned: true, recommended: true, rank: 1, mentionType: 'recommended' }),
		},
	],
	{ runId: 'run_new' },
);
const delta = compareAsiQueryRuns(current, previous)[0];
assert('mention changed', delta.mentionChanged === true);
assert('recommend changed', delta.recommendChanged === true);
assert('rank improved', delta.rankDelta === 2);

const firstStore = appendAsiQueryRun('sunshineclinic.kr', current);
assert('store has no previous on first run', firstStore.previous === null);
const secondStore = appendAsiQueryRun('sunshineclinic.kr', { ...current, runId: 'run_newer', timestamp: '2026-08-30T01:00:00.000Z' });
assert('store keeps previous', secondStore.previous?.runId === 'run_new');
assert('compare against stored previous', secondStore.compare[0].previous?.mentioned === true);

const mockSnap = buildMockEvidenceSnapshot({ url: 'https://sunshineclinic.kr' });
assert('mock snapshot has empty probe', mockSnap?.queryProbe.current === null);

void mockAsiEngine
	.loadEvidence({
		url: 'https://sunshineclinic.kr',
		probeQueries: true,
		queries: ['대구 피부과 추천', '대구 동구 피부과 추천'],
	})
	.then(async (first) => {
		assert('mock probe has run', Boolean(first?.queryProbe.current?.runId));
		assert(
			'mock probe records complete',
			Boolean(
				first?.queryProbe.current?.records.every(
					(item) => item.runId && item.timestamp && item.query && item.provider && typeof item.response.answer === 'string' && item.extracted,
				),
			),
		);
		assert('mock probe two queries four providers', first?.queryProbe.current?.records.length === 8);
		const again = await mockAsiEngine.loadEvidence({
			url: 'https://sunshineclinic.kr',
			probeQueries: true,
			queries: ['대구 피부과 추천', '대구 동구 피부과 추천'],
		});
		assert('rerun keeps previous', again?.queryProbe.previous?.runId === first?.queryProbe.current?.runId);
		assert('rerun compare rows', (again?.queryProbe.compare.length ?? 0) === 8);
		clearAsiQueryRuns();
		if (failed) {
			console.error(`\n${failed} failed`);
			process.exit(1);
		}
		console.log('\nall passed');
	});
