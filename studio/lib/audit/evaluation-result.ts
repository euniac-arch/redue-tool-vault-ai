import {
	AI_RECOMMEND_THRESHOLD,
	findWeakestCategory,
	generateExecutiveSummary,
	projectAfterGeoPrescription,
	type ExecutiveSummary,
	type ExecutiveSummaryScoreCategory,
} from '@/lib/audit/executive-summary';
import { summarizeGeoDiagnostic, type GeoDiagnosticReport } from '@/types/geo-diagnostic';
import type { AppliedGeoPatches } from '@/types/geo-prescription';
import {
	auditStatusToStored,
	normalizeTo100,
	resolveAuditStatus,
} from '@/lib/audit/auditScoreCalculator';
import { countCheckVerdicts } from '@/lib/audit/onpage-diagnostic';
import type {
	AuditCategory,
	AuditCheckItem,
	AuditFinding,
	AuditOverallStatus,
	AuditReport,
} from '@/lib/site-auditor';

export type PrescriptionViewMode = 'before' | 'after';
export type PrescriptionTrackingStatus = 'SYNCING' | 'PENDING_INDEX' | 'TRACKING';

export interface AppliedPrescriptionState {
	appliedAt: string;
	viewMode: PrescriptionViewMode;
	afterAudit: AuditReport;
	afterGeo: GeoDiagnosticReport;
	expectedScore?: number;
	expectedCitationScore?: number;
	trackingStatus?: PrescriptionTrackingStatus;
}

const PRESCRIPTION_CHECK_IDS = new Set([
	'jsonld-present',
	'organization',
	'website-schema',
	'faq-howto-schema',
	'og-tags',
]);

function overallPct(score: number, maxScore: number): number {
	return normalizeTo100(score, maxScore);
}

function overallStatus(lang: AuditReport['lang'], pct: number): { status: AuditOverallStatus; statusLabel: string } {
	if (lang === 'en') {
		if (pct >= 90) return { status: 'EXCELLENT', statusLabel: 'Optimized' };
		if (pct >= 70) return { status: 'GOOD', statusLabel: 'Good' };
		if (pct >= 40) return { status: 'FAIR', statusLabel: 'Fair (needs work)' };
		if (pct >= 20) return { status: 'POOR', statusLabel: 'Weak' };
		return { status: 'CRITICAL', statusLabel: 'Critical' };
	}
	if (pct >= 90) return { status: 'EXCELLENT', statusLabel: '최적화 완료' };
	if (pct >= 70) return { status: 'GOOD', statusLabel: '양호' };
	if (pct >= 40) return { status: 'FAIR', statusLabel: '보통 (개선 필요)' };
	if (pct >= 20) return { status: 'POOR', statusLabel: '취약' };
	return { status: 'CRITICAL', statusLabel: '심각 (긴급 개선 필요)' };
}

function passCheck(item: AuditCheckItem): AuditCheckItem {
	if (item.status === 'pass' && item.passed) return item;
	return { ...item, status: 'pass', passed: true };
}

function liftCategory(cat: AuditCategory, lifted: ExecutiveSummaryScoreCategory | undefined): AuditCategory {
	const checks = cat.checks.map((item) => (PRESCRIPTION_CHECK_IDS.has(item.id) ? passCheck(item) : item));
	const nextScore = lifted ? Math.max(cat.score, lifted.score) : cat.score;
	const score = Math.round(nextScore * 10) / 10;
	const { defectCount, warningCount } = countCheckVerdicts(checks);
	const status = auditStatusToStored(
		resolveAuditStatus(normalizeTo100(score, cat.maxScore), defectCount, warningCount),
	);
	return {
		...cat,
		checks,
		score,
		status,
	};
}

function appliedExpectedText(
	lang: AuditReport['lang'],
	current: number,
	projected: number,
	gain: number,
): string {
	if (lang === 'en') {
		if (gain <= 0) {
			return `GEO prescription applied. The measured score stays at ${current} until search/AI engines re-index. Expected guide: ${projected}.`;
		}
		return `GEO prescription applied. The measured score stays at ${current} until crawlers re-index (usually days to weeks). Expected guide after indexing: ${projected} (+${gain}).`;
	}
	if (gain <= 0) {
		return `GEO 처방전 적용이 기록되었습니다. 실측 점수는 엔진 재색인 전까지 ${current}점을 유지합니다. 기대 가이드: ${projected}점.`;
	}
	return `GEO 처방전 적용이 기록되었습니다. 실측 점수는 크롤러 재색인(수일~수주) 전까지 ${current}점을 유지하며, 반영 후 기대 점수는 ${projected}점(+${gain}점)입니다.`;
}

