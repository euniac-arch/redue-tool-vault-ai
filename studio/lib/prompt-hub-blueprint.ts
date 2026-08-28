/**
 * Future bridge between the public Prompt Hub and Execution Blueprint AI refine.
 *
 * Current Execution Blueprint "AI 개선" (`StrategyAiRefineButton` → `/api/strategy/copilot`)
 * is site-specific and must stay untouched. This module only documents how a generic
 * hub prompt can later be hydrated with audit + keyword + entity + page-type context.
 *
 * Do not import this from Strategy UI until a dedicated product decision wires it.
 */

import { getPromptBySlug, loadPrompts, type AiPrompt } from '@/lib/prompt-hub';
import type { CopilotRefineTarget } from '@/lib/strategy/types';

export type BlueprintPromptInjection = {
	promptSlug: string;
	target?: CopilotRefineTarget;
	site: {
		url: string;
		siteName: string;
		industry: string;
		location: string | null;
		pageType?: string;
	};
	keyword: string;
	searchIntent: string[];
	entities: string[];
	currentText: string;
};

/** Resolve a generic hub prompt that is tagged for a Blueprint refine target. */
export function findPromptForBlueprintTarget(target: CopilotRefineTarget): AiPrompt | null {
	return loadPrompts().find((prompt) => prompt.blueprintTarget === target) ?? null;
}

/**
 * Compose a site-specific prompt from a hub template.
 * Placeholders stay visible when a field is empty — never invent site facts.
 */
export function injectBlueprintContext(basePrompt: string, ctx: BlueprintPromptInjection): string {
	const location = ctx.site.location?.trim() || '(미추출)';
	const pageType = ctx.site.pageType?.trim() || '(미지정)';
	const intents = ctx.searchIntent.filter(Boolean).join(', ') || '(미지정)';
	const entities = ctx.entities.filter(Boolean).join(', ') || '(미추출)';
	const current = ctx.currentText.trim() || '(없음)';

	return [
		basePrompt.trim(),
		'',
		'---',
		'사이트 컨텍스트 (REDUE 진단 연동 — 확인된 값만)',
		`URL: ${ctx.site.url || '(없음)'}`,
		`사이트명: ${ctx.site.siteName || '(없음)'}`,
		`업종: ${ctx.site.industry || '(없음)'}`,
		`지역: ${location}`,
		`페이지 유형: ${pageType}`,
		`타깃 키워드: ${ctx.keyword || '(없음)'}`,
		`검색 의도: ${intents}`,
		`Entity: ${entities}`,
		`현재 항목 텍스트: ${current}`,
		ctx.target ? `Blueprint 항목: ${ctx.target}` : '',
	]
		.filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
		.join('\n')
		.trim();
}

export function composeBlueprintPrompt(ctx: BlueprintPromptInjection): string | null {
	const prompt = getPromptBySlug(ctx.promptSlug);
	if (!prompt) return null;
	return injectBlueprintContext(prompt.prompt, ctx);
}
