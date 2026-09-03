/**
 * STEP 13.10 — entitlement + API authorization + direct access.
 *
 * Auth (reused, not reinvented):
 *   NextAuth JWT session → cookie/JWT fallback → Prisma User.planId / role
 *   guest = not logged in (FREE)
 *   member = logged in, starter
 *   pro = planId pro
 *   business = planId agency/business
 *   admin = isAdmin / role=admin (not rewritten to PRO)
 *   Mock-only header x-asi-test-tier. Body plan/tier/role is ignored.
 *
 * Run: npx tsx scripts/test-intelligence-access.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { POST } from '../app/api/intelligence/route';
import { authorizeAsiRequest, ASI_HARD_PRO_OPERATIONS } from '../lib/ai-search-intelligence/entitlement/authorize';
import { canAccessFeature } from '../lib/ai-search-intelligence/entitlement/can-access';
import { ASI_ENTITLEMENT_FEATURES, ASI_FEATURE_MIN_TIER } from '../lib/ai-search-intelligence/entitlement/catalog';
import { actorFromTier } from '../lib/ai-search-intelligence/entitlement/actor-model';
import { resolveAsiTier } from '../lib/ai-search-intelligence/entitlement/tiers';
import { httpStatusForAsiError } from '../lib/ai-search-intelligence/api/errors';
import { clearAsiGuestRuns } from '../lib/ai-search-intelligence/entitlement/quota';
import { clearAsiAccountUsage } from '../lib/ai-search-intelligence/guard/account-usage';

const PRO_FEATURES = ASI_ENTITLEMENT_FEATURES.filter((feature) => ASI_FEATURE_MIN_TIER[feature] === 'pro');

let failed = 0;

function assert(label: string, condition: boolean) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`);
}

function read(rel: string) {
	return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

function post(body: unknown, headers: Record<string, string> = {}) {
	return POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10', ...headers },
			body: JSON.stringify(body),
		}),
	);
}

function postAs(tier: 'guest' | 'member' | 'pro' | 'admin', body: unknown) {
	const ip = {
		guest: '203.0.113.10',
		member: '203.0.113.20',
		pro: '203.0.113.30',
		admin: '203.0.113.40',
	}[tier];
	const headers: Record<string, string> = { 'x-forwarded-for': ip };
	if (tier !== 'guest') headers['x-asi-test-tier'] = tier;
	return post(body, headers);
}

assert('entitlement: guest is FREE', resolveAsiTier({ isLoggedIn: false }) === 'guest');
assert('entitlement: starter is MEMBER', resolveAsiTier({ isLoggedIn: true, planId: 'starter' }) === 'member');
assert('entitlement: pro plan is PRO', resolveAsiTier({ isLoggedIn: true, planId: 'pro' }) === 'pro');
assert('entitlement: admin role is ADMIN', resolveAsiTier({ isLoggedIn: true, planId: 'starter', role: 'admin' }) === 'admin');
assert('entitlement: ADMIN is not rewritten to PRO', resolveAsiTier({ isLoggedIn: true, planId: 'starter', isAdmin: true }) === 'admin');

for (const feature of PRO_FEATURES) {
	assert(`FREE access blocks ${feature}`, !canAccessFeature(actorFromTier('guest'), feature));
	assert(`MEMBER access blocks ${feature}`, !canAccessFeature(actorFromTier('member'), feature));
	assert(`PRO access allows ${feature}`, canAccessFeature(actorFromTier('pro'), feature));
	assert(`BUSINESS access allows ${feature}`, canAccessFeature(actorFromTier('business'), feature));
	assert(`ADMIN access allows ${feature}`, canAccessFeature(actorFromTier('admin'), feature));
}

assert('API authorization uses authorizeAsiRequest', read('app/api/intelligence/route.ts').includes('authorizeAsiRequest(actor'));
assert('API authorization does not read body.plan', !read('app/api/intelligence/route.ts').includes('body.plan'));
assert('API authorization does not read body.tier', !read('app/api/intelligence/route.ts').includes('body.tier'));
assert('403 mapping', httpStatusForAsiError('entitlement') === 403);

void (async () => {
	const url = 'https://sunshineclinic.kr';

	for (const operation of ASI_HARD_PRO_OPERATIONS) {
		assert(`API authorization FREE ${operation}`, authorizeAsiRequest(actorFromTier('guest'), { operation }) !== null);
		assert(`API authorization MEMBER ${operation}`, authorizeAsiRequest(actorFromTier('member'), { operation }) !== null);
		assert(`API authorization PRO ${operation}`, authorizeAsiRequest(actorFromTier('pro'), { operation }) === null);
		assert(`API authorization ADMIN ${operation}`, authorizeAsiRequest(actorFromTier('admin'), { operation }) === null);

		const direct = await post({ operation, url });
		assert(`direct API access ${operation} is 403`, direct.status === 403);
		const directBody = (await direct.json()) as { error?: { code?: string; message?: string } };
		assert(`403 response ${operation} code`, directBody.error?.code === 'entitlement');
		assert(`403 response ${operation} is not 유료 기능`, !directBody.error?.message?.includes('유료 기능'));

		const member = await postAs('member', { operation, url });
		assert(`MEMBER access ${operation} is 403`, member.status === 403);
		const pro = await postAs('pro', { operation, url });
		assert(`PRO access ${operation} is 200`, pro.status === 200);
		const admin = await postAs('admin', { operation, url });
		assert(`ADMIN access ${operation} is 200`, admin.status === 200);
	}

	const spoofBody = await post({
		operation: 'war-room',
		url,
		plan: 'pro',
		planId: 'pro',
		tier: 'admin',
		role: 'admin',
		isAdmin: true,
	});
	assert('direct API access body spoof is 403', spoofBody.status === 403);

	const spoofBearer = await post(
		{ operation: 'competitor-gap', url },
		{ authorization: 'Bearer pro-secret-token' },
	);
	assert('direct API access fake Bearer is 403', spoofBearer.status === 403);

	const spoofCookie = await post(
		{ operation: 'share-of-voice', url },
		{ cookie: 'next-auth.session-token=forged-pro-session' },
	);
	assert('direct API access forged cookie is 403', spoofCookie.status === 403);

	const spoofFlag = await post({ operation: 'recommendation-test', url, expandSov: true });
	assert('direct API access expandSov is 403', spoofFlag.status === 403);

	const spoofBulk = await post({
		operation: 'query-generator',
		url,
		queries: Array.from({ length: 20 }, (_, i) => `질문 ${i}`),
	});
	assert('direct API access bulk query is 403', spoofBulk.status === 403);

	clearAsiGuestRuns();
	clearAsiAccountUsage();
	const freeTeaser = await postAs('guest', { operation: 'brand-perception', url });
	assert('FREE access diagnose still 200', freeTeaser.status === 200);

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
