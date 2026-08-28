/**
 * hasOfferCatalog / availableService schema analyzer — @type arrays and
 * multi-level nested OfferCatalog trees.
 * Run: npx tsx scripts/test-offer-catalog-diagnostics.ts
 */
import { evaluateSchemaFiveProperties, isTargetOrgType } from '../lib/audit/extractors/universal-entity';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// —— @type array handling ——
assert('array @type recognizes LocalBusiness', isTargetOrgType(['MedicalClinic', 'Physician', 'LocalBusiness']) === true);
assert('array @type recognizes MedicalClinic alone', isTargetOrgType(['MedicalClinic']) === true);
assert('single string @type recognizes Organization', isTargetOrgType('Organization') === true);
assert('schema.org URI @type recognizes MedicalBusiness', isTargetOrgType('https://schema.org/MedicalBusiness') === true);
assert('unrelated @type array does not match', isTargetOrgType(['Article', 'BlogPosting']) === false);
assert('null/undefined @type does not match', isTargetOrgType(undefined) === false && isTargetOrgType(null) === false);

// —— multi-level nested OfferCatalog (카테고리 → 하위 카테고리 → 서비스) ——
const nestedCatalogLd = JSON.stringify({
	'@type': ['MedicalClinic', 'Physician', 'LocalBusiness'],
	name: '레듀클리닉',
	hasOfferCatalog: {
		'@type': 'OfferCatalog',
		name: '진료 서비스',
		itemListElement: [
			{
				'@type': 'OfferCatalog',
				name: '정형외과',
				itemListElement: [
					{ '@type': 'Offer', itemOffered: { '@type': 'MedicalProcedure', name: '도수치료' } },
					{ '@type': 'Offer', itemOffered: { '@type': 'MedicalProcedure', name: '체외충격파' } },
				],
			},
			{
				'@type': 'OfferCatalog',
				name: '재활클리닉',
				itemListElement: [{ '@type': 'Offer', itemOffered: { '@type': 'MedicalProcedure', name: '스포츠재활' } }],
			},
		],
	},
});
const nestedResult = evaluateSchemaFiveProperties(nestedCatalogLd, { schemaTypes: ['MedicalClinic'] });
assert('nested catalog is complete', nestedResult.availableService.complete === true);
assert('nested catalog flattens to 3 leaf services', nestedResult.availableService.count === 3, String(nestedResult.availableService.count));
assert('nested catalog reports 2 categories', nestedResult.availableService.categoryCount === 2, String(nestedResult.availableService.categoryCount));

// —— availableService only (no hasOfferCatalog) ——
const availableServiceLd = JSON.stringify({
	'@type': 'LocalBusiness',
	availableService: [{ '@type': 'Service', name: '상담' }, { '@type': 'Service', name: '진단' }, '방문진료'],
});
const availableServiceResult = evaluateSchemaFiveProperties(availableServiceLd);
assert('availableService array is complete', availableServiceResult.availableService.complete === true);
assert('availableService counts 3 entries', availableServiceResult.availableService.count === 3, String(availableServiceResult.availableService.count));

// —— catalog nested under a non-whitelisted key (e.g. `department`) ——
const departmentCatalogLd = JSON.stringify({
	'@type': 'MedicalClinic',
	department: [
		{
			'@type': ['MedicalClinic', 'Physician'],
			name: '재활센터',
			hasOfferCatalog: {
				'@type': 'OfferCatalog',
				itemListElement: [{ '@type': 'Offer', itemOffered: { name: '도수치료' } }, { '@type': 'Offer', itemOffered: { name: '체외충격파' } }],
			},
		},
	],
});
const departmentResult = evaluateSchemaFiveProperties(departmentCatalogLd);
assert('department-nested catalog is discovered', departmentResult.availableService.complete === true);
assert('department-nested catalog counts 2 services', departmentResult.availableService.count === 2, String(departmentResult.availableService.count));

// —— flat single-level catalog (baseline, should still work) ——
const flatLd = JSON.stringify({
	'@type': 'MedicalClinic',
	hasOfferCatalog: { '@type': 'OfferCatalog', name: '스포츠재활', itemListElement: [{ name: '도수치료' }, { name: '체외충격파' }] },
});
const flatResult = evaluateSchemaFiveProperties(flatLd);
assert('flat catalog is complete', flatResult.availableService.complete === true);
assert('flat catalog counts 2 items', flatResult.availableService.count === 2, String(flatResult.availableService.count));

// —— missing entirely ——
const noneLd = JSON.stringify({ '@type': 'LocalBusiness', name: 'No Catalog Co' });
const noneResult = evaluateSchemaFiveProperties(noneLd);
assert('no catalog/service data is not complete', noneResult.availableService.complete === false);
assert('no catalog/service data has zero count', noneResult.availableService.count === 0);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall offer-catalog diagnostics assertions passed');
