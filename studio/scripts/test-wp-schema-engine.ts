/**
 * WordPress Schema Injector Engine — regex extractors + generated PHP smoke tests.
 * Run: npx tsx scripts/test-wp-schema-engine.ts
 */
import {
	applyCmsAdapterWrap,
	planCmsInjection,
	WORDPRESS_MU_PLUGIN_RELATIVE_PATH,
} from '../lib/solve/adapters';
import {
	buildWordpressSchemaEnginePhp,
	extractWordpressSeedsFromCorePhp,
	extractWpFooterFax,
	extractWpFooterRepName,
	extractWpFooterStreetAddress,
	extractWpFooterTaxId,
	extractWpFooterTelephone,
	REDUE_WP_SCHEMA_ENGINE_VERSION,
} from '../lib/solve/wp-schema-engine';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const FOOTER = `
상호 : 서울내과의원 | 대표자 : 김원장
사업자등록번호 : 123-45-67890
주소 : 서울특별시 강남구 테헤란로 123 메디컬빌딩 5층
TEL : 02-555-1212 / FAX : 02-555-3434
`;

assert(extractWpFooterTaxId('사업자등록번호 : 123-45-67890') === '123-45-67890', 'taxId labeled');
assert(extractWpFooterTaxId('사업자번호: 123-45-67890') === '123-45-67890', 'taxId 사업자번호');
assert(extractWpFooterTaxId('등록번호 123-45-67890') === '123-45-67890', 'taxId 등록번호');
assert(extractWpFooterTaxId('본문에 사업자 정보가 없습니다') === '', 'taxId no false positive');
assert(extractWpFooterTaxId(FOOTER) === '123-45-67890', 'taxId from footer');

assert(extractWpFooterFax('FAX : 02-555-3434') === '02-555-3434', 'fax FAX');
assert(extractWpFooterFax('팩스: 031-123-4567') === '031-123-4567', 'fax 팩스');
assert(extractWpFooterFax('F. 02-111-2222') === '02-111-2222', 'fax F.');
assert(extractWpFooterFax(FOOTER) === '02-555-3434', 'fax from footer');
assert(extractWpFooterFax('전화번호만 있는 본문 02-555-1212') === '', 'fax no false positive');

assert(/서울특별시 강남구 테헤란로/.test(extractWpFooterStreetAddress(FOOTER)), 'street from footer');
assert(extractWpFooterStreetAddress('본문에 주소가 없습니다') === '', 'street no false positive');

assert(extractWpFooterRepName('대표원장 : 김수의') === '김수의', 'rep 대표원장');
assert(extractWpFooterRepName('대표이사 이철수 | 사업자 123-45-67890') === '이철수', 'rep 대표이사');
assert(extractWpFooterRepName('대표 : 안내') === '', 'rep rejects 안내');
assert(extractWpFooterRepName('대표 : 문의') === '', 'rep rejects 문의');
assert(extractWpFooterRepName(FOOTER) === '김원장', 'rep from footer');
assert(
	extractWpFooterRepName('대표 : 고객센터 / 대표원장 : 박영희') === '박영희',
	'rep skips stopword then finds next',
);

assert(extractWpFooterTelephone('대표전화: 031-123-4567') === '031-123-4567', 'tel 대표전화');
assert(extractWpFooterTelephone('전화번호: 010-1234-5678') === '010-1234-5678', 'tel 전화번호');
assert(extractWpFooterTelephone('고객센터 1688-1234') === '1688-1234', 'tel 16xx');
assert(extractWpFooterTelephone('TEL : 02-555-1212') === '02-555-1212', 'tel TEL');
assert(extractWpFooterTelephone(FOOTER) === '02-555-1212', 'tel from footer');

