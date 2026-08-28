export type IndustryPageLang = 'ko' | 'en';

export type Localized = Record<IndustryPageLang, string>;

export function tx(lang: IndustryPageLang, value: Localized): string {
	return value[lang];
}

export const HERO_CHIPS = ['SEO', 'GEO', 'AEO', 'ENTITY', 'LOCAL', 'CONTENT', 'TRUST', 'AI SEARCH'] as const;

export const LOCAL_QUERY_EXAMPLES: Localized[] = [
	{ ko: '대구 피부과', en: 'Daegu dermatology' },
	{ ko: '대구 맛집', en: 'Daegu restaurants' },
	{ ko: '대구 변호사', en: 'Daegu lawyers' },
	{ ko: '대구 호텔', en: 'Daegu hotels' },
	{ ko: '대구 학원', en: 'Daegu academies' },
	{ ko: '대구 부동산', en: 'Daegu real estate' },
];

export const WHY_INDUSTRY_CARDS = [
	{
		code: 'MEDICAL',
		label: { ko: '의료', en: 'Medical' },
		signals: [
			{ ko: '전문성', en: 'Expertise' },
			{ ko: '의료진', en: 'Clinicians' },
			{ ko: '진료/시술', en: 'Care / procedures' },
			{ ko: '질환 콘텐츠', en: 'Condition content' },
			{ ko: '지역성', en: 'Locality' },
			{ ko: '신뢰도', en: 'Trust' },
			{ ko: 'Entity', en: 'Entity' },
			{ ko: 'AEO', en: 'AEO' },
		],
	},
	{
		code: 'FOOD',
		label: { ko: '음식', en: 'Food' },
		signals: [
			{ ko: '대표메뉴', en: 'Signature menu' },
			{ ko: '가격', en: 'Price' },
			{ ko: '위치', en: 'Location' },
			{ ko: '영업시간', en: 'Hours' },
			{ ko: '리뷰', en: 'Reviews' },
			{ ko: '사진', en: 'Photos' },
			{ ko: '주차', en: 'Parking' },
			{ ko: '예약', en: 'Reservations' },
		],
	},
	{
		code: 'LEGAL',
		label: { ko: '법률', en: 'Legal' },
		signals: [
			{ ko: '전문 분야', en: 'Practice area' },
			{ ko: '변호사', en: 'Attorneys' },
			{ ko: '지역', en: 'Region' },
			{ ko: '상담', en: 'Consultation' },
			{ ko: '사례', en: 'Case stories' },
			{ ko: '전문성', en: 'Expertise' },
			{ ko: '신뢰도', en: 'Trust' },
		],
	},
	{
		code: 'HOTEL',
		label: { ko: '호텔', en: 'Hotel' },
		signals: [
			{ ko: '객실', en: 'Rooms' },
			{ ko: '위치', en: 'Location' },
			{ ko: '가격', en: 'Price' },
			{ ko: '시설', en: 'Amenities' },
			{ ko: '조식', en: 'Breakfast' },
			{ ko: '접근성', en: 'Access' },
			{ ko: '리뷰', en: 'Reviews' },
			{ ko: '예약', en: 'Booking' },
		],
	},
	{
		code: 'EDUCATION',
		label: { ko: '교육', en: 'Education' },
		signals: [
			{ ko: '강사', en: 'Instructors' },
			{ ko: '과목', en: 'Subjects' },
			{ ko: '커리큘럼', en: 'Curriculum' },
			{ ko: '지역', en: 'Region' },
			{ ko: '수강료', en: 'Tuition' },
			{ ko: '성과', en: 'Outcomes' },
			{ ko: '후기', en: 'Reviews' },
		],
	},
] as const;

export { INDUSTRY_ENGINE_STACK as COMMON_ENGINE_LAYERS, INDUSTRY_PROFILE_CODES as ENGINE_INDUSTRIES } from './industry-strategy-model';

