/**
 * POST /api/diagnose/sov-analysis
 *
 * Live AI Share-of-Voice: asks gpt-4o-mini (fallback: Gemini Flash) for
 * top-3 recommendations on each diagnostic query in parallel, then scores
 * whether the audited brand is rank 1 / mentioned / missing.
 *
 * Body: { targetBrand, region?, queries[], siteUrl?, brandAliases?, lang?, forceRefresh? }
 */
import { loadEnvConfig } from '@next/env';
import path from 'path';
import { NextResponse } from 'next/server';
import { getCachedLiveSov, setCachedLiveSov } from '@/lib/audit/sov-live-cache';
import {
	buildEstimatedLiveSlices,
	buildLiveSovUserPrompt,
	collectBrandTokens,
	computeLiveSovCacheKey,
	parseLiveLlmPayload,
	scoreLiveRecommendations,
	SOV_LIVE_SYSTEM_PROMPT,
	type LiveSovAnalysisResponse,
	type LiveSovProvider,
	type LiveSovRecommendation,
	type LiveSovSlicePayload,
} from '@/lib/audit/sov-live-measure';

loadEnvConfig(path.join(process.cwd(), '..'));
loadEnvConfig(process.cwd());

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const LLM_TIMEOUT_MS = 5_000;

function geminiGenerateUrl(model: string): string {
	return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
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

function asString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

interface RequestBody {
	targetBrand: string;
	region: string;
	queries: string[];
	siteUrl?: string;
	brandAliases?: string[];
	lang?: 'ko' | 'en';
	forceRefresh?: boolean;
}

function parseBody(raw: unknown): RequestBody {
	const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const queries = Array.isArray(body.queries)
		? body.queries.map((item) => asString(item)).filter(Boolean).slice(0, 3)
		: [];
	const aliases = Array.isArray(body.brandAliases)
		? body.brandAliases.map((item) => asString(item)).filter((item) => item.length >= 2)
		: [];
	return {
		targetBrand: asString(body.targetBrand),
		region: asString(body.region),
		queries,
		siteUrl: asString(body.siteUrl) || undefined,
		brandAliases: aliases.length ? aliases : undefined,
		lang: body.lang === 'en' ? 'en' : 'ko',
		forceRefresh: body.forceRefresh === true,
	};
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = LLM_TIMEOUT_MS): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

async function callOpenAi(userPrompt: string): Promise<{ recs: LiveSovRecommendation[]; recommendationSnippet: string; model: string }> {
	const apiKey = envString('OPENAI_API_KEY');
	if (!apiKey) throw new Error('OPENAI_API_KEY missing');
	const model = envString('SOV_OPENAI_MODEL') || envString('OPENAI_GEO_MODEL') || 'gpt-4o-mini';
	const res = await fetchWithTimeout(OPENAI_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model,
			temperature: 0.2,
			response_format: { type: 'json_object' },
			messages: [
				{ role: 'system', content: SOV_LIVE_SYSTEM_PROMPT },
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
	return { ...parseLiveLlmPayload(content), model };
}

async function callGemini(userPrompt: string): Promise<{ recs: LiveSovRecommendation[]; recommendationSnippet: string; model: string }> {
	const apiKey =
		envString('GEMINI_API_KEY') ||
		envString('GOOGLE_GENERATIVE_AI_API_KEY') ||
		envString('GOOGLE_API_KEY') ||
		envString('GOOGLE_AI_API_KEY');
	if (!apiKey) throw new Error('GEMINI_API_KEY missing');
	const model = envString('SOV_GEMINI_MODEL') || 'gemini-1.5-flash';
	const res = await fetchWithTimeout(`${geminiGenerateUrl(model)}?key=${encodeURIComponent(apiKey)}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: SOV_LIVE_SYSTEM_PROMPT }] },
			contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
			generationConfig: { temperature: 0.2, maxOutputTokens: 800, responseMimeType: 'application/json' },
		}),
	});
	const data = (await res.json()) as {
		error?: { message?: string };
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
	const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
	if (!text) throw new Error('Empty Gemini response');
	return { ...parseLiveLlmPayload(text), model };
}

type LiveLlmProvider = Exclude<LiveSovProvider, 'estimate'>;

function resolveProvider(): { primary: LiveLlmProvider; fallback: LiveLlmProvider | null } | null {
	const hasOpenAI = Boolean(envString('OPENAI_API_KEY')) && !isEnvTrue('MOCK_OPENAI');
	const hasGemini =
		Boolean(
			envString('GEMINI_API_KEY') ||
				envString('GOOGLE_GENERATIVE_AI_API_KEY') ||
				envString('GOOGLE_API_KEY') ||
				envString('GOOGLE_AI_API_KEY'),
		) && !isEnvTrue('MOCK_GEMINI');
	if (hasOpenAI) return { primary: 'openai', fallback: hasGemini ? 'gemini' : null };
	if (hasGemini) return { primary: 'gemini', fallback: null };
	return null;
}

async function recommendOne(
	query: string,
	region: string,
	provider: LiveLlmProvider,
): Promise<{ recs: LiveSovRecommendation[]; recommendationSnippet: string; model: string; provider: LiveSovProvider }> {
	const prompt = buildLiveSovUserPrompt(query, region);
	if (provider === 'openai') {
		const result = await callOpenAi(prompt);
		return { ...result, provider };
	}
	const result = await callGemini(prompt);
	return { ...result, provider };
}

function estimatedResponse(input: {
	cacheKey: string;
	targetBrand: string;
	region: string;
	queries: string[];
	lang?: 'ko' | 'en';
	siteUrl?: string;
}): LiveSovAnalysisResponse {
	return {
		success: true,
		cached: false,
		degraded: true,
		cacheKey: input.cacheKey,
		provider: 'estimate',
		model: 'estimate',
		targetBrand: input.targetBrand,
		region: input.region,
		measuredAt: new Date().toISOString(),
		slices: buildEstimatedLiveSlices({
			queries: input.queries,
			targetBrand: input.targetBrand,
			region: input.region,
			lang: input.lang,
			identityKey: [input.targetBrand, input.siteUrl || '', input.region].join('|'),
		}),
	};
}

export async function POST(request: Request) {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return noStoreJson({ success: false, error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const body = parseBody(raw);
	if (!body.targetBrand) {
		return noStoreJson({ success: false, error: 'targetBrand가 필요합니다.' }, { status: 400 });
	}
	if (!body.queries.length) {
		return noStoreJson({ success: false, error: 'queries 배열이 필요합니다.' }, { status: 400 });
	}

	const cacheKey = computeLiveSovCacheKey({
		targetBrand: body.targetBrand,
		region: body.region,
		queries: body.queries,
		siteUrl: body.siteUrl,
	});
	const estimate = () =>
		estimatedResponse({
			cacheKey,
			targetBrand: body.targetBrand,
			region: body.region,
			queries: body.queries,
			lang: body.lang,
			siteUrl: body.siteUrl,
		});

	try {
		if (!body.forceRefresh) {
			const cached = await getCachedLiveSov(cacheKey);
			if (cached) {
				return noStoreJson({ ...cached, cached: true } satisfies LiveSovAnalysisResponse);
			}
		}

		const engines = resolveProvider();
		if (!engines) {
			return noStoreJson(estimate());
		}

		const brandTokens = collectBrandTokens({
			targetBrand: body.targetBrand,
			siteUrl: body.siteUrl,
			brandAliases: body.brandAliases,
		});

		const settled = await Promise.all(
			body.queries.map(async (query, index) => {
				try {
					const primary = await recommendOne(query, body.region, engines.primary);
					return { query, index, ...primary };
				} catch (primaryErr) {
					if (engines.fallback) {
						try {
							const fallback = await recommendOne(query, body.region, engines.fallback);
							return { query, index, ...fallback };
						} catch (fallbackErr) {
							console.error('[diagnose/sov-analysis] query fallback failed:', query, fallbackErr);
						}
					} else {
						console.error('[diagnose/sov-analysis] query failed:', query, primaryErr);
					}
					return {
						query,
						index,
						recs: [] as LiveSovRecommendation[],
						recommendationSnippet: '',
						model: '',
						provider: engines.primary as LiveSovProvider,
					};
				}
			}),
		);

		if (settled.every((item) => item.recs.length === 0)) {
			return noStoreJson(estimate());
		}

		const slices: LiveSovSlicePayload[] = settled.map((item) =>
			scoreLiveRecommendations({
				query: item.query,
				index: item.index,
				recommendations: item.recs,
				targetBrand: body.targetBrand,
				brandTokens,
				region: body.region,
				lang: body.lang,
				recommendationSnippet: item.recommendationSnippet,
			}),
		);

		const used = settled.find((item) => item.recs.length > 0) || settled[0];
		const response: LiveSovAnalysisResponse = {
			success: true,
			cached: false,
			cacheKey,
			provider: used?.provider || engines.primary,
			model: used?.model || (engines.primary === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-flash'),
			targetBrand: body.targetBrand,
			region: body.region,
			measuredAt: new Date().toISOString(),
			slices,
		};

		await setCachedLiveSov(cacheKey, response);
		return noStoreJson(response);
	} catch (err) {
		console.error('[diagnose/sov-analysis] graceful fallback:', err);
		return noStoreJson(estimate());
	}
}
