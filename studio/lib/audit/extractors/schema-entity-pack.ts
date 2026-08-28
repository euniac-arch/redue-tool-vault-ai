/**
 * Shared advanced-entity pack: geo / hours / services / sameAs / coverage fallbacks.
 * Used by the diagnosis scraper and the dynamic JSON-LD PHP builder so required
 * Schema.org nodes are never omitted.
 */

import { extractValidSpecialties, isUiStopword } from '@/lib/geo/clean-medical-entities';

export const SCHEMA_PRICE_RANGE_FALLBACK = '₩₩';
export const SCHEMA_CURRENCIES_ACCEPTED_FALLBACK = 'KRW';
export const SCHEMA_PAYMENT_ACCEPTED_FALLBACK = 'Cash, Credit Card';

export const WEEKDAY_PLUS_SATURDAY = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
] as const;

export const ENTITY_SAME_AS_HOSTS = [
	'map.naver.com',
	'place.naver.com',
	'm.place.naver.com',
	'pcmap.place.naver.com',
	'naver.me',
	'blog.naver.com',
	'cafe.naver.com',
	'post.naver.com',
	'in.naver.com',
	'place.map.kakao.com',
	'map.kakao.com',
	'pf.kakao.com',
	'kakao.com',
	'maps.google.com',
	'goo.gl',
	'g.page',
	'instagram.com',
	'facebook.com',
	'fb.com',
	'youtube.com',
	'youtu.be',
	'twitter.com',
	'x.com',
	'tiktok.com',
	'linkedin.com',
] as const;

/** User-specified map script regexes. */
export const KAKAO_LATLNG_RE = /LatLng\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i;
export const NAVER_POINT_RE = /Point\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i;
export const GOOGLE_AT_COORD_RE = /@?(-?\d+\.\d+),(-?\d+\.\d+)/;

export type SchemaGeoSource = 'map' | 'jsonld' | 'locality' | 'default';

export type SchemaGeoCoordinates = {
	latitude: number;
	longitude: number;
	source: SchemaGeoSource;
};

export type OpeningHoursSpecificationNode = {
	'@type': 'OpeningHoursSpecification';
	dayOfWeek: string[];
	opens: string;
	closes: string;
};

export type AvailableServiceNode = {
	'@type': 'MedicalProcedure' | 'Service';
	name: string;
	url?: string;
	category?: string;
	description?: string;
};

export type SchemaCoverageFallbacks = {
	priceRange: string;
	currenciesAccepted: string;
	paymentAccepted: string;
};

export const SCHEMA_COVERAGE_FALLBACKS: SchemaCoverageFallbacks = {
	priceRange: SCHEMA_PRICE_RANGE_FALLBACK,
	currenciesAccepted: SCHEMA_CURRENCIES_ACCEPTED_FALLBACK,
	paymentAccepted: SCHEMA_PAYMENT_ACCEPTED_FALLBACK,
};

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function isPlausibleWgs84(lat: number, lng: number): boolean {
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
	if (Math.abs(lat) < 1 && Math.abs(lng) < 1) return false;
	if (lat < -85 || lat > 85 || lng < -180 || lng > 180) return false;
	return true;
}

/** Prefer Korea-range pairs; still accept other WGS84 so overseas sites work. */
export function normalizeLatLngPair(a: number, b: number): SchemaGeoCoordinates | null {
	const candidates: Array<[number, number]> = [
		[a, b],
		[b, a],
	];
	for (const [lat, lng] of candidates) {
		if (!isPlausibleWgs84(lat, lng)) continue;
		const korea = lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
		if (korea) return { latitude: lat, longitude: lng, source: 'map' };
	}
	for (const [lat, lng] of candidates) {
		if (isPlausibleWgs84(lat, lng)) return { latitude: lat, longitude: lng, source: 'map' };
	}
	return null;
}

function pairFromMatch(match: RegExpMatchArray | null): SchemaGeoCoordinates | null {
	if (!match?.[1] || !match[2]) return null;
	return normalizeLatLngPair(Number(match[1]), Number(match[2]));
}

export function extractGeoFromMapScripts(html: string): SchemaGeoCoordinates | null {
	const hay = String(html || '');
	if (!hay) return null;
	const kakao = pairFromMatch(hay.match(KAKAO_LATLNG_RE));
	if (kakao) return kakao;
	const naver = pairFromMatch(hay.match(NAVER_POINT_RE));
	if (naver) return naver;
	const googleAt = pairFromMatch(hay.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/));
	if (googleAt) return googleAt;
	const loose = pairFromMatch(hay.match(GOOGLE_AT_COORD_RE));
	if (loose && loose.latitude >= 33 && loose.latitude <= 39 && loose.longitude >= 124 && loose.longitude <= 132) {
		return loose;
	}
	return null;
}

export function toSchemaGeoNode(geo: { latitude: string | number; longitude: string | number }): {
	'@type': 'GeoCoordinates';
	latitude: number;
	longitude: number;
} {
	return {
		'@type': 'GeoCoordinates',
		latitude: Number(geo.latitude),
		longitude: Number(geo.longitude),
	};
}

