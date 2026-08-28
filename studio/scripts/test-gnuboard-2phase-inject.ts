/**
 * GnuBoard extend-file + lightweight head.sub.php inject:
 *  - engine lives in /extend/redue.schema.php (admin/POST guards)
 *  - head.sub.php only gets the 5-line charset-after render call
 *  - theme files never receive G5_THEME_PATH + return;
 *  - NBSP / zero-width chars are stripped before write
 *
 * Run: npx tsx scripts/test-gnuboard-2phase-inject.ts
 */
import {
	applyCmsAdapterWrap,
	buildGnuboardExtendEngineFile,
	planCmsInjection,
	GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH,
} from '../lib/solve/adapters';
import { buildGnuboardAutomatedRuntimeEnginePhp } from '../lib/solve/dynamic-php-schema';
import {
	buildGnuboardLegacyCompatPhp,
	buildPhpDualCatchClause,
	cleanPhpTemplate,
	guardRunReplaceCalls,
	healGnuboardHeadSubSource,
	isGnuboardThemeRelativePath,
	normalizePhpExceptionGuards,
	sanitizeGeneratedPhpSnippet,
	sanitizePhpCode,
	sanitizePhpForDeploy,
	stripGnuboardThemeSelfDelegation,
	toUtf8WithoutBom,
} from '../lib/solve/php-sanitize';
import { injectBeforeClosingHead } from '../lib/solve/source-mapping';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const THEME_STUB = `if (defined('G5_THEME_PATH')) {
    $theme_head_file = G5_THEME_PATH.'/'.basename(__FILE__);
    if(is_file($theme_head_file)) {
        include_once($theme_head_file);
        return;
    }
    unset($theme_head_file);
}`;

const THEME_ONELINER =
	"if (is_file(G5_THEME_PATH.'/head.sub.php')) { require_once(G5_THEME_PATH.'/head.sub.php'); return; }";

const themeHead = `<?php
if (!defined('_GNUBOARD_')) exit;
${THEME_STUB}
?>
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<link rel="canonical" href="https://old.example/">
<meta property="og:url" content="https://old.example/">
<?php
/* REDUE_AI_STUDIO_RENDER:START */
echo 'stale-render';
/* REDUE_AI_STUDIO_RENDER:END */
?>
<title>gentlelee</title>
<link rel="stylesheet" href="<?php echo G5_THEME_URL; ?>/css/default.css">
<script src="<?php echo G5_THEME_URL; ?>/js/theme.js"></script>
</head>
<body>원본 레이아웃</body>
</html>`;

const rootHead = `<?php
if (!defined('_GNUBOARD_')) exit;
${THEME_STUB}
?>
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>root</title>
</head>
</html>`;

const engine = applyCmsAdapterWrap(
	buildGnuboardAutomatedRuntimeEnginePhp({
		siteName: '젠틀리의원',
		industryType: 'MEDICAL',
		representativeName: '이원장',
	}),
	'Gnuboard',
	'theme/hospital/head.sub.php',
);

