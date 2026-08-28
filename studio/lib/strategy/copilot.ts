import { attachPostposition } from '@/lib/korean-josa';
import type {
	CopilotProvider,
	CopilotRefineRequest,
	CopilotRefineResponse,
	CopilotRefineTarget,
	ExecutionBlueprint,
	StrategyAuditContext,
	StrategyCopilotContext,
	StrategyIndustryProfileRef,
	StrategyLang,
	StrategyResult,
} from '@/lib/strategy/types';

export const COPILOT_TARGETS: readonly CopilotRefineTarget[] = [
	'title',
	'meta',
	'h1',
	'faq',
	'answer',
	'entitySentence',
	'content',
	'strategy',
	'action',
];

const RANK_CLAIM_RE =
	/무조건\s*1위|1위\s*보장|1페이지\s*보장|상위\s*노출\s*보장|순위\s*(상승\s*)?보장|ChatGPT\s*상위|Google\s*1페이지|guarantee[ds]?\s+(rank|ranking|#?1)|#1\s+on\s+google|page\s*1\s+guarantee/i;

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

export function isCopilotTarget(value: unknown): value is CopilotRefineTarget {
	return typeof value === 'string' && (COPILOT_TARGETS as readonly string[]).includes(value);
}

export function containsRankClaim(text: string): boolean {
	return RANK_CLAIM_RE.test(text);
}

export function sanitizeCopilotText(text: string, fallback: string): { text: string; stripped: boolean } {
	const raw = compact(text);
	if (!raw) return { text: fallback, stripped: true };
	if (!containsRankClaim(raw)) return { text: raw, stripped: false };
	const cleaned = raw
		.replace(RANK_CLAIM_RE, '')
		.replace(/\s{2,}/g, ' ')
		.replace(/\s+([,.])/g, '$1')
		.trim();
	return { text: cleaned || fallback, stripped: true };
}

export function buildCopilotContext(input: {
	result: StrategyResult;
	ctx: StrategyAuditContext;
	profile: StrategyIndustryProfileRef;
	lang: StrategyLang;
	target: CopilotRefineTarget;
	currentText: string;
}): StrategyCopilotContext {
	const { result, ctx, profile, lang, target, currentText } = input;
	return {
		version: 1,
		lang,
		keyword: result.keyword,
		audit: {
			url: ctx.url,
			siteName: ctx.siteName,
			industry: ctx.industry,
			location: ctx.location,
			scores: {
				seo: ctx.scores.seo?.value ?? null,
				geo: ctx.scores.geo?.value ?? null,
			},
			schemaTypes: ctx.schema.types.slice(0, 8),
			issues: ctx.issues.slice(0, 5).map((issue) => issue.title),
		},
		industryProfile: {
			type: profile.registryType,
			label: profile.label,
			schemaType: profile.schemaType,
			specialties: profile.specialties.slice(0, 6),
		},
		intent: result.intent.length ? result.intent : result.intents,
		entities: result.entities.map((node) => ({ role: node.role, label: node.label, status: node.status })),
		currentState: result.currentState.map((row) => ({ axis: row.axis, currentLabel: row.currentLabel })),
		gaps: result.gaps.slice(0, 6).map((gap) => ({
			code: gap.code,
			title: gap.title,
			priority: gap.priority,
			current: gap.current,
			strategy: gap.strategy,
		})),
		priorities: result.priorities.slice(0, 6),
		target,
		currentText: compact(currentText),
	};
}

export function currentTextForTarget(result: StrategyResult, target: CopilotRefineTarget): string {
	const bp = result.blueprint;
	switch (target) {
		case 'title':
			return bp.seo.title;
		case 'meta':
			return bp.seo.metaDescription;
		case 'h1':
			return bp.seo.h1;
		case 'faq':
			return `Q. ${bp.aeo.question}\nA. ${bp.aeo.shortAnswer}`;
		case 'answer':
			return bp.aeo.shortAnswer;
		case 'entitySentence':
			return bp.entity.entitySentence;
		case 'content':
			return bp.content.map((block) => `${block.label}: ${block.text}`).join('\n');
		case 'strategy':
			return result.strategies
				.slice(0, 3)
				.map((item) => `${item.title}\nWHY: ${item.why}\nWHAT: ${item.what}\nIMPACT: ${item.expectedImpact}`)
				.join('\n\n');
		case 'action':
			return [`P0: ${bp.action.p0.join(' / ')}`, `P1: ${bp.action.p1.join(' / ')}`, `P2: ${bp.action.p2.join(' / ')}`].join('\n');
		default:
			return '';
	}
}

export function copilotSystemPrompt(lang: StrategyLang): string {
	if (lang === 'en') {
		return [
			'You refine Strategy Studio execution copy. You do not invent a new strategy.',
			'Use only the supplied context: audit, industry profile, keyword, intent, entities, current state, gaps, and priority.',
			'Return JSON: {"refinedText":"..."}.',
			'Keep facts grounded in the audit. Do not invent URLs, landmarks, scores, or citations.',
			'Never promise rankings, #1, page-one, or guaranteed visibility on Google, Naver, ChatGPT, Gemini, or Perplexity.',
			'Write paste-ready copy for the requested target only.',
		].join(' ');
	}
	return [
		'당신은 Strategy Studio의 실행 문장을 고도화합니다. 새로운 전략을 처음부터 만들지 않습니다.',
		'전달된 context만 사용합니다: 진단, 업종 프로필, 공략 키워드, Intent, Entity, 현재 상태, Gap, Priority.',
		'JSON만 반환합니다: {"refinedText":"..."}.',
		'진단에 없는 URL, 생활권, 점수, 인용을 만들지 않습니다.',
		'검색 순위 보장, 무조건 1위, ChatGPT 상위노출 보장, Google 1페이지 보장 표현을 쓰지 않습니다.',
		'요청된 target만 사이트에 바로 붙일 수 있는 문장으로 다듬습니다.',
	].join(' ');
}

export function copilotUserPrompt(context: StrategyCopilotContext): string {
	return JSON.stringify(
		{
			task: `Refine only the ${context.target} field.`,
			pipeline: 'RULE + INDUSTRY PROFILE + AUDIT → STRATEGY ENGINE → AI refine',
			context,
		},
		null,
		2,
	);
}

export function parseCopilotRequest(raw: unknown): CopilotRefineRequest | null {
	if (!raw || typeof raw !== 'object') return null;
	const body = raw as Record<string, unknown>;
	const context = body.context;
	if (!context || typeof context !== 'object') return null;
	const ctx = context as Record<string, unknown>;
	if (!isCopilotTarget(ctx.target)) return null;
	if (typeof ctx.keyword !== 'string' || !ctx.keyword.trim()) return null;
	if (typeof ctx.currentText !== 'string') return null;
	if (!ctx.audit || typeof ctx.audit !== 'object') return null;
	if (!ctx.industryProfile || typeof ctx.industryProfile !== 'object') return null;
	return { context: context as StrategyCopilotContext };
}

export function heuristicRefine(context: StrategyCopilotContext): CopilotRefineResponse {
	const lang = context.lang === 'en' ? 'en' : 'ko';
	const brand = context.audit.siteName;
	const loc = context.audit.location;
	const focus = context.keyword;
	let draft = context.currentText;

	if (context.target === 'title' && brand && !draft.includes(brand)) {
		draft = lang === 'en' ? `${draft} | ${brand}` : `${draft} | ${brand}`;
	}
	if ((context.target === 'answer' || context.target === 'entitySentence') && loc && !draft.includes(loc.split(/\s+/)[0] || loc)) {
		draft = lang === 'en' ? `${draft} Official place: ${loc}.` : `${draft} 공식 지역은 ${loc}입니다.`;
	}
	if (context.target === 'strategy' && context.gaps[0]) {
		draft =
			lang === 'en'
				? `${context.gaps[0].title}: ${context.gaps[0].strategy} Use ${focus} as the official criteria. This is not a rank forecast.`
				: `${context.gaps[0].title}: ${context.gaps[0].strategy} ${attachPostposition(focus, '을/를')} 공식 기준으로 고정합니다. 순위 예측이 아닙니다.`;
	}

	const sanitized = sanitizeCopilotText(draft, context.currentText);
	return {
		target: context.target,
		refinedText: sanitized.text,
		provider: 'heuristic',
		warning:
			lang === 'en'
				? 'Rule-engine polish. Connect an existing LLM key to refine with the model.'
				: '규칙 엔진 고도화입니다. 기존 LLM 키가 있으면 모델이 이어서 다듬습니다.',
	};
}

export function extractJsonObject(text: string): unknown {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		const start = trimmed.indexOf('{');
		const end = trimmed.lastIndexOf('}');
		if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
		throw new Error('Model did not return JSON');
	}
}

