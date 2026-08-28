'use client';

import { useMemo, useState } from 'react';
import { BarChart3, LayoutGrid, Search, Sparkles, type LucideIcon } from 'lucide-react';
import { resolveLucideIcon } from '@/components/admin/ai-tools/ai-tools-badges';
import { MarketShareBar } from '@/components/admin/ai-tools/MarketShareBar';
import { AI_TOOL_SORT_OPTIONS, type AiToolSortKey } from '@/lib/admin/ai-tools-management';
import {
	getProcessedPublicCategories,
	getPublicAiHubCategories,
	loadPublicAiTools,
	type AiTool,
	type AiToolCategoryId,
} from '@/lib/ai-hub';
import { AiHubToolCard } from './AiHubToolCard';
import { AiHubDetailModal } from './AiHubDetailModal';
import { AiHubTodayRankModal } from './AiHubTodayRankModal';

const KICKER =
	'inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-700 dark:border-[#1f3a5a] dark:bg-[#0b1726] dark:text-[#4fd1d9]';
const GRADIENT_TEXT = 'bg-gradient-to-r from-[#5565C7] to-[#0C9AA7] bg-clip-text text-transparent';

export function AiHubDashboard() {
	const [tools] = useState<AiTool[]>(() => loadPublicAiTools());
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState<'all' | AiToolCategoryId>('all');
	const [sortKey, setSortKey] = useState<AiToolSortKey>('market_share');
	const [activeToolId, setActiveToolId] = useState<string | null>(null);
	const [rankModalOpen, setRankModalOpen] = useState(false);

	const tabCategories = useMemo(() => getPublicAiHubCategories(tools), [tools]);
	const processedCategories = useMemo(
		() => getProcessedPublicCategories(tools, query, sortKey),
		[tools, query, sortKey],
	);
	const visibleCategories = useMemo(
		() => processedCategories.filter((cat) => category === 'all' || cat.id === category),
		[processedCategories, category],
	);
	const activeTool = useMemo(() => tools.find((tool) => tool.id === activeToolId) ?? null, [tools, activeToolId]);
	const hasResults = visibleCategories.length > 0;

	return (
		<div className="flex flex-col gap-8">
			<section className="flex flex-col gap-4">
				<span className={KICKER}>
					<span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#5565C7] to-[#0C9AA7]" />
					GLOBAL AI TOOLS
				</span>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
					엄선된 <span className={GRADIENT_TEXT}>글로벌 AI 도구</span> 모음
				</h1>
				<p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300/80">
					대화형 AI부터 이미지·비디오·음성·코딩까지 — 지금 가장 많이 쓰이는 AI 서비스를 한곳에서 비교하고,
					요금제와 활용 가이드를 확인한 뒤 바로 시작해 보세요.
				</p>

				<div className="relative mt-1 max-w-xl">
					<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="도구명, 설명, 태그로 검색 (예: 이미지, 코딩, TTS...)"
						className="theme-input h-11 pl-10"
					/>
				</div>

				{tools.length > 0 && (
					<div className="flex flex-col items-stretch gap-3 sm:flex-row">
						<div className="flex-1">
							<MarketShareBar tools={tools} />
						</div>
						<button
							type="button"
							onClick={() => setRankModalOpen(true)}
							className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90 sm:w-auto sm:self-stretch"
						>
							<BarChart3 className="h-4 w-4" aria-hidden />
							오늘자 순위 분석 보기
						</button>
					</div>
				)}
			</section>

			<section className="flex flex-col gap-4">
				<div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
					<p className="text-xs font-semibold text-slate-500 dark:text-slate-400">정렬 기준</p>
					<div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-cyan-200/70 bg-cyan-50/60 p-1 dark:border-cyan-900/30 dark:bg-[#0a1626]/80">
						{AI_TOOL_SORT_OPTIONS.map((option) => (
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
					aria-label="AI 도구 카테고리"
				>
					<CategoryPill active={category === 'all'} icon={LayoutGrid} label="전체" onClick={() => setCategory('all')} />
					{tabCategories.map((cat) => (
						<CategoryPill
							key={cat.id}
							active={category === cat.id}
							icon={resolveLucideIcon(cat.icon)}
							label={cat.label}
							onClick={() => setCategory(cat.id)}
						/>
					))}
				</nav>
			</section>

			{!hasResults ? (
				<div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
					<Sparkles className="h-6 w-6 text-slate-400" aria-hidden />
					<p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
						조건에 맞는 AI 도구가 없습니다. 다른 검색어나 카테고리를 시도해 보세요.
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-10">
					{visibleCategories.map((cat) => {
						const CatIcon = resolveLucideIcon(cat.icon);
						return (
							<div key={cat.id} className="flex flex-col gap-4">
								<div className="flex items-center gap-2.5 border-b border-slate-200 pb-3 dark:border-slate-700">
									<CatIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400" aria-hidden />
									<h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{cat.label}</h2>
									<span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
										{cat.tools.length}개
									</span>
								</div>
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{cat.tools.map((tool, index) => (
										<AiHubToolCard
											key={tool.id}
											tool={tool}
											rank={index + 1}
											onOpenDetail={(selected) => setActiveToolId(selected.id)}
										/>
									))}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{activeTool && <AiHubDetailModal tool={activeTool} onClose={() => setActiveToolId(null)} />}

			{rankModalOpen && <AiHubTodayRankModal tools={tools} onClose={() => setRankModalOpen(false)} />}
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
