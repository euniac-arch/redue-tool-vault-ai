import { KeyRound, Languages, MessageCircle, Sparkles } from 'lucide-react';
import {
	formatLastCalledAt,
	formatQuotaNumber,
	quotaRemainingCount,
	type ApiQuotaServiceName,
	type ApiQuotaUsage,
} from '@/lib/admin/api-quota';
import { ApiQuotaStatusBadge } from './ApiQuotaStatusBadge';

const SERVICE_ICON: Record<ApiQuotaServiceName, typeof KeyRound> = {
	'Google OAuth': KeyRound,
	'Kakao Login': MessageCircle,
	'Gemini API': Sparkles,
	'Translation API': Languages,
};

const SERVICE_ICON_STYLE: Record<ApiQuotaServiceName, string> = {
	'Google OAuth': 'bg-blue-50 text-blue-600 ring-blue-200',
	'Kakao Login': 'bg-yellow-50 text-yellow-700 ring-yellow-200',
	'Gemini API': 'bg-violet-50 text-violet-600 ring-violet-200',
	'Translation API': 'bg-teal-50 text-teal-700 ring-teal-200',
};

const BAR_TONE: Record<ApiQuotaUsage['status'], string> = {
	normal: 'bg-emerald-500',
	warning: 'bg-amber-500',
	critical: 'bg-rose-500',
};

function QuotaMeter({
	label,
	usage,
	limit,
	tone,
}: {
	label: string;
	usage: number;
	limit: number;
	tone: string;
}) {
	const pct = limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;
	const remaining = quotaRemainingCount(usage, limit);
	return (
		<div>
			<div className="flex items-baseline justify-between gap-2">
				<p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
				<p className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">{pct.toFixed(1)}%</p>
			</div>
			<div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
				<div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
			</div>
			<p className="mt-1 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
				{formatQuotaNumber(usage)} / {formatQuotaNumber(limit)}
				<span className="text-slate-400 dark:text-slate-500"> · 잔여 {formatQuotaNumber(remaining)}</span>
			</p>
		</div>
	);
}

export function ApiQuotaCard({ quota }: { quota: ApiQuotaUsage }) {
	const Icon = SERVICE_ICON[quota.serviceName];
	const tone = BAR_TONE[quota.status];

	return (
		<article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:bg-slate-800 dark:border-slate-700">
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2.5">
					<span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${SERVICE_ICON_STYLE[quota.serviceName]}`}>
						<Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
					</span>
					<div>
						<p className="text-sm font-bold text-slate-900 dark:text-slate-100">{quota.serviceName}</p>
						<p className="text-[11px] text-slate-400 dark:text-slate-500">최근 호출 {formatLastCalledAt(quota.lastCalledAt)}</p>
					</div>
				</div>
				<ApiQuotaStatusBadge status={quota.status} />
			</div>

			<div className="mt-4 flex flex-col gap-3">
				<QuotaMeter label="일일 쿼터" usage={quota.dailyUsage} limit={quota.dailyLimit} tone={tone} />
				<QuotaMeter label="월간 쿼터" usage={quota.monthlyUsage} limit={quota.monthlyLimit} tone={tone} />
			</div>
		</article>
	);
}
