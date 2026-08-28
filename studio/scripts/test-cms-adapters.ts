/**
 * Universal core + multi-CMS adapter smoke tests.
 */
import {
	applyCmsAdapterWrap,
	detectCmsType,
	normalizeCmsAdapterId,
	pickCmsInjectTarget,
	planCmsInjection,
	resolveCmsAdapter,
	GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH,
	WORDPRESS_MU_PLUGIN_RELATIVE_PATH,
	RHYMIX_ADDON_RELATIVE_PATH,
} from '../lib/solve/adapters';
import {
	buildExactCanonicalFromEnv,
	composeFallbackTitle,
	composeMissingImgAlt,
	extractStreetAddressFromText,
	extractTelephoneFromText,
	shouldExpandTitle,
} from '../lib/solve/core/entity-patterns';
import { buildUniversalObSeoEnginePhp, buildUniversalSeoRuntimeHelpersPhp } from '../lib/solve/dynamic-php-schema';
import { displayCmsToKey } from '../lib/solve/types';
import { detectCmsFromRootEntries } from '../lib/solve/remote-header-finder';
import { detectCmsFromPaths } from '../lib/solve/local-folder-scan';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(extractTelephoneFromText('대표번호 : 02-1234-5678') === '02-1234-5678', 'tel labeled');
assert(extractTelephoneFromText('문의 1588-1234') === '1588-1234', 'tel 15xx');
assert(extractTelephoneFromText('TEL 010-1234-5678') === '010-1234-5678', 'tel mobile');
assert(
	/서울 강남구 테헤란로/.test(extractStreetAddressFromText('오시는길 서울 강남구 테헤란로 123')),
	'kr address',
);
assert(
	extractStreetAddressFromText('주소 : 서울 강남구 테헤란로 123') === '서울 강남구 테헤란로 123',
	'kr address labeled',
);
assert(shouldExpandTitle('병원'), 'short title expands');
assert(!shouldExpandTitle('서울대학교병원 공식 안내'), 'long enough title stays');
assert(composeFallbackTitle('레드유').includes('공식 안내 및 전문 서비스'), 'title suffix');
assert([...composeFallbackTitle('레드유')].length >= 15, 'title golden min');
assert(composeMissingImgAlt('레드유', '진료안내') === '레드유 진료안내 안내 이미지', 'alt compose');
assert(
	buildExactCanonicalFromEnv({
		httpHost: 'clinic.example.com',
		requestUri: '/about.php',
	}) === 'https://clinic.example.com/about.php',
	'canonical host+path',
);
assert(
	buildExactCanonicalFromEnv({
		serverName: 'clinic.example.com',
		requestUri: '/index.php',
	}) === 'https://clinic.example.com/',
	'canonical index collapse',
);
assert(
	buildExactCanonicalFromEnv({
		httpHost: 'clinic.example.com',
		requestUri: '/?bo_table=notice',
		identityQuery: { bo_table: 'notice' },
	}) === 'https://clinic.example.com/?bo_table=notice',
	'canonical identity query',
);

assert(normalizeCmsAdapterId('그누보드 / 영카트') === 'gnuboard', 'adapter gnu');
assert(normalizeCmsAdapterId('WordPress') === 'wordpress', 'adapter wp');
assert(normalizeCmsAdapterId('Rhymix / XE') === 'rhymix', 'adapter rx');
assert(normalizeCmsAdapterId('Cafe24') === 'saas', 'adapter saas');
assert(displayCmsToKey('라이믹스') === 'rhymix', 'display key rx');
assert(displayCmsToKey('WordPress') === 'wordpress', 'display key wp');

assert(
	pickCmsInjectTarget(['theme/hospital/head.sub.php', 'index.php'], 'Gnuboard') ===
		'theme/hospital/head.sub.php',
	'gnu target',
);
assert(
	pickCmsInjectTarget(
		['wp-content/themes/twentytwentyfour/functions.php', 'wp-content/themes/clinic/functions.php'],
		'WordPress',
	) === WORDPRESS_MU_PLUGIN_RELATIVE_PATH,
	'wp mu-plugin preferred over theme functions.php',
);
assert(
	pickCmsInjectTarget(['common/header.php', 'index.php'], 'Rhymix / XE') === RHYMIX_ADDON_RELATIVE_PATH,
	'rhymix addon target',
);

