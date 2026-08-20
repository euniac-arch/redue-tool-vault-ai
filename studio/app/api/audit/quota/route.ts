import { NextResponse } from 'next/server';
import { resolveAuditQuota } from '@/lib/audit/free-audit-quota-server';

export const runtime = 'nodejs';

/** GET /api/audit/quota — remaining free site-audit scans for the current visitor. */
export async function GET() {
	const quota = await resolveAuditQuota();
	return NextResponse.json({
		used: quota.used,
		remaining: quota.unlimited ? null : quota.remaining,
		limit: quota.limit,
		date: quota.date,
		unlimited: quota.unlimited,
		devMode: quota.devMode,
		exhausted: quota.exhausted,
		authenticated: Boolean(quota.userId),
	});
}
