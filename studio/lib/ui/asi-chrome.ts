/**
 * AI SEARCH INTELLIGENCE nav chrome — same cyan active language as Insights hub tabs.
 */

export const ASI_PILLAR_IDLE =
	'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/60 dark:hover:border-slate-600 dark:hover:bg-slate-800/50';

export const ASI_PILLAR_ACTIVE =
	'border-cyan-400/70 bg-cyan-50 shadow-sm dark:border-cyan-500/50 dark:bg-slate-800/90';

export const ASI_TOOL_IDLE =
	'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-white';

export const ASI_TOOL_ACTIVE =
	'border-cyan-400/70 bg-cyan-50 text-cyan-800 dark:border-cyan-500/50 dark:bg-slate-800/90 dark:text-cyan-300';

/** Color/border hover stays; duration is dropped when the user prefers reduced motion. */
export const ASI_HOVER_MOTION =
	'transition-colors duration-200 motion-reduce:transition-none motion-reduce:duration-0';

export function asiFocusRing(extra = ''): string {
	return `${ASI_HOVER_MOTION} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 ${extra}`.trim();
}

export const ASI_CARD =
	'rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50';

export const ASI_CARD_HOVER =
	`${ASI_HOVER_MOTION} hover:border-cyan-300/80 dark:hover:border-cyan-700/70`;

export const ASI_EMPTY =
	'rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900/30';

export const ASI_ERROR = 'text-sm font-semibold text-rose-600 dark:text-rose-300';

export const ASI_CTA =
	`inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-cyan-600 px-5 text-sm font-bold text-white ${ASI_HOVER_MOTION} hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-50`;

export const ASI_KICKER =
	'text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-400/80';

export const ASI_SECTION_KICKER =
	'text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-400/80';

export const ASI_BADGE =
	'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold';

export const ASI_CHIP_IDLE =
	`rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-500 ${ASI_HOVER_MOTION} hover:border-slate-300 dark:border-slate-700 dark:text-slate-400`;

export const ASI_CHIP_ACTIVE =
	'rounded-full border border-cyan-400 bg-cyan-50 px-3 py-1 text-[11px] font-bold text-cyan-800 dark:border-cyan-500 dark:bg-slate-800 dark:text-cyan-300';

export const ASI_KPI = `${ASI_CARD} ${ASI_CARD_HOVER} px-4 py-4`;

export const ASI_TABLE_WRAP = 'min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch]';

export const ASI_TOOLTIP = {
	backgroundColor: 'var(--background, #fff)',
	border: '1px solid rgb(226 232 240)',
	borderRadius: 12,
	fontSize: 12,
	padding: '8px 10px',
} as const;
