'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadPublicAiTools } from '@/lib/ai-hub';
import {
	PROMPT_HUB_PATH,
	getCategoryLabel,
	getPromptHref,
	getRelatedPrompts,
	type AiPrompt,
} from '@/lib/prompt-hub';
import { readPromptCollection, recordPromptRecent, togglePromptFavorite } from '@/lib/prompt-hub-collection';
import { PromptCopyButton } from './PromptCopyButton';
import { PromptExternalTools } from './PromptExternalTools';
import { PromptFavoriteButton, PromptRecentHint } from './PromptPersonalizationBar';
import { PromptCategoryBadge, PromptDifficultyBadge } from './prompt-hub-badges';
import { PromptCard } from './PromptCard';
import { PromptHubNextSteps } from './PromptHubNextSteps';

export function PromptDetailView({ prompt }: { prompt: AiPrompt }) {
	const [favorited, setFavorited] = useState(false);
	const [recentRecorded, setRecentRecorded] = useState(false);
	const related = useMemo(() => getRelatedPrompts(prompt), [prompt]);
	const relatedTools = useMemo(
		() => loadPublicAiTools().filter((tool) => prompt.recommendedTools.includes(tool.id)),
		[prompt.recommendedTools],
	);

	useEffect(() => {
		const collection = readPromptCollection();
		setFavorited(collection.favorites.includes(prompt.slug));
		recordPromptRecent(prompt.slug);
		setRecentRecorded(true);
	}, [prompt.slug]);

	return (
		<article className="flex flex-col gap-8">
			<nav className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
				<Link href="/insights?tab=aeo-geo" className="hover:text-cyan-700 dark:hover:text-cyan-300">
					인사이트 &amp; AI 허브
				</Link>
				<span aria-hidden>/</span>
				<Link href={PROMPT_HUB_PATH} className="hover:text-cyan-700 dark:hover:text-cyan-300">
					AI 프롬프트 허브
				</Link>
				<span aria-hidden>/</span>
				<span className="text-slate-700 dark:text-slate-200">{prompt.title}</span>
			</nav>

			<header className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-1.5">
					<PromptCategoryBadge category={prompt.category} label={getCategoryLabel(prompt.category)} />
					<PromptDifficultyBadge difficulty={prompt.difficulty} />
				</div>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{prompt.title}</h1>
				<p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300/80">{prompt.description}</p>
				<div className="flex flex-wrap gap-1.5">
					{prompt.tags.map((tag) => (
						<span
							key={tag}
							className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
						>
							#{tag}
						</span>
					))}
				</div>
			</header>

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1f3a5a] dark:bg-[#0b1726]">
				<h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-400">목적</h2>
				<p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{prompt.purpose}</p>
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#1f3a5a] dark:bg-[#0b1726]">
				<div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between dark:border-[#1f3a5a] dark:bg-[#0b1726]/95">
					<h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-400">PROMPT</h2>
					<div className="flex flex-wrap items-center gap-2">
						<PromptFavoriteButton
							active={favorited}
							onToggle={() => {
								const next = togglePromptFavorite(prompt.slug);
								setFavorited(next.favorites.includes(prompt.slug));
							}}
						/>
						<PromptCopyButton text={prompt.prompt} />
					</div>
				</div>
				<pre className="max-h-[min(36rem,70vh)] overflow-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-[13px] leading-relaxed text-slate-800 dark:text-slate-100">
					{prompt.prompt}
				</pre>
			</section>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<PromptRecentHint show={recentRecorded} />
				<p className="text-[11px] text-slate-500 dark:text-slate-400">로그인 없이 복사·열람할 수 있습니다. 즐겨찾기는 이 브라우저에 저장됩니다.</p>
			</div>

			<PromptExternalTools toolIds={prompt.recommendedTools} promptText={prompt.prompt} />

			<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#1f3a5a] dark:bg-[#0b1726]">
				<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">활용 방법</h2>
				<ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
					<li>위 프롬프트를 복사합니다. 로그인하지 않아도 됩니다.</li>
					<li>대괄호 안의 플레이스홀더만 실제 값으로 바꿉니다. 없는 사실은 채우지 마세요.</li>
					<li>관련 AI 도구에서 붙여넣고 결과를 검토합니다.</li>
					<li>특정 사이트 작업안이 필요하면 진단 엔진 → 검색 전략 설계 → Execution Blueprint로 이어집니다.</li>
				</ol>
				{prompt.useCases.length > 0 ? (
					<ul className="mt-4 flex flex-wrap gap-1.5">
						{prompt.useCases.map((useCase) => (
							<li
								key={useCase}
								className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
							>
								{useCase}
							</li>
						))}
					</ul>
				) : null}
			</section>

			<section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<RelatedLinkCard
					kicker="관련 가이드"
					title="AEO · GEO 가이드"
					hint="AI 검색이 사이트를 출처로 채택하는 구조"
					href="/insights?tab=aeo-geo"
				/>
				<RelatedLinkCard
					kicker="관련 AI 도구"
					title={relatedTools.length ? relatedTools.map((tool) => tool.name).join(' · ') : '글로벌 AI 도구'}
					hint="무슨 AI 도구를 쓸지 비교"
					href="/insights?tab=ai-hub"
				/>
				<RelatedLinkCard
					kicker="관련 인사이트"
					title="인사이트 칼럼"
					hint="AI · GEO · Schema 최신 피드"
					href="/insights?tab=insights"
				/>
			</section>

			{related.length > 0 ? (
				<section className="flex flex-col gap-3">
					<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">관련 프롬프트</h2>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{related.map((item) => (
							<PromptCard key={item.slug} prompt={item} />
						))}
					</div>
				</section>
			) : null}

			<PromptHubNextSteps />

			<p className="text-center text-[11px] text-slate-400">
				<Link href={getPromptHref(prompt.slug)} className="hover:text-cyan-600">
					이 페이지 주소
				</Link>
				는 검색엔진이 개별 프롬프트를 이해할 수 있도록 열려 있습니다.
			</p>
		</article>
	);
}

function RelatedLinkCard({
	kicker,
	title,
	hint,
	href,
}: {
	kicker: string;
	title: string;
	hint: string;
	href: string;
}) {
	return (
		<Link
			href={href}
			className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-[#1f3a5a] dark:bg-[#0b1726] dark:hover:border-cyan-500/40"
		>
			<p className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">{kicker}</p>
			<p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
			<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p>
		</Link>
	);
}
