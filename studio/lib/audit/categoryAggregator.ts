/**
 * Five-category score integrity — single source of truth.
 *
 * Every checklist item is classified by its engine/definition id, never by a
 * stored report bucket. Earned points are clamped so no category can render
 * `획득 > 만점`. Radar axes read the same five buckets 1:1.
 */

import { normalizeTo100, resolveAuditStatus } from '@/lib/audit/auditScoreCalculator';
import {
	AUDIT_CHECKLIST_DEFINITIONS,
	CHECKLIST_CATEGORY_MAX,
	CHECKLIST_TOTAL_MAX,
	ENGINE_CHECK_TO_DEFINITION_ID,
	checklistDefById,
	checklistDefForEngineId,
	type ChecklistCategory,
	type ChecklistPLevel,
} from '@/lib/audit/checklistDefinitions';

export type StandardCategoryId = ChecklistCategory;

export interface CategoryScoreSummary {
	id: StandardCategoryId;
	name: string;
	earned: number;
	max: number;
	percentage: number;
	detailText?: string;
}

export interface CategoryChecklistItem {
	id?: string;
	category?: string;
	passed?: boolean;
	status?: 'pass' | 'warning' | 'fail' | string;
	score?: number;
	earnedScore?: number;
	weight?: number;
	maxScore?: number;
	pLevel?: ChecklistPLevel | string;
}

export interface CategoryDefinition {
	id: StandardCategoryId;
	name: string;
	shortName: string;
	icon: string;
	max: number;
	defaultDesc: string;
}

export type CategoryVerdictStatus = 'Pass' | 'Warning' | 'Fail';

export interface CategoryAggregateResult {
	id: StandardCategoryId;
	name: string;
	shortName: string;
	icon: string;
	earned: number;
	max: number;
	percentage: number;
	status: CategoryVerdictStatus;
	failCount: number;
	warnCount: number;
	/** All fail rows in this bucket (not just P0). Matches category-card `defectCount`. */
	defectCount: number;
	/** All warning rows in this bucket. Matches category-card `warningCount`. */
	warningCount: number;
	description: string;
}

/**
 * Unified 5-category badge (same achievement bands as the on-page cards):
 *   Pass    — 달성률 ≥ 90%
 *   Warning — 50% ≤ 달성률 < 90%
 *   Fail    — 달성률 < 50%
 */
export function resolveCategoryVerdict(
	percentage: number,
	defects = 0,
	warnings = 0,
): CategoryVerdictStatus {
	const status = resolveAuditStatus(percentage, defects, warnings);
	if (status === 'poor') return 'Fail';
	if (status === 'warning') return 'Warning';
	return 'Pass';
}

export interface RadarAxisPoint {
	subject: string;
	score: number;
	fullMark: number;
}

/** 0–100 radar axes — 1:1 with the five standard categories. */
export interface RadarAxisScores {
	security: number;
	performance: number;
	seo: number;
	schema: number;
	geoSignal: number;
}

export const CATEGORY_DEFINITIONS: readonly CategoryDefinition[] = [
	{ id: 'security_infra', name: '보안 & 인프라', shortName: '보안/인프라', icon: '🔒', max: 15, defaultDesc: 'SSL 보안 인증 및 서버 응답 인프라' },
	{ id: 'web_perf_access', name: '웹 성능 & 접근성', shortName: '성능/접근성', icon: '⚡', max: 12, defaultDesc: '문서 경량화 및 리소스 차단 최적화' },
	{ id: 'basic_seo', name: 'SEO 기술 기본기', shortName: '검색 기초', icon: '🔎', max: 29, defaultDesc: '메타·헤딩·시맨틱 온페이지 기본기' },
	{ id: 'schema_data', name: '스키마 구조화 데이터', shortName: '구조화 데이터', icon: '🧩', max: 36, defaultDesc: 'W3C JSON-LD 및 엔티티 지식그래프' },
	{ id: 'geo_ai_signals', name: 'GEO & AI 인용 신호', shortName: 'AI 인용 신호', icon: '🤖', max: 30, defaultDesc: '/llms.txt 및 AI 검색엔진 인용 신호' },
] as const;

