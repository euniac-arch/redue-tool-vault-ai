'use client';

import { useEffect, useRef, useState } from 'react';

interface AdminLogRow {
	id: string;
	userEmail: string | null;
	targetDomain: string;
	siteUrl: string | null;
	cmsType: string;
	durationMs: number | null;
	patchedAt: string;
	score: number;
	maxScore: number;
	status: 'PASS' | 'WARN' | 'FAIL';
	apiCostUsd: number;
	indexNowOk: boolean | null;
	googleOk: boolean | null;
}

const STATUS_STYLES: Record<string, string> = {
	PASS: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
	WARN: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
	FAIL: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const POLL_INTERVAL_MS = 5000;

export function AdminInjectionLog() {
	const [logs, setLogs] = useState<AdminLogRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		async function load() {
			try {
				const res = await fetch('/api/admin/logs');
				const data = await res.json();
				if (!res.ok) throw new Error(data.error ?? '로그를 불러오지 못했습니다.');
				setLogs(data.logs as AdminLogRow[]);
				setError(null);
			} catch (err) {
				setError((err as Error).message);
			}
		}
		load();
		timerRef.current = setInterval(load, POLL_INTERVAL_MS);
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, []);

	if (error) {
		return <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>;
	}

	if (!logs) {
		return <div className="h-40 animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.03]" />;
	}

	if (logs.length === 0) {
		return (
			<div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-500">
				아직 기록된 주입 로그가 없습니다.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03]">
			<table className="w-full min-w-[920px] text-left text-sm">
				<thead>
					<tr className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-slate-500">
						<th className="px-4 py-3 font-semibold">시각</th>
						<th className="px-4 py-3 font-semibold">유저</th>
						<th className="px-4 py-3 font-semibold">타겟 도메인</th>
						<th className="px-4 py-3 font-semibold">CMS</th>
						<th className="px-4 py-3 font-semibold">소요 시간</th>
						<th className="px-4 py-3 font-semibold">상태</th>
						<th className="px-4 py-3 font-semibold">색인 핑</th>
						<th className="px-4 py-3 font-semibold">LLM 비용</th>
					</tr>
				</thead>
				<tbody>
					{logs.map((log) => (
						<tr key={log.id} className="border-b border-white/[0.05] last:border-0">
							<td className="px-4 py-3 text-slate-400">{new Date(log.patchedAt).toLocaleString('ko-KR')}</td>
							<td className="px-4 py-3 text-slate-300">{log.userEmail ?? '-'}</td>
							<td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-slate-300" title={log.targetDomain}>
								{log.siteUrl ?? log.targetDomain}
							</td>
							<td className="px-4 py-3">
								<span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent-light">
									{log.cmsType}
								</span>
							</td>
							<td className="px-4 py-3 font-mono text-slate-300">{log.durationMs != null ? `${log.durationMs}ms` : '-'}</td>
							<td className="px-4 py-3">
								<span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[log.status]}`}>
									{log.status === 'PASS' ? 'Pass' : log.status === 'WARN' ? 'Warn' : 'Fail'} ({log.score}/{log.maxScore})
								</span>
							</td>
							<td className="px-4 py-3 text-xs">
								{log.siteUrl ? (
									<span className="text-slate-400">
										IndexNow {log.indexNowOk ? '✅' : '⚠️'} · Google {log.googleOk ? '✅' : '⚠️'}
									</span>
								) : (
									<span className="text-slate-600">미발송</span>
								)}
							</td>
							<td className="px-4 py-3 font-mono text-cyan-300">${log.apiCostUsd.toFixed(4)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
