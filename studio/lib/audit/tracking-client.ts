/**
 * Client-side wrappers around `/api/audit/tracking` — the durable, lightweight
 * remote store for round score trends. Unlike the legacy milestone client
 * (which always swallowed failures to `null`, because the local cache was the
 * source of truth), `pushRoundSnapshot` here reports success/failure honestly:
 * this endpoint IS the durable store now, so the caller needs a real signal to
 * drive `isSaving` / error UI.
 */

import type { AuditTrackingDoc, RoundSnapshot, TrackingRound } from '@/lib/audit/round-tracking-types';

export async function fetchAuditTrackingHistory(domain: string): Promise<AuditTrackingDoc | null> {
	if (!domain) return null;
	try {
		const res = await fetch(`/api/audit/tracking?domain=${encodeURIComponent(domain)}`, {
			method: 'GET',
			cache: 'no-store',
		});
		if (!res.ok) return null;
		const json = (await res.json()) as { history?: AuditTrackingDoc | null };
		return json.history ?? null;
	} catch {
		return null;
	}
}

export interface PushRoundSnapshotResult {
	ok: boolean;
	history: AuditTrackingDoc | null;
	error?: string;
}

export async function pushRoundSnapshot(
	domain: string,
	round: TrackingRound,
	snapshot: RoundSnapshot,
): Promise<PushRoundSnapshotResult> {
	if (!domain) return { ok: false, history: null, error: '도메인 정보가 없습니다.' };
	try {
		const res = await fetch('/api/audit/tracking', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ domain, round, snapshot }),
		});
		const json = (await res.json().catch(() => ({}))) as { history?: AuditTrackingDoc | null; error?: string };
		if (!res.ok) {
			return { ok: false, history: null, error: json.error || '서버 저장에 실패했습니다.' };
		}
		return { ok: true, history: json.history ?? null };
	} catch {
		return { ok: false, history: null, error: '네트워크 오류로 서버 저장에 실패했습니다.' };
	}
}
