'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CopilotRefineTarget, ExecutionBlueprint, ExecutionCopyUnit, StrategyCopilotContext } from '@/lib/strategy/types';
import {
	BlueprintDecisionMatrixPanel,
	BlueprintInformationGainPanel,
	BlueprintLlmsTxtExport,
	BlueprintRagChunks,
	BlueprintSafetySignalsPanel,
} from '@/components/strategy/BlueprintAiCitation';
import { StrategyAiRefineButton } from '@/components/strategy/StrategyAiRefineButton';
import { StrategyCopyButton } from '@/components/strategy/StrategyCopyButton';
import { blueprintTabEventName, type BlueprintFocusTab } from '@/components/strategy/StrategicGapWorkspace';
import { formatFaqDisplay } from '@/components/strategy/strategy-highlight';
import { META_LABEL, MODULE_TITLE } from '@/components/strategy/strategy-ui';

export interface BlueprintCopilotProps {
	buildContext: (target: CopilotRefineTarget, currentText: string) => StrategyCopilotContext;
	onApply: (target: CopilotRefineTarget, text: string) => void;
}

type BlueprintTab = BlueprintFocusTab;

const CORE_TABS: BlueprintTab[] = ['SEO', 'AEO', 'GEO', 'ENTITY', 'CONTENT', 'SCHEMA', 'LOCAL'];
const AI_CITE_TABS: BlueprintTab[] = ['RAG', 'MATRIX', 'GAIN', 'SAFETY', 'LLMS'];
const BLUEPRINT_TABS: BlueprintTab[] = [...CORE_TABS, ...AI_CITE_TABS];

function unitOf(blueprint: ExecutionBlueprint, id: ExecutionCopyUnit['id']): ExecutionCopyUnit | undefined {
	return blueprint.copyUnits.find((unit) => unit.id === id);
}

function CopyBlock({
	kicker,
	value,
	unit,
	mono,
	children,
	refine,
}: {
	kicker: string;
	value?: string;
	unit?: ExecutionCopyUnit;
	mono?: boolean;
	children?: React.ReactNode;
	refine?: React.ReactNode;
}) {
	return (
		<div className="border-b border-slate-200/80 py-6 last:border-0 dark:border-white/10">
			<div className="flex items-center justify-between gap-3">
				<p className={META_LABEL}>{kicker}</p>
				<div className="flex items-center gap-1.5">
					{refine}
					{unit?.text || value ? <StrategyCopyButton text={value || unit?.text || ''} /> : null}
				</div>
			</div>
			{children ? (
				<div className="mt-3">{children}</div>
			) : (
				<p className={`mt-3 whitespace-pre-wrap break-keep text-[15px] leading-7 text-slate-900 dark:text-white ${mono ? 'font-mono text-[13px]' : ''}`}>
					{value}
				</p>
			)}
		</div>
	);
}

function Refine({
	target,
	text,
	copilot,
}: {
	target: CopilotRefineTarget;
	text: string;
	copilot?: BlueprintCopilotProps;
}) {
	if (!copilot) return null;
	return <StrategyAiRefineButton target={target} context={copilot.buildContext(target, text)} onApply={copilot.onApply} />;
}

