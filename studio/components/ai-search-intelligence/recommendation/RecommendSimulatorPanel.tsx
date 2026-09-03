'use client';

import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AsiAnswerResult } from '@/components/ai-search-intelligence/primitives/AsiAnswerResult';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiCta } from '@/components/ai-search-intelligence/primitives/AsiCta';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiSourceBadge } from '@/components/ai-search-intelligence/primitives/AsiSourceBadge';
import {
	pushRecentSimulatorQuery,
	readRecentSimulatorQueries,
} from '@/lib/ai-search-intelligence/recommendation/recent-queries';
import type { AsiRecommendationSnapshot, AsiSimRunStatus, AsiTargetAppearStatus } from '@/lib/ai-search-intelligence/types';

function runLabel(status: AsiSimRunStatus | undefined, busy: boolean): AsiSimRunStatus | 'analyzing' {
	if (busy) return 'analyzing';
	return status ?? 'idle';
}

export function RecommendSimulatorPanel({
	snapshot,
	onRunQuery,
	busy,
}: {
	snapshot: AsiRecommendationSnapshot;
	onRunQuery: (query: string) => void;
	busy: boolean;
}) {
	const t = useTranslations('intelligence.recommendation');
	const { potential, penalties } = snapshot.simulator;
	const simulation = snapshot.simulation;
	const [query, setQuery] = useState(snapshot.testQuery || snapshot.defaultQuery);
	const [recent, setRecent] = useState<string[]>([]);

	useEffect(() => {
		setQuery(snapshot.testQuery || snapshot.defaultQuery);
	}, [snapshot.testQuery, snapshot.defaultQuery]);

	useEffect(() => {
		setRecent(readRecentSimulatorQueries(snapshot.site.domain));
	}, [snapshot.site.domain, snapshot.testQuery]);

	function run(next: string) {
		const text = next.trim();
		if (!text || busy) return;
		setRecent(pushRecentSimulatorQuery(snapshot.site.domain, text));
		onRunQuery(text);
	}

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		run(query);
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			run(query);
		}
	}

	const status = runLabel(simulation?.runStatus, busy);
	const targetStatus: AsiTargetAppearStatus = busy ? 'NO_DATA' : simulation?.targetStatus ?? 'NO_DATA';

	return (
		<div className="flex flex-col gap-4">
			<p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
				{t('simDisclaimer')}
			</p>
			<AsiCard kicker={t('searchKicker')} title={t('searchTitle')} meta={t('searchMeta')} provenance="observed" badge="actual_response" metric="actualAnswer">
				<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(`runStatus.${status}`)}</p>
				<form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3">
					<label className="sr-only" htmlFor="asi-simulator-query">
						{t('searchQueryLabel')}
					</label>
					<textarea
						id="asi-simulator-query"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={onKeyDown}
						placeholder={snapshot.defaultQuery || t('searchPlaceholder')}
						rows={3}
						disabled={busy}
						className="theme-input min-h-[5.5rem] resize-y py-3 font-semibold"
					/>
					{snapshot.defaultQuery ? (
						<button
							type="button"
							className="self-start text-xs font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300"
							onClick={() => setQuery(snapshot.defaultQuery)}
						>
							{t('searchExample', { query: snapshot.defaultQuery })}
						</button>
					) : null}
					{recent.length ? (
						<div className="flex flex-col gap-2">
							<p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('recentTitle')}</p>
							<div className="flex flex-wrap gap-2">
								{recent.map((item) => (
									<button
										key={item}
										type="button"
										onClick={() => setQuery(item)}
										className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-cyan-300 dark:border-slate-700 dark:text-slate-300"
									>
										{item}
									</button>
								))}
							</div>
						</div>
					) : null}
					<AsiCta disabled={busy || !query.trim()}>{busy ? t('searchRunning') : t('searchRun')}</AsiCta>
				</form>
			</AsiCard>

			<AsiCard kicker={t('actualKicker')} title={t('actualTitle')} meta={t('actualMeta')} provenance="observed" metric="actualAnswer">
				<p className="text-sm font-bold text-slate-800 dark:text-slate-100">
					{t('targetStatusLabel')}: {t(`targetStatus.${targetStatus}`)}
				</p>
				<p className="mt-1 text-xs text-slate-500">
					{t('searchQueryUsed', { query: simulation?.query || snapshot.testQuery })}
				</p>
				{simulation?.observedAt ? (
					<p className="mt-1 text-xs text-slate-400">{t('observedAt', { time: simulation.observedAt })}</p>
				) : null}
				{simulation && simulation.runStatus !== 'observed' ? (
					<div className="mt-2">
						<AsiSourceBadge source={simulation.runStatus === 'fallback' ? 'fallback' : simulation.runStatus === 'mock_preview' ? 'mock' : 'derived'} />
					</div>
				) : null}
				<div className="mt-3 grid gap-3 lg:grid-cols-2">
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
							<dl className="mt-3 grid gap-1 text-xs text-slate-500">
								<div>
									<dt className="font-bold uppercase tracking-wide text-slate-400">{t('entities')}</dt>
									<dd className="mt-0.5 text-slate-700 dark:text-slate-200">
										{(result.recommendations?.length ? result.recommendations : result.mentions)?.join(', ') || t('entitiesNone')}
									</dd>
								</div>
							</dl>
						</AsiAnswerResult>
					))}
				</div>
			</AsiCard>

			<AsiCard kicker={t('recoKicker')} title={t('recoTitle')} provenance="observed" metric="actualMention">
				{simulation?.entities.length ? (
					<ol className="flex flex-col gap-2">
						{simulation.entities.map((item, index) => (
							<li
								key={`${item.role}-${item.name}`}
								className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
							>
								<span className="font-semibold text-slate-800 dark:text-slate-100">
									{index + 1}. {item.name}
								</span>
								<span className="text-xs font-bold uppercase text-slate-400">
									{t(`entityRole.${item.role}`)}
									{item.recommended ? ` · ${t('entityRecommended')}` : item.mentioned ? ` · ${t('entityMentioned')}` : ''}
								</span>
							</li>
						))}
					</ol>
				) : (
					<p className="text-sm text-slate-500">{t('entitiesNone')}</p>
				)}
			</AsiCard>

			<AsiCard kicker={t('evidenceKicker')} title={t('evidenceTitle')} provenance="observed" metric="actualCitation">
				{simulation?.citationAvailable ? (
					<ul className="flex flex-col gap-2">
						{simulation.citations.map((item) => (
							<li key={item.url} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
								<p className="font-semibold text-slate-800 dark:text-slate-100">{item.source}</p>
								<a href={item.url} target="_blank" rel="noreferrer" className="break-all text-xs text-cyan-700 dark:text-cyan-300">
									{item.url}
								</a>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-slate-500">{t('evidenceEmpty')}</p>
				)}
			</AsiCard>

			<AsiCard kicker={t('whyKicker')} title={t('whyTitle')} meta={t('whyMeta')} provenance="observed" metric="actualMention">
				<ul className="grid gap-2 sm:grid-cols-2">
					{(simulation?.why ?? []).map((item) => (
						<li key={item.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
							<p className="font-semibold text-slate-800 dark:text-slate-100">{t(`whyItem.${item.id}`)}</p>
							<p className="text-xs text-slate-500">{item.observed ? t('whyObserved') : t('whyNotObserved')}</p>
						</li>
					))}
				</ul>
			</AsiCard>

			<AsiCard kicker={t('queryObsKicker')} title={t('queryObsTitle')} meta={t('queryObsMeta')} provenance="observed" metric="actualMention">
				<dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
					<div>
						<dt className="text-xs font-bold uppercase text-slate-400">{t('queryObsBrands')}</dt>
						<dd className="mt-1 text-lg font-extrabold tabular-nums">{simulation?.observation.mentionedBrands ?? 0}</dd>
					</div>
					<div>
						<dt className="text-xs font-bold uppercase text-slate-400">{t('queryObsTarget')}</dt>
						<dd className="mt-1 text-lg font-extrabold tabular-nums">{simulation?.observation.targetCount ?? 0}</dd>
					</div>
					<div>
						<dt className="text-xs font-bold uppercase text-slate-400">{t('queryObsCompetitors')}</dt>
						<dd className="mt-1 text-lg font-extrabold tabular-nums">{simulation?.observation.competitorCount ?? 0}</dd>
					</div>
					<div>
						<dt className="text-xs font-bold uppercase text-slate-400">{t('queryObsUsable')}</dt>
						<dd className="mt-1 text-lg font-extrabold tabular-nums">{simulation?.usableResponseCount ?? 0}</dd>
					</div>
				</dl>
			</AsiCard>

			<AsiCard kicker={t('simKicker')} title={t('simTitle')} meta={t('simMeta')} provenance="derived" badge="derived_score" metric="recommendationPotential">
				<AsiScore value={potential} label={t('potential')} hint={t('potentialHint')} metric="recommendationPotential" showGrade size="lg" />
			</AsiCard>
			<AsiCard kicker={t('gapKicker')} title={t('gapTitle')} meta={t('gapMeta')} provenance="derived" metric="recommendationPotential">
				<p className="text-sm text-slate-600 dark:text-slate-300">
					{t('gapCopy', {
						actual: t(`targetStatus.${targetStatus}`),
						score: String(potential),
					})}
				</p>
			</AsiCard>
			<AsiCard kicker={t('penaltyKicker')} title={t('penaltyTitle')} provenance="derived" metric="penalty">
				<ul className="flex flex-col gap-2">
					{penalties.map((item) => (
						<li
							key={item.id}
							className="flex flex-col gap-1 rounded-xl border border-slate-200 px-3 py-3 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800"
						>
							<div className="min-w-0">
								<p className="text-sm font-bold text-slate-900 dark:text-white">{t(`penalty.${item.id}`)}</p>
								<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.detail}</p>
							</div>
							<span className="shrink-0 text-sm font-extrabold tabular-nums text-rose-600 dark:text-rose-300">
								-{item.points}
							</span>
						</li>
					))}
				</ul>
			</AsiCard>
		</div>
	);
}
