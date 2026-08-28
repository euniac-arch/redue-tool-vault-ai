'use client';

import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { AuditCtaBox } from '@/components/AuditCtaBox';
import { StrategyStudioCta } from '@/components/strategy/StrategyStudioCta';
import { businessConversionFromAudit } from '@/lib/audit/business-conversion';
import { updateHistoryMeasuredScore } from '@/lib/audit-history-storage';
import { ExternalVerificationLinks } from '@/components/ExternalVerificationLinks';
import { AuditExecutiveSummary } from '@/components/AuditExecutiveSummary';
import { AuditConversionFooter } from '@/components/audit/AuditConversionFooter';
import {
	AuditResultTabs,
	tabIdToTrackId,
	trackIdToTabId,
	type AuditResultTabId,
	type AuditTrackId,
} from '@/components/audit/AuditResultTabs';
import { Tab1ReputationSection } from '@/components/audit/Tab1ReputationSection';
import { Tab2OnpageBody } from '@/components/audit/Tab2OnpageBody';
import { Tab2TechnicalSection } from '@/components/audit/Tab2TechnicalSection';
import { Tab3CoreWebVitalsSection } from '@/components/audit/Tab3CoreWebVitalsSection';
import { DeferredSection } from '@/components/audit/DeferredSection';
import { useEvaluationReport } from '@/components/audit/AuditPayloadProvider';
import type { PageSpeedStrategy } from '@/components/audit/PageSpeedReport';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { resolveTrack3PerformanceScore, type PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import { AuditDataProvider } from '@/components/audit/AuditDataContext';
import { ReportLegalDisclaimer } from '@/components/audit/ReportLegalDisclaimer';
import { ReportPDFTemplate } from '@/components/audit/ReportPDFTemplate';
import { PdfAiEngineCitationTable } from '@/components/audit/print/PdfAiEngineCitationTable';
import { PdfCoreWebVitalsPanel } from '@/components/audit/print/PdfCoreWebVitalsPanel';
import { PdfOnpageChecklistGrid } from '@/components/audit/print/PdfOnpageChecklistGrid';
import { PdfQuickAxesCard } from '@/components/audit/print/PdfQuickAxesCard';
import { PdfRoadmapPanel } from '@/components/audit/print/PdfRoadmapPanel';
import { PdfSchemaGraphTable } from '@/components/audit/print/PdfSchemaGraphTable';
import { PrintSectionBoundary } from '@/components/audit/print/pdf-print-shared';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { executiveSummaryWithMeasuredScore } from '@/lib/audit/executive-summary';
import type { AuditReport } from '@/lib/site-auditor';

const JUST_REFRESHED_MS = 120_000;

function formatDiagnosisClock(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function isJustUpdated(iso: string, sessionFresh: boolean): boolean {
	if (sessionFresh) return true;
	const t = new Date(iso).getTime();
	return Number.isFinite(t) && Date.now() - t < JUST_REFRESHED_MS;
}

export interface AuditReportDocumentProps {
	report: AuditReport;
	reportId?: string | null;
	geoNarrative: GeoNarrativeReport | null;
	geoNarrativeLoading: boolean;
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
	resultTab: AuditResultTabId;
	onResultTabChange: (tab: AuditResultTabId) => void;
	onOpenPdfPreview: () => void;
	justRefreshed?: boolean;
	/** Public share page — stack both tabs like the A4 preview. */
	publicView?: boolean;
	/** 4주 마일스톤 패널(`MilestoneAuditPanel`) — 도메인명 바로 아래, 실행 요약 위에 렌더링. */
	milestoneTopSlot?: ReactNode;
	/** 일반/무료 사용자 대상 GEO 프로 패키지 CTA — 리포트 하단에 렌더링. */
	milestoneBottomSlot?: ReactNode;
	/**
	 * 확정(박제)된 마일스톤 회차를 보고 있을 때 true로 넘긴다 — 세션의 "프리스크립션
	 * 적용" 오버레이(`useEvaluationReport`)가 같은 URL이라는 이유만으로 냉동된 과거
	 * 스냅샷 위에 덮어씌워지는 것을 막는다(박제 데이터는 항상 그대로 보여야 한다).
	 */
	bypassEvaluationOverlay?: boolean;
}

export function AuditReportDocument({
	report,
	reportId,
	geoNarrative,
	geoNarrativeLoading,
	pageSpeed,
	pageSpeedDesktop,
	pageSpeedMobile,
	pageSpeedLoading,
	pageSpeedError,
	psiStrategy,
	onPsiStrategyChange,
	pageSpeedRefreshing = false,
	onRefreshPageSpeed,
	resultTab,
	onResultTabChange,
	onOpenPdfPreview,
	justRefreshed = false,
	publicView = false,
	milestoneTopSlot,
	milestoneBottomSlot,
	bypassEvaluationOverlay = false,
}: AuditReportDocumentProps) {
	const t = useTranslations('audit');
	const locale = useLocale();
	// Hooks must run unconditionally — a locked milestone snapshot simply ignores the result.
	const evaluatedReport = useEvaluationReport(report);
	const liveReport = bypassEvaluationOverlay ? report : evaluatedReport;
	const lang = locale === 'en' ? 'en' : 'ko';
	// Track 3 single source of truth — 50:50 average of the mobile and desktop
	// Lighthouse performance reads, independent of the desktop/mobile toggle so the
	// composite score never shifts just because the user switched tabs in the Tab 3
	// detail view. Falls back to the on-page performance category inside
	// buildDiagnosisScoreSnapshot until PSI finishes loading either strategy.
	const psiPerformanceScore = resolveTrack3PerformanceScore({
		mobile: pageSpeedMobile,
		desktop: pageSpeedDesktop,
	});
	const scoreSnapshot = useMemo(
		() => buildDiagnosisScoreSnapshot(liveReport, geoNarrative, lang, { coreWebVitalsScore100: psiPerformanceScore }),
		[liveReport, geoNarrative, lang, psiPerformanceScore],
	);
	const auditData = useMemo(
		() => ({ scores: scoreSnapshot.scores, snapshot: scoreSnapshot }),
		[scoreSnapshot],
	);
	// Once the live PageSpeed(Lighthouse) read resolves, patch the stored history
	// row's measuredScore/grade to this exact value — keeps the history list badge
	// and this page's headline 100% in sync instead of the history fallback (CWV ≈
	// technicalScore) permanently drifting from the real PSI-informed composite.
	useEffect(() => {
		if (!reportId || psiPerformanceScore == null) return;
		updateHistoryMeasuredScore(reportId, {
			measuredScore: scoreSnapshot.measuredScore,
			measuredGrade: scoreSnapshot.grade,
			coreWebVitalsScore: psiPerformanceScore,
			pageSpeedDesktop: pageSpeedDesktop ?? null,
			pageSpeedMobile: pageSpeedMobile ?? null,
		});
	}, [
		reportId,
		psiPerformanceScore,
		scoreSnapshot.measuredScore,
		scoreSnapshot.grade,
		pageSpeedDesktop,
		pageSpeedMobile,
	]);
	// The PDF/print executive briefing must show the exact same headline number
	// as the dashboard (scoreSnapshot.measuredScore) — never the raw on-page
	// score the crawler stored the report with. Recomputed here (not memoized
	// onto the report itself) so it can never silently drift out of sync.
	const printExecutiveSummary = useMemo(
		() => executiveSummaryWithMeasuredScore(liveReport, scoreSnapshot.measuredScore),
		[liveReport, scoreSnapshot.measuredScore],
	);
	const onpageDiagnostic = scoreSnapshot.onpage;
	const scannedLabel = useMemo(
		() => new Date(liveReport.fetchedAt).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR'),
		[liveReport.fetchedAt, locale],
	);
	const diagnosedClock = useMemo(
		() => formatDiagnosisClock(liveReport.fetchedAt),
		[liveReport.fetchedAt],
	);
	const showJustRefreshed = isJustUpdated(liveReport.fetchedAt, justRefreshed);
	const geoTab = useMemo(
		() => (
			<PrintSectionBoundary>
				<Tab1ReputationSection
					report={liveReport}
					audit={report}
					reportData={geoNarrative}
					onOpenPdfPreview={onOpenPdfPreview}
					publicView={publicView}
				/>
			</PrintSectionBoundary>
		),
		[liveReport, report, geoNarrative, onOpenPdfPreview, publicView],
	);
	const onpageTab = useMemo(
		() => (
			<PrintSectionBoundary>
				<Tab2TechnicalSection
					report={liveReport}
					diagnostic={onpageDiagnostic}
					scores={scoreSnapshot.scores}
				>
					<Tab2OnpageBody
						report={liveReport}
						geoNarrative={geoNarrative}
						geoNarrativeLoading={geoNarrativeLoading}
						rawTechnicalScore={scoreSnapshot.rawTechnicalScore}
						maxRawScore={scoreSnapshot.maxRawScore}
						publicView={publicView}
					/>
				</Tab2TechnicalSection>
			</PrintSectionBoundary>
		),
		[
			liveReport,
			onpageDiagnostic,
			scoreSnapshot.scores,
			scoreSnapshot.rawTechnicalScore,
			scoreSnapshot.maxRawScore,
			geoNarrative,
			geoNarrativeLoading,
			publicView,
		],
	);
	const cwvTab = useMemo(
		() => (
			<PrintSectionBoundary>
				<Tab3CoreWebVitalsSection
					pageSpeed={pageSpeed}
					pageSpeedDesktop={pageSpeedDesktop}
					pageSpeedMobile={pageSpeedMobile}
					pageSpeedLoading={pageSpeedLoading}
					pageSpeedError={pageSpeedError}
					psiStrategy={psiStrategy}
					onPsiStrategyChange={onPsiStrategyChange}
					pageSpeedRefreshing={pageSpeedRefreshing}
					onRefreshPageSpeed={onRefreshPageSpeed}
					targetUrl={liveReport.url}
				/>
			</PrintSectionBoundary>
		),
		[
			pageSpeed,
			pageSpeedDesktop,
			pageSpeedMobile,
			pageSpeedLoading,
			pageSpeedError,
			psiStrategy,
			onPsiStrategyChange,
			pageSpeedRefreshing,
			onRefreshPageSpeed,
			liveReport.url,
		],
	);
	const handleResultTabChange = useCallback(
		(tab: AuditResultTabId) => {
			onResultTabChange(tab);
		},
		[onResultTabChange],
	);
	// `resultTab` is the single source of truth — the top summary cards and the
	// bottom detail tab nav both derive their active state from it, in either domain.
	const activeTrack = useMemo(() => tabIdToTrackId(resultTab), [resultTab]);
	const handleTrackSelect = useCallback(
		(track: AuditTrackId) => onResultTabChange(trackIdToTabId(track)),
		[onResultTabChange],
	);

	return (
		<div
			id="pdf-print-area"
			data-print-report-container="true"
			data-prescription-applied={liveReport.isPrescriptionApplied ? 'true' : 'false'}
			data-evaluation-score={String(scoreSnapshot.measuredScore)}
			className="print-report-container pdf-print-area pdf-print-container pdf-light-theme flex flex-col gap-8"
		>
			<header className="audit-print-header pdf-print-only pdf-page-item mb-2 border-b-2 border-[#C9A227] pb-4">
				<div className="flex items-end justify-between gap-4">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">REDUE AI</p>
						<h1 className="mt-1 text-xl font-extrabold text-[#0B1C2C]">
							SEO &amp; GEO Technical Audit Report
						</h1>
					</div>
					<div className="text-right text-[11px] text-slate-600">
						<p>
							{diagnosedClock
								? `${t('lastDiagnosedAt', { time: diagnosedClock })}${showJustRefreshed ? t('justRefreshedSuffix') : ''}`
								: scannedLabel}
						</p>
						<p className="mt-0.5 max-w-xs break-all font-mono">{liveReport.url}</p>
					</div>
				</div>
			</header>

			<DeferredSection className="pdf-print-only" force={publicView} idleTimeoutMs={4000} minHeight={1}>
				<ReportPDFTemplate
					key={`pdf-template-${liveReport.url}-${liveReport.isPrescriptionApplied ? 'after' : 'before'}-${scoreSnapshot.measuredScore}-${liveReport.prescriptionAppliedAt ?? '0'}`}
					report={liveReport}
					summary={printExecutiveSummary}
				/>
			</DeferredSection>

			<AuditDataProvider value={auditData}>
			<div className="audit-report-body flex flex-col gap-8">
				{milestoneTopSlot ? (
					<div className="no-pdf-capture print:hidden">{milestoneTopSlot}</div>
				) : null}
				<AuditExecutiveSummary
					report={liveReport}
					reportId={reportId}
					reportData={geoNarrative}
					pageSpeed={pageSpeed}
					cwvLoading={pageSpeedLoading}
					cwvMeasured={psiPerformanceScore != null}
					activeTrack={activeTrack}
					onTrackSelect={handleTrackSelect}
				/>
				{publicView ? null : (
					<StrategyStudioCta auditId={reportId} keyword={businessConversionFromAudit(liveReport).targetQuery} url={liveReport.url} />
				)}

				{/*
				 * Curated A4 tables (stages 1–6) plus the full Track 1/2/3 tab
				 * bodies below. Both trees stay independent of `resultTab`:
				 * print/PDF unfolds every track so a missing Track 3 payload
				 * cannot blank Tracks 1 and 2.
				 */}
				<DeferredSection className="pdf-print-only" force={publicView} idleTimeoutMs={4000} minHeight={1}>
					<PrintSectionBoundary>
						<PdfQuickAxesCard scoreSnapshot={scoreSnapshot} />
					</PrintSectionBoundary>
				</DeferredSection>
				<DeferredSection className="pdf-print-only" force={publicView} idleTimeoutMs={4000} minHeight={1}>
					<PrintSectionBoundary>
						<PdfAiEngineCitationTable report={liveReport} scoreSnapshot={scoreSnapshot} lang={lang} />
					</PrintSectionBoundary>
				</DeferredSection>
				<DeferredSection className="pdf-print-only" force={publicView} idleTimeoutMs={4000} minHeight={1}>
					<PrintSectionBoundary>
						<PdfSchemaGraphTable report={liveReport} />
					</PrintSectionBoundary>
				</DeferredSection>
				<DeferredSection className="pdf-print-only" force={publicView} idleTimeoutMs={4000} minHeight={1}>
					<PrintSectionBoundary>
						<PdfCoreWebVitalsPanel pageSpeedDesktop={pageSpeedDesktop} pageSpeedMobile={pageSpeedMobile} />
					</PrintSectionBoundary>
				</DeferredSection>
				<DeferredSection className="pdf-print-only" force={publicView} idleTimeoutMs={4000} minHeight={1}>
					<PrintSectionBoundary>
						<PdfOnpageChecklistGrid report={liveReport} />
					</PrintSectionBoundary>
				</DeferredSection>
				<DeferredSection className="pdf-print-only" force={publicView} idleTimeoutMs={4000} minHeight={1}>
					<PrintSectionBoundary>
						<PdfRoadmapPanel report={liveReport} lang={lang} />
					</PrintSectionBoundary>
				</DeferredSection>

				<AuditResultTabs
					geoLabel={t('tabs.geo')}
					onpageLabel={t('tabs.onpage')}
					cwvLabel={t('tabs.cwv')}
					activeTab={resultTab}
					onTabChange={handleResultTabChange}
					forceStack={publicView}
					geoContent={geoTab}
					onpageContent={onpageTab}
					cwvContent={cwvTab}
				/>

				<AuditConversionFooter
					report={liveReport}
					reportData={geoNarrative}
					reportId={reportId}
					publicView={publicView}
					lang={lang}
				/>

				<div className="print:hidden pdf-screen-only flex flex-col gap-6 pb-2">
					{milestoneBottomSlot ? <div className="no-pdf-capture">{milestoneBottomSlot}</div> : null}
					<AuditCtaBox report={liveReport} auditId={reportId} />
					<div>
						<ExternalVerificationLinks
							url={liveReport.url}
							variant={publicView ? 'light' : 'dark'}
							sectionId="official-validation-tools"
						/>
						<p className="mt-2 mb-4 flex items-center pt-1 text-[11px] font-medium text-slate-500">
							<Clock
								className="mr-1.5 inline-block h-3.5 w-3.5 shrink-0 opacity-70"
								aria-hidden
							/>
							{t('scannedAt', {
								time: scannedLabel,
								status: liveReport.httpStatus ?? '—',
								ms: liveReport.responseTimeMs,
							})}
						</p>
						<ReportLegalDisclaimer />
					</div>
				</div>
			</div>
			</AuditDataProvider>

			<footer className="audit-print-footer pdf-print-only pdf-page-item mt-8 flex flex-col gap-1 border-t border-slate-300 pt-3 text-[10px] text-slate-600">
				<p className="pdf-text-gold font-bold uppercase tracking-[0.14em]">{t('printFooterWatermark')}</p>
				<p>{t('printFooterDisclaimer')}</p>
				<p>{t('printFooter')}</p>
			</footer>
		</div>
	);
}
