'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CATEGORY_ICON, FiveCategoryCardsGrid } from '@/components/audit/FiveCategoryCardsGrid';
import { ScoreRadarChart } from '@/components/audit/ScoreRadarChart';
import { resolveChecklistReasonText } from '@/lib/audit/checklist-reason';
import {
	checkVerdict,
	formatRawScore,
	getCategoryStatusInfo,
	roundRawScore,
	type CategoryStatusInfo,
	type DiagnosticCategory,
	type DiagnosticCategoryId,
	type DiagnosticStatus,
	type OnPageDiagnosticProps,
} from '@/lib/audit/onpage-diagnostic';
import type { AuditScores } from '@/lib/audit/scoreCalculator';
import type { AuditCheckItem } from '@/lib/site-auditor';

interface CategoryScoreSectionProps {
	diagnostic: OnPageDiagnosticProps;
	scores: AuditScores;
}

const STATUS_RANK: Record<DiagnosticStatus, number> = { fail: 0, warning: 1, pass: 2 };

const BADGE_TONE: Record<DiagnosticStatus, string> = {
	pass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/25',
	warning: 'bg-amber-500/10 text-amber-800 border-amber-500/20 dark:text-amber-400 dark:border-amber-500/25',
	fail: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400 dark:border-rose-500/25',
};

const CHECK_ICON: Record<DiagnosticStatus, string> = {
	fail: '❌',
	warning: '⚠️',
	pass: '✅',
};

const CHECK_NAME: Record<DiagnosticStatus, string> = {
	fail: 'text-rose-700 dark:text-rose-300',
	warning: 'text-amber-700 dark:text-amber-300',
	pass: 'text-emerald-700 dark:text-emerald-300',
};

const CHECK_DESC: Record<DiagnosticStatus, string> = {
	fail: 'text-rose-600/80 dark:text-rose-400/80',
	warning: 'text-amber-600/80 dark:text-amber-400/80',
	pass: 'text-emerald-600/80 dark:text-emerald-400/80',
};

const CHECK_ROW: Record<DiagnosticStatus, string> = {
	fail: 'bg-rose-50/70 dark:bg-rose-950/30',
	warning: 'bg-amber-50/70 dark:bg-amber-950/30',
	pass: 'bg-slate-100/70 dark:bg-slate-800/40',
};

function recoverableRawScore(category: DiagnosticCategory): number {
	return roundRawScore(Math.max(0, category.maxScore - category.rawScore));
}

function sortChecksBySeverity(checks: readonly AuditCheckItem[]): AuditCheckItem[] {
	return [...checks].sort((a, b) => STATUS_RANK[checkVerdict(a)] - STATUS_RANK[checkVerdict(b)]);
}

function categoryScoreRatio(category: DiagnosticCategory): number {
	if (category.maxScore > 0) return category.rawScore / category.maxScore;
	return category.score100 / 100;
}

/** Lowest score ratio first; ties go to the category with the most defects. */
function defaultSelectedCategoryId(
	categories: readonly DiagnosticCategory[],
): DiagnosticCategoryId | null {
	if (categories.length === 0) return null;
	return [...categories].sort((a, b) => {
		const byRatio = categoryScoreRatio(a) - categoryScoreRatio(b);
		if (byRatio !== 0) return byRatio;
		if (b.defectCount !== a.defectCount) return b.defectCount - a.defectCount;
		if (b.warningCount !== a.warningCount) return b.warningCount - a.warningCount;
		return STATUS_RANK[a.status] - STATUS_RANK[b.status];
	})[0].id;
}

function categoryCardStatus(category: DiagnosticCategory): CategoryStatusInfo {
	return getCategoryStatusInfo(category.rawScore, category.maxScore, category.defectCount, category.warningCount);
}

