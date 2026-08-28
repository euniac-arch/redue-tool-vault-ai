/**
 * Emit GnuBoard split-inject samples:
 *  - extend/redue.schema.php (engine + admin/POST guards)
 *  - head.sub.php (charset-after 5-line render call only)
 * Run: npx tsx scripts/emit-universal-head-sub.ts
 *
 * Seeds stay empty — the engine reads $config / theme tail.php at runtime.
 * Never bake dummy NAP (김수의, 서초 좌표, maeumvet).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildGnuboardExtendEngineFile, buildGnuboardHeadRenderCallBlock, planCmsInjection } from '../lib/solve/adapters';
import { buildGnuboardAutomatedRuntimeEnginePhp } from '../lib/solve/dynamic-php-schema';
import { cleanPhpTemplate, toUtf8WithoutBom } from '../lib/solve/php-sanitize';
import { injectAfterCharsetOrHead } from '../lib/solve/source-mapping';

const engine = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '',
	representativeName: '',
	representativeTitle: '',
	sameAs: [],
	pages: [],
	navItems: [],
});

const skeleton = `<?php
if (!defined('_GNUBOARD_')) exit;
?>
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title><?php echo $g5_head_title; ?></title>
<?php /* Canonical / og:url / description / OG / Twitter / JSON-LD 는 redue_render_full_schema() 에서만 1회 출력합니다. */ ?>
</head>
`;

const plans = planCmsInjection({
	cmsType: 'Gnuboard',
	corePhp: engine,
	headerPath: 'theme/basic/head.sub.php',
});
const extendFile = cleanPhpTemplate(plans[0]?.content || buildGnuboardExtendEngineFile(engine));
const headFile = cleanPhpTemplate(
	injectAfterCharsetOrHead(skeleton, plans[1]?.content || buildGnuboardHeadRenderCallBlock()),
);

const destDir = join(process.cwd(), 'lib/solve/templates');
mkdirSync(destDir, { recursive: true });
const extendDest = join(destDir, 'redue.schema.php');
const headDest = join(destDir, 'head.sub.universal.php');
writeFileSync(extendDest, toUtf8WithoutBom(extendFile), { encoding: 'utf8' });
writeFileSync(headDest, toUtf8WithoutBom(headFile), { encoding: 'utf8' });
console.log(extendDest, Buffer.byteLength(extendFile), 'bytes', extendFile.split('\n').length, 'lines');
console.log(headDest, Buffer.byteLength(headFile), 'bytes', headFile.split('\n').length, 'lines');
