/**
 * "4주 집중 마일스톤" (GEO 프로 플랜) — 회차별(1~4) 원클릭 리포트 박제(Lock) 시스템.
 *
 * 하나의 도메인은 최대 4개의 확정(박제) 스냅샷 + 1개의 라이브(실시간) 뷰를 가진다.
 * `MilestoneSnapshot.data`는 명세상 `any`(해당 시점의 실측 진단 전체 JSON)이지만,
 * 내부적으로는 항상 `MilestoneSnapshotPayload` 형태로 채워 넣어 타입 안전성을 확보한다.
 *
 * 저장 계층은 두 겹으로 분리되어 있다 (하이브리드 구조):
 *  - `roundSnapshot` (경량, 항상 존재) — Firestore `audit_tracking` 컬렉션에 영구
 *    저장되는 durable 트렌드 레코드. 용량이 작아(수백 바이트~2KB) 거의 실패하지 않는다.
 *  - `data` (전체, 브라우저 로컬 캐시 전용, 없을 수 있음) — localStorage 용량 부족 등으로
 *    사라질 수 있는 "회차 전체 리포트 재현"용 원본. 없으면 UI는 `roundSnapshot` 기반
 *    요약 카드로 우아하게 폴백한다.
 */

import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import type { RoundSnapshot } from '@/lib/audit/round-tracking-types';
import type { AuditReport } from '@/lib/site-auditor';

export type MilestoneRound = 1 | 2 | 3 | 4;
export type MilestoneActiveRound = MilestoneRound | 'LIVE';

export const MILESTONE_ROUNDS: readonly MilestoneRound[] = [1, 2, 3, 4] as const;

/** 회차 박제 시점에 실측 진단 전체 상태를 그대로 냉동 보관하기 위한 페이로드. */
export interface MilestoneSnapshotPayload {
	report: AuditReport;
	geoNarrative: GeoNarrativeReport | null;
	pageSpeed: PageSpeedSnapshot | null;
	pageSpeedDesktop: PageSpeedSnapshot | null;
	pageSpeedMobile: PageSpeedSnapshot | null;
	/** 박제 시점에 계산해 둔 종합 실측 점수 — 탭 배지에 즉시 사용. */
	measuredScore: number;
	grade?: string;
}

export interface MilestoneSnapshot {
	round: MilestoneRound;
	/** 예: "1회차 · 착수 사전 진단 (D-0)" */
	title: string;
	/** "2026-08-25" — 화면 표기용 날짜. */
	date: string;
	/** 박제(확정) 순간의 정밀 타임스탬프(ISO 8601) — 로컬/원격 병합 시 최신 판단 기준. */
	lockedAt: string;
	/** 박제 완료 여부 */
	isLocked: boolean;
	/**
	 * 경량 트렌드 요약 — Firestore에 영구 저장되는 값과 동일. 항상 존재하므로
	 * `data`가 없는(로컬 캐시 미존재) 상황에서도 점수 배지 / Before-After 비교표가
	 * 항상 동작한다.
	 */
	roundSnapshot: RoundSnapshot;
	/**
	 * 해당 시점의 실측 진단 전체 JSON (점수, 세부항목, AI인용, 결함목록 등) — 항상 깊은
	 * 복사본. 브라우저 localStorage 캐시 전용 데이터라 용량 초과 등으로 저장되지
	 * 못했을 경우 `undefined`일 수 있다 — 그 경우 "전체 리포트 재현"은 생략되고
	 * `roundSnapshot` 기반 요약 카드로 대체된다.
	 */
	data?: MilestoneSnapshotPayload;
}

export interface DomainMilestoneHistory {
	domain: string;
	activeRound: MilestoneRound | 'LIVE';
	snapshots: {
		1?: MilestoneSnapshot;
		2?: MilestoneSnapshot;
		3?: MilestoneSnapshot;
		4?: MilestoneSnapshot;
	};
	/** 마지막 서버 동기화 시각 (ISO) — 로컬/원격 병합 시 최신 판단에 사용. */
	updatedAt?: string;
}

export interface MilestoneRoundMeta {
	round: MilestoneRound;
	/** 기본 회차 타이틀 (박제 시 override 하지 않는 한 그대로 사용). */
	defaultTitle: string;
	/** 짧은 뱃지 라벨. 예: "1회차" */
	shortLabel: string;
	/** D-Day 오프셋 라벨. 예: "D-0", "D+7" */
	dayLabel: string;
}

export const MILESTONE_ROUND_META: Record<MilestoneRound, MilestoneRoundMeta> = {
	1: {
		round: 1,
		defaultTitle: '1회차 · 착수 사전 진단 (D-0)',
		shortLabel: '1회차',
		dayLabel: 'D-0',
	},
	2: {
		round: 2,
		defaultTitle: '2회차 · 온페이지 패치 (D+7)',
		shortLabel: '2회차',
		dayLabel: 'D+7',
	},
	3: {
		round: 3,
		defaultTitle: '3회차 · 크롤러 재수집 (D+14)',
		shortLabel: '3회차',
		dayLabel: 'D+14',
	},
	4: {
		round: 4,
		defaultTitle: '4회차 · 최종 성과 검증 (D+28)',
		shortLabel: '4회차',
		dayLabel: 'D+28',
	},
};

export function emptyMilestoneHistory(domain: string): DomainMilestoneHistory {
	return { domain, activeRound: 'LIVE', snapshots: {} };
}

export function isMilestoneRound(value: unknown): value is MilestoneRound {
	return value === 1 || value === 2 || value === 3 || value === 4;
}

/** 뷰 권한 모드 — 관리자 / 고객 공유(읽기전용) / 일반(무료) 사용자. */
export type MilestoneViewMode = 'admin' | 'client' | 'user';
