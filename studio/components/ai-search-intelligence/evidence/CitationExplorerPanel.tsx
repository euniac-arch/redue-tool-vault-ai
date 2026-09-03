'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiCitationCard } from '@/components/ai-search-intelligence/primitives/AsiCommonCards';
import { AsiEmptyState } from '@/components/ai-search-intelligence/primitives/AsiEmptyState';
import { AsiFilterChip } from '@/components/ai-search-intelligence/primitives/AsiFilterChip';
import { AsiFilterTabList } from '@/components/ai-search-intelligence/primitives/AsiFilterTabList';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiRevealItem, AsiRevealList } from '@/components/ai-search-intelligence/primitives/AsiReveal';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { ASI_BADGE, asiFocusRing } from '@/lib/ui/asi-chrome';
import {
	ASI_CITATION_KINDS,
	ASI_CITATION_SOURCE_CLASSES,
	type AsiCitationKind,
	type AsiCitationSourceClass,
	type AsiEvidenceSnapshot,
} from '@/lib/ai-search-intelligence/types';

const OWNERSHIP: Record<AsiEvidenceSnapshot['citations'][number]['ownership'], string> = {
	owned: 'border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200',
	brand_earned:
		'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
	unbranded_third_party:
		'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300',
};

const MIX_ORDER: AsiCitationSourceClass[] = ['owned', 'third_party', 'local', 'social', 'unknown'];

export function CitationExplorerPanel({ snapshot }: { snapshot: AsiEvidenceSnapshot }) {
	const t = useTranslations('intelligence.evidence');
	const report = snapshot.citationReport;
	const live = report?.computedFrom === 'live';
	const unavailable = Boolean(live && report && !report.available);
	const [kind, setKind] = useState<AsiCitationKind | 'all'>('all');
	const [sourceClass, setSourceClass] = useState<AsiCitationSourceClass | 'all'>('all');
	const rows = useMemo(
		() =>
			snapshot.citations.filter((item) => {
				if (kind !== 'all' && item.kind !== kind) return false;
				if (sourceClass !== 'all' && (item.sourceType || 'unknown') !== sourceClass) return false;
				return true;
			}),
		[kind, sourceClass, snapshot.citations],
	);

	if (unavailable) {
		return (
			<AsiEmptyState
				title={t('citationUnavailableTitle')}
				body={t('citationUnavailableBody', { count: report.responseCount })}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<AsiCard
				kicker={t('citationMixKicker')}
				title={t('citationMixTitle')}
				meta={t('citationMixMeta')}
				provenance={live ? 'observed' : 'derived'}
				badge={live ? 'observed' : 'estimated'}
				metric="actualCitation"
			>
				<p className="mb-3 inline-flex flex-wrap items-center gap-2 text-xs text-slate-500">
					<AsiProvenanceBadge badge={live ? 'observed' : 'estimated'} />
					{live && report
						? t('citationSample', { cited: report.citedResponseCount, total: report.responseCount })
						: t('citationMockNote')}
				</p>
				{!report || report.brandSupportCount === 0 ? (
					<p className="text-sm text-slate-500">{t('citationMixEmpty')}</p>
				) : (
					<ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
						{MIX_ORDER.map((key) => (
							<li
								key={key}
								className="rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-800"
							>
								<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
									{t(`sourceClass.${key}`)}
								</p>
								<p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
									{report.mix[key].percent}%
								</p>
								<p className="text-[11px] font-semibold text-slate-500">{report.mix[key].count}</p>
							</li>
						))}
					</ul>
				)}
			</AsiCard>

			<AsiFilterTabList label={t('citationClassAria')}>
				<AsiFilterChip active={sourceClass === 'all'} onClick={() => setSourceClass('all')}>
					{t('allClasses')}
				</AsiFilterChip>
				{ASI_CITATION_SOURCE_CLASSES.map((item) => (
					<AsiFilterChip key={item} active={sourceClass === item} onClick={() => setSourceClass(item)}>
						{t(`sourceClass.${item}`)}
					</AsiFilterChip>
				))}
			</AsiFilterTabList>
			<AsiFilterTabList label={t('citationFilterAria')}>
				<AsiFilterChip active={kind === 'all'} onClick={() => setKind('all')}>
					{t('allKinds')}
				</AsiFilterChip>
				{ASI_CITATION_KINDS.map((item) => (
					<AsiFilterChip key={item} active={kind === item} onClick={() => setKind(item)}>
						{t(`kind.${item}`)}
					</AsiFilterChip>
				))}
			</AsiFilterTabList>
			{rows.length === 0 ? (
				<AsiEmptyState title={t('filterEmptyTitle')} body={t('filterEmptyBody')} />
			) : (
			<AsiRevealList className="grid gap-3 lg:grid-cols-2">
				{rows.map((item) => (
					<AsiRevealItem key={item.id}>
					<AsiCitationCard
						kicker={t(`sourceClass.${item.sourceType || 'unknown'}`)}
						title={item.title || item.source}
						cited={item.cited}
					>
						<dl className="grid grid-cols-2 gap-2 text-xs">
							<div>
								<dt className="font-bold uppercase tracking-wide text-slate-400">{t('domain')}</dt>
								<dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{item.domain || item.source}</dd>
							</div>
							<div>
								<dt className="font-bold uppercase tracking-wide text-slate-400">{t('type')}</dt>
								<dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{t(`kind.${item.kind}`)}</dd>
							</div>
							{item.provider ? (
								<div>
									<dt className="font-bold uppercase tracking-wide text-slate-400">{t('provider')}</dt>
									<dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{item.provider}</dd>
								</div>
							) : null}
							{item.query ? (
								<div>
									<dt className="font-bold uppercase tracking-wide text-slate-400">{t('query')}</dt>
									<dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{item.query}</dd>
								</div>
							) : null}
						</dl>
						<a
							href={item.url}
							target="_blank"
							rel="noreferrer"
							className={asiFocusRing(
								'mt-2 block break-all text-xs font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-400',
							)}
						>
							{item.url}
						</a>
						<div className="mt-3 grid grid-cols-2 gap-3">
							<AsiScore
								value={item.brandRelevance ?? item.relevance}
								label={t('brandRelevance')}
								metric="citationRelevance"
								size="sm"
							/>
							{!live || item.authority > 0 ? (
								<AsiScore value={item.authority} label={t('authority')} metric="citationAuthority" size="sm" />
							) : null}
						</div>
						<p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('relation')}</p>
						<p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.relation}</p>
						<div className="mt-3 flex flex-wrap gap-1.5">
							<span className={`${ASI_BADGE} ${OWNERSHIP[item.ownership]}`}>
								{t(`ownership.${item.ownership}`)}
							</span>
							<span className={ASI_BADGE}>
								{item.cited ? t('citedYes') : t('citedNo')}
							</span>
						</div>
					</AsiCitationCard>
					</AsiRevealItem>
				))}
			</AsiRevealList>
			)}
		</div>
	);
}
