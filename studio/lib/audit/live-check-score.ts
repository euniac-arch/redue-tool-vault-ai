import type {
	LiveCheckEngineId,
	LiveEngineCheckResult,
	LiveGroundedEngineId,
	LiveReachLevel,
} from '@/types/live-engine-check';

export const LIVE_CHECK_TIMEOUT_MS = 12_000;

export const DEFAULT_CITED_SNIPPET = '실시간 추천 답변에서 해당 브랜드/공식 웹사이트 인용이 확인되었습니다.';
export const DEFAULT_UNCITED_SNIPPET =
	'해당 지역/업종 추천 검색 결과에서 공식 웹사이트 인용 링크가 확인되지 않았습니다.';

export interface LiveCheckParse {
	isCited: boolean;
	rank: 1 | 2 | 3 | null;
	evidenceSnippet: string;
	citationUrl?: string;
	reachLevel?: LiveReachLevel;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : 0)));
}

function asTrim(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

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

export function extractJsonObject(text: string): Record<string, unknown> | null {
	const trimmed = text.trim();
	if (!trimmed) return null;
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const raw = fenced?.[1]?.trim() || trimmed;
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export function brandAliases(siteName: string, siteUrl: string): string[] {
	const aliases = new Set<string>();
	const name = siteName.trim();
	if (name) {
		aliases.add(name);
		aliases.add(name.replace(/\s+/g, ''));
		const stripped = name.replace(/(의원|병원|클리닉|한의원|치과)$/u, '').trim();
		if (stripped.length >= 2) aliases.add(stripped);
	}
	try {
		const host = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`).hostname.replace(/^www\./i, '');
		if (host.length >= 3) aliases.add(host);
		const head = host.split('.')[0] || '';
		if (head.length >= 3) aliases.add(head);
	} catch {
		/* ignore malformed URLs */
	}
	return [...aliases].filter((alias) => alias.length >= 2);
}

export function mentionsBrandOrSite(text: string, siteName: string, siteUrl: string): boolean {
	const hay = text.toLowerCase();
	if (!hay) return false;
	return brandAliases(siteName, siteUrl).some((alias) => hay.includes(alias.toLowerCase()));
}

export function urlMatchesSite(url: string, siteUrl: string): boolean {
	const raw = url.trim();
	if (!raw) return false;
	try {
		const cited = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
		const site = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`);
		const citedHost = cited.hostname.replace(/^www\./i, '').toLowerCase();
		const siteHost = site.hostname.replace(/^www\./i, '').toLowerCase();
		return citedHost === siteHost || citedHost.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${citedHost}`);
	} catch {
		return raw.toLowerCase().includes(siteUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase());
	}
}

export function detectCitedRank(text: string, siteName: string, siteUrl: string): 1 | 2 | 3 | null {
	if (!mentionsBrandOrSite(text, siteName, siteUrl)) return null;
	const aliases = brandAliases(siteName, siteUrl)
		.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('|');
	if (!aliases) return null;
	const patterns: Array<{ rank: 1 | 2 | 3; re: RegExp }> = [
		{ rank: 1, re: new RegExp(`(?:^|[\\s,.)]|1[위등.]|1st|first|#1)[^\\n]{0,40}(?:${aliases})|(?:${aliases})[^\\n]{0,24}(?:1위|1등|1st|first)`, 'i') },
		{ rank: 2, re: new RegExp(`(?:2[위등.]|2nd|second|#2)[^\\n]{0,40}(?:${aliases})|(?:${aliases})[^\\n]{0,24}(?:2위|2등|2nd|second)`, 'i') },
		{ rank: 3, re: new RegExp(`(?:3[위등.]|3rd|third|#3)[^\\n]{0,40}(?:${aliases})|(?:${aliases})[^\\n]{0,24}(?:3위|3등|3rd|third)`, 'i') },
	];
	for (const pattern of patterns) {
		if (pattern.re.test(text)) return pattern.rank;
	}
	return null;
}

function parseRank(value: unknown): 1 | 2 | 3 | null {
	const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
	if (n === 1 || n === 2 || n === 3) return n;
	return null;
}

function parseReachLevel(value: unknown, isCited: boolean): LiveReachLevel {
	if (value === 'Level 1' || value === 'Level 2' || value === 'Level 3') return value;
	return isCited ? 'Level 2' : 'Level 1';
}

/** True when the string is leftover LLM JSON rather than a human-readable sentence. */
export function looksLikeRawJson(text: string): boolean {
	const trimmed = text.trim();
	if (!trimmed) return false;
	if (/["']?(isCited|evidenceSnippet|reachLevel|citationUrl|citedRank)["']?\s*:/i.test(trimmed)) return true;
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
	if (!trimmed || looksLikeRawJson(trimmed)) return defaultSnippet;
	if (/[{}\[\]]/.test(trimmed)) {
		const cleaned = trimmed.replace(/[{}\[\]"]/g, ' ').replace(/\s+/g, ' ').trim();
		if (!cleaned || looksLikeRawJson(cleaned) || /isCited|evidenceSnippet|reachLevel/i.test(cleaned)) {
			return defaultSnippet;
		}
		return cleaned.slice(0, 200);
	}
	return trimmed.slice(0, 220);
}

/**
 * Pull a compact citation JSON object out of markdown fences / mixed prose.
 * Never returns raw JSON text as evidenceSnippet.
 */
export function parseLLMResponse(
	rawText: string,
	defaultSnippet = '실시간 분석 완료',
): {
	isCited: boolean;
	rank: 1 | 2 | 3 | null;
	evidenceSnippet: string;
	reachLevel: LiveReachLevel;
	citationUrl?: string;
} {
	try {
		const json = extractJsonObject(rawText);
		if (!json) throw new Error('No JSON found');
		const isCited = Boolean(json.isCited ?? json.cited ?? json.mentioned);
		const rawSnippet = asTrim(json.evidenceSnippet ?? json.snippet ?? json.reason);
		const snippet = sanitizeEvidenceSnippet(rawSnippet, isCited, rawSnippet ? defaultSnippet : undefined);
		return {
			isCited,
			rank: parseRank(json.rank ?? json.citedRank),
			evidenceSnippet: snippet,
			reachLevel: parseReachLevel(json.reachLevel, isCited),
			citationUrl: asTrim(json.citationUrl ?? json.url ?? json.sourceUrl) || undefined,
		};
	} catch {
		return {
			isCited: false,
			rank: null,
			evidenceSnippet: sanitizeEvidenceSnippet(rawText, false, defaultSnippet),
			reachLevel: 'Level 1',
		};
	}
}

export function parseLiveCheckPayload(
	rawText: string,
	siteName: string,
	siteUrl: string,
	citationCandidates: readonly string[] = [],
): LiveCheckParse {
	const parsed = parseLLMResponse(
		rawText,
		DEFAULT_UNCITED_SNIPPET,
	);
	const textCited = mentionsBrandOrSite(rawText, siteName, siteUrl);
	const isCited = parsed.isCited || textCited;
	const rank = isCited ? parsed.rank || detectCitedRank(rawText, siteName, siteUrl) : null;
	const jsonUrl = parsed.citationUrl || '';
	const matchedCitation =
		(jsonUrl && urlMatchesSite(jsonUrl, siteUrl) ? jsonUrl : '') ||
		citationCandidates.find((url) => urlMatchesSite(url, siteUrl)) ||
		(jsonUrl || citationCandidates[0] || '');
	return {
		isCited,
		rank,
		evidenceSnippet: sanitizeEvidenceSnippet(parsed.evidenceSnippet, isCited),
		citationUrl: matchedCitation || undefined,
		reachLevel: parsed.reachLevel,
	};
}

export function computeLiveScore(input: {
	isCited: boolean;
	rank: 1 | 2 | 3 | null;
	hasCitationUrl: boolean;
	ruleScore: number;
	failed?: boolean;
}): { liveScore: number; fallbackToRuleScore: boolean } {
	const ruleScore = clamp(input.ruleScore, 0, 100);
	if (input.failed) {
		return { liveScore: ruleScore, fallbackToRuleScore: true };
	}
	if (input.isCited && input.rank === 1) return { liveScore: 98, fallbackToRuleScore: false };
	if (input.isCited && input.rank === 2) return { liveScore: 93, fallbackToRuleScore: false };
	if (input.isCited && input.rank === 3) return { liveScore: 88, fallbackToRuleScore: false };
	if (input.isCited) {
		const score = input.hasCitationUrl ? 84 : clamp(75 + Math.round(ruleScore * 0.09), 75, 84);
		return { liveScore: score, fallbackToRuleScore: false };
	}
	return { liveScore: clamp(15 + Math.round((ruleScore / 100) * 20), 15, 35), fallbackToRuleScore: false };
}

export function computeReachLevel(isCited: boolean, citationUrl?: string): LiveReachLevel {
	if (isCited && citationUrl) return 'Level 3';
	if (isCited) return 'Level 2';
	return 'Level 1';
}

export function buildFailedLiveResult(
	engine: LiveGroundedEngineId,
	ruleScore: number,
	error: string,
): LiveEngineCheckResult {
	const { liveScore, fallbackToRuleScore } = computeLiveScore({
		isCited: false,
		rank: null,
		hasCitationUrl: false,
		ruleScore,
		failed: true,
	});
	return {
		engine,
		isLiveGrounded: false,
		isCited: false,
		reachLevel: 'Level 1',
		liveScore,
		evidenceSnippet: error,
		fallbackToRuleScore,
		citedRank: null,
		error,
	};
}

export function buildLiveEngineResult(
	engine: LiveGroundedEngineId,
	parsed: LiveCheckParse,
	ruleScore: number,
): LiveEngineCheckResult {
	const citationUrl = parsed.citationUrl?.trim() || undefined;
	const { liveScore, fallbackToRuleScore } = computeLiveScore({
		isCited: parsed.isCited,
		rank: parsed.rank,
		hasCitationUrl: Boolean(citationUrl),
		ruleScore,
	});
	return {
		engine,
		isLiveGrounded: true,
		isCited: parsed.isCited,
		reachLevel: computeReachLevel(parsed.isCited, citationUrl),
		liveScore,
		evidenceSnippet: sanitizeEvidenceSnippet(
			parsed.evidenceSnippet,
			parsed.isCited,
			parsed.isCited ? DEFAULT_CITED_SNIPPET : DEFAULT_UNCITED_SNIPPET,
		),
		citationUrl,
		fallbackToRuleScore,
		citedRank: parsed.rank,
	};
}

export function ruleScoreFor(engine: LiveCheckEngineId, ruleScores?: Partial<Record<LiveCheckEngineId, number>>): number {
	const value = ruleScores?.[engine];
	return clamp(typeof value === 'number' ? value : 0, 0, 100);
}
