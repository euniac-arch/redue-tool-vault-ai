'use client';

import type { FormEvent, ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DiagnosticStepBanner } from '@/components/ai-search-intelligence/common/DiagnosticStepBanner';
import { AsiCta } from '@/components/ai-search-intelligence/primitives/AsiCta';
import { AsiEmptyState, AsiErrorNote, AsiLoadingState } from '@/components/ai-search-intelligence/primitives/AsiEmptyState';
import { AsiProvenanceLegend } from '@/components/ai-search-intelligence/primitives/AsiProvenanceLegend';
import { AsiReveal } from '@/components/ai-search-intelligence/primitives/AsiReveal';
import { AsiSourceBadge } from '@/components/ai-search-intelligence/primitives/AsiSourceBadge';
import { useElapsedSeconds } from '@/lib/ai-search-intelligence/client/use-elapsed-seconds';
import type { AsiSource } from '@/lib/ai-search-intelligence/types';
import { ASI_KICKER } from '@/lib/ui/asi-chrome';

export function AsiPageChrome({
	kicker,
	title,
	subtitle,
	source,
	inputId,
	url,
	onUrlChange,
	onSubmit,
	urlLabel,
	urlPlaceholder,
	submitLabel,
	submittingLabel,
	loading,
	onCancel,
	cancelLabel,
	error,
	boundNote,
	emptyTitle,
	emptyBody,
	hasResult,
	elapsedSeconds,
	children,
}: {
	kicker: string;
	title: string;
	subtitle: string;
	source?: AsiSource;
	inputId: string;
	url: string;
	onUrlChange: (value: string) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	urlLabel: string;
	urlPlaceholder: string;
	submitLabel: string;
	submittingLabel: string;
	loading: boolean;
	onCancel?: () => void;
	cancelLabel?: string;
	error: string | null;
	boundNote?: string | null;
	emptyTitle: string;
	emptyBody: string;
	hasResult: boolean;
	elapsedSeconds?: number;
	children: ReactNode;
}) {
	const t = useTranslations('intelligence.ux');
	const localElapsed = useElapsedSeconds(loading);
	const elapsed = elapsedSeconds ?? localElapsed;

	return (
		<AsiReveal className="flex flex-col gap-6">
			<section className="flex flex-col gap-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<p className={ASI_KICKER}>{kicker}</p>
						<h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
							{title}
						</h2>
						<p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{subtitle}</p>
					</div>
					{source ? <AsiSourceBadge source={source} /> : null}
				</div>
				<form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<label className="sr-only" htmlFor={inputId}>
						{urlLabel}
					</label>
					<div className="relative min-w-0 flex-1">
						<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<input
							id={inputId}
							type="url"
							inputMode="url"
							autoComplete="url"
							value={url}
							onChange={(event) => onUrlChange(event.target.value)}
							placeholder={urlPlaceholder}
							className="theme-input h-11 pl-10"
						/>
					</div>
					<AsiCta disabled={loading}>{loading ? submittingLabel : submitLabel}</AsiCta>
					{loading && onCancel ? (
						<button
							type="button"
							onClick={onCancel}
							className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
						>
							{cancelLabel || t('cancel')}
						</button>
					) : null}
				</form>
				{error ? <AsiErrorNote message={error} /> : null}
				{boundNote ? <p className="text-xs text-slate-500 dark:text-slate-400">{boundNote}</p> : null}
				{loading ? (
					<DiagnosticStepBanner
						elapsedSeconds={elapsed}
						parse={t('loading')}
						estimate={t('loadingHint')}
						wait={t('loadingWait')}
					/>
				) : null}
			</section>
			{hasResult ? (
				<>
					<AsiProvenanceLegend />
					{children}
				</>
			) : loading ? (
				<AsiLoadingState title={t('loading')} hint={t('loadingHint')} />
			) : (
				<AsiEmptyState title={emptyTitle} body={emptyBody} />
			)}
		</AsiReveal>
	);
}
