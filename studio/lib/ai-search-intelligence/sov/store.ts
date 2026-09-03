import { classifyAsiSovQuery } from '@/lib/ai-search-intelligence/sov/classify';
import { extractAsiSovObservations } from '@/lib/ai-search-intelligence/sov/extract';
import type { AIResponse, AsiSovObservation } from '@/lib/ai-search-intelligence/types';

const STORE = new Map<string, AsiSovObservation[]>();
const RECENT_MS = 24 * 60 * 60 * 1000;

function keyFor(domain: string): string {
	return domain.trim().toLowerCase();
}

function observationKey(row: AsiSovObservation): string {
	return `${row.provider}::${row.query.trim().toLowerCase()}`;
}

export function readAsiSovStore(domain: string): AsiSovObservation[] {
	return [...(STORE.get(keyFor(domain)) ?? [])];
}

export function clearAsiSovStore(domain?: string) {
	if (!domain) {
		STORE.clear();
		return;
	}
	STORE.delete(keyFor(domain));
}

export function hasRecentAsiSovQuery(domain: string, query: string, now = Date.now()): boolean {
	const needle = query.trim().toLowerCase();
	return readAsiSovStore(domain).some((row) => {
		if (row.query.trim().toLowerCase() !== needle) return false;
		if (row.source !== 'live') return false;
		const ts = Date.parse(row.timestamp);
		return Number.isFinite(ts) && now - ts <= RECENT_MS;
	});
}

export function appendAsiSovStore(
	domain: string,
	responses: readonly AIResponse[],
	input: { brand: string; aliases?: readonly string[] },
): AsiSovObservation[] {
	const next = extractAsiSovObservations(responses, {
		brand: input.brand,
		aliases: input.aliases,
	}).map((row) => ({
		...row,
		category: classifyAsiSovQuery(row.query),
	}));
	if (!next.length) return readAsiSovStore(domain);
	const current = readAsiSovStore(domain);
	const byKey = new Map(current.map((row) => [observationKey(row), row]));
	for (const row of next) {
		byKey.set(observationKey(row), row);
	}
	const merged = [...byKey.values()];
	STORE.set(keyFor(domain), merged);
	return merged;
}