export const STANDARD_CATEGORY_IDS: readonly StandardCategoryId[] = CATEGORY_DEFINITIONS.map((def) => def.id);

export const STANDARD_CATEGORY_NAMES: Record<StandardCategoryId, { ko: string; en: string }> = {
	security_infra: { ko: '보안 & 인프라', en: 'Security & Infrastructure' },
	web_perf_access: { ko: '웹 성능 & 접근성', en: 'Web Performance & Accessibility' },
	basic_seo: { ko: 'SEO 기술 기본기', en: 'SEO Technical Fundamentals' },
	schema_data: { ko: '스키마 구조화 데이터', en: 'Structured Data (Schema)' },
	geo_ai_signals: { ko: 'GEO & AI 인용 신호', en: 'GEO & AI Citation Signals' },
};

export const STANDARD_CATEGORY_MAX: Record<StandardCategoryId, number> = {
	security_infra: CHECKLIST_CATEGORY_MAX.security_infra,
	web_perf_access: CHECKLIST_CATEGORY_MAX.web_perf_access,
	basic_seo: CHECKLIST_CATEGORY_MAX.basic_seo,
	schema_data: CHECKLIST_CATEGORY_MAX.schema_data,
	geo_ai_signals: CHECKLIST_CATEGORY_MAX.geo_ai_signals,
};

export const STANDARD_CATEGORY_TOTAL_MAX = CHECKLIST_TOTAL_MAX;

/** Diagnostic UI ids stay 1:1 with the five standard buckets. */
export type DiagnosticUiId = 'security' | 'performance' | 'seo' | 'schema' | 'geo';

export const STANDARD_TO_DIAGNOSTIC_ID: Record<StandardCategoryId, DiagnosticUiId> = {
	security_infra: 'security',
	web_perf_access: 'performance',
	basic_seo: 'seo',
	schema_data: 'schema',
	geo_ai_signals: 'geo',
};

export const DIAGNOSTIC_TO_STANDARD_ID: Record<DiagnosticUiId, StandardCategoryId> = {
	security: 'security_infra',
	performance: 'web_perf_access',
	seo: 'basic_seo',
	schema: 'schema_data',
	geo: 'geo_ai_signals',
};

const LEGACY_ID_ALIASES: Record<string, string> = {
	meta: 'meta-description',
	og: 'og-tags',
	ttfb: 'response-time',
	weight: 'page-weight',
	lang: 'html-lang',
	alt: 'image-alt',
	jsonld: 'jsonld-present',
	org: 'organization',
	faq: 'faq-howto-schema',
	bots: 'ai-bots-allowed',
	skip: 'heading-skip',
	ssl: 'https',
	ssl_https: 'https',
	https: 'https',
};

const LEGACY_CATEGORY_ALIASES: Record<string, StandardCategoryId> = {
	security_perf: 'security_infra',
	schema: 'schema_data',
	geo_eeat: 'geo_ai_signals',
	accessibility: 'web_perf_access',
};

const STANDARD_CATEGORY_SET = new Set<string>(STANDARD_CATEGORY_IDS);

function roundRaw(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.round(n * 10) / 10;
}

function itemMax(item: CategoryChecklistItem): number {
	const n = Number(item.maxScore ?? item.weight ?? 0);
	return Number.isFinite(n) && n > 0 ? n : 0;
}

function verdictOf(item: CategoryChecklistItem): 'pass' | 'warning' | 'fail' {
	if (item.status === 'pass' || item.status === 'warning' || item.status === 'fail') return item.status;
	return item.passed ? 'pass' : 'fail';
}

