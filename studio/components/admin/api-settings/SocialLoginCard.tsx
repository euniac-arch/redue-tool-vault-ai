'use client';

import { KeyRound, Loader2, MessageCircle, PlugZap } from 'lucide-react';
import type { ConnectionStatus, SocialLoginConfig } from '@/lib/admin/apiConfigService';
import { ConnectionStatusBadge } from './api-settings-badges';
import { SecretKeyField } from './SecretKeyField';

const CARD =
	'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800';

interface SocialLoginCardProps {
	value: SocialLoginConfig;
	kakaoStatus: ConnectionStatus;
	googleStatus: ConnectionStatus;
	testingTarget: 'kakao' | 'google' | null;
	kakaoTest: { message: string | null; ok: boolean | null };
	googleTest: { message: string | null; ok: boolean | null };
	onChange: (next: SocialLoginConfig) => void;
	onTest: (target: 'kakao' | 'google') => void;
}

export function SocialLoginCard({
	value,
	kakaoStatus,
	googleStatus,
	testingTarget,
	kakaoTest,
	googleTest,
	onChange,
	onTest,
}: SocialLoginCardProps) {
	const patch = (key: keyof SocialLoginConfig, next: string) => onChange({ ...value, [key]: next });

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<article className={CARD}>
				<header className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:ring-yellow-800">
							<MessageCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
						</span>
						<div>
							<h2 className="text-base font-bold text-slate-900 dark:text-slate-100">카카오 로그인</h2>
							<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
								카카오 디벨로퍼스 앱 키와 Redirect URI를 맞춥니다.
							</p>
						</div>
					</div>
					<ConnectionStatusBadge status={kakaoStatus} />
				</header>

				<div className="mt-5 grid gap-4">
					<SecretKeyField
						id="kakao-rest-key"
						label="REST API Key"
						value={value.kakaoRestApiKey}
						onChange={(next) => patch('kakaoRestApiKey', next)}
						placeholder="REST API Key"
					/>
					<SecretKeyField
						id="kakao-js-key"
						label="JavaScript Key"
						value={value.kakaoJavascriptKey}
						onChange={(next) => patch('kakaoJavascriptKey', next)}
						placeholder="JavaScript Key"
					/>
					<SecretKeyField
						id="kakao-redirect-uri"
						label="Redirect URI"
						value={value.kakaoRedirectUri}
						onChange={(next) => patch('kakaoRedirectUri', next)}
						placeholder="https://your-domain/api/auth/callback/kakao"
						masked={false}
						hint="카카오 콘솔 Redirect URI와 동일해야 합니다. 우측 아이콘으로 원클릭 복사하세요."
					/>
				</div>

				<footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
					<p
						className={`text-xs font-semibold ${
							kakaoTest.ok === true
								? 'text-emerald-600 dark:text-emerald-400'
								: kakaoTest.ok === false
									? 'text-rose-600 dark:text-rose-400'
									: 'text-slate-500 dark:text-slate-400'
						}`}
						role="status"
					>
						{testingTarget === 'kakao'
							? '연결을 확인하는 중…'
							: kakaoTest.message ?? 'REST API Key가 있으면 연결을 시험합니다.'}
					</p>
					<button
						type="button"
						onClick={() => onTest('kakao')}
						disabled={testingTarget !== null}
						className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
					>
						{testingTarget === 'kakao' ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<PlugZap className="h-3.5 w-3.5" />
						)}
						연결 테스트
					</button>
				</footer>
			</article>

			<article className={CARD}>
				<header className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-800">
							<KeyRound className="h-5 w-5" strokeWidth={1.75} aria-hidden />
						</span>
						<div>
							<h2 className="text-base font-bold text-slate-900 dark:text-slate-100">구글 로그인</h2>
							<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
								Google Cloud OAuth 2.0 클라이언트 정보를 입력합니다.
							</p>
						</div>
					</div>
					<ConnectionStatusBadge status={googleStatus} />
				</header>

				<div className="mt-5 grid gap-4">
					<SecretKeyField
						id="google-client-id"
						label="OAuth Client ID"
						value={value.googleClientId}
						onChange={(next) => patch('googleClientId', next)}
						placeholder="xxxxx.apps.googleusercontent.com"
						masked={false}
					/>
					<SecretKeyField
						id="google-client-secret"
						label="Client Secret"
						value={value.googleClientSecret}
						onChange={(next) => patch('googleClientSecret', next)}
						placeholder="GOCSPX-..."
					/>
				</div>

				<footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
					<p
						className={`text-xs font-semibold ${
							googleTest.ok === true
								? 'text-emerald-600 dark:text-emerald-400'
								: googleTest.ok === false
									? 'text-rose-600 dark:text-rose-400'
									: 'text-slate-500 dark:text-slate-400'
						}`}
						role="status"
					>
						{testingTarget === 'google'
							? '연결을 확인하는 중…'
							: googleTest.message ?? 'Client ID와 Secret이 모두 있어야 연결됩니다.'}
					</p>
					<button
						type="button"
						onClick={() => onTest('google')}
						disabled={testingTarget !== null}
						className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
					>
						{testingTarget === 'google' ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<PlugZap className="h-3.5 w-3.5" />
						)}
						연결 테스트
					</button>
				</footer>
			</article>
		</div>
	);
}
