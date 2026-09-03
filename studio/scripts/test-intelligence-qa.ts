/**
 * STEP 12 QA contract: routes, GNB children, public API shape, no example secrets.
 * Run: npx tsx scripts/test-intelligence-qa.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nextAsiFilterIndex } from '../lib/ai-search-intelligence/filter-tab-nav';
import { ASI_FEATURES, resolveAsiRoute } from '../lib/ai-search-intelligence/routes';
import { asiRuntimePublicStatus } from '../lib/ai-search-intelligence/service/asi-service';
import { PUBLIC_NAV } from '../lib/nav/public-nav';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const canonical = [
	[],
	['war-room'],
	['brand-perception'],
	['reputation-radar'],
	['brand-snapshot'],
	['recommendation-test'],
	['recommendation-simulator'],
	['share-of-voice'],
	['competitor-analysis'],
	['citation-explorer'],
	['query-generator'],
	['visibility-monitor'],
	['agent-readiness'],
	['opportunity-finder'],
	['evidence-explorer'],
	['competitor-gap'],
	['next-best-action'],
] as const;

for (const slug of canonical) {
	const route = resolveAsiRoute(slug);
	assert(`canonical ${route.href} has no extra redirect`, !route.redirectTo);
}

assert('unknown pillar redirects home', resolveAsiRoute(['nope']).redirectTo === '/intelligence');
assert('perception default is brand', resolveAsiRoute(['perception']).tool.id === 'brand');

const intelligence = PUBLIC_NAV.find((item) => item.key === 'aiSearchIntelligence');
assert('scanner remains first GNB item', PUBLIC_NAV[0]?.key === 'scanner');
assert('insights hub still present', PUBLIC_NAV.some((item) => item.key === 'insightsHub'));
assert('canonical tools stay at 16', ASI_FEATURES.length === 16);
assert(
	'GNB intelligence children are 6 IA groups',
	intelligence?.children?.length === 6,
);

const status = asiRuntimePublicStatus();
assert('public status has mode', status.mode === 'mock' || status.mode === 'live' || status.mode === 'hybrid');
assert('public status has 4 providers', status.providers.length === 4);
assert(
	'public status leaks no keys',
	!JSON.stringify(status).includes('sk-') &&
		!JSON.stringify(status).includes('API_KEY') &&
		status.providers.every((row) => row.status === 'mock' || row.status === 'live' || row.status === 'unavailable'),
);
assert(
	'public status includes vendor',
	status.providers.every((row) => typeof row.vendor === 'string' && row.vendor.length > 0),
);

const example = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
assert('example has no live-looking OpenAI key', !example.includes('sk-proj-'));
assert('example has no live-looking Anthropic key', !example.includes('sk-ant-'));
assert('example documents ASI_MODE', example.includes('ASI_MODE=mock'));
assert('example documents hybrid mode', example.includes('ASI_MODE=hybrid'));

assert('filter ArrowRight wraps last to first', nextAsiFilterIndex(4, 'ArrowRight', 5) === 0);
assert('filter ArrowLeft wraps first to last', nextAsiFilterIndex(0, 'ArrowLeft', 5) === 4);
assert('filter ArrowRight steps forward', nextAsiFilterIndex(1, 'ArrowRight', 5) === 2);
assert('filter ArrowLeft steps backward', nextAsiFilterIndex(2, 'ArrowLeft', 5) === 1);

const chrome = readFileSync(resolve(process.cwd(), 'lib/ui/asi-chrome.ts'), 'utf8');
assert('hover motion respects reduced-motion', chrome.includes('motion-reduce:transition-none'));
assert('hover motion keeps color transition token', chrome.includes('ASI_HOVER_MOTION'));

const warRoom = readFileSync(resolve(process.cwd(), 'components/ai-search-intelligence/war-room/WarRoomDashboard.tsx'), 'utf8');
const recommend = readFileSync(
	resolve(process.cwd(), 'components/ai-search-intelligence/recommendation/RecommendCompetitorsPanel.tsx'),
	'utf8',
);
assert('war room competitor table uses shared AsiDataTable', warRoom.includes('AsiDataTable'));
assert('recommendation competitor table uses shared AsiDataTable', recommend.includes('AsiDataTable'));
assert('war room no longer inlines competitor table markup', !warRoom.includes('<thead>'));
assert('recommendation no longer inlines competitor table markup', !recommend.includes('<thead>'));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
