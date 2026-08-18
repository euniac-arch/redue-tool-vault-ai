/**
 * Verifies category-aware GEO prescription patches without a live scrape.
 * Run: npx tsx scripts/test-geo-prescription.ts
 */
import { buildAiEngineVisibilityReport, buildTriggerQueries } from '../lib/audit/ai-engine-visibility';
import { extractValidSpecialties } from '../lib/geo/clean-medical-entities';
import { extractCoreSpecialties } from '../lib/geo/core-specialties';
import { generateEngineSimulation } from '../lib/geo/engine-simulation';
import { syncAfterReportToBeQueries } from '../lib/geo/prescription-after';
import { withJosa } from '../lib/korean-josa';
import {
	formatColloquialLocation,
	hasFormalAdminRegion,
	parseQueryLocation,
	pickExpandedTriggerQuery,
} from '../lib/geo/query-location';
import {
	buildCopyCenterPayload,
	copyCenterClipboardBundle,
	generatePrescriptionCode,
	isValidCopyCenterPayload,
} from '../lib/geo/copy-center';
import {
	resolveSchemaOrgType,
	resolveGeneratedSchemaType,
	summarizeAppliedSchemaTags,
	buildAfterDiagnosticReport,
	buildAppliedPatches,
	collectAuditTargetKeywords,
	contextFromDiagnostic,
	napFromAuditReport,
} from '../lib/geo/prescription-patches';
import type { AuditReport } from '../lib/site-auditor';
import { buildKeywordWeights, buildRecommendationReasons } from '../lib/geo/prompt-insights';
import { buildExpandedQueryCoverage } from '../lib/geo/query-coverage';
import {
	buildToBeCategoryKeywords,
	buildToBeKeywordPack,
	isConsultResearchAgency,
	shouldCapAsIsToBrandOnly,
} from '../lib/geo/as-is-honesty';
import { buildSiteEntityProfile, buildConversationalQuery } from '../lib/geo/site-entity';
import { asIsLevelFromDepth } from '../lib/geo/trigger-simulation';
import { AI_ENGINE_CATALOG, enginesFromMap } from '../types/geo-diagnostic';
import type { GeoDiagnosticReport } from '../types/geo-diagnostic';

function stubReport(url: string, brand: string, l2: string, l3: string): GeoDiagnosticReport {
	return {
		caseId: 'low',
		caseLabel: 'test',
		targetUrl: url,
		domain: url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
		brandName: brand,
		generatedAt: new Date().toISOString(),
		triggerQueries: { 1: `${brand} 위치`, 2: l2, 3: l3 },
		engines: enginesFromMap({
			chatgpt: {
				engine: AI_ENGINE_CATALOG.chatgpt,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 38,
				triggerQuery: `${brand} 위치`,
				simulatedResponse: '',
				improvementTip: '',
			},
			gemini: {
				engine: AI_ENGINE_CATALOG.gemini,
				statusBadge: 'not_indexed',
				depthLevel: null,
				score: 18,
				triggerQuery: l3,
				simulatedResponse: '',
				improvementTip: '',
			},
			claude: {
				engine: AI_ENGINE_CATALOG.claude,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 36,
				triggerQuery: `${brand} 위치`,
				simulatedResponse: '',
				improvementTip: '',
			},
			perplexity: {
				engine: AI_ENGINE_CATALOG.perplexity,
				statusBadge: 'moderate',
				depthLevel: 2,
				score: 68,
				triggerQuery: l2,
				simulatedResponse: '',
				improvementTip: '',
			},
			copilot: {
				engine: AI_ENGINE_CATALOG.copilot,
				statusBadge: 'not_indexed',
				depthLevel: null,
				score: 16,
				triggerQuery: l3,
				simulatedResponse: '',
				improvementTip: '',
			},
			clova: {
				engine: AI_ENGINE_CATALOG.clova,
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 34,
				triggerQuery: `${brand} 위치`,
				simulatedResponse: '',
				improvementTip: '',
			},
		}),
	};
}

