import { ASI_GUARD } from '@/lib/ai-search-intelligence/guard/limits';

/**
 * Visibility Monitor + Alert — thresholds and cost caps live here, not in UI.
 */
export const ASI_VISIBILITY_CONFIG = {
	queryLimit: 6,
	providerLimit: 4,
	retryLimit: ASI_GUARD.maxRetries,
	timeoutMs: ASI_GUARD.requestTimeoutMs,
	cacheTtlMs: ASI_GUARD.cacheTtlMs,
	minIntervalMs: 6 * 60 * 60 * 1000,
	maxSnapshots: 90,
	windows: {
		today: 1,
		'7d': 7,
		'30d': 30,
	},
	cadenceMs: {
		daily: 24 * 60 * 60 * 1000,
		weekly: 7 * 24 * 60 * 60 * 1000,
		monthly: 30 * 24 * 60 * 60 * 1000,
	},
	alerts: {
		visibilityDrop: 10,
		recommendationDrop: 8,
		citationDrop: 8,
		sovDrop: 5,
		competitorSurge: 8,
		queryShift: 20,
		providerShift: 15,
		warningDrop: 8,
		criticalDrop: 20,
	},
} as const;

export type AsiVisibilityWindow = keyof typeof ASI_VISIBILITY_CONFIG.windows;
export type AsiVisibilityCadence = keyof typeof ASI_VISIBILITY_CONFIG.cadenceMs;
