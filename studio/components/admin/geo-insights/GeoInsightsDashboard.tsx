'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import {
	CATEGORY_LABEL,
	type GeoNewsFilters,
	type GeoNewsItem,
	type GeoNewsRegion,
} from '@/lib/admin/geo-news-management';
import { GeoNewsCard } from './GeoNewsCard';
import { GeoNewsPagination, PAGE_SIZE_OPTIONS, type GeoNewsPageSize } from './GeoNewsPagination';
import { TrendingTopicsWidget } from './TrendingTopicsWidget';

type GeoInsightsFeedResult = {
	items: GeoNewsItem[];
	total?: number;
	refreshedAt?: string;
};

async function fetchGeoInsightsFeed(filters: GeoNewsFilters): Promise<GeoNewsItem[]> {
	const query = new URLSearchParams({
		q: filters.query,
		region: filters.region,
		category: filters.category,
	});
	const res = await fetch(`/api/admin/geo-insights?${query.toString()}`, { cache: 'no-store' });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error || '뉴스 피드를 불러오지 못했습니다.');
	}
	const data = (await res.json()) as GeoInsightsFeedResult;
	return Array.isArray(data.items) ? data.items : [];
}

const SELECT_CLASS =
	'h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-500';

const REGION_TABS: { value: GeoNewsFilters['region']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'KR', label: '🇰🇷 국내 뉴스 (KR)' },
	{ value: 'GLOBAL', label: '🌐 해외 글로벌 (Global)' },
];

const CATEGORY_CHIPS: { value: GeoNewsFilters['category']; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'GEO', label: CATEGORY_LABEL.GEO },
	{ value: 'Schema Markup', label: CATEGORY_LABEL['Schema Markup'] },
	{ value: 'AI Model', label: CATEGORY_LABEL['AI Model'] },
	{ value: 'Search Engine', label: CATEGORY_LABEL['Search Engine'] },
];

type Toast = { id: number; message: string; tone?: 'default' | 'error' };

