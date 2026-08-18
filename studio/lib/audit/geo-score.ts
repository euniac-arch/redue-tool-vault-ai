/**
 * GEO external-reputation scoring — crawl-signal layer.
 *
 * Engine scores, badges, and cause-analysis copy come from on-page evidence
 * (schema coverage, FAQ/HowTo, robots.txt AI-bot access, Organization
 * completeness, sameAs platform links). There is no static 6-engine score
 * table and no domain-seeded PRNG. Bing Places / Naver Place / Google Maps
 * are inferred from sameAs and schema fields collected on the audited page —
 * not from live Places APIs.
 *
 * Two entry points share the same scoring core (`computeExternalReputationFromSignals`):
 *  - `buildHeuristicExternalReputation`   — precise, from a full crawled `AuditReport` (client-side fallback).
 *  - `buildExternalReputationFromFails`   — approximate, from `technicalFails` text lines
 *                                            (server-side fallback inside the GEO narrative API,
 *                                            which only ever sees a `GeoNarrativeRequest`).
 */

import { countAuditDefects } from '@/lib/audit/latest-audit-payload';
import {
	calculateGeoComprehensiveScores,
	geoRawSignalsFromReputation,
} from '@/lib/audit/geoScoreCalculator';
import { HTTPS_P0_LABEL, resolveIsHttps } from '@/lib/audit/scoreCalculator';
import { getReputationInsight } from '@/lib/audit/reputation-insight';
import { gradeForScore, type ScoreGrade } from '@/lib/audit/score-grade';
import {
	buildEngineAnalysisResults,
	detectEnginePlatformSignals,
	ENGINE_DISPLAY_NAME,
	type EngineAnalysisResult,
	type EnginePlatformSignals,
} from '@/lib/audit/engine-analysis';
import { exposureStatusFromScore, getRatingMeta, type EngineExposureStatus } from '@/lib/geo/rating-meta';
import {
	buildEeatAuditData,
	type EeatHowtoGuides,
} from '@/lib/audit/eeat-audit';
import { buildAiCrawlerStatuses } from '@/lib/geo/precision-diagnostics';
import type { AuditCheckItem, AuditLang, AuditReport } from '@/lib/site-auditor';
import type { AIEngineId, AiCrawlerBotStatus, SchemaPropertyCheck } from '@/types/geo-diagnostic';

export type {
	AiEngineVisibilityMetrics,
	EngineAnalysisResult,
	EngineCauseFactor,
	EngineDiagnosticProps,
	EngineExposureStatus,
} from '@/lib/audit/engine-analysis';

export { hasMeasuredVisibility } from '@/lib/audit/engine-analysis';

export { getReputationInsight, resolveReputationInsight } from '@/lib/audit/reputation-insight';

export type { ScoreGrade } from '@/lib/audit/score-grade';
export { gradeForScore } from '@/lib/audit/score-grade';

export type { RatingMeta, RatingStatusKey, RatingTone } from '@/lib/geo/rating-meta';
export { exposureStatusFromScore, getRatingMeta } from '@/lib/geo/rating-meta';

/** Why & Status engine ids — same 6-engine catalog as GEO diagnostic. */
export type AiEngineId = AIEngineId;

export interface AiEngineExposure extends EngineAnalysisResult {
	engineLabel: string;
	/** 1–5 filled stars — always `getRatingMeta(score).filledStars`. */
	stars: number;
	statusLabel: string;
	/** Alias of `analysisReason` for existing panel bindings. */
	reason: string;
}

export interface EeatBrandTrust {
	keywords: string[];
	missingKeyword?: string;
	/** Footer / Person-schema representative legal name. */
	personName?: string;
	/** Person schema jobTitle from the crawl or industry registry. */
	personJobTitle?: string;
	recommendedSchemaType?: string;
	/** 0–100 */
	napMatchRate: number;
	napIssue?: string;
	/** Optional Schema.org 5-property completeness checklist (E-E-A-T). */
	schemaProperties?: readonly SchemaPropertyCheck[];
}

