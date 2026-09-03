'use client';

import type { FormEvent, ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DiagnosticStepBanner } from '@/components/ai-search-intelligence/common/DiagnosticStepBanner';
import { AsiBoundTargetBadge } from '@/components/ai-search-intelligence/primitives/AsiBoundTargetBadge';
import { AsiBilingualTitle, AsiCategoryBadge } from '@/components/ai-search-intelligence/primitives/AsiBilingualTitle';
import { AsiEmptyState, AsiErrorNote, AsiLoadingState } from '@/components/ai-search-intelligence/primitives/AsiEmptyState';
import { AsiProvenanceLegend } from '@/components/ai-search-intelligence/primitives/AsiProvenanceLegend';
import { AsiReveal } from '@/components/ai-search-intelligence/primitives/AsiReveal';
import { AsiSourceBadge } from '@/components/ai-search-intelligence/primitives/AsiSourceBadge';
import { useIntelligence } from '@/components/ai-search-intelligence/shell/IntelligenceContext';
import { useElapsedSeconds } from '@/lib/ai-search-intelligence/client/use-elapsed-seconds';
import { useActiveIntelligenceTool } from '@/lib/ai-search-intelligence/use-intelligence-tool';
import type { AsiSource } from '@/lib/ai-search-intelligence/types';
import { ASI_KICKER } from '@/lib/ui/asi-chrome';

export function AsiPageChrome({
	source,
	loading,
	onCancel,
	cancelLabel,
	error,
	boundNote,
	hasResult,
	elapsedSeconds,
	children,
}: {
	kicker?: string;
	title?: string;
	subtitle?: string;
	source?: AsiSource;
	/** @deprecated Local URL inputs were removed; the shared top-bar `targetUrl` is the only source. */
	inputId?: string;
	url?: string;
	onUrlChange?: (value: string) => void;
	/** @deprecated Tool panels no longer submit analysis; the top-bar [AI 인텔리전스 분석] is the only trigger. */
	onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
	urlLabel?: string;
	urlPlaceholder?: string;
	submitLabel?: string;
	submittingLabel?: string;
	loading: boolean;
	onCancel?: () => void;
	cancelLabel?: string;
	error: string | null;
	boundNote?: string | null;
	/** @deprecated Empty copy is shared via intelligence.ux.waiting*. */
	emptyTitle?: string;
	emptyBody?: string;
	hasResult: boolean;
	elapsedSeconds?: number;
	children: ReactNode;
}) {
	const t = useTranslations('intelligence.ux');
	const { lastError, currentSite, selectedToolId, modules, isBatchRunning, runSingleToolAnalysis } = useIntelligence();
	const tool = useActiveIntelligenceTool();
	const toolLoading = loading || modules[selectedToolId]?.isLoading === true;
	const localElapsed = useElapsedSeconds(toolLoading);
	const elapsed = elapsedSeconds ?? localElapsed;
	const notice = error || lastError;
	const isAnalyzed = hasResult;
	const canRunTool = Boolean(currentSite) && !isBatchRunning && !toolLoading;

	return (
		<AsiReveal className="flex flex-col gap-6">
			<section className="flex flex-col gap-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<p className={ASI_KICKER}>
							<AsiCategoryBadge categoryKo={tool.categoryKo} categoryEn={tool.categoryEn} />
						</p>
						<AsiBilingualTitle as="h2" size="detail" className="mt-2" titleKo={tool.titleKo} titleEn={tool.titleEn} />
						<p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
							{tool.subDescription}
						</p>
					</div>
					{source ? <AsiSourceBadge source={source} /> : null}
				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<div className="min-w-0 flex-1">
						<AsiBoundTargetBadge />
					</div>
					<button
						type="button"
						disabled={!canRunTool}
						onClick={() => void runSingleToolAnalysis(selectedToolId)}
						className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
					>
						{toolLoading ? (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
						) : (
							<RefreshCw className="h-4 w-4" aria-hidden />
						)}
						<span className="whitespace-nowrap">{isAnalyzed ? t('refreshTool') : t('analyzeThisTool')}</span>
					</button>
					{toolLoading && onCancel ? (
						<button
							type="button"
							onClick={onCancel}
							className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
						>
							{cancelLabel || t('cancel')}
						</button>
					) : null}
				</div>
				{notice ? <AsiErrorNote message={notice} /> : null}
				{boundNote ? <p className="text-xs text-slate-500 dark:text-slate-400">{boundNote}</p> : null}
				{toolLoading ? (
					<DiagnosticStepBanner
						elapsedSeconds={elapsed}
						parse={t('loading')}
						estimate={t('loadingHint')}
						wait={t('loadingWait')}
					/>
				) : null}
			</section>
			{isAnalyzed ? (
				<>
					<AsiProvenanceLegend />
					{children}
				</>
			) : toolLoading ? (
				<AsiLoadingState title={t('loading')} hint={t('loadingHint')} />
			) : (
				<AsiEmptyState title={t('waitingTitle')} body={t('waitingBody')} />
			)}
		</AsiReveal>
	);
}
