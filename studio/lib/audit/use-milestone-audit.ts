'use client';

/**
 * useMilestoneAudit — 실시간 진단 ⇄ 회차별(1~4) 확정 스냅샷 전환을 담당하는 상태 훅.
 *
 * - 라이브 진단은 항상 호출부(`report`, `geoNarrative`, `pageSpeed*`)에서 그대로 흘러온다.
 * - "확정/박제" 클릭 시점의 라이브 상태를 통째로 냉동(freeze)해 `snapshots[round]`에 저장한다.
 * - 저장 계층은 하이브리드 구조다:
 *     1) 경량 `roundSnapshot`(점수 + 핵심 메트릭)을 Firestore `audit_tracking` 컬렉션에
 *        원격 저장한다 — 이것이 durable(영구) 소스다. 페이로드가 작아(수백 바이트~2KB)
 *        용량 문제로 실패할 일이 거의 없다.
 *     2) 전체 리포트(`data`)는 이 브라우저의 localStorage에 best-effort로 캐시한다 —
 *        용량이 부족해 실패해도 더 이상 치명적 에러로 취급하지 않는다(원격 경량
 *        저장이 이미 성공했다면 회차 확정 자체는 안전하게 보존된 상태이기 때문).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDiagnosisScoreSnapshot } from '@/lib/audit/diagnosis-scores';
import {
	MilestoneStorageError,
	loadMilestoneHistory,
	lockMilestoneSnapshotLocally,
	saveMilestoneHistory,
} from '@/lib/audit/milestone-storage';
import {
	MILESTONE_ROUND_META,
	emptyMilestoneHistory,
	type DomainMilestoneHistory,
	type MilestoneActiveRound,
	type MilestoneRound,
	type MilestoneSnapshot,
} from '@/lib/audit/milestone-types';
import { buildRoundSnapshot, mergeTrackingIntoMilestoneHistory } from '@/lib/audit/round-tracking';
import { fetchAuditTrackingHistory, pushRoundSnapshot } from '@/lib/audit/tracking-client';
import type { GeoNarrativeReport } from '@/lib/audit/geo-narrative';
import type { PageSpeedSnapshot } from '@/lib/audit/pagespeed';
import type { AuditLang, AuditReport } from '@/lib/site-auditor';

export interface UseMilestoneAuditOptions {
	/** 정규화된 도메인/호스트네임 — 히스토리의 저장 키. 비어 있으면 훅은 완전히 비활성 상태를 유지한다. */
	domain: string;
	reportId?: string | null;
	liveReport: AuditReport | null;
	geoNarrative?: GeoNarrativeReport | null;
	pageSpeed?: PageSpeedSnapshot | null;
	pageSpeedDesktop?: PageSpeedSnapshot | null;
	pageSpeedMobile?: PageSpeedSnapshot | null;
	lang?: AuditLang;
	/** 관리자 모드가 아니면 굳이 원격 동기화를 시도할 필요가 없다. */
	enableRemoteSync?: boolean;
}

export interface UseMilestoneAuditResult {
	/**
	 * 재진단(rescan) 도중 `domain`이 잠깐 빈 문자열이 되어도 마지막으로 확인된 실제
	 * 도메인을 그대로 유지하는 안정 도메인. 호출부는 마일스톤 패널의 표시/숨김을
	 * 라이브 `report`(재진단 중 잠깐 `null`)가 아니라 이 값으로 판단해야, 재진단 중에
	 * 이미 박제된 회차 배지가 잠깐 사라졌다가 다시 나타나며 "초기화된 것처럼" 보이는
	 * 현상을 막을 수 있다.
	 */
	effectiveDomain: string;
	history: DomainMilestoneHistory;
	activeRound: MilestoneActiveRound;
	setActiveRound: (round: MilestoneActiveRound) => void;
	/** 현재 activeRound가 'LIVE'이거나, 아직 아무것도 박제되지 않아 라이브로 폴백된 경우 true. */
	isViewingLive: boolean;
	/** activeRound가 확정 회차이고 실제 스냅샷이 존재할 때만 값이 채워진다. */
	displayedSnapshot: MilestoneSnapshot | null;
	lockedRounds: MilestoneRound[];
	scoreByRound: Partial<Record<MilestoneRound, number>>;
	isLoadingHistory: boolean;
	/** 확정(박제) 전체 흐름(로컬 캐시 + 원격 경량 저장)이 진행 중인지 여부 — 버튼/토스트 로딩 상태에 사용. */
	isLocking: boolean;
	/** 원격(Firestore) 경량 저장이 실패했을 때만 채워진다 — 로컬 캐시 실패는 더 이상 에러로 취급하지 않는다. */
	lockError: string | null;
	lastLockedRound: MilestoneRound | null;
	lockRound: (round: MilestoneRound, options?: { titleOverride?: string }) => Promise<void>;
}

