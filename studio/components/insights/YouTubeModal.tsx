'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalA11y } from '@/lib/ui/use-modal-a11y';
import { Loader2, ThumbsUp, X } from 'lucide-react';
import {
	canLoadMoreYoutubeComments,
	mergeYoutubeComments,
	normalizeYoutubeCommentsResult,
	YOUTUBE_COMMENTS_MAX,
	youtubeWatchUrl,
	type InsightsYoutubeComment,
	type InsightsYoutubeVideo,
} from '@/lib/insights/insights-youtube';

export type YouTubeModalVideo = Pick<InsightsYoutubeVideo, 'videoId' | 'title' | 'channelTitle'> &
	Partial<InsightsYoutubeVideo>;

interface YouTubeModalProps {
	video: InsightsYoutubeVideo | null;
	onClose: () => void;
}

const BODY_MODAL_CLASS = 'modal-open';

async function fetchCommentPage(videoId: string, pageToken = '') {
	const query = new URLSearchParams({ videoId });
	if (pageToken) query.set('pageToken', pageToken);
	const res = await fetch(`/api/insights/youtube-comments?${query.toString()}`, { cache: 'no-store' });
	const body = (await res.json().catch(() => null)) as unknown;
	return normalizeYoutubeCommentsResult(body, videoId);
}

