/**
 * SchemaTemplateBuilder — Schema.org @graph from verified SiteFacts only.
 * FAQPage / VideoObject / Person / Medical* / empty NAP keys are omitted
 * when the matching fact was never extracted.
 */

import { buildFaqPageNode } from '@/lib/solve/core/eeat-citation';
import {
	buildStrictSchemaGraph,
	graphOrgNode,
	isValidGroundTruthRepName,
	type GroundTruthFacts,
	type StrictJsonLdNode,
} from '@/lib/solve/core/strict-schema-graph';
import type {
	BuiltSchemaTemplate,
	ExtractedSiteFacts,
	SchemaMetaBundle,
	SiteFactPage,
} from '@/lib/solve/universal-schema/types';

const MEDICAL_ORG = /MedicalClinic|Physician|Hospital|Dentist|VeterinaryCare|Pharmacy|MedicalBusiness/i;

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function omitEmptyDeep(value: unknown): unknown {
	if (value === null || value === undefined) return undefined;
	if (typeof value === 'string') return compact(value) || undefined;
	if (typeof value === 'number' || typeof value === 'boolean') return value;
	if (Array.isArray(value)) {
		const items = value.map(omitEmptyDeep).filter((item) => item !== undefined);
		return items.length ? items : undefined;
	}
	if (typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
			const next = omitEmptyDeep(item);
			if (next !== undefined) out[key] = next;
		}
		return Object.keys(out).length ? out : undefined;
	}
	return undefined;
}

function pageUrl(origin: string, path: string): string {
	if (/^https?:\/\//i.test(path)) return path;
	const suffix = path === '/' ? '/' : path;
	return `${origin.replace(/\/+$/, '')}${suffix}`;
}

function isMedicalOrg(types: string[]): boolean {
	return types.some((t) => MEDICAL_ORG.test(t));
}

function buildBreadcrumb(origin: string, page: SiteFactPage, siteName?: string): StrictJsonLdNode | null {
	const crumbs: Array<{ name: string; url: string }> = [];
	const homeName = compact(siteName);
	if (homeName) crumbs.push({ name: homeName, url: `${origin}/` });
	const title = compact(page.title || page.h1);
	const url = pageUrl(origin, page.path);
	if (title && url !== `${origin}/`) {
		crumbs.push({ name: title, url });
	}
	if (crumbs.length < 1) return null;
	return {
		'@type': 'BreadcrumbList',
		'@id': `${url}#breadcrumb`,
		itemListElement: crumbs.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: item.url,
		})),
	};
}

function buildVideoNodes(origin: string, page: SiteFactPage): StrictJsonLdNode[] {
	const pageHref = pageUrl(origin, page.path);
	return page.videos
		.filter((video) => compact(video.url) || compact(video.embedUrl))
		.map((video, index) => {
			const node: StrictJsonLdNode = {
				'@type': 'VideoObject',
				'@id': `${pageHref}#video-${index + 1}`,
			};
			const name = compact(video.name || page.h1 || page.title);
			if (name) node.name = name;
			node.contentUrl = compact(video.url) || compact(video.embedUrl);
			if (video.embedUrl) node.embedUrl = video.embedUrl;
			if (video.thumbnailUrl) node.thumbnailUrl = video.thumbnailUrl;
			return node;
		});
}

function buildMedicalNodes(origin: string, page: SiteFactPage): StrictJsonLdNode[] {
	return page.medicalAbout
		.filter((item) => compact(item.name))
		.map((item, index) => ({
			'@type': item.type,
			'@id': `${pageUrl(origin, page.path)}#${item.type.toLowerCase()}-${index + 1}`,
			name: compact(item.name),
		}));
}

function factsForPage(facts: ExtractedSiteFacts, page: SiteFactPage): GroundTruthFacts {
	const medical = isMedicalOrg(facts.orgTypes);
	return {
		origin: facts.origin,
		siteName: facts.nap.siteName,
		pageUrl: pageUrl(facts.origin, page.path),
		pageName: page.title || page.h1 || facts.nap.siteName,
		pageType: medical ? 'MedicalWebPage' : 'WebPage',
		description: page.description,
		orgTypes: facts.orgTypes,
		telephone: facts.nap.telephone,
		faxNumber: facts.nap.faxNumber,
		taxId: facts.nap.taxId,
		taxIdLabeled: facts.nap.taxIdLabeled,
		streetAddress: facts.nap.streetAddress,
		addressLocality: facts.nap.addressLocality,
		addressRegion: facts.nap.addressRegion,
		postalCode: facts.nap.postalCode,
		latitude: facts.nap.latitude,
		longitude: facts.nap.longitude,
		repName: facts.nap.repName,
		repTitle: facts.nap.repTitle,
		sameAs: facts.nap.sameAs,
		services: page.medicalAbout.map((item) => ({
			name: item.name,
			type: item.type === 'MedicalTherapy' ? 'MedicalProcedure' : 'Service',
		})),
	};
}

