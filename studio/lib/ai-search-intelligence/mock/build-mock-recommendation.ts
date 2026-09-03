import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { applyAsiInfluence, extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { mentionFromScore, resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { hashSeed, mockScore } from '@/lib/ai-search-intelligence/mock/seed';
import { buildSearchSimulation } from '@/lib/ai-search-intelligence/recommendation/simulate';
import { withMockSovFields } from '@/lib/ai-search-intelligence/sov/overlay';
import { exampleSearchQuery } from '@/lib/ai-search-intelligence/target/query-pool';
import type {
	AIResponse,
	AsiCompetitorRow,
	AsiEngineRecommendResult,
	AsiRecommendRank,
	AsiRecommendationSnapshot,
	AsiSimulatorPenalty,
	AsiSovSlice,
} from '@/lib/ai-search-intelligence/types';
import { ASI_ENGINES } from '@/lib/ai-search-intelligence/types';

function rankFromScore(value: number): AsiRecommendRank {
	if (value >= 78) return 1;
	if (value >= 64) return 2;
	if (value >= 48) return 3;
	return null;
}

function clampShare(value: number): number {
	return Math.max(4, Math.min(62, value));
}


/**
 * Same host seed as War Room:
 * recommendationRate salt 21, SoV salt 22, competitor score salts 42/43/45/46/48/49.
 */
export function buildMockRecommendationSnapshot(input: {
	url: string;
	query?: string;
	audit?: LatestAuditPayload | null;
}): AsiRecommendationSnapshot | null {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;

	const { site, boundFromAudit } = resolved;
	const seed = hashSeed(site.domain);
	const location = site.location || '';
	const category = site.category || '';
	const brand = site.brandName;
	const contextPhrase = [location, category].filter(Boolean).join(' ') || brand;
	const defaultQuery = exampleSearchQuery({ brandName: brand, location, category, services: [] });
	const testQuery = (input.query || '').trim() || defaultQuery;
	const querySeed = hashSeed(`${site.domain}:${testQuery}`);

	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const potential = applyAsiInfluence(mockScore(seed, 21, 18, 64), bridge?.influence.recommendation ?? 0);
	const overallSov = mockScore(seed, 22, 8, 34);

	const testResults: AsiEngineRecommendResult[] = ASI_ENGINES.map((engine, index) => {
		const value = mockScore(querySeed, 10 + index, 28, 86);
		const mentionType = mentionFromScore(value);
		const rank = rankFromScore(value);
		const mentioned = mentionType !== 'none';
		return {
			engine,
			rank,
			mentioned,
			mentionType,
			reason: mentioned
				? `${contextPhrase} 맥락에서 공식 도메인과 지역 엔티티가 일부 읽혔습니다.`
				: `이 질문에서는 ${brand}보다 인근 경쟁 브랜드가 먼저 거론되는 것으로 추정됩니다.`,
			summary: mentioned
				? rank
					? `${brand}를 ${rank}순위권으로 언급하는 답변 패턴이 시뮬레이션됩니다.`
					: `${brand}는 언급되지만 추천 순위에는 오르지 않는 것으로 추정됩니다.`
				: `${brand}가 답변에 나타나지 않는 패턴으로 추정됩니다.`,
			source: 'mock',
			fallback: false,
		};
	});

	const remain = Math.max(8, 100 - potential);
	const raw = [61, 62, 63, 64, 65].map((salt) => mockScore(seed, salt, 8, 28));
	const rawSum = raw.reduce((sum, value) => sum + value, 0);
	const points = raw.map((value) => Math.max(4, Math.round((value / rawSum) * remain)));
	const drift = remain - points.reduce((sum, value) => sum + value, 0);
	points[0] = (points[0] ?? 0) + drift;

	const penalties: AsiSimulatorPenalty[] = [
		{ id: 'local_entity', points: points[0]!, detail: `${location || '지역'} 엔티티가 서비스명과 한 문장으로 묶이지 않습니다.` },
		{ id: 'expertise', points: points[1]!, detail: '전문성 증거가 FAQ·담당 인력 페이지에 부족합니다.' },
		{ id: 'third_party', points: points[2]!, detail: '제3자 후기·디렉터리가 추천 근거를 선점합니다.' },
		{ id: 'faq', points: points[3]!, detail: '추천형 질문에 대응하는 FAQ 구조가 얇습니다.' },
		{ id: 'content_structure', points: points[4]!, detail: '콘텐츠 계층이 엔진이 요약하기 어려운 형태입니다.' },
	];

	const secondaryQuery = category
		? location
			? `${location} 잘하는 ${category}`
			: `잘하는 ${category}`
		: `${brand} 관련 추천`;
	const queries = [defaultQuery, `${brand} 후기`, secondaryQuery];
	const byQuery: AsiSovSlice[] = queries.map((label, index) => {
		const brandShare = clampShare(overallSov + mockScore(seed, 70 + index, -6, 8));
		const competitorShare = clampShare(42 - Math.round(brandShare / 3) + index * 2);
		const otherShare = Math.max(8, 100 - brandShare - competitorShare);
		return { label, brandShare, competitorShare, otherShare };
	});

	const byEngine = ASI_ENGINES.map((engine, index) => {
		const brandShare = clampShare(overallSov + mockScore(seed, 80 + index, -5, 7));
		const competitorShare = clampShare(40 - Math.round(brandShare / 4));
		const otherShare = Math.max(8, 100 - brandShare - competitorShare);
		return { engine, label: engine, brandShare, competitorShare, otherShare };
	});

	const timeline = ['W-3', 'W-2', 'W-1', 'W0'].map((period, index) => ({
		period,
		brandShare: clampShare(overallSov - 6 + index * 2),
		competitorShare: clampShare(38 - index),
	}));

	const competitors: AsiCompetitorRow[] = [];
	const mockResponses: AIResponse[] = testResults.map((row) => ({
		provider: row.engine,
		query: testQuery,
		answer: row.summary,
		mentions: row.mentioned ? [brand] : [],
		recommendations: row.mentionType === 'recommended' ? [brand] : [],
		citations: [],
		confidence: 0.4,
		timestamp: new Date().toISOString(),
		source: 'mock',
	}));

	return {
		source: bridge ? 'derived' : 'mock',
		analyzedAt: new Date().toISOString(),
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		site,
		defaultQuery,
		testQuery,
		testResults,
		simulator: { potential, penalties },
		sov: withMockSovFields({ overall: overallSov, byQuery, byEngine, timeline }),
		competitors,
		observationState: 'NO_DATA',
		simulation: buildSearchSimulation({
			query: testQuery,
			site,
			responses: mockResponses,
		}),
	};
}