export function YouTubeModal({ video, onClose }: YouTubeModalProps) {
	const [comments, setComments] = useState<InsightsYoutubeComment[]>([]);
	const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [commentsUnavailable, setCommentsUnavailable] = useState(false);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const loadingMoreRef = useRef(false);
	useModalA11y(Boolean(video), onClose, panelRef);

	const loadMore = useCallback(async (videoId: string, pageToken: string) => {
		if (loadingMoreRef.current) return;
		loadingMoreRef.current = true;
		setLoadingMore(true);
		try {
			const result = await fetchCommentPage(videoId, pageToken);
			setComments((prev) => mergeYoutubeComments(prev, result.comments));
			setNextPageToken(result.nextPageToken);
		} catch {
			setNextPageToken(undefined);
		} finally {
			loadingMoreRef.current = false;
			setLoadingMore(false);
		}
	}, []);

	useEffect(() => {
		if (!video) {
			setComments([]);
			setNextPageToken(undefined);
			setCommentsLoading(false);
			setLoadingMore(false);
			setCommentsUnavailable(false);
			return;
		}

		document.body.classList.add(BODY_MODAL_CLASS);

		let cancelled = false;
		setComments([]);
		setNextPageToken(undefined);
		setCommentsUnavailable(false);
		setCommentsLoading(true);
		fetchCommentPage(video.videoId)
			.then((result) => {
				if (cancelled) return;
				setComments(result.comments);
				setNextPageToken(result.nextPageToken);
				setCommentsUnavailable(!result.success);
			})
			.catch(() => {
				if (cancelled) return;
				setComments([]);
				setNextPageToken(undefined);
				setCommentsUnavailable(true);
			})
			.finally(() => {
				if (!cancelled) setCommentsLoading(false);
			});

		return () => {
			cancelled = true;
			document.body.classList.remove(BODY_MODAL_CLASS);
		};
	}, [video, onClose]);

	useEffect(() => {
		if (!video) return;
		const root = scrollRef.current;
		const sentinel = sentinelRef.current;
		if (!root || !sentinel) return;
		if (!canLoadMoreYoutubeComments(comments.length, nextPageToken) || commentsLoading) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				if (!nextPageToken || comments.length >= YOUTUBE_COMMENTS_MAX) return;
				void loadMore(video.videoId, nextPageToken);
			},
			{ root, rootMargin: '80px', threshold: 0.1 },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [video, comments.length, nextPageToken, commentsLoading, loadMore]);

	if (!video) return null;

	const watchUrl = youtubeWatchUrl(video.videoId);
	const reduceMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const embedSrc = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}?autoplay=${reduceMotion ? 0 : 1}&rel=0`;
	const reachedCap = comments.length >= YOUTUBE_COMMENTS_MAX;
	const canLoadMore = canLoadMoreYoutubeComments(comments.length, nextPageToken);

	return (
		<div
			className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md motion-reduce:backdrop-blur-none lg:p-8"
			onClick={onClose}
		>
			<div
				ref={panelRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-labelledby="youtube-player-title"
				aria-describedby="youtube-player-channel"
				className="flex h-full max-h-[90vh] w-full max-w-[1600px] flex-col gap-4 outline-none lg:flex-row lg:items-stretch"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex min-w-0 flex-1 flex-col justify-center">
					<div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
						<iframe
							key={video.videoId}
							src={embedSrc}
							title={video.title}
							tabIndex={-1}
							className="h-full w-full"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowFullScreen
						/>
					</div>
					<div className="mt-3 min-w-0">
						<h2 id="youtube-player-title" className="line-clamp-2 text-base font-bold leading-snug text-slate-100 sm:text-lg">
							{video.title}
						</h2>
						<p id="youtube-player-channel" className="mt-1 truncate text-xs font-medium text-slate-400">
							{video.channelTitle}
						</p>
						<a
							href={watchUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="mt-2 inline-flex text-[12px] font-semibold text-cyan-400 transition hover:text-cyan-300"
						>
							YouTube 원문에서 열기 ↗
						</a>
					</div>
				</div>

				<aside className="flex h-full max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 lg:w-[360px] xl:w-[420px]">
					<header className="flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-3">
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-bold text-slate-100">💬 실시간 주요 댓글 (인기순)</p>
							<p className="mt-0.5 text-[11px] font-medium text-slate-400">
								{commentsLoading ? '불러오는 중…' : `${comments.length}개`}
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							aria-label="모달 닫기"
							className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-700/50 bg-slate-800/80 text-slate-300 shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:bg-slate-700 hover:text-white active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
						>
							<X className="h-6 w-6" aria-hidden />
						</button>
					</header>
					<div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
						{commentsLoading ? (
							<div className="flex items-center justify-center gap-2 py-10 text-xs font-semibold text-slate-400">
								<Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
								댓글을 불러오는 중…
							</div>
						) : comments.length > 0 ? (
							<>
								{comments.map((comment) => (
									<article key={comment.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
										<div className="flex items-start gap-2.5">
											{comment.authorImageUrl ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={comment.authorImageUrl}
													alt=""
													className="h-8 w-8 shrink-0 rounded-full object-cover"
												/>
											) : (
												<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-200">
													{comment.authorName.slice(0, 1)}
												</span>
											)}
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
													<p className="truncate text-[12px] font-bold text-slate-100">{comment.authorName}</p>
													{comment.publishedLabel ? (
														<span className="text-[10px] text-slate-500">{comment.publishedLabel}</span>
													) : null}
												</div>
												<p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-300">{comment.text}</p>
												<p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
													<ThumbsUp className="h-3 w-3" aria-hidden />
													{comment.likeCount.toLocaleString('ko-KR')}
												</p>
											</div>
										</div>
									</article>
								))}
								{canLoadMore ? <div ref={sentinelRef} className="h-4" aria-hidden /> : null}
								{loadingMore ? (
									<p className="flex items-center justify-center gap-2 py-3 text-[11px] font-semibold text-slate-400">
										<Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
										댓글 20개를 더 불러오는 중…
									</p>
								) : null}
								{reachedCap ? (
									<div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-4 text-center">
										<p className="text-[12px] leading-relaxed text-slate-300">
											상위 100개 주요 댓글을 모두 불러왔습니다.
										</p>
										<a
											href={watchUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="mt-2 inline-flex text-[12px] font-bold text-cyan-400 transition hover:text-cyan-300"
										>
											유튜브에서 전체 댓글 보기 ↗
										</a>
									</div>
								) : null}
							</>
						) : (
							<p className="py-10 text-center text-xs leading-relaxed text-slate-400">
								{commentsUnavailable ? '댓글이 비활성화되었거나 없습니다' : '댓글이 비활성화되었거나 없습니다'}
							</p>
						)}
					</div>
				</aside>
			</div>
		</div>
	);
}
