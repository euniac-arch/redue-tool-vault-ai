/**
 * Live NAP harvest for map / social channels.
 *
 * Place pages (Naver / Kakao / GBP / Instagram) block plain HTML fetches and
 * often render via CSR, so this module prefers official search APIs and a
 * short SERP-snippet fallback. When every live source is blocked the channel
 * is marked `blocked` so the matrix can show UNAVAILABLE instead of a fake MATCH.
 */

import 'server-only';

import { isSameBrandEntity } from '@/lib/geo/brand-entities';
import {
	buildNapMatrix,
	inputFromReport,
	NAP_COLLECTION_BLOCKED_NOTE,
	type NapChannelCollected,
	type NapChannelId,
	type NapMatrixBuildInput,
} from '@/lib/audit/nap-matrix';
import {
	isGoogleMapsGbpUrl,
	isKakaoChannelMapUrl,
	isNaverPlaceMapUrl,
} from '@/lib/audit/extractors/universal-same-as';
import type { AuditReport } from '@/lib/site-auditor';
import type { NapMatrix } from '@/types/guide';

const FETCH_MS = 3_800;
const OVERALL_MS = 6_500;
const NAVER_LOCAL_ENDPOINT = 'https://openapi.naver.com/v1/search/local.json';
const GOOGLE_TEXT_SEARCH_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const GOOGLE_PLACE_DETAILS_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/details/json';
const KAKAO_KEYWORD_ENDPOINT = 'https://dapi.kakao.com/v2/local/search/keyword.json';

