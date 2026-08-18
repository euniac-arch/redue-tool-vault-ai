'use client';

import { memo } from 'react';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
	capGradeAtB,
	gradeQualifierKey,
	resolveScoreGrade,
	type ScoreGrade,
} from '@/lib/audit/score-grade';

/**
 * Full literals in this .tsx file so Tailwind always emits the utilities.
 * Keep in sync with `GRADE_THEMES` in `score-grade.ts`.
 * Never use border-white / border-slate-100 / border-gray-100.
 */
const GRADE_BADGE_TW: Record<ScoreGrade, string> = {
	S: 'border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:!border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400',
	A: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:!border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
	B: 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:!border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
	'C/D': 'border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:!border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400',
};

interface ScoreGradeBadgeProps {
	score: number;
	/** Used only when `score` is not a finite number. */
	grade?: string | null;
	/** When false, S/A letters are forced down to B. */
	isHttps?: boolean;
	/** Composite was hard-capped — used only as a hint when the letter itself is already B. */
	securityCapped?: boolean;
	size?: 'sm' | 'md';
	showQualifier?: boolean;
	className?: string;
}

const SCALE_KEYS = ['S', 'A', 'B', 'CD'] as const;

/**
 * Letter-grade chip + hover scale tooltip. Shared by 외부 신뢰도 / 기술 점수
 * cards and any other headline that renders S · A · B · C/D.
 */
function ScoreGradeBadgeInner({
	score,
	grade,
	isHttps = true,
	securityCapped = false,
	size = 'sm',
	showQualifier = true,
	className = '',
}: ScoreGradeBadgeProps) {
	const t = useTranslations('audit.scoreGrade');
	const uncapped = resolveScoreGrade(score, grade);
	const resolved = isHttps ? uncapped : capGradeAtB(uncapped);
	const gradeRestricted = !isHttps && (uncapped !== resolved || (securityCapped && score >= 80));
	const badgeStyle = GRADE_BADGE_TW[resolved];
	const qualifier = t(`qualifier.${gradeQualifierKey(resolved)}`);
	const compact = size === 'sm';

	return (
		<span className={`group relative inline-flex items-center gap-1 ${className}`}>
			<span
				className={`inline-flex items-center rounded-full font-bold shadow-none ring-0 ${badgeStyle} ${
					compact ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
				}`}
				title={gradeRestricted ? t('securityCapTooltip') : undefined}
			>
				{gradeRestricted ? (
					t('securityCapLabel')
				) : (
					<>
						{t('gradeLabel', { grade: resolved })}
						{showQualifier ? <span className="ml-1 font-semibold opacity-80">· {qualifier}</span> : null}
					</>
				)}
			</span>
			<span className="relative inline-flex print:hidden">
				<button
					type="button"
					className={`inline-flex items-center justify-center rounded-full text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:text-slate-500 dark:hover:text-slate-300 ${
						compact ? 'h-4 w-4' : 'h-5 w-5'
					}`}
					aria-label={gradeRestricted ? t('securityCapTooltip') : t('tooltipAria')}
				>
					<Info className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
				</button>
				{gradeRestricted ? (
					<span
						role="tooltip"
						className="pointer-events-none invisible absolute left-1/2 top-full z-50 mt-1.5 w-[16.5rem] -translate-x-1/2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-[11px] leading-relaxed text-amber-900 opacity-0 shadow-lg ring-1 ring-black/5 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-amber-500/30 dark:bg-slate-900 dark:text-amber-200 dark:ring-white/10"
					>
						{t('securityCapTooltip')}
					</span>
				) : (
					<GradeScaleTooltip title={t('scaleTitle')} rows={SCALE_KEYS.map((key) => t(`scale.${key}`))} />
				)}
			</span>
		</span>
	);
}

export const ScoreGradeBadge = memo(ScoreGradeBadgeInner);

function GradeScaleTooltip({ title, rows }: { title: string; rows: string[] }) {
	return (
		<span
			role="tooltip"
			className="pointer-events-none invisible absolute left-1/2 top-full z-50 mt-1.5 w-[15.5rem] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[11px] leading-relaxed text-slate-700 opacity-0 shadow-lg ring-1 ring-black/5 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:ring-white/10"
		>
			<span className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
				{title}
			</span>
			<span className="flex flex-col gap-0.5">
				{rows.map((row) => (
					<span key={row}>{row}</span>
				))}
			</span>
		</span>
	);
}
