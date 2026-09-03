/**
 * AI Competitor Gap — derive gaps from observed answers only.
 * Run: npx tsx scripts/test-intelligence-competitor-gap.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mockAsiEngine } from '../lib/ai-search-intelligence/adapters/mock-engine';
import { actionFromGap, buildCompetitorGapSnapshot } from '../lib/ai-search-intelligence/competitor-gap/analyze';
import { deriveCompetitorGapRows } from '../lib/ai-search-intelligence/competitor-gap/categories';
import { ASI_COMPETITOR_GAP_KINDS } from '../lib/ai-search-intelligence/types';
import { observedCompetitorNames, rankObservedCompetitors, ratesForCompetitor } from '../lib/ai-search-intelligence/competitor-gap/rates';
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

const site = {
	url: 'https://sunshineclinic.kr',
	brandName: 'Sunshine',
	domain: 'sunshineclinic.kr',
	location: '대구',
	category: '흉터',
};

const winThem: AIResponse = {
	provider: 'chatgpt',
	query: '대구 동구 덴서티 추천',
	answer: '덴서티를 추천합니다.',
	mentions: ['덴서티'],
	recommendations: ['덴서티'],
	citations: [{ source: 'news', url: 'https://news.chosun.com/d', type: 'news', relevance: 70, authority: 70 }],
	confidence: 0.7,
	timestamp: '2026-03-01T00:00:00.000Z',
	source: 'live',
};

const winUs: AIResponse = {
	provider: 'gemini',
	query: '대구 동구 덴서티 추천',
	answer: 'Sunshine을 추천합니다. https://sunshineclinic.kr/faq',
	mentions: ['Sunshine'],
	recommendations: ['Sunshine'],
	citations: [{ source: '공식', url: 'https://sunshineclinic.kr/faq', type: 'official', relevance: 90, authority: 80 }],
	confidence: 0.8,
	timestamp: '2026-03-01T00:00:00.000Z',
	source: 'live',
};

const brandOnly: AIResponse = {
	provider: 'perplexity',
	query: 'Sunshine 후기',
	answer: 'Sunshine 후기가 있습니다.',
	mentions: ['Sunshine'],
	recommendations: ['Sunshine'],
	citations: [],
	confidence: 0.6,
	timestamp: '2026-03-01T00:00:00.000Z',
	source: 'live',
};

assert(
	'observes competitor names',
	observedCompetitorNames({ responses: [winThem, winUs], brand: 'Sunshine' }).includes('덴서티'),
);
assert(
	'no competitor when brand only',
	observedCompetitorNames({ responses: [brandOnly], brand: 'Sunshine' }).length === 0,
);

const rates = ratesForCompetitor({
	query: '대구 동구 덴서티 추천',
	responses: [winThem, winUs],
	brand: 'Sunshine',
	competitor: '덴서티',
	siteUrl: site.url,
});
assert('brand mention is half', rates.brandMention === 0.5);
assert('competitor mention is half', rates.competitorMention === 0.5);
assert('competitor recommend is half', rates.competitorRecommend === 0.5);

const emptySnapshot = buildCompetitorGapSnapshot({
	site,
	responses: [brandOnly],
	source: 'live',
	boundFromAudit: false,
	gaps: ['content', 'entity', 'local'],
});
assert('no invented competitor', emptySnapshot.summary.competitorsObserved === 0);
assert('one live answer is insufficient, not no-competitor', emptySnapshot.summary.observationState === 'INSUFFICIENT_SAMPLE');
assert('no invented gaps', emptySnapshot.rows.length === 0);
assert('empty still exposes nine unavailable metrics', emptySnapshot.metrics.length === 9);
assert('empty boards stay empty', (emptySnapshot.boards ?? []).length === 0);

const untouched = buildCompetitorGapSnapshot({
	site,
	responses: [],
	source: 'mock',
	boundFromAudit: false,
	gaps: [],
});
assert('mock empty is NO_DATA', untouched.summary.observationState === 'NO_DATA');

const enoughBrandOnly = Array.from({ length: 20 }, (_, index) => ({
	...brandOnly,
	provider: (['chatgpt', 'gemini', 'perplexity', 'claude'] as const)[index % 4],
	query: `Sunshine 후기 ${index}`,
}));
const noCompetitor = buildCompetitorGapSnapshot({
	site,
	responses: enoughBrandOnly,
	source: 'live',
	boundFromAudit: false,
	gaps: [],
});
assert('twenty brand-only answers are NO_COMPETITOR_OBSERVED', noCompetitor.summary.observationState === 'NO_COMPETITOR_OBSERVED');
assert('no-competitor still invents no names', noCompetitor.summary.competitorsObserved === 0);
assert('content gap not invented without competitor', emptySnapshot.metrics.every((item) => item.kind !== 'content' || !item.available));

const ahead: AIResponse = {
	...winThem,
	provider: 'claude',
	query: '대구 흉터 치료 추천',
	answer: '덴서티를 추천합니다. https://news.chosun.com/d',
};
const snapshot = buildCompetitorGapSnapshot({
	site,
	responses: [ahead, { ...brandOnly, query: '대구 흉터 치료 추천', mentions: [], recommendations: [], answer: '정보가 부족합니다.' }],
	source: 'live',
	boundFromAudit: false,
	gaps: [],
});
assert('observes one competitor', snapshot.summary.competitorsObserved === 1);
assert('found competitor even below min sample', snapshot.summary.observationState === 'COMPETITORS_FOUND');
assert('auto-maps top ranked competitor', snapshot.rankedCompetitors?.[0]?.name === '덴서티');
assert('nine gap metrics are always computed', snapshot.metrics.length === 9);
assert(
	'nine kinds match the engine',
	ASI_COMPETITOR_GAP_KINDS.every((kind) => snapshot.metrics.some((item) => item.kind === kind)),
);
assert('recommendation metric is observed', snapshot.metrics.some((item) => item.kind === 'recommendation' && item.available && item.gap > 0));
assert('visibility metric is observed', snapshot.metrics.some((item) => item.kind === 'visibility' && item.available));
assert('content/entity metrics stay available as observed deltas', snapshot.metrics.filter((item) => item.kind === 'content' || item.kind === 'entity').every((item) => item.available));
assert('board is built for the detected competitor', (snapshot.boards ?? []).some((board) => board.name === '덴서티' && board.metrics.length === 9));
assert('recommendation gap exists', snapshot.rows.some((row) => row.kind === 'recommendation' && row.gap > 0));
assert('does not invent content gap without audit', snapshot.rows.every((row) => row.kind !== 'content'));
assert('why they win stays within observed kinds', snapshot.whyTheyWin.every((item) => snapshot.rows.some((row) => row.kind === item.id)));
assert('top is at most 5', snapshot.top.length <= 5);
assert('query compare has recommendation gap', snapshot.queries.some((row) => row.gaps.recommendation > 0));

const audited = buildCompetitorGapSnapshot({
	site,
	responses: [ahead],
	source: 'derived',
	boundFromAudit: true,
	gaps: ['content', 'entity'],
});
assert(
	'audit content gap only with competitor lead',
	audited.rows.some((row) => row.kind === 'content') || audited.rows.some((row) => row.kind === 'recommendation'),
);

const rows = deriveCompetitorGapRows({
	competitor: '덴서티',
	rates: [rates],
	brand: { name: 'Sunshine', kind: 'brand', citations: 1, relevantPages: 1, externalSources: 0 },
	them: { name: '덴서티', kind: 'competitor', citations: 6, relevantPages: 0, externalSources: 4 },
	sources: [
		{
			url: 'https://news.chosun.com/d',
			sourceType: 'news',
			citedBy: ['chatgpt'],
			query: rates.query,
			relatedTo: 'competitor',
			entity: '덴서티',
			relatedPage: null,
		},
	],
	gaps: [],
	boundFromAudit: false,
});
assert('citation gap from observed counts', rows.some((row) => row.kind === 'citation' && row.gap === 5));
assert('citation gap links evidence url', rows.some((row) => row.kind === 'citation' && row.evidence.includes('https://news.chosun.com/d')));
assert('action is derived for STEP 5', actionFromGap(rows[0]).priority.provenance === 'derived');

const freeTextGold: AIResponse = {
	provider: 'chatgpt',
	query: '대구 동구 피부과 추천',
	answer: '황금피부과를 추천합니다. 비교하면 인근 타 피부과보다 황금피부과가 먼저 나옵니다.',
	mentions: [],
	recommendations: [],
	citations: [{ source: 'news', url: 'https://news.chosun.com/gold', type: 'news', relevance: 70, authority: 70 }],
	confidence: 0.7,
	timestamp: '2026-03-01T00:00:00.000Z',
	source: 'live',
};
const freeTextSecond: AIResponse = {
	...freeTextGold,
	provider: 'gemini',
	answer: '황금피부과와 맑은피부과를 함께 언급합니다. 황금피부과를 추천합니다.',
};
const freeTextThird: AIResponse = {
	...freeTextGold,
	provider: 'perplexity',
	answer: '맑은피부과도 후보입니다.',
	citations: [],
};
const ranked = rankObservedCompetitors({
	responses: [freeTextGold, freeTextSecond, freeTextThird],
	brand: 'Sunshine',
});
assert('free-text parser feeds gap ranking', ranked[0]?.name === '황금피부과');
assert('generic nearby clinic is not a target', ranked.every((row) => !row.name.includes('인근') && !row.name.startsWith('타')));
const parsedGap = buildCompetitorGapSnapshot({
	site,
	responses: [freeTextGold, freeTextSecond, freeTextThird],
	source: 'live',
	boundFromAudit: false,
	gaps: [],
});
assert('free-text competitor becomes the selected target', parsedGap.selectedCompetitor === '황금피부과');
assert('free-text why-they-win is populated', parsedGap.whyTheyWin.length > 0);
assert('free-text recommendation gap is calculated', parsedGap.metrics.some((item) => item.kind === 'recommendation' && item.gap > 0));

void (async () => {
	const engine = await mockAsiEngine.loadGap({ url: site.url });
	assert('engine snapshot builds', Boolean(engine));
	assert(
		'summary competitors is number',
		Boolean(engine && typeof engine.summary.competitorsObserved === 'number'),
	);
	assert('top subset of rows', Boolean(engine && engine.top.every((item) => engine.rows.some((row) => row.id === item.id))));

	const runSrc = readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/competitor-gap/run.ts'), 'utf8');
	assert('runner uses query plan', runSrc.includes('runAsiQueryPlan'));
	assert(
		'runner has no vendor HTTP',
		!/api\.openai\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai|api\.anthropic\.com/.test(runSrc),
	);
	assert('runner reuses opportunity queries', runSrc.includes('generateOpportunityQueries'));
	assert('cache replay keeps live answers', runSrc.includes("row.source === 'live'") && runSrc.includes('liveCached'));

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
