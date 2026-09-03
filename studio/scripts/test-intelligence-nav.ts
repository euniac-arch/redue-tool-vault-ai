/**
 * AI SEARCH INTELLIGENCE nav + route resolver.
 * Run: npx tsx scripts/test-intelligence-nav.ts
 */
import { ASI_FEATURES, ASI_PILLARS, resolveAsiPathname, resolveAsiRoute } from '../lib/ai-search-intelligence/routes';
import {
	PUBLIC_NAV,
	isPublicNavChildActive,
	isPublicNavItemActive,
} from '../lib/nav/public-nav';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const intelligence = PUBLIC_NAV.find((item) => item.key === 'aiSearchIntelligence');
const scanner = PUBLIC_NAV[0];
const insights = PUBLIC_NAV.find((item) => item.key === 'insightsHub');

assert('GNB has 6 top-level items', PUBLIC_NAV.length === 6, String(PUBLIC_NAV.length));
assert('scanner stays first', scanner?.key === 'scanner');
assert('intelligence is second', PUBLIC_NAV[1]?.key === 'aiSearchIntelligence');
assert('existing 1-depth keys remain', Boolean(insights && PUBLIC_NAV.some((item) => item.key === 'portfolio')));
assert('intelligence has 6 thinking-flow groups', intelligence?.children?.length === 6, String(intelligence?.children?.length));
assert(
	'GNB children match IA groups, not a 16-tool list',
	intelligence?.children?.map((child) => child.href).join() === ASI_PILLARS.map((group) => group.href).join(),
);
assert('IA still has 16 unique tools', ASI_FEATURES.length === 16);
assert(
	'no duplicate tool ids',
	new Set(ASI_FEATURES.map((tool) => tool.id)).size === 16,
);
assert('insights still has 4 children', insights?.children?.length === 4, String(insights?.children?.length));

assert(
	'parent active on /intelligence/brand-perception',
	isPublicNavItemActive('/intelligence/brand-perception', intelligence!),
);
assert(
	'parent still active on legacy nested path',
	isPublicNavItemActive('/intelligence/perception/brand', intelligence!),
);
assert('scanner not active on intelligence', !isPublicNavItemActive('/intelligence', scanner!));
assert('insights not active on intelligence', !isPublicNavItemActive('/intelligence/war-room', insights!));
assert(
	'monitor group active on product home',
	isPublicNavChildActive('/intelligence', '', { href: '/intelligence', key: 'asiMonitor' }),
);
assert(
	'brand-perception child active on canonical tool',
	isPublicNavChildActive('/intelligence/brand-perception', '', {
		href: '/intelligence/brand-perception',
		key: 'asiBrandPerception',
	}),
);
assert(
	'brand-perception child active on legacy nested tool',
	isPublicNavChildActive('/intelligence/perception/brand', '', {
		href: '/intelligence/brand-perception',
		key: 'asiBrandPerception',
	}),
);
assert(
	'war-room child not active on perception',
	!isPublicNavChildActive('/intelligence/brand-perception', '', {
		href: '/intelligence',
		key: 'asiMonitor',
	}),
);
assert(
	'insights column not active on intelligence',
	!isPublicNavChildActive('/intelligence', '', { href: '/insights?tab=insights', key: 'insightsColumn' }),
);

assert('IA has 6 groups', ASI_PILLARS.length === 6);
assert('IA has 16 tools', ASI_PILLARS.reduce((sum, pillar) => sum + pillar.tools.length, 0) === 16);
assert('discover starts with query intelligence', ASI_PILLARS[0]?.id === 'discover' && ASI_PILLARS[0].tools[0]?.id === 'questions');
assert('measure includes visibility + perception + sov + recommendation', ASI_PILLARS.find((g) => g.id === 'measure')?.tools.map((t) => t.id).join() === 'visibility,brand,sov,test');
assert('monitor is not a 17th tool', !ASI_FEATURES.some((tool) => tool.id === 'alert'));
assert(
	'next-best-action is canonical',
	resolveAsiRoute(['next-best-action']).tool.id === 'action' && !resolveAsiRoute(['next-best-action']).redirectTo,
);
assert(
	'recommendation/action aliases next-best-action',
	resolveAsiRoute(['recommendation', 'action']).redirectTo === '/intelligence/next-best-action',
);
assert('home resolves to war-room', resolveAsiRoute([]).tool.id === 'war-room' && !resolveAsiRoute([]).redirectTo);
assert('war-room slug has no extra redirect', !resolveAsiRoute(['war-room']).redirectTo);
assert('flat brand-perception is canonical', !resolveAsiRoute(['brand-perception']).redirectTo);
assert('perception default is brand', resolveAsiRoute(['perception']).tool.id === 'brand');
assert(
	'perception hub redirects to brand-perception',
	resolveAsiRoute(['perception']).redirectTo === '/intelligence/brand-perception',
);
assert(
	'legacy perception/brand redirects to brand-perception',
	resolveAsiRoute(['perception', 'brand']).redirectTo === '/intelligence/brand-perception',
);
assert('unknown pillar redirects home', resolveAsiRoute(['not-a-pillar']).redirectTo === '/intelligence');
assert(
	'unknown tool under perception redirects to brand-perception',
	resolveAsiRoute(['perception', 'missing']).redirectTo === '/intelligence/brand-perception',
);
assert(
	'pathname resolver maps legacy nested URL',
	resolveAsiPathname('/intelligence/perception/reputation').tool.href === '/intelligence/reputation-radar',
);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
