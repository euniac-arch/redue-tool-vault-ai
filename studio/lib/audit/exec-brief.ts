import { businessConversionFromAudit } from '@/lib/audit/business-conversion';
import { CHECKLIST_CATEGORY_MAX } from '@/lib/audit/checklistDefinitions';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import { detectEnginePlatformSignals, type EnginePlatformSignals } from '@/lib/audit/engine-analysis';
import { AI_RECOMMEND_THRESHOLD, ensureExecutiveSummary } from '@/lib/audit/executive-summary';
import { buildExecStorytelling, type BottleneckType, type ExecUrgencyLevel } from '@/lib/audit/exec-insight';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import { extractSignalsFromReport } from '@/lib/audit/geo-score';
import { resolveHasLlmsTxt } from '@/lib/audit/llms-txt-check';
import { siteLabelFromUrl } from '@/lib/audit/report-url';
import { resolveProjectSiteName } from '@/lib/audit/project-site-name';
import { resolveIsHttps } from '@/lib/audit/scoreCalculator';
import { buildGeoDiagnosticReportFromAudit } from '@/lib/geo/from-visibility';
import { generateTop3ActionPoints, type ActionPointRecord } from '@/lib/audit/exec-brief-action-points';
import { withJosa } from '@/lib/korean-josa';
import {
	resolveIndustryConfig,
	type IndustryConfig,
	type IndustryType,
} from '@/lib/registry/universalIndustryRegistry';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';
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
export type ExecBriefIndexedKind = 'mentionOnly' | 'cited' | 'recommended';
export type ExecBriefPTag = 'p0Priority' | 'p0Urgent' | 'p1' | 'p2';
export type ExecBriefPriority = 'P1' | 'P2' | 'P3';

export {
	generateTop3ActionPoints,
	getTop3ActionPoints,
	type ActionPoint,
	type ActionPointAnalyzerInput,
	type ActionPointRecord,
} from '@/lib/audit/exec-brief-action-points';

export type ExecBriefImprovementId =
	| 'schema'
	| 'geo'
	| 'faq'
	| 'bots'
	| 'eeat'
	| 'onpage'
	| 'engine'
	| 'ssl'
	| 'llms'
	| 'generic';

export interface ExecBriefImprovement {
	id: string;
	theme: ExecBriefImprovementId;
	title: string;
	detail: string;
	statusLine: string;
	causeLine: string;
	actionLine: string;
	targetEngines: string;
	priority: ExecBriefPriority;
	priorityLabel: string;
	pTag: ExecBriefPTag;
	severity: 'critical' | 'warning' | 'info';
}

export interface ExecBriefEngineRow {
	id: string;
	name: string;
	score: number;
	statusBadge: AIEngineStatusBadge;
	depthLevel: 1 | 2 | 3 | null;
	levelLabel: string;
	reason: string;
}

export interface ExecBriefRoiEffect {
	id: 'recommend' | 'leakage' | 'conversion';
	text: string;
	lead?: string;
	highlight?: string;
}

/** Shown under ROI when on-page tech is already 100 but the AI index is not. */
export interface ExecBriefPerfectGuide {
	remainingPct: number;
	enginesLabel: string;
	queryPhrase: string;
	peerNoun: string;
}

export interface ExecBriefModel {
	siteName: string;
	url: string;
	aiIndex: number;
	seoScore: number;
	geoScore: number;
	indexedCount: number;
	totalEngines: number;
	indexedKind: ExecBriefIndexedKind;
	levelCounts: GeoDiagnosticSummary['levelCounts'];
	unindexedCount: number;
	statusTone: ExecBriefStatusTone;
	statusHeadline: string;
	bottleneckType: BottleneckType;
	urgencyLevel: ExecUrgencyLevel;
	judgmentText: string;
	engines: ExecBriefEngineRow[];
	improvements: ExecBriefImprovement[];
	/** Same as `aiIndex` — ROI “현재 AI 지수”. */
	currentScore: number;
	projectedScore: number;
	gain: number;
	reachesAGrade: boolean;
	alreadyInRange: boolean;
	inflowLiftPct: number;
	threshold: number;
	isPrescriptionApplied: boolean;
	roiEffects: ExecBriefRoiEffect[];
	brandName: string;
	location: string;
	primaryService: string;
	estimatedLeads: number;
	queryPhrase: string;
	/** Null unless on-page tech is 100 and the AI index still has a gap. */
	perfectGuide: ExecBriefPerfectGuide | null;
}

