import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [6, 12, 24] as const;
export type GeoNewsPageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function pageWindow(current: number, total: number): Array<number | 'ellipsis'> {
	if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

	const pages = new Set<number>([1, total, current, current - 1, current + 1]);
	if (current <= 3) {
		pages.add(2);
		pages.add(3);
		pages.add(4);
	}
	if (current >= total - 2) {
		pages.add(total - 1);
		pages.add(total - 2);
		pages.add(total - 3);
	}

	const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
	const result: Array<number | 'ellipsis'> = [];
	for (const page of sorted) {
		const prev = result[result.length - 1];
		if (typeof prev === 'number' && page - prev > 1) result.push('ellipsis');
		result.push(page);
	}
	return result;
}

interface GeoNewsPaginationProps {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

export function GeoNewsPagination({ page, totalPages, onPageChange }: GeoNewsPaginationProps) {
	if (totalPages <= 1) return null;

	const items = pageWindow(page, totalPages);

	return (
		<nav className="flex items-center justify-center gap-1" aria-label="뉴스 페이지네이션">
			<button
				type="button"
				disabled={page <= 1}
				onClick={() => onPageChange(page - 1)}
				className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
			>
				<ChevronLeft className="h-3.5 w-3.5" />
				이전
			</button>
			{items.map((item, index) =>
				item === 'ellipsis' ? (
					<span key={`ellipsis-${index}`} className="px-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
						…
					</span>
				) : (
					<button
						key={item}
						type="button"
						onClick={() => onPageChange(item)}
						aria-current={item === page ? 'page' : undefined}
						className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2.5 text-xs font-bold ${
							item === page
								? 'bg-slate-900 text-white'
								: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
						}`}
					>
						{item}
					</button>
				),
			)}
			<button
				type="button"
				disabled={page >= totalPages}
				onClick={() => onPageChange(page + 1)}
				className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
			>
				다음
				<ChevronRight className="h-3.5 w-3.5" />
			</button>
		</nav>
	);
}
