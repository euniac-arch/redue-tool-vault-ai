'use client';

import { useState, type MouseEvent } from 'react';
import { Bookmark, ChevronDown, Loader2, Play, Share2, Sparkles } from 'lucide-react';
import { formatYoutubePublishedAt, type InsightsYoutubeVideo } from '@/lib/insights/insights-youtube';
import type { VideoSummaryCacheEntry } from '@/lib/insights/youtube-summary-cache';
import { canUseWebShare, copyNewsLink } from '@/lib/insights/saved-news';

const ACTION_BTN =
	'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md p-1.5 border border-slate-200 bg-white text-slate-400 transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700/70 dark:bg-slate-800/80 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-white';

interface YouTubeInsightCardProps {
	item: InsightsYoutubeVideo;
	saved?: boolean;
	summary?: VideoSummaryCacheEntry | null;
	loading?: boolean;
	open?: boolean;
	error?: string | null;
	onPlay?: (item: InsightsYoutubeVideo) => void;
	onToggleSave?: (item: InsightsYoutubeVideo) => void;
	onToggleSummary?: (item: InsightsYoutubeVideo) => void;
	onRefreshSummary?: (item: InsightsYoutubeVideo) => void;
	onShareResult?: (ok: boolean, message: string) => void;
}

export function YouTubeInsightCard({
	item,
	saved = false,
	summary = null,
	loading = false,
	open = false,
	error = null,
	onPlay,
	onToggleSave,
	onToggleSummary,
	onRefreshSummary,
	onShareResult,
}: YouTubeInsightCardProps) {
	const [copied, setCopied] = useState(false);
	const published = formatYoutubePublishedAt(item.publishedAt);
	const hasSummary = Boolean(summary && (summary.topic || summary.keyPoints.length || summary.implications));

	async function handleShare(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		try {
			if (canUseWebShare()) {
				await navigator.share({ title: item.title, text: item.description, url: item.videoUrl });
				onShareResult?.(true, '영상을 공유했습니다.');
				return;
			}
			await copyNewsLink(item.videoUrl);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
			onShareResult?.(true, '영상 링크가 클립보드에 복사되었습니다.');
		} catch (shareError) {
			if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
			try {
				await copyNewsLink(item.videoUrl);
				setCopied(true);
				window.setTimeout(() => setCopied(false), 1600);
				onShareResult?.(true, '영상 링크가 클립보드에 복사되었습니다.');
			} catch {
				onShareResult?.(false, '링크를 복사하지 못했습니다.');
			}
		}
	}

	function handleSave(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onToggleSave?.(item);
	}

	function handleToggleSummary(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (loading) return;
		onToggleSummary?.(item);
	}

	function handleRefresh(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (loading) return;
		onRefreshSummary?.(item);
	}

	function handlePlay(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onPlay?.(item);
	}

	const buttonLabel = loading
		? '요약 중…'
		: hasSummary
			? open
				? '📝 요약 닫기'
				: '📝 요약 보기'
			: error
				? '다시 시도 · ✨ AI 1분 핵심 요약'
				: '✨ AI 1분 핵심 요약';

	return (
		<article className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-cyan-500/40">
			<button
				type="button"
				onClick={handlePlay}
				className="relative block aspect-video w-full overflow-hidden bg-slate-950 text-left"
				aria-label={`${item.title} 재생`}
			>
				{item.thumbnailUrl ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
				) : (
					<div className="flex h-full items-center justify-center text-slate-500">YouTube</div>
				)}
				<span className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
					<span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-lg">
						<Play className="h-5 w-5 fill-white" aria-hidden />
					</span>
				</span>
				{item.durationLabel ? (
					<span className="absolute bottom-2 right-2 rounded bg-slate-950/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
						{item.durationLabel}
					</span>
				) : null}
			</button>

			<div className="flex flex-1 flex-col p-4">
				<button
					type="button"
					onClick={handlePlay}
					className="line-clamp-2 text-left text-sm font-bold leading-snug text-slate-900 transition-colors hover:text-cyan-600 dark:text-slate-100 dark:hover:text-cyan-400"
				>
					{item.title}
				</button>
				<p className="mt-2 text-[11px] font-medium text-slate-500">
					{item.channelTitle}
					{item.viewLabel ? ` · 조회수 ${item.viewLabel}` : ''}
					{published ? ` · ${published}` : ''}
				</p>

				<button
					type="button"
					onClick={handleToggleSummary}
					disabled={loading}
					aria-expanded={open}
					className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 text-[11px] font-bold text-cyan-700 transition hover:bg-cyan-500/20 disabled:opacity-60 dark:text-cyan-300"
				>
					{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
					{buttonLabel}
					<ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden />
				</button>

				<div
					className={`grid w-full min-w-0 transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
				>
					<div className="min-h-0 w-full min-w-0 overflow-hidden">
						<div className="relative mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-slate-950/75 px-3.5 py-3 shadow-[0_12px_32px_rgba(2,6,23,0.35)] backdrop-blur-xl">
							{loading ? (
								<div className="w-full space-y-2.5" aria-busy="true">
									<p className="flex w-full items-center gap-2 text-[11px] font-semibold text-cyan-200">
										<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
										자막을 읽고 gpt-4o-mini가 핵심을 정리하는 중…
									</p>
									<div className="h-3 w-full animate-pulse rounded bg-white/10" />
									<div className="h-3 w-full animate-pulse rounded bg-white/10" />
									<div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
								</div>
							) : hasSummary ? (
								<div className="flex w-full min-w-0 flex-col gap-3">
									<div className="flex w-full items-start justify-between gap-3">
										<p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300/80">AI 1분 핵심 요약</p>
										<button
											type="button"
											onClick={handleRefresh}
											disabled={loading}
											className="shrink-0 text-[10px] font-bold text-cyan-300/80 transition hover:text-cyan-200 disabled:opacity-50"
										>
											🔄 다시 요약
										</button>
									</div>
									{summary?.topic ? (
										<div className="w-full min-w-0">
											<p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300/80">핵심 주제</p>
											<p className="mt-1 w-full break-keep text-[12px] font-semibold leading-relaxed text-slate-100">
												{summary.topic}
											</p>
										</div>
									) : null}
									{summary?.keyPoints?.length ? (
										<div className="w-full min-w-0">
											<p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300/80">핵심 포인트</p>
											<ul className="mt-1.5 w-full space-y-1.5">
												{summary.keyPoints.map((point) => (
													<li key={point} className="flex w-full min-w-0 gap-2 text-[11px] leading-relaxed text-slate-200">
														<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
														<span className="min-w-0 flex-1 break-keep">{point}</span>
													</li>
												))}
											</ul>
										</div>
									) : null}
									{summary?.implications ? (
										<div className="w-full min-w-0 rounded-lg border border-cyan-400/15 bg-cyan-400/5 px-3 py-2">
											<p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300/80">실무 시사점</p>
											<p className="mt-1 w-full break-keep text-[11px] leading-relaxed text-slate-200">
												{summary.implications}
											</p>
										</div>
									) : null}
								</div>
							) : (
								<p className="w-full break-keep text-[11px] leading-relaxed text-amber-200/90">
									{error || '이 영상은 자막이 꺼져 있거나 추출할 수 없어 요약을 만들지 못했습니다.'}
								</p>
							)}
						</div>
					</div>
				</div>

				<footer className="mt-auto flex items-center justify-between gap-3 pt-3">
					<p className="truncate text-[11px] text-slate-500">YouTube</p>
					<div className="flex shrink-0 items-center gap-1.5">
						<button
							type="button"
							onClick={handleShare}
							title={copied ? '복사됨!' : '영상 링크 복사'}
							aria-label={copied ? '링크 복사됨' : '영상 링크 복사'}
							className={ACTION_BTN}
						>
							<Share2 className="h-3.5 w-3.5" aria-hidden />
						</button>
						<button
							type="button"
							onClick={handleSave}
							title={saved ? '스크랩 해제' : '영상 보관함 스크랩'}
							aria-label={saved ? '스크랩 해제' : '영상 보관함 스크랩'}
							aria-pressed={saved}
							className={`${ACTION_BTN} ${saved ? 'border-cyan-400/50 text-cyan-400 hover:text-cyan-300 dark:border-cyan-500/40' : ''}`}
						>
							<Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-cyan-400 text-cyan-400' : ''}`} aria-hidden />
						</button>
					</div>
				</footer>
			</div>
		</article>
	);
}
