import { NextRequest, NextResponse } from 'next/server';
import { excludeTargetSites } from '@/lib/crawling/target-sites';

export const runtime = 'nodejs';

type ExcludeBody = {
	urls?: unknown;
	domains?: unknown;
};

function asStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/**
 * POST /api/crawling/target-sites/exclude
 *
 * Soft-delete: set status=EXCLUDED. Rows are never hard-deleted so later
 * search-engine crawls skip the same root domain.
 *
 * Body: { urls?: string[], domains?: string[] }
 */
export async function POST(req: NextRequest) {
	let body: ExcludeBody;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const inputs = [...asStringList(body.urls), ...asStringList(body.domains)];
	if (inputs.length === 0) {
		return NextResponse.json({ error: 'urls 또는 domains가 필요합니다.' }, { status: 400 });
	}

	try {
		const result = await excludeTargetSites(inputs);
		return NextResponse.json({
			success: true,
			excluded: result.excluded,
			domains: result.domains,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('❌ [target_sites exclude]:', message);
		return NextResponse.json({ error: '제외 처리에 실패했습니다.', details: message }, { status: 500 });
	}
}
