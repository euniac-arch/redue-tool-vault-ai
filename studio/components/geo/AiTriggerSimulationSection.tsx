'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ClipboardCopy, Lightbulb, Loader2, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { ENGINE_CHAT_THEME, ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import { PrescriptionAppliedBadge } from '@/components/geo/PrescriptionAppliedBadge';
import { ReachLevelGuideDetail, ReachLevelGuideOverview } from '@/components/geo/ReachLevelGuidePanel';
import { getReachLevelGuide, type ReachGuideLang } from '@/lib/geo/reach-level-guides';
import {
	AI_ENGINE_CATALOG,
	type AIEngineId,
	type GeoDiagnosticReport,
	type KeywordDepthLevel,
} from '@/types/geo-diagnostic';

export type LiveProbeStatus = 'idle' | 'loading' | 'completed';
export type TriggerSimMode = 'asIs' | 'toBe';

interface AiTriggerSimulationSectionProps {
	report: GeoDiagnosticReport;
	/** Active As-Is / To-Be trigger chips — must stay 1:1 with SiteReachState. */
	triggerQueries?: GeoDiagnosticReport['triggerQueries'];
	emphasis?: 'current' | 'post';
	simMode: TriggerSimMode;
	onSimModeChange: (mode: TriggerSimMode) => void;
	selectedLevel: KeywordDepthLevel;
	onSelectedLevelChange: (level: KeywordDepthLevel) => void;
	/** Query level last committed by a simulation run (drives result cards). */
	resultLevel?: KeywordDepthLevel;
	isPrescriptionApplied?: boolean;
	onRunSimulation?: (level: KeywordDepthLevel) => void;
	children: ReactNode;
	/** Reset accordion defaults (all collapsed) when a simulation finishes. */
	onProbeCompleted?: () => void;
	/** Engines still at Level 2 — shown as a Level 3 lift callout. */
	level2EngineNames?: readonly string[];
}

const QUERY_LEVELS: KeywordDepthLevel[] = [1, 2, 3];
const STEP_MS = 400;
const REVEAL_MS = 400;

/** Rolling order matches the live-probe spec (not catalog order). */
const PROBE_STEPS: readonly { id: AIEngineId; at: number }[] = [
	{ id: 'chatgpt', at: 12 },
	{ id: 'perplexity', at: 28 },
	{ id: 'gemini', at: 44 },
	{ id: 'claude', at: 60 },
	{ id: 'copilot', at: 76 },
	{ id: 'clova', at: 90 },
];

function probeMonthLabel(iso: string): string {
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) {
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	}
	return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

