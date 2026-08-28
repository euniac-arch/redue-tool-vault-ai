/**
 * Solve workspace page picker — smart-default noise filter + local persistence.
 * Selected rows are the only pages fed into $page_meta / schema mapping / remote patch.
 */

import { isCitationVirtualPage, isFaqGuidePage, isHowToGuidePage } from '@/lib/solve/core/eeat-citation';
import { isGarbagePageFile } from '@/lib/solve/dynamic-php-schema';
import { isRootDeployPage } from '@/lib/solve/geo-root-assets';
import type { SolvePageMeta } from '@/lib/solve/types';

export const PAGE_SELECTION_STORAGE_PREFIX = 'redue_solve_page_selection:v4:';

/** Title / GNB / URL tokens that are crawler debris, not service pages. */
const NOISE_LABEL_RE =
	/오류안내|오류\s*안내|에러\s*페이지|에러페이지|페이지를\s*찾을\s*수\s*없|not\s*found|\bdefer\b|\bh1\b|\b404\b/i;

const NOISE_PATH_RE = /(^|\/)(404(?:\.php|\.html?)?|error(?:\.php|\.html?)?)(\?|$)/i;

export type StoredPageSelection = {
	selectedKeys: string[];
	knownKeys: string[];
	savedAt: string;
};

export function pageSelectionKey(page: Pick<SolvePageMeta, 'urlPath'>): string {
	const raw = String(page.urlPath || '').trim();
	return raw || '/';
}

function titleGnbHaystack(page: SolvePageMeta): string {
	return [page.title, page.section, page.menu1, page.menu2, page.urlPath]
		.filter((v) => typeof v === 'string' && v.trim() !== '')
		.join(' ');
}

/**
 * True when a collected row is an error / diagnostic artifact and should start unchecked.
 * Does not look at the H1 *column* (every real page has an H1) — only Title / GNB / URL.
 */
export function isNoiseSchemaPage(page: SolvePageMeta): boolean {
	if (isRootDeployPage(page)) return false;
	const path = String(page.urlPath || '').trim();
	if (path && path !== '/' && isGarbagePageFile(path)) return true;
	if (NOISE_PATH_RE.test(path)) return true;
	if (NOISE_LABEL_RE.test(titleGnbHaystack(page))) return true;
	const h1 = String(page.h1 || '').trim();
	if (h1 && NOISE_LABEL_RE.test(h1) && !page.title && !page.section) return true;
	return false;
}

export function defaultPageSelected(page: SolvePageMeta): boolean {
	if (isRootDeployPage(page)) return true;
	if (isCitationVirtualPage(page) || isFaqGuidePage(page) || isHowToGuidePage(page)) return true;
	if (page.fromGnb) return !isNoiseSchemaPage(page);
	const path = String(page.urlPath || '').trim();
	if (path === '/' || path === '') return true;
	return !isNoiseSchemaPage(page);
}

export function pageSelectionStorageKey(auditId: string, targetUrl: string): string {
	let host = String(targetUrl || '').trim();
	try {
		host = new URL(targetUrl).hostname.replace(/^www\./i, '');
	} catch {
		/* keep raw */
	}
	return `${PAGE_SELECTION_STORAGE_PREFIX}${auditId || 'unknown'}:${host || 'site'}`;
}

export function resolvePageSelection(
	pages: SolvePageMeta[],
	stored: StoredPageSelection | null,
): Set<string> {
	const known = new Set(stored?.knownKeys || []);
	const selectedStored = new Set(stored?.selectedKeys || []);
	const next = new Set<string>();
	for (const page of pages) {
		const key = pageSelectionKey(page);
		if (known.has(key)) {
			if (selectedStored.has(key)) next.add(key);
			continue;
		}
		if (defaultPageSelected(page)) next.add(key);
	}
	return next;
}

export function filterSelectedPages(
	pages: SolvePageMeta[],
	selectedKeys: Iterable<string>,
): SolvePageMeta[] {
	const selected = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys);
	return pages.filter((page) => selected.has(pageSelectionKey(page)));
}

function canUseStorage(): boolean {
	return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadPageSelection(auditId: string, targetUrl: string): StoredPageSelection | null {
	if (!canUseStorage()) return null;
	try {
		const raw = window.localStorage.getItem(pageSelectionStorageKey(auditId, targetUrl));
		if (!raw) return null;
		const data = JSON.parse(raw) as StoredPageSelection;
		if (!Array.isArray(data?.selectedKeys) || !Array.isArray(data?.knownKeys)) return null;
		return data;
	} catch {
		return null;
	}
}

export function savePageSelection(
	auditId: string,
	targetUrl: string,
	state: Omit<StoredPageSelection, 'savedAt'> & { savedAt?: string },
): void {
	if (!canUseStorage()) return;
	try {
		const body: StoredPageSelection = {
			selectedKeys: state.selectedKeys,
			knownKeys: state.knownKeys,
			savedAt: state.savedAt || new Date().toISOString(),
		};
		window.localStorage.setItem(pageSelectionStorageKey(auditId, targetUrl), JSON.stringify(body));
	} catch {
		// quota / private mode
	}
}
