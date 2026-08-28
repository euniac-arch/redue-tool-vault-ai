'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { PromptCategoryBadge } from '@/components/prompt-hub/prompt-hub-badges';
import { getCategoryLabel, getPromptHref, type AiPrompt } from '@/lib/prompt-hub';

export function PromptCard({
	prompt,
	favorited = false,
}: {
	prompt: AiPrompt;
	favorited?: boolean;
}) {
	return (
		<article className="relative flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-cyan-500/40">
			<div className="flex items-start justify-between gap-2">
				<PromptCategoryBadge category={prompt.category} label={getCategoryLabel(prompt.category)} />
				{favorited ? (
					<span className="inline-flex items-center text-amber-500" title="즐겨찾기됨">
						<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
						<span className="sr-only">즐겨찾기됨</span>
					</span>
				) : null}
			</div>

			<div className="min-w-0">
				<h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
					<Link href={getPromptHref(prompt.slug)} className="hover:text-cyan-700 dark:hover:text-cyan-300">
						{prompt.title}
					</Link>
				</h2>
				<p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{prompt.description}</p>
			</div>

			<div className="mt-auto flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
				{prompt.tags.slice(0, 4).map((tag) => (
					<span
						key={tag}
						className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
					>
						#{tag}
					</span>
				))}
			</div>

			<Link
				href={getPromptHref(prompt.slug)}
				className="inline-flex items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-100 dark:border-cyan-800/50 dark:bg-[#0b1726] dark:text-cyan-300 dark:hover:border-cyan-600/50"
			>
				프롬프트 보기
			</Link>
		</article>
	);
}
