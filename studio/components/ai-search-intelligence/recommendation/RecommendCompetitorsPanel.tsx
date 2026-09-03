'use client';

import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiCompetitorFoundLead, AsiObservationEmpty } from '@/components/ai-search-intelligence/primitives/AsiObservationEmpty';
import { AsiCompetitorMap } from '@/components/ai-search-intelligence/primitives/AsiCompetitorMap';
import { ASI_COMPETITOR_MIN_SAMPLE, resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import { AsiMetricHeading } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import {
	ASI_INTENSITY_TONE,
	ASI_TD,
	ASI_TD_NAME,
	ASI_TD_NUM,
	AsiDataTable,
} from '@/components/ai-search-intelligence/primitives/AsiDataTable';
import { ASI_ENGINES, type AsiRecommendationSnapshot } from '@/lib/ai-search-intelligence/types';

export function RecommendCompetitorsPanel({ snapshot }: { snapshot: AsiRecommendationSnapshot }) {
	const t = useTranslations('intelligence.recommendation');

	const observationState =
		snapshot.observationState ??
		resolveAsiObservationState({
			analyzed: snapshot.sov.computedFrom === 'live' || snapshot.source === 'live',
			validResponseCount: snapshot.sov.coverage?.validResponseCount ?? snapshot.sov.sampleSize ?? 0,
			competitorCount: snapshot.competitors.length,
		});
	const coverage = {
		queryCount: snapshot.sov.coverage?.queryCount ?? 0,
		validResponseCount: snapshot.sov.coverage?.validResponseCount ?? snapshot.sov.sampleSize ?? 0,
		minSample: ASI_COMPETITOR_MIN_SAMPLE,
	};
	if (observationState !== 'COMPETITORS_FOUND') {
		return <AsiObservationEmpty state={observationState} coverage={coverage} />;
	}

	return (
		<div className="flex flex-col gap-4">
			<AsiCompetitorFoundLead names={snapshot.competitors.map((row) => row.name)} />
			<AsiCard kicker={t('mapKicker')} title={t('mapTitle')} meta={t('mapMeta')} provenance="derived" badge="estimated" metric="coRecommend">
				<AsiCompetitorMap brandName={snapshot.site.brandName} competitors={snapshot.competitors} />
			</AsiCard>
			<AsiCard kicker={t('tableKicker')} title={t('tableTitle')} provenance="derived" badge="estimated">
				<AsiDataTable
					minWidthClass="min-w-[36rem]"
					rows={snapshot.competitors}
					rowKey={(row) => row.name}
					columns={[
						{ key: 'name', header: t('competitor'), cell: (row) => row.name, cellClassName: ASI_TD_NAME },
						{
							key: 'coRecommend',
							header: <AsiMetricHeading label={t('coRecommend')} metric="coRecommend" />,
							cell: (row) => row.coRecommend,
							cellClassName: ASI_TD_NUM,
						},
						{
							key: 'intensity',
							header: <AsiMetricHeading label={t('intensity')} metric="competitorIntensity" />,
							cell: (row) => t(`intensityValue.${row.intensity}`),
							cellClassName: (row) => `py-2.5 font-semibold ${ASI_INTENSITY_TONE[row.intensity]}`,
						},
						{ key: 'area', header: t('area'), cell: (row) => row.area, cellClassName: ASI_TD },
						...ASI_ENGINES.map((engine) => ({
							key: engine,
							header: t(`engine.${engine}`),
							cell: (row: (typeof snapshot.competitors)[number]) => `${row.engineRate[engine]}%`,
							cellClassName: ASI_TD_NUM,
						})),
					]}
				/>
			</AsiCard>
		</div>
	);
}
