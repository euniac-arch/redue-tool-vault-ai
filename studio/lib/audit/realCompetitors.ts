/**
 * Live competitor resolution for AI Share of Voice.
 * Naver Local Search first, Google Places Text Search as fallback.
 * API failure / empty results fall back to statistical placeholder names.
 */

import { anonymizedCompetitorLabel } from '@/lib/audit/anonymize-competitor';
import { industryCategoryLabel, resolveIndustryVoice } from '@/lib/audit/universal-compliant-engine';
import { matchCompetitorRoster } from '@/lib/audit/competitor-match';
import { isSameBrandEntity } from '@/lib/geo/brand-entities';
import { generateQueryMatrix } from '@/lib/geo/query-matrix';

/**
 * Portal blog / cafe / map-review leakage. AI cites directories instead of official sites.
 * Held out of the direct-competitor pool so a schema-poor listing cannot be scored at ~68%.
 */
export const THIRD_PARTY_SHARE = 52;
/** #1 takes 62% of the *direct competitor pool* (after 3rd-party leakage). */
export const SOV_LEADER_RESIDUAL_RATIO = 0.62;
/** #2 takes the remainder (~38%) so integer percents always sum with brand + 3rd-party to 100. */
export const SOV_RUNNER_RESIDUAL_RATIO = 0.38;
export const REAL_COMPETITOR_FETCH_TIMEOUT_MS = 7_000;

const NAVER_LOCAL_ENDPOINT = 'https://openapi.naver.com/v1/search/local.json';
const GOOGLE_TEXT_SEARCH_ENDPOINT = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

export interface RealCompetitor {
	name: string;
	category?: string;
	address?: string;
}

export type RealCompetitorSource = 'naver' | 'google' | 'mixed' | 'fallback';

export interface CompetitorSovRow {
	name: string;
	share: number;
	isDominant: boolean;
	isRealData: boolean;
}

export interface CompetitorSovResult {
	targetQuery: string;
	brandName: string;
	/** Placeholder until GEO scores bind As-Is (0–28). Name-fetch path has no site metrics. */
	brandShare: number;
	/** Portal blog/cafe/map-review leakage held out of the ranking split. */
	directoryShare: number;
	competitors: CompetitorSovRow[];
	/** Top 5 search listings including the audited brand (for symmetric rank share). */
	rankedNames: string[];
	/** 1-based search rank of the audited brand; 0 when not in the top 5. */
	clientRank: number;
	lossInsight: string;
	source: RealCompetitorSource;
}

export interface RealCompetitorSnapshot {
	query: string;
	names: string[];
	/** Top 5 search listings including the audited brand. */
	rankedNames?: string[];
	/** 1-based search rank of the audited brand; 0 when not in the top 5. */
	clientRank?: number;
	isRealData: boolean[];
	source: RealCompetitorSource;
	lossInsight: string;
	fetchedAt: string;
}

export interface CalculateCompetitorSovInput {
	clientName: string;
	region: string;
	mainService: string;
	categoryName?: string;
	lang?: 'ko' | 'en';
	/** Override the default `${region} ${mainService}` search query. */
	query?: string;
}

type NaverLocalItem = {
	title?: string;
	category?: string;
	address?: string;
	roadAddress?: string;
};

type GooglePlaceTextItem = {
	name?: string;
	formatted_address?: string;
	types?: string[];
};

