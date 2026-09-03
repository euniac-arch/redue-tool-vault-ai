'use client';

import { ScoreGradeBadge } from '@/components/audit/ScoreGradeBadge';
import { AsiMetricTooltip } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import {
	getAsiMetric,
	type AsiMetricId,
	type AsiProvenanceBadgeId,
} from '@/lib/ai-search-intelligence/provenance';
import { useAsiCountUp } from '@/lib/ui/asi-motion';

export function AsiScore({
	value,
	label,
	hint,
	metric,
	badge,
	showGrade = false,
	showBadge = true,
	format = 'score',
	size = 'md',
}: {
	value: number;
	label: string;
	hint?: string;
	metric?: AsiMetricId;
	badge?: AsiProvenanceBadgeId;
	showGrade?: boolean;
	showBadge?: boolean;
	format?: 'score' | 'count';
	size?: 'sm' | 'md' | 'lg';
}) {
	const shown = useAsiCountUp(value);
	const numberClass =
		size === 'lg' ? 'text-3xl sm:text-5xl' : size === 'sm' ? 'text-xl' : 'text-2xl sm:text-3xl';
	const def = metric ? getAsiMetric(metric) : null;
	const resolvedBadge = badge ?? def?.badge;

	return (
		<div className="min-w-0">
			<div className="flex flex-wrap items-center gap-1.5">
				<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
					{label}
				</p>
				{metric ? <AsiMetricTooltip metric={metric} label={label} /> : null}
				{showBadge && resolvedBadge ? <AsiProvenanceBadge badge={resolvedBadge} /> : null}
			</div>
			<div className="mt-1 flex flex-wrap items-end gap-2">
				<p className={`${numberClass} font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-white`}>
					{shown}
					{format === 'score' ? (
						<span className="ml-0.5 text-sm font-semibold text-slate-400">/100</span>
					) : null}
				</p>
				{showGrade ? <ScoreGradeBadge score={value} size="sm" showQualifier={false} /> : null}
			</div>
			{hint ? <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p> : null}
		</div>
	);
}
