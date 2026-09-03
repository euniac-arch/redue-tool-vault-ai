import { persistAsiCoreSlice, clearAsiPersistedHistory } from '@/lib/ai-search-intelligence/persist/repository';
import { resetAsiHistoryHydration } from '@/lib/ai-search-intelligence/persist/state';
import { visibleCompetitorNames } from '@/lib/ai-search-intelligence/competitors/service';
import { readAsiCitationStore } from '@/lib/ai-search-intelligence/citations/store';
import { ASI_VISIBILITY_CONFIG } from '@/lib/ai-search-intelligence/visibility/config';
import { buildVisibilityRecord } from '@/lib/ai-search-intelligence/visibility/score';
import type { AIResponse, AsiSource, AsiVisibilityCadence, AsiVisibilityRecord } from '@/lib/ai-search-intelligence/types';

const STORE = new Map<string, AsiVisibilityRecord[]>();

function keyFor(domain: string): string {
	return domain.trim().toLowerCase();
}

export function readAsiVisibilityStore(domain: string): AsiVisibilityRecord[] {
	return [...(STORE.get(keyFor(domain)) ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function clearAsiVisibilityStore(domain?: string, options?: { persist?: boolean }) {
	if (!domain) {
		STORE.clear();
		resetAsiHistoryHydration();
		return;
	}
	STORE.delete(keyFor(domain));
	resetAsiHistoryHydration(domain);
	if (options?.persist !== false) clearAsiPersistedHistory(domain);
}

export function latestAsiVisibilityRecord(domain: string): AsiVisibilityRecord | null {
	const rows = readAsiVisibilityStore(domain);
	return rows[rows.length - 1] ?? null;
}

export function appendAsiVisibilityStore(
	domain: string,
	record: AsiVisibilityRecord,
	options?: { persist?: boolean },
): AsiVisibilityRecord[] {
	const current = readAsiVisibilityStore(domain);
	const next = [...current, record]
		.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
		.slice(-ASI_VISIBILITY_CONFIG.maxSnapshots);
	STORE.set(keyFor(domain), next);
	if (options?.persist !== false) persistAsiCoreSlice(domain, { visibility: record });
	return next;
}

const DEDUP_MS = 2 * 60 * 1000;

function sameVisibilityScore(a: AsiVisibilityRecord, b: AsiVisibilityRecord): boolean {
	return (
		a.visibility === b.visibility &&
		a.recommendation === b.recommendation &&
		a.citation === b.citation &&
		a.sov === b.sov &&
		a.queryCount === b.queryCount
	);
}

function liveResponses(rows: readonly AIResponse[]): AIResponse[] {
	return rows.filter((row) => row.source === 'live' && !row.meta?.error);
}

/**
 * Durable VisibilitySnapshot write. Uses the in-memory + file history store
 * (`.data/asi/{domain}/visibility.json`) with timestamped KPI payload.
 */
export function recordAsiVisibilitySnapshot(input: {
	domain: string;
	brand: string;
	aliases?: readonly string[];
	responses?: readonly AIResponse[];
	source: AsiSource;
	cadence?: AsiVisibilityCadence;
	timestamp?: string;
}): AsiVisibilityRecord | null {
	const stored = liveResponses(readAsiCitationStore(input.domain).responses);
	const incoming = liveResponses(input.responses ?? []);
	const byKey = new Map<string, AIResponse>();
	for (const row of [...stored, ...incoming]) {
		byKey.set(`${row.provider}::${row.query.trim().toLowerCase()}`, row);
	}
	const responses = [...byKey.values()];
	if (!responses.length) return null;

	const record = buildVisibilityRecord({
		responses,
		brand: input.brand,
		aliases: input.aliases,
		timestamp: input.timestamp,
		cadence: input.cadence ?? 'on_demand',
		source: input.source,
		competitorNames: visibleCompetitorNames(input.domain),
	});
	const last = latestAsiVisibilityRecord(input.domain);
	if (
		last &&
		sameVisibilityScore(last, record) &&
		Math.abs(Date.parse(record.timestamp) - Date.parse(last.timestamp)) < DEDUP_MS
	) {
		return last;
	}
	appendAsiVisibilityStore(input.domain, record);
	return record;
}
