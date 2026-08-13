'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PageSpeedSnapshot, PsiCategoryId, PsiScoreTier } from '@/lib/audit/pagespeed';

const PROGRESS_STEPS = ['step1', 'step2', 'step3'] as const;
const STEP_INTERVAL_MS = 3000;

const TIER_STYLES: Record<
	PsiScoreTier,
	{
		ring: string;
		bg: string;
		text: string;
		stroke: string;
		track: string;
		labelKey: 'poor' | 'needsImprovement' | 'good';
	}
> = {
	poor: {
		ring: 'ring-rose-400/40',
		bg: 'bg-rose-500/10',
		text: 'text-rose-300',
		stroke: 'stroke-rose-400',
		track: 'stroke-rose-500/15',
		labelKey: 'poor',
	},
	'needs-improvement': {
		ring: 'ring-amber-400/40',
		bg: 'bg-amber-500/10',
		text: 'text-amber-300',
		stroke: 'stroke-amber-400',
		track: 'stroke-amber-500/15',
		labelKey: 'needsImprovement',
	},
	good: {
		ring: 'ring-emerald-400/40',
		bg: 'bg-emerald-500/10',
		text: 'text-emerald-300',
		stroke: 'stroke-emerald-400',
		track: 'stroke-emerald-500/15',
		labelKey: 'good',
	},
};

const CATEGORY_LABEL_KEY: Record<PsiCategoryId, string> = {
	performance: 'performance',
	accessibility: 'accessibility',
	'best-practices': 'bestPractices',
	seo: 'seo',
};

const RING_R = 34;
const RING_C = 2 * Math.PI * RING_R;

interface PageSpeedScoreCardsProps {
	snapshot: PageSpeedSnapshot | null;
	loading?: boolean;
	compact?: boolean;
}

/**
 * PageSpeed Insights 4대 핵심 지표 — 원형 프로그레스 카드.
 * 0–49 위험 / 50–89 개선필요 / 90–100 양호
 */
export function PageSpeedScoreCards({ snapshot, loading, compact }: PageSpeedScoreCardsProps) {
	const t = useTranslations('audit.pageSpeed');

	if (loading && !snapshot) {
		return <PageSpeedScoreCardsSkeleton />;
	}

	if (!snapshot) return null;

	return (
		<div className={compact ? 'flex flex-col gap-3' : 'flex flex-col gap-3'}>
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300/80">
						{t('cardsBadge')}
					</p>
					<p className="mt-0.5 text-sm font-semibold text-slate-200">{t('cardsTitle')}</p>
				</div>
				<span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-slate-400">
					{t('strategyLabel', {
						strategy: t(`strategyNames.${snapshot.strategy}`),
					})}
				</span>
			</div>
			<div
				className="grid grid-cols-2 gap-3 lg:grid-cols-4"
				role="list"
				aria-label={t('cardsAriaLabel')}
			>
				{snapshot.categories.map((cat) => {
					const style = TIER_STYLES[cat.tier];
					const score = cat.score ?? 0;
					const offset = RING_C - (Math.min(100, Math.max(score, 0)) / 100) * RING_C;
					return (
						<article
							key={cat.id}
							role="listitem"
							className={`flex flex-col items-center rounded-xl border border-white/10 ${style.bg} p-3.5 ring-1 ${style.ring}`}
						>
							<p className="w-full text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
								{t(`categories.${CATEGORY_LABEL_KEY[cat.id]}`)}
							</p>
							<div className="relative mt-2 flex h-[88px] w-[88px] items-center justify-center">
								<svg
									className="-rotate-90"
									width="88"
									height="88"
									viewBox="0 0 88 88"
									aria-hidden
								>
									<circle
										cx="44"
										cy="44"
										r={RING_R}
										fill="none"
										strokeWidth="6"
										className={style.track}
									/>
									<circle
										cx="44"
										cy="44"
										r={RING_R}
										fill="none"
										strokeWidth="6"
										strokeLinecap="round"
										className={`${style.stroke} transition-[stroke-dashoffset] duration-700 ease-out`}
										strokeDasharray={RING_C}
										strokeDashoffset={cat.score == null ? RING_C : offset}
									/>
								</svg>
								<div className="absolute inset-0 flex flex-col items-center justify-center">
									<span className={`text-2xl font-extrabold tabular-nums leading-none ${style.text}`}>
										{cat.score == null ? '—' : score}
									</span>
									<span className="mt-0.5 text-[9px] text-slate-500">/100</span>
								</div>
							</div>
							<p className={`mt-1.5 text-[11px] font-bold ${style.text}`}>
								{t(`tiers.${style.labelKey}`)}
							</p>
						</article>
					);
				})}
			</div>
		</div>
	);
}

/** Compact scoreboard skeleton with rotating PSI progress copy (3s). */
function PageSpeedScoreCardsSkeleton() {
	const t = useTranslations('audit.pageSpeed');
	const [stepIndex, setStepIndex] = useState(0);
	const [messageKey, setMessageKey] = useState(0);

	useEffect(() => {
		const id = window.setInterval(() => {
			setStepIndex((prev) => {
				const next = (prev + 1) % PROGRESS_STEPS.length;
				setMessageKey((k) => k + 1);
				return next;
			});
		}, STEP_INTERVAL_MS);
		return () => window.clearInterval(id);
	}, []);

	const stepKey = PROGRESS_STEPS[stepIndex];

	return (
		<div className="flex flex-col gap-3" aria-busy="true" aria-live="polite" role="status">
			<div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3.5 py-3">
				<span className="relative mt-1 flex h-2 w-2 shrink-0">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
					<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300/70">
						{t('measuring')}
						<span className="ml-2 tabular-nums text-emerald-400/80">
							{t('progressStepLabel', { current: stepIndex + 1, total: PROGRESS_STEPS.length })}
						</span>
					</p>
					<p
						key={messageKey}
						className="psi-progress-msg mt-1 text-xs font-semibold leading-snug text-emerald-100/90"
					>
						{t(`progressSteps.${stepKey}`)}
					</p>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="flex h-[148px] flex-col items-center justify-center gap-2 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.04] p-3.5"
					>
						<div className="h-2.5 w-16 rounded bg-white/10" />
						<div className="h-[72px] w-[72px] rounded-full border-4 border-white/[0.06]" />
						<div className="h-2.5 w-12 rounded bg-white/10" />
					</div>
				))}
			</div>
		</div>
	);
}
