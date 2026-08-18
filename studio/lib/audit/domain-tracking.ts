/**
 * Append-only domain tracking: measured snapshots + prescription apply events.
 *
 * Measured points are written only from completed crawls / rescans.
 * Apply clicks record timeline events and expected scores — they never
 * mutate the measured series (engines need days–weeks to re-index).
 */

import {
	buildDiagnosisScoreSnapshot,
	clampDiagnosisScore,
	measuredScoreFromParts,
} from '@/lib/audit/diagnosis-scores';
import { resolveAuditScoreFromHistory } from '@/lib/audit/resolveAuditScore';
import { siteLabelFromUrl } from '@/lib/audit/report-url';
import { notifyAuditHistorySync } from '@/lib/audit-history-storage';
import type { AuditHistoryEntry } from '@/lib/audit-history-storage';
import type { AuditReport } from '@/lib/site-auditor';

export const DOMAIN_TRACKING_STORAGE_KEY = 'redue_audit_domain_tracking';
export const DOMAIN_TRACKING_STORE_VERSION = 2;
export const DOMAIN_TRACKING_MAX_PER_HOST = 40;
export const DOMAIN_TRACKING_DEDUPE_MS = 90_000;
export const DOMAIN_TRACKING_SCORE_JUMP = 8;
export const DOMAIN_TRACKING_SCHEMA_JUMP = 10;
export const DOMAIN_TRACKING_EVENT_ATTACH_MS = 86_400_000;
export const NEXT_CITATION_MEASUREMENT_DAYS = 7;
export const SYNCING_WINDOW_MS = 86_400_000;
export const PENDING_INDEX_WINDOW_MS = 7 * 86_400_000;

export type TrackingStatus = 'SYNCING' | 'PENDING_INDEX' | 'TRACKING';
export type AppliedEventType = 'PATCH_APPLIED' | 'OPTIMIZATION_COMPLETE';
export type TrackingEventType =
	| 'baseline'
	| 'rescan'
	| 'schema_patch'
	| 'score_jump'
	| 'score_drop'
	| AppliedEventType;
export type TrackingGranularity = 'daily' | 'weekly';
export type TrackingListRange = '7d' | '30d' | 'all';

export interface AppliedPatchItem {
	name: string;
}

export interface TrackingEventMetadata {
	summary?: string;
	schemaType?: string;
	faqCount?: number;
	expectedScore?: number;
	expectedCitation?: number;
	/** Human-readable applied patch names (Schema.org, FAQPage, llms.txt). */
	patches?: string[];
}

export interface TrackingEvent {
	type: TrackingEventType;
	/** 1-based diagnosis ordinal (2 = 2nd rescan). */
	n?: number;
	timestamp?: string;
	metadata?: TrackingEventMetadata;
}

export interface DomainTrackingSnapshot {
	snapshotId: string;
	id: string;
	url: string;
	hostname: string;
	createdAt: string;
	fetchedAt: string;
	measuredScore: number;
	citationIndex: number;
	technicalScore: number;
	externalTrustScore: number;
	schemaCoverage: number;
	isPrescriptionApplied: boolean;
	/** Omitted on legacy rows — treated as measured. */
	kind?: 'measured' | 'event';
}

export interface DomainAppliedEvent {
	eventId: string;
	hostname: string;
	type: AppliedEventType;
	timestamp: string;
	expectedScore: number;
	expectedCitation?: number;
	expectedTechnical?: number;
	expectedExternalTrust?: number;
	metadata?: TrackingEventMetadata;
}

export interface DomainTrackingChartPoint extends DomainTrackingSnapshot {
	dateLabel: string;
	events: TrackingEvent[];
	expectedScore?: number | null;
	expectedCitation?: number | null;
	isGhostAnchor?: boolean;
	/** 1-based diagnosis ordinal for the representative point. */
	runRound?: number;
	appliedPatches?: AppliedPatchItem[];
}

export interface DomainTrackingDeltas {
	scoreDelta: number;
	citationDelta: number;
	citationPct: number | null;
	first: DomainTrackingChartPoint;
	latest: DomainTrackingChartPoint;
}

interface DomainTrackingStoreV2 {
	version: 2;
	snapshots: DomainTrackingSnapshot[];
	appliedEvents: DomainAppliedEvent[];
}

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

export function hostnameFromAuditUrl(raw: string): string {
	return siteLabelFromUrl(raw).toLowerCase();
}

