'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Checklist } from './Checklist';
import { ScoreBadge } from './ScoreBadge';
import type { DiagnosticReport } from '@/lib/types';

export interface HistoryRow {
	id: string;
	targetDomain: string;
	cmsType: string;
	patchedAt: string;
	score: number;
	maxScore: number;
	statusLabel: string;
	diagnosticsJson: string;
	hasBackup: boolean;
}

export function MypageHistoryTable({ rows }: { rows: HistoryRow[] }) {
	const t = useTranslations('mypage');
	const tt = useTranslations('mypage.table');
	const locale = useLocale();
	const [detailRow, setDetailRow] = useState<HistoryRow | null>(null);

	if (rows.length === 0) {
		return <p className="text-sm text-slate-500">{t('noHistory')}</p>;
	}

	return (
		<>
			<div className="overflow-x-auto rounded-xl border border-white/[0.08]">
				<table className="w-full text-left text-sm">
					<thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-4 py-3">{tt('target')}</th>
							<th className="px-4 py-3">{tt('cms')}</th>
							<th className="px-4 py-3">{tt('patchedAt')}</th>
							<th className="px-4 py-3">{tt('score')}</th>
							<th className="px-4 py-3">{tt('backup')}</th>
							<th className="px-4 py-3">{tt('detail')}</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.id} className="border-t border-white/[0.08]">
								<td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-slate-300">{row.targetDomain}</td>
								<td className="px-4 py-3">
									<span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent-light">
										{row.cmsType}
									</span>
								</td>
								<td className="px-4 py-3 text-xs text-slate-400">
									{new Date(row.patchedAt).toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR')}
								</td>
								<td className="px-4 py-3 text-xs font-bold text-emerald-400">
									{row.score} / {row.maxScore}
								</td>
								<td className="px-4 py-3">
									{row.hasBackup ? (
										<a
											href={`/api/mypage/backup/${row.id}`}
											className="rounded-lg border border-white/[0.08] bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
										>
											{tt('downloadBackup')}
										</a>
									) : (
										<span className="text-xs text-slate-600">-</span>
									)}
								</td>
								<td className="px-4 py-3">
									<button
										onClick={() => setDetailRow(row)}
										className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20"
									>
										{tt('viewDetail')}
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{detailRow && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
					onClick={() => setDetailRow(null)}
				>
					<div
						className="flex max-h-[85vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0C0D0E] p-6"
						onClick={(event) => event.stopPropagation()}
					>
						<div className="flex items-start justify-between gap-4">
							<div>
								<h2 className="text-lg font-bold text-white">{tt('viewDetail')}</h2>
								<p className="mt-1 truncate font-mono text-xs text-slate-500">{detailRow.targetDomain}</p>
							</div>
							<button
								onClick={() => setDetailRow(null)}
								className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-sm text-slate-400 hover:bg-white/10"
							>
								✕
							</button>
						</div>
						{(() => {
							const diagnostics: DiagnosticReport = JSON.parse(detailRow.diagnosticsJson);
							return (
								<>
									<ScoreBadge
										score={diagnostics.score}
										maxScore={diagnostics.maxScore}
										status={diagnostics.status}
										statusLabel={diagnostics.statusLabel}
									/>
									<Checklist checks={diagnostics.checks} />
								</>
							);
						})()}
					</div>
				</div>
			)}
		</>
	);
}
