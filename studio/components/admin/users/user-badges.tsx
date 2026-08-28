import { Mail, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import type { AuthProvider, MemberRole, MemberStatus, MembershipPlan } from '@/lib/admin/user-management';
import { scoreTone } from '@/lib/admin/user-management';

const PROVIDER_STYLE: Record<AuthProvider, string> = {
	email: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800',
	kakao: 'bg-yellow-50 text-yellow-800 ring-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:ring-yellow-800',
	google: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
	naver: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-950/50 dark:text-green-300 dark:ring-green-800',
};

const PROVIDER_LABEL: Record<AuthProvider, string> = {
	email: 'EMAIL',
	kakao: 'KAKAO',
	google: 'GOOGLE',
	naver: 'NAVER',
};

const PROVIDER_ICON: Record<AuthProvider, typeof Mail> = {
	email: Mail,
	kakao: MessageCircle,
	google: Sparkles,
	naver: Sparkles,
};

const PLAN_STYLE: Record<MembershipPlan, string> = {
	Free: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-700',
	Pro: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800',
	Enterprise: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
};

const SCORE_STYLE = {
	empty: 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-400 dark:ring-slate-700',
	low: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800',
	mid: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	high: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800',
} as const;

const STATUS_STYLE: Record<MemberStatus, string> = {
	active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
	suspended: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
	withdrawn: 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400',
};

const STATUS_DOT: Record<MemberStatus, string> = {
	active: 'bg-emerald-500',
	suspended: 'bg-rose-500',
	withdrawn: 'bg-slate-400',
};

const STATUS_LABEL: Record<MemberStatus, string> = {
	active: 'Active',
	suspended: 'Suspended',
	withdrawn: 'Withdrawn',
};

const ROLE_STYLE: Record<MemberRole, string> = {
	user: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-700',
	admin: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:ring-purple-800',
};

const ROLE_LABEL: Record<MemberRole, string> = {
	user: '회원',
	admin: '관리자',
};

export function UserProviderBadge({ provider }: { provider: AuthProvider }) {
	const Icon = PROVIDER_ICON[provider];
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${PROVIDER_STYLE[provider]}`}
		>
			<Icon className="h-3 w-3" aria-hidden />
			{PROVIDER_LABEL[provider]}
		</span>
	);
}

export function UserPlanBadge({ plan }: { plan: MembershipPlan }) {
	return (
		<span
			className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${PLAN_STYLE[plan]}`}
		>
			{plan}
		</span>
	);
}

export function UserRoleBadge({ role }: { role: MemberRole }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${ROLE_STYLE[role]}`}
		>
			{role === 'admin' && <ShieldCheck className="h-3 w-3" aria-hidden />}
			{ROLE_LABEL[role]}
		</span>
	);
}

/** Dot-style status indicator (compact, used inline next to other text). */
export function UserStatusDot({ status }: { status: MemberStatus }) {
	return (
		<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
			<span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
			{STATUS_LABEL[status]}
		</span>
	);
}

/** Pill-style status badge (active/suspended/withdrawn) for table cells & modals. */
export function UserStatusBadge({ status }: { status: MemberStatus }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}
		>
			<span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
			{STATUS_LABEL[status]}
		</span>
	);
}

export function UserScoreBadge({ score }: { score: number | null }) {
	const tone = scoreTone(score);
	return (
		<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${SCORE_STYLE[tone]}`}>
			{score == null ? '-' : `${score}점`}
		</span>
	);
}
