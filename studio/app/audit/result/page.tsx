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
import { DEFAULT_AUDIT_RESULT_TAB, type AuditResultTabId } from '@/components/audit/AuditResultTabs';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import {
	getGuestAuditById,
	getGuestAudits,
	notifyAuditHistorySync,
	removeGuestAudit,
	scanSiteOnce,
	upsertGuestAuditOnRescan,
	type AuditHistoryEntry,
} from '@/lib/audit-history-storage';
import { archiveLocalProjectFromAudit } from '@/lib/projects-local';
import {
	buildSnapshotFromReport,
	hostnameFromAuditUrl,
	isProjectedAuditReport,
	listDomainTrackingSnapshots,
	mergeDomainHistoryPoints,
	snapshotsFromHistoryList,
} from '@/lib/audit/domain-tracking';
import { AuditLimitModal } from '@/components/audit/AuditLimitModal';
import { isAuditLimitError } from '@/lib/audit/free-audit-quota';
import { persistReportTrackingSnapshot } from '@/lib/audit/domain-tracking';
import { markImportedCrawlRecordDiagnosed } from '@/lib/crawling/transfer-queue';
import type { TargetDiagnoseResponse } from '@/lib/crawling/types';
import { OPEN_GEO_ANSWER_CENTER_EVENT } from '@/lib/audit/exec-brief';
import { ensureExecutiveSummary } from '@/lib/audit/executive-summary';
import { fetchAuditById, peekCachedAudit, rememberAudit } from '@/lib/audit/report-client-cache';
import { buildMilestoneClientShareUrl, buildPublicReportUrl, siteLabelFromUrl } from '@/lib/audit/report-url';
import { resolveProjectSiteName } from '@/lib/audit/project-site-name';
import { endPdfLightPrint } from '@/lib/audit/print-pdf';
import { requestFullReportMount } from '@/lib/audit/scroll-to-category';
import { useAuditReportEnrichment } from '@/lib/audit/use-audit-report-enrichment';
import {
	resultSummaryFromAuditReport,
	resultSummaryFromTrackingPoint,
	type ResultSummaryAudit,
} from '@/lib/audit/result-summary-compare';
import { resolveTrack3PerformanceScore } from '@/lib/audit/pagespeed';
import type { AuditReport } from '@/lib/site-auditor';
import { AuditReportDocument } from '@/components/audit/AuditReportDocument';
import { EmailPreviewModal } from '@/components/EmailPreviewModal';
import { MilestoneAuditPanel } from '@/components/audit/milestone/MilestoneAuditPanel';
import { RoundSnapshotSummaryCard } from '@/components/audit/milestone/RoundSnapshotSummaryCard';
import { MilestoneUpsellCta } from '@/components/audit/milestone/MilestoneUpsellCta';
import { useMilestoneAudit } from '@/lib/audit/use-milestone-audit';
import { useMilestonePermission } from '@/lib/audit/use-milestone-permission';

