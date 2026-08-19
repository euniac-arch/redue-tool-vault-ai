/**
 * GEO/AEO site-data extractor — representative, opening hours, geo coordinates,
 * entity sameAs links, and medicalSpecialty mapping from footer / greeting / JSON-LD.
 */

import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';
import {
	collectJsonLdNodesFromHtml,
	walkJsonLdNodes,
} from '@/lib/audit/extractors/nap';

export const DEFAULT_OPENS = '09:00';
export const DEFAULT_CLOSES = '18:00';

/** Seocho-gu civic centroid — used when address/JSON-LD coords are missing. */
export const DEFAULT_SEOCHO_GEO = { latitude: '37.4837', longitude: '127.0324' } as const;

const ENTITY_LINK_HOSTS = [
	'map.naver.com',
	'place.map.kakao.com',
	'map.kakao.com',
	'youtube.com',
	'youtu.be',
	'instagram.com',
	'blog.naver.com',
] as const;

const TIME_RANGE_RE =
	/(\d{1,2})\s*[:：]\s*(\d{2})\s*[~\-–—∼～]\s*(\d{1,2})\s*[:：]\s*(\d{2})/;

const WEEKDAY_HOURS_RE = new RegExp(
	`(?:평일|월\\s*[~\\-–—∼～]\\s*금|월화수목금|진료\\s*시간|상담\\s*시간|운영\\s*시간|영업\\s*시간|진료시간|상담시간|운영시간|영업시간)[^\\d]{0,16}${TIME_RANGE_RE.source}`,
	'i',
);

const WEEKEND_HOURS_RE = new RegExp(
	`(?:주말|토\\s*[~\\-–—∼～]\\s*일|토\\.?일|토요일|일요일)[^\\d]{0,16}${TIME_RANGE_RE.source}`,
	'i',
);

const POSTAL_LABELED_RE = /(?:우편번호|우편|ZIP)\s*[:：]?\s*(\d{5})/i;
const POSTAL_BARE_RE = /\b(\d{5})\b/;

const SPECIALTY_MAP: Array<{ test: RegExp; ids: string[] }> = [
	{ test: /방사선|중입자|양성자|radiation|ion\s*beam|proton/i, ids: ['Oncologic', 'RadiationTherapy'] },
	{ test: /암|종양|항암|cancer|oncolog/i, ids: ['Oncologic'] },
	{ test: /치과|임플란트|교정|dental|implant/i, ids: ['Dentistry'] },
	{ test: /피부|dermat/i, ids: ['Dermatologic'] },
	{ test: /성형외과|성형수술|미용성형|plastic\s*surg/i, ids: ['PlasticSurgery'] },
	{ test: /정형|통증|ortho|musculo/i, ids: ['Musculoskeletal'] },
	{ test: /스포츠\s*재활|재활|physiotherapy|rehab/i, ids: ['Physiotherapy'] },
	{ test: /아동|소아|발달|pediatric/i, ids: ['Pediatric'] },
	{ test: /산부|산과|gyneco|obstetric/i, ids: ['Gynecologic'] },
	{ test: /한의|추나/i, ids: ['Physiotherapy'] },
];

/** District / locality → WGS84 centroid (offline geocoding fallback). */
const LOCALITY_GEO: Array<{ test: RegExp; latitude: string; longitude: string }> = [
	{ test: /서초/, latitude: '37.4837', longitude: '127.0324' },
	{ test: /강남/, latitude: '37.5172', longitude: '127.0473' },
	{ test: /송파|잠실/, latitude: '37.5145', longitude: '127.1059' },
	{ test: /마포|홍대/, latitude: '37.5663', longitude: '126.9019' },
	{ test: /종로/, latitude: '37.5735', longitude: '126.9790' },
	{ test: /중구/, latitude: '37.5636', longitude: '126.9976' },
	{ test: /영등포|여의도/, latitude: '37.5264', longitude: '126.8963' },
	{ test: /부산|해운대|센텀/, latitude: '35.1796', longitude: '129.0756' },
	{ test: /대구/, latitude: '35.8714', longitude: '128.6014' },
	{ test: /인천/, latitude: '37.4563', longitude: '126.7052' },
	{ test: /광주광역|광주광/, latitude: '35.1595', longitude: '126.8526' },
	{ test: /대전/, latitude: '36.3504', longitude: '127.3845' },
	{ test: /울산/, latitude: '35.5384', longitude: '129.3114' },
	{ test: /세종/, latitude: '36.4800', longitude: '127.2890' },
	{ test: /제주/, latitude: '33.4996', longitude: '126.5312' },
	{ test: /수원/, latitude: '37.2636', longitude: '127.0286' },
	{ test: /성남|분당|판교/, latitude: '37.4201', longitude: '127.1267' },
	{ test: /서울/, latitude: '37.5665', longitude: '126.9780' },
];

