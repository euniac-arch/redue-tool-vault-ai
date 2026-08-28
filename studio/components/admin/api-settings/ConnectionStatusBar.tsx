import { Flame, KeyRound, MessageCircle, Sparkles } from 'lucide-react';
import { CONNECTION_META, type ApiConfigStatuses, type ConnectionTarget } from '@/lib/admin/apiConfigService';
import { ConnectionStatusBadge } from './api-settings-badges';

const ICONS: Record<ConnectionTarget, typeof Flame> = {
	firebase: Flame,
	gemini: Sparkles,
	kakao: MessageCircle,
	google: KeyRound,
};

const ICON_STYLE: Record<ConnectionTarget, string> = {
	firebase: 'bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-800',
	gemini: 'bg-violet-50 text-violet-600 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-800',
	kakao: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:ring-yellow-800',
	google: 'bg-blue-50 text-blue-600 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-800',
};

export function ConnectionStatusBar({ statuses }: { statuses: ApiConfigStatuses }) {
	return (
		<section
			aria-label="연동 현황"
			className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-700 dark:bg-slate-800"
		>
			{CONNECTION_META.map((item) => {
				const Icon = ICONS[item.id];
				const status = statuses[item.id];
				return (
					<div
						key={item.id}
						className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/50"
					>
						<div className="flex min-w-0 items-center gap-2.5">
							<span
								className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${ICON_STYLE[item.id]}`}
							>
								<Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
							</span>
							<div className="min-w-0">
								<p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{item.label}</p>
								<p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{item.caption}</p>
							</div>
						</div>
						<ConnectionStatusBadge status={status} />
					</div>
				);
			})}
		</section>
	);
}