/** Conservative Level-3 foundation after SSL + JSON-LD + /llms.txt. */
export const AI_INDEX_LEVEL3_FOUNDATION = 77;

const EXEC_BRIEF_ENGINE_NAME: Record<string, string> = {
	chatgpt: 'ChatGPT',
	gemini: 'Gemini',
	claude: 'Claude',
	perplexity: 'Perplexity',
	copilot: 'Microsoft Copilot',
	clova: 'Naver Cue',
};

const PERFECT_GUIDE_ENGINE_SHORT: Record<string, string> = {
	chatgpt: 'ChatGPT',
	gemini: 'Gemini',
	claude: 'Claude',
	perplexity: 'Perplexity',
	copilot: 'Copilot',
	clova: 'Naver Cue',
};

const PERFECT_GUIDE_PREFERRED_ENGINES = ['chatgpt', 'copilot'] as const;

const PERFECT_GUIDE_PEER: Record<IndustryType, { ko: string; en: string }> = {
	medical: { ko: '병원', en: 'clinic' },
	veterinary: { ko: '동물병원', en: 'animal hospital' },
	legal: { ko: '사무소', en: 'firm' },
	accounting: { ko: '사무소', en: 'firm' },
	beauty: { ko: '샵', en: 'salon' },
	interior: { ko: '업체', en: 'contractor' },
	fitness: { ko: '스튜디오', en: 'studio' },
	education: { ko: '기관', en: 'school' },
	realestate: { ko: '중개소', en: 'agency' },
	restaurant: { ko: '식당', en: 'restaurant' },
	professional: { ko: '업체', en: 'provider' },
	general: { ko: '업체', en: 'business' },
};

export function shouldShowPerfectAiGuide(seoScore: number, currentScore: number): boolean {
	return Math.round(seoScore) >= 100 && Math.round(currentScore) < 100;
}

export function peerNounForPerfectGuide(type: IndustryType, lang: AuditLang): string {
	const row = PERFECT_GUIDE_PEER[type] ?? PERFECT_GUIDE_PEER.general;
	return lang === 'en' ? row.en : row.ko;
}

function shortPerfectGuideEngineName(id: string, fallback: string): string {
	return PERFECT_GUIDE_ENGINE_SHORT[id] || fallback.replace(/^Microsoft\s+/i, '');
}

export function formatPerfectGuideEngines(
	engines: Array<{ id: string; name: string; score: number }>,
	lang: AuditLang = 'ko',
): string {
	const valid = engines.filter((row) => row.id && Number.isFinite(row.score));
	const byId = new Map(valid.map((row) => [row.id, row]));
	const picked: Array<{ id: string; name: string; score: number }> = [];
	for (const id of PERFECT_GUIDE_PREFERRED_ENGINES) {
		const row = byId.get(id);
		if (row) picked.push(row);
	}
	if (picked.length < 2) {
		const rest = valid
			.filter((row) => !picked.some((item) => item.id === row.id))
			.sort((a, b) => a.score - b.score);
		for (const row of rest) {
			if (picked.length >= 2) break;
			picked.push(row);
		}
	}
	if (picked.length === 0) {
		return lang === 'en' ? 'external AI platforms' : '외부 AI 플랫폼';
	}
	return picked
		.map((row) => `${shortPerfectGuideEngineName(row.id, row.name)}(${Math.round(row.score)}%)`)
		.join('·');
}

