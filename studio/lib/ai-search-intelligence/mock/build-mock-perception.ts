import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { applyAsiInfluence, extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { mentionFromScore, resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { hashSeed, mockScore } from '@/lib/ai-search-intelligence/mock/seed';
import type { AsiEngineId, AsiPerceptionAxisId, AsiPerceptionSnapshot } from '@/lib/ai-search-intelligence/types';
import { ASI_PERCEPTION_AXES } from '@/lib/ai-search-intelligence/types';

const ENGINES: readonly AsiEngineId[] = ['chatgpt', 'gemini', 'perplexity', 'claude'];

const AXIS_SALT: Record<AsiPerceptionAxisId, number> = {
	expertise: 51,
	local: 52,
	trust: 23,
	differentiation: 53,
	awareness: 54,
	recommendation: 21,
};

/**
 * Same host seed as War Room so Trust / Recommendation stay aligned.
 * Live adapter later returns this shape only.
 */
export function buildMockPerceptionSnapshot(input: {
	url: string;
	audit?: LatestAuditPayload | null;
}): AsiPerceptionSnapshot | null {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;

	const { site, boundFromAudit } = resolved;
	const seed = hashSeed(site.domain);
	const location = site.location || '지역';
	const category = site.category || '핵심 서비스';
	const brand = site.brandName;

	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const influence = bridge?.influence;
	const axes = Object.fromEntries(
		ASI_PERCEPTION_AXES.map((axis) => {
			const min = axis === 'trust' ? 36 : axis === 'recommendation' ? 18 : 24;
			const max = axis === 'trust' ? 78 : axis === 'recommendation' ? 64 : 84;
			let value = mockScore(seed, AXIS_SALT[axis], min, max);
			if (axis === 'trust') value = applyAsiInfluence(value, influence?.trust ?? 0);
			if (axis === 'local') value = applyAsiInfluence(value, influence?.local ?? 0);
			if (axis === 'recommendation') value = applyAsiInfluence(value, influence?.recommendation ?? 0);
			if (axis === 'expertise') value = applyAsiInfluence(value, influence?.perception ?? 0);
			return [axis, value];
		}),
	) as AsiPerceptionSnapshot['axes'];

	const currentNarrative = `${location}의 ${category} 사업체`;
	const targetNarrative = `${location}에서 ${category}를 중심으로 전문성을 보여주는 사업체`;

	return {
		source: bridge ? 'derived' : 'mock',
		analyzedAt: new Date().toISOString(),
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		site,
		trustScore: axes.trust,
		axes,
		understood: `${brand}은 ${location}에서 ${category}를 제공하는 로컬 사업체로 인식됩니다. 시그니처 서비스와 전문 포지션은 아직 약합니다.`,
		unknown: ['대표 서비스 엔티티', '전문 인력·자격 정보', '공식 예약/이용 범위'],
		confused: [
			`인근 동명 동종업체와 상호 혼동`,
			`${category} 일반 디렉터리 업체로 치환`,
			...(influence?.perception ? ['진단에서 브랜드 엔티티와 스키마 표기가 어긋난 신호'] : []),
		],
		currentNarrative,
		targetNarrative,
		gapNotes: ['시그니처 서비스명 누락', '전문성 포지션 부재', '핵심 서비스 중심 서술 없음'],
		engineNotes: ENGINES.map((engine, index) => {
			const value = mockScore(seed, 10 + index, 28, 86);
			const mentionType = mentionFromScore(value);
			const summary =
				mentionType === 'recommended'
					? `${location} ${category} 후보로 ${brand}를 꼽습니다.`
					: mentionType === 'simple_mention'
						? `${brand}를 지역 의원 목록에 넣지만 추천 이유는 비어 있습니다.`
						: `${brand} 대신 인근 경쟁 브랜드를 먼저 꺼냅니다.`;
			return { engine, summary, mentionType };
		}),
	};
}
