import { ChevronLeft, ChevronRight } from 'lucide-react';

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

const BTN =
	'inline-flex h-8 items-center justify-center rounded-lg border outline-none px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const BTN_IDLE =
	'border-slate-200 bg-white text-slate-500 hover:border-cyan-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-cyan-500/40 dark:hover:text-slate-100';
const PAGE_BTN_IDLE =
	'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';
const PAGE_BTN_ACTIVE = 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm';

interface InsightsPaginationProps {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

export function InsightsPagination({ page, totalPages, onPageChange }: InsightsPaginationProps) {
	if (totalPages <= 1) return null;

	const items = pageWindow(page, totalPages);

	return (
		<nav className="flex flex-wrap items-center justify-center gap-2" aria-label="뉴스 페이지네이션">
			<button
				type="button"
				disabled={page <= 1}
				onClick={() => onPageChange(page - 1)}
				className={`${BTN} ${BTN_IDLE} gap-1`}
			>
				<ChevronLeft className="h-3.5 w-3.5" />
				이전
			</button>
			<div className="inline-flex items-stretch overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
				{items.map((item, index) =>
					item === 'ellipsis' ? (
						<span
							key={`ellipsis-${index}`}
							className="inline-flex h-8 items-center bg-white px-2 text-xs font-semibold text-slate-400 dark:bg-slate-900 dark:text-slate-500"
						>
							…
						</span>
					) : (
						<button
							key={item}
							type="button"
							onClick={() => onPageChange(item)}
							aria-current={item === page ? 'page' : undefined}
							className={`inline-flex h-8 min-w-8 items-center justify-center px-2.5 text-xs font-semibold outline-none transition-colors ${
								item === page ? PAGE_BTN_ACTIVE : PAGE_BTN_IDLE
							}`}
						>
							{item}
						</button>
					),
				)}
			</div>
			<button
				type="button"
				disabled={page >= totalPages}
				onClick={() => onPageChange(page + 1)}
				className={`${BTN} ${BTN_IDLE} gap-1`}
			>
				다음
				<ChevronRight className="h-3.5 w-3.5" />
			</button>
		</nav>
	);
}