export function formatTrackingDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTrackingDateTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return formatTrackingDate(iso);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${formatTrackingDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoWeekKey(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return formatTrackingDate(iso);
	const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const day = utc.getUTCDay() || 7;
	utc.setUTCDate(utc.getUTCDate() + 4 - day);
	const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
	return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * AI 검색 인용 지수 — same headline as the result-page GEO / AI-trust score.
 * Do not use the legacy site-auditor `categories[id=geo]` ratio; that checklist
 * diverges from `buildDiagnosisScoreSnapshot().externalTrustScore`.
 */
export function citationIndexFromReport(report: AuditReport, externalTrustScore: number): number {
	if (typeof externalTrustScore === 'number' && Number.isFinite(externalTrustScore)) {
		return clampDiagnosisScore(externalTrustScore);
	}
	if (typeof report.geoCitationScore === 'number' && Number.isFinite(report.geoCitationScore)) {
		return clampDiagnosisScore(report.geoCitationScore);
	}
	return 0;
}

export function expectedScoresFromProjectedReport(report: AuditReport): {
	expectedScore: number;
	expectedCitation: number;
	expectedTechnical: number;
	expectedExternalTrust: number;
} {
	const scores = buildDiagnosisScoreSnapshot(report, null, report.lang === 'en' ? 'en' : 'ko');
	return {
		expectedScore: scores.measuredScore,
		expectedCitation: citationIndexFromReport(report, scores.externalTrustScore),
		expectedTechnical: scores.technicalScore,
		expectedExternalTrust: scores.externalTrustScore,
	};
}

export function isProjectedAuditReport(report: AuditReport): boolean {
	return report.scoreSource === 'projected';
}

export function buildSnapshotFromReport(
	id: string,
	report: AuditReport,
	createdAt?: string,
): DomainTrackingSnapshot {
	const scores = buildDiagnosisScoreSnapshot(report, null, report.lang === 'en' ? 'en' : 'ko');
	const fetchedAt = report.fetchedAt || createdAt || new Date().toISOString();
	const stamp = createdAt ?? fetchedAt;
	const hostname = hostnameFromAuditUrl(report.url);
	return {
		snapshotId: `${id}|${fetchedAt}`,
		id,
		url: report.url,
		hostname,
		createdAt: stamp,
		fetchedAt,
		measuredScore: scores.measuredScore,
		citationIndex: citationIndexFromReport(report, scores.externalTrustScore),
		technicalScore: scores.technicalScore,
		externalTrustScore: scores.externalTrustScore,
		schemaCoverage: clampDiagnosisScore(report.schemaCoverage ?? 0),
		isPrescriptionApplied: Boolean(report.isPrescriptionApplied),
		kind: 'measured',
	};
}

export function buildSnapshotFromHistoryEntry(item: AuditHistoryEntry): DomainTrackingSnapshot | null {
	if (item.report?.url) {
		try {
			if (isProjectedAuditReport(item.report)) return null;
			return buildSnapshotFromReport(item.id, item.report, item.createdAt);
		} catch {
			// Fall through to lightweight fields.
		}
	}
	if (!item.url) return null;
	const technicalScore = resolveAuditScoreFromHistory(item).normalizedScore;
	const externalTrustScore = clampDiagnosisScore(item.geoScore ?? 0);
	const fetchedAt = item.fetchedAt || item.createdAt;
	return {
		snapshotId: `${item.id}|${fetchedAt}`,
		id: item.id,
		url: item.url,
		hostname: hostnameFromAuditUrl(item.url),
		createdAt: item.createdAt || fetchedAt,
		fetchedAt,
		measuredScore: measuredScoreFromParts(externalTrustScore, technicalScore, { url: item.url }),
		citationIndex: externalTrustScore,
		technicalScore,
		externalTrustScore,
		schemaCoverage: 0,
		isPrescriptionApplied: Boolean(item.report?.isPrescriptionApplied),
		kind: 'measured',
	};
}

function isNearDuplicate(a: DomainTrackingSnapshot, b: DomainTrackingSnapshot): boolean {
	if (a.hostname !== b.hostname) return false;
	if (a.snapshotId === b.snapshotId) return true;
	const ta = new Date(a.fetchedAt).getTime();
	const tb = new Date(b.fetchedAt).getTime();
	if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
	if (Math.abs(ta - tb) > DOMAIN_TRACKING_DEDUPE_MS) return false;
	return (
		a.measuredScore === b.measuredScore &&
		a.citationIndex === b.citationIndex &&
		a.technicalScore === b.technicalScore &&
		a.externalTrustScore === b.externalTrustScore &&
		a.isPrescriptionApplied === b.isPrescriptionApplied
	);
}

function normalizeSnapshotCitation(snap: DomainTrackingSnapshot): DomainTrackingSnapshot {
	const citationIndex = clampDiagnosisScore(snap.externalTrustScore || snap.citationIndex);
	return citationIndex === snap.citationIndex ? snap : { ...snap, citationIndex };
}

export function mergeDomainHistoryPoints(entries: DomainTrackingSnapshot[]): DomainTrackingSnapshot[] {
	const kept: DomainTrackingSnapshot[] = [];
	const sorted = [...entries].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);

	for (const entry of sorted) {
		if (!entry.hostname) continue;
		if (entry.kind === 'event') continue;
		const normalized = normalizeSnapshotCitation(entry);
		const dup = kept.some((existing) => isNearDuplicate(existing, normalized));
		if (!dup) kept.push(normalized);
	}

	return kept;
}

function emptyStore(): DomainTrackingStoreV2 {
	return { version: 2, snapshots: [], appliedEvents: [] };
}

function isLikelyProjectedSnapshot(
	snap: DomainTrackingSnapshot,
	prev: DomainTrackingSnapshot | undefined,
): boolean {
	if (snap.kind === 'event') return true;
	if (typeof snap.id === 'string' && snap.id.includes(':patch:')) return true;
	if (!prev || snap.hostname !== prev.hostname || !snap.isPrescriptionApplied) return false;
	const dt = Math.abs(new Date(snap.createdAt).getTime() - new Date(prev.createdAt).getTime());
	if (dt > 5 * 60_000) return false;
	return snap.measuredScore - prev.measuredScore >= DOMAIN_TRACKING_SCORE_JUMP;
}

function eventFromProjectedSnapshot(snap: DomainTrackingSnapshot): DomainAppliedEvent {
	return {
		eventId: snap.snapshotId || `${snap.id}|${snap.createdAt}`,
		hostname: snap.hostname,
		type: 'PATCH_APPLIED',
		timestamp: snap.createdAt,
		expectedScore: snap.measuredScore,
		expectedCitation: snap.citationIndex,
		expectedTechnical: snap.technicalScore,
		expectedExternalTrust: snap.externalTrustScore,
		metadata: { expectedScore: snap.measuredScore, expectedCitation: snap.citationIndex },
	};
}

function migrateV1Snapshots(raw: DomainTrackingSnapshot[]): DomainTrackingStoreV2 {
	const sorted = [...raw].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
	);
	const snapshots: DomainTrackingSnapshot[] = [];
	const appliedEvents: DomainAppliedEvent[] = [];

	for (const snap of sorted) {
		const prev = snapshots[snapshots.length - 1];
		if (isLikelyProjectedSnapshot(snap, prev)) {
			appliedEvents.push(eventFromProjectedSnapshot(snap));
			continue;
		}
		snapshots.push({ ...snap, kind: snap.kind ?? 'measured' });
	}

	return { version: 2, snapshots, appliedEvents };
}

