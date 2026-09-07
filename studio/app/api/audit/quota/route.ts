import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { requireAdmin } from '@/lib/admin';
import { authOptions } from '@/lib/auth';
import { buildAuditQuota } from '@/lib/audit/free-audit-quota';
import {
	applyClearedGuestAuditCookie,
	resetStoredDailyUsage,
	resolveAuditQuota,
} from '@/lib/audit/free-audit-quota-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type QuotaSessionUser = {
	id?: string | null;
	email?: string | null;
};

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status ?? 200,
		headers: { 'Cache-Control': 'no-store, max-age=0' },
	});
}

function quotaPayload(quota: Awaited<ReturnType<typeof resolveAuditQuota>>) {
	return {
		used: quota.used,
		remaining: quota.unlimited ? null : quota.remaining,
		limit: quota.limit,
		date: quota.date,
		unlimited: quota.unlimited,
		exhausted: quota.exhausted,
		authenticated: Boolean(quota.userId),
	};
}

function isDevQuotaResetAllowed(): boolean {
	return process.env.NODE_ENV !== 'production' || process.env.ALLOW_QUOTA_RESET === '1';
}

function resetSecretMatches(request: Request): boolean {
	const expected = process.env.RESET_QUOTA_SECRET?.trim();
	if (!expected) return false;
	const provided = request.headers.get('x-reset-quota-secret')?.trim() || '';
	return provided.length > 0 && provided === expected;
}

/** GET /api/audit/quota — remaining free site-audit scans for the current visitor. */
export async function GET() {
	const quota = await resolveAuditQuota();
	return noStoreJson(quotaPayload(quota));
}

type ResetBody = {
	email?: string;
	all?: boolean;
};

/**
 * POST /api/audit/quota — development helper that zeros today's audit quota.
 * Always clears the guest cookie. DB rows are reset for the current session
 * user, an optional `{ email }`, or `{ all: true }` (dev/admin only).
 */
export async function POST(request: Request) {
	const secretOk = resetSecretMatches(request);
	const admin = secretOk ? { id: 'secret', email: null, name: null } : await requireAdmin();
	if (!isDevQuotaResetAllowed() && !admin && !secretOk) {
		return noStoreJson({ error: '쿼터 리셋은 개발 환경 또는 관리자만 사용할 수 있습니다.' }, { status: 403 });
	}

	let body: ResetBody = {};
	try {
		body = (await request.json()) as ResetBody;
	} catch {
		body = {};
	}

	const session = await getServerSession(authOptions).catch(() => null);
	const sessionUser = (session as { user?: QuotaSessionUser } | null)?.user;
	const sessionUserId = typeof sessionUser?.id === 'string' ? sessionUser.id : null;
	const sessionEmail = typeof sessionUser?.email === 'string' ? sessionUser.email : null;
	const targetEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
	const resetAll = body.all === true;

	if ((resetAll || targetEmail) && !admin && !secretOk && !isDevQuotaResetAllowed()) {
		return noStoreJson({ error: '다른 계정의 쿼터를 리셋할 권한이 없습니다.' }, { status: 403 });
	}

	const reset = await resetStoredDailyUsage({
		all: resetAll || (isDevQuotaResetAllowed() && !targetEmail),
		email: resetAll ? null : targetEmail || sessionEmail,
		userId: resetAll || targetEmail || isDevQuotaResetAllowed() ? null : sessionUserId,
	});

	const resolved = await resolveAuditQuota();
	// This request still sees the pre-reset guest cookie; the Set-Cookie on the
	// response cannot change `cookies()` mid-flight, so force used=0 here.
	const quota = resolved.unlimited
		? resolved
		: { ...resolved, ...buildAuditQuota(0, false, resolved.date, resolved.limit) };
	const response = noStoreJson({
		ok: true,
		reset,
		...quotaPayload(quota),
	});
	applyClearedGuestAuditCookie(response);
	return response;
}
