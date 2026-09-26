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
	isInventedDefaultName,
	isTitleOnlyRepName,
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
	/** E-E-A-T biography. Emitted only when a real person name is present. */
	description?: string;
	sameAs?: Array<string | null | undefined>;
	alumniOf?: string | { name?: string; url?: string };
	knowsAbout?: Array<string | null | undefined>;
	url?: string;
};

export type SchemaFaqItem = {
	question: string;
	answer: string;
};

export type SchemaBreadcrumbItem = {
	name: string;
	url: string;
};

export type SchemaAboutConfig = {
	name?: string;
	url?: string;
	description?: string;
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
	email?: string;
	/** Public contact URL used for Organization.contactPoint. */
	contactUrl?: string;
	/** Sitelinks SearchAction template. Must contain `{search_term_string}`. */
	searchUrlTemplate?: string;
	faqs?: SchemaFaqItem[];
	about?: SchemaAboutConfig;
	breadcrumbs?: SchemaBreadcrumbItem[];
	/**
	 * Person `@id`. Default `${origin}/#person`.
	 * Use a full URL such as `https://example.com/#author` when the public graph
	 * should expose the author node under a stable fragment.
	 */
	personId?: string;
	/** SoftwareApplication extras — set only when `orgTypes` includes `SoftwareApplication`. */
	applicationCategory?: string;
	operatingSystem?: string;
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
		applicationCategory: compact(config.applicationCategory),
		operatingSystem: compact(config.operatingSystem),
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

function rewriteIdRefs(node: unknown, from: string, to: string): void {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const item of node) rewriteIdRefs(item, from, to);
		return;
	}
	const record = node as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		const value = record[key];
		if (key === '@id' && value === from) record[key] = to;
		else rewriteIdRefs(value, from, to);
	}
}

/**
 * Configured founder profile. Extracted customer graphs still refuse title-only
 * names inside `buildStrictSchemaGraph`. An explicit config name such as
 * "박성준 (Sung Joon Park)" is intentional and is emitted here.
 */
function applyConfiguredFounder(graph: StrictSchemaGraph, config: SchemaJsonLdConfig): void {
	const founder = config.founder;
	const name = compact(founder?.name);
	if (!name || isInventedDefaultName(name) || isTitleOnlyRepName(name)) return;

	const origin = originOfConfig(config);
	const requestedId = compact(config.personId);
	const personId = isValidSchemaUrl(requestedId) ? requestedId : `${origin}/#person`;
	const org = graphOrgNode(graph);
	const orgId = nodeId(org);

	let person = graph['@graph'].find((node) => node['@type'] === 'Person');
	if (!person) {
		person = { '@type': 'Person', '@id': personId, name };
		graph['@graph'].push(person);
	} else {
		const oldId = nodeId(person);
		person.name = name;
		if (oldId && oldId !== personId) rewriteIdRefs(graph, oldId, personId);
		else person['@id'] = personId;
	}

	const jobTitle = compact(founder?.jobTitle);
	if (jobTitle) person.jobTitle = jobTitle;
	const description = compact(founder?.description);
	if (description) person.description = description;
	const knowsAbout = (founder?.knowsAbout || []).map(compact).filter(Boolean);
	if (knowsAbout.length) person.knowsAbout = knowsAbout;
	if (orgId) person.worksFor = { '@id': orgId };
	const sameAs = filterOfficialSameAs(filterValidSchemaUrls(founder?.sameAs), origin);
	if (sameAs.length) person.sameAs = sameAs;
	if (org) org.founder = { '@id': personId };
}

