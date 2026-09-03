/**
 * OBSERVED vs DERIVED catalog + UI wiring across all 12 ASI tools.
 * Run: npx tsx scripts/test-intelligence-provenance.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	ASI_FEATURE_METRICS,
	ASI_METRICS,
	defaultBadgeForProvenance,
	getAsiMetric,
	isLiveObserved,
	observedBadgeForSource,
} from '../lib/ai-search-intelligence/provenance';
import { ASI_FEATURES } from '../lib/ai-search-intelligence/routes';

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

assert('16 tools in IA', ASI_FEATURES.length === 16);
assert(
	'catalog covers every tool',
	ASI_FEATURES.every((tool) => (ASI_FEATURE_METRICS[tool.id] ?? []).length > 0),
);

for (const tool of ASI_FEATURES) {
	const metrics = ASI_FEATURE_METRICS[tool.id];
	assert(`${tool.id} has metrics`, metrics.length > 0);
	for (const id of metrics) {
		const def = getAsiMetric(id);
		assert(`${tool.id} · ${id} provenance`, def.provenance === 'observed' || def.provenance === 'derived');
		assert(
			`${tool.id} · ${id} badge matches kind`,
			def.provenance === 'observed'
				? def.badge === 'observed' || def.badge === 'live_result' || def.badge === 'actual_response'
				: def.badge === 'redue_analysis' || def.badge === 'estimated' || def.badge === 'derived_score',
		);
	}
}

const derivedScores = ['trustScore', 'recommendationPotential', 'agentReadiness', 'visibilityScore'] as const;
assert(
	'headline derived scores never use observed badges',
	derivedScores.every((id) => ASI_METRICS[id].provenance === 'derived' && ASI_METRICS[id].badge !== 'observed'),
);
assert('live source is observed', isLiveObserved('live', false) === true);
assert('fallback is not live observed', isLiveObserved('live', true) === false);
assert('mock is not live observed', isLiveObserved('mock') === false);
assert('live answer badge is ACTUAL RESPONSE', observedBadgeForSource('live', false, 'answer') === 'actual_response');
assert('live rank badge is LIVE RESULT', observedBadgeForSource('live', false) === 'live_result');
assert('mock answer still actual_response kind', observedBadgeForSource('mock', false, 'answer') === 'actual_response');
assert('default derived badge is REDUE ANALYSIS', defaultBadgeForProvenance('derived') === 'redue_analysis');

const files: Record<string, string> = {
	'war-room': 'components/ai-search-intelligence/war-room/WarRoomDashboard.tsx',
	brand: 'components/ai-search-intelligence/perception/BrandPerceptionPanel.tsx',
	reputation: 'components/ai-search-intelligence/perception/ReputationRadarPanel.tsx',
	snapshot: 'components/ai-search-intelligence/perception/BrandSnapshotPanel.tsx',
	test: 'components/ai-search-intelligence/recommendation/RecommendTestPanel.tsx',
	simulator: 'components/ai-search-intelligence/recommendation/RecommendSimulatorPanel.tsx',
	sov: 'components/ai-search-intelligence/recommendation/RecommendSovPanel.tsx',
	competitors: 'components/ai-search-intelligence/recommendation/RecommendCompetitorsPanel.tsx',
	citations: 'components/ai-search-intelligence/evidence/CitationExplorerPanel.tsx',
	questions: 'components/ai-search-intelligence/evidence/QuestionGeneratorPanel.tsx',
	visibility: 'components/ai-search-intelligence/visibility/VisibilityMonitorBoard.tsx',
	'agent-readiness': 'components/ai-search-intelligence/future/AgentReadinessDashboard.tsx',
	opportunity: 'components/ai-search-intelligence/opportunity/OpportunityBoard.tsx',
	explorer: 'components/ai-search-intelligence/evidence-explorer/EvidenceExplorerBoard.tsx',
	gap: 'components/ai-search-intelligence/competitor-gap/CompetitorGapBoard.tsx',
	action: 'components/ai-search-intelligence/next-action/NextActionBoard.tsx',
};

for (const tool of ASI_FEATURES) {
	const src = read(files[tool.id]);
	assert(`${tool.id} file exists`, src.length > 0);
	assert(
		`${tool.id} wires provenance`,
		src.includes('metric=') || src.includes('provenance=') || src.includes('AsiProvenanceBadge'),
	);
}

const score = read('components/ai-search-intelligence/primitives/AsiScore.tsx');
assert('AsiScore requires metric tooltip hook', score.includes('AsiMetricTooltip') && score.includes('AsiProvenanceBadge'));
const chrome = read('components/ai-search-intelligence/primitives/AsiPageChrome.tsx');
assert('page chrome shows provenance legend', chrome.includes('AsiProvenanceLegend'));
const answer = read('components/ai-search-intelligence/primitives/AsiAnswerResult.tsx');
assert('answer result is observed', answer.includes('observedBadgeForSource') && answer.includes('actualAnswer'));
const testPanel = read('components/ai-search-intelligence/recommendation/RecommendTestPanel.tsx');
assert('test panel no longer says 추정 순위', !testPanel.includes('추정 순위'));
assert('test panel uses actualRank', testPanel.includes('actualRank'));
const sim = read('components/ai-search-intelligence/recommendation/RecommendSimulatorPanel.tsx');
assert('simulator marks potential as derived', sim.includes('recommendationPotential'));

const ko = JSON.parse(read('messages/ko.json')) as { intelligence: { provenance: { metric: Record<string, string>; badge: Record<string, string> } } };
const en = JSON.parse(read('messages/en.json')) as { intelligence: { provenance: { metric: Record<string, string>; badge: Record<string, string> } } };
for (const id of Object.keys(ASI_METRICS)) {
	assert(`ko tooltip ${id}`, Boolean(ko.intelligence.provenance.metric[id]));
	assert(`en tooltip ${id}`, Boolean(en.intelligence.provenance.metric[id]));
}
assert('ko has OBSERVED badge', ko.intelligence.provenance.badge.observed === 'OBSERVED');
assert('ko has REDUE ANALYSIS badge', ko.intelligence.provenance.badge.redue_analysis === 'REDUE ANALYSIS');

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
