/**
 * Recent AI research keywords. Client-only localStorage — empty on the server
 * so the first render matches and hydration stays stable.
 */

export const AI_RECENT_SEARCHES_KEY = 'redue_ai_recent_searches';
export const AI_RECENT_SEARCHES_LIMIT = 6;

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

export function normalizeRecentSearchQuery(query: string): string {
	return query.replace(/\s+/g, ' ').trim();
}

export function prependRecentSearch(
	prev: string[],
	query: string,
	limit = AI_RECENT_SEARCHES_LIMIT,
): string[] {
	const next = normalizeRecentSearchQuery(query);
	if (!next) return prev.slice(0, limit);
	return [next, ...prev.filter((item) => item !== next)].slice(0, limit);
}

export function readRecentSearches(): string[] {
	if (!isBrowser()) return [];
	try {
		const raw = window.localStorage.getItem(AI_RECENT_SEARCHES_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		const seen = new Set<string>();
		const queries: string[] = [];
		for (const item of parsed) {
			if (typeof item !== 'string') continue;
			const query = normalizeRecentSearchQuery(item);
			if (!query || seen.has(query)) continue;
			seen.add(query);
			queries.push(query);
			if (queries.length >= AI_RECENT_SEARCHES_LIMIT) break;
		}
		return queries;
	} catch {
		return [];
	}
}

export function writeRecentSearches(queries: string[]): string[] {
	const next = queries
		.map(normalizeRecentSearchQuery)
		.filter((query, index, list) => query.length > 0 && list.indexOf(query) === index)
		.slice(0, AI_RECENT_SEARCHES_LIMIT);
	if (isBrowser()) {
		try {
			window.localStorage.setItem(AI_RECENT_SEARCHES_KEY, JSON.stringify(next));
		} catch {
			/* private mode / quota */
		}
	}
	return next;
}
