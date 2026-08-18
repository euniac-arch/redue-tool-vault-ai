'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
	resolveItemCategory,
	STANDARD_TO_DIAGNOSTIC_ID,
} from '@/lib/audit/categoryAggregator';
import {
	checklistReasonKind,
	resolveCheckStatus,
	resolveChecklistReasonText,
} from '@/lib/audit/checklist-reason';
import {
	CANONICAL_CATEGORY_IDS,
	earnedPointsForCheck,
	formatRawScore,
	ONPAGE_MAX_SCORE,
	type DiagnosticCategoryId,
} from '@/lib/audit/onpage-diagnostic';
import {
	auditSectionId,
	JUMP_TO_CHECKLIST_CATEGORY_EVENT,
} from '@/lib/audit/scroll-to-category';
import { HTTPS_CHECK_ID, HTTPS_RAW_POINTS } from '@/lib/audit/scoreCalculator';
import type { AuditCheckItem, AuditCheckStatus } from '@/lib/site-auditor';

const STATUS_UI: Record<
	AuditCheckStatus,
	{ badge: string; border: string; labelKey: 'pass' | 'fail' | 'warning' }
> = {
	pass: { badge: 'bg-emerald-500 text-black', border: 'border-emerald-200 dark:border-emerald-500/25', labelKey: 'pass' },
	fail: { badge: 'bg-rose-500 text-white', border: 'border-rose-200 dark:border-rose-500/30', labelKey: 'fail' },
	warning: { badge: 'bg-amber-500 text-black', border: 'border-amber-200 dark:border-amber-500/30', labelKey: 'warning' },
};

const SCORE_BADGE: Record<AuditCheckStatus, string> = {
	pass: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800',
	fail: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-800',
	warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800',
};

const CATEGORY_NAME_KEY: Record<DiagnosticCategoryId, 'security' | 'webPerf' | 'seo' | 'schema' | 'geo'> = {
	security: 'security',
	performance: 'webPerf',
	seo: 'seo',
	schema: 'schema',
	geo: 'geo',
};

interface AuditChecklistProps {
	checks: AuditCheckItem[];
	rawTechnicalScore?: number;
	maxRawScore?: number;
}

function diagnosticCategoryIdOf(item: AuditCheckItem): DiagnosticCategoryId | null {
	const standard = resolveItemCategory(item);
	return standard ? STANDARD_TO_DIAGNOSTIC_ID[standard] : null;
}