function buildSnapshotPayload(
	report: AuditReport,
	geoNarrative: GeoNarrativeReport | null | undefined,
	pageSpeed: PageSpeedSnapshot | null | undefined,
	pageSpeedDesktop: PageSpeedSnapshot | null | undefined,
	pageSpeedMobile: PageSpeedSnapshot | null | undefined,
	lang: AuditLang,
) {
	const scoreSnapshot = buildDiagnosisScoreSnapshot(report, geoNarrative ?? null, lang);
	return {
		report,
		geoNarrative: geoNarrative ?? null,
		pageSpeed: pageSpeed ?? null,
		pageSpeedDesktop: pageSpeedDesktop ?? null,
		pageSpeedMobile: pageSpeedMobile ?? null,
		measuredScore: scoreSnapshot.measuredScore,
		grade: scoreSnapshot.grade,
	};
}

export function useMilestoneAudit(options: UseMilestoneAuditOptions): UseMilestoneAuditResult {
	const {
		domain,
		liveReport,
		geoNarrative,
		pageSpeed,
		pageSpeedDesktop,
		pageSpeedMobile,
		lang = 'ko',
		enableRemoteSync = true,
	} = options;

	const [history, setHistory] = useState<DomainMilestoneHistory>(() =>
		domain ? loadMilestoneHistory(domain) : emptyMilestoneHistory(''),
	);
	const [activeRound, setActiveRound] = useState<MilestoneActiveRound>('LIVE');
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	const [isLocking, setIsLocking] = useState(false);
	const [lockError, setLockError] = useState<string | null>(null);
	const [lastLockedRound, setLastLockedRound] = useState<MilestoneRound | null>(null);
	const loadedDomainRef = useRef<string>('');
	/**
	 * 라이브 진단(Live)이 재진단(rescan) 중 잠깐 `null`을 거치며 `domain`이 일시적으로
	 * 빈 문자열이 되어도(예: 새 스캔 시작 직후 report 초기화), 마일스톤 슬롯 상태가
	 * 절대 그 순간을 "새 도메인"으로 오인해 초기화되지 않도록 마지막으로 확인된 실제
	 * 도메인을 별도로 보관한다 — Live 상태와 Milestone 상태의 완전한 분리.
	 */
	const stableDomainRef = useRef<string>('');
	if (domain) stableDomainRef.current = domain;
	const effectiveDomain = domain || stableDomainRef.current;

	// 도메인이 "실제로" 바뀌었을 때만(다른 사이트 리포트 열람) 로컬 캐시를 반영하고 원격
	// 동기화를 시도한다. 재진단으로 라이브 리포트가 잠시 비워지는 것은 도메인 변경이 아니다.
	useEffect(() => {
		if (!effectiveDomain || loadedDomainRef.current === effectiveDomain) return;
		loadedDomainRef.current = effectiveDomain;
		setHistory(loadMilestoneHistory(effectiveDomain));
		setActiveRound('LIVE');
		setLastLockedRound(null);
		setLockError(null);

		if (!enableRemoteSync) return;
		let cancelled = false;
		setIsLoadingHistory(true);
		fetchAuditTrackingHistory(effectiveDomain)
			.then((remote) => {
				if (cancelled || !remote) return;
				setHistory((prev) => {
					const merged = mergeTrackingIntoMilestoneHistory(
						{ ...prev, domain: prev.domain || effectiveDomain },
						remote,
					);
					// Best-effort: 병합 결과를 로컬 캐시에도 반영해 다음 방문 시 즉시 뜨게 한다.
					try {
						return saveMilestoneHistory(merged);
					} catch {
						return merged;
					}
				});
			})
			.finally(() => {
				if (!cancelled) setIsLoadingHistory(false);
			});
		return () => {
			cancelled = true;
		};
	}, [effectiveDomain, enableRemoteSync]);

	const lockedRounds = useMemo(
		() =>
			([1, 2, 3, 4] as MilestoneRound[]).filter((round) => Boolean(history.snapshots[round]?.isLocked)),
		[history.snapshots],
	);

	const scoreByRound = useMemo(() => {
		const out: Partial<Record<MilestoneRound, number>> = {};
		for (const round of lockedRounds) {
			// `roundSnapshot`은 항상 존재하므로(로컬 전체 데이터 유무와 무관) 이 값이
			// 항상 정확한 배지 점수를 준다.
			out[round] = history.snapshots[round]?.roundSnapshot.scores.total;
		}
		return out;
	}, [history.snapshots, lockedRounds]);

	const displayedSnapshot = useMemo(() => {
		if (activeRound === 'LIVE') return null;
		return history.snapshots[activeRound] ?? null;
	}, [activeRound, history.snapshots]);

	const isViewingLive = activeRound === 'LIVE' || !displayedSnapshot;

	const lockRound = useCallback(
		async (round: MilestoneRound, lockOptions?: { titleOverride?: string }) => {
			if (!effectiveDomain || !liveReport) {
				setLockError('실시간 진단 데이터가 아직 준비되지 않았습니다.');
				return;
			}
			setIsLocking(true);
			setLockError(null);
			try {
				// 현재 라이브 진단 결과를 그대로 얼려(freeze) 회차 슬롯에 확정한다. 이 시점의
				// 참조가 이후 재진단으로 바뀔 `liveReport`와 절대 공유되지 않도록
				// `lockMilestoneSnapshotLocally` 내부에서 깊은 복사 후 저장소에 영구 기록한다.
				const payload = buildSnapshotPayload(
					liveReport,
					geoNarrative,
					pageSpeed,
					pageSpeedDesktop,
					pageSpeedMobile,
					lang,
				);
				const roundSnapshot = buildRoundSnapshot(liveReport, geoNarrative, lang, round, true);
				const now = new Date();
				const snapshot: MilestoneSnapshot = {
					round,
					title: lockOptions?.titleOverride?.trim() || MILESTONE_ROUND_META[round].defaultTitle,
					date: now.toISOString().slice(0, 10),
					lockedAt: now.toISOString(),
					isLocked: true,
					roundSnapshot,
					data: payload,
				};

				// 로컬(localStorage) 저장은 이제 best-effort다 — 실패해도(용량 초과 등) 회차
				// 확정 자체가 사라지지 않는다. 아래에서 경량 스냅샷을 Firestore에 반드시
				// 원격 저장하기 때문에, 로컬 실패는 "이 브라우저의 전체 리포트 재현 캐시만
				// 없어진 것"일 뿐 데이터 손실이 아니다. 세션 메모리 상태는 항상 즉시 반영한다.
				let nextHistory: DomainMilestoneHistory;
				try {
					nextHistory = lockMilestoneSnapshotLocally(effectiveDomain, snapshot);
				} catch (storageErr) {
					if (storageErr instanceof MilestoneStorageError) {
						console.warn(
							'[useMilestoneAudit] local full-report cache write failed (non-fatal — remote sync still runs):',
							storageErr,
						);
					} else {
						throw storageErr;
					}
					nextHistory = {
						...history,
						domain: effectiveDomain,
						snapshots: { ...history.snapshots, [round]: snapshot },
					};
				}
				setHistory(nextHistory);
				setLastLockedRound(round);

				if (enableRemoteSync) {
					const result = await pushRoundSnapshot(effectiveDomain, round, roundSnapshot);
					if (!result.ok) {
						setLockError(
							result.error ||
								'서버 저장에 실패했습니다 — 새로고침 시 이 확정 결과가 사라질 수 있습니다. 잠시 후 다시 시도해 주세요.',
						);
					}
				}
			} catch (err) {
				console.error('[useMilestoneAudit] lockRound failed:', err);
				setLockError('회차 확정 중 오류가 발생했습니다. 다시 시도해 주세요.');
			} finally {
				setIsLocking(false);
			}
		},
		[effectiveDomain, liveReport, geoNarrative, pageSpeed, pageSpeedDesktop, pageSpeedMobile, lang, enableRemoteSync, history],
	);

	return {
		effectiveDomain,
		history,
		activeRound,
		setActiveRound,
		isViewingLive,
		displayedSnapshot,
		lockedRounds,
		scoreByRound,
		isLoadingHistory,
		isLocking,
		lockError,
		lastLockedRound,
		lockRound,
	};
}
