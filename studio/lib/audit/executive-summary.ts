import { resolvePatchedTargetScore } from '@/lib/audit/exec-insight';
import { normalizeTo100 } from '@/lib/audit/auditScoreCalculator';

type AuditLang = 'ko' | 'en';

/** Minimal report shape — kept local to avoid a cycle with `site-auditor`. */
interface ExecutiveSummaryReportInput {
	lang?: AuditLang | string;
	score: number;
	maxScore: number;
	categories?: Array<{ id: string; label: string; score: number; maxScore: number }>;
	siteMeta?: {
		location?: string;
		broadLocation?: string;
		category?: string;
		primaryKeyword?: string;
		brandName?: string;
	};
	executiveSummary?: ExecutiveSummary;
}

/** AI recommendation range — A-grade entry on the 0–100 overall scale. */
export const AI_RECOMMEND_THRESHOLD = 85;

/** After a GEO prescription, priority categories are projected to this ratio of max. */
const GEO_PATCH_TARGET_RATIO = 0.9;

export interface ExecutiveSummaryScoreCategory {
	id: string;
	label: string;
	score: number;
	maxScore: number;
}

export interface ExecutiveSummaryScores {
	score: number;
	maxScore: number;
	categories: ExecutiveSummaryScoreCategory[];
}

export interface ExecutiveSummaryKeywords {
	location?: string;
	broadLocation?: string;
	category?: string;
	primaryKeyword?: string;
	brandName?: string;
	industry?: string;
}

export interface ExecutiveSummaryWeaknessPoint {
	categoryId: string;
	categoryLabel: string;
	score: number;
	maxScore: number;
	/** 0–100 share of that category's max. */
	ratioPct: number;
	text: string;
}

export interface ExecutiveSummaryRiskAssessment {
	belowThreshold: boolean;
	threshold: number;
	location: string;
	industry: string;
	text: string;
}

export interface ExecutiveSummaryExpectedResult {
	currentScore: number;
	projectedScore: number;
	gain: number;
	remainingToAGrade: number;
	reachesAGrade: boolean;
	text: string;
}

export interface ExecutiveSummary {
	overallScore: number;
	weaknessPoint: ExecutiveSummaryWeaknessPoint;
	riskAssessment: ExecutiveSummaryRiskAssessment;
	expectedResult: ExecutiveSummaryExpectedResult;
	/** Combined 3-block briefing for PDF print. */
	briefing: string;
}

function clampPct(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(100, Math.max(0, Math.round(n)));
}

