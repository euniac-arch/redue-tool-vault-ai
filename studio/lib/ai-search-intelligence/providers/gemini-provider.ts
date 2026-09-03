import { apiErrorMessage, extractGeminiText, fetchAsiJson, requireAsiHttpOk } from '@/lib/ai-search-intelligence/providers/http';
import { runAsiProviderHealth, runAsiProviderQuery, type AsiLiveTransport } from '@/lib/ai-search-intelligence/providers/live-query';
import { asiAnswerPrompt, isModelUnavailable, uniqueModels } from '@/lib/ai-search-intelligence/providers/prompt';
import { envString } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import { withAsiProviderSurface } from '@/lib/ai-search-intelligence/providers/surface';
import type { AsiProviderPort } from '@/lib/ai-search-intelligence/providers/types';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash'] as const;

function geminiModels(): string[] {
	return uniqueModels([envString('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]);
}

function geminiGenerateUrl(model: string, apiKey: string): string {
	return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

const transport: AsiLiveTransport = {
	async call(input, apiKey) {
		const prompt = asiAnswerPrompt(input);
		let lastError = 'Gemini HTTP error';
		const attempts: Array<{ tools?: Array<{ google_search: Record<string, never> }>; json: boolean }> = [
			{ json: true },
			{ tools: [{ google_search: {} }], json: true },
			{ json: false },
		];
		for (const model of geminiModels()) {
			for (const attempt of attempts) {
				const result = await fetchAsiJson(geminiGenerateUrl(model, apiKey), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						systemInstruction: { parts: [{ text: prompt.system }] },
						contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
						...(attempt.tools ? { tools: attempt.tools } : {}),
						generationConfig: {
							temperature: 0.2,
							maxOutputTokens: attempt.json ? 1536 : 2048,
							...(attempt.json ? { responseMimeType: 'application/json' } : {}),
						},
					}),
				});
				if (!result.ok) {
					lastError = apiErrorMessage(result.data, `Gemini HTTP ${result.status} (${model})`);
					if (isModelUnavailable(result.status, lastError)) break;
					continue;
				}
				const extracted = extractGeminiText(result.data);
				if (!extracted.text) {
					lastError = `Gemini returned an empty answer (${model})`;
					continue;
				}
				return extracted;
			}
		}
		throw new Error(lastError);
	},
	async health(apiKey) {
		const result = await fetchAsiJson(
			`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
			{ method: 'GET' },
		);
		if (!result.ok) return { ok: false, error: apiErrorMessage(result.data, `Gemini HTTP ${result.status}`) };
		requireAsiHttpOk(result, 'Gemini');
		return { ok: true };
	},
};

export function createGeminiAsiProvider(): AsiProviderPort {
	return withAsiProviderSurface(
		'gemini',
		(input) => runAsiProviderQuery('gemini', input, transport),
		() => runAsiProviderHealth('gemini', transport),
	);
}
