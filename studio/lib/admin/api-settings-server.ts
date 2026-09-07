import 'server-only';

import fs from 'node:fs';
import {
	DEFAULT_KAKAO_REDIRECT_URI,
	deriveStatuses,
	type ActiveLlmModel,
	type ApiConfig,
	type ConnectionStatus,
	type SaveApiConfigResult,
	type TestApiConnectionResult,
	type TestableTarget,
} from '@/lib/admin/apiConfigService';
import { ensureWritableDirSync, writableDataPath, writeJsonFileSync } from '@/lib/server/writable-data-dir';

type StoredOverrides = {
	firebase?: Partial<ApiConfig['firebase']>;
	llm?: Partial<ApiConfig['llm']>;
	social?: Partial<ApiConfig['social']>;
	updatedAt?: string | null;
};

function settingsFilePath() {
	return writableDataPath('admin-api-settings.json');
}

function env(name: string): string {
	return (process.env[name] || '').trim();
}

function maskSecret(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	if (trimmed.length <= 8) return '••••••••';
	return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

function readOverrides(): StoredOverrides {
	try {
		const parsed = JSON.parse(fs.readFileSync(settingsFilePath(), 'utf8')) as StoredOverrides;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function pick(override: string | undefined, fallback: string): string {
	return (override || '').trim() || fallback;
}

function resolveRawConfig(): ApiConfig {
	const stored = readOverrides();
	const firebase = {
		apiKey: pick(stored.firebase?.apiKey, env('NEXT_PUBLIC_FIREBASE_API_KEY') || env('FIREBASE_API_KEY')),
		authDomain: pick(stored.firebase?.authDomain, env('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN')),
		projectId: pick(
			stored.firebase?.projectId,
			env('NEXT_PUBLIC_FIREBASE_PROJECT_ID') || env('FIREBASE_PROJECT_ID'),
		),
		storageBucket: pick(stored.firebase?.storageBucket, env('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET')),
		appId: pick(stored.firebase?.appId, env('NEXT_PUBLIC_FIREBASE_APP_ID')),
	};
	const defaultModel = (stored.llm?.defaultModel || env('GEMINI_MODEL') || 'gemini-2.5-flash') as ActiveLlmModel;
	const llm = {
		geminiApiKey: pick(
			stored.llm?.geminiApiKey,
			env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY') || env('GOOGLE_API_KEY'),
		),
		openaiApiKey: pick(stored.llm?.openaiApiKey, env('OPENAI_API_KEY')),
		defaultModel,
	};
	const social = {
		kakaoRestApiKey: pick(stored.social?.kakaoRestApiKey, env('KAKAO_CLIENT_ID')),
		kakaoJavascriptKey: pick(stored.social?.kakaoJavascriptKey, env('NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY')),
		kakaoRedirectUri: pick(
			stored.social?.kakaoRedirectUri,
			env('KAKAO_REDIRECT_URI') || DEFAULT_KAKAO_REDIRECT_URI,
		),
		googleClientId: pick(stored.social?.googleClientId, env('GOOGLE_CLIENT_ID')),
		googleClientSecret: pick(stored.social?.googleClientSecret, env('GOOGLE_CLIENT_SECRET')),
	};
	const config: ApiConfig = {
		firebase,
		llm,
		social,
		statuses: deriveStatuses({ firebase, llm, social }),
		updatedAt: stored.updatedAt ?? null,
	};
	return config;
}

export function getPublicApiConfig(): ApiConfig {
	const raw = resolveRawConfig();
	return {
		firebase: {
			...raw.firebase,
			apiKey: maskSecret(raw.firebase.apiKey),
		},
		llm: {
			...raw.llm,
			geminiApiKey: maskSecret(raw.llm.geminiApiKey),
			openaiApiKey: maskSecret(raw.llm.openaiApiKey),
		},
		social: {
			...raw.social,
			kakaoRestApiKey: maskSecret(raw.social.kakaoRestApiKey),
			kakaoJavascriptKey: maskSecret(raw.social.kakaoJavascriptKey),
			googleClientSecret: maskSecret(raw.social.googleClientSecret),
		},
		statuses: raw.statuses,
		updatedAt: raw.updatedAt,
	};
}

function looksMasked(value: string): boolean {
	return value.includes('••••');
}

function mergeSecret(next: string, current: string): string {
	if (!next.trim() || looksMasked(next)) return current;
	return next.trim();
}

export function saveApiConfigOverrides(draft: Pick<ApiConfig, 'firebase' | 'llm' | 'social'>): SaveApiConfigResult {
	const current = resolveRawConfig();
	const next: StoredOverrides = {
		firebase: {
			apiKey: mergeSecret(draft.firebase.apiKey, current.firebase.apiKey),
			authDomain: draft.firebase.authDomain.trim() || current.firebase.authDomain,
			projectId: draft.firebase.projectId.trim() || current.firebase.projectId,
			storageBucket: draft.firebase.storageBucket.trim() || current.firebase.storageBucket,
			appId: draft.firebase.appId.trim() || current.firebase.appId,
		},
		llm: {
			geminiApiKey: mergeSecret(draft.llm.geminiApiKey, current.llm.geminiApiKey),
			openaiApiKey: mergeSecret(draft.llm.openaiApiKey, current.llm.openaiApiKey),
			defaultModel: draft.llm.defaultModel || current.llm.defaultModel,
		},
		social: {
			kakaoRestApiKey: mergeSecret(draft.social.kakaoRestApiKey, current.social.kakaoRestApiKey),
			kakaoJavascriptKey: mergeSecret(draft.social.kakaoJavascriptKey, current.social.kakaoJavascriptKey),
			kakaoRedirectUri: draft.social.kakaoRedirectUri.trim() || current.social.kakaoRedirectUri,
			googleClientId: draft.social.googleClientId.trim() || current.social.googleClientId,
			googleClientSecret: mergeSecret(draft.social.googleClientSecret, current.social.googleClientSecret),
		},
		updatedAt: new Date().toISOString(),
	};
	ensureWritableDirSync(writableDataPath());
	writeJsonFileSync(settingsFilePath(), next);
	return {
		config: getPublicApiConfig(),
		message: '설정이 저장되었습니다. 비밀키는 서버에만 보관되며 화면에는 마스킹됩니다.',
	};
}

async function ping(url: string, init?: RequestInit): Promise<{ ok: boolean; message: string }> {
	try {
		const res = await fetch(url, { ...init, cache: 'no-store' });
		if (res.ok) return { ok: true, message: '연결 성공' };
		return { ok: false, message: `연결 실패 (${res.status})` };
	} catch (error) {
		return { ok: false, message: error instanceof Error ? error.message : '연결 테스트에 실패했습니다.' };
	}
}

export async function testApiConnectionTarget(
	target: TestableTarget,
	draft?: Pick<ApiConfig, 'firebase' | 'llm' | 'social'>,
): Promise<TestApiConnectionResult> {
	if (draft) saveApiConfigOverrides(draft);
	const raw = resolveRawConfig();
	const publicConfig = getPublicApiConfig();

	if (target === 'firebase') {
		const projectId = raw.firebase.projectId;
		if (!projectId) {
			return { target, ok: false, message: 'Firebase Project ID가 없습니다.', status: 'unset', config: publicConfig };
		}
		const result = await ping(`https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}`);
		const status: ConnectionStatus = result.ok ? 'connected' : 'error';
		return { target, ok: result.ok, message: result.message, status, config: { ...publicConfig, statuses: { ...publicConfig.statuses, firebase: status } } };
	}

	if (target === 'llm') {
		if (raw.llm.defaultModel.startsWith('gpt')) {
			if (!raw.llm.openaiApiKey) {
				return { target, ok: false, message: 'OpenAI API Key가 없습니다.', status: 'unset', config: publicConfig };
			}
			const result = await ping('https://api.openai.com/v1/models', {
				headers: { Authorization: `Bearer ${raw.llm.openaiApiKey}` },
			});
			const status: ConnectionStatus = result.ok ? 'connected' : 'error';
			return { target, ok: result.ok, message: result.message, status, config: { ...publicConfig, statuses: { ...publicConfig.statuses, gemini: status } } };
		}
		if (!raw.llm.geminiApiKey) {
			return { target, ok: false, message: 'Gemini API Key가 없습니다.', status: 'unset', config: publicConfig };
		}
		const result = await ping(
			`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(raw.llm.geminiApiKey)}`,
		);
		const status: ConnectionStatus = result.ok ? 'connected' : 'error';
		return { target, ok: result.ok, message: result.message, status, config: { ...publicConfig, statuses: { ...publicConfig.statuses, gemini: status } } };
	}

	if (target === 'kakao') {
		if (!raw.social.kakaoRestApiKey) {
			return { target, ok: false, message: '카카오 REST API Key가 없습니다.', status: 'unset', config: publicConfig };
		}
		const result = await ping('https://kauth.kakao.com/.well-known/openid-configuration');
		const status: ConnectionStatus = result.ok ? 'connected' : 'error';
		return { target, ok: result.ok, message: result.message, status, config: { ...publicConfig, statuses: { ...publicConfig.statuses, kakao: status } } };
	}

	if (!raw.social.googleClientId || !raw.social.googleClientSecret) {
		return { target, ok: false, message: 'Google Client ID/Secret이 없습니다.', status: 'unset', config: publicConfig };
	}
	const result = await ping('https://accounts.google.com/.well-known/openid-configuration');
	const status: ConnectionStatus = result.ok ? 'connected' : 'error';
	return { target, ok: result.ok, message: result.message, status, config: { ...publicConfig, statuses: { ...publicConfig.statuses, google: status } } };
}

export function extraIntegrationStatus() {
	return {
		openai: Boolean(env('OPENAI_API_KEY')),
		claude: Boolean(env('ANTHROPIC_API_KEY')),
		youtube: Boolean(env('YOUTUBE_API_KEY') || env('GOOGLE_YOUTUBE_API_KEY')),
		firebaseProjectId: env('FIREBASE_PROJECT_ID') || env('NEXT_PUBLIC_FIREBASE_PROJECT_ID') || '',
	};
}
