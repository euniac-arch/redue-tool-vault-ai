import { loadEnvConfig } from '@next/env';
import axios from 'axios';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { extractRootDomain } from '@/lib/crawling/domain';
import {
	buildGoogleSearchQuery,
	buildRealSampleFallbackTargets,
	buildSearchQuery,
	discoverTargets,
	discoverTargetsViaGoogle,
	discoverTargetsViaNaver,
	extractKeywordRegionAndTopic,
	isNaverRateLimitError,
	mergeDiscoveredTargets,
	resolveGoogleSearchCredentials,
	resolveNaverCredentials,
	type DiscoveredTarget,
	type DiscoverySkipReason,
	type DiscoveryStopReason,
} from '@/lib/crawling/target-discovery';
import {
	clampPlacesNeededCount,
	placeRecordToDiscoveredTarget,
	resolveGooglePlacesApiKey,
	searchPlacesByKeyword,
} from '@/lib/crawling/places';
import {
	blockedDomainsFromSave,
	saveDiscoveredTargets,
	summarizePersistence,
} from '@/lib/crawling/target-sites';
import type { TargetFinderResponse } from '@/lib/crawling/types';
import {
	CRAWL_COUNTRY_CODES,
	CRAWL_INDUSTRY_LABELS,
	type CrawlCountryCode,
} from '@/lib/crawling/taxonomy';

export const runtime = 'nodejs';
/** Naver webkr (display=100, ≤8 pages) + Google CSE top-up + contact scrape. */
export const maxDuration = 90;

const NAVER_RATE_LIMIT_UI_MESSAGE =
	'네이버 API 요청 속도 제한으로 잠시 후 다시 시도하거나 실존 샘플 데이터를 표출합니다';

/**
 * Bind monorepo-root + studio `.env` / `.env.local` into process.env.
 * Next already loads studio/.env; this also pulls repo-root keys and logs bind status.
 */
function ensureEnvBound(): void {
	const rootDir = path.join(process.cwd(), '..');
	const studioDir = process.cwd();
	const rootLoaded = loadEnvConfig(rootDir);
	const studioLoaded = loadEnvConfig(studioDir);

	const googleKey =
		process.env.GOOGLE_SEARCH_API_KEY?.trim() ||
		process.env.VITE_GOOGLE_MAP_API_KEY?.trim() ||
		'';
	const googleCx = process.env.GOOGLE_SEARCH_CX?.trim() || '';
	const placesKey =
		process.env.GOOGLE_PLACES_API_KEY?.trim() ||
		process.env.GOOGLE_MAPS_API_KEY?.trim() ||
		process.env.VITE_GOOGLE_MAP_API_KEY?.trim() ||
		'';
	const clientId = process.env.NAVER_CLIENT_ID?.trim() || '';
	const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim() || '';

	console.log('🔧 [Env Load Check]:', {
		cwd: studioDir,
		rootDir,
		loadedFromRoot: rootLoaded.loadedEnvFiles.map((f) => f.path),
		loadedFromStudio: studioLoaded.loadedEnvFiles.map((f) => f.path),
		hasGoogleSearchKey: Boolean(googleKey),
		hasGoogleSearchCx: Boolean(googleCx),
		hasGooglePlacesKey: Boolean(placesKey),
		hasNaverClientId: Boolean(clientId),
		hasNaverSecret: Boolean(clientSecret),
	});
}

ensureEnvBound();

type TargetFinderBody = {
	/** Unified search keyword (required) — e.g. "부산 사하구 피부과" */
	keyword?: string;
	displayCount?: number;
	limit?: number;
	country?: string;
	/** Legacy fields kept for backward compatibility */
	region?: string;
	category?: string;
	categoryCode?: string;
	allowSeedFallback?: boolean;
	/** `places` = Google Places Text Search only. Default = Naver → Places → CSE chain. */
	engine?: 'places' | 'web';
	location?: string;
};

/** Cap request size at 50 (UI: 10 / 20 / 50). */
function parseLimit(body: TargetFinderBody): number {
	const raw = body.displayCount ?? body.limit ?? 20;
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n)) return 20;
	return Math.min(Math.max(Math.floor(n), 1), 50);
}

function parseCountry(raw: unknown): CrawlCountryCode {
	if (typeof raw === 'string' && CRAWL_COUNTRY_CODES.includes(raw as CrawlCountryCode)) {
		return raw as CrawlCountryCode;
	}
	return 'KR';
}

