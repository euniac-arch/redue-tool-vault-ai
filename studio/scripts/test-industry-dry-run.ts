/**
 * 3-vertical dry-run: medical / legal / interior branch from brand + services.
 * Run: npx tsx scripts/test-industry-dry-run.ts
 */
import { computeAdvancedGeoMetrics } from '../lib/audit/advancedGeoMetrics';
import { getJosa, withJosa } from '../lib/korean-josa';
import { normalizeScore100, ONPAGE_MAX_SCORE } from '../lib/audit/onpage-diagnostic';
import { formatKiB, formatMs } from '../lib/audit/pagespeed';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const medical = computeAdvancedGeoMetrics({
	brandName: '안성햇살의원',
	title: '안성햇살의원',
	services: ['도수치료', '아동발달', '통증클리닉'],
	keywords: '도수치료, 아동발달, 통증클리닉',
	lang: 'ko',
});
assert('medical type', medical.industry.type === 'medical', medical.industry.type);
assert('medical @type MedicalClinic', medical.industry.schemaType === 'MedicalClinic');
assert('medical audience 환자', medical.industry.audienceName === '환자');
assert('medical action 내원/예약', medical.industry.actionName === '내원/예약');
assert('medical title 대표원장', medical.industry.personJobTitle === '대표원장');
assert('medical CPC 6500', medical.industry.cpc === 6_500, String(medical.industry.cpc));
assert('medical llms 도수치료 전문 의료기관', medical.llmsTxt.includes('도수치료 전문 의료기관'), medical.llmsTxt);

const legal = computeAdvancedGeoMetrics({
	brandName: '법무법인 한결',
	title: '법무법인 한결',
	services: ['이혼전문', '상속분쟁', '기업자문'],
	keywords: '이혼전문, 상속분쟁, 기업자문',
	lang: 'ko',
});
assert('legal type', legal.industry.type === 'legal', legal.industry.type);
assert('legal @type LegalService', legal.industry.schemaType === 'LegalService');
assert('legal audience 의뢰인', legal.industry.audienceName === '의뢰인');
assert('legal action 상담/수임', legal.industry.actionName === '상담/수임');
assert('legal title 대표변호사', legal.industry.personJobTitle === '대표변호사');
assert('legal CPC 12000', legal.industry.cpc === 12_000, String(legal.industry.cpc));
assert('legal llms 이혼전문 전문 법률사무소', legal.llmsTxt.includes('이혼전문 전문 법률사무소'), legal.llmsTxt);

const interior = computeAdvancedGeoMetrics({
	brandName: '공간디자인 림',
	title: '공간디자인 림',
	services: ['아파트인테리어', '상가리모델링'],
	keywords: '아파트인테리어, 상가리모델링',
	lang: 'ko',
});
assert('interior type', interior.industry.type === 'interior', interior.industry.type);
assert(
	'interior @type HomeAndConstructionBusiness (LocalBusiness subtype)',
	interior.industry.schemaType === 'HomeAndConstructionBusiness',
	interior.industry.schemaType,
);
assert('interior audience 고객', interior.industry.audienceName === '고객');
assert('interior action 견적/시공', interior.industry.actionName === '견적/시공');
assert('interior title 대표자', interior.industry.personJobTitle === '대표자');
assert('interior CPC 5000', interior.industry.cpc === 5_000, String(interior.industry.cpc));
assert(
	'interior llms 아파트인테리어 전문 시공 업체',
	interior.llmsTxt.includes('아파트인테리어 전문 시공 업체'),
	interior.llmsTxt,
);

assert('no medical leftover in legal llms', !/환자|내원|대표원장|의료기관|과잉진료/.test(legal.llmsTxt));
assert('no medical leftover in interior llms', !/환자|내원|대표원장|의료기관|과잉진료/.test(interior.llmsTxt));
assert('no legal leftover in medical llms', !/의뢰인|대표변호사|법률사무소/.test(medical.llmsTxt));

assert('이/가: 환자 → 가', getJosa('환자', '이/가') === '가');
assert('이/가: 의뢰인 → 이', getJosa('의뢰인', '이/가') === '이');
assert('을/를: 대표원장 → 을', getJosa('대표원장', '을/를') === '을');
assert('은/는: 고객 → 은', withJosa('고객', '은/는') === '고객은');
assert('54.5/122 → 45', normalizeScore100(54.5, ONPAGE_MAX_SCORE) === 45);
assert('122/122 → 100', normalizeScore100(122, ONPAGE_MAX_SCORE) === 100);
assert('formatMs 240 → 240 ms', formatMs(240) === '240 ms');
assert('formatMs 1500 → 1.50 s', formatMs(1500) === '1.50 s');
assert('formatKiB 1024 → 1 KiB', formatKiB(1024) === '1 KiB');
assert('formatMs null is empty not dash', formatMs(null) === '');
assert('formatKiB null is empty not dash', formatKiB(null) === '');

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall industry dry-run assertions passed');
