'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { DualScoreSummaryHeader } from '@/components/audit/DualScoreSummaryHeader';
import { PdfTwoTrackDiagnosisCard } from '@/components/audit/print/PdfTwoTrackDiagnosisCard';
import { TwoTrackDiagnosisCard } from '@/components/audit/TwoTrackDiagnosisCard';
import type { AuditTrackId } from '@/components/audit/AuditResultTabs';
import { TargetEntityBanner } from '@/components/audit/TargetEntityBanner';
import { useAuditData } from '@/components/audit/AuditDataContext';
import { businessConversionFromAudit } from '@/lib/audit/business-conversion';
import { MEASURED_SCORE_WEIGHTS } from '@/lib/audit/diagnosis-scores';
import { buildExecStorytelling, buildSimulatorInsightData } from '@/lib/audit/exec-insight';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import type { AuditReport } from '@/lib/site-auditor';
import { buildStrategyStudioHref } from '@/lib/strategy/strategy-url';

type ExposureTier = 'danger' | 'partial' | 'top';

function exposureTier(score: number, minThreshold: number, topThreshold: number): ExposureTier {
	if (score >= topThreshold) return 'top';
	if (score >= minThreshold) return 'partial';
	return 'danger';
}

/** Presentational-only AEO/GEO citation-status read from already-computed checklist results — never recalculates. */
type AeoGeoSummaryCase = 'caseA' | 'caseB' | 'caseC' | 'caseDefault';

const AEO_GEO_SUMMARY_CHECK_IDS = [
	'organization',
	'faq-howto-schema',
	'llms-txt',
	'person-eeat',
	'eeat-author',
	'heading-structure',
] as const;

function resolveAeoGeoSummaryCase(checklist: Array<{ id: string; passed: boolean }> | undefined | null): AeoGeoSummaryCase {
	const items = checklist ?? [];
	const findPassed = (id: string) => items.find((c) => c.id === id)?.passed ?? false;
	const hasFaq = findPassed('faq-howto-schema');
	const hasOrg = findPassed('organization');
	const hasLlms = findPassed('llms-txt');
	const relevant = AEO_GEO_SUMMARY_CHECK_IDS.map((id) => items.find((c) => c.id === id)).filter(
		(c): c is { id: string; passed: boolean } => Boolean(c),
	);
	const passedRatio = relevant.length > 0 ? relevant.filter((c) => c.passed).length / relevant.length : 0;

	if (relevant.length > 0 && passedRatio === 1) return 'caseC';
	if (!hasFaq && hasOrg) return 'caseA';
	if (!hasLlms || passedRatio < 0.5) return 'caseB';
	return 'caseDefault';
}

interface AuditExecutiveSummaryProps {
	report: AuditReport;
	reportId?: string | null;
	reportData?: GeoNarrativeReport | null;
	/** Live PageSpeed snapshot — viewport audit cross-validates mobile readability. */
	pageSpeed?: PageSpeedSnapshot | null;
	/** True while the Track 3 SSOT (mobile+desktop averaged PSI read) is still in flight — gates the composite score reveal. */
	cwvLoading?: boolean;
	/** True once the Track 3 SSOT has a real PSI read — false while it's still the on-page fallback. */
	cwvMeasured?: boolean;
	/** Single source of truth shared with the bottom detail tab nav (`AuditResultTabs`). */
	activeTrack: AuditTrackId;
	/** Fired when a top summary card is clicked — activates the matching track and scrolls to the detail tabs. */
	onTrackSelect: (track: AuditTrackId) => void;
}

