'use client';

import { useTranslations } from 'next-intl';
import {
	GEO_DOMAIN_WEIGHT,
	formatWeightedContribution,
} from '@/lib/audit/geoScoreCalculator';

export function GeoWeightCaption({
	score,
	maxScore,
	className,
}: {
	score: number;
	maxScore: number;
	className?: string;
}) {
	const t = useTranslations('audit.geoScore');
	const convertedScore = formatWeightedContribution(score, maxScore);

	return (
		<p className={`mt-[6px] w-0 min-w-full text-center text-[0.6rem] font-medium leading-tight tabular-nums text-slate-400 dark:text-zinc-500 ${className ?? ''}`}>
			{t('weightCaption', { weight: GEO_DOMAIN_WEIGHT, score: convertedScore })}
		</p>
	);
}
