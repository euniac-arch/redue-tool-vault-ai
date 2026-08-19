/**
 * On-page SEO·GEO·Schema diagnostic — single source of truth.
 *
 * Weighted raw score  →  100-point headline
 *   maxPossibleScore   = Σ checklist.maxScore  (never a hardcoded 122)
 *   normalizedScore100 = Math.round((totalRawScore / maxPossibleScore) * 100)
 *
 * Five standard categories (15 + 12 + 29 + 36 + 30 = 122) are classified by
 * checklist item id via `categoryAggregator` — never by a stored bucket tag.
 */

import {
	applyChecklistDefinitionWeights,
	CHECKLIST_TOTAL_MAX,
	resolveMaxRawScore,
} from '@/lib/audit/checklistDefinitions';
import {
	AUDIT_TOTAL_MAX_SCORE,
	auditStatusToDiagnostic,
	normalizeTo100,
	resolveAuditStatus,
	roundRawPoints,
	summaryTextForStatus,
	type AuditStatus,
} from '@/lib/audit/auditScoreCalculator';
import {
	DIAGNOSTIC_TO_STANDARD_ID,
	STANDARD_CATEGORY_MAX,
	aggregateCategoryScores,
	bucketChecksByCategory,
	categorySummaryById,
} from '@/lib/audit/categoryAggregator';
import { runScorePipeline } from '@/lib/audit/scorePipeline';
import {
	coreEntityItemCopy,
	detectSchemaVertical,
	hasCoreEntitySchema,
	isNewsMediaVertical,
	type SchemaVertical,
} from '@/lib/audit/recommended-schemas';
import { topPercentileFromScore } from '@/lib/audit/score-grade';
import { ensureLlmsTxtChecklistItem } from '@/lib/audit/llms-txt-check';
import {
	HTTPS_CHECK_ID,
	applyHttpsRawPenalty,
	ensureHttpsChecklistItem,
	resolveIsHttps,
} from '@/lib/audit/scoreCalculator';
import type { AuditCheckItem, AuditLang, AuditReport } from '@/lib/site-auditor';

export { topPercentileFromScore };

export const ONPAGE_MAX_SCORE = CHECKLIST_TOTAL_MAX;

export type DiagnosticCategoryId = 'security' | 'performance' | 'seo' | 'schema' | 'geo';
export type DiagnosticGroupId = DiagnosticCategoryId;
export type DiagnosticStatus = 'pass' | 'warning' | 'fail';
export type DiagnosticGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export const CATEGORY_MAX_SCORES: Record<DiagnosticCategoryId, number> = {
	security: STANDARD_CATEGORY_MAX.security_infra,
	performance: STANDARD_CATEGORY_MAX.web_perf_access,
	seo: STANDARD_CATEGORY_MAX.basic_seo,
	schema: STANDARD_CATEGORY_MAX.schema_data,
	geo: STANDARD_CATEGORY_MAX.geo_ai_signals,
};

export const GROUP_MAX_SCORES: Record<DiagnosticGroupId, number> = {
	security: CATEGORY_MAX_SCORES.security,
	performance: CATEGORY_MAX_SCORES.performance,
	seo: CATEGORY_MAX_SCORES.seo,
	schema: CATEGORY_MAX_SCORES.schema,
	geo: CATEGORY_MAX_SCORES.geo,
};

export const CANONICAL_CATEGORY_IDS: readonly DiagnosticCategoryId[] = [
	'security',
	'performance',
	'seo',
	'schema',
	'geo',
] as const;

export const CANONICAL_GROUP_IDS: readonly DiagnosticGroupId[] = CANONICAL_CATEGORY_IDS;

const CATEGORY_GROUP: Record<DiagnosticCategoryId, DiagnosticGroupId> = {
	security: 'security',
	performance: 'performance',
	seo: 'seo',
	schema: 'schema',
	geo: 'geo',
};

const CATEGORY_DEFAULT_NAMES: Record<DiagnosticCategoryId, Record<AuditLang, string>> = {
	security: { ko: '보안 & 인프라', en: 'Security & Infrastructure' },
	performance: { ko: '웹 성능 & 접근성', en: 'Web Performance & Accessibility' },
	seo: { ko: 'SEO 기술 기본기', en: 'SEO Technical Fundamentals' },
	schema: { ko: '스키마 구조화 데이터', en: 'Structured Data (Schema)' },
	geo: { ko: 'GEO & AI 인용 신호', en: 'GEO & AI Citation Signals' },
};

