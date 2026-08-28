/**
 * Universal SEO / schema core — CMS-agnostic analysis & generation.
 *
 * Injection (file target, hook, marker wrap) lives in `lib/solve/adapters`.
 * DOM parse, entity extract, description, JSON-LD, sitemap, llms.txt stay here.
 */

export {
	TELEPHONE_BODY_RE,
	TELEPHONE_BODY_RE_PHP,
	KR_STREET_ADDRESS_RE,
	KR_STREET_ADDRESS_RE_PHP,
	TITLE_MIN_CHARS,
	TITLE_GOLDEN_MIN,
	TITLE_GOLDEN_MAX,
	TITLE_HARD_MAX,
	SHORT_TITLE_SUFFIX,
	extractTelephoneFromText,
	extractStreetAddressFromText,
	composeFallbackTitle,
	shouldExpandTitle,
	composeMissingImgAlt,
	buildExactCanonicalFromEnv,
} from '@/lib/solve/core/entity-patterns';

export {
	TELEPHONE_UNIVERSAL_RE,
	TELEPHONE_UNIVERSAL_RE_PHP,
	bindTelephone,
	extractTelHrefFromHtml,
	extractTelephoneFromHtml,
	formatKoreanTelephone,
	resolveUniversalTelephone,
	buildTelephoneGlobalsSeedPhp,
	buildTelephoneRuntimeHelpersPhp,
} from '@/lib/solve/core/telephone';

export {
	buildEvidenceFaqHowToHelpersPhp,
	buildEvidenceFaqInjectPhp,
	buildFaqPageNode,
	buildHowToAutoInjectPhp,
	buildHowToNode,
	buildPersonEeatNode,
	defaultFaqItems,
	defaultHowToSteps,
	ensureCitationMenuRows,
	excludeCitationVirtualFromSchemaPages,
	extractNapFromCorpus,
	inferKrPostalAddressFromIdentity,
	isCitationVirtualPage,
	isFaqGuidePage,
	isHowToGuidePage,
	resolveCompleteNap,
} from '@/lib/solve/core/eeat-citation';

export {
	classifyIndustrySchema,
	buildIndustryFaqItems,
	buildIndustryHowToSteps,
	orgTypesToPhpArray,
} from '@/lib/solve/core/industry-schema';

export {
	UNIVERSAL_GRAPH_GLOBALS,
	buildUniversalBreadcrumbEnsurePhp,
	buildUniversalGraphApplyPhp,
	buildUniversalGraphGlobalsSeedPhp,
	buildUniversalGraphRuntimeHelpersPhp,
	buildUniversalOrgFiveCoreBindPhp,
} from '@/lib/solve/core/universal-graph-builder';

export {
	SERVICE_CATALOG_NAME,
	MEDICAL_SCHEMA_ORG_TYPES,
	buildOfferCatalog,
	buildServiceCatalogRuntimePhp,
	buildServiceCatalogSlotPhp,
	isMedicalSchemaType,
	mergeServiceCatalog,
	normalizeServiceCatalog,
	phpServiceCatalogLiteral,
	resolveServiceItemType,
} from '@/lib/solve/core/service-catalog';
export type {
	NormalizedServiceNode,
	OfferCatalogNode,
	ServiceCatalogItem,
	ServiceCatalogSeed,
} from '@/lib/solve/core/service-catalog';

export {
	STRICT_SCHEMA_ENGINE_ID,
	INVENTED_DEFAULT_NAMES,
	INVENTED_DUMMY_PHONES,
	INVENTED_DUMMY_TAX_IDS,
	buildStrictSchemaGraph,
	graphHasPerson,
	graphOrgNode,
	isDummyPhoneNumber,
	isDummyTaxId,
	isKoreanTaxIdChecksumValid,
	isOfficialChannelHost,
	isTitleOnlyRepName,
	isValidGroundTruthRepName,
	matchesKoreanTaxIdPattern,
	normalizeGroundTruthPhone,
	normalizeGroundTruthSameAs,
	normalizeGroundTruthServices,
	normalizeGroundTruthTaxId,
} from '@/lib/solve/core/strict-schema-graph';

export {
	buildSchemaJsonLd,
	collectChannelUrls,
	filterValidSchemaUrls,
	formatSchemaScriptTag,
	isValidSchemaUrl,
	mergeSameAsFromConfig,
	renderSchemaJsonLdHtml,
	schemaConfigToGroundTruth,
	schemaHasFounderKnowledgeGraph,
	schemaHasNaverSameAs,
} from '@/lib/schema/jsonld';
export type {
	SchemaChannelConfig,
	SchemaJsonLdConfig,
	SchemaPersonConfig,
	SchemaPostalAddress,
} from '@/lib/schema/jsonld';

export {
	buildSchemaMappingJson,
	generateDynamicPhpSchema,
	generateSchemaInjector,
	pagesFromAuditPaths,
	REDUE_SCHEMA_MARKER_START,
	REDUE_SCHEMA_MARKER_END,
	REDUE_SCHEMA_RENDER_MARKER_START,
	REDUE_SCHEMA_RENDER_MARKER_END,
} from '@/lib/solve/dynamic-php-schema';

export {
	buildAiFriendlyRobotsTxt,
	buildGeoRootAssetPack,
	SITEMAP_XML_RELATIVE_PATH,
} from '@/lib/solve/geo-root-assets';

export {
	AI_ROBOTS_CRAWLERS,
	ROBOTS_CMS_RULES,
	detectRobotsCmsId,
	normalizeRobotsCmsId,
} from '@/lib/solve/robots-txt-builder';

export { LLMS_TXT_RELATIVE_PATH, buildSolveLlmsTxtMarkdown } from '@/lib/solve/llms-txt-deploy';
export {
	buildOfficialLlmsFullTxt,
	buildOfficialLlmsTxt,
	cleanLlmsBodyText,
	toLlmsPlainString,
} from '@/lib/solve/llms-content-engine';
export { buildRedueLlmsPhpEngine } from '@/lib/solve/llms-php-engine';
export { generateRssFeedCode, RSS_PHP_RELATIVE_PATH } from '@/lib/solve/rss-php-engine';

export {
	buildWordpressSchemaEnginePhp,
	extractWordpressSeedsFromCorePhp,
	extractWpFooterFax,
	extractWpFooterRepName,
	extractWpFooterStreetAddress,
	extractWpFooterTaxId,
	extractWpFooterTelephone,
	REDUE_WP_SCHEMA_ENGINE_VERSION,
	WP_FOOTER_FAX_RE,
	WP_FOOTER_REP_NAME_RE,
	WP_FOOTER_STREET_RE,
	WP_FOOTER_TAX_ID_RE,
	WP_FOOTER_TELEPHONE_RE,
} from '@/lib/solve/wp-schema-engine';

export {
	reconGnuboardSite,
	pickGnuboardReconPaths,
	resolveGnuboardHeadSubPath,
	GNUBOARD_EXTEND_ENGINE_PATH,
} from '@/lib/solve/gnuboard-site-recon';
