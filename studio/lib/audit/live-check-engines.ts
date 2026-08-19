import {
	LIVE_CHECK_TIMEOUT_MS,
	buildFailedLiveResult,
	buildLiveEngineResult,
	extractJsonFromText,
	parseLiveCheckPayload,
	ruleScoreFor,
} from '@/lib/audit/live-check-score';
import {
	LIVE_GROUNDED_ENGINE_IDS,
	type LiveCheckEngineId,
	type LiveEngineCheckResult,
	type LiveGroundedEngineId,
	type MentionType,
} from '@/types/live-engine-check';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash-lite'] as const;
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_FALLBACK_MODELS = ['claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'] as const;

function envString(name: string): string {
	return (process.env[name] || '').trim().replace(/^["']|["']$/g, '');
}

function isEnvTrue(name: string): boolean {
	return envString(name).toLowerCase() === 'true';
}

function liveCheckMockFlags(): Record<LiveGroundedEngineId, boolean> {
	return {
		chatgpt: isEnvTrue('MOCK_OPENAI'),
		gemini: isEnvTrue('MOCK_GEMINI'),
		perplexity: isEnvTrue('MOCK_PERPLEXITY'),
		claude: isEnvTrue('MOCK_CLAUDE'),
	};
}

function buildMockLiveResult(
	engine: LiveGroundedEngineId,
	input: LiveCheckEngineInput,
	preset: {
		isCited: boolean;
		mentionType: MentionType;
		citedRank: 1 | 2 | 3 | null;
		evidenceSnippet: string;
		citationUrl?: string;
	},
): LiveEngineCheckResult {
	console.info(`[${engine} Live Check] mock (0원 가상 데이터)`, { engine });
	return buildLiveEngineResult(
		engine,
		{
			isCited: preset.isCited,
			mentionType: preset.mentionType,
			rank: preset.citedRank,
			evidenceSnippet: preset.evidenceSnippet,
			citationUrl: preset.citationUrl,
		},
		ruleScoreFor(engine, input.ruleScores),
		{
			rawResponseText: preset.evidenceSnippet,
			targetBrand: input.siteName,
			targetDomain: input.siteUrl,
		},
	);
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

function isModelUnavailable(status: number, message: string): boolean {
	if (status === 404) return true;
	const hay = message.toLowerCase();
	return (
		hay.includes('not_found_error') ||
		hay.includes('not found') ||
		hay.includes('does not exist') ||
		hay.includes('invalid model') ||
		hay.includes('unsupported') ||
		hay.includes('no longer available')
	);
}

function geminiGenerateUrl(model: string): string {
	return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

/** Human-readable schema shown inline in prompts (Perplexity + fallback text instructions). */
const LIVE_JSON_SCHEMA =
	'{"isCited":boolean,"mentionType":"none"|"simple_mention"|"recommended","rank":1|2|3|null,"evidenceSnippet":"한 줄 판정 요약(한국어)","reachLevel":"Level 1"|"Level 2"|"Level 3","citationUrl":"url or empty"}';

const LIVE_JSON_SYSTEM_PROMPT = [
	'당신은 실시간 AI 검색 추천 분석기(LLM-as-a-Judge)입니다.',
	'질의에 답할 때 대상 상호/공식 사이트가 답변 본문에 실제로 추천·인용되었는지 문맥과 감성까지 판별하세요.',
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
	'반드시 순수 JSON 객체 하나만 응답하세요. 마크다운 코드 블록(```), 서두 설명, 후속 설명 등 다른 텍스트는 절대 포함하지 마세요.',
	`반환 형식(JSON): ${LIVE_JSON_SCHEMA}`,
].join(' ');

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

/** Gemini `generationConfig.responseSchema` (classic generateContent OpenAPI-subset dialect). */
const GEMINI_CITATION_SCHEMA = {
	type: 'OBJECT',
	properties: {
		isCited: { type: 'BOOLEAN' },
		mentionType: { type: 'STRING', enum: [...MENTION_TYPE_VALUES] },
		rank: { type: 'INTEGER', nullable: true },
		evidenceSnippet: { type: 'STRING' },
		reachLevel: { type: 'STRING', enum: [...REACH_LEVEL_VALUES] },
		citationUrl: { type: 'STRING' },
	},
	required: ['isCited', 'mentionType', 'evidenceSnippet'],
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

/** Perplexity Structured Outputs (`response_format: json_schema`, all fields required per Perplexity constraints). */
const PERPLEXITY_CITATION_SCHEMA = {
	type: 'json_schema' as const,
	json_schema: {
		name: 'citation_check',
		schema: {
			type: 'object',
			properties: {
				isCited: { type: 'boolean' },
				mentionType: { type: 'string', enum: [...MENTION_TYPE_VALUES] },
				rank: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
				evidenceSnippet: { type: 'string' },
				reachLevel: { type: 'string', enum: [...REACH_LEVEL_VALUES] },
				citationUrl: { type: 'string' },
			},
			required: ['isCited', 'mentionType', 'rank', 'evidenceSnippet', 'reachLevel', 'citationUrl'],
			additionalProperties: false,
		},
	},
};

export interface LiveCheckEngineInput {
	siteUrl: string;
	siteName: string;
	targetQuery: string;
	location?: string;
	category?: string;
	ruleScores?: Partial<Record<LiveCheckEngineId, number>>;
}

function contextLines(input: LiveCheckEngineInput): string[] {
	const lines = [
		`질의: ${input.targetQuery}`,
		`대상 상호: ${input.siteName}`,
		`공식 사이트: ${input.siteUrl}`,
	];
	if (input.location) lines.push(`지역: ${input.location}`);
	if (input.category) lines.push(`업종: ${input.category}`);
	return lines;
}

function userPrompt(input: LiveCheckEngineInput): string {
	return [
		...contextLines(input),
		`위 질의에 대해 최신 추천 답변을 고려할 때, ${input.siteName}(${input.siteUrl})이 실제로 언급/인용되는지 분석하세요.`,
		`반드시 JSON으로만 응답해주세요. 형식: ${LIVE_JSON_SCHEMA}`,
	].join('\n');
}

function perplexityUserPrompt(input: LiveCheckEngineInput): string {
	const localeHint = [input.location, input.category].filter(Boolean).join(' ');
	return [
		...contextLines(input),
		`${input.targetQuery}${localeHint ? ` (${localeHint})` : ''} 관련하여 국내 로컬 검색 기준으로 추천해 주세요.`,
		`반드시 ${input.siteName}(${input.siteUrl})의 공식 웹사이트·네이버/구글 로컬 결과를 우선 확인하고,`,
		'Reddit 등 해외 커뮤니티나 무관한 해외 사이트를 인용하지 마세요.',
		`대상 사이트가 답변에 추천/인용되었는지 다음 JSON으로만 답하세요: ${LIVE_JSON_SCHEMA}`,
	].join('\n');
}

function timeoutError(error: unknown): string {
	if ((error as { name?: string })?.name === 'AbortError') {
		return '실시간 조회가 12초를 초과했습니다.';
	}
	return error instanceof Error ? error.message : '실시간 조회에 실패했습니다.';
}

async function fetchJson(
	url: string,
	init: RequestInit,
	signal: AbortSignal,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
	const res = await fetch(url, { ...init, signal });
	const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
	return { ok: res.ok, status: res.status, data };
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function collectUrls(value: unknown, into: string[] = []): string[] {
	if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
		into.push(value);
		return into;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectUrls(item, into);
		return into;
	}
	const rec = asRecord(value);
	if (!rec) return into;
	for (const [key, nested] of Object.entries(rec)) {
		if (key === 'url' || key === 'uri' || key === 'href' || key === 'citationUrl') {
			if (typeof nested === 'string' && /^https?:\/\//i.test(nested)) into.push(nested);
		} else {
			collectUrls(nested, into);
		}
	}
	return into;
}

function extractOpenAIText(data: Record<string, unknown>): { text: string; urls: string[] } {
	const chunks: string[] = [];
	if (typeof data.output_text === 'string') chunks.push(data.output_text);
	const output = Array.isArray(data.output) ? data.output : [];
	for (const item of output) {
		const rec = asRecord(item);
		const content = Array.isArray(rec?.content) ? rec.content : [];
		for (const part of content) {
			const block = asRecord(part);
			if (typeof block?.text === 'string') chunks.push(block.text);
		}
	}
	const choices = Array.isArray(data.choices) ? data.choices : [];
	const message = asRecord(asRecord(choices[0])?.message);
	if (typeof message?.content === 'string') chunks.push(message.content);
	return { text: chunks.join('\n').trim(), urls: collectUrls(data) };
}

/**
 * Claude text extractor. When the model was forced to call the
 * `report_citation_check` tool, its `input` is already a parsed JSON object
 * (no markdown fences, no preamble possible) — serialize it back to text so
 * it flows through the same `parseLiveCheckPayload` pipeline as other engines.
 * Falls back to plain text blocks for models/responses that didn't use the tool.
 */
function extractClaudeText(data: Record<string, unknown>): { text: string; urls: string[] } {
	const chunks: string[] = [];
	const content = Array.isArray(data.content) ? data.content : [];
	for (const part of content) {
		const block = asRecord(part);
		if (block?.type === 'tool_use' && block.name === CLAUDE_CITATION_TOOL.name && block.input) {
			chunks.push(JSON.stringify(block.input));
		} else if (block?.type === 'text' && typeof block.text === 'string') {
			chunks.push(block.text);
		}
	}
	return { text: chunks.join('\n').trim(), urls: collectUrls(data) };
}

function extractGeminiText(data: Record<string, unknown>): { text: string; urls: string[] } {
	const chunks: string[] = [];
	const candidates = Array.isArray(data.candidates) ? data.candidates : [];
	for (const candidate of candidates) {
		const rec = asRecord(candidate);
		const parts = Array.isArray(asRecord(rec?.content)?.parts) ? (asRecord(rec?.content)?.parts as unknown[]) : [];
		for (const part of parts) {
			const block = asRecord(part);
			if (typeof block?.text === 'string') chunks.push(block.text);
		}
	}
	return { text: chunks.join('\n').trim(), urls: collectUrls(data) };
}

function extractPerplexityText(data: Record<string, unknown>): { text: string; urls: string[] } {
	const choices = Array.isArray(data.choices) ? data.choices : [];
	const first = asRecord(choices[0]);
	const message = asRecord(first?.message);
	const text = typeof message?.content === 'string' ? message.content : '';
	const citations = Array.isArray(data.citations) ? data.citations.filter((item): item is string => typeof item === 'string') : [];
	return { text: text.trim(), urls: [...citations, ...collectUrls(data)] };
}

function apiErrorMessage(data: Record<string, unknown>, fallback: string): string {
	const error = asRecord(data.error);
	if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
	if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
	return fallback;
}

/**
 * Parses the engine's raw text into a live-check result. Any parse failure
 * (including `LiveCheckParseError` when no JSON at all could be recovered)
 * propagates to the caller's try/catch, which correctly reports a FAILED
 * result (fallback to rule score) instead of a false "not cited" verdict.
 */
function toLiveResult(
	engine: LiveGroundedEngineId,
	text: string,
	urls: string[],
	input: LiveCheckEngineInput,
	ruleScore: number,
): LiveEngineCheckResult {
	return buildLiveEngineResult(engine, parseLiveCheckPayload(text, input.siteName, input.siteUrl, urls), ruleScore, {
		rawResponseText: text,
		targetBrand: input.siteName,
		targetDomain: input.siteUrl,
		citationCandidates: urls,
	});
}

async function runOpenAI(input: LiveCheckEngineInput, signal: AbortSignal): Promise<LiveEngineCheckResult> {
	const engine: LiveGroundedEngineId = 'chatgpt';
	if (isEnvTrue('MOCK_OPENAI')) {
		return buildMockLiveResult(engine, input, {
			isCited: false,
			mentionType: 'none',
			citedRank: null,
			evidenceSnippet: `[테스트 Mock] ${input.siteName}이 언급되지 않았습니다.`,
		});
	}
	const ruleScore = ruleScoreFor(engine, input.ruleScores);
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) return buildFailedLiveResult(engine, ruleScore, 'OPENAI_API_KEY가 .env에 설정되지 않았습니다.');

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
							content: `${LIVE_JSON_SYSTEM_PROMPT} 대상 업체('${input.siteName}', URL: ${input.siteUrl})가 추천/인용될 수 있는지 분석하여 반드시 JSON 포맷으로만 응답하세요.`,
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

		console.info('[OpenAI Live Check] response', { status: response.status, ok: response.ok });
		if (!response.ok) {
			throw new Error(apiErrorMessage(response.data, `OpenAI HTTP ${response.status}`));
		}

		const extracted = extractOpenAIText(response.data);
		if (!extracted.text) throw new Error('OpenAI가 빈 응답을 반환했습니다.');
		return toLiveResult(engine, extracted.text, extracted.urls, input, ruleScore);
	} catch (err) {
		console.error('[OpenAI Live Check Error]:', err);
		return buildFailedLiveResult(engine, ruleScore, timeoutError(err));
	}
}

async function runClaude(input: LiveCheckEngineInput, signal: AbortSignal): Promise<LiveEngineCheckResult> {
	const engine: LiveGroundedEngineId = 'claude';
	if (isEnvTrue('MOCK_CLAUDE')) {
		return buildMockLiveResult(engine, input, {
			isCited: false,
			mentionType: 'none',
			citedRank: null,
			evidenceSnippet: `[테스트 Mock] ${input.siteName}이 언급되지 않았습니다.`,
		});
	}
	const ruleScore = ruleScoreFor(engine, input.ruleScores);
	const apiKey = envString('ANTHROPIC_API_KEY');
	if (!apiKey) return buildFailedLiveResult(engine, ruleScore, 'ANTHROPIC_API_KEY가 .env에 설정되지 않았습니다.');

	const models = resolveAnthropicModels();
	console.info('[Claude Live Check] request', {
		models,
		query: input.targetQuery,
		siteName: input.siteName,
	});

	try {
		let lastError = 'Anthropic HTTP error';
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
						system:
							'당신은 AI 검색 인용 분석기(LLM-as-a-Judge)입니다. 대상이 부정문("언급되지 않음", "정보 없음" 등)으로 언급된 경우 실제 추천으로 취급하지 마세요.',
						messages: [
							{
								role: 'user',
								content: [
									`질의: "${input.targetQuery}"`,
									`대상 업체: "${input.siteName}" (${input.siteUrl})`,
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

			console.info('[Claude Live Check] response', { model, status: response.status, ok: response.ok });
			if (!response.ok) {
				lastError = apiErrorMessage(response.data, `Anthropic HTTP ${response.status} (${model})`);
				if (isModelUnavailable(response.status, lastError)) continue;
				throw new Error(lastError);
			}

			const extracted = extractClaudeText(response.data);
			if (!extracted.text) {
				lastError = `Claude가 빈 응답을 반환했습니다. (${model})`;
				continue;
			}
			return toLiveResult(engine, extracted.text, extracted.urls, input, ruleScore);
		}

		throw new Error(lastError);
	} catch (err) {
		console.error('[Claude Live Check Error]:', err);
		return buildFailedLiveResult(engine, ruleScore, timeoutError(err));
	}
}

async function runGemini(input: LiveCheckEngineInput, signal: AbortSignal): Promise<LiveEngineCheckResult> {
	const engine: LiveGroundedEngineId = 'gemini';
	if (isEnvTrue('MOCK_GEMINI')) {
		return buildMockLiveResult(engine, input, {
			isCited: false,
			mentionType: 'none',
			citedRank: null,
			evidenceSnippet: `[테스트 Mock] ${input.siteName}이 언급되지 않았습니다.`,
		});
	}
	const ruleScore = ruleScoreFor(engine, input.ruleScores);
	const apiKey = envString('GEMINI_API_KEY') || envString('GOOGLE_GENERATIVE_AI_API_KEY') || envString('GOOGLE_API_KEY');
	if (!apiKey) return buildFailedLiveResult(engine, ruleScore, 'GEMINI_API_KEY가 .env에 설정되지 않았습니다.');

	const models = resolveGeminiModels();
	const prompt = [
		LIVE_JSON_SYSTEM_PROMPT,
		`질의: "${input.targetQuery}", 대상 업체: "${input.siteName}" (${input.siteUrl}).`,
		'이 질의에 대해 대상 업체가 최신 웹 검색 추천에 인용되는지 판별하여 반드시 아래 JSON 형식으로만 답하세요. 설명 문구나 마크다운 없이 JSON 객체 하나만 출력하세요:',
		LIVE_JSON_SCHEMA,
	].join('\n');

	console.info('[Gemini Live Check] request', {
		models,
		query: input.targetQuery,
		siteName: input.siteName,
	});

	// Try the strictest config first (schema-enforced JSON with a generous token
	// budget to avoid truncating mid-object), then relax on failure so a
	// schema/param rejection never blocks the whole engine.
	const generationConfigs: Array<Record<string, unknown>> = [
		{ temperature: 0.1, maxOutputTokens: 512, responseMimeType: 'application/json', responseSchema: GEMINI_CITATION_SCHEMA },
		{ temperature: 0.1, maxOutputTokens: 512, responseMimeType: 'application/json' },
		{ temperature: 0.1, maxOutputTokens: 512 },
	];

	try {
		let lastError = 'Gemini HTTP error';
		for (const model of models) {
			for (const generationConfig of generationConfigs) {
				const response = await fetchJson(
					`${geminiGenerateUrl(model)}?key=${encodeURIComponent(apiKey)}`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							contents: [{ role: 'user', parts: [{ text: prompt }] }],
							generationConfig,
						}),
					},
					signal,
				);

				console.info('[Gemini Live Check] response', {
					model,
					jsonMime: generationConfig.responseMimeType === 'application/json',
					hasSchema: Boolean(generationConfig.responseSchema),
					status: response.status,
					ok: response.ok,
				});
				if (!response.ok) {
					lastError = apiErrorMessage(response.data, `Gemini HTTP ${response.status} (${model})`);
					continue;
				}

				const extracted = extractGeminiText(response.data);
				if (!extracted.text) {
					lastError = `Gemini가 빈 응답을 반환했습니다. (${model})`;
					continue;
				}
				if (!extractJsonFromText(extracted.text)) {
					// This config produced prose/markdown we can't recover JSON from
					// (e.g. "Here is the JSON requested: ```") — try the next config
					// instead of silently reporting a false "uncited" verdict.
					lastError = `Gemini가 JSON을 반환하지 않았습니다: ${extracted.text.slice(0, 120)} (${model})`;
					continue;
				}
				return toLiveResult(engine, extracted.text, extracted.urls, input, ruleScore);
			}
		}

		throw new Error(lastError);
	} catch (err) {
		console.error('[Gemini Live Check Error]:', err);
		return buildFailedLiveResult(engine, ruleScore, timeoutError(err));
	}
}

async function runPerplexity(input: LiveCheckEngineInput, signal: AbortSignal): Promise<LiveEngineCheckResult> {
	const engine: LiveGroundedEngineId = 'perplexity';
	if (isEnvTrue('MOCK_PERPLEXITY')) {
		return buildMockLiveResult(engine, input, {
			isCited: true,
			mentionType: 'recommended',
			citedRank: 1,
			evidenceSnippet: `[테스트 Mock] ${input.siteName}(${input.siteUrl})은 1위 전문 기관으로 추천합니다.`,
			citationUrl: input.siteUrl,
		});
	}
	const ruleScore = ruleScoreFor(engine, input.ruleScores);
	const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
	if (!apiKey) return buildFailedLiveResult(engine, ruleScore, 'PERPLEXITY_API_KEY가 .env에 설정되지 않았습니다.');

	console.info('[Perplexity Live Check] request', {
		model: 'sonar',
		query: input.targetQuery,
		siteName: input.siteName,
		location: input.location,
		category: input.category,
	});

	const attempts: Array<{ withSchema: boolean }> = [{ withSchema: true }, { withSchema: false }];

	try {
		let lastError = 'Perplexity HTTP error';
		for (const attempt of attempts) {
			const response = await fetchJson(
				PERPLEXITY_URL,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						model: 'sonar',
						temperature: 0.1,
						messages: [
							{ role: 'system', content: LIVE_JSON_SYSTEM_PROMPT },
							{ role: 'user', content: perplexityUserPrompt(input) },
						],
						...(attempt.withSchema ? { response_format: PERPLEXITY_CITATION_SCHEMA } : {}),
					}),
				},
				signal,
			);

			console.info('[Perplexity Live Check] response', { withSchema: attempt.withSchema, status: response.status, ok: response.ok });
			if (!response.ok) {
				lastError = apiErrorMessage(response.data, `Perplexity HTTP ${response.status}`);
				// Structured-output schema rejected (e.g. unsupported on this
				// account/model tier) — retry once without it before failing.
				continue;
			}

			const extracted = extractPerplexityText(response.data);
			if (!extracted.text) {
				lastError = 'Perplexity가 빈 응답을 반환했습니다.';
				continue;
			}
			return toLiveResult(engine, extracted.text, extracted.urls, input, ruleScore);
		}

		throw new Error(lastError);
	} catch (err) {
		console.error('[Perplexity Live Check Error]:', err);
		return buildFailedLiveResult(engine, ruleScore, timeoutError(err));
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
		return await RUNNERS[engine](input, controller.signal);
	} catch (error) {
		return buildFailedLiveResult(engine, ruleScoreFor(engine, input.ruleScores), timeoutError(error));
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
		return buildFailedLiveResult(engine, ruleScoreFor(engine, input.ruleScores), timeoutError(item.reason));
	});
	console.info(
		'[Live Check] done',
		results.map((item) => ({
			engine: item.engine,
			isLiveGrounded: item.isLiveGrounded,
			isCited: item.isCited,
			mentionType: item.mentionType,
			tier: item.tier,
			liveScore: item.liveScore,
			error: item.error,
		})),
	);
	return results;
}