type Listing = NapChannelCollected & { score?: number };

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function stripHtml(value: string): string {
	return compact(value.replace(/<[^>]*>/g, '').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>'));
}

function phoneDigits(value: string): string {
	let digits = compact(value).replace(/\D/g, '');
	if (digits.startsWith('82') && digits.length >= 11) digits = `0${digits.slice(2)}`;
	return digits;
}

function localityHint(address: string): string {
	const parts = compact(address).split(/\s+/).filter(Boolean);
	return parts.slice(0, 3).join(' ');
}

function searchQuery(input: NapMatrixBuildInput): string {
	const brand = compact(input.brandName);
	const area = localityHint(input.address || '');
	return compact([brand, area].filter(Boolean).join(' '));
}

function listingScore(listing: NapChannelCollected, input: NapMatrixBuildInput): number {
	const brand = compact(input.brandName);
	const name = compact(listing.name);
	let score = 0;
	if (brand && name && isSameBrandEntity(name, brand)) score += 8;
	else if (brand && name && name.replace(/\s+/g, '').includes(brand.replace(/\s+/g, ''))) score += 4;
	const a = phoneDigits(input.telephone || '');
	const b = phoneDigits(listing.phone || '');
	if (a && b && a === b) score += 6;
	const addrA = compact(input.address);
	const addrB = compact(listing.address);
	if (addrA && addrB) {
		const tokens = localityHint(addrA).split(/\s+/).filter((t) => t.length >= 2);
		if (tokens.some((token) => addrB.includes(token))) score += 3;
	}
	return score;
}

export function pickBestListing(listings: Listing[], input: NapMatrixBuildInput): Listing | null {
	let best: Listing | null = null;
	for (const listing of listings) {
		if (!compact(listing.name) && !compact(listing.address) && !compact(listing.phone)) continue;
		const score = listingScore(listing, input);
		if (score < 4) continue;
		if (!best || score > (best.score || 0)) best = { ...listing, score };
	}
	return best;
}

function naverCreds(): { clientId: string; clientSecret: string } | null {
	const clientId = (process.env.NAVER_CLIENT_ID || '').trim();
	const clientSecret = (process.env.NAVER_CLIENT_SECRET || '').trim();
	return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function googlePlacesKey(): string {
	return (
		process.env.GOOGLE_PLACES_API_KEY?.trim() ||
		process.env.GOOGLE_MAPS_API_KEY?.trim() ||
		process.env.VITE_GOOGLE_MAP_API_KEY?.trim() ||
		process.env.GOOGLE_SEARCH_API_KEY?.trim() ||
		''
	);
}

function kakaoRestKey(): string {
	return (process.env.KAKAO_CLIENT_ID || process.env.KAKAO_REST_API_KEY || '').trim();
}

function youtubeKey(): string {
	return (
		process.env.YOUTUBE_API_KEY?.trim() ||
		process.env.GOOGLE_YOUTUBE_API_KEY?.trim() ||
		''
	);
}

function classifyUrls(urls: readonly string[]) {
	const out: Partial<Record<NapChannelId, string>> = {};
	for (const raw of urls) {
		const value = compact(raw);
		if (!value) continue;
		let host = value.toLowerCase();
		try {
			host = new URL(value).hostname.toLowerCase();
		} catch {
			/* keep */
		}
		if (!out.youtube && (host.includes('youtube.com') || host.includes('youtu.be'))) out.youtube = value;
		else if (!out.sns && (host.includes('instagram.com') || host.includes('facebook.com'))) out.sns = value;
		else if (!out.naver_place && isNaverPlaceMapUrl(value)) out.naver_place = value;
		else if (!out.google_business && isGoogleMapsGbpUrl(value)) out.google_business = value;
		else if (!out.bing_places && /bing\.com\/(maps|local)|bingplaces/i.test(value)) out.bing_places = value;
		else if (!out.kakao_tmap && (isKakaoChannelMapUrl(value) || /tmap|t-map/i.test(value))) out.kakao_tmap = value;
	}
	return out;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
	try {
		const res = await fetch(url, {
			...init,
			signal: init?.signal ?? AbortSignal.timeout(FETCH_MS),
			cache: 'no-store',
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

async function searchNaverLocal(query: string, input: NapMatrixBuildInput): Promise<Listing | null> {
	const creds = naverCreds();
	if (!creds || !query) return null;
	const url = new URL(NAVER_LOCAL_ENDPOINT);
	url.searchParams.set('query', query);
	url.searchParams.set('display', '8');
	url.searchParams.set('sort', 'comment');
	const data = await fetchJson<{
		items?: Array<{ title?: string; telephone?: string; address?: string; roadAddress?: string }>;
	}>(url.toString(), {
		headers: {
			'X-Naver-Client-Id': creds.clientId,
			'X-Naver-Client-Secret': creds.clientSecret,
		},
	});
	const listings = (data?.items || []).map((item) => ({
		name: stripHtml(item.title || ''),
		address: compact(item.roadAddress || item.address),
		phone: compact(item.telephone),
	}));
	return pickBestListing(listings, input);
}

async function searchGooglePlaces(query: string, input: NapMatrixBuildInput): Promise<Listing | null> {
	const key = googlePlacesKey();
	if (!key || !query) return null;
	const url = new URL(GOOGLE_TEXT_SEARCH_ENDPOINT);
	url.searchParams.set('query', query);
	url.searchParams.set('key', key);
	url.searchParams.set('language', 'ko');
	url.searchParams.set('region', 'kr');
	const data = await fetchJson<{
		status?: string;
		results?: Array<{ name?: string; formatted_address?: string; place_id?: string }>;
	}>(url.toString());
	if (!data || (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS')) return null;
	const firstPass = (data.results || []).map((item) => ({
		name: compact(item.name),
		address: compact(item.formatted_address),
		placeId: item.place_id,
	}));
	const best = pickBestListing(firstPass, input);
	if (!best) return null;
	const placeId = firstPass.find((item) => item.name === best.name)?.placeId;
	if (!placeId) return best;
	const detailUrl = new URL(GOOGLE_PLACE_DETAILS_ENDPOINT);
	detailUrl.searchParams.set('place_id', placeId);
	detailUrl.searchParams.set('fields', 'name,formatted_address,formatted_phone_number');
	detailUrl.searchParams.set('key', key);
	detailUrl.searchParams.set('language', 'ko');
	const detail = await fetchJson<{
		result?: { name?: string; formatted_address?: string; formatted_phone_number?: string };
	}>(detailUrl.toString());
	return {
		name: compact(detail?.result?.name) || best.name,
		address: compact(detail?.result?.formatted_address) || best.address,
		phone: compact(detail?.result?.formatted_phone_number) || best.phone,
	};
}

async function searchKakaoLocal(query: string, input: NapMatrixBuildInput): Promise<Listing | null> {
	const key = kakaoRestKey();
	if (!key || !query) return null;
	const url = new URL(KAKAO_KEYWORD_ENDPOINT);
	url.searchParams.set('query', query);
	url.searchParams.set('size', '8');
	const data = await fetchJson<{
		documents?: Array<{ place_name?: string; phone?: string; address_name?: string; road_address_name?: string }>;
	}>(url.toString(), {
		headers: { Authorization: `KakaoAK ${key}` },
	});
	const listings = (data?.documents || []).map((item) => ({
		name: compact(item.place_name),
		address: compact(item.road_address_name || item.address_name),
		phone: compact(item.phone),
	}));
	return pickBestListing(listings, input);
}

/** Last-resort: parse NAP-looking tokens from a public search-result page. */
async function searchSerpSnippet(query: string, input: NapMatrixBuildInput): Promise<Listing | null> {
	if (!query) return null;
	try {
		const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
		const res = await fetch(url, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
			},
			signal: AbortSignal.timeout(FETCH_MS),
			cache: 'no-store',
		});
		if (!res.ok) return null;
		const html = await res.text();
		if (/captcha|unusual traffic|access denied|robot/i.test(html) && html.length < 4_000) return null;
		const phoneMatch = html.match(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/);
		const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
		let name = '';
		let address = '';
		let phone = compact(phoneMatch?.[0]);
		if (jsonLdMatch?.[1]) {
			try {
				const parsed = JSON.parse(jsonLdMatch[1]) as Record<string, unknown>;
				name = compact(String(parsed.name || ''));
				const addr = parsed.address;
				if (typeof addr === 'string') address = compact(addr);
				else if (addr && typeof addr === 'object') {
					const row = addr as Record<string, unknown>;
					address = compact(String(row.streetAddress || row.name || ''));
				}
				if (!phone) phone = compact(String(parsed.telephone || ''));
			} catch {
				/* ignore malformed JSON-LD */
			}
		}
		const listing = { name: name || compact(input.brandName), address, phone };
		return pickBestListing([listing], input);
	} catch {
		return null;
	}
}

async function fetchYoutubeTitle(profileUrl: string): Promise<string> {
	const oembed = await fetchJson<{ title?: string; author_name?: string }>(
		`https://www.youtube.com/oembed?url=${encodeURIComponent(profileUrl)}&format=json`,
	);
	const fromEmbed = compact(oembed?.author_name || oembed?.title);
	if (fromEmbed) return fromEmbed;

	const key = youtubeKey();
	const handle = profileUrl.match(/youtube\.com\/@([^/?#]+)/i)?.[1];
	const channelId = profileUrl.match(/youtube\.com\/channel\/([^/?#]+)/i)?.[1];
	if (!key || (!handle && !channelId)) return '';
	const url = new URL('https://www.googleapis.com/youtube/v3/channels');
	url.searchParams.set('part', 'snippet');
	url.searchParams.set('key', key);
	if (channelId) url.searchParams.set('id', channelId);
	else url.searchParams.set('forHandle', handle || '');
	const data = await fetchJson<{ items?: Array<{ snippet?: { title?: string } }> }>(url.toString());
	return compact(data?.items?.[0]?.snippet?.title);
}

function blocked(reason = NAP_COLLECTION_BLOCKED_NOTE): NapChannelCollected {
	return { blocked: true, blockReason: reason };
}

function fromListing(listing: Listing | null): NapChannelCollected | undefined {
	if (!listing) return undefined;
	const next: NapChannelCollected = {
		name: compact(listing.name) || undefined,
		address: compact(listing.address) || undefined,
		phone: compact(listing.phone) || undefined,
	};
	return next.name || next.address || next.phone ? next : undefined;
}

export async function collectExternalChannelNap(
	input: NapMatrixBuildInput,
): Promise<Partial<Record<NapChannelId, NapChannelCollected>>> {
	const brand = compact(input.brandName);
	if (!brand) return {};

	const urlPool = [
		...(input.sameAs || []),
		...(input.collectedUrls || []),
		input.socialLinks?.youtube,
		input.socialLinks?.instagram,
		input.socialLinks?.facebook,
		input.socialLinks?.blog,
	].filter((url): url is string => Boolean(compact(url)));
	const urls = classifyUrls(urlPool);
	const query = searchQuery(input);

	const [naver, google, kakao] = await Promise.all([
		searchNaverLocal(query, input),
		searchGooglePlaces(query, input),
		searchKakaoLocal(query, input),
	]);

	let serp: Listing | null = null;
	if (!naver && !google && !kakao) {
		serp = await searchSerpSnippet(query, input);
	}

	const out: Partial<Record<NapChannelId, NapChannelCollected>> = {};

	const naverHit = fromListing(naver) || fromListing(serp);
	if (naverHit) out.naver_place = naverHit;
	else if (urls.naver_place || input.naverPlaceLinked) {
		out.naver_place = blocked(
			naverCreds()
				? NAP_COLLECTION_BLOCKED_NOTE
				: '데이터 수집 불가(네이버 지역검색 API 미설정 또는 스크래핑 차단)',
		);
	}

	const googleHit = fromListing(google);
	if (googleHit) out.google_business = googleHit;
	else if (urls.google_business || input.googleMapsLinked) {
		out.google_business = blocked(
			googlePlacesKey()
				? NAP_COLLECTION_BLOCKED_NOTE
				: '데이터 수집 불가(Google Places API 미설정 또는 스크래핑 차단)',
		);
	}

	const kakaoHit = fromListing(kakao);
	if (kakaoHit) out.kakao_tmap = kakaoHit;
	else if (urls.kakao_tmap || input.kakaoLinked) {
		out.kakao_tmap = blocked(
			kakaoRestKey()
				? NAP_COLLECTION_BLOCKED_NOTE
				: '데이터 수집 불가(카카오 로컬 API 미설정 또는 스크래핑 차단)',
		);
	}

	if (urls.bing_places || input.bingPlacesLinked) {
		out.bing_places = blocked('데이터 수집 불가(Bing Places API/스크래핑 차단)');
	}

	if (urls.youtube) {
		const title = await fetchYoutubeTitle(urls.youtube);
		out.youtube = title ? { name: title } : blocked('데이터 수집 불가(YouTube oEmbed/API 차단)');
	}

	if (urls.sns) {
		out.sns = blocked('데이터 수집 불가(인스타그램 로그인·API 제약)');
	}

	return out;
}

export async function enrichReportNapMatrix(report: AuditReport | null | undefined): Promise<AuditReport | null | undefined> {
	if (!report) return report;
	const input = inputFromReport(report);
	if (!compact(input.brandName) && !compact(input.address) && !compact(input.telephone)) {
		return { ...report, napMatrix: buildNapMatrix(input) };
	}

	let harvested: Partial<Record<NapChannelId, NapChannelCollected>> = {};
	try {
		harvested = await Promise.race([
			collectExternalChannelNap(input),
			new Promise<Partial<Record<NapChannelId, NapChannelCollected>>>((resolve) => {
				setTimeout(() => resolve({}), OVERALL_MS);
			}),
		]);
	} catch (error) {
		console.warn('[nap] external collect failed:', error instanceof Error ? error.message : error);
	}

	const collectedByChannel = {
		...(input.collectedByChannel || {}),
		...harvested,
	};
	const matrix: NapMatrix = buildNapMatrix({ ...input, collectedByChannel });
	return {
		...report,
		napMatrix: matrix,
		collectedNap: collectedByChannel,
	} as AuditReport & { collectedNap: typeof collectedByChannel };
}
