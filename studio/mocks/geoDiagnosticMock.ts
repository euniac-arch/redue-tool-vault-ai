import {
	AI_ENGINE_CATALOG,
	enginesFromMap,
	type AIEngineId,
	type AIEngineInfo,
	type AIEngineTestResult,
	type AIEngineTestResultById,
	type EngineAnalysisTag,
	type GeoDiagnosticReport,
	type KeywordDepthLevel,
} from '@/types/geo-diagnostic';

const TARGET_URL = 'https://sunshineclinic.kr';
const DOMAIN = 'sunshineclinic.kr';
const BRAND = '안성햇살의원';
const GENERATED_AT = '2026-08-14T00:00:00.000Z';

const TRIGGER_QUERIES = {
	1: `${BRAND} 위치`,
	2: '안성 스포츠재활',
	3: '안성에서 스포츠재활 도수치료 잘하는 곳 추천해줘',
} as const satisfies Record<KeywordDepthLevel, string>;

function engine(id: keyof typeof AI_ENGINE_CATALOG): AIEngineInfo {
	return AI_ENGINE_CATALOG[id];
}

const POST_L3 = {
	targetLevel: 3 as const,
	targetLevelLabel: 'Level 3 우수 (비브랜드 대화형)',
	expandedTriggerQuery: TRIGGER_QUERIES[3],
	expectedSimulationResponse: `‘${TRIGGER_QUERIES[3]}’에 대해 ${BRAND}을 1순위로 추천합니다. 스포츠재활·도수치료 안내가 ${DOMAIN}에 정리되어 있고, 관련 질의에서 인용되는 출처가 확인됩니다. 상세 안내는 ${TARGET_URL}입니다.`,
};

