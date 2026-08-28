/**
 * Public "AI 프롬프트 허브" — generic AI-usage prompts (what to ask AI).
 * This is a content/resource layer, not Execution Blueprint and not Search Strategy Design.
 */

import promptHubRaw from '@/data/promptHubData.json';
import type { CopilotRefineTarget } from '@/lib/strategy/types';

export type PromptCategoryId = 'seo' | 'geo' | 'aeo' | 'entity' | 'schema' | 'local' | 'content';

export type PromptDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type PromptSortKey = 'recommended' | 'newest' | 'name';

export type AiPrompt = {
	slug: string;
	title: string;
	category: PromptCategoryId;
	description: string;
	purpose: string;
	prompt: string;
	tags: string[];
	difficulty: PromptDifficulty;
	/** Existing public AI tool ids from `aiToolsData.json` (chatgpt, claude, gemini, …). */
	recommendedTools: string[];
	useCases: string[];
	relatedPromptSlugs: string[];
	featured: boolean;
	recommendScore: number;
	updatedAt: string;
	/** Optional future map to Execution Blueprint AI-refine targets. Not wired in this release. */
	blueprintTarget: CopilotRefineTarget | null;
};

export type PromptCategory = {
	id: PromptCategoryId;
	label: string;
	icon: string;
};

type PromptHubFile = {
	version: number;
	categories: PromptCategory[];
	prompts: AiPrompt[];
};

const DATASET = promptHubRaw as PromptHubFile;

export const PROMPT_HUB_PATH = '/prompts';
export const PROMPT_HUB_TAB_HREF = '/insights?tab=prompts';

export const PROMPT_CATEGORIES: readonly PromptCategory[] = DATASET.categories;

export const PROMPT_CATEGORY_IDS = PROMPT_CATEGORIES.map((category) => category.id) as PromptCategoryId[];

export const PROMPT_SORT_OPTIONS: { key: PromptSortKey; label: string }[] = [
	{ key: 'recommended', label: '추천순' },
	{ key: 'newest', label: '최신순' },
	{ key: 'name', label: '이름순' },
];

export const PROMPT_DIFFICULTY_LABEL: Record<PromptDifficulty, string> = {
	beginner: '입문',
	intermediate: '실전',
	advanced: '심화',
};

export function loadPrompts(): AiPrompt[] {
	return DATASET.prompts.map((prompt) => ({
		...prompt,
		tags: [...prompt.tags],
		recommendedTools: [...prompt.recommendedTools],
		useCases: [...prompt.useCases],
		relatedPromptSlugs: [...prompt.relatedPromptSlugs],
	}));
}

export function getPromptBySlug(slug: string): AiPrompt | null {
	const normalized = slug.trim();
	if (!normalized) return null;
	return loadPrompts().find((prompt) => prompt.slug === normalized) ?? null;
}

export function getPromptHref(slug: string): string {
	return `${PROMPT_HUB_PATH}/${slug}`;
}

export function getCategoryLabel(id: PromptCategoryId): string {
	return PROMPT_CATEGORIES.find((category) => category.id === id)?.label ?? id.toUpperCase();
}

export function isPromptCategoryId(value: string): value is PromptCategoryId {
	return (PROMPT_CATEGORY_IDS as string[]).includes(value);
}

export function searchPrompts(
	prompts: AiPrompt[],
	query: string,
	category: 'all' | PromptCategoryId,
): AiPrompt[] {
	const q = query.trim().toLowerCase();
	return prompts.filter((prompt) => {
		if (category !== 'all' && prompt.category !== category) return false;
		if (!q) return true;
		return (
			prompt.title.toLowerCase().includes(q) ||
			prompt.description.toLowerCase().includes(q) ||
			prompt.purpose.toLowerCase().includes(q) ||
			prompt.tags.some((tag) => tag.toLowerCase().includes(q)) ||
			prompt.useCases.some((useCase) => useCase.toLowerCase().includes(q))
		);
	});
}

export function sortPrompts(prompts: AiPrompt[], sortKey: PromptSortKey): AiPrompt[] {
	const next = [...prompts];
	if (sortKey === 'name') {
		return next.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
	}
	if (sortKey === 'newest') {
		return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.recommendScore - a.recommendScore);
	}
	return next.sort((a, b) => {
		if (a.featured !== b.featured) return a.featured ? -1 : 1;
		return b.recommendScore - a.recommendScore;
	});
}

export function getRelatedPrompts(prompt: AiPrompt, all = loadPrompts()): AiPrompt[] {
	const bySlug = new Map(all.map((item) => [item.slug, item]));
	const related = prompt.relatedPromptSlugs
		.map((slug) => bySlug.get(slug))
		.filter((item): item is AiPrompt => Boolean(item));
	if (related.length >= 3) return related.slice(0, 4);
	const extras = all.filter(
		(item) => item.slug !== prompt.slug && item.category === prompt.category && !related.some((rel) => rel.slug === item.slug),
	);
	return [...related, ...extras].slice(0, 4);
}

export function filterFavoritePrompts(prompts: AiPrompt[], slugs: readonly string[]): AiPrompt[] {
	const set = new Set(slugs);
	return prompts.filter((prompt) => set.has(prompt.slug));
}
