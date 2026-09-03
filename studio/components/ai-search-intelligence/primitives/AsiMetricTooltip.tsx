'use client';

import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AsiMetricId } from '@/lib/ai-search-intelligence/provenance';

export function AsiMetricTooltip({
	metric,
	label,
}: {
	metric: AsiMetricId;
	label: string;
}) {
	const t = useTranslations('intelligence.provenance');
	const text = t(`metric.${metric}`);

	return (
		<span className="group relative inline-flex align-middle">
			<button
				type="button"
				className="inline-flex cursor-help items-center justify-center text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:hover:text-slate-200"
				aria-label={t('tooltipAria', { label })}
			>
				<Info className="h-3.5 w-3.5" aria-hidden />
			</button>
			<span
				role="tooltip"
				className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[18rem] -translate-x-1/2 rounded-lg bg-slate-900/95 px-3 py-1.5 text-left text-xs leading-relaxed whitespace-normal break-keep text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 md:left-0 md:translate-x-0"
			>
				{text}
			</span>
		</span>
	);
}

export function AsiMetricHeading({
	label,
	metric,
}: {
	label: string;
	metric: AsiMetricId;
}) {
	return (
		<span className="inline-flex items-center gap-1">
			{label}
			<AsiMetricTooltip metric={metric} label={label} />
		</span>
	);
}
