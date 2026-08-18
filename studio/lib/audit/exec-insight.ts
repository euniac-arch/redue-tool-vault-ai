/**
 * Executive Summary storytelling — maps measured GEO / SEO scores into a
 * bottleneck type, potential-gain band, and urgency level for the C-level UI.
 *
 * Copy itself lives in next-intl (`audit.b2b.execInsight` / `execJudgment`);
 * this module only decides *which* narrative to show from live scores.
 *
 * Headline numbers come from `diagnosis-scores.ts` (기술 점수 / 외부 신뢰도 /
 * 종합 실측 점수) so the simulator never invents a second scale.
 */

import {
	clampDiagnosisScore,
	measuredScoreFromParts,
	resolvePatchedMeasuredScore,
} from '@/lib/audit/diagnosis-scores';

/** Significant score gap (points) before one axis is treated as the bottleneck. */
export const EXEC_SCORE_GAP = 8;

/** Below this, both axes are treated as competitively weak when the gap is small. */
export const EXEC_WEAK_THRESHOLD = 55;

/** At/above this, both axes are treated as competitively strong when the gap is small. */
export const EXEC_STRONG_THRESHOLD = 75;

/** At/above this, simulator copy treats the site as already in the top-exposure band. */
export const EXEC_TOP_TIER_SCORE = 95;

/** Minimum point gain before the simulator copy says the score rises sharply. */
export const EXEC_SIGNIFICANT_GAIN = 5;

/** Near-perfect on-page schema score assumed after a full 100% patch. */
const PATCHED_SCHEMA_SCORE = 95;

export type BottleneckType = 'geo' | 'seo' | 'balanced' | 'bothWeak' | 'bothStrong';

export type ExecUrgencyLevel = 'urgent' | 'priority' | 'stable';

export interface ExecStorytellingInput {
	/** AI external-trust / GEO score, 0–100. */
	geoScore: number;
	/** On-page SEO · GEO · Schema technical score, 0–100. */
	seoScore: number;
	/** Audited URL — applies the HTTPS grade hard cap when the origin is HTTP. */
	url?: string | null;
	hasSsl?: boolean | null;
}

export interface ExecStorytelling {
	geoScore: number;
	seoScore: number;
	/** 종합 실측 점수 — weighted blend of external trust + technical score. */
	currentScore: number;
	/** Projected score after core-defect patch (0–100). */
	targetScore: number;
	/** Points available if core defects are patched. */
	potentialGain: number;
	/** Which axis currently constrains AI-search competitiveness. */
	bottleneckType: BottleneckType;
	urgencyLevel: ExecUrgencyLevel;
	scoreGap: number;
}

/** Footer numbers for the optimization-potential simulator. */
export interface SimulatorInsightData {
	currentScore: number;
	/** currentScore + scoreDelta — must match the dashboard projected score. */
	projectedScore: number;
	scoreDelta: number;
	/** Integer defect count (no leading-zero padding). */
	schemaDefectCount: number;
}

/**
 * Bind simulator insight numbers from live scores / findings.
 * `projectedScore` is always `currentScore + scoreDelta` (e.g. 53 + 28 = 81).
 */
export function buildSimulatorInsightData(input: {
	currentScore: number;
	scoreDelta: number;
	schemaDefectCount: number;
}): SimulatorInsightData {
	const currentScore = Number(input.currentScore || 0);
	const scoreDelta = Number(input.scoreDelta || 0);
	const schemaDefectCount = Number(input.schemaDefectCount || 0);
	return {
		currentScore,
		scoreDelta,
		projectedScore: currentScore + scoreDelta,
		schemaDefectCount,
	};
}

function clampScore(n: number): number {
	return clampDiagnosisScore(n);
}

/**
 * `geo`  — technical score leads; external AI-trust is the constraint.
 * `seo`  — external trust leads; on-page technical optimization is the constraint.
 * `bothWeak` / `bothStrong` / `balanced` — gap is within EXEC_SCORE_GAP.
 */
export function resolveBottleneckType(geoScore: number, seoScore: number): BottleneckType {
	const geo = clampScore(geoScore);
	const seo = clampScore(seoScore);
	const gap = geo - seo;
	if (Math.abs(gap) >= EXEC_SCORE_GAP) {
		return geo < seo ? 'geo' : 'seo';
	}
	if (geo < EXEC_WEAK_THRESHOLD && seo < EXEC_WEAK_THRESHOLD) return 'bothWeak';
	if (geo >= EXEC_STRONG_THRESHOLD && seo >= EXEC_STRONG_THRESHOLD) return 'bothStrong';
	return 'balanced';
}

export function resolveUrgencyLevel(
	geoScore: number,
	seoScore: number,
	potentialGain: number,
): ExecUrgencyLevel {
	const weaker = Math.min(clampScore(geoScore), clampScore(seoScore));
	if (weaker >= EXEC_STRONG_THRESHOLD && potentialGain === 0) return 'stable';
	if (weaker < 50) return 'urgent';
	return 'priority';
}

/**
 * Post-patch score: Math.min(100, Math.max(현재점수 + 가산점, 현재점수)).
 * A non-positive bonus holds the live measured score instead of inventing a lift.
 */
export function resolvePatchedTargetScore(currentScore: number, projectedRaw: number): number {
	const current = clampScore(currentScore);
	const projected = clampScore(projectedRaw);
	const bonus = projected - current;
	return resolvePatchedMeasuredScore(current, bonus);
}

/** True only when the projected lift is large enough to call a sharp rise. */
export function isSharpExposureLift(currentScore: number, targetScore: number): boolean {
	const current = clampScore(currentScore);
	const target = clampScore(targetScore);
	const gain = target - current;
	return gain > 0 && current < EXEC_TOP_TIER_SCORE && gain >= EXEC_SIGNIFICANT_GAIN;
}

export function buildExecStorytelling(input: ExecStorytellingInput): ExecStorytelling {
	const geoScore = clampScore(input.geoScore);
	const seoScore = clampScore(input.seoScore);
	const currentScore = measuredScoreFromParts(geoScore, seoScore, {
		url: input.url,
		hasSsl: input.hasSsl,
	});
	const patchedSchema = Math.min(100, Math.max(PATCHED_SCHEMA_SCORE, seoScore));
	const projectedAfterPatch = Math.round(geoScore * 0.4 + patchedSchema * 0.6);
	const targetScore = resolvePatchedTargetScore(currentScore, projectedAfterPatch);
	const potentialGain = Math.max(0, targetScore - currentScore);
	const bottleneckType = resolveBottleneckType(geoScore, seoScore);
	const urgencyLevel = resolveUrgencyLevel(geoScore, seoScore, potentialGain);

	return {
		geoScore,
		seoScore,
		currentScore,
		targetScore,
		potentialGain,
		bottleneckType,
		urgencyLevel,
		scoreGap: Math.abs(geoScore - seoScore),
	};
}
