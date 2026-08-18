'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
	buildCoreChecklistSummaryText,
	buildCoreSeoGeoChecklist,
	getCoreItemsNeedingWork,
} from '@/lib/audit/core-checklist';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { schemaMappingFromReport } from '@/lib/audit/live-criteria';
import { detectSchemaVertical, geoAlgorithmStepBadge } from '@/lib/audit/recommended-schemas';
import type { AuditReport } from '@/lib/site-auditor';

interface GeoCitationAlgorithmSectionProps {
	domain: string;
	reportData?: GeoNarrativeReport | null;
	/** Live audit — drives Before callout from 6-core 🔴/🟢 status. */
	auditReport?: AuditReport | null;
}

const STEPS = [
	{
		key: 'step1' as const,
		step: 1,
		ring: 'border-cyan-200 dark:border-cyan-500/35 bg-cyan-50 dark:bg-cyan-500/[0.07]',
		badge: 'border-cyan-200 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300',
		dot: 'bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.45)]',
		num: 'bg-cyan-500 text-slate-950',
	},
	{
		key: 'step2' as const,
		step: 2,
		ring: 'border-emerald-200 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/[0.07]',
		badge: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
		dot: 'bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.45)]',
		num: 'bg-emerald-500 text-slate-950',
	},
	{
		key: 'step3' as const,
		step: 3,
		ring: 'border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/[0.07]',
		badge: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
		dot: 'bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.45)]',
		num: 'bg-amber-500 text-slate-950',
	},
] as const;

export function GeoCitationAlgorithmSection({
	domain,
	reportData,
	auditReport = null,
}: GeoCitationAlgorithmSectionProps) {
	const t = useTranslations('audit.geoAlgorithm');
	const locale = useLocale();
	const lang = locale === 'en' ? 'en' : 'ko';
	const schemas = reportData?.recommendedSchemas?.filter(Boolean) ?? [];
	const coreItems = buildCoreSeoGeoChecklist(auditReport);
	const needingWork = getCoreItemsNeedingWork(coreItems);
	const allHealthy = needingWork.length === 0;
	const liveSummary = auditReport
		? buildCoreChecklistSummaryText({
				items: coreItems,
				brandName: reportData?.brandName?.trim() || domain,
				industry: reportData?.industry,
				lang,
				vertical: detectSchemaVertical(schemaMappingFromReport(auditReport)),
			})
		: null;

	return (
		<section
			id="sec-geo-algorithm"
			className="scroll-mt-24 flex flex-col gap-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-gradient-to-b from-white to-slate-50 dark:from-white/[0.04] dark:to-transparent p-5 sm:p-6"
			aria-labelledby="geo-algorithm-heading"
		>
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('badge')}</p>
				<h2 id="geo-algorithm-heading" className="mt-1 text-lg font-extrabold leading-snug text-slate-900 dark:text-white sm:text-xl">
					{t('title')}
				</h2>
				<p className="max-w-3xl text-xs text-slate-400 mt-0.5 leading-relaxed">{t('subtitle')}</p>
				{reportData?.industry ? (
					<p className="mt-2 text-[12px] text-slate-600 dark:text-slate-400">
						<span className="font-semibold text-slate-800 dark:text-slate-200">{reportData.industry}</span>
						{schemas.length > 0 ? <span className="text-slate-500"> · {schemas.join(' / ')}</span> : null}
					</p>
				) : null}
			</div>

			<div className="relative">
				<div
					className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-[1.35rem] hidden h-px bg-gradient-to-r from-cyan-500/50 via-emerald-500/50 to-amber-500/50 lg:block"
					aria-hidden
				/>

				<ol className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
					{STEPS.map((step, index) => {
						const schemaBadge = geoAlgorithmStepBadge(step.step, schemas);
						return (
							<li key={step.key} className="relative flex flex-col">
								{index < STEPS.length - 1 ? (
									<div
										className="pointer-events-none absolute left-[1.15rem] top-10 bottom-[-1rem] w-px bg-gradient-to-b from-white/20 to-white/5 lg:hidden"
										aria-hidden
									/>
								) : null}

								<div className="relative z-[1] mb-3 flex items-center gap-3 lg:justify-center">
									<span
										className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ring-4 ring-white dark:ring-slate-950 ${step.num}`}
									>
										{step.step}
									</span>
									<span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 lg:hidden">
										{t(`${step.key}.stepLabel`)}
									</span>
									<span className={`hidden h-2 w-2 rounded-full lg:block ${step.dot}`} aria-hidden />
								</div>

								<article className={`flex h-full flex-col gap-3 rounded-2xl border p-4 sm:p-5 ${step.ring}`}>
									<span
										className={`w-fit rounded-md border px-2 py-1 font-mono text-[10px] font-semibold tracking-tight sm:text-[11px] ${step.badge}`}
									>
										{schemaBadge || t(`${step.key}.badge`)}
									</span>
									<div>
										<p className="mb-1 hidden text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 lg:block">
											{t(`${step.key}.stepLabel`)}
										</p>
										<h3 className="text-base font-extrabold leading-snug text-slate-900 dark:text-white">
											{t(`${step.key}.heading`)}
										</h3>
										<p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
											{t(`${step.key}.description`)}
										</p>
									</div>
								</article>
							</li>
						);
					})}
				</ol>
			</div>

			<aside
				className={`flex gap-3 rounded-xl px-4 py-3.5 sm:px-5 ${
					liveSummary && allHealthy
						? 'border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/[0.08]'
						: 'border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/[0.08]'
				}`}
				role="status"
			>
				<span
					className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-extrabold ${
						liveSummary && allHealthy
							? 'border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
							: 'border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
					}`}
					aria-hidden
				>
					{liveSummary && allHealthy ? '✓' : '!'}
				</span>
				<p
					className={`text-[13px] leading-relaxed ${
						liveSummary && allHealthy ? 'text-emerald-800 dark:text-emerald-100/90' : 'text-rose-800 dark:text-rose-100/90'
					}`}
				>
					{liveSummary ? (
						<>
							<span
								className={`font-mono font-bold ${
									allHealthy ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-800 dark:text-rose-200'
								}`}
							>
								{domain}
							</span>
							{' — '}
							{liveSummary}
						</>
					) : reportData?.beforeImpact ? (
						<>
							<span className="font-mono font-bold text-rose-800 dark:text-rose-200">{domain}</span>
							{' — '}
							{reportData.beforeImpact}
						</>
					) : (
						t.rich('callout', {
							domain: (children) => (
								<span className="font-mono font-bold text-rose-800 dark:text-rose-200">
									{children}
								</span>
							),
						})
					)}
				</p>
			</aside>
		</section>
	);
}
