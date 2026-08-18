'use client';

import { useState } from 'react';
import type { PortfolioItem } from '@/lib/portfolio-types';
import type { ModalMode } from './SchemaValidationModal';

interface PortfolioCardProps {
	item: PortfolioItem;
	onVerify: (item: PortfolioItem, mode: ModalMode) => void;
}

const SUB_SCORE_LABELS: { key: keyof PortfolioItem['subScores']; label: string }[] = [
	{ key: 'seo', label: 'SEO' },
	{ key: 'performance', label: '웹 성능' },
	{ key: 'schema', label: '스키마 검증' },
	{ key: 'accessibility', label: '웹 접근성' },
	{ key: 'geo', label: 'GEO AI 인식률' },
];

function microlinkScreenshotUrl(domainUrl: string): string {
	return `https://api.microlink.io/?url=${encodeURIComponent(domainUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
}

function formatScore(n: number): string {
	return n.toFixed(1);
}

function ScoreColumn({
	title,
	mainScore,
	mainMax,
	totalScore,
	totalMax,
	variant,
}: {
	title: string;
	mainScore: number;
	mainMax: number;
	totalScore: number;
	totalMax: number;
	variant: 'before' | 'after';
}) {
	const isAfter = variant === 'after';

	return (
		<div className="min-w-0 flex-1">
			<p className="text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
			<div className="mt-1.5">
				<p
					className={`text-[23px] font-extrabold leading-none tabular-nums ${
						isAfter ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
					}`}
				>
					{formatScore(mainScore)}
					<span className="text-[13px] font-medium text-slate-500"> /{mainMax}</span>
				</p>
				<p className="mt-0.5 text-[10px] leading-tight text-slate-500">SEO/GEO 메인 점수</p>
			</div>
			<div className="mt-2">
				<p
					className={`text-base font-bold leading-none tabular-nums ${
						isAfter ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'
					}`}
				>
					{formatScore(totalScore)}
					<span className="text-[13px] font-medium text-slate-500"> /{totalMax}</span>
				</p>
				<p className="mt-0.5 text-[10px] leading-tight text-slate-500">종합 점수</p>
			</div>
		</div>
	);
}

export function PortfolioCard({ item, onVerify }: PortfolioCardProps) {
	const [thumbFailed, setThumbFailed] = useState(false);
	const { normalized, algorithm } = item.scores;
	const gain = normalized.after - normalized.before;

	return (
		<article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:flex-row dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
			{/* Left: centered logo, then screenshot fallback */}
			<div className="relative aspect-video w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-[#0C0D0E] lg:aspect-auto lg:w-72 lg:self-stretch">
				{item.logoMark ? (
					<div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-3 lg:min-h-full">
						<span className="rounded-xl bg-accent px-5 py-2.5 text-xl font-bold tracking-wide text-white shadow-[0_0_40px_rgba(99,91,255,0.35)]">
							{item.logoMark}
						</span>
						{item.logoCaption ? (
							<span className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">{item.logoCaption}</span>
						) : null}
					</div>
				) : !thumbFailed ? (
					// eslint-disable-next-line @next/next/no-img-element -- local sample or external microlink screenshot
					<img
						src={item.thumbnailUrl || microlinkScreenshotUrl(item.domainUrl)}
						alt={`${item.projectName} 로고`}
						className="h-full w-full object-contain object-center"
						onError={() => setThumbFailed(true)}
					/>
				) : (
					<div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-accent/30 to-slate-900 text-center text-xs text-slate-300 lg:min-h-full">
						<span className="text-2xl">📸</span>
						<span>썸네일을 불러올 수 없습니다</span>
					</div>
				)}
				<span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
					{item.category}
				</span>
			</div>

			{/* Middle: project identity, sub-scores, actions */}
			<div className="flex flex-1 flex-col gap-3 p-5">
				<div>
					<h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.projectName}</h3>
					<a
						href={item.domainUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-accent hover:underline dark:text-accent-light"
					>
						{item.domainUrl}
					</a>
				</div>

				<div className="flex flex-wrap gap-2">
					{SUB_SCORE_LABELS.map(({ key, label }) => (
						<span key={key} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-black/20 dark:text-slate-300">
							{label} <span className="font-bold text-slate-900 dark:text-slate-100">{item.subScores[key]}</span>
						</span>
					))}
				</div>

				<div className="flex flex-wrap gap-1.5">
					{item.injectionTags.map((tag) => (
						<span key={tag} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-mono text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
							{tag}
						</span>
					))}
				</div>

				<div className="mt-auto flex flex-wrap gap-2 pt-2">
					<button
						onClick={() => onVerify(item, 'seo')}
						className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
					>
						실제 SEO 진단
					</button>
					<button
						onClick={() => onVerify(item, 'schema')}
						className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
					>
						Schema 검증
					</button>
					<button
						onClick={() => onVerify(item, 'geo')}
						className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
					>
						GEO 대응
					</button>
				</div>
			</div>

			{/* Right: Before → After score panel (lg:w-72 minus 15px) */}
			<aside className="flex w-full shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 lg:w-[273px] lg:border-l lg:border-t-0 dark:border-slate-800 dark:bg-white/[0.02]">
				<div className="flex justify-end">
					<span className="rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent dark:text-accent-light">
						{item.cmsType}
					</span>
				</div>

				<div className="flex min-w-0 flex-1 items-center gap-1">
					<ScoreColumn
						title="진단 전"
						mainScore={normalized.before}
						mainMax={normalized.maxScore}
						totalScore={algorithm.before}
						totalMax={algorithm.maxScore}
						variant="before"
					/>

					<span
						className="shrink-0 self-center px-0.5 text-sm leading-none text-slate-500"
						aria-hidden="true"
					>
						➔
					</span>

					<ScoreColumn
						title="최적화 결과"
						mainScore={normalized.after}
						mainMax={normalized.maxScore}
						totalScore={algorithm.after}
						totalMax={algorithm.maxScore}
						variant="after"
					/>
				</div>

				<div className="mt-auto flex flex-col items-center justify-center gap-0.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-center shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:shadow-[inset_0_1px_0_0_rgba(52,211,153,0.12)] dark:backdrop-blur-sm">
					<span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">▲ +{formatScore(gain)}pt 상승</span>
					<span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-300/70">
						진단전 {formatScore(normalized.before)}점 ➔ {formatScore(normalized.after)}점
					</span>
				</div>
			</aside>
		</article>
	);
}
