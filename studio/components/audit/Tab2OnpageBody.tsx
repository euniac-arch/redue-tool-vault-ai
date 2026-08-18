'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuditFindingsList } from '@/components/AuditFindingsList';
import { AuditTechnicalEvidence } from '@/components/AuditTechnicalEvidence';
import { AuditSectionAccordion } from '@/components/audit/AuditSectionAccordion';
import { DetailedChecklist } from '@/components/audit/DetailedChecklist';
import { PageSpeedReport, type PageSpeedStrategy } from '@/components/audit/PageSpeedReport';
import { Tab2BelowFold } from '@/components/audit/Tab2BelowFold';
import { OPEN_DETAILED_CHECKLIST_EVENT } from '@/lib/audit/scroll-to-category';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';

export interface Tab2OnpageBodyProps {
	report: AuditReport;
	geoNarrative: GeoNarrativeReport | null;
	geoNarrativeLoading: boolean;
	pageSpeed: PageSpeedSnapshot | null;
	pageSpeedDesktop?: PageSpeedSnapshot | null;
	pageSpeedMobile?: PageSpeedSnapshot | null;
	pageSpeedLoading: boolean;
	pageSpeedError: string | null;
	psiStrategy: PageSpeedStrategy;
	onPsiStrategyChange: (strategy: PageSpeedStrategy) => void;
	rawTechnicalScore: number;
	maxRawScore: number;
	publicView?: boolean;
}

export function Tab2OnpageBody({
	report,
	geoNarrative,
	geoNarrativeLoading,
	pageSpeed,
	pageSpeedDesktop,
	pageSpeedMobile,
	pageSpeedLoading,
	pageSpeedError,
	psiStrategy,
	onPsiStrategyChange,
	rawTechnicalScore,
	maxRawScore,
	publicView = false,
}: Tab2OnpageBodyProps) {
	const t = useTranslations('audit');
	const [isChecklistOpen, setIsChecklistOpen] = useState(publicView);
	const [isPriorityOpen, setIsPriorityOpen] = useState(publicView);
	const checklist = useMemo<AuditCheckItem[]>(
		() =>
			report.checklist?.length ? report.checklist : (report.categories ?? []).flatMap((c) => c.checks),
		[report.checklist, report.categories],
	);
	const schemaTypes = report.metrics?.schemaTypes;

	const toggleChecklist = useCallback(() => {
		setIsChecklistOpen((open) => !open);
	}, []);
	const togglePriority = useCallback(() => {
		setIsPriorityOpen((open) => !open);
	}, []);

	useEffect(() => {
		const onOpenChecklist = () => setIsChecklistOpen(true);
		window.addEventListener(OPEN_DETAILED_CHECKLIST_EVENT, onOpenChecklist);
		return () => window.removeEventListener(OPEN_DETAILED_CHECKLIST_EVENT, onOpenChecklist);
	}, []);

	return (
		<>
			<div className="flex flex-col gap-4">
				<PageSpeedReport
					snapshot={pageSpeed}
					desktopData={pageSpeedDesktop}
					mobileData={pageSpeedMobile}
					loading={pageSpeedLoading}
					error={pageSpeedError}
					strategy={psiStrategy}
					onStrategyChange={onPsiStrategyChange}
					targetUrl={report.url}
				/>
			</div>

			{schemaTypes?.length ? (
				<div className="pdf-page-item flex flex-wrap gap-1.5">
					<span className="mr-1 self-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
						{t('detectedSchemas')}
					</span>
					{schemaTypes.map((type) => (
						<span
							key={type}
							className="rounded-md border border-cyan-200 dark:border-cyan-500/20 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-800 dark:text-cyan-300 print:border-slate-300 print:bg-slate-100 print:text-slate-700"
						>
							{type}
						</span>
					))}
				</div>
			) : null}

			<AuditTechnicalEvidence report={report} />

			<Tab2BelowFold
				report={report}
				geoNarrative={geoNarrative}
				geoNarrativeLoading={geoNarrativeLoading}
				force={publicView}
			/>

			<AuditSectionAccordion
				id="detailed-checklist-23"
				panelId="detailed-checklist-23-panel"
				isOpen={isChecklistOpen}
				onToggle={toggleChecklist}
				keepMounted={publicView}
				collapseLabel={t('sectionToggle.collapse')}
				expandLabel={t('sectionToggle.expand')}
				className="scroll-mt-24 flex flex-col print:hidden pdf-screen-only"
				header={
					<>
						<span className="block text-sm font-bold text-slate-800 dark:text-slate-200">
							{t('checklistTitle')}
						</span>
						<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('checklistSubtitle')}</p>
					</>
				}
			>
				<DetailedChecklist
					report={report}
					checks={checklist}
					rawTechnicalScore={rawTechnicalScore}
					maxRawScore={maxRawScore}
				/>
			</AuditSectionAccordion>

			<AuditSectionAccordion
				id="sec-priority-findings"
				panelId="sec-priority-findings-panel"
				isOpen={isPriorityOpen}
				onToggle={togglePriority}
				keepMounted={publicView}
				collapseLabel={t('sectionToggle.collapse')}
				expandLabel={t('sectionToggle.expand')}
				className="pdf-page-item flex flex-col"
				header={
					<>
						<span className="block text-sm font-bold text-slate-800 dark:text-slate-200 print:text-[#0B1C2C]">
							{t('findingsTitle')}
						</span>
						<p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t('findingsSubtitle')}</p>
					</>
				}
			>
				<AuditFindingsList findings={report.findings} />
			</AuditSectionAccordion>
		</>
	);
}
