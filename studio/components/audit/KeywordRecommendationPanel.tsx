'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
	buildKeywordRecommendations,
	collectDetectedKeywords,
	resolveKeywordSourceDetails,
	type KeywordCategoryId,
	type KeywordSourceId,
} from '@/lib/audit/keyword-recommendations';
import { keywordSourceCopy, keywordSourceHint } from '@/lib/audit/keyword-source-copy';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';

interface KeywordRecommendationPanelProps {
	report: AuditReport;
}

const CATEGORY_ORDER: KeywordCategoryId[] = ['geoPrompt', 'primary', 'longTail', 'lsiLocal'];

const SOURCE_ORDER: KeywordSourceId[] = ['schema', 'title', 'meta', 'og', 'heading', 'body'];

function sourceCopy(id: KeywordSourceId, field: 'label' | 'tag'): string {
	return keywordSourceCopy(id, field);
}

const SOURCE_TITLE_CLASS: Record<KeywordSourceId, string> = {
	schema: 'text-fuchsia-700 dark:text-fuchsia-300',
	title: 'text-cyan-700 dark:text-cyan-300',
	meta: 'text-sky-700 dark:text-sky-300',
	og: 'text-violet-700 dark:text-violet-300',
	heading: 'text-amber-700 dark:text-amber-300',
	body: 'text-emerald-700 dark:text-emerald-300',
};

const SOURCE_SHELL: Record<
	KeywordSourceId,
	{ badge: string; rank: string; missing: string }
> = {
	schema: {
		badge: 'border-fuchsia-200 dark:border-fuchsia-400/35 bg-fuchsia-50 dark:bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-100',
		rank: 'bg-fuchsia-500 text-white',
		missing: 'border-dashed border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 text-gray-400',
	},
	title: {
		badge: 'border-cyan-200 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-100',
		rank: 'bg-cyan-500 text-white',
		missing: 'border-dashed border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 text-gray-400',
	},
	meta: {
		badge: 'border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-100',
		rank: 'bg-sky-500 text-white',
		missing: 'border-dashed border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 text-gray-400',
	},
	og: {
		badge: 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-100',
		rank: 'bg-violet-500 text-white',
		missing: 'border-dashed border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 text-gray-400',
	},
	heading: {
		badge: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100',
		rank: 'bg-amber-500 text-white',
		missing: 'border-dashed border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 text-gray-400',
	},
	body: {
		badge: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-100',
		rank: 'bg-emerald-500 text-white',
		missing: 'border-dashed border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/40 text-gray-400',
	},
};

function findAuditCheck(report: AuditReport, id: string): AuditCheckItem | undefined {
	return (
		report.checklist?.find((item) => item.id === id) ??
		report.categories.flatMap((category) => category.checks).find((item) => item.id === id)
	);
}

function isOgTitlePresent(report: AuditReport): boolean | null {
	const check = findAuditCheck(report, 'og-tags');
	if (!check) return null;
	if (check.passed || check.status === 'pass') return true;
	if (check.evidence?.includes('og:title ✓')) return true;
	if (check.evidence?.includes('missing:') && !/\bog:title\b/.test(check.evidence)) return true;
	return false;
}

/** Live presence of the 6 crawler/AI keyword sources (null = unknown on legacy reports). */
function resolveKeywordSourcePresence(report: AuditReport): Record<KeywordSourceId, boolean | null> {
	const meta = report.siteMeta;
	const metrics = report.metrics;
	return {
		schema: (metrics?.jsonLdBlockCount ?? 0) > 0 || (metrics?.schemaTypes?.length ?? 0) > 0,
		title:
			(metrics?.titleLength ?? 0) > 0 ||
			Boolean(meta?.title?.trim() || metrics?.documentTitle?.trim() || metrics?.pageTitle?.trim()),
		meta:
			Boolean(meta?.metaKeywords?.trim()) ||
			(metrics?.metaDescriptionLength ?? 0) > 0 ||
			Boolean(meta?.metaDescription?.trim() || metrics?.metaDescription?.trim()),
		og: isOgTitlePresent(report),
		heading: (metrics?.h1Count ?? 0) > 0 || (metrics?.h1Texts?.length ?? 0) > 0,
		body:
			(metrics?.bodyTextLength ?? 0) > 50 ||
			(meta?.entityPhrases?.length ?? 0) > 0 ||
			(meta?.needSignals?.length ?? 0) > 0,
	};
}

