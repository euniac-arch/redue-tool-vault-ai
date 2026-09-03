'use client';

type GuideUtilityBarProps = {
	slug: string;
	onPrint: () => void;
	onCopy: () => void;
	copied: boolean;
};

export function GuideUtilityBar({ slug, onPrint, onCopy, copied }: GuideUtilityBarProps) {
	const path = slug.trim() ? `/guide/${slug.trim().toLowerCase()}` : '/guide/…';

	return (
		<div className="guide-no-print fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
			<div className="min-w-0">
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">REDUE 맞춤형 실행 가이드</p>
				<p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{path}</p>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onClick={onCopy}
					disabled={!slug.trim()}
					className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
				>
					{copied ? '링크 복사됨' : '공유 링크 복사'}
				</button>
				<button
					type="button"
					onClick={onPrint}
					className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
				>
					PDF 다운로드/인쇄
				</button>
			</div>
		</div>
	);
}
