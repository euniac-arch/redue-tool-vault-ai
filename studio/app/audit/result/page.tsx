'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { AuditActionPlan } from '@/components/AuditActionPlan';
import { AuditCategoryGrid } from '@/components/AuditCategoryGrid';
import { AuditChecklist } from '@/components/AuditChecklist';
import { AuditCtaBox } from '@/components/AuditCtaBox';
import { ExternalVerificationLinks } from '@/components/ExternalVerificationLinks';
import { AuditExecutiveSummary } from '@/components/AuditExecutiveSummary';
import { AuditFindingsList } from '@/components/AuditFindingsList';
import { AuditLoading } from '@/components/AuditLoading';
import { AuditScoreHeader } from '@/components/AuditScoreHeader';
import { AuditScrollspyNav } from '@/components/AuditScrollspyNav';
import { AuditShareBar } from '@/components/AuditShareBar';
import { AuditTechnicalEvidence } from '@/components/AuditTechnicalEvidence';
import { EmailPreviewModal } from '@/components/EmailPreviewModal';
import { GeoCitationAlgorithmSection } from '@/components/GeoCitationAlgorithmSection';
import { AiEngineExposurePanel } from '@/components/audit/AiEngineExposurePanel';
import { AiSearchResultSimulator } from '@/components/audit/AiSearchResultSimulator';
import { AuditResultTabs, type AuditResultTabId } from '@/components/audit/AuditResultTabs';
import { BrandTrustPanel } from '@/components/audit/BrandTrustPanel';
import { DigitalFootprintSection } from '@/components/audit/DigitalFootprintSection';
import { GeoActionPlanPanel } from '@/components/audit/GeoActionPlanPanel';
import { GeoScoreOverviewHeader } from '@/components/audit/GeoScoreOverviewHeader';
import { JsonLdFixSnippetsPanel } from '@/components/audit/JsonLdFixSnippetsPanel';
import { KeywordRecommendationPanel } from '@/components/audit/KeywordRecommendationPanel';
import {
	PageSpeedPrecisionPanel,
	type PageSpeedStrategy,
} from '@/components/audit/PageSpeedPrecisionPanel';
import { GeoNarrativeSkeleton } from '@/components/GeoNarrativeSkeleton';
import { ImpactPreviewSection } from '@/components/ImpactPreviewSection';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import {
	getGuestAuditById,
	notifyAuditHistorySync,
	removeGuestAudit,
	saveGuestAudit,
	scanSiteOnce,
	upsertGuestAuditOnRescan,
} from '@/lib/audit-history-storage';
import { markImportedCrawlRecordDiagnosed } from '@/lib/crawling/transfer-queue';
import type { TargetDiagnoseResponse } from '@/lib/crawling/types';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { buildTechnicalFailsFromReport } from '@/lib/audit/geo-narrative';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import type { AuditReport } from '@/lib/site-auditor';

function siteLabelFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '') || raw;
	} catch {
		return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

export default function AuditResultPage() {
	return (
		<Suspense fallback={null}>
			<AuditResultContent />
		</Suspense>
	);
}

function AuditResultContent() {
	const t = useTranslations('audit');
	const locale = useLocale();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { persistAudit } = useAuditPayload();
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

	const [report, setReport] = useState<AuditReport | null>(null);
	const [resolvedId, setResolvedId] = useState<string | null>(auditId || null);
	const [loading, setLoading] = useState(true);
	const [isDataReady, setIsDataReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [deletedOrMissing, setDeletedOrMissing] = useState(false);
	const [emailOpen, setEmailOpen] = useState(false);
	const [resultTab, setResultTab] = useState<AuditResultTabId>('geo');
	const [geoNarrative, setGeoNarrative] = useState<GeoNarrativeReport | null>(null);
	const [geoNarrativeLoading, setGeoNarrativeLoading] = useState(false);
	const [pageSpeed, setPageSpeed] = useState<PageSpeedSnapshot | null>(null);
	const [pageSpeedLoading, setPageSpeedLoading] = useState(false);
	const [pageSpeedError, setPageSpeedError] = useState<string | null>(null);
	/** Default PC (desktop) lab data on first diagnosis. */
	const [psiStrategy, setPsiStrategy] = useState<PageSpeedStrategy>('desktop');
	const savedIdsRef = useRef<Set<string>>(new Set());
	/** Keeps admin-list `target_id` across `?url=` → `?id=` replacement. */
	const targetIdRef = useRef(targetIdParam);
	const diagnosisSavedRef = useRef(false);
	const [targetPersisted, setTargetPersisted] = useState(false);
	if (targetIdParam) targetIdRef.current = targetIdParam;

	const scanUrl =
		url ||
		(domainParam
			? /^https?:\/\//i.test(domainParam)
				? domainParam
				: `https://${domainParam}`
			: '');
	/** Prevents a second loading flash when we replace ?url= with ?id= after animation. */
	const holdRevealRef = useRef(false);
	const geoFetchKeyRef = useRef<string>('');
	/** Cache PageSpeed snapshots per audit identity + strategy for instant tab switches. */
	const psiCacheRef = useRef<{
		auditKey: string;
		byStrategy: Partial<Record<PageSpeedStrategy, PageSpeedSnapshot>>;
	}>({ auditKey: '', byStrategy: {} });
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
			setLoading(false);
			setIsDataReady(true);
			return;
		}

		async function loadById(id: string) {
			// Prefer server so admin hard-deletes are not masked by guest localStorage.
			const res = await fetch(`/api/audit/${encodeURIComponent(id)}?t=${Date.now()}`, {
				cache: 'no-store',
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
				},
			});
			const data = await res.json().catch(() => ({}));

			if (res.ok && data.report) {
				if (!cancelled) {
					const nextReport = data.report as AuditReport;
					setReport(nextReport);
					setResolvedId(data.id as string);
					setIsDataReady(true);
					persistAudit(nextReport, { auditId: data.id as string });
				}
				return;
			}

			if (res.status === 404) {
				removeGuestAudit(id);
				if (!cancelled) {
					setDeletedOrMissing(true);
					setError(
						typeof data.error === 'string' && data.error
							? data.error
							: t('deletedOrMissing'),
					);
					setLoading(false);
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
						setReport(cached.report);
						setResolvedId(id);
						setIsDataReady(true);
						persistAudit(cached.report, { auditId: id });
					}
					return;
				}
			}

			throw new Error(
				typeof data.error === 'string' && data.error ? data.error : t('failedTitle'),
			);
		}

		async function runScan(targetUrl: string, opts?: { forceRefresh?: boolean; replaceId?: string }) {
			const data = await scanSiteOnce(targetUrl, locale, {
				forceRefresh: opts?.forceRefresh,
				replaceId: opts?.replaceId,
			});
			const { id, ...rest } = data;
			const nextReport = rest as AuditReport;

			if (!cancelled) {
				if (id) {
					if (opts?.forceRefresh) {
						upsertGuestAuditOnRescan(id, nextReport, { replaceId: opts.replaceId });
						notifyAuditHistorySync({ ids: [id, opts.replaceId || ''].filter(Boolean) });
					} else if (!savedIdsRef.current.has(id)) {
						savedIdsRef.current.add(id);
						saveGuestAudit(id, nextReport);
					}
				}
				setReport(nextReport);
				setResolvedId(id ?? null);
				setIsDataReady(true);
				// Context cache; durable store is Firestore audit_projects (scan API returns doc id)
				persistAudit(nextReport, { auditId: id ?? null });
				void persistAdminTargetDiagnosis(nextReport, id ?? null);
				// Keep loading UI up until AuditLoading finishes 6/6.
			}
		}

		(async () => {
			setLoading(true);
			setIsDataReady(false);
			setError(null);
			setDeletedOrMissing(false);
			setReport(null);

			try {
				if (forceRefresh && (scanUrl || auditId)) {
					let targetUrl = scanUrl;
					if (!targetUrl && auditId) {
						const cached = getGuestAuditById(auditId);
						targetUrl = cached?.url || '';
						if (!targetUrl) {
							const res = await fetch(`/api/audit/${encodeURIComponent(auditId)}`, {
								cache: 'no-store',
							});
							const data = await res.json().catch(() => ({}));
							targetUrl = (data.report as AuditReport | undefined)?.url || '';
						}
					}
					if (!targetUrl) {
						setLoading(false);
						setError(t('noUrl'));
						return;
					}
					await runScan(targetUrl, { forceRefresh: true, replaceId: replaceId || undefined });
				} else if (auditId) {
					await loadById(auditId);
				} else if (scanUrl) {
					await runScan(scanUrl);
				} else {
					setLoading(false);
					setError(t('noUrl'));
				}
			} catch (err) {
				if (!cancelled) {
					setError((err as Error).message);
					setLoading(false);
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

	// Industry-custom GEO narrative (LLM) — starts as soon as audit payload exists.
	useEffect(() => {
		if (!report) {
			setGeoNarrative(null);
			setGeoNarrativeLoading(false);
			geoFetchKeyRef.current = '';
			return;
		}

		const domain = siteLabelFromUrl(report.url);
		const technicalFails = buildTechnicalFailsFromReport(
			report,
			locale === 'en' ? 'en' : 'ko',
		);
		const siteTitle =
			report.metrics?.pageTitle ||
			report.siteMeta?.brandName ||
			domain;
		const metaDescription =
			report.metrics?.metaDescription ||
			[report.siteMeta?.category, report.siteMeta?.location, report.siteMeta?.primaryKeyword]
				.filter(Boolean)
				.join(' · ') ||
			undefined;

		const fetchKey = `${report.url}|${locale}|${technicalFails.join('|')}`;
		if (geoFetchKeyRef.current === fetchKey && geoNarrative) return;
		geoFetchKeyRef.current = fetchKey;

		let cancelled = false;
		setGeoNarrativeLoading(true);

		(async () => {
			try {
				const res = await fetch('/api/generate-geo-report', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						domain,
						siteTitle,
						metaDescription,
						technicalFails,
						failItems: technicalFails,
						brandName: report.siteMeta?.brandName,
						category: report.siteMeta?.primaryKeyword || report.siteMeta?.category,
						location: report.siteMeta?.location,
						broadLocation: report.siteMeta?.broadLocation,
						lang: locale === 'en' ? 'en' : 'ko',
					}),
				});
				const data = await res.json();
				if (cancelled) return;
				if (!res.ok) throw new Error(data.error || 'GEO narrative failed');
				setGeoNarrative(data as GeoNarrativeReport);
			} catch {
				if (!cancelled) setGeoNarrative(null);
			} finally {
				if (!cancelled) setGeoNarrativeLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when audit identity changes
	}, [report?.url, report?.fetchedAt, locale]);

	/** 2차: PageSpeed Insights — HTML 리포트 노출 후 비동기 (1차 렌더를 막지 않음).
	 *  기본 strategy = desktop(PC). 탭 전환 시 미캐시 전략만 재요청. */
	useEffect(() => {
		if (!report?.url) {
			psiCacheRef.current = { auditKey: '', byStrategy: {} };
			setPageSpeed(null);
			setPageSpeedLoading(false);
			setPageSpeedError(null);
			return;
		}

		const auditKey = `${report.url}|${report.fetchedAt}`;
		let strategy = psiStrategy;

		if (psiCacheRef.current.auditKey !== auditKey) {
			psiCacheRef.current = { auditKey, byStrategy: {} };
			if (psiStrategy !== 'desktop') {
				setPsiStrategy('desktop');
				return;
			}
			strategy = 'desktop';
		}

		const cached = psiCacheRef.current.byStrategy[strategy];
		if (cached) {
			setPageSpeed(cached);
			setPageSpeedLoading(false);
			setPageSpeedError(null);
			return;
		}

		let cancelled = false;
		setPageSpeedLoading(true);
		setPageSpeedError(null);
		setPageSpeed(null);

		(async () => {
			try {
				const res = await fetch('/api/audit/pagespeed', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ url: report.url, strategy }),
				});
				const data = await res.json().catch(() => ({}));
				if (cancelled) return;
				if (!res.ok) {
					throw new Error(
						typeof data.error === 'string' && data.error
							? data.error
							: 'PageSpeed Insights failed',
					);
				}
				const snapshot = data as PageSpeedSnapshot;
				if (psiCacheRef.current.auditKey === auditKey) {
					psiCacheRef.current.byStrategy[strategy] = snapshot;
				}
				setPageSpeed(snapshot);
				setPageSpeedError(null);
			} catch (err) {
				if (!cancelled) {
					setPageSpeed(null);
					setPageSpeedError(err instanceof Error ? err.message : 'PageSpeed Insights failed');
				}
			} finally {
				if (!cancelled) setPageSpeedLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [report?.url, report?.fetchedAt, psiStrategy]);

	function handleLoadingComplete() {
		setLoading(false);
		if (resolvedId) {
			holdRevealRef.current = true;
			const params = new URLSearchParams();
			params.set('id', resolvedId);
			if (targetIdRef.current) params.set('target_id', targetIdRef.current);
			router.replace(`/audit/result?${params.toString()}`);
		}
	}

	const shareUrl =
		typeof window !== 'undefined'
			? resolvedId
				? `${window.location.origin}/audit/result?id=${encodeURIComponent(resolvedId)}`
				: window.location.href
			: '';

	const loadingUrl = scanUrl || url || report?.url || '';
	const checklist = report?.checklist?.length
		? report.checklist
		: report?.categories.flatMap((c) => c.checks) ?? [];

	const scannedLabel = report
		? new Date(report.fetchedAt).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR')
		: '';

	return (
		<main ref={contentShellRef} className="audit-report-page relative">
			{/* Shared width shell: back links, loading terminal, and report share audit-report-scale */}
			<div className="audit-report-scale flex flex-col gap-6">
				<div className="print:hidden flex flex-wrap items-center gap-4">
					<Link href="/audit/history" className="text-sm text-slate-400 hover:text-white">
						{t('backToHistory')}
					</Link>
					<Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
						{t('backToHome')}
					</Link>
					{targetIdRef.current || targetPersisted ? (
						<Link
							href="/admin/crawling/list"
							className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
						>
							관리자 수집 리스트로 돌아가기
						</Link>
					) : null}
				</div>
				{targetPersisted ? (
					<p
						role="status"
						className="print:hidden rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200"
					>
						정밀 진단 결과가 타깃 레코드에 저장되었습니다. 리스트에서 [A4 리포트 보기]가 활성화됩니다.
					</p>
				) : null}

				{loading && (
					<AuditLoading
						key={`${auditId || 'new'}:${url || loadingUrl}:${forceRefresh ? cacheBustT || 'force' : 'normal'}`}
						url={loadingUrl}
						isDataReady={isDataReady}
						forceRefresh={forceRefresh}
						onComplete={handleLoadingComplete}
					/>
				)}

				{!loading && error && (
					<div
						className={`print:hidden flex flex-col gap-3 rounded-2xl border p-6 text-sm ${
							deletedOrMissing
								? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
								: 'border-rose-500/30 bg-rose-500/10 text-rose-300'
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
										className="w-fit rounded-lg border border-white/[0.08] bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
									>
										{t('backToHistory')}
									</Link>
								</>
							)}
						</div>
					</div>
				)}

				{!loading && report && (
					<>
						{/* Print-only consulting report chrome */}
						<header className="audit-print-header mb-2 hidden border-b-2 border-[#C9A227] pb-4 print:block">
							<div className="flex items-end justify-between gap-4">
								<div>
									<p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">REDUE AI</p>
									<h1 className="mt-1 text-xl font-extrabold text-[#0B1C2C]">
										SEO &amp; GEO Technical Audit Report
									</h1>
								</div>
								<div className="text-right text-[11px] text-slate-600">
									<p>{scannedLabel}</p>
									<p className="mt-0.5 max-w-xs break-all font-mono">{report.url}</p>
								</div>
							</div>
						</header>

						<div className="audit-report-body flex flex-col gap-6">
							{/* Header/subtitle, measured dual scores, then optimization potential
							    simulator (current vs post-patch), then business-loss context. */}
							<AuditExecutiveSummary
								report={report}
								reportData={geoNarrative}
								pageSpeed={pageSpeed}
							/>

							<AuditResultTabs
								geoLabel={t('tabs.geo')}
								onpageLabel={t('tabs.onpage')}
								activeTab={resultTab}
								onTabChange={setResultTab}
								geoContent={
									<>
										{/* Tab 1 exclusive: AI search trust · GEO score + exposure pipeline + PDF */}
										<GeoScoreOverviewHeader report={report} reportData={geoNarrative} />
										<AiEngineExposurePanel report={report} reportData={geoNarrative} />
										<BrandTrustPanel report={report} reportData={geoNarrative} />
										<DigitalFootprintSection report={report} reportData={geoNarrative} />
										<GeoActionPlanPanel report={report} reportData={geoNarrative} />
									</>
								}
								onpageContent={
									<>
										{/* Tab 2: 122pt 배점 → 5대 카드 → PageSpeed 실측 → 스키마/JSON-LD */}
										<AuditScoreHeader report={report} />

										{/* 5대 세부 항목 → 웹 성능·접근성 PageSpeed 실측 (맥락 연속) */}
										<div className="flex flex-col gap-4">
											<section className="flex flex-col gap-3">
												<h2 className="text-sm font-bold text-slate-200 print:text-[#0B1C2C]">{t('categoryGridTitle')}</h2>
												<AuditCategoryGrid categories={report.categories} />
											</section>

											{/* 웹 성능 & 접근성 · PageSpeed 실측 (4대 점수 → CWV → 리소스/가이드) */}
											<PageSpeedPrecisionPanel
												snapshot={pageSpeed}
												loading={pageSpeedLoading}
												error={pageSpeedError}
												strategy={psiStrategy}
												onStrategyChange={setPsiStrategy}
												targetUrl={report.url}
											/>
										</div>

										{report.metrics?.schemaTypes?.length ? (
											<div className="flex flex-wrap gap-1.5">
												<span className="mr-1 self-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
													{t('detectedSchemas')}
												</span>
												{report.metrics.schemaTypes.map((type) => (
													<span
														key={type}
														className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-300 print:border-slate-300 print:bg-slate-100 print:text-slate-700"
													>
														{type}
													</span>
												))}
											</div>
										) : null}

										<AuditTechnicalEvidence report={report} />

										<div className="print:hidden flex flex-col gap-6">
											{/* Live Criteria Report → GEO Citation Algorithm → AI Search Simulator */}
											<ImpactPreviewSection
												siteName={siteLabelFromUrl(report.url)}
												reportData={geoNarrative}
												auditReport={report}
											/>
											{geoNarrativeLoading && !geoNarrative ? (
												<GeoNarrativeSkeleton />
											) : (
												<>
													<GeoCitationAlgorithmSection
														domain={siteLabelFromUrl(report.url)}
														reportData={geoNarrative}
														auditReport={report}
													/>
													<AiSearchResultSimulator
														meta={report.siteMeta}
														domain={siteLabelFromUrl(report.url)}
														reportData={geoNarrative}
													/>
												</>
											)}
										</div>

										<JsonLdFixSnippetsPanel report={report} />

										<section
											id="sec-checklist"
											className="scroll-mt-24 flex flex-col gap-3 print:hidden"
										>
											<div>
												<h2 className="text-sm font-bold text-slate-200">{t('checklistTitle')}</h2>
												<p className="mt-1 text-xs text-slate-500">{t('checklistSubtitle')}</p>
											</div>
											<AuditChecklist checks={checklist} />
										</section>

										<section className="flex flex-col gap-3">
											<h2 className="text-sm font-bold text-slate-200 print:text-[#0B1C2C]">{t('findingsTitle')}</h2>
											<AuditFindingsList findings={report.findings} />
										</section>

										<AuditActionPlan report={report} />

										{/* Tab 2 bottom: GEO/SEO target keyword recommendation pipeline */}
										<KeywordRecommendationPanel report={report} />
									</>
								}
							/>

							<div className="print:hidden flex flex-col gap-4">
								<AuditCtaBox report={report} auditId={resolvedId} />
								<div>
									<ExternalVerificationLinks
										url={report.url}
										variant="dark"
										sectionId="sec-official-tools"
									/>
									<p className="mt-2 mb-16 flex items-center pt-1 text-[11px] font-medium text-slate-500">
										<Clock
											className="mr-1.5 inline-block h-3.5 w-3.5 shrink-0 opacity-70"
											aria-hidden
										/>
										{t('scannedAt', {
											time: scannedLabel,
											status: report.httpStatus ?? '—',
											ms: report.responseTimeMs,
										})}
									</p>
								</div>
							</div>
						</div>

						<footer className="audit-print-footer mt-8 hidden border-t border-slate-300 pt-3 text-[10px] text-slate-600 print:block">
							<p>
								{t('printFooter')}
							</p>
						</footer>
					</>
				)}
			</div>

			{!loading && report && (
				<>
					{/* Outside `.audit-report-scale` so `zoom` does not distort fixed layers.
					    Scrollspy: xl+ pinned to content right − 34px; below xl: fixed right-4 − 50px.
					    Share bar: ≥1600 side card; <1600 fixed bottom bar (lifts above footer). */}
					<AuditScrollspyNav
						contentRef={contentShellRef}
						observeKey={resultTab}
						onEnsureOnpageTab={() => setResultTab('onpage')}
					/>
					<AuditShareBar
						shareUrl={shareUrl}
						score={report.score}
						statusLabel={report.statusLabel}
						onOpenEmail={() => setEmailOpen(true)}
					/>
					<EmailPreviewModal
						isOpen={emailOpen}
						onClose={() => setEmailOpen(false)}
						siteName={
							report.siteMeta?.brandName ||
							report.metrics?.pageTitle ||
							siteLabelFromUrl(report.url)
						}
						targetUrl={report.url}
					/>
				</>
			)}
		</main>
	);
}
