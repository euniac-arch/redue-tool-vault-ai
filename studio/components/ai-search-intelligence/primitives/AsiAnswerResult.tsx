'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import { AsiMetricTooltip } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiSourceBadge } from '@/components/ai-search-intelligence/primitives/AsiSourceBadge';
import { observedBadgeForSource } from '@/lib/ai-search-intelligence/provenance';
import type { AsiEngineId, AsiMentionType, AsiSource } from '@/lib/ai-search-intelligence/types';
import { ASI_BADGE, ASI_HOVER_MOTION, ASI_SECTION_KICKER } from '@/lib/ui/asi-chrome';

const MENTION_TONE: Record<AsiMentionType, string> = {
	none: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300',
	simple_mention:
		'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
	recommended:
		'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
};

export function AsiAnswerResult({
	engine,
	snippet,
	mentionType,
	source,
	fallback,
	error,
	kicker,
	children,
}: {
	engine?: AsiEngineId;
	snippet: string;
	mentionType?: AsiMentionType;
	source?: AsiSource;
	fallback?: boolean;
	error?: string;
	kicker?: string;
	children?: ReactNode;
}) {
	const t = useTranslations('intelligence.warRoom');
	const tUx = useTranslations('intelligence.ux');
	const Glyph = engine ? ENGINE_GLYPH[engine] : null;

	return (
		<article className={`rounded-xl border border-slate-200 px-3 py-3 ${ASI_HOVER_MOTION} hover:border-cyan-300/80 dark:border-slate-800 dark:hover:border-cyan-700/70`}>
			<div className="flex flex-wrap items-center gap-2">
				{Glyph && engine ? (
					<span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
						<Glyph className="h-3.5 w-3.5" />
					</span>
				) : null}
				{engine ? (
					<p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t(`engine.${engine}`)}</p>
				) : null}
				{kicker ? (
					<p className={ASI_SECTION_KICKER}>{kicker}</p>
				) : null}
				<AsiProvenanceBadge badge={observedBadgeForSource(source, fallback, 'answer')} />
				<AsiMetricTooltip metric="actualAnswer" label={kicker || (engine ? t(`engine.${engine}`) : t('citationTitle'))} />
				{mentionType ? (
					<span className={`${ASI_BADGE} ${MENTION_TONE[mentionType]}`}>
						{t(`mention.${mentionType}`)}
					</span>
				) : null}
				{source ? <AsiSourceBadge source={source} /> : null}
			</div>
			<p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{snippet}</p>
			{error ? <p className="mt-2 text-xs text-violet-700 dark:text-violet-300">{tUx('analyzeFailed')}</p> : null}
			{children}
		</article>
	);
}
