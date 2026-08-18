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
	extractJsonObject,
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
assert('rank 2 score is 93', computeLiveScore({ isCited: true, rank: 2, hasCitationUrl: false, ruleScore: 40 }).liveScore === 93);
assert('rank 3 score is 88', computeLiveScore({ isCited: true, rank: 3, hasCitationUrl: true, ruleScore: 40 }).liveScore === 88);
assert(
	'cited mention stays 75-84',
	(() => {
		const score = computeLiveScore({ isCited: true, rank: null, hasCitationUrl: false, ruleScore: 60 }).liveScore;
		return score >= 75 && score <= 84;
	})(),
);
assert(
	'uncited maps rule score into 15-35',
	(() => {
		const low = computeLiveScore({ isCited: false, rank: null, hasCitationUrl: false, ruleScore: 0 }).liveScore;
		const high = computeLiveScore({ isCited: false, rank: null, hasCitationUrl: false, ruleScore: 100 }).liveScore;
		return low === 15 && high === 35;
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
	{ isCited: true, rank: 1, evidenceSnippet: '1위로 추천', citationUrl: 'https://sky-clinic.com' },
	40,
);
assert('live result is grounded Level 3', live.isLiveGrounded && live.reachLevel === 'Level 3' && live.liveScore === 98);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall live-check score assertions passed');
