import { getIndustryProfile } from '@/lib/registry/universalIndustryRegistry';
import { citationHay, matchBlueprintVariant, pickLocale, resolveBlueprintProfile, type CitationEntity } from '@/lib/strategy/profiles';
import { focusPhrase, locationLabel } from '@/lib/strategy/normalize-keyword';
import type {
	AiCitationTopic,
	BlueprintDecisionMatrix,
	BlueprintDecisionMatrixRow,
	BlueprintInformationGain,
	BlueprintLlmsTxt,
	BlueprintRagChunk,
	BlueprintSafetySignals,
	NormalizedKeyword,
	StrategyAuditContext,
	StrategyIndustryProfileRef,
	StrategyLang,
} from '@/lib/strategy/types';

const VAGUE_PRONOUN_RE =
	/본원|당원|이곳|여기(?:서|에|를)?|우리\s*(?:병원|의원|클리닉|샵|사무소)?|저희|this\s+(?:clinic|office|hospital|practice)|our\s+(?:clinic|office|hospital|practice)|\bwe\s+offer\b/i;

export interface AiCitationModules {
	topic: AiCitationTopic;
	decisionMatrix: BlueprintDecisionMatrix;
	ragChunks: BlueprintRagChunk[];
	informationGain: BlueprintInformationGain;
	safetySignals: BlueprintSafetySignals;
	llmsTxt: BlueprintLlmsTxt;
}

function compact(value: string | null | undefined): string {
	return (value || '').replace(/\s+/g, ' ').trim();
}

function unique(values: readonly (string | null | undefined)[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const phrase = compact(raw);
		if (!phrase) continue;
		const key = phrase.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(phrase);
	}
	return out;
}

/** Approximate BPE-style token count for KO/EN citation copy. */
export function estimateTokenCount(text: string): number {
	const normalized = compact(text);
	if (!normalized) return 0;
	let tokens = 0;
	for (const char of normalized) {
		if (/[가-힣]/.test(char)) tokens += 1.45;
		else if (/[A-Za-z0-9]/.test(char)) tokens += 0.28;
		else if (/\s/.test(char)) tokens += 0.12;
		else tokens += 0.55;
	}
	return Math.max(1, Math.round(tokens));
}