const cases = [
	{
		name: 'hospital',
		url: 'https://clinic.example.com',
		brand: '한빛재활의원',
		industryType: 'MEDICAL' as const,
		category: '스포츠재활',
		location: '수원',
		keywords: ['도수치료', '재활'],
	},
	{
		name: 'shop',
		url: 'https://shop.example.com',
		brand: '한빛스토어',
		industryType: 'LOCAL_STORE' as const,
		category: '온라인 쇼핑몰',
		location: '서울',
		keywords: ['패션', '무료배송'],
	},
	{
		name: 'it',
		url: 'https://acme-saas.example.com',
		brand: 'Acme Cloud',
		industryType: 'B2B_MFG' as const,
		category: 'SaaS 솔루션',
		location: '',
		keywords: ['클라우드', '소프트웨어'],
	},
	{
		name: 'anseong-clinic',
		url: 'https://anseong-clinic.example.com',
		brand: '안성햇살의원',
		industryType: 'MEDICAL' as const,
		category: '스포츠재활',
		location: '안성',
		keywords: ['스포츠재활', '정형', '통증', '아동발달'],
	},
];

let failed = 0;
for (const c of cases) {
	const schema = resolveSchemaOrgType({
		industryType: c.industryType,
		keyword: c.keywords[0],
		category: c.category,
	});
	const report = stubReport(c.url, c.brand, `${c.location} ${c.category}`.trim(), `${c.category} 추천해줘`);
	const ctx = contextFromDiagnostic(report, 'ko', {
		industryType: c.industryType,
		category: c.category,
		location: c.location,
		targetKeywords: c.keywords,
		ogDescription: `${c.location} ${c.category} ${c.keywords.join(' ')}`.trim(),
		description: `${c.brand} ${c.location} ${c.category}`.trim(),
	});
	const patches = buildAppliedPatches(ctx);
	const coverage = buildExpandedQueryCoverage(ctx);
	const weights = buildKeywordWeights(ctx, coverage);
	const reasons = buildRecommendationReasons(ctx, coverage);
	const hasBrand = patches.jsonLd.includes(c.brand);
	const hasFaq = patches.faqCount === 5;
	const hasSpectrum = Boolean(coverage.spectrum.level1 && coverage.afterCombos.length >= 3);
	const bindsSite = coverage.brandName === c.brand && coverage.beforeQueries.some((q) => q.includes(c.brand));
	const hasWeights = weights.length > 0 && weights.every((row) => row.weight >= 40 && row.weight <= 92);
	const siteBoundWeights = weights.every((row) => !c.location || row.label.includes(c.location) || row.label.includes(c.category));
	const hasReasons =
		reasons.length === 3 &&
		reasons.some((r) => r.id === 'entity_specificity') &&
		reasons.some((r) => r.id === 'rag_citation') &&
		reasons.some((r) => r.id === 'longtail_intent') &&
		reasons.every((r) => Boolean(r.example) && r.mechanism.includes(r.example));
	const copyCenter = buildCopyCenterPayload(report, 'ko', {
		industryType: c.industryType,
		category: c.category,
		location: c.location,
		targetKeywords: c.keywords,
		ogDescription: `${c.location} ${c.category} ${c.keywords.join(' ')}`.trim(),
		description: `${c.brand} ${c.location} ${c.category}`.trim(),
	}, weights);
	const copyOk = isValidCopyCenterPayload(copyCenter);
	const copyHasHeadScript =
		copyCenter.schemaScript.includes('<script type="application/ld+json">') &&
		copyCenter.faqScript.includes('<script type="application/ld+json">');
	const copyHasMenus = copyCenter.menus.length >= 1 && copyCenter.menus.length <= 3;
	const medicalCopy =
		c.industryType !== 'MEDICAL' ||
		(copyCenter.schemaJson.includes('MedicalClinic') || copyCenter.schemaJson.includes('Hospital') || copyCenter.schemaJson.includes('Dentist')) &&
			copyCenter.schemaJson.includes('MedicalSpecialty');
	const ok =
		hasBrand &&
		hasFaq &&
		Boolean(schema) &&
		hasSpectrum &&
		bindsSite &&
		hasWeights &&
		siteBoundWeights &&
		hasReasons &&
		copyOk &&
		copyHasHeadScript &&
		copyHasMenus &&
		medicalCopy;
	if (!ok) failed += 1;
	console.log(
		JSON.stringify({
			case: c.name,
			schemaType: schema,
			patchSchema: patches.schemaType,
			faqCount: patches.faqCount,
			metaCount: patches.metaTags.length,
			level1: coverage.spectrum.level1,
			after: coverage.afterCombos.map((row) => row.display),
			weights: weights.map((row) => `${row.label}:${row.weight}`),
			reasons: reasons.map((row) => row.id),
			copyMenus: copyCenter.menus.map((m) => m.name),
			copyOk,
			hasBrand,
			ok,
		}),
	);
}

