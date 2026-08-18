/**
 * Industry-neutral metric impact copy + score bands for entity / RAG cards.
 * Interpolates `industryConfig.defaultCategory` — never hardcode a vertical noun.
 */

import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';

export type MetricBenefitType = 'entity' | 'rag';
export type MetricBenefitLang = 'ko' | 'en';
export type MetricImpactBand = 'good' | 'warning' | 'danger';

/** Fallback when `industryConfig.defaultCategory` is empty. */
export const DEFAULT_METRIC_CATEGORY_NAME: Record<MetricBenefitLang, string> = {
	ko: '전문 기업/기관',
	en: 'professional organization',
};

export const METRIC_IMPACT_THRESHOLD = {
	entity: 80,
	rag: 75,
} as const;

/** Warning band starts here; below is Danger. */
export const METRIC_IMPACT_WARNING_FLOOR = 50;

export type MetricBenefitIndustry = Pick<IndustryConfig, 'defaultCategory'> | null | undefined;

export function resolveBenefitCategoryName(
	industry?: MetricBenefitIndustry,
	lang: MetricBenefitLang = 'ko',
	override?: string | null,
): string {
	const fromOverride = override?.trim();
	if (fromOverride) return fromOverride;
	const fromConfig = industry?.defaultCategory?.trim();
	if (fromConfig) return fromConfig;
	return DEFAULT_METRIC_CATEGORY_NAME[lang];
}

export function clampMetricScore(score: number): number {
	if (!Number.isFinite(score)) return 0;
	return Math.min(100, Math.max(0, Math.round(score)));
}

/** Combined RAG chunk + fact-density score for the shared impact card. */
export function combinedRagFactScore(ragScore: number, factScore: number): number {
	return clampMetricScore((clampMetricScore(ragScore) + clampMetricScore(factScore)) / 2);
}

export function metricImpactThreshold(type: MetricBenefitType): number {
	return METRIC_IMPACT_THRESHOLD[type];
}

export function isMetricImpactPassed(type: MetricBenefitType, score: number): boolean {
	return clampMetricScore(score) >= METRIC_IMPACT_THRESHOLD[type];
}

export function metricImpactBand(type: MetricBenefitType, score: number): MetricImpactBand {
	const clamped = clampMetricScore(score);
	if (clamped >= METRIC_IMPACT_THRESHOLD[type]) return 'good';
	if (clamped >= METRIC_IMPACT_WARNING_FLOOR) return 'warning';
	return 'danger';
}

export interface MetricImpactCopy {
	withText: string;
	withoutText: string;
}

export function metricImpactCopy(
	type: MetricBenefitType,
	industry?: MetricBenefitIndustry,
	lang: MetricBenefitLang = 'ko',
	categoryName?: string | null,
): MetricImpactCopy {
	const category = resolveBenefitCategoryName(industry, lang, categoryName);
	if (type === 'entity') {
		return lang === 'en'
			? {
					withText: `AI blocks confusion with same-name businesses in other regions and confirms a single trusted ${category} entity, so it stays fixed at the top of Perplexity and ChatGPT answers and map recommendations.`,
					withoutText:
						'The knowledge graph cannot identify the brand, so traffic splits to same-name competitors, or AI cites portal blogs and directories instead of the official site.',
				}
			: {
					withText: `AI가 타 지역 동명 업체와의 혼동을 원천 차단하고 단일 신뢰 ${category} 엔티티로 확정하여, Perplexity·ChatGPT 정답 및 지도 추천 최상단에 안정적으로 고정 노출됩니다.`,
					withoutText:
						'AI 지식그래프가 브랜드를 식별하지 못해 동일 상호의 타사로 트래픽이 분산되거나, 공식 사이트 대신 포털 블로그·디렉터리만 인용됩니다.',
				};
	}
	return lang === 'en'
		? {
				withText:
					'Semantic paragraph structure and concrete conditions and figures (hours, costs, procedures, and the like) are in place, so AI parses without context loss and adopts the page as the top citation source on answer cards.',
				withoutText:
					'Abstract promotional copy causes 30%+ context loss during RAG vectorization, and AI treats the page as fact-poor and drops it from citation.',
			}
		: {
				withText:
					'문단 시맨틱 구조와 구체적 조건·수치(시간, 비용, 절차 등)가 확보되어, AI가 문맥 손실 없이 파싱해 정답 카드의 \'최우선 인용 출처(Citation Source)\'로 채택합니다.',
				withoutText:
					'추상적인 홍보 문구로 인해 RAG 벡터 변환 시 본문 문맥이 30% 이상 유실되며, AI가 \'팩트 부족\'으로 판단하여 답변 인용 대상에서 제외합니다.',
			};
}

/** @deprecated Use `metricImpactCopy(type).withText` — kept for existing tests. */
export function metricBenefitText(
	type: MetricBenefitType,
	industry?: MetricBenefitIndustry,
	lang: MetricBenefitLang = 'ko',
	categoryName?: string | null,
): string {
	return metricImpactCopy(type, industry, lang, categoryName).withText;
}
