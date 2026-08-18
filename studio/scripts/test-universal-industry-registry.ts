/**
 * Universal GEO/SEO industry registry + auto classifier.
 * Run: npx tsx scripts/test-universal-industry-registry.ts
 */
import {
	INDUSTRY_TYPES,
	UNIVERSAL_INDUSTRY_REGISTRY,
	classifyIndustry,
	detectIndustry,
	detectIndustryFromMeta,
	getIndustryProfile,
	resolveIndustryConfig,
	toFaqPageJsonLd,
	toKeywordIndustry,
	toLegacyAuditIndustry,
	type IndustryType,
} from '../lib/registry/universalIndustryRegistry';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('registry has 12 industries', INDUSTRY_TYPES.length === 12, String(INDUSTRY_TYPES.length));

for (const type of INDUSTRY_TYPES) {
	const profile = UNIVERSAL_INDUSTRY_REGISTRY[type];
	assert(`${type} type matches key`, profile.type === type);
	assert(`${type} has schemaType`, Boolean(profile.schemaType));
	assert(`${type} has representativeTitle`, Boolean(profile.representativeTitle.ko && profile.representativeTitle.en));
	assert(`${type} personJobTitle aliases representativeTitle`, profile.personJobTitle.ko === profile.representativeTitle.ko);
	assert(`${type} has customerNoun`, Boolean(profile.customerNoun.ko && profile.customerNoun.en));
	assert(`${type} has audienceName alias`, profile.audienceName.ko === profile.customerNoun.ko);
	assert(`${type} has conversionGoal`, Boolean(profile.conversionGoal.ko && profile.conversionGoal.en));
	assert(`${type} has actionName alias`, profile.actionName.ko === profile.conversionGoal.ko);
	assert(`${type} has defaultCategory`, Boolean(profile.defaultCategory.ko && profile.defaultCategory.en));
	assert(`${type} has mainService`, Boolean(profile.mainService.ko && profile.mainService.en));
	assert(`${type} has subService`, Boolean(profile.subService.ko && profile.subService.en));
	assert(`${type} CPC > 0`, profile.benchmark.cpcKrw > 0, String(profile.benchmark.cpcKrw));
	assert(`${type} CVR in (0,1)`, profile.benchmark.conversionRate > 0 && profile.benchmark.conversionRate < 1);
	const prompts = profile.aiPromptGenerator({
		brandName: '테스트브랜드',
		location: '강남',
		primaryKeyword: profile.defaultCategory.ko,
		lang: 'ko',
	});
	assert(`${type} aiPromptGenerator returns 6`, prompts.length === 6, String(prompts.length));
	const faqs = profile.faqGenerator({
		brandName: '테스트브랜드',
		location: '강남',
		primaryKeyword: profile.defaultCategory.ko,
		url: 'https://example.com',
		lang: 'ko',
	});
	assert(`${type} faqGenerator returns 5`, faqs.length === 5, String(faqs.length));
	assert(`${type} FAQ has Q&A`, faqs.every((f) => f.question && f.answer));
}

