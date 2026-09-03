'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiLoopNav } from '@/components/ai-search-intelligence/shell/AsiLoopNav';
import { AsiMetricHeading } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiSystemQuestion } from '@/components/ai-search-intelligence/system/AsiSystemQuestion';
import { mergeLoopWithSession } from '@/lib/ai-search-intelligence/loop/session';
import { ASI_CARD, ASI_CTA, ASI_SECTION_KICKER } from '@/lib/ui/asi-chrome';
import type { AsiIntelligenceLoop, AsiLoopChanges, AsiLoopLink, AsiWarRoomSnapshot } from '@/lib/ai-search-intelligence/types';

function signed(value: number | null, suffix = ''): string {
	if (value == null) return '—';
	return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

function LoopList({
	title,
	empty,
	href,
	items,
}: {
	title: string;
	empty: string;
	href: string;
	items: AsiLoopLink[];
}) {
	const t = useTranslations('intelligence.loop');
	if (!items.length) {
		return <p className="mt-3 text-sm text-zinc-500">{empty}</p>;
	}
	return (
		<ol className="mt-3 flex flex-col gap-2">
			{items.map((item, index) => (
				<li key={item.id}>
					<Link href={href} className="block text-sm">
						<span className="mr-2 tabular-nums text-zinc-400">#{index + 1}</span>
						<span className="font-semibold text-zinc-800 dark:text-zinc-100">{item.title}</span>
						{item.meta ? <span className="ml-2 text-xs text-zinc-400">{item.meta}</span> : null}
					</Link>
				</li>
			))}
		</ol>
	);
}

function WhatChanged({ changes }: { changes: AsiLoopChanges }) {
	const t = useTranslations('intelligence.system');
	const lines: string[] = [];
	if (changes.queryExposure != null && changes.queryExposure > 0) {
		lines.push(t('changed.queryUp', { count: changes.queryExposure }));
	}
	if (changes.citation != null && changes.citation < 0) {
		lines.push(t('changed.citationDown', { count: Math.abs(changes.citation) }));
	} else if (changes.citation != null && changes.citation > 0) {
		lines.push(t('changed.citationUp', { count: changes.citation }));
	}
	if (changes.competitorName && (changes.competitorChangePct != null || changes.competitorChange != null)) {
		lines.push(
			t('changed.competitorUp', {
				name: changes.competitorName,
				value:
					changes.competitorChangePct != null
						? `${changes.competitorChangePct > 0 ? '+' : ''}${changes.competitorChangePct}%`
						: signed(changes.competitorChange),
			}),
		);
	}

	return (
		<section id="asi-changed" className={`${ASI_CARD} px-5 py-5`}>
			<p className={ASI_SECTION_KICKER}>{t('changed.kicker')}</p>
			<h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{t('changed.title')}</h2>
			<p className="mt-1 text-sm text-zinc-500">{t('changed.since')}</p>
			{changes.hasPrevious && lines.length ? (
				<ul className="mt-4 flex flex-col gap-2">
					{lines.map((line) => (
						<li key={line} className="text-base font-semibold text-zinc-800 dark:text-zinc-100">
							{line}
						</li>
					))}
				</ul>
			) : (
				<p className="mt-4 text-sm text-zinc-500">{t('changed.empty')}</p>
			)}
			<p className="mt-3">
				<AsiProvenanceBadge badge="observed" />
			</p>
		</section>
	);
}

export function WarRoomLoopPanel({
	snapshot,
	siteUrl,
}: {
	snapshot?: AsiWarRoomSnapshot | null;
	siteUrl?: string;
}) {
	const t = useTranslations('intelligence.loop');
	const tSys = useTranslations('intelligence.system');
	const url = snapshot?.site.url || siteUrl || '';
	const loop: AsiIntelligenceLoop = mergeLoopWithSession(snapshot?.loop, url);
	const health = loop.health;
	const scoreAnswer =
		health.change != null
			? tSys('answer.nowDelta', { score: health.current, delta: signed(health.change) })
			: tSys('answer.now', { score: health.current });

	return (
		<div className="flex flex-col gap-6">
			<AsiSystemQuestion question="now" answer={url ? scoreAnswer : tSys('answer.nowEmpty')} />
			<AsiLoopNav current="measure" />
			<section id="asi-now" className={`${ASI_CARD} px-5 py-6`}>
				<p className={ASI_SECTION_KICKER}>{t('healthKicker')}</p>
				<h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
					<AsiMetricHeading metric="visibilityScore" label={t('healthTitle')} />
				</h2>
				<div className="mt-4 flex flex-wrap items-end gap-6">
					<AsiScore value={health.current} label={t('current')} metric="visibilityScore" showGrade size="lg" />
					<div>
						<p
							className={`text-4xl font-black tabular-nums ${
								health.change == null
									? 'text-zinc-400'
									: health.change >= 0
										? 'text-emerald-600 dark:text-emerald-300'
										: 'text-rose-600 dark:text-rose-300'
							}`}
						>
							{signed(health.change)}
						</p>
						<p className="mt-1 text-sm text-zinc-500">{t('vsLast')}</p>
						{health.changeProvenance === 'observed' ? (
							<p className="mt-2">
								<AsiProvenanceBadge badge="observed" />
							</p>
						) : (
							<p className="mt-2 text-xs text-zinc-500">{t('noPrevious')}</p>
						)}
					</div>
				</div>
			</section>

			<WhatChanged changes={loop.changes} />

			<div className="grid gap-4 lg:grid-cols-2">
				<AsiCard>
					<p className={ASI_SECTION_KICKER}>{tSys('cards.why.kicker')}</p>
					<h3 className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">{tSys('cards.why.title')}</h3>
					<p className="mt-1 text-sm text-zinc-500">{tSys('cards.why.body')}</p>
					<LoopList
						title={t('topOpportunity')}
						empty={tSys('cards.why.empty')}
						href="/intelligence/evidence-explorer"
						items={loop.opportunities}
					/>
					<Link href="/intelligence/evidence-explorer" className={`mt-4 inline-flex ${ASI_CTA}`}>
						{tSys('cards.why.cta')}
					</Link>
				</AsiCard>
				<AsiCard>
					<p className={ASI_SECTION_KICKER}>{tSys('cards.who.kicker')}</p>
					<h3 className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">{tSys('cards.who.title')}</h3>
					<p className="mt-1 text-sm text-zinc-500">{tSys('cards.who.body')}</p>
					<LoopList title={t('topGap')} empty={tSys('cards.who.empty')} href="/intelligence/competitor-gap" items={loop.gaps} />
					<Link href="/intelligence/competitor-gap" className={`mt-4 inline-flex ${ASI_CTA}`}>
						{tSys('cards.who.cta')}
					</Link>
				</AsiCard>
				<AsiCard>
					<p className={ASI_SECTION_KICKER}>{tSys('cards.do.kicker')}</p>
					<h3 className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">{tSys('cards.do.title')}</h3>
					<p className="mt-1 text-sm text-zinc-500">{tSys('cards.do.body')}</p>
					<LoopList
						title={t('topAction')}
						empty={tSys('cards.do.empty')}
						href="/intelligence/next-best-action"
						items={loop.actions}
					/>
					<Link href="/intelligence/next-best-action" className={`mt-4 inline-flex ${ASI_CTA}`}>
						{tSys('cards.do.cta')}
					</Link>
				</AsiCard>
				<AsiCard>
					<p className={ASI_SECTION_KICKER}>{tSys('cards.worked.kicker')}</p>
					<h3 className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">{tSys('cards.worked.title')}</h3>
					<p className="mt-1 text-sm text-zinc-500">{tSys('cards.worked.body')}</p>
					<dl className="mt-3 grid gap-2 text-sm">
						<div className="flex justify-between">
							<dt>{t('trend7')}</dt>
							<dd className="font-bold tabular-nums">{signed(loop.trend7.changePct, '%')}</dd>
						</div>
						<div className="flex justify-between">
							<dt>{t('trend30')}</dt>
							<dd className="font-bold tabular-nums">{signed(loop.trend30.changePct, '%')}</dd>
						</div>
					</dl>
					<p className="mt-4 text-xs font-bold uppercase tracking-wider text-zinc-400">{t('alertTitle')}</p>
					{loop.alerts.length ? (
						<ul className="mt-2 flex flex-col gap-2">
							{loop.alerts.map((item) => (
								<li key={item.id}>
									<Link href={item.href} className="text-sm font-semibold">
										{item.title}
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-3 text-sm text-zinc-500">{t('emptyAlert')}</p>
					)}
					<Link href="/intelligence/visibility-monitor" className={`mt-4 inline-flex ${ASI_CTA}`}>
						{tSys('cards.worked.cta')}
					</Link>
				</AsiCard>
			</div>
		</div>
	);
}
