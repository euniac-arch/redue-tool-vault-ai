'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { validatePasswordStrength } from '@/lib/auth-account';

const fieldClass =
	'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder-slate-500 focus:border-cyan-500';

export function ResetPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const email = searchParams.get('email') || '';
	const token = searchParams.get('token') || '';
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	const missingLink = !email || !token;

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		const strengthError = validatePasswordStrength(password);
		if (strengthError) {
			setError(strengthError);
			return;
		}
		if (password !== confirm) {
			setError('비밀번호가 서로 일치하지 않습니다.');
			return;
		}
		setLoading(true);
		try {
			const res = await fetch('/api/auth/reset-password/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, token, password }),
			});
			const data = (await res.json()) as { error?: string };
			if (!res.ok) throw new Error(data.error ?? '비밀번호 변경에 실패했습니다.');
			setDone(true);
			window.setTimeout(() => router.push('/login'), 1600);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="mx-auto flex w-full max-w-sm flex-col gap-6 py-10">
			<div className="text-center">
				<h1 className="text-2xl font-bold text-white">비밀번호 재설정</h1>
				<p className="mt-1 text-sm text-slate-300">새 비밀번호는 8자 이상, 영문/숫자/특수문자를 포함해야 합니다.</p>
			</div>

			{missingLink ? (
				<div className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
					<p>유효한 재설정 링크가 아닙니다. 비밀번호 찾기에서 메일을 다시 요청해 주세요.</p>
					<Link href="/find-account?tab=password" className="mt-4 inline-block font-semibold text-cyan-300 hover:underline">
						비밀번호 찾기로 이동
					</Link>
				</div>
			) : done ? (
				<div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-sm text-emerald-100">
					비밀번호가 변경되었습니다. 로그인 페이지로 이동합니다.
				</div>
			) : (
				<form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3">
					<input type="email" value={email} readOnly className={`${fieldClass} opacity-70`} />
					<input
						type="password"
						required
						minLength={8}
						placeholder="새 비밀번호"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						className={fieldClass}
					/>
					<input
						type="password"
						required
						minLength={8}
						placeholder="새 비밀번호 확인"
						value={confirm}
						onChange={(event) => setConfirm(event.target.value)}
						className={fieldClass}
					/>
					{error ? <p className="text-sm text-rose-400">{error}</p> : null}
					<button
						type="submit"
						disabled={loading}
						className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
					>
						{loading ? '변경 중...' : '새 비밀번호 저장'}
					</button>
				</form>
			)}

			<Link href="/login" className="text-center text-sm text-slate-400 hover:text-white">
				로그인으로 돌아가기
			</Link>
		</main>
	);
}
