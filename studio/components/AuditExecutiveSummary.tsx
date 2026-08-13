'use client';

import { useLocale, useTranslations } from 'next-intl';
import { DualScoreSummaryHeader } from '@/components/audit/DualScoreSummaryHeader';
import { TargetEntityBanner } from '@/components/audit/TargetEntityBanner';
import { buildExecStorytelling, type ExecUrgencyLevel } from '@/lib/audit/exec-insight';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { resolveExternalReputation } from '@/lib/audit/geo-score';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import type { AuditFinding, AuditReport } from '@/lib/site-auditor';

/** Groups the flat checklist into the four business-risk narratives shown as cards — each maps 1:1 to an `execRisks.themes.*` loss message. */
type RiskThemeId = 'ai' | 'ctr' | 'eeat' | 'tech';

const RISK_THEMES: { id: RiskThemeId; checkIds: readonly string[] }[] = [
	{ id: 'ai', checkIds: ['jsonld-present', 'faq-howto-schema', 'ai-bots-allowed', 'crawlable-text'] },
	{ id: 'ctr', checkIds: ['title', 'meta-description', 'og-tags', 'canonical', 'single-h1', 'heading-skip'] },
	{ id: 'eeat', checkIds: ['organization', 'article-fields', 'news-article', 'website-schema', 'person-eeat', 'eeat-author'] },
	{ id: 'tech', checkIds: ['html-lang', 'image-alt', 'heading-structure', 'response-time', 'page-weight', 'render-blocking'] },
];

interface RiskCard {
	themeId: RiskThemeId;
	severity: 'critical' | 'warning';
	cause: string;
	extraCount: number;
}

/** Ranks failing/warning checks by real severity, sorted worst-first, capped at 4 cards. */
function buildRiskCards(findings: AuditFinding[]): RiskCard[] {
	const cards: RiskCard[] = [];
	for (const theme of RISK_THEMES) {
		const matches = findings.filter((f) => f.checkId && theme.checkIds.includes(f.checkId));
		if (matches.length === 0) continue;
		cards.push({
			themeId: theme.id,
			severity: matches.some((f) => f.severity === 'critical') ? 'critical' : 'warning',
			cause: matches[0].title,
			extraCount: matches.length - 1,
		});
	}
	return cards
		.sort((a, b) => {
			if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
			return b.extraCount - a.extraCount;
		})
		.slice(0, 4);
}

const RISK_BADGE_TIERS = [
	{ key: 'critical', icon: '🔴', border: 'border-rose-500/40', bg: 'bg-rose-500/15', text: 'text-rose-300' },
	{ key: 'major', icon: '🟠', border: 'border-orange-500/40', bg: 'bg-orange-500/15', text: 'text-orange-300' },
	{ key: 'caution', icon: '🟡', border: 'border-amber-400/40', bg: 'bg-amber-400/15', text: 'text-amber-300' },
] as const;

function riskBadgeForIndex(index: number) {
	return RISK_BADGE_TIERS[Math.min(index, RISK_BADGE_TIERS.length - 1)];
}

