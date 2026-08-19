/**
 * HTTPS security gate + comprehensive score engine (single source of truth).
 *
 * HTTP / no-SSL sites must not land in S/A. The on-page table treats HTTPS
 * as a regular security slot (0 when missing). The 100-point technical
 * headline is a pure proportion — `round(raw / max * 100)` — with no extra
 * −15 after that slot. Security risk is a composite hard cap at 78 (B) plus
 * a UI warning badge. Per-engine AI Readiness Scores still take −18 and
 * cap at 64 (준비도 양호 이하).
 *
 * Every dashboard surface (hero, dual cards, radar, checklist table) must
 * read `DetailedAuditScore` — never recompute penalties or percentiles.
 */

import {
	CHECKLIST_TOTAL_MAX,
	checklistWeightForEngineId,
	resolveMaxRawScore,
} from '@/lib/audit/checklistDefinitions';
import { clampEarned } from '@/lib/audit/scorePipeline';
import { isHttpsUrl } from '@/lib/audit/target-entity';
import { gradeForHttps, topPercentileFromScore, type ScoreGrade } from '@/lib/audit/score-grade';
import type { AuditCheckItem, AuditCheckStatus, AuditLang, AuditReport } from '@/lib/site-auditor';
import { AI_ENGINE_IDS, type AIEngineId } from '@/types/geo-diagnostic';

export { topPercentileFromScore };

export const HTTPS_CHECK_ID = 'https' as const;

/** Precision table — HTTPS security slot (pass = full weight, fail = 0). */
export const HTTPS_RAW_POINTS = checklistWeightForEngineId('https') ?? 10;

/**
 * @deprecated No longer applied to the 100-point technical headline.
 * HTTPS fail is already 0 / 10 in the raw checklist; a second −15 caused
 * 100/122 (82) to display as 67. Security is now a 78-point / B-grade cap.
 */
export const HTTPS_TECHNICAL_PENALTY = 15 as const;

/**
 * @deprecated No longer applied as an extra GEO deduction.
 * HTTP origins are limited by `HTTPS_GRADE_HARD_CAP` on the composite.
 */
export const HTTPS_GEO_PENALTY = 10 as const;

/** Composite hard cap — B grade ceiling (S/A and “상위 6%” blocked). */
export const HTTPS_GRADE_HARD_CAP = 78 as const;

/** HTTP origins cannot claim a tighter top-percentile than this. */
export const HTTPS_PERCENTILE_FLOOR = 25 as const;

/** Per-engine recommendation-index deduction when HTTPS is missing (15–20 band). */
export const HTTPS_ENGINE_PENALTY = 18 as const;

/** Per-engine hard cap — blocks readiness “매우 양호” (80+) / Level 3. */
export const HTTPS_ENGINE_SCORE_CAP = 64 as const;

export const HTTPS_ENGINE_SCORE_FLOOR = 30 as const;

export const HTTPS_P0_LABEL = {
	ko: '[P0: 긴급] HTTPS 보안 프로토콜 (SSL 인증서) 즉시 적용',
	en: '[P0: Urgent] Apply HTTPS security protocol (SSL certificate) immediately',
} as const;

export const HTTPS_SECURITY_ALERT = {
	ko: 'HTTPS 미적용 사이트는 보안 위험으로 인해 종합 등급이 B등급으로 제한됩니다.',
	en: 'HTTPS is not enabled, so the composite grade is capped at B because of the security risk.',
} as const;

export const HTTPS_GRADE_CAP_BADGE = {
	ko: '⚠️ HTTPS 미적용으로 등급 상한 B등급 제한',
	en: '⚠️ Grade capped at B — HTTPS is not enabled',
} as const;

export interface AuditScoreInput {
	url?: string | null;
	hasSsl?: boolean | null;
	technicalScore: number;
	geoScore: number;
	lang?: AuditLang | string | null;
}

export interface AuditScoreResult {
	technicalScore: number;
	geoScore: number;
	totalScore: number;
	grade: ScoreGrade;
	gradeLabel: string;
	percentile: number;
	isHttps: boolean;
	securityPenaltyApplied: boolean;
	/** True when the composite was lowered to the B-grade hard cap. */
	securityCapped: boolean;
	securityCriticalAlert: string | null;
	securityAlertMessage?: string;
}

/** 0–100 radar axes — 1:1 with the five standard categories. */
export interface RadarScores {
	security: number;
	performance: number;
	seo: number;
	schema: number;
	geoSignal: number;
}

/**
 * Full diagnosis packet. UI must render these fields as-is.
 * `technicalScore` is the pure 100-point proportion `round(raw / max * 100)`.
 * `rawTechnicalScore` / `rawScore122` is the checklist sum (HTTPS slot full weight or 0).
 */