const regenCase = cases.find((c) => c.name === 'anseong-clinic');
if (regenCase) {
	const report = stubReport(
		regenCase.url,
		regenCase.brand,
		`${regenCase.location} ${regenCase.category}`.trim(),
		`${regenCase.category} 추천해줘`,
	);
	const customKeywords = ['아동발달센터', '스포츠재활', '정형'];
	const regenerated = generatePrescriptionCode(
		report,
		customKeywords,
		'ko',
		{
			industryType: regenCase.industryType,
			category: regenCase.category,
			location: regenCase.location,
			targetKeywords: regenCase.keywords,
			ogDescription: `${regenCase.location} ${regenCase.category} ${regenCase.keywords.join(' ')}`.trim(),
			description: `${regenCase.brand} ${regenCase.location} ${regenCase.category}`.trim(),
		},
	);
	const clipboard = copyCenterClipboardBundle(regenerated);
	const copySurfaces = [clipboard.schema, clipboard.faq, clipboard.maps, clipboard.blog];
	const menusMatch =
		regenerated.menus[0]?.name === '아동발달센터' &&
		regenerated.menus[1]?.name === '스포츠재활' &&
		regenerated.menus[2]?.name === '정형';
	const clipboardHasKeywords = customKeywords.every((keyword) =>
		copySurfaces.every((text) => text.includes(keyword)),
	);
	const clipboardDiffersFromDefault = (() => {
		const baseline = buildCopyCenterPayload(report, 'ko', {
			industryType: regenCase.industryType,
			category: regenCase.category,
			location: regenCase.location,
			targetKeywords: regenCase.keywords,
			ogDescription: `${regenCase.location} ${regenCase.category} ${regenCase.keywords.join(' ')}`.trim(),
			description: `${regenCase.brand} ${regenCase.location} ${regenCase.category}`.trim(),
		});
		return clipboard.schema !== baseline.schemaScript || clipboard.blog !== baseline.blogArticle;
	})();
	const regenOk = isValidCopyCenterPayload(regenerated) && menusMatch && clipboardHasKeywords && clipboardDiffersFromDefault;
	if (!regenOk) failed += 1;
	console.log(
		JSON.stringify({
			case: 'keyword-regenerate',
			menus: regenerated.menus.map((m) => m.name),
			clipboardHasKeywords,
			clipboardDiffersFromDefault,
			ok: regenOk,
		}),
	);
}

const entity = buildSiteEntityProfile({
	title: '파티클케어 | 해외 중입자 치료 전문 상담',
	metaDescription: '해외 중입자 치료 상담 에이전시. 탄소이온 치료 일정과 병원 매칭을 도와드립니다.',
	headings: ['해외 중입자 치료 상담'],
	brandName: '파티클케어',
	primaryKeyword: '중입자 치료',
	lang: 'ko',
});
const ionQueries = buildTriggerQueries({
	brandName: '파티클케어',
	category: entity.businessEntity,
	primaryKeyword: entity.businessEntity,
	location: '',
	domain: 'particle-care.example.com',
	lang: 'ko',
	businessEntity: entity.businessEntity,
	needSignals: entity.needSignals,
});
const ionCoverage = buildExpandedQueryCoverage(
	contextFromDiagnostic(
		stubReport('https://particle-care.example.com', '파티클케어', ionQueries.level2, ionQueries.level3),
		'ko',
		{
			industryType: 'MEDICAL',
			category: entity.businessEntity,
			location: '',
			targetKeywords: ['해외 중입자 치료', '상담', '에이전시'],
			ogDescription: '해외 중입자 치료 상담 에이전시',
			description: '해외 중입자 치료 상담',
			businessEntity: entity.businessEntity,
			needSignals: entity.needSignals,
		},
	),
);
const ionOk =
	!/야간/.test(ionQueries.level2 + ionQueries.level3 + ionCoverage.spectrum.level3) &&
	!/암치료 클리닉/.test(ionQueries.level2 + ionQueries.level3) &&
	/중입자/.test(ionQueries.level2 + ionQueries.level3) &&
	asIsLevelFromDepth(3) === 3 &&
	asIsLevelFromDepth(3, { isHttps: false }) === 1 &&
	asIsLevelFromDepth(1) === 1 &&
	buildConversationalQuery({ lang: 'ko', entity: '해외 중입자 치료 상담', needSignals: ['상담'] }).includes('상담');
