'use client';

import { AlertCircle, Radio } from 'lucide-react';
import type { RoundSnapshot } from '@/lib/audit/round-tracking-types';

export interface RoundSnapshotSummaryCardProps {
	snapshot: RoundSnapshot;
	onBackToLive?: () => void;
}

function formatSavedAt(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * `MilestoneSnapshot.data`(브라우저 로컬 전체 리포트 캐시)가 없을 때 — 다른 기기에서
 * 열람했거나 로컬 캐시가 정리된 경우 — 전체 리포트(`AuditReportDocument`) 대신
 * 렌더링되는 경량 요약 카드. Firestore `audit_tracking`에서 받아온 `roundSnapshot`
 * 만으로 이 회차의 점수/핵심 메트릭을 안전하게 보여준다.
 */
export function RoundSnapshotSummaryCard({ snapshot, onBackToLive }: RoundSnapshotSummaryCardProps) {
	const scoreRows: Array<{ label: string; value: number }> = [
		{ label: '종합 실측 점수', value: snapshot.scores.total },
		{ label: 'SEO', value: snapshot.scores.seo },
		{ label: 'AEO (AI 인용)', value: snapshot.scores.aeo },
		{ label: 'GEO', value: snapshot.scores.geo },
		{ label: 'Schema', value: snapshot.scores.schema },
	];

	const metricBadges: Array<{ label: string; active: boolean }> = [
		{ label: '/llms.txt', active: snapshot.metrics.hasLlmsTxt },
		{ label: 'FAQ/HowTo 스키마', active: snapshot.metrics.hasFaqSchema },
		{ label: 'Speakable', active: snapshot.metrics.hasSpeakable },
	];

	return (
		<div className="round-snapshot-summary-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
						{snapshot.roundLabel} · {formatSavedAt(snapshot.savedAt)} 박제
					</p>
					<h3 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
						{snapshot.scores.total}점 <span className="text-sm font-bold text-slate-400">· {snapshot.scores.grade}</span>
					</h3>
				</div>
				{onBackToLive ? (
					<button
						type="button"
						onClick={onBackToLive}
						className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-extrabold text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
					>
						<Radio className="h-3.5 w-3.5" aria-hidden />
						실시간 라이브로 이동
					</button>
				) : null}
			</div>

			<div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
				<AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
				<span>
					이 회차의 상세 리포트(체크리스트/근거)는 이 브라우저에 캐시되어 있지 않아 핵심 점수 요약만
					표시합니다 — 점수 데이터는 서버에 안전하게 보존되어 있습니다.
				</span>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
				{scoreRows.map((row) => (
					<div
						key={row.label}
						className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]"
					>
						<p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{row.label}</p>
						<p className="mt-1 text-base font-extrabold text-slate-800 dark:text-slate-100">{row.value}</p>
					</div>
				))}
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-2">
				<span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
					이미지 Alt 커버리지 {snapshot.metrics.altCoverageRate}% (미적용 {snapshot.metrics.altMissingCount}건)
				</span>
			</div>

			<div className="mt-2 flex flex-wrap gap-1.5">
				{metricBadges.map((badge) => (
					<span
						key={badge.label}
						className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
							badge.active
								? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
								: 'bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500'
						}`}
					>
						{badge.active ? '✓' : '✕'} {badge.label}
					</span>
				))}
				{snapshot.metrics.detectedSchemas.length > 0 ? (
					<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">
						스키마 {snapshot.metrics.detectedSchemas.length}종 감지
					</span>
				) : null}
			</div>
		</div>
	);
}