function ChecklistItemRow({ item }: { item: AuditCheckItem }) {
	const t = useTranslations('audit.checklist');
	const status = resolveCheckStatus(item.status, item.passed);
	const ui = STATUS_UI[status] ?? STATUS_UI.fail;
	const categoryId = diagnosticCategoryIdOf(item);
	const reasonKind = checklistReasonKind(item.status, item.passed);
	const reasonText = resolveChecklistReasonText(item.status, item.passed, item.why, t('whyPassBody'));
	const whyLabel = reasonKind === 'pass' ? t('whyPass') : reasonKind === 'warn' ? t('whyWarn') : t('whyFail');
	const impactLabel = reasonKind === 'pass' ? t('impactPass') : t('impact');
	const hasDetail = Boolean(reasonText || item.impact || item.evidence);
	const earned = earnedPointsForCheck(item);
	const weight =
		item.id === HTTPS_CHECK_ID ? HTTPS_RAW_POINTS : Number.isFinite(item.weight) ? item.weight : 0;
	const pointsLabel = t('points', {
		earned: formatRawScore(earned),
		weight: formatRawScore(weight),
	});

	return (
		<li
			id={`checklist-item-${item.id}`}
			data-checklist-category={categoryId ?? undefined}
			data-checklist-status={status}
			className={`rounded-xl border bg-white dark:bg-white/[0.03] ${ui.border}`}
		>
			<div className="flex w-full items-start gap-3 px-4 py-3 text-left">
				<span
					className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${ui.badge}`}
				>
					{t(ui.labelKey)}
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
						<span
							className={`shrink-0 rounded-md border px-2.5 py-0.5 text-xs font-bold tabular-nums ${SCORE_BADGE[status] ?? SCORE_BADGE.fail}`}
						>
							{status === 'fail' ? `${t('fail')} · ${pointsLabel}` : pointsLabel}
						</span>
					</div>
					{item.evidence && (
						<p className="mt-1 break-all font-mono text-[11px] text-slate-500">{item.evidence}</p>
					)}
				</div>
			</div>

			{hasDetail && (
				<div className="space-y-3 border-t border-slate-200 dark:border-white/[0.06] px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
					{item.evidence && (
						<div>
							<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{t('evidence')}</p>
							<pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-100 dark:bg-black/40 px-3 py-2 font-mono text-[11px] text-cyan-800 dark:text-cyan-200/90">
								{item.evidence}
							</pre>
						</div>
					)}
					{reasonText && (
						<div>
							<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{whyLabel}</p>
							<p className="leading-relaxed text-slate-700 dark:text-slate-300">{reasonText}</p>
						</div>
					)}
					{item.impact && (
						<div>
							<p className="mb-1 font-bold uppercase tracking-wide text-slate-500">{impactLabel}</p>
							<p className="leading-relaxed text-slate-700 dark:text-slate-300">{item.impact}</p>
						</div>
					)}
				</div>
			)}
		</li>
	);
}

export function AuditChecklist({ checks, rawTechnicalScore, maxRawScore }: AuditChecklistProps) {
	const t = useTranslations('audit.checklist');
	const tDist = useTranslations('audit.scoreDistribution');
	const [filter, setFilter] = useState<'all' | AuditCheckStatus>('all');

	useEffect(() => {
		const onJump = () => setFilter('all');
		window.addEventListener(JUMP_TO_CHECKLIST_CATEGORY_EVENT, onJump);
		return () => window.removeEventListener(JUMP_TO_CHECKLIST_CATEGORY_EVENT, onJump);
	}, []);

	const filtered = useMemo(() => {
		if (filter === 'all') return checks;
		return checks.filter((c) => resolveCheckStatus(c.status, c.passed) === filter);
	}, [checks, filter]);

	const grouped = useMemo(() => {
		const buckets = new Map<DiagnosticCategoryId | 'other', AuditCheckItem[]>();
		for (const id of CANONICAL_CATEGORY_IDS) buckets.set(id, []);
		buckets.set('other', []);
		for (const item of filtered) {
			const id = diagnosticCategoryIdOf(item) ?? 'other';
			buckets.get(id)?.push(item);
		}
		return [
			...CANONICAL_CATEGORY_IDS.map((id) => ({ id, items: buckets.get(id) ?? [] })),
			{ id: 'other' as const, items: buckets.get('other') ?? [] },
		].filter((group) => group.items.length > 0);
	}, [filtered]);

	const counts = useMemo(
		() => ({
			pass: checks.filter((c) => resolveCheckStatus(c.status, c.passed) === 'pass').length,
			fail: checks.filter((c) => resolveCheckStatus(c.status, c.passed) === 'fail').length,
			warning: checks.filter((c) => resolveCheckStatus(c.status, c.passed) === 'warning').length,
		}),
		[checks],
	);

	const officialRaw = rawTechnicalScore;
	const officialMax = maxRawScore ?? ONPAGE_MAX_SCORE;

	if (checks.length === 0) {
		return (
			<div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-4 text-sm text-slate-500">
				{t('empty')}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{officialRaw != null ? (
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm dark:border-cyan-400/30 dark:bg-cyan-500/10">
					<span className="font-bold text-cyan-900 dark:text-cyan-100">{t('totalRawLabel')}</span>
					<span className="tabular-nums font-extrabold text-cyan-900 dark:text-cyan-100">
						{t('totalRaw', { score: formatRawScore(officialRaw), max: officialMax })}
					</span>
				</div>
			) : null}
			<div className="flex flex-wrap gap-2">
				{(
					[
						['all', t('filterAll', { count: checks.length })],
						['fail', t('filterFail', { count: counts.fail })],
						['warning', t('filterWarning', { count: counts.warning })],
						['pass', t('filterPass', { count: counts.pass })],
					] as const
				).map(([value, label]) => (
					<button
						key={value}
						type="button"
						onClick={() => setFilter(value)}
						className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
							filter === value
								? 'bg-accent text-white'
								: 'border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
						}`}
					>
						{label}
					</button>
				))}
			</div>

			<div className="flex flex-col gap-4 px-0.5 py-1">
				{grouped.map((group) => {
					const isCanonical = group.id !== 'other';
					return (
						<section
							key={group.id}
							id={isCanonical ? auditSectionId(group.id) : undefined}
							data-audit-section={isCanonical ? group.id : undefined}
							data-checklist-category={isCanonical ? group.id : undefined}
							className="audit-section checklist-cat-anchor flex flex-col gap-2 rounded-xl scroll-mt-[100px]"
						>
							{isCanonical ? (
								<h5 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
									{tDist(CATEGORY_NAME_KEY[group.id])}
								</h5>
							) : null}
							<ul className="flex flex-col gap-2">
								{group.items.map((item) => (
									<ChecklistItemRow key={item.id} item={item} />
								))}
							</ul>
						</section>
					);
				})}
			</div>
		</div>
	);
}