if (!ionOk) failed += 1;
console.log(
	JSON.stringify({
		case: 'carbon-ion-triggers',
		entity: entity.businessEntity,
		needs: entity.needSignals,
		level1: ionQueries.level1,
		level2: ionQueries.level2,
		level3: ionQueries.level3,
		coverageL3: ionCoverage.spectrum.level3,
		ok: ionOk,
	}),
);

const institute = buildSiteEntityProfile({
	title: '한국중입자 암치료연구소 | 해외 중입자 치료 상담',
	metaDescription: '서초구 기반 암치료 상담 연구소. 대형병원 매칭과 해외 중입자 일정을 안내합니다.',
	brandName: '한국중입자 암치료연구소',
	primaryKeyword: '암치료',
	category: '암치료',
	location: '서초구',
	lang: 'ko',
});
const instituteQueries = buildTriggerQueries({
	brandName: '한국중입자 암치료연구소',
	category: institute.businessEntity,
	primaryKeyword: institute.businessEntity,
	location: '서초구',
	domain: 'carbon-ion.example.com',
	lang: 'ko',
	businessEntity: institute.businessEntity,
	needSignals: institute.needSignals,
});
const instituteCoverage = buildExpandedQueryCoverage(
	contextFromDiagnostic(
		stubReport(
			'https://carbon-ion.example.com',
			'한국중입자 암치료연구소',
			instituteQueries.level2,
			instituteQueries.level3,
		),
		'ko',
		{
			industryType: 'MEDICAL',
			category: institute.businessEntity,
			location: '서초구',
			targetKeywords: ['암치료', '중입자', '상담'],
			ogTitle: '한국중입자 암치료연구소',
			ogDescription: '서초구 암치료 상담 연구소',
			description: '해외 중입자 치료 상담. 협력 병원 매칭.',
			businessEntity: institute.businessEntity,
			needSignals: institute.needSignals,
		},
	),
);
const instituteVis = buildAiEngineVisibilityReport({
	url: 'https://carbon-ion.example.com',
	lang: 'ko',
	scenario: 'auto',
	siteMeta: {
		url: 'https://carbon-ion.example.com',
		domain: 'carbon-ion.example.com',
		brandName: '한국중입자 암치료연구소',
		title: '한국중입자 암치료연구소 | 해외 중입자 치료 상담',
		metaDescription: '서초구 기반 암치료 상담 연구소. 대형병원 매칭과 해외 중입자 일정을 안내합니다.',
		primaryKeyword: '암치료',
		category: '암치료',
		location: '서초구',
		industryType: 'MEDICAL',
		businessEntity: institute.businessEntity,
		needSignals: institute.needSignals,
	} as never,
	measuredEngineScores: {
		chatgpt: 88,
		gemini: 74,
		claude: 66,
		perplexity: 81,
		copilot: 70,
		clova: 62,
	},
});
const toBeKw = buildToBeCategoryKeywords({
	lang: 'ko',
	location: '서초구',
	category: '암치료',
	brandName: '한국중입자 암치료연구소',
});
const formalLocPack = buildToBeKeywordPack({
	lang: 'ko',
	location: '서초구 서울특별시',
	category: '암치료',
	primaryKeyword: '중입자 치료',
	brandName: '한국중입자 암치료연구소',
	businessEntity: '해외 중입자 치료 상담',
});
const expandedByEngine = instituteVis.engines.map((e) => e.postOptimization?.expandedTriggerQuery || '');
const asIsResponses = instituteVis.engines.map((e) => e.simulatedResponse).join(' ');
const locNorm =
	formatColloquialLocation('서울특별시 서초구') === '서울 서초구' &&
	formatColloquialLocation('서초구 서울특별시') === '서울 서초구' &&
	formatColloquialLocation('부산광역시') === '부산' &&
	parseQueryLocation('대구광역시 수성구').colloquial === '대구 수성구' &&
	!hasFormalAdminRegion(formatColloquialLocation('서울특별시 강남구'));