export const CATEGORY_STATUS_TEXT: Record<
	DiagnosticCategoryId,
	Record<AuditLang, Record<DiagnosticStatus, string>>
> = {
	security: {
		ko: {
			pass: 'SSL·서버 응답 양호',
			warning: '보안/응답 속도 주의',
			fail: 'SSL 또는 서버 응답 개선 필요',
		},
		en: {
			pass: 'SSL and server response look healthy',
			warning: 'Security/response needs attention',
			fail: 'SSL or server response needs improvement',
		},
	},
	performance: {
		ko: {
			pass: '문서 경량화·접근성 양호',
			warning: '용량/렌더 차단/alt 주의',
			fail: '성능 또는 접근성 개선 필요',
		},
		en: {
			pass: 'Document weight & accessibility look healthy',
			warning: 'Size/render-blocking/alt needs attention',
			fail: 'Performance or accessibility needs improvement',
		},
	},
	seo: {
		ko: {
			pass: '메타·헤딩 기본기 양호',
			warning: '메타·헤딩 보완 필요',
			fail: '핵심 메타/헤딩 구조 미흡',
		},
		en: {
			pass: 'Meta & heading fundamentals look solid',
			warning: 'Meta & heading need attention',
			fail: 'Core meta/heading structure is weak',
		},
	},
	schema: {
		ko: {
			pass: '리치 결과·지식그래프 대응',
			warning: '스키마 일부 누락',
			fail: '스키마 커버리지 부족',
		},
		en: {
			pass: 'Rich-result & knowledge-graph ready',
			warning: 'Schema coverage is incomplete',
			fail: 'Schema coverage is insufficient',
		},
	},
	geo: {
		ko: {
			pass: 'AI 인용 신호 양호',
			warning: 'AI 인용 신호 보완 필요',
			fail: 'AI 답변 인용 가능성 낮음',
		},
		en: {
			pass: 'Strong AI citation signals',
			warning: 'AI citation signals need work',
			fail: 'Low chance of AI answer citation',
		},
	},
};

export interface DiagnosticCategory {
	id: DiagnosticCategoryId;
	name: string;
	maxScore: number;
	rawScore: number;
	score100: number;
	status: DiagnosticStatus;
	statusText: string;
	defectCount: number;
	warningCount: number;
	groupId: DiagnosticGroupId;
	/** Measured checklist rows for this category (fail / warning / pass). */
	checks: AuditCheckItem[];
}

export interface DiagnosticGroup {
	id: DiagnosticGroupId;
	maxScore: number;
	rawScore: number;
	score100: number;
	status: DiagnosticStatus;
	defectCount: number;
	warningCount: number;
	categoryIds: DiagnosticCategoryId[];
}

export interface OnPageDiagnosticProps {
	totalRawScore: number;
	maxPossibleScore: number;
	normalizedScore: number;
	grade: DiagnosticGrade;
	percentile: number;
	categories: DiagnosticCategory[];
	groups: DiagnosticGroup[];
}

export function isDiagnosticCategoryId(id: string): id is DiagnosticCategoryId {
	return (CANONICAL_CATEGORY_IDS as readonly string[]).includes(id);
}

export const roundRawScore = roundRawPoints;

