/**
 * "4주 종합 Before → After 성장 비교표" 계산 로직.
 * 실제 저장된 스냅샷 페이로드(report/geoNarrative/pageSpeed)에서 다시 스코어를
 * 산출해, 화면에 보이는 다른 카드들과 절대 어긋나지 않도록 한다.
 */

import { buildDiagnosisScoreSnapshot, clampDiagnosisScore } from '@/lib/audit/diagnosis-scores';
import { resolveTrack3PerformanceScore } from '@/lib/audit/pagespeed';
import { exposureStatusFromScore } from '@/lib/geo/rating-meta';
import type { MilestoneSnapshotPayload } from '@/lib/audit/milestone-types';
import type { RoundSnapshot } from '@/lib/audit/round-tracking-types';
import type { AuditLang } from '@/lib/site-auditor';

export interface MilestoneRoundFacts {
	measuredScore: number;
	technicalScore: number;
	externalTrustScore: number;
	schemaCoverage: number;
	llmsTxtPassed: boolean;
	aiCitationTier: 'optimal' | 'partial' | 'poor';
	monthlyOpportunityLossKrw: number;
}

export function computeMilestoneRoundFacts(
	payload: MilestoneSnapshotPayload,
	lang: AuditLang = 'ko',
): MilestoneRoundFacts {
	const coreWebVitalsScore100 = resolveTrack3PerformanceScore({
		mobile: payload.pageSpeedMobile,
		desktop: payload.pageSpeedDesktop,
	});
	const scoreSnapshot = buildDiagnosisScoreSnapshot(payload.report, payload.geoNarrative, lang, {
		coreWebVitalsScore100,
	});
	const llmsTxtPassed = Boolean(
		payload.report.checklist?.find((item) => item.id === 'llmsTxt')?.passed,
	);
	return {
		measuredScore: scoreSnapshot.measuredScore,
		technicalScore: scoreSnapshot.technicalScore,
		externalTrustScore: scoreSnapshot.externalTrustScore,
		schemaCoverage: clampDiagnosisScore(payload.report.schemaCoverage ?? 0),
		llmsTxtPassed,
		aiCitationTier: exposureStatusFromScore(scoreSnapshot.externalTrustScore),
		monthlyOpportunityLossKrw: estimateMonthlyOpportunityLossKrw(scoreSnapshot.measuredScore),
	};
}

/**
 * `MilestoneSnapshotPayload`(전체 리포트) 없이도 동작하는 폴백 계산 — 다른 기기/
 * 캐시 정리 등으로 로컬 전체 캐시가 사라진 회차는 Firestore에서 받아온 경량
 * `roundSnapshot`만으로 Before/After 비교표를 근사 재현한다. 정확도는
 * `computeMilestoneRoundFacts`(전체 리포트 재계산)보다 낮을 수 있으나, 화면에
 * "데이터 없음"이 뜨는 것보다는 훨씨 낫다.
 */
export function roundFactsFromSnapshot(snapshot: RoundSnapshot): MilestoneRoundFacts {
	return {
		measuredScore: snapshot.scores.total,
		technicalScore: snapshot.scores.seo,
		externalTrustScore: snapshot.scores.aeo,
		schemaCoverage: snapshot.scores.schema,
		llmsTxtPassed: snapshot.metrics.hasLlmsTxt,
		aiCitationTier: exposureStatusFromScore(snapshot.scores.aeo),
		monthlyOpportunityLossKrw: estimateMonthlyOpportunityLossKrw(snapshot.scores.total),
	};
}

/**
 * 참고용 추정치 — 실제 매출 데이터가 아닌, GEO 프로 플랜 사례 평균(월 45만 원)을
 * 기준으로 한 단순 선형 보간이다. 점수 80 이상이면 "방어 완료"(0원), 50 이하면
 * "최대 손실 리스크"로 표시한다. UI에는 항상 "추정" 문구와 함께 노출해야 한다.
 */
const MAX_MONTHLY_OPPORTUNITY_LOSS_KRW = 450_000;
const LOSS_FLOOR_SCORE = 50;
const LOSS_CEIL_SCORE = 80;

export function estimateMonthlyOpportunityLossKrw(score: number): number {
	const s = clampDiagnosisScore(score);
	if (s <= LOSS_FLOOR_SCORE) return MAX_MONTHLY_OPPORTUNITY_LOSS_KRW;
	if (s >= LOSS_CEIL_SCORE) return 0;
	const ratio = (LOSS_CEIL_SCORE - s) / (LOSS_CEIL_SCORE - LOSS_FLOOR_SCORE);
	return Math.round((MAX_MONTHLY_OPPORTUNITY_LOSS_KRW * ratio) / 10_000) * 10_000;
}

export function formatKrw(amount: number): string {
	return `${amount.toLocaleString('ko-KR')}원`;
}

export const AI_CITATION_TIER_LABEL: Record<MilestoneRoundFacts['aiCitationTier'], string> = {
	optimal: '1순위 공식 출처 채택',
	partial: '후보군 포함 (부분 인용)',
	poor: '후보군 제외',
};
