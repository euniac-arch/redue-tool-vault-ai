/**
 * "4주 추이(1~4회차) 라이브박제" — Firestore `audit_tracking` 컬렉션에 영구 저장되는
 * 경량(lightweight) 스냅샷 스펙. 원시 DOM 텍스트, JSON-LD 풀 코퍼스, 체크리스트
 * 근거(evidence) 문장 등 대용량 필드는 전부 제외하고 점수 · 핵심 메트릭 플래그 ·
 * 타임스탬프만 담아 localStorage 5MB 한도/Firestore 문서 1MB 한도에 절대 걸리지
 * 않는 크기(수백 바이트~2KB)를 보장한다.
 *
 * 회차별 전체 리포트 재현(체크리스트/근거/GEO 내러티브 등)은 여전히 브라우저
 * localStorage 캐시(`milestone-storage.ts`)가 담당하며, 이 경량 스냅샷은 그 캐시가
 * 없거나 사라져도(다른 기기, 캐시 정리 등) 최소한 "점수 추이"만큼은 영구적으로
 * 안전하게 남도록 하는 durable fallback 저장소다.
 */

import { normalizeDomain } from '@/lib/audit/normalize-domain';

export const AUDIT_TRACKING_COLLECTION = 'audit_tracking';

/**
 * Firestore 문서 ID로 안전한 슬러그를 만든다.
 * 예: "https://misoclinic.com/" → "misoclinic-com"
 * 의도적으로 이 파일(순수 타입 + 트리비얼 유틸)에 두어, 서버 전용 모듈
 * (`lib/firebase/audit-tracking.ts`)이 점수 계산 의존성 그래프(`round-tracking.ts` →
 * `diagnosis-scores.ts` 등)를 불필요하게 끌어들이지 않도록 한다.
 */
export function sanitizeUrlToDocId(targetUrl: string): string {
	const domain = normalizeDomain(targetUrl);
	const slug = domain
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'unknown';
}

export type TrackingRound = 1 | 2 | 3 | 4;

export const TRACKING_ROUNDS: readonly TrackingRound[] = [1, 2, 3, 4] as const;

/** 회차 → 화면 표기 라벨. 예: "1회차 (D-0)". */
export const TRACKING_ROUND_LABEL: Record<TrackingRound, string> = {
	1: '1회차 (D-0)',
	2: '2회차 (D+7)',
	3: '3회차 (D+14)',
	4: '4회차 (D+28)',
};

/**
 * 경량 회차 스냅샷 — Firestore에 실제로 저장되는 단위.
 * 모든 필드는 원시 타입/문자열 배열이므로 직렬화 크기가 항상 예측 가능하고 작다.
 */
export interface RoundSnapshot {
	/** ISO 8601 타임스탬프 — 확정(박제)된 시점. */
	savedAt: string;
	/** 예: "1회차 (D-0)". */
	roundLabel: string;
	scores: {
		/** 종합 실측 점수 (0~100). */
		total: number;
		grade: string;
		/** 검색 기초 SEO 신호 (0~100). */
		seo: number;
		/** AI 인용/외부 신뢰도 — Answer Engine Optimization 신호 (0~100). */
		aeo: number;
		/** 4-pillar 종합 GEO 점수 (0~100). */
		geo: number;
		/** Schema.org 구조화 데이터 점수 (0~100). */
		schema: number;
	};
	metrics: {
		altCoverageRate: number;
		altMissingCount: number;
		hasLlmsTxt: boolean;
		hasFaqSchema: boolean;
		hasSpeakable: boolean;
		detectedSchemas: string[];
	};
	isLocked: boolean;
}

/** Firestore 문서 하나 = 도메인(대상 URL) 하나의 1~4회차 경량 히스토리. */
export interface AuditTrackingDoc {
	/** 정규화된 도메인/대상 URL. */
	domain: string;
	rounds: Partial<Record<TrackingRound, RoundSnapshot>>;
	/** 마지막 서버 반영 시각 (ISO). */
	updatedAt?: string;
}

export function emptyAuditTrackingDoc(domain: string): AuditTrackingDoc {
	return { domain, rounds: {} };
}

export function isTrackingRound(value: unknown): value is TrackingRound {
	return value === 1 || value === 2 || value === 3 || value === 4;
}
