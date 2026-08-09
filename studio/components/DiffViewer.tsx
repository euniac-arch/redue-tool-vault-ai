import type { DiffLineModel } from '@/lib/types';

interface DiffViewerProps {
	filePath: string | null;
	diff: DiffLineModel[] | null;
}

const LINE_STYLES: Record<DiffLineModel['type'], string> = {
	add: 'bg-emerald-500/15 text-emerald-200',
	remove: 'bg-rose-500/15 text-rose-200',
	context: 'text-slate-400',
};

const GUTTER_SYMBOL: Record<DiffLineModel['type'], string> = {
	add: '+',
	remove: '-',
	context: ' ',
};

export function DiffViewer({ filePath, diff }: DiffViewerProps) {
	if (!diff || diff.length === 0) {
		return (
			<div className="rounded-xl border border-white/10 bg-black/20 p-6 text-sm text-slate-400">
				표시할 변경 사항이 없습니다.
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-xl border border-white/10">
			<div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-2 font-mono text-xs text-slate-300">
				<span aria-hidden>📄</span>
				{filePath ?? 'header.php'}
			</div>
			<div className="max-h-[560px] overflow-auto bg-black/30 font-mono text-[13px] leading-relaxed">
				{diff.map((line, index) => (
					<div key={index} className={`flex whitespace-pre ${LINE_STYLES[line.type]}`}>
						<span className="w-12 shrink-0 select-none border-r border-white/5 px-2 text-right text-slate-600">
							{line.oldLineNumber ?? ''}
						</span>
						<span className="w-12 shrink-0 select-none border-r border-white/5 px-2 text-right text-slate-600">
							{line.newLineNumber ?? ''}
						</span>
						<span className="w-5 shrink-0 select-none text-center font-bold">{GUTTER_SYMBOL[line.type]}</span>
						<span className="flex-1 px-2">{line.content.length ? line.content : ' '}</span>
					</div>
				))}
			</div>
		</div>
	);
}
