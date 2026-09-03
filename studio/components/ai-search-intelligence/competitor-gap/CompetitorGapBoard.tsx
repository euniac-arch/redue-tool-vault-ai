'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiCompetitorFoundLead, AsiObservationEmpty } from '@/components/ai-search-intelligence/primitives/AsiObservationEmpty';
import { ASI_COMPETITOR_MIN_SAMPLE, resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import { AsiMetricHeading } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiSystemQuestion } from '@/components/ai-search-intelligence/system/AsiSystemQuestion';
import { AsiLoopNav } from '@/components/ai-search-intelligence/shell/AsiLoopNav';
import { ASI_CARD, ASI_CARD_HOVER, ASI_CTA, ASI_PILLAR_ACTIVE, ASI_SECTION_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';
import type { AsiCompetitorGapSnapshot } from '@/lib/ai-search-intelligence/types';

function formatValue(value: number, unit: 'percent' | 'count') {
	return unit === 'percent' ? `${value}%` : String(value);
}

function formatGap(value: number, unit: 'percent' | 'count') {
	const sign = value > 0 ? '+' : '';
	return unit === 'percent' ? `${sign}${value}%p` : `${sign}${value}`;
}

export function CompetitorGapBoard({ snapshot }: { snapshot: AsiCompetitorGapSnapshot }) {
	const t = useTranslations('intelligence.gap');
	const tSys = useTranslations('intelligence.system');
	const cards = useMemo(() => {
		if (snapshot.rankedCompetitors?.length) return snapshot.rankedCompetitors;
		if (snapshot.boards?.length) {
			return snapshot.boards.map((board) => ({
				name: board.name,
				mentionCount: board.mentionCount,
				recommendCount: board.recommendCount,
			}));
		}
		return snapshot.competitors.map((row) => ({ name: row.name, mentionCount: 0, recommendCount: 0 }));
	}, [snapshot.boards, snapshot.competitors, snapshot.rankedCompetitors]);
	const [selectedName, setSelectedName] = useState(snapshot.selectedCompetitor || cards[0]?.name || '');

	useEffect(() => {
		setSelectedName(snapshot.selectedCompetitor || cards[0]?.name || '');
	}, [snapshot.analyzedAt, snapshot.selectedCompetitor, cards]);

	const board = snapshot.boards?.find((item) => item.name === selectedName);
	const competitor = selectedName || snapshot.selectedCompetitor || snapshot.competitors[0]?.name;
	const metrics = board?.metrics ?? snapshot.metrics;
	const queries = board?.queries ?? snapshot.queries;
	const whyTheyWin = board?.whyTheyWin ?? snapshot.whyTheyWin;
	const top = board?.top ?? snapshot.top;
	const totalGaps = board?.rows.length ?? snapshot.summary.totalGaps;
	const highImpact = board?.rows.filter((row) => row.impact >= 60).length ?? snapshot.summary.highImpact;

	const observationState =
		snapshot.summary.observationState ??
		resolveAsiObservationState({
			analyzed: snapshot.source === 'live' || (snapshot.summary.validResponseCount ?? 0) > 0,
			validResponseCount: snapshot.summary.validResponseCount ?? 0,
			competitorCount: snapshot.summary.competitorsObserved,
		});
	if (observationState !== 'COMPETITORS_FOUND') {
		return (
			<AsiObservationEmpty
				state={observationState}
				coverage={{
					queryCount: snapshot.summary.queryCount ?? 0,
					validResponseCount: snapshot.summary.validResponseCount ?? 0,
					minSample: ASI_COMPETITOR_MIN_SAMPLE,
				}}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<AsiCompetitorFoundLead names={cards.map((row) => row.name)} />
			<AsiSystemQuestion
				question="who"
				answer={tSys('answer.who', {
					name: competitor || tSys('answer.unknownCompetitor'),
					gaps: totalGaps,
				})}
			/>
			<AsiLoopNav current="compete" />
			<section>
				<p className={ASI_SECTION_KICKER}>{t('cardsKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{t('cardsTitle')}</h2>
				<p className="mt-1 text-sm text-zinc-500">{t('autoMapped')}</p>
				<ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{cards.map((row) => {
						const active = row.name === competitor;
						return (
							<li key={row.name}>
								<button
									type="button"
									onClick={() => setSelectedName(row.name)}
									className={`${ASI_CARD} ${ASI_CARD_HOVER} ${asiFocusRing()} w-full px-4 py-4 text-left ${active ? ASI_PILLAR_ACTIVE : ''}`}
								>
									<p className="text-base font-bold text-zinc-900 dark:text-zinc-50">{row.name}</p>
									<p className="mt-2 text-sm text-zinc-500">
										{t('mentions', { count: row.mentionCount })} · {t('recommends', { count: row.recommendCount })}
									</p>
								</button>
							</li>
						);
					})}
				</ul>
			</section>
			<section aria-label={t('summaryAria')} className="grid gap-3 sm:grid-cols-3">
				{(
					[
						['competitors', snapshot.summary.competitorsObserved],
						['gaps', totalGaps],
						['high', highImpact],
					] as const
				).map(([key, count]) => (
					<article key={key} className={`${ASI_CARD} px-4 py-4`}>
						<p className={ASI_SECTION_KICKER}>{t(`summary.${key}`)}</p>
						<p className="mt-2 text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{count}</p>
					</article>
				))}
			</section>

			<section>
				<p className={ASI_SECTION_KICKER}>{t('compareKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{t('compareTitle')}</h2>
				<p className="mt-1 text-sm text-zinc-500">
					{snapshot.brand.name} vs {competitor}
				</p>
				<div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{metrics.map((metric) => (
						<AsiCard key={metric.kind}>
							<p className={ASI_SECTION_KICKER}>{t(`kind.${metric.kind}`)}</p>
							{metric.available ? (
								<dl className="mt-3 grid gap-2 text-sm">
									<div className="flex justify-between">
										<dt>{t('us')}</dt>
										<dd className="font-bold tabular-nums">{formatValue(metric.brand, metric.unit)}</dd>
									</div>
									<div className="flex justify-between">
										<dt>{t('them')}</dt>
										<dd className="font-bold tabular-nums">{formatValue(metric.competitor, metric.unit)}</dd>
									</div>
									<div className="flex justify-between">
										<dt>{t('gapLabel')}</dt>
										<dd className="font-bold tabular-nums text-rose-600 dark:text-rose-300">
											{formatGap(metric.gap, metric.unit)}
										</dd>
									</div>
								</dl>
							) : (
								<p className="mt-3 text-sm text-zinc-500">{t('unavailable')}</p>
							)}
						</AsiCard>
					))}
				</div>
			</section>

			<section>
				<p className={ASI_SECTION_KICKER}>{t('queryKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{t('queryTitle')}</h2>
				{queries.length ? (
					<ul className="mt-3 flex flex-col gap-3">
						{queries.map((row) => (
							<li key={row.query} className={`${ASI_CARD} px-4 py-4`}>
								<p className="font-bold text-zinc-900 dark:text-zinc-50">{row.query}</p>
								<div className="mt-3 grid gap-3 sm:grid-cols-2">
									<div>
										<p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('us')}</p>
										<p className="mt-1 text-sm">
											{t('brandRec')} {row.brand.recommendation}% · {t('brandCite')} {row.brand.citation} · {t('brandMention')}{' '}
											{row.brand.mention}
										</p>
									</div>
									<div>
										<p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{row.competitor}</p>
										<p className="mt-1 text-sm">
											{t('brandRec')} {row.competitorStats.recommendation}% · {t('brandCite')} {row.competitorStats.citation} ·{' '}
											{t('brandMention')} {row.competitorStats.mention}
										</p>
									</div>
								</div>
								<p className="mt-3 text-sm font-semibold text-rose-600 dark:text-rose-300">
									{t('kind.recommendation')} {formatGap(row.gaps.recommendation, 'percent')} · {t('kind.citation')}{' '}
									{formatGap(row.gaps.citation, 'count')}
									{typeof row.gaps.visibility === 'number'
										? ` · ${t('kind.visibility')} ${formatGap(row.gaps.visibility, 'count')}`
										: ''}
								</p>
							</li>
						))}
					</ul>
				) : (
					<p className="mt-2 text-sm text-zinc-500">{t('queryEmpty')}</p>
				)}
			</section>

			<section>
				<p className={ASI_SECTION_KICKER}>{t('whyKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{t('whyTitle')}</h2>
				<p className="mt-1 text-sm text-zinc-500">{t('whyHint')}</p>
				{whyTheyWin.length ? (
					<ol className="mt-3 flex flex-col gap-2">
						{whyTheyWin.map((item, index) => (
							<li key={`${item.id}-${index}`} className={`${ASI_CARD} px-4 py-3`}>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<p className="font-semibold">
										{index + 1}. {t(`kind.${item.id}`)} {formatGap(item.delta, item.unit)}
									</p>
									<AsiProvenanceBadge badge={item.provenance === 'observed' ? 'observed' : 'redue_analysis'} />
								</div>
								<p className="mt-2 break-all text-sm text-zinc-500">
									{item.evidence.length ? item.evidence.slice(0, 3).join(' · ') : t('noEvidence')}
								</p>
							</li>
						))}
					</ol>
				) : (
					<p className="mt-2 text-sm text-zinc-500">{t('whyEmpty')}</p>
				)}
			</section>

			<section>
				<p className={ASI_SECTION_KICKER}>{t('topKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
					<AsiMetricHeading metric="gapScore" label={t('topTitle')} />
				</h2>
				{top.length ? (
					<ol className="mt-3 flex flex-col gap-3">
						{top.map((row) => (
							<li key={row.id} className={`${ASI_CARD} px-4 py-4`}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t(`kind.${row.kind}`)}</p>
										<p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">
											{row.competitor}
											{row.query ? ` · ${row.query}` : ''}
										</p>
									</div>
									<AsiScore value={row.impact} metric="gapScore" label={t('impact')} />
								</div>
								<dl className="mt-3 grid gap-2 text-sm">
									<div>
										<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('why')}</dt>
										<dd className="mt-1">{row.why}</dd>
									</div>
									<div>
										<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('evidence')}</dt>
										<dd className="mt-1 break-all">{row.evidence.length ? row.evidence.slice(0, 3).join(' · ') : t('noEvidence')}</dd>
									</div>
									<div>
										<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('action')}</dt>
										<dd className="mt-1 font-semibold">{row.recommendedAction}</dd>
									</div>
								</dl>
							</li>
						))}
					</ol>
				) : (
					<p className="mt-2 text-sm text-zinc-500">{t('topEmpty')}</p>
				)}
			</section>

			<div className="flex flex-wrap gap-2">
				<Link href="/intelligence/next-best-action" className={ASI_CTA}>
					{t('ctaAction')}
				</Link>
				<Link href="/intelligence/evidence-explorer" className={ASI_CTA}>
					{t('ctaEvidence')}
				</Link>
			</div>
		</div>
	);
}
