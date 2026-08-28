'use client';

import { useEffect, useRef } from 'react';
import { displayGnbLabel } from '@/lib/solve/page-meta-hydrate';
import { isCitationVirtualPage, isFaqGuidePage, isHowToGuidePage } from '@/lib/solve/core/eeat-citation';
import { getRootDeploySpec } from '@/lib/solve/geo-root-assets';
import { isNoiseSchemaPage, pageSelectionKey } from '@/lib/solve/page-selection';
import type { SolvePageMeta } from '@/lib/solve/types';

export interface MenuStructurePanelProps {
	pageMetas: SolvePageMeta[];
	targetUrl: string;
	reanalyzing?: boolean;
	onReanalyze?: () => void;
	lastRefreshedAt?: string | null;
	selectedKeys?: Set<string>;
	onTogglePage?: (key: string) => void;
	onSetAllPages?: (selected: boolean) => void;
	onChangeDescription?: (key: string, value: string) => void;
}

function gnbLabel(page: SolvePageMeta): string {
	return displayGnbLabel(page);
}

export function MenuStructurePanel({
	pageMetas,
	targetUrl,
	reanalyzing = false,
	onReanalyze,
	lastRefreshedAt = null,
	selectedKeys,
	onTogglePage,
	onSetAllPages,
	onChangeDescription,
}: MenuStructurePanelProps) {
	const rows = pageMetas.length > 0 ? pageMetas : [];
	const selectable = Boolean(selectedKeys && onTogglePage && onSetAllPages);
	const selectedCount = selectable
		? rows.filter((page) => selectedKeys!.has(pageSelectionKey(page))).length
		: rows.length;
	const allSelected = selectable && rows.length > 0 && selectedCount === rows.length;
	const someSelected = selectable && selectedCount > 0 && selectedCount < rows.length;
	const selectAllRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (selectAllRef.current) {
			selectAllRef.current.indeterminate = someSelected;
		}
	}, [someSelected]);

	return (
		<section
			className="rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700"
			aria-label="웹 사이트 메뉴 구조"
		>
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
				<div className="min-w-0">
					<p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
						DB Hydration · audit_payload
					</p>
					<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">웹 사이트 메뉴 / 페이지 구조</h2>
					<p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={targetUrl}>
						헤더 컨테이너 전수 스캔 · 1차&gt;2차 GNB · URL · Title · Desc(인라인 편집) · H1
						{lastRefreshedAt ? (
							<span className="ml-1 text-emerald-600">· 갱신 {lastRefreshedAt}</span>
						) : null}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{selectable && rows.length > 0 ? (
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => onSetAllPages?.(true)}
								className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
							>
								전체 선택
							</button>
							<button
								type="button"
								onClick={() => onSetAllPages?.(false)}
								className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
							>
								전체 해제
							</button>
						</div>
					) : null}
					{onReanalyze ? (
						<button
							type="button"
							onClick={onReanalyze}
							disabled={reanalyzing || !targetUrl}
							className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
						>
							<span aria-hidden>{reanalyzing ? '⏳' : '🔄'}</span>
							{reanalyzing ? '재분석 중…' : '메뉴구조 재분석'}
						</button>
					) : null}
				</div>
			</div>

			{rows.length === 0 ? (
				<p className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
					진단 데이터의 메뉴/페이지 구조가 없습니다. 재분석으로 웹사이트를 다시 수집하세요.
				</p>
			) : (
				<div className="overflow-x-auto">
					<table className="min-w-full text-left text-xs">
						<thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
							<tr>
								{selectable ? (
									<th className="whitespace-nowrap px-3 py-2">
										<label className="inline-flex items-center gap-1.5">
											<input
												ref={selectAllRef}
												type="checkbox"
												checked={allSelected}
												onChange={(e) => onSetAllPages?.(e.target.checked)}
												className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
												aria-label="전체 선택 / 전체 해제"
											/>
											선택
										</label>
									</th>
								) : null}
								<th className="whitespace-nowrap px-3 py-2">GNB</th>
								<th className="whitespace-nowrap px-3 py-2">URL</th>
								<th className="whitespace-nowrap px-3 py-2">Title</th>
								<th className="whitespace-nowrap px-3 py-2">Desc</th>
								<th className="whitespace-nowrap px-3 py-2">H1</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100 dark:divide-slate-700">
							{rows.map((page, idx) => {
								const key = pageSelectionKey(page);
								const checked = selectable ? selectedKeys!.has(key) : true;
								const noise = isNoiseSchemaPage(page);
								const rootSpec = getRootDeploySpec(page);
								return (
									<tr
										key={`${key}-${idx}`}
										className={`align-top hover:bg-slate-50/80  dark:hover:bg-slate-700 dark:hover:bg-slate-700/50${checked ? '' : 'bg-slate-50/60 opacity-70 dark:bg-slate-700/60'}`}
									>
										{selectable ? (
											<td className="px-3 py-2">
												<input
													type="checkbox"
													checked={checked}
													onChange={() => onTogglePage?.(key)}
													className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
													aria-label={`${gnbLabel(page)} 스키마 주입 선택`}
												/>
											</td>
										) : null}
										<td className="max-w-[10rem] px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">
											{gnbLabel(page)}
											{page.fromGnb && !rootSpec ? (
												<span className="ml-1 rounded bg-sky-50 px-1 py-0.5 text-[9px] font-bold tracking-wide text-sky-700">
													GNB
												</span>
											) : null}
											{isCitationVirtualPage(page) ? (
												<span className="ml-1 rounded bg-violet-50 px-1 py-0.5 text-[9px] font-bold tracking-wide text-violet-700">
													가상
												</span>
											) : null}
											{isFaqGuidePage(page) ? (
												<span className="ml-1 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold tracking-wide text-amber-800">
													FAQ
												</span>
											) : null}
											{isHowToGuidePage(page) && !isFaqGuidePage(page) ? (
												<span className="ml-1 rounded bg-teal-50 px-1 py-0.5 text-[9px] font-bold tracking-wide text-teal-800">
													HowTo
												</span>
											) : null}
											{rootSpec
												? rootSpec.badges.map((badge) => (
														<span
															key={badge}
															className={`ml-1 rounded px-1 py-0.5 text-[9px] font-bold tracking-wide ${
																badge.includes('루트')
																	? 'bg-emerald-50 text-emerald-700'
																	: badge.includes('GEO')
																		? 'bg-violet-50 text-violet-700'
																		: badge.includes('색인')
																			? 'bg-indigo-50 text-indigo-700'
																			: 'bg-sky-50 text-sky-700'
															}`}
														>
															{badge}
														</span>
													))
												: null}
											{noise ? (
												<span className="ml-1 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
													자동제외
												</span>
											) : null}
										</td>
										<td className="max-w-[12rem] px-3 py-2 font-mono text-[11px] text-sky-800">
											{page.urlPath || '/'}
										</td>
										<td className="max-w-[14rem] px-3 py-2 text-slate-700 dark:text-slate-200" title={page.title || ''}>
											<span className="line-clamp-2">{page.title || '—'}</span>
										</td>
										<td className="min-w-[14rem] max-w-[20rem] px-3 py-2 text-slate-600 dark:text-slate-300">
											{onChangeDescription ? (
												<textarea
													value={page.description || ''}
													onChange={(e) => onChangeDescription(key, e.target.value)}
													rows={2}
													className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] leading-snug text-slate-700 shadow-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
													aria-label={`${gnbLabel(page)} Description 편집`}
													placeholder="페이지 고유 Description"
												/>
											) : (
												<span className="line-clamp-2" title={page.description || ''}>
													{page.description || '—'}
												</span>
											)}
										</td>
										<td className="max-w-[12rem] px-3 py-2 font-medium text-slate-800 dark:text-slate-100" title={page.h1 || ''}>
											<span className="line-clamp-2">{page.h1 || '—'}</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{rows.length > 0 ? (
				<p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400 dark:border-slate-700">
					총 <strong className="font-bold text-slate-800 dark:text-slate-100">{rows.length}</strong>개 페이지 중{' '}
					<strong className="font-bold text-sky-800">{selectedCount}</strong>개 선택됨
					<span className="text-slate-400 dark:text-slate-500">
						{' '}
						(선택된 HTML 페이지는 헤더 스키마, 루트 파일은 개별 배포)
					</span>
					{selectable && selectedCount === 0 ? (
						<span className="ml-1 font-semibold text-amber-700">
							· 선택된 페이지가 없습니다. 최소 1개 이상을 체크하세요.
						</span>
					) : null}
				</p>
			) : null}
		</section>
	);
}
