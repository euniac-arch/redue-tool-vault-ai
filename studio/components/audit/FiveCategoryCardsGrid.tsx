'use client';

import { memo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AUDIT_STATUS_BADGE } from '@/lib/audit/auditScoreCalculator';
import {
	formatRawScore,
	getCategoryStatusInfo,
	type CategoryStatusInfo,
	type DiagnosticCategory,
	type DiagnosticCategoryId,
	type DiagnosticStatus,
} from '@/lib/audit/onpage-diagnostic';
import { scrollToCategory } from '@/lib/audit/scroll-to-category';

export const CATEGORY_ICON: Record<DiagnosticCategoryId, string> = {
	security: '🔒',
	performance: '⚡',
	seo: '🔎',
	schema: '🧩',
	geo: '🤖',
};

const STATUS_PILL: Record<DiagnosticStatus, string> = {
	pass: `${AUDIT_STATUS_BADGE.good.bg} ${AUDIT_STATUS_BADGE.good.text} ${AUDIT_STATUS_BADGE.good.border}`,
	warning: `${AUDIT_STATUS_BADGE.warning.bg} ${AUDIT_STATUS_BADGE.warning.text} ${AUDIT_STATUS_BADGE.warning.border}`,
	fail: `${AUDIT_STATUS_BADGE.poor.bg} ${AUDIT_STATUS_BADGE.poor.text} ${AUDIT_STATUS_BADGE.poor.border}`,
};

const CARD_IDLE: Record<DiagnosticStatus, string> = {
	pass: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-emerald-300 hover:bg-emerald-50/60 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30',
	warning: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-amber-300 hover:bg-amber-50/60 dark:hover:border-amber-700 dark:hover:bg-amber-950/30',
	fail: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:border-rose-300 hover:bg-rose-50/60 dark:hover:border-rose-700 dark:hover:bg-rose-950/30',
};

/** Sticky-hover active face — same 양호 / 주의 / 미흡 tones as CARD_IDLE hover. */
const CARD_ACTIVE: Record<DiagnosticStatus, string> = {
	pass: 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-500/25 dark:border-emerald-700 dark:bg-emerald-950/30',
	warning: 'border-amber-300 bg-amber-50/60 ring-1 ring-amber-500/25 dark:border-amber-700 dark:bg-amber-950/30',
	fail: 'border-rose-300 bg-rose-50/60 ring-1 ring-rose-500/25 dark:border-rose-700 dark:bg-rose-950/30',
};

interface FiveCategoryCardsGridProps {
	categories: readonly DiagnosticCategory[];
	activeCategoryId?: DiagnosticCategoryId | null;
	/** Sticky hover: activate immediately; do not reset on mouseleave. */
	onHoverCategory?: (id: DiagnosticCategoryId) => void;
	onSelectCategory?: (id: DiagnosticCategoryId) => void;
}

function categoryFooterLabel(
	info: CategoryStatusInfo,
	tOnpage: ReturnType<typeof useTranslations>,
): string {
	if (info.summaryKind === 'defect' && info.summaryCount > 0) {
		return tOnpage('defectOnly', { count: info.summaryCount });
	}
	if (info.summaryKind === 'warning' && info.summaryCount > 0) {
		return tOnpage('warnOnly', { count: info.summaryCount });
	}
	if (info.status === 'pass') return `${tOnpage('statusHint.pass')} ✓`;
	if (info.status === 'warning') return tOnpage('rateHint.warning');
	return tOnpage('rateHint.fail');
}

