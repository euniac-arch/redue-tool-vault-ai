/**
 * Prompt Hub dataset + helpers. Run: npx tsx scripts/test-prompt-hub.ts
 */
import {
	PROMPT_CATEGORIES,
	getPromptBySlug,
	getRelatedPrompts,
	loadPrompts,
	searchPrompts,
	sortPrompts,
} from '../lib/prompt-hub';
import { composeBlueprintPrompt, findPromptForBlueprintTarget } from '../lib/prompt-hub-blueprint';
import { PUBLIC_NAV } from '../lib/nav/public-nav';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const prompts = loadPrompts();
const slugs = new Set(prompts.map((item) => item.slug));

assert('26 prompts loaded', prompts.length === 26, String(prompts.length));
assert('7 categories', PROMPT_CATEGORIES.length === 7, String(PROMPT_CATEGORIES.length));
assert('unique slugs', slugs.size === prompts.length);

const required = ['title', 'category', 'description', 'purpose', 'prompt', 'tags'] as const;
for (const prompt of prompts) {
	for (const key of required) {
		assert(`${prompt.slug} has ${key}`, Boolean(prompt[key] && String(prompt[key]).trim()));
	}
	assert(`${prompt.slug} prompt is substantial`, prompt.prompt.length > 180, String(prompt.prompt.length));
	for (const related of prompt.relatedPromptSlugs) {
		assert(`${prompt.slug} related ${related} exists`, slugs.has(related));
	}
}

assert('geo competitor exists', Boolean(getPromptBySlug('geo-competitor-analysis')));
assert(
	'search finds GEO',
	searchPrompts(prompts, '경쟁사', 'geo').some((item) => item.slug === 'geo-competitor-analysis'),
);
assert('recommended featured first', sortPrompts(prompts, 'recommended')[0].featured === true);
const named = sortPrompts(prompts, 'name');
assert(
	'name sort is korean-stable',
	named[0].title.localeCompare(named[named.length - 1]!.title, 'ko') <= 0,
);

const related = getRelatedPrompts(getPromptBySlug('geo-competitor-analysis')!);
assert('related prompts non-empty', related.length > 0);

const titlePrompt = findPromptForBlueprintTarget('title');
assert('blueprint title mapping exists', titlePrompt?.slug === 'page-seo-improvement');
const composed = composeBlueprintPrompt({
	promptSlug: 'page-seo-improvement',
	target: 'title',
	site: { url: 'https://example.com', siteName: 'Example', industry: 'clinic', location: null },
	keyword: '테스트',
	searchIntent: ['informational'],
	entities: ['Example'],
	currentText: '현재 타이틀',
});
assert('blueprint injection keeps generic prompt', Boolean(composed && composed.includes('온페이지 SEO')));
assert('blueprint injection does not invent location', Boolean(composed && composed.includes('(미추출)')));

const insights = PUBLIC_NAV.find((item) => item.key === 'insightsHub');
assert('GNB still 5 top-level items', PUBLIC_NAV.length === 5, String(PUBLIC_NAV.length));
assert(
	'prompt hub is insights child, not 1-depth',
	Boolean(insights?.children?.some((child) => child.key === 'aiPromptHub')),
);
assert('no new 1-depth prompt key', PUBLIC_NAV.every((item) => item.key !== 'aiPromptHub'));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
