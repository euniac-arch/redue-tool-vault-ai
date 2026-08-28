/**
 * Dynamic industry → Schema.org mapper + 24-point GnuBoard engine smoke.
 * Run: npx tsx scripts/test-industry-schema.ts
 */
import { injectAfterFirstPhpOpen } from '../lib/solve/source-mapping';
import {
	buildGnuboardAutomatedRuntimeEnginePhp,
	generateDynamicPhpSchema,
	sanitizePhpCode,
} from '../lib/solve/dynamic-php-schema';
import { classifyIndustrySchema, splitAlternateName } from '../lib/solve/core/industry-schema';
import { applyCmsAdapterWrap } from '../lib/solve/adapters';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

assert(
	'vet types',
	classifyIndustrySchema({ siteName: '마음동물병원', title: '반려동물 24시 진료' }).orgTypes[0] ===
		'VeterinaryCare',
);
assert(
	'medical types',
	classifyIndustrySchema({
		siteName: '서초내과의원',
		description: '내과 클리닉 진료 안내',
		industryType: 'MEDICAL',
	}).orgTypes.includes('MedicalClinic'),
);
assert(
	'dental types',
	classifyIndustrySchema({ siteName: '강남치과', description: '임플란트 전문' }).orgTypes[0] === 'Dentist',
);
assert(
	'professional types',
	classifyIndustrySchema({ siteName: '한결컨설팅', description: '마케팅 에이전시' }).orgTypes[0] ===
		'ProfessionalService',
);
assert(
	'legal types',
	classifyIndustrySchema({ siteName: '법무법인 한결' }).orgTypes[0] === 'LegalService',
);
assert(
	'accounting types',
	classifyIndustrySchema({ siteName: '한결세무회계' }).orgTypes[0] === 'AccountingService',
);
assert(
	'education types',
	classifyIndustrySchema({ siteName: '강남수학학원', menuTexts: ['입시', '과외'] }).orgTypes[0] ===
		'EducationalOrganization',
);
assert(
	'commerce types',
	classifyIndustrySchema({ siteName: '영카트몰', description: '온라인 쇼핑몰' }).orgTypes.includes('OnlineStore'),
);
assert(
	'local fallback',
	classifyIndustrySchema({ siteName: '한결산업' }).orgTypes[0] === 'LocalBusiness',
);
assert(
	'no previous-site leak',
	classifyIndustrySchema({ siteName: '한결산업' }).orgTypes.includes('MedicalClinic') === false,
);

const alt = splitAlternateName('서초내과의원 | 맞춤 진료');
assert('alternateName split', alt.name === '서초내과의원' && alt.alternateName === '맞춤 진료');

const pages = [
	{ urlPath: '/', title: '홈', pageType: 'WebPage' },
	{ urlPath: '/intro.php', title: '병원소개' },
	{ urlPath: '/staff.php', title: '의료진' },
	{ urlPath: '/clinic.php', title: '내과진료' },
	{ urlPath: '/quote.php', title: '상담/견적' },
	{ urlPath: '/bbs/board.php?bo_table=notice', title: '공지사항' },
];
const nav = [
	{ name: '병원소개', url: '/intro.php' },
	{ name: '의료진', url: '/staff.php' },
	{ name: '내과진료', url: '/clinic.php' },
	{ name: '상담/견적', url: '/quote.php' },
];

const php = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '서초내과의원',
	industryType: 'MEDICAL',
	telephone: '02-555-1212',
	streetAddress: '서울 서초구 서초대로 10',
	addressLocality: '서초구',
	addressRegion: '서울',
	representativeName: '김원장',
	representativeTitle: '대표원장',
	latitude: '37.4946',
	longitude: '127.0276',
	sameAs: ['https://blog.naver.com/seocho', 'https://seocho-clinic.example/'],
	pages,
	navItems: nav,
	footerText: '서초내과의원 | 대표 김원장 | 02-555-1212 | 서울 서초구 서초대로 10',
	openingHoursOpens: '09:00',
	openingHoursCloses: '18:00',
});

