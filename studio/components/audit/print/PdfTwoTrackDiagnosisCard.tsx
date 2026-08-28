'use client';

import { useTranslations } from 'next-intl';
import type { DiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { PrintSectionBoundary } from '@/components/audit/print/pdf-print-shared';
import {
	capGradeAtB,
	gradeQualifierKey,
	resolveScoreGrade,
	type ScoreGrade,
} from '@/lib/audit/score-grade';

interface PdfTwoTrackDiagnosisCardProps {
	scoreSnapshot?: DiagnosisScoreSnapshot | null;
	/** True once a real PSI snapshot has landed — false while CWV is an on-page fallback. */
	cwvMeasured?: boolean;
}

const GRADE_CHIP: Record<ScoreGrade, string> = {
	S: 'border-indigo-200 bg-indigo-50 text-indigo-800',
	A: 'border-emerald-200 bg-emerald-50 text-emerald-800',
	B: 'border-amber-200 bg-amber-50 text-amber-800',
	'C/D': 'border-rose-200 bg-rose-50 text-rose-700',
};

function sslNoticeKey(technicalScore: number, isHttps: boolean, securityCapped: boolean) {
	if (!isHttps || securityCapped) return 'sslMissing' as const;
	if (technicalScore >= 85 && technicalScore < 100) return 'sslSafeLine' as const;
	if (technicalScore < 85) return 'sslBelow' as const;
	return 'sslComplete' as const;
}

function PrintGradeChip({
	score,
	isHttps,
	securityCapped = false,
	grade,
}: {
	score: number;
	isHttps: boolean;
	securityCapped?: boolean;
	grade?: string | null;
}) {
	const t = useTranslations('audit.scoreGrade');
	const uncapped = resolveScoreGrade(score, grade);
	const resolved = isHttps ? uncapped : capGradeAtB(uncapped);
	const restricted = !isHttps && (uncapped !== resolved || (securityCapped && score >= 80));
	const qualifier = t(`qualifier.${gradeQualifierKey(resolved)}`);

	return (
		<span
			className={`inline-flex max-w-full flex-wrap items-center rounded-full border px-2.5 py-1 text-[9.5px] font-bold leading-none ${GRADE_CHIP[resolved]}`}
		>
			{restricted ? t('securityCapLabel') : `${t('gradeLabel', { grade: resolved })} · ${qualifier}`}
		</span>
	);
}

/**
 * Always-mounted print twin of the dashboard 3-track card.
 * Light palette + shrink-to-A4 layout so html2canvas never clips the scores.
 */
function clampScore(value: unknown): number {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(100, Math.round(n)));
}

