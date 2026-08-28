'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PageSpeedReport, type PageSpeedStrategy } from '@/components/audit/PageSpeedReport';
import { useAuditData } from '@/components/audit/AuditDataContext';
import { scoreTier, type PageSpeedSnapshot, type PsiScoreTier } from '@/lib/audit/pagespeed';
import { useCountUp } from '@/lib/audit/use-count-up';

export interface Tab3CoreWebVitalsSectionProps {
	pageSpeed: PageSpeedSnapshot | null;
	pageSpeedDesktop?: PageSpeedSnapshot | null;
	pageSpeedMobile?: PageSpeedSnapshot | null;
	pageSpeedLoading: boolean;
	pageSpeedError: string | null;
	psiStrategy: PageSpeedStrategy;
	onPsiStrategyChange: (strategy: PageSpeedStrategy) => void;
	/** Track 3 부분 재진단(리프레시) 진행 중 여부 — 버튼 스피너/비활성화에 사용. */
	pageSpeedRefreshing?: boolean;
	/** 전체 사이트 재진단 없이 Lighthouse mobile/desktop만 다시 호출하는 핸들러. */
	onRefreshPageSpeed?: () => void;
	targetUrl: string;
}

/** Full literals so Tailwind always emits the utilities — mirrors PSI's poor/needs-improvement/good tiers. */
const TIER_RING: Record<PsiScoreTier, string> = {
	poor: 'text-rose-500',
	'needs-improvement': 'text-amber-500',
	good: 'text-emerald-500',
};

const TIER_TEXT: Record<PsiScoreTier, string> = {
	poor: 'text-rose-600 dark:text-rose-400',
	'needs-improvement': 'text-amber-600 dark:text-amber-400',
	good: 'text-emerald-600 dark:text-emerald-400',
};

const TIER_BADGE: Record<PsiScoreTier, string> = {
	poor: 'border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:!border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
	'needs-improvement':
		'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:!border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
	good: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:!border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
};

/**
 * Track 3 · Score Hero Card — same visual hierarchy as `AuditScoreHeader` (Track 1)
 * and `GeoScoreOverviewHeader` (Track 2). The displayed score is always
 * `scores.scoreBreakdown.coreWebVitals` — the single source of truth also fed into
 * the composite score formula and the top Track 3 summary card — so this hero can
 * never drift from either. `mobilePerf`/`desktopPerf` are only read here to label
 * *where* that SSOT number came from (50:50 mobile+desktop average once both have
 * landed — see `resolveTrack3PerformanceScore`).
 */
