/**
 * Regression test for the "@graph 전역 순회" false-negative bug: a JSON-LD
 * `@graph` containing Organization + MedicalClinic + MedicalWebPage + Person
 * (with geo / openingHoursSpecification / hasOfferCatalog all present) must
 * never be reported as missing just because the display-truncated
 * `jsonLdSnippets` preview cuts the JSON mid-object.
 *
 * Run: npx tsx scripts/test-graph-schema-truncation.ts
 */
import * as cheerio from 'cheerio';
import { parsePageHtml } from '../lib/audit/parser';
import { buildSchemaPropertyChecks, buildSchemaPropertyChecksFromAudit } from '../lib/geo/precision-diagnostics';
import { scoreLiveDiagnosticFromAuditReport } from '../lib/admin/live-diagnostic-scores';
import type { AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// —— A large, realistic @graph: Organization + MedicalClinic + MedicalWebPage + Person ——
const graph = {
	'@context': 'https://schema.org',
	'@graph': [
		{
			'@type': 'Organization',
			name: '레듀클리닉',
			url: 'https://example.com',
			logo: 'https://example.com/logo.png',
			sameAs: ['https://blog.naver.com/redue', 'https://map.naver.com/redue'],
		},
		{
			'@type': 'MedicalClinic',
			name: '레듀클리닉',
			telephone: '02-1234-5678',
			address: {
				'@type': 'PostalAddress',
				streetAddress: '서울시 강남구 테헤란로 123',
				addressLocality: '강남구',
				addressRegion: '서울',
				postalCode: '06000',
				addressCountry: 'KR',
			},
			geo: { '@type': 'GeoCoordinates', latitude: 37.501, longitude: 127.039 },
			openingHoursSpecification: [
				{
					'@type': 'OpeningHoursSpecification',
					dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
					opens: '09:00',
					closes: '20:30',
				},
				{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday'], opens: '09:00', closes: '13:00' },
			],
			hasOfferCatalog: {
				'@type': 'OfferCatalog',
				name: '진료과목',
				itemListElement: [
					{ '@type': 'Offer', itemOffered: { '@type': 'MedicalProcedure', name: '통증클리닉' } },
					{ '@type': 'Offer', itemOffered: { '@type': 'MedicalProcedure', name: '재활클리닉' } },
					{ '@type': 'Offer', itemOffered: { '@type': 'MedicalProcedure', name: '도수치료' } },
				],
			},
		},
		{
			'@type': 'MedicalWebPage',
			name: '레듀클리닉 소개',
			url: 'https://example.com/about',
			about: { '@type': 'MedicalClinic', name: '레듀클리닉' },
		},
		{
			'@type': 'Person',
			name: '홍길동',
			jobTitle: '대표원장',
			worksFor: { '@type': 'MedicalClinic', name: '레듀클리닉' },
		},
	],
};

const html = `<html><head><script type="application/ld+json">${JSON.stringify(graph)}</script></head><body>hello</body></html>`;
const $ = cheerio.load(html);
const parsed = parsePageHtml($, 'https://example.com/', '레듀클리닉', html);

// —— 1. The display snippet is (as designed) truncated and the raw text is not ——
assert(
	'display snippet is truncated to preview length',
	(parsed.schema.snippets[0]?.length ?? 0) <= 1210,
	String(parsed.schema.snippets[0]?.length),
);
assert(
	'fullSnippets carries the untruncated JSON-LD text',
	(parsed.schema.fullSnippets[0]?.length ?? 0) > (parsed.schema.snippets[0]?.length ?? 0),
	`full=${parsed.schema.fullSnippets[0]?.length} snippet=${parsed.schema.snippets[0]?.length}`,
);

// —— 2. Page-schema detection reads the full parse directly — never corpus-truncated ——
assert('hasMedicalWebPage detected from @graph', parsed.schema.hasMedicalWebPage === true);
assert('MedicalClinic / Organization / Person all detected from @graph', ['MedicalClinic', 'Organization', 'Person'].every((t) => parsed.schema.types.includes(t)));

// —— 3. Feeding the TRUNCATED snippet corpus into the 5-property checklist silently drops offer catalog ——
const brokenChecks = buildSchemaPropertyChecks({
	lang: 'ko',
	schemaTypes: parsed.schema.types,
	jsonLdCorpus: parsed.schema.snippets.join('\n'),
});
const brokenCatalog = brokenChecks.find((c) => c.id === 'hasOfferCatalog');
assert(
	'sanity: truncated snippet corpus reproduces the false-negative catalog check',
	brokenCatalog?.complete === false,
	JSON.stringify(brokenCatalog),
);

// —— 4. Feeding the FULL (untruncated) corpus fixes all 4 checks ——
const fixedChecks = buildSchemaPropertyChecks({
	lang: 'ko',
	schemaTypes: parsed.schema.types,
	jsonLdCorpus: parsed.schema.fullSnippets.join('\n'),
});
const byId = Object.fromEntries(fixedChecks.map((c) => [c.id, c]));
assert('geo complete with full corpus', byId.geoCoordinates?.complete === true, JSON.stringify(byId.geoCoordinates));
assert('openingHours complete with full corpus', byId.openingHours?.complete === true, JSON.stringify(byId.openingHours));
assert('hasOfferCatalog complete with full corpus (3 items)', byId.hasOfferCatalog?.complete === true && /3/.test(byId.hasOfferCatalog.detail), JSON.stringify(byId.hasOfferCatalog));

// —— 5. End-to-end: buildSchemaPropertyChecksFromAudit prefers jsonLdFullCorpus on the report ——
const report = {
	url: 'https://example.com/',
	lang: 'ko',
	checklist: [],
	categories: [],
	metrics: {
		schemaTypes: parsed.schema.types,
		jsonLdSnippets: parsed.schema.snippets,
		jsonLdFullCorpus: parsed.schema.fullSnippets.join('\n'),
		jsonLdFullBlocks: parsed.schema.fullSnippets,
		organizationMissing: [],
	},
} as unknown as AuditReport;

const fromAudit = buildSchemaPropertyChecksFromAudit(report, 'ko');
const fromAuditById = Object.fromEntries(fromAudit.map((c) => [c.id, c]));
assert('buildSchemaPropertyChecksFromAudit: geo complete', fromAuditById.geoCoordinates?.complete === true);
assert('buildSchemaPropertyChecksFromAudit: openingHours complete', fromAuditById.openingHours?.complete === true);
assert('buildSchemaPropertyChecksFromAudit: hasOfferCatalog complete', fromAuditById.hasOfferCatalog?.complete === true);

// —— 6. Same report, but WITHOUT jsonLdFullCorpus (legacy cached report) still falls back safely ——
const legacyReport = {
	...report,
	metrics: { ...report.metrics, jsonLdFullCorpus: undefined, jsonLdFullBlocks: undefined },
} as unknown as AuditReport;
const fromLegacy = buildSchemaPropertyChecksFromAudit(legacyReport, 'ko');
assert('legacy report (no full corpus) still returns 5 checks without throwing', fromLegacy.length === 5);

// —— 7. Live-diagnostic score engine: multiple separate <script> blocks must not be joined into invalid JSON ——
const orgOnly = { '@type': 'Organization', name: '레듀클리닉', url: 'https://example.com', sameAs: ['https://blog.naver.com/redue'] };
const breadcrumbOnly = { '@type': 'BreadcrumbList', itemListElement: [] };
const multiBlockHtml = [
	`<script type="application/ld+json">${JSON.stringify(orgOnly)}</script>`,
	`<script type="application/ld+json">${JSON.stringify(breadcrumbOnly)}</script>`,
].join('\n');
const $multi = cheerio.load(`<html><head>${multiBlockHtml}</head><body>hi</body></html>`);
const parsedMulti = parsePageHtml($multi, 'https://example.com/', '레듀클리닉', `<html><head>${multiBlockHtml}</head><body>hi</body></html>`);
assert('multi-block page parses 2 raw blocks', parsedMulti.schema.fullSnippets.length === 2, String(parsedMulti.schema.fullSnippets.length));

const multiReport = {
	url: 'https://example.com/',
	lang: 'ko',
	checklist: [],
	categories: [],
	metrics: {
		schemaTypes: parsedMulti.schema.types,
		jsonLdSnippets: parsedMulti.schema.snippets,
		jsonLdFullCorpus: parsedMulti.schema.fullSnippets.join('\n'),
		jsonLdFullBlocks: parsedMulti.schema.fullSnippets,
		jsonLdBlockCount: parsedMulti.schema.rawBlockCount,
	},
} as unknown as AuditReport;
const liveScored = scoreLiveDiagnosticFromAuditReport(multiReport);
assert(
	'live-diagnostic scoring recovers Organization from a multi-block page (per-block array, not a joined string)',
	liveScored.schema > 0,
	JSON.stringify(liveScored),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall @graph truncation regression assertions passed');
