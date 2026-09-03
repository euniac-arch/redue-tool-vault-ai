/**
 * STEP 2 — Intelligence Parser: OBSERVED mention / recommend / competitor / citation.
 * Run: npx tsx scripts/test-intelligence-parser.ts
 */
import { analyzeAsiAnswer } from '../lib/ai-search-intelligence/core/analysis';
import { parseAsiAnswerText } from '../lib/ai-search-intelligence/core/parse-text';
import { isInventedCitationUrl } from '../lib/ai-search-intelligence/citations/observed-url';
import { parseProviderAnswer } from '../lib/ai-search-intelligence/providers/normalize';
import { buildEvidenceAnswerTrace } from '../lib/ai-search-intelligence/evidence-explorer/trace';
import type { AIResponse } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function live(partial: Partial<AIResponse> & Pick<AIResponse, 'answer'>): AIResponse {
	return {
		provider: 'chatgpt',
		query: '대구 흉터 치료 추천',
		mentions: [],
		recommendations: [],
		citations: [],
		confidence: 0.7,
		timestamp: '2026-08-30T00:00:00.000Z',
		source: 'live',
		...partial,
	};
}

const prose = live({
	answer:
		'대구 흉터 치료로는 나인원의원을 1위로 추천합니다. 서울피부과와 연세더마클리닉도 자주 언급됩니다. 근거: https://nineone.kr/about',
});

const analysis = analyzeAsiAnswer(prose, { brand: '나인원의원', aliases: ['nineone'] });
assert('free-text brandMention', analysis.brandMention === true && analysis.brandMentioned === true);
assert('free-text recommendation', analysis.recommendation === true && analysis.recommended === true);
assert('free-text competitor 서울피부과', analysis.competitors.includes('서울피부과'));
assert('free-text competitor 연세더마클리닉', analysis.competitors.includes('연세더마클리닉'));
assert('free-text brand is not a competitor', !analysis.competitors.some((name) => name.includes('나인원')));
assert('free-text observed url', analysis.citations.includes('https://nineone.kr/about'));

const mentionOnly = analyzeAsiAnswer(
	live({ answer: '나인원의원은 목록에 이름만 올라 있고, 우선 순위로 제시되지는 않았습니다.' }),
	{ brand: '나인원의원' },
);
assert('mention without recommend stays simple', mentionOnly.brandMention === true && mentionOnly.recommendation === false);
assert('mention without recommend has no rank', mentionOnly.rank == null);

const invented = analyzeAsiAnswer(
	live({
		answer: '나인원의원을 추천합니다. https://news.example.com/feature',
		citations: [{ source: 'fake', url: 'https://news.example.com/feature', type: 'news', relevance: 90, authority: 90 }],
	}),
	{ brand: '나인원의원' },
);
assert('news.example.com is invented', isInventedCitationUrl('https://news.example.com/feature') === true);
assert('invented url is dropped from citations', invented.citations.length === 0);
assert('recommend still observed without url', invented.recommendation === true);

const jsonOnlyFake = parseProviderAnswer(
	JSON.stringify({
		answer: '추천만 있고 링크는 없습니다.',
		mentions: ['나인원의원'],
		recommendations: ['나인원의원'],
		citations: [{ url: 'https://fake.example/nope' }],
	}),
);
assert('parser does not invent json-only url', jsonOnlyFake.citations.length === 0);

const extrasBlocked = parseProviderAnswer('근거 없음', { urls: ['https://news.example.com/feature'] });
assert('grounding dummy extra is dropped', extrasBlocked.citations.length === 0);

const proseRecs = parseProviderAnswer(
	'대구 동구 피부시술로는 나인원의원을 추천합니다. 황금피부과도 자주 언급됩니다. 근거: https://nineone.kr/about',
);
assert('prose fallback keeps recommendations', proseRecs.recommendations.some((name) => name.includes('나인원')));
assert('prose fallback keeps mentions', proseRecs.mentions.some((name) => name.includes('황금피부과')));
assert('prose fallback keeps observed url', proseRecs.citations.some((item) => item.url === 'https://nineone.kr/about'));

const brokenJson = parseProviderAnswer(
	'Here is the result recommendations: ["나인원의원", "황금피부과"] mentions: ["나인원의원"] citations: []',
);
assert(
	'loose field fallback keeps recommendations',
	brokenJson.recommendations.some((name) => name.includes('나인원')),
);

const text = parseAsiAnswerText(
	'1. 서울탑클리닉\n2. 나인원의원\n다른 병원은 제외합니다.',
	{ brand: '나인원의원' },
);
assert('numbered competitor extracted', text.competitors.includes('서울탑클리닉'));
assert('generic 다른 병원 is not a competitor', !text.competitors.some((name) => name.includes('다른')));

