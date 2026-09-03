'use client';

import { useEffect, useMemo, useState } from 'react';
import { projectDisplayName, type ProjectListItem } from '@/lib/projects';

type BaselineDraft = {
	overall: string;
	seo: string;
	performance: string;
	schema: string;
	geo: string;
};

interface ProjectEditModalProps {
	project: ProjectListItem;
	saving: boolean;
	onClose: () => void;
	onSave: (customBaseline: ProjectListItem['customBaseline']) => void;
}

function toDraft(baseline: ProjectListItem['customBaseline']): BaselineDraft {
	return {
		overall: baseline?.overall != null ? String(baseline.overall) : '',
		seo: baseline?.seo != null ? String(baseline.seo) : '',
		performance: baseline?.performance != null ? String(baseline.performance) : '',
		schema: baseline?.schema != null ? String(baseline.schema) : '',
		geo: baseline?.geo != null ? String(baseline.geo) : '',
	};
}

function parseField(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const n = Number(trimmed);
	if (!Number.isFinite(n) || n < 0 || n > 100) return null;
	return Math.round(n);
}

export function ProjectEditModal({ project, saving, onClose, onSave }: ProjectEditModalProps) {
	const [draft, setDraft] = useState<BaselineDraft>(() => toDraft(project.customBaseline));
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setDraft(toDraft(project.customBaseline));
		setError(null);
	}, [project]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && !saving) onClose();
		};
		window.addEventListener('keydown', onKey);
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('keydown', onKey);
			document.body.style.overflow = previous;
		};
	}, [onClose, saving]);

	const fields = useMemo(
		() =>
			[
				{ key: 'overall', label: '종합 점수', required: true },
				{ key: 'seo', label: 'SEO 기술 기본기' },
				{ key: 'performance', label: '웹 성능 & CWV' },
				{ key: 'schema', label: '스키마 구조화' },
				{ key: 'geo', label: 'AI 신뢰도 & GEO' },
			] as const,
		[],
	);

	function handleSave() {
		const overall = parseField(draft.overall);
		if (draft.overall.trim() && overall == null) {
			setError('종합 점수는 0–100 사이 숫자여야 합니다.');
			return;
		}
		if (!draft.overall.trim()) {
			onSave(null);
			return;
		}
		const next = {
			overall: overall as number,
			seo: parseField(draft.seo),
			performance: parseField(draft.performance),
			schema: parseField(draft.schema),
			geo: parseField(draft.geo),
		};
		if (
			(draft.seo.trim() && next.seo == null) ||
			(draft.performance.trim() && next.performance == null) ||
			(draft.schema.trim() && next.schema == null) ||
			(draft.geo.trim() && next.geo == null)
		) {
			setError('세부 점수는 비우거나 0–100 사이 숫자여야 합니다.');
			return;
		}
		onSave(next);
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
			role="presentation"
			onClick={() => {
				if (!saving) onClose();
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="project-edit-title"
				className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
				onClick={(event) => event.stopPropagation()}
			>
				<p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-600 dark:text-cyan-400">
					프로젝트 수정
				</p>
				<h3 id="project-edit-title" className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
					{projectDisplayName(project)}
				</h3>
				<p className="mt-1 truncate text-xs text-slate-500">{project.targetUrl}</p>

				<section className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
					<h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">초기 베이스라인 점수 설정</h4>
					<p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
						첫 진단이 이미 최적화 이후라면 Before로 쓸 점수를 직접 지정하세요. 비우면 첫 진단 로그를
						쓰고, 로그도 이미 85점 이상이면 스키마 주입 전 상태로 역산합니다.
					</p>
					<div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
						{fields.map((field) => (
							<label key={field.key} className="flex flex-col gap-1">
								<span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
									{field.label}
									{field.required ? <span className="ml-1 text-cyan-600">필수</span> : null}
								</span>
								<input
									type="number"
									min={0}
									max={100}
									inputMode="numeric"
									value={draft[field.key]}
									onChange={(event) => {
										setDraft((prev) => ({ ...prev, [field.key]: event.target.value }));
										setError(null);
									}}
									placeholder={field.key === 'overall' ? '예: 58' : '선택'}
									className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
								/>
							</label>
						))}
					</div>
					<button
						type="button"
						disabled={saving}
						onClick={() => {
							setDraft({ overall: '', seo: '', performance: '', schema: '', geo: '' });
							setError(null);
						}}
						className="mt-3 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:text-slate-400"
					>
						입력값 비우고 자동 계산 사용
					</button>
				</section>

				{error ? (
					<p className="mt-3 text-sm text-rose-600" role="alert">
						{error}
					</p>
				) : null}

				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						disabled={saving}
						onClick={onClose}
						className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
					>
						취소
					</button>
					<button
						type="button"
						disabled={saving}
						onClick={handleSave}
						className="rounded-md bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-60"
					>
						{saving ? '저장 중…' : '베이스라인 저장'}
					</button>
				</div>
			</div>
		</div>
	);
}