/** Pass = full weight, Warning = half, Fail = 0. Honors explicit earnedScore. Never exceeds max. */
export function earnedScoreForItem(item: CategoryChecklistItem): number {
	const max = itemMax(item);
	if (Number.isFinite(item.earnedScore)) {
		const earned = Number(item.earnedScore);
		if (!Number.isFinite(earned)) return 0;
		return roundRaw(Math.min(max || Math.max(0, earned), Math.max(0, earned)));
	}
	const verdict = verdictOf(item);
	if (verdict === 'pass') return max;
	if (verdict === 'warning') return roundRaw(max * 0.5);
	return 0;
}

function normalizeLookupId(raw?: string | null): string {
	const id = (raw || '').trim();
	if (!id) return '';
	return LEGACY_ID_ALIASES[id] || id;
}

export function isStandardCategoryId(id: string | undefined | null): id is StandardCategoryId {
	return Boolean(id && STANDARD_CATEGORY_SET.has(id));
}

function resolvePLevel(item: CategoryChecklistItem): ChecklistPLevel | undefined {
	if (item.pLevel === 'P0' || item.pLevel === 'P1' || item.pLevel === 'P2' || item.pLevel === 'P3' || item.pLevel === 'P4' || item.pLevel === 'P5') {
		return item.pLevel;
	}
	const engineId = normalizeLookupId(item.id);
	const def = engineId ? checklistDefForEngineId(engineId) ?? checklistDefById(engineId) : undefined;
	return def?.pLevel;
}

/**
 * Classify by engine/definition id first. A stored `item.category` is used
 * only when it is already a standard id — leftover 4-bucket tags are remapped.
 */
export function resolveItemCategory(item: CategoryChecklistItem): StandardCategoryId | null {
	const engineId = normalizeLookupId(item.id);
	if (engineId) {
		const def = checklistDefForEngineId(engineId) ?? checklistDefById(engineId);
		if (def) return def.category;
		const mappedDefId = ENGINE_CHECK_TO_DEFINITION_ID[engineId];
		if (mappedDefId) {
			const mapped = checklistDefById(mappedDefId);
			if (mapped) return mapped.category;
		}
	}
	if (isStandardCategoryId(item.category)) return item.category;
	if (item.category && LEGACY_CATEGORY_ALIASES[item.category]) {
		return LEGACY_CATEGORY_ALIASES[item.category];
	}
	return null;
}

export function engineIdsForCategory(category: StandardCategoryId): string[] {
	return Object.entries(ENGINE_CHECK_TO_DEFINITION_ID)
		.filter(([, defId]) => checklistDefById(defId)?.category === category)
		.map(([engineId]) => engineId);
}

function emptyBuckets<T>(): Record<StandardCategoryId, T[]> {
	return {
		security_infra: [],
		web_perf_access: [],
		basic_seo: [],
		schema_data: [],
		geo_ai_signals: [],
	};
}

export function bucketChecksByCategory<T extends CategoryChecklistItem>(
	items: readonly T[],
): Record<StandardCategoryId, T[]> {
	const buckets = emptyBuckets<T>();
	for (const item of items) {
		const cat = resolveItemCategory(item);
		if (cat) buckets[cat].push(item);
	}
	return buckets;
}

