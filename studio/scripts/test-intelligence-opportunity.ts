/**
 * AI Opportunity Finder — generate, classify, score, snapshot.
 * Run: npx tsx scripts/test-intelligence-opportunity.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mockAsiEngine } from '../lib/ai-search-intelligence/adapters/mock-engine';
import { classifyOpportunityStatus } from '../lib/ai-search-intelligence/opportunity/classify';
import { generateOpportunityQueries } from '../lib/ai-search-intelligence/opportunity/generate-queries';
import {
	ASI_OPPORTUNITY_WEIGHTS,
	isOpportunityCandidate,
	opportunityScoreFromSignals,
	scoreOpportunitySignals,
} from '../lib/ai-search-intelligence/opportunity/score';
import { analyzeOpportunityRow } from '../lib/ai-search-intelligence/opportunity/analyze';
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

const queries = generateOpportunityQueries({
	site,
	questions: { industry: '피부과', location: '대구', service: '흉터 치료', target: '성인' },
	services: ['리프팅'],
	competitors: ['덴서티'],
});

assert('generates queries', queries.length >= 6 && queries.length <= 10);
assert(
	'every query has intent and derived priority',
	queries.every((item) => item.intent && item.priority.provenance === 'derived' && item.text.length > 0),
);
assert('includes recommend query', queries.some((item) => item.intent === 'recommend'));
assert('includes compare query', queries.some((item) => item.intent === 'compare' || item.text.includes('비교') || item.text.includes('vs')));
assert('includes brand or local text', queries.some((item) => item.text.includes('Sunshine') || item.text.includes('대구')));

assert('WIN when mentioned and recommended', classifyOpportunityStatus({ mentionRate: 0.75, recommendationRate: 0.5, competitorCount: 0 }) === 'win');
assert('COMPETE when present but weak', classifyOpportunityStatus({ mentionRate: 0.4, recommendationRate: 0, competitorCount: 2 }) === 'compete');
assert('MISS when absent', classifyOpportunityStatus({ mentionRate: 0, recommendationRate: 0, competitorCount: 1 }) === 'miss');

const weightSum = Object.values(ASI_OPPORTUNITY_WEIGHTS).reduce((sum, value) => sum + value, 0);
assert('score weights sum 100', weightSum === 100);

const missSignals = scoreOpportunitySignals({
	intent: 'recommend',
	query: '대구 흉터 치료 추천',
	location: '대구',
	service: '흉터 치료',
	status: 'miss',
	mentionRate: 0,
	recommendationRate: 0,
	competitorCount: 2,
	citationCount: 0,
	ownedCitation: false,
	gaps: ['faq', 'citation'],
});
const missScore = opportunityScoreFromSignals(missSignals);
assert('miss recommend scores high', missScore >= 58, String(missScore));
assert('miss is an opportunity', isOpportunityCandidate('miss', missScore));
assert('win is not an opportunity', isOpportunityCandidate('win', 90) === false);

const missResponse: AIResponse = {
	provider: 'chatgpt',
	query: '대구 흉터 치료 추천',
	answer: '다른 병원을 찾아보세요.',
	mentions: ['서울탑클리닉'],
	recommendations: ['서울탑클리닉'],
	citations: [{ source: 'news', url: 'https://news.example.com/a', type: 'news', relevance: 0, authority: 0 }],
	confidence: 0.7,
	timestamp: '2026-03-01T00:00:00.000Z',
	source: 'mock',
};
const row = analyzeOpportunityRow({
	query: queries.find((item) => item.text.includes('추천')) ?? queries[0],
	responses: [missResponse],
	brand: 'Sunshine',
	gaps: ['faq'],
	location: '대구',
	service: '흉터 치료',
});
assert('row status is miss or compete', row.status === 'miss' || row.status === 'compete');
assert('row score is derived 0-100', row.score >= 0 && row.score <= 100);
assert('row exposes observed mention', row.brandMentioned === false);
assert('row lists competitor', row.competitors.includes('서울탑클리닉'));
assert('row has engine answer', row.engines[0]?.answer.includes('병원'));

void (async () => {
	const snapshot = await mockAsiEngine.loadOpportunity({ url: site.url });
	assert('engine snapshot builds', Boolean(snapshot));
	assert('snapshot has summary totals', Boolean(snapshot && snapshot.summary.total === snapshot.rows.length));
	assert(
		'summary buckets add up',
		Boolean(
			snapshot &&
				snapshot.summary.win + snapshot.summary.compete + snapshot.summary.miss === snapshot.summary.total,
		),
	);
	assert('top is subset of opportunities', Boolean(snapshot && snapshot.top.every((item) => item.isOpportunity)));

	const runSrc = readFileSync(resolve(process.cwd(), 'lib/ai-search-intelligence/opportunity/run.ts'), 'utf8');
	assert('runner uses query plan', runSrc.includes('runAsiQueryPlan'));
	assert('runner has no vendor HTTP', !/api\.openai\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai|api\.anthropic\.com/.test(runSrc));

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
