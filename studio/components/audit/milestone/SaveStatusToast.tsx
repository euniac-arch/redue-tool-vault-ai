'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export interface SaveStatusToastProps {
	isSaving: boolean;
	/** 마지막으로 성공적으로 저장된 회차 라벨 — 바뀔 때마다 새 토스트를 띄운다. */
	successLabel: string | null;
	/** 원격(Firestore) 저장 자체가 실패했을 때만 채워진다(로컬 캐시 실패는 더 이상 에러로 취급하지 않음). */
	error: string | null;
}

/**
 * 화면 우하단 고정 토스트 — "저장 중…" 로딩 상태와 "◯회차 확정 완료 · 안전하게
 * 저장됨" 성공 피드백을 보여준다. 예전의 상시 노출 에러 배너(용량 초과 경고)를
 * 대체한다: 이제 원격(Firestore) 경량 저장이 거의 항상 성공하므로, 에러는
 * 드물게만 나타나는 일시적 토스트로 축소됐다.
 */
export function SaveStatusToast({ isSaving, successLabel, error }: SaveStatusToastProps) {
	const [visibleSuccess, setVisibleSuccess] = useState<string | null>(null);

	useEffect(() => {
		if (!successLabel) return;
		setVisibleSuccess(successLabel);
		const timer = window.setTimeout(() => setVisibleSuccess(null), 3200);
		return () => window.clearTimeout(timer);
	}, [successLabel]);

	if (!isSaving && !visibleSuccess && !error) return null;

	return (
		<div className="save-status-toast no-pdf-capture print:hidden pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col gap-2">
			{isSaving ? (
				<div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-lg dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
					<Loader2 className="h-4 w-4 animate-spin text-[#C9A227]" aria-hidden />
					회차 확정 결과를 서버에 저장 중…
				</div>
			) : null}
			{!isSaving && visibleSuccess ? (
				<div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-700 shadow-lg dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-300">
					<CheckCircle2 className="h-4 w-4" aria-hidden />
					{visibleSuccess} 확정 완료 · 서버에 안전하게 저장됨
				</div>
			) : null}
			{!isSaving && error ? (
				<div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 shadow-lg dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300">
					<XCircle className="h-4 w-4" aria-hidden />
					{error}
				</div>
			) : null}
		</div>
	);
}
