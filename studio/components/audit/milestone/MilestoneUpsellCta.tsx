'use client';

import { Sparkles } from 'lucide-react';

export interface MilestoneUpsellCtaProps {
	onApply?: () => void;
	applyHref?: string;
}

/**
 * 일반/무료 사용자에게는 마일스톤 타임라인·박제 컨트롤을 전혀 노출하지 않고,
 * 단일 실시간 진단 결과 하단에 49만 원 'GEO 프로' 패키지 CTA만 배치한다.
 */
export function MilestoneUpsellCta({ onApply, applyHref = '/#geo-pro' }: MilestoneUpsellCtaProps) {
	return (
		<div className="milestone-upsell-cta print:hidden relative overflow-hidden rounded-2xl border border-[#C9A227]/40 bg-gradient-to-br from-[#0B1C2C] via-[#132538] to-[#0B1C2C] p-6 text-white shadow-lg">
			<div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#E8C547]">
						<Sparkles className="h-3.5 w-3.5" aria-hidden />
						GEO 프로 · 49만 원 4주 집중 패키지
					</p>
					<h3 className="mt-1.5 text-lg font-extrabold">
						1회 진단으로 끝내지 마세요 — 4주간 회차별로 개선을 추적하고 박제된 증적으로 성과를 증명합니다.
					</h3>
					<p className="mt-1 text-sm text-slate-300">
						착수 사전 진단 → 온페이지 패치 → 크롤러 재수집 → 최종 성과 검증까지, 전담 엔지니어가 4회차를 직접 관리합니다.
					</p>
				</div>
				<a
					href={applyHref}
					onClick={onApply}
					className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#E8C547] to-[#C9A227] px-5 py-3 text-sm font-extrabold text-[#0B1C2C] shadow-lg transition hover:brightness-105"
				>
					GEO 프로 패키지 신청하기
				</a>
			</div>
		</div>
	);
}