const seeds = extractWordpressSeedsFromCorePhp(`<?php
$GLOBALS['redue_rep_name']  = '홍길동';
$GLOBALS['redue_tel'] = '02-9999-8888';
$GLOBALS['redue_tax_id'] = '123-45-67890';
$GLOBALS['redue_street'] = '서울특별시 강남구 테헤란로 1';
$GLOBALS['redue_sameas'] = array('https://blog.naver.com/clinic');
$GLOBALS['redue_org_type']  = array('MedicalClinic', 'Organization');
$GLOBALS['redue_services'] = array(
	array('@type' => 'MedicalProcedure', 'name' => '건강검진'),
);
`);
assert(seeds.repName === '홍길동', 'seed repName');
assert(seeds.telephone === '02-9999-8888', 'seed tel');
assert(seeds.taxId === '123-45-67890', 'seed tax');
assert(seeds.streetAddress?.includes('테헤란로') === true, 'seed street');
assert(seeds.sameAs?.[0] === 'https://blog.naver.com/clinic', 'seed sameAs');
assert(seeds.orgTypes?.includes('MedicalClinic') === true, 'seed orgTypes');
assert(seeds.services?.[0] && typeof seeds.services[0] !== 'string' && seeds.services[0].name === '건강검진', 'seed service');

const php = buildWordpressSchemaEnginePhp({
	siteName: '서울내과의원',
	industryType: 'MEDICAL',
	repName: '김원장',
	telephone: '02-555-1212',
	taxId: '123-45-67890',
	sameAs: ['https://blog.naver.com/clinic', 'https://place.naver.com/hospital/1'],
	services: [{ name: '건강검진', type: 'MedicalProcedure' }],
});

