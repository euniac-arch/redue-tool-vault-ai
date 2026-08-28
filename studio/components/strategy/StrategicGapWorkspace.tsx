'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
	StrategyAxisCoverage,
	StrategyGap,
	StrategyMapPriority,
	StrategyMove,
	StrategyPriorityLevel,
	StrategyResult,
} from '@/lib/strategy/types';
import { META_LABEL } from '@/components/strategy/strategy-ui';

const BLUEPRINT_TAB_EVENT = 'redue:strategy-blueprint-tab';

export type BlueprintFocusTab =
	| 'SEO'
	| 'AEO'
	| 'GEO'
	| 'ENTITY'
	| 'CONTENT'
	| 'SCHEMA'
	| 'LOCAL'
	| 'RAG'
	| 'MATRIX'
	| 'GAIN'
	| 'SAFETY'
	| 'LLMS';

export function requestBlueprintTab(tab: BlueprintFocusTab) {
	window.dispatchEvent(new CustomEvent(BLUEPRINT_TAB_EVENT, { detail: tab }));
}

export function blueprintTabEventName() {
	return BLUEPRINT_TAB_EVENT;
}

const RANK_OF: Record<StrategyPriorityLevel, 'P0' | 'P1' | 'P2'> = {
	HIGH: 'P0',
	MEDIUM: 'P1',
	LOW: 'P2',
};

const RANK_LABEL: Record<'P0' | 'P1' | 'P2', 'priorityCritical' | 'priorityHighLabel' | 'priorityOptimize'> = {
	P0: 'priorityCritical',
	P1: 'priorityHighLabel',
	P2: 'priorityOptimize',
};

interface GapCardModel {
	id: string;
	code: StrategyGap['code'];
	title: string;
	current: string;
	strategy: string;
	rank: 'P0' | 'P1' | 'P2';
	whyFirst: string;
	why: string;
	what: string;
	how: string[];
	expectedImpact: string;
	coverage?: StrategyAxisCoverage;
}

function mergeGapCards(result: StrategyResult): GapCardModel[] {
	const priorityById = new Map(result.strategyMap.priorities.map((item) => [item.id, item]));
	const moveById = new Map((result.strategies.length ? result.strategies : []).map((item) => [item.gapId, item]));
	const coverageByCode = new Map(result.strategyMap.coverage.map((item) => [item.code, item]));

	return result.gaps.map((gap) => {
		const priority: StrategyMapPriority | undefined = priorityById.get(gap.id);
		const move: StrategyMove | undefined = moveById.get(gap.id);
		const coverage = coverageByCode.get(gap.code);
		const rankFromCoverage = coverage
			? coverage.gapLevel === 'HIGH'
				? 'P0'
				: coverage.gapLevel === 'MEDIUM'
					? 'P1'
					: 'P2'
			: undefined;
		return {
			id: gap.id,
			code: gap.code,
			title: gap.title,
			current: gap.current,
			strategy: gap.strategy,
			rank: rankFromCoverage ?? priority?.rank ?? RANK_OF[gap.priority],
			whyFirst: priority?.whyFirst || '',
			why: move?.why || gap.why,
			what: move?.what || gap.what,
			how: move?.how?.length ? move.how : gap.how,
			expectedImpact: move?.expectedImpact || gap.expectedImpact,
			coverage: coverageByCode.get(gap.code),
		};
	});
}

function actionsFor(code: StrategyGap['code'], t: ReturnType<typeof useTranslations>) {
	const blueprint = { href: '#execution-sample' as const, label: t('actionBlueprint') };
	const plan = { href: '#action-plan' as const, label: t('actionPlanJump') };
	if (code === 'AEO') {
		return [
			{ href: '#execution-sample' as const, label: t('actionFaq'), tab: 'AEO' as const },
			{ href: '#execution-sample' as const, label: t('actionRag'), tab: 'RAG' as const },
			plan,
		];
	}
	if (code === 'ENTITY') {
		return [
			{ href: '#execution-sample' as const, label: t('actionEntitySentence'), tab: 'ENTITY' as const },
			{ href: '#execution-sample' as const, label: t('actionLlms'), tab: 'LLMS' as const },
			plan,
		];
	}
	if (code === 'CONTENT') {
		return [
			{ href: '#execution-sample' as const, label: t('actionContentSample'), tab: 'CONTENT' as const },
			{ href: '#execution-sample' as const, label: t('actionMatrix'), tab: 'MATRIX' as const },
			plan,
		];
	}
	if (code === 'TRUST') {
		return [{ href: '#execution-sample' as const, label: t('actionSafety'), tab: 'SAFETY' as const }, plan];
	}
	if (code === 'SCHEMA') return [{ href: '#execution-sample' as const, label: t('actionBlueprint'), tab: 'SCHEMA' as const }, plan];
	if (code === 'LOCAL') return [{ href: '#execution-sample' as const, label: t('actionBlueprint'), tab: 'LOCAL' as const }, plan];
	return [blueprint, plan];
}

