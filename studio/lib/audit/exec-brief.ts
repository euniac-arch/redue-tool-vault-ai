import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { AI_RECOMMEND_THRESHOLD, ensureExecutiveSummary } from '@/lib/audit/executive-summary';
import { buildExecStorytelling, type BottleneckType, type ExecUrgencyLevel } from '@/lib/audit/exec-insight';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { siteLabelFromUrl } from '@/lib/audit/report-url';
import { buildGeoDiagnosticReportFromAudit } from '@/lib/geo/from-visibility';
import type { AuditFinding, AuditLang, AuditReport } from '@/lib/site-auditor';
import {
	summarizeGeoDiagnostic,
	type AIEngineStatusBadge,
	type AIEngineTestResult,
	type GeoDiagnosticSummary,
} from '@/types/geo-diagnostic';

/** Dispatched after switching to the GEO tab so the copy center can open/scroll. */
export const OPEN_GEO_ANSWER_CENTER_EVENT = 'redue:open-geo-answer-center';
export const GEO_ANSWER_CENTER_ID = 'geo-answer-center';
export type GeoAnswerCenterModuleId = 'schema' | 'faq' | 'maps' | 'blog' | 'llms';
export type OpenGeoAnswerCenterDetail = { module?: GeoAnswerCenterModuleId };

export function geoAnswerCenterModuleAnchor(module?: GeoAnswerCenterModuleId): string {
	return module ? `${GEO_ANSWER_CENTER_ID}-${module}` : GEO_ANSWER_CENTER_ID;
}

export function openGeoAnswerCenter(module?: GeoAnswerCenterModuleId): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(
		new CustomEvent<OpenGeoAnswerCenterDetail>(OPEN_GEO_ANSWER_CENTER_EVENT, { detail: { module } }),
	);
}

export type ExecBriefStatusTone = 'brandOnly' | 'categoryGap' | 'nearOptimal' | 'optimal';

export type ExecBriefImprovementId =
	| 'schema'
	| 'geo'
	| 'faq'
	| 'bots'
	| 'eeat'
	| 'onpage'
	| 'engine'
	| 'generic';

export interface ExecBriefImprovement {
	id: string;
	theme: ExecBriefImprovementId;
	title: string;
	detail: string;
	severity: 'critical' | 'warning' | 'info';
}

export interface ExecBriefEngineRow {
	id: string;
	name: string;
	score: number;
	statusBadge: AIEngineStatusBadge;
	depthLevel: 1 | 2 | 3 | null;
}

export interface ExecBriefModel {
	siteName: string;
	url: string;
	aiIndex: number;
	seoScore: number;
	geoScore: number;
	indexedCount: number;
	totalEngines: number;
	levelCounts: GeoDiagnosticSummary['levelCounts'];
	unindexedCount: number;
	statusTone: ExecBriefStatusTone;
	bottleneckType: BottleneckType;
	urgencyLevel: ExecUrgencyLevel;
	judgmentText: string;
	engines: ExecBriefEngineRow[];
	improvements: ExecBriefImprovement[];
	currentScore: number;
	projectedScore: number;
	gain: number;
	reachesAGrade: boolean;
	alreadyInRange: boolean;
	inflowLiftPct: number;
	threshold: number;
	isPrescriptionApplied: boolean;
}

const SCHEMA_CHECKS = new Set(['jsonld-present', 'faq-howto-schema', 'organization', 'website-schema']);
const FAQ_CHECKS = new Set(['faq-howto-schema']);
const BOT_CHECKS = new Set(['ai-bots-allowed']);
const EEAT_CHECKS = new Set(['person-eeat', 'eeat-author', 'article-fields', 'news-article']);
const GEO_CATEGORY_IDS = new Set(['geo', 'schema', 'geo_ai_signals', 'schema_data']);

export function resolveAuditSiteName(report: AuditReport): string {
	const brand = report.siteMeta?.brandName?.trim();
	if (brand) return brand;
	const title = report.metrics?.pageTitle?.trim() || report.metrics?.documentTitle?.trim();
	if (title) return title;
	return siteLabelFromUrl(report.url);
}

export function resolveExecBriefStatusTone(summary: GeoDiagnosticSummary): ExecBriefStatusTone {
	if (summary.indexScore >= 74 && summary.levelCounts[3] >= 4) return 'optimal';
	if (summary.levelCounts[3] >= 3 || summary.indexScore >= 68) return 'nearOptimal';
	if (summary.levelCounts[1] + summary.unindexedCount >= 4) return 'brandOnly';
	return 'categoryGap';
}

function themeForFinding(finding: AuditFinding, categoryId?: string): ExecBriefImprovementId {
	const checkId = finding.checkId ?? '';
	if (FAQ_CHECKS.has(checkId)) return 'faq';
	if (BOT_CHECKS.has(checkId)) return 'bots';
	if (EEAT_CHECKS.has(checkId)) return 'eeat';
	if (SCHEMA_CHECKS.has(checkId) || categoryId === 'schema') return 'schema';
	if (categoryId && GEO_CATEGORY_IDS.has(categoryId)) return 'geo';
	if (checkId) return 'onpage';
	return 'generic';
}

