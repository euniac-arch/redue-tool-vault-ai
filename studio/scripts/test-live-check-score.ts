/**
 * Live-check scoring / query / citation helpers.
 * Run: npx tsx scripts/test-live-check-score.ts
 */
import {
	buildFailedLiveResult,
	buildLiveEngineResult,
	computeLiveScore,
	computeReachLevel,
	detectCitedRank,
	DEFAULT_CITED_SNIPPET,
	DEFAULT_UNCITED_SNIPPET,
	extractJsonFromText,
	extractJsonObject,
	LiveCheckParseError,
	looksLikeRawJson,
	mentionsBrandOrSite,
	parseLLMResponse,
	parseLiveCheckPayload,
	resolveLiveCheckQuery,
	sanitizeEvidenceSnippet,
	urlMatchesSite,
} from '../lib/audit/live-check-score';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('query prefers targetKeyword', resolveLiveCheckQuery({ targetKeyword: '부산 동래 피부과 추천' }) === '부산 동래 피부과 추천');
assert(
	'query falls back to category 추천',
	resolveLiveCheckQuery({ category: '피부과' }) === '피부과 추천',
);
assert('query empty category uses 해당 업종', resolveLiveCheckQuery({}) === '해당 업종 추천');

assert('rank 1 score is 98', computeLiveScore({ isCited: true, rank: 1, hasCitationUrl: true, ruleScore: 40 }).liveScore === 98);
assert('rank 2 score is 95', computeLiveScore({ isCited: true, rank: 2, hasCitationUrl: false, ruleScore: 40 }).liveScore === 95);
assert('rank 3 stays in TIER 2 band', computeLiveScore({ isCited: true, rank: 3, hasCitationUrl: true, ruleScore: 40 }).liveScore === 85);
assert(
	'cited mention stays 75-80',
	(() => {
		const score = computeLiveScore({ isCited: true, rank: null, hasCitationUrl: false, ruleScore: 60 }).liveScore;
		return score >= 75 && score <= 85;
	})(),
);
assert(
	'uncited keeps technical readiness score',
	(() => {
		const low = computeLiveScore({ isCited: false, rank: null, hasCitationUrl: false, ruleScore: 0 }).liveScore;
		const high = computeLiveScore({ isCited: false, rank: null, hasCitationUrl: false, ruleScore: 100 }).liveScore;
		return low === 0 && high === 100;
	})(),
);
assert(
	'API failure keeps rule score',
	computeLiveScore({ isCited: false, rank: null, hasCitationUrl: false, ruleScore: 72, failed: true }).liveScore === 72 &&
		computeLiveScore({ isCited: false, rank: null, hasCitationUrl: false, ruleScore: 72, failed: true }).fallbackToRuleScore,
);

assert('Level 3 needs cite + URL', computeReachLevel(true, 'https://example.com') === 'Level 3');
assert('Level 2 is cite without URL', computeReachLevel(true) === 'Level 2');
assert('Level 1 is uncited', computeReachLevel(false) === 'Level 1');

assert('mentions brand', mentionsBrandOrSite('스카이피부과의원을 추천합니다', '스카이피부과의원', 'https://sky-clinic.com'));
assert('url matches site', urlMatchesSite('https://www.sky-clinic.com/about', 'https://sky-clinic.com'));
assert('detects 1위', detectCitedRank('1위는 스카이피부과의원입니다', '스카이피부과의원', 'https://sky-clinic.com') === 1);

const parsed = parseLiveCheckPayload(
	'```json\n{"isCited":true,"rank":2,"evidenceSnippet":"2위로 스카이피부과의원을 언급","citationUrl":"https://sky-clinic.com"}\n```',
	'스카이피부과의원',
	'https://sky-clinic.com',
);
assert('parses fenced JSON', parsed.isCited && parsed.rank === 2 && parsed.citationUrl === 'https://sky-clinic.com');
assert('extractJsonObject ignores prose', Boolean(extractJsonObject('note {"isCited":false,"rank":null,"evidenceSnippet":"없음"} extra')));

const leakedJson = parseLiveCheckPayload(
	'{"isCited": false, "rank": null,',
	'스카이피부과의원',
	'https://sky-clinic.com',
);
assert(
	'truncated JSON does not leak raw keys',
	!leakedJson.evidenceSnippet.includes('isCited') &&
		!leakedJson.evidenceSnippet.includes('{') &&
		leakedJson.evidenceSnippet === DEFAULT_UNCITED_SNIPPET,
);

const missingSnippet = parseLiveCheckPayload(
	'{"isCited":false,"rank":null}',
	'스카이피부과의원',
	'https://sky-clinic.com',
);
assert(
	'JSON without evidenceSnippet uses Korean fallback',
	missingSnippet.evidenceSnippet === DEFAULT_UNCITED_SNIPPET && !missingSnippet.isCited,
);

const citedNoSnippet = parseLiveCheckPayload(
	'{"isCited":true,"rank":1}',
	'스카이피부과의원',
	'https://sky-clinic.com',
);
assert(
	'cited JSON without snippet uses cited Korean fallback',
	citedNoSnippet.isCited && citedNoSnippet.evidenceSnippet === DEFAULT_CITED_SNIPPET,
);

const reasonOnly = parseLLMResponse('```json\n{"isCited":false,"rank":null,"reason":"공식 사이트 링크가 검색 결과에 없습니다."}\n```');
assert('parseLLMResponse reads reason field', reasonOnly.evidenceSnippet === '공식 사이트 링크가 검색 결과에 없습니다.');

