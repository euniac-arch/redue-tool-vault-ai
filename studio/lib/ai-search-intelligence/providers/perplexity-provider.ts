import { AsiServiceError } from '@/lib/ai-search-intelligence/api/errors';
import { apiErrorMessage, extractPerplexityText, fetchAsiJson } from '@/lib/ai-search-intelligence/providers/http';
import { runAsiProviderHealth, runAsiProviderQuery, type AsiLiveTransport } from '@/lib/ai-search-intelligence/providers/live-query';
import { asiAnswerPrompt, uniqueModels } from '@/lib/ai-search-intelligence/providers/prompt';
import { envString } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import { withAsiProviderSurface } from '@/lib/ai-search-intelligence/providers/surface';
import type { AsiProviderPort } from '@/lib/ai-search-intelligence/providers/types';

const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';

function perplexityModels(): string[] {
	return uniqueModels([envString('PERPLEXITY_MODEL') || 'sonar', 'sonar-pro']);
}

const transport: AsiLiveTransport = {
	async call(input, apiKey) {
		const prompt = asiAnswerPrompt(input);
		let lastError = 'Perplexity HTTP error';
		const attempts: Array<{ json: boolean }> = [{ json: true }, { json: false }];
		for (const model of perplexityModels()) {
			for (const attempt of attempts) {
				const result = await fetchAsiJson(PERPLEXITY_URL, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						model,
						temperature: 0.2,
						max_tokens: 500,
						...(attempt.json ? { response_format: { type: 'json_object' } } : {}),
						messages: [
							{ role: 'system', content: prompt.system },
							{ role: 'user', content: prompt.user },
						],
					}),
				});
				if (!result.ok) {
					lastError = apiErrorMessage(result.data, `Perplexity HTTP ${result.status} (${model})`);
					if (result.status === 401 || result.status === 403) throw new Error(lastError);
					continue;
				}
				const extracted = extractPerplexityText(result.data);
				if (!extracted.text) {
					lastError = `Perplexity returned an empty answer (${model})`;
					continue;
				}
				return extracted;
			}
		}
		throw new AsiServiceError('invalid_response', lastError);
	},
	async health(apiKey) {
		const result = await fetchAsiJson(PERPLEXITY_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: perplexityModels()[0],
				max_tokens: 16,
				temperature: 0,
				messages: [{ role: 'user', content: 'Reply with the word OK only.' }],
			}),
		});
		if (!result.ok) return { ok: false, error: apiErrorMessage(result.data, `Perplexity HTTP ${result.status}`) };
		const extracted = extractPerplexityText(result.data);
		if (!extracted.text) return { ok: false, error: 'Perplexity returned an empty health response' };
		return { ok: true };
	},
};

export function createPerplexityAsiProvider(): AsiProviderPort {
	return withAsiProviderSurface(
		'perplexity',
		(input) => runAsiProviderQuery('perplexity', input, transport),
		() => runAsiProviderHealth('perplexity', transport),
	);
}
