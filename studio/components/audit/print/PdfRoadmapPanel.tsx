'use client';

import { useTranslations } from 'next-intl';
import { PdfStageHeading } from '@/components/audit/print/pdf-print-shared';
import { buildPrioritizedActions, type PrioritizedActionItem } from '@/lib/audit/action-priority';
import { normalizeChecklistItems } from '@/lib/audit/onpage-diagnostic';
import { buildJsonLdFixSnippets } from '@/lib/audit/jsonld-snippets';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';

interface PdfRoadmapPanelProps {
	report: AuditReport;
	lang: AuditLang;
}

type RoadmapTier = 'critical' | 'warning' | 'optimal';

const TIER_STYLE: Record<RoadmapTier, { badge: string; panel: string }> = {
	critical: { badge: 'bg-rose-600 text-white', panel: 'border-rose-200 bg-rose-50/60' },
	warning: { badge: 'bg-amber-500 text-white', panel: 'border-amber-200 bg-amber-50/60' },
	optimal: { badge: 'bg-emerald-600 text-white', panel: 'border-emerald-200 bg-emerald-50/60' },
};

function tierOf(priority: PrioritizedActionItem['priority']): RoadmapTier {
	if (priority === 'P0' || priority === 'P1') return 'critical';
	if (priority === 'P2' || priority === 'P3') return 'warning';
	return 'optimal';
}

/**
 * Stage 6 — full priority-tiered improvement roadmap (every P0–P5 item, no
 * truncation) plus the ready-to-paste JSON-LD fix snippets
 * (`buildJsonLdFixSnippets` — the same generator behind
 * `JsonLdFixSnippetsPanel`) so the printed report carries actionable code,
 * not just a bullet list.
 */
export function PdfRoadmapPanel({ report, lang }: PdfRoadmapPanelProps) {
	const t = useTranslations('audit.pdfReport.roadmap');
	const checklist = normalizeChecklistItems(report);
	const actions = buildPrioritizedActions(checklist);
	const snippets = buildJsonLdFixSnippets(report, lang);

	const tiers: RoadmapTier[] = ['critical', 'warning', 'optimal'];
	const grouped: Record<RoadmapTier, PrioritizedActionItem[]> = { critical: [], warning: [], optimal: [] };
	for (const action of actions) {
		grouped[tierOf(action.priority)].push(action);
	}

	const hasAny = actions.length > 0;

	return (
		<section
			id="sec-pdf-roadmap"
			className="pdf-print-only pdf-page-item audit-report-section rounded-2xl border border-slate-200 bg-white"
		>
			<PdfStageHeading step={6} eyebrow={t('eyebrow')} title={t('title')} hint={t('hint')} />
			<div className="flex flex-col gap-3 p-5 sm:p-6">
				{!hasAny ? (
					<p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
						{t('allClear')}
					</p>
				) : (
					tiers.map((tier) => {
						const items = grouped[tier];
						if (items.length === 0) return null;
						const style = TIER_STYLE[tier];
						return (
							<article
								key={tier}
								className={`pdf-table-row rounded-xl border px-4 py-3.5 ${style.panel}`}
							>
								<div className="flex items-center gap-2">
									<span className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${style.badge}`}>
										{t(`tier.${tier}`)}
									</span>
									<span className="text-[11px] font-bold text-slate-600">{t('countLabel', { count: items.length })}</span>
								</div>
								<ul className="mt-2.5 flex flex-col gap-1.5">
									{items.map((item) => (
										<li key={item.id} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-slate-800">
											<span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
											<span>
												<span className="font-bold text-slate-900">
													[{item.priority}] {item.label}
												</span>
												{item.evidence ? <span className="text-slate-500"> — {item.evidence}</span> : null}
											</span>
										</li>
									))}
								</ul>
							</article>
						);
					})
				)}
			</div>

			<div className="border-t border-slate-200 px-5 py-4 sm:px-6">
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('codeGuideTitle')}</p>
				<p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">{t('codeGuideHint')}</p>
				{snippets.length === 0 ? (
					<p className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11.5px] font-semibold text-emerald-800">
						{t('codeGuideEmpty')}
					</p>
				) : (
					<div className="mt-2.5 flex flex-col gap-3">
						{snippets.map((snippet) => (
							<div key={snippet.id} className="pdf-table-row rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
								<p className="text-[11.5px] font-bold text-slate-900">{snippet.title}</p>
								<p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">{snippet.description}</p>
								<pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[9.5px] leading-relaxed text-slate-700">
									{snippet.code}
								</pre>
							</div>
						))}
						<p className="text-[10px] leading-relaxed text-slate-400">{t('snippetPasteHint')}</p>
					</div>
				)}
			</div>
		</section>
	);
}
