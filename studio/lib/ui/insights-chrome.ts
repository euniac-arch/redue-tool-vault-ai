/**
 * Insights column tab/filter chrome.
 * Mode tabs keep the cyan glow; filters and pagination stay flat.
 */

const BASE =
	'inline-flex items-center justify-center border text-xs font-bold outline-none transition-colors';

export const INSIGHTS_FILTER_IDLE_CLASS =
	'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200';

/** Feed / AI mode tabs — glow is intentional. */
export const INSIGHTS_MODE_ACTIVE_CLASS =
	'border-cyan-400/50 bg-cyan-950/40 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.18)]';

/** Region, page size, pagination — outline only, no fill or glow. */
export const INSIGHTS_FILTER_ACTIVE_CLASS =
	'border-cyan-400 bg-transparent text-cyan-400 shadow-none dark:border-cyan-500 dark:bg-transparent dark:text-cyan-300';

export function insightsModeTabClass(active: boolean, extra = ''): string {
	return `${BASE} ${active ? INSIGHTS_MODE_ACTIVE_CLASS : INSIGHTS_FILTER_IDLE_CLASS} ${extra}`.trim();
}

export function insightsFilterClass(active: boolean, extra = ''): string {
	return `${BASE} ${active ? INSIGHTS_FILTER_ACTIVE_CLASS : INSIGHTS_FILTER_IDLE_CLASS} ${extra}`.trim();
}
