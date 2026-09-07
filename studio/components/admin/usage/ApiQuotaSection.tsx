'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { fetchApiQuotaUsage, type ApiQuotaSnapshot } from '@/lib/admin/api-quota';
import { ApiQuotaCallStatsPanel } from './ApiQuotaCallStatsPanel';
import { ApiQuotaCard } from './ApiQuotaCard';
import { ProductUsageSection } from './ProductUsageSection';

export function ApiQuotaSection() {
	const [snapshot, setSnapshot] = useState<ApiQuotaSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		setError(null);
		try {
			const data = await fetchApiQuotaUsage(signal);
			setSnapshot(data);
		} catch (err) {
			if (signal?.aborted) return;
			setError(err instanceof Error ? err.message : 'API 쿼터 데이터를 불러오지 못했습니다.');
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void load(controller.signal);
		return () => controller.abort();
	}, [load]);

	const criticalCount = snapshot?.quotas.filter((q) => q.status === 'critical').length ?? 0;
	const warningCount = snapshot?.quotas.filter((q) => q.status === 'warning').length ?? 0;

	return (
		<section className="flex flex-col gap-4" aria-label="API 쿼터 현황">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">서비스별 API 쿼터 현황</h2>
					<p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
						Google OAuth · Kakao Login · Gemini API · Translation API — 80% 이상 경고, 95% 이상 위험
						{snapshot ? ` · ${new Date(snapshot.generatedAt).toLocaleTimeString('ko-KR')} 기준` : ''}
					</p>
				</div>
				<div className="flex items-center gap-2">
					{criticalCount > 0 && (
						<span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200">
							<AlertCircle className="h-3 w-3" /> 위험 {criticalCount}건
						</span>
					)}
					{warningCount > 0 && (
						<span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
							<AlertCircle className="h-3 w-3" /> 경고 {warningCount}건
						</span>
					)}
					<button
						type="button"
						onClick={() => void load()}
						disabled={loading}
						className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
						새로고침
					</button>
				</div>
			</div>

			{error && (
				<div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
					<p>{error}</p>
					<button type="button" onClick={() => void load()} className="font-semibold underline">
						다시 시도
					</button>
				</div>
			)}

			{snapshot?.productUsage ? <ProductUsageSection rows={snapshot.productUsage} /> : null}

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{loading && !snapshot
					? Array.from({ length: 4 }).map((_, idx) => (
							<div
								key={idx}
								className="h-[178px] animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-700/60 dark:border-slate-700"
							/>
						))
					: snapshot?.quotas.map((quota) => <ApiQuotaCard key={quota.serviceName} quota={quota} />)}
			</div>

			{snapshot && <ApiQuotaCallStatsPanel callStats={snapshot.callStats} />}
		</section>
	);
}
