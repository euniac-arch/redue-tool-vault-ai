import { Lock } from 'lucide-react';

/** Top-right lock chip for floating export actions. Omit when signed in. */
export function MemberLockBadge() {
	return (
		<span
			aria-hidden
			className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-slate-700 text-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-amber-400"
		>
			<Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
		</span>
	);
}

/** Fixed 14px slot so lock/unlock does not shift in-report CTA width (CLS). */
export function MiniLockSlot({ locked }: { locked: boolean }) {
	return (
		<span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
			{locked ? <Lock className="h-3.5 w-3.5" strokeWidth={2.25} /> : null}
		</span>
	);
}

export const FLOATING_LOCKED_CLASS =
	'overflow-visible border border-slate-200 bg-white/80 text-slate-500 transition-opacity hover:bg-slate-50 hover:opacity-90 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-800';

export const IN_REPORT_PDF_UNLOCKED_CLASS =
	'inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-950/30 transition hover:from-cyan-400 hover:to-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-[#0E1140] sm:w-auto';

export const IN_REPORT_PDF_LOCKED_CLASS =
	`inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-50 dark:focus-visible:ring-slate-600 dark:focus-visible:ring-offset-[#0E1140] sm:w-auto ${FLOATING_LOCKED_CLASS}`;
