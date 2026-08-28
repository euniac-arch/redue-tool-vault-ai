'use client';

import { useTranslations } from 'next-intl';
import { StrategyAiRefineButton } from '@/components/strategy/StrategyAiRefineButton';
import { StrategyCopyButton } from '@/components/strategy/StrategyCopyButton';
import { TargetKeywordMarks } from '@/components/strategy/strategy-highlight';
import { META_LABEL, MODULE_TITLE, STUDIO_MODULE_TIGHT } from '@/components/strategy/strategy-ui';
import type {
	ClusterPageKind,
	CopilotRefineTarget,
	EntityCoverage,
	ExecutionBlueprint,
	QualitativeWeight,
	SearchStrategyMap,
	StrategyClusterNode,
	StrategyCopilotContext,
	StrategyEntityTreeNode,
	StrategyExecutionSample,
} from '@/lib/strategy/types';

const STATUS_MARK: Record<EntityCoverage, string> = {
	present: '✓',
	partial: '◐',
	missing: '×',
};

const STATUS_LABEL: Record<EntityCoverage, string> = {
	present: 'PRESENT',
	partial: 'PARTIAL',
	missing: 'MISSING',
};

const STATUS_BORDER: Record<EntityCoverage, string> = {
	present: 'border-slate-400 dark:border-white/35',
	partial: 'border-dashed border-slate-400 dark:border-white/30',
	missing: 'border-slate-200 dark:border-white/10',
};

const KIND_LABEL_CLASS: Record<ClusterPageKind, string> = {
	existing: 'text-slate-900 dark:text-white',
	new: 'text-slate-500',
};