export const CORE_FRAMEWORK = [
	{ no: '01', title: { ko: 'Entity / 업체 정체성', en: 'Entity / business identity' } },
	{ no: '02', title: { ko: 'Local SEO', en: 'Local SEO' } },
	{ no: '03', title: { ko: 'Technical SEO', en: 'Technical SEO' } },
	{ no: '04', title: { ko: 'Content Quality', en: 'Content Quality' } },
	{ no: '05', title: { ko: 'AEO / Question Answer', en: 'AEO / Question Answer' } },
	{ no: '06', title: { ko: 'Schema / Structured Data', en: 'Schema / Structured Data' } },
	{ no: '07', title: { ko: 'External Reputation', en: 'External Reputation' } },
	{ no: '08', title: { ko: 'Review / User Signals', en: 'Review / User Signals' } },
	{ no: '09', title: { ko: 'AI Crawling / Indexing', en: 'AI Crawling / Indexing' } },
	{ no: '10', title: { ko: 'Freshness / Activity', en: 'Freshness / Activity' } },
] as const;

export const WEIGHT_PROFILES = [
	{
		code: 'MEDICAL',
		label: { ko: '의료', en: 'Medical' },
		rows: [
			{ label: { ko: '전문성 / 신뢰도', en: 'Expertise / trust' }, stars: 5 },
			{ label: { ko: '의료진 / 기관 Entity', en: 'Clinician / org entity' }, stars: 5 },
			{ label: { ko: '지역성', en: 'Locality' }, stars: 4 },
			{ label: { ko: '질환 / 시술 콘텐츠', en: 'Condition / procedure content' }, stars: 5 },
			{ label: { ko: 'AEO', en: 'AEO' }, stars: 4 },
			{ label: { ko: '외부 평판', en: 'External reputation' }, stars: 4 },
		],
	},
	{
		code: 'FOOD',
		label: { ko: '음식', en: 'Food' },
		rows: [
			{ label: { ko: '지역성', en: 'Locality' }, stars: 5 },
			{ label: { ko: '리뷰 / 평판', en: 'Reviews / reputation' }, stars: 5 },
			{ label: { ko: '메뉴 정보', en: 'Menu information' }, stars: 5 },
			{ label: { ko: '가격 정보', en: 'Pricing' }, stars: 4 },
			{ label: { ko: '사진 / 비주얼', en: 'Photos / visuals' }, stars: 4 },
			{ label: { ko: '예약 / 방문정보', en: 'Booking / visit info' }, stars: 4 },
		],
	},
	{
		code: 'LEGAL',
		label: { ko: '법률', en: 'Legal' },
		rows: [
			{ label: { ko: '전문 분야', en: 'Practice area' }, stars: 5 },
			{ label: { ko: '전문가 Entity', en: 'Expert entity' }, stars: 5 },
			{ label: { ko: '신뢰도', en: 'Trust' }, stars: 5 },
			{ label: { ko: '사례 콘텐츠', en: 'Case content' }, stars: 4 },
			{ label: { ko: '지역성', en: 'Locality' }, stars: 4 },
			{ label: { ko: 'AEO', en: 'AEO' }, stars: 4 },
		],
	},
] as const;

export const ENTITY_GRAPHS = [
	{
		code: 'MEDICAL',
		label: { ko: '의료', en: 'Medical' },
		nodes: [
			{ ko: '병원', en: 'Clinic' },
			{ ko: '의료진', en: 'Clinicians' },
			{ ko: '진료', en: 'Care' },
			{ ko: '시술', en: 'Procedures' },
			{ ko: '질환', en: 'Conditions' },
			{ ko: '장비', en: 'Equipment' },
			{ ko: '지역', en: 'Region' },
		],
	},
	{
		code: 'FOOD',
		label: { ko: '음식', en: 'Food' },
		nodes: [
			{ ko: '식당', en: 'Restaurant' },
			{ ko: '메뉴', en: 'Menu' },
			{ ko: '대표메뉴', en: 'Signature dishes' },
			{ ko: '가격', en: 'Price' },
			{ ko: '위치', en: 'Location' },
			{ ko: '리뷰', en: 'Reviews' },
			{ ko: '예약', en: 'Reservations' },
		],
	},
	{
		code: 'LEGAL',
		label: { ko: '법률', en: 'Legal' },
		nodes: [
			{ ko: '법률사무소', en: 'Law office' },
			{ ko: '변호사', en: 'Attorneys' },
			{ ko: '전문분야', en: 'Practice area' },
			{ ko: '사건 유형', en: 'Case types' },
			{ ko: '지역', en: 'Region' },
			{ ko: '상담', en: 'Consultation' },
		],
	},
	{
		code: 'HOTEL',
		label: { ko: '호텔', en: 'Hotel' },
		nodes: [
			{ ko: '호텔', en: 'Hotel' },
			{ ko: '객실', en: 'Rooms' },
			{ ko: '시설', en: 'Amenities' },
			{ ko: '위치', en: 'Location' },
			{ ko: '가격', en: 'Price' },
			{ ko: '예약', en: 'Booking' },
			{ ko: '리뷰', en: 'Reviews' },
		],
	},
] as const;

