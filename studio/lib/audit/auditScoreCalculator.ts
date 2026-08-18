/**
 * AuditScore — single source of truth for technical scores, grades, and
 * 5-category status badges (양호 / 주의 / 미흡).
 *
 * Every surface (live engine, result detail, /audit/history, localStorage
 * replay) must run stored or live numbers through this module. Do not
 * re-implement 122↔100 conversion, S/A/B/C/D bands, or category verdicts.
 *
 *   totalEarnedScore / totalMaxScore   raw checklist points (e.g. 65.5 / 122)
 *   normalizedScore                    weighted 100-point headline (e.g. 54)
 *   grade                              S / A / B / C/D from the 100-point score
 *   category.percentage                earned / max * 100 (not a simple average input)
 *   category.status                    양호 ≥90 · 주의 50–89 · 미흡 <50
 */

import { CHECKLIST_CATEGORY_MAX, CHECKLIST_TOTAL_MAX } from '@/lib/audit/checklistDefinitions';
import { gradeForHttps, gradeForScore, type ScoreGrade } from '@/lib/audit/score-grade';

export const AUDIT_CATEGORY_CONFIG = {
	security: { name: '보안 & 인프라', maxScore: CHECKLIST_CATEGORY_MAX.security_infra },
	performance: { name: '웹 성능 & 접근성', maxScore: CHECKLIST_CATEGORY_MAX.web_perf_access },
	seoBasic: { name: 'SEO 기술 기본기', maxScore: CHECKLIST_CATEGORY_MAX.basic_seo },
	schema: { name: '스키마 구조화 데이터', maxScore: CHECKLIST_CATEGORY_MAX.schema_data },
	geoAi: { name: 'GEO & AI 인용 신호', maxScore: CHECKLIST_CATEGORY_MAX.geo_ai_signals },
} as const;

export type CategoryKey = keyof typeof AUDIT_CATEGORY_CONFIG;
export type AuditStatus = 'good' | 'warning' | 'poor';
export type AuditGrade = ScoreGrade;
export type AuditStatusLabel = '양호' | '주의' | '미흡';

export const CATEGORY_KEYS = Object.keys(AUDIT_CATEGORY_CONFIG) as CategoryKey[];

export const AUDIT_TOTAL_MAX_SCORE = CHECKLIST_TOTAL_MAX;

export const AUDIT_STATUS_LABEL: Record<AuditStatus, AuditStatusLabel> = {
	good: '양호',
	warning: '주의',
	poor: '미흡',
};

export const AUDIT_GRADE_LABEL: Record<AuditGrade, { ko: string; en: string }> = {
	S: { ko: '최우수', en: 'Outstanding' },
	A: { ko: '우수', en: 'Excellent' },
	B: { ko: '보통 / 양호', en: 'Good / Fair' },
	'C/D': { ko: '미흡 / 위험', en: 'Poor / At risk' },
};

export interface CategoryDefinition {
	id: CategoryKey;
	name: string;
	maxScore: number;
}

/** Canonical 5-category scale (15 + 12 + 29 + 36 + 30 = 122). */
export const CATEGORY_DEFINITIONS: Record<CategoryKey, CategoryDefinition> = {
	security: { id: 'security', name: AUDIT_CATEGORY_CONFIG.security.name, maxScore: AUDIT_CATEGORY_CONFIG.security.maxScore },
	performance: { id: 'performance', name: AUDIT_CATEGORY_CONFIG.performance.name, maxScore: AUDIT_CATEGORY_CONFIG.performance.maxScore },
	seoBasic: { id: 'seoBasic', name: AUDIT_CATEGORY_CONFIG.seoBasic.name, maxScore: AUDIT_CATEGORY_CONFIG.seoBasic.maxScore },
	schema: { id: 'schema', name: AUDIT_CATEGORY_CONFIG.schema.name, maxScore: AUDIT_CATEGORY_CONFIG.schema.maxScore },
	geoAi: { id: 'geoAi', name: AUDIT_CATEGORY_CONFIG.geoAi.name, maxScore: AUDIT_CATEGORY_CONFIG.geoAi.maxScore },
};

export const AUDIT_STATUS_BADGE: Record<AuditStatus, { text: string; bg: string; border: string }> = {
	good: {
		text: 'text-emerald-700 dark:text-emerald-400',
		bg: 'bg-emerald-50 dark:bg-emerald-950/60',
		border: 'border-emerald-200 dark:border-emerald-800',
	},
	warning: {
		text: 'text-amber-800 dark:text-amber-400',
		bg: 'bg-amber-50 dark:bg-amber-950/60',
		border: 'border-amber-200 dark:border-amber-800',
	},
	poor: {
		text: 'text-rose-700 dark:text-rose-400',
		bg: 'bg-rose-50 dark:bg-rose-950/60',
		border: 'border-rose-200 dark:border-rose-800',
	},
};

