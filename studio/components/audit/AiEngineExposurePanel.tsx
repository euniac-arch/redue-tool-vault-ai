'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { ENGINE_CHAT_THEME, ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import { EngineInsightBox } from '@/components/audit/EngineInsightBox';
import { AIRankingPanel } from '@/components/geo/AIRankingPanel';
import { useAuditData } from '@/components/audit/AuditDataContext';
import { detectEnginePlatformSignals } from '@/lib/audit/engine-analysis';
import { getEngineInsight, type EngineInsightSignals } from '@/lib/audit/engine-insight';
import { resolveLiveCheckQuery, sanitizeEvidenceSnippet } from '@/lib/audit/live-check-score';
import {
	getRatingMeta,
	hasMeasuredVisibility,
	type AiEngineVisibilityMetrics,
	type EngineAnalysisResult,
	type EngineCauseFactor,
} from '@/lib/audit/geo-score';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';
import type { AuditReport } from '@/lib/site-auditor';
import { isProxyIndexEngine, liveGroundingOrderIndex, type AIEngineId } from '@/types/geo-diagnostic';
import type { GroundingStatusColor, GroundingTier } from '@/types/live-engine-check';
import type { LiveCheckEngineId, LiveCheckResponse, LiveEngineCheckResult } from '@/types/live-engine-check';

type ExposurePanelTab = 'exposure' | 'domestic';
type LiveCheckState = 'idle' | 'loading' | 'completed' | 'error';

interface AiEngineExposurePanelProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	/** Registry snapshot — reserved for industry-native cause labels. */
	industryConfig?: IndustryConfig | null;
}

const BADGE_TONE = {
	success: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-400/40',
	warning: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400/40',
	danger: 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 ring-1 ring-rose-400/40',
} as const;

const FACTOR_ICON = {
	high: '🔴',
	medium: '🟠',
	low: '🟡',
} as const;

function isEngineId(value: string): value is AIEngineId {
	return value in ENGINE_GLYPH;
}

function hostnameFromUrl(url: string): string {
	try {
		return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./i, '');
	} catch {
		return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || url;
	}
}

function StarRow({ filled, rating }: { filled: number; rating: number }) {
	return (
		<span className="inline-flex items-center gap-1.5" aria-label={`${rating.toFixed(1)}/5.0`}>
			<span className="tracking-tight text-[#D4AF37]">
				{'★'.repeat(filled)}
				<span className="text-slate-300 dark:text-white/25">{'☆'.repeat(5 - filled)}</span>
			</span>
			<span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
				({rating.toFixed(1)}/5.0)
			</span>
		</span>
	);
}

function ReasonIcon({ tone }: { tone: 'success' | 'warning' | 'danger' }) {
	const className = 'mt-0.5 h-3.5 w-3.5 shrink-0';
	if (tone === 'success') {
		return <CheckCircle2 className={`${className} text-emerald-600 dark:text-emerald-400`} aria-hidden />;
	}
	if (tone === 'warning') {
		return <AlertTriangle className={`${className} text-amber-600 dark:text-amber-400`} aria-hidden />;
	}
	return <AlertCircle className={`${className} text-rose-600 dark:text-rose-400`} aria-hidden />;
}

function ReadinessInfoTooltip({ label, text }: { label: string; text: string }) {
	return (
		<span className="group relative z-50 inline-flex shrink-0 align-middle print:hidden">
			<button
				type="button"
				className="inline-flex cursor-pointer items-center justify-center text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 dark:text-zinc-400 dark:hover:text-zinc-200"
				aria-label={label}
			>
				<Info className="h-3.5 w-3.5" aria-hidden />
			</button>
			<span
				role="tooltip"
				className="pointer-events-none invisible absolute bottom-full right-0 z-50 mb-2 w-80 max-w-[min(20rem,calc(100vw-2.5rem))] rounded-lg border border-slate-200 bg-white p-2.5 text-left text-[11px] leading-relaxed whitespace-normal break-keep text-slate-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
			>
				{text}
			</span>
		</span>
	);
}

