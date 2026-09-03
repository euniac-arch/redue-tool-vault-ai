'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiMetricHeading } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiSystemQuestion } from '@/components/ai-search-intelligence/system/AsiSystemQuestion';
import { AsiLoopNav } from '@/components/ai-search-intelligence/shell/AsiLoopNav';
import { ASI_BADGE, ASI_CARD, ASI_CTA, ASI_SECTION_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';
import type { AsiActionTier, AsiNextAction, AsiNextActionSnapshot } from '@/lib/ai-search-intelligence/types';

const TIER_TONE: Record<AsiActionTier, string> = {
	high: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
	medium:
		'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
	low: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300',
};

function TierBadge({
	label,
	tier,
	tierLabel,
	tone,
}: {
	label: string;
	tier: AsiActionTier;
	tierLabel: string;
	tone?: AsiActionTier;
}) {
	return (
		<span className={`${ASI_BADGE} ${TIER_TONE[tone ?? tier]}`}>
			{label} {tierLabel}
		</span>
	);
}

export function NextActionBoard({ snapshot }: { snapshot: AsiNextActionSnapshot }) {
	const t = useTranslations('intelligence.action');
	const tSys = useTranslations('intelligence.system');
	const [selectedId, setSelectedId] = useState(snapshot.top[0]?.id || snapshot.actions[0]?.id || '');
	const selected = snapshot.actions.find((row) => row.id === selectedId) ?? snapshot.actions[0] ?? null;

	return (
		<div className="flex flex-col gap-6">
			<AsiSystemQuestion
				question="do"
				answer={
					selected
						? tSys('answer.do', { action: selected.title, high: snapshot.summary.highImpact })
						: tSys('answer.doEmpty')
				}
			/>
			<AsiLoopNav current="act" />
			<section aria-label={t('summaryAria')} className="grid gap-3 sm:grid-cols-3">
				{(
					[
						['total', snapshot.summary.total],
						['high', snapshot.summary.highImpact],
						['easy', snapshot.summary.lowEffort],
					] as const
				).map(([key, count]) => (
					<article key={key} className={`${ASI_CARD} px-4 py-4`}>
						<p className={ASI_SECTION_KICKER}>{t(`summary.${key}`)}</p>
						<p className="mt-2 text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{count}</p>
					</article>
				))}
			</section>

			<section>
				<p className={ASI_SECTION_KICKER}>{t('topKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
					<AsiMetricHeading metric="estimatedImpact" label={t('topTitle')} />
				</h2>
				{snapshot.top.length ? (
					<ol className="mt-3 flex flex-col gap-3">
						{snapshot.top.map((row, index) => (
							<li key={row.id}>
								<button
									type="button"
									onClick={() => setSelectedId(row.id)}
									className={`${ASI_CARD} ${asiFocusRing('w-full px-4 py-4 text-left')} ${
										selectedId === row.id ? 'border-cyan-400/70' : ''
									}`}
								>
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div>
											<p className="text-xs font-bold uppercase tracking-wider text-zinc-400">#{index + 1}</p>
											<p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">{row.title}</p>
											<p className="mt-1 text-xs text-zinc-500">{t(`kind.${row.kind}`)}</p>
										</div>
										<AsiScore value={row.estimatedImpact} metric="estimatedImpact" label={t('estimatedImpact')} />
									</div>
									<div className="mt-3 flex flex-wrap gap-2">
										<TierBadge
											label={t('priority')}
											tier={row.priorityTier ?? row.impactTier}
											tierLabel={t(`tier.${row.priorityTier ?? row.impactTier}`)}
										/>
										<TierBadge label={t('impact')} tier={row.impactTier} tierLabel={`${t(`tier.${row.impactTier}`)} ${row.impact}`} />
										<TierBadge
											label={t('effort')}
											tier={row.effortTier}
											tierLabel={`${t(`tier.${row.effortTier}`)} ${row.effort}`}
											tone={row.effortTier === 'low' ? 'high' : row.effortTier}
										/>
										<TierBadge
											label={t('confidence')}
											tier={row.confidenceTier}
											tierLabel={`${t(`tier.${row.confidenceTier}`)} ${row.confidence}`}
										/>
									</div>
									<p className="mt-3 text-sm text-zinc-500">
										{t('estimatedHint')} · {t('affectedCount', { count: row.affectedQueries.length })}
									</p>
								</button>
							</li>
						))}
					</ol>
				) : (
					<p className="mt-2 text-sm text-zinc-500">{t('topEmpty')}</p>
				)}
			</section>

			{selected ? <ActionDetail action={selected} siteUrl={snapshot.site.url} /> : null}

			<div className="flex flex-wrap gap-2">
				<Link href="/intelligence/visibility-monitor" className={ASI_CTA}>
					{t('ctaDone')}
				</Link>
				<Link href="/intelligence/competitor-gap" className={ASI_CTA}>
					{t('ctaGap')}
				</Link>
				<Link href="/intelligence/evidence-explorer" className={ASI_CTA}>
					{t('ctaEvidence')}
				</Link>
			</div>
		</div>
	);
}

function ActionDetail({ action, siteUrl }: { action: AsiNextAction; siteUrl: string }) {
	const t = useTranslations('intelligence.action');
	const relatedPage = action.relatedPages.find((page) => page.includes('://')) || siteUrl;
	const auditHref =
		action.auditHref ||
		(relatedPage ? `/audit/result?url=${encodeURIComponent(relatedPage)}` : undefined);
	return (
		<section className="flex flex-col gap-4">
			<p className={ASI_SECTION_KICKER}>{t('detailKicker')}</p>
			<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{t('detailTitle')}</h2>
			<AsiCard>
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{action.title}</h3>
						<div className="mt-2 flex flex-wrap gap-2">
							<span className={ASI_BADGE}>{t(`kind.${action.kind}`)}</span>
							<TierBadge
								label={t('priority')}
								tier={action.priorityTier ?? action.impactTier}
								tierLabel={t(`tier.${action.priorityTier ?? action.impactTier}`)}
							/>
							<AsiProvenanceBadge badge="estimated" />
						</div>
					</div>
					<AsiScore value={action.estimatedImpact} metric="estimatedImpact" label={t('estimatedImpact')} />
				</div>
				<dl className="mt-4 grid gap-4">
					<div className="flex flex-wrap gap-2">
						<TierBadge label={t('impact')} tier={action.impactTier} tierLabel={`${t(`tier.${action.impactTier}`)} ${action.impact}`} />
						<TierBadge
							label={t('effort')}
							tier={action.effortTier}
							tierLabel={`${t(`tier.${action.effortTier}`)} ${action.effort}`}
							tone={action.effortTier === 'low' ? 'high' : action.effortTier}
						/>
						<TierBadge
							label={t('confidence')}
							tier={action.confidenceTier}
							tierLabel={`${t(`tier.${action.confidenceTier}`)} ${action.confidence}`}
						/>
					</div>
					<div>
						<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('why')}</dt>
						<dd className="mt-1 text-sm">{action.why}</dd>
					</div>
					<div>
						<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('evidence')}</dt>
						<dd className="mt-1 break-all text-sm">
							{action.evidence.length ? action.evidence.join(' · ') : t('noEvidence')}
						</dd>
					</div>
					<div>
						<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('queries')}</dt>
						<dd className="mt-1 text-sm">
							{action.affectedQueries.length ? action.affectedQueries.join(' · ') : t('noQueries')}
						</dd>
					</div>
					<div>
						<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('pages')}</dt>
						<dd className="mt-1 break-all text-sm">
							{action.relatedPages.length ? action.relatedPages.join(' · ') : t('noPages')}
						</dd>
					</div>
					<div>
						<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('fix')}</dt>
						<dd className="mt-1 text-sm font-semibold">{action.howToFix}</dd>
					</div>
				</dl>
				{auditHref ? (
					<div className="mt-4">
						<Link href={auditHref} className={ASI_CTA}>
							{t('auditCta')}
						</Link>
					</div>
				) : null}
			</AsiCard>
		</section>
	);
}
