/**
 * CMS-aware robots.txt builder — TypeScript + standalone PHP template.
 * Run: npx tsx scripts/test-robots-txt-builder.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	AI_ROBOTS_CRAWLERS,
	ROBOTS_CMS_RULES,
	buildAiFriendlyRobotsTxt,
	detectRobotsCmsId,
	normalizeRobotsCmsId,
} from '../lib/solve/robots-txt-builder';
import { buildGeoRootAssetPack } from '../lib/solve/geo-root-assets';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(normalizeRobotsCmsId('그누보드 5') === 'gnuboard', 'normalize gnu');
assert(normalizeRobotsCmsId('YoungCart') === 'gnuboard', 'normalize youngcart');
assert(normalizeRobotsCmsId('WordPress') === 'wordpress', 'normalize wp');
assert(normalizeRobotsCmsId('라이믹스') === 'rhymix', 'normalize rhymix');
assert(normalizeRobotsCmsId('Cafe24') === 'standalone', 'saas falls back to standalone rules');
assert(normalizeRobotsCmsId('Custom HTML/PHP') === 'standalone', 'normalize standalone');

assert(detectRobotsCmsId({ constants: ['_GNUBOARD_'] }) === 'gnuboard', 'const gnu');
assert(detectRobotsCmsId({ constants: ['ABSPATH'] }) === 'wordpress', 'const wp');
assert(detectRobotsCmsId({ constants: ['RX_VERSION'] }) === 'rhymix', 'const rx');
assert(detectRobotsCmsId({ constants: ['__XE__'] }) === 'rhymix', 'const xe');
assert(
	detectRobotsCmsId({ rootDirs: ['bbs'], rootFiles: ['config.php'] }) === 'gnuboard',
	'fs gnu',
);
assert(detectRobotsCmsId({ rootFiles: ['wp-config.php'] }) === 'wordpress', 'fs wp');
assert(
	detectRobotsCmsId({ rootFiles: ['config.inc.php'], rootDirs: ['modules'] }) === 'rhymix',
	'fs rhymix',
);
assert(detectRobotsCmsId({}) === 'standalone', 'empty fallback');

const gnu = buildAiFriendlyRobotsTxt({
	targetUrl: 'https://clinic.example/about',
	cms: 'gnuboard',
});
for (const path of ROBOTS_CMS_RULES.gnuboard.allow) {
	assert(gnu.includes(`Allow: ${path}`), `gnu allow ${path}`);
}
for (const path of ROBOTS_CMS_RULES.gnuboard.disallow) {
	assert(gnu.includes(`Disallow: ${path}`), `gnu disallow ${path}`);
}
assert(gnu.includes('Allow: /data/file/'), 'gnu render assets allowed');
assert(gnu.includes('Disallow: /data/session/'), 'gnu session blocked');
assert(gnu.includes('Disallow: /bbs/write*'), 'gnu write wildcard');
assert(!gnu.includes('Disallow: /wp-admin/'), 'gnu does not emit wp rules');

const wp = buildAiFriendlyRobotsTxt('https://blog.example', 'wordpress');
assert(wp.includes('Allow: /wp-admin/admin-ajax.php'), 'wp ajax allow');
assert(wp.includes('Allow: /wp-content/uploads/'), 'wp uploads allow');
assert(wp.includes('Disallow: /wp-admin/'), 'wp admin block');
assert(wp.includes('Disallow: /xmlrpc.php'), 'wp xmlrpc block');
assert(wp.indexOf('Allow: /wp-admin/admin-ajax.php') < wp.indexOf('Disallow: /wp-admin/'), 'wp allow before admin deny');

const rx = buildAiFriendlyRobotsTxt({ targetUrl: 'http://rx.example', cmsType: 'Rhymix / XE' });
assert(rx.includes('Allow: /files/'), 'rx files allow');
assert(rx.includes('Allow: /modules/*/tpl/'), 'rx tpl allow');
assert(rx.includes('Disallow: /*act=dispMember*'), 'rx member act');
assert(rx.includes('Sitemap: http://rx.example/sitemap.xml'), 'rx keeps request protocol');

const fallback = buildAiFriendlyRobotsTxt({ targetUrl: 'https://custom.example' });
assert(fallback.includes('Disallow: /admin/'), 'fallback admin');
assert(fallback.includes('Disallow: /cache/'), 'fallback cache');
assert(!fallback.includes('Disallow: /bbs/write*'), 'fallback is not gnu');

for (const bot of AI_ROBOTS_CRAWLERS) {
	assert(gnu.includes(`User-agent: ${bot}`), `ai bot ${bot}`);
	assert(new RegExp(`User-agent: ${bot}\\nAllow: /`).test(gnu), `ai bot ${bot} allow root`);
}

assert(gnu.includes('Sitemap: https://clinic.example/sitemap.xml'), 'sitemap absolute');
assert(gnu.includes('# AI Context Index (llms.txt)'), 'llms heading');
assert(gnu.includes('# LLMs: https://clinic.example/llms.txt'), 'llms absolute');
assert(gnu.includes('function redue_generate_robots_txt()') === false, 'ts output is robots text not php');

const pack = buildGeoRootAssetPack({
	siteName: '테스트의원',
	targetUrl: 'https://clinic.example',
	cmsType: 'Gnuboard',
	pages: [{ urlPath: '/', title: '메인' }],
});
assert(pack.robotsTxt.includes('detected=gnuboard'), 'pack binds cms');
assert(pack.robotsTxt.includes('Allow: /skin/'), 'pack gnu skin allow');

const phpPath = join(process.cwd(), 'lib/solve/templates/redue.robots.php');
const php = readFileSync(phpPath, 'utf8');
assert(php.includes('function redue_generate_robots_txt'), 'php generate fn');
assert(php.includes('function redue_write_robots_txt'), 'php write fn');
assert(php.includes('function redue_serve_robots_txt'), 'php serve fn');
assert(php.includes('function redue_detect_robots_cms'), 'php detect fn');
assert(php.includes("header( 'Content-Type: text/plain; charset=utf-8' )"), 'php content-type');
assert(php.includes("defined( '_GNUBOARD_' )"), 'php gnu const');
assert(php.includes("is_dir( $bbs ) && is_file( $base . '/config.php' )"), 'php gnu folder');
assert(php.includes("defined( 'ABSPATH' )"), 'php wp const');
assert(php.includes("is_file( $base . '/wp-config.php' )"), 'php wp file');
assert(php.includes("defined( 'RX_VERSION' )") && php.includes("defined( '__XE__' )"), 'php rhymix const');
for (const bot of AI_ROBOTS_CRAWLERS) {
	assert(php.includes(`'${bot}'`), `php lists ${bot}`);
}
assert(php.includes("'/data/file/'"), 'php gnu allow data/file');
assert(php.includes("'/bbs/write*'"), 'php gnu deny write');
assert(php.includes("'/wp-admin/admin-ajax.php'"), 'php wp ajax');
assert(php.includes("'/*act=dispMember*'"), 'php rhymix member');
assert(php.includes("'/session/'") && php.includes("'/cache/'"), 'php fallback deny');
assert(php.includes('Sitemap:'), 'php sitemap line');
assert(php.includes('llms.txt'), 'php llms binding');
assert(php.includes('redue_write_robots_txt'), 'php write usage');
assert(php.includes('G5_URL') && php.includes('home_url') && php.includes('HTTP_HOST'), 'php origin sources');

console.log('OK robots-txt-builder', {
	bots: AI_ROBOTS_CRAWLERS.length,
	cms: Object.keys(ROBOTS_CMS_RULES),
	phpBytes: Buffer.byteLength(php),
});