export interface DetailedAuditScore extends AuditScoreResult {
	rawTechnicalScore: number;
	maxRawScore: number;
	radarScores: RadarScores;
}

/** 6 AI-engine readiness scores after the HTTPS −18 / 64-cap. */
export type EngineScores = Record<AIEngineId, number>;

export const EMPTY_ENGINE_SCORES: EngineScores = {
	chatgpt: 0,
	gemini: 0,
	claude: 0,
	perplexity: 0,
	copilot: 0,
	clova: 0,
};

/**
 * Single pipeline packet — every dashboard surface binds `auditData.scores`.
 * Technical is a raw/max proportion; composite / B-grade hard cap / engine −18
 * are already applied. HTTP never receives a second −15 on the headline.
 */
export interface AuditScores extends DetailedAuditScore {
	/** Alias of `rawTechnicalScore` — Tab 2 checklist numerator. */
	rawScore122: number;
	engineScores: EngineScores;
	technicalPercentile: number;
	geoPercentile: number;
}

export interface ComprehensiveScoreInput {
	rawTechnicalScore: number;
	maxRawScore?: number;
	/** 100-point on-page reading (pure raw/max proportion; no extra HTTPS hit). */
	technicalScore: number;
	/** 100-point GEO / external-trust reading (composite hard-cap is applied later). */
	geoScore: number;
	url?: string | null;
	hasSsl?: boolean | null;
	lang?: AuditLang | string | null;
	schemaScore100?: number;
	ragScore?: number;
	/** Category 3 (SEO 기술 기본기) 100-point — radar 검색 기초. */
	searchBasics?: number;
	/** Category 1 (보안 & 인프라) 100-point — radar 보안/인프라. */
	securityInfra?: number;
	/** Category 2 (웹 성능 & 접근성) 100-point — radar 성능/접근성. */
	webPerf?: number;
	/** @deprecated Use `webPerf` — kept so older callers still bind. */
	ragFact?: number;
	/** Category 5 (GEO & AI 인용 신호) 100-point — radar AI 인용 신호. */
	aiCitation?: number;
	/** Fully resolved radar packet — preferred over the individual axis fields. */
	radarScores?: RadarScores;
	/** Raw 0–100 engine indexes BEFORE the HTTPS −18 / 64-cap. */
	engineScores?: Partial<EngineScores>;
	/**
	 * When true, `engineScores` are already finalized (do not cap again).
	 * Default false — calculator applies the HTTPS engine gate once.
	 */
	engineScoresCapped?: boolean;
}

