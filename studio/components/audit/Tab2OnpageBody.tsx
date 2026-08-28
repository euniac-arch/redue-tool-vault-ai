'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuditFindingsList } from '@/components/AuditFindingsList';
import { AuditTechnicalEvidence } from '@/components/AuditTechnicalEvidence';
import { AuditSectionAccordion } from '@/components/audit/AuditSectionAccordion';
import { DetailedChecklist } from '@/components/audit/DetailedChecklist';
import { RagFactDensityCard } from '@/components/audit/Tab2TechnicalSection';
import { Tab2BelowFold } from '@/components/audit/Tab2BelowFold';
import { computeAdvancedGeoFromReport } from '@/lib/audit/advancedGeoFromReport';
import { MOUNT_AUDIT_RESULT_TABS_EVENT, OPEN_DETAILED_CHECKLIST_EVENT } from '@/lib/audit/scroll-to-category';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';

export interface Tab2OnpageBodyProps {
	report: AuditReport;
	geoNarrative: GeoNarrativeReport | null;
	geoNarrativeLoading: boolean;
	rawTechnicalScore: number;
	maxRawScore: number;
	publicView?: boolean;
}

export function Tab2OnpageBody({
	report,
	geoNarrative,
	geoNarrativeLoading,
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
	const geoMetrics = useMemo(() => computeAdvancedGeoFromReport(report), [report]);

	const toggleChecklist = useCallback(() => {
		setIsChecklistOpen((open) => !open);
	}, []);
	const togglePriority = useCallback(() => {
		setIsPriorityOpen((open) => !open);
	}, []);

	useEffect(() => {
		const onOpenChecklist = () => setIsChecklistOpen(true);
		const expandForPrint = () => {
			setIsChecklistOpen(true);
			setIsPriorityOpen(true);
		};
		window.addEventListener(OPEN_DETAILED_CHECKLIST_EVENT, onOpenChecklist);
		window.addEventListener('beforeprint', expandForPrint);
		window.addEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, expandForPrint);
		return () => {
			window.removeEventListener(OPEN_DETAILED_CHECKLIST_EVENT, onOpenChecklist);
			window.removeEventListener('beforeprint', expandForPrint);
			window.removeEventListener(MOUNT_AUDIT_RESULT_TABS_EVENT, expandForPrint);
		};
	}, []);

	return (
		<>
			<AuditTechnicalEvidence report={report} />

			<RagFactDensityCard
				rag={geoMetrics.ragChunking}
				fact={geoMetrics.factDensity}
				industryConfig={geoMetrics.industry}
			/>

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
				className="scroll-mt-24 flex flex-col"
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
