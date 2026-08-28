import { CATEGORY_LABEL, STATUS_LABEL, scoreToStatus, type DiagnosticCategory, type DiagnosticStatus } from '@/lib/admin/diagnostic-management';

const CATEGORY_STYLE: Record<DiagnosticCategory, string> = {
	Medical: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
	Pet: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	Commerce: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800',
	Corporate: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-600',
};

const STATUS_STYLE: Record<DiagnosticStatus, string> = {
	critical: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
	warning: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	good: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
};

const STATUS_DOT: Record<DiagnosticStatus, string> = {
	critical: 'bg-rose-500',
	warning: 'bg-amber-500',
	good: 'bg-emerald-500',
};

const BAR_STYLE: Record<DiagnosticStatus, string> = {
	critical: 'bg-rose-500',
	warning: 'bg-amber-500',
	good: 'bg-emerald-500',
};

export function DiagnosticCategoryBadge({ category }: { category: DiagnosticCategory }) {
	return (
		<span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${CATEGORY_STYLE[category]}`}>
			{CATEGORY_LABEL[category]}
		</span>
	);
}

export function DiagnosticStatusBadge({ status }: { status: DiagnosticStatus }) {
	return (
		<span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${STATUS_STYLE[status]}`}>
			<span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
			{STATUS_LABEL[status]}
		</span>
	);
}

export function DiagnosticScoreBadge({ score }: { score: number }) {
	const status = scoreToStatus(score);
	return (
		<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 ${STATUS_STYLE[status]}`}>
			{score}점 · {STATUS_LABEL[status]}
		</span>
	);
}

export function DiagnosticScoreBar({ score, label }: { score: number; label?: string }) {
	const status = scoreToStatus(score);
	return (
		<div className="min-w-0">
			{label ? (
				<div className="mb-1 flex items-center justify-between gap-2">
					<span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
					<span className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{score}</span>
				</div>
			) : null}
			<div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
				<div className={`h-full rounded-full transition-[width] duration-500 ${BAR_STYLE[status]}`} style={{ width: `${score}%` }} />
			</div>
		</div>
	);
}