type PersistenceMeta = NonNullable<
	Extract<TargetFinderResponse, { success: true }>['meta']
>['persistence'];

function toApiItem(t: DiscoveredTarget) {
	return {
		id: t.id,
		siteName: t.siteName,
		url: t.url,
		region: t.region,
		category: t.categoryLabel || CRAWL_INDUSTRY_LABELS[t.category] || t.category,
		categoryCode: t.category,
		country: t.country,
		crawledAt: t.crawledAt || new Date().toISOString(),
		source: t.source || 'seed',
		checkLocationNeeded: Boolean(t.checkLocationNeeded),
		parsedAddress: t.parsedAddress ?? null,
		phoneNumber: t.phoneNumber ?? null,
		googleRating: t.googleRating ?? null,
		googleReviewCount: t.googleReviewCount ?? null,
	};
}

/**
 * Upsert discovered URLs into `target_sites` and drop EXCLUDED / DIAGNOSED /
 * CONTACTED / blacklist hits so they never reappear as new leads.
 */
async function persistDiscovery(
	targets: DiscoveredTarget[],
	keyword: string,
): Promise<{ visible: DiscoveredTarget[]; persistence?: PersistenceMeta }> {
	if (targets.length === 0) {
		return { visible: targets };
	}
	try {
		const saved = await saveDiscoveredTargets(
			targets.map((target) => ({
				url: target.url,
				keyword,
				phoneNumber: target.phoneNumber,
				address: target.address || target.parsedAddress,
				googleRating: target.googleRating,
				googleReviewCount: target.googleReviewCount,
			})),
			{ keyword },
		);
		const blocked = blockedDomainsFromSave(saved);
		const locationByDomain = new Map<string, { checkLocationNeeded?: boolean; parsedAddress?: string | null }>();
		for (const row of [...saved.inserted, ...saved.updated]) {
			locationByDomain.set(row.domain, {
				checkLocationNeeded: row.checkLocationNeeded,
				parsedAddress: row.parsedAddress,
			});
		}
		const visible = targets.filter((target) => {
			const domain = extractRootDomain(target.url);
			if (!domain) return false;
			return !blocked.has(domain);
		}).map((target) => {
			const domain = extractRootDomain(target.url);
			const loc = domain ? locationByDomain.get(domain) : undefined;
			return {
				...target,
				checkLocationNeeded: loc?.checkLocationNeeded,
				parsedAddress: loc?.parsedAddress,
			};
		});
		const persistence = summarizePersistence(saved);
		console.log('💾 [target_sites persist]:', persistence);
		return { visible, persistence };
	} catch (error) {
		console.warn(
			'⚠️ target_sites persist failed — returning unfiltered discovery:',
			error instanceof Error ? error.message : error,
		);
		return { visible: targets };
	}
}

function fallbackJson(
	targets: DiscoveredTarget[],
	opts: {
		query: string;
		message: string;
		errorNotice?: string;
		country: CrawlCountryCode;
		persistence?: PersistenceMeta;
	},
) {
	return NextResponse.json({
		success: true,
		isFallback: true,
		message: opts.message,
		...(opts.errorNotice ? { errorNotice: opts.errorNotice } : {}),
		data: targets.map(toApiItem),
		meta: {
			query: opts.query,
			source: 'seed' as const,
			country: opts.country,
			returned: targets.length,
			note: opts.message,
			...(opts.persistence ? { persistence: opts.persistence } : {}),
		},
	});
}

function successJson(
	targets: DiscoveredTarget[],
	opts: {
		query: string;
		source: 'google' | 'naver' | 'places';
		country: CrawlCountryCode;
		scanned: number;
		requested: number;
		filteredNote: string;
		queriesUsed?: string[];
		stopReason?: DiscoveryStopReason;
		skipStats?: Partial<Record<DiscoverySkipReason, number>>;
		persistence?: PersistenceMeta;
	},
) {
	const trimmed = targets.slice(0, opts.requested);
	return NextResponse.json({
		success: true,
		isFallback: false,
		engine: opts.source,
		data: trimmed.map(toApiItem),
		meta: {
			query: opts.query,
			source: opts.source,
			country: opts.country,
			scanned: opts.scanned,
			requested: opts.requested,
			returned: trimmed.length,
			filteredNote: opts.filteredNote,
			...(opts.queriesUsed ? { queriesUsed: opts.queriesUsed } : {}),
			...(opts.stopReason ? { stopReason: opts.stopReason } : {}),
			...(opts.skipStats ? { skipStats: opts.skipStats } : {}),
			...(opts.persistence ? { persistence: opts.persistence } : {}),
		},
	});
}

