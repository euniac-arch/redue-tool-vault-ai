/**
 * Live-check persistence: merge rules, write scope, host guard, stale-write protection, reload.
 * Uses a throwaway copy of the local sqlite file, so no real record is touched, and no paid API is called.
 * Firestore is not configured here, so that store is covered by the shared pure merge tests only.
 * Run: npx tsx scripts/test-live-check-persist.ts
 */
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
	applyLiveSnapshotToReport,
	isGroundedSuccess,
	isStaleSnapshot,
	mergeLiveSnapshots,
	readSavedSnapshot,
	sameSiteAsReport,
} from '../lib/audit/live-check-merge';
import type { LiveCheckEngineId, LiveEngineCheckResult, LiveEngineChecksSnapshot } from '../types/live-engine-check';

let failed = 0;
function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail !== undefined ? ` — ${JSON.stringify(detail).slice(0, 500)}` : ''}`);
}

const QUERY = '강남 피부과 추천';

function grounded(engine: LiveCheckEngineId, liveScore: number, checkedAt: string): LiveEngineCheckResult {
	return {
		engine,
		isLive: true,
		isGrounding: true,
		isLiveGrounded: true,
		isCited: true,
		liveScore,
		fallbackToRuleScore: false,
		searchEvidence: true,
		observation: 'official_cited',
		checkedAt,
	} as LiveEngineCheckResult;
}

function failure(engine: LiveCheckEngineId, ruleScore: number, checkedAt: string): LiveEngineCheckResult {
	return {
		engine,
		isLive: false,
		isGrounding: false,
		isLiveGrounded: false,
		isCited: false,
		liveScore: ruleScore,
		fallbackToRuleScore: true,
		observation: 'request_failed',
		failureKind: 'billing',
		httpStatus: 402,
		checkedAt,
	} as LiveEngineCheckResult;
}

function snap(startedAt: string, results: LiveEngineCheckResult[], query = QUERY): LiveEngineChecksSnapshot {
	return { checkedAt: startedAt, startedAt, targetQuery: query, results };
}

const T1 = '2026-10-24T10:00:00.000Z';
const T2 = '2026-10-24T10:05:00.000Z';
const T3 = '2026-10-24T10:10:00.000Z';

function pureTests() {
	// grounded rows are the only measurements
	assert('a grounded real row is a measurement', isGroundedSuccess(grounded('gemini', 90, T1)));
	assert('a failed row is not a measurement', !isGroundedSuccess(failure('gemini', 61, T1)));
	assert('a mock row is never a measurement', !isGroundedSuccess({ ...grounded('gemini', 90, T1), isMock: true }));

	// partial failure never deletes another engine's success
	const first = mergeLiveSnapshots(null, snap(T1, [grounded('gemini', 90, T1), grounded('perplexity', 95, T1), failure('chatgpt', 62, T1)]));
	const second = mergeLiveSnapshots(first, snap(T2, [failure('gemini', 61, T2), grounded('perplexity', 98, T2), failure('chatgpt', 62, T2)]));
	const byEngine = (s: LiveEngineChecksSnapshot, e: string) => s.results.find((row) => row.engine === e);
	assert('the latest attempt replaces the stored row, so the failure time is visible', byEngine(second, 'gemini')?.fallbackToRuleScore === true && byEngine(second, 'gemini')?.checkedAt === T2);
	assert('the earlier success of a now-failing engine is kept as lastGrounded', second.lastGrounded?.gemini?.liveScore === 90 && second.lastGrounded.gemini.checkedAt === T1);
	assert('another engine success in the same run is unaffected', byEngine(second, 'perplexity')?.liveScore === 98 && !second.lastGrounded?.perplexity);
	assert('an engine that never succeeded has no lastGrounded', !second.lastGrounded?.chatgpt);
	const third = mergeLiveSnapshots(second, snap(T3, [grounded('gemini', 88, T3)]));
	assert('a new success clears lastGrounded for that engine', byEngine(third, 'gemini')?.liveScore === 88 && !third.lastGrounded?.gemini);
	assert('an engine the run did not cover keeps its stored row', Boolean(byEngine(third, 'perplexity')) && Boolean(byEngine(third, 'chatgpt')));
	const otherQuery = mergeLiveSnapshots(second, snap(T3, [failure('gemini', 61, T3)], '다른 질의'));
	assert('a different query drops lastGrounded because results are not comparable', !otherQuery.lastGrounded);
	const twice = mergeLiveSnapshots(second, snap(T3, [failure('gemini', 61, T3)]));
	assert('repeated failures keep the original success', twice.lastGrounded?.gemini?.checkedAt === T1);

	// stale write protection
	assert('an older start time is stale against a newer stored one', isStaleSnapshot({ startedAt: T2 }, { startedAt: T1 }));
	assert('a newer start time is not stale', !isStaleSnapshot({ startedAt: T1 }, { startedAt: T2 }));
	assert('nothing stored is never stale', !isStaleSnapshot(null, { startedAt: T1 }));

	// host guard
	const report = { url: 'https://www.sky-clinic.com/', finalUrl: 'https://sky-clinic.com/ko', score: 70 };
	assert('same host passes the guard', sameSiteAsReport(report, 'https://sky-clinic.com'));
	assert('www host passes the guard', sameSiteAsReport(report, 'https://www.sky-clinic.com/x'));
	assert('a different host fails the guard', !sameSiteAsReport(report, 'https://other-clinic.com'));
	assert('a lookalike host fails the guard', !sameSiteAsReport(report, 'https://sky-clinic.com.evil.io'));
	assert('an empty site fails the guard', !sameSiteAsReport(report, ''));

	// write scope
	const stored = { ...report, categories: [{ id: 'a', score: 9 }], scoreBreakdown: { x: 1 } };
	const applied = applyLiveSnapshotToReport(stored, 'https://sky-clinic.com', snap(T1, [grounded('gemini', 90, T1)]));
	if (applied.status !== 'updated') {
		assert('apply returns updated for the same site', false, applied.status);
		return;
	}
	const { liveEngineChecks: _written, ...rest } = applied.report as Record<string, unknown>;
	assert('only liveEngineChecks changes; every other field is untouched', JSON.stringify(rest) === JSON.stringify(stored), rest);
	assert('apply refuses a different site', applyLiveSnapshotToReport(stored, 'https://other.com', snap(T1, [])).status === 'host_mismatch');
	const reloaded = readSavedSnapshot(JSON.parse(JSON.stringify(applied.report)) as { liveEngineChecks?: unknown });
	assert('a reload reads back the stored latest state', reloaded?.results[0]?.engine === 'gemini' && reloaded.startedAt === T1);
	assert('no stored snapshot reads as null', readSavedSnapshot({}) === null && readSavedSnapshot({ liveEngineChecks: { results: [] } }) === null);
}

async function dbTests() {
	const source = path.resolve(__dirname, '../prisma/dev.db');
	if (!existsSync(source)) {
		console.warn('skip DB tests: prisma/dev.db is not present');
		return;
	}
	const dir = mkdtempSync(path.join(os.tmpdir(), 'live-check-persist-'));
	const target = path.join(dir, 'test.db');
	copyFileSync(source, target);
	process.env.DATABASE_URL = `file:${target.replace(/\\/g, '/')}`;
	for (const name of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS']) delete process.env[name];

	// `server-only` throws outside a Next server bundle. Stub it so the persistence module can load in this script.
	const serverOnlyPath = require.resolve('server-only');
	require.cache[serverOnlyPath] = { id: serverOnlyPath, filename: serverOnlyPath, loaded: true, exports: {} } as unknown as NodeJS.Module;
	const { prisma } = await import('../lib/prisma');
	const { persistLiveEngineChecks } = await import('../lib/audit/persist-live-checks');
	try {
		const baseReport = { url: 'https://sky-clinic.com', finalUrl: 'https://sky-clinic.com', score: 70, categories: [{ id: 'seo', score: 12 }] };
		const lead = await prisma.auditLead.create({
			data: { url: 'https://sky-clinic.com', score: 70, maxScore: 100, statusLabel: 'ok', reportJson: JSON.stringify(baseReport) },
		});
		const otherLead = await prisma.auditLead.create({
			data: { url: 'https://sky-clinic.com', score: 55, maxScore: 100, statusLabel: 'other', reportJson: JSON.stringify({ ...baseReport, score: 55 }) },
		});
		const readLead = async (id: string) => {
			const row = await prisma.auditLead.findUnique({ where: { id } });
			return { row, report: row ? (JSON.parse(row.reportJson) as Record<string, unknown>) : null };
		};

		const saved = await persistLiveEngineChecks(lead.id, 'https://sky-clinic.com', snap(T1, [grounded('gemini', 90, T1), failure('chatgpt', 62, T1)]));
		assert('a confirmed write returns ok with the store name', saved.ok === true && saved.status === 'saved' && saved.stores.includes('prisma_lead'), saved);
		let state = await readLead(lead.id);
		assert('the stored report carries the live snapshot', readSavedSnapshot(state.report as { liveEngineChecks?: unknown })?.results.length === 2);
		const { liveEngineChecks: _a, ...restAfter } = state.report ?? {};
		assert('scores and other report fields are unchanged', JSON.stringify(restAfter) === JSON.stringify(baseReport) && state.row?.score === 70);
		const untouched = await readLead(otherLead.id);
		assert('another record is not modified', !('liveEngineChecks' in (untouched.report ?? {})) && untouched.row?.score === 55);

		const mismatch = await persistLiveEngineChecks(lead.id, 'https://other-clinic.com', snap(T2, [grounded('gemini', 10, T2)]));
		assert('a different host is not written, so persisted is false', mismatch.ok === false && mismatch.status !== 'saved', mismatch);
		state = await readLead(lead.id);
		assert('the mismatch left the stored snapshot as it was', readSavedSnapshot(state.report as { liveEngineChecks?: unknown })?.startedAt === T1);

		const partial = await persistLiveEngineChecks(lead.id, 'https://sky-clinic.com', snap(T2, [failure('gemini', 61, T2), grounded('perplexity', 97, T2)]));
		assert('a later partial failure is saved', partial.ok === true);
		state = await readLead(lead.id);
		const afterPartial = readSavedSnapshot(state.report as { liveEngineChecks?: unknown });
		assert('the failed engine keeps its earlier success as lastGrounded', afterPartial?.lastGrounded?.gemini?.liveScore === 90);
		assert('the other engine success is stored beside the failure', afterPartial?.results.find((row) => row.engine === 'perplexity')?.liveScore === 97);

		const stale = await persistLiveEngineChecks(lead.id, 'https://sky-clinic.com', snap(T1, [grounded('claude', 50, T1)]));
		assert('an older request cannot overwrite a newer one', stale.ok === false && stale.status === 'stale', stale);
		state = await readLead(lead.id);
		assert('the stored snapshot still belongs to the newer request', readSavedSnapshot(state.report as { liveEngineChecks?: unknown })?.startedAt === T2);

		// two overlapping requests: the newer one wins whatever order they land in
		const racer = await prisma.auditLead.create({
			data: { url: 'https://sky-clinic.com', score: 70, maxScore: 100, statusLabel: 'race', reportJson: JSON.stringify(baseReport) },
		});
		await Promise.all([
			persistLiveEngineChecks(racer.id, 'https://sky-clinic.com', snap(T3, [grounded('gemini', 99, T3)])),
			persistLiveEngineChecks(racer.id, 'https://sky-clinic.com', snap(T1, [grounded('gemini', 11, T1)])),
		]);
		state = await readLead(racer.id);
		const raced = readSavedSnapshot(state.report as { liveEngineChecks?: unknown });
		assert('overlapping writes end with the newer request', raced?.startedAt === T3 && raced.results[0]?.liveScore === 99, raced);

		const missing = await persistLiveEngineChecks('does-not-exist', 'https://sky-clinic.com', snap(T1, [grounded('gemini', 90, T1)]));
		assert('an unknown id is not persisted', missing.ok === false && missing.status === 'record_not_found', missing);
		const blank = await persistLiveEngineChecks('  ', 'https://sky-clinic.com', snap(T1, []));
		assert('a blank id is skipped', blank.ok === false && blank.status === 'skipped');

		await prisma.auditLead.deleteMany({ where: { id: { in: [lead.id, otherLead.id, racer.id] } } });
	} finally {
		await prisma.$disconnect();
		rmSync(dir, { recursive: true, force: true });
	}
}

pureTests();
dbTests()
	.catch((error) => {
		failed += 1;
		console.error(error);
	})
	.finally(() => {
		if (failed) {
			console.error(`\n${failed} assertion(s) failed`);
			process.exitCode = 1;
			return;
		}
		console.log('\nall live-check persistence assertions passed');
	});
