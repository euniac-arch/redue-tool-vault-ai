/**
 * Verifies 3-card business impact copy binds hospital / region / keyword
 * from live audit data — no leftover {keyword} placeholders.
 * Run: npx tsx scripts/test-business-impact-cards.ts
 */
import {
	buildBusinessImpactCards,
	splitEvidenceTags,
	toSeverityLevel,
} from '../lib/audit/business-impact-cards';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';

function check(id: string, status: AuditCheckItem['status']): AuditCheckItem {
	return { id, label: id, passed: status === 'pass', status, weight: 1 };
}

function stubReport(partial?: Partial<AuditReport>): AuditReport {
	const checklist = [
		check('jsonld-present', 'fail'),
		check('faq-howto-schema', 'fail'),
		check('organization', 'fail'),
		check('image-alt', 'warning'),
	];
	return {
		url: 'https://seocho-clinic.example.com',
		lang: 'ko',
		fetchedAt: '2026-08-15T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 120,
		pageSizeBytes: 80_000,
		score: 42,
		maxScore: 100,
		status: 'POOR',
		statusLabel: '개선 필요',
		schemaCoverage: 0,
		geoCitationScore: 20,
		siteMeta: {
			domain: 'seocho-clinic.example.com',
			brandName: '서초중입자센터',
			category: '중입자치료',
			primaryKeyword: '암치료',
			industryType: 'MEDICAL',
			location: '서울 서초구',
			broadLocation: '서울',
			vertical: 'medical',
			targetUrl: 'https://seocho-clinic.example.com',
		},
		metrics: {
			titleLength: 20,
			metaDescriptionLength: 80,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 14,
			imagesMissingAlt: 12,
			imageAltCoveragePct: 14,
			jsonLdBlockCount: 0,
			schemaTypes: [],
			bodyTextLength: 400,
			renderBlockingScripts: 3,
			organizationMissing: ['logo', 'url', 'sameAs'],
		},
		categories: [],
		checklist,
		findings: checklist
			.filter((item) => item.status !== 'pass')
			.map((item) => ({
				severity: item.status === 'fail' ? ('critical' as const) : ('warning' as const),
				title: item.label,
				detail: item.label,
				checkId: item.id,
			})),
		...partial,
	} as AuditReport;
}

let failed = 0;

const medical = buildBusinessImpactCards(stubReport(), null, 'ko');
const medicalOk =
	medical.context.voice === 'medical' &&
	medical.context.industryConfig.audienceName === '환자' &&
	medical.context.industryConfig.actionName === '내원/예약' &&
	medical.cards[0].vars.audienceName === '환자' &&
	medical.cards[0].vars.audienceNameJosa === '환자가' &&
	medical.context.brandName === '서초중입자센터' &&
	medical.context.region === '서울 서초구' &&
	medical.context.targetKeyword === '암치료' &&
	medical.cards.length === 3 &&
	medical.cards[0].id === 'patientLeak' &&
	medical.cards[0].severity === 'critical' &&
	medical.cards[0].tone === 'critical' &&
	medical.cards[1].id === 'trustUndervalued' &&
	medical.cards[1].severity === 'major' &&
	medical.cards[2].id === 'conversionDrop' &&
	medical.cards[2].severity === 'minor' &&
	medical.cards[2].vars.altLabel === '12/14' &&
	medical.cards[0].vars.jsonLdCount === 0 &&
	medical.cards[1].vars.orgMissing.includes('logo') &&
	!JSON.stringify(medical).includes('{keyword}') &&
	!JSON.stringify(medical).includes('{region}') &&
	!JSON.stringify(medical).includes('{targetKeyword}');
if (!medicalOk) failed += 1;
console.log(JSON.stringify({ case: 'medical-defaults', context: medical.context, cards: medical.cards.map((c) => ({ id: c.id, severity: c.severity, tone: c.tone, altLabel: c.vars.altLabel })), ok: medicalOk }));

const overridden = buildBusinessImpactCards(stubReport(), null, 'ko', {
	brandName: '한국중입자 암치료연구소',
	region: '부산 해운대',
	targetKeyword: '중입자치료',
});
const overrideOk =
	overridden.context.brandName === '한국중입자 암치료연구소' &&
	overridden.context.region === '부산 해운대' &&
	overridden.context.targetKeyword === '중입자치료';
if (!overrideOk) failed += 1;
console.log(JSON.stringify({ case: 'client-overrides', context: overridden.context, ok: overrideOk }));

const healthy = buildBusinessImpactCards(
	stubReport({
		checklist: [
			check('jsonld-present', 'pass'),
			check('faq-howto-schema', 'pass'),
			check('ai-bots-allowed', 'pass'),
			check('crawlable-text', 'pass'),
			check('organization', 'pass'),
			check('person-eeat', 'pass'),
			check('image-alt', 'pass'),
			check('html-lang', 'pass'),
		],
		findings: [],
		metrics: {
			titleLength: 20,
			metaDescriptionLength: 80,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 14,
			imagesMissingAlt: 1,
			imageAltCoveragePct: 93,
			jsonLdBlockCount: 3,
			schemaTypes: ['Organization', 'MedicalClinic'],
			bodyTextLength: 400,
			renderBlockingScripts: 0,
			organizationMissing: [],
		},
	}),
	null,
	'ko',
);
const healthyOk = healthy.cards.every((card) => card.tone === 'healthy' && card.severity === 'minor');
if (!healthyOk) failed += 1;
console.log(JSON.stringify({ case: 'healthy-cluster', tones: healthy.cards.map((c) => c.tone), ok: healthyOk }));

const severityMapOk =
	toSeverityLevel('critical', 'critical') === 'critical' &&
	toSeverityLevel('major', 'partial') === 'major' &&
	toSeverityLevel('minor', 'partial') === 'warning' &&
	toSeverityLevel('critical', 'healthy') === 'info';
if (!severityMapOk) failed += 1;
console.log(JSON.stringify({ case: 'severity-map', ok: severityMapOk }));

const tags = splitEvidenceTags('실측 근거: JSON-LD 0블록 · Perplexity/ChatGPT 인용 후보 미진입');
const tagsOk = tags.length === 2 && tags[0] === 'JSON-LD 0블록' && tags[1].includes('Perplexity');
if (!tagsOk) failed += 1;
console.log(JSON.stringify({ case: 'evidence-tags', tags, ok: tagsOk }));

if (failed) {
	console.error(`failed: ${failed}`);
	process.exit(1);
}
console.log('business-impact-cards ok');