function mergeSkipStats(
	a: Partial<Record<DiscoverySkipReason, number>> = {},
	b: Partial<Record<DiscoverySkipReason, number>> = {},
): Partial<Record<DiscoverySkipReason, number>> {
	const out: Partial<Record<DiscoverySkipReason, number>> = { ...a };
	for (const [key, value] of Object.entries(b) as [DiscoverySkipReason, number][]) {
		out[key] = (out[key] || 0) + (value || 0);
	}
	return out;
}

/**
 * POST /api/crawling/target-finder
 *
 * Discovers real business official homepages.
 * KR priority:
 *   1) Naver Web Search (display=100, ≤8 pages, district + industry expansion)
 *   2) Google Places Text Search top-up (website 있는 장소만)
 *   3) Google Custom Search top-up when still underfilled
 *   4) Sample/seed fallback
 * Non-KR: Google CSE → Places → seed (Naver is KR-only)
 * engine=places: Google Places only
 *
 * Env:
 *   NAVER_CLIENT_ID / NAVER_CLIENT_SECRET
 *   GOOGLE_SEARCH_API_KEY (+ optional VITE_GOOGLE_MAP_API_KEY fallback) + GOOGLE_SEARCH_CX
 *   GOOGLE_PLACES_API_KEY (fallback: VITE_GOOGLE_MAP_API_KEY)
 *
 * Body: { country?, keyword!, displayCount?, engine?, location? }
 */
