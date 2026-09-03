/**
 * Perception axes are DERIVED from observed answers. Never mockScore here.
 */
import { extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { analyzeAsiAnswer } from '@/lib/ai-search-intelligence/core/analysis';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { unwrapAsiAnswerText } from '@/lib/ai-search-intelligence/providers/normalize';
import { isUsableAsiResponse } from '@/lib/ai-search-intelligence/sov/extract';
import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import {
	ASI_ENGINES,
	ASI_PERCEPTION_AXES,
	type AIResponse,
	type AsiMentionType,
	type AsiPerceptionSnapshot,
	type AsiWarRoomSite,
} from '@/lib/ai-search-intelligence/types';

function pct(part: number, total: number): number {
	if (total <= 0) return 0;
	return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function textHasToken(text: string, token?: string): boolean {
	const needle = (token || '').trim();
	return needle.length >= 2 && text.includes(needle);
}

function mentionTypeOf(recommended: boolean, mentioned: boolean): AsiMentionType {
	if (recommended) return 'recommended';
	if (mentioned) return 'simple_mention';
	return 'none';
}

export function buildPerceptionSnapshotFromResponses(input: {
	site: AsiWarRoomSite;
	responses: readonly AIResponse[];
	boundFromAudit: boolean;
	audit?: LatestAuditPayload | null;
	aliases: readonly string[];
}): AsiPerceptionSnapshot {
	const { site, responses, boundFromAudit, aliases } = input;
	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const usable = responses.filter(isUsableAsiResponse);
	const rows = usable.map((response) => ({
		response,
		analysis: analyzeAsiAnswer(response, { brand: site.brandName, aliases }),
	}));
	const n = rows.length;
	const scored = rows.map((row) => ({
		...row,
		text: unwrapAsiAnswerText(row.response.answer || ''),
	}));
	const mentioned = scored.filter((row) => row.analysis.brandMentioned).length;
	const recommended = scored.filter((row) => row.analysis.recommended).length;
	const first = scored.filter((row) => row.analysis.rank === 1).length;
	const midRank = scored.filter((row) => row.analysis.rank === 2 || row.analysis.rank === 3).length;
	const localHits = scored.filter(
		(row) => row.analysis.brandMentioned && textHasToken(row.text, site.location),
	).length;
	const categoryHits = scored.filter(
		(row) => row.analysis.brandMentioned && textHasToken(row.text, site.category),
	).length;
	const citedHits = scored.filter(
		(row) => row.analysis.brandMentioned && row.analysis.citations.length > 0,
	).length;

	const awareness = pct(mentioned, n);
	const recommendation = pct(recommended, n);
	const expertise = pct(recommended * 2 + categoryHits, n * 3);
	const trust = pct(citedHits * 2 + recommended + mentioned, n * 4);
	const local = site.location ? pct(localHits, n) : 0;
	const differentiation = pct(first * 2 + recommended - midRank, n * 3);
	const axes = {
		expertise,
		trust,
		local,
		differentiation,
		recommendation,
		awareness,
	} as AsiPerceptionSnapshot['axes'];
	const trustScore = Math.round(
		awareness * 0.15 +
			recommendation * 0.2 +
			expertise * 0.2 +
			local * 0.15 +
			trust * 0.2 +
			differentiation * 0.1,
	);

	const liveUsable = usable.some((item) => item.source === 'live');
	const liveAttempt = responses.some((item) => item.source === 'live');
	const fallback = responses.some((item) => item.source === 'fallback');
	const source = liveUsable || liveAttempt ? 'live' : fallback ? 'fallback' : bridge ? 'derived' : 'mock';

	const location = site.location || '지역';
	const category = site.category || '서비스';
	const brand = site.brandName;
	const understood = n
		? recommended
			? `${brand}은 ${location} ${category} 답변에서 추천 후보로 읽힙니다.`
			: mentioned
				? `${brand}은 답변에 이름이 나오지만 추천 이유는 약합니다.`
				: `${brand}은 이번 질의에서 엔진 답변에 거의 나타나지 않습니다.`
		: `${brand}에 대한 관측 가능한 AI 답변이 없습니다.`;

	return {
		source,
		analyzedAt: new Date().toISOString(),
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		site,
		trustScore,
		axes,
		understood,
		unknown: n
			? [
					...(mentioned ? [] : ['브랜드 엔티티 언급']),
					...(recommended ? [] : ['추천 이유']),
					'공식 예약/진료 범위',
				].slice(0, 3)
			: ['관측된 AI 답변', '브랜드 언급', '추천 근거'],
		confused: n && !mentioned ? [`인근 동명 브랜드와 혼동`, `${category} 일반 목록으로 치환`] : [],
		currentNarrative: `${location}의 ${category}`,
		targetNarrative: `${location}에서 ${category}를 제공하는 ${brand}`,
		gapNotes: ASI_PERCEPTION_AXES.filter((axis) => axes[axis] < 40).map((axis) => `${axis} 신호가 약함`),
		engineNotes: ASI_ENGINES.map((engine) => {
			const row = responses.find((item) => item.provider === engine);
			if (!row) return { engine, summary: '응답 없음', mentionType: 'none' as const };
			if (row.meta?.error) {
				return { engine, summary: `Provider 오류: ${row.meta.error}`, mentionType: 'none' as const };
			}
			const analysis = analyzeAsiAnswer(row, { brand, aliases });
			const mentionType = mentionTypeOf(analysis.recommended, analysis.brandMentioned);
			const answerText = unwrapAsiAnswerText(row.answer);
			const summary = answerText
				? answerText.slice(0, 180)
				: mentionType === 'none'
					? `${brand}가 답변에 없습니다.`
					: `${brand} 언급만 확인됐습니다.`;
			return { engine, summary, mentionType };
		}),
	};
}

export function aliasesForBrand(brand: string, domain: string): string[] {
	const host = domain.split('.')[0] || '';
	return [brand, host].filter(Boolean);
}

export function resolvePerceptionSite(input: { url: string; audit?: LatestAuditPayload | null }) {
	return resolveAsiMockSite(input);
}