function readStore(): DomainTrackingStoreV2 {
	if (!isBrowser()) return emptyStore();
	try {
		const raw = window.localStorage.getItem(DOMAIN_TRACKING_STORAGE_KEY);
		if (!raw) return emptyStore();
		const parsed = JSON.parse(raw) as unknown;
		if (Array.isArray(parsed)) {
			const migrated = migrateV1Snapshots(parsed as DomainTrackingSnapshot[]);
			writeStore(migrated);
			return migrated;
		}
		if (parsed && typeof parsed === 'object') {
			const rec = parsed as { version?: number; snapshots?: unknown; appliedEvents?: unknown };
			const snapshots = Array.isArray(rec.snapshots) ? (rec.snapshots as DomainTrackingSnapshot[]) : [];
			const appliedEvents = Array.isArray(rec.appliedEvents)
				? (rec.appliedEvents as DomainAppliedEvent[])
				: [];
			return { version: 2, snapshots, appliedEvents };
		}
		return emptyStore();
	} catch {
		return emptyStore();
	}
}

function writeStore(store: DomainTrackingStoreV2): void {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(
			DOMAIN_TRACKING_STORAGE_KEY,
			JSON.stringify({
				version: DOMAIN_TRACKING_STORE_VERSION,
				snapshots: store.snapshots,
				appliedEvents: store.appliedEvents,
			}),
		);
	} catch {
		// Quota / private mode — ignore; in-memory merge still works for this session.
	}
}

