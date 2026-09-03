'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiEmptyState } from '@/components/ai-search-intelligence/primitives/AsiEmptyState';
import { AsiFilterChip } from '@/components/ai-search-intelligence/primitives/AsiFilterChip';
import { AsiFilterTabList } from '@/components/ai-search-intelligence/primitives/AsiFilterTabList';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiSovBar, AsiSovLine, AsiSovPie } from '@/components/ai-search-intelligence/primitives/AsiSovChart';
import type { AsiRecommendationSnapshot, AsiSovCoverage, AsiSovPeriod } from '@/lib/ai-search-intelligence/types';
import { ASI_SOV_CATEGORIES, ASI_SOV_PERIODS } from '@/lib/ai-search-intelligence/types';

const EMPTY_COVERAGE: AsiSovCoverage = {
	queryCount: 0,
	validResponseCount: 0,
	competitorObservationCount: 0,
	calculable: false,
};

function sampleLabel(t: (key: string, values?: { count: number }) => string, count: number, live: boolean) {
	if (!live) return t('sovSampleMock');
	return t('sovSample', { count });
}

function SovCoverageCard({
	coverage,
	t,
}: {
	coverage: AsiSovCoverage;
	t: (key: string, values?: { count: number }) => string;
}) {
	return (
		<AsiCard provenance="observed" badge="observed">
			<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{t('sovCoverageTitle')}</p>
			<ul className="mt-2 space-y-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
				<li>{t('sovCoverageQuery', { count: coverage.queryCount })}</li>
				<li>{t('sovCoverageResponses', { count: coverage.validResponseCount })}</li>
				<li>{t('sovCoverageCompetitors', { count: coverage.competitorObservationCount })}</li>
				<li>{coverage.calculable ? t('sovCoverageYes') : t('sovCoverageNo')}</li>
			</ul>
		</AsiCard>
	);
}

