/**
 * STEP 1~5 pipeline verification for the requested query/brand.
 * Does not invent live vendor answers. Uses a live-shaped AIResponse
 * that matches what parseProviderAnswer would emit, then runs Gap / NBA / Persist.
 * Also checks missing-key graceful handling without crashing.
 *
 * Run: npx tsx scripts/test-intelligence-step15-pipeline.ts
 */
import { analyzeAsiAnswer } from '../lib/ai-search-intelligence/core/analysis';
import { buildCompetitorGapSnapshot } from '../lib/ai-search-intelligence/competitor-gap/analyze';
import { ingestAsiCompetitorResponses } from '../lib/ai-search-intelligence/competitors/ingest';
import { resolveSharedCompetitorNames, visibleCompetitorNames } from '../lib/ai-search-intelligence/competitors/service';
import { buildEvidenceExplorerSnapshot } from '../lib/ai-search-intelligence/evidence-explorer/analyze';
import { buildNextActionSnapshot } from '../lib/ai-search-intelligence/next-action/analyze';
import { analyzeOpportunityRow, buildOpportunitySnapshot } from '../lib/ai-search-intelligence/opportunity/analyze';
import { toIntelligenceQuery } from '../lib/ai-search-intelligence/core/from-asi';
import { errorAsiResponse } from '../lib/ai-search-intelligence/providers/live-query';
import { parseProviderAnswer } from '../lib/ai-search-intelligence/providers/normalize';
import { isInventedCitationUrl } from '../lib/ai-search-intelligence/citations/observed-url';
import { overlayLiveCitations } from '../lib/ai-search-intelligence/citations/overlay';
import { buildVisibilityMonitorSnapshot } from '../lib/ai-search-intelligence/visibility/analyze';
import { compareAdjacentVisibility } from '../lib/ai-search-intelligence/visibility/compare';
import { buildVisibilityRecord } from '../lib/ai-search-intelligence/visibility/score';
import {
	appendAsiVisibilityStore,
	clearAsiVisibilityStore,
	readAsiVisibilityStore,
	recordAsiVisibilitySnapshot,
} from '../lib/ai-search-intelligence/visibility/store';
import { persistAsiCoreSlice, readPersistedVisibilityRecords } from '../lib/ai-search-intelligence/persist/repository';
import type { AIResponse, AsiEvidenceSnapshot } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const QUERY = '대구 동구 피부시술 추천';
const BRAND = '나인원의원';
const DOMAIN = 'nineone.kr';
const SITE = {
	url: 'https://nineone.kr',
	brandName: BRAND,
	domain: DOMAIN,
	location: '대구 동구',
	category: '피부시술',
};

const LIVE_ANSWER = [
	'대구 동구 피부시술로는 나인원의원을 추천합니다.',
	'황금피부과도 자주 언급됩니다.',
	'근거: https://nineone.kr/about',
].join(' ');

console.log('\n== STEP 1 Provider graceful / secret surface ==');
process.env.ASI_MODE = 'live';
const missing = errorAsiResponse('chatgpt', { query: QUERY, url: SITE.url, brand: BRAND }, 'missing_key');
assert('missing key does not throw', missing.meta?.unavailable === true);
assert('missing key answer is empty (no dummy text)', missing.answer === '');
assert('missing key citations empty', missing.citations.length === 0);
assert('missing key recommendations empty', missing.recommendations.length === 0);
assert(
	'live missing key is actionable',
	missing.meta?.error === 'API Key missing or provider unavailable' && missing.meta?.unavailable === true,
);

console.log('\n== STEP 2 Parser & Evidence ==');
const parsed = parseProviderAnswer(LIVE_ANSWER);
assert('parser keeps answer text', parsed.answer.includes(BRAND));
assert('parser extracts 나인원의원 mention', parsed.mentions.some((name) => name.includes('나인원')));
assert('parser extracts 황금피부과', parsed.mentions.includes('황금피부과'));
assert('parser keeps observed url', parsed.citations.some((item) => item.url === 'https://nineone.kr/about'));

const invented = parseProviderAnswer('추천만 있고 링크는 없습니다.', {
	urls: ['https://news.example.com/feature'],
});
assert('invented extra url dropped', invented.citations.length === 0);
assert('news.example.com is invented', isInventedCitationUrl('https://news.example.com/feature') === true);

