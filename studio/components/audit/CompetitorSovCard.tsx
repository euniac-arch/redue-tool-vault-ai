'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, ArrowUp, ChevronDown, Crosshair, ExternalLink, Loader2, RotateCcw, Search } from 'lucide-react';
import { displayTargetUrl } from '@/lib/audit/target-entity';
import { useTranslations } from 'next-intl';
import {
	applySovCustomKeywords,
	applySovQueryIndex,
	parseSovCustomKeywords,
	type SovAnalysisResult,
	type SovLeaderboardEntry,
} from '@/lib/audit/sov-analysis';
import { scrollToSolutionPackages } from '@/lib/audit/solution-packages';
import {
	applyLiveSovMeasurement,
	resolveSovResultCta,
	type LiveSovAnalysisResponse,
} from '@/lib/audit/sov-live-overlay';

export interface CompetitorSovCardProps {
	/** Standardized SoV diagnostic — industry/region derived, brand-name-free queries. */
	analysis: SovAnalysisResult;
	/** Audited site URL shown under the subtitle and opened in a new tab. */
	siteUrl?: string;
}

function barClass(entry: SovLeaderboardEntry): string {
	if (entry.isClient && entry.rank === 1) return 'h-full rounded-full bg-indigo-500 transition-all duration-500 dark:bg-indigo-400';
	if (entry.isClient) return 'h-full rounded-full bg-rose-500 transition-all duration-500 dark:bg-rose-500';
	if (entry.role === 'viral') return 'h-full rounded-full bg-amber-400 transition-all duration-500 dark:bg-amber-600';
	if (entry.role === 'competitor') return 'h-full rounded-full bg-slate-500 transition-all duration-500 dark:bg-slate-500';
	return 'h-full rounded-full bg-slate-300 transition-all duration-500 dark:bg-slate-700';
}

function compositionDonutStyle(rank1: number, rank2: number, own: number, rank3: number): string {
	const a = Math.max(0, rank1);
	const b = a + Math.max(0, rank2);
	const c = b + Math.max(0, own);
	const d = Math.min(100, c + Math.max(0, rank3));
	return `conic-gradient(#64748b 0 ${a}%, #f59e0b ${a}% ${b}%, #f43f5e ${b}% ${c}%, #94a3b8 ${c}% ${d}%)`;
}

/**
 * 통합 시장 랭킹 리더보드 (SoV) — 업종/지역 기반 범용 탐색 질의 기준으로
 * 표준화된 경쟁 구도(1위 경쟁사 · 3자 바이럴 리뷰 · 플랫폼 디렉토리)와
 * 자사의 현실적 점유율 결핍(3–12%) 및 GEO 처방 후 탈환 목표(60–75%)를 보여준다.
 * 브랜드명 직검색이나 파싱 오류 텍스트("일반 검색 분산" 등)는 발생하지 않는다.
 */
