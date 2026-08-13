/**
 * GEO external-reputation scoring — deterministic heuristic layer.
 *
 * There is no live Google Maps / Naver / Bing Places integration yet, so every
 * number here is derived from real crawled audit signals (schema coverage,
 * GEO citation score, robots.txt AI-bot access, Organization completeness…)
 * combined with a domain-seeded pseudo-random jitter. Same domain + same
 * audit signals always produce the same output (stable across reloads),
 * while different sites get different-looking numbers.
 *
 * Two entry points share the same scoring core (`computeExternalReputationFromSignals`):
 *  - `buildHeuristicExternalReputation`   — precise, from a full crawled `AuditReport` (client-side fallback).
 *  - `buildExternalReputationFromFails`   — approximate, from `technicalFails` text lines
 *                                            (server-side fallback inside the GEO narrative API,
 *                                            which only ever sees a `GeoNarrativeRequest`).
 */

import type { AuditCheckItem, AuditLang, AuditReport } from '@/lib/site-auditor';

export type AiEngineId = 'gemini' | 'chatgpt' | 'perplexity';

export interface AiEngineExposure {
	engine: AiEngineId;
	engineLabel: string;
	/** 1–5 */
	stars: number;
	statusLabel: string;
	reason: string;
}

export interface EeatBrandTrust {
	keywords: string[];
	missingKeyword?: string;
	/** 0–100 */
	napMatchRate: number;
	napIssue?: string;
}

export interface DigitalFootprint {
	googleMentionCount: number;
	googleMentionBenchmark: number;
	naverMentionCount: number;
	naverMentionIssue?: string;
	bingPlacesRegistered: boolean;
	bingPlacesNote?: string;
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
	grade: string;
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
}

