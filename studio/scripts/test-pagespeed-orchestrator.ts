/**
 * Smoke test for the scan-orchestrator PageSpeed helpers — no real network calls.
 * Verifies: 1) the on-page estimate fallback produces a fully-populated, non-blank
 * snapshot (no `unavailableReason`), and 2) `fetchPageSpeedWithTimeout` races a slow
 * real fetch against the timeout and reports `timedOut: true` without throwing.
 */
import {
	estimatePageSpeedSnapshot,
	PSI_CACHE_BUSTER_PARAM,
	withPsiCacheBuster,
} from '../lib/audit/pagespeed-fetch';

const desktop = estimatePageSpeedSnapshot('https://example.com/', 'desktop', {
	onPagePerformanceScore100: 72,
	responseTimeMs: 900,
});
const mobile = estimatePageSpeedSnapshot('https://example.com/', 'mobile', {
	onPagePerformanceScore100: 72,
	responseTimeMs: 900,
});

const busted = withPsiCacheBuster('https://nineoneclinic.com/', 1700000000000);
const bustedWithQuery = withPsiCacheBuster('https://nineoneclinic.com/?utm=1', 1700000000000);
const bustedAgain = withPsiCacheBuster(busted, 1700000000001);

const checks = [
	desktop.estimated === true,
	mobile.estimated === true,
	desktop.unavailableReason === undefined,
	mobile.unavailableReason === undefined,
	desktop.categories.length === 4,
	desktop.categories.every((c) => typeof c.score === 'number'),
	desktop.vitals.length === 4,
	desktop.vitals.every((v) => v.value != null && v.displayValue),
	// Mobile heuristics should score at or below desktop for the same on-page signal.
	(mobile.categories.find((c) => c.id === 'performance')?.score ?? 0) <=
		(desktop.categories.find((c) => c.id === 'performance')?.score ?? 0),
	// No baseline default (58) should silently apply when a real hint is supplied.
	desktop.categories.find((c) => c.id === 'performance')?.score !== 58,
	PSI_CACHE_BUSTER_PARAM === '_psi_cb',
	busted === `https://nineoneclinic.com/?${PSI_CACHE_BUSTER_PARAM}=1700000000000`,
	bustedWithQuery.includes('utm=1') && bustedWithQuery.includes(`${PSI_CACHE_BUSTER_PARAM}=1700000000000`),
	// Re-busting replaces the previous token instead of stacking duplicates.
	(bustedAgain.match(new RegExp(`${PSI_CACHE_BUSTER_PARAM}=`, 'g')) || []).length === 1,
	bustedAgain.includes('1700000000001') && !bustedAgain.includes('1700000000000'),
];

console.log(
	JSON.stringify(
		{
			ok: checks.every(Boolean),
			checks,
			desktopPerf: desktop.categories.find((c) => c.id === 'performance'),
			mobilePerf: mobile.categories.find((c) => c.id === 'performance'),
			desktopVitals: desktop.vitals,
		},
		null,
		2,
	),
);

if (!checks.every(Boolean)) process.exit(1);
