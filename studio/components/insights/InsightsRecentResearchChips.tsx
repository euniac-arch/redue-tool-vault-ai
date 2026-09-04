'use client';

interface InsightsRecentResearchChipsProps {
	queries: string[];
	activeQuery?: string;
	disabled?: boolean;
	onSelect: (query: string) => void;
	onRemove: (query: string) => void;
	onClear: () => void;
}

export function InsightsRecentResearchChips({
	queries,
	activeQuery,
	disabled = false,
	onSelect,
	onRemove,
	onClear,
}: InsightsRecentResearchChipsProps) {
	if (queries.length === 0) return null;

	return (
		<div className="mt-2 flex min-w-0 items-center">
			<p className="mr-2 flex shrink-0 items-center text-xs text-slate-400">🕒 최근 리서치:</p>
			<div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] md:flex-wrap md:overflow-visible md:whitespace-normal [&::-webkit-scrollbar]:hidden">
				{queries.map((query) => {
					const active = activeQuery?.trim() === query;
					return (
						<button
							key={query}
							type="button"
							disabled={disabled}
							onClick={() => onSelect(query)}
							className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
								active
									? 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-slate-900/80 dark:text-cyan-300'
									: 'border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-cyan-300'
							}`}
						>
							<span className="max-w-[12rem] truncate">{query}</span>
							<span
								role="button"
								tabIndex={0}
								aria-label={`${query} 기록 삭제`}
								onClick={(event) => {
									event.stopPropagation();
									event.preventDefault();
									if (disabled) return;
									onRemove(query);
								}}
								onKeyDown={(event) => {
									if (event.key !== 'Enter' && event.key !== ' ') return;
									event.stopPropagation();
									event.preventDefault();
									if (disabled) return;
									onRemove(query);
								}}
								className="inline-flex h-3.5 w-3.5 items-center justify-center text-[10px] text-slate-500 transition-colors hover:text-red-400"
							>
								✕
							</span>
						</button>
					);
				})}
			</div>
			<button
				type="button"
				onClick={onClear}
				className="ml-2 shrink-0 whitespace-nowrap text-[11px] font-semibold text-slate-500 underline-offset-2 transition hover:text-slate-700 hover:underline dark:hover:text-slate-300"
			>
				기록 삭제
			</button>
		</div>
	);
}