function CwvScoreHeroCard({
	pageSpeedDesktop,
	pageSpeedMobile,
	loading,
}: {
	pageSpeedDesktop?: PageSpeedSnapshot | null;
	pageSpeedMobile?: PageSpeedSnapshot | null;
	loading: boolean;
}) {
	const t = useTranslations('audit.cwvHero');
	const { scores } = useAuditData();
	const breakdown = scores?.scoreBreakdown;
	const track3Score = breakdown?.coreWebVitals ?? 0;
	const track3Weight = breakdown?.weights?.coreWebVitals ?? 0.2;

	const mobilePerf = pageSpeedMobile?.categories.find((c) => c.id === 'performance')?.score ?? null;
	const desktopPerf = pageSpeedDesktop?.categories.find((c) => c.id === 'performance')?.score ?? null;
	const heroScore = track3Score;
	// Counts up from the previous (fallback-estimate) value the instant the real Track 3
	// read lands and `loading` flips false — a no-op while still loading.
	const animatedHeroScore = useCountUp(heroScore);
	const sourceLabel =
		mobilePerf != null && desktopPerf != null
			? t('sourceAverage')
			: mobilePerf != null
				? t('sourceMobile')
				: desktopPerf != null
					? t('sourceDesktop')
					: t('sourceFallback');
	const tier = scoreTier(heroScore);
	const tierLabel =
		tier === 'good' ? t('gradeGood') : tier === 'needs-improvement' ? t('gradeNeedsImprovement') : t('gradePoor');

	const weightPct = Math.round(track3Weight * 100);
	const contribution = (track3Score * track3Weight).toFixed(1);
	// Wait for both strategies to settle before revealing — otherwise a single-strategy
	// provisional score would flash before the 50:50 average lands, drifting from the
	// composite/top-card numbers that hold off the same way (see `AuditReportDocument`).
	const showSkeleton = loading;

	return (
		<div
			id="cwv-score-summary"
			className="pdf-page-item audit-report-section scroll-mt-24 relative w-full max-w-full box-border overflow-visible flex flex-col gap-5 rounded-2xl border border-emerald-200 dark:border-emerald-400/20 bg-gradient-to-br from-emerald-50 via-teal-50 to-white dark:from-[#06231C] dark:via-[#062A26] dark:to-[#04150F] p-6"
		>
			<div
				className="pointer-events-none absolute inset-0 opacity-40 print:hidden"
				style={{
					background:
						'radial-gradient(circle at 15% 20%, rgba(16,185,129,0.2), transparent 45%), radial-gradient(circle at 85% 15%, rgba(45,212,191,0.2), transparent 45%)',
				}}
			/>
			<div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex flex-col gap-1">
					<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300/80">
						{t('badge')}
					</p>
					<div className="flex items-center gap-2">
						<span className="text-xl" aria-hidden>
							⚡
						</span>
						<h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('title')}</h3>
					</div>
					{showSkeleton ? (
						<CwvHeroSkeleton loadingLabel={t('loadingLabel')} />
					) : (
						<>
							<div className="mt-1 flex flex-wrap items-baseline gap-2">
								<span className={`text-5xl font-extrabold tabular-nums ${TIER_TEXT[tier]}`}>{animatedHeroScore}</span>
								<span className="text-lg text-slate-600 dark:text-slate-400">{t('heroScoreSuffix')}</span>
							</div>
							<p className="text-xs text-slate-500 dark:text-zinc-400">{sourceLabel}</p>
							<div className="mt-2 flex flex-wrap items-center gap-3">
								<span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${TIER_BADGE[tier]}`}>
									{tierLabel}
								</span>
							</div>
							<p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
								{t('contributionCaption', { weight: weightPct, contribution })}
							</p>
						</>
					)}
				</div>

				{!showSkeleton ? (
					<div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
						<svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
							<circle cx="60" cy="60" r="52" fill="none" className="stroke-slate-200 dark:stroke-white/10" strokeWidth="12" />
							<circle
								cx="60"
								cy="60"
								r="52"
								fill="none"
								strokeWidth="12"
								strokeLinecap="round"
								className={TIER_RING[tier]}
								stroke="currentColor"
								strokeDasharray={`${(animatedHeroScore / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
							/>
						</svg>
						<p className="absolute text-xl font-bold text-slate-900 dark:text-white">{animatedHeroScore}%</p>
					</div>
				) : null}
			</div>
		</div>
	);
}

function CwvHeroSkeleton({ loadingLabel }: { loadingLabel: string }) {
	return (
		<div className="mt-2 flex flex-col gap-2" role="status" aria-live="polite">
			<div className="h-12 w-32 animate-pulse rounded-xl bg-emerald-500/15" />
			<div className="h-3 w-40 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
			<span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
				<Loader2 className="h-3 w-3 animate-spin" aria-hidden />
				{loadingLabel}
			</span>
		</div>
	);
}

/**
 * Track 3 tab — Core Web Vitals & 웹 성능 실측.
 * Score Hero Card (representative score + composite contribution) followed by the
 * full PC/모바일 4대 지표, Core Web Vitals 정밀 진단, 리소스 진단, 해결 가이드
 * (`PageSpeedReport` → `PageSpeedPrecisionPanel`), previously nested inside Track 1.
 */
export function Tab3CoreWebVitalsSection({
	pageSpeed,
	pageSpeedDesktop,
	pageSpeedMobile,
	pageSpeedLoading,
	pageSpeedError,
	psiStrategy,
	onPsiStrategyChange,
	pageSpeedRefreshing = false,
	onRefreshPageSpeed,
	targetUrl,
}: Tab3CoreWebVitalsSectionProps) {
	return (
		<>
			<CwvScoreHeroCard pageSpeedDesktop={pageSpeedDesktop} pageSpeedMobile={pageSpeedMobile} loading={pageSpeedLoading} />
			<PageSpeedReport
				snapshot={pageSpeed}
				desktopData={pageSpeedDesktop}
				mobileData={pageSpeedMobile}
				loading={pageSpeedLoading}
				error={pageSpeedError}
				strategy={psiStrategy}
				onStrategyChange={onPsiStrategyChange}
				refreshing={pageSpeedRefreshing}
				onRefresh={onRefreshPageSpeed}
				targetUrl={targetUrl}
			/>
		</>
	);
}
