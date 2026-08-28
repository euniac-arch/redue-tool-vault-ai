'use client';

import { Clock3, Star } from 'lucide-react';

export function PromptFavoriteButton({
	active,
	onToggle,
}: {
	active: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-pressed={active}
			className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${
				active
					? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
					: 'border-slate-200 text-slate-600 hover:border-amber-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-amber-500/40'
			}`}
		>
			<Star className={`h-3.5 w-3.5 ${active ? 'fill-amber-400 text-amber-400' : ''}`} aria-hidden />
			{active ? '저장됨' : '즐겨찾기'}
		</button>
	);
}

export function PromptRecentHint({ show }: { show: boolean }) {
	if (!show) return null;
	return (
		<p className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
			<Clock3 className="h-3.5 w-3.5" aria-hidden />
			최근 사용에 기록됨 · 이 기기에 저장
		</p>
	);
}
