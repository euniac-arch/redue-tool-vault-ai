/**
 * Public "AI 허브" (AI Hub) — user-facing helpers built on top of the shared
 * `aiToolsData.json` dataset. Only tools with `is_public === true` (including
 * any locally persisted admin visibility overrides) are ever exposed here;
 * categories that end up with zero public tools are dropped entirely so the
 * front-end never renders an empty tab or section.
 */

import {
	AI_TOOL_CATEGORIES,
	loadAiTools,
	sortAiTools,
	type AiTool,
	type AiToolCategoryId,
	type AiToolSortKey,
} from '@/lib/admin/ai-tools-management';

export type { AiTool, AiToolCategoryId, AiToolSortKey } from '@/lib/admin/ai-tools-management';
export { AI_TOOL_SORT_OPTIONS } from '@/lib/admin/ai-tools-management';

/** Compact pill labels for the front-end category tabs (shorter than the full admin category_name). */
const CATEGORY_TAB_LABEL: Record<AiToolCategoryId, string> = {
	llm: '대화형 AI',
	image: '이미지',
	video: '비디오',
	audio: '음성/음악',
	code: '코딩',
	hub: '올인원 허브',
};

export type AiHubCategory = {
	id: AiToolCategoryId;
	label: string;
	icon: string;
};

export function loadPublicAiTools(): AiTool[] {
	return loadAiTools().filter((tool) => tool.is_public);
}

/** Categories that still have at least one public tool, in dataset order, with compact tab labels. */
export function getPublicAiHubCategories(tools: AiTool[]): AiHubCategory[] {
	const presentIds = new Set(tools.map((tool) => tool.category));
	return AI_TOOL_CATEGORIES.filter((category) => presentIds.has(category.id)).map((category) => ({
		id: category.id,
		label: CATEGORY_TAB_LABEL[category.id] ?? category.label,
		icon: category.icon,
	}));
}

export function searchPublicAiTools(
	tools: AiTool[],
	query: string,
	category: 'all' | AiToolCategoryId,
): AiTool[] {
	const q = query.trim().toLowerCase();
	return tools.filter((tool) => {
		if (category !== 'all' && tool.category !== category) return false;
		if (!q) return true;
		return (
			tool.name.toLowerCase().includes(q) ||
			tool.provider.toLowerCase().includes(q) ||
			tool.desc.toLowerCase().includes(q) ||
			tool.tags.some((tag) => tag.toLowerCase().includes(q))
		);
	});
}

/** A category tab paired with its own search-filtered, sorted list of public tools. */
export type AiHubProcessedCategory = AiHubCategory & { tools: AiTool[] };

/**
 * Groups public tools by category (search-filtered, sorted within each category), dropping
 * any category left with zero matching tools. Powers the "카테고리별 섹션 + 카테고리 내 순위 뱃지"
 * layout on the public AI Hub page — ranking is always computed per-category, not globally.
 */
export function getProcessedPublicCategories(
	tools: AiTool[],
	query: string,
	sortKey: AiToolSortKey,
): AiHubProcessedCategory[] {
	const q = query.trim().toLowerCase();
	return getPublicAiHubCategories(tools)
		.map((category) => {
			let categoryTools = tools.filter((tool) => tool.category === category.id);
			if (q) {
				categoryTools = categoryTools.filter(
					(tool) =>
						tool.name.toLowerCase().includes(q) ||
						tool.provider.toLowerCase().includes(q) ||
						tool.desc.toLowerCase().includes(q) ||
						tool.tags.some((tag) => tag.toLowerCase().includes(q)),
				);
			}
			return { ...category, tools: sortAiTools(categoryTools, sortKey) };
		})
		.filter((category) => category.tools.length > 0);
}