export function AiTriggerSimulationSection({
	report,
	triggerQueries,
	emphasis = 'current',
	simMode,
	onSimModeChange,
	selectedLevel,
	onSelectedLevelChange,
	resultLevel,
	isPrescriptionApplied = false,
	onRunSimulation,
	children,
	onProbeCompleted,
	level2EngineNames = [],
}: AiTriggerSimulationSectionProps) {
	const t = useTranslations('audit.aiEngineCards');
	const locale = useLocale();
	const lang: ReachGuideLang = locale === 'en' ? 'en' : 'ko';
	const reduceMotion = useReducedMotion();

	const [probeStatus, setProbeStatus] = useState<LiveProbeStatus>(emphasis === 'post' ? 'completed' : 'idle');
	const [hasCompletedOnce, setHasCompletedOnce] = useState(emphasis === 'post');
	const [progress, setProgress] = useState(0);
	const [progressStepText, setProgressStepText] = useState('');
	const [copied, setCopied] = useState(false);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
	const abortRef = useRef<AbortController | null>(null);
	const emphasisRef = useRef(emphasis);
	emphasisRef.current = emphasis;
	const onProbeCompletedRef = useRef(onProbeCompleted);
	onProbeCompletedRef.current = onProbeCompleted;
	const siteKey = `${report.targetUrl}|${report.brandName}`;

	const queries = triggerQueries ?? report.triggerQueries;
	const selectedQuery = queries[selectedLevel] || queries[3];

	const stepCopy = useCallback(
		(index: number, engineId: AIEngineId) => {
			const engine = AI_ENGINE_CATALOG[engineId].name;
			return `${t('progressStep', { index, total: PROBE_STEPS.length, engine })} ${t(`progressHint.${engineId}`)}`;
		},
		[t],
	);

	function clearTimers() {
		for (const id of timersRef.current) clearTimeout(id);
		timersRef.current = [];
	}

	useEffect(() => {
		return () => {
			clearTimers();
			abortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		clearTimers();
		abortRef.current?.abort();
		setProbeStatus(emphasisRef.current === 'post' ? 'completed' : 'idle');
		setHasCompletedOnce(emphasisRef.current === 'post');
		setProgress(0);
		setProgressStepText('');
		setCopied(false);
	}, [siteKey]);

	useEffect(() => {
		if (emphasis === 'post' && probeStatus === 'idle') {
			setHasCompletedOnce(true);
			setProbeStatus('completed');
		}
	}, [emphasis, probeStatus]);

	useEffect(() => {
		if (hasCompletedOnce && probeStatus === 'idle') {
			setProbeStatus('completed');
		}
	}, [hasCompletedOnce, probeStatus, simMode]);

	const finishProbe = useCallback(
		(controller: AbortController) => {
			if (controller.signal.aborted) return;
			setProgress(100);
			setProgressStepText(t('progressComplete'));
			const revealId = setTimeout(() => {
				onProbeCompletedRef.current?.();
				setHasCompletedOnce(true);
				setProbeStatus('completed');
			}, reduceMotion ? 0 : REVEAL_MS);
			timersRef.current.push(revealId);
		},
		[reduceMotion, t],
	);

	const handleRunSimulation = useCallback(async () => {
		if (probeStatus === 'loading') return;
		onRunSimulation?.(selectedLevel);
		clearTimers();
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setProbeStatus('loading');
		setProgress(8);
		setProgressStepText(stepCopy(1, PROBE_STEPS[0].id));

		PROBE_STEPS.forEach((step, index) => {
			if (index === 0) return;
			const id = setTimeout(() => {
				setProgress(step.at);
				setProgressStepText(stepCopy(index + 1, step.id));
			}, index * STEP_MS);
			timersRef.current.push(id);
		});

		const started = Date.now();
		try {
			await fetch('/api/audit/ai-visibility', {
				method: 'POST',
				cache: 'no-store',
				headers: { 'Content-Type': 'application/json' },
				signal: controller.signal,
				body: JSON.stringify({
					url: report.targetUrl,
					targetUrl: report.targetUrl,
					brandName: report.brandName,
					query: selectedQuery,
					lang,
					selectedLevel,
					queryLevel: selectedLevel,
					isPrescriptionApplied,
					simMode,
				}),
			});
		} catch (err) {
			if ((err as { name?: string })?.name === 'AbortError') return;
		}

		const remaining = PROBE_STEPS.length * STEP_MS - (Date.now() - started);
		if (remaining > 0) {
			await new Promise<void>((resolve) => {
				const id = setTimeout(resolve, remaining);
				timersRef.current.push(id);
			});
		}

		finishProbe(controller);
	}, [probeStatus, stepCopy, report.targetUrl, report.brandName, selectedQuery, lang, finishProbe, selectedLevel, isPrescriptionApplied, simMode, onRunSimulation]);

	const handleCopyPrompt = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(selectedQuery);
			setCopied(true);
			const id = setTimeout(() => setCopied(false), 2000);
			timersRef.current.push(id);
		} catch {
			setCopied(false);
		}
	}, [selectedQuery]);

	const fadeDuration = reduceMotion ? 0 : 0.5;
	const monthLabel = useMemo(() => probeMonthLabel(report.generatedAt), [report.generatedAt]);
	const roundedProgress = Math.round(progress);
	const isLoading = probeStatus === 'loading';
	const isToBe = simMode === 'toBe';
	const showResults = probeStatus === 'completed' || hasCompletedOnce;
	const resultLevelLabel = selectedLevel;

	return (
		<section
			id="sec-ai-engine-cards"
			className="pdf-page-item audit-report-section flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-6"
			aria-labelledby="ai-engine-cards-heading"
			aria-busy={isLoading}
		>
			<div className="border-b border-slate-200 pb-4 dark:border-white/[0.06]">
				<p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('kicker')}</p>
				<div className="flex flex-wrap items-center gap-2">
					<h2
						id="ai-engine-cards-heading"
						className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white sm:text-lg"
					>
						<span aria-hidden>🎯</span>
						<span>{t('title')}</span>
					</h2>
					{emphasis === 'post' ? <PrescriptionAppliedBadge /> : null}
				</div>
				<p className="max-w-3xl text-xs text-slate-400 mt-0.5 leading-relaxed">
					{t('subtitle')}
				</p>
			</div>

			<ReachLevelGuideOverview />

			<div className="print:hidden space-y-4 rounded-xl border border-slate-800/80 bg-slate-950/50 p-5 shadow-inner backdrop-blur-sm">
				<div>
					<div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
						<span className="h-1.5 w-1.5 rounded-full bg-indigo-400/80" aria-hidden />
						<span>{t('querySelectLabel')}</span>
					</div>
					<div
						role="radiogroup"
						aria-label={t('queryChipAria')}
						className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
					>
						{QUERY_LEVELS.map((level) => {
							const isSelected = selectedLevel === level;
							const query = queries[level];
							const guide = getReachLevelGuide(level, lang);
							return (
								<button
									key={level}
									type="button"
									role="radio"
									aria-checked={isSelected}
									disabled={isLoading}
									onClick={() => onSelectedLevelChange(level)}
									className={`relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-3.5 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
										isSelected
											? 'border-indigo-500/50 bg-gradient-to-b from-indigo-950/40 via-slate-900/80 to-slate-950 shadow-sm shadow-indigo-500/10'
											: 'border-slate-800/80 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900/60 hover:text-slate-300'
									}`}
								>
									<div className="mb-1 flex w-full items-center justify-between gap-1">
										<span
											className={`text-[11px] font-extrabold transition-colors duration-200 ${
												isSelected ? 'text-indigo-300' : 'text-slate-500'
											}`}
										>
											{guide.title}
										</span>
										{isSelected ? (
											<span className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300/90">
												<span className="h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden />
												<span>{t('queryLevelSelected')}</span>
											</span>
										) : (
											<span className="h-1.5 w-1.5 rounded-full bg-slate-800" aria-hidden />
										)}
									</div>
									<span
										className={`mb-1.5 inline-flex w-fit rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${
											isSelected
												? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
												: 'border-slate-700/80 bg-slate-900/80 text-slate-400'
										}`}
									>
										{guide.badgeText}
									</span>
									<p
										className={`mb-1.5 text-[11px] leading-snug ${
											isSelected ? 'text-slate-300' : 'text-slate-500'
										}`}
									>
										{guide.shortDesc}
									</p>
									<span
										className={`truncate text-xs leading-snug transition-colors duration-200 ${
											isSelected ? 'font-bold text-slate-100' : 'font-medium text-slate-400'
										}`}
									>
										{query}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				<ReachLevelGuideDetail selectedLevel={selectedLevel} />

				<div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs">
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<span className="shrink-0 font-bold text-indigo-400">{t('queryPreviewLabel')}:</span>
						<span className="truncate font-mono text-slate-200">&ldquo;{selectedQuery}&rdquo;</span>
					</div>
					<button
						type="button"
						onClick={() => void handleCopyPrompt()}
						title={t('copyPromptTitle')}
						className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-300 transition-all hover:bg-slate-700"
					>
						{copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />}
						<span>{copied ? t('copyPromptDone') : t('copyPrompt')}</span>
					</button>
				</div>

				<div className="flex flex-col justify-between gap-3 border-t border-slate-800/80 pt-3 sm:flex-row sm:items-center">
					<div className="flex items-center gap-1.5 text-[11px] text-slate-400">
						<Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
						<span className="transition-colors duration-200">{isToBe ? t('consoleHintToBe') : t('consoleHintAsIs')}</span>
					</div>

					<button
						type="button"
						onClick={() => void handleRunSimulation()}
						disabled={isLoading}
						className="flex shrink-0 cursor-pointer items-center justify-center gap-2 self-end rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
					>
						{isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Zap className="h-3.5 w-3.5" aria-hidden />}
						<span>
							{isLoading ? t('probingCta') : probeStatus === 'completed' ? t('rerunCta') : t('startCta')}
						</span>
					</button>
				</div>
			</div>

			<AnimatePresence initial={false}>
				{isLoading ? (
					<motion.div
						key="probe-loading"
						initial={reduceMotion ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={reduceMotion ? undefined : { opacity: 0 }}
						transition={{ duration: reduceMotion ? 0 : 0.28, ease: 'easeOut' }}
						className="print:hidden space-y-2 rounded-xl border border-indigo-500/30 bg-slate-950/80 p-5"
						aria-live="polite"
					>
						<div className="flex items-center justify-between gap-3 text-xs">
							<span className="flex min-w-0 items-center gap-2 font-bold text-indigo-300">
								<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
								<span className="min-w-0">{progressStepText}</span>
							</span>
							<span className="shrink-0 font-mono font-bold tabular-nums text-indigo-400">{roundedProgress}%</span>
						</div>
						<div
							className="h-1.5 overflow-hidden rounded-full bg-slate-800"
							role="progressbar"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={roundedProgress}
							aria-label={progressStepText}
						>
							<div
								className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
								style={{ width: `${Math.max(6, Math.min(100, progress))}%` }}
							/>
						</div>
						<ol className="flex flex-wrap gap-1.5">
							{PROBE_STEPS.map((step, index) => {
								const reached = progress >= step.at || progress >= 100;
								const Glyph = ENGINE_GLYPH[step.id];
								const theme = ENGINE_CHAT_THEME[step.id];
								return (
									<li
										key={step.id}
										className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
											reached ? 'bg-white/10 text-indigo-100 ring-1 ring-indigo-400/30' : 'text-slate-500'
										}`}
									>
										<span className={`inline-flex h-4 w-4 items-center justify-center rounded ${theme.logoWrap}`}>
											<Glyph className="h-2.5 w-2.5" />
										</span>
										{index + 1}/{PROBE_STEPS.length} {AI_ENGINE_CATALOG[step.id].name}
									</li>
								);
							})}
						</ol>
					</motion.div>
				) : null}
			</AnimatePresence>

			<div className={showResults ? 'block' : 'hidden print:block'}>
				<motion.div
					key={showResults ? 'probe-results-visible' : 'probe-results-hidden'}
					initial={reduceMotion || !showResults ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: fadeDuration, ease: 'easeOut' }}
					className="flex flex-col gap-4"
					data-selected-level={selectedLevel}
					data-result-level={resultLevel ?? selectedLevel}
					data-prescription-applied={isPrescriptionApplied ? 'true' : 'false'}
					data-sim-mode={simMode}
				>
					<div className="flex flex-col justify-between gap-2.5 px-1 pb-1 sm:flex-row sm:items-center">
						<div className="flex flex-wrap items-center gap-2">
							<span
								className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-200 ${isToBe ? 'bg-emerald-500' : 'bg-rose-500'}`}
								aria-hidden
							/>
							<span
								className={`text-xs font-bold transition-colors duration-200 ${isToBe ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
							>
								{isToBe ? t('resultBannerToBe') : t('resultBannerAsIs')}
							</span>
							<span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-extrabold text-indigo-300">
								{t('resultLevelLabel', { level: resultLevelLabel })}
							</span>
						</div>

						<div
							role="tablist"
							aria-label={t('simModeAria')}
							className="flex shrink-0 items-center self-start rounded-xl border border-slate-800/80 bg-slate-950/50 p-1 shadow-inner sm:self-auto"
						>
							<button
								type="button"
								role="tab"
								aria-selected={!isToBe}
								onClick={() => onSimModeChange('asIs')}
								className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition-all duration-200 ease-in-out ${
									!isToBe
										? 'border border-rose-500/30 bg-rose-500/15 text-rose-300 shadow-sm'
										: 'border border-transparent text-slate-400 hover:text-slate-200'
								}`}
							>
								<span aria-hidden>🔴</span>
								<span>{t('simModeAsIsCompact')}</span>
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={isToBe}
								onClick={() => onSimModeChange('toBe')}
								className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-extrabold transition-all duration-200 ease-in-out ${
									isToBe
										? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-sm'
										: 'border border-transparent text-slate-400 hover:text-slate-200'
								}`}
							>
								<span aria-hidden>🟢</span>
								<span>{t('simModeToBeCompact')}</span>
							</button>
						</div>
					</div>
					{level2EngineNames.length ? (
						<p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-3.5 py-2.5 text-[11px] leading-relaxed text-amber-100">
							<span aria-hidden>⚡ </span>
							{t('level2StuckBanner', { engines: level2EngineNames.join(' · ') })}
						</p>
					) : null}
					{children}
					<p className="pt-1 text-right text-[11px] leading-relaxed text-slate-500">
						{t('liveDisclaimer', { month: monthLabel })}
					</p>
				</motion.div>
			</div>
		</section>
	);
}