export interface OpeningHoursSpec {
	opens: string;
	closes: string;
	weekendOpens?: string;
	weekendCloses?: string;
	detected: boolean;
}

export interface GeoCoordinates {
	latitude: string;
	longitude: string;
	source: 'jsonld' | 'locality' | 'default';
}

export interface GeoAeoSiteData {
	openingHours: OpeningHoursSpec;
	geo: GeoCoordinates;
	sameAs: string[];
	medicalSpecialty: string[];
	isAcceptingNewPatients: boolean;
	postalCode?: string;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
}

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function textOf(value: unknown): string {
	if (typeof value === 'string' || typeof value === 'number') return compact(String(value));
	const obj = asRecord(value);
	if (!obj) return '';
	return textOf(obj.name) || textOf(obj.value) || textOf(obj.text);
}

function padTime(hour: string, minute: string): string {
	const h = String(Math.min(23, Math.max(0, Number(hour) || 0))).padStart(2, '0');
	const m = String(Math.min(59, Math.max(0, Number(minute) || 0))).padStart(2, '0');
	return `${h}:${m}`;
}

function parseTimeRange(match: RegExpMatchArray | null): { opens: string; closes: string } | null {
	if (!match || match.length < 5) return null;
	const opens = padTime(match[1], match[2]);
	const closes = padTime(match[3], match[4]);
	if (opens === closes) return null;
	return { opens, closes };
}

export function extractOpeningHours(text: string): OpeningHoursSpec {
	const hay = compact(text);
	const weekday = parseTimeRange(hay.match(WEEKDAY_HOURS_RE)) || parseTimeRange(hay.match(TIME_RANGE_RE));
	const weekend = parseTimeRange(hay.match(WEEKEND_HOURS_RE));
	if (!weekday) {
		return {
			opens: DEFAULT_OPENS,
			closes: DEFAULT_CLOSES,
			detected: false,
		};
	}
	return {
		opens: weekday.opens,
		closes: weekday.closes,
		weekendOpens: weekend?.opens,
		weekendCloses: weekend?.closes,
		detected: true,
	};
}

function geoFromJsonLd(html: string): GeoCoordinates | null {
	const nodes = collectJsonLdNodesFromHtml(html);
	for (const node of nodes) {
		const geo = asRecord(node.geo);
		const lat = compact(textOf(geo?.latitude) || textOf(node.latitude));
		const lng = compact(textOf(geo?.longitude) || textOf(node.longitude));
		if (lat && lng && /^-?\d+(\.\d+)?$/.test(lat) && /^-?\d+(\.\d+)?$/.test(lng)) {
			return { latitude: lat, longitude: lng, source: 'jsonld' };
		}
	}
	return null;
}

export function geocodeFromAddress(addressText: string | null | undefined): GeoCoordinates {
	const hay = compact(addressText);
	if (hay) {
		for (const row of LOCALITY_GEO) {
			if (row.test.test(hay)) {
				return { latitude: row.latitude, longitude: row.longitude, source: 'locality' };
			}
		}
	}
	return { latitude: DEFAULT_SEOCHO_GEO.latitude, longitude: DEFAULT_SEOCHO_GEO.longitude, source: 'default' };
}

function normalizeEntityUrl(raw: string): string {
	const value = compact(raw);
	if (!value) return '';
	try {
		const url = new URL(value.startsWith('http') ? value : `https://${value.replace(/^\/\//, '')}`);
		url.hash = '';
		const host = url.hostname.replace(/^www\./i, '').toLowerCase();
		if (host === 'youtu.be') {
			return `https://www.youtube.com/watch?v=${url.pathname.replace(/^\//, '')}`;
		}
		url.protocol = 'https:';
		url.hostname = url.hostname.toLowerCase();
		return url.toString().replace(/\/$/, '');
	} catch {
		return '';
	}
}

function hostMatchesEntityLink(url: string): boolean {
	try {
		const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
		return ENTITY_LINK_HOSTS.some((needle) => host === needle || host.endsWith(`.${needle}`));
	} catch {
		return false;
	}
}

