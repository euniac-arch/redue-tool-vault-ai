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
import { resolveIsHttps } from '@/lib/audit/scoreCalculator';
import { buildGeoDiagnosticReportFromAudit } from '@/lib/geo/from-visibility';
import { withJosa } from '@/lib/korean-josa';
import {
	resolveIndustryConfig,
	type IndustryConfig,
	type IndustryType as RegistryIndustryType,
} from '@/lib/registry/universalIndustryRegistry';
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
export type ExecBriefIndexedKind = 'mentionOnly' | 'cited' | 'recommended';
export type ExecBriefPTag = 'p0Priority' | 'p0Urgent' | 'p1' | 'p2';

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
}

/** Conservative Level-3 foundation after SSL + JSON-LD + /llms.txt. */
export const AI_INDEX_LEVEL3_FOUNDATION = 77;

const SCHEMA_CHECKS = new Set([
	'jsonld-present',
	'jsonld_parse',
	'faq-howto-schema',
	'faq_howto_schema',
	'organization',
	'local_business_props',
	'website-schema',
	'core_schema',
]);
const FAQ_CHECKS = new Set(['faq-howto-schema', 'faq_howto_schema']);
const BOT_CHECKS = new Set(['ai-bots-allowed', 'ai_bots_robots']);
const EEAT_CHECKS = new Set(['person-eeat', 'eeat-author', 'person_profile', 'eeat_knowledge_graph']);
const GEO_CATEGORY_IDS = new Set(['geo', 'schema', 'geo_ai_signals', 'schema_data']);

const EXEC_BRIEF_ENGINE_NAME: Record<string, string> = {
	chatgpt: 'ChatGPT',
	gemini: 'Gemini',
	claude: 'Claude',
	perplexity: 'Perplexity',
	copilot: 'Microsoft Copilot',
	clova: 'Naver Cue',
};

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

function themeForFinding(finding: AuditFinding, categoryId?: string): ExecBriefImprovementId {
	const checkId = finding.checkId ?? '';
	if (checkId === 'https' || checkId === 'ssl_https') return 'ssl';
	if (checkId === 'llms-txt' || checkId === 'llms_txt') return 'llms';
	if (FAQ_CHECKS.has(checkId)) return 'faq';
	if (BOT_CHECKS.has(checkId)) return 'bots';
	if (EEAT_CHECKS.has(checkId)) return 'eeat';
	if (SCHEMA_CHECKS.has(checkId) || categoryId === 'schema' || categoryId === 'schema_data') return 'schema';
	if (categoryId && GEO_CATEGORY_IDS.has(categoryId)) return 'geo';
	if (checkId) return 'onpage';
	return 'generic';
}

function pTagForTheme(theme: ExecBriefImprovementId, severity: ExecBriefImprovement['severity']): ExecBriefPTag {
	if (theme === 'schema' || theme === 'eeat') return 'p0Priority';
	if (theme === 'ssl' || theme === 'llms') return 'p0Urgent';
	if (severity === 'critical') return 'p1';
	return 'p2';
}

function isMedicalVertical(type: RegistryIndustryType): boolean {
	return type === 'medical' || type === 'veterinary';
}

function hoursNoun(type: RegistryIndustryType, lang: AuditLang): string {
	if (lang === 'en') return isMedicalVertical(type) ? 'clinic hours' : 'opening hours';
	return isMedicalVertical(type) ? '진료시간' : '영업시간';
}

