'use client';

import { useTranslations } from 'next-intl';
import {
	PDF_TABLE,
	PDF_TABLE_TD,
	PDF_TABLE_TH,
	PdfStageHeading,
	PdfStatusBadge,
	type PdfCellStatus,
} from '@/components/audit/print/pdf-print-shared';
import { buildOnPageDiagnostic, checkVerdict } from '@/lib/audit/onpage-diagnostic';
import {
	GOOGLE_MAPS_GBP_RE,
	NAVER_BLOG_CAFE_RE,
	NAVER_PLACE_MAP_RE,
} from '@/lib/audit/extractors/universal-same-as';
import type { AuditReport } from '@/lib/site-auditor';

interface PdfOnpageChecklistGridProps {
	report: AuditReport;
}

const YOUTUBE_RE = /(youtube\.com|youtu\.be)/i;
const INSTAGRAM_RE = /instagram\.com/i;
const FACEBOOK_RE = /facebook\.com/i;

/**
 * Stage 5 — full on-page/infra checklist (same source of truth as
 * the on-screen `AuditChecklist`/`DetailedChecklist`), grouped into the 5
 * standard categories, plus the same-as channel binding strip. Replaces the
 * previous 4-row curated grid so every measured pass/fail row the dashboard
 * shows also lands in the A4 report.
 */
export function PdfOnpageChecklistGrid({ report }: PdfOnpageChecklistGridProps) {
	const t = useTranslations('audit.pdfReport.onpageGrid');
	const diagnostic = buildOnPageDiagnostic(report);
	const categories = diagnostic?.categories ?? [];

	const sameAsUrls = report.siteMeta?.sameAs ?? [];
	const channels = [
		{ id: 'naverBlog', label: t('channelNaverBlog'), linked: sameAsUrls.some((u) => NAVER_BLOG_CAFE_RE.test(u)) },
		{ id: 'naverPlace', label: t('channelNaverPlace'), linked: sameAsUrls.some((u) => NAVER_PLACE_MAP_RE.test(u)) },
		{ id: 'googleMaps', label: t('channelGoogleMaps'), linked: sameAsUrls.some((u) => GOOGLE_MAPS_GBP_RE.test(u)) },
		{ id: 'youtube', label: t('channelYoutube'), linked: sameAsUrls.some((u) => YOUTUBE_RE.test(u)) },
		{ id: 'instagram', label: t('channelInstagram'), linked: sameAsUrls.some((u) => INSTAGRAM_RE.test(u)) },
		{ id: 'facebook', label: t('channelFacebook'), linked: sameAsUrls.some((u) => FACEBOOK_RE.test(u)) },
	];

	return (
		<section
			id="sec-pdf-onpage-grid"
			className="pdf-print-only pdf-page-item audit-report-section rounded-2xl border border-slate-200 bg-white"
		>
			<PdfStageHeading step={5} eyebrow={t('eyebrow')} title={t('title')} hint={t('hint')} />
			<div className="flex w-full max-w-full flex-col gap-4 p-5 sm:p-6">
				{categories.map((category) => (
					<div
						key={category.id}
						className="pdf-table-row checklist-container box-border w-full max-w-full overflow-hidden rounded-xl border border-slate-200"
					>
						<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
							<p className="text-[12px] font-extrabold text-slate-900">{category.name}</p>
							<span className="text-[10.5px] font-bold text-slate-500">
								{t('categoryScoreLabel', { score: category.rawScore, max: category.maxScore })}
							</span>
						</div>
						{(category.checks ?? []).length === 0 ? (
							<p className="px-3.5 py-3 text-[11px] text-slate-500">{t('emptyCategory')}</p>
						) : (
							<table className={`${PDF_TABLE} w-full max-w-full table-fixed`}>
								<thead>
									<tr>
										<th className={`${PDF_TABLE_TH} w-[32%]`}>{t('colItem')}</th>
										<th className={`${PDF_TABLE_TH} w-[16%]`}>{t('colStatusHeader')}</th>
										<th className={`${PDF_TABLE_TH} w-[52%]`}>{t('colEvidenceHeader')}</th>
									</tr>
								</thead>
								<tbody>
									{(category.checks ?? []).map((check) => {
										const verdictStatus: PdfCellStatus = checkVerdict(check);
										return (
											<tr key={check.id} className="pdf-table-row">
												<td className={`${PDF_TABLE_TD} break-words font-bold text-slate-900`}>{check.label}</td>
												<td className={PDF_TABLE_TD}>
													<PdfStatusBadge status={verdictStatus}>{t(`status.${verdictStatus}`)}</PdfStatusBadge>
												</td>
												<td className={`evidence-box ${PDF_TABLE_TD} max-w-0 overflow-hidden break-all whitespace-pre-wrap`}>
													{check.evidence?.trim() || t('noEvidence')}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						)}
					</div>
				))}
			</div>
			<div className="border-t border-slate-200 px-5 py-4 sm:px-6">
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('channelTitle')}</p>
				<div className="mt-2.5 flex flex-wrap gap-2">
					{channels.map((channel) => (
						<PdfStatusBadge key={channel.id} status={channel.linked ? 'pass' : 'neutral'}>
							{channel.label} · {channel.linked ? t('channelLinked') : t('channelMissing')}
						</PdfStatusBadge>
					))}
				</div>
			</div>
		</section>
	);
}
