'use client';

import { useTranslations } from 'next-intl';

export const HISTORY_VIEW_COUNTS = [10, 20, 50] as const;
export const HISTORY_VIEW_ALL = 0;

interface HistoryViewCountBarProps {
	totalItems: number;
	viewCount: number;
	onViewCountChange: (size: number) => void;
}

export function HistoryPaginationBar({
	totalItems,
	viewCount,
	onViewCountChange,
}: HistoryViewCountBarProps) {
	const t = useTranslations('audit.history');

	return (
		<div className="mb-3 flex items-center justify-between gap-3 px-1 py-2">
			<div className="text-xs font-medium text-slate-600 sm:text-sm dark:text-slate-400">
				{t.rich('paginationTotalRecords', {
					count: totalItems.toLocaleString(),
					n: (chunks) => <span className="font-bold text-cyan-600 dark:text-cyan-400">{chunks}</span>,
				})}
			</div>

			<div className="relative shrink-0">
				<select
					value={viewCount}
					onChange={(event) => onViewCountChange(Number(event.target.value))}
					aria-label={t('paginationPageSizeAria')}
					className="cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 focus:border-cyan-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-slate-700"
				>
					{HISTORY_VIEW_COUNTS.map((size) => (
						<option key={size} value={size}>
							{t('paginationPageSize', { size })}
						</option>
					))}
					<option value={HISTORY_VIEW_ALL}>{t('paginationViewAll')}</option>
				</select>
				<span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
					▼
				</span>
			</div>
		</div>
	);
}
