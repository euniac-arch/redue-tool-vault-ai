/**
 * Rising / emerging classification — pure functions, no tool-name tables.
 * A tool is rising when growth, social trend score, novelty, or rank jump
 * crosses the thresholds. Formal traffic Top-50 is *not* required.
 */

import { parseGrowthPercent } from '@/lib/ai-hub/getDailyAiRanking';
import type { AiTool, AiToolCategoryId } from '@/lib/admin/ai-tools-management';

export type AiToolRisingStatus = 'ranked' | 'emerging' | 'hot_rising';

export const FORMAL_RANK_CUTOFF = 50;
export const RISING_GROWTH_RATE = 20;
export const RISING_TREND_SCORE = 68;
export const HOT_RISING_GROWTH_RATE = 50;
export const HOT_RISING_TREND_SCORE = 82;

/** User-facing rising item — computed at fetch time from catalog + ranks. */
export interface AIToolItem {
	id: string;
	name: string;
	developer: string;
	category: AiToolCategoryId;
	status: AiToolRisingStatus;
	currentRank?: number;
	growthRate: number;
	trendScore: number;
	rating: number;
	description: string;
	pricingType: 'Freemium' | 'Paid' | 'Open Source';
	pricingDetails: string;
	tags: string[];
	isNew: boolean;
	isRising: boolean;
	launchDate?: string;
}

export type RisingSignals = {
	growthRate: number;
	trendScore: number;
	currentRank: number;
	rankDelta: number;
	isNew: boolean;
	isHot: boolean;
	launchDate?: string;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
	return Math.round(value * 10) / 10;
}

export function resolveGrowthRate(tool: Pick<AiTool, 'growth'> & { growth_rate?: number }): number {
	if (typeof tool.growth_rate === 'number' && Number.isFinite(tool.growth_rate)) {
		return round1(tool.growth_rate);
	}
	return round1(parseGrowthPercent(tool.growth));
}

export function monthsSinceLaunch(launchDate: string | undefined, now: Date = new Date()): number | null {
	if (!launchDate) return null;
	const parsed = Date.parse(launchDate);
	if (!Number.isFinite(parsed)) return null;
	const diff = now.getTime() - parsed;
	if (diff < 0) return 0;
	return diff / (1000 * 60 * 60 * 24 * 30.4375);
}

/** Recency boost: full +12 within 6 months, fading to 0 by 18 months. */
export function recencyTrendBoost(launchDate: string | undefined, now: Date = new Date()): number {
	const months = monthsSinceLaunch(launchDate, now);
	if (months === null) return 0;
	if (months <= 6) return 12;
	if (months >= 18) return 0;
	return round1(((18 - months) / 12) * 12);
}

export function deriveTrendScore(input: {
	growthRate: number;
	rankDelta: number;
	isNew: boolean;
	isHot: boolean;
	launchDate?: string;
	catalogTrendScore?: number;
	now?: Date;
}): number {
	if (typeof input.catalogTrendScore === 'number' && Number.isFinite(input.catalogTrendScore)) {
		return clamp(Math.round(input.catalogTrendScore), 0, 100);
	}
	const fromGrowth = input.growthRate * 0.45;
	const fromJump = Math.max(0, input.rankDelta) * 4;
	const novelty = (input.isNew ? 15 : 0) + (input.isHot ? 12 : 0);
	const recency = recencyTrendBoost(input.launchDate, input.now);
	return clamp(Math.round(40 + fromGrowth + fromJump + novelty + recency), 0, 100);
}

export function classifyRisingStatus(input: RisingSignals): {
	status: AiToolRisingStatus;
	isRising: boolean;
	formalRank: number | undefined;
} {
	const formalRank = input.currentRank > 0 && input.currentRank <= FORMAL_RANK_CUTOFF ? input.currentRank : undefined;
	const buzzRising =
		input.growthRate >= RISING_GROWTH_RATE ||
		input.trendScore >= RISING_TREND_SCORE ||
		input.isHot ||
		input.isNew;
	const hotRising =
		buzzRising &&
		(input.growthRate >= HOT_RISING_GROWTH_RATE || input.trendScore >= HOT_RISING_TREND_SCORE || input.isHot);
	if (!buzzRising) {
		return { status: 'ranked', isRising: false, formalRank };
	}
	if (hotRising) {
		return { status: 'hot_rising', isRising: true, formalRank };
	}
	if (formalRank === undefined) {
		return { status: 'emerging', isRising: true, formalRank };
	}
	return { status: 'emerging', isRising: true, formalRank };
}

export function toAIToolItem(input: {
	id: string;
	name: string;
	developer: string;
	category: AiToolCategoryId;
	rating: number;
	description: string;
	pricingType: 'Freemium' | 'Paid' | 'Open Source';
	pricingDetails: string;
	tags: string[];
	launchDate?: string;
	signals: RisingSignals;
}): AIToolItem {
	const classified = classifyRisingStatus(input.signals);
	return {
		id: input.id,
		name: input.name,
		developer: input.developer,
		category: input.category,
		status: classified.status,
		currentRank: classified.formalRank,
		growthRate: input.signals.growthRate,
		trendScore: input.signals.trendScore,
		rating: input.rating,
		description: input.description,
		pricingType: input.pricingType,
		pricingDetails: input.pricingDetails,
		tags: input.tags,
		isNew: input.signals.isNew,
		isRising: classified.isRising,
		launchDate: input.launchDate,
	};
}

export function sortRisingTools<T extends { isRising: boolean; trendScore: number; growthRate: number }>(tools: T[]): T[] {
	return tools
		.filter((tool) => tool.isRising)
		.sort((a, b) => b.trendScore - a.trendScore || b.growthRate - a.growthRate);
}
