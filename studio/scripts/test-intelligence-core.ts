/**
 * Architecture lock: one Intelligence Core, 12 views.
 * Run: npx tsx scripts/test-intelligence-core.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { analyzeAsiAnswer, recommendationFromAnalysis } from '../lib/ai-search-intelligence/core/analysis';
import { aggregateAsiWarRoom } from '../lib/ai-search-intelligence/core/aggregate-war-room';
import {
	INTELLIGENCE_CORE_PROVENANCE,
	buildIntelligenceCore,
	toAsiProviderQueryFromIntelligence,
	toIntelligenceQuery,
} from '../lib/ai-search-intelligence/core';
import { generatedQuestionsToQueries, toAsiProviderQuery } from '../lib/ai-search-intelligence/core/query-pipeline';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';
import { ASI_AUDIT_SIGNAL_IDS, extractAsiAuditBridge } from '../lib/ai-search-intelligence/audit-bridge';
import type { AIQuery, AIResponse } from '../lib/ai-search-intelligence/types';

const ROOT = join(__dirname, '..');
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function walk(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.next') continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, acc);
		else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
	}
	return acc;
}

function countMatches(files: string[], pattern: RegExp, exclude = /scripts[\\/]test-/) {
	const hits: string[] = [];
	for (const file of files) {
		if (exclude.test(file)) continue;
		const text = readFileSync(file, 'utf8');
		if (pattern.test(text)) hits.push(relative(ROOT, file).replace(/\\/g, '/'));
	}
	return hits;
}

const files = walk(join(ROOT, 'lib', 'ai-search-intelligence')).concat(
	walk(join(ROOT, 'app', 'api', 'intelligence')),
	walk(join(ROOT, 'components', 'ai-search-intelligence')),
);

const openaiCalls = countMatches(files, /api\.openai\.com/);
const geminiCalls = countMatches(files, /generativelanguage\.googleapis\.com/);
const sovCalc = countMatches(files, /export function calculateAsiSov/);
const citationKind = countMatches(files, /export function citationKindFromObservedUrl/);
const recParse = countMatches(files, /export function analyzeAsiAnswer/);
const queryType = countMatches(files, /export type AIQuery =/);
const responseType = countMatches(files, /export type AIResponse =/);

assert('Q1 OpenAI HTTP in one adapter', openaiCalls.length === 1 && openaiCalls[0].includes('openai-provider'));
assert('Q2 Gemini HTTP in one adapter', geminiCalls.length === 1 && geminiCalls[0].includes('gemini-provider'));
assert('Q3 SOV calculator in one file', sovCalc.length === 1 && sovCalc[0].includes('sov/calculate'));
assert('Q4 citation kind in classify', citationKind.length === 1 && citationKind[0].includes('citations/classify'));
assert('Q5 recommendation parse in core/analysis', recParse.length === 1 && recParse[0].includes('core/analysis'));
assert('Q6 AIQuery defined once', queryType.length === 1 && queryType[0].includes('types.ts'));
assert('Q7 AIResponse defined once', responseType.length === 1 && responseType[0].includes('types.ts'));

const response: AIResponse = {
	provider: 'chatgpt',
	query: '대구 흉터 병원 추천',
	answer: 'Sunshine Clinic을 추천합니다. 경쟁으로는 A Clinic이 있습니다.',
	mentions: ['Sunshine Clinic', 'A Clinic'],
	recommendations: ['Sunshine Clinic', 'A Clinic'],
	citations: [{ source: 'official', url: 'https://sunshineclinic.kr', type: 'official', relevance: 0, authority: 0 }],
	confidence: 0.8,
	timestamp: '2026-01-01T00:00:00.000Z',
	source: 'live',
};

const analysis = analyzeAsiAnswer(response, { brand: 'Sunshine' });
assert('core mention extract', analysis.brandMentioned === true);
assert('core recommendation extract', analysis.recommended === true && analysis.rank === 1);
assert('core competitor extract', analysis.competitors.includes('A Clinic'));
assert('core citation extract', analysis.citations[0] === 'https://sunshineclinic.kr');
assert('compose uses the same parser', recommendationFromAnalysis(response, 'Sunshine').mentioned === true);

const site = { url: 'https://sunshineclinic.kr', brandName: 'Sunshine', domain: 'sunshineclinic.kr', location: '대구', category: '흉터' };
const questions = generatedQuestionsToQueries([{ id: 'q1', intent: 'recommend', query: '대구 흉터 추천' }], site);
const providerQuery = toAsiProviderQuery(questions[0] as AIQuery, site);
assert('query reused for provider', providerQuery.query === '대구 흉터 추천' && providerQuery.url === site.url);

const war = buildMockWarRoomSnapshot({ url: site.url });
assert('war room mock builds', Boolean(war));
const aggregated = war ? aggregateAsiWarRoom(war) : null;
assert('war room aggregates without provider I/O', Boolean(aggregated) && aggregated?.site.url === site.url);
assert('seven SEO/GEO signal ids', ASI_AUDIT_SIGNAL_IDS.length === 7);
assert('unbound audit has no signals', extractAsiAuditBridge(null, site.url) === null);

const uiIndex = readFileSync(join(ROOT, 'components/ai-search-intelligence/primitives/index.ts'), 'utf8');
assert('Q8 AIScoreCard alias', uiIndex.includes('AIScoreCard'));
assert('Q8 CitationCard alias', uiIndex.includes('CitationCard'));
assert('Q8 VisibilityChart alias', uiIndex.includes('VisibilityChart'));

const coreModels = countMatches(files, /export type Query =/);
assert('core Query lives in models.ts', coreModels.length === 1 && coreModels[0].includes('core/models'));
assert('observation brandMention is observed', INTELLIGENCE_CORE_PROVENANCE.observation.brandMention === 'observed');
assert('visibility score is derived', INTELLIGENCE_CORE_PROVENANCE.visibility.visibilityScore === 'derived');
assert('opportunity impact is derived', INTELLIGENCE_CORE_PROVENANCE.opportunity.estimatedImpact === 'derived');
assert('competitor rank is derived', INTELLIGENCE_CORE_PROVENANCE.competitor.rank === 'derived');

const coreQuery = toIntelligenceQuery({ id: 'q1', query: '대구 흉터 추천', intent: 'recommend' }, { location: '대구', service: '흉터' });
assert('core query text preserved', coreQuery.text === '대구 흉터 추천');
assert('core query priority is derived', coreQuery.priority.provenance === 'derived' && coreQuery.priority.value === 90);
const fromCore = toAsiProviderQueryFromIntelligence(coreQuery, site);
assert('core query reuses provider port shape', fromCore.query === coreQuery.text && fromCore.url === site.url);

const liveBundle = buildIntelligenceCore({
	brand: 'Sunshine',
	queries: [coreQuery],
	responses: [response],
	warRoom: war,
});
const mockBundle = buildIntelligenceCore({
	brand: 'Sunshine',
	queries: [coreQuery],
	warRoom: war,
});
assert('live bundle has observation from AIResponse', liveBundle.observations[0]?.brandMention.value === true);
assert('live observation tagged observed', liveBundle.observations[0]?.brandMention.provenance === 'observed');
assert('mock/live bundle keys match', Object.keys(liveBundle).join() === Object.keys(mockBundle).join());
assert('derived scores not claimed observed', liveBundle.visibility?.visibilityScore.provenance === 'derived');
assert('war-room opportunities map as derived', liveBundle.opportunities[0]?.estimatedImpact.provenance === 'derived');

const noProviderInCore = countMatches(
	files.filter((file) => /core[\\/](models|from-asi)\.ts$/.test(file)),
	/api\.openai\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai|api\.anthropic\.com|createAsiProviders/,
	/$^/,
);
assert('core models have no provider HTTP', noProviderInCore.length === 0);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