function cleanPhrase(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

/** Strip Naver `<b>` / HTML entities and leftover symbols from a place title. */
export function cleanCompetitorName(raw: string | null | undefined): string {
	return (raw || '')
		.replace(/<[^>]*>?/g, '')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&nbsp;/gi, ' ')
		.replace(/[^\p{L}\p{N}\s&.,·\-()]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function normalizeBrandKey(value: string | null | undefined): string {
	return cleanCompetitorName(value).replace(/\s+/g, '').toLowerCase();
}

/** True when the listing is the audited brand (exact, containment, or script variant). */
export function isSelfBrandName(
	name: string,
	excludeBrand: string,
	extraAliases: readonly string[] = [],
): boolean {
	const listing = normalizeBrandKey(name);
	const brand = normalizeBrandKey(excludeBrand);
	if (!listing || brand.length < 2) return false;
	if (listing === brand) return true;
	const shorter = listing.length <= brand.length ? listing : brand;
	const minLen = /[가-힣]/.test(shorter) ? 3 : 5;
	if (shorter.length >= minLen && (listing.includes(brand) || brand.includes(listing))) return true;
	return isSameBrandEntity(name, excludeBrand, extraAliases);
}

export function uniqueCompetitorNames(
	names: readonly string[],
	selfBrand?: string,
	extraAliases: readonly string[] = [],
): string[] {
	const out: string[] = [];
	for (const name of names) {
		const cleaned = cleanCompetitorName(name);
		const key = normalizeBrandKey(cleaned);
		if (!key) continue;
		if (selfBrand && isSelfBrandName(cleaned, selfBrand, extraAliases)) {
			if (out.some((existing) => isSelfBrandName(existing, selfBrand, extraAliases))) continue;
			out.push(cleaned);
			continue;
		}
		if (out.some((existing) => isSameBrandEntity(existing, cleaned, extraAliases))) continue;
		out.push(cleaned);
	}
	return out;
}

export function statisticalFallbackNames(
	region: string,
	categoryName = '전문 기관',
	lang: 'ko' | 'en' = 'ko',
): [string, string] {
	const loc = cleanPhrase(region);
	const category = cleanPhrase(categoryName) || (lang === 'en' ? 'specialist' : '전문 기관');
	if (lang === 'en') {
		return [
			loc ? `${loc} #1 search listing` : '#1 search listing',
			loc ? `${loc} nearby ${category}` : `Nearby ${category}`,
		];
	}
	return [
		loc ? `${loc} 1위 검색 노출처` : '1위 검색 노출처',
		loc ? `${loc} 인근 동종 ${category}` : `인근 동종 ${category}`,
	];
}

export function buildCompetitorSearchQuery(region: string, mainService: string): string {
	return [cleanPhrase(region), cleanPhrase(mainService)].filter(Boolean).join(' ');
}

/**
 * Three recommended diagnostic queries from site metadata.
 * preset1 (`${coreIndustry} 추천`) is the default active chip.
 * Built through `generateQueryMatrix` so chips always include a category noun
 * and never fall back to a hardcoded vertical (e.g. 도수치료).
 */
export function buildSovQueryPresets(
	region: string,
	mainService: string,
	subService?: string,
	lang: 'ko' | 'en' = 'ko',
): [string, string, string] {
	return generateQueryMatrix({
		lang,
		location: region,
		primaryKeyword: mainService,
		category: mainService,
		coreSpecialties: [mainService, subService].filter((v): v is string => Boolean(v)),
	}).sovPresets;
}

export function buildLossInsight(region: string, mainService: string, leaderName: string, lang: 'ko' | 'en' = 'ko'): string {
	const loc = cleanPhrase(region) || (lang === 'en' ? 'this area' : '해당 지역');
	const service = cleanPhrase(mainService) || (lang === 'en' ? 'this service' : '핵심 서비스');
	const leader = cleanPhrase(leaderName) || (lang === 'en' ? 'incumbent listings' : '상위 추천처');
	if (lang === 'en') {
		return `On “${service}” recommendation queries in ${loc}, ${leader} currently leads AI citation share.`;
	}
	return `${loc} 지역 "${service}" AI 추천 질의에서 1위(${leader})가 인용 점유율을 선점하고 있습니다.`;
}

function resolveNaverCredentials(): { clientId: string; clientSecret: string } | null {
	const clientId = (
		process.env.NAVER_CLIENT_ID ||
		process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ||
		''
	).trim();
	const clientSecret = (process.env.NAVER_CLIENT_SECRET || '').trim();
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}

function resolveGooglePlacesKey(): string {
	return (
		process.env.GOOGLE_PLACES_API_KEY?.trim() ||
		process.env.GOOGLE_MAPS_API_KEY?.trim() ||
		process.env.VITE_GOOGLE_MAP_API_KEY?.trim() ||
		process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.trim() ||
		process.env.GOOGLE_SEARCH_API_KEY?.trim() ||
		''
	);
}

function excludeSelf(names: readonly string[], excludeBrand: string): string[] {
	return uniqueCompetitorNames(names).filter((name) => !isSelfBrandName(name, excludeBrand));
}

/** Deduped top-5 search listings (client included) used for symmetric rank share. */
export function toSearchRankList(rawSearchResults: readonly string[] | null | undefined): string[] {
	return uniqueCompetitorNames(rawSearchResults ?? []).slice(0, 5);
}

/** 0-based index of the audited brand in the search list; -1 when not listed. */
export function findClientSearchIndex(
	clientName: string,
	rawSearchResults: readonly string[] | null | undefined,
): number {
	return toSearchRankList(rawSearchResults).findIndex((name) => isSelfBrandName(name, clientName));
}

/** 1-based search rank; 0 when the brand is not in the top 5. */
export function toClientRank(clientIndex: number): number {
	return clientIndex >= 0 ? clientIndex + 1 : 0;
}

/**
 * Naver Local Search — raw top-5 titles for `${region} ${mainService}` (client included).
 */
export async function fetchNaverSearchRankings(query: string): Promise<string[]> {
	const creds = resolveNaverCredentials();
	if (!creds || !cleanPhrase(query)) return [];

	try {
		const url = new URL(NAVER_LOCAL_ENDPOINT);
		url.searchParams.set('query', query);
		url.searchParams.set('display', '5');
		url.searchParams.set('sort', 'comment');

		const res = await fetch(url.toString(), {
			headers: {
				'X-Naver-Client-Id': creds.clientId,
				'X-Naver-Client-Secret': creds.clientSecret,
			},
			signal: AbortSignal.timeout(REAL_COMPETITOR_FETCH_TIMEOUT_MS),
			cache: 'no-store',
		});
		if (!res.ok) {
			console.warn('[realCompetitors] Naver local search failed:', res.status);
			return [];
		}
		const data = (await res.json()) as { items?: NaverLocalItem[] };
		return toSearchRankList((data.items || []).map((item) => item.title || ''));
	} catch (error) {
		console.error('Failed to fetch Naver competitors:', error);
		return [];
	}
}

/**
 * Naver Local Search — raw top-5 titles in original order (client included).
 * Do not pre-filter the audited brand; the leaderboard maps live rank from this list.
 */
export async function fetchNaverCompetitors(query: string): Promise<string[]> {
	return fetchNaverSearchRankings(query);
}

/**
 * Google Places Text Search — raw top-5 names (client included).
 */
export async function fetchGoogleSearchRankings(query: string): Promise<string[]> {
	const apiKey = resolveGooglePlacesKey();
	if (!apiKey || !cleanPhrase(query)) return [];

	try {
		const url = new URL(GOOGLE_TEXT_SEARCH_ENDPOINT);
		url.searchParams.set('query', query);
		url.searchParams.set('key', apiKey);
		url.searchParams.set('language', 'ko');
		url.searchParams.set('region', 'kr');

		const res = await fetch(url.toString(), {
			signal: AbortSignal.timeout(REAL_COMPETITOR_FETCH_TIMEOUT_MS),
			cache: 'no-store',
		});
		if (!res.ok) {
			console.warn('[realCompetitors] Google Places search failed:', res.status);
			return [];
		}
		const data = (await res.json()) as {
			status?: string;
			results?: GooglePlaceTextItem[];
		};
		if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
			console.warn('[realCompetitors] Google Places status:', data.status);
			return [];
		}
		return toSearchRankList((data.results || []).map((item) => item.name || ''));
	} catch (error) {
		console.error('Failed to fetch Google competitors:', error);
		return [];
	}
}

/**
 * Google Places Text Search — raw top-5 names in original order (client included).
 * Do not pre-filter the audited brand; the leaderboard maps live rank from this list.
 */
export async function fetchGoogleCompetitors(query: string): Promise<string[]> {
	return fetchGoogleSearchRankings(query);
}

export async function resolveLiveSearchRankings(
	query: string,
): Promise<{ names: string[]; source: Exclude<RealCompetitorSource, 'fallback'> | 'fallback' }> {
	const naverNames = await fetchNaverSearchRankings(query);
	if (naverNames.length >= 3) {
		return { names: naverNames.slice(0, 5), source: 'naver' };
	}

	const googleNames = await fetchGoogleSearchRankings(query);
	const merged = uniqueCompetitorNames([...naverNames, ...googleNames]).slice(0, 5);
	if (merged.length === 0) return { names: [], source: 'fallback' };
	if (naverNames.length > 0 && googleNames.length > 0) {
		return { names: merged, source: 'mixed' };
	}
	return { names: merged, source: naverNames.length > 0 ? 'naver' : 'google' };
}

export async function resolveLiveCompetitorNames(
	query: string,
	_excludeBrand?: string,
): Promise<{
	names: string[];
	rankedNames: string[];
	source: Exclude<RealCompetitorSource, 'fallback'> | 'fallback';
}> {
	const live = await resolveLiveSearchRankings(query);
	return {
		names: live.names,
		rankedNames: live.names,
		source: live.source,
	};
}

export function bindCompetitorSov(input: {
	clientName: string;
	region: string;
	mainService: string;
	categoryName?: string;
	realNames: readonly string[];
	rankedNames?: readonly string[];
	source: RealCompetitorSource;
	lang?: 'ko' | 'en';
	targetQuery?: string;
}): CompetitorSovResult {
	const lang = input.lang === 'en' ? 'en' : 'ko';
	const region = cleanPhrase(input.region);
	const mainService = cleanPhrase(input.mainService);
	const categoryName = cleanPhrase(input.categoryName) || (lang === 'en' ? 'specialist' : '전문 기관');
	const targetQuery = cleanPhrase(input.targetQuery) || buildCompetitorSearchQuery(region, mainService);
	const rankedNames = toSearchRankList(input.rankedNames?.length ? input.rankedNames : input.realNames);
	const matched = matchCompetitorRoster({
		clientName: input.clientName,
		rankedNames,
		query: targetQuery,
		categoryName,
		mainService,
		region,
		lang,
	});
	const realNames = matched.slots
		.filter((slot) => !slot.isClient && slot.isRealData)
		.map((slot) => slot.name)
		.slice(0, 2);
	const brandShare = 0;
	const directoryShare = THIRD_PARTY_SHARE;
	const remaining = Math.max(0, 100 - brandShare - directoryShare);
	const leaderShare = Math.round(remaining * SOV_LEADER_RESIDUAL_RATIO);
	const runnerShare = remaining - leaderShare;
	const clientIndex = findClientSearchIndex(input.clientName, rankedNames);
	const industryLabel = industryCategoryLabel(
		resolveIndustryVoice({ category: mainService, keywords: [mainService, categoryName] }),
		lang,
	);

	return {
		targetQuery,
		brandName: cleanPhrase(input.clientName),
		brandShare,
		directoryShare,
		competitors: [
			{
				name: anonymizedCompetitorLabel(1, lang, industryLabel),
				share: leaderShare,
				isDominant: true,
				isRealData: Boolean(realNames[0]),
			},
			{
				name: anonymizedCompetitorLabel(2, lang, industryLabel),
				share: runnerShare,
				isDominant: false,
				isRealData: Boolean(realNames[1]),
			},
		],
		rankedNames,
		clientRank: toClientRank(clientIndex),
		lossInsight: buildLossInsight(region, mainService, anonymizedCompetitorLabel(1, lang, industryLabel), lang),
		source: realNames.length > 0 ? input.source : 'fallback',
	};
}

export function competitorSovToSnapshot(result: CompetitorSovResult): RealCompetitorSnapshot {
	return {
		query: result.targetQuery,
		names: result.competitors.map((row) => row.name),
		rankedNames: result.rankedNames,
		clientRank: result.clientRank,
		isRealData: result.competitors.map((row) => row.isRealData),
		source: result.source,
		lossInsight: result.lossInsight,
		fetchedAt: new Date().toISOString(),
	};
}

export function snapshotHasRealCompetitors(
	snapshot: RealCompetitorSnapshot | null | undefined,
): boolean {
	if (!snapshot || snapshot.source === 'fallback') return false;
	return snapshot.names.some((name, i) => Boolean(name) && snapshot.isRealData[i] !== false);
}

/**
 * Final SoV payload: live Naver/Google names, or statistical fallback names only.
 */
export async function calculateCompetitorSov(
	clientName: string,
	region: string,
	mainService: string,
	categoryName = '전문 기관',
	lang: 'ko' | 'en' = 'ko',
	targetQuery?: string,
): Promise<CompetitorSovResult> {
	const query = cleanPhrase(targetQuery) || buildCompetitorSearchQuery(region, mainService);
	const live = query
		? await resolveLiveCompetitorNames(query, clientName)
		: { names: [] as string[], rankedNames: [] as string[], source: 'fallback' as const };

	return bindCompetitorSov({
		clientName,
		region,
		mainService,
		categoryName,
		realNames: live.names,
		rankedNames: live.rankedNames,
		source: live.source,
		lang,
		targetQuery: query,
	});
}

export async function fetchRealCompetitorSnapshot(
	input: CalculateCompetitorSovInput,
): Promise<RealCompetitorSnapshot> {
	const result = await calculateCompetitorSov(
		input.clientName,
		input.region,
		input.mainService,
		input.categoryName,
		input.lang,
		input.query,
	);
	return competitorSovToSnapshot(result);
}