export function normalizeCopilotResponse(
	raw: unknown,
	context: StrategyCopilotContext,
	provider: CopilotProvider,
	model?: string,
): CopilotRefineResponse {
	const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const candidate = typeof record.refinedText === 'string' ? record.refinedText : context.currentText;
	const sanitized = sanitizeCopilotText(candidate, context.currentText);
	return {
		target: context.target,
		refinedText: sanitized.text,
		provider,
		model,
		warning: sanitized.stripped
			? context.lang === 'en'
				? 'Ranking-guarantee language was removed.'
				: '순위 보장 표현을 제거했습니다.'
			: undefined,
	};
}

export function applyCopilotOverride(
	blueprint: ExecutionBlueprint,
	target: CopilotRefineTarget,
	text: string,
): ExecutionBlueprint {
	const next: ExecutionBlueprint = {
		...blueprint,
		seo: { ...blueprint.seo },
		aeo: { ...blueprint.aeo },
		geo: { ...blueprint.geo },
		entity: { ...blueprint.entity },
		content: blueprint.content.map((block) => ({ ...block })),
		copyUnits: blueprint.copyUnits.map((unit) => ({ ...unit })),
		action: { ...blueprint.action, p0: [...blueprint.action.p0], p1: [...blueprint.action.p1], p2: [...blueprint.action.p2] },
	};

	const setUnit = (id: ExecutionBlueprint['copyUnits'][number]['id'], value: string) => {
		next.copyUnits = next.copyUnits.map((unit) => (unit.id === id ? { ...unit, text: value } : unit));
	};

	if (target === 'title') {
		next.seo.title = text;
		setUnit('title', text);
	} else if (target === 'meta') {
		next.seo.metaDescription = text;
		setUnit('meta', text);
	} else if (target === 'h1') {
		next.seo.h1 = text;
		next.content = next.content.map((block) => (block.id === 'h1' ? { ...block, text } : block));
		setUnit('h1', text);
	} else if (target === 'faq') {
		const faq = text.match(/Q\.\s*([\s\S]+?)\s*A\.\s*([\s\S]+)/i);
		if (faq) {
			next.aeo.question = faq[1].trim();
			next.aeo.shortAnswer = faq[2].trim();
			const formatted = `Q. ${next.aeo.question}\nA. ${next.aeo.shortAnswer}`;
			next.content = next.content.map((block) =>
				block.id === 'question'
					? { ...block, text: next.aeo.question }
					: block.id === 'faq'
						? { ...block, text: formatted }
						: block,
			);
			setUnit('faq', formatted);
		} else {
			next.aeo.question = text;
			setUnit('faq', text);
		}
	} else if (target === 'answer') {
		next.aeo.shortAnswer = text;
		next.content = next.content.map((block) => (block.id === 'answer' ? { ...block, text } : block));
		setUnit('answer', text);
	} else if (target === 'entitySentence') {
		next.geo.entitySentence = text;
		next.entity = { ...next.geo };
		setUnit('entitySentence', text);
	} else if (target === 'content') {
		next.content = next.content.map((block) => (block.id === 'introduction' ? { ...block, text } : block));
	} else if (target === 'action') {
		const lines = text.split('\n').map((line) => line.replace(/^P[012]:\s*/i, '').trim()).filter(Boolean);
		if (lines[0]) next.action.p0 = lines[0].split(/\s*\/\s*/).filter(Boolean);
		if (lines[1]) next.action.p1 = lines[1].split(/\s*\/\s*/).filter(Boolean);
		if (lines[2]) next.action.p2 = lines[2].split(/\s*\/\s*/).filter(Boolean);
	}

	return next;
}

export function contextHasEngineFields(context: StrategyCopilotContext): boolean {
	return Boolean(
		context.keyword &&
			context.audit.url &&
			context.industryProfile.type &&
			context.intent &&
			context.entities &&
			context.currentState &&
			context.gaps &&
			context.priorities &&
			context.target &&
			typeof context.currentText === 'string',
	);
}
