'use client';

import { LayoutGrid, type LucideIcon } from 'lucide-react';
import {
	AI_TOOL_CATEGORIES,
	type AiToolCategoryId,
	type AiToolFilters,
} from '@/lib/admin/ai-tools-management';
import { resolveLucideIcon } from './ai-tools-badges';

interface AiToolsCategoryNavProps {
	value: AiToolFilters['category'];
	onChange: (category: AiToolFilters['category']) => void;
	counts: Record<AiToolCategoryId, number>;
	totalCount: number;
}

export function AiToolsCategoryNav({ value, onChange, counts, totalCount }: AiToolsCategoryNavProps) {
	return (
		<nav
			className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800"
			aria-label="AI 도구 카테고리"
		>
			<CategoryButton
				active={value === 'all'}
				icon={LayoutGrid}
				label="전체 도구"
				count={totalCount}
				onClick={() => onChange('all')}
			/>
			<div className="my-1 border-t border-slate-100 dark:border-slate-700" />
			{AI_TOOL_CATEGORIES.map((category) => (
				<CategoryButton
					key={category.id}
					active={value === category.id}
					icon={resolveLucideIcon(category.icon)}
					label={category.label}
					count={counts[category.id] ?? 0}
					onClick={() => onChange(category.id)}
				/>
			))}
		</nav>
	);
}

function CategoryButton({
	active,
	icon: Icon,
	label,
	count,
	onClick,
}: {
	active: boolean;
	icon: LucideIcon;
	label: string;
	count: number;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors ${
				active
					? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
					: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100'
			}`}
		>
			<Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
			<span className="min-w-0 flex-1 truncate">{label}</span>
			<span
				className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
					active
						? 'bg-white/20 text-white dark:bg-slate-950/10 dark:text-slate-950'
						: 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400'
				}`}
			>
				{count}
			</span>
		</button>
	);
}
