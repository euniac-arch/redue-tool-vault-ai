/**
 * Public ranking reads stay open.
 * `sync=1` is the Vercel Cron path and accepts only `Authorization: Bearer ${CRON_SECRET}`.
 * `refresh=1` rebuilds the published snapshot for readers and does not collect sources.
 * Source collection for an administrator is a separate admin route.
 */

import { timingSafeEqual } from 'node:crypto';

export type RankingReadMode = 'read' | 'cron';

export function isEnabledFlag(value: string | null | undefined): boolean {
	const raw = (value ?? '').trim().toLowerCase();
	return raw === '1' || raw === 'true';
}

/** `sync` is cron-only. A public `refresh` flag must not start source collection. */
export function rankingReadMode(params: { sync?: string | null; refresh?: string | null; force?: string | null }): RankingReadMode {
	if (isEnabledFlag(params.sync)) return 'cron';
	return 'read';
}

export function cronSecretMatches(authorization: string | null | undefined, secret: string | undefined): boolean {
	const expected = secret?.trim() ?? '';
	if (!expected) return false;
	const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? '');
	const token = match?.[1] ?? '';
	const left = Buffer.from(token);
	const right = Buffer.from(expected);
	if (left.length !== right.length || left.length === 0) return false;
	return timingSafeEqual(left, right);
}

export function cronHttpStatus(persistence: { ok: boolean; reason: string } | null | undefined): number {
	if (!persistence) return 200;
	if (persistence.reason === 'saved' || persistence.reason === 'already_checked') return 200;
	if (persistence.reason === 'busy' || persistence.reason === 'pending_conflict') return 409;
	return 503;
}

export function authorizeCronSync(authorization: string | null | undefined, secret: string | undefined): { ok: true } | { ok: false; status: 401; error: string } {
	if (!secret?.trim()) {
		return { ok: false, status: 401, error: 'CRON_SECRET이 없어 자동 갱신을 실행할 수 없습니다.' };
	}
	if (!cronSecretMatches(authorization, secret)) {
		return { ok: false, status: 401, error: 'Cron 인증이 필요합니다.' };
	}
	return { ok: true };
}
