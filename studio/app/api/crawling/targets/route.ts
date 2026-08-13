import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
	findTargetSitesByDomains,
	findTargetSitesByIds,
	serializeTargetSite,
} from '@/lib/crawling/target-sites';

export const runtime = 'nodejs';

loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

function splitCsv(raw: string | null): string[] {
	if (!raw) return [];
	return raw
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

/**
 * GET /api/crawling/targets?domains=a.com,b.com&ids=cuid1,cuid2
 *
 * Lookup `target_sites` rows for the admin list (email / contact / DIAGNOSED).
 */
export async function GET(req: NextRequest) {
	const { searchParams } = req.nextUrl;
	const domains = [
		...splitCsv(searchParams.get('domains')),
		...splitCsv(searchParams.get('domain')),
	];
	const ids = splitCsv(searchParams.get('ids'));

	if (domains.length === 0 && ids.length === 0) {
		return NextResponse.json({ success: true, data: [] });
	}

	try {
		const [byDomain, byId] = await Promise.all([
			findTargetSitesByDomains(domains),
			findTargetSitesByIds(ids),
		]);
		const merged = new Map<string, (typeof byDomain)[number]>();
		for (const site of [...byDomain, ...byId]) {
			merged.set(site.id, site);
		}
		return NextResponse.json({
			success: true,
			data: Array.from(merged.values()).map(serializeTargetSite),
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		console.error('[crawling/targets GET]', message);
		return NextResponse.json(
			{ error: '타깃 목록을 불러오지 못했습니다.', details: message },
			{ status: 500 },
		);
	}
}