function CauseFactorRow({ factor }: { factor: EngineCauseFactor }) {
	return (
		<li className="flex items-start gap-2">
			<span className="mt-0.5 shrink-0 text-[11px] leading-none" aria-hidden>
				{FACTOR_ICON[factor.severity]}
			</span>
			<div className="min-w-0">
				<p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">{factor.title}</p>
				<p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{factor.detail}</p>
			</div>
		</li>
	);
}

function formatVisibilityValue(value: number, kind: 'count' | 'percent'): string {
	if (kind === 'percent') return `${Math.round(value)}%`;
	return String(Math.round(value));
}

function VisibilityMetricsBlock({ metrics }: { metrics: AiEngineVisibilityMetrics }) {
	const t = useTranslations('audit.aiEngines');
	const rows: { label: string; value: string }[] = [];
	if (metrics.queryTestCount != null) {
		rows.push({ label: t('visibilityQueryTests'), value: formatVisibilityValue(metrics.queryTestCount, 'count') });
	}
	if (metrics.answerExposureCount != null) {
		rows.push({ label: t('visibilityAnswerHits'), value: formatVisibilityValue(metrics.answerExposureCount, 'count') });
	}
	if (metrics.visibilityRate != null) {
		rows.push({ label: t('visibilityRate'), value: formatVisibilityValue(metrics.visibilityRate, 'percent') });
	}
	if (metrics.officialUrlCitationCount != null) {
		rows.push({
			label: t('visibilityOfficialCitations'),
			value: formatVisibilityValue(metrics.officialUrlCitationCount, 'count'),
		});
	}
	if (metrics.citationRate != null) {
		rows.push({ label: t('visibilityCitationRate'), value: formatVisibilityValue(metrics.citationRate, 'percent') });
	}
	if (metrics.entityAccuracy != null) {
		rows.push({ label: t('visibilityEntityAccuracy'), value: formatVisibilityValue(metrics.entityAccuracy, 'percent') });
	}
	if (rows.length === 0) return null;

	return (
		<div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-white/[0.06]">
			<p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
				{t('visibilityTitle')}
			</p>
			<dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
				{rows.map((row) => (
					<div key={row.label} className="flex items-baseline justify-between gap-2">
						<dt className="text-[11px] text-slate-500 dark:text-slate-400">{row.label}</dt>
						<dd className="text-[11px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">{row.value}</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

function AnimatedScore({ value }: { value: number }) {
	const [shown, setShown] = useState(value);
	const fromRef = useRef(value);

	useEffect(() => {
		const reduceMotion =
			typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion) {
			fromRef.current = value;
			setShown(value);
			return;
		}
		const start = fromRef.current;
		const end = value;
		const startedAt = performance.now();
		const duration = 700;
		let frame = 0;
		const tick = (now: number) => {
			const progress = Math.min(1, (now - startedAt) / duration);
			const eased = 1 - (1 - progress) ** 3;
			setShown(Math.round(start + (end - start) * eased));
			if (progress < 1) {
				frame = requestAnimationFrame(tick);
			} else {
				fromRef.current = end;
			}
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [value]);

	return <>{shown}</>;
}

function MeasurementBadge({
	liveAttempted,
	isProxy,
	grounded,
	failed,
}: {
	liveAttempted: boolean;
	isProxy: boolean;
	grounded: boolean;
	failed: boolean;
}) {
	const t = useTranslations('audit.aiEngines');

	if (!liveAttempted) {
		return (
			<div className="mt-2">
				<span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-extrabold text-zinc-400 ring-1 ring-zinc-400/30">
					<span aria-hidden>⚪</span>
					{t('ruleDiagnosisBadge')}
				</span>
			</div>
		);
	}

	if (isProxy) {
		return (
			<div className="mt-2">
				<span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-extrabold text-sky-300 ring-1 ring-sky-400/30">
					<span aria-hidden>🔵</span>
					{t('approxBadge')}
				</span>
			</div>
		);
	}

	if (grounded) {
		return (
			<div className="mt-2">
				<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 ring-1 ring-emerald-400/30">
					<span aria-hidden>🟢</span>
					{t('liveGroundedBadge')}
				</span>
			</div>
		);
	}

	if (failed) {
		return (
			<div className="group relative mt-2 inline-flex">
				<span
					className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 ring-1 ring-amber-400/30"
					title={t('liveFailTooltip')}
				>
					<span aria-hidden>⚠️</span>
					{t('liveFailBadge')}
				</span>
				<span
					role="tooltip"
					className="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-slate-200 bg-white p-2 text-left text-[11px] leading-relaxed text-slate-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
				>
					{t('liveFailTooltip')}
				</span>
			</div>
		);
	}

	return (
		<div className="mt-2">
			<span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-extrabold text-zinc-400 ring-1 ring-zinc-400/30">
				<span aria-hidden>⚪</span>
				{t('ruleDiagnosisBadge')}
			</span>
		</div>
	);
}

const TIER_SCORE_CLASS: Record<GroundingStatusColor, string> = {
	green: 'text-emerald-500 dark:text-emerald-400',
	blue: 'text-sky-500 dark:text-sky-400',
	yellow: 'text-amber-500 dark:text-amber-400',
	red: 'text-rose-500 dark:text-rose-400',
};

const TIER_BADGE_CLASS: Record<GroundingStatusColor, string> = {
	green: 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
	blue: 'border border-sky-500/30 bg-sky-500/20 text-sky-700 dark:text-sky-300',
	yellow: 'border border-amber-500/30 bg-amber-500/20 text-amber-700 dark:text-amber-300',
	red: 'border border-rose-500/30 bg-rose-500/20 text-rose-700 dark:text-rose-300',
};

function resolveLiveTier(live: LiveEngineCheckResult): {
	tier: GroundingTier;
	color: GroundingStatusColor;
} {
	if (live.tier === 'STRONG' || live.tier === 'NEUTRAL' || live.tier === 'WEAK' || live.tier === 'NOT_FOUND') {
		return { tier: live.tier, color: live.statusColor || (live.tier === 'STRONG' ? 'green' : live.tier === 'NEUTRAL' ? 'blue' : live.tier === 'WEAK' ? 'yellow' : 'red') };
	}
	return live.isCited ? { tier: 'NEUTRAL', color: 'blue' } : { tier: 'NOT_FOUND', color: 'red' };
}

function liveConfirmKey(tier: GroundingTier): 'liveTierStrongConfirm' | 'liveTierNeutralConfirm' | 'liveTierWeakConfirm' | 'liveTierNotFoundConfirm' {
	if (tier === 'STRONG') return 'liveTierStrongConfirm';
	if (tier === 'NEUTRAL') return 'liveTierNeutralConfirm';
	if (tier === 'WEAK') return 'liveTierWeakConfirm';
	return 'liveTierNotFoundConfirm';
}

function liveBadgeKey(tier: GroundingTier): 'liveTierStrongBadge' | 'liveTierNeutralBadge' | 'liveTierWeakBadge' | 'liveTierNotFoundBadge' {
	if (tier === 'STRONG') return 'liveTierStrongBadge';
	if (tier === 'NEUTRAL') return 'liveTierNeutralBadge';
	if (tier === 'WEAK') return 'liveTierWeakBadge';
	return 'liveTierNotFoundBadge';
}

function EngineScoreBlock({
	readinessScore,
	live,
	showDual,
	lang,
}: {
	readinessScore: number;
	live?: LiveEngineCheckResult;
	showDual: boolean;
	lang: 'ko' | 'en';
}) {
	const t = useTranslations('audit.aiEngines');
	const meta = getRatingMeta(readinessScore, lang);
	const { tier, color } = live ? resolveLiveTier(live) : { tier: 'NOT_FOUND' as const, color: 'red' as const };

	return (
		<div className="my-3 rounded-lg border border-slate-200 bg-slate-100/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
			{!showDual || !live ? (
				<div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
					<div className="flex items-baseline gap-1">
						<span className="text-2xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">
							<AnimatedScore value={readinessScore} />
						</span>
						<span className="text-xs text-slate-400 dark:text-zinc-500">{t('scoreMax')}</span>
					</div>
					<StarRow filled={meta.filledStars} rating={meta.ratingOutOf5} />
				</div>
			) : (
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-3">
						<div className="flex flex-col">
							<span className="text-[10px] font-medium text-slate-500 dark:text-zinc-500">
								{t('technicalReadinessLabel')}
							</span>
							<span className="text-sm font-bold tabular-nums text-slate-500 dark:text-zinc-400">
								{readinessScore}
								{t('scoreUnit')}
							</span>
						</div>

						<span className="text-xs text-slate-400 dark:text-zinc-600" aria-hidden>
							➔
						</span>

						<div className="flex flex-col items-end">
							<span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
								{t('liveResultLabel')}
							</span>
							<div className="flex items-baseline gap-1">
								<span className={`text-2xl font-black tabular-nums ${TIER_SCORE_CLASS[color]}`}>
									<AnimatedScore value={live.liveScore} />
								</span>
								<span className="text-xs text-slate-400 dark:text-zinc-500">{t('scoreMax')}</span>
							</div>
							<p className={`mt-0.5 text-[11px] font-bold ${TIER_SCORE_CLASS[color]}`}>
								{t(liveConfirmKey(tier), { score: live.liveScore })}
							</p>
						</div>
					</div>

					<div className="flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2 text-[11px] dark:border-zinc-800/80">
						<span className="text-slate-500 dark:text-zinc-400">{t('liveVerdictLabel')}</span>
						<span className={`rounded px-2 py-0.5 text-[10px] font-bold ${TIER_BADGE_CLASS[color]}`}>
							{t(liveBadgeKey(tier))}
						</span>
					</div>

					<EvidenceSnippetBox live={live} />
				</div>
			)}
		</div>
	);
}

function EvidenceSnippetBox({ live }: { live: LiveEngineCheckResult }) {
	const t = useTranslations('audit.aiEngines');
	const { tier, color } = resolveLiveTier(live);
	const cited = tier !== 'NOT_FOUND';
	return (
		<div className="mt-2 rounded-lg border border-indigo-500/30 bg-white/80 p-3 text-xs dark:bg-zinc-950/80">
			<div className="mb-1 flex items-center justify-between gap-2">
				<span className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-300">
					<span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
					{t('evidenceTitle')}
				</span>
				<span className={`rounded px-2 py-0.5 text-[10px] font-bold ${TIER_BADGE_CLASS[color]}`}>
					{t(liveBadgeKey(tier))}
				</span>
			</div>
			<p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-zinc-300">
				&ldquo;{sanitizeEvidenceSnippet(live.evidenceSnippet, cited)}&rdquo;
			</p>
			{live.citationUrl ? (
				<p className="mt-1.5 truncate text-[10px] text-indigo-600/80 dark:text-indigo-300/80">{live.citationUrl}</p>
			) : null}
			{tier === 'WEAK' && live.weaknessReasons && live.weaknessReasons.length > 0 ? (
				<div className="mt-2 rounded-md bg-amber-50/80 px-2 py-1.5 dark:bg-amber-500/10">
					<p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{t('weaknessTitle')}</p>
					<ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-amber-800 dark:text-amber-200">
						{live.weaknessReasons.map((reason) => (
							<li key={reason}>{reason}</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}

function EngineCard({
	engine,
	lang,
	live,
	liveAttempted,
	insightSignals,
}: {
	engine: EngineAnalysisResult & { engineLabel?: string };
	lang: 'ko' | 'en';
	live?: LiveEngineCheckResult;
	liveAttempted: boolean;
	insightSignals: EngineInsightSignals;
}) {
	const t = useTranslations('audit.aiEngines');
	const isProxy = isProxyIndexEngine(engine.engine);
	const failed = Boolean(live && (live.fallbackToRuleScore || !live.isLiveGrounded));
	const grounded = Boolean(!isProxy && live?.isLiveGrounded && !live.fallbackToRuleScore);
	const readinessScore = engine.readinessScore ?? engine.score;
	const meta = getRatingMeta(readinessScore, lang);
	const engineId = isEngineId(engine.engine) ? engine.engine : null;
	const Glyph = engineId ? ENGINE_GLYPH[engineId] : null;
	const theme = engineId ? ENGINE_CHAT_THEME[engineId] : null;
	const title = engine.engineLabel || engine.engineName;
	const factors = engine.causeFactors ?? [];
	const visibility = engine.visibility ?? null;
	const showDual = grounded;
	const analysis =
		grounded && live
			? getEngineInsight(
					engine.engine,
					Boolean(live.isCited),
					[live.citationUrl, ...(live.citedSources ?? [])].filter(
						(src): src is string => typeof src === 'string' && src.length > 0,
					),
					insightSignals,
					{ liveScore: live.liveScore, lang },
				)
			: null;

	return (
		<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.08] dark:bg-black/20">
			<div className="flex items-center gap-2">
				{Glyph && theme ? (
					<span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${theme.logoWrap}`}>
						<Glyph className="h-4 w-4" />
					</span>
				) : null}
				<p className="min-w-0 text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
			</div>

			<MeasurementBadge
				liveAttempted={liveAttempted}
				isProxy={isProxy}
				grounded={grounded}
				failed={failed}
			/>

			<EngineScoreBlock
				readinessScore={readinessScore}
				live={live}
				showDual={showDual}
				lang={lang}
			/>

			{!showDual ? (
				<div>
					<span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold ${BADGE_TONE[meta.tone]}`}>
						{meta.statusLabel}
					</span>
				</div>
			) : null}

			<div className="mt-3 border-t border-slate-200/80 pt-3 dark:border-white/[0.06]">
				<p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
					{t('mainCauses')}
				</p>
				{factors.length > 0 ? (
					<ul className="mt-3 flex flex-col gap-2.5">
						{factors.map((factor) => (
							<CauseFactorRow key={factor.id} factor={factor} />
						))}
					</ul>
				) : (
					<p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
						<ReasonIcon tone={meta.tone} />
						<span>{engine.analysisReason}</span>
					</p>
				)}
			</div>

			{hasMeasuredVisibility(visibility) ? <VisibilityMetricsBlock metrics={visibility!} /> : null}
			{analysis ? <EngineInsightBox analysis={analysis} /> : null}
		</div>
	);
}

function EngineGroup({
	title,
	hint,
	dotClass,
	engines,
	liveByEngine,
	liveAttempted,
	lang,
	insightSignals,
}: {
	title: string;
	hint: string;
	dotClass: string;
	engines: EngineAnalysisResult[];
	liveByEngine: Partial<Record<LiveCheckEngineId, LiveEngineCheckResult>>;
	liveAttempted: boolean;
	lang: 'ko' | 'en';
	insightSignals: EngineInsightSignals;
}) {
	if (engines.length === 0) return null;
	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
					<span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
					{title}
				</h4>
				<span className="text-[11px] text-zinc-500">{hint}</span>
			</div>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				{engines.map((engine) => (
					<EngineCard
						key={engine.engine}
						engine={engine}
						lang={lang}
						live={liveByEngine[engine.engine]}
						liveAttempted={liveAttempted}
						insightSignals={insightSignals}
					/>
				))}
			</div>
		</div>
	);
}

function EngineDiagnosticGrid({
	engineResults,
	liveByEngine,
	liveAttempted,
	insightSignals,
}: {
	engineResults: EngineAnalysisResult[];
	liveByEngine: Partial<Record<LiveCheckEngineId, LiveEngineCheckResult>>;
	liveAttempted: boolean;
	insightSignals: EngineInsightSignals;
}) {
	const t = useTranslations('audit.aiEngines');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const liveEngines = engineResults
		.filter((engine) => !isProxyIndexEngine(engine.engine))
		.sort((a, b) => liveGroundingOrderIndex(a.engine) - liveGroundingOrderIndex(b.engine));
	const proxyEngines = engineResults.filter((engine) => isProxyIndexEngine(engine.engine));

	return (
		<div className="space-y-6">
			<EngineGroup
				title={t('liveGroupTitle')}
				hint={t('liveGroupHint')}
				dotClass="bg-emerald-400"
				engines={liveEngines}
				liveByEngine={liveByEngine}
				liveAttempted={liveAttempted}
				lang={lang}
				insightSignals={insightSignals}
			/>
			<EngineGroup
				title={t('proxyGroupTitle')}
				hint={t('proxyGroupHint')}
				dotClass="bg-blue-400"
				engines={proxyEngines}
				liveByEngine={liveByEngine}
				liveAttempted={liveAttempted}
				lang={lang}
				insightSignals={insightSignals}
			/>
		</div>
	);
}

export function AiEngineExposurePanel({
	report,
	reportData: _reportData,
	industryConfig: _industryConfig,
}: AiEngineExposurePanelProps) {
	const t = useTranslations('audit.aiEngines');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const [selectedTab, setSelectedTab] = useState<ExposurePanelTab>('exposure');
	const [liveCheckState, setLiveCheckState] = useState<LiveCheckState>('idle');
	const [liveError, setLiveError] = useState<string | null>(null);
	const [liveByEngine, setLiveByEngine] = useState<Partial<Record<LiveCheckEngineId, LiveEngineCheckResult>>>({});
	const checkingRef = useRef(false);
	const { snapshot } = useAuditData();
	const engineResults: EngineAnalysisResult[] = snapshot.engines;
	const liveAttempted = Object.keys(liveByEngine).length > 0;
	const isChecking = liveCheckState === 'loading';
	const isLiveCompleted = liveCheckState === 'completed';
	const showRetryChrome = isLiveCompleted || (liveCheckState === 'error' && liveAttempted);

	const siteUrl = (report.finalUrl || report.url || '').trim();
	const siteName = (report.siteMeta?.brandName || hostnameFromUrl(siteUrl)).trim();
	const location = (report.siteMeta?.location || report.siteMeta?.broadLocation || '').trim();
	const category = (report.siteMeta?.category || report.siteMeta?.primaryKeyword || '').trim();
	const targetQuery = useMemo(
		() =>
			resolveLiveCheckQuery({
				targetKeyword: report.siteMeta?.primaryKeyword,
				primaryQuery: report.detectedKeywords?.[0] || report.siteMeta?.detectedKeywords?.[0],
				keywords: report.detectedKeywords || report.siteMeta?.detectedKeywords,
				category: report.siteMeta?.category,
				lang,
			}),
		[report.detectedKeywords, report.siteMeta, lang],
	);

	const insightSignals = useMemo((): EngineInsightSignals => {
		const platform = detectEnginePlatformSignals({
			schemaTypes: report.metrics?.schemaTypes ?? report.siteMeta?.schemaEntityTypes,
			jsonLdCorpus: (report.metrics?.jsonLdSnippets ?? []).join('\n'),
			extraCorpus: [...(report.collectedUrls ?? []), report.footerText ?? ''].join('\n'),
		});
		const schemaTypes = report.metrics?.schemaTypes ?? report.siteMeta?.schemaEntityTypes ?? [];
		const jsonLdCount = report.metrics?.jsonLdBlockCount ?? 0;
		return {
			isHttps: snapshot.isHttps,
			bingPlacesRegistered:
				snapshot.reputation.digitalFootprint.bingPlacesRegistered || platform.bingPlacesLinked,
			googleMapsLinked: platform.googleMapsLinked,
			hasLlmsTxt: Boolean(report.metrics?.hasLlmsTxt),
			hasJsonLd: jsonLdCount > 0 || schemaTypes.length > 0 || platform.hasOrganization || platform.hasLocalBusiness,
			hasFaq: platform.hasFaq || platform.hasHowTo,
			hasLocalBusiness: platform.hasLocalBusiness,
			siteUrl,
			recommendedSchemaType: snapshot.reputation.brandTrust.recommendedSchemaType,
		};
	}, [report, snapshot, siteUrl]);

	const selectTab = useCallback((tab: ExposurePanelTab) => {
		setSelectedTab((prev) => (prev === tab ? prev : tab));
	}, []);

	const handleLiveCheck = useCallback(async () => {
		if (checkingRef.current || !siteUrl || !siteName) return;
		checkingRef.current = true;
		setLiveCheckState('loading');
		setLiveError(null);
		try {
			const ruleScores = Object.fromEntries(engineResults.map((engine) => [engine.engine, engine.score]));
			const res = await fetch('/api/audit/live-check', {
				method: 'POST',
				cache: 'no-store',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					siteUrl,
					siteName,
					targetQuery,
					location,
					category,
					ruleScores,
				}),
			});
			const data = (await res.json()) as LiveCheckResponse;
			if (!res.ok || !data.success) {
				setLiveError(data.error || t('liveCheckError'));
				setLiveCheckState('error');
				return;
			}
			const next: Partial<Record<LiveCheckEngineId, LiveEngineCheckResult>> = {};
			for (const result of data.results || []) {
				next[result.engine] = result;
			}
			setLiveByEngine(next);
			setLiveCheckState('completed');
		} catch {
			setLiveError(t('liveCheckError'));
			setLiveCheckState('error');
		} finally {
			checkingRef.current = false;
		}
	}, [category, engineResults, location, siteName, siteUrl, t, targetQuery]);

	const tabClass = (tab: ExposurePanelTab) =>
		`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-extrabold transition ${
			selectedTab === tab
				? 'bg-slate-900 text-white shadow-sm dark:bg-white/15 dark:text-white'
				: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white'
		}`;

	return (
		<section
			id="ai-engine-status"
			className="pdf-page-item audit-report-section scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="shrink-0">
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('subtitle')}</p>
					<h2 className="mt-1 whitespace-nowrap break-keep text-lg font-extrabold text-slate-900 dark:text-white">
						{t('title')}
					</h2>
				</div>
				<div className="print:hidden flex flex-wrap items-center gap-2 sm:justify-end">
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => void handleLiveCheck()}
							disabled={isChecking || !siteUrl || !siteName}
							aria-busy={isChecking}
							className={
								isChecking
									? 'flex cursor-not-allowed items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400'
									: showRetryChrome
										? 'flex items-center gap-2 rounded-lg border border-indigo-300 bg-white px-4 py-2 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-50 dark:border-indigo-400/50 dark:bg-transparent dark:text-indigo-300 dark:hover:bg-indigo-500/10'
										: 'flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500'
							}
						>
							{isChecking ? (
								<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
							) : showRetryChrome ? (
								<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
							) : (
								<Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
							)}
							{isChecking
								? t('liveCheckLoading')
								: showRetryChrome
									? t('liveCheckRetry')
									: t('liveCheckCta')}
						</button>
						{isLiveCompleted ? (
							<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
								{t('liveCheckCompletedHint')}
							</span>
						) : null}
					</div>
					<div
						className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-white/15 dark:bg-white/[0.04]"
						role="tablist"
						aria-label={t('title')}
					>
						<button
							type="button"
							role="tab"
							aria-selected={selectedTab === 'exposure'}
							onClick={() => selectTab('exposure')}
							className={tabClass('exposure')}
						>
							{t('exposureTab')}
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={selectedTab === 'domestic'}
							onClick={() => selectTab('domestic')}
							className={tabClass('domestic')}
						>
							<span aria-hidden>📊</span>
							{t('rankButton')}
						</button>
					</div>
				</div>
			</div>

			{liveError ? (
				<p className="print:hidden text-[11px] font-semibold text-rose-500 dark:text-rose-300">{liveError}</p>
			) : null}

			<p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
				<span className="min-w-0 flex-1 break-keep">{t('scoreMeaning')}</span>
				<ReadinessInfoTooltip label={t('scoreMeaningAria')} text={t('scoreMeaningTooltip')} />
			</p>

			{selectedTab === 'domestic' ? (
				<div key="domestic" className="print:hidden" role="tabpanel">
					<AIRankingPanel />
				</div>
			) : null}

			<div
				className={selectedTab === 'exposure' ? '' : 'hidden print:block'}
				role={selectedTab === 'exposure' ? 'tabpanel' : undefined}
			>
				<EngineDiagnosticGrid
					engineResults={engineResults}
					liveByEngine={liveByEngine}
					liveAttempted={liveAttempted}
					insightSignals={insightSignals}
				/>
			</div>

			{liveAttempted ? (
				<p
					className={`text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 ${
						selectedTab === 'exposure' ? '' : 'hidden print:block'
					}`}
				>
					{t('liveCheckFooterNotice')}
				</p>
			) : null}
		</section>
	);
}
