'use client';

import { useTranslations } from 'next-intl';
import { PdfStageHeading, PdfStatusBadge, type PdfCellStatus } from '@/components/audit/print/pdf-print-shared';
import type { DiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import type { DiagnosticCategoryId } from '@/lib/audit/onpage-diagnostic';

interface PdfQuickAxesCardProps {
	scoreSnapshot: DiagnosisScoreSnapshot;
}

function categoryScore(
	categories: DiagnosisScoreSnapshot['onpage']['categories'],
	id: DiagnosticCategoryId,
): number {
	return categories.find((c) => c.id === id)?.score100 ?? 0;
}

function statusFromScore(score: number): PdfCellStatus {
	if (score >= 80) return 'pass';
	if (score >= 55) return 'warning';
	return 'fail';
}

/**
 * Stage 1 (continued) — 4-axis quick score row: AI citation readiness (GEO),
 * structured-data completeness (Schema), on-page technical trust, and
 * infra/security. Sourced from the same `onpage.categories` breakdown the
 * dashboard's 5-category radar uses, so it never drifts from the live score.
 */
export function PdfQuickAxesCard({ scoreSnapshot }: PdfQuickAxesCardProps) {
	const t = useTranslations('audit.pdfReport.quickAxes');
	const categories = scoreSnapshot?.onpage?.categories ?? [];
	const geoAxis = categoryScore(categories, 'geo');
	const schemaAxis = categoryScore(categories, 'schema');
	const technicalAxis = categoryScore(categories, 'seo');
	const security = categoryScore(categories, 'security');
	const performance = categoryScore(categories, 'performance');
	const infraAxis = Math.round((security + performance) / 2);

	const axes = [
		{ id: 'geo', label: t('geo'), score: geoAxis },
		{ id: 'schema', label: t('schema'), score: schemaAxis },
		{ id: 'technical', label: t('technical'), score: technicalAxis },
		{ id: 'infra', label: t('infra'), score: infraAxis },
	];

	return (
		<section
			id="sec-pdf-quick-axes"
			className="pdf-print-only pdf-page-item audit-report-section rounded-2xl border border-slate-200 bg-white"
		>
			<PdfStageHeading step={1} eyebrow={t('eyebrow')} title={t('title')} hint={t('hint')} />
			<div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
				{axes.map((axis) => {
					const status = statusFromScore(axis.score);
					return (
						<article
							key={axis.id}
							className="flex flex-col justify-start gap-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
						>
							<p className="text-[10.5px] font-bold uppercase leading-none tracking-wide text-slate-500">
								{axis.label}
							</p>
							<p className="pdf-text-gold font-mono text-2xl font-extrabold leading-none">
								{axis.score}
								<span className="ml-0.5 text-xs font-bold text-slate-400">/100</span>
							</p>
							<PdfStatusBadge status={status}>{t(`status.${status}`)}</PdfStatusBadge>
						</article>
					);
				})}
			</div>
		</section>
	);
}
