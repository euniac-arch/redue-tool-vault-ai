'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Loader2, RefreshCw, RotateCw, Search, TriangleAlert, X } from 'lucide-react';
import {
	INSIGHT_CATEGORIES,
	INSIGHTS_NEWS_REGION_TABS,
	INSIGHTS_PAGE_SIZE_OPTIONS,
	type InsightsNewsFeedResult,
	type InsightsNewsItem,
	type InsightsNewsRegion,
	type InsightsNewsTab,
	type InsightsPageSize,
	filterInsightsNews,
} from '@/lib/insights/insights-news-types';
import { classifyArticleCategory } from '@/lib/insights/insights-news-classify';
import { InsightsNewsCard } from './InsightsNewsCard';
import { InsightsPagination } from './InsightsPagination';

async function fetchInsightsFeed(forceRefresh = false): Promise<InsightsNewsFeedResult> {
	const query = new URLSearchParams();
	if (forceRefresh) query.set('refresh', '1');
	const suffix = query.toString() ? `?${query.toString()}` : '';
	const res = await fetch(`/api/insights${suffix}`, { cache: 'no-store' });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error || '뉴스 피드를 불러오지 못했습니다.');
	}
	return res.json();
}

const ALL_LIVE_TOPICS = [
	'#GEO 최적화',
	'#AEO 엔진',
	'#JSON-LD',
	'#SearchGPT',
	'#Perplexity 인용',
	'#llms.txt',
	'#AI 오버뷰',
	'#스키마 마크업',
	'#구조화 데이터',
	'#E-E-A-T 신뢰도',
	'#지식 그래프',
	'#엔티티 맵',
	'#RAG 벡터검색',
	'#네이버 Cue:',
	'#하이퍼클로바X',
	'#Gemini Search',
	'#Core Web Vitals',
	'#크롤러 정책',
	'#FAQPage 스키마',
	'#MedicalClinic',
	'#로컬 SEO',
	'#클로드 아티팩트',
	'#브랜드 권위도',
] as const;

const LIVE_TOPIC_VISIBLE_COUNT = 7;

