'use client';

import { useTranslations } from 'next-intl';
import { GeoPillarBadge } from '@/components/audit/GeoPillarBadge';
import type { GeoPillarScore } from '@/lib/audit/geoScoreCalculator';
import {
	geoPillarIndex,
	resolveGeoPillarBadgeCopy,
	resolveGeoPillarBadgeTheme,
	resolveGeoPillarStatus,
} from '@/lib/audit/geoScoreCalculator';

function compactTone(status: ReturnType<typeof resolveGeoPillarStatus>): string {
	if (status === 'ok') {
		return 'bg-emerald-50 text-emerald-800 ring-emerald-300/80 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35';
	}
	if (status === 'warn') {
		return 'bg-amber-50 text-amber-900 ring-amber-300/80 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/35';
	}
	return 'bg-rose-50 text-rose-800 ring-rose-300/80 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/35';
}

export function GeoPillarScoreBadge({
	pillar,
	size = 'md',
	showAxisLabel = false,
}: {
	pillar: GeoPillarScore;
	size?: 'sm' | 'md';
	showAxisLabel?: boolean;
}) {
	const t = useTranslations('audit.geoPillarBadge');
	const status = resolveGeoPillarStatus(pillar);
	const copy = resolveGeoPillarBadgeCopy(pillar);

	if (showAxisLabel) {
		return (
			<GeoPillarBadge
				index={geoPillarIndex(pillar.id)}
				earned={pillar.earned}
				max={pillar.max}
				statusText={t(copy)}
				theme={resolveGeoPillarBadgeTheme(copy)}
				pillarId={pillar.id}
				status={status}
			/>
		);
	}

	return (
		<span
			data-geo-pillar-badge={pillar.id}
			data-geo-pillar-status={status}
			className={`inline-flex shrink-0 items-baseline gap-0.5 rounded-full px-2.5 py-1 font-extrabold tabular-nums ring-1 ${compactTone(status)} ${
				size === 'sm' ? 'text-[10px]' : 'text-[11px]'
			}`}
		>
			<span>{pillar.earned}</span>
			<span className="font-semibold opacity-70">/{pillar.max}</span>
		</span>
	);
}
