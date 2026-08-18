/**
 * SiteReachState — header Query Reach + As-Is/To-Be cards share one snapshot.
 * Run: npx tsx scripts/test-site-reach-state.ts
 */
import { buildPrescriptionAfterReport } from '../lib/geo/prescription-after';
import { queryContainsBrand, buildSiteReachState, projectEngineForQueryLevel } from '../lib/geo/site-reach-state';
import { AI_ENGINE_CATALOG, AI_ENGINE_IDS, enginesFromMap } from '../types/geo-diagnostic';
import type { GeoDiagnosticReport } from '../types/geo-diagnostic';
import { activeReachSlice, reachEngineList } from '../types/site-reach';

function assert(label: string, cond: boolean, detail?: unknown) {
	if (!cond) {
		console.error(`FAIL ${label}`, detail ?? '');
		process.exitCode = 1;
		return;
	}
	console.log(`ok  ${label}`);
}

function stubBrandOnlyReport(brand: string, location: string, specialty: string): GeoDiagnosticReport {
	const l1 = `${brand} 위치`;
	const l2 = `${location} ${specialty}`;
	const l3 = `${location} ${specialty} 추천`;
	return {
		caseId: 'low',
		caseLabel: 'as-is brand only',
		targetUrl: 'https://sunshineclinic.kr',
		domain: 'sunshineclinic.kr',
		brandName: brand,
		generatedAt: new Date().toISOString(),
		triggerQueries: { 1: l1, 2: l2, 3: l3 },
		engines: enginesFromMap({
			chatgpt: {
				engine: AI_ENGINE_CATALOG.chatgpt,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 38,
				triggerQuery: l1,
				simulatedResponse: `${brand} 공식 사이트`,
				improvementTip: '',
			},
			gemini: {
				engine: AI_ENGINE_CATALOG.gemini,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 36,
				triggerQuery: l1,
				simulatedResponse: `${brand} 위치 핀`,
				improvementTip: '',
			},
			claude: {
				engine: AI_ENGINE_CATALOG.claude,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 34,
				triggerQuery: l1,
				simulatedResponse: `${brand} 상호 검색`,
				improvementTip: '',
			},
			perplexity: {
				engine: AI_ENGINE_CATALOG.perplexity,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 40,
				triggerQuery: l1,
				simulatedResponse: `${brand} 출처`,
				improvementTip: '',
			},
			copilot: {
				engine: AI_ENGINE_CATALOG.copilot,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 32,
				triggerQuery: l1,
				simulatedResponse: `${brand} Bing`,
				improvementTip: '',
			},
			clova: {
				engine: AI_ENGINE_CATALOG.clova,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 30,
				triggerQuery: l1,
				simulatedResponse: `${brand} 플레이스`,
				improvementTip: '',
			},
		}),
	};
}

const brand = '안성햇살의원';
const location = '안성';
const specialty = '피부과';
const before = stubBrandOnlyReport(brand, location, specialty);
const after = buildPrescriptionAfterReport(before, 'ko', {
	location,
	category: specialty,
	targetKeywords: [specialty, '여드름', '레이저'],
});

const state = buildSiteReachState({
	before,
	after,
	isPrescriptionApplied: true,
	lang: 'ko',
	location,
	specialties: [specialty, '여드름', '레이저'],
	category: specialty,
});

assert('as-is is 6× Level 1', state.asIs.level1Count === 6 && state.asIs.level2Count === 0 && state.asIs.level3Count === 0);
assert('as-is recommended is 0/6', state.asIs.recommendedCount === 0);
assert(
	'to-be lifts off brand-only',
	state.toBe.level1Count === 0 && state.toBe.recommendedCount === 6 && state.toBe.level2Count + state.toBe.level3Count === 6,
);
assert('to-be has mixed L2/L3 (example 4+2)', state.toBe.level2Count === 4 && state.toBe.level3Count === 2, {
	l2: state.toBe.level2Count,
	l3: state.toBe.level3Count,
});

for (const engine of reachEngineList(state.asIs)) {
	assert(`${engine.engineName} as-is is Level 1 brand query`, engine.level === 1 && queryContainsBrand(engine.triggerQuery, brand), engine);
}

const toBeQueries = new Set<string>();
for (const engine of reachEngineList(state.toBe)) {
	assert(`${engine.engineName} to-be is Level 2 or 3`, engine.level === 2 || engine.level === 3, engine);
	assert(`${engine.engineName} to-be query is unbranded`, !queryContainsBrand(engine.triggerQuery, brand), engine.triggerQuery);
	assert(`${engine.engineName} to-be query is not the shared brand location`, engine.triggerQuery !== `${brand} 위치`, engine.triggerQuery);
	assert(`${engine.engineName} to-be has a response snippet`, engine.aiResponseSnippet.length > 8);
	toBeQueries.add(engine.triggerQuery);
}

