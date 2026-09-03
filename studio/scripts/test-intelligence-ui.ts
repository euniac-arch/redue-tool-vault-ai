/**
 * ASI component-level contracts: filter keyboard, shared table, reduced-motion token.
 * Run: npx tsx scripts/test-intelligence-ui.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nextAsiFilterIndex } from '../lib/ai-search-intelligence/filter-tab-nav';
import { isAsiResultLive } from '../lib/ai-search-intelligence/client/use-asi-abort';

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

assert('ArrowRight wraps last to first', nextAsiFilterIndex(2, 'ArrowRight', 3) === 0);
assert('ArrowLeft wraps first to last', nextAsiFilterIndex(0, 'ArrowLeft', 3) === 2);
assert('ArrowRight steps forward', nextAsiFilterIndex(0, 'ArrowRight', 3) === 1);

const tabList = read('components/ai-search-intelligence/primitives/AsiFilterTabList.tsx');
assert('tablist handles ArrowLeft', tabList.includes("event.key !== 'ArrowLeft'"));
assert('tablist handles ArrowRight', tabList.includes("event.key !== 'ArrowRight'"));
assert('tablist focuses next chip', tabList.includes('next?.focus()'));
assert('tablist reuses click', tabList.includes('next?.click()'));

const chip = read('components/ai-search-intelligence/primitives/AsiFilterChip.tsx');
assert('chip keeps role=tab', chip.includes('role="tab"'));
assert('chip keeps aria-selected', chip.includes('aria-selected={active}'));
assert('chip keeps onClick', chip.includes('onClick={onClick}'));

const table = read('components/ai-search-intelligence/primitives/AsiDataTable.tsx');
assert('shared table renders thead/tbody', table.includes('<thead>') && table.includes('<tbody>'));
assert('war room uses shared table', read('components/ai-search-intelligence/war-room/WarRoomDashboard.tsx').includes('AsiDataTable'));
assert(
	'recommendation uses shared table',
	read('components/ai-search-intelligence/recommendation/RecommendCompetitorsPanel.tsx').includes('AsiDataTable'),
);

const badge = read('components/ai-search-intelligence/primitives/AsiSourceBadge.tsx');
assert('source badge has fallback tone', badge.includes('fallback:'));
const answer = read('components/ai-search-intelligence/primitives/AsiAnswerResult.tsx');
assert('answer result can show source badge', answer.includes('AsiSourceBadge'));
assert('answer result marks observed provenance', answer.includes('AsiProvenanceBadge'));
const testPanel = read('components/ai-search-intelligence/recommendation/RecommendTestPanel.tsx');
assert('recommend test passes row source', testPanel.includes('source={result.source}'));
const score = read('components/ai-search-intelligence/primitives/AsiScore.tsx');
assert('score shows derived/observed tooltip', score.includes('AsiMetricTooltip'));
const legend = read('components/ai-search-intelligence/primitives/AsiProvenanceLegend.tsx');
assert('legend explains both kinds', legend.includes('legendObserved') && legend.includes('legendDerived'));

const chrome = read('lib/ui/asi-chrome.ts');
assert('hover token keeps color transition', chrome.includes('ASI_HOVER_MOTION'));
assert('hover token drops motion when reduced', chrome.includes('motion-reduce:transition-none'));
assert('focus ring uses hover token', chrome.includes('ASI_HOVER_MOTION') && chrome.includes('asiFocusRing'));

const first = new AbortController();
const second = new AbortController();
assert('live result matches current signal', isAsiResultLive(true, first.signal, first.signal));
assert('replaced signal is stale', !isAsiResultLive(true, second.signal, first.signal));
assert('unmounted signal is ignored', !isAsiResultLive(false, first.signal, first.signal));

const dashboards = [
	'components/ai-search-intelligence/war-room/WarRoomDashboard.tsx',
	'components/ai-search-intelligence/perception/PerceptionDashboard.tsx',
	'components/ai-search-intelligence/recommendation/RecommendationDashboard.tsx',
	'components/ai-search-intelligence/evidence/EvidenceDashboard.tsx',
	'components/ai-search-intelligence/future/AgentReadinessDashboard.tsx',
	'components/ai-search-intelligence/opportunity/OpportunityDashboard.tsx',
	'components/ai-search-intelligence/evidence-explorer/EvidenceExplorerDashboard.tsx',
	'components/ai-search-intelligence/competitor-gap/CompetitorGapDashboard.tsx',
	'components/ai-search-intelligence/next-action/NextActionDashboard.tsx',
	'components/ai-search-intelligence/visibility/VisibilityMonitorDashboard.tsx',
];
const analysisHook = read('lib/ai-search-intelligence/client/use-asi-analysis.ts');
assert('shared analysis hook aborts via useAsiAbort', analysisHook.includes('useAsiAbort()') || analysisHook.includes('useAsiAbort('));
assert('shared analysis hook ignores stale results', analysisHook.includes('if (!isLive(signal)) return'));

for (const file of dashboards) {
	const src = read(file);
	const viaHook = src.includes('useAsiAnalysis');
	assert(
		`${file} aborts via useAsiAbort`,
		viaHook || src.includes('useAsiAbort()') || src.includes('useAsiAbort('),
	);
	assert(
		`${file} ignores stale results`,
		viaHook || src.includes('if (!isLive(signal)) return'),
	);
}

assert(
	'in-product nav is grouped IA, not a 16-tool grid',
	read('components/ai-search-intelligence/shell/AiIntelligenceLayout.tsx').includes('AsiIaNav') &&
		!read('components/ai-search-intelligence/shell/AiIntelligenceLayout.tsx').includes('AsiToolNav'),
);
assert(
	'feature view uses entitlement gate',
	read('components/ai-search-intelligence/AsiFeatureView.tsx').includes('AsiEntitlementGate'),
);
const warRoom = read('components/ai-search-intelligence/war-room/WarRoomDashboard.tsx');
assert('war room mounts Intelligence Loop', warRoom.includes('WarRoomLoopPanel'));
assert('system home stays visible without a full war-room gate', !read('components/ai-search-intelligence/AsiFeatureView.tsx').includes("if (tool === 'war-room') return gated"));
assert('opportunity board links Evidence', read('components/ai-search-intelligence/opportunity/OpportunityBoard.tsx').includes('/intelligence/evidence-explorer'));
assert('action board links Monitor', read('components/ai-search-intelligence/next-action/NextActionBoard.tsx').includes('/intelligence/visibility-monitor'));
assert(
	'loop boards answer a system question',
	read('components/ai-search-intelligence/opportunity/OpportunityBoard.tsx').includes('AsiSystemQuestion') &&
		read('components/ai-search-intelligence/evidence-explorer/EvidenceExplorerBoard.tsx').includes('AsiSystemQuestion') &&
		read('components/ai-search-intelligence/competitor-gap/CompetitorGapBoard.tsx').includes('AsiSystemQuestion'),
);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
