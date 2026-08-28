'use client';

import { useTranslations } from 'next-intl';
import {
	PDF_TABLE,
	PDF_TABLE_TD,
	PDF_TABLE_TH,
	PDF_TABLE_WRAP,
	PdfStageHeading,
	PdfStatusBadge,
	type PdfCellStatus,
} from '@/components/audit/print/pdf-print-shared';
import { normalizeChecklistItems } from '@/lib/audit/onpage-diagnostic';
import { detectVideoObjectsFromCorpus } from '@/lib/audit/schemaAnalyzer';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';

interface PdfSchemaGraphTableProps {
	report: AuditReport;
}

function verdict(check?: AuditCheckItem): PdfCellStatus {
	if (!check) return 'neutral';
	if (check.status === 'pass' || check.status === 'warning' || check.status === 'fail') return check.status;
	return check.passed ? 'pass' : 'fail';
}

/** Worse-of-two verdict — used for the combined Person / E-E-A-T row. */
function combineVerdict(a: PdfCellStatus, b: PdfCellStatus): PdfCellStatus {
	const rank: Record<PdfCellStatus, number> = { fail: 0, neutral: 1, warning: 2, pass: 3 };
	return rank[a] <= rank[b] ? a : b;
}

/**
 * Stage 3 — JSON-LD schema graph node coverage table (full parity with the
 * on-screen Track 1 schema card + `SchemaCompletenessChecklist`): the 7
 * checklist-derived nodes, a real `VideoObject` detection pass over the
 * untruncated JSON-LD corpus (no fabricated rows), and the attribute-level
 * missing-field lists the crawler already collected for Organization /
 * Article / Person.
 */
export function PdfSchemaGraphTable({ report }: PdfSchemaGraphTableProps) {
	const t = useTranslations('audit.pdfReport.schemaTable');
	const checklist = normalizeChecklistItems(report);
	const byId = new Map(checklist.map((c) => [c.id, c]));
	const detectedVideos = detectVideoObjectsFromCorpus(report.metrics?.jsonLdFullCorpus);
	const schemaTypes = report.metrics?.schemaTypes ?? [];

	const personVerdict = combineVerdict(verdict(byId.get('person-eeat')), verdict(byId.get('eeat-author')));
	const videoVerdict: PdfCellStatus = detectedVideos.length > 0 ? 'pass' : 'neutral';

	const rows: { id: string; node: string; status: PdfCellStatus; evidence?: string }[] = [
		{ id: 'organization', node: 'Organization', status: verdict(byId.get('organization')), evidence: byId.get('organization')?.evidence },
		{ id: 'medicalClinic', node: t('medicalClinicNode'), status: verdict(byId.get('news-article')), evidence: byId.get('news-article')?.evidence },
		{ id: 'person', node: t('personNode'), status: personVerdict, evidence: byId.get('person-eeat')?.evidence ?? byId.get('eeat-author')?.evidence },
		{ id: 'medicalWebPage', node: t('medicalWebPageNode'), status: verdict(byId.get('article-fields')), evidence: byId.get('article-fields')?.evidence },
		{
			id: 'videoObject',
			node: 'VideoObject',
			status: videoVerdict,
			evidence: detectedVideos.length > 0 ? t('videoDetectedCount', { count: detectedVideos.length }) : t('videoObjectNote'),
		},
		{ id: 'faqPage', node: 'FAQPage', status: verdict(byId.get('faq-howto-schema')), evidence: byId.get('faq-howto-schema')?.evidence },
		{ id: 'websiteBreadcrumb', node: t('websiteBreadcrumbNode'), status: verdict(byId.get('website-schema')), evidence: byId.get('website-schema')?.evidence },
	];

	const attributeGroups: { id: string; title: string; missing: string[] | undefined }[] = [
		{ id: 'organization', title: t('attrOrganizationTitle'), missing: report.metrics?.organizationMissing },
		{ id: 'article', title: t('attrArticleTitle'), missing: report.metrics?.articleMissing },
		{ id: 'person', title: t('attrPersonTitle'), missing: report.metrics?.personMissing },
	];

	return (
		<section
			id="sec-pdf-schema-table"
			className="pdf-print-only pdf-page-item audit-report-section rounded-2xl border border-slate-200 bg-white"
		>
			<PdfStageHeading step={3} eyebrow={t('eyebrow')} title={t('title')} hint={t('hint')} />
			<div className={`m-5 sm:m-6 ${PDF_TABLE_WRAP}`}>
				<table className={PDF_TABLE}>
					<thead>
						<tr>
							<th className={PDF_TABLE_TH}>{t('colNode')}</th>
							<th className={PDF_TABLE_TH}>{t('colStatus')}</th>
							<th className={PDF_TABLE_TH}>{t('colEvidence')}</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.id} className="pdf-table-row">
								<td className={`${PDF_TABLE_TD} font-bold text-slate-900`}>{row.node}</td>
								<td className={PDF_TABLE_TD}>
									<PdfStatusBadge status={row.status}>{t(`status.${row.status}`)}</PdfStatusBadge>
								</td>
								<td className={PDF_TABLE_TD}>{row.evidence?.trim() || t('noEvidence')}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{schemaTypes.length > 0 ? (
				<div className="mx-5 mb-5 sm:mx-6">
					<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('detectedTypesTitle')}</p>
					<div className="mt-2 flex flex-wrap gap-1.5">
						{schemaTypes.map((type) => (
							<span
								key={type}
								className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10.5px] font-bold text-slate-700"
							>
								{type}
							</span>
						))}
					</div>
				</div>
			) : null}

			<div className="border-t border-slate-200 px-5 py-4 sm:px-6">
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('attributesTitle')}</p>
				<div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
					{attributeGroups.map((group) => (
						<div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
							<p className="text-[11px] font-bold text-slate-800">{group.title}</p>
							{group.missing && group.missing.length > 0 ? (
								<ul className="mt-1.5 flex flex-col gap-1">
									{group.missing.map((field) => (
										<li key={field} className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-rose-700">
											<span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-rose-500" aria-hidden />
											<span>{field}</span>
										</li>
									))}
								</ul>
							) : (
								<p className="mt-1.5 text-[10.5px] font-semibold text-emerald-700">{t('attributesAllPresent')}</p>
							)}
						</div>
					))}
				</div>
			</div>

			<div className="border-t border-slate-200 px-5 py-4 sm:px-6">
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('videoSectionTitle')}</p>
				{detectedVideos.length === 0 ? (
					<p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t('videoEmpty')}</p>
				) : (
					<div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
						{detectedVideos.map((video, index) => (
							<article key={`${video.name}-${index}`} className="pdf-table-row rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
								<p className="text-[11.5px] font-bold text-slate-900">{video.name}</p>
								{video.embedUrl ? (
									<p className="mt-1 break-all text-[10px] leading-relaxed text-slate-600">
										{t('videoFieldEmbed')}: {video.embedUrl}
									</p>
								) : null}
								{video.contentUrl ? (
									<p className="mt-0.5 break-all text-[10px] leading-relaxed text-slate-600">
										{t('videoFieldContent')}: {video.contentUrl}
									</p>
								) : null}
								{video.thumbnailUrl ? (
									<p className="mt-0.5 break-all text-[10px] leading-relaxed text-slate-500">
										{t('videoFieldThumbnail')}: {video.thumbnailUrl}
									</p>
								) : null}
								{video.uploadDate ? (
									<p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
										{t('videoFieldUpload')}: {video.uploadDate}
									</p>
								) : null}
							</article>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
