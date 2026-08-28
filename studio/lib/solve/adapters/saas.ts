import { firstMatchingPath, type CmsAdapter, type CmsAdapterContext } from '@/lib/solve/adapters/types';
import { buildSaasSchemaInjectorSnippet } from '@/lib/solve/universal-geo-engine';

/**
 * Cafe24 / Imweb / Godomall / Makeshop / static HTML — no filesystem PHP execution.
 * Emit a self-contained client-side Schema Injector for the hosting panel
 * "Header Code / Custom Code" field. The browser crawls the footer DOM and
 * injects Organization + WebSite + WebPage + BreadcrumbList + Person JSON-LD.
 */
export const saasAdapter: CmsAdapter = {
	id: 'saas',
	key: 'saas',
	label: 'Cafe24 / Imweb / SaaS',
	strategy: 'saas-static-html',
	targetPatterns: [
		/(^|\/)layout\/basic\/layout\.html$/i,
		/(^|\/)layout\.html$/i,
		/(^|\/)index\.html$/i,
		/(^|\/)header\.html$/i,
	],
	wrapCoreSnippet(corePhp: string, ctx?: CmsAdapterContext): string {
		const raw = String(corePhp || '').trim();
		if (
			raw &&
			!/^\s*<\?php/i.test(raw) &&
			/__REDUE_SCHEMA_INJECTED__|window\.REDUE_CONFIG/.test(raw)
		) {
			return raw;
		}
		return buildSaasSchemaInjectorSnippet({
			name: ctx?.siteName || '',
		});
	},
	pickTarget(relativePaths: string[]): string | null {
		return firstMatchingPath(relativePaths, this.targetPatterns);
	},
};
