'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { AI_SEARCH_DAILY_LIMIT } from '@/lib/insights/insights-ai-usage';
import { useModalA11y } from '@/lib/ui/use-modal-a11y';

interface InsightsAiLockModalProps {
	open: boolean;
	onClose: () => void;
	onBackToFeed: () => void;
}

export function InsightsAiLockModal({ open, onClose, onBackToFeed }: InsightsAiLockModalProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	useModalA11y(open, onClose, panelRef);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
			<div
				aria-hidden="true"
				className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm motion-reduce:backdrop-blur-none"
				onClick={onClose}
			/>
			<div
				ref={panelRef}
				tabIndex={-1}
				role="dialog"
				aria-modal="true"
				aria-labelledby="insights-ai-lock-title"
				aria-describedby="insights-ai-lock-desc"
				className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300 bg-white p-6 shadow-2xl outline-none dark:border-amber-400/30 dark:bg-slate-950/90 dark:shadow-[0_20px_60px_rgba(8,47,73,0.45)]"
			>
				<div className="pointer-events-none absolute -right-12 -top-16 hidden h-40 w-40 rounded-full bg-amber-500/20 blur-3xl dark:block" />
				<button
					type="button"
					onClick={onClose}
					aria-label="모달 닫기"
					className="absolute right-4 top-4 rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 motion-reduce:transition-none dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
				>
					<X className="h-4 w-4" aria-hidden />
				</button>
				<div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-300">
					<Sparkles className="h-6 w-6" aria-hidden />
				</div>
				<p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
					Daily Free Quota
				</p>
				<h2 id="insights-ai-lock-title" className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
					오늘의 무료 횟수를 모두 사용했습니다
				</h2>
				<p id="insights-ai-lock-desc" className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
					오늘의 무료 AI 리서치 횟수({AI_SEARCH_DAILY_LIMIT}회)를 모두 사용하셨습니다. 로그인/가입 후 무제한으로 이용해 보세요!
				</p>
				<div className="mt-6 flex flex-col gap-2 sm:flex-row">
					<Link
						href="/login?callbackUrl=%2Finsights%3Ftab%3Dinsights"
						className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-sm shadow-cyan-500/20 transition hover:opacity-90 motion-reduce:transition-none"
					>
						로그인 / 가입하기
					</Link>
					<button
						type="button"
						onClick={onBackToFeed}
						className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 motion-reduce:transition-none dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
					>
						피드로 돌아가기
					</button>
				</div>
			</div>
		</div>
	);
}
