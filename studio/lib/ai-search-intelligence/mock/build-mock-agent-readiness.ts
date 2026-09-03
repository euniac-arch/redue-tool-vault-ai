import type { LatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { applyAsiInfluence, extractAsiAuditBridge, toAsiAuditBind } from '@/lib/ai-search-intelligence/audit-bridge';
import { resolveAsiMockSite } from '@/lib/ai-search-intelligence/mock/resolve-site';
import { hashSeed, mockScore } from '@/lib/ai-search-intelligence/mock/seed';
import {
	ASI_READINESS_CRITERIA,
	type AsiAgentReadinessSnapshot,
	type AsiReadinessCriterion,
	type AsiReadinessItem,
	type AsiReadinessStatus,
} from '@/lib/ai-search-intelligence/types';

function statusFromScore(score: number): AsiReadinessStatus {
	if (score >= 70) return 'ready';
	if (score >= 42) return 'partial';
	return 'gap';
}

const COPY: Record<AsiReadinessCriterion, Record<AsiReadinessStatus, { issue: string; fix: string }>> = {
	business_info: {
		ready: {
			issue: '브랜드·상호가 페이지마다 같은 이름으로 읽히는 편입니다.',
			fix: '공식 상호와 별칭을 한 곳에 모아 두면 Agent가 엔티티를 더 쉽게 맞춥니다.',
		},
		partial: {
			issue: '상호와 서비스명이 페이지마다 조금씩 다르게 보입니다.',
			fix: '헤더·푸터·스키마에 동일한 공식 상호를 쓰고, 별칭은 보조로만 적으세요.',
		},
		gap: {
			issue: '사업자·브랜드를 한 줄로 확정할 정보가 부족해 보입니다.',
			fix: '공식 상호, 업종, 한 줄 소개를 홈과 About에 같은 문장으로 두세요.',
		},
	},
	location: {
		ready: {
			issue: '지역·주소 신호가 비교적 분명합니다.',
			fix: '도로명 주소와 지도 링크를 함께 두면 지역 질의에서 읽기 쉽습니다.',
		},
		partial: {
			issue: '지역 키워드는 있으나 정확한 주소 슬롯이 약합니다.',
			fix: '시·구와 도로명 주소를 본문과 LocalBusiness에 같이 적으세요.',
		},
		gap: {
			issue: '위치 정보가 흩어져 있어 Agent가 방문지를 확정하기 어렵습니다.',
			fix: '주소, 지도, 주차 안내를 한 블록으로 모으세요.',
		},
	},
	opening_hours: {
		ready: {
			issue: '영업 시간 정보가 읽히기 쉬운 형태로 있습니다.',
			fix: '요일별 시간과 휴무일을 같은 형식으로 유지하세요.',
		},
		partial: {
			issue: '영업 시간이 페이지마다 다르거나 요일 단위가 빠집니다.',
			fix: '월–일 표와 공휴일 예외를 한 표로 통일하세요.',
		},
		gap: {
			issue: '영업 시간을 구조적으로 찾기 어렵습니다.',
			fix: '연락처 옆에 요일별 시간을 표로 두고 openingHours도 맞추세요.',
		},
	},
	service_info: {
		ready: {
			issue: '핵심 서비스가 목록으로 읽히는 편입니다.',
			fix: '서비스별 대상·효과를 짧은 정의로 유지하세요.',
		},
		partial: {
			issue: '서비스명이 마케팅 문구와 섞여 범위가 흐립니다.',
			fix: '서비스 페이지마다 한 줄 정의와 대상 고객을 먼저 적으세요.',
		},
		gap: {
			issue: '무엇을 제공하는지 Agent가 항목으로 분해하기 어렵습니다.',
			fix: '3–7개 핵심 서비스를 이름·대상·결과 형식으로 나열하세요.',
		},
	},
	pricing: {
		ready: {
			issue: '가격 또는 가격대 신호가 있습니다.',
			fix: '범위·조건·별도 비용을 같은 표에 유지하세요.',
		},
		partial: {
			issue: '가격이 ‘상담 후 안내’에만 머물러 비교가 어렵습니다.',
			fix: '시작가·범위·포함/불포함을 공개할 수 있는 한도에서 표로 두세요.',
		},
		gap: {
			issue: '가격 정보가 거의 없어 비용 질의에 답할 구조가 없습니다.',
			fix: '대표 서비스의 시작가 또는 범위만이라도 고정 페이지에 두세요.',
		},
	},
	booking: {
		ready: {
			issue: '예약·상담 경로가 비교적 분명합니다.',
			fix: '예약 CTA의 목적지(폼/전화/링크)를 한 곳으로 유지하세요.',
		},
		partial: {
			issue: '예약 버튼은 있으나 단계나 필요 정보가 불명확합니다.',
			fix: '예약에 필요한 항목(날짜·서비스·연락처)을 한 페이지에 모으세요.',
		},
		gap: {
			issue: '예약을 시작하는 경로가 흩어져 있거나 없습니다.',
			fix: '상담 예약 버튼을 헤더와 서비스 페이지에 동일 링크로 두세요.',
		},
	},
	contact: {
		ready: {
			issue: '연락 채널이 찾기 쉬운 편입니다.',
			fix: '전화·이메일·채널을 푸터와 연락처 페이지에 동일하게 두세요.',
		},
		partial: {
			issue: '연락 수단이 채널마다 다르거나 형식이 깨져 있습니다.',
			fix: '대표번호와 이메일을 tel/mailto와 함께 고정하세요.',
		},
		gap: {
			issue: '연락처를 확정할 수 있는 신호가 부족합니다.',
			fix: '전화, 이메일, 카카오/폼 중 실제 응답 가능한 채널을 명시하세요.',
		},
	},
	faq: {
		ready: {
			issue: '자주 묻는 질문이 답변과 함께 있습니다.',
			fix: '예약·가격·준비물 FAQ를 서비스별로 유지하세요.',
		},
		partial: {
			issue: 'FAQ가 짧거나 실제 질문 형태가 아닙니다.',
			fix: '사용자가 묻는 문장형 질문과 2–4문장 답을 쌍으로 두세요.',
		},
		gap: {
			issue: '질문–답 구조가 없어 Agent가 재사용할 슬롯이 없습니다.',
			fix: '예약, 비용, 소요 시간, 주의사항을 FAQ로 먼저 채우세요.',
		},
	},
	structured_data: {
		ready: {
			issue: '구조화 데이터 신호가 읽히는 편입니다.',
			fix: 'Organization/LocalBusiness와 서비스 타입이 서로 모순되지 않게 유지하세요.',
		},
		partial: {
			issue: '스키마가 일부만 있거나 본문과 값이 어긋납니다.',
			fix: '상호·주소·전화·영업시간을 본문과 JSON-LD에 같게 맞추세요.',
		},
		gap: {
			issue: 'Agent가 필드를 채울 구조화 데이터가 약합니다.',
			fix: 'LocalBusiness 또는 Organization을 홈에 두고 필수 필드를 채우세요.',
		},
	},
	entity_consistency: {
		ready: {
			issue: '브랜드 표기가 채널 간에 비교적 일정합니다.',
			fix: '공식 표기를 네이버/구글/스키마에도 같은 철자로 유지하세요.',
		},
		partial: {
			issue: '영문·한글·약칭이 혼용되어 엔티티가 갈라질 수 있습니다.',
			fix: '공식 한글명과 영문명을 정하고 나머지는 alternateName으로만 쓰세요.',
		},
		gap: {
			issue: '같은 브랜드로 묶기 어려운 표기 차이가 있습니다.',
			fix: '홈, 지도, SNS 표시명을 한 공식명으로 맞추세요.',
		},
	},
	trust_signals: {
		ready: {
			issue: '후기·자격·운영 주체 신호가 일부 있습니다.',
			fix: '출처가 있는 후기와 자격 정보를 날짜와 함께 유지하세요.',
		},
		partial: {
			issue: '신뢰 신호가 광고 문구에 가려 검증 정보가 약합니다.',
			fix: '의료진/운영 주체, 후기 출처, 인증을 별도 섹션으로 분리하세요.',
		},
		gap: {
			issue: '제3자 또는 검증 가능한 신뢰 신호가 거의 없습니다.',
			fix: '실명 후기, 자격, 언론/디렉터리 언급을 출처와 함께 연결하세요.',
		},
	},
};

export function buildMockAgentReadinessSnapshot(input: {
	url: string;
	audit?: LatestAuditPayload | null;
}): AsiAgentReadinessSnapshot | null {
	const resolved = resolveAsiMockSite(input);
	if (!resolved) return null;
	const { site, boundFromAudit } = resolved;
	const seed = hashSeed(site.domain);
	const bridge = extractAsiAuditBridge(input.audit, site.url);
	const influence = bridge?.influence;
	const overall = applyAsiInfluence(mockScore(seed, 24, 22, 71), influence?.readiness ?? 0);

	const items: AsiReadinessItem[] = ASI_READINESS_CRITERIA.map((id, index) => {
		let score = mockScore(seed, 30 + index, 18, 88);
		if (boundFromAudit && id === 'location' && site.location) {
			score = Math.max(score, 64);
		}
		if (boundFromAudit && id === 'service_info' && site.category) {
			score = Math.max(score, 60);
		}
		if (id === 'faq') score = applyAsiInfluence(score, influence?.recommendation ?? 0);
		if (id === 'structured_data') score = applyAsiInfluence(score, influence?.trust ?? 0);
		if (id === 'location') score = applyAsiInfluence(score, influence?.local ?? 0);
		if (id === 'entity_consistency') score = applyAsiInfluence(score, influence?.perception ?? 0);
		if (id === 'trust_signals') score = applyAsiInfluence(score, influence?.citation ?? 0);
		const status = statusFromScore(score);
		const copy = COPY[id][status];
		return { id, score, status, issue: copy.issue, fix: copy.fix };
	});

	const statusCounts = items.reduce(
		(acc, item) => {
			acc[item.status] += 1;
			return acc;
		},
		{ ready: 0, partial: 0, gap: 0 } satisfies Record<AsiReadinessStatus, number>,
	);

	return {
		source: bridge ? 'derived' : 'mock',
		analyzedAt: new Date().toISOString(),
		boundFromAudit,
		auditBind: toAsiAuditBind(bridge),
		site,
		overall,
		items,
		statusCounts,
	};
}
