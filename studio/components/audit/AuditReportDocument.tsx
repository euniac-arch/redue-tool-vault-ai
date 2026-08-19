'use client';

import { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { AuditCtaBox } from '@/components/AuditCtaBox';
import { ExternalVerificationLinks } from '@/components/ExternalVerificationLinks';
import { AuditExecutiveSummary } from '@/components/AuditExecutiveSummary';
import { AuditResultTabs, type AuditResultTabId } from '@/components/audit/AuditResultTabs';
import { Tab1ReputationSection } from '@/components/audit/Tab1ReputationSection';
import { Tab2TechnicalSection } from '@/components/audit/Tab2TechnicalSection';
import { DeferredSection } from '@/components/audit/DeferredSection';
import { useEvaluationReport } from '@/components/audit/AuditPayloadProvider';
import type { PageSpeedStrategy } from '@/components/audit/PageSpeedReport';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import { AuditDataProvider } from '@/components/audit/AuditDataContext';
import { ReportLegalDisclaimer } from '@/components/audit/ReportLegalDisclaimer';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import type { AuditReport } from '@/lib/site-auditor';

const JUST_REFRESHED_MS = 120_000;

const ReportPDFTemplate = dynamic(
	() => import('@/components/audit/ReportPDFTemplate').then((mod) => mod.ReportPDFTemplate),
	{ ssr: false },
);

const AuditTimelineSection = dynamic(
	() => import('@/components/audit/AuditTimelineSection').then((mod) => mod.AuditTimelineSection),
	{
		ssr: false,
		loading: () => (
			<div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04]" />
		),
	},
);

const Tab2OnpageBody = dynamic(
	() => import('@/components/audit/Tab2OnpageBody').then((mod) => mod.Tab2OnpageBody),
	{
		ssr: false,
		loading: () => (
			<div className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04]" />
		),
	},
);

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
	resultTab: AuditResultTabId;
	onResultTabChange: (tab: AuditResultTabId) => void;
	onOpenPdfPreview: () => void;
	justRefreshed?: boolean;
	/** Public share page — stack both tabs like the A4 preview. */
	publicView?: boolean;
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
	resultTab,
	onResultTabChange,
	onOpenPdfPreview,
	justRefreshed = false,
	publicView = false,
}: AuditReportDocumentProps) {
	const t = useTranslations('audit');
	const locale = useLocale();
	const liveReport = useEvaluationReport(report);
	const lang = locale === 'en' ? 'en' : 'ko';
	const scoreSnapshot = useMemo(
		() => buildDiagnosisScoreSnapshot(liveReport, geoNarrative, lang),
		[liveReport, geoNarrative, lang],
	);
	const auditData = useMemo(
		() => ({ scores: scoreSnapshot.scores, snapshot: scoreSnapshot }),
		[scoreSnapshot],
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
			<Tab1ReputationSection
				report={liveReport}
				audit={report}
				reportData={geoNarrative}
				onOpenPdfPreview={onOpenPdfPreview}
				publicView={publicView}
			/>
		),
		[liveReport, report, geoNarrative, onOpenPdfPreview, publicView],
	);
	const onpageTab = useMemo(
		() => (
			<Tab2TechnicalSection
				report={liveReport}
				diagnostic={onpageDiagnostic}
				scores={scoreSnapshot.scores}
			>
				<Tab2OnpageBody
					report={liveReport}
					geoNarrative={geoNarrative}
					geoNarrativeLoading={geoNarrativeLoading}
					pageSpeed={pageSpeed}
					pageSpeedDesktop={pageSpeedDesktop}
					pageSpeedMobile={pageSpeedMobile}
					pageSpeedLoading={pageSpeedLoading}
					pageSpeedError={pageSpeedError}
					psiStrategy={psiStrategy}
					onPsiStrategyChange={onPsiStrategyChange}
					rawTechnicalScore={scoreSnapshot.rawTechnicalScore}
					maxRawScore={scoreSnapshot.maxRawScore}
					publicView={publicView}
				/>
			</Tab2TechnicalSection>
		),
		[
			liveReport,
			onpageDiagnostic,
			scoreSnapshot.scores,
			scoreSnapshot.rawTechnicalScore,
			scoreSnapshot.maxRawScore,
			geoNarrative,
			geoNarrativeLoading,
			pageSpeed,
			pageSpeedDesktop,
			pageSpeedMobile,
			pageSpeedLoading,
			pageSpeedError,
			psiStrategy,
			onPsiStrategyChange,
			publicView,
		],
	);
	const handleResultTabChange = useCallback(
		(tab: AuditResultTabId) => {
			onResultTabChange(tab);
		},
		[onResultTabChange],
	);

	return (
		<div
			id="pdf-print-area"
			data-prescription-applied={liveReport.isPrescriptionApplied ? 'true' : 'false'}
			data-evaluation-score={String(liveReport.score)}
			className="pdf-print-area pdf-print-container pdf-light-theme flex flex-col gap-6"
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
					key={`pdf-template-${liveReport.url}-${liveReport.isPrescriptionApplied ? 'after' : 'before'}-${liveReport.score}-${liveReport.prescriptionAppliedAt ?? '0'}`}
					report={liveReport}
					summary={liveReport.executiveSummary}
				/>
			</DeferredSection>

			<AuditDataProvider value={auditData}>
			<div className="audit-report-body flex flex-col gap-6">
				<AuditExecutiveSummary
					report={liveReport}
					reportData={geoNarrative}
					pageSpeed={pageSpeed}
				/>

				<AuditTimelineSection
					report={liveReport}
					reportId={reportId}
					publicView={publicView}
				/>

				<AuditResultTabs
					geoLabel={t('tabs.geo')}
					onpageLabel={t('tabs.onpage')}
					activeTab={resultTab}
					onTabChange={handleResultTabChange}
					forceStack={publicView}
					geoContent={geoTab}
					onpageContent={onpageTab}
				/>

				<div className="print:hidden pdf-screen-only flex flex-col gap-4">
					<AuditCtaBox report={liveReport} auditId={reportId ?? null} />
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

			<footer className="audit-print-footer pdf-print-only pdf-page-item mt-8 border-t border-slate-300 pt-3 text-[10px] text-slate-600">
				<p>{t('printFooter')}</p>
			</footer>
		</div>
	);
}
