/**
 * STEP 15 — durable visibility / core history (survives memory clear).
 * Run: npx tsx scripts/test-intelligence-history.ts
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ASI_HISTORY_KINDS } from '../lib/ai-search-intelligence/persist/kinds';
import { hydrateAsiHistory } from '../lib/ai-search-intelligence/persist/hydrate';
import {
	clearAsiPersistedHistory,
	persistAsiCoreSlice,
	readPersistedVisibilityRecords,
} from '../lib/ai-search-intelligence/persist/repository';
import { resetAsiHistoryHydration } from '../lib/ai-search-intelligence/persist/state';
import { buildVisibilityTrend } from '../lib/ai-search-intelligence/visibility/trend';
import {
	appendAsiVisibilityStore,
	clearAsiVisibilityStore,
	readAsiVisibilityStore,
} from '../lib/ai-search-intelligence/visibility/store';
import type { AsiVisibilityRecord } from '../lib/ai-search-intelligence/types';

process.env.ASI_PERSIST = '1';
process.env.ASI_HISTORY_DIR = mkdtempSync(join(tmpdir(), 'asi-history-'));

let failed = 0;

function assert(label: string, condition: boolean) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`);
}

assert('seven history kinds', ASI_HISTORY_KINDS.join() === 'observation,evidence,competitor,opportunity,action,visibility,alert');

const domain = 'history-step15.example';
clearAsiVisibilityStore(domain);
clearAsiPersistedHistory(domain);

function record(day: string, visibility: number): AsiVisibilityRecord {
	return {
		timestamp: `${day}T12:00:00.000Z`,
		cadence: 'daily',
		queryCount: 6,
		mention: visibility,
		visibility,
		recommendation: visibility - 10,
		citation: 20,
		sov: 12,
		providerScores: { chatgpt: visibility, gemini: visibility, perplexity: 0, claude: visibility },
		competitorScores: {},
		queries: [],
		source: 'live',
	};
}

appendAsiVisibilityStore(domain, record('2026-08-25', 51));
appendAsiVisibilityStore(domain, record('2026-08-26', 57));
appendAsiVisibilityStore(domain, record('2026-08-27', 61));
appendAsiVisibilityStore(domain, record('2026-08-28', 68));

assert('memory has 4 visibility days', readAsiVisibilityStore(domain).length === 4);
assert('disk has 4 visibility days', readPersistedVisibilityRecords(domain).length === 4);

clearAsiVisibilityStore(domain, { persist: false });
assert('memory clear does not drop disk', readAsiVisibilityStore(domain).length === 0 && readPersistedVisibilityRecords(domain).length === 4);

hydrateAsiHistory(domain, { brand: 'History', url: `https://${domain}` });
const reloaded = readAsiVisibilityStore(domain);
assert('hydrate restores visibility history', reloaded.length === 4);
assert('first day is 51', reloaded[0]?.visibility === 51);
assert('last day is 68', reloaded[3]?.visibility === 68);

const trend = buildVisibilityTrend({
	records: reloaded,
	window: '7d',
	brand: 'History',
	now: Date.parse('2026-08-28T18:00:00.000Z'),
});
assert('+17 is last minus first history point', (reloaded[3]?.visibility ?? 0) - (reloaded[0]?.visibility ?? 0) === 17);
assert('trend keeps four history points', trend.points.length === 4);
assert('7d uses first-in-window as previous', trend.hasPrevious === true && trend.kpis.visibility.previous === 51);
assert('7d change is +17', trend.kpis.visibility.change === 17);

persistAsiCoreSlice(domain, {
	opportunities: [
		{
			query: '지역 병원 추천',
			priority: { value: 80, provenance: 'derived' },
			reason: '추천 공백',
			missingSignals: ['entity'],
			estimatedImpact: { value: 40, provenance: 'derived' },
			recommendedAction: '엔티티 페이지 보강',
		},
	],
	alerts: [
		{
			type: 'visibility_drop',
			severity: 'info',
			message: '관측',
			previousValue: { value: 51, provenance: 'observed' },
			currentValue: { value: 68, provenance: 'observed' },
			createdAt: '2026-08-28T12:00:00.000Z',
		},
	],
});

clearAsiPersistedHistory(domain);
resetAsiHistoryHydration(domain);
assert('domain history can be cleared', readPersistedVisibilityRecords(domain).length === 0);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
