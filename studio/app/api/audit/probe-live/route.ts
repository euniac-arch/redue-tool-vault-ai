import { NextRequest, NextResponse } from 'next/server';
import type { LiveProbeEngineResult } from '@/types/live-probe';

export const runtime = 'nodejs';
export const maxDuration = 60;

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const LIVE_SYSTEM_PROMPT =
	'당신은 검색 사용자에게 정확한 정보를 제공하는 AI 어시스턴트입니다. 질문에 대해 간결하고 핵심적인 사실 위주로 2~3문장으로 답변하세요.';

function noStoreJson(body: unknown, init?: { status?: number }) {
	return NextResponse.json(body, {
		status: init?.status,
		headers: {
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
		},
	});
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function mentionsBrand(text: string, brandName: string): boolean {
	const brand = brandName.trim();
	if (!brand) return false;
	return text.toLowerCase().includes(brand.toLowerCase());
}

function missingKeyResult(
	id: LiveProbeEngineResult['id'],
	name: string,
	icon: string,
	envName: string,
): LiveProbeEngineResult {
	return {
		id,
		name,
		icon,
		isLive: false,
		levelBadge: 'Level 1 브랜드전용',
		responsePreview: `${envName}가 .env에 설정되지 않았습니다.`,
		tags: ['#API키누락', '#시뮬레이션폴백'],
	};
}

function errorResult(
	id: LiveProbeEngineResult['id'],
	name: string,
	icon: string,
	message: string,
): LiveProbeEngineResult {
	return {
		id,
		name,
		icon,
		isLive: false,
		levelBadge: 'Level 1 브랜드전용',
		responsePreview: message,
		tags: ['#API호출실패', '#시뮬레이션폴백'],
	};
}

async function runOpenAI(targetQuery: string, brandName: string): Promise<LiveProbeEngineResult> {
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		return missingKeyResult('chatgpt', 'ChatGPT (gpt-4o-mini)', '🟢', 'OPENAI_API_KEY');
	}

	try {
		const res = await fetch(OPENAI_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: 'gpt-4o-mini',
				messages: [
					{ role: 'system', content: LIVE_SYSTEM_PROMPT },
					{ role: 'user', content: targetQuery },
				],
				max_tokens: 180,
				temperature: 0.2,
			}),
		});

		const data = (await res.json()) as {
			error?: { message?: string };
			choices?: Array<{ message?: { content?: string } }>;
		};

		if (!res.ok) {
			throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
		}

		const responseText = data.choices?.[0]?.message?.content?.trim() || '';
		const isMentioned = mentionsBrand(responseText, brandName);

		return {
			id: 'chatgpt',
			name: 'ChatGPT (gpt-4o-mini · 실시간)',
			icon: '🟢',
			isLive: true,
			levelBadge: isMentioned ? 'Level 2 세부검색 인용' : 'Level 1 브랜드전용',
			responsePreview: responseText || '모델이 빈 응답을 반환했습니다.',
			tags: isMentioned
				? ['#실시간API호출성공', '#엔티티인식확인', '#gpt-4o-mini']
				: ['#실시간API호출', '#비보안출처_미인용', '#브랜드전용트리거'],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'OpenAI 호출에 실패했습니다.';
		return errorResult('chatgpt', 'ChatGPT (gpt-4o-mini)', '🟢', message);
	}
}

async function runClaude(targetQuery: string, brandName: string): Promise<LiveProbeEngineResult> {
	const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim().replace(/^["']|["']$/g, '');
	if (!apiKey) {
		return missingKeyResult('claude', 'Claude (3.5 Haiku)', '🟣', 'ANTHROPIC_API_KEY');
	}

	const models = [
		(process.env.ANTHROPIC_MODEL || '').trim().replace(/^["']|["']$/g, '') || 'claude-haiku-4-5-20251001',
		'claude-3-5-haiku-20241022',
		'claude-3-haiku-20240307',
	].filter((model, index, list) => model && list.indexOf(model) === index);

	try {
		let lastError = 'Anthropic HTTP error';
		for (const model of models) {
			const res = await fetch(ANTHROPIC_URL, {
				method: 'POST',
				headers: {
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model,
					max_tokens: 180,
					system: LIVE_SYSTEM_PROMPT,
					messages: [{ role: 'user', content: targetQuery }],
				}),
			});

			const data = (await res.json()) as {
				error?: { message?: string };
				content?: Array<{ type?: string; text?: string }>;
			};

			if (!res.ok) {
				lastError = data.error?.message || `Anthropic HTTP ${res.status} (${model})`;
				const unavailable =
					res.status === 404 ||
					/not found|does not exist|invalid model|unsupported|no longer available/i.test(lastError);
				if (unavailable) continue;
				throw new Error(lastError);
			}

			const responseText = data.content?.find((block) => block.type === 'text')?.text?.trim() || '';
			const isMentioned = mentionsBrand(responseText, brandName);

			return {
				id: 'claude',
				name: 'Claude (3.5 Haiku · 실시간)',
				icon: '🟣',
				isLive: true,
				levelBadge: isMentioned ? 'Level 2 세부검색 인용' : 'Level 1 브랜드전용',
				responsePreview: responseText || '모델이 빈 응답을 반환했습니다.',
				tags: isMentioned
					? ['#실시간API호출성공', '#지식그래프식별', '#3.5Haiku']
					: ['#실시간API호출', '#브랜드전용트리거', '#외부언급량부족'],
			};
		}

		throw new Error(lastError);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Claude 호출에 실패했습니다.';
		return errorResult('claude', 'Claude (3.5 Haiku)', '🟣', message);
	}
}

/**
 * POST /api/audit/probe-live
 * Body: { query?, brandName? }
 *
 * Calls gpt-4o-mini and Claude Haiku in parallel. Used only by the
 * 🔴 LIVE AI button — the simulation CTA keeps hitting /api/audit/ai-visibility.
 */
export async function POST(req: NextRequest) {
	try {
		const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
		const brandName = asString(body.brandName);
		const query = asString(body.query);
		const targetQuery = query || `${brandName} 위치 및 주요 진료 정보 알려줘`.trim();

		if (!targetQuery) {
			return noStoreJson({ success: false, error: 'query 또는 brandName이 필요합니다.' }, { status: 400 });
		}

		const [openAiResult, claudeResult] = await Promise.all([
			runOpenAI(targetQuery, brandName),
			runClaude(targetQuery, brandName),
		]);

		return noStoreJson({
			success: true,
			isRealApi: true,
			results: [openAiResult, claudeResult],
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Live probe failed';
		return noStoreJson({ success: false, error: message }, { status: 500 });
	}
}
