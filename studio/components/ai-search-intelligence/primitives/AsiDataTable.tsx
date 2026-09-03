import type { ReactNode } from 'react';
import { AsiTableFrame } from '@/components/ai-search-intelligence/primitives/AsiTableFrame';
import type { AsiCompetitorIntensity } from '@/lib/ai-search-intelligence/types';

export const ASI_INTENSITY_TONE: Record<AsiCompetitorIntensity, string> = {
	high: 'text-rose-600 dark:text-rose-300',
	mid: 'text-amber-600 dark:text-amber-300',
	low: 'text-slate-500 dark:text-slate-400',
};

export const ASI_TD = 'py-2.5 text-slate-600 dark:text-slate-300';
export const ASI_TD_NAME = 'py-2.5 font-semibold text-slate-800 dark:text-slate-100';
export const ASI_TD_NUM = 'py-2.5 tabular-nums text-slate-600 dark:text-slate-300';

export type AsiTableColumn<T> = {
	key: string;
	header: ReactNode;
	cell: (row: T) => ReactNode;
	cellClassName?: string | ((row: T) => string);
};

export function AsiDataTable<T>({
	rows,
	rowKey,
	columns,
	minWidthClass = 'min-w-[28rem]',
}: {
	rows: readonly T[];
	rowKey: (row: T) => string;
	columns: Array<AsiTableColumn<T>>;
	minWidthClass?: string;
}) {
	return (
		<AsiTableFrame>
			<table className={`w-full ${minWidthClass} text-left text-sm`}>
				<thead>
					<tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-800">
						{columns.map((column) => (
							<th key={column.key} className="pb-2 font-bold">
								{column.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={rowKey(row)} className="border-b border-slate-100 last:border-0 dark:border-slate-800/80">
							{columns.map((column) => (
								<td
									key={column.key}
									className={
										typeof column.cellClassName === 'function'
											? column.cellClassName(row)
											: (column.cellClassName ?? ASI_TD)
									}
								>
									{column.cell(row)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</AsiTableFrame>
	);
}
