/**
 * Step 3: GEO Answer Center + E-E-A-T modules stay industry-native.
 * Run: npx tsx scripts/test-geo-answer-center-eeat.ts
 */
import { buildJsonLdFixSnippets } from '../lib/audit/jsonld-snippets';
import { buildEeatAuditData, resolveEeatSchemaType } from '../lib/audit/eeat-audit';
import { resolveRecommendedSchemas } from '../lib/audit/recommended-schemas';
import {
	buildCitationFaqs,
	buildClinicJsonLd,
	buildCopyCenterPayload,
	generatePrescriptionCode,
} from '../lib/geo/copy-center';
import { contextFromDiagnostic } from '../lib/geo/prescription-patches';
import { resolveIndustryConfig } from '../lib/registry/universalIndustryRegistry';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';
import type { GeoDiagnosticReport } from '../types/geo-diagnostic';
import { AI_ENGINE_CATALOG, enginesFromMap } from '../types/geo-diagnostic';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function stubGeo(url: string, brand: string): GeoDiagnosticReport {
	return {
		caseId: 'low',
		caseLabel: 'test',
		targetUrl: url,
		domain: url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
		brandName: brand,
		generatedAt: '2026-08-16T00:00:00.000Z',
		triggerQueries: { 1: `${brand} 위치`, 2: brand, 3: `${brand} 추천` },
		engines: enginesFromMap({
			chatgpt: {
				engine: AI_ENGINE_CATALOG.chatgpt,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 40,
				triggerQuery: `${brand} 위치`,
				simulatedResponse: '',
				improvementTip: '',
			},
		}),
	};
}

function check(id: string, status: AuditCheckItem['status']): AuditCheckItem {
	return { id, label: id, passed: status === 'pass', status, weight: 1 };
}

const legalReport = stubGeo('https://law.example.com', '강남법무법인');
const legalCopy = generatePrescriptionCode(
	legalReport,
	['이혼소송', '계약분쟁', '형사변호'],
	'ko',
	{
		industryType: 'GENERAL',
		category: '이혼소송',
		location: '강남',
		targetKeywords: ['이혼소송', '계약분쟁', '형사변호'],
		description: '이혼소송·계약분쟁 변호사 법률상담',
		ogDescription: '강남 법률사무소 수임 상담',
	},
);
assert('legal JSON-LD @type is LegalService', legalCopy.schemaJson.includes('"@type": "LegalService"'), legalCopy.schemaType);
assert('legal JSON-LD has no Hospital force', !legalCopy.schemaJson.includes('Hospital'));
assert('legal knowsAbout uses 이혼소송', legalCopy.schemaJson.includes('이혼소송'));
assert('legal FAQ has 5 questions', (legalCopy.faqJson.split('"@type": "Question"').length - 1) === 5);
assert('legal FAQ has no 진료 leftover', !/진료를 하나요|야간 또는 주말 진료/.test(legalCopy.faqJson));
assert('legal maps uses 법률사무소', /법률사무소/.test(legalCopy.mapsText), legalCopy.mapsText.slice(0, 180));
assert('legal blog uses 법률사무소 or 이혼소송', /법률사무소|이혼소송/.test(legalCopy.blogArticle));
assert('legal stopwords filtered', !/사이트맵|로그인/.test(legalCopy.schemaJson));

const stopwordCopy = generatePrescriptionCode(
	legalReport,
	['이혼소송', '사이트맵', '로그인'],
	'ko',
	{
		category: '이혼소송',
		location: '강남',
		description: '변호사 법률상담',
	},
);
assert('stopword 사이트맵 dropped from menus', !stopwordCopy.menus.some((m) => m.name === '사이트맵'));
assert('stopword 로그인 dropped from menus', !stopwordCopy.menus.some((m) => m.name === '로그인'));
assert('stopword not in knowsAbout', !/"knowsAbout"[\s\S]*사이트맵/.test(stopwordCopy.schemaJson));

const clinicCopy = buildCopyCenterPayload(
	stubGeo('https://clinic.example.com', '안성햇살의원'),
	'ko',
	{
		industryType: 'MEDICAL',
		category: '스포츠재활',
		location: '안성',
		targetKeywords: ['스포츠재활', '아동발달센터', '도수치료'],
		description: '스포츠재활 정형 통증 의원',
	},
);
assert('clinic JSON-LD @type is MedicalClinic', clinicCopy.schemaJson.includes('"@type": "MedicalClinic"'));
assert('clinic FAQ mentions 스포츠재활', clinicCopy.faqJson.includes('스포츠재활'));

