/**
 * Verifies owner-facing GEO conversion copy stays site-agnostic.
 * Run: npx tsx scripts/test-business-conversion.ts
 */
import {
	buildBusinessConversionModel,
	pickTargetQuery,
} from '../lib/audit/business-conversion';
import { AI_ENGINE_CATALOG, enginesFromMap } from '../types/geo-diagnostic';
import type { AIEngineTestResult } from '../types/geo-diagnostic';

function stubEngine(depth: 1 | 2 | 3 | null, id: keyof typeof AI_ENGINE_CATALOG): AIEngineTestResult {
	const engine = AI_ENGINE_CATALOG[id];
	const base = {
		engine,
		score: depth === 3 ? 88 : depth === 2 ? 68 : 38,
		triggerQuery: 'test',
		simulatedResponse: '',
		improvementTip: '',
	};
	if (depth === 3) return { ...base, statusBadge: 'optimal', depthLevel: 3 };
	if (depth === 2) return { ...base, statusBadge: 'moderate', depthLevel: 2 };
	if (depth === 1) return { ...base, statusBadge: 'exact_only', depthLevel: 1 };
	return { ...base, statusBadge: 'not_indexed', depthLevel: null };
}

const ids = ['chatgpt', 'gemini', 'claude', 'perplexity', 'copilot', 'clova'] as const;

let failed = 0;

const medical = buildBusinessConversionModel({
	brandName: '한국중입자 암치료연구소',
	category: '해외 중입자 치료 상담',
	location: '서울 서초구',
	primaryKeyword: '암치료',
	targetKeywords: ['암치료', '중입자', '상담'],
	triggerQueries: {
		1: '한국중입자 암치료연구소',
		2: '서울 서초구 암치료',
		3: '서초구 암치료 추천해줘',
	},
	industryType: 'MEDICAL',
	engines: enginesFromMap({
		chatgpt: stubEngine(1, 'chatgpt'),
		gemini: stubEngine(1, 'gemini'),
		claude: stubEngine(1, 'claude'),
		perplexity: stubEngine(null, 'perplexity'),
		copilot: stubEngine(1, 'copilot'),
		clova: stubEngine(1, 'clova'),
	}),
	lang: 'ko',
});

const medicalOk =
	medical.brandName === '한국중입자 암치료연구소' &&
	medical.targetQuery === '서울 서초구 암치료' &&
	medical.leakageTone === 'critical' &&
	medical.showLeakageBadge === true &&
	medical.monthlyValueManwon >= 50 &&
	medical.monthlyValueManwon <= 480 &&
	medical.monthlyLossKrw === medical.monthlyValueManwon * 10_000 &&
	medical.cpcKrw > 0 &&
	medical.monthlySearchVolume > 0 &&
	medical.citationGapPct === 43 &&
	medical.brandSharePct === 5 &&
	medical.competitorSharePct === 48 &&
	medical.targetKeywords.includes('암치료') &&
	!medical.targetKeywords.includes('한국중입자 암치료연구소');
if (!medicalOk) failed += 1;
console.log(JSON.stringify({ case: 'medical-level1', ...medical, ok: medicalOk }));

const local = buildBusinessConversionModel({
	brandName: '한빛학원',
	category: '수학 학원',
	location: '부산 해운대',
	primaryKeyword: '수학 학원',
	targetKeywords: ['수학 학원', '입시'],
	triggerQueries: { 1: '한빛학원', 2: '부산 해운대 수학 학원', 3: '해운대 수학 학원 추천' },
	industryType: 'LOCAL_STORE',
	engines: ids.map((id, i) => stubEngine(i < 3 ? 2 : 1, id)),
	lang: 'ko',
});

const localOk =
	local.targetQuery === '부산 해운대 수학 학원' &&
	local.leakageTone === 'partial' &&
	local.showLeakageBadge === false &&
	local.monthlyValueManwon < medical.monthlyValueManwon;
if (!localOk) failed += 1;
console.log(JSON.stringify({ case: 'local-partial', ...local, ok: localOk }));

const captured = buildBusinessConversionModel({
	brandName: '레드유',
	category: 'GEO 컨설팅',
	location: '서울',
	primaryKeyword: 'GEO 컨설팅',
	industryType: 'B2B_MFG',
	engines: ids.map((id) => stubEngine(3, id)),
	lang: 'ko',
});

const capturedOk =
	captured.leakageTone === 'captured' &&
	captured.showLeakageBadge === false &&
	captured.brandSharePct === 40 &&
	captured.citationGapPct === 8;
if (!capturedOk) failed += 1;
console.log(JSON.stringify({ case: 'captured', ...captured, ok: capturedOk }));

const query = pickTargetQuery({
	location: '강남',
	primaryKeyword: '법률상담',
	brandName: '정의로펌',
	lang: 'ko',
});
const queryOk = query === '강남 법률상담';
if (!queryOk) failed += 1;
console.log(JSON.stringify({ case: 'composed-query', query, ok: queryOk }));

if (failed) {
	console.error(`failed: ${failed}`);
	process.exit(1);
}
console.log('business-conversion ok');
