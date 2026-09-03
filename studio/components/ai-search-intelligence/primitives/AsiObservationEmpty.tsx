'use client';

import { useTranslations } from 'next-intl';
import { AsiEmptyState } from '@/components/ai-search-intelligence/primitives/AsiEmptyState';
import {
	ASI_COMPETITOR_MIN_SAMPLE,
	isAsiCompetitorEmptyState,
	type AsiObservationCoverage,
} from '@/lib/ai-search-intelligence/observation-state';
import { ASI_EMPTY } from '@/lib/ui/asi-chrome';
import type { AsiObservationState } from '@/lib/ai-search-intelligence/types';

export function AsiObservationEmpty({
	state,
	coverage,
}: {
	state: AsiObservationState;
	coverage?: Partial<AsiObservationCoverage>;
}) {
	const t = useTranslations('intelligence.observation');
	if (!isAsiCompetitorEmptyState(state)) return null;

	if (state === 'INSUFFICIENT_SAMPLE') {
		const queryCount = coverage?.queryCount ?? 0;
		const validResponseCount = coverage?.validResponseCount ?? 0;
		const minSample = coverage?.minSample ?? ASI_COMPETITOR_MIN_SAMPLE;
		return (
			<section className={ASI_EMPTY}>
				<p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('INSUFFICIENT_SAMPLE.title')}</p>
				<ul className="mx-auto mt-3 max-w-md space-y-1 text-left text-sm text-slate-500 dark:text-slate-400">
					<li>{t('coverageQuery', { count: queryCount })}</li>
					<li>{t('coverageResponses', { count: validResponseCount })}</li>
					<li>{t('coverageMin', { count: minSample })}</li>
				</ul>
			</section>
		);
	}

	if (state === 'NO_COMPETITOR_OBSERVED') {
		return (
			<section className={ASI_EMPTY}>
				<p className="whitespace-pre-line text-sm font-semibold text-slate-700 dark:text-slate-200">
					{t('NO_COMPETITOR_OBSERVED.title')}
				</p>
				<p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">{t('NO_COMPETITOR_OBSERVED.note')}</p>
			</section>
		);
	}

	return <AsiEmptyState title={t(`${state}.title`)} body={t(`${state}.body`)} />;
}

export function AsiCompetitorFoundLead({ names }: { names: readonly string[] }) {
	const t = useTranslations('intelligence.observation');
	if (!names.length) return null;
	return (
		<div>
			<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('foundTitle', { count: names.length })}</p>
			<ol className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
				{names.map((name, index) => (
					<li key={name}>
						<span className="tabular-nums text-slate-400">{index + 1}</span>
						<span className="ml-2 font-semibold text-slate-800 dark:text-slate-100">{name}</span>
					</li>
				))}
			</ol>
		</div>
	);
}
