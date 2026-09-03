'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AnalysisLoadingBar } from '@/components/ai-search-intelligence/common/AnalysisLoadingBar';
import { ContextTagBadgeGroup } from '@/components/ai-search-intelligence/common/ContextTagBadgeGroup';
import { AsiLockPanel } from '@/components/ai-search-intelligence/entitlement/AsiLockPanel';
import { QueryProbeResults } from '@/components/ai-search-intelligence/evidence/QueryProbeResults';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiQueryCard } from '@/components/ai-search-intelligence/primitives/AsiCommonCards';
import { AsiCta } from '@/components/ai-search-intelligence/primitives/AsiCta';
import { AsiFilterChip } from '@/components/ai-search-intelligence/primitives/AsiFilterChip';
import { AsiFilterTabList } from '@/components/ai-search-intelligence/primitives/AsiFilterTabList';
import { ASI_CTA } from '@/lib/ui/asi-chrome';
import { canAccessFeature } from '@/lib/ai-search-intelligence/entitlement';
import { useAsiActor } from '@/lib/ai-search-intelligence/entitlement/use-asi-actor';
import { useElapsedSeconds } from '@/lib/ai-search-intelligence/client/use-elapsed-seconds';
import { ASI_QUERY_PROBE_MAX } from '@/lib/ai-search-intelligence/probe/run';
import {
	ASI_QUESTION_INTENTS,
	type AsiEvidenceSnapshot,
	type AsiQuestionInput,
	type AsiQuestionIntent,
} from '@/lib/ai-search-intelligence/types';

type ProbeStepKey = 'probeStepConnect' | 'probeStepSimulate' | 'probeStepAnalyze';
type GenerateStepKey = 'generateStepParse' | 'generateStepSimulate' | 'generateStepFormat';
const CONTEXT_FIELDS = ['industry', 'location', 'service', 'target'] as const;
const GENERATE_SKELETON_COUNT = 4;

function formatElapsedClock(totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const mm = String(Math.floor(safe / 60)).padStart(2, '0');
	const ss = String(safe % 60).padStart(2, '0');
	return `${mm}:${ss}`;
}

function probeStepKey(elapsedSeconds: number): ProbeStepKey {
	if (elapsedSeconds <= 2) return 'probeStepConnect';
	if (elapsedSeconds <= 5) return 'probeStepSimulate';
	return 'probeStepAnalyze';
}

function generateStepKey(elapsedSeconds: number): GenerateStepKey {
	if (elapsedSeconds < 1.5) return 'generateStepParse';
	if (elapsedSeconds < 3.5) return 'generateStepSimulate';
	return 'generateStepFormat';
}

function useProbeRunFeedback(isLoading: boolean, runId: string | null) {
	const elapsedTime = useElapsedSeconds(isLoading);
	const [justCompleted, setJustCompleted] = useState(false);
	const startedRunId = useRef<string | null>(null);
	const wasLoading = useRef(false);

	useEffect(() => {
		if (isLoading && !wasLoading.current) {
			startedRunId.current = runId;
			setJustCompleted(false);
		} else if (!isLoading && wasLoading.current && runId && runId !== startedRunId.current) {
			setJustCompleted(true);
		}
		wasLoading.current = isLoading;
	}, [isLoading, runId]);

	useEffect(() => {
		if (!justCompleted) return;
		const id = window.setTimeout(() => setJustCompleted(false), 1000);
		return () => window.clearTimeout(id);
	}, [justCompleted]);

	return {
		elapsedTime: Math.floor(elapsedTime),
		justCompleted,
		loadingStep: probeStepKey(elapsedTime),
	};
}

function QuestionSkeletonList({ count, label }: { count: number; label: string }) {
	return (
		<ul className="flex flex-col gap-2" aria-busy="true" aria-label={label}>
			{Array.from({ length: count }, (_, index) => (
				<li
					key={index}
					className="asi-skeleton-shimmer flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="min-w-0 flex-1 space-y-2">
						<div className="h-2.5 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
						<div className="h-4 w-4/5 max-w-md rounded-md bg-slate-200 dark:bg-slate-700" />
					</div>
					<div className="h-10 w-28 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-800" />
				</li>
			))}
		</ul>
	);
}

function defaultSelectedIds(questions: AsiEvidenceSnapshot['questions'], cap: number): string[] {
	const preferred = questions.filter((item) => item.intent === 'recommend' || item.intent === 'local');
	const pool = preferred.length ? preferred : questions;
	return pool.slice(0, cap).map((item) => item.id);
}

