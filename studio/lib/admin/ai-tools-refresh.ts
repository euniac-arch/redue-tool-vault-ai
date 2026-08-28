/**
 * Pure helpers for the "⚡ AI 데이터 최신화" admin action — prompt construction, response
 * parsing, and field-level validation/sanitization for LLM-sourced updates to the tools in
 * `aiToolsData.json`. Provider-specific HTTP calls (Gemini / OpenAI / Perplexity) live in the
 * route handler (`app/api/admin/ai-tools/refresh/route.ts`), mirroring the existing
 * `lib/audit/fact-check.ts` + `app/api/seo/fact-check/route.ts` split in this codebase.
 *
 * Only market-facing signals are ever touched by a refresh — `market_share`, `monthly_visits`,
 * `rating`, `growth`, and `pricing`. Editorial fields (name, desc, tags, guide, recommend_score,
 * is_public, logo_url, url) are curated by admins and are never overwritten here.
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
		'아래 AI 서비스 목록 각각에 대해, 오늘 기준 최신 정보를 웹에서 검색해 다음 필드를 조사해 주세요:',
		'- market_share: 해당 서비스가 속한 카테고리 내 글로벌 시장 점유율 추정치 (0~100 사이 숫자, % 기호 제외)',
		'- monthly_visits: 최근 월간 방문자 수 (예: "3.1B", "180M" 같은 축약 문자열)',
		'- rating: 사용자 평점 (0~5 사이 숫자)',
		'- growth: 전월 대비 성장률 (예: "+8.4%" 또는 "-1.5%" 형식의 문자열)',
		'- pricing: { type, summary, free_tier, paid_tier } — 최신 요금제 변경 사항이나 신규 기능이 있다면 summary/paid_tier에 짧게 반영',
		'',
		'조사 대상 목록:',
		list,
		'',
		'응답은 아래와 동일한 구조의 JSON 배열 하나만 반환하세요 (설명 문장 없이 JSON만 출력):',
		'[{"id":"chatgpt","market_share":59.2,"monthly_visits":"3.2B","rating":4.9,"growth":"+9.1%","pricing":{"type":"Freemium","summary":"...","free_tier":"...","paid_tier":"..."}}]',
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

function sanitizeMarketShare(value: unknown): number | undefined {
	if (!isFiniteNumber(value) || value < 0 || value > 100) return undefined;
	return Math.round(value * 10) / 10;
}

function sanitizeRating(value: unknown): number | undefined {
	if (!isFiniteNumber(value) || value < 0 || value > 5) return undefined;
	return Math.round(value * 100) / 100;
}

function sanitizeGrowth(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return /^[+-]\d{1,3}(\.\d{1,2})?%$/.test(trimmed) ? trimmed : undefined;
}

function sanitizeMonthlyVisits(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return /^\d{1,4}(\.\d{1,2})?\s?[KMB]?\+?$/i.test(trimmed) ? trimmed : undefined;
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

	const marketShare = sanitizeMarketShare(record.market_share);
	const monthlyVisits = sanitizeMonthlyVisits(record.monthly_visits);
	const rating = sanitizeRating(record.rating);
	const growth = sanitizeGrowth(record.growth);

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

	const changed =
		marketShare !== undefined || monthlyVisits !== undefined || rating !== undefined || growth !== undefined || pricingChanged;
	if (!changed) return { tool, changed: false };

	return {
		tool: {
			...tool,
			market_share: marketShare ?? tool.market_share,
			monthly_visits: monthlyVisits ?? tool.monthly_visits,
			rating: rating ?? tool.rating,
			growth: growth ?? tool.growth,
			pricing: pricingChanged ? nextPricing : tool.pricing,
		},
		changed: true,
	};
}

/**
 * Deterministic, cost-free jitter used when no real web-search API key is configured
 * (`MOCK_*=true` / missing keys) — lets the "AI 데이터 최신화" button be demoed end-to-end
 * without spending API credits, matching this app's existing `MOCK_OPENAI` / `MOCK_GEMINI`
 * / `MOCK_PERPLEXITY` convention ("0원 가상 데이터").
 */
export function buildMockAiToolPatch(tool: AiToolRaw): Record<string, unknown> {
	const seed = [...tool.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
	const wobble = ((seed % 21) - 10) / 10; // deterministic, -1.0 ~ 1.0 per tool id
	const marketShare = Math.max(0.1, Math.round((tool.market_share + wobble) * 10) / 10);
	const rating = Math.min(5, Math.max(3.5, Math.round((tool.rating + wobble * 0.05) * 100) / 100));
	const growthValue = Math.round((wobble * 6 + 4) * 10) / 10;
	const growth = `${growthValue >= 0 ? '+' : ''}${growthValue.toFixed(1)}%`;
	return { market_share: marketShare, rating, growth };
}