function formatPts(n: number): string {
	if (!Number.isFinite(n)) return '0';
	const rounded = Math.round(n * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function overallPct(score: number, maxScore: number): number {
	return normalizeTo100(score, maxScore);
}

function categoryRatio(cat: ExecutiveSummaryScoreCategory): number {
	if (!Number.isFinite(cat.maxScore) || cat.maxScore <= 0) return 1;
	return Math.max(0, cat.score) / cat.maxScore;
}

/**
 * Lowest score/maxScore share. Ties break toward the larger point gap
 * (e.g. schema 17.5/37 beats a tiny category at the same ratio).
 */
export function findWeakestCategory(
	categories: ExecutiveSummaryScoreCategory[],
): ExecutiveSummaryScoreCategory {
	const usable = categories.filter((c) => Number.isFinite(c.maxScore) && c.maxScore > 0);
	if (usable.length === 0) {
		return { id: 'unknown', label: 'N/A', score: 0, maxScore: 1 };
	}
	return usable.reduce((worst, cat) => {
		const worstRatio = categoryRatio(worst);
		const catRatio = categoryRatio(cat);
		if (catRatio < worstRatio - 1e-9) return cat;
		if (Math.abs(catRatio - worstRatio) <= 1e-9) {
			const worstGap = worst.maxScore - worst.score;
			const catGap = cat.maxScore - cat.score;
			if (catGap > worstGap) return cat;
		}
		return worst;
	});
}

function resolveLocation(keywords: ExecutiveSummaryKeywords, lang: AuditLang): string {
	const raw = (keywords.broadLocation || keywords.location || '').trim();
	if (raw) return raw;
	return lang === 'en' ? 'the local area' : '해당 지역';
}

function resolveIndustry(keywords: ExecutiveSummaryKeywords, lang: AuditLang): string {
	const raw = (keywords.category || keywords.primaryKeyword || keywords.industry || '').trim();
	if (raw) return raw;
	return lang === 'en' ? 'the category' : '해당 업종';
}

export function liftCategoryScoresAfterGeoPrescription(
	scores: ExecutiveSummaryScores,
	weakestId: string,
): ExecutiveSummaryScoreCategory[] {
	return scores.categories.map((cat) => {
		const isPriority = cat.id === weakestId || cat.id === 'schema' || cat.id === 'geo';
		if (!isPriority || cat.maxScore <= 0) return cat;
		const target = Math.round(cat.maxScore * GEO_PATCH_TARGET_RATIO * 10) / 10;
		return { ...cat, score: Math.max(cat.score, target) };
	});
}

export function projectAfterGeoPrescription(
	scores: ExecutiveSummaryScores,
	weakestId: string,
): { current: number; projected: number; gain: number; categories: ExecutiveSummaryScoreCategory[] } {
	const current = overallPct(scores.score, scores.maxScore);
	const categories = liftCategoryScoresAfterGeoPrescription(scores, weakestId);
	const patchedRaw = categories.reduce((sum, cat) => sum + (Number.isFinite(cat.score) ? cat.score : 0), 0);
	const projected = overallPct(patchedRaw, scores.maxScore);
	const capped = resolvePatchedTargetScore(current, projected);
	return { current, projected: capped, gain: Math.max(0, capped - current), categories };
}

function weaknessText(
	lang: AuditLang,
	cat: ExecutiveSummaryScoreCategory,
	ratioPct: number,
): string {
	const pts = `${formatPts(cat.score)}/${formatPts(cat.maxScore)}`;
	if (lang === 'en') {
		return `The core weakness is ${cat.label} at ${pts} (${ratioPct}% of max) — the lowest share of any scored item, so AI engines lose structure before they can recommend the site.`;
	}
	return `핵심 취약점은 ${cat.label}입니다. 만점 대비 ${pts}점(${ratioPct}%)으로 세부 항목 중 비중이 가장 낮아, AI가 사이트 구조를 해석하는 첫 관문에서 손해를 보고 있습니다.`;
}

function riskText(
	lang: AuditLang,
	below: boolean,
	overall: number,
	location: string,
	industry: string,
): string {
	const query = location && industry && !industry.includes(location) ? `${location} ${industry}` : industry || location;
	if (below) {
		if (lang === 'en') {
			return `Brand-name search may still surface the business, but official AI citation signals are thin on conversational queries such as “${query}”.`;
		}
		return `상호명 직접 검색은 가능하나, '${query}' 등 잠재 고객 질의에서 AI 공식 인용 신호가 부족한 상태입니다.`;
	}
	if (lang === 'en') {
		return `At ${overall} points the site is inside the AI recommendation range (85, grade A). Brand-name search and “${query}” non-brand queries can both sustain citation competitiveness.`;
	}
	return `종합 ${overall}점으로 AI 추천 사정거리(85점 A등급)에 진입했습니다. 상호명 검색과 '${query}' 비브랜드 질의 모두에서 인용 경쟁력을 유지하고 있습니다.`;
}

function expectedText(
	lang: AuditLang,
	current: number,
	projected: number,
	gain: number,
	reachesAGrade: boolean,
	remaining: number,
	alreadyInRange: boolean,
	weakLabel: string,
): string {
	if (gain === 0) {
		if (lang === 'en') {
			return `At the current baseline a GEO prescription has limited extra upside. Keep managing citation units and external trust signals to hold the grade-A recommendation range (85).`;
		}
		return `현재 측정 기준으로 GEO 처방전의 추가 상승 여지는 제한적입니다. A등급 추천권(85점)을 유지하려면 인용 단위와 외부 신뢰 신호를 지속 관리하세요.`;
	}
	if (alreadyInRange) {
		if (lang === 'en') {
			return `Applying the GEO prescription to the remaining weakness (${weakLabel}) is projected to lift the overall score from ${current} to ${projected} (+${gain}), holding the grade-A recommendation range more securely.`;
		}
		return `GEO 처방전으로 잔여 취약점(${weakLabel})을 보완하면 종합 점수가 ${current}점에서 ${projected}점(+${gain}점)으로 올라가, A등급 추천권을 더 안정적으로 유지할 수 있습니다.`;
	}
	if (reachesAGrade) {
		if (lang === 'en') {
			return `Applying the GEO prescription is projected to lift the overall score from ${current} to ${projected} (+${gain}), entering the AI recommendation range (85, grade A). Patching ${weakLabel} first is the shortest path.`;
		}
		return `GEO 처방전을 적용하면 종합 점수가 ${current}점에서 ${projected}점(+${gain}점)으로 상승하며, AI 추천 사정거리(85점 A등급)에 진입할 수 있습니다. 핵심 취약점(${weakLabel})을 우선 보완하는 것이 가장 빠른 경로입니다.`;
	}
	if (lang === 'en') {
		return `Applying the GEO prescription is projected to lift the overall score from ${current} to ${projected} (+${gain}). ${remaining} more point(s) remain to grade A (85), so patch ${weakLabel} together with leftover defects to enter range.`;
	}
	return `GEO 처방전 적용 시 종합 점수가 ${current}점에서 ${projected}점(+${gain}점)으로 상승합니다. A등급(85점)까지 ${remaining}점이 남으므로, ${weakLabel} 보완과 잔여 결함 패치를 병행해야 사정거리에 진입합니다.`;
}

function briefingBlock(
	lang: AuditLang,
	weakness: string,
	risk: string,
	expected: string,
): string {
	if (lang === 'en') {
		return `Weakness Point\n${weakness}\n\nRisk Assessment\n${risk}\n\nExpected Result\n${expected}`;
	}
	return `취약점 감지\n${weakness}\n\n위험성 진단\n${risk}\n\n처방 기대효과\n${expected}`;
}

/**
 * Compose a personalized executive briefing from live category scores and
 * geo/industry keywords. Used by the diagnosis API and PDF/result UI.
 */
export function generateExecutiveSummary(
	scores: ExecutiveSummaryScores,
	keywords: ExecutiveSummaryKeywords,
	lang: AuditLang = 'ko',
): ExecutiveSummary {
	const overallScore = overallPct(scores.score, scores.maxScore);
	const weakest = findWeakestCategory(scores.categories);
	const ratioPct = clampPct(categoryRatio(weakest) * 100);
	const location = resolveLocation(keywords, lang);
	const industry = resolveIndustry(keywords, lang);
	const belowThreshold = overallScore < AI_RECOMMEND_THRESHOLD;
	const projection = projectAfterGeoPrescription(scores, weakest.id);
	const remainingToAGrade = Math.max(0, AI_RECOMMEND_THRESHOLD - projection.projected);
	const reachesAGrade = projection.projected >= AI_RECOMMEND_THRESHOLD;

	const weaknessPoint: ExecutiveSummaryWeaknessPoint = {
		categoryId: weakest.id,
		categoryLabel: weakest.label,
		score: Math.round(weakest.score * 10) / 10,
		maxScore: weakest.maxScore,
		ratioPct,
		text: weaknessText(lang, weakest, ratioPct),
	};

	const riskAssessment: ExecutiveSummaryRiskAssessment = {
		belowThreshold,
		threshold: AI_RECOMMEND_THRESHOLD,
		location,
		industry,
		text: riskText(lang, belowThreshold, overallScore, location, industry),
	};

	const expectedResult: ExecutiveSummaryExpectedResult = {
		currentScore: projection.current,
		projectedScore: projection.projected,
		gain: projection.gain,
		remainingToAGrade,
		reachesAGrade,
		text: expectedText(
			lang,
			projection.current,
			projection.projected,
			projection.gain,
			reachesAGrade,
			remainingToAGrade,
			!belowThreshold,
			weakest.label,
		),
	};

	return {
		overallScore,
		weaknessPoint,
		riskAssessment,
		expectedResult,
		briefing: briefingBlock(lang, weaknessPoint.text, riskAssessment.text, expectedResult.text),
	};
}

export function executiveSummaryFromReport(report: ExecutiveSummaryReportInput): ExecutiveSummary {
	const lang: AuditLang = report.lang === 'en' ? 'en' : 'ko';
	return generateExecutiveSummary(
		{
			score: report.score,
			maxScore: report.maxScore,
			categories: (report.categories ?? []).map((c) => ({
				id: c.id,
				label: c.label,
				score: c.score,
				maxScore: c.maxScore,
			})),
		},
		{
			location: report.siteMeta?.location,
			broadLocation: report.siteMeta?.broadLocation,
			category: report.siteMeta?.category,
			primaryKeyword: report.siteMeta?.primaryKeyword,
			brandName: report.siteMeta?.brandName,
		},
		lang,
	);
}

/** Attach a briefing when a stored/legacy report was saved without one. */
export function ensureExecutiveSummary<T extends ExecutiveSummaryReportInput>(report: T): T {
	if (report.executiveSummary?.weaknessPoint?.text && report.executiveSummary.briefing) {
		return report;
	}
	return { ...report, executiveSummary: executiveSummaryFromReport(report) };
}