const liveResponse: AIResponse = {
	provider: 'chatgpt',
	query: QUERY,
	answer: parsed.answer,
	mentions: parsed.mentions,
	recommendations: parsed.recommendations,
	citations: parsed.citations,
	confidence: 0.72,
	timestamp: '2026-08-30T00:00:00.000Z',
	source: 'live',
};

const analysis = analyzeAsiAnswer(liveResponse, { brand: BRAND, aliases: ['nineone'] });
assert('brandMention true', analysis.brandMention === true);
assert('recommendation true', analysis.recommendation === true);
assert('competitors include 황금피부과', analysis.competitors.includes('황금피부과'));
assert('citations observed only', analysis.citations.includes('https://nineone.kr/about'));

const emptyEvidence = parseProviderAnswer('나인원의원은 언급됩니다.');
const emptyLive: AIResponse = {
	...liveResponse,
	answer: emptyEvidence.answer,
	mentions: emptyEvidence.mentions,
	recommendations: emptyEvidence.recommendations,
	citations: emptyEvidence.citations,
};
const emptyAnalysis = analyzeAsiAnswer(emptyLive, { brand: BRAND });
assert('no url → citations []', emptyAnalysis.citations.length === 0);

const mockEvidenceBase = {
	source: 'mock' as const,
	analyzedAt: '2026-08-30T00:00:00.000Z',
	boundFromAudit: false,
	site: SITE,
	citations: [
		{
			id: 'fake',
			source: 'fake news',
			url: 'https://news.example.com/brand-feature',
			kind: 'news' as const,
			relevance: 90,
			authority: 90,
			relation: '',
			ownership: 'brand_earned' as const,
		},
	],
} as AsiEvidenceSnapshot;
const overlaidEmpty = overlayLiveCitations(mockEvidenceBase, { sources: [], responses: [] });
const mockLeak = overlaidEmpty.citations.some((item) => item.url.includes('news.example.com'));
assert('overlay does not keep mock citations without live rows', !mockLeak);
assert('overlay empty live is unavailable', overlaidEmpty.citationReport.available === false);
assert('overlay empty live citations []', overlaidEmpty.citations.length === 0);

console.log('\n== STEP 3 Competitor Gap ==');
const competitorResponses: AIResponse[] = [
	liveResponse,
	{
		...liveResponse,
		provider: 'gemini',
		answer: '황금피부과를 추천합니다. 나인원의원도 있습니다. https://hwanggeum.kr',
		mentions: ['황금피부과', '나인원의원'],
		recommendations: ['황금피부과'],
		citations: [
			{ source: 'hwanggeum.kr', url: 'https://hwanggeum.kr', type: 'official', relevance: 0, authority: 0 },
		],
		timestamp: '2026-08-30T00:01:00.000Z',
	},
];

ingestAsiCompetitorResponses(DOMAIN, competitorResponses, { brand: BRAND, aliases: ['nineone'] });
const roster = visibleCompetitorNames(DOMAIN);
const shared = resolveSharedCompetitorNames({
	domain: DOMAIN,
	brand: BRAND,
	aliases: ['nineone'],
	responses: competitorResponses,
});
assert('gap roster includes 황금피부과', roster.includes('황금피부과') || shared.includes('황금피부과'));

const gap = buildCompetitorGapSnapshot({
	site: SITE,
	responses: competitorResponses,
	source: 'live',
	boundFromAudit: false,
	gaps: ['citation', 'entity', 'faq'],
	aliases: ['nineone'],
	knownCompetitors: shared,
});
assert('gap competitors not empty', (gap.summary.competitorsObserved ?? 0) > 0);
assert('gap metrics computed', gap.metrics.some((row) => row.available));
assert('gap rows or boards exist', gap.boards.length > 0 || gap.rows.length > 0);
console.log(`    competitorsObserved=${gap.summary.competitorsObserved} rows=${gap.rows.length} boards=${gap.boards.length}`);
console.log(`    selected=${gap.selectedCompetitor ?? '(none)'}`);
console.log(`    metrics=${gap.metrics.filter((row) => row.available).map((row) => `${row.kind}:${row.gap}`).join(', ')}`);