function topicSearchValue(topic: string): string {
	return topic.replace(/^#/, '').trim();
}

function getRandomTopics(): string[] {
	const pool = [...ALL_LIVE_TOPICS];
	for (let i = pool.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const current = pool[i];
		const swap = pool[j];
		if (current === undefined || swap === undefined) continue;
		pool[i] = swap;
		pool[j] = current;
	}
	return pool.slice(0, LIVE_TOPIC_VISIBLE_COUNT);
}

export function InsightsDashboard() {
	const [items, setItems] = useState<InsightsNewsItem[]>([]);
	const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [regionFilter, setRegionFilter] = useState<'all' | InsightsNewsRegion>('all');
	const [categoryFilter, setCategoryFilter] = useState<InsightsNewsTab>('all');
	const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
	const [searchKeyword, setSearchKeyword] = useState('');
	const [itemsPerPage, setItemsPerPage] = useState<InsightsPageSize>(6);
	const [currentPage, setCurrentPage] = useState(1);
	const [currentTopics, setCurrentTopics] = useState<string[]>(() =>
		ALL_LIVE_TOPICS.slice(0, LIVE_TOPIC_VISIBLE_COUNT).map((topic) => topic),
	);
	const [isShuffling, setIsShuffling] = useState(false);
	const [topicsVisible, setTopicsVisible] = useState(true);
	const requestIdRef = useRef(0);
	const listTopRef = useRef<HTMLDivElement | null>(null);
	const shuffleTimersRef = useRef<number[]>([]);

	const load = useCallback(async (forceRefresh = false) => {
		const requestId = ++requestIdRef.current;
		if (forceRefresh) setRefreshing(true);
		else setLoading(true);
		setError(null);
		try {
			const result = await fetchInsightsFeed(forceRefresh);
			if (requestId !== requestIdRef.current) return;
			setItems(
				result.items.map((item) => ({
					...item,
					category: classifyArticleCategory(item.title, item.summary),
				})),
			);
			setLastFetchedAt(result.lastFetchedAt);
		} catch (err) {
			if (requestId !== requestIdRef.current) return;
			setError(err instanceof Error ? err.message : '뉴스 피드를 불러오지 못했습니다.');
		} finally {
			if (requestId === requestIdRef.current) {
				setLoading(false);
				setRefreshing(false);
			}
		}
	}, []);

	useEffect(() => {
		load(false);
	}, [load]);

	useEffect(() => {
		setCurrentTopics(getRandomTopics());
		return () => {
			for (const timerId of shuffleTimersRef.current) window.clearTimeout(timerId);
		};
	}, []);

	useEffect(() => {
		setCurrentPage(1);
	}, [regionFilter, categoryFilter, selectedTopic, searchKeyword, itemsPerPage]);

	const keywordForFilter =
		selectedTopic && searchKeyword.trim() === selectedTopic ? null : searchKeyword;

	const filtered = useMemo(
		() => filterInsightsNews(items, categoryFilter, regionFilter, selectedTopic, keywordForFilter),
		[items, categoryFilter, regionFilter, selectedTopic, keywordForFilter],
	);

	const totalItems = filtered.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
	const safePage = Math.min(currentPage, totalPages);
	const pagedItems = filtered.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);
	const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
	const rangeEnd = Math.min(safePage * itemsPerPage, totalItems);

	function goToPage(nextPage: number) {
		const clamped = Math.min(Math.max(1, nextPage), totalPages);
		setCurrentPage(clamped);
		listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function handleTopicSelect(topic: string) {
		const keyword = topicSearchValue(topic);
		if (searchKeyword.trim() === keyword && selectedTopic === keyword) {
			setSearchKeyword('');
			setSelectedTopic(null);
			return;
		}
		setSearchKeyword(keyword);
		setSelectedTopic(keyword);
	}

	function handleShuffleTopics() {
		if (isShuffling) return;
		setIsShuffling(true);
		setTopicsVisible(false);
		const swapId = window.setTimeout(() => {
			setCurrentTopics(getRandomTopics());
			setTopicsVisible(true);
			const doneId = window.setTimeout(() => setIsShuffling(false), 350);
			shuffleTimersRef.current.push(doneId);
		}, 180);
		shuffleTimersRef.current.push(swapId);
	}

	return (
		<div className="flex flex-col gap-5">
			<section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="w-full overflow-x-auto lg:w-auto">
						<div
							className="inline-flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
							role="tablist"
							aria-label="뉴스 지역"
						>
							{INSIGHTS_NEWS_REGION_TABS.map((chip) => {
								const active = regionFilter === chip.value;
								return (
									<button
										key={chip.value}
										type="button"
										role="tab"
										aria-selected={active}
										onClick={() => setRegionFilter(chip.value)}
										className={`whitespace-nowrap px-3.5 py-2 text-xs font-bold outline-none transition-colors ${
											active
												? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
												: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
										}`}
									>
										{chip.label}
									</button>
								);
							})}
						</div>
					</div>

					<div
						className="inline-flex shrink-0 items-stretch self-start overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 lg:self-auto"
						role="group"
						aria-label="페이지당 보기"
					>
						{INSIGHTS_PAGE_SIZE_OPTIONS.map((size) => {
							const active = itemsPerPage === size;
							return (
								<button
									key={size}
									type="button"
									aria-pressed={active}
									onClick={() => setItemsPerPage(size)}
									className={`px-3 py-1.5 text-[11px] font-bold outline-none transition-colors ${
										active
											? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
											: 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
									}`}
								>
									{size}개
								</button>
							);
						})}
					</div>
				</div>

				<div className="isolate mt-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="인사이트 카테고리">
					{INSIGHT_CATEGORIES.map((chip) => {
						const active = categoryFilter === chip.id;
						return (
							<button
								key={chip.id}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => setCategoryFilter(chip.id)}
								className={`relative z-10 rounded-full border px-3 py-1.5 text-xs font-bold outline-none transition-colors ${
									active
										? 'border-transparent bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
										: 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-cyan-500/40 dark:hover:text-white'
								}`}
							>
								#{chip.label}
							</button>
						);
					})}
				</div>

				<div className="mt-3 flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center">
					<div className="relative w-full flex-1">
						<Search
							className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
							aria-hidden
						/>
						<input
							type="text"
							value={searchKeyword}
							onChange={(event) => {
								const next = event.target.value;
								setSearchKeyword(next);
								if (selectedTopic && next.trim() !== selectedTopic) {
									setSelectedTopic(null);
								}
							}}
							placeholder="키워드 실시간 검색..."
							aria-label="인사이트 키워드 검색"
							className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-500/60 md:text-sm"
						/>
						{searchKeyword && (
							<button
								type="button"
								onClick={() => {
									setSearchKeyword('');
									if (selectedTopic && searchKeyword.trim() === selectedTopic) {
										setSelectedTopic(null);
									}
								}}
								aria-label="검색어 지우기"
								className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
							>
								<X className="h-3.5 w-3.5" aria-hidden />
							</button>
						)}
					</div>
					<button
						type="button"
						onClick={() => load(true)}
						disabled={loading || refreshing}
						className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 text-[12px] font-bold text-white shadow-sm shadow-cyan-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
						실시간 새로고침
					</button>
				</div>

				<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pb-1 pt-2.5 text-xs dark:border-slate-700/60">
					<div className="inline-flex shrink-0 items-center gap-1.5 pr-1 text-xs font-bold text-amber-400">
						<span className="text-sm" aria-hidden>
							🔥
						</span>
						<span>Live Topics</span>
						<button
							type="button"
							title="추천 키워드 새로고침"
							aria-label="추천 키워드 새로고침"
							onClick={handleShuffleTopics}
							disabled={isShuffling}
							className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-cyan-400 disabled:cursor-not-allowed"
						>
							<RotateCw className={`h-3.5 w-3.5 ${isShuffling ? 'animate-spin' : ''}`} aria-hidden />
						</button>
					</div>
					<div
						className={`flex flex-wrap items-center gap-1.5 transition-all duration-300 ${
							topicsVisible ? 'translate-y-0 opacity-100' : 'translate-y-0.5 opacity-0'
						}`}
					>
						{currentTopics.map((topic) => {
							const keyword = topicSearchValue(topic);
							const isSelected = selectedTopic === keyword || searchKeyword.trim() === keyword;
							return (
								<button
									key={topic}
									type="button"
									aria-pressed={isSelected}
									onClick={() => handleTopicSelect(topic)}
									className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs transition-all duration-300 ${
										isSelected
											? 'border-cyan-500/50 bg-cyan-500/15 font-medium text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
											: 'border-cyan-950/80 bg-[#0c1829] text-slate-400 hover:border-cyan-700/50 hover:bg-[#13233a] hover:text-cyan-300'
									}`}
								>
									{topic}
								</button>
							);
						})}
						{selectedTopic && (
							<button
								type="button"
								onClick={() => {
									setSelectedTopic(null);
									if (searchKeyword.trim() === selectedTopic) setSearchKeyword('');
								}}
								className="ml-1 px-2 py-1 text-[11px] text-slate-400 underline underline-offset-2 hover:text-slate-700 dark:text-neutral-500 dark:hover:text-neutral-300"
							>
								초기화 ✕
							</button>
						)}
					</div>
				</div>
			</section>

			<div ref={listTopRef} className="flex flex-wrap items-center justify-between gap-2 scroll-mt-4">
				<p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
					{loading
						? '피드를 불러오는 중…'
						: `${totalItems.toLocaleString('ko-KR')}건 중 ${rangeStart}–${rangeEnd}`}
				</p>
				<p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
					<Clock3 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden />
					최근 업데이트: {lastFetchedAt ? formatUpdatedAgo(lastFetchedAt) : '—'}
				</p>
			</div>

			{loading ? (
				<div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
					<Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-400" />
					최신 AI &amp; GEO 뉴스를 불러오는 중…
				</div>
			) : error && items.length === 0 ? (
				<div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-rose-200 bg-rose-50 py-12 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
					<TriangleAlert className="h-4 w-4" />
					{error}
				</div>
			) : filtered.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
					조건에 맞는 인사이트가 없습니다.
				</div>
			) : (
				<>
					{error && (
						<p className="text-center text-xs font-semibold text-amber-600 dark:text-amber-400">{error}</p>
					)}
					<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
						{pagedItems.map((item) => (
							<InsightsNewsCard key={item.id} item={item} />
						))}
					</div>
					<div className="mt-5">
						<InsightsPagination page={safePage} totalPages={totalPages} onPageChange={goToPage} />
					</div>
				</>
			)}
		</div>
	);
}

function formatUpdatedAgo(iso: string): string {
	const then = Date.parse(iso);
	if (Number.isNaN(then)) return '방금 전';
	const diffMs = Date.now() - then;
	if (diffMs < 60_000) return '방금 전';
	const minutes = Math.floor(diffMs / 60_000);
	if (minutes < 60) return `${minutes}분 전`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}시간 전`;
	const days = Math.floor(hours / 24);
	if (days === 1) return '어제';
	return `${days}일 전`;
}
