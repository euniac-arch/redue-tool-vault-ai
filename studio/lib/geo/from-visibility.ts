import {
	buildAiEngineVisibilityReportFromAudit,
	type AiEngineVisibilityReport,
	type AiEngineVisibilityResult,
} from '@/lib/audit/ai-engine-visibility';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { extractSignalsFromReport } from '@/lib/audit/geo-score';
import { mergeUniqueTags } from '@/lib/audit/triggerDepthEngine';
import {
	asIsLevelFromEngineScore,
	asIsStatusBadgeFromEngineScore,
	scoreFromDepthLevel,
} from '@/lib/geo/rating-meta';
import { buildEngineAnalysisTags } from '@/lib/geo/precision-diagnostics';
import { buildEngineOptimizationGuide } from '@/lib/geo/engine-optimization-guide';
import {
	asIsLevelFromDepth,
	buildCurrentStatus,
	buildOptimizationAdvice,
	buildPostOptimization,
	formatStatusTags,
} from '@/lib/geo/trigger-simulation';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';
import {
	AI_ENGINE_CATALOG,
	type AIEngineId,
	type AIEngineTestResult,
	type EngineAnalysisTag,
	type GeoDiagnosticReport,
} from '@/types/geo-diagnostic';

function queryForAsIsLevel(
	queries: AiEngineVisibilityReport['queries'],
	level: 1 | 2 | 3,
): string {
	if (level === 3) return queries.level3;
	if (level === 2) return queries.level2;
	return queries.level1;
}

function resultFromMeasuredScore(
	result: AiEngineVisibilityResult,
	measuredScore: number,
	queries: AiEngineVisibilityReport['queries'],
	lang: AuditLang,
	brandOnly = false,
	isHttps = true,
): AIEngineTestResult {
	const engine = AI_ENGINE_CATALOG[result.engineId];
	const asIsLevel = asIsLevelFromEngineScore(measuredScore, { brandOnly, isHttps });
	const statusBadge = asIsStatusBadgeFromEngineScore(measuredScore, { brandOnly, isHttps });
	const triggerQuery = result.triggerSim?.currentQuery ?? queryForAsIsLevel(queries, asIsLevel);
	const currentStatus = buildCurrentStatus({
		lang,
		asIsLevel,
		triggerQuery,
		simulationResponse: result.simulatedResponse,
		statusTags: mergeUniqueTags(result.triggerSim?.tags, result.currentStatus?.statusTags),
		isLockedBySecurity: !isHttps,
	});
	const optimizationAdvice =
		result.optimizationAdvice ?? buildOptimizationAdvice(result.engineId, undefined, lang, { isHttps });
	const optimizationGuide =
		result.optimizationGuide ??
		buildEngineOptimizationGuide({
			engineId: result.engineId,
			currentLevel: asIsLevel,
			lang,
		});
	const postOptimization =
		result.postOptimization ??
		buildPostOptimization({
			lang,
			expandedTriggerQuery: result.triggerSim?.targetQuery ?? queries.level3,
			expectedSimulationResponse: result.simulatedResponse,
		});
	const base = {
		engine,
		score: measuredScore,
		triggerQuery,
		simulatedResponse: result.simulatedResponse,
		improvementTip: result.optimizationTip,
		currentStatus,
		optimizationAdvice,
		optimizationGuide,
		postOptimization,
	};

	if (statusBadge === 'optimal') {
		return { ...base, statusBadge: 'optimal', depthLevel: 3 };
	}
	if (statusBadge === 'moderate') {
		return { ...base, statusBadge: 'moderate', depthLevel: 2 };
	}
	return { ...base, statusBadge: 'exact_only', depthLevel: 1 };
}

function toTestResult(result: AiEngineVisibilityResult, brandOnly = false, isHttps = true): AIEngineTestResult {
	const engine = AI_ENGINE_CATALOG[result.engineId];
	const asIsLevel = asIsLevelFromDepth(result.triggerLevel, { brandOnly, isHttps });
	const score = scoreFromDepthLevel(result.triggerLevel);
	const base = {
		engine,
		score,
		triggerQuery: result.testedQuery,
		simulatedResponse: result.simulatedResponse,
		improvementTip: result.optimizationTip,
		currentStatus: result.currentStatus,
		optimizationAdvice: result.optimizationAdvice,
		optimizationGuide: result.optimizationGuide,
		postOptimization: result.postOptimization,
	};

	if (result.triggerLevel === 0) {
		return { ...base, statusBadge: 'not_indexed', depthLevel: null };
	}
	if (asIsLevel === 3) {
		return { ...base, statusBadge: 'optimal', depthLevel: 3 };
	}
	if (asIsLevel === 2) {
		return { ...base, statusBadge: 'moderate', depthLevel: 2 };
	}
	return { ...base, statusBadge: 'exact_only', depthLevel: 1 };
}

