'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCw, Sparkles, TriangleAlert } from 'lucide-react';
import { formatResearchAnalyzedLabel } from '@/lib/insights/insights-ai-research-cache';
import { researchArticleToNewsItem, type InsightsAiResearchResult } from '@/lib/insights/insights-ai-research';
import type { InsightsNewsItem } from '@/lib/insights/insights-news-types';
import { InsightsNewsCard } from './InsightsNewsCard';

interface InsightsAiResearchPanelProps {
	result: InsightsAiResearchResult | null;
	currentQuery?: string;
	loading: boolean;
	error: string | null;
	savedNewsIds: string[];
	vaultUrls?: string[];
	savingVaultUrl?: string | null;
	onToggleSave: (item: InsightsNewsItem) => void;
	onSaveToVault?: (item: InsightsNewsItem) => void;
	onShareResult: (ok: boolean, message: string) => void;
	onRetry?: () => void;
	onReanalyze?: () => void;
}

function reportTitle(query: string): string {
	return `'${query}'에 대한 AI 실시간 분석 리포트`;
}

function useTypedText(text: string, enabled: boolean) {
	const [shown, setShown] = useState('');

	useEffect(() => {
		if (!enabled || !text) {
			setShown(text);
			return;
		}
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion) {
			setShown(text);
			return;
		}
		setShown('');
		let index = 0;
		const timer = window.setInterval(() => {
			index += 2;
			setShown(text.slice(0, index));
			if (index >= text.length) window.clearInterval(timer);
		}, 16);
		return () => window.clearInterval(timer);
	}, [text, enabled]);

	return shown;
}

export function InsightsAiResearchPanel({
	result,
	currentQuery = '',
	loading,
	error,
	savedNewsIds,
	vaultUrls = [],
	savingVaultUrl = null,
	onToggleSave,
	onSaveToVault,
	onShareResult,
	onRetry,
	onReanalyze,
}: InsightsAiResearchPanelProps) {
	const isFreshResult = Boolean(result && !loading && result.searchedAt && Date.now() - result.searchedAt < 4_000);
	const typedSummary = useTypedText(result?.summary || '', isFreshResult);
	const cards = useMemo(
		() => (result?.articles || []).map((article, index) => researchArticleToNewsItem(article, index)),
		[result],
	);
	const query = (currentQuery || result?.query || '').trim();
	const analyzedAt = result?.searchedAt;
	const [nowTick, setNowTick] = useState(() => Date.now());

	useEffect(() => {
		if (!analyzedAt || loading) return;
		const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
		return () => window.clearInterval(timer);
	}, [analyzedAt, loading]);

	if (loading) {
		return (
			<div className="flex flex-col gap-5">
				<div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5">
					{query ? (
						<h3 className="mb-3 text-sm font-bold leading-snug text-white md:text-base">{reportTitle(query)}</h3>
					) : (
						<div className="mb-3 h-3 w-28 animate-pulse rounded-full bg-cyan-400/20" />
					)}
					<div className="space-y-2">
						<div className="h-3 w-full animate-pulse rounded-full bg-slate-700/70" />
						<div className="h-3 w-11/12 animate-pulse rounded-full bg-slate-700/70" />
						<div className="h-3 w-4/5 animate-pulse rounded-full bg-slate-700/70" />
						<div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-700/70" />
					</div>
					<div className="mt-4 flex items-center gap-2 text-xs font-semibold text-cyan-300">
						<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
						gpt-4o-mini가 최신 기사 5건을 분석하는 중…
					</div>
				</div>
				<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 3 }).map((_, index) => (
						<div
							key={index}
							className="h-56 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50"
						/>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-2xl border border-rose-300/40 bg-rose-950/20 px-5 py-10 text-center">
				<TriangleAlert className="mx-auto h-6 w-6 text-rose-300" aria-hidden />
				<p className="mt-3 text-sm font-semibold text-rose-100">
					리서치 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
				</p>
				<p className="mt-2 text-xs leading-relaxed text-rose-200/80">{error}</p>
				{onRetry ? (
					<button
						type="button"
						onClick={onRetry}
						className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3.5 text-xs font-bold text-rose-100 transition hover:bg-rose-500/20"
					>
						<RotateCw className="h-3.5 w-3.5" aria-hidden />
						다시 시도
					</button>
				) : null}
			</div>
		);
	}

	if (!result) {
		return (
			<div className="rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-950/10 px-5 py-14 text-center">
				<Sparkles className="mx-auto h-6 w-6 text-cyan-400" aria-hidden />
				<p className="mt-3 text-sm font-semibold text-slate-200">AI 실시간 리서치를 시작해 보세요</p>
				<p className="mt-1 text-xs leading-relaxed text-slate-400">
					질문을 입력하면 최신 뉴스 5건을 수집하고, gpt-4o-mini가 SEO/GEO 시사점을 정리합니다.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-5">
			<section className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 shadow-[0_0_40px_rgba(8,47,73,0.18)] backdrop-blur-md">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						{query ? (
							<h3 className="text-sm font-bold leading-snug text-white md:text-base">{reportTitle(query)}</h3>
						) : null}
						{analyzedAt ? (
							<p className="mt-1.5 text-[11px] font-semibold text-slate-400">
								{formatResearchAnalyzedLabel(analyzedAt, nowTick)}
							</p>
						) : null}
					</div>
					{onReanalyze ? (
						<button
							type="button"
							onClick={onReanalyze}
							className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-500/20"
						>
							<RotateCw className="h-3.5 w-3.5" aria-hidden />
							최신 기사로 재분석
						</button>
					) : null}
				</div>
				<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
					<p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-300">
						<Sparkles className="h-3.5 w-3.5" aria-hidden />
						AI 분석 요약
					</p>
					<p className="text-[11px] font-semibold text-slate-400">{result.model}</p>
				</div>
				{result.warning ? (
					<p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-200">
						{result.warning}
					</p>
				) : null}
				<p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
					{typedSummary}
					{typedSummary.length < result.summary.length ? (
						<span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-cyan-300 align-[-2px]" />
					) : null}
				</p>
				{result.insights.length > 0 && (
					<ul className="mt-4 space-y-2">
						{result.insights.map((insight) => (
							<li
								key={insight}
								className="flex gap-2 text-sm leading-relaxed text-cyan-50/90"
							>
								<span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
								<span>{insight}</span>
							</li>
						))}
					</ul>
				)}
			</section>

			<div>
				<p className="mb-3 text-xs font-bold text-slate-400">출처 기사 {cards.length}건</p>
				<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
					{cards.map((item) => (
						<InsightsNewsCard
							key={item.id}
							item={item}
							saved={savedNewsIds.includes(item.id) || savedNewsIds.includes(item.sourceUrl)}
							onToggleSave={onToggleSave}
							onShareResult={onShareResult}
							showVaultSave
							vaultSaved={vaultUrls.includes(item.sourceUrl)}
							vaultSaving={savingVaultUrl === item.sourceUrl}
							onSaveToVault={onSaveToVault}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
