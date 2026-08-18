'use client';

import type { EngineAnalysisTag } from '@/types/geo-diagnostic';

interface EngineAnalysisTagChipsProps {
	tags: readonly EngineAnalysisTag[];
}

export function EngineAnalysisTagChips({ tags }: EngineAnalysisTagChipsProps) {
	if (!tags.length) return null;

	return (
		<ul className="flex min-w-0 flex-wrap gap-1">
			{tags.map((tag) => (
				<li key={tag.id}>
					<span
						className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-extrabold leading-relaxed ring-1 transition-colors duration-200 ${
							tag.polarity === 'positive'
								? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 ring-emerald-400/40'
								: 'bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200 ring-amber-400/45'
						}`}
					>
						<span className="truncate">#{tag.label}</span>
					</span>
				</li>
			))}
		</ul>
	);
}
