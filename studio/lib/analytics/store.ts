/**
 * Persistence for daily site-analytics aggregates. Follows the same
 * resilience pattern as `lib/ai-hub/daily-ai-rankings-store.ts`:
 *   - in-memory (fastest, per-process, lost on restart)
 *   - disk JSON under the writable data root (best-effort dev/offline mirror)
 *   - Firestore (source of truth when Firebase Admin is configured)
 *
 * Unique-visitor de-duplication happens via a `visitors` sub-collection
 * (Firestore) / per-date `Set` (memory) keyed by the client's per-session
 * visitor id, so repeat page loads in the same browser session only count
 * once toward `uniqueVisitors` while every load still counts toward
 * `totalViews`.
 */

import 'server-only';

import fs from 'node:fs/promises';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { ensureWritableDir, writableDataPath } from '@/lib/server/writable-data-dir';
import { isValidDateKey, shiftDateKey } from '@/lib/analytics/detect';
import type { DailyAnalyticsAggregate, NormalizedAnalyticsEvent } from '@/lib/analytics/types';

export const ANALYTICS_DAILY_COLLECTION = 'analytics_daily';
export const ANALYTICS_VISITORS_SUBCOLLECTION = 'visitors';

/** Cap distinct keys per breakdown bucket (referrers/devices/browsers/os) so a doc never grows unbounded. */
const MAX_BREAKDOWN_KEYS = 40;
const OTHER_KEY = 'Other';
/** Guardrail for the admin dashboard's custom date range. */
export const MAX_RANGE_DAYS = 366;

function emptyAggregate(date: string): DailyAnalyticsAggregate {
	return {
		date,
		totalViews: 0,
		uniqueVisitors: 0,
		referrers: {},
		devices: {},
		browsers: {},
		os: {},
		updatedAt: new Date().toISOString(),
	};
}

function cloneAggregate(agg: DailyAnalyticsAggregate): DailyAnalyticsAggregate {
	return {
		...agg,
		referrers: { ...agg.referrers },
		devices: { ...agg.devices },
		browsers: { ...agg.browsers },
		os: { ...agg.os },
	};
}

/** Firestore field-path segments can't contain `.`/`~`/`*`/`/`/`[`/`]`; keep bucket keys short and safe. */
function sanitizeBucketKey(label: string): string {
	const cleaned = (label || 'Unknown').trim().replace(/[.~*/[\]]/g, '_').slice(0, 60);
	return cleaned || 'Unknown';
}

function pickBucketKey(bucket: Record<string, number> | undefined, rawLabel: string): string {
	const key = sanitizeBucketKey(rawLabel);
	const existing = bucket ?? {};
	if (key in existing) return key;
	if (Object.keys(existing).length >= MAX_BREAKDOWN_KEYS) return OTHER_KEY;
	return key;
}

// ---------------------------------------------------------------------------
// Tier 1: in-memory (always available, fastest, per-process)
// ---------------------------------------------------------------------------

const memory = new Map<string, DailyAnalyticsAggregate>();
const memoryVisitorSeen = new Map<string, Set<string>>();

function bumpMemoryBucket(bucket: Record<string, number>, rawLabel: string) {
	const key = pickBucketKey(bucket, rawLabel);
	bucket[key] = (bucket[key] ?? 0) + 1;
}

function applyEventToMemory(event: NormalizedAnalyticsEvent): DailyAnalyticsAggregate {
	const agg = memory.get(event.date) ?? emptyAggregate(event.date);
	agg.totalViews += 1;

	const seen = memoryVisitorSeen.get(event.date) ?? new Set<string>();
	if (!seen.has(event.visitorId)) {
		seen.add(event.visitorId);
		memoryVisitorSeen.set(event.date, seen);
		agg.uniqueVisitors += 1;
	}

	bumpMemoryBucket(agg.referrers, event.referrerLabel);
	bumpMemoryBucket(agg.devices, event.device);
	bumpMemoryBucket(agg.browsers, event.browser);
	bumpMemoryBucket(agg.os, event.os);
	agg.updatedAt = new Date().toISOString();

	memory.set(event.date, agg);
	return cloneAggregate(agg);
}

// ---------------------------------------------------------------------------
// Tier 2: disk JSON mirror (best-effort; never authoritative)
// ---------------------------------------------------------------------------

function fileDir(): string {
	return writableDataPath('analytics', 'daily');
}

function filePath(date: string): string {
	return writableDataPath('analytics', 'daily', `${date}.json`);
}

function isAggregate(value: unknown): value is DailyAnalyticsAggregate {
	if (!value || typeof value !== 'object') return false;
	const row = value as DailyAnalyticsAggregate;
	return typeof row.date === 'string' && typeof row.totalViews === 'number' && typeof row.uniqueVisitors === 'number';
}

