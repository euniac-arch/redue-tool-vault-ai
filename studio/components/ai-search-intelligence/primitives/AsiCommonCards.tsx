'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ENGINE_GLYPH } from '@/components/audit/AiEngineIcons';
import { AsiCard } from '@/components/ai-search-intelligence/primitives/AsiCard';
import { AsiEmptyState, AsiErrorNote, AsiLoadingState } from '@/components/ai-search-intelligence/primitives/AsiEmptyState';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import { AsiScore } from '@/components/ai-search-intelligence/primitives/AsiScore';
import { AsiSourceBadge } from '@/components/ai-search-intelligence/primitives/AsiSourceBadge';
import type { AsiEngineId, AsiWarRoomCompetitor } from '@/lib/ai-search-intelligence/types';
import { ASI_BADGE, ASI_CTA, ASI_HOVER_MOTION, ASI_SECTION_KICKER } from '@/lib/ui/asi-chrome';

export function AsiProviderBadge({ engine }: { engine: AsiEngineId }) {
	const Glyph = ENGINE_GLYPH[engine];
	return (
		<span className="inline-flex items-center gap-1.5">
			<span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
				<Glyph className="h-3.5 w-3.5" />
			</span>
		</span>
	);
}

export function AsiStatusBadge({
	source,
	live,
}: {
	source?: Parameters<typeof AsiSourceBadge>[0]['source'];
	live?: boolean;
}) {
	if (source) return <AsiSourceBadge source={source} />;
	return <AsiProvenanceBadge kind={live ? 'observed' : 'derived'} />;
}

export function AsiQueryCard({
	query,
	kicker,
	selected,
	onToggle,
	href,
	actionLabel,
}: {
	query: string;
	kicker?: string;
	selected?: boolean;
	onToggle?: () => void;
	href?: string;
	actionLabel?: string;
}) {
	return (
		<li
			className={`flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-3 ${ASI_HOVER_MOTION} hover:border-cyan-300 dark:border-slate-800 dark:hover:border-cyan-700 sm:flex-row sm:items-center sm:justify-between`}
		>
			<label className="flex min-w-0 cursor-pointer items-start gap-3">
				{onToggle ? (
					<input
						type="checkbox"
						checked={Boolean(selected)}
						onChange={onToggle}
						className="mt-1 h-4 w-4 accent-cyan-600"
					/>
				) : null}
				<div className="min-w-0">
					<p className="inline-flex flex-wrap items-center gap-1.5">
						{kicker ? <span className={ASI_SECTION_KICKER}>{kicker}</span> : null}
						<AsiProvenanceBadge badge="redue_analysis" />
					</p>
					<p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{query}</p>
				</div>
			</label>
			{href ? (
				<Link href={href} className={`${ASI_CTA} h-10 px-4 text-xs`}>
					{actionLabel || '→'}
				</Link>
			) : null}
		</li>
	);
}

export function AsiCitationCard({
	kicker,
	title,
	children,
	cited,
}: {
	kicker?: string;
	title: string;
	children: ReactNode;
	cited?: boolean;
}) {
	return (
		<AsiCard
			kicker={kicker}
			title={title}
			provenance="observed"
			badge={cited ? 'observed' : 'estimated'}
			metric="actualCitation"
		>
			{children}
		</AsiCard>
	);
}

export function AsiCompetitorCard({
	brandName,
	competitor,
}: {
	brandName: string;
	competitor: AsiWarRoomCompetitor;
}) {
	return (
		<AsiCard kicker={brandName} title={competitor.name} provenance="derived" badge="estimated" metric="coRecommend">
			<div className="flex flex-wrap gap-3">
				<AsiScore value={competitor.coRecommend} label="Co-recommend" metric="coRecommend" size="sm" />
				<AsiScore value={competitor.sharePercent} label="Share" metric="shareOfVoice" size="sm" />
				<span className={ASI_BADGE}>{competitor.intensity}</span>
			</div>
		</AsiCard>
	);
}

export function AsiErrorState({ title, message }: { title?: string; message: string }) {
	return (
		<section className="rounded-xl border border-rose-200 px-4 py-3 dark:border-rose-900/60">
			{title ? <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{title}</p> : null}
			<AsiErrorNote message={message} />
		</section>
	);
}

export { AsiEmptyState, AsiLoadingState, AsiErrorNote, AsiScore as AsiKpiStat };