const diversified =
	toBeKw.includes('서초구 암치료 클리닉') &&
	toBeKw.some((q) => /서울 서초구 암치료 클리닉/.test(q)) &&
	toBeKw.some((q) => /서울 중입자 연구소/.test(q)) &&
	toBeKw.some((q) => /중입자 암치료 추천|중입자치료 상담|국내 일본 중입자치료/.test(q)) &&
	formalLocPack.all.every((q) => !hasFormalAdminRegion(q)) &&
	formalLocPack.local.some((q) => /서울 서초구/.test(q)) &&
	new Set(expandedByEngine.filter(Boolean)).size >= 3 &&
	pickExpandedTriggerQuery('gemini', formalLocPack) !== pickExpandedTriggerQuery('chatgpt', formalLocPack);
const instituteOk =
	isConsultResearchAgency({ brandName: '한국중입자 암치료연구소', title: institute.corpus }) &&
	shouldCapAsIsToBrandOnly({ brandName: '한국중입자 암치료연구소', title: institute.corpus }) &&
	instituteVis.brandOnlyAsIs === true &&
	instituteVis.engines.every((e) => e.triggerLevel <= 1) &&
	instituteVis.engines.every((e) => e.testedQuery === instituteQueries.level1) &&
	!/후보로 등장/.test(asIsResponses) &&
	/대형병원\/의원에 밀려/.test(asIsResponses) &&
	instituteCoverage.beforeQueries.every((q) => !/암치료 클리닉|암치료 추천/.test(q)) &&
	instituteCoverage.toBeKeywords.some((q) => /서초구 (해외 중입자 치료 상담|암치료 클리닉)/.test(q)) &&
	instituteCoverage.toBeKeywords.includes('서초구 암치료 추천') &&
	toBeKw.includes('서초구 암치료 클리닉') &&
	locNorm &&
	diversified &&
	asIsLevelFromDepth(3, { brandOnly: true }) === 1;
if (!instituteOk) failed += 1;
console.log(
	JSON.stringify({
		case: 'as-is-honesty-institute',
		brandOnly: instituteVis.brandOnlyAsIs,
		levels: instituteVis.engines.map((e) => e.triggerLevel),
		asIsQuery: instituteVis.engines[0]?.testedQuery,
		toBeKeywords: instituteCoverage.toBeKeywords,
		generatedToBe: toBeKw,
		expandedByEngine,
		locNorm,
		diversified,
		ok: instituteOk,
	}),
);

const auditStub = {
	url: 'https://seocho-clinic.example.com',
	siteMeta: {
		domain: 'seocho-clinic.example.com',
		brandName: '서초중입자센터',
		category: '중입자치료',
		primaryKeyword: '중입자 치료',
		industryType: 'MEDICAL',
		location: '서울 서초구',
		broadLocation: '서울',
		vertical: 'medical',
		targetUrl: 'https://seocho-clinic.example.com',
		businessEntity: '중입자 치료 상담',
		entityPhrases: ['중입자', '암치료'],
	},
	metrics: {
		jsonLdSnippets: [
			JSON.stringify({
				'@type': 'MedicalClinic',
				name: '서초중입자센터',
				url: 'https://seocho-clinic.example.com',
				telephone: '02-1234-5678',
				address: {
					'@type': 'PostalAddress',
					addressRegion: '서울',
					addressLocality: '서초구',
					streetAddress: '강남대로 123',
				},
			}),
		],
	},
} as AuditReport;
const auditKeywords = collectAuditTargetKeywords(auditStub);
const auditNap = napFromAuditReport(auditStub);
const pipelineOk =
	auditKeywords.includes('중입자 치료 상담') &&
	auditKeywords.includes('중입자') &&
	!auditKeywords.includes('서울 서초구') &&
	!auditKeywords.includes('서초중입자센터') &&
	auditNap.name === '서초중입자센터' &&
	auditNap.telephone === '02-1234-5678' &&
	auditNap.streetAddress === '강남대로 123' &&
	/서초/.test(auditNap.address || '');
