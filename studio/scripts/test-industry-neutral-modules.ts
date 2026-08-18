/**
 * Step 2: Quick Hook + 6-engine simulation stay industry-neutral.
 * Run: npx tsx scripts/test-industry-neutral-modules.ts
 */
import { buildBusinessImpactCards } from '../lib/audit/business-impact-cards';
import { buildEngineAnalysisReason } from '../lib/audit/engine-analysis';
import { detectEnginePlatformSignals, type EngineScoreSignals } from '../lib/audit/engine-analysis';
import { generateEngineSimulation } from '../lib/geo/engine-simulation';
import { attachCauseReason } from '../lib/korean-josa';
import {
	DEFAULT_METRIC_CATEGORY_NAME,
	combinedRagFactScore,
	isMetricImpactPassed,
	metricBenefitText,
	metricImpactBand,
	metricImpactCopy,
	metricImpactThreshold,
	resolveBenefitCategoryName,
} from '../lib/audit/metric-benefit';
import {
	DEFAULT_LLMS_CATEGORY_NAME,
	llmsTxtImpactCopy,
	resolveLlmsCategoryName,
} from '../lib/audit/llms-txt-impact';
import { resolveIndustryConfig } from '../lib/registry/universalIndustryRegistry';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';
import koMessages from '../messages/ko.json';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(id: string, status: AuditCheckItem['status']): AuditCheckItem {
	return { id, label: id, passed: status === 'pass', status, weight: 1 };
}

function stubReport(partial?: Partial<AuditReport>): AuditReport {
	const checklist = [check('jsonld-present', 'fail'), check('organization', 'fail')];
	return {
		url: 'https://law.example.com',
		lang: 'ko',
		fetchedAt: '2026-08-16T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 100,
		pageSizeBytes: 40_000,
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
			broadLocation: '서울',
			vertical: 'b2b',
			targetUrl: 'https://law.example.com',
			title: '강남법무법인 | 이혼소송 · 계약분쟁',
			metaDescription: '이혼소송과 계약분쟁 변호사 법률상담',
			metaKeywords: '로펌, 수임, 변호사',
			coreSpecialties: ['이혼소송', '계약분쟁', '형사변호'],
		},
		metrics: {
			titleLength: 24,
			metaDescriptionLength: 40,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 4,
			imagesMissingAlt: 2,
			imageAltCoveragePct: 50,
			jsonLdBlockCount: 0,
			schemaTypes: [],
			bodyTextLength: 300,
			renderBlockingScripts: 1,
			organizationMissing: ['logo', 'sameAs'],
		},
		categories: [],
		checklist,
		findings: [],
		...partial,
	} as AuditReport;
}

const legal = buildBusinessImpactCards(stubReport(), null, 'ko');
assert('legal hook audience is 의뢰인', legal.context.industryConfig.audienceName === '의뢰인', legal.context.industryConfig.audienceName);
assert('legal hook action is 상담/수임', legal.context.industryConfig.actionName === '상담/수임');
assert('legal hook josa is 의뢰인이', legal.cards[0].vars.audienceNameJosa === '의뢰인이');
assert('legal hook has no leftover 환자', !JSON.stringify(legal.cards[0].vars).includes('환자'));

