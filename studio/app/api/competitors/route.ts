import { NextResponse } from 'next/server';
import {
	calculateCompetitorSov,
	competitorSovToSnapshot,
	type CompetitorSovResult,
} from '@/lib/audit/realCompetitors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function parseLang(raw: unknown): 'ko' | 'en' {
	return raw === 'en' ? 'en' : 'ko';
}

async function resolveCompetitorSov(input: {
	clientName?: unknown;
	brandName?: unknown;
	region?: unknown;
	location?: unknown;
	broadLocation?: unknown;
	mainService?: unknown;
	primaryKeyword?: unknown;
	category?: unknown;
	categoryName?: unknown;
	lang?: unknown;
	query?: unknown;
	targetQuery?: unknown;
}): Promise<CompetitorSovResult | { error: string }> {
	const clientName = asString(input.clientName) || asString(input.brandName);
	const region = asString(input.region) || asString(input.location) || asString(input.broadLocation);
	const mainService =
		asString(input.mainService) || asString(input.primaryKeyword) || asString(input.category);
	const categoryName = asString(input.categoryName) || asString(input.category) || '전문 기관';
	const query = asString(input.query) || asString(input.targetQuery);
	if (!clientName || !region || !mainService) {
		return { error: 'clientName, region, mainService가 필요합니다.' };
	}
	return calculateCompetitorSov(
		clientName,
		region,
		mainService,
		categoryName,
		parseLang(input.lang),
		query || undefined,
	);
}

/**
 * POST /api/competitors
 * Live Naver Local → Google Places competitor names for SoV binding.
 */
export async function POST(request: Request) {
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const result = await resolveCompetitorSov(body);
	if ('error' in result) return noStoreJson(result, { status: 400 });
	return noStoreJson({ ...result, snapshot: competitorSovToSnapshot(result) });
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const result = await resolveCompetitorSov({
		clientName: url.searchParams.get('clientName'),
		brandName: url.searchParams.get('brandName'),
		region: url.searchParams.get('region'),
		location: url.searchParams.get('location'),
		broadLocation: url.searchParams.get('broadLocation'),
		mainService: url.searchParams.get('mainService'),
		primaryKeyword: url.searchParams.get('primaryKeyword'),
		category: url.searchParams.get('category'),
		categoryName: url.searchParams.get('categoryName'),
		lang: url.searchParams.get('lang'),
		query: url.searchParams.get('query'),
		targetQuery: url.searchParams.get('targetQuery'),
	});
	if ('error' in result) return noStoreJson(result, { status: 400 });
	return noStoreJson({ ...result, snapshot: competitorSovToSnapshot(result) });
}
