'use client';

import { Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import {
	LLM_MODEL_OPTIONS,
	type ActiveLlmModel,
	type ConnectionStatus,
	type LlmConfig,
} from '@/lib/admin/apiConfigService';
import { ConnectionStatusBadge } from './api-settings-badges';
import { FIELD_INPUT_CLASS, SecretKeyField } from './SecretKeyField';

const CARD =
	'rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800';

interface LlmApiKeyCardProps {
	value: LlmConfig;
	status: ConnectionStatus;
	testing: boolean;
	testMessage: string | null;
	testOk: boolean | null;
	onChange: (next: LlmConfig) => void;
	onTest: () => void;
}

export function LlmApiKeyCard({
	value,
	status,
	testing,
	testMessage,
	testOk,
	onChange,
	onTest,
}: LlmApiKeyCardProps) {
	const patch = <K extends keyof LlmConfig>(key: K, next: LlmConfig[K]) => onChange({ ...value, [key]: next });

	return (
		<article className={CARD}>
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-800">
						<Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden />
					</span>
					<div>
						<h2 className="text-base font-bold text-slate-900 dark:text-slate-100">AI &amp; LLM API Key</h2>
						<p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
							진단·처방·팩트체크에 사용할 모델 키입니다. 기본 활성 모델의 키만 검증합니다.
						</p>
					</div>
				</div>
				<ConnectionStatusBadge status={status} />
			</header>

			<div className="mt-5 grid gap-4">
				<SecretKeyField
					id="gemini-api-key"
					label="Gemini API Key"
					value={value.geminiApiKey}
					onChange={(next) => patch('geminiApiKey', next)}
					placeholder="AIzaSy..."
				/>
				<SecretKeyField
					id="openai-api-key"
					label="OpenAI API Key"
					value={value.openaiApiKey}
					onChange={(next) => patch('openaiApiKey', next)}
					placeholder="sk-..."
				/>
				<label className="flex flex-col gap-1.5" htmlFor="default-llm-model">
					<span className="text-xs font-bold text-slate-600 dark:text-slate-300">기본 활성 모델</span>
					<select
						id="default-llm-model"
						className={FIELD_INPUT_CLASS}
						value={value.defaultModel}
						onChange={(event) => patch('defaultModel', event.target.value as ActiveLlmModel)}
					>
						{LLM_MODEL_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<span className="text-[11px] text-slate-500 dark:text-slate-400">
						선택한 공급자의 API Key가 유효성 검증 대상이 됩니다.
					</span>
				</label>
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
					{testing ? '키 유효성을 확인하는 중…' : testMessage ?? '기본 활성 모델의 API Key를 검증합니다.'}
				</p>
				<button
					type="button"
					onClick={onTest}
					disabled={testing}
					className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
				>
					{testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
					API Key 유효성 검증
				</button>
			</footer>
		</article>
	);
}
