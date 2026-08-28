/**
 * GnuBoard Schema Auto-Injector — Universal 5-core + No-Fake-Data.
 * Run: npx tsx scripts/test-schema-auto-injector.ts
 */
import { buildGnuboardExtendEngineFile } from '../lib/solve/adapters';
import { UNIVERSAL_GRAPH_GLOBALS } from '../lib/solve/core/universal-graph-builder';
import { buildFooterAutoDetectPhp, buildGnuboardAutomatedRuntimeEnginePhp } from '../lib/solve/dynamic-php-schema';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const footer = buildFooterAutoDetectPhp();
assert('footer scanner function', footer.includes('function redue_auto_detect_footer_info'));
assert('footer theme tail.php', footer.includes("G5_THEME_PATH . '/tail.php'"));
assert('footer theme tail.sub.php', footer.includes("G5_THEME_PATH . '/tail.sub.php'"));
assert('footer root tail.php', footer.includes("G5_PATH . '/tail.php'"));
assert('footer root tail.sub.php', footer.includes("G5_PATH . '/tail.sub.php'"));
assert('footer sequential merge', footer.includes('$cached .=') && footer.includes('file_get_contents'));
assert('footer config first', footer.includes('cf_admin_name') && footer.includes('cf_add_script'));
assert('footer taxID hyphen+digits', footer.includes('[0-9]{3}-[0-9]{2}-[0-9]{5}') && footer.includes('[0-9]{10}'));
assert('footer extractors', footer.includes('redue_extract_tax_id') && footer.includes('redue_extract_fax'));

const empty = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '',
	pages: [],
	navItems: [],
});
for (const key of UNIVERSAL_GRAPH_GLOBALS) {
	assert(`empty seed has ${key}`, empty.includes(`$GLOBALS['${key}']`));
}
assert('empty omits dummy ₩₩', !empty.includes("'₩₩'"));
assert('empty omits 전문 상담', !empty.includes("'전문 상담'"));
assert('empty omits site 대표 fallback', !empty.includes("$site_name . ' 대표'"));
assert('empty omits GNB-as-service', !empty.includes("$available_services[] = array("));
assert('empty omits dummy 안내 crumb', !empty.includes("$_crumb_parent = '안내'"));
assert('empty person gate', empty.includes('function redue_has_real_person') && empty.includes("if ( $person_eeat_name !== '' )"));
assert('empty dual catalog', empty.includes('function redue_bind_dual_service_catalog') && empty.includes('hasOfferCatalog'));
assert('empty catalog-from-menu helper', empty.includes('function redue_catalog_from_menu'));
assert('empty tax accept', empty.includes('function redue_accept_tax_id'));
assert('empty no dummy 대표자 title', !empty.includes("$GLOBALS['redue_rep_title'] = '대표자'"));
assert('empty no dummy 대표 title', !empty.includes("$GLOBALS['redue_rep_title'] = '대표'"));
assert('empty five-core omit', empty.includes("array('taxID', 'faxNumber', 'telephone')") || empty.includes('redue_omit_empty_schema_keys'));
assert('empty custom page infer', empty.includes('ultra') && empty.includes('MedicalWebPage'));
assert('empty 2-way page links', empty.includes('redue_apply_page_graph_links') && empty.includes("'about'"));
assert('empty worksFor', empty.includes('worksFor'));

const seeded = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '서초내과의원',
	industryType: 'MEDICAL',
	representativeName: '김원장',
	representativeTitle: '대표원장',
	telephone: '02-555-1212',
	fax: '02-555-3434',
	taxId: '120-81-47521',
	latitude: '37.4946',
	longitude: '127.0276',
	openingHoursOpens: '09:00',
	openingHoursCloses: '18:00',
	sameAs: ['https://blog.naver.com/seocho'],
	pages: [
		{ urlPath: '/', title: '홈', pageType: 'WebPage' },
		{ urlPath: '/ultra2.php', title: '시술안내' },
		{ urlPath: '/s500.php', title: '내과진료' },
	],
	navItems: [
		{ name: '시술안내', url: '/ultra2.php' },
		{ name: '내과진료', url: '/s500.php' },
	],
});
assert('seeded taxID', seeded.includes('120-81-47521'));
assert('seeded fax', seeded.includes('02-555-3434'));
assert('seeded geo', seeded.includes('37.4946') && seeded.includes('127.0276'));
assert('seeded hours', seeded.includes('09:00') && seeded.includes('18:00'));
assert('seeded sameAs', seeded.includes('blog.naver.com/seocho'));
assert('seeded services from pages', seeded.includes('시술안내') || seeded.includes('내과진료'));
assert('seeded person', seeded.includes("'김원장'") && seeded.includes("'대표원장'"));
assert('seeded founder when person', seeded.includes("$org_node['founder'] = array('@id' => $origin . '/#person')"));
assert('seeded runtime wr/bo/co', seeded.includes('$runtime_wr') && seeded.includes('$runtime_bo') && seeded.includes('$runtime_co'));
assert('seeded article datePublished', seeded.includes('datePublished') && seeded.includes('wr_datetime'));
assert('seeded CollectionPage', seeded.includes('CollectionPage'));
assert('seeded GNB me_code', seeded.includes('me_code'));

const wrapped = buildGnuboardExtendEngineFile(empty);
assert('extend php open tag', wrapped.trimStart().startsWith('<?php'));
assert('extend no short tags', !/<\?(?!php|=)/.test(wrapped.replace(/<\?php/g, '')));
assert('extend admin guard', wrapped.includes("!defined('_GNUBOARD_')") && wrapped.includes('G5_IS_ADMIN'));
assert('extend no render echo in engine', !wrapped.includes('echo redue_render_full_schema();') || wrapped.includes('REDUE_AI_STUDIO_RENDER'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nschema-auto-injector ok');
