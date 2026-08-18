'use client';

/** Skeleton placeholders while /api/generate-geo-report is in flight. */
export function GeoNarrativeSkeleton() {
	return (
		<div className="flex flex-col gap-6" aria-busy="true" aria-label="Generating industry GEO narrative">
			{[0, 1, 2].map((block) => (
				<section
					key={block}
					className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] p-5 sm:p-6"
				>
					<div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
					<div className="mt-3 h-6 w-3/4 max-w-md animate-pulse rounded bg-slate-200 dark:bg-white/10" />
					<div className="mt-2 h-4 w-full max-w-xl animate-pulse rounded bg-slate-200 dark:bg-white/[0.06]" />
					<div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
						{[0, 1, 2].map((card) => (
							<div
								key={card}
								className="h-28 animate-pulse rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.04]"
							/>
						))}
					</div>
				</section>
			))}
			<p className="text-center text-[11px] text-slate-500">업종 맞춤 GEO 리포트 생성 중…</p>
		</div>
	);
}