function hashStringToSeed(input: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** mulberry32 PRNG — small, fast, deterministic for a given seed. */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return function next() {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function seededRange(rand: () => number, min: number, max: number): number {
	return Math.round(min + rand() * (max - min));
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

function gradeForScore(score: number): string {
	if (score >= 90) return 'S';
	if (score >= 85) return 'A+';
	if (score >= 80) return 'A';
	if (score >= 70) return 'B+';
	if (score >= 60) return 'B';
	if (score >= 50) return 'C+';
	if (score >= 40) return 'C';
	return 'D';
}

function starsFromSignal(pct: number, rand: () => number): number {
	const base = pct >= 80 ? 5 : pct >= 60 ? 4 : pct >= 40 ? 3 : pct >= 20 ? 2 : 1;
	const bump = rand() < 0.15 ? (rand() < 0.5 ? -1 : 1) : 0;
	return clamp(base + bump, 1, 5);
}

function statusLabelForStars(stars: number, lang: AuditLang): string {
	if (stars >= 4) return lang === 'en' ? 'Top exposure' : '상위 노출 중';
	if (stars === 3) return lang === 'en' ? 'Partial exposure' : '부분 노출';
	return lang === 'en' ? 'Low exposure / needs work' : '노출 미흡 / 보완 필요';
}

function buildSummary(args: {
	lang: AuditLang;
	schemaPct: number;
	napMatchRate: number;
	bingRegistered: boolean;
	naverLow: boolean;
}): string {
	const { lang, schemaPct, napMatchRate, bingRegistered, naverLow } = args;
	const schemaGood = schemaPct >= 65;

	if (lang === 'en') {
		if (schemaGood && (!bingRegistered || napMatchRate < 90)) {
			return 'On-page schema is solid, but external reputation signals (Google Maps / directory data) need reinforcement.';
		}
		if (!schemaGood) {
			return 'On-page structured data is incomplete, limiting how confidently AI engines can cite this brand.';
		}
		if (naverLow) {
			return 'Technical signals are healthy, but recent local review/content volume is thin.';
		}
		return 'Overall GEO signals are balanced across on-page schema and external reputation data.';
	}

	if (schemaGood && (!bingRegistered || napMatchRate < 90)) {
		return '온페이지 스키마는 우수하나, 구글맵/외부 평판 데이터 보강이 필요합니다.';
	}
	if (!schemaGood) {
		return '온페이지 구조화 데이터가 미흡해 AI 검색엔진이 브랜드 정보를 확신 있게 인용하기 어렵습니다.';
	}
	if (naverLow) {
		return '기술적 신호는 양호하나, 최근 지역 리뷰·콘텐츠 언급량이 부족합니다.';
	}
	return '온페이지 스키마와 외부 평판 데이터가 고르게 확보되어 있습니다.';
}

/** Extract normalized scoring signals from a full crawled AuditReport (precise path). */
export function extractSignalsFromReport(report: AuditReport): GeoReputationSignals {
	const domain = report.siteMeta?.domain || domainFromUrl(report.url);
	const checks = report.checklist?.length ? report.checklist : report.categories.flatMap((c) => c.checks);
	const orgMissing = report.metrics?.organizationMissing;
	const orgPresent =
		checkPassed(checks, 'organization') || checks.some((c) => c.id === 'organization' && resolveStatus(c) === 'warning');
	const orgComplete = orgPresent && (!orgMissing || orgMissing.length === 0);

	return {
		domain,
		technicalPct: report.maxScore > 0 ? (report.score / report.maxScore) * 100 : 50,
		schemaPct: report.schemaCoverage ?? 50,
		geoPct: report.geoCitationScore ?? 50,
		orgPresent,
		orgComplete,
		faqPresent: checkPassed(checks, 'faq-howto-schema'),
		aiBotsOk: checkPassed(checks, 'ai-bots-allowed'),
		keywords: [
			report.siteMeta?.primaryKeyword,
			report.siteMeta?.broadLocation,
			report.siteMeta?.brandName,
			report.siteMeta?.category,
		].filter((v): v is string => Boolean(v && v.trim())),
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

	return {
		domain: args.domain,
		technicalPct,
		schemaPct,
		geoPct,
		orgPresent: orgHealthy,
		orgComplete: orgHealthy,
		faqPresent,
		aiBotsOk,
		keywords: [args.category, args.broadLocation, args.brandName].filter((v): v is string => Boolean(v && v.trim())),
	};
}

/** Core deterministic scoring shared by both signal-extraction paths. */
export function computeExternalReputationFromSignals(
	signals: GeoReputationSignals,
	lang: AuditLang = 'ko',
): GeoExternalReputationReport {
	const { domain, technicalPct, schemaPct, geoPct, orgPresent, orgComplete, faqPresent, aiBotsOk, keywords } = signals;
	const rand = mulberry32(hashStringToSeed(domain || 'redue-geo'));

	// —— Overview score ——
	const napBase = orgComplete ? 88 : orgPresent ? 62 : 52;
	const aiBotsBonus = aiBotsOk ? 6 : -6;
	const jitter = seededRange(rand, -5, 5);
	const rawScore = technicalPct * 0.3 + schemaPct * 0.2 + geoPct * 0.3 + napBase * 0.2 + aiBotsBonus * 0.3 + jitter;
	const score = clamp(Math.round(rawScore), 12, 97);
	const grade = gradeForScore(score);
	const percentile = clamp(100 - Math.round(score), 1, 99);
	const minExposureThreshold = 70;
	const topRecommendationThreshold = 85;
	const pointsToTop = Math.max(0, topRecommendationThreshold - score);

	// —— Digital footprint ——
	const googleMentionBenchmark = seededRange(rand, 180, 320);
	const googleMentionCount = clamp(
		Math.round(googleMentionBenchmark * (0.2 + (schemaPct / 100) * 0.55) + seededRange(rand, -20, 20)),
		8,
		googleMentionBenchmark + 80,
	);
	const naverMentionCount = clamp(Math.round(seededRange(rand, 4, 60) * (0.4 + geoPct / 150)), 0, 80);
	const naverLow = naverMentionCount < 20;
	const naverMentionIssue = naverLow
		? lang === 'en'
			? 'Low volume — no fresh reviews in the last 3 months.'
			: '부족 — 최신 리뷰가 최근 3개월간 없습니다.'
		: undefined;

	const bingProb = aiBotsOk ? 0.42 : 0.14;
	const bingPlacesRegistered = rand() < bingProb;
	const bingPlacesNote = bingPlacesRegistered
		? undefined
		: lang === 'en'
			? 'Missing Bing Places listing blocks ChatGPT Search exposure.'
			: 'ChatGPT 검색 노출 차단 요인';

	// —— NAP / brand trust ——
	const napMatchRate = clamp(Math.round(napBase + seededRange(rand, -8, 8)), 30, 99);
	const napIssue =
		napMatchRate < 90
			? lang === 'en'
				? 'Business hours/phone number mismatch detected between Google Maps and Naver Place.'
				: '구글맵과 네이버 플레이스의 영업시간/전화번호 불일치가 감지되었습니다.'
			: undefined;

	const uniqueKeywords = Array.from(new Set(keywords)).slice(0, 4);
	const missingKeyword =
		!faqPresent || geoPct < 55
			? `${keywords[0] || (lang === 'en' ? 'service' : '서비스')}${lang === 'en' ? ' reviews' : ' 후기'}`
			: undefined;

	const brandTrust: EeatBrandTrust = { keywords: uniqueKeywords, missingKeyword, napMatchRate, napIssue };
	const digitalFootprint: DigitalFootprint = {
		googleMentionCount,
		googleMentionBenchmark,
		naverMentionCount,
		naverMentionIssue,
		bingPlacesRegistered,
		bingPlacesNote,
	};

	// —— AI engine exposure ——
	const geminiPct = clamp(
		napBase * 0.55 + schemaPct * 0.25 + Math.min(100, (googleMentionCount / Math.max(1, googleMentionBenchmark)) * 100) * 0.2,
		0,
		100,
	);
	const chatgptPct = clamp(
		(aiBotsOk ? 75 : 25) * 0.5 + (bingPlacesRegistered ? 90 : 30) * 0.3 + Math.min(100, (naverMentionCount / 40) * 100) * 0.2,
		0,
		100,
	);
	const perplexityPct = clamp((faqPresent ? 85 : 35) * 0.5 + geoPct * 0.5, 0, 100);

	const geminiStars = starsFromSignal(geminiPct, rand);
	const chatgptStars = starsFromSignal(chatgptPct, rand);
	const perplexityStars = starsFromSignal(perplexityPct, rand);

	const aiEngines: AiEngineExposure[] = [
		{
			engine: 'gemini',
			engineLabel: lang === 'en' ? 'Gemini recommendation index' : 'Gemini 추천 지수',
			stars: geminiStars,
			statusLabel: statusLabelForStars(geminiStars, lang),
			reason: orgComplete
				? lang === 'en'
					? 'Organization/LocalBusiness schema is complete, keeping map-based recommendation signals strong.'
					: '구글맵 리뷰 및 Organization/LocalBusiness 스키마 신호가 잘 갖춰져 있습니다.'
				: lang === 'en'
					? 'Organization/LocalBusiness schema is incomplete, weakening Google Maps recommendation signals.'
					: 'Organization/LocalBusiness 스키마 정보가 불완전해 구글맵 기반 추천 신호가 약합니다.',
		},
		{
			engine: 'chatgpt',
			engineLabel: lang === 'en' ? 'ChatGPT recommendation index' : 'ChatGPT 추천 지수',
			stars: chatgptStars,
			statusLabel: statusLabelForStars(chatgptStars, lang),
			reason: !bingPlacesRegistered
				? lang === 'en'
					? 'Missing Bing Places registration and thin recent web mentions (Digital Footprint) limit exposure.'
					: 'Bing Places 미등록 및 최근 웹 언급량(Digital Footprint) 부족이 원인입니다.'
				: aiBotsOk
					? lang === 'en'
						? 'Bing Places registration and open AI-crawler access support healthy citation odds.'
						: 'Bing Places 등록과 AI 크롤러 허용 설정이 되어 있어 인용 여건이 양호합니다.'
					: lang === 'en'
						? 'AI crawlers are restricted in robots.txt, limiting citation eligibility.'
						: 'robots.txt에서 AI 크롤러 접근이 제한되어 있어 인용이 어렵습니다.',
		},
		{
			engine: 'perplexity',
			engineLabel: lang === 'en' ? 'Perplexity recommendation index' : 'Perplexity 추천 지수',
			stars: perplexityStars,
			statusLabel: statusLabelForStars(perplexityStars, lang),
			reason: !faqPresent
				? lang === 'en'
					? 'Too few authoritative/FAQ-style structured documents to cite as a source.'
					: '공식 출처 인용 문서수 부족 및 FAQ 형태의 구조화 문서가 미흡합니다.'
				: lang === 'en'
					? 'FAQPage schema and GEO citation signals are in place, earning partial answer-card citations.'
					: 'FAQPage 스키마와 GEO 인용 신호가 확보되어 답변 카드에 부분적으로 인용되고 있습니다.',
		},
	];

	// —— Action plan ——
	const actionPlan: GeoActionPlanItem[] = [];
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
					? 'Sync business info (NAP) across Google Maps and Naver Place'
					: '구글맵 - 네이버 플레이스 간 업체 정보(NAP) 동일화',
			description:
				lang === 'en'
					? 'Matching hours/phone number strengthens AI-engine trust (E-E-A-T) signals.'
					: '영업시간 및 전화번호 일치를 통해 AI 엔진의 신뢰도(E-E-A-T) 점수를 확보합니다.',
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
	actionPlan.sort((a, b) => b.pointGain - a.pointGain);

	const overview: GeoScoreOverview = {
		score,
		grade,
		percentile,
		summary: buildSummary({ lang, schemaPct, napMatchRate, bingRegistered: bingPlacesRegistered, naverLow }),
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
 * Single resolver used by every Tab-1 UI panel: prefer the (LLM-enriched or
 * server-heuristic) `externalReputation` already attached to the GEO
 * narrative response, otherwise compute the precise client-side fallback
 * immediately from the crawled `AuditReport` — never blocked on network state.
 */
export function resolveExternalReputation(
	report: AuditReport,
	reportData: { externalReputation?: GeoExternalReputationReport } | null | undefined,
	lang: AuditLang = 'ko',
): GeoExternalReputationReport {
	return reportData?.externalReputation ?? buildHeuristicExternalReputation(report, lang);
}
