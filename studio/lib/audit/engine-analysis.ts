/**
 * Per-engine AI Readiness Score — computed only from crawled on-page evidence.
 *
 * The numeric score is a site-analysis estimate (schema / entity / content /
 * external signals). It is not a live ChatGPT/Gemini/… exposure rate.
 * Cause copy must not claim a direct ranking effect on a specific AI.
 *
 * Engine weights (0–100, then weighted) — scoring formulas are unchanged:
 *  - Gemini     Knowledge Graph (org) · LocalBusiness · Google Maps / Geo
 *  - ChatGPT    GPTBot access · Bing Places sameAs · schema coverage
 *  - Copilot    AI-bot access · Bing Places sameAs · schema coverage
 *  - Perplexity FAQ/HowTo · GEO citation · citable official documents
 *  - Claude     ClaudeBot · FAQ/HowTo · technical completeness
 *  - Clova      Naver Place sameAs · Naver blog/content · entity keywords
 */

import { applyHttpsEngineScoreCap } from '@/lib/audit/scoreCalculator';
import {
	buildEngineCauseAnalysis,
	emptyAiEngineVisibilityMetrics,
	httpsEngineCriticalAnalysis,
	type AiEngineVisibilityMetrics,
	type EngineCauseFactor,
} from '@/lib/audit/engine-readiness';
import { exposureStatusFromScore, getRatingMeta, type EngineExposureStatus } from '@/lib/geo/rating-meta';
import type { AuditLang } from '@/lib/site-auditor';
import type { AIEngineId } from '@/types/geo-diagnostic';

export type { AiEngineVisibilityMetrics, EngineCauseFactor };
export { hasMeasuredVisibility } from '@/lib/audit/engine-readiness';

export type { EngineExposureStatus };

/** Display order for the Why & Status exposure panel. Live group: ChatGPT → Perplexity → Gemini → Claude. */
export const ENGINE_ANALYSIS_IDS = ['chatgpt', 'perplexity', 'gemini', 'claude', 'copilot', 'clova'] as const satisfies readonly AIEngineId[];

export type EngineAnalysisId = AIEngineId;

export const ENGINE_DISPLAY_NAME: Record<EngineAnalysisId, string> = {
	chatgpt: 'ChatGPT',
	perplexity: 'Perplexity',
	gemini: 'Gemini',
	claude: 'Claude',
	copilot: 'Copilot',
	clova: 'Clova',
};

export interface EngineAnalysisResult {
	engine: EngineAnalysisId;
	engineName: string;
	/** 0–100 AI Readiness Score (site-analysis estimate). Same value as `readinessScore`. */
	score: number;
	/** Alias of `score` — reserved name for the readiness vs visibility split. */
	readinessScore: number;
	status: EngineExposureStatus;
	/** 5-point band rating from `getRatingMeta(score)` — same source as card stars. */
	rating: number;
	/** Narrative cause summary — readiness gaps, not live AI ranking claims. */
	analysisReason: string;
	/** Diagnosed cause factors only — omitted when the matching signal is healthy. */
	causeFactors: EngineCauseFactor[];
	/**
	 * Live AI-query metrics. Null until a real visibility probe exists.
	 * Do not populate with invented exposure / citation rates.
	 */
	visibility: AiEngineVisibilityMetrics | null;
}

export interface EngineDiagnosticProps {
	engineResults: EngineAnalysisResult[];
}

/** On-page platform evidence extracted from JSON-LD, schema types, and page URLs. */
export interface EnginePlatformSignals {
	hasLocalBusiness: boolean;
	hasOrganization: boolean;
	hasFaq: boolean;
	hasHowTo: boolean;
	hasArticle: boolean;
	hasNewsArticle: boolean;
	hasPerson: boolean;
	hasGeoCoordinates: boolean;
	hasOpeningHours: boolean;
	hasTelephone: boolean;
	hasAddress: boolean;
	googleMapsLinked: boolean;
	bingPlacesLinked: boolean;
	naverPlaceLinked: boolean;
	naverBlogLinked: boolean;
	sameAsCount: number;
	/** FAQ + HowTo + Article + NewsArticle + Person — citable official docs. */
	officialDocCount: number;
}