export const CATEGORY_KEY_ALIASES: Record<string, CategoryKey> = {
	security: 'security',
	security_infra: 'security',
	performance: 'performance',
	web_perf_access: 'performance',
	seoBasic: 'seoBasic',
	seo: 'seoBasic',
	basic_seo: 'seoBasic',
	schema: 'schema',
	schema_data: 'schema',
	geoAi: 'geoAi',
	geo: 'geoAi',
	geo_ai_signals: 'geoAi',
};

export const CATEGORY_TO_DIAGNOSTIC_ID: Record<CategoryKey, 'security' | 'performance' | 'seo' | 'schema' | 'geo'> = {
	security: 'security',
	performance: 'performance',
	seoBasic: 'seo',
	schema: 'schema',
	geoAi: 'geo',
};

export const CATEGORY_ICON: Record<CategoryKey, string> = {
	security: '🔒',
	performance: '⚡',
	seoBasic: '🔎',
	schema: '🧩',
	geoAi: '🤖',
};

export interface RawCategoryInput {
	score: number;
	maxScore?: number;
	defectCount?: number;
	warningCount?: number;
	name?: string;
}

export interface CalculatedCategory {
	id: CategoryKey;
	name: string;
	score: number;
	maxScore: number;
	percentage: number;
	status: AuditStatus;
	statusLabel: AuditStatusLabel;
	badgeStyle: {
		text: string;
		bg: string;
		border: string;
	};
	summaryText: string;
	defectCount: number;
	warningCount: number;
}

export interface ComprehensiveAuditScore {
	totalEarnedScore: number;
	totalMaxScore: number;
	normalizedScore: number;
	grade: AuditGrade;
	gradeLabel: string;
	categories: Record<CategoryKey, CalculatedCategory>;
	categoryList: CalculatedCategory[];
	isHttps: boolean;
}

export interface ComprehensiveAuditInput {
	categories?: Partial<Record<string, RawCategoryInput>>;
	categoryList?: Array<RawCategoryInput & { id: string }>;
	totalEarnedScore?: number;
	totalMaxScore?: number;
	isHttps?: boolean;
	lang?: 'ko' | 'en';
}

export interface OnpageScoreInput {
	totalRawScore: number;
	maxPossibleScore: number;
	categories: ReadonlyArray<{
		id: string;
		name?: string;
		rawScore: number;
		maxScore: number;
		defectCount?: number;
		warningCount?: number;
	}>;
}

export function resolveCategoryKey(id: string | null | undefined): CategoryKey | null {
	if (!id) return null;
	return CATEGORY_KEY_ALIASES[id] ?? (id in AUDIT_CATEGORY_CONFIG ? (id as CategoryKey) : null);
}

export function roundRawPoints(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.round(n * 10) / 10;
}

