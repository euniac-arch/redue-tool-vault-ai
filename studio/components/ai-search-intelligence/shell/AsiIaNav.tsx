'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAsiIaContext } from '@/lib/ai-search-intelligence/ia/use-asi-ia-context';
import {
	ASI_PILLARS,
	asiIaEntries,
	isAsiIaEntryActive,
	isAsiIaGroupActive,
	type AsiIaEntry,
	type AsiPillarDef,
} from '@/lib/ai-search-intelligence/routes';
import type { AsiIaStatus, AsiToolContext } from '@/lib/ai-search-intelligence/ia/context';
import { ASI_SECTION_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';

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

function statusClass(status: AsiIaStatus, active: boolean): string {
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
	const status = ctx?.status ?? 'empty';
	const problem = problemText(t, ctx?.problem ?? null);
	const actionHref = ctx?.actionHref || entry.href;

	return (
		<Link
			href={actionHref}
			prefetch
			aria-current={active ? 'page' : undefined}
			className={asiFocusRing(
				`block min-w-0 rounded-lg border px-2.5 py-2 transition-colors duration-150 hover:border-cyan-300 hover:bg-cyan-50/80 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/10 ${statusClass(status, active)}`,
			)}
		>
			<p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{t(entry.titleKey)}</p>
			<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
				<span>{t(`status.${status}`)}</span>
				<span className="tabular-nums">{ctx?.score == null ? '—' : ctx.score}</span>
			</div>
			{!compact && problem ? (
				<p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{problem}</p>
			) : null}
			{!compact ? (
				<span className="mt-1.5 inline-flex text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
					{t(status === 'empty' ? 'ia.run' : 'ia.action')}
				</span>
			) : null}
			<span className="sr-only">{t(`roles.${group.id}`)}</span>
		</Link>
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
				return (
					<section
						key={group.id}
						className={`rounded-xl border px-3 py-3 ${
							groupActive
								? 'border-cyan-200 bg-cyan-50/40 dark:border-cyan-800/50 dark:bg-cyan-950/20'
								: 'border-slate-200 dark:border-slate-800'
						}`}
					>
						<p className={ASI_SECTION_KICKER}>{t(`roles.${group.id}`)}</p>
						<Link href={group.href} className="mt-0.5 block text-sm font-bold text-slate-800 dark:text-slate-100">
							{t(`pillars.${group.id}`)}
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
