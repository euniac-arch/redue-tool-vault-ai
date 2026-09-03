import { apiErrorMessage, extractClaudeText, fetchAsiJson } from '@/lib/ai-search-intelligence/providers/http';
import { runAsiProviderHealth, runAsiProviderQuery, type AsiLiveTransport } from '@/lib/ai-search-intelligence/providers/live-query';
import { asiAnswerPrompt, isModelUnavailable, uniqueModels } from '@/lib/ai-search-intelligence/providers/prompt';
import { envString } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import { withAsiProviderSurface } from '@/lib/ai-search-intelligence/providers/surface';
import type { AsiProviderPort } from '@/lib/ai-search-intelligence/providers/types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_FALLBACK_MODELS = [
	'claude-3-5-sonnet-20241022',
	'claude-3-5-haiku-20241022',
	'claude-3-haiku-20240307',
] as const;

function anthropicModels(): string[] {
	return uniqueModels([envString('ANTHROPIC_MODEL') || DEFAULT_ANTHROPIC_MODEL, ...ANTHROPIC_FALLBACK_MODELS]);
}

function anthropicHeaders(apiKey: string): Record<string, string> {
	return {
		'x-api-key': apiKey,
		'anthropic-version': '2023-06-01',
		'Content-Type': 'application/json',
	};
}

const transport: AsiLiveTransport = {
	async call(input, apiKey) {
		const prompt = asiAnswerPrompt(input);
		let lastError = 'Anthropic HTTP error';
		for (const model of anthropicModels()) {
			const result = await fetchAsiJson(ANTHROPIC_URL, {
				method: 'POST',
				headers: anthropicHeaders(apiKey),
				body: JSON.stringify({
					model,
					max_tokens: 500,
					temperature: 0.2,
					system: prompt.system,
					messages: [{ role: 'user', content: `${prompt.user}\n\nReturn one JSON object only. No markdown.` }],
				}),
			});
			if (!result.ok) {
				lastError = apiErrorMessage(result.data, `Anthropic HTTP ${result.status} (${model})`);
				if (isModelUnavailable(result.status, lastError)) continue;
				throw new Error(lastError);
			}
			const extracted = extractClaudeText(result.data);
			if (!extracted.text) {
				lastError = `Claude returned an empty answer (${model})`;
				continue;
			}
			return extracted;
		}
		throw new Error(lastError);
	},
	async health(apiKey) {
		const model = anthropicModels()[0];
		const result = await fetchAsiJson(ANTHROPIC_URL, {
			method: 'POST',
			headers: anthropicHeaders(apiKey),
			body: JSON.stringify({
				model,
				max_tokens: 8,
				temperature: 0,
				messages: [{ role: 'user', content: 'Reply with the word OK only.' }],
			}),
		});
		if (!result.ok) return { ok: false, error: apiErrorMessage(result.data, `Anthropic HTTP ${result.status}`) };
		const extracted = extractClaudeText(result.data);
		if (!extracted.text) return { ok: false, error: 'Claude returned an empty health response' };
		return { ok: true };
	},
};

export function createClaudeAsiProvider(): AsiProviderPort {
	return withAsiProviderSurface(
		'claude',
		(input) => runAsiProviderQuery('claude', input, transport),
		() => runAsiProviderHealth('claude', transport),
	);
}
