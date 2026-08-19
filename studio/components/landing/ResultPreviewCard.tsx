'use client';

import Link from 'next/link';
import { AlertTriangle, CircleDot, Info, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LANDING_CARD } from '@/components/landing/landing-ui';

const OVERALL = 89;

const METRICS = [
	{ key: 'ai', value: 78 },
	{ key: 'seo', value: 81 },
	{ key: 'geo', value: 80 },
	{ key: 'schema', value: 72 },
] as const;

const TAGS = [
	{ key: 'ai', icon: Info, className: 'border-cyan-400/50 text-cyan-300' },
	{ key: 'seo', icon: Plus, className: 'border-emerald-400/50 text-emerald-300' },
	{ key: 'geo', icon: CircleDot, className: 'border-indigo-400/50 text-indigo-300' },
	{ key: 'schema', icon: AlertTriangle, className: 'border-orange-400/50 text-orange-300' },
] as const;

/** Sample audit preview: overall gauge, 4 pillar scores, status tags. */
export function ResultPreviewCard() {
	const t = useTranslations('landing.preview');

	return (
		<section aria-labelledby="audit-sample-preview-title" className={`${LANDING_CARD} mt-8 p-5`}>
			<h2 id="audit-sample-preview-title" className="sr-only">
				{t('label')}
			</h2>

			<div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center sm:gap-7">
				<div className="flex shrink-0 flex-col items-center gap-1.5">
					<p className="text-[13px] font-medium text-[#94A3B8]">{t('overallLabel')}</p>
					<ScoreRing value={OVERALL} />
					<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
						{t('overallGrade')}
					</span>
				</div>

				<ul className="grid w-full max-w-[420px] grid-cols-2 gap-x-3 gap-y-3 sm:max-w-none sm:flex-1 sm:grid-cols-4 sm:gap-x-3.5">
					{METRICS.map((metric) => (
						<li key={metric.key} className="min-w-0">
							<p className="truncate text-xs text-[#94A3B8]">{t(`metrics.${metric.key}`)}</p>
							<p className="mt-0.5 flex items-baseline gap-0.5">
								<span className="text-[22px] font-extrabold leading-none tabular-nums text-white">
									{metric.value}
								</span>
								<span className="text-[11px] text-[#64748B]">/100</span>
							</p>
							<div
								className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#1E2640]"
								role="meter"
								aria-valuenow={metric.value}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-label={t(`metrics.${metric.key}`)}
							>
								<div
									className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#6366F1]"
									style={{ width: `${metric.value}%` }}
								/>
							</div>
						</li>
					))}
				</ul>
			</div>

			<ul className="mt-6 flex flex-col flex-wrap items-stretch justify-center gap-2 sm:flex-row sm:items-center">
				{TAGS.map(({ key, icon: Icon, className }) => (
					<li
						key={key}
						className={`inline-flex items-center justify-center gap-1.5 rounded-full border bg-transparent px-3 py-1.5 text-[13px] ${className}`}
					>
						<Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
						{t(`tags.${key}`)}
					</li>
				))}
			</ul>

			<div className="mt-6 flex justify-center">
				<Link
					href="/portfolio"
					className="rounded-xl bg-[#6366F1] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#818CF8]"
				>
					{t('viewFull')}
				</Link>
			</div>
		</section>
	);
}

function ScoreRing({ value, max = 100 }: { value: number; max?: number }) {
	const size = 156;
	const stroke = 11;
	const radius = (size - stroke) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = Math.min(1, Math.max(0, value / max));

	return (
		<div className="relative h-[156px] w-[156px]">
			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="h-full w-full" aria-hidden>
				<defs>
					<linearGradient id="landing-score-ring" x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" stopColor="#7C3AED" />
						<stop offset="100%" stopColor="#6366F1" />
					</linearGradient>
				</defs>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="#1E2640"
					strokeWidth={stroke}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="url(#landing-score-ring)"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={`${circumference * progress} ${circumference}`}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-[32px] font-extrabold leading-none text-white">{value}</span>
				<span className="mt-0.5 text-[13px] text-[#64748B]">/100</span>
			</div>
		</div>
	);
}
