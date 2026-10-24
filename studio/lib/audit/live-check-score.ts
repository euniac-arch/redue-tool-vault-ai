import {
	evaluateAiGroundingResponse,
	GROUNDING_STATUS_COLOR,
	GROUNDING_STATUS_LABEL,
	hasWeakGroundingSignal,
	mentionTypeForTier,
	toSupportedAiEngine,
	type AiEvaluationDetail,
} from '@/lib/audit/ai-grounding-evaluator';
import { uniqueHttpUrls } from '@/lib/audit/engine-insight';
import {
	brandAliases,
	detectCitedRank,
	mentionsBrandName,
	mentionsBrandOrSite,
	textContainsOfficialDomain,
	urlMatchesSite,
} from '@/lib/audit/live-check-mentions';
import { classifyCitations } from '@/lib/audit/universal-sov-engine';
import type { LiveFailureDetail } from '@/lib/audit/live-check-errors';
import type {
	GroundingTier,
	LiveCheckEngineId,
	LiveCitationMention,
	LiveEngineCheckResult,
	LiveGroundedEngineId,
	LiveFailureKind,
	LiveObservationStatus,
	LiveReachLevel,
	LiveStatusDetail,
	MentionType,
} from '@/types/live-engine-check';

export { brandAliases, detectCitedRank, mentionsBrandOrSite, urlMatchesSite };
export { evaluateAiGroundingResponse } from '@/lib/audit/ai-grounding-evaluator';
export type { AiEvaluationDetail };
export type { GroundingStatusColor, GroundingTier } from '@/types/live-engine-check';

export const LIVE_CHECK_TIMEOUT_MS = 15_000;

export const DEFAULT_CITED_SNIPPET = '실시간 추천 답변에서 해당 브랜드/공식 웹사이트 인용이 확인되었습니다.';
export const DEFAULT_UNCITED_SNIPPET =
	'해당 지역/업종 추천 검색 결과에서 공식 웹사이트 인용 링크가 확인되지 않았습니다.';

export interface LiveCheckParse {
	isCited: boolean;
	mentionType: MentionType;
	rank: 1 | 2 | 3 | null;
	evidenceSnippet: string;
	citationUrl?: string;
	reachLevel?: LiveReachLevel;
	citations?: LiveCitationMention[];
}

/**
 * Thrown when `extractJsonFromText` cannot find any JSON object in the raw LLM
 * response at all (e.g. the model returned pure prose, or an opening markdown
 * fence with no closing fence/content). Callers must treat this as a real
 * verification FAILURE (fallback to the rule-based score) instead of silently
 * reporting a false "not cited" verdict.
 */
export class LiveCheckParseError extends Error {
	constructor(message = 'AI 응답에서 유효한 JSON을 추출하지 못했습니다.') {
		super(message);
		this.name = 'LiveCheckParseError';
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : 0)));
}

