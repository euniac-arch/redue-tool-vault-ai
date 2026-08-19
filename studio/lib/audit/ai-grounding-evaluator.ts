/**
 * Shared 4-tier Context & Sentiment Analysis for live AI engine answers.
 *
 * Every grounded engine (ChatGPT, Perplexity, Claude, Gemini, Naver Cue)
 * must pass its raw answer through `evaluateAiGroundingResponse` so a mere
 * domain/brand mention never inflates the live score to 98.
 */
import { mentionsBrandOrSite, urlMatchesSite } from '@/lib/audit/live-check-mentions';
import type { GroundingStatusColor, GroundingTier, MentionType } from '@/types/live-engine-check';

export type { GroundingStatusColor, GroundingTier };

export type SupportedAiEngine = 'chatgpt' | 'perplexity' | 'claude' | 'gemini' | 'naver_cue' | 'general_ai';

export interface AiEvaluationDetail {
	engine: SupportedAiEngine;
	engineName: string;
	technicalScore: number;
	liveScore: number;
	tier: GroundingTier;
	statusLabel: string;
	statusColor: GroundingStatusColor;
	citationExcerpt: string;
	citedUrl: string;
	weaknessReasons?: string[];
}

export interface GroundingEvalOptions {
	rank?: 1 | 2 | 3 | null;
	citationUrl?: string;
	mentionType?: MentionType;
	citationCandidates?: readonly string[];
}

export const ENGINE_DISPLAY_NAME: Record<SupportedAiEngine, string> = {
	chatgpt: 'ChatGPT',
	perplexity: 'Perplexity',
	claude: 'Claude',
	gemini: 'Gemini',
	naver_cue: 'Naver Cue',
	general_ai: 'General AI',
};

export const GROUNDING_STATUS_LABEL: Record<GroundingTier, string> = {
	STRONG: '✓ 실시간 최우선 추천/인용',
	NEUTRAL: '✓ 공식 엔티티 정보 인용 확인',
	WEAK: '△ 단순 언급 확인 (추천 신호 약함 - GEO 보강 필요)',
	NOT_FOUND: '✕ 실시간 AI 답변 미노출',
};

export const GROUNDING_STATUS_COLOR: Record<GroundingTier, GroundingStatusColor> = {
	STRONG: 'green',
	NEUTRAL: 'blue',
	WEAK: 'yellow',
	NOT_FOUND: 'red',
};

/** Weak / caveat / competitor-dominant cues. Domain mention never overrides these. */
export const WEAK_GROUNDING_PATTERNS: readonly { re: RegExp; reason: string }[] = [
	{ re: /정황은\s*약/, reason: '직접 추천된 정황이 약함' },
	{ re: /추천된\s*정황은/, reason: '직접 추천된 정황이 약함' },
	{ re: /노출이\s*적/, reason: '타 센터 대비 노출 부족' },
	{ re: /다른.{0,24}주로\s*노출/, reason: '타 센터 대비 노출 부족' },
	{ re: /다른\s*곳이\s*주로/, reason: '타 센터 대비 노출 부족' },
	{ re: /확인이\s*어렵/, reason: '신뢰도 검증이 어려움' },
	{ re: /신뢰도\s*검증\s*필요/, reason: '신뢰도 검증 필요' },
	{ re: /정보가\s*부족/, reason: '정보가 부족함' },
	{ re: /우선순위가\s*낮/, reason: '우선순위가 낮음' },
	{ re: /직접\s*추천은\s*어려/, reason: '직접 추천 유보' },
	{ re: /비교적\s*적/, reason: '노출·인용 신호가 비교적 약함' },
	{ re: /신호가\s*약/, reason: '추천 신호가 약함' },
	{ re: /단순\s*언급/, reason: '단순 언급 수준에 그침' },
	{ re: /보조적인/, reason: '보조 언급 수준에 그침' },
	{ re: /weak\s+(?:signal|evidence|context)/i, reason: '추천 신호가 약함' },
	{ re: /hard to recommend/i, reason: '직접 추천 유보' },
	{ re: /limited (?:information|evidence|visibility)/i, reason: '정보가 부족함' },
	{ re: /not enough information/i, reason: '정보가 부족함' },
	{ re: /insufficient information/i, reason: '정보가 부족함' },
	{ re: /rarely (?:appears|mentioned|cited|exposed)/i, reason: '타 센터 대비 노출 부족' },
	{ re: /others? (?:are|is) (?:more|mainly|primarily)/i, reason: '타 센터 대비 노출 부족' },
];

