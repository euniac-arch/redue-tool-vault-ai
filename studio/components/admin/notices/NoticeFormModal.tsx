'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Pin, Save, Sparkles, X } from 'lucide-react';
import {
	DEFAULT_NOTICE_DRAFT,
	type Notice,
	type NoticeDraft,
	type NoticeStatus,
	type NoticeTarget,
	type NoticeType,
} from '@/lib/admin/notice-management';

const TYPE_OPTIONS: { value: NoticeType; label: string }[] = [
	{ value: 'notice', label: '일반안내' },
	{ value: 'system', label: '시스템점검' },
	{ value: 'event', label: '이벤트' },
];

const TARGET_OPTIONS: { value: NoticeTarget; label: string }[] = [
	{ value: 'all', label: '전체' },
	{ value: 'user', label: '일반사용자' },
	{ value: 'admin', label: '운영진' },
];

const STATUS_OPTIONS: { value: NoticeStatus; label: string }[] = [
	{ value: 'published', label: '게시중' },
	{ value: 'draft', label: '임시저장' },
	{ value: 'archived', label: '보관' },
];

const INPUT_CLASS =
	'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500';

interface NoticeFormModalProps {
	notice: Notice | null;
	onClose: () => void;
	onSubmit: (draft: NoticeDraft) => Promise<void>;
}

export function NoticeFormModal({ notice, onClose, onSubmit }: NoticeFormModalProps) {
	const [draft, setDraft] = useState<NoticeDraft>(() =>
		notice
			? {
					type: notice.type,
					title: notice.title,
					content: notice.content,
					target: notice.target,
					isPinned: notice.isPinned,
					isPopup: notice.isPopup,
					status: notice.status,
				}
			: DEFAULT_NOTICE_DRAFT,
	);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	const isEdit = Boolean(notice);
	const canSubmit = draft.title.trim().length > 0 && draft.content.trim().length > 0 && !submitting;

	async function handleSubmit(saveAsStatus?: NoticeStatus) {
		if (!canSubmit) return;
		setSubmitting(true);
		setError(null);
		try {
			await onSubmit(saveAsStatus ? { ...draft, status: saveAsStatus } : draft);
		} catch (err) {
			setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
			setSubmitting(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
			<button
				type="button"
				className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
				aria-label="모달 닫기"
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="notice-form-title"
				className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-800 dark:border-slate-700"
			>
				<header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
					<div>
						<p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
							{isEdit ? notice?.id : 'New Notice'}
						</p>
						<h2 id="notice-form-title" className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100">
							{isEdit ? '공지 수정' : '새 공지 등록'}
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
						aria-label="닫기"
					>
						<X className="h-4 w-4" />
					</button>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
					<div className="grid gap-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<Field label="유형">
								<select
									className={INPUT_CLASS}
									value={draft.type}
									onChange={(event) => setDraft((prev) => ({ ...prev, type: event.target.value as NoticeType }))}
								>
									{TYPE_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</Field>
							<Field label="노출 대상">
								<select
									className={INPUT_CLASS}
									value={draft.target}
									onChange={(event) => setDraft((prev) => ({ ...prev, target: event.target.value as NoticeTarget }))}
								>
									{TARGET_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</Field>
						</div>

						<Field label="제목">
							<input
								type="text"
								value={draft.title}
								onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
								placeholder="공지 제목을 입력하세요"
								className={INPUT_CLASS}
								autoFocus
							/>
						</Field>

						<Field label="내용">
							<textarea
								value={draft.content}
								onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
								placeholder="공지 내용을 입력하세요"
								rows={6}
								className={`${INPUT_CLASS} resize-y`}
							/>
						</Field>

						<div className="grid gap-3 sm:grid-cols-2">
							<Field label="게시 상태">
								<select
									className={INPUT_CLASS}
									value={draft.status}
									onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value as NoticeStatus }))}
								>
									{STATUS_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</Field>
							<div className="flex items-end gap-4 pb-1.5">
								<label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
									<input
										type="checkbox"
										checked={draft.isPinned}
										onChange={(event) => setDraft((prev) => ({ ...prev, isPinned: event.target.checked }))}
										className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 dark:text-slate-100 dark:border-slate-600"
									/>
									<Pin className="h-3.5 w-3.5 text-rose-500" aria-hidden />
									상단 고정
								</label>
								<label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
									<input
										type="checkbox"
										checked={draft.isPopup}
										onChange={(event) => setDraft((prev) => ({ ...prev, isPopup: event.target.checked }))}
										className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/20 dark:text-slate-100 dark:border-slate-600"
									/>
									<Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden />
									팝업 노출
								</label>
							</div>
						</div>

						{error && (
							<p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
								{error}
							</p>
						)}
					</div>
				</div>

				<footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
					>
						취소
					</button>
					{!isEdit && (
						<button
							type="button"
							disabled={!canSubmit}
							onClick={() => handleSubmit('draft')}
							className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
						>
							임시저장
						</button>
					)}
					<button
						type="button"
						disabled={!canSubmit}
						onClick={() => handleSubmit(isEdit ? undefined : 'published')}
						className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
						{isEdit ? '저장' : '게시하기'}
					</button>
				</footer>
			</div>
		</div>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
			{children}
		</label>
	);
}
