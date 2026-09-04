'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Bookmark, Clock3, Loader2, RefreshCw, RotateCw, Search, Sparkles, TriangleAlert, X } from 'lucide-react';
import {
	canUseInsightsAiResearch,
	isInsightsProMember,
	type InsightsAiResearchResult,
	type InsightsSearchMode,
} from '@/lib/insights/insights-ai-research';
import {
	clearCachedResearch,
	getFreshCachedResearch,
	removeCachedResearch,
	writeCachedResearch,
} from '@/lib/insights/insights-ai-research-cache';
import {
	lastResearchToResult,
	readLastAiResearch,
	writeLastAiResearch,
} from '@/lib/insights/insights-last-research';
import {
	prependRecentSearch,
	readRecentSearches,
	writeRecentSearches,
} from '@/lib/insights/insights-ai-recent-searches';
import {
	consumeInsightsAiUsage,
	defaultInsightsAiUsage,
	readInsightsAiUsage,
	type InsightsAiUsageSnapshot,
} from '@/lib/insights/insights-ai-usage';
import { INSIGHTS_LOCAL_RESET_EVENT } from '@/lib/insights/insights-local-reset';
import {
	isItemScrapped,
	readScrappedNews,
	SCRAPPED_NEWS_EVENT,
	scrappedNewsIds,
	upsertScrappedNews,
	type ScrappedNewsItem,
} from '@/lib/insights/scrapped-news';
import { readSavedNewsIds, writeSavedNewsIds } from '@/lib/insights/saved-news';
import {
	countSavedItems,
	readSavedItems,
	SAVED_ITEMS_EVENT,
	savedItemToNewsItem,
	savedItemToYoutubeVideo,
	toggleBookmark,
	upsertBookmark,
	type SavedItem,
} from '@/lib/insights/saved-items';
import { insightsFilterClass } from '@/lib/ui/insights-chrome';
import { readLastYoutubeSearch, writeLastYoutubeSearch } from '@/lib/insights/insights-last-youtube';
import { readYoutubeVideosCache, writeYoutubeVideosCache } from '@/lib/insights/youtube-videos-cache';
import {
	normalizeYoutubeSearchResult,
	type InsightsYoutubeVideo,
} from '@/lib/insights/insights-youtube';
import { readScrappedVideos, SCRAPPED_VIDEOS_EVENT } from '@/lib/insights/scrapped-videos';
import {
	INSIGHT_CATEGORIES,
	INSIGHT_CATEGORY_LABEL,
	INSIGHTS_NEWS_REGION_TABS,
	INSIGHTS_PAGE_SIZE_OPTIONS,
	type InsightsNewsFeedResult,
	type InsightsNewsItem,
	type InsightsNewsRegion,
	type InsightsNewsTab,
	type InsightsPageSize,
	filterInsightsNews,
	resolveArticleCategory,
} from '@/lib/insights/insights-news-types';
import { fetchScraps, saveResearchScrap } from '@/lib/mypage/firebase-mypage-service';
import { resolveMypageUserId } from '@/lib/mypage/mypage-user-id';
import { classifyArticleCategory } from '@/lib/insights/insights-news-classify';
import { InsightsAiLockModal } from './InsightsAiLockModal';
import { InsightsNewsCard } from './InsightsNewsCard';
import { InsightsPagination } from './InsightsPagination';
import { InsightsRecentResearchChips } from './InsightsRecentResearchChips';
import { InsightsSearchModeBar } from './InsightsSearchModeBar';

const InsightsAiResearchPanel = dynamic(
	() => import('./InsightsAiResearchPanel').then((mod) => mod.InsightsAiResearchPanel),
	{ ssr: false },
);

const InsightsYoutubePanel = dynamic(
	() => import('./InsightsYoutubePanel').then((mod) => mod.InsightsYoutubePanel),
	{ ssr: false },
);

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

const AI_SEARCH_CLIENT_TIMEOUT_MS = 50_000;

