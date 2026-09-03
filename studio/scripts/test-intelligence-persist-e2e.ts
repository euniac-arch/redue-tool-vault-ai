/**
 * STEP 19-D — persist / history / yesterday-vs-today audit.
 * Never prints secrets. Run: npx tsx scripts/test-intelligence-persist-e2e.ts
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compareAdjacentVisibility } from '../lib/ai-search-intelligence/visibility/compare';
import { hydrateAsiHistory } from '../lib/ai-search-intelligence/persist/hydrate';
import { ASI_HISTORY_KINDS } from '../lib/ai-search-intelligence/persist/kinds';
import {
	clearAsiPersistedHistory,
	persistAsiCoreSlice,
	persistAsiObservations,
	readAsiPersistedKind,
	readPersistedResponses,
	readPersistedVisibilityRecords,
} from '../lib/ai-search-intelligence/persist/repository';
import { isAsiPersistEnabled } from '../lib/ai-search-intelligence/persist/enabled';
import { resetAsiHistoryHydration } from '../lib/ai-search-intelligence/persist/state';
import {
	appendAsiVisibilityStore,
	clearAsiVisibilityStore,
	readAsiVisibilityStore,
} from '../lib/ai-search-intelligence/visibility/store';
import type { AIResponse, AsiVisibilityRecord } from '../lib/ai-search-intelligence/types';
import { observedOf } from '../lib/ai-search-intelligence/core/models';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const prismaModels = [...schema.matchAll(/^model (\w+)/gm)].map((m) => m[1]);
const asiModels = prismaModels.filter((name) => /Asi|Observation|Opportunity|Visibility|Intelligence/i.test(name));

console.log('========== Prisma ==========');
console.log(`models=${prismaModels.join(',')}`);
console.log(`asiRelatedModels=${asiModels.join(',') || 'NONE'}`);
console.log(`Project model exists=${prismaModels.includes('Project')} (audit CMS project, not ASI)`);

process.env.ASI_MODE = 'live';
process.env.ASI_PERSIST = '1';
process.env.ASI_HISTORY_DIR = mkdtempSync(join(tmpdir(), 'asi-19d-'));
const domain = 'step19d.example';

function vis(day: string, visibility: number): AsiVisibilityRecord {
	return {
		timestamp: `${day}T12:00:00.000Z`,
		cadence: 'daily',
		queryCount: 4,
		mention: visibility,
		visibility,
		recommendation: visibility - 10,
		citation: 18,
		sov: 14,
		providerScores: { chatgpt: visibility, gemini: visibility - 2, perplexity: 0, claude: visibility },
		competitorScores: {},
		queries: [],
		source: 'live',
	};
}

function response(query: string, answer: string): AIResponse {
	return {
		provider: 'chatgpt',
		query,
		answer,
		mentions: ['Sunshine'],
		recommendations: ['Sunshine'],
		citations: [],
		confidence: 0.72,
		timestamp: new Date().toISOString(),
		source: 'live',
	};
}

clearAsiVisibilityStore(domain);
clearAsiPersistedHistory(domain);

appendAsiVisibilityStore(domain, vis('2026-08-29', 51));
appendAsiVisibilityStore(domain, vis('2026-08-30', 63));

const diskVis = readPersistedVisibilityRecords(domain);
const cmp = compareAdjacentVisibility(diskVis);
console.log('\n========== yesterday vs today (file store, not Prisma) ==========');
console.log(`persistEnabled=${isAsiPersistEnabled()} root=${process.env.ASI_HISTORY_DIR}`);
console.log(`kinds=${ASI_HISTORY_KINDS.join(',')}`);
console.log(`visibilityRows=${diskVis.length} yesterday=${diskVis[0]?.visibility} today=${diskVis[1]?.visibility}`);
console.log(`compareFromDisk change=${cmp?.visibility.change} previousAt=${cmp?.previousAt} currentAt=${cmp?.currentAt}`);

clearAsiVisibilityStore(domain, { persist: false });
resetAsiHistoryHydration(domain);
console.log(`memory after clear=${readAsiVisibilityStore(domain).length} disk still=${readPersistedVisibilityRecords(domain).length}`);
hydrateAsiHistory(domain, { brand: 'Sunshine', url: 'https://step19d.example' });
console.log(`hydrate restored memory=${readAsiVisibilityStore(domain).length}`);

persistAsiObservations(domain, [response('대구 피부과 추천', '어제 답변')]);
persistAsiCoreSlice(domain, {
	observations: [
		{
			provider: 'chatgpt',
			query: '대구 피부과 추천',
			timestamp: '2026-08-30T12:00:00.000Z',
			source: 'live',
			answer: observedOf('오늘 답변'),
			brandMention: observedOf(true),
			recommendation: observedOf(true),
			competitors: observedOf([]),
			citations: observedOf([]),
			confidence: observedOf(0.72),
		},
	],
	evidence: [
		{
			source: 'news.example.com',
			url: observedOf('https://news.example.com/a'),
			title: 'example',
			sourceType: { value: 'news', provenance: 'derived' },
			relevance: { value: 10, provenance: 'derived' },
			citedBy: observedOf(['chatgpt' as const]),
			timestamp: '2026-08-30T12:00:00.000Z',
		},
	],
});

const rawAfter = readPersistedResponses(domain);
const obsKind = readAsiPersistedKind(domain, 'observation');
const evidenceKind = readAsiPersistedKind(domain, 'evidence');
console.log('\n========== observation overwrite ==========');
console.log(`observation records=${obsKind.length} (same provider+query should collapse to 1)`);
console.log(`AIResponse still readable=${rawAfter.length} evidenceKind=${evidenceKind.length}`);
const first = obsKind[0] as { answer?: unknown };
console.log(`payloadLooksLikeObservation=${Boolean(first && typeof first === 'object' && first.answer && typeof first.answer === 'object')}`);

const files = existsSync(process.env.ASI_HISTORY_DIR || '')
	? readdirSync(join(process.env.ASI_HISTORY_DIR as string, 'step19d.example'))
	: [];
console.log(`domain files=${files.join(',') || 'none'}`);

process.env.ASI_MODE = 'mock';
delete process.env.ASI_PERSIST;
console.log('\n========== default mock persist ==========');
console.log(`ASI_MODE=mock persistEnabled=${isAsiPersistEnabled()}`);

const gitignore = readFileSync(resolve(process.cwd(), '..', '.gitignore'), 'utf8');
console.log(`gitignore studio/.data=${gitignore.includes('studio/.data')}`);
console.log(`query kind exists=${(ASI_HISTORY_KINDS as readonly string[]).includes('query')}`);
console.log(`project kind exists=${(ASI_HISTORY_KINDS as readonly string[]).includes('project')}`);
