import { AsiServiceError, classifyHttpStatus } from '@/lib/ai-search-intelligence/api/errors';
import { asiAbortCode, getAsiCallContext, getAsiRequestContext } from '@/lib/ai-search-intelligence/guard/context';

const DEFAULT_TIMEOUT_MS = 20_000;

export type AsiHttpJson = {
	status: number;
	ok: boolean;
	data: unknown;
};

export function requireAsiHttpOk(result: AsiHttpJson, label: string): unknown {
	if (!result.ok) {
		throw new AsiServiceError(classifyHttpStatus(result.status), `${label} HTTP ${result.status}`);
	}
	return result.data;
}

export function apiErrorMessage(data: unknown, fallback: string): string {
	if (!data || typeof data !== 'object') return fallback;
	const record = data as { error?: { message?: string }; message?: string };
	return record.error?.message || record.message || fallback;
}

export async function fetchAsiJson(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<AsiHttpJson> {
	const call = getAsiCallContext();
	const request = getAsiRequestContext();
	const waitMs = call?.timeoutMs ?? timeoutMs;
	const controller = new AbortController();
	const parent = request?.signal;
	const onParentAbort = () => controller.abort(parent?.reason ?? 'cancelled');
	if (parent?.aborted) onParentAbort();
	else parent?.addEventListener('abort', onParentAbort, { once: true });
	const timer = setTimeout(() => controller.abort('timeout'), waitMs);
	try {
		const response = await fetch(url, { ...init, signal: controller.signal });
		const text = await response.text();
		let data: unknown = null;
		if (text) {
			try {
				data = JSON.parse(text) as unknown;
			} catch {
				if (response.ok) {
					throw new AsiServiceError('invalid_response');
				}
				data = { message: text.slice(0, 240) };
			}
		}
		return { status: response.status, ok: response.ok, data };
	} catch (error) {
		if (error instanceof AsiServiceError) throw error;
		if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
			throw new AsiServiceError(asiAbortCode(parent || controller.signal));
		}
		throw new AsiServiceError('network_error');
	} finally {
		clearTimeout(timer);
		parent?.removeEventListener('abort', onParentAbort);
	}
}

export function extractOpenAiText(data: unknown): { text: string; urls: string[] } {
	const record = data as {
		output_text?: string;
		choices?: Array<{ message?: { content?: string } }>;
		output?: Array<{
			type?: string;
			content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string }> }>;
		}>;
	};
	const fromResponses = (record.output || [])
		.filter((item) => item.type === 'message' || !item.type)
		.flatMap((item) => item.content || [])
		.map((part) => (part.type === 'output_text' || part.text ? part.text || '' : ''))
		.join('\n')
		.trim();
	const fromChat = String(record.choices?.[0]?.message?.content || '').trim();
	const text = fromResponses || String(record.output_text || '').trim() || fromChat;
	const annotationUrls = (record.output || [])
		.flatMap((item) => item.content || [])
		.flatMap((part) => part.annotations || [])
		.map((item) => item.url)
		.filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url)));
	return { text, urls: uniqueUrls([...annotationUrls, ...urlsInText(text)]) };
}

export function extractClaudeText(data: unknown): { text: string; urls: string[] } {
	const blocks = (data as { content?: Array<{ type?: string; text?: string }> })?.content || [];
	const text = blocks
		.map((block) => (block.type === 'text' ? block.text || '' : ''))
		.join('\n')
		.trim();
	return { text, urls: urlsInText(text) };
}

export function extractGeminiText(data: unknown): { text: string; urls: string[] } {
	const candidate = (data as {
		candidates?: Array<{
			content?: { parts?: Array<{ text?: string }> };
			groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string } }> };
		}>;
	})?.candidates?.[0];
	const text = (candidate?.content?.parts || []).map((part) => part.text || '').join('\n').trim();
	const groundingUrls = (candidate?.groundingMetadata?.groundingChunks || [])
		.map((chunk) => chunk.web?.uri)
		.filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url)));
	return { text, urls: uniqueUrls([...groundingUrls, ...urlsInText(text)]) };
}

export function extractPerplexityText(data: unknown): { text: string; urls: string[] } {
	const choice = (data as { choices?: Array<{ message?: { content?: string } }>; citations?: string[] })?.choices?.[0];
	const text = String(choice?.message?.content || '').trim();
	const citations = Array.isArray((data as { citations?: string[] }).citations)
		? ((data as { citations?: string[] }).citations || []).filter(Boolean)
		: [];
	return { text, urls: uniqueUrls([...citations, ...urlsInText(text)]) };
}

function urlsInText(text: string): string[] {
	return Array.from(text.matchAll(/https?:\/\/[^\s)"']+/g)).map((match) => match[0]);
}

function uniqueUrls(urls: string[]): string[] {
	return Array.from(new Set(urls.map((url) => url.replace(/[),.;]+$/, '')).filter(Boolean)));
}
