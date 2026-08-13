'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
	fallbackSiteMetadata,
	generateUserQuery,
	locationLabel,
	resolveSiteMetadata,
	type SiteMetadata,
} from '@/lib/audit/site-metadata';
import type { GeoNarrativeAiSimulator, GeoNarrativeReport } from '@/lib/audit/geo-narrative';

interface AiSearchResultSimulatorProps {
	meta?: SiteMetadata | null;
	/** Fallback when legacy reports lack siteMeta. */
	domain?: string;
	reportData?: GeoNarrativeReport | null;
}

function SparkleIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
			<path d="M8 1.2l1.1 3.4H12.6L9.8 6.7l1.1 3.4L8 8.2l-2.9 1.9 1.1-3.4L3.4 4.6h3.5L8 1.2z" />
		</svg>
	);
}

function CopyIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
			<rect x="5.5" y="5.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
			<path d="M3.5 10.5V3.5A1 1 0 014.5 2.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
		</svg>
	);
}

function ShareIcon({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
			<circle cx="12" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
			<circle cx="4" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.3" />
			<circle cx="12" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
			<path d="M5.4 7.2l5.2-2.7M5.4 8.8l5.2 2.7" stroke="currentColor" strokeWidth="1.3" />
		</svg>
	);
}

function ChatGptMark({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
			<path d="M22.28 9.81a5.98 5.98 0 00-.52-4.91 6.05 6.05 0 00-6.5-2.9A6.03 6.03 0 0010.05 0a6.05 6.05 0 00-5.72 4.17 6.01 6.01 0 00-4.03 2.91 6.07 6.07 0 00.74 7.11 5.98 5.98 0 00.52 4.91 6.05 6.05 0 006.5 2.9A6.02 6.02 0 0013.95 24a6.05 6.05 0 005.72-4.17 6.01 6.01 0 004.03-2.91 6.07 6.07 0 00-.74-7.11h-.68zM13.95 22.2a4.5 4.5 0 01-2.89-1.04l.14-.08 4.78-2.76a.78.78 0 00.39-.67V11.3l2.02 1.17c.04.02.06.06.06.1v5.58a4.51 4.51 0 01-4.5 4.05zm-9.65-3.65a4.48 4.48 0 01-.54-3.02l.14.08 4.78 2.76c.24.14.54.14.78 0l5.83-3.37v2.33a.78.78 0 01-.31.66l-4.84 2.8a4.51 4.51 0 01-5.84-1.24zm-1.25-10.4l.14-.09 4.78-2.76c.24-.14.53-.14.78 0l5.83 3.37V11.8a.78.78 0 01-.31.66l-4.83 2.79a.78.78 0 01-.78 0L5.8 12.1a.78.78 0 01-.39-.67V8.87a4.5 4.5 0 011.64-.72zm16.1 3.75l-2.02-1.17V8.5a.78.78 0 00-.31-.66l-4.83-2.79-.14.08v5.54l2.02 1.17a.78.78 0 00.78 0l4.84-2.8c.02-.02.04-.04.04-.07a4.47 4.47 0 00-.38-.97zm2.08-3.04l-.14.08-4.78 2.76a.78.78 0 00-.39.67v6.73l-2.02-1.16V9.2a.78.78 0 01.31-.66l4.83-2.8a4.51 4.51 0 012.19 4.98zm-14.6 4.85l-2.02-1.17V7.66c0-.27.14-.52.39-.67l4.83-2.79.14.08v5.54l-2.02 1.17a.78.78 0 01-.78 0l-.54-.32zM9.2 3.84A4.5 4.5 0 0112.1 2.8l-.14.08L7.17 5.64a.78.78 0 00-.39.67v6.73L4.76 11.87V6.3a4.51 4.51 0 014.44-2.46z" />
		</svg>
	);
}

