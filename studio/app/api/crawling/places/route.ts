import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { extractKeywordRegionAndTopic } from '@/lib/crawling/target-discovery';
import {
	blockedDomainsFromSave,
	type SaveDiscoveredTargetsResult,
} from '@/lib/crawling/target-sites';
import {
	clampPlacesNeededCount,
	collectPlacesPipeline,
	resolveGooglePlacesApiKey,
} from '@/lib/crawling/places';
import { extractRootDomain } from '@/lib/crawling/domain';
import type { TargetFinderResponse } from '@/lib/crawling/types';
import {
	CRAWL_COUNTRY_CODES,
	CRAWL_INDUSTRY_LABELS,
	type CrawlCountryCode,
} from '@/lib/crawling/taxonomy';

export const runtime = 'nodejs';
/** Text Search pages + Place Details + contact scrape. */
export const maxDuration = 90;

function ensureEnvBound(): void {
	const rootDir = path.join(process.cwd(), '..');
	const studioDir = process.cwd();
	loadEnvConfig(rootDir);
	loadEnvConfig(studioDir);
}

ensureEnvBound();

type PlacesBody = {
	location?: string;
	keyword?: string;
	neededCount?: number;
	displayCount?: number;
	limit?: number;
	country?: string;
};

function parseCountry(raw: unknown): CrawlCountryCode {
	if (typeof raw === 'string' && CRAWL_COUNTRY_CODES.includes(raw as CrawlCountryCode)) {
		return raw as CrawlCountryCode;
	}
	return 'KR';
}

function applyLocationFromSave(
	targets: Awaited<ReturnType<typeof collectPlacesPipeline>>['targets'],
	saved: SaveDiscoveredTargetsResult,
) {
	const blocked = blockedDomainsFromSave(saved);
	const locationByDomain = new Map<
		string,
		{ checkLocationNeeded?: boolean; parsedAddress?: string | null }
	>();
	for (const row of [...saved.inserted, ...saved.updated]) {
		locationByDomain.set(row.domain, {
			checkLocationNeeded: row.checkLocationNeeded,
			parsedAddress: row.parsedAddress,
		});
	}
	return targets
		.filter((target) => {
			const domain = extractRootDomain(target.url);
			return Boolean(domain) && !blocked.has(domain as string);
		})
		.map((target) => {
			const domain = extractRootDomain(target.url);
			const loc = domain ? locationByDomain.get(domain) : undefined;
			return {
				...target,
				checkLocationNeeded: loc?.checkLocationNeeded,
				parsedAddress: loc?.parsedAddress ?? target.parsedAddress,
			};
		});
}

/**
 * POST /api/crawling/places
 *
 * Google Places Text Search → website-only filter → extractContactInfo
 * → target_sites upsert (domain or phone dedup).
 *
 * Body: { location, keyword, neededCount }
 */
export async function POST(req: NextRequest) {
	ensureEnvBound();

	let body: PlacesBody;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const rawKeyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
	const rawLocation = typeof body.location === 'string' ? body.location.trim() : '';
	const extracted = extractKeywordRegionAndTopic(rawKeyword || rawLocation);
	const location = rawLocation || extracted.region;
	const keyword = extracted.topic || rawKeyword || rawLocation;

	if (!location && !keyword) {
		return NextResponse.json(
			{ error: '지역(location)과 검색어(keyword)를 입력해 주세요. 예: location=부산, keyword=화장품' },
			{ status: 400 },
		);
	}

	const neededCount = clampPlacesNeededCount(
		body.neededCount ?? body.displayCount ?? body.limit ?? 20,
	);
	const country = parseCountry(body.country);

	if (!resolveGooglePlacesApiKey()) {
		return NextResponse.json(
			{
				error:
					'Google Places API 키가 설정되지 않았습니다. GOOGLE_PLACES_API_KEY 또는 VITE_GOOGLE_MAP_API_KEY를 확인하세요.',
				code: 'MISSING_PLACES_KEY',
			},
			{ status: 400 },
		);
	}

	console.log('🗺️ [Places Collect Request]:', { location, keyword, neededCount, country });

	try {
		const result = await collectPlacesPipeline({
			location: location || keyword,
			keyword: keyword || location,
			neededCount,
			country,
			enrichContact: true,
		});

		const visible = applyLocationFromSave(result.targets, result.persisted);
		const payload: Extract<TargetFinderResponse, { success: true }> = {
			success: true,
			isFallback: false,
			engine: 'places',
			data: visible.map((t) => ({
				id: t.id,
				siteName: t.siteName,
				url: t.url,
				region: t.region,
				category: t.categoryLabel || CRAWL_INDUSTRY_LABELS[t.category] || t.category,
				categoryCode: t.category,
				country: t.country,
				crawledAt: t.crawledAt || new Date().toISOString(),
				source: 'places',
				checkLocationNeeded: Boolean(t.checkLocationNeeded),
				parsedAddress: t.parsedAddress ?? null,
				phoneNumber: t.phoneNumber ?? null,
				googleRating: t.googleRating ?? null,
				googleReviewCount: t.googleReviewCount ?? null,
			})),
			meta: {
				query: result.query,
				source: 'places',
				country,
				scanned: result.places.length,
				requested: neededCount,
				returned: visible.length,
				filteredNote:
					'Google Places Text Search → 웹사이트 있는 장소만 → 홈페이지 연락처 크롤 → target_sites 저장 (도메인/전화번호 중복 제외).',
				persistence: result.persistence,
			},
		};
		return NextResponse.json(payload);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('❌ [Places Collect Error]:', message);
		return NextResponse.json({ error: message, code: 'PLACES_FAILED' }, { status: 502 });
	}
}
