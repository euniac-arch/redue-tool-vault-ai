/**
 * Priority / Impact / Effort / Confidence — all DERIVED.
 * Never present these as an AI-guaranteed outcome.
 */
import type { AsiActionTier } from '@/lib/ai-search-intelligence/types';

export function clampScore(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

export function actionTier(value: number): AsiActionTier {
	if (value >= 70) return 'high';
	if (value >= 45) return 'medium';
	return 'low';
}

/** Effort display: low stored value = easy (LOW). */
export function effortTier(effort: number): AsiActionTier {
	if (effort >= 70) return 'high';
	if (effort >= 45) return 'medium';
	return 'low';
}

export function actionPriority(input: { impact: number; effort: number; confidence: number }): number {
	return clampScore(input.impact * 0.45 + (100 - input.effort) * 0.25 + input.confidence * 0.3);
}
