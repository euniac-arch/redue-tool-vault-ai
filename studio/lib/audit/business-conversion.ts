/**
 * Business-language conversion layer for GEO audit reports.
 * Maps measured trigger depth + site entity fields into owner-facing
 * leakage / ROI copy — no hardcoded brand or keyword.
 */

import { resolveTargetBrandName } from '@/lib/audit/target-entity';
import type { IndustryType } from '@/lib/audit/site-metadata';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';
import type { GeoDiagnosticReport } from '@/types/geo-diagnostic';

export type LeakageTone = 'critical' | 'partial' | 'captured';

export interface BusinessConversionInput {
	brandName?: string | null;
	category?: string | null;
	location?: string | null;
	primaryKeyword?: string | null;
	targetKeywords?: readonly string[] | null;
	triggerQueries?: { 1?: string; 2?: string; 3?: string } | null;
	industryType?: IndustryType | null;
	engines?: readonly { depthLevel: 1 | 2 | 3 | null }[] | null;
	lang?: AuditLang;
}

export interface BusinessConversionModel {
	brandName: string;
	category: string;
	location: string;
	primaryKeyword: string;
	targetKeywords: string[];
	/** Best owner-facing search phrase (e.g. "서울 서초구 암치료"). */
	targetQuery: string;
	industryType: IndustryType;
	leakageTone: LeakageTone;
	level1Count: number;
	level2Count: number;
	level3Count: number;
	unindexedCount: number;
	totalEngines: number;
	/** 0–100 share of engines that only cite on brand search or not at all. */
	leakagePct: number;
	/** Estimated monthly organic-equivalent value in 만원. */
	monthlyValueManwon: number;
	/** Same estimate in KRW (만원 × 10,000) for loss-copy display. */
	monthlyLossKrw: number;
	cpcKrw: number;
	/** Industry-average monthly AI-search query volume used in the estimate. */
	monthlySearchVolume: number;
	/** Brand vs competitor citation-share gap used in the estimate (0–100). */
	citationGapPct: number;
	/** Assumed own-brand AI citation share (0–100). */
	brandSharePct: number;
	/** Assumed competitor-average AI citation share (0–100). */
	competitorSharePct: number;
	showLeakageBadge: boolean;
}

const CPC_KRW: Record<IndustryType, number> = {
	MEDICAL: 14_000,
	B2B_MFG: 9_000,
	LOCAL_STORE: 4_500,
	GENERAL: 3_500,
};

const MONTHLY_SEARCH: Record<IndustryType, number> = {
	MEDICAL: 160,
	B2B_MFG: 110,
	LOCAL_STORE: 200,
	GENERAL: 130,
};

const HIGH_CPC_RE = /암|중입자|법률|소송|성형|임플란트|치과|cancer|legal|lawsuit|implant/i;
const MID_CPC_RE = /병원|의원|클리닉|학원|로펌|상담|hospital|clinic|academy|law/i;

