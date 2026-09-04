'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Video, Zap } from 'lucide-react';
import type { InsightsSearchMode } from '@/lib/insights/insights-ai-research';
import type { InsightsAiUsageSnapshot } from '@/lib/insights/insights-ai-usage';

interface InsightsSearchModeBarProps {
	mode: InsightsSearchMode;
	usage: InsightsAiUsageSnapshot;
	onChange: (mode: InsightsSearchMode) => void;
}

export function InsightsSearchModeBar({ mode, usage, onChange }: InsightsSearchModeBarProps) {
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const displayRemaining = isMounted ? usage.remaining : usage.limit;
	const remainingLabel =
		isMounted && usage.unlimited ? '무제한' : `오늘 잔여: ${displayRemaining}/${usage.limit}회`;

	const tabClass = (active: boolean) =>
		`relative z-10 flex min-h-14 flex-col items-start justify-center rounded-xl border px-2 py-2 text-left transition-colors md:min-h-[3.75rem] md:px-3 ${
			active
				? 'border-cyan-300 bg-cyan-50 text-cyan-700 shadow-sm dark:border-cyan-500/50 dark:bg-slate-800 dark:text-cyan-400 dark:shadow-lg dark:shadow-cyan-950/40'
				: 'border-slate-200 bg-transparent text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:text-slate-200'
		}`;

	return (
		<div className="relative grid w-full grid-cols-3 gap-2" role="tablist" aria-label="검색 모드">
				<button type="button" role="tab" aria-selected={mode === 'feed'} onClick={() => onChange('feed')} className={tabClass(mode === 'feed')}>
					<span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold leading-tight md:text-base">
						<Zap className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" aria-hidden />
						<span className="truncate">실시간 피드</span>
					</span>
					<span className="mt-0.5 text-[10px] font-medium leading-tight text-slate-500 md:text-[11px]">DB·RSS 빠른 탐색</span>
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={mode === 'ai'}
					title={remainingLabel}
					suppressHydrationWarning
					onClick={() => onChange('ai')}
					className={tabClass(mode === 'ai')}
				>
					<span className="flex w-full min-w-0 items-center justify-between gap-1">
						<span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-bold leading-tight md:text-base">
							<Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
							<span className="truncate">AI 리서치</span>
						</span>
						<span className="shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
							PRO
						</span>
					</span>
					<span
						title={remainingLabel}
						suppressHydrationWarning
						className={`mt-0.5 inline-flex max-w-full truncate rounded-full border px-1.5 py-px text-[10px] font-semibold ${
							isMounted && usage.unlimited
								? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-300'
								: isMounted && usage.remaining <= 0
									? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300'
									: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300'
						}`}
					>
						{remainingLabel}
					</span>
				</button>
			<button type="button" role="tab" aria-selected={mode === 'youtube'} onClick={() => onChange('youtube')} className={tabClass(mode === 'youtube')}>
				<span className="inline-flex items-center gap-1.5 text-sm font-bold leading-tight md:text-base">
					<Video className="h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
					<span className="truncate">유튜브</span>
				</span>
				<span className="mt-0.5 text-[10px] font-medium leading-tight text-slate-500 md:text-[11px]">AI 영상 인사이트</span>
			</button>
		</div>
	);
}