export interface EngineScoreSignals {
	technicalPct: number;
	schemaPct: number;
	geoPct: number;
	orgPresent: boolean;
	orgComplete: boolean;
	faqPresent: boolean;
	aiBotsOk: boolean;
	keywords: readonly string[];
	aiBotAccess?: Partial<Record<'gptbot' | 'perplexitybot' | 'claudebot' | 'google-extended', boolean>>;
	organizationMissing?: readonly string[];
	defectCount?: number;
	/** Schema / on-page defect count alias used by Why & Status copy. */
	schemaDefectCount?: number;
	/** NAP completeness from live Organization / address / telephone signals. */
	napOk?: boolean;
	napIssue?: string;
	/** HTTPS / TLS on the audited origin. `false` applies the −18 / 64-cap. */
	isHttps?: boolean;
	/** Author / Person E-E-A-T checklist from the crawl. */
	eeatOk?: boolean;
	/** Visible body text length — used for long-form content evidence. */
	bodyLength?: number;
	hasLlmsTxt?: boolean;
	hasSearchIndex?: boolean;
	platform: EnginePlatformSignals;
}

const LOCAL_BUSINESS_TYPES = [
	'localbusiness',
	'medicalclinic',
	'hospital',
	'dentist',
	'physician',
	'veterinarycare',
	'medicalbusiness',
	'pharmacy',
	'store',
	'restaurant',
	'beautysalon',
	'foodestablishment',
	'lodgingbusiness',
	'professionalservice',
	'dentistoffice',
];

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function clampScore(value: number): number {
	return clamp(Math.round(Number.isFinite(value) ? value : 0), 0, 100);
}

