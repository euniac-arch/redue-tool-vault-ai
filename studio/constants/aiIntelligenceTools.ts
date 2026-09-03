import type { AsiIaEntryId, AsiPillarId, AsiToolId } from '@/lib/ai-search-intelligence/routes';
import { resolveAsiPathname } from '@/lib/ai-search-intelligence/routes';

export type IntelligenceCategoryKey = 'DISCOVER' | 'MEASURE' | 'EXPLAIN' | 'COMPETE' | 'ACT' | 'MONITOR';

export interface IntelligenceTool {
	id: string;
	categoryKey: IntelligenceCategoryKey;
	categoryKo: string;
	categoryEn: string;
	titleKo: string;
	titleEn: string;
	subDescription: string;
	statusText: string;
	/** Existing IA card / context key so routing stays 1:1 with ASI_PILLARS. */
	entryId: AsiIaEntryId;
	toolId: AsiToolId;
}

export interface IntelligenceCategory {
	categoryKey: IntelligenceCategoryKey;
	categoryKo: string;
	categoryEn: string;
	pillarId: AsiPillarId;
}

export const AI_INTELLIGENCE_CATEGORIES: readonly IntelligenceCategory[] = [
	{ categoryKey: 'DISCOVER', categoryKo: '발견', categoryEn: 'DISCOVER', pillarId: 'discover' },
	{ categoryKey: 'MEASURE', categoryKo: '측정', categoryEn: 'MEASURE', pillarId: 'measure' },
	{ categoryKey: 'EXPLAIN', categoryKo: '원인 분석', categoryEn: 'EXPLAIN', pillarId: 'explain' },
	{ categoryKey: 'COMPETE', categoryKo: '경쟁 분석', categoryEn: 'COMPETE', pillarId: 'compete' },
	{ categoryKey: 'ACT', categoryKo: '실행 개선', categoryEn: 'ACT', pillarId: 'act' },
	{ categoryKey: 'MONITOR', categoryKo: '지속 모니터링', categoryEn: 'MONITOR', pillarId: 'monitor' },
];

export const AI_INTELLIGENCE_PRODUCT = {
	titleKo: 'AI 검색 인텔리전스',
	titleEn: 'AI SEARCH INTELLIGENCE',
} as const;

