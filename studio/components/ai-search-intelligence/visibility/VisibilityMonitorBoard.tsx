'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiFilterChip } from '@/components/ai-search-intelligence/primitives/AsiFilterChip';
import { AsiFilterTabList } from '@/components/ai-search-intelligence/primitives/AsiFilterTabList';
import { AsiMetricHeading } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiMonitorChart } from '@/components/ai-search-intelligence/primitives/AsiSovChart';
import { AsiLockPanel } from '@/components/ai-search-intelligence/entitlement/AsiLockPanel';
import { AsiSystemQuestion } from '@/components/ai-search-intelligence/system/AsiSystemQuestion';
import { AsiLoopNav } from '@/components/ai-search-intelligence/shell/AsiLoopNav';
import { canAccessFeature } from '@/lib/ai-search-intelligence/entitlement';
import { useAsiActor } from '@/lib/ai-search-intelligence/entitlement/use-asi-actor';
import { ASI_BADGE, ASI_CARD, ASI_CTA, ASI_SECTION_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';
import type { AsiMetricId } from '@/lib/ai-search-intelligence/provenance';
import type {
	AsiVisibilityCadence,
	AsiVisibilityDelta,
	AsiVisibilityKpiId,
	AsiVisibilityMonitorSnapshot,
	AsiVisibilityWindow,
} from '@/lib/ai-search-intelligence/types';
import { ASI_VISIBILITY_WINDOWS } from '@/lib/ai-search-intelligence/types';

const KPI_METRIC: Record<AsiVisibilityKpiId, AsiMetricId> = {
	visibility: 'visibilityScore',
	recommendation: 'recommendationRate',
	citation: 'citationCount',
	sov: 'shareOfVoice',
};

const SERIES = [
	{ key: 'visibilityScore', color: '#059669' },
	{ key: 'recommendationRate', color: '#7c3aed' },
	{ key: 'shareOfVoice', color: '#f59e0b' },
	{ key: 'citationCount', color: '#64748b' },
] as const;

const PROVIDER_LABEL: Record<string, string> = {
	chatgpt: 'OpenAI',
	gemini: 'Gemini',
	perplexity: 'Perplexity',
	claude: 'Anthropic',
};

function signed(value: number | null, suffix = ''): string {
	if (value == null) return '—';
	const prefix = value > 0 ? '+' : '';
	return `${prefix}${value}${suffix}`;
}

function DeltaLine({ delta, vsLabel }: { delta: AsiVisibilityDelta; vsLabel: string }) {
	if (delta.change == null) {
		return <p className="mt-2 text-xs text-zinc-500">{vsLabel}</p>;
	}
	const up = delta.change >= 0;
	return (
		<p className={`mt-2 text-sm font-bold ${up ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
			{delta.changePct != null ? signed(delta.changePct, '%') : signed(delta.change)}
			<span className="ml-2 text-xs font-medium text-zinc-500">{vsLabel}</span>
		</p>
	);
}

export function VisibilityMonitorBoard({
	snapshot,
	onEnroll,
}: {
	snapshot: AsiVisibilityMonitorSnapshot;
	onEnroll?: (cadence: Exclude<AsiVisibilityCadence, 'on_demand'>) => void;
}) {
	const t = useTranslations('intelligence.monitor');
	const tSys = useTranslations('intelligence.system');
	const { actor } = useAsiActor();
	const canMonitor = canAccessFeature(actor, 'visibility.monitor');
	const canAlert = canAccessFeature(actor, 'visibility.alert');
	const canSchedule = canAccessFeature(actor, 'visibility.schedule');
	const [window, setWindow] = useState<AsiVisibilityWindow>('today');
	const trend = snapshot.trends[canMonitor ? window : 'today'];
	const kpis: AsiVisibilityKpiId[] = ['visibility', 'recommendation', 'citation', 'sov'];

	const vis = trend.kpis.visibility;
	const workedAnswer =
		vis.change != null
			? tSys('answer.worked', { delta: vis.change > 0 ? `+${vis.change}` : String(vis.change) })
			: tSys('answer.workedEmpty');

	return (
		<div className="flex flex-col gap-6">
			<AsiSystemQuestion question="worked" answer={workedAnswer} />
			<AsiLoopNav current="monitor" />
			<div className="flex flex-wrap items-center justify-between gap-3">
				<AsiFilterTabList label={t('rangeAria')}>
					{(canMonitor ? ASI_VISIBILITY_WINDOWS : (['today'] as const)).map((item) => (
						<AsiFilterChip key={item} active={window === item} onClick={() => setWindow(item)}>
							{t(`range.${item}`)}
						</AsiFilterChip>
					))}
				</AsiFilterTabList>
				{canSchedule ? (
					<div className="flex flex-wrap gap-2">
						{(['daily', 'weekly', 'monthly'] as const).map((cadence) => (
							<button
								key={cadence}
								type="button"
								onClick={() => onEnroll?.(cadence)}
								className={`${asiFocusRing(ASI_BADGE)} ${
									snapshot.enrolled === cadence ? 'border-cyan-400/70 text-cyan-700 dark:text-cyan-200' : ''
								}`}
							>
								{t(`cadence.${cadence}`)}
							</button>
						))}
					</div>
				) : null}
			</div>

			{snapshot.reused ? <p className="text-xs text-zinc-500">{t('reused')}</p> : null}

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{kpis.map((id) => {
					const delta = trend.kpis[id];
					return (
						<article key={id} className={`${ASI_CARD} px-4 py-4`}>
							<div className="flex items-start justify-between gap-2">
								<AsiScore
									value={delta.current ?? 0}
									label={t(`kpi.${id}`)}
									metric={KPI_METRIC[id]}
									size="sm"
									showGrade={id === 'visibility'}
								/>
								<AsiProvenanceBadge badge="observed" />
							</div>
							<DeltaLine
								delta={delta}
								vsLabel={trend.hasPrevious ? t('vsPrevious') : t('noPrevious')}
							/>
							{delta.previous != null ? (
								<p className="mt-1 text-xs text-zinc-500">
									{t('current')} {delta.current} · {t('previous')} {delta.previous} · {t('change')}{' '}
									{signed(delta.change)}
								</p>
							) : null}
						</article>
					);
				})}
			</section>

			<div id="asi-trend">
			<AsiCard
				kicker={t('trendKicker')}
				title={t('trendTitle')}
				meta={t('trendMeta')}
				provenance="observed"
				badge="observed"
				metric="visibilityScore"
			>
				{trend.points.length ? (
					<AsiMonitorChart
						rows={trend.points.map((point) => ({
							name: point.label,
							mention: point.mention,
							recommendationRate: point.recommendationRate,
							shareOfVoice: point.shareOfVoice,
							citationCount: point.citationCount,
							visibilityScore: point.visibilityScore,
						}))}
						keys={SERIES.map((item) => ({ key: item.key, color: item.color }))}
					/>
				) : (
					<p className="text-sm text-zinc-500">{t('noHistory')}</p>
				)}
			</AsiCard>
			</div>

			<section className="grid gap-4 lg:grid-cols-2">
				<AsiCard kicker={t('providerKicker')} title={t('providerTitle')}>
					<ul className="flex flex-col gap-3">
						{trend.providers.map((row) => (
							<li key={row.engine} className="flex items-center justify-between gap-3 text-sm">
								<span className="font-semibold">{PROVIDER_LABEL[row.engine] ?? row.engine}</span>
								<span className="tabular-nums text-zinc-500">
									{row.previous ?? '—'} → {row.current ?? '—'}{' '}
									<span className={row.change != null && row.change < 0 ? 'text-rose-600' : 'text-emerald-600'}>
										{signed(row.change)}
									</span>
								</span>
							</li>
						))}
					</ul>
				</AsiCard>
				<AsiCard kicker={t('competitorKicker')} title={t('competitorTitle')}>
					<ul className="flex flex-col gap-3">
						{trend.competitors.map((row) => (
							<li key={`${row.kind}:${row.name}`} className="flex items-center justify-between gap-3 text-sm">
								<span className="font-semibold">
									{row.kind === 'brand' ? t('us') : row.name}
								</span>
								<span className="tabular-nums text-zinc-500">
									{row.previous ?? '—'} → {row.current ?? '—'}
								</span>
							</li>
						))}
					</ul>
					{trend.gap.widened && trend.gap.competitorName ? (
						<p className="mt-3 text-sm font-bold text-rose-600 dark:text-rose-300">
							{t('gapWidened', { name: trend.gap.competitorName })}
						</p>
					) : null}
				</AsiCard>
			</section>

			{!canMonitor ? <AsiLockPanel feature="visibility.monitor" tier={actor.tier} /> : null}

			<section id="asi-alerts">
				{!canAlert ? (
					<AsiLockPanel feature="visibility.alert" tier={actor.tier} />
				) : (
					<>
				<p className={ASI_SECTION_KICKER}>{t('alertKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
					<AsiMetricHeading metric="visibilityScore" label={t('alertTitle')} />
				</h2>
				{snapshot.alerts.length ? (
					<ul className="mt-3 flex flex-col gap-3">
						{snapshot.alerts.map((alert) => (
							<li key={alert.id} className={`${ASI_CARD} px-4 py-4`}>
								<div className="flex flex-wrap items-start justify-between gap-2">
									<div>
										<p className="text-base font-bold text-zinc-900 dark:text-zinc-50">{alert.title}</p>
										<p className="mt-1 text-sm text-zinc-500">{t(`windowHint.${alert.window}`)}</p>
										<p className="mt-2 text-lg font-black tabular-nums">
											{alert.previousValue} → {alert.currentValue}{' '}
											<span className="text-rose-600">{signed(alert.change)}</span>
										</p>
									</div>
									<div className="flex flex-col items-end gap-1">
										<AsiProvenanceBadge badge="observed" />
										<span className={ASI_BADGE}>{alert.severity}</span>
									</div>
								</div>
								<p className={`mt-3 text-xs font-bold uppercase tracking-wider text-zinc-400`}>{t('causes')}</p>
								<ul className="mt-1 flex flex-col gap-1">
									{alert.causes.length ? (
										alert.causes.map((item) => (
											<li key={item.text} className="flex items-center gap-2 text-sm">
												<AsiProvenanceBadge badge="redue_analysis" />
												{item.text}
											</li>
										))
									) : (
										<li className="text-sm text-zinc-500">{t('noCause')}</li>
									)}
								</ul>
								<div className="mt-3">
									<Link href={alert.href} className={ASI_CTA}>
										{t('analyzeCause')}
									</Link>
								</div>
							</li>
						))}
					</ul>
				) : (
					<p className="mt-2 text-sm text-zinc-500">{t('alertEmpty')}</p>
				)}
					</>
				)}
			</section>

			<div className="flex flex-wrap gap-2">
				<Link href="#asi-trend" className={ASI_CTA}>
					{t('ctaTrack')}
				</Link>
				<Link href="/intelligence" className={ASI_CTA}>
					{t('ctaDashboard')}
				</Link>
				<Link href="/intelligence/opportunity-finder" className={ASI_CTA}>
					{t('ctaAgain')}
				</Link>
			</div>
		</div>
	);
}
