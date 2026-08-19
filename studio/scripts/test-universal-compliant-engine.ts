/**
 * Universal compliant engine — legal / restaurant / SaaS / medical.
 * Run: npx tsx scripts/test-universal-compliant-engine.ts
 */
import { contextFromDiagnostic } from '../lib/geo/prescription-patches';
import { buildExpandedQueryCoverage } from '../lib/geo/query-coverage';
import { buildCopyCenterPayload, isValidCopyCenterPayload } from '../lib/geo/copy-center';
import {
	anonymizedCompetitorLabel,
	auditDataFromSite,
	buildCompliantFaqs,
	buildCompliantQuerySpectrum,
	buildSovMarketAnalysis,
	llmsMetaLine,
	resolveIndustryVoice,
	softenBannedClaims,
	softenComparativeQuery,
} from '../lib/audit/universal-compliant-engine';
import type { GeoDiagnosticReport } from '../types/geo-diagnostic';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function stubReport(url: string, brand: string, title: string): GeoDiagnosticReport {
	return {
		url,
		domain: new URL(url).hostname,
		score: 48,
		engines: [],
		triggerQueries: [],
		isPrescriptionApplied: false,
		siteTitle: title,
		brandName: brand,
	} as unknown as GeoDiagnosticReport;
}

const legal = auditDataFromSite({
	domain: 'lawfirm-abc.com',
	brandName: '법무법인 한결',
	location: '서초동',
	category: '기업 법률 자문',
	primaryKeyword: '기업 법률 자문',
	targetKeywords: ['기업 법률 자문', '계약 검토'],
	schemaType: 'LegalService',
	industryType: 'legal',
});
const legalVoice = resolveIndustryVoice(legal);
const legalSpectrum = buildCompliantQuerySpectrum(legal);
const legalFaqs = buildCompliantFaqs(legal);
assert('legal category 법률', legalVoice.categoryKo === '법률');
assert('legal schema LegalService', legal.schemaType === 'LegalService');
assert('legal L3 has 상담 절차', legalSpectrum.level3.includes('상담 절차'));
assert('legal L3 has no 승소/최고', !/승소|최고|잘하는 곳/.test(legalSpectrum.level3));
assert('legal FAQ cites domain', legalFaqs[0].answer.includes('lawfirm-abc.com'));
assert('legal competitor label', anonymizedCompetitorLabel(1, 'ko', legalVoice.categoryKo) === '경쟁 A사 (법률)');

const restaurant = auditDataFromSite({
	domain: 'cafe-xyz.kr',
	brandName: '애월바다카페',
	location: '제주 애월',
	category: '카페',
	primaryKeyword: '애월 카페',
	targetKeywords: ['브런치', '예약'],
	schemaType: 'Restaurant',
	industryType: 'restaurant',
});
const restoSpectrum = buildCompliantQuerySpectrum(restaurant);
assert('restaurant schema Restaurant', restaurant.schemaType === 'Restaurant');
assert('restaurant L3 is reservation/menu', restoSpectrum.level3.includes('예약 안내') && restoSpectrum.level3.includes('대표 메뉴'));
assert('restaurant L3 has no 맛집/후기', !/맛집|후기 좋은|잘하는 곳/.test(restoSpectrum.level3));

const saas = auditDataFromSite({
	domain: 'acme-cloud.io',
	brandName: 'Acme Cloud',
	location: '전국',
	category: '클라우드 보안 솔루션',
	primaryKeyword: '클라우드 보안 솔루션',
	targetKeywords: ['클라우드 보안 솔루션', '도입 절차'],
	schemaType: 'SoftwareApplication',
	industryType: 'professional',
});
const saasSpectrum = buildCompliantQuerySpectrum(saas);
assert('saas schema SoftwareApplication', saas.schemaType === 'SoftwareApplication');
assert('saas L3 is 도입/스펙', saasSpectrum.level3.includes('도입 절차') && saasSpectrum.level3.includes('기술 스펙'));
assert('saas competitor IT', anonymizedCompetitorLabel(2, 'ko', 'IT 솔루션') === '경쟁 B사 (IT 솔루션)');

