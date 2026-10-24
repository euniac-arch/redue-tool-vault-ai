import {
	classifyProviderError,
	describeFailure,
	extractProviderError,
	scrubSecrets,
	stopsModelFallback,
	type LiveFailureDetail,
} from '@/lib/audit/live-check-errors';
import {
	LIVE_CHECK_TIMEOUT_MS,
	buildFailedLiveResult,
	buildLiveEngineResult,
	buildMockLiveResult,
	groundingObservationFromSearch,
	LiveCheckParseError,
	parseLiveCheckPayload,
	ruleScoreFor,
	type SearchEvidence,
} from '@/lib/audit/live-check-score';
import { buildSovIndustryPromptGuide } from '@/lib/audit/sov-industry-guard';
import { buildSovNichePromptGuide } from '@/lib/audit/sov-niche-entity';
import {
	LIVE_GROUNDED_ENGINE_IDS,
	type LiveCheckEngineId,
	type LiveEngineCheckResult,
	type LiveFailureKind,
	type LiveGroundedEngineId,
} from '@/types/live-engine-check';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
/**
 * Fallbacks are used only when the primary model is reported unavailable. Both names were
 * returned by `GET /v1beta/models` for this project's key with generateContent support on
 * 2026-10-24, and the Gemini models page lists `gemini-3.5-flash-lite` as Stable.
 * `gemini-1.5-*` is not served and `gemini-2.0-flash` is shut down, so neither is listed.
 */
const GEMINI_FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'] as const;
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_FALLBACK_MODELS = ['claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'] as const;

