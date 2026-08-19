'use client';

import { Crown, GitMerge, MessageSquareQuote } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PrescriptionAppliedBadge } from '@/components/geo/PrescriptionAppliedBadge';
import type { RecommendationReason, RecommendationReasonId } from '@/types/geo-prescription';

export interface GEOPromptReasonCardProps {
	reasons: readonly RecommendationReason[];
}

const AXIS_ICON: Record<RecommendationReasonId, typeof GitMerge> = {
	entity_specificity: GitMerge,
	rag_citation: MessageSquareQuote,
	longtail_intent: Crown,
};

const AXIS_TONE: Record<
	RecommendationReasonId,
	{ wrap: string; icon: string; index: string; kicker: string }
> = {
	entity_specificity: {
		wrap: 'border-indigo-200/80 dark:border-indigo-400/25 bg-indigo-50/70 dark:bg-indigo-500/[0.08]',
		icon: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
		index: 'bg-indigo-600 text-white',
		kicker: 'text-indigo-800 dark:text-indigo-300',
	},
	rag_citation: {
		wrap: 'border-cyan-200/80 dark:border-cyan-400/25 bg-cyan-50/70 dark:bg-cyan-500/[0.08]',
		icon: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
		index: 'bg-cyan-600 text-white',
		kicker: 'text-cyan-800 dark:text-cyan-300',
	},
	longtail_intent: {
		wrap: 'border-amber-200/80 dark:border-amber-400/25 bg-amber-50/70 dark:bg-amber-500/[0.08]',
		icon: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
		index: 'bg-amber-600 text-white',
		kicker: 'text-amber-800 dark:text-amber-300',
	},
};

export function GEOPromptReasonCard({ reasons }: GEOPromptReasonCardProps) {
	const t = useTranslations('audit.geoPromptReason');
	if (!reasons.length) return null;

	return (
		<div className="rounded-2xl border border-violet-200/80 dark:border-violet-400/25 bg-gradient-to-br from-violet-50 via-white to-cyan-50 dark:from-violet-500/[0.10] dark:via-[#0B1028] dark:to-cyan-500/[0.08] p-5 sm:p-6">
			<div className="flex items-start gap-3">
				<span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-300">
					<GitMerge className="h-5 w-5" aria-hidden />
				</span>
				<div className="min-w-0">
					<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('kicker')}</p>
					<div className="mt-1 flex flex-wrap items-center gap-2">
						<h3 className="text-lg font-extrabold text-slate-900 dark:text-white sm:text-xl">{t('title')}</h3>
						<PrescriptionAppliedBadge />
					</div>
					<p className="mt-0.5 text-xs leading-relaxed text-slate-400">{t('subtitle')}</p>
				</div>
			</div>

			<ol className="mt-4 flex flex-col gap-3">
				{reasons.map((reason) => {
					const Icon = AXIS_ICON[reason.id] || GitMerge;
					const tone = AXIS_TONE[reason.id] || AXIS_TONE.entity_specificity;
					return (
						<li
							key={reason.id}
							className={`rounded-xl border px-3.5 py-3 ${tone.wrap}`}
						>
							<div className="flex items-start gap-3">
								<span
									className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}
									aria-hidden
								>
									<Icon className="h-4 w-4" />
								</span>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span
											className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${tone.index}`}
										>
											{reason.index}
										</span>
										<p className={`break-keep text-[11px] font-extrabold tracking-wide ${tone.kicker}`}>
											{reason.title}
										</p>
										<span className="break-keep text-[10px] font-semibold text-slate-400">{reason.subtitle}</span>
									</div>
									{reason.example ? (
										<p className="mt-2">
											<span className="inline-flex max-w-full items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-extrabold text-slate-800 ring-1 ring-slate-200/80 dark:bg-white/[0.08] dark:text-slate-100 dark:ring-white/15">
												<span className="truncate">“{reason.example}”</span>
											</span>
										</p>
									) : null}
									<p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
										{reason.mechanism}
									</p>
									{reason.schemaHints.length ? (
										<ul className="mt-2 flex flex-wrap gap-1">
											{reason.schemaHints.map((hint) => (
												<li key={hint}>
													<span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10">
														{hint}
													</span>
												</li>
											))}
											{reason.contrastQuery ? (
												<li>
													<span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/30">
														vs “{reason.contrastQuery}”
													</span>
												</li>
											) : null}
										</ul>
									) : null}
								</div>
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
