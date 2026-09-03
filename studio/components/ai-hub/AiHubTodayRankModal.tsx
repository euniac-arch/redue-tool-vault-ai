'use client';

import { useEffect, useState } from 'react';
import { Crown, Flame, Globe2, Sparkles, TrendingUp, X } from 'lucide-react';
import { AI_RANKING_SOURCE_CAPTION } from '@/lib/ai-hub/ai-ranking';
import { formatKstRankingAsOfLabel, type DailyAiRankingAnalysis, type RankedLiveAiTool } from '@/lib/ai-hub/live-ai-rankings';
import { CATEGORY_SOLID_ACCENT, GrowthBadge, RankBadge, RankChangeBadge, RisingStatusBadge } from '@/components/admin/ai-tools/ai-tools-badges';

interface AiHubTodayRankModalProps {
	tools: RankedLiveAiTool[];
	analysis: DailyAiRankingAnalysis;
	dateKey: string;
	onClose: () => void;
}

export function AiHubTodayRankModal({ tools, analysis, dateKey, onClose }: AiHubTodayRankModalProps) {
	const [logoFailedIds, setLogoFailedIds] = useState<Set<string>>(new Set());

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}
		window.addEventListener('keydown', onKeyDown);

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [onClose]);

	const today = formatKstRankingAsOfLabel(dateKey);
	const top10 = analysis.globalTop;
	const champions = analysis.categoryChampions;
	const newEntries = analysis.newEntries.slice(0, 4);
	const rising = analysis.rising.slice(0, 8);

	function markLogoFailed(id: string) {
		setLogoFailedIds((prev) => new Set(prev).add(id));
	}

	return (
		<div
			className="fixed inset-0 z-[999] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
			role="presentation"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="ai-hub-today-rank-title"
				onClick={(event) => event.stopPropagation()}
				className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl dark:border-slate-700 dark:bg-slate-900"
			>
				<header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 px-5 py-4 text-white dark:border-slate-700 dark:from-slate-950 dark:to-slate-800">
					<div className="min-w-0">
						<div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/70">
							<Globe2 className="h-3.5 w-3.5" aria-hidden />
							{today}
						</div>
						<h2 id="ai-hub-today-rank-title" className="mt-1 text-xl font-bold tracking-tight">
							오늘자 글로벌 AI 순위 분석
						</h2>
						<p className="mt-1 text-xs font-medium text-white/70">
							라이브 카탈로그 {tools.length}개 도구 · 트래픽 지수 기준 동적 산출
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
						<section className="grid gap-3 sm:grid-cols-2">
							{analysis.topMover && analysis.topMover.rankDelta > 0 ? (
								<BriefingCard
									icon={Flame}
									kicker="오늘의 급상승"
									tool={analysis.topMover}
									detail={`어제 ${analysis.topMover.previousRank}위 → 오늘 ${analysis.topMover.currentRank}위`}
									logoFailed={logoFailedIds.has(analysis.topMover.id)}
									onLogoError={() => markLogoFailed(analysis.topMover!.id)}
								/>
							) : null}
							{newEntries[0] ? (
								<BriefingCard
									icon={Sparkles}
									kicker="오늘의 신규 진입"
									tool={newEntries[0]}
									detail={`${newEntries.length}개 도구가 랭킹에 새로 올랐습니다`}
									logoFailed={logoFailedIds.has(newEntries[0].id)}
									onLogoError={() => markLogoFailed(newEntries[0].id)}
									isNew
								/>
							) : null}
						</section>

						{rising.length > 0 ? (
							<section>
								<SectionTitle icon={Flame} label="오늘자 라이징 / Emerging" />
								<div className="mt-2.5 grid gap-3 sm:grid-cols-2">
									{rising.map((tool) => (
										<div
											key={tool.id}
											className="flex items-center gap-2.5 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-3 dark:border-orange-900/40 dark:from-orange-950/30 dark:to-slate-800"
										>
											<ToolLogo
												tool={tool}
												failed={logoFailedIds.has(tool.id)}
												onError={() => markLogoFailed(tool.id)}
											/>
											<div className="min-w-0 flex-1">
												<p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{tool.name}</p>
												<p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
													{tool.developer} · 버즈 {tool.trendScore} · {tool.growthRate >= 0 ? '+' : ''}
													{tool.growthRate.toFixed(1)}%
												</p>
											</div>
											<RisingStatusBadge status={tool.status} isRising={tool.isRising} />
										</div>
									))}
								</div>
							</section>
						) : null}

						<section>
							<SectionTitle icon={Crown} label="카테고리별 1위 챔피언" />
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

						<section>
							<SectionTitle icon={TrendingUp} label="글로벌 전체 TOP 10 랭킹" />
							<div className="mt-2.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
								<table className="w-full min-w-[560px] border-collapse text-left text-sm">
									<thead>
										<tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
											<th className="px-3 py-2.5">순위</th>
											<th className="px-3 py-2.5">AI 서비스</th>
											<th className="hidden px-3 py-2.5 text-right md:table-cell">월간 방문자</th>
											<th className="px-3 py-2.5">글로벌 점유율</th>
											<th className="px-3 py-2.5 text-right">변동</th>
										</tr>
									</thead>
									<tbody>
										{top10.map((tool) => (
											<tr
												key={tool.id}
												className="border-t border-slate-100 text-slate-700 dark:border-slate-700/60 dark:text-slate-200"
											>
												<td className="px-3 py-2.5">
													<div className="flex items-center gap-1.5">
														<RankBadge rank={tool.currentRank} />
														<RankChangeBadge isNew={tool.isNew} delta={tool.rankDelta} />
													</div>
												</td>
												<td className="px-3 py-2.5">
													<div className="flex min-w-0 items-center gap-2">
														<ToolLogo
															tool={tool}
															failed={logoFailedIds.has(tool.id)}
															onError={() => markLogoFailed(tool.id)}
														/>
														<div className="min-w-0">
															<p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{tool.name}</p>
															<p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
																{tool.developer}
															</p>
														</div>
													</div>
												</td>
												<td className="hidden px-3 py-2.5 text-right text-xs font-bold text-slate-600 dark:text-slate-300 md:table-cell">
													{tool.monthly_visits}
												</td>
												<td className="px-3 py-2.5">
													<div className="flex items-center gap-2">
														<div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60 sm:w-24">
															<div
																className={`h-full rounded-full ${CATEGORY_SOLID_ACCENT[tool.category]}`}
																style={{ width: `${Math.min(tool.globalSharePct, 100)}%` }}
															/>
														</div>
														<span className="shrink-0 text-xs font-bold text-slate-700 dark:text-slate-200">
															{tool.globalSharePct.toFixed(1)}%
														</span>
													</div>
												</td>
												<td className="px-3 py-2.5 text-right">
													<GrowthBadge growth={tool.growth} />
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<p className="mt-2.5 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
								{AI_RANKING_SOURCE_CAPTION}
							</p>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}

function SectionTitle({ icon: Icon, label }: { icon: typeof Crown; label: string }) {
	return (
		<div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
			<Icon className="h-3.5 w-3.5" aria-hidden />
			{label}
		</div>
	);
}

function BriefingCard({
	icon: Icon,
	kicker,
	tool,
	detail,
	logoFailed,
	onLogoError,
	isNew = false,
}: {
	icon: typeof Flame;
	kicker: string;
	tool: RankedLiveAiTool;
	detail: string;
	logoFailed: boolean;
	onLogoError: () => void;
	isNew?: boolean;
}) {
	return (
		<div className="flex flex-col gap-2 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-3.5 dark:border-cyan-900/50 dark:from-cyan-950/30 dark:to-slate-800">
			<div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
				<Icon className="h-3.5 w-3.5" aria-hidden />
				{kicker}
			</div>
			<div className="flex min-w-0 items-center gap-2.5">
				<ToolLogo tool={tool} failed={logoFailed} onError={onLogoError} />
				<div className="min-w-0">
					<p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{tool.name}</p>
					<p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tool.developer}</p>
				</div>
				<RankChangeBadge isNew={isNew || tool.isNew} delta={tool.rankDelta} />
			</div>
			<p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{detail}</p>
		</div>
	);
}

function ChampionCard({
	tool,
	categoryLabel,
	logoFailed,
	onLogoError,
}: {
	tool: RankedLiveAiTool;
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
					<p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{tool.developer}</p>
				</div>
			</div>
			<div className="flex items-center justify-between text-xs">
				<span className="font-bold text-slate-700 dark:text-slate-200">{tool.categorySharePct.toFixed(1)}%</span>
				<GrowthBadge growth={tool.growth} />
			</div>
		</div>
	);
}

function ToolLogo({
	tool,
	failed,
	onError,
}: {
	tool: RankedLiveAiTool;
	failed: boolean;
	onError: () => void;
}) {
	if (failed || !tool.logo_url) {
		return (
			<span
				className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${CATEGORY_SOLID_ACCENT[tool.category]}`}
				aria-hidden
			>
				{tool.name.charAt(0).toUpperCase()}
			</span>
		);
	}
	return (
		// eslint-disable-next-line @next/next/no-img-element -- external favicon URLs, no next/image domain config needed
		<img
			src={tool.logo_url}
			alt=""
			aria-hidden
			loading="lazy"
			onError={onError}
			className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1 dark:border-slate-700"
		/>
	);
}