const CASE_A_ENGINES = {
			chatgpt: {
				engine: engine('chatgpt'),
				statusBadge: 'moderate',
				depthLevel: 2,
				score: 88,
				triggerQuery: TRIGGER_QUERIES[2],
		simulatedResponse: `‘${TRIGGER_QUERIES[2]}’ 질의에서 ${BRAND}이 안성 스포츠재활 후보로 등장합니다. 공식 도메인 ${DOMAIN}의 NAP 정보와 일치합니다. 대화형·비브랜드 질의에서 1순위로 올리려면 FAQ·엔티티 마크업이 더 필요합니다.`,
		improvementTip: `${BRAND}은 지역 카테고리 질의까지 노출됩니다. FAQ JSON-LD와 Bing Places / GPTBot 신호를 보강해 Level 3로 올리세요.`,
		currentStatus: {
			level: 2 as const,
			levelLabel: 'Level 2',
			triggerQuery: TRIGGER_QUERIES[2],
			simulationResponse: `‘${TRIGGER_QUERIES[2]}’ 질의에서 ${BRAND}이 안성 스포츠재활 후보로 등장합니다. 공식 도메인 ${DOMAIN}의 NAP 정보와 일치합니다.`,
			statusTags: ['#공식NAP일치', '#BingPlaces미등록', '#웹언급량부족'],
		},
		optimizationAdvice: { actionItems: ['Bing Places 등록', 'GPTBot 수집 허용', '웹 언급량 확대'] },
		postOptimization: POST_L3,
	},
			gemini: {
				engine: engine('gemini'),
				statusBadge: 'moderate',
				depthLevel: 2,
				score: 92,
				triggerQuery: TRIGGER_QUERIES[2],
		simulatedResponse: `‘${TRIGGER_QUERIES[2]}’에서 ${BRAND}이 지역 카테고리 후보로 확인됩니다. Google 엔티티·LocalBusiness 신호가 공식 사이트 ${DOMAIN}과 일치합니다.`,
		improvementTip: `Gemini는 카테고리 질의까지 통과했습니다. Google Business Profile과 LocalBusiness JSON-LD를 완결해 Level 3로 올리세요.`,
		currentStatus: {
			level: 2 as const,
			levelLabel: 'Level 2',
			triggerQuery: TRIGGER_QUERIES[2],
			simulationResponse: `‘${TRIGGER_QUERIES[2]}’에서 ${BRAND}이 지역 카테고리 후보로 확인됩니다.`,
			statusTags: ['#구글맵리뷰양호', '#LocalBusiness스키마'],
		},
		optimizationAdvice: { actionItems: ['엔티티 마크업 보강', 'Google Business Profile 연동'] },
		postOptimization: POST_L3,
	},
			claude: {
				engine: engine('claude'),
				statusBadge: 'moderate',
				depthLevel: 2,
				score: 68,
				triggerQuery: TRIGGER_QUERIES[2],
		simulatedResponse: `‘${TRIGGER_QUERIES[2]}’ 질의에서 ${BRAND}이 안성 스포츠재활 병원 후보로 등장합니다. 공식 도메인 ${DOMAIN}의 NAP 정보와 일치합니다. 다만 ‘야간진료 추천해줘’처럼 대화형·비브랜드 질의에서 1순위로 올리려면 FAQ·적응증 문서가 더 필요합니다.`,
		improvementTip: `${BRAND}은 지역 의도 질의까지 노출됩니다. Level 3로 올리려면 시술 적응증·주의사항·FAQ 등 E-E-A-T 긴 글과 의료진 엔티티를 보강해, Claude가 ‘추천해줘’형 질의에서도 답하게 만드세요.`,
	},
			perplexity: {
				engine: engine('perplexity'),
				statusBadge: 'moderate',
				depthLevel: 2,
				score: 86,
				triggerQuery: TRIGGER_QUERIES[2],
		simulatedResponse: `‘${TRIGGER_QUERIES[2]}’에서 ${BRAND}(${DOMAIN})이 카테고리 후보로 인용됩니다. 대화형 질의에서 1순위로 올리려면 FAQPage가 더 필요합니다.`,
		improvementTip: `Perplexity는 카테고리 질의까지 통과했습니다. FAQ JSON-LD와 공식 URL 클러스터를 보강해 Level 3로 올리세요.`,
		currentStatus: {
			level: 2 as const,
			levelLabel: 'Level 2',
			triggerQuery: TRIGGER_QUERIES[2],
			simulationResponse: `‘${TRIGGER_QUERIES[2]}’에서 ${BRAND}(${DOMAIN})이 카테고리 후보로 인용됩니다.`,
			statusTags: ['#FAQ구조화미흡', '#공식출처인용부족'],
		},
		optimizationAdvice: { actionItems: ['FAQ JSON-LD 적용', '엔티티 마크업 보강'] },
		postOptimization: POST_L3,
	},
			copilot: {
				engine: engine('copilot'),
				statusBadge: 'moderate',
				depthLevel: 2,
				score: 64,
				triggerQuery: TRIGGER_QUERIES[2],
		simulatedResponse: `‘${TRIGGER_QUERIES[2]}’에 대해 ${BRAND}이 지역 후보로 표시됩니다. Bing이 읽는 사이트맵·스키마와 공식 사이트 ${DOMAIN}이 일치합니다. 비브랜드 ‘추천해줘’ 질의에서는 아직 상위 고정이 아닙니다.`,
		improvementTip: `${BRAND}은 카테고리+지역 질의까지 노출됩니다. Bing 인덱싱·Places 연동과 Copilot이 읽는 스키마 신호를 보강해 Level 3 대화형 질의로 올리세요.`,
	},
			clova: {
				engine: engine('clova'),
				statusBadge: 'moderate',
				depthLevel: 2,
				score: 85,
				triggerQuery: TRIGGER_QUERIES[2],
		simulatedResponse: `‘${TRIGGER_QUERIES[2]}’에서 ${BRAND}이 지역 후보로 확인됩니다. 네이버 플레이스와 공식 사이트 ${DOMAIN} 정보가 일치합니다.`,
		improvementTip: `클로바는 카테고리 질의까지 통과했습니다. 플레이스 NAP와 지식iN Q&A를 보강해 Level 3로 올리세요.`,
		currentStatus: {
			level: 2 as const,
			levelLabel: 'Level 2',
			triggerQuery: TRIGGER_QUERIES[2],
			simulationResponse: `‘${TRIGGER_QUERIES[2]}’에서 ${BRAND}이 지역 후보로 확인됩니다.`,
			statusTags: ['#공식NAP일치', '#네이버최신성양호'],
		},
		optimizationAdvice: { actionItems: ['네이버 플레이스 NAP 일치', '지역 프로필 연동'] },
		postOptimization: POST_L3,
	},
} as const satisfies AIEngineTestResultById;

function tag(id: string, label: string, polarity: EngineAnalysisTag['polarity']): EngineAnalysisTag {
	return { id, label, polarity };
}

