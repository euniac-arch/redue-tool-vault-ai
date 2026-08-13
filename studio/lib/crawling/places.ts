import axios from 'axios';
import {
	isEligibleBusinessHomepage,
	normalizeHttpUrl,
	softIdentityDedupeKey,
	toOfficialHomepageUrl,
	type DiscoveredTarget,
} from '@/lib/crawling/target-discovery';
import { extractRootDomain } from '@/lib/crawling/domain';
import { mapWithConcurrency } from '@/lib/crawling/contact-info';
import {
	saveDiscoveredTargets,
	summarizePersistence,
	type SaveDiscoveredTargetsResult,
} from '@/lib/crawling/target-sites';
import type { CrawlCountryCode, CrawlIndustryCode } from '@/lib/crawling/taxonomy';

const PLACES_TEXT_SEARCH_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACES_DETAILS_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/details/json';

/** Legacy Text Search returns up to 20 rows per page, 3 pages max. */
const PLACES_PAGE_SIZE = 20;
const PLACES_MAX_PAGES = 3;
const PLACES_DISPLAY_MAX = 60;
/** Google requires a short pause before `next_page_token` becomes valid. */
const PLACES_NEXT_PAGE_DELAY_MS = 2_000;
const PLACES_DETAILS_CONCURRENCY = 5;
const PLACES_DETAILS_FIELDS = [
	'name',
	'formatted_address',
	'formatted_phone_number',
	'international_phone_number',
	'website',
	'rating',
	'user_ratings_total',
	'place_id',
].join(',');

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type PlaceRecord = {
	placeId: string;
	name: string;
	formatted_address: string | null;
	formatted_phone_number: string | null;
	website: string | null;
	rating: number | null;
	user_ratings_total: number | null;
};

export type SearchPlacesInput = {
	location: string;
	keyword: string;
	neededCount: number;
	language?: string;
	regionCode?: string;
};

export type GoogleTextSearchItem = {
	place_id?: string;
	name?: string;
	formatted_address?: string;
	rating?: number;
	user_ratings_total?: number;
};

export type GooglePlaceDetailsResult = {
	place_id?: string;
	name?: string;
	formatted_address?: string;
	formatted_phone_number?: string;
	international_phone_number?: string;
	website?: string;
	rating?: number;
	user_ratings_total?: number;
};

type GooglePlacesStatus =
	| 'OK'
	| 'ZERO_RESULTS'
	| 'OVER_QUERY_LIMIT'
	| 'REQUEST_DENIED'
	| 'INVALID_REQUEST'
	| 'NOT_FOUND'
	| 'UNKNOWN_ERROR';

/**
 * Places API key resolve order:
 *   GOOGLE_PLACES_API_KEY → GOOGLE_MAPS_API_KEY → VITE_GOOGLE_MAP_API_KEY → GOOGLE_SEARCH_API_KEY
 */
export function resolveGooglePlacesApiKey(): string {
	return (
		process.env.GOOGLE_PLACES_API_KEY?.trim() ||
		process.env.GOOGLE_MAPS_API_KEY?.trim() ||
		process.env.VITE_GOOGLE_MAP_API_KEY?.trim() ||
		process.env.GOOGLE_SEARCH_API_KEY?.trim() ||
		''
	);
}

/** `"부산" + "화장품"` → `"부산 화장품"` (avoid duplicating the metro already in the keyword). */
export function buildPlacesTextQuery(location: string, keyword: string): string {
	const loc = location.trim();
	const kw = keyword.trim();
	if (loc && kw) {
		if (kw === loc || kw.startsWith(`${loc} `) || kw.includes(loc)) return kw;
		if (loc.startsWith(`${kw} `) || loc.includes(kw)) return loc;
		return `${loc} ${kw}`;
	}
	return loc || kw;
}

export function clampPlacesNeededCount(raw: unknown): number {
	const n = typeof raw === 'number' ? raw : Number(raw);
	if (!Number.isFinite(n)) return 20;
	return Math.min(Math.max(Math.floor(n), 1), PLACES_DISPLAY_MAX);
}

function asFiniteNumber(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return value;
}

function asNonEmptyString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

export function mapGooglePlaceToRecord(
	textItem: GoogleTextSearchItem,
	details?: GooglePlaceDetailsResult | null,
): PlaceRecord | null {
	const placeId =
		asNonEmptyString(details?.place_id) || asNonEmptyString(textItem.place_id) || '';
	const name = asNonEmptyString(details?.name) || asNonEmptyString(textItem.name) || '';
	if (!placeId && !name) return null;

	const websiteRaw = asNonEmptyString(details?.website);
	const website = websiteRaw ? normalizeHttpUrl(websiteRaw) : null;
	const phone =
		asNonEmptyString(details?.formatted_phone_number) ||
		asNonEmptyString(details?.international_phone_number);

	return {
		placeId: placeId || `name:${name}`,
		name,
		formatted_address:
			asNonEmptyString(details?.formatted_address) ||
			asNonEmptyString(textItem.formatted_address),
		formatted_phone_number: phone,
		website,
		rating: asFiniteNumber(details?.rating) ?? asFiniteNumber(textItem.rating),
		user_ratings_total:
			asFiniteNumber(details?.user_ratings_total) ??
			asFiniteNumber(textItem.user_ratings_total),
	};
}

