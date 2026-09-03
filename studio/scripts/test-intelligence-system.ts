/**
 * STEP 10 — result-first system UX. No invented change numbers.
 * Run: npx tsx scripts/test-intelligence-system.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { composeAsiLoopChanges, emptyAsiLoopChanges } from '../lib/ai-search-intelligence/loop/changes';
import { composeAsiLoop } from '../lib/ai-search-intelligence/loop/compose';
import { clearAsiVisibilityStore, appendAsiVisibilityStore } from '../lib/ai-search-intelligence/visibility/store';
import { buildVisibilityRecord } from '../lib/ai-search-intelligence/visibility/score';
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

function read(rel: string) {
	return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

const empty = emptyAsiLoopChanges();
assert('empty changes has no previous', empty.hasPrevious === false);
assert('empty changes invents no query gain', empty.queryExposure === null);
assert('empty changes invents no citation', empty.citation === null);
assert('empty changes invents no competitor', empty.competitorName === null && empty.competitorChange === null);

const miss: AIResponse = {
	provider: 'chatgpt',
	query: '대구 흉터 치료 추천',
	answer: '덴서티를 추천합니다.',
	mentions: ['덴서티'],
	recommendations: ['덴서티'],
	citations: [{ source: 'news', url: 'https://news.example.com/d', type: 'news', relevance: 70, authority: 70 }],
	confidence: 0.7,
	timestamp: '2026-03-01T00:00:00.000Z',
	source: 'live',
};
const win: AIResponse = {
	...miss,
	answer: 'Sunshine을 추천합니다.',
	mentions: ['Sunshine'],
	recommendations: ['Sunshine'],
	citations: [{ source: '공식', url: 'https://sunshineclinic.kr', type: 'official', relevance: 80, authority: 80 }],
};

const previous = buildVisibilityRecord({ responses: [miss], brand: 'Sunshine', aliases: ['Sunshine'], source: 'live' });
const latest = buildVisibilityRecord({ responses: [win], brand: 'Sunshine', aliases: ['Sunshine'], source: 'live' });
const gained = composeAsiLoopChanges(latest, previous);
assert('two records mark hasPrevious', gained.hasPrevious);
assert('query exposure is observed count', gained.queryExposure === 1);
assert('citation change is observed', gained.citation != null);
assert('single record invents no change', composeAsiLoopChanges(latest, null).hasPrevious === false);

clearAsiVisibilityStore();
const site = {
	url: 'https://sunshineclinic.kr',
	brandName: 'Sunshine',
	domain: 'sunshineclinic.kr',
	location: '대구',
	category: '흉터',
};
const loopEmpty = composeAsiLoop({ site, fallbackVisibility: 50 });
assert('compose without store invents no WHAT CHANGED', loopEmpty.changes.hasPrevious === false);
appendAsiVisibilityStore(site.domain, { ...previous, timestamp: '2026-03-01T00:00:00.000Z', visibility: 40 });
appendAsiVisibilityStore(site.domain, { ...latest, timestamp: '2026-03-20T00:00:00.000Z', visibility: 68 });
const loopFilled = composeAsiLoop({ site, fallbackVisibility: 0 });
assert('compose health uses last measurement', loopFilled.health.current === 68 && loopFilled.health.previous === 40);
assert('compose change is observed', loopFilled.health.change === 28 && loopFilled.health.changeProvenance === 'observed');
assert('compose changes come from stored records', loopFilled.changes.hasPrevious && loopFilled.changes.queryExposure === 1);

const layout = read('components/ai-search-intelligence/shell/AiIntelligenceLayout.tsx');
assert('layout hero uses product name', layout.includes("t('productName')") && layout.includes('<h1'));
assert('layout hero uses tagline', layout.includes("t('productTagline')"));

const panel = read('components/ai-search-intelligence/war-room/WarRoomLoopPanel.tsx');
assert('home shows WHAT CHANGED', panel.includes('WHAT CHANGED') || panel.includes("t('changed.title')") || panel.includes('changed.title'));
assert('home does not hardcode 68', !panel.includes('68') && !panel.includes('+12') && !panel.includes('+14'));
assert('feature view does not lock the system home', !read('components/ai-search-intelligence/AsiFeatureView.tsx').includes("tool === 'war-room') return gated"));

const boards = [
	['opportunity', 'components/ai-search-intelligence/opportunity/OpportunityBoard.tsx', 'changed'],
	['evidence', 'components/ai-search-intelligence/evidence-explorer/EvidenceExplorerBoard.tsx', 'why'],
	['gap', 'components/ai-search-intelligence/competitor-gap/CompetitorGapBoard.tsx', 'who'],
	['action', 'components/ai-search-intelligence/next-action/NextActionBoard.tsx', 'do'],
	['monitor', 'components/ai-search-intelligence/visibility/VisibilityMonitorBoard.tsx', 'worked'],
] as const;
for (const [name, file, question] of boards) {
	assert(`${name} answers a system question`, read(file).includes('AsiSystemQuestion') && read(file).includes(`question="${question}"`));
}

const ko = JSON.parse(read('messages/ko.json')) as {
	intelligence: { productTagline: string; system: { changed: { title: string }; questions: { now: string } } };
};
const en = JSON.parse(read('messages/en.json')) as {
	intelligence: { productTagline: string; system: { changed: { title: string } } };
};
assert('ko tagline is the system promise', ko.intelligence.productTagline.includes('측정하고') && ko.intelligence.productTagline.includes('알려드립니다'));
assert('ko WHAT CHANGED title', ko.intelligence.system.changed.title === 'WHAT CHANGED?');
assert('en WHAT CHANGED title', en.intelligence.system.changed.title === 'WHAT CHANGED?');
assert('ko now question', ko.intelligence.system.questions.now.includes('상태'));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
