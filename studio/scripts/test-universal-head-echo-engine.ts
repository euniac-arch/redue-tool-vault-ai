/**
 * v35 Universal Head-Echo Schema Engine — protocol match, direct echo, evidence-only FAQ/HowTo.
 * Run: npx tsx scripts/test-universal-head-echo-engine.ts
 */
import { filterOfficialSameAs } from '../lib/audit/extractors/schema-entity-pack';
import {
	buildGnuboardAutomatedRuntimeEnginePhp,
	buildSchemaPageRoutes,
	buildUniversalObSeoEnginePhp,
	generateDynamicPhpSchema,
	refineAssignedPageType,
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

const gnu = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '마음동물병원',
	industryType: 'MEDICAL',
	representativeName: '김수의',
	representativeTitle: '대표원장',
	sameAs: [
		'https://maeum-vet.example/',
		'https://blog.naver.com/maeumvet',
		'https://www.instagram.com/maeumvet',
	],
	pages: [
		{ urlPath: '/', title: '홈', pageType: 'WebPage' },
		{ urlPath: '/clinic.php', title: '내과진료', pageType: 'MedicalWebPage' },
		{ urlPath: '/intro.php', title: '병원소개', pageType: 'AboutPage' },
		{ urlPath: '/contact.php', title: '오시는길', pageType: 'ContactPage' },
	],
	navItems: [
		{ name: '내과진료', url: '/clinic.php' },
		{ name: '병원소개', url: '/intro.php' },
		{ name: '오시는길', url: '/contact.php' },
	],
});

// v33: the body function still uses direct echo (no whole-document buffer/rewrite scanner);
// the ONLY ob_start() is the small redue_render_full_schema() wrapper that turns that direct
// echo output into a return value so it can be deferred to the <meta charset> render anchor.
assert('exactly one scoped ob_start (render wrapper only)', (gnu.match(/ob_start\(\);/g) || []).length === 1);
assert('ships redue_render_full_schema()', gnu.includes('function redue_render_full_schema()'));
assert('direct echo helper', gnu.includes('redue_echo_canonical_pair'));
assert('protocol detect', gnu.includes('redue_detect_site_protocol'));
assert('no https force assign', !gnu.includes("$_SERVER['HTTPS'] = 'on'"));
assert('vet org type', gnu.includes('VeterinaryCare'));
assert('sameAs own-host filter', gnu.includes('redue_is_own_site_url'));
assert('no invented naver host', !gnu.includes("blog.naver.com/' . $domain_host"));
assert('no invented FAQ hours', !gnu.includes('진료시간은 어떻게 되나요'));
assert('howto evidence only', gnu.includes('schema_howto_steps'));
assert('faq evidence only', gnu.includes('schema_faq_items'));
assert('llms txt builder', gnu.includes('function redue_generate_llms_txt()'));
assert('llms full builder', gnu.includes('function redue_generate_llms_full_txt()'));
assert('llms no virtual faq template', !gnu.includes('병원소개는 어디서 받나요') && !gnu.includes('장비소개 실비보험'));
assert('extracts faq from page body', gnu.includes('redue_extract_faq_items'));
assert('extracts howto from page body', gnu.includes('redue_extract_howto_steps'));
assert('collects board/content body', gnu.includes('redue_collect_page_body_html') && gnu.includes("wr_content"));
assert('homepage mainEntity', gnu.includes("'mainEntity' => array('@id' => $origin . '/#organization')"));
assert('homepage hasPart', gnu.includes("'hasPart'"));
assert('schema_pages map', gnu.includes('$schema_pages'));
assert('postal complete helper', gnu.includes('redue_complete_postal_address'));
assert('page type infer helper', gnu.includes('redue_infer_page_schema_type'));
assert('runtime org infer', gnu.includes('function redue_infer_org_types') && gnu.includes('G5_USE_SHOP'));
assert('description refine', gnu.includes('redue_refine_page_description') && gnu.includes('redue_is_nav_dump_description'));
assert('cf_admin_name rep bind', gnu.includes('cf_admin_name'));
assert('org address country', gnu.includes("'addressCountry' => 'KR'") || gnu.includes('addressCountry'));
assert('webpage about org', gnu.includes("'about' => array('@id' => $origin . '/#organization')"));
assert('person knowsAbout', gnu.includes("'knowsAbout'"));
assert('no NBSP', !gnu.includes('\u00A0'));
assert('homepage still classifies as WebPage before composite', gnu.includes("$page_type = 'WebPage';"));
assert('main page medical composite types', gnu.includes("array('MedicalWebPage', 'AboutPage', 'WebPage')"));
assert('alternateName bound', gnu.includes("'alternateName'"));
assert('areaServed administrative', gnu.includes('AdministrativeArea') || gnu.includes('areaServed'));
assert('no invented FAQ reservation', !gnu.includes('예약/상담은 어떻게 하나요') && !gnu.includes('상담/문의는 어떻게 하나요'));
assert('no invented HowTo 4-step', !gnu.includes('상담/예약 접수') && !gnu.includes('맞춤 진행 및 사후관리'));
assert('3-level breadcrumb 홈', gnu.includes("'name' => '홈'"));
assert('founder+employee', gnu.includes("$org_node['founder']") && gnu.includes("$org_node['employee']"));
assert('single ld+json echo', (gnu.match(/application\/ld\+json/g) || []).length === 1);
assert('no duplicate doctype in engine', !/doctype html/i.test(gnu));