export const QUERY_INTENTS = [
	{ no: '01', type: { ko: '지역', en: 'Local' }, query: { ko: '대구 피부과', en: 'Daegu dermatology' } },
	{ no: '02', type: { ko: '지역 + 업종', en: 'Local + vertical' }, query: { ko: '대구 동구 피부과', en: 'Dong-gu Daegu dermatology' } },
	{ no: '03', type: { ko: '서비스', en: 'Service' }, query: { ko: '대구 덴서티', en: 'Daegu Density' } },
	{ no: '04', type: { ko: '문제 해결', en: 'Problem solving' }, query: { ko: '대구 여드름 흉터 치료', en: 'Daegu acne scar treatment' } },
	{ no: '05', type: { ko: '비교', en: 'Comparison' }, query: { ko: '대구 덴서티 잘하는 곳', en: 'Best Density in Daegu' } },
	{ no: '06', type: { ko: '추천', en: 'Recommendation' }, query: { ko: '대구 피부과 추천', en: 'Daegu dermatology recommendations' } },
	{ no: '07', type: { ko: '리스트', en: 'List' }, query: { ko: '대구 피부과 10곳', en: '10 dermatology clinics in Daegu' } },
	{ no: '08', type: { ko: '자연어', en: 'Natural language' }, query: { ko: '대구에서 흉터 치료 어디가 좋아?', en: 'Where is scar treatment good in Daegu?' } },
	{
		no: '09',
		type: { ko: 'AI 추천', en: 'AI recommendation' },
		query: { ko: '대구 동구에서 흉터 치료 잘하는 병원 추천해줘', en: 'Recommend a clinic in Dong-gu Daegu that is good at scar treatment' },
	},
] as const;

export const QUESTION_GRAPHS = [
	{
		code: 'MEDICAL',
		label: { ko: 'Medical', en: 'Medical' },
		nodes: [
			{ ko: '증상', en: 'Symptoms' },
			{ ko: '원인', en: 'Causes' },
			{ ko: '치료', en: 'Treatment' },
			{ ko: '시술', en: 'Procedure' },
			{ ko: '비용', en: 'Cost' },
			{ ko: '회복기간', en: 'Recovery' },
			{ ko: '주의사항', en: 'Precautions' },
			{ ko: '병원 선택', en: 'Clinic choice' },
		],
	},
	{
		code: 'FOOD',
		label: { ko: 'Food', en: 'Food' },
		nodes: [
			{ ko: '메뉴', en: 'Menu' },
			{ ko: '가격', en: 'Price' },
			{ ko: '맛', en: 'Taste' },
			{ ko: '분위기', en: 'Atmosphere' },
			{ ko: '주차', en: 'Parking' },
			{ ko: '예약', en: 'Reservation' },
			{ ko: '웨이팅', en: 'Wait time' },
			{ ko: '방문 목적', en: 'Visit purpose' },
		],
	},
	{
		code: 'LEGAL',
		label: { ko: 'Legal', en: 'Legal' },
		nodes: [
			{ ko: '문제', en: 'Problem' },
			{ ko: '대응', en: 'Response' },
			{ ko: '절차', en: 'Process' },
			{ ko: '비용', en: 'Cost' },
			{ ko: '기간', en: 'Timeline' },
			{ ko: '필요서류', en: 'Documents' },
			{ ko: '전문가 선택', en: 'Expert choice' },
		],
	},
] as const;

export const SEARCH_SURFACES = ['NAVER', 'GOOGLE', 'CHATGPT', 'GEMINI', 'PERPLEXITY'] as const;

