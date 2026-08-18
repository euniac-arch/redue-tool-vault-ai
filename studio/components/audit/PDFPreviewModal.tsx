'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ReportShareLinkButton } from '@/components/audit/ReportShareLinkButton';
import {
	beginPdfLightPrint,
	clearPdfPreview,
	downloadPreviewPdf,
	endPdfLightPrint,
	mountPdfPreviewPages,
	waitForPdfAssets,
} from '@/lib/audit/print-pdf';
import { requestFullReportMount } from '@/lib/audit/scroll-to-category';

interface PDFPreviewModalProps {
	isOpen: boolean;
	onClose: () => void;
	/** PageSpeed Insights snapshot has settled (success or error). */
	isPageSpeedLoaded?: boolean;
	/** GEO narrative / AI simulation payload has settled. */
	isGeoNarrativeLoaded?: boolean;
	shareUrl?: string;
	/** After-state / Before-After toggle — remount preview from live `#pdf-print-area`. */
	dataRevision?: number | string;
}

export function PDFPreviewModal({
	isOpen,
	onClose,
	isPageSpeedLoaded = true,
	isGeoNarrativeLoaded = true,
	shareUrl,
	dataRevision = 0,
}: PDFPreviewModalProps) {
	const t = useTranslations('audit.pdfPreview');
	const previewRef = useRef<HTMLDivElement>(null);
	const [pageCount, setPageCount] = useState(0);
	const [isDataReady, setIsDataReady] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const apisReady = isPageSpeedLoaded && isGeoNarrativeLoaded;
	const showSpinner = isOpen && !isDataReady && !error;

	useEffect(() => {
		if (!isOpen) return;

		beginPdfLightPrint();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		const restoreAfterPrint = () => {
			beginPdfLightPrint();
			document.body.style.overflow = 'hidden';
		};
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('afterprint', restoreAfterPrint);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('afterprint', restoreAfterPrint);
			document.body.style.overflow = prevOverflow;
			endPdfLightPrint();
		};
	}, [isOpen, onClose]);

	useEffect(() => {
		if (!isOpen) {
			setIsDataReady(false);
			setPageCount(0);
			setError(null);
			return;
		}

		if (!apisReady) {
			setIsDataReady(false);
			setPageCount(0);
			setError(null);
			return;
		}

		let cancelled = false;

		async function build() {
			setIsDataReady(false);
			setError(null);
			setPageCount(0);
			try {
				requestFullReportMount();
				await new Promise<void>((resolve) => {
					window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
				});
				await new Promise<void>((resolve) => {
					window.setTimeout(resolve, 80);
				});
				if (cancelled) return;
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
					setError(t('empty'));
					return;
				}
				setIsDataReady(true);
			} catch {
				if (!cancelled) setError(t('error'));
			}
		}

		void build();

		return () => {
			cancelled = true;
			clearPdfPreview(previewRef.current);
			setIsDataReady(false);
		};
	}, [isOpen, apisReady, t, dataRevision]);

	async function handleDownload() {
		const dest = previewRef.current;
		if (!dest || downloading || !isDataReady) return;
		setDownloading(true);
		setError(null);
		try {
			await downloadPreviewPdf(dest);
		} catch {
			setError(t('error'));
		} finally {
			setDownloading(false);
		}
	}

	if (!isOpen) return null;

	return (
		<div
			className={`report-preview-modal pdf-preview-root animate-fadeIn fixed inset-0 z-[9999] h-screen w-screen bg-slate-900/95 ${
				isDataReady ? 'overflow-y-auto' : 'overflow-hidden'
			}`}
			role="dialog"
			aria-modal="true"
			aria-busy={showSpinner || downloading}
			aria-labelledby="pdf-preview-modal-title"
		>
			<header className="pdf-preview-chrome sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 sm:px-6">
				<div className="min-w-0">
					<h2
						id="pdf-preview-modal-title"
						className="m-0 truncate text-sm font-extrabold tracking-tight text-white sm:text-base"
					>
						{t('title')}
					</h2>
					{isDataReady && pageCount > 0 ? (
						<p className="mt-0.5 text-[11px] font-medium text-slate-400">
							{t('pageLabel', { total: pageCount })}
						</p>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{shareUrl ? (
						<ReportShareLinkButton shareUrl={shareUrl} variant="preview" />
					) : null}
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20"
					>
						{t('close')}
					</button>
					{isDataReady ? (
						<button
							type="button"
							onClick={() => void handleDownload()}
							disabled={downloading || pageCount === 0}
							className="rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-500 px-3.5 py-2 text-sm font-extrabold text-white shadow-lg shadow-indigo-950/40 transition hover:from-cyan-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{downloading ? t('saving') : t('download')}
						</button>
					) : null}
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
							{t('syncing')}
						</p>
						<p className="max-w-md text-xs font-medium text-slate-400">{t('syncingHint')}</p>
					</div>
				) : null}
				{error ? (
					<p className="pdf-preview-chrome mx-auto mt-4 max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
						{error}
					</p>
				) : null}
				<div
					key={`pdf-preview-${dataRevision}`}
					ref={previewRef}
					aria-hidden={!isDataReady}
					className={`pdf-preview-content mx-auto flex w-full flex-col items-center gap-8 px-4 py-8 text-slate-900 sm:px-8 ${
						isDataReady ? '' : 'pointer-events-none opacity-0'
					}`}
				/>
			</div>
		</div>
	);
}