export function calculate5CategoryScores(
	checklist: readonly CategoryChecklistItem[] = [],
	isHttps: boolean,
): {
	categories: CategoryAggregateResult[];
	radarData: RadarAxisPoint[];
	radarScores: RadarAxisScores;
	totalEarned: number;
	totalMax: number;
} {
	const buckets = bucketChecksByCategory(checklist);

	const categories: CategoryAggregateResult[] = CATEGORY_DEFINITIONS.map((def) => {
		const items = buckets[def.id];
		let earned = items.reduce((sum, item) => sum + earnedScoreForItem(item), 0);
		earned = roundRaw(Math.min(def.max, Math.max(0, earned)));
		const percentage = normalizeTo100(earned, def.max);

		const failCount = items.filter((item) => verdictOf(item) === 'fail' && resolvePLevel(item) === 'P0').length;
		const warnCount = items.filter((item) => {
			const verdict = verdictOf(item);
			if (verdict === 'pass') return false;
			return resolvePLevel(item) !== 'P0';
		}).length;
		const defectCount = items.filter((item) => verdictOf(item) === 'fail').length;
		const warningCount = items.filter((item) => verdictOf(item) === 'warning').length;

		let status = resolveCategoryVerdict(percentage, defectCount, warningCount);
		if (!isHttps && def.id === 'security_infra') status = 'Fail';

		return {
			id: def.id,
			name: def.name,
			shortName: def.shortName,
			icon: def.icon,
			earned,
			max: def.max,
			percentage,
			status,
			failCount,
			warnCount,
			defectCount,
			warningCount,
			description: def.defaultDesc,
		};
	});

	const radarData = categories.map((cat) => ({
		subject: cat.shortName,
		score: cat.percentage,
		fullMark: 100,
	}));

	const byId = Object.fromEntries(categories.map((cat) => [cat.id, cat])) as Record<
		StandardCategoryId,
		CategoryAggregateResult
	>;
	const radarScores: RadarAxisScores = {
		security: byId.security_infra.percentage,
		performance: byId.web_perf_access.percentage,
		seo: byId.basic_seo.percentage,
		schema: byId.schema_data.percentage,
		geoSignal: byId.geo_ai_signals.percentage,
	};

	const totalEarned = roundRaw(categories.reduce((sum, cat) => sum + cat.earned, 0));
	const totalMax = STANDARD_CATEGORY_TOTAL_MAX;

	return { categories, radarData, radarScores, totalEarned, totalMax };
}

export function aggregateCategoryScores(
	checklistResults: readonly CategoryChecklistItem[] = [],
	isHttps?: boolean,
): CategoryScoreSummary[] {
	const { categories } = calculate5CategoryScores(checklistResults, isHttps !== false);
	return categories.map((cat) => ({
		id: cat.id,
		name: cat.name,
		earned: cat.earned,
		max: cat.max,
		percentage: cat.percentage,
		detailText: cat.description,
	}));
}

export function categorySummaryById(
	summaries: readonly CategoryScoreSummary[],
): Record<StandardCategoryId, CategoryScoreSummary> {
	const byId = Object.fromEntries(summaries.map((row) => [row.id, row])) as Record<
		StandardCategoryId,
		CategoryScoreSummary
	>;
	for (const id of STANDARD_CATEGORY_IDS) {
		if (!byId[id]) {
			byId[id] = {
				id,
				name: STANDARD_CATEGORY_NAMES[id].ko,
				earned: 0,
				max: STANDARD_CATEGORY_MAX[id],
				percentage: 0,
			};
		}
	}
	return byId;
}

/**
 * 5-axis radar — 100% synced to the five standard categories.
 * 보안/인프라 · 성능/접근성 · 검색 기초 · 구조화 데이터 · AI 인용 신호
 */
export function buildSyncedRadarScores(
	checklistResults: readonly CategoryChecklistItem[] = [],
	isHttps: boolean,
	_summaries?: readonly CategoryScoreSummary[],
): RadarAxisScores {
	return calculate5CategoryScores(checklistResults, isHttps).radarScores;
}

export function assertCategoryIntegrity(summaries: readonly CategoryScoreSummary[]): boolean {
	return summaries.every((row) => row.earned <= row.max && row.earned >= 0);
}

export const STANDARD_CATEGORY_ITEM_COUNT: Record<StandardCategoryId, number> = AUDIT_CHECKLIST_DEFINITIONS.reduce(
	(acc, item) => {
		acc[item.category] += 1;
		return acc;
	},
	{
		security_infra: 0,
		web_perf_access: 0,
		basic_seo: 0,
		schema_data: 0,
		geo_ai_signals: 0,
	},
);
