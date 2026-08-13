'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
	extractProjectCode,
	formatProjectLabel,
} from '@/lib/naver-blog/topics';
import type { ProjectListItem } from '@/lib/projects';

export type RecentProjectChip = {
	id: string;
	code: string;
	name: string;
};

type ProjectSearchSelectProps = {
	projects: ProjectListItem[];
	value: string | null;
	onChange: (projectId: string) => void;
	loading?: boolean;
	disabled?: boolean;
};

function matchesQuery(project: ProjectListItem, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	const code = extractProjectCode(project);
	const hay = `${project.name} ${code} ${project.targetUrl} ${project.id}`.toLowerCase();
	return hay.includes(q);
}

export function ProjectSearchSelect({
	projects,
	value,
	onChange,
	loading = false,
	disabled = false,
}: ProjectSearchSelectProps) {
	const listId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');

	const selected = useMemo(
		() => projects.find((p) => p.id === value) ?? null,
		[projects, value],
	);

	const filtered = useMemo(
		() => projects.filter((p) => matchesQuery(p, query)).slice(0, 80),
		[projects, query],
	);

	useEffect(() => {
		if (!open) return;
		function onDoc(e: MouseEvent) {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') setOpen(false);
		}
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	}, [open]);

	useEffect(() => {
		if (!open) {
			setQuery(selected ? formatProjectLabel(selected) : '');
		}
	}, [open, selected]);

	function pick(project: ProjectListItem) {
		onChange(project.id);
		setQuery(formatProjectLabel(project));
		setOpen(false);
	}

	return (
		<div ref={rootRef} className="relative">
			<label className="flex flex-col gap-1.5">
				<span className="text-xs font-semibold text-slate-600">
					진단 프로젝트 / 사이트
				</span>
				<div className="relative">
					<input
						role="combobox"
						aria-expanded={open}
						aria-controls={listId}
						aria-autocomplete="list"
						disabled={disabled || loading}
						value={open ? query : selected ? formatProjectLabel(selected) : query}
						placeholder={
							loading
								? '프로젝트 불러오는 중…'
								: '사이트명 또는 코드 검색...'
						}
						onFocus={() => {
							if (disabled) return;
							setOpen(true);
							setQuery('');
						}}
						onChange={(e) => {
							setQuery(e.target.value);
							setOpen(true);
						}}
						className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-800 outline-none ring-slate-900/10 focus:border-slate-400 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400"
					/>
					<span
						className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400"
						aria-hidden
					>
						<svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
							<path
								fillRule="evenodd"
								d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
								clipRule="evenodd"
							/>
						</svg>
					</span>
				</div>
			</label>

			{open ? (
				<ul
					id={listId}
					role="listbox"
					className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
				>
					{filtered.length === 0 ? (
						<li className="px-3 py-6 text-center text-xs text-slate-500">
							검색 결과가 없습니다. 사이트명·프로젝트 코드를 확인해 주세요.
						</li>
					) : (
						filtered.map((project) => {
							const code = extractProjectCode(project);
							const active = project.id === value;
							return (
								<li key={project.id} role="option" aria-selected={active}>
									<button
										type="button"
										onClick={() => pick(project)}
										className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
											active ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
										}`}
									>
										<span
											className={`text-sm font-semibold ${
												active ? 'text-white' : 'text-slate-900'
											}`}
										>
											<span
												className={`mr-1.5 font-mono text-[11px] ${
													active ? 'text-slate-300' : 'text-slate-500'
												}`}
											>
												[{code}]
											</span>
											{project.name}
										</span>
										<span
											className={`truncate text-[11px] ${
												active ? 'text-slate-300' : 'text-slate-500'
											}`}
										>
											{project.targetUrl}
											{project.categoryLabel ? ` · ${project.categoryLabel}` : ''}
										</span>
									</button>
								</li>
							);
						})
					)}
				</ul>
			) : null}
		</div>
	);
}