assert('to-be engines are not all the same query', toBeQueries.size >= 2, [...toBeQueries]);

const asIsSlice = activeReachSlice(state, 'asIs');
const toBeSlice = activeReachSlice(state, 'toBe');
assert('active as-is slice matches state.asIs', asIsSlice.level1Count === 6);
assert('active to-be slice matches state.toBe', toBeSlice.recommendedCount === 6);

const preview = buildSiteReachState({
	before,
	lang: 'ko',
	location,
	specialties: [specialty],
	category: specialty,
});
assert('to-be projection exists before apply', preview.toBe.recommendedCount === 6 && preview.toBe.level1Count === 0);
assert(
	'preview to-be queries stay unbranded',
	reachEngineList(preview.toBe).every((engine) => !queryContainsBrand(engine.triggerQuery, brand)),
);

for (const id of AI_ENGINE_IDS) {
	const asIs = state.asIs.engines[id];
	const toBe = state.toBe.engines[id];
	assert(`${id} as-is/to-be queries differ`, asIs.triggerQuery !== toBe.triggerQuery, {
		asIs: asIs.triggerQuery,
		toBe: toBe.triggerQuery,
	});
}

for (const id of AI_ENGINE_IDS) {
	const asIs = state.asIs.engines[id];
	const toBe = state.toBe.engines[id];
	assert(`${id} as-is has byLevel 1–3`, Boolean(asIs.byLevel?.[1] && asIs.byLevel?.[2] && asIs.byLevel?.[3]));
	assert(`${id} to-be has byLevel 1–3`, Boolean(toBe.byLevel?.[1] && toBe.byLevel?.[2] && toBe.byLevel?.[3]));

	const asIsL3 = projectEngineForQueryLevel(asIs, 3);
	assert(`${id} as-is L3 is unreachable (brand-only baseline)`, asIsL3.canReachSelected === false, asIsL3);
	assert(`${id} as-is L3 query is the Level 3 prompt`, asIsL3.triggerQuery === asIs.byLevel?.[3].triggerQuery, asIsL3.triggerQuery);
	assert(`${id} as-is L3 keeps inherent Level 1`, asIsL3.level === 1, asIsL3.level);

	const toBeAtInherent = projectEngineForQueryLevel(toBe, toBe.level);
	assert(`${id} to-be at inherent level is reachable`, toBeAtInherent.canReachSelected === true, toBeAtInherent);
	assert(
		`${id} to-be inherent query matches snapshot`,
		toBeAtInherent.triggerQuery === toBe.triggerQuery,
		{ projected: toBeAtInherent.triggerQuery, inherent: toBe.triggerQuery },
	);
}

const geminiToBe = state.toBe.engines.gemini;
const geminiL3 = projectEngineForQueryLevel(geminiToBe, 3);
if (geminiToBe.level < 3) {
	assert('Gemini To-Be L3 is explicitly unreachable (not leftover L2 success)', geminiL3.canReachSelected === false);
	assert('Gemini To-Be L3 query is the Level 3 prompt', geminiL3.triggerQuery === geminiToBe.byLevel?.[3].triggerQuery);
	assert('Gemini To-Be L3 response is not the L2 success snippet', geminiL3.aiResponseSnippet !== geminiToBe.triggerQuery);
	assert(
		'Gemini To-Be L3 response mentions the L3 query or a defect',
		geminiL3.aiResponseSnippet.includes(geminiL3.triggerQuery) || geminiL3.aiResponseSnippet.length > 8,
		geminiL3.aiResponseSnippet,
	);
}

const chatgptToBe = state.toBe.engines.chatgpt;
const chatgptL3 = projectEngineForQueryLevel(chatgptToBe, 3);
if (chatgptToBe.level === 3) {
	assert('ChatGPT To-Be L3 is reachable', chatgptL3.canReachSelected === true);
	assert('ChatGPT To-Be L3 query is the Level 3 prompt', chatgptL3.triggerQuery === chatgptToBe.byLevel?.[3].triggerQuery);
}

const chatgptL2 = projectEngineForQueryLevel(chatgptToBe, 2);
assert('ChatGPT To-Be L2 stays reachable when inherent is L3', chatgptL2.canReachSelected === true);
assert('ChatGPT To-Be L2 query is the Level 2 prompt', chatgptL2.triggerQuery === chatgptToBe.byLevel?.[2].triggerQuery);

if (process.exitCode) {
	console.error('site-reach-state tests failed');
	process.exit(1);
}
console.log('site-reach-state tests passed');
