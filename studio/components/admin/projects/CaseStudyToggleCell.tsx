'use client';

import type { CaseStudyType } from '@/lib/projects';

const CASE_STUDY_TYPE_OPTIONS: { value: CaseStudyType; label: string }[] = [
	{ value: 'verified', label: '실제 실증 (Verified Real Case)' },
	{ value: 'simulation', label: '업종별 시뮬레이션' },
];

interface CaseStudyToggleCellProps {
	isCaseStudy: boolean;
	caseStudyType: CaseStudyType | null;
	pending: boolean;
	/** True for local-only (not yet synced) rows — toggle stays disabled. */
	disabled?: boolean;
	onToggle: (next: boolean) => void;
	onTypeChange: (next: CaseStudyType) => void;
}

/**
 * [도입사례 공개] toggle switch + [사례 유형] select, used inside each project
 * row of the admin "전체 프로젝트 관리" list. The select is disabled whenever
 * the toggle is OFF (or the row is pending / local-only).
 */
export function CaseStudyToggleCell({
	isCaseStudy,
	caseStudyType,
	pending,
	disabled,
	onToggle,
	onTypeChange,
}: CaseStudyToggleCellProps) {
	const selectDisabled = disabled || pending || !isCaseStudy;

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800/60">
			<div className="flex items-center gap-1.5">
				<span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">도입사례 공개</span>
				<button
					type="button"
					role="switch"
					aria-checked={isCaseStudy}
					aria-label="도입사례 공개 토글"
					disabled={disabled || pending}
					onClick={() => onToggle(!isCaseStudy)}
					className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border-0 p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
						isCaseStudy ? 'bg-cyan-600' : 'bg-slate-300 dark:bg-slate-600'
					}`}
				>
					<span
						className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
							isCaseStudy ? 'translate-x-4' : 'translate-x-0'
						}`}
					/>
				</button>
			</div>

			<select
				value={caseStudyType ?? 'simulation'}
				disabled={selectDisabled}
				onChange={(event) => onTypeChange(event.target.value as CaseStudyType)}
				aria-label="사례 유형"
				className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-900/40"
			>
				{CASE_STUDY_TYPE_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	);
}
