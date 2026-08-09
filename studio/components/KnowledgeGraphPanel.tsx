'use client';

import { useCallback, useEffect, useState } from 'react';
import type { KnowledgeGraphReport } from '@/lib/knowledge-graph';

interface KnowledgeGraphPanelProps {
	/** Initial domain hint (e.g. from patch result or latest injection). */
	initialDomain?: string | null;
	/** Show an editable domain field (useful on mypage). */
	allowDomainEdit?: boolean;
	compact?: boolean;
}

export function KnowledgeGraphPanel({
	initialDomain = '',
	allowDomainEdit = false,
	compact = false,
}: KnowledgeGraphPanelProps) {
	const [domain, setDomain] = useState(initialDomain ?? '');
	const [report, setReport] = useState<KnowledgeGraphReport | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchReport = useCallback(async (target: string) => {
		setLoading(true);
		setError(null);
		try {
			const qs = target.trim() ? `?domain=${encodeURIComponent(target.trim())}` : '';
			const res = await fetch(`/api/knowledge-graph${qs}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? '지식 그래프 상태를 불러오지 못했습니다.');
			setReport(data as KnowledgeGraphReport);
			setDomain(data.domain);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchReport(initialDomain ?? '');
	}, [fetchReport, initialDomain]);

	return (
		<section className={`flex flex-col gap-4 ${compact ? '' : 'rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5'}`}>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
							Knowledge Graph
						</span>
						<span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
							AI Search
						</span>
					</div>
					<h2 className="mt-2 text-lg font-bold text-white">AI 지식 그래프 검증</h2>
					<p className="mt-1 text-xs text-slate-400">
						ChatGPT Search · Perplexity · Google Gemini에서 브랜드 인식·인덱싱 상태를 실시간으로 확인합니다.
					</p>
				</div>
				{report && (
					<div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-right">
						<p className="text-[10px] uppercase tracking-wide text-slate-500">Sync overview</p>
						<p className="text-sm font-bold text-white">
							<span className="text-emerald-400">{report.syncedCount} Synced</span>
							<span className="mx-1.5 text-slate-600">·</span>
							<span className="text-amber-300">{report.pendingCount} Pending</span>
						</p>
					</div>
				)}
			</div>

			{allowDomainEdit && (
				<form
					className="flex flex-wrap gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						void fetchReport(domain);
					}}
				>
					<input
						value={domain}
						onChange={(event) => setDomain(event.target.value)}
						placeholder="example.com"
						className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent focus:outline-none"
					/>
					<button
						type="submit"
						disabled={loading}
						className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-50"
					>
						{loading ? '검증 중...' : '상태 새로고침'}
					</button>
				</form>
			)}

			{!allowDomainEdit && report && (
				<div className="flex items-center justify-between gap-3">
					<p className="font-mono text-xs text-slate-400">
						타겟 도메인 · <span className="text-slate-200">{report.domain}</span>
					</p>
					<button
						type="button"
						onClick={() => void fetchReport(domain || report.domain)}
						disabled={loading}
						className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50"
					>
						{loading ? '갱신 중...' : '다시 확인'}
					</button>
				</div>
			)}

			{error && <p className="text-sm text-rose-400">{error}</p>}

			{loading && !report ? (
				<p className="text-sm text-slate-500">지식 그래프 인덱싱 상태를 조회하는 중...</p>
			) : report ? (
				<div className="grid gap-3 sm:grid-cols-3">
					{report.engines.map((engine) => {
						const synced = engine.status === 'synced';
						return (
							<article
								key={engine.id}
								className={`flex flex-col gap-3 rounded-xl border p-4 ${
									synced
										? 'border-emerald-400/25 bg-emerald-400/[0.05]'
										: 'border-amber-400/25 bg-amber-400/[0.05]'
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<div>
										<p className="text-sm font-bold text-white">{engine.name}</p>
										<p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{engine.description}</p>
									</div>
									<span
										className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
											synced
												? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
												: 'border-amber-400/40 bg-amber-400/10 text-amber-300'
										}`}
									>
										{synced ? 'Synced' : 'Pending'}
									</span>
								</div>
								<p className="text-xs text-slate-300">{engine.brandSignal}</p>
								<p className="text-[10px] text-slate-600">
									Last check · {new Date(engine.lastCheckedAt).toLocaleString('ko-KR')}
								</p>
							</article>
						);
					})}
				</div>
			) : null}
		</section>
	);
}