assert('medical schema is MedicalClinic', UNIVERSAL_INDUSTRY_REGISTRY.medical.schemaType === 'MedicalClinic');
assert('legal schema is LegalService', UNIVERSAL_INDUSTRY_REGISTRY.legal.schemaType === 'LegalService');
assert('accounting schema is AccountingService', UNIVERSAL_INDUSTRY_REGISTRY.accounting.schemaType === 'AccountingService');
assert('beauty schema is BeautySalon', UNIVERSAL_INDUSTRY_REGISTRY.beauty.schemaType === 'BeautySalon');
assert('interior schema is HomeAndConstructionBusiness', UNIVERSAL_INDUSTRY_REGISTRY.interior.schemaType === 'HomeAndConstructionBusiness');
assert('professional schema is ProfessionalService', UNIVERSAL_INDUSTRY_REGISTRY.professional.schemaType === 'ProfessionalService');
assert('general schema is LocalBusiness', UNIVERSAL_INDUSTRY_REGISTRY.general.schemaType === 'LocalBusiness');
assert('fitness schema is HealthClub', UNIVERSAL_INDUSTRY_REGISTRY.fitness.schemaType === 'HealthClub');
assert('veterinary schema is VeterinaryCare', UNIVERSAL_INDUSTRY_REGISTRY.veterinary.schemaType === 'VeterinaryCare');
assert('education schema is EducationalOrganization', UNIVERSAL_INDUSTRY_REGISTRY.education.schemaType === 'EducationalOrganization');
assert('realestate schema is RealEstateAgent', UNIVERSAL_INDUSTRY_REGISTRY.realestate.schemaType === 'RealEstateAgent');
assert('restaurant schema is Restaurant', UNIVERSAL_INDUSTRY_REGISTRY.restaurant.schemaType === 'Restaurant');
assert('fitness personJobTitle is 대표원장', UNIVERSAL_INDUSTRY_REGISTRY.fitness.personJobTitle.ko === '대표원장');
assert('veterinary personJobTitle is 대표원장', UNIVERSAL_INDUSTRY_REGISTRY.veterinary.personJobTitle.ko === '대표원장');
assert('education personJobTitle is 원장', UNIVERSAL_INDUSTRY_REGISTRY.education.personJobTitle.ko === '원장');
assert('realestate personJobTitle is 대표공인중개사', UNIVERSAL_INDUSTRY_REGISTRY.realestate.personJobTitle.ko === '대표공인중개사');
assert('restaurant personJobTitle is 대표', UNIVERSAL_INDUSTRY_REGISTRY.restaurant.personJobTitle.ko === '대표');
assert('fitness mainService is 필라테스', UNIVERSAL_INDUSTRY_REGISTRY.fitness.mainService.ko === '필라테스');
assert('veterinary defaultCategory is 동물병원', UNIVERSAL_INDUSTRY_REGISTRY.veterinary.defaultCategory.ko === '동물병원');

assert('medical title is 대표원장', UNIVERSAL_INDUSTRY_REGISTRY.medical.representativeTitle.ko === '대표원장');
assert('medical personJobTitle is 대표원장', UNIVERSAL_INDUSTRY_REGISTRY.medical.personJobTitle.ko === '대표원장');
assert('legal title is 대표변호사', UNIVERSAL_INDUSTRY_REGISTRY.legal.representativeTitle.ko === '대표변호사');
assert('legal personJobTitle is 대표변호사', UNIVERSAL_INDUSTRY_REGISTRY.legal.personJobTitle.ko === '대표변호사');
assert('accounting title is 대표세무사', UNIVERSAL_INDUSTRY_REGISTRY.accounting.representativeTitle.ko === '대표세무사');
assert('medical customer is 환자', UNIVERSAL_INDUSTRY_REGISTRY.medical.customerNoun.ko === '환자');
assert('legal customer is 의뢰인', UNIVERSAL_INDUSTRY_REGISTRY.legal.customerNoun.ko === '의뢰인');
assert('medical goal is 내원/예약', UNIVERSAL_INDUSTRY_REGISTRY.medical.conversionGoal.ko === '내원/예약');
assert('legal goal is 상담/수임', UNIVERSAL_INDUSTRY_REGISTRY.legal.conversionGoal.ko === '상담/수임');
assert('interior goal is 견적/시공', UNIVERSAL_INDUSTRY_REGISTRY.interior.conversionGoal.ko === '견적/시공');
assert('professional goal is 문의/도입', UNIVERSAL_INDUSTRY_REGISTRY.professional.conversionGoal.ko === '문의/도입');

