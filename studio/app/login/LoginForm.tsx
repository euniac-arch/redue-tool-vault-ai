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
	'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500 dark:border-white/[0.08] dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/30';

function GoogleIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
			<path
				fill="#4285F4"
				d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.86c2.26-2.08 3.59-5.14 3.59-8.66z"
			/>
			<path
				fill="#34A853"
				d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.86-3.01c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.12-6.73-4.96H1.24v3.11C3.2 21.3 7.26 24 12 24z"
			/>
			<path
				fill="#FBBC05"
				d="M5.27 14.26A7.14 7.14 0 0 1 4.9 12c0-.78.14-1.54.37-2.26V6.63H1.24A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.24 5.37l4.03-3.11z"
			/>
			<path
				fill="#EA4335"
				d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.26 0 3.2 2.7 1.24 6.63l4.03 3.11C6.22 6.9 8.87 4.75 12 4.75z"
			/>
		</svg>
	);
}

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
					className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:border-white/[0.08] dark:bg-white/5 dark:text-slate-100 dark:shadow-none dark:hover:bg-white/10"
				>
					<GoogleIcon />
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

			<div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-500">
				<div className="h-px flex-1 bg-slate-200 dark:bg-white/[0.08]" />
				또는 이메일로 계속하기
				<div className="h-px flex-1 bg-slate-200 dark:bg-white/[0.08]" />
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
						<Link href="/find-account?tab=id" className="hover:text-cyan-600 dark:hover:text-cyan-400">
							아이디 찾기
						</Link>
						<span aria-hidden>|</span>
						<Link href="/find-account?tab=password" className="hover:text-cyan-600 dark:hover:text-cyan-400">
							비밀번호 찾기
						</Link>
					</div>
				) : null}

				{error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

				<button
					type="submit"
					disabled={loading}
					className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50"
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
