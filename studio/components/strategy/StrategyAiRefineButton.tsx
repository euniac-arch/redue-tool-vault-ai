'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { highlightKeywordMarks, readableRefineText } from '@/components/strategy/strategy-highlight';
import type { CopilotRefineResponse, CopilotRefineTarget, StrategyCopilotContext } from '@/lib/strategy/types';

export function StrategyAiRefineButton({
	target,
	context,
	onApply,
}: {
	target: CopilotRefineTarget;
	context: StrategyCopilotContext;
	onApply: (target: CopilotRefineTarget, text: string) => void;
}) {
	const t = useTranslations('strategyStudio');
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [draft, setDraft] = useState<CopilotRefineResponse | null>(null);
	const [error, setError] = useState('');

	async function refine() {
		setLoading(true);
		setError('');
		setOpen(true);
		try {
			const res = await fetch('/api/strategy/copilot', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ context }),
			});
			const data = (await res.json()) as CopilotRefineResponse & { error?: string };
			if (!res.ok || !data.refinedText) {
				throw new Error(data.error || t('copilotError'));
			}
			setDraft(data);
		} catch (err) {
			setDraft(null);
			setError(err instanceof Error ? err.message : t('copilotError'));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => void refine()}
				disabled={loading}
				className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-600 transition hover:border-slate-900 hover:text-slate-900 disabled:opacity-60 dark:border-white/20 dark:text-slate-300 dark:hover:border-white dark:hover:text-white"
			>
				{loading ? t('copilotLoading') : t('copilotImprove')}
			</button>
			{open ? (
				<div className="absolute right-0 z-20 mt-2 w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 dark:border-[#1f3a5a] dark:bg-[#0b1726] max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:right-auto max-sm:top-auto max-sm:mt-0 max-sm:w-auto">
					<p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('copilotDraft')}</p>
					{error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
					{draft ? (
						<>
							<div className="mt-3 max-h-[min(28rem,60vh)] overflow-y-auto break-keep font-['Pretendard',sans-serif] text-[15px] leading-7 tracking-tight text-slate-800 dark:text-slate-100">
								{readableRefineText(draft.refinedText)
									.split('\n')
									.map((line, index) => (
										<p key={`${index}-${line.slice(0, 12)}`} className={line.trim() ? 'mb-3 last:mb-0' : 'mb-2 h-2'}>
											{highlightKeywordMarks(line, context.keyword)}
										</p>
									))}
							</div>
							{draft.warning ? <p className="mt-2 text-[11px] text-slate-500">{draft.warning}</p> : null}
							<p className="mt-1 text-[10px] uppercase text-slate-400">{draft.provider}</p>
							<div className="mt-3 flex gap-2">
								<button
									type="button"
									className="rounded-md bg-slate-900 px-3 py-1 text-[11px] font-bold text-white dark:bg-cyan-400 dark:text-slate-950"
									onClick={() => {
										onApply(target, draft.refinedText);
										setOpen(false);
										setDraft(null);
									}}
								>
									{t('copilotApply')}
								</button>
								<button
									type="button"
									className="rounded-md border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"
									onClick={() => {
										setOpen(false);
										setDraft(null);
									}}
								>
									{t('copilotDiscard')}
								</button>
							</div>
						</>
					) : null}
					{!draft && !error && loading ? <p className="mt-2 text-xs text-slate-500">{t('copilotLoading')}</p> : null}
				</div>
			) : null}
		</div>
	);
}