function categoryStatusBadge(
	category: DiagnosticCategory,
	info: CategoryStatusInfo,
	labels: { fail: string; warning: string; pass: string; passPerfect: string; failPlain: string; warningPlain: string },
): string {
	if (info.summaryKind === 'defect' && info.summaryCount > 0) return labels.fail;
	if (info.summaryKind === 'warning' && info.summaryCount > 0) return labels.warning;
	if (info.status === 'pass' && category.score100 >= 100) return labels.passPerfect;
	if (info.status === 'pass') return labels.pass;
	if (info.status === 'warning') return labels.warningPlain;
	return labels.failPlain;
}

function checkDescription(
	check: AuditCheckItem,
	status: DiagnosticStatus,
	fallback: Record<DiagnosticStatus, string>,
): string {
	const why = resolveChecklistReasonText(check.status, check.passed, check.why, fallback.pass);
	if (why?.trim()) return why;
	if (status !== 'pass' && check.evidence?.trim()) return check.evidence;
	return fallback[status];
}

function SelectedCategoryDetailPanel({ category }: { category: DiagnosticCategory | null }) {
	const tDist = useTranslations('audit.scoreDistribution');
	const tHover = useTranslations('audit.scoreDistribution.radar.hoverCard');
	const tPanel = useTranslations('audit.scoreDistribution.radar.detailPanel');
	const fallbacks = useMemo(
		() => ({
			fail: tPanel('checkFail'),
			warning: tPanel('checkWarning'),
			pass: tPanel('checkPass'),
		}),
		[tPanel],
	);
	const sortedChecks = useMemo(
		() => (category ? sortChecksBySeverity(category.checks ?? []) : []),
		[category],
	);
	const recoverable = category ? recoverableRawScore(category) : 0;
	const selectedInfo = category ? categoryCardStatus(category) : null;

	return (
		<div
			className="flex h-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/90"
			aria-live="polite"
			role="region"
			aria-label={category?.name}
		>
			{category && selectedInfo ? (
				<>
					<div className="mb-3 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<span aria-hidden>{CATEGORY_ICON[category.id]}</span>
								<span className="text-base font-bold text-slate-900 dark:text-white">{category.name}</span>
								<span
									className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${BADGE_TONE[selectedInfo.status]}`}
								>
									{categoryStatusBadge(category, selectedInfo, {
										fail: tHover('badgeFail', { count: selectedInfo.summaryCount }),
										warning: tHover('badgeWarning', { count: selectedInfo.summaryCount }),
										pass: tHover('badgePass'),
										passPerfect: tHover('badgePassPerfect'),
										failPlain: tHover('badgeFailPlain'),
										warningPlain: tHover('badgeWarningPlain'),
									})}
								</span>
							</div>
						</div>
						<div className="shrink-0 text-right font-mono">
							<div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
								{tHover('rawScore', {
									score: formatRawScore(category.rawScore),
									max: category.maxScore,
								})}
							</div>
							<div className="text-[10px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">
								{tDist('categoryAchievement', { pct: category.score100 })}
							</div>
						</div>
					</div>

					{sortedChecks.length ? (
						<div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
							{sortedChecks.map((check) => {
								const status = checkVerdict(check);
								return (
									<div
										key={check.id}
										className={`flex items-start gap-2.5 rounded-lg p-2.5 text-xs ${CHECK_ROW[status]}`}
									>
										<span className="mt-0.5 shrink-0 text-sm" aria-hidden>
											{CHECK_ICON[status]}
										</span>
										<div className="min-w-0 flex-1">
											<span className={`font-semibold ${CHECK_NAME[status]}`}>{check.label}</span>
											<p className={`mt-0.5 leading-relaxed ${CHECK_DESC[status]}`}>
												{checkDescription(check, status, fallbacks)}
											</p>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<p className="min-h-0 flex-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
							{category.statusText || tPanel('emptyChecks')}
						</p>
					)}

					{recoverable > 0 ? (
						<div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-cyan-700 dark:border-slate-800 dark:text-cyan-400">
							<span>{tPanel('recoverable')}</span>
							<strong className="font-bold">
								{tPanel('recoverableScore', { score: formatRawScore(recoverable) })}
							</strong>
						</div>
					) : null}
				</>
			) : (
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
					<p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{tPanel('title')}</p>
					<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
						{tPanel('idleHint')}
					</p>
				</div>
			)}
		</div>
	);
}

/**
 * Single 5-axis radar + one five-category card grid.
 * Hovering a radar axis or a card activates that category (sticky — last
 * hover is kept on mouseleave) so the right-hand checklist can be scrolled.
 * Clicking a card jumps to the matching detailed-checklist section.
 */
export function CategoryScoreSection({ diagnostic, scores }: CategoryScoreSectionProps) {
	const tDist = useTranslations('audit.scoreDistribution');
	const showSecurityChip = !scores.isHttps || scores.securityCapped;
	const defaultCategoryId = useMemo(
		() => defaultSelectedCategoryId(diagnostic.categories),
		[diagnostic.categories],
	);
	const [activeCategoryId, setActiveCategoryId] = useState<DiagnosticCategoryId | null>(
		defaultCategoryId,
	);
	const resolvedActiveId =
		activeCategoryId && diagnostic.categories.some((c) => c.id === activeCategoryId)
			? activeCategoryId
			: defaultCategoryId;
	const activeCategory = diagnostic.categories.find((c) => c.id === resolvedActiveId) ?? null;
	const handleHoverCategory = useCallback((id: DiagnosticCategoryId) => {
		setActiveCategoryId((prev) => (prev === id ? prev : id));
	}, []);
	const categoryRawTotal = useMemo(
		() => roundRawScore(diagnostic.categories.reduce((sum, cat) => sum + cat.rawScore, 0)),
		[diagnostic.categories],
	);
	const categoryMaxTotal = useMemo(
		() => diagnostic.categories.reduce((sum, cat) => sum + cat.maxScore, 0),
		[diagnostic.categories],
	);

	return (
		<div className="flex flex-col gap-6">
			<div className="relative rounded-2xl border border-slate-200 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
				<div className="mb-4 flex items-center justify-between gap-3">
					<div>
						<h4 className="text-base font-bold text-slate-900 dark:text-white">
							{tDist('radar.title')}
						</h4>
						<p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
							{tDist('radar.subtitle')}
						</p>
					</div>
					{showSecurityChip ? (
						<span className="shrink-0 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
							{tDist('httpsGradeCapChip')}
						</span>
					) : null}
				</div>
				<div className="grid min-h-[380px] items-center gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
					<div className="flex items-center justify-center">
						<ScoreRadarChart
							scores={scores.radarScores}
							hideHeader
							activeCategoryId={resolvedActiveId}
							onHoverCategory={handleHoverCategory}
						/>
					</div>
					<SelectedCategoryDetailPanel category={activeCategory} />
				</div>
			</div>

			<div>
				<div className="mb-3 flex items-center justify-between gap-3">
					<h4 className="text-sm font-bold text-slate-900 dark:text-white">
						{tDist('fiveCategoryTitle')}
					</h4>
					{/* <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
						{tDist('fiveCategoryHint', {
							score: formatRawScore(scores.rawScore122),
							max: scores.maxRawScore,
							pct: scores.technicalScore,
						})}
					</p> */}
					<span
						className="shrink-0 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] tabular-nums text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-200"
						title={tDist('fiveCategoryTotalTooltip', {
							score: formatRawScore(categoryRawTotal),
							max: categoryMaxTotal,
							pct: scores.technicalScore,
						})}
					>
						<span className="font-bold">{formatRawScore(categoryRawTotal)}</span>
						<span className="font-light text-slate-400 dark:text-slate-500">{` / ${categoryMaxTotal}`}</span>
					</span>
				</div>
				<FiveCategoryCardsGrid
					categories={diagnostic.categories}
					activeCategoryId={resolvedActiveId}
					onHoverCategory={handleHoverCategory}
				/>
			</div>
		</div>
	);
}
