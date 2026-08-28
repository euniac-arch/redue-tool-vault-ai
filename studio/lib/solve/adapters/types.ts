import {
	REDUE_SCHEMA_MARKER_END,
	REDUE_SCHEMA_MARKER_START,
} from '@/lib/solve/dynamic-php-schema';

export type CmsAdapterId = 'gnuboard' | 'wordpress' | 'rhymix' | 'saas' | 'standalone';

export type CmsInjectionStrategy =
	| 'extend-file-head-render'
	| 'wp-mu-plugin'
	| 'rhymix-addon'
	| 'saas-static-html'
	| 'marker-block-head-sub'
	| 'wp-head-functions'
	| 'header-include-top';

export type CmsAdapterContext = {
	cmsType?: string;
	targetPath?: string;
	siteName?: string;
	targetUrl?: string;
};

export type CmsWriteMode = 'create' | 'patch-render-only' | 'patch-inject';

export type CmsWritePlan = {
	relativePath: string;
	mode: CmsWriteMode;
	content: string;
	description: string;
};

export interface CmsAdapter {
	id: CmsAdapterId;
	/** Solve tab / displayCmsToKey value. */
	key: string;
	label: string;
	strategy: CmsInjectionStrategy;
	/** Independent engine file (extend / mu-plugin / addon). */
	engineFilePath?: string;
	/** Preferred inject files, highest first. */
	targetPatterns: RegExp[];
	wrapCoreSnippet(corePhp: string, ctx?: CmsAdapterContext): string;
	pickTarget(relativePaths: string[]): string | null;
}

export function normalizeRelPath(p: string): string {
	return String(p || '')
		.replace(/\\/g, '/')
		.replace(/^\/+/, '');
}

export function firstMatchingPath(paths: string[], patterns: RegExp[]): string | null {
	const normalized = paths.map(normalizeRelPath);
	for (const re of patterns) {
		const hit = normalized.find((p) => re.test(p));
		if (hit) return hit;
	}
	return null;
}

/** Keep a single REDUE marker envelope around adapter-wrapped PHP. */
export function ensureMarkerEnvelope(php: string, banner: string): string {
	const body = php
		.replace(/<\?php\s*/i, '')
		.replace(/\?>\s*$/i, '')
		.replace(
			new RegExp(`/\\*\\s*${REDUE_SCHEMA_MARKER_START}[\\s\\S]*?\\*/\\s*`, 'i'),
			'',
		)
		.replace(new RegExp(`/\\*\\s*${REDUE_SCHEMA_MARKER_END}\\s*\\*/\\s*`, 'i'), '')
		.trim();
	return `<?php
/* ${REDUE_SCHEMA_MARKER_START} — ${banner} */
${body}
/* ${REDUE_SCHEMA_MARKER_END} */
?>`;
}

/** Replace a bare controller() call; leave add_action('…', 'controller') untouched. */
export function stripImmediateControllerCall(php: string): string {
	return php
		.replace(/(^|\n)[ \t]*redue_dynamic_schema_controller\s*\(\s*\)\s*;[ \t]*/g, '$1')
		.replace(/(^|\n)[ \t]*redue_wp_dynamic_schema_controller\s*\(\s*\)\s*;[ \t]*/g, '$1')
		.replace(/(^|\n)[ \t]*redue_llms_boot\s*\(\s*\)\s*;[ \t]*/g, '$1')
		.replace(
			/(^|\n)[ \t]*if\s*\(\s*function_exists\s*\(\s*['"]redue_llms_boot['"]\s*\)\s*\)\s*\{\s*redue_llms_boot\s*\(\s*\)\s*;\s*\}[ \t]*/g,
			'$1',
		);
}
