export interface SolveSummaryBarProps {
	url: string;
	defectCount: number;
	schemaCoveragePercent: number;
	overallScore?: number;
	reanalyzing?: boolean;
	onReanalyzeMenu?: () => void;
}

export function SolveSummaryBar({
	url,
	defectCount,
	schemaCoveragePercent,
	overallScore,
	reanalyzing = false,
	onReanalyzeMenu,
}: SolveSummaryBarProps) {
	const coverageTone =
		schemaCoveragePercent >= 80
			? 'bg-emerald-50 text-emerald-700 border-emerald-200'
			: schemaCoveragePercent >= 50
				? 'bg-amber-50 text-amber-800 border-amber-200'
				: 'bg-rose-50 text-rose-700 border-rose-200';

	return (
		<section
			className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
			aria-label="진단 요약"
		>
			<div className="min-w-0 flex-1">
				<p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">선택된 URL</p>
				<p className="truncate text-sm font-semibold text-slate-900" title={url}>
					{url || 'URL이 선택되지 않았습니다'}
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				{overallScore != null ? (
					<span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700">
						점수
						<span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-extrabold text-white tabular-nums">
							{overallScore}
						</span>
					</span>
				) : null}

				<span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">
					결함
					<span className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
						{defectCount}
					</span>
				</span>

				<span
					className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${coverageTone}`}
				>
					스키마 커버리지
					<span className="font-extrabold tabular-nums">{schemaCoveragePercent}%</span>
				</span>

				{onReanalyzeMenu ? (
					<button
						type="button"
						onClick={onReanalyzeMenu}
						disabled={reanalyzing || !url}
						className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<span aria-hidden>{reanalyzing ? '⏳' : '🔄'}</span>
						{reanalyzing ? '재분석 중…' : '웹 사이트 메뉴구조 재분석'}
					</button>
				) : null}
			</div>
		</section>
	);
}
