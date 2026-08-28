'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, KeyRound, Loader2, MessageCircle, Save, Sparkles, TriangleAlert } from 'lucide-react';
import {
	fetchApiConfig,
	saveApiConfig,
	testApiConnection,
	type ApiConfig,
	type TestableTarget,
} from '@/lib/admin/apiConfigService';
import { ConnectionStatusBar } from './ConnectionStatusBar';
import { FirebaseSettingsCard } from './FirebaseSettingsCard';
import { LlmApiKeyCard } from './LlmApiKeyCard';
import { SocialLoginCard } from './SocialLoginCard';

type SettingsTab = 'firebase' | 'llm' | 'social';

const TABS: { id: SettingsTab; label: string; description: string; icon: typeof Flame }[] = [
	{ id: 'firebase', label: 'Firebase 설정', description: 'SDK 공개 구성', icon: Flame },
	{ id: 'llm', label: 'AI & LLM API Key', description: 'Gemini · OpenAI', icon: Sparkles },
	{ id: 'social', label: '소셜 로그인 API', description: '카카오 · 구글', icon: MessageCircle },
];

type Toast = { id: number; message: string; tone: 'success' | 'error' };

type TestFeedback = { message: string | null; ok: boolean | null };

const EMPTY_TEST: TestFeedback = { message: null, ok: null };

export function ApiSettingsDashboard() {
	const [config, setConfig] = useState<ApiConfig | null>(null);
	const [baseline, setBaseline] = useState<ApiConfig | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [tab, setTab] = useState<SettingsTab>('firebase');
	const [testingTarget, setTestingTarget] = useState<TestableTarget | null>(null);
	const [tests, setTests] = useState<Record<TestableTarget, TestFeedback>>({
		firebase: EMPTY_TEST,
		llm: EMPTY_TEST,
		kakao: EMPTY_TEST,
		google: EMPTY_TEST,
	});
	const [toasts, setToasts] = useState<Toast[]>([]);

	const pushToast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
		const id = Date.now() + Math.random();
		setToasts((prev) => [...prev, { id, message, tone }]);
		window.setTimeout(() => {
			setToasts((prev) => prev.filter((item) => item.id !== id));
		}, 2600);
	}, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const next = await fetchApiConfig();
				if (cancelled) return;
				setConfig(next);
				setBaseline(next);
			} catch (error) {
				if (cancelled) return;
				pushToast(error instanceof Error ? error.message : '설정을 불러오지 못했습니다.', 'error');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [pushToast]);

	const dirty = useMemo(() => {
		if (!config || !baseline) return false;
		return (
			JSON.stringify({ firebase: config.firebase, llm: config.llm, social: config.social }) !==
			JSON.stringify({ firebase: baseline.firebase, llm: baseline.llm, social: baseline.social })
		);
	}, [baseline, config]);

	async function handleSave() {
		if (!config || saving) return;
		setSaving(true);
		try {
			const result = await saveApiConfig({
				firebase: config.firebase,
				llm: config.llm,
				social: config.social,
			});
			setConfig(result.config);
			setBaseline(result.config);
			pushToast(result.message, 'success');
		} catch (error) {
			pushToast(error instanceof Error ? error.message : '저장에 실패했습니다.', 'error');
		} finally {
			setSaving(false);
		}
	}

	async function handleTest(target: TestableTarget) {
		if (!config || testingTarget) return;
		setTestingTarget(target);
		setTests((prev) => ({ ...prev, [target]: { message: null, ok: null } }));
		try {
			const result = await testApiConnection(target, {
				firebase: config.firebase,
				llm: config.llm,
				social: config.social,
			});
			setConfig((prev) => (prev ? { ...prev, statuses: result.config.statuses } : result.config));
			setTests((prev) => ({ ...prev, [target]: { message: result.message, ok: result.ok } }));
			pushToast(result.message, result.ok ? 'success' : 'error');
		} catch (error) {
			const message = error instanceof Error ? error.message : '연결 테스트에 실패했습니다.';
			setTests((prev) => ({ ...prev, [target]: { message, ok: false } }));
			pushToast(message, 'error');
		} finally {
			setTestingTarget(null);
		}
	}

	if (loading || !config) {
		return (
			<div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 py-16 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
				연동 설정을 불러오는 중…
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-5">
			<ConnectionStatusBar statuses={config.statuses} />

			<nav
				className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-3 dark:border-slate-700 dark:bg-slate-800"
				aria-label="연동 설정 탭"
			>
				{TABS.map((item) => {
					const active = tab === item.id;
					const Icon = item.icon;
					return (
						<button
							key={item.id}
							type="button"
							onClick={() => setTab(item.id)}
							aria-pressed={active}
							className={`flex items-center gap-2.5 rounded-lg px-3 py-3 text-left transition ${
								active
									? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
									: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100'
							}`}
						>
							<span
								className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
									active
										? 'bg-white/15 text-white dark:bg-slate-900/10 dark:text-slate-950'
										: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
								}`}
							>
								<Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
							</span>
							<span className="min-w-0">
								<span className="block text-sm font-bold leading-tight">{item.label}</span>
								<span className={`block text-[11px] font-medium ${active ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'}`}>
									{item.description}
								</span>
							</span>
						</button>
					);
				})}
			</nav>

			{tab === 'firebase' ? (
				<FirebaseSettingsCard
					value={config.firebase}
					status={config.statuses.firebase}
					testing={testingTarget === 'firebase'}
					testMessage={tests.firebase.message}
					testOk={tests.firebase.ok}
					onChange={(firebase) => setConfig((prev) => (prev ? { ...prev, firebase } : prev))}
					onTest={() => handleTest('firebase')}
				/>
			) : null}

			{tab === 'llm' ? (
				<LlmApiKeyCard
					value={config.llm}
					status={config.statuses.gemini}
					testing={testingTarget === 'llm'}
					testMessage={tests.llm.message}
					testOk={tests.llm.ok}
					onChange={(llm) => setConfig((prev) => (prev ? { ...prev, llm } : prev))}
					onTest={() => handleTest('llm')}
				/>
			) : null}

			{tab === 'social' ? (
				<SocialLoginCard
					value={config.social}
					kakaoStatus={config.statuses.kakao}
					googleStatus={config.statuses.google}
					testingTarget={testingTarget === 'kakao' || testingTarget === 'google' ? testingTarget : null}
					kakaoTest={tests.kakao}
					googleTest={tests.google}
					onChange={(social) => setConfig((prev) => (prev ? { ...prev, social } : prev))}
					onTest={(target) => handleTest(target)}
				/>
			) : null}

			<div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
				<div className="min-w-0">
					<p className="text-sm font-bold text-slate-900 dark:text-slate-100">설정 저장</p>
					<p className="text-[11px] text-slate-500 dark:text-slate-400">
						{dirty
							? '변경된 값이 있습니다. 저장해야 세션에 반영됩니다.'
							: config.updatedAt
								? `마지막 저장 ${new Date(config.updatedAt).toLocaleString('ko-KR')}`
								: '아직 저장된 변경이 없습니다. (Mock 기본값)'}
					</p>
				</div>
				<button
					type="button"
					onClick={handleSave}
					disabled={saving}
					className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
				>
					{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
					설정 저장
				</button>
			</div>

			{toasts.length > 0 ? (
				<div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
					{toasts.map((toast) => (
						<div
							key={toast.id}
							className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-lg ${
								toast.tone === 'error'
									? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
									: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
							}`}
							role="status"
						>
							{toast.tone === 'error' ? <TriangleAlert className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
							{toast.message}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