const cases: Array<{ label: string; expect: IndustryType; input: Parameters<typeof detectIndustry>[0] }> = [
	{
		label: 'medical from clinic title',
		expect: 'medical',
		input: {
			title: '안성햇살의원 | 스포츠재활 · 정형·통증클리닉',
			description: '야간진료와 초진 예약이 가능한 정형외과 의원',
			keywords: '도수치료, 실비, 전문의',
		},
	},
	{
		label: 'medical from dental keywords',
		expect: 'medical',
		input: { title: '강남스마일치과', description: '임플란트와 치아교정 전문', keywords: '치과' },
	},
	{
		label: 'legal from law firm',
		expect: 'legal',
		input: { title: '강남법무법인', description: '이혼소송·계약분쟁 변호사 법률상담', keywords: '로펌, 수임' },
	},
	{
		label: 'accounting from tax office',
		expect: 'accounting',
		input: { title: '서울세무회계사무소', description: '종합소득세 신고와 기장 대행', keywords: '세무사, 부가세' },
	},
	{
		label: 'beauty from salon',
		expect: 'beauty',
		input: { title: '홍대헤어샵 로즈뷰티', description: '커트, 펌, 네일아트, 피부관리', keywords: '미용실, 에스테틱' },
	},
	{
		label: 'interior from remodeling',
		expect: 'interior',
		input: { title: '성수 한옥 인테리어', description: '아파트 리모델링 시공과 견적 문의', keywords: '인테리어 업체' },
	},
	{
		label: 'professional from B2B SaaS',
		expect: 'professional',
		input: { title: '레드유 SaaS', description: 'B2B 마케팅 에이전시 솔루션 도입', keywords: '데모 신청, 컨설팅' },
	},
	{
		label: 'fitness from pilates studio',
		expect: 'fitness',
		input: { title: '강남 필라테스 스튜디오', description: '회원권과 체험 수업이 있는 피트니스', keywords: '필라테스, 헬스장' },
	},
	{
		label: 'veterinary from animal hospital',
		expect: 'veterinary',
		input: { title: '예담동물병원', description: '반려동물 예방접종과 펫케어', keywords: '동물병원, 수의사' },
	},
	{
		label: 'education from exam academy',
		expect: 'education',
		input: { title: '대치 입시학원', description: '수능·내신 보습 학원 등록 상담', keywords: '입시학원, 과외' },
	},
	{
		label: 'realestate from broker',
		expect: 'realestate',
		input: { title: '강남 공인중개사 사무소', description: '전월세 매물 상담과 부동산 중개', keywords: '공인중개사, 매매' },
	},
	{
		label: 'restaurant from franchise dining',
		expect: 'restaurant',
		input: { title: '한신포차 강남점', description: '외식 프랜차이즈 식당 예약', keywords: '맛집, 레스토랑' },
	},
	{
		label: 'general fallback cafe',
		expect: 'general',
		input: { title: '수원 브런치 카페', description: '커피와 디저트를 파는 동네 가게', keywords: '카페, 브런치' },
	},
	{
		label: 'empty corpus → general',
		expect: 'general',
		input: { title: '', description: '', keywords: '' },
	},
];

for (const c of cases) {
	const got = detectIndustry(c.input);
	assert(`detect ${c.label}`, got === c.expect, `got ${got}`);
}

assert(
	'피부과 의원 is medical not beauty',
	detectIndustry({ title: '강남 피부과 의원', description: '여드름 치료 전문의', keywords: '피부과' }) === 'medical',
);
assert(
	'피부관리 에스테틱 is beauty not medical',
	detectIndustry({ title: '강남 피부관리 에스테틱', description: '피부관리실 예약', keywords: '에스테틱, 샵' }) === 'beauty',
);
assert(
	'동물병원 is veterinary not medical',
	detectIndustry({ title: '예담동물병원', description: '반려동물 진료', keywords: '동물병원' }) === 'veterinary',
);
assert(
	'필라테스 is fitness not beauty',
	detectIndustry({ title: '홍대 필라테스', description: '체험 수업과 회원권', keywords: '필라테스' }) === 'fitness',
);

