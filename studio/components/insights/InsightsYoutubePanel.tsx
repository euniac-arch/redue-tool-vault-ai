'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, TriangleAlert, Video } from 'lucide-react';
import { INSIGHTS_LOCAL_RESET_EVENT } from '@/lib/insights/insights-local-reset';
import {
	normalizeYoutubeTranscriptSummary,
	YOUTUBE_VISIBLE_PAGE_SIZE,
	type InsightsYoutubeVideo,
} from '@/lib/insights/insights-youtube';
import { INSIGHTS_PAGE_SIZE_OPTIONS } from '@/lib/insights/insights-news-types';
import { insightsFilterClass } from '@/lib/ui/insights-chrome';
import {
	getCachedVideoSummary,
	invalidateYoutubeSummaryMemory,
	readYoutubeSummaryCache,
	writeCachedVideoSummary,
	YOUTUBE_SUMMARY_CACHE_EVENT,
	type VideoSummaryCache,
	type VideoSummaryCacheEntry,
} from '@/lib/insights/youtube-summary-cache';
import { YouTubeInsightCard } from './YouTubeInsightCard';
import { YouTubeModal } from './YouTubeModal';

interface InsightsYoutubePanelProps {
	query: string;
	videos: InsightsYoutubeVideo[];
	loading: boolean;
	error: string | null;
	savedVideoIds: string[];
	onToggleSave: (item: InsightsYoutubeVideo) => void;
	onShareResult: (ok: boolean, message: string) => void;
	onRetry?: () => void;
	savedOnly?: boolean;
	pageSize?: number;
	visibleCount: number;
	onPageSizeChange?: (size: number) => void;
	onLoadMore: () => void;
	onBackToAll?: () => void;
}

function pickCachedSummaries(videos: InsightsYoutubeVideo[], cache: VideoSummaryCache): VideoSummaryCache {
	const next: VideoSummaryCache = {};
	for (const video of videos) {
		const entry = cache[video.videoId];
		if (entry) next[video.videoId] = entry;
	}
	return next;
}