function normalizeTypes(schemaTypes: readonly string[] | undefined): string[] {
	return (schemaTypes ?? []).map((t) => t.replace(/^https?:\/\/schema\.org\//i, '').trim().toLowerCase());
}

function hasType(types: readonly string[], ...needles: string[]): boolean {
	return needles.some((needle) => types.includes(needle.toLowerCase()));
}

function countSameAsLinks(corpus: string): number {
	const lower = corpus.toLowerCase();
	const urls = new Set<string>();
	let from = 0;
	while (from < lower.length) {
		const idx = lower.indexOf('sameas', from);
		if (idx < 0) break;
		const window = corpus.slice(idx, idx + 1400);
		for (const match of window.match(/https?:\/\/[^\s"'\\<>]+/gi) ?? []) {
			urls.add(match.replace(/[.,);]+$/g, '').toLowerCase());
		}
		from = idx + 6;
	}
	return urls.size;
}

export function detectEnginePlatformSignals(input: {
	schemaTypes?: readonly string[];
	jsonLdCorpus?: string;
	extraCorpus?: string;
}): EnginePlatformSignals {
	const types = normalizeTypes(input.schemaTypes);
	const corpus = `${input.jsonLdCorpus ?? ''}\n${input.extraCorpus ?? ''}`;
	const hay = corpus.toLowerCase();

	const hasFaq = hasType(types, 'faqpage') || /"@type"\s*:\s*"faqpage"|faqpage/.test(hay);
	const hasHowTo = hasType(types, 'howto') || /"@type"\s*:\s*"howto"/.test(hay);
	const hasArticle = hasType(types, 'article', 'blogposting') || /"@type"\s*:\s*"(article|blogposting)"/.test(hay);
	const hasNewsArticle = hasType(types, 'newsarticle') || /"@type"\s*:\s*"newsarticle"/.test(hay);
	const hasPerson = hasType(types, 'person') || /"@type"\s*:\s*"person"/.test(hay);
	const hasOrganization = hasType(types, 'organization') || /"@type"\s*:\s*"organization"/.test(hay);
	const hasLocalBusiness =
		types.some((t) => LOCAL_BUSINESS_TYPES.includes(t)) ||
		LOCAL_BUSINESS_TYPES.some((t) => hay.includes(`"@type":"${t}"`) || hay.includes(`"@type": "${t}"`));

	const hasGeoCoordinates =
		hasType(types, 'geocoordinates') || /geocoordinates|"latitude"|"longitude"/.test(hay);
	const hasOpeningHours = /openinghours|openinghoursspecification/.test(hay);
	const hasTelephone = /"telephone"\s*:/.test(hay);
	const hasAddress = /"address"\s*:|postaladdress|streetaddress/.test(hay);

	const googleMapsLinked = /maps\.google|google\.com\/maps|goo\.gl\/maps|g\.page\/|plus\.codes/.test(hay);
	const bingPlacesLinked = /bing\.com\/maps|bingplaces|bing\.com\/local|www\.bing\.com\/maps/.test(hay);
	const naverPlaceLinked = /place\.naver\.com|map\.naver\.com|m\.place\.naver|naver\.me\//.test(hay);
	const naverBlogLinked = /blog\.naver\.com|cafe\.naver\.com|post\.naver\.com|in\.naver\.com/.test(hay);

	const officialDocCount = [hasFaq, hasHowTo, hasArticle, hasNewsArticle, hasPerson].filter(Boolean).length;

	return {
		hasLocalBusiness,
		hasOrganization,
		hasFaq,
		hasHowTo,
		hasArticle,
		hasNewsArticle,
		hasPerson,
		hasGeoCoordinates,
		hasOpeningHours,
		hasTelephone,
		hasAddress,
		googleMapsLinked,
		bingPlacesLinked,
		naverPlaceLinked,
		naverBlogLinked,
		sameAsCount: countSameAsLinks(corpus),
		officialDocCount,
	};
}

function gptBotOk(signals: EngineScoreSignals): boolean {
	if (typeof signals.aiBotAccess?.gptbot === 'boolean') return signals.aiBotAccess.gptbot;
	return signals.aiBotsOk;
}

function claudeBotOk(signals: EngineScoreSignals): boolean {
	if (typeof signals.aiBotAccess?.claudebot === 'boolean') return signals.aiBotAccess.claudebot;
	return signals.aiBotsOk;
}

function faqOk(signals: EngineScoreSignals): boolean {
	return signals.faqPresent || signals.platform.hasFaq || signals.platform.hasHowTo;
}

export function scoreGemini(signals: EngineScoreSignals): number {
	const { platform } = signals;
	const knowledgeGraph = signals.orgComplete ? 88 : signals.orgPresent ? 58 : 26;
	const localSchema = platform.hasLocalBusiness ? 84 : signals.orgPresent ? 46 : 22;
	const maps = platform.googleMapsLinked ? 88 : platform.hasGeoCoordinates || platform.hasAddress ? 60 : 26;
	return clampScore(knowledgeGraph * 0.4 + localSchema * 0.25 + maps * 0.2 + signals.schemaPct * 0.15);
}

export function scoreChatGpt(signals: EngineScoreSignals): number {
	const bots = gptBotOk(signals) ? 78 : 24;
	const bing = signals.platform.bingPlacesLinked ? 90 : 30;
	return clampScore(bots * 0.4 + bing * 0.3 + signals.schemaPct * 0.3);
}

export function scorePerplexity(signals: EngineScoreSignals): number {
	const faq = faqOk(signals) ? 86 : 32;
	const docs = clamp(20 + signals.platform.officialDocCount * 16, 20, 90);
	return clampScore(faq * 0.4 + signals.geoPct * 0.35 + docs * 0.25);
}

export function scoreClaude(signals: EngineScoreSignals): number {
	const bot = claudeBotOk(signals) ? 80 : 22;
	const faq = faqOk(signals) ? 85 : 35;
	return clampScore(bot * 0.4 + faq * 0.3 + signals.technicalPct * 0.3);
}

export function scoreCopilot(signals: EngineScoreSignals): number {
	const bots = signals.aiBotsOk ? 75 : 25;
	const bing = signals.platform.bingPlacesLinked ? 90 : 30;
	return clampScore(bots * 0.3 + bing * 0.3 + signals.schemaPct * 0.4);
}

export function scoreClova(signals: EngineScoreSignals): number {
	const place = signals.platform.naverPlaceLinked ? 86 : 32;
	const content = signals.platform.naverBlogLinked ? 82 : signals.geoPct;
	const entity = signals.keywords.length >= 3 ? 78 : 42;
	return clampScore(place * 0.4 + content * 0.4 + entity * 0.2);
}

const ENGINE_SCORERS: Record<EngineAnalysisId, (signals: EngineScoreSignals) => number> = {
	gemini: scoreGemini,
	chatgpt: scoreChatGpt,
	perplexity: scorePerplexity,
	claude: scoreClaude,
	copilot: scoreCopilot,
	clova: scoreClova,
};

/** Uncapped 0–100 indexes — HTTPS −18 / 64-cap is applied in `scoreCalculator`. */
export function rawEngineScoresFromSignals(
	signals: EngineScoreSignals,
): Record<EngineAnalysisId, number> {
	return {
		gemini: ENGINE_SCORERS.gemini(signals),
		chatgpt: ENGINE_SCORERS.chatgpt(signals),
		perplexity: ENGINE_SCORERS.perplexity(signals),
		claude: ENGINE_SCORERS.claude(signals),
		copilot: ENGINE_SCORERS.copilot(signals),
		clova: ENGINE_SCORERS.clova(signals),
	};
}

export function buildEngineAnalysisReason(
	engine: EngineAnalysisId,
	signals: EngineScoreSignals,
	lang: AuditLang = 'ko',
): string {
	return buildEngineCauseAnalysis(engine, signals, lang).summary;
}

/** Why-copy override when the origin is HTTP — always the first cause. */
export function httpsEngineCriticalReason(failCount: number, lang: AuditLang = 'ko'): string {
	return httpsEngineCriticalAnalysis(failCount, lang).summary;
}

export function buildEngineAnalysisResult(
	engine: EngineAnalysisId,
	signals: EngineScoreSignals,
	lang: AuditLang = 'ko',
): EngineAnalysisResult {
	const isHttps = signals.isHttps !== false;
	const score = applyHttpsEngineScoreCap(ENGINE_SCORERS[engine](signals), isHttps);
	const meta = getRatingMeta(score, lang);
	const failCount = signals.schemaDefectCount ?? signals.defectCount ?? 0;
	const analysis = isHttps
		? buildEngineCauseAnalysis(engine, signals, lang)
		: httpsEngineCriticalAnalysis(failCount, lang);
	return {
		engine,
		engineName: ENGINE_DISPLAY_NAME[engine],
		score: meta.score,
		readinessScore: meta.score,
		status: exposureStatusFromScore(meta.score),
		rating: meta.ratingOutOf5,
		analysisReason: analysis.summary,
		causeFactors: analysis.factors,
		visibility: emptyAiEngineVisibilityMetrics(),
	};
}

export function buildEngineAnalysisResults(
	signals: EngineScoreSignals,
	lang: AuditLang = 'ko',
): EngineAnalysisResult[] {
	return ENGINE_ANALYSIS_IDS.map((engine) => buildEngineAnalysisResult(engine, signals, lang));
}

export function toEngineAnalysisResult(
	engine: Pick<EngineAnalysisResult, 'engine' | 'score' | 'analysisReason'> & {
		engineName?: string;
		status?: EngineExposureStatus;
		rating?: number;
		readinessScore?: number;
		causeFactors?: EngineCauseFactor[];
		visibility?: AiEngineVisibilityMetrics | null;
	},
): EngineAnalysisResult {
	const meta = getRatingMeta(engine.score);
	return {
		engine: engine.engine,
		engineName: engine.engineName || ENGINE_DISPLAY_NAME[engine.engine],
		score: meta.score,
		readinessScore: engine.readinessScore ?? meta.score,
		status: engine.status ?? exposureStatusFromScore(meta.score),
		rating: engine.rating ?? meta.ratingOutOf5,
		analysisReason: engine.analysisReason,
		causeFactors: engine.causeFactors ?? [],
		visibility: engine.visibility ?? emptyAiEngineVisibilityMetrics(),
	};
}