export const ROADMAP_VERTICALS = [
	{ code: 'MEDICAL', items: { ko: '피부과 · 성형외과 · 치과 · 한의원 · 병원', en: 'Dermatology · plastic surgery · dental · Korean medicine · hospitals' } },
	{ code: 'FOOD', items: { ko: '식당 · 카페 · 베이커리', en: 'Restaurants · cafes · bakeries' } },
	{ code: 'BEAUTY', items: { ko: '미용실 · 네일 · 피부관리', en: 'Salons · nails · skincare' } },
	{ code: 'PROFESSIONAL', items: { ko: '변호사 · 세무사 · 노무사', en: 'Lawyers · CPAs · labor attorneys' } },
	{ code: 'REAL ESTATE', items: { ko: '부동산 · 중개업소 · 분양', en: 'Brokerage · agencies · sales' } },
	{ code: 'HOTEL', items: { ko: '호텔 · 펜션 · 숙박', en: 'Hotels · pensions · stays' } },
	{ code: 'EDUCATION', items: { ko: '학원 · 교육기관 · 과외', en: 'Academies · schools · tutoring' } },
	{ code: 'AUTOMOTIVE', items: { ko: '정비 · 세차 · 썬팅', en: 'Repair · wash · tinting' } },
	{ code: 'FITNESS', items: { ko: '헬스 · PT · 필라테스', en: 'Gym · PT · Pilates' } },
	{ code: 'E-COMMERCE', items: { ko: '쇼핑몰 · 브랜드 · 상품', en: 'Stores · brands · products' } },
	{ code: 'B2B', items: { ko: 'IT · 제조 · 마케팅 · 웹에이전시', en: 'IT · manufacturing · marketing · agencies' } },
	{ code: 'TOURISM', items: { ko: '여행 · 관광 · 체험', en: 'Travel · tourism · experiences' } },
] as const;

export const MEDICAL_REGIONS = [
	{ ko: '대구', en: 'Daegu' },
	{ ko: '동구', en: 'Dong-gu' },
	{ ko: '동대구역', en: 'Dongdaegu Station' },
] as const;

export const MEDICAL_SERVICES = [
	{ ko: '덴서티', en: 'Density' },
	{ ko: '울트라클리어', en: 'UltraClear' },
	{ ko: '흉터', en: 'Scars' },
	{ ko: '리프팅', en: 'Lifting' },
	{ ko: '보톡스', en: 'Botox' },
	{ ko: '필러', en: 'Filler' },
] as const;

export const MEDICAL_ENTITIES = [
	{ ko: '병원', en: 'Clinic' },
	{ ko: '의료진', en: 'Clinicians' },
	{ ko: '시술', en: 'Procedures' },
	{ ko: '질환', en: 'Conditions' },
	{ ko: '장비', en: 'Equipment' },
	{ ko: '지역', en: 'Region' },
] as const;

export const MEDICAL_AEO_QUESTIONS = [
	{ ko: '대구에서 흉터 치료 잘하는 곳?', en: 'Where is scar treatment done well in Daegu?' },
	{ ko: '대구 덴서티 어디가 좋아?', en: 'Which clinic is good for Density in Daegu?' },
	{ ko: '대구 동구 피부과 추천', en: 'Recommend a dermatology clinic in Dong-gu, Daegu' },
] as const;

export const MEDICAL_FORMULA = [
	{ ko: '지역', en: 'Region' },
	{ ko: '서비스', en: 'Service' },
	{ ko: '문제', en: 'Problem' },
	{ ko: '질문', en: 'Question' },
	{ ko: 'Entity', en: 'Entity' },
	{ ko: '신뢰도', en: 'Trust' },
] as const;

export const PLAYBOOK_STEPS = [
	{ no: '01', code: 'ENTITY', body: { ko: '병원 / 의료진 / 시술 / 질환', en: 'Clinic / clinicians / procedures / conditions' } },
	{ no: '02', code: 'LOCAL', body: { ko: '대구 / 동구 / 동대구역 / 주변 지역', en: 'Daegu / Dong-gu / Dongdaegu Station / nearby areas' } },
	{ no: '03', code: 'SERVICE', body: { ko: '덴서티 / 울트라클리어 / 흉터 / 리프팅', en: 'Density / UltraClear / scars / lifting' } },
	{ no: '04', code: 'QUESTION', body: { ko: '사용자가 실제로 묻는 질문', en: 'Questions people actually ask' } },
	{ no: '05', code: 'TRUST', body: { ko: '전문성 / 의료진 / 콘텐츠 / 외부 평판', en: 'Expertise / clinicians / content / reputation' } },
	{ no: '06', code: 'CONTENT', body: { ko: '질환 → 증상 → 치료 → 시술 → 병원', en: 'Condition → symptoms → treatment → procedure → clinic' } },
	{ no: '07', code: 'AEO', body: { ko: '질문형 콘텐츠 구조', en: 'Question-shaped content structure' } },
	{ no: '08', code: 'GEO', body: { ko: 'AI가 업체를 이해할 수 있는 Entity 관계', en: 'Entity relations AI can understand' } },
	{ no: '09', code: 'COMPETITOR', body: { ko: '경쟁업체와의 Gap', en: 'Gap versus competitors' } },
	{ no: '10', code: 'ACTION', body: { ko: '우선순위별 실행 항목', en: 'Prioritized action items' } },
] as const;

