import type { IndustryType } from '@/lib/audit/site-metadata';
import type {
	AIEngineId,
	GeoDiagnosticReport,
	KeywordDepthLevel,
} from '@/types/geo-diagnostic';

export type PrescriptionLang = 'ko' | 'en';

export type SchemaOrgPrimaryType =
	| 'MedicalClinic'
	| 'Dentist'
	| 'VeterinaryCare'
	| 'Hospital'
	| 'LegalService'
	| 'AccountingService'
	| 'HomeAndConstructionBusiness'
	| 'HealthClub'
	| 'EducationalOrganization'
	| 'RealEstateAgent'
	| 'LocalBusiness'
	| 'Store'
	| 'Restaurant'
	| 'BeautySalon'
	| 'OnlineStore'
	| 'Organization'
	| 'Manufacturer'
	| 'SoftwareApplication'
	| 'ProfessionalService';

export interface GeoNapInfo {
	name?: string;
	telephone?: string;
	address?: string;
	addressLocality?: string;
	addressRegion?: string;
	streetAddress?: string;
	latitude?: string;
	longitude?: string;
}

export interface GeoMetaTag {
	name?: string;
	property?: string;
	content: string;
}

export interface GeoSiteContext {
	url: string;
	domain: string;
	brandName: string;
	category: string;
	primaryKeyword: string;
	location: string;
	industryType: IndustryType;
	schemaType: SchemaOrgPrimaryType;
	lang: PrescriptionLang;
	description?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	existingSchemaTypes: string[];
	nap: GeoNapInfo;
	targetKeywords: string[];
	/** Meta/schema-extracted specialty phrases (e.g. 통증클리닉, 아동발달). */
	specialties: string[];
	/** Raw `<title>` used for specialty ranking. */
	title?: string;
	/** Raw `meta[name=keywords]` content. */
	metaKeywords?: string;
	/** GNB / header nav labels from the crawl. */
	navMenuTexts?: string[];
	/** After-prescription analysis chips (e.g. 야간진료_속성_추가). */
	attributeLabels?: string[];
	/** Precise on-page business phrase used for trigger queries. */
	businessEntity?: string;
	entityPhrases?: string[];
	/** Need words actually present on the page — never invented. */
	needSignals?: string[];
	/** Footer / Person-schema representative legal name. */
	representativeName?: string;
	/** Footer / Person-schema jobTitle (대표원장 / 대표자). */
	representativeTitle?: string;
	/** When true, As-Is may only claim brand (Level 1) queries. */
	brandOnlyAsIs?: boolean;
}

export interface ApplyPrescriptionRequest {
	siteId?: string;
	targetUrl: string;
	currentSchema?: string | string[] | Record<string, unknown>;
	targetKeywords?: string[];
	/** Recrawl live HTML meta/schema instead of using a stored scrape. */
	forceRefresh?: boolean;
	lang?: PrescriptionLang;
	brandName?: string;
	category?: string;
	location?: string;
	industryType?: IndustryType;
	beforeLevels?: Partial<Record<AIEngineId, KeywordDepthLevel | 0 | null>>;
}

export interface PrescriptionLevelChange {
	before: number;
	after: number;
}

export interface PrescriptionAiSimulation {
	engine: string;
	engineId: AIEngineId;
	triggerLevel: string;
	triggerQuery: string;
	simulatedResponse: string;
	officialUrl: string;
}

export interface AppliedGeoPatches {
	jsonLd: string;
	jsonLdScript: string;
	faqCount: number;
	metaTags: GeoMetaTag[];
	schemaType: SchemaOrgPrimaryType;
	entityMentions: string[];
}

export type QueryCoverageRank = 1 | 2 | 3;

/** One Level-3 conversational combo AI can newly cite after GEO patches. */
export interface ExpandedQueryCombo {
	id: string;
	level: 3;
	/** Display tokens joined with " + " (location, need, specialty). */
	tokens: string[];
	display: string;
	/** Full conversational query used in engine simulation. */
	query: string;
	rank: QueryCoverageRank;
}

export interface QueryCoverageSpectrum {
	level1: string;
	level2: string;
	level3: string;
}

export interface ExpandedQueryCoverage {
	brandName: string;
	location: string;
	category: string;
	specialties: string[];
	needTerms: string[];
	insightAttributes: string[];
	spectrum: QueryCoverageSpectrum;
	beforeQueries: string[];
	beforeSummary: string;
	afterCombos: ExpandedQueryCombo[];
	insight: string;
	/** Category keywords classified as post-prescription (To-Be) only. */
	toBeKeywords: string[];
	brandOnlyAsIs?: boolean;
}

export type KeywordWeightSource = 'og' | 'meta' | 'schema' | 'keyword' | 'external';

/** AI-classified contribution of a location + specialty cluster (0–100). */
export interface KeywordWeight {
	id: string;
	/** Display label, e.g. "안성 + 스포츠재활". */
	label: string;
	tokens: string[];
	weight: number;
	source: KeywordWeightSource;
}

export type RecommendationReasonId = 'entity_specificity' | 'rag_citation' | 'longtail_intent';

/** One of the three GEO axes explaining why a Level-3 combo lifts AI rank. */
export interface RecommendationReason {
	id: RecommendationReasonId;
	index: 1 | 2 | 3;
	title: string;
	/** English axis name shown under the Korean title. */
	subtitle: string;
	/** Site-bound combo used as the concrete example. */
	example: string;
	mechanism: string;
	schemaHints: string[];
	/** Generic competing query (e.g. "안성 병원") contrasted in long-tail axis. */
	contrastQuery?: string;
}

export interface ApplyPrescriptionResponse {
	siteUrl: string;
	siteId?: string;
	appliedPatches: AppliedGeoPatches;
	levelChanges: Record<AIEngineId, PrescriptionLevelChange>;
	aiSimulations: PrescriptionAiSimulation[];
	afterReport: GeoDiagnosticReport;
	expandedQueryCoverage: ExpandedQueryCoverage;
	keywordWeights: KeywordWeight[];
	recommendationReasons: RecommendationReason[];
	scraped: boolean;
}
