import {
	firstMatchingPath,
	type CmsAdapter,
	type CmsAdapterContext,
} from '@/lib/solve/adapters/types';
import {
	buildWordpressSchemaEnginePhp,
	extractWordpressSeedsFromCorePhp,
} from '@/lib/solve/wp-schema-engine';

export const WORDPRESS_MU_PLUGIN_RELATIVE_PATH = 'wp-content/mu-plugins/redue-schema.php';

function isWpHeaderTarget(target: string): boolean {
	return /(^|\/)header\.php$/i.test(target) && !/mu-plugins/i.test(target);
}

function isWpFunctionsTarget(target: string): boolean {
	return /(^|\/)functions\.php$/i.test(target) && !/mu-plugins/i.test(target);
}

/**
 * WordPress — Must-Use plugin (theme-independent) preferred.
 * Dedicated `redue_wp_dynamic_schema_controller` on `wp_head` priority 1.
 * Footer scanner + condition tags; no header.php / theme-core edit required.
 */
export const wordpressAdapter: CmsAdapter = {
	id: 'wordpress',
	key: 'wordpress',
	label: 'WordPress',
	strategy: 'wp-mu-plugin',
	engineFilePath: WORDPRESS_MU_PLUGIN_RELATIVE_PATH,
	targetPatterns: [
		/wp-content\/mu-plugins\/redue-schema\.php$/i,
		/wp-content\/mu-plugins\/.+\.php$/i,
		/wp-content\/themes\/(?!twenty)[^/]+\/functions\.php$/i,
		/wp-content\/themes\/[^/]+\/functions\.php$/i,
		/(^|\/)functions\.php$/i,
		/wp-content\/themes\/(?!twenty)[^/]+\/header\.php$/i,
		/wp-content\/themes\/[^/]+\/header\.php$/i,
		/(^|\/)header\.php$/i,
	],
	wrapCoreSnippet(corePhp: string, ctx?: CmsAdapterContext): string {
		const target = String(ctx?.targetPath || '');
		if (isWpHeaderTarget(target)) {
			return corePhp;
		}
		const seeds = extractWordpressSeedsFromCorePhp(corePhp);
		return buildWordpressSchemaEnginePhp({
			...seeds,
			siteName: ctx?.siteName || seeds.siteName,
			targetUrl: ctx?.targetUrl || seeds.targetUrl,
			mode: isWpFunctionsTarget(target) ? 'functions-block' : 'mu-plugin',
		});
	},
	pickTarget(relativePaths: string[]): string | null {
		const mu = firstMatchingPath(relativePaths, [this.targetPatterns[0], this.targetPatterns[1]]);
		if (mu) return mu;
		const hasWp = relativePaths.some((p) => /wp-content|wp-config|wp-includes/i.test(p));
		if (hasWp || relativePaths.length === 0) return WORDPRESS_MU_PLUGIN_RELATIVE_PATH;
		return firstMatchingPath(relativePaths, this.targetPatterns);
	},
};