export function geoDiagnosticFromVisibility(vis: AiEngineVisibilityReport): GeoDiagnosticReport {
	return {
		caseId: vis.scenario === 'low' ? 'low' : 'high',
		caseLabel: vis.scenario === 'low' ? 'Low GEO performance' : 'High GEO performance',
		targetUrl: vis.targetUrl,
		domain: vis.domain,
		brandName: vis.brandName,
		generatedAt: vis.generatedAt,
		triggerQueries: {
			1: vis.queries.level1,
			2: vis.queries.level2,
			3: vis.queries.level3,
		},
		engines: vis.engines.map((engine) => toTestResult(engine, vis.brandOnlyAsIs)),
	};
}

export function buildGeoDiagnosticReportFromAudit(
	report: AuditReport,
	lang: AuditLang = 'ko',
	reportData?: GeoNarrativeReport | null,
): GeoDiagnosticReport {
	const snapshot = buildDiagnosisScoreSnapshot(report, reportData, lang);
	const reputation = snapshot.reputation;
	const measuredScores = snapshot.scores.engineScores;
	const isHttps = snapshot.isHttps;
	const vis = buildAiEngineVisibilityReportFromAudit(report, lang, 'auto', measuredScores, isHttps);
	const diagnostic = geoDiagnosticFromVisibility(vis);
	const signals = extractSignalsFromReport(report);
	const googleMentionsLow =
		reputation.digitalFootprint.googleMentionCount < reputation.digitalFootprint.googleMentionBenchmark;
	const claudeBotBlocked =
		reputation.digitalFootprint.aiBots?.some((bot) => bot.id === 'claudebot' && !bot.allowed) ?? !signals.aiBotsOk;
	const hasLocalBusinessSchema = (signals.schemaTypes ?? []).some((t) =>
		/LocalBusiness|MedicalClinic|Hospital|Dentist/i.test(t),
	);

	const engineAnalysisTags: Partial<Record<AIEngineId, readonly EngineAnalysisTag[]>> = {};
	const visById = new Map(vis.engines.map((engine) => [engine.engineId, engine]));
	const engines = diagnostic.engines.map((engine) => {
		const measured = measuredScores[engine.engine.id];
		const visResult = visById.get(engine.engine.id);
		const aligned =
			typeof measured === 'number' && visResult
				? resultFromMeasuredScore(visResult, measured, vis.queries, lang, vis.brandOnlyAsIs, isHttps)
				: engine;
		const analysisTags = buildEngineAnalysisTags({
			lang,
			engineId: aligned.engine.id,
			statusBadge: aligned.statusBadge,
			depthLevel: aligned.depthLevel,
			napMatchRate: reputation.brandTrust.napMatchRate,
			bingPlacesRegistered: reputation.digitalFootprint.bingPlacesRegistered,
			googleMentionsLow,
			naverMentionIssue: Boolean(reputation.digitalFootprint.naverMentionIssue),
			faqPresent: signals.faqPresent,
			orgPresent: signals.orgPresent,
			orgComplete: signals.orgComplete,
			claudeBotBlocked,
			hasLocalBusinessSchema,
			isHttps,
		});
		engineAnalysisTags[aligned.engine.id] = analysisTags;
		const statusTags = mergeUniqueTags(
			aligned.currentStatus?.statusTags,
			visResult?.triggerSim?.tags,
			formatStatusTags(analysisTags, lang),
		);
		return {
			...aligned,
			analysisTags,
			currentStatus: aligned.currentStatus
				? { ...aligned.currentStatus, statusTags, isLockedBySecurity: !isHttps }
				: aligned.currentStatus,
			optimizationAdvice: buildOptimizationAdvice(aligned.engine.id, analysisTags, lang, { isHttps }),
			optimizationGuide:
				aligned.optimizationGuide ??
				buildEngineOptimizationGuide({
					engineId: aligned.engine.id,
					currentLevel: aligned.currentStatus?.level ?? (aligned.depthLevel === 2 || aligned.depthLevel === 3 ? aligned.depthLevel : 1),
					lang,
				}),
		};
	});

	return {
		...diagnostic,
		engines,
		aiBots: reputation.digitalFootprint.aiBots,
		schemaProperties: reputation.brandTrust.schemaProperties,
		engineAnalysisTags,
	};
}
