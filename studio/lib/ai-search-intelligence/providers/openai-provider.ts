import { AsiServiceError } from '@/lib/ai-search-intelligence/api/errors';
import { apiErrorMessage, extractOpenAiText, fetchAsiJson, requireAsiHttpOk } from '@/lib/ai-search-intelligence/providers/http';
import { runAsiProviderHealth, runAsiProviderQuery, type AsiLiveTransport } from '@/lib/ai-search-intelligence/providers/live-query';
import { asiAnswerPrompt } from '@/lib/ai-search-intelligence/providers/prompt';
import { envString } from '@/lib/ai-search-intelligence/providers/resolve-mode';
import { withAsiProviderSurface } from '@/lib/ai-search-intelligence/providers/surface';
import type { AsiProviderPort } from '@/lib/ai-search-intelligence/providers/types';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';

function openaiModel(): string {
	return envString('OPENAI_MODEL') || 'gpt-4o-mini';
}

function openaiHeaders(apiKey: string): Record<string, string> {
	return {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
	};
}

const transport: AsiLiveTransport = {
	async call(input, apiKey) {
		const prompt = asiAnswerPrompt(input);
		const withSearch = await fetchAsiJson(OPENAI_RESPONSES_URL, {
			method: 'POST',
			headers: openaiHeaders(apiKey),
			body: JSON.stringify({
				model: openaiModel(),
				input: [
					{ role: 'system', content: [{ type: 'input_text', text: prompt.system }] },
					{ role: 'user', content: [{ type: 'input_text', text: prompt.user }] },
				],
				tools: [{ type: 'web_search' }],
				tool_choice: 'auto',
				text: { format: { type: 'json_object' } },
			}),
		});
		if (withSearch.ok) {
			const extracted = extractOpenAiText(withSearch.data);
			if (extracted.text) return extracted;
		}

		const result = await fetchAsiJson(OPENAI_CHAT_URL, {
			method: 'POST',
			headers: openaiHeaders(apiKey),
			body: JSON.stringify({
				model: openaiModel(),
				temperature: 0.2,
				max_tokens: 500,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: prompt.system },
					{ role: 'user', content: prompt.user },
				],
			}),
		});
		const extracted = extractOpenAiText(requireAsiHttpOk(result, 'OpenAI'));
		if (!extracted.text) throw new AsiServiceError('invalid_response');
		return extracted;
	},
	async health(apiKey) {
		const result = await fetchAsiJson(OPENAI_MODELS_URL, {
			method: 'GET',
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!result.ok) return { ok: false, error: apiErrorMessage(result.data, `OpenAI HTTP ${result.status}`) };
		return { ok: true };
	},
};

export function createOpenAiAsiProvider(): AsiProviderPort {
	return withAsiProviderSurface(
		'chatgpt',
		(input) => runAsiProviderQuery('chatgpt', input, transport),
		() => runAsiProviderHealth('chatgpt', transport),
	);
}
