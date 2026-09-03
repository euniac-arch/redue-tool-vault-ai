import { attachAsiLoop } from '@/lib/ai-search-intelligence/loop/compose';
import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { applyAsiInfluence, extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { mentionFromScore, resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { hashSeed, mockScore } from '@/lib/ai-search-intelligence/mock/seed';
import type { AsiEngineId, AsiWarRoomSnapshot } from '@/lib/ai-search-intelligence/types';

const ENGINES: readonly AsiEngineId[] = ['chatgpt', 'gemini', 'perplexity', 'claude'];

/**
 * Deterministic mock snapshot so the same URL always paints the same board.
 * Live adapter in STEP 10 must return this same shape.
 */
export function buildMockWarRoomSnapshot(input: {
	url: string;
	audit?: LatestAuditPayload | null;
}): AsiWarRoomSnapshot | null {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const { url, brandName, domain, location, category } = site;
	const seed = hashSeed(domain);

	const engines = ENGINES.map((engine, index) => {
		const value = mockScore(seed, 10 + index, 28, 86);
		return { engine, score: value, mentionType: mentionFromScore(value) };
	});
	const visibility = Math.round(engines.reduce((sum, item) => sum + item.score, 0) / engines.length);
	const bridge = extractAsiAuditBridge(input.audit, url);
	const influence = bridge?.influence;
	const recommendationRate = applyAsiInfluence(mockScore(seed, 21, 18, 64), influence?.recommendation ?? 0);
	const shareOfVoice = mockScore(seed, 22, 8, 34);
	const trustScore = applyAsiInfluence(mockScore(seed, 23, 36, 78), influence?.trust ?? 0);
	const agentReadiness = applyAsiInfluence(mockScore(seed, 24, 22, 71), influence?.readiness ?? 0);

	const localNoun = location ? `${location} ` : '';
	const categoryNoun = category || '업체';

	return attachAsiLoop({
		source: bridge ? 'derived' : 'mock',
		analyzedAt: new Date().toISOString(),
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		site: { url, brandName, domain, location, category },
		visibility: { overall: visibility, engines },
		kpis: {
			visibility,
			recommendationRate,
			shareOfVoice,
			trustScore,
			agentReadiness,
		},
		today: {
			rising: [`${brandName} 브랜드 별칭 인식`, '공식 도메인 인용 가능성'],
			falling: [`${localNoun}${categoryNoun} 추천 쿼리 점유`],
			caution: ['제3자 후기 페이지가 엔진 답변을 선점', 'llms.txt / 에이전트 읽기 경로 부재'],
		},
		blockers: [
			{
				id: 'no-recommend',
				title: '추천 쿼리에서 1순위로 선택되지 않음',
				detail: `“${localNoun}${categoryNoun} 추천”류 질문에 경쟁 브랜드가 먼저 거론됩니다.`,
				href: '/intelligence/recommendation-test',
			},
			{
				id: 'thin-entity',
				title: '브랜드 엔티티가 엔진마다 다르게 읽힘',
				detail: '상호·도메인·별칭이 한 개체로 묶이지 않아 단순 언급에 그칩니다.',
				href: '/intelligence/brand-perception',
			},
			{
				id: 'third-party-cite',
				title: '인용이 공식 페이지가 아닌 디렉터리에 치우침',
				detail: '엔진이 후기·맵 플랫폼을 근거로 쓰고, 자사 페이지는 거의 꺼내지 않습니다.',
				href: '/intelligence/citation-explorer',
			},
			{
				id: 'agent-gap',
				title: '에이전트가 읽을 요약 파일이 없음',
				detail: 'llms.txt와 핵심 스키마가 비어 있어 Agent Readiness가 낮습니다.',
				href: '/intelligence/agent-readiness',
			},
		],
		opportunities: [
			{
				id: 'query-cluster',
				title: `${localNoun}${categoryNoun} 추천 클러스터`,
				detail: 'Level 2–3 질문만 맞춰도 추천률을 가장 크게 올릴 수 있는 구간입니다.',
				impact: mockScore(seed, 31, 62, 88),
				href: '/intelligence/query-generator',
			},
			{
				id: 'owned-cite',
				title: '공식 출처 재인용',
				detail: '자사 FAQ·의료진 페이지를 엔진이 다시 집어가게 만들면 Trust가 같이 움직입니다.',
				impact: mockScore(seed, 32, 54, 80),
				href: '/intelligence/citation-explorer',
			},
		],
		competitors: [],
		observationState: 'NO_DATA',
		validResponseCount: 0,
		queries: [
			{
				query: `${localNoun}${categoryNoun} 추천`,
				recommended: recommendationRate >= 50,
				winner: recommendationRate >= 50 ? brandName : '경쟁 브랜드',
			},
			{
				query: `${brandName} 후기`,
				recommended: true,
				winner: brandName,
			},
			{
				query: `${localNoun}잘하는 ${categoryNoun}`,
				recommended: false,
				winner: '경쟁 브랜드',
			},
			{
				query: `${categoryNoun} 비용`,
				recommended: mentionFromScore(engines[0]!.score) !== 'none',
				winner: mentionFromScore(engines[0]!.score) !== 'none' ? brandName : '제3자 매체',
			},
		],
		citations: [
			{
				title: `${brandName} 공식 홈`,
				url,
				ownership: 'owned',
			},
			{
				title: `${localNoun}${categoryNoun} 후기 모음`,
				url: 'https://blog.naver.com/example-review',
				ownership: 'unbranded_third_party',
			},
			{
				title: `${brandName} 소개 기사`,
				url: 'https://example.com/brand-feature',
				ownership: 'brand_earned',
			},
		],
	});
}