export function buildPerfectGuide(opts: {
	seoScore: number;
	currentScore: number;
	engines: Array<{ id: string; name: string; score: number }>;
	queryPhrase: string;
	industryType: IndustryType;
	lang: AuditLang;
}): ExecBriefPerfectGuide | null {
	if (!shouldShowPerfectAiGuide(opts.seoScore, opts.currentScore)) return null;
	return {
		remainingPct: Math.max(0, 100 - Math.round(opts.currentScore)),
		enginesLabel: formatPerfectGuideEngines(opts.engines, opts.lang),
		queryPhrase: opts.queryPhrase,
		peerNoun: peerNounForPerfectGuide(opts.industryType, opts.lang),
	};
}

export function resolveAuditSiteName(report: AuditReport): string {
	return resolveProjectSiteName(report) || siteLabelFromUrl(report.url);
}

export function resolveExecBriefStatusTone(summary: GeoDiagnosticSummary): ExecBriefStatusTone {
	if (summary.indexScore >= 74 && summary.levelCounts[3] >= 4) return 'optimal';
	if (summary.levelCounts[3] >= 3 || summary.indexScore >= 68) return 'nearOptimal';
	if (summary.levelCounts[1] + summary.unindexedCount >= 4) return 'brandOnly';
	return 'categoryGap';
}

export function resolveIndexedKind(summary: GeoDiagnosticSummary): ExecBriefIndexedKind {
	if (summary.levelCounts[3] >= 3) return 'recommended';
	if (summary.levelCounts[2] + summary.levelCounts[3] === 0) return 'mentionOnly';
	return 'cited';
}

export function projectExecBriefAiIndex(current: number, canLift: boolean): number {
	const n = Math.min(100, Math.max(0, Math.round(Number.isFinite(current) ? current : 0)));
	if (!canLift || n >= AI_RECOMMEND_THRESHOLD) return n;
	return Math.max(n, AI_INDEX_LEVEL3_FOUNDATION);
}

/** Maps AI-index point gain → expected consult/booking conversion lift. 44 → 38. */
export function estimateConversionLiftPct(gain: number): number {
	if (!Number.isFinite(gain) || gain <= 0) return 0;
	return Math.min(48, Math.max(12, Math.round(gain * 0.86)));
}

export function engineLevelReason(
	id: string,
	depth: 1 | 2 | 3 | null,
	score: number,
	lang: AuditLang,
): string {
	if (depth === 3) return lang === 'en' ? 'unbranded recommend' : '비브랜드 추천 진입';
	if (depth === 2) return lang === 'en' ? 'category citation' : '카테고리 인용 수준';
	if (depth == null) return lang === 'en' ? 'not cited' : '미인용';
	if (id === 'clova') return lang === 'en' ? 'weak Place signal' : '플레이스 연동 신호 미흡';
	if (id === 'perplexity') return lang === 'en' ? 'weak local recommend signal' : '로컬 추천 신호 취약';
	if (score >= 36) return lang === 'en' ? 'basic fact citation' : '기초 정보 인용 수준';
	return lang === 'en' ? 'brand-only mention' : '브랜드 한정 단순언급';
}

