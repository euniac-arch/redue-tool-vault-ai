/**
 * Intelligence Loop — store-only compose, stage order, no invented tops.
 * Run: npx tsx scripts/test-intelligence-loop.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { appendAsiCitationStore, clearAsiCitationStore } from '../lib/ai-search-intelligence/citations/store';
import { attachAsiLoop, composeAsiLoop, emptyAsiLoop } from '../lib/ai-search-intelligence/loop/compose';
import { ASI_LOOP_HREF, nextAsiLoopStage } from '../lib/ai-search-intelligence/loop/stages';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';
import { appendAsiVisibilityStore, clearAsiVisibilityStore } from '../lib/ai-search-intelligence/visibility/store';
import { buildVisibilityRecord } from '../lib/ai-search-intelligence/visibility/score';
import type { AIResponse, AsiWarRoomSnapshot } from '../lib/ai-search-intelligence/types';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function read(rel: string) {
	return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

const site = {
	url: 'https://sunshineclinic.kr',
	brandName: 'Sunshine',
	domain: 'sunshineclinic.kr',
	location: '대구',
	category: '흉터',
};

clearAsiCitationStore();
clearAsiVisibilityStore();

const empty = composeAsiLoop({ site, fallbackVisibility: 42 });
assert('empty stores invent no opportunities', empty.opportunities.length === 0);
assert('empty stores invent no gaps', empty.gaps.length === 0);
assert('empty stores invent no actions', empty.actions.length === 0);
assert('empty stores invent no alerts', empty.alerts.length === 0);
assert('empty health uses fallback', empty.health.current === 42);
assert('empty health has no previous', empty.health.previous === null && empty.health.change === null);
assert('empty health change is not observed', empty.health.changeProvenance === null);
assert('empty changes invent nothing', empty.changes.hasPrevious === false && empty.changes.queryExposure === null && empty.changes.citation === null);
assert('empty trend has no invented %', empty.trend7.changePct === null && empty.trend30.changePct === null);

const helper = emptyAsiLoop(7);
assert('emptyAsiLoop tops stay empty', helper.opportunities.length + helper.gaps.length + helper.actions.length === 0);

function response(query: string): AIResponse {
	return {
		provider: 'chatgpt',
		query,
		answer: '덴서티를 추천합니다.',
		mentions: ['덴서티'],
		recommendations: ['덴서티'],
		citations: [{ source: 'news', url: 'https://news.chosun.com/d', type: 'news', relevance: 70, authority: 70 }],
		confidence: 0.7,
		timestamp: '2026-03-01T00:00:00.000Z',
		source: 'live',
	};
}

const queries = ['대구 흉터 치료 추천', '대구 리프팅 추천', 'Sunshine vs 덴서티', '대구 피부과 후기'];
appendAsiCitationStore(
	site.domain,
	queries.map(response),
	{ brand: site.brandName, siteUrl: site.url, aliases: ['Sunshine'] },
);

const now = Date.now();
const missBatch = [response('대구 흉터 치료 추천')];
const winBatch = [
	{
		...response('대구 흉터 치료 추천'),
		mentions: ['Sunshine'],
		recommendations: ['Sunshine'],
		citations: [{ source: '공식', url: 'https://sunshineclinic.kr', type: 'official' as const, relevance: 80, authority: 80 }],
	},
];
const low = buildVisibilityRecord({ responses: missBatch, brand: 'Sunshine', source: 'live' });
const high = buildVisibilityRecord({ responses: winBatch, brand: 'Sunshine', source: 'live' });
appendAsiVisibilityStore(site.domain, {
	...low,
	timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
	visibility: 40,
});
appendAsiVisibilityStore(site.domain, {
	...high,
	timestamp: new Date(now).toISOString(),
	visibility: 72,
});

const filled = composeAsiLoop({ site, fallbackVisibility: 0 });
assert('health current is 0-100', filled.health.current >= 0 && filled.health.current <= 100);
assert('health previous is stored measurement', filled.health.previous === 40);
assert('health change is observed', filled.health.changeProvenance === 'observed');
assert('health current uses latest visibility', filled.health.current === 72);
assert('tops stay at most 3', filled.opportunities.length <= 3 && filled.gaps.length <= 3 && filled.actions.length <= 3);
assert('alerts stay at most 3', filled.alerts.length <= 3);
assert('citation store yields opportunities', filled.opportunities.length >= 1);
assert('opportunity links stay in loop', filled.opportunities.every((row) => row.href === '/intelligence/opportunity-finder'));
assert('gap links stay in loop', filled.gaps.every((row) => row.href === '/intelligence/competitor-gap'));
assert('action links stay in loop', filled.actions.every((row) => row.href === '/intelligence/next-best-action'));

assert('next after act is monitor', nextAsiLoopStage('act') === 'monitor');
assert('next after alert is measure', nextAsiLoopStage('alert') === 'measure');
assert('measure starts discover', nextAsiLoopStage('measure') === 'discover');
assert('discover explains', nextAsiLoopStage('discover') === 'explain');
assert('explain competes', nextAsiLoopStage('explain') === 'compete');
assert('compete acts', nextAsiLoopStage('compete') === 'act');
assert('monitor alerts', nextAsiLoopStage('monitor') === 'alert');
assert('measure href is visibility', ASI_LOOP_HREF.measure === '/intelligence/visibility-monitor');
assert('discover href is opportunity', ASI_LOOP_HREF.discover === '/intelligence/opportunity-finder');
assert('explain href is evidence', ASI_LOOP_HREF.explain === '/intelligence/evidence-explorer');
assert('compete href is gap', ASI_LOOP_HREF.compete === '/intelligence/competitor-gap');
assert('act href is action', ASI_LOOP_HREF.act === '/intelligence/next-best-action');

const composeSrc = read('lib/ai-search-intelligence/loop/compose.ts');
assert('compose does not query providers', !composeSrc.includes('queryAsiProviders'));
assert(
	'compose has no vendor HTTP',
	!/api\.openai\.com|generativelanguage\.googleapis\.com|api\.perplexity\.ai|api\.anthropic\.com/.test(composeSrc),
);
const sessionSrc = read('lib/ai-search-intelligence/loop/session.ts');
assert('session overlay does not query providers', !sessionSrc.includes('queryAsiProviders'));

const opportunityBoard = read('components/ai-search-intelligence/opportunity/OpportunityBoard.tsx');
assert('opportunity CTA opens evidence', opportunityBoard.includes('href="/intelligence/evidence-explorer"'));
assert('opportunity CTA opens gap', opportunityBoard.includes('href="/intelligence/competitor-gap"'));
assert('opportunity CTA opens action', opportunityBoard.includes('href="/intelligence/next-best-action"'));
assert('opportunity shows loop nav', opportunityBoard.includes('AsiLoopNav') && opportunityBoard.includes('current="discover"'));

const evidenceBoard = read('components/ai-search-intelligence/evidence-explorer/EvidenceExplorerBoard.tsx');
assert('evidence CTA opens gap', evidenceBoard.includes('href="/intelligence/competitor-gap"'));
assert('evidence shows loop nav', evidenceBoard.includes('current="explain"'));

const gapBoard = read('components/ai-search-intelligence/competitor-gap/CompetitorGapBoard.tsx');
assert('gap CTA opens action', gapBoard.includes('href="/intelligence/next-best-action"'));
assert('gap shows loop nav', gapBoard.includes('current="compete"'));

const actionBoard = read('components/ai-search-intelligence/next-action/NextActionBoard.tsx');
assert('action CTA marks fixed → monitor', actionBoard.includes('href="/intelligence/visibility-monitor"') && actionBoard.includes("t('ctaDone')"));
assert('action shows loop nav', actionBoard.includes('current="act"'));

const monitorBoard = read('components/ai-search-intelligence/visibility/VisibilityMonitorBoard.tsx');
assert('monitor CTA tracks change', monitorBoard.includes('href="#asi-trend"') && monitorBoard.includes("t('ctaTrack')"));
assert('monitor shows loop nav', monitorBoard.includes('current="monitor"'));
assert('monitor anchors trend + alerts', monitorBoard.includes('id="asi-trend"') && monitorBoard.includes('id="asi-alerts"'));

const warRoom = read('components/ai-search-intelligence/war-room/WarRoomDashboard.tsx');
assert('war room mounts loop panel', warRoom.includes('WarRoomLoopPanel'));
assert('war room starts loop', warRoom.includes("t('ctaLoop')"));

const loopPanel = read('components/ai-search-intelligence/war-room/WarRoomLoopPanel.tsx');
assert('loop panel shows health title', loopPanel.includes("t('healthTitle')"));
assert('loop panel shows vs last measurement', loopPanel.includes("t('vsLast')"));
assert('loop panel lists top 3 groups', loopPanel.includes("t('topOpportunity')") && loopPanel.includes("t('topGap')") && loopPanel.includes("t('topAction')"));
assert('loop panel lists alerts + trend', loopPanel.includes("t('alertTitle')") && loopPanel.includes("t('trend7')") && loopPanel.includes("t('trend30')"));
assert('loop panel leads with WHAT CHANGED', loopPanel.includes('WhatChanged') && loopPanel.includes('asi-changed'));
assert('loop panel asks the four result questions', loopPanel.includes("tSys('cards.why.title')") && loopPanel.includes("tSys('cards.who.title')") && loopPanel.includes("tSys('cards.do.title')") && loopPanel.includes("tSys('cards.worked.title')"));

const ko = JSON.parse(read('messages/ko.json')) as { intelligence: { loop: { healthTitle: string; vsLast: string }; action: { ctaDone: string }; monitor: { ctaTrack: string } } };
const en = JSON.parse(read('messages/en.json')) as { intelligence: { loop: { healthTitle: string; vsLast: string }; action: { ctaDone: string }; monitor: { ctaTrack: string } } };
assert('ko health title', ko.intelligence.loop.healthTitle === 'AI Search Score');
assert('en health title', en.intelligence.loop.healthTitle === 'AI Search Score');
assert('ko vs last', ko.intelligence.loop.vsLast.includes('last measurement') || ko.intelligence.loop.vsLast.includes('last'));
assert('en vs last', en.intelligence.loop.vsLast === 'vs last measurement');
assert('ko done CTA', ko.intelligence.action.ctaDone === '수정 완료');
assert('en done CTA', en.intelligence.action.ctaDone.includes('fixed'));
assert('ko track CTA', ko.intelligence.monitor.ctaTrack === '변화 추적');
assert('en track CTA', en.intelligence.monitor.ctaTrack.toLowerCase().includes('track'));

clearAsiCitationStore();
clearAsiVisibilityStore();
const mock = buildMockWarRoomSnapshot({ url: site.url }) as AsiWarRoomSnapshot;
const withLoop = attachAsiLoop(mock);
assert('attach keeps loop', Boolean(withLoop.loop));
assert('cleared stores do not invent mock tops', (withLoop.loop?.opportunities.length ?? 1) === 0);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