export const FUTURE_PIPELINE = [
	{ ko: 'AUDIT', en: 'AUDIT' },
	{ ko: 'INDUSTRY GAP', en: 'INDUSTRY GAP' },
	{ ko: 'PRIORITY', en: 'PRIORITY' },
	{ ko: 'PLAYBOOK', en: 'PLAYBOOK' },
	{ ko: 'ACTION', en: 'ACTION' },
] as const;

export const GEO_ENTITY_PATH = [
	'REDUE',
	'SEO',
	'GEO',
	'AEO',
	'Industry Strategy',
	'Industry Profile',
	'Entity',
	'Search Intent',
	'Local',
	'Trust',
	'Content',
] as const;

export const INDUSTRY_FAQS = [
	{
		id: 'why-industry',
		q: { ko: '왜 업종별 전략이 필요한가?', en: 'Why does industry strategy matter?' },
		a: {
			ko: '병원, 음식점, 법률, 호텔, 학원, 부동산은 같은 지역을 검색해도 중요한 신호가 다릅니다. 하나의 SEO 공식으로 모든 업종을 최적화할 수 없기 때문에, 공통 엔진 위에 업종별 전략 프로파일이 필요합니다.',
			en: 'Clinics, restaurants, law firms, hotels, academies, and real estate share local search — but not the same signals. One SEO formula cannot optimize every industry, so a shared engine still needs an industry profile.',
		},
	},
	{
		id: 'seo-diff',
		q: { ko: '업종별 SEO는 어떻게 다른가?', en: 'How does SEO differ by industry?' },
		a: {
			ko: '의료는 전문성·의료진 Entity·질환 콘텐츠 비중이 크고, 음식은 지역성·리뷰·메뉴 정보가, 법률은 전문 분야와 신뢰도가 더 크게 작동합니다. 같은 100점이라도 업종마다 중요도가 다릅니다.',
			en: 'Medical SEO weights expertise, clinician entities, and condition content. Food weights locality, reviews, and menus. Legal weights practice area and trust. The same 100 points do not mean the same thing.',
		},
	},
	{
		id: 'what-geo',
		q: { ko: 'GEO란 무엇인가?', en: 'What is GEO?' },
		a: {
			ko: 'GEO(Generative Engine Optimization)는 생성형 AI가 브랜드를 업종·지역·서비스 Entity로 이해하고 답변의 출처로 인용할 수 있도록 사이트 구조를 맞추는 작업입니다. 특정 AI에서 순위를 보장하는 기법이 아닙니다.',
			en: 'GEO (Generative Engine Optimization) structures a site so generative AI can understand the brand as industry, place, and service entities — and cite it as a source. It is not a guaranteed-rank tactic on any AI.',
		},
	},
	{
		id: 'what-aeo',
		q: { ko: 'AEO란 무엇인가?', en: 'What is AEO?' },
		a: {
			ko: 'AEO(Answer Engine Optimization)는 사용자가 실제로 묻는 질문 형태로 콘텐츠와 구조화 데이터를 맞춰, 답변 엔진이 발췌·인용하기 쉽게 만드는 전략입니다.',
			en: 'AEO (Answer Engine Optimization) shapes content and structured data around questions people actually ask, so answer engines can extract and cite them.',
		},
	},
	{
		id: 'why-entity',
		q: { ko: 'Entity가 왜 중요한가?', en: 'Why do entities matter?' },
		a: {
			ko: 'AI는 문장만이 아니라 병원 → 의료진 → 시술 → 질환 → 지역 같은 관계로 업체를 이해합니다. Entity가 흐리면 업종과 브랜드가 식별되지 않습니다.',
			en: 'AI understands a business through relations — clinic → clinicians → procedures → conditions → region — not isolated sentences. Vague entities make the brand hard to identify.',
		},
	},
	{
		id: 'what-intent',
		q: { ko: '검색의도란 무엇인가?', en: 'What is search intent?' },
		a: {
			ko: '검색의도는 지역, 서비스, 문제 해결, 비교, 추천, 리스트, 자연어, AI 추천처럼 같은 업종을 다른 방식으로 찾는 질의 패턴입니다. 업종 분류에서 끝나지 않고 어떻게 검색되는지를 함께 봅니다.',
			en: 'Search intent is how people look for the same industry — local, service, problem, comparison, recommendation, lists, natural language, or AI prompts. Classification is only the start.',
		},
	},
	{
		id: 'what-profile',
		q: { ko: '업종별 전략 프로파일이 무엇인가?', en: 'What is an industry strategy profile?' },
		a: {
			ko: '공통 SEO · GEO · AEO 엔진 위에 업종별 Entity, 콘텐츠, 지역성, 신뢰도, 질문 패턴을 결합한 설계 모델입니다. REDUE가 구축하고 있는 업종별 전략의 기준 골격입니다.',
			en: 'It is the design model that layers industry entities, content, locality, trust, and question patterns on the shared SEO · GEO · AEO engine — the skeleton REDUE is building for each vertical.',
		},
	},
] as const;

