import { NextResponse } from 'next/server';
import {
	copilotSystemPrompt,
	copilotUserPrompt,
	extractJsonObject,
	heuristicRefine,
	normalizeCopilotResponse,
	parseCopilotRequest,
} from '@/lib/strategy/copilot';
import type { CopilotProvider, StrategyCopilotContext } from '@/lib/strategy/types';

export const runtime = 'nodejs';
export const maxDuration = 45;

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function envString(name: string): string {
	return (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

function isEnvTrue(name: string): boolean {
	return envString(name).toLowerCase() === 'true';
}

function geminiGenerateUrl(model: string): string {
	return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

async function refineWithOpenAI(context: StrategyCopilotContext): Promise<{ raw: unknown; model: string }> {
	const apiKey = envString('OPENAI_API_KEY');
	if (!apiKey) throw new Error('OPENAI_API_KEY missing');
	const model = envString('STRATEGY_COPILOT_OPENAI_MODEL') || envString('OPENAI_GEO_MODEL') || 'gpt-4o-mini';
	const res = await fetch(OPENAI_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model,
			temperature: 0.3,
			response_format: { type: 'json_object' },
			messages: [
				{ role: 'system', content: copilotSystemPrompt(context.lang) },
				{ role: 'user', content: copilotUserPrompt(context) },
			],
		}),
	});
	const data = (await res.json()) as {
		error?: { message?: string };
		choices?: Array<{ message?: { content?: string } }>;
	};
	if (!res.ok) throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
	const content = data.choices?.[0]?.message?.content;
	if (!content) throw new Error('Empty OpenAI response');
	return { raw: extractJsonObject(content), model };
}

async function refineWithGemini(context: StrategyCopilotContext): Promise<{ raw: unknown; model: string }> {
	const apiKey = envString('GEMINI_API_KEY') || envString('GOOGLE_GENERATIVE_AI_API_KEY') || envString('GOOGLE_API_KEY') || envString('GOOGLE_AI_API_KEY');
	if (!apiKey) throw new Error('GEMINI_API_KEY missing');
	const model = envString('STRATEGY_COPILOT_GEMINI_MODEL') || envString('GEMINI_MODEL') || 'gemini-2.5-flash';
	const res = await fetch(`${geminiGenerateUrl(model)}?key=${encodeURIComponent(apiKey)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents: [
				{
					role: 'user',
					parts: [{ text: `${copilotSystemPrompt(context.lang)}\n\n${copilotUserPrompt(context)}` }],
				},
			],
			generationConfig: { temperature: 0.3, maxOutputTokens: 1200, responseMimeType: 'application/json' },
		}),
	});
	const data = (await res.json()) as {
		error?: { message?: string };
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
	const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
	if (!text) throw new Error('Empty Gemini response');
	return { raw: extractJsonObject(text), model };
}

export async function POST(request: Request) {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const input = parseCopilotRequest(raw);
	if (!input) {
		return NextResponse.json({ error: '엔진 context와 target이 필요합니다.' }, { status: 400 });
	}

	const hasOpenAI = Boolean(envString('OPENAI_API_KEY')) && !isEnvTrue('MOCK_OPENAI');
	const hasGemini =
		Boolean(envString('GEMINI_API_KEY') || envString('GOOGLE_GENERATIVE_AI_API_KEY') || envString('GOOGLE_API_KEY') || envString('GOOGLE_AI_API_KEY')) &&
		!isEnvTrue('MOCK_GEMINI');

	try {
		let provider: CopilotProvider = 'heuristic';
		let model: string | undefined;
		let parsed: unknown;

		if (hasOpenAI) {
			const openai = await refineWithOpenAI(input.context);
			parsed = openai.raw;
			model = openai.model;
			provider = 'openai';
		} else if (hasGemini) {
			const gemini = await refineWithGemini(input.context);
			parsed = gemini.raw;
			model = gemini.model;
			provider = 'gemini';
		} else {
			return NextResponse.json(heuristicRefine(input.context));
		}

		return NextResponse.json(normalizeCopilotResponse(parsed, input.context, provider, model));
	} catch (err) {
		const fallback = heuristicRefine(input.context);
		return NextResponse.json({
			...fallback,
			warning: err instanceof Error ? err.message : 'LLM refine failed',
		});
	}
}