export function formatExecBriefPts(n: number): string {
	if (!Number.isFinite(n)) return '0';
	const rounded = Math.round(n * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function brandSearchNoun(lang: AuditLang): { brand: string; direct: string } {
	if (lang === 'en') return { brand: 'Brand-name search', direct: 'the trade name' };
	return { brand: '상호명 직접 검색', direct: '상호명' };
}

export interface ExecBriefBindings {
	brandName: string;
	location: string;
	primaryService: string;
	estimatedLeads: number;
	queryPhrase: string;
}

function compactPhrase(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

export function resolveExecBriefBindings(opts: {
	brandName: string;
	location?: string | null;
	broadLocation?: string | null;
	primaryKeyword?: string | null;
	category?: string | null;
	defaultService?: string | null;
	lostLeads?: number | null;
	monthlySearchVolume?: number | null;
	lang: AuditLang;
}): ExecBriefBindings {
	const lang = opts.lang === 'en' ? 'en' : 'ko';
	const brandName = compactPhrase(opts.brandName) || (lang === 'en' ? 'This brand' : '해당 브랜드');
	const location =
		compactPhrase(opts.broadLocation) ||
		compactPhrase(opts.location) ||
		(lang === 'en' ? 'this area' : '해당 지역');
	const primaryService =
		compactPhrase(opts.primaryKeyword) ||
		compactPhrase(opts.category) ||
		compactPhrase(opts.defaultService) ||
		(lang === 'en' ? 'core service' : '핵심 서비스');
	const lost = Number(opts.lostLeads);
	const volume = Number(opts.monthlySearchVolume);
	const estimatedLeads =
		Number.isFinite(lost) && lost > 0
			? Math.round(lost)
			: Number.isFinite(volume) && volume > 0
				? Math.round(volume)
				: 160;
	const queryPhrase = location && primaryService
		? primaryService.includes(location)
			? primaryService
			: `${location} ${primaryService}`
		: primaryService || location;
	return { brandName, location, primaryService, estimatedLeads, queryPhrase };
}

function buildStatusHeadline(opts: {
	tone: ExecBriefStatusTone;
	query: string;
	lang: AuditLang;
}): string {
	const { tone, query, lang } = opts;
	const nouns = brandSearchNoun(lang);
	if (tone === 'optimal') {
		return lang === 'en'
			? `Brand-name search and “${query}” unbranded prompts both sustain citation signals.`
			: `${nouns.brand}과 '${query}' 비브랜드 질의 모두에서 인용 신호를 유지하고 있습니다.`;
	}
	if (tone === 'nearOptimal') {
		return lang === 'en'
			? `Citation foundations are in place. Expanding remaining engines to Level 3 on “${query}” is the next step.`
			: `주요 엔진 인용 기반은 형성됐습니다. '${query}' 질의의 잔여 엔진 Level 3 확장이 다음 과제입니다.`;
	}
	if (tone === 'categoryGap') {
		return lang === 'en'
			? `Some category queries surface the brand, but official AI citation signals remain thin on “${query}” Level 3 prompts.`
			: `카테고리·지역 질의까지는 일부 노출되지만, '${query}' 광의 의도(Level 3)에서 AI 공식 인용 신호가 부족합니다.`;
	}
	return lang === 'en'
		? `${nouns.brand} still works, but official AI citation signals are thin on prospect queries such as “${query}”.`
		: `${nouns.brand}은 가능하나, '${query}' 등 잠재 고객 질의에서 AI 공식 인용 신호가 부족한 상태입니다.`;
}

function buildJudgmentText(opts: {
	tone: ExecBriefStatusTone;
	brandName: string;
	lang: AuditLang;
	fallback: string;
}): string {
	const { tone, brandName, lang, fallback } = opts;
	if (tone === 'optimal' || tone === 'nearOptimal') return fallback;
	if (lang === 'en') {
		return `${brandName} is only limitedly visible at Level 1 when searched directly. On expanded location- and service-based queries, traffic is dispersed to third-party blogs and other information sources.`;
	}
	return `${withJosa(brandName, '을/를')} 직접 검색했을 때만 제한적으로 확인되는 Level 1 단계로, 지역 및 서비스 기반의 확장 질의 시 3자 블로그 및 타 정보 출처로 유입이 분산되고 있습니다.`;
}

function roiEffect(id: ExecBriefRoiEffect['id'], lead: string, highlight: string): ExecBriefRoiEffect {
	return { id, lead, highlight, text: `${lead}${highlight}` };
}

function buildRoiEffects(opts: {
	lang: AuditLang;
	gain: number;
	queryPhrase: string;
	estimatedLeads: number;
}): ExecBriefRoiEffect[] {
	const { lang, gain, queryPhrase, estimatedLeads } = opts;
	if (gain <= 0) return [];
	if (lang === 'en') {
		return [
			roiEffect(
				'recommend',
				`On conversational queries such as “${queryPhrase}”, `,
				'support entry into the official AI recommendation citation pool',
			),
			roiEffect(
				'leakage',
				'Aim to defend an estimated ',
				`~${estimatedLeads} monthly prospect-search sessions* (simulation estimate) currently dispersing to other platforms`,
			),
			roiEffect(
				'conversion',
				'Through wider search visibility and AI citation signals, ',
				'contribute to improving actual online inquiries and inbound conversion',
			),
		];
	}
	return [
		roiEffect(
			'recommend',
			`'${queryPhrase}' 관련 대화형 검색 질의 시 `,
			'AI 공식 추천 답변 후보군(Citation Pool) 진입 지원',
		),
		roiEffect(
			'leakage',
			'타 플랫폼으로 분산되던 ',
			`월 약 ${estimatedLeads}건*(시뮬레이션 추정치)의 잠재 고객 탐색 수요 유출 방어 목표`,
		),
		roiEffect(
			'conversion',
			'검색엔진 가시성 및 AI 인용 신호 확대를 통한 ',
			'실제 온라인 문의 및 유입 전환율 개선 기여',
		),
	];
}

function pTagForPriority(priority: ActionPointRecord['priority']): ExecBriefPTag {
	if (priority === 'P1') return 'p0Priority';
	if (priority === 'P2') return 'p1';
	return 'p2';
}

function actionPointToImprovement(point: ActionPointRecord): ExecBriefImprovement {
	return {
		id: point.id,
		theme: point.theme,
		title: point.title,
		detail: `${point.cause} ${point.action}`.trim(),
		statusLine: point.targetEngines,
		causeLine: point.cause,
		actionLine: point.action,
		targetEngines: point.targetEngines,
		priority: point.priority,
		priorityLabel: point.priorityLabel,
		pTag: pTagForPriority(point.priority),
		severity: point.priority === 'P1' ? 'critical' : point.priority === 'P2' ? 'warning' : 'info',
	};
}

function buildImprovements(
	report: AuditReport,
	engines: readonly AIEngineTestResult[],
	opts: {
		lang: AuditLang;
		schemaRaw: number;
		schemaMax: number;
		platform: EnginePlatformSignals;
		industry: IndustryConfig;
		hasLlms: boolean;
		isHttps: boolean;
		seoScore: number;
	},
): ExecBriefImprovement[] {
	return generateTop3ActionPoints({
		report,
		engines,
		platform: opts.platform,
		industry: opts.industry,
		lang: opts.lang,
		schemaRaw: opts.schemaRaw,
		schemaMax: opts.schemaMax,
		hasLlms: opts.hasLlms,
		isHttps: opts.isHttps,
		seoScore: opts.seoScore,
		siteName: resolveAuditSiteName(report),
		category: opts.industry.defaultCategory || report.siteMeta?.category || report.siteMeta?.primaryKeyword,
	}).map(actionPointToImprovement);
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
	const conversion = businessConversionFromAudit(live, geoReport, lang);
	const industry = resolveIndustryConfig({
		type: live.siteMeta?.industryType || live.siteMeta?.vertical,
		legacyIndustry: live.siteMeta?.industryType,
		title: live.metrics?.pageTitle || live.siteMeta?.brandName,
		description: live.metrics?.metaDescription,
		keywords: [live.siteMeta?.category, live.siteMeta?.primaryKeyword, ...(live.siteMeta?.entityPhrases ?? [])].filter(
			(v): v is string => Boolean(v),
		),
		brandName: conversion.brandName,
		location: conversion.location || live.siteMeta?.broadLocation || live.siteMeta?.location,
		primaryKeyword: conversion.primaryKeyword,
		lang,
	});
	const isHttps = resolveIsHttps({ url: live.url, hasSsl: live.hasSsl });
	const hasLlms = resolveHasLlmsTxt(live);
	const signals = extractSignalsFromReport(live);
	const platform = signals.platform ?? detectEnginePlatformSignals({
		schemaTypes: live.metrics?.schemaTypes ?? live.siteMeta?.schemaEntityTypes,
	});
	const schemaCat = snapshot.onpage.categories.find((cat) => cat.id === 'schema');
	const schemaMax = schemaCat?.maxScore || CHECKLIST_CATEGORY_MAX.schema_data;
	const schemaRaw = schemaCat?.rawScore ?? 0;
	const canLift = !isHttps || !hasLlms || (schemaMax > 0 && schemaRaw / schemaMax < 0.7);
	const statusTone = resolveExecBriefStatusTone(geoSummary);
	const bindings = resolveExecBriefBindings({
		brandName: resolveAuditSiteName(live),
		location: conversion.location || live.siteMeta?.location,
		broadLocation: live.siteMeta?.broadLocation,
		primaryKeyword: conversion.primaryKeyword,
		category: conversion.category || live.siteMeta?.category,
		defaultService: industry.primaryKeyword || industry.defaultCategory,
		lostLeads: live.metrics?.lostLeads,
		monthlySearchVolume: conversion.monthlySearchVolume,
		lang,
	});
	const currentScore = geoSummary.indexScore;
	const projectedScore = projectExecBriefAiIndex(currentScore, canLift);
	const gain = Math.max(0, projectedScore - currentScore);
	const alreadyInRange = currentScore >= AI_RECOMMEND_THRESHOLD;
	const reachesAGrade = projectedScore >= AI_RECOMMEND_THRESHOLD;
	const conversionLift = estimateConversionLiftPct(gain);
	const engines = geoReport.engines.map((engine) => ({
		id: engine.engine.id,
		name: EXEC_BRIEF_ENGINE_NAME[engine.engine.id] || engine.engine.name,
		score: engine.score,
		statusBadge: engine.statusBadge,
		depthLevel: engine.depthLevel,
		levelLabel: engine.depthLevel ? `Level ${engine.depthLevel}` : lang === 'en' ? 'Not cited' : '미인용',
		reason: engineLevelReason(engine.engine.id, engine.depthLevel, engine.score, lang),
	}));

	return {
		siteName: bindings.brandName,
		url: live.url,
		aiIndex: currentScore,
		seoScore,
		geoScore,
		indexedCount: geoSummary.indexedCount,
		totalEngines: geoSummary.totalEngines,
		indexedKind: resolveIndexedKind(geoSummary),
		levelCounts: geoSummary.levelCounts,
		unindexedCount: geoSummary.unindexedCount,
		statusTone,
		statusHeadline: buildStatusHeadline({ tone: statusTone, query: bindings.queryPhrase, lang }),
		bottleneckType: story.bottleneckType,
		urgencyLevel: story.urgencyLevel,
		judgmentText: buildJudgmentText({
			tone: statusTone,
			brandName: bindings.brandName,
			lang,
			fallback: live.executiveSummary?.riskAssessment.text ?? '',
		}),
		engines,
		improvements: buildImprovements(live, geoReport.engines, {
			lang,
			schemaRaw,
			schemaMax,
			platform,
			industry,
			hasLlms,
			isHttps,
			seoScore,
		}),
		currentScore,
		projectedScore,
		gain,
		reachesAGrade,
		alreadyInRange,
		inflowLiftPct: conversionLift,
		threshold: AI_RECOMMEND_THRESHOLD,
		isPrescriptionApplied: Boolean(live.isPrescriptionApplied),
		roiEffects: buildRoiEffects({
			lang,
			gain,
			queryPhrase: bindings.queryPhrase,
			estimatedLeads: bindings.estimatedLeads,
		}),
		brandName: bindings.brandName,
		location: bindings.location,
		primaryService: bindings.primaryService,
		estimatedLeads: bindings.estimatedLeads,
		queryPhrase: bindings.queryPhrase,
		perfectGuide: buildPerfectGuide({
			seoScore,
			currentScore,
			engines,
			queryPhrase: bindings.queryPhrase,
			industryType: industry.type,
			lang,
		}),
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