function asTrim(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** Only a real http(s) URL counts. Placeholders such as "empty" or "none" are dropped. */
export function asHttpUrl(value: unknown): string {
	const raw = asTrim(value);
	return /^https?:\/\/\S+$/i.test(raw) ? raw : '';
}

/** Words a model writes when it has no value, never real evidence text. */
const PLACEHOLDER_TEXT = /^(empty|none|null|undefined|n\/a|na|nil|-+|\.+)$/i;

export function resolveLiveCheckQuery(input: {
	targetKeyword?: string | null;
	primaryQuery?: string | null;
	keywords?: readonly string[] | null;
	category?: string | null;
	lang?: 'ko' | 'en';
}): string {
	const first = asTrim(input.targetKeyword) || asTrim(input.primaryQuery) || asTrim(input.keywords?.[0]);
	if (first) return first;
	const category = asTrim(input.category) || (input.lang === 'en' ? 'this category' : '해당 업종');
	return input.lang === 'en' ? `${category} recommendation` : `${category} 추천`;
}

/**
 * Find the first balanced top-level `{...}` object in `text`, honoring string
 * literals (so braces inside quoted strings don't throw off the depth count).
 * Returns null when the object is unbalanced/truncated.
 */
function findBalancedJson(text: string): string | null {
	const start = text.indexOf('{');
	if (start < 0) return null;
	let depth = 0;
	let inString = false;
	let escape = false;
	for (let i = start; i < text.length; i += 1) {
		const ch = text[i];
		if (inString) {
			if (escape) escape = false;
			else if (ch === '\\') escape = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{') depth += 1;
		else if (ch === '}') {
			depth -= 1;
			if (depth === 0) return text.slice(start, i + 1);
		}
	}
	return null;
}

/**
 * Best-effort repair for a JSON object fragment that was truncated mid-stream
 * (e.g. hit `max_tokens` while emitting the payload, or trails a dangling
 * comma). Trims back to the last safe boundary, closes any open string, and
 * appends the missing closing brackets/braces. Returns null when there is
 * nothing sensible to repair.
 */
function repairTruncatedJson(fragment: string): string | null {
	if (!fragment.includes('{')) return null;
	let depth = 0;
	let inString = false;
	let escape = false;
	// Only mark a cut point at a structural boundary where the preceding
	// content is guaranteed to be a *complete* key/value pair or element:
	// right before a top-level `,`, or right after a nested `}`/`]` closes.
	// (A string simply closing is NOT safe — it may be a key with no value
	// yet, which would otherwise leave a dangling `"key"` with no `:value`.)
	let lastSafeIndex = -1;
	for (let i = 0; i < fragment.length; i += 1) {
		const ch = fragment[i];
		if (inString) {
			if (escape) escape = false;
			else if (ch === '\\') escape = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{' || ch === '[') {
			depth += 1;
		} else if (ch === '}' || ch === ']') {
			depth -= 1;
			lastSafeIndex = i;
		} else if (ch === ',') {
			lastSafeIndex = i - 1;
		}
	}
	if (depth <= 0) return null;

	const repairedBase = lastSafeIndex >= 0 ? fragment.slice(0, lastSafeIndex + 1) : fragment;
	let repaired = repairedBase.replace(/,\s*$/, '');
	if (!repaired.includes('{')) return null;

	const closers: string[] = [];
	let str = false;
	let esc = false;
	for (const ch of repaired) {
		if (str) {
			if (esc) esc = false;
			else if (ch === '\\') esc = true;
			else if (ch === '"') str = false;
			continue;
		}
		if (ch === '"') {
			str = true;
			continue;
		}
		if (ch === '{') closers.push('}');
		else if (ch === '[') closers.push(']');
		else if (ch === '}' || ch === ']') closers.pop();
	}
	if (str) repaired += '"';
	repaired += closers.reverse().join('');
	return repaired;
}

/**
 * Safely extract a JSON object out of a raw LLM response, tolerating:
 * - Markdown code fences (```json ... ``` or plain ``` ... ```), including
 *   fences that were never closed (e.g. truncated at `max_tokens`).
 * - Leading/trailing prose ("Here is the JSON requested: ...").
 * - Truncated objects with a dangling comma/open string (best-effort repair).
 *
 * Returns null only when no JSON object can be recovered at all.
 */
export function extractJsonFromText(text: string): Record<string, unknown> | null {
	const trimmed = text.trim();
	if (!trimmed) return null;

	const fenceOpen = trimmed.match(/```(?:json)?\s*/i);
	let candidate = trimmed;
	if (fenceOpen && fenceOpen.index !== undefined) {
		const afterFence = trimmed.slice(fenceOpen.index + fenceOpen[0].length);
		const closeIdx = afterFence.indexOf('```');
		candidate = closeIdx >= 0 ? afterFence.slice(0, closeIdx) : afterFence;
	}

	for (const source of [candidate, trimmed]) {
		const balanced = findBalancedJson(source);
		if (!balanced) continue;
		try {
			return JSON.parse(balanced) as Record<string, unknown>;
		} catch {
			/* fall through to repair attempt below */
		}
	}

	for (const source of [candidate, trimmed]) {
		const start = source.indexOf('{');
		if (start < 0) continue;
		const repaired = repairTruncatedJson(source.slice(start));
		if (!repaired) continue;
		try {
			return JSON.parse(repaired) as Record<string, unknown>;
		} catch {
			/* give up on this source */
		}
	}

	return null;
}

/** @deprecated Use `extractJsonFromText`; kept as an alias for backward compatibility. */
export const extractJsonObject = extractJsonFromText;

function parseRank(value: unknown): 1 | 2 | 3 | null {
	const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
	if (n === 1 || n === 2 || n === 3) return n;
	return null;
}

function parseReachLevel(value: unknown, isCited: boolean): LiveReachLevel {
	if (value === 'Level 1' || value === 'Level 2' || value === 'Level 3') return value;
	return isCited ? 'Level 2' : 'Level 1';
}

/**
 * Normalize the judge's `mentionType` field. Falls back to a conservative
 * inference from `isCited`/`rank` when the field is missing or the value is
 * unrecognized (e.g. an older engine mock, or a model that ignored the schema).
 */
function parseMentionType(value: unknown, isCited: boolean, rank: 1 | 2 | 3 | null): MentionType {
	if (value === 'none' || value === 'simple_mention' || value === 'recommended') return value;
	if (!isCited) return 'none';
	return rank ? 'recommended' : 'simple_mention';
}

/** True when the string is leftover LLM JSON rather than a human-readable sentence. */
export function looksLikeRawJson(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) return false;
	if (/["']?(isCited|mentionType|evidenceSnippet|reachLevel|citationUrl|citedRank)["']?\s*:/i.test(trimmed)) return true;
	if (/^\{[\s\S]*\}/.test(trimmed) && /[{}\[\]]/.test(trimmed)) return true;
	return false;
}

export function sanitizeEvidenceSnippet(
	raw: string,
	isCited: boolean,
	fallback?: string,
): string {
	const defaultSnippet = fallback || (isCited ? DEFAULT_CITED_SNIPPET : DEFAULT_UNCITED_SNIPPET);
	const trimmed = raw.replace(/\s+/g, ' ').trim();
	if (!trimmed || PLACEHOLDER_TEXT.test(trimmed) || looksLikeRawJson(trimmed)) return defaultSnippet;
	if (/[{}\[\]]/.test(trimmed)) {
		const cleaned = trimmed.replace(/[{}\[\]"]/g, ' ').replace(/\s+/g, ' ').trim();
		if (!cleaned || looksLikeRawJson(cleaned) || /isCited|mentionType|evidenceSnippet|reachLevel/i.test(cleaned)) {
			return defaultSnippet;
		}
		return cleaned.slice(0, 200);
	}
	return trimmed.slice(0, 220);
}

/**
 * Pull a compact citation JSON object out of markdown fences / mixed prose.
 * Never returns raw JSON text as evidenceSnippet.
 *
 * Throws `LiveCheckParseError` when no JSON object can be recovered at all.
 * Structured engines still treat that as a failed judge. Search engines use
 * `groundingObservationFromSearch`, which keeps the HTTP response live and
 * reads the brand from the answer text and citation URLs.
 */
export function parseLLMResponse(
	rawText: string,
	defaultSnippet = '실시간 분석 완료',
): {
	isCited: boolean;
	mentionType: MentionType;
	rank: 1 | 2 | 3 | null;
	evidenceSnippet: string;
	reachLevel: LiveReachLevel;
	citationUrl?: string;
	citations?: LiveCitationMention[];
} {
	const json = extractJsonFromText(rawText);
	if (!json) {
		throw new LiveCheckParseError();
	}
	// isMentioned/isCited must come from an explicit boolean; missing/undefined
	// defaults to false so a malformed judge payload never silently passes.
	const isCited = Boolean(json.isCited ?? json.isMentioned ?? json.cited ?? json.mentioned ?? false);
	const rank = parseRank(json.rank ?? json.citedRank);
	const mentionType = parseMentionType(json.mentionType, isCited, rank);
	const rawSnippet = asTrim(json.evidenceSnippet ?? json.evidence ?? json.snippet ?? json.reason);
	const snippet = sanitizeEvidenceSnippet(rawSnippet, isCited, rawSnippet ? defaultSnippet : undefined);
	const citations = parseCitationMentions(json.citations);
	return {
		isCited: mentionType !== 'none' && isCited,
		mentionType,
		rank: mentionType === 'recommended' ? rank : null,
		evidenceSnippet: snippet,
		reachLevel: parseReachLevel(json.reachLevel, isCited),
		citationUrl: asHttpUrl(json.citationUrl ?? json.url ?? json.sourceUrl) || undefined,
		citations,
	};
}

function parseCitationMentions(raw: unknown): LiveCitationMention[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const out: LiveCitationMention[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const url = asHttpUrl(row.url);
		const title = asTrim(row.title);
		if (!url && !title) continue;
		out.push({ title, url, isTargetMention: row.isTargetMention === true });
	}
	return out.length ? out : undefined;
}

/**
 * Combine the judge's structured verdict with a negation-aware text scan.
 *
 * IMPORTANT: the text scan (`mentionsBrandOrSite`) is negation-aware, so it
 * will NOT flip a correct `isCited: false` verdict to true just because the
 * brand name appears inside a sentence like "언급되지 않았습니다". It is only
 * used to recover a citation the judge may have missed when it *positively*
 * mentions the brand without setting the flag.
 */
export function parseLiveCheckPayload(
	rawText: string,
	siteName: string,
	siteUrl: string,
	citationCandidates: readonly string[] = [],
	extraAliases: readonly string[] = [],
): LiveCheckParse {
	const parsed = parseLLMResponse(rawText, DEFAULT_UNCITED_SNIPPET);
	const textCited = mentionsBrandOrSite(rawText, siteName, siteUrl, extraAliases);
	const isCited = parsed.isCited || textCited;
	const mentionType: MentionType =
		parsed.mentionType !== 'none' ? parsed.mentionType : textCited ? 'simple_mention' : 'none';
	const rank = mentionType === 'recommended' ? parsed.rank || detectCitedRank(rawText, siteName, siteUrl, extraAliases) : null;
	const jsonUrl = parsed.citationUrl || '';
	const matchedCitation =
		(jsonUrl && urlMatchesSite(jsonUrl, siteUrl) ? jsonUrl : '') ||
		citationCandidates.find((url) => urlMatchesSite(url, siteUrl)) ||
		(jsonUrl || citationCandidates[0] || '');
	const classified = classifyCitationList(parsed.citations, citationCandidates, siteUrl, extraAliases);
	const earnedCited = classified?.some((row) => row.isTargetMention) === true;
	return {
		isCited: isCited || earnedCited,
		mentionType: earnedCited && mentionType === 'none' ? 'simple_mention' : mentionType,
		rank,
		evidenceSnippet: sanitizeEvidenceSnippet(parsed.evidenceSnippet, isCited || earnedCited),
		citationUrl: matchedCitation || undefined,
		reachLevel: parsed.reachLevel,
		citations: classified,
	};
}

/**
 * Search-engine observation. A real Perplexity or Gemini body stays live even
 * when it is prose plus citations instead of the judge JSON.
 */
export function groundingObservationFromSearch(
	rawText: string,
	siteName: string,
	siteUrl: string,
	citationCandidates: readonly string[] = [],
	extraAliases: readonly string[] = [],
): LiveCheckParse {
	try {
		return parseLiveCheckPayload(rawText, siteName, siteUrl, citationCandidates, extraAliases);
	} catch (error) {
		if (!(error instanceof LiveCheckParseError)) throw error;
	}
	const textCited = mentionsBrandOrSite(rawText, siteName, siteUrl, extraAliases);
	const matched = citationCandidates.find((url) => urlMatchesSite(url, siteUrl));
	const cited = textCited || Boolean(matched);
	const rank = textCited ? detectCitedRank(rawText, siteName, siteUrl, extraAliases) : null;
	return {
		isCited: cited,
		mentionType: !cited ? 'none' : rank && rank <= 2 ? 'recommended' : 'simple_mention',
		rank: rank && rank <= 2 ? rank : null,
		evidenceSnippet: sanitizeEvidenceSnippet(rawText, cited),
		citationUrl: matched || undefined,
	};
}

function classifyCitationList(
	parsed: LiveCitationMention[] | undefined,
	candidates: readonly string[],
	siteUrl: string,
	brandAliases: readonly string[],
): LiveCitationMention[] | undefined {
	const rows = [
		...(parsed ?? []),
		...candidates.map((url) => ({ title: '', url, isTargetMention: false })),
	];
	const classified = classifyCitations(rows, siteUrl, brandAliases);
	if (!classified.length) return parsed;
	return classified.map(({ title, url, isTargetMention }) => ({ title, url, isTargetMention }));
}

export interface LiveResultContext {
	rawResponseText?: string;
	targetBrand?: string;
	targetDomain?: string;
	/** URLs the answer itself cites (Perplexity `citations`, Gemini chunks backing a support). */
	citationCandidates?: readonly string[];
	/** Every retrieved search result, including ones the answer did not cite. */
	resultUrls?: readonly string[];
	/** When set, the response is judged on search evidence. Unset keeps the legacy judge-only path. */
	search?: SearchEvidence;
	brandAliases?: readonly string[];
}

/** Adds the call-level observation fields to a finished verdict. */
function withObservation(result: LiveEngineCheckResult, context: LiveResultContext | undefined): LiveEngineCheckResult {
	const siteUrl = context?.targetDomain || '';
	const answerText = (context?.rawResponseText || '').trim();
	const urlsInText = answerText.match(/https?:\/\/[^\s"'<>)\]]+/gi) ?? [];
	const answerUrls = [...(context?.citationCandidates ?? []), ...urlsInText];
	const resultUrls = [...new Set([...(context?.resultUrls ?? []), ...answerUrls])];
	const officialCited = Boolean(siteUrl) && answerUrls.some((url) => urlMatchesSite(url, siteUrl));
	const officialInResults = !officialCited && Boolean(siteUrl) && resultUrls.some((url) => urlMatchesSite(url, siteUrl));
	const brandMentioned =
		Boolean(answerText && context?.targetBrand) &&
		mentionsBrandOrSite(answerText, context?.targetBrand || '', siteUrl, context?.brandAliases ?? []);

	const observation: LiveObservationStatus = officialCited
		? 'official_cited'
		: result.isCited
			? 'brand_mentioned'
			: officialInResults
				? 'official_in_results'
				: 'not_observed';

	const statusDetail: LiveStatusDetail =
		result.statusDetail ??
		(officialCited
			? 'OFFICIAL_CITED'
			: result.isCited
				? 'BRAND_MENTIONED'
				: officialInResults
					? 'OFFICIAL_IN_RESULTS'
					: 'NOT_OBSERVED');

	return {
		...result,
		observation,
		statusDetail,
		searchEvidence: context?.search ? context.search.performed : true,
		searchSourceCount: context?.search?.sourceCount,
		brandMentioned,
		officialCited,
		officialInResults,
	};
}

const STATUS_DETAIL_BY_KIND: Record<LiveFailureKind, LiveStatusDetail> = {
	missing_key: 'AUTH_ERROR',
	auth: 'AUTH_ERROR',
	billing: 'BILLING_ERROR',
	rate_limit: 'RATE_LIMIT',
	model_unavailable: 'PROVIDER_ERROR',
	bad_request: 'PROVIDER_ERROR',
	timeout: 'TIMEOUT',
	network: 'PROVIDER_ERROR',
	empty_body: 'EMPTY_BODY',
	parse_error: 'PARSE_ERROR',
	provider_error: 'PROVIDER_ERROR',
	unknown: 'PROVIDER_ERROR',
};

function excerptAround(text: string, needle: string): string {
	const idx = text.toLowerCase().indexOf(needle.toLowerCase());
	const slice = idx < 0 ? text.slice(0, 180) : text.slice(Math.max(0, idx - 40), idx + needle.length + 80);
	return slice.replace(/\s+/g, ' ').trim();
}

/**
 * ChatGPT and Claude are called without a web-search tool, so they have no citations array.
 * A positive brand name or the official domain inside the answer text is a partial text match.
 * Neither one is an error: the answer simply did not name the target.
 * A negated sentence that contains the brand is not a match.
 */
function buildUngroundedAnswerResult(
	engine: LiveGroundedEngineId,
	ruleScore: number,
	context: LiveResultContext | undefined,
): LiveEngineCheckResult {
	const text = (context?.rawResponseText || '').trim();
	const brand = context?.targetBrand || '';
	const siteUrl = context?.targetDomain || '';
	const domainInText = Boolean(siteUrl) && textContainsOfficialDomain(text, siteUrl);
	const brandInText = Boolean(brand) && mentionsBrandName(text, brand, context?.brandAliases ?? []);
	const base = {
		engine,
		isLive: true,
		searchEvidence: false as const,
		searchSourceCount: 0,
		citedRank: null,
		fallbackToRuleScore: false,
	};

	if (!domainInText && !brandInText) {
		return {
			...base,
			isGrounding: false,
			isLiveGrounded: false,
			isCited: false,
			reachLevel: 'Level 1',
			liveScore: clamp(ruleScore, 0, 100),
			evidenceSnippet: '응답은 정상적으로 받았지만, 본문에서 공식 도메인이나 브랜드명을 확인하지 못했습니다.',
			fallbackToRuleScore: true,
			statusLabel: '응답은 성공했으나 도메인/브랜드 언급 없음',
			statusColor: 'yellow',
			observation: 'answer_no_mention',
			statusDetail: 'NO_CITATION',
			brandMentioned: false,
			officialCited: false,
			officialInResults: false,
		};
	}

	const domain = domainInText;
	const needle = domain ? (text.match(/https?:\/\/[^\s"'<>)\]]+/i)?.[0] ?? brand) : brand;
	return {
		...base,
		isGrounding: true,
		isLiveGrounded: true,
		isCited: domain,
		mentionType: 'simple_mention',
		reachLevel: domain ? 'Level 2' : 'Level 1',
		liveScore: domain ? 80 : 75,
		evidenceSnippet: sanitizeEvidenceSnippet(excerptAround(text, needle || brand), true),
		citationUrl: domain ? asHttpUrl(text.match(/https?:\/\/[^\s"'<>)\]]+/gi)?.find((url) => urlMatchesSite(url, siteUrl)) ?? '') || undefined : undefined,
		tier: 'NEUTRAL',
		statusLabel: domain ? '응답 본문에서 공식 도메인 확인' : '응답 본문에서 브랜드 확인',
		statusColor: 'blue',
		observation: domain ? 'text_domain' : 'text_mention',
		statusDetail: domain ? 'TEXT_DOMAIN' : 'TEXT_MENTION',
		brandMentioned: brandInText || domain,
		officialCited: domain,
		officialInResults: false,
	};
}

function composeGroundingText(parsed: LiveCheckParse, context?: LiveResultContext): string {
	return [context?.rawResponseText, parsed.evidenceSnippet, parsed.citationUrl, ...(context?.citationCandidates ?? [])]
		.filter((part): part is string => Boolean(part && part.trim()))
		.join('\n');
}

function collectCitedSources(
	citationUrl: string | undefined,
	context?: LiveResultContext,
): string[] | undefined {
	const urls = uniqueHttpUrls([citationUrl, ...(context?.citationCandidates ?? [])]);
	return urls.length > 0 ? urls : undefined;
}

function reachLevelForTier(tier: GroundingTier, citationUrl?: string): LiveReachLevel {
	if (tier === 'NOT_FOUND') return 'Level 1';
	if (tier === 'WEAK') return citationUrl ? 'Level 2' : 'Level 1';
	if (citationUrl) return 'Level 3';
	return 'Level 2';
}

export function computeLiveScore(input: {
	isCited: boolean;
	rank: 1 | 2 | 3 | null;
	hasCitationUrl: boolean;
	ruleScore: number;
	failed?: boolean;
	mentionType?: MentionType;
	responseText?: string;
	targetBrand?: string;
	targetDomain?: string;
	engine?: string;
}): { liveScore: number; fallbackToRuleScore: boolean; evaluation?: AiEvaluationDetail } {
	const ruleScore = clamp(input.ruleScore, 0, 100);
	if (input.failed) {
		return { liveScore: ruleScore, fallbackToRuleScore: true };
	}

	const responseText = (input.responseText || '').trim();
	if (responseText && input.targetBrand && input.targetDomain) {
		const evaluation = evaluateAiGroundingResponse(
			toSupportedAiEngine(input.engine || 'general_ai'),
			ruleScore,
			responseText,
			input.targetBrand,
			input.targetDomain,
			{
				rank: input.rank,
				citationUrl: input.hasCitationUrl ? input.targetDomain : undefined,
				mentionType: input.mentionType,
			},
		);
		return { liveScore: evaluation.liveScore, fallbackToRuleScore: false, evaluation };
	}

	if (
		responseText &&
		hasWeakGroundingSignal(responseText) &&
		input.isCited &&
		input.mentionType !== 'none'
	) {
		return { liveScore: clamp(ruleScore + 1, ruleScore - 5, ruleScore + 5), fallbackToRuleScore: false };
	}

	if (!input.isCited || input.mentionType === 'none') {
		return { liveScore: ruleScore, fallbackToRuleScore: false };
	}

	if (input.mentionType === 'simple_mention') {
		return { liveScore: input.hasCitationUrl ? 80 : 75, fallbackToRuleScore: false };
	}

	if (input.isCited && input.rank === 1) return { liveScore: 98, fallbackToRuleScore: false };
	if (input.isCited && input.rank === 2) return { liveScore: 95, fallbackToRuleScore: false };
	if (input.isCited && input.rank === 3) return { liveScore: 85, fallbackToRuleScore: false };
	if (input.isCited) {
		return { liveScore: input.hasCitationUrl ? 80 : 75, fallbackToRuleScore: false };
	}
	return { liveScore: ruleScore, fallbackToRuleScore: false };
}

export function computeReachLevel(isCited: boolean, citationUrl?: string): LiveReachLevel {
	if (isCited && citationUrl) return 'Level 3';
	if (isCited) return 'Level 2';
	return 'Level 1';
}

/**
 * No measurement: the call failed or returned an empty body. The rule score stays,
 * and nothing here says the brand was or was not exposed. `mentionType` and `tier`
 * are left unset on purpose so no consumer reads a failure as "not exposed".
 */
export function buildFailedLiveResult(
	engine: LiveGroundedEngineId,
	ruleScore: number,
	error: string,
	detail?: LiveFailureDetail,
): LiveEngineCheckResult {
	const { liveScore, fallbackToRuleScore } = computeLiveScore({
		isCited: false,
		rank: null,
		hasCitationUrl: false,
		ruleScore,
		failed: true,
	});
	const emptyBody = detail?.kind === 'empty_body';
	return {
		engine,
		isLive: false,
		isGrounding: false,
		isLiveGrounded: false,
		isCited: false,
		reachLevel: 'Level 1',
		liveScore,
		evidenceSnippet: error,
		fallbackToRuleScore,
		citedRank: null,
		statusLabel: emptyBody ? '응답 본문 확인 불가 (기술 준비도 유지)' : '실시간 조회 실패 (기술 준비도 유지)',
		statusColor: 'yellow',
		error,
		observation: emptyBody ? 'empty_body' : 'request_failed',
		statusDetail: STATUS_DETAIL_BY_KIND[detail?.kind ?? 'unknown'],
		failureKind: detail?.kind ?? 'unknown',
		httpStatus: detail?.httpStatus,
		providerErrorCode: detail?.providerCode,
		providerRequestId: detail?.requestId,
		searchEvidence: false,
	};
}

/** Test data from a MOCK_* flag. It is labeled and never counted as a measurement. */
export function buildMockLiveResult(engine: LiveGroundedEngineId, ruleScore: number): LiveEngineCheckResult {
	return {
		engine,
		isLive: false,
		isGrounding: false,
		isLiveGrounded: false,
		isCited: false,
		reachLevel: 'Level 1',
		liveScore: clamp(ruleScore, 0, 100),
		evidenceSnippet: '테스트용 Mock 데이터입니다. 실제 AI 응답이 아닙니다.',
		fallbackToRuleScore: true,
		citedRank: null,
		statusLabel: '테스트 데이터 (실측 아님)',
		statusColor: 'yellow',
		observation: 'mock',
		statusDetail: 'MOCK',
		searchEvidence: false,
		isMock: true,
	};
}

/**
 * What the response showed about a web search. `performed` is true only with evidence in
 * the response itself (Gemini grounding chunks or queries, Perplexity citations or
 * search results, an OpenAI or Claude search-tool call).
 */
export interface SearchEvidence {
	performed: boolean;
	sourceCount: number;
}

export function buildLiveEngineResult(
	engine: LiveGroundedEngineId,
	parsed: LiveCheckParse,
	ruleScore: number,
	context?: LiveResultContext,
): LiveEngineCheckResult {
	// No web-search evidence. ChatGPT and Claude have no citations array, so a brand or official
	// domain in the answer text is a partial match, and neither is stored as an error.
	// Gemini and Perplexity stay ungraded here: their text alone is not search evidence.
	if (context?.search && !context.search.performed) {
		if (engine === 'chatgpt' || engine === 'claude') return buildUngroundedAnswerResult(engine, ruleScore, context);
		return {
			engine,
			isLive: true,
			isGrounding: false,
			isLiveGrounded: false,
			isCited: false,
			reachLevel: 'Level 1' as const,
			liveScore: clamp(ruleScore, 0, 100),
			evidenceSnippet: '응답은 완료되었지만 웹 검색을 수행한 근거(검색 출처·인용)를 확인하지 못해 노출 여부를 판정하지 않았습니다.',
			fallbackToRuleScore: true,
			citedRank: null,
			statusLabel: '응답 완료 · 검색 근거 미확인',
			statusColor: 'yellow' as const,
			observation: 'no_search_evidence' as const,
			searchEvidence: false,
			searchSourceCount: context?.search?.sourceCount ?? 0,
			brandMentioned: false,
			officialCited: false,
			officialInResults: false,
		};
	}

	const composedText = composeGroundingText(parsed, context);
	const targetBrand = context?.targetBrand || '';
	const targetDomain = context?.targetDomain || parsed.citationUrl || '';
	const evaluation =
		targetBrand && (targetDomain || composedText)
			? evaluateAiGroundingResponse(
					toSupportedAiEngine(engine),
					ruleScore,
					composedText,
					targetBrand,
					targetDomain || 'https://example.invalid',
					{
						rank: parsed.rank,
						citationUrl: parsed.citationUrl,
						mentionType: parsed.mentionType,
						citationCandidates: context?.citationCandidates,
						brandAliases: context?.brandAliases,
					},
				)
			: undefined;

	if (evaluation) {
		const earnedMention = parsed.citations?.some((row) => row.isTargetMention) === true;
		const isCited = evaluation.tier !== 'NOT_FOUND' || earnedMention;
		const mentionType = isCited && evaluation.tier === 'NOT_FOUND' ? 'simple_mention' : mentionTypeForTier(evaluation.tier);
		const citationUrl = evaluation.citedUrl || parsed.citationUrl?.trim() || undefined;
		return withObservation(
			{
				engine,
				isLive: true,
				isGrounding: isCited,
				isLiveGrounded: true,
				isCited,
				mentionType,
				reachLevel: reachLevelForTier(evaluation.tier === 'NOT_FOUND' && earnedMention ? 'NEUTRAL' : evaluation.tier, citationUrl),
				liveScore: evaluation.liveScore,
				evidenceSnippet: sanitizeEvidenceSnippet(
					evaluation.citationExcerpt || parsed.evidenceSnippet,
					isCited,
					isCited ? DEFAULT_CITED_SNIPPET : DEFAULT_UNCITED_SNIPPET,
				),
				citationUrl,
				citedSources: collectCitedSources(citationUrl, context),
				citations: parsed.citations,
				fallbackToRuleScore: false,
				citedRank: evaluation.tier === 'STRONG' ? parsed.rank || detectCitedRank(composedText, targetBrand, targetDomain, context?.brandAliases) : null,
				tier: evaluation.tier === 'NOT_FOUND' && earnedMention ? 'NEUTRAL' : evaluation.tier,
				statusLabel: evaluation.statusLabel,
				statusColor: evaluation.statusColor,
				weaknessReasons: evaluation.weaknessReasons,
			},
			context,
		);
	}

	const citationUrl = parsed.citationUrl?.trim() || undefined;
	const { liveScore, fallbackToRuleScore } = computeLiveScore({
		isCited: parsed.isCited,
		rank: parsed.rank,
		hasCitationUrl: Boolean(citationUrl),
		ruleScore,
		mentionType: parsed.mentionType,
		responseText: composedText,
		engine,
	});
	const inferredTier: GroundingTier =
		!parsed.isCited || parsed.mentionType === 'none'
			? 'NOT_FOUND'
			: hasWeakGroundingSignal(composedText)
				? 'WEAK'
				: parsed.mentionType === 'simple_mention' || !parsed.rank
					? 'NEUTRAL'
					: parsed.rank <= 2
						? 'STRONG'
						: 'NEUTRAL';
	const isCited = inferredTier !== 'NOT_FOUND';
	return withObservation(
		{
			engine,
			isLive: true,
			isGrounding: isCited,
			isLiveGrounded: true,
			isCited,
			mentionType: mentionTypeForTier(inferredTier),
			reachLevel: reachLevelForTier(inferredTier, citationUrl),
			liveScore,
			evidenceSnippet: sanitizeEvidenceSnippet(
				parsed.evidenceSnippet,
				isCited,
				isCited ? DEFAULT_CITED_SNIPPET : DEFAULT_UNCITED_SNIPPET,
			),
			citationUrl,
			citedSources: collectCitedSources(citationUrl, context),
			citations: parsed.citations,
			fallbackToRuleScore,
			citedRank: inferredTier === 'STRONG' ? parsed.rank : null,
			tier: inferredTier,
			statusLabel: GROUNDING_STATUS_LABEL[inferredTier],
			statusColor: GROUNDING_STATUS_COLOR[inferredTier],
			weaknessReasons: inferredTier === 'WEAK' ? ['추천 신호가 약함 — GEO 보강 필요'] : undefined,
		},
		context,
	);
}

export function ruleScoreFor(engine: LiveCheckEngineId, ruleScores?: Partial<Record<LiveCheckEngineId, number>>): number {
	const value = ruleScores?.[engine];
	return clamp(typeof value === 'number' ? value : 0, 0, 100);
}
