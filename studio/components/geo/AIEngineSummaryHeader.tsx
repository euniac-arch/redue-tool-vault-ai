'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ENGINE_CHAT_THEME, ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import { PrescriptionAppliedBadge } from '@/components/geo/PrescriptionAppliedBadge';
import { useOptionalSiteReach } from '@/components/geo/SiteReachContext';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { buildGeoDiagnosticReportFromAudit } from '@/lib/geo/from-visibility';
import type { AuditReport } from '@/lib/site-auditor';
import {
	summarizeGeoDiagnostic,
	type AIEngineStatusBadge,
	type AIEngineTestResult,
	type GeoDiagnosticReport,
} from '@/types/geo-diagnostic';
import { reachEngineList, type EngineSimulationData, type ReachLevel } from '@/types/site-reach';

interface AIEngineSummaryHeaderProps {
	report: GeoDiagnosticReport;
	isAfter?: boolean;
}

interface AIEngineSummaryHeaderFromAuditProps {
	audit: AuditReport;
	reportData?: GeoNarrativeReport | null;
	isAfter?: boolean;
}

type LevelReachTone = 'emerald' | 'blue' | 'amber';

const LEVEL_REACH_THEME: Record<
	LevelReachTone,
	{ card: string; label: string; count: string; hint: string }
> = {
	emerald: {
		card: 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20',
		label: 'text-emerald-700 dark:text-emerald-400',
		count: 'text-emerald-600 dark:text-emerald-400',
		hint: 'text-emerald-600/80 dark:text-emerald-400/80',
	},
	blue: {
		card: 'border-blue-200 dark:border-blue-800/50 bg-blue-50/40 dark:bg-blue-950/20',
		label: 'text-blue-700 dark:text-blue-400',
		count: 'text-blue-600 dark:text-blue-400',
		hint: 'text-blue-600/80 dark:text-blue-400/80',
	},
	amber: {
		card: 'border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20',
		label: 'text-amber-700 dark:text-amber-400',
		count: 'text-amber-600 dark:text-amber-400',
		hint: 'text-amber-600/80 dark:text-amber-400/80',
	},
};

function LevelReachCard({
	tone,
	count,
	label,
	countLabel,
	hint,
}: {
	tone: LevelReachTone;
	count: number;
	label: string;
	countLabel: string;
	hint: string;
}) {
	const theme = LEVEL_REACH_THEME[tone];
	const active = count > 0;

	return (
		<div
			className={`rounded-xl border p-4 transition-all ${theme.card} ${
				active ? 'shadow-sm' : 'opacity-55'
			}`}
		>
			<div className={`mb-1 text-xs font-semibold ${theme.label}`}>{label}</div>
			<div className={`text-2xl font-bold tabular-nums ${theme.count}`}>{countLabel}</div>
			<div className={`mt-1 text-xs ${theme.hint}`}>{hint}</div>
		</div>
	);
}

const STATUS_CHIP: Record<AIEngineStatusBadge, string> = {
	optimal:
		'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-400/40',
	moderate:
		'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400/40',
	exact_only:
		'bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 ring-1 ring-rose-400/40',
	not_indexed:
		'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 ring-1 ring-slate-300/50 dark:ring-white/15',
};

function badgeForLevel(level: ReachLevel): AIEngineStatusBadge {
	if (level === 3) return 'optimal';
	if (level === 2) return 'moderate';
	return 'exact_only';
}