assert('looksLikeRawJson detects leaked payload', looksLikeRawJson('{"isCited": false, "rank": null,'));
assert(
	'sanitizeEvidenceSnippet strips JSON punctuation',
	sanitizeEvidenceSnippet('{"isCited": false, "rank": null, "evidenceSnippet":', false) === DEFAULT_UNCITED_SNIPPET,
);

const failedResult = buildFailedLiveResult('gemini', 61, 'timeout');
assert('failed result is not grounded', failedResult.isLiveGrounded === false && failedResult.fallbackToRuleScore === true && failedResult.liveScore === 61);

const live = buildLiveEngineResult(
	'chatgpt',
	{ isCited: true, mentionType: 'recommended', rank: 1, evidenceSnippet: '1위로 추천', citationUrl: 'https://sky-clinic.com' },
	40,
);
assert('live result is grounded Level 3', live.isLiveGrounded && live.reachLevel === 'Level 3' && live.liveScore === 98);

/* --------------------------------------------------------------------------
 * Regression tests for the reported bugs:
 * 1) ChatGPT false-positive on negated mentions ("언급되지 않았습니다" -> 98점)
 * 2) Gemini markdown/preamble JSON parse failures ("Here is the JSON requested: ```")
 * 3) mentionType-based score/verdict guards
 * 4) Perplexity/Claude normal citation case still yields 98 + URL
 * ------------------------------------------------------------------------ */

// Bug 1: naive substring match used to flip a correct isCited:false to true
// just because the brand name appeared inside a negated sentence.
assert(
	'negated mention is NOT counted as a positive mention',
	!mentionsBrandOrSite('나인원의원이 언급되지 않았습니다.', '나인원의원', 'https://nineone-clinic.com'),
);
assert(
	'English negation is NOT counted as a positive mention',
	!mentionsBrandOrSite('Sky Clinic is not mentioned in the response.', 'Sky Clinic', 'https://sky-clinic.com'),
);
assert(
	'positive mention still detected when there is no negation cue',
	mentionsBrandOrSite('나인원의원을 추천합니다.', '나인원의원', 'https://nineone-clinic.com'),
);

const negatedInsideJson = parseLiveCheckPayload(
	'{"isCited":false,"mentionType":"none","rank":null,"evidenceSnippet":"나인원의원이 언급되지 않았습니다.","citationUrl":""}',
	'나인원의원',
	'https://nineone-clinic.com',
);
assert(
	'ChatGPT bug: negated evidenceSnippet never flips isCited to true',
	!negatedInsideJson.isCited && negatedInsideJson.mentionType === 'none',
);
const negatedResult = buildLiveEngineResult('chatgpt', negatedInsideJson, 40);
assert(
	'ChatGPT bug: negated mention never scores in the passing (90s) band',
	!negatedResult.isCited && negatedResult.liveScore === 40 && negatedResult.tier === 'NOT_FOUND',
);

// Bug 2: Gemini wraps JSON in a preamble / markdown fence, sometimes truncated.
const geminiWithPreamble = extractJsonFromText(
	'Here is the JSON requested:\n```json\n{"isCited":true,"mentionType":"recommended","rank":1,"evidenceSnippet":"1위 추천 확인","citationUrl":"https://sky-clinic.com"}\n```',
);
assert(
	'extractJsonFromText parses JSON despite a leading preamble + markdown fence',
	Boolean(geminiWithPreamble) && geminiWithPreamble?.isCited === true && geminiWithPreamble?.rank === 1,
);

const geminiTruncatedFence = extractJsonFromText(
	'Here is the JSON requested: ```json\n{"isCited":true,"mentionType":"recommended","rank":2,"evidenceSnippet":"2위로 추천',
);
assert(
	'extractJsonFromText repairs a truncated/unclosed fenced JSON object',
	Boolean(geminiTruncatedFence) && geminiTruncatedFence?.isCited === true && geminiTruncatedFence?.rank === 2,
);

assert(
	'extractJsonFromText returns null when there is no JSON at all',
	extractJsonFromText('Here is the JSON requested: ```') === null,
);

let threwParseError = false;
try {
	parseLLMResponse('나인원의원이 언급되지 않았습니다.');
} catch (err) {
	threwParseError = err instanceof LiveCheckParseError;
}
assert('pure prose with zero JSON throws LiveCheckParseError (treated as a real failure)', threwParseError);

// Bug 3: mentionType guards — isMentioned:false (or "none") can never earn a
// passing score, and a bare mention can never reach the 90-point tier.
assert(
	'mentionType none keeps technical score and never becomes a live recommendation',
	computeLiveScore({ isCited: true, rank: 1, hasCitationUrl: true, ruleScore: 90, mentionType: 'none' }).liveScore === 90,
);
assert(
	'mentionType simple_mention is capped in the 75-85 TIER 2 band',
	computeLiveScore({ isCited: true, rank: null, hasCitationUrl: false, ruleScore: 90, mentionType: 'simple_mention' }).liveScore === 75,
);

// Bug 4: normal Perplexity/Claude citation case (fenced JSON, rank 1, matching
// URL) must still yield the 98-point pass and extract the citation URL.
const normalCitation = parseLiveCheckPayload(
	'```json\n{"isCited":true,"mentionType":"recommended","rank":1,"evidenceSnippet":"공식 사이트가 1위로 인용됨","citationUrl":"https://sky-clinic.com/about"}\n```',
	'스카이피부과의원',
	'https://sky-clinic.com',
	['https://sky-clinic.com/about'],
);
const normalCitationResult = buildLiveEngineResult('perplexity', normalCitation, 40);
assert(
	'Perplexity/Claude normal citation keeps 98점 + citation URL',
	normalCitationResult.isCited && normalCitationResult.liveScore === 98 && normalCitationResult.citationUrl === 'https://sky-clinic.com/about',
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall live-check score assertions passed');
