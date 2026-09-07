'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Tab = 'id' | 'password';

const fieldClass =
	'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder-slate-500 focus:border-cyan-500';

export function FindAccountForm() {
	const searchParams = useSearchParams();
	const initialTab: Tab = searchParams.get('tab') === 'password' ? 'password' : 'id';
	const [tab, setTab] = useState<Tab>(initialTab);
	const [name, setName] = useState('');
	const [phone, setPhone] = useState('');
	const [email, setEmail] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
	const [toast, setToast] = useState<string | null>(null);

	useEffect(() => {
		setTab(searchParams.get('tab') === 'password' ? 'password' : 'id');
	}, [searchParams]);

	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 3200);
		return () => window.clearTimeout(timer);
	}, [toast]);

	async function handleFindId(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		setMaskedEmail(null);
		setLoading(true);
		try {
			const res = await fetch('/api/auth/find-account', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, phone }),
			});
			const data = (await res.json()) as { email?: string; error?: string };
			if (!res.ok) throw new Error(data.error ?? '계정을 찾지 못했습니다.');
			setMaskedEmail(data.email || null);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	async function handleResetRequest(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		setLoading(true);
		try {
			const res = await fetch('/api/auth/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email }),
			});
			const data = (await res.json()) as { error?: string; message?: string };
			if (!res.ok) throw new Error(data.error ?? '재설정 메일 발송에 실패했습니다.');
			setToast(data.message || '비밀번호 재설정 링크가 이메일로 발송되었습니다.');
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="mx-auto flex w-full max-w-sm flex-col gap-6 py-10">
			<div className="text-center">
				<h1 className="text-2xl font-bold text-white">계정 찾기</h1>
				<p className="mt-1 text-sm text-slate-300">가입 시 등록한 정보로 아이디를 확인하거나 비밀번호를 재설정합니다.</p>
			</div>

			<div className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
				<button
					type="button"
					onClick={() => {
						setError(null);
						setTab('id');
					}}
					className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
						tab === 'id' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
					}`}
				>
					아이디(이메일) 찾기
				</button>
				<button
					type="button"
					onClick={() => {
						setError(null);
						setTab('password');
					}}
					className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
						tab === 'password' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
					}`}
				>
					비밀번호 재설정
				</button>
			</div>

			{tab === 'id' ? (
				<form onSubmit={(event) => void handleFindId(event)} className="flex flex-col gap-3">
					<input
						type="text"
						required
						placeholder="이름"
						value={name}
						onChange={(event) => setName(event.target.value)}
						className={fieldClass}
					/>
					<input
						type="tel"
						required
						placeholder="연락처 (숫자만 입력)"
						value={phone}
						onChange={(event) => setPhone(event.target.value)}
						className={fieldClass}
					/>
					{maskedEmail ? (
						<p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
							가입된 이메일: <span className="font-bold">{maskedEmail}</span>
						</p>
					) : null}
					{error ? <p className="text-sm text-rose-400">{error}</p> : null}
					<button
						type="submit"
						disabled={loading}
						className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
					>
						{loading ? '확인 중...' : '이메일 계정 확인'}
					</button>
				</form>
			) : (
				<form onSubmit={(event) => void handleResetRequest(event)} className="flex flex-col gap-3">
					<input
						type="email"
						required
						placeholder="가입된 이메일"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						className={fieldClass}
					/>
					<p className="text-xs text-slate-400">가입된 이메일로 비밀번호 재설정 링크를 보내드립니다.</p>
					{error ? <p className="text-sm text-rose-400">{error}</p> : null}
					<button
						type="submit"
						disabled={loading}
						className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-50"
					>
						{loading ? '발송 중...' : '재설정 메일 발송'}
					</button>
				</form>
			)}

			<Link href="/login" className="text-center text-sm text-slate-400 hover:text-white">
				로그인으로 돌아가기
			</Link>

			{toast ? (
				<div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-cyan-400/30 bg-[#04101b] px-4 py-2.5 text-sm font-semibold text-cyan-100 shadow-lg">
					{toast}
				</div>
			) : null}
		</main>
	);
}
