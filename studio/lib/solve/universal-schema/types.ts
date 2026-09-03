/**
 * Universal Schema Injection Engine — shared types.
 * Every field is optional: missing evidence means the key is omitted, never invented.
 */

export type DetectedSiteCms =
	| 'gnuboard'
	| 'wordpress'
	| 'php'
	| 'static-html';

export type SiteFactQa = {
	q: string;
	a: string;
};

export type SiteFactVideo = {
	url: string;
	embedUrl?: string;
	youtubeId?: string;
	thumbnailUrl?: string;
	name?: string;
};

export type SiteFactMedicalAbout = {
	type: 'MedicalDevice' | 'MedicalTherapy';
	name: string;
};

export type SiteFactPage = {
	path: string;
	filePath?: string;
	title?: string;
	description?: string;
	h1?: string;
	h2?: string[];
	h3?: string[];
	faq: SiteFactQa[];
	videos: SiteFactVideo[];
	medicalAbout: SiteFactMedicalAbout[];
};

export type SiteFactNap = {
	siteName?: string;
	repName?: string;
	repTitle?: string;
	telephone?: string;
	faxNumber?: string;
	taxId?: string;
	taxIdLabeled?: boolean;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	postalCode?: string;
	latitude?: string;
	longitude?: string;
	sameAs: string[];
};

export type ExtractedSiteFacts = {
	origin: string;
	cms: DetectedSiteCms;
	cmsSignals: string[];
	nap: SiteFactNap;
	pages: SiteFactPage[];
	orgTypes: string[];
};

export type SiteFactSourcePage = {
	path: string;
	filePath?: string;
	html?: string;
	title?: string;
	description?: string;
};

export type SiteFactAuditHint = {
	siteName?: string;
	ceoName?: string;
	representativeName?: string;
	representativeTitle?: string;
	telephone?: string;
	fax?: string;
	taxId?: string;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	postalCode?: string;
	latitude?: string;
	longitude?: string;
	sameAs?: string[];
	faqItems?: SiteFactQa[];
	industryType?: string;
	footerText?: string;
};

export type SiteFactExtractorInput = {
	origin: string;
	pages?: SiteFactSourcePage[];
	footerHtml?: string;
	footerText?: string;
	filePaths?: string[];
	htmlCorpus?: string;
	audit?: SiteFactAuditHint;
};

export type SchemaMetaBundle = {
	canonical?: string;
	title?: string;
	description?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogUrl?: string;
	llmsTxtHref?: string;
};

export type BuiltSchemaTemplate = {
	graph: {
		'@context': 'https://schema.org';
		'@graph': Record<string, unknown>[];
	};
	jsonLd: string;
	meta: SchemaMetaBundle;
	htmlHeadSnippet: string;
};