const legalCfg = resolveIndustryConfig({
	lang: 'ko',
	brandName: '강남법무',
	location: '강남',
	services: ['이혼소송', '계약분쟁'],
	title: '강남법무법인',
	description: '변호사 법률상담',
	keywords: '로펌',
});
const legalCtx = contextFromDiagnostic(legalReport, 'ko', {
	category: '이혼소송',
	location: '강남',
	targetKeywords: ['이혼소송', '계약분쟁'],
	description: '변호사 법률상담',
});
legalCtx.schemaType = legalCfg.schemaType as typeof legalCtx.schemaType;
const legalFaqs = buildCitationFaqs(legalCtx, [
	{ rank: 1, name: '이혼소송' },
	{ rank: 2, name: '계약분쟁' },
	{ rank: 3, name: '형사변호' },
]);
assert('faqGenerator returns 5', legalFaqs.length === 5);
assert('faqGenerator uses 은/는 josa', legalFaqs.some((f) => /은|는/.test(f.question + f.answer)));

const legalLd = buildClinicJsonLd(legalCtx, [
	{ rank: 1, name: '이혼소송' },
	{ rank: 2, name: '사이트맵' },
]);
const knowsAbout = (legalLd['@graph'] as Array<Record<string, unknown>>)[0].knowsAbout as string[];
assert('knowsAbout drops 사이트맵', Array.isArray(knowsAbout) && knowsAbout.includes('이혼소송') && !knowsAbout.includes('사이트맵'));

assert(
	'legal recommended schema is LegalService',
	resolveRecommendedSchemas({ category: '법률 서비스', industry: '법률' })[0] === 'LegalService',
);
assert(
	'clinic recommended schema is MedicalClinic not Hospital',
	resolveRecommendedSchemas({
		industryType: 'MEDICAL',
		siteTitle: '안성햇살의원',
		category: '스포츠재활',
	})[0] === 'MedicalClinic',
);
assert(
	'Hospital incoming remaps to registry MedicalClinic',
	resolveRecommendedSchemas({ industryType: 'MEDICAL', category: '의원' })[0] !== 'Hospital',
);

const eeat = buildEeatAuditData({
	lang: 'ko',
	brandName: '강남법무법인',
	primaryKeyword: '이혼소송',
	category: '법률 상담',
	location: '강남',
	specialties: ['이혼소송', '계약분쟁'],
	industryType: 'GENERAL',
	schemaTypes: ['LegalService'],
	orgPresent: true,
	orgComplete: false,
	aiBotAccess: { gptbot: true, perplexitybot: true, claudebot: false, 'google-extended': true },
});
assert('E-E-A-T personJobTitle is 대표변호사', eeat.data.personJobTitle === '대표변호사', eeat.data.personJobTitle);
assert('E-E-A-T recommended schema is LegalService', eeat.data.recommendedSchemaType === 'LegalService');
assert('E-E-A-T bot claudeBot bound to robots false', eeat.data.botAccessibility.claudeBot === false);
assert('E-E-A-T bot gptBot bound to robots true', eeat.data.botAccessibility.gptBot === true);
assert('E-E-A-T checklist has 5 keys', Object.keys(eeat.data.schemaChecklist).length === 5);

assert(
	'resolveEeatSchemaType does not force Hospital for clinic hay',
	resolveEeatSchemaType({ vertical: 'medical', keywordHay: '안성 의원 스포츠재활' }) === 'MedicalClinic',
);

const personReport = {
	url: 'https://law.example.com',
	lang: 'ko',
	fetchedAt: '2026-08-16T00:00:00.000Z',
	httpStatus: 200,
	responseTimeMs: 80,
	pageSizeBytes: 20_000,
	score: 40,
	maxScore: 100,
	status: 'POOR',
	statusLabel: '개선 필요',
	schemaCoverage: 10,
	geoCitationScore: 18,
	siteMeta: {
		domain: 'law.example.com',
		brandName: '강남법무법인',
		category: '이혼소송',
		primaryKeyword: '이혼소송',
		industryType: 'GENERAL',
		location: '강남',
		title: '강남법무법인 | 이혼소송',
		metaDescription: '변호사 법률상담',
		coreSpecialties: ['이혼소송', '계약분쟁'],
	},
	metrics: {
		titleLength: 20,
		metaDescriptionLength: 20,
		h1Count: 1,
		headingSkipDetected: false,
		imagesTotal: 1,
		imagesMissingAlt: 0,
		imageAltCoveragePct: 100,
		jsonLdBlockCount: 0,
		schemaTypes: [],
		bodyTextLength: 200,
		renderBlockingScripts: 0,
		personMissing: ['jobTitle'],
	},
	categories: [],
	checklist: [check('person-eeat', 'fail')],
	findings: [],
} as unknown as AuditReport;

const snippets = buildJsonLdFixSnippets(personReport, 'ko');
const person = snippets.find((s) => s.id === 'person');
assert('Person snippet exists', Boolean(person));
assert('Person jobTitle is 대표변호사', Boolean(person?.code.includes('"jobTitle": "대표변호사"')), person?.code.slice(0, 240));
assert('Person snippet has no 대표원장 leftover', !person?.code.includes('대표원장'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall geo answer center / eeat assertions passed');