if (!pipelineOk) failed += 1;
console.log(JSON.stringify({ case: 'audit-keyword-nap-pipeline', keywords: auditKeywords, nap: auditNap, ok: pipelineOk }));

const anseongSpecs = extractCoreSpecialties({
	title: '안성햇살의원 | 정형외과 · 도수치료 · 아동발달센터',
	metaKeywords: '도수치료, 통증클리닉, 아동발달, 정형외과',
	navMenuTexts: ['도수치료', '아동발달센터', '통증클리닉', '오시는 길', '진료시간'],
	description: '안성 정형·통증 클리닉. 도수치료와 아동발달 재활을 함께 합니다.',
	ogTitle: '안성햇살의원',
	lang: 'ko',
});
const anseongQueries = generateEngineSimulation(
	'chatgpt',
	'안성햇살의원',
	'안성',
	anseongSpecs,
	'sunshineclinic.kr',
).toBeQueries;
const anseongSimulations = (['chatgpt', 'gemini', 'claude', 'perplexity', 'copilot', 'clova'] as const).map((engine) =>
	generateEngineSimulation(engine, '안성햇살의원', '안성', anseongSpecs, 'sunshineclinic.kr'),
);
const anseongVis = buildAiEngineVisibilityReport({
	url: 'https://sunshineclinic.kr',
	lang: 'ko',
	scenario: 'low',
	siteMeta: {
		domain: 'sunshineclinic.kr',
		brandName: '안성햇살의원',
		title: '안성햇살의원 | 정형외과 · 도수치료 · 아동발달센터',
		metaKeywords: '도수치료, 통증클리닉, 아동발달',
		navMenuTexts: ['도수치료', '아동발달센터', '통증클리닉'],
		coreSpecialties: anseongSpecs,
		category: anseongSpecs[0] || '도수치료',
		primaryKeyword: anseongSpecs[0] || '도수치료',
		industryType: 'MEDICAL',
		location: '안성',
		broadLocation: '경기',
		vertical: 'medical',
		targetUrl: 'https://sunshineclinic.kr',
	},
});
const anseongHay = [
	...anseongSpecs,
	...anseongQueries,
	...anseongSimulations.flatMap((s) => [s.asIsResponse, s.toBeResponse, ...s.toBeQueries]),
	...anseongVis.engines.flatMap((e) => [
		e.simulatedResponse,
		e.postOptimization?.expectedSimulationResponse || '',
		...(e.postOptimization?.expandedCategoryQueries || []),
	]),
].join(' ');
const toBeTexts = anseongSimulations.map((s) => s.toBeResponse);
const asIsTexts = anseongSimulations.map((s) => s.asIsResponse);
const anseongOk =
	anseongSpecs.length >= 2 &&
	anseongSpecs.length <= 3 &&
	anseongSpecs.some((s) => /도수치료/.test(s)) &&
	anseongSpecs.some((s) => /아동발달/.test(s)) &&
	anseongSpecs.some((s) => /정형|통증/.test(s)) &&
	!/성형외과/.test(anseongSpecs.join(' ')) &&
	anseongQueries.every((q) => /안성/.test(q)) &&
	!/성형외과/.test(anseongHay) &&
	new Set(toBeTexts).size === 6 &&
	new Set(asIsTexts).size === 6 &&
	toBeTexts.some((t) => /\[1\] sunshineclinic\.kr/.test(t)) &&
	toBeTexts.some((t) => /\* \*\*전문 분야:\*\*/.test(t)) &&
	toBeTexts.some((t) => /Google 지식패널|지도/.test(t)) &&
	toBeTexts.some((t) => /플레이스/.test(t)) &&
	toBeTexts.some((t) => /E-E-A-T|진료 이력/.test(t)) &&
	toBeTexts.some((t) => /Bing|🔗/.test(t));
if (!anseongOk) failed += 1;
console.log(
	JSON.stringify({
		case: 'anseong-query-reach-simulation',
		specialties: anseongSpecs,
		toBeQueries: anseongQueries,
		uniqueToBe: new Set(toBeTexts).size,
		uniqueAsIs: new Set(asIsTexts).size,
		ok: anseongOk,
	}),
);

