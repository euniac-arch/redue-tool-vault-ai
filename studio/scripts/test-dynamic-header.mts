import {
	rankHeaderPathPriority,
	detectGlobalHeadTargets,
	formatPrimaryHeaderBadge,
	injectBeforeClosingHead,
} from '../lib/solve/source-mapping';
import {
	buildDynamicPhpSchemaController,
	pagesFromAuditPaths,
} from '../lib/solve/dynamic-php-schema';

const paths = [
	'head.sub.php',
	'config.php',
	'theme/basic/head.sub.php',
	'theme/basic/head.php',
	'inc/head.php',
	'common/header.php',
	'index.html',
	'bbs/board.php',
];
const contents = {
	'head.sub.php': "<?php include_once(G5_THEME_PATH.'/head.sub.php'); ?>",
	'config.php': "<?php $config['cf_theme'] = 'basic';",
	'theme/basic/head.sub.php':
		'<!doctype html><html><head><meta charset="utf-8"><title>t</title>\n</head><body>',
	'theme/basic/head.php': '<?php // layout only include ?>',
	'inc/head.php': '<html><head><title>inc</title></head>',
	'index.html': '<html><head></head></html>',
};

const ranks = Object.fromEntries(paths.map((p) => [p, rankHeaderPathPriority(p)]));
console.log('PATH_RANKS', JSON.stringify(ranks));

const hits = detectGlobalHeadTargets({
	relativePaths: paths,
	cms: 'Gnuboard',
	fileContents: contents,
});
console.log('PRIMARY', hits[0]?.path, hits[0]?.badge, 'score=' + hits[0]?.score);
if (hits[0]?.path !== 'theme/basic/head.sub.php') {
	throw new Error('Expected theme/basic/head.sub.php as primary, got ' + hits[0]?.path);
}
const expectedBadge = formatPrimaryHeaderBadge('테마 사용: theme/basic/head.sub.php 감지');
if (hits[0]?.badge !== expectedBadge) {
	throw new Error('Missing primary badge, got ' + hits[0]?.badge);
}
if (hits[0]?.score !== 200) {
	throw new Error('Expected theme score 200, got ' + hits[0]?.score);
}

// Case A: empty cf_theme → root head.sub.php wins even if theme/basic exists
const unusedHits = detectGlobalHeadTargets({
	relativePaths: paths,
	cms: 'Gnuboard',
	fileContents: {
		...contents,
		'head.sub.php':
			'<!doctype html><html><head><meta charset="utf-8"><title>root</title>\n</head><body>',
		'config.php': "<?php $config['cf_theme'] = '';",
	},
});
console.log('UNUSED_PRIMARY', unusedHits[0]?.path, 'score=' + unusedHits[0]?.score);
if (unusedHits[0]?.path !== 'head.sub.php') {
	throw new Error('Expected root head.sub.php as primary when cf_theme empty, got ' + unusedHits[0]?.path);
}
if (unusedHits[0]?.score !== 200) {
	throw new Error('Expected root score 200, got ' + unusedHits[0]?.score);
}
const demotedTheme = unusedHits.find((t) => t.path.startsWith('theme/'));
if (demotedTheme && demotedTheme.score !== 50) {
	throw new Error('Expected theme score 50 when unused, got ' + demotedTheme.score);
}

const pages = pagesFromAuditPaths({
	targetUrl: 'https://example.com/',
	siteName: '테스트치과',
	collectedUrlPaths: ['/', '/about.php', '/contact.php', '/service/list.php'],
	mainTitle: '테스트치과',
	mainDescription: '부산 임플란트',
	mainH1: '테스트치과',
	industryType: 'MEDICAL',
});
const php = buildDynamicPhpSchemaController({
	siteName: '테스트치과',
	targetUrl: 'https://example.com/',
	pages,
	industryType: 'MEDICAL',
});
const checks: Array<[string, boolean]> = [
	['parse_url', php.includes('parse_url(') && php.includes("$_SERVER['REQUEST_URI']") && php.includes('PHP_URL_PATH')],
	['page_meta', php.includes('$page_meta')],
	['page_schema', php.includes('$page_schema')],
	['section', php.includes("'section'")],
	['schema_meta vars', php.includes('$schema_meta_title') && php.includes('$schema_meta_description')],
	['seo meta tags', php.includes('name="description"') && php.includes('rel="canonical"') && php.includes('og:title')],
	['graph push', php.includes('$graph[]')],
	['json flags', php.includes('JSON_UNESCAPED_UNICODE') && php.includes('JSON_PRETTY_PRINT')],
	['Organization+ProfessionalService', php.includes('ProfessionalService') && php.includes('Organization') && php.includes('knowsAbout')],
	['legalName+contactPoint+areaServed', php.includes('legalName') && php.includes('contactPoint') && php.includes('areaServed')],
	['main ItemList buckets', php.includes('/#main-services') && php.includes('/#treatments')],
	['v30 marker', php.includes('v30')],
	['ob_start (v30 Precision Canonical & Full-Document Defer)', php.includes('ob_start')],
	['v30 exact query canonical', php.includes('$final_canonical') || php.includes('$is_main_path') || php.includes('$is_main && $page_query === \'\'') || php.includes('$is_main && ( ! is_string($page_query) || $page_query === \'\' )')],
	['redue_get_exact_canonical', php.includes('redue_get_exact_canonical')],
	['canonical + og:url present', php.includes('rel="canonical" href="') && php.includes('property="og:url"')],
	['canonical precision', php.includes('http_build_query')],
	['index.php root normalize', php.includes("\$page_path === '/index.php'") && php.includes("$page_path = '/'")],
	['G5_URL domain', php.includes("defined('G5_URL')")],
	['bo_table identity', php.includes("'bo_table'")],
	['alt autofix', php.includes('redue-alt-autofix')],
	['js defer autofix', php.includes('redue-js-defer-fix')],
	['article date autofix', php.includes("date('Y-01-01T00:00:00+09:00')")],
	['sameAs', php.includes("'sameAs' => array($origin")],
	['Person E-E-A-T', php.includes("$origin . '/#person'") && php.includes('의료진/연구팀')],
	['Description Extender', php.includes('Description Extender') && php.includes('$_redue_desc_len')],
	['og:type precision', php.includes("$page_type_og === 'Article'") && php.includes('schema_meta_og_type')],
	['context vars', php.includes('schema_faq_items') && php.includes('schema_person') && php.includes('schema_article')],
	['no MedicalOrganization', !php.includes('MedicalOrganization')],
	['no LocalBusiness', !php.includes('LocalBusiness')],
	['HTTPS origin', php.includes("preg_replace('#^http://#i', 'https://'")],
	['marker', php.includes('REDUE_AI_STUDIO:START')],
];
for (const [name, ok] of checks) {
	if (!ok) throw new Error('Missing: ' + name);
	console.log('OK', name);
}

const source = contents['theme/basic/head.sub.php'];
const injected = injectBeforeClosingHead(source, php);
if (!injected.ok) throw new Error('inject failed');
if (!injected.result.includes('redue_dynamic_schema_controller')) {
	throw new Error('controller missing');
}
const again = injectBeforeClosingHead(injected.result, php);
const count = (again.result.match(/REDUE_AI_STUDIO:START/g) || []).length;
if (count !== 1) throw new Error('idempotency failed, markers=' + count);
console.log('OK inject+idempotent');
console.log('PAGES', pages.map((p) => p.urlPath + ':' + p.pageType).join(', '));
console.log('ALL_PASS');
