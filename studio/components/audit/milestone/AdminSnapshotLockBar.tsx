'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, Pin } from 'lucide-react';
import {
	MILESTONE_ROUNDS,
	MILESTONE_ROUND_META,
	type DomainMilestoneHistory,
	type MilestoneActiveRound,
	type MilestoneRound,
} from '@/lib/audit/milestone-types';

export interface AdminSnapshotLockBarProps {
	history: DomainMilestoneHistory;
	activeRound: MilestoneActiveRound;
	onLock: (round: MilestoneRound) => void | Promise<void>;
	isLocking: boolean;
	lockError: string | null;
	lastLockedRound: MilestoneRound | null;
}

function firstUnlockedRound(history: DomainMilestoneHistory): MilestoneRound {
	return MILESTONE_ROUNDS.find((round) => !history.snapshots[round]?.isLocked) ?? 1;
}

/**
 * 관리자 전용 원클릭 회차 박제 컨트롤러.
 * 실시간 라이브로 수십 번 재진단을 돌리다가, 특정 시점의 결과를 원하는 회차 슬롯에
 * 타임스탬프와 함께 영구 저장한다 — 항상 "현재 실시간 진단 결과" 기준으로 확정된다.
 */
export function AdminSnapshotLockBar({
	history,
	activeRound,
	onLock,
	isLocking,
	lockError,
	lastLockedRound,
}: AdminSnapshotLockBarProps) {
	const [selectedRound, setSelectedRound] = useState<MilestoneRound>(() => firstUnlockedRound(history));
	const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);
	const [justLocked, setJustLocked] = useState<MilestoneRound | null>(null);

	// 새 도메인을 열람할 때마다 다음으로 확정할 회차를 다시 추천해준다.
	useEffect(() => {
		setSelectedRound(firstUnlockedRound(history));
		setConfirmingOverwrite(false);
	}, [history.domain]);

	useEffect(() => {
		if (lastLockedRound == null) return;
		setJustLocked(lastLockedRound);
		setConfirmingOverwrite(false);
		const timer = window.setTimeout(() => setJustLocked(null), 4000);
		return () => window.clearTimeout(timer);
	}, [lastLockedRound]);

	const selectedSnapshot = history.snapshots[selectedRound];
	const isOverwrite = Boolean(selectedSnapshot?.isLocked);

	const helperText = useMemo(() => {
		if (activeRound !== 'LIVE') {
			return '⚠️ 지금은 과거 회차를 보고 있습니다 — 확정은 항상 "현재 실시간 진단 결과" 기준으로 저장됩니다.';
		}
		return '현재 실시간 진단 결과를 선택한 회차 슬롯에 타임스탬프와 함께 영구 저장합니다.';
	}, [activeRound]);

	async function handleClick() {
		if (isOverwrite && !confirmingOverwrite) {
			setConfirmingOverwrite(true);
			return;
		}
		await onLock(selectedRound);
	}

	return (
		<div className="admin-snapshot-lock-bar snapshot-control-panel no-pdf-capture print:hidden flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-white/10 dark:bg-white/[0.025] sm:p-4">
			<div className="control-desc">
				<h4 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 sm:text-sm">
					실시간 라이브박제 대상 회차 선택
				</h4>
				<p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{helperText}</p>
			</div>

			<div className="flex flex-col gap-2.5">
				{/* 회차 선택 세그먼트 — 1~4회차를 항상 한 줄에 고정 */}
				<div
					className="segment-group grid w-full grid-cols-4 gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-slate-900/60"
					role="tablist"
					aria-label="박제 대상 회차 선택"
				>
					{MILESTONE_ROUNDS.map((round) => {
						const meta = MILESTONE_ROUND_META[round];
						const isLocked = Boolean(history.snapshots[round]?.isLocked);
						const isSelected = selectedRound === round;
						return (
							<button
								key={round}
								type="button"
								role="tab"
								aria-selected={isSelected}
								onClick={() => {
									setSelectedRound(round);
									setConfirmingOverwrite(false);
								}}
								className={`segment-btn inline-flex min-w-0 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-bold leading-none transition sm:gap-1.5 sm:px-2 sm:text-xs ${
									isSelected
										? 'is-active bg-[#C9A227] text-white shadow-sm'
										: 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
								}`}
							>
								{isLocked ? (
									<Lock className={`h-3 w-3 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} aria-hidden />
								) : null}
								<span className="whitespace-nowrap">{meta.shortLabel} · {meta.dayLabel}</span>
							</button>
						);
					})}
				</div>

				{/* 메인 실행 버튼 — 문구가 두 줄로 접히지 않도록 한 줄 고정 */}
				<button
					type="button"
					onClick={() => void handleClick()}
					disabled={isLocking}
					className={`btn-primary-action inline-flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
						confirmingOverwrite ? 'bg-rose-600 hover:bg-rose-500' : 'bg-[#C9A227] hover:bg-[#B8901F]'
					}`}
				>
					<Pin className="h-4 w-4 shrink-0" aria-hidden />
					{isLocking
						? '확정 중…'
						: confirmingOverwrite
							? '⚠️ 기존 데이터를 덮어쓰고 재확정'
							: '현재 진단 결과를 선택 회차로 확정 / 박제'}
				</button>
			</div>

			<div className="flex min-h-[1rem] flex-wrap items-center gap-2 text-xs">
				{confirmingOverwrite ? (
					<button
						type="button"
						onClick={() => setConfirmingOverwrite(false)}
						className="font-semibold text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
					>
						취소
					</button>
				) : null}
				{lockError ? (
					<span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
						<AlertTriangle className="h-3.5 w-3.5" aria-hidden />
						{lockError}
					</span>
				) : justLocked ? (
					<span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
						<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
						{MILESTONE_ROUND_META[justLocked].shortLabel} 박제 완료
					</span>
				) : null}
			</div>
		</div>
	);
}