export function CompetitorSovCard({ analysis, siteUrl }: CompetitorSovCardProps) {
	const t = useTranslations('audit.advancedGeo.sov');
	const [selectedQueryIndex, setSelectedQueryIndex] = useState(0);
	const [customInput, setCustomInput] = useState('');
	/** Set once the user submits 1–3 custom keywords; re-derives the dynamic Top-3 query set. */
	const [customAnalysis, setCustomAnalysis] = useState<SovAnalysisResult | null>(null);
	const [liveAnalysis, setLiveAnalysis] = useState<SovAnalysisResult | null>(null);
	const [liveStatus, setLiveStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
	const [liveCached, setLiveCached] = useState(false);
	const [snippetOpen, setSnippetOpen] = useState(false);

	useEffect(() => {
		setCustomAnalysis(null);
		setLiveAnalysis(null);
		setLiveStatus('idle');
		setSelectedQueryIndex(0);
		setCustomInput('');
	}, [analysis.identityKey]);

	const structural = customAnalysis ?? analysis;
	const queryKey = structural.analyzedQueries.join('|');

	useEffect(() => {
		const controller = new AbortController();
		let cancelled = false;

		async function measure() {
			if (!structural.brandName || !structural.analyzedQueries.length) {
				setLiveStatus('error');
				return;
			}
			setLiveStatus('loading');
			setLiveAnalysis(null);
			try {
				const res = await fetch('/api/diagnose/sov-analysis', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						targetBrand: structural.brandName,
						region: structural.region,
						queries: structural.analyzedQueries,
						siteUrl: siteUrl || undefined,
						lang: structural.lang,
					}),
					signal: controller.signal,
				});
				const payload = (await res.json()) as LiveSovAnalysisResponse & { success?: boolean; error?: string };
				if (cancelled) return;
				if (!res.ok || !payload.success || !payload.slices?.length || payload.degraded || payload.provider === 'estimate') {
					setLiveStatus('error');
					return;
				}
				setLiveCached(payload.cached === true);
				setLiveAnalysis(applyLiveSovMeasurement(structural, payload));
				setLiveStatus('ready');
			} catch (err) {
				if (cancelled || controller.signal.aborted) return;
				console.error('[CompetitorSovCard] live SoV fetch failed', err);
				setLiveStatus('error');
			}
		}

		void measure();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [structural.brandName, structural.region, structural.lang, queryKey, siteUrl]);

	const baseAnalysis = liveAnalysis ?? structural;
	const displayed = useMemo(
		() => applySovQueryIndex(baseAnalysis, selectedQueryIndex),
		[baseAnalysis, selectedQueryIndex],
	);
	const activeQuery = displayed.targetQuery;

	const rank1 = displayed.leaderboard.find((row) => row.rank === 1);
	const rank2 = displayed.leaderboard.find((row) => row.rank === 2);
	const rank3 = displayed.leaderboard.find((row) => row.rank === 3);
	const ownRow = displayed.leaderboard.find((row) => row.isClient);
	const ownUnranked = ownRow && ownRow.rank === 0 ? ownRow : null;
	const rankingRows = [rank1, rank2, rank3].filter((row): row is SovLeaderboardEntry => Boolean(row));
	const isMeasuring = liveStatus === 'loading' || liveStatus === 'idle';
	const showEstimateBadge = isMeasuring || liveStatus === 'error' || Boolean(displayed.liveDegraded);
	const pieOwn = ownUnranked?.share ?? 0;

	const currentSov = displayed.currentSov;
	const targetSov = displayed.targetSov;
	const potentialGain = displayed.reclaimPotential;
	const currentSovWidth = Math.min(100, Math.max(0, currentSov));
	const targetSovWidth = Math.min(100, Math.max(0, targetSov));
	const rank1Share = rank1?.share ?? 0;
	const rank2Share = rank2?.share ?? 0;
	const rank3Share = rank3?.share ?? 0;
	const ctaKind = resolveSovResultCta(displayed.ownRank ?? ownRow?.rank ?? 0, currentSov);

	const handleQuerySelect = (index: number) => {
		setSelectedQueryIndex(index);
	};

	/**
	 * Dynamic Query Generator — reconstructs the Top-3 diagnostic query set
	 * from 1–3 user-typed keywords, always padding remaining slots with the
	 * auto-generated fallback queries so exactly 3 chips stay on screen.
	 */
	const handleCustomKeywordsSubmit = (e: FormEvent) => {
		e.preventDefault();
		const keywords = parseSovCustomKeywords(customInput);
		if (!keywords.length) return;
		const next = applySovCustomKeywords(analysis, keywords);
		setCustomAnalysis(next);
		setLiveAnalysis(null);
		setSelectedQueryIndex(0);
	};

	const handleResetToAuto = () => {
		if (!customAnalysis) return;
		setCustomAnalysis(null);
		setLiveAnalysis(null);
		setCustomInput('');
		setSelectedQueryIndex(0);
	};

	const siteHref = (siteUrl || '').trim();
	const siteLabel = siteHref ? displayTargetUrl(siteHref) : '';

	return (
		<section
			id="ai-sov-gap"
			className="relative pdf-page-item audit-report-section scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6"
			data-sov-industry={displayed.industry}
			data-sov-region={displayed.targetSite.region}
			data-sov-category={displayed.targetSite.category}
			data-sov-query={activeQuery}
			data-sov-query-index={displayed.selectedQueryIndex}
			data-sov-intent={displayed.queryIntent}
		>
			<div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div>
					<span
						className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide ${
							showEstimateBadge ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
						}`}
					>
						{showEstimateBadge && isMeasuring ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
						{showEstimateBadge
							? t('liveEstimateBadge')
							: displayed.liveMeasured
								? t('liveMeasuredBadge')
								: t('liveRankBadge')}
					</span>
					<h3 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">{t('title')}</h3>
					<p className="mt-1 break-keep text-xs text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
					{siteHref && siteLabel ? (
						<a
							href={siteHref}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={t('siteLinkAria', { url: siteLabel })}
							className="mt-1.5 inline-flex max-w-full items-center gap-1 break-all text-xs font-medium text-blue-600 underline-offset-2 transition hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
						>
							<span className="min-w-0 truncate">{siteLabel}</span>
							<ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
						</a>
					) : null}
				</div>

				<div
					className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-950/60 md:w-auto md:min-w-[300px]"
					aria-label={t('versus', { own: currentSov, toBe: targetSov, delta: potentialGain })}
				>
					<div
						className="relative h-14 w-14 shrink-0 rounded-full"
						style={{ background: compositionDonutStyle(rank1Share, rank2Share, pieOwn, rank3Share) }}
						aria-label={t('compositionAria', { rank1: rank1Share, rank2: rank2Share, own: currentSov, third: rank3Share })}
					>
						<div className="absolute inset-1.5 rounded-full bg-white dark:bg-slate-950" />
						<span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${displayed.placement === 'first' ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
							{currentSov}%
						</span>
					</div>
					<div className="min-w-0 flex-1">
						<div className="mb-2.5 flex items-center justify-between gap-3">
							<span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('gapAnalysisLabel')}</span>
							{displayed.placement === 'first' ? (
								<span className="inline-flex items-center gap-1 rounded-md border border-indigo-200/60 bg-indigo-50 px-2 py-0.5 text-xs font-extrabold text-indigo-600 dark:border-indigo-800/60 dark:bg-indigo-950/50 dark:text-indigo-400">
									{t('monopolyHoldBadge')}
								</span>
							) : (
								<span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-xs font-extrabold text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-400">
									<ArrowUp className="h-3 w-3" strokeWidth={3} aria-hidden />
									{t('recaptureDeltaBadge', { delta: potentialGain })}
								</span>
							)}
						</div>

						<div className="relative mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
							<div
								className="absolute top-0 left-0 h-full rounded-full bg-blue-200 transition-all duration-500 dark:bg-blue-900/70"
								style={{ width: `${targetSovWidth}%` }}
							/>
							<div
								className="absolute top-0 left-0 h-full rounded-full bg-rose-500 transition-all duration-500"
								style={{ width: `${currentSovWidth}%` }}
							/>
						</div>

						<div className="flex items-center justify-between text-xs">
							<div className="flex items-baseline gap-1">
								<span className="text-[11px] text-slate-400">{t('asIsSummaryLabel')}</span>
								<span className="font-bold text-rose-600 dark:text-rose-400">{currentSov}%</span>
							</div>
							<ArrowRight className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
							<div className="flex items-baseline gap-1">
								<span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{t('geoTargetLabel')}</span>
								<span className="text-sm font-black text-blue-700 dark:text-blue-300">{targetSov}%</span>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="mt-4 space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="inline-flex items-center gap-2">
						<div className="flex items-center justify-center text-blue-600 dark:text-blue-400">
							<Crosshair className="h-4 w-4" strokeWidth={2} aria-hidden />
						</div>
						<span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('currentQueryLabel')}</span>
						<span className="text-xs text-slate-300 dark:text-slate-600" aria-hidden>
							|
						</span>
						<span className="inline-flex items-center gap-0.5 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
							<span className="font-medium text-blue-400">#</span>
							<span className="break-keep">{activeQuery}</span>
						</span>
						<span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
							{displayed.queryIntent === 'specialty'
								? t('queryIntentSpecialty')
								: displayed.queryIntent === 'problem'
									? t('queryIntentProblem')
									: t('queryIntentBroad')}
						</span>
						{displayed.queryMode === 'custom' ? (
							<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
								{t('customModeBadge')}
							</span>
						) : null}
						{displayed.liveMeasured && liveCached ? (
							<span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
								{t('liveCachedBadge')}
							</span>
						) : null}
					</div>

					<div className="flex items-center gap-1.5">
						<form onSubmit={handleCustomKeywordsSubmit} className="flex h-8 items-center gap-1.5">
							<div className="relative h-8 w-56 max-w-full">
								<input
									type="text"
									value={customInput}
									onChange={(e) => setCustomInput(e.target.value)}
									placeholder={t('queryPlaceholder')}
									className="h-8 w-full rounded-lg border border-slate-200 bg-white py-0 pl-7 pr-2.5 text-xs leading-none text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
								/>
								<Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
							</div>
							<button
								type="submit"
								disabled={!parseSovCustomKeywords(customInput).length}
								className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700"
							>
								{t('querySubmit')}
							</button>
						</form>
						{displayed.queryMode === 'custom' ? (
							<button
								type="button"
								onClick={handleResetToAuto}
								className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
							>
								<RotateCcw className="h-3 w-3" aria-hidden />
								{t('resetAutoQueries')}
							</button>
						) : null}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 pt-1">
					{displayed.analyzedQueries.filter(Boolean).map((query, index) => {
						const isSelected = displayed.selectedQueryIndex === index;
						return (
							<button
								key={`${index}-${query}`}
								type="button"
								aria-pressed={isSelected}
								onClick={() => handleQuerySelect(index)}
								className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-150 ${
									isSelected
										? 'border-blue-200 bg-blue-50 font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
										: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
								}`}
							>
								<span className="font-normal text-slate-400">#</span>
								<span className="break-keep">{query}</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className="mt-5 space-y-4" aria-label={t('chartAria')} data-sov-active-query={activeQuery} data-sov-degraded={showEstimateBadge ? '1' : '0'}>
				{showEstimateBadge ? (
					<div
						className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300"
						role="status"
						aria-live="polite"
					>
						{isMeasuring ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : null}
						<span className="break-keep">{t('liveEstimateBadge')}</span>
					</div>
				) : null}
				{rankingRows.map((row) => (
					<div key={`${row.rank}-${row.name}`} className="space-y-3">
						<div className="flex items-center justify-between text-xs">
							<div className="flex min-w-0 flex-col gap-1">
								<div className="flex flex-wrap items-center gap-1.5">
									<span
										className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-black text-white ${
											row.isClient && row.rank === 1
												? 'bg-indigo-600'
												: row.isClient
													? 'bg-rose-600'
													: 'bg-slate-700 dark:bg-slate-600'
										}`}
									>
										{t('rankLabel', { rank: row.rank })}
									</span>
									<span className="font-semibold text-slate-800 dark:text-slate-200">{row.name}</span>
									{row.isClient ? (
										<span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400">
											{t('clientBadge')}
										</span>
									) : (
										<span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
											{t('rankBadge')}
										</span>
									)}
								</div>
								{row.reason ? (
									<p className="break-keep pl-7 text-[11px] text-slate-500 dark:text-slate-400">
										{t('liveReasonPrefix')}: {row.reason}
									</p>
								) : null}
							</div>
							<span className={`shrink-0 font-extrabold ${row.isClient ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
								{row.share}%
							</span>
						</div>
						<div className="flex h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
							<div className={barClass(row)} style={{ width: `${row.share}%` }} />
						</div>
					</div>
				))}

				{ownUnranked ? (
					<div className="space-y-3">
						<div className="flex items-center justify-between text-xs">
							<div className="flex flex-wrap items-center gap-1.5">
								<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-rose-600 px-1 text-[10px] font-black text-white">
									{t('unrankedMark')}
								</span>
								<span className="font-semibold text-slate-900 dark:text-white">{ownUnranked.name}</span>
								<span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400">
									{t('clientBadge')}
								</span>
								<span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-400">
									{t('unrankedBadge')}
								</span>
								<span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-400">
									{t('citationGapBadge')}
								</span>
							</div>
							<span className="font-extrabold text-rose-600 dark:text-rose-400" data-sov-own-share={ownUnranked.share}>
								{ownUnranked.share}%
								<span className="font-normal text-slate-400"> {t('toBeInline', { toBe: targetSov })}</span>
							</span>
						</div>
						<div className="flex h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
							<div className={barClass(ownUnranked)} style={{ width: `${ownUnranked.share}%` }} />
						</div>
					</div>
				) : null}

				<div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40">
					<button
						type="button"
						aria-expanded={snippetOpen}
						onClick={() => setSnippetOpen((open) => !open)}
						className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800"
					>
						<span>{t('snippetToggle')}</span>
						<ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${snippetOpen ? 'rotate-180' : ''}`} aria-hidden />
					</button>
					{snippetOpen ? (
						<blockquote className="whitespace-pre-wrap break-keep border-t border-slate-200 px-3.5 py-3 text-[12px] leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-300">
							{displayed.recommendationSnippet?.trim() || t('snippetEmpty')}
						</blockquote>
					) : null}
				</div>
			</div>

			<div
				className={`mt-5 rounded-xl p-3.5 ${
					displayed.placement === 'first'
						? 'border border-indigo-100 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/10'
						: 'border border-rose-100 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10'
				}`}
			>
				<div className="flex items-start gap-2.5">
					<AlertCircle
						className={`mt-0.5 h-4 w-4 shrink-0 ${displayed.placement === 'first' ? 'text-indigo-500 dark:text-indigo-400' : 'text-rose-500 dark:text-rose-400'}`}
						aria-hidden
					/>
					<div className="space-y-1 break-keep text-xs leading-relaxed">
						<p className="text-slate-700 dark:text-slate-300">{displayed.summary}</p>
					</div>
				</div>
			</div>

			<button
				type="button"
				data-sov-cta={ctaKind}
				onClick={scrollToSolutionPackages}
				className={`mt-4 flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-xs font-semibold leading-relaxed shadow-sm transition hover:opacity-95 ${
					ctaKind === 'defend'
						? 'border border-indigo-200 bg-indigo-600 text-white dark:border-indigo-400/40 dark:bg-indigo-500'
						: 'border border-rose-200 bg-rose-600 text-white dark:border-rose-400/40 dark:bg-rose-500'
				}`}
			>
				<span className="break-keep">{ctaKind === 'defend' ? t('ctaDefend') : t('ctaRecover')}</span>
				<ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
			</button>

			<div className="mt-3 rounded-lg border-t-2 border-slate-200 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/30">
				<p className="break-keep text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 sm:text-xs">
					<span className="font-semibold text-slate-500 dark:text-slate-400">{t('dataScopeNoteLabel')}</span>
					<span>: {t('dataScopeNoteBody')}</span>
				</p>
			</div>
		</section>
	);
}
