'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuditSectionAccordion } from '@/components/audit/AuditSectionAccordion';
import {
	PRIORITY_BADGE_STYLES,
	PRIORITY_COUNT_BADGE_STYLES,
	buildPrioritizedActions,
	type ActionPriority,
} from '@/lib/audit/action-priority';
import { isNewsMediaVertical } from '@/lib/audit/recommended-schemas';
import { schemaMappingFromReport } from '@/lib/audit/live-criteria';
import type { AuditReport } from '@/lib/site-auditor';

const PRIORITY_LEVELS = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'] as const satisfies readonly ActionPriority[];

interface AuditActionPlanProps {
	report: AuditReport;
}

export function AuditActionPlan({ report }: AuditActionPlanProps) {
	const t = useTranslations('audit.b2b');
	const toggleT = useTranslations('audit.sectionToggle');
	const [isActionableOpen, setIsActionableOpen] = useState(true);
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const newsVertical = isNewsMediaVertical(schemaMappingFromReport(report));
	const rows = useMemo(
		() => buildPrioritizedActions(checks, { newsVertical }),
		[checks, newsVertical],
	);

	const counts = useMemo(() => {
		const base: Record<ActionPriority, number> = { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
		for (const row of rows) base[row.priority] += 1;
		return base;
	}, [rows]);

	function effectText(effectKey: string, fallback?: string): string {
		const known = [
			'generic',
			'title',
			'metaDescription',
			'singleH1',
			'jsonld',
			'canonical',
			'organization',
			'websiteSchema',
			'faqHowto',
			'article',
			'pageSchema',
			'newsArticle',
			'aiBots',
			'person',
			'eeat',
			'imageAlt',
			'htmlLang',
			'headingStructure',
			'headingSkip',
			'ogTags',
			'responseTime',
			'pageWeight',
			'renderBlocking',
			'crawlableText',
			'https',
		] as const;
		if ((known as readonly string[]).includes(effectKey)) {
			return t(`effects.${effectKey as (typeof known)[number]}`);
		}
		return fallback || t('effects.generic');
	}

	return (
		<AuditSectionAccordion
			id="sec-actionable"
			panelId="sec-actionable-panel"
			isOpen={isActionableOpen}
			onToggle={() => setIsActionableOpen((open) => !open)}
			collapseLabel={toggleT('collapse')}
			expandLabel={toggleT('expand')}
			className="pdf-page-item audit-report-section scroll-mt-24 flex flex-col rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
			header={
				<div className="space-y-2">
					<div>
						<span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('actionBadge')}</span>
						<span className="mt-1 block text-lg font-extrabold text-slate-900 dark:text-white">{t('actionTitle')}</span>
						<span className="mt-1 block text-xs text-slate-500">{t('actionSubtitle')}</span>
					</div>
					{rows.length > 0 && (
						<div className="flex items-center flex-wrap gap-1.5 pt-1">
							{PRIORITY_LEVELS.map((level) => (
								<span
									key={level}
									className={`box-border inline-flex h-6 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold leading-none transition-colors ${PRIORITY_COUNT_BADGE_STYLES[level]} ${
										counts[level] === 0 ? 'opacity-35' : ''
									}`}
								>
									<span>{level}</span>
									<span className="font-extrabold tabular-nums">{counts[level]}</span>
								</span>
							))}
						</div>
					)}
				</div>
			}
		>
			<div className="flex flex-col gap-4">
				{rows.length === 0 ? (
					<div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-5 text-sm text-emerald-700 dark:text-emerald-300">
						{t('actionEmpty')}
					</div>
				) : (
					<div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/[0.08]">
						<table className="w-full min-w-[720px] text-left text-sm">
							<thead>
								<tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#0B1C2C]/80 text-[11px] uppercase tracking-wide text-slate-500">
									<th className="px-3 py-3 font-semibold">{t('colPriority')}</th>
									<th className="px-3 py-3 font-semibold">{t('colIssue')}</th>
									<th className="px-3 py-3 font-semibold">{t('colDifficulty')}</th>
									<th className="px-3 py-3 font-semibold">{t('colEffect')}</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => (
									<tr
										key={row.id}
										className={`border-b border-slate-100 dark:border-white/[0.05] align-top last:border-0 ${
											row.geoHighlight ? 'bg-indigo-50 dark:bg-indigo-500/[0.07]' : ''
										}`}
									>
										<td className="px-3 py-3">
											<div className="flex flex-col items-start gap-1.5">
												<span
													className={`rounded-md px-2 py-1 text-[10px] font-extrabold leading-tight ${PRIORITY_BADGE_STYLES[row.priority]}`}
												>
													{row.priority}
													<span className="mt-0.5 block font-bold opacity-90">{t(`priorityLabel.${row.labelKey}`)}</span>
												</span>
												{row.geoHighlight && (
													<span className="rounded-md border border-violet-200 dark:border-violet-400/40 bg-violet-50 dark:bg-violet-500/20 px-2 py-0.5 text-[10px] font-extrabold text-violet-800 dark:text-violet-200">
														{t('geoMustBadge')}
													</span>
												)}
											</div>
										</td>
										<td className="px-3 py-3">
											<p className="font-semibold text-slate-900 dark:text-slate-100">{row.label}</p>
											{row.evidence && (
												<pre className="mt-1.5 max-w-md overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-100 dark:bg-black/35 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-cyan-800 dark:text-cyan-200/80">
													{row.evidence}
												</pre>
											)}
										</td>
										<td className="whitespace-nowrap px-3 py-3 text-xs text-slate-700 dark:text-slate-300">
											{t(`difficulty.${row.difficulty}`)}
										</td>
										<td className="px-3 py-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
											{effectText(row.effectKey, row.impact || row.why)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</AuditSectionAccordion>
	);
}