async function fetchAiResearch(query: string): Promise<InsightsAiResearchResult> {
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), AI_SEARCH_CLIENT_TIMEOUT_MS);
	try {
		const res = await fetch('/api/insights/ai-search', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			cache: 'no-store',
			signal: controller.signal,
			body: JSON.stringify({ query }),
		});
		const body = (await res.json().catch(() => null)) as
			| (InsightsAiResearchResult & { error?: string; code?: string })
			| null;
		if (!res.ok) {
			throw new Error(body?.error || `리서치 요청이 실패했습니다. (HTTP ${res.status})`);
		}
		if (!body?.summary || !Array.isArray(body.articles)) {
			throw new Error('리서치 응답 형식이 올바르지 않습니다.');
		}
		return body;
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			throw new Error('리서치 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');
		}
		throw error;
	} finally {
		window.clearTimeout(timer);
	}
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
	const { data: session, status: authStatus } = useSession();
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [isProMember, setIsProMember] = useState(false);
	const [searchMode, setSearchMode] = useState<InsightsSearchMode>('feed');
	const [aiResult, setAiResult] = useState<InsightsAiResearchResult | null>(null);
	const [aiLoading, setAiLoading] = useState(false);
	const [aiError, setAiError] = useState<string | null>(null);
	const [lockOpen, setLockOpen] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const [aiUsage, setAiUsage] = useState<InsightsAiUsageSnapshot>(() => defaultInsightsAiUsage(false));
	const [recentSearches, setRecentSearches] = useState<string[]>([]);
	const [aiActiveQuery, setAiActiveQuery] = useState('');
	const [items, setItems] = useState<InsightsNewsItem[]>([]);
	const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [regionFilter, setRegionFilter] = useState<'all' | InsightsNewsRegion>('all');
	const [categoryFilter, setCategoryFilter] = useState<InsightsNewsTab>('all');
	const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
	const [searchKeyword, setSearchKeyword] = useState('');
	const [pageSize, setPageSize] = useState<InsightsPageSize>(12);
	const [visibleCount, setVisibleCount] = useState(12);
	const [currentPage, setCurrentPage] = useState(1);
	const [currentTopics, setCurrentTopics] = useState<string[]>(() =>
		ALL_LIVE_TOPICS.slice(0, LIVE_TOPIC_VISIBLE_COUNT).map((topic) => topic),
	);
	const [isShuffling, setIsShuffling] = useState(false);
	const [topicsVisible, setTopicsVisible] = useState(true);
	const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
	const [scrappedNews, setScrappedNews] = useState<ScrappedNewsItem[]>([]);
	const [savedNewsIds, setSavedNewsIds] = useState<string[]>([]);
	const [allVideos, setAllVideos] = useState<InsightsYoutubeVideo[]>([]);
	const [youtubeQuery, setYoutubeQuery] = useState('');
	const [youtubeLoading, setYoutubeLoading] = useState(false);
	const [youtubeError, setYoutubeError] = useState<string | null>(null);
	const [savedVideoIds, setSavedVideoIds] = useState<string[]>([]);
	const [vaultUrls, setVaultUrls] = useState<string[]>([]);
	const [savingVaultUrl, setSavingVaultUrl] = useState<string | null>(null);
	const [savedOnly, setSavedOnly] = useState(false);
	const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'error' } | null>(null);
	const requestIdRef = useRef(0);
	const listTopRef = useRef<HTMLDivElement | null>(null);
	const shuffleTimersRef = useRef<number[]>([]);
	const canUseAi = canUseInsightsAiResearch({ isLoggedIn, isProMember });

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
		const sessionUser = session?.user as { planId?: string; role?: string } | undefined;
		if (authStatus === 'unauthenticated') {
			setIsLoggedIn(false);
			setIsProMember(false);
			return;
		}
		if (authStatus !== 'authenticated') return;
		setIsLoggedIn(true);
		setIsProMember(isInsightsProMember(sessionUser?.planId, sessionUser?.role));
		let cancelled = false;
		fetch('/api/me')
			.then((res) => res.json())
			.then((data: { authenticated?: boolean; planId?: string; role?: string }) => {
				if (cancelled || !data?.authenticated) return;
				setIsLoggedIn(true);
				setIsProMember(isInsightsProMember(data.planId, data.role));
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [authStatus, session]);

	useEffect(() => {
		setIsMounted(true);
		function hydrateLocalInsights(event?: Event) {
			const unified = readSavedItems();
			setSavedItems(unified);
			const scraps = readScrappedNews();
			setScrappedNews(scraps);
			const scrapIds = scrappedNewsIds(scraps);
			const scrapUrls = scraps.map((item) => item.url).filter(Boolean);
			setSavedNewsIds(scrapIds.length > 0 ? [...scrapIds, ...scrapUrls] : readSavedNewsIds());
			setSavedVideoIds(
				unified.filter((item) => item.type === 'youtube').map((item) => item.id).concat(
					readScrappedVideos().map((item) => item.videoId),
				),
			);
			setRecentSearches(readRecentSearches());
			setAiUsage(readInsightsAiUsage(isProMember));
			const cachedYoutube = readYoutubeVideosCache() || readLastYoutubeSearch();
			if (cachedYoutube) {
				setYoutubeQuery((current) => current || cachedYoutube.query);
				setAllVideos((current) => (current.length > 0 ? current : cachedYoutube.videos));
				setVisibleCount((current) => (current > 0 ? current : pageSize));
			}
			const last = readLastAiResearch();
			if (last) {
				setAiResult((current) => current ?? lastResearchToResult(last));
				setAiActiveQuery((current) => current || last.query);
			} else if (event?.type === INSIGHTS_LOCAL_RESET_EVENT) {
				setAiResult(null);
				setAiActiveQuery('');
			}
		}
		hydrateLocalInsights();
		window.addEventListener(INSIGHTS_LOCAL_RESET_EVENT, hydrateLocalInsights);
		window.addEventListener(SCRAPPED_NEWS_EVENT, hydrateLocalInsights);
		window.addEventListener(SCRAPPED_VIDEOS_EVENT, hydrateLocalInsights);
		window.addEventListener(SAVED_ITEMS_EVENT, hydrateLocalInsights);
		window.addEventListener('storage', hydrateLocalInsights);
		return () => {
			window.removeEventListener(INSIGHTS_LOCAL_RESET_EVENT, hydrateLocalInsights);
			window.removeEventListener(SCRAPPED_NEWS_EVENT, hydrateLocalInsights);
			window.removeEventListener(SCRAPPED_VIDEOS_EVENT, hydrateLocalInsights);
			window.removeEventListener(SAVED_ITEMS_EVENT, hydrateLocalInsights);
			window.removeEventListener('storage', hydrateLocalInsights);
		};
	}, [isProMember]);

	useEffect(() => {
		let cancelled = false;
		const uid = resolveMypageUserId(session?.user?.id);
		fetchScraps(uid)
			.then((rows) => {
				if (!cancelled) setVaultUrls(rows.map((row) => row.articleUrl));
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [session?.user?.id]);

	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 2200);
		return () => window.clearTimeout(timer);
	}, [toast]);

	useEffect(() => {
		setCurrentTopics(getRandomTopics());
		return () => {
			for (const timerId of shuffleTimersRef.current) window.clearTimeout(timerId);
		};
	}, []);

	useEffect(() => {
		setCurrentPage(1);
		setVisibleCount(pageSize);
	}, [regionFilter, categoryFilter, selectedTopic, searchKeyword, pageSize, savedOnly]);

	const keywordForFilter =
		selectedTopic && searchKeyword.trim() === selectedTopic ? null : searchKeyword;

	const savedNewsItems = useMemo(
		() => savedItems.filter((item) => item.type === 'news').map(savedItemToNewsItem),
		[savedItems],
	);
	const savedYoutubeVideos = useMemo(
		() => savedItems.filter((item) => item.type === 'youtube').map(savedItemToYoutubeVideo),
		[savedItems],
	);
	const savedNewsCount = countSavedItems(savedItems, 'news') || scrappedNews.length;
	const savedVideoCount = countSavedItems(savedItems, 'youtube') || new Set(savedVideoIds).size;

	const filtered = useMemo(() => {
		return filterInsightsNews(items, categoryFilter, regionFilter, selectedTopic, keywordForFilter);
	}, [items, categoryFilter, regionFilter, selectedTopic, keywordForFilter]);

	const listItems = savedOnly ? savedNewsItems : filtered;
	const totalItems = listItems.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const safePage = Math.min(currentPage, totalPages);
	const pagedItems = listItems.slice((safePage - 1) * pageSize, safePage * pageSize);
	const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
	const rangeEnd = Math.min(safePage * pageSize, totalItems);

	function handlePageSizeChange(newSize: number) {
		const next = (INSIGHTS_PAGE_SIZE_OPTIONS as readonly number[]).includes(newSize)
			? (newSize as InsightsPageSize)
			: 12;
		setPageSize(next);
		setVisibleCount(next);
	}

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

	function syncScrapState(items: ScrappedNewsItem[]) {
		setScrappedNews(items);
		const ids = scrappedNewsIds(items);
		const urls = items.map((item) => item.url).filter(Boolean);
		const nextIds = [...ids, ...urls];
		setSavedNewsIds(nextIds);
		writeSavedNewsIds(ids);
	}

	function handleToggleSave(item: InsightsNewsItem) {
		const result = toggleBookmark({ type: 'news', item });
		setSavedItems(result.items);
		syncScrapState(readScrappedNews());
		setToast({
			message: result.saved ? '보관함에 저장했습니다.' : '스크랩을 해제했습니다.',
			tone: 'ok',
		});
	}

	async function handleSaveToVault(item: InsightsNewsItem) {
		setSavedItems(upsertBookmark({ type: 'news', item }));
		syncScrapState(upsertScrappedNews(item, aiActiveQuery || searchKeyword.trim(), scrappedNews));
		setSavingVaultUrl(item.sourceUrl);
		try {
			const category = resolveArticleCategory(item);
			const result = await saveResearchScrap({
				userId: resolveMypageUserId(session?.user?.id),
				queryKeyword: aiActiveQuery || searchKeyword.trim() || item.tags[0] || INSIGHT_CATEGORY_LABEL[category],
				articleTitle: item.title,
				source: item.sourceName,
				articleUrl: item.sourceUrl,
				aiSummary: item.summary,
				tag: INSIGHT_CATEGORY_LABEL[category],
			});
			setVaultUrls((prev) => (prev.includes(result.scrap.articleUrl) ? prev : [...prev, result.scrap.articleUrl]));
			setToast({
				message: result.duplicate ? '이미 보관함에 저장된 기사입니다.' : '보관함에 저장했습니다.',
				tone: 'ok',
			});
		} catch {
			setToast({
				message: '보관함에 저장했습니다.',
				tone: 'ok',
			});
		} finally {
			setSavingVaultUrl(null);
		}
	}

	function handleShareResult(ok: boolean, message: string) {
		setToast({ message, tone: ok ? 'ok' : 'error' });
	}

	function handleSearchModeChange(next: InsightsSearchMode) {
		setSearchMode(next);
		setSelectedTopic(null);
		setAiError(null);
		setYoutubeError(null);
		if (next === 'feed') {
			setSearchKeyword('');
			return;
		}
		if (next === 'youtube') {
			const last = readYoutubeVideosCache() || readLastYoutubeSearch();
			const query = youtubeQuery || last?.query || '';
			if (query) {
				setSearchKeyword(query);
				setYoutubeQuery(query);
			}
			if (allVideos.length > 0) {
				setVisibleCount(pageSize);
				return;
			}
			if (last?.videos.length) {
				setAllVideos(last.videos);
				setVisibleCount(pageSize);
				return;
			}
			if (query) void handleYoutubeSearch(query);
			return;
		}
		const last = readLastAiResearch();
		const query = aiActiveQuery || last?.query || '';
		if (query) {
			setSearchKeyword(query);
			setAiActiveQuery(query);
		}
		if (!aiResult && last) {
			setAiResult(lastResearchToResult(last));
		}
	}

	function handleToggleVideoSave(item: InsightsYoutubeVideo) {
		const result = toggleBookmark({ type: 'youtube', item });
		setSavedItems(result.items);
		setSavedVideoIds(result.items.filter((row) => row.type === 'youtube').map((row) => row.id));
		setToast({
			message: result.saved ? '영상 보관함에 저장했습니다.' : '영상 스크랩을 해제했습니다.',
			tone: 'ok',
		});
	}

	async function handleYoutubeSearch(nextQuery?: string) {
		const query = (nextQuery ?? searchKeyword).trim();
		if (query.length < 2) {
			setYoutubeError('검색어를 2자 이상 입력해 주세요.');
			setToast({ message: '검색어를 2자 이상 입력해 주세요.', tone: 'error' });
			return;
		}
		setSearchKeyword(query);
		setYoutubeQuery(query);
		setYoutubeError(null);
		const local = readYoutubeVideosCache(query);
		if (local) {
			writeLastYoutubeSearch(local);
			setAllVideos(local.videos);
			setVisibleCount(pageSize);
			return;
		}
		setYoutubeLoading(true);
		try {
			const res = await fetch('/api/insights/youtube-search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				cache: 'no-store',
				body: JSON.stringify({ query }),
			});
			const body = (await res.json().catch(() => null)) as { error?: string; videos?: unknown; query?: string; warning?: string } | null;
			if (!res.ok) throw new Error(body?.error || `유튜브 검색이 실패했습니다. (HTTP ${res.status})`);
			const result = normalizeYoutubeSearchResult(body, query);
			writeLastYoutubeSearch(result);
			writeYoutubeVideosCache(result);
			setAllVideos(result.videos);
			setVisibleCount(pageSize);
			if (result.warning) setToast({ message: result.warning, tone: 'ok' });
		} catch (err) {
			const message = err instanceof Error ? err.message : '유튜브 영상을 불러오지 못했습니다.';
			setYoutubeError(message);
			setToast({ message, tone: 'error' });
		} finally {
			setYoutubeLoading(false);
		}
	}

	async function handleAiSearch(nextQuery?: string, options?: { force?: boolean; fromChip?: boolean }) {
		if (!canUseAi) {
			setLockOpen(true);
			return;
		}
		const query = (nextQuery ?? searchKeyword).trim();
		if (query.length < 2) {
			setAiError('검색어를 2자 이상 입력해 주세요.');
			setToast({ message: '검색어를 2자 이상 입력해 주세요.', tone: 'error' });
			return;
		}
		setSearchKeyword(query);
		setAiActiveQuery(query);

		if (!options?.force && options?.fromChip) {
			const cached = getFreshCachedResearch(query);
			if (cached) {
				const stamped = writeLastAiResearch(cached.result, cached.searchedAt).timestamp;
				setAiResult({ ...cached.result, searchedAt: cached.result.searchedAt || stamped });
				setAiError(null);
				return;
			}
		}

		const quota = readInsightsAiUsage(isProMember);
		setAiUsage(quota);
		if (!quota.unlimited && quota.remaining <= 0) {
			setLockOpen(true);
			return;
		}
		setAiLoading(true);
		setAiError(null);
		try {
			const result = await fetchAiResearch(query);
			const stamped = writeCachedResearch(query, result).result;
			writeLastAiResearch(stamped);
			setAiResult(stamped);
			setAiUsage(consumeInsightsAiUsage(isProMember));
			setRecentSearches(writeRecentSearches(prependRecentSearch(readRecentSearches(), query)));
			if (result.warning) setToast({ message: result.warning, tone: 'ok' });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : '리서치 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
			setAiError(message);
			setToast({ message: '리서치 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', tone: 'error' });
		} finally {
			setAiLoading(false);
		}
	}

	function handleRecentSearchSelect(query: string) {
		setSearchKeyword(query);
		void handleAiSearch(query, { fromChip: true });
	}

	function handleRecentSearchRemove(query: string) {
		removeCachedResearch(query);
		setRecentSearches((prev) => writeRecentSearches(prev.filter((item) => item !== query)));
	}

	function handleRecentSearchClear() {
		clearCachedResearch();
		setRecentSearches(writeRecentSearches([]));
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
		<div className="flex flex-col gap-4">
			<section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
				<InsightsSearchModeBar mode={searchMode} usage={aiUsage} onChange={handleSearchModeChange} />

				<div className="mt-3 flex w-full items-center justify-between gap-2">
					<div className="flex min-w-0 flex-wrap items-center gap-2" role="tablist" aria-label="뉴스 지역">
						{INSIGHTS_NEWS_REGION_TABS.map((chip) => {
							const active = regionFilter === chip.value;
							return (
								<button
									key={chip.value}
									type="button"
									role="tab"
									aria-selected={active}
									onClick={() => setRegionFilter(chip.value)}
									className={insightsFilterClass(active, 'h-9 whitespace-nowrap rounded-xl px-3.5')}
								>
									{chip.label}
								</button>
							);
						})}
					</div>
					<button
						type="button"
						aria-pressed={savedOnly}
						onClick={() => setSavedOnly((open) => !open)}
						className={insightsFilterClass(savedOnly, 'ml-auto h-9 shrink-0 gap-1.5 rounded-xl px-3')}
					>
						<Bookmark className={`h-3.5 w-3.5 ${savedOnly ? 'fill-cyan-400 text-cyan-400' : ''}`} aria-hidden />
						{searchMode === 'youtube'
							? `저장된 영상${isMounted && savedVideoCount > 0 ? ` (${savedVideoCount})` : ''}`
							: `저장된 뉴스${isMounted && savedNewsCount > 0 ? ` (${savedNewsCount})` : ''}`}
					</button>
				</div>

				<div className={`isolate mt-3 flex flex-wrap items-center gap-1.5 transition-all duration-300 ${searchMode === 'feed' ? 'opacity-100' : 'pointer-events-none h-0 overflow-hidden opacity-0'}`} role="tablist" aria-label="인사이트 카테고리">
					{INSIGHT_CATEGORIES.map((chip) => {
						const active = categoryFilter === chip.id;
						return (
							<button
								key={chip.id}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => setCategoryFilter(chip.id)}
								className={insightsFilterClass(active, 'relative z-10 rounded-full px-3 py-1.5')}
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
							onKeyDown={(event) => {
								if (event.key === 'Enter' && searchMode === 'ai') {
									event.preventDefault();
									void handleAiSearch();
								}
								if (event.key === 'Enter' && searchMode === 'youtube') {
									event.preventDefault();
									void handleYoutubeSearch();
								}
							}}
							placeholder={
								searchMode === 'ai'
									? '예: AI 오버뷰가 로컬 병원에 미치는 영향'
									: searchMode === 'youtube'
										? '예: AI SEO, 생성형 AI 검색 최적화'
										: '키워드 실시간 검색...'
							}
							aria-label={
								searchMode === 'ai'
									? 'AI 실시간 리서치 질의'
									: searchMode === 'youtube'
										? '유튜브 영상 검색'
										: '인사이트 키워드 검색'
							}
							className={`h-9 w-full rounded-xl border bg-white pl-8 pr-7 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 md:text-sm ${
								searchMode === 'ai'
									? 'border-cyan-500/40 focus:border-cyan-400 focus:ring-cyan-500/20 dark:border-cyan-500/30 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500'
									: 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-500/60'
							}`}
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
					{searchMode === 'ai' ? (
						<button
							type="button"
							onClick={() => void handleAiSearch()}
							disabled={aiLoading}
							className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 text-[12px] font-bold text-white shadow-sm shadow-cyan-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
						>
							{aiLoading ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
							) : (
								<Sparkles className="h-3.5 w-3.5" aria-hidden />
							)}
							AI 리서치 실행
						</button>
					) : searchMode === 'youtube' ? (
						<button
							type="button"
							onClick={() => void handleYoutubeSearch()}
							disabled={youtubeLoading}
							className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-3.5 text-[12px] font-bold text-white shadow-sm shadow-red-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
						>
							{youtubeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
							유튜브 검색
						</button>
					) : (
						<button
							type="button"
							onClick={() => load(true)}
							disabled={loading || refreshing}
							className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 text-[12px] font-bold text-white shadow-sm shadow-cyan-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
							실시간 새로고침
						</button>
					)}
				</div>

				{isMounted && searchMode === 'ai' ? (
					<InsightsRecentResearchChips
						queries={recentSearches}
						activeQuery={aiActiveQuery || searchKeyword}
						disabled={aiLoading}
						onSelect={handleRecentSearchSelect}
						onRemove={handleRecentSearchRemove}
						onClear={handleRecentSearchClear}
					/>
				) : null}

				<div
					className={`mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pb-1 pt-2.5 text-xs transition-all duration-300 dark:border-slate-700/60 ${
						searchMode === 'feed' ? 'opacity-100' : 'pointer-events-none h-0 overflow-hidden border-0 opacity-0'
					}`}
				>
					<div className="inline-flex shrink-0 items-center gap-1.5 pr-1 text-xs font-bold text-amber-500 dark:text-amber-400">
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
							className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-cyan-600 disabled:cursor-not-allowed dark:hover:bg-slate-800/60 dark:hover:text-cyan-400"
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
											? 'border-cyan-300 bg-cyan-50 font-medium text-cyan-700 shadow-none dark:border-cyan-500/50 dark:bg-cyan-500/15 dark:text-cyan-300 dark:shadow-[0_0_8px_rgba(6,182,212,0.2)]'
											: 'border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700 dark:border-cyan-950/80 dark:bg-[#0c1829] dark:text-slate-400 dark:hover:border-cyan-700/50 dark:hover:bg-[#13233a] dark:hover:text-cyan-300'
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

			<div
				aria-hidden={searchMode !== 'ai' || savedOnly}
				className={searchMode === 'ai' && !savedOnly ? '' : 'hidden'}
			>
				<InsightsAiResearchPanel
					result={aiResult}
					currentQuery={aiActiveQuery || searchKeyword.trim()}
					loading={aiLoading}
					error={aiError}
					savedNewsIds={savedNewsIds}
					vaultUrls={vaultUrls}
					savingVaultUrl={savingVaultUrl}
					onToggleSave={handleToggleSave}
					onSaveToVault={(item) => void handleSaveToVault(item)}
					onShareResult={handleShareResult}
					onRetry={() => void handleAiSearch(aiActiveQuery || searchKeyword, { force: true })}
					onReanalyze={() => void handleAiSearch(aiActiveQuery || searchKeyword, { force: true })}
				/>
			</div>

			<div
				aria-hidden={searchMode !== 'youtube'}
				className={searchMode === 'youtube' ? '' : 'hidden'}
			>
				<InsightsYoutubePanel
					query={youtubeQuery || searchKeyword.trim()}
					videos={savedOnly ? savedYoutubeVideos : allVideos}
					loading={savedOnly ? false : youtubeLoading}
					error={savedOnly ? null : youtubeError}
					savedOnly={savedOnly}
					savedVideoIds={savedVideoIds}
					pageSize={pageSize}
					visibleCount={visibleCount}
					onPageSizeChange={handlePageSizeChange}
					onLoadMore={() =>
						setVisibleCount((prev) => Math.min(prev + pageSize, (savedOnly ? savedYoutubeVideos : allVideos).length))
					}
					onToggleSave={handleToggleVideoSave}
					onShareResult={handleShareResult}
					onRetry={() => void handleYoutubeSearch(youtubeQuery || searchKeyword)}
					onBackToAll={() => setSavedOnly(false)}
				/>
			</div>

			<div className={searchMode === 'feed' || (searchMode === 'ai' && savedOnly) ? 'flex flex-col' : 'hidden'}>
				{savedOnly ? (
					<button
						type="button"
						onClick={() => setSavedOnly(false)}
						className="mb-1 inline-flex w-fit items-center gap-1.5 text-xs font-bold text-cyan-600 hover:text-cyan-500 dark:text-cyan-300"
					>
						<ArrowLeft className="h-3.5 w-3.5" aria-hidden />
						전체 목록으로 돌아가기
					</button>
				) : null}
				<div
					ref={listTopRef}
					className="mb-4 flex flex-wrap items-center justify-between gap-2 py-2 scroll-mt-4"
				>
					<p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
						{loading
							? '피드를 불러오는 중…'
							: `${totalItems.toLocaleString('ko-KR')}건 중 ${rangeStart}–${rangeEnd}`}
					</p>
					<div className="flex flex-wrap items-center gap-4">
						<InsightsPageSizeToggle pageSize={pageSize} onPageSizeChange={handlePageSizeChange} />
						<p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
							<Clock3 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden />
							최근 업데이트: {lastFetchedAt ? formatUpdatedAgo(lastFetchedAt) : '—'}
						</p>
					</div>
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
				) : listItems.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
						{savedOnly ? '저장된 뉴스가 없습니다. 유익한 기사를 북마크해 보세요!' : '조건에 맞는 인사이트가 없습니다.'}
					</div>
				) : (
					<>
						{error && (
							<p className="text-center text-xs font-semibold text-amber-600 dark:text-amber-400">{error}</p>
						)}
						<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
							{pagedItems.map((item) => (
								<InsightsNewsCard
									key={item.id}
									item={item}
									saved={isItemScrapped(item, scrappedNews) || savedNewsIds.includes(item.id)}
									onToggleSave={handleToggleSave}
									onShareResult={handleShareResult}
								/>
							))}
						</div>
						<div className="mt-5">
							<InsightsPagination page={safePage} totalPages={totalPages} onPageChange={goToPage} />
						</div>
					</>
				)}
			</div>

			<InsightsAiLockModal
				open={lockOpen}
				onClose={() => setLockOpen(false)}
				onBackToFeed={() => {
					setLockOpen(false);
					setSearchMode('feed');
				}}
			/>

			{toast ? (
				<div
					role="status"
					className={`pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg ${
						toast.tone === 'error'
							? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-200'
							: 'border-cyan-300/60 bg-slate-900 text-white dark:border-cyan-500/40 dark:bg-slate-800'
					}`}
				>
					{toast.message}
				</div>
			) : null}
		</div>
	);
}

function InsightsPageSizeToggle({
	pageSize,
	onPageSizeChange,
}: {
	pageSize: number;
	onPageSizeChange: (size: number) => void;
}) {
	return (
		<div className="inline-flex shrink-0 items-center gap-1.5" role="group" aria-label="페이지당 보기">
			{INSIGHTS_PAGE_SIZE_OPTIONS.map((size) => {
				const active = pageSize === size;
				return (
					<button
						key={size}
						type="button"
						aria-pressed={active}
						onClick={() => onPageSizeChange(size)}
						className={insightsFilterClass(active, 'h-8 min-w-11 rounded-xl px-3 text-[11px]')}
					>
						{size}개
					</button>
				);
			})}
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
