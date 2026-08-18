/**
 * Shared rating helper for Why & Status / GEO engine cards.
 *
 * A 0–100 `score` is the AI Readiness Score (site-analysis estimate).
 * Star count, 5-point rating, and status badge all come from one band table
 * so the three never drift.
 *
 *   80–100 → ★★★★★ (5.0/5.0) AI 검색 준비도 매우 양호
 *   60–79  → ★★★★☆ (4.0/5.0) AI 검색 준비도 양호
 *   40–59  → ★★★☆☆ (3.0/5.0) AI 검색 준비도 보통
 *   20–39  → ★★☆☆☆ (2.0/5.0) AI 검색 준비도 낮음
 *    0–19  → ★☆☆☆☆ (1.0/5.0) AI 검색 준비도 매우 낮음
 */

import { resolveTriggerLevel } from '@/lib/audit/triggerDepthEngine';

export type RatingLang = 'ko' | 'en';
export type RatingStatusKey = 'excellent' | 'good' | 'moderate' | 'low' | 'veryLow';
export type RatingTone = 'success' | 'warning' | 'danger';
/** Exposure-panel status — maps 1:1 from score bands via `exposureStatusFromScore`. */
export type EngineExposureStatus = 'optimal' | 'partial' | 'poor';

export interface RatingMeta {
	/** Integer 0–100. */
	score: number;
	/** Band rating 1.0–5.0 — same source as `filledStars`. */
	ratingOutOf5: number;
	/** Integer filled stars 1–5, aligned with `ratingOutOf5`. */
	filledStars: number;
	statusKey: RatingStatusKey;
	statusLabel: string;
	tone: RatingTone;
}

const STATUS_LABEL: Record<RatingLang, Record<RatingStatusKey, string>> = {
	ko: {
		excellent: 'AI 검색 준비도 매우 양호',
		good: 'AI 검색 준비도 양호',
		moderate: 'AI 검색 준비도 보통',
		low: 'AI 검색 준비도 낮음',
		veryLow: 'AI 검색 준비도 매우 낮음',
	},
	en: {
		excellent: 'AI search readiness: excellent',
		good: 'AI search readiness: good',
		moderate: 'AI search readiness: fair',
		low: 'AI search readiness: low',
		veryLow: 'AI search readiness: very low',
	},
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function readinessTone(statusKey: RatingStatusKey): RatingTone {
	if (statusKey === 'excellent' || statusKey === 'good') return 'success';
	if (statusKey === 'moderate') return 'warning';
	return 'danger';
}

/** Single conversion: score → stars + 5-point rating + status. */
export function readinessBandFromScore(score: number): {
	filledStars: number;
	ratingOutOf5: number;
	statusKey: RatingStatusKey;
} {
	const clamped = clamp(Math.round(Number.isFinite(score) ? score : 0), 0, 100);
	if (clamped >= 80) return { filledStars: 5, ratingOutOf5: 5.0, statusKey: 'excellent' };
	if (clamped >= 60) return { filledStars: 4, ratingOutOf5: 4.0, statusKey: 'good' };
	if (clamped >= 40) return { filledStars: 3, ratingOutOf5: 3.0, statusKey: 'moderate' };
	if (clamped >= 20) return { filledStars: 2, ratingOutOf5: 2.0, statusKey: 'low' };
	return { filledStars: 1, ratingOutOf5: 1.0, statusKey: 'veryLow' };
}

export function getRatingMeta(score: number, lang: RatingLang = 'ko'): RatingMeta {
	const clamped = clamp(Math.round(Number.isFinite(score) ? score : 0), 0, 100);
	const band = readinessBandFromScore(clamped);

	return {
		score: clamped,
		ratingOutOf5: band.ratingOutOf5,
		filledStars: band.filledStars,
		statusKey: band.statusKey,
		statusLabel: STATUS_LABEL[lang][band.statusKey],
		tone: readinessTone(band.statusKey),
	};
}

/** 85+ → optimal · 50–84 → partial · <50 → poor. Internal status only — UI uses readiness labels. */
export function exposureStatusFromScore(score: number): EngineExposureStatus {
	const clamped = clamp(Math.round(Number.isFinite(score) ? score : 0), 0, 100);
	if (clamped >= 85) return 'optimal';
	if (clamped >= 50) return 'partial';
	return 'poor';
}

/** Fallback score when only a trigger-depth level is known (keeps badge related to depth). */
export function scoreFromDepthLevel(depth: 0 | 1 | 2 | 3 | null): number {
	if (depth === 3) return 90;
	if (depth === 2) return 68;
	if (depth === 1) return 36;
	return 18;
}

/**
 * Trigger depth from a measured 0–100 engine score.
 * 80+ → Level 3 · 60–79 → Level 2 · below 60 → Level 1.
 */
export function levelFromEngineScore(score: number): 1 | 2 | 3 {
	const clamped = clamp(Math.round(Number.isFinite(score) ? score : 0), 0, 100);
	if (clamped >= 80) return 3;
	if (clamped >= 60) return 2;
	return 1;
}

export function statusBadgeFromEngineScore(score: number): 'optimal' | 'moderate' | 'exact_only' {
	const level = levelFromEngineScore(score);
	if (level === 3) return 'optimal';
	if (level === 2) return 'moderate';
	return 'exact_only';
}

/**
 * As-Is trigger level from the central engine score + HTTPS gate.
 * Honesty (`brandOnly`) can only lower the level to 1.
 */
export function asIsLevelFromEngineScore(
	score: number,
	opts?: { brandOnly?: boolean; isHttps?: boolean },
): 1 | 2 | 3 {
	if (opts?.brandOnly) return 1;
	return resolveTriggerLevel(score, opts?.isHttps !== false);
}

export function asIsStatusBadgeFromEngineScore(
	score: number,
	opts?: { brandOnly?: boolean; isHttps?: boolean },
): 'optimal' | 'moderate' | 'exact_only' {
	const level = asIsLevelFromEngineScore(score, opts);
	if (level === 3) return 'optimal';
	if (level === 2) return 'moderate';
	return 'exact_only';
}
