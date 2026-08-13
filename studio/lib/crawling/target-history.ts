import type { DiscoveredTarget } from '@/lib/crawling/target-discovery';
import { extractRootDomain } from '@/lib/crawling/domain';
import { urlKey } from '@/lib/crawling/transfer-queue';

/** Persisted discovery results on the crawling setup page */
export const CRAWL_TARGET_HISTORY_KEY = 'admin.crawling.targetHistory';

export type TargetPageSize = 10 | 20 | 50 | 100;

export const TARGET_PAGE_SIZE_OPTIONS: TargetPageSize[] = [10, 20, 50, 100];

export function loadTargetHistory(): DiscoveredTarget[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(CRAWL_TARGET_HISTORY_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as DiscoveredTarget[];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(item) =>
				item &&
				typeof item === 'object' &&
				typeof item.id === 'string' &&
				typeof item.url === 'string' &&
				typeof item.siteName === 'string',
		);
	} catch {
		return [];
	}
}

export function saveTargetHistory(targets: DiscoveredTarget[]) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(CRAWL_TARGET_HISTORY_KEY, JSON.stringify(targets));
	} catch {
		/* ignore quota */
	}
}

export function clearTargetHistory() {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.removeItem(CRAWL_TARGET_HISTORY_KEY);
	} catch {
		/* ignore */
	}
}

function historyDedupeKey(url: string): string {
	return extractRootDomain(url) || urlKey(url);
}

/**
 * Prepend newly discovered targets, dropping rows whose root domain already exists.
 * Newest batch stays at the top.
 */
export function mergeTargetHistory(
	existing: DiscoveredTarget[],
	incoming: DiscoveredTarget[],
): { merged: DiscoveredTarget[]; added: DiscoveredTarget[]; skipped: number } {
	const existingKeys = new Set(existing.map((item) => historyDedupeKey(item.url)));
	const added: DiscoveredTarget[] = [];
	for (const item of incoming) {
		const key = historyDedupeKey(item.url);
		if (existingKeys.has(key)) continue;
		existingKeys.add(key);
		added.push(item);
	}
	return {
		merged: [...added, ...existing],
		added,
		skipped: incoming.length - added.length,
	};
}
