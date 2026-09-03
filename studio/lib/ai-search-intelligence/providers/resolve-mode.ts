import type { AsiEngineId, AsiProviderVendor, AsiRuntimeMode } from '@/lib/ai-search-intelligence/types';

export type { AsiRuntimeMode };

export type AsiProviderRuntimeStatus = 'mock' | 'live' | 'unavailable';

/** Public live-mode failure. Never used as a silent mock downgrade. */
export const ASI_LIVE_UNAVAILABLE_ERROR = 'API Key missing or provider unavailable';

const KEY_ENV: Record<AsiEngineId, string> = {
	chatgpt: 'OPENAI_API_KEY',
	gemini: 'GEMINI_API_KEY',
	perplexity: 'PERPLEXITY_API_KEY',
	claude: 'ANTHROPIC_API_KEY',
};

const KEY_ALIASES: Record<AsiEngineId, readonly string[]> = {
	chatgpt: ['OPENAI_API_KEY'],
	gemini: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_AI_API_KEY'],
	perplexity: ['PERPLEXITY_API_KEY', 'PPLX_API_KEY'],
	claude: ['ANTHROPIC_API_KEY'],
};

/**
 * Live-check (`/api/audit/live-check`) uses MOCK_OPENAI / MOCK_GEMINI / …
 * ASI does not. ASI_MODE + the four API keys are the only ASI switches.
 * Those MOCK_* flags must not block OpenAI / Gemini / Perplexity / Anthropic here.
 */
const VENDOR: Record<AsiEngineId, AsiProviderVendor> = {
	chatgpt: 'openai',
	gemini: 'gemini',
	perplexity: 'perplexity',
	claude: 'anthropic',
};

function assertAsiServerOnly() {
	if (typeof window !== 'undefined') {
		throw new Error('ASI provider configuration is server-only');
	}
}

export function envString(name: string): string {
	assertAsiServerOnly();
	return (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

/** True when at least one vendor key is present. Server-only. */
export function hasAnyAsiProviderKey(): boolean {
	return (['chatgpt', 'gemini', 'perplexity', 'claude'] as const).some((id) => hasAsiProviderKey(id));
}

/**
 * Server-only.
 * Explicit ASI_MODE always wins. ASI_MODE=live never silently downgrades to mock
 * when a key is missing or a provider call fails — callers must surface unavailable.
 * When unset, use live if any vendor key exists so a forgotten ASI_MODE=mock
 * does not silently return dummy answers.
 */
export function resolveAsiMode(): AsiRuntimeMode {
	const raw = (process.env.ASI_MODE || '').trim().toLowerCase();
	if (raw === 'live') return 'live';
	if (raw === 'hybrid') return 'hybrid';
	if (raw === 'mock') return 'mock';
	return hasAnyAsiProviderKey() ? 'live' : 'mock';
}

export function isAsiLiveForced(): boolean {
	return resolveAsiMode() === 'live';
}

export function asiProviderKeyName(id: AsiEngineId): string {
	return KEY_ENV[id];
}

export function asiProviderVendor(id: AsiEngineId): AsiProviderVendor {
	return VENDOR[id];
}

export function asiProviderKeyAliases(id: AsiEngineId): readonly string[] {
	return KEY_ALIASES[id];
}

export function readAsiProviderKey(id: AsiEngineId): string {
	for (const name of KEY_ALIASES[id]) {
		const value = envString(name);
		if (value) return value;
	}
	return '';
}

/** Safe presence flags only — never the secret value. */
export function asiProviderKeyPresence(): Record<AsiEngineId, boolean> {
	return {
		chatgpt: hasAsiProviderKey('chatgpt'),
		gemini: hasAsiProviderKey('gemini'),
		perplexity: hasAsiProviderKey('perplexity'),
		claude: hasAsiProviderKey('claude'),
	};
}

export function hasAsiProviderKey(id: AsiEngineId): boolean {
	return Boolean(readAsiProviderKey(id));
}

/** True when the adapter may attempt a live HTTP call. */
export function isAsiProviderConfigured(id: AsiEngineId): boolean {
	const mode = resolveAsiMode();
	if (mode === 'mock') return false;
	return hasAsiProviderKey(id);
}

export function asiProviderRuntimeStatus(id: AsiEngineId): AsiProviderRuntimeStatus {
	const mode = resolveAsiMode();
	if (mode === 'mock') return 'mock';
	return hasAsiProviderKey(id) ? 'live' : 'unavailable';
}

/** Client-safe. Never include env names or secret values. */
export function missingAsiProviderKeyError(_id?: AsiEngineId): string {
	return 'missing_key';
}

/** Why a live call must not proceed. Null when the adapter may call the vendor. */
export function asiProviderBlockReason(id: AsiEngineId): string | null {
	if (!readAsiProviderKey(id)) return missingAsiProviderKeyError(id);
	return null;
}