export const AI_INTELLIGENCE_TOOLS: IntelligenceTool[] = [
	{
		id: 'query-intelligence',
		categoryKey: 'DISCOVER',
		categoryKo: '발견',
		categoryEn: 'DISCOVER',
		titleKo: 'AI 질문 인텔리전스',
		titleEn: 'AI Query Intelligence',
		subDescription: '업종·타깃별 AI 검색 유입 질문을 생성하고 실제 답변 가능성을 탐색합니다.',
		statusText: '측정 전',
		entryId: 'questions',
		toolId: 'questions',
	},
	{
		id: 'opportunity-finder',
		categoryKey: 'DISCOVER',
		categoryKo: '발견',
		categoryEn: 'DISCOVER',
		titleKo: 'AI 기회 발굴기',
		titleEn: 'AI Opportunity Finder',
		subDescription: '경쟁이 적고 선점 가능한 생성형 AI 검색 질문 키워드를 발굴합니다.',
		statusText: '측정 전',
		entryId: 'opportunity',
		toolId: 'opportunity',
	},
	{
		id: 'search-simulator',
		categoryKey: 'DISCOVER',
		categoryKo: '발견',
		categoryEn: 'DISCOVER',
		titleKo: 'AI 검색 시뮬레이터',
		titleEn: 'AI Search Simulator',
		subDescription: '주요 LLM(ChatGPT, Perplexity 등) 환경에서 실제 검색 질의를 가상 시뮬레이션합니다.',
		statusText: '측정 전',
		entryId: 'simulator',
		toolId: 'simulator',
	},
	{
		id: 'visibility',
		categoryKey: 'MEASURE',
		categoryKo: '측정',
		categoryEn: 'MEASURE',
		titleKo: 'AI 브랜드 노출도',
		titleEn: 'AI Visibility Index',
		subDescription: 'AI 검색 결과 답변 내 브랜드가 인용·노출되는 총 빈도 점수를 산출합니다.',
		statusText: '측정 전',
		entryId: 'visibility',
		toolId: 'visibility',
	},
	{
		id: 'brand-perception',
		categoryKey: 'MEASURE',
		categoryKo: '측정',
		categoryEn: 'MEASURE',
		titleKo: 'AI 브랜드 인식 분석',
		titleEn: 'AI Brand Perception',
		subDescription: 'AI가 브랜드를 설명할 때 사용하는 어조, 감성 및 긍·부정 뉘앙스를 정량화합니다.',
		statusText: '측정 전',
		entryId: 'brand',
		toolId: 'brand',
	},
	{
		id: 'share-of-voice',
		categoryKey: 'MEASURE',
		categoryKo: '측정',
		categoryEn: 'MEASURE',
		titleKo: 'AI 점유율 분석',
		titleEn: 'AI Share of Voice',
		subDescription: '동일 카테고리 질의군에서 타 경쟁사 대비 우리 브랜드의 AI 언급 비중을 측정합니다.',
		statusText: '측정 전',
		entryId: 'sov',
		toolId: 'sov',
	},
	{
		id: 'recommendation-intelligence',
		categoryKey: 'MEASURE',
		categoryKo: '측정',
		categoryEn: 'MEASURE',
		titleKo: 'AI 추천 지수',
		titleEn: 'Recommendation Intelligence',
		subDescription: '사용자가 대안 솔루션을 요청할 때 AI가 우리 브랜드를 1순위로 추천하는 빈도를 분석합니다.',
		statusText: '측정 전',
		entryId: 'test',
		toolId: 'test',
	},
	{
		id: 'evidence-explorer',
		categoryKey: 'EXPLAIN',
		categoryKo: '원인 분석',
		categoryEn: 'EXPLAIN',
		titleKo: 'AI 인용 근거 탐색기',
		titleEn: 'AI Evidence Explorer',
		subDescription: 'AI가 브랜드 답변을 생성할 때 참고한 실시간 웹 링크와 데이터 조각을 추적합니다.',
		statusText: '측정 전',
		entryId: 'explorer',
		toolId: 'explorer',
	},
	{
		id: 'citation-intelligence',
		categoryKey: 'EXPLAIN',
		categoryKo: '원인 분석',
		categoryEn: 'EXPLAIN',
		titleKo: '출처 인용 인텔리전스',
		titleEn: 'Citation Intelligence',
		subDescription: 'AI 검색 엔진이 가장 신뢰하고 자주 인용하는 고권위 소스 도메인을 판별합니다.',
		statusText: '측정 전',
		entryId: 'citations',
		toolId: 'citations',
	},
	{
		id: 'reputation-radar',
		categoryKey: 'EXPLAIN',
		categoryKo: '원인 분석',
		categoryEn: 'EXPLAIN',
		titleKo: 'AI 평판 레이더',
		titleEn: 'AI Reputation Radar',
		subDescription: '할루시네이션(환각)이나 왜곡된 브랜드 정보가 AI 답변에 포함되어 있는지 탐지합니다.',
		statusText: '측정 전',
		entryId: 'reputation',
		toolId: 'reputation',
	},
	{
		id: 'competitor-intelligence',
		categoryKey: 'COMPETE',
		categoryKo: '경쟁 분석',
		categoryEn: 'COMPETE',
		titleKo: '경쟁사 AI 인텔리전스',
		titleEn: 'Competitor Intelligence',
		subDescription: '주요 라이벌 브랜드가 AI 검색에서 인용되는 강점과 인용 경로를 역추적합니다.',
		statusText: '측정 전',
		entryId: 'competitors',
		toolId: 'competitors',
	},
	{
		id: 'competitor-gap-engine',
		categoryKey: 'COMPETE',
		categoryKo: '경쟁 분석',
		categoryEn: 'COMPETE',
		titleKo: '경쟁 격차 분석기',
		titleEn: 'Competitor Gap Engine',
		subDescription: '경쟁사는 AI에 잘 노출되지만 우리 브랜드는 누락된 콘텐츠 격차를 도출합니다.',
		statusText: '측정 전',
		entryId: 'gap',
		toolId: 'gap',
	},
	{
		id: 'next-best-action',
		categoryKey: 'ACT',
		categoryKo: '실행 개선',
		categoryEn: 'ACT',
		titleKo: '최적 개선 과제',
		titleEn: 'Next Best Action',
		subDescription: 'AI 노출 점수를 가장 빠르게 상승시킬 수 있는 1순위 수정 권고사항을 제시합니다.',
		statusText: '측정 전',
		entryId: 'action',
		toolId: 'action',
	},
	{
		id: 'agent-readiness',
		categoryKey: 'ACT',
		categoryKo: '실행 개선',
		categoryEn: 'ACT',
		titleKo: 'AI 에이전트 준비도',
		titleEn: 'AI Agent Readiness',
		subDescription: '사이트의 스키마 마크업, llms.txt, API 구조가 자율 AI 에이전트에 최적화되었는지 진단합니다.',
		statusText: '측정 전',
		entryId: 'agent-readiness',
		toolId: 'agent-readiness',
	},
	{
		id: 'content-opportunity',
		categoryKey: 'ACT',
		categoryKo: '실행 개선',
		categoryEn: 'ACT',
		titleKo: 'AI 콘텐츠 기회',
		titleEn: 'AI Content Opportunity',
		subDescription: 'AI가 선호하는 구조화된 문서(FAQ, 비교표, 근거 데이터) 작성 템플릿을 생성합니다.',
		statusText: '측정 전',
		entryId: 'snapshot',
		toolId: 'snapshot',
	},
	{
		id: 'visibility-monitor',
		categoryKey: 'MONITOR',
		categoryKo: '지속 모니터링',
		categoryEn: 'MONITOR',
		titleKo: '노출도 지속 추적',
		titleEn: 'Visibility Monitor',
		subDescription: '사이트 개선 후 AI 검색 엔진의 인용 점수와 순위 변화를 시계열로 추적합니다.',
		statusText: '측정 전',
		entryId: 'visibility-trend',
		toolId: 'visibility',
	},
	{
		id: 'ai-alert',
		categoryKey: 'MONITOR',
		categoryKo: '지속 모니터링',
		categoryEn: 'MONITOR',
		titleKo: 'AI 실시간 알림',
		titleEn: 'AI Alert',
		subDescription: '노출도 급락이나 부정적 답변 생성 시 즉각 슬랙/이메일로 경보를 전달합니다.',
		statusText: '측정 전',
		entryId: 'alert',
		toolId: 'visibility',
	},
	{
		id: 'war-room',
		categoryKey: 'MONITOR',
		categoryKo: '지속 모니터링',
		categoryEn: 'MONITOR',
		titleKo: 'AI 검색 통합 관제실',
		titleEn: 'AI Search War Room',
		subDescription: '모든 AI 검색 엔진(ChatGPT, Gemini, Claude 등)의 종합 현황을 한 화면에서 모니터링합니다.',
		statusText: '측정 전',
		entryId: 'war-room',
		toolId: 'war-room',
	},
];