export function StrategicGapWorkspace({ result }: { result: StrategyResult }) {
	const t = useTranslations('strategyStudio');
	const cards = useMemo(() => mergeGapCards(result), [result]);
	const [openId, setOpenId] = useState<string | null>(null);

	const p0 = cards.filter((card) => card.rank === 'P0');
	const featured = p0.length ? p0 : cards.slice(0, 1);
	const featuredIds = new Set(featured.map((card) => card.id));
	const grid = cards.filter((card) => !featuredIds.has(card.id));
	const rail = cards;

	function toggle(id: string) {
		setOpenId((prev) => (prev === id ? null : id));
	}

	return (
		<div>
			<div className="space-y-5">
				{featured.map((card) => (
					<GapCard
						key={card.id}
						card={card}
						featured
						open={openId === card.id}
						onToggle={() => toggle(card.id)}
					/>
				))}
			</div>

			{grid.length ? (
				<div className="mt-6 grid gap-4 md:grid-cols-2">
					{grid.map((card) => (
						<GapCard
							key={card.id}
							card={card}
							featured={false}
							open={openId === card.id}
							onToggle={() => toggle(card.id)}
						/>
					))}
				</div>
			) : null}

			<section className="mt-10" aria-label={t('executionOrder')}>
				<p className={META_LABEL}>{t('executionOrder')}</p>
				<ol className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
					{rail.map((card, index) => (
						<li key={`rail-${card.id}`} className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => {
									setOpenId(card.id);
									document.getElementById(`gap-card-${card.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
								}}
								className="text-left"
							>
								<span className="font-mono text-[11px] text-slate-400">{String(index + 1).padStart(2, '0')}</span>
								<span className="ml-2 font-mono text-[11px] font-semibold text-slate-500">{card.rank}</span>
								<span className="ml-2 text-[13px] font-semibold tracking-wide text-slate-800 dark:text-slate-100">
									{card.code}
								</span>
							</button>
							{index < rail.length - 1 ? (
								<span className="hidden h-px w-6 bg-slate-200 md:block dark:bg-white/15" aria-hidden="true" />
							) : null}
						</li>
					))}
				</ol>
			</section>
		</div>
	);
}

function GapCard({
	card,
	featured,
	open,
	onToggle,
}: {
	card: GapCardModel;
	featured: boolean;
	open: boolean;
	onToggle: () => void;
}) {
	const t = useTranslations('strategyStudio');
	const actions = actionsFor(card.code, t);
	const howSummary = card.how.join(' → ');

	return (
		<article
			id={`gap-card-${card.id}`}
			className={`group rounded-lg bg-transparent px-5 py-5 transition duration-200 motion-reduce:transition-none ${
				featured
					? 'border-2 border-slate-900 dark:border-white'
					: 'border border-slate-200 hover:-translate-y-0.5 hover:border-slate-400 dark:border-white/15 dark:hover:border-white/40'
			}`}
		>
			<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
				{card.coverage ? `${card.coverage.gapLevel} / ` : ''}
				{card.rank}
				<span className="ml-2">{t(RANK_LABEL[card.rank])}</span>
			</p>
			<h3
				className={`mt-2 font-bold tracking-tight text-slate-900 dark:text-white ${
					featured ? 'text-[1.375rem] sm:text-[1.5rem]' : 'text-[1.125rem] sm:text-[1.25rem]'
				}`}
			>
				{card.code} GAP
			</h3>
			<p className="mt-1 text-[13px] font-medium text-slate-500">{card.title}</p>
			<p className="mt-3 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
				<span className="font-semibold text-slate-700 dark:text-slate-200">{t('gapCurrent')} </span>
				{card.current}
			</p>
			<p className="mt-3 text-[14px] leading-relaxed text-slate-700 dark:text-slate-200">
				<span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
					{t('recommendedStrategy')}
				</span>
				<span className="mt-1 block">{card.strategy}</span>
			</p>

			{featured ? (
				<div className="mt-4 space-y-2">
					{card.whyFirst ? (
						<p className="text-[14px] leading-relaxed text-slate-500">
							<span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">WHY</span>
							{card.whyFirst}
						</p>
					) : null}
					{howSummary ? (
						<p className="text-[14px] leading-relaxed text-slate-700 dark:text-slate-200">
							<span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">HOW</span>
							{howSummary}
						</p>
					) : null}
				</div>
			) : null}

			<button
				type="button"
				onClick={onToggle}
				aria-expanded={open}
				className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
			>
				{open ? t('hideStrategyDetail') : t('viewStrategyDetail')}
				<span aria-hidden="true" className={`transition duration-200 motion-reduce:transition-none ${open ? '' : 'group-hover:translate-x-0.5'}`}>
					→
				</span>
			</button>

			<div
				className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
					open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
				}`}
			>
				<div className="overflow-hidden">
					<div className={`pt-6 ${open ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 motion-reduce:transition-none`}>
						<dl className="space-y-5">
							<div>
								<dt className={META_LABEL}>{t('whyNeeded')}</dt>
								<dd className="mt-1 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{card.why}</dd>
							</div>
							<div>
								<dt className={META_LABEL}>{t('whatToDo')}</dt>
								<dd className="mt-1 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{card.what}</dd>
							</div>
							<div>
								<dt className={META_LABEL}>{t('howToExecute')}</dt>
								<dd className="mt-2 flex flex-wrap gap-2">
									{card.how.map((item) => (
										<span
											key={item}
											className="rounded-md border border-slate-200 px-2 py-0.5 text-[13px] text-slate-600 dark:border-white/10 dark:text-slate-300"
										>
											{item}
										</span>
									))}
								</dd>
							</div>
							{card.expectedImpact ? (
								<div>
									<dt className={META_LABEL}>{t('impactLabel')}</dt>
									<dd className="mt-1 text-[14px] text-slate-500">{card.expectedImpact}</dd>
								</div>
							) : null}
						</dl>

						<ol className="mt-8 space-y-4">
							<li>
								<p className={META_LABEL}>{t('currentStateLabel')}</p>
								<p className="mt-1 text-[14px] text-slate-600 dark:text-slate-300">{card.current}</p>
							</li>
							<li className="border-t border-slate-200/70 pt-4 dark:border-white/10">
								<p className={META_LABEL}>{t('strategicTargetLabel')}</p>
								<p className="mt-1 text-[14px] text-slate-600 dark:text-slate-300">
									{card.coverage?.targetLabel || card.strategy}
								</p>
							</li>
							<li className="border-t border-slate-200/70 pt-4 dark:border-white/10">
								<p className={META_LABEL}>{t('gapAxisLabel')}</p>
								<p className="mt-1 text-[14px] text-slate-600 dark:text-slate-300">
									{card.coverage
										? `${card.coverage.axis} · ${card.coverage.gapLevel} / ${card.rank}`
										: card.code}
								</p>
							</li>
							<li className="border-t border-slate-200/70 pt-4 dark:border-white/10">
								<p className={META_LABEL}>ACTION</p>
								<p className="mt-1 text-[14px] text-slate-600 dark:text-slate-300">{howSummary}</p>
							</li>
						</ol>

						<div className="mt-6 flex flex-wrap gap-2">
							{actions.map((action) => (
								<a
									key={action.label}
									href={action.href}
									onClick={() => {
										if ('tab' in action && action.tab) requestBlueprintTab(action.tab);
									}}
									className="rounded-md border border-slate-300 px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:border-slate-900 hover:text-slate-900 dark:border-white/20 dark:text-slate-300 dark:hover:border-white dark:hover:text-white"
								>
									{action.label}
								</a>
							))}
						</div>
					</div>
				</div>
			</div>
		</article>
	);
}