const legalCfg = resolveIndustryConfig({
	lang: 'ko',
	brandName: '강남법무법인',
	location: '강남',
	services: ['이혼소송', '계약분쟁', '형사변호'],
	title: '강남법무법인',
	description: '이혼소송 변호사 법률상담',
	keywords: '로펌',
});
const legalSims = (['chatgpt', 'gemini', 'claude', 'perplexity', 'copilot', 'clova'] as const).map((engine) =>
	generateEngineSimulation(engine, '강남법무법인', '강남', ['이혼소송', '계약분쟁', '형사변호'], 'law.example.com', {
		industryConfig: legalCfg,
	}),
);
const legalHay = legalSims.flatMap((s) => [s.asIsResponse, s.toBeResponse, ...s.toBeQueries]).join(' ');
assert('legal toBe queries use services[0]', legalSims[0].toBeQueries.some((q) => /이혼소송/.test(q)), legalSims[0].toBeQueries.join(' | '));
assert('legal toBe queries use services[1]', legalSims[0].toBeQueries.some((q) => /계약분쟁/.test(q)), legalSims[0].toBeQueries.join(' | '));
assert('legal copy has no 성형외과 leftover', !/성형외과/.test(legalHay));
assert('legal copy has no hardcoded 의원/진료과', !/의원으로 확인|진료과|야간진료/.test(legalHay), legalHay.slice(0, 240));
assert('legal ChatGPT cites [1]', legalSims.some((s) => /\[1\] law\.example\.com/.test(s.toBeResponse)));
assert('legal Perplexity uses 전문 분야 footnotes', legalSims.some((s) => /\* \*\*전문 분야:\*\*/.test(s.toBeResponse)));
assert('legal Gemini mentions 지도', legalSims.some((s) => /지도|지식패널/.test(s.toBeResponse)));
assert('6 engines produce unique To-Be answers', new Set(legalSims.map((s) => s.toBeResponse)).size === 6);

const beautyCfg = resolveIndustryConfig({
	lang: 'ko',
	brandName: '홍대헤어샵',
	location: '홍대',
	services: ['커트', '펌', '염색'],
	title: '홍대헤어샵 로즈뷰티',
	description: '커트, 펌, 네일아트',
	keywords: '미용실',
});
const beautySim = generateEngineSimulation('chatgpt', '홍대헤어샵', '홍대', ['커트', '펌', '염색'], 'salon.example.com', {
	industryConfig: beautyCfg,
});
assert('beauty audience is 고객', beautyCfg.audienceName === '고객');
assert('beauty To-Be uses 커트', /커트/.test(beautySim.toBeResponse + beautySim.toBeQueries.join(' ')));
assert('beauty To-Be has no 병원/의원 leftover', !/병원|의원|진료/.test(beautySim.toBeResponse));

const napReason = buildEngineAnalysisReason(
	'gemini',
	{
		technicalPct: 40,
		schemaPct: 30,
		geoPct: 28,
		orgPresent: true,
		orgComplete: true,
		faqPresent: true,
		aiBotsOk: true,
		keywords: ['강남'],
		defectCount: 2,
		schemaDefectCount: 2,
		napOk: false,
		napIssue: 'NAP(상호·주소·전화) 미완결',
		platform: detectEnginePlatformSignals({
			schemaTypes: ['LegalService', 'Organization'],
			jsonLdCorpus: JSON.stringify({ '@type': 'LegalService', geo: { '@type': 'GeoCoordinates', latitude: 37, longitude: 127 } }),
		}),
	} satisfies EngineScoreSignals,
	'ko',
);
assert('Why & Status mentions NAP or schema defects', /NAP|온페이지|Schema/.test(napReason), napReason);
assert('attachCauseReason still corrects 이/가', attachCauseReason('스키마 결함 3건') === '스키마 결함 3건이 원인입니다.');