export function AuditExecutiveSummary({
	report,
	reportId,
	reportData,
	pageSpeed,
	cwvLoading = false,
	cwvMeasured = true,
	activeTrack,
	onTrackSelect,
}: AuditExecutiveSummaryProps) {
	const t = useTranslations('audit.b2b');
	const tStrategy = useTranslations('strategyStudio');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';

	const { scores, snapshot } = useAuditData();
	const breakdown = scores?.scoreBreakdown ?? snapshot?.scoreBreakdown ?? {};
	const geoScore = scores?.geoScore ?? snapshot?.externalTrustScore ?? breakdown.track2 ?? 0;
	const seoScore = scores?.technicalScore ?? snapshot?.technicalScore ?? breakdown.track1 ?? 0;
	const cwvScore = breakdown.coreWebVitals ?? 0;
	const geoWeightPct = Math.round(MEASURED_SCORE_WEIGHTS.track2 * 100);
	const seoWeightPct = Math.round(MEASURED_SCORE_WEIGHTS.track1 * 100);
	const cwvWeightPct = Math.round(MEASURED_SCORE_WEIGHTS.coreWebVitals * 100);
	const overview = snapshot?.reputation?.overview ?? {};
	const findingsCount = report.findings?.length ?? 0;
	const aeoGeoSummaryCase = useMemo(
		() => resolveAeoGeoSummaryCase(report.checklist),
		[report.checklist],
	);
	const conversionModel = useMemo(
		() => businessConversionFromAudit(report, null, lang),
		[report, lang],
	);

	const derived = useMemo(() => {
		const story = buildExecStorytelling({
			geoScore,
			seoScore,
			url: report.url,
			hasSsl: report.hasSsl,
		});
		const currentScore = scores?.totalScore ?? snapshot?.measuredScore ?? 0;
		const potentialGain = Math.max(0, story.targetScore - currentScore);
		const insight = buildSimulatorInsightData({
			currentScore,
			scoreDelta: potentialGain,
			schemaDefectCount: findingsCount,
		});
		const currentTier = exposureTier(
			currentScore,
			overview.minExposureThreshold ?? 0,
			overview.topRecommendationThreshold ?? 0,
		);
		return {
			currentScore,
			potentialGain,
			insight,
			projectedScore: insight.projectedScore,
			currentTier,
		};
	}, [
		geoScore,
		seoScore,
		report.url,
		report.hasSsl,
		scores?.totalScore,
		snapshot?.measuredScore,
		findingsCount,
		overview.minExposureThreshold,
		overview.topRecommendationThreshold,
	]);

	return (
		<div id="audit-top" className="flex scroll-mt-24 flex-col gap-6">
			<TargetEntityBanner
				report={report}
				reportData={reportData}
				viewportAudit={pageSpeed?.viewport ?? null}
			/>

			<section
				id="sec-exec-insight"
				className="pdf-page-item audit-report-section scroll-mt-24 overflow-visible rounded-2xl border border-[#C9A227]/25 bg-white dark:bg-[#0B0F28]"
			>
				<div className="px-5 py-5 sm:px-6 sm:py-6">
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('execBadge')}</p>
					<h2 className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
						{t('execTitle')}
						<span className="text-xs font-semibold text-slate-400 dark:text-slate-500">({t('execTitleEn')})</span>
					</h2>
					<p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 sm:text-sm">
						{t('execSubtitle')}
					</p>
					<div className="mt-5">
						<DualScoreSummaryHeader
							key={`dual-${derived.currentScore}-${cwvScore}-${cwvLoading ? 'loading' : 'ready'}`}
							measuredScore={derived.currentScore}
							measuredPercentile={scores?.percentile ?? snapshot?.percentile ?? 0}
							geoScore={geoScore}
							geoGrade={snapshot?.geoGrade}
							geoPercentile={scores?.geoPercentile ?? snapshot?.geoPercentile ?? 0}
							geoWeight={geoWeightPct}
							seoScore={seoScore}
							seoWeight={seoWeightPct}
							cwvWeight={cwvWeightPct}
							technicalPercentile={scores?.technicalPercentile ?? snapshot?.technicalPercentile ?? 0}
							securityAlert={scores?.securityCriticalAlert ?? snapshot?.securityCriticalAlert ?? null}
							isHttps={scores?.isHttps ?? snapshot?.isHttps ?? true}
							securityCapped={scores?.securityCapped ?? snapshot?.securityCapped ?? false}
							potentialGain={derived.potentialGain}
							targetScore={derived.projectedScore}
							exposureTier={derived.currentTier}
							roiModel={conversionModel}
							scoreBreakdown={scores?.scoreBreakdown ?? snapshot?.scoreBreakdown}
							cwvLoading={cwvLoading}
							cwvMeasured={cwvMeasured}
						/>
						<Link
							href={buildStrategyStudioHref(reportId, conversionModel.targetQuery, report.url)}
							className="print:hidden mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-cyan-500 hover:shadow-md sm:w-auto"
						>
							{tStrategy('scoreStrategyCta')}
						</Link>
					</div>
					<div className="mt-4 flex flex-col gap-1.5 rounded-xl border border-sky-200/70 bg-gradient-to-r from-sky-50/80 to-violet-50/60 p-3.5 dark:border-sky-500/20 dark:from-sky-500/[0.06] dark:to-violet-500/[0.06] sm:p-4">
						<p className="text-xs font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
							{t('aeoGeoSummaryLabel')}
						</p>
						<p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 sm:text-[13px]">
							{t.rich(`aeoGeoSummary.${aeoGeoSummaryCase}`, {
								b: (chunks) => (
									<strong className="font-bold text-indigo-700 dark:text-indigo-300">{chunks}</strong>
								),
							})}
						</p>
					</div>
				</div>
			</section>

			{/*
			 * Always mounted (not DeferredSection) so A4 capture cannot miss
			 * Track 1/2/3 scores. Hidden on the dashboard via `pdf-print-only`.
			 */}
			<PdfTwoTrackDiagnosisCard scoreSnapshot={snapshot} cwvMeasured={cwvMeasured} />

			{/*
			 * Screen-only interactive card. The A4 capture uses the light-theme
			 * twin above so the dark dashboard chrome is not duplicated in print.
			 */}
			<div className="print:hidden pdf-screen-only">
				<TwoTrackDiagnosisCard
					technicalScore={seoScore}
					geoScore={geoScore}
					technicalPercentile={scores?.technicalPercentile ?? snapshot?.technicalPercentile ?? 0}
					geoPercentile={scores?.geoPercentile ?? snapshot?.geoPercentile ?? 0}
					isHttps={scores?.isHttps ?? snapshot?.isHttps ?? true}
					securityCapped={scores?.securityCapped ?? snapshot?.securityCapped ?? false}
					geoGrade={snapshot?.geoGrade}
					cwvScore={cwvScore}
					cwvLoading={cwvLoading}
					cwvMeasured={cwvMeasured}
					activeTrack={activeTrack}
					onTrackSelect={onTrackSelect}
				/>
			</div>
		</div>
	);
}
