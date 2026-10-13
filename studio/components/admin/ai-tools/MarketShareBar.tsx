'use client';

import type { MarketBundle } from '@/lib/ai-hub/market-observations';
import { SHARE_UNAVAILABLE_LABEL } from '@/lib/ai-hub/market-observations';
import { MarketProvenance, WebTrafficShareBar } from '@/components/ai-hub/MarketObservationPanels';

interface MarketShareBarProps {
	bundle?: MarketBundle | null;
	/** Category tab. Only the global / LLM view has a comparable web-traffic set. */
	category?: string | 'all';
}

const NO_COHORT = new Set(['image', 'video', 'audio', 'code', 'hub']);

/**
 * Global web-traffic share for one published comparison set.
 * Other categories do not borrow that denominator.
 */
export function MarketShareBar({ bundle = null, category = 'all' }: MarketShareBarProps) {
	if (!bundle) {
		return (
			<div className="rounded-xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
				{SHARE_UNAVAILABLE_LABEL}
			</div>
		);
	}
	if (category && NO_COHORT.has(category)) {
		return (
			<div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
				<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">카테고리 웹 트래픽 점유율</p>
				<p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{SHARE_UNAVAILABLE_LABEL}</p>
				<p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
					이미지·영상·음성·코딩 도구는 대화형 AI 웹 트래픽과 같은 비교 집합이 아닙니다. 아래 카드 순서는 에디터 추천 점수입니다.
				</p>
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<WebTrafficShareBar bundle={bundle} />
			{category === 'llm' ? (
				<p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
					비교 집합에 없는 대화형 서비스는 막대에 넣지 않습니다.
				</p>
			) : null}
		</div>
	);
}

export { MarketProvenance };
