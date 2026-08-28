/**
 * Admin "API Key & Firebase 연동 설정" data-access layer.
 *
 * UI (`ApiSettingsDashboard`) talks only to the functions below so a future
 * backend swap is a one-file change:
 *
 *   fetchApiConfig     -> GET    /api/admin/api-settings
 *   saveApiConfig      -> PUT    /api/admin/api-settings
 *   testApiConnection  -> POST   /api/admin/api-settings/test
 *
 * Toggle `USE_MOCK` once the real endpoints exist. The mock branch simulates
 * network latency and keeps an in-memory (+ localStorage) store.
 */

export type ConnectionStatus = 'connected' | 'unset' | 'error';

export type ConnectionTarget = 'firebase' | 'gemini' | 'kakao' | 'google';

export type TestableTarget = 'firebase' | 'llm' | 'kakao' | 'google';

export type ActiveLlmModel =
	| 'gemini-2.5-flash'
	| 'gemini-2.0-flash'
	| 'gemini-1.5-pro'
	| 'gpt-4o'
	| 'gpt-4o-mini';

export type FirebaseConfig = {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket: string;
	appId: string;
};

export type LlmConfig = {
	geminiApiKey: string;
	openaiApiKey: string;
	defaultModel: ActiveLlmModel;
};

export type SocialLoginConfig = {
	kakaoRestApiKey: string;
	kakaoJavascriptKey: string;
	kakaoRedirectUri: string;
	googleClientId: string;
	googleClientSecret: string;
};

export type ApiConfigStatuses = Record<ConnectionTarget, ConnectionStatus>;

export type ApiConfig = {
	firebase: FirebaseConfig;
	llm: LlmConfig;
	social: SocialLoginConfig;
	statuses: ApiConfigStatuses;
	updatedAt: string | null;
};

export type SaveApiConfigResult = {
	config: ApiConfig;
	message: string;
};

export type TestApiConnectionResult = {
	target: TestableTarget;
	ok: boolean;
	message: string;
	status: ConnectionStatus;
	config: ApiConfig;
};

export const LLM_MODEL_OPTIONS: { value: ActiveLlmModel; label: string; provider: 'gemini' | 'openai' }[] = [
	{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (기본)', provider: 'gemini' },
	{ value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini' },
	{ value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', provider: 'gemini' },
	{ value: 'gpt-4o', label: 'OpenAI GPT-4o', provider: 'openai' },
	{ value: 'gpt-4o-mini', label: 'OpenAI GPT-4o mini', provider: 'openai' },
];

export const CONNECTION_META: {
	id: ConnectionTarget;
	label: string;
	caption: string;
}[] = [
	{ id: 'firebase', label: 'Firebase', caption: 'Auth · Firestore · Hosting' },
	{ id: 'gemini', label: 'Gemini API', caption: 'AI & LLM 기본 엔진' },
	{ id: 'kakao', label: 'Kakao OAuth', caption: '카카오 소셜 로그인' },
	{ id: 'google', label: 'Google OAuth', caption: '구글 소셜 로그인' },
];

const USE_MOCK = true;
const FETCH_LATENCY_MS = 280;
const SAVE_LATENCY_MS = 420;
const TEST_LATENCY_MS = 1000;
const STORAGE_KEY = 'redue.admin.api-config.v1';

export const DEFAULT_KAKAO_REDIRECT_URI = 'https://redue.ai/api/auth/callback/kakao';

const DEFAULT_CONFIG: ApiConfig = {
	firebase: {
		apiKey: 'AIzaSyMockFirebaseKey_RedueAdminDemo',
		authDomain: 'redue-seo-geo.firebaseapp.com',
		projectId: 'redue-seo-geo',
		storageBucket: 'redue-seo-geo.appspot.com',
		appId: '1:123456789012:web:abcdef1234567890',
	},
	llm: {
		geminiApiKey: 'AIzaSyMockGeminiKey_RedueAdminDemo',
		openaiApiKey: '',
		defaultModel: 'gemini-2.5-flash',
	},
	social: {
		kakaoRestApiKey: '',
		kakaoJavascriptKey: '',
		kakaoRedirectUri: DEFAULT_KAKAO_REDIRECT_URI,
		googleClientId: '123456789012-redueadmindemo.apps.googleusercontent.com',
		googleClientSecret: '',
	},
	statuses: {
		firebase: 'connected',
		gemini: 'connected',
		kakao: 'unset',
		google: 'error',
	},
	updatedAt: null,
};

let configStore: ApiConfig | null = null;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function cloneConfig(config: ApiConfig): ApiConfig {
	return {
		firebase: { ...config.firebase },
		llm: { ...config.llm },
		social: { ...config.social },
		statuses: { ...config.statuses },
		updatedAt: config.updatedAt,
	};
}

function isFilled(...values: string[]): boolean {
	return values.every((value) => value.trim().length > 0);
}

export function deriveStatuses(config: Pick<ApiConfig, 'firebase' | 'llm' | 'social'>): ApiConfigStatuses {
	return {
		firebase: isFilled(config.firebase.apiKey, config.firebase.projectId, config.firebase.authDomain)
			? 'connected'
			: 'unset',
		gemini: isFilled(config.llm.geminiApiKey) ? 'connected' : 'unset',
		kakao: isFilled(config.social.kakaoRestApiKey) ? 'connected' : 'unset',
		google: isFilled(config.social.googleClientId, config.social.googleClientSecret)
			? 'connected'
			: isFilled(config.social.googleClientId) || isFilled(config.social.googleClientSecret)
				? 'error'
				: 'unset',
	};
}

function readPersisted(): ApiConfig | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ApiConfig;
		if (!parsed?.firebase || !parsed?.llm || !parsed?.social || !parsed?.statuses) return null;
		return cloneConfig(parsed);
	} catch {
		return null;
	}
}

function persist(config: ApiConfig) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch {
		/* quota / private mode — keep in-memory only */
	}
}

