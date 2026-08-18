/**
 * Score-tied financial framing for the diagnosis header.
 * Amounts are 10,000-won rounded simulations — not invoices.
 */

import { clampScore } from '@/lib/audit/score-grade';

export type FinancialImpactLang = 'ko' | 'en';

export type FinancialImpactType = 'LOSS' | 'RECOVERABLE_LOSS' | 'UPSIDE' | 'PROTECTED';

export interface FinancialImpact {
	type: FinancialImpactType;
	icon: string;
	amount: number;
	mainText: string;
	subText: string;
	badgeColor: string;
	reasoning: string;
}

const BADGE: Record<FinancialImpactType, string> = {
	LOSS: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30',
	RECOVERABLE_LOSS:
		'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
	UPSIDE:
		'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
	PROTECTED:
		'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30',
};

function roundTo10k(value: number): number {
	return Math.round(value / 10_000) * 10_000;
}

function formatAmount(amount: number, lang: FinancialImpactLang): string {
	return amount.toLocaleString(lang === 'en' ? 'en-US' : 'ko-KR');
}

export function isOpportunityCost(type: FinancialImpactType): boolean {
	return type === 'LOSS' || type === 'RECOVERABLE_LOSS';
}

export function getFinancialImpact(score: number, lang: FinancialImpactLang = 'ko'): FinancialImpact {
	const n = clampScore(score);
	const ko = lang !== 'en';

	if (n < 65) {
		const amount = roundTo10k((100 - n) * 8_800);
		const formatted = formatAmount(amount, lang);
		return {
			type: 'LOSS',
			icon: '📉',
			amount,
			mainText: ko ? `월 약 ${formatted}원 기회 손실` : `About ₩${formatted} in monthly opportunity loss`,
			subText: ko
				? 'AI 신뢰도 부재로 인한 잠재 고객 유출 환산액'
				: 'Estimated prospect leakage from missing AI trust signals',
			badgeColor: BADGE.LOSS,
			reasoning: ko
				? '미흡한 구조화 데이터로 인해 지역/업종 AI 추천 답변에서 누락되어 경쟁사로 유출되는 예상 잠재 고객 수 × 키워드 평균 CPC 단가 기준'
				: 'Weak structured data omits the brand from local/industry AI answers, so prospects go to competitors. Estimate = expected lost customers × average keyword CPC.',
		};
	}

	if (n < 80) {
		const amount = roundTo10k((100 - n) * 7_500);
		const formatted = formatAmount(amount, lang);
		return {
			type: 'RECOVERABLE_LOSS',
			icon: '💡',
			amount,
			mainText: ko
				? `월 약 ${formatted}원 기회 손실 (개선 시 회수 가능)`
				: `About ₩${formatted} in monthly opportunity loss (recoverable)`,
			subText: ko
				? '표준 스키마 보강 시 즉시 방어 가능한 트래픽 누수액'
				: 'Traffic leakage you can defend immediately by reinforcing standard schema',
			badgeColor: BADGE.RECOVERABLE_LOSS,
			reasoning: ko
				? '기본적인 검색 색인은 작동하나, 대표자/플레이스 E-E-A-T 미비로 인해 2~3순위로 밀려나며 발생하는 기회비용 기준'
				: 'Basic search indexing works, but missing founder/Place E-E-A-T signals push you to 2nd–3rd place. The figure is the opportunity cost of that rank gap.',
		};
	}

	if (n < 90) {
		const amount = roundTo10k(n * 21_000);
		const formatted = formatAmount(amount, lang);
		return {
			type: 'UPSIDE',
			icon: '🚀',
			amount,
			mainText: ko
				? `1위 독점 시 월 약 ${formatted}원 광고 대체 가치`
				: `About ₩${formatted}/mo in ad-equivalent value if you lock #1`,
			subText: ko
				? 'AI 추천 답변 1순위 장악 시 창출되는 유료 광고(SA) 대체 효과'
				: 'Paid-search (SA) replacement effect when you own the top AI recommendation',
			badgeColor: BADGE.UPSIDE,
			reasoning: ko
				? '업계 1위로 AI 답변 최상단에 고정 인용될 경우, 동일한 유입을 네이버/구글 파워링크 유료 광고로 집행했을 때 절감되는 월간 마케팅 예산 기준'
				: 'If you become the fixed #1 citation in AI answers, this is the monthly marketing budget you would otherwise spend on Naver/Google PowerLink ads for the same inflow.',
		};
	}

	const amount = roundTo10k(n * 32_000);
	const formatted = formatAmount(amount, lang);
	return {
		type: 'PROTECTED',
		icon: '👑',
		amount,
		mainText: ko
			? `월 약 ${formatted}원 광고비 방어 중`
			: `Defending about ₩${formatted}/mo in paid-ad spend`,
		subText: ko
			? '독보적 지식그래프 구축으로 최상단 인용 점유율 방어 중'
			: 'Marketing savings from holding exclusive top-citation status via the knowledge graph',
		badgeColor: BADGE.PROTECTED,
		reasoning: ko
			? '전체 AI 검색엔진의 1차 공인 출처로 확정되어, 경쟁사의 공격적 광고 집행 속에서도 무과금으로 1위 트래픽을 선점하고 있는 방어 가치'
			: 'You are established as a primary cited source across AI search engines, capturing #1 traffic at no ad cost even when competitors spend aggressively.',
	};
}