export function isPlaceWebsiteEligible(website: string | null | undefined): boolean {
	const raw = typeof website === 'string' ? website.trim() : '';
	if (!raw) return false;
	return isEligibleBusinessHomepage(raw);
}

function placesStatusMessage(status: string, errorMessage?: string): string {
	if (errorMessage?.trim()) return errorMessage.trim();
	switch (status as GooglePlacesStatus) {
		case 'REQUEST_DENIED':
			return 'Google Places API 요청이 거부되었습니다. Places API 활성화와 API 키 제한을 확인하세요.';
		case 'OVER_QUERY_LIMIT':
			return 'Google Places API 할당량을 초과했습니다. 잠시 후 다시 시도해 주세요.';
		case 'INVALID_REQUEST':
			return 'Google Places API 요청이 올바르지 않습니다.';
		case 'UNKNOWN_ERROR':
			return 'Google Places API 서버 오류입니다. 잠시 후 다시 시도해 주세요.';
		default:
			return `Google Places API 오류 (${status})`;
	}
}

async function fetchTextSearchPage(input: {
	query: string;
	apiKey: string;
	language: string;
	regionCode: string;
	pageToken?: string;
}): Promise<{ items: GoogleTextSearchItem[]; nextPageToken: string | null; status: string }> {
	const res = await axios.get<{
		status?: string;
		error_message?: string;
		results?: GoogleTextSearchItem[];
		next_page_token?: string;
	}>(PLACES_TEXT_SEARCH_ENDPOINT, {
		params: {
			query: input.query,
			key: input.apiKey,
			language: input.language,
			region: input.regionCode,
			...(input.pageToken ? { pagetoken: input.pageToken } : {}),
		},
		timeout: 8_000,
		validateStatus: (s) => s >= 200 && s < 300,
	});

	const status = String(res.data?.status || 'UNKNOWN_ERROR');
	if (status === 'ZERO_RESULTS' || status === 'OK') {
		return {
			items: Array.isArray(res.data?.results) ? res.data.results : [],
			nextPageToken: asNonEmptyString(res.data?.next_page_token),
			status,
		};
	}

	throw new Error(placesStatusMessage(status, res.data?.error_message));
}

async function fetchPlaceDetails(
	placeId: string,
	apiKey: string,
	language: string,
): Promise<GooglePlaceDetailsResult | null> {
	try {
		const res = await axios.get<{
			status?: string;
			result?: GooglePlaceDetailsResult;
		}>(PLACES_DETAILS_ENDPOINT, {
			params: {
				place_id: placeId,
				fields: PLACES_DETAILS_FIELDS,
				key: apiKey,
				language,
			},
			timeout: 6_000,
			validateStatus: (s) => s >= 200 && s < 300,
		});
		if (res.data?.status !== 'OK' || !res.data.result) return null;
		return res.data.result;
	} catch (error) {
		console.warn(
			'[places] details failed:',
			placeId,
			axios.isAxiosError(error) ? error.response?.data ?? error.message : error,
		);
		return null;
	}
}

/**
 * Google Places Text Search → Place Details.
 * Collects up to `neededCount` place records (website may still be empty).
 */
export async function searchPlacesByKeyword(input: SearchPlacesInput): Promise<PlaceRecord[]> {
	const apiKey = resolveGooglePlacesApiKey();
	if (!apiKey) {
		throw new Error(
			'Google Places API 키가 설정되지 않았습니다. (GOOGLE_PLACES_API_KEY / VITE_GOOGLE_MAP_API_KEY)',
		);
	}

	const query = buildPlacesTextQuery(input.location, input.keyword);
	if (!query) {
		throw new Error('지역(location) 또는 검색어(keyword)를 입력해 주세요.');
	}

	const neededCount = clampPlacesNeededCount(input.neededCount);
	const language = (input.language || 'ko').trim() || 'ko';
	const regionCode = (input.regionCode || 'kr').trim().toLowerCase() || 'kr';

	console.log('🗺️ [Google Places Text Search]:', {
		query,
		neededCount,
		language,
		regionCode,
	});

	const collected: PlaceRecord[] = [];
	const seenPlaceIds = new Set<string>();
	let pageToken: string | undefined;
	let scanned = 0;

	for (let page = 0; page < PLACES_MAX_PAGES && collected.length < neededCount; page += 1) {
		if (pageToken) {
			await sleep(PLACES_NEXT_PAGE_DELAY_MS);
		}

		let pageResult: { items: GoogleTextSearchItem[]; nextPageToken: string | null };
		try {
			pageResult = await fetchTextSearchPage({
				query,
				apiKey,
				language,
				regionCode,
				pageToken,
			});
		} catch (error) {
			if (collected.length > 0) {
				console.warn(
					'⚠️ Places pagination stopped — returning partial results:',
					error instanceof Error ? error.message : error,
				);
				break;
			}
			throw error;
		}

		scanned += pageResult.items.length;
		if (pageResult.items.length === 0) break;

		const detailed = await mapWithConcurrency(
			pageResult.items,
			PLACES_DETAILS_CONCURRENCY,
			async (item) => {
				const placeId = asNonEmptyString(item.place_id);
				const details = placeId ? await fetchPlaceDetails(placeId, apiKey, language) : null;
				return mapGooglePlaceToRecord(item, details);
			},
		);

		for (const place of detailed) {
			if (!place) continue;
			if (seenPlaceIds.has(place.placeId)) continue;
			seenPlaceIds.add(place.placeId);
			collected.push(place);
			if (collected.length >= neededCount) break;
		}

		if (!pageResult.nextPageToken) break;
		pageToken = pageResult.nextPageToken;
		if (pageResult.items.length < PLACES_PAGE_SIZE) break;
	}

	console.log('🗺️ [Google Places Result]:', {
		query,
		scanned,
		returned: collected.length,
		requested: neededCount,
		withWebsite: collected.filter((row) => isPlaceWebsiteEligible(row.website)).length,
	});

	return collected.slice(0, neededCount);
}