export interface DigitalFootprint {
	googleMentionCount: number;
	googleMentionBenchmark: number;
	naverMentionCount: number;
	naverMentionIssue?: string;
	bingPlacesRegistered: boolean;
	bingPlacesNote?: string;
	/** Optional per-bot robots.txt / WAF access snapshot. */
	aiBots?: readonly AiCrawlerBotStatus[];
	/** Industry-tuned How-to copy for the Digital Footprint tabs. */
	howtoGuides?: EeatHowtoGuides;
}

export type GeoActionPriority = 'urgent' | 'recommended';

export interface GeoActionPlanItem {
	id: string;
	priority: GeoActionPriority;
	pointGain: number;
	title: string;
	description: string;
}

export interface GeoScoreOverview {
	score: number;
	grade: ScoreGrade;
	percentile: number;
	summary: string;
	minExposureThreshold: number;
	topRecommendationThreshold: number;
	pointsToTop: number;
}

export interface GeoExternalReputationReport {
	overview: GeoScoreOverview;
	aiEngines: AiEngineExposure[];
	brandTrust: EeatBrandTrust;
	digitalFootprint: DigitalFootprint;
	actionPlan: GeoActionPlanItem[];
}

/** Normalized inputs the scoring core needs — extracted either from a full AuditReport or from raw text. */
export interface GeoReputationSignals {
	domain: string;
	technicalPct: number;
	schemaPct: number;
	geoPct: number;
	orgPresent: boolean;
	orgComplete: boolean;
	faqPresent: boolean;
	aiBotsOk: boolean;
	keywords: string[];
	specialties?: string[];
	location?: string;
	broadLocation?: string;
	brandName?: string;
	detectedKeywords?: string[];
	primaryKeyword?: string;
	category?: string;
	/** Optional per-bot allow map from the live crawl (`true` = allowed). */
	aiBotAccess?: Partial<Record<'gptbot' | 'perplexitybot' | 'claudebot' | 'google-extended', boolean>>;
	schemaTypes?: string[];
	jsonLdCorpus?: string;
	footerText?: string;
	representativeName?: string;
	representativeJobTitle?: string;
	organizationMissing?: string[];
	industryType?: string;
	/** Open on-page checklist defects (fail + warning). */
	defectCount?: number;
	/** sameAs / schema platform evidence (Google Maps, Bing Places, Naver). */
	platform?: EnginePlatformSignals;
	/** HTTPS / TLS on the audited origin. Missing = unknown (no P0 card). */
	isHttps?: boolean;
	hasLlmsTxt?: boolean;
	bodyLength?: number;
	hasSearchIndex?: boolean;
	eeatOk?: boolean;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function domainFromUrl(raw: string): string {
	try {
		return new URL(raw).hostname.replace(/^www\./, '');
	} catch {
		return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || raw;
	}
}

function resolveStatus(check: AuditCheckItem): 'pass' | 'fail' | 'warning' {
	return check.status ?? (check.passed ? 'pass' : 'fail');
}

function checkPassed(checks: AuditCheckItem[], id: string): boolean {
	const found = checks.find((c) => c.id === id);
	return found ? resolveStatus(found) === 'pass' : false;
}

function engineLabelFor(id: AiEngineId, lang: AuditLang): string {
	const names: Record<AiEngineId, { ko: string; en: string }> = {
		gemini: { ko: 'Gemini AI 검색 준비도', en: 'Gemini AI search readiness' },
		chatgpt: { ko: 'ChatGPT AI 검색 준비도', en: 'ChatGPT AI search readiness' },
		perplexity: { ko: 'Perplexity AI 검색 준비도', en: 'Perplexity AI search readiness' },
		claude: { ko: 'Claude AI 검색 준비도', en: 'Claude AI search readiness' },
		copilot: { ko: 'Copilot AI 검색 준비도', en: 'Copilot AI search readiness' },
		clova: { ko: 'Clova AI 검색 준비도', en: 'Clova AI search readiness' },
	};
	return lang === 'en' ? names[id].en : names[id].ko;
}

function toAiEngineExposure(result: EngineAnalysisResult, lang: AuditLang): AiEngineExposure {
	const meta = getRatingMeta(result.score, lang);
	return {
		...result,
		score: meta.score,
		readinessScore: result.readinessScore ?? meta.score,
		status: result.status ?? exposureStatusFromScore(meta.score),
		rating: result.rating ?? meta.ratingOutOf5,
		engineName: result.engineName || ENGINE_DISPLAY_NAME[result.engine],
		engineLabel: engineLabelFor(result.engine, lang),
		stars: meta.filledStars,
		statusLabel: meta.statusLabel,
		reason: result.analysisReason,
		causeFactors: result.causeFactors ?? [],
		visibility: result.visibility ?? null,
	};
}

/** Recompute stars + status from `score` so LLM/legacy payloads cannot drift. */
export function hydrateAiEngineExposure(
	engine: Omit<
		AiEngineExposure,
		| 'score'
		| 'stars'
		| 'statusLabel'
		| 'status'
		| 'rating'
		| 'engineName'
		| 'analysisReason'
		| 'readinessScore'
		| 'causeFactors'
		| 'visibility'
	> & {
		score?: number;
		stars?: number;
		statusLabel?: string;
		status?: EngineExposureStatus;
		rating?: number;
		engineName?: string;
		analysisReason?: string;
		reason?: string;
		readinessScore?: number;
		causeFactors?: AiEngineExposure['causeFactors'];
		visibility?: AiEngineExposure['visibility'];
	},
	lang: AuditLang = 'ko',
): AiEngineExposure {
	const rawScore =
		typeof engine.score === 'number' && Number.isFinite(engine.score)
			? engine.score
			: typeof engine.stars === 'number'
				? (engine.stars / 5) * 100
				: 0;
	const meta = getRatingMeta(rawScore, lang);
	const analysisReason = engine.analysisReason || engine.reason || '';
	return {
		engine: engine.engine,
		engineName: engine.engineName || ENGINE_DISPLAY_NAME[engine.engine],
		engineLabel: engineLabelFor(engine.engine, lang),
		score: meta.score,
		readinessScore: meta.score,
		status: exposureStatusFromScore(meta.score),
		rating: meta.ratingOutOf5,
		analysisReason,
		stars: meta.filledStars,
		statusLabel: meta.statusLabel,
		reason: analysisReason,
		causeFactors: engine.causeFactors ?? [],
		visibility: engine.visibility ?? null,
	};
}


/** Extract normalized scoring signals from a full crawled AuditReport (precise path). */
export function extractSignalsFromReport(report: AuditReport): GeoReputationSignals {
	const domain = report.siteMeta?.domain || domainFromUrl(report.url);
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const orgMissing = report.metrics?.organizationMissing;
	const orgPresent =
		checkPassed(checks, 'organization') || checks.some((c) => c.id === 'organization' && resolveStatus(c) === 'warning');
	const orgComplete = orgPresent && (!orgMissing || orgMissing.length === 0);
	const schemaTypes = report.metrics?.schemaTypes ?? report.siteMeta?.schemaEntityTypes;
	const jsonLdCorpus = (report.metrics?.jsonLdSnippets ?? []).join('\n');
	const extraCorpus = [...(report.collectedUrls ?? []), report.footerText ?? ''].join('\n');
	const platform = detectEnginePlatformSignals({ schemaTypes, jsonLdCorpus, extraCorpus });

	return {
		domain,
		technicalPct: report.maxScore > 0 ? (report.score / report.maxScore) * 100 : 50,
		schemaPct: report.schemaCoverage ?? 50,
		geoPct: (() => {
			const geoCat = report.categories?.find((c) => c.id === 'geo' || c.id === 'geoAi' || c.id === 'geo_ai_signals');
			if (geoCat && geoCat.maxScore > 0) return (geoCat.score / geoCat.maxScore) * 100;
			return report.geoCitationScore ?? 50;
		})(),
		orgPresent,
		orgComplete,
		faqPresent: checkPassed(checks, 'faq-howto-schema') || platform.hasFaq || platform.hasHowTo,
		aiBotsOk: checkPassed(checks, 'ai-bots-allowed'),
		hasLlmsTxt: Boolean(report.metrics?.hasLlmsTxt) || checkPassed(checks, 'llms-txt') || checkPassed(checks, 'llms_txt'),
		bodyLength: report.metrics?.bodyTextLength ?? 0,
		hasSearchIndex: report.indexStatus ? report.indexStatus.allowed : true,
		eeatOk: checkPassed(checks, 'eeat-author') || checkPassed(checks, 'person-eeat'),
		keywords: [
			...(report.siteMeta?.coreSpecialties ?? []),
			report.siteMeta?.primaryKeyword,
			report.siteMeta?.broadLocation,
			report.siteMeta?.category,
		].filter((v): v is string => Boolean(v && v.trim())),
		specialties: report.siteMeta?.coreSpecialties,
		location: report.siteMeta?.location,
		broadLocation: report.siteMeta?.broadLocation,
		brandName: report.siteMeta?.brandName,
		detectedKeywords: report.siteMeta?.detectedKeywords ?? report.detectedKeywords,
		primaryKeyword: report.siteMeta?.primaryKeyword,
		category: report.siteMeta?.category,
		aiBotAccess: report.metrics?.aiBotAccess,
		schemaTypes,
		jsonLdCorpus,
		footerText: report.footerText,
		representativeName: report.siteMeta?.representativeName,
		representativeJobTitle: report.siteMeta?.representativeJobTitle,
		organizationMissing: report.metrics?.organizationMissing,
		industryType: report.siteMeta?.industryType,
		defectCount: countAuditDefects(report),
		platform,
		isHttps: resolveIsHttps({ url: report.url, hasSsl: report.hasSsl }),
	};
}

/** Approximate the same signals from `technicalFails` evidence lines (server-side path, no full report available). */
export function extractSignalsFromFails(args: {
	domain: string;
	technicalFails: string[];
	brandName?: string;
	category?: string;
	broadLocation?: string;
}): GeoReputationSignals {
	const corpus = args.technicalFails.join(' | ').toLowerCase();
	const has = (...needles: string[]) => needles.some((n) => corpus.includes(n.toLowerCase()));

	// A fail line even mentioning a channel implies it's unhealthy; silence implies pass.
	const orgHealthy = !has('organization');
	const faqPresent = !has('faqpage', 'faq');
	const aiBotsOk = !has('ai crawler', 'ai bots', 'gptbot', 'perplexitybot', 'robots.txt');
	const schemaBad = has('json-ld', 'schema.org', 'no schema.org types');

	const failPenalty = Math.min(60, args.technicalFails.length * 6);
	const technicalPct = clamp(85 - failPenalty, 15, 92);
	const schemaPct = clamp(schemaBad ? 35 : 70, 10, 95);
	const geoPct = clamp((faqPresent ? 60 : 30) + (aiBotsOk ? 15 : -15), 10, 95);
	const failCorpus = args.technicalFails.join('\n');
	const platform = detectEnginePlatformSignals({ jsonLdCorpus: failCorpus, extraCorpus: failCorpus });

	return {
		domain: args.domain,
		technicalPct,
		schemaPct,
		geoPct,
		orgPresent: orgHealthy,
		orgComplete: orgHealthy,
		faqPresent,
		aiBotsOk,
		hasLlmsTxt: !has('llms.txt', 'llms-txt'),
		bodyLength: has('body text', 'crawlable', '본문') ? 80 : 400,
		hasSearchIndex: !has('noindex', 'x-robots'),
		eeatOk: orgHealthy && !has('person', 'e-e-a-t', 'eeat'),
		keywords: [args.category, args.broadLocation].filter((v): v is string => Boolean(v && v.trim())),
		specialties: args.category ? [args.category] : [],
		broadLocation: args.broadLocation,
		brandName: args.brandName,
		primaryKeyword: args.category,
		category: args.category,
		defectCount: args.technicalFails.length,
		platform,
	};
}

/** Core deterministic scoring shared by both signal-extraction paths. */
export function computeExternalReputationFromSignals(
	signals: GeoReputationSignals,
	lang: AuditLang = 'ko',
): GeoExternalReputationReport {
	const { technicalPct, schemaPct, geoPct, orgPresent, orgComplete, faqPresent, aiBotsOk, keywords } = signals;
	const platform =
		signals.platform ??
		detectEnginePlatformSignals({
			schemaTypes: signals.schemaTypes,
			jsonLdCorpus: signals.jsonLdCorpus,
		});

	// —— Overview score = exact 4-pillar sum (entity + bots + NAP + RAG) ——
	const geoComprehensive = calculateGeoComprehensiveScores(
		geoRawSignalsFromReputation({
			...signals,
			platform,
		}),
		signals.isHttps !== false,
		lang,
	);
	const score = geoComprehensive.rawGeoScore;
	const grade = gradeForScore(score);
	const percentile = clamp(100 - Math.round(score), 1, 99);
	const minExposureThreshold = 70;
	const topRecommendationThreshold = 85;
	const pointsToTop = Math.max(0, topRecommendationThreshold - score);

	const eeat = buildEeatAuditData({
		lang,
		specialties: signals.specialties?.length ? signals.specialties : keywords,
		primaryKeyword: signals.primaryKeyword,
		category: signals.category,
		location: signals.location,
		broadLocation: signals.broadLocation,
		brandName: signals.brandName,
		detectedKeywords: signals.detectedKeywords,
		industryType: signals.industryType,
		schemaTypes: signals.schemaTypes,
		jsonLdCorpus: signals.jsonLdCorpus,
		footerText: signals.footerText,
		representativeName: signals.representativeName,
		representativeJobTitle: signals.representativeJobTitle,
		organizationMissing: signals.organizationMissing,
		orgPresent,
		orgComplete,
		faqPresent,
		geoPct,
		schemaPct,
		platform,
		aiBotAccess: signals.aiBotAccess,
	});

	const googleMentionBenchmark = eeat.data.digitalFootprint.googleBenchmarkAvg;
	const googleMentionCount = eeat.data.digitalFootprint.googleMentionsCount;
	const naverMentionCount = eeat.data.digitalFootprint.naverPostingsCount;
	const naverLow = !platform.naverPlaceLinked && !platform.naverBlogLinked;
	const naverMentionIssue = naverLow
		? lang === 'en'
			? 'No Naver Place or blog sameAs signal was found on the audited page.'
			: '감사 페이지에서 네이버 플레이스·블로그 sameAs 신호가 확인되지 않았습니다.'
		: undefined;

	const bingPlacesRegistered = eeat.data.digitalFootprint.bingPlacesRegistered;
	const bingPlacesNote = bingPlacesRegistered
		? undefined
		: lang === 'en'
			? 'No Bing Places sameAs signal on this page — ChatGPT Search location cards stay blocked.'
			: '페이지에서 Bing Places 연동 신호가 없어 ChatGPT 검색 위치 카드가 생성되지 않습니다.';

	const napMatchRate = eeat.data.napMatchRate;
	const napIssue = eeat.data.napStatusDescription;

	const brandTrust: EeatBrandTrust = {
		keywords: eeat.data.primaryKeywords,
		missingKeyword: eeat.showMissingKeyword ? eeat.data.missingTargetKeyword : undefined,
		personName: eeat.data.personName,
		personJobTitle: eeat.data.personJobTitle,
		recommendedSchemaType: eeat.data.recommendedSchemaType,
		napMatchRate,
		napIssue,
		schemaProperties: eeat.schemaProperties,
	};
	const digitalFootprint: DigitalFootprint = {
		googleMentionCount,
		googleMentionBenchmark,
		naverMentionCount,
		naverMentionIssue,
		bingPlacesRegistered,
		bingPlacesNote,
		aiBots: buildAiCrawlerStatuses({
			lang,
			aiBotsOk,
			aiBotAccess: signals.aiBotAccess,
		}),
		howtoGuides: eeat.howtoGuides,
	};

	const aiEngines: AiEngineExposure[] = buildEngineAnalysisResults(
		{
			technicalPct,
			schemaPct,
			geoPct,
			orgPresent,
			orgComplete,
		faqPresent,
		aiBotsOk,
		hasLlmsTxt: signals.hasLlmsTxt,
		bodyLength: signals.bodyLength,
		hasSearchIndex: signals.hasSearchIndex,
		eeatOk: signals.eeatOk,
		keywords,
			aiBotAccess: signals.aiBotAccess,
			organizationMissing: signals.organizationMissing,
			defectCount: signals.defectCount,
			schemaDefectCount: signals.defectCount,
			napOk: napMatchRate >= 90,
			napIssue,
			isHttps: signals.isHttps,
			platform,
		},
		lang,
	).map((result) => toAiEngineExposure(result, lang));

	// —— Action plan ——
	const actionPlan: GeoActionPlanItem[] = [];
	if (signals.isHttps === false) {
		actionPlan.push({
			id: 'https-ssl',
			priority: 'urgent',
			pointGain: 15,
			title: lang === 'en' ? HTTPS_P0_LABEL.en : HTTPS_P0_LABEL.ko,
			description:
				lang === 'en'
					? 'HTTP sites are hard-capped at grade B. Apply free Let\'s Encrypt SSL so browsers and AI engines can trust the origin.'
					: 'HTTP 사이트는 종합 등급이 B(78점)로 강제 캡핑됩니다. 무료 Let\'s Encrypt SSL을 적용해야 브라우저·AI 엔진 신뢰가 회복됩니다.',
		});
	}
	if (!bingPlacesRegistered) {
		actionPlan.push({
			id: 'bing-places',
			priority: 'urgent',
			pointGain: 5,
			title: lang === 'en' ? 'Register a Bing Places profile' : 'Bing Places 프로필 등록',
			description:
				lang === 'en'
					? 'Secures a primary data source ChatGPT crawlers can cite directly.'
					: 'ChatGPT 크롤러가 직접 인용할 수 있는 1차 데이터 출처를 확보합니다.',
		});
	}
	if (naverLow || !faqPresent) {
		actionPlan.push({
			id: 'naver-faq',
			priority: 'recommended',
			pointGain: 3,
			title:
				lang === 'en'
					? 'Expand Naver blog/KnowledgeIN Q&A content'
					: '네이버 블로그/지식iN에 Q&A 형태의 FAQ 데이터 확장',
			description:
				lang === 'en'
					? 'Restructures reviews/info into the format AI engines cite most as an answer source.'
					: 'AI 검색 엔진이 답변 출처로 인용하기 가장 좋은 구조로 후기/정보를 재배치합니다.',
		});
	}
	if (napMatchRate < 90) {
		actionPlan.push({
			id: 'nap-sync',
			priority: 'recommended',
			pointGain: 2,
			title:
				lang === 'en'
					? 'Complete Organization NAP fields (address, telephone, hours)'
					: 'Organization NAP(주소·전화·영업시간) 속성 완결',
			description:
				lang === 'en'
					? 'Filling address/telephone/hours on-page strengthens AI-engine trust (E-E-A-T) signals.'
					: '주소·전화번호·영업시간을 온페이지에 채워 AI 엔진의 신뢰도(E-E-A-T) 점수를 확보합니다.',
		});
	}
	if (actionPlan.length === 0) {
		actionPlan.push({
			id: 'maintain',
			priority: 'recommended',
			pointGain: 1,
			title: lang === 'en' ? 'Keep reviews and content fresh' : '지속적인 리뷰·콘텐츠 관리로 GEO 우위 유지',
			description:
				lang === 'en'
					? 'External reputation signals are already solid — keep refreshing reviews/content to defend the lead.'
					: '외부 평판 신호가 이미 양호합니다 — 리뷰·콘텐츠를 꾸준히 갱신해 우위를 지켜야 합니다.',
		});
	}
	actionPlan.sort((a, b) => {
		if (a.id === 'https-ssl') return -1;
		if (b.id === 'https-ssl') return 1;
		return b.pointGain - a.pointGain;
	});

	const overview: GeoScoreOverview = {
		score,
		grade,
		percentile,
		summary: getReputationInsight(signals.defectCount ?? 0, score, lang, { isHttps: signals.isHttps }),
		minExposureThreshold,
		topRecommendationThreshold,
		pointsToTop,
	};

	return { overview, aiEngines, brandTrust, digitalFootprint, actionPlan: actionPlan.slice(0, 4) };
}

/** Precise path — used client-side once the full crawled AuditReport is available. */
export function buildHeuristicExternalReputation(report: AuditReport, lang: AuditLang = 'ko'): GeoExternalReputationReport {
	return computeExternalReputationFromSignals(extractSignalsFromReport(report), lang);
}

/** Approximate path — used server-side inside the GEO narrative API/heuristic fallback. */
export function buildExternalReputationFromFails(
	args: {
		domain: string;
		technicalFails: string[];
		brandName?: string;
		category?: string;
		broadLocation?: string;
	},
	lang: AuditLang = 'ko',
): GeoExternalReputationReport {
	return computeExternalReputationFromSignals(extractSignalsFromFails(args), lang);
}

/**
 * Single resolver used by every Tab-1 UI panel.
 * Overview / action-plan copy may come from the GEO narrative payload, but
 * `aiEngines` (scores, badges, cause text) are always recomputed from the
 * crawled `AuditReport` so the exposure panel cannot show LLM-invented or
 * leftover mock numbers.
 */
export function resolveExternalReputation(
	report: AuditReport,
	reportData: { externalReputation?: GeoExternalReputationReport } | null | undefined,
	lang: AuditLang = 'ko',
): GeoExternalReputationReport {
	const computed = buildHeuristicExternalReputation(report, lang);
	const raw =
		report.scoreSource === 'projected'
			? computed
			: reportData?.externalReputation ?? computed;
	const defectCount = countAuditDefects(report);
	const score = computed.overview.score;
	return {
		...raw,
		overview: {
			...raw.overview,
			score,
			grade: computed.overview.grade,
			percentile: computed.overview.percentile,
			summary: getReputationInsight(defectCount, score, lang, {
				isHttps: resolveIsHttps({ url: report.url, hasSsl: report.hasSsl }),
			}),
			minExposureThreshold: computed.overview.minExposureThreshold,
			topRecommendationThreshold: computed.overview.topRecommendationThreshold,
			pointsToTop: computed.overview.pointsToTop,
		},
		aiEngines: computed.aiEngines,
		brandTrust: {
			...raw.brandTrust,
			keywords: computed.brandTrust.keywords,
			missingKeyword: computed.brandTrust.missingKeyword,
			personName: computed.brandTrust.personName,
			personJobTitle: computed.brandTrust.personJobTitle,
			napMatchRate: computed.brandTrust.napMatchRate,
			napIssue: computed.brandTrust.napIssue,
			schemaProperties: computed.brandTrust.schemaProperties,
		},
		digitalFootprint: {
			...raw.digitalFootprint,
			googleMentionCount: computed.digitalFootprint.googleMentionCount,
			googleMentionBenchmark: computed.digitalFootprint.googleMentionBenchmark,
			naverMentionCount: computed.digitalFootprint.naverMentionCount,
			naverMentionIssue: computed.digitalFootprint.naverMentionIssue,
			bingPlacesRegistered: computed.digitalFootprint.bingPlacesRegistered,
			bingPlacesNote: computed.digitalFootprint.bingPlacesNote,
			aiBots: computed.digitalFootprint.aiBots,
			howtoGuides: computed.digitalFootprint.howtoGuides,
		},
	};
}
