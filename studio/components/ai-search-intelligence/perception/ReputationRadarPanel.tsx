'use client';

import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiRadarChart } from '@/components/ai-search-intelligence/primitives/AsiRadarChart';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { ASI_PERCEPTION_AXES, type AsiPerceptionSnapshot } from '@/lib/ai-search-intelligence/types';
import { ASI_KPI } from '@/lib/ui/asi-chrome';

export function ReputationRadarPanel({ snapshot }: { snapshot: AsiPerceptionSnapshot }) {
	const t = useTranslations('intelligence.perception');
	const axes = ASI_PERCEPTION_AXES.map((key) => ({
		key,
		label: t(`axis.${key}`),
		value: snapshot.axes[key],
	}));

	return (
		<div className="flex flex-col gap-4">
			<AsiCard kicker={t('radarKicker')} title={t('radarTitle')} meta={t('radarMeta')} provenance="derived" badge="derived_score" metric="trustScore">
				<AsiRadarChart
					axes={axes}
					center={
						<AsiScore
							value={snapshot.trustScore}
							label={t('trustCenter')}
							metric="trustScore"
							showGrade
							size="md"
						/>
					}
				/>
			</AsiCard>
			<section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
				{axes.map((axis) => (
					<div
						key={axis.key}
						className={ASI_KPI}
					>
						<AsiScore value={axis.value} label={axis.label} metric="perceptionAxis" size="sm" />
					</div>
				))}
			</section>
		</div>
	);
}
