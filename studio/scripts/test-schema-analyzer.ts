/**
 * Unit tests for the canonical `schemaAnalyzer.ts` module: `@graph`
 * flattening into one entity pool, and the 4 checks that were previously
 * misdiagnosed as "missing" (page schema, geo, openingHoursSpecification,
 * hasOfferCatalog/availableService).
 * Run: npx tsx scripts/test-schema-analyzer.ts
 */
import {
	analyzeSchema,
	buildJsonLdEntityPool,
	detectGeoCoordinates,
	detectOpeningHoursSpecification,
	detectPageSchema,
	detectServiceCatalog,
} from '../lib/audit/schemaAnalyzer';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const html = `<html><head><script type="application/ld+json">${JSON.stringify({
	'@context': 'https://schema.org',
	'@graph': [
		{ '@type': 'Organization', name: 'Redue Clinic', url: 'https://example.com' },
		{
			'@type': 'MedicalClinic',
			name: 'Redue Clinic',
			geo: { '@type': 'GeoCoordinates', latitude: 37.5, longitude: 127.03 },
			openingHoursSpecification: [
				{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday'], opens: '09:00', closes: '20:00' },
			],
			hasOfferCatalog: {
				'@type': 'OfferCatalog',
				itemListElement: [{ '@type': 'Offer', itemOffered: { name: 'x' } }],
			},
		},
		{ '@type': 'MedicalWebPage', name: 'About Redue Clinic' },
		{ '@type': 'Person', name: 'Hong Gildong', jobTitle: 'Director' },
	],
})}</script></head><body>hi</body></html>`;

// —— 1. Entity pool is flattened: 4 nodes, not 1 root ——
const pool = buildJsonLdEntityPool(html);
assert('entity pool has all 4 @graph nodes', pool.length === 4, String(pool.length));
assert(
	'entity pool contains every @type',
	['Organization', 'MedicalClinic', 'MedicalWebPage', 'Person'].every((t) =>
		pool.some((n) => n['@type'] === t),
	),
);

// —— 2. Page schema (AboutPage/MedicalWebPage) detection ——
assert('detectPageSchema finds MedicalWebPage', detectPageSchema(pool).found === true);
assert('detectPageSchema reports the matched type', detectPageSchema(pool).type === 'MedicalWebPage');
assert('detectPageSchema is false on an empty pool', detectPageSchema([]).found === false);

// —— 3. geo detection ——
const geo = detectGeoCoordinates(pool);
assert('detectGeoCoordinates finds lat/lng nested under MedicalClinic', geo.found === true, JSON.stringify(geo));
assert('detectGeoCoordinates reads the correct values', geo.latitude === '37.5' && geo.longitude === '127.03');

// —— 4. openingHoursSpecification detection ——
assert('detectOpeningHoursSpecification finds the spec row', detectOpeningHoursSpecification(pool).found === true);

// —— 5. hasOfferCatalog / availableService detection ——
const catalog = detectServiceCatalog(pool);
assert('detectServiceCatalog finds at least 1 offer', catalog.found === true && catalog.itemCount >= 1, JSON.stringify(catalog));

// —— 6. One-call analyzeSchema wires everything together ——
const analysis = analyzeSchema(html);
assert('analyzeSchema.pageSchema.found', analysis.pageSchema.found === true);
assert('analyzeSchema.geo.found', analysis.geo.found === true);
assert('analyzeSchema.openingHours.found', analysis.openingHours.found === true);
assert('analyzeSchema.serviceCatalog.found', analysis.serviceCatalog.found === true);
assert(
	'analyzeSchema.entityTypes has all 4 types',
	['Organization', 'MedicalClinic', 'MedicalWebPage', 'Person'].every((t) => analysis.entityTypes.includes(t)),
);

// —— 7. A malformed block doesn't take down the rest of the pool ——
const mixedHtml = [
	'<script type="application/ld+json">{ this is not valid json </script>',
	`<script type="application/ld+json">${JSON.stringify({ '@type': 'Organization', name: 'Still Works' })}</script>`,
].join('\n');
const mixedPool = buildJsonLdEntityPool(mixedHtml);
assert('malformed block is skipped, valid block still parsed', mixedPool.length === 1 && mixedPool[0].name === 'Still Works');

// —— 8. Raw JSON-LD corpus (no <script> wrapper) falls back to brace-matching ——
const rawCorpus = [
	JSON.stringify({ '@type': 'Organization', name: 'Org A' }),
	JSON.stringify({ '@type': 'Person', name: 'Person B' }),
].join('\n');
const rawPool = buildJsonLdEntityPool(rawCorpus);
assert('raw multi-block corpus (no <script>) still yields 2 nodes', rawPool.length === 2, String(rawPool.length));

// —— 9. Nested @graph inside @graph is also flattened ——
const properNestedHtml = `<script type="application/ld+json">${JSON.stringify({
	'@graph': [{ '@graph': [{ '@type': 'FAQPage' }] }],
})}</script>`;
assert('doubly-nested @graph is flattened', buildJsonLdEntityPool(properNestedHtml).some((n) => n['@type'] === 'FAQPage'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall schemaAnalyzer assertions passed');
