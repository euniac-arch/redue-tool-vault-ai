/**
 * Level 1–3 AI search-query approach and top-exposure mechanism guides.
 * Used by the trigger-level selector and per-engine simulation cards.
 */

import type { ReachLevel, ReachLevelGuide } from '@/types/site-reach';

export type { ReachLevelGuide };
export type ReachGuideLang = 'ko' | 'en';

export const REACH_LEVEL_GUIDES: Record<ReachLevel, ReachLevelGuide> = {
	1: {
		level: 1,
		title: 'Level 1 · 브랜드 직접 검색',
		badgeText: '브랜드 전용',
		shortDesc: '직접 상호 검색 시에만 노출',
		reachMechanism:
			'상호명(업체명)을 정확히 입력했을 때만 AI가 인식하여 답변합니다. 비브랜드 일반 질문에는 노출되지 않습니다.',
		exposureScope: '기존에 상호를 이미 알고 있는 고객에 국한',
		examplePattern: '[상호명] 위치, [상호명] 진료시간/전화번호',
	},
	2: {
		level: 2,
		title: 'Level 2 · 카테고리 / 지역 탐색',
		badgeText: '카테고리 매칭',
		shortDesc: '지역 + 핵심 업종 조합 시 노출',
		reachMechanism:
			'상호가 없어도 [지역명 + 대표 진료/업종 키워드]가 결합된 질문에 AI가 관련 플레이스/업체 목록으로 인용합니다.',
		exposureScope: '해당 지역의 기본 업종을 찾는 잠재 고객 도달',
		examplePattern: '[지역명] [업종/과목명] 추천, [지역명] [진료과목]',
	},
	3: {
		level: 3,
		title: 'Level 3 · 비브랜드 대화형 추천',
		badgeText: '대화형 1순위 인용 (GEO 목표)',
		shortDesc: '상호 없이 증상/니즈/연관어 질의에도 직접 추천',
		reachMechanism:
			'상호가 전혀 없어도 [세부 증상 + 비수술/장점 + 추천 니즈] 등 폭넓은 자연어 연관 질의에 AI가 근거를 들어 직접 추천 답변을 작성합니다.',
		exposureScope: '폭넓은 비브랜드 검색자 및 고관여 신규 고객 전면 선점',
		examplePattern: '[지역]에서 [증상/질환] [치료방법] 잘하고 평가 좋은 곳 어디야?',
	},
};

const REACH_LEVEL_GUIDES_EN: Record<ReachLevel, ReachLevelGuide> = {
	1: {
		level: 1,
		title: 'Level 1 · Brand-name search',
		badgeText: 'Brand only',
		shortDesc: 'Shown only on exact business-name searches',
		reachMechanism:
			'The AI recognizes and answers only when the exact business name is typed. Unbranded general questions will not surface the brand.',
		exposureScope: 'Limited to customers who already know the business name',
		examplePattern: '[Business name] location, [Business name] hours / phone',
	},
	2: {
		level: 2,
		title: 'Level 2 · Category / local discovery',
		badgeText: 'Category match',
		shortDesc: 'Shown when locality + core category are combined',
		reachMechanism:
			'Even without the business name, AI cites related places when the query combines [locality + core service/category].',
		exposureScope: 'Reaches potential customers looking for that category in the area',
		examplePattern: '[Area] [category/specialty] recommend, [Area] [service]',
	},
	3: {
		level: 3,
		title: 'Level 3 · Unbranded conversational recommend',
		badgeText: 'Conversational #1 citation (GEO goal)',
		shortDesc: 'Directly recommended on symptom/need queries without the brand name',
		reachMechanism:
			'Even with no brand name, AI writes a sourced direct recommendation for broad natural-language queries such as [symptom + treatment benefit + recommend need].',
		exposureScope: 'Front-of-mind capture of unbranded searchers and high-intent new customers',
		examplePattern: 'Where in [area] is a well-reviewed place that is good at [treatment] for [condition]?',
	},
};

const GUIDES_BY_LANG: Record<ReachGuideLang, Record<ReachLevel, ReachLevelGuide>> = {
	ko: REACH_LEVEL_GUIDES,
	en: REACH_LEVEL_GUIDES_EN,
};

export const REACH_LEVELS: readonly ReachLevel[] = [1, 2, 3];

export function getReachLevelGuide(level: ReachLevel, lang: ReachGuideLang = 'ko'): ReachLevelGuide {
	return GUIDES_BY_LANG[lang][level];
}

export function getReachLevelGuides(lang: ReachGuideLang = 'ko'): Record<ReachLevel, ReachLevelGuide> {
	return GUIDES_BY_LANG[lang];
}
