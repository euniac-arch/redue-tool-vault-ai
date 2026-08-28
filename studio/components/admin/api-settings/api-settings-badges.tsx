import { AlertTriangle, CheckCircle2, MinusCircle } from 'lucide-react';
import type { ConnectionStatus } from '@/lib/admin/apiConfigService';

const STATUS_STYLE: Record<ConnectionStatus, string> = {
	connected:
		'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
	unset: 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-400 dark:ring-slate-600',
	error: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
};

const STATUS_DOT: Record<ConnectionStatus, string> = {
	connected: 'bg-emerald-500',
	unset: 'bg-slate-400 dark:bg-slate-500',
	error: 'bg-rose-500',
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
	connected: '정상',
	unset: '미설정',
	error: '오류',
};

const STATUS_ICON: Record<ConnectionStatus, typeof CheckCircle2> = {
	connected: CheckCircle2,
	unset: MinusCircle,
	error: AlertTriangle,
};

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
	const Icon = STATUS_ICON[status];
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${STATUS_STYLE[status]}`}
		>
			<span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
			<Icon className="h-3 w-3" aria-hidden />
			{STATUS_LABEL[status]}
		</span>
	);
}

export function ConnectionStatusDot({ status }: { status: ConnectionStatus }) {
	return <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} aria-hidden />;
}

export { STATUS_LABEL };
