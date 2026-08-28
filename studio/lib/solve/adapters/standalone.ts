import {
	ensureMarkerEnvelope,
	firstMatchingPath,
	type CmsAdapter,
	type CmsAdapterContext,
} from '@/lib/solve/adapters/types';

/**
 * Rhymix / XE / standalone PHP — safe include at the top of the common
 * header template (`header.php`, `common/header.php`, layout header).
 */
export const standaloneAdapter: CmsAdapter = {
	id: 'standalone',
	key: 'standalone',
	label: 'Rhymix / XE / Laravel / Standalone PHP',
	strategy: 'header-include-top',
	targetPatterns: [
		/(^|\/)resources\/views\/layouts\/app\.blade\.php$/i,
		/(^|\/)resources\/views\/layouts\/[^/]+\.blade\.php$/i,
		/(^|\/)common\/header\.php$/i,
		/(^|\/)inc\/header\.php$/i,
		/(^|\/)include\/header\.php$/i,
		/(^|\/)layouts\/[^/]+\/header\.php$/i,
		/(^|\/)layouts\/[^/]+\/layout\.php$/i,
		/(^|\/)header\.php$/i,
		/(^|\/)head\.php$/i,
		/(^|\/)common\/tpl\/[^/]+\.php$/i,
		/(^|\/)index\.php$/i,
	],
	wrapCoreSnippet(corePhp: string, _ctx?: CmsAdapterContext): string {
		const body = corePhp.replace(/^<\?php\s*/i, '').replace(/\?>\s*$/i, '').trim();
		const includeGuard = `if ( ! defined('REDUE_STANDALONE_HEADER_INCLUDED') ) {
	define('REDUE_STANDALONE_HEADER_INCLUDED', true);
}
`;
		return ensureMarkerEnvelope(
			`<?php
/* Rhymix / XE / Standalone — 공통 헤더(header.php 등) 최상단 안전 인클루드. 기존 테마 코드는 마커 밖에서 보존. */
${includeGuard}
${body}
`,
			'Standalone adapter — header.php 최상단 · Org+Person+HowTo+FAQ 단일 그래프',
		);
	},
	pickTarget(relativePaths: string[]): string | null {
		return firstMatchingPath(relativePaths, this.targetPatterns);
	},
};