const medical = auditDataFromSite({
	domain: 'nineoneclinic.com',
	brandName: '나인원의원',
	location: '대구',
	primaryKeyword: '피부과',
	targetKeywords: ['피부과', '성형외과'],
	schemaType: 'MedicalClinic',
	industryType: 'MEDICAL',
});
const medSpectrum = buildCompliantQuerySpectrum(medical);
assert('medical L1 is brand + 운영 안내', medSpectrum.level1 === '나인원의원 위치 및 운영 안내');
assert('medical L3 is 전문 시스템', medSpectrum.level3.includes('전문 시스템') && medSpectrum.level3.includes('대구'));
assert('medical no 잘하는 곳', !/잘하는 곳|후기 좋은/.test(`${medSpectrum.level1} ${medSpectrum.level2} ${medSpectrum.level3}`));

const sov = buildSovMarketAnalysis({
	location: '대구',
	primaryKeywords: ['피부과'],
	metrics: { currentShare: 5, targetShare: 48, directoryShare: 52, clientRank: 4 },
});
assert('sov analysis uses tokens', sov.includes('대구') && sov.includes('피부과') && sov.includes('5%') && sov.includes('48%'));
assert('sov analysis is a goal not a guarantee', sov.includes('목표로 최적화') && !/영구 확보|100% 보장/.test(sov));
assert('llms meta has region', llmsMetaLine(legal).includes('지역: 서초동') && llmsMetaLine(legal).includes('LegalService'));
assert('banned claims softened', softenBannedClaims('1위 독점 및 영구 확보') === '1위 추천 진입 목표 및 오가닉 유입 기반 구축');
assert('soften 잘하는 곳 is industry-neutral', !softenComparativeQuery('서울 카페 잘하는 곳').includes('의료기관'));

const legalReport = stubReport('https://lawfirm-abc.com', '법무법인 한결', '서초 기업 법률 자문');
const legalCtx = contextFromDiagnostic(legalReport, 'ko', {
	industryType: 'GENERAL',
	category: '기업 법률 자문',
	location: '서초동',
	targetKeywords: ['기업 법률 자문', '계약 검토'],
	ogDescription: '서초동 기업 법률 자문 법무법인',
	description: '법무법인 한결 서초동 기업 법률 자문',
	existingSchemaTypes: ['LegalService'],
});
const legalCoverage = buildExpandedQueryCoverage({ ...legalCtx, schemaType: 'LegalService' });
const legalCopy = buildCopyCenterPayload(legalReport, 'ko', {
	industryType: 'GENERAL',
	category: '기업 법률 자문',
	location: '서초동',
	targetKeywords: ['기업 법률 자문', '계약 검토'],
	existingSchemaTypes: ['LegalService'],
});
assert('legal coverage L3 has no 병원', !/병원|원장|피부과/.test(legalCoverage.spectrum.level3));
assert('legal copy schema LegalService', legalCopy.schemaJson.includes('LegalService'));
assert('legal copy payload valid', isValidCopyCenterPayload(legalCopy));
assert('legal FAQ uses brand', legalCopy.faqJson.includes('법무법인 한결'));

const restoReport = stubReport('https://cafe-xyz.kr', '애월바다카페', '제주 애월 브런치 카페');
const restoCopy = buildCopyCenterPayload(restoReport, 'ko', {
	industryType: 'LOCAL_STORE',
	category: '카페',
	location: '제주 애월',
	targetKeywords: ['브런치', '예약'],
	existingSchemaTypes: ['Restaurant'],
	ogDescription: '제주 애월 카페 예약 브런치',
});
assert('restaurant copy schema Restaurant', restoCopy.schemaJson.includes('Restaurant'));
assert('restaurant copy has no 원장/병원', !/원장|병원|피부과/.test(restoCopy.faqJson + restoCopy.llmsTxt));

const saasReport = stubReport('https://acme-cloud.io', 'Acme Cloud', '클라우드 보안 솔루션');
const saasCopy = buildCopyCenterPayload(saasReport, 'ko', {
	industryType: 'B2B_MFG',
	category: '클라우드 보안 솔루션',
	location: '전국',
	targetKeywords: ['클라우드 보안', '도입'],
	existingSchemaTypes: ['SoftwareApplication'],
});
assert(
	'saas copy uses software or org schema',
	/SoftwareApplication|Organization|ProfessionalService/.test(saasCopy.schemaJson),
	saasCopy.schemaType,
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nuniversal-compliant-engine ok');