const BY_ID = new Map(AI_INTELLIGENCE_TOOLS.map((tool) => [tool.id, tool]));
const BY_ENTRY = new Map(AI_INTELLIGENCE_TOOLS.map((tool) => [tool.entryId, tool]));

export function getIntelligenceToolById(id: string): IntelligenceTool | undefined {
	return BY_ID.get(id);
}

export function getIntelligenceToolByEntryId(entryId: string): IntelligenceTool | undefined {
	return BY_ENTRY.get(entryId as AsiIaEntryId);
}

export function getIntelligenceCategory(pillarId: string): IntelligenceCategory {
	return (
		AI_INTELLIGENCE_CATEGORIES.find((item) => item.pillarId === pillarId) ?? AI_INTELLIGENCE_CATEGORIES[0]
	);
}

export function formatIntelligenceCategory(category: Pick<IntelligenceCategory, 'categoryKo' | 'categoryEn'>): string {
	return `${category.categoryKo} · ${category.categoryEn}`;
}

export function resolveIntelligenceTool(pathname: string, hash = ''): IntelligenceTool {
	const route = resolveAsiPathname(pathname);
	const normalized = hash.startsWith('#') ? hash : hash ? `#${hash}` : '';
	if (route.tool.id === 'visibility') {
		if (normalized === '#asi-trend') return BY_ID.get('visibility-monitor') ?? AI_INTELLIGENCE_TOOLS[0];
		if (normalized === '#asi-alerts') return BY_ID.get('ai-alert') ?? AI_INTELLIGENCE_TOOLS[0];
		return BY_ID.get('visibility') ?? AI_INTELLIGENCE_TOOLS[0];
	}
	return BY_ENTRY.get(route.tool.id) ?? AI_INTELLIGENCE_TOOLS[0];
}