assert(php.includes('Plugin Name: REDUE Schema Injector'), 'mu plugin header');
assert(php.includes(`REDUE_WP_SCHEMA_ENGINE`), 'version const');
assert(php.includes(REDUE_WP_SCHEMA_ENGINE_VERSION), 'version value');
assert(/if\s*\(\s*!\s*defined\s*\(\s*'ABSPATH'\s*\)\s*\)/.test(php), 'ABSPATH guard');
assert(
	/add_action\s*\(\s*'wp_head'\s*,\s*'redue_wp_dynamic_schema_controller'\s*,\s*1\s*\)/.test(php),
	'wp_head hook priority 1',
);
assert(/function redue_wp_dynamic_schema_controller/.test(php), 'controller fn');
assert(/is_admin\s*\(\s*\)/.test(php), 'is_admin');
assert(/wp_doing_ajax\s*\(\s*\)/.test(php), 'ajax guard');
assert(/wp_doing_cron\s*\(\s*\)/.test(php), 'cron guard');
assert(/REST_REQUEST/.test(php), 'REST guard');
assert(/get_stylesheet_directory\s*\(\s*\)\s*\.\s*'\/footer\.php'/.test(php), 'child footer');
assert(/get_template_directory\s*\(\s*\)\s*\.\s*'\/footer\.php'/.test(php), 'parent footer');
assert(/ABSPATH\s*\.\s*'wp-content\/themes\/'\s*\.\s*get_template\s*\(\s*\)/.test(php), 'abspath footer');
assert(/preg_match\s*\(\s*'\/\(\?:사업자/.test(php), 'tax regex is a PHP string');
assert(/사업자\\s\*\(\?:등록\)\?\\s\*번호|사업자번호|등록번호/.test(php), 'tax regex');
assert(/팩스\|FAX\|Fax\|F\\./.test(php), 'fax regex');
assert(/대표자\|대표원장\|원장\|대표이사\|대표/.test(php), 'rep regex');
assert(/대표전화\|전화번호\|고객센터\|TEL\|Tel\|T\\./.test(php), 'tel regex');
assert(/특별시\|광역시\|도\|시\|군\|구/.test(php), 'street regex');
assert(/is_front_page\s*\(\s*\)\s*\|\|\s*is_home\s*\(\s*\)/.test(php), 'home branch');
assert(/is_single\s*\(\s*\)/.test(php), 'single branch');
assert(/is_page\s*\(\s*\)/.test(php), 'page branch');
assert(/is_category\s*\(\s*\)/.test(php) && /is_archive\s*\(\s*\)/.test(php), 'archive branch');
assert(php.includes('MedicalWebPage'), 'home medical types');
assert(php.includes("'Article'"), 'article type');
assert(php.includes('CollectionPage'), 'collection type');
assert(/get_the_date\s*\(\s*'c'\s*\)/.test(php), 'datePublished');
assert(/get_the_modified_date\s*\(\s*'c'\s*\)/.test(php), 'dateModified');
assert(/post_parent/.test(php) && /get_post_ancestors/.test(php), 'page ancestors');
assert(/get_the_category\s*\(\s*\)/.test(php), 'single category crumb');
assert(php.includes("/#organization"), 'org @id');
assert(php.includes("/#website"), 'website @id');
assert(php.includes("/#person"), 'person @id');
assert(/#webpage/.test(php), 'webpage @id');
assert(/wp_get_attachment_image_url/.test(php) && /custom_logo/.test(php), 'logo fallback');
assert(php.includes('availableService') && php.includes('hasOfferCatalog'), 'hybrid catalog');
assert(php.includes("$redue_service_catalog") && php.includes("$GLOBALS['redue_service_catalog']"), 'catalog slot');
assert(php.includes('주요 서비스 및 진료 카탈로그'), 'catalog title');
assert(php.includes("apply_filters( 'redue_service_catalog'"), 'theme catalog filter');
assert(php.includes("rel=\"help\"") && php.includes('/llms.txt'), 'llms help link');
assert(/rel="canonical"/.test(php) && /og:url/.test(php), 'single canonical/og');
assert(/og:type/.test(php), 'og type');
assert(php.includes("$GLOBALS['redue_tel']       = '02-555-1212'") || php.includes("$GLOBALS['redue_tel'] = '02-555-1212'"), 'baked tel');
assert(php.includes('김원장'), 'baked rep');
assert(php.includes('123-45-67890'), 'baked tax');
assert(php.includes('건강검진'), 'baked service');
assert(!/G5_IS_ADMIN/.test(php), 'no gnuboard admin const');
assert(!/\$config\s*\[/.test(php), 'no gnuboard $config');
assert(php.includes('REDUE_AI_STUDIO:START'), 'marker start');
assert(php.includes('REDUE_AI_STUDIO:END'), 'marker end');
assert(/function_exists\s*\(\s*'add_action'/.test(php), 'add_action guarded');
assert(php.includes('redue_wp_omit_empty'), 'omit empty helper');
assert(/wp_get_nav_menu_items/.test(php), 'nav menu → catalog');
assert(php.includes("'employee'"), 'employee @id when Person exists');
assert(/header\\.php/.test(php) || php.includes('/header.php'), 'header.php scanned for sameAs');
assert(!php.includes("$GLOBALS['redue_rep_title'] = '대표'"), 'no dummy 대표 title default');

const fnBlock = buildWordpressSchemaEnginePhp({ mode: 'functions-block', telephone: '02-111-2222' });
assert(!fnBlock.includes('Plugin Name:'), 'functions block has no plugin header');
assert(/add_action\s*\(\s*'wp_head'\s*,\s*'redue_wp_dynamic_schema_controller'\s*,\s*1\s*\)/.test(fnBlock), 'functions still hooks');
assert(!/^<\?php\s*if\s*\(\s*function_exists\s*\(\s*'is_admin'/.test(fnBlock), 'no file-top is_admin return');

const wrapped = applyCmsAdapterWrap(
	`<?php
$GLOBALS['redue_tel'] = '02-1234-5678';
function redue_dynamic_schema_controller() {}
redue_dynamic_schema_controller();
`,
	'WordPress',
	WORDPRESS_MU_PLUGIN_RELATIVE_PATH,
);
assert(/redue_wp_dynamic_schema_controller/.test(wrapped), 'wrap emits wp controller');
assert(wrapped.includes('02-1234-5678'), 'wrap keeps baked tel');
assert(!/redue_dynamic_schema_controller\s*\(\s*\)\s*;/.test(wrapped), 'wrap drops immediate gnu call');

const planned = planCmsInjection({
	cmsType: 'WordPress',
	corePhp: `<?php $GLOBALS['redue_rep_name'] = '박원장';`,
});
assert(planned[0]?.relativePath === WORDPRESS_MU_PLUGIN_RELATIVE_PATH, 'plan mu path');
assert(planned[0]?.mode === 'create', 'plan create');
assert(/박원장/.test(planned[0]?.content || ''), 'plan keeps seed');
assert(/add_action\s*\(\s*'wp_head'/.test(planned[0]?.content || ''), 'plan hooks wp_head');

console.log('test-wp-schema-engine: ok');
