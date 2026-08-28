import { KeyRound, LogIn, LogOut, ShieldX } from 'lucide-react';
import { ACTION_LABEL, isSuccessfulLog, type LogAction, type LogSeverity } from '@/lib/admin/security-log-management';

const SEVERITY_STYLE: Record<LogSeverity, string> = {
	info: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
	warning: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	critical: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
};

const SEVERITY_LABEL: Record<LogSeverity, string> = {
	info: '정상',
	warning: '주의',
	critical: '위험',
};

const SEVERITY_DOT: Record<LogSeverity, string> = {
	info: 'bg-emerald-500',
	warning: 'bg-amber-500',
	critical: 'bg-rose-500',
};

const ACTION_ICON: Record<LogAction, typeof LogIn> = {
	LOGIN_SUCCESS: LogIn,
	LOGIN_FAILED: LogOut,
	PASSWORD_RESET: KeyRound,
	ADMIN_ACCESS_DENIED: ShieldX,
};

const ACTION_STYLE: Record<LogAction, string> = {
	LOGIN_SUCCESS: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-700',
	LOGIN_FAILED: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
	PASSWORD_RESET: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800',
	ADMIN_ACCESS_DENIED: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
};

export function SeverityBadge({ severity }: { severity: LogSeverity }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${SEVERITY_STYLE[severity]}`}
		>
			<span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT[severity]}`} aria-hidden />
			{SEVERITY_LABEL[severity]}
		</span>
	);
}

export function LogActionBadge({ action }: { action: LogAction }) {
	const Icon = ACTION_ICON[action];
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${ACTION_STYLE[action]}`}
		>
			<Icon className="h-3 w-3" aria-hidden />
			{ACTION_LABEL[action]}
		</span>
	);
}

/** Coarse success/failure pill: success (emerald) vs failure/critical (rose). */
export function LogOutcomeBadge({ severity }: { severity: LogSeverity }) {
	const success = isSuccessfulLog({ severity });
	return (
		<span
			className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
				success
					? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
					: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
			}`}
		>
			{success ? '성공' : '실패'}
		</span>
	);
}
