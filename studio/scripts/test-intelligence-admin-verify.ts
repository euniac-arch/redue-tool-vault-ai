/**
 * STEP 18 — Verify the product as ADMIN with full PRO. Payment stays last.
 *
 * Auth → AI API → persist → Monitor → Usage → real-user test → payment
 * Do not add checkout here.
 *
 * Run: npx tsx scripts/test-intelligence-admin-verify.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GET, POST } from '../app/api/intelligence/route';
import { ASI_OPERATIONS } from '../lib/ai-search-intelligence/api/operations';
import { ASI_ENTITLEMENT_FEATURES } from '../lib/ai-search-intelligence/entitlement/catalog';
import { actorFromTier } from '../lib/ai-search-intelligence/entitlement/actor-model';
import { authorizeAsiRequest } from '../lib/ai-search-intelligence/entitlement/authorize';
import { asiLimitsFor, canAccessFeature } from '../lib/ai-search-intelligence/entitlement/can-access';
import { publicAsiAccountUsage, readAsiAccountUsage } from '../lib/ai-search-intelligence/guard/account-usage';

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

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.next') continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|tsx)$/.test(name)) out.push(full);
	}
	return out;
}

const admin = actorFromTier('admin');
assert('ADMIN quota is unlimited', !Number.isFinite(asiLimitsFor('admin').monthlyQueries));
assert(
	'ADMIN public usage has no remaining cap',
	publicAsiAccountUsage(readAsiAccountUsage('user:admin-verify', admin.limits)).remaining === null,
);

for (const feature of ASI_ENTITLEMENT_FEATURES) {
	assert(`ADMIN can ${feature}`, canAccessFeature(admin, feature));
}

for (const operation of ASI_OPERATIONS) {
	assert(`authorize ADMIN ${operation}`, authorizeAsiRequest(admin, { operation }) === null);
}

const libFiles = walk(resolve(process.cwd(), 'lib/ai-search-intelligence'));
const libSrc = libFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const route = read('app/api/intelligence/route.ts');
assert('Intelligence API is not gated on Toss', !route.includes('TOSS') && !route.includes('toss'));
assert('Intelligence API is not gated on Payment', !route.includes('prisma.payment') && !/plan === ['"]pro['"]/.test(route));
assert(
	'ASI lib has no checkout client',
	!/tosspayments|createPayment|billingKey|결제하기/.test(libSrc),
);
assert('route still authorizes then runs', route.includes('authorizeAsiRequest') && route.includes('runAsiOperation'));
assert('route still persists usage', route.includes('recordAsiAccountQueries') && route.includes('assertAsiMonthlyBudget'));

void (async () => {
	for (const operation of ASI_OPERATIONS) {
		const res = await POST(
			new Request('http://localhost/api/intelligence', {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-asi-test-tier': 'admin' },
				body: JSON.stringify({ operation, url: 'https://sunshineclinic.kr' }),
			}),
		);
		assert(`ADMIN ${operation} is 200`, res.status === 200);
	}

	const monitor = await POST(
		new Request('http://localhost/api/intelligence', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-asi-test-tier': 'admin' },
			body: JSON.stringify({ operation: 'visibility-monitor', url: 'https://sunshineclinic.kr', cadence: 'daily' }),
		}),
	);
	assert('ADMIN Visibility Monitor schedule is 200', monitor.status === 200);

	const status = await GET(
		new Request('http://localhost/api/intelligence', { headers: { 'x-asi-test-tier': 'admin' } }),
	);
	const body = (await status.json()) as {
		data?: {
			entitlement?: { tier?: string; planRole?: string };
			accountUsage?: { queriesLimit?: number | null; remaining?: number | null };
		};
	};
	assert('GET ADMIN is ADMIN', body.data?.entitlement?.tier === 'admin' && body.data?.entitlement?.planRole === 'ADMIN');
	assert('GET ADMIN quota is unlimited', body.data?.accountUsage?.queriesLimit === null && body.data?.accountUsage?.remaining === null);

	if (failed) {
		console.error(`\n${failed} failed`);
		process.exit(1);
	}
	console.log('\nall passed');
})();
