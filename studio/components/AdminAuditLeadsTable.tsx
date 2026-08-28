'use client';

import { useEffect, useState } from 'react';
import { UserTypeBadge } from '@/components/admin/UserTypeBadge';
import { fetchAdminApi } from '@/lib/admin/admin-api';
import { handleAdminUnauthorized } from '@/lib/admin/handle-admin-unauthorized';
import { useAdminSession } from '@/lib/admin/use-admin-session';
import type { DiagnosisUserType } from '@/lib/projects';

interface AuditLeadRow {
	id: string;
	url: string;
	score: number;
	maxScore: number;
	statusLabel: string;
	createdAt: string;
	userId: string | null;
	userType?: DiagnosisUserType | string;
}

function leadUserType(lead: AuditLeadRow): DiagnosisUserType {
	const raw = String(lead.userType || '')
		.trim()
		.toLowerCase();
	if (raw === 'admin') return 'admin';
	if (raw === 'user') return 'user';
	return lead.userId ? 'user' : 'guest';
}

export function AdminAuditLeadsTable() {
	const { canFetchAdmin, status, session } = useAdminSession();
	const [leads, setLeads] = useState<AuditLeadRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (status !== 'authenticated' || !session?.user || session.user.isAdmin !== true || !canFetchAdmin) {
			setLeads(null);
			setError(null);
			return;
		}

		let cancelled = false;
		fetchAdminApi<{ leads: AuditLeadRow[] }>('/api/admin/audit-leads')
			.then((result) => {
				if (cancelled) return;
				if (!result.ok) {
					if (result.forbidden) {
						setLeads(null);
						setError(null);
						if (result.unauthorized) void handleAdminUnauthorized();
						return;
					}
					setError(result.message);
					return;
				}
				setLeads(result.data.leads);
				setError(null);
			})
			.catch((err) => {
				if (!cancelled) setError((err as Error).message);
			});

		return () => {
			cancelled = true;
		};
	}, [canFetchAdmin, status, session]);

	if (!canFetchAdmin) {
		return null;
	}
	if (error) {
		return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
	}

	if (!leads) {
		return <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700" />;
	}

	if (leads.length === 0) {
		return (
			<div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
				아직 무료 진단을 받은 리드가 없습니다.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
			<table className="w-full min-w-[640px] text-left text-sm">
				<thead>
					<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-700">
						<th className="px-4 py-3 font-semibold">진단 시각</th>
						<th className="px-4 py-3 font-semibold">URL</th>
						<th className="px-4 py-3 font-semibold">점수</th>
						<th className="px-4 py-3 font-semibold">가입 여부</th>
					</tr>
				</thead>
				<tbody>
					{leads.map((lead) => (
						<tr key={lead.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
							<td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(lead.createdAt).toLocaleString('ko-KR')}</td>
							<td className="max-w-[280px] truncate px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200" title={lead.url}>
								{lead.url}
							</td>
							<td className="px-4 py-3">
								<span className={`font-bold ${lead.score < 40 ? 'text-rose-600' : lead.score < 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
									{lead.score}/{lead.maxScore}
								</span>
								<span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({lead.statusLabel})</span>
							</td>
							<td className="px-4 py-3">
								<UserTypeBadge userType={leadUserType(lead)} className="rounded-full px-2 py-0.5 text-[11px]" />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
