import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
	refreshTargetSiteById,
	serializeTargetRefresh,
} from '@/lib/crawling/target-sites';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Ensure monorepo-root `.env` / `.env.local` keys are visible in studio. */
loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

type RefreshBody = {
	id?: unknown;
};

function asId(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * POST /api/crawling/targets/:id/refresh
 *
 * Re-collect email / contact-form URL / last_scraped_at for one `target_sites`
 * row. Path param `id` is the primary key; body `{ id }` is accepted as a fallback.
 */
export async function POST(
	req: NextRequest,
	{ params }: { params: { id: string } },
) {
	let body: RefreshBody = {};
	const contentType = req.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		try {
			body = (await req.json()) as RefreshBody;
		} catch {
			return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
		}
	}

	const id = asId(params.id) || asId(body.id);
	if (!id) {
		return NextResponse.json({ error: '타깃 ID가 필요합니다.' }, { status: 400 });
	}

	try {
		const result = await refreshTargetSiteById(id);
		if (!result.ok) {
			if (result.error === 'not_found') {
				return NextResponse.json(
					{ error: '타깃 사이트를 찾을 수 없습니다.', code: 'not_found' },
					{ status: 404 },
				);
			}
			if (result.error === 'invalid_id') {
				return NextResponse.json({ error: '타깃 ID가 필요합니다.' }, { status: 400 });
			}
			if (result.error === 'unsafe_url') {
				return NextResponse.json(
					{ error: result.message || '수집할 수 없는 URL입니다.', code: 'unsafe_url' },
					{ status: 400 },
				);
			}
			return NextResponse.json(
				{
					error: '타깃 정보를 재수집하지 못했습니다.',
					details: result.message,
					code: result.error,
				},
				{ status: 502 },
			);
		}

		return NextResponse.json({
			success: true,
			data: serializeTargetRefresh(result.site),
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('[crawling/targets/refresh]', message);
		return NextResponse.json(
			{
				error: '타깃 정보를 재수집하지 못했습니다.',
				details: message,
			},
			{ status: 500 },
		);
	}
}