const trace = buildEvidenceAnswerTrace({
	response: prose,
	brand: '나인원의원',
	siteUrl: 'https://nineone.kr',
	aliases: ['nineone'],
	location: '대구',
	gaps: [],
});
assert('explorer shows raw answer', trace.answer.includes('나인원의원'));
assert('explorer lists competitors', trace.competitors.includes('서울피부과'));
assert('explorer keeps observed citation', trace.citations.includes('https://nineone.kr/about'));
assert('explorer evidence available when url observed', trace.evidenceAvailable === true);

const emptyTrace = buildEvidenceAnswerTrace({
	response: live({ answer: '나인원의원은 언급됩니다.' }),
	brand: '나인원의원',
	siteUrl: 'https://nineone.kr',
	gaps: [],
});
assert('no url means evidence unavailable', emptyTrace.evidenceAvailable === false && emptyTrace.citations.length === 0);
assert('mention still parsed without citation', emptyTrace.brandMentioned === true);

const clinicCtx = {
	brand: '나인원의원',
	aliases: ['nineone'],
	category: '피부시술',
	industry: '의료',
	services: ['피부시술', '흉터 치료'],
};
const clinicLandmark = analyzeAsiAnswer(
	live({
		answer:
			'동대구역 근처, 메리어트 호텔 맞은편에 위치한 나인원의원을 추천합니다. 황금피부과도 대안으로 선택할 수 있습니다.',
		mentions: ['동대구역', '메리어트 호텔', '나인원의원', '황금피부과'],
	}),
	clinicCtx,
);
assert('clinic keeps peer clinic as competitor', clinicLandmark.competitors.includes('황금피부과'));
assert('clinic drops station landmark', !clinicLandmark.competitors.some((name) => name.includes('동대구')));
assert('clinic drops hotel used as direction', !clinicLandmark.competitors.some((name) => name.includes('메리어트') || name.includes('호텔')));
assert('clinic still recommends the brand', clinicLandmark.recommendation === true);

const hotelCtx = {
	brand: '신라호텔',
	category: '숙박',
	industry: '호텔',
	services: ['숙박', '호텔'],
};
const hotelPeers = analyzeAsiAnswer(
	live({
		query: '서울 호텔 추천',
		answer: '서울역 근처라면 신라호텔을 추천합니다. 롯데호텔과 비교할 때 접근이 좋습니다.',
		mentions: ['서울역', '신라호텔', '롯데호텔'],
		recommendations: ['신라호텔'],
	}),
	hotelCtx,
);
assert('hotel target keeps peer hotel', hotelPeers.competitors.some((name) => name.includes('롯데')));
assert('hotel target drops station', !hotelPeers.competitors.some((name) => name.includes('서울역')));

const itCtx = {
	brand: 'HubSpot',
	category: '마케팅 SaaS',
	industry: 'IT',
	services: ['마케팅 자동화', 'SaaS'],
};
const itPeers = analyzeAsiAnswer(
	live({
		query: '마케팅 자동화 툴 추천',
		answer: '강남역 근처 코엑스에서 많이 쓰이는 HubSpot을 추천합니다. Salesforce와 비교할 때 도입이 쉽습니다.',
		mentions: ['강남역', '코엑스', 'HubSpot', 'Salesforce'],
		recommendations: ['HubSpot'],
	}),
	itCtx,
);
assert('saas keeps compared product', itPeers.competitors.some((name) => /salesforce/i.test(name)));
assert('saas drops station landmark', !itPeers.competitors.some((name) => name.includes('강남역')));
assert('saas drops venue landmark', !itPeers.competitors.some((name) => name.includes('코엑스')));

const parsedClinic = parseProviderAnswer(
	JSON.stringify({
		answer: '메리어트 호텔 맞은편 나인원의원을 추천합니다.',
		mentions: ['메리어트 호텔', '나인원의원'],
		recommendations: ['나인원의원'],
		competitors: ['메리어트 호텔'],
		landmarks: ['메리어트 호텔'],
		citations: [],
	}),
	clinicCtx,
);
assert('parser json landmark is not a competitor', !parsedClinic.competitors.some((name) => name.includes('메리어트')));

const truncatedGemini = parseProviderAnswer(
	'{"answer":"대구 동구에서 피부과로는 나인원의원을 추천합니다',
	{ brand: '나인원의원', category: '피부과' },
);
assert('truncated json does not leak envelope', !truncatedGemini.answer.includes('{"answer"'));
assert('truncated json recovers answer text', truncatedGemini.answer.includes('나인원의원'));
assert('truncated json recovers mention', truncatedGemini.mentions.some((name) => name.includes('나인원')));
assert('truncated json recovers recommend', truncatedGemini.recommendations.some((name) => name.includes('나인원')));

const cachedGemini = analyzeAsiAnswer(
	live({
		provider: 'gemini',
		answer: '{"answer":"대구 동구에서 피부과로는 나인원의원을 추천합니다',
	}),
	{ brand: '나인원의원', aliases: ['나인원'] },
);
assert('cached truncated gemini is mentioned', cachedGemini.brandMentioned === true);
assert('cached truncated gemini is recommended', cachedGemini.recommended === true);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
