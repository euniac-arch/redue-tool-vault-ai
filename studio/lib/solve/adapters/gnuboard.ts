import {
	ensureMarkerEnvelope,
	firstMatchingPath,
	stripImmediateControllerCall,
	type CmsAdapter,
	type CmsAdapterContext,
} from '@/lib/solve/adapters/types';
import { buildPhpDualCatchClause, sanitizeGeneratedPhpSnippet, sanitizePhpCode } from '@/lib/solve/php-sanitize';
import {
	REDUE_SCHEMA_RENDER_MARKER_END,
	REDUE_SCHEMA_RENDER_MARKER_START,
} from '@/lib/solve/dynamic-php-schema';

/** GnuBoard auto-loads every `*.php` under `/extend/` from `common.php`. */
export const GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH = 'extend/redue.schema.php';

/**
 * Admin CSRF / POST 500 guard — must stay at the very top of the extend file
 * so schema rendering never runs during 관리자 환경설정 저장 or any POST.
 */
export function buildGnuboardAdminPostGuardPhp(): string {
	return `if (!defined('_GNUBOARD_')) exit;
if (defined('G5_IS_ADMIN') && G5_IS_ADMIN) return;
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') return;
`;
}

/**
 * `extend/*.php` is auto-included from `common.php` — never call the llms
 * endpoint (header/exit) unless the request is clearly `/llms.txt`.
 */
export function buildGnuboardLlmsBootHookPhp(): string {
	return `if (defined('G5_IS_ADMIN') && G5_IS_ADMIN) return;
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') return;
if (!empty($_GET['redue_llms']) || (isset($_SERVER['REQUEST_URI']) && preg_match('#/llms(-full)?\\.txt#i', $_SERVER['REQUEST_URI']))) {
	try {
		if (function_exists('redue_llms_maybe_serve')) {
			redue_llms_maybe_serve();
		}
	} ${buildPhpDualCatchClause('$_redue_extend_boot')}
}
`;
}

function stripRenderCallBlock(php: string): string {
	return String(php || '')
		.replace(/<\?php\s*\/\*\s*REDUE_AI_STUDIO_RENDER:START[\s\S]*?REDUE_AI_STUDIO_RENDER:END\s*\*\/\s*\?>\s*/gi, '')
		.replace(/\/\*\s*REDUE_AI_STUDIO_RENDER:START[\s\S]*?REDUE_AI_STUDIO_RENDER:END\s*\*\//gi, '');
}

function unwrapPhp(php: string): string {
	return stripRenderCallBlock(php)
		.replace(/^<\?php\s*/i, '')
		.replace(/\?>\s*$/i, '')
		.replace(/if\s*\(\s*!\s*defined\s*\(\s*['"]_GNUBOARD_['"]\s*\)\s*\)\s*(?:exit|die)\s*(?:\(\s*\))?\s*;\s*/i, '')
		.trim();
}

/** 5-line charset-after render call — the only REDUE block allowed in head.sub.php. */
export function buildGnuboardHeadRenderCallBlock(): string {
	return sanitizePhpCode(`<?php
/* ${REDUE_SCHEMA_RENDER_MARKER_START} */
if (function_exists('redue_render_full_schema')) {
    echo redue_render_full_schema();
}
/* ${REDUE_SCHEMA_RENDER_MARKER_END} */
?>`);
}

/** Full `/extend/redue.schema.php` — 공통 엔진 100% 덮어쓰기 + 관리자·POST 가드, no echo. */
export function buildGnuboardExtendEngineFile(corePhp: string): string {
	const body = stripImmediateControllerCall(unwrapPhp(corePhp));
	const wrapped = ensureMarkerEnvelope(
		`<?php
${body}
`,
		'GnuBoard / YoungCart extend/redue.schema.php · Universal 5-core · No-Fake-Data · 관리자·POST 가드',
	);
	const inner = wrapped.replace(/^<\?php\s*/i, '').replace(/\?>\s*$/i, '').trim();
	return sanitizeGeneratedPhpSnippet(`<?php
${buildGnuboardAdminPostGuardPhp()}
${inner}
${buildGnuboardLlmsBootHookPhp()}
`);
}

/**
 * GnuBoard / YoungCart — engine lives in `/extend/redue.schema.php` (auto-loaded).
 * `head.sub.php` only receives the 5-line charset-after render call.
 * Admin/POST guards in the extend file keep 관리자 CSRF tokens intact.
 */
export const gnuboardAdapter: CmsAdapter = {
	id: 'gnuboard',
	key: 'gnuboard',
	label: 'GnuBoard / YoungCart',
	strategy: 'extend-file-head-render',
	engineFilePath: GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH,
	targetPatterns: [
		/(^|\/)theme\/(?!basic\/)[^/]+\/head\.sub\.php$/i,
		/(^|\/)theme\/basic\/head\.sub\.php$/i,
		/(^|\/)head\.sub\.php$/i,
		/(^|\/)head\.php$/i,
	],
	wrapCoreSnippet(corePhp: string, _ctx?: CmsAdapterContext): string {
		return buildGnuboardExtendEngineFile(corePhp);
	},
	pickTarget(relativePaths: string[]): string | null {
		return firstMatchingPath(relativePaths, this.targetPatterns);
	},
};