function enrichPublicGraph(graph: StrictSchemaGraph, config: SchemaJsonLdConfig): StrictSchemaGraph {
	applyConfiguredFounder(graph, config);
	const language = compact(config.inLanguage) || 'ko-KR';
	const website = graph['@graph'].find((node) => node['@type'] === 'WebSite');
	if (website && !website.inLanguage) website.inLanguage = language;

	const person = graph['@graph'].find((node) => node['@type'] === 'Person') as StrictJsonLdNode | undefined;
	if (person) {
		const profileUrl = isValidSchemaUrl(config.founder?.url) ? compact(config.founder?.url) : '';
		if (profileUrl && !person.url) person.url = profileUrl;
		const biography = compact(config.founder?.description);
		if (biography && !person.description) person.description = biography;
		const eduUrl = alumniUrl(config.founder?.alumniOf);
		if (eduUrl && person.alumniOf && typeof person.alumniOf === 'object' && !Array.isArray(person.alumniOf)) {
			(person.alumniOf as StrictJsonLdNode).url = eduUrl;
		}
	}

	const facts = schemaConfigToGroundTruth(config);
	ensureBreadcrumb(graph, facts);
	applyConfiguredBreadcrumbs(graph, config);
	applySearchAction(graph, config);
	applyContactPoint(graph, config);
	applyAuthorPublisher(graph);
	applyWebsiteBreadcrumb(graph);
	applyAboutPage(graph, config);
	applyFaqPage(graph, config);
	applyCanonicalHomeUrl(graph, config);
	return graph;
}

function originOfConfig(config: SchemaJsonLdConfig): string {
	return compact(config.url).replace(/\/+$/, '');
}

function nodeId(node: StrictJsonLdNode | undefined): string {
	return typeof node?.['@id'] === 'string' ? node['@id'] : '';
}

function applyConfiguredBreadcrumbs(graph: StrictSchemaGraph, config: SchemaJsonLdConfig): void {
	const items = (config.breadcrumbs || [])
		.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: compact(item.name),
			item: isValidSchemaUrl(item.url) ? compact(item.url) : '',
		}))
		.filter((item) => item.name && item.item);
	if (!items.length) return;
	const crumb = graph['@graph'].find((node) => node['@type'] === 'BreadcrumbList');
	if (!crumb) return;
	crumb.itemListElement = items;
}

function applySearchAction(graph: StrictSchemaGraph, config: SchemaJsonLdConfig): void {
	const template = compact(config.searchUrlTemplate);
	if (!template.includes('{search_term_string}')) return;
	const probe = template.replace('{search_term_string}', 'query');
	if (!isValidSchemaUrl(probe)) return;
	const website = graph['@graph'].find((node) => node['@type'] === 'WebSite');
	if (!website || website.potentialAction) return;
	website.potentialAction = {
		'@type': 'SearchAction',
		target: {
			'@type': 'EntryPoint',
			urlTemplate: template,
		},
		'query-input': 'required name=search_term_string',
	};
}

function applyContactPoint(graph: StrictSchemaGraph, config: SchemaJsonLdConfig): void {
	const org = graphOrgNode(graph);
	if (!org || org.contactPoint) return;
	const telephone = typeof org.telephone === 'string' ? org.telephone : '';
	const email = compact(config.email);
	const contactUrl = isValidSchemaUrl(config.contactUrl) ? compact(config.contactUrl) : '';
	if (!telephone && !email && !contactUrl) return;
	const contact: StrictJsonLdNode = {
		'@type': 'ContactPoint',
		contactType: 'customer support',
		availableLanguage: ['Korean', 'English'],
	};
	if (telephone) contact.telephone = telephone;
	if (email) contact.email = email;
	if (contactUrl) contact.url = contactUrl;
	org.contactPoint = contact;
}

function applyAuthorPublisher(graph: StrictSchemaGraph): void {
	const org = graphOrgNode(graph);
	const orgId = nodeId(org);
	if (!orgId) return;
	const person = graph['@graph'].find((node) => node['@type'] === 'Person');
	const authorId = nodeId(person) || orgId;
	for (const node of graph['@graph']) {
		const type = node['@type'];
		const types = Array.isArray(type) ? type : [type];
		const isContent =
			types.includes('WebSite') ||
			types.includes('WebPage') ||
			types.includes('AboutPage') ||
			types.includes('FAQPage') ||
			types.includes('CollectionPage');
		if (!isContent) continue;
		if (!node.publisher) node.publisher = { '@id': orgId };
		if (!node.author) node.author = { '@id': authorId };
	}
}

