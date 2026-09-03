import type { AsiProviderQuery } from '@/lib/ai-search-intelligence/providers/types';

const JSON_SHAPE =
	'{"answer":string,"mentions":string[],"recommendations":string[],"competitors":string[],"landmarks":string[],"citations":[{"source":string,"url":string,"relevance":number,"authority":number}]}';

export function asiAnswerPrompt(input: AsiProviderQuery): { system: string; user: string } {
	const brand = input.brand || 'unknown brand';
	const category = input.category || 'unknown category';
	return {
		system: [
			'You analyze whether a brand appears in AI-search answers.',
			'Return exactly one JSON object. No markdown. No code fences. No ```json. No prose before or after the object.',
			`Required keys: ${JSON_SHAPE}`,
			'mentions = names that appear in the answer, including landmarks if named.',
			'recommendations = brands you would recommend for the same service as the target, ordered. Never omit recommendations when you name a preferred brand.',
			'competitors = only real peer businesses that offer the same or similar service/product as the target brand. Never include location cues, reference points, or landmarks (nearby buildings, stations, hotels used as directions, bus stops, department stores used as meeting points).',
			'landmarks = geographic or directional reference names used only to locate the target. Put those names here, never in competitors.',
			'citations = only URLs that actually appear as sources. If you have no real URL, use []. Never invent sources.',
		].join(' '),
		user: [
			`Query: ${input.query}`,
			`Brand: ${brand}`,
			`URL: ${input.url}`,
			input.location ? `Location: ${input.location}` : '',
			`Category: ${category}`,
			'Write answer in the query language. Keep answer under 120 words.',
			'Output the JSON object only.',
		]
			.filter(Boolean)
			.join('\n'),
	};
}

export function uniqueModels(models: readonly string[]): string[] {
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

export function isModelUnavailable(status: number, message: string): boolean {
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
