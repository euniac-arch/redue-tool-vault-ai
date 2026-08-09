'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
	PRIORITY_BADGE_STYLES,
	buildPrioritizedActions,
	type ActionPriority,
} from '@/lib/audit/action-priority';
import type { AuditReport } from '@/lib/site-auditor';

interface AuditActionPlanProps {
	report: AuditReport;
}

export function AuditActionPlan({ report }: AuditActionPlanProps) {
	const t = useTranslations('audit.b2b');
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const rows = useMemo(() => buildPrioritizedActions(checks), [checks]);

	const counts = useMemo(() => {
		const base: Record<ActionPriority, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
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
		] as const;
		if ((known as readonly string[]).includes(effectKey)) {
			return t(`effects.${effectKey as (typeof known)[number]}`);
		}
		return fallback || t('effects.generic');
	}

	return (
		<section className="audit-report-section flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">{t('actionBadge')}</p>
				<h2 className="mt-1 text-lg font-extrabold text-white">{t('actionTitle')}</h2>
				<p className="mt-1 text-xs text-slate-500">{t('actionSubtitle')}</p>
			</div>

			{rows.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{(['P1', 'P2', 'P3', 'P4', 'P5'] as ActionPriority[]).map((level) => (
						<span
							key={level}
							className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ${PRIORITY_BADGE_STYLES[level]} ${
								counts[level] === 0 ? 'opacity-35' : ''
							}`}
						>
							{level}
							<span className="rounded bg-black/25 px-1.5 py-0.5 tabular-nums">{counts[level]}</span>
						</span>
					))}
				</div>
			)}

			{rows.length === 0 ? (
				<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-5 text-sm text-emerald-300">
					{t('actionEmpty')}
				</div>
			) : (
				<div className="overflow-x-auto rounded-xl border border-white/[0.08]">
					<table className="w-full min-w-[720px] text-left text-sm">
						<thead>
							<tr className="border-b border-white/[0.08] bg-[#0B1C2C]/80 text-[11px] uppercase tracking-wide text-slate-500">
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
									className={`border-b border-white/[0.05] align-top last:border-0 ${
										row.geoHighlight ? 'bg-indigo-500/[0.07]' : ''
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
												<span className="rounded-md border border-violet-400/40 bg-violet-500/20 px-2 py-0.5 text-[10px] font-extrabold text-violet-200">
													{t('geoMustBadge')}
												</span>
											)}
										</div>
									</td>
									<td className="px-3 py-3">
										<p className="font-semibold text-slate-100">{row.label}</p>
										{row.evidence && (
											<pre className="mt-1.5 max-w-md overflow-x-auto whitespace-pre-wrap rounded-lg bg-black/35 px-2.5 py-1.5 font-mono text-[10px] leading-relaxed text-cyan-200/80">
												{row.evidence}
											</pre>
										)}
									</td>
									<td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">
										{t(`difficulty.${row.difficulty}`)}
									</td>
									<td className="px-3 py-3 text-xs leading-relaxed text-slate-300">
										{effectText(row.effectKey, row.impact || row.why)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}
