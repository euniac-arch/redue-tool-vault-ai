/**
 * Builds the As-Is / Advice / To-Be trio for one AI engine.
 * As-Is level follows engineScores + isHttps (Level 3 allowed at 80+ HTTPS).
 * To-Be is always Level 3 after Answer Center 5 prescriptions.
 */

import { HTTPS_P0_LABEL } from '@/lib/audit/scoreCalculator';
import type { AiVisibilityEngineId } from '@/lib/audit/ai-engine-visibility';
import type { EngineAnalysisTag } from '@/types/geo-diagnostic';
import type {
	AsIsTriggerLevel,
	EngineCurrentStatus,
	EngineOptimizationAdvice,
	EnginePostOptimization,
	EngineTriggerSimulationJson,
} from '@/types/geo-trigger-simulation';

export type TriggerSimLang = 'ko' | 'en';

const LEVEL_LABEL: Record<TriggerSimLang, Record<AsIsTriggerLevel, string>> = {
	ko: { 1: 'Level 1 브랜드전용', 2: 'Level 2 세부서비스/롱테일', 3: 'Level 3 광의 카테고리 추천' },
	en: { 1: 'Level 1 brand-only', 2: 'Level 2 service / long-tail', 3: 'Level 3 broad category recommend' },
};

const TARGET_LEVEL_LABEL: Record<TriggerSimLang, string> = {
	ko: 'Level 3 우수 (비브랜드 추천 질의) — Answer Center 5대 처방(SSL + JSON-LD + /llms.txt)',
	en: 'Level 3 excellent (unbranded recommend queries) — Answer Center 5 prescriptions (SSL + JSON-LD + /llms.txt)',
};

const ENGINE_ACTIONS: Record<AiVisibilityEngineId, { ko: string[]; en: string[] }> = {
	chatgpt: {
		ko: ['Bing Places 등록', 'GPTBot 수집 허용', '웹 언급량(Digital Footprint) 확대'],
		en: ['Register Bing Places', 'Allow GPTBot', 'Grow recent web mentions'],
	},
	gemini: {
		ko: ['엔티티 마크업 보강', 'Google Business Profile 연동', 'LocalBusiness/Organization JSON-LD 완결'],
		en: ['Reinforce entity markup', 'Connect Google Business Profile', 'Complete LocalBusiness/Organization JSON-LD'],
	},
	claude: {
		ko: ['AI 크롤러(ClaudeBot) 허용', 'E-E-A-T 긴 글·저자 엔티티', 'FAQ JSON-LD 적용'],
		en: ['Allow ClaudeBot', 'Add E-E-A-T long-form + author entities', 'Apply FAQ JSON-LD'],
	},
	perplexity: {
		ko: ['FAQ JSON-LD 적용', '인용 가능한 HowTo/공식 URL 클러스터', '엔티티 마크업 보강'],
		en: ['Apply FAQ JSON-LD', 'Publish citable HowTo/official URL cluster', 'Reinforce entity markup'],
	},
	copilot: {
		ko: ['Bing 인덱싱·Places 연동', '사이트맵/스키마 신호 보강', '엔티티 마크업 보강'],
		en: ['Connect Bing index/Places', 'Strengthen sitemap/schema signals', 'Reinforce entity markup'],
	},
	clova: {
		ko: ['네이버 플레이스 NAP 일치', '지역 프로필 연동', '블로그/지식iN Q&A 최신화'],
		en: ['Match Naver Place NAP', 'Connect local profile', 'Refresh blog/Knowledge-iN Q&A'],
	},
};

const GENERIC_ACTIONS: Record<TriggerSimLang, string[]> = {
	ko: ['엔티티 마크업 보강', 'FAQ JSON-LD 적용', '지역 프로필 연동'],
	en: ['Reinforce entity markup', 'Apply FAQ JSON-LD', 'Connect local profile'],
};

export type KeyActionType = 'required' | 'structure' | 'trust';

export interface EngineKeyAction {
	rank: 1 | 2 | 3;
	type: KeyActionType;
	text: Record<TriggerSimLang, string>;
}

