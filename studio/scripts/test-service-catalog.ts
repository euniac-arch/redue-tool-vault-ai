/**
 * Shared service catalog slot — omit empty, medical type branch, Offer merge.
 * Run: npx tsx scripts/test-service-catalog.ts
 */
import {
	SERVICE_CATALOG_NAME,
	buildOfferCatalog,
	buildServiceCatalogRuntimePhp,
	buildServiceCatalogSlotPhp,
	isMedicalSchemaType,
	mergeServiceCatalog,
	normalizeServiceCatalog,
	phpServiceCatalogLiteral,
	resolveServiceItemType,
} from '../lib/solve/core/service-catalog';
import { buildUniversalGraphGlobalsSeedPhp, buildUniversalGraphRuntimeHelpersPhp } from '../lib/solve/core/universal-graph-builder';
import { buildWordpressSchemaEnginePhp } from '../lib/solve/wp-schema-engine';
import { buildStrictSchemaGraph, graphOrgNode } from '../lib/solve/core/strict-schema-graph';
import { buildUniversalGeoEngineJs, normalizeGeoServices } from '../lib/solve/universal-geo-engine';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(isMedicalSchemaType(['MedicalClinic', 'LocalBusiness']) === true, 'MedicalClinic is medical');
assert(isMedicalSchemaType(['Dentist']) === true, 'Dentist is medical');
assert(isMedicalSchemaType(['VeterinaryCare']) === true, 'VeterinaryCare is medical');
assert(isMedicalSchemaType(['MedicalBusiness']) === true, 'MedicalBusiness is medical');
assert(isMedicalSchemaType(['Organization', 'LocalBusiness']) === false, 'generic org is not medical');
assert(resolveServiceItemType(undefined, ['MedicalClinic']) === 'MedicalProcedure', 'auto MedicalProcedure');
assert(resolveServiceItemType(undefined, ['LocalBusiness']) === 'Service', 'auto Service');
assert(resolveServiceItemType('Service', ['MedicalClinic']) === 'Service', 'explicit Service wins');
assert(resolveServiceItemType('MedicalProcedure', ['Organization']) === 'MedicalProcedure', 'explicit MedicalProcedure wins');

assert(normalizeServiceCatalog([]).length === 0, 'empty array → no nodes');
assert(normalizeServiceCatalog(undefined).length === 0, 'undefined → no nodes');
assert(normalizeServiceCatalog(['', '  ']).length === 0, 'blank names omitted');

const medical = normalizeServiceCatalog(
	[
		{
			name: '정밀 맞춤 진단',
			category: '진단 및 분석',
			description: '환자별 맞춤형 진단 솔루션',
		},
		{ name: '정밀 맞춤 진단' },
		{ name: '' },
	],
	['MedicalClinic'],
);
assert(medical.length === 1, 'dedupe + drop empty');
assert(medical[0]['@type'] === 'MedicalProcedure', 'medical fallback type');
assert(medical[0].category === '진단 및 분석', 'category kept');
assert(medical[0].description === '환자별 맞춤형 진단 솔루션', 'description kept');

const general = normalizeServiceCatalog([{ name: '전략 컨설팅' }], ['ProfessionalService', 'Organization']);
assert(general[0]['@type'] === 'Service', 'business fallback type');

const emptyHost: Record<string, unknown> = { '@type': ['LocalBusiness', 'Organization'], name: '테스트' };
mergeServiceCatalog(emptyHost, []);
assert(emptyHost.availableService === undefined, 'empty omit availableService');
assert(emptyHost.hasOfferCatalog === undefined, 'empty omit hasOfferCatalog');
assert(JSON.stringify(emptyHost).includes('hasOfferCatalog') === false, 'empty key absent from JSON');
assert(JSON.stringify(emptyHost).includes('availableService') === false, 'empty availableService absent from JSON');

const filled = mergeServiceCatalog({ '@type': ['Dentist', 'LocalBusiness'] }, [
	{ name: '임플란트', category: '구강외과', description: '맞춤 임플란트' },
]);
assert(Array.isArray(filled.availableService) && filled.availableService.length === 1, 'availableService merged');
assert(filled.availableService?.[0]['@type'] === 'MedicalProcedure', 'Dentist → MedicalProcedure');
assert(filled.hasOfferCatalog?.['@type'] === 'OfferCatalog', 'OfferCatalog type');
assert(filled.hasOfferCatalog?.name === SERVICE_CATALOG_NAME, 'shared catalog title');
assert(filled.hasOfferCatalog?.itemListElement[0]['@type'] === 'Offer', 'Offer wrapper');
assert(filled.hasOfferCatalog?.itemListElement[0].itemOffered.name === '임플란트', 'itemOffered Service node');
assert(filled.hasOfferCatalog?.itemListElement[0].itemOffered.category === '구강외과', 'category on itemOffered');

