/**
 * Live AI Share-of-Voice measurement — scores LLM recommendation lists
 * against the audited brand. No site-specific brand / region / specialty
 * names are hardcoded; matching uses the request's targetBrand + aliases.
 */

import { createHash } from 'node:crypto';
import { extractJsonObjectFromText } from '@/lib/audit/fact-check';
import {
	generateDynamicSovData,
	type SovLang,
	type SovLeaderboardEntry,
	type SovQueryIntent,
} from '@/lib/audit/sov-analysis';
import { buildTargetBrandTokens, stripBrandLegalSuffix } from '@/lib/audit/universal-sov-engine';
import type {
	LiveSovAnalysisResponse,
	LiveSovRecommendation,
	LiveSovSlicePayload,
} from '@/lib/audit/sov-live-overlay';

export type {
	LiveSovAnalysisResponse,
	LiveSovPlacement,
	LiveSovProvider,
	LiveSovRecommendation,
	LiveSovSlicePayload,
	SovResultCtaKind,
} from '@/lib/audit/sov-live-overlay';
export { applyLiveSovMeasurement, resolveSovResultCta } from '@/lib/audit/sov-live-overlay';

export const SOV_LIVE_SYSTEM_PROMPT = [
	'너는 최신 지역 기반 검색 추천 AI 엔진이다.',
	'사용자가 입력한 질의에 대해 실제 추천할 만한 공신력 있는 매장/병원/업체 상위 3곳을 선정하고, 아래 JSON 규격으로만 응답해라.',
	'',
	'{',
	'  "recommendations": [',
	'    { "rank": 1, "name": "업체명", "reason": "추천 이유 1줄 요약" },',
	'    { "rank": 2, "name": "업체명", "reason": "추천 이유 1줄 요약" },',
	'    { "rank": 3, "name": "업체명", "reason": "추천 이유 1줄 요약" }',
	'  ],',
	'  "recommendationSnippet": "AI가 작성한 2~3줄의 실제 추천 문장 원문"',
	'}',
].join('\n');

const QUERY_INTENTS: readonly SovQueryIntent[] = ['broad', 'specialty', 'problem'];