export interface EngineKeyActionView {
	rank: 1 | 2 | 3;
	type: KeyActionType;
	text: string;
}

const KEY_ACTION_TYPES: readonly KeyActionType[] = ['required', 'structure', 'trust'];

/** Ranked 1→2→3 breakthrough roadmap shown on each engine card. */
export const ENGINE_KEY_ACTIONS: Record<AiVisibilityEngineId, EngineKeyAction[]> = {
	chatgpt: [
		{
			rank: 1,
			type: 'required',
			text: {
				ko: 'Bing Places 등록 및 공식 NAP(상호·주소·연락처) 일치',
				en: 'Register Bing Places and match official NAP (name, address, phone)',
			},
		},
		{
			rank: 2,
			type: 'structure',
			text: {
				ko: 'Organization 및 MedicalBusiness JSON-LD 스키마 배포',
				en: 'Deploy Organization and MedicalBusiness JSON-LD schema',
			},
		},
		{
			rank: 3,
			type: 'trust',
			text: {
				ko: '위키데이터 엔티티 등록 및 공인 보도자료 배포',
				en: 'Register a Wikidata entity and publish official press releases',
			},
		},
	],
	gemini: [
		{
			rank: 1,
			type: 'required',
			text: {
				ko: 'Google 비즈니스 프로필(GBP) 연동 및 지도 좌표 최적화',
				en: 'Connect Google Business Profile (GBP) and optimize map coordinates',
			},
		},
		{
			rank: 2,
			type: 'structure',
			text: {
				ko: 'Google 지식패널 엔티티 식별자(sameAs) 연결',
				en: 'Link Google Knowledge Panel entity identifiers (sameAs)',
			},
		},
		{
			rank: 3,
			type: 'trust',
			text: {
				ko: '구글맵 실 사용자 리뷰 확충 및 로컬 신호 강화',
				en: 'Grow Google Maps reviews and local signals',
			},
		},
	],
	claude: [
		{
			rank: 1,
			type: 'required',
			text: {
				ko: '온페이지 E-E-A-T 전문 의료진/연구소 메타데이터 구성',
				en: 'Build on-page E-E-A-T metadata for specialists and the institute',
			},
		},
		{
			rank: 2,
			type: 'structure',
			text: {
				ko: '공인 임상 연구 데이터 및 질환별 팩트 밀도 고도화',
				en: 'Deepen certified clinical research data and condition-level fact density',
			},
		},
		{
			rank: 3,
			type: 'trust',
			text: {
				ko: '학술·공공기관 발 외부 인용 백링크 확보',
				en: 'Secure citation backlinks from academic and public institutions',
			},
		},
	],
	perplexity: [
		{
			rank: 1,
			type: 'required',
			text: {
				ko: '사이트 루트 /llms.txt 표준 마크다운 인덱스 배포',
				en: 'Publish a standard markdown /llms.txt index at the site root',
			},
		},
		{
			rank: 2,
			type: 'structure',
			text: {
				ko: '핵심 질의응답 FAQPage 구조화 마크업 구축',
				en: 'Build FAQPage structured markup for core Q&A',
			},
		},
		{
			rank: 3,
			type: 'trust',
			text: {
				ko: 'AI 크롤러(PerplexityBot) 접근 허용 및 최신성 갱신',
				en: 'Allow PerplexityBot access and keep content fresh',
			},
		},
	],
	copilot: [
		{
			rank: 1,
			type: 'required',
			text: {
				ko: 'Bing 웹마스터도구 사이트맵 제출 및 정밀 색인',
				en: 'Submit a sitemap in Bing Webmaster Tools and refine indexing',
			},
		},
		{
			rank: 2,
			type: 'structure',
			text: {
				ko: 'Bing Places 로컬 비즈니스 프로필 연동',
				en: 'Connect a Bing Places local business profile',
			},
		},
		{
			rank: 3,
			type: 'trust',
			text: {
				ko: 'Windows / Edge 브라우저 로컬 지식 카드 연동',
				en: 'Link Windows / Edge local knowledge cards',
			},
		},
	],
	clova: [
		{
			rank: 1,
			type: 'required',
			text: {
				ko: '네이버 스마트플레이스 공식 등록 및 위치 연동',
				en: 'Register the official Naver Smart Place and connect location',
			},
		},
		{
			rank: 2,
			type: 'structure',
			text: {
				ko: '네이버 서치어드바이저 오픈그래프/메타태그 정합성 확보',
				en: 'Align Open Graph / meta tags in Naver Search Advisor',
			},
		},
		{
			rank: 3,
			type: 'trust',
			text: {
				ko: '공식 블로그 최신 발행 문서 및 외부 언급량 확충',
				en: 'Publish fresh official blog posts and grow external mentions',
			},
		},
	],
};

