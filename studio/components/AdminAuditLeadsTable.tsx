'use client';

import { useEffect, useState } from 'react';

interface AuditLeadRow {
	id: string;
	url: string;
	score: number;
	maxScore: number;
	statusLabel: string;
	createdAt: string;
	userId: string | null;
}

export function AdminAuditLeadsTable() {
	const [leads, setLeads] = useState<AuditLeadRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch('/api/admin/audit-leads')
			.then((res) => res.json())
			.then((data) => {
				if (data.error) throw new Error(data.error);
				setLeads(data.leads as AuditLeadRow[]);
			})
			.catch((err) => setError((err as Error).message));
	}, []);

	if (error) {
		return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
	}

	if (!leads) {
		return <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />;
	}

	if (leads.length === 0) {
		return (
			<div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
				아직 무료 진단을 받은 리드가 없습니다.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
			<table className="w-full min-w-[640px] text-left text-sm">
				<thead>
					<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
						<th className="px-4 py-3 font-semibold">진단 시각</th>
						<th className="px-4 py-3 font-semibold">URL</th>
						<th className="px-4 py-3 font-semibold">점수</th>
						<th className="px-4 py-3 font-semibold">가입 여부</th>
					</tr>
				</thead>
				<tbody>
					{leads.map((lead) => (
						<tr key={lead.id} className="border-b border-slate-100 last:border-0">
							<td className="px-4 py-3 text-slate-500">{new Date(lead.createdAt).toLocaleString('ko-KR')}</td>
							<td className="max-w-[280px] truncate px-4 py-3 font-mono text-xs text-slate-700" title={lead.url}>
								{lead.url}
							</td>
							<td className="px-4 py-3">
								<span className={`font-bold ${lead.score < 40 ? 'text-rose-600' : lead.score < 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
									{lead.score}/{lead.maxScore}
								</span>
								<span className="ml-1 text-xs text-slate-500">({lead.statusLabel})</span>
							</td>
							<td className="px-4 py-3">
								{lead.userId ? (
									<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
										회원
									</span>
								) : (
									<span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
										비회원 (콜드 리드)
									</span>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