export function placeRecordToDiscoveredTarget(
	place: PlaceRecord,
	input: {
		location: string;
		keyword: string;
		country?: CrawlCountryCode;
		category?: CrawlIndustryCode;
		index: number;
		stamp?: number;
	},
): DiscoveredTarget | null {
	if (!isPlaceWebsiteEligible(place.website)) return null;
	const homepage = toOfficialHomepageUrl(place.website as string);
	const domain = extractRootDomain(homepage);
	if (!domain) return null;

	const stamp = input.stamp ?? Date.now();
	return {
		id: `target_p_${stamp}_${input.index}`,
		siteName: place.name || homepage,
		url: homepage,
		region: input.location || input.keyword,
		category: input.category || 'OTHER',
		categoryLabel: input.keyword || place.name,
		country: input.country || 'KR',
		crawledAt: new Date().toISOString(),
		source: 'places',
		parsedAddress: place.formatted_address,
		phoneNumber: place.formatted_phone_number,
		address: place.formatted_address,
		googleRating: place.rating,
		googleReviewCount: place.user_ratings_total,
	};
}

export type CollectPlacesPipelineInput = SearchPlacesInput & {
	country?: CrawlCountryCode;
	category?: CrawlIndustryCode;
	enrichContact?: boolean;
	contactConcurrency?: number;
	contactBudgetMs?: number;
};

export type CollectPlacesPipelineResult = {
	query: string;
	places: PlaceRecord[];
	withWebsite: PlaceRecord[];
	targets: DiscoveredTarget[];
	persisted: SaveDiscoveredTargetsResult;
	persistence: ReturnType<typeof summarizePersistence>;
};

/**
 * Places → website-only filter → `extractContactInfo` (via saveDiscoveredTargets)
 * → `target_sites` upsert with domain / phone dedup.
 */
export async function collectPlacesPipeline(
	input: CollectPlacesPipelineInput,
): Promise<CollectPlacesPipelineResult> {
	const neededCount = clampPlacesNeededCount(input.neededCount);
	const query = buildPlacesTextQuery(input.location, input.keyword);
	const fetchCount = Math.min(Math.max(neededCount * 2, neededCount), PLACES_DISPLAY_MAX);

	const places = await searchPlacesByKeyword({
		...input,
		neededCount: fetchCount,
	});

	const seenHosts = new Set<string>();
	const seenIdentity = new Set<string>();
	const withWebsite: PlaceRecord[] = [];
	const targets: DiscoveredTarget[] = [];
	const stamp = Date.now();
	const keyword = query;

	for (const [index, place] of places.entries()) {
		if (targets.length >= neededCount) break;
		if (!isPlaceWebsiteEligible(place.website)) continue;

		const target = placeRecordToDiscoveredTarget(place, {
			location: input.location,
			keyword: input.keyword,
			country: input.country,
			category: input.category,
			index,
			stamp,
		});
		if (!target) continue;

		const hostKey = extractRootDomain(target.url);
		if (!hostKey || seenHosts.has(hostKey)) continue;

		const identity = softIdentityDedupeKey({
			siteName: target.siteName,
			telephone: place.formatted_phone_number || undefined,
			address: place.formatted_address || undefined,
		});
		if (identity && seenIdentity.has(identity)) continue;

		seenHosts.add(hostKey);
		if (identity) seenIdentity.add(identity);
		withWebsite.push(place);
		targets.push(target);
	}

	const persisted = await saveDiscoveredTargets(
		targets.map((target) => ({
			url: target.url,
			keyword,
			phoneNumber: target.phoneNumber,
			address: target.address || target.parsedAddress,
			googleRating: target.googleRating,
			googleReviewCount: target.googleReviewCount,
		})),
		{
			keyword,
			enrichContact: input.enrichContact !== false,
			contactConcurrency: input.contactConcurrency,
			contactBudgetMs: input.contactBudgetMs,
			targetRegion: input.location,
		},
	);

	return {
		query,
		places,
		withWebsite,
		targets,
		persisted,
		persistence: summarizePersistence(persisted),
	};
}