function applyWebsiteBreadcrumb(graph: StrictSchemaGraph): void {
	const website = graph['@graph'].find((node) => node['@type'] === 'WebSite');
	const crumb = graph['@graph'].find((node) => node['@type'] === 'BreadcrumbList');
	const crumbId = nodeId(crumb);
	if (website && crumbId && !website.breadcrumb) website.breadcrumb = { '@id': crumbId };
}

/** Homepage `pageUrl` keeps a trailing slash on WebSite and Organization `url`. */
function applyCanonicalHomeUrl(graph: StrictSchemaGraph, config: SchemaJsonLdConfig): void {
	const origin = originOfConfig(config);
	const home = `${origin}/`;
	if (compact(config.pageUrl) !== home) return;
	const website = graph['@graph'].find((node) => node['@type'] === 'WebSite');
	const org = graphOrgNode(graph);
	if (website) website.url = home;
	if (org) org.url = home;
}

function applyAboutPage(graph: StrictSchemaGraph, config: SchemaJsonLdConfig): void {
	const about = config.about;
	if (!about) return;
	const origin = originOfConfig(config);
	const url = isValidSchemaUrl(about.url) ? compact(about.url) : `${origin}/about`;
	const description = compact(about.description) || compact(config.description);
	if (!description) return;
	const hasAbout = graph['@graph'].some((node) => node['@type'] === 'AboutPage');
	if (hasAbout) return;
	const orgId = nodeId(graphOrgNode(graph));
	const website = graph['@graph'].find((node) => node['@type'] === 'WebSite');
	const websiteId = nodeId(website);
	const aboutNode: StrictJsonLdNode = {
		'@type': 'AboutPage',
		'@id': `${url}#about`,
		url,
		name: compact(about.name) || `${compact(config.name)} 소개`,
		description,
	};
	if (websiteId) aboutNode.isPartOf = { '@id': websiteId };
	if (orgId) {
		aboutNode.about = { '@id': orgId };
		aboutNode.mainEntity = { '@id': orgId };
		aboutNode.publisher = { '@id': orgId };
	}
	const person = graph['@graph'].find((node) => node['@type'] === 'Person');
	aboutNode.author = { '@id': nodeId(person) || orgId };
	graph['@graph'].push(aboutNode);
}

function applyFaqPage(graph: StrictSchemaGraph, config: SchemaJsonLdConfig): void {
	const faqs = (config.faqs || [])
		.map((item) => ({ question: compact(item.question), answer: compact(item.answer) }))
		.filter((item) => item.question && item.answer);
	if (!faqs.length) return;
	const hasFaq = graph['@graph'].some((node) => node['@type'] === 'FAQPage');
	if (hasFaq) return;
	const origin = originOfConfig(config);
	const pageUrl = compact(config.pageUrl) || `${origin}/`;
	const orgId = nodeId(graphOrgNode(graph));
	const website = graph['@graph'].find((node) => node['@type'] === 'WebSite');
	const websiteId = nodeId(website);
	const person = graph['@graph'].find((node) => node['@type'] === 'Person');
	const faqNode: StrictJsonLdNode = {
		'@type': 'FAQPage',
		'@id': `${pageUrl}#faq`,
		url: `${pageUrl}#faq`,
		name: `${compact(config.name)} 자주 묻는 질문`,
		mainEntity: faqs.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: item.answer,
			},
		})),
	};
	if (websiteId) faqNode.isPartOf = { '@id': websiteId };
	if (orgId) faqNode.publisher = { '@id': orgId };
	faqNode.author = { '@id': nodeId(person) || orgId };
	graph['@graph'].push(faqNode);
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
