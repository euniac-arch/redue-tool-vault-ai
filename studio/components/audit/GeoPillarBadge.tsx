'use client';

import { memo } from 'react';

const circleNumbers = {
	1: '①',
	2: '②',
	3: '③',
	4: '④',
} as const;

const themeStyles = {
	rose: 'bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400',
	amber: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
	emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400',
} as const;

export interface GeoPillarBadgeProps {
	index: 1 | 2 | 3 | 4;
	earned: number;
	max?: number;
	statusText: string;
	theme?: 'rose' | 'amber' | 'emerald';
	pillarId?: string;
	status?: string;
}

export const GeoPillarBadge = memo(function GeoPillarBadge({
	index,
	earned,
	max = 25,
	statusText,
	theme = 'amber',
	pillarId,
	status,
}: GeoPillarBadgeProps) {
	return (
		<div
			data-geo-pillar-badge={pillarId}
			data-geo-pillar-status={status}
			className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-lg border text-xs font-black tracking-tight ${themeStyles[theme]}`}
		>
			<span className="text-sm font-normal">{circleNumbers[index]}</span>
			<span className="font-extrabold tabular-nums">
				{earned} / {max}
			</span>
			<span className="opacity-40 font-light">·</span>
			<span className="font-bold">{statusText}</span>
		</div>
	);
});