function SourceChip({
	label,
	emphasized,
}: {
	label: string;
	emphasized?: boolean;
}) {
	return (
		<span
			className={
				emphasized
					? 'inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-400/45 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.25)]'
					: 'inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-500'
			}
		>
			<span className="truncate">{label}</span>
		</span>
	);
}

function ChatPanel({
	variant,
	meta,
	userQuery,
	dynamicAnswer,
}: {
	variant: 'before' | 'after';
	meta: SiteMetadata;
	userQuery: string;
	dynamicAnswer?: string;
}) {
	const t = useTranslations('audit.aiSimulator');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const isAfter = variant === 'after';
	const loc = locationLabel(meta, lang);
	const vars = {
		brandName: meta.brandName,
		category: meta.category,
		location: loc,
		domain: meta.domain,
	};

	return (
		<article
			className={
				isAfter
					? 'flex flex-col overflow-hidden rounded-2xl border border-indigo-500/50 bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(99,102,241,0.2)]'
					: 'flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 opacity-80'
			}
		>
			<div
				className={`border-b px-3.5 py-2.5 sm:px-4 ${
					isAfter ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-slate-800 bg-slate-950/50'
				}`}
			>
				<span
					className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold ${
						isAfter
							? 'border border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
							: 'border border-rose-500/30 bg-rose-500/10 text-rose-300/90'
					}`}
				>
					<span aria-hidden>{isAfter ? '🟢' : '🔴'}</span>
					<span className="truncate">{t(isAfter ? 'after.badge' : 'before.badge', vars)}</span>
				</span>
			</div>

			<div className="flex items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0d0f14] px-3.5 py-2.5 sm:px-4">
				<div className="flex min-w-0 items-center gap-2">
					<span
						className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
							isAfter ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
						}`}
					>
						<ChatGptMark className="h-3.5 w-3.5" />
					</span>
					<div className="min-w-0">
						<p className={`truncate text-xs font-semibold ${isAfter ? 'text-slate-100' : 'text-slate-400'}`}>
							{t('modelName')}
						</p>
						<p className="truncate text-[10px] text-slate-600">{t('modelHint')}</p>
					</div>
				</div>
				<span className="shrink-0 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-500">
					{t('engineLabel')}
				</span>
			</div>

			<div className="flex flex-1 flex-col gap-3.5 bg-[#0b0d12] p-3.5 sm:gap-4 sm:p-4">
				<div className="flex justify-end">
					<div
						className={`max-w-[92%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[12px] leading-relaxed sm:text-[13px] ${
							isAfter
								? 'bg-indigo-500/25 text-indigo-50 ring-1 ring-indigo-400/30'
								: 'bg-slate-800 text-slate-300'
						}`}
					>
						{userQuery}
					</div>
				</div>

				<div className="flex gap-2.5">
					<span
						className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
							isAfter
								? 'bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-lg shadow-indigo-500/30'
								: 'bg-slate-800 text-slate-500'
						}`}
					>
						<SparkleIcon className="h-3.5 w-3.5" />
					</span>

					<div className="min-w-0 flex-1">
						<div
							className={`rounded-2xl rounded-tl-md border px-3.5 py-3 sm:px-4 sm:py-3.5 ${
								isAfter
									? 'border-indigo-400/25 bg-indigo-500/[0.08]'
									: 'border-slate-800 bg-slate-900/80'
							}`}
						>
							{dynamicAnswer ? (
								<p
									className={`whitespace-pre-wrap text-[12px] leading-relaxed sm:text-[13px] ${
										isAfter ? 'text-slate-200' : 'text-slate-500'
									}`}
								>
									{dynamicAnswer}
								</p>
							) : isAfter ? (
								<div className="space-y-2.5 text-[12px] leading-relaxed text-slate-200 sm:text-[13px]">
									<p>
										{t.rich('after.answerLead', {
											...vars,
											brand: (chunks) => (
												<strong className="font-extrabold text-emerald-300">{chunks}</strong>
											),
										})}
									</p>
									<ul className="space-y-1.5 border-l-2 border-emerald-500/40 pl-3 text-slate-300">
										<li>{t('after.bullet1', vars)}</li>
										<li>{t('after.bullet2', vars)}</li>
										<li>{t('after.bullet3', vars)}</li>
									</ul>
									<p className="text-slate-400">{t('after.answerClose', vars)}</p>
								</div>
							) : (
								<div className="space-y-2 text-[12px] leading-relaxed text-slate-500 sm:text-[13px]">
									<p>{t('before.answerLead', vars)}</p>
									<ul className="list-disc space-y-1 pl-4 text-slate-600">
										<li>{t('before.bullet1', vars)}</li>
										<li>{t('before.bullet2', vars)}</li>
										<li>{t('before.bullet3', vars)}</li>
									</ul>
									<p className="text-slate-600">{t('before.answerClose', vars)}</p>
								</div>
							)}
						</div>

						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							<button
								type="button"
								tabIndex={-1}
								className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
								aria-hidden
							>
								<CopyIcon className="h-3 w-3" />
								{t('copy')}
							</button>
							<button
								type="button"
								tabIndex={-1}
								className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
								aria-hidden
							>
								<ShareIcon className="h-3 w-3" />
								{t('share')}
							</button>
						</div>

						<div className="mt-2.5">
							<p
								className={`mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
									isAfter ? 'text-indigo-300/80' : 'text-slate-600'
								}`}
							>
								{t('sourcesLabel')}
							</p>
							<div className="flex flex-wrap gap-1.5">
								{isAfter ? (
									<>
										<SourceChip emphasized label={t('after.sourcePrimary', vars)} />
										<SourceChip label={t('after.sourceSecondary')} />
									</>
								) : (
									<>
										<SourceChip label={t('before.source1')} />
										<SourceChip label={t('before.source2')} />
										<span className="inline-flex items-center rounded-full border border-dashed border-slate-700 px-2.5 py-1 text-[10px] text-slate-600">
											{t('before.sourceMissing', vars)}
										</span>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</article>
	);
}

export function AiSearchResultSimulator({ meta, domain, reportData }: AiSearchResultSimulatorProps) {
	const t = useTranslations('audit.aiSimulator');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const resolved = resolveSiteMetadata(
		meta ?? fallbackSiteMetadata(domain ? `https://${domain}` : 'https://example.com', lang),
	);
	const sim: GeoNarrativeAiSimulator | undefined = reportData?.aiSimulator;
	const userQuery = sim?.searchQuery?.trim() || generateUserQuery(resolved, lang);
	const displayBrand = reportData?.brandName?.trim() || resolved.brandName;
	const displayMeta: SiteMetadata = { ...resolved, brandName: displayBrand };

	return (
		<section
			id="sec-ai-simulator"
			className="scroll-mt-24 flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-5 sm:p-6"
			aria-labelledby="ai-simulator-heading"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('badge')}</p>
				<h2 id="ai-simulator-heading" className="mt-1 text-lg font-extrabold leading-snug text-white sm:text-xl">
					{t('title')}
				</h2>
				<p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{t('subtitle')}</p>
				<p className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
					<span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-semibold text-slate-300">
						{displayBrand}
					</span>
					{reportData?.industry ? (
						<span className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
							{reportData.industry}
						</span>
					) : (
						<span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5">
							{resolved.primaryKeyword || resolved.category}
						</span>
					)}
					{resolved.broadLocation ? (
						<span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-300/90">
							{resolved.broadLocation} 전체
						</span>
					) : resolved.location ? (
						<span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5">{resolved.location}</span>
					) : null}
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
				<ChatPanel
					variant="before"
					meta={displayMeta}
					userQuery={userQuery}
					dynamicAnswer={sim?.beforeAnswer}
				/>
				<ChatPanel
					variant="after"
					meta={displayMeta}
					userQuery={userQuery}
					dynamicAnswer={sim?.afterAnswer}
				/>
			</div>
		</section>
	);
}
