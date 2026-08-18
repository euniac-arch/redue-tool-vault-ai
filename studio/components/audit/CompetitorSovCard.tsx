'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, ArrowUp, Crosshair, ExternalLink, Loader2, Search } from 'lucide-react';
import { displayTargetUrl } from '@/lib/audit/target-entity';
import { useLocale, useTranslations } from 'next-intl';
import {
	applyKeywordSovToDynamic,
	calculateUnifiedMarketSov,
	normalizeSovKeyword,
	unifiedToDynamicSov,
	type DynamicSovResult,
	type LeaderboardItem,
} from '@/lib/audit/advancedGeoMetrics';
import { generateQueryMatrix } from '@/lib/geo/query-matrix';
import { type IndustryConfig } from '@/lib/registry/universalIndustryRegistry';

export interface CompetitorSovCardProps {
	sovData: DynamicSovResult;
	industryConfig: IndustryConfig;
	clientName?: string;
	region?: string;
	mainService?: string;
	subService?: string;
	/** Dynamic SoV chips from `generateQueryMatrix` — always include a category noun. */
	queryPresets?: [string, string, string];
	/** Audited site URL shown under the subtitle and opened in a new tab. */
	siteUrl?: string;
	onQueryChange?: (newQuery: string) => Promise<DynamicSovResult>;
}

function barClass(item: LeaderboardItem): string {
	if (item.isThirdParty) return 'h-full rounded-full bg-amber-400 transition-all duration-500 dark:bg-amber-600';
	if (item.isClient) return 'h-full rounded-full bg-indigo-600 transition-all duration-500';
	if (item.rank === 1) return 'h-full rounded-full bg-slate-500 transition-all duration-500 dark:bg-slate-500';
	if (item.rank === 2) return 'h-full rounded-full bg-slate-400 transition-all duration-500 dark:bg-slate-600';
	return 'h-full rounded-full bg-slate-300 transition-all duration-500 dark:bg-slate-700';
}

/**
 * 검색 1~3위 통합 시장 리더보드. 자사는 실제 슬롯에 남기고,
 * 3위 밖이면 3위 칸에 `순위 밖`으로 표기한다.
 * SOV share% is market share, not AuditScores — this card never recalculates
 * total / technical / GEO / engine scores.
 */
