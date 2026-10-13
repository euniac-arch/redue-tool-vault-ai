'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, Globe2, X } from 'lucide-react';
import type { AiTool } from '@/lib/admin/ai-tools-management';
import { MarketFootnotes, MarketProvenance, ReferralShareTable, WebTrafficRankTable } from '@/components/ai-hub/MarketObservationPanels';
import type { DailyAiRankingAnalysis, RankedLiveAiTool } from '@/lib/ai-hub/live-ai-rankings';
import type { MarketBundle } from '@/lib/ai-hub/market-observations';
import { SHARE_UNAVAILABLE_LABEL } from '@/lib/ai-hub/market-observations';
import { CATEGORY_SOLID_ACCENT } from './ai-tools-badges';

interface TodayRankModalProps {
	tools: Array<AiTool | RankedLiveAiTool>;
	onClose: () => void;
	asOf?: Date;
	dateKey?: string;
	analysis?: DailyAiRankingAnalysis | null;
	market?: MarketBundle | null;
}

export function TodayRankModal({ tools, onClose, analysis, market = null }: TodayRankModalProps) {
	const [logoFailedIds, setLogoFailedIds] = useState<Set<string>>(new Set());
	const names = useMemo(() => {
		const map = new Map<string, { name: string; provider: string }>();
		for (const tool of tools) map.set(tool.id, { name: tool.name, provider: tool.provider });
		return map;
	}, [tools]);
	const champions = analysis?.categoryChampions ?? [];

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onClose]);

	function markLogoFailed(id: string) {
		setLogoFailedIds((prev) => new Set(prev).add(id));
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
			role="presentation"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="today-rank-title"
				onClick={(event) => event.stopPropagation()}
				className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl dark:border-slate-700 dark:bg-slate-800"
			>
				<header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 px-5 py-4 text-white dark:from-slate-950 dark:to-slate-800">
					<div className="min-w-0">
						<div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/70">
							<Globe2 className="h-3.5 w-3.5" aria-hidden />
							글로벌 AI 웹 트래픽
						</div>
						<h2 id="today-rank-title" className="mt-1 text-xl font-bold tracking-tight">
							글로벌 AI 순위 분석
						</h2>
						<p className="mt-1 text-xs font-medium text-white/70">
							검증된 웹 방문 점유율만 표시합니다. 월간 관측을 일간 수치로 바꾸지 않습니다.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="닫기"
						className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
					>
						<X className="h-4 w-4" />
					</button>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
					<div className="flex flex-col gap-6">
						{market ? (
							<section>
								<MarketProvenance bundle={market} />
								<WebTrafficRankTable bundle={market} names={names} />
								<div className="mt-3">
									<MarketFootnotes bundle={market} />
								</div>
							</section>
						) : (
							<p className="text-sm font-semibold text-slate-500">{SHARE_UNAVAILABLE_LABEL}</p>
						)}
						{market ? <ReferralShareTable bundle={market} /> : null}
						{champions.length > 0 ? (
							<section>
								<div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
									<Crown className="h-3.5 w-3.5" aria-hidden />
									카테고리별 에디터 추천
								</div>
								<p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">추천 점수 기준이며 시장 점유율 순위가 아닙니다.</p>
								<div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
									{champions.map(({ key, tool, categoryLabel }) => (
										<ChampionCard
											key={key}
											tool={tool}
											categoryLabel={categoryLabel}
											logoFailed={logoFailedIds.has(tool.id)}
											onLogoError={() => markLogoFailed(tool.id)}
										/>
									))}
								</div>
							</section>
						) : null}
					</div>
				</div>
			</div>
		</div>
	);
}

function ChampionCard({
	tool,
	categoryLabel,
	logoFailed,
	onLogoError,
}: {
	tool: AiTool;
	categoryLabel: string;
	logoFailed: boolean;
	onLogoError: () => void;
}) {
	return (
		<div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3.5 dark:border-amber-800/60 dark:from-amber-950/30 dark:to-slate-800">
			<div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
				<Crown className="h-3 w-3" aria-hidden />
				{categoryLabel}
			</div>
			<div className="flex min-w-0 items-center gap-2.5">
				<ToolLogo tool={tool} failed={logoFailed} onError={onLogoError} />
				<div className="min-w-0">
					<p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{tool.name}</p>
					<p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tool.provider}</p>
				</div>
			</div>
			<p className="text-xs font-bold text-slate-600 dark:text-slate-300">추천 {tool.recommend_score}점</p>
		</div>
	);
}

function ToolLogo({ tool, failed, onError }: { tool: AiTool; failed: boolean; onError: () => void }) {
	if (failed || !tool.logo_url) {
		return (
			<span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${CATEGORY_SOLID_ACCENT[tool.category]}`} aria-hidden>
				{tool.name.charAt(0).toUpperCase()}
			</span>
		);
	}
	return (
		<img
			src={tool.logo_url}
			alt={`${tool.name} 로고`}
			loading="lazy"
			onError={onError}
			className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1 dark:border-slate-700"
		/>
	);
}