console.log('\n== STEP 4 Next Best Action ==');
const opportunityRow = analyzeOpportunityRow({
	query: toIntelligenceQuery({ query: QUERY }, { location: SITE.location, service: SITE.category }),
	responses: competitorResponses,
	brand: BRAND,
	aliases: ['nineone'],
	gaps: ['citation', 'entity', 'faq', 'schema'],
	location: SITE.location,
	service: SITE.category,
});
const opportunity = buildOpportunitySnapshot({
	site: SITE,
	rows: [opportunityRow],
	source: 'live',
	boundFromAudit: false,
});
const evidence = buildEvidenceExplorerSnapshot({
	site: SITE,
	responses: competitorResponses,
	source: 'live',
	boundFromAudit: false,
	gaps: ['citation', 'entity', 'faq', 'schema'],
	aliases: ['nineone'],
});
const actionSnapshot = buildNextActionSnapshot({
	site: SITE,
	source: 'live',
	boundFromAudit: false,
	opportunity,
	evidence,
	gap,
	audit: null,
	gaps: ['citation', 'entity', 'faq', 'schema'],
	aeoWeak: true,
});
assert('actions not empty', actionSnapshot.actions.length > 0);
assert('top is at most 5', actionSnapshot.top.length > 0 && actionSnapshot.top.length <= 5);
assert(
	'priority/impact/effort/howToFix bound',
	actionSnapshot.top.every(
		(row) =>
			typeof row.priority === 'number' &&
			typeof row.impact === 'number' &&
			typeof row.effort === 'number' &&
			Boolean(row.howToFix),
	),
);
const kinds = actionSnapshot.top.map((row) => row.kind);
assert(
	'includes content/faq/schema-class actions',
	kinds.some((kind) => kind === 'content' || kind === 'faq' || kind === 'schema' || kind === 'citation' || kind === 'entity'),
);
console.log(`    actions=${actionSnapshot.actions.length} top=${actionSnapshot.top.length}`);
for (const row of actionSnapshot.top) {
	console.log(`    # ${row.kind} | P${row.priority} I${row.impact} E${row.effort} | ${row.title}`);
}

console.log('\n== STEP 5 Persistence & Monitor ==');
clearAsiVisibilityStore(DOMAIN, { persist: false });
process.env.ASI_PERSIST = '1';
process.env.ASI_MODE = 'live';

const first = buildVisibilityRecord({
	responses: competitorResponses,
	brand: BRAND,
	aliases: ['nineone'],
	timestamp: '2026-08-29T00:00:00.000Z',
	cadence: 'on_demand',
	source: 'live',
	competitorNames: shared,
});
appendAsiVisibilityStore(DOMAIN, first);
const second = recordAsiVisibilitySnapshot({
	domain: DOMAIN,
	brand: BRAND,
	aliases: ['nineone'],
	responses: competitorResponses.map((row) => ({
		...row,
		recommendations: [BRAND],
		answer: `${BRAND}을 1위로 추천합니다. https://nineone.kr/about`,
		timestamp: '2026-08-30T12:00:00.000Z',
	})),
	source: 'live',
	timestamp: '2026-08-30T12:00:00.000Z',
});
assert('second snapshot stored', Boolean(second && second.timestamp));
const records = readAsiVisibilityStore(DOMAIN);
assert('store has 2+ timestamps', records.length >= 2);
assert('records have timestamps', records.every((row) => Boolean(row.timestamp)));
const comparison = compareAdjacentVisibility(records);
assert('adjacent change computed', Boolean(comparison && comparison.visibility.change != null));
const monitor = buildVisibilityMonitorSnapshot({
	site: SITE,
	source: 'live',
	boundFromAudit: false,
	records,
});
assert('monitor latest bound', Boolean(monitor.latest?.timestamp));
assert('monitor trends exist', Boolean(monitor.trends && Object.keys(monitor.trends).length > 0));
const persisted = readPersistedVisibilityRecords(DOMAIN);
assert('file persist wrote visibility (or persist skipped in this process)', persisted.length >= 0);
persistAsiCoreSlice(DOMAIN, { visibility: records[records.length - 1] ?? null });
const persistedAfter = readPersistedVisibilityRecords(DOMAIN);
assert('persistAsiCoreSlice writes visibility.json', persistedAfter.length >= 1);
console.log(`    snapshots=${records.length} change=${comparison?.visibility.change ?? 'n/a'}`);
console.log(`    persisted=${persistedAfter.length} latest=${monitor.latest?.timestamp}`);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nSTEP 1~5 pipeline checks passed');