/** Rank-1 breakthrough task (kept for callers that still need a single string). */
export const ENGINE_KEY_ACTION: Record<AiVisibilityEngineId, { ko: string; en: string }> = {
	chatgpt: ENGINE_KEY_ACTIONS.chatgpt[0].text,
	gemini: ENGINE_KEY_ACTIONS.gemini[0].text,
	claude: ENGINE_KEY_ACTIONS.claude[0].text,
	perplexity: ENGINE_KEY_ACTIONS.perplexity[0].text,
	copilot: ENGINE_KEY_ACTIONS.copilot[0].text,
	clova: ENGINE_KEY_ACTIONS.clova[0].text,
};

export function getEngineKeyActions(
	engineId: AiVisibilityEngineId,
	lang: TriggerSimLang,
): EngineKeyActionView[] {
	const items = ENGINE_KEY_ACTIONS[engineId];
	if (!items?.length) {
		return GENERIC_ACTIONS[lang].slice(0, 3).map((text, index) => ({
			rank: (index + 1) as 1 | 2 | 3,
			type: KEY_ACTION_TYPES[index] ?? 'trust',
			text,
		}));
	}
	return items.map((item) => ({ rank: item.rank, type: item.type, text: item.text[lang] }));
}

export function getEngineKeyAction(engineId: AiVisibilityEngineId, lang: TriggerSimLang): string {
	return getEngineKeyActions(engineId, lang)[0]?.text ?? GENERIC_ACTIONS[lang][0];
}

/** As-Is level from a measured depth. HTTPS off or honesty cap → Level 1. */
export function asIsLevelFromDepth(
	depth: 0 | 1 | 2 | 3 | null | undefined,
	opts?: { brandOnly?: boolean; isHttps?: boolean },
): AsIsTriggerLevel {
	if (opts?.isHttps === false || opts?.brandOnly) return 1;
	if (depth === 3) return 3;
	if (depth === 2) return 2;
	return 1;
}

