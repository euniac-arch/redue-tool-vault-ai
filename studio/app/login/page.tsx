'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
	return (
		<Suspense fallback={null}>
			<LoginForm />
		</Suspense>
	);
}

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get('callbackUrl') || '/';

	const [mode, setMode] = useState<Mode>('signin');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleEmailSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		setLoading(true);
		try {
			if (mode === 'signup') {
				const res = await fetch('/api/auth/signup', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password, name }),
				});
				const data = await res.json();
				if (!res.ok) {
					throw new Error(data.error ?? '회원가입 중 오류가 발생했습니다.');
				}
			}

			const result = await signIn('credentials', { email, password, redirect: false });
			if (result?.error) {
				throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
			}
			router.push(callbackUrl);
			router.refresh();
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="mx-auto flex max-w-sm flex-col gap-6 py-10">
			<div className="text-center">
				<h1 className="text-2xl font-bold text-white">
					{mode === 'signin' ? '로그인' : '회원가입'}
				</h1>
				<p className="mt-1 text-sm text-slate-400">REDUE AI SEO & GEO Studio에 오신 것을 환영합니다.</p>
			</div>

			<div className="flex flex-col gap-2">
				<button
					onClick={() => signIn('google', { callbackUrl })}
					className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/10"
				>
					Google로 계속하기
				</button>
				<button
					onClick={() => signIn('kakao', { callbackUrl })}
					className="flex items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 py-2.5 text-sm font-semibold text-black/85 hover:brightness-95"
				>
					카카오로 계속하기
				</button>
				<p className="text-center text-[11px] text-slate-500">
					구글/카카오 로그인은 실제 서비스 배포 시 .env에 발급받은 Client ID/Secret을 등록해야 정상 동작합니다.
				</p>
			</div>

			<div className="flex items-center gap-3 text-xs text-slate-600">
				<div className="h-px flex-1 bg-white/[0.08]" />
				또는 이메일로 계속하기
				<div className="h-px flex-1 bg-white/[0.08]" />
			</div>

			<form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
				{mode === 'signup' && (
					<input
						type="text"
						placeholder="이름"
						value={name}
						onChange={(event) => setName(event.target.value)}
						className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-accent"
					/>
				)}
				<input
					type="email"
					required
					placeholder="이메일"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-accent"
				/>
				<input
					type="password"
					required
					minLength={8}
					placeholder="비밀번호 (8자 이상)"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-accent"
				/>

				{error && <p className="text-sm text-rose-400">{error}</p>}

				<button
					type="submit"
					disabled={loading}
					className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-light disabled:opacity-50"
				>
					{loading ? '처리 중...' : mode === 'signin' ? '로그인' : '회원가입하고 1회 무료 체험 받기'}
				</button>
			</form>

			<button
				onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
				className="text-center text-sm text-slate-400 hover:text-white"
			>
				{mode === 'signin' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
			</button>
		</main>
	);
}
