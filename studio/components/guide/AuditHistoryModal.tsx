'use client';

import { History, Loader2, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
	clearGuestAudits,
	notifyAuditHistorySync,
	rememberDeletedAuditIds,
} from '@/lib/audit-history-storage';
import { loadLatestAuditPayload } from '@/lib/audit/latest-audit-payload';
import { useAuditHistory } from '@/lib/audit/use-audit-history';
import {
	filterGuideHistoryRows,
	formatGuideHistoryTime,
	mergeLatestIntoHistory,
	toGuideHistoryRow,
	type GuideHistoryRow,
} from '@/lib/guide/history-picker';

type AuditHistoryModalProps = {
	open: boolean;
	onClose: () => void;
	onSelect: (row: GuideHistoryRow) => void;
	selectingId?: string | null;
};

export function AuditHistoryModal({ open, onClose, onSelect, selectingId }: AuditHistoryModalProps) {
	const { historyList, loadHistory, loading } = useAuditHistory();
	const [query, setQuery] = useState('');

	useEffect(() => {
		if (!open) return;
		void loadHistory({ quiet: true });
		setQuery('');
	}, [open, loadHistory]);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	const rows = useMemo(() => {
		const merged = mergeLatestIntoHistory(historyList, loadLatestAuditPayload());
		return merged.map((entry) => {
			try {
				return toGuideHistoryRow(entry);
			} catch {
				return null;
			}
		}).filter((row): row is GuideHistoryRow => Boolean(row?.url));
	}, [historyList]);

	const filtered = useMemo(() => filterGuideHistoryRows(rows, query), [rows, query]);

	function handleClear() {
		if (rows.length === 0) return;
		if (!window.confirm('이 브라우저에 저장된 진단 목록을 모두 비울까요? 서버 원본은 유지됩니다.')) return;
		rememberDeletedAuditIds(rows.map((row) => row.id));
		clearGuestAudits();
		notifyAuditHistorySync({ all: true, ids: rows.map((row) => row.id) });
		void loadHistory({ quiet: true });
	}

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<button type="button" aria-label="닫기" className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="audit-history-modal-title"
				className="relative z-10 flex max-h-[min(720px,86vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
			>
				<div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Audit history</p>
						<h2 id="audit-history-modal-title" className="mt-0.5 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
							<History className="h-5 w-5" aria-hidden />
							진단 목록에서 선택
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
						aria-label="모달 닫기"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-slate-800">
					<label className="relative min-w-[200px] flex-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="상호명 또는 URL 검색"
							className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
						/>
					</label>
					<button
						type="button"
						onClick={handleClear}
						disabled={rows.length === 0}
						className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
					>
						<Trash2 className="h-3.5 w-3.5" />
						목록 비우기
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-auto px-5 py-4">
					{loading && rows.length === 0 ? (
						<p className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
							<Loader2 className="h-4 w-4 animate-spin" />
							진단 이력을 불러오는 중입니다…
						</p>
					) : filtered.length === 0 ? (
						<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-950/40">
							<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
								{rows.length === 0
									? '저장된 진단 이력이 없습니다. 먼저 사이트 정밀 진단을 진행해주세요.'
									: '검색 조건에 맞는 진단이 없습니다.'}
							</p>
							<p className="mt-1 text-xs text-slate-500">스튜디오에서 사이트를 진단하면 이 목록에 자동으로 쌓입니다.</p>
						</div>
					) : (
						<ul className="space-y-2">
							{filtered.map((row) => {
								const busy = selectingId === row.id;
								return (
									<li
										key={row.id}
										className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"
									>
										<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
											<div className="min-w-0">
												<p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{row.brandName}</p>
												<p className="mt-0.5 truncate text-xs text-slate-500">{row.url}</p>
												<p className="mt-1 text-[11px] font-medium text-slate-400">
													{formatGuideHistoryTime(row.timestamp)}
												</p>
												<div className="mt-2 flex flex-wrap gap-1.5">
													<span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:bg-sky-950/70 dark:text-sky-200">
														SEO {row.seoScore}/{row.seoMaxScore}
													</span>
													<span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-800 dark:bg-violet-950/70 dark:text-violet-200">
														AI TRUST {row.aiTrustScore}
													</span>
												</div>
											</div>
											<button
												type="button"
												disabled={!row.hasReport || busy}
												onClick={() => onSelect(row)}
												className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
											>
												{busy ? '불러오는 중…' : row.hasReport ? '선택하여 불러오기' : '리포트 없음'}
											</button>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</div>
		</div>
	);
}
