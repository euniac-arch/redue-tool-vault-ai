export type ContextTagItem = {
	id: string;
	label: string;
	value: string;
};

export function ContextTagBadgeGroup({
	items,
	active = false,
}: {
	items: readonly ContextTagItem[];
	active?: boolean;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{items.map((item) => (
				<span
					key={item.id}
					className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
						active
							? 'animate-pulse border-cyan-400/80 bg-cyan-50 text-cyan-800 motion-reduce:animate-none dark:border-violet-400/50 dark:bg-slate-800 dark:text-cyan-200'
							: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300'
					}`}
				>
					<span className="text-[10px] uppercase tracking-wide opacity-70">{item.label}</span>
					{item.value}
				</span>
			))}
		</div>
	);
}
