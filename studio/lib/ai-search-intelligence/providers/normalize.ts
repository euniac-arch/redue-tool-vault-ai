import { citationKindFromObservedUrl } from '@/lib/ai-search-intelligence/citations/classify';
import { isObservedHttpUrl, sanitizeObservedUrl } from '@/lib/ai-search-intelligence/citations/observed-url';
import { splitCompetitorEntities, type AsiEntityContext } from '@/lib/ai-search-intelligence/core/entity-role';
import { extractBusinessNames, parseAsiAnswerText } from '@/lib/ai-search-intelligence/core/parse-text';
import type { CitationResult } from '@/lib/ai-search-intelligence/types';

export type ParsedAsiAnswer = {
	answer: string;
	mentions: string[];
	recommendations: string[];
	competitors: string[];
	landmarks: string[];
	citations: CitationResult[];
};

function unescapeJsonString(value: string): string {
	return value
		.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
		.replace(/\\n/g, '\n')
		.replace(/\\r/g, '\r')
		.replace(/\\t/g, '\t')
		.replace(/\\"/g, '"')
		.replace(/\\\\/g, '\\');
}

function recoverJsonStringField(raw: string, field: string): string | null {
	const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const complete = raw.match(new RegExp(`["']${escaped}["']\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 's'));
	if (complete?.[1] != null) {
		const value = unescapeJsonString(complete[1]).trim();
		if (value) return value;
	}
	const loose = raw.match(new RegExp(`["']${escaped}["']\\s*:\\s*"(.*?)"`, 's'));
	if (loose?.[1] != null) {
		const value = unescapeJsonString(loose[1]).trim();
		if (value) return value;
	}
	const truncated = raw.match(new RegExp(`["']${escaped}["']\\s*:\\s*"((?:\\\\.|[^"\\\\])*)$`, 's'));
	if (truncated?.[1] != null) {
		const value = unescapeJsonString(truncated[1]).trim();
		if (value) return value;
	}
	return null;
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	const slice = raw.slice(start, end + 1);
	for (const candidate of [slice, slice.replace(/,\s*([}\]])/g, '$1')]) {
		try {
			const parsed = JSON.parse(candidate) as unknown;
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>;
			}
		} catch {
			/* try next candidate */
		}
	}
	return null;
}

/** Pull `answer` out of a JSON blob, including truncated Gemini output. */
export function unwrapAsiAnswerText(raw: string): string {
	const trimmed = (raw || '').trim();
	if (!trimmed) return '';
	const parsed = extractJsonObject(trimmed);
	const fromObject = parsed?.answer != null ? String(parsed.answer).trim() : '';
	if (fromObject) return fromObject;
	const recovered = recoverJsonStringField(trimmed, 'answer');
	if (recovered) return recovered;
	const fenced = stripFenceNoise(trimmed);
	if (fenced !== trimmed) return unwrapAsiAnswerText(fenced);
	return trimmed;
}

/** True when the stored text is still a broken JSON envelope, not a usable answer. */
export function isIncompleteAsiJsonAnswer(raw: string): boolean {
	const trimmed = (raw || '').trim();
	if (!trimmed.startsWith('{') || !/["']answer["']\s*:/.test(trimmed)) return false;
	const unwrapped = unwrapAsiAnswerText(trimmed);
	return unwrapped === trimmed || (unwrapped.startsWith('{') && /["']answer["']/.test(unwrapped));
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
	const trimmed = text.trim();
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const raw = fenced?.[1]?.trim() || trimmed;
	return tryParseJsonObject(raw);
}

function extractJsonStringList(text: string, field: string): string[] {
	const re = new RegExp(`["']?${field}["']?\\s*:\\s*\\[([^\\]]*)\\]`, 'i');
	const match = text.match(re);
	if (!match?.[1]) return [];
	return match[1]
		.split(',')
		.map((item) => item.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').trim())
		.filter(Boolean);
}

function extractJsonBoolean(text: string, field: string): boolean | null {
	const match = text.match(new RegExp(`["']${field}["']\\s*:\\s*(true|false)`, 'i'));
	if (!match?.[1]) return null;
	return match[1].toLowerCase() === 'true';
}

function extractJsonCitationUrls(text: string): string[] {
	const block = text.match(/["']citations["']\s*:\s*\[([\s\S]*?)\]/i);
	if (!block?.[1]) return [];
	return Array.from(block[1].matchAll(/https?:\/\/[^\s)"']+/g)).map((item) => sanitizeObservedUrl(item[0]));
}

/** @deprecated Use citationKindFromObservedUrl — kept so existing imports compile. */
export function citationKindFromUrl(url: string) {
	return citationKindFromObservedUrl(url);
}

/** Only URLs the provider actually returned or wrote in the answer. Never invents sources. */
export function extractCitationsFromText(answer: string, extras: { urls?: string[] } = {}): CitationResult[] {
	const fromAnswer = Array.from(answer.matchAll(/https?:\/\/[^\s)"']+/g)).map((match) => sanitizeObservedUrl(match[0]));
	const urls = Array.from(
		new Set(
			[...(extras.urls || []).map((url) => sanitizeObservedUrl(url)), ...fromAnswer].filter((url) =>
				isObservedHttpUrl(url),
			),
		),
	);
	return urls.slice(0, 12).map((url) => ({
		source: hostLabel(url),
		url,
		type: citationKindFromObservedUrl(url),
		relevance: 0,
		authority: 0,
	}));
}

export function parseProviderAnswer(
	raw: string,
	extras: { urls?: string[] } & AsiEntityContext = {},
): ParsedAsiAnswer {
	const parsed = extractJsonObject(raw);
	const answer = unwrapAsiAnswerText(raw);
	const context: AsiEntityContext & { brand: string } = {
		brand: extras.brand || '',
		aliases: extras.aliases,
		category: extras.category,
		industry: extras.industry,
		services: extras.services,
	};
	const fromText = parseAsiAnswerText(answer, context);
	const mentions = uniqueKeep([
		...stringList(parsed?.mentions),
		...extractJsonStringList(raw, 'mentions'),
		...fromText.mentions,
		...extractBusinessNames(answer),
	]);
	const recommendations = uniqueKeep([
		...stringList(parsed?.recommendations),
		...extractJsonStringList(raw, 'recommendations'),
		...fromText.recommendations,
	]);
	if (extractJsonBoolean(raw, 'recommendation') === true && mentions[0]) {
		recommendations.push(...uniqueKeep([mentions[0]]));
	}
	if (extractJsonBoolean(raw, 'brandMention') === true && mentions[0]) {
		mentions.unshift(mentions[0]);
	}
	const jsonLandmarks = uniqueKeep([...stringList(parsed?.landmarks), ...extractJsonStringList(raw, 'landmarks')]);
	const rawCompetitors = uniqueKeep([
		...stringList(parsed?.competitors),
		...extractJsonStringList(raw, 'competitors'),
		...fromText.competitors,
		...recommendations,
	]).filter((name) => !jsonLandmarks.some((item) => item.toLowerCase() === name.toLowerCase()));
	const split = splitCompetitorEntities(rawCompetitors, answer, context);
	const citations = extractCitationsFromText(answer, {
		urls: [...(extras.urls || []), ...extractJsonCitationUrls(raw)],
	});
	return {
		answer,
		mentions: uniqueKeep(mentions),
		recommendations: uniqueKeep(recommendations),
		competitors: split.competitors,
		landmarks: uniqueKeep([...jsonLandmarks, ...fromText.landmarks, ...split.landmarks]),
		citations,
	};
}

function stripFenceNoise(raw: string): string {
	const fenced = raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) {
		const inner = fenced[1].trim();
		const parsed = tryParseJsonObject(inner);
		if (parsed?.answer) return String(parsed.answer);
		return inner;
	}
	return raw;
}

function uniqueKeep(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of values) {
		const value = raw.trim();
		if (!value) continue;
		const key = value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}

function stringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function hostLabel(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}