const ExecBriefModal = dynamic(
	() => import('@/components/audit/ExecBriefOverlay').then((m) => m.ExecBriefModal),
	{ ssr: false },
);
const PDFPreviewModal = dynamic(
	() => import('@/components/audit/PDFPreviewModal').then((m) => m.PDFPreviewModal),
	{ ssr: false },
);
const ResultSummaryOverlay = dynamic(
	() => import('@/components/audit/ResultSummaryOverlay').then((m) => m.ResultSummaryOverlay),
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
	const tQuota = useTranslations('audit.quota');
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
	const [limitOpen, setLimitOpen] = useState(false);
	const [deletedOrMissing, setDeletedOrMissing] = useState(false);
	const [emailOpen, setEmailOpen] = useState(false);
	const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
	const [execBriefOpen, setExecBriefOpen] = useState(false);
	const [resultSummaryOpen, setResultSummaryOpen] = useState(false);
	const [resultSummaryPreview, setResultSummaryPreview] = useState(false);
	const [compareInitial, setCompareInitial] = useState<ResultSummaryAudit | null>(null);
	const [resultTab, setResultTab] = useState<AuditResultTabId>(DEFAULT_AUDIT_RESULT_TAB);
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
		isPsiRefreshing,
		refreshPageSpeed,
	} = useAuditReportEnrichment(report);
	// Same Track 3 read `AuditReportDocument` feeds into `buildDiagnosisScoreSnapshot` for the
	// on-screen headline score — reusing it here keeps the Before/After popup's "After" number
	// pixel-identical to the score the user is looking at when they open it.
	const psiPerformanceScore = resolveTrack3PerformanceScore({
		mobile: pageSpeedMobile,
		desktop: pageSpeedDesktop,
	});
	const liveOptimizedSummary = useMemo(() => {
		if (!report) return null;
		const afterReport =
			evaluationResult && evaluationResult.url === report.url ? evaluationResult : report;
		return resultSummaryFromAuditReport(afterReport, {
			coreWebVitalsScore100: psiPerformanceScore,
		});
	}, [report, evaluationResult, psiPerformanceScore]);

	useEffect(() => {
		if (!report) return;
		if (!pageSpeedDesktop && !pageSpeedMobile) return;
		const nextDesktop = pageSpeedDesktop ?? report.pageSpeedDesktop;
		const nextMobile = pageSpeedMobile ?? report.pageSpeedMobile;
		if (nextDesktop === report.pageSpeedDesktop && nextMobile === report.pageSpeedMobile) return;
		const nextReport: AuditReport = {
			...report,
			pageSpeedDesktop: nextDesktop,
			pageSpeedMobile: nextMobile,
		};
		setReport(nextReport);
		if (!resolvedId) return;
		rememberAudit(resolvedId, nextReport);
		persistReportTrackingSnapshot(resolvedId, nextReport);
		persistAudit(nextReport, { auditId: resolvedId, cmsType: nextReport.cmsType });
	}, [pageSpeedDesktop, pageSpeedMobile, report, resolvedId, persistAudit]);

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
			console.log('[audit/result] re-audit: fetch dispatched', {
				targetUrl,
				replaceId: opts?.replaceId || null,
			});
			const data = await scanSiteOnce(targetUrl, locale, {
				forceRefresh: true,
				replaceId: opts?.replaceId,
			});
			console.log('[audit/result] re-audit: response parsed, binding report to state', {
				targetUrl,
				id: data.id ?? null,
			});
			const { id, ...rest } = data;
			let nextReport: AuditReport;
			try {
				nextReport = ensureExecutiveSummary(rest as AuditReport);
			} catch (err) {
				console.error('[audit/result] executive summary bind failed (report still renders):', err);
				nextReport = rest as AuditReport;
			}
			if (!nextReport?.url || !Array.isArray(nextReport.categories)) {
				throw new Error(t('failedTitle'));
			}

			if (!cancelled) {
				// Best-effort local bookkeeping (guest history row, project archive, cross-tab
				// sync notice) — a completed, rendered diagnosis must never be turned into an
				// error screen just because one of these side effects throws.
				if (id) {
					try {
						rememberAudit(id, nextReport);
						const entry = upsertGuestAuditOnRescan(id, nextReport, { replaceId: opts?.replaceId });
						persistReportTrackingSnapshot(id, nextReport);
						archiveLocalProjectFromAudit(nextReport, {
							auditId: id,
							cmsType: nextReport.cmsType,
							userType: data.userType,
						});
						notifyAuditHistorySync({
							ids: [id, opts?.replaceId || ''].filter(Boolean),
							entry,
						});
					} catch (err) {
						console.error('[audit/result] post-scan bookkeeping failed (report still renders):', err);
					}
				}
				setReport(nextReport);
				setResolvedId(id ?? null);
				setIsDataReady(true);
				setJustRefreshed(true);
				diagnosisSavedRef.current = false;
				// Context cache; durable store is Firestore audit_projects (scan API returns doc id)
				persistAudit(nextReport, { auditId: id ?? null, cmsType: nextReport.cmsType });
				void persistAdminTargetDiagnosis(nextReport, id ?? null);
				// Keep loading UI up until AuditLoading finishes 7/7 (incl. the Track 3 PageSpeed gate).
			}
		}

		(async () => {
			setError(null);
			setDeletedOrMissing(false);

			try {
				const liveRescan = Boolean(scanUrl) || forceRefresh;
				if (liveRescan && (scanUrl || auditId)) {
					console.log('[audit/result] re-audit: starting new scan cycle, clearing prior report state', {
						scanUrl,
						auditId,
						forceRefresh,
					});
					setIsAnalyzing(true);
					setIsLoading(true);
					setIsFetching(true);
					setIsDataReady(false);
					// Clear the previously rendered diagnosis before kicking off the new fetch so a
					// stale report can never bleed into the fresh loading cycle / get confused with it.
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
				console.error('[audit/result] re-audit failed — showing error screen instead of hanging:', {
					scanUrl,
					auditId,
					message: err instanceof Error ? err.message : String(err),
				});
				if (!cancelled) {
					if (isAuditLimitError(err)) {
						setLimitOpen(true);
						setError(tQuota('limitReached'));
					} else {
						setError((err as Error).message);
					}
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
			console.log('[audit/result] re-audit: loading terminal finished, routing to result view', {
				resolvedId,
			});
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
				? `pdf-${resolvedId || displayReport.url}-${appliedResult?.viewMode ?? (displayReport.isPrescriptionApplied ? 'after' : 'before')}-${displayReport.score}-${psiPerformanceScore ?? 'pending'}-${pageSpeedLoading ? 'cwv-loading' : 'cwv-ready'}-${displayReport.prescriptionAppliedAt ?? '0'}-${prescriptionRevision}`
				: `pdf-empty-${prescriptionRevision}`,
		[displayReport, resolvedId, appliedResult?.viewMode, prescriptionRevision, psiPerformanceScore, pageSpeedLoading],
	);

	const shareUrl = useMemo(
		() => (resolvedId ? buildPublicReportUrl(resolvedId) : ''),
		[resolvedId],
	);

	// "4주 집중 마일스톤" — 회차별 원클릭 박제 시스템. 권한(관리자/고객공유/일반)에 따라
	// 타임라인 탭·박제 컨트롤러 노출 여부가 갈리며, 라이브 진단은 항상 그대로 유지된다.
	// 재진단 시작 시 `report`가 잠깐 `null`이 되어 `milestoneDomain`도 함께 비워지므로,
	// 아래 렌더링(`milestoneTopSlot`)과 패널에 넘기는 `domain`은 절대 `milestoneDomain`을
	// 직접 쓰지 않고 `milestone.effectiveDomain`(훅 내부에서 마지막 실제 도메인을 별도로
	// 기억하는 안정 값)을 사용한다 — 그래야 재진단 도중 패널/박제 배지가 잠깐 사라졌다가
	// 다시 나타나며 "확정이 초기화된 것처럼" 보이는 현상 없이, 라이브 상태와 마일스톤
	// 슬롯이 화면상으로도 완전히 분리된다.
	const milestonePermission = useMilestonePermission();
	const milestoneDomain = report ? hostnameFromAuditUrl(report.url) : '';
	const milestone = useMilestoneAudit({
		domain: milestoneDomain,
		reportId: resolvedId,
		liveReport: report,
		geoNarrative,
		pageSpeed,
		pageSpeedDesktop,
		pageSpeedMobile,
		lang: locale === 'en' ? 'en' : 'ko',
		enableRemoteSync: milestonePermission.mode !== 'user',
	});
	const milestoneDisplayedPayload = milestone.displayedSnapshot?.data ?? null;
	const milestoneClientShareUrl = useMemo(
		() => (resolvedId ? buildMilestoneClientShareUrl(resolvedId) : ''),
		[resolvedId],
	);

	const handleOpenEmail = useCallback(() => setEmailOpen(true), []);
	const handleCloseEmail = useCallback(() => setEmailOpen(false), []);
	const handleOpenPdfPreview = useCallback(() => {
		requestFullReportMount();
		setPdfPreviewOpen(true);
	}, []);
	const handleClosePdfPreview = useCallback(() => {
		endPdfLightPrint();
		setPdfPreviewOpen(false);
	}, []);
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
	const handleCloseResultSummary = useCallback(() => {
		setResultSummaryOpen(false);
		setResultSummaryPreview(false);
	}, []);
	const handlePreviewResultSummary = useCallback(async () => {
		if (resultSummaryPreview) {
			setResultSummaryOpen((open) => !open);
			return;
		}
		if (!report) return;

		// Real before/after for the actual audited site: the very first ever measured
		// diagnosis for this hostname vs the most recent one (this session's rescan or the
		// latest stored diagnosis) — same append-only timeline used by ActualAuditHistoryTracker.
		const afterReport =
			evaluationResult && evaluationResult.url === report.url ? evaluationResult : report;
		const hostname = hostnameFromAuditUrl(report.url);
		const currentId = resolvedId || `local:${hostname}`;
		const currentSnapshot = isProjectedAuditReport(report)
			? null
			: buildSnapshotFromReport(currentId, report);

		const local = listDomainTrackingSnapshots(hostname);
		const guest = snapshotsFromHistoryList(getGuestAudits(), hostname);
		let server: AuditHistoryEntry[] = [];
		try {
			const res = await fetch('/api/audit/history', { cache: 'no-store' });
			const data = (await res.json()) as { items?: AuditHistoryEntry[] };
			if (res.ok && Array.isArray(data.items)) server = data.items;
		} catch {
			// Local + guest tracking alone still gives a real (if session-local) timeline.
		}

		const merged = mergeDomainHistoryPoints([
			...local,
			...guest,
			...snapshotsFromHistoryList(server, hostname),
			...(currentSnapshot ? [currentSnapshot] : []),
		]);
		const firstPoint = merged[0] ?? currentSnapshot;
		const latestPoint = merged[merged.length - 1] ?? currentSnapshot;

		const afterSummary = resultSummaryFromAuditReport(afterReport, {
			coreWebVitalsScore100: psiPerformanceScore,
		});
		const known = {
			siteName: afterSummary.siteName,
			url: report.url,
			schemaType: afterSummary.schema.schemaType,
			llmsTxt: afterSummary.llmsTxt.status,
		};
		const hasHistoricalBefore =
			Boolean(firstPoint && latestPoint && firstPoint.snapshotId !== latestPoint.snapshotId);
		setCompareInitial(
			hasHistoricalBefore && firstPoint
				? resultSummaryFromTrackingPoint(firstPoint, known)
				: null,
		);
		setResultSummaryPreview(true);
		setResultSummaryOpen(true);
	}, [resultSummaryPreview, report, evaluationResult, resolvedId, psiPerformanceScore]);

	const loadingUrl = scanUrl || url || report?.url || '';
	const resultData = report;
	const isResultPending = isLoading || isFetching || !resultData;
	const showError = !isAnalyzing && Boolean(error);
	const showResultContent = !isAnalyzing && Boolean(resultData);
	const showResultLoader = !isAnalyzing && !error && isResultPending && !resultData;

	const loaderVariant = auditId && !isLiveAnalysis ? 'hydrate' : 'compose';
	const emailSiteName = resultData
		? resolveProjectSiteName(resultData) || siteLabelFromUrl(resultData.url)
		: '';

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
					<button
						type="button"
						onClick={handlePreviewResultSummary}
						disabled={!report}
						className="rounded-lg border border-[#00F2FE]/40 bg-[#00F2FE]/10 px-3 py-1.5 text-xs font-extrabold text-[#00F2FE] transition hover:bg-[#00F2FE]/20 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{t('resultSummary.preview')}
					</button>
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

				<AuditLimitModal open={limitOpen} onClose={() => setLimitOpen(false)} />

				{showResultContent && resultData ? (
					<div className="audit-result-fade-in">
						{/* 회차가 확정 상태인데 이 브라우저에 전체 리포트 캐시(`data`)가 없는 경우
						    (다른 기기에서 열람, 로컬 캐시 정리 등) — 라이브 데이터를 그 회차인 것처럼
						    잘못 보여주지 않고, Firestore에서 받아온 경량 점수 요약 카드로 대체한다. */}
						{milestone.displayedSnapshot && !milestone.displayedSnapshot.data ? (
							<>
								{milestonePermission.mode !== 'user' && milestone.effectiveDomain ? (
									<MilestoneAuditPanel
										domain={milestone.effectiveDomain}
										mode={milestonePermission.mode}
										history={milestone.history}
										activeRound={milestone.activeRound}
										onSelectRound={milestone.setActiveRound}
										scoreByRound={milestone.scoreByRound}
										isLocking={milestone.isLocking}
										lockError={milestone.lockError}
										lastLockedRound={milestone.lastLockedRound}
										onLockRound={milestone.lockRound}
										onDownloadCurrentPdf={handleOpenPdfPreview}
										shareUrl={milestoneClientShareUrl}
										lang={locale === 'en' ? 'en' : 'ko'}
									/>
								) : null}
								<div className="mt-4">
									<RoundSnapshotSummaryCard
										snapshot={milestone.displayedSnapshot.roundSnapshot}
										onBackToLive={() => milestone.setActiveRound('LIVE')}
									/>
								</div>
							</>
						) : (
							<AuditReportDocument
								report={milestoneDisplayedPayload?.report ?? resultData}
								reportId={resolvedId}
								geoNarrative={milestoneDisplayedPayload ? milestoneDisplayedPayload.geoNarrative : geoNarrative}
								geoNarrativeLoading={milestoneDisplayedPayload ? false : geoNarrativeLoading}
								pageSpeed={milestoneDisplayedPayload ? milestoneDisplayedPayload.pageSpeed : pageSpeed}
								pageSpeedDesktop={
									milestoneDisplayedPayload ? milestoneDisplayedPayload.pageSpeedDesktop : pageSpeedDesktop
								}
								pageSpeedMobile={
									milestoneDisplayedPayload ? milestoneDisplayedPayload.pageSpeedMobile : pageSpeedMobile
								}
								pageSpeedLoading={milestoneDisplayedPayload ? false : pageSpeedLoading}
								pageSpeedError={milestoneDisplayedPayload ? null : pageSpeedError}
								psiStrategy={psiStrategy}
								onPsiStrategyChange={setPsiStrategy}
								pageSpeedRefreshing={isPsiRefreshing}
								onRefreshPageSpeed={refreshPageSpeed}
								resultTab={resultTab}
								onResultTabChange={handleResultTabChange}
								onOpenPdfPreview={handleOpenPdfPreview}
								justRefreshed={justRefreshed}
								bypassEvaluationOverlay={!milestone.isViewingLive}
								milestoneTopSlot={
									milestonePermission.mode !== 'user' && milestone.effectiveDomain ? (
										<MilestoneAuditPanel
											domain={milestone.effectiveDomain}
											mode={milestonePermission.mode}
											history={milestone.history}
											activeRound={milestone.activeRound}
											onSelectRound={milestone.setActiveRound}
											scoreByRound={milestone.scoreByRound}
											isLocking={milestone.isLocking}
											lockError={milestone.lockError}
											lastLockedRound={milestone.lastLockedRound}
											onLockRound={milestone.lockRound}
											onDownloadCurrentPdf={handleOpenPdfPreview}
											shareUrl={milestoneClientShareUrl}
											lang={locale === 'en' ? 'en' : 'ko'}
										/>
									) : undefined
								}
								milestoneBottomSlot={milestonePermission.mode === 'user' ? <MilestoneUpsellCta /> : undefined}
							/>
						)}
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
			{resultSummaryOpen ? (
				<ResultSummaryOverlay
					open={resultSummaryOpen}
					onClose={handleCloseResultSummary}
					initialAudit={compareInitial ?? liveOptimizedSummary}
					optimizedAudit={liveOptimizedSummary}
				/>
			) : null}
		</main>
	);
}
