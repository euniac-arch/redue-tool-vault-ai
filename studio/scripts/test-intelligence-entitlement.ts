/**
 * ASI FREE / MEMBER / PRO entitlements — canAccess, no per-page plan checks.
 * Run: npx tsx scripts/test-intelligence-entitlement.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GET, POST } from '../app/api/intelligence/route';
import { canAccess, canAccessFeature, asiLimitsFor, asiRequiredTier } from '../lib/ai-search-intelligence/entitlement/can-access';
import { authorizeAsiRequest, ASI_HARD_PRO_OPERATIONS } from '../lib/ai-search-intelligence/entitlement/authorize';
import { ASI_ENTITLEMENT_FEATURES, ASI_FEATURE_MIN_TIER, ASI_OPERATION_FEATURE, ASI_PRO_PRODUCTS } from '../lib/ai-search-intelligence/entitlement/catalog';
import { asiHrefForFeature, resolveAsiLockIntent } from '../lib/ai-search-intelligence/entitlement/lock-cta';
import { asiHistoryCap } from '../lib/ai-search-intelligence/entitlement/history';
import { clipAsiSnapshot } from '../lib/ai-search-intelligence/entitlement/clip';
import { actorFromTier, publicAsiEntitlement } from '../lib/ai-search-intelligence/entitlement/actor-model';
import { clearAsiGuestRuns, consumeAsiGuestDiagnose } from '../lib/ai-search-intelligence/entitlement/quota';
import { asiPlanRole, resolveAsiTier } from '../lib/ai-search-intelligence/entitlement/tiers';
import { asiFeatureForTool } from '../lib/ai-search-intelligence/entitlement/feature-for-tool';
import type { AsiOpportunitySnapshot } from '../lib/ai-search-intelligence/types';

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

assert('guest is not pro', resolveAsiTier({ isLoggedIn: false }) === 'guest');
assert('starter member is member', resolveAsiTier({ isLoggedIn: true, planId: 'starter' }) === 'member');
assert('pro plan is pro', resolveAsiTier({ isLoggedIn: true, planId: 'pro' }) === 'pro');
assert('agency is business', resolveAsiTier({ isLoggedIn: true, planId: 'agency' }) === 'business');
assert('business plan is business', resolveAsiTier({ isLoggedIn: true, planId: 'business' }) === 'business');
assert('admin role is admin', resolveAsiTier({ isLoggedIn: true, planId: 'starter', role: 'admin' }) === 'admin');
assert('ADMIN jwt role is admin', resolveAsiTier({ isLoggedIn: true, planId: 'starter', role: 'ADMIN' }) === 'admin');
assert('isAdmin flag is admin', resolveAsiTier({ isLoggedIn: true, planId: 'starter', isAdmin: true }) === 'admin');
assert('starter admin is not rewritten to pro', resolveAsiTier({ isLoggedIn: true, planId: 'starter', role: 'admin' }) !== 'pro');
assert('starter without admin is member', resolveAsiTier({ isLoggedIn: true, planId: 'starter', role: 'user' }) === 'member');
assert('FREE maps from guest', asiPlanRole('guest') === 'FREE');
assert('MEMBER maps from member', asiPlanRole('member') === 'MEMBER');
assert('PRO maps from pro', asiPlanRole('pro') === 'PRO');
assert('BUSINESS maps from business', asiPlanRole('business') === 'BUSINESS');
assert('ADMIN maps from admin', asiPlanRole('admin') === 'ADMIN');
assert('public admin planRole is ADMIN', publicAsiEntitlement(actorFromTier('admin')).planRole === 'ADMIN');
assert('public admin tier stays admin', publicAsiEntitlement(actorFromTier('admin')).tier === 'admin');
assert(
	'no feature requires admin as a paid gate',
	ASI_ENTITLEMENT_FEATURES.every((feature) => ASI_FEATURE_MIN_TIER[feature] !== 'admin'),
);
assert(
	'no feature requires business as a paid gate',
	ASI_ENTITLEMENT_FEATURES.every((feature) => ASI_FEATURE_MIN_TIER[feature] !== 'business'),
);
assert(
	'admin can every feature without becoming pro',
	ASI_ENTITLEMENT_FEATURES.every((feature) => canAccess(feature, 'admin')),
);
assert('pro cannot be confused with admin', !ASI_ENTITLEMENT_FEATURES.every((feature) => canAccess(feature, 'member')));

assert('guest can diagnose', canAccess('diagnose', 'guest'));
assert('guest can partial opportunity', canAccess('opportunity.partial', 'guest'));
assert('guest cannot war-room', !canAccess('war-room', 'guest'));
assert('guest cannot gap', !canAccess('competitor.gap', 'guest'));
assert('guest cannot action', !canAccess('next-best-action', 'guest'));
assert('guest cannot sov', !canAccess('sov', 'guest'));
assert('member cannot full competitor intelligence', !canAccess('competitor.basic', 'member'));
assert('member cannot full opportunity', !canAccess('opportunity.basic', 'member'));
assert('member cannot full citation intelligence', !canAccess('evidence.basic', 'member'));
assert('member cannot bulk query', !canAccess('query.bulk', 'member'));
assert('member cannot full history', !canAccess('history', 'member'));
assert('member cannot gap', !canAccess('competitor.gap', 'member'));
assert('member cannot war-room', !canAccess('war-room', 'member'));
assert('pro can full opportunity', canAccess('opportunity.basic', 'pro'));
assert('pro can evidence explorer', canAccess('evidence.explorer', 'pro'));
assert('pro can visibility monitor', canAccess('visibility.monitor', 'pro'));
assert('pro can alert', canAccess('visibility.alert', 'pro'));
assert('pro can sov', canAccess('sov', 'pro'));
assert('pro can bulk query', canAccess('query.bulk', 'pro'));
assert('pro can full history', canAccess('history', 'pro'));
assert('guest history cap is 0', asiHistoryCap(actorFromTier('guest')) === 0);
assert('member history cap is 3', asiHistoryCap(actorFromTier('member')) === 3);
assert('pro history is unlimited', !Number.isFinite(asiHistoryCap(actorFromTier('pro'))));
assert(
	'PRO product map covers the paid tools',
	ASI_PRO_PRODUCTS.length === 11 && ASI_PRO_PRODUCTS.every((row) => ASI_FEATURE_MIN_TIER[row.feature] === 'pro'),
);
assert('pro can every gated feature', canAccess('war-room', 'pro') && canAccess('competitor.gap', 'pro') && canAccess('visibility.schedule', 'pro'));
assert('admin can every gated feature', canAccess('war-room', 'admin') && canAccess('competitor.gap', 'admin') && canAccess('visibility.schedule', 'admin'));
assert('admin outranks pro', asiLimitsFor('admin').monthlyQueries > asiLimitsFor('pro').monthlyQueries);
assert('business outranks pro quota', asiLimitsFor('business').monthlyQueries > asiLimitsFor('pro').monthlyQueries);
assert('business can pro features', canAccess('war-room', 'business') && canAccess('visibility.schedule', 'business'));
assert('FREE monthly quota is 10', asiLimitsFor('guest').monthlyQueries === 10);
assert('MEMBER monthly quota is 30', asiLimitsFor('member').monthlyQueries === 30);
assert('PRO monthly quota is 500', asiLimitsFor('pro').monthlyQueries === 500);
assert('BUSINESS monthly quota is 2000', asiLimitsFor('business').monthlyQueries === 2000);

assert('guest query cap is 2', asiLimitsFor('guest').queries === 2);
assert('member query cap is 6', asiLimitsFor('member').queries === 6);
assert('pro query cap is 10', asiLimitsFor('pro').queries === 10);
assert('guest one diagnose', asiLimitsFor('guest').diagnoses === 1);
assert('gap requires pro', asiRequiredTier('competitor.gap') === 'pro');

assert('war-room operation maps to war-room feature', ASI_OPERATION_FEATURE['war-room'] === 'war-room');
assert('opportunity stays open', ASI_OPERATION_FEATURE['opportunity-finder'] === 'opportunity.partial');
assert('tool war-room gates war-room', asiFeatureForTool('war-room') === 'war-room');
assert('tool opportunity stays diagnose', asiFeatureForTool('opportunity') === 'diagnose');

const rows = Array.from({ length: 5 }, (_, i) => ({ queryId: `q${i}`, query: `q${i}`, score: 80, status: 'miss' }));
const clipped = clipAsiSnapshot(
	'opportunity-finder',
	{ top: rows, rows } as unknown as AsiOpportunitySnapshot,
	actorFromTier('guest'),
);
assert('guest opportunity clips to 1', clipped.top.length === 1 && clipped.rows.length === 1);

clearAsiGuestRuns();
const guest = actorFromTier('guest');
assert('first guest diagnose ok', consumeAsiGuestDiagnose(guest, 'test-a').ok);
assert('second guest diagnose blocked', consumeAsiGuestDiagnose(guest, 'test-a').ok === false);
assert('member diagnose never blocks', consumeAsiGuestDiagnose(actorFromTier('member'), 'test-a').ok);

const canAccessSrc = read('lib/ai-search-intelligence/entitlement/can-access.ts');
assert('canAccessFeature is the single call-site API', canAccessSrc.includes('export function canAccessFeature'));
assert(
	'canAccessFeature(admin user, war-room)',
	canAccessFeature({ isLoggedIn: true, planId: 'starter', role: 'admin' }, 'war-room'),
);
assert(
	'canAccessFeature(member user, war-room) is false',
	!canAccessFeature({ isLoggedIn: true, planId: 'starter', role: 'user' }, 'war-room'),
);
assert('canAccessFeature(actor, feature)', canAccessFeature(actorFromTier('pro'), 'competitor.gap'));
const view = read('components/ai-search-intelligence/AsiFeatureView.tsx');
assert('pages use the gate, not plan === pro', view.includes('AsiEntitlementGate') && !view.includes("plan === 'pro'"));
assert('pages do not branch if admin', !view.includes('if (admin') && !view.includes("tier === 'admin'"));
assert('pages do not branch if pro', !view.includes("if (pro") && !view.includes("tier === 'pro'"));
const route = read('app/api/intelligence/route.ts');
assert('API authorizes on the server', route.includes('authorizeAsiRequest(actor'));
assert('API does not branch on plan === pro', !route.includes("plan === 'pro'"));
assert('API does not branch if admin', !route.includes("tier === 'admin'") && !route.includes("if (actor.tier === 'pro')"));
const authorizeSrc = read('lib/ai-search-intelligence/entitlement/authorize.ts');
assert('authorize uses canAccessFeature', authorizeSrc.includes('canAccessFeature'));
assert('hard PRO ops are server-gated', ASI_HARD_PRO_OPERATIONS.includes('war-room') && ASI_HARD_PRO_OPERATIONS.includes('competitor-gap') && ASI_HARD_PRO_OPERATIONS.includes('share-of-voice'));
assert('guest cannot authorize war-room', authorizeAsiRequest(actorFromTier('guest'), { operation: 'war-room' }) === 'war-room');
assert('guest cannot expand SOV on a free op', authorizeAsiRequest(actorFromTier('guest'), { operation: 'recommendation-test', expandSov: true }) === 'sov');
assert('guest cannot enroll schedule', authorizeAsiRequest(actorFromTier('guest'), { operation: 'visibility-monitor', cadence: 'daily' }) === 'visibility.schedule');
assert('member cannot expand citations on perception', authorizeAsiRequest(actorFromTier('member'), { operation: 'brand-perception', expandCitations: true }) === 'evidence.basic');
assert('pro can authorize gap', authorizeAsiRequest(actorFromTier('pro'), { operation: 'competitor-gap' }) === null);
assert('admin can authorize schedule', authorizeAsiRequest(actorFromTier('admin'), { operation: 'visibility-monitor', cadence: 'weekly' }) === null);
assert('test-tier header is mock-only', read('lib/ai-search-intelligence/entitlement/actor.ts').includes("resolveAsiMode() !== 'mock'"));
assert('guest PRO CTA is login', resolveAsiLockIntent(actorFromTier('guest'), 'competitor.gap') === 'login');
assert('member PRO CTA is upgrade', resolveAsiLockIntent(actorFromTier('member'), 'competitor.gap') === 'upgrade');
assert('pro PRO CTA is enter', resolveAsiLockIntent(actorFromTier('pro'), 'competitor.gap') === 'enter');
assert('admin PRO CTA is enter', resolveAsiLockIntent(actorFromTier('admin'), 'competitor.gap') === 'enter');
assert('gap CTA enters the tool', asiHrefForFeature('competitor.gap') === '/intelligence/competitor-gap');
assert('alert CTA opens Visibility Monitor', asiHrefForFeature('visibility.alert') === '/intelligence/visibility-monitor#asi-alerts');
const lock = read('components/ai-search-intelligence/entitlement/AsiLockPanel.tsx');
const lockKo = JSON.parse(read('messages/ko.json')) as {
	intelligence: { lock: { ctaAnalyze?: string; evidence?: { explorer?: { title?: string; body?: string } } } };
};
assert('lock UX is not paywall-only copy', !lock.includes('유료 기능') && !JSON.stringify(lockKo.intelligence.lock).includes('유료 기능'));
assert('lock panel uses shared CTA', lock.includes('AsiLockCta') && lock.includes('ctaAnalyze'));
assert('lock panel shows lock mark', lock.includes('🔒'));
assert(
	'lock copy is value-first Evidence Explorer',
	lockKo.intelligence.lock.ctaAnalyze === 'PRO에서 분석하기' &&
		lockKo.intelligence.lock.evidence?.explorer?.title === 'AI EVIDENCE EXPLORER' &&
		(lockKo.intelligence.lock.evidence?.explorer?.body || '').includes('실제 Evidence와 Citation'),
);
const cta = read('components/ai-search-intelligence/entitlement/AsiLockCta.tsx');
assert('lock CTA opens AuthModal for guests', cta.includes('AuthModal'));
assert('lock CTA opens PricingModal for members', cta.includes('PricingModal'));
assert('lock CTA uses resolveAsiLockIntent', cta.includes('resolveAsiLockIntent'));
assert('lock CTA does not branch plan === pro', !cta.includes("plan === 'pro'") && !cta.includes("tier === 'pro'") && !cta.includes("tier === 'admin'"));
const clip = read('components/ai-search-intelligence/entitlement/AsiClipBanner.tsx');
assert('clip banner uses canAccessFeature, not plan === pro', clip.includes('canAccessFeature') && !clip.includes("plan === 'pro'"));
assert('clip banner uses shared CTA', clip.includes('AsiLockCta'));
assert('war room uses canAccessFeature', read('components/ai-search-intelligence/war-room/WarRoomDashboard.tsx').includes('canAccessFeature'));
assert('visibility board uses canAccessFeature', read('components/ai-search-intelligence/visibility/VisibilityMonitorBoard.tsx').includes('canAccessFeature'));
assert('gate uses canAccessFeature', read('components/ai-search-intelligence/entitlement/AsiEntitlementGate.tsx').includes('canAccessFeature'));

void (async () => {
	clearAsiGuestRuns();
	const guestWar = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ operation: 'war-room', url: 'https://sunshineclinic.kr' }),
		}),
	);
	assert('guest war-room is 403', guestWar.status === 403);
	const guestWarBody = (await guestWar.json()) as { error?: { code?: string; message?: string } };
	assert('guest war-room code is entitlement', guestWarBody.error?.code === 'entitlement');
	assert('guest war-room message is not 유료 기능', !guestWarBody.error?.message?.includes('유료 기능'));

	for (const operation of ASI_HARD_PRO_OPERATIONS) {
		const spoof = await POST(
			new Request('http://localhost/api/intelligence', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ operation, url: 'https://sunshineclinic.kr' }),
			}),
		);
		assert(`JS spoof ${operation} is 403`, spoof.status === 403);
		const spoofBody = (await spoof.json()) as { error?: { code?: string } };
		assert(`JS spoof ${operation} code is entitlement`, spoofBody.error?.code === 'entitlement');
	}

	const spoofSov = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ operation: 'recommendation-test', url: 'https://sunshineclinic.kr', expandSov: true }),
		}),
	);
	assert('JS spoof expandSov is 403', spoofSov.status === 403);

	const spoofCite = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ operation: 'brand-perception', url: 'https://sunshineclinic.kr', expandCitations: true }),
		}),
	);
	assert('JS spoof expandCitations is 403', spoofCite.status === 403);

	const spoofSched = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ operation: 'visibility-monitor', url: 'https://sunshineclinic.kr', cadence: 'daily' }),
		}),
	);
	assert('JS spoof cadence is 403', spoofSched.status === 403);

	const guestOpp = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ operation: 'opportunity-finder', url: 'https://sunshineclinic.kr' }),
		}),
	);
	assert('guest opportunity still runs', guestOpp.status === 200);
	const guestOpp2 = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ operation: 'opportunity-finder', url: 'https://sunshineclinic.kr' }),
		}),
	);
	assert('guest second diagnose is quota', guestOpp2.status === 403);
	const quotaBody = (await guestOpp2.json()) as { error?: { code?: string } };
	assert('quota code', quotaBody.error?.code === 'entitlement_quota');

	const proGap = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-asi-test-tier': 'pro' },
			body: JSON.stringify({ operation: 'competitor-gap', url: 'https://sunshineclinic.kr' }),
		}),
	);
	assert('pro gap still runs', proGap.status === 200);

	const memberComp = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-asi-test-tier': 'member' },
			body: JSON.stringify({ operation: 'competitor-analysis', url: 'https://sunshineclinic.kr' }),
		}),
	);
	assert('member full competitor intelligence is 403', memberComp.status === 403);

	const memberSov = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-asi-test-tier': 'member' },
			body: JSON.stringify({ operation: 'share-of-voice', url: 'https://sunshineclinic.kr' }),
		}),
	);
	assert('member full SOV is 403', memberSov.status === 403);

	clearAsiGuestRuns();
	const guestBulk = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				operation: 'query-generator',
				url: 'https://sunshineclinic.kr',
				queries: Array.from({ length: 20 }, (_, i) => `질문 ${i}`),
			}),
		}),
	);
	assert('guest bulk query is 403', guestBulk.status === 403);
	const guestBulkBody = (await guestBulk.json()) as { error?: { code?: string } };
	assert('guest bulk code is entitlement', guestBulkBody.error?.code === 'entitlement');

	const proBulk = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-asi-test-tier': 'pro' },
			body: JSON.stringify({
				operation: 'query-generator',
				url: 'https://sunshineclinic.kr',
				queries: Array.from({ length: 20 }, (_, i) => `질문 ${i}`),
			}),
		}),
	);
	assert('pro bulk query runs', proBulk.status === 200);

	const adminWar = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-asi-test-tier': 'admin' },
			body: JSON.stringify({ operation: 'war-room', url: 'https://sunshineclinic.kr' }),
		}),
	);
	assert('admin war-room runs', adminWar.status === 200);

	const actorSrc = read('lib/ai-search-intelligence/entitlement/actor.ts');
	assert('actor reuses NextAuth session', actorSrc.includes('getServerSession(authOptions)'));
	assert('actor reuses Prisma planId', actorSrc.includes('planId: true') && actorSrc.includes('prisma.user.findUnique'));
	assert('actor reuses JWT cookie fallback', actorSrc.includes('getToken('));
	assert('actor does not invent a new login', !actorSrc.includes('signIn(') && !actorSrc.includes('bcrypt'));
	assert(
		'client actor uses GET /api/intelligence entitlement',
		read('lib/ai-search-intelligence/entitlement/use-asi-actor.ts').includes("fetch('/api/intelligence')") &&
			!read('lib/ai-search-intelligence/entitlement/use-asi-actor.ts').includes("fetch('/api/me')"),
	);

	const status = await GET(new Request('http://localhost/api/intelligence'));
	const statusBody = (await status.json()) as { data?: { entitlement?: { tier?: string } } };
	assert('GET exposes guest entitlement', statusBody.data?.entitlement?.tier === 'guest');

	const adminStatus = await GET(
		new Request('http://localhost/api/intelligence', { headers: { 'x-asi-test-tier': 'admin' } }),
	);
	const adminStatusBody = (await adminStatus.json()) as { data?: { entitlement?: { tier?: string; planRole?: string } } };
	assert('GET exposes admin entitlement', adminStatusBody.data?.entitlement?.tier === 'admin');
	assert('GET admin planRole is ADMIN not PRO', adminStatusBody.data?.entitlement?.planRole === 'ADMIN');

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
