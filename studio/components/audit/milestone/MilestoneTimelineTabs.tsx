'use client';

import { Lock, Radio } from 'lucide-react';
import {
	MILESTONE_ROUND_META,
	MILESTONE_ROUNDS,
	type DomainMilestoneHistory,
	type MilestoneActiveRound,
	type MilestoneRound,
	type MilestoneViewMode,
} from '@/lib/audit/milestone-types';

export interface MilestoneTimelineTabsProps {
	history: DomainMilestoneHistory;
	activeRound: MilestoneActiveRound;
	onSelectRound: (round: MilestoneActiveRound) => void;
	mode: MilestoneViewMode;
	scoreByRound: Partial<Record<MilestoneRound, number>>;
}

function formatTabDate(date: string): string {
	if (!date) return '';
	const parts = date.split('-');
	if (parts.length !== 3) return date;
	return `${parts[0].slice(2)}.${parts[1]}.${parts[2]}`;
}

/**
 * 4주 회차 현황 그리드 — 데스크톱 4열 / 태블릿 2열 / 모바일 1열로 자연스럽게 브레이크다운된다.
 * 관리자 모드는 미확정 회차도 회색조로 보여주고, 고객 공유 모드는 확정(박제)된 회차만 노출한다
 * (관리자 조작 버튼 없이 읽기전용). 각 카드는 그대로 "해당 회차 결과 보기" 탭 역할도 겸한다.
 */
export function MilestoneTimelineTabs({
	history,
	activeRound,
	onSelectRound,
	mode,
	scoreByRound,
}: MilestoneTimelineTabsProps) {
	if (mode === 'user') return null;

	const visibleRounds =
		mode === 'admin'
			? MILESTONE_ROUNDS
			: MILESTONE_ROUNDS.filter((round) => history.snapshots[round]?.isLocked);

	if (mode === 'client' && visibleRounds.length === 0) return null;

	return (
		<div className="milestone-timeline-tabs no-pdf-capture print:hidden" aria-label="4주 마일스톤 회차 타임라인">
			<div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
				<p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
					회차별 진단 현황
				</p>

				{mode === 'admin' ? (
					<button
						type="button"
						onClick={() => onSelectRound('LIVE')}
						className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold transition ${
							activeRound === 'LIVE'
								? 'border-emerald-400 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/40 dark:text-emerald-300'
								: 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5'
						}`}
					>
						<Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden />
						실시간 라이브
					</button>
				) : null}
			</div>

			<div className="milestone-grid grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
				{visibleRounds.map((round) => {
					const snapshot = history.snapshots[round];
					const meta = MILESTONE_ROUND_META[round];
					const isActive = activeRound === round;
					const isLocked = Boolean(snapshot?.isLocked);
					const score = scoreByRound[round];
					const disabled = mode === 'admin' && !isLocked;

					return (
						<button
							key={round}
							type="button"
							disabled={disabled}
							onClick={() => onSelectRound(round)}
							title={isLocked ? meta.defaultTitle : `${meta.shortLabel} · 아직 박제되지 않음`}
							className={`milestone-item group flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition ${
								isActive
									? 'is-active border-[#C9A227] bg-[#C9A227]/[0.08] shadow-sm ring-1 ring-[#C9A227]/20'
									: 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]'
							} ${isLocked ? 'is-locked' : 'is-pending'} ${disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
						>
							<span className="step-label flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
								{meta.shortLabel}
								<span className="font-semibold text-slate-400 dark:text-slate-500">· {meta.dayLabel}</span>
							</span>

							{isLocked && typeof score === 'number' ? (
								<span className="status-badge status-confirmed inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
									<Lock className="h-3 w-3" aria-hidden />
									{score}점 · 확정완료
								</span>
							) : (
								<span className="status-badge status-pending inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">
									미확정
								</span>
							)}

							{isLocked && snapshot ? (
								<span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
									{formatTabDate(snapshot.date)} 박제
								</span>
							) : null}
						</button>
					);
				})}
			</div>
		</div>
	);
}
