'use client';

import { memo, type ReactNode } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { ENGINE_CHAT_THEME, ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import { EngineAnalysisTagChips } from '@/components/geo/EngineAnalysisTagChips';
import { EngineLevel3LiftGuide } from '@/components/geo/EngineLevel3LiftGuide';
import { ReachLevelGuideInline } from '@/components/geo/ReachLevelGuidePanel';
import { buildEngineOptimizationGuide } from '@/lib/geo/engine-optimization-guide';
import { getEngineKeyActions, type EngineKeyActionView } from '@/lib/geo/trigger-simulation';
import { resolveEngineAnalysisTags } from '@/lib/geo/precision-diagnostics';
import {
	isIndexedResult,
	isProxyIndexEngine,
	type AIEngineId,
	type AIEngineTestResult,
	type KeywordDepthLevel,
} from '@/types/geo-diagnostic';
import type { EngineSimulationData } from '@/types/site-reach';

export interface AIEngineTestCardProps {
	result: AIEngineTestResult;
	brandName: string;
	domain: string;
	targetUrl: string;
	open: boolean;
	onToggle: () => void;
	analysisTags?: AIEngineTestResult['analysisTags'];
	/** Highlight As-Is (before) or To-Be (after prescription). */
	emphasis?: 'current' | 'post';
	/** Per-engine reach snapshot — single source of truth for level + trigger query. */
	simulation?: EngineSimulationData;
	/** Query-depth chip currently selected in the simulation console. */
	selectedLevel?: KeywordDepthLevel;
}

const DEPTH_DOT: Record<0 | 1 | 2 | 3, string> = {
	0: 'bg-slate-300 dark:bg-white/20',
	1: 'bg-rose-400',
	2: 'bg-amber-400',
	3: 'bg-emerald-400',
};

const CHAT_LAYOUT: Record<AIEngineId, 'bubbles' | 'grounded'> = {
	chatgpt: 'bubbles',
	claude: 'bubbles',
	copilot: 'bubbles',
	clova: 'bubbles',
	gemini: 'grounded',
	perplexity: 'grounded',
};

function highlightTerms(brandName: string, domain: string, targetUrl: string): string[] {
	const terms = [brandName, domain, targetUrl];
	try {
		const url = new URL(/^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`);
		terms.push(url.hostname.replace(/^www\./, ''), url.host);
	} catch {
		/* ignore malformed URLs */
	}
	return [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2))].sort(
		(a, b) => b.length - a.length,
	);
}

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
	if (!terms.length) return <>{text}</>;
	const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const re = new RegExp(`(${escaped.join('|')})`, 'gi');
	const nodes: ReactNode[] = [];
	let last = 0;
	let match: RegExpExecArray | null;
	re.lastIndex = 0;
	while ((match = re.exec(text))) {
		if (match.index > last) nodes.push(text.slice(last, match.index));
		nodes.push(
			<mark
				key={`${match.index}-${match[0]}`}
				className="rounded-sm bg-emerald-200/80 dark:bg-emerald-400/25 px-0.5 font-extrabold text-emerald-900 dark:text-emerald-200"
			>
				{match[0]}
			</mark>,
		);
		last = match.index + match[0].length;
		if (match[0].length === 0) re.lastIndex += 1;
	}
	if (last < text.length) nodes.push(text.slice(last));
	return <>{nodes}</>;
}

function EngineMeasurementChip({ engineId, isLive }: { engineId: AIEngineId; isLive: boolean }) {
	const t = useTranslations('audit.aiEngines');
	if (isProxyIndexEngine(engineId)) {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 ring-1 ring-sky-400/30 dark:text-sky-300">
				<span aria-hidden>🔵</span>
				{t('approxBadge')}
			</span>
		);
	}
	if (isLive) {
		return (
			<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-400/30 dark:text-emerald-300">
				<span aria-hidden>🟢</span>
				{t('liveGroundedBadge')}
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-extrabold text-zinc-500 ring-1 ring-zinc-400/30 dark:text-zinc-400">
			<span aria-hidden>⚪</span>
			{t('ruleDiagnosisBadge')}
		</span>
	);
}

const RANK_BADGE: Record<1 | 2 | 3, string> = {
	1: 'border-rose-500/40 bg-rose-500/15 text-amber-300',
	2: 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300',
	3: 'border-slate-600/80 bg-slate-800/80 text-slate-300',
};

function EngineBreakthroughRoadmap({
	engineName,
	actions,
	showPost,
}: {
	engineName: string;
	actions: EngineKeyActionView[];
	showPost: boolean;
}) {
	const tCards = useTranslations('audit.aiEngineCards');

	if (showPost) {
		return (
			<div className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3.5">
				<p className="text-[11px] font-extrabold text-emerald-200">
					<span aria-hidden>✨ </span>
					{tCards('roadmapTitleToBe')}
				</p>
				<ul className="space-y-2">
					{actions.map((action) => (
						<li key={action.rank} className="flex items-start gap-2">
							<span className="inline-flex shrink-0 items-center rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-300">
								{tCards('roadmapDone')}
							</span>
							<span className="text-[11px] leading-relaxed text-emerald-100/90">{action.text}</span>
						</li>
					))}
				</ul>
				<p className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-2 text-[11px] font-extrabold text-emerald-100">
					{tCards('roadmapAchievement', { engine: engineName })}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-2 rounded-xl border border-slate-800/90 bg-slate-900/60 p-3.5">
			<p className="text-[11px] font-extrabold text-slate-100">
				<span aria-hidden>🔑 </span>
				{tCards('roadmapTitle')}
			</p>
			<ul className="space-y-2">
				{actions.map((action) => (
					<li key={action.rank} className="flex items-start gap-2">
						<span
							className={`inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${RANK_BADGE[action.rank]}`}
						>
							{tCards(`roadmapRank.${action.rank}`)}
						</span>
						<span className="text-[11px] leading-relaxed text-slate-200">{action.text}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

function DepthMeter({ level }: { level: 1 | 2 | 3 | null }) {
	const n = level ?? 0;
	return (
		<span className="inline-flex items-center gap-0.5" aria-hidden>
			{([1, 2, 3] as const).map((step) => (
				<span
					key={step}
					className={`h-1.5 w-3 rounded-full transition-colors duration-200 ${n >= step ? DEPTH_DOT[n] : 'bg-slate-200 dark:bg-white/15'}`}
				/>
			))}
		</span>
	);
}

function CitationChip({
	href,
	label,
	cited,
}: {
	href: string;
	label: string;
	cited: boolean;
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-bold leading-relaxed ring-1 transition-colors duration-200 ${
				cited
					? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-emerald-400/40'
					: 'bg-slate-100 dark:bg-white/5 text-slate-500 ring-slate-200 dark:ring-white/10'
			}`}
		>
			<span className="truncate">{label}</span>
		</a>
	);
}

function SimulatedChat({
	result,
	brandName,
	domain,
	targetUrl,
	query,
	response,
	cited: citedOverride,
}: Pick<AIEngineTestCardProps, 'result' | 'brandName' | 'domain' | 'targetUrl'> & {
	query?: string;
	response?: string;
	cited?: boolean;
}) {
	const t = useTranslations('audit.aiEngineCards');
	const id = result.engine.id;
	const theme = ENGINE_CHAT_THEME[id];
	const Glyph = ENGINE_GLYPH[id];
	const cited = citedOverride ?? (result.isLive ? result.depthLevel === 2 : isIndexedResult(result));
	const terms = highlightTerms(brandName, domain, targetUrl);
	const layout = CHAT_LAYOUT[id];
	const citationLabel = t('officialSite', { brand: brandName });
	const triggerQuery = query ?? result.triggerQuery;
	const simulatedResponse = response ?? result.simulatedResponse;
	const chatLabel = t('simulatedChat');

	const responseBody = (
		<p className="whitespace-pre-wrap text-xs leading-relaxed transition-colors duration-200">
			<HighlightedText text={simulatedResponse} terms={terms} />
		</p>
	);

	const citations = cited ? (
		<div className="mt-2.5 flex flex-wrap gap-1.5">
			<CitationChip href={targetUrl} label={citationLabel} cited />
			<CitationChip href={targetUrl} label={domain} cited />
		</div>
	) : (
		<p className="mt-2 text-xs leading-relaxed text-slate-500">{t('noCitation')}</p>
	);

	if (layout === 'grounded') {
		return (
			<div className={`overflow-hidden rounded-xl border ${theme.shell}`}>
				<div className={`flex items-center gap-2 border-b px-3 py-2 ${theme.header}`}>
					<span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${theme.logoWrap}`}>
						<Glyph className="h-3.5 w-3.5" />
					</span>
					<div className="min-w-0">
						<p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{result.engine.name}</p>
						<p className={`truncate text-[10px] ${theme.accentText}`}>{chatLabel}</p>
					</div>
				</div>
				<div className="flex flex-col gap-3 p-3">
					<div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs leading-relaxed ${theme.userBubble} border-transparent`}>
						<Search className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
						<span className="min-w-0">{triggerQuery}</span>
					</div>
					<div className={`rounded-xl border px-3.5 py-3 shadow-sm ${theme.aiBubble} ${theme.shell}`}>
						{responseBody}
						{citations}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={`overflow-hidden rounded-xl border ${theme.shell}`}>
			<div className={`flex items-center gap-2 border-b px-3 py-2 ${theme.header}`}>
				<span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${theme.logoWrap}`}>
					<Glyph className="h-3.5 w-3.5" />
				</span>
				<div className="min-w-0">
					<p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{result.engine.name}</p>
					<p className={`truncate text-[10px] ${theme.accentText}`}>{chatLabel}</p>
				</div>
			</div>
			<div className="flex flex-col gap-3 p-3 sm:p-3.5">
				<div className="flex justify-end">
					<div className={`max-w-[92%] rounded-2xl rounded-br-md px-3 py-2 text-xs leading-relaxed ${theme.userBubble}`}>
						<span className="mb-1 block text-xs font-bold uppercase tracking-wide opacity-60">{t('userPrompt')}</span>
						{triggerQuery}
					</div>
				</div>
				<div className="flex gap-2">
					<span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${theme.logoWrap}`}>
						<Glyph className="h-3.5 w-3.5" />
					</span>
					<div className={`min-w-0 flex-1 rounded-2xl rounded-tl-md px-3 py-2.5 text-xs leading-relaxed ${theme.aiBubble}`}>
						{responseBody}
						{citations}
					</div>
				</div>
			</div>
		</div>
	);
}

