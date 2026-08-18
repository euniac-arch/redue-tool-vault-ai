'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
	buildAiEngineVisibilityReportFromAudit,
	type AiEngineVisibilityResult,
	type AiEngineVisibilityStatus,
	type AiVisibilityEngineId,
	type TriggerKeywordDepthLevel,
} from '@/lib/audit/ai-engine-visibility';
import { ENGINE_CHAT_THEME, ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import type { AuditReport } from '@/lib/site-auditor';

interface AiEngineVisibilityPanelProps {
	report: AuditReport;
}

const STATUS_BADGE: Record<AiEngineVisibilityStatus, string> = {
	optimal:
		'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-400/35',
	moderate:
		'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400/35',
	exact_only: 'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 ring-1 ring-rose-400/35',
	not_indexed: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 ring-1 ring-slate-300/50 dark:ring-white/15',
};

const DEPTH_DOT: Record<TriggerKeywordDepthLevel, string> = {
	0: 'bg-slate-300 dark:bg-white/20',
	1: 'bg-rose-400',
	2: 'bg-amber-400',
	3: 'bg-emerald-400',
};

function HighlightedText({ text, terms }: { text: string; terms: string[] }) {
	const usable = terms.map((t) => t.trim()).filter((t) => t.length >= 2);
	if (!usable.length) return <>{text}</>;
	const escaped = usable.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	const re = new RegExp(`(${escaped.join('|')})`, 'gi');
	const nodes: ReactNode[] = [];
	let last = 0;
	let match: RegExpExecArray | null;
	const source = text;
	re.lastIndex = 0;
	while ((match = re.exec(source))) {
		if (match.index > last) nodes.push(source.slice(last, match.index));
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
	if (last < source.length) nodes.push(source.slice(last));
	return <>{nodes}</>;
}

function DepthMeter({ level }: { level: TriggerKeywordDepthLevel }) {
	return (
		<span className="inline-flex items-center gap-0.5" aria-hidden>
			{([1, 2, 3] as const).map((n) => (
				<span
					key={n}
					className={`h-1.5 w-3 rounded-full ${level >= n ? DEPTH_DOT[level] : 'bg-slate-200 dark:bg-white/15'}`}
				/>
			))}
		</span>
	);
}

function AiChatWindow({ engine }: { engine: AiEngineVisibilityResult }) {
	const t = useTranslations('audit.aiVisibility');
	const theme = ENGINE_CHAT_THEME[engine.engineId];
	const Glyph = ENGINE_GLYPH[engine.engineId];
	const mentioned = engine.triggerLevel > 0;

	return (
		<div className={`overflow-hidden rounded-xl border ${theme.shell}`}>
			<div className={`flex items-center gap-2 border-b px-3 py-2 ${theme.header}`}>
				<span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${theme.logoWrap}`}>
					<Glyph className="h-3.5 w-3.5" />
				</span>
				<div className="min-w-0">
					<p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{engine.engineName}</p>
					<p className={`truncate text-[10px] ${theme.accentText}`}>{t('simulatedChat')}</p>
				</div>
			</div>

			<div className="flex flex-col gap-3 p-3 sm:p-3.5">
				<div className="flex justify-end">
					<div className={`max-w-[92%] rounded-2xl rounded-br-md px-3 py-2 text-[12px] leading-relaxed sm:text-[13px] ${theme.userBubble}`}>
						{engine.testedQuery}
					</div>
				</div>

				<div className="flex gap-2">
					<span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${theme.logoWrap}`}>
						<Glyph className="h-3.5 w-3.5" />
					</span>
					<div className={`min-w-0 flex-1 rounded-2xl rounded-tl-md px-3 py-2.5 text-[12px] leading-relaxed sm:text-[13px] ${theme.aiBubble}`}>
						<p className="whitespace-pre-wrap">
							<HighlightedText text={engine.simulatedResponse} terms={mentioned ? engine.highlightTerms : []} />
						</p>
						{engine.recommendedLinks.length > 0 ? (
							<div className="mt-2.5 flex flex-wrap gap-1.5">
								{engine.recommendedLinks.map((link) => (
									<a
										key={`${link.url}-${link.label}`}
										href={link.url}
										target="_blank"
										rel="noreferrer"
										className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${
											mentioned
												? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-emerald-400/40'
												: 'bg-slate-100 dark:bg-white/5 text-slate-500 ring-slate-200 dark:ring-white/10'
										}`}
									>
										<span className="truncate">{link.label}</span>
									</a>
								))}
							</div>
						) : (
							<p className="mt-2 text-[10px] text-slate-500">{t('noCitation')}</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function EngineCard({
	engine,
	open,
	onToggle,
}: {
	engine: AiEngineVisibilityResult;
	open: boolean;
	onToggle: () => void;
}) {
	const t = useTranslations('audit.aiVisibility');
	const Glyph = ENGINE_GLYPH[engine.engineId];
	const theme = ENGINE_CHAT_THEME[engine.engineId];
	const panelId = `ai-visibility-${engine.engineId}`;

	return (
		<article className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03]">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={onToggle}
				className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04] sm:px-5"
			>
				<span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${theme.logoWrap}`}>
					<Glyph className="h-5 w-5" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{engine.engineName}</h3>
						<span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STATUS_BADGE[engine.status]}`}>
							{t(`badge.${engine.status}`)}
						</span>
					</div>
					<div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
						<span className="font-semibold text-slate-700 dark:text-slate-300">
							{t('triggerLevel', { level: engine.triggerLevel })}
						</span>
						<DepthMeter level={engine.triggerLevel} />
						<span className="truncate">{t(`levelName.${engine.status}`)}</span>
					</div>
				</div>
				<ChevronDown
					className={`mt-1.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
				/>
			</button>

			<div
				id={panelId}
				className={`pdf-expand-in-print grid transition-[grid-template-rows] duration-300 ease-out print:grid-rows-[1fr] ${
					open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
				}`}
			>
				<div className="pdf-expand-in-print min-h-0 overflow-hidden">
					<div className="flex flex-col gap-3 border-t border-slate-200 dark:border-white/[0.06] px-4 py-4 sm:px-5">
						<AiChatWindow engine={engine} />
						<div className="rounded-xl border border-indigo-200 dark:border-indigo-400/25 bg-indigo-50 dark:bg-indigo-500/[0.08] px-3.5 py-3">
							<p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">
								{t('improvementTitle')}
							</p>
							<p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
								{engine.optimizationTip}
							</p>
						</div>
					</div>
				</div>
			</div>
		</article>
	);
}

/**
 * Tab 1 — AI Engine Visibility & Trigger Keyword Depth Testing.
 *
 * Live crawler swap: replace `buildAiEngineVisibilityReportFromAudit(report, lang)`
 * with `fetch('/api/audit/ai-visibility', { method: 'POST', body })`. The JSON
 * schema (`AiEngineVisibilityReport`) is identical; set `source: 'live'` on the
 * API once probes replace the heuristic generator.
 */
export function AiEngineVisibilityPanel({ report }: AiEngineVisibilityPanelProps) {
	const t = useTranslations('audit.aiVisibility');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';

	const data = useMemo(() => buildAiEngineVisibilityReportFromAudit(report, lang), [report, lang]);
	const weakest = useMemo(() => {
		const sorted = [...data.engines].sort((a, b) => a.triggerLevel - b.triggerLevel);
		return sorted[0]?.engineId ?? 'chatgpt';
	}, [data.engines]);
	const [openId, setOpenId] = useState<AiVisibilityEngineId | null>(weakest);

	const { summary } = data;
	const depthPct = Math.min(100, Math.max(0, (summary.averageDepth / 3) * 100));

	return (
		<section
			id="sec-ai-visibility"
			className="pdf-page-item audit-report-section flex flex-col gap-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
			aria-labelledby="ai-visibility-heading"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('kicker')}</p>
				<h2 id="ai-visibility-heading" className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white sm:text-xl">
					{t('title')}
				</h2>
				<p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
			</div>

			<div className="grid gap-3 rounded-2xl border border-indigo-200 dark:border-indigo-400/20 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-indigo-950/40 dark:via-slate-950/20 dark:to-cyan-950/20 p-4 sm:grid-cols-3 sm:p-5">
				<div>
					<p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
						{t('exposureIndex')}
					</p>
					<p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
						{t('indexingSummary', { indexed: summary.indexedCount, total: summary.totalEngines })}
					</p>
					<p className="mt-1 text-[11px] text-slate-500">{t('indexingHint')}</p>
				</div>
				<div>
					<p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
						{t('avgDepthLabel')}
					</p>
					<p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
						{summary.averageDepth.toFixed(1)}
						<span className="text-sm font-bold text-slate-500"> / 3.0</span>
					</p>
					<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
						<div
							className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400"
							style={{ width: `${depthPct}%` }}
						/>
					</div>
				</div>
				<div>
					<p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
						{t('depthMix')}
					</p>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{([3, 2, 1, 0] as TriggerKeywordDepthLevel[]).map((level) => (
							<span
								key={level}
								className="rounded-md border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
							>
								L{level} · {summary.levelCounts[level]}
							</span>
						))}
					</div>
					<p className="mt-2 text-[11px] font-semibold text-cyan-800 dark:text-cyan-300">
						{t('exposureScore', { score: summary.exposureIndex })}
					</p>
				</div>
			</div>

			<div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
				<span className={`rounded-full px-2.5 py-1 font-bold ${STATUS_BADGE.optimal}`}>{t('badge.optimal')}</span>
				<span className={`rounded-full px-2.5 py-1 font-bold ${STATUS_BADGE.moderate}`}>{t('badge.moderate')}</span>
				<span className={`rounded-full px-2.5 py-1 font-bold ${STATUS_BADGE.exact_only}`}>{t('badge.exact_only')}</span>
				<span className={`rounded-full px-2.5 py-1 font-bold ${STATUS_BADGE.not_indexed}`}>{t('badge.not_indexed')}</span>
			</div>

			<div className="grid gap-3 lg:grid-cols-2">
				{data.engines.map((engine) => (
					<EngineCard
						key={engine.engineId}
						engine={engine}
						open={openId === engine.engineId}
						onToggle={() => setOpenId((prev) => (prev === engine.engineId ? null : engine.engineId))}
					/>
				))}
			</div>

			<p className="text-[11px] leading-relaxed text-slate-500">{t('disclaimer')}</p>
		</section>
	);
}