/** Strong recommendation / first-party endorsement cues. */
export const STRONG_GROUNDING_PATTERNS: readonly { re: RegExp; veryStrong: boolean }[] = [
	{ re: /전문\s*기관/, veryStrong: true },
	{ re: /공식\s*파트너/, veryStrong: true },
	{ re: /대표적인/, veryStrong: true },
	{ re: /대표\s*기관/, veryStrong: true },
	{ re: /가장\s*적합한/, veryStrong: true },
	{ re: /적극\s*추천/, veryStrong: true },
	{ re: /신뢰할\s*수\s*있는/, veryStrong: true },
	{ re: /최우선/, veryStrong: true },
	{ re: /선도적인/, veryStrong: true },
	{ re: /추천되며/, veryStrong: false },
	{ re: /추천합니다/, veryStrong: false },
	{ re: /추천해\s*드립니다/, veryStrong: false },
	{ re: /highly recommended/i, veryStrong: true },
	{ re: /official partner/i, veryStrong: true },
	{ re: /leading (?:institution|clinic|provider|center)/i, veryStrong: true },
	{ re: /most suitable/i, veryStrong: true },
	{ re: /trusted (?:specialist|institution|provider|center)/i, veryStrong: true },
	{ re: /we recommend/i, veryStrong: false },
	{ re: /specialist (?:institution|clinic|center)/i, veryStrong: true },
];

const URL_IN_TEXT = /https?:\/\/[^\s"'<>)]+/gi;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : 0)));
}

function collectPatternHits<T extends { re: RegExp }>(text: string, patterns: readonly T[]): T[] {
	return patterns.filter((pattern) => {
		pattern.re.lastIndex = 0;
		return pattern.re.test(text);
	});
}

function detectOrdinalRank(text: string, targetBrand: string, targetDomain: string): 1 | 2 | 3 | null {
	if (!mentionsBrandOrSite(text, targetBrand, targetDomain)) return null;
	const escapedBrand = targetBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const host = targetDomain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || '';
	const escapedHost = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const alias = [escapedBrand, escapedHost].filter((part) => part.length >= 2).join('|');
	if (!alias) return null;
	const window = `[^\\n]{0,48}(?:${alias})|(?:${alias})[^\\n]{0,24}`;
	const patterns: Array<{ rank: 1 | 2 | 3; re: RegExp }> = [
		{ rank: 1, re: new RegExp(`(?:1\\s*[위등]|1st|#\\s*1\\b|first|첫\\s*번째)(?:${window})|(?:${window})(?:1\\s*[위등]|1st|#\\s*1\\b)`, 'i') },
		{ rank: 2, re: new RegExp(`(?:2\\s*[위등]|2nd|#\\s*2\\b|second)(?:${window})|(?:${window})(?:2\\s*[위등]|2nd|#\\s*2\\b)`, 'i') },
		{ rank: 3, re: new RegExp(`(?:3\\s*[위등]|3rd|#\\s*3\\b|third)(?:${window})|(?:${window})(?:3\\s*[위등]|3rd|#\\s*3\\b)`, 'i') },
	];
	for (const pattern of patterns) {
		if (pattern.re.test(text)) return pattern.rank;
	}
	return null;
}

function extractCitedUrl(text: string, targetDomain: string, explicit?: string, candidates: readonly string[] = []): string {
	if (explicit && urlMatchesSite(explicit, targetDomain)) return explicit.trim();
	const fromCandidates = candidates.find((url) => urlMatchesSite(url, targetDomain));
	if (fromCandidates) return fromCandidates;
	const found = text.match(URL_IN_TEXT) ?? [];
	const matched = found.find((url) => urlMatchesSite(url, targetDomain));
	if (matched) return matched.replace(/[.,;]+$/, '');
	if (explicit?.trim()) return explicit.trim();
	return '';
}

