/**
 * Insights column tab/filter chrome.
 * Light mode uses soft cyan fills; dark mode keeps the cyan glow on mode tabs.
 */

const BASE =
	'inline-flex items-center justify-center border text-xs font-bold outline-none transition-colors';

export const INSIGHTS_FILTER_IDLE_CLASS =
	'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200';

/** Feed / AI mode tabs — soft cyan in light mode, glow in dark mode. */
export const INSIGHTS_MODE_ACTIVE_CLASS =
	'border-cyan-300 bg-cyan-50 text-cyan-700 shadow-sm dark:border-cyan-400/50 dark:bg-cyan-950/40 dark:text-cyan-200 dark:shadow-[0_0_16px_rgba(6,182,212,0.18)]';

/** Region, page size, pagination — soft fill in light mode, outline in dark mode. */
export const INSIGHTS_FILTER_ACTIVE_CLASS =
	'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-none dark:border-cyan-500 dark:bg-transparent dark:text-cyan-300';

export function insightsModeTabClass(active: boolean, extra = ''): string {
	return `${BASE} ${active ? INSIGHTS_MODE_ACTIVE_CLASS : INSIGHTS_FILTER_IDLE_CLASS} ${extra}`.trim();
}

export function insightsFilterClass(active: boolean, extra = ''): string {
	return `${BASE} ${active ? INSIGHTS_FILTER_ACTIVE_CLASS : INSIGHTS_FILTER_IDLE_CLASS} ${extra}`.trim();
}
