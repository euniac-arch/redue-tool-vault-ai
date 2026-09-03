import {
	GUIDE_AI_POTENTIAL_DEFAULT,
	GUIDE_AI_TRUST_DEFAULT,
	GUIDE_OBSERVED_SEO_DEFAULT,
	GUIDE_SEO_MAX_DEFAULT,
} from '@/lib/guide/types';
import type { SubScores } from '@/lib/guide/types';

function finiteScore(value: unknown, max: number): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.min(max, Math.max(0, Math.round(n)));
}

/**
 * Same as `finiteScore`, but a genuinely missing field (`undefined`/`null` —
 * e.g. no diagnosis has been loaded yet) falls back to a presentable
 * placeholder instead of 0. An explicitly provided but invalid value
 * (NaN/Infinity/non-numeric string) is still sanitized to 0 — it was
 * *supplied*, so it is treated as bad measured data, not as "missing".
 */
function finiteScoreOrDefault(value: unknown, max: number, fallback: number): number {
	if (value === undefined || value === null) {
		return Math.min(max, Math.max(0, Math.round(fallback)));
	}
	return finiteScore(value, max);
}

export function sanitizeSeoMax(value: unknown): number {
	const n = finiteScore(value, 500);
	return n > 0 ? n : GUIDE_SEO_MAX_DEFAULT;
}

/**
 * Distributes a single trust-score signal across the five sub-score axes.
 * Used only when no measured sub-score breakdown exists yet — every axis is
 * derived purely from the (already-resolved) aiTrustScore, so it never bakes
 * in a business- or industry-specific number.
 */
export function distributeSubScoresFromTrust(aiTrustScore: number): SubScores {
	const base = finiteScore(aiTrustScore, 100);
	return { specialty: base, localPresence: base, authority: base, uniqueness: base, awareness: base };
}

function subScoreOrDefault(value: unknown, fallback: number): number {
	if (value === undefined || value === null) return fallback;
	return finiteScore(value, 100);
}

export function sanitizeGuideScores(input: {
	observedSeoScore?: unknown;
	seoMaxScore?: unknown;
	aiTrustScore?: unknown;
	aiPotentialScore?: unknown;
	subScores?: Partial<SubScores> | null;
}): {
	observedSeoScore: number;
	seoMaxScore: number;
	aiTrustScore: number;
	aiPotentialScore: number;
	subScores: SubScores;
} {
	const seoMax = sanitizeSeoMax(input.seoMaxScore);
	const aiTrustScore = finiteScoreOrDefault(input.aiTrustScore, 100, GUIDE_AI_TRUST_DEFAULT);
	const subFallback = distributeSubScoresFromTrust(aiTrustScore);
	return {
		observedSeoScore: finiteScoreOrDefault(input.observedSeoScore, seoMax, GUIDE_OBSERVED_SEO_DEFAULT),
		seoMaxScore: seoMax,
		aiTrustScore,
		aiPotentialScore: finiteScoreOrDefault(input.aiPotentialScore, 100, GUIDE_AI_POTENTIAL_DEFAULT),
		subScores: {
			specialty: subScoreOrDefault(input.subScores?.specialty, subFallback.specialty),
			localPresence: subScoreOrDefault(input.subScores?.localPresence, subFallback.localPresence),
			authority: subScoreOrDefault(input.subScores?.authority, subFallback.authority),
			uniqueness: subScoreOrDefault(input.subScores?.uniqueness, subFallback.uniqueness),
			awareness: subScoreOrDefault(input.subScores?.awareness, subFallback.awareness),
		},
	};
}
