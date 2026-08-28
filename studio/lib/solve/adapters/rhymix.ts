import {
	ensureMarkerEnvelope,
	firstMatchingPath,
	type CmsAdapter,
	type CmsAdapterContext,
} from '@/lib/solve/adapters/types';

export const RHYMIX_ADDON_RELATIVE_PATH = 'addons/redue_schema/redue_schema.addon.php';

function stripRenderCall(corePhp: string): string {
	return String(corePhp || '')
		.replace(/<\?php\s*\/\*\s*REDUE_AI_STUDIO_RENDER:START[\s\S]*?REDUE_AI_STUDIO_RENDER:END\s*\*\/\s*\?>\s*/gi, '')
		.replace(/\/\*\s*REDUE_AI_STUDIO_RENDER:START[\s\S]*?REDUE_AI_STUDIO_RENDER:END\s*\*\//gi, '');
}

/**
 * Rhymix / XE — addon file. Registers the header block at
 * `called_position === 'before_display_content'` (no theme edit).
 */
export const rhymixAdapter: CmsAdapter = {
	id: 'rhymix',
	key: 'rhymix',
	label: 'Rhymix / XE',
	strategy: 'rhymix-addon',
	engineFilePath: RHYMIX_ADDON_RELATIVE_PATH,
	targetPatterns: [
		/(^|\/)addons\/redue_schema\/redue_schema\.addon\.php$/i,
		/(^|\/)common\/header\.php$/i,
		/(^|\/)layouts\/[^/]+\/layout\.php$/i,
		/(^|\/)header\.php$/i,
	],
	wrapCoreSnippet(corePhp: string, _ctx?: CmsAdapterContext): string {
		const body = stripRenderCall(corePhp)
			.replace(/^<\?php\s*/i, '')
			.replace(/\?>\s*$/i, '')
			.trim();
		const boot = `
if ( ! defined('__XE__') && ! defined('RX_VERSION') ) {
	return;
}
${body}
if ( ! function_exists( 'redue_rhymix_echo_schema' ) ) {
	function redue_rhymix_echo_schema() {
		if ( function_exists( 'redue_render_full_schema' ) ) {
			return redue_render_full_schema();
		}
		if ( function_exists( 'redue_dynamic_schema_controller' ) ) {
			ob_start();
			redue_dynamic_schema_controller();
			$out = ob_get_clean();
			return is_string( $out ) ? $out : '';
		}
		return '';
	}
}
if ( isset( $called_position ) && $called_position === 'before_display_content' ) {
	if ( class_exists( 'Context' ) && Context::getResponseMethod() === 'HTML' ) {
		Context::addHtmlHeader( redue_rhymix_echo_schema() );
	}
}
`;
		return ensureMarkerEnvelope(
			`<?php
${boot}
`,
			'Rhymix adapter — addons/redue_schema · before_display_content 헤더 등록',
		);
	},
	pickTarget(relativePaths: string[]): string | null {
		const addon = firstMatchingPath(relativePaths, [this.targetPatterns[0]]);
		if (addon) return addon;
		return RHYMIX_ADDON_RELATIVE_PATH;
	},
};
