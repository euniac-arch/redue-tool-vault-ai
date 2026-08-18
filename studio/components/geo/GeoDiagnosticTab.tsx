'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuditPayload } from '@/components/audit/AuditPayloadProvider';
import {
	buildAfterPrescriptionAuditReport,
	buildPrescriptionTrackingOverlay,
} from '@/lib/audit/evaluation-result';
import {
	expectedScoresFromProjectedReport,
	hostnameFromAuditUrl,
	persistAppliedTrackingEvent,
} from '@/lib/audit/domain-tracking';
import { AIEngineCardList } from '@/components/geo/AIEngineCardList';
import { AIEngineSummaryHeader } from '@/components/geo/AIEngineSummaryHeader';
import { CompetitorLeakageRoiBanner } from '@/components/geo/CompetitorLeakageRoiBanner';
import { ApplyPrescriptionButton } from '@/components/geo/ApplyPrescriptionButton';
import { BeforeAfterTabNav, type PrescriptionViewMode } from '@/components/geo/BeforeAfterTabNav';
import { GEOPrescriptionCopyCenter } from '@/components/geo/GEOPrescriptionCopyCenter';
import { GEOResultReport } from '@/components/geo/GEOResultReport';
import { SiteReachProvider, useSiteReach } from '@/components/geo/SiteReachContext';
import { buildSiteReachState } from '@/lib/geo/site-reach-state';
import { reachEngineList } from '@/types/site-reach';
import {
	GEO_ANSWER_CENTER_ID,
	OPEN_GEO_ANSWER_CENTER_EVENT,
	geoAnswerCenterModuleAnchor,
	type OpenGeoAnswerCenterDetail,
} from '@/lib/audit/exec-brief';
import { businessConversionFromGeo } from '@/lib/audit/business-conversion';
import { buildGeoDiagnosticReportFromAudit } from '@/lib/geo/from-visibility';
import { collectAuditTargetKeywords, napFromAuditReport } from '@/lib/geo/prescription-patches';
import { generateQueryMatrix } from '@/lib/geo/query-matrix';
import { isKeywordWeights, isRecommendationReasons } from '@/lib/geo/prompt-insights';
import { isExpandedQueryCoverage } from '@/lib/geo/query-coverage';
import {
	buildClientAppliedPatches,
	buildClientKeywordWeights,
	buildClientQueryCoverage,
	buildClientRecommendationReasons,
	buildPrescriptionAfterReport,
	syncAfterReportToBeQueries,
	type PrescriptionAfterOptions,
	type PrescriptionLang,
} from '@/lib/geo/prescription-after';
import { useCustomSelectBoxes } from '@/lib/ui/use-custom-select-boxes';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { IndustryType } from '@/lib/audit/site-metadata';
import type { AuditReport } from '@/lib/site-auditor';
import type { AIEngineId, GeoDiagnosticReport } from '@/types/geo-diagnostic';
import type {
	AppliedGeoPatches,
	ApplyPrescriptionResponse,
	ExpandedQueryCoverage,
	KeywordWeight,
	RecommendationReason,
} from '@/types/geo-prescription';

export type GeoEngineExposureFilter = 'all' | 'excellent' | 'needs_work';

interface GeoDiagnosticTabProps {
	report: GeoDiagnosticReport;
	/** Baseline crawl — used to record the apply event without mutating measured scores. */
	auditReport?: AuditReport | null;
	siteId?: string | null;
	currentSchema?: string[];
	targetKeywords?: string[];
	industryType?: IndustryType;
	category?: string;
	location?: string;
	description?: string;
	ogTitle?: string;
	ogDescription?: string;
	needSignals?: string[];
	title?: string;
	metaKeywords?: string;
	navMenuTexts?: string[];
}

interface GeoDiagnosticTabFromAuditProps {
	audit: AuditReport;
	/** GEO narrative — keeps engine scores aligned with the exposure panel. */
	reportData?: GeoNarrativeReport | null;
}

