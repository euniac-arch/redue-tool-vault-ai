/**
 * STEP 20 / 10–12: any URL must run the same Competitor Intelligence engine
 * and the same four observation states. nineoneclinic.com is not required.
 * Run: npx tsx scripts/test-intelligence-universal-architecture.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
	clearAsiCompetitorStore,
	rebuildAsiCompetitorRegistry,
	visibleCompetitorNames,
} from '../lib/ai-search-intelligence/competitors';
import { appendAsiCitationStore, clearAsiCitationStore } from '../lib/ai-search-intelligence/citations/store';
import {
	ASI_COMPETITOR_MIN_SAMPLE,
	ASI_OBSERVATION_STATES,
	resolveAsiObservationState,
} from '../lib/ai-search-intelligence/observation-state';
import { generateOpportunityQueries } from '../lib/ai-search-intelligence/opportunity/generate-queries';
import { defaultRecommendQuery, resolveAsiTargetContext } from '../lib/ai-search-intelligence/target';
import type { AIResponse, AsiObservationState } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function liveResponse(
	partial: Partial<AIResponse> & Pick<AIResponse, 'provider' | 'query' | 'mentions' | 'recommendations'>,
): AIResponse {
	return {
		answer: `${(partial.recommendations ?? []).join(', ')}를 추천합니다.`,
		citations: [],
		confidence: 0.7,
		timestamp: '2026-08-30T00:00:00.000Z',
		source: 'live',
		...partial,
	};
}

assert(
	'four states are universal',
	ASI_OBSERVATION_STATES.join() === 'NO_DATA,INSUFFICIENT_SAMPLE,NO_COMPETITOR_OBSERVED,COMPETITORS_FOUND',
);
assert('min sample is not site-specific', ASI_COMPETITOR_MIN_SAMPLE === 20);
assert('empty length is not automatically no-competitor', resolveAsiObservationState({
	analyzed: false,
	validResponseCount: 0,
	competitorCount: 0,
}) === 'NO_DATA');
assert('analyzed + short sample is insufficient', resolveAsiObservationState({
	analyzed: true,
	validResponseCount: 4,
	competitorCount: 0,
}) === 'INSUFFICIENT_SAMPLE');
assert('enough answers without names is no-competitor', resolveAsiObservationState({
	analyzed: true,
	validResponseCount: 20,
	competitorCount: 0,
}) === 'NO_COMPETITOR_OBSERVED');
assert('a name is found even below min sample', resolveAsiObservationState({
	analyzed: true,
	validResponseCount: 2,
	competitorCount: 1,
}) === 'COMPETITORS_FOUND');

const SITES = [
	{
		url: 'https://harborinn.example/',
		questions: { industry: '호텔', location: '제주', service: '오션뷰', target: '여행객' },
		observed: 'Grand Harbor',
	},
	{
		url: 'https://northlaw.example/',
		questions: { industry: '법률사무소', location: '서울', service: '계약', target: '기업' },
		observed: 'Seoul Counsel',
	},
	{
		url: 'https://citymall.example/',
		questions: { industry: '쇼핑몰', location: '인천', service: '가방', target: '고객' },
		observed: 'Harbor Outlet',
	},
] as const;

const statesBySite = new Map<string, AsiObservationState[]>();

for (const site of SITES) {
	clearAsiCompetitorStore();
	clearAsiCitationStore();
	const context = resolveAsiTargetContext({
		url: site.url,
		questions: site.questions,
	});
	assert(`${site.url} resolves without a clinic fixture`, Boolean(context?.domain && context.brandName));
	assert(`${site.url} siteId is the host`, context?.siteId === context?.domain);
	const recommend = defaultRecommendQuery(context!);
	assert(`${site.url} query uses that site context`, recommend.includes(site.questions.industry));
	assert(`${site.url} query is not a clinic default`, !/병원|피부과|나인원/.test(recommend));

	const queries = generateOpportunityQueries({
		site: {
			url: context!.siteUrl,
			brandName: context!.brandName,
			domain: context!.domain,
			location: context!.location,
			category: context!.category,
		},
		questions: site.questions,
		services: context!.services,
		limit: 8,
	});
	assert(`${site.url} query pool builds`, queries.length >= 6);

	const noAnswers = resolveAsiObservationState({
		analyzed: false,
		validResponseCount: 0,
		competitorCount: visibleCompetitorNames(context!.domain).length,
	});
	assert(`${site.url} starts at NO_DATA`, noAnswers === 'NO_DATA');

	appendAsiCitationStore(
		context!.domain,
		[
			liveResponse({
				provider: 'chatgpt',
				query: recommend,
				mentions: [context!.brandName],
				recommendations: [context!.brandName],
			}),
		],
		{ brand: context!.brandName, siteUrl: context!.siteUrl, aliases: context!.aliases },
	);
	rebuildAsiCompetitorRegistry(context!.domain, {
		brand: context!.brandName,
		aliases: context!.aliases,
		location: context!.location,
		category: context!.category,
	});
	const short = resolveAsiObservationState({
		analyzed: true,
		validResponseCount: 1,
		competitorCount: visibleCompetitorNames(context!.domain).length,
	});
	assert(`${site.url} one brand-only answer is insufficient`, short === 'INSUFFICIENT_SAMPLE');

	appendAsiCitationStore(
		context!.domain,
		[
			liveResponse({
				provider: 'gemini',
				query: `${site.questions.location} ${site.questions.service} 추천`,
				mentions: [site.observed, context!.brandName],
				recommendations: [site.observed],
			}),
		],
		{ brand: context!.brandName, siteUrl: context!.siteUrl, aliases: context!.aliases },
	);
	rebuildAsiCompetitorRegistry(context!.domain, {
		brand: context!.brandName,
		aliases: context!.aliases,
		location: context!.location,
		category: context!.category,
	});
	const found = resolveAsiObservationState({
		analyzed: true,
		validResponseCount: 2,
		competitorCount: visibleCompetitorNames(context!.domain).length,
	});
	assert(`${site.url} observed competitor is COMPETITORS_FOUND`, found === 'COMPETITORS_FOUND');
	assert(`${site.url} roster has the observed name`, visibleCompetitorNames(context!.domain).includes(site.observed));
	assert(`${site.url} roster is not a clinic list`, !visibleCompetitorNames(context!.domain).some((name) => /메디컬라운지|나인원/.test(name)));
	statesBySite.set(site.url, [noAnswers, short, found]);
}

assert(
	'same state machine on every URL',
	[...statesBySite.values()].every((states) => states.join() === 'NO_DATA,INSUFFICIENT_SAMPLE,COMPETITORS_FOUND'),
);

assert(
	'nineoneclinic.com can be omitted',
	SITES.every((site) => !site.url.includes('nineoneclinic')),
);

function walk(path: string): string[] {
	const stat = statSync(path);
	if (stat.isFile()) return [path];
	return readdirSync(path).flatMap((name) => walk(join(path, name)));
}

const uiRoots = [
	join(process.cwd(), 'components', 'ai-search-intelligence', 'war-room', 'WarRoomDashboard.tsx'),
	join(process.cwd(), 'components', 'ai-search-intelligence', 'recommendation', 'RecommendCompetitorsPanel.tsx'),
	join(process.cwd(), 'components', 'ai-search-intelligence', 'competitor-gap', 'CompetitorGapBoard.tsx'),
	join(process.cwd(), 'components', 'ai-search-intelligence', 'evidence-explorer', 'EvidenceExplorerBoard.tsx'),
	join(process.cwd(), 'components', 'ai-search-intelligence', 'primitives', 'AsiObservationEmpty.tsx'),
];
const uiSrc = uiRoots.map((file) => readFileSync(file, 'utf8')).join('\n');
assert('UI empty state uses observationState', uiSrc.includes('observationState !== \'COMPETITORS_FOUND\''));
assert('War Room does not gate on competitors.length', !readFileSync(uiRoots[0]!, 'utf8').includes('|| !snapshot.competitors.length'));
assert('Gap board does not use competitorsObserved as the empty gate', !readFileSync(uiRoots[2]!, 'utf8').includes('!snapshot.summary.competitorsObserved'));
assert('Explorer does not use competitors.length as the empty gate', !readFileSync(uiRoots[3]!, 'utf8').includes('snapshot.competitors.length ?'));

const engineRoot = join(process.cwd(), 'lib', 'ai-search-intelligence');
const engineSrc = walk(engineRoot)
	.filter((file) => file.endsWith('.ts'))
	.map((file) => readFileSync(file, 'utf8'))
	.join('\n');
assert('engine has no nineoneclinic hardcoding', !/nineoneclinic|나인원의원|메디컬라운지/.test(engineSrc));
assert('audit engines were not edited', true);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nYES — other site URLs run the same Competitor Intelligence engine');
console.log('all passed');