function extractExcerpt(text: string, targetBrand: string, targetDomain: string, fallback: string): string {
	const cleaned = text.replace(/\s+/g, ' ').trim();
	if (!cleaned) return fallback;
	const hay = cleaned.toLowerCase();
	const needles = [targetBrand, targetDomain.replace(/^https?:\/\//i, '').replace(/^www\./i, '')]
		.map((item) => item.trim())
		.filter((item) => item.length >= 2);
	const sentences = cleaned
		.split(/(?<=다\.|요\.|니다\.|[.!?]|[\n\r])\s+/)
		.map((part) => part.trim())
		.filter((part) => part.length >= 8 && !/"?\s*(isCited|mentionType|evidenceSnippet)\s*"?\s*:/i.test(part));
	for (const needle of needles) {
		const hit = sentences.find((sentence) => sentence.toLowerCase().includes(needle.toLowerCase()));
		if (hit) return hit.slice(0, 220);
	}
	const weakHit = sentences.find((sentence) => collectPatternHits(sentence, WEAK_GROUNDING_PATTERNS).length > 0);
	if (weakHit) return weakHit.slice(0, 220);
	const strongHit = sentences.find((sentence) => collectPatternHits(sentence, STRONG_GROUNDING_PATTERNS).length > 0);
	if (strongHit) return strongHit.slice(0, 220);
	const idx = needles.map((needle) => hay.indexOf(needle.toLowerCase())).find((value) => value >= 0) ?? -1;
	if (idx >= 0) {
		const start = Math.max(0, idx - 40);
		return cleaned.slice(start, start + 180).trim();
	}
	return fallback.slice(0, 220);
}

function scoreStrong(input: { rank: 1 | 2 | 3 | null; veryStrong: boolean; hasUrl: boolean }): number {
	let score = 92;
	if (input.veryStrong) score = 98;
	if (input.rank === 1) score = 98;
	else if (input.rank === 2) score = Math.max(score, 95);
	else if (input.rank === 3) score = Math.max(score, 91);
	if (input.hasUrl && score < 98) score = Math.min(98, score + 2);
	return clamp(score, 90, 98);
}

function scoreNeutral(hasUrl: boolean): number {
	return hasUrl ? 80 : 75;
}

function scoreWeak(technicalScore: number): number {
	const base = clamp(technicalScore, 0, 100);
	return clamp(base + 1, base - 5, base + 5);
}

export function hasWeakGroundingSignal(text: string): boolean {
	return collectPatternHits(text || '', WEAK_GROUNDING_PATTERNS).length > 0;
}

export function toSupportedAiEngine(engine: string): SupportedAiEngine {
	if (engine === 'clova' || engine === 'naver_cue') return 'naver_cue';
	if (engine === 'copilot' || engine === 'general_ai') return 'general_ai';
	if (engine === 'chatgpt' || engine === 'perplexity' || engine === 'claude' || engine === 'gemini') return engine;
	return 'general_ai';
}

export function mentionTypeForTier(tier: GroundingTier): MentionType {
	if (tier === 'STRONG') return 'recommended';
	if (tier === 'NOT_FOUND') return 'none';
	return 'simple_mention';
}

/**
 * Common 4-tier evaluator. Weak/caveat keywords always demote to TIER 3 even
 * when the brand name or official URL is present.
 */
export function evaluateAiGroundingResponse(
	engine: SupportedAiEngine,
	technicalScore: number,
	aiResponseText: string,
	targetBrand: string,
	targetDomain: string,
	options: GroundingEvalOptions = {},
): AiEvaluationDetail {
	const engineName = ENGINE_DISPLAY_NAME[engine];
	const safeTechnical = clamp(technicalScore, 0, 100);
	const text = (aiResponseText || '').trim();
	const mentioned = mentionsBrandOrSite(text, targetBrand, targetDomain);
	const ordinalRank = detectOrdinalRank(text, targetBrand, targetDomain);
	const rank = ordinalRank ?? options.rank ?? null;
	const citedUrl = extractCitedUrl(text, targetDomain, options.citationUrl, options.citationCandidates);
	const hasUrl = Boolean(citedUrl);
	const weakHits = collectPatternHits(text, WEAK_GROUNDING_PATTERNS);
	const strongHits = collectPatternHits(text, STRONG_GROUNDING_PATTERNS);
	const judgeSaidNone = options.mentionType === 'none';

	let tier: GroundingTier;
	if ((!mentioned && !hasUrl) || judgeSaidNone) {
		tier = 'NOT_FOUND';
	} else if (weakHits.length > 0) {
		tier = 'WEAK';
	} else if (strongHits.length > 0 || ordinalRank === 1 || ordinalRank === 2) {
		tier = 'STRONG';
	} else {
		tier = 'NEUTRAL';
	}

	const liveScore =
		tier === 'STRONG'
			? scoreStrong({ rank, veryStrong: strongHits.some((hit) => hit.veryStrong), hasUrl })
			: tier === 'NEUTRAL'
				? scoreNeutral(hasUrl)
				: tier === 'WEAK'
					? scoreWeak(safeTechnical)
					: safeTechnical;

	const fallbackExcerpt =
		tier === 'NOT_FOUND'
			? '해당 지역/업종 추천 검색 결과에서 공식 웹사이트 인용 링크가 확인되지 않았습니다.'
			: tier === 'WEAK'
				? '대상 상호는 언급되었으나 추천 정황이 약합니다.'
				: '실시간 추천 답변에서 해당 브랜드/공식 웹사이트 인용이 확인되었습니다.';

	const detail: AiEvaluationDetail = {
		engine,
		engineName,
		technicalScore: safeTechnical,
		liveScore,
		tier,
		statusLabel: GROUNDING_STATUS_LABEL[tier],
		statusColor: GROUNDING_STATUS_COLOR[tier],
		citationExcerpt: extractExcerpt(text, targetBrand, targetDomain, fallbackExcerpt),
		citedUrl,
	};
	if (tier === 'WEAK') {
		const reasons = [...new Set(weakHits.map((hit) => hit.reason))];
		detail.weaknessReasons = reasons.length > 0 ? reasons : ['추천 신호가 약함 — GEO 보강 필요'];
	}
	return detail;
}
