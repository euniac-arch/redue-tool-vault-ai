'use client';

import { useTranslations } from 'next-intl';
import { CHECKLIST_ITEM_COUNT } from '@/lib/audit/checklistDefinitions';

const SAMPLE_SCORE = 89;

const ENGINES = [
	{ key: 'chatgpt', name: 'ChatGPT', score: 56, level: 2 },
	{ key: 'gemini', name: 'Gemini', score: 78, level: 3 },
	{ key: 'perplexity', name: 'Perplexity', score: 80, level: 3 },
	{ key: 'claude', name: 'Claude', score: 81, level: 3 },
	{ key: 'copilot', name: 'Copilot', score: 60, level: 2 },
	{ key: 'clova', name: 'Clova', score: 60, level: 2 },
] as const;

/** Sample dual-score report card that previews the real audit dashboard. */
export function ResultPreviewCard() {
	const t = useTranslations('landing.preview');

	return (
		<section
			aria-labelledby="audit-sample-preview-title"
			className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/80 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-[0_28px_90px_-28px_rgba(0,0,0,0.65)]"
		>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-100"
				style={{
					background:
						'radial-gradient(ellipse 70% 55% at 8% -10%, rgba(99,102,241,0.22), transparent 52%), radial-gradient(ellipse 55% 45% at 96% 8%, rgba(16,185,129,0.16), transparent 48%), radial-gradient(ellipse 40% 35% at 70% 100%, rgba(139,92,246,0.12), transparent 50%)',
				}}
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
				style={{
					backgroundImage:
						'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
					backgroundSize: '28px 28px',
				}}
			/>

			<div className="relative flex flex-col gap-5 p-5 sm:gap-6 sm:p-7 lg:p-8">
				<header className="flex flex-col gap-3">
					<p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
						{t('kicker')}
					</p>
					<h2
						id="audit-sample-preview-title"
						className="inline-flex w-fit max-w-full items-center rounded-xl bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-emerald-500/15 px-3.5 py-2 text-base font-extrabold tracking-tight text-slate-900 ring-1 ring-indigo-500/15 dark:from-indigo-500/20 dark:via-violet-500/10 dark:to-emerald-500/15 dark:text-white dark:ring-white/10 sm:text-lg md:text-xl"
					>
						<span className="bg-gradient-to-r from-indigo-700 via-slate-900 to-emerald-700 bg-clip-text text-transparent dark:from-indigo-200 dark:via-white dark:to-emerald-200">
							{t('title')}
						</span>
					</h2>
					<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
						<span className="inline-flex w-fit max-w-full items-center rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold leading-relaxed text-indigo-700 dark:text-indigo-300 sm:text-xs">
							{t('siteChip')}
						</span>
						<span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 sm:text-xs">
							<span className="relative flex h-1.5 w-1.5 shrink-0">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
								<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
							</span>
							{t('statusBadge', { count: CHECKLIST_ITEM_COUNT })}
						</span>
					</div>
				</header>

				<div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
					<article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/50 sm:p-6">
						<div
							aria-hidden
							className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-emerald-400/15 blur-2xl"
						/>
						<p className="text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400">{t('heroLabel')}</p>
						<div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
							<ScoreRing value={SAMPLE_SCORE} />
							<div className="flex flex-col items-center text-center sm:items-start sm:text-left">
								<div className="flex items-end gap-1.5">
									<span className="text-6xl font-black leading-none tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-7xl">
										{SAMPLE_SCORE}
									</span>
									<span className="mb-1.5 text-lg font-semibold tabular-nums text-slate-400 dark:text-slate-500">
										{t('heroMax')}
									</span>
								</div>
								<span className="mt-3 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 sm:text-xs">
									{t('percentileBadge')}
								</span>
							</div>
						</div>
					</article>

					<article className="flex flex-col justify-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/50 sm:p-6">
						<p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[13px]">{t('formula')}</p>
						<p className="text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-100 sm:text-[15px]">
							{t('judgment')}
						</p>
						<div
							role="status"
							className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-bold leading-relaxed text-amber-800 dark:text-amber-300"
						>
							{t('actionCallout')}
						</div>
					</article>
				</div>

				<div>
					<h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
						{t('enginesTitle')}
					</h3>
					<ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
						{ENGINES.map((engine) => {
							const strong = engine.level === 3;
							return (
								<li
									key={engine.key}
									className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white/60 px-3.5 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/40"
								>
									<div className="flex items-center justify-between gap-2">
										<span className="text-[13px] font-extrabold text-slate-900 dark:text-white">{engine.name}</span>
										<span
											aria-hidden
											className={`h-2 w-2 rounded-full ${
												strong
													? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
													: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.65)]'
											}`}
										/>
									</div>
									<div className="flex items-baseline gap-1">
										<span className="text-xl font-black tabular-nums text-slate-900 dark:text-white">{engine.score}</span>
										<span className="text-[11px] font-semibold text-slate-400">/ 100</span>
									</div>
									<div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
										<div
											className={`h-full rounded-full ${
												strong
													? 'bg-gradient-to-r from-emerald-400 to-emerald-300'
													: 'bg-gradient-to-r from-amber-400 to-amber-300'
											}`}
											style={{ width: `${engine.score}%` }}
										/>
									</div>
									<span
										className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${
											strong
												? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
												: 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
										}`}
									>
										{strong ? t('level3') : t('level2')}
									</span>
								</li>
							);
						})}
					</ul>
				</div>

				<div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-4 dark:bg-rose-500/[0.08] sm:px-5">
					<p className="text-sm font-extrabold text-rose-800 dark:text-rose-300">{t('defectTitle')}</p>
					<p className="mt-1.5 text-xs leading-relaxed text-rose-700/90 dark:text-rose-200/80 sm:text-[13px]">
						{t('defectImpact')}
					</p>
				</div>
			</div>
		</section>
	);
}

function ScoreRing({ value, max = 100 }: { value: number; max?: number }) {
	const size = 132;
	const stroke = 10;
	const radius = (size - stroke) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = Math.min(1, Math.max(0, value / max));

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			className="shrink-0 drop-shadow-[0_0_18px_rgba(52,211,153,0.22)]"
			aria-hidden
		>
			<defs>
				<linearGradient id="audit-sample-score-ring" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="#34d399" />
					<stop offset="100%" stopColor="#818cf8" />
				</linearGradient>
			</defs>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke="currentColor"
				strokeWidth={stroke}
				className="text-slate-200 dark:text-slate-800"
			/>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke="url(#audit-sample-score-ring)"
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeDasharray={`${circumference * progress} ${circumference}`}
				transform={`rotate(-90 ${size / 2} ${size / 2})`}
			/>
		</svg>
	);
}
