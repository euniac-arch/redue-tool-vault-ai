'use client';

import { useTranslations } from 'next-intl';
import { useAuditPayload, useEvaluationReport } from '@/components/audit/AuditPayloadProvider';
import {
	AI_RECOMMEND_THRESHOLD,
	ensureExecutiveSummary,
	type ExecutiveSummary,
} from '@/lib/audit/executive-summary';
import type { AuditReport } from '@/lib/site-auditor';

interface ReportPDFTemplateProps {
	report: AuditReport;
	/** When omitted, the briefing is derived from live scores + site keywords. */
	summary?: ExecutiveSummary | null;
}

function formatPts(n: number): string {
	if (!Number.isFinite(n)) return '0';
	const rounded = Math.round(n * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * A4 PDF-only executive briefing. Hidden on the dashboard (`pdf-print-only`)
 * and injected at the top of `#pdf-print-area` during print / html2canvas.
 * Light palette is hard-coded — no `dark:` variants — so the sheet stays
 * high-contrast even when the dashboard is in dark mode.
 */
export function ReportPDFTemplate({ report, summary }: ReportPDFTemplateProps) {
	const t = useTranslations('audit.execBriefing');
	const liveReport = useEvaluationReport(report);
	const { isPrescriptionApplied, appliedResult } = useAuditPayload();
	const showingAfter =
		Boolean(liveReport.isPrescriptionApplied) ||
		(isPrescriptionApplied && appliedResult?.viewMode !== 'before' && liveReport.url === report.url);
	const briefing =
		(showingAfter ? liveReport.executiveSummary : summary) ??
		ensureExecutiveSummary(liveReport).executiveSummary;
	if (!briefing) return null;

	const { weaknessPoint, riskAssessment, expectedResult, overallScore } = briefing;
	const weakPts = `${formatPts(weaknessPoint.score)}/${formatPts(weaknessPoint.maxScore)}`;

	return (
		<section
			id="sec-summary"
			className="pdf-print-only pdf-print-container pdf-light-theme exec-briefing-card audit-report-section pdf-page-item scroll-mt-24 rounded-2xl border border-slate-200 bg-white text-slate-900"
		>
			<div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-700">
					{t('badge')}
				</p>
				<h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">{t('title')}</h2>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-900">
						{t('overallBadge', { score: overallScore })}
					</span>
					<span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-900">
						{t('thresholdBadge', { threshold: AI_RECOMMEND_THRESHOLD })}
					</span>
					{showingAfter ? (
						<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
							{t('appliedStatus')}
						</span>
					) : null}
				</div>
			</div>

			<div className="grid grid-cols-1 gap-3 bg-white p-5 sm:p-6">
				<article className="pdf-card-box block rounded-xl border border-slate-200 bg-slate-50 px-4 !pt-6 pb-3.5 text-slate-900">
					<p className="block text-[11px] font-extrabold uppercase tracking-wide text-rose-700">
						{t('weaknessLabel')}
					</p>
					<p className="mt-1 block text-sm font-extrabold text-slate-900">
						{weaknessPoint.categoryLabel}
						<span className="ml-2 font-mono text-xs font-bold text-slate-700">
							{weakPts}
							<span className="ml-1.5 font-sans text-slate-500">({weaknessPoint.ratioPct}%)</span>
						</span>
					</p>
					<p className="mt-2 block text-sm leading-relaxed text-slate-800">{weaknessPoint.text}</p>
				</article>

				<article className="pdf-card-box block rounded-xl border border-slate-200 bg-slate-50 px-4 !pt-6 pb-3.5 text-slate-900">
					<p className="block text-[11px] font-extrabold uppercase tracking-wide text-amber-800">
						{t('riskLabel')}
					</p>
					<p className="mt-2 block text-sm leading-relaxed text-slate-800">{riskAssessment.text}</p>
				</article>

				<article className="pdf-card-box block rounded-xl border border-slate-200 bg-slate-50 px-4 !pt-6 pb-3.5 text-slate-900">
					<p className="block text-[11px] font-extrabold uppercase tracking-wide text-indigo-700">
						{showingAfter ? t('appliedExpectedLabel') : t('expectedLabel')}
					</p>
					<p className="mt-1 block text-sm font-extrabold text-slate-900">
						{t(showingAfter ? 'appliedDelta' : 'expectedDelta', {
							current: expectedResult.currentScore,
							projected: expectedResult.projectedScore,
							gain: expectedResult.gain,
						})}
					</p>
					<p className="mt-2 block text-sm leading-relaxed text-slate-800">{expectedResult.text}</p>
				</article>
			</div>
			<p className="border-t border-slate-200 px-5 py-3 text-[10.5px] leading-relaxed text-slate-500 sm:px-6">
				{t('disclaimer')}
			</p>
		</section>
	);
}
