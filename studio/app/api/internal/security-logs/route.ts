import { NextResponse } from 'next/server';
import { isSecurityEventType, isSecurityLogStatus } from '@/lib/admin/security-log-management';
import { writeSecurityLog } from '@/lib/logger';
import { resolveNextAuthSecret } from '@/lib/master-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
	const secret = resolveNextAuthSecret();
	if (!secret) return false;
	const header = request.headers.get('x-internal-log-secret') || '';
	return header === secret;
}

export async function POST(request: Request) {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
	}

	const body = (await request.json().catch(() => ({}))) as {
		eventType?: string;
		userEmail?: string;
		userId?: string;
		status?: string;
		details?: string;
		ipAddress?: string;
		userAgent?: string;
		country?: string;
	};

	if (!isSecurityEventType(body.eventType)) {
		return NextResponse.json({ error: 'invalid eventType' }, { status: 400 });
	}

	await writeSecurityLog({
		eventType: body.eventType,
		userEmail: body.userEmail,
		userId: body.userId,
		status: isSecurityLogStatus(body.status) ? body.status : undefined,
		details: body.details,
		ipAddress: body.ipAddress,
		userAgent: body.userAgent,
		country: body.country,
		headers: request.headers,
	});

	return NextResponse.json({ ok: true });
}