assert(
	'detectIndustryFromMeta uses title+keywords',
	detectIndustryFromMeta({
		title: '부산한의원',
		metaDescription: '추나 진료',
		metaKeywords: '한의원',
		schemaEntityTypes: ['MedicalClinic'],
	}) === 'medical',
);

assert('unknown profile falls back to general', getIndustryProfile('unknown').type === 'general');

const legalConfig = resolveIndustryConfig({
	lang: 'ko',
	brandName: '강남법무',
	location: '강남',
	services: ['이혼소송', '계약분쟁', '형사변호'],
	title: '강남법무법인',
	description: '이혼소송·계약분쟁 변호사 법률상담',
	keywords: '로펌, 수임',
});
assert('resolveIndustryConfig legal audience is 의뢰인', legalConfig.audienceName === '의뢰인');
assert('resolveIndustryConfig legal personJobTitle is 대표변호사', legalConfig.personJobTitle === '대표변호사');
assert('resolveIndustryConfig legal action is 상담/수임', legalConfig.actionName === '상담/수임');
assert('resolveIndustryConfig keeps top 3 services', legalConfig.services[0] === '이혼소송' && legalConfig.services[1] === '계약분쟁');

const medicalConfig = resolveIndustryConfig({
	lang: 'ko',
	legacyIndustry: 'MEDICAL',
	services: ['도수치료', '아동발달센터', '정형외과'],
});
assert('legacy MEDICAL maps to medical', medicalConfig.type === 'medical' && medicalConfig.audienceName === '환자');
assert('IndustryConfig exposes cpc', medicalConfig.cpc === 6_500, String(medicalConfig.cpc));
assert('legal CPC is 12,000', legalConfig.cpc === 12_000, String(legalConfig.cpc));
assert('toLegacy medical → MEDICAL', toLegacyAuditIndustry('medical') === 'MEDICAL');
assert('toLegacy professional → B2B_MFG', toLegacyAuditIndustry('professional') === 'B2B_MFG');
assert('toKeyword accounting → tax', toKeywordIndustry('accounting') === 'tax');
assert('toKeyword professional → b2b', toKeywordIndustry('professional') === 'b2b');
assert('toKeyword fitness → fitness', toKeywordIndustry('fitness') === 'fitness');
assert('toKeyword veterinary → veterinary', toKeywordIndustry('veterinary') === 'veterinary');
assert('toLegacy veterinary → MEDICAL', toLegacyAuditIndustry('veterinary') === 'MEDICAL');
assert('toLegacy restaurant → LOCAL_STORE', toLegacyAuditIndustry('restaurant') === 'LOCAL_STORE');

const fitnessConfig = resolveIndustryConfig({
	lang: 'ko',
	brandName: '강남필라테스',
	title: '강남 필라테스 스튜디오',
	description: '회원권과 체험 수업이 있는 피트니스',
	keywords: '필라테스, 헬스장',
});
assert('resolve fitness type', fitnessConfig.type === 'fitness');
assert('resolve fitness schema HealthClub', fitnessConfig.schemaType === 'HealthClub');
assert('resolve fitness mainService 필라테스', fitnessConfig.mainService === '필라테스');
assert('resolve fitness subService 헬스', fitnessConfig.subService === '헬스');
assert('resolve fitness personJobTitle 대표원장', fitnessConfig.personJobTitle === '대표원장');

const faqLd = toFaqPageJsonLd(UNIVERSAL_INDUSTRY_REGISTRY.legal.faqGenerator({ brandName: '강남법무', lang: 'ko' }), {
	url: 'https://law.example',
});
assert('FAQPage @type', faqLd['@type'] === 'FAQPage');
assert('FAQPage has mainEntity', Array.isArray(faqLd.mainEntity) && (faqLd.mainEntity as unknown[]).length === 5);

const classified = classifyIndustry({ title: '변호사 법률사무소', description: '수임 상담' });
assert('classify confidence > 0 for legal', classified.confidence > 0 && classified.type === 'legal');

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall universal industry registry assertions passed');
