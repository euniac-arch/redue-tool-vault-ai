/**
 * One-time + manual reset for Insights local bookmarks and AI research quota.
 * Client-only. Safe to call during first render so dummy test data is gone
 * before the dashboard hydrates saved news / remaining count.
 *
 * Do not import from `insights-ai-usage` — that module calls this reset on read.
 */

export const INSIGHTS_LOCAL_RESET_VERSION = 'quota-5-2026-08-29';
export const INSIGHTS_LOCAL_RESET_FLAG_KEY = 'insights_local_reset_version';
export const INSIGHTS_LOCAL_RESET_EVENT = 'insights-local-reset';

/** Bookmark / saved-news keys — current + legacy aliases from earlier drafts. */
export const INSIGHTS_BOOKMARK_STORAGE_KEYS = [
	'saved_news_ids',
	'bookmarked_news',
	'redue_scrapped_news',
	'redue_scrapped_videos',
	'redue_saved_items',
] as const;

export const INSIGHTS_SNAPSHOT_STORAGE_KEYS = [
	'redue_last_ai_research',
	'redue_last_youtube_search',
	'redue_youtube_summary_cache',
	'redue_youtube_videos_cache',
] as const;

/** Daily AI research usage keys — current + legacy aliases. */
export const INSIGHTS_USAGE_STORAGE_KEYS = [
	'ai_search_usage_count',
	'today_date',
	'ai_usage_date',
] as const;

export type InsightsLocalResetResult = {
	applied: boolean;
	bookmarkKeys: string[];
	usageKeys: string[];
};

export function shouldApplyInsightsLocalReset(
	storedVersion: string | null,
	version = INSIGHTS_LOCAL_RESET_VERSION,
): boolean {
	return storedVersion !== version;
}

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

function safeGetItem(key: string): string | null {
	if (!isBrowser()) return null;
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeSetItem(key: string, value: string) {
	if (!isBrowser()) return;
	try {
		window.localStorage.setItem(key, value);
	} catch {
		/* private mode / quota */
	}
}

function safeRemoveItem(key: string) {
	if (!isBrowser()) return;
	try {
		window.localStorage.removeItem(key);
	} catch {
		/* private mode / quota */
	}
}

function notifyInsightsLocalReset() {
	if (!isBrowser()) return;
	try {
		window.dispatchEvent(new CustomEvent(INSIGHTS_LOCAL_RESET_EVENT));
	} catch {
		/* ignore */
	}
}

/** Force-clear bookmarks to `[]` and drop AI usage keys so the full daily quota is available. */
export function resetInsightsLocalData(): InsightsLocalResetResult {
	for (const key of INSIGHTS_BOOKMARK_STORAGE_KEYS) {
		safeSetItem(key, '[]');
	}
	for (const key of INSIGHTS_USAGE_STORAGE_KEYS) {
		safeRemoveItem(key);
	}
	for (const key of INSIGHTS_SNAPSHOT_STORAGE_KEYS) {
		safeRemoveItem(key);
	}
	notifyInsightsLocalReset();
	return {
		applied: true,
		bookmarkKeys: [...INSIGHTS_BOOKMARK_STORAGE_KEYS],
		usageKeys: [...INSIGHTS_USAGE_STORAGE_KEYS],
	};
}

/** Run once per browser after a reset version bump (e.g. 3회 → 5회). */
export function applyInsightsLocalResetOnce(): InsightsLocalResetResult {
	if (!isBrowser()) {
		return { applied: false, bookmarkKeys: [], usageKeys: [] };
	}
	const stored = safeGetItem(INSIGHTS_LOCAL_RESET_FLAG_KEY);
	if (!shouldApplyInsightsLocalReset(stored)) {
		return { applied: false, bookmarkKeys: [], usageKeys: [] };
	}
	const result = resetInsightsLocalData();
	safeSetItem(INSIGHTS_LOCAL_RESET_FLAG_KEY, INSIGHTS_LOCAL_RESET_VERSION);
	return result;
}

export function installInsightsResetConsoleUtil() {
	if (!isBrowser()) return;
	window.resetInsightsLocalData = () => {
		const result = resetInsightsLocalData();
		console.info('[insights] 북마크·AI 사용량 초기화 완료. 오늘 잔여 횟수가 전체로 복구됩니다.', result);
		return result;
	};
}

declare global {
	interface Window {
		resetInsightsLocalData?: () => InsightsLocalResetResult;
	}
}