export function formatRawScore(n: number): string {
	const rounded = roundRawScore(n);
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** `normalizedScore100 = Math.round((raw / max) * 100)` — clamped 0–100. */
export function normalizeScore100(rawScore: number, maxScore: number = ONPAGE_MAX_SCORE): number {
	return normalizeTo100(rawScore, maxScore || AUDIT_TOTAL_MAX_SCORE);
}

/**
 * Academic A–F on the 100-point headline.
 * Aligns with Pass (≥80) / Warning (60–79) / Fail (<60) bands.
 */
export function diagnosticGradeFromScore(normalizedScore: number): DiagnosticGrade {
	const n = normalizeScore100(normalizedScore, 100);
	if (n >= 90) return 'A';
	if (n >= 80) return 'B';
	if (n >= 70) return 'C';
	if (n >= 60) return 'D';
	return 'F';
}

export function checkVerdict(check: Pick<AuditCheckItem, 'status' | 'passed'>): DiagnosticStatus {
	if (check.status === 'pass' || check.status === 'warning' || check.status === 'fail') {
		return check.status;
	}
	return check.passed ? 'pass' : 'fail';
}

/** Weighted raw points from Pass = full, Warning = half, Fail = 0. */
export function scoreFromChecks(
	checks: ReadonlyArray<Pick<AuditCheckItem, 'status' | 'passed' | 'weight'>>,
): number {
	const score = checks.reduce((sum, check) => {
		const verdict = checkVerdict(check);
		const weight = Number.isFinite(check.weight) ? check.weight : 0;
		if (verdict === 'pass') return sum + weight;
		if (verdict === 'warning') return sum + weight * 0.5;
		return sum;
	}, 0);
	return roundRawScore(score);
}

/** Earned raw points for one checklist row (HTTPS fail = 0). */
export function earnedPointsForCheck(
	check: Pick<AuditCheckItem, 'status' | 'passed' | 'weight'>,
): number {
	return scoreFromChecks([check]);
}

/**
 * Official raw from the same checklist the table renders.
 * HTTPS is a regular slot inside the dynamic max. Stored reports that
 * predate that slot still lose those points via `applyHttpsRawPenalty`.
 */
export function rawTechnicalScoreFromChecks(
	checks: ReadonlyArray<Pick<AuditCheckItem, 'id' | 'status' | 'passed' | 'weight'>>,
	isHttps: boolean,
): number {
	const hasHttpsRow = checks.some((check) => check.id === HTTPS_CHECK_ID);
	if (hasHttpsRow) return scoreFromChecks(checks);
	return roundRawScore(applyHttpsRawPenalty(scoreFromChecks(checks), isHttps));
}

export function schemaMappingFromAudit(
	report?: Partial<Pick<AuditReport, 'siteMeta' | 'metrics'>> | null,
): {
	industry?: string;
	category?: string;
	siteTitle?: string;
	brandName?: string;
	domain?: string;
	primaryKeyword?: string;
	industryType?: string;
	schemaTypes?: readonly string[];
} {
	const meta = report?.siteMeta;
	return {
		industry: meta?.category,
		category: meta?.category,
		siteTitle: meta?.title,
		brandName: meta?.brandName,
		domain: meta?.domain,
		primaryKeyword: meta?.primaryKeyword,
		industryType: meta?.industryType,
		schemaTypes: report?.metrics?.schemaTypes,
	};
}

/**
 * NewsArticle is never a hard fail on clinic/business sites.
 * The 5-point slot is reassigned to the industry-core entity schema.
 */
export function normalizeNewsArticleCheck(
	check: AuditCheckItem,
	args: {
		newsVertical: boolean;
		hasCoreEntity: boolean;
		vertical: SchemaVertical;
		lang: AuditLang;
	},
): AuditCheckItem {
	if (check.id !== 'news-article' || args.newsVertical) return check;
	const copy = coreEntityItemCopy(args.vertical, args.lang);
	const stored = checkVerdict(check);
	const status: DiagnosticStatus = args.hasCoreEntity || stored === 'pass' ? 'pass' : 'warning';
	return {
		...check,
		status,
		passed: status === 'pass',
		label: copy.label,
		why: status === 'pass' ? copy.passWhy : copy.why,
	};
}

export function collectReportChecks(
	report?: Partial<Pick<AuditReport, 'checklist' | 'categories'>> | null,
): AuditCheckItem[] {
	if (!report) return [];
	if (report.checklist?.length) return report.checklist;
	return report.categories?.flatMap((c) => c.checks) ?? [];
}

export function resolveHasCoreEntity(
	report?: Partial<Pick<AuditReport, 'siteMeta' | 'metrics' | 'checklist' | 'categories'>> | null,
	vertical?: SchemaVertical,
): boolean {
	const mapping = schemaMappingFromAudit(report);
	const resolved = vertical ?? detectSchemaVertical(mapping);
	if (hasCoreEntitySchema(mapping.schemaTypes, resolved)) return true;
	const org = collectReportChecks(report).find((c) => c.id === 'organization');
	return org ? checkVerdict(org) === 'pass' : false;
}

type ChecklistReportInput = Partial<
	Pick<AuditReport, 'siteMeta' | 'metrics' | 'checklist' | 'categories' | 'lang' | 'url' | 'hasSsl' | 'collectedUrls'>
>;

type DiagnosticReportInput = Partial<
	Pick<
		AuditReport,
		'score' | 'maxScore' | 'categories' | 'lang' | 'siteMeta' | 'metrics' | 'checklist' | 'url' | 'hasSsl'
	>
>;

/** Remap stored NewsArticle fails and keep 24-item labels industry-native. */
export function normalizeChecklistItems(
	report?: ChecklistReportInput | null,
	checks?: AuditCheckItem[] | null,
): AuditCheckItem[] {
	const source = checks?.length ? checks : collectReportChecks(report);
	if (!source.length) return [];
	const lang: AuditLang = report?.lang === 'en' ? 'en' : 'ko';
	const mapping = schemaMappingFromAudit(report);
	const vertical = detectSchemaVertical(mapping);
	const newsVertical = isNewsMediaVertical(mapping);
	const hasCoreEntity = resolveHasCoreEntity(report, vertical);
	const remapped = applyChecklistDefinitionWeights(
		source.map((check) =>
			normalizeNewsArticleCheck(check, { newsVertical, hasCoreEntity, vertical, lang }),
		),
	);
	return ensureLlmsTxtChecklistItem(ensureHttpsChecklistItem(remapped, report), report);
}

export function countCheckVerdicts(checks: ReadonlyArray<Pick<AuditCheckItem, 'status' | 'passed'>>): {
	defectCount: number;
	warningCount: number;
} {
	let defectCount = 0;
	let warningCount = 0;
	for (const check of checks) {
		const verdict = checkVerdict(check);
		if (verdict === 'fail') defectCount += 1;
		else if (verdict === 'warning') warningCount += 1;
	}
	return { defectCount, warningCount };
}

export type CategoryStatusColor = 'rose' | 'amber' | 'emerald';
export type CategorySummaryKind = 'defect' | 'warning' | 'pass';

export interface CategoryCardData {
	name: string;
	score: number;
	maxScore: number;
	defects?: number;
	warnings?: number;
}

export interface CategoryStatusInfo {
	status: DiagnosticStatus;
	statusLabel: '미흡' | '주의' | '양호';
	summaryKind: CategorySummaryKind;
	summaryCount: number;
	summaryText: string;
	colorType: CategoryStatusColor;
}

const STATUS_COLOR: Record<AuditStatus, CategoryStatusColor> = {
	good: 'emerald',
	warning: 'amber',
	poor: 'rose',
};

const STATUS_SUMMARY_KIND: Record<AuditStatus, CategorySummaryKind> = {
	good: 'pass',
	warning: 'warning',
	poor: 'defect',
};

/**
 * 5-category card badge + footer — delegates to `auditScoreCalculator`.
 *   Badge (achievement %): 양호 ≥ 90 · 주의 50–89 · 미흡 < 50
 *   Footer: actual defect / warning counts (independent of the badge)
 */
export function getCategoryStatusInfo(
	score: number,
	maxScore: number,
	defects = 0,
	warnings = 0,
): CategoryStatusInfo {
	const percentage = normalizeScore100(score, maxScore);
	const defectCount = Number.isFinite(defects) ? Math.max(0, Math.floor(defects)) : 0;
	const warningCount = Number.isFinite(warnings) ? Math.max(0, Math.floor(warnings)) : 0;
	const verdict = resolveAuditStatus(percentage);
	const summaryKind: CategorySummaryKind =
		defectCount > 0 ? 'defect' : warningCount > 0 ? 'warning' : STATUS_SUMMARY_KIND[verdict];
	const summaryCount = defectCount > 0 ? defectCount : warningCount > 0 ? warningCount : 0;

	return {
		status: auditStatusToDiagnostic(verdict),
		statusLabel: verdict === 'good' ? '양호' : verdict === 'warning' ? '주의' : '미흡',
		summaryKind,
		summaryCount,
		summaryText: summaryTextForStatus(verdict, defectCount, warningCount),
		colorType: STATUS_COLOR[verdict],
	};
}

/**
 * Category verdict — same bands as `getCategoryStatusInfo` (5-card badges).
 */
export function resolveDiagnosticStatus(
	score100: number,
	defectCount: number,
	warningCount = 0,
): DiagnosticStatus {
	return getCategoryStatusInfo(score100, 100, defectCount, warningCount).status;
}

export function toAuditCategoryStatus(status: DiagnosticStatus): 'PASS' | 'WARN' | 'FAIL' {
	if (status === 'pass') return 'PASS';
	if (status === 'warning') return 'WARN';
	return 'FAIL';
}

export function fromAuditCategoryStatus(status: string | undefined): DiagnosticStatus | null {
	const key = (status ?? '').trim().toUpperCase();
	if (key === 'PASS') return 'pass';
	if (key === 'WARN' || key === 'WARNING') return 'warning';
	if (key === 'FAIL') return 'fail';
	return null;
}

function buildCategoryFromBucket(
	id: DiagnosticCategoryId,
	lang: AuditLang,
	checks: AuditCheckItem[],
	earned: number,
	maxScore: number,
): DiagnosticCategory {
	const rawScore = roundRawScore(Math.min(maxScore, Math.max(0, earned)));
	const score100 = normalizeScore100(rawScore, maxScore);
	const { defectCount, warningCount } = countCheckVerdicts(checks);
	const status = resolveDiagnosticStatus(score100, defectCount, warningCount);
	return {
		id,
		name: CATEGORY_DEFAULT_NAMES[id][lang],
		maxScore,
		rawScore,
		score100,
		status,
		statusText: CATEGORY_STATUS_TEXT[id][lang][status],
		defectCount,
		warningCount,
		groupId: CATEGORY_GROUP[id],
		checks,
	};
}

function rollupGroupStatus(children: DiagnosticCategory[]): DiagnosticStatus {
	if (children.some((c) => c.status === 'fail')) return 'fail';
	if (children.some((c) => c.status === 'warning')) return 'warning';
	return 'pass';
}

function buildGroups(categories: DiagnosticCategory[]): DiagnosticGroup[] {
	const byId = new Map(categories.map((c) => [c.id, c]));
	return CANONICAL_GROUP_IDS.map((id) => {
		const categoryIds = CANONICAL_CATEGORY_IDS.filter((cid) => CATEGORY_GROUP[cid] === id);
		const children = categoryIds.map((cid) => byId.get(cid)).filter((c): c is DiagnosticCategory => Boolean(c));
		const rawScore = roundRawScore(children.reduce((sum, c) => sum + c.rawScore, 0));
		const maxScore = GROUP_MAX_SCORES[id];
		return {
			id,
			maxScore,
			rawScore,
			score100: normalizeScore100(rawScore, maxScore),
			status: rollupGroupStatus(children),
			defectCount: children.reduce((sum, c) => sum + c.defectCount, 0),
			warningCount: children.reduce((sum, c) => sum + c.warningCount, 0),
			categoryIds,
		};
	});
}

export function buildOnPageDiagnostic(report?: DiagnosticReportInput | null): OnPageDiagnosticProps {
	const lang: AuditLang = report?.lang === 'en' ? 'en' : 'ko';
	const remapped = normalizeChecklistItems(report);
	const isHttps = resolveIsHttps({ url: report?.url, hasSsl: report?.hasSsl });
	const pipeline = runScorePipeline(remapped, isHttps);
	const summaries = categorySummaryById(aggregateCategoryScores(remapped, isHttps));
	const buckets = bucketChecksByCategory(remapped);

	const categories = CANONICAL_CATEGORY_IDS.map((id) => {
		const key = DIAGNOSTIC_TO_STANDARD_ID[id];
		const summary = summaries[key];
		return buildCategoryFromBucket(id, lang, buckets[key], summary.earned, summary.max);
	});

	const fromCategories = pipeline.totalEarned;
	const totalRawScore = remapped.length
		? fromCategories
		: applyHttpsRawPenalty(roundRawScore(report?.score ?? 0), isHttps);
	const maxPossibleScore = remapped.length ? pipeline.totalMax : resolveMaxRawScore(remapped);
	const normalizedScore = remapped.length
		? pipeline.normalizedTotalScore
		: normalizeScore100(totalRawScore, maxPossibleScore);

	return {
		totalRawScore: roundRawScore(totalRawScore),
		maxPossibleScore,
		normalizedScore,
		grade: diagnosticGradeFromScore(normalizedScore),
		percentile: topPercentileFromScore(normalizedScore),
		categories,
		groups: buildGroups(categories),
	};
}

/** Headline 0–100 technical score — same number as the on-page main score. */
export function onpageNormalizedScore(report?: DiagnosticReportInput | null): number {
	if (report?.categories?.length) return buildOnPageDiagnostic(report).normalizedScore;
	const base = normalizeScore100(report?.score ?? 0, report?.maxScore || ONPAGE_MAX_SCORE);
	const isHttps = resolveIsHttps({ url: report?.url, hasSsl: report?.hasSsl });
	if (isHttps) return base;
	return normalizeScore100(applyHttpsRawPenalty((report?.score ?? 0) as number, false), report?.maxScore || ONPAGE_MAX_SCORE);
}