const leftoverSpecs = extractCoreSpecialties({
	title: '안성햇살의원 | 스포츠재활 · 아동발달센터',
	metaKeywords: '스포츠재활, 아동발달, 도수치료',
	navMenuTexts: ['스포츠재활', '아동발달센터', '원장소개', '안성햇살의원소개', '비급여항목', '방송출연', '오시는길'],
	description: '안성 스포츠재활 클리닉. 아동발달센터를 함께 운영합니다.',
	ogDescription: '안성 스포츠재활 · 아동발달 전문 의원',
	category: '성형외과',
	primaryKeyword: '성형외과',
	targetKeywords: ['성형외과', '원장소개', '스포츠재활'],
	lang: 'ko',
});
const leftoverStop = extractValidSpecialties([
	'스포츠재활',
	'원장소개',
	'안성햇살의원소개',
	'비급여항목',
	'방송출연',
	'아동발달센터',
]);
const leftoverReport = stubReport(
	'https://sunshineclinic.kr',
	'안성햇살의원',
	'안성 성형외과',
	'안성 성형외과 추천해줘',
);
leftoverReport.engines = leftoverReport.engines.map((engine) => ({
	...engine,
	postOptimization: {
		targetLevel: 3 as const,
		targetLevelLabel: 'Level 3',
		expandedTriggerQuery: '안성 성형외과 추천',
		expectedSimulationResponse: '성형외과 잔재',
		expandedCategoryQueries: ['안성 성형외과 클리닉', '안성 성형외과 추천'],
	},
}));
const leftoverCtx = contextFromDiagnostic(leftoverReport, 'ko', {
	industryType: 'MEDICAL',
	category: '성형외과',
	location: '안성',
	targetKeywords: ['원장소개', '스포츠재활', '아동발달센터', '성형외과'],
	ogTitle: '안성햇살의원 | 스포츠재활 · 아동발달센터',
	ogDescription: '안성 스포츠재활 · 아동발달 전문 의원',
	description: '안성 스포츠재활 클리닉. 아동발달센터를 함께 운영합니다.',
	title: '안성햇살의원 | 스포츠재활 · 아동발달센터',
	metaKeywords: '스포츠재활, 아동발달, 도수치료',
	navMenuTexts: ['스포츠재활', '아동발달센터', '원장소개', '비급여항목'],
});
const leftoverAfter = buildAfterDiagnosticReport(leftoverReport, leftoverCtx, leftoverReport.triggerQueries, 'ko');
const leftoverCopy = generatePrescriptionCode(leftoverReport, leftoverCtx.specialties, 'ko', {
	industryType: 'MEDICAL',
	category: leftoverCtx.specialties[0] || '스포츠재활',
	location: '안성',
	targetKeywords: leftoverCtx.specialties,
	ogDescription: leftoverCtx.ogDescription,
	description: leftoverCtx.description,
});
const leftoverHay = [
	leftoverSpecs.join(' '),
	leftoverCtx.specialties.join(' '),
	leftoverAfter.engines.flatMap((e) => e.postOptimization?.expandedCategoryQueries || []).join(' '),
	leftoverAfter.engines.map((e) => e.postOptimization?.expandedTriggerQuery || '').join(' '),
	leftoverCopy.faqJson,
	leftoverCopy.mapsText,
	leftoverCopy.schemaJson,
].join(' ');
const leftoverQueries = generateEngineSimulation(
	'chatgpt',
	'안성햇살의원',
	'안성',
	leftoverCtx.specialties,
	'sunshineclinic.kr',
).toBeQueries;
const syncedAfter = syncAfterReportToBeQueries(leftoverAfter, leftoverCtx.specialties, '안성', 'ko');
const leftoverOk =
	leftoverSpecs.some((s) => /스포츠재활/.test(s)) &&
	leftoverSpecs.some((s) => /아동발달/.test(s)) &&
	!leftoverSpecs.some((s) => /성형외과/.test(s)) &&
	!leftoverStop.includes('원장소개') &&
	!leftoverStop.includes('안성햇살의원소개') &&
	!leftoverStop.includes('비급여항목') &&
	leftoverStop.includes('스포츠재활') &&
	!/성형외과/.test(leftoverHay) &&
	!/원장소개|비급여항목|방송출연/.test(leftoverCopy.schemaJson) &&
	leftoverQueries.some((q) => /스포츠재활/.test(q)) &&
	leftoverQueries.every((q) => !/성형외과/.test(q)) &&
	syncedAfter.engines.every((e) => !(e.postOptimization?.expandedCategoryQueries || []).some((q) => /성형외과/.test(q))) &&
	/의원/.test(leftoverCopy.faqJson) &&
	!/스포츠재활 전문 병원/.test(leftoverCopy.faqJson) &&
	!/성형외과을/.test(leftoverCopy.faqJson) &&
	!/안성는/.test(leftoverCopy.faqJson) &&
	withJosa('안성', '은/는') === '안성은' &&
	withJosa('스포츠재활', '을/를') === '스포츠재활을' &&
	withJosa('아동발달센터', '을/를') === '아동발달센터를' &&
	withJosa('성형외과', '을/를') === '성형외과를';