export function RecommendSovPanel({ snapshot }: { snapshot: AsiRecommendationSnapshot }) {
	const t = useTranslations('intelligence.recommendation');
	const [period, setPeriod] = useState<AsiSovPeriod>('7d');
	const sov = snapshot.sov;
	const live = sov.computedFrom === 'live';
	const coverage = sov.coverage ?? EMPTY_COVERAGE;
	const sparse = live && !coverage.calculable;
	const mentionValue = sov.mention?.value ?? (sparse ? null : sov.overall);
	const recValue = sov.recommendation?.value ?? null;
	const competitorShare =
		live && sov.sufficient && sov.byEngine.length
			? Math.round(sov.byEngine.reduce((sum, row) => sum + row.competitorShare, 0) / sov.byEngine.length)
			: 38;
	const overallOther = Math.max(0, 100 - (mentionValue ?? 0) - competitorShare);
	const periodRow = (sov.byPeriod ?? []).find((row) => row.period === period);

	if (sparse) {
		return (
			<div className="flex flex-col gap-4">
				<SovCoverageCard coverage={coverage} t={t} />
				<AsiEmptyState title={t('sovSparseTitle')} body={t('sovSparseBody', { count: coverage.validResponseCount })} />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{live ? <SovCoverageCard coverage={coverage} t={t} /> : null}
			<p className="inline-flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
				<AsiProvenanceBadge badge={live ? 'observed' : 'estimated'} />
				{sampleLabel(t, sov.sampleSize, live)}
			</p>
			<div className="grid gap-4 lg:grid-cols-2">
				<AsiCard kicker={t('sovKicker')} title={t('sovMentionTitle')} provenance="derived" badge="derived_score" metric="shareOfVoice">
					{mentionValue == null ? (
						<AsiEmptyState title={t('sovSparseTitle')} body={t('sovSparseBody', { count: sov.mention?.sampleSize ?? 0 })} />
					) : (
						<AsiScore
							value={mentionValue}
							label={t('sovMention')}
							hint={t('sovMentionHint')}
							metric="shareOfVoice"
							showGrade
							size="lg"
						/>
					)}
					<p className="mt-2 text-xs text-slate-500">{sampleLabel(t, sov.mention?.sampleSize ?? sov.sampleSize, live)}</p>
				</AsiCard>
				<AsiCard kicker={t('sovKicker')} title={t('sovRecommendTitle')} provenance="derived" badge="derived_score" metric="shareOfVoice">
					{recValue == null || !sov.recommendation?.sufficient ? (
						<AsiEmptyState title={t('sovSparseTitle')} body={t('sovRecommendSparse')} />
					) : (
						<AsiScore
							value={recValue}
							label={t('sovRecommend')}
							hint={t('sovRecommendHint')}
							metric="shareOfVoice"
							showGrade
							size="lg"
						/>
					)}
					<p className="mt-2 text-xs text-slate-500">{sampleLabel(t, sov.recommendation?.sampleSize ?? 0, live)}</p>
				</AsiCard>
			</div>
			<AsiCard kicker={t('sovKicker')} title={t('sovPieTitle')} provenance="derived" badge="estimated" metric="shareOfVoice">
				<AsiSovPie
					brand={mentionValue ?? 0}
					competitor={competitorShare}
					other={overallOther}
					brandLabel={snapshot.site.brandName}
					competitorLabel={t('competitors')}
					otherLabel={t('other')}
				/>
			</AsiCard>
			<AsiCard kicker={t('sovQueryKicker')} title={t('sovQueryTitle')} provenance="derived" badge="estimated" metric="shareOfVoice">
				<AsiSovBar
					rows={sov.byQuery.map((row) => ({
						name: row.label.length > 16 ? `${row.label.slice(0, 16)}…` : row.label,
						brand: row.brandShare,
						competitor: row.competitorShare,
					}))}
				/>
			</AsiCard>
			<AsiCard kicker={t('sovEngineKicker')} title={t('sovEngineTitle')} provenance="derived" badge="estimated" metric="shareOfVoice">
				<AsiSovBar
					rows={sov.byEngine.map((row) => ({
						name: t(`engine.${row.engine}`),
						brand: row.brandShare,
						competitor: row.competitorShare,
					}))}
				/>
			</AsiCard>
			{(sov.byCategory ?? []).length ? (
				<AsiCard kicker={t('sovCategoryKicker')} title={t('sovCategoryTitle')} provenance="derived" badge="estimated" metric="shareOfVoice">
					<AsiSovBar
						rows={ASI_SOV_CATEGORIES.map((category) => {
							const row = sov.byCategory.find((item) => item.category === category);
							return {
								name: t(`sovCategory.${category}`),
								brand: row?.sufficient ? row.brandShare : 0,
								competitor: row?.sufficient ? row.competitorShare : 0,
							};
						})}
					/>
				</AsiCard>
			) : null}
			<AsiCard kicker={t('sovTimeKicker')} title={t('sovTimeTitle')} meta={live ? t('sovTimeLiveMeta') : t('sovTimeMeta')} provenance="derived" badge="estimated" metric="shareOfVoice">
				{live && (sov.byPeriod ?? []).length ? (
					<>
						<AsiFilterTabList label={t('sovPeriodAria')}>
							{ASI_SOV_PERIODS.map((item) => (
								<AsiFilterChip key={item} active={period === item} onClick={() => setPeriod(item)}>
									{t(`sovPeriod.${item}`)}
								</AsiFilterChip>
							))}
						</AsiFilterTabList>
						{periodRow && periodRow.mention.sufficient && periodRow.mention.value != null ? (
							<div className="mt-4">
								<AsiScore
									value={periodRow.mention.value}
									label={t(`sovPeriod.${period}`)}
									hint={sampleLabel(t, periodRow.mention.sampleSize, true)}
									metric="shareOfVoice"
									size="md"
								/>
							</div>
						) : (
							<div className="mt-4">
								<AsiEmptyState title={t('sovSparseTitle')} body={t('sovPeriodSparse')} />
							</div>
						)}
						<AsiSovLine
							rows={sov.byPeriod.map((row) => ({
								name: t(`sovPeriod.${row.period}`),
								brand: row.mention.value ?? 0,
								competitor: row.competitorShare,
							}))}
						/>
					</>
				) : (
					<AsiSovLine
						rows={sov.timeline.map((row) => ({
							name: row.period,
							brand: row.brandShare,
							competitor: row.competitorShare,
						}))}
					/>
				)}
			</AsiCard>
		</div>
	);
}
