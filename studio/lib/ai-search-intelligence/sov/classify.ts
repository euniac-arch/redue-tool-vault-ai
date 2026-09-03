import type { AsiSovCategory } from '@/lib/ai-search-intelligence/types';

const RULES: Array<{ category: AsiSovCategory; test: RegExp }> = [
	{ category: 'compare', test: /비교|어디가 더|vs\.?|versus|차이|골라/i },
	{ category: 'purchase', test: /비용|가격|얼마|예약|상담|결제|할인/i },
	{ category: 'solve', test: /부작용|안 되|안되|효과 없|문제|실패|아프|통증/i },
	{ category: 'recommend', test: /추천|잘하는|best|recommend|추천해/i },
	{ category: 'local', test: /근처|인근|야간|동구|서구|남구|북구|중구|역\s|동네/i },
];

export function classifyAsiSovQuery(query: string): AsiSovCategory {
	const text = query.trim();
	if (!text) return 'discovery';
	for (const rule of RULES) {
		if (rule.test.test(text)) return rule.category;
	}
	return 'discovery';
}