export function containsVaguePronoun(text: string): boolean {
	return VAGUE_PRONOUN_RE.test(text);
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function matrixMarkdown(columns: string[], rows: BlueprintDecisionMatrixRow[]): string {
	const hasDowntime = columns.length >= 5 && rows.some((row) => Boolean(row.downtime));
	const headers = hasDowntime ? columns : columns.slice(0, 4);
	const cells = (row: BlueprintDecisionMatrixRow) => {
		const base = [row.type, row.recommended, row.device, row.caution];
		return hasDowntime ? [...base, row.downtime || '—'] : base;
	};
	const sep = headers.map(() => '---');
	return [`| ${headers.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...rows.map((row) => `| ${cells(row).join(' | ')} |`)].join('\n');
}

function matrixHtml(columns: string[], rows: BlueprintDecisionMatrixRow[]): string {
	const hasDowntime = columns.length >= 5 && rows.some((row) => Boolean(row.downtime));
	const headers = hasDowntime ? columns : columns.slice(0, 4);
	const cells = (row: BlueprintDecisionMatrixRow) => {
		const base = [row.type, row.recommended, row.device, row.caution];
		return hasDowntime ? [...base, row.downtime || '—'] : base;
	};
	const thead = `<thead><tr>${headers.map((col) => `<th>${escapeHtml(col)}</th>`).join('')}</tr></thead>`;
	const tbody = `<tbody>${rows
		.map((row) => `<tr>${cells(row).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
		.join('')}</tbody>`;
	return `<table>${thead}${tbody}</table>`;
}

function resolveEntity(
	ctx: StrategyAuditContext,
	profile: StrategyIndustryProfileRef,
	parsed: NormalizedKeyword,
	lang: StrategyLang,
): CitationEntity {
	const catalog = getIndustryProfile(profile.registryType);
	const brand = compact(ctx.siteName || ctx.entities.brandName) || catalog.label[lang];
	const personRole = catalog.personJobTitle[lang];
	const personName = compact(ctx.entities.representativeName);
	const person = personName ? `${personName} ${personRole}` : `${brand} ${personRole}`;
	const location = locationLabel(parsed) || compact(ctx.location) || compact(ctx.localSignals.addressLocality) || '';
	const focus = focusPhrase(parsed);
	return {
		brand,
		person,
		personRole,
		location,
		focus,
		industry: compact(parsed.industry) || compact(ctx.subIndustry) || profile.label || catalog.label[lang],
		url: compact(ctx.url),
		telephone: compact(ctx.localSignals.telephone),
		address: compact(ctx.localSignals.address) || compact(ctx.location),
		schemaType: profile.schemaType || catalog.schemaType,
		services: unique([parsed.service, parsed.problem, parsed.industry, ...profile.specialties, catalog.mainService[lang]]).slice(0, 6),
	};
}

function expandRagIfShort(
	chunk: { id: string; title: string; text: string },
	entity: CitationEntity,
	lang: StrategyLang,
): BlueprintRagChunk {
	let text = compact(chunk.text);
	const pads =
		lang === 'en'
			? [
					`${entity.brand} ${entity.person} keeps ${entity.focus}${entity.location ? ` in ${entity.location}` : ''} as a self-contained paragraph: brand, named role, place, and device or method appear in the same unit so a retrieval index does not need a prior sentence.`,
					`${entity.brand} repeats the official ${entity.personRole} title and the ${entity.focus} scope in this paragraph so SearchGPT, Perplexity, Gemini, and Google AI Overviews can cite ${entity.brand} without resolving a pronoun.`,
				]
			: [
					`${entity.brand} ${entity.person}은 ${entity.location ? `${entity.location}의 ` : ''}${entity.focus}를 한 문단에서 끝냅니다. 브랜드, 직함, 지역, 장비 또는 방법이 같은 단위에 있어 검색 인덱스가 앞 문장을 필요로 하지 않습니다.`,
					`${entity.brand}는 공식 ${entity.personRole} 직함과 ${entity.focus} 범위를 이 문단에 다시 밝혀 SearchGPT, Perplexity, Gemini, Google AI Overviews가 대명사를 해석하지 않고 ${entity.brand}를 인용하게 합니다.`,
				];
	for (const pad of pads) {
		if (estimateTokenCount(text) >= 320) break;
		if (!text.includes(pad)) text = `${text} ${pad}`;
	}
	return {
		id: chunk.id,
		title: chunk.title,
		text,
		tokenEstimate: estimateTokenCount(text),
	};
}

function buildLlmsTxt(
	entity: CitationEntity,
	topic: AiCitationTopic,
	matrix: BlueprintDecisionMatrix,
	gain: BlueprintInformationGain,
	safety: BlueprintSafetySignals,
	chunks: BlueprintRagChunk[],
	lang: StrategyLang,
): BlueprintLlmsTxt {
	const loc = entity.location || (lang === 'en' ? 'Not listed' : '미기재');
	const phone = entity.telephone || (lang === 'en' ? 'Not listed' : '미기재');
	const address = entity.address || (lang === 'en' ? 'Not listed' : '미기재');
	const personName = compact(entity.person.replace(entity.personRole, '')) || (lang === 'en' ? 'Not listed' : '미등록');
	const lines: string[] = [
		`# ${entity.brand}`,
		'',
		lang === 'en'
			? `> Official knowledge graph for AI crawlers (GPTBot, PerplexityBot, Gemini, Google-Extended). Topic: ${topic}.`
			: `> AI 크롤러(GPTBot, PerplexityBot, Gemini, Google-Extended)용 공식 지식 그래프입니다. 주제: ${topic}.`,
		'',
		lang === 'en'
			? `Industry: ${entity.industry} · Schema.org: ${entity.schemaType} · Region: ${loc} · ${entity.personRole}`
			: `업종: ${entity.industry} · Schema.org: ${entity.schemaType} · 지역: ${loc} · ${entity.personRole}`,
		'',
		lang === 'en' ? '## Entity' : '## 개체',
		'',
		`- Organization: ${entity.brand}`,
		`- Person: ${personName}`,
		`- jobTitle: ${entity.personRole}`,
		`- Service: ${entity.focus}`,
		`- Topic: ${topic}`,
		'',
		lang === 'en' ? '## Services' : '## 서비스',
		'',
		...entity.services.map((service, index) => `- ${index + 1}. ${service}`),
		'',
		'## NAP',
		'',
		`- name: ${entity.brand}`,
		`- address: ${address}`,
		`- telephone: ${phone}`,
		`- url: ${entity.url || (lang === 'en' ? 'Not listed' : '미기재')}`,
		'',
		`## ${entity.personRole}`,
		'',
		`- name: ${personName}`,
		`- jobTitle: ${entity.personRole}`,
		'',
		`## ${matrix.title}`,
		'',
		matrix.markdown,
		'',
		`## ${gain.title}`,
		'',
		...gain.items.map((item) => `- ${item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ''}${item.note ? ` (${item.note})` : ''}`),
		'',
		`## ${safety.heading}`,
		'',
		...safety.notRecommended.map((item) => `- ${item}`),
		'',
		lang === 'en' ? '## Side effects' : '## 부작용',
		'',
		...safety.sideEffects.map((item) => `- ${item}`),
		'',
		lang === 'en' ? '## Contraindications' : '## 금기',
		'',
		...safety.contraindications.map((item) => `- ${item}`),
		'',
		lang === 'en' ? '## Citation facts' : '## 인용 사실',
		'',
	];

	for (const chunk of chunks) {
		lines.push(`### ${chunk.title}`, '', chunk.text, '');
	}

	lines.push(safety.disclaimer, '');

	const markdown = `${lines
		.filter((line, index, all) => !(line === '' && all[index - 1] === ''))
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()}\n`;

	return { filename: 'llms.txt', deployPath: '/llms.txt', markdown };
}

export function buildAiCitationModules(input: {
	keyword: string;
	parsed: NormalizedKeyword;
	ctx: StrategyAuditContext;
	profile: StrategyIndustryProfileRef;
	lang: StrategyLang;
}): AiCitationModules {
	const { keyword, parsed, ctx, profile, lang } = input;
	const blueprintProfile = resolveBlueprintProfile(profile.registryType);
	const variant = matchBlueprintVariant(
		blueprintProfile,
		citationHay([keyword, parsed.service, parsed.problem, ...profile.specialties]),
	);
	const topic = variant.id;
	const entity = resolveEntity(ctx, profile, parsed, lang);
	const columns = pickLocale(variant.columns, lang);
	const rows = pickLocale(variant.rows, lang);
	const decisionMatrix: BlueprintDecisionMatrix = {
		topic,
		title: pickLocale(variant.matrixTitle, lang),
		caption: pickLocale(variant.matrixCaption, lang),
		columns,
		rows,
		markdown: matrixMarkdown(columns, rows),
		html: matrixHtml(columns, rows),
	};
	const informationGain: BlueprintInformationGain = {
		topic,
		title: pickLocale(variant.gainTitle, lang),
		caption: pickLocale(variant.gainCaption, lang),
		items: pickLocale(variant.gain, lang),
	};
	const safetySignals: BlueprintSafetySignals = {
		heading: lang === 'en' ? 'Not recommended for' : '이런 분께는 권장하지 않습니다',
		notRecommended: pickLocale(variant.notRecommended, lang),
		sideEffects: pickLocale(variant.sideEffects, lang),
		contraindications: pickLocale(variant.contraindications, lang),
		disclaimer:
			lang === 'en'
				? `${entity.brand} publishes these filters as E-E-A-T signals, not a diagnosis and not a ranking promise. Confirm on-page facts before treating this draft as live copy.`
				: `${entity.brand}는 이 필터를 E-E-A-T 신뢰 신호로 공개합니다. 개인 진단이 아니며 검색 순위 보장도 아닙니다. 초안을 올리기 전 공식 페이지 사실과 맞추세요.`,
	};
	const ragChunks = variant.rag(entity, lang).slice(0, 3).map((chunk) => expandRagIfShort(chunk, entity, lang));
	const llmsTxt = buildLlmsTxt(entity, topic, decisionMatrix, informationGain, safetySignals, ragChunks, lang);
	return { topic, decisionMatrix, ragChunks, informationGain, safetySignals, llmsTxt };
}
