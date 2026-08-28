'use client';

import { Flame, Loader2, PlugZap } from 'lucide-react';
import type { ConnectionStatus, FirebaseConfig } from '@/lib/admin/apiConfigService';
import { ConnectionStatusBadge } from './api-settings-badges';
import { SecretKeyField } from './SecretKeyField';

const CARD =
	'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800';

interface FirebaseSettingsCardProps {
	value: FirebaseConfig;
	status: ConnectionStatus;
	testing: boolean;
	testMessage: string | null;
	testOk: boolean | null;
	onChange: (next: FirebaseConfig) => void;
	onTest: () => void;
}

export function FirebaseSettingsCard({
	value,
	status,
	testing,
	testMessage,
	testOk,
	onChange,
	onTest,
}: FirebaseSettingsCardProps) {
	const patch = (key: keyof FirebaseConfig, next: string) => onChange({ ...value, [key]: next });

	return (
		<article className={CARD}>
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-800">
						<Flame className="h-5 w-5" strokeWidth={1.75} aria-hidden />
					</span>
					<div>
						<h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Firebase 설정</h2>
						<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
							클라이언트 SDK 공개 구성값입니다. 콘솔의 웹 앱 설정과 동일해야 합니다.
						</p>
					</div>
				</div>
				<ConnectionStatusBadge status={status} />
			</header>

			<div className="mt-5 grid gap-4 sm:grid-cols-2">
				<SecretKeyField
					id="firebase-api-key"
					label="API Key"
					value={value.apiKey}
					onChange={(next) => patch('apiKey', next)}
					placeholder="AIzaSy..."
					hint="눈 아이콘으로 표시/숨김을 전환합니다."
				/>
				<SecretKeyField
					id="firebase-auth-domain"
					label="Auth Domain"
					value={value.authDomain}
					onChange={(next) => patch('authDomain', next)}
					placeholder="your-project.firebaseapp.com"
					masked={false}
				/>
				<SecretKeyField
					id="firebase-project-id"
					label="Project ID"
					value={value.projectId}
					onChange={(next) => patch('projectId', next)}
					placeholder="your-project-id"
					masked={false}
				/>
				<SecretKeyField
					id="firebase-storage-bucket"
					label="Storage Bucket"
					value={value.storageBucket}
					onChange={(next) => patch('storageBucket', next)}
					placeholder="your-project.appspot.com"
					masked={false}
				/>
				<div className="sm:col-span-2">
					<SecretKeyField
						id="firebase-app-id"
						label="App ID"
						value={value.appId}
						onChange={(next) => patch('appId', next)}
						placeholder="1:000000000000:web:abcdef"
						masked={false}
					/>
				</div>
			</div>

			<footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-700">
				<p
					className={`text-xs font-semibold ${
						testOk === true
							? 'text-emerald-600 dark:text-emerald-400'
							: testOk === false
								? 'text-rose-600 dark:text-rose-400'
								: 'text-slate-500 dark:text-slate-400'
					}`}
					role="status"
				>
					{testing ? '연결을 확인하는 중…' : testMessage ?? '저장 전에도 현재 입력값으로 연결을 시험할 수 있습니다.'}
				</p>
				<button
					type="button"
					onClick={onTest}
					disabled={testing}
					className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
				>
					{testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
					Firebase 연결 테스트
				</button>
			</footer>
		</article>
	);
}