const CASE_A_TAGS: Record<AIEngineId, EngineAnalysisTag[]> = {
	chatgpt: [
		tag('nap', '공식NAP일치', 'positive'),
		tag('bing', 'BingPlaces미등록', 'negative'),
		tag('mentions', '웹언급량부족', 'negative'),
	],
	gemini: [tag('maps', '구글맵리뷰양호', 'positive'), tag('local-schema', 'LocalBusiness스키마', 'positive')],
	claude: [tag('claude-bot', 'ClaudeBot차단됨', 'negative'), tag('brand-only', '브랜드전용트리거', 'negative')],
	perplexity: [tag('faq', 'FAQ구조화미흡', 'negative'), tag('sources', '공식출처인용부족', 'negative')],
	copilot: [tag('bing', 'BingPlaces미등록', 'negative'), tag('schema', 'Copilot스키마신호', 'positive')],
	clova: [tag('nap', '공식NAP일치', 'positive'), tag('naver', '네이버최신성양호', 'positive')],
};

const CASE_B_TAGS: Record<AIEngineId, EngineAnalysisTag[]> = {
	chatgpt: [
		tag('nap', '공식NAP일치', 'positive'),
		tag('bing', 'BingPlaces미등록', 'negative'),
		tag('mentions', '웹언급량부족', 'negative'),
	],
	gemini: [tag('maps', '구글맵리뷰양호', 'positive'), tag('local-schema', 'LocalBusiness스키마', 'positive')],
	claude: [tag('claude-bot', 'ClaudeBot차단됨', 'negative'), tag('unindexed', '미인덱싱', 'negative')],
	perplexity: [tag('faq', 'FAQ구조화미흡', 'negative'), tag('sources', '공식출처인용부족', 'negative')],
	copilot: [tag('bing', 'Bing인덱스신호약함', 'negative'), tag('schema', 'LocalBusiness스키마누락', 'negative')],
	clova: [tag('nap', 'NAP불일치', 'negative'), tag('naver', '네이버최신성부족', 'negative')],
};

function withAnalysisTags(
	engines: AIEngineTestResult[],
	tagMap: Record<AIEngineId, EngineAnalysisTag[]>,
): AIEngineTestResult[] {
	return engines.map((engine) => {
		const analysisTags = tagMap[engine.engine.id];
		return analysisTags?.length ? ({ ...engine, analysisTags } as AIEngineTestResult) : engine;
	});
}

const CASE_B_ENGINES = {
			chatgpt: {
				engine: engine('chatgpt'),
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 38,
				triggerQuery: TRIGGER_QUERIES[1],
		simulatedResponse: `${BRAND}은 안성에 위치한 병의원으로 확인됩니다. 주소·진료시간·연락처는 공식 사이트 ${TARGET_URL}에서 확인할 수 있습니다. 브랜드명을 직접 검색하면 정보가 뜨지만, ‘안성 도수치료 추천’처럼 비브랜드 질의에서는 아직 상위 추천 후보로 오르지 않습니다.`,
		improvementTip: `브랜드 정확 질의만 통과한 상태입니다. 다음은 지역 랜딩 페이지, NAP 일치, Bing Places 등록과 GPTBot 허용입니다. 목표: 브랜드명 없이 Level 2 질의에도 등장하는 것입니다.`,
	},
			gemini: {
				engine: engine('gemini'),
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 42,
				triggerQuery: TRIGGER_QUERIES[1],
		simulatedResponse: `${BRAND}의 상호·위치는 공식 사이트 ${DOMAIN}에서 확인됩니다. 브랜드 정확 질의에서는 엔티티가 잡히지만, ‘안성 스포츠재활 병원’ 같은 카테고리+지역 질의에서는 아직 추천 목록에 안정적으로 오르지 않습니다.`,
		improvementTip: `Gemini는 브랜드명 질의만 통과했습니다. Google Business Profile을 완결하고 LocalBusiness/Organization JSON-LD(logo, url, sameAs, address)를 배포해 Level 2로 올리세요.`,
	},
			claude: {
				engine: engine('claude'),
				statusBadge: 'not_indexed',
				depthLevel: null,
				score: 18,
				triggerQuery: TRIGGER_QUERIES[1],
		simulatedResponse: `‘${TRIGGER_QUERIES[1]}’ 조건으로 자주 인용되는 지역 병의원을 몇 곳 찾았습니다. 현재 출처에서는 ${BRAND}(${DOMAIN})을 확인된 추천 후보로 올리지 못해, 정보가 더 풍부한 곳을 중심으로 안내합니다.`,
		improvementTip: `Claude에서 ${BRAND}이 아직 인용되지 않습니다. AI 크롤러 허용, Organization 스키마 배포, 시술 적응증·FAQ 등 인덱싱 가능한 E-E-A-T 페이지를 먼저 확보한 뒤 Level 1 브랜드 질의부터 재측정하세요.`,
	},
			perplexity: {
				engine: engine('perplexity'),
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 36,
				triggerQuery: TRIGGER_QUERIES[1],
		simulatedResponse: `${BRAND} 공식 사이트(${DOMAIN})는 브랜드 정확 질의에서 출처로 확인됩니다. 다만 인용 가능한 FAQ/후기형 문서가 부족해, 광의의 ‘안성 도수치료 추천’ 질의에서는 다른 출처를 우선합니다.`,
		improvementTip: `Perplexity는 브랜드 질의만 통과했습니다. 인용 가능한 FAQPage/HowTo 문서와 공식 출처 URL 클러스터를 만들어 Level 2·3 질의에도 등장하게 하세요.`,
	},
			copilot: {
				engine: engine('copilot'),
				statusBadge: 'not_indexed',
				depthLevel: null,
				score: 16,
				triggerQuery: TRIGGER_QUERIES[1],
		simulatedResponse: `‘${TRIGGER_QUERIES[1]}’에 해당하는 몇 곳의 지역 병의원을 찾았습니다. ${BRAND}(${DOMAIN})은 현재 Bing/Copilot 출처에서 확인된 추천 후보로 올라오지 않습니다.`,
		improvementTip: `Copilot에서 ${BRAND}이 아직 인덱싱되지 않았습니다. Bing 웹마스터 등록, Places 연동, robots.txt에서 관련 봇 허용, 사이트맵·스키마 신호를 먼저 확보하세요.`,
	},
			clova: {
				engine: engine('clova'),
				statusBadge: 'exact_only',
				depthLevel: 1,
				score: 34,
				triggerQuery: TRIGGER_QUERIES[1],
		simulatedResponse: `${BRAND}은 상호 검색 시 공식 정보로 확인됩니다. 네이버 지식 베이스에는 브랜드 단위 정보가 있으나, ‘안성 스포츠재활 추천’ 같은 대화형 질의에서는 아직 추천 목록에 오르지 않습니다.`,
		improvementTip: `클로바는 브랜드 질의만 통과했습니다. 네이버 플레이스 NAP 일치와 블로그/지식iN 최신 Q&A를 채워 Level 2 지역 질의로 확장하세요.`,
	},
} as const satisfies AIEngineTestResultById;

