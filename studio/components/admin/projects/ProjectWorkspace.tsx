'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	PROJECT_CATEGORY_CODES,
	PROJECT_CATEGORY_LABELS,
	type ProjectCategoryFilter,
} from '@/lib/project-categories';
import {
	clearGuestAudits,
	notifyAuditHistorySync,
	removeGuestAuditsByIds,
} from '@/lib/audit-history-storage';
import {
	computeProjectKpi,
	filterProjects,
	type AuditHistoryItem,
	type ProjectListItem,
} from '@/lib/projects';

const CMS_OPTIONS = ['UNKNOWN', 'Gnuboard', 'Cafe24', 'WordPress', 'Next.js'] as const;
const PAGE_SIZE = 12;

type DeleteConfirm =
	| { mode: 'selected'; ids: string[] }
	| { mode: 'all' };

export function ProjectWorkspace() {
	const router = useRouter();
	const [projects, setProjects] = useState<ProjectListItem[]>([]);
	const [audits, setAudits] = useState<AuditHistoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [search, setSearch] = useState('');
	const [cmsFilter, setCmsFilter] = useState('all');
	const [categoryFilter, setCategoryFilter] = useState<ProjectCategoryFilter>('ALL');
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	const [name, setName] = useState('');
	const [url, setUrl] = useState('');
	const [category, setCategory] = useState('');
	const [cmsType, setCmsType] = useState('UNKNOWN');
	const [formError, setFormError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const [auditSort, setAuditSort] = useState<'newest' | 'score-desc' | 'score-asc'>('newest');
	const [auditPageSize, setAuditPageSize] = useState(20);
	const [auditPage, setAuditPage] = useState(1);
	const [auditSelected, setAuditSelected] = useState<Set<string>>(new Set());

	const load = useCallback(async (opts?: { quiet?: boolean }) => {
		if (!opts?.quiet) {
			setLoading(true);
			setError(null);
		}
		try {
			const res = await fetch('/api/admin/projects');
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || '목록을 불러오지 못했습니다.');
			// Firestore `audit_projects` (or Prisma fallback) — no localStorage merge
			setProjects(data.projects || []);
			setAudits(data.recentAudits || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : '목록을 불러오지 못했습니다.');
			if (!opts?.quiet) {
				setProjects([]);
				setAudits([]);
			}
		} finally {
			if (!opts?.quiet) setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const filtered = useMemo(
		() => filterProjects(projects, { search, cms: cmsFilter, category: categoryFilter }),
		[projects, search, cmsFilter, categoryFilter],
	);

	const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
	const allPageSelected =
		pageItems.length > 0 && pageItems.every((p) => selected.has(p.id));

	useEffect(() => {
		setPage(1);
		setSelected(new Set());
	}, [search, cmsFilter, categoryFilter]);

	useEffect(() => {
		if (page > pageCount) setPage(pageCount);
	}, [page, pageCount]);

	const kpi = useMemo(() => computeProjectKpi(projects, audits), [projects, audits]);

	const sortedAudits = useMemo(() => {
		const list = [...audits];
		if (auditSort === 'score-desc') list.sort((a, b) => b.overallScore - a.overallScore);
		else if (auditSort === 'score-asc') list.sort((a, b) => a.overallScore - b.overallScore);
		else list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
		return list;
	}, [audits, auditSort]);

	const auditPageCount = Math.max(1, Math.ceil(sortedAudits.length / auditPageSize));
	const auditPageItems = sortedAudits.slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize);

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		setFormError(null);
		if (!category) {
			setFormError('카테고리를 선택하세요.');
			return;
		}
		setSubmitting(true);
		try {
			const res = await fetch('/api/admin/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, targetUrl: url, category, cmsType }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || '등록에 실패했습니다.');
			setName('');
			setUrl('');
			setCategory('');
			setCmsType('UNKNOWN');
			await load();
		} catch (err) {
			setFormError(err instanceof Error ? err.message : '등록에 실패했습니다.');
		} finally {
			setSubmitting(false);
		}
	}

	function requestDeleteSelected() {
		if (selected.size === 0) return;
		setDeleteError(null);
		setDeleteConfirm({ mode: 'selected', ids: [...selected] });
	}

	function requestDeleteAll() {
		if (projects.length === 0) return;
		setDeleteError(null);
		setDeleteConfirm({ mode: 'all' });
	}

	async function confirmBulkDelete() {
		if (!deleteConfirm || deleting) return;
		setDeleting(true);
		setDeleteError(null);
		const payload =
			deleteConfirm.mode === 'all'
				? { all: true as const }
				: { ids: deleteConfirm.ids };

		try {
			const res = await fetch('/api/admin/projects/bulk-delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || '삭제에 실패했습니다.');

			// Immediate local hydration (no full page reload)
			if (deleteConfirm.mode === 'all') {
				setProjects([]);
				setAudits([]);
				clearGuestAudits();
				notifyAuditHistorySync({ all: true });
			} else {
				const removed = new Set(deleteConfirm.ids);
				setProjects((prev) => prev.filter((p) => !removed.has(p.id)));
				setAudits((prev) =>
					prev.filter((a) => !removed.has(a.projectId || '') && !removed.has(a.auditId)),
				);
				removeGuestAuditsByIds(deleteConfirm.ids);
				notifyAuditHistorySync({ ids: deleteConfirm.ids });
			}
			setSelected(new Set());
			setDeleteConfirm(null);
			await load({ quiet: true });
			// Pick up server revalidatePath('/audit/history' | '/admin/projects') without full reload.
			router.refresh();
		} catch (err) {
			setDeleteError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
		} finally {
			setDeleting(false);
		}
	}

	function toggleAllPage() {
		const pageIds = pageItems.map((p) => p.id);
		if (allPageSelected) {
			setSelected((prev) => {
				const next = new Set(prev);
				for (const id of pageIds) next.delete(id);
				return next;
			});
		} else {
			setSelected((prev) => {
				const next = new Set(prev);
				for (const id of pageIds) next.add(id);
				return next;
			});
		}
	}

	function toggleOne(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	return (
		<div className="flex flex-col gap-5">
			<section className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
				<div>
					<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">프로젝트 관리</p>
					<p className="mt-0.5 text-sm text-slate-600">
						Firestore `audit_projects` 진단 결과를 최신순으로 조회하고, 해결 워크스페이스·프론트 결과 리포트로 연결합니다.
					</p>
				</div>
				<div className="flex flex-wrap gap-3">
					{[
						{ label: '총 프로젝트', value: String(kpi.projectCount) },
						{ label: '오늘 진단', value: String(kpi.todayDiagnosis) },
						{ label: '평균 점수', value: kpi.averageScore != null ? String(kpi.averageScore) : '—' },
					].map((s) => (
						<div key={s.label} className="min-w-[88px] rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-center">
							<em className="block text-[10px] font-semibold not-italic text-slate-500">{s.label}</em>
							<strong className="text-lg font-extrabold tabular-nums text-slate-900">{s.value}</strong>
						</div>
					))}
				</div>
			</section>

			<section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="대시보드 주요 지표">
				{[
					{ label: '총 프로젝트', value: kpi.projectCount, desc: '현재 등록된 프로젝트', bar: null },
					{ label: '평균 SEO 점수', value: kpi.averageSeoScore, desc: null, bar: kpi.averageSeoScore },
					{ label: '평균 GEO 점수', value: kpi.averageGeoScore, desc: null, bar: kpi.averageGeoScore },
					{ label: '이번 달 진단', value: kpi.monthlyDiagnosis, desc: '월간 분석 건수', bar: null },
				].map((card) => (
					<article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
						<em className="text-[11px] font-semibold not-italic text-slate-500">{card.label}</em>
						<strong className="mt-1 block text-2xl font-extrabold tabular-nums text-slate-900">{card.value}</strong>
						{card.bar != null ? (
							<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
								<span className="block h-full rounded-full bg-slate-800" style={{ width: `${Math.min(100, card.bar)}%` }} />
							</div>
						) : (
							<p className="mt-1 text-[11px] text-slate-500">{card.desc}</p>
						)}
					</article>
				))}
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="mb-3 flex items-center justify-between gap-2">
					<h2 className="text-base font-bold text-slate-900">새 프로젝트 등록</h2>
					<span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">+ 새 프로젝트</span>
				</div>
				<form onSubmit={(e) => void handleCreate(e)} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
					<input
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="프로젝트명 (예: 신일푸드)"
						className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
					/>
					<input
						required
						type="url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://example.com"
						className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
					/>
					<select
						required
						value={category}
						onChange={(e) => setCategory(e.target.value)}
						className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
					>
						<option value="" disabled>
							카테고리 선택 (필수)
						</option>
						{PROJECT_CATEGORY_CODES.map((code) => (
							<option key={code} value={code}>
								{PROJECT_CATEGORY_LABELS[code]}
							</option>
						))}
					</select>
					<select
						value={cmsType}
						onChange={(e) => setCmsType(e.target.value)}
						className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
					>
						{CMS_OPTIONS.map((cms) => (
							<option key={cms} value={cms}>
								{cms === 'UNKNOWN' ? 'CMS 자동 감지' : cms}
							</option>
						))}
					</select>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
					>
						{submitting ? '등록 중…' : '등록'}
					</button>
				</form>
				{formError ? (
					<p className="mt-2 text-sm text-rose-600" role="alert">
						{formError}
					</p>
				) : null}
			</section>

			<section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
				<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
					<div className="mb-3">
						<h2 className="text-base font-bold text-slate-900">등록된 프로젝트</h2>
						<p className="text-sm text-slate-500">등록된 사이트의 SEO 진단과 최근 분석 상태를 확인합니다.</p>
					</div>

					<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
						<p className="text-xs font-semibold text-slate-500">전체 {filtered.length}건</p>
						<div className="flex flex-wrap gap-2">
						<input
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="프로젝트명 · URL 검색"
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
						/>
						<select
							value={cmsFilter}
							onChange={(e) => setCmsFilter(e.target.value)}
							className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
						>
								<option value="all">전체 CMS</option>
								{CMS_OPTIONS.map((cms) => (
									<option key={cms} value={cms}>
										{cms}
									</option>
								))}
							</select>
						</div>
					</div>

					<div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="카테고리 필터">
						{(['ALL', ...PROJECT_CATEGORY_CODES] as ProjectCategoryFilter[]).map((code) => {
							const active = categoryFilter === code;
							const label = code === 'ALL' ? '전체' : PROJECT_CATEGORY_LABELS[code];
							return (
								<button
									key={code}
									type="button"
									aria-selected={active}
									onClick={() => setCategoryFilter(code)}
									className={`rounded-md px-2.5 py-1.5 text-[11px] font-bold transition ${
										active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
									}`}
								>
									{label}
								</button>
							);
						})}
					</div>

					<div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
						<label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
							<input
								type="checkbox"
								checked={allPageSelected}
								onChange={toggleAllPage}
								disabled={pageItems.length === 0 || deleting}
								aria-label="전체 선택/해제"
							/>
							전체 선택/해제
							<span className="tabular-nums text-slate-400">
								(선택 <span className="text-slate-900">{selected.size}</span>)
							</span>
						</label>
						<div className="flex gap-2">
							<button
								type="button"
								disabled={selected.size === 0 || deleting}
								onClick={requestDeleteSelected}
								className="rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-700 disabled:opacity-40"
							>
								🗑️ 선택 삭제 ({selected.size})
							</button>
							<button
								type="button"
								disabled={projects.length === 0 || deleting}
								onClick={requestDeleteAll}
								className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-800 disabled:opacity-40"
							>
								⚠️ 전체 삭제
							</button>
						</div>
					</div>

					{loading ? (
						<p className="py-10 text-center text-sm text-slate-500">불러오는 중...</p>
					) : error ? (
						<p className="py-10 text-center text-sm text-rose-600">{error}</p>
					) : pageItems.length === 0 ? (
						<div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center">
							<p className="text-sm font-semibold text-slate-700">등록된 프로젝트가 없습니다.</p>
							<p className="mt-1 text-xs text-slate-500">새 프로젝트를 등록하거나 진단을 실행하면 목록에 표시됩니다.</p>
						</div>
					) : (
						<ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
							{pageItems.map((project) => {
								const isSelected = selected.has(project.id);
								return (
									<li
										key={project.id}
										className={`rounded-xl border bg-slate-50/60 p-4 transition ${
											isSelected
												? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-200'
												: 'border-slate-200 hover:border-slate-300'
										}`}
									>
										<div className="flex items-start gap-2.5">
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => toggleOne(project.id)}
												aria-label={`${project.name} 선택`}
												className="mt-1 h-4 w-4 accent-indigo-600"
											/>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-1.5">
													<span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
														{project.categoryLabel}
													</span>
													<span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
														{project.cmsType}
													</span>
													<span
														className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
															project.status === 'ACTIVE'
																? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
																: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
														}`}
													>
														{project.status}
													</span>
													{project.isLocalOnly ? (
														<span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
															로컬 진단
														</span>
													) : null}
												</div>
												<h3 className="mt-1.5 truncate text-sm font-bold text-slate-900">{project.name}</h3>
												<a
													href={project.targetUrl}
													target="_blank"
													rel="noreferrer"
													className="mt-0.5 block truncate text-xs text-sky-700 hover:underline"
												>
													{project.targetUrl}
												</a>
												<div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
													<span>점수 {project.latestScore ?? '—'}</span>
													<span>결함 {project.defectCount ?? '—'}</span>
													<span>SEO {project.latestSeoScore ?? '—'}</span>
													<span>GEO {project.latestGeoScore ?? '—'}</span>
													<span>진단 {project.auditCount}회</span>
													<span>{new Date(project.createdAt).toLocaleString('ko-KR')}</span>
												</div>
												<div className="mt-3 flex flex-wrap gap-2">
													<Link
														href={`/admin/solve?id=${encodeURIComponent(project.latestAuditId || project.id)}`}
														className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
													>
														🔧 해결 워크스페이스
													</Link>
													<Link
														href={`/audit/result?id=${encodeURIComponent(project.latestAuditId || project.id)}`}
														className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
													>
														🌐 프론트 결과 보기
													</Link>
												</div>
											</div>
										</div>
									</li>
								);
							})}
						</ul>
					)}

					{pageCount > 1 ? (
						<nav className="mt-4 flex items-center justify-center gap-2" aria-label="프로젝트 페이지네이션">
							<button
								type="button"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
								className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 disabled:opacity-40"
							>
								이전
							</button>
							<span className="text-xs font-semibold text-slate-500">
								{page} / {pageCount}
							</span>
							<button
								type="button"
								disabled={page >= pageCount}
								onClick={() => setPage((p) => p + 1)}
								className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 disabled:opacity-40"
							>
								다음
							</button>
						</nav>
					) : null}
				</div>

				<aside className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-label="대시보드 위젯">
					{[
						{ label: '최근 분석', value: kpi.recentLabel, meta: kpi.recentMeta },
						{ label: '오늘 분석', value: String(kpi.todayDiagnosis), meta: '건' },
						{
							label: 'AI 분석 성공률',
							value: kpi.successRate != null ? `${kpi.successRate}%` : '—',
							meta: '완료(COMPLETED) 기준',
						},
						{
							label: '평균 점수',
							value: kpi.averageScore != null ? String(kpi.averageScore) : '—',
							meta: '전체 프로젝트',
						},
						{ label: 'SEO 평균', value: String(kpi.averageSeoScore || '—'), meta: '최근 진단 점수' },
						{ label: 'GEO 평균', value: String(kpi.averageGeoScore || '—'), meta: 'AI 대응 추정 점수' },
						{
							label: '스키마 적용률',
							value: kpi.schemaRate != null ? `${kpi.schemaRate}%` : '—',
							meta: 'CMS 지정 프로젝트 비율',
						},
					].map((w) => (
						<article key={w.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
							<em className="text-[11px] font-semibold not-italic text-slate-500">{w.label}</em>
							<strong className="mt-0.5 block truncate text-base font-extrabold text-slate-900">{w.value}</strong>
							<small className="text-[11px] text-slate-400">{w.meta}</small>
						</article>
					))}
				</aside>
			</section>

			<section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
				<div className="mb-3">
					<h2 className="text-base font-bold text-slate-900">최근 진단 이력</h2>
					<p className="text-sm text-slate-500">최근 실행된 SEO 진단 로그를 한눈에 확인합니다.</p>
				</div>

				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
							정렬
							<select
								value={auditSort}
								onChange={(e) => {
									setAuditSort(e.target.value as typeof auditSort);
									setAuditPage(1);
								}}
							className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
						>
							<option value="newest">최신순</option>
								<option value="score-desc">점수 높은순</option>
								<option value="score-asc">점수 낮은순</option>
							</select>
						</label>
						<span className="text-xs text-slate-500">전체 {sortedAudits.length}건</span>
					</div>
					<label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
						페이지당
						<select
							value={auditPageSize}
							onChange={(e) => {
								setAuditPageSize(Number(e.target.value));
								setAuditPage(1);
							}}
						className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
					>
						<option value={20}>20개</option>
							<option value={50}>50개</option>
							<option value={100}>100개</option>
						</select>
					</label>
				</div>

				<div className="overflow-x-auto rounded-lg border border-slate-100">
					<table className="min-w-full text-left text-sm">
						<thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-3 py-2 font-bold">
									<input
										type="checkbox"
										checked={auditPageItems.length > 0 && auditSelected.size === auditPageItems.length}
										onChange={() => {
											if (auditSelected.size === auditPageItems.length) setAuditSelected(new Set());
											else setAuditSelected(new Set(auditPageItems.map((a) => a.auditId)));
										}}
										aria-label="전체 선택"
									/>
								</th>
								<th className="px-3 py-2 font-bold">프로젝트 / URL</th>
								<th className="px-3 py-2 font-bold">상태</th>
								<th className="px-3 py-2 font-bold">점수</th>
								<th className="px-3 py-2 font-bold">결함</th>
								<th className="px-3 py-2 font-bold">일시</th>
								<th className="px-3 py-2 font-bold">액션</th>
							</tr>
						</thead>
						<tbody>
							{auditPageItems.length === 0 ? (
								<tr>
									<td colSpan={7} className="px-3 py-8 text-center text-slate-500">
										진단 이력이 없습니다.
									</td>
								</tr>
							) : (
								auditPageItems.map((audit) => (
									<tr key={audit.auditId} className="border-t border-slate-100">
										<td className="px-3 py-2">
											<input
												type="checkbox"
												checked={auditSelected.has(audit.auditId)}
												onChange={() => {
													setAuditSelected((prev) => {
														const next = new Set(prev);
														if (next.has(audit.auditId)) next.delete(audit.auditId);
														else next.add(audit.auditId);
														return next;
													});
												}}
											/>
										</td>
										<td className="px-3 py-2">
											<p className="font-semibold text-slate-900">{audit.projectName || '미연결'}</p>
											<p className="truncate text-xs text-slate-500">{audit.targetUrl}</p>
										</td>
										<td className="px-3 py-2 text-xs font-bold text-slate-600">{audit.status}</td>
										<td className="px-3 py-2 font-extrabold tabular-nums text-slate-900">{audit.overallScore}</td>
										<td className="px-3 py-2 font-bold tabular-nums text-rose-700">
											{audit.defectCount ?? '—'}
										</td>
										<td className="px-3 py-2 text-xs text-slate-500">
											{new Date(audit.createdAt).toLocaleString('ko-KR')}
										</td>
										<td className="px-3 py-2">
											<div className="flex flex-wrap items-center gap-2">
												<Link
													href={`/admin/solve?id=${encodeURIComponent(audit.auditId)}`}
													className="text-xs font-bold text-sky-700 hover:underline"
												>
													🔧 해결 열기
												</Link>
												<Link
													href={`/audit/result?id=${encodeURIComponent(audit.auditId)}`}
													className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
												>
													🌐 프론트 결과 보기
												</Link>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{auditPageCount > 1 ? (
					<nav className="mt-3 flex items-center justify-center gap-2" aria-label="진단 이력 페이지네이션">
						<button
							type="button"
							disabled={auditPage <= 1}
							onClick={() => setAuditPage((p) => p - 1)}
							className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 disabled:opacity-40"
						>
							이전
						</button>
						<span className="text-xs font-semibold text-slate-500">
							{auditPage} / {auditPageCount}
						</span>
						<button
							type="button"
							disabled={auditPage >= auditPageCount}
							onClick={() => setAuditPage((p) => p + 1)}
							className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 disabled:opacity-40"
						>
							다음
						</button>
					</nav>
				) : null}
			</section>

			{deleteConfirm ? (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
					role="dialog"
					aria-modal="true"
					aria-labelledby="project-delete-confirm-title"
				>
					<div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
						<h3 id="project-delete-confirm-title" className="text-base font-bold text-slate-900">
							{deleteConfirm.mode === 'all' ? '전체 프로젝트 삭제' : '선택 프로젝트 삭제'}
						</h3>
						<p className="mt-2 text-sm leading-relaxed text-slate-600">
							{deleteConfirm.mode === 'all'
								? '경고: 현재 등록된 전체 프로젝트 데이터가 영구 삭제됩니다. 진행하시겠습니까?'
								: `선택한 ${deleteConfirm.ids.length}개의 프로젝트를 정말 삭제하시겠습니까? (복구 불가)`}
						</p>
						{deleteError ? (
							<p className="mt-2 text-sm text-rose-600" role="alert">
								{deleteError}
							</p>
						) : null}
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								disabled={deleting}
								onClick={() => {
									if (deleting) return;
									setDeleteConfirm(null);
									setDeleteError(null);
								}}
								className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
							>
								취소
							</button>
							<button
								type="button"
								disabled={deleting}
								onClick={() => void confirmBulkDelete()}
								className="rounded-md bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
							>
								{deleting ? '삭제 중…' : '삭제 확인'}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
