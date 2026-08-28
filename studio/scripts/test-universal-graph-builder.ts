/**
 * Universal Graph Builder — Schema Injector Generator smoke.
 * Run: npx tsx scripts/test-universal-graph-builder.ts
 */
import {
	UNIVERSAL_GRAPH_GLOBALS,
	buildUniversalGraphGlobalsSeedPhp,
	buildUniversalGraphRuntimeHelpersPhp,
} from '../lib/solve/core/universal-graph-builder';
import {
	buildGnuboardAutomatedRuntimeEnginePhp,
	buildUniversalObSeoEnginePhp,
	generateSchemaInjector,
} from '../lib/solve/dynamic-php-schema';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const seed = buildUniversalGraphGlobalsSeedPhp({
	repName: '김원장',
	repTitle: '대표원장',
	tel: '02-555-1212',
	street: '서울 서초구 서초대로 10',
	taxId: '120-81-47521',
	lat: '37.4946',
	lng: '127.0276',
	openingHoursOpens: '09:00',
	openingHoursCloses: '18:00',
	sameAs: ['https://blog.naver.com/seocho'],
	services: [{ name: '내과진료', type: 'MedicalProcedure' }],
	bakeStreet: true,
});

for (const key of UNIVERSAL_GRAPH_GLOBALS) {
	assert(`seed has $GLOBALS['${key}']`, seed.includes(`$GLOBALS['${key}']`));
}
assert('seed catalog slot', seed.includes('$redue_service_catalog') && seed.includes('정밀 맞춤 진단'));
assert('seed rep name', seed.includes("'김원장'"));
assert('seed taxID', seed.includes('120-81-47521'));
assert('seed geo', seed.includes('37.4946') && seed.includes('127.0276'));
assert('seed hours', seed.includes('OpeningHoursSpecification') && seed.includes('09:00'));
assert('seed sameAs', seed.includes('blog.naver.com/seocho'));
assert('seed services', seed.includes('내과진료'));

const helpers = buildUniversalGraphRuntimeHelpersPhp();
assert('helper protocol-agnostic json flags', helpers.includes('JSON_UNESCAPED_UNICODE') && helpers.includes('JSON_UNESCAPED_SLASHES') && helpers.includes('JSON_PRETTY_PRINT'));
assert('helper apply globals', helpers.includes('function redue_apply_graph_globals'));
assert('helper five-core bind', helpers.includes('function redue_bind_org_five_core'));
assert('helper geo', helpers.includes('GeoCoordinates'));
assert('helper hours', helpers.includes('openingHoursSpecification'));
assert('helper availableService', helpers.includes('availableService'));
assert('helper hasOfferCatalog', helpers.includes('hasOfferCatalog'));
assert('helper taxID', helpers.includes('taxID'));
assert('helper faxNumber omit-empty bind', helpers.includes('faxNumber') && helpers.includes("$GLOBALS['redue_fax']"));
assert('helper omit empty NAP keys', helpers.includes("array('taxID', 'faxNumber', 'telephone')"));
assert('helper sameAs', helpers.includes('sameAs'));
assert('helper founder+employee', helpers.includes("'founder'") && helpers.includes("'employee'"));
assert('helper dual catalog', helpers.includes('function redue_bind_dual_service_catalog'));
assert('helper catalog source', helpers.includes('function redue_resolve_service_catalog_source'));
assert('helper catalog title', helpers.includes('주요 서비스 및 진료 카탈로그'));
assert('helper omit empty keys', helpers.includes('function redue_omit_empty_schema_keys'));
assert('helper real person gate', helpers.includes('function redue_has_real_person'));
assert('helper tax accept', helpers.includes('function redue_accept_tax_id') && helpers.includes('function redue_tax_id_checksum_ok'));
assert('helper catalog from menu', helpers.includes('function redue_catalog_from_menu'));
assert('helper official sameAs extract', helpers.includes('function redue_extract_official_sameas'));
assert('helper dummy number reject', helpers.includes('050-0000-0000'));
assert('helper custom page crumbs', helpers.includes('function redue_match_gnb_parent') && helpers.includes('function redue_humanize_filename'));
assert('helper breadcrumb builder', helpers.includes('function redue_build_breadcrumb_list'));
assert('helper breadcrumb 홈', helpers.includes("'홈'"));
assert('helper bo_table/wr_id/co_id', helpers.includes('bo_table') && helpers.includes('wr_id') && helpers.includes('co_id'));
assert('helper ensure breadcrumb', helpers.includes('function redue_ensure_universal_breadcrumb'));