function capPerHost(entries: DomainTrackingSnapshot[]): DomainTrackingSnapshot[] {
	const byHost = new Map<string, DomainTrackingSnapshot[]>();
	for (const entry of entries) {
		const list = byHost.get(entry.hostname) ?? [];
		list.push(entry);
		byHost.set(entry.hostname, list);
	}

	const next: DomainTrackingSnapshot[] = [];
	for (const list of byHost.values()) {
		const sorted = list.sort(
			(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		);
		next.push(...sorted.slice(-DOMAIN_TRACKING_MAX_PER_HOST));
	}
	return next;
}

export function listDomainTrackingSnapshots(hostname: string): DomainTrackingSnapshot[] {
	const host = hostname.toLowerCase();
	return mergeDomainHistoryPoints(readStore().snapshots.filter((item) => item.hostname === host));
}

export function listDomainAppliedEvents(hostname: string): DomainAppliedEvent[] {
	const host = hostname.toLowerCase();
	return readStore()
		.appliedEvents.filter((item) => item.hostname === host)
		.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function latestAppliedEventForHost(hostname: string): DomainAppliedEvent | null {
	const events = listDomainAppliedEvents(hostname);
	return events[events.length - 1] ?? null;
}

export function appendDomainTrackingSnapshot(snapshot: DomainTrackingSnapshot): DomainTrackingSnapshot {
	const store = readStore();
	const next = capPerHost(mergeDomainHistoryPoints([...store.snapshots, { ...snapshot, kind: 'measured' }]));
	writeStore({ ...store, snapshots: next });
	return snapshot;
}

export function persistReportTrackingSnapshot(
	id: string,
	report: AuditReport,
	createdAt?: string,
): DomainTrackingSnapshot {
	const snapshot = buildSnapshotFromReport(id, report, createdAt);
	if (isProjectedAuditReport(report) || (typeof id === 'string' && id.includes(':patch:'))) {
		return snapshot;
	}
	return appendDomainTrackingSnapshot(snapshot);
}

export function persistAppliedTrackingEvent(
	event: Omit<DomainAppliedEvent, 'eventId'> & { eventId?: string },
): DomainAppliedEvent {
	const stored: DomainAppliedEvent = {
		...event,
		eventId: event.eventId ?? `${event.hostname}|${event.type}|${event.timestamp}`,
		hostname: event.hostname.toLowerCase(),
	};
	const store = readStore();
	const exists = store.appliedEvents.some((item) => item.eventId === stored.eventId);
	const appliedEvents = exists
		? store.appliedEvents.map((item) => (item.eventId === stored.eventId ? stored : item))
		: [...store.appliedEvents, stored];
	writeStore({ ...store, appliedEvents });
	notifyAuditHistorySync({ all: true });
	return stored;
}

export function snapshotsFromHistoryList(
	items: AuditHistoryEntry[],
	hostname: string,
): DomainTrackingSnapshot[] {
	const host = hostname.toLowerCase();
	const out: DomainTrackingSnapshot[] = [];
	for (const item of items) {
		if (hostnameFromAuditUrl(item.url) !== host) continue;
		const snap = buildSnapshotFromHistoryEntry(item);
		if (snap) out.push(snap);
	}
	return out;
}

export function resolveTrackingStatus(args: {
	appliedAt?: string | null;
	latestMeasuredAt?: string | null;
	now?: number;
}): TrackingStatus | null {
	if (!args.appliedAt) return null;
	const applied = new Date(args.appliedAt).getTime();
	if (!Number.isFinite(applied)) return null;
	const now = args.now ?? Date.now();
	const measured = args.latestMeasuredAt ? new Date(args.latestMeasuredAt).getTime() : NaN;
	if (Number.isFinite(measured) && measured > applied + 60_000) return 'TRACKING';
	const elapsed = now - applied;
	if (elapsed < SYNCING_WINDOW_MS) return 'SYNCING';
	if (elapsed < PENDING_INDEX_WINDOW_MS) return 'PENDING_INDEX';
	return 'TRACKING';
}

export function daysUntilNextCitationMeasurement(
	appliedAt?: string | null,
	latestMeasuredAfterApply?: string | null,
	now = Date.now(),
): number | null {
	if (!appliedAt) return null;
	if (latestMeasuredAfterApply) return null;
	const due = new Date(appliedAt).getTime() + NEXT_CITATION_MEASUREMENT_DAYS * 86_400_000;
	if (!Number.isFinite(due)) return null;
	return Math.max(0, Math.ceil((due - now) / 86_400_000));
}

export function latestMeasuredAfter(points: DomainTrackingSnapshot[], appliedAt: string): string | null {
	const applied = new Date(appliedAt).getTime();
	if (!Number.isFinite(applied)) return null;
	const later = points
		.filter((point) => new Date(point.createdAt).getTime() > applied + 60_000)
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	return later[0]?.createdAt ?? null;
}

function dateLabelForPoints(points: DomainTrackingSnapshot[], index: number): string {
	const current = formatTrackingDate(points[index].createdAt);
	const sameDayCount = points.filter((p) => formatTrackingDate(p.createdAt) === current).length;
	if (sameDayCount > 1) return formatTrackingDateTime(points[index].createdAt);
	return current;
}

function eventDedupeKey(event: TrackingEvent): string {
	return [
		event.type,
		event.n ?? '',
		event.timestamp ?? '',
		event.metadata?.schemaType ?? '',
		event.metadata?.summary ?? '',
		(event.metadata?.patches ?? []).join(','),
	].join('|');
}

export function mergeTrackingEvents(...lists: TrackingEvent[][]): TrackingEvent[] {
	const seen = new Set<string>();
	const out: TrackingEvent[] = [];
	for (const list of lists) {
		for (const event of list) {
			const key = eventDedupeKey(event);
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(event);
		}
	}
	return out;
}

export function extractAppliedPatchItems(events: TrackingEvent[]): AppliedPatchItem[] {
	const seen = new Set<string>();
	const names: string[] = [];
	const add = (raw: string) => {
		const name = raw.trim();
		if (!name) return;
		const key = name.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		names.push(name);
	};

	for (const event of events) {
		if (
			event.type !== 'PATCH_APPLIED' &&
			event.type !== 'schema_patch' &&
			event.type !== 'OPTIMIZATION_COMPLETE'
		) {
			continue;
		}
		const meta = event.metadata;
		if (Array.isArray(meta?.patches) && meta.patches.length > 0) {
			for (const patch of meta.patches) add(String(patch));
			continue;
		}
		if (meta?.schemaType) add(meta.schemaType);
		if (typeof meta?.faqCount === 'number' && meta.faqCount > 0) add('FAQPage');
		if (meta?.summary) {
			for (const part of meta.summary.split(/\s*[·|,]\s*/)) {
				const token = part.trim();
				if (!token) continue;
				if (/^FAQ\s*\d+$/i.test(token)) add('FAQPage');
				else add(token);
			}
		}
	}

	return names.map((name) => ({ name }));
}

export function decorateChartPoint(
	point: DomainTrackingChartPoint,
	index = 0,
): DomainTrackingChartPoint {
	const appliedPatches = extractAppliedPatchItems(point.events);
	const fromEvents = point.events.reduce(
		(max, event) => (typeof event.n === 'number' && event.n > max ? event.n : max),
		0,
	);
	const runRound =
		fromEvents || (point.events.some((event) => event.type === 'baseline') ? 1 : index + 1);
	return { ...point, appliedPatches, runRound };
}

export function filterTrackingPointsByRange(
	points: DomainTrackingChartPoint[],
	range: TrackingListRange,
	now = Date.now(),
): DomainTrackingChartPoint[] {
	const measured = points.filter((point) => !point.isGhostAnchor);
	if (range === 'all') return measured;
	const days = range === '7d' ? 7 : 30;
	const cutoff = now - days * 86_400_000;
	return measured.filter((point) => {
		const time = new Date(point.createdAt).getTime();
		return Number.isFinite(time) && time >= cutoff;
	});
}

function absorbChartPoint(
	keep: DomainTrackingChartPoint,
	drop: DomainTrackingChartPoint,
): DomainTrackingChartPoint {
	const events = mergeTrackingEvents(keep.events, drop.events);
	return decorateChartPoint({
		...keep,
		events,
		expectedScore: keep.expectedScore ?? drop.expectedScore,
		expectedCitation: keep.expectedCitation ?? drop.expectedCitation,
		isPrescriptionApplied: keep.isPrescriptionApplied || drop.isPrescriptionApplied,
	});
}

function granularityBucketKey(
	point: DomainTrackingChartPoint,
	granularity: TrackingGranularity,
): string {
	return granularity === 'weekly' ? isoWeekKey(point.createdAt) : formatTrackingDate(point.createdAt);
}

export function assignTrackingEvents(points: DomainTrackingSnapshot[]): DomainTrackingChartPoint[] {
	return points.map((point, index, arr) => {
		const events: TrackingEvent[] = [];
		if (index === 0) {
			events.push({ type: 'baseline' });
		} else {
			events.push({ type: 'rescan', n: index + 1 });
		}

		const prev = arr[index - 1];
		const schemaLift =
			prev != null && point.schemaCoverage - prev.schemaCoverage >= DOMAIN_TRACKING_SCHEMA_JUMP;
		if (schemaLift) {
			events.push({ type: 'schema_patch' });
		}
		if (prev) {
			const delta = point.measuredScore - prev.measuredScore;
			if (delta >= DOMAIN_TRACKING_SCORE_JUMP) events.push({ type: 'score_jump' });
			else if (delta <= -DOMAIN_TRACKING_SCORE_JUMP) events.push({ type: 'score_drop' });
		}

		return decorateChartPoint(
			{
				...point,
				dateLabel: dateLabelForPoints(arr, index),
				events,
			},
			index,
		);
	});
}

function attachEventToPoint(point: DomainTrackingChartPoint, event: DomainAppliedEvent): DomainTrackingChartPoint {
	const trackingEvent: TrackingEvent = {
		type: event.type,
		timestamp: event.timestamp,
		metadata: {
			...event.metadata,
			expectedScore: event.expectedScore,
			expectedCitation: event.expectedCitation,
		},
	};
	const already = point.events.some(
		(item) => item.type === event.type && item.timestamp === event.timestamp,
	);
	return {
		...point,
		events: already ? point.events : [...point.events, trackingEvent],
		isPrescriptionApplied: true,
	};
}

export function overlayAppliedEventsOnPoints(
	points: DomainTrackingChartPoint[],
	events: DomainAppliedEvent[],
): DomainTrackingChartPoint[] {
	if (events.length === 0) return points;

	const out = points.map((point) => ({ ...point, events: [...point.events] }));
	const sortedEvents = [...events].sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);

	for (const event of sortedEvents) {
		const eventTime = new Date(event.timestamp).getTime();
		if (!Number.isFinite(eventTime)) continue;

		let nearestIdx = -1;
		let nearestDist = Infinity;
		for (let i = 0; i < out.length; i++) {
			const dist = Math.abs(new Date(out[i].createdAt).getTime() - eventTime);
			if (dist < nearestDist) {
				nearestDist = dist;
				nearestIdx = i;
			}
		}

		if (nearestIdx >= 0 && nearestDist <= DOMAIN_TRACKING_EVENT_ATTACH_MS) {
			out[nearestIdx] = attachEventToPoint(out[nearestIdx], event);
			continue;
		}

		const prev =
			[...out].reverse().find((point) => new Date(point.createdAt).getTime() <= eventTime) ??
			out[out.length - 1];
		if (!prev) continue;
		out.push(
			attachEventToPoint(
				{
					...prev,
					snapshotId: `event:${event.eventId}`,
					id: `event:${event.eventId}`,
					createdAt: event.timestamp,
					fetchedAt: event.timestamp,
					dateLabel: formatTrackingDateTime(event.timestamp),
					events: [],
					kind: 'measured',
				},
				event,
			),
		);
	}

	out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

	const firstApply = sortedEvents[0];
	if (!firstApply) return out;

	const applyTime = new Date(firstApply.timestamp).getTime();
	const applyIdx = out.findIndex((point) => {
		const t = new Date(point.createdAt).getTime();
		return Math.abs(t - applyTime) <= DOMAIN_TRACKING_EVENT_ATTACH_MS || t >= applyTime;
	});

	if (applyIdx > 0 && out[applyIdx - 1].expectedScore == null) {
		out[applyIdx - 1] = {
			...out[applyIdx - 1],
			expectedScore: out[applyIdx - 1].measuredScore,
			expectedCitation: out[applyIdx - 1].citationIndex,
		};
	}

	for (let i = Math.max(0, applyIdx); i < out.length; i++) {
		if (i === applyIdx && applyIdx <= 0) {
			out[i] = {
				...out[i],
				expectedScore: out[i].measuredScore,
				expectedCitation: out[i].citationIndex,
			};
			continue;
		}
		if (i === applyIdx && applyIdx > 0) {
			out[i] = {
				...out[i],
				expectedScore: firstApply.expectedScore,
				expectedCitation: firstApply.expectedCitation ?? null,
			};
			continue;
		}
		out[i] = {
			...out[i],
			expectedScore: firstApply.expectedScore,
			expectedCitation: firstApply.expectedCitation ?? null,
		};
	}

	const applyPoint = applyIdx >= 0 ? out[applyIdx] : null;
	const needsGhost =
		applyPoint != null &&
		(applyIdx <= 0 || out.filter((point) => (point.expectedScore ?? null) != null).length < 2);

	if (needsGhost && applyPoint) {
		const ghostAt = new Date(new Date(applyPoint.createdAt).getTime() + 60_000).toISOString();
		out.splice(applyIdx + 1, 0, {
			...applyPoint,
			snapshotId: `${applyPoint.snapshotId}|ghost`,
			id: `${applyPoint.id}|ghost`,
			createdAt: ghostAt,
			fetchedAt: ghostAt,
			dateLabel: `${applyPoint.dateLabel} · +`,
			measuredScore: applyPoint.measuredScore,
			citationIndex: applyPoint.citationIndex,
			expectedScore: firstApply.expectedScore,
			expectedCitation: firstApply.expectedCitation ?? null,
			events: [],
			isGhostAnchor: true,
		});
	}

	return out.map((point, index, arr) =>
		decorateChartPoint(
			{
				...point,
				dateLabel: point.isGhostAnchor ? point.dateLabel : dateLabelForPoints(arr, index),
			},
			index,
		),
	);
}

export function computeTrackingDeltas(points: DomainTrackingChartPoint[]): DomainTrackingDeltas | null {
	const measured = points.filter((point) => !point.isGhostAnchor);
	if (measured.length < 2) return null;
	const first = measured[0];
	const latest = measured[measured.length - 1];
	const scoreDelta = latest.measuredScore - first.measuredScore;
	const citationDelta = latest.citationIndex - first.citationIndex;
	const citationPct =
		first.citationIndex > 0 ? Math.round((citationDelta / first.citationIndex) * 100) : null;
	return { scoreDelta, citationDelta, citationPct, first, latest };
}

export function aggregateTrackingByGranularity(
	points: DomainTrackingChartPoint[],
	granularity: TrackingGranularity,
): DomainTrackingChartPoint[] {
	if (points.length <= 1) {
		return points.map((point, index) =>
			decorateChartPoint(
				{
					...point,
					dateLabel: point.isGhostAnchor
						? point.dateLabel
						: granularity === 'daily'
							? formatTrackingDate(point.createdAt)
							: point.dateLabel,
				},
				index,
			),
		);
	}

	const buckets = new Map<string, DomainTrackingChartPoint>();
	for (const point of points) {
		const key = granularityBucketKey(point, granularity);
		const existing = buckets.get(key);
		if (!existing) {
			buckets.set(key, { ...point, events: [...point.events] });
			continue;
		}

		const existingGhost = Boolean(existing.isGhostAnchor);
		const incomingGhost = Boolean(point.isGhostAnchor);
		if (incomingGhost && !existingGhost) {
			buckets.set(key, absorbChartPoint(existing, point));
			continue;
		}
		if (!incomingGhost && existingGhost) {
			buckets.set(key, absorbChartPoint({ ...point, events: [...point.events] }, existing));
			continue;
		}

		const existingTime = new Date(existing.createdAt).getTime();
		const incomingTime = new Date(point.createdAt).getTime();
		if (incomingTime >= existingTime) {
			buckets.set(key, absorbChartPoint({ ...point, events: [...point.events] }, existing));
		} else {
			buckets.set(key, absorbChartPoint(existing, point));
		}
	}

	return [...buckets.values()]
		.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
		.map((point, index, arr) =>
			decorateChartPoint(
				{
					...point,
					dateLabel: point.isGhostAnchor
						? point.dateLabel
						: granularity === 'daily'
							? formatTrackingDate(point.createdAt)
							: dateLabelForPoints(arr, index),
				},
				index,
			),
		);
}
