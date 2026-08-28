/**
 * POST /api/seo/fact-check
 *
 * AI Schema Fact-Check (Semantic Cross-Check). Complements the existing
 * deterministic JSON-LD syntax/required-field checks by asking a lightweight
 * LLM to cross-reference the *visible page text* against the *injected
 * JSON-LD* and flag industry mismatches, hallucinated claims, and wrong
 * contact/NAP data.
 *
 * Body: { url: string, html?: string, forceRefresh?: boolean }
 *   - `html` lets a caller that already fetched the page (e.g. the main audit
 *     scan) skip a duplicate network hop; otherwise this route fetches it.
 *   - `forceRefresh` bypasses the 10-minute cache.
 *
 * Response: `FactCheckResponse` — the LLM's `{ integrity_score, status,
 * summary, issues[] }` contract plus caching/provider metadata alongside it.
 */
import { NextResponse } from 'next/server';
import { assertPublicHttpUrl } from '@/lib/ssrf-guard';
import { fetchPageResource } from '@/lib/audit/fetch-page';
import { getCachedFactCheck, setCachedFactCheck } from '@/lib/audit/fact-check-cache';
import {
	buildFactCheckPageContext,
	buildFactCheckUserPrompt,
	buildHeuristicFactCheck,
	collectSchemaTypes,
	computeFactCheckCacheKey,
	extractJsonObjectFromText,
	extractSchemaBlocks,
	normalizeFactCheckResult,
	FACT_CHECK_SYSTEM_PROMPT,
	type FactCheckProvider,
	type FactCheckResponse,
	type FactCheckResult,
} from '@/lib/audit/fact-check';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function geminiGenerateUrl(model: string): string {
	return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

function envString(name: string): string {
	return (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

function isEnvTrue(name: string): boolean {
	return envString(name).toLowerCase() === 'true';
}

interface FactCheckBody {
	url?: string;
	html?: string;
	forceRefresh?: boolean;
}

/** Error-handling + token-optimized OpenAI call: Structured Outputs (`json_object`), lightweight `gpt-4o-mini` default. */
async function runOpenAIFactCheck(userPrompt: string): Promise<{ result: FactCheckResult; model: string }> {
	const apiKey = envString('OPENAI_API_KEY');
	if (!apiKey) throw new Error('OPENAI_API_KEY missing');
	const model = envString('FACT_CHECK_OPENAI_MODEL') || 'gpt-4o-mini';

	const res = await fetch(OPENAI_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model,
			temperature: 0.1,
			response_format: { type: 'json_object' },
			messages: [
				{ role: 'system', content: FACT_CHECK_SYSTEM_PROMPT },
				{ role: 'user', content: userPrompt },
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
	return { result: normalizeFactCheckResult(extractJsonObjectFromText(content)), model };
}

/** Fallback engine when OPENAI_API_KEY is absent: Gemini Flash, forced JSON MIME type. */
async function runGeminiFactCheck(userPrompt: string): Promise<{ result: FactCheckResult; model: string }> {
	const apiKey = envString('GEMINI_API_KEY') || envString('GOOGLE_GENERATIVE_AI_API_KEY') || envString('GOOGLE_API_KEY');
	if (!apiKey) throw new Error('GEMINI_API_KEY missing');
	const model = envString('FACT_CHECK_GEMINI_MODEL') || envString('GEMINI_MODEL') || 'gemini-2.5-flash';

	const res = await fetch(`${geminiGenerateUrl(model)}?key=${encodeURIComponent(apiKey)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents: [{ role: 'user', parts: [{ text: `${FACT_CHECK_SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
			generationConfig: { temperature: 0.1, maxOutputTokens: 1500, responseMimeType: 'application/json' },
		}),
	});

	const data = (await res.json()) as {
		error?: { message?: string };
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);

	const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
	if (!text) throw new Error('Empty Gemini response');
	return { result: normalizeFactCheckResult(extractJsonObjectFromText(text)), model };
}

function parseBody(raw: unknown): FactCheckBody {
	if (!raw || typeof raw !== 'object') return {};
	const body = raw as Record<string, unknown>;
	return {
		url: typeof body.url === 'string' ? body.url.trim() : undefined,
		html: typeof body.html === 'string' ? body.html : undefined,
		forceRefresh: body.forceRefresh === true,
	};
}

export async function POST(request: Request) {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return noStoreJson({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const body = parseBody(raw);
	if (!body.url) {
		return noStoreJson({ error: 'url이 필요합니다.' }, { status: 400 });
	}

	let finalUrl = body.url;
	let html = body.html || '';
	try {
		if (!html) {
			const validated = await assertPublicHttpUrl(body.url);
			const page = await fetchPageResource(validated.href, { forceRefresh: body.forceRefresh });
			if (!page.text) {
				return noStoreJson({ error: '페이지를 가져올 수 없습니다.', stage: 'fetch' }, { status: 502 });
			}
			html = page.text;
			finalUrl = page.finalUrl;
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : '페이지를 가져올 수 없습니다.';
		return noStoreJson({ error: message, stage: 'fetch' }, { status: 400 });
	}

	const schemaBlocks = extractSchemaBlocks(html);
	const schemaTypes = collectSchemaTypes(schemaBlocks);
	const cacheKey = computeFactCheckCacheKey(finalUrl, schemaBlocks);

	// Cost defense: identical URL + identical schema hash short-circuits the LLM call for 10 minutes.
	if (!body.forceRefresh) {
		const cached = await getCachedFactCheck(cacheKey);
		if (cached) {
			return noStoreJson({ ...cached, cached: true } satisfies FactCheckResponse);
		}
	}

	if (schemaBlocks.length === 0) {
		const response: FactCheckResponse = {
			url: finalUrl,
			checkedAt: new Date().toISOString(),
			provider: 'heuristic',
			cached: false,
			cacheKey,
			schemaTypes: [],
			schemaBlocks: [],
			hasSchema: false,
			integrity_score: 0,
			status: 'danger',
			summary: '검증할 JSON-LD 스키마가 없습니다.',
			issues: [
				{
					severity: 'high',
					type: 'JSON-LD 스키마 없음',
					field: 'application/ld+json',
					detected_value: '(없음)',
					description: '페이지에서 application/ld+json 스키마를 찾을 수 없어 팩트체크를 수행할 수 없습니다.',
					recommendation: 'Schema.org JSON-LD 마크업을 페이지에 주입한 뒤 다시 진단하세요.',
				},
			],
		};
		await setCachedFactCheck(cacheKey, response);
		return noStoreJson(response);
	}

	const context = buildFactCheckPageContext(html, finalUrl);
	const userPrompt = buildFactCheckUserPrompt(context, schemaBlocks);

	const hasOpenAI = Boolean(envString('OPENAI_API_KEY')) && !isEnvTrue('MOCK_OPENAI');
	const hasGemini =
		Boolean(envString('GEMINI_API_KEY') || envString('GOOGLE_GENERATIVE_AI_API_KEY') || envString('GOOGLE_API_KEY')) &&
		!isEnvTrue('MOCK_GEMINI');

	let result: FactCheckResult;
	let provider: FactCheckProvider = 'heuristic';
	let model: string | undefined;
	let warning: string | undefined;

	try {
		if (hasOpenAI) {
			const openai = await runOpenAIFactCheck(userPrompt);
			result = openai.result;
			model = openai.model;
			provider = 'openai';
		} else if (hasGemini) {
			const gemini = await runGeminiFactCheck(userPrompt);
			result = gemini.result;
			model = gemini.model;
			provider = 'gemini';
		} else {
			result = buildHeuristicFactCheck(context, schemaBlocks);
			provider = 'heuristic';
			warning = 'OPENAI_API_KEY / GEMINI_API_KEY가 설정되지 않아 휴리스틱 판정을 사용했습니다.';
		}
	} catch (err) {
		console.error('[seo/fact-check] LLM call failed, falling back to heuristic:', err);
		result = buildHeuristicFactCheck(context, schemaBlocks);
		provider = 'heuristic';
		warning = err instanceof Error ? err.message : 'LLM 호출에 실패하여 휴리스틱 판정을 사용했습니다.';
	}

	const response: FactCheckResponse = {
		url: finalUrl,
		checkedAt: new Date().toISOString(),
		provider,
		model,
		cached: false,
		cacheKey,
		schemaTypes,
		schemaBlocks,
		hasSchema: true,
		...result,
		warning,
	};

	await setCachedFactCheck(cacheKey, response);
	return noStoreJson(response);
}
