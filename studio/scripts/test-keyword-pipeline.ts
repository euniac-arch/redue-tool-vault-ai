/**
 * GEO/SEO keyword pipeline: industry strategies + multi-service spread + medical leak guard.
 * Run: npx tsx scripts/test-keyword-pipeline.ts
 */
import {
	buildKeywordRecommendations,
	generateMedicalKeywordPipeline,
	generateUniversalKeywordPipeline,
	resolveKeywordIndustry,
	resolveRankedSpecialties,
} from '../lib/audit/keyword-recommendations';
import type { SiteMetadata } from '../lib/audit/site-metadata';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const specialties = ['스포츠재활', '아동발달센터', '정형·통증클리닉'];
const pipeline = generateMedicalKeywordPipeline('안성햇살의원', '안성', specialties);
const all = [
	...pipeline.aiPrompts,
	...pipeline.mainTargetKeywords,
	...pipeline.conversionLongtail,
	...pipeline.localLsiKeywords,
].join('\n');

assert('AI prompts are 6', pipeline.aiPrompts.length === 6, String(pipeline.aiPrompts.length));
assert('primary keywords are 6', pipeline.mainTargetKeywords.length === 6, String(pipeline.mainTargetKeywords.length));
assert('conversion longtail is 8', pipeline.conversionLongtail.length === 8, String(pipeline.conversionLongtail.length));
assert('local LSI is 8', pipeline.localLsiKeywords.length === 8, String(pipeline.localLsiKeywords.length));

for (const spec of specialties) {
	assert(`pipeline mentions ${spec}`, all.includes(spec), all);
}

assert('no 견적 leak', !/견적/.test(all), all);
assert('no 가이드/팁 leak', !/가이드|\b팁\b/.test(all), all);
assert('no 비교 후기 leak', !/비교 후기/.test(all), all);
assert('has 실비 intent', /실비/.test(all), all);
assert('has 예약 intent', /예약/.test(all), all);
assert('medical uses 내원/예약 actionName', /내원\/예약/.test(all), all);
assert('has 야간진료 intent', /야간진료/.test(all), all);
assert('has conversational care-system prompt', /정밀 진료 시스템 안내해줘/.test(all), all);

const meta: SiteMetadata = {
	domain: 'anseong-clinic.example',
	brandName: '안성햇살의원',
	category: '정형·통증클리닉',
	primaryKeyword: '정형·통증클리닉',
	industryType: 'MEDICAL',
	location: '안성',
	broadLocation: '경기',
	vertical: 'medical',
	targetUrl: 'https://anseong-clinic.example',
	coreSpecialties: specialties,
	title: '안성햇살의원 | 스포츠재활 · 아동발달센터 · 정형·통증클리닉',
	metaKeywords: '스포츠재활, 아동발달센터, 정형통증',
	navMenuTexts: ['스포츠재활', '아동발달센터', '통증클리닉'],
};

const ranked = resolveRankedSpecialties(meta, 'ko');
assert('ranked keeps 1st 스포츠재활', ranked[0] === '스포츠재활', ranked.join(','));
assert('ranked keeps 2nd 아동발달센터', ranked[1] === '아동발달센터', ranked.join(','));
assert('ranked keeps 3rd 정형·통증클리닉', ranked[2] === '정형·통증클리닉', ranked.join(','));

const pack = buildKeywordRecommendations(meta, 'ko');
const packAll = pack.categories.flatMap((c) => c.keywords).join('\n');
for (const spec of specialties) {
	assert(`pack chips include ${spec}`, packAll.includes(spec), packAll);
}
assert('pack has no 견적', !/견적/.test(packAll), packAll);

const b2b = buildKeywordRecommendations(
	{
		...meta,
		industryType: 'B2B_MFG',
		vertical: 'b2b',
		brandName: '레드유머신',
		category: '산업용 로봇',
		primaryKeyword: '산업용 로봇',
		coreSpecialties: ['산업용 로봇', '자동화 설비'],
	},
	'ko',
);
const b2bAll = b2b.categories.flatMap((c) => c.keywords).join('\n');
assert('B2B uses 문의/도입 actionName', /문의\/도입|도입/.test(b2bAll), b2bAll);
assert('B2B does not leak 견적/팁', !/견적|\b팁\b/.test(b2bAll), b2bAll);
assert('B2B does not force 실비', !/실비|과잉진료/.test(b2bAll), b2bAll);

