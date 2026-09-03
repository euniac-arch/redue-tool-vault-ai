'use client';

import { useState, type MouseEvent } from 'react';
import { Bookmark, Share2 } from 'lucide-react';
import { withNewsTitleEllipsis } from '@/lib/insights/insights-news-title';
import { resolveArticleCategory, type InsightsNewsItem } from '@/lib/insights/insights-news-types';
import { canUseWebShare, copyNewsLink } from '@/lib/insights/saved-news';
import { InsightsNewsCategoryBadge, InsightsNewsRegionBadge } from './insights-news-badges';

const ACTION_BTN =
	'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md p-1.5 border border-slate-200 bg-white text-slate-400 transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700/70 dark:bg-slate-800/80 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-white';

interface InsightsNewsCardProps {
	item: InsightsNewsItem;
	saved?: boolean;
	onToggleSave?: (item: InsightsNewsItem) => void;
	onShareResult?: (ok: boolean, message: string) => void;
	showVaultSave?: boolean;
	vaultSaved?: boolean;
	vaultSaving?: boolean;
	onSaveToVault?: (item: InsightsNewsItem) => void;
}

export function InsightsNewsCard({
	item,
	saved = false,
	onToggleSave,
	onShareResult,
	showVaultSave = false,
	vaultSaved = false,
	vaultSaving = false,
	onSaveToVault,
}: InsightsNewsCardProps) {
	const category = resolveArticleCategory(item);
	const [copied, setCopied] = useState(false);
	const shareUrl = item.sourceUrl;
	const title = withNewsTitleEllipsis(item.title);

	async function handleShare(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!shareUrl) {
			onShareResult?.(false, '공유할 링크가 없습니다.');
			return;
		}
		try {
			if (canUseWebShare()) {
				await navigator.share({
					title,
					text: item.summary,
					url: shareUrl,
				});
				onShareResult?.(true, '기사를 공유했습니다.');
				return;
			}
			await copyNewsLink(shareUrl);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
			onShareResult?.(true, '기사 링크가 클립보드에 복사되었습니다.');
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			try {
				await copyNewsLink(shareUrl);
				setCopied(true);
				window.setTimeout(() => setCopied(false), 1600);
				onShareResult?.(true, '기사 링크가 클립보드에 복사되었습니다.');
			} catch {
				onShareResult?.(false, '링크를 복사하지 못했습니다.');
			}
		}
	}

	function handleToggleSave(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		onToggleSave?.(item);
	}

	function handleSaveToVault(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (vaultSaved || vaultSaving) return;
		onSaveToVault?.(item);
	}

	return (
		<article className="flex h-full min-w-0 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-cyan-500/40">
			<div className="min-w-0">
				<div className="flex items-start justify-between gap-3">
					<div className="flex flex-wrap items-center gap-1.5">
						<InsightsNewsRegionBadge region={item.region === 'KR' ? 'KR' : 'GLOBAL'} />
						<InsightsNewsCategoryBadge category={category} />
					</div>
					<time className="shrink-0 text-xs text-slate-500 dark:text-slate-400" dateTime={item.publishedAtIso}>
						{item.publishedAt}
					</time>
				</div>

				<a
					href={item.sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="mt-3 line-clamp-2 min-w-0 overflow-hidden break-words text-base font-bold leading-snug text-slate-900 transition-colors hover:text-cyan-600 dark:text-slate-100 dark:hover:text-cyan-400 sm:text-[17px]"
				>
					{title}
				</a>

				<p className="mt-2 line-clamp-2 break-keep text-xs leading-relaxed text-slate-600 dark:text-slate-400">
					{item.summary}
				</p>
			</div>

			<footer className="mt-auto flex items-end justify-between gap-3 pt-3">
				<div className="min-w-0">
					{item.tags.length > 0 && (
						<div className="mb-2 flex flex-wrap gap-1.5">
							{item.tags.map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
								>
									#{tag.replace(/^#/, '')}
								</span>
							))}
						</div>
					)}
					<p className="text-xs font-medium text-slate-500 dark:text-slate-500">{item.sourceName}</p>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<button
						type="button"
						onClick={handleShare}
						title={copied ? '복사됨!' : '링크 공유'}
						aria-label={copied ? '링크 복사됨' : '링크 공유'}
						className={ACTION_BTN}
					>
						<Share2 className="h-3.5 w-3.5" aria-hidden />
					</button>
					<button
						type="button"
						onClick={handleToggleSave}
						title={saved ? '스크랩 해제' : '스크랩'}
						aria-label={saved ? '스크랩 해제' : '스크랩'}
						aria-pressed={saved}
						className={`${ACTION_BTN} ${saved ? 'border-cyan-400/50 text-cyan-400 hover:text-cyan-300 dark:border-cyan-500/40' : ''}`}
					>
						<Bookmark
							className={`h-3.5 w-3.5 ${saved ? 'fill-cyan-400 text-cyan-400' : ''}`}
							aria-hidden
						/>
					</button>
				</div>
			</footer>
			{showVaultSave ? (
				<button
					type="button"
					onClick={handleSaveToVault}
					disabled={vaultSaved || vaultSaving}
					className={`mt-3 inline-flex h-8 w-full items-center justify-center rounded-xl border text-xs font-bold transition ${
						vaultSaved
							? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
							: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300'
					} disabled:cursor-not-allowed disabled:opacity-70`}
				>
					{vaultSaving ? '저장 중…' : vaultSaved ? '보관함에 저장됨' : '📌 보관함 저장'}
				</button>
			) : null}
		</article>
	);
}
