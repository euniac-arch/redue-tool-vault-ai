/**
 * Diagnosis score snapshot — single source of truth for the result page.
 *
 * Three headline numbers are derived once and reused by the dual-score header,
 * the exposure simulator, GEO engine cards, and the exec brief:
 *
 *   technicalScore      기술 점수          (on-page SEO / Schema %, 0–100)
 *   externalTrustScore  외부 신뢰도 · GEO  (external reputation %, 0–100)
 *   measuredScore       종합 실측 점수     (weighted blend of the two)
 *
 * Per-engine AI Readiness Scores come from the same reputation resolver
 * used by the exposure panel, so Level 1/2/3 never drifts from the cards.
 */

import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { detectEnginePlatformSignals, rawEngineScoresFromSignals } from '@/lib/audit/engine-analysis';
import {
	extractSignalsFromReport,
	hydrateAiEngineExposure,
	resolveExternalReputation,
	type AiEngineExposure,
	type GeoExternalReputationReport,
} from '@/lib/audit/geo-score';
import { countAuditDefects } from '@/lib/audit/latest-audit-payload';
import { getReputationInsight } from '@/lib/audit/reputation-insight';
import { gradeForHttps, type ScoreGrade } from '@/lib/audit/score-grade';
import {
	levelFromEngineScore,
	statusBadgeFromEngineScore,
} from '@/lib/geo/rating-meta';
import { buildSyncedRadarScores } from '@/lib/audit/categoryAggregator';
import {
	buildOnPageDiagnostic,
	normalizeChecklistItems,
	onpageNormalizedScore,
	type OnPageDiagnosticProps,
} from '@/lib/audit/onpage-diagnostic';
import {
	calculateGeoComprehensiveFromReport,
	type ComprehensiveGeoResult,
} from '@/lib/audit/geoScoreCalculator';
import {
	calculateComprehensiveAuditScoreFromOnpage,
	type ComprehensiveAuditScore,
} from '@/lib/audit/auditScoreCalculator';
import {
	calculateAuditScores,
	calculateComprehensiveScores,
	applySecurityGradeCap,
	resolveIsHttps,
	type AuditScores,
	type DetailedAuditScore,
	type RadarScores,
} from '@/lib/audit/scoreCalculator';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';
import type { AIEngineId } from '@/types/geo-diagnostic';

/** 종합 실측 점수 = 외부 신뢰도 × 50% + 기술 점수 × 50%. */
export const MEASURED_SCORE_WEIGHTS = {
	externalTrust: 0.5,
	technical: 0.5,
} as const;