const URGENCY_STYLES: Record<ExecUrgencyLevel, { border: string; bg: string; text: string }> = {
	urgent: { border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-300' },
	priority: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-300' },
	stable: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
};

type ExposureTier = 'danger' | 'partial' | 'top';

const EXPOSURE_TIER_STYLES: Record<ExposureTier, { icon: string; text: string; bar: string; border: string; bg: string }> = {
	danger: { icon: '🔴', text: 'text-rose-300', bar: 'bg-rose-500', border: 'border-white/10', bg: 'bg-black/25' },
	partial: { icon: '🟡', text: 'text-amber-300', bar: 'bg-amber-400', border: 'border-white/10', bg: 'bg-black/25' },
	top: { icon: '🟢', text: 'text-emerald-300', bar: 'bg-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
};

function exposureTier(score: number, minThreshold: number, topThreshold: number): ExposureTier {
	if (score >= topThreshold) return 'top';
	if (score >= minThreshold) return 'partial';
	return 'danger';
}

function topPercentile(score: number): number {
	return Math.min(99, Math.max(1, 100 - Math.round(score)));
}

interface AuditExecutiveSummaryProps {
	report: AuditReport;
	reportData?: GeoNarrativeReport | null;
	/** Live PageSpeed snapshot — viewport audit cross-validates mobile readability. */
	pageSpeed?: PageSpeedSnapshot | null;
}

export function AuditExecutiveSummary({
	report,
	reportData,
	pageSpeed,
}: AuditExecutiveSummaryProps) {
	const t = useTranslations('audit.b2b');
	const tRisk = useTranslations('audit.execRisks');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';

	const { overview } = resolveExternalReputation(report, reportData, lang);
	const geoScore = Math.round(overview.score);
	/** Current on-page SEO·GEO schema precision on a 0–100 scale. */
	const seoScore =
		report.maxScore > 0 ? Math.min(100, Math.max(0, Math.round((report.score / report.maxScore) * 100))) : 0;

	const story = buildExecStorytelling({ geoScore, seoScore });
	const { currentScore, targetScore, potentialGain, bottleneckType, urgencyLevel } = story;
	const urgencyStyle = URGENCY_STYLES[urgencyLevel];
	const targetAchieved = potentialGain === 0;
	const schemaDefectCount = (report.findings ?? []).length;
	const currentTier = exposureTier(currentScore, overview.minExposureThreshold, overview.topRecommendationThreshold);
	const currentTierStyle = EXPOSURE_TIER_STYLES[currentTier];
	const currentPercentile = topPercentile(currentScore);
	const targetPercentile = topPercentile(targetScore);
	const exposureFooter =
		schemaDefectCount > 0
			? t('exposureFooterNote', { count: String(schemaDefectCount).padStart(2, '0'), target: targetScore })
			: t('exposureFooterNoteClean', { target: targetScore });

	const riskCards = buildRiskCards(report.findings ?? []);

	return (
		<div className="flex flex-col gap-4">
			{/* Target site identity — sits directly above Executive Summary */}
			<TargetEntityBanner
				report={report}
				reportData={reportData}
				viewportAudit={pageSpeed?.viewport ?? null}
			/>

			<section
				id="sec-summary"
				className="audit-report-section scroll-mt-24 overflow-hidden rounded-2xl border border-[#C9A227]/25 bg-[#0B0F28]"
			>
				<div className="border-b border-[#C9A227]/20 px-5 py-4 sm:px-6">
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('execBadge')}</p>
					<h2 className="mt-1 text-xl font-extrabold text-white sm:text-2xl">{t('execTitle')}</h2>
					<div className="mt-3 rounded-xl border border-indigo-400/25 bg-indigo-500/[0.08] px-4 py-3">
						<p className="text-sm leading-relaxed text-slate-200">
							{t(`execInsight.${bottleneckType}`, { geoScore, seoScore })}
						</p>
					</div>
				</div>

			{/*
			 * PAS flow (Problem → Agitate → Solve):
			 * 1) Measured scores + urgency badge + business-loss cards (problem / agitate)
			 * 2) Optimization potential simulator (solve — patch defects → projected score)
			 */}

			{/* ── 1단계: 현재 실측 상태 및 비즈니스 손실 ── */}
			<div className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
				<DualScoreSummaryHeader
					report={report}
					geoScore={geoScore}
					geoGrade={overview.grade}
					geoPercentile={overview.percentile}
					seoScore={seoScore}
				/>

				<div className="mt-4 rounded-xl border border-[#C9A227]/30 bg-gradient-to-r from-[#C9A227]/[0.10] via-indigo-500/[0.07] to-transparent px-4 py-3.5">
					<p className="text-sm leading-relaxed text-slate-200">
						<span className="font-extrabold text-[#D4AF37]">{t('execJudgmentLabel')}</span>
						<span className="text-slate-500">: </span>
						<span>{t(`execJudgment.${bottleneckType}`, { geoScore, seoScore })}</span>
					</p>
				</div>
			</div>

			{/* 우선 개선 / 향상 잠재력 */}
			<div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
				<div className={`flex items-center gap-3 rounded-xl border ${urgencyStyle.border} ${urgencyStyle.bg} px-4 py-3`}>
					<p className={`text-base font-extrabold sm:text-lg ${urgencyStyle.text}`}>
						{t(`execUrgency.${urgencyLevel}`)}
					</p>
				</div>

				<div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-center sm:text-right">
					<p className="text-sm font-bold text-[#D4AF37]">
						{targetAchieved
							? t('execPotentialAchieved')
							: t('execPotentialGain', { gain: potentialGain, target: targetScore })}
					</p>
				</div>
			</div>

			{/* 현재 상태 유지 시 예상 비즈니스 손실 (치명적/주요/주의 결함) */}
			{riskCards.length > 0 && (
				<div className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
					<p className="text-sm font-bold text-[#D4AF37]">{t('lossTitle')}</p>
					<div className="mt-3 grid grid-cols-1 items-stretch gap-3">
						{riskCards.map((card, index) => {
							const tier = riskBadgeForIndex(index);
							return (
								<div
									key={card.themeId}
									className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-black/35"
								>
									<div className="flex flex-1 flex-col sm:flex-row">
										<div className="flex-1 px-4 py-3">
											<div
												className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${tier.border} ${tier.bg} ${tier.text}`}
											>
												<span aria-hidden>{tier.icon}</span>
												<span>
													{tRisk(`badgeTier.${tier.key}`)} {String(index + 1).padStart(2, '0')}
												</span>
											</div>
											<p className="mt-2 text-xs leading-relaxed text-slate-300">
												{card.cause}
												{card.extraCount > 0 && (
													<span className="ml-1.5 whitespace-nowrap text-[10px] font-bold text-rose-300/80">
														{tRisk('moreIssues', { count: card.extraCount })}
													</span>
												)}
											</p>
										</div>
										<div
											className="flex items-center justify-center border-t border-white/[0.06] bg-white/[0.03] py-1.5 text-rose-400 sm:border-t-0 sm:border-l sm:px-1.5 sm:py-0"
											aria-hidden
										>
											<span className="sm:hidden">↓</span>
											<span className="hidden sm:inline">→</span>
										</div>
										<div className="flex-1 border-t border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 sm:border-t-0">
											<p className="text-[10px] font-bold uppercase tracking-wide text-rose-300">{tRisk('lossLabel')}</p>
											<p className="mt-1 text-sm font-bold leading-relaxed text-white">
												{tRisk(`themes.${card.themeId}.loss`)}
											</p>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* ── 2단계: 최적화 잠재력 시뮬레이터 (손실 결함 패치 → 점수 상승) ── */}
			<div className="px-5 py-5 sm:px-6">
				<p className="text-sm font-bold text-[#D4AF37]">{t('exposureCompareTitle')}</p>

				<div className="mt-3 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
					<div className={`rounded-xl border ${currentTierStyle.border} ${currentTierStyle.bg} p-4`}>
						<p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('exposureCurrentLabel')}</p>
						<div className="mt-1 flex items-baseline gap-1.5">
							<span className="text-3xl font-extrabold tabular-nums text-white">{currentScore}</span>
							<span className="text-sm font-semibold text-slate-500">{t('exposureScoreSuffix')}</span>
						</div>
						<p className={`mt-1.5 text-xs font-bold ${currentTierStyle.text}`}>
							{t('exposureTierWithPercentile', {
								icon: currentTierStyle.icon,
								tier: t(`exposureTier.${currentTier}`),
								percentile: currentPercentile,
							})}
						</p>
					</div>

					<div className="flex items-center justify-center py-1 sm:py-0">
						<div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2.5 text-center">
							<p className="text-sm font-extrabold text-[#D4AF37]">
								{targetAchieved ? t('exposureAchieved') : t('exposureGain', { gain: potentialGain })}
							</p>
						</div>
					</div>

					<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
						<p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/80">
							{t('exposureTargetLabel')}
						</p>
						<div className="mt-1 flex items-baseline gap-1.5">
							<span className="text-3xl font-extrabold tabular-nums text-emerald-300">{targetScore}</span>
							<span className="text-sm font-semibold text-emerald-300/70">{t('exposureScoreSuffix')}</span>
						</div>
						<p className="mt-1.5 text-xs font-bold text-emerald-300">
							{t('exposureTargetTier', { percentile: targetPercentile })}
						</p>
					</div>
				</div>

				<div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-black/40">
					<div
						className={`h-full rounded-full transition-all ${currentTierStyle.bar}`}
						style={{ width: `${Math.min(100, Math.max(currentScore, 3))}%` }}
					/>
					<div
						className="absolute inset-y-0 w-0.5 bg-emerald-300"
						style={{ left: `${Math.min(100, targetScore)}%` }}
						aria-hidden
					/>
				</div>

				<p
					className="mt-3 rounded-lg border border-indigo-400/20 bg-indigo-500/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-slate-300"
					title={exposureFooter}
				>
					{exposureFooter}
				</p>
			</div>
			</section>
		</div>
	);
}