function envString(name: string): string {
	return (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

function isEnvTrue(name: string): boolean {
	return envString(name).toLowerCase() === 'true';
}

function isProductionRuntime(): boolean {
	return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

let mockIgnoredWarned = false;

/**
 * MOCK_* flags only apply outside production. In production they are ignored with a warning,
 * so a stray flag can never replace a real measurement with test data.
 */
function isMockEnabled(name: string): boolean {
	if (!isEnvTrue(name)) return false;
	if (isProductionRuntime()) {
		if (!mockIgnoredWarned) {
			mockIgnoredWarned = true;
			console.warn(`[Live Check] ${name}=true is ignored in production. Real API calls are used.`);
		}
		return false;
	}
	return true;
}

function liveCheckMockFlags(): Record<LiveGroundedEngineId, boolean> {
	return {
		chatgpt: isMockEnabled('MOCK_OPENAI'),
		gemini: isMockEnabled('MOCK_GEMINI'),
		perplexity: isMockEnabled('MOCK_PERPLEXITY'),
		claude: isMockEnabled('MOCK_CLAUDE'),
	};
}

function mockResult(engine: LiveGroundedEngineId, input: LiveCheckEngineInput): LiveEngineCheckResult {
	console.info(`[${engine} Live Check] mock data (not a measurement)`, { engine });
	return buildMockLiveResult(engine, ruleScoreFor(engine, input.ruleScores));
}

function uniqueModels(models: readonly string[]): string[] {
	const seen = new Set<string>();
	const resolved: string[] = [];
	for (const model of models) {
		const id = model.trim();
		if (!id || seen.has(id)) continue;
		seen.add(id);
		resolved.push(id);
	}
	return resolved;
}

function resolveGeminiModels(): string[] {
	return uniqueModels([envString('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]);
}

function resolveAnthropicModels(): string[] {
	return uniqueModels([envString('ANTHROPIC_MODEL') || DEFAULT_ANTHROPIC_MODEL, ...ANTHROPIC_FALLBACK_MODELS]);
}

function resolvePerplexityModels(): string[] {
	const requested = envString('PERPLEXITY_MODEL');
	const deprecated = /llama|pplx|sonar-small|sonar-medium|sonar-large/i.test(requested);
	if (deprecated) {
		console.error('[Perplexity Error Detail]:', `${requested} 모델은 지원이 종료되었습니다. sonar로 호출합니다.`);
	}
	return uniqueModels([!requested || deprecated ? 'sonar' : requested, 'sonar', 'sonar-pro']);
}

function geminiGenerateUrl(model: string): string {
	return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

/** Human-readable schema shown inline in prompts (Perplexity + fallback text instructions). */
const LIVE_JSON_SCHEMA =
	'{"isCited":boolean,"mentionType":"none"|"simple_mention"|"recommended","rank":1|2|3|null,"evidenceSnippet":"한 줄 판정 요약(한국어)","reachLevel":"Level 1"|"Level 2"|"Level 3","citationUrl":"http로 시작하는 출처 URL, 없으면 빈 문자열","citations":[{"title":string,"url":string,"isTargetMention":boolean}]}';

function liveJsonSystemPrompt(brandAliases: readonly string[] = [], targetUrl = ''): string {
	const aliasLine = brandAliases.length
		? `대상 브랜드 별칭(brandAliases): [${brandAliases.join(', ')}]. 본문/제목/스니펫에 이 중 하나라도 주체로 언급되면 자사 멘션입니다.`
		: '대상 상호와 공식 URL을 brandAliases로 사용하세요.';
	return [
		'당신은 사이트에 종속되지 않는 범용 실시간 AI 검색 추천 분석기(LLM-as-a-Judge)입니다.',
		aliasLine,
		targetUrl ? `공식 사이트(targetUrl): ${targetUrl}` : '',
		'질의에 답할 때 대상 상호/공식 사이트가 답변 본문에 실제로 추천·인용되었는지 문맥과 감성까지 판별하세요.',
		'인용 분류: (1) Owned Citation = 출처 URL이 targetUrl 도메인과 일치. (2) Brand Earned Citation = 네이버 블로그·지도·카페·티스토리 등 3자 채널이지만 brandAliases가 주체로 추천/언급 → isTargetMention=true, 자사 SoV 합산. (3) Unbranded Third-Party = 브랜드 언급 없이 일반 정보/경쟁사만 나열 → isTargetMention=false.',
		'"언급되지 않음", "포함되지 않음", "추천하지 않음", "정보 없음", "찾을 수 없음", "not mentioned", "no information" 등',
		'부정 표현이 있는 경우, 대상 이름이 문장에 등장하더라도 절대 인용/추천으로 취급하지 말고 isCited=false, mentionType="none"으로 판정하세요.',
		'"정황은 약", "노출이 적", "다른 곳이 주로 노출", "추천된 정황은", "확인이 어렵", "정보가 부족", "우선순위가 낮" 등',
		'유보·약세 표현이 있으면 도메인/상호가 나와도 mentionType="simple_mention", rank=null 로 판정하세요. 강한 추천으로 올리지 마세요.',
		'mentionType은 다음 세 가지 중 하나입니다:',
		'"none"(전혀 언급/추천되지 않음),',
		'"simple_mention"(이름·URL만 나열되거나 공식 정보 인용, 또는 추천 정황이 약함),',
		'"recommended"(1~2순위로 직접 지목되거나 전문 기관/공식 파트너/적극 추천 등 강한 긍정 수식).',
		'rank는 mentionType이 "recommended"이고 상위 2개 추천에 포함된 경우만 1/2, 그 외에는 null입니다.',
		'evidenceSnippet은 판정 근거를 한국어 한 문장으로 작성하세요. JSON 원문이나 코드 블록을 넣지 마세요.',
		'동일 업종 플레이스·브랜드만 1~3위 경쟁 비교군으로 인정하세요. 호텔·숙박·식당·카페·뷔페·쇼핑몰·일반 기업은 경쟁사에서 제외하세요.',
		'고유 장비·시술·시그니처 서비스 키워드가 있으면 일반 대형 브랜드 인지도만으로 순위를 매기지 말고, 타겟이 해당 항목을 공식 보유하면 1위로 반영하세요.',
		'반드시 순수 JSON 객체 하나만 응답하세요. 마크다운 코드 블록(```), 서두 설명, 후속 설명 등 다른 텍스트는 절대 포함하지 마세요.',
		`반환 형식(JSON): ${LIVE_JSON_SCHEMA}`,
	]
		.filter(Boolean)
		.join(' ');
}

/** Shared logical schema fields, expressed per-provider dialect below. */
const MENTION_TYPE_VALUES = ['none', 'simple_mention', 'recommended'] as const;
const REACH_LEVEL_VALUES = ['Level 1', 'Level 2', 'Level 3'] as const;

/** OpenAI Structured Outputs (`response_format: json_schema`, strict). */
const OPENAI_CITATION_SCHEMA = {
	type: 'json_schema' as const,
	json_schema: {
		name: 'citation_check',
		strict: true,
		schema: {
			type: 'object',
			properties: {
				isCited: { type: 'boolean' },
				mentionType: { type: 'string', enum: [...MENTION_TYPE_VALUES] },
				rank: { type: ['integer', 'null'], enum: [1, 2, 3, null] },
				evidenceSnippet: { type: 'string' },
				reachLevel: { type: 'string', enum: [...REACH_LEVEL_VALUES] },
				citationUrl: { type: 'string' },
			},
			required: ['isCited', 'mentionType', 'rank', 'evidenceSnippet', 'reachLevel', 'citationUrl'],
			additionalProperties: false,
		},
	},
};

/** Anthropic tool `input_schema` used to force structured output via `tool_choice`. */
const CLAUDE_CITATION_TOOL = {
	name: 'report_citation_check',
	description: '대상 상호/공식 사이트의 실시간 추천·인용 여부 판정 결과를 보고합니다.',
	input_schema: {
		type: 'object',
		properties: {
			isCited: { type: 'boolean', description: '대상이 실제로 추천/인용된 경우에만 true' },
			mentionType: { type: 'string', enum: [...MENTION_TYPE_VALUES] },
			rank: {
				anyOf: [{ type: 'integer', enum: [1, 2, 3] }, { type: 'null' }],
				description: 'mentionType이 recommended이고 상위 3개 추천에 포함된 경우만 1/2/3, 그 외 null',
			},
			evidenceSnippet: { type: 'string', description: '판정 근거 한국어 한 문장' },
			reachLevel: { type: 'string', enum: [...REACH_LEVEL_VALUES] },
			citationUrl: { type: 'string' },
		},
		required: ['isCited', 'mentionType', 'rank', 'evidenceSnippet', 'reachLevel', 'citationUrl'],
	},
};

export interface LiveCheckEngineInput {
	siteUrl: string;
	siteName: string;
	targetQuery: string;
	location?: string;
	category?: string;
	brandAliases?: readonly string[];
	productTokens?: readonly string[];
	ruleScores?: Partial<Record<LiveCheckEngineId, number>>;
}

function resolvedAliases(input: LiveCheckEngineInput): string[] {
	return (input.brandAliases ?? []).map((alias) => alias.trim()).filter((alias) => alias.length >= 2);
}

function contextLines(input: LiveCheckEngineInput): string[] {
	const aliases = resolvedAliases(input);
	const lines = [
		`질의: ${input.targetQuery}`,
		`대상 상호: ${input.siteName}`,
		`공식 사이트(targetUrl): ${input.siteUrl}`,
	];
	if (aliases.length) lines.push(`brandAliases: ${JSON.stringify(aliases)}`);
	if (input.location) lines.push(`지역: ${input.location}`);
	if (input.category) lines.push(`업종: ${input.category}`);
	if (input.category || input.location) {
		lines.push(
			buildSovIndustryPromptGuide(
				{
					categoryName: input.category,
					region: input.location,
					query: input.targetQuery,
				},
				input.targetQuery,
			),
		);
	}
	lines.push(
		buildSovNichePromptGuide({
			query: input.targetQuery,
			region: input.location,
			categoryName: input.category,
			productTokens: input.productTokens,
		}),
	);
	return lines;
}

function systemPromptFor(input: LiveCheckEngineInput): string {
	return liveJsonSystemPrompt(resolvedAliases(input), input.siteUrl);
}

function userPrompt(input: LiveCheckEngineInput): string {
	return [
		...contextLines(input),
		`위 질의에 대해 최신 추천 답변을 고려할 때, brandAliases 또는 ${input.siteName}(${input.siteUrl})이 실제로 언급/인용되는지 분석하세요.`,
		'3자 채널(네이버 블로그·지도·티스토리 등)이라도 대상 브랜드가 주체로 추천되면 isTargetMention=true 로 자사 SoV에 합산하세요.',
		`반드시 JSON으로만 응답해주세요. 형식: ${LIVE_JSON_SCHEMA}`,
	].join('\n');
}

/**
 * Plain search question. The target brand is not named, so the answer shows what the
 * engine recommends on its own. The brand is matched afterward in the text and citations.
 */
function searchQuestion(input: LiveCheckEngineInput): string {
	const localeHint = [input.location, input.category].filter(Boolean).join(' ');
	return `${input.targetQuery}${localeHint ? ` (${localeHint})` : ''}`;
}

const SEARCH_SYSTEM_PROMPT = 'You are a real-time web search assistant. Search the live web and return findings with citations.';

const ENGINE_LABEL: Record<LiveGroundedEngineId, string> = {
	chatgpt: 'ChatGPT',
	perplexity: 'Perplexity',
	gemini: 'Gemini',
	claude: 'Claude',
};

/** A classified live-call failure. The kind comes from the provider's own error fields. */
class LiveEngineFailure extends Error {
	constructor(
		message: string,
		readonly detail: LiveFailureDetail,
	) {
		super(message);
		this.name = 'LiveEngineFailure';
	}
}

function failureOfKind(engine: LiveGroundedEngineId, kind: LiveFailureKind, providerMessage?: string): LiveEngineFailure {
	return new LiveEngineFailure(describeFailure(ENGINE_LABEL[engine], kind, providerMessage), { kind });
}

function timeoutMessage(): string {
	return `실시간 조회가 ${Math.round(LIVE_CHECK_TIMEOUT_MS / 1000)}초를 초과했습니다.`;
}

/** Turns any thrown value into a classified failure result. Nothing here reads as "not exposed". */
function failedResult(engine: LiveGroundedEngineId, ruleScore: number, error: unknown): LiveEngineCheckResult {
	if (error instanceof LiveEngineFailure) return buildFailedLiveResult(engine, ruleScore, error.message, error.detail);
	const name = (error as { name?: string } | null)?.name;
	if (name === 'AbortError' || name === 'TimeoutError') {
		return buildFailedLiveResult(engine, ruleScore, `${ENGINE_LABEL[engine]}: ${timeoutMessage()}`, { kind: 'timeout' });
	}
	if (error instanceof LiveCheckParseError) {
		return buildFailedLiveResult(engine, ruleScore, describeFailure(ENGINE_LABEL[engine], 'parse_error', error.message), { kind: 'parse_error' });
	}
	const message = scrubSecrets(error instanceof Error ? error.message : '실시간 조회에 실패했습니다.');
	const network = error instanceof TypeError && /fetch failed|network|ECONN|ENOTFOUND|EAI_AGAIN/i.test(`${message} ${(error as { cause?: { code?: string } }).cause?.code ?? ''}`);
	return buildFailedLiveResult(engine, ruleScore, describeFailure(ENGINE_LABEL[engine], network ? 'network' : 'unknown', message), {
		kind: network ? 'network' : 'unknown',
	});
}

interface JsonResponse {
	ok: boolean;
	status: number;
	data: Record<string, unknown>;
	requestId?: string;
	latencyMs: number;
}

function requestIdFrom(headers: Headers): string | undefined {
	const id = headers.get('x-request-id') || headers.get('request-id') || headers.get('x-goog-request-id');
	if (id) return id;
	const ray = headers.get('cf-ray');
	return ray ? `cf-ray:${ray}` : undefined;
}

async function fetchJson(url: string, init: RequestInit, signal: AbortSignal): Promise<JsonResponse> {
	const startedAt = Date.now();
	const res = await fetch(url, { ...init, signal });
	const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	return { ok: res.ok, status: res.status, data, requestId: requestIdFrom(res.headers), latencyMs: Date.now() - startedAt };
}

/** Classifies a non-2xx provider response and logs it with the trace fields. Never logs keys. */
function providerFailure(
	engine: LiveGroundedEngineId,
	logPrefix: string,
	response: JsonResponse,
	model: string,
): LiveEngineFailure {
	const info = extractProviderError(response.status, response.data, `${ENGINE_LABEL[engine]} HTTP ${response.status}`);
	const kind = classifyProviderError(info);
	console.error(logPrefix, {
		model,
		httpStatus: response.status,
		kind,
		providerType: info.type,
		providerCode: info.code,
		providerStatus: info.providerStatus,
		message: info.message.slice(0, 300),
		requestId: response.requestId,
		latencyMs: response.latencyMs,
	});
	return new LiveEngineFailure(describeFailure(ENGINE_LABEL[engine], kind, info.message), {
		kind,
		httpStatus: response.status,
		providerCode: info.code ?? info.type ?? info.providerStatus,
		requestId: response.requestId,
	});
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function isHttpUrl(value: unknown): value is string {
	return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function uniqueUrls(values: readonly unknown[]): string[] {
	return [...new Set(values.filter(isHttpUrl))];
}

function urlFromItem(item: unknown): string | undefined {
	if (isHttpUrl(item)) return item;
	const row = asRecord(item);
	const url = row?.url ?? row?.uri;
	return isHttpUrl(url) ? url : undefined;
}

/** A normalized provider answer: the text, the URLs it cites, every retrieved URL, and search proof. */
interface Extracted {
	text: string;
	answerUrls: string[];
	resultUrls: string[];
	search: SearchEvidence;
	/** Why the text is empty, when the provider says so (safety block, token limit). */
	emptyReason?: string;
}

function extractOpenAI(data: Record<string, unknown>): Extracted {
	const chunks: string[] = [];
	const citedUrls: unknown[] = [];
	let searchCalls = 0;
	if (typeof data.output_text === 'string') chunks.push(data.output_text);
	for (const item of Array.isArray(data.output) ? data.output : []) {
		const rec = asRecord(item);
		if (rec?.type === 'web_search_call') searchCalls += 1;
		for (const part of Array.isArray(rec?.content) ? (rec?.content as unknown[]) : []) {
			const block = asRecord(part);
			if (typeof block?.text === 'string') chunks.push(block.text);
			for (const note of Array.isArray(block?.annotations) ? (block?.annotations as unknown[]) : []) {
				const ann = asRecord(note);
				if (ann?.type === 'url_citation') citedUrls.push(ann.url ?? asRecord(ann.url_citation)?.url);
			}
		}
	}
	const message = asRecord(asRecord((Array.isArray(data.choices) ? data.choices : [])[0])?.message);
	if (typeof message?.content === 'string') chunks.push(message.content);
	for (const note of Array.isArray(message?.annotations) ? (message?.annotations as unknown[]) : []) {
		const ann = asRecord(note);
		if (ann?.type === 'url_citation') citedUrls.push(asRecord(ann.url_citation)?.url ?? ann.url);
	}
	const answerUrls = uniqueUrls(citedUrls);
	return {
		text: chunks.join('\n').trim(),
		answerUrls,
		resultUrls: answerUrls,
		search: { performed: searchCalls > 0 || answerUrls.length > 0, sourceCount: answerUrls.length },
	};
}

/**
 * Claude text extractor. When the model was forced to call the `report_citation_check`
 * tool, its `input` is already a parsed JSON object, so it is serialized back to text for
 * the same `parseLiveCheckPayload` pipeline. Search proof is a `server_tool_use` or
 * `web_search_tool_result` block, which this request does not enable.
 */
function extractClaude(data: Record<string, unknown>): Extracted {
	const chunks: string[] = [];
	const answerUrls: unknown[] = [];
	const resultUrls: unknown[] = [];
	let searchBlocks = 0;
	for (const part of Array.isArray(data.content) ? data.content : []) {
		const block = asRecord(part);
		if (block?.type === 'tool_use' && block.name === CLAUDE_CITATION_TOOL.name && block.input) {
			chunks.push(JSON.stringify(block.input));
		} else if (block?.type === 'text' && typeof block.text === 'string') {
			chunks.push(block.text);
			for (const cite of Array.isArray(block.citations) ? (block.citations as unknown[]) : []) answerUrls.push(urlFromItem(cite));
		} else if (block?.type === 'server_tool_use') {
			searchBlocks += 1;
		} else if (block?.type === 'web_search_tool_result') {
			searchBlocks += 1;
			for (const hit of Array.isArray(block.content) ? (block.content as unknown[]) : []) resultUrls.push(urlFromItem(hit));
		}
	}
	const answer = uniqueUrls(answerUrls);
	const results = uniqueUrls([...resultUrls, ...answerUrls]);
	return {
		text: chunks.join('\n').trim(),
		answerUrls: answer,
		resultUrls: results,
		search: { performed: searchBlocks > 0, sourceCount: results.length },
	};
}

function looksLikeHostname(value: unknown): value is string {
	return typeof value === 'string' && /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(value.trim());
}

/**
 * Gemini grounding. `groundingChunks[].web.uri` is often a redirect link, and `web.title`
 * is the source's domain, so a hostname title is used for domain matching. A chunk counts
 * as used by the answer only when a `groundingSupports` entry points at it.
 */
function extractGemini(data: Record<string, unknown>): Extracted {
	const candidate = asRecord((Array.isArray(data.candidates) ? data.candidates : [])[0]);
	const parts = asRecord(candidate?.content)?.parts;
	const text = (Array.isArray(parts) ? parts : [])
		.map((part) => (typeof asRecord(part)?.text === 'string' ? (asRecord(part)?.text as string) : ''))
		.join('\n')
		.trim();
	const grounding = asRecord(candidate?.groundingMetadata);
	const chunks = Array.isArray(grounding?.groundingChunks) ? (grounding?.groundingChunks as unknown[]) : [];
	const chunkUrls = chunks.map((chunk) => {
		const web = asRecord(asRecord(chunk)?.web);
		if (looksLikeHostname(web?.title)) return `https://${(web?.title as string).trim()}`;
		return isHttpUrl(web?.uri) ? web.uri : undefined;
	});
	const supports = Array.isArray(grounding?.groundingSupports) ? (grounding?.groundingSupports as unknown[]) : [];
	const usedIndexes = new Set<number>();
	for (const support of supports) {
		const indexes = asRecord(support)?.groundingChunkIndices;
		for (const index of Array.isArray(indexes) ? indexes : []) if (typeof index === 'number') usedIndexes.add(index);
	}
	const queries = Array.isArray(grounding?.webSearchQueries) ? (grounding?.webSearchQueries as unknown[]) : [];
	const resultUrls = uniqueUrls(chunkUrls);
	const answerUrls = uniqueUrls([...usedIndexes].map((index) => chunkUrls[index]));
	const finish = typeof candidate?.finishReason === 'string' ? candidate.finishReason : '';
	const block = typeof asRecord(data.promptFeedback)?.blockReason === 'string' ? (asRecord(data.promptFeedback)?.blockReason as string) : '';
	return {
		text,
		answerUrls,
		resultUrls,
		search: { performed: queries.length > 0 || resultUrls.length > 0, sourceCount: resultUrls.length },
		emptyReason: block ? `blockReason=${block}` : finish && finish !== 'STOP' ? `finishReason=${finish}` : undefined,
	};
}

/** Sonar answer. `citations` are the sources the answer cites, `search_results` are all retrieved results. */
function extractPerplexity(data: Record<string, unknown>): Extracted {
	const choices = data.choices as Array<{ message?: { content?: unknown } }> | undefined;
	const content = choices?.[0]?.message?.content;
	const text = typeof content === 'string' ? content.trim() : '';
	const citations = uniqueUrls((Array.isArray(data.citations) ? data.citations : []).map(urlFromItem));
	const searchResults = uniqueUrls((Array.isArray(data.search_results) ? data.search_results : []).map(urlFromItem));
	const resultUrls = uniqueUrls([...searchResults, ...citations]);
	return {
		text,
		answerUrls: citations,
		resultUrls,
		search: { performed: resultUrls.length > 0, sourceCount: resultUrls.length },
	};
}

/**
 * Search engines stay live when the body is prose plus citations. ChatGPT and Claude still
 * require the structured judge payload, and without search evidence they are never graded.
 */
function toLiveResult(
	engine: LiveGroundedEngineId,
	extracted: Extracted,
	input: LiveCheckEngineInput,
	ruleScore: number,
): LiveEngineCheckResult {
	const searchEngine = engine === 'gemini' || engine === 'perplexity';
	const aliases = input.brandAliases ?? [];
	// ChatGPT and Claude have no citations array. Their answer text is still scanned for the
	// brand and official domain, so a JSON parse failure must not turn a real answer into an error.
	let parsed: ReturnType<typeof groundingObservationFromSearch>;
	if (searchEngine || extracted.search.performed) {
		parsed = searchEngine
			? groundingObservationFromSearch(extracted.text, input.siteName, input.siteUrl, extracted.answerUrls, aliases)
			: parseLiveCheckPayload(extracted.text, input.siteName, input.siteUrl, extracted.answerUrls, aliases);
	} else {
		try {
			parsed = parseLiveCheckPayload(extracted.text, input.siteName, input.siteUrl, extracted.answerUrls, aliases);
		} catch {
			parsed = { isCited: false, mentionType: 'none', rank: null, evidenceSnippet: '' };
		}
	}
	return buildLiveEngineResult(engine, parsed, ruleScore, {
		rawResponseText: extracted.text,
		targetBrand: input.siteName,
		targetDomain: input.siteUrl,
		citationCandidates: extracted.answerUrls,
		resultUrls: extracted.resultUrls,
		search: extracted.search,
		brandAliases: input.brandAliases,
	});
}

function emptyBodyFailure(engine: LiveGroundedEngineId, logPrefix: string, model: string, data: Record<string, unknown>, reason?: string): LiveEngineFailure {
	console.error(logPrefix, { model, emptyBody: true, reason, responseKeys: Object.keys(data).slice(0, 12) });
	return failureOfKind(engine, 'empty_body', reason);
}

async function runOpenAI(input: LiveCheckEngineInput, signal: AbortSignal): Promise<LiveEngineCheckResult> {
	const engine: LiveGroundedEngineId = 'chatgpt';
	if (isMockEnabled('MOCK_OPENAI')) return mockResult(engine, input);
	const ruleScore = ruleScoreFor(engine, input.ruleScores);
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) return failedResult(engine, ruleScore, failureOfKind(engine, 'missing_key', 'OPENAI_API_KEY'));

	const prefix = '[OpenAI Live Check Error]:';
	console.info('[OpenAI Live Check] request', {
		model: 'gpt-4o-mini',
		query: input.targetQuery,
		siteName: input.siteName,
	});

	try {
		const response = await fetchJson(
			OPENAI_CHAT_URL,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: 'gpt-4o-mini',
					messages: [
						{
							role: 'system',
							content: `${systemPromptFor(input)} 대상 업체('${input.siteName}', URL: ${input.siteUrl})가 추천/인용될 수 있는지 분석하여 반드시 JSON 포맷으로만 응답하세요.`,
						},
						{
							role: 'user',
							content: [
								`키워드: "${input.targetQuery}"`,
								`대상 브랜드: "${input.siteName}" (${input.siteUrl})`,
								'위 키워드에 대해 AI 검색 추천 시 대상 브랜드가 인용/언급되는지 판별하고 JSON으로 응답해주세요.',
								userPrompt(input),
							].join('\n'),
						},
					],
					temperature: 0.1,
					max_tokens: 400,
					response_format: OPENAI_CITATION_SCHEMA,
				}),
			},
			signal,
		);

		console.info('[OpenAI Live Check] response', {
			status: response.status,
			ok: response.ok,
			latencyMs: response.latencyMs,
			requestId: response.requestId,
		});
		if (!response.ok) throw providerFailure(engine, prefix, response, 'gpt-4o-mini');

		const extracted = extractOpenAI(response.data);
		if (!extracted.text) throw emptyBodyFailure(engine, prefix, 'gpt-4o-mini', response.data);
		console.log('[ChatGPT Raw Content]:', scrubSecrets(extracted.text).slice(0, 4000));
		return toLiveResult(engine, extracted, input, ruleScore);
	} catch (err) {
		if (!(err instanceof LiveEngineFailure)) console.error(prefix, err);
		return failedResult(engine, ruleScore, err);
	}
}

async function runClaude(input: LiveCheckEngineInput, signal: AbortSignal): Promise<LiveEngineCheckResult> {
	const engine: LiveGroundedEngineId = 'claude';
	if (isMockEnabled('MOCK_CLAUDE')) return mockResult(engine, input);
	const ruleScore = ruleScoreFor(engine, input.ruleScores);
	const apiKey = envString('ANTHROPIC_API_KEY');
	if (!apiKey) return failedResult(engine, ruleScore, failureOfKind(engine, 'missing_key', 'ANTHROPIC_API_KEY'));

	const prefix = '[Claude Live Check Error]:';
	const models = resolveAnthropicModels();
	console.info('[Claude Live Check] request', {
		models,
		query: input.targetQuery,
		siteName: input.siteName,
	});

	try {
		let lastFailure: LiveEngineFailure = failureOfKind(engine, 'unknown');
		for (const model of models) {
			const response = await fetchJson(
				ANTHROPIC_URL,
				{
					method: 'POST',
					headers: {
						'x-api-key': apiKey,
						'anthropic-version': '2023-06-01',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						model,
						max_tokens: 400,
						temperature: 0.1,
						system: systemPromptFor(input),
						messages: [
							{
								role: 'user',
								content: [
									`질의: "${input.targetQuery}"`,
									`대상 업체: "${input.siteName}" (${input.siteUrl})`,
									resolvedAliases(input).length ? `brandAliases: ${JSON.stringify(resolvedAliases(input))}` : '',
									input.location ? `지역: ${input.location}` : '',
									input.category ? `업종: ${input.category}` : '',
									'',
									'위 질의에 대한 최신 추천 답변을 고려하여 report_citation_check 도구로 판정 결과를 보고하세요.',
								]
									.filter(Boolean)
									.join('\n'),
							},
						],
						tools: [CLAUDE_CITATION_TOOL],
						tool_choice: { type: 'tool', name: CLAUDE_CITATION_TOOL.name },
					}),
				},
				signal,
			);

			console.info('[Claude Live Check] response', {
				model,
				status: response.status,
				ok: response.ok,
				latencyMs: response.latencyMs,
				requestId: response.requestId,
			});
			if (!response.ok) {
				lastFailure = providerFailure(engine, prefix, response, model);
				if (lastFailure.detail.kind === 'model_unavailable') continue;
				throw lastFailure;
			}

			const extracted = extractClaude(response.data);
			if (!extracted.text) {
				lastFailure = emptyBodyFailure(engine, prefix, model, response.data);
				continue;
			}
			console.log('[Claude Raw Content]:', scrubSecrets(extracted.text).slice(0, 4000));
			return toLiveResult(engine, extracted, input, ruleScore);
		}

		throw lastFailure;
	} catch (err) {
		if (!(err instanceof LiveEngineFailure)) console.error(prefix, err);
		return failedResult(engine, ruleScore, err);
	}
}

async function runGemini(input: LiveCheckEngineInput, signal: AbortSignal): Promise<LiveEngineCheckResult> {
	const engine: LiveGroundedEngineId = 'gemini';
	if (isMockEnabled('MOCK_GEMINI')) return mockResult(engine, input);
	const ruleScore = ruleScoreFor(engine, input.ruleScores);
	const geminiKeyName = envString('GEMINI_API_KEY')
		? 'GEMINI_API_KEY'
		: envString('GOOGLE_GENERATIVE_AI_API_KEY')
			? 'GOOGLE_GENERATIVE_AI_API_KEY'
			: envString('GOOGLE_API_KEY')
				? 'GOOGLE_API_KEY'
				: envString('GOOGLE_AI_API_KEY')
					? 'GOOGLE_AI_API_KEY'
					: '';
	const prefix = '[Gemini Error Detail]:';
	const apiKey = geminiKeyName ? envString(geminiKeyName) : '';
	if (!apiKey) {
		const failure = failureOfKind(engine, 'missing_key', 'GEMINI_API_KEY');
		console.error(prefix, failure.message);
		return failedResult(engine, ruleScore, failure);
	}

	const models = resolveGeminiModels();
	console.info('[Gemini Live Check] request', {
		key: geminiKeyName,
		models,
		grounding: true,
		query: input.targetQuery,
		siteName: input.siteName,
	});

	try {
		let lastFailure: LiveEngineFailure = failureOfKind(engine, 'unknown');
		for (const model of models) {
			const response = await fetchJson(
				geminiGenerateUrl(model),
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
					body: JSON.stringify({
						systemInstruction: { parts: [{ text: SEARCH_SYSTEM_PROMPT }] },
						contents: [{ role: 'user', parts: [{ text: searchQuestion(input) }] }],
						tools: [{ google_search: {} }],
						generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
					}),
				},
				signal,
			);

			console.info('[Gemini Live Check] response', {
				model,
				grounding: true,
				status: response.status,
				ok: response.ok,
				latencyMs: response.latencyMs,
				requestId: response.requestId,
			});
			if (!response.ok) {
				lastFailure = providerFailure(engine, prefix, response, model);
				// Credit, quota, rate-limit, and key errors apply to every model, so stop instead of burning the 15s budget.
				if (stopsModelFallback(lastFailure.detail.kind)) break;
				continue;
			}

			const extracted = extractGemini(response.data);
			if (!extracted.text) {
				lastFailure = emptyBodyFailure(engine, prefix, model, response.data, extracted.emptyReason);
				continue;
			}
			return toLiveResult(engine, extracted, input, ruleScore);
		}

		throw lastFailure;
	} catch (err) {
		if (!(err instanceof LiveEngineFailure)) console.error(prefix, err);
		return failedResult(engine, ruleScore, err);
	}
}

async function runPerplexity(input: LiveCheckEngineInput, signal: AbortSignal): Promise<LiveEngineCheckResult> {
	const engine: LiveGroundedEngineId = 'perplexity';
	if (isMockEnabled('MOCK_PERPLEXITY')) return mockResult(engine, input);
	const ruleScore = ruleScoreFor(engine, input.ruleScores);
	const perplexityKeyName = envString('PERPLEXITY_API_KEY') ? 'PERPLEXITY_API_KEY' : envString('PPLX_API_KEY') ? 'PPLX_API_KEY' : '';
	const prefix = '[Perplexity Error Detail]:';
	const apiKey = perplexityKeyName ? envString(perplexityKeyName) : '';
	if (!apiKey) {
		const failure = failureOfKind(engine, 'missing_key', 'PERPLEXITY_API_KEY / PPLX_API_KEY');
		console.error(prefix, failure.message);
		return failedResult(engine, ruleScore, failure);
	}

	const models = resolvePerplexityModels();
	console.info('[Perplexity Live Check] request', {
		key: perplexityKeyName,
		models,
		query: input.targetQuery,
		siteName: input.siteName,
		location: input.location,
		category: input.category,
	});

	try {
		let lastFailure: LiveEngineFailure = failureOfKind(engine, 'unknown');
		for (const model of models) {
			const response = await fetchJson(
				PERPLEXITY_URL,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						model,
						temperature: 0.1,
						max_tokens: 1200,
						messages: [
							{ role: 'system', content: SEARCH_SYSTEM_PROMPT },
							{ role: 'user', content: searchQuestion(input) },
						],
					}),
				},
				signal,
			);

			console.info('[Perplexity Live Check] response', {
				model,
				status: response.status,
				ok: response.ok,
				latencyMs: response.latencyMs,
				requestId: response.requestId,
			});
			if (!response.ok) {
				lastFailure = providerFailure(engine, prefix, response, model);
				if (stopsModelFallback(lastFailure.detail.kind)) break;
				continue;
			}

			const extracted = extractPerplexity(response.data);
			if (!extracted.text) {
				lastFailure = emptyBodyFailure(engine, prefix, model, response.data);
				continue;
			}
			return toLiveResult(engine, extracted, input, ruleScore);
		}

		throw lastFailure;
	} catch (err) {
		if (!(err instanceof LiveEngineFailure)) console.error(prefix, err);
		return failedResult(engine, ruleScore, err);
	}
}

