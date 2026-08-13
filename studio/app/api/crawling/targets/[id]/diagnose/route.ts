import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { saveTargetDiagnosis, serializeTargetSite } from '@/lib/crawling/target-sites';

export const runtime = 'nodejs';
export const maxDuration = 30;

loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

type DiagnoseBody = {
	id?: unknown;
	domain?: unknown;
	url?: unknown;
	target_id?: unknown;
	report?: unknown;
	auditId?: unknown;
	audit_lead_id?: unknown;
};

function asText(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * POST /api/crawling/targets/:id/diagnose
 *
 * Store the precision SEO/GEO JSON on the `target_sites` row and set
 * status = DIAGNOSED. Path `id` is preferred; body `{ id | target_id, domain, url }`
 * is accepted as a fallback so the public diagnose page can still persist.
 */
export async function POST(
	req: NextRequest,
	{ params }: { params: { id: string } },
) {
	let body: DiagnoseBody = {};
	try {
		body = (await req.json()) as DiagnoseBody;
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const id = asText(params.id) || asText(body.id) || asText(body.target_id);
	const domain = asText(body.domain);
	const url = asText(body.url);
	const auditLeadId = asText(body.auditId) || asText(body.audit_lead_id) || null;

	if (!id && !domain && !url) {
		return NextResponse.json({ error: '타깃 ID 또는 도메인이 필요합니다.' }, { status: 400 });
	}

	try {
		const result = await saveTargetDiagnosis({
			id,
			domain,
			url,
			report: body.report,
			auditLeadId,
		});
		if (!result.ok) {
			if (result.error === 'not_found') {
				return NextResponse.json(
					{ error: '타깃 사이트를 찾을 수 없습니다.', code: 'not_found' },
					{ status: 404 },
				);
			}
			if (result.error === 'invalid_report') {
				return NextResponse.json(
					{ error: result.message || '진단 결과 JSON이 필요합니다.', code: 'invalid_report' },
					{ status: 400 },
				);
			}
			return NextResponse.json({ error: '타깃 ID가 필요합니다.', code: 'invalid_id' }, { status: 400 });
		}

		return NextResponse.json({
			success: true,
			data: serializeTargetSite(result.site),
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('[crawling/targets/diagnose]', message);
		return NextResponse.json(
			{ error: '진단 결과를 저장하지 못했습니다.', details: message },
			{ status: 500 },
		);
	}
}
