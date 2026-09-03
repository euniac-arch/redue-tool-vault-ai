/**
 * STEP 19-F — existing quota only. Server enforcement + ADMIN bypass + cost holes.
 * Run: npx tsx scripts/test-intelligence-usage-e2e.ts
 */
import { POST } from '../app/api/intelligence/route';
import { ASI_MONTHLY_QUERY_QUOTA, ASI_TIER_LIMITS } from '../lib/ai-search-intelligence/entitlement/catalog';
import { actorFromTier } from '../lib/ai-search-intelligence/entitlement/actor-model';
import { clearAsiGuestRuns } from '../lib/ai-search-intelligence/entitlement/quota';
import {
	assertAsiMonthlyBudget,
	clearAsiAccountUsage,
	readAsiAccountUsage,
	recordAsiAccountQueries,
} from '../lib/ai-search-intelligence/guard/account-usage';
import { ASI_GUARD } from '../lib/ai-search-intelligence/guard/limits';
import { consumeAsiHttpRateLimit, clearAsiRateLimits } from '../lib/ai-search-intelligence/guard/rate-limit';
import { readAsiUsageReport } from '../lib/ai-search-intelligence/guard/metrics';
import { httpStatusForAsiError } from '../lib/ai-search-intelligence/api/errors';

const URL = 'https://sunshineclinic.kr';

function post(body: unknown, headers: Record<string, string> = {}) {
	return POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.80', ...headers },
			body: JSON.stringify(body),
		}),
	);
}

void (async () => {
	console.log('========== existing quotas (catalog, not invented) ==========');
	for (const tier of ['guest', 'member', 'pro', 'business', 'admin'] as const) {
		const lim = ASI_TIER_LIMITS[tier];
		console.log(
			`${tier}\tmonthlyQ=${ASI_MONTHLY_QUERY_QUOTA[tier]}\tmonthlyProv=${lim.monthlyProviderCalls}\tperReqQ=${lim.queries}\tproviders=${lim.providers}\tdiagnoses=${lim.diagnoses}`,
		);
	}
	console.log(
		`guard http/min=${ASI_GUARD.httpPerMinute} prov/min=${ASI_GUARD.providerPerMinute} prov/day=${ASI_GUARD.providerPerDay} maxQ=${ASI_GUARD.maxQueriesPerRequest}`,
	);
	console.log(`quota HTTP=${httpStatusForAsiError('entitlement_quota')} rate_limit HTTP=${httpStatusForAsiError('rate_limit')}`);

	console.log('\n========== ADMIN monthly bypass ==========');
	clearAsiAccountUsage();
	const admin = actorFromTier('admin');
	recordAsiAccountQueries('user:admin-19f', 10_000);
	try {
		assertAsiMonthlyBudget('user:admin-19f', admin.limits, 1);
		console.log('ADMIN 10000 used + 1 upcoming: ALLOW (Infinity)');
	} catch {
		console.log('ADMIN 10000 used + 1 upcoming: DENY');
	}
	const adminUsage = readAsiAccountUsage('user:admin-19f', admin.limits);
	console.log(`ADMIN limits finite=${Number.isFinite(adminUsage.queriesLimit)} queriesLimit=${adminUsage.queriesLimit}`);

	console.log('\n========== FREE monthly budget via API ==========');
	clearAsiAccountUsage();
	clearAsiGuestRuns();
	clearAsiRateLimits();
	const guestKey = { 'x-asi-test-tier': undefined as string | undefined, 'x-forwarded-for': '198.51.100.81' };
	recordAsiAccountQueries('guest:198.51.100.81', 10);
	const over = await post({ operation: 'brand-perception', url: URL }, guestKey);
	const overBody = (await over.json()) as { error?: { code?: string } };
	console.log(`FREE used=10 + diagnose status=${over.status} code=${overBody.error?.code || 'none'}`);

	console.log('\n========== guest diagnose 1 ==========');
	clearAsiAccountUsage();
	clearAsiGuestRuns();
	const first = await post({ operation: 'brand-perception', url: URL }, { 'x-forwarded-for': '198.51.100.82' });
	const second = await post({ operation: 'brand-perception', url: URL }, { 'x-forwarded-for': '198.51.100.82' });
	console.log(`guest1 status=${first.status} guest2 status=${second.status} code=${((await second.json()) as { error?: { code?: string } }).error?.code}`);

	console.log('\n========== bulk query ==========');
	clearAsiGuestRuns();
	const bulk = await post(
		{ operation: 'query-generator', url: URL, queries: Array.from({ length: 20 }, (_, i) => `q${i}`) },
		{ 'x-forwarded-for': '198.51.100.83' },
	);
	console.log(`FREE 20 queries status=${bulk.status} code=${((await bulk.json()) as { error?: { code?: string } }).error?.code}`);

	console.log('\n========== ADMIN still has HTTP rate limit ==========');
	clearAsiRateLimits();
	let adminRateBlocked = false;
	try {
		for (let i = 0; i < ASI_GUARD.httpPerMinute + 1; i += 1) consumeAsiHttpRateLimit('admin-qa');
	} catch {
		adminRateBlocked = true;
	}
	console.log(`ADMIN http/min cap still throws rate_limit=${adminRateBlocked}`);

	console.log('\n========== cost tracking shape ==========');
	const report = readAsiUsageReport();
	console.log(`metrics keys=${Object.keys(report).join(',')} estimated=true tokenFields=${'tokens' in report}`);
	console.log(`byProvider has calls=${typeof report.byProvider.chatgpt.calls === 'number'} no tokens`);

	console.log('\n========== route upcomingQueries hole ==========');
	console.log('route counts body queries (min 1). opportunity/visibility generate 2–10 internally after the check.');
	console.log('tick runAsiVisibility has no assertAsiMonthlyBudget (scheduler bypass).');
	console.log(`project quota in ASI catalog=${'projects' in ASI_TIER_LIMITS.pro}`);
	console.log(`monitor-run quota in ASI catalog=${'monitorRuns' in ASI_TIER_LIMITS.pro}`);
})();