export function buildOpeningHoursSpecification(opts?: {
	opens?: string;
	closes?: string;
	dayOfWeek?: readonly string[];
}): OpeningHoursSpecificationNode[] {
	const opens = compact(opts?.opens) || '09:00';
	const closes = compact(opts?.closes) || '18:00';
	return [
		{
			'@type': 'OpeningHoursSpecification',
			dayOfWeek: [...(opts?.dayOfWeek || WEEKDAY_PLUS_SATURDAY)],
			opens,
			closes,
		},
	];
}

function serviceType(industryType?: string | null): AvailableServiceNode['@type'] {
	const industry = String(industryType || '').toUpperCase();
	if (industry === 'MEDICAL' || /HOSPITAL|CLINIC|VET|DENTAL|HEALTH/.test(industry)) {
		return 'MedicalProcedure';
	}
	return 'Service';
}

function toServiceUrl(raw: string | undefined, origin?: string): string | undefined {
	const path = compact(raw);
	if (!path) return undefined;
	if (/^https?:\/\//i.test(path)) return path;
	const originClean = compact(origin).replace(/\/+$/, '');
	const rel = path.startsWith('/') ? path : `/${path}`;
	return originClean ? `${originClean}${rel}` : rel;
}

export function buildAvailableServices(opts: {
	pages?: Array<{
		urlPath?: string;
		title?: string;
		section?: string;
		menu1?: string;
		h1?: string;
		selected?: boolean;
	}>;
	navItems?: Array<{ name?: string; url?: string }>;
	industryType?: string | null;
	siteName?: string;
	origin?: string;
	limit?: number;
}): AvailableServiceNode[] {
	const limit = opts.limit ?? 12;
	const site = compact(opts.siteName).toLowerCase();
	const names: string[] = [];
	const urlByName = new Map<string, string>();

	for (const nav of opts.navItems || []) {
		if (nav?.name) {
			names.push(nav.name);
			const url = toServiceUrl(nav.url, opts.origin);
			if (url) urlByName.set(compact(nav.name).toLowerCase(), url);
		}
	}
	for (const page of opts.pages || []) {
		if (page.selected === false) continue;
		const path = String(page.urlPath || '');
		if (/(^|\/)(robots\.txt|sitemap\.xml|llms(?:-full)?\.txt)$/i.test(path)) continue;
		if (/오시는|location|map\.php|contact/i.test(path) && !page.title) continue;
		const label = compact(page.title || page.section || page.menu1 || page.h1);
		if (label) {
			names.push(label);
			const url = toServiceUrl(path, opts.origin);
			if (url) urlByName.set(label.toLowerCase(), url);
		}
	}

	const cleaned = extractValidSpecialties(names).filter((name) => {
		if (isUiStopword(name)) return false;
		if (site && name.replace(/\s+/g, '').toLowerCase() === site.replace(/\s+/g, '')) return false;
		if (/^(메인|home|index)$/i.test(name)) return false;
		return name.length >= 2 && name.length <= 40;
	});

	const type = serviceType(opts.industryType);
	const seen = new Set<string>();
	const out: AvailableServiceNode[] = [];
	for (const name of cleaned) {
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		const url = urlByName.get(key);
		out.push(url ? { '@type': type, name, url } : { '@type': type, name });
		if (out.length >= limit) break;
	}
	return out;
}

export function isOfficialChannelUrl(raw: string): boolean {
	try {
		const url = new URL(raw.startsWith('http') ? raw : `https://${raw.replace(/^\/\//, '')}`);
		const host = url.hostname.replace(/^www\./i, '').toLowerCase();
		return ENTITY_SAME_AS_HOSTS.some((needle) => host === needle || host.endsWith(`.${needle}`));
	} catch {
		return false;
	}
}

function hostOf(raw?: string): string {
	try {
		const value = String(raw || '').trim();
		if (!value) return '';
		return new URL(value.startsWith('http') ? value : `https://${value.replace(/^\/\//, '')}`).hostname
			.replace(/^www\./i, '')
			.toLowerCase();
	} catch {
		return '';
	}
}

/** Official SNS/map channels only — never the site's own homepage origin. */
export function filterOfficialSameAs(urls: string[] | undefined, origin?: string): string[] {
	const ownHost = hostOf(origin);
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of urls || []) {
		const url = String(raw || '').trim();
		if (!/^https?:\/\//i.test(url)) continue;
		if (!isOfficialChannelUrl(url)) continue;
		const host = hostOf(url);
		if (ownHost && host && (host === ownHost || host.endsWith(`.${ownHost}`))) continue;
		const key = url.replace(/\/+$/, '').toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(url);
	}
	return out;
}

export function coverageFallbackFields(): SchemaCoverageFallbacks {
	return { ...SCHEMA_COVERAGE_FALLBACKS };
}
