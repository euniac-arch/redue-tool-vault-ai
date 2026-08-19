'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AuditLoading } from '@/components/AuditLoading';
import { AuditResultLoader } from '@/components/audit/AuditResultLoader';
import { AuditScrollspyNav } from '@/components/AuditScrollspyNav';
import { AuditShareBar } from '@/components/AuditShareBar';
import { type AuditResultTabId } from '@/components/audit/AuditResultTabs';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import {
	getGuestAuditById,
	notifyAuditHistorySync,
	removeGuestAudit,
	scanSiteOnce,
	upsertGuestAuditOnRescan,
} from '@/lib/audit-history-storage';
import { persistReportTrackingSnapshot } from '@/lib/audit/domain-tracking';
import { markImportedCrawlRecordDiagnosed } from '@/lib/crawling/transfer-queue';
import type { TargetDiagnoseResponse } from '@/lib/crawling/types';
import { OPEN_GEO_ANSWER_CENTER_EVENT } from '@/lib/audit/exec-brief';
import { ensureExecutiveSummary } from '@/lib/audit/executive-summary';
import { fetchAuditById, peekCachedAudit, rememberAudit } from '@/lib/audit/report-client-cache';
import { buildPublicReportUrl, siteLabelFromUrl } from '@/lib/audit/report-url';
import { requestFullReportMount } from '@/lib/audit/scroll-to-category';
import { useAuditReportEnrichment } from '@/lib/audit/use-audit-report-enrichment';
import type { AuditReport } from '@/lib/site-auditor';

const AuditReportDocument = dynamic(
	() => import('@/components/audit/AuditReportDocument').then((mod) => mod.AuditReportDocument),
	{
		ssr: false,
		loading: () => <AuditResultLoader variant="compose" />,
	},
);

const EmailPreviewModal = dynamic(
	() => import('@/components/EmailPreviewModal').then((mod) => mod.EmailPreviewModal),
	{ ssr: false },
);

const ExecBriefModal = dynamic(
	() => import('@/components/audit/ExecBriefOverlay').then((mod) => mod.ExecBriefModal),
	{ ssr: false },
);

const PDFPreviewModal = dynamic(
	() => import('@/components/audit/PDFPreviewModal').then((mod) => mod.PDFPreviewModal),
	{ ssr: false },
);

function resolveScanUrl(url: string, domainParam: string): string {
	if (url) return url;
	if (!domainParam) return '';
	return /^https?:\/\//i.test(domainParam) ? domainParam : `https://${domainParam}`;
}

function AuditResultFallback() {
	return (
		<main className="audit-report-page relative">
			<div className="audit-report-scale">
				<AuditResultLoader variant="hydrate" />
			</div>
		</main>
	);
}

export default function AuditResultPage() {
	return (
		<Suspense fallback={<AuditResultFallback />}>
			<AuditResultContent />
		</Suspense>
	);
}

