import {
	auditStatusToStored,
	CATEGORY_TO_DIAGNOSTIC_ID,
} from '@/lib/audit/auditScoreCalculator';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { resolveReportTrack3Score } from '@/lib/audit/pagespeed';
import { resolveAuditScoreFromReport } from '@/lib/audit/resolveAuditScore';
import type { ScoreGrade } from '@/lib/audit/score-grade';
import type { AuditOverallStatus, AuditReport } from '@/lib/site-auditor';

/**
 * Lightweight list row — enough for history UI without storing the full report twice.
 * Server-safe: no localStorage / window. API routes must import from here, not
 * `@/lib/audit-history-storage` (that module pulls browser-only bookkeeping).
 */
export interface AuditHistoryEntry {
	id: string;
	url: string;
	score: number;
	maxScore: number;
	status: AuditOverallStatus;
	statusLabel: string;
	/** 100-point technical headline — same as result-page `technicalScore`. */
	normalizedScore?: number;
	/** S / A / B / C/D from `normalizedScore` (HTTPS-capped). */
	grade?: ScoreGrade;
	gradeLabel?: string;
	/** GEO / AI-search trust score (0–100) from the diagnosis report. */
	geoScore?: number;
	/** GEO grade (S / A / B / C/D) matching the result-page headline. */
	geoGrade?: string;
	/**
	 * 종합 실측 점수 — Track1(40%) + Track2(40%) + CWV(20%) − 보안 페널티, same
	 * `blendMeasuredScore` output the result-page hero renders. Saved at scan time
	 * with a fallback CWV (no PSI read yet), then patched to the real PSI-informed
	 * value by `updateHistoryMeasuredScore` once the live Lighthouse read lands —
	 * keeps the history badge and the result-page headline numerically identical.
	 */
	measuredScore?: number;
	/** Grade (S / A / B / C/D) for `measuredScore`. */
	measuredGrade?: ScoreGrade;
	/** Real Google PageSpeed(Lighthouse) `performance` read (0–100) once available; null while on-page fallback. */
	coreWebVitalsScore?: number | null;
	categories: Array<{
		id: string;
		label: string;
		score: number;
		maxScore: number;
		status: 'PASS' | 'WARN' | 'FAIL';
	}>;
	fetchedAt: string;
	createdAt: string;
	/** Full report for offline/guest detail reload. */
	report: AuditReport;
}

export function diagnosisHeadlineFromReport(report: AuditReport): {
	geoScore: number;
	geoGrade: string;
	measuredScore: number;
	measuredGrade: ScoreGrade;
	coreWebVitalsScore: number | null;
} {
	const lang = report.lang === 'en' ? 'en' : 'ko';
	const coreWebVitalsScore = resolveReportTrack3Score(report);
	const snapshot = buildDiagnosisScoreSnapshot(report, null, lang, {
		coreWebVitalsScore100: coreWebVitalsScore,
	});
	return {
		geoScore: snapshot.externalTrustScore,
		geoGrade: snapshot.geoGrade,
		measuredScore: snapshot.measuredScore,
		measuredGrade: snapshot.grade,
		coreWebVitalsScore,
	};
}

export function reportToHistoryEntry(id: string, report: AuditReport, createdAt?: string): AuditHistoryEntry {
	const geo = diagnosisHeadlineFromReport(report);
	const auditScore = resolveAuditScoreFromReport(report);
	return {
		id,
		url: report.url,
		score: auditScore.totalEarnedScore,
		maxScore: auditScore.totalMaxScore,
		status: report.status,
		statusLabel: report.statusLabel,
		normalizedScore: auditScore.normalizedScore,
		grade: auditScore.grade,
		gradeLabel: auditScore.gradeLabel,
		geoScore: geo.geoScore,
		geoGrade: geo.geoGrade,
		measuredScore: geo.measuredScore,
		measuredGrade: geo.measuredGrade,
		coreWebVitalsScore: geo.coreWebVitalsScore,
		categories: auditScore.categoryList.map((c) => ({
			id: CATEGORY_TO_DIAGNOSTIC_ID[c.id],
			label: c.name,
			score: c.score,
			maxScore: c.maxScore,
			status: auditStatusToStored(c.status),
		})),
		fetchedAt: report.fetchedAt,
		createdAt: createdAt ?? report.fetchedAt,
		report,
	};
}