function buildAppliedExecutiveSummary(before: AuditReport, after: AuditReport): ExecutiveSummary {
	const lang = after.lang === 'en' ? 'en' : 'ko';
	const beforePct = overallPct(before.score, before.maxScore);
	const afterPct = overallPct(after.score, after.maxScore);
	const gain = Math.max(0, afterPct - beforePct);
	const generated = generateExecutiveSummary(
		{
			score: after.score,
			maxScore: after.maxScore,
			categories: after.categories.map((c) => ({
				id: c.id,
				label: c.label,
				score: c.score,
				maxScore: c.maxScore,
			})),
		},
		{
			location: after.siteMeta?.location,
			broadLocation: after.siteMeta?.broadLocation,
			category: after.siteMeta?.category,
			primaryKeyword: after.siteMeta?.primaryKeyword,
			brandName: after.siteMeta?.brandName,
		},
		lang,
	);
	const expectedText = appliedExpectedText(lang, beforePct, afterPct, gain);
	return {
		...generated,
		overallScore: afterPct,
		expectedResult: {
			...generated.expectedResult,
			currentScore: beforePct,
			projectedScore: afterPct,
			gain,
			remainingToAGrade: Math.max(0, AI_RECOMMEND_THRESHOLD - afterPct),
			reachesAGrade: afterPct >= AI_RECOMMEND_THRESHOLD,
			text: expectedText,
		},
		briefing:
			lang === 'en'
				? `Weakness Point\n${generated.weaknessPoint.text}\n\nRisk Assessment\n${generated.riskAssessment.text}\n\nExpected Result\n${expectedText}`
				: `취약점 감지\n${generated.weaknessPoint.text}\n\n위험성 진단\n${generated.riskAssessment.text}\n\n처방 기대효과\n${expectedText}`,
	};
}

/** Bind GEO After-state scores into a new AuditReport snapshot (same fetchedAt). */
export function buildAfterPrescriptionAuditReport(
	before: AuditReport,
	afterGeo: GeoDiagnosticReport,
	patches?: AppliedGeoPatches | null,
): AuditReport {
	const scoreInput = {
		score: before.score,
		maxScore: before.maxScore,
		categories: before.categories.map((c) => ({
			id: c.id,
			label: c.label,
			score: c.score,
			maxScore: c.maxScore,
		})),
	};
	const weakest = findWeakestCategory(scoreInput.categories);
	const projection = projectAfterGeoPrescription(scoreInput, weakest.id);
	const liftedById = new Map(projection.categories.map((cat) => [cat.id, cat]));

	const categories = before.categories.map((cat) => liftCategory(cat, liftedById.get(cat.id)));
	const checklist = categories.flatMap((c) => c.checks);
	const score = Math.round(categories.reduce((sum, c) => sum + c.score, 0) * 10) / 10;
	const maxScore = categories.reduce((sum, c) => sum + c.maxScore, 0);
	const pct = overallPct(score, maxScore);
	const { status, statusLabel } = overallStatus(before.lang, pct);
	const geoIndex = summarizeGeoDiagnostic(afterGeo.engines).indexScore;
	const appliedAt = new Date().toISOString();
	const schemaTypes = Array.from(
		new Set([...(before.metrics?.schemaTypes ?? []), patches?.schemaType].filter(Boolean) as string[]),
	);

	const findings: AuditFinding[] = checklist
		.filter((c) => (c.status ?? (c.passed ? 'pass' : 'fail')) !== 'pass')
		.map((c) => ({
			severity: c.status === 'fail' || !c.status ? ('critical' as const) : ('warning' as const),
			title: c.label,
			detail: [c.evidence, c.why].filter(Boolean).join(' — '),
			checkId: c.id,
		}))
		.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
		.slice(0, 8);

	const after: AuditReport = {
		...before,
		score,
		maxScore,
		status,
		statusLabel,
		schemaCoverage: Math.max(before.schemaCoverage ?? 0, 90),
		geoCitationScore: Math.max(before.geoCitationScore ?? 0, geoIndex, 78),
		categories,
		checklist,
		findings,
		isPrescriptionApplied: true,
		prescriptionAppliedAt: appliedAt,
		scoreSource: 'projected',
		trackingStatus: 'SYNCING',
		expectedScore: pct,
		expectedCitationScore: Math.max(before.geoCitationScore ?? 0, geoIndex, 78),
		metrics: before.metrics
			? {
					...before.metrics,
					schemaTypes,
					jsonLdBlockCount: Math.max(before.metrics.jsonLdBlockCount, 1),
				}
			: before.metrics,
	};

	return {
		...after,
		executiveSummary: buildAppliedExecutiveSummary(before, after),
	};
}

/**
 * Bind apply-event flags onto the measured crawl without lifting scores.
 * Use `buildAfterPrescriptionAuditReport` only as the expected / After preview.
 */
export function buildPrescriptionTrackingOverlay(
	before: AuditReport,
	afterExpected: AuditReport,
): AuditReport {
	const currentPct = overallPct(before.score, before.maxScore);
	const expectedPct = overallPct(afterExpected.score, afterExpected.maxScore);
	const gain = Math.max(0, expectedPct - currentPct);
	const appliedAt = afterExpected.prescriptionAppliedAt || new Date().toISOString();
	const expectedText = appliedExpectedText(before.lang, currentPct, expectedPct, gain);
	const baseSummary = before.executiveSummary;
	return {
		...before,
		isPrescriptionApplied: true,
		prescriptionAppliedAt: appliedAt,
		scoreSource: 'measured',
		trackingStatus: 'SYNCING',
		expectedScore: expectedPct,
		expectedCitationScore: afterExpected.expectedCitationScore ?? afterExpected.geoCitationScore,
		executiveSummary: baseSummary
			? {
					...baseSummary,
					expectedResult: {
						...baseSummary.expectedResult,
						currentScore: currentPct,
						projectedScore: expectedPct,
						gain,
						remainingToAGrade: Math.max(0, AI_RECOMMEND_THRESHOLD - currentPct),
						reachesAGrade: currentPct >= AI_RECOMMEND_THRESHOLD,
						text: expectedText,
					},
				}
			: baseSummary,
	};
}

export function resolveEvaluationReport(
	fallback: AuditReport,
	evaluationResult: AuditReport | null | undefined,
): AuditReport {
	if (evaluationResult && evaluationResult.url === fallback.url) return evaluationResult;
	return fallback;
}
