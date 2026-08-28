/** Future diagnostic payload — UI reads a subset today; no API/DB yet. */
export type IndustryCopyLang = 'ko' | 'en';
export type LocalizedCopy = Record<IndustryCopyLang, string>;
export type IndustryVerticalId =
	| 'medical'
	| 'food'
	| 'legal'
	| 'hotel'
	| 'education'
	| 'beauty'
	| 'realestate'
	| 'automotive'
	| 'fitness'
	| 'ecommerce'
	| 'b2b'
	| 'tourism'
	| 'professional';

export type IndustryGroup = 'local-service' | 'professional' | 'commerce' | 'hospitality' | 'education';

export type ScoringWeight = {
	label: LocalizedCopy;
	stars: 1 | 2 | 3 | 4 | 5;
};

export type IndustryStrategyModel = {
	id: IndustryVerticalId;
	industry: string;
	industryGroup: IndustryGroup;
	label: LocalizedCopy;
	schemaTypes: string[];
	primaryEntities: LocalizedCopy[];
	secondaryEntities: LocalizedCopy[];
	localSignals: LocalizedCopy[];
	trustSignals: LocalizedCopy[];
	contentPatterns: LocalizedCopy[];
	queryPatterns: LocalizedCopy[];
	searchIntents: LocalizedCopy[];
	aeoQuestions: LocalizedCopy[];
	geoSignals: LocalizedCopy[];
	scoringWeights: ScoringWeight[];
	competitorSignals: LocalizedCopy[];
	recommendedActions: LocalizedCopy[];
};

export const INDUSTRY_ENGINE_STACK = ['SEO', 'GEO', 'AEO', 'ENTITY', 'CONTENT', 'TRUST', 'LOCAL'] as const;

export const INDUSTRY_PROFILE_CODES = [
	'MEDICAL',
	'FOOD',
	'LEGAL',
	'HOTEL',
	'REAL ESTATE',
	'EDUCATION',
	'BEAUTY',
	'AUTOMOTIVE',
	'FITNESS',
	'E-COMMERCE',
	'B2B',
	'TOURISM',
] as const;

export const PRODUCT_CONTRAST = [
	{ legacy: 'SEO Score', redue: 'Industry-specific Search Strategy' },
	{ legacy: 'Keyword', redue: 'Search Intent + Entity + Question' },
	{ legacy: 'Search Engine', redue: 'Naver + Google + AI Search' },
	{ legacy: 'Score', redue: 'Gap → Priority → Action' },
] as const;

/** Seed catalog — medical is fully shaped so later verticals can follow the same slots. */
export const INDUSTRY_STRATEGY_CATALOG: Partial<Record<IndustryVerticalId, IndustryStrategyModel>> = {
	medical: {
		id: 'medical',
		industry: 'medical',
		industryGroup: 'local-service',
		label: { ko: '의료', en: 'Medical' },
		schemaTypes: ['MedicalClinic', 'Physician', 'MedicalProcedure', 'FAQPage'],
		primaryEntities: [
			{ ko: '병원', en: 'Clinic' },
			{ ko: '의료진', en: 'Clinicians' },
			{ ko: '시술', en: 'Procedures' },
			{ ko: '질환', en: 'Conditions' },
		],
		secondaryEntities: [
			{ ko: '장비', en: 'Equipment' },
			{ ko: '지역', en: 'Region' },
		],
		localSignals: [
			{ ko: '대구', en: 'Daegu' },
			{ ko: '동구', en: 'Dong-gu' },
			{ ko: '동대구역', en: 'Dongdaegu Station' },
		],
		trustSignals: [
			{ ko: '전문성', en: 'Expertise' },
			{ ko: '의료진', en: 'Clinicians' },
			{ ko: '외부 평판', en: 'Reputation' },
		],
		contentPatterns: [{ ko: '질환 → 증상 → 치료 → 시술 → 병원', en: 'Condition → symptoms → treatment → procedure → clinic' }],
		queryPatterns: [
			{ ko: '대구 피부과', en: 'Daegu dermatology' },
			{ ko: '대구 동구 피부과', en: 'Dong-gu dermatology' },
		],
		searchIntents: [
			{ ko: '지역', en: 'Local' },
			{ ko: '서비스', en: 'Service' },
			{ ko: '문제 해결', en: 'Problem' },
			{ ko: '비교', en: 'Comparison' },
			{ ko: '추천', en: 'Recommendation' },
		],
		aeoQuestions: [
			{ ko: '대구에서 흉터 치료 잘하는 곳?', en: 'Where is scar treatment done well in Daegu?' },
			{ ko: '대구 덴서티 어디가 좋아?', en: 'Which clinic is good for Density in Daegu?' },
		],
		geoSignals: [
			{ ko: 'NAP 일치', en: 'NAP consistency' },
			{ ko: '업종 Entity', en: 'Industry entity' },
		],
		scoringWeights: [
			{ label: { ko: '전문성 / 신뢰도', en: 'Expertise / trust' }, stars: 5 },
			{ label: { ko: '의료진 / 기관 Entity', en: 'Clinician / org entity' }, stars: 5 },
			{ label: { ko: '질환 / 시술 콘텐츠', en: 'Condition / procedure content' }, stars: 5 },
			{ label: { ko: '지역성', en: 'Locality' }, stars: 4 },
			{ label: { ko: 'AEO', en: 'AEO' }, stars: 4 },
		],
		competitorSignals: [{ ko: '경쟁 의원과의 Entity · 질문 Gap', en: 'Entity and question gap vs nearby clinics' }],
		recommendedActions: [{ ko: '우선순위별 Playbook 실행', en: 'Execute the playbook by priority' }],
	},
};
