import type { KeywordSourceId } from '@/lib/audit/keyword-recommendations';

/**
 * Hardcoded P1–P6 source labels. next-intl treats `<title>` as a rich-text tag,
 * so Title Tag copy must never go through `t('sources.title.*')`.
 */
export const KEYWORD_SOURCE_COPY: Record<
	KeywordSourceId,
	{ label: string; tag: string; hint: { ko: string; en: string } }
> = {
	schema: {
		label: 'JSON-LD Schema',
		tag: 'knowsAbout',
		hint: {
			ko: 'AI 엔진이 엔티티·전문분야를 식별하는 최우선 구조화 데이터 (knowsAbout / specialty)',
			en: 'Highest-priority structured data AI engines use to identify entities and specialties (knowsAbout / specialty)',
		},
	},
	title: {
		label: 'Title Tag (<title>)',
		tag: '<title>',
		hint: {
			ko: '검색엔진이 가장 먼저 읽는 페이지 주제 신호',
			en: 'The first topical signal search engines read on the page',
		},
	},
	meta: {
		label: 'Meta Tags',
		tag: 'keywords',
		hint: {
			ko: 'meta keywords · description에서 명시적으로 선언된 키워드',
			en: 'Keywords declared in meta keywords and description',
		},
	},
	og: {
		label: 'Open Graph',
		tag: 'og:title',
		hint: {
			ko: '소셜·AI 스니펫이 파싱하는 og:title / og:description',
			en: 'og:title / og:description parsed for social and AI snippets',
		},
	},
	heading: {
		label: 'Headings',
		tag: 'H1–H2',
		hint: {
			ko: '문서 개요(H1·H2)에서 추출하는 핵심 토픽',
			en: 'Core topics extracted from the document outline (H1–H2)',
		},
	},
	body: {
		label: 'HTML Body',
		tag: 'entity',
		hint: {
			ko: '본문 엔티티 구문·니즈 시그널에서 보조 추출',
			en: 'Secondary extraction from body entity phrases and need signals',
		},
	},
};

export function keywordSourceCopy(
	id: KeywordSourceId,
	field: 'label' | 'tag',
): string {
	return KEYWORD_SOURCE_COPY[id][field];
}

export function keywordSourceHint(id: KeywordSourceId, lang: 'ko' | 'en'): string {
	return KEYWORD_SOURCE_COPY[id].hint[lang];
}