export function extractEntitySameAsLinks(html: string, $?: CheerioAPI | null): string[] {
	const found = new Set<string>();
	const push = (raw: string) => {
		const url = normalizeEntityUrl(raw);
		if (url && hostMatchesEntityLink(url)) found.add(url);
	};

	const root = $ || cheerio.load(html || '<html></html>');
	root('a[href]').each((_, el) => {
		push(root(el).attr('href') || '');
	});

	const nodes = collectJsonLdNodesFromHtml(html);
	for (const node of nodes) {
		const sameAs = node.sameAs;
		if (typeof sameAs === 'string') push(sameAs);
		else if (Array.isArray(sameAs)) {
			for (const item of sameAs) {
				if (typeof item === 'string') push(item);
			}
		}
		walkJsonLdNodes(node, (child) => {
			const url = textOf(child.url);
			if (url) push(url);
		});
	}

	for (const match of html.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
		push(match[0]);
	}

	return Array.from(found);
}

export function mapMedicalSpecialties(keywords: readonly string[], industryType?: string | null): string[] {
	const hay = keywords.filter(Boolean).join(' ');
	const ids: string[] = [];
	for (const row of SPECIALTY_MAP) {
		if (row.test.test(hay)) {
			for (const id of row.ids) {
				if (!ids.includes(id)) ids.push(id);
			}
		}
	}
	if (!ids.length && String(industryType || '').toUpperCase() === 'MEDICAL') {
		return ['Oncologic', 'RadiationTherapy'];
	}
	return ids;
}

export function extractPostalCode(text: string): string | undefined {
	const labeled = compact(text).match(POSTAL_LABELED_RE)?.[1];
	if (labeled) return labeled;
	const bare = compact(text).match(POSTAL_BARE_RE)?.[1];
	return bare || undefined;
}

export function extractGeoAeoSiteData(opts: {
	html: string;
	$?: CheerioAPI | null;
	industryType?: string | null;
	keywords?: readonly string[];
	addressText?: string | null;
	location?: string | null;
}): GeoAeoSiteData {
	try {
		const html = opts.html || '';
		const $ = opts.$ || cheerio.load(html || '<html></html>');
		const footerText = compact($('footer, #ft, .footer, #footer, address').text());
		const corpus = [footerText, compact($('body').text()).slice(0, 8000), html].filter(Boolean).join('\n');

		const openingHours = extractOpeningHours(corpus);
		const geo = geoFromJsonLd(html) || geocodeFromAddress([opts.addressText, opts.location, corpus].filter(Boolean).join(' '));
		const sameAs = extractEntitySameAsLinks(html, $);
		const medicalSpecialty = mapMedicalSpecialties(
			[...(opts.keywords || []), corpus.slice(0, 2000)],
			opts.industryType,
		);
		const postalCode = extractPostalCode(corpus);

		return {
			openingHours,
			geo,
			sameAs,
			medicalSpecialty,
			isAcceptingNewPatients: true,
			postalCode,
		};
	} catch (error) {
		console.error('[geo-aeo-site-data] extract failed:', error);
		return {
			openingHours: { opens: DEFAULT_OPENS, closes: DEFAULT_CLOSES, detected: false },
			geo: { ...DEFAULT_SEOCHO_GEO, source: 'default' },
			sameAs: [],
			medicalSpecialty: mapMedicalSpecialties(opts.keywords || [], opts.industryType),
			isAcceptingNewPatients: true,
		};
	}
}

export function mergeGeoAeoSiteData(
	base: GeoAeoSiteData | null | undefined,
	extra: Partial<GeoAeoSiteData> | null | undefined,
): GeoAeoSiteData {
	const fallback: GeoAeoSiteData = base || {
		openingHours: { opens: DEFAULT_OPENS, closes: DEFAULT_CLOSES, detected: false },
		geo: { ...DEFAULT_SEOCHO_GEO, source: 'default' },
		sameAs: [],
		medicalSpecialty: [],
		isAcceptingNewPatients: true,
	};
	if (!extra) return fallback;
	const sameAs = Array.from(new Set([...(fallback.sameAs || []), ...(extra.sameAs || [])]));
	const medicalSpecialty = Array.from(
		new Set([...(fallback.medicalSpecialty || []), ...(extra.medicalSpecialty || [])]),
	);
	return {
		openingHours: extra.openingHours?.detected ? extra.openingHours : fallback.openingHours,
		geo: extra.geo && extra.geo.source !== 'default' ? extra.geo : fallback.geo,
		sameAs,
		medicalSpecialty,
		isAcceptingNewPatients: extra.isAcceptingNewPatients ?? fallback.isAcceptingNewPatients,
		postalCode: extra.postalCode || fallback.postalCode,
		streetAddress: extra.streetAddress || fallback.streetAddress,
		addressLocality: extra.addressLocality || fallback.addressLocality,
		addressRegion: extra.addressRegion || fallback.addressRegion,
	};
}
