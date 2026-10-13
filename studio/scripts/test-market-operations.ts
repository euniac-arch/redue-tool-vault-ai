/**
 * Operational guards for market persistence, cron auth, and admin review.
 * Run: npx tsx scripts/test-market-operations.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import seedJson from '../data/ai-market/web-traffic-observations.json';
import { assertValidBundle, checkStatusLabel, interpretLegacyMarketStatus, type MarketBundle, type MarketCheckCandidate } from '../lib/ai-hub/market-observations';
import { approvePending, queuePendingCandidate, rejectPending, type MarketPendingRecord } from '../lib/ai-hub/market-review';
import { bundleAfterRejectedWrite, decideCommitGuard, decideRunClaim } from '../lib/ai-hub/market-run-guard';
import { authorizeCronSync, cronHttpStatus, cronSecretMatches, rankingReadMode } from '../lib/ai-hub/ranking-refresh-auth';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
}

const seed = assertValidBundle(seedJson);
const actor = { id: 'admin-1', email: 'admin@example.com', name: 'Admin' };

function pendingFor(bundle: MarketBundle, shift = 0): MarketPendingRecord {
	const candidate: MarketCheckCandidate = {
		periodStart: '2026-10-01',
		periodEnd: '2026-10-31',
		periodLabel: '2026년 10월 관측 데이터',
		metricType: 'web_traffic_share',
		sourceUrl: 'https://www.platelunchcollective.com/research/retrieval-layer-intelligence',
		rows: bundle.webTraffic.rows.map((row) => ({
			serviceId: row.serviceId,
			serviceName: row.serviceName,
			sharePct: row.serviceId === 'chatgpt' ? row.sharePct + shift : row.serviceId === 'gemini' ? row.sharePct - shift : row.sharePct,
		})),
	};
	return {
		status: 'pending',
		candidate,
		publishedPeriodStart: bundle.webTraffic.periodStart,
		publishedPeriodEnd: bundle.webTraffic.periodEnd,
		publishedPeriodLabel: bundle.webTraffic.periodLabel,
		publishedRows: bundle.webTraffic.rows.map((row) => ({ ...row })),
		sourceName: bundle.webTraffic.sourceName,
		metricLabel: bundle.webTraffic.metricLabel,
		detectedAt: '2026-10-13T09:00:00.000Z',
		note: 'review',
		decision: null,
	};
}

assert('september seed stays 56.4', seed.webTraffic.rows[0]?.sharePct === 56.4 && seed.webTraffic.periodStart === '2026-09-01');
assert('public refresh does not collect sources', rankingReadMode({ refresh: '1' }) === 'read' && rankingReadMode({ force: '1' }) === 'read');
assert('sync is the cron collection path', rankingReadMode({ sync: '1' }) === 'cron');
const missingSecret = authorizeCronSync('Bearer secret', undefined);
const blankSecret = authorizeCronSync('Bearer secret', '   ');
const absentHeader = authorizeCronSync(null, undefined);
assert('missing cron secret is rejected', missingSecret.ok === false && missingSecret.status === 401);
assert('blank cron secret is rejected', blankSecret.ok === false && blankSecret.status === 401);
assert('sync without a secret header is rejected', absentHeader.ok === false && absentHeader.status === 401);
assert('wrong cron bearer is rejected', authorizeCronSync('Bearer wrong', 'expected').ok === false);
assert('matching cron bearer is accepted', authorizeCronSync('Bearer expected', 'expected').ok === true);
assert('cron compare does not accept a different length', cronSecretMatches('Bearer expected-extra', 'expected') === false);
assert('firestore failure is not HTTP success', cronHttpStatus({ ok: false, reason: 'firestore_unconfigured' }) === 503);
assert('firestore write failure is not HTTP success', cronHttpStatus({ ok: false, reason: 'firestore_write_failed' }) === 503);
assert('a stale check result is not HTTP success', cronHttpStatus({ ok: false, reason: 'stale_result' }) === 503);
assert('concurrent run is rejected', cronHttpStatus({ ok: false, reason: 'busy' }) === 409);
assert('a saved check can return 200', cronHttpStatus({ ok: true, reason: 'saved' }) === 200);

const legacy = { ...seed, checkStatus: 'confirmed_unchanged' as const, webTraffic: { ...seed.webTraffic, sources: [{ label: 'old', url: 'https://example.com', role: 'primary' as const }] } };
const interpreted = interpretLegacyMarketStatus(legacy, seed);
assert(
	'a stored confirmed_unchanged september snapshot stays secondary and is not primary verification',
	interpreted.checkStatus === 'secondary_corroborated' &&
		checkStatusLabel(interpreted.checkStatus) === '2차 출처 일치 · Similarweb 원문 미수집' &&
		!checkStatusLabel('confirmed_unchanged').includes('검증 완료') &&
		interpreted.webTraffic.sources[0]?.role === 'secondary' &&
		interpreted.webTraffic.sources.every((source) => source.role !== 'primary') &&
		interpreted.webTraffic.rows[0]?.sharePct === 56.4 &&
		seed.webTraffic.rows[0]?.sharePct === 56.4 &&
		seed.checkStatus === 'secondary_corroborated' &&
		legacy.checkStatus === 'confirmed_unchanged' &&
		legacy.webTraffic.sources[0]?.role === 'primary',
);
const otherLegacy = interpretLegacyMarketStatus(
	{ ...seed, checkStatus: 'confirmed_unchanged', webTraffic: { ...seed.webTraffic, rows: seed.webTraffic.rows.map((row) => ({ ...row, sharePct: row.serviceId === 'chatgpt' ? 1 : row.sharePct })) } },
	seed,
);
assert(
	'a different confirmed_unchanged snapshot is not relabeled as a fresh two-source match',
	otherLegacy.checkStatus === 'confirmed_unchanged' && otherLegacy.webTraffic.rows[0]?.sharePct === 1 && !otherLegacy.checkNote.includes('검증 완료'),
);

const now = Date.parse('2026-10-13T15:00:00.000Z');
assert('an active lock blocks a second claim', decideRunClaim({ lastCheckDate: null, checkStatus: null, lockExpiresAt: new Date(now + 120_000).toISOString(), today: '2026-10-13', now }) === 'busy');
assert('an expired lock can be claimed after an abnormal stop', decideRunClaim({ lastCheckDate: null, checkStatus: null, lockExpiresAt: new Date(now - 1).toISOString(), today: '2026-10-13', now }) === 'claim');
assert('the same seoul day does not claim again', decideRunClaim({ lastCheckDate: '2026-10-13', checkStatus: 'secondary_corroborated', lockExpiresAt: null, today: '2026-10-13', now }) === 'done');
assert('a stored confirmed_unchanged day is still claimed', decideRunClaim({ lastCheckDate: '2026-10-13', checkStatus: 'confirmed_unchanged', lockExpiresAt: null, today: '2026-10-13', now }) === 'claim');
assert(
	'a stored confirmed_unchanged day still respects an active lock',
	decideRunClaim({ lastCheckDate: '2026-10-13', checkStatus: 'confirmed_unchanged', lockExpiresAt: new Date(now + 120_000).toISOString(), today: '2026-10-13', now }) === 'busy',
);
assert('a lost lock cannot commit', decideCommitGuard({ lockToken: 'other', expectedToken: 'mine', storedRevision: 1, baseRevision: 1 }) === 'lock_lost');
assert('a missing lock cannot commit', decideCommitGuard({ lockToken: null, expectedToken: 'mine', storedRevision: 1, baseRevision: 1 }) === 'lock_lost');
assert('a newer published revision blocks the older check', decideCommitGuard({ lockToken: 'mine', expectedToken: 'mine', storedRevision: 2, baseRevision: 1 }) === 'stale_base');
assert('the same revision and token can commit', decideCommitGuard({ lockToken: 'mine', expectedToken: 'mine', storedRevision: 1, baseRevision: 1 }) === 'ok');
const previousBundle = seed;
const attemptedBundle = { ...seed, revision: seed.revision + 1 };
assert('a failed save keeps the previous public bundle', bundleAfterRejectedWrite(previousBundle, { ok: false, durable: false }, attemptedBundle) === previousBundle);
assert('a durable save can publish the new bundle', bundleAfterRejectedWrite(previousBundle, { ok: true, durable: true }, attemptedBundle) === attemptedBundle);

const queued = queuePendingCandidate(null, pendingFor(seed));
assert('a candidate is queued without becoming public', queued.action === 'create' && seed.webTraffic.rows[0]?.sharePct === 56.4);
const again = queuePendingCandidate(queued.record, pendingFor(seed));
assert('the same pending candidate is not duplicated', again.action === 'kept');
const other = queuePendingCandidate(queued.record, pendingFor(seed, 0.6));
assert('a different candidate does not replace the pending review', other.action === 'conflict' && other.record.candidate.rows[0]?.sharePct === 56.4);

const rejected = rejectPending(queued.record, actor, '2026-10-13T10:00:00.000Z');
assert('reject keeps the published september rows', rejected.ok && rejected.record.status === 'rejected' && seed.webTraffic.rows[0]?.sharePct === 56.4);
assert('rejected record stores the actor and time', rejected.ok && rejected.record.decision?.actorId === 'admin-1' && rejected.record.decision.at === '2026-10-13T10:00:00.000Z');
const secondReject = rejectPending(rejected.ok ? rejected.record : null, actor, '2026-10-13T11:00:00.000Z');
assert('a second reject is refused', secondReject.ok === false && secondReject.reason === 'not_pending');
const reopened = queuePendingCandidate(rejected.ok ? rejected.record : queued.record, pendingFor(seed));
assert('a rejected candidate is not queued again by the same check', reopened.action === 'kept' && reopened.record.status === 'rejected');

const approved = approvePending(queued.record, seed, actor, '2026-10-13T12:00:00.000Z');
assert('approval records the previous september rows', approved.ok && approved.record.decision?.previousRows[0]?.sharePct === 56.4);
assert('approval changes only the returned bundle', approved.ok && approved.bundle.webTraffic.periodStart === '2026-10-01' && seed.webTraffic.periodStart === '2026-09-01');
assert('the seed file value is not edited by approval', seed.webTraffic.rows[0]?.sharePct === 56.4);
const invalid = approvePending(
	{
		...queued.record,
		candidate: { ...queued.record.candidate, rows: queued.record.candidate.rows.slice(0, 1) },
	},
	seed,
	actor,
	'2026-10-13T12:30:00.000Z',
);
assert('an incomplete candidate cannot be approved', invalid.ok === false && invalid.reason === 'invalid_candidate');
const secondApprove = approvePending(approved.ok ? approved.record : null, seed, actor, '2026-10-13T13:00:00.000Z');
assert('a second approval is refused', secondApprove.ok === false && secondApprove.reason === 'not_pending');

const storeSource = readFileSync(path.resolve(__dirname, '../lib/ai-hub/market-observation-store.ts'), 'utf8');
const refreshSource = readFileSync(path.resolve(__dirname, '../lib/ai-hub/market-observation-refresh.ts'), 'utf8');
const routeSource = readFileSync(path.resolve(__dirname, '../app/api/ai-rankings/daily/route.ts'), 'utf8');
const reviewRoute = readFileSync(path.resolve(__dirname, '../app/api/admin/ai-market/review/route.ts'), 'utf8');
const checkRoute = readFileSync(path.resolve(__dirname, '../app/api/admin/ai-market/check/route.ts'), 'utf8');
assert('market store does not write a local or ephemeral file', !storeSource.includes('writeFile') && !storeSource.includes('tmpdir') && !storeSource.includes('writableDataPath'));
assert('unconfigured firestore does not report a saved check', refreshSource.includes("reason: 'firestore_unconfigured'") && refreshSource.includes('ran: false'));
assert('a failed market save returns the previous bundle', refreshSource.includes('bundleAfterRejectedWrite') && refreshSource.includes('baseRevision'));
const routeGet = routeSource.slice(routeSource.indexOf('export async function GET'));
assert(
	'public route rejects cron sync before loading the payload',
	routeGet.indexOf('authorizeCronSync') >= 0 && routeGet.indexOf('authorizeCronSync') < routeGet.indexOf('getDailyAiRankingsPayload') && routeGet.includes("runMarketCheck: mode === 'cron'"),
);
assert('admin review requires an admin and disables approval without firestore', reviewRoute.includes('requireAdmin') && reviewRoute.includes('firestore_unconfigured'));
assert('admin source check is separate from cron bearer auth', checkRoute.includes('requireAdmin') && !checkRoute.includes('authorizeCronSync'));
const reviewFn = storeSource.slice(storeSource.indexOf('export async function decideMarketReview'));
const reviewTx = reviewFn.slice(reviewFn.indexOf('runTransaction'), reviewFn.indexOf('} catch'));
assert(
	'approval writes the public document and the candidate in one transaction',
	reviewFn.split('runTransaction').length === 2 && reviewTx.includes('tx.set(currentRef') && reviewTx.includes('tx.set(pendingRef'),
);
const claimFn = storeSource.slice(storeSource.indexOf('export async function claimMarketRun'), storeSource.indexOf('export async function commitMarketRun'));
const commitFn = storeSource.slice(storeSource.indexOf('export async function commitMarketRun'), storeSource.indexOf('export async function readPendingReview'));
assert('the lock decision runs before a lock is written', claimFn.indexOf('decideRunClaim') >= 0 && claimFn.indexOf('decideRunClaim') < claimFn.indexOf('tx.set'));
assert('commit refuses a stale revision before replacing the public document', commitFn.indexOf('decideCommitGuard') >= 0 && commitFn.indexOf('decideCommitGuard') < commitFn.indexOf('tx.set(currentRef'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall market operation assertions passed');