assert(isGnuboardThemeRelativePath('theme/hospital/head.sub.php'), 'theme path detect');
assert(!isGnuboardThemeRelativePath('head.sub.php'), 'root path is not theme');
assert(!/G5_THEME_PATH/.test(engine) || !/\breturn\s*;/.test(engine) || !/require_once\s*\(\s*G5_THEME_PATH/.test(engine), 'engine snippet has no theme dispatcher');
assert(!/require_once\s*\(\s*G5_THEME_PATH/.test(engine), 'engine never require_once G5_THEME_PATH');
assert(!/include_once\s*\(\s*\$theme_head_file/.test(engine), 'engine never include theme head stub');

assert(sanitizePhpCode('a\u00A0b') === 'a b', 'sanitizePhpCode NBSP → space');
assert(cleanPhpTemplate('a\u00A0b') === 'a b', 'NBSP → space');
assert(sanitizePhpCode('a&nbsp;b') === 'a b', 'HTML &nbsp; → space');
assert(sanitizePhpCode('a\xC2\xA0b') === 'a b', 'UTF-8 C2 A0 mojibake → space');
assert(!sanitizePhpCode('x\u200B\uFEFFy').includes('\u200B'), 'zero-width stripped');
assert(sanitizePhpCode('\uFEFFphp') === 'php', 'leading BOM stripped');
assert(toUtf8WithoutBom('\uFEFFx') === 'x', 'toUtf8WithoutBom drops U+FEFF');
assert(sanitizePhpCode('a\r\nb') === 'a\nb', 'CRLF → LF');
assert(sanitizePhpCode === cleanPhpTemplate, 'cleanPhpTemplate aliases sanitizePhpCode');
assert(
	buildPhpDualCatchClause('$_e') === 'catch (\\Exception $_e) {} catch (\\Throwable $_e) {}',
	'dual catch clause uses global Exception then Throwable',
);
assert(
	normalizePhpExceptionGuards('try{}catch (Throwable $e){}').includes('catch (\\Exception $e) {} catch (\\Throwable $e)'),
	'bare Throwable → dual catch',
);
assert(
	!/catch\s*\(\s*Throwable\s/.test(normalizePhpExceptionGuards('try{}catch (Throwable $e){}')),
	'no namespaceless Throwable remains',
);
const alreadyDual = 'try{}catch (\\Exception $e) {} catch (\\Throwable $e) {}';
assert(normalizePhpExceptionGuards(alreadyDual) === alreadyDual, 'dual catch is idempotent');
assert(
	sanitizePhpCode('try { foo(); } catch (Throwable $_redue_schema_err) {}').includes(
		'catch (\\Exception $_redue_schema_err) {} catch (\\Throwable $_redue_schema_err)',
	),
	'sanitizePhpCode last-mile Exception Guard',
);

const wrappedCall = guardRunReplaceCalls("$x = run_replace('html_process', $x);");
assert(wrappedCall.includes("function_exists('run_replace')"), 'wraps bare run_replace');
assert(wrappedCall.includes("run_replace('html_process', $x)"), 'keeps original call');
assert(wrappedCall.includes(': $x)'), 'fallback is 2nd argument');
const alreadyGuarded = "(function_exists('run_replace') ? run_replace('hook', $y) : $y)";
assert(
	guardRunReplaceCalls(alreadyGuarded) === alreadyGuarded,
	'does not double-wrap guarded run_replace',
);
const quoted = "echo 'run_replace(\"hook\", $x)';";
assert(guardRunReplaceCalls(quoted) === quoted, 'does not wrap run_replace inside a string');
const compat = buildGnuboardLegacyCompatPhp();
assert(/function\s+run_replace\s*\(/.test(compat), 'polyfill defines run_replace');
assert(/function\s+run_event\s*\(/.test(compat), 'polyfill defines run_event');
assert(
	!/\(\s*function_exists\(\s*'run_replace'\s*\)\s*\?\s*run_replace\s*\(/.test(guardRunReplaceCalls(compat)),
	'polyfill definition is not rewritten as a call',
);
assert(/function_exists\(\s*'run_replace'\s*\)/.test(engine), 'engine ships run_replace polyfill');
assert(/function\s+run_event\s*\(/.test(engine), 'engine ships run_event polyfill');
assert(/G5_IS_ADMIN/.test(engine), 'extend file admin guard');
assert(/REQUEST_METHOD/.test(engine) && /POST/.test(engine), 'extend file POST guard');
assert(engine.indexOf("_GNUBOARD_") < engine.indexOf('REDUE_AI_STUDIO:START'), 'guard before engine');
assert(!/echo redue_render_full_schema/.test(engine), 'extend file does not echo');
assert(
	!sanitizeGeneratedPhpSnippet('a\u00A0run_replace(\'h\', $v)').includes('\u00A0'),
	'snippet sanitizer strips NBSP and guards run_replace',
);
assert(
	sanitizeGeneratedPhpSnippet("$v = run_replace('h', $v);").includes("function_exists('run_replace')"),
	'snippet sanitizer guards run_replace',
);

const poisoned = `<?php
if (!defined('_GNUBOARD_')) exit;
${THEME_ONELINER}
// comment\u00A0with\u00A0nbsp
?>
<!doctype html>
<head>
<meta charset="utf-8">
</head>`;
const healed = healGnuboardHeadSubSource(poisoned, 'theme/gentlelee/head.sub.php');
assert(!healed.includes('\u00A0'), 'heal strips NBSP');
assert(!/require_once\s*\(\s*G5_THEME_PATH/.test(healed), 'heal strips one-liner dispatcher');
assert(healed.includes("if (!defined('_GNUBOARD_')) exit;"), 'heal keeps gnuboard guard');
assert(healed.includes('<meta charset="utf-8">'), 'heal keeps charset');

const keptRoot = healGnuboardHeadSubSource(rootHead, 'head.sub.php');
assert(/include_once\(\$theme_head_file\)/.test(keptRoot), 'root heal keeps official dispatcher');

const stripped = stripGnuboardThemeSelfDelegation(themeHead);
assert(!/include_once\(\$theme_head_file\)/.test(stripped), 'strip official nested stub');
assert(stripped.includes('G5_THEME_URL'), 'strip does not touch G5_THEME_URL assets');

const themeInjected = injectBeforeClosingHead(themeHead, engine, {
	targetPath: 'theme/hospital/head.sub.php',
});
assert(themeInjected.ok, 'theme inject ok');
assert(!/include_once\(\$theme_head_file\)/.test(themeInjected.result), 'theme result has no self-include');
assert(!/is_file\(\$theme_head_file\)/.test(themeInjected.result), 'theme result has no is_file($theme_head_file)');
assert(!/require_once\s*\(\s*G5_THEME_PATH/.test(themeInjected.result), 'theme result has no G5_THEME_PATH require');
assert(themeInjected.result.includes('G5_THEME_URL'), 'theme CSS/JS url preserved');
assert(themeInjected.result.includes('css/default.css'), 'theme stylesheet preserved');
assert(themeInjected.result.includes('js/theme.js'), 'theme script preserved');
assert(themeInjected.result.includes('원본 레이아웃'), 'theme body preserved');
assert(themeInjected.result.includes('<title>gentlelee</title>'), 'theme title preserved');
assert(!themeInjected.result.includes('\u00A0'), 'theme result has no NBSP');
assert(!themeInjected.result.includes('https://old.example/'), 'stale canonical/og:url removed');
assert(!themeInjected.result.includes("echo 'stale-render'"), 'stale render block removed');
assert((themeInjected.result.match(/REDUE_AI_STUDIO_RENDER:START/g) || []).length === 1, 'exactly one standard render block');
assert(
	/if \(function_exists\('redue_render_full_schema'\)\) \{\s*echo redue_render_full_schema\(\);/m.test(themeInjected.result),
	'standard render call only',
);

const doctypeIdx = themeInjected.result.indexOf('<!doctype html>');
const charsetIdx = themeInjected.result.indexOf('charset="utf-8"');
const renderIdx = themeInjected.result.indexOf('REDUE_AI_STUDIO_RENDER:START');
assert(!themeInjected.result.includes('REDUE_AI_STUDIO:START'), 'head.sub.php has no inlined engine');
assert(charsetIdx >= 0 && charsetIdx < renderIdx, 'render after charset');
assert(themeInjected.result.includes('echo redue_render_full_schema();'), 'phase2 echo');
const preDoctype = themeInjected.result.slice(0, doctypeIdx);
assert(!preDoctype.includes('echo redue_render_full_schema()'), 'no echo before doctype');
assert(!preDoctype.includes('function redue_render_full_schema'), 'no engine fn before doctype');

const again = injectBeforeClosingHead(themeInjected.result, engine, {
	targetPath: 'theme/hospital/head.sub.php',
});
const startCount = (again.result.match(/REDUE_AI_STUDIO:START/g) || []).length;
const renderCount = (again.result.match(/REDUE_AI_STUDIO_RENDER:START/g) || []).length;
assert(startCount === 0, `head stays engine-free (got ${startCount})`);
assert(renderCount === 1, `idempotent render block (got ${renderCount})`);

const planned = planCmsInjection({
	cmsType: 'Gnuboard',
	corePhp: engine,
	headerPath: 'theme/hospital/head.sub.php',
});
assert(planned[0]?.relativePath === GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH, 'plan writes extend file');
assert(/G5_IS_ADMIN/.test(buildGnuboardExtendEngineFile(engine)), 'builder keeps admin guard');
assert(
	!/function_exists\s*\(\s*['"]redue_llms_boot['"]\s*\)\s*\)\s*\{\s*redue_llms_boot/.test(planned[0]?.content || ''),
	'extend does not call redue_llms_boot at include',
);
assert(/catch\s*\(\s*\\Exception/.test(planned[0]?.content || ''), 'extend dual-catch Exception');
assert(/catch\s*\(\s*\\Throwable/.test(planned[0]?.content || ''), 'extend dual-catch Throwable');
assert(!/catch\s*\(\s*Throwable\s/.test(planned[0]?.content || ''), 'extend has no bare Throwable');
assert(
	/\$_GET\s*\[\s*['"]redue_llms['"]\s*\]/.test(planned[0]?.content || ''),
	'extend llms hook requires GET redue_llms',
);
assert(
	/llms\(-full\)\?\\.txt/.test(planned[0]?.content || ''),
	'extend llms hook requires /llms.txt route',
);
assert(
	/if\s*\(\s*!empty\s*\(\s*\$_GET\s*\[\s*['"]redue_llms['"]/.test(planned[0]?.content || ''),
	'extend llms serve is gated on GET or /llms.txt',
);
const lastMile = sanitizePhpCode(`try {
	if (function_exists('redue_llms_maybe_serve')) { redue_llms_maybe_serve(); }
} catch (Throwable $_redue_extend_boot) {}`);
assert(/\$_GET\s*\[\s*['"]redue_llms['"]\s*\]/.test(lastMile), 'last-mile rewrites unguarded llms serve');
assert(/catch\s*\(\s*\\Exception/.test(lastMile) && /catch\s*\(\s*\\Throwable/.test(lastMile), 'last-mile dual catch');

const rootInjected = injectBeforeClosingHead(rootHead, engine, { targetPath: 'head.sub.php' });
assert(rootInjected.ok, 'root inject ok');
assert(/include_once\(\$theme_head_file\)/.test(rootInjected.result), 'root keeps official dispatcher');
assert(rootInjected.result.includes('echo redue_render_full_schema();'), 'root still gets phase2 echo');

const nbspSource = themeHead.replace('charset="utf-8"', 'charset="utf-8"\u00A0');
const nbspInjected = injectBeforeClosingHead(nbspSource, `${engine}\u00A0`, {
	targetPath: 'theme/basic/head.sub.php',
});
assert(!nbspInjected.result.includes('\u00A0'), 'inject pipeline strips NBSP from source+snippet');
assert(sanitizePhpForDeploy('a\u00A0b', 'theme/x/head.sub.php') === 'a b', 'deploy sanitizer');

const onelineHead = `<?php
if (!defined('_GNUBOARD_')) exit;
${THEME_ONELINER}
?>
<!doctype html>
<head>
<meta charset="utf-8">
</head>`;
const onelineInjected = injectBeforeClosingHead(onelineHead, engine, {
	targetPath: 'theme/clinic/head.sub.php',
});
assert(!/require_once\s*\(\s*G5_THEME_PATH/.test(onelineInjected.result), 'one-liner dispatcher stripped from theme');
assert(onelineInjected.result.includes('<meta charset="utf-8">'), 'one-liner theme keeps charset');

const legacyHead = `<?php
if (!defined('_GNUBOARD_')) exit;
$html_process = run_replace('html_process', $html_process);
?>
<!doctype html>
<head>
<meta charset="utf-8">
<title>old g5</title>
</head>`;
const legacyInjected = injectBeforeClosingHead(legacyHead, engine, {
	targetPath: 'theme/old/head.sub.php',
});
assert(legacyInjected.ok, 'legacy run_replace file injects');
assert(
	legacyInjected.result.includes("$html_process = run_replace('html_process', $html_process);"),
	'original theme run_replace call is preserved (polyfill lives in extend file)',
);
assert(!/function\s+run_replace\s*\(/.test(legacyInjected.result), 'head.sub.php does not receive the polyfill');
assert(/function\s+run_replace\s*\(/.test(engine), 'polyfill ships in extend engine file');
assert(legacyInjected.result.includes('<title>old g5</title>'), 'legacy theme title preserved');

console.log('test-gnuboard-2phase-inject: ok');