export async function POST(req: NextRequest) {
	ensureEnvBound();

	let body: TargetFinderBody;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
	if (!keyword) {
		return NextResponse.json(
			{ error: '검색어를 입력해 주세요.' },
			{ status: 400 },
		);
	}

	const displayCount = parseLimit(body);
	const country = parseCountry(body.country);
	const region =
		(typeof body.region === 'string' && body.region.trim()) || keyword;
	const categoryLabel = keyword;
	const categoryCode = 'OTHER' as const;

	const allowSeedFallback = body.allowSeedFallback !== false;
	const googleQuery = buildGoogleSearchQuery(region, categoryLabel, keyword, categoryCode);
	const naverQuery = buildSearchQuery(region, categoryLabel, keyword, categoryCode);

	console.log('🔍 [Target-Finder Request]:', {
		country,
		keyword,
		googleQuery,
		displayCount,
	});

	const googleCreds = resolveGoogleSearchCredentials();
	const naverCreds = resolveNaverCredentials();
	const placesKey = resolveGooglePlacesApiKey();
	const extractedPlaces = extractKeywordRegionAndTopic(keyword);
	const placesLocation =
		(typeof body.location === 'string' && body.location.trim()) ||
		extractedPlaces.region ||
		region;
	const placesKeyword = extractedPlaces.topic || keyword;
	const placesOnly = body.engine === 'places';

	console.log('🔑 [Search API Keys Check]:', {
		hasGoogleSearchKey: Boolean(googleCreds?.apiKey),
		hasGoogleSearchCx: Boolean(googleCreds?.cx),
		hasGooglePlacesKey: Boolean(placesKey),
		hasNaverClientId: Boolean(naverCreds?.clientId),
		hasNaverSecret: Boolean(naverCreds?.clientSecret),
		engine: placesOnly ? 'places' : 'web',
		placesLocation,
		placesKeyword,
	});

	const discoveryInput = {
		region,
		category: categoryLabel,
		categoryCode,
		keyword,
		displayCount,
		country,
	};

	const seedFallback = async (message: string, errorNotice?: string) => {
		if (!allowSeedFallback) {
			return NextResponse.json({ error: message, code: 'NO_RESULTS' }, { status: 400 });
		}
		const samples =
			country === 'KR'
				? buildRealSampleFallbackTargets({
						region,
						categoryLabel,
						categoryCode,
						country: 'KR',
						limit: Math.min(displayCount, 5),
					})
				: discoverTargets({
						country,
						region,
						category: categoryCode,
						keyword,
						limit: Math.min(displayCount, 10) as 10 | 20 | 50,
					});
		const persisted = await persistDiscovery(samples, keyword);
		return fallbackJson(persisted.visible, {
			query: country === 'KR' ? naverQuery : googleQuery,
			country,
			message,
			errorNotice,
			persistence: persisted.persistence,
		});
	};

	const runGoogleTopUp = async (
		existing: DiscoveredTarget[],
		scanned: number,
		queriesUsed: string[],
		skipStats: Partial<Record<DiscoverySkipReason, number>>,
		stopReason?: DiscoveryStopReason,
	) => {
		if (!googleCreds || existing.length >= displayCount) {
			return { targets: existing, scanned, queriesUsed, skipStats, stopReason, usedGoogle: false };
		}
		const remaining = displayCount - existing.length;
		try {
			const googleResult = await discoverTargetsViaGoogle({
				...discoveryInput,
				displayCount: remaining,
			});
			console.log('📊 [Google Fallback Result]:', {
				returned: googleResult.targets.length,
				requested: remaining,
				stopReason: googleResult.stopReason,
				queriesUsed: googleResult.queriesUsed,
				skipStats: googleResult.skipStats,
			});
			const merged = mergeDiscoveredTargets(existing, googleResult.targets, displayCount);
			return {
				targets: merged,
				scanned: scanned + googleResult.scanned,
				queriesUsed: [...queriesUsed, ...googleResult.queriesUsed],
				skipStats: mergeSkipStats(skipStats, googleResult.skipStats),
				stopReason:
					merged.length >= displayCount
						? ('target_filled' as DiscoveryStopReason)
						: googleResult.stopReason || stopReason,
				usedGoogle: true,
			};
		} catch (error: unknown) {
			const message = axios.isAxiosError(error)
				? error.response?.data ?? error.message
				: error instanceof Error
					? error.message
					: String(error);
			console.warn('⚠️ Google Search API 폴백 실패:', message);
			return { targets: existing, scanned, queriesUsed, skipStats, stopReason, usedGoogle: false };
		}
	};

	const runPlacesTopUp = async (
		existing: DiscoveredTarget[],
		scanned: number,
		queriesUsed: string[],
		skipStats: Partial<Record<DiscoverySkipReason, number>>,
		stopReason?: DiscoveryStopReason,
	) => {
		if (!placesKey || existing.length >= displayCount) {
			return { targets: existing, scanned, queriesUsed, skipStats, stopReason, usedPlaces: false };
		}
		const remaining = displayCount - existing.length;
		try {
			const places = await searchPlacesByKeyword({
				location: placesLocation,
				keyword: placesKeyword,
				neededCount: clampPlacesNeededCount(Math.min(remaining * 2, 60)),
				language: country === 'KR' ? 'ko' : 'en',
				regionCode: country === 'KR' ? 'kr' : country === 'JP' ? 'jp' : 'us',
			});
			const stamp = Date.now();
			const extra: DiscoveredTarget[] = [];
			for (const [index, place] of places.entries()) {
				const target = placeRecordToDiscoveredTarget(place, {
					location: placesLocation,
					keyword: placesKeyword,
					country,
					category: categoryCode,
					index,
					stamp,
				});
				if (target) extra.push(target);
			}
			console.log('📊 [Google Places Fallback Result]:', {
				scanned: places.length,
				withWebsite: extra.length,
				requested: remaining,
			});
			const merged = mergeDiscoveredTargets(existing, extra, displayCount);
			return {
				targets: merged,
				scanned: scanned + places.length,
				queriesUsed: [...queriesUsed, `${placesLocation} ${placesKeyword}`.trim()],
				skipStats,
				stopReason:
					merged.length >= displayCount
						? ('target_filled' as DiscoveryStopReason)
						: stopReason,
				usedPlaces: extra.length > 0,
			};
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn('⚠️ Google Places API 폴백 실패:', message);
			return { targets: existing, scanned, queriesUsed, skipStats, stopReason, usedPlaces: false };
		}
	};

	if (placesOnly) {
		if (!placesKey) {
			return NextResponse.json(
				{
					error:
						'Google Places API 키가 설정되지 않았습니다. GOOGLE_PLACES_API_KEY 또는 VITE_GOOGLE_MAP_API_KEY를 확인하세요.',
					code: 'MISSING_PLACES_KEY',
				},
				{ status: 400 },
			);
		}
		const topped = await runPlacesTopUp([], 0, [], {}, undefined);
		if (topped.targets.length > 0) {
			const persisted = await persistDiscovery(topped.targets, keyword);
			return successJson(persisted.visible, {
				query: `${placesLocation} ${placesKeyword}`.trim(),
				source: 'places',
				country,
				scanned: topped.scanned,
				requested: displayCount,
				filteredNote:
					'Google Places Text Search → 웹사이트 있는 장소만 → 홈페이지 연락처 크롤 → target_sites 저장 (도메인/전화번호 중복 제외).',
				queriesUsed: topped.queriesUsed,
				stopReason: topped.stopReason,
				skipStats: topped.skipStats,
				persistence: persisted.persistence,
			});
		}
		return seedFallback(
			'Google Places에서 웹사이트가 있는 장소를 찾지 못해 폴백 데이터를 반환합니다.',
		);
	}

	// ─────────────────────────────────────────────────────────────
	// Non-KR: Google CSE → Places top-up (Naver Web/Local is KR-only)
	// ─────────────────────────────────────────────────────────────
	if (country !== 'KR') {
		let overseas: DiscoveredTarget[] = [];
		let overseasScanned = 0;
		let overseasQueries: string[] = [];
		let overseasSkip: Partial<Record<DiscoverySkipReason, number>> = {};
		let overseasStop: DiscoveryStopReason | undefined;
		if (googleCreds) {
			try {
				const result = await discoverTargetsViaGoogle(discoveryInput);
				overseas = result.targets;
				overseasScanned = result.scanned;
				overseasQueries = result.queriesUsed;
				overseasSkip = result.skipStats;
				overseasStop = result.stopReason;
			} catch (error: unknown) {
				const message = axios.isAxiosError(error)
					? error.response?.data ?? error.message
					: error instanceof Error
						? error.message
						: String(error);
				console.warn('⚠️ Google Search API 실패:', message);
			}
		}
		if (overseas.length < displayCount) {
			const topped = await runPlacesTopUp(
				overseas,
				overseasScanned,
				overseasQueries,
				overseasSkip,
				overseasStop,
			);
			overseas = topped.targets;
			overseasScanned = topped.scanned;
			overseasQueries = topped.queriesUsed;
			overseasSkip = topped.skipStats;
			overseasStop = topped.stopReason;
		}
		if (overseas.length > 0) {
			const persisted = await persistDiscovery(overseas, keyword);
			const usedPlaces = overseas.some((t) => t.source === 'places');
			return successJson(persisted.visible, {
				query: googleQuery,
				source: usedPlaces && !overseas.some((t) => t.source === 'google') ? 'places' : 'google',
				country,
				scanned: overseasScanned,
				requested: displayCount,
				filteredNote: usedPlaces
					? 'Google CSE + Google Places(웹사이트 있는 장소) 보강. 포털/SNS 제외.'
					: 'Google CSE (최대 10페이지) + 포털/SNS/.go.kr·.or.kr 제외.',
				queriesUsed: overseasQueries,
				stopReason: overseasStop,
				skipStats: overseasSkip,
				persistence: persisted.persistence,
			});
		}
		if (!allowSeedFallback) {
			return NextResponse.json(
				{
					error:
						'구글 검색 결과가 없고, 네이버 검색은 대한민국(KR) 타겟만 지원합니다.',
					code: 'UNSUPPORTED_COUNTRY',
				},
				{ status: 400 },
			);
		}
		return seedFallback(
			googleCreds
				? '구글 검색에서 자사 홈페이지를 찾지 못해 시드 후보로 대체했습니다.'
				: '구글 검색 키가 없고 네이버 검색은 KR 전용입니다. 시드 후보로 대체했습니다.',
		);
	}

	// ─────────────────────────────────────────────────────────────
	// KR 1) Naver Web Search (display=100, ≤8 pages, query expansion)
	// ─────────────────────────────────────────────────────────────
	let collected: DiscoveredTarget[] = [];
	let scanned = 0;
	let queriesUsed: string[] = [];
	let skipStats: Partial<Record<DiscoverySkipReason, number>> = {};
	let stopReason: DiscoveryStopReason | undefined;
	let primaryQuery = naverQuery;
	let naverRateLimited = false;

	if (naverCreds) {
		try {
			const naverResult = await discoverTargetsViaNaver(discoveryInput);
			collected = naverResult.targets;
			scanned = naverResult.scanned;
			queriesUsed = naverResult.queriesUsed;
			skipStats = naverResult.skipStats;
			stopReason = naverResult.stopReason;
			primaryQuery = naverResult.query;
			console.log('📊 [Naver Web Search Result]:', {
				returned: naverResult.targets.length,
				requested: displayCount,
				stopReason: naverResult.stopReason,
				queriesUsed: naverResult.queriesUsed,
				skipStats: naverResult.skipStats,
			});
		} catch (error: unknown) {
			naverRateLimited = isNaverRateLimitError(error);
			if (naverRateLimited) {
				console.warn(
					'⚠️ 네이버 API 초당 요청 제한(Rate Limit) 도달. 구글 폴백으로 전환.',
					axios.isAxiosError(error) ? error.response?.data : undefined,
				);
			} else if (axios.isAxiosError(error)) {
				console.error(
					'❌ [Naver API Error Details]:',
					error.response?.data ?? error.message,
				);
			} else {
				const message = error instanceof Error ? error.message : String(error);
				console.error('❌ [Naver API Error Details]:', message);
			}
		}
	} else {
		console.warn(
			'⚠️ 네이버 API 키가 읽히지 않았습니다. studio/.env · studio/.env.local · 루트 .env 경로를 확인하세요.',
		);
	}

	// ─────────────────────────────────────────────────────────────
	// KR 2) Google Places — local businesses with a website
	// ─────────────────────────────────────────────────────────────
	if (collected.length < displayCount) {
		if (collected.length > 0) {
			console.warn(
				`⚠️ Naver underfill (${collected.length}/${displayCount}) — switching to Google Places.`,
			);
		} else {
			console.warn('⚠️ Naver returned 0 eligible homepages — switching to Google Places.');
		}
		const placesTop = await runPlacesTopUp(collected, scanned, queriesUsed, skipStats, stopReason);
		collected = placesTop.targets;
		scanned = placesTop.scanned;
		queriesUsed = placesTop.queriesUsed;
		skipStats = placesTop.skipStats;
		stopReason = placesTop.stopReason;
	}

	// ─────────────────────────────────────────────────────────────
	// KR 3) Google Custom Search — 3rd engine when still underfilled
	// ─────────────────────────────────────────────────────────────
	if (collected.length < displayCount) {
		if (collected.length > 0) {
			console.warn(
				`⚠️ Places underfill (${collected.length}/${displayCount}) — switching to Google CSE fallback.`,
			);
		} else {
			console.warn('⚠️ Places returned 0 eligible homepages — switching to Google CSE fallback.');
		}
		const topped = await runGoogleTopUp(collected, scanned, queriesUsed, skipStats, stopReason);
		collected = topped.targets;
		scanned = topped.scanned;
		queriesUsed = topped.queriesUsed;
		skipStats = topped.skipStats;
		stopReason = topped.stopReason;
	}

	if (collected.length > 0) {
		const persisted = await persistDiscovery(collected, keyword);
		const usedGoogle = collected.some((t) => t.source === 'google');
		const usedNaver = collected.some((t) => t.source === 'naver');
		const usedPlaces = collected.some((t) => t.source === 'places');
		const source: 'google' | 'naver' | 'places' = usedNaver
			? 'naver'
			: usedPlaces
				? 'places'
				: 'google';
		const chainNote = [
			usedNaver ? '네이버 웹검색' : null,
			usedPlaces ? 'Google Places(웹사이트 있는 장소)' : null,
			usedGoogle ? 'Google CSE' : null,
		]
			.filter(Boolean)
			.join(' → ');
		return successJson(persisted.visible, {
			query: primaryQuery,
			source,
			country: 'KR',
			scanned,
			requested: displayCount,
			filteredNote: `${chainNote}. 포털/SNS/.go.kr·.or.kr 제외. 도메인/전화번호 중복 제외. 주소 기준 타 지역 자동 제외.`,
			queriesUsed,
			stopReason,
			skipStats,
			persistence: persisted.persistence,
		});
	}

	const notice = naverRateLimited
		? NAVER_RATE_LIMIT_UI_MESSAGE
		: !naverCreds && !googleCreds && !placesKey
			? '구글/네이버 API 키가 읽히지 않아 기본 실존 샘플 리스트로 반환합니다.'
			: '검색 API에서 자사 홈페이지를 찾지 못해 폴백 데이터를 반환합니다.';

	return seedFallback(notice, naverRateLimited ? notice : undefined);
}