const RUNNERS: Record<LiveGroundedEngineId, (input: LiveCheckEngineInput, signal: AbortSignal) => Promise<LiveEngineCheckResult>> = {
	gemini: runGemini,
	chatgpt: runOpenAI,
	perplexity: runPerplexity,
	claude: runClaude,
};

async function runWithTimeout(
	engine: LiveGroundedEngineId,
	input: LiveCheckEngineInput,
): Promise<LiveEngineCheckResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), LIVE_CHECK_TIMEOUT_MS);
	try {
		const result = await RUNNERS[engine](input, controller.signal);
		return { ...result, checkedAt: new Date().toISOString() };
	} catch (error) {
		return { ...failedResult(engine, ruleScoreFor(engine, input.ruleScores), error), checkedAt: new Date().toISOString() };
	} finally {
		clearTimeout(timer);
	}
}

export async function runLiveEngineChecks(input: LiveCheckEngineInput): Promise<LiveEngineCheckResult[]> {
	const mockFlags = liveCheckMockFlags();
	console.info('[Live Check] start', {
		query: input.targetQuery,
		siteName: input.siteName,
		siteUrl: input.siteUrl,
		location: input.location,
		category: input.category,
		engines: LIVE_GROUNDED_ENGINE_IDS,
		mock: mockFlags,
	});
	const settled = await Promise.allSettled(LIVE_GROUNDED_ENGINE_IDS.map((engine) => runWithTimeout(engine, input)));
	const results = settled.map((item, index) => {
		const engine = LIVE_GROUNDED_ENGINE_IDS[index];
		if (item.status === 'fulfilled') return item.value;
		console.error(`[${engine} Live Check Error]:`, item.reason);
		return failedResult(engine, ruleScoreFor(engine, input.ruleScores), item.reason);
	});
	console.info(
		'[Live Check] done',
		results.map((item) => ({
			engine: item.engine,
			observation: item.observation,
			statusDetail: item.statusDetail,
			failureKind: item.failureKind,
			httpStatus: item.httpStatus,
			isLive: item.isLive,
			searchEvidence: item.searchEvidence,
			isLiveGrounded: item.isLiveGrounded,
			isCited: item.isCited,
			liveScore: item.liveScore,
		})),
	);
	return results;
}