function EngineStatusChip({
	result,
	simulation,
}: {
	result?: AIEngineTestResult;
	simulation?: EngineSimulationData;
}) {
	const t = useTranslations('audit.aiEngineSummary');
	const id = simulation?.engineId ?? result?.engine.id;
	if (!id) return null;
	const Glyph = ENGINE_GLYPH[id];
	const theme = ENGINE_CHAT_THEME[id];
	const status = simulation ? badgeForLevel(simulation.level) : result?.statusBadge ?? 'exact_only';
	const badgeLabel = simulation?.levelLabel ?? t(`chip.${status}`);
	const name = simulation?.engineName ?? result?.engine.name ?? id;

	return (
		<li className="max-w-full shrink-0">
			<div className="flex max-w-full items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] py-1 pl-1 pr-2 shadow-sm backdrop-blur-sm">
				<span
					className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${theme.logoWrap}`}
				>
					<Glyph className="h-3.5 w-3.5" />
				</span>
				<span className="shrink-0 text-xs font-bold text-slate-800 dark:text-slate-100">
					{name}
				</span>
				<span
					title={badgeLabel}
					className={`min-w-0 truncate rounded-full px-2.5 py-0.5 text-[10px] font-extrabold sm:px-3 ${STATUS_CHIP[status]}`}
				>
					{badgeLabel}
				</span>
			</div>
		</li>
	);
}

export function AIEngineSummaryHeader({ report, isAfter = false }: AIEngineSummaryHeaderProps) {
	const t = useTranslations('audit.aiEngineSummary');
	const reach = useOptionalSiteReach();
	const slice = reach?.activeSlice;
	const after = reach ? reach.isAfterView : isAfter;
	const summary = useMemo(() => summarizeGeoDiagnostic(report.engines), [report.engines]);
	const level3Count = slice?.level3Count ?? (after ? summary.levelCounts[3] : 0);
	const level2Count = slice?.level2Count ?? (after ? summary.levelCounts[2] : 0);
	const level1Count = slice?.level1Count ?? (after ? 0 : summary.totalEngines);
	const recommendedCount = slice?.recommendedCount ?? (after ? summary.indexedCount : 0);
	const chipEngines = slice ? reachEngineList(slice) : null;

	return (
		<section
			id="sec-ai-engine-summary"
			className="pdf-page-item audit-report-section relative flex w-full min-w-0 max-w-full flex-col gap-5 overflow-hidden rounded-2xl border border-indigo-200 dark:border-indigo-400/20 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-[#0E1140] dark:via-[#0B1028] dark:to-[#062016] p-5 sm:p-6 ring-1 ring-indigo-400/20"
			aria-labelledby="ai-engine-summary-heading"
		>
			<div
				className="pointer-events-none absolute inset-0 opacity-40 print:hidden"
				style={{
					background:
						'radial-gradient(circle at 12% 18%, rgba(56,189,248,0.22), transparent 46%), radial-gradient(circle at 88% 12%, rgba(16,185,129,0.16), transparent 42%)',
				}}
			/>

			<div className="relative mb-1">
				<div className="mb-1 flex flex-wrap items-center gap-2">
					<span className="text-xl" aria-hidden>
						🎯
					</span>
					<h2
						id="ai-engine-summary-heading"
						className="text-lg font-bold text-gray-900 dark:text-white"
					>
						{t('queryReachTitle')}
					</h2>
					{after ? <PrescriptionAppliedBadge /> : null}
				</div>
				<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('queryReachHint')}</p>
			</div>

			<div className="relative mb-1 grid grid-cols-1 gap-4 md:grid-cols-3">
				<LevelReachCard
					tone="emerald"
					count={level3Count}
					label={t('level3Label')}
					countLabel={t('engineCount', { count: level3Count })}
					hint={t('level3Hint')}
				/>
				<LevelReachCard
					tone="blue"
					count={level2Count}
					label={t('level2Label')}
					countLabel={t('engineCount', { count: level2Count })}
					hint={t('level2Hint')}
				/>
				<LevelReachCard
					tone="amber"
					count={level1Count}
					label={t('level1Label')}
					countLabel={
						level1Count > 0
							? t('engineCountAlert', { count: level1Count })
							: t('engineCount', { count: level1Count })
					}
					hint={after ? t('level1HintAfter') : t('level1Hint')}
				/>
			</div>

			<div
				className={`relative rounded-xl border p-4 transition-colors ${
					after
						? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20'
						: 'border-amber-200 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20'
				}`}
			>
				<div className="mb-1 flex items-center justify-between gap-2">
					<div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
						{t('indexedRatioLabel')}
					</div>
					<span
						className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
							after
								? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
								: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
						}`}
					>
						{after ? t('recommendedBadgeAfter') : t('recommendedBadgeBefore')}
					</span>
				</div>

				<div className="my-1 flex items-baseline gap-1">
					<span
						className={`text-2xl font-bold tabular-nums ${
							after
								? 'text-emerald-600 dark:text-emerald-400'
								: 'text-amber-600 dark:text-amber-400'
						}`}
					>
						{recommendedCount}
					</span>
					<span className="text-sm font-medium text-gray-400"> / {summary.totalEngines}</span>
				</div>

				<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
					{after ? t('recommendedHintAfter') : t('recommendedHintBefore')}
				</p>
			</div>

			<ul className="relative flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
				{chipEngines
					? chipEngines.map((engine) => <EngineStatusChip key={engine.engineId} simulation={engine} />)
					: report.engines.map((engine) => <EngineStatusChip key={engine.engine.id} result={engine} />)}
			</ul>
		</section>
	);
}

/** Audit-result entry point — maps the live crawl heuristic into the STEP 1 diagnostic model. */
export function AIEngineSummaryHeaderFromAudit({
	audit,
	reportData,
	isAfter,
}: AIEngineSummaryHeaderFromAuditProps) {
	const locale = useLocale();
	const report = useMemo(
		() => buildGeoDiagnosticReportFromAudit(audit, locale === 'en' ? 'en' : 'ko', reportData),
		[audit, locale, reportData],
	);
	return <AIEngineSummaryHeader report={report} isAfter={isAfter} />;
}
