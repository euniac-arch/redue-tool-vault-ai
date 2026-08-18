'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AuditScoreHeader } from '@/components/AuditScoreHeader';
import { MetricImpactCard } from '@/components/audit/MetricImpactCard';
import { combinedRagFactScore } from '@/lib/audit/metric-benefit';
import { computeAdvancedGeoFromReport } from '@/lib/audit/advancedGeoFromReport';
import {
	FACT_DENSITY_TARGET,
	RAG_TEXT_TO_HTML_RECOMMENDED,
	type FactDensityResult,
	type RagChunkingResult,
} from '@/lib/audit/advancedGeoMetrics';
import type { OnPageDiagnosticProps } from '@/lib/audit/onpage-diagnostic';
import type { AuditScores } from '@/lib/audit/scoreCalculator';
import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';
import type { AuditReport } from '@/lib/site-auditor';

export interface Tab2TechnicalSectionProps {
	report: AuditReport;
	diagnostic: OnPageDiagnosticProps;
	scores: AuditScores;
	children?: ReactNode;
}

function gaugeTone(score: number): string {
	if (score >= 80) return 'text-emerald-600 dark:text-emerald-300';
	if (score >= 50) return 'text-amber-600 dark:text-amber-300';
	return 'text-rose-600 dark:text-rose-300';
}

function Gauge({
	score,
	label,
	hint,
	meta,
}: {
	score: number;
	label: string;
	hint: string;
	meta: string;
}) {
	const clamped = Math.min(100, Math.max(0, score));
	const radius = 42;
	const circ = 2 * Math.PI * radius;
	const offset = circ * (1 - clamped / 100);

	return (
		<article className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/[0.08] dark:bg-black/25">
			<div className="flex items-center gap-4">
				<svg viewBox="0 0 108 108" className="h-24 w-24 shrink-0" aria-hidden>
					<circle cx="54" cy="54" r={radius} className="fill-none stroke-slate-200 dark:stroke-white/10" strokeWidth="10" />
					<circle
						cx="54"
						cy="54"
						r={radius}
						className="fill-none stroke-cyan-500"
						strokeWidth="10"
						strokeLinecap="round"
						strokeDasharray={circ}
						strokeDashoffset={offset}
						transform="rotate(-90 54 54)"
					/>
					<text
						x="54"
						y="58"
						textAnchor="middle"
						className={`fill-current text-[18px] font-extrabold ${gaugeTone(clamped)}`}
					>
						{clamped}
					</text>
				</svg>
				<div className="min-w-0">
					<p className="text-sm font-extrabold text-slate-900 dark:text-white">{label}</p>
					<p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{hint}</p>
					<p className="mt-2 font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-300">{meta}</p>
				</div>
			</div>
			<div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
				<div
					className={`h-full rounded-full ${clamped >= 80 ? 'bg-emerald-500' : clamped >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
					style={{ width: `${clamped}%` }}
				/>
			</div>
		</article>
	);
}

function RagFactDensityCard({
	rag,
	fact,
	industryConfig,
}: {
	rag: RagChunkingResult;
	fact: FactDensityResult;
	industryConfig?: Pick<IndustryConfig, 'defaultCategory'> | null;
}) {
	const t = useTranslations('audit.advancedGeo.rag');
	const semanticBits = [
		rag.semantic.article ? 'article' : null,
		rag.semantic.section ? 'section' : null,
		rag.semantic.main ? 'main' : null,
	].filter(Boolean);

	return (
		<section
			id="rag-fact-density"
			className="pdf-page-item audit-report-section scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-6"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">{t('kicker')}</p>
				<h3 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</h3>
				<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('subtitle')}</p>
			</div>
			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				<Gauge
					score={rag.score}
					label={t('chunkTitle')}
					hint={t('chunkHint', { recommended: Math.round(RAG_TEXT_TO_HTML_RECOMMENDED * 100) })}
					meta={t('chunkMeta', {
						ratio: rag.textToHtmlPct,
						tags: semanticBits.length ? semanticBits.join(' · ') : t('noTags'),
					})}
				/>
				<Gauge
					score={fact.score}
					label={t('factTitle')}
					hint={t('factHint', { target: Math.round(FACT_DENSITY_TARGET * 100) })}
					meta={t('factMeta', {
						density: fact.densityPct,
						tokens: fact.quantitativeTokenCount,
					})}
				/>
			</div>
			<MetricImpactCard
				type="rag"
				currentScore={combinedRagFactScore(rag.score, fact.score)}
				industryConfig={industryConfig}
			/>
		</section>
	);
}

/**
 * Tab 2 — SEO · GEO · Schema diagnosis.
 * Position A: RAG chunk + fact-density gauges sit directly under the 122-point header.
 */
function Tab2TechnicalSectionInner({
	report,
	diagnostic,
	scores,
	children,
}: Tab2TechnicalSectionProps) {
	const metrics = useMemo(() => computeAdvancedGeoFromReport(report), [report]);

	return (
		<>
			<AuditScoreHeader diagnostic={diagnostic} scores={scores} />
			<RagFactDensityCard
				rag={metrics.ragChunking}
				fact={metrics.factDensity}
				industryConfig={metrics.industry}
			/>
			{children}
		</>
	);
}

export const Tab2TechnicalSection = memo(Tab2TechnicalSectionInner);
