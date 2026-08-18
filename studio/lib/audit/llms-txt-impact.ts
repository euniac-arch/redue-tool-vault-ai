/**
 * Industry-neutral /llms.txt deploy With vs Without copy.
 * Interpolates `industryConfig.defaultCategory` — never hardcode a vertical noun.
 */

import type { IndustryConfig } from '@/lib/registry/universalIndustryRegistry';

export type LlmsImpactLang = 'ko' | 'en';

/** Fallback when `industryConfig.defaultCategory` is empty. */
export const DEFAULT_LLMS_CATEGORY_NAME: Record<LlmsImpactLang, string> = {
	ko: '전문 비즈니스',
	en: 'professional business',
};

export type LlmsImpactIndustry = Pick<IndustryConfig, 'defaultCategory'> | null | undefined;

export function resolveLlmsCategoryName(
	industry?: LlmsImpactIndustry,
	lang: LlmsImpactLang = 'ko',
	override?: string | null,
): string {
	const fromOverride = override?.trim();
	if (fromOverride) return fromOverride;
	const fromConfig = industry?.defaultCategory?.trim();
	if (fromConfig) return fromConfig;
	return DEFAULT_LLMS_CATEGORY_NAME[lang];
}

export interface LlmsTxtImpactCopy {
	withText: string;
	withoutText: string;
}

export function llmsTxtImpactCopy(
	industry?: LlmsImpactIndustry,
	lang: LlmsImpactLang = 'ko',
	categoryName?: string | null,
): LlmsTxtImpactCopy {
	const category = resolveLlmsCategoryName(industry, lang, categoryName);
	if (lang === 'en') {
		return {
			withText: `GPTBot, ClaudeBot, and other AI crawlers absorb core ${category} facts immediately as plain markdown—without HTML/JS parse cost—so answer cards cite you as the top source without distortion.`,
			withoutText:
				'Unstructured DOM parsing often drops core service terms and FAQs, so AI may miss the context, exclude you from citation, or substitute a competitor.',
		};
	}
	return {
		withText: `GPTBot·ClaudeBot 등 AI 크롤러가 HTML/JS 파싱 비용 없이 순수 마크다운으로 ${category}의 핵심 팩트를 즉시 흡수하여, AI 정답 카드 생성 시 왜곡 없이 최우선 출처로 인용합니다.`,
		withoutText:
			'비정형 DOM 구조 파싱 과정에서 핵심 서비스 조건과 FAQ가 유실될 위험이 크며, AI가 문맥을 파악하지 못해 답변 인용 대상에서 제외되거나 타사 정보로 대체될 수 있습니다.',
	};
}
