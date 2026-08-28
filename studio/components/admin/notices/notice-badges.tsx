import { Archive, Globe, Megaphone, PartyPopper, Pin, ShieldCheck, User, Wrench } from 'lucide-react';
import type { NoticeStatus, NoticeTarget, NoticeType } from '@/lib/admin/notice-management';

const TYPE_STYLE: Record<NoticeType, string> = {
	notice: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-800',
	system: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800',
	event: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800',
};

const TYPE_LABEL: Record<NoticeType, string> = {
	notice: '일반안내',
	system: '시스템점검',
	event: '이벤트',
};

const TYPE_ICON: Record<NoticeType, typeof Megaphone> = {
	notice: Megaphone,
	system: Wrench,
	event: PartyPopper,
};

const TARGET_STYLE: Record<NoticeTarget, string> = {
	all: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:ring-slate-700',
	user: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-800',
	admin: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:ring-purple-800',
};

const TARGET_LABEL: Record<NoticeTarget, string> = {
	all: '전체',
	user: '일반사용자',
	admin: '운영진',
};

const TARGET_ICON: Record<NoticeTarget, typeof Globe> = {
	all: Globe,
	user: User,
	admin: ShieldCheck,
};

const STATUS_STYLE: Record<NoticeStatus, string> = {
	published: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
	draft: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
	archived: 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400',
};

const STATUS_DOT: Record<NoticeStatus, string> = {
	published: 'bg-emerald-500',
	draft: 'bg-amber-500',
	archived: 'bg-slate-400',
};

const STATUS_LABEL: Record<NoticeStatus, string> = {
	published: '게시중',
	draft: '임시저장',
	archived: '보관',
};

export function NoticeTypeBadge({ type }: { type: NoticeType }) {
	const Icon = TYPE_ICON[type];
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${TYPE_STYLE[type]}`}
		>
			<Icon className="h-3 w-3" aria-hidden />
			{TYPE_LABEL[type]}
		</span>
	);
}

export function NoticeTargetBadge({ target }: { target: NoticeTarget }) {
	const Icon = TARGET_ICON[target];
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${TARGET_STYLE[target]}`}
		>
			<Icon className="h-3 w-3" aria-hidden />
			{TARGET_LABEL[target]}
		</span>
	);
}

export function NoticeStatusBadge({ status }: { status: NoticeStatus }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}
		>
			<span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
			{STATUS_LABEL[status]}
		</span>
	);
}

export function NoticePinIcon({ pinned }: { pinned: boolean }) {
	if (!pinned) return null;
	return (
		<span
			className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-800"
			title="상단 고정"
			aria-label="상단 고정된 공지"
		>
			<Pin className="h-3 w-3" aria-hidden />
		</span>
	);
}

export function NoticeArchiveIcon() {
	return <Archive className="h-3.5 w-3.5" aria-hidden />;
}