export function GeoInsightsDashboard() {
	const [items, setItems] = useState<GeoNewsItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [query, setQuery] = useState('');
	const [region, setRegion] = useState<GeoNewsFilters['region']>('all');
	const [category, setCategory] = useState<GeoNewsFilters['category']>('all');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<GeoNewsPageSize>(6);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const requestIdRef = useRef(0);
	const listTopRef = useRef<HTMLDivElement | null>(null);
	const bookmarkKeysRef = useRef(new Set<string>());

	function applyLocalBookmarks(items: GeoNewsItem[]): GeoNewsItem[] {
		const keys = bookmarkKeysRef.current;
		return items.map((item) => ({
			...item,
			isBookmarked: keys.has(item.id) || keys.has(item.sourceUrl),
		}));
	}

	const filters: GeoNewsFilters = useMemo(() => ({ query, region, category }), [query, region, category]);

	const pushToast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message, tone }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((item) => item.id !== id));
		}, 2400);
	}, []);

	const reload = useCallback(
		async (mode: 'load' | 'refresh' = 'load') => {
			const requestId = ++requestIdRef.current;
			if (mode === 'refresh') setRefreshing(true);
			else setLoading(true);
			try {
				const result = await fetchGeoInsightsFeed(filters);
				if (requestId !== requestIdRef.current) return;
				setItems(applyLocalBookmarks(result));
				if (mode === 'refresh') pushToast('최신 피드를 갱신했습니다.');
			} catch (error) {
				if (requestId !== requestIdRef.current) return;
				pushToast(error instanceof Error ? error.message : '뉴스 피드를 불러오지 못했습니다.', 'error');
			} finally {
				if (requestId === requestIdRef.current) {
					setLoading(false);
					setRefreshing(false);
				}
			}
		},
		[filters, pushToast],
	);

	useEffect(() => {
		reload('load');
	}, [reload]);

	useEffect(() => {
		setPage(1);
	}, [query, region, category, pageSize]);

	const totalItems = items.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const safePage = Math.min(page, totalPages);
	const pagedItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);
	const rangeStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
	const rangeEnd = Math.min(safePage * pageSize, totalItems);

	function goToPage(nextPage: number) {
		const clamped = Math.min(Math.max(1, nextPage), totalPages);
		setPage(clamped);
		listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const handleBookmark = useCallback((id: string) => {
		setItems((prev) => {
			const target = prev.find((item) => item.id === id || item.sourceUrl === id);
			const keys = [id, target?.sourceUrl, target?.id].filter((key): key is string => Boolean(key));
			const nextBookmarked = !keys.some((key) => bookmarkKeysRef.current.has(key));
			for (const key of keys) {
				if (nextBookmarked) bookmarkKeysRef.current.add(key);
				else bookmarkKeysRef.current.delete(key);
			}
			return prev.map((item) =>
				item.id === id || item.sourceUrl === id ? { ...item, isBookmarked: nextBookmarked } : item,
			);
		});
	}, []);

	function applyTrendingTopic(topic: string) {
		setQuery(topic);
		setCategory('all');
		setRegion('all');
	}

	return (
		<div className="flex flex-col gap-5">
			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-slate-800 dark:border-slate-700">
				<div
					className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-50 p-1 dark:bg-slate-700/60"
					role="tablist"
					aria-label="뉴스 지역"
				>
					{REGION_TABS.map((tab) => {
						const active = region === tab.value;
						return (
							<button
								key={tab.value}
								type="button"
								role="tab"
								aria-selected={active}
								onClick={() => setRegion(tab.value as GeoNewsRegion | 'all')}
								className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
									active
										? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
										: 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/70 dark:hover:text-slate-100'
								}`}
							>
								{tab.label}
							</button>
						);
					})}
				</div>

				<div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="카테고리 필터">
					{CATEGORY_CHIPS.map((chip) => {
						const active = category === chip.value;
						return (
							<button
								key={chip.value}
								type="button"
								onClick={() => setCategory(chip.value)}
								className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition-colors ${
									active
										? 'bg-slate-900 text-white ring-slate-900'
										: 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700'
								}`}
							>
								#{chip.label}
							</button>
						);
					})}
				</div>

				<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
					<div className="relative min-w-0 flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="기사 제목 / 요약 / 태그 검색"
							className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:bg-slate-800"
						/>
					</div>
					<button
						type="button"
						disabled={refreshing}
						onClick={() => reload('refresh')}
						className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
						실시간 새로고침
					</button>
				</div>
			</section>

			<div className="grid gap-5 xl:grid-cols-12">
				<div className="xl:col-span-8 2xl:col-span-9">
					<div ref={listTopRef} className="mb-3 flex flex-wrap items-center justify-between gap-2 scroll-mt-4">
						<p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
							{loading
								? '피드를 불러오는 중…'
								: `${totalItems.toLocaleString('ko-KR')}건 중 ${rangeStart}–${rangeEnd}`}
						</p>
						<label className="flex items-center gap-1.5">
							<span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">페이지당</span>
							<select
								className={SELECT_CLASS}
								value={pageSize}
								onChange={(event) => setPageSize(Number(event.target.value) as GeoNewsPageSize)}
								aria-label="페이지당 노출 개수"
							>
								{PAGE_SIZE_OPTIONS.map((size) => (
									<option key={size} value={size}>
										{size}개
									</option>
								))}
							</select>
						</label>
					</div>
					{loading ? (
						<div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							최신 GEO 뉴스를 불러오는 중…
						</div>
					) : items.length === 0 ? (
						<div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
							조건에 맞는 기사가 없습니다.
						</div>
					) : (
						<>
							<div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
								{pagedItems.map((item) => (
									<GeoNewsCard
										key={item.id}
										item={item}
										onToggleBookmark={handleBookmark}
									/>
								))}
							</div>
							<div className="mt-5">
								<GeoNewsPagination page={safePage} totalPages={totalPages} onPageChange={goToPage} />
							</div>
						</>
					)}
				</div>
				<div className="xl:col-span-4 2xl:col-span-3">
					<TrendingTopicsWidget onSelect={applyTrendingTopic} />
				</div>
			</div>

			{toasts.length > 0 && (
				<div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
					{toasts.map((toast) => (
						<div
							key={toast.id}
							className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg ${
								toast.tone === 'error'
									? 'border-rose-200 bg-rose-50 text-rose-700'
									: 'border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
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
