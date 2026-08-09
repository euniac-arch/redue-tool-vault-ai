import { NextResponse } from 'next/server';
import {
	buildHeuristicGeoNarrative,
	buildUserPrompt,
	extractOfficialBrandName,
	normalizeGeoNarrative,
	SYSTEM_PROMPT,
	type GeoNarrativeRequest,
	type GeoNarrativeReport,
} from '@/lib/audit/geo-narrative';

export const runtime = 'nodejs';
export const maxDuration = 60;

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

function parseBody(raw: unknown): GeoNarrativeRequest | null {
	if (!raw || typeof raw !== 'object') return null;
	const body = raw as Record<string, unknown>;
	const domain = String(body.domain ?? '').trim();
	if (!domain) return null;

	const technicalFails = Array.isArray(body.technicalFails)
		? body.technicalFails.map((item) => String(item).trim()).filter(Boolean)
		: Array.isArray(body.failItems)
			? body.failItems.map((item) => String(item).trim()).filter(Boolean)
			: [];

	const siteTitle = String(body.siteTitle ?? '').trim() || undefined;
	const brandHint = String(body.brandName ?? '').trim() || undefined;

	return {
		domain,
		siteTitle,
		metaDescription: String(body.metaDescription ?? '').trim() || undefined,
		technicalFails,
		failItems: technicalFails,
		brandName: extractOfficialBrandName(siteTitle || '', domain, brandHint),
		category: String(body.category ?? '').trim() || undefined,
		location: String(body.location ?? '').trim() || undefined,
		broadLocation: String(body.broadLocation ?? '').trim() || undefined,
		lang: String(body.lang ?? 'ko') === 'en' ? 'en' : 'ko',
	};
}

function extractJsonObject(text: string): unknown {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		const start = trimmed.indexOf('{');
		const end = trimmed.lastIndexOf('}');
		if (start >= 0 && end > start) {
			return JSON.parse(trimmed.slice(start, end + 1));
		}
		throw new Error('Model did not return JSON');
	}
}

async function generateWithOpenAI(input: GeoNarrativeRequest): Promise<GeoNarrativeReport> {
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) throw new Error('OPENAI_API_KEY missing');

	const res = await fetch(OPENAI_URL, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: process.env.OPENAI_GEO_MODEL?.trim() || 'gpt-4o-mini',
			temperature: 0.25,
			response_format: { type: 'json_object' },
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: buildUserPrompt(input) },
			],
		}),
	});

	const data = (await res.json()) as {
		error?: { message?: string };
		choices?: Array<{ message?: { content?: string } }>;
	};

	if (!res.ok) {
		throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
	}

	const content = data.choices?.[0]?.message?.content;
	if (!content) throw new Error('Empty OpenAI response');
	return normalizeGeoNarrative(extractJsonObject(content), input);
}

async function generateWithAnthropic(input: GeoNarrativeRequest): Promise<GeoNarrativeReport> {
	const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
	if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

	const res = await fetch(ANTHROPIC_URL, {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: process.env.ANTHROPIC_GEO_MODEL?.trim() || 'claude-3-5-haiku-20241022',
			max_tokens: 2000,
			temperature: 0.25,
			system: SYSTEM_PROMPT,
			messages: [{ role: 'user', content: buildUserPrompt(input) }],
		}),
	});

	const data = (await res.json()) as {
		error?: { message?: string };
		content?: Array<{ type?: string; text?: string }>;
	};

	if (!res.ok) {
		throw new Error(data.error?.message || `Anthropic HTTP ${res.status}`);
	}

	const text = data.content?.find((block) => block.type === 'text')?.text;
	if (!text) throw new Error('Empty Anthropic response');
	return normalizeGeoNarrative(extractJsonObject(text), input);
}

/**
 * POST /api/generate-geo-report
 * Body: { domain, siteTitle, metaDescription, technicalFails, ...hints }
 * Returns evidence-bound GEO narrative JSON for the audit result UI.
 */
export async function POST(request: Request) {
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
	}

	const input = parseBody(raw);
	if (!input) {
		return NextResponse.json({ error: 'domain이 필요합니다.' }, { status: 400 });
	}

	const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
	const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

	try {
		let report: GeoNarrativeReport;
		let provider: 'openai' | 'anthropic' | 'heuristic' = 'heuristic';

		if (hasOpenAI) {
			report = await generateWithOpenAI(input);
			provider = 'openai';
		} else if (hasAnthropic) {
			report = await generateWithAnthropic(input);
			provider = 'anthropic';
		} else {
			report = buildHeuristicGeoNarrative(input);
			provider = 'heuristic';
		}

		return NextResponse.json({ ...report, provider });
	} catch (err) {
		const report = buildHeuristicGeoNarrative(input);
		return NextResponse.json({
			...report,
			provider: 'heuristic',
			warning: err instanceof Error ? err.message : 'LLM generation failed',
		});
	}
}