const httpMapped = generateDynamicPhpSchema(
	{
		siteName: '서초카페',
		targetUrl: 'http://cafe-seocho.example',
		pages: [
			{ urlPath: '/', title: '홈', pageType: 'WebPage' },
			{ urlPath: '/menu.php', title: '대표메뉴', pageType: 'WebPage' },
		],
		industryType: 'LOCAL_STORE',
		sameAs: ['http://cafe-seocho.example/', 'https://www.instagram.com/seochocafe'],
	},
);
assert('http origin preserved', httpMapped.includes('http://cafe-seocho.example'));
assert('http origin not forced https', !httpMapped.includes("'http://cafe-seocho.example'".replace('http://', 'https://')) || httpMapped.includes('http://cafe-seocho.example'));

const legal = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '법무법인 한결',
	industryType: 'GENERAL',
});
assert('legal name maps LegalService', legal.includes('LegalService'));

const generic = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '한결컨설팅',
	industryType: 'GENERAL',
});
assert('generic org is LocalBusiness', generic.includes('LocalBusiness') && generic.includes('ProfessionalService'));

const uni = buildUniversalObSeoEnginePhp({
	sameAs: ['https://www.youtube.com/@clinic'],
});
assert('universal no ob_start', !uni.includes('ob_start('));
assert('universal protocol helper', uni.includes('redue_align_url_protocol'));

assert('intro → AboutPage', refineAssignedPageType('intro.php', 'WebPage', '인사말', '소개') === 'AboutPage');
assert('facility → AboutPage', refineAssignedPageType('facility.php', 'WebPage', '시설안내', '시설') === 'AboutPage');
assert('staff → ProfilePage', refineAssignedPageType('staff.php', 'WebPage', '의료진', '프로필') === 'ProfilePage');
assert('map → ContactPage', refineAssignedPageType('map.php', 'WebPage', '오시는길', '연락처') === 'ContactPage');
assert('clinic → MedicalWebPage', refineAssignedPageType('clinic.php', 'WebPage', '내과진료', '진료') === 'MedicalWebPage');
const routes = buildSchemaPageRoutes({
	siteName: '마음동물병원',
	industryType: 'MEDICAL',
	origin: 'https://maeum.example',
	pages: [
		{ urlPath: '/intro.php', title: '병원소개', pageType: 'WebPage' },
		{ urlPath: '/clinic.php', title: '내과진료', pageType: 'WebPage' },
		{ urlPath: '/staff.php', title: '의료진' },
	],
	navItems: [{ name: '오시는길', url: '/contact.php' }],
});
assert('schema route intro AboutPage', routes.some((r) => r.file === 'intro.php' && r.type === 'AboutPage'));
assert('schema route clinic MedicalWebPage', routes.some((r) => r.file === 'clinic.php' && r.type === 'MedicalWebPage'));
assert('schema route staff ProfilePage', routes.some((r) => r.file === 'staff.php' && r.type === 'ProfilePage'));
assert('schema route contact ContactPage', routes.some((r) => r.file === 'contact.php' && r.type === 'ContactPage'));
assert(
	'board stays CollectionPage',
	refineAssignedPageType('board.php?bo_table=notice', 'FAQPage', '공지', '') === 'CollectionPage',
);

const filtered = filterOfficialSameAs(
	['https://own.example/', 'https://blog.naver.com/own'],
	'https://own.example',
);
assert('filter drops own domain', filtered.length === 1 && filtered[0].includes('blog.naver.com'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nuniversal-head-echo-engine ok');
