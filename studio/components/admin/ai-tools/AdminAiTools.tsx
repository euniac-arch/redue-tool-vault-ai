'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2, Search, Sparkles, TriangleAlert, Zap } from 'lucide-react';
import {
	AI_TOOL_SORT_OPTIONS,
	countAiToolsByCategory,
	filterAiTools,
	flattenAiToolCategories,
	loadAiTools,
	persistToolVisibility,
	sortAiTools,
	type AiTool,
	type AiToolCategoryRaw,
	type AiToolFilters,
	type AiToolSortKey,
} from '@/lib/admin/ai-tools-management';
import { useDailyAiRankings } from '@/lib/ai-hub/useDailyAiRankings';
import type { RankedLiveAiTool } from '@/lib/ai-hub/live-ai-rankings';
import { AiToolCard } from './AiToolCard';
import { AiToolDetailModal } from './AiToolDetailModal';
import { AiToolsCategoryNav } from './AiToolsCategoryNav';
import { MarketShareBar } from './MarketShareBar';
import { TodayRankModal } from './TodayRankModal';

type Toast = { id: number; message: string; tone?: 'default' | 'error' };

export function AdminAiTools() {
	const { tools: rankedTools, analysis, date, error: rankingError, refetch } = useDailyAiRankings({ includeHidden: true });
	const [tools, setTools] = useState<AiTool[]>([]);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState<AiToolFilters['category']>('all');
	const [sortKey, setSortKey] = useState<AiToolSortKey>('rank');
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [activeModalToolId, setActiveModalToolId] = useState<string | null>(null);
	const [rankModalOpen, setRankModalOpen] = useState(false);
	const [refreshPending, setRefreshPending] = useState(false);

	const pushToast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message, tone }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((toast) => toast.id !== id));
		}, 2400);
	}, []);

	useEffect(() => {
		if (rankedTools.length > 0) {
			setTools((prev) => {
				if (prev.length === 0) return rankedTools;
				const byId = new Map(rankedTools.map((tool) => [tool.id, tool]));
				return prev.map((tool) => byId.get(tool.id) ?? tool);
			});
			return;
		}
		if (rankingError) setTools(loadAiTools());
	}, [rankedTools, rankingError]);

	const dailyTools = useMemo(() => {
		if (tools.length > 0) return tools as RankedLiveAiTool[];
		return rankedTools;
	}, [tools, rankedTools]);
	const filters: AiToolFilters = useMemo(() => ({ query, category }), [query, category]);
	const filteredTools = useMemo(() => filterAiTools(dailyTools, filters), [dailyTools, filters]);
	const sortedTools = useMemo(() => sortAiTools(filteredTools, sortKey), [filteredTools, sortKey]);
	const categoryCounts = useMemo(() => countAiToolsByCategory(dailyTools), [dailyTools]);
	const publicCount = useMemo(() => dailyTools.filter((tool) => tool.is_public).length, [dailyTools]);
	const activeModalTool = useMemo(
		() => dailyTools.find((tool) => tool.id === activeModalToolId) ?? null,
		[dailyTools, activeModalToolId],
	);

	const handleToggleVisibility = useCallback(
		(tool: AiTool) => {
			const nextIsPublic = !tool.is_public;
			setPendingId(tool.id);
			try {
				persistToolVisibility(tool.id, nextIsPublic);
				setTools((prev) =>
					prev.map((item) => (item.id === tool.id ? { ...item, is_public: nextIsPublic } : item)),
				);
				pushToast(`"${tool.name}" ${nextIsPublic ? '프론트에 노출됨' : '프론트 노출 해제됨'}`);
			} catch (error) {
				pushToast(error instanceof Error ? error.message : '노출 상태 변경에 실패했습니다.', 'error');
			} finally {
				setPendingId(null);
			}
		},
		[pushToast],
	);

	const handleRefreshFromAi = useCallback(async () => {
		if (refreshPending) return;
		setRefreshPending(true);
		try {
			const res = await fetch('/api/admin/ai-tools/refresh', { method: 'POST' });
			const data = (await res.json().catch(() => null)) as
				| {
						error?: string;
						provider?: 'gemini' | 'openai' | 'perplexity' | 'mock';
						updatedCount?: number;
						totalCount?: number;
						warning?: string;
						categories?: AiToolCategoryRaw[];
				  }
				| null;

			if (!res.ok || !data || !Array.isArray(data.categories)) {
				throw new Error(data?.error || 'AI 데이터 최신화에 실패했습니다.');
			}

			setTools(flattenAiToolCategories(data.categories));
			void refetch().catch(() => undefined);

			const providerLabel: Record<string, string> = {
				gemini: 'Gemini 웹 검색',
				openai: 'OpenAI 웹 검색',
				perplexity: 'Perplexity 웹 검색',
				mock: '모의(mock) 데이터',
			};
			const label = providerLabel[data.provider ?? 'mock'] ?? '알 수 없는 소스';
			pushToast(`${label} 기준으로 ${data.updatedCount ?? 0}/${data.totalCount ?? 0}개 도구 최신화 완료`);
			if (data.warning) pushToast(data.warning, 'error');
		} catch (error) {
			pushToast(error instanceof Error ? error.message : 'AI 데이터 최신화에 실패했습니다.', 'error');
		} finally {
			setRefreshPending(false);
		}
	}, [refreshPending, pushToast, refetch]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
						Curation Workspace
					</p>
					<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
						글로벌 AI 도구 디렉토리
					</h1>
					<p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
						카테고리별 글로벌 AI 서비스를 북마크하고, 프론트엔드 노출 여부를 관리합니다.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
						<Sparkles className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
						{publicCount} / {dailyTools.length}개 도구 프론트 노출 중
					</div>
					<button
						type="button"
						onClick={handleRefreshFromAi}
						disabled={refreshPending}
						className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{refreshPending ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
						) : (
							<Zap className="h-3.5 w-3.5" aria-hidden />
						)}
						{refreshPending ? 'AI 데이터 최신화 중...' : 'AI 데이터 최신화'}
					</button>
					<button
						type="button"
						onClick={() => setRankModalOpen(true)}
						className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
					>
						<BarChart3 className="h-3.5 w-3.5" aria-hidden />
						오늘자 점유율 순위 분석
					</button>
				</div>
			</div>

			{dailyTools.length > 0 && <MarketShareBar tools={dailyTools} category={category} dateKey={date} />}

			<div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[15rem_1fr]">
				<AiToolsCategoryNav
					value={category}
					onChange={setCategory}
					counts={categoryCounts}
					totalCount={dailyTools.length}
				/>

				<div className="flex flex-col gap-4">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="서비스명 / 설명 / 해시태그 검색"
							className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500"
						/>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
							{sortedTools.length.toLocaleString('ko-KR')}개 도구
						</p>
						<div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
							{AI_TOOL_SORT_OPTIONS.map((option) => (
								<button
									key={option.key}
									type="button"
									onClick={() => setSortKey(option.key)}
									aria-pressed={sortKey === option.key}
									className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors ${
										sortKey === option.key
											? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
											: 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
					</div>

					{sortedTools.length === 0 ? (
						<div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
							조건에 맞는 AI 도구가 없습니다.
						</div>
					) : (
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
							{sortedTools.map((tool, index) => {
								const ranked = tool as RankedLiveAiTool;
								const scoped = category !== 'all';
								const liveRank = scoped ? ranked.categoryRank : ranked.currentRank;
								return (
									<AiToolCard
										key={tool.id}
										tool={tool}
										rank={liveRank || index + 1}
										rankDelta={scoped ? (ranked.previousCategoryRank > 0 ? ranked.previousCategoryRank - ranked.categoryRank : 0) : ranked.rankDelta}
										isNew={Boolean(ranked.isNew)}
										pending={pendingId === tool.id}
										onOpenDetail={(selected) => setActiveModalToolId(selected.id)}
										onToggleVisibility={handleToggleVisibility}
									/>
								);
							})}
						</div>
					)}
				</div>
			</div>

			{activeModalTool && (
				<AiToolDetailModal tool={activeModalTool} onClose={() => setActiveModalToolId(null)} />
			)}

			{rankModalOpen && (
				<TodayRankModal
					tools={dailyTools}
					dateKey={date}
					analysis={analysis}
					onClose={() => setRankModalOpen(false)}
				/>
			)}

			{toasts.length > 0 && (
				<div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
					{toasts.map((toast) => (
						<div
							key={toast.id}
							className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg ${
								toast.tone === 'error'
									? 'border-rose-200 bg-rose-50 text-rose-700'
									: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
							}`}
						>
							{toast.tone === 'error' && <TriangleAlert className="h-3.5 w-3.5" />}
							{toast.message}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
