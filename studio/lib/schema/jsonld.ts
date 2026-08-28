/**
 * Shared Schema.org JSON-LD builder.
 *
 * Pass a config (site + optional founder) and get a complete `@graph`
 * with empty / invalid URLs stripped. Use this from Next.js layouts,
 * paste-ready HTML, or PHP `echo`.
 *
 * ```tsx
 * import { SchemaJsonLd } from '@/components/SchemaJsonLd';
 * import { buildSchemaJsonLd } from '@/lib/schema';
 *
 * <SchemaJsonLd config={clinicConfig} />
 * ```
 *
 * ```php
 * echo formatSchemaScriptTag($jsonLd);
 * ```
 */

import { filterOfficialSameAs } from '@/lib/audit/extractors/schema-entity-pack';
import {
	buildStrictSchemaGraph,
	graphHasPerson,
	graphOrgNode,
	isValidGroundTruthRepName,
	type GroundTruthFacts,
	type StrictJsonLdNode,
	type StrictSchemaGraph,
} from '@/lib/solve/core/strict-schema-graph';

export type SchemaPostalAddress = {
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	postalCode?: string;
	addressCountry?: string;
};

/** Official SNS + Naver channel slots. Empty strings are dropped. */
export type SchemaChannelConfig = {
	instagram?: string;
	youtube?: string;
	facebook?: string;
	twitter?: string;
	tiktok?: string;
	linkedin?: string;
	kakao?: string;
	/** 네이버 블로그 */
	naverBlog?: string;
	/** 네이버 카페 */
	naverCafe?: string;
	/** 네이버 플레이스(지도) */
	naverPlace?: string;
	/** Extra official channel URLs */
	extra?: Array<string | null | undefined>;
};

export type SchemaPersonConfig = {
	name?: string;
	jobTitle?: string;
	sameAs?: Array<string | null | undefined>;
	alumniOf?: string | { name?: string; url?: string };
	knowsAbout?: Array<string | null | undefined>;
	url?: string;
};