function AIEngineTestCardInner({
	result,
	brandName,
	domain,
	targetUrl,
	open,
	onToggle,
	analysisTags,
	emphasis = 'current',
	simulation,
	selectedLevel = 1,
}: AIEngineTestCardProps) {
	const tCards = useTranslations('audit.aiEngineCards');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const id = result.engine.id;
	const Glyph = ENGINE_GLYPH[id];
	const theme = ENGINE_CHAT_THEME[id];
	const panelId = `ai-engine-card-${id}`;
	const current = result.currentStatus;
	const post = result.postOptimization;
	const showPost = emphasis === 'post';
	const reachableLevel = simulation?.level ?? current?.level ?? result.depthLevel;
	const canReachSelected =
		simulation?.canReachSelected ?? (reachableLevel !== null && selectedLevel <= reachableLevel);
	const level = reachableLevel ?? (showPost ? 3 : result.depthLevel === null ? null : reachableLevel);
	const headerQuery =
		simulation?.triggerQuery ||
		(showPost ? post?.expandedTriggerQuery : current?.triggerQuery) ||
		result.triggerQuery;
	const tags = resolveEngineAnalysisTags({
		engine: result.engine,
		statusBadge: result.statusBadge,
		depthLevel: result.depthLevel,
		analysisTags: analysisTags?.length ? analysisTags : result.analysisTags,
	});
	const statusTags = showPost
		? []
		: current?.statusTags ?? [];
	const keyActions = getEngineKeyActions(id, lang);
	const toBeKeywords = post?.expandedCategoryQueries ?? [];
	const reachLimited = !canReachSelected;
	const displayedLevel = selectedLevel;
	const optimizationGuide =
		simulation?.optimizationGuide ??
		result.optimizationGuide ??
		(reachableLevel === 2
			? buildEngineOptimizationGuide({
					engineId: id,
					currentLevel: 2,
					lang,
					brandName,
				})
			: undefined);
	const showLevel3Guide = Boolean(optimizationGuide && reachableLevel === 2 && (showPost || reachLimited));
	const headerBadge = reachLimited
		? showPost
			? tCards('toBeUnreachable', { level: selectedLevel })
			: tCards('asIsUnreachable')
		: showPost
			? tCards(`toBeBadge.${selectedLevel}`)
			: tCards(`triggerLevelNamed.${selectedLevel}`);
	const headerBadgeClass = reachLimited
		? 'bg-amber-500/10 text-amber-800 border-amber-500/35 dark:text-amber-300'
		: showPost
			? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400'
			: selectedLevel === 3
				? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400'
				: selectedLevel === 2
					? 'bg-indigo-500/10 text-indigo-700 border-indigo-500/25 dark:text-indigo-400'
					: 'bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-400';

	return (
		<article className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={onToggle}
				className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] sm:px-5"
			>
				<span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.logoWrap}`}>
					<Glyph className="h-5 w-5" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{result.engine.name}</h3>
						<EngineMeasurementChip engineId={result.engine.id} isLive={Boolean(result.isLive)} />
						<span className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold transition-colors duration-200 ${headerBadgeClass}`}>
							{headerBadge}
						</span>
					</div>
					<div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs leading-relaxed text-slate-500">
						<span className="font-semibold text-slate-700 transition-colors duration-200 dark:text-slate-300">
							{level === null ? tCards('triggerUnindexed') : tCards(`triggerLevelNamed.${level}`)}
						</span>
						<DepthMeter level={level === 3 ? 3 : level} />
						<span className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
							{tCards('resultLevelLabel', { level: selectedLevel })}
						</span>
					</div>
					<p className="mt-1.5 truncate text-xs leading-relaxed text-slate-500">
						<span className="mr-1 font-bold uppercase tracking-wide text-slate-400 transition-colors duration-200">
							{showPost ? tCards('expandedTrigger') : tCards('triggerQuery')}
						</span>
						<span className="text-slate-700 transition-colors duration-200 dark:text-slate-300">{headerQuery}</span>
					</p>
				</div>
				<ChevronDown
					className={`mt-1.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
				/>
			</button>

			<div
				id={panelId}
				className={`pdf-expand-in-print grid transition-all duration-200 ease-out motion-reduce:transition-none print:grid-rows-[1fr] ${
					open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
				}`}
				aria-hidden={!open}
			>
				<div className="pdf-expand-in-print min-h-0 overflow-hidden">
					<div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-xs dark:border-white/[0.06] sm:px-5">
						{displayedLevel === 1 || displayedLevel === 2 || displayedLevel === 3 ? (
							<ReachLevelGuideInline level={displayedLevel} />
						) : null}
						{!showPost && tags.length ? <EngineAnalysisTagChips tags={tags} /> : null}

						<section className="flex flex-col gap-2">
							<div>
								<p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 transition-colors duration-200">
									{showPost ? tCards('toBeKicker') : tCards('asIsKicker')}
								</p>
								<p className="mt-0.5 text-[10px] text-slate-400 transition-colors duration-200">
									{showPost ? tCards('toBeResponseLabel') : tCards('asIsResponseLabel')}
								</p>
							</div>
							{statusTags.length ? (
								<div className="flex flex-wrap gap-1">
									{statusTags.map((tag) => (
										<span
											key={tag}
											className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold leading-relaxed text-slate-600 transition-colors duration-200 dark:bg-white/10 dark:text-slate-300"
										>
											{tag}
										</span>
									))}
								</div>
							) : null}
							<SimulatedChat
								result={result}
								brandName={brandName}
								domain={domain}
								targetUrl={targetUrl}
								query={headerQuery}
								response={
									simulation?.aiResponseSnippet ||
									(showPost
										? post?.expectedSimulationResponse
										: current?.simulationResponse ?? result.simulatedResponse)
								}
								cited={showPost ? canReachSelected : isIndexedResult(result) && canReachSelected}
							/>
						</section>

						<EngineBreakthroughRoadmap
							engineName={result.engine.name}
							actions={keyActions}
							showPost={Boolean(showPost) && canReachSelected}
						/>

						{showLevel3Guide && optimizationGuide ? (
							<EngineLevel3LiftGuide guide={optimizationGuide} emphasis={emphasis} />
						) : null}

						{showPost && toBeKeywords.length ? (
							<div>
								<p className="text-[10px] font-extrabold text-emerald-800 transition-colors duration-200 dark:text-emerald-200">
									{tCards('toBeKeywordsTitle')}
								</p>
								<ul className="mt-1.5 flex flex-wrap gap-1.5">
									{toBeKeywords.map((keyword) => (
										<li key={keyword}>
											<span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-extrabold leading-relaxed text-emerald-900 ring-1 ring-emerald-300/60 transition-colors duration-200 dark:bg-white/10 dark:text-emerald-100 dark:ring-emerald-400/30">
												{keyword}
											</span>
										</li>
									))}
								</ul>
							</div>
						) : null}
					</div>
				</div>
			</div>
		</article>
	);
}

export const AIEngineTestCard = memo(AIEngineTestCardInner);
