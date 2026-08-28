'use client';

import { forwardRef } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import {
	AI_CITATION_TIER_LABEL,
	computeMilestoneRoundFacts,
	formatKrw,
	roundFactsFromSnapshot,
} from '@/lib/audit/milestone-insights';
import { MILESTONE_ROUND_META, type MilestoneSnapshot } from '@/lib/audit/milestone-types';
import type { AuditLang } from '@/lib/site-auditor';

export interface BeforeAfterMatrixCardProps {
	round1?: MilestoneSnapshot;
	round4?: MilestoneSnapshot;
	lang?: AuditLang;
}

interface MatrixRow {
	label: string;
	before: string;
	after: string;
	positive: boolean;
}

/**
 * 4회차 탭 활성화 시 상단에 노출되는 "4주 종합 Before → After 성장 비교표".
 * 1회차(착수 전)와 4회차(최종) 스냅샷을 다시 스코어링해 비교 행을 만든다 —
 * 화면 다른 곳의 숫자와 절대 어긋나지 않도록 저장된 report/geoNarrative 원본으로 재계산한다.
 */
export const BeforeAfterMatrixCard = forwardRef<HTMLDivElement, BeforeAfterMatrixCardProps>(
	function BeforeAfterMatrixCard({ round1, round4, lang = 'ko' }, ref) {
		if (!round1?.isLocked || !round4?.isLocked) {
			return (
				<div
					ref={ref}
					className="before-after-matrix-card rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-medium text-slate-500 dark:border-white/15 dark:bg-white/[0.02] dark:text-slate-400"
				>
					1회차(착수 전)와 4회차(최종) 박제가 모두 완료되면 4주 종합 Before → After 성과표가 표시됩니다.
				</div>
			);
		}

		// 로컬 전체 리포트 캐시(`data`)가 있으면 그걸로 정확히 재계산하고, 없으면
		// Firestore에서 받아온 경량 `roundSnapshot`으로 근사 재현한다(다른 기기 등).
		const before = round1.data
			? computeMilestoneRoundFacts(round1.data, lang)
			: roundFactsFromSnapshot(round1.roundSnapshot);
		const after = round4.data
			? computeMilestoneRoundFacts(round4.data, lang)
			: roundFactsFromSnapshot(round4.roundSnapshot);
		const scoreDelta = after.measuredScore - before.measuredScore;

		const rows: MatrixRow[] = [
			{
				label: 'Schema.org',
				before: before.schemaCoverage <= 0 ? '0블록 (미적용)' : `${before.schemaCoverage}% 적용`,
				after: after.schemaCoverage >= 95 ? '100% 무결점 주입' : `${after.schemaCoverage}% 적용`,
				positive: after.schemaCoverage >= before.schemaCoverage,
			},
			{
				label: '/llms.txt',
				before: before.llmsTxtPassed ? '200 OK 정식 색인' : '404 누락',
				after: after.llmsTxtPassed ? '200 OK 정식 색인' : '404 누락',
				positive: after.llmsTxtPassed && !before.llmsTxtPassed,
			},
			{
				label: 'ChatGPT / Perplexity',
				before: AI_CITATION_TIER_LABEL[before.aiCitationTier],
				after: AI_CITATION_TIER_LABEL[after.aiCitationTier],
				positive: after.externalTrustScore >= before.externalTrustScore,
			},
			{
				label: '월간 기회 손실 (추정)',
				before: before.monthlyOpportunityLossKrw > 0 ? `월 ${formatKrw(before.monthlyOpportunityLossKrw)} 누수` : '방어 완료',
				after: after.monthlyOpportunityLossKrw <= 0 ? '100% 방어 완료' : `월 ${formatKrw(after.monthlyOpportunityLossKrw)} 누수`,
				positive: after.monthlyOpportunityLossKrw <= before.monthlyOpportunityLossKrw,
			},
		];

		return (
			<div
				ref={ref}
				className="before-after-matrix-card overflow-hidden rounded-2xl border border-[#C9A227]/35 bg-gradient-to-br from-[#C9A227]/[0.12] via-white to-white p-5 shadow-sm dark:from-[#C9A227]/[0.08] dark:via-slate-950 dark:to-slate-950"
			>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8B6914] dark:text-[#E8C547]">
							4주 종합 성과표 · {MILESTONE_ROUND_META[1].shortLabel} → {MILESTONE_ROUND_META[4].shortLabel}
						</p>
						<h3 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
							Before <ArrowRight className="mx-1 inline h-4 w-4 text-[#C9A227]" aria-hidden /> After 4주 성장 요약
						</h3>
					</div>
					<div className="flex items-center gap-2 rounded-xl bg-[#C9A227]/15 px-3 py-2">
						<TrendingUp className="h-5 w-5 text-[#8B6914] dark:text-[#E8C547]" aria-hidden />
						<span className="text-sm font-bold text-slate-700 dark:text-slate-200">
							종합 점수 {before.measuredScore}점 → {after.measuredScore}점
						</span>
						<span
							className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
								scoreDelta >= 0
									? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
									: 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
							}`}
						>
							{scoreDelta >= 0 ? '+' : ''}
							{scoreDelta}pt
						</span>
					</div>
				</div>

				<div className="mt-4 overflow-x-auto">
					<table className="w-full min-w-[520px] border-collapse text-sm">
						<thead>
							<tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
								<th className="pb-2 pr-3">항목</th>
								<th className="pb-2 pr-3">Before (1회차)</th>
								<th className="pb-2">After (4회차)</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
							{rows.map((row) => (
								<tr key={row.label}>
									<td className="py-2 pr-3 font-bold text-slate-700 dark:text-slate-200">{row.label}</td>
									<td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{row.before}</td>
									<td
										className={`py-2 font-bold ${
											row.positive ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
										}`}
									>
										{row.after}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<p className="mt-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
					월간 기회 손실은 GEO 프로 플랜 평균 사례를 바탕으로 한 참고용 추정치이며, 실제 매출 수치가 아닙니다.
				</p>
			</div>
		);
	},
);