const VERTICAL_HARDCODE = /병원|한의원|로펌|변호사|세무사|뷰티샵|인테리어|SaaS|성형외과|의원으로/;
const benefitCopy = koMessages.audit.advancedGeo.benefit;
assert('entity i18n interpolates categoryName', benefitCopy.entity.with.includes('{categoryName}'));
assert('entity with i18n has no vertical hardcode', !VERTICAL_HARDCODE.test(benefitCopy.entity.with));
assert('entity without i18n has no vertical hardcode', !VERTICAL_HARDCODE.test(benefitCopy.entity.without));
assert('rag with i18n has no vertical hardcode', !VERTICAL_HARDCODE.test(benefitCopy.rag.with));
assert('rag without i18n has no vertical hardcode', !VERTICAL_HARDCODE.test(benefitCopy.rag.without));
assert('fallback category is 전문 기업/기관', resolveBenefitCategoryName(null) === DEFAULT_METRIC_CATEGORY_NAME.ko);
assert('entity threshold is 80', metricImpactThreshold('entity') === 80);
assert('rag threshold is 75', metricImpactThreshold('rag') === 75);
assert('entity 80 is good/pass', metricImpactBand('entity', 80) === 'good' && isMetricImpactPassed('entity', 80));
assert('entity 79 is warning/fail', metricImpactBand('entity', 79) === 'warning' && !isMetricImpactPassed('entity', 79));
assert('entity 49 is danger', metricImpactBand('entity', 49) === 'danger');
assert('rag 75 is good/pass', metricImpactBand('rag', 75) === 'good' && isMetricImpactPassed('rag', 75));
assert('rag 74 is warning/fail', metricImpactBand('rag', 74) === 'warning' && !isMetricImpactPassed('rag', 74));
assert('rag 49 is danger', metricImpactBand('rag', 49) === 'danger');
assert('combined rag/fact averages', combinedRagFactScore(90, 60) === 75);

const medicalBenefit = metricBenefitText('entity', resolveIndustryConfig({ lang: 'ko', type: 'medical' }));
const legalBenefit = metricBenefitText('entity', legalCfg);
const beautyBenefit = metricBenefitText('entity', beautyCfg);
assert('medical entity with uses 의료기관', medicalBenefit.includes('단일 신뢰 의료기관 엔티티'), medicalBenefit);
assert('legal entity with uses 법률사무소', legalBenefit.includes('단일 신뢰 법률사무소 엔티티'), legalBenefit);
assert('beauty entity with uses 뷰티샵', beautyBenefit.includes('단일 신뢰 뷰티샵 엔티티'), beautyBenefit);
assert('rag with is industry-agnostic', !VERTICAL_HARDCODE.test(metricBenefitText('rag', legalCfg)));
assert('entity without has no category noun', !metricImpactCopy('entity', legalCfg).withoutText.includes('법률사무소'));
assert(
	'lib entity with matches i18n template',
	medicalBenefit === benefitCopy.entity.with.replace('{categoryName}', '의료기관'),
);

const llmsImpactCopy = koMessages.audit.advancedGeo.llms.impact;
assert('llms impact with interpolates categoryName', llmsImpactCopy.with.includes('{categoryName}'));
assert('llms impact with i18n has no vertical hardcode', !VERTICAL_HARDCODE.test(llmsImpactCopy.with));
assert('llms impact without i18n has no vertical hardcode', !VERTICAL_HARDCODE.test(llmsImpactCopy.without));
assert('llms fallback category is 전문 비즈니스', resolveLlmsCategoryName(null) === DEFAULT_LLMS_CATEGORY_NAME.ko);

const medicalLlms = llmsTxtImpactCopy(resolveIndustryConfig({ lang: 'ko', type: 'medical' }));
const legalLlms = llmsTxtImpactCopy(legalCfg);
const beautyLlms = llmsTxtImpactCopy(beautyCfg);
assert('medical llms with uses 의료기관', medicalLlms.withText.includes('의료기관의 핵심 팩트'), medicalLlms.withText);
assert('legal llms with uses 법률사무소', legalLlms.withText.includes('법률사무소의 핵심 팩트'), legalLlms.withText);
assert('beauty llms with uses 뷰티샵', beautyLlms.withText.includes('뷰티샵의 핵심 팩트'), beautyLlms.withText);
assert('llms without has no category noun', !legalLlms.withoutText.includes('법률사무소'));
assert(
	'lib llms with matches i18n template',
	medicalLlms.withText === llmsImpactCopy.with.replace('{categoryName}', '의료기관'),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall industry-neutral module assertions passed');
