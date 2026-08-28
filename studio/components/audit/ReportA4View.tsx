'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { PdfDownloadSpinner } from '@/components/audit/PdfDownloadSpinner';

const PdfGeneratingLoader = dynamic(
	() => import('@/components/audit/PdfGeneratingLoader').then((m) => m.PdfGeneratingLoader),
	{ ssr: false },
);
import { ReportShareLinkButton } from '@/components/audit/ReportShareLinkButton';
import { AuditReportDocument } from '@/components/audit/AuditReportDocument';
import { DEFAULT_AUDIT_RESULT_TAB, type AuditResultTabId } from '@/components/audit/AuditResultTabs';
import {
	beginPdfLightPrint,
	clearPdfPreview,
	downloadPreviewPdf,
	endPdfLightPrint,
	markPdfPreviewSurfaceOpen,
	mountPdfPreviewPages,
	printPdfPreviewPages,
	unmarkPdfPreviewSurfaceOpen,
	waitForMountedElement,
} from '@/lib/audit/print-pdf';
import { buildPublicReportUrl } from '@/lib/audit/report-url';
import { useAuditPayload, useEvaluationReport } from '@/components/audit/AuditPayloadProvider';
import { useAuditReportEnrichment } from '@/lib/audit/use-audit-report-enrichment';
import type { AuditReport } from '@/lib/site-auditor';

interface ReportA4ViewProps {
	reportId: string;
	report: AuditReport;
}

/**
 * Public share viewer — dark desk + centered A4 sheets (screen 3),
 * not the interactive dashboard (screen 2).
 */
