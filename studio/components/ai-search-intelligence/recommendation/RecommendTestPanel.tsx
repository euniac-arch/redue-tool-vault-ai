'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiAnswerResult } from '@/components/ai-search-intelligence/primitives/AsiAnswerResult';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiCta } from '@/components/ai-search-intelligence/primitives/AsiCta';
import { AsiMetricHeading } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import type { AsiRecommendationSnapshot } from '@/lib/ai-search-intelligence/types';

export function RecommendTestPanel({
	snapshot,
	onRunQuery,
	busy,
}: {
	snapshot: AsiRecommendationSnapshot;
	onRunQuery: (query: string) => void;
	busy: boolean;
}) {
	const t = useTranslations('intelligence.recommendation');
	const [query, setQuery] = useState(snapshot.testQuery);

	useEffect(() => {
		setQuery(snapshot.testQuery);
	}, [snapshot.testQuery]);

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onRunQuery(query);
	}

	return (
		<div className="flex flex-col gap-4">
			<AsiCard kicker={t('testKicker')} title={t('testTitle')} meta={t('testMeta')} provenance="observed" badge="actual_response" metric="actualAnswer">
				<form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
					<label className="sr-only" htmlFor="asi-recommend-query">
						{t('queryLabel')}
					</label>
					<input
						id="asi-recommend-query"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={snapshot.defaultQuery}
						className="theme-input h-11 flex-1"
					/>
					<AsiCta disabled={busy || !query.trim()}>{busy ? t('testing') : t('testRun')}</AsiCta>
				</form>
			</AsiCard>
			<div className="grid gap-3 lg:grid-cols-2">
				{snapshot.testResults.map((result) => (
					<AsiAnswerResult
						key={result.engine}
						engine={result.engine}
						snippet={result.summary}
						mentionType={result.mentionType}
						source={result.source}
						fallback={result.fallback}
						error={result.error}
					>
						<dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
							<div>
								<dt className="font-bold uppercase tracking-wide text-slate-400">
									<AsiMetricHeading label={t('rank')} metric="actualRank" />
								</dt>
								<dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
									{result.rank ? t('rankValue', { n: result.rank }) : t('rankNone')}
								</dd>
							</div>
							<div>
								<dt className="font-bold uppercase tracking-wide text-slate-400">
									<AsiMetricHeading label={t('mentioned')} metric="actualMention" />
								</dt>
								<dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
									{result.mentioned ? t('mentionedYes') : t('mentionedNo')}
								</dd>
							</div>
							<div className="col-span-2">
								<dt className="font-bold uppercase tracking-wide text-slate-400">{t('reason')}</dt>
								<dd className="mt-0.5 leading-relaxed text-slate-600 dark:text-slate-300">{result.reason}</dd>
							</div>
						</dl>
					</AsiAnswerResult>
				))}
			</div>
		</div>
	);
}