async function readFileAggregate(date: string): Promise<DailyAnalyticsAggregate | null> {
	try {
		const raw = await fs.readFile(filePath(date), 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		return isAggregate(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

async function writeFileAggregate(agg: DailyAnalyticsAggregate): Promise<void> {
	try {
		if (!(await ensureWritableDir(fileDir()))) return;
		await fs.writeFile(filePath(agg.date), JSON.stringify(agg), 'utf8');
	} catch (error) {
		console.warn('[analytics] disk mirror skipped:', error instanceof Error ? error.message : error);
	}
}

// ---------------------------------------------------------------------------
// Tier 3: Firestore (source of truth in production)
// ---------------------------------------------------------------------------

async function applyEventToFirestore(event: NormalizedAnalyticsEvent): Promise<void> {
	if (!isFirebaseAdminConfigured()) return;

	const db = getAdminFirestore();
	const dayRef = db.collection(ANALYTICS_DAILY_COLLECTION).doc(event.date);
	const visitorRef = dayRef.collection(ANALYTICS_VISITORS_SUBCOLLECTION).doc(event.visitorId || 'unknown');

	try {
		await db.runTransaction(async (tx) => {
			const [visitorSnap, daySnap] = await Promise.all([tx.get(visitorRef), tx.get(dayRef)]);
			const isNewVisitor = !visitorSnap.exists;
			const dayData = (daySnap.exists ? daySnap.data() : null) as Partial<DailyAnalyticsAggregate> | null;

			const referrerKey = pickBucketKey(dayData?.referrers, event.referrerLabel);
			const deviceKey = pickBucketKey(dayData?.devices, event.device);
			const browserKey = pickBucketKey(dayData?.browsers, event.browser);
			const osKey = pickBucketKey(dayData?.os, event.os);

			if (isNewVisitor) {
				tx.set(visitorRef, { firstSeenAt: FieldValue.serverTimestamp() });
			}

			tx.set(
				dayRef,
				{
					date: event.date,
					totalViews: FieldValue.increment(1),
					uniqueVisitors: FieldValue.increment(isNewVisitor ? 1 : 0),
					referrers: { [referrerKey]: FieldValue.increment(1) },
					devices: { [deviceKey]: FieldValue.increment(1) },
					browsers: { [browserKey]: FieldValue.increment(1) },
					os: { [osKey]: FieldValue.increment(1) },
					updatedAt: FieldValue.serverTimestamp(),
				},
				{ merge: true },
			);
		});
	} catch (error) {
		console.warn('[analytics] Firestore transaction failed:', error instanceof Error ? error.message : error);
	}
}

function timestampToIso(value: unknown): string {
	if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
		try {
			return (value as { toDate: () => Date }).toDate().toISOString();
		} catch {
			// fall through
		}
	}
	return new Date().toISOString();
}

async function readFirestoreAggregate(date: string): Promise<DailyAnalyticsAggregate | null> {
	if (!isFirebaseAdminConfigured()) return null;
	try {
		const snap = await getAdminFirestore().collection(ANALYTICS_DAILY_COLLECTION).doc(date).get();
		if (!snap.exists) return null;
		const data = snap.data() as Partial<DailyAnalyticsAggregate> & { updatedAt?: unknown };
		return {
			date,
			totalViews: typeof data.totalViews === 'number' ? data.totalViews : 0,
			uniqueVisitors: typeof data.uniqueVisitors === 'number' ? data.uniqueVisitors : 0,
			referrers: data.referrers ?? {},
			devices: data.devices ?? {},
			browsers: data.browsers ?? {},
			os: data.os ?? {},
			updatedAt: timestampToIso(data.updatedAt),
		};
	} catch (error) {
		console.warn('[analytics] Firestore read failed:', error instanceof Error ? error.message : error);
		return null;
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Records one page-view event across all available storage tiers. Never throws. */
export async function recordAnalyticsEvent(event: NormalizedAnalyticsEvent): Promise<void> {
	const snapshot = applyEventToMemory(event);
	await Promise.allSettled([writeFileAggregate(snapshot), applyEventToFirestore(event)]);
}

/** Reads one day, preferring Firestore (multi-instance source of truth), then this process's memory, then disk. */
export async function readDailyAnalyticsAggregate(date: string): Promise<DailyAnalyticsAggregate> {
	if (isFirebaseAdminConfigured()) {
		const fromFirestore = await readFirestoreAggregate(date);
		if (fromFirestore) return fromFirestore;
	}
	const fromMemory = memory.get(date);
	if (fromMemory) return cloneAggregate(fromMemory);
	const fromDisk = await readFileAggregate(date);
	return fromDisk ?? emptyAggregate(date);
}

/** Reads an inclusive date range, clamped to `MAX_RANGE_DAYS` to keep admin custom-range queries bounded. */
export async function readAnalyticsRange(startDate: string, endDate: string): Promise<DailyAnalyticsAggregate[]> {
	let start = isValidDateKey(startDate) ? startDate : endDate;
	const end = isValidDateKey(endDate) ? endDate : startDate;
	if (start > end) start = end;

	const earliestAllowed = shiftDateKey(end, -(MAX_RANGE_DAYS - 1));
	if (start < earliestAllowed) start = earliestAllowed;

	const dates: string[] = [];
	let cursor = start;
	while (cursor <= end && dates.length < MAX_RANGE_DAYS) {
		dates.push(cursor);
		cursor = shiftDateKey(cursor, 1);
	}

	return Promise.all(dates.map((date) => readDailyAnalyticsAggregate(date)));
}
