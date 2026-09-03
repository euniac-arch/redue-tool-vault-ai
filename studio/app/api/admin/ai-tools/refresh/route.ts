/**
 * POST /api/admin/ai-tools/refresh
 *
 * "⚡ AI 데이터 최신화" — lets an admin sync `aiToolsData.json` with current market data
 * (global market share, monthly visits, rating, month-over-month growth, pricing) via a
 * single click instead of hand-editing JSON. Queries a web-search-capable AI provider
 * (Gemini `google_search` grounding, then OpenAI Responses `web_search`, then Perplexity
 * `sonar` as a final fallback — whichever has a real, non-mocked API key configured) and
 * merges the validated response back into the dataset on disk.
 *
 * Falls back to a deterministic, cost-free "mock" refresh when no provider is configured or
 * every provider call fails, so the button always completes successfully end-to-end.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import type { AiToolCategoryRaw } from '@/lib/admin/ai-tools-management';
import {
	AI_TOOLS_REFRESH_SYSTEM_PROMPT,
	applyAiToolUpdatePatch,
	buildAiToolsRefreshUserPrompt,
	buildMockAiToolPatch,
	extractJsonArrayFromText,
	type AiToolRefreshTarget,
} from '@/lib/admin/ai-tools-refresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DATA_FILE = path.join(process.cwd(), 'data', 'aiToolsData.json');
const BACKUP_DIR = path.join(process.cwd(), '.data', 'ai-tools-backups');

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';

type RefreshProvider = 'gemini' | 'openai' | 'perplexity' | 'mock';

function envString(name: string): string {
	return (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

function isEnvTrue(name: string): boolean {
	return envString(name).toLowerCase() === 'true';
}

function geminiGenerateUrl(model: string): string {
	return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

/** Gemini with native Google Search grounding — best fit for "what's true on the web right now". */
async function callGemini(prompt: string): Promise<string> {
	const apiKey = envString('GEMINI_API_KEY') || envString('GOOGLE_GENERATIVE_AI_API_KEY') || envString('GOOGLE_API_KEY') || envString('GOOGLE_AI_API_KEY');
	if (!apiKey) throw new Error('GEMINI_API_KEY missing');
	const model = envString('AI_TOOLS_REFRESH_GEMINI_MODEL') || envString('GEMINI_MODEL') || 'gemini-2.5-flash';

	const res = await fetch(`${geminiGenerateUrl(model)}?key=${encodeURIComponent(apiKey)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents: [{ role: 'user', parts: [{ text: `${AI_TOOLS_REFRESH_SYSTEM_PROMPT}\n\n${prompt}` }] }],
			tools: [{ google_search: {} }],
			generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
		}),
	});
	const data = (await res.json()) as {
		error?: { message?: string };
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
	const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
	if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
	return text;
}

/** OpenAI Responses API with the hosted `web_search` tool (the Chat Completions search-preview models were retired). */
async function callOpenAi(prompt: string): Promise<string> {
	const apiKey = envString('OPENAI_API_KEY');
	if (!apiKey) throw new Error('OPENAI_API_KEY missing');
	const model = envString('AI_TOOLS_REFRESH_OPENAI_MODEL') || 'gpt-4o-mini';

	const res = await fetch(OPENAI_RESPONSES_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model,
			input: [
				{ role: 'system', content: [{ type: 'input_text', text: AI_TOOLS_REFRESH_SYSTEM_PROMPT }] },
				{ role: 'user', content: [{ type: 'input_text', text: prompt }] },
			],
			tools: [{ type: 'web_search' }],
			tool_choice: 'auto',
		}),
	});
	const data = (await res.json()) as {
		error?: { message?: string };
		output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
	};
	if (!res.ok) throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
	const text = (data.output || [])
		.filter((item) => item.type === 'message')
		.flatMap((item) => item.content || [])
		.filter((part) => part.type === 'output_text' && typeof part.text === 'string')
		.map((part) => part.text as string)
		.join('\n');
	if (!text) throw new Error('OpenAI 응답이 비어 있습니다.');
	return text;
}

/** Perplexity `sonar` — proven real-time web search engine already used elsewhere in this app. */
async function callPerplexity(prompt: string): Promise<string> {
	const apiKey = envString('PERPLEXITY_API_KEY') || envString('PPLX_API_KEY');
	if (!apiKey) throw new Error('PERPLEXITY_API_KEY missing');

	const res = await fetch(PERPLEXITY_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'sonar',
			temperature: 0.2,
			messages: [
				{ role: 'system', content: AI_TOOLS_REFRESH_SYSTEM_PROMPT },
				{ role: 'user', content: prompt },
			],
		}),
	});
	const data = (await res.json()) as {
		error?: { message?: string };
		choices?: Array<{ message?: { content?: string } }>;
	};
	if (!res.ok) throw new Error(data.error?.message || `Perplexity HTTP ${res.status}`);
	const text = data.choices?.[0]?.message?.content || '';
	if (!text) throw new Error('Perplexity 응답이 비어 있습니다.');
	return text;
}

export async function POST() {
	const admin = await requireAdmin();
	if (!admin) {
		return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
	}

	let raw: string;
	try {
		raw = await fs.readFile(DATA_FILE, 'utf8');
	} catch {
		return NextResponse.json({ error: 'aiToolsData.json을 찾을 수 없습니다.' }, { status: 500 });
	}

	let categories: AiToolCategoryRaw[];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) throw new Error('not an array');
		categories = parsed as AiToolCategoryRaw[];
	} catch {
		return NextResponse.json({ error: 'aiToolsData.json 형식이 올바르지 않습니다.' }, { status: 500 });
	}

	const targets: AiToolRefreshTarget[] = categories.flatMap((cat) =>
		cat.tools.map((tool) => ({ id: tool.id, name: tool.name, provider: tool.provider })),
	);
	if (targets.length === 0) {
		return NextResponse.json({ error: '최신화할 AI 도구가 없습니다.' }, { status: 400 });
	}

	const hasGemini =
		Boolean(envString('GEMINI_API_KEY') || envString('GOOGLE_GENERATIVE_AI_API_KEY') || envString('GOOGLE_API_KEY') || envString('GOOGLE_AI_API_KEY')) &&
		!isEnvTrue('MOCK_GEMINI');
	const hasOpenAi = Boolean(envString('OPENAI_API_KEY')) && !isEnvTrue('MOCK_OPENAI');
	const hasPerplexity = Boolean(envString('PERPLEXITY_API_KEY') || envString('PPLX_API_KEY')) && !isEnvTrue('MOCK_PERPLEXITY');

	const prompt = buildAiToolsRefreshUserPrompt(targets);

	let provider: RefreshProvider = 'mock';
	let responseText: string | null = null;
	let lastProviderError: string | undefined;

	for (const attempt of [
		{ enabled: hasGemini, name: 'gemini' as const, call: callGemini },
		{ enabled: hasOpenAi, name: 'openai' as const, call: callOpenAi },
		{ enabled: hasPerplexity, name: 'perplexity' as const, call: callPerplexity },
	]) {
		if (!attempt.enabled) continue;
		try {
			responseText = await attempt.call(prompt);
			provider = attempt.name;
			break;
		} catch (err) {
			lastProviderError = err instanceof Error ? err.message : String(err);
			console.error(`[admin/ai-tools/refresh] ${attempt.name} call failed:`, err);
		}
	}

	const patchesById = new Map<string, unknown>();
	if (responseText) {
		try {
			for (const entry of extractJsonArrayFromText(responseText)) {
				if (entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).id === 'string') {
					patchesById.set((entry as Record<string, unknown>).id as string, entry);
				}
			}
		} catch (err) {
			lastProviderError = err instanceof Error ? err.message : String(err);
			console.error('[admin/ai-tools/refresh] failed to parse AI response as JSON:', err);
			provider = 'mock';
		}
	} else {
		provider = 'mock';
	}

	let updatedCount = 0;
	const updatedCategories: AiToolCategoryRaw[] = categories.map((cat) => ({
		...cat,
		tools: cat.tools.map((tool) => {
			const patch = provider === 'mock' ? buildMockAiToolPatch(tool) : patchesById.get(tool.id);
			const { tool: nextTool, changed } = applyAiToolUpdatePatch(tool, patch);
			if (changed) updatedCount += 1;
			return nextTool;
		}),
	}));

	try {
		await fs.mkdir(BACKUP_DIR, { recursive: true });
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		await fs.writeFile(path.join(BACKUP_DIR, `aiToolsData.${stamp}.json`), raw, 'utf8');

		const tmpFile = `${DATA_FILE}.tmp`;
		await fs.writeFile(tmpFile, JSON.stringify(updatedCategories, null, '\t'), 'utf8');
		await fs.rename(tmpFile, DATA_FILE);
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : 'aiToolsData.json 저장에 실패했습니다.' },
			{ status: 500 },
		);
	}

	const warning =
		provider === 'mock'
			? lastProviderError
				? `실제 API 호출에 실패해 모의(mock) 데이터로 대체했습니다: ${lastProviderError}`
				: 'GEMINI_API_KEY / OPENAI_API_KEY / PERPLEXITY_API_KEY가 설정되지 않아 모의(mock) 데이터로 최신화했습니다.'
			: undefined;

	return NextResponse.json({
		ok: true,
		provider,
		updatedCount,
		totalCount: targets.length,
		updatedAt: new Date().toISOString(),
		warning,
		categories: updatedCategories,
	});
}
