'use client';

import { FileDown, FileStack } from 'lucide-react';
import { ReportShareLinkButton } from '@/components/audit/ReportShareLinkButton';
import type { MilestoneViewMode } from '@/lib/audit/milestone-types';

export interface MilestoneReportActionsProps {
	mode: MilestoneViewMode;
	activeRoundLabel: string;
	onDownloadCurrentPdf: () => void;
	onDownloadBeforeAfterPdf: () => void | Promise<void>;
	canDownloadBeforeAfter: boolean;
	isDownloadingBeforeAfter: boolean;
	shareUrl: string;
}

const utilityBtnClass =
	'btn-utility inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white sm:text-[13px]';

/**
 * 리포트 액션 버튼 묶음 — 현재 회차 A4 PDF / 4주 종합 Before·After 1장 PDF /
 * 고객 납품용 읽기전용 링크 복사. 고객 공유(client) 모드에서는 링크 복사 버튼을 숨긴다.
 * Secondary/Ghost 톤으로 통일해 하단 유틸리티 툴바로 정렬한다.
 */
export function MilestoneReportActions({
	mode,
	activeRoundLabel,
	onDownloadCurrentPdf,
	onDownloadBeforeAfterPdf,
	canDownloadBeforeAfter,
	isDownloadingBeforeAfter,
	shareUrl,
}: MilestoneReportActionsProps) {
	if (mode === 'user') return null;

	return (
		<div className="export-toolbar milestone-report-actions no-pdf-capture print:hidden flex flex-wrap items-center gap-2">
			<button type="button" onClick={onDownloadCurrentPdf} className={utilityBtnClass}>
				<FileDown className="h-4 w-4" aria-hidden />
				{activeRoundLabel} A4 PDF 다운로드
			</button>

			<button
				type="button"
				onClick={() => void onDownloadBeforeAfterPdf()}
				disabled={!canDownloadBeforeAfter || isDownloadingBeforeAfter}
				className={utilityBtnClass}
				title={canDownloadBeforeAfter ? undefined : '1회차·4회차 박제가 모두 완료되어야 다운로드할 수 있습니다.'}
			>
				<FileStack className="h-4 w-4" aria-hidden />
				{isDownloadingBeforeAfter ? '생성 중…' : '4주 종합 Before/After 성과표 PDF'}
			</button>

			{mode === 'admin' ? (
				<ReportShareLinkButton shareUrl={shareUrl} variant="bar" className="text-xs font-bold sm:text-[13px]" />
			) : null}
		</div>
	);
}
