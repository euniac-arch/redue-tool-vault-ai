import { applyInsightsLocalResetOnce } from './insights-local-reset';

export const AI_SEARCH_DAILY_LIMIT = 5;
export const AI_SEARCH_USAGE_COUNT_KEY = 'ai_search_usage_count';
export const AI_SEARCH_USAGE_DATE_KEY = 'today_date';

export type InsightsAiUsageSnapshot = {
	used: number;
	remaining: number;
	limit: number;
	date: string;
	unlimited: boolean;
};

/** SSR-safe snapshot — never reads localStorage, so first paint matches the server. */
export function defaultInsightsAiUsage(isProMember = false): InsightsAiUsageSnapshot {
	return {
		used: 0,
		remaining: AI_SEARCH_DAILY_LIMIT,
		limit: AI_SEARCH_DAILY_LIMIT,
		date: '',
		unlimited: isProMember,
	};
}

export function insightsAiUsageDate(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Seoul',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
}

export function resolveAiSearchUsed(storedCount: number, storedDate: string | null, today: string): number {
	if (!storedDate || storedDate !== today) return 0;
	if (!Number.isFinite(storedCount)) return 0;
	return Math.min(AI_SEARCH_DAILY_LIMIT, Math.max(0, Math.floor(storedCount)));
}

function readStorage(): { count: number; date: string | null } {
	if (typeof window === 'undefined') return { count: 0, date: null };
	applyInsightsLocalResetOnce();
	try {
		const raw = window.localStorage.getItem(AI_SEARCH_USAGE_COUNT_KEY);
		return {
			count: Number(raw || 0),
			date: window.localStorage.getItem(AI_SEARCH_USAGE_DATE_KEY),
		};
	} catch {
		return { count: 0, date: null };
	}
}

function writeStorage(count: number, date: string) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(AI_SEARCH_USAGE_COUNT_KEY, String(count));
		window.localStorage.setItem(AI_SEARCH_USAGE_DATE_KEY, date);
	} catch {
		/* ignore quota / private mode */
	}
}

export function readInsightsAiUsage(isProMember = false): InsightsAiUsageSnapshot {
	applyInsightsLocalResetOnce();
	const date = insightsAiUsageDate();
	if (isProMember) {
		return { used: 0, remaining: AI_SEARCH_DAILY_LIMIT, limit: AI_SEARCH_DAILY_LIMIT, date, unlimited: true };
	}
	const stored = readStorage();
	const used = resolveAiSearchUsed(stored.count, stored.date, date);
	if (stored.date !== date) writeStorage(0, date);
	return {
		used,
		remaining: AI_SEARCH_DAILY_LIMIT - used,
		limit: AI_SEARCH_DAILY_LIMIT,
		date,
		unlimited: false,
	};
}

export function consumeInsightsAiUsage(isProMember = false): InsightsAiUsageSnapshot {
	const current = readInsightsAiUsage(isProMember);
	if (current.unlimited) return current;
	if (current.remaining <= 0) return current;
	const used = current.used + 1;
	writeStorage(used, current.date);
	return {
		...current,
		used,
		remaining: AI_SEARCH_DAILY_LIMIT - used,
	};
}
