/**
 * Persist admin inline Desc edits for the solve workspace table.
 * Overrides win over crawled / generated descriptions on remount.
 */

import { looksLikeRawUrlOrPath } from '@/lib/solve/page-meta-hydrate';
import { pageSelectionKey, pageSelectionStorageKey } from '@/lib/solve/page-selection';
import type { SolvePageMeta } from '@/lib/solve/types';

export const PAGE_DESC_STORAGE_PREFIX = 'redue_solve_page_desc:v1:';

export type StoredPageDescriptions = {
	overrides: Record<string, string>;
	savedAt: string;
};

export function pageDescriptionStorageKey(auditId: string, targetUrl: string): string {
	return pageSelectionStorageKey(auditId, targetUrl).replace(
		/^redue_solve_page_selection:v\d+:/,
		PAGE_DESC_STORAGE_PREFIX,
	);
}

export function applyPageDescriptionOverrides(
	pages: SolvePageMeta[],
	overrides: Record<string, string> | null | undefined,
): SolvePageMeta[] {
	if (!overrides || Object.keys(overrides).length === 0) return pages;
	return pages.map((page) => {
		const key = pageSelectionKey(page);
		if (!Object.prototype.hasOwnProperty.call(overrides, key)) return page;
		const next = String(overrides[key] || '').trim();
		if (!next || looksLikeRawUrlOrPath(next)) return page;
		return { ...page, description: next };
	});
}

function canUseStorage(): boolean {
	return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadPageDescriptions(auditId: string, targetUrl: string): StoredPageDescriptions | null {
	if (!canUseStorage()) return null;
	try {
		const raw = window.localStorage.getItem(pageDescriptionStorageKey(auditId, targetUrl));
		if (!raw) return null;
		const data = JSON.parse(raw) as StoredPageDescriptions;
		if (!data || typeof data.overrides !== 'object' || data.overrides == null) return null;
		return data;
	} catch {
		return null;
	}
}

export function savePageDescriptions(
	auditId: string,
	targetUrl: string,
	state: Omit<StoredPageDescriptions, 'savedAt'> & { savedAt?: string },
): void {
	if (!canUseStorage()) return;
	try {
		const body: StoredPageDescriptions = {
			overrides: state.overrides || {},
			savedAt: state.savedAt || new Date().toISOString(),
		};
		window.localStorage.setItem(pageDescriptionStorageKey(auditId, targetUrl), JSON.stringify(body));
	} catch {
		// quota / private mode
	}
}