export const RELATED_MODULES = [
	{ href: '/audit', key: 'audit' as const, label: { ko: '진단 엔진', en: 'Audit engine' }, hint: { ko: '공통 SEO · GEO · AEO 진단', en: 'Shared SEO · GEO · AEO audit' } },
	{ href: '/aeo-geo', key: 'aeoGeo' as const, label: { ko: 'AEO · GEO', en: 'AEO · GEO' }, hint: { ko: '답변 엔진·생성형 검색 구조', en: 'Answer and generative engine structure' } },
	{ href: '/insights', key: 'insights' as const, label: { ko: '인사이트', en: 'Insights' }, hint: { ko: 'AI · GEO · Schema 리서치', en: 'AI · GEO · Schema research' } },
	{ href: '/portfolio', key: 'portfolio' as const, label: { ko: '포트폴리오', en: 'Portfolio' }, hint: { ko: '업종별 적용 사례', en: 'Industry application cases' } },
	{ href: '/contact', key: 'contact' as const, label: { ko: '작업 문의', en: 'Work inquiry' }, hint: { ko: '업종 전략 실행 상담', en: 'Industry strategy execution' } },
] as const;

export const PAGE_COPY = {
	metaTitle: {
		ko: '업종별 플레이북 | REDUE AI SEO GEO STUDIO',
		en: 'Industry Playbook | REDUE AI SEO GEO STUDIO',
	},
	metaDescription: {
		ko: '병원, 음식점, 법률, 호텔, 부동산, 교육 등 업종별 검색 특성과 Entity, SEO, GEO, AEO 전략을 분석하고 업종별 최적화 방향을 설계합니다.',
		en: 'We analyze industry search traits, entities, and SEO · GEO · AEO strategy for clinics, restaurants, legal, hotels, real estate, and education — then design the optimization direction.',
	},
	breadcrumbHome: { ko: 'REDUE', en: 'REDUE' },
	breadcrumbCurrent: { ko: '업종별 플레이북', en: 'Industry Playbook' },
	geoPathKicker: { ko: 'GEO ENTITY PATH', en: 'GEO ENTITY PATH' },
	geoPathTitle: { ko: 'REDUE 전략은 Entity 관계로 연결됩니다.', en: 'REDUE strategy is connected as an entity graph.' },
	faqKicker: { ko: 'AEO ANSWERS', en: 'AEO ANSWERS' },
	faqTitle: { ko: '업종별 플레이북에 대한 핵심 질문', en: 'Core questions on the industry playbook' },
	relatedKicker: { ko: 'RELATED MODULES', en: 'RELATED MODULES' },
	relatedTitle: { ko: '이 전략은 REDUE의 다른 엔진과 이어집니다.', en: 'This strategy connects to the rest of the REDUE engine.' },
	heroKicker: { ko: 'INDUSTRY SEO · GEO · AEO', en: 'INDUSTRY SEO · GEO · AEO' },
	heroH1Line1: { ko: '업종이 다르면', en: 'If the industry is different,' },
	heroH1Line2: { ko: '검색 전략도 달라야 합니다.', en: 'the search strategy must be too.' },
	heroEmphasis: {
		ko: '하나의 SEO 공식으로 모든 업종을 최적화할 수 없습니다.',
		en: 'One SEO formula cannot optimize every industry.',
	},
	heroBody1: {
		ko: '병원, 음식점, 호텔, 변호사, 학원, 부동산은 고객이 검색하는 방식도, AI가 업체를 이해하는 방식도 다릅니다.',
		en: 'Clinics, restaurants, hotels, law firms, academies, and real estate are searched differently — and AI understands them differently.',
	},
	contrastLegacy: { ko: '기존 SEO 도구', en: 'Typical SEO tool' },
	contrastRedue: { ko: 'REDUE', en: 'REDUE' },
	contrastNote: {
		ko: '점수를 재는 서비스가 아니라, 업종별 검색시장 경쟁력을 설계합니다.',
		en: 'Not a score widget — an industry search-strategy system.',
	},
	whyKicker: { ko: 'WHY INDUSTRY STRATEGY', en: 'WHY INDUSTRY STRATEGY' },
	whyTitle: { ko: '같은 지역이라도 검색되는 방식은 다릅니다.', en: 'Even in the same city, search works differently.' },
	whySubtitle: {
		ko: '이들은 모두 지역 검색이지만, 업종마다 중요한 검색 신호가 다릅니다.',
		en: 'These are all local searches — but the signals that matter change by industry.',
	},
	engineKicker: { ko: 'COMMON ENGINE + PROFILE', en: 'COMMON ENGINE + PROFILE' },
	engineTitle: { ko: '공통 엔진 위에 업종별 전략을 입힙니다.', en: 'A shared engine, with an industry strategy on top.' },
	engineFormula: { ko: '공통 엔진 + 업종별 전략 프로파일', en: 'Shared engine + industry strategy profile' },
	engineCommon: { ko: 'COMMON ENGINE', en: 'COMMON ENGINE' },
	engineProfile: { ko: 'INDUSTRY PROFILE', en: 'INDUSTRY PROFILE' },
	engineResult: { ko: 'INDUSTRY PLAYBOOK', en: 'INDUSTRY PLAYBOOK' },
	frameworkKicker: { ko: 'CORE SCORE FRAMEWORK', en: 'CORE SCORE FRAMEWORK' },
	frameworkTitle: { ko: '모든 업종을 동일한 기준으로 먼저 진단합니다.', en: 'Every industry is diagnosed against the same framework first.' },
	frameworkNote: {
		ko: '아래는 실제 점수가 아니라, REDUE가 업종 전략을 설계할 때 사용하는 개념적 진단 프레임워크입니다.',
		en: 'This is a conceptual diagnostic framework — not a live score calculation.',
	},
	weightsKicker: { ko: 'INDUSTRY WEIGHTS', en: 'INDUSTRY WEIGHTS' },
	weightsTitle: { ko: '같은 100점이라도 업종마다 중요도가 다릅니다.', en: 'The same 100 points do not mean the same thing in every industry.' },
	entityKicker: { ko: 'ENTITY GRAPH', en: 'ENTITY GRAPH' },
	entityTitle: { ko: 'AI가 업체를 이해하려면 Entity가 명확해야 합니다.', en: 'AI can only understand a business when its entities are clear.' },
	intentKicker: { ko: 'SEARCH INTENT', en: 'SEARCH INTENT' },
	intentTitle: { ko: '업종을 분석하는 것에서 끝나지 않습니다.', en: 'Industry classification is only the start.' },
	intentTitle2: { ko: '어떻게 검색되는지도 분석합니다.', en: 'We also analyze how people actually search.' },
	intentLabel: { ko: 'Query Intent', en: 'Query Intent' },
	questionKicker: { ko: 'AEO QUESTION GRAPH', en: 'AEO QUESTION GRAPH' },
	questionTitle: { ko: "AI 검색은 '키워드'보다 '질문'으로 확장됩니다.", en: 'AI search expands through questions, not just keywords.' },
	surfaceKicker: { ko: 'SEARCH SURFACE', en: 'SEARCH SURFACE' },
	surfaceTitle: { ko: '하나의 검색시장만 보는 시대는 끝났습니다.', en: 'Watching a single search market is no longer enough.' },
	surfaceNote: {
		ko: '특정 검색엔진이나 생성형 AI에서 특정 업체의 상위 노출·인용을 보장하지 않습니다. 플랫폼별 인덱싱 주기와 알고리즘에 따라 결과는 달라질 수 있습니다.',
		en: 'We do not guarantee top placement or citation on any search engine or generative AI. Results vary by each platform’s indexing cycle and algorithms.',
	},
	roadmapKicker: { ko: 'INDUSTRY ROADMAP', en: 'INDUSTRY ROADMAP' },
	roadmapTitle: { ko: '하나의 엔진으로 다양한 업종을 확장합니다.', en: 'One engine, extended across many industries.' },
	exampleKicker: { ko: 'EXAMPLE — MEDICAL / DERMATOLOGY', en: 'EXAMPLE — MEDICAL / DERMATOLOGY' },
	exampleTitle: { ko: '대표적인 전략 설계 예시', en: 'A representative strategy-design example' },
	exampleNote: {
		ko: '특정 병원이나 시술 키워드의 순위를 주장하는 사례가 아닙니다. 업종 전략이 어떻게 조립되는지를 보여 주는 설계 예시입니다.',
		en: 'This is a design example of how a vertical strategy is assembled — not a ranking claim for any clinic or procedure keyword.',
	},
	exampleRegion: { ko: '지역', en: 'Region' },
	exampleService: { ko: '서비스', en: 'Service' },
	exampleEntity: { ko: 'Entity', en: 'Entity' },
	exampleAeo: { ko: 'AEO', en: 'AEO' },
	exampleResult: { ko: 'Medical GEO Strategy', en: 'Medical GEO Strategy' },
	playbookKicker: { ko: 'INDUSTRY PLAYBOOK', en: 'INDUSTRY PLAYBOOK' },
	playbookTitle: { ko: '최종적으로는 업종별 GEO Playbook으로 연결됩니다.', en: 'The end state is an industry GEO playbook.' },
	playbookBadge: { ko: 'MEDICAL / DERMATOLOGY', en: 'MEDICAL / DERMATOLOGY' },
	playbookName: { ko: '대구 피부과 GEO PLAYBOOK', en: 'DAEGU DERMATOLOGY GEO PLAYBOOK' },
	playbookContext: {
		ko: 'REDUE가 구축하고 있는 업종별 전략 모델의 예시입니다.',
		en: 'An example of the industry strategy model REDUE is building.',
	},
	futureKicker: { ko: 'WHAT COMES NEXT', en: 'WHAT COMES NEXT' },
	futureTitle: { ko: 'SEO 점수를 측정하는 것을 넘어', en: 'Beyond measuring an SEO score,' },
	futureTitle2: { ko: '검색시장에서의 경쟁력을 설계합니다.', en: 'we design competitiveness in the search market.' },
	futureEmphasis: { ko: '"몇 점인가?"에서 끝나지 않습니다.', en: 'It does not end with “what is the score?”' },
	ctaKicker: { ko: 'START WITH YOUR VERTICAL', en: 'START WITH YOUR VERTICAL' },
	ctaTitle: { ko: '우리 업종에서는', en: 'In our industry,' },
	ctaTitle2: { ko: '무엇부터 바꿔야 할까요?', en: 'what should change first?' },
	ctaAudit: { ko: '진단 엔진 시작', en: 'Start the audit engine' },
	ctaContact: { ko: '작업 문의', en: 'Work inquiry' },
	startDiagnose: { ko: '진단 시작', en: 'Start audit' },
	disclaimer: {
		ko: '※ ChatGPT, Gemini, Perplexity, Claude, Copilot, Naver Cue: 등은 해당 기업의 등록 상표입니다. AI 검색·답변 엔진의 인용 방식과 추천 결과는 각 플랫폼의 인덱싱 주기 및 알고리즘에 따라 달라질 수 있으며, 특정 순위나 추천을 보증하지 않습니다.',
		en: '※ ChatGPT, Gemini, Perplexity, Claude, Copilot, and Naver Cue: are trademarks of their respective owners. Citation and recommendation behavior varies by each platform’s indexing cycle and algorithms. No specific rank or recommendation is guaranteed.',
	},
} as const;