const emptyServices = generateUniversalKeywordPipeline('레드유', '서울', []);
assert('empty services fall back to 전문 서비스', emptyServices.mainTargetKeywords.some((k) => k.includes('전문 서비스')), emptyServices.mainTargetKeywords.join(','));
assert('empty services do not invent 통증클리닉', !emptyServices.mainTargetKeywords.includes('통증클리닉'), emptyServices.mainTargetKeywords.join(','));

const legal = generateUniversalKeywordPipeline('강남법무법인', '강남', ['이혼소송', '계약분쟁', '상속'], 'legal');
const legalAll = [...legal.aiPrompts, ...legal.mainTargetKeywords, ...legal.conversionLongtail, ...legal.localLsiKeywords].join('\n');
assert('legal AI prompts are 6', legal.aiPrompts.length === 6, String(legal.aiPrompts.length));
assert('legal conversion is 8', legal.conversionLongtail.length === 8, String(legal.conversionLongtail.length));
assert('legal spreads 이혼소송', legalAll.includes('이혼소송'), legalAll);
assert('legal spreads 계약분쟁', legalAll.includes('계약분쟁'), legalAll);
assert('legal spreads 상속', legalAll.includes('상속'), legalAll);
assert('legal uses lawyer intent', /변호사|로펌|법률/.test(legalAll), legalAll);
assert('legal uses 상담/수임 actionName', /상담\/수임/.test(legalAll), legalAll);
assert('legal does not force medical intent', !/과잉진료|실비|야간진료/.test(legalAll), legalAll);

const beauty = generateUniversalKeywordPipeline('로즈뷰티', '홍대', ['피부관리', '속눈썹연장', '네일아트'], 'beauty');
const beautyAll = [...beauty.aiPrompts, ...beauty.conversionLongtail, ...beauty.localLsiKeywords].join('\n');
assert('beauty spreads 피부관리', beautyAll.includes('피부관리'), beautyAll);
assert('beauty spreads 속눈썹연장', beautyAll.includes('속눈썹연장'), beautyAll);
assert('beauty spreads 네일아트', beautyAll.includes('네일아트'), beautyAll);
assert('beauty uses salon intent', /샵|예약/.test(beautyAll), beautyAll);

const interior = generateUniversalKeywordPipeline('한옥스튜디오', '성수', ['아파트 인테리어', '부분 리모델링', '상업공간'], 'interior');
const interiorAll = [...interior.aiPrompts, ...interior.conversionLongtail].join('\n');
assert('interior keeps 견적', /견적/.test(interiorAll), interiorAll);
assert('interior spreads 아파트 인테리어', interiorAll.includes('아파트 인테리어'), interiorAll);

const general = generateUniversalKeywordPipeline('동네케어', '수원', ['방문케어', '정기점검'], 'general');
const generalAll = [...general.aiPrompts, ...general.conversionLongtail].join('\n');
assert('general uses neutral consult intent', /상담|예약|후기/.test(generalAll), generalAll);
assert('general does not force medical intent', !/과잉진료|실비/.test(generalAll), generalAll);

assert('detects legal from hay', resolveKeywordIndustry({ category: '법률 자문', industryType: 'B2B_MFG' }) === 'legal');
assert('detects tax from hay', resolveKeywordIndustry({ primaryKeyword: '종합소득세 신고' }) === 'tax');
assert('detects interior from hay', resolveKeywordIndustry({ category: '인테리어', industryType: 'LOCAL_STORE' }) === 'interior');
assert('unknown industry falls back to general', resolveKeywordIndustry({ industryType: 'LOCAL_STORE', category: '카페' }) === 'general');

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall keyword pipeline assertions passed');
