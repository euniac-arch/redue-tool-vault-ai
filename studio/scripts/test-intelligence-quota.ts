/**
 * STEP 17 — monthly Query quota + public usage meter.
 * Run: npx tsx scripts/test-intelligence-quota.ts
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AsiServiceError } from '../lib/ai-search-intelligence/api/errors';
import { actorFromTier } from '../lib/ai-search-intelligence/entitlement/actor-model';
import { ASI_MONTHLY_QUERY_QUOTA } from '../lib/ai-search-intelligence/entitlement/catalog';
import { resolveAsiTier } from '../lib/ai-search-intelligence/entitlement/tiers';
import { asiQuotaRemaining, toPublicAsiAccountUsage } from '../lib/ai-search-intelligence/entitlement/usage-public';
import {
	assertAsiMonthlyBudget,
	clearAsiAccountUsage,
	publicAsiAccountUsage,
	readAsiAccountUsage,
	recordAsiAccountQueries,
} from '../lib/ai-search-intelligence/guard/account-usage';

process.env.ASI_PERSIST = '1';
process.env.ASI_HISTORY_DIR = mkdtempSync(join(tmpdir(), 'asi-quota-'));

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

assert('FREE quota is 10', ASI_MONTHLY_QUERY_QUOTA.guest === 10);
assert('MEMBER quota is 30', ASI_MONTHLY_QUERY_QUOTA.member === 30);
assert('PRO quota is 500', ASI_MONTHLY_QUERY_QUOTA.pro === 500);
assert('BUSINESS quota is 2000', ASI_MONTHLY_QUERY_QUOTA.business === 2000);
assert('agency plan is BUSINESS', resolveAsiTier({ isLoggedIn: true, planId: 'agency' }) === 'business');

const shown = toPublicAsiAccountUsage({ queriesUsed: 327, queriesLimit: 500 });
assert('327 / 500 remaining is 173', shown.remaining === 173 && shown.queriesUsed === 327 && shown.queriesLimit === 500);
assert('quota remaining helper', asiQuotaRemaining(327, 500) === 173);
assert('unlimited remaining is null', asiQuotaRemaining(10, Number.POSITIVE_INFINITY) === null);

const key = 'user:quota-step17';
clearAsiAccountUsage(key);
const pro = actorFromTier('pro');
recordAsiAccountQueries(key, 327);
const usage = publicAsiAccountUsage(readAsiAccountUsage(key, pro.limits));
assert('public remaining matches 173', usage.remaining === 173 && usage.queriesLimit === 500);

clearAsiAccountUsage();
const reloaded = publicAsiAccountUsage(readAsiAccountUsage(key, pro.limits));
assert('persist restores used count after memory clear', reloaded.queriesUsed === 327 && reloaded.remaining === 173);

try {
	assertAsiMonthlyBudget(key, pro.limits, 200);
	assert('over remaining must throw', false);
} catch (error) {
	assert('over quota is entitlement_quota', error instanceof AsiServiceError && error.code === 'entitlement_quota');
}

const meter = read('components/ai-search-intelligence/entitlement/AsiUsageMeter.tsx');
const layout = read('components/ai-search-intelligence/shell/AiIntelligenceLayout.tsx');
const ko = read('messages/ko.json');
const route = read('app/api/intelligence/route.ts');
const client = read('lib/ai-search-intelligence/client/asi-client.ts');
assert('meter shows fraction', meter.includes('fraction') && meter.includes('remaining'));
assert('layout mounts meter', layout.includes('AsiUsageMeter'));
assert('mypage mounts meter', read('app/mypage/page.tsx').includes('MypageAsiUsageCard'));
assert('ko copy is 이번 달 AI 분석', ko.includes('이번 달 AI 분석') && ko.includes('회 남음'));
assert('route exposes remaining via public usage', route.includes('publicAsiAccountUsage'));
assert('client publishes usage after POST', client.includes('publishAsiAccountUsage'));
assert('HTTP cannot set used from body', !route.includes('body.queriesUsed') && !route.includes('body.accountUsage'));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