function AuditResultContent() {
	const t = useTranslations('audit');
	const locale = useLocale();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { persistAudit, evaluationResult, prescriptionRevision, appliedResult } = useAuditPayload();
	const auditId = searchParams.get('id')?.trim() || '';
	const url = searchParams.get('url')?.trim() || '';
	const domainParam = searchParams.get('domain')?.trim() || '';
	const targetIdParam = searchParams.get('target_id')?.trim() || '';
	const forceRefreshParam = searchParams.get('forceRefresh');
	const forceRefresh =
		forceRefreshParam === '1' ||
		forceRefreshParam === 'true' ||
		searchParams.get('force') === '1';
	const replaceId = searchParams.get('replaceId')?.trim() || auditId || '';
	const cacheBustT = searchParams.get('t')?.trim() || '';
	const scanUrl = resolveScanUrl(url, domainParam);
	/** New / re-scan plays the terminal. History [결과보기] is `?id=` only. */
	const isLiveAnalysis = Boolean(scanUrl) || forceRefresh;

	const [report, setReport] = useState<AuditReport | null>(null);
	const [resolvedId, setResolvedId] = useState<string | null>(auditId || null);
	const [isLoading, setIsLoading] = useState(true);
	const [isFetching, setIsFetching] = useState(true);
	const [isAnalyzing, setIsAnalyzing] = useState(isLiveAnalysis);
	const [isDataReady, setIsDataReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [deletedOrMissing, setDeletedOrMissing] = useState(false);
	const [emailOpen, setEmailOpen] = useState(false);
	const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
	const [execBriefOpen, setExecBriefOpen] = useState(false);
	const [resultTab, setResultTab] = useState<AuditResultTabId>('geo');
	/** Keeps admin-list `target_id` across `?url=` to `?id=` replacement. */
	const targetIdRef = useRef(targetIdParam);
	const diagnosisSavedRef = useRef(false);
	const [targetPersisted, setTargetPersisted] = useState(false);
	/** True after this session completed a live recrawl (same-URL forceRefresh). */
	const [justRefreshed, setJustRefreshed] = useState(false);
	if (targetIdParam) targetIdRef.current = targetIdParam;

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

	/** Prevents a second loading flash when we replace ?url= with ?id= after animation. */
	const holdRevealRef = useRef(false);
	/** Content shell for scrollspy side-rail pinning (xl+). */
	const contentShellRef = useRef<HTMLElement | null>(null);

	async function persistAdminTargetDiagnosis(nextReport: AuditReport, auditLeadId?: string | null) {
		const targetId = targetIdRef.current;
		if (!targetId && !domainParam) return;
		if (diagnosisSavedRef.current) return;
		diagnosisSavedRef.current = true;
		try {
			const pathId = targetId || 'by-domain';
			const res = await fetch(`/api/crawling/targets/${encodeURIComponent(pathId)}/diagnose`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: targetId || undefined,
					target_id: targetId || undefined,
					url: nextReport.url,
					domain: domainParam || undefined,
					report: nextReport,
					auditId: auditLeadId || undefined,
				}),
			});
			const json = (await res.json()) as TargetDiagnoseResponse;
			if (!res.ok || !('data' in json) || !json.data) {
				diagnosisSavedRef.current = false;
				return;
			}
			markImportedCrawlRecordDiagnosed({
				targetSiteId: json.data.id,
				url: nextReport.url,
				auditLeadId: json.data.audit_lead_id || auditLeadId,
				seoScore: nextReport.score,
			});
			setTargetPersisted(true);
		} catch {
			diagnosisSavedRef.current = false;
		}
	}

	useEffect(() => {
		let cancelled = false;

		// After the step animation finishes we replace the URL with the audit id.
		// Skip remounting the loader if we already hold that report in memory.
		if (auditId && holdRevealRef.current && report && resolvedId === auditId && !forceRefresh) {
			holdRevealRef.current = false;
			setIsAnalyzing(false);
			setIsLoading(false);
			setIsFetching(false);
			setIsDataReady(true);
			return;
		}

		async function loadById(id: string) {
			// Prefer server so admin hard-deletes are not masked by guest localStorage.
			const result = await fetchAuditById(id, { force: true });

			if ('report' in result) {
				if (!cancelled) {
					const nextReport = ensureExecutiveSummary(result.report);
					setReport(nextReport);
					setResolvedId(result.id);
					setIsDataReady(true);
					setIsAnalyzing(false);
					setIsLoading(false);
					setIsFetching(false);
					setJustRefreshed(false);
					persistReportTrackingSnapshot(result.id, nextReport);
					persistAudit(nextReport, { auditId: result.id, cmsType: nextReport.cmsType });
				}
				return;
			}

			if (result.status === 404) {
				const guest = getGuestAuditById(id);
				if (guest?.report && !forceRefresh) {
					if (!cancelled) {
						const nextReport = ensureExecutiveSummary(guest.report);
						rememberAudit(id, nextReport);
						setReport(nextReport);
						setResolvedId(id);
						setIsDataReady(true);
						setIsAnalyzing(false);
						setIsLoading(false);
						setIsFetching(false);
						persistReportTrackingSnapshot(id, nextReport);
						persistAudit(nextReport, { auditId: id, cmsType: nextReport.cmsType });
					}
					return;
				}
				removeGuestAudit(id);
				if (!cancelled) {
					setReport(null);
					setDeletedOrMissing(true);
					setError(
						result.error || t('deletedOrMissing'),
					);
					setIsAnalyzing(false);
					setIsLoading(false);
					setIsFetching(false);
					setIsDataReady(false);
				}
				return;
			}

			// Transient API failure: fall back to guest cache only when the server is unreachable.
			// Never use guest cache when this load is a forceRefresh re-audit.
			if (!forceRefresh) {
				const cached = getGuestAuditById(id);
				if (cached) {
					if (!cancelled) {
						const nextReport = ensureExecutiveSummary(cached.report);
						setReport(nextReport);
						setResolvedId(id);
						setIsDataReady(true);
						setIsAnalyzing(false);
						setIsLoading(false);
						setIsFetching(false);
						persistReportTrackingSnapshot(id, nextReport);
						persistAudit(nextReport, { auditId: id, cmsType: nextReport.cmsType });
					}
					return;
				}
			}

			throw new Error(result.error || t('failedTitle'));
		}

		async function runScan(targetUrl: string, opts?: { forceRefresh?: boolean; replaceId?: string }) {
			const data = await scanSiteOnce(targetUrl, locale, {
				forceRefresh: true,
				replaceId: opts?.replaceId,
			});
			const { id, ...rest } = data;
			const nextReport = ensureExecutiveSummary(rest as AuditReport);

			if (!cancelled) {
				if (id) {
					rememberAudit(id, nextReport);
					const entry = upsertGuestAuditOnRescan(id, nextReport, { replaceId: opts?.replaceId });
					persistReportTrackingSnapshot(id, nextReport);
					notifyAuditHistorySync({
						ids: [id, opts?.replaceId || ''].filter(Boolean),
						entry,
					});
				}
				setReport(nextReport);
				setResolvedId(id ?? null);
				setIsDataReady(true);
				setJustRefreshed(true);
				diagnosisSavedRef.current = false;
				// Context cache; durable store is Firestore audit_projects (scan API returns doc id)
				persistAudit(nextReport, { auditId: id ?? null, cmsType: nextReport.cmsType });
				void persistAdminTargetDiagnosis(nextReport, id ?? null);
				// Keep loading UI up until AuditLoading finishes 6/6.
			}
		}

		(async () => {
			setError(null);
			setDeletedOrMissing(false);

			try {
				const liveRescan = Boolean(scanUrl) || forceRefresh;
				if (liveRescan && (scanUrl || auditId)) {
					setIsAnalyzing(true);
					setIsLoading(true);
					setIsFetching(true);
					setIsDataReady(false);
					setReport(null);
					setJustRefreshed(false);

					let targetUrl = scanUrl;
					if (!targetUrl && auditId) {
						const cached = getGuestAuditById(auditId);
						targetUrl = cached?.url || '';
						if (!targetUrl) {
							const saved = await fetchAuditById(auditId);
							targetUrl = 'report' in saved ? saved.report.url : '';
						}
					}
					if (!targetUrl) {
						setIsAnalyzing(false);
						setIsLoading(false);
						setIsFetching(false);
						setError(t('noUrl'));
						return;
					}
					await runScan(targetUrl, { forceRefresh: true, replaceId: replaceId || undefined });
				} else if (auditId) {
					// Stored result: never run the scan terminal — bind cache, then confirm from DB.
					setIsAnalyzing(false);
					setJustRefreshed(false);
					setIsLoading(true);
					setIsFetching(true);
					const cached = peekCachedAudit(auditId) ?? getGuestAuditById(auditId);
					if (cached?.report) {
						const nextReport = ensureExecutiveSummary(cached.report);
						rememberAudit(auditId, nextReport);
						setReport(nextReport);
						setResolvedId(auditId);
						setIsDataReady(true);
						setIsLoading(false);
						setIsFetching(false);
						persistReportTrackingSnapshot(auditId, nextReport);
						persistAudit(nextReport, { auditId, cmsType: nextReport.cmsType });
					} else {
						setIsLoading(true);
						setIsFetching(true);
						setIsDataReady(false);
						setReport(null);
					}
					await loadById(auditId);
				} else {
					setIsAnalyzing(false);
					setIsLoading(false);
					setIsFetching(false);
					setError(t('noUrl'));
				}
			} catch (err) {
				if (!cancelled) {
					setError((err as Error).message);
					setIsAnalyzing(false);
					setIsLoading(false);
					setIsFetching(false);
					setIsDataReady(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- scan once per identity / forceRefresh token
	}, [auditId, scanUrl, locale, forceRefresh, replaceId, cacheBustT]);

	// Deleted / missing audit: show notice, then send the user to /audit.
	useEffect(() => {
		if (!deletedOrMissing) return;
		const timer = window.setTimeout(() => {
			router.replace('/audit');
		}, 2200);
		return () => window.clearTimeout(timer);
	}, [deletedOrMissing, router]);

	const handleLoadingComplete = useCallback(() => {
		setIsAnalyzing(false);
		setIsLoading(false);
		setIsFetching(false);
		if (resolvedId) {
			holdRevealRef.current = true;
			const params = new URLSearchParams();
			params.set('id', resolvedId);
			if (targetIdRef.current) params.set('target_id', targetIdRef.current);
			router.replace(`/audit/result?${params.toString()}`);
		}
	}, [resolvedId, router]);

	const displayReport = useMemo(
		() =>
			report && evaluationResult && evaluationResult.url === report.url ? evaluationResult : report,
		[report, evaluationResult],
	);
	const previewBindKey = useMemo(
		() =>
			displayReport
				? `pdf-${resolvedId || displayReport.url}-${appliedResult?.viewMode ?? (displayReport.isPrescriptionApplied ? 'after' : 'before')}-${displayReport.score}-${displayReport.prescriptionAppliedAt ?? '0'}-${prescriptionRevision}`
				: `pdf-empty-${prescriptionRevision}`,
		[displayReport, resolvedId, appliedResult?.viewMode, prescriptionRevision],
	);

	const shareUrl = useMemo(
		() => (resolvedId ? buildPublicReportUrl(resolvedId) : ''),
		[resolvedId],
	);

	const handleOpenEmail = useCallback(() => setEmailOpen(true), []);
	const handleCloseEmail = useCallback(() => setEmailOpen(false), []);
	const handleOpenPdfPreview = useCallback(() => {
		requestFullReportMount();
		setPdfPreviewOpen(true);
	}, []);
	const handleClosePdfPreview = useCallback(() => setPdfPreviewOpen(false), []);
	const handleOpenExecBrief = useCallback(() => setExecBriefOpen(true), []);
	const handleCloseExecBrief = useCallback(() => setExecBriefOpen(false), []);
	const handleResultTabChange = useCallback((tab: AuditResultTabId) => setResultTab(tab), []);
	const handleGoToAnswerCenter = useCallback(() => {
		setExecBriefOpen(false);
		setResultTab('geo');
		window.setTimeout(() => {
			window.dispatchEvent(new CustomEvent(OPEN_GEO_ANSWER_CENTER_EVENT));
		}, 80);
	}, []);

	const loadingUrl = scanUrl || url || report?.url || '';
	const resultData = report;
	const isResultPending = isLoading || isFetching || !resultData;
	const showError = !isAnalyzing && Boolean(error);
	const showResultContent = !isAnalyzing && Boolean(resultData);
	const showResultLoader = !isAnalyzing && !error && isResultPending && !resultData;
	const loaderVariant = auditId && !isLiveAnalysis ? 'hydrate' : 'compose';
	const emailSiteName = resultData
		? resultData.siteMeta?.brandName ||
			resultData.metrics?.pageTitle ||
			siteLabelFromUrl(resultData.url)
		: '';

	useEffect(() => {
		if (!showResultContent) return;
		const win = window as Window & {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (id: number) => void;
		};
		const prefetch = () => {
			void import('@/components/EmailPreviewModal');
			void import('@/components/audit/ExecBriefOverlay');
			void import('@/components/audit/PDFPreviewModal');
			void import('@/components/audit/Tab2OnpageBody');
		};
		if (typeof win.requestIdleCallback === 'function') {
			const id = win.requestIdleCallback(prefetch, { timeout: 4000 });
			return () => win.cancelIdleCallback?.(id);
		}
		const timer = window.setTimeout(prefetch, 2800);
		return () => window.clearTimeout(timer);
	}, [showResultContent]);

	return (
		<main ref={contentShellRef} className="audit-report-page relative">
			{/* Shared width shell: back links, loading terminal, and report share audit-report-scale */}
			<div className="audit-report-scale flex flex-col gap-6">
				<div className="print:hidden flex flex-wrap items-center gap-4">
					<Link href="/audit/history" className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
						{t('backToHistory')}
					</Link>
					<Link href="/" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
						{t('backToHome')}
					</Link>
					{targetIdRef.current || targetPersisted ? (
						<Link
							href="/admin/crawling/list"
							className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300"
						>
							관리자 수집 리스트로 돌아가기
						</Link>
					) : null}
				</div>
				{targetPersisted ? (
					<p
						role="status"
						className="print:hidden rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-200"
					>
						정밀 진단 결과가 타깃 레코드에 저장되었습니다. 리스트에서 [A4 리포트 보기]가 활성화됩니다.
					</p>
				) : null}

				{isAnalyzing && (
					<AuditLoading
						key={`${auditId || 'new'}:${url || loadingUrl}:${forceRefresh ? cacheBustT || 'force' : 'normal'}`}
						url={loadingUrl}
						isDataReady={isDataReady}
						forceRefresh={forceRefresh}
						onComplete={handleLoadingComplete}
					/>
				)}

				{showResultLoader ? <AuditResultLoader variant={loaderVariant} /> : null}

				{showError && (
					<div
						className={`print:hidden flex flex-col gap-3 rounded-2xl border p-6 text-sm ${
							deletedOrMissing
								? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100'
								: 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'
						}`}
						role={deletedOrMissing ? 'alertdialog' : undefined}
						aria-live="polite"
					>
						<p className="font-semibold">
							{deletedOrMissing ? t('deletedOrMissing') : t('failedTitle')}
						</p>
						{!deletedOrMissing ? <p>{error}</p> : <p>{t('deletedOrMissingRedirect')}</p>}
						<div className="flex flex-wrap gap-2">
							{deletedOrMissing ? (
								<Link
									href="/audit"
									className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-light"
								>
									{t('retry')}
								</Link>
							) : (
								<>
									<Link
										href="/"
										className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-light"
									>
										{t('retry')}
									</Link>
									<Link
										href="/audit/history"
										className="w-fit rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/5 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10"
									>
										{t('backToHistory')}
									</Link>
								</>
							)}
						</div>
					</div>
				)}

				{showResultContent && resultData ? (
					<div className="audit-result-fade-in">
						<AuditReportDocument
							report={resultData}
							reportId={resolvedId}
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
							onResultTabChange={handleResultTabChange}
							onOpenPdfPreview={handleOpenPdfPreview}
							justRefreshed={justRefreshed}
						/>
					</div>
				) : null}
			</div>

			{showResultContent && resultData ? (
				<>
					{/* Outside `.audit-report-scale` so `zoom` does not distort fixed layers.
					    Scrollspy: xl+ pinned to content right ??34px; below xl: fixed right-4 ??50px.
					    Share bar: ??600 side card; <1600 fixed bottom bar (lifts above footer). */}
					<AuditScrollspyNav
						contentRef={contentShellRef}
						activeTab={resultTab}
						onTabChange={handleResultTabChange}
						observeKey={resultTab}
					/>
					<AuditShareBar
						shareUrl={shareUrl}
						score={(displayReport ?? resultData).score}
						statusLabel={(displayReport ?? resultData).statusLabel}
						onOpenEmail={handleOpenEmail}
						onOpenPdfPreview={handleOpenPdfPreview}
						onOpenExecBrief={handleOpenExecBrief}
					/>
					{execBriefOpen ? (
						<ExecBriefModal
							open={execBriefOpen}
							onClose={handleCloseExecBrief}
							report={displayReport ?? resultData}
							geoNarrative={geoNarrative}
							onGoToAnswerCenter={handleGoToAnswerCenter}
						/>
					) : null}
					{pdfPreviewOpen ? (
						<PDFPreviewModal
							key={`pdf-modal-${previewBindKey}`}
							isOpen={pdfPreviewOpen}
							onClose={handleClosePdfPreview}
							isPageSpeedLoaded={!pageSpeedLoading}
							isGeoNarrativeLoaded={!geoNarrativeLoading}
							shareUrl={shareUrl}
							dataRevision={previewBindKey}
						/>
					) : null}
					{emailOpen ? (
						<EmailPreviewModal
							isOpen={emailOpen}
							onClose={handleCloseEmail}
							siteName={emailSiteName}
							targetUrl={resultData.url}
						/>
					) : null}
				</>
			) : null}
		</main>
	);
}
