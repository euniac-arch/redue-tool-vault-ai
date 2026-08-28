import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { executeLiveUrlDiagnostic } from '@/lib/admin/live-diagnostic-engine';
import { LIVE_INDUSTRY_OPTIONS, type LiveDiagnosticIndustry } from '@/lib/admin/liveDiagnosticTypes';
import { UnsafeAuditUrlError } from '@/lib/ssrf-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

type LiveDiagnosticBody = {
	url?: string;
	industry?: string;
	targetFocus?: string;
};

function asIndustry(value: string | undefined): LiveDiagnosticIndustry {
	return LIVE_INDUSTRY_OPTIONS.some((item) => item.value === value)
		? (value as LiveDiagnosticIndustry)
		: 'medical';
}

/**
 * POST /api/diagnostics/live
 * Fetch a public URL, parse meta/JSON-LD, score GEO/SEO, return a prescription schema.
 */
export async function POST(request: Request) {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	let body: LiveDiagnosticBody;
	try {
		body = (await request.json()) as LiveDiagnosticBody;
	} catch {
		return NextResponse.json({ error: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
	}

	const url = typeof body.url === 'string' ? body.url.trim() : '';
	if (!url) {
		return NextResponse.json({ error: '진단할 URL을 입력해 주세요.' }, { status: 400 });
	}

	try {
		const result = await executeLiveUrlDiagnostic(url, {
			industry: asIndustry(body.industry),
			targetFocus: typeof body.targetFocus === 'string' ? body.targetFocus : '',
		});
		return NextResponse.json(result, {
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				Pragma: 'no-cache',
			},
		});
	} catch (error) {
		if (error instanceof UnsafeAuditUrlError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		const message = error instanceof Error ? error.message : '실시간 진단을 실행하지 못했습니다.';
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
