/**
 * STEP 13.8 — ADMIN QA matrix.
 * FREE / MEMBER block PRO. PRO / ADMIN open PRO — including real screens.
 * Run: npx tsx scripts/test-intelligence-admin-qa.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GET, POST } from '../app/api/intelligence/route';
import { authorizeAsiRequest, ASI_HARD_PRO_OPERATIONS } from '../lib/ai-search-intelligence/entitlement/authorize';
import { canAccessFeature } from '../lib/ai-search-intelligence/entitlement/can-access';
import {
	ASI_ENTITLEMENT_FEATURES,
	ASI_FEATURE_MIN_TIER,
	ASI_PRO_PRODUCTS,
} from '../lib/ai-search-intelligence/entitlement/catalog';
import { clipAsiSnapshot } from '../lib/ai-search-intelligence/entitlement/clip';
import { asiFeatureForTool } from '../lib/ai-search-intelligence/entitlement/feature-for-tool';
import { resolveAsiLockIntent } from '../lib/ai-search-intelligence/entitlement/lock-cta';
import { actorFromTier, publicAsiEntitlement } from '../lib/ai-search-intelligence/entitlement/actor-model';
import { resolveAsiTier } from '../lib/ai-search-intelligence/entitlement/tiers';
import { ASI_FEATURES, type AsiToolId } from '../lib/ai-search-intelligence/routes';
import type { AsiOpportunitySnapshot } from '../lib/ai-search-intelligence/types';

const PRO_FEATURES = ASI_ENTITLEMENT_FEATURES.filter((feature) => ASI_FEATURE_MIN_TIER[feature] === 'pro');
const GATED_TOOLS: AsiToolId[] = ['war-room', 'sov', 'competitors', 'gap', 'action'];

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

function post(operation: string, tier?: 'guest' | 'member' | 'pro' | 'admin', extra?: Record<string, unknown>) {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (tier && tier !== 'guest') headers['x-asi-test-tier'] = tier;
	return POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers,
			body: JSON.stringify({ operation, url: 'https://sunshineclinic.kr', ...extra }),
		}),
	);
}

assert('PRO feature list is not empty', PRO_FEATURES.length >= 11);
assert(
	'PRO product map is covered',
	ASI_PRO_PRODUCTS.every((row) => PRO_FEATURES.includes(row.feature)),
);

for (const feature of PRO_FEATURES) {
	assert(`FREE blocks ${feature}`, !canAccessFeature(actorFromTier('guest'), feature));
	assert(`MEMBER blocks ${feature}`, !canAccessFeature(actorFromTier('member'), feature));
	assert(`PRO allows ${feature}`, canAccessFeature(actorFromTier('pro'), feature));
	assert(`ADMIN allows ${feature}`, canAccessFeature(actorFromTier('admin'), feature));
	assert(`ADMIN lock CTA enters ${feature}`, resolveAsiLockIntent(actorFromTier('admin'), feature) === 'enter');
	assert(`PRO lock CTA enters ${feature}`, resolveAsiLockIntent(actorFromTier('pro'), feature) === 'enter');
	assert(`FREE lock CTA does not enter ${feature}`, resolveAsiLockIntent(actorFromTier('guest'), feature) !== 'enter');
	assert(`MEMBER lock CTA does not enter ${feature}`, resolveAsiLockIntent(actorFromTier('member'), feature) !== 'enter');
}

for (const tool of GATED_TOOLS) {
	const feature = asiFeatureForTool(tool);
	assert(`screen ${tool} gates ${feature}`, ASI_FEATURE_MIN_TIER[feature] === 'pro');
	assert(`FREE screen ${tool} locked`, !canAccessFeature(actorFromTier('guest'), feature));
	assert(`MEMBER screen ${tool} locked`, !canAccessFeature(actorFromTier('member'), feature));
	assert(`PRO screen ${tool} open`, canAccessFeature(actorFromTier('pro'), feature));
	assert(`ADMIN screen ${tool} open`, canAccessFeature(actorFromTier('admin'), feature));
}

for (const tool of ASI_FEATURES) {
	const feature = asiFeatureForTool(tool.id);
	if (ASI_FEATURE_MIN_TIER[feature] !== 'pro') continue;
	assert(`ADMIN opens gated tool ${tool.id}`, canAccessFeature(actorFromTier('admin'), feature));
}

assert(
	'ADMIN is not rewritten to PRO',
	resolveAsiTier({ isLoggedIn: true, planId: 'starter', role: 'admin', isAdmin: true }) === 'admin',
);
assert('ADMIN public role stays ADMIN', publicAsiEntitlement(actorFromTier('admin')).planRole === 'ADMIN');
assert('PRO public role stays PRO', publicAsiEntitlement(actorFromTier('pro')).planRole === 'PRO');

const rows = Array.from({ length: 5 }, (_, i) => ({ queryId: `q${i}`, query: `q${i}`, score: 80, status: 'miss' }));
const guestClip = clipAsiSnapshot(
	'opportunity-finder',
	{ top: rows, rows } as unknown as AsiOpportunitySnapshot,
	actorFromTier('guest'),
);
const adminClip = clipAsiSnapshot(
	'opportunity-finder',
	{ top: rows, rows } as unknown as AsiOpportunitySnapshot,
	actorFromTier('admin'),
);
assert('FREE opportunity screen clips', guestClip.top.length === 1);
assert('ADMIN opportunity screen is full', adminClip.top.length === 5 && adminClip.rows.length === 5);

const view = read('components/ai-search-intelligence/AsiFeatureView.tsx');
assert('screens use entitlement gate', view.includes('AsiEntitlementGate') && view.includes('asiFeatureForTool'));
assert('screens do not branch if admin', !view.includes('if (admin') && !view.includes("tier === 'admin'"));
assert(
	'gate opens children when canAccessFeature',
	read('components/ai-search-intelligence/entitlement/AsiEntitlementGate.tsx').includes(
		'if (canAccessFeature(actor, feature)) return <>{children}</>',
	),
);
assert(
	'war-room screen uses canAccessFeature',
	read('components/ai-search-intelligence/war-room/WarRoomDashboard.tsx').includes("canAccessFeature(actor, 'war-room')"),
);
assert(
	'visibility screen uses canAccessFeature',
	read('components/ai-search-intelligence/visibility/VisibilityMonitorBoard.tsx').includes(
		"canAccessFeature(actor, 'visibility.monitor')",
	),
);

void (async () => {
	for (const operation of ASI_HARD_PRO_OPERATIONS) {
		const denied = authorizeAsiRequest(actorFromTier('guest'), { operation });
		assert(`authorize FREE ${operation}`, denied !== null);
		assert(`authorize MEMBER ${operation}`, authorizeAsiRequest(actorFromTier('member'), { operation }) !== null);
		assert(`authorize PRO ${operation}`, authorizeAsiRequest(actorFromTier('pro'), { operation }) === null);
		assert(`authorize ADMIN ${operation}`, authorizeAsiRequest(actorFromTier('admin'), { operation }) === null);

		const guest = await post(operation);
		assert(`API FREE ${operation} is 403`, guest.status === 403);
		const member = await post(operation, 'member');
		assert(`API MEMBER ${operation} is 403`, member.status === 403);
		const pro = await post(operation, 'pro');
		assert(`API PRO ${operation} is 200`, pro.status === 200);
		const admin = await post(operation, 'admin');
		assert(`API ADMIN ${operation} is 200`, admin.status === 200);
	}

	const guestSovFlag = await post('recommendation-test', 'guest', { expandSov: true });
	assert('API FREE spoof SOV is 403', guestSovFlag.status === 403);
	const memberSched = await post('visibility-monitor', 'member', { cadence: 'daily' });
	assert('API MEMBER spoof schedule is 403', memberSched.status === 403);
	const adminSched = await post('visibility-monitor', 'admin', { cadence: 'weekly' });
	assert('API ADMIN schedule is 200', adminSched.status === 200);
	const adminBulk = await post(
		'query-generator',
		'admin',
		{ queries: Array.from({ length: 20 }, (_, i) => `질문 ${i}`) },
	);
	assert('API ADMIN bulk query is 200', adminBulk.status === 200);

	const adminStatus = await GET(
		new Request('http://localhost/api/intelligence', { headers: { 'x-asi-test-tier': 'admin' } }),
	);
	const adminBody = (await adminStatus.json()) as { data?: { entitlement?: { tier?: string; planRole?: string } } };
	assert('GET ADMIN tier is admin', adminBody.data?.entitlement?.tier === 'admin');
	assert('GET ADMIN planRole is ADMIN', adminBody.data?.entitlement?.planRole === 'ADMIN');

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