export function PdfTwoTrackDiagnosisCard({
	scoreSnapshot,
	cwvMeasured = true,
}: PdfTwoTrackDiagnosisCardProps) {
	const t = useTranslations('audit.twoTrack');
	const heading = useTranslations('audit.pdfReport.twoTrack');
	const snapshot: Partial<DiagnosisScoreSnapshot> = scoreSnapshot ?? {};
	const scores = snapshot.scores;
	const breakdown = snapshot.scoreBreakdown ?? scores?.scoreBreakdown;
	const track1Score = clampScore(
		snapshot.technicalScore ?? scores?.technicalScore ?? breakdown?.track1,
	);
	const track2Score = clampScore(
		snapshot.externalTrustScore ?? scores?.geoScore ?? breakdown?.track2,
	);
	const track3Score = clampScore(breakdown?.coreWebVitals);
	const isHttps = snapshot.isHttps ?? scores?.isHttps ?? true;
	const securityCapped = snapshot.securityCapped ?? scores?.securityCapped ?? false;
	const sslKey = sslNoticeKey(track1Score, isHttps, securityCapped);
	const topSpecAchieved = isHttps && track1Score >= 95;

	const tracks = [
		{
			id: 'track1',
			label: t('track1.label'),
			title: t('track1.title'),
			weight: t('track1.weightBadge'),
			score: track1Score,
			scoreClass: 'text-sky-700',
			barClass: 'bg-indigo-500',
			labelClass: 'text-indigo-700',
			badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
			cardClass: 'border-cyan-200 bg-cyan-50/80',
			body: t(`track1.${sslKey}`),
			percentile: snapshot.technicalPercentile ?? scores?.technicalPercentile ?? null,
			grade: (
				<PrintGradeChip
					score={track1Score}
					isHttps={isHttps}
					securityCapped={securityCapped}
				/>
			),
		},
		{
			id: 'track2',
			label: t('track2.label'),
			title: t('track2.title'),
			weight: t('track2.weightBadge'),
			score: track2Score,
			scoreClass: 'text-purple-700',
			barClass: 'bg-violet-500',
			labelClass: 'text-violet-700',
			badgeClass: 'border-violet-200 bg-violet-50 text-violet-700',
			cardClass: 'border-violet-200 bg-violet-50/80',
			body: t('track2.body'),
			percentile: snapshot.geoPercentile ?? scores?.geoPercentile ?? null,
			grade: (
				<PrintGradeChip
					score={track2Score}
					grade={snapshot.geoGrade ?? null}
					isHttps={isHttps}
				/>
			),
		},
		{
			id: 'track3',
			label: t('track3.label'),
			title: t('track3.title'),
			weight: t('track3.weightBadge'),
			score: track3Score,
			scoreClass: 'text-emerald-700',
			barClass: 'bg-emerald-500',
			labelClass: 'text-emerald-700',
			badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
			cardClass: 'border-emerald-200 bg-emerald-50/80',
			body: cwvMeasured ? t('track3.body') : t('track3.bodyFallback'),
			percentile: null as number | null,
			grade: <PrintGradeChip score={track3Score} isHttps={isHttps} />,
		},
	] as const;

	return (
		<PrintSectionBoundary>
		<section
			id="sec-pdf-two-track"
			className="pdf-print-only pdf-page-item pdf-a4-fit audit-report-section box-border w-full max-w-full overflow-visible rounded-2xl border border-slate-200 bg-white"
		>
			<div className="box-border flex w-full max-w-full items-start gap-2.5 border-b border-slate-200 bg-slate-50 px-3.5 py-3">
				<span className="pdf-bg-gold-light pdf-text-gold flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold leading-none">
					3
				</span>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<div className="flex flex-col gap-0.5">
						<p className="pdf-text-gold text-[10px] font-bold uppercase leading-none tracking-[0.16em]">
							{heading('eyebrow')}
						</p>
						<h2 className="text-base font-extrabold leading-tight text-slate-900">{t('title')}</h2>
					</div>
					<p className="text-[10px] leading-relaxed break-words text-slate-500">{t('subtitle')}</p>
					<p
						className={`inline-flex w-fit max-w-full flex-wrap items-center rounded-full border px-2.5 py-1 text-[9.5px] font-extrabold leading-none ${
							topSpecAchieved
								? 'border-emerald-200 bg-emerald-50 text-emerald-700'
								: 'border-indigo-200 bg-indigo-50 text-indigo-700'
						}`}
					>
						{topSpecAchieved ? t('badgeAchieved') : t('badgeTarget')}
					</p>
				</div>
			</div>

			<div className="pdf-two-track-grid box-border grid w-full max-w-full grid-cols-3 items-start gap-2 overflow-visible p-3">
				{tracks.map((track) => (
					<article
						key={track.id}
						className={`box-border flex min-w-0 max-w-full flex-col justify-start gap-y-1.5 overflow-visible rounded-xl border p-3.5 ${track.cardClass}`}
					>
						<div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
							<p className={`text-[10px] font-bold leading-none tracking-wide ${track.labelClass}`}>
								{track.label}
							</p>
							<span
								className={`rounded-full border px-2 py-0.5 text-[9px] font-bold leading-none ${track.badgeClass}`}
							>
								{track.weight}
							</span>
						</div>
						<p className="text-[10px] font-semibold leading-snug break-words text-slate-500">
							{track.title}
						</p>
						<div className="flex min-w-0 flex-wrap items-end gap-1">
							<span className={`text-[26px] font-extrabold leading-none tabular-nums ${track.scoreClass}`}>
								{track.score}
							</span>
							<span className="text-[10px] font-semibold leading-none text-slate-400">{t('scoreSuffix')}</span>
						</div>
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
							<div
								className={`h-full rounded-full ${track.barClass}`}
								style={{ width: `${Math.min(100, Math.max(track.score, 2))}%` }}
							/>
						</div>
						<div className="flex min-w-0 flex-col items-start gap-1">
							{track.grade}
							{track.percentile != null ? (
								<span className="rounded-full bg-white/90 px-2 py-1 text-[9.5px] font-bold leading-none text-slate-600">
									{t('percentile', { percentile: track.percentile })}
								</span>
							) : null}
						</div>
						<p className="text-[9.5px] leading-relaxed break-words text-slate-600">{track.body}</p>
					</article>
				))}
			</div>
		</section>
		</PrintSectionBoundary>
	);
}
