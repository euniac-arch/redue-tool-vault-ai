import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { toCsv } from '@/lib/admin/security-log-management';
import { listSecurityLogsForExport } from '@/lib/admin/security-log-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
	const rows = await listSecurityLogsForExport(Array.isArray(body.ids) ? body.ids : undefined);
	const csv = `\uFEFF${toCsv(rows)}`;
	return new NextResponse(csv, {
		status: 200,
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="security-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
		},
	});
}
