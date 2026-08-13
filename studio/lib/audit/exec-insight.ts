/**
 * Executive Summary storytelling — maps measured GEO / SEO scores into a
 * bottleneck type, potential-gain band, and urgency level for the C-level UI.
 *
 * Copy itself lives in next-intl (`audit.b2b.execInsight` / `execJudgment`);
 * this module only decides *which* narrative to show from live scores.
 */

/** Significant score gap (points) before one axis is treated as the bottleneck. */
export const EXEC_SCORE_GAP = 8;

/** Below this, both axes are treated as competitively weak when the gap is small. */
export const EXEC_WEAK_THRESHOLD = 55;

/** At/above this, both axes are treated as competitively strong when the gap is small. */
export const EXEC_STRONG_THRESHOLD = 75;

/** Near-perfect on-page schema score assumed after a full 100% patch. */
const PATCHED_SCHEMA_SCORE = 95;

export type BottleneckType = 'geo' | 'seo' | 'balanced' | 'bothWeak' | 'bothStrong';

export type ExecUrgencyLevel = 'urgent' | 'priority' | 'stable';

export interface ExecStorytellingInput {
	/** AI external-trust / GEO score, 0–100. */
	geoScore: number;
	/** On-page SEO · GEO · Schema technical score, 0–100. */
	seoScore: number;
}

export interface ExecStorytelling {
	geoScore: number;
	seoScore: number;
	/** Blended current exposure score (0–100). */
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

function clampScore(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
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

export function buildExecStorytelling(input: ExecStorytellingInput): ExecStorytelling {
	const geoScore = clampScore(input.geoScore);
	const seoScore = clampScore(input.seoScore);
	const currentScore = Math.round(geoScore * 0.5 + seoScore * 0.5);
	const projectedAfterPatch = Math.round(geoScore * 0.4 + PATCHED_SCHEMA_SCORE * 0.6);
	const targetScore = Math.min(97, Math.max(currentScore, projectedAfterPatch));
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
