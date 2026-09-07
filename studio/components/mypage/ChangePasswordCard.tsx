'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { validatePasswordStrength } from '@/lib/auth-account';

const fieldClass =
	'h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-800';

export function ChangePasswordCard() {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [toast, setToast] = useState<string | null>(null);

	const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
	const sameAsCurrent = newPassword.length > 0 && currentPassword.length > 0 && newPassword === currentPassword;
	const strengthError = useMemo(() => (newPassword ? validatePasswordStrength(newPassword) : null), [newPassword]);

	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 2800);
		return () => window.clearTimeout(timer);
	}, [toast]);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		if (strengthError) {
			setError(strengthError);
			return;
		}
		if (mismatch) {
			setError('새 비밀번호가 서로 일치하지 않습니다.');
			return;
		}
		if (sameAsCurrent) {
			setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch('/api/user/change-password', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ currentPassword, newPassword }),
			});
			const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
			if (res.status === 401) {
				window.location.assign('/login?callbackUrl=/mypage?tab=password');
				return;
			}
			if (!res.ok) {
				throw new Error(data.error ?? '비밀번호 변경에 실패했습니다.');
			}
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
			setToast(data.message || '비밀번호가 성공적으로 변경되었습니다.');
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
			<div className="mb-5 flex items-start gap-3">
				<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-600/15 dark:text-blue-300">
					<Shield className="h-4 w-4" aria-hidden />
				</span>
				<div>
					<h2 className="text-sm font-semibold text-slate-900 dark:text-white">비밀번호 변경</h2>
					<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
						현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.
					</p>
				</div>
			</div>

			<p className="mb-5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:border-slate-700/60 dark:bg-slate-800/40 dark:text-slate-400">
				새 비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.
			</p>

			<form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 sm:grid-cols-2">
				<label className="sm:col-span-2">
					<span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">현재 비밀번호</span>
					<input
						type="password"
						autoComplete="current-password"
						required
						value={currentPassword}
						onChange={(event) => setCurrentPassword(event.target.value)}
						className={fieldClass}
					/>
				</label>
				<label>
					<span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">새 비밀번호</span>
					<input
						type="password"
						autoComplete="new-password"
						required
						minLength={8}
						value={newPassword}
						onChange={(event) => setNewPassword(event.target.value)}
						className={fieldClass}
					/>
					{strengthError ? <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{strengthError}</p> : null}
					{!strengthError && sameAsCurrent ? (
						<p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">새 비밀번호는 현재 비밀번호와 달라야 합니다.</p>
					) : null}
				</label>
				<label>
					<span className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">새 비밀번호 확인</span>
					<input
						type="password"
						autoComplete="new-password"
						required
						minLength={8}
						value={confirmPassword}
						onChange={(event) => setConfirmPassword(event.target.value)}
						className={fieldClass}
					/>
					{mismatch ? (
						<p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">새 비밀번호가 서로 일치하지 않습니다.</p>
					) : null}
					{!mismatch && confirmPassword && newPassword === confirmPassword ? (
						<p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">비밀번호가 일치합니다.</p>
					) : null}
				</label>

				{error ? (
					<p className="sm:col-span-2 text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
				) : null}

				<div className="sm:col-span-2 flex justify-end">
					<button
						type="submit"
						disabled={submitting || mismatch || Boolean(strengthError) || sameAsCurrent}
						className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
						{submitting ? '변경 중…' : '비밀번호 변경'}
					</button>
				</div>
			</form>

			{toast ? (
				<div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-lg dark:border-emerald-500/30 dark:bg-[#04101b] dark:text-emerald-300">
					{toast}
				</div>
			) : null}
		</section>
	);
}
