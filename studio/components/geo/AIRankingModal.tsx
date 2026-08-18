'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AIRankingPanel } from '@/components/geo/AIRankingPanel';

export interface AIRankingModalProps {
	open: boolean;
	onClose: () => void;
}

export function AIRankingModal({ open, onClose }: AIRankingModalProps) {
	const t = useTranslations('audit.aiRankingModal');
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onCloseRef.current();
		};
		window.addEventListener('keydown', onKeyDown);
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = prevOverflow;
		};
	}, [open]);

	if (!open) return null;

	return (
		<div
			className="print:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="ai-ranking-modal-title"
			aria-describedby="ai-ranking-modal-subtitle"
			onClick={() => onCloseRef.current()}
		>
			<div
				className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0B1028] sm:max-h-[85vh] sm:rounded-2xl"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-6">
					<div className="min-w-0">
						<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]">
							{t('kicker')}
						</p>
						<h2
							id="ai-ranking-modal-title"
							className="mt-1 text-base font-extrabold leading-snug text-slate-900 dark:text-white sm:text-lg"
						>
							{t('title')}
						</h2>
					</div>
					<button
						type="button"
						onClick={() => onCloseRef.current()}
						className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
						aria-label={t('closeAria')}
					>
						<X className="h-4 w-4" aria-hidden />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
					<AIRankingPanel />
				</div>
			</div>
		</div>
	);
}
