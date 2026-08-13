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
	PASS: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	WARN: 'border-amber-200 bg-amber-50 text-amber-700',
	FAIL: 'border-rose-200 bg-rose-50 text-rose-700',
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
		return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
	}

	if (!logs) {
		return <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />;
	}

	if (logs.length === 0) {
		return (
			<div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
				아직 기록된 주입 로그가 없습니다.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
			<table className="w-full min-w-[920px] text-left text-sm">
				<thead>
					<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
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
						<tr key={log.id} className="border-b border-slate-100 last:border-0">
							<td className="px-4 py-3 text-slate-500">{new Date(log.patchedAt).toLocaleString('ko-KR')}</td>
							<td className="px-4 py-3 text-slate-700">{log.userEmail ?? '-'}</td>
							<td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-slate-700" title={log.targetDomain}>
								{log.siteUrl ?? log.targetDomain}
							</td>
							<td className="px-4 py-3">
								<span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
									{log.cmsType}
								</span>
							</td>
							<td className="px-4 py-3 font-mono text-slate-700">{log.durationMs != null ? `${log.durationMs}ms` : '-'}</td>
							<td className="px-4 py-3">
								<span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[log.status]}`}>
									{log.status === 'PASS' ? 'Pass' : log.status === 'WARN' ? 'Warn' : 'Fail'} ({log.score}/{log.maxScore})
								</span>
							</td>
							<td className="px-4 py-3 text-xs">
								{log.siteUrl ? (
									<span className="text-slate-600">
										IndexNow {log.indexNowOk ? '✅' : '⚠️'} · Google {log.googleOk ? '✅' : '⚠️'}
									</span>
								) : (
									<span className="text-slate-400">미발송</span>
								)}
							</td>
							<td className="px-4 py-3 font-mono text-cyan-700">${log.apiCostUsd.toFixed(4)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
