/**
 * Public AuditScore barrel — import from `@/shared/audit`.
 * Implementation lives in `lib/audit/auditScoreCalculator.ts`.
 */

export {
	AUDIT_CATEGORY_CONFIG,
	AUDIT_GRADE_LABEL,
	AUDIT_STATUS_BADGE,
	AUDIT_STATUS_LABEL,
	AUDIT_TOTAL_MAX_SCORE,
	CATEGORY_DEFINITIONS,
	CATEGORY_ICON,
	CATEGORY_KEYS,
	CATEGORY_KEY_ALIASES,
	CATEGORY_TO_DIAGNOSTIC_ID,
	auditStatusToDiagnostic,
	auditStatusToStored,
	calculateAuditScoreFromPayload,
	calculateCategory,
	calculateComprehensiveAuditScore,
	calculateComprehensiveAuditScoreFromOnpage,
	evaluateAuditData,
	formatRawPoints,
	gradeFromNormalizedScore,
	gradeLabelForScore,
	normalizeTo100,
	resolveAuditStatus,
	resolveCategoryKey,
	roundRawPoints,
	storedStatusToCounts,
	summaryTextForStatus,
	type AuditGrade,
	type AuditStatus,
	type AuditStatusLabel,
	type CalculatedCategory,
	type CategoryDefinition,
	type CategoryKey,
	type ComprehensiveAuditInput,
	type ComprehensiveAuditScore,
	type EvaluatedAuditData,
	type EvaluatedCategory,
	type OnpageScoreInput,
	type RawAuditPayload,
	type RawCategoryInput,
	type RawCategoryResult,
} from '@/lib/audit/auditScoreCalculator';

export {
	resolveAuditScoreFromHistory,
	resolveAuditScoreFromReport,
	type HistoryScoreSource,
} from '@/lib/audit/resolveAuditScore';
