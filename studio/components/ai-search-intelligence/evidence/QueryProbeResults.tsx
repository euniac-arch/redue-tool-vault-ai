'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiMetricHeading } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiTableFrame } from '@/components/ai-search-intelligence/primitives/AsiTableFrame';
import type { AsiQueryCompareRow, AsiQueryExtract, AsiQueryProbeReport } from '@/lib/ai-search-intelligence/types';
import { ASI_BADGE, ASI_CTA, ASI_HOVER_MOTION } from '@/lib/ui/asi-chrome';

function citationHosts(urls: readonly string[]): string[] {
	return urls.map((url) => {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	});
}

function extractLine(t: (key: string, values?: Record<string, number>) => string, extracted: AsiQueryExtract) {
	return {
		mention: extracted.mentioned ? t('probeMentionYes') : t('probeMentionNo'),
		recommend: extracted.recommended
			? extracted.rank
				? t('probeRank', { n: extracted.rank })
				: t('probeRecommendYes')
			: t('probeRecommendNo'),
		competitors: extracted.competitors.length ? extracted.competitors.join(', ') : '—',
		citations: extracted.citations.length ? citationHosts(extracted.citations).join(' · ') : t('probeEvidenceUnavailable'),
	};
}

function CompareDelta({ row }: { row: AsiQueryCompareRow }) {
	const t = useTranslations('intelligence.evidence');
	if (!row.previous) return null;
	const bits: string[] = [];
	if (row.mentionChanged) bits.push(t('probeMentionChanged'));
	if (row.recommendChanged) bits.push(t('probeRecommendChanged'));
	if (row.rankDelta != null && row.rankDelta > 0) bits.push(t('probeRankUp', { n: row.rankDelta }));
	if (row.rankDelta != null && row.rankDelta < 0) bits.push(t('probeRankDown', { n: Math.abs(row.rankDelta) }));
	if (row.rankDelta === 0 && !row.mentionChanged && !row.recommendChanged) bits.push(t('probeRankSame'));
	if (!bits.length) return null;
	return <p className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300">{bits.join(' · ')}</p>;
}

export function QueryProbeResults({ report }: { report: AsiQueryProbeReport }) {
	const t = useTranslations('intelligence.evidence');
	const current = report.current;
	if (!current) return null;

	const byQuery = current.queries.map((query) => ({
		query,
		records: current.records.filter((record) => record.query === query),
	}));

	return (
		<div className="flex flex-col gap-4">
			<AsiCard
				kicker={t('probeResultsKicker')}
				title={t('probeResultsTitle')}
				meta={t('probeResultsMeta')}
				provenance="observed"
				badge="actual_response"
				metric="actualAnswer"
			>
				<p className="text-xs font-semibold text-slate-500">
					{t('probeRunId')}: <span className="font-mono text-slate-700 dark:text-slate-200">{current.runId}</span>
					{' · '}
					{new Date(current.timestamp).toLocaleString()}
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<Link href="/intelligence/share-of-voice" className={`${ASI_CTA} h-10 px-4 text-xs`}>
						{t('probeOpenSov')}
					</Link>
					<Link href="/intelligence/competitor-analysis" className={`${ASI_CTA} h-10 bg-slate-700 px-4 text-xs hover:bg-slate-600`}>
						{t('probeOpenCompetitors')}
					</Link>
				</div>
			</AsiCard>

			{report.previous ? (
				<AsiCard
					kicker={t('probeCompareKicker')}
					title={t('probeCompareTitle')}
					meta={t('probeCompareMeta')}
					provenance="derived"
					metric="generatedQuestions"
				>
					<ul className="flex flex-col gap-2 text-sm">
						{report.compare
							.filter((row) => row.previous && (row.mentionChanged || row.recommendChanged || row.rankDelta))
							.map((row) => (
								<li key={`${row.provider}-${row.query}`} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
									<p className="font-semibold text-slate-800 dark:text-slate-100">{row.query}</p>
									<p className="text-xs text-slate-500">{row.provider}</p>
									<CompareDelta row={row} />
								</li>
							))}
					</ul>
					{report.compare.every((row) => !row.previous || (!row.mentionChanged && !row.recommendChanged && !row.rankDelta)) ? (
						<p className="text-sm text-slate-500">{t('probeRankSame')}</p>
					) : null}
				</AsiCard>
			) : (
				<p className="text-sm text-slate-500">{t('probeCompareNone')}</p>
			)}

			{byQuery.map(({ query, records }) => (
				<div key={query} className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{query}</h3>
						<Link
							href={`/intelligence/recommendation-test?q=${encodeURIComponent(query)}`}
							className={`${ASI_CTA} h-9 px-3 text-xs`}
						>
							{t('probeOpenTest')}
						</Link>
					</div>
					<AsiTableFrame>
						<table className="min-w-[720px] w-full border-collapse text-left text-xs">
							<thead>
								<tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:border-slate-800">
									<th className="py-2 pr-3">{t('probeColQuery')}</th>
									<th className="py-2 pr-3">{t('probeColProvider')}</th>
									<th className="py-2 pr-3">{t('probeColResponse')}</th>
									<th className="py-2 pr-3">
										<AsiMetricHeading label={t('probeColMention')} metric="actualMention" />
									</th>
									<th className="py-2 pr-3">
										<AsiMetricHeading label={t('probeColRecommend')} metric="actualRank" />
									</th>
									<th className="py-2 pr-3">{t('probeColCompetitor')}</th>
									<th className="py-2">{t('probeColCitation')}</th>
								</tr>
							</thead>
							<tbody>
								{records.map((record) => {
									const line = extractLine(t, record.extracted);
									const compare = report.compare.find(
										(row) => row.query === record.query && row.provider === record.provider,
									);
									return (
										<tr
											key={`${record.runId}-${record.provider}-${record.query}`}
											className={`border-b border-slate-100 align-top dark:border-slate-800 ${ASI_HOVER_MOTION}`}
										>
											<td className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-100">{record.query}</td>
											<td className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-100">{record.provider}</td>
											<td className="max-w-xs py-2 pr-3 text-slate-600 dark:text-slate-300">
												<p className="line-clamp-3">{record.response.answer || '—'}</p>
												{record.response.fallback ? (
													<span className={`${ASI_BADGE} mt-1 border-amber-200 bg-amber-50 text-amber-800`}>
														fallback
													</span>
												) : null}
											</td>
											<td className="py-2 pr-3 font-semibold">{line.mention}</td>
											<td className="py-2 pr-3 font-semibold">
												<p>{line.recommend}</p>
												{compare ? <CompareDelta row={compare} /> : null}
											</td>
											<td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{line.competitors}</td>
											<td className="py-2 text-slate-600 dark:text-slate-300">{line.citations}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</AsiTableFrame>
				</div>
			))}
		</div>
	);
}
