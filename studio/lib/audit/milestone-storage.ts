/**
 * 로컬 우선(Local-first) 마일스톤 영속 저장소.
 *
 * "실시간 진단(Live)"과 "회차별(1~4) 박제(Milestone) 슬롯"은 완전히 분리된 저장 단위다.
 * 도메인마다 별도의 `localStorage` 키(`geo_milestone_<cleanDomain>`)를 사용하므로,
 * 한 도메인의 쓰기 작업이 다른 도메인의 박제 데이터에 영향을 줄 수 없고, 재진단(라이브
 * 진단 갱신)은 이 저장소를 절대 건드리지 않는다 — [확정/박제] 버튼만이 유일한 쓰기 경로다.
 *
 * 서버(Firestore) 동기화는 `tracking-client.ts`(경량 `roundSnapshot` 전용)가 별도로
 * 담당하며, 이 모듈은 오프라인/미설정 환경에서도 박제 기능이 즉시 동작하도록 하는
 * 1차 저장소다. 여기 저장된 전체 리포트 캐시(`data`)는 이제 best-effort이며,
 * 저장에 실패해도 회차 확정 자체가 실패하지는 않는다(경량 원격 저장이 durable
 * source of truth이기 때문).
 */

import { emptyMilestoneHistory, type DomainMilestoneHistory, type MilestoneSnapshot } from '@/lib/audit/milestone-types';
import { normalizeDomain } from '@/lib/audit/normalize-domain';

/** 도메인별 개별 키 접두사 — 실제 키는 `geo_milestone_<cleanDomain>`. */
export const MILESTONE_STORAGE_PREFIX = 'geo_milestone_';

/** 레거시(v1) 통합 키 — 마이그레이션 폴백 읽기 전용으로만 참조한다. */
export const MILESTONE_STORAGE_KEY = 'redue_milestone_history_v1';

interface LegacyMilestoneStoreV1 {
	version: 1;
	byDomain: Record<string, DomainMilestoneHistory>;
}

function isBrowser(): boolean {
	return typeof window !== 'undefined';
}

/**
 * 프로토콜/`www.`/끝 슬래시를 제거한 정규화 키 — 잠금(lock) 시점과 로드 시점의 키가
 * 항상 일치하도록 보장한다. `normalizeDomain`(단일 진실 공급원)에 위임한다.
 */
export function cleanDomainKey(domain: string): string {
	return normalizeDomain(domain);
}

function storageKeyFor(domain: string): string {
	return `${MILESTONE_STORAGE_PREFIX}${cleanDomainKey(domain)}`;
}

/** 저장 실패(용량 초과 등)를 호출부가 인지하고 사용자에게 알릴 수 있도록 하는 전용 에러. */
export class MilestoneStorageError extends Error {
	constructor(message: string, readonly cause?: unknown) {
		super(message);
		this.name = 'MilestoneStorageError';
	}
}

/**
 * 이 도메인을 제외한 다른 도메인의 마일스톤 캐시 중 가장 오래전에 갱신된 항목부터
 * 순서대로 지워 용량을 확보한다. 레거시 통합 키도 함께 정리 대상이다 — 개별 키로
 * 이미 마이그레이션되었으므로 더 이상 필요 없다. 확정(잠금) 데이터 자체를 지우는
 * 것이 아니라 "가장 최근 접근성이 낮은 다른 사이트의 캐시"만 정리해 공간을 만든다.
 */
function reclaimStorageSpace(protectedKey: string): boolean {
	if (!isBrowser()) return false;
	try {
		const candidates: Array<{ key: string; updatedAt: string }> = [];
		for (let i = 0; i < window.localStorage.length; i += 1) {
			const key = window.localStorage.key(i);
			if (!key || key === protectedKey || !key.startsWith(MILESTONE_STORAGE_PREFIX)) continue;
			try {
				const raw = window.localStorage.getItem(key);
				const parsed = raw ? (JSON.parse(raw) as { updatedAt?: string }) : null;
				candidates.push({ key, updatedAt: parsed?.updatedAt || '' });
			} catch {
				candidates.push({ key, updatedAt: '' });
			}
		}
		if (window.localStorage.getItem(MILESTONE_STORAGE_KEY) != null) {
			window.localStorage.removeItem(MILESTONE_STORAGE_KEY);
			return true;
		}
		if (candidates.length === 0) return false;
		candidates.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
		window.localStorage.removeItem(candidates[0].key);
		return true;
	} catch {
		return false;
	}
}

/**
 * 구조적 깊은 복사. `structuredClone`을 우선 사용하고, 지원하지 않는 실행 환경에서는
 * JSON 라운드트립으로 폴백한다 — 스냅샷은 항상 JSON 직렬화 가능한 순수 데이터이므로 안전하다.
 */
export function deepClone<T>(value: T): T {
	if (value == null) return value;
	try {
		if (typeof structuredClone === 'function') return structuredClone(value);
	} catch {
		// Fall through to JSON clone below (e.g. non-cloneable edge case).
	}
	return JSON.parse(JSON.stringify(value)) as T;
}