export function StrategySearchMap({
	map,
	samples,
	blueprint,
	copilot,
	omitExecution = false,
	omitPriority = false,
}: {
	map: SearchStrategyMap;
	samples: StrategyExecutionSample;
	blueprint: ExecutionBlueprint;
	omitExecution?: boolean;
	omitPriority?: boolean;
	copilot?: {
		buildContext: (target: CopilotRefineTarget, currentText: string) => StrategyCopilotContext;
		onApply: (target: CopilotRefineTarget, text: string) => void;
	};
}) {
	const t = useTranslations('strategyStudio');
	const cta = blueprint.content.find((block) => block.id === 'cta')?.text || '';
	const primary = map.intent.filter((item) => item.weight === 'primary');
	const secondary = map.intent.filter((item) => item.weight === 'secondary');
	const idle = map.intent.filter((item) => item.weight === 'idle');

	return (
		<div className="space-y-14">
			<header>
				<p className={META_LABEL}>SEARCH STRATEGY MAP</p>
				<h3 className={`mt-2 ${MODULE_TITLE}`}>{t('mapTitle')}</h3>
				<p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-500">{t('mapSubtitle')}</p>
				<div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
					<span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
						{map.confidence.label}
					</span>
					{map.confidence.reasons.map((reason) => (
						<span key={reason} className="text-[12px] text-slate-400">
							{reason}
						</span>
					))}
				</div>
			</header>

			<section className="grid gap-6 border-b border-slate-200/80 pb-8 dark:border-white/10 sm:grid-cols-3">
				<MetaCell kicker="TARGET KEYWORD" value={map.keyword} emphasize />
				<MetaCell kicker="INDUSTRY" value={[map.industry.label, map.industry.specialty].filter(Boolean).join(' / ')} />
				<MetaCell kicker="LOCATION" value={map.location.display || t('notExtracted')} />
			</section>

			<section>
				<p className={MODULE_TITLE}>{t('intentMapTitle')}</p>
				<p className="mt-1 text-[13px] text-slate-500">{t('intentMapHint')}</p>
				<div className="mt-6 grid gap-8 sm:grid-cols-2">
					<div>
						<p className={META_LABEL}>{t('primaryLabel')}</p>
						<ul className="mt-3 space-y-2">
							{primary.map((item) => (
								<li key={item.id} className="text-[20px] font-bold tracking-wide text-slate-900 dark:text-white">
									{item.label}
								</li>
							))}
						</ul>
					</div>
					<div>
						<p className={META_LABEL}>{t('secondaryLabel')}</p>
						<ul className="mt-3 space-y-2">
							{secondary.map((item) => (
								<li
									key={item.id}
									className="text-[14px] font-semibold tracking-wide text-slate-500 dark:text-slate-400"
								>
									{item.label}
								</li>
							))}
						</ul>
					</div>
				</div>
				{idle.length ? (
					<ul className="mt-5 flex flex-wrap gap-2">
						{idle.map((item) => (
							<li key={item.id} className="text-[12px] uppercase tracking-wider text-slate-400">
								{item.label}
							</li>
						))}
					</ul>
				) : null}
				<ul className="sr-only">
					{map.intent.map((item) => (
						<li key={`w-${item.id}`}>
							{item.label} · {weightLabel(item.weight, t)}
						</li>
					))}
				</ul>
			</section>

			<section>
				<p className={MODULE_TITLE}>{t('journeyTitle')}</p>
				<ol className="mt-5 flex flex-col md:flex-row md:flex-wrap md:items-stretch">
					{map.journey.map((step, index) => (
						<li key={step.id} className="flex md:max-w-[10.5rem] md:flex-1 md:flex-col">
							<div className="flex-1 py-2 md:py-0">
								<p className={META_LABEL}>{step.label}</p>
								<p className="mt-1 text-[15px] font-semibold text-slate-900 dark:text-white">{step.value}</p>
							</div>
							{index < map.journey.length - 1 ? (
								<div
									className="mx-0 my-1 h-6 w-px bg-slate-200 md:mx-3 md:my-auto md:h-px md:w-8 dark:bg-white/15"
									aria-hidden="true"
								/>
							) : null}
						</li>
					))}
				</ol>
			</section>

			<section id="entity" className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr]">
				<div>
					<p className={MODULE_TITLE}>{t('entityMapTitle')}</p>
					<div className="mt-5 overflow-x-auto">
						<EntityBranch node={map.entityTree} />
					</div>
				</div>
				<div>
					<p className={META_LABEL}>{t('entityStatusTitle')}</p>
					<ul className="mt-4 space-y-4">
						{map.entityStatus.map((item) => (
							<li key={item.id} className={`rounded-lg border px-4 py-3 ${STATUS_BORDER[item.status]}`}>
								<div className="flex items-center justify-between gap-2">
									<p className="text-[15px] font-semibold text-slate-900 dark:text-white">{item.label}</p>
									<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
										<span aria-hidden="true">{STATUS_MARK[item.status]}</span>
										{STATUS_LABEL[item.status]}
									</span>
								</div>
								<p className="mt-1 text-[12px] text-slate-400">{item.role}</p>
								{item.whyNeeded ? (
									<p className="mt-2 text-[13px] text-slate-600 dark:text-slate-300">
										<span className="font-semibold">{t('entityWhy')} </span>
										{item.whyNeeded}
									</p>
								) : null}
								{item.whatToAdd ? (
									<p className="text-[13px] text-slate-600 dark:text-slate-300">
										<span className="font-semibold">{t('entityWhat')} </span>
										{item.whatToAdd}
									</p>
								) : null}
							</li>
						))}
					</ul>
				</div>
			</section>

			<section>
				<p className={MODULE_TITLE}>{t('surfaceMapTitle')}</p>
				<p className="mt-1 text-[13px] text-slate-500">{map.searchSurfaces[0]?.modelNote}</p>
				<div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					{map.searchSurfaces.map((surface) => (
						<div
							key={surface.id}
							className={`rounded-lg border px-3 py-3 ${
								surface.related
									? 'border-slate-400 dark:border-white/30'
									: 'border-slate-200 dark:border-white/10'
							}`}
						>
							<p className="text-[14px] font-semibold text-slate-900 dark:text-white">{surface.label}</p>
							<p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
								{surface.related ? t('surfaceRelated') : t('surfaceIdle')}
							</p>
							<p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('surfaceSignals')}</p>
							<ul className="mt-1 space-y-0.5">
								{surface.signals.map((signal) => (
									<li key={signal.id} className="text-[12px] text-slate-600 dark:text-slate-300">
										{signal.label}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</section>

			<section>
				<p className={MODULE_TITLE}>{t('coverageTitle')}</p>
				<p className="mt-1 text-[13px] text-slate-500">{t('coverageHint')}</p>
				<div className="mt-6 hidden grid-cols-[1fr_auto_1fr] gap-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid">
					<p>{t('currentStateLabel')}</p>
					<p className="text-center">{t('gapAxisLabel')}</p>
					<p className="text-right">{t('strategicTargetLabel')}</p>
				</div>
				<div className="mt-3 grid gap-5">
					{map.coverage.map((row) => (
						<div
							key={row.code}
							className="grid gap-3 border-b border-slate-200/70 pb-4 last:border-0 dark:border-white/10 md:grid-cols-[1fr_auto_1fr] md:items-center"
						>
							<div>
								<p className="md:hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
									{t('currentStateLabel')}
								</p>
								<p className="text-[15px] font-semibold text-slate-900 dark:text-white">{row.axis}</p>
								<p className="mt-1 text-[13px] text-slate-500">
									{row.currentLevel}
									{typeof row.currentValue === 'number' ? (
										<span className="ml-1.5 text-slate-400">{t('measuredShort', { value: row.currentValue })}</span>
									) : null}
								</p>
								<DotMeter count={row.dots} />
							</div>
							<p className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400 md:text-center">
								<span className="md:hidden">{t('gapAxisLabel')} </span>
								{row.gapLevel} / {row.gapLevel === 'HIGH' ? 'P0' : row.gapLevel === 'MEDIUM' ? 'P1' : 'P2'}
							</p>
							<div className="md:text-right">
								<p className="md:hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
									{t('strategicTargetLabel')}
								</p>
								<p className="text-[15px] font-semibold text-slate-900 dark:text-white">{row.axis}</p>
								<p className="mt-1 text-[13px] text-slate-500">
									{row.targetLevel}
									<span className="ml-1.5 text-slate-400">{row.targetLabel}</span>
								</p>
							</div>
						</div>
					))}
				</div>
			</section>

			{omitPriority ? null : <section>
				<p className={MODULE_TITLE}>{t('priorityEngineTitle')}</p>
				<div className="mt-6 grid gap-8">
					{map.priorities.map((item) => (
						<article key={item.id} className="relative pl-5">
							<span
								className={`absolute bottom-0 left-0 top-0 w-[3px] ${
									item.rank === 'P0' ? 'bg-slate-900 dark:bg-white' : item.rank === 'P1' ? 'bg-slate-500' : 'bg-slate-300 dark:bg-white/25'
								}`}
								aria-hidden="true"
							/>
							<div className="flex flex-wrap items-baseline gap-2">
								<span className="font-mono text-[12px] font-semibold text-slate-500">{item.rank}</span>
								<h4 className="text-[16px] font-bold text-slate-900 dark:text-white">{item.title}</h4>
							</div>
							<p className="mt-2 text-[13px] text-slate-500">
								<span className="font-semibold text-slate-600 dark:text-slate-300">{t('whyFirst')} </span>
								{item.whyFirst}
							</p>
							<dl className="mt-4 space-y-3">
								<div>
									<dt className={META_LABEL}>WHY</dt>
									<dd className="mt-1 text-[14px] text-slate-600 dark:text-slate-300">{item.why}</dd>
								</div>
								<div>
									<dt className={META_LABEL}>WHAT</dt>
									<dd className="mt-1 text-[14px] text-slate-600 dark:text-slate-300">{item.what}</dd>
								</div>
								<div>
									<dt className={META_LABEL}>HOW</dt>
									<dd className="mt-2 flex flex-wrap gap-1.5">
										{item.how.map((step) => (
											<span key={step} className="rounded-md border border-slate-200 px-2 py-0.5 text-[12px] dark:border-white/10">
												{step}
											</span>
										))}
									</dd>
								</div>
							</dl>
						</article>
					))}
				</div>
			</section>}

			<section>
				<p className={META_LABEL}>{t('competitionTitle')}</p>
				<p className="mt-2 text-[15px] font-semibold text-slate-800 dark:text-slate-100">TARGET · {map.competition.keyword}</p>
				{map.competition.ready ? (
					<ul className="mt-3 flex flex-wrap gap-2">
						{map.competition.names.map((name) => (
							<li key={name} className="text-[13px] text-slate-600 dark:text-slate-300">
								{name}
							</li>
						))}
					</ul>
				) : (
					<p className="mt-3 text-[14px] text-slate-500">{map.competition.note}</p>
				)}
				<p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('competitorGap')}</p>
				<p className="mt-1 text-[13px] text-slate-500">{map.competition.gapAxes.join(' · ')}</p>
			</section>

			<section>
				<p className={MODULE_TITLE}>{t('clusterTitle')}</p>
				<p className="mt-1 text-[13px] text-slate-500">{t('clusterHint')}</p>
				<div className="mt-5 overflow-x-auto">
					<ClusterBranch node={map.contentCluster} existingLabel={t('clusterExisting')} newLabel={t('clusterNew')} />
				</div>
			</section>

			{omitExecution ? null : (
				<section>
					<p className={META_LABEL}>{t('contentSample')}</p>
					<p className={`mt-2 ${MODULE_TITLE}`}>{t('contentSampleTitle')}</p>
					<div className="mt-6 divide-y divide-slate-200/80 dark:divide-white/10">
						<SampleRow kicker="TITLE" text={blueprint.seo.title} target="title" copilot={copilot} />
						<SampleRow kicker="H1" text={blueprint.seo.h1} target="h1" copilot={copilot} />
						<SampleRow kicker="H2" text={blueprint.seo.h2.join('\n')} />
						<SampleRow
							kicker="FAQ"
							text={`Q. ${blueprint.aeo.question}\nA. ${blueprint.aeo.shortAnswer}`}
							target="faq"
							copilot={copilot}
						/>
						<SampleRow kicker="ANSWER" text={blueprint.aeo.shortAnswer} target="answer" copilot={copilot} />
						<SampleRow kicker="ENTITY SENTENCE" text={blueprint.entity.entitySentence} target="entitySentence" copilot={copilot} />
						<SampleRow kicker="CTA" text={cta} target="content" copilot={copilot} />
						<SampleRow kicker="META" text={samples.metaDescription} target="meta" copilot={copilot} />
					</div>
				</section>
			)}

			{omitExecution ? null : (
				<section>
					<div className="flex items-center justify-between gap-3">
						<p className={META_LABEL}>{t('horizonTitle')}</p>
						{copilot ? (
							<StrategyAiRefineButton
								target="action"
								context={copilot.buildContext('action', [...map.actionPlan.today, ...map.actionPlan.thisWeek, ...map.actionPlan.next].join('\n'))}
								onApply={copilot.onApply}
							/>
						) : null}
					</div>
					<div className="mt-5 grid gap-8 md:grid-cols-3">
						<PlanCol title={t('horizonToday')} items={blueprint.action.p0.length ? blueprint.action.p0 : map.actionPlan.today} />
						<PlanCol title={t('horizonWeek')} items={blueprint.action.p1.length ? blueprint.action.p1 : map.actionPlan.thisWeek} />
						<PlanCol title={t('horizonNext')} items={blueprint.action.p2.length ? blueprint.action.p2 : map.actionPlan.next} />
					</div>
				</section>
			)}
		</div>
	);
}

function weightLabel(weight: QualitativeWeight, t: ReturnType<typeof useTranslations>) {
	if (weight === 'primary') return t('weightPrimary');
	if (weight === 'secondary') return t('weightSecondary');
	return t('weightIdle');
}

function MetaCell({ kicker, value, emphasize }: { kicker: string; value: string; emphasize?: boolean }) {
	return (
		<div>
			<p className={META_LABEL}>{kicker}</p>
			{emphasize ? (
				<TargetKeywordMarks
					keyword={value}
					className="mt-2 font-['Pretendard',sans-serif] text-[18px] font-semibold tracking-tight text-slate-900 dark:text-white"
				/>
			) : (
				<p className="mt-2 font-['Pretendard',sans-serif] text-[16px] font-semibold text-slate-900 dark:text-white">{value}</p>
			)}
		</div>
	);
}

function DotMeter({ count }: { count: number }) {
	return (
		<div className="mt-2 flex gap-1" aria-hidden="true">
			{Array.from({ length: 5 }, (_, index) => (
				<span
					key={index}
					className={`h-1.5 w-1.5 rounded-full ${index < count ? 'bg-slate-800 dark:bg-white' : 'bg-slate-200 dark:bg-white/15'}`}
				/>
			))}
		</div>
	);
}

function EntityBranch({ node }: { node: StrategyEntityTreeNode }) {
	return (
		<div className="min-w-[12rem]">
			<div className={`rounded-lg border px-3 py-2 ${STATUS_BORDER[node.status]}`}>
				<p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{node.role}</p>
				<p className="text-[14px] font-semibold text-slate-900 dark:text-white">{node.label}</p>
				<p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
					<span aria-hidden="true">{STATUS_MARK[node.status]}</span>
					{STATUS_LABEL[node.status]}
				</p>
			</div>
			{node.children.length ? (
				<div className="mt-3 grid gap-3 border-l border-slate-200 pl-4 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-3">
					{node.children.map((child) => (
						<EntityBranch key={child.id} node={child} />
					))}
				</div>
			) : null}
		</div>
	);
}

function ClusterBranch({
	node,
	existingLabel,
	newLabel,
}: {
	node: StrategyClusterNode;
	existingLabel: string;
	newLabel: string;
}) {
	return (
		<div className="min-w-[11rem]">
			<div className={`${STUDIO_MODULE_TIGHT}`}>
				<div className="flex items-center justify-between gap-2">
					<p className="text-[14px] font-bold text-slate-900 dark:text-white">{node.label}</p>
					<span className={`text-[11px] font-bold uppercase tracking-wider ${KIND_LABEL_CLASS[node.kind]}`}>
						{node.kind === 'existing' ? existingLabel : newLabel}
					</span>
				</div>
				{node.url ? <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{node.url}</p> : null}
			</div>
			{node.children.length ? (
				<div className="mt-2 grid gap-2 border-l border-slate-200 pl-3 dark:border-white/10 sm:grid-cols-2">
					{node.children.map((child) => (
						<ClusterBranch key={child.id} node={child} existingLabel={existingLabel} newLabel={newLabel} />
					))}
				</div>
			) : null}
		</div>
	);
}

function SampleRow({
	kicker,
	text,
	target,
	copilot,
}: {
	kicker: string;
	text: string;
	target?: CopilotRefineTarget;
	copilot?: {
		buildContext: (target: CopilotRefineTarget, currentText: string) => StrategyCopilotContext;
		onApply: (target: CopilotRefineTarget, text: string) => void;
	};
}) {
	return (
		<div className="py-6 first:pt-0">
			<div className="mb-3 flex items-center justify-between gap-2">
				<p className={META_LABEL}>{kicker}</p>
				<div className="flex items-center gap-2">
					{target && copilot ? (
						<StrategyAiRefineButton target={target} context={copilot.buildContext(target, text)} onApply={copilot.onApply} />
					) : null}
					<StrategyCopyButton text={text} />
				</div>
			</div>
			<p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">{text}</p>
		</div>
	);
}

function PlanCol({ title, items }: { title: string; items: string[] }) {
	return (
		<div>
			<p className={META_LABEL}>{title}</p>
			<ul className="mt-3 space-y-2">
				{items.map((item) => (
					<li key={item} className="text-[14px] text-slate-700 dark:text-slate-200">
						{item}
					</li>
				))}
			</ul>
		</div>
	);
}
