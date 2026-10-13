/**
 * Pure helpers for the "⚡ AI 데이터 최신화" admin action — prompt construction, response
 * parsing, and field-level validation/sanitization for LLM-sourced updates to the tools in
 * `aiToolsData.json`. Provider-specific HTTP calls (Gemini / OpenAI / Perplexity) live in the
 * route handler (`app/api/admin/ai-tools/refresh/route.ts`), mirroring the existing
 * `lib/audit/fact-check.ts` + `app/api/seo/fact-check/route.ts` split in this codebase.
 *
 * Pricing can still be refreshed from a sourced reply. Market share, visits, and growth are ignored:
 * unsourced model output must not overwrite the published web-traffic observation.
 */

import type { AiToolPricing, AiToolRaw } from './ai-tools-management';

export const AI_TOOLS_REFRESH_SYSTEM_PROMPT =
	'당신은 웹 검색으로 글로벌 생성형 AI 서비스의 최신 시장 데이터를 조사하는 리서치 애널리스트입니다. ' +
	'반드시 웹 검색으로 확인 가능한 사실에 근거해 답변하고, 확실하지 않은 항목은 생략하세요. ' +
	'출력은 순수 JSON 배열 하나만 반환합니다. 마크다운 코드블록, 설명 문장, 주석을 절대 포함하지 마세요.';

export interface AiToolRefreshTarget {
	id: string;
	name: string;
	provider: string;
}

/** Builds the user-turn prompt listing every tool the model should look up and report back on. */
export function buildAiToolsRefreshUserPrompt(targets: AiToolRefreshTarget[]): string {
	const list = targets.map((t) => `- id: "${t.id}" | 서비스명: ${t.name} (${t.provider})`).join('\n');
	return [
		'아래 AI 서비스 목록 각각에 대해, 오늘 확인되는 요금제만 조사해 주세요.',
		'market_share, monthly_visits, growth는 보내지 마세요. 출처 URL이 없는 점유율은 추정하지 않습니다.',
		'- pricing: { type, summary, free_tier, paid_tier } — 확인된 요금제만 짧게 반영',
		'',
		'조사 대상 목록:',
		list,
		'',
		'응답은 아래와 동일한 구조의 JSON 배열 하나만 반환하세요 (설명 문장 없이 JSON만 출력):',
		'[{"id":"chatgpt","pricing":{"type":"Freemium","summary":"...","free_tier":"...","paid_tier":"..."}}]',
		'',
		'반드시 위에 나열된 id 값을 그대로 사용하고, 목록에 없는 항목은 추가하지 마세요. 확실하지 않은 필드는 아예 생략하세요.',
	].join('\n');
}

/** Extracts a top-level JSON array from raw LLM text, tolerating markdown fences / stray prose. */
export function extractJsonArrayFromText(text: string): unknown[] {
	const trimmed = text.trim();
	const tryParse = (raw: string): unknown[] | null => {
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : null;
		} catch {
			return null;
		}
	};

	const direct = tryParse(trimmed);
	if (direct) return direct;

	const start = trimmed.indexOf('[');
	const end = trimmed.lastIndexOf(']');
	if (start >= 0 && end > start) {
		const sliced = tryParse(trimmed.slice(start, end + 1));
		if (sliced) return sliced;
	}
	throw new Error('AI 응답에서 JSON 배열을 찾을 수 없습니다.');
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function sanitizeRating(value: unknown): number | undefined {
	if (!isFiniteNumber(value) || value < 0 || value > 5) return undefined;
	return Math.round(value * 100) / 100;
}

function sanitizeShortText(value: unknown, maxLen: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (!trimmed || trimmed.length > maxLen) return undefined;
	return trimmed;
}

/**
 * Applies a single LLM-sourced update record onto an existing tool. Any field that's missing,
 * malformed, or out of range is silently skipped and the original value is kept — a partially
 * bad AI response never corrupts good data, it just under-updates.
 */
export function applyAiToolUpdatePatch(tool: AiToolRaw, patch: unknown): { tool: AiToolRaw; changed: boolean } {
	if (!patch || typeof patch !== 'object') return { tool, changed: false };
	const record = patch as Record<string, unknown>;

	const rating = sanitizeRating(record.rating);

	let pricingChanged = false;
	const nextPricing: AiToolPricing = { ...tool.pricing };
	if (record.pricing && typeof record.pricing === 'object') {
		const p = record.pricing as Record<string, unknown>;
		const type = sanitizeShortText(p.type, 40);
		const summary = sanitizeShortText(p.summary, 140);
		const freeTier = sanitizeShortText(p.free_tier, 220);
		const paidTier = sanitizeShortText(p.paid_tier, 220);
		if (type) {
			nextPricing.type = type;
			pricingChanged = true;
		}
		if (summary) {
			nextPricing.summary = summary;
			pricingChanged = true;
		}
		if (freeTier) {
			nextPricing.free_tier = freeTier;
			pricingChanged = true;
		}
		if (paidTier) {
			nextPricing.paid_tier = paidTier;
			pricingChanged = true;
		}
	}

	const changed = rating !== undefined || pricingChanged;
	if (!changed) return { tool, changed: false };

	return {
		tool: {
			...tool,
			rating: rating ?? tool.rating,
			pricing: pricingChanged ? nextPricing : tool.pricing,
		},
		changed: true,
	};
}

/** Mock mode does not invent market share, visits, or growth. */
export function buildMockAiToolPatch(_tool: AiToolRaw): Record<string, unknown> {
	return {};
}