function buildMeta(facts: ExtractedSiteFacts, page: SiteFactPage): SchemaMetaBundle {
	const canonical = pageUrl(facts.origin, page.path);
	const title = compact(page.title || page.h1);
	const description = compact(page.description);
	const meta: SchemaMetaBundle = { canonical, llmsTxtHref: `${facts.origin}/llms.txt` };
	if (title) {
		meta.title = title;
		meta.ogTitle = title;
	}
	if (description) {
		meta.description = description;
		meta.ogDescription = description;
	}
	meta.ogUrl = canonical;
	return meta;
}

export function renderSchemaMetaHtml(meta: SchemaMetaBundle, jsonLd: string): string {
	const lines: string[] = [];
	if (meta.canonical) lines.push(`<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`);
	if (meta.llmsTxtHref) lines.push(`<link rel="help" href="${escapeAttr(meta.llmsTxtHref)}" />`);
	if (meta.title) lines.push(`<title>${escapeText(meta.title)}</title>`);
	if (meta.description) {
		lines.push(`<meta name="description" content="${escapeAttr(meta.description)}" />`);
	}
	if (meta.ogTitle) lines.push(`<meta property="og:title" content="${escapeAttr(meta.ogTitle)}" />`);
	if (meta.ogDescription) {
		lines.push(`<meta property="og:description" content="${escapeAttr(meta.ogDescription)}" />`);
	}
	if (meta.ogUrl) lines.push(`<meta property="og:url" content="${escapeAttr(meta.ogUrl)}" />`);
	lines.push(`<script type="application/ld+json">\n${jsonLd}\n</script>`);
	return lines.join('\n');
}

function escapeAttr(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildSchemaTemplate(
	facts: ExtractedSiteFacts,
	pagePath = '/',
): BuiltSchemaTemplate {
	const page = facts.pages.find((item) => item.path === pagePath) || facts.pages[0] || {
		path: pagePath,
		faq: [],
		videos: [],
		medicalAbout: [],
	};
	const base = buildStrictSchemaGraph(factsForPage(facts, page));
	const graph = [...base['@graph']];
	const pageHref = pageUrl(facts.origin, page.path);
	const webpage = graph.find((node) => node['@type'] === 'WebPage' || node['@type'] === 'MedicalWebPage');

	if (!isValidGroundTruthRepName(facts.nap.repName)) {
		const org = graphOrgNode({ '@context': 'https://schema.org', '@graph': graph });
		if (org) {
			delete org.founder;
			delete org.employee;
		}
	}

	const crumbs = buildBreadcrumb(facts.origin, page, facts.nap.siteName);
	if (crumbs) {
		graph.push(crumbs);
	} else if (webpage) {
		delete webpage.breadcrumb;
	}

	const faqNode = buildFaqPageNode({ canonicalUrl: pageHref, items: page.faq });
	if (faqNode) graph.push(faqNode as StrictJsonLdNode);

	const videos = buildVideoNodes(facts.origin, page);
	graph.push(...videos);

	const medical = buildMedicalNodes(facts.origin, page);
	if (medical.length && webpage) {
		graph.push(...medical);
		const about = webpage.about;
		const refs = medical.map((node) => ({ '@id': node['@id'] }));
		webpage.about = about ? [about, ...refs] : refs;
	}

	const compactGraph = omitEmptyDeep({
		'@context': 'https://schema.org',
		'@graph': graph,
	}) as BuiltSchemaTemplate['graph'];

	const jsonLd = JSON.stringify(compactGraph, null, 2);
	const meta = buildMeta(facts, page);
	return {
		graph: compactGraph,
		jsonLd,
		meta,
		htmlHeadSnippet: renderSchemaMetaHtml(meta, jsonLd),
	};
}

export function buildSchemaTemplatesForSite(facts: ExtractedSiteFacts): BuiltSchemaTemplate[] {
	const paths = facts.pages.length ? facts.pages.map((page) => page.path) : ['/'];
	return paths.map((path) => buildSchemaTemplate(facts, path));
}