function cleanPhrase(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function uniquePhrases(values: readonly (string | null | undefined)[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const phrase = cleanPhrase(raw);
		if (!phrase) continue;
		const key = phrase.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(phrase);
	}
	return out;
}

function looksLikeBrand(phrase: string, brandName: string): boolean {
	const a = phrase.replace(/\s+/g, '').toLowerCase();
	const b = brandName.replace(/\s+/g, '').toLowerCase();
	if (!a || !b) return false;
	return a === b || a.includes(b);
}

export function pickTargetQuery(input: {
	triggerQueries?: BusinessConversionInput['triggerQueries'];
	location?: string | null;
	primaryKeyword?: string | null;
	category?: string | null;
	targetKeywords?: readonly string[] | null;
	brandName?: string | null;
	lang?: AuditLang;
}): string {
	const brand = cleanPhrase(input.brandName);
	const fromTrigger = cleanPhrase(input.triggerQueries?.[2]) || cleanPhrase(input.triggerQueries?.[3]);
	if (fromTrigger && !looksLikeBrand(fromTrigger, brand)) return fromTrigger;

	const location = cleanPhrase(input.location);
	const focus =
		cleanPhrase(input.primaryKeyword) ||
		cleanPhrase(input.category) ||
		(input.targetKeywords || []).map(cleanPhrase).find((k) => k && !looksLikeBrand(k, brand)) ||
		'';

	if (location && focus && !focus.includes(location)) return `${location} ${focus}`;
	if (focus) return focus;
	if (fromTrigger) return fromTrigger;
	return input.lang === 'en' ? 'your main service' : '주요 서비스';
}

function resolveLeakageTone(level1: number, level2: number, level3: number, unindexed: number): LeakageTone {
	const weak = level1 + unindexed;
	if (level3 >= 3) return 'captured';
	if (weak >= 4 || (level2 === 0 && level3 === 0)) return 'critical';
	return 'partial';
}

function cpcMultiplier(query: string, keywords: readonly string[]): number {
	const hay = [query, ...keywords].join(' ');
	if (HIGH_CPC_RE.test(hay)) return 1.4;
	if (MID_CPC_RE.test(hay)) return 1.12;
	return 1;
}

const BRAND_SHARE_PCT: Record<LeakageTone, number> = {
	critical: 5,
	partial: 20,
	captured: 40,
};

const COMPETITOR_SHARE_PCT = 48;

function estimateMonthlyManwon(opts: {
	industryType: IndustryType;
	targetQuery: string;
	targetKeywords: readonly string[];
	leakageRate: number;
	leakageTone: LeakageTone;
}): number {
	const volume = MONTHLY_SEARCH[opts.industryType];
	const cpc = Math.round(CPC_KRW[opts.industryType] * cpcMultiplier(opts.targetQuery, opts.targetKeywords));
	const floorRate = opts.leakageTone === 'captured' ? 0.12 : opts.leakageTone === 'partial' ? 0.28 : 0.45;
	const rate = Math.min(1, Math.max(floorRate, opts.leakageRate));
	const krw = volume * cpc * rate;
	return Math.min(480, Math.max(12, Math.round(krw / 10_000)));
}

export function buildBusinessConversionModel(input: BusinessConversionInput): BusinessConversionModel {
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const brandName = cleanPhrase(input.brandName) || (lang === 'en' ? 'This brand' : '해당 브랜드');
	const category = cleanPhrase(input.category);
	const location = cleanPhrase(input.location);
	const primaryKeyword = cleanPhrase(input.primaryKeyword) || category;
	const industryType = input.industryType || 'GENERAL';

	const targetKeywords = uniquePhrases([
		primaryKeyword,
		category,
		...(input.targetKeywords || []),
	]).filter((phrase) => !looksLikeBrand(phrase, brandName)).slice(0, 4);

	const targetQuery = pickTargetQuery({
		triggerQueries: input.triggerQueries,
		location,
		primaryKeyword,
		category,
		targetKeywords,
		brandName,
		lang,
	});

	const engines = input.engines || [];
	const totalEngines = engines.length || 6;
	let level1Count = 0;
	let level2Count = 0;
	let level3Count = 0;
	let unindexedCount = 0;
	for (const engine of engines) {
		if (engine.depthLevel === 3) level3Count += 1;
		else if (engine.depthLevel === 2) level2Count += 1;
		else if (engine.depthLevel === 1) level1Count += 1;
		else unindexedCount += 1;
	}
	if (engines.length === 0) {
		unindexedCount = totalEngines;
	}

	const leakageTone = resolveLeakageTone(level1Count, level2Count, level3Count, unindexedCount);
	const leakagePct = Math.round(((level1Count + unindexedCount) / totalEngines) * 100);
	const cpcKrw = Math.round(CPC_KRW[industryType] * cpcMultiplier(targetQuery, targetKeywords));
	const monthlySearchVolume = MONTHLY_SEARCH[industryType];
	const brandSharePct = BRAND_SHARE_PCT[leakageTone];
	const competitorSharePct = COMPETITOR_SHARE_PCT;
	const citationGapPct = Math.max(0, competitorSharePct - brandSharePct);
	const monthlyValueManwon = estimateMonthlyManwon({
		industryType,
		targetQuery,
		targetKeywords,
		leakageRate: (level1Count + unindexedCount) / totalEngines,
		leakageTone,
	});

	return {
		brandName,
		category: category || primaryKeyword || (lang === 'en' ? 'services' : '서비스'),
		location,
		primaryKeyword: primaryKeyword || (lang === 'en' ? 'services' : '서비스'),
		targetKeywords,
		targetQuery,
		industryType,
		leakageTone,
		level1Count,
		level2Count,
		level3Count,
		unindexedCount,
		totalEngines,
		leakagePct,
		monthlyValueManwon,
		monthlyLossKrw: monthlyValueManwon * 10_000,
		cpcKrw,
		monthlySearchVolume,
		citationGapPct,
		brandSharePct,
		competitorSharePct,
		showLeakageBadge: leakageTone === 'critical',
	};
}

export function businessConversionFromAudit(
	report: AuditReport,
	geo?: GeoDiagnosticReport | null,
	lang: AuditLang = 'ko',
): BusinessConversionModel {
	const meta = report.siteMeta;
	const keywords = uniquePhrases([
		meta?.businessEntity,
		meta?.primaryKeyword,
		meta?.category,
		...(meta?.entityPhrases ?? []),
		...(geo ? [geo.triggerQueries[2], geo.triggerQueries[3]] : []),
	]);

	return buildBusinessConversionModel({
		brandName: resolveTargetBrandName(report) || geo?.brandName,
		category: meta?.businessEntity || meta?.category || meta?.primaryKeyword,
		location: meta?.location || meta?.broadLocation,
		primaryKeyword: meta?.primaryKeyword || meta?.businessEntity || meta?.category,
		targetKeywords: keywords,
		triggerQueries: geo?.triggerQueries,
		industryType: meta?.industryType,
		engines: geo?.engines,
		lang,
	});
}

export function businessConversionFromGeo(
	geo: GeoDiagnosticReport,
	extra?: {
		industryType?: IndustryType | null;
		category?: string | null;
		location?: string | null;
		targetKeywords?: readonly string[] | null;
		lang?: AuditLang;
	},
): BusinessConversionModel {
	return buildBusinessConversionModel({
		brandName: geo.brandName,
		category: extra?.category,
		location: extra?.location,
		primaryKeyword: extra?.category,
		targetKeywords: extra?.targetKeywords,
		triggerQueries: geo.triggerQueries,
		industryType: extra?.industryType,
		engines: geo.engines,
		lang: extra?.lang,
	});
}