const checklist: Array<[string, boolean]> = [
	['01 org @type MedicalClinic', php.includes('MedicalClinic')],
	['02 name + alternateName', php.includes("'name' => $site_name") && php.includes('alternateName')],
	['03 telephone seed', php.includes("$GLOBALS['redue_tel']") || php.includes('redue_format_telephone')],
	['04 PostalAddress', php.includes('PostalAddress') && php.includes('addressCountry')],
	['05 GeoCoordinates', php.includes('GeoCoordinates')],
	['06 OpeningHoursSpecification', php.includes('OpeningHoursSpecification')],
	['07 logo ImageObject', php.includes("'@type' => 'ImageObject'")],
	['08 sameAs filter', php.includes('redue_is_own_site_url') && php.includes('blog.naver.com/seocho')],
	['09 priceRange omit-empty', php.includes('$price_range') && !php.includes("'₩₩'")],
	['10 availableService', php.includes('availableService') || php.includes('available_services')],
	['11 areaServed', php.includes('areaServed') && php.includes('AdministrativeArea')],
	['12 #organization', php.includes("/#organization")],
	['13 #website + publisher', php.includes("/#website") && php.includes('publisher')],
	['14 #person + worksFor', php.includes("/#person") && php.includes('worksFor')],
	['15 knowsAbout', php.includes('knowsAbout')],
	['16 schema_pages', php.includes('$schema_pages') && php.includes('AboutPage') && php.includes('ProfilePage')],
	['17 main composite types', php.includes("array('MedicalWebPage', 'AboutPage', 'WebPage')")],
	['18 hasPart', php.includes("'hasPart'")],
	['19 BreadcrumbList', php.includes('BreadcrumbList') && php.includes("'name' => '홈'")],
	['20 service mainEntity', php.includes('#service') && php.includes('MedicalProcedure')],
	['21 FAQPage evidence-only', php.includes('FAQPage') && php.includes('schema_faq_items') && php.includes('redue_extract_faq_items') && !php.includes('예약/상담은 어떻게 하나요')],
	['22 HowTo evidence-only', php.includes("'@type' => 'HowTo'") && php.includes('schema_howto_steps') && php.includes('redue_extract_howto_steps') && !php.includes('상담/예약 접수')],
	['23 canonical allowlist', php.includes('bo_table') && php.includes('wr_id') && php.includes('co_id')],
	['24 no NBSP', !php.includes('\u00A0')],
];

for (const [label, ok] of checklist) {
	assert(label, ok);
}

assert('no hardcoded koreaionlab', !/koreaionlab/i.test(php));
assert('no invented 중입자 default knowsAbout', !php.includes("'중입자치료'"));
assert(
	'no theme self-delegation',
	!/require_once\s*\(\s*G5_THEME_PATH/.test(php) && !/include_once\s*\(\s*\$theme_head_file/.test(php),
);
assert('2-phase render fn', php.includes('function redue_render_full_schema()'));
assert('2-phase render marker', php.includes('REDUE_AI_STUDIO_RENDER:START'));
assert('phase1 does not bare-echo schema', /function redue_render_full_schema/.test(php));

const themeSrc = `<?php
if (!defined('_GNUBOARD_')) exit;
?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>demo</title>
</head>
<body></body>
</html>
`;
const wrapped = applyCmsAdapterWrap(php, 'gnuboard', 'theme/basic/head.sub.php');
const injected = injectAfterFirstPhpOpen(themeSrc, wrapped, { targetPath: 'theme/basic/head.sub.php' });
assert('2-phase inject ok', injected.ok);
assert('no inlined engine in head.sub.php', !injected.result.includes('REDUE_AI_STUDIO:START'));
assert(
	'render after charset',
	injected.result.indexOf('charset') < injected.result.indexOf('REDUE_AI_STUDIO_RENDER:START'),
);
assert('sanitizer strips NBSP', !sanitizePhpCode('a\u00A0b').includes('\u00A0'));
assert('no G5_THEME_PATH in theme inject', !/G5_THEME_PATH/.test(injected.result));

const shop = generateDynamicPhpSchema(
	{
		siteName: '영카트몰',
		pages: [{ urlPath: '/', title: '홈' }],
		industryType: 'SHOP',
		cmsType: 'gnuboard',
		navItems: [{ name: '상품목록', url: '/shop.php' }],
	},
	{ cmsType: 'gnuboard', siteName: '영카트몰', industryType: 'SHOP' },
);
assert('shop OnlineStore', shop.includes('OnlineStore'));
assert(
	'shop org type is store bucket',
	/\$GLOBALS\['redue_org_type'\]\s*=\s*array\('OnlineStore'/.test(shop),
);
assert('runtime org infer helper', php.includes('function redue_infer_org_types'));
assert(
	'no EducationalOrganization default seed',
	!/\$GLOBALS\['redue_org_type'\]\s*=\s*array\('EducationalOrganization'/.test(php),
);

const academy = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '강남수학학원',
	industryType: 'GENERAL',
	pages: [{ urlPath: '/teacher.php', title: '강사진 소개' }],
	navItems: [{ name: '강사진 소개', url: '/teacher.php' }],
});
assert('academy EducationalOrganization', academy.includes('EducationalOrganization'));
assert('teacher ProfilePage', academy.includes('ProfilePage'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nindustry-schema + 24-point gnu engine ok');
