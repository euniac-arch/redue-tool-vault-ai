/**
 * Admin API usage dashboard: filter / sort / paginate helpers.
 * Run: npx tsx scripts/test-api-usage.ts
 */
import assert from 'node:assert/strict';
import {
	MOCK_API_USAGE_LOGS,
	PAGE_SIZE,
	filterUsageLogs,
	formatCalledAt,
	formatUsd,
	matchesServiceFilter,
	monthBudgetRatio,
	paginateUsageLogs,
	sortUsageLogs,
	todayTokenTotal,
} from '../lib/admin/api-usage';

assert.equal(formatCalledAt('2026-08-22 17:12:08'), '2026-08-22 17:12:08');
assert.equal(formatUsd(0), '$0.00');
assert.equal(formatUsd(0.0002), '$0.0002');
assert.equal(formatUsd(128.45), '$128.45');
assert.equal(monthBudgetRatio().toFixed(1), '42.8');
assert.equal(todayTokenTotal(), 1_420_800);

assert.equal(matchesServiceFilter('unsplash', 'image'), true);
assert.equal(matchesServiceFilter('googlemaps', 'image'), false);
assert.equal(matchesServiceFilter('openai', 'openai'), true);

const openaiOnly = filterUsageLogs(MOCK_API_USAGE_LOGS, {
	query: '',
	service: 'openai',
	status: 'all',
});
assert.ok(openaiOnly.length > 0);
assert.ok(openaiOnly.every((row) => row.provider === 'openai'));

const nineone = filterUsageLogs(MOCK_API_USAGE_LOGS, {
	query: 'nineoneclinic.com',
	service: 'all',
	status: 'all',
});
assert.ok(nineone.every((row) => row.domain.includes('nineoneclinic.com') || row.userEmail.includes('nineoneclinic.com')));

const limited = filterUsageLogs(MOCK_API_USAGE_LOGS, {
	query: '',
	service: 'all',
	status: 429,
});
assert.ok(limited.length > 0);
assert.ok(limited.every((row) => row.status === 429));

const byCost = sortUsageLogs(MOCK_API_USAGE_LOGS, 'costUsd', 'desc');
assert.ok(byCost[0].costUsd >= byCost[1].costUsd);

const byRecent = sortUsageLogs(MOCK_API_USAGE_LOGS, 'calledAt', 'desc');
assert.ok(byRecent[0].calledAt >= byRecent[1].calledAt);

const page1 = paginateUsageLogs(byRecent, 1);
assert.equal(page1.length, PAGE_SIZE);

console.log(`ok — ${MOCK_API_USAGE_LOGS.length} mock logs, filters/sort/pagination passed`);
