'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AsiMetricTooltip } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import type { AsiMetricId } from '@/lib/ai-search-intelligence/provenance';
import type { AsiAuditBind, AsiSignalLink } from '@/lib/ai-search-intelligence/types';
import { ASI_CARD, ASI_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';
import { useAsiCountUp } from '@/lib/ui/asi-motion';

export type AsiCompareItem = {
	id: 'visibility' | 'recommendation' | 'trust' | 'readiness';
	value: number;
};

const COMPARE_METRIC: Record<AsiCompareItem['id'], AsiMetricId> = {
	visibility: 'visibilityScore',
	recommendation: 'recommendationPotential',
	trust: 'trustScore',
	readiness: 'agentReadiness',
};

export function AsiScoreCompareStrip({
	bind,
	items,
}: {
	bind: AsiAuditBind;
	items: AsiCompareItem[];
}) {
	const t = useTranslations('intelligence.bridge');
	const gaps = bind.signalLinks.filter((link) => link.gap);

	return (
		<section className={`${ASI_CARD} px-4 py-4`} aria-label={t('aria')}>
			<p className={ASI_KICKER}>{t('kicker')}</p>
			<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('hint')}</p>
			<div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
				<article className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
					<p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('namespace.audit')}</p>
					<p className="mt-1 text-[11px] font-bold text-slate-500">{t('seoLabel')}</p>
					<p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
						<AsiCompareValue value={bind.seoScore} />
						<span className="ml-1 text-xs font-semibold text-slate-400">/ {bind.seoMaxScore}</span>
					</p>
				</article>
				{items.map((item) => (
					<article
						key={item.id}
						className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-3 dark:border-amber-500/30 dark:bg-amber-500/10"
					>
						<div className="flex flex-wrap items-center gap-1.5">
							<p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
								{t('namespace.asi')}
							</p>
							<AsiProvenanceBadge badge="derived_score" />
						</div>
						<p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
							{t(`metric.${item.id}`)}
							<AsiMetricTooltip metric={COMPARE_METRIC[item.id]} label={t(`metric.${item.id}`)} />
						</p>
						<p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
							<AsiCompareValue value={Math.round(item.value)} />
							<span className="ml-1 text-xs font-semibold text-slate-400">/ 100</span>
						</p>
					</article>
				))}
			</div>
			{gaps.length ? (
				<ul className="mt-4 flex flex-col gap-1.5">
					{gaps.map((link) => (
						<li key={link.id}>
							<Link
								href={link.href}
								className={asiFocusRing(
									'text-xs font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-400',
								)}
							>
								{t(`link.${link.id}`)}
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-3 text-xs text-slate-500">{t('noGaps')}</p>
			)}
		</section>
	);
}

function AsiCompareValue({ value }: { value: number }) {
	const shown = useAsiCountUp(value);
	return <>{shown}</>;
}

export function signalGaps(bind: AsiAuditBind | null | undefined): AsiSignalLink[] {
	return bind?.signalLinks.filter((link) => link.gap) ?? [];
}