if (!leftoverOk) failed += 1;
console.log(
	JSON.stringify({
		case: 'to-be-entity-sync-and-josa',
		specialties: leftoverSpecs,
		ctxSpecialties: leftoverCtx.specialties,
		toBeQueries: leftoverQueries,
		knowsAbout: leftoverCopy.schemaJson.includes('스포츠재활'),
		ok: leftoverOk,
	}),
);

const professionalHay = {
	industryType: 'B2B_MFG' as const,
	keyword: 'SEO 솔루션',
	category: '마케팅 에이전시',
	description: 'GEO 플랫폼과 검색 솔루션을 제공하는 전문 컨설팅 에이전시',
	brandName: '리듀에이전시',
	existingTypes: ['SoftwareApplication', 'WebSite'],
};
const professionalType = resolveSchemaOrgType(professionalHay);
const professionalCtx = contextFromDiagnostic(
	stubReport('https://agency.example.com', '리듀에이전시', '서울 마케팅 에이전시', '마케팅 에이전시 추천해줘'),
	'ko',
	{
		industryType: 'B2B_MFG',
		category: '마케팅 에이전시',
		location: '서울',
		targetKeywords: ['SEO 솔루션', 'GEO 컨설팅'],
		ogDescription: professionalHay.description,
		description: professionalHay.description,
		existingSchemaTypes: professionalHay.existingTypes,
	},
);
const professionalPatches = buildAppliedPatches(professionalCtx);
const professionalCopy = buildCopyCenterPayload(
	stubReport('https://agency.example.com', '리듀에이전시', '서울 마케팅 에이전시', '마케팅 에이전시 추천해줘'),
	'ko',
	{
		industryType: 'B2B_MFG',
		category: '마케팅 에이전시',
		location: '서울',
		targetKeywords: ['SEO 솔루션', 'GEO 컨설팅'],
		ogDescription: professionalHay.description,
		description: professionalHay.description,
		existingSchemaTypes: professionalHay.existingTypes,
	},
);
const professionalTags = summarizeAppliedSchemaTags(professionalPatches.jsonLd, professionalPatches.schemaType);
const professionalOk =
	professionalType === 'ProfessionalService' &&
	professionalCtx.schemaType === 'ProfessionalService' &&
	resolveGeneratedSchemaType(professionalCtx) === 'ProfessionalService' &&
	professionalPatches.schemaType === 'ProfessionalService' &&
	professionalPatches.jsonLd.includes('"@type": "ProfessionalService"') &&
	!professionalPatches.jsonLd.includes('"@type": "SoftwareApplication"') &&
	professionalCopy.schemaType === 'ProfessionalService' &&
	professionalCopy.schemaJson.includes('"@type": "ProfessionalService"') &&
	!professionalCopy.schemaJson.includes('"@type": "SoftwareApplication"') &&
	professionalTags.some((tag) => tag.key === '@type' && tag.value === 'ProfessionalService') &&
	!professionalTags.some((tag) => tag.value === 'SoftwareApplication');
if (!professionalOk) failed += 1;
console.log(
	JSON.stringify({
		case: 'professional-schema-ssot',
		resolver: professionalType,
		ctx: professionalCtx.schemaType,
		patch: professionalPatches.schemaType,
		copy: professionalCopy.schemaType,
		tags: professionalTags.map((tag) => `${tag.key}:${tag.value}`),
		ok: professionalOk,
	}),
);

if (failed) {
	console.error(`failed: ${failed}`);
	process.exit(1);
}
console.log('geo-prescription patches ok');
