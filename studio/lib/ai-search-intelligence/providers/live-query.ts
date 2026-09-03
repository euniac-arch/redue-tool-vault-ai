import { classifyAsiThrown } from '@/lib/ai-search-intelligence/api/errors';
import { logAsiRequest, redactAsiSecrets } from '@/lib/ai-search-intelligence/api/log';
import { getAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';
import { guardAsiProviderCall } from '@/lib/ai-search-intelligence/guard/execute';
import { createMockAsiProvider } from '@/lib/ai-search-intelligence/providers/mock-provider';
import { parseProviderAnswer } from '@/lib/ai-search-intelligence/providers/normalize';
import {
	ASI_LIVE_UNAVAILABLE_ERROR,
	asiProviderBlockReason,
	asiProviderKeyPresence,
	asiProviderVendor,
	isAsiLiveForced,
	missingAsiProviderKeyError,
	readAsiProviderKey,
	resolveAsiMode,
} from '@/lib/ai-search-intelligence/providers/resolve-mode';
import type { AsiProviderHealth, AsiProviderQuery } from '@/lib/ai-search-intelligence/providers/types';
import type { AIResponse, AsiEngineId } from '@/lib/ai-search-intelligence/types';

export type AsiLiveTransport = {
	call(input: AsiProviderQuery, apiKey: string): Promise<{ text: string; urls?: string[] }>;
	health(apiKey: string): Promise<{ ok: boolean; error?: string }>;
};

const LIVE_PUBLIC_ERROR: Record<string, string> = {
	missing_key: ASI_LIVE_UNAVAILABLE_ERROR,
	api_key: 'Provider rejected the API key (401/403)',
	rate_limit: 'Provider rate limit (429)',
	provider_timeout: 'Provider timeout',
	invalid_response: 'Provider returned an invalid or missing-model response',
	network_error: 'Provider network error',
	unavailable: ASI_LIVE_UNAVAILABLE_ERROR,
	blocked: 'blocked',
	cancelled: 'cancelled',
};

function publicAsiProviderError(error: string, code?: string): { error: string; code?: string } {
	const allowed = new Set(['missing_key', 'blocked', 'unavailable', 'api_key', 'provider_timeout', 'rate_limit', 'invalid_response', 'network_error', 'cancelled']);
	const safeCode = code && allowed.has(code) ? code : allowed.has(error) ? error : 'unavailable';
	// Live: user-facing reason (401/404/timeout). Hybrid: keep the stable code string.
	if (isAsiLiveForced() && safeCode !== 'blocked' && safeCode !== 'cancelled') {
		return { error: LIVE_PUBLIC_ERROR[safeCode] || ASI_LIVE_UNAVAILABLE_ERROR, code: safeCode };
	}
	return { error: safeCode, code: safeCode };
}

export function errorAsiResponse(id: AsiEngineId, input: AsiProviderQuery, error: string, code?: string): AIResponse {
	const mode = resolveAsiMode();
	const safe = publicAsiProviderError(error, code);
	return {
		provider: id,
		query: input.query,
		answer: '',
		mentions: [],
		recommendations: [],
		citations: [],
		confidence: 0,
		timestamp: new Date().toISOString(),
		source: 'live',
		meta: {
			mode,
			provider: asiProviderVendor(id),
			engine: id,
			fallback: false,
			error: safe.error,
			code: safe.code,
			unavailable: true,
		},
	};
}

export async function runAsiProviderQuery(
	id: AsiEngineId,
	input: AsiProviderQuery,
	transport: AsiLiveTransport,
): Promise<AIResponse> {
	const mode = resolveAsiMode();
	if (mode === 'mock') {
		const mock = await createMockAsiProvider(id).query(input);
		return {
			...mock,
			meta: { mode, provider: asiProviderVendor(id), engine: id, fallback: false },
		};
	}

	const blocked = asiProviderBlockReason(id);
	const requestId = getAsiRequestContext()?.requestId || 'asi_provider';
	const presence = asiProviderKeyPresence();
	logAsiRequest(requestId, 'info', {
		engine: id,
		configured: Boolean(presence[id]),
		chatgptConfigured: presence.chatgpt,
		geminiConfigured: presence.gemini,
		perplexityConfigured: presence.perplexity,
		claudeConfigured: presence.claude,
	});
	if (blocked) {
		if (mode === 'hybrid') return unavailableAsiResponse(id, input, blocked);
		return errorAsiResponse(id, input, blocked);
	}
	const apiKey = readAsiProviderKey(id);

	try {
		return await guardAsiProviderCall({
			provider: id,
			query: input.query,
			url: input.url,
			live: true,
			run: async () => {
				const raw = await transport.call(input, apiKey);
				const parsed = parseProviderAnswer(raw.text, {
					urls: raw.urls,
					brand: input.brand || '',
					category: input.category,
				});
				return {
					provider: id,
					query: input.query,
					answer: parsed.answer,
					mentions: parsed.mentions,
					recommendations: parsed.recommendations,
					citations: parsed.citations,
					confidence: 0.72,
					timestamp: new Date().toISOString(),
					source: 'live',
					meta: { mode, provider: asiProviderVendor(id), engine: id, fallback: false },
				};
			},
		});
	} catch (err) {
		const classified = classifyAsiThrown(err);
		if (mode === 'hybrid') return unavailableAsiResponse(id, input, classified.code, classified.code);
		return errorAsiResponse(id, input, classified.code, classified.code);
	}
}

export async function runAsiProviderHealth(id: AsiEngineId, transport: AsiLiveTransport): Promise<AsiProviderHealth> {
	const vendor = asiProviderVendor(id);
	const blocked = asiProviderBlockReason(id);
	if (blocked) {
		return {
			ok: false,
			provider: id,
			vendor,
			available: false,
			code: blocked === 'blocked' ? 'blocked' : 'missing_key',
			error: isAsiLiveForced() ? ASI_LIVE_UNAVAILABLE_ERROR : blocked,
		};
	}
	const apiKey = readAsiProviderKey(id);
	if (!apiKey) {
		return {
			ok: false,
			provider: id,
			vendor,
			available: false,
			code: 'missing_key',
			error: isAsiLiveForced() ? ASI_LIVE_UNAVAILABLE_ERROR : missingAsiProviderKeyError(id),
		};
	}
	try {
		const result = await transport.health(apiKey);
		if (!result.ok) {
			return {
				ok: false,
				provider: id,
				vendor,
				available: true,
				code: result.error?.toLowerCase().includes('empty') ? 'empty' : 'http_error',
				error: result.error ? redactAsiSecrets(result.error) : result.error,
			};
		}
		return { ok: true, provider: id, vendor, available: true, code: 'ok' };
	} catch (err) {
		return {
			ok: false,
			provider: id,
			vendor,
			available: true,
			code: 'http_error',
			error: redactAsiSecrets(err instanceof Error ? err.message : 'provider health failed'),
		};
	}
}

/** Hybrid degradation: label the engine unavailable. Never invent mock answer text. */
function unavailableAsiResponse(
	id: AsiEngineId,
	input: AsiProviderQuery,
	error: string,
	code?: string,
): AIResponse {
	const safe = publicAsiProviderError(error, code);
	return {
		provider: id,
		query: input.query,
		answer: '',
		mentions: [],
		recommendations: [],
		citations: [],
		confidence: 0,
		timestamp: new Date().toISOString(),
		source: 'fallback',
		meta: {
			mode: 'hybrid',
			provider: asiProviderVendor(id),
			engine: id,
			fallback: true,
			error: safe.error,
			code: safe.code,
			unavailable: true,
		},
	};
}
