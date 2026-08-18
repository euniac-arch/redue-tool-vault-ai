'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
	AiTriggerSimulationSection,
	type TriggerSimMode,
} from '@/components/geo/AiTriggerSimulationSection';
import { AIEngineTestCard } from '@/components/geo/AIEngineTestCard';
import { useOptionalSiteReach } from '@/components/geo/SiteReachContext';
import { asSelectedReachLevel, projectEngineForQueryLevel } from '@/lib/geo/site-reach-state';
import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';
import {
	isProxyIndexEngine,
	liveGroundingOrderIndex,
	type AIEngineId,
	type AIEngineTestResult,
	type GeoDiagnosticReport,
	type KeywordDepthLevel,
} from '@/types/geo-diagnostic';
import type { EngineQueryLevelView, ReachSlice } from '@/types/site-reach';

interface AIEngineCardListProps {
	report: GeoDiagnosticReport;
	/** Subset to render. Defaults to every engine on the report. */
	engines?: AIEngineTestResult[];
	emptyLabel?: string;
	emphasis?: 'current' | 'post';
	/** Registry snapshot used when the parent already resolved industry copy. */
	industryConfig?: IndustryConfig | null;
}

/** Keep every engine card collapsed until the user opens one. */
function defaultOpenIds(): Set<AIEngineId> {
	return new Set();
}

export function AIEngineCardList({
	report,
	engines,
	emptyLabel,
	emphasis = 'current',
	industryConfig: _industryConfig,
}: AIEngineCardListProps) {
	const t = useTranslations('audit.aiEngines');
	const reach = useOptionalSiteReach();
	const list = engines ?? report.engines;
	const liveEngines = list
		.filter((engine) => !isProxyIndexEngine(engine.engine.id))
		.sort((a, b) => liveGroundingOrderIndex(a.engine.id) - liveGroundingOrderIndex(b.engine.id));
	const proxyEngines = list.filter((engine) => isProxyIndexEngine(engine.engine.id));
	const [openIds, setOpenIds] = useState<Set<AIEngineId>>(() => defaultOpenIds());
	const [localSimMode, setLocalSimMode] = useState<TriggerSimMode>(emphasis === 'post' ? 'toBe' : 'asIs');
	const [selectedLevel, setSelectedLevel] = useState<KeywordDepthLevel>(emphasis === 'post' ? 2 : 1);
	const [resultLevel, setResultLevel] = useState<KeywordDepthLevel>(emphasis === 'post' ? 2 : 1);

	const simMode: TriggerSimMode = reach?.activeMode ?? localSimMode;
	const activeSlice = reach?.activeSlice;
	const triggerQueries = activeSlice?.triggerQueries ?? report.triggerQueries;
	const isPrescriptionApplied = reach?.state.isPrescriptionApplied ?? emphasis === 'post';
	const projectedLevel = asSelectedReachLevel(selectedLevel);

	const engineSignature = report.engines.map((engine) => `${engine.engine.id}:${engine.depthLevel ?? 'x'}`).join('|');
	const listIds = list.map((engine) => engine.engine.id).join('|');
	const siteKey = `${report.targetUrl}|${report.brandName}`;

	useEffect(() => {
		setOpenIds(defaultOpenIds());
	}, [report.caseLabel, report.targetUrl, engineSignature, listIds, list]);

	const prevEmphasisRef = useRef(emphasis);
	useEffect(() => {
		const nextMode: TriggerSimMode = reach?.activeMode ?? (emphasis === 'post' ? 'toBe' : 'asIs');
		setLocalSimMode(nextMode);
	}, [emphasis, reach?.activeMode]);

	const emphasisRef = useRef(emphasis);
	emphasisRef.current = emphasis;

	useEffect(() => {
		const nextLevel: KeywordDepthLevel = emphasisRef.current === 'post' ? 2 : 1;
		setSelectedLevel(nextLevel);
		setResultLevel(nextLevel);
		setLocalSimMode(emphasisRef.current === 'post' ? 'toBe' : 'asIs');
	}, [siteKey]);

	useEffect(() => {
		const wasPost = prevEmphasisRef.current === 'post';
		prevEmphasisRef.current = emphasis;
		if (!wasPost && emphasis === 'post') {
			setSelectedLevel(2);
			setResultLevel(2);
		}
	}, [emphasis]);

	const projectedEngines = useMemo(() => {
		if (!activeSlice) return undefined;
		const next = {} as Record<AIEngineId, EngineQueryLevelView>;
		for (const engine of list) {
			const snapshot = activeSlice.engines[engine.engine.id];
			if (!snapshot) continue;
			next[engine.engine.id] = projectEngineForQueryLevel(snapshot, projectedLevel);
		}
		return next;
	}, [activeSlice, list, projectedLevel]);

	const cardEmphasis = simMode === 'toBe' ? 'post' : 'current';
	const level2EngineNames = list
		.filter((engine) => {
			const level = activeSlice?.engines[engine.engine.id]?.level ?? engine.currentStatus?.level ?? engine.depthLevel;
			return level === 2;
		})
		.map((engine) => engine.engine.name);

	function handleSimModeChange(mode: TriggerSimMode) {
		setLocalSimMode(mode);
		reach?.setActiveMode(mode);
	}

	function handleRunSimulation(level: KeywordDepthLevel) {
		setResultLevel(level);
	}

	function toggleEngine(id: AIEngineId) {
		setOpenIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	return (
		<AiTriggerSimulationSection
			report={report}
			triggerQueries={triggerQueries}
			emphasis={cardEmphasis}
			simMode={simMode}
			onSimModeChange={handleSimModeChange}
			selectedLevel={selectedLevel}
			onSelectedLevelChange={setSelectedLevel}
			resultLevel={resultLevel}
			isPrescriptionApplied={isPrescriptionApplied}
			onRunSimulation={handleRunSimulation}
			onProbeCompleted={() => setOpenIds(defaultOpenIds())}
			level2EngineNames={level2EngineNames}
		>
			{list.length === 0 ? (
				<p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03]">
					{emptyLabel}
				</p>
			) : (
				<div className="space-y-6">
					<EngineCardGroup
						title={t('liveGroupTitle')}
						hint={t('liveGroupHint')}
						dotClass="bg-emerald-400"
						titleClass="text-zinc-300"
						engines={liveEngines}
						report={report}
						activeSlice={activeSlice}
						projectedEngines={projectedEngines}
						cardEmphasis={cardEmphasis}
						selectedLevel={selectedLevel}
						openIds={openIds}
						onToggle={toggleEngine}
					/>
					<EngineCardGroup
						title={t('proxyGroupTitle')}
						hint={t('proxyGroupHint')}
						dotClass="bg-blue-400"
						titleClass="text-zinc-400"
						engines={proxyEngines}
						report={report}
						activeSlice={activeSlice}
						projectedEngines={projectedEngines}
						cardEmphasis={cardEmphasis}
						selectedLevel={selectedLevel}
						openIds={openIds}
						onToggle={toggleEngine}
					/>
				</div>
			)}
		</AiTriggerSimulationSection>
	);
}

