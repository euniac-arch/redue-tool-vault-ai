'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ReportShareLinkButton } from '@/components/audit/ReportShareLinkButton';
import type { AuditResultTabId } from '@/components/audit/AuditResultTabs';
import {
	beginPdfLightPrint,
	clearPdfPreview,
	downloadPreviewPdf,
	endPdfLightPrint,
	mountPdfPreviewPages,
	waitForPdfAssets,
} from '@/lib/audit/print-pdf';
import { buildPublicReportUrl } from '@/lib/audit/report-url';
import { useAuditPayload, useEvaluationReport } from '@/components/audit/AuditPayloadProvider';
import { useAuditReportEnrichment } from '@/lib/audit/use-audit-report-enrichment';
import type { AuditReport } from '@/lib/site-auditor';

const AuditReportDocument = dynamic(
	() => import('@/components/audit/AuditReportDocument').then((mod) => mod.AuditReportDocument),
	{ ssr: false },
);

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
	const [resultTab, setResultTab] = useState<AuditResultTabId>('geo');
	const [shareUrl, setShareUrl] = useState('');
	const [pageCount, setPageCount] = useState(0);
	const [isReady, setIsReady] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);
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
	const showSpinner = !isReady && !error;

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

	useEffect(() => {
		if (!apisReady) {
			setIsReady(false);
			setPageCount(0);
			setError(null);
			return;
		}

		let cancelled = false;

		async function build() {
			setIsReady(false);
			setError(null);
			setPageCount(0);
			try {
				await waitForPdfAssets(document.getElementById('pdf-print-area'), () => cancelled);
				if (cancelled) return;
				const dest = previewRef.current;
				if (!dest) return;
				const { pageCount: nextCount } = await mountPdfPreviewPages(dest, {
					isAborted: () => cancelled,
				});
				if (cancelled) return;
				await waitForPdfAssets(dest, () => cancelled);
				if (cancelled) return;
				setPageCount(nextCount);
				if (nextCount === 0) {
					setError(t('pdfPreview.empty'));
					return;
				}
				setIsReady(true);
			} catch {
				if (!cancelled) setError(t('pdfPreview.error'));
			}
		}

		void build();

		return () => {
			cancelled = true;
			clearPdfPreview(previewRef.current);
			setIsReady(false);
		};
	}, [apisReady, t, previewBindKey]);

	async function handleDownload() {
		const dest = previewRef.current;
		if (!dest || downloading || !isReady) return;
		setDownloading(true);
		setError(null);
		try {
			await downloadPreviewPdf(dest);
		} catch {
			setError(t('pdfPreview.error'));
		} finally {
			setDownloading(false);
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
				{showSpinner ? (
					<div
						className="pdf-preview-chrome fixed inset-x-0 bottom-0 top-[57px] z-10 flex flex-col items-center justify-center gap-4 bg-slate-900 px-6 text-center"
						role="status"
						aria-live="polite"
					>
						<Loader2 className="h-10 w-10 animate-spin text-cyan-400" aria-hidden />
						<p className="text-base font-extrabold tracking-tight text-white sm:text-lg">
							{t('pdfPreview.syncing')}
						</p>
						<p className="max-w-md text-xs font-medium text-slate-400">
							{t('pdfPreview.syncingHint')}
						</p>
					</div>
				) : null}
				{error ? (
					<p className="pdf-preview-chrome mx-auto mt-4 max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
						{error}
					</p>
				) : null}
				<div
					key={`pdf-preview-${previewBindKey}`}
					ref={previewRef}
					aria-hidden={!isReady}
					className={`pdf-preview-content mx-auto flex w-full flex-col items-center gap-8 px-4 py-8 text-slate-900 sm:px-8 ${
						isReady ? '' : 'pointer-events-none opacity-0'
					}`}
				/>
			</div>
		</div>
	);
}