function estimateInflowLiftPct(current: number, projected: number): number {
	const gain = Math.max(0, projected - current);
	if (gain === 0) return 0;
	return Math.min(160, Math.max(12, Math.round(gain * 1.35)));
}

function buildImprovements(
	report: AuditReport,
	engines: readonly AIEngineTestResult[],
	lang: AuditLang,
): ExecBriefImprovement[] {
	const items: ExecBriefImprovement[] = [];
	const seen = new Set<string>();

	const push = (item: ExecBriefImprovement) => {
		const key = item.id || item.title;
		if (seen.has(key) || items.length >= 3) return;
		seen.add(key);
		items.push(item);
	};

	const briefing = ensureExecutiveSummary(report).executiveSummary;
	if (briefing?.weaknessPoint?.categoryLabel) {
		const weak = briefing.weaknessPoint;
		push({
			id: `weak-${weak.categoryId}`,
			theme: GEO_CATEGORY_IDS.has(weak.categoryId) ? (weak.categoryId === 'schema' ? 'schema' : 'geo') : 'onpage',
			title: weak.categoryLabel,
			detail: weak.text,
			severity: weak.ratioPct < 50 ? 'critical' : 'warning',
		});
	}

	const findings = [...(report.findings ?? [])].sort((a, b) => {
		if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
		return 0;
	});

	for (const finding of findings) {
		const categoryId = report.categories.find((cat) =>
			cat.checks?.some((check) => check.id === finding.checkId),
		)?.id;
		push({
			id: finding.checkId || finding.title,
			theme: themeForFinding(finding, categoryId),
			title: finding.title,
			detail: finding.detail,
			severity: finding.severity,
		});
	}

	const weakestEngine = [...engines].sort((a, b) => a.score - b.score)[0];
	if (weakestEngine?.improvementTip && weakestEngine.statusBadge !== 'optimal') {
		const engineLabel = lang === 'en' ? `${weakestEngine.engine.name} citation gap` : `${weakestEngine.engine.name} 인용 공백`;
		push({
			id: `engine-${weakestEngine.engine.id}`,
			theme: 'engine',
			title: engineLabel,
			detail: weakestEngine.improvementTip,
			severity: weakestEngine.statusBadge === 'not_indexed' ? 'critical' : 'warning',
		});
	}

	return items.slice(0, 3);
}

export function buildExecBriefModel(
	report: AuditReport,
	geoNarrative: GeoNarrativeReport | null | undefined,
	lang: AuditLang = 'ko',
): ExecBriefModel {
	const live = ensureExecutiveSummary(report);
	const snapshot = buildDiagnosisScoreSnapshot(live, geoNarrative ?? null, lang);
	const geoReport = buildGeoDiagnosticReportFromAudit(live, lang, geoNarrative ?? null);
	const geoSummary = summarizeGeoDiagnostic(geoReport.engines);
	const geoScore = snapshot.externalTrustScore;
	const seoScore = snapshot.technicalScore;
	const story = buildExecStorytelling({
		geoScore,
		seoScore,
		url: live.url,
		hasSsl: live.hasSsl,
	});
	const currentScore = story.currentScore;
	const projectedScore = story.targetScore;
	const gain = story.potentialGain;
	const alreadyInRange = currentScore >= AI_RECOMMEND_THRESHOLD;
	const reachesAGrade = projectedScore >= AI_RECOMMEND_THRESHOLD;

	return {
		siteName: resolveAuditSiteName(live),
		url: live.url,
		aiIndex: geoSummary.indexScore,
		seoScore,
		geoScore,
		indexedCount: geoSummary.indexedCount,
		totalEngines: geoSummary.totalEngines,
		levelCounts: geoSummary.levelCounts,
		unindexedCount: geoSummary.unindexedCount,
		statusTone: resolveExecBriefStatusTone(geoSummary),
		bottleneckType: story.bottleneckType,
		urgencyLevel: story.urgencyLevel,
		judgmentText: live.executiveSummary?.riskAssessment.text ?? '',
		engines: geoReport.engines.map((engine) => ({
			id: engine.engine.id,
			name: engine.engine.name,
			score: engine.score,
			statusBadge: engine.statusBadge,
			depthLevel: engine.depthLevel,
		})),
		improvements: buildImprovements(live, geoReport.engines, lang),
		currentScore,
		projectedScore,
		gain,
		reachesAGrade,
		alreadyInRange,
		inflowLiftPct: estimateInflowLiftPct(currentScore, projectedScore),
		threshold: AI_RECOMMEND_THRESHOLD,
		isPrescriptionApplied: Boolean(live.isPrescriptionApplied),
	};
}

export function sanitizeExecBriefFilename(siteName: string): string {
	const safe = siteName
		.replace(/[\\/:*?"<>|]+/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 48);
	return safe || 'site';
}
