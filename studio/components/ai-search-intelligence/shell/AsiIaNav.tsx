'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw } from 'lucide-react';
import { AsiBilingualTitle, AsiCategoryBadge } from '@/components/ai-search-intelligence/primitives/AsiBilingualTitle';
import { useIntelligence } from '@/components/ai-search-intelligence/shell/IntelligenceContext';
import {
	formatIntelligenceCategory,
	getIntelligenceCategory,
	getIntelligenceToolByEntryId,
} from '@/constants/aiIntelligenceTools';
import { useAsiIaContext } from '@/lib/ai-search-intelligence/ia/use-asi-ia-context';
import {
	ASI_PILLARS,
	asiIaEntries,
	isAsiIaEntryActive,
	isAsiIaGroupActive,
	type AsiIaEntry,
	type AsiIaEntryId,
	type AsiPillarDef,
} from '@/lib/ai-search-intelligence/routes';
import type { AsiIaStatus, AsiToolContext } from '@/lib/ai-search-intelligence/ia/context';
import { asiFocusRing } from '@/lib/ui/asi-chrome';

function problemText(
	t: ReturnType<typeof useTranslations>,
	problem: string | null,
): string | null {
	if (!problem) return null;
	if (problem === 'sample' || problem === 'unavailable' || problem === 'structure' || problem === 'noData' || problem === 'noCompetitor') {
		return t(`ia.problem.${problem}`);
	}
	return problem;
}

function statusClass(status: AsiIaStatus, active: boolean, analyzing: boolean): string {
	if (analyzing) return 'border-cyan-200 bg-cyan-50/70 dark:border-cyan-800/40 dark:bg-cyan-950/20';
	if (active) return 'border-cyan-300 bg-cyan-50 dark:border-cyan-500/40 dark:bg-cyan-500/10';
	if (status === 'problem') return 'border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20';
	if (status === 'watch') return 'border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/10';
	return 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40';
}

function IaEntryCard({
	entry,
	group,
	active,
	ctx,
	compact,
}: {
	entry: AsiIaEntry;
	group: AsiPillarDef;
	active: boolean;
	ctx: AsiToolContext | undefined;
	compact?: boolean;
}) {
	const t = useTranslations('intelligence');
	const { targetUrl, focusSiteInput, reanalyzeTool, setSelectedToolId, refreshingEntryIds, modules } =
		useIntelligence();
	const tool = getIntelligenceToolByEntryId(entry.id);
	const status = ctx?.status ?? 'empty';
	const problem = problemText(t, ctx?.problem ?? null);
	const category = tool ?? getIntelligenceCategory(group.id);
	const moduleState = modules[entry.id as AsiIaEntryId];
	const refreshing = refreshingEntryIds.includes(entry.id);
	const analyzing = moduleState?.isLoading === true || refreshing;
	const hasTarget = Boolean(targetUrl.trim());
	const completed = Boolean(moduleState?.data) || (status !== 'empty' && !analyzing);

	function handleIdleClick() {
		focusSiteInput();
	}

	function handleReanalyze(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
		reanalyzeTool(entry.id as AsiIaEntryId);
	}

	const body = (
		<>
			{tool ? (
				<AsiBilingualTitle titleKo={tool.titleKo} titleEn={tool.titleEn} />
			) : (
				<p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{t(entry.titleKey)}</p>
			)}
			<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
				<span>{analyzing ? t('ia.diagnosing') : completed && ctx?.score != null ? t('ia.scorePoints', { score: ctx.score }) : t(`status.${status}`)}</span>
				{completed && ctx?.score != null ? <span className="tabular-nums">{ctx.score}</span> : <span className="tabular-nums">{ctx?.score == null ? '—' : ctx.score}</span>}
			</div>
			{!compact && !analyzing && problem ? (
				<p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{problem}</p>
			) : null}
			{!compact ? (
				<span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
					{analyzing ? (
						<>
							<Loader2 className="h-3 w-3 animate-spin" aria-hidden />
							{t('ia.diagnosing')}
						</>
					) : completed ? (
						t('ia.viewDetail')
					) : (
						t('ia.wait')
					)}
				</span>
			) : null}
			<span className="sr-only">{formatIntelligenceCategory(category)}</span>
		</>
	);

	const chrome = `relative block min-w-0 rounded-lg border px-2.5 py-2 pr-8 text-left transition-colors duration-150 ${statusClass(status, active, analyzing)}`;

	return (
		<div className="relative">
			{hasTarget && completed ? (
				<button
					type="button"
					onClick={handleReanalyze}
					title={t('ia.reanalyze')}
					aria-label={t('ia.reanalyze')}
					className="absolute right-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-cyan-700 dark:hover:bg-slate-800 dark:hover:text-cyan-300"
				>
					<RefreshCw className="h-3.5 w-3.5" aria-hidden />
				</button>
			) : null}
			{hasTarget ? (
				<Link
					href={entry.href}
					prefetch
					aria-current={active ? 'page' : undefined}
					aria-busy={analyzing || undefined}
					onClick={() => setSelectedToolId(entry.id as AsiIaEntryId)}
					className={asiFocusRing(`${chrome} hover:border-cyan-300 hover:bg-cyan-50/80 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/10`)}
				>
					{body}
				</Link>
			) : (
				<button type="button" onClick={handleIdleClick} className={asiFocusRing(`${chrome} w-full`)}>
					{body}
				</button>
			)}
		</div>
	);
}

export function AsiIaNav({ compact = false }: { compact?: boolean }) {
	const t = useTranslations('intelligence');
	const pathname = usePathname();
	const [hash, setHash] = useState('');
	const context = useAsiIaContext();

	useEffect(() => {
		const sync = () => setHash(window.location.hash || '');
		sync();
		window.addEventListener('hashchange', sync);
		return () => window.removeEventListener('hashchange', sync);
	}, [pathname]);

	return (
		<nav aria-label={t('ia.navAria')} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
			{ASI_PILLARS.map((group) => {
				const groupActive = isAsiIaGroupActive(group, pathname || '', hash);
				const category = getIntelligenceCategory(group.id);
				return (
					<section
						key={group.id}
						className={`rounded-xl border px-3 py-3 ${
							groupActive
								? 'border-cyan-200 bg-cyan-50/40 dark:border-cyan-800/50 dark:bg-cyan-950/20'
								: 'border-slate-200 dark:border-slate-800'
						}`}
					>
						<Link
							href={group.href}
							className="block text-[11px] font-semibold tracking-wide text-cyan-700 dark:text-cyan-400/80"
						>
							<AsiCategoryBadge categoryKo={category.categoryKo} categoryEn={category.categoryEn} />
						</Link>
						<div className="mt-2 flex flex-col gap-2">
							{asiIaEntries(group).map((entry) => (
								<IaEntryCard
									key={entry.id}
									entry={entry}
									group={group}
									active={isAsiIaEntryActive(entry, pathname || '', hash)}
									ctx={context?.[entry.id]}
									compact={compact}
								/>
							))}
						</div>
					</section>
				);
			})}
		</nav>
	);
}
