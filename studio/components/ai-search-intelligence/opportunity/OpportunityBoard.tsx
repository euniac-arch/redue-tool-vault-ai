'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AsiAnswerResult } from '@/components/ai-search-intelligence/primitives/AsiAnswerResult';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiFilterChip } from '@/components/ai-search-intelligence/primitives/AsiFilterChip';
import { AsiFilterTabList } from '@/components/ai-search-intelligence/primitives/AsiFilterTabList';
import { AsiMetricHeading } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiClipBanner } from '@/components/ai-search-intelligence/entitlement/AsiClipBanner';
import { AsiSystemQuestion } from '@/components/ai-search-intelligence/system/AsiSystemQuestion';
import { AsiLoopNav } from '@/components/ai-search-intelligence/shell/AsiLoopNav';
import { ASI_BADGE, ASI_CARD, ASI_CTA, ASI_SECTION_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';
import type { AsiOpportunitySnapshot, AsiOpportunityStatus } from '@/lib/ai-search-intelligence/types';

const STATUS_TONE: Record<AsiOpportunityStatus, string> = {
	win: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
	compete:
		'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
	miss: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
};

type FilterId = 'all' | AsiOpportunityStatus | 'opportunity';

export function OpportunityBoard({ snapshot }: { snapshot: AsiOpportunitySnapshot }) {
	const t = useTranslations('intelligence.opportunity');
	const [filter, setFilter] = useState<FilterId>('all');
	const [selectedId, setSelectedId] = useState(snapshot.top[0]?.queryId || snapshot.rows[0]?.queryId || '');

	const rows = useMemo(() => {
		if (filter === 'all') return snapshot.rows;
		if (filter === 'opportunity') return snapshot.rows.filter((row) => row.isOpportunity);
		return snapshot.rows.filter((row) => row.status === filter);
	}, [filter, snapshot.rows]);

	const selected = snapshot.rows.find((row) => row.queryId === selectedId) ?? rows[0] ?? null;
	const filters: FilterId[] = ['all', 'win', 'compete', 'miss', 'opportunity'];

	const tSys = useTranslations('intelligence.system');

	return (
		<div className="flex flex-col gap-6">
			<AsiSystemQuestion
				question="changed"
				answer={tSys('answer.opportunity', { total: snapshot.summary.total, open: snapshot.summary.opportunity })}
			/>
			<AsiLoopNav current="discover" />
			<section aria-label={t('summaryAria')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
				<article className={`${ASI_CARD} px-4 py-4`}>
					<p className={ASI_SECTION_KICKER}>{t('totalKicker')}</p>
					<p className="mt-2 text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{snapshot.summary.total}</p>
					<p className="mt-1 text-sm text-zinc-500">{t('totalLabel')}</p>
				</article>
				{(
					[
						['win', snapshot.summary.win],
						['compete', snapshot.summary.compete],
						['miss', snapshot.summary.miss],
						['opportunity', snapshot.summary.opportunity],
					] as const
				).map(([key, count]) => (
					<article key={key} className={`${ASI_CARD} px-4 py-4`}>
						<p className={ASI_SECTION_KICKER}>{t(`status.${key}`)}</p>
						<p className="mt-2 text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{count}</p>
						<p className="mt-1 text-sm text-zinc-500">{t(`statusHint.${key}`)}</p>
					</article>
				))}
			</section>

			<section>
				<p className={ASI_SECTION_KICKER}>{t('topKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
					<AsiMetricHeading metric="opportunityScore" label={t('topTitle')} />
				</h2>
				<ol className="mt-3 flex flex-col gap-2">
					{snapshot.top.length ? (
						snapshot.top.map((row, index) => (
							<li key={row.queryId}>
								<button
									type="button"
									onClick={() => setSelectedId(row.queryId)}
									className={`${ASI_CARD} ${asiFocusRing('w-full px-4 py-3 text-left')} ${
										selectedId === row.queryId ? 'border-cyan-400/70' : ''
									}`}
								>
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div>
											<p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{index + 1}</p>
											<p className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">{row.query}</p>
										</div>
										<AsiScore value={row.score} metric="opportunityScore" label={t('scoreLabel')} />
									</div>
								</button>
							</li>
						))
					) : (
						<p className="text-sm text-zinc-500">{t('topEmpty')}</p>
					)}
				</ol>
			</section>

			<section>
				<AsiFilterTabList label={t('filterAria')}>
					{filters.map((id) => (
						<AsiFilterChip key={id} active={filter === id} onClick={() => setFilter(id)}>
							{t(`filter.${id}`)}
						</AsiFilterChip>
					))}
				</AsiFilterTabList>
				<ul className="mt-3 flex flex-col gap-2">
					{rows.map((row) => (
						<li key={row.queryId}>
							<button
								type="button"
								onClick={() => setSelectedId(row.queryId)}
								className={`${ASI_CARD} ${asiFocusRing('flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left')} ${
									selectedId === row.queryId ? 'border-cyan-400/70' : ''
								}`}
							>
								<div className="min-w-0">
									<p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{row.query}</p>
									<p className="mt-1 text-xs text-zinc-500">{t(`intent.${row.intent}`)}</p>
								</div>
								<span className={`${ASI_BADGE} ${STATUS_TONE[row.status]}`}>{t(`status.${row.status}`)}</span>
							</button>
						</li>
					))}
				</ul>
			</section>

			{selected ? (
				<section className="flex flex-col gap-4">
					<p className={ASI_SECTION_KICKER}>{t('detailKicker')}</p>
					<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
						<AsiMetricHeading metric="actualAnswer" label={t('detailTitle')} />
					</h2>
					<AsiCard>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{selected.query}</h3>
								<div className="mt-2 flex flex-wrap gap-2">
									<span className={`${ASI_BADGE} ${STATUS_TONE[selected.status]}`}>{t(`status.${selected.status}`)}</span>
									<AsiProvenanceBadge badge="observed" />
									<AsiProvenanceBadge badge="estimated" />
								</div>
							</div>
							<AsiScore value={selected.score} metric="opportunityScore" label={t('scoreLabel')} />
						</div>
						<p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{selected.reason}</p>
						<dl className="mt-4 grid gap-3 sm:grid-cols-2">
							<div>
								<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('brandMention')}</dt>
								<dd className="mt-1 text-sm font-semibold">
									{selected.brandMentioned ? t('yes') : t('no')} · {Math.round(selected.mentionRate * 100)}%
								</dd>
							</div>
							<div>
								<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('recommended')}</dt>
								<dd className="mt-1 text-sm font-semibold">
									{selected.brandRecommended ? t('yes') : t('no')} · {Math.round(selected.recommendationRate * 100)}%
								</dd>
							</div>
							<div>
								<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('competitors')}</dt>
								<dd className="mt-1 text-sm font-semibold">
									{selected.competitors.length ? selected.competitors.join(', ') : t('noneInAnswer')}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('citations')}</dt>
								<dd className="mt-1 text-sm font-semibold">
									{selected.citations.length ? selected.citations.slice(0, 3).join(' · ') : t('noCitation')}
								</dd>
							</div>
						</dl>
					</AsiCard>

					<div className="grid gap-3 lg:grid-cols-2">
						{selected.engines.map((engine) => (
							<AsiAnswerResult
								key={`${selected.queryId}-${engine.engine}`}
								engine={engine.engine}
								snippet={engine.answer || t('emptyAnswer')}
								mentionType={engine.recommended ? 'recommended' : engine.mentioned ? 'simple_mention' : 'none'}
								source={engine.source}
								fallback={engine.fallback}
								error={engine.error}
							/>
						))}
					</div>

					<div className="flex flex-wrap gap-2">
						<Link href="/intelligence/evidence-explorer" className={ASI_CTA}>
							{t('ctaEvidence')}
						</Link>
						<Link href="/intelligence/competitor-gap" className={ASI_CTA}>
							{t('ctaCompare')}
						</Link>
						<Link href="/intelligence/next-best-action" className={ASI_CTA}>
							{t('ctaAction')}
						</Link>
					</div>
				</section>
			) : null}
			<AsiClipBanner kind="opportunity" />
		</div>
	);
}