export function formatRawPoints(n: number): string {
	const rounded = roundRawPoints(n);
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** `normalizedScore = round((raw / max) * 100)` — clamped 0–100. */
export function normalizeTo100(rawScore: number, maxScore: number = AUDIT_TOTAL_MAX_SCORE): number {
	if (!Number.isFinite(rawScore) || !Number.isFinite(maxScore) || maxScore <= 0) return 0;
	return Math.min(100, Math.max(0, Math.round((rawScore / maxScore) * 100)));
}

/**
 * 5-category badge bands — achievement rate only (defects/warnings stay in the footer):
 *   good    — 달성률 ≥ 90%
 *   warning — 50% ≤ 달성률 < 90%
 *   poor    — 달성률 < 50%
 *
 * `defects` / `warnings` are accepted for call-site compatibility and ignored.
 */
export function resolveAuditStatus(percentage: number, _defects = 0, _warnings = 0): AuditStatus {
	const score = Number.isFinite(percentage) ? percentage : 0;
	if (score >= 90) return 'good';
	if (score >= 50) return 'warning';
	return 'poor';
}

export function auditStatusToDiagnostic(status: AuditStatus): 'pass' | 'warning' | 'fail' {
	if (status === 'good') return 'pass';
	if (status === 'warning') return 'warning';
	return 'fail';
}

export function auditStatusToStored(status: AuditStatus): 'PASS' | 'WARN' | 'FAIL' {
	if (status === 'good') return 'PASS';
	if (status === 'warning') return 'WARN';
	return 'FAIL';
}

export function storedStatusToCounts(status: string | undefined): { defectCount: number; warningCount: number } {
	const key = (status ?? '').trim().toUpperCase();
	if (key === 'FAIL') return { defectCount: 1, warningCount: 0 };
	if (key === 'WARN' || key === 'WARNING') return { defectCount: 0, warningCount: 1 };
	return { defectCount: 0, warningCount: 0 };
}

export function gradeFromNormalizedScore(score: number, isHttps = true): AuditGrade {
	return isHttps ? gradeForScore(score) : gradeForHttps(score, false);
}

export function gradeLabelForScore(grade: AuditGrade, lang: 'ko' | 'en' = 'ko'): string {
	return AUDIT_GRADE_LABEL[grade][lang];
}

export function summaryTextForStatus(status: AuditStatus, defectCount = 0, warningCount = 0): string {
	if (defectCount > 0) return `결함 ${defectCount}건`;
	if (warningCount > 0) return `주의 ${warningCount}건`;
	if (status === 'good') return '정상 / 우수 ✓';
	if (status === 'warning') return '보완 권장';
	return '달성률 미흡';
}

export function calculateCategory(id: CategoryKey, input: RawCategoryInput): CalculatedCategory {
	const config = AUDIT_CATEGORY_CONFIG[id];
	const maxScore =
		Number.isFinite(input.maxScore) && (input.maxScore ?? 0) > 0 ? Number(input.maxScore) : config.maxScore;
	const score = roundRawPoints(Math.min(maxScore, Math.max(0, Number(input.score) || 0)));
	const percentage = normalizeTo100(score, maxScore);
	const defectCount = Number.isFinite(input.defectCount) ? Math.max(0, Math.floor(Number(input.defectCount))) : 0;
	const warningCount = Number.isFinite(input.warningCount) ? Math.max(0, Math.floor(Number(input.warningCount))) : 0;
	const status = resolveAuditStatus(percentage, defectCount, warningCount);
	return {
		id,
		name: input.name?.trim() || config.name,
		score,
		maxScore,
		percentage,
		status,
		statusLabel: AUDIT_STATUS_LABEL[status],
		badgeStyle: AUDIT_STATUS_BADGE[status],
		summaryText: summaryTextForStatus(status, defectCount, warningCount),
		defectCount,
		warningCount,
	};
}

function emptyCategoryMap(): Record<CategoryKey, CalculatedCategory> {
	return {
		security: calculateCategory('security', { score: 0 }),
		performance: calculateCategory('performance', { score: 0 }),
		seoBasic: calculateCategory('seoBasic', { score: 0 }),
		schema: calculateCategory('schema', { score: 0 }),
		geoAi: calculateCategory('geoAi', { score: 0 }),
	};
}

function mergeCategoryInput(
	target: Partial<Record<CategoryKey, RawCategoryInput>>,
	id: string,
	input: RawCategoryInput,
): void {
	const key = resolveCategoryKey(id);
	if (!key) return;
	const prev = target[key];
	if (!prev) {
		target[key] = { ...input };
		return;
	}
	target[key] = {
		score: (Number(prev.score) || 0) + (Number(input.score) || 0),
		maxScore: (Number(prev.maxScore) || 0) + (Number(input.maxScore) || 0),
		defectCount: (prev.defectCount ?? 0) + (input.defectCount ?? 0),
		warningCount: (prev.warningCount ?? 0) + (input.warningCount ?? 0),
		name: input.name || prev.name,
	};
}

export function calculateComprehensiveAuditScore(input: ComprehensiveAuditInput = {}): ComprehensiveAuditScore {
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const isHttps = input.isHttps !== false;
	const merged: Partial<Record<CategoryKey, RawCategoryInput>> = {};

	if (input.categories) {
		for (const [id, raw] of Object.entries(input.categories)) {
			if (raw) mergeCategoryInput(merged, id, raw);
		}
	}
	if (input.categoryList) {
		for (const raw of input.categoryList) {
			mergeCategoryInput(merged, raw.id, raw);
		}
	}

	const categories = emptyCategoryMap();
	for (const key of CATEGORY_KEYS) {
		const raw = merged[key];
		if (raw) categories[key] = calculateCategory(key, raw);
	}

	const categoryList = CATEGORY_KEYS.map((key) => categories[key]);
	const summedEarned = roundRawPoints(categoryList.reduce((sum, cat) => sum + cat.score, 0));
	const summedMax = categoryList.reduce((sum, cat) => sum + cat.maxScore, 0);

	const hasCategoryInput = Boolean(
		(input.categories && Object.keys(input.categories).length > 0) ||
			(input.categoryList && input.categoryList.length > 0),
	);
	const hasExplicitEarned = Number.isFinite(input.totalEarnedScore);
	const hasExplicitMax = Number.isFinite(input.totalMaxScore) && (input.totalMaxScore ?? 0) > 0;
	const totalEarnedScore = hasCategoryInput
		? summedEarned
		: hasExplicitEarned
			? roundRawPoints(Math.max(0, Number(input.totalEarnedScore)))
			: summedEarned;
	const totalMaxScore = hasCategoryInput
		? summedMax || AUDIT_TOTAL_MAX_SCORE
		: hasExplicitMax
			? Number(input.totalMaxScore)
			: summedMax || AUDIT_TOTAL_MAX_SCORE;
	const normalizedScore = normalizeTo100(totalEarnedScore, totalMaxScore);
	const grade = gradeFromNormalizedScore(normalizedScore, isHttps);

	return {
		totalEarnedScore,
		totalMaxScore,
		normalizedScore,
		grade,
		gradeLabel: gradeLabelForScore(grade, lang),
		categories,
		categoryList,
		isHttps,
	};
}

export function calculateComprehensiveAuditScoreFromOnpage(
	onpage: OnpageScoreInput,
	options?: { isHttps?: boolean; lang?: 'ko' | 'en' },
): ComprehensiveAuditScore {
	return calculateComprehensiveAuditScore({
		categoryList: onpage.categories.map((cat) => ({
			id: cat.id,
			name: cat.name,
			score: cat.rawScore,
			maxScore: cat.maxScore,
			defectCount: cat.defectCount,
			warningCount: cat.warningCount,
		})),
		isHttps: options?.isHttps,
		lang: options?.lang,
	});
}

/** Canonical crawl/storage packet — always hydrate through `calculateComprehensiveAuditScore`. */
export interface RawAuditPayload {
	url?: string | null;
	hasSsl?: boolean | null;
	lang?: 'ko' | 'en';
	categories?: ComprehensiveAuditInput['categories'];
	categoryList?: ComprehensiveAuditInput['categoryList'];
	totalEarnedScore?: number;
	totalMaxScore?: number;
}

export function calculateAuditScoreFromPayload(payload: RawAuditPayload): ComprehensiveAuditScore {
	return calculateComprehensiveAuditScore({
		categories: payload.categories,
		categoryList: payload.categoryList,
		totalEarnedScore: payload.totalEarnedScore,
		totalMaxScore: payload.totalMaxScore,
		isHttps: payload.hasSsl !== false,
		lang: payload.lang,
	});
}

export interface RawCategoryResult {
	score: number;
	defectCount?: number;
	warningCount?: number;
}

export interface EvaluatedCategory {
	id: CategoryKey;
	name: string;
	earnedScore: number;
	maxScore: number;
	percentage: number;
	status: AuditStatus;
	statusLabel: AuditStatusLabel;
	defectCount: number;
	warningCount: number;
}

export interface EvaluatedAuditData {
	totalEarnedScore: number;
	totalMaxScore: number;
	normalizedTotalScore: number;
	grade: AuditGrade;
	gradeText: string;
	categories: EvaluatedCategory[];
}

/**
 * Project-wide entry: weighted raw total → 100-point headline, plus
 * per-category earned / max / achievement % / 양호·주의·미흡.
 */
export function evaluateAuditData(
	rawResults: Record<string, RawCategoryResult>,
	options?: { isHttps?: boolean; lang?: 'ko' | 'en' },
): EvaluatedAuditData {
	const packet = calculateComprehensiveAuditScore({
		categories: rawResults,
		isHttps: options?.isHttps,
		lang: options?.lang,
	});
	return {
		totalEarnedScore: packet.totalEarnedScore,
		totalMaxScore: packet.totalMaxScore,
		normalizedTotalScore: packet.normalizedScore,
		grade: packet.grade,
		gradeText: packet.gradeLabel,
		categories: packet.categoryList.map((cat) => ({
			id: cat.id,
			name: cat.name,
			earnedScore: cat.score,
			maxScore: cat.maxScore,
			percentage: cat.percentage,
			status: cat.status,
			statusLabel: cat.statusLabel,
			defectCount: cat.defectCount,
			warningCount: cat.warningCount,
		})),
	};
}
