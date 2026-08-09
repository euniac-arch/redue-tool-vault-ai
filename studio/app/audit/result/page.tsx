'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AuditActionPlan } from '@/components/AuditActionPlan';
import { AuditCategoryGrid } from '@/components/AuditCategoryGrid';
import { AuditChecklist } from '@/components/AuditChecklist';
import { AuditCtaBox } from '@/components/AuditCtaBox';
import { AuditExecutiveSummary } from '@/components/AuditExecutiveSummary';
import { AuditFindingsList } from '@/components/AuditFindingsList';
import { AuditLoading } from '@/components/AuditLoading';
import { AuditScoreHeader } from '@/components/AuditScoreHeader';
import { AuditShareBar } from '@/components/AuditShareBar';
import { AuditTechnicalEvidence } from '@/components/AuditTechnicalEvidence';
import { EmailReportModal } from '@/components/EmailReportModal';
import { GeoCitationAlgorithmSection } from '@/components/GeoCitationAlgorithmSection';
import { AiSearchResultSimulator } from '@/components/audit/AiSearchResultSimulator';
import { GeoNarrativeSkeleton } from '@/components/GeoNarrativeSkeleton';
import { ImpactPreviewSection } from '@/components/ImpactPreviewSection';
import { getGuestAuditById, saveGuestAudit, scanSiteOnce } from '@/lib/audit-history-storage';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { buildTechnicalFailsFromReport } from '@/lib/audit/geo-narrative';
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
	const auditId = searchParams.get('id')?.trim() || '';
	const url = searchParams.get('url')?.trim() || '';

	const [report, setReport] = useState<AuditReport | null>(null);
	const [resolvedId, setResolvedId] = useState<string | null>(auditId || null);
	const [loading, setLoading] = useState(true);
	const [isDataReady, setIsDataReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [emailOpen, setEmailOpen] = useState(false);
	const [geoNarrative, setGeoNarrative] = useState<GeoNarrativeReport | null>(null);
	const [geoNarrativeLoading, setGeoNarrativeLoading] = useState(false);
	const savedIdsRef = useRef<Set<string>>(new Set());
	/** Prevents a second loading flash when we replace ?url= with ?id= after animation. */
	const holdRevealRef = useRef(false);
	const geoFetchKeyRef = useRef<string>('');

	useEffect(() => {
		let cancelled = false;

		// After the step animation finishes we replace the URL with the audit id.
		// Skip remounting the loader if we already hold that report in memory.
		if (auditId && holdRevealRef.current && report && resolvedId === auditId) {
			holdRevealRef.current = false;
			setLoading(false);
			setIsDataReady(true);
			return;
		}

		async function loadById(id: string) {
			const cached = getGuestAuditById(id);
			if (cached) {
				if (!cancelled) {
					setReport(cached.report);
					setResolvedId(id);
					setIsDataReady(true);
				}
				return;
			}

			const res = await fetch(`/api/audit/${encodeURIComponent(id)}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? t('failedTitle'));
			if (!cancelled) {
				setReport(data.report as AuditReport);
				setResolvedId(data.id as string);
				setIsDataReady(true);
			}
		}

		async function runScan(targetUrl: string) {
			const data = await scanSiteOnce(targetUrl, locale);
			const { id, ...rest } = data;
			const nextReport = rest as AuditReport;

			if (!cancelled) {
				if (id && !savedIdsRef.current.has(id)) {
					savedIdsRef.current.add(id);
					saveGuestAudit(id, nextReport);
				}
				setReport(nextReport);
				setResolvedId(id ?? null);
				setIsDataReady(true);
				// Keep loading UI up until AuditLoading finishes 6/6.
			}
		}

		(async () => {
			setLoading(true);
			setIsDataReady(false);
			setError(null);
			setReport(null);

			try {
				if (auditId) {
					await loadById(auditId);
				} else if (url) {
					await runScan(url);
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
		// eslint-disable-next-line react-hooks/exhaustive-deps -- scan once per auditId/url/locale
	}, [auditId, url, locale]);

	// Industry-custom GEO narrative (LLM) — starts as soon as audit payload exists.
	useEffect(() => {
		if (!report) {
			setGeoNarrative(null);
			setGeoNarrativeLoading(false);
			geoFetchKeyRef.current = '';
			return;
		}

		const domain = siteLabelFromUrl(report.url);
		const technicalFails = buildTechnicalFailsFromReport(report);
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

	function handleLoadingComplete() {
		setLoading(false);
		if (resolvedId) {
			holdRevealRef.current = true;
			router.replace(`/audit/result?id=${encodeURIComponent(resolvedId)}`);
		}
	}

	const shareUrl =
		typeof window !== 'undefined'
			? resolvedId
				? `${window.location.origin}/audit/result?id=${encodeURIComponent(resolvedId)}`
				: window.location.href
			: '';

	const loadingUrl = url || report?.url || '';
	const checklist = report?.checklist?.length
		? report.checklist
		: report?.categories.flatMap((c) => c.checks) ?? [];

	const scannedLabel = report
		? new Date(report.fetchedAt).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR')
		: '';

	return (
		<main className="flex flex-col gap-6">
			<div className="print:hidden flex flex-wrap items-center gap-4">
				<Link href="/audit/history" className="text-sm text-slate-400 hover:text-white">
					{t('backToHistory')}
				</Link>
				<Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
					{t('backToHome')}
				</Link>
			</div>

			{loading && (
				<AuditLoading
					key={`${auditId || 'new'}:${url || loadingUrl}`}
					url={loadingUrl}
					isDataReady={isDataReady}
					onComplete={handleLoadingComplete}
				/>
			)}

			{!loading && error && (
				<div className="print:hidden flex flex-col gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300">
					<p className="font-semibold">{t('failedTitle')}</p>
					<p>{error}</p>
					<div className="flex flex-wrap gap-2">
						<Link href="/" className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-light">
							{t('retry')}
						</Link>
						<Link
							href="/audit/history"
							className="w-fit rounded-lg border border-white/[0.08] bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
						>
							{t('backToHistory')}
						</Link>
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
						<AuditExecutiveSummary report={report} />

						<div className="print:hidden">
							<AuditScoreHeader
								url={report.url}
								score={report.score}
								maxScore={report.maxScore}
								status={report.status}
								statusLabel={report.statusLabel}
								schemaCoverage={report.schemaCoverage}
								geoCitationScore={report.geoCitationScore}
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

						<section className="flex flex-col gap-3">
							<h2 className="text-sm font-bold text-slate-200 print:text-[#0B1C2C]">{t('categoryGridTitle')}</h2>
							<AuditCategoryGrid categories={report.categories} />
						</section>

						<AuditTechnicalEvidence report={report} />

						<section className="flex flex-col gap-3 print:hidden">
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

						<div className="print:hidden">
							{geoNarrativeLoading && !geoNarrative ? (
								<GeoNarrativeSkeleton />
							) : (
								<>
									<ImpactPreviewSection
										siteName={siteLabelFromUrl(report.url)}
										reportData={geoNarrative}
									/>
									<div className="mt-6">
										<GeoCitationAlgorithmSection
											domain={siteLabelFromUrl(report.url)}
											reportData={geoNarrative}
										/>
									</div>
									<div className="mt-6">
										<AiSearchResultSimulator
											meta={report.siteMeta}
											domain={siteLabelFromUrl(report.url)}
											reportData={geoNarrative}
										/>
									</div>
								</>
							)}
						</div>

						<AuditActionPlan report={report} />

						<div className="print:hidden">
							<AuditCtaBox />
						</div>
					</div>

					<footer className="audit-print-footer mt-8 hidden border-t border-slate-300 pt-3 text-[10px] text-slate-600 print:block">
						<p>
							{t('printFooter')}
						</p>
					</footer>

					<AuditShareBar
						shareUrl={shareUrl}
						score={report.score}
						statusLabel={report.statusLabel}
						onOpenEmail={() => setEmailOpen(true)}
					/>

					<p className="print:hidden text-[11px] text-slate-600">
						{t('scannedAt', {
							time: scannedLabel,
							status: report.httpStatus ?? '—',
							ms: report.responseTimeMs,
						})}
					</p>

					<EmailReportModal
						open={emailOpen}
						onClose={() => setEmailOpen(false)}
						report={report}
						reportUrl={shareUrl}
						auditId={resolvedId}
					/>
				</>
			)}
		</main>
	);
}