function eeatGapNoun(lang: AuditLang): string {
	return lang === 'en' ? 'entity E-E-A-T' : 'E-E-A-T 엔티티';
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

function schemaMissingParts(
	platform: EnginePlatformSignals,
	industry: IndustryConfig,
	lang: AuditLang,
): string[] {
	const parts: string[] = [];
	const schemaType = industry.schemaType;
	const hasCore =
		platform.hasLocalBusiness ||
		platform.hasOrganization ||
		(isMedicalVertical(industry.type) && platform.hasLocalBusiness);
	if (!hasCore) parts.push(lang === 'en' ? `${schemaType} schema` : `${schemaType} 스키마`);
	if (!platform.hasPerson) {
		parts.push(lang === 'en' ? `${industry.personJobTitle} profile` : `${industry.personJobTitle} 프로필`);
	}
	if (!platform.hasOpeningHours) parts.push(hoursNoun(industry.type, lang));
	if (!platform.hasGeoCoordinates) parts.push(lang === 'en' ? 'Geo coordinates' : 'Geo 좌표');
	return parts;
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

function buildSchemaImprovement(
	rawScore: number,
	maxScore: number,
	platform: EnginePlatformSignals,
	industry: IndustryConfig,
	lang: AuditLang,
): ExecBriefImprovement {
	const ratioPct = maxScore > 0 ? Math.round((Math.max(0, rawScore) / maxScore) * 100) : 0;
	const pts = `${formatExecBriefPts(rawScore)}/${formatExecBriefPts(maxScore)}`;
	const missing = schemaMissingParts(platform, industry, lang);
	const eeat = eeatGapNoun(lang);
	const title =
		lang === 'en'
			? `Structured data & ${eeat} missing`
			: `스키마 구조화 데이터 & ${eeat} 부재`;
	const statusLine =
		lang === 'en'
			? `${pts} of max (${ratioPct}% of the schema category)`
			: `만점 대비 ${pts}점 (${ratioPct}% 수준)`;
	const causeLine =
		missing.length > 0
			? lang === 'en'
				? `Missing ${missing.join(', ')}, so AI crawlers cannot readily verify official service facts and entity trust.`
				: `${missing.join(', ')} 누락으로 AI 크롤러가 공식 서비스 정보와 엔티티 신뢰도를 검증하기 어려움.`
			: lang === 'en'
				? 'Core schema fields are too thin for AI crawlers to verify official service facts and entity trust.'
				: '핵심 스키마 속성이 빈약해 AI 크롤러가 공식 서비스 정보와 엔티티 신뢰도를 검증하기 어려움.';
	return {
		id: 'schema-eeat',
		theme: 'schema',
		title,
		detail: `${statusLine} ${causeLine}`,
		statusLine,
		causeLine,
		pTag: 'p0Priority',
		severity: ratioPct < 50 ? 'critical' : 'warning',
	};
}

function buildLlmsImprovement(lang: AuditLang): ExecBriefImprovement {
	const title = lang === 'en' ? '/llms.txt (AI-only index) missing' : '/llms.txt (AI 전용 인덱스) 부재';
	const statusLine =
		lang === 'en' ? 'AI-search index file is not published' : 'AI 검색 전용 인덱스 파일 미배포';
	const causeLine =
		lang === 'en'
			? 'Major AI crawlers have no standard index path to immediately summarize and parse core services and official facts.'
			: '주요 AI 크롤러가 핵심 서비스와 공식 팩트를 즉시 요약·파싱할 수 있는 표준 인덱스 통로가 없음.';
	return {
		id: 'llms-txt',
		theme: 'llms',
		title,
		detail: `${statusLine} ${causeLine}`,
		statusLine,
		causeLine,
		pTag: 'p0Urgent',
		severity: 'critical',
	};
}

function buildSslImprovement(lang: AuditLang): ExecBriefImprovement {
	const title =
		lang === 'en'
			? 'Insecure HTTP → switch to HTTPS (SSL certificate) now'
			: '비보안 프로토콜(http) ➔ HTTPS 보안 프로토콜 (SSL 인증서) 즉시 전환';
	const statusLine = lang === 'en' ? 'protocol=http (SSL not applied)' : 'protocol=http (SSL 미적용)';
	const causeLine =
		lang === 'en'
			? 'Insecure origins are penalized in major AI trust scoring, and browser warnings reduce connection stability and limit AI citation trust.'
			: '비보안 사이트는 주요 AI 엔진의 신뢰도 평가에서 감점되며, 브라우저 접속 경고로 접속 안정성 저하 및 AI 인용 신뢰도 제한을 초래함.';
	return {
		id: 'ssl-https',
		theme: 'ssl',
		title,
		detail: `${statusLine} ${causeLine}`,
		statusLine,
		causeLine,
		pTag: 'p0Urgent',
		severity: 'critical',
	};
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
	},
): ExecBriefImprovement[] {
	const items: ExecBriefImprovement[] = [];
	const seen = new Set<string>();
	const push = (item: ExecBriefImprovement) => {
		const key = item.id || item.title;
		if (seen.has(key) || items.length >= 3) return;
		seen.add(key);
		items.push(item);
	};

	const schemaRatio = opts.schemaMax > 0 ? opts.schemaRaw / opts.schemaMax : 1;
	if (schemaRatio < 0.7) {
		push(buildSchemaImprovement(opts.schemaRaw, opts.schemaMax, opts.platform, opts.industry, opts.lang));
	}
	if (!opts.hasLlms) push(buildLlmsImprovement(opts.lang));
	if (!opts.isHttps) push(buildSslImprovement(opts.lang));

	const findings = [...(report.findings ?? [])].sort((a, b) => {
		if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
		return 0;
	});

	for (const finding of findings) {
		const categoryId = report.categories.find((cat) =>
			cat.checks?.some((check) => check.id === finding.checkId),
		)?.id;
		const theme = themeForFinding(finding, categoryId);
		if (theme === 'schema' || theme === 'eeat' || theme === 'llms' || theme === 'ssl') continue;
		push({
			id: finding.checkId || finding.title,
			theme,
			title: finding.title,
			detail: finding.detail,
			statusLine: finding.title,
			causeLine: finding.detail,
			pTag: pTagForTheme(theme, finding.severity),
			severity: finding.severity,
		});
	}

	const weakestEngine = [...engines].sort((a, b) => a.score - b.score)[0];
	if (weakestEngine?.improvementTip && weakestEngine.statusBadge !== 'optimal') {
		const engineLabel =
			opts.lang === 'en'
				? `${weakestEngine.engine.name} citation gap`
				: `${weakestEngine.engine.name} 인용 공백`;
		push({
			id: `engine-${weakestEngine.engine.id}`,
			theme: 'engine',
			title: engineLabel,
			detail: weakestEngine.improvementTip,
			statusLine: engineLabel,
			causeLine: weakestEngine.improvementTip,
			pTag: weakestEngine.statusBadge === 'not_indexed' ? 'p1' : 'p2',
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
		engines: geoReport.engines.map((engine) => ({
			id: engine.engine.id,
			name: EXEC_BRIEF_ENGINE_NAME[engine.engine.id] || engine.engine.name,
			score: engine.score,
			statusBadge: engine.statusBadge,
			depthLevel: engine.depthLevel,
			levelLabel: engine.depthLevel ? `Level ${engine.depthLevel}` : lang === 'en' ? 'Not cited' : '미인용',
			reason: engineLevelReason(engine.engine.id, engine.depthLevel, engine.score, lang),
		})),
		improvements: buildImprovements(live, geoReport.engines, {
			lang,
			schemaRaw,
			schemaMax,
			platform,
			industry,
			hasLlms,
			isHttps,
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
