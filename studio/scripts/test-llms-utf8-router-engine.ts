/**
 * GnuBoard5 llms.php UTF-8 router + .htaccess rewrite patch — idempotence checks.
 * Run: npx tsx scripts/test-llms-utf8-router-engine.ts
 */
import {
	LLMS_PHP_ROUTER_RELATIVE_PATH,
	LLMS_UTF8_ROUTER_VERSION,
	applyLlmsRouterHtaccessPatch,
	buildLlmsHtaccessRewriteBlock,
	buildLlmsUtf8RouterPhp,
	isLlmsUtf8RouterCurrent,
} from '../lib/solve/llms-utf8-router-engine';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(LLMS_PHP_ROUTER_RELATIVE_PATH === 'llms.php', 'router relative path');

const php = buildLlmsUtf8RouterPhp();
assert(php.startsWith('<?php'), 'php opens with tag');
assert(php.includes(`REDUE_LLMS_UTF8_ROUTER_v${LLMS_UTF8_ROUTER_VERSION}`), 'php carries version marker');
assert(php.includes("header( 'Content-Type: text/plain; charset=utf-8' )"), 'forces utf-8 content-type');
assert(php.includes("header( 'Cache-Control: no-cache, must-revalidate' )"), 'no-cache header');
assert(php.includes('$_SERVER[\'REQUEST_URI\']'), 'reads REQUEST_URI');
assert(php.includes("strpos( $redue_llms_uri, 'llms-full' )"), 'selects llms-full.txt by uri');
assert(php.includes("mb_detect_encoding("), 'detects source encoding');
assert(php.includes("mb_convert_encoding("), 'converts non-utf8 to utf-8');
assert(php.includes("'EUC-KR'") && php.includes("'CP949'"), 'covers Korean legacy charsets');
assert(php.includes('http_response_code( 404 )'), '404 fallback when file missing');
assert(php.includes('exit;'), 'exits after streaming');
assert(buildLlmsUtf8RouterPhp() === php, 'pure function — deterministic output');

assert(isLlmsUtf8RouterCurrent(php), 'freshly generated router self-reports current');
assert(!isLlmsUtf8RouterCurrent('<?php echo "old";'), 'unrelated content is not current');
assert(!isLlmsUtf8RouterCurrent(''), 'empty remote file is not current');

const block = buildLlmsHtaccessRewriteBlock();
assert(block.includes('RewriteRule ^llms\\.txt$ llms.php [L]'), 'rewrites llms.txt');
assert(block.includes('RewriteRule ^llms-full\\.txt$ llms.php [L]'), 'rewrites llms-full.txt');
assert(block.includes("AddType 'text/plain; charset=UTF-8' .txt"), 'AddType fallback for .txt');
assert(block.startsWith('# BEGIN REDUE LLMS UTF-8 Router'), 'begin marker');
assert(block.trim().endsWith('# END REDUE LLMS UTF-8 Router'), 'end marker');

// Fresh .htaccess (no existing content) — block gets inserted, changed=true.
const fresh = applyLlmsRouterHtaccessPatch('');
assert(fresh.changed, 'fresh htaccess is changed');
assert(fresh.content.includes(block), 'fresh htaccess contains full block');

// Existing .htaccess with unrelated CMS rules — block is prepended, ahead of the WordPress catch-all.
const wpHtaccess = `# BEGIN WordPress\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteRule . /index.php [L]\n</IfModule>\n# END WordPress\n`;
const withRouter = applyLlmsRouterHtaccessPatch(wpHtaccess);
assert(withRouter.changed, 'wp htaccess gets the block appended');
assert(withRouter.content.indexOf('REDUE LLMS UTF-8 Router') < withRouter.content.indexOf('BEGIN WordPress'), 'llms block precedes WordPress catch-all so [L] wins first');
assert(withRouter.content.includes('RewriteRule . /index.php [L]'), 'original WordPress rules preserved');

// Re-running against the already-patched .htaccess must be a true no-op (idempotence).
const reapplied = applyLlmsRouterHtaccessPatch(withRouter.content);
assert(!reapplied.changed, 'second run on already-patched htaccess is a no-op');
assert(reapplied.content === withRouter.content, 'content is byte-identical on re-run');

// A stale/older marked block gets refreshed in place without disturbing surrounding content.
const staleBlock = '# BEGIN REDUE LLMS UTF-8 Router (REDUE_LLMS_UTF8_ROUTER_v0.0.1)\nold stale rule\n# END REDUE LLMS UTF-8 Router';
const staleHtaccess = `${staleBlock}\n\n# BEGIN WordPress\nkeep me\n# END WordPress\n`;
const refreshed = applyLlmsRouterHtaccessPatch(staleHtaccess);
assert(refreshed.changed, 'stale marker version gets refreshed');
assert(refreshed.content.includes(block), 'refreshed content carries the current block');
assert(!refreshed.content.includes('old stale rule'), 'stale rule body is removed');
assert(refreshed.content.includes('keep me'), 'unrelated WordPress content untouched');

console.log('OK llms-utf8-router-engine', {
	version: LLMS_UTF8_ROUTER_VERSION,
	phpBytes: Buffer.byteLength(php),
	htaccessBlockBytes: Buffer.byteLength(block),
});