function EngineCardGroup({
	title,
	hint,
	dotClass,
	titleClass,
	engines,
	report,
	activeSlice,
	projectedEngines,
	cardEmphasis,
	selectedLevel,
	openIds,
	onToggle,
}: {
	title: string;
	hint: string;
	dotClass: string;
	titleClass: string;
	engines: AIEngineTestResult[];
	report: GeoDiagnosticReport;
	activeSlice?: ReachSlice;
	projectedEngines?: Partial<Record<AIEngineId, EngineQueryLevelView>>;
	cardEmphasis: 'current' | 'post';
	selectedLevel: KeywordDepthLevel;
	openIds: Set<AIEngineId>;
	onToggle: (id: AIEngineId) => void;
}) {
	if (engines.length === 0) return null;
	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<h4 className={`flex items-center gap-1.5 text-xs font-bold ${titleClass}`}>
					<span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
					{title}
				</h4>
				<span className="text-[11px] text-zinc-500">{hint}</span>
			</div>
			<div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2">
				{engines.map((engine) => {
					const id = engine.engine.id;
					const simulation = projectedEngines?.[id] ?? activeSlice?.engines[id];
					return (
						<AIEngineTestCard
							key={`${id}-${selectedLevel}-${cardEmphasis}`}
							result={engine}
							simulation={simulation}
							brandName={report.brandName}
							domain={report.domain}
							targetUrl={report.targetUrl}
							emphasis={cardEmphasis}
							selectedLevel={selectedLevel}
							analysisTags={
								engine.analysisTags?.length
									? engine.analysisTags
									: report.engineAnalysisTags?.[engine.engine.id]
							}
							open={openIds.has(id)}
							onToggle={() => onToggle(id)}
						/>
					);
				})}
			</div>
		</div>
	);
}
