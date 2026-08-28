import { Clock3, FileText, Info, KeyRound, Settings2, Users } from 'lucide-react';
import {
	MODULE_LABEL,
	RESULT_LABEL,
	type SystemLogModule,
	type SystemLogResult,
} from '@/lib/admin/system-log-management';

const MODULE_STYLE: Record<SystemLogModule, string> = {
	USER_MGMT: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-800',
	CONTENT: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800',
	SYSTEM_CONFIG: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-700',
	AUTH: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
};

const MODULE_ICON: Record<SystemLogModule, typeof Users> = {
	USER_MGMT: Users,
	CONTENT: FileText,
	SYSTEM_CONFIG: Settings2,
	AUTH: KeyRound,
};

const RESULT_STYLE: Record<SystemLogResult, string> = {
	SUCCESS: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
	INFO: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
	PENDING: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
};

const RESULT_DOT: Record<SystemLogResult, string> = {
	SUCCESS: 'bg-emerald-500',
	INFO: 'bg-blue-500',
	PENDING: 'bg-amber-500',
};

const RESULT_ICON: Record<SystemLogResult, typeof Info> = {
	SUCCESS: Info,
	INFO: Info,
	PENDING: Clock3,
};

export function SystemModuleBadge({ module }: { module: SystemLogModule }) {
	const Icon = MODULE_ICON[module];
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${MODULE_STYLE[module]}`}
		>
			<Icon className="h-3 w-3" aria-hidden />
			{MODULE_LABEL[module]}
		</span>
	);
}

export function SystemResultBadge({ result }: { result: SystemLogResult }) {
	const Icon = RESULT_ICON[result];
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${RESULT_STYLE[result]}`}
		>
			<span className={`h-1.5 w-1.5 rounded-full ${RESULT_DOT[result]}`} aria-hidden />
			<Icon className="h-3 w-3" aria-hidden />
			{RESULT_LABEL[result]}
		</span>
	);
}