function ensureStore(): ApiConfig {
	if (configStore) return configStore;
	configStore = readPersisted() ?? cloneConfig(DEFAULT_CONFIG);
	return configStore;
}

function requiredFieldsFor(target: TestableTarget, config: ApiConfig): { ok: boolean; missing: string } {
	if (target === 'firebase') {
		return isFilled(config.firebase.apiKey, config.firebase.projectId, config.firebase.authDomain)
			? { ok: true, missing: '' }
			: { ok: false, missing: 'API Key, Auth Domain, Project ID' };
	}
	if (target === 'llm') {
		const option = LLM_MODEL_OPTIONS.find((item) => item.value === config.llm.defaultModel);
		if (option?.provider === 'openai') {
			return isFilled(config.llm.openaiApiKey)
				? { ok: true, missing: '' }
				: { ok: false, missing: 'OpenAI API Key' };
		}
		return isFilled(config.llm.geminiApiKey)
			? { ok: true, missing: '' }
			: { ok: false, missing: 'Gemini API Key' };
	}
	if (target === 'kakao') {
		return isFilled(config.social.kakaoRestApiKey)
			? { ok: true, missing: '' }
			: { ok: false, missing: '카카오 REST API Key' };
	}
	return isFilled(config.social.googleClientId, config.social.googleClientSecret)
		? { ok: true, missing: '' }
		: { ok: false, missing: 'Google Client ID, Client Secret' };
}

function applyTestStatus(config: ApiConfig, target: TestableTarget, status: ConnectionStatus): ApiConfig {
	const next = cloneConfig(config);
	if (target === 'llm') {
		next.statuses.gemini = status;
	} else {
		next.statuses[target] = status;
	}
	return next;
}

/** Test-only escape hatch to reset the mock store between runs. */
export function __resetApiConfigMockStore() {
	configStore = cloneConfig(DEFAULT_CONFIG);
	if (typeof window !== 'undefined') {
		try {
			window.localStorage.removeItem(STORAGE_KEY);
		} catch {
			/* ignore */
		}
	}
}

/** GET /api/admin/api-settings */
export async function fetchApiConfig(): Promise<ApiConfig> {
	if (!USE_MOCK) {
		const res = await fetch('/api/admin/api-settings', { cache: 'no-store' });
		if (!res.ok) throw new Error('연동 설정을 불러오지 못했습니다.');
		return (await res.json()) as ApiConfig;
	}
	await delay(FETCH_LATENCY_MS);
	return cloneConfig(ensureStore());
}

/** PUT /api/admin/api-settings */
export async function saveApiConfig(
	draft: Pick<ApiConfig, 'firebase' | 'llm' | 'social'>,
): Promise<SaveApiConfigResult> {
	if (!USE_MOCK) {
		const res = await fetch('/api/admin/api-settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(draft),
		});
		if (!res.ok) throw new Error('연동 설정을 저장하지 못했습니다.');
		return (await res.json()) as SaveApiConfigResult;
	}

	await delay(SAVE_LATENCY_MS);
	const next: ApiConfig = {
		firebase: { ...draft.firebase },
		llm: { ...draft.llm },
		social: { ...draft.social },
		statuses: deriveStatuses(draft),
		updatedAt: new Date().toISOString(),
	};
	configStore = next;
	persist(next);
	return { config: cloneConfig(next), message: '설정이 저장되었습니다.' };
}

/** POST /api/admin/api-settings/test — mock waits ~1s then returns a result. */
export async function testApiConnection(
	target: TestableTarget,
	draft?: Pick<ApiConfig, 'firebase' | 'llm' | 'social'>,
): Promise<TestApiConnectionResult> {
	if (!USE_MOCK) {
		const res = await fetch('/api/admin/api-settings/test', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ target, draft }),
		});
		if (!res.ok) throw new Error('연결 테스트에 실패했습니다.');
		return (await res.json()) as TestApiConnectionResult;
	}

	await delay(TEST_LATENCY_MS);
	const current = ensureStore();
	const working: ApiConfig = draft
		? {
				firebase: { ...draft.firebase },
				llm: { ...draft.llm },
				social: { ...draft.social },
				statuses: { ...current.statuses },
				updatedAt: current.updatedAt,
			}
		: cloneConfig(current);

	const check = requiredFieldsFor(target, working);
	const next = applyTestStatus(working, target, check.ok ? 'connected' : 'unset');
	configStore = next;
	persist(next);

	if (!check.ok) {
		return {
			target,
			ok: false,
			message: `필수 값이 비어 있습니다. (${check.missing})`,
			status: next.statuses[target === 'llm' ? 'gemini' : target],
			config: cloneConfig(next),
		};
	}

	return {
		target,
		ok: true,
		message: '연결 성공',
		status: 'connected',
		config: cloneConfig(next),
	};
}
