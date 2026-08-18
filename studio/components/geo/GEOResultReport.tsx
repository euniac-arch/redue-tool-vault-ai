'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ENGINE_CHAT_THEME, ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import { GEOPromptReasonCard } from '@/components/geo/GEOPromptReasonCard';
import { GeoPrescriptionCoverageSection } from '@/components/geo/GeoPrescriptionCoverageSection';
import { PrescriptionAppliedBadge } from '@/components/geo/PrescriptionAppliedBadge';
import { openGeoAnswerCenter } from '@/lib/audit/exec-brief';
import { prescriptionTriggerChanges, type PrescriptionLang } from '@/lib/geo/prescription-after';
import { summarizeAppliedSchemaTags } from '@/lib/geo/prescription-patches';
import type { GeoDiagnosticReport, KeywordDepthLevel } from '@/types/geo-diagnostic';
import type {
	AppliedGeoPatches,
	ExpandedQueryCoverage,
	KeywordWeight,
	RecommendationReason,
} from '@/types/geo-prescription';

export interface GEOResultReportProps {
	before: GeoDiagnosticReport;
	after: GeoDiagnosticReport;
	lang: PrescriptionLang;
	patches?: AppliedGeoPatches | null;
	coverage?: ExpandedQueryCoverage | null;
	keywordWeights?: readonly KeywordWeight[] | null;
	recommendationReasons?: readonly RecommendationReason[] | null;
}

function depthKey(level: KeywordDepthLevel | null): '0' | '1' | '2' | '3' {
	if (level === 3) return '3';
	if (level === 2) return '2';
	if (level === 1) return '1';
	return '0';
}

export function GEOResultReport({
	before,
	after,
	lang: _lang,
	patches,
	coverage,
	keywordWeights,
	recommendationReasons,
}: GEOResultReportProps) {
	const t = useTranslations('audit.geoPrescriptionReport');
	const reduceMotion = useReducedMotion();

	const schemaType = patches?.schemaType || 'Organization';
	const faqCount = patches?.faqCount ?? 5;
	const schemaTags = useMemo(
		() => summarizeAppliedSchemaTags(patches?.jsonLd, schemaType),
		[patches?.jsonLd, schemaType],
	);
	const changes = useMemo(() => prescriptionTriggerChanges(before, after), [before, after]);

	return (
		<motion.section
			initial={reduceMotion ? false : { opacity: 0, y: -12, height: 0 }}
			animate={{ opacity: 1, y: 0, height: 'auto' }}
			exit={reduceMotion ? undefined : { opacity: 0, y: -8, height: 0 }}
			transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
			className="print:hidden overflow-hidden"
			aria-labelledby="geo-prescription-report-heading"
			role="status"
		>
			{coverage ? (
				<GeoPrescriptionCoverageSection
					coverage={coverage}
					keywordWeights={keywordWeights}
					brandName={before.brandName}
					headingId="geo-prescription-report-heading"
				/>
			) : (
				<div className="rounded-2xl border border-emerald-200 dark:border-emerald-400/25 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 dark:from-emerald-500/[0.12] dark:via-[#0B1028] dark:to-cyan-500/[0.08] p-5 sm:p-6">
					<div className="flex items-start gap-3">
						<span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
							<Sparkles className="h-5 w-5" aria-hidden />
						</span>
						<div className="min-w-0">
							<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('kicker')}</p>
							<div className="mt-1 flex flex-wrap items-center gap-2">
								<h3
									id="geo-prescription-report-heading"
									className="text-lg font-extrabold text-slate-900 dark:text-white sm:text-xl"
								>
									{t('title')}
								</h3>
								<PrescriptionAppliedBadge />
							</div>
							<p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t('subtitle')}</p>
						</div>
					</div>
				</div>
			)}

			{coverage && recommendationReasons && recommendationReasons.length > 0 ? (
				<div className="mt-4">
					<GEOPromptReasonCard reasons={recommendationReasons} />
				</div>
			) : null}

			<div className="mt-4 rounded-2xl border border-emerald-200 dark:border-emerald-400/25 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 dark:from-emerald-500/[0.12] dark:via-[#0B1028] dark:to-cyan-500/[0.08] p-5 sm:p-6">
				<div>
					<p className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
						{t('patchesTitle')}
					</p>
					<ul className="mt-2 flex flex-col gap-2">
						<li className="flex items-start gap-2 rounded-xl border border-emerald-200/80 dark:border-emerald-400/20 bg-white/80 dark:bg-white/[0.04] px-3.5 py-2.5">
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
							<p className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
								{t('patches.schema', { schemaType })}
							</p>
						</li>
						<li className="flex items-start gap-2 rounded-xl border border-emerald-200/80 dark:border-emerald-400/20 bg-white/80 dark:bg-white/[0.04] px-3.5 py-2.5">
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
							<p className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
								{t('patches.faq', { count: faqCount })}
							</p>
						</li>
						<li className="flex items-start gap-2 rounded-xl border border-emerald-200/80 dark:border-emerald-400/20 bg-white/80 dark:bg-white/[0.04] px-3.5 py-2.5">
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
							<p className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
								{t('patches.meta')}
							</p>
						</li>
					</ul>
				</div>

				<div className="mt-5">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							<p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-300">
								{t('schemaPreview')}
							</p>
							<p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
								{t('schemaSummaryHint')}
							</p>
						</div>
						<button
							type="button"
							onClick={() => openGeoAnswerCenter('schema')}
							className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-500"
						>
							<span>{t('goToModule1')}</span>
							<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
						</button>
					</div>
					<ul className="mt-3 flex flex-wrap gap-1.5">
						{schemaTags.map((tag) => (
							<li
								key={tag.key}
								className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 ring-1 ring-emerald-300/70 dark:bg-white/[0.06] dark:ring-emerald-400/30"
							>
								<span className="font-mono text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">
									{tag.key}
								</span>
								<span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
									{tag.value}
								</span>
							</li>
						))}
					</ul>
				</div>

				<div className="mt-5">
					<p className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-800 dark:text-indigo-300">
						{t('changesTitle')}
					</p>
					<ul className="mt-2 flex flex-col gap-2">
						{changes.map((row) => {
							const Glyph = ENGINE_GLYPH[row.engineId];
							const theme = ENGINE_CHAT_THEME[row.engineId];
							return (
								<li
									key={row.engineId}
									className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
								>
									<div className="flex min-w-0 items-center gap-2">
										<span
											className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${theme.logoWrap}`}
										>
											<Glyph className="h-4 w-4" />
										</span>
										<p className="text-sm font-extrabold text-slate-900 dark:text-white">{row.engineName}</p>
									</div>
									<div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-bold">
										<span className="rounded-full bg-slate-100 dark:bg-white/10 px-2.5 py-1 text-slate-600 dark:text-slate-300">
											{t(`depth.${depthKey(row.beforeLevel)}`)}
										</span>
										<ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
										<span className="rounded-full bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-1 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-400/40">
											{t(`depth.${depthKey(row.afterLevel)}`)}
										</span>
									</div>
								</li>
							);
						})}
					</ul>
				</div>
			</div>
		</motion.section>
	);
}
