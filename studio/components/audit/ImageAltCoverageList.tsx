'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
	meaningfulPageDisplay,
	thumbnailSrcCandidates,
	toMissingImageRow,
	type ImageAltIssue,
	type MissingAltIssueType,
	type PageDisplayLang,
} from '@/lib/audit/extractors/heading-alt-details';
import { resolveOpenableUrl } from '@/lib/audit/extractors/page-resource-trackers';

const IMAGE_ALT_THUMB_FALLBACK =
	"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'><rect width='18' height='18' x='3' y='3' rx='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg>";

const ISSUE_TYPE_BADGE: Record<MissingAltIssueType, string> = {
	missing:
		'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800',
	empty:
		'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
	stopword:
		'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/70 dark:text-violet-300 dark:border-violet-800',
};

function asLang(locale: string): PageDisplayLang {
	return locale.toLowerCase().startsWith('en') ? 'en' : 'ko';
}

function ImageAltThumb({ sources, alt }: { sources: string[]; alt: string }) {
	const [index, setIndex] = useState(0);
	const src = sources[index] || IMAGE_ALT_THUMB_FALLBACK;
	const exhausted = index >= sources.length;

	return (
		<div
			className="image-alt-thumb"
			style={{ width: 48, height: 48, minWidth: 48, overflow: 'hidden' }}
		>
			<img
				src={exhausted ? IMAGE_ALT_THUMB_FALLBACK : src}
				alt={alt}
				loading="lazy"
				referrerPolicy="no-referrer"
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					borderRadius: 4,
					border: '1px solid #e2e8f0',
					background: '#f8fafc',
				}}
				onError={() => {
					setIndex((current) => (current < sources.length ? current + 1 : current));
				}}
			/>
		</div>
	);
}

export function ImageAltCoverageList({
	issues,
	coveragePct,
	missingCount,
}: {
	issues: ImageAltIssue[];
	coveragePct?: number;
	missingCount?: number;
}) {
	const t = useTranslations('audit.checklist.detailScroll');
	const lang = asLang(useLocale());
	const missing = missingCount ?? issues.length;
	const coverage = coveragePct ?? (issues.length === 0 ? 100 : undefined);

	const issueTypeLabel = (type: MissingAltIssueType) => {
		if (type === 'empty') return t('issueEmpty');
		if (type === 'stopword') return t('issueStopword');
		return t('issueMissing');
	};

	return (
		<div className="checklist-detail-scroll custom-scrollbar bg-slate-50 dark:border-white/10 dark:bg-slate-900/70">
			{coverage != null ? (
				<p className="mb-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
					{t('imageAltCoverage', { coverage, missing })}
				</p>
			) : null}
			{issues.length === 0 ? (
				<p className="text-[11px] text-slate-500">{t('imageAltEmpty')}</p>
			) : (
				<ul className="image-alt-issue-list">
					{issues.map((row, idx) => {
						const detail = toMissingImageRow(row, lang);
						const imgSrc = detail.img_src || row.src;
						const pageUrl = detail.page_url || row.pageUrl || '';
						const thumbSources = thumbnailSrcCandidates(imgSrc, {
							pageUrl,
							href: row.href || detail.normalized_src || row.normalizedSrc,
						});
						const openHref =
							thumbSources[0] ||
							resolveOpenableUrl(
								detail.normalized_src || row.href,
								imgSrc,
								pageUrl,
							);
						const issueType = detail.issue_type || row.issueType || 'missing';
						const pageDisplay = meaningfulPageDisplay(pageUrl, detail.page_display, lang);
						return (
							<li key={`${pageUrl}-${imgSrc}-${idx}`} className="image-alt-issue-item">
								<ImageAltThumb sources={thumbSources} alt={t('previewAlt')} />
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-1.5">
										{pageDisplay ? (
											<>
												<span
													className="max-w-full truncate rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
													title={pageUrl}
												>
													{pageDisplay}
												</span>
												<span className="text-[10px] text-slate-400">➔</span>
											</>
										) : null}
										<span
											className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${ISSUE_TYPE_BADGE[issueType]}`}
										>
											{issueTypeLabel(issueType)}
										</span>
									</div>
									{openHref ? (
										<a
											href={openHref}
											target="_blank"
											rel="noopener noreferrer"
											title={t('openSrc')}
											className="mt-1 block truncate text-xs text-blue-500 hover:underline"
										>
											{imgSrc}
										</a>
									) : (
										<span className="mt-1 block truncate text-xs text-blue-500">{imgSrc}</span>
									)}
									<div className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
										{t('suggestedAlt')}: &quot;{detail.suggested_alt}&quot;
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
