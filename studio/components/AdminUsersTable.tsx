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
		return <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>;
	}

	if (!users) {
		return <div className="h-40 animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.03]" />;
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03]">
			<table className="w-full min-w-[820px] text-left text-sm">
				<thead>
					<tr className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-slate-500">
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
						<tr key={user.id} className="border-b border-white/[0.05] last:border-0">
							<td className="px-4 py-3">
								<p className="font-medium text-slate-200">{user.email ?? '(이메일 없음)'}</p>
								{user.role === 'admin' && (
									<span className="mt-0.5 inline-block rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent-light">
										ADMIN
									</span>
								)}
							</td>
							<td className="px-4 py-3 text-slate-400">{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
							<td className="px-4 py-3 text-slate-300">{PLAN_LABEL[user.planId] ?? user.planId}</td>
							<td className="px-4 py-3 font-mono text-cyan-300">{user.creditsRemaining}회</td>
							<td className="px-4 py-3">
								<p className="text-slate-300">{formatKrw(user.totalPaidKrw)}</p>
								<p className={`text-xs ${user.marginKrw >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
									마진 {formatKrw(user.marginKrw)} (API ${user.totalApiCostUsd.toFixed(4)})
								</p>
							</td>
							<td className="px-4 py-3">
								<div className="flex items-center gap-1.5">
									<input
										type="number"
										placeholder="개수"
										className="w-16 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-slate-100 outline-none focus:border-accent"
										value={drafts[user.id] ?? ''}
										onChange={(event) => setDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))}
									/>
									<button
										disabled={pendingId === user.id}
										onClick={() => adjustCredits(user.id, Math.abs(Number(drafts[user.id]) || 0))}
										className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
									>
										지급
									</button>
									<button
										disabled={pendingId === user.id}
										onClick={() => adjustCredits(user.id, -Math.abs(Number(drafts[user.id]) || 0))}
										className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
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
