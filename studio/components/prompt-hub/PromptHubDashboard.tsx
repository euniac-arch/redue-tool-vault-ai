'use client';

import { useMemo, useState } from 'react';
import { Bookmark, LayoutGrid, Search, Sparkles, type LucideIcon } from 'lucide-react';
import { resolveLucideIcon } from '@/components/admin/ai-tools/ai-tools-badges';
import { PromptCard } from '@/components/prompt-hub/PromptCard';
import { PromptHubNextSteps, PromptHubRoleMap } from '@/components/prompt-hub/PromptHubNextSteps';
import {
	PROMPT_CATEGORIES,
	PROMPT_SORT_OPTIONS,
	filterFavoritePrompts,
	loadPrompts,
	searchPrompts,
	sortPrompts,
	type PromptCategoryId,
	type PromptSortKey,
} from '@/lib/prompt-hub';
import { readPromptCollection } from '@/lib/prompt-hub-collection';

const KICKER =
	'inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:border-[#1f3a5a] dark:bg-[#0b1726] dark:text-[#4fd1d9]';
const GRADIENT_TEXT = 'bg-gradient-to-r from-[#5565C7] to-[#0C9AA7] bg-clip-text text-transparent';

type FilterId = 'all' | 'saved' | PromptCategoryId;

export function PromptHubDashboard() {
	const [prompts] = useState(() => loadPrompts());
	const [query, setQuery] = useState('');
	const [filter, setFilter] = useState<FilterId>('all');
	const [sortKey, setSortKey] = useState<PromptSortKey>('recommended');
	const [favorites, setFavorites] = useState<string[]>(() => readPromptCollection().favorites);

	const categoryFilter: 'all' | PromptCategoryId = filter === 'saved' ? 'all' : filter;
	const searched = useMemo(() => searchPrompts(prompts, query, categoryFilter), [prompts, query, categoryFilter]);
	const scoped = useMemo(
		() => (filter === 'saved' ? filterFavoritePrompts(searched, favorites) : searched),
		[searched, filter, favorites],
	);
	const visible = useMemo(() => sortPrompts(scoped, sortKey), [scoped, sortKey]);

	function refreshFavorites() {
		setFavorites(readPromptCollection().favorites);
	}

	return (
		<div className="flex flex-col gap-8">
			<section className="flex flex-col gap-4">
				<span className={KICKER}>
					<span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#5565C7] to-[#0C9AA7]" />
					AI PROMPT HUB
				</span>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
					실전에 바로 쓰는 <span className={GRADIENT_TEXT}>AI 프롬프트</span> 모음
				</h1>
				<p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300/80">
					SEO · GEO · AEO · Entity · Schema · Local 작업에 바로 사용할 수 있는 범용 프롬프트입니다. 특정 사이트
					작업안이 아니라, AI에게 무엇을 시킬지를 제공합니다.
				</p>

				<PromptHubRoleMap />

				<div className="relative mt-1 max-w-xl">
					<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="프롬프트 검색..."
						aria-label="프롬프트 검색"
						className="theme-input h-11 pl-10"
					/>
				</div>
			</section>

			<section className="flex flex-col gap-4">
				<div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
					<p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
						{visible.length}개 프롬프트
					</p>
					<div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-cyan-200/70 bg-cyan-50/60 p-1 dark:border-cyan-900/30 dark:bg-[#0a1626]/80">
						{PROMPT_SORT_OPTIONS.map((option) => (
							<button
								key={option.key}
								type="button"
								onClick={() => setSortKey(option.key)}
								aria-pressed={sortKey === option.key}
								className={`rounded-lg border px-3 py-1.5 text-xs transition-all duration-150 ${
									sortKey === option.key
										? 'border-cyan-400/60 bg-white font-semibold text-slate-900 shadow-md shadow-black/10 dark:border-cyan-500/50 dark:bg-[#13233a] dark:text-white dark:shadow-black/30'
										: 'border-transparent bg-transparent font-medium text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'
								}`}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>

				<nav
					className="-mx-1 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-cyan-200/70 bg-cyan-50/60 p-1 dark:border-cyan-900/30 dark:bg-[#0a1626]/80 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					aria-label="프롬프트 카테고리"
				>
					<CategoryPill active={filter === 'all'} icon={LayoutGrid} label="전체" onClick={() => setFilter('all')} />
					<CategoryPill
						active={filter === 'saved'}
						icon={Bookmark}
						label="저장됨"
						onClick={() => {
							refreshFavorites();
							setFilter('saved');
						}}
					/>
					{PROMPT_CATEGORIES.map((cat) => (
						<CategoryPill
							key={cat.id}
							active={filter === cat.id}
							icon={resolveLucideIcon(cat.icon)}
							label={cat.label}
							onClick={() => setFilter(cat.id)}
						/>
					))}
				</nav>
			</section>

			{visible.length === 0 ? (
				<div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
					<Sparkles className="h-6 w-6 text-slate-400" aria-hidden />
					<p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
						{filter === 'saved'
							? '저장한 프롬프트가 없습니다. 상세 화면에서 즐겨찾기를 추가해 보세요.'
							: '조건에 맞는 프롬프트가 없습니다. 다른 검색어나 카테고리를 시도해 보세요.'}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{visible.map((prompt) => (
						<PromptCard key={prompt.slug} prompt={prompt} favorited={favorites.includes(prompt.slug)} />
					))}
				</div>
			)}

			<PromptHubNextSteps />
		</div>
	);
}

function CategoryPill({
	active,
	icon: Icon,
	label,
	onClick,
}: {
	active: boolean;
	icon: LucideIcon;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs transition-all duration-150 ${
				active
					? 'border-cyan-400/60 bg-white font-semibold text-slate-900 shadow-md shadow-black/10 dark:border-cyan-500/50 dark:bg-[#13233a] dark:text-white dark:shadow-black/30'
					: 'border-transparent bg-transparent font-medium text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'
			}`}
		>
			<Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
			{label}
		</button>
	);
}
