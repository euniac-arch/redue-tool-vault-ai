'use client';

import { useTranslations } from 'next-intl';
import { useOptionalAuditData } from '@/components/audit/AuditDataContext';
import { GeoPillarScoreBadge } from '@/components/audit/GeoPillarScoreBadge';
import { resolveGeoPillarStatus, type GeoPillarScore } from '@/lib/audit/geoScoreCalculator';
import { scrollToGeoPillar } from '@/lib/audit/scroll-to-geo-pillar';

function barTone(pillar: GeoPillarScore): string {
	const status = resolveGeoPillarStatus(pillar);
	if (status === 'ok') return 'bg-emerald-500';
	if (status === 'warn') return 'bg-amber-500';
	return 'bg-rose-500';
}

function GeoPillarAxisCard({ pillar }: { pillar: GeoPillarScore }) {
	const t = useTranslations('audit.geoScore');

	return (
		<button
			type="button"
			data-geo-pillar-axis={pillar.id}
			onClick={() => scrollToGeoPillar(pillar.targetAnchorId)}
			aria-label={t('pillarJump', { name: pillar.name })}
			className="group flex h-full flex-col justify-between rounded-xl border border-indigo-200/70 bg-white/80 p-4 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-indigo-400/20 dark:bg-white/[0.04] dark:hover:border-indigo-300/50 print:pointer-events-none"
		>
			<div className="mb-2.5 flex items-center justify-between">
				<div
					className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-100 text-lg transition-transform group-hover:scale-110 dark:border-slate-700/60 dark:bg-slate-800/80"
					aria-hidden
				>
					{pillar.icon}
				</div>
				<GeoPillarScoreBadge pillar={pillar} size="sm" />
			</div>

			<div className="my-1 flex-1 space-y-1.5">
				<p className="text-sm font-extrabold tracking-tight text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
					{pillar.name}
				</p>
				<p className="break-keep text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
					{pillar.description}
				</p>
			</div>

			<div className="mt-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/60">
				<div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
					<div
						className={`h-full rounded-full transition-all duration-500 ${barTone(pillar)}`}
						style={{ width: `${pillar.percentage}%` }}
					/>
				</div>
				<span className="flex items-center justify-between text-[10px] font-bold text-slate-500 transition-colors group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-300">
					<span>{t('pillarJumpHint')}</span>
					<span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
						↗
					</span>
				</span>
			</div>
		</button>
	);
}

export function GeoPillarScoreTable() {
	const pillarList = useOptionalAuditData()?.snapshot.geoComprehensive.pillarList;
	if (!pillarList?.length) return null;

	// const t = useTranslations('audit.geoScore');
	// const rawTotal = pillarList.reduce((sum, pillar) => sum + pillar.earned, 0);

	return (
		<div className="relative grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
			{pillarList.map((pillar) => (
				<GeoPillarAxisCard key={pillar.id} pillar={pillar} />
			))}
		</div>
	);
}
