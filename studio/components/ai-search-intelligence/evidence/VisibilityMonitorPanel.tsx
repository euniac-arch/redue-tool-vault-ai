'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiFilterChip } from '@/components/ai-search-intelligence/primitives/AsiFilterChip';
import { AsiFilterTabList } from '@/components/ai-search-intelligence/primitives/AsiFilterTabList';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiMonitorChart } from '@/components/ai-search-intelligence/primitives/AsiSovChart';
import {
	ASI_MONITOR_RANGES,
	type AsiMonitorRange,
	type AsiEvidenceSnapshot,
} from '@/lib/ai-search-intelligence/types';

const SERIES = [
	{ key: 'mention', color: '#0891b2' },
	{ key: 'recommendationRate', color: '#7c3aed' },
	{ key: 'shareOfVoice', color: '#f59e0b' },
	{ key: 'citationCount', color: '#64748b' },
	{ key: 'visibilityScore', color: '#059669' },
] as const;

export function VisibilityMonitorPanel({ snapshot }: { snapshot: AsiEvidenceSnapshot }) {
	const t = useTranslations('intelligence.evidence');
	const [range, setRange] = useState<AsiMonitorRange>('7d');
	const points = snapshot.monitor[range];
	const latest = snapshot.monitorLatest;

	return (
		<div className="flex flex-col gap-4">
			<AsiFilterTabList label={t('rangeAria')}>
				{ASI_MONITOR_RANGES.map((item) => (
					<AsiFilterChip key={item} active={range === item} onClick={() => setRange(item)}>
						{t(`range.${item}`)}
					</AsiFilterChip>
				))}
			</AsiFilterTabList>
			<section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
				<AsiCard>
					<AsiScore value={latest.mention} label={t('metric.mention')} metric="mentionRate" size="sm" />
				</AsiCard>
				<AsiCard>
					<AsiScore value={latest.recommendationRate} label={t('metric.recommendationRate')} metric="recommendationRate" size="sm" />
				</AsiCard>
				<AsiCard>
					<AsiScore value={latest.shareOfVoice} label={t('metric.shareOfVoice')} metric="shareOfVoice" size="sm" />
				</AsiCard>
				<AsiCard>
					<AsiScore
						value={latest.citationCount}
						label={t('metric.citationCount')}
						metric="citationCount"
						format="count"
						size="sm"
					/>
				</AsiCard>
				<AsiCard>
					<AsiScore value={latest.visibilityScore} label={t('metric.visibilityScore')} metric="visibilityScore" size="sm" showGrade />
				</AsiCard>
			</section>
			<AsiCard kicker={t('trendKicker')} title={t('trendTitle')} meta={t('trendMeta')} provenance="derived" badge="estimated" metric="visibilityScore">
				<AsiMonitorChart
					rows={points.map((point) => ({
						name: point.label,
						mention: point.mention,
						recommendationRate: point.recommendationRate,
						shareOfVoice: point.shareOfVoice,
						citationCount: point.citationCount,
						visibilityScore: point.visibilityScore,
					}))}
					keys={SERIES.map((item) => ({ key: item.key, color: item.color }))}
				/>
				<ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
					{SERIES.map((item) => (
						<li key={item.key} className="inline-flex items-center gap-1.5">
							<span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
							{t(`metric.${item.key}`)}
						</li>
					))}
				</ul>
			</AsiCard>
		</div>
	);
}
