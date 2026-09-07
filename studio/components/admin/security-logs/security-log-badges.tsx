import {
	EVENT_TYPE_LABEL,
	STATUS_LABEL,
	type SecurityEventType,
	type SecurityLogStatus,
} from '@/lib/admin/security-log-management';
import { Gauge, KeyRound, LogIn, LogOut, ShieldCheck, ShieldX } from 'lucide-react';

const STATUS_STYLE: Record<SecurityLogStatus, string> = {
	SUCCESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
	WARNING: 'bg-amber-50 text-amber-800 ring-amber-200',
	FAIL: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const STATUS_DOT: Record<SecurityLogStatus, string> = {
	SUCCESS: 'bg-emerald-500',
	WARNING: 'bg-amber-500',
	FAIL: 'bg-rose-500',
};

const EVENT_ICON: Record<SecurityEventType, typeof LogIn> = {
	LOGIN_SUCCESS: LogIn,
	LOGIN_FAIL: LogOut,
	LOGOUT: LogOut,
	ADMIN_ACCESS: ShieldCheck,
	ADMIN_ACCESS_DENIED: ShieldX,
	API_QUOTA_EXCEEDED: Gauge,
	PASSWORD_RESET: KeyRound,
};

const EVENT_STYLE: Record<SecurityEventType, string> = {
	LOGIN_SUCCESS: 'bg-slate-100 text-slate-700 ring-slate-200',
	LOGIN_FAIL: 'bg-rose-50 text-rose-700 ring-rose-200',
	LOGOUT: 'bg-slate-100 text-slate-600 ring-slate-200',
	ADMIN_ACCESS: 'bg-sky-50 text-sky-700 ring-sky-200',
	ADMIN_ACCESS_DENIED: 'bg-rose-50 text-rose-700 ring-rose-200',
	API_QUOTA_EXCEEDED: 'bg-amber-50 text-amber-800 ring-amber-200',
	PASSWORD_RESET: 'bg-blue-50 text-blue-700 ring-blue-200',
};

export function LogStatusBadge({ status }: { status: SecurityLogStatus }) {
	return (
		<span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${STATUS_STYLE[status]}`}>
			<span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
			{STATUS_LABEL[status]}
		</span>
	);
}

export function LogEventBadge({ eventType }: { eventType: SecurityEventType }) {
	const Icon = EVENT_ICON[eventType];
	return (
		<span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${EVENT_STYLE[eventType]}`}>
			<Icon className="h-3 w-3" aria-hidden />
			{EVENT_TYPE_LABEL[eventType]}
		</span>
	);
}
