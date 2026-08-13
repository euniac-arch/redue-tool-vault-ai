'use client';

import type { SolvePageMeta } from '@/lib/solve/types';

export interface MenuStructurePanelProps {
	pageMetas: SolvePageMeta[];
	targetUrl: string;
	reanalyzing?: boolean;
	onReanalyze?: () => void;
	lastRefreshedAt?: string | null;
}

function gnbLabel(page: SolvePageMeta): string {
	const parts = [page.section, page.menu1, page.menu2].filter(
		(v, i, arr) => Boolean(v) && arr.indexOf(v) === i,
	);
	if (parts.length > 0) return parts.join(' › ');
	if (page.urlPath === '/' || !page.urlPath) return '메인';
	return page.title || page.urlPath;
}

export function MenuStructurePanel({
	pageMetas,
	targetUrl,
	reanalyzing = false,
	onReanalyze,
	lastRefreshedAt = null,
}: MenuStructurePanelProps) {
	const rows = pageMetas.length > 0 ? pageMetas : [];

	return (
		<section
			className="rounded-xl border border-slate-200 bg-white shadow-sm"
			aria-label="웹 사이트 메뉴 구조"
		>
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
				<div className="min-w-0">
					<p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
						DB Hydration · audit_payload
					</p>
					<h2 className="text-sm font-bold text-slate-900">웹 사이트 메뉴 / 페이지 구조</h2>
					<p className="mt-0.5 truncate text-xs text-slate-500" title={targetUrl}>
						GNB · URL · Title · Desc · H1 — 동적 PHP 스키마 매핑 원본
						{lastRefreshedAt ? (
							<span className="ml-1 text-emerald-600">· 갱신 {lastRefreshedAt}</span>
						) : null}
					</p>
				</div>
				{onReanalyze ? (
					<button
						type="button"
						onClick={onReanalyze}
						disabled={reanalyzing || !targetUrl}
						className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
					>
						<span aria-hidden>{reanalyzing ? '⏳' : '🔄'}</span>
						{reanalyzing ? '재분석 중…' : '메뉴구조 재분석'}
					</button>
				) : null}
			</div>

			{rows.length === 0 ? (
				<p className="px-4 py-6 text-center text-xs text-slate-400">
					진단 데이터의 메뉴/페이지 구조가 없습니다. 재분석으로 웹사이트를 다시 수집하세요.
				</p>
			) : (
				<div className="overflow-x-auto">
					<table className="min-w-full text-left text-xs">
						<thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
							<tr>
								<th className="whitespace-nowrap px-3 py-2">GNB</th>
								<th className="whitespace-nowrap px-3 py-2">URL</th>
								<th className="whitespace-nowrap px-3 py-2">Title</th>
								<th className="whitespace-nowrap px-3 py-2">Desc</th>
								<th className="whitespace-nowrap px-3 py-2">H1</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{rows.map((page, idx) => (
								<tr key={`${page.urlPath}-${idx}`} className="align-top hover:bg-slate-50/80">
									<td className="max-w-[10rem] px-3 py-2 font-semibold text-slate-800">
										{gnbLabel(page)}
									</td>
									<td className="max-w-[12rem] px-3 py-2 font-mono text-[11px] text-sky-800">
										{page.urlPath || '/'}
									</td>
									<td className="max-w-[14rem] px-3 py-2 text-slate-700" title={page.title || ''}>
										<span className="line-clamp-2">{page.title || '—'}</span>
									</td>
									<td
										className="max-w-[16rem] px-3 py-2 text-slate-500"
										title={page.description || ''}
									>
										<span className="line-clamp-2">{page.description || '—'}</span>
									</td>
									<td className="max-w-[12rem] px-3 py-2 font-medium text-slate-800" title={page.h1 || ''}>
										<span className="line-clamp-2">{page.h1 || '—'}</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{rows.length > 0 ? (
				<p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
					총 <strong className="font-bold text-slate-800">{rows.length}</strong>개 페이지 —
					로컬 폴더 선택 시 최우선 공통 헤더 1개에 전체 메인/서브페이지 동적 스키마로 통합 주입됩니다.
				</p>
			) : null}
		</section>
	);
}