export function clampDiagnosisScore(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

export function technicalScoreFromReport(report: AuditReport): number {
	const base = onpageNormalizedScore(report);
	return calculateAuditScores({
		url: report.url,
		hasSsl: report.hasSsl,
		technicalScore: base,
		geoScore: 0,
		lang: report.lang,
	}).technicalScore;
}

export function measuredScoreFromParts(
	externalTrustScore: number,
	technicalScore: number,
	security?: { url?: string | null; hasSsl?: boolean | null },
): number {
	const geo = clampDiagnosisScore(externalTrustScore);
	const seo = clampDiagnosisScore(technicalScore);
	const blended = clampDiagnosisScore(
		geo * MEASURED_SCORE_WEIGHTS.externalTrust + seo * MEASURED_SCORE_WEIGHTS.technical,
	);
	if (!security) return blended;
	return applySecurityGradeCap(blended, resolveIsHttps(security));
}

/**
 * Post-patch expected score: never below the live measured score, never above 100.
 * `bonus` is the raw add-on (may be negative); a non-positive bonus holds the current score.
 */
export function resolvePatchedMeasuredScore(currentScore: number, bonus: number): number {
	const current = clampDiagnosisScore(currentScore);
	const add = Number.isFinite(bonus) ? bonus : 0;
	return Math.min(100, Math.max(current + add, current));
}

export interface DiagnosisScoreSnapshot {
	/** 기술 점수 — on-page SEO · Schema completeness, 0–100 (pure raw/max proportion). */
	technicalScore: number;
	/** 외부 신뢰도 — GEO / external AI-trust, 0–100 (composite hard-cap is applied later). */
	externalTrustScore: number;
	/** 종합 실측 점수 — weighted blend of the two axes (Hard Cap 78 on HTTP). */
	measuredScore: number;
	grade: ScoreGrade;
	percentile: number;
	geoGrade: ScoreGrade;
	technicalGrade: ScoreGrade;
	geoPercentile: number;
	technicalPercentile: number;
	rawTechnicalScore: number;
	maxRawScore: number;
	minExposureThreshold: number;
	topRecommendationThreshold: number;
	engines: AiEngineExposure[];
	engineScoreById: Partial<Record<AIEngineId, number>>;
	reputation: GeoExternalReputationReport;
	isHttps: boolean;
	securityPenaltyApplied: boolean;
	securityCapped: boolean;
	securityCriticalAlert: string | null;
	securityAlertMessage?: string;
	radarScores: RadarScores;
	/** Weighted diagnostic computed once for Tab 2 + dual-card badge. */
	onpage: OnPageDiagnosticProps;
	detailed: DetailedAuditScore;
	/** Unified packet — dashboard UI binds `auditData.scores` only. */
	scores: AuditScores;
	/** 4-pillar GEO breakdown — headline `geoScore` is `rawGeoScore` (sum of 4×25). */
	geoComprehensive: ComprehensiveGeoResult;
	/**
	 * Technical 122↔100 + 5-category badges — same packet History uses.
	 * `normalizedScore` === `technicalScore` / `scores.technicalScore`.
	 */
	auditScore: ComprehensiveAuditScore;
	/** Category 5 (GEO & AI 인용 신호) — same raw/defects as the 5-card grid. */
	geoAiMeasured: {
		rawScore: number;
		maxScore: number;
		score100: number;
		defectCount: number;
		warningCount: number;
	};
}

export function buildDiagnosisScoreSnapshot(
	report: AuditReport,
	reportData?: GeoNarrativeReport | null,
	lang: AuditLang = 'ko',
): DiagnosisScoreSnapshot {
	const reputation = resolveExternalReputation(report, reportData, lang);
	const onpage = buildOnPageDiagnostic(report);
	const checklist = normalizeChecklistItems(report);
	const isHttps = resolveIsHttps({ url: report.url, hasSsl: report.hasSsl });
	const geoComprehensive = calculateGeoComprehensiveFromReport(report, isHttps, lang);
	const radarScores = buildSyncedRadarScores(checklist, isHttps);
	const schemaScore100 = onpage.categories.find((c) => c.id === 'schema')?.score100 ?? radarScores.schema;
	const webPerf = onpage.categories.find((c) => c.id === 'performance')?.score100 ?? radarScores.performance;
	const signals = extractSignalsFromReport(report);
	const rawEngineScores = rawEngineScoresFromSignals({
		...signals,
		platform: signals.platform ?? detectEnginePlatformSignals({}),
	});
	const scores = calculateComprehensiveScores({
		url: report.url,
		hasSsl: report.hasSsl,
		rawTechnicalScore: onpage.totalRawScore,
		maxRawScore: onpage.maxPossibleScore,
		technicalScore: onpage.normalizedScore,
		geoScore: geoComprehensive.rawGeoScore,
		lang,
		schemaScore100,
		ragScore: webPerf,
		searchBasics: radarScores.seo,
		securityInfra: onpage.categories.find((c) => c.id === 'security')?.score100 ?? radarScores.security,
		webPerf,
		aiCitation: radarScores.geoSignal,
		radarScores,
		engineScores: rawEngineScores,
	});
	const geoScore = scores.geoScore;
	const defectCount = countAuditDefects(report);
	const engines = reputation.aiEngines.map((engine) =>
		hydrateAiEngineExposure(
			{
				...engine,
				score: scores.engineScores[engine.engine] ?? engine.score,
			},
			lang,
		),
	);
	const reputationSynced: GeoExternalReputationReport = {
		...reputation,
		overview: {
			...reputation.overview,
			score: geoScore,
			grade: gradeForHttps(geoScore, scores.isHttps),
			percentile: scores.geoPercentile,
			summary: getReputationInsight(defectCount, geoScore, lang, { isHttps: scores.isHttps }),
			pointsToTop: Math.max(0, reputation.overview.topRecommendationThreshold - geoScore),
		},
		aiEngines: engines,
	};
	const engineScoreById: Partial<Record<AIEngineId, number>> = { ...scores.engineScores };
	const auditScore = calculateComprehensiveAuditScoreFromOnpage(onpage, { isHttps: scores.isHttps, lang });
	const geoCategory = onpage.categories.find((c) => c.id === 'geo');
	const geoAiMeasured = {
		rawScore: geoCategory?.rawScore ?? auditScore.categories.geoAi.score,
		maxScore: geoCategory?.maxScore ?? auditScore.categories.geoAi.maxScore,
		score100: geoCategory?.score100 ?? auditScore.categories.geoAi.percentage,
		defectCount: geoCategory?.defectCount ?? auditScore.categories.geoAi.defectCount,
		warningCount: geoCategory?.warningCount ?? auditScore.categories.geoAi.warningCount,
	};

	return {
		technicalScore: scores.technicalScore,
		externalTrustScore: geoScore,
		measuredScore: scores.totalScore,
		grade: scores.grade,
		percentile: scores.percentile,
		geoGrade: gradeForHttps(geoScore, scores.isHttps),
		technicalGrade: gradeForHttps(scores.technicalScore, scores.isHttps),
		geoPercentile: scores.geoPercentile,
		technicalPercentile: scores.technicalPercentile,
		rawTechnicalScore: scores.rawScore122,
		maxRawScore: scores.maxRawScore,
		minExposureThreshold: reputationSynced.overview.minExposureThreshold,
		topRecommendationThreshold: reputationSynced.overview.topRecommendationThreshold,
		engines,
		engineScoreById,
		reputation: reputationSynced,
		isHttps: scores.isHttps,
		securityPenaltyApplied: scores.securityPenaltyApplied,
		securityCapped: scores.securityCapped,
		securityCriticalAlert: scores.securityCriticalAlert,
		securityAlertMessage: scores.securityAlertMessage,
		radarScores: scores.radarScores,
		onpage,
		detailed: scores,
		scores,
		geoComprehensive,
		auditScore,
		geoAiMeasured,
	};
}

export { levelFromEngineScore, statusBadgeFromEngineScore };
