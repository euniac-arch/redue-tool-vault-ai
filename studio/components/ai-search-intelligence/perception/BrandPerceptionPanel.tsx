'use client';

import { useTranslations } from 'next-intl';
import { AsiAnswerResult } from '@/components/ai-search-intelligence/primitives/AsiAnswerResult';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import type { AsiPerceptionAxisId, AsiPerceptionSnapshot } from '@/lib/ai-search-intelligence/types';
import { ASI_BADGE } from '@/lib/ui/asi-chrome';

const SCORE_AXES: AsiPerceptionAxisId[] = ['expertise', 'local', 'trust', 'differentiation', 'awareness'];

export function BrandPerceptionPanel({ snapshot }: { snapshot: AsiPerceptionSnapshot }) {
	const t = useTranslations('intelligence.perception');
	const confusedItems = (snapshot.confused || []).map((item) => item.trim()).filter(Boolean);

	return (
		<div className="flex flex-col gap-4">
			<section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
				{SCORE_AXES.map((axis) => (
					<div
						key={axis}
						className="rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900/50"
					>
						<AsiScore value={snapshot.axes[axis]} label={t(`axis.${axis}`)} metric="perceptionAxis" size="sm" />
					</div>
				))}
			</section>

			<AsiCard kicker={t('understoodKicker')} title={t('understoodTitle')} provenance="observed" badge="actual_response" metric="actualAnswer">
				<AsiAnswerResult kicker={t('aiVoice')} snippet={snapshot.understood} />
			</AsiCard>

			<div className="grid gap-4 lg:grid-cols-2">
				<AsiCard kicker={t('unknownKicker')} title={t('unknownTitle')} provenance="derived">
					<ul className="flex flex-col gap-2">
						{snapshot.unknown.map((item) => (
							<li
								key={item}
								className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200"
							>
								{item}
							</li>
						))}
					</ul>
				</AsiCard>
				<AsiCard kicker={t('confusedKicker')} title={t('confusedTitle')} provenance="derived">
					{confusedItems.length ? (
						<ul className="flex flex-col gap-2">
							{confusedItems.map((item) => (
								<li
									key={item}
									className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
								>
									{item}
								</li>
							))}
						</ul>
					) : (
						<div className="flex flex-col items-start gap-2">
							<span
								className={`${ASI_BADGE} border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300`}
							>
								{t('confusedEmptyBadge')}
							</span>
							<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{t('confusedEmpty')}</p>
						</div>
					)}
				</AsiCard>
			</div>

			<AsiCard kicker={t('enginesKicker')} title={t('enginesTitle')} provenance="observed" badge="actual_response" metric="actualAnswer">
				<div className="grid gap-3 sm:grid-cols-2">
					{snapshot.engineNotes.map((note) => (
						<AsiAnswerResult
							key={note.engine}
							engine={note.engine}
							snippet={note.summary}
							mentionType={note.mentionType}
						/>
					))}
				</div>
			</AsiCard>
		</div>
	);
}