const CATEGORY_SHELL: Record<
	KeywordCategoryId,
	{ card: string; chip: string; title: string; accent?: boolean }
> = {
	geoPrompt: {
		accent: true,
		card: 'border-fuchsia-200 dark:border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-50 via-indigo-50 to-cyan-50 dark:from-fuchsia-500/15 dark:via-indigo-500/10 dark:to-cyan-500/15 shadow-[0_0_0_1px_rgba(217,70,239,0.18),0_12px_32px_-16px_rgba(34,211,238,0.45)]',
		chip: 'border-fuchsia-200 dark:border-fuchsia-400/35 bg-fuchsia-50 dark:bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-100 hover:border-fuchsia-400 dark:hover:border-fuchsia-300/70 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-500/30 hover:text-fuchsia-950 dark:hover:text-fuchsia-50 hover:shadow-[0_0_0_1px_rgba(217,70,239,0.28)]',
		title: 'text-fuchsia-800 dark:text-fuchsia-100',
	},
	primary: {
		card: 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/25',
		chip: 'border-cyan-200 dark:border-cyan-500/25 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-800 dark:text-cyan-200 hover:border-cyan-400/50 hover:bg-cyan-100 dark:hover:bg-cyan-500/20',
		title: 'text-slate-900 dark:text-slate-100',
	},
	longTail: {
		card: 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/25',
		chip: 'border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100 hover:border-amber-400/45 hover:bg-amber-100 dark:hover:bg-amber-500/20',
		title: 'text-slate-900 dark:text-slate-100',
	},
	lsiLocal: {
		card: 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-black/25',
		chip: 'border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-100 hover:border-emerald-400/45 hover:bg-emerald-100 dark:hover:bg-emerald-500/20',
		title: 'text-slate-900 dark:text-slate-100',
	},
};

function KeywordChip({
	label,
	className,
	copiedHint,
}: {
	label: string;
	className: string;
	copiedHint: string;
}) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(label);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch {
			/* clipboard unavailable */
		}
	}

	return (
		<span
			role="button"
			tabIndex={0}
			onClick={() => void handleCopy()}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					void handleCopy();
				}
			}}
			title={label}
			className={`keyword-chip group relative max-w-full cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold leading-snug transition-colors duration-300 ease-out print:border-slate-300 print:bg-slate-100 print:text-slate-700 ${className}`}
		>
			<span className="keyword-chip-label line-clamp-2 break-words">{label}</span>
			{copied ? (
				<span className="absolute -top-2 right-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow print:hidden">
					{copiedHint}
				</span>
			) : null}
		</span>
	);
}

