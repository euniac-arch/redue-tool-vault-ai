'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AuditHistoryItem } from '@/lib/projects';

const RECENT_LIMIT = 5;

function formatAuditDate(iso: string): string {
	try {
		return new Intl.DateTimeFormat('ko-KR', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

interface SolveEmptyContextProps {
	/** When an `?id=` was present but the document could not be loaded */
	missingDocId?: string | null;
}

export function SolveEmptyContext({ missingDocId = null }: SolveEmptyContextProps) {
	const router = useRouter();
	const [recent, setRecent] = useState<AuditHistoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [listError, setListError] = useState<string | null>(null);
	const [url, setUrl] = useState('');
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		let cancelled = false;
		async function loadRecent() {
			setLoading(true);
			setListError(null);
			try {
				const res = await fetch('/api/admin/projects');
				const data = await res.json();
				if (!res.ok) throw new Error(data.message || '최근 진단을 불러오지 못했습니다.');
				const audits = (data.recentAudits as AuditHistoryItem[] | undefined) || [];
				if (!cancelled) setRecent(audits.slice(0, RECENT_LIMIT));
			} catch (err) {
				if (!cancelled) {
					setRecent([]);
					setListError(err instanceof Error ? err.message : '최근 진단을 불러오지 못했습니다.');
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void loadRecent();
		return () => {
			cancelled = true;
		};
	}, []);

	function handleNewAudit(event: React.FormEvent) {
		event.preventDefault();
		const trimmed = url.trim();
		if (!trimmed) return;
		setSubmitting(true);
		const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
		router.push(`/audit/result?url=${encodeURIComponent(normalized)}`);
	}

	return (
		<section className="flex flex-col gap-4" aria-label="진단 데이터 선택">
			<div
				className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
				role="status"
			>
				<p className="font-bold">분석할 진단 데이터가 선택되지 않았습니다.</p>
				<p className="mt-1 text-amber-900/90">
					기존 프로젝트를 선택하거나 새로운 진단을 수행해 주세요.
				</p>
				{missingDocId ? (
					<p className="mt-2 text-xs text-amber-800/80">
						요청한 문서 id(<code className="rounded bg-amber-100 px-1">{missingDocId}</code>
						)를 찾을 수 없습니다.
					</p>
				) : null}
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="flex items-baseline justify-between gap-2">
						<h2 className="text-sm font-bold text-slate-900">최근 진단 이력 선택</h2>
						<Link
							href="/admin/projects"
							className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
						>
							전체 프로젝트 →
						</Link>
					</div>
					<p className="mt-1 text-xs text-slate-500">
						최근 {RECENT_LIMIT}건 · 항목을 클릭하면 해결 워크스페이스에 바인딩됩니다.
					</p>

					{loading ? (
						<p className="mt-4 text-xs text-slate-400">불러오는 중…</p>
					) : listError ? (
						<p className="mt-4 text-xs font-medium text-rose-600">{listError}</p>
					) : recent.length === 0 ? (
						<p className="mt-4 text-xs text-slate-500">
							저장된 진단이 없습니다. 오른쪽에서 새 URL 진단을 시작해 주세요.
						</p>
					) : (
						<ul className="mt-3 flex flex-col gap-2">
							{recent.map((item) => (
								<li key={item.auditId}>
									<Link
										href={`/admin/solve?id=${encodeURIComponent(item.auditId)}`}
										className="flex flex-col gap-1 rounded-lg border border-slate-200 px-3 py-2.5 transition hover:border-slate-400 hover:bg-slate-50"
									>
										<span className="truncate text-sm font-semibold text-slate-900">
											{item.targetUrl}
										</span>
										<span className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
											<span>{formatAuditDate(item.createdAt)}</span>
											<span className="rounded-md bg-slate-900 px-1.5 py-0.5 font-bold text-white tabular-nums">
												점수 {item.overallScore}
											</span>
											{item.defectCount != null ? (
												<span className="rounded-md bg-rose-50 px-1.5 py-0.5 font-bold text-rose-700">
													결함 {item.defectCount}
												</span>
											) : null}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
					<h2 className="text-sm font-bold text-slate-900">새 URL 진단하기</h2>
					<p className="mt-1 text-xs text-slate-500">
						진단 완료 후 결과 페이지에서 해결 워크스페이스로 연결할 수 있습니다.
					</p>
					<form onSubmit={handleNewAudit} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
						<input
							type="text"
							required
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://example.com"
							className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-slate-400/0 transition focus:border-slate-500 focus:ring-2 focus:ring-slate-300"
						/>
						<button
							type="submit"
							disabled={submitting}
							className="whitespace-nowrap rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
						>
							{submitting ? '이동 중…' : '진단하기'}
						</button>
					</form>
					<p className="mt-3 text-[11px] text-slate-400">
						또는{' '}
						<Link href="/" className="font-semibold text-slate-600 underline-offset-2 hover:underline">
							메인 진단 폼
						</Link>
						으로 이동할 수 있습니다.
					</p>
				</div>
			</div>
		</section>
	);
}
