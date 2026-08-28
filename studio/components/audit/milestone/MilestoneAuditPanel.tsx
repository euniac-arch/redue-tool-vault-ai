'use client';

import { useRef, useState } from 'react';
import { CalendarClock, Eye } from 'lucide-react';
import { AdminSnapshotLockBar } from '@/components/audit/milestone/AdminSnapshotLockBar';
import { BeforeAfterMatrixCard } from '@/components/audit/milestone/BeforeAfterMatrixCard';
import { MilestoneReportActions } from '@/components/audit/milestone/MilestoneReportActions';
import { MilestoneTimelineTabs } from '@/components/audit/milestone/MilestoneTimelineTabs';
import { SaveStatusToast } from '@/components/audit/milestone/SaveStatusToast';
import { downloadBeforeAfterSummaryPdf } from '@/lib/audit/milestone-pdf';
import {
	MILESTONE_ROUND_META,
	type DomainMilestoneHistory,
	type MilestoneActiveRound,
	type MilestoneRound,
	type MilestoneViewMode,
} from '@/lib/audit/milestone-types';
import type { AuditLang } from '@/lib/site-auditor';

export interface MilestoneAuditPanelProps {
	domain: string;
	mode: MilestoneViewMode;
	history: DomainMilestoneHistory;
	activeRound: MilestoneActiveRound;
	onSelectRound: (round: MilestoneActiveRound) => void;
	scoreByRound: Partial<Record<MilestoneRound, number>>;
	isLocking: boolean;
	lockError: string | null;
	lastLockedRound: MilestoneRound | null;
	onLockRound: (round: MilestoneRound) => void | Promise<void>;
	onDownloadCurrentPdf: () => void;
	shareUrl: string;
	lang?: AuditLang;
}

function activeRoundLabel(activeRound: MilestoneActiveRound): string {
	if (activeRound === 'LIVE') return '실시간 라이브';
	return MILESTONE_ROUND_META[activeRound].shortLabel;
}

/**
 * 진단 결과 화면(AuditResultView) 상단 통합 패널 — 도메인명, 마일스톤 타임라인 탭,
 * (관리자) 원클릭 박제 컨트롤러, (4회차) Before/After 성과표, 리포트 액션 버튼을 한데 묶는다.
 * 일반/무료 사용자 모드에서는 아무것도 렌더링하지 않는다(단일 실시간 결과만 노출).
 */
export function MilestoneAuditPanel({
	domain,
	mode,
	history,
	activeRound,
	onSelectRound,
	scoreByRound,
	isLocking,
	lockError,
	lastLockedRound,
	onLockRound,
	onDownloadCurrentPdf,
	shareUrl,
	lang = 'ko',
}: MilestoneAuditPanelProps) {
	const beforeAfterRef = useRef<HTMLDivElement>(null);
	const [isDownloadingBeforeAfter, setIsDownloadingBeforeAfter] = useState(false);

	if (mode === 'user') return null;

	const successLabel =
		!isLocking && !lockError && lastLockedRound ? MILESTONE_ROUND_META[lastLockedRound].shortLabel : null;

	const round1 = history.snapshots[1];
	const round4 = history.snapshots[4];
	const canDownloadBeforeAfter = Boolean(round1?.isLocked && round4?.isLocked);

	async function handleDownloadBeforeAfter() {
		if (!canDownloadBeforeAfter || isDownloadingBeforeAfter) return;
		setIsDownloadingBeforeAfter(true);
		try {
			await downloadBeforeAfterSummaryPdf(beforeAfterRef.current);
		} finally {
			setIsDownloadingBeforeAfter(false);
		}
	}

	return (
		<section
			className="milestone-geo-card milestone-audit-panel no-pdf-capture print:hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-slate-950/40 dark:shadow-none"
			aria-label="4주 마일스톤 진단 추적"
		>
			{/* Header */}
			<div className="milestone-header flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-white/5 sm:px-5 sm:py-4">
				<div className="header-left flex flex-wrap items-center gap-2.5">
					<span className="badge-accent inline-flex items-center gap-1 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/10 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#8B6914] dark:border-[#E8C547]/25 dark:bg-[#E8C547]/10 dark:text-[#E8C547]">
						<CalendarClock className="h-3 w-3" aria-hidden />
						GEO 프로
					</span>
					<h2 className="title text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-base">
						4주 집중 마일스톤
					</h2>
					<span className="domain-tag inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-500 dark:bg-white/5 dark:text-slate-400">
						{domain}
					</span>
				</div>
				{mode === 'client' ? (
					<span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
						<Eye className="h-3.5 w-3.5" aria-hidden />
						읽기 전용 · 고객 공유 뷰
					</span>
				) : null}
			</div>

			{/* Body */}
			<div className="flex flex-col gap-4 px-4 py-4 sm:px-5 sm:py-5">
				<MilestoneTimelineTabs
					history={history}
					activeRound={activeRound}
					onSelectRound={onSelectRound}
					mode={mode}
					scoreByRound={scoreByRound}
				/>

				{mode === 'admin' ? (
					<AdminSnapshotLockBar
						history={history}
						activeRound={activeRound}
						onLock={onLockRound}
						isLocking={isLocking}
						lockError={lockError}
						lastLockedRound={lastLockedRound}
					/>
				) : null}

				{activeRound === 4 ? (
					<BeforeAfterMatrixCard ref={beforeAfterRef} round1={round1} round4={round4} lang={lang} />
				) : null}
			</div>

			{/* Footer utility/report toolbar */}
			<div className="export-toolbar border-t border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-white/5 dark:bg-white/[0.015] sm:px-5 sm:py-3.5">
				<MilestoneReportActions
					mode={mode}
					activeRoundLabel={activeRoundLabel(activeRound)}
					onDownloadCurrentPdf={onDownloadCurrentPdf}
					onDownloadBeforeAfterPdf={handleDownloadBeforeAfter}
					canDownloadBeforeAfter={canDownloadBeforeAfter}
					isDownloadingBeforeAfter={isDownloadingBeforeAfter}
					shareUrl={shareUrl}
				/>
			</div>

			{mode === 'admin' ? (
				<SaveStatusToast isSaving={isLocking} successLabel={successLabel} error={lockError} />
			) : null}
		</section>
	);
}
