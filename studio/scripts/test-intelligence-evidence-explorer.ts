/**
 * AI Evidence Explorer — source types, traces, WHY facts, no fake citations.
 * Run: npx tsx scripts/test-intelligence-evidence-explorer.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mockAsiEngine } from '../lib/ai-search-intelligence/adapters/mock-engine';
import { analyzeAsiAnswer } from '../lib/ai-search-intelligence/core/analysis';
import { buildEvidenceExplorerSnapshot } from '../lib/ai-search-intelligence/evidence-explorer/analyze';
import { evidenceSourceTypeFromUrl } from '../lib/ai-search-intelligence/evidence-explorer/source-type';
import { buildEvidenceAnswerTrace } from '../lib/ai-search-intelligence/evidence-explorer/trace';
import { buildEvidenceWhy } from '../lib/ai-search-intelligence/evidence-explorer/why';
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

const siteUrl = 'https://sunshineclinic.kr';
const brand = 'Sunshine';

assert('owned host is official', evidenceSourceTypeFromUrl('https://sunshineclinic.kr/faq', siteUrl) === 'official');
assert('blog host is blog', evidenceSourceTypeFromUrl('https://blog.naver.com/clinic', siteUrl) === 'blog');
assert('news host is news', evidenceSourceTypeFromUrl('https://news.chosun.com/a', siteUrl) === 'news');
assert('youtube is youtube', evidenceSourceTypeFromUrl('https://www.youtube.com/watch?v=1', siteUrl) === 'youtube');
assert('instagram is social', evidenceSourceTypeFromUrl('https://www.instagram.com/clinic', siteUrl) === 'social');
assert('map is map', evidenceSourceTypeFromUrl('https://map.naver.com/p/entry/123', siteUrl) === 'map');
assert('unknown host is other', evidenceSourceTypeFromUrl('https://random-host.example/page', siteUrl) === 'other');
assert('invalid url is null', evidenceSourceTypeFromUrl('not-a-url', siteUrl) === null);

const cited: AIResponse = {
	provider: 'chatgpt',
	query: '대구 흉터 치료 추천',
	answer: 'Sunshine을 추천합니다. https://sunshineclinic.kr/faq',
	mentions: ['Sunshine'],
	recommendations: ['Sunshine'],
	citations: [
		{ source: '공식', url: 'https://sunshineclinic.kr/faq', type: 'official', relevance: 90, authority: 80 },
	],
	confidence: 0.8,
	timestamp: '2026-03-01T00:00:00.000Z',
	source: 'live',
};

const empty: AIResponse = {
	provider: 'gemini',
	query: '대구 흉터 치료 추천',
	answer: '다른 병원을 찾아보세요.',
	mentions: ['서울탑클리닉'],
	recommendations: ['서울탑클리닉'],
	citations: [],
	confidence: 0.4,
	timestamp: '2026-03-01T00:00:00.000Z',
	source: 'live',
};

const citedTrace = buildEvidenceAnswerTrace({
	response: cited,
	brand,
	siteUrl,
	location: '대구',
	gaps: [],
});
assert('cited answer has evidence', citedTrace.evidenceAvailable);
assert('cited answer keeps official url', citedTrace.traces[0]?.citation === 'https://sunshineclinic.kr/faq');
assert('cited answer source is official', citedTrace.traces[0]?.sourceType === 'official');
assert('cited answer related page is owned', citedTrace.traces[0]?.relatedPage === 'https://sunshineclinic.kr/faq');
assert('cited answer brand entity', citedTrace.traces[0]?.brandEntity === brand);
assert(
	'observed why includes mention and official',
	citedTrace.whyObserved.some((item) => item.id === 'brand_mentioned') &&
		citedTrace.whyObserved.some((item) => item.id === 'official_cited'),
);
assert(
	'observed facts stay observed',
	citedTrace.whyObserved.every((item) => item.provenance === 'observed'),
);
assert(
	'derived facts stay derived',
	citedTrace.whyDerived.every((item) => item.provenance === 'derived'),
);
assert('local query is derived', citedTrace.whyDerived.some((item) => item.id === 'local_entity'));

const emptyTrace = buildEvidenceAnswerTrace({
	response: empty,
	brand,
	siteUrl,
	location: '대구',
	gaps: ['citation'],
});
assert('no observed url means unavailable', emptyTrace.evidenceAvailable === false);
assert('empty answer is unavailable', emptyTrace.traces[0]?.available === false);
assert('empty answer has no citation url', emptyTrace.traces[0]?.citation === null);
assert('competitor still observed', emptyTrace.competitors.includes('서울탑클리닉'));
assert(
	'competitor lead is derived not observed-as-ai',
	emptyTrace.whyDerived.some((item) => item.id === 'competitor_leads' && item.provenance === 'derived'),
);

const analysis = analyzeAsiAnswer(cited, { brand });
const why = buildEvidenceWhy({
	analysis,
	urls: ['https://sunshineclinic.kr/faq'],
	siteUrl,
	query: '대구 흉터 치료 추천',
	location: '대구',
	gaps: [],
});
assert('why does not invent official when url missing', buildEvidenceWhy({
	analysis,
	urls: [],
	siteUrl,
	query: '대구 흉터 치료 추천',
	gaps: [],
}).observed.every((item) => item.id !== 'official_cited'));
assert('coverage derived only with owned url and no gaps', why.derived.some((item) => item.id === 'content_coverage'));

const snapshot = buildEvidenceExplorerSnapshot({
	site: {
		url: siteUrl,
		brandName: brand,
		domain: 'sunshineclinic.kr',
		location: '대구',
		category: '흉터',
	},
	responses: [cited, empty],
	source: 'live',
	boundFromAudit: false,
	gaps: [],
});
assert('snapshot counts answers', snapshot.summary.answers === 2);
assert('snapshot counts evidence', snapshot.summary.withEvidence === 1);
assert('snapshot counts unavailable', snapshot.summary.unavailable === 1);
assert('snapshot lists official source', snapshot.sources.some((row) => row.url === 'https://sunshineclinic.kr/faq'));
assert('snapshot does not invent fake url', snapshot.sources.every((row) => row.url !== 'https://fake.example/nope'));
assert('brand citation counted', snapshot.brand.citations >= 1);
assert('brand relevant page counted', snapshot.brand.relevantPages >= 1);

void (async () => {
	const engine = await mockAsiEngine.loadExplorer({ url: siteUrl });
	assert('engine snapshot builds', Boolean(engine));
	assert('engine has answers', Boolean(engine && engine.answers.length > 0));
	assert(
		'engine summary matches answers',
		Boolean(engine && engine.summary.answers === engine.answers.length),
	);
	assert(
		'unavailable + evidence = answers',
		Boolean(engine && engine.summary.withEvidence + engine.summary.unavailable === engine.summary.answers),
	);

	const runSrc = readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/evidence-explorer/run.ts'), 'utf8');
	assert('runner uses query plan', runSrc.includes('runAsiQueryPlan'));
	assert(
		'runner has no vendor HTTP',
		!/api\.openai\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai|api\.anthropic\.com/.test(runSrc),
	);

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
