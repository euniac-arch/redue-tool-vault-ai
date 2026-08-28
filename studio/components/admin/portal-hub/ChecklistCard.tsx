'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import type { PortalHubChecklistItem } from '@/lib/admin/portal-hub/types';

interface ChecklistCardProps {
	title?: string;
	items: PortalHubChecklistItem[];
	isChecked: (id: string) => boolean;
	onToggle: (id: string) => void;
}

/** Interactive step checklist. Progress is owned by the caller (persisted via `usePortalHubState`). */
export function ChecklistCard({ title = '핵심 절차 체크리스트', items, isChecked, onToggle }: ChecklistCardProps) {
	const done = items.filter((item) => isChecked(item.id)).length;
	const total = items.length;
	const pct = total === 0 ? 0 : Math.round((done / total) * 100);

	return (
		<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
				<span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
					{done} / {total} 완료
				</span>
			</div>
			<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
				<div
					className="h-full rounded-full bg-emerald-500 transition-all duration-300"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<ul className="mt-3 flex flex-col gap-1.5">
				{items.map((item, index) => {
					const checked = isChecked(item.id);
					return (
						<li key={item.id}>
							<button
								type="button"
								onClick={() => onToggle(item.id)}
								aria-pressed={checked}
								className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
									checked
										? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
										: 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/60'
								}`}
							>
								{checked ? (
									<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
								) : (
									<Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
								)}
								<span className="min-w-0">
									<span
										className={`block font-semibold ${
											checked
												? 'text-emerald-800 line-through decoration-emerald-400/60 dark:text-emerald-300'
												: 'text-slate-800 dark:text-slate-100'
										}`}
									>
										{index + 1}. {item.label}
									</span>
									{item.detail && (
										<span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">
											{item.detail}
										</span>
									)}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