assert(buildOfferCatalog([]) === undefined, 'no catalog object when empty');

const phpHelpers = buildServiceCatalogRuntimePhp();
assert(phpHelpers.includes('function redue_resolve_service_catalog_source'), 'php resolve source');
assert(phpHelpers.includes('function redue_normalize_service_nodes'), 'php normalize');
assert(phpHelpers.includes('function redue_bind_dual_service_catalog'), 'php bind');
assert(phpHelpers.includes(SERVICE_CATALOG_NAME), 'php catalog title');
assert(phpHelpers.includes("unset($org_node['availableService'], $org_node['hasOfferCatalog'])"), 'php unset empty');

const slot = buildServiceCatalogSlotPhp(phpServiceCatalogLiteral([]));
assert(slot.includes("$redue_service_catalog = array()"), 'empty slot is array()');
assert(slot.includes("$GLOBALS['redue_service_catalog']"), 'globals alias');
assert(slot.includes("'name'        => '정밀 맞춤 진단'"), 'slot documents the input shape');
assert(!slot.includes("'hasOfferCatalog'"), 'slot itself does not emit catalog keys');

const seed = buildUniversalGraphGlobalsSeedPhp({
	services: [{ name: '내과진료', category: '내과', description: '일반 내과 진료', type: 'MedicalProcedure' }],
});
assert(seed.includes("$redue_service_catalog"), 'gnu seed local slot');
assert(seed.includes("$GLOBALS['redue_service_catalog']"), 'gnu seed global slot');
assert(seed.includes('내과진료') && seed.includes('내과'), 'gnu seed category');

const helpers = buildUniversalGraphRuntimeHelpersPhp();
assert(helpers.includes('function redue_resolve_service_catalog_source'), 'helpers resolve');
assert(helpers.includes('redue_is_medical_schema_type'), 'helpers medical type');
assert(helpers.includes(SERVICE_CATALOG_NAME), 'helpers catalog title');

const wp = buildWordpressSchemaEnginePhp({
	industryType: 'MEDICAL',
	services: [{ name: '건강검진', category: '검진', description: '종합 검진', type: 'MedicalProcedure' }],
});
assert(wp.includes("$redue_service_catalog"), 'wp local slot');
assert(wp.includes("$GLOBALS['redue_service_catalog']"), 'wp global slot');
assert(wp.includes("apply_filters( 'redue_service_catalog'"), 'wp theme filter');
assert(wp.includes(SERVICE_CATALOG_NAME), 'wp catalog title');
assert(wp.includes('redue_wp_resolve_service_catalog_source'), 'wp resolve');
assert(wp.includes('건강검진') && wp.includes('검진'), 'wp category baked');

const emptyGraph = buildStrictSchemaGraph({ origin: 'https://clinic.example.com', siteName: '테스트의원' });
const emptyOrg = graphOrgNode(emptyGraph);
assert(emptyOrg?.hasOfferCatalog === undefined && emptyOrg?.availableService === undefined, 'strict empty omit');

const fullGraph = buildStrictSchemaGraph({
	origin: 'https://clinic.example.com',
	orgTypes: ['MedicalClinic', 'LocalBusiness', 'Organization'],
	services: [{ name: '내시경', category: '소화기', description: '위내시경' }],
});
const fullOrg = graphOrgNode(fullGraph);
assert(fullOrg !== undefined, 'strict org node');
assert((fullOrg!.hasOfferCatalog as { name: string }).name === SERVICE_CATALOG_NAME, 'strict catalog title');
assert((fullOrg!.availableService as Array<{ '@type': string }>)[0]['@type'] === 'MedicalProcedure', 'strict medical type');

assert(normalizeGeoServices([], ['MedicalClinic']).length === 0, 'geo empty omit');
assert(normalizeGeoServices([{ name: '스케일링' }], ['Dentist'])[0]['@type'] === 'MedicalProcedure', 'geo dentist type');

const js = buildUniversalGeoEngineJs();
assert(js.includes('serviceCatalog'), 'js reads serviceCatalog');
assert(js.includes(SERVICE_CATALOG_NAME), 'js catalog title');
assert(js.includes('item.category'), 'js copies category');
assert(js.includes('item.description'), 'js copies description');

console.log('test-service-catalog: ok');