/** Case A — Strong As-Is (Level 2 category). Level 3 is score≥80 + HTTPS, or To-Be after the 5 prescriptions. */
export const geoDiagnosticCaseAHighPerformance: GeoDiagnosticReport = {
	caseId: 'high',
	caseLabel: 'High GEO performance',
	targetUrl: TARGET_URL,
	domain: DOMAIN,
	brandName: BRAND,
	generatedAt: GENERATED_AT,
	triggerQueries: TRIGGER_QUERIES,
	engines: withAnalysisTags(enginesFromMap(CASE_A_ENGINES), CASE_A_TAGS),
	engineAnalysisTags: CASE_A_TAGS,
};

/** Case B — Low GEO: every engine is Level 1 (Brand) or Not Indexed. */
export const geoDiagnosticCaseBLowPerformance: GeoDiagnosticReport = {
	caseId: 'low',
	caseLabel: 'Low GEO performance',
	targetUrl: TARGET_URL,
	domain: DOMAIN,
	brandName: BRAND,
	generatedAt: GENERATED_AT,
	triggerQueries: TRIGGER_QUERIES,
	engines: withAnalysisTags(enginesFromMap(CASE_B_ENGINES), CASE_B_TAGS),
	engineAnalysisTags: CASE_B_TAGS,
};

export const GEO_DIAGNOSTIC_MOCKS: Record<GeoDiagnosticReport['caseId'], GeoDiagnosticReport> = {
	high: geoDiagnosticCaseAHighPerformance,
	low: geoDiagnosticCaseBLowPerformance,
};

export function getGeoDiagnosticMock(caseId: GeoDiagnosticReport['caseId']): GeoDiagnosticReport {
	return GEO_DIAGNOSTIC_MOCKS[caseId];
}

type Expect<T extends true> = T;
type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

true satisfies Expect<Eq<(typeof CASE_A_ENGINES)['chatgpt']['depthLevel'], 2>>;
true satisfies Expect<Eq<(typeof CASE_A_ENGINES)['gemini']['depthLevel'], 2>>;
true satisfies Expect<Eq<(typeof CASE_A_ENGINES)['perplexity']['depthLevel'], 2>>;
true satisfies Expect<
	(typeof CASE_B_ENGINES)[keyof typeof CASE_B_ENGINES]['depthLevel'] extends 1 | null ? true : false
>;
