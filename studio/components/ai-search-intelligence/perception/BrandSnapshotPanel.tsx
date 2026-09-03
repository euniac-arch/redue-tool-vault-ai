'use client';

import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import type { AsiPerceptionSnapshot } from '@/lib/ai-search-intelligence/types';

function gapPercent(snapshot: AsiPerceptionSnapshot): number {
	const values = Object.values(snapshot.axes);
	const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
	return Math.max(0, Math.min(100, Math.round(100 - avg)));
}

export function BrandSnapshotPanel({ snapshot }: { snapshot: AsiPerceptionSnapshot }) {
	const t = useTranslations('intelligence.perception');
	const gap = gapPercent(snapshot);

	return (
		<div className="flex flex-col gap-4">
			<AsiCard kicker={t('snapshotKicker')} title={t('oneLinerTitle')} provenance="observed" badge="actual_response" metric="actualAnswer">
				<p className="text-lg font-bold leading-snug text-slate-900 dark:text-white">
					{snapshot.understood}
				</p>
			</AsiCard>

			<section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
				<AsiCard kicker={t('currentKicker')} title={t('currentTitle')} provenance="observed" badge="actual_response" metric="actualAnswer">
					<p className="text-base font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
						“{snapshot.currentNarrative}”
					</p>
				</AsiCard>
				<div className="flex items-center justify-center">
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
						<AsiScore value={gap} label={t('gapLabel')} metric="perceptionGap" size="sm" />
					</div>
				</div>
				<AsiCard kicker={t('targetKicker')} title={t('targetTitle')} provenance="derived">
					<p className="text-base font-semibold leading-relaxed text-slate-900 dark:text-white">
						“{snapshot.targetNarrative}”
					</p>
				</AsiCard>
			</section>

			<AsiCard kicker={t('gapNotesKicker')} title={t('gapNotesTitle')} meta={t('gapNotesMeta')} provenance="derived" metric="perceptionGap">
				<ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
					{snapshot.gapNotes.map((note) => (
						<li
							key={note}
							className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200"
						>
							{note}
						</li>
					))}
				</ul>
			</AsiCard>
		</div>
	);
}