function clamp100(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

/** True when the audited origin is HTTPS or an explicit SSL flag is set. */
export function resolveIsHttps(input: { url?: string | null; hasSsl?: boolean | null }): boolean {
	if (input.hasSsl === true) return true;
	if (input.hasSsl === false) return false;
	const url = (input.url || '').trim();
	if (!url) return true;
	return isHttpsUrl(url);
}

export function applyHttpsRawPenalty(rawScore: number, isHttps: boolean): number {
	if (isHttps || !Number.isFinite(rawScore)) return Math.max(0, rawScore || 0);
	return Math.max(0, rawScore - HTTPS_RAW_POINTS);
}

export function applySecurityGradeCap(totalScore: number, isHttps: boolean): number {
	const n = clamp100(totalScore);
	if (!isHttps && n > HTTPS_GRADE_HARD_CAP) return HTTPS_GRADE_HARD_CAP;
	return n;
}

/** −18 then clamp to 30–64 so HTTP origins cannot show readiness “매우 양호”. */
export function applyHttpsEngineScoreCap(score: number, isHttps: boolean): number {
	const n = clamp100(score);
	if (isHttps) return n;
	return Math.min(HTTPS_ENGINE_SCORE_CAP, Math.max(HTTPS_ENGINE_SCORE_FLOOR, n - HTTPS_ENGINE_PENALTY));
}

export function fillEngineScores(raw?: Partial<EngineScores> | null): EngineScores {
	const next: EngineScores = { ...EMPTY_ENGINE_SCORES };
	for (const id of AI_ENGINE_IDS) {
		const value = raw?.[id];
		next[id] = Number.isFinite(value) ? clamp100(Number(value)) : 0;
	}
	return next;
}

/** Apply the HTTPS engine gate to every engine in one pass. */
export function applyHttpsEngineScoreMap(
	raw: Partial<EngineScores> | undefined,
	isHttps: boolean,
): EngineScores {
	const filled = fillEngineScores(raw);
	if (isHttps) return filled;
	const next: EngineScores = { ...EMPTY_ENGINE_SCORES };
	for (const id of AI_ENGINE_IDS) {
		next[id] = applyHttpsEngineScoreCap(filled[id], false);
	}
	return next;
}

export function toAuditScores(
	detailed: DetailedAuditScore,
	engineScores?: Partial<EngineScores> | null,
	engineScoresCapped = true,
): AuditScores {
	return {
		...detailed,
		rawScore122: detailed.rawTechnicalScore,
		engineScores: engineScoresCapped
			? fillEngineScores(engineScores)
			: applyHttpsEngineScoreMap(engineScores ?? undefined, detailed.isHttps),
		technicalPercentile: percentileForHttps(detailed.technicalScore, detailed.isHttps),
		geoPercentile: percentileForHttps(detailed.geoScore, detailed.isHttps),
	};
}

export function buildRadarScores(input: {
	isHttps: boolean;
	technicalScore: number;
	geoScore: number;
	schemaScore100?: number;
	ragScore?: number;
	searchBasics?: number;
	securityInfra?: number;
	webPerf?: number;
	ragFact?: number;
	aiCitation?: number;
}): RadarScores {
	const seo = clamp100(input.searchBasics ?? input.technicalScore);
	const schema = clamp100(input.schemaScore100 ?? seo);
	const performance = clamp100(input.webPerf ?? input.ragFact ?? input.ragScore ?? input.technicalScore);
	const geoSignal = clamp100(input.aiCitation ?? input.geoScore);
	const security = clamp100(input.securityInfra ?? (input.isHttps ? 95 : 20));
	return {
		security,
		performance,
		seo,
		schema,
		geoSignal,
	};
}

export function gradeLabelFor(grade: ScoreGrade, isHttps: boolean, lang: AuditLang = 'ko'): string {
	if (lang === 'en') {
		if (!isHttps && grade === 'B') return 'B grade · Fair (security cap)';
		if (!isHttps && grade === 'C/D') return 'C/D grade · Poor (security risk)';
		if (grade === 'S') return 'S grade · Outstanding';
		if (grade === 'A') return 'A grade · Excellent';
		if (grade === 'B') return 'B grade · Fair';
		return 'C/D grade · Poor';
	}
	if (!isHttps && grade === 'B') return 'B 등급 · 보통 (보안 제한)';
	if (!isHttps && grade === 'C/D') return 'C/D 등급 · 미흡 (보안 취약)';
	if (grade === 'S') return 'S 등급 · 최우수';
	if (grade === 'A') return 'A 등급 · 우수';
	if (grade === 'B') return 'B 등급 · 보통';
	return 'C/D 등급 · 미흡';
}

export function percentileForHttps(totalScore: number, isHttps: boolean): number {
	const percentile = topPercentileFromScore(totalScore);
	if (!isHttps && percentile < HTTPS_PERCENTILE_FLOOR) return HTTPS_PERCENTILE_FLOOR;
	return percentile;
}

export function calculateAuditScores(rawData: AuditScoreInput): AuditScoreResult {
	const isHttps = resolveIsHttps(rawData);
	const lang: AuditLang = rawData.lang === 'en' ? 'en' : 'ko';

	const technicalScore = clamp100(rawData.technicalScore);
	const geoScore = clamp100(rawData.geoScore);

	const baseTotal = clamp100(technicalScore * 0.5 + geoScore * 0.5);
	const totalScore = applySecurityGradeCap(baseTotal, isHttps);
	const securityCapped = !isHttps && baseTotal > HTTPS_GRADE_HARD_CAP;
	const grade = gradeForHttps(totalScore, isHttps);
	const securityPenaltyApplied = !isHttps;
	const securityAlertMessage = securityPenaltyApplied ? HTTPS_SECURITY_ALERT[lang] : undefined;

	return {
		technicalScore,
		geoScore,
		totalScore,
		grade,
		gradeLabel: gradeLabelFor(grade, isHttps, lang),
		percentile: percentileForHttps(totalScore, isHttps),
		isHttps,
		securityPenaltyApplied,
		securityCapped,
		securityCriticalAlert: securityAlertMessage ?? null,
		securityAlertMessage,
	};
}

/**
 * Dynamic raw max → 100-point technical → GEO blend → hard cap.
 * `technicalScore` is `round(earnedRaw / maxRaw * 100)` with no extra HTTPS hit.
 */
export function calculateMaxRawScore(
	checklist?: ReadonlyArray<{ maxScore?: number; weight?: number }> | null,
): number {
	return resolveMaxRawScore(checklist);
}

/** Alias matching the 100/122 proportion + B-grade security-cap packet. */
export type ComprehensiveScoreResult = AuditScores;

export function calculateComprehensiveScores(input: ComprehensiveScoreInput): AuditScores {
	const maxRawScore = Number.isFinite(input.maxRawScore) && (input.maxRawScore ?? 0) > 0
		? Number(input.maxRawScore)
		: CHECKLIST_TOTAL_MAX;
	const hasRaw = Number.isFinite(input.rawTechnicalScore);
	const rawTechnicalScore = clampEarned(hasRaw ? Number(input.rawTechnicalScore) : 0, maxRawScore);
	const fromRaw = clamp100((rawTechnicalScore / maxRawScore) * 100);
	const scored = calculateAuditScores({
		url: input.url,
		hasSsl: input.hasSsl,
		technicalScore: hasRaw ? fromRaw : Number.isFinite(input.technicalScore) ? input.technicalScore : fromRaw,
		geoScore: input.geoScore,
		lang: input.lang,
	});
	const detailed: DetailedAuditScore = {
		...scored,
		rawTechnicalScore,
		maxRawScore,
		radarScores: input.radarScores ?? buildRadarScores({
			isHttps: scored.isHttps,
			technicalScore: scored.technicalScore,
			geoScore: scored.geoScore,
			schemaScore100: input.schemaScore100,
			ragScore: input.ragScore,
			searchBasics: input.searchBasics,
			securityInfra: input.securityInfra,
			webPerf: input.webPerf,
			ragFact: input.ragFact,
			aiCitation: input.aiCitation,
		}),
	};
	return toAuditScores(detailed, input.engineScores, input.engineScoresCapped === true);
}

const HTTPS_COPY: Record<
	AuditLang,
	{ label: string; why: string; passWhy: string; impact: string; passEvidence: string; failEvidence: string }
> = {
	ko: {
		label: HTTPS_P0_LABEL.ko,
		why: 'http:// 비보안 프로토콜은 브라우저 경고를 유발하고 AI 엔진의 인용 신뢰도를 차단합니다. 카페24/가비아 등 호스팅사 콘솔 또는 Let\'s Encrypt를 통해 SSL 보안 인증서를 즉시 설치하세요.',
		passWhy: 'HTTPS 보안 프로토콜이 적용되어 브라우저·AI 검색 신뢰 기준을 충족, 정상 통과되었습니다.',
		impact: 'HTTPS 적용 시 보안 감점 및 등급 상한이 해제되며, 주요 AI 검색엔진의 공식 출처 인용 신뢰도가 정상화됩니다.',
		passEvidence: 'protocol=https · SSL 적용',
		failEvidence: 'protocol=http · SSL 미적용',
	},
	en: {
		label: HTTPS_P0_LABEL.en,
		why: 'Plain HTTP triggers browser warnings and blocks AI-engine citation trust. Install an SSL certificate immediately via your host console (Cafe24, Gabia, etc.) or Let\'s Encrypt.',
		passWhy: 'HTTPS is enabled, so the browser and AI-search trust bar is met and passed.',
		impact: 'Enabling HTTPS lifts the security penalty and grade cap, and restores official-source citation trust in major AI search engines.',
		passEvidence: 'protocol=https · SSL enabled',
		failEvidence: 'protocol=http · SSL not applied',
	},
};

export function buildHttpsCheckItem(args: {
	lang?: AuditLang | string | null;
	isHttps: boolean;
	url?: string | null;
}): AuditCheckItem {
	const lang: AuditLang = args.lang === 'en' ? 'en' : 'ko';
	const copy = HTTPS_COPY[lang];
	const status: AuditCheckStatus = args.isHttps ? 'pass' : 'fail';
	let evidence = args.isHttps ? copy.passEvidence : copy.failEvidence;
	if (args.url) {
		try {
			evidence = `protocol=${new URL(args.url).protocol.replace(':', '')} · ${args.isHttps ? 'SSL on' : 'SSL off'}`;
		} catch {
			evidence = args.isHttps ? copy.passEvidence : copy.failEvidence;
		}
	}
	return {
		id: HTTPS_CHECK_ID,
		label: copy.label,
		status,
		passed: status === 'pass',
		weight: HTTPS_RAW_POINTS,
		evidence,
		why: args.isHttps ? copy.passWhy : copy.why,
		impact: copy.impact,
	};
}

/** Inject the HTTPS security row for stored reports that predate this check. */
export function ensureHttpsChecklistItem(
	checks: AuditCheckItem[],
	report?: Pick<AuditReport, 'url' | 'lang' | 'hasSsl'> | null,
): AuditCheckItem[] {
	if (!checks.length && !report?.url) return checks;
	const isHttps = resolveIsHttps({ url: report?.url, hasSsl: report?.hasSsl });
	const next = buildHttpsCheckItem({ lang: report?.lang, isHttps, url: report?.url });
	const existing = checks.find((item) => item.id === HTTPS_CHECK_ID);
	if (existing) {
		return checks.map((item) =>
			item.id === HTTPS_CHECK_ID
				? {
						...next,
						...item,
						label: item.label || next.label,
						weight: HTTPS_RAW_POINTS,
						status: item.status ?? (item.passed ? 'pass' : 'fail'),
						passed: (item.status ?? (item.passed ? 'pass' : 'fail')) === 'pass',
					}
				: item,
		);
	}
	return [next, ...checks];
}