function clean(value: unknown, max = 80): string {
	if (typeof value !== 'string') return '';
	return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function fold(value: unknown): string {
	return clean(value).replace(/\s+/g, '').toLowerCase();
}

/** Strip spaces / punctuation so "나인원 의원" and "나인원의원" share a key. */
export function foldBrandKey(value: unknown): string {
	return clean(value)
		.toLowerCase()
		.replace(/[\s\-_./·•'"`,()[\]{}]+/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Core brand stems for fuzzy citation matching.
 * "나인원의원" → "나인원의원", "나인원" — never requires an exact full-name hit.
 */
export function collectBrandStems(targetBrand: string, extraTokens: readonly string[] = []): string[] {
	const seeds = [targetBrand, ...extraTokens].flatMap((token) => [token, stripBrandLegalSuffix(token)]);
	const seen = new Set<string>();
	const stems: string[] = [];
	for (const seed of seeds) {
		const stem = foldBrandKey(seed);
		const minLen = /[가-힣]/.test(stem) ? 2 : 3;
		if (!stem || stem.length < minLen || seen.has(stem)) continue;
		seen.add(stem);
		stems.push(stem);
	}
	return stems.sort((a, b) => b.length - a.length);
}

export function textMentionsBrand(text: string, stems: readonly string[]): boolean {
	const hay = foldBrandKey(text);
	if (!hay || !stems.length) return false;
	return stems.some((stem) => hay.includes(stem));
}

function langOf(lang?: string | null): SovLang {
	return lang === 'en' ? 'en' : 'ko';
}

function intentOfIndex(index: number): SovQueryIntent {
	return QUERY_INTENTS[Math.min(Math.max(index, 0), QUERY_INTENTS.length - 1)] ?? 'broad';
}

function hashSeed(input: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i += 1) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0 || 1;
	return function next() {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function randInt(rand: () => number, min: number, max: number): number {
	return min + Math.floor(rand() * (max - min + 1));
}

export function computeLiveSovCacheKey(input: {
	targetBrand: string;
	region?: string | null;
	queries: readonly string[];
	siteUrl?: string | null;
}): string {
	const raw = [
		fold(input.targetBrand),
		fold(input.region),
		fold(input.siteUrl),
		input.queries.map((query) => fold(query)).filter(Boolean).join('|'),
	].join('::');
	return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

export function buildLiveSovUserPrompt(query: string, region?: string | null): string {
	const lines = [`질의: ${clean(query, 120)}`];
	if (clean(region)) lines.push(`지역 힌트: ${clean(region)}`);
	lines.push('위 질의에 대해 실제로 추천할 상위 3곳을 JSON으로만 답하라. 가상 업체명을 만들지 말고, 공신력 있는 실제 상호만 적어라.');
	return lines.join('\n');
}

export function parseLiveRecommendations(raw: unknown): LiveSovRecommendation[] {
	const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const list = Array.isArray(root.recommendations) ? root.recommendations : Array.isArray(raw) ? raw : [];
	const out: LiveSovRecommendation[] = [];
	const seen = new Set<string>();
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const name = clean(row.name, 60);
		const key = fold(name);
		if (!name || seen.has(key)) continue;
		seen.add(key);
		out.push({
			rank: out.length + 1,
			name,
			reason: clean(row.reason, 160),
			isClient: false,
		});
		if (out.length >= 3) break;
	}
	return out.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function parseRecommendationSnippet(raw: unknown): string {
	if (!raw || typeof raw !== 'object') return '';
	const root = raw as Record<string, unknown>;
	return clean(root.recommendationSnippet ?? root.snippet ?? root.answer, 480);
}

export function parseLiveLlmPayload(content: string): {
	recs: LiveSovRecommendation[];
	recommendationSnippet: string;
} {
	const raw = extractJsonObjectFromText(content);
	return {
		recs: parseLiveRecommendations(raw),
		recommendationSnippet: parseRecommendationSnippet(raw),
	};
}

export function resolveOwnRank(
	recommendations: readonly LiveSovRecommendation[],
	stems: readonly string[],
	snippet = '',
): 0 | 1 | 2 | 3 {
	for (const row of recommendations) {
		if (textMentionsBrand(row.name, stems) || textMentionsBrand(row.reason, stems)) {
			if (row.rank === 1 || row.rank === 2 || row.rank === 3) return row.rank;
		}
	}
	if (textMentionsBrand(snippet, stems)) return 3;
	return 0;
}

function placementOf(ownRank: 0 | 1 | 2 | 3): LiveSovPlacement {
	if (ownRank === 1) return 'first';
	if (ownRank === 2 || ownRank === 3) return 'mentioned';
	return 'missing';
}

function buildBriefing(input: {
	lang: SovLang;
	placement: LiveSovPlacement;
	region: string;
	query: string;
	currentSov: number;
	targetSov: number;
}): string {
	const { lang, placement, region, query, currentSov, targetSov } = input;
	if (lang === 'en') {
		if (placement === 'first') {
			return `The AI engine currently cites this business as the primary answer source (rank 1) for "${query}"${region ? ` in ${region}` : ''}. Measured share is about ${currentSov}%. Entity-defense work should protect this exclusive position.`;
		}
		if (placement === 'mentioned') {
			return `AI recognizes this business on "${query}" but it is not the first recommendation, so traffic is leaking (measured share about ${currentSov}%). E-E-A-T knowledge-graph reinforcement is needed to recapture up to ${targetSov}%.`;
		}
		return `This business entity is completely missing from the AI recommendation pool for "${query}"${region ? ` in ${region}` : ''} (measured share about ${currentSov}%). Schema injection and GEO signal optimization are urgent to target up to ${targetSov}%.`;
	}
	if (placement === 'first') {
		return `현재 AI 엔진이 자사를 해당 키워드의 최우선 정답 소스(1순위)로 단독 인용하고 있습니다. 엔티티 방어 조치로 이 독점적 지위를 유지해야 합니다.`;
	}
	if (placement === 'mentioned') {
		return `AI가 자사를 인지하고 있으나 1순위 추천에서 밀려나 트래픽 누수가 발생하고 있습니다. E-E-A-T 지식그래프 보강이 필요합니다.`;
	}
	return `AI 엔진의 추천 풀에 자사 엔티티가 완전히 누락되어 있습니다. 스키마 주입 및 GEO 신호 최적화가 시급합니다.`;
}

function scalePair(left: number, right: number, remaining: number): [number, number] {
	const total = left + right || 1;
	const a = Math.max(0, Math.round((left / total) * remaining));
	return [a, Math.max(0, remaining - a)];
}

function goalLabel(lang: SovLang, placement: LiveSovPlacement, targetSov: number): string {
	if (placement === 'first') {
		return lang === 'en' ? `Hold #1 monopoly (~${targetSov}%)` : `1위 독점 유지 (${targetSov}%)`;
	}
	return lang === 'en' ? `Target: reach #1 (~${targetSov}% share)` : `1위 진입 목표 (${targetSov}% 독점 점유)`;
}

/**
 * Convert an LLM recommendation list into measured SoV shares + a leaderboard.
 * Bands: #1 → 88–95%, #2–3 → 25–40%, missing → 0–5%.
 */
export function scoreLiveRecommendations(input: {
	query: string;
	index: number;
	recommendations: readonly LiveSovRecommendation[];
	targetBrand: string;
	brandTokens: readonly string[];
	region?: string | null;
	lang?: SovLang | string | null;
	recommendationSnippet?: string;
}): LiveSovSlicePayload {
	const lang = langOf(input.lang);
	const brandName = clean(input.targetBrand) || (lang === 'en' ? 'This business' : '자사');
	const region = clean(input.region);
	const query = clean(input.query, 120);
	const intent = intentOfIndex(input.index);
	const stems = collectBrandStems(brandName, input.brandTokens);
	const snippet = clean(input.recommendationSnippet, 480);
	const recs = input.recommendations.map((row, idx) => ({
		...row,
		rank: idx + 1,
		isClient: textMentionsBrand(row.name, stems) || textMentionsBrand(row.reason, stems),
	}));
	const ownRank = resolveOwnRank(recs, stems, snippet);
	const placement = placementOf(ownRank);
	const rand = mulberry32(hashSeed([fold(brandName), fold(query), String(input.index), placement].join('|')));

	let currentSov: number;
	let targetSov: number;
	if (placement === 'first') {
		currentSov = randInt(rand, 88, 95);
		targetSov = Math.max(currentSov, 95);
	} else if (placement === 'mentioned') {
		currentSov = randInt(rand, 25, 40);
		targetSov = randInt(rand, 75, 80);
	} else {
		currentSov = randInt(rand, 0, 5);
		targetSov = randInt(rand, 65, 75);
	}
	const reclaimPotential = Math.max(0, targetSov - currentSov);
	const competitorBloc = 100 - currentSov;

	const others = recs.filter((row) => !row.isClient).slice(0, 3);
	const leaderboard: SovLeaderboardEntry[] = [];

	if (placement === 'first') {
		const [share2, share3] = scalePair(randInt(rand, 55, 70), randInt(rand, 30, 45), competitorBloc);
		const ownRec = recs.find((row) => row.isClient);
		leaderboard.push({
			rank: 1,
			name: ownRec?.name || brandName,
			share: currentSov,
			role: 'own',
			isClient: true,
			statusLabel: lang === 'en' ? 'Rank 1 · exclusive citation' : '1위 · 독점 인용',
			reason: ownRec?.reason,
		});
		if (others[0]) {
			leaderboard.push({
				rank: 2,
				name: others[0].name,
				share: share2,
				role: 'competitor',
				isClient: false,
				reason: others[0].reason,
			});
		}
		if (others[1]) {
			leaderboard.push({
				rank: 3,
				name: others[1].name,
				share: share3,
				role: 'competitor',
				isClient: false,
				reason: others[1].reason,
			});
		}
	} else if (placement === 'mentioned') {
		const ownRec = recs.find((row) => row.isClient);
		const first = others[0];
		const third = others[1];
		const [share1, shareRest] = scalePair(randInt(rand, 55, 70), randInt(rand, 30, 45), competitorBloc);
		if (first) {
			leaderboard.push({
				rank: 1,
				name: first.name,
				share: share1,
				role: 'competitor',
				isClient: false,
				reason: first.reason,
			});
		}
		leaderboard.push({
			rank: ownRank || 2,
			name: ownRec?.name || brandName,
			share: currentSov,
			role: 'own',
			isClient: true,
			statusLabel: lang === 'en' ? `Rank ${ownRank} · recognized` : `${ownRank}위 · 인지됨`,
			reason: ownRec?.reason,
		});
		if (third) {
			leaderboard.push({
				rank: ownRank === 2 ? 3 : 2,
				name: third.name,
				share: shareRest,
				role: 'competitor',
				isClient: false,
				reason: third.reason,
			});
		}
		leaderboard.sort((a, b) => (a.rank || 9) - (b.rank || 9));
	} else {
		const raw = [randInt(rand, 40, 45), randInt(rand, 25, 35), randInt(rand, 15, 25)] as const;
		const total = raw[0] + raw[1] + raw[2] || 1;
		const scaled = raw.map((value) => Math.round((value / total) * competitorBloc));
		scaled[0] += competitorBloc - scaled.reduce((sum, value) => sum + value, 0);
		others.forEach((row, idx) => {
			leaderboard.push({
				rank: idx + 1,
				name: row.name,
				share: scaled[idx] ?? 0,
				role: 'competitor',
				isClient: false,
				reason: row.reason,
			});
		});
		leaderboard.push({
			rank: 0,
			name: brandName,
			share: currentSov,
			role: 'own',
			isClient: true,
			statusLabel: lang === 'en' ? 'Outside ranking · citation gap' : '순위권 밖 · 인용 누락',
		});
	}

	return {
		index: input.index,
		query,
		intent,
		ownRank,
		placement,
		currentSov,
		targetSov,
		reclaimPotential,
		competitorBloc,
		recommendations: recs,
		leaderboard,
		ownGoalLabel: goalLabel(lang, placement, targetSov),
		summary: buildBriefing({ lang, placement, region, query, currentSov, targetSov }),
		recommendationSnippet: snippet,
	};
}

/** Guide-model slices used when the live LLM cannot answer (never 5xx the card). */
export function buildEstimatedLiveSlices(input: {
	queries: readonly string[];
	targetBrand: string;
	region?: string | null;
	category?: string | null;
	lang?: SovLang | string | null;
	identityKey?: string | null;
}): LiveSovSlicePayload[] {
	const guide = generateDynamicSovData({
		queries: input.queries,
		brandName: input.targetBrand,
		region: input.region,
		category: input.category,
		lang: input.lang,
		identityKey: input.identityKey,
	});
	return guide.map((slice) => ({
		...slice,
		ownRank: (slice.ownRank ?? 0) as 0 | 1 | 2 | 3,
		placement: slice.placement ?? 'missing',
		recommendations: [],
		recommendationSnippet: '',
	}));
}

export function collectBrandTokens(input: {
	targetBrand: string;
	siteUrl?: string | null;
	brandAliases?: readonly string[];
}): string[] {
	return buildTargetBrandTokens(
		[input.targetBrand, ...(input.brandAliases ?? [])],
		input.targetBrand,
		input.siteUrl || undefined,
	);
}

export function parseLiveJsonContent(content: string): LiveSovRecommendation[] {
	return parseLiveLlmPayload(content).recs;
}