export function KeywordRecommendationPanel({ report }: KeywordRecommendationPanelProps) {
	const t = useTranslations('audit.keywordRecommend');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const pack = buildKeywordRecommendations(report.siteMeta, lang);
	const byId = Object.fromEntries(pack.categories.map((c) => [c.id, c.keywords])) as Record<
		KeywordCategoryId,
		string[]
	>;
	const detectedKeywords = collectDetectedKeywords(report);
	const sourcePresence = resolveKeywordSourcePresence(report);
	const sourceDetails = resolveKeywordSourceDetails(report);

	const hasAny = CATEGORY_ORDER.some((id) => (byId[id]?.length ?? 0) > 0);
	if (!hasAny && detectedKeywords.length === 0) return null;

	return (
		<section
			id="keyword-pipeline"
			className="keyword-pipeline-section pdf-page-item audit-report-section scroll-mt-24 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('badge')}</p>
				<h2 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{t('title')}</h2>
				<p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{t('subtitle')}</p>
			</div>

			{/* 🔍 현재 감지된 기준 키워드 (As-Is) */}
			<div className="keyword-as-is-box flex flex-col gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40">
				<div className="flex items-start justify-between flex-wrap gap-2">
					<div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
						<span aria-hidden>🔍</span>
						<span>{t('asIsTitle')}</span>
					</div>
					<span className="rounded-md border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
						{t('asIsSourcesHint')}
					</span>
				</div>

				{/* 상단: 추출 소스 파이프라인 뱃지 */}
				<div className="keyword-source-pipeline">
					<p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
						{t('asIsSourcesTitle')}
					</p>
					<ol className="mt-2 flex flex-wrap items-center gap-1.5">
						{SOURCE_ORDER.map((id, index) => {
							const shell = SOURCE_SHELL[id];
							const present = sourcePresence[id];
							const missing = present === false;
							return (
								<li key={id} className="flex items-center gap-1.5">
									<span
										title={`${keywordSourceHint(id, lang)}${
											present === true
												? ` · ${t('asIsSourceDetected')}`
												: present === false
													? ` · ${t('asIsSourceMissing')}`
													: ''
										}`}
										className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 ${
											missing ? shell.missing : shell.badge
										}`}
									>
										<span
											className={`inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[9px] font-extrabold ${
												missing ? 'bg-gray-300 dark:bg-gray-600 text-white' : shell.rank
											}`}
										>
											P{index + 1}
										</span>
										<span className="text-[11px] font-bold leading-none">{sourceCopy(id, 'label')}</span>
										<span className="hidden font-mono text-[9px] font-semibold opacity-70 sm:inline">
											{sourceCopy(id, 'tag')}
										</span>
										{present === true ? (
											<span
												className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
												aria-label={t('asIsSourceDetected')}
											/>
										) : present === false ? (
											<span className="text-[9px] font-semibold opacity-70">{t('asIsSourceMissing')}</span>
										) : null}
									</span>
									{index < SOURCE_ORDER.length - 1 ? (
										<span className="text-[10px] font-bold text-slate-300 dark:text-slate-600" aria-hidden>
											→
										</span>
									) : null}
								</li>
							);
						})}
					</ol>
				</div>

				{/* 하단: 감지된 키워드 칩 */}
				<div className="keyword-chip-wrapper flex flex-wrap gap-2 border-t border-gray-200/80 dark:border-gray-700/70 pt-3">
					{detectedKeywords.length > 0 ? (
						detectedKeywords.map((kw, idx) => (
							<span
								key={`${kw}-${idx}`}
								className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
							>
								#{kw}
							</span>
						))
					) : (
						<span className="text-xs text-gray-400">{t('asIsEmpty')}</span>
					)}
				</div>

				{/* P1~P6 실제 추출 데이터 */}
				<div className="keyword-as-is-source-list flex flex-col gap-3 border-t border-gray-200/80 dark:border-gray-700/70 pt-3">
					{sourceDetails.map((row) => (
						<div key={row.id}>
							<p className={`text-[11px] font-bold ${SOURCE_TITLE_CLASS[row.id]}`}>
								P{row.priority} · {sourceCopy(row.id, 'label')}
								<span className="ml-1.5 font-mono text-[9px] font-semibold opacity-60">
									{sourceCopy(row.id, 'tag')}
								</span>
							</p>
							<div className="keyword-chip-wrapper mt-1.5 flex flex-wrap gap-1.5">
								{row.chips.map((kw, idx) => (
									<span
										key={`${row.id}-${kw}-${idx}`}
										className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
									>
										#{kw}
									</span>
								))}
								{row.text ? (
									<span className="inline-flex max-w-full items-center px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
										{row.text}
									</span>
								) : null}
								{row.chips.length === 0 && !row.text ? (
									<span className="text-xs text-gray-400">{t(`asIsSourceEmpty.${row.id}`)}</span>
								) : null}
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-2">
			<p className="print:hidden rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 w-fit">
				{t('copyHint')}
			</p>

			<div className="keyword-pipeline-grid grid grid-cols-1 gap-3 sm:grid-cols-2 sm:auto-rows-fr sm:gap-4">
				{CATEGORY_ORDER.map((id) => {
					const shell = CATEGORY_SHELL[id];
					const keywords = byId[id] ?? [];
					if (keywords.length === 0) return null;

					return (
						<article
							key={id}
							className={`flex h-full min-w-0 flex-col gap-3 rounded-xl border p-4 ${shell.card}`}
						>
							<div className="flex flex-wrap items-center gap-2">
								{shell.accent ? (
									<span className="rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#0B1030] shadow-[0_0_12px_-2px_rgba(34,211,238,0.7)]">
										{t('geoAiBadge')}
									</span>
								) : null}
								<div>
									<p className={`text-sm font-extrabold ${shell.title}`}>{t(`categories.${id}.title`)}</p>
									<p className="mt-0.5 text-[10px] leading-snug text-slate-500">
										{t(`categories.${id}.desc`)}
									</p>
								</div>
							</div>

							<div className="keyword-chip-wrapper flex flex-wrap gap-1.5">
								{keywords.map((kw) => (
									<KeywordChip
										key={`${id}-${kw}`}
										label={kw}
										className={shell.chip}
										copiedHint={t('copied')}
									/>
								))}
							</div>
						</article>
					);
				})}
			</div>
			</div>
		</section>
	);
}