const FILTERS: GeoEngineExposureFilter[] = ['all', 'excellent', 'needs_work'];
const LOADING_STEPS = [1, 2, 3] as const;
const STEP_MS = 850;
const MIN_WAIT_MS = 2600;
const VIEW_EASE = [0.22, 1, 0.36, 1] as const;

function beforeLevelsFromReport(report: GeoDiagnosticReport): Record<AIEngineId, number | null> {
	const out = {} as Record<AIEngineId, number | null>;
	for (const engine of report.engines) {
		out[engine.engine.id] = engine.depthLevel;
	}
	return out;
}

function isApplyResponse(raw: unknown): raw is ApplyPrescriptionResponse {
	if (!raw || typeof raw !== 'object') return false;
	const obj = raw as Record<string, unknown>;
	return Boolean(obj.afterReport && obj.appliedPatches && Array.isArray(obj.aiSimulations));
}

export function GeoDiagnosticTab({
	report,
	auditReport,
	siteId,
	currentSchema,
	targetKeywords,
	industryType,
	category,
	location,
	description,
	ogTitle,
	ogDescription,
	needSignals,
	title,
	metaKeywords,
	navMenuTexts,
}: GeoDiagnosticTabProps) {
	const t = useTranslations('audit.geoDiagnosticTab');
	const locale = useLocale();
	const lang: PrescriptionLang = locale === 'en' ? 'en' : 'ko';
	const reduceMotion = useReducedMotion();
	const { setEvaluationResult, setAppliedResult, setPrescriptionViewMode, clearPrescriptionEvaluation } =
		useAuditPayload();

	const [filter, setFilter] = useState<GeoEngineExposureFilter>('all');
	const [isLoading, setIsLoading] = useState(false);
	const [currentStep, setCurrentStep] = useState(0);
	const [isApplied, setIsApplied] = useState(false);
	const [viewMode, setViewMode] = useState<PrescriptionViewMode>('before');
	const [keywordEditorRequest, setKeywordEditorRequest] = useState(0);
	const [afterReport, setAfterReport] = useState<GeoDiagnosticReport | null>(null);
	const [appliedPatches, setAppliedPatches] = useState<AppliedGeoPatches | null>(null);
	const [queryCoverage, setQueryCoverage] = useState<ExpandedQueryCoverage | null>(null);
	const [keywordWeights, setKeywordWeights] = useState<KeywordWeight[] | null>(null);
	const [recommendationReasons, setRecommendationReasons] = useState<RecommendationReason[] | null>(null);
	const [applyError, setApplyError] = useState<string | null>(null);
	const [progress, setProgress] = useState(0);
	const [isCopyCenterOpen, setIsCopyCenterOpen] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
	const abortRef = useRef<AbortController | null>(null);
	const siteKey = `${report.targetUrl}|${report.brandName}`;

	const handleAnswerCenterKeywords = useCallback(
		(keywords: string[]) => {
			setAfterReport((prev) =>
				prev ? syncAfterReportToBeQueries(prev, keywords, location || '', lang) : prev,
			);
		},
		[location, lang],
	);

	useEffect(() => {
		const onOpenAnswerCenter = (event: Event) => {
			const module = event instanceof CustomEvent ? (event.detail as OpenGeoAnswerCenterDetail | undefined)?.module : undefined;
			if (isApplied) {
				setViewMode('after');
				setIsCopyCenterOpen(true);
				setPrescriptionViewMode('after');
				window.setTimeout(() => {
					const target =
						document.getElementById(geoAnswerCenterModuleAnchor(module)) ||
						document.getElementById(GEO_ANSWER_CENTER_ID);
					target?.scrollIntoView({
						behavior: 'smooth',
						block: 'start',
					});
				}, 140);
				return;
			}
			document.getElementById('geo-apply-prescription')?.scrollIntoView({
				behavior: 'smooth',
				block: 'center',
			});
		};
		window.addEventListener(OPEN_GEO_ANSWER_CENTER_EVENT, onOpenAnswerCenter);
		return () => window.removeEventListener(OPEN_GEO_ANSWER_CENTER_EVENT, onOpenAnswerCenter);
	}, [isApplied, setPrescriptionViewMode]);

	useCustomSelectBoxes('#trigger-keyword-depth', [
		isCopyCenterOpen,
		isApplied,
		viewMode,
		keywordEditorRequest,
		keywordWeights,
	]);

	const patchOpts: PrescriptionAfterOptions = useMemo(
		() => ({
			industryType,
			category: category || report.brandName,
			location,
			targetKeywords,
			existingSchemaTypes: currentSchema,
			description: description || ogDescription,
			ogTitle,
			ogDescription: ogDescription || description,
			businessEntity: category,
			entityPhrases: targetKeywords,
			needSignals,
			nap: auditReport ? napFromAuditReport(auditReport) : { name: report.brandName },
			title: title || ogTitle,
			metaKeywords,
			navMenuTexts,
		}),
		[industryType, category, location, targetKeywords, currentSchema, report.brandName, description, ogTitle, ogDescription, needSignals, auditReport, title, metaKeywords, navMenuTexts],
	);

	const reachMode = viewMode === 'after' ? 'toBe' : 'asIs';
	const reachState = useMemo(
		() =>
			buildSiteReachState({
				before: report,
				after: afterReport,
				isPrescriptionApplied: isApplied,
				lang,
				location,
				specialties: targetKeywords,
				category,
			}),
		[report, afterReport, isApplied, lang, location, targetKeywords, category],
	);
	const activeReach = reachMode === 'toBe' ? reachState.toBe : reachState.asIs;
	const showAfterView = reachMode === 'toBe';
	const displayedReport = isApplied && showAfterView && afterReport ? afterReport : report;
	const conversionModel = useMemo(
		() =>
			businessConversionFromGeo(report, {
				industryType,
				category,
				location,
				targetKeywords,
				lang,
			}),
		[report, industryType, category, location, targetKeywords, lang],
	);

	useEffect(() => {
		return () => {
			for (const id of timersRef.current) window.clearTimeout(id);
			abortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		if (!isLoading) return;
		const started = Date.now();
		const id = window.setInterval(() => {
			const pct = Math.min(92, 8 + ((Date.now() - started) / MIN_WAIT_MS) * 84);
			setProgress(pct);
		}, 80);
		return () => window.clearInterval(id);
	}, [isLoading]);

	useEffect(() => {
		for (const id of timersRef.current) window.clearTimeout(id);
		timersRef.current = [];
		abortRef.current?.abort();
		setIsLoading(false);
		setCurrentStep(0);
		setIsApplied(false);
		setViewMode('before');
		setKeywordEditorRequest(0);
		setAfterReport(null);
		setAppliedPatches(null);
		setQueryCoverage(null);
		setKeywordWeights(null);
		setRecommendationReasons(null);
		setApplyError(null);
		setProgress(0);
		setFilter('all');
		setIsCopyCenterOpen(false);
		clearPrescriptionEvaluation();
	}, [siteKey, clearPrescriptionEvaluation]);

	const counts = useMemo(() => {
		const engines = reachEngineList(activeReach);
		let excellent = 0;
		let needsWork = 0;
		for (const engine of engines) {
			if (engine.level === 3) excellent += 1;
			else needsWork += 1;
		}
		return { all: engines.length, excellent, needsWork };
	}, [activeReach]);

	const filteredEngines = useMemo(() => {
		const allowed = new Set(
			reachEngineList(activeReach)
				.filter((engine) => {
					if (filter === 'all') return true;
					if (filter === 'excellent') return engine.level === 3;
					return engine.level !== 3;
				})
				.map((engine) => engine.engineId),
		);
		return displayedReport.engines.filter((engine) => allowed.has(engine.engine.id));
	}, [activeReach, displayedReport.engines, filter]);

	function clearTimers() {
		for (const id of timersRef.current) window.clearTimeout(id);
		timersRef.current = [];
	}

	async function handleApplyPrescription(options?: { reapply?: boolean }) {
		if (isLoading) return;
		clearTimers();
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		const reapply = Boolean(options?.reapply);

		setIsLoading(true);
		setCurrentStep(1);
		if (!reapply) {
			setIsApplied(false);
			setViewMode('before');
		}
		setApplyError(null);
		setProgress(8);
		setQueryCoverage(null);
		setKeywordWeights(null);
		setRecommendationReasons(null);

		timersRef.current = [
			setTimeout(() => setCurrentStep(2), STEP_MS),
			setTimeout(() => setCurrentStep(3), STEP_MS * 2),
		];

		const started = Date.now();
		let payload: ApplyPrescriptionResponse | null = null;

		try {
			const res = await fetch('/api/geo/apply-prescription', {
				method: 'POST',
				cache: 'no-store',
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					Pragma: 'no-cache',
				},
				signal: controller.signal,
				body: JSON.stringify({
					siteId: siteId || undefined,
					targetUrl: report.targetUrl,
					currentSchema: currentSchema || [],
					targetKeywords: targetKeywords || [],
					lang,
					brandName: report.brandName,
					category: category || report.triggerQueries[2],
					location,
					industryType,
					beforeLevels: beforeLevelsFromReport(report),
					beforeReport: report,
					forceRefresh: true,
					t: Date.now(),
				}),
			});
			const data: unknown = await res.json().catch(() => null);
			if (res.ok && isApplyResponse(data)) {
				payload = data;
			} else {
				const message =
					data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
						? (data as { error: string }).error
						: t('applyError');
				setApplyError(message);
			}
		} catch (err) {
			if ((err as { name?: string })?.name === 'AbortError') return;
			setApplyError(t('applyError'));
		}

		if (!payload) {
			const fallbackAfter = buildPrescriptionAfterReport(report, lang, patchOpts);
			const beforeLevels = beforeLevelsFromReport(report);
			const afterById = new Map(fallbackAfter.engines.map((engine) => [engine.engine.id, engine.depthLevel]));
			payload = {
				siteUrl: report.targetUrl,
				appliedPatches: buildClientAppliedPatches(report, lang, patchOpts),
				levelChanges: {
					chatgpt: { before: beforeLevels.chatgpt ?? 0, after: afterById.get('chatgpt') ?? 3 },
					gemini: { before: beforeLevels.gemini ?? 0, after: afterById.get('gemini') ?? 2 },
					claude: { before: beforeLevels.claude ?? 0, after: afterById.get('claude') ?? 2 },
					perplexity: { before: beforeLevels.perplexity ?? 0, after: afterById.get('perplexity') ?? 3 },
					copilot: { before: beforeLevels.copilot ?? 0, after: afterById.get('copilot') ?? 2 },
					clova: { before: beforeLevels.clova ?? 0, after: afterById.get('clova') ?? 2 },
				},
				aiSimulations: [],
				afterReport: fallbackAfter,
				expandedQueryCoverage: buildClientQueryCoverage(report, lang, patchOpts),
				keywordWeights: buildClientKeywordWeights(report, lang, patchOpts),
				recommendationReasons: buildClientRecommendationReasons(report, lang, patchOpts),
				scraped: false,
			};
		} else {
			if (!isExpandedQueryCoverage(payload.expandedQueryCoverage)) {
				payload = {
					...payload,
					expandedQueryCoverage: buildClientQueryCoverage(report, lang, patchOpts),
				};
			}
			if (!isKeywordWeights(payload.keywordWeights)) {
				payload = {
					...payload,
					keywordWeights: buildClientKeywordWeights(report, lang, patchOpts),
				};
			}
			if (!isRecommendationReasons(payload.recommendationReasons)) {
				payload = {
					...payload,
					recommendationReasons: buildClientRecommendationReasons(report, lang, patchOpts),
				};
			}
		}

		const remaining = MIN_WAIT_MS - (Date.now() - started);
		if (remaining > 0) {
			await new Promise((resolve) => {
				const id = setTimeout(resolve, remaining);
				timersRef.current.push(id);
			});
		}

		if (controller.signal.aborted) return;
		clearTimers();
		setProgress(100);
		setAfterReport(payload.afterReport);
		setAppliedPatches(payload.appliedPatches);
		setQueryCoverage(payload.expandedQueryCoverage);
		setKeywordWeights(payload.keywordWeights);
		setRecommendationReasons(payload.recommendationReasons);
		setIsLoading(false);
		setCurrentStep(0);
		setIsApplied(true);
		setViewMode('after');
		setFilter('all');

		const baseline = auditReport;
		if (baseline) {
			const afterExpected = buildAfterPrescriptionAuditReport(
				baseline,
				payload.afterReport,
				payload.appliedPatches,
			);
			const measured = buildPrescriptionTrackingOverlay(baseline, afterExpected);
			const expected = expectedScoresFromProjectedReport(afterExpected);
			const appliedAt = measured.prescriptionAppliedAt || new Date().toISOString();
			persistAppliedTrackingEvent({
				hostname: hostnameFromAuditUrl(baseline.url),
				type: 'PATCH_APPLIED',
				timestamp: appliedAt,
				expectedScore: expected.expectedScore,
				expectedCitation: expected.expectedCitation,
				expectedTechnical: expected.expectedTechnical,
				expectedExternalTrust: expected.expectedExternalTrust,
				metadata: {
					summary: [payload.appliedPatches.schemaType, payload.appliedPatches.faqCount
						? `FAQ ${payload.appliedPatches.faqCount}`
						: null]
						.filter(Boolean)
						.join(' · '),
					schemaType: payload.appliedPatches.schemaType,
					faqCount: payload.appliedPatches.faqCount,
					patches: [
						'Schema.org',
						payload.appliedPatches.faqCount > 0 ? 'FAQPage' : null,
						'llms.txt',
					].filter((name): name is string => Boolean(name)),
					expectedScore: expected.expectedScore,
					expectedCitation: expected.expectedCitation,
				},
			});
			setEvaluationResult(measured);
			setAppliedResult({
				appliedAt,
				viewMode: 'after',
				afterAudit: afterExpected,
				afterGeo: payload.afterReport,
				expectedScore: expected.expectedScore,
				expectedCitationScore: expected.expectedCitation,
				trackingStatus: 'SYNCING',
			});
		}
	}

	const handleViewModeChange = useCallback(
		(next: PrescriptionViewMode) => {
			setViewMode(next);
			if (isApplied) setPrescriptionViewMode(next);
		},
		[isApplied, setPrescriptionViewMode],
	);

	const handleReachModeChange = useCallback(
		(next: 'asIs' | 'toBe') => {
			handleViewModeChange(next === 'toBe' ? 'after' : 'before');
		},
		[handleViewModeChange],
	);

	function handleApplyClick() {
		setIsCopyCenterOpen(true);
		void handleApplyPrescription();
	}

	function handleReapplyClick() {
		setIsCopyCenterOpen(true);
		setViewMode('after');
		setKeywordEditorRequest((n) => n + 1);
		void handleApplyPrescription({ reapply: true });
		window.requestAnimationFrame(() => {
			document.getElementById('geo-answer-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}

	const filterLabel: Record<GeoEngineExposureFilter, string> = {
		all: t('filterAll'),
		excellent: t('filterExcellent'),
		needs_work: t('filterNeedsWork'),
	};
	const filterCount: Record<GeoEngineExposureFilter, number> = {
		all: counts.all,
		excellent: counts.excellent,
		needs_work: counts.needsWork,
	};

	const stepLabel = (step: number) => t(`steps.${step}`, { url: report.targetUrl, brand: report.brandName });

	const viewSlideX = viewMode === 'after' ? 28 : -28;

	const showPrescriptionExtras = isApplied && showAfterView && Boolean(afterReport);

	return (
		<SiteReachProvider state={reachState} mode={reachMode} onModeChange={handleReachModeChange}>
			<div id="trigger-keyword-depth" className="scroll-mt-24 flex flex-col gap-6">
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={`summary-${viewMode}-${isApplied ? 'on' : 'off'}`}
					initial={reduceMotion ? false : { opacity: 0, x: viewSlideX }}
					animate={{ opacity: 1, x: 0 }}
					exit={reduceMotion ? undefined : { opacity: 0, x: -viewSlideX * 0.45 }}
					transition={{ duration: reduceMotion ? 0 : 0.32, ease: VIEW_EASE }}
					className="overflow-hidden"
				>
					<AIEngineSummaryHeader report={displayedReport} isAfter={showAfterView} />
				</motion.div>
			</AnimatePresence>

			<div className="flex flex-col gap-3">
				<AnimatePresence initial={false}>
					{isApplied ? (
						<motion.div
							key="before-after-tab-nav"
							initial={reduceMotion ? false : { opacity: 0, y: -10, height: 0 }}
							animate={{ opacity: 1, y: 0, height: 'auto' }}
							exit={reduceMotion ? undefined : { opacity: 0, y: -8, height: 0 }}
							transition={{ duration: reduceMotion ? 0 : 0.28, ease: VIEW_EASE }}
							className="overflow-hidden"
						>
							<BeforeAfterTabNav value={viewMode} onChange={handleViewModeChange} disabled={isLoading} />
						</motion.div>
					) : null}
				</AnimatePresence>

				<div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-3 sm:px-4 sm:py-3">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div
							role="radiogroup"
							aria-label={t('filterAria')}
							className="flex flex-wrap gap-1.5"
						>
							{FILTERS.map((id) => {
								const active = filter === id;
								return (
									<button
										key={id}
										type="button"
										role="radio"
										aria-checked={active}
										onClick={() => setFilter(id)}
										className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
											active
												? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-sm shadow-indigo-500/30'
												: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.14]'
										}`}
									>
										{filterLabel[id]}
										<span className={`ml-1.5 tabular-nums ${active ? 'text-white/80' : 'text-slate-400'}`}>
											{filterCount[id]}
										</span>
									</button>
								);
							})}
						</div>

						<div id="geo-apply-prescription" className="scroll-mt-24">
							<ApplyPrescriptionButton
								isApplied={isApplied}
								isLoading={isLoading}
								onApply={handleApplyClick}
								onReapply={handleReapplyClick}
							/>
						</div>
					</div>

					{applyError && isApplied ? (
						<p className="print:hidden text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">{applyError}</p>
					) : null}
				</div>

				<CompetitorLeakageRoiBanner model={conversionModel} applied={isApplied && showAfterView} />
			</div>

			<AnimatePresence initial={false}>
				{isLoading ? (
					<motion.div
						key="prescription-steps"
						initial={reduceMotion ? false : { opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.22 }}
						className="print:hidden overflow-hidden"
						aria-live="polite"
					>
						<ol className="flex flex-col gap-1.5 rounded-xl border border-indigo-200/80 dark:border-indigo-400/20 bg-indigo-50/70 dark:bg-indigo-500/[0.08] px-3.5 py-3">
							<li className="mb-1">
								<div className="mb-1.5 flex items-center justify-between gap-2">
									<p className="text-[11px] font-extrabold text-indigo-800 dark:text-indigo-200">
										{t('progressLabel')}
									</p>
									<span className="tabular-nums text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
										{Math.round(progress)}%
									</span>
								</div>
								<div
									className="h-1.5 overflow-hidden rounded-full bg-indigo-100 dark:bg-white/10"
									role="progressbar"
									aria-valuemin={0}
									aria-valuemax={100}
									aria-valuenow={Math.round(progress)}
								>
									<div
										className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-[width] duration-150"
										style={{ width: `${Math.max(8, Math.min(100, progress))}%` }}
									/>
								</div>
							</li>
							{LOADING_STEPS.map((step) => {
								const done = currentStep > step;
								const active = currentStep === step;
								return (
									<li key={step} className="flex items-center gap-2 text-[12px] font-semibold">
										{done ? (
											<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
										) : active ? (
											<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600 dark:text-indigo-300" aria-hidden />
										) : (
											<span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300 dark:border-white/20" aria-hidden />
										)}
										<span
											className={
												active
													? 'animate-pulse text-indigo-800 dark:text-indigo-200'
													: done
														? 'text-emerald-800 dark:text-emerald-300'
														: 'text-slate-400'
											}
										>
											{stepLabel(step)}
										</span>
									</li>
								);
							})}
						</ol>
					</motion.div>
				) : null}
			</AnimatePresence>

			<div className={isLoading ? 'pointer-events-none opacity-60' : undefined}>
				<AIEngineCardList
					key={`${report.targetUrl}|${report.brandName}`}
					report={displayedReport}
					engines={filteredEngines}
					emptyLabel={t('emptyFilter')}
					emphasis={showAfterView ? 'post' : 'current'}
				/>
			</div>

			<AnimatePresence initial={false}>
				{showPrescriptionExtras && isCopyCenterOpen ? (
					<GEOPrescriptionCopyCenter
						key="geo-copy-center"
						report={report}
						lang={lang}
						opts={patchOpts}
						keywordWeights={keywordWeights}
						editorOpenRequest={keywordEditorRequest}
						onTargetKeywordsChange={handleAnswerCenterKeywords}
					/>
				) : null}
			</AnimatePresence>

			<AnimatePresence initial={false}>
				{showPrescriptionExtras && afterReport ? (
					<GEOResultReport
						key="geo-result-report"
						before={report}
						after={afterReport}
						lang={lang}
						patches={appliedPatches}
						coverage={queryCoverage}
						keywordWeights={keywordWeights}
						recommendationReasons={recommendationReasons}
					/>
				) : null}
			</AnimatePresence>
			</div>
		</SiteReachProvider>
	);
}

/** Audit-result entry point — one shared diagnostic snapshot for header + cards. */
export function GeoDiagnosticTabFromAudit({ audit, reportData }: GeoDiagnosticTabFromAuditProps) {
	const locale = useLocale();
	const { latest } = useAuditPayload();
	const report = useMemo(
		() => buildGeoDiagnosticReportFromAudit(audit, locale === 'en' ? 'en' : 'ko', reportData),
		[audit, locale, reportData],
	);
	const siteId = latest?.auditId && latest.report?.url === audit.url ? latest.auditId : undefined;
	const queryMatrix = generateQueryMatrix({
		lang: locale === 'en' ? 'en' : 'ko',
		siteMeta: audit.siteMeta,
		metrics: audit.metrics,
		detectedKeywords: audit.detectedKeywords,
	});
	const keywords = queryMatrix.targetKeywords.length
		? queryMatrix.targetKeywords
		: collectAuditTargetKeywords(audit);

	return (
		<GeoDiagnosticTab
			report={report}
			auditReport={audit}
			siteId={siteId}
			currentSchema={audit.metrics?.schemaTypes}
			targetKeywords={keywords}
			industryType={audit.siteMeta?.industryType}
			category={
				queryMatrix.slots.categoryNouns[0] ||
				audit.siteMeta?.businessEntity ||
				audit.siteMeta?.category ||
				audit.siteMeta?.primaryKeyword
			}
			location={queryMatrix.slots.location || audit.siteMeta?.location || audit.siteMeta?.broadLocation}
			description={audit.metrics?.metaDescription}
			ogTitle={audit.metrics?.pageTitle || audit.metrics?.documentTitle}
			ogDescription={audit.metrics?.metaDescription}
			needSignals={audit.siteMeta?.needSignals}
			title={audit.siteMeta?.title}
			metaKeywords={audit.siteMeta?.metaKeywords}
			navMenuTexts={audit.siteMeta?.navMenuTexts || audit.siteMeta?.coreSpecialties}
		/>
	);
}
