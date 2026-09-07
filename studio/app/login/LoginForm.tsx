'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { startTopProgress } from '@/components/common/top-progress';
import { describeNextAuthOAuthError } from '@/lib/auth-kakao-errors';
import { validatePasswordStrength } from '@/lib/auth-account';

type Mode = 'signin' | 'signup';

const fieldClass =
	'rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder-slate-500 focus:border-cyan-500 dark:border-white/[0.08] dark:bg-black/30';

type LoginFormProps = {
	kakaoEnabled: boolean;
	googleEnabled: boolean;
	showOAuthEnvGuide: boolean;
};

export function LoginForm({ kakaoEnabled, googleEnabled, showOAuthEnvGuide }: LoginFormProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get('callbackUrl') || '/';
	const initialMode: Mode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
	const oauthError = describeNextAuthOAuthError(searchParams.get('error'));

	const [mode, setMode] = useState<Mode>(initialMode);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');
	const [phone, setPhone] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(oauthError);

	async function handleEmailSubmit(event: React.FormEvent) {
		event.preventDefault();
		setError(null);
		setLoading(true);
		try {
			if (mode === 'signup') {
				const strengthError = validatePasswordStrength(password);
				if (strengthError) throw new Error(strengthError);
				const res = await fetch('/api/auth/signup', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password, name, phone }),
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
			startTopProgress();
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
				<h1 className="text-2xl font-bold text-slate-900 dark:text-white">
					{mode === 'signin' ? '로그인' : '회원가입'}
				</h1>
				<p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
					{mode === 'signup'
						? '회원가입 시 경쟁사 분석 및 심층 리포트를 위한 5회 무료 진단권이 즉시 지급됩니다.'
						: 'REDUE AI SEO & GEO Studio에 오신 것을 환영합니다.'}
				</p>
			</div>

			<div className="flex flex-col gap-2">
				<button
					type="button"
					disabled={!googleEnabled}
					title={googleEnabled ? undefined : 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 미설정 — .env.local에 등록해야 활성화됩니다.'}
					onClick={() => signIn('google', { callbackUrl })}
					className="flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-950 dark:border-white/[0.08] dark:bg-white/5 dark:hover:bg-white/10"
				>
					Google로 계속하기
				</button>
				<button
					type="button"
					disabled={!kakaoEnabled}
					title={kakaoEnabled ? undefined : 'KAKAO_CLIENT_ID / KAKAO_CLIENT_SECRET 미설정 — .env.local에 등록해야 활성화됩니다.'}
					onClick={() => signIn('kakao', { callbackUrl })}
					className="flex items-center justify-center gap-2 rounded-lg bg-[#FEE500] px-4 py-2.5 text-sm font-semibold text-black/85 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
				>
					카카오로 계속하기
				</button>
				{showOAuthEnvGuide && (
					<p className="text-center text-[11px] text-slate-500">
						{!kakaoEnabled && !googleEnabled
							? '구글/카카오 로그인은 .env.local에 발급받은 Client ID/Secret을 등록해야 활성화됩니다.'
							: !kakaoEnabled
								? '카카오 로그인은 .env.local에 KAKAO_CLIENT_ID(REST API 키)/KAKAO_CLIENT_SECRET을 등록해야 활성화됩니다.'
								: '구글 로그인은 .env.local에 GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET을 등록해야 활성화됩니다.'}
					</p>
				)}
			</div>

			<div className="flex items-center gap-3 text-xs text-slate-500">
				<div className="h-px flex-1 bg-slate-800 dark:bg-white/[0.08]" />
				또는 이메일로 계속하기
				<div className="h-px flex-1 bg-slate-800 dark:bg-white/[0.08]" />
			</div>

			<form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
				{mode === 'signup' && (
					<>
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
							placeholder="연락처 (아이디 찾기용)"
							value={phone}
							onChange={(event) => setPhone(event.target.value)}
							className={fieldClass}
						/>
					</>
				)}
				<input
					type="text"
					required
					autoComplete="username"
					placeholder="아이디 또는 이메일"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					className={fieldClass}
				/>
				<input
					type="password"
					required
					minLength={8}
					placeholder={mode === 'signup' ? '비밀번호 (8자 이상, 영문/숫자/특수문자)' : '비밀번호'}
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					className={fieldClass}
				/>
				{mode === 'signin' ? (
					<div className="flex justify-end gap-2 text-xs text-slate-500">
						<Link href="/find-account?tab=id" className="hover:text-cyan-400">
							아이디 찾기
						</Link>
						<span aria-hidden>|</span>
						<Link href="/find-account?tab=password" className="hover:text-cyan-400">
							비밀번호 찾기
						</Link>
					</div>
				) : null}

				{error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

				<button
					type="submit"
					disabled={loading}
					className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-light disabled:opacity-50"
				>
					{loading ? '처리 중...' : mode === 'signin' ? '로그인' : '회원가입하고 무료 진단 5회 받기'}
				</button>
			</form>

			<button
				type="button"
				onClick={() => {
					setError(null);
					setMode(mode === 'signin' ? 'signup' : 'signin');
				}}
				className="text-center text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
			>
				{mode === 'signin' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
			</button>
		</main>
	);
}