const gnu = generateSchemaInjector({
	siteName: '서초내과의원',
	cmsType: 'Gnuboard',
	industryType: 'MEDICAL',
	telephone: '02-555-1212',
	taxId: '120-81-47521',
	representativeName: '김원장',
	representativeTitle: '대표원장',
	latitude: '37.4946',
	longitude: '127.0276',
	openingHoursOpens: '09:00',
	openingHoursCloses: '18:00',
	sameAs: ['https://blog.naver.com/seocho'],
	pages: [
		{ urlPath: '/', title: '홈', pageType: 'WebPage' },
		{ urlPath: '/intro.php', title: '병원소개' },
	],
	navItems: [{ name: '병원소개', url: '/intro.php' }],
});

assert('injector protocol detect', gnu.includes('function redue_detect_site_protocol'));
assert('injector exact canonical', gnu.includes('function redue_get_exact_canonical'));
assert('injector json flags helper', gnu.includes('redue_jsonld_flags') || gnu.includes('JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT'));
assert('injector org #organization', gnu.includes("/#organization"));
assert('injector person #person', gnu.includes("/#person") && gnu.includes('worksFor'));
assert('injector person url origin', gnu.includes("rtrim($origin, '/') . '/'"));
assert('injector website publisher', gnu.includes("/#website") && gnu.includes('publisher'));
assert(
	'injector webpage about',
	gnu.includes('redue_apply_page_graph_links') &&
		(gnu.includes("'about' => array('@id' => $origin . '/#organization')") ||
			gnu.includes("'about' => array('@id' => $_origin . '/#organization')")),
);
assert('injector breadcrumb ensure', gnu.includes('redue_ensure_universal_breadcrumb'));
assert('injector five-core bind', gnu.includes('redue_bind_org_five_core'));
assert('injector apply globals', gnu.includes('redue_apply_graph_globals'));
assert('injector MedicalClinic', gnu.includes('MedicalClinic'));
assert('injector FAQ evidence-only', gnu.includes('redue_extract_faq_items') && !gnu.includes('예약/상담은 어떻게 하나요'));
assert('injector HowTo evidence-only', gnu.includes('redue_extract_howto_steps') && !gnu.includes('상담/예약 접수'));
assert('injector no dummy seocho coords unless seeded', gnu.includes('37.4946') && !gnu.includes('37.4837'));
assert('injector taxID global', gnu.includes("$GLOBALS['redue_tax_id']"));
assert('injector lat/lng global', gnu.includes("$GLOBALS['redue_lat']") && gnu.includes("$GLOBALS['redue_lng']"));
assert('injector services/hours/sameas global', gnu.includes("$GLOBALS['redue_services']") && gnu.includes("$GLOBALS['redue_hours']") && gnu.includes("$GLOBALS['redue_sameas']"));

const wp = generateSchemaInjector({
	siteName: '한결컨설팅',
	cmsType: 'WordPress',
	targetUrl: 'https://hangyeol.example',
	pages: [{ urlPath: '/', title: '홈' }],
	navItems: [{ name: '서비스', url: '/service' }],
});
assert('wp injector protocol', wp.includes('redue_detect_site_protocol') && wp.includes('redue_get_exact_canonical'));
assert('wp injector globals', UNIVERSAL_GRAPH_GLOBALS.every((key) => wp.includes(`$GLOBALS['${key}']`)));
assert('wp injector breadcrumb', wp.includes('redue_ensure_universal_breadcrumb'));

const uni = buildUniversalObSeoEnginePhp({
	representativeName: '이대표',
	openingHoursOpens: '10:00',
	openingHoursCloses: '19:00',
	sameAs: ['https://www.instagram.com/clinic'],
});
assert('universal ob globals', uni.includes("$GLOBALS['redue_lat']") && uni.includes("$GLOBALS['redue_hours']"));
assert('universal ob five-core', uni.includes('redue_bind_org_five_core'));
assert('universal ob breadcrumb', uni.includes('redue_ensure_universal_breadcrumb'));

const gnuRuntime = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '테스트샵',
	industryType: 'SHOP',
	streetAddress: '서울시 강남구 오염로 1',
});
assert('gnu does not bake street', !gnuRuntime.includes('서울시 강남구 오염로 1'));
assert('gnu still has street interface', gnuRuntime.includes("$GLOBALS['redue_street']"));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nuniversal-graph-builder ok');
