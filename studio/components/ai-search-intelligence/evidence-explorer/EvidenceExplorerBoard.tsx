'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AsiAnswerResult } from '@/components/ai-search-intelligence/primitives/AsiAnswerResult';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiEmptyState } from '@/components/ai-search-intelligence/primitives/AsiEmptyState';
import { AsiObservationEmpty } from '@/components/ai-search-intelligence/primitives/AsiObservationEmpty';
import { ASI_COMPETITOR_MIN_SAMPLE, resolveAsiObservationState } from '@/lib/ai-search-intelligence/observation-state';
import { AsiFilterChip } from '@/components/ai-search-intelligence/primitives/AsiFilterChip';
import { AsiFilterTabList } from '@/components/ai-search-intelligence/primitives/AsiFilterTabList';
import { AsiMetricHeading } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiClipBanner } from '@/components/ai-search-intelligence/entitlement/AsiClipBanner';
import { AsiSystemQuestion } from '@/components/ai-search-intelligence/system/AsiSystemQuestion';
import { AsiLoopNav } from '@/components/ai-search-intelligence/shell/AsiLoopNav';
import { citationDomain } from '@/lib/ai-search-intelligence/citations/classify';
import { ASI_BADGE, ASI_CARD, ASI_CTA, ASI_SECTION_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';
import type {
	AsiEvidenceAnswerTrace,
	AsiEvidenceExplorerSnapshot,
	AsiEvidenceSourceType,
	AsiEvidenceWhyFact,
} from '@/lib/ai-search-intelligence/types';

function engineLabel(id: AsiEvidenceAnswerTrace['provider']) {
	if (id === 'chatgpt') return 'OpenAI';
	if (id === 'gemini') return 'Gemini';
	if (id === 'perplexity') return 'Perplexity';
	return 'Anthropic';
}

function WhyList({
	title,
	badge,
	facts,
	empty,
	labelFor,
}: {
	title: string;
	badge: 'observed' | 'redue_analysis';
	facts: AsiEvidenceWhyFact[];
	empty: string;
	labelFor: (id: AsiEvidenceWhyFact['id']) => string;
}) {
	return (
		<AsiCard>
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
				<AsiProvenanceBadge badge={badge} />
			</div>
			{facts.length ? (
				<ul className="mt-3 flex flex-col gap-2">
					{facts.map((fact) => (
						<li key={fact.id} className="text-sm text-zinc-700 dark:text-zinc-200">
							{fact.provenance === 'observed' ? '✓' : '△'} {labelFor(fact.id)}
						</li>
					))}
				</ul>
			) : (
				<p className="mt-3 text-sm text-zinc-500">{empty}</p>
			)}
		</AsiCard>
	);
}

export function EvidenceExplorerBoard({ snapshot }: { snapshot: AsiEvidenceExplorerSnapshot }) {
	const t = useTranslations('intelligence.explorer');
	const tSys = useTranslations('intelligence.system');
	const [selectedId, setSelectedId] = useState(snapshot.answers[0]?.id || '');
	const [competitorName, setCompetitorName] = useState(snapshot.competitors[0]?.name || '');

	const selected = snapshot.answers.find((row) => row.id === selectedId) ?? snapshot.answers[0] ?? null;
	const competitor = snapshot.competitors.find((row) => row.name === competitorName) ?? snapshot.competitors[0] ?? null;

	const sourceTypes = useMemo(() => {
		const seen = new Set<AsiEvidenceSourceType>();
		for (const row of snapshot.sources) seen.add(row.sourceType);
		return [...seen];
	}, [snapshot.sources]);

	return (
		<div className="flex flex-col gap-6">
			<AsiSystemQuestion
				question="why"
				answer={tSys('answer.why', { answers: snapshot.summary.answers, evidence: snapshot.summary.withEvidence })}
			/>
			<AsiLoopNav current="explain" />
			<section aria-label={t('summaryAria')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
				{(
					[
						['answers', snapshot.summary.answers],
						['withEvidence', snapshot.summary.withEvidence],
						['unavailable', snapshot.summary.unavailable],
						['brandCitations', snapshot.summary.brandCitations],
						['competitorCitations', snapshot.summary.competitorCitations],
					] as const
				).map(([key, count]) => (
					<article key={key} className={`${ASI_CARD} px-4 py-4`}>
						<p className={ASI_SECTION_KICKER}>{t(`summary.${key}`)}</p>
						<p className="mt-2 text-3xl font-black tabular-nums text-zinc-900 dark:text-zinc-50">{count}</p>
					</article>
				))}
			</section>

			<section>
				<p className={ASI_SECTION_KICKER}>{t('answerKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
					<AsiMetricHeading metric="actualAnswer" label={t('answerTitle')} />
				</h2>
				<ul className="mt-3 flex flex-col gap-2">
					{snapshot.answers.map((row) => (
						<li key={row.id}>
							<button
								type="button"
								onClick={() => setSelectedId(row.id)}
								className={`${ASI_CARD} ${asiFocusRing('flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left')} ${
									selectedId === row.id ? 'border-cyan-400/70' : ''
								}`}
							>
								<div className="min-w-0">
									<p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{row.query}</p>
									<p className="mt-1 text-xs text-zinc-500">
										{engineLabel(row.provider)} · {new Date(row.timestamp).toLocaleString()}
									</p>
								</div>
								<span className={ASI_BADGE}>
									{row.evidenceAvailable ? t('evidenceReady') : t('unavailableBadge')}
								</span>
							</button>
						</li>
					))}
				</ul>
			</section>

			{selected ? (
				<section className="flex flex-col gap-4">
					<AsiAnswerResult
						engine={selected.provider}
						snippet={selected.answer || t('emptyAnswer')}
						mentionType={selected.brandRecommended ? 'recommended' : selected.brandMentioned ? 'simple_mention' : 'none'}
						source={selected.source}
						fallback={selected.fallback}
						error={selected.error}
					/>

					<AsiCard>
						<div className="flex items-center justify-between gap-3">
							<h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t('parseTitle')}</h3>
							<AsiProvenanceBadge badge="observed" />
						</div>
						<dl className="mt-3 grid gap-2 sm:grid-cols-2">
							<div>
								<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('parseBrand')}</dt>
								<dd className="mt-1 text-sm font-semibold">{selected.brandMentioned ? t('parseYes') : t('parseNo')}</dd>
							</div>
							<div>
								<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('parseRecommend')}</dt>
								<dd className="mt-1 text-sm font-semibold">{selected.brandRecommended ? t('parseYes') : t('parseNo')}</dd>
							</div>
							<div className="sm:col-span-2">
								<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('parseCompetitors')}</dt>
								<dd className="mt-1 text-sm font-semibold">
									{selected.competitors.length ? selected.competitors.join(', ') : t('noCompetitor')}
								</dd>
							</div>
							<div className="sm:col-span-2">
								<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('parseCitations')}</dt>
								<dd className="mt-1 break-all text-sm font-semibold">
									{selected.citations.length
										? selected.citations.map((url) => citationDomain(url) || url).join(' · ')
										: t('unavailable')}
								</dd>
							</div>
						</dl>
					</AsiCard>

					<div>
						<p className={ASI_SECTION_KICKER}>{t('whyKicker')}</p>
						<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{t('whyTitle')}</h2>
						<p className="mt-1 text-sm text-zinc-500">{t('whyHint')}</p>
						<div className="mt-3 grid gap-3 lg:grid-cols-2">
							<WhyList
								title={t('observedTitle')}
								badge="observed"
								facts={selected.whyObserved}
								empty={t('observedEmpty')}
								labelFor={(id) => t(`why.${id}`)}
							/>
							<WhyList
								title={t('derivedTitle')}
								badge="redue_analysis"
								facts={selected.whyDerived}
								empty={t('derivedEmpty')}
								labelFor={(id) => t(`why.${id}`)}
							/>
						</div>
					</div>

					<div>
						<p className={ASI_SECTION_KICKER}>{t('traceKicker')}</p>
						<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
							<AsiMetricHeading metric="actualCitation" label={t('traceTitle')} />
						</h2>
						{selected.evidenceAvailable ? (
							<ol className="mt-3 flex flex-col gap-3">
								{selected.traces.map((step, index) => (
									<li key={`${selected.id}-${step.citation || index}`} className={`${ASI_CARD} px-4 py-4`}>
										<p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{index + 1}</p>
										<dl className="mt-2 grid gap-2 sm:grid-cols-2">
											<div>
												<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('trace.citation')}</dt>
												<dd className="mt-1 break-all text-sm font-semibold">{step.citation || t('unavailable')}</dd>
											</div>
											<div>
												<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('trace.source')}</dt>
												<dd className="mt-1 text-sm font-semibold">
													{step.sourceType ? t(`sourceType.${step.sourceType}`) : t('unavailable')}
												</dd>
											</div>
											<div>
												<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('trace.relatedPage')}</dt>
												<dd className="mt-1 break-all text-sm font-semibold">{step.relatedPage || t('unavailable')}</dd>
											</div>
											<div>
												<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('trace.brand')}</dt>
												<dd className="mt-1 text-sm font-semibold">{step.brandEntity || t('unavailable')}</dd>
											</div>
											<div className="sm:col-span-2">
												<dt className="text-xs font-bold uppercase tracking-wider text-zinc-400">{t('trace.competitor')}</dt>
												<dd className="mt-1 text-sm font-semibold">
													{step.competitorEntities.length ? step.competitorEntities.join(', ') : t('unavailable')}
												</dd>
											</div>
										</dl>
									</li>
								))}
							</ol>
						) : (
							<div className="mt-3">
								<AsiEmptyState title={t('unavailable')} body={t('unavailableBody')} />
							</div>
						)}
					</div>
				</section>
			) : null}

			<section>
				<p className={ASI_SECTION_KICKER}>{t('sourceKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
					<AsiMetricHeading metric="citationCount" label={t('sourceTitle')} />
				</h2>
				{sourceTypes.length ? (
					<div className="mt-2 flex flex-wrap gap-2" aria-label={t('sourceFilterAria')}>
						{sourceTypes.map((id) => (
							<span key={id} className={ASI_BADGE}>
								{t(`sourceType.${id}`)}
							</span>
						))}
					</div>
				) : null}
				{snapshot.sources.length ? (
					<ul className="mt-3 flex flex-col gap-2">
						{snapshot.sources.map((row) => (
							<li key={row.url} className={`${ASI_CARD} px-4 py-3`}>
								<p className="break-all text-sm font-semibold text-zinc-900 dark:text-zinc-50">{row.url}</p>
								<p className="mt-1 text-xs text-zinc-500">
									{t(`sourceType.${row.sourceType}`)} · {row.citedBy.join(', ')}
									{row.entity ? ` · ${row.entity}` : ''}
								</p>
							</li>
						))}
					</ul>
				) : (
					<div className="mt-3">
						<AsiEmptyState title={t('unavailable')} body={t('unavailableBody')} />
					</div>
				)}
			</section>

			<section>
				<p className={ASI_SECTION_KICKER}>{t('compareKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{t('compareTitle')}</h2>
				{(() => {
					const observationState =
						snapshot.summary.observationState ??
						resolveAsiObservationState({
							analyzed: snapshot.source === 'live' || (snapshot.summary.validResponseCount ?? snapshot.summary.answers) > 0,
							validResponseCount: snapshot.summary.validResponseCount ?? snapshot.summary.answers,
							competitorCount: snapshot.competitors.length,
						});
					if (observationState !== 'COMPETITORS_FOUND') {
						return (
							<AsiObservationEmpty
								state={observationState}
								coverage={{
									queryCount: snapshot.summary.queryCount ?? snapshot.summary.answers,
									validResponseCount: snapshot.summary.validResponseCount ?? snapshot.summary.answers,
									minSample: ASI_COMPETITOR_MIN_SAMPLE,
								}}
							/>
						);
					}
					return (
						<AsiFilterTabList label={t('competitorAria')}>
							{snapshot.competitors.map((row) => (
								<AsiFilterChip key={row.name} active={row.name === competitor?.name} onClick={() => setCompetitorName(row.name)}>
									{row.name}
								</AsiFilterChip>
							))}
						</AsiFilterTabList>
					);
				})()}
				<div className="mt-3 grid gap-3 lg:grid-cols-2">
					<AsiCard>
						<p className={ASI_SECTION_KICKER}>{t('ourBrand')}</p>
						<h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{snapshot.brand.name}</h3>
						<dl className="mt-3 grid gap-2">
							<div className="flex justify-between text-sm">
								<dt>{t('compare.citations')}</dt>
								<dd className="font-bold tabular-nums">{snapshot.brand.citations}</dd>
							</div>
							<div className="flex justify-between text-sm">
								<dt>{t('compare.relevantPages')}</dt>
								<dd className="font-bold tabular-nums">{snapshot.brand.relevantPages}</dd>
							</div>
							<div className="flex justify-between text-sm">
								<dt>{t('compare.externalSources')}</dt>
								<dd className="font-bold tabular-nums">{snapshot.brand.externalSources}</dd>
							</div>
						</dl>
					</AsiCard>
					<AsiCard>
						<p className={ASI_SECTION_KICKER}>{t('theirBrand')}</p>
						<h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{competitor?.name || t('noneInAnswer')}</h3>
						{competitor ? (
							<dl className="mt-3 grid gap-2">
								<div className="flex justify-between text-sm">
									<dt>{t('compare.citations')}</dt>
									<dd className="font-bold tabular-nums">{competitor.citations}</dd>
								</div>
								<div className="flex justify-between text-sm">
									<dt>{t('compare.relevantPages')}</dt>
									<dd className="font-bold tabular-nums">{competitor.relevantPages}</dd>
								</div>
								<div className="flex justify-between text-sm">
									<dt>{t('compare.externalSources')}</dt>
									<dd className="font-bold tabular-nums">{competitor.externalSources}</dd>
								</div>
							</dl>
						) : (
							<p className="mt-3 text-sm text-zinc-500">{t('unavailable')}</p>
						)}
					</AsiCard>
				</div>
			</section>

			<div className="flex flex-wrap gap-2">
				<Link href="/intelligence/competitor-gap" className={ASI_CTA}>
					{t('ctaGap')}
				</Link>
				<Link href="/intelligence/next-best-action" className={ASI_CTA}>
					{t('ctaAction')}
				</Link>
			</div>
			<AsiClipBanner kind="evidence" />
		</div>
	);
}
