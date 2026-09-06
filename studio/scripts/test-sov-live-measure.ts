/**
 * Live SoV scoring — fuzzy brand stems, snippet parse, CTA bands.
 * Run: npx tsx scripts/test-sov-live-measure.ts
 */
import {
	collectBrandStems,
	parseLiveLlmPayload,
	resolveOwnRank,
	resolveSovResultCta,
	scoreLiveRecommendations,
	textMentionsBrand,
} from '../lib/audit/sov-live-measure';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

const stems = collectBrandStems('나인원의원');
assert('stem keeps full name', stems.includes('나인원의원'));
assert('stem strips 의원', stems.includes('나인원'));
assert('fuzzy hit on 나인원 피부과', textMentionsBrand('나인원 피부과', stems));
assert('fuzzy hit on spaced name', textMentionsBrand('나인원 의원', stems));
assert('no false hit on unrelated clinic', !textMentionsBrand('서울피부과의원', stems));

const recs = [
	{ rank: 1, name: '나인원 피부과', reason: '리뷰가 안정적', isClient: false },
	{ rank: 2, name: '다른의원', reason: '접근성', isClient: false },
	{ rank: 3, name: '세번째클리닉', reason: '가격', isClient: false },
];
assert('own rank from stem in name', resolveOwnRank(recs, stems) === 1);

const snippetOnly = resolveOwnRank(
	[{ rank: 1, name: '다른의원', reason: '리뷰', isClient: false }],
	stems,
	'근처라면 나인원도 함께 고려할 수 있습니다.',
);
assert('snippet-only mention counts as rank 3', snippetOnly === 3);

const parsed = parseLiveLlmPayload(`{
  "recommendations": [
    { "rank": 1, "name": "알파의원", "reason": "후기가 많음" }
  ],
  "recommendationSnippet": "이 지역에서는 알파의원을 먼저 찾는 경우가 많습니다.\\n두 번째는 베타클리닉입니다."
}`);
assert('parses snippet field', parsed.recommendationSnippet.includes('알파의원'));

const scored = scoreLiveRecommendations({
	query: '지역 피부과 추천',
	index: 0,
	recommendations: recs,
	targetBrand: '나인원의원',
	brandTokens: ['나인원'],
	recommendationSnippet: '나인원 피부과를 가장 먼저 추천합니다.',
});
assert('scored slice keeps snippet', scored.recommendationSnippet.includes('나인원'));
assert('fuzzy own rank 1', scored.ownRank === 1);
assert('defend CTA at rank 1 / high SoV', resolveSovResultCta(1, 88) === 'defend');
assert('recover CTA at rank 2', resolveSovResultCta(2, 35) === 'recover');
assert('recover CTA when missing', resolveSovResultCta(0, 4) === 'recover');
assert('recover CTA when SoV under 30', resolveSovResultCta(1, 20) === 'recover');

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');
