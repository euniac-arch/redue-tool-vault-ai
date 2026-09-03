import type { ReactNode } from 'react';
import Link from 'next/link';
import { AsiMetricTooltip } from '@/components/ai-search-intelligence/primitives/AsiMetricTooltip';
import { AsiProvenanceBadge } from '@/components/ai-search-intelligence/primitives/AsiProvenanceBadge';
import type { AsiMetricId, AsiProvenance, AsiProvenanceBadgeId } from '@/lib/ai-search-intelligence/provenance';
import { ASI_CARD, ASI_CARD_HOVER, ASI_SECTION_KICKER, asiFocusRing } from '@/lib/ui/asi-chrome';

export function AsiCard({
	kicker,
	title,
	meta,
	href,
	actionLabel,
	children,
	className = '',
	provenance,
	badge,
	metric,
}: {
	kicker?: string;
	title?: string;
	meta?: string;
	href?: string;
	actionLabel?: string;
	children: ReactNode;
	className?: string;
	provenance?: AsiProvenance;
	badge?: AsiProvenanceBadgeId;
	metric?: AsiMetricId;
}) {
	const showHeader = Boolean(kicker || title || meta || href || provenance || badge);

	return (
		<section className={`${ASI_CARD} ${ASI_CARD_HOVER} p-4 sm:p-5 ${className}`.trim()}>
			{showHeader ? (
				<header className="mb-4 flex flex-wrap items-start justify-between gap-2">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-1.5">
							{kicker ? <p className={ASI_SECTION_KICKER}>{kicker}</p> : null}
							{provenance || badge ? <AsiProvenanceBadge kind={provenance} badge={badge} /> : null}
						</div>
						{title ? (
							<h2 className="mt-1 inline-flex flex-wrap items-center gap-1 text-sm font-bold text-slate-900 dark:text-white">
								{title}
								{metric ? <AsiMetricTooltip metric={metric} label={title} /> : null}
							</h2>
						) : null}
						{meta ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meta}</p> : null}
					</div>
					{href ? (
						<Link
							href={href}
							className={asiFocusRing(
								'shrink-0 rounded-sm text-xs font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300',
							)}
						>
							{actionLabel || '→'}
						</Link>
					) : null}
				</header>
			) : null}
			<div className="min-w-0">{children}</div>
		</section>
	);
}
