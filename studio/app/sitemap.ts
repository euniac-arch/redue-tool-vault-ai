import type { MetadataRoute } from 'next';
import { REDUE_SITE_ORIGIN } from '@/lib/schema';
import { getPromptHref, loadPrompts } from '@/lib/prompt-hub';

const PUBLIC_PATHS = [
	'/',
	'/audit',
	'/industry',
	'/aeo-geo',
	'/ai-hub',
	'/prompts',
	'/insights',
	'/portfolio',
	'/contact',
	'/audit/history',
	'/strategy',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
	const pages: MetadataRoute.Sitemap = PUBLIC_PATHS.map((path) => ({
		url: `${REDUE_SITE_ORIGIN}${path === '/' ? '/' : path}`,
		changeFrequency: path === '/insights' ? 'daily' : 'weekly',
		priority: path === '/' ? 1 : path === '/industry' || path === '/aeo-geo' ? 0.85 : 0.7,
	}));
	const prompts: MetadataRoute.Sitemap = loadPrompts().map((prompt) => ({
		url: `${REDUE_SITE_ORIGIN}${getPromptHref(prompt.slug)}`,
		changeFrequency: 'monthly',
		priority: 0.6,
	}));
	return [...pages, ...prompts];
}