function CategoryFooterSummary({
	info,
	canJump,
	jumpAria,
	onJump,
}: {
	info: CategoryStatusInfo;
	canJump: boolean;
	jumpAria?: string;
	onJump?: () => void;
}) {
	const tOnpage = useTranslations('audit.onpageDiagnostic');
	const label = categoryFooterLabel(info, tOnpage);

	if (info.summaryKind === 'pass') {
		return <span className="font-medium text-emerald-600 dark:text-emerald-400">{label}</span>;
	}

	const tone =
		info.summaryKind === 'defect'
			? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60'
			: 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/60';

	if (!canJump || !onJump) {
		return <span className={`font-medium ${tone}`}>{label}</span>;
	}

	return (
		<button
			type="button"
			className={`-mx-1 inline-flex cursor-pointer items-center gap-0.5 rounded-md px-1 py-0.5 font-medium underline-offset-2 transition-colors hover:underline ${tone}`}
			aria-label={jumpAria}
			title={jumpAria}
			onClick={(event) => {
				event.stopPropagation();
				onJump();
			}}
		>
			{label}
			<ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
		</button>
	);
}

function FiveCategoryCardsGridInner({
	categories,
	activeCategoryId = null,
	onHoverCategory,
	onSelectCategory,
}: FiveCategoryCardsGridProps) {
	const tDist = useTranslations('audit.scoreDistribution');
	const tOnpage = useTranslations('audit.onpageDiagnostic');
	const interactive = Boolean(onHoverCategory || onSelectCategory);

	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
			{categories.map((cat) => {
				const info = getCategoryStatusInfo(cat.rawScore, cat.maxScore, cat.defectCount, cat.warningCount);
				const hasIssues = cat.defectCount > 0 || cat.warningCount > 0;
				const isActive = activeCategoryId === cat.id;
				const jumpAria = hasIssues
					? info.summaryKind === 'defect' && cat.defectCount > 0
						? tOnpage('jumpToDefects', { count: cat.defectCount })
						: tOnpage('jumpToWarnings', { count: cat.warningCount })
					: undefined;
				const activateCategory = () => {
					onHoverCategory?.(cat.id);
					onSelectCategory?.(cat.id);
				};
				const jumpToChecklist = () => {
					activateCategory();
					scrollToCategory(cat.id);
				};

				return (
					<div
						key={cat.id}
						data-category-id={cat.id}
						className="p-1"
						tabIndex={interactive ? 0 : undefined}
						aria-pressed={interactive ? isActive : undefined}
						aria-label={interactive ? cat.name : undefined}
						onMouseEnter={interactive ? activateCategory : undefined}
						onClick={interactive ? jumpToChecklist : undefined}
						onKeyDown={
							interactive
								? (event) => {
										if (event.target !== event.currentTarget) return;
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											jumpToChecklist();
										}
									}
								: undefined
						}
					>
						<div
							className={`group flex h-full flex-col justify-between rounded-xl border p-4 transition-all duration-200 print:pointer-events-none ${
								interactive ? 'cursor-pointer' : ''
							} ${
								interactive && isActive ? CARD_ACTIVE[info.status] : CARD_IDLE[info.status]
							}`}
						>
							<div className="flex items-center justify-between">
								<span className="text-base" aria-hidden>
									{CATEGORY_ICON[cat.id] ?? '•'}
								</span>
								<span
									className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_PILL[info.status]}`}
								>
									{tOnpage(`status.${info.status}`)}
								</span>
							</div>

							<div className="my-2">
								<div className="truncate text-xs font-bold text-slate-700 dark:text-slate-300">{cat.name}</div>
								<div className="mt-1 flex items-baseline gap-1">
									<span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
										{formatRawScore(cat.rawScore)}
									</span>
									<span className="text-xs font-semibold text-slate-500">
										{tDist('categoryRawMax', { max: cat.maxScore })}
									</span>
								</div>
								<p className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
									{tDist('categoryAchievement', { pct: cat.score100 })}
								</p>
							</div>

							<div className="border-t border-slate-200 pt-2 text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
								<CategoryFooterSummary
									info={info}
									canJump={hasIssues}
									jumpAria={jumpAria}
									onJump={hasIssues ? jumpToChecklist : undefined}
								/>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}

export const FiveCategoryCardsGrid = memo(FiveCategoryCardsGridInner);
