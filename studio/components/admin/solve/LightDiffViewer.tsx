'use client';

import type { DiffLineModel } from '@/lib/types';

interface LightDiffViewerProps {
	filePath?: string | null;
	diff: DiffLineModel[] | null;
	emptyMessage?: string;
}

const LINE_STYLES: Record<DiffLineModel['type'], string> = {
	add: 'bg-emerald-50 text-emerald-900',
	remove: 'bg-rose-50 text-rose-900',
	context: 'text-slate-600',
};

const GUTTER_SYMBOL: Record<DiffLineModel['type'], string> = {
	add: '+',
	remove: '-',
	context: ' ',
};

/** Admin light-theme Diff viewer (ported from inspector patch Diff UI). */
export function LightDiffViewer({
	filePath,
	diff,
	emptyMessage = '표시할 변경 사항이 없습니다.',
}: LightDiffViewerProps) {
	if (!diff || diff.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
				{emptyMessage}
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
			{filePath ? (
				<div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-semibold text-slate-700">
					{filePath}
				</div>
			) : null}
			<div className="max-h-[420px] overflow-auto font-mono text-[12px] leading-relaxed">
				{diff.map((line, index) => (
					<div key={index} className={`flex whitespace-pre ${LINE_STYLES[line.type]}`}>
						<span className="w-10 shrink-0 select-none border-r border-slate-100 px-1.5 text-right text-slate-400">
							{line.oldLineNumber ?? ''}
						</span>
						<span className="w-10 shrink-0 select-none border-r border-slate-100 px-1.5 text-right text-slate-400">
							{line.newLineNumber ?? ''}
						</span>
						<span className="w-4 shrink-0 select-none text-center font-bold text-slate-500">
							{GUTTER_SYMBOL[line.type]}
						</span>
						<span className="flex-1 px-2">{line.content.length ? line.content : ' '}</span>
					</div>
				))}
			</div>
		</div>
	);
}
