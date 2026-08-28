/**
 * Client-side personalization for the Prompt Hub.
 * Prompts themselves stay public. Favorites / recent use localStorage only —
 * ready to sync to an account later without a new auth system.
 */

export type PromptCollectionState = {
	favorites: string[];
	recent: string[];
};

export const PROMPT_COLLECTION_STORAGE_KEY = 'redue.prompt-hub.collection.v1';

const MAX_RECENT = 12;

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

export function emptyPromptCollection(): PromptCollectionState {
	return { favorites: [], recent: [] };
}

export function readPromptCollection(): PromptCollectionState {
	if (!isBrowser()) return emptyPromptCollection();
	try {
		const raw = window.localStorage.getItem(PROMPT_COLLECTION_STORAGE_KEY);
		if (!raw) return emptyPromptCollection();
		const parsed = JSON.parse(raw) as Partial<PromptCollectionState>;
		return {
			favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter((item) => typeof item === 'string') : [],
			recent: Array.isArray(parsed.recent) ? parsed.recent.filter((item) => typeof item === 'string') : [],
		};
	} catch {
		return emptyPromptCollection();
	}
}

function writePromptCollection(state: PromptCollectionState): PromptCollectionState {
	if (isBrowser()) {
		try {
			window.localStorage.setItem(PROMPT_COLLECTION_STORAGE_KEY, JSON.stringify(state));
		} catch {
			/* private mode / blocked storage */
		}
	}
	return state;
}

export function togglePromptFavorite(slug: string, current = readPromptCollection()): PromptCollectionState {
	const has = current.favorites.includes(slug);
	const favorites = has ? current.favorites.filter((item) => item !== slug) : [slug, ...current.favorites];
	return writePromptCollection({ ...current, favorites });
}

export function recordPromptRecent(slug: string, current = readPromptCollection()): PromptCollectionState {
	const recent = [slug, ...current.recent.filter((item) => item !== slug)].slice(0, MAX_RECENT);
	return writePromptCollection({ ...current, recent });
}
