'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { PdfDownloadSpinner } from '@/components/audit/PdfDownloadSpinner';

const PdfGeneratingLoader = dynamic(
	() => import('@/components/audit/PdfGeneratingLoader').then((m) => m.PdfGeneratingLoader),
	{ ssr: false },
);
import { ReportShareLinkButton } from '@/components/audit/ReportShareLinkButton';
import {
	A4_CSS_PX,
	beginPdfLightPrint,
	clearPdfPreview,
	downloadPreviewPdf,
	markPdfPreviewSurfaceOpen,
	mountPdfPreviewPages,
	printPdfPreviewPages,
	teardownPdfSession,
	unmarkPdfPreviewSurfaceOpen,
	waitForMountedElement,
} from '@/lib/audit/print-pdf';
import { requestFullReportMount } from '@/lib/audit/scroll-to-category';

type PreviewState = 'normal' | 'maximized' | 'minimized';
type ZoomPreset = 50 | 75 | 100 | 'fit';

const ZOOM_PRESETS: ZoomPreset[] = [50, 75, 100, 'fit'];

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
	const scrollRef = useRef<HTMLDivElement>(null);
	const [pageCount, setPageCount] = useState(0);
	const [pagesReady, setPagesReady] = useState(false);
	const [loaderComplete, setLoaderComplete] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
	const [error, setError] = useState<string | null>(null);
	const [previewState, setPreviewState] = useState<PreviewState>('normal');
	const [restoreState, setRestoreState] = useState<'normal' | 'maximized'>('normal');
	const [zoomPreset, setZoomPreset] = useState<ZoomPreset>(100);
	const [fitZoom, setFitZoom] = useState(100);

	const apisReady = isPageSpeedLoaded && isGeoNarrativeLoaded;
	const isDataReady = pagesReady && loaderComplete;
	const showLoader = isOpen && !loaderComplete && !error;
	const isMinimized = previewState === 'minimized';
	const isMaximized = previewState === 'maximized';
	const effectiveZoom = zoomPreset === 'fit' ? fitZoom : zoomPreset;
	const zoomStyle = useMemo<CSSProperties>(
		() => (isMaximized ? { zoom: effectiveZoom / 100 } : {}),
		[isMaximized, effectiveZoom],
	);

	function minimizePreview() {
		setRestoreState(isMaximized ? 'maximized' : 'normal');
		setPreviewState('minimized');
	}

	function toggleMaximize() {
		setPreviewState((prev) => (prev === 'maximized' ? 'normal' : 'maximized'));
	}

	function restorePreview() {
		setPreviewState(restoreState);
	}

	useEffect(() => {
		if (!isOpen) {
			setPreviewState('normal');
			setZoomPreset(100);
		}
	}, [isOpen]);

	// `.pdf-preview-content` only has real, printable A4 sheets once the
	// build effect below finishes — see `printPdfPreviewPages()` in
	// `lib/audit/print-pdf.ts` for why this must track actual page
	// readiness rather than the modal's open/close state.
	useEffect(() => {
		if (isDataReady && !isMinimized) {
			markPdfPreviewSurfaceOpen();
		} else {
			unmarkPdfPreviewSurfaceOpen();
		}
		return () => unmarkPdfPreviewSurfaceOpen();
	}, [isDataReady, isMinimized]);

	useEffect(() => {
		if (!isMaximized || zoomPreset !== 'fit') return;
		const el = scrollRef.current;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const compute = () => {
			const available = el.clientWidth - 64;
			if (available <= 0) return;
			const ratio = (available / A4_CSS_PX.width) * 100;
			setFitZoom(Math.round(Math.max(30, Math.min(150, ratio))));
		};
		compute();
		const observer = new ResizeObserver(compute);
		observer.observe(el);
		return () => observer.disconnect();
	}, [isMaximized, zoomPreset]);

	const previewStateRef = useRef(previewState);
	const restoreStateRef = useRef(restoreState);
	useEffect(() => {
		previewStateRef.current = previewState;
	}, [previewState]);
	useEffect(() => {
		restoreStateRef.current = restoreState;
	}, [restoreState]);

	useEffect(() => {
		if (!isOpen) return;

		beginPdfLightPrint();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			if (previewStateRef.current === 'maximized') {
				setPreviewState('normal');
				return;
			}
			if (previewStateRef.current === 'minimized') {
				setPreviewState(restoreStateRef.current);
				return;
			}
			onClose();
		};
		const restoreAfterPrint = () => {
			beginPdfLightPrint();
		};
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('afterprint', restoreAfterPrint);

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('afterprint', restoreAfterPrint);
			teardownPdfSession(previewRef.current);
		};
	}, [isOpen, onClose]);

	// Release the background-scroll lock while minimized (floating capsule
	// only) so the underlying report stays interactive.
	useEffect(() => {
		if (!isOpen) return;
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = isMinimized ? '' : 'hidden';
		return () => {
			document.body.style.overflow = prevOverflow;
		};
	}, [isOpen, isMinimized]);

	useEffect(() => {
		if (!isOpen) {
			setPagesReady(false);
			setLoaderComplete(false);
			setPageCount(0);
			setError(null);
			return;
		}

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
				requestFullReportMount();
				const dest = await waitForMountedElement(() => previewRef.current, {
					isAborted: () => cancelled,
				});
				if (cancelled) return;
				if (!dest) {
					console.error('PDF Preview Error:', new Error('Preview destination is not mounted'));
					setError(t('error'));
					return;
				}
				const { pageCount: nextCount } = await mountPdfPreviewPages(dest, {
					isAborted: () => cancelled,
				});
				if (cancelled) return;
				setPageCount(nextCount);
				if (nextCount === 0) {
					setError(t('empty'));
					return;
				}
				setPagesReady(true);
			} catch (error) {
				console.error('PDF Preview Error:', error);
				if (!cancelled) setError(t('error'));
			}
		}

		void build();

		return () => {
			cancelled = true;
			clearPdfPreview(previewRef.current);
			setPagesReady(false);
		};
	}, [isOpen, apisReady, t, dataRevision]);

	useEffect(() => {
		return () => {
			teardownPdfSession(previewRef.current);
		};
	}, []);

	async function handleDownload() {
		// eslint-disable-next-line no-console -- intentional perf trace, see print-pdf.ts CAPTURE_TIMEOUT_MS
		console.log('>>> [PDF DOWNLOAD TRIGGERED] 함수 시작 (PDFPreviewModal.handleDownload)');
		console.time('PDF_TOTAL_TIME');
		const dest = previewRef.current;
		if (!dest?.isConnected || downloading || !isDataReady) {
			console.error('PDF Generation Detailed Error:', new Error('Capture target is not mounted'));
			setError(t('downloadError'));
			console.timeEnd('PDF_TOTAL_TIME');
			return;
		}
		setDownloading(true);
		setDownloadProgress({ current: 0, total: pageCount });
		setError(null);
		// `zoom` scales layout, which html2canvas does not reliably account
		// for — pin the preview to 100% for the duration of the capture so
		// every page is measured/rasterized at its real 794×1123 A4 size.
		const zoomBeforeCapture = zoomPreset;
		const needsZoomReset = isMaximized && zoomBeforeCapture !== 100;
		if (needsZoomReset) {
			setZoomPreset(100);
			await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
		}
		try {
			await downloadPreviewPdf(dest, {
				onProgress: (current, total) => {
					setDownloadProgress({ current, total });
				},
			});
		} catch (error) {
			console.error('PDF Generation Detailed Error:', error);
			setError(t('downloadError'));
		} finally {
			setDownloading(false);
			setDownloadProgress({ current: 0, total: 0 });
			if (needsZoomReset) setZoomPreset(zoomBeforeCapture);
			console.timeEnd('PDF_TOTAL_TIME');
		}
	}

	function handleSystemPrint() {
		printPdfPreviewPages();
	}

	if (!isOpen || typeof document === 'undefined') return null;

	const containerClassName = isMinimized
		? 'report-preview-modal pdf-preview-root fixed bottom-6 right-6 z-50 flex w-auto items-center transition-all duration-300 ease-out'
		: isMaximized
			? 'report-preview-modal pdf-preview-root animate-fadeIn fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-900/90 p-4 transition-all duration-300 ease-out'
			: `report-preview-modal pdf-preview-root animate-fadeIn fixed inset-0 z-[9999] flex h-screen w-screen flex-col bg-slate-900/95 transition-all duration-300 ease-out ${
					isDataReady ? 'overflow-y-auto' : 'overflow-hidden'
				}`;

	return createPortal(
		<div
			className={containerClassName}
			role="dialog"
			aria-modal="true"
			aria-busy={showLoader || downloading}
			aria-labelledby="pdf-preview-modal-title"
		>
			{isMinimized ? (
				<button
					type="button"
					onClick={restorePreview}
					className="pdf-preview-capsule flex items-center gap-2.5 rounded-full border border-white/10 bg-slate-900 py-2.5 pl-4 pr-3 text-sm font-bold text-white shadow-2xl shadow-black/40 transition hover:bg-slate-800"
				>
					<span aria-hidden>📄</span>
					<span className="max-w-[13rem] truncate">
						{t('minimizedLabel')}
						{pageCount > 0 ? ` (${pageCount}P)` : ''}
					</span>
					<span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-extrabold text-cyan-300">
						{t('minimizedOpen')}
					</span>
				</button>
			) : (
				<>
					<header className="preview-toolbar pdf-preview-chrome sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-900 px-4 py-3 sm:px-6">
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
						<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
							{isMaximized ? (
								<div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
									{ZOOM_PRESETS.map((preset) => (
										<button
											key={preset}
											type="button"
											onClick={() => setZoomPreset(preset)}
											className={`rounded-md px-2 py-1 text-xs font-bold transition ${
												zoomPreset === preset
													? 'bg-cyan-500 text-white'
													: 'text-slate-300 hover:bg-white/10 hover:text-white'
											}`}
										>
											{preset === 'fit' ? t('zoomFit') : `${preset}%`}
										</button>
									))}
								</div>
							) : null}
							{shareUrl ? (
								<ReportShareLinkButton shareUrl={shareUrl} variant="preview" />
							) : null}
							<button
								type="button"
								onClick={handleSystemPrint}
								className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20"
							>
								{t('print')}
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
							<span className="mx-0.5 h-6 w-px shrink-0 bg-white/10" aria-hidden />
							<button
								type="button"
								onClick={minimizePreview}
								aria-label={t('minimize')}
								title={t('minimize')}
								className="rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
							>
								<Minus className="h-4 w-4" aria-hidden />
							</button>
							<button
								type="button"
								onClick={toggleMaximize}
								aria-label={isMaximized ? t('restore') : t('maximize')}
								title={isMaximized ? t('restore') : t('maximize')}
								className="rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
							>
								{isMaximized ? (
									<Minimize2 className="h-4 w-4" aria-hidden />
								) : (
									<Maximize2 className="h-4 w-4" aria-hidden />
								)}
							</button>
							<button
								type="button"
								onClick={onClose}
								aria-label={t('close')}
								title={t('close')}
								className="rounded-lg border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20"
							>
								<X className="h-4 w-4" aria-hidden />
							</button>
						</div>
					</header>

					<div
						ref={scrollRef}
						className={`pdf-preview-scroll relative bg-slate-900 ${
							isMaximized ? 'flex-1 overflow-y-auto' : 'min-h-[calc(100vh-4.5rem)]'
						}`}
					>
						{downloading ? (
							<PdfDownloadSpinner
								label={t('saving')}
								hint={t('savingHint')}
								currentPage={downloadProgress.current}
								totalPages={downloadProgress.total}
								progressLabel={
									downloadProgress.total > 0
										? t('savingProgress', {
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
									key={`pdf-loader-${dataRevision}`}
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
							className="pdf-preview-zoom-wrapper mx-auto w-full transition-[zoom] duration-150"
							style={zoomStyle}
						>
							<div
								id="print-report-container"
								key={`pdf-preview-${dataRevision}`}
								ref={previewRef}
								aria-hidden={!isDataReady}
								className={`print-report-container pdf-preview-content mx-auto flex w-full flex-col items-center gap-8 px-4 py-8 text-slate-900 transition-opacity duration-300 sm:px-8 ${
									isDataReady ? 'opacity-100' : 'pointer-events-none opacity-0'
								}`}
							/>
						</div>
					</div>
				</>
			)}
		</div>,
		document.body,
	);
}













