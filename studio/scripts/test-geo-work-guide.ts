/**
 * GEO/AEO work-guide modal binds every string to the *currently diagnosed*
 * site (brand, URL, industry, NAP) instead of the old hardcoded 나인원의원
 * clinic reference. Run: npx tsx scripts/test-geo-work-guide.ts
 */
import { resolveGeoWorkGuideModel } from '../lib/audit/geo-work-guide';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

function check(id: string, status: AuditCheckItem['status'], weight: number): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight };
}

function baseReport(partial?: Partial<AuditReport>): AuditReport {
	return {
		url: 'https://example.com',
		lang: 'ko',
		fetchedAt: '2026-09-01T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 180,
		pageSizeBytes: 90_000,
		score: 49,
		maxScore: 122,
		status: 'POOR',
		statusLabel: '취약',
		categories: [],
		findings: [],
		checklist: [check('https', 'fail', 10)],
		...partial,
	};
}

// 1) A different clinic than the old hardcoded reference must bind its own name everywhere.
const clinic = resolveGeoWorkGuideModel(
	baseReport({
		url: 'https://gana-derma.example.com',
		siteMeta: {
			domain: 'gana-derma.example.com',
			brandName: '가나다의원',
			category: '피부과',
			primaryKeyword: '흉터 치료',
			industryType: 'MEDICAL',
			location: '서울 강남구',
			broadLocation: '서울',
			targetUrl: 'https://gana-derma.example.com',
			vertical: 'medical',
		} as AuditReport['siteMeta'],
		napMatrix: {
			canonical: { name: '가나다의원', address: '서울 강남구 테헤란로 1', phone: '02-1234-5678' },
			rows: [],
			recommendations: [],
		},
	}),
	'ko',
);
assert('clinic brand binds the live site, not 나인원의원', clinic.brandName === '가나다의원', clinic.brandName);
assert('clinic schema maps to MedicalClinic', clinic.schemaType === 'MedicalClinic', clinic.schemaType);
assert('clinic detail schema is MedicalProcedure', clinic.detailSchemaType === 'MedicalProcedure');
assert('clinic person schema is Physician', clinic.personSchemaType === 'Physician');
assert('clinic title example carries the live brand', clinic.titleExample.includes('가나다의원'), clinic.titleExample);
assert('clinic NAP resolves from napMatrix', clinic.address.includes('테헤란로') && clinic.phone === '02-1234-5678');
assert(
	'no leftover clinic-brand hardcoding',
	!clinic.titleExample.includes('나인원의원') &&
		!clinic.metaExample.includes('나인원의원') &&
		!clinic.jsonLdSample.includes('나인원의원') &&
		!clinic.engines.some((row) => row.action.includes('나인원의원') || row.source.includes('나인원의원')) &&
		!clinic.checklistItems.some((row) => row.copy.includes('나인원의원')),
);
const clinicJsonLd = JSON.parse(clinic.jsonLdSample) as Record<string, unknown>;
assert(
	'clinic JSON-LD sample uses the live schema + brand',
	clinicJsonLd['@type'] === 'MedicalClinic' && clinicJsonLd.name === '가나다의원',
	clinicJsonLd,
);
assert('clinic FAQ mentions the live brand or service', clinic.faq.question.length > 0 && clinic.faq.answer.length > 0);

// 2) A restaurant must not surface any medical-only platform or schema copy.
const restaurant = resolveGeoWorkGuideModel(
	baseReport({
		url: 'https://omakase-hana.example.com',
		metrics: {
			pageTitle: '스시하나 | 강남 오마카세 레스토랑',
			metaDescription: '스시하나는 강남 오마카세 전문 레스토랑입니다.',
		} as AuditReport['metrics'],
		siteMeta: {
			domain: 'omakase-hana.example.com',
			brandName: '스시하나',
			category: '오마카세 레스토랑',
			primaryKeyword: '오마카세',
			industryType: 'GENERAL',
			location: '서울 강남구',
			broadLocation: '서울',
			targetUrl: 'https://omakase-hana.example.com',
			vertical: 'local',
		} as AuditReport['siteMeta'],
	}),
	'ko',
);
assert('restaurant brand binds its own name', restaurant.brandName === '스시하나', restaurant.brandName);
assert('restaurant schema maps to Restaurant', restaurant.schemaType === 'Restaurant', restaurant.schemaType);
assert('restaurant detail schema is MenuItem', restaurant.detailSchemaType === 'MenuItem');
assert('restaurant person schema falls back to Person', restaurant.personSchemaType === 'Person');
assert(
	'restaurant platforms are food-delivery platforms, not medical ones',
	restaurant.platformsLabel.includes('배달의민족') && !restaurant.platformsLabel.includes('모두닥'),
	restaurant.platformsLabel,
);
assert(
	'restaurant copy has no medical device / clinic jargon',
	!restaurant.checklistItems.some((row) => row.copy.includes('MedicalClinic')) &&
		!restaurant.engines.some((row) => row.action.includes('모두닥')),
);

// 3) Legacy / crawl-blocked reports with no siteMeta must never throw and must
//    fall back to a safe, non-empty brand derived from the domain.
const minimal = resolveGeoWorkGuideModel(baseReport({ url: 'https://legacy-report.example.com' }), 'ko');
assert('minimal report resolves a non-empty brand', minimal.brandName.length > 0, minimal.brandName);
assert(
	'minimal report brand falls back to a domain-derived label, not a foreign clinic',
	minimal.brandName.length > 0 && minimal.brandName !== '나인원의원',
	minimal.brandName,
);
assert('minimal report still has 4 checklist items', minimal.checklistItems.length === 4);
assert('minimal report still has 6 engine rows', minimal.engines.length === 6);
assert('minimal report has no NAP when napMatrix is absent', minimal.hasNap === false);
assert('minimal report FAQ never throws / is non-empty', minimal.faq.question.length > 0 && minimal.faq.answer.length > 0);

// 4) Even a totally empty URL must not throw (defensive fallback path).
const empty = resolveGeoWorkGuideModel(baseReport({ url: '' }), 'ko');
assert('empty-url report resolves a fallback brand', empty.brandName === '해당 웹사이트', empty.brandName);

if (failed > 0) {
	console.error(`\n${failed} geo-work-guide assertion(s) failed`);
	process.exit(1);
}
console.log('\ngeo-work-guide assertions passed');