export type SchemaJsonLdConfig = {
	name: string;
	url: string;
	logo?: string;
	description?: string;
	address?: SchemaPostalAddress | string;
	telephone?: string;
	orgTypes?: string[];
	/** Flat sameAs list (merged with `channels`). */
	sameAs?: Array<string | null | undefined>;
	channels?: SchemaChannelConfig;
	founder?: SchemaPersonConfig;
	pageUrl?: string;
	pageName?: string;
	pageType?: string;
	inLanguage?: string;
};

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Accepts only parseable http(s) URLs. Empty strings and `javascript:` are rejected. */
export function isValidSchemaUrl(raw: string | null | undefined): boolean {
	const url = compact(raw);
	if (!url) return false;
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

/** `filter(Boolean)` + http(s) validation so empty slots never enter a schema array. */
export function filterValidSchemaUrls(urls: Array<string | null | undefined> | null | undefined): string[] {
	return (urls || []).filter((item): item is string => Boolean(item) && isValidSchemaUrl(item));
}

export function collectChannelUrls(channels?: SchemaChannelConfig | null): string[] {
	if (!channels) return [];
	return filterValidSchemaUrls([
		channels.instagram,
		channels.youtube,
		channels.facebook,
		channels.twitter,
		channels.tiktok,
		channels.linkedin,
		channels.kakao,
		channels.naverBlog,
		channels.naverCafe,
		channels.naverPlace,
		...(channels.extra || []),
	]);
}

/**
 * Merge generic SNS + Naver blog / cafe / place URLs, drop empties and
 * unofficial / own-origin links.
 */
export function mergeSameAsFromConfig(config: Pick<SchemaJsonLdConfig, 'sameAs' | 'channels' | 'url'>): string[] {
	return filterOfficialSameAs(
		filterValidSchemaUrls([...(config.sameAs || []), ...collectChannelUrls(config.channels)]),
		config.url,
	);
}

function addressParts(address?: SchemaPostalAddress | string): {
	streetAddress: string;
	addressLocality: string;
	addressRegion: string;
	postalCode: string;
	addressCountry: string;
} {
	if (!address) {
		return { streetAddress: '', addressLocality: '', addressRegion: '', postalCode: '', addressCountry: '' };
	}
	if (typeof address === 'string') {
		return {
			streetAddress: compact(address),
			addressLocality: '',
			addressRegion: '',
			postalCode: '',
			addressCountry: '',
		};
	}
	return {
		streetAddress: compact(address.streetAddress),
		addressLocality: compact(address.addressLocality),
		addressRegion: compact(address.addressRegion),
		postalCode: compact(address.postalCode),
		addressCountry: compact(address.addressCountry),
	};
}

function alumniName(alumni?: SchemaPersonConfig['alumniOf']): string {
	if (!alumni) return '';
	if (typeof alumni === 'string') return compact(alumni);
	return compact(alumni.name);
}

function alumniUrl(alumni?: SchemaPersonConfig['alumniOf']): string {
	if (!alumni || typeof alumni === 'string') return '';
	return isValidSchemaUrl(alumni.url) ? compact(alumni.url) : '';
}

export function schemaConfigToGroundTruth(config: SchemaJsonLdConfig): GroundTruthFacts {
	const origin = compact(config.url).replace(/\/+$/, '');
	const address = addressParts(config.address);
	const founder = config.founder;
	const street = address.streetAddress || [address.addressRegion, address.addressLocality].filter(Boolean).join(' ');
	return {
		origin,
		siteName: compact(config.name),
		pageUrl: compact(config.pageUrl) || `${origin}/`,
		pageName: compact(config.pageName) || compact(config.name),
		pageType: compact(config.pageType),
		description: compact(config.description),
		logo: isValidSchemaUrl(config.logo) ? compact(config.logo) : '',
		orgTypes: (config.orgTypes || []).map(compact).filter(Boolean),
		telephone: compact(config.telephone),
		streetAddress: street,
		addressLocality: address.addressLocality,
		addressRegion: address.addressRegion,
		postalCode: address.postalCode,
		repName: founder?.name,
		repTitle: founder?.jobTitle,
		repSameAs: filterValidSchemaUrls(founder?.sameAs),
		alumniOf: alumniName(founder?.alumniOf),
		knowsAbout: (founder?.knowsAbout || []).map(compact).filter(Boolean),
		sameAs: mergeSameAsFromConfig(config),
	};
}

function ensureBreadcrumb(graph: StrictSchemaGraph, facts: GroundTruthFacts): void {
	const pageUrl = compact(facts.pageUrl) || `${facts.origin}/`;
	const crumbId = `${pageUrl}#breadcrumb`;
	const hasCrumb = graph['@graph'].some((node) => {
		const type = node['@type'];
		return type === 'BreadcrumbList' || (Array.isArray(type) && type.includes('BreadcrumbList'));
	});
	if (hasCrumb) return;
	graph['@graph'].push({
		'@type': 'BreadcrumbList',
		'@id': crumbId,
		itemListElement: [
			{
				'@type': 'ListItem',
				position: 1,
				name: compact(facts.pageName) || compact(facts.siteName) || '홈',
				item: pageUrl,
			},
		],
	});
}

function enrichPublicGraph(graph: StrictSchemaGraph, config: SchemaJsonLdConfig): StrictSchemaGraph {
	const language = compact(config.inLanguage) || 'ko-KR';
	const website = graph['@graph'].find((node) => node['@type'] === 'WebSite');
	if (website && !website.inLanguage) website.inLanguage = language;

	const person = graph['@graph'].find((node) => node['@type'] === 'Person') as StrictJsonLdNode | undefined;
	if (person) {
		const profileUrl = isValidSchemaUrl(config.founder?.url) ? compact(config.founder?.url) : '';
		if (profileUrl && !person.url) person.url = profileUrl;
		const eduUrl = alumniUrl(config.founder?.alumniOf);
		if (eduUrl && person.alumniOf && typeof person.alumniOf === 'object' && !Array.isArray(person.alumniOf)) {
			(person.alumniOf as StrictJsonLdNode).url = eduUrl;
		}
	}

	ensureBreadcrumb(graph, schemaConfigToGroundTruth(config));
	return graph;
}

/**
 * Build a complete Schema.org `@graph`:
 * Organization/LocalBusiness (name, url, logo, description, address, telephone, sameAs)
 * + founder Person (name, jobTitle, sameAs, alumniOf, knowsAbout) when a real name exists.
 */
export function buildSchemaJsonLd(config: SchemaJsonLdConfig): StrictSchemaGraph {
	const facts = schemaConfigToGroundTruth(config);
	return enrichPublicGraph(buildStrictSchemaGraph(facts), config);
}

export function formatSchemaScriptTag(jsonLd: unknown): string {
	return `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
}

export function renderSchemaJsonLdHtml(config: SchemaJsonLdConfig): string {
	return formatSchemaScriptTag(buildSchemaJsonLd(config));
}

export function schemaHasFounderKnowledgeGraph(graph: StrictSchemaGraph): boolean {
	if (!graphHasPerson(graph)) return false;
	const org = graphOrgNode(graph);
	const founder = org?.founder as { '@id'?: string } | undefined;
	return Boolean(founder?.['@id']);
}

export function schemaHasNaverSameAs(graph: StrictSchemaGraph): boolean {
	const org = graphOrgNode(graph);
	const sameAs = Array.isArray(org?.sameAs) ? (org?.sameAs as string[]) : [];
	const hay = sameAs.join(' ');
	const place = /place\.naver\.com|map\.naver\.com|m\.place\.naver|naver\.me\//i.test(hay);
	const blog = /blog\.naver\.com|cafe\.naver\.com|post\.naver\.com|in\.naver\.com/i.test(hay);
	return place || blog;
}

export { isValidGroundTruthRepName };