export function CompetitorSovCard({
	sovData,
	industryConfig,
	clientName,
	region = '',
	mainService = '',
	subService,
	queryPresets,
	siteUrl,
	onQueryChange,
}: CompetitorSovCardProps) {
	const t = useTranslations('audit.advancedGeo.sov');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const resolvedMain = mainService || industryConfig.mainService;
	const resolvedSub = subService || industryConfig.subService;
	const presets = useMemo(
		() =>
			queryPresets ??
			generateQueryMatrix({
				lang,
				location: region,
				primaryKeyword: resolvedMain,
				category: resolvedMain,
				coreSpecialties: [resolvedMain, resolvedSub].filter(Boolean),
			}).sovPresets,
		[queryPresets, region, resolvedMain, resolvedSub, lang],
	);

	const [localSov, setLocalSov] = useState<DynamicSovResult>(sovData);
	const [activeQuery, setActiveQuery] = useState(sovData.targetQuery || presets[0]);
	const [customInput, setCustomInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const requestQueryRef = useRef(activeQuery);

	useEffect(() => {
		const incomingQuery = normalizeSovKeyword(sovData.targetQuery);
		const selectedQuery = normalizeSovKeyword(activeQuery);
		if (incomingQuery && selectedQuery && incomingQuery !== selectedQuery) return;
		setLocalSov(sovData);
		if (sovData.targetQuery) setActiveQuery(sovData.targetQuery);
	}, [sovData, activeQuery]);

	const displaySov = useMemo(
		() =>
			applyKeywordSovToDynamic(localSov, activeQuery, {
				lang,
				industryConfig,
				region,
				mainService: resolvedMain,
			}),
		[localSov, activeQuery, lang, industryConfig, region, resolvedMain],
	);

	const leaderboard =
		displaySov.leaderboard?.length > 0
			? displaySov.leaderboard
			: displaySov.competitors.map((row, idx) => ({
					rank: row.isDirectory ? 0 : idx + 1,
					name: row.name,
					share: row.share,
					isClient: false,
					isRealData: row.isRealData === true,
					isThirdParty: row.isDirectory === true,
				}));
	const rankingRows = leaderboard.filter((row) => !row.isThirdParty);
	const directory = leaderboard.find((row) => row.isThirdParty);
	const leader = rankingRows.find((row) => !row.isClient) ?? rankingRows[0];
	const reclaimGain = displaySov.reclaimGain ?? displaySov.reclaimPotential ?? displaySov.toBeShare - displaySov.asIsShare;
	const currentSov = displaySov.asIsShare;
	const targetSov = displaySov.toBeShare;
	const potentialGain = reclaimGain;
	const currentSovWidth = Math.min(100, Math.max(0, currentSov));
	const targetSovWidth = Math.min(100, Math.max(0, targetSov));
	const leaderFallback = industryConfig.defaultCategory || t('leaderFallback');
	const vulnerability =
		displaySov.vulnerabilityInsight ||
		t('vulnerabilityBody', {
			comp1Name: leader?.name || leaderFallback,
			comp1Share: leader?.share ?? 0,
			toBeShare: displaySov.toBeShare,
			reclaimPotential: reclaimGain,
		});

	const fetchSovByQuery = async (query: string): Promise<DynamicSovResult | null> => {
		if (onQueryChange) return onQueryChange(query);
		const res = await fetch('/api/competitors', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				clientName: clientName || localSov.brandName,
				region,
				mainService: resolvedMain,
				query,
				lang,
			}),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as {
			rankedNames?: string[];
			snapshot?: { rankedNames?: string[]; names?: string[] };
		};
		const ranked = data.snapshot?.rankedNames ?? data.rankedNames ?? data.snapshot?.names ?? [];
		return unifiedToDynamicSov(
			calculateUnifiedMarketSov(clientName || localSov.brandName, region, resolvedMain, ranked, {
				targetQuery: query,
				lang,
				industryConfig,
			}),
			{ lang, industryConfig },
		);
	};

	const handleQuerySelect = async (query: string) => {
		const next = query.trim();
		if (!next || next === activeQuery) return;
		setActiveQuery(next);
		requestQueryRef.current = next;
		setIsLoading(true);
		try {
			const updated = await fetchSovByQuery(next);
			if (updated && requestQueryRef.current === next) setLocalSov(updated);
		} catch (err) {
			console.error('Failed to update SOV rankings:', err);
		} finally {
			if (requestQueryRef.current === next) setIsLoading(false);
		}
	};

	const handleCustomSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!customInput.trim()) return;
		void handleQuerySelect(customInput.trim());
		setCustomInput('');
	};

	const showQueryFilter = Boolean(region || resolvedMain || onQueryChange || clientName);
	const siteHref = (siteUrl || '').trim();
	const siteLabel = siteHref ? displayTargetUrl(siteHref) : '';

	return (
		<section
			id="ai-sov-gap"
			className="pdf-page-item audit-report-section scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-6"
		>
			<div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div>
					<span className="text-xs font-semibold tracking-wide text-blue-600 dark:text-blue-400">
						{t('liveRankBadge')}
					</span>
					<h3 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white">
						{t('title')}
					</h3>
					<p className="mt-1 break-keep text-xs text-slate-500 dark:text-slate-400">
						{t('subtitle')}
					</p>
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
					className="w-full min-w-0 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-950/60 md:w-auto md:min-w-[300px]"
					aria-label={t('versus', { own: currentSov, toBe: targetSov, delta: potentialGain })}
				>
					<div className="mb-2.5 flex items-center justify-between gap-3">
						<span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('gapAnalysisLabel')}</span>
						<span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-xs font-extrabold text-emerald-600 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-400">
							<ArrowUp className="h-3 w-3" strokeWidth={3} aria-hidden />
							{t('recaptureDeltaBadge', { delta: potentialGain })}
						</span>
					</div>

					<div className="relative mb-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
						<div
							className="absolute top-0 left-0 h-full rounded-full bg-blue-200 transition-all duration-500 dark:bg-blue-900/70"
							style={{ width: `${targetSovWidth}%` }}
						/>
						<div
							className="absolute top-0 left-0 h-full rounded-full bg-blue-600 transition-all duration-500"
							style={{ width: `${currentSovWidth}%` }}
						/>
					</div>

					<div className="flex items-center justify-between text-xs">
						<div className="flex items-baseline gap-1">
							<span className="text-[11px] text-slate-400">{t('asIsSummaryLabel')}</span>
							<span className="font-bold text-slate-700 dark:text-slate-200">{currentSov}%</span>
						</div>
						<ArrowRight className="h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
						<div className="flex items-baseline gap-1">
							<span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{t('geoTargetLabel')}</span>
							<span className="text-sm font-black text-blue-700 dark:text-blue-300">{targetSov}%</span>
						</div>
					</div>
				</div>
			</div>

			{showQueryFilter ? (
				<div className="mt-4 space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
					<div className="flex flex-wrap items-center justify-between gap-3">
						{activeQuery ? (
							<div className="inline-flex items-center gap-2">
								<div className="flex items-center justify-center text-blue-600 dark:text-blue-400">
									<Crosshair className="h-4 w-4" strokeWidth={2} aria-hidden />
								</div>
								<span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
									{t('currentQueryLabel')}
								</span>
								<span className="text-xs text-slate-300 dark:text-slate-600" aria-hidden>
									|
								</span>
								<span className="inline-flex items-center gap-0.5 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
									<span className="font-medium text-blue-400">#</span>
									{activeQuery}
								</span>
							</div>
						) : (
							<span />
						)}

						<form onSubmit={handleCustomSubmit} className="flex h-8 items-center gap-1.5">
							<div className="relative h-8 w-48 max-w-full">
								<input
									type="text"
									value={customInput}
									onChange={(e) => setCustomInput(e.target.value)}
									placeholder={t('queryPlaceholder')}
									disabled={isLoading}
									className="h-8 w-full rounded-lg border border-slate-200 bg-white py-0 pl-7 pr-2.5 text-xs leading-none text-slate-900 focus:border-indigo-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
								/>
								<Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
							</div>
							<button
								type="submit"
								disabled={isLoading || !customInput.trim()}
								className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700"
							>
								{isLoading && !presets.includes(activeQuery) ? (
									<Loader2 className="h-3 w-3 animate-spin" aria-hidden />
								) : null}
								{t('querySubmit')}
							</button>
						</form>
					</div>

					{presets.filter(Boolean).length ? (
						<div className="flex flex-wrap items-center gap-2 pt-1">
							{presets.filter(Boolean).map((query) => {
								const isSelected = activeQuery === query;
								const isCurrentLoading = isLoading && isSelected;
								return (
									<button
										key={query}
										type="button"
										onClick={() => void handleQuerySelect(query)}
										disabled={isLoading}
										aria-busy={isCurrentLoading}
										className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-150 ${
											isSelected
												? 'border-blue-200 bg-blue-50 font-semibold text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
												: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
										}`}
									>
										<span className="font-normal text-slate-400">#</span>
										<span>{query}</span>
										{isSelected ? (
											<span className="inline-flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden>
												{isCurrentLoading ? (
													<Loader2 className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
												) : null}
											</span>
										) : null}
									</button>
								);
							})}
						</div>
					) : null}
				</div>
			) : null}

			<div
				className={`mt-5 space-y-4 transition-opacity duration-200 ${isLoading ? 'pointer-events-none opacity-40' : 'opacity-100'}`}
				aria-busy={isLoading}
				aria-label={t('chartAria')}
			>
				{rankingRows.map((row) => {
					const unranked = row.isClient && displaySov.clientRank === 4;
					return (
						<div key={`${row.rank}-${row.name}`} className="space-y-3">
							<div className="flex items-center justify-between text-xs">
								<div className="flex flex-wrap items-center gap-1.5">
									<span
										className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[10px] font-black ${
											row.isClient
												? 'bg-indigo-600 text-white'
												: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
										}`}
									>
										{unranked ? t('unrankedMark') : t('rankLabel', { rank: row.rank })}
									</span>
									<span
										className={`font-semibold ${
											row.isClient ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'
										}`}
									>
										{row.name}
									</span>
									{row.isClient ? (
										<span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400">
											{t('clientBadge')}
										</span>
									) : (
										<span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
											{t('rankBadge')}
										</span>
									)}
									{unranked ? (
										<span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-400">
											{t('unrankedBadge')}
										</span>
									) : null}
									{row.isRealData && !row.isClient ? (
										<span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
											{t('realBadge')}
										</span>
									) : null}
								</div>
								<span
									className={`font-extrabold ${
										row.isClient ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
									}`}
								>
									{row.share}%
									{row.isClient ? (
										<span className="font-normal text-slate-400"> {t('toBeInline', { toBe: displaySov.toBeShare })}</span>
									) : null}
								</span>
							</div>
							<div className="flex h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
								<div className={barClass(row)} style={{ width: `${row.share}%` }} />
							</div>
						</div>
					);
				})}

				{directory ? (
					<div className="space-y-3">
						<div className="flex items-center justify-between text-xs">
							<div className="flex flex-wrap items-center gap-1.5">
								<span className="font-semibold text-slate-800 dark:text-slate-200">{directory.name}</span>
								<span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
									{t('directoryBadge')}
								</span>
							</div>
							<span className="font-bold text-amber-700 dark:text-amber-400">{directory.share}%</span>
						</div>
						<div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
							<div className={barClass(directory)} style={{ width: `${directory.share}%` }} />
						</div>
					</div>
				) : null}
			</div>

			<div className="mt-5 rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 dark:border-rose-900/40 dark:bg-rose-950/20">
				<div className="flex items-start gap-2.5">
					<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" aria-hidden />
					<div className="space-y-1 break-keep text-xs leading-relaxed">
						<p className="font-semibold text-rose-900 dark:text-rose-300">{displaySov.lossInsight}</p>
						<p className="text-slate-600 dark:text-slate-400">{vulnerability}</p>
					</div>
				</div>
			</div>
		</section>
	);
}
