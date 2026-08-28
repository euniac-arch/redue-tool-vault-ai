import { ISSUE_SEVERITY_LABEL, type LiveIssueSeverity } from '@/lib/admin/liveDiagnosticService';

const SEVERITY_STYLE: Record<LiveIssueSeverity, string> = {
	critical: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
	warning: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	good: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
};

const SEVERITY_DOT: Record<LiveIssueSeverity, string> = {
	critical: 'bg-rose-500',
	warning: 'bg-amber-500',
	good: 'bg-emerald-500',
};

export function LiveSeverityBadge({ severity }: { severity: LiveIssueSeverity }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${SEVERITY_STYLE[severity]}`}
		>
			<span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT[severity]}`} aria-hidden />
			{ISSUE_SEVERITY_LABEL[severity]}
		</span>
	);
}

export function scoreToneClass(score: number): string {
	if (score >= 80) return 'text-emerald-600 dark:text-emerald-300';
	if (score >= 50) return 'text-amber-600 dark:text-amber-300';
	return 'text-rose-600 dark:text-rose-300';
}

export function scoreBarClass(score: number): string {
	if (score >= 80) return 'bg-emerald-500';
	if (score >= 50) return 'bg-amber-500';
	return 'bg-rose-500';
}

export function scoreRingClass(score: number): string {
	if (score >= 80) return 'text-emerald-500';
	if (score >= 50) return 'text-amber-500';
	return 'text-rose-500';
}