function isValidHistoryShape(value: unknown): value is DomainMilestoneHistory {
	return Boolean(value) && typeof value === 'object' && 'snapshots' in (value as Record<string, unknown>);
}

function readLegacyDomainRecord(domain: string): DomainMilestoneHistory | null {
	if (!isBrowser()) return null;
	try {
		const raw = window.localStorage.getItem(MILESTONE_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<LegacyMilestoneStoreV1> | null;
		const record = parsed?.byDomain?.[domain];
		return isValidHistoryShape(record) ? record : null;
	} catch {
		return null;
	}
}

function readDomainRecord(domain: string): DomainMilestoneHistory | null {
	if (!isBrowser()) return null;
	try {
		const raw = window.localStorage.getItem(storageKeyFor(domain));
		if (raw) {
			const parsed = JSON.parse(raw) as unknown;
			if (isValidHistoryShape(parsed)) return parsed;
		}
	} catch {
		// Corrupted per-domain record — fall through to legacy lookup below.
	}
	// One-time migration: older builds kept every domain inside a single combined
	// key. If that legacy record still has this domain's rounds, adopt it into the
	// new per-domain key so it is never silently lost.
	const legacy = readLegacyDomainRecord(domain);
	if (legacy) {
		writeDomainRecord({ ...legacy, domain });
		return legacy;
	}
	return null;
}

/**
 * `localStorage.setItem`을 실행하고, 쓰기가 실제로 반영되었는지 즉시 read-back으로
 * 검증한다. 용량 초과(QuotaExceededError)나 프라이빗 모드 등으로 실패하면 다른
 * 도메인의 오래된 마일스톤 캐시를 1회 정리한 뒤 재시도한다 — 그래도 실패하면
 * `false`를 반환해 호출부가 "저장 성공"을 거짓으로 보고하지 않도록 한다.
 */
function writeDomainRecord(history: DomainMilestoneHistory): boolean {
	if (!isBrowser()) return false;
	const key = storageKeyFor(history.domain);
	const serialized = JSON.stringify(history);

	const attempt = (): boolean => {
		try {
			window.localStorage.setItem(key, serialized);
			return window.localStorage.getItem(key) === serialized;
		} catch {
			return false;
		}
	};

	if (attempt()) return true;
	if (reclaimStorageSpace(key) && attempt()) return true;
	return false;
}

export function loadMilestoneHistory(domain: string): DomainMilestoneHistory {
	const key = cleanDomainKey(domain);
	if (!key) return emptyMilestoneHistory('');
	return readDomainRecord(key) ?? emptyMilestoneHistory(key);
}

/**
 * @param options.throwOnFailure 실제 확정(잠금) 경로에서만 `true`로 지정한다 —
 * 백그라운드 원격 병합(merge) 등 best-effort 경로는 저장 실패를 조용히 넘기고
 * 세션 내 메모리 상태만 유지해도 되지만, 사용자가 직접 누른 [확정/박제] 버튼은
 * 저장이 실제로 실패했을 때 반드시 에러로 알려야 한다("성공"이라고 속이지 않는다).
 */
export function saveMilestoneHistory(
	history: DomainMilestoneHistory,
	options?: { throwOnFailure?: boolean },
): DomainMilestoneHistory {
	const key = cleanDomainKey(history.domain);
	if (!key) return history;
	const next: DomainMilestoneHistory = deepClone({
		...history,
		domain: key,
		updatedAt: new Date().toISOString(),
	});
	const persisted = writeDomainRecord(next);
	if (!persisted && options?.throwOnFailure) {
		throw new MilestoneStorageError(
			'브라우저 저장 공간이 가득 차 있어 로컬(localStorage)에 확정 결과를 저장하지 못했습니다.',
		);
	}
	return next;
}

/**
 * 특정 회차 슬롯에 스냅샷을 확정(overwrite)하고 갱신된 히스토리를 반환한다.
 *
 * - 저장 직전 스냅샷을 깊은 복사하여, 이후 실시간(Live) 리포트 state가 어떻게 바뀌어도
 *   (재진단 등) 이미 박제된 데이터가 영향받지 않도록 참조를 완전히 끊는다.
 * - 쓰기 직전 항상 저장소에서 "현재" 상태를 다시 읽어(read-modify-write) 병합하므로,
 *   메모리상의 오래된 history를 기반으로 다른 회차를 덮어쓸 위험이 없다.
 */
export function lockMilestoneSnapshotLocally(
	domain: string,
	snapshot: MilestoneSnapshot,
): DomainMilestoneHistory {
	const key = cleanDomainKey(domain);
	const frozenSnapshot = deepClone(snapshot);
	const current = loadMilestoneHistory(key);
	const next: DomainMilestoneHistory = {
		...current,
		domain: key,
		snapshots: { ...current.snapshots, [frozenSnapshot.round]: frozenSnapshot },
	};
	return saveMilestoneHistory(next, { throwOnFailure: true });
}