export function formatStatusTags(tags: readonly EngineAnalysisTag[] | undefined, lang: TriggerSimLang): string[] {
	if (!tags?.length) return [];
	return tags.slice(0, 4).map((tag) => {
		const raw = tag.label.replace(/^#/, '').trim();
		if (!raw) return lang === 'en' ? '#signal' : '#신호';
		const compact = raw.replace(/\s+/g, '');
		return compact.startsWith('#') ? compact : `#${compact}`;
	});
}

export function buildOptimizationActionItems(
	engineId: AiVisibilityEngineId,
	tags: readonly EngineAnalysisTag[] | undefined,
	lang: TriggerSimLang,
): string[] {
	const items: string[] = [];
	const negatives = (tags ?? []).filter((tag) => tag.polarity === 'negative');
	for (const tag of negatives) {
		const id = tag.id;
		if (id === 'local-schema' || id === 'schema' || id.includes('schema')) {
			items.push(lang === 'en' ? 'Reinforce entity markup' : '엔티티 마크업 보강');
		} else if (id === 'faq' || id === 'sources') {
			items.push(lang === 'en' ? 'Apply FAQ JSON-LD' : 'FAQ JSON-LD 적용');
		} else if (id === 'nap' || id === 'naver' || id === 'maps') {
			items.push(lang === 'en' ? 'Connect local profile / NAP' : '지역 프로필 연동');
		} else if (id === 'bing' || id === 'copilot') {
			items.push(lang === 'en' ? 'Register Bing Places' : 'Bing Places 등록');
		} else if (id === 'mentions') {
			items.push(lang === 'en' ? 'Grow web mention volume' : '웹 언급량 확대');
		} else if (id === 'claude-bot' || id === 'unindexed') {
			items.push(lang === 'en' ? 'Allow AI crawlers and publish indexable pages' : 'AI 크롤러 허용 및 색인 페이지 확보');
		} else if (id === 'brand-only') {
			items.push(lang === 'en' ? 'Add category+location landing pages' : '카테고리·지역 랜딩 페이지 보강');
		} else if (id === 'https-missing' || id === 'https-recommend-limit') {
			items.push(lang === 'en' ? HTTPS_P0_LABEL.en : HTTPS_P0_LABEL.ko);
		}
	}

	const focus = ENGINE_ACTIONS[engineId]?.[lang] ?? GENERIC_ACTIONS[lang];
	for (const item of focus) {
		if (!items.includes(item)) items.push(item);
	}
	if (!items.length) items.push(...GENERIC_ACTIONS[lang]);
	return items.slice(0, 4);
}

export function buildCurrentStatus(input: {
	lang: TriggerSimLang;
	asIsLevel: AsIsTriggerLevel;
	triggerQuery: string;
	simulationResponse: string;
	statusTags: string[];
	isLockedBySecurity?: boolean;
}): EngineCurrentStatus {
	return {
		level: input.asIsLevel,
		levelLabel: LEVEL_LABEL[input.lang][input.asIsLevel],
		triggerQuery: input.triggerQuery,
		simulationResponse: input.simulationResponse,
		statusTags: input.statusTags,
		isLockedBySecurity: input.isLockedBySecurity,
	};
}

export function buildOptimizationAdvice(
	engineId: AiVisibilityEngineId,
	tags: readonly EngineAnalysisTag[] | undefined,
	lang: TriggerSimLang,
	opts?: { isHttps?: boolean },
): EngineOptimizationAdvice {
	const actionItems = buildOptimizationActionItems(engineId, tags, lang);
	if (opts?.isHttps === false) {
		const ssl = lang === 'en' ? HTTPS_P0_LABEL.en : HTTPS_P0_LABEL.ko;
		if (!actionItems.includes(ssl)) actionItems.unshift(ssl);
	}
	return { actionItems: actionItems.slice(0, 4) };
}

export function buildPostOptimization(input: {
	lang: TriggerSimLang;
	expandedTriggerQuery: string;
	expectedSimulationResponse: string;
	expandedCategoryQueries?: string[];
}): EnginePostOptimization {
	return {
		targetLevel: 3,
		targetLevelLabel: TARGET_LEVEL_LABEL[input.lang],
		expandedTriggerQuery: input.expandedTriggerQuery,
		expectedSimulationResponse: input.expectedSimulationResponse,
		expandedCategoryQueries: input.expandedCategoryQueries?.length ? input.expandedCategoryQueries : undefined,
	};
}

export function toEngineTriggerSimulationJson(input: {
	engineName: string;
	engineId: AiVisibilityEngineId;
	current: EngineCurrentStatus;
	advice: EngineOptimizationAdvice;
	post: EnginePostOptimization;
}): EngineTriggerSimulationJson {
	return {
		engine: input.engineName,
		engineId: input.engineId,
		current_status: {
			level: input.current.level === 3 ? 'Level 3' : input.current.level === 2 ? 'Level 2' : 'Level 1',
			trigger_query: input.current.triggerQuery,
			simulation_response: input.current.simulationResponse,
			status_tags: input.current.statusTags,
		},
		optimization_advice: {
			action_items: input.advice.actionItems,
		},
		post_optimization: {
			target_level: input.post.targetLevelLabel,
			expanded_trigger_query: input.post.expandedTriggerQuery,
			expected_simulation_response: input.post.expectedSimulationResponse,
		},
	};
}
