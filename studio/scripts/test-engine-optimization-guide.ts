/**
 * Engine-specific Level 3 lift guides.
 * Run: npx tsx scripts/test-engine-optimization-guide.ts
 */
import { buildEngineOptimizationGuide } from '../lib/geo/engine-optimization-guide';
import { buildSiteReachState } from '../lib/geo/site-reach-state';
import { buildPrescriptionAfterReport } from '../lib/geo/prescription-after';
import { AI_ENGINE_CATALOG, AI_ENGINE_IDS, enginesFromMap } from '../types/geo-diagnostic';
import type { GeoDiagnosticReport } from '../types/geo-diagnostic';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`, detail ?? '');
}

const location = '서울특별시 서초구';
const category = '중입자치료';
const specialties = ['중입자치료', '암치료 상담'];
const brand = '한국중입자 암치료연구소';

for (const engineId of AI_ENGINE_IDS) {
	const guide = buildEngineOptimizationGuide({
		engineId,
		currentLevel: 2,
		lang: 'ko',
		location,
		category,
		specialties,
		needSignals: ['상담'],
		brandName: brand,
	});

	assert(`${engineId} targets Level 3`, guide.targetLevel === 3 && guide.currentLevel === 2);
	assert(`${engineId} has a Level 3 query`, guide.level3OptimizedQuery.length > 8);
	assert(`${engineId} query is unbranded`, !guide.level3OptimizedQuery.includes(brand));
	assert(`${engineId} strips 특별시`, !guide.level3OptimizedQuery.includes('특별시'));
	assert(`${engineId} has keyword combos`, guide.level3KeywordCombos.length >= 2);
	assert(`${engineId} has prescription tips`, guide.prescriptionTips.length >= 3);
	assert(`${engineId} has characteristics`, guide.engineCharacteristics.length > 20);
}

const gemini = buildEngineOptimizationGuide({
	engineId: 'gemini',
	currentLevel: 2,
	lang: 'ko',
	location,
	category,
	specialties,
	brandName: brand,
});
assert('Gemini uses local pattern', gemini.queryPattern === 'local');
assert('Gemini query is district/local conversational', /서초구/.test(gemini.level3OptimizedQuery) && /추천해줘|예약/.test(gemini.level3OptimizedQuery));

const clova = buildEngineOptimizationGuide({
	engineId: 'clova',
	currentLevel: 2,
	lang: 'ko',
	location,
	category,
	specialties,
	brandName: brand,
});
assert('Clova uses local pattern', clova.queryPattern === 'local');
assert('Clova query is spoken local', /서초구/.test(clova.level3OptimizedQuery) && /어디야|알려줘/.test(clova.level3OptimizedQuery));

const claude = buildEngineOptimizationGuide({
	engineId: 'claude',
	currentLevel: 2,
	lang: 'ko',
	location,
	category,
	specialties,
	brandName: brand,
});
assert('Claude uses metro pattern', claude.queryPattern === 'metro');
assert('Claude query is metro specialist', /서울/.test(claude.level3OptimizedQuery) && /전문/.test(claude.level3OptimizedQuery));

const chatgpt = buildEngineOptimizationGuide({
	engineId: 'chatgpt',
	currentLevel: 2,
	lang: 'ko',
	location,
	category,
	specialties,
	brandName: brand,
});
assert('ChatGPT uses nationwide pattern', chatgpt.queryPattern === 'nationwide');
assert('ChatGPT query is conversational recommend', /추천해줘/.test(chatgpt.level3OptimizedQuery));

const perplexity = buildEngineOptimizationGuide({
	engineId: 'perplexity',
	currentLevel: 2,
	lang: 'ko',
	location,
	category,
	specialties,
	needSignals: ['상담'],
	brandName: brand,
});
assert('Perplexity uses nationwide pattern', perplexity.queryPattern === 'nationwide');
assert('Perplexity query asks for official sources', /공식 후기/.test(perplexity.level3OptimizedQuery));

function stubBrandOnlyReport(): GeoDiagnosticReport {
	const l1 = `${brand} 위치`;
	return {
		caseId: 'low',
		caseLabel: 'as-is brand only',
		targetUrl: 'https://particle-care.example.com',
		domain: 'particle-care.example.com',
		brandName: brand,
		generatedAt: new Date().toISOString(),
		triggerQueries: { 1: l1, 2: `서울 서초구 ${category}`, 3: `서울 서초구 ${category} 추천` },
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

const before = stubBrandOnlyReport();
const after = buildPrescriptionAfterReport(before, 'ko', {
	location: '서울 서초구',
	category,
	targetKeywords: specialties,
});
const state = buildSiteReachState({
	before,
	after,
	isPrescriptionApplied: true,
	lang: 'ko',
	location: '서울 서초구',
	specialties,
	category,
});

const toBeL2 = AI_ENGINE_IDS.filter((id) => state.toBe.engines[id].level === 2);
assert('To-Be still has Level 2 engines (Gemini/Clova path)', toBeL2.length >= 2, toBeL2);
for (const id of toBeL2) {
	const guide = state.toBe.engines[id].optimizationGuide;
	assert(`${id} To-Be L2 ships a Level 3 guide`, Boolean(guide && guide.targetLevel === 3 && guide.level3OptimizedQuery));
	assert(`${id} To-Be L2 guide currentLevel is 2`, guide?.currentLevel === 2);
}

const afterGemini = after.engines.find((engine) => engine.engine.id === 'gemini');
assert(
	'After-report Gemini keeps a Level 3 guide when stuck at L2',
	afterGemini?.depthLevel === 2 &&
		afterGemini.optimizationGuide?.targetLevel === 3 &&
		Boolean(afterGemini.optimizationGuide?.level3OptimizedQuery),
	afterGemini?.optimizationGuide,
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall engine-optimization-guide assertions passed');
