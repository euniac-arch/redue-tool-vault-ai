'use client';

import { KAKAO_LINKS, KAKAO_CHECKLIST, KAKAO_TIPS, KAKAO_DEBUGGER_LINK } from '@/lib/admin/portal-hub/data';
import { ChecklistCard } from '../ChecklistCard';
import { ConsoleLinkButton } from '../ConsoleLinkButton';
import { OptimizationTips } from '../OptimizationTips';

interface KakaoTabProps {
	isChecked: (id: string) => boolean;
	onToggle: (id: string) => void;
}

export function KakaoTab({ isChecked, onToggle }: KakaoTabProps) {
	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">
							Daum / Kakao Webmaster
						</p>
						<h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">다음 / 카카오 등록</h3>
					</div>
					<div className="flex flex-wrap gap-2">
						{KAKAO_LINKS.map((link, index) => (
							<ConsoleLinkButton
								key={link.url}
								label={link.label}
								url={link.url}
								variant={index === 0 ? 'primary' : 'secondary'}
							/>
						))}
					</div>
				</div>
			</section>

			<ChecklistCard items={KAKAO_CHECKLIST} isChecked={isChecked} onToggle={onToggle} />

			<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
				<h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">카카오톡 공유 캐시 갱신</h3>
				<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
					OG 태그를 수정한 뒤에는 공유 디버거로 캐시를 즉시 갱신해야 새 썸네일/설명이 반영됩니다.
				</p>
				<div className="mt-3">
					<ConsoleLinkButton label={KAKAO_DEBUGGER_LINK.label} url={KAKAO_DEBUGGER_LINK.url} variant="secondary" />
				</div>
			</section>

			<OptimizationTips title="카카오 최적화 가이드" tips={KAKAO_TIPS} />
		</div>
	);
}