export function InsightsYoutubePanel({
	query,
	videos,
	loading,
	error,
	savedVideoIds,
	onToggleSave,
	onShareResult,
	onRetry,
	savedOnly = false,
	pageSize = YOUTUBE_VISIBLE_PAGE_SIZE,
	visibleCount,
	onPageSizeChange,
	onLoadMore,
	onBackToAll,
}: InsightsYoutubePanelProps) {
	const [summaries, setSummaries] = useState<VideoSummaryCache>({});
	const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
	const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [activeVideo, setActiveVideo] = useState<InsightsYoutubeVideo | null>(null);
	const closePlayer = useCallback(() => setActiveVideo(null), []);

	useEffect(() => {
		function hydrateFromLocal() {
			setSummaries(pickCachedSummaries(videos, readYoutubeSummaryCache()));
		}
		function handleLocalReset() {
			invalidateYoutubeSummaryMemory();
			setSummaries({});
			setOpenStates({});
			setErrors({});
		}
		hydrateFromLocal();
		window.addEventListener(YOUTUBE_SUMMARY_CACHE_EVENT, hydrateFromLocal);
		window.addEventListener(INSIGHTS_LOCAL_RESET_EVENT, handleLocalReset);
		window.addEventListener('storage', hydrateFromLocal);
		return () => {
			window.removeEventListener(YOUTUBE_SUMMARY_CACHE_EVENT, hydrateFromLocal);
			window.removeEventListener(INSIGHTS_LOCAL_RESET_EVENT, handleLocalReset);
			window.removeEventListener('storage', hydrateFromLocal);
		};
	}, [videos]);

	async function requestSummary(item: InsightsYoutubeVideo, force: boolean) {
		if (loadingStates[item.videoId]) return;

		const cached = summaries[item.videoId] || getCachedVideoSummary(item.videoId);
		if (cached && !force) {
			setSummaries((prev) => (prev[item.videoId] ? prev : { ...prev, [item.videoId]: cached }));
			setOpenStates((prev) => ({ ...prev, [item.videoId]: !prev[item.videoId] }));
			return;
		}

		setOpenStates((prev) => ({ ...prev, [item.videoId]: true }));
		setLoadingStates((prev) => ({ ...prev, [item.videoId]: true }));
		setErrors((prev) => {
			const next = { ...prev };
			delete next[item.videoId];
			return next;
		});

		try {
			const res = await fetch('/api/insights/youtube-transcript', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				cache: 'no-store',
				body: JSON.stringify({ videoId: item.videoId, title: item.title }),
			});
			const body = (await res.json().catch(() => null)) as unknown;
			const result = normalizeYoutubeTranscriptSummary(body, item.videoId);
			if (!result.success) {
				setErrors((prev) => ({
					...prev,
					[item.videoId]: result.message || '자막이 지원되지 않는 영상입니다.',
				}));
				return;
			}
			const entry: VideoSummaryCacheEntry = {
				topic: result.topic || '',
				keyPoints: result.keyPoints || [],
				implications: result.implications || '',
				summarizedAt: Date.now(),
			};
			const saved = writeCachedVideoSummary(item.videoId, entry) || entry;
			setSummaries((prev) => ({ ...prev, [item.videoId]: saved }));
		} catch {
			setErrors((prev) => ({
				...prev,
				[item.videoId]: '자막이 지원되지 않는 영상입니다.',
			}));
		} finally {
			setLoadingStates((prev) => ({ ...prev, [item.videoId]: false }));
		}
	}

	if (loading) {
		return (
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: pageSize }).map((_, index) => (
					<div key={index} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50" />
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-2xl border border-rose-300/40 bg-rose-950/20 px-5 py-10 text-center">
				<TriangleAlert className="mx-auto h-6 w-6 text-rose-300" aria-hidden />
				<p className="mt-3 text-sm font-semibold text-rose-100">유튜브 영상을 불러오지 못했습니다.</p>
				<p className="mt-2 text-xs leading-relaxed text-rose-200/80">{error}</p>
				{onRetry ? (
					<button
						type="button"
						onClick={onRetry}
						className="mt-5 inline-flex h-9 items-center rounded-xl border border-rose-300/40 bg-rose-500/10 px-3.5 text-xs font-bold text-rose-100"
					>
						다시 시도
					</button>
				) : null}
			</div>
		);
	}

	if (videos.length === 0) {
		if (savedOnly) {
			return (
				<div className="flex flex-col">
					{onBackToAll ? (
						<button
							type="button"
							onClick={onBackToAll}
							className="mb-3 inline-flex w-fit items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200"
						>
							<ArrowLeft className="h-3.5 w-3.5" aria-hidden />
							전체 목록으로 돌아가기
						</button>
					) : null}
					<div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-14 text-center dark:border-slate-700 dark:bg-slate-900/40">
						<Video className="mx-auto h-6 w-6 text-slate-400" aria-hidden />
						<p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">저장된 영상이 없습니다.</p>
						<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
							유익한 영상을 북마크해 보세요!
						</p>
					</div>
				</div>
			);
		}
		return (
			<div className="rounded-2xl border border-dashed border-red-500/30 bg-red-950/10 px-5 py-14 text-center">
				<Video className="mx-auto h-6 w-6 text-red-400" aria-hidden />
				<p className="mt-3 text-sm font-semibold text-slate-200">AI 유튜브 영상 인사이트를 검색해 보세요</p>
				<p className="mt-1 text-xs leading-relaxed text-slate-400">
					키워드를 입력하면 관련 최신 영상 최대 50건을 모으고, 필요한 영상만 AI 1분 핵심 요약을 볼 수 있습니다.
				</p>
			</div>
		);
	}

	const visibleVideos = videos.slice(0, visibleCount);

	return (
		<div className="flex flex-col">
			{savedOnly && onBackToAll ? (
				<button
					type="button"
					onClick={onBackToAll}
					className="mb-1 inline-flex w-fit items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-cyan-200"
				>
					<ArrowLeft className="h-3.5 w-3.5" aria-hidden />
					전체 목록으로 돌아가기
				</button>
			) : null}
			<div className="mb-4 flex flex-wrap items-center justify-between gap-2 py-2">
				<p className="text-xs font-bold text-slate-400">
					{savedOnly
						? `저장한 영상 ${visibleVideos.length}/${videos.length}건`
						: query
							? `'${query}' 관련 영상 ${visibleVideos.length}/${videos.length}건`
							: `영상 ${visibleVideos.length}/${videos.length}건`}
				</p>
				{onPageSizeChange ? (
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
				) : null}
			</div>
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{visibleVideos.map((item) => (
					<YouTubeInsightCard
						key={item.videoId}
						item={item}
						saved={savedVideoIds.includes(item.videoId)}
						summary={summaries[item.videoId] || null}
						loading={Boolean(loadingStates[item.videoId])}
						open={Boolean(openStates[item.videoId])}
						error={errors[item.videoId] || null}
						onPlay={setActiveVideo}
						onToggleSave={onToggleSave}
						onToggleSummary={(video) => void requestSummary(video, false)}
						onRefreshSummary={(video) => void requestSummary(video, true)}
						onShareResult={onShareResult}
					/>
				))}
			</div>
			{visibleCount < videos.length ? (
				<button
					type="button"
					onClick={onLoadMore}
					className="mx-auto mt-6 inline-flex h-10 items-center rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20"
				>
					더 많은 최신 영상 보기 (+{pageSize}개) ({visibleCount} / {videos.length})
				</button>
			) : null}
			<YouTubeModal video={activeVideo} onClose={closePlayer} />
		</div>
	);
}