export function StrategyExecutionBlueprint({
	blueprint,
	copilot,
	hideAction = false,
}: {
	blueprint: ExecutionBlueprint;
	copilot?: BlueprintCopilotProps;
	hideAction?: boolean;
}) {
	const t = useTranslations('strategyStudio');
	const [tab, setTab] = useState<BlueprintTab>('SEO');

	useEffect(() => {
		function onFocus(event: Event) {
			const next = (event as CustomEvent<BlueprintFocusTab>).detail;
			if (next && BLUEPRINT_TABS.includes(next)) setTab(next);
		}
		window.addEventListener(blueprintTabEventName(), onFocus);
		return () => window.removeEventListener(blueprintTabEventName(), onFocus);
	}, []);

	return (
		<div className="space-y-10">
			<p className="text-[13px] text-slate-500">{t('blueprintDisclaimer')}</p>

			<div>
				<p className={META_LABEL}>PAGE STRATEGY</p>
				<div className="mt-4 grid gap-5 sm:grid-cols-3">
					<Fact label="TARGET KEYWORD" value={blueprint.pageStrategy.keyword} />
					<Fact label="PAGE TYPE" value={blueprint.pageStrategy.pageTypeLabel} />
					<Fact label="SEARCH INTENT" value={blueprint.pageStrategy.intentLabel} />
				</div>
			</div>

			<div>
				<p className={META_LABEL}>{t('contentSample')}</p>
				<nav className="mt-4 flex flex-wrap gap-1 border-b border-slate-200/80 dark:border-white/10" aria-label="Execution modules">
					{CORE_TABS.map((item) => (
						<button
							key={item}
							type="button"
							onClick={() => setTab(item)}
							aria-pressed={tab === item}
							className={`px-3 py-2 text-[12px] font-bold tracking-[0.12em] transition ${
								tab === item
									? 'border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white'
									: 'border-b-2 border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
							}`}
						>
							{item}
						</button>
					))}
				</nav>
				<div className="mt-5">
					<p className={META_LABEL}>{t('blueprintAiCite')}</p>
					<nav className="mt-3 flex flex-wrap gap-1 border-b border-slate-200/80 dark:border-white/10" aria-label="AI citation modules">
						{AI_CITE_TABS.map((item) => (
							<button
								key={item}
								type="button"
								onClick={() => setTab(item)}
								aria-pressed={tab === item}
								className={`px-3 py-2 text-[12px] font-bold tracking-[0.12em] transition ${
									tab === item
										? 'border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white'
										: 'border-b-2 border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
								}`}
							>
								{item}
							</button>
						))}
					</nav>
				</div>
			</div>

			{tab === 'SEO' ? (
				<div>
					<p className={MODULE_TITLE}>SEO</p>
					<div className="mt-2">
						<CopyBlock kicker="TITLE" value={blueprint.seo.title} unit={unitOf(blueprint, 'title')} refine={<Refine target="title" text={blueprint.seo.title} copilot={copilot} />} />
						<CopyBlock kicker="META DESCRIPTION" value={blueprint.seo.metaDescription} unit={unitOf(blueprint, 'meta')} refine={<Refine target="meta" text={blueprint.seo.metaDescription} copilot={copilot} />} />
						<CopyBlock kicker="H1" value={blueprint.seo.h1} unit={unitOf(blueprint, 'h1')} refine={<Refine target="h1" text={blueprint.seo.h1} copilot={copilot} />} />
						<div className="border-b border-slate-200/80 py-6 dark:border-white/10">
							<p className={META_LABEL}>H2 STRUCTURE</p>
							<ol className="mt-3 space-y-2">
								{blueprint.seo.h2.map((heading, index) => (
									<li key={heading} className="text-[15px] text-slate-800 dark:text-slate-100">
										<span className="mr-2 font-mono text-[12px] text-slate-400">{index + 1}.</span>
										{heading}
									</li>
								))}
							</ol>
						</div>
						<CopyBlock kicker="URL SLUG" value={blueprint.seo.urlSlug} />
						<p className="pt-2 text-[12px] text-slate-500">{blueprint.seo.slugNote}</p>
						<Fact label="CANONICAL" value={blueprint.seo.canonical} />
						<p className="text-[12px] text-slate-500">{blueprint.seo.canonicalNote}</p>
					</div>
				</div>
			) : null}

			{tab === 'AEO' ? (
				<div>
					<p className={MODULE_TITLE}>AEO</p>
					<div className="mt-2">
						<CopyBlock
							kicker="QUESTION / FAQ"
							value={formatFaqDisplay(blueprint.aeo.question, blueprint.aeo.shortAnswer)}
							unit={unitOf(blueprint, 'faq')}
							refine={<Refine target="faq" text={`Q. ${blueprint.aeo.question}\nA. ${blueprint.aeo.shortAnswer}`} copilot={copilot} />}
						/>
						<CopyBlock
							kicker="ANSWER"
							value={blueprint.aeo.shortAnswer}
							unit={unitOf(blueprint, 'answer')}
							refine={<Refine target="answer" text={blueprint.aeo.shortAnswer} copilot={copilot} />}
						/>
						<CopyBlock kicker="DETAIL" value={blueprint.aeo.detail} />
						<div className="py-6">
							<p className={META_LABEL}>{t('blueprintRelatedServices')}</p>
							<p className="mt-2 text-[15px] font-medium text-slate-800 dark:text-slate-100">
								{blueprint.aeo.relatedServices.join(' → ') || t('blueprintNone')}
							</p>
						</div>
					</div>
				</div>
			) : null}

			{tab === 'GEO' ? (
				<div>
					<p className={MODULE_TITLE}>GEO</p>
					<ol className="mt-5 flex flex-col gap-0 sm:flex-row sm:flex-wrap sm:items-center">
						{blueprint.geo.chain.map((node, index) => (
							<li key={node.id} className="flex flex-col sm:flex-row sm:items-center">
								<div className="py-2">
									<p className={META_LABEL}>{node.role}</p>
									<p className="mt-1 text-[15px] font-semibold text-slate-900 dark:text-white">{node.label}</p>
								</div>
								{index < blueprint.geo.chain.length - 1 ? (
									<span className="mx-3 hidden h-px w-8 bg-slate-200 sm:block dark:bg-white/15" aria-hidden="true" />
								) : null}
							</li>
						))}
					</ol>
				</div>
			) : null}

			{tab === 'ENTITY' ? (
				<div>
					<p className={MODULE_TITLE}>ENTITY</p>
					<CopyBlock
						kicker="ENTITY SENTENCE"
						value={blueprint.entity.entitySentence}
						unit={unitOf(blueprint, 'entitySentence')}
						refine={<Refine target="entitySentence" text={blueprint.entity.entitySentence} copilot={copilot} />}
					/>
				</div>
			) : null}

			{tab === 'CONTENT' ? (
				<div>
					<div className="flex items-center justify-between gap-3">
						<p className={MODULE_TITLE}>CONTENT BLUEPRINT</p>
						<Refine
							target="content"
							text={blueprint.content.map((block) => `${block.label}: ${block.text}`).join('\n')}
							copilot={copilot}
						/>
					</div>
					<ol className="mt-2 divide-y divide-slate-200/80 dark:divide-white/10">
						{blueprint.content.map((block, index) => (
							<li key={block.id} className="py-6">
								<p className={META_LABEL}>
									{String(index + 1).padStart(2, '0')} {block.label}
								</p>
								<p className="mt-2 text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">{block.text}</p>
							</li>
						))}
					</ol>
				</div>
			) : null}

			{tab === 'SCHEMA' ? (
				<div>
					<p className={MODULE_TITLE}>SCHEMA</p>
					<p className="mt-2 text-[13px] text-slate-500">{blueprint.schema.note}</p>
					<div className="mt-4 grid gap-4">
						{blueprint.schema.candidates.map((item) => (
							<div key={item.type} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/70 pb-4 dark:border-white/10">
								<div>
									<p className="text-[15px] font-bold text-slate-900 dark:text-white">{item.type}</p>
									<p className="mt-1 text-[13px] text-slate-500">{item.reason}</p>
								</div>
								<span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
									{item.status === 'consider' ? 'CONSIDER' : item.status === 'already_present' ? 'PRESENT' : 'SKIP'}
								</span>
							</div>
						))}
					</div>
					<div className="mt-2">
						<CopyBlock kicker="JSON-LD PREVIEW" unit={unitOf(blueprint, 'schema')} mono value={blueprint.schema.jsonLdText} />
					</div>
				</div>
			) : null}

			{tab === 'RAG' && blueprint.ragChunks?.length ? <BlueprintRagChunks chunks={blueprint.ragChunks} /> : null}

			{tab === 'MATRIX' && blueprint.decisionMatrix ? <BlueprintDecisionMatrixPanel matrix={blueprint.decisionMatrix} /> : null}

			{tab === 'GAIN' && blueprint.informationGain ? <BlueprintInformationGainPanel gain={blueprint.informationGain} /> : null}

			{tab === 'SAFETY' && blueprint.safetySignals ? <BlueprintSafetySignalsPanel safety={blueprint.safetySignals} /> : null}

			{tab === 'LLMS' && blueprint.llmsTxt ? <BlueprintLlmsTxtExport llms={blueprint.llmsTxt} /> : null}

			{tab === 'LOCAL' ? (
				<div>
					<p className={MODULE_TITLE}>LOCAL</p>
					{blueprint.local.chain.length ? (
						<ol className="mt-5 flex flex-col gap-0 sm:flex-row sm:flex-wrap sm:items-center">
							{blueprint.local.chain.map((node, index) => (
								<li key={`${node.label}-${node.source}`} className="flex flex-col sm:flex-row sm:items-center">
									<span className="py-1 text-[15px] font-semibold text-slate-800 dark:text-slate-100">{node.label}</span>
									{index < blueprint.local.chain.length - 1 ? (
										<span className="mx-3 hidden h-px w-8 bg-slate-200 sm:block dark:bg-white/15" aria-hidden="true" />
									) : null}
								</li>
							))}
						</ol>
					) : (
						<p className="mt-4 text-[14px] text-slate-500">{t('blueprintLocalEmpty')}</p>
					)}
					<p className="mt-3 text-[13px] text-slate-500">{blueprint.local.note}</p>
					<p className="mt-8 text-[13px] text-slate-500">{t('blueprintInternalHint')}</p>
					<ol className="mt-4 space-y-4">
						{blueprint.internalLinks.map((link, index) => (
							<li key={link.role}>
								<p className={META_LABEL}>
									{String(index + 1).padStart(2, '0')} {link.roleLabel}
								</p>
								{link.url ? (
									<p className="mt-1 break-all font-mono text-[14px] text-slate-800 dark:text-slate-100">{link.url}</p>
								) : (
									<p className="mt-1 text-[14px] text-slate-500">{t('blueprintNoUrl')}</p>
								)}
								<p className="mt-1 text-[12px] text-slate-500">{link.pageLabel ? `${link.pageLabel} · ${link.note}` : link.note}</p>
							</li>
						))}
					</ol>
				</div>
			) : null}

			{!hideAction ? (
				<div id="action-plan">
					<div className="flex items-center justify-between gap-3">
						<p className={MODULE_TITLE}>ACTION</p>
						<Refine
							target="action"
							text={`P0: ${blueprint.action.p0.join(' / ')}\nP1: ${blueprint.action.p1.join(' / ')}\nP2: ${blueprint.action.p2.join(' / ')}`}
							copilot={copilot}
						/>
					</div>
					<div className="mt-5 grid gap-8 md:grid-cols-3">
						<PlanColumn title="NOW" hint={t('blueprintP0')} items={blueprint.action.p0} />
						<PlanColumn title="THIS WEEK" hint={t('blueprintP1')} items={blueprint.action.p1} />
						<PlanColumn title="NEXT" hint={t('blueprintP2')} items={blueprint.action.p2} />
					</div>
				</div>
			) : null}
		</div>
	);
}

function Fact({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className={META_LABEL}>{label}</p>
			<p className="mt-1 break-all text-[15px] font-semibold text-slate-900 dark:text-white">{value}</p>
		</div>
	);
}

function PlanColumn({ title, hint, items }: { title: string; hint: string; items: string[] }) {
	return (
		<div>
			<p className={META_LABEL}>{title}</p>
			<p className="mt-1 text-[12px] text-slate-500">{hint}</p>
			<ol className="mt-3 space-y-2">
				{items.map((item, index) => (
					<li key={item} className="text-[14px] text-slate-700 dark:text-slate-200">
						<span className="mr-2 font-mono text-[12px] text-slate-400">{index + 1}.</span>
						{item}
					</li>
				))}
			</ol>
		</div>
	);
}
