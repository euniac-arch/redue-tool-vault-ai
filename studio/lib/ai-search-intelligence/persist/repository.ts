import { isAsiPersistEnabled } from '@/lib/ai-search-intelligence/persist/enabled';
import type { AsiHistoryKind, AsiHistoryRecord } from '@/lib/ai-search-intelligence/persist/kinds';
import { clearAsiHistoryFiles, readAsiHistoryKind, writeAsiHistoryRecords } from '@/lib/ai-search-intelligence/persist/fs-store';
import type {
	AIObservation,
	Action,
	Alert,
	CompetitorObservation,
	Evidence,
	Opportunity,
} from '@/lib/ai-search-intelligence/core/models';
import type { AIResponse, AsiVisibilityRecord } from '@/lib/ai-search-intelligence/types';

function newId(): string {
	return `asi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function row(
	domain: string,
	kind: AsiHistoryKind,
	payload: unknown,
	extras?: { provider?: string | null; query?: string | null; timestamp?: string },
): AsiHistoryRecord {
	return {
		id: newId(),
		domain: domain.trim().toLowerCase(),
		kind,
		provider: extras?.provider ?? null,
		query: extras?.query ?? null,
		timestamp: extras?.timestamp || new Date().toISOString(),
		payload,
	};
}

export function clearAsiPersistedHistory(domain?: string) {
	clearAsiHistoryFiles(domain);
}

export function readAsiPersistedKind<T>(domain: string, kind: AsiHistoryKind): T[] {
	if (!isAsiPersistEnabled()) return [];
	return readAsiHistoryKind(domain, kind).map((item) => item.payload as T);
}

export function persistAsiHistoryRecords(domain: string, records: readonly AsiHistoryRecord[]) {
	if (!isAsiPersistEnabled() || !records.length) return;
	try {
		writeAsiHistoryRecords(domain, records);
	} catch {
		/* file persist is best-effort */
	}
}

export function persistAsiObservations(domain: string, responses: readonly AIResponse[]) {
	persistAsiHistoryRecords(
		domain,
		responses.map((item) =>
			row(domain, 'observation', item, {
				provider: item.provider,
				query: item.query,
				timestamp: item.timestamp,
			}),
		),
	);
}

export function persistAsiCoreSlice(
	domain: string,
	slice: {
		observations?: readonly AIObservation[];
		evidence?: readonly Evidence[];
		competitors?: readonly CompetitorObservation[];
		opportunities?: readonly Opportunity[];
		actions?: readonly Action[];
		visibility?: AsiVisibilityRecord | null;
		alerts?: readonly Alert[];
	},
) {
	const records: AsiHistoryRecord[] = [];
	for (const item of slice.observations ?? []) {
		records.push(row(domain, 'observation', item, { provider: item.provider, query: item.query, timestamp: item.timestamp }));
	}
	for (const item of slice.evidence ?? []) {
		records.push(row(domain, 'evidence', item, { query: item.url.value, timestamp: item.timestamp }));
	}
	for (const item of slice.competitors ?? []) {
		records.push(row(domain, 'competitor', item, { provider: item.provider, query: item.query }));
	}
	for (const item of slice.opportunities ?? []) {
		records.push(row(domain, 'opportunity', item, { query: item.query }));
	}
	for (const item of slice.actions ?? []) {
		records.push(row(domain, 'action', item, { query: item.id }));
	}
	if (slice.visibility) {
		records.push(row(domain, 'visibility', slice.visibility, { timestamp: slice.visibility.timestamp }));
	}
	for (const item of slice.alerts ?? []) {
		records.push(row(domain, 'alert', item, { query: item.relatedQuery, timestamp: item.createdAt }));
	}
	persistAsiHistoryRecords(domain, records);
}

export function readPersistedVisibilityRecords(domain: string): AsiVisibilityRecord[] {
	return readAsiPersistedKind<AsiVisibilityRecord>(domain, 'visibility').sort((a, b) =>
		a.timestamp.localeCompare(b.timestamp),
	);
}

export function readPersistedResponses(domain: string): AIResponse[] {
	return readAsiPersistedKind<AIResponse>(domain, 'observation').filter(
		(item) => item && typeof item === 'object' && 'provider' in item && 'query' in item && 'answer' in item,
	);
}

export function readPersistedCompetitorObservations(domain: string): CompetitorObservation[] {
	return readAsiPersistedKind<CompetitorObservation>(domain, 'competitor').filter(
		(item) =>
			item &&
			typeof item === 'object' &&
			item.competitor &&
			typeof item.competitor === 'object' &&
			typeof item.competitor.value === 'string',
	);
}
