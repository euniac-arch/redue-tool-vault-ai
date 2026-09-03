'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CaseStudyReport } from '@/components/portfolio/CaseStudyReport';
import type { CaseStudyData } from '@/lib/case-study-types';

function isCaseStudyData(value: unknown): value is CaseStudyData {
	if (!value || typeof value !== 'object') return false;
	const row = value as Partial<CaseStudyData>;
	return Boolean(row.id && row.siteInfo && row.normalizedScore && Array.isArray(row.axes));
}

function ReportSkeleton() {
	return (
		<div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0d1117] sm:p-7">
			<div className="h-7 w-48 rounded bg-slate-200 dark:bg-white/10" />
			<div className="mt-3 h-4 w-72 rounded bg-slate-100 dark:bg-white/5" />
			<div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div className="h-64 rounded-2xl bg-slate-100 dark:bg-white/5" />
				<div className="h-64 rounded-2xl bg-slate-100 dark:bg-white/5" />
			</div>
			<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div className="h-48 rounded-2xl bg-slate-100 dark:bg-white/5" />
				<div className="h-48 rounded-2xl bg-slate-100 dark:bg-white/5" />
			</div>
			<p className="mt-6 text-sm text-slate-500">진단 요약 리포트를 불러오는 중입니다...</p>
		</div>
	);
}

function MissingReport({ id }: { id: string }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center dark:border-slate-800 dark:bg-[#0d1117]">
			<p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
				해당 도입 사례를 찾을 수 없습니다.
			</p>
			<p className="mt-2 text-xs text-slate-500">
				요청한 프로젝트 ID가 없거나 공개 설정이 해제되었습니다.
			</p>
			<Link
				href="/portfolio"
				className="mt-5 inline-flex rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-700 dark:text-cyan-300"
			>
				도입 사례 목록으로
			</Link>
			{id ? <p className="mt-3 font-mono text-[11px] text-slate-400">{id}</p> : null}
		</div>
	);
}

export function CaseStudyViewerClient({ id }: { id: string }) {
	const [data, setData] = useState<CaseStudyData | null>(null);
	const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

	useEffect(() => {
		const key = id.trim();
		if (!key) {
			setStatus('missing');
			return;
		}

		let cancelled = false;
		setStatus('loading');
		fetch(`/api/case-studies/${encodeURIComponent(key)}`, { cache: 'no-store' })
			.then(async (res) => {
				if (res.status === 404) {
					if (!cancelled) setStatus('missing');
					return;
				}
				if (!res.ok) throw new Error('lookup_failed');
				const json = (await res.json()) as { item?: unknown };
				if (!isCaseStudyData(json.item)) {
					if (!cancelled) setStatus('missing');
					return;
				}
				if (!cancelled) {
					setData(json.item);
					setStatus('ready');
				}
			})
			.catch(() => {
				if (!cancelled) setStatus('error');
			});

		return () => {
			cancelled = true;
		};
	}, [id]);

	if (status === 'loading') return <ReportSkeleton />;
	if (status === 'missing' || !data) return <MissingReport id={id} />;
	if (status === 'error') {
		return (
			<div className="rounded-2xl border border-rose-300 bg-rose-50 px-5 py-8 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
				<p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
					진단 요약을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
				</p>
				<Link href="/portfolio" className="mt-4 inline-flex text-sm font-bold text-cyan-700 dark:text-cyan-300">
					도입 사례 목록으로
				</Link>
			</div>
		);
	}

	return (
		<>
			<section>
				<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
					{data.kind === 'verified' ? 'Verified Real Case' : '업종별 시뮬레이션 모델'}
				</p>
				<h1 className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
					진단 결과 요약 실증 리포트
				</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					{data.siteInfo?.name} · {data.siteInfo?.domain}
				</p>
			</section>
			<CaseStudyReport data={data} />
		</>
	);
}
