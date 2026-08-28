'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { analyzeStrategy } from '@/lib/strategy/common-engine';
import { placeholderKeywordExamples, resolveStrategyDefaultKeyword } from '@/lib/strategy/default-keyword';
import { buildRecommendedKeywordGroups } from '@/lib/strategy/recommended-keywords';
import { applyCopilotOverride, buildCopilotContext, currentTextForTarget } from '@/lib/strategy/copilot';
import { buildStrategyStudioHref } from '@/lib/strategy/strategy-url';
import type { AuditHistoryEntry } from '@/lib/audit/history-entry';
import type {
	CopilotRefineTarget,
	ExecutionBlueprint,
	StrategyResult,
	StrategyStudioState,
} from '@/lib/strategy/types';
import { StrategyAiRefineButton } from '@/components/strategy/StrategyAiRefineButton';
import { StrategyExecutionBlueprint } from '@/components/strategy/StrategyExecutionBlueprint';
import { StrategySearchMap } from '@/components/strategy/StrategySearchMap';
import { StrategySiteSwitcher } from '@/components/strategy/StrategySiteSwitcher';
import { highlightKeywordMarks, readableRefineText } from '@/components/strategy/strategy-highlight';
import { StrategicGapWorkspace } from '@/components/strategy/StrategicGapWorkspace';
import { StudioSectionHeader } from '@/components/strategy/StudioSectionHeader';
import {
	COMMAND_BAR,
	COMMAND_BAR_CHIP,
	COMMAND_BAR_CHIP_ACTIVE,
	COMMAND_BAR_CHIP_IDLE,
	COMMAND_BAR_SUBMIT_ACTIVE,
	COMMAND_BAR_SUBMIT_IDLE,
	LAYER_ANALYSIS,
	LAYER_CONTEXT,
	LAYER_EXECUTION,
	META_LABEL,
	MODULE_TITLE,
	RESULT_SECTION_DESC,
	RESULT_SECTION_EYEBROW,
	RESULT_SECTION_RULE,
	RESULT_SECTION_TITLE,
	STUDIO_CTA,
	STUDIO_CTA_GHOST,
	STUDIO_GRADIENT,
	STUDIO_KICKER,
	STUDIO_MODULE,
} from '@/components/strategy/strategy-ui';

const ANALYZE_STEP_COUNT = 6;
const ANALYZE_STEP_MS = 120;
const ANALYZE_HOLD_MS = 150;
const ANALYZE_EXIT_MS = 180;

