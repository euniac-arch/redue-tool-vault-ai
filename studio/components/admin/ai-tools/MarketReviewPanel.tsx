'use client';

import { useCallback, useEffect, useState } from 'react';

type ShareRow = { serviceId: string; serviceName: string; sharePct: number; rank: number };
type Pending = {
	status: 'pending' | 'approved' | 'rejected';
	candidate: { periodLabel: string; periodStart: string; periodEnd: string; sourceUrl: string; rows: ShareRow[] };
	publishedPeriodLabel: string;
	publishedRows: ShareRow[];
	sourceName: string;
	metricLabel: string;
	note: string;
	decision: { action: string; actorId: string; actorEmail: string | null; at: string } | null;
};

export function MarketReviewPanel() {
	const [approvalEnabled, setApprovalEnabled] = useState<boolean | null>(null);
	const [pending, setPending] = useState<Pending | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const load = useCallback(async () => {
		const res = await fetch('/api/admin/ai-market/review', { cache: 'no-store' });
		if (res.status === 401) {
			setMessage('관리자 권한이 필요합니다.');
			return;
		}
		const data = (await res.json()) as { approvalEnabled?: boolean; pending?: Pending | null };
		setApprovalEnabled(data.approvalEnabled === true);
		setPending(data.pending ?? null);
	}, []);

	useEffect(() => {
		void load().catch(() => setMessage('검토 대기열을 읽지 못했습니다.'));
	}, [load]);

	const checkSources = useCallback(async () => {
		if (busy) return;
		setBusy(true);
		setMessage(null);
		try {
			const res = await fetch('/api/admin/ai-market/check', { method: 'POST' });
			const data = (await res.json().catch(() => null)) as { persistence?: { reason?: string }; error?: string } | null;
			if (res.status === 401) {
				setMessage('관리자 권한이 필요합니다.');
				return;
			}
			setMessage(
				data?.persistence?.reason === 'saved'
					? '출처를 확인했고 Firestore에 저장했습니다.'
					: data?.persistence?.reason === 'firestore_unconfigured'
						? 'Firestore가 없어 확인 결과를 저장하지 않았습니다. 공개 수치는 그대로입니다.'
						: data?.error || `저장하지 않았습니다 (${data?.persistence?.reason ?? res.status}).`,
			);
			await load();
		} finally {
			setBusy(false);
		}
	}, [busy, load]);

	const decide = useCallback(
		async (action: 'approve' | 'reject') => {
			if (busy) return;
			setBusy(true);
			setMessage(null);
			try {
				const res = await fetch('/api/admin/ai-market/review', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action }),
				});
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				if (!res.ok) {
					setMessage(res.status === 409 ? '이미 처리된 검토입니다.' : data?.error || '처리하지 못했습니다.');
					return;
				}
				setMessage(action === 'approve' ? '승인했습니다. 공개 점유율을 갱신했습니다.' : '반려했습니다. 공개 점유율은 그대로입니다.');
				await load();
			} finally {
				setBusy(false);
			}
		},
		[busy, load],
	);

	const published = new Map((pending?.publishedRows ?? []).map((row) => [row.serviceId, row]));

	return (
		<section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
			<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">웹 트래픽 점유율 검토</h2>
			<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
				새 월간 후보는 승인 전까지 공개 순위에 반영되지 않습니다. Firestore가 없으면 승인할 수 없습니다.
			</p>
			{approvalEnabled === false ? <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">Firestore가 연결되지 않아 승인 기능이 꺼져 있습니다.</p> : null}
			<button type="button" disabled={busy} onClick={() => void checkSources()} className="mt-3 w-fit rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">
				출처 확인
			</button>
			{pending?.status === 'pending' ? (
				<div className="mt-3 flex flex-col gap-3">
					<p className="text-xs text-slate-600 dark:text-slate-300">
						현재 {pending.publishedPeriodLabel} · 후보 {pending.candidate.periodLabel}
						<br />
						지표: {pending.metricLabel}
						<br />
						출처: {pending.sourceName}{' '}
						<a href={pending.candidate.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300">
							원문 열기
						</a>
					</p>
					<div className="overflow-x-auto">
						<table className="w-full border-collapse text-left text-xs">
							<thead>
								<tr className="text-slate-500 dark:text-slate-400">
									<th className="py-1 pr-3">서비스</th>
									<th className="py-1 pr-3">현재</th>
									<th className="py-1">후보</th>
								</tr>
							</thead>
							<tbody>
								{pending.candidate.rows.map((row) => (
									<tr key={row.serviceId} className="border-t border-slate-100 dark:border-slate-800">
										<td className="py-1.5 pr-3 font-semibold text-slate-800 dark:text-slate-100">{row.serviceName}</td>
										<td className="py-1.5 pr-3 tabular-nums">{published.get(row.serviceId)?.sharePct.toFixed(1) ?? '—'}</td>
										<td className="py-1.5 tabular-nums">{row.sharePct.toFixed(1)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{pending.note}</p>
					<div className="flex gap-2">
						<button type="button" disabled={busy || approvalEnabled === false} onClick={() => void decide('approve')} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950">
							승인
						</button>
						<button type="button" disabled={busy || approvalEnabled === false} onClick={() => void decide('reject')} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">
							반려
						</button>
					</div>
				</div>
			) : (
				<p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{pending ? `마지막 결정: ${pending.status}` : '대기 중인 후보가 없습니다.'}</p>
			)}
			{pending?.decision ? (
				<p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
					{pending.decision.action} · {pending.decision.actorEmail || pending.decision.actorId} · {pending.decision.at}
				</p>
			) : null}
			{message ? <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{message}</p> : null}
		</section>
	);
}
