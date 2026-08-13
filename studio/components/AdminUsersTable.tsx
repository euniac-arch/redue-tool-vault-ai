'use client';

import { useEffect, useState } from 'react';

interface AdminUserRow {
	id: string;
	email: string | null;
	name: string | null;
	role: string;
	planId: string;
	creditsRemaining: number;
	createdAt: string;
	totalPaidKrw: number;
	totalApiCostUsd: number;
	marginKrw: number;
}

const PLAN_LABEL: Record<string, string> = { starter: 'Starter', pro: 'Pro', agency: 'Agency', topup: 'Top-up' };

function formatKrw(amount: number): string {
	return `₩${Math.round(amount).toLocaleString('ko-KR')}`;
}

export function AdminUsersTable() {
	const [users, setUsers] = useState<AdminUserRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [drafts, setDrafts] = useState<Record<string, string>>({});

	async function load() {
		try {
			const res = await fetch('/api/admin/users');
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? '회원 목록을 불러오지 못했습니다.');
			setUsers(data.users as AdminUserRow[]);
		} catch (err) {
			setError((err as Error).message);
		}
	}

	useEffect(() => {
		load();
	}, []);

	async function adjustCredits(userId: string, delta: number) {
		setPendingId(userId);
		setError(null);
		try {
			const res = await fetch(`/api/admin/users/${userId}/credits`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ delta, reason: 'admin_manual_adjust' }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? '크레딧 조정에 실패했습니다.');
			await load();
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setPendingId(null);
		}
	}

	if (error) {
		return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
	}

	if (!users) {
		return <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />;
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
			<table className="w-full min-w-[820px] text-left text-sm">
				<thead>
					<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
						<th className="px-4 py-3 font-semibold">이메일</th>
						<th className="px-4 py-3 font-semibold">가입일</th>
						<th className="px-4 py-3 font-semibold">요금제</th>
						<th className="px-4 py-3 font-semibold">잔여 크레딧</th>
						<th className="px-4 py-3 font-semibold">누적 결제 / 마진</th>
						<th className="px-4 py-3 font-semibold">크레딧 조정</th>
					</tr>
				</thead>
				<tbody>
					{users.map((user) => (
						<tr key={user.id} className="border-b border-slate-100 last:border-0">
							<td className="px-4 py-3">
								<p className="font-medium text-slate-800">{user.email ?? '(이메일 없음)'}</p>
								{user.role === 'admin' && (
									<span className="mt-0.5 inline-block rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
										ADMIN
									</span>
								)}
							</td>
							<td className="px-4 py-3 text-slate-500">{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
							<td className="px-4 py-3 text-slate-700">{PLAN_LABEL[user.planId] ?? user.planId}</td>
							<td className="px-4 py-3 font-mono text-cyan-700">{user.creditsRemaining}회</td>
							<td className="px-4 py-3">
								<p className="text-slate-700">{formatKrw(user.totalPaidKrw)}</p>
								<p className={`text-xs ${user.marginKrw >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
									마진 {formatKrw(user.marginKrw)} (API ${user.totalApiCostUsd.toFixed(4)})
								</p>
							</td>
							<td className="px-4 py-3">
								<div className="flex items-center gap-1.5">
									<input
										type="number"
										placeholder="개수"
										className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-indigo-500"
										value={drafts[user.id] ?? ''}
										onChange={(event) => setDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))}
									/>
									<button
										disabled={pendingId === user.id}
										onClick={() => adjustCredits(user.id, Math.abs(Number(drafts[user.id]) || 0))}
										className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
									>
										지급
									</button>
									<button
										disabled={pendingId === user.id}
										onClick={() => adjustCredits(user.id, -Math.abs(Number(drafts[user.id]) || 0))}
										className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
									>
										차감
									</button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