export function ReportA4View({ reportId, report }: ReportA4ViewProps) {
	const t = useTranslations('audit');
	const previewRef = useRef<HTMLDivElement>(null);
	const [resultTab, setResultTab] = useState<AuditResultTabId>(DEFAULT_AUDIT_RESULT_TAB);
	const [shareUrl, setShareUrl] = useState('');
	const [pageCount, setPageCount] = useState(0);
	const [pagesReady, setPagesReady] = useState(false);
	const [loaderComplete, setLoaderComplete] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
	const [error, setError] = useState<string | null>(null);
	const isReady = pagesReady && loaderComplete;
	const liveReport = useEvaluationReport(report);
	const { prescriptionRevision, appliedResult } = useAuditPayload();
	const previewBindKey = `pdf-${reportId}-${appliedResult?.viewMode ?? (liveReport.isPrescriptionApplied ? 'after' : 'before')}-${liveReport.score}-${liveReport.prescriptionAppliedAt ?? '0'}-${prescriptionRevision}`;
	const {
		geoNarrative,
		geoNarrativeLoading,
		pageSpeed,
		pageSpeedDesktop,
		pageSpeedMobile,
		pageSpeedLoading,
		pageSpeedError,
		psiStrategy,
		setPsiStrategy,
	} = useAuditReportEnrichment(report);

	const apisReady = !pageSpeedLoading && !geoNarrativeLoading;
	const showLoader = !loaderComplete && !error;

	useEffect(() => {
		document.documentElement.classList.add('public-web-report');
		beginPdfLightPrint();
		return () => {
			document.documentElement.classList.remove('public-web-report');
			endPdfLightPrint();
		};
	}, []);

	useEffect(() => {
		setShareUrl(buildPublicReportUrl(reportId));
	}, [reportId]);

	// `.pdf-preview-content` only has real, printable A4 sheets once the
	// build effect below finishes — see `printPdfPreviewPages()` in
	// `lib/audit/print-pdf.ts` for why this must track actual page
	// readiness (not just component mount).
	useEffect(() => {
		if (isReady) {
			markPdfPreviewSurfaceOpen();
		} else {
			unmarkPdfPreviewSurfaceOpen();
		}
		return () => unmarkPdfPreviewSurfaceOpen();
	}, [isReady]);

	useEffect(() => {
		if (!apisReady) {
			setPagesReady(false);
			setLoaderComplete(false);
			setPageCount(0);
			setError(null);
			return;
		}

		let cancelled = false;

		async function build() {
			setPagesReady(false);
			setLoaderComplete(false);
			setError(null);
			setPageCount(0);
			try {
				const dest = await waitForMountedElement(() => previewRef.current, {
					isAborted: () => cancelled,
				});
				if (cancelled) return;
				if (!dest) {
					console.error('PDF Preview Error:', new Error('Preview destination is not mounted'));
					setError(t('pdfPreview.error'));
					return;
				}
				const { pageCount: nextCount } = await mountPdfPreviewPages(dest, {
					isAborted: () => cancelled,
				});
				if (cancelled) return;
				setPageCount(nextCount);
				if (nextCount === 0) {
					setError(t('pdfPreview.empty'));
					return;
				}
				setPagesReady(true);
			} catch (error) {
				console.error('PDF Preview Error:', error);
				if (!cancelled) setError(t('pdfPreview.error'));
			}
		}

		void build();

		return () => {
			cancelled = true;
			clearPdfPreview(previewRef.current);
			setPagesReady(false);
		};
	}, [apisReady, t, previewBindKey]);

	async function handleDownload() {
		// eslint-disable-next-line no-console -- intentional perf trace, see print-pdf.ts CAPTURE_TIMEOUT_MS
		console.log('>>> [PDF DOWNLOAD TRIGGERED] 함수 시작 (ReportA4View.handleDownload)');
		console.time('PDF_TOTAL_TIME');
		const dest = previewRef.current;
		if (!dest?.isConnected || downloading || !isReady) {
			console.error('PDF Generation Detailed Error:', new Error('Capture target is not mounted'));
			setError(t('pdfPreview.downloadError'));
			console.timeEnd('PDF_TOTAL_TIME');
			return;
		}
		setDownloading(true);
		setDownloadProgress({ current: 0, total: pageCount });
		setError(null);
		try {
			await downloadPreviewPdf(dest, {
				onProgress: (current, total) => {
					setDownloadProgress({ current, total });
				},
			});
		} catch (error) {
			console.error('PDF Generation Detailed Error:', error);
			setError(t('pdfPreview.downloadError'));
		} finally {
			setDownloading(false);
			setDownloadProgress({ current: 0, total: 0 });
			console.timeEnd('PDF_TOTAL_TIME');
		}
	}

	return (
		<div className="report-a4-view pdf-preview-root relative min-h-screen min-h-dvh overflow-x-hidden bg-slate-900 text-white">
			<div
				className="pdf-preview-measure-host"
				style={{ position: 'fixed', width: 794, left: -10000, top: 0 }}
				aria-hidden
			>
				<AuditReportDocument
					report={report}
					reportId={reportId}
					geoNarrative={geoNarrative}
					geoNarrativeLoading={geoNarrativeLoading}
					pageSpeed={pageSpeed}
					pageSpeedDesktop={pageSpeedDesktop}
					pageSpeedMobile={pageSpeedMobile}
					pageSpeedLoading={pageSpeedLoading}
					pageSpeedError={pageSpeedError}
					psiStrategy={psiStrategy}
					onPsiStrategyChange={setPsiStrategy}
					resultTab={resultTab}
					onResultTabChange={setResultTab}
					onOpenPdfPreview={() => undefined}
					publicView
				/>
			</div>

			<header className="pdf-preview-chrome sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 sm:px-6">
				<div className="min-w-0">
					<h1 className="m-0 truncate text-sm font-extrabold tracking-tight text-white sm:text-base">
						{t('share.a4Title')}
					</h1>
					{isReady && pageCount > 0 ? (
						<p className="mt-0.5 text-[11px] font-medium text-slate-400">
							{t('pdfPreview.pageLabel', { total: pageCount })}
						</p>
					) : null}
				</div>
				<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
					<ReportShareLinkButton shareUrl={shareUrl} variant="preview" />
					<button
						type="button"
						onClick={() => printPdfPreviewPages()}
						className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-white/20"
					>
						<span aria-hidden>🖨</span>
						<span>{t('pdfPreview.print')}</span>
					</button>
					<button
						type="button"
						onClick={() => void handleDownload()}
						disabled={downloading || !isReady || pageCount === 0}
						className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-500 px-3.5 py-2 text-sm font-extrabold text-white shadow-lg shadow-indigo-950/40 transition hover:from-cyan-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<span aria-hidden>📄</span>
						<span>{downloading ? t('pdfPreview.saving') : t('share.pdfDownload')}</span>
					</button>
					<Link
						href="/"
						className="rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-white/20"
					>
						{t('backToHome')}
					</Link>
				</div>
			</header>

			<div className="pdf-preview-scroll relative min-h-[calc(100vh-4.5rem)] bg-slate-900">
				{downloading ? (
					<PdfDownloadSpinner
						label={t('pdfPreview.saving')}
						hint={t('pdfPreview.savingHint')}
						currentPage={downloadProgress.current}
						totalPages={downloadProgress.total}
						progressLabel={
							downloadProgress.total > 0
								? t('pdfPreview.savingProgress', {
										current: downloadProgress.current,
										total: downloadProgress.total,
									})
								: undefined
						}
					/>
				) : null}
				{showLoader ? (
					<div className="pdf-preview-chrome fixed inset-x-0 bottom-0 top-[57px] z-10">
						<PdfGeneratingLoader
							key={`pdf-loader-${previewBindKey}`}
							isReady={pagesReady}
							onComplete={() => setLoaderComplete(true)}
						/>
					</div>
				) : null}
				{error ? (
					<p className="pdf-preview-chrome mx-auto mt-4 max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
						{error}
					</p>
				) : null}
				<div
					id="print-report-container"
					key={`pdf-preview-${previewBindKey}`}
					ref={previewRef}
					aria-hidden={!isReady}
					className={`print-report-container pdf-preview-content mx-auto flex w-full flex-col items-center gap-8 px-4 py-8 text-slate-900 transition-opacity duration-300 sm:px-8 ${
						isReady ? 'opacity-100' : 'pointer-events-none opacity-0'
					}`}
				/>
			</div>
		</div>
	);
}
