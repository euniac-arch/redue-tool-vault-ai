import { NextResponse } from 'next/server';
import { getLiveCaseStudyById } from '@/lib/case-studies/live-case-studies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
	_request: Request,
	context: { params: { id?: string } | Promise<{ id?: string }> },
) {
	const params = await Promise.resolve(context.params);
	const id = typeof params?.id === 'string' ? params.id.trim() : '';
	if (!id) {
		return NextResponse.json({ item: null }, { status: 404 });
	}

	try {
		const item = await getLiveCaseStudyById(id);
		if (!item) {
			return NextResponse.json({ item: null }, { status: 404 });
		}
		return NextResponse.json(
			{ item, timestamp: new Date().toISOString() },
			{ headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache' } },
		);
	} catch (err) {
		console.error('[api/case-studies/[id]] lookup failed:', err);
		return NextResponse.json({ item: null, error: 'lookup_failed' }, { status: 500 });
	}
}
