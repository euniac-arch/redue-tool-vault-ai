/**
 * Insights column scrap / bookmark list.
 * Client-only localStorage — empty on the server so hydration stays stable.
 */

import { applyInsightsLocalResetOnce } from './insights-local-reset';

export const SAVED_NEWS_STORAGE_KEY = 'saved_news_ids';

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

export function readSavedNewsIds(): string[] {
	if (!isBrowser()) return [];
	applyInsightsLocalResetOnce();
	try {
		const raw = window.localStorage.getItem(SAVED_NEWS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((id): id is string => typeof id === 'string' && id.trim() !== '');
	} catch {
		return [];
	}
}

export function writeSavedNewsIds(ids: string[]): string[] {
	if (isBrowser()) {
		try {
			window.localStorage.setItem(SAVED_NEWS_STORAGE_KEY, JSON.stringify(ids));
		} catch {
			/* private mode / quota */
		}
	}
	return ids;
}

export function toggleSavedNewsId(id: string, current = readSavedNewsIds()): string[] {
	const key = id.trim();
	if (!key) return current;
	const next = current.includes(key) ? current.filter((item) => item !== key) : [key, ...current];
	return writeSavedNewsIds(next);
}

export async function copyNewsLink(url: string): Promise<void> {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(url);
		return;
	}
	if (typeof document === 'undefined') {
		throw new Error('clipboard unavailable');
	}
	const area = document.createElement('textarea');
	area.value = url;
	area.setAttribute('readonly', '');
	area.style.position = 'fixed';
	area.style.left = '-9999px';
	document.body.appendChild(area);
	area.select();
	document.execCommand('copy');
	document.body.removeChild(area);
}

export function canUseWebShare(): boolean {
	return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
