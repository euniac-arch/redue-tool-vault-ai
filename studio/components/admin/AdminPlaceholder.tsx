import type { ReactNode } from 'react';

interface AdminPlaceholderProps {
	title: string;
	description: string;
	path: string;
	badge?: string;
}

export function AdminPlaceholder({
	title,
	description,
	path,
	badge = '준비 중',
}: AdminPlaceholderProps): ReactNode {
	return (
		<main className="flex flex-col gap-4">
			<div>
				<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{badge}</p>
				<h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
				<p className="mt-1 text-sm text-slate-600">{description}</p>
			</div>
			<div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-sm text-slate-500">
				<p>
					이 메뉴는 관리자 레이아웃에 연결되어 있으며, 기능 구현은 후속 작업에서 진행됩니다.
				</p>
				<p className="mt-2 font-mono text-xs text-slate-400">{path}</p>
			</div>
		</main>
	);
}