function sameKeyword(left: string, right: string) {
	return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function waitMs(ms: number) {
	return new Promise<void>((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

async function runAnalyzeStepAnimation(onStep: (step: number) => void) {
	for (let step = 1; step <= ANALYZE_STEP_COUNT; step += 1) {
		onStep(step);
		await waitMs(ANALYZE_STEP_MS);
	}
	await waitMs(ANALYZE_HOLD_MS);
}

export function StrategyWorkspace({
	state,
	initialKeyword,
	history = [],
	historyLoading = false,
}: {
	state: StrategyStudioState;
	initialKeyword?: string;
	history?: AuditHistoryEntry[];
	historyLoading?: boolean;
}) {
	const t = useTranslations('strategyStudio');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const router = useRouter();
	const ctx = state.auditContext;
	const profile = state.industryProfile;
	if (!ctx || !profile) return null;
	const inputRef = useRef<HTMLInputElement>(null);
	const sampleRef = useRef<HTMLDivElement>(null);
	const analyzeRunRef = useRef(0);
	const lastAnalyzedRef = useRef('');

	const recommended = useMemo(() => buildRecommendedKeywordGroups(ctx, profile, lang), [ctx, profile, lang]);
	const defaultKeyword = useMemo(
		() =>
			resolveStrategyDefaultKeyword({
				queryKeyword: initialKeyword,
				groups: recommended,
				ctx,
				profile,
				lang,
			}),
		[initialKeyword, recommended, ctx, profile, lang],
	);
	const placeholderExamples = placeholderKeywordExamples(recommended);
	const [draft, setDraft] = useState(defaultKeyword || state.targetKeyword.value || '');
	const [result, setResult] = useState<StrategyResult | null>(null);
	const [sampleNote, setSampleNote] = useState(false);
	const [blueprint, setBlueprint] = useState<ExecutionBlueprint | null>(null);
	const [strategyNote, setStrategyNote] = useState('');
	const [analyzing, setAnalyzing] = useState(false);
	const [analyzingStep, setAnalyzingStep] = useState(1);
	const [analyzeExiting, setAnalyzeExiting] = useState(false);

	function commitResult(next: StrategyResult | null) {
		setResult(next);
		setBlueprint(next?.blueprint ?? null);
		setStrategyNote('');
		setSampleNote(false);
	}

	function handleAnalyze(raw: string, immediate = false) {
		const keyword = raw.trim();
		if (!keyword) return;
		setDraft(keyword);
		lastAnalyzedRef.current = keyword;
		const next = analyzeStrategy({ keyword, ctx, profile, lang });
		if (ctx.auditId) router.replace(buildStrategyStudioHref(ctx.auditId, keyword, ctx.url), { scroll: false });
		if (immediate) {
			analyzeRunRef.current += 1;
			commitResult(next);
			setAnalyzing(false);
			setAnalyzeExiting(false);
			return;
		}

		const runId = analyzeRunRef.current + 1;
		analyzeRunRef.current = runId;
		setAnalyzingStep(1);
		setAnalyzeExiting(false);
		setAnalyzing(true);

		void (async () => {
			try {
				await Promise.all([
					Promise.resolve(next),
					runAnalyzeStepAnimation((step) => {
						if (analyzeRunRef.current === runId) setAnalyzingStep(step);
					}),
				]);
				if (analyzeRunRef.current !== runId) return;
				setAnalyzeExiting(true);
				await waitMs(ANALYZE_EXIT_MS);
				if (analyzeRunRef.current !== runId) return;
				commitResult(next);
			} finally {
				if (analyzeRunRef.current === runId) {
					setAnalyzing(false);
					setAnalyzeExiting(false);
				}
			}
		})();
	}

	useEffect(() => {
		return () => {
			analyzeRunRef.current += 1;
		};
	}, []);

	useEffect(() => {
		const boot = defaultKeyword.trim();
		if (!boot || sameKeyword(boot, lastAnalyzedRef.current)) return;
		setDraft(boot);
		lastAnalyzedRef.current = boot;
		const next = analyzeStrategy({ keyword: boot, ctx, profile, lang });
		commitResult(next);
	}, [ctx.auditId, ctx.url, defaultKeyword, ctx, profile, lang]);

	const hasKeyword = draft.trim().length > 0;
	const awaitingSubmit = hasKeyword && !analyzing && !sameKeyword(draft, result?.keyword ?? '');
	const backHref = ctx.auditId ? `/audit/result?id=${encodeURIComponent(ctx.auditId)}` : '/audit/history';
	const compactAxes = [
		{ label: 'Entity', score: ctx.scores.entity },
		{ label: 'Local', score: ctx.scores.local },
		{ label: 'Content', score: ctx.scores.content },
		{ label: 'Trust', score: ctx.scores.trust },
	].filter((row) => row.score);

	return (
		<div className="flex flex-col pb-16">
			<div className="mb-8 flex flex-wrap items-center justify-between gap-3">
				<Link href={backHref} className="text-sm text-slate-500 transition hover:text-slate-900 dark:hover:text-white">
					{t('backToResult')}
				</Link>
				<p className="text-[12px] text-slate-400">{t('handoffNote')}</p>
			</div>

			<header className="mb-10">
				<p className={STUDIO_KICKER}>{t('eyebrow')}</p>
				<h1 className="mt-4 text-[2rem] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-[2.5rem]">
					{t('heroLine1')}
					<br />
					<span className={STUDIO_GRADIENT}>{t('heroLine2')}</span>
				</h1>
				<p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{t('heroBody')}</p>
			</header>

			<div className={LAYER_CONTEXT}>
				<StudioSectionHeader no="01" title="AUDIT CONTEXT" description={t('contextDesc')} />

				<div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
					<div className={`${STUDIO_MODULE} px-6 py-6`}>
						<StrategySiteSwitcher
							currentId={ctx.auditId}
							currentUrl={ctx.url}
							currentIndustry={[profile.registryType.toUpperCase(), ctx.subIndustry].filter(Boolean).join(' / ')}
							history={history}
							loading={historyLoading}
						/>
						<div className="mt-6 grid gap-5 sm:grid-cols-2">
							<div>
								<p className={META_LABEL}>INDUSTRY</p>
								<p className="mt-1.5 text-[15px] font-medium text-slate-800 dark:text-slate-100">
									{[profile.registryType.toUpperCase(), ctx.subIndustry].filter(Boolean).join(' / ')}
								</p>
							</div>
							<div>
								<p className={META_LABEL}>LOCATION</p>
								<p className="mt-1.5 text-[15px] font-medium text-slate-800 dark:text-slate-100">
									{ctx.location || t('notExtracted')}
								</p>
							</div>
						</div>
					</div>

					<div>
						<p className={META_LABEL}>{t('currentAudit')}</p>
						<dl className="mt-3 space-y-2">
							{ctx.scores.seo ? <ScoreRow label="SEO" value={ctx.scores.seo.value} /> : null}
							{ctx.scores.geo ? <ScoreRow label="GEO" value={ctx.scores.geo.value} /> : null}
							{ctx.scores.aeo ? <ScoreRow label="AEO" value={ctx.scores.aeo.value} /> : null}
						</dl>
						{compactAxes.length ? (
							<ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
								{compactAxes.map((row) => (
									<li key={row.label} className="text-[12px] text-slate-500">
										<span className="font-semibold text-slate-600 dark:text-slate-300">{row.label}</span>
										{row.score ? <span className="ml-1.5 font-mono">{row.score.value}</span> : null}
									</li>
								))}
							</ul>
						) : null}
						<p className="mt-3 text-[12px] text-slate-400">{t('scoreHint')}</p>
					</div>
				</div>

				<section id="target-keyword" className="mt-14">
					<p className={META_LABEL}>TARGET KEYWORD</p>
					<h3 className={`mt-2 ${MODULE_TITLE}`}>{t('keywordQuestion')}</h3>
					<p className="mt-1 text-[14px] text-slate-500">{t('keywordCommandHint')}</p>
					<form
						className="mt-5"
						aria-busy={analyzing}
						onSubmit={(event) => {
							event.preventDefault();
							handleAnalyze(draft);
						}}
					>
						<div className={COMMAND_BAR}>
							<span
								className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 dark:text-slate-500"
								aria-hidden="true"
							>
								<svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
									<circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.6" />
									<path d="M12.4 12.4 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
								</svg>
							</span>
							<input
								id="strategy-keyword"
								ref={inputRef}
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								placeholder={
									placeholderExamples
										? t('keywordPlaceholderExamples', { examples: placeholderExamples })
										: t('keywordPlaceholder')
								}
								className="min-h-12 flex-1 bg-transparent px-1 text-[16px] tracking-tight text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
							/>
							<button
								type="submit"
								disabled={!hasKeyword || analyzing}
								className={`disabled:cursor-not-allowed ${
									hasKeyword
										? `${COMMAND_BAR_SUBMIT_ACTIVE} ${awaitingSubmit ? 'animate-strategy-cta-glow' : ''} disabled:hover:scale-100`
										: COMMAND_BAR_SUBMIT_IDLE
								}`}
							>
								<span>{t('analyze')}</span>
								<span
									aria-hidden="true"
									className={`transition-transform duration-200 ${hasKeyword ? 'group-hover/submit:translate-x-0.5' : ''}`}
								>
									→
								</span>
							</button>
						</div>
					</form>
					{recommended.chips.length ? (
						<div className="mt-4">
							<p className="text-[12px] text-slate-400">{t('recommendKeywords')}</p>
							<div className="mt-2 space-y-3">
								{(
									[
										['metro', t('recommendGroupMetro'), recommended.metro],
										['aeo', t('recommendGroupAeo'), recommended.aeo],
										['local', t('recommendGroupLocal'), recommended.local],
									] as const
								).map(([group, label, phrases]) =>
									phrases.length ? (
										<div key={group}>
											<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
											<div className="mt-1.5 flex flex-wrap gap-2">
												{phrases.map((example) => {
													const selected = sameKeyword(draft, example);
													return (
														<button
															key={`${group}-${example}`}
															type="button"
															aria-pressed={selected}
															disabled={analyzing}
															onClick={() => handleAnalyze(example)}
															className={`${COMMAND_BAR_CHIP} disabled:cursor-not-allowed disabled:opacity-60 ${
																selected ? COMMAND_BAR_CHIP_ACTIVE : COMMAND_BAR_CHIP_IDLE
															}`}
														>
															{selected ? (
																<span
																	className="h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.16)]"
																	aria-hidden="true"
																/>
															) : null}
															{example}
														</button>
													);
												})}
											</div>
										</div>
									) : null,
								)}
							</div>
						</div>
					) : null}
					{!result && !analyzing ? (
						<p className="mt-6 text-[15px] text-slate-500">{t('guidedEmpty')}</p>
					) : null}
				</section>

				{analyzing ? <AnalyzingPanel activeStep={analyzingStep} exiting={analyzeExiting} /> : null}
			</div>

			{result && !analyzing ? (
				<div className="animate-strategy-fade-in">
					<header className={RESULT_SECTION_RULE}>
						<p className={RESULT_SECTION_EYEBROW}>{t('resultSectionEyebrow')}</p>
						<h2 className={RESULT_SECTION_TITLE}>{t('resultSectionTitle')}</h2>
						<p className={RESULT_SECTION_DESC}>{t('resultSectionDesc')}</p>
					</header>
					<section aria-label={t('nowTitle')}>
						<div className="flex flex-wrap items-end justify-between gap-3">
							<div>
								<p className={META_LABEL}>{t('nowTitle')}</p>
								<p className="mt-1 text-[13px] text-slate-500">{t('nowHint')}</p>
							</div>
							<span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
								{result.strategyMap.confidence.label}
							</span>
						</div>
						<dl className="mt-5 grid gap-5 sm:grid-cols-2">
							<div>
								<dt className={META_LABEL}>TARGET</dt>
								<dd className="mt-1 text-[15px] font-semibold text-slate-900 dark:text-white">{result.strategyMap.summary.target}</dd>
							</div>
							<div>
								<dt className={META_LABEL}>PRIMARY INTENT</dt>
								<dd className="mt-1 text-[15px] font-semibold text-slate-900 dark:text-white">{result.strategyMap.summary.primaryIntent}</dd>
							</div>
							<div>
								<dt className={META_LABEL}>TOP GAP</dt>
								<dd className="mt-1 text-[15px] font-semibold text-slate-900 dark:text-white">{result.strategyMap.summary.topGap}</dd>
							</div>
							<div>
								<dt className={META_LABEL}>TOP ACTION</dt>
								<dd className="mt-1 text-[15px] font-semibold text-slate-900 dark:text-white">{result.strategyMap.summary.topAction}</dd>
							</div>
						</dl>
						<ol className="mt-5 space-y-2">
							{(result.blueprint?.action?.p0?.length ? result.blueprint.action.p0 : result.actionPlan.p0).slice(0, 3).map((item, index) => (
								<li key={item} className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
									<span className="mr-2 font-mono text-[12px] text-slate-400">P0.{index + 1}</span>
									{item}
								</li>
							))}
						</ol>
						<div className="mt-6 flex flex-wrap gap-2">
							<a href="#strategy-map" className={`${STUDIO_CTA} min-h-11 px-4 py-2 text-xs`}>
								{t('jumpMap')}
							</a>
							<a href="#gaps" className={`${STUDIO_CTA_GHOST} min-h-11 px-4 py-2 text-xs`}>
								{t('jumpGap')}
							</a>
							<a href="#execution-sample" className={`${STUDIO_CTA_GHOST} min-h-11 px-4 py-2 text-xs`}>
								{t('jumpBlueprint')}
							</a>
							<a href="#action-plan" className={`${STUDIO_CTA_GHOST} min-h-11 px-4 py-2 text-xs`}>
								{t('jumpAction')}
							</a>
						</div>
					</section>

					<nav
						className="sticky top-16 z-10 -mx-6 mt-8 overflow-x-auto border-y border-slate-200/80 bg-slate-50/90 px-6 py-3 backdrop-blur-sm dark:border-white/10 dark:bg-[#0a0d12]/90"
						aria-label={t('flowNav')}
					>
						<div className="flex min-w-max gap-1">
							{[
								['#target-keyword', 'KEYWORD'],
								['#strategy-map', 'ANALYSIS'],
								['#gaps', 'GAP'],
								['#execution-sample', 'BLUEPRINT'],
								['#action-plan', 'ACTION'],
							].map(([href, label]) => (
								<a
									key={href}
									href={href}
									className="rounded-md px-3 py-1.5 text-[11px] font-bold tracking-[0.14em] text-slate-500 transition hover:bg-white hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
								>
									{label}
								</a>
							))}
						</div>
					</nav>

					<div className={LAYER_ANALYSIS}>
						<StudioSectionHeader no="02" title="SEARCH ANALYSIS" description={t('analysisDesc')} id="strategy-map" />

						<section className="mb-12">
							<p className={MODULE_TITLE}>{t('profileTitle')}</p>
							<div className="mt-4 border-l-2 border-slate-300 pl-4 dark:border-white/20">
								<p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">
									INDUSTRY MATCH · {result.industry.relevance.toUpperCase()}
								</p>
								<p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">{result.industry.note}</p>
							</div>
							<div className="mt-4 flex flex-wrap gap-2">
								{result.normalized.location.map((item) => (
									<ParseChip key={`loc-${item}`} label={t('parsedLocation')} value={item} />
								))}
								{result.normalized.industry ? <ParseChip label={t('parsedIndustry')} value={result.normalized.industry} /> : null}
								{result.normalized.service ? <ParseChip label={t('parsedService')} value={result.normalized.service} /> : null}
								{result.normalized.problem ? <ParseChip label={t('parsedProblem')} value={result.normalized.problem} /> : null}
							</div>
							<div className="mt-3 flex flex-wrap gap-2">
								<span className="text-[13px] font-bold tracking-wide text-slate-900 dark:text-white">{result.profileCode}</span>
								{result.specialtyCode ? (
									<span className="text-[13px] font-medium text-slate-500">{result.specialtyCode}</span>
								) : null}
							</div>
							<div className="mt-5 flex flex-wrap gap-2">
								{result.profileSignals.map((signal) => (
									<span
										key={signal.id}
										className={`rounded-md border px-3 py-1.5 text-[13px] ${
											signal.emphasized
												? 'border-slate-900 font-semibold text-slate-900 dark:border-white dark:text-white'
												: 'border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400'
										}`}
									>
										{signal.label}
									</span>
								))}
							</div>
						</section>

						<StrategySearchMap
							map={result.strategyMap}
							samples={result.samples}
							omitExecution
							omitPriority
							blueprint={blueprint ?? result.blueprint}
							copilot={{
								buildContext: (target, currentText) =>
									buildCopilotContext({ result, ctx, profile, lang, target, currentText }),
								onApply: (target: CopilotRefineTarget, text: string) => {
									setBlueprint((prev) => (prev ? applyCopilotOverride(prev, target, text) : prev));
								},
							}}
						/>

						<span id="priority" className="sr-only">
							{t('priorityTitle')}
						</span>
						<span id="strategy" className="sr-only">
							{t('moveTitle')}
						</span>
						<StudioSectionHeader
							no="03"
							title="STRATEGIC GAP"
							description={t('gapSectionDesc')}
							id="gaps"
							action={
								<StrategyAiRefineButton
									target="strategy"
									context={buildCopilotContext({
										result,
										ctx,
										profile,
										lang,
										target: 'strategy',
										currentText: currentTextForTarget(result, 'strategy'),
									})}
									onApply={(_target, text) => setStrategyNote(readableRefineText(text))}
								/>
							}
						/>
						{strategyNote ? (
							<div className="mb-6 border-l-2 border-slate-900 pl-4 font-['Pretendard',sans-serif] text-[15px] leading-7 tracking-tight text-slate-700 dark:border-white dark:text-slate-200">
								{readableRefineText(strategyNote)
									.split('\n')
									.map((line, index) => (
										<p key={`${index}-${line.slice(0, 16)}`} className={line.trim() ? 'mb-3 last:mb-0' : 'mb-2 h-2'}>
											{highlightKeywordMarks(line, result.keyword)}
										</p>
									))}
							</div>
						) : null}
						<StrategicGapWorkspace result={result} />
					</div>

					<div className={LAYER_EXECUTION}>
						<StudioSectionHeader no="04" title="EXECUTION BLUEPRINT" description={t('blueprintSectionDesc')} id="execution-sample" />
						<div ref={sampleRef}>
							{blueprint ? (
								<StrategyExecutionBlueprint
									blueprint={blueprint}
									hideAction
									copilot={{
										buildContext: (target, currentText) =>
											buildCopilotContext({ result, ctx, profile, lang, target, currentText }),
										onApply: (target: CopilotRefineTarget, text: string) => {
											setBlueprint((prev) => (prev ? applyCopilotOverride(prev, target, text) : prev));
										},
									}}
								/>
							) : null}
						</div>
						<Link
							href="/contact"
							className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 underline-offset-4 transition-colors hover:text-cyan-600 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
						>
							{t('engineerCta')}
							<span aria-hidden>➔</span>
						</Link>

						<section className="mt-16">
							<StudioSectionHeader
								no="05"
								title="ACTION PLAN"
								description={t('actionSectionDesc')}
								id="action-plan"
								action={
									<StrategyAiRefineButton
										target="action"
										context={buildCopilotContext({
											result,
											ctx,
											profile,
											lang,
											target: 'action',
											currentText: currentTextForTarget(result, 'action'),
										})}
										onApply={(target, text) => {
											setBlueprint((prev) => (prev ? applyCopilotOverride(prev, target, text) : prev));
										}}
									/>
								}
							/>
							<ActionHorizon
								now={(blueprint?.action.p0.length ? blueprint.action.p0 : result.actionPlan.p0) || result.actionPlan.today}
								week={(blueprint?.action.p1.length ? blueprint.action.p1 : result.actionPlan.p1) || result.actionPlan.thisWeek}
								next={(blueprint?.action.p2.length ? blueprint.action.p2 : result.actionPlan.p2) || result.actionPlan.next}
								nowLabel={t('horizonToday')}
								weekLabel={t('horizonWeek')}
								nextLabel={t('horizonNext')}
							/>
						</section>
						<Link
							href="/contact"
							className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 underline-offset-4 transition-colors hover:text-cyan-600 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
						>
							{t('engineerCta')}
							<span aria-hidden>➔</span>
						</Link>

						<div className="mt-12 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
							<button
								type="button"
								className={STUDIO_CTA}
								onClick={() => {
									setSampleNote(true);
									sampleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
								}}
							>
								{t('ctaSample')}
							</button>
							<button
								type="button"
								className={STUDIO_CTA_GHOST}
								onClick={() => {
									commitResult(null);
									inputRef.current?.focus();
									inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
								}}
							>
								{t('ctaAnother')}
							</button>
							<Link href={backHref} className={STUDIO_CTA_GHOST}>
								{t('ctaBack')}
							</Link>
						</div>
						{sampleNote ? <p className="mt-3 text-[13px] text-slate-500">{t('sampleNextStep')}</p> : null}
					</div>
				</div>
			) : null}
		</div>
	);
}

const ANALYZING_PROGRESS_WIDTHS = ['16.6%', '33.3%', '50.0%', '66.6%', '83.3%', '100%'] as const;

function AnalyzingPanel({ activeStep, exiting }: { activeStep: number; exiting: boolean }) {
	const t = useTranslations('strategyStudio');
	const steps = [
		t('analyzingStep1'),
		t('analyzingStep2'),
		t('analyzingStep3'),
		t('analyzingStep4'),
		t('analyzingStep5'),
		t('analyzingStep6'),
	];

	const progressWidth = ANALYZING_PROGRESS_WIDTHS[activeStep - 1] ?? ANALYZING_PROGRESS_WIDTHS[0];

	return (
		<section
			className={`mt-10 transition-all duration-200 ease-out ${
				exiting ? 'translate-y-1 opacity-0' : 'animate-strategy-fade-in'
			}`}
			aria-live="polite"
		>
			<p className={`${META_LABEL} mb-4`}>{t('analyzingTitle')}</p>
			<div
				className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80"
				role="progressbar"
				aria-valuemin={1}
				aria-valuemax={steps.length}
				aria-valuenow={activeStep}
				aria-label={t('analyzingTitle')}
			>
				<div
					className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 transition-all duration-300 ease-out"
					style={{ width: progressWidth }}
				>
					<span
						aria-hidden="true"
						className="absolute inset-y-0 left-0 w-2/5 animate-strategy-shimmer bg-gradient-to-r from-transparent via-white/45 to-transparent"
					/>
				</div>
			</div>
			<ol className="mt-5 space-y-2">
				{steps.map((step, index) => {
					const stepNumber = index + 1;
					const current = stepNumber === activeStep;
					const completed = stepNumber < activeStep;
					return (
						<li
							key={step}
							className={`flex items-center gap-3 text-[14px] transition-all duration-300 ${
								current
									? 'font-semibold text-slate-900 dark:text-white'
									: completed
										? 'text-slate-500 dark:text-slate-300'
										: 'text-slate-400 dark:text-slate-600'
							}`}
						>
							<span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden="true">
								{current ? (
									<span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.18)] animate-pulse" />
								) : completed ? (
									<svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 text-slate-400 dark:text-slate-500">
										<path
											d="M3.5 8.2 6.4 11 12.5 4.8"
											stroke="currentColor"
											strokeWidth="1.7"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								) : (
									<span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
								)}
							</span>
							<span
								className={`w-5 font-mono text-[12px] tabular-nums ${
									current
										? 'font-semibold text-slate-900 dark:text-white'
										: completed
											? 'text-slate-400'
											: 'text-slate-500 dark:text-slate-600'
								}`}
							>
								{String(stepNumber).padStart(2, '0')}
							</span>
							{step}
						</li>
					);
				})}
			</ol>
			<p className="mt-3 text-[12px] text-slate-400">{t('analyzingNote')}</p>
		</section>
	);
}

function ActionHorizon({
	now,
	week,
	next,
	nowLabel,
	weekLabel,
	nextLabel,
}: {
	now: string[];
	week: string[];
	next: string[];
	nowLabel: string;
	weekLabel: string;
	nextLabel: string;
}) {
	let index = 1;
	const groups = [
		{ title: nowLabel, items: now },
		{ title: weekLabel, items: week },
		{ title: nextLabel, items: next },
	];
	return (
		<div className="space-y-8">
			{groups.map((group) => (
				<div key={group.title}>
					<p className={META_LABEL}>{group.title}</p>
					<ol className="mt-3 space-y-3">
						{group.items.map((item) => {
							const n = String(index).padStart(2, '0');
							index += 1;
							return (
								<li key={`${group.title}-${item}`} className="flex gap-3">
									<span className="font-mono text-[12px] text-slate-400">{n}</span>
									<span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">{item}</span>
								</li>
							);
						})}
					</ol>
				</div>
			))}
		</div>
	);
}

function ParseChip({ label, value }: { label: string; value: string }) {
	return (
		<span className="text-[13px] text-slate-600 dark:text-slate-300">
			<span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
			{value}
		</span>
	);
}

function ScoreRow({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-b border-slate-200/80 py-2 dark:border-white/10">
			<dt className="text-[13px] font-semibold tracking-wide text-slate-500">{label}</dt>
			<dd className="font-mono text-[18px] font-semibold text-slate-900 dark:text-white">{value}</dd>
		</div>
	);
}
