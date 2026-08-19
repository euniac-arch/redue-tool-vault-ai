/**
 * 4-tier AI grounding evaluator.
 * Run: npx tsx scripts/test-ai-grounding-evaluator.ts
 */
import {
	evaluateAiGroundingResponse,
	GROUNDING_STATUS_LABEL,
} from '../lib/audit/ai-grounding-evaluator';
import { buildLiveEngineResult, parseLiveCheckPayload } from '../lib/audit/live-check-score';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const BRAND = '스카이피부과의원';
const DOMAIN = 'https://sky-clinic.com';
const TECHNICAL = 64;

/* --------------------------------------------------------------------------
 * Case A: Perplexity weak-caveat answer must NOT jump to 98.
 * -------------------------------------------------------------------------- */
const caseAText = [
	'국내 중입자 치료는 서울대병원·국립암센터가 주로 노출됩니다.',
	`${BRAND}(${DOMAIN})이 직접 추천된 정황은 약합니다.`,
].join(' ');
const caseA = evaluateAiGroundingResponse('perplexity', TECHNICAL, caseAText, BRAND, DOMAIN);
assert('Case A engine name is Perplexity', caseA.engineName === 'Perplexity');
assert('Case A is TIER 3 WEAK', caseA.tier === 'WEAK');
assert('Case A liveScore is ~65 (technical ± 5)', caseA.liveScore === 65, `got ${caseA.liveScore}`);
assert(
	'Case A label is weak-signal',
	caseA.statusLabel === GROUNDING_STATUS_LABEL.WEAK && caseA.statusColor === 'yellow',
);
assert('Case A records a weakness reason', Boolean(caseA.weaknessReasons?.length));

const caseAJudgeJson = JSON.stringify({
	isCited: true,
	mentionType: 'recommended',
	rank: 1,
	evidenceSnippet: `${BRAND}이 직접 추천된 정황은 약합니다`,
	citationUrl: DOMAIN,
});
const caseAParsed = parseLiveCheckPayload(caseAJudgeJson, BRAND, DOMAIN, [DOMAIN]);
const caseAResult = buildLiveEngineResult('perplexity', caseAParsed, TECHNICAL, {
	rawResponseText: caseAJudgeJson,
	targetBrand: BRAND,
	targetDomain: DOMAIN,
	citationCandidates: [DOMAIN],
});
assert(
	'Case A judge rank=1 still demotes to WEAK ~65',
	caseAResult.tier === 'WEAK' && caseAResult.liveScore === 65 && caseAResult.liveScore < 90,
	`tier=${caseAResult.tier} score=${caseAResult.liveScore}`,
);

/* --------------------------------------------------------------------------
 * Case B: Claude specialist-institution wording is TIER 1 / 98.
 * -------------------------------------------------------------------------- */
const caseBText = `${BRAND}은 해외 중입자 치료 상담을 제공하는 전문 기관입니다. ${DOMAIN}`;
const caseB = evaluateAiGroundingResponse('claude', TECHNICAL, caseBText, BRAND, DOMAIN);
assert('Case B engine name is Claude', caseB.engineName === 'Claude');
assert('Case B is TIER 1 STRONG', caseB.tier === 'STRONG');
assert('Case B liveScore is 98', caseB.liveScore === 98, `got ${caseB.liveScore}`);
assert(
	'Case B label is top recommendation',
	caseB.statusLabel === GROUNDING_STATUS_LABEL.STRONG && caseB.statusColor === 'green',
);

/* --------------------------------------------------------------------------
 * Case C: ChatGPT / Gemini simple URL listing is TIER 2 / 80.
 * -------------------------------------------------------------------------- */
const caseCText = ['관련 참고 링크:', `- ${DOMAIN}`, '- https://other-clinic.example/info'].join('\n');
const caseCChat = evaluateAiGroundingResponse('chatgpt', TECHNICAL, caseCText, BRAND, DOMAIN);
const caseCGemini = evaluateAiGroundingResponse('gemini', TECHNICAL, caseCText, BRAND, DOMAIN);
assert('Case C ChatGPT is TIER 2 NEUTRAL', caseCChat.tier === 'NEUTRAL');
assert('Case C Gemini is TIER 2 NEUTRAL', caseCGemini.tier === 'NEUTRAL');
assert('Case C ChatGPT liveScore is 80', caseCChat.liveScore === 80, `got ${caseCChat.liveScore}`);
assert('Case C Gemini liveScore is 80', caseCGemini.liveScore === 80, `got ${caseCGemini.liveScore}`);
assert(
	'Case C label is official entity citation',
	caseCChat.statusLabel === GROUNDING_STATUS_LABEL.NEUTRAL && caseCChat.statusColor === 'blue',
);

/* --------------------------------------------------------------------------
 * Extra guards: not found keeps technical score; strong keywords beat rankless mention.
 * -------------------------------------------------------------------------- */
const missing = evaluateAiGroundingResponse(
	'chatgpt',
	TECHNICAL,
	'해당 질의에 대한 추천 기관을 특정하기 어렵습니다.',
	BRAND,
	DOMAIN,
);
assert('NOT_FOUND keeps technical score', missing.tier === 'NOT_FOUND' && missing.liveScore === TECHNICAL);
assert('NOT_FOUND label is 미노출', missing.statusLabel === GROUNDING_STATUS_LABEL.NOT_FOUND);

const allEngines = ['chatgpt', 'perplexity', 'claude', 'gemini'] as const;
for (const engine of allEngines) {
	const weak = evaluateAiGroundingResponse(engine, TECHNICAL, caseAText, BRAND, DOMAIN);
	const strong = evaluateAiGroundingResponse(engine, TECHNICAL, caseBText, BRAND, DOMAIN);
	const neutral = evaluateAiGroundingResponse(engine, TECHNICAL, caseCText, BRAND, DOMAIN);
	assert(`${engine} weak is 65`, weak.tier === 'WEAK' && weak.liveScore === 65);
	assert(`${engine} strong is 98`, strong.tier === 'STRONG' && strong.liveScore === 98);
	assert(`${engine} neutral is 80`, neutral.tier === 'NEUTRAL' && neutral.liveScore === 80);
}

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall AI grounding evaluator assertions passed');