const core = `<?php
/* REDUE_AI_STUDIO:START — core */
function redue_dynamic_schema_controller() {}
redue_dynamic_schema_controller();
/* REDUE_AI_STUDIO:END */
?>`;

const gnu = applyCmsAdapterWrap(core, 'Gnuboard', 'theme/basic/head.sub.php');
assert(/REDUE_AI_STUDIO:START/.test(gnu), 'gnu keeps marker');
assert(/G5_IS_ADMIN/.test(gnu), 'gnu admin guard');
assert(/REQUEST_METHOD/.test(gnu) && /POST/.test(gnu), 'gnu POST guard');
assert(/catch\s*\(\s*\\Exception/.test(gnu) && /catch\s*\(\s*\\Throwable/.test(gnu), 'gnu dual Exception/Throwable');
assert(!/catch\s*\(\s*Throwable\s/.test(gnu), 'gnu has no bare Throwable');
assert(/\$_GET\s*\[\s*['"]redue_llms['"]\s*\]/.test(gnu), 'gnu llms GET gate');
assert(!/redue_dynamic_schema_controller\s*\(\s*\)\s*;/.test(gnu), 'gnu extend file has no immediate controller call');

const wp = applyCmsAdapterWrap(core, 'WordPress', WORDPRESS_MU_PLUGIN_RELATIVE_PATH);
assert(/add_action\s*\(\s*'wp_head'\s*,\s*'redue_wp_dynamic_schema_controller'\s*,\s*1\s*\)/.test(wp), 'wp hooks wp_head');
assert(/is_admin\s*\(\s*\)/.test(wp), 'wp is_admin guard');
assert(/wp_doing_ajax\s*\(\s*\)/.test(wp) && /REST_REQUEST/.test(wp), 'wp ajax/REST guards');
assert(/REDUE_AI_STUDIO:START/.test(wp), 'wp keeps engine envelope');
assert(/get_stylesheet_directory/.test(wp) && /footer\.php/.test(wp), 'wp footer scanner');
assert(/is_front_page\s*\(\s*\)/.test(wp) && /is_single\s*\(\s*\)/.test(wp), 'wp condition tags');
assert(!/G5_IS_ADMIN/.test(wp), 'wp engine is not gnuboard');

const wpHeader = applyCmsAdapterWrap(core, 'WordPress', 'wp-content/themes/clinic/header.php');
assert(/redue_dynamic_schema_controller\s*\(\s*\)\s*;/.test(wpHeader), 'wp header keeps immediate call');

const rx = applyCmsAdapterWrap(core, 'Rhymix / XE', RHYMIX_ADDON_RELATIVE_PATH);
assert(/before_display_content/.test(rx), 'rhymix addon position');
assert(/REDUE_AI_STUDIO:START/.test(rx), 'rhymix marker');

const stand = applyCmsAdapterWrap(core, 'Laravel', 'header.php');
assert(/REDUE_STANDALONE_HEADER_INCLUDED/.test(stand), 'standalone include guard');
assert(/REDUE_AI_STUDIO:START/.test(stand), 'standalone marker');

const helpers = buildUniversalSeoRuntimeHelpersPhp();
assert(helpers.includes('대표번호|대표전화|TEL|Tel|전화|문의'), 'php tel regex labeled');
assert(helpers.includes('redue_resolve_cms_telephone'), 'cms tel resolver');
assert(helpers.includes('redue_resolve_universal_telephone'), 'universal tel resolver');
assert(helpers.includes('redue_format_telephone'), 'tel formatter');
assert(helpers.includes('get_option'), 'wp option tel');
assert(helpers.includes('get_bloginfo'), 'wp site name');
assert(helpers.includes('Context'), 'rhymix site name');
assert(helpers.includes('안내 이미지'), 'global alt 안내 이미지');

const uni = buildUniversalObSeoEnginePhp();
assert(uni.includes('redue_get_exact_canonical'), 'canonical runtime');
assert(/HTTP_HOST|SERVER_NAME/.test(uni), 'canonical host env');

const gnuSig = detectCmsFromRootEntries([
	{ name: 'common.php', isDirectory: false },
	{ name: 'theme', isDirectory: true },
	{ name: 'data', isDirectory: true },
]);
assert(gnuSig.mode === 'gnuboard', 'root sig gnu');

const wpSig = detectCmsFromRootEntries([
	{ name: 'wp-config.php', isDirectory: false },
	{ name: 'wp-content', isDirectory: true },
]);
assert(wpSig.mode === 'wordpress', 'root sig wp');

const rxSig = detectCmsFromRootEntries([
	{ name: 'common', isDirectory: true },
	{ name: 'modules', isDirectory: true },
	{ name: 'files', isDirectory: true },
	{ name: 'layouts', isDirectory: true },
	{ name: 'index.php', isDirectory: false },
]);
assert(rxSig.mode === 'standalone', 'root sig rhymix');

const rxPaths = detectCmsFromPaths([
	'config.inc.php',
	'classes/context/Context.class.php',
	'files/config/config.php',
	'layouts/default/layout.php',
]);
assert(rxPaths.display === 'Rhymix / XE', `path detect rhymix (got ${rxPaths.display})`);

assert(resolveCmsAdapter('WordPress').strategy === 'wp-mu-plugin', 'wp strategy');
assert(resolveCmsAdapter('Gnuboard').strategy === 'extend-file-head-render', 'gnu strategy');
assert(resolveCmsAdapter('Rhymix / XE').strategy === 'rhymix-addon', 'rx strategy');
assert(resolveCmsAdapter('Cafe24').strategy === 'saas-static-html', 'saas strategy');
const saasSnippet = applyCmsAdapterWrap('<?php echo 1;', 'Cafe24', 'layout.html', { siteName: '서울내과의원' });
assert(saasSnippet.includes('window.REDUE_CONFIG'), 'saas wrap emits REDUE_CONFIG');
assert(saasSnippet.includes('__REDUE_SCHEMA_INJECTED__'), 'saas wrap emits inject flag');
assert(saasSnippet.includes('서울내과의원'), 'saas wrap bakes site name');
assert(!/<\?php/.test(saasSnippet), 'saas wrap is not PHP');

const detectedGnu = detectCmsType({
	rootEntries: [
		{ name: 'common.php', isDirectory: false },
		{ name: 'config.php', isDirectory: false },
	],
});
assert(detectedGnu.id === 'gnuboard', 'detectCmsType gnu files');
assert(detectedGnu.injectionKind === 'php-extend', 'detectCmsType gnu inject kind');

const detectedHtml = detectCmsType({ html: 'var g5_url = "https://example.com";' });
assert(detectedHtml.id === 'gnuboard', 'detectCmsType g5_url');

const detectedWp = detectCmsType({
	rootEntries: [
		{ name: 'wp-config.php', isDirectory: false },
		{ name: 'wp-content', isDirectory: true },
	],
});
assert(detectedWp.id === 'wordpress', 'detectCmsType wp');

const detectedSaas = detectCmsType({ html: 'cdn.imweb.me shop' });
assert(detectedSaas.id === 'saas', 'detectCmsType imweb saas');

const planned = planCmsInjection({
	cmsType: 'Gnuboard',
	corePhp: core,
	headerPath: 'theme/hospital/head.sub.php',
});
assert(planned[0]?.relativePath === GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH, 'plan extend file');
assert(planned[0]?.mode === 'create', 'plan extend create');
assert(/G5_IS_ADMIN/.test(planned[0]?.content || ''), 'plan extend has admin guard');
assert(planned[1]?.mode === 'patch-render-only', 'plan head render-only');
assert(/echo redue_render_full_schema/.test(planned[1]?.content || ''), 'plan head echo');
assert(!(planned[1]?.content || '').includes('function redue_render_full_schema'), 'plan head has no engine fn');

const plannedWp = planCmsInjection({
	cmsType: 'WordPress',
	corePhp: core,
});
assert(plannedWp[0]?.relativePath === WORDPRESS_MU_PLUGIN_RELATIVE_PATH, 'plan wp mu path');
assert(/redue_wp_dynamic_schema_controller/.test(plannedWp[0]?.content || ''), 'plan wp controller');

console.log('test-cms-adapters: ok');
