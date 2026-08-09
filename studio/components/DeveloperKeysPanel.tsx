'use client';

import { useCallback, useEffect, useState } from 'react';
import { UsageChart, type UsageDay } from './UsageChart';

interface ApiKeyRow {
	id: string;
	label: string;
	keyPrefix: string;
	dailyLimit: number;
	monthlyLimit: number;
	dailyUsed: number;
	monthlyUsed: number;
	totalCalls: number;
	lastUsedAt: string | null;
	revokedAt: string | null;
	createdAt: string;
}

export function DeveloperKeysPanel() {
	const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
	const [days, setDays] = useState<UsageDay[]>([]);
	const [newLabel, setNewLabel] = useState('');
	const [creating, setCreating] = useState(false);
	const [revealedKey, setRevealedKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		const [keysRes, usageRes] = await Promise.all([fetch('/api/developer/keys'), fetch('/api/developer/usage')]);
		const keysData = await keysRes.json();
		const usageData = await usageRes.json();
		setKeys(keysData.keys ?? []);
		setDays(usageData.days ?? []);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	async function handleCreate() {
		setCreating(true);
		setError(null);
		try {
			const res = await fetch('/api/developer/keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label: newLabel.trim() || undefined }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'API Key 발급에 실패했습니다.');
			setRevealedKey(data.rawKey);
			setNewLabel('');
			await load();
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setCreating(false);
		}
	}

	async function handleRevoke(id: string) {
		if (!confirm('이 API Key를 폐기하시겠습니까? 폐기 후에는 되돌릴 수 없습니다.')) return;
		await fetch(`/api/developer/keys/${id}/revoke`, { method: 'POST' });
		await load();
	}

	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
				<h2 className="text-sm font-bold text-slate-200">사용량 추이 (최근 14일)</h2>
				<UsageChart days={days} />
			</section>

			<section className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-bold text-slate-200">API Key 발급</h2>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row">
					<input
						value={newLabel}
						onChange={(event) => setNewLabel(event.target.value)}
						placeholder="키 이름 (예: 운영 서버, 사내 자동화 봇)"
						className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent"
					/>
					<button
						onClick={handleCreate}
						disabled={creating}
						className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent-light disabled:opacity-50"
					>
						{creating ? '발급 중...' : '+ API Key 생성'}
					</button>
				</div>
				{error && <p className="text-xs text-rose-400">{error}</p>}

				{revealedKey && (
					<div className="flex flex-col gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
						<p className="text-xs font-bold text-amber-300">
							⚠️ 이 Secret Key는 지금 한 번만 표시됩니다. 안전한 곳에 저장하세요.
						</p>
						<code className="break-all rounded-lg bg-black/40 px-3 py-2 text-xs text-amber-100">{revealedKey}</code>
						<button
							onClick={() => {
								navigator.clipboard.writeText(revealedKey);
							}}
							className="w-fit rounded-lg border border-white/[0.08] bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
						>
							📋 복사하기
						</button>
					</div>
				)}
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-bold text-slate-200">발급된 API Key</h2>
				{!keys || keys.length === 0 ? (
					<p className="text-sm text-slate-500">아직 발급된 API Key가 없습니다.</p>
				) : (
					<div className="overflow-x-auto rounded-xl border border-white/[0.08]">
						<table className="w-full text-left text-sm">
							<thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-slate-500">
								<tr>
									<th className="px-4 py-3">이름</th>
									<th className="px-4 py-3">Key</th>
									<th className="px-4 py-3">일일 / 월간 사용량</th>
									<th className="px-4 py-3">마지막 사용</th>
									<th className="px-4 py-3">상태</th>
									<th className="px-4 py-3" />
								</tr>
							</thead>
							<tbody>
								{keys.map((key) => (
									<tr key={key.id} className="border-t border-white/[0.08]">
										<td className="px-4 py-3 text-xs font-semibold text-slate-200">{key.label}</td>
										<td className="px-4 py-3 font-mono text-xs text-slate-400">{key.keyPrefix}...</td>
										<td className="px-4 py-3 text-xs text-slate-400">
											{key.dailyUsed}/{key.dailyLimit} · {key.monthlyUsed}/{key.monthlyLimit}
										</td>
										<td className="px-4 py-3 text-xs text-slate-500">
											{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('ko-KR') : '-'}
										</td>
										<td className="px-4 py-3 text-xs">
											{key.revokedAt ? (
												<span className="text-rose-400">폐기됨</span>
											) : (
												<span className="text-emerald-400">활성</span>
											)}
										</td>
										<td className="px-4 py-3">
											{!key.revokedAt && (
												<button
													onClick={() => handleRevoke(key.id)}
													className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-400/20"
												>
													폐기
												</button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<section className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
				<h2 className="text-sm font-bold text-slate-200">연동 예시 (cURL)</h2>
				<pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-[11px] leading-relaxed text-cyan-200">
					{`curl -X POST https://your-domain.com/api/v1/schema/generate \\
  -H "Authorization: Bearer redue_live_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"https://example.com","cms_type":"wordpress","lang":"en"}'`}
				</pre>
			</section>
		</div>
	);
}
