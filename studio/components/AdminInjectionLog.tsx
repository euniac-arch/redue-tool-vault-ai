'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchAdminApi } from '@/lib/admin/admin-api';
import { handleAdminUnauthorized } from '@/lib/admin/handle-admin-unauthorized';
import { hasStrictAdminFetchGrant, useAdminSession } from '@/lib/admin/use-admin-session';

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

/**
 * Outer gate: the poller is not mounted — so its useEffect never runs —
 * until NextAuth is authenticated and `session.user.isAdmin === true`
 * on an `/admin` route.
 */
export function AdminInjectionLog() {
	const { status, session, pathname, canFetchAdmin } = useAdminSession();

	if (status !== 'authenticated' || !session?.user || session.user.isAdmin !== true) {
		return null;
	}
	if (!canFetchAdmin) {
		return null;
	}

	return <AdminInjectionLogPoller />;
}

function AdminInjectionLogPoller() {
	const { status, session, pathname } = useAdminSession();
	const [logs, setLogs] = useState<AdminLogRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const grantRef = useRef(false);
	grantRef.current = hasStrictAdminFetchGrant(status, session, pathname);

	useEffect(() => {
		if (status !== 'authenticated' || !session?.user || session.user.isAdmin !== true || !grantRef.current) {
			setLogs(null);
			setError(null);
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
			return;
		}

		let stopped = false;
		const abort = new AbortController();

		function stopPolling() {
			stopped = true;
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
		}

		async function load() {
			if (stopped) return;
			if (status !== 'authenticated' || !session?.user || session.user.isAdmin !== true) {
				return;
			}
			if (!grantRef.current) return;
			try {
				const result = await fetchAdminApi<{ logs: AdminLogRow[] }>('/api/admin/logs', {
					signal: abort.signal,
					enabled: true,
				});
				if (stopped || !grantRef.current) return;
				if (!result.ok) {
					if (result.forbidden) {
						stopPolling();
						setLogs(null);
						setError(null);
						if (result.unauthorized) {
							void handleAdminUnauthorized();
						}
						return;
					}
					setError(result.message);
					return;
				}
				setLogs(result.data.logs);
				setError(null);
			} catch (err) {
				if (stopped || abort.signal.aborted) return;
				if (err instanceof DOMException && err.name === 'AbortError') return;
				setError((err as Error).message);
			}
		}

		void load();
		timerRef.current = setInterval(() => {
			void load();
		}, POLL_INTERVAL_MS);

		return () => {
			stopPolling();
			abort.abort();
		};
	}, [status, session, pathname]);

	if (status !== 'authenticated' || !session?.user || session.user.isAdmin !== true) {
		return null;
	}
	if (error) {
		return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
	}

	if (!logs) {
		return <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700" />;
	}

	if (logs.length === 0) {
		return (
			<div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
				아직 기록된 주입 로그가 없습니다.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
			<table className="w-full min-w-[920px] text-left text-sm">
				<thead>
					<tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-700/60 dark:text-slate-400 dark:border-slate-700">
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
						<tr key={log.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
							<td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(log.patchedAt).toLocaleString('ko-KR')}</td>
							<td className="px-4 py-3 text-slate-700 dark:text-slate-200">{log.userEmail ?? '-'}</td>
							<td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200" title={log.targetDomain}>
								{log.siteUrl ?? log.targetDomain}
							</td>
							<td className="px-4 py-3">
								<span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
									{log.cmsType}
								</span>
							</td>
							<td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-200">{log.durationMs != null ? `${log.durationMs}ms` : '-'}</td>
							<td className="px-4 py-3">
								<span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLES[log.status]}`}>
									{log.status === 'PASS' ? 'Pass' : log.status === 'WARN' ? 'Warn' : 'Fail'} ({log.score}/{log.maxScore})
								</span>
							</td>
							<td className="px-4 py-3 text-xs">
								{log.siteUrl ? (
									<span className="text-slate-600 dark:text-slate-300">
										IndexNow {log.indexNowOk ? '✅' : '⚠️'} · Google {log.googleOk ? '✅' : '⚠️'}
									</span>
								) : (
									<span className="text-slate-400 dark:text-slate-500">미발송</span>
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