export function QuestionGeneratorPanel({
	snapshot,
	onGenerate,
	onProbe,
	onCancel,
	busy,
	generating = false,
	probing,
}: {
	snapshot: AsiEvidenceSnapshot;
	onGenerate: (input: AsiQuestionInput) => void;
	onProbe: (queries: string[]) => void;
	onCancel?: () => void;
	busy: boolean;
	generating?: boolean;
	probing: boolean;
}) {
	const t = useTranslations('intelligence.evidence');
	const { actor, ready } = useAsiActor();
	const probeCap = Math.min(ASI_QUERY_PROBE_MAX, actor.limits.queries);
	const canBulk = canAccessFeature(actor, 'query.bulk');
	const [form, setForm] = useState<AsiQuestionInput>(snapshot.questionInputs);
	const [intent, setIntent] = useState<AsiQuestionIntent | 'all'>('all');
	const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelectedIds(snapshot.questions, probeCap)));
	const questionKey = snapshot.questions.map((item) => item.id).join('|');
	const generation = snapshot.queryGeneration;
	const status = generation?.status ?? (snapshot.questions.length ? 'QUERY_GENERATED' : 'NO_DATA');
	const rows = intent === 'all' ? snapshot.questions : snapshot.questions.filter((item) => item.intent === intent);

	useEffect(() => {
		setForm(snapshot.questionInputs);
	}, [snapshot.questionInputs]);
	const selectedQueries = useMemo(
		() => snapshot.questions.filter((item) => selected.has(item.id)).map((item) => item.query),
		[snapshot.questions, selected],
	);
	const { elapsedTime, justCompleted, loadingStep } = useProbeRunFeedback(
		probing,
		snapshot.queryProbe?.current?.runId ?? null,
	);
	const isLoading = probing;
	const isGenerating = generating;
	const generateElapsed = useElapsedSeconds(isGenerating);
	const generateStep = generateStepKey(generateElapsed);
	const [listRevealKey, setListRevealKey] = useState(0);
	const wasGenerating = useRef(false);

	useEffect(() => {
		if (wasGenerating.current && !isGenerating) {
			setListRevealKey((key) => key + 1);
		}
		wasGenerating.current = isGenerating;
	}, [isGenerating]);

	useEffect(() => {
		setSelected(new Set(defaultSelectedIds(snapshot.questions, probeCap)));
	}, [questionKey, snapshot.questions, probeCap]);

	function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onGenerate(form);
	}

	function toggle(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
				return next;
			}
			if (next.size >= probeCap) return next;
			next.add(id);
			return next;
		});
	}

	function selectVisible() {
		setSelected((prev) => {
			const next = new Set(prev);
			for (const item of rows) {
				if (next.size >= probeCap) break;
				next.add(item.id);
			}
			return next;
		});
	}

	return (
		<div className="flex flex-col gap-4">
			<AsiCard kicker={t('questionKicker')} title={t('questionTitle')} meta={t('questionMeta')} provenance="derived" metric="generatedQuestions">
				<p
					className={
						status === 'QUERY_GENERATED'
							? 'text-sm font-semibold text-slate-600 dark:text-slate-300'
							: 'text-sm font-semibold text-amber-700 dark:text-amber-300'
					}
				>
					{t(`queryStatus.${status}`)}
				</p>
				<ContextTagBadgeGroup
					active={isGenerating}
					items={CONTEXT_FIELDS.map((field) => {
						const fallback =
							field === 'target'
								? t('queryOptional')
								: field === 'service'
									? generation?.context?.services.join(', ') || t('queryMissing')
									: generation?.context?.[field] || t('queryMissing');
						return {
							id: field,
							label: t(`field.${field}`),
							value: form[field].trim() || fallback,
						};
					})}
				/>
				<form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
					{CONTEXT_FIELDS.map((field) => (
						<label key={field} className="flex flex-col gap-1 text-xs font-bold text-slate-500">
							{t(`field.${field}`)}
							<input
								value={form[field]}
								onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))}
								placeholder={t(`fieldPlaceholder.${field}`)}
								disabled={isGenerating || busy || probing}
								className="theme-input h-11 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
							/>
						</label>
					))}
					<AsiCta
						disabled={isGenerating || busy || probing}
						aria-busy={isGenerating}
						className={`asi-probe-run relative sm:col-span-2 gap-2 overflow-hidden disabled:cursor-not-allowed ${
							isGenerating ? 'asi-generate-glow' : ''
						}`}
					>
						{isGenerating ? (
							<span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
								<span className="asi-loading-bar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
							</span>
						) : null}
						{isGenerating ? (
							<>
								<Sparkles className="relative h-4 w-4 animate-pulse motion-reduce:animate-none" aria-hidden />
								<span className="relative tabular-nums">
									{t('generateRunning', { time: generateElapsed.toFixed(1) })}
								</span>
							</>
						) : (
							t('generate')
						)}
					</AsiCta>
				</form>
				{isGenerating ? (
					<div className="flex flex-col gap-1.5" aria-live="polite">
						<AnalysisLoadingBar />
						<p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
							{generateStep === 'generateStepSimulate'
								? t('generateStepSimulate', {
										industry: form.industry.trim() || generation?.context?.industry || t('queryMissing'),
										location: form.location.trim() || generation?.context?.location || t('queryMissing'),
									})
								: t(generateStep)}
						</p>
					</div>
				) : null}
			</AsiCard>
			<AsiFilterTabList label={t('intentFilterAria')}>
				<AsiFilterChip active={intent === 'all'} onClick={() => setIntent('all')}>
					{t('allIntents')}
				</AsiFilterChip>
				{ASI_QUESTION_INTENTS.map((item) => (
					<AsiFilterChip key={item} active={intent === item} onClick={() => setIntent(item)}>
						{t(`intent.${item}`)}
					</AsiFilterChip>
				))}
			</AsiFilterTabList>
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					disabled={isGenerating}
					className={`${ASI_CTA} h-9 bg-slate-700 px-3 text-xs hover:bg-slate-600 disabled:cursor-not-allowed`}
					onClick={selectVisible}
				>
					{t('probeSelectAll')}
				</button>
				<button
					type="button"
					disabled={isGenerating}
					className={`${ASI_CTA} h-9 bg-slate-500 px-3 text-xs hover:bg-slate-400 disabled:cursor-not-allowed`}
					onClick={() => setSelected(new Set())}
				>
					{t('probeClear')}
				</button>
				<p className="text-xs font-semibold text-slate-500">{t('probeSelected', { n: selected.size })}</p>
				<p className="text-xs text-slate-400">{t('probeCap', { n: probeCap })}</p>
			</div>
			{isGenerating ? (
				<QuestionSkeletonList count={GENERATE_SKELETON_COUNT} label={t('generateSkeletonAria')} />
			) : rows.length === 0 ? (
				<p className="text-sm text-slate-500">
					{status === 'NO_DATA'
						? t('queryEmpty.NO_DATA')
						: status === 'CONTEXT_INCOMPLETE'
							? t('queryEmpty.CONTEXT_INCOMPLETE')
							: status === 'GENERATION_FAILED'
								? t('queryEmpty.GENERATION_FAILED')
								: status === 'PROVIDER_ERROR'
									? t('queryEmpty.PROVIDER_ERROR')
									: t('queryEmpty.none')}
				</p>
			) : (
				<ul key={listRevealKey} className="asi-fade-in flex flex-col gap-2">
					{rows.map((item) => (
						<AsiQueryCard
							key={item.id}
							query={item.query}
							kicker={t(`intent.${item.intent}`)}
							selected={selected.has(item.id)}
							onToggle={() => toggle(item.id)}
							href={`/intelligence/recommendation-test?q=${encodeURIComponent(item.query)}`}
							actionLabel={t('runTest')}
						/>
					))}
				</ul>
			)}
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<AsiCta
						type="button"
						className={`asi-probe-run relative min-w-[13.5rem] gap-2 overflow-hidden disabled:cursor-not-allowed ${
							isLoading ? 'asi-probe-glow' : ''
						} ${justCompleted ? 'bg-emerald-600 hover:bg-emerald-500' : ''}`}
						disabled={isLoading || justCompleted || isGenerating || busy || selectedQueries.length === 0}
						aria-busy={isLoading}
						aria-label={justCompleted ? t('probeComplete') : isLoading ? t(loadingStep) : undefined}
						data-complete={justCompleted ? 'true' : undefined}
						onClick={() => onProbe(selectedQueries.slice(0, probeCap))}
					>
						{isLoading ? (
							<span
								aria-hidden
								className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
							>
								<span className="asi-loading-bar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
							</span>
						) : null}
						{justCompleted ? (
							<>
								<CheckCircle2 className="relative h-4 w-4" aria-hidden />
								<span className="relative">{t('probeComplete')}</span>
							</>
						) : isLoading ? (
							<>
								<Loader2 className="relative h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
								<span className="relative tabular-nums tracking-wide">
									{t('probeElapsed', { time: formatElapsedClock(elapsedTime) })}
								</span>
							</>
						) : (
							t('probeRun')
						)}
					</AsiCta>
					{isLoading && onCancel ? (
						<button
							type="button"
							onClick={onCancel}
							className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
						>
							{t('probeCancel')}
						</button>
					) : null}
				</div>
				{isLoading ? (
					<div className="flex max-w-xl flex-col gap-1.5" aria-live="polite">
						<AnalysisLoadingBar />
						<p className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{t(loadingStep)}</p>
					</div>
				) : null}
			</div>
			{selectedQueries.length === 0 ? <p className="text-sm text-slate-500">{t('probeEmpty')}</p> : null}
			{ready && !canBulk ? <AsiLockPanel feature="query.bulk" tier={actor.tier} /> : null}
			<QueryProbeResults report={snapshot.queryProbe} />
		</div>
	);
}
