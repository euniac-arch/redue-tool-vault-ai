/**
 * Smoke test: Universal Header Finder + Hybrid generateDynamicPhpSchema (v14)
 * + v22 Top-Priority inject after first <?php (existing meta/verification preserved)
 * + Context Variable Injection (FAQ/Person/Article)
 * + legalName labeled-only · Title/knowsAbout paging reject · region URL 1:1
 * + og:type precision · Parent Fallback Hierarchy (치료정보)
 * + Index Parent sanitize · footer telephone/email/PostalAddress
 */
import {
	generateDynamicPhpSchema,
	buildSchemaMappingJson,
	parseSchemaMappingJson,
	pagesFromAuditPaths,
	isGarbagePageFile,
	isMedicalContentPage,
	sanitizePageFileKey,
	sanitizeMainPageTitle,
	isPagingNoiseTitle,
	isBlockedLegalNameText,
	resolveHumanPageTitle,
	stripHardcodedMetaEchoes,
	stripHardcodedCanonicalTags,
	enforceHttps,
	refineAssignedPageType,
	buildMainPageItemListBuckets,
	buildPageMaps,
	resolveBrandAndLegalName,
	resolveParentHierarchy,
	extractLegalEntityFromCorpus,
	extractOrgContactFromFooter,
	classifyHospitalRegion,
	resolveNetworkHubByRegion,
	isActionServiceName,
	buildUniversalObSeoEnginePhp,
	buildNewsArticleAutoDetectPhp,
	buildExactCanonicalPhpBlock,
	buildCrawlerOptimizedCanonicalHeadFragment,
	DEFAULT_CANCER_TYPE_NAMES,
	DEFAULT_CANCER_TYPE_PAGES,
	DEFAULT_HOSPITAL_NETWORK_NAMES,
	DEFAULT_MAIN_SERVICE_NAMES,
	DEFAULT_TREATMENT_NAMES,
	HOSPITAL_NETWORK_SEEDS,
} from '../lib/solve/dynamic-php-schema';
import {
	detectGlobalHeadTargets,
	rankHeaderPathPriority,
	scoreGlobalHeadCandidate,
	injectBeforeClosingHead,
	injectAfterCharsetOrHead,
	formatPrimaryHeaderBadge,
	analyzeGnuboardThemeUsage,
	parseCfThemeFromConfig,
} from '../lib/solve/source-mapping';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(rankHeaderPathPriority('theme/basic/head.sub.php') === 100, 'rank 100');
assert(rankHeaderPathPriority('head.sub.php') === 90, 'rank 90');
assert(rankHeaderPathPriority('inc/head.php') === 80, 'rank 80');
assert(rankHeaderPathPriority('index.html') === 70, 'rank 70');

assert(parseCfThemeFromConfig("$config['cf_theme'] = 'basic';") === 'basic', 'cf_theme basic');
assert(parseCfThemeFromConfig("$config['cf_theme'] = '';") === null, 'cf_theme empty');

const rootStub = "<?php include G5_THEME_PATH.'/head.sub.php';";
const themeHead = '<!DOCTYPE html><html><head><title>t</title></head><body></body></html>';
const rootRealHead =
	'<!DOCTYPE html><html><head><title>root</title></head><body><?php /* site */ ?></body></html>';

// Case B: `$config['cf_theme'] = 'basic'` → theme/{name}/head.sub.php = 200, root = 150
const targets = detectGlobalHeadTargets({
	relativePaths: [
		'head.sub.php',
		'config.php',
		'theme/basic/head.sub.php',
		'theme/basic/head.php',
		'index.php',
	],
	cms: 'Gnuboard',
	fileContents: {
		'head.sub.php': rootStub,
		'config.php': "<?php $config['cf_theme'] = 'basic';",
		'theme/basic/head.sub.php': themeHead,
	},
});
assert(targets[0]?.isPrimary === true, 'primary');
assert(targets[0]?.path === 'theme/basic/head.sub.php', `theme promoted: ${targets[0]?.path}`);
assert(targets[0]?.score === 200, `theme score 200: ${targets[0]?.score}`);
assert(
	targets[0]?.badge === formatPrimaryHeaderBadge('테마 사용: theme/basic/head.sub.php 감지'),
	`badge theme active: ${targets[0]?.badge}`,
);
assert(scoreGlobalHeadCandidate('head.sub.php', rootStub) === 0, 'stub excluded');

// Case B with real root head: root remains secondary at 150
const caseBRoot = detectGlobalHeadTargets({
	relativePaths: ['head.sub.php', 'config.php', 'theme/basic/head.sub.php', 'index.php'],
	cms: 'Gnuboard',
	fileContents: {
		'head.sub.php': rootRealHead,
		'config.php': "<?php $config['cf_theme'] = 'basic';",
		'theme/basic/head.sub.php': themeHead,
	},
});
assert(caseBRoot[0]?.path === 'theme/basic/head.sub.php', `case B primary: ${caseBRoot[0]?.path}`);
assert(caseBRoot[0]?.score === 200, `case B theme 200: ${caseBRoot[0]?.score}`);
const caseBRootHit = caseBRoot.find((t) => t.path === 'head.sub.php');
assert(caseBRootHit?.score === 150, `case B root 150: ${caseBRootHit?.score}`);

// Case A: cf_theme empty — even with G5_THEME_PATH leftover, root wins (200), theme/ = 50
const ghostUsage = analyzeGnuboardThemeUsage({
	relativePaths: ['head.sub.php', 'config.php', 'theme/basic/head.sub.php', 'index.php'],
	fileContents: {
		'head.sub.php': rootRealHead,
		'config.php': "<?php $config['cf_theme'] = '';",
		'theme/basic/head.sub.php': themeHead,
	},
});
assert(ghostUsage.active === false, 'ghost theme inactive');
assert(ghostUsage.themeName === null, 'no theme name when cf_theme empty');

// G5_THEME_PATH alone must NOT activate theme when cf_theme is empty
const g5OnlyUsage = analyzeGnuboardThemeUsage({
	relativePaths: ['head.sub.php', 'config.php', 'theme/basic/head.sub.php'],
	fileContents: {
		'head.sub.php': rootStub,
		'config.php': "<?php $config['cf_theme'] = '';",
		'theme/basic/head.sub.php': themeHead,
	},
});
assert(g5OnlyUsage.active === false, 'G5 stub + empty cf_theme → inactive');

const ghostTargets = detectGlobalHeadTargets({
	relativePaths: ['head.sub.php', 'config.php', 'theme/basic/head.sub.php', 'index.php'],
	cms: 'Gnuboard',
	fileContents: {
		'head.sub.php': rootRealHead,
		'config.php': "<?php $config['cf_theme'] = '';",
		'theme/basic/head.sub.php': themeHead,
	},
});
assert(ghostTargets[0]?.path === 'head.sub.php', `root primary: ${ghostTargets[0]?.path}`);
assert(ghostTargets[0]?.score === 200, `root score 200: ${ghostTargets[0]?.score}`);
assert(ghostTargets[0]?.isPrimary === true, 'root isPrimary');
const ghostTheme = ghostTargets.find((t) => t.path.startsWith('theme/'));
assert(ghostTheme?.score === 50, `theme demoted to 50: ${ghostTheme?.score}`);
assert(
	ghostTargets[0]?.badge ===
		formatPrimaryHeaderBadge('테마 미사용 사이트: 루트 /head.sub.php 감지'),
	`badge theme inactive: ${ghostTargets[0]?.badge}`,
);

// ① Sanitization + HTTPS
assert(isGarbagePageFile('title%3E.php') === true, 'garbage title%3E');
assert(isGarbagePageFile('%3Cmeta.php') === true, 'garbage %3Cmeta');
assert(isGarbagePageFile('about.php?x=1') === true, 'garbage query');
assert(isGarbagePageFile('101.php') === false, 'valid 101.php');
assert(isGarbagePageFile('Breadcrumb.php') === true, 'garbage Breadcrumb.php');
assert(isGarbagePageFile('23.php') === true, 'garbage short numeric stub');
assert(isGarbagePageFile('Service Details.php') === true, 'garbage Service Details');
assert(isGarbagePageFile('service-details.html') === true, 'garbage service-details.html');
assert(isGarbagePageFile('/test/foo.php') === true, 'garbage /test/ path');
assert(isGarbagePageFile('/bbs/board.php?bo_table=notice') === false, 'board.php?bo_table kept');
assert(isGarbagePageFile('board.php?bo_table=notice') === false, 'board identity key kept');
assert(sanitizePageFileKey('/title%3E.php') === null, 'sanitize null');
assert(sanitizePageFileKey('/101.php') === '101.php', 'sanitize 101');
assert(
	sanitizePageFileKey('/bbs/board.php?bo_table=notice&page=2') === 'board.php?bo_table=notice',
	'sanitize board identity query',
);
assert(
	sanitizePageFileKey('/index.php?page_id=about&utm_source=x') === 'index.php?page_id=about',
	'sanitize page_id identity query',
);
assert(sanitizePageFileKey('/?p=123') === 'index.php?p=123' || sanitizePageFileKey('/index.php?p=123') === 'index.php?p=123', 'sanitize p identity query');
assert(sanitizePageFileKey('/view.php?idx=42') === 'view.php?idx=42', 'sanitize idx identity query');
assert(enforceHttps('http://example.com/a') === 'https://example.com/a', 'https enforce');
assert(
	refineAssignedPageType('board.php?bo_table=qa', 'FAQPage', 'Q&A', '고객센터') === 'CollectionPage',
	'qa board → CollectionPage',
);
assert(
	refineAssignedPageType('101.php', 'MedicalWebPage', '연구소 소개', '연구소 소개') === 'WebPage',
	'intro page not MedicalWebPage',
);
assert(
	refineAssignedPageType('301.php', 'WebPage', '중입자치료', '중입자치료') === 'MedicalWebPage',
	'treatment page MedicalWebPage',
);
assert(isMedicalContentPage('301.php') === true, '301.php medical by filename');
assert(isMedicalContentPage('304.php') === true, '304.php medical by filename');
assert(isMedicalContentPage('600.php') === true, '600.php medical by filename');
assert(isMedicalContentPage('601.php') === true, '601.php medical by filename');
assert(isMedicalContentPage('613.php') === true, '613.php medical by filename');
assert(
	refineAssignedPageType('601.php', 'WebPage', '전립선암', '적용 대상암') === 'MedicalWebPage',
	'601.php MedicalWebPage',
);
assert(
	refineAssignedPageType('302.php', 'WebPage', '', '') === 'MedicalWebPage',
	'302.php MedicalWebPage without title',
);

// ② Human title / section from nav (not bare filename)
assert(
	resolveHumanPageTitle({
		file: '101.php',
		title: '101',
		navName: '연구소 소개',
		siteName: '테스트연구소',
	}) === '연구소 소개',
	'nav title wins over 101',
);

const llmJson = {
	pages: {
		'index.php': { title: '예담동물의료센터', desc: '동물병원', schemaType: 'MedicalWebPage' },
		's101.php': {
			title: '병원소개',
			desc: '소개입니다',
			schemaType: 'AboutPage',
			section: '예담소개',
			menu1: '예담소개',
			menu2: '소개',
		},
		'title%3E.php': { title: 'garbage', desc: 'x', schemaType: 'WebPage' },
		'101.php': {
			title: '101',
			desc: '연구소 소개 상세 설명',
			schemaType: 'AboutPage',
			section: '연구소 소개',
		},
	},
	nav: [{ name: '연구소 소개', url: '/101.php' }],
};
const parsed = parseSchemaMappingJson(llmJson);
assert(parsed && parsed.pages['s101.php'].menu1 === '예담소개', 'parse menu1');
assert(parsed && !parsed.pages['title%3E.php'], 'garbage page excluded from parse');
assert(parsed && parsed.pages['101.php'].title === '연구소 소개', '101 → 연구소 소개');
assert(parsed && parsed.pages['101.php'].section === '연구소 소개', 'section mapped');

const php = generateDynamicPhpSchema(llmJson, {
	siteName: '예담동물의료센터',
	targetUrl: 'https://yedam.example.com',
	industryType: 'MEDICAL',
});
assert(php.includes('parse_url'), 'parse_url');
assert(php.includes('$page_meta'), 'page_meta');
assert(php.includes('$page_schema'), 'page_schema');
assert(php.includes('예담소개'), 'menu1 in php');
assert(php.includes("'section'"), 'section key in page_meta');
assert(php.includes('연구소 소개'), 'human title in php');
assert(!php.includes('title%3E'), 'no garbage in php');
assert(php.includes('ProfessionalService'), 'ProfessionalService');
assert(php.includes('Organization'), 'Organization');
assert(php.includes('knowsAbout'), 'knowsAbout');
assert(!php.includes('MedicalOrganization'), 'no MedicalOrganization');
assert(php.includes('$schema_meta_title'), 'schema_meta_title');
assert(php.includes('$schema_meta_description'), 'schema_meta_description');
assert(php.includes('name="description"'), 'meta description');
assert(php.includes('rel="canonical"'), 'canonical');
assert(php.includes('property="og:title"'), 'og:title');
assert(php.includes('JSON_UNESCAPED_UNICODE'), 'json flags');
assert(php.includes('JSON_PRETTY_PRINT'), 'pretty');
// Homepage forced to WebPage — LLM MedicalWebPage must not stick
assert(parsed && parsed.pages['index.php'].schemaType === 'WebPage', 'index schemaType WebPage');
assert(/'index\.php'\s*=>\s*array\('WebPage',\s*'BreadcrumbList'\)/.test(php), 'index.php page_schema WebPage+BreadcrumbList');
assert(!/'index\.php'\s*=>\s*array\([^)]*'Article'/.test(php), 'index.php has no Article');
assert(!/'index\.php'\s*=>\s*array\([^)]*'MedicalWebPage'/.test(php), 'index.php has no MedicalWebPage');

// HTML-only fixture (no <?php) → </head> fallback
const injected = injectBeforeClosingHead(themeHead, php);
assert(injected.ok, 'inject ok');
assert(injected.anchor === 'head-close', 'HTML fixture uses head-close fallback');
assert(
	injected.result.includes('</head>') &&
		injected.result.indexOf('REDUE_AI_STUDIO') < injected.result.indexOf('</head>'),
	'inject before </head> on HTML-only head',
);

// Real Gnuboard-style head.sub.php with leading <?php → v22 top-priority
const phpHeadFixture = `<?php
if (!defined('_GNUBOARD_')) exit;
?>
<!DOCTYPE html><html><head>
<meta name="naver-site-verification" content="keep-me">
<title>t</title>
</head><body></body></html>`;
const phpTopInjected = injectBeforeClosingHead(phpHeadFixture, php);
assert(phpTopInjected.ok, 'php top inject ok');
assert(phpTopInjected.anchor === 'php-open-top', 'v22 php-open-top anchor');
assert(
	phpTopInjected.result.indexOf('<?php') < phpTopInjected.result.indexOf('REDUE_AI_STUDIO') &&
		phpTopInjected.result.indexOf('REDUE_AI_STUDIO') < phpTopInjected.result.indexOf('naver-site-verification'),
	'OB engine after first <?php; Naver verification preserved below',
);
assert(
	phpTopInjected.result.includes('naver-site-verification'),
	'never deletes Naver site verification meta',
);
assert(
	phpTopInjected.result.includes("if (!defined('_GNUBOARD_')) exit;"),
	'preserves existing PHP guard',
);
assert(
	phpTopInjected.result.lastIndexOf('redue_dynamic_schema_controller();') >
		phpTopInjected.result.indexOf('<head'),
	'hybrid controller call stays near head (not before doctype)',
);

const det = buildSchemaMappingJson({
	siteName: 'Test',
	pages: pagesFromAuditPaths({
		siteName: 'Test',
		collectedUrlPaths: ['/', '/about.php', '/title%3E.php', '/x.php?a=1'],
		mainTitle: 'Test',
		navItems: [{ name: '소개', url: '/about.php' }],
	}),
	navItems: [{ name: '소개', url: '/about.php' }],
});
assert(det.pages['index.php'], 'main index kept');
assert(det.pages['about.php'], 'deterministic mapping');
assert(det.pages['about.php'].title === '소개', 'nav-mapped about title');
assert(det.pages['about.php'].section === '소개', 'section present');
assert(!det.pages['title%3E.php'], 'garbage excluded from mapping');
assert(!det.pages['x.php'], 'junk query excluded');

const mapped = pagesFromAuditPaths({
	siteName: '한국중입자 암치료연구소',
	collectedUrlPaths: [
		'/',
		'/101.php',
		'/bbs/board.php?bo_table=notice',
		'/bbs/board.php?bo_table=qa',
		'/301.php',
		'/Breadcrumb.php',
		'/23.php',
	],
	mainTitle: '한국중입자 암치료연구소',
	mainH1: '한국중입자 암치료연구소',
	industryType: 'MEDICAL',
	navItems: [
		{ name: '연구소 소개', url: '/101.php' },
		{ name: '공지사항', url: '/bbs/board.php?bo_table=notice' },
		{ name: 'Q&A', url: '/bbs/board.php?bo_table=qa' },
		{ name: '중입자치료', url: '/301.php' },
		{ name: '적합성 사전 검토', url: '/201.php#eligibility-review' },
		{ name: '해외 전문병원 연결', url: '/201.php#hospital-support' },
		{ name: '적용 대상암', url: '/600.php' },
		{ name: '해외 병원 네트워크', url: '/401.php' },
	],
	crawledPages: [
		{ urlPath: '/101.php', title: '연구소 소개', h1: '연구소 소개' },
		{ urlPath: '/bbs/board.php?bo_table=notice', title: '공지사항', h1: '공지사항' },
		{ urlPath: '/bbs/board.php?bo_table=qa', title: 'Q&A', h1: 'Q&A' },
		{ urlPath: '/301.php', title: '중입자치료', h1: '중입자치료' },
		{ urlPath: '/600.php', title: '적용 대상암', h1: '적용 대상암' },
		{ urlPath: '/401.php', title: '해외 병원 네트워크', h1: '해외 병원 네트워크' },
	],
});
const byPath = Object.fromEntries(mapped.map((p) => [sanitizePageFileKey(p.urlPath) || p.urlPath, p]));
assert(byPath['101.php']?.title === '연구소 소개', '101 title');
assert(byPath['101.php']?.h1 === '연구소 소개', '101 h1');
assert(byPath['101.php']?.pageType === 'WebPage', '101 WebPage not MedicalWebPage');
assert(byPath['board.php?bo_table=notice']?.title === '공지사항', 'notice title');
assert(byPath['board.php?bo_table=notice']?.h1 === '공지사항', 'notice h1');
assert(byPath['board.php?bo_table=qa']?.pageType === 'CollectionPage', 'qa board CollectionPage');
assert(byPath['301.php']?.title === '중입자치료', '301 title');
assert(byPath['301.php']?.pageType === 'MedicalWebPage', '301 MedicalWebPage');
assert(!mapped.some((p) => (sanitizePageFileKey(p.urlPath) || '').toLowerCase() === 'breadcrumb.php'), 'Breadcrumb skipped');
assert(!mapped.some((p) => (sanitizePageFileKey(p.urlPath) || '') === '23.php'), '23.php skipped');
assert(!mapped.some((p) => p.title === '진료안내' && p.urlPath.includes('101')), 'no GNB chrome title leak');

const boardPhp = generateDynamicPhpSchema(
	buildSchemaMappingJson({
		siteName: '한국중입자 암치료연구소',
		targetUrl: 'http://example.com',
		pages: mapped,
		industryType: 'MEDICAL',
		navItems: [
			{ name: '연구소 소개', url: '/101.php' },
			{ name: 'Q&A', url: '/bbs/board.php?bo_table=qa' },
			{ name: '중입자치료', url: '/301.php' },
			{ name: '적합성 사전 검토', url: '/201.php#eligibility-review' },
			{ name: '해외 전문병원 연결', url: '/201.php#hospital-support' },
			{ name: '적용 대상암', url: '/600.php' },
			{ name: '일본 병원', url: '/401.php#' },
			{ name: '독일 병원', url: '/402.php#' },
			{ name: '서비스 소개', url: '/service-intro.php' },
			{ name: '공지사항', url: '/bbs/board.php?bo_table=notice' },
		],
		knowsAbout: ['중입자치료', '해외 암치료', '공지사항', 'bbs', '2페이지', 'Page 3'],
		legalName: '중입자암치료지원연구소',
		areaServed: ['대한민국', '일본', '독일'],
		footerText:
			'상호: 중입자암치료지원연구소 | 사업자등록번호 000-00-00000 | 전화: 02-1234-5678 | 이메일: info@carbon-ion.kr | 주소: 서울특별시 강남구 테헤란로 123 5층',
	}),
	{
		siteName: '한국중입자 암치료연구소',
		targetUrl: 'http://example.com',
		industryType: 'MEDICAL',
		legalName: '중입자암치료지원연구소',
		areaServed: ['대한민국', '일본', '독일'],
		footerText:
			'상호: 중입자암치료지원연구소 | 전화: 02-1234-5678 | 이메일: info@carbon-ion.kr | 주소: 서울특별시 강남구 테헤란로 123 5층',
	},
);
assert(boardPhp.includes("board.php?bo_table=notice") || boardPhp.includes("board.php?bo_table=qa"), 'board key in php');
assert(boardPhp.includes('bo_table'), 'runtime bo_table lookup');
assert(boardPhp.includes('연구소 소개'), '101 title in php');
assert(boardPhp.includes('CollectionPage'), 'board list → CollectionPage');
assert(boardPhp.includes("'parent'"), 'parent key in page_meta');
assert(boardPhp.includes("'parent_url'"), 'parent_url key in page_meta');
assert(boardPhp.includes('legalName'), 'legalName GEO field');
assert(boardPhp.includes('중입자암치료지원연구소'), 'legalName bound');
assert(boardPhp.includes("'한국중입자 암치료연구소'"), 'brand name bound');
assert(
	/\$site_name = '한국중입자 암치료연구소';/.test(boardPhp) &&
		/\$legal_name = '중입자암치료지원연구소';/.test(boardPhp),
	'brand ≠ legalName split in PHP',
);
assert(boardPhp.includes('contactPoint'), 'contactPoint GEO field');
assert(boardPhp.includes('areaServed'), 'areaServed GEO field');
assert(boardPhp.includes('대한민국'), 'areaServed KR');
assert(boardPhp.includes('/#main-services'), 'main-services ItemList');
assert(boardPhp.includes('/#treatments'), 'treatments ItemList');
assert(boardPhp.includes('/#cancer-types'), 'cancer-types ItemList');
assert(boardPhp.includes('/#hospital-network'), 'hospital-network ItemList');
assert(boardPhp.includes('eligibility-review'), 'service hash binding');
assert(boardPhp.includes('v14') || boardPhp.includes('v12') || boardPhp.includes('v11'), 'v14/v12 controller marker');
assert(boardPhp.includes("schema_faq_items"), 'FAQ context var scan');
assert(boardPhp.includes("schema_person"), 'Person context var scan');
assert(boardPhp.includes("schema_article"), 'Article context var scan');
assert(boardPhp.includes('Single JSON-LD Output Guarantee') || boardPhp.includes('Context Variable Injection'), 'v8 architecture comments');
assert(!boardPhp.includes('LocalBusiness'), 'no LocalBusiness node');
assert(!boardPhp.includes("'http://example.com"), 'no http origin literal');
assert(boardPhp.includes('https://example.com'), 'https origin from http input');
assert(boardPhp.includes("preg_replace('#^http://#i', 'https://'"), 'runtime https coerce');
assert(!boardPhp.includes('Service Details'), 'no Service Details node');
// v11: Organization telephone / email / PostalAddress from footer
assert(boardPhp.includes("'telephone' => '02-1234-5678'"), 'Organization telephone bound');
assert(boardPhp.includes("'email' => 'info@carbon-ion.kr'"), 'Organization email bound');
assert(boardPhp.includes("'@type' => 'PostalAddress'"), 'PostalAddress node');
assert(boardPhp.includes("'streetAddress' => '테헤란로 123 5층'") || boardPhp.includes('테헤란로'), 'streetAddress bound');
assert(boardPhp.includes("'addressLocality' => '강남구'"), 'addressLocality 강남구');
assert(boardPhp.includes("'addressRegion' => '서울특별시'"), 'addressRegion 서울특별시');
assert(boardPhp.includes("'addressCountry' => 'KR'"), 'addressCountry KR');
assert(boardPhp.includes("Organization', 'ProfessionalService"), 'Organization+ProfessionalService');
{
	const mainSvcBlock = boardPhp.match(/\/#main-services'[\s\S]*?itemListElement'\s*=>\s*array\(([\s\S]*?)\)\s*,\s*\)\s*;/);
	assert(mainSvcBlock, 'main-services block present');
	assert(!/서비스\s*소개/.test(mainSvcBlock![1]!), 'main-services excludes 서비스 소개');
	assert(!/공지사항/.test(mainSvcBlock![1]!), 'main-services excludes 공지사항');
	assert(/사전\s*검토/.test(mainSvcBlock![1]!), 'main-services keeps 사전 검토');
}
assert(boardPhp.includes('간암'), 'cancer-types expands 간암');
assert(boardPhp.includes('췌장암'), 'cancer-types expands 췌장암');
assert(boardPhp.includes('QST 병원'), 'hospital-network expands QST');
assert(boardPhp.includes('오사카중입자선센터'), 'hospital-network expands Osaka');
assert(boardPhp.includes('/600.php'), 'cancer hub 600.php');
assert(boardPhp.includes('/601.php'), 'cancer leaf 601.php in schema');
assert(boardPhp.includes('/613.php'), 'cancer leaf 613.php in schema');
assert(boardPhp.includes("'601.php'"), '601.php in $page_meta');
assert(boardPhp.includes("'613.php'"), '613.php in $page_meta');
assert(boardPhp.includes('/401.php'), 'hospital hub 401.php');
assert(boardPhp.includes('/402.php'), 'hospital hub 402.php');
// #cancer-types must use flat ListItem (no nested Service) — semantic precision
{
	const cancerBlock = boardPhp.match(/\/#cancer-types'[\s\S]*?itemListElement'\s*=>\s*array\(([\s\S]*?)\)\s*,\s*\)\s*;/);
	assert(cancerBlock, 'cancer-types block present');
	assert(!cancerBlock![1]!.includes("'@type' => 'Service'"), 'cancer-types has no Service type');
	assert(cancerBlock![1]!.includes("'@type' => 'ListItem'"), 'cancer-types uses ListItem');
	assert(/'name'\s*=>/.test(cancerBlock![1]!), 'cancer-types ListItem has name');
	assert(/'url'\s*=>/.test(cancerBlock![1]!), 'cancer-types ListItem has url');
}
{
	const hospitalBlock = boardPhp.match(/\/#hospital-network'[\s\S]*?itemListElement'\s*=>\s*array\(([\s\S]*?)\)\s*,\s*\)\s*;/);
	assert(hospitalBlock, 'hospital-network block present');
	assert(!hospitalBlock![1]!.includes("'@type' => 'Service'"), 'hospital-network has no Service type');
}
{
	const knowsBlocks = [...boardPhp.matchAll(/'knowsAbout'\s*=>\s*array\(([\s\S]*?)\)\s*,/g)];
	assert(knowsBlocks.length > 0, 'knowsAbout block present');
	for (const m of knowsBlocks) {
		assert(!m[1]!.includes("'공지사항'"), 'knowsAbout excludes 공지사항');
		assert(!m[1]!.includes("'bbs'"), 'knowsAbout excludes bbs');
		assert(!m[1]!.includes("'맞춤 치료'"), 'knowsAbout excludes 맞춤 치료');
		assert(!m[1]!.includes("'전문 의료 상담'"), 'knowsAbout excludes 전문 의료 상담');
		assert(!m[1]!.includes("'Service Details'"), 'knowsAbout excludes Service Details');
		assert(!m[1]!.includes("'2페이지'"), 'knowsAbout excludes 2페이지');
		assert(!m[1]!.includes("'Page 3'"), 'knowsAbout excludes Page 3');
	}
}

// Unique treatments: same name must not bind to both 301.php and 302.php
const dupMaps = buildPageMaps({
	siteName: '한국중입자 암치료연구소',
	targetUrl: 'https://example.com',
	industryType: 'MEDICAL',
	pages: [
		...mapped,
		{ urlPath: '/302.php', title: '중입자치료', h1: '중입자치료', pageType: 'MedicalWebPage' },
		{ urlPath: '/service-details.html', title: 'Service Details', pageType: 'WebPage' },
	],
	navItems: [
		{ name: '중입자치료', url: '/301.php' },
		{ name: '중입자치료', url: '/302.php' },
		{ name: 'Service Details', url: '/service-details.html' },
		{ name: '서비스 소개', url: '/service-intro.php' },
		{ name: '적합성 사전 검토', url: '/201.php#eligibility-review' },
		{ name: '적용 대상암', url: '/600.php' },
		{ name: '일본 병원', url: '/401.php#' },
		{ name: '독일 병원', url: '/402.php#' },
	],
	knowsAbout: ['중입자치료', '맞춤 치료', '전문 의료 상담', 'Service Details'],
});
assert(!dupMaps.pageMeta['service-details.html'], 'service-details excluded from page_meta');
assert(!dupMaps.pageSchema['service-details.html'], 'service-details excluded from page_schema');
assert(dupMaps.pageMeta['index.php']?.type === 'WebPage', 'index meta type WebPage');
assert(
	JSON.stringify(dupMaps.pageSchema['index.php']) === JSON.stringify(['WebPage', 'BreadcrumbList']),
	'index schema array WebPage+BreadcrumbList only',
);
const buckets = buildMainPageItemListBuckets({
	origin: 'https://example.com',
	pageMeta: dupMaps.pageMeta,
	nav: [
		{ name: '중입자치료', url: 'https://example.com/301.php' },
		{ name: '중입자치료', url: 'https://example.com/302.php' },
		{ name: 'Service Details', url: 'https://example.com/service-details.html' },
		{ name: '서비스 소개', url: 'https://example.com/service-intro.php' },
		{ name: '공지사항', url: 'https://example.com/bbs/board.php?bo_table=notice' },
		{ name: '적합성 사전 검토', url: 'https://example.com/201.php#eligibility-review' },
		{ name: '적용 대상암', url: 'https://example.com/600.php' },
		{ name: '일본 병원', url: 'https://example.com/401.php#' },
		{ name: '독일 병원', url: 'https://example.com/402.php#' },
	],
	knowsAbout: ['중입자치료', '맞춤 치료', '전문 의료 상담'],
	industryType: 'MEDICAL',
});
const treatmentBucket = buckets.find((b) => b.id === 'treatments');
assert(treatmentBucket, 'treatments bucket exists');
const treatmentNames = treatmentBucket!.items.map((i) => i.name);
assert(treatmentNames.filter((n) => n === '중입자치료').length === 1, 'treatments unique by name');
assert(
	treatmentBucket!.items.filter((i) => i.name === '중입자치료').every((i) => !i.url.includes('302.php')),
	'treatment keeps first unique URL only',
);
assert(treatmentBucket!.items.length === 4, '4대 치료');
assert(
	DEFAULT_TREATMENT_NAMES.every((t) => treatmentBucket!.items.some((i) => i.name === t.name)),
	'all seed treatments present',
);
{
	const mainSvc = buckets.find((b) => b.id === 'main-services');
	assert(mainSvc && mainSvc.items.length === DEFAULT_MAIN_SERVICE_NAMES.length, '3대 서비스');
}
assert(
	!buckets.some((b) => b.items.some((i) => /service\s*details/i.test(i.name))),
	'Service Details removed from all ItemLists',
);
assert(
	!buckets.some((b) => b.items.some((i) => /서비스\s*소개|공지사항/i.test(i.name))),
	'menu chrome removed from all ItemLists',
);
const cancerBucket = buckets.find((b) => b.id === 'cancer-types');
assert(cancerBucket && cancerBucket.items.length >= DEFAULT_CANCER_TYPE_NAMES.length, 'cancer types expanded');
assert(
	DEFAULT_CANCER_TYPE_NAMES.every((n) => cancerBucket!.items.some((i) => i.name === n)),
	'all seed cancer types present',
);
assert(
	!cancerBucket!.items.some((i) => i.name === '적용 대상암'),
	'cancer hub label not listed as ListItem',
);
assert(
	cancerBucket!.items.length === DEFAULT_CANCER_TYPE_PAGES.length,
	'13 cancer-type leaves',
);
assert(
	DEFAULT_CANCER_TYPE_PAGES.every((p) =>
		cancerBucket!.items.some((i) => i.name === p.name && i.url.includes(`/${p.file}`)),
	),
	'cancer types map 1:1 to 601.php–613.php',
);
assert(
	!cancerBucket!.items.some((i) => /\/600\.php(?:$|[?#])/i.test(i.url)),
	'cancer ListItems do not point at hub 600.php',
);
const hospitalBucket = buckets.find((b) => b.id === 'hospital-network');
assert(
	hospitalBucket && hospitalBucket.items.length >= DEFAULT_HOSPITAL_NETWORK_NAMES.length,
	'hospital network expanded',
);
assert(
	DEFAULT_HOSPITAL_NETWORK_NAMES.every((n) => hospitalBucket!.items.some((i) => i.name === n)),
	'all seed hospitals present',
);
assert(
	hospitalBucket!.items.every((i) => i.url.includes('401.php') || i.url.includes('402.php')),
	'hospitals map to 401/402',
);
// Country 1:1 cross-validation: Japan → 401.php, Germany → 402.php
for (const seed of HOSPITAL_NETWORK_SEEDS) {
	const hit = hospitalBucket!.items.find((i) => i.name === seed.name);
	assert(hit, `hospital seed present: ${seed.name}`);
	if (seed.region === 'japan') {
		assert(hit!.url.includes('401.php') && !hit!.url.includes('402.php'), `${seed.name} → 401.php`);
	} else if (seed.region === 'germany') {
		assert(hit!.url.includes('402.php') && !hit!.url.includes('401.php'), `${seed.name} → 402.php`);
	}
}
assert(classifyHospitalRegion('QST 병원') === 'japan', 'QST → japan');
assert(classifyHospitalRegion('HIT') === 'germany', 'HIT → germany');
assert(isActionServiceName('적합성 사전 검토'), 'action service ok');
assert(!isActionServiceName('서비스 소개'), '서비스 소개 filtered');
assert(!isActionServiceName('공지사항'), '공지사항 filtered');
{
	assert(isPagingNoiseTitle('2페이지'), '2페이지 is paging noise');
	assert(isPagingNoiseTitle('3페이지'), '3페이지 is paging noise');
	assert(isPagingNoiseTitle('Page 2'), 'Page 2 is paging noise');
	assert(!isPagingNoiseTitle('연구소 소개'), 'normal title not paging');
	assert(
		sanitizeMainPageTitle('2페이지', '한국중입자 암치료연구소') === '한국중입자 암치료연구소',
		'main title paging → brand fallback',
	);
	const pagingPages = pagesFromAuditPaths({
		siteName: '한국중입자 암치료연구소',
		collectedUrlPaths: ['/', '/301.php'],
		mainTitle: '2페이지',
		mainH1: '2페이지',
		industryType: 'MEDICAL',
		crawledPages: [{ urlPath: '/301.php', title: '2페이지', h1: '중입자치료' }],
	});
	const idx = pagingPages.find((p) => sanitizePageFileKey(p.urlPath) === 'index.php');
	assert(idx?.title === '한국중입자 암치료연구소', 'index.php Title = brand (not 2페이지)');
	assert(idx?.h1 === '한국중입자 암치료연구소', 'index.php H1 = brand fallback');
	const p301 = pagingPages.find((p) => sanitizePageFileKey(p.urlPath) === '301.php');
	assert(p301?.title === '중입자치료', '301 ignores paging title, keeps H1');
}
{
	const brandLegal = resolveBrandAndLegalName({
		siteName: '한국중입자 암치료연구소',
		footerText: '© 2024 중입자암치료지원연구소 All Rights Reserved.',
	});
	assert(brandLegal.brandName === '한국중입자 암치료연구소', 'brand from siteName');
	assert(
		brandLegal.legalName === '한국중입자 암치료연구소',
		'copyright-only footer → brand fallback (v10)',
	);
	assert(
		isBlockedLegalNameText('Copyright 2024 All Rights Reserved.'),
		'English copyright blocked as legalName',
	);
}
{
	const labeled = extractLegalEntityFromCorpus(
		'상호: 중입자암치료지원연구소 | 사업자등록번호 000-00-00000',
		'한국중입자 암치료연구소',
	);
	assert(labeled === '중입자암치료지원연구소', 'legalName from 상호: label');
	const labeledName = extractLegalEntityFromCorpus(
		'상호명: 중입자암치료지원연구소 | © 2024 All Rights Reserved.',
		'한국중입자 암치료연구소',
	);
	assert(labeledName === '중입자암치료지원연구소', 'legalName from 상호명: with trailing copyright');
	const corp = extractLegalEntityFromCorpus(
		'대표 홍길동 주식회사 레드유메디컬 서울시',
		'레드유',
	);
	assert(corp == null, '주식회사 form without 상호 label rejected (v10)');
	const ju = extractLegalEntityFromCorpus('(주)한국중입자연구소 사업자등록번호 111', '한국중입자');
	assert(ju == null, '(주) form without 상호 label rejected (v10)');
	const copyrightEn = extractLegalEntityFromCorpus(
		'Copyright 2024 Carbon Ion Therapy All Rights Reserved.',
		'한국중입자 암치료연구소',
	);
	assert(copyrightEn == null, 'English copyright never becomes legalName');
	const fromLabeledResolve = resolveBrandAndLegalName({
		siteName: '한국중입자 암치료연구소',
		footerText: '법인명: 중입자암치료지원연구소',
	});
	assert(fromLabeledResolve.legalName === '중입자암치료지원연구소', '법인명: labeled bind');
}
// v10: og:type website for intro / MedicalWebPage (not article)
assert(
	/\$schema_meta_og_type = 'website'/.test(boardPhp) ||
		boardPhp.includes("$schema_meta_og_type = 'website'") ||
		/schema_meta_og_type = 'website'/.test(boardPhp),
	'og:type default website assignment present',
);
assert(
	boardPhp.includes("$page_type_og === 'Article'") && boardPhp.includes("$page_type_og === 'NewsArticle'"),
	'og:type article only for Article/NewsArticle',
);
assert(!/schema_meta_og_type = \$is_main \? 'website' : 'article'/.test(boardPhp), 'v8 blanket article og:type removed');
assert(boardPhp.includes('v30'), 'v30 engine marker');
assert(
	boardPhp.includes("$GLOBALS['redue_canonical_url']") || boardPhp.includes('http_build_query'),
	'v30 canonical computation present',
);
assert(boardPhp.includes('ob_start'), 'v30 restores ob_start for canonical dedup + script defer');
assert(boardPhp.includes('REDUE_UNIVERSAL_ENGINE_ACTIVE'), 'v30 OB guard constant');
assert(boardPhp.includes('redue_get_exact_canonical'), 'v30 exact canonical helper');
assert(boardPhp.includes('redue_dynamic_schema_controller_safe'), 'static $executed duplicate-call guard');
assert(boardPhp.includes("defined('G5_URL')") || boardPhp.includes('G5_URL'), 'G5_URL auto-detect in hybrid engine');
assert(boardPhp.includes("$config['cf_title']"), 'cf_title auto-detect in hybrid engine');
assert(
	boardPhp.includes('$final_canonical') ||
		boardPhp.includes('$is_main_path') ||
		boardPhp.includes('$is_main && $page_query === \'\'') ||
		boardPhp.includes('$is_main && ( ! is_string($page_query) || $page_query === \'\' )'),
	'v30 never collapses query subpages to root',
);
assert(boardPhp.includes('$has_identity_query') || boardPhp.includes("'bo_table'"), 'v30 identity query (bo_table) awareness');
assert(!/page_base === 'index\.php'/.test(boardPhp) || boardPhp.includes('$is_main_path'), 'v30 no basename index.php main trap (or guarded by is_main_path)');
assert(!boardPhp.includes('redue_canonical_ob_cleaner'), 'legacy OB cleaner name removed');
assert(!boardPhp.includes('redue_get_dynamic_canonical_url'), 'legacy OB dynamic canonical fallback removed');
assert(boardPhp.includes("'wr_id'"), 'v30 wr_id identity key');
assert(boardPhp.includes("'id'"), 'v30 id identity key');
assert(
	boardPhp.includes('<link rel="canonical" href="') && boardPhp.includes('property="og:url"'),
	'v30 canonical + og:url present (OB reinject)',
);
assert(
	boardPhp.includes("// echo '<link rel=\"canonical\"") || boardPhp.includes("// echo '<link rel=\"canonical\" href=\""),
	'v30 controller canonical echo is commented out (OB-only inject)',
);
assert(boardPhp.includes('REDUE v30 PRECISION SEO START'), 'v30 PRECISION SEO START marker');
assert(boardPhp.includes('SEO Standard Canonical Pair'), 'v30 SEO Standard Canonical Pair marker');
assert(
	boardPhp.includes('charset') &&
		(boardPhp.includes('Charset-After') || boardPhp.includes('Bot Optimized Top Position')),
	'v32 Charset-After First-Chunk Injection targets charset',
);
assert(
	boardPhp.includes('SCRIPT_NAME') && boardPhp.includes('REQUEST_URI'),
	'v32 dual-detects SCRIPT_NAME + REQUEST_URI',
);
{
	const directCanon = buildExactCanonicalPhpBlock('koreaionlab.co.kr');
	assert(directCanon.includes('https://koreaionlab.co.kr'), 'v32 hardcoded HTTPS base');
	assert(directCanon.includes('SCRIPT_NAME'), 'v32 SCRIPT_NAME dual detect in direct engine');
	assert(directCanon.includes('$exact_canonical_url'), 'v32 sets $exact_canonical_url');
	const frag = buildCrawlerOptimizedCanonicalHeadFragment('koreaionlab.co.kr');
	assert(frag.includes('Bot Optimized Top Position'), 'v32 paste fragment bot marker');
	const styledHead = `<!doctype html><html lang="ko"><head>
<meta charset="utf-8">
<style>.huge{color:red}</style>
<title>t</title></head><body></body></html>`;
	const afterCharset = injectAfterCharsetOrHead(
		styledHead,
		'<link rel="canonical" href="https://koreaionlab.co.kr/">\n<meta property="og:url" content="https://koreaionlab.co.kr/">',
	);
	const charsetIdx = afterCharset.indexOf('charset="utf-8"');
	const canonIdx = afterCharset.indexOf('rel="canonical"');
	const styleIdx = afterCharset.indexOf('<style');
	assert(charsetIdx >= 0 && canonIdx > charsetIdx && canonIdx < styleIdx, 'canonical lands after charset and before CSS');
	const dirtyDirect = injectBeforeClosingHead(
		`<?php\necho "x";\n?>\n<!doctype html><html><head><meta charset="utf-8"><style>x{}</style></head>`,
		`<?php\n${directCanon}\n?>`,
	);
	assert(dirtyDirect.ok, 'direct canonical inject ok');
	const dCharset = dirtyDirect.result.indexOf('charset="utf-8"');
	const dCanon = dirtyDirect.result.indexOf('rel="canonical"');
	const dStyle = dirtyDirect.result.indexOf('<style');
	assert(dCharset >= 0 && dCanon > dCharset && dCanon < dStyle, 'php-open inject places canonical after charset before CSS');
}
assert(boardPhp.includes('관련 안내 및 상담은 어떻게 신청하나요?'), 'v30 FAQ fallback Q1');
assert(boardPhp.includes('if ( ! $article_bound )') || boardPhp.includes("if ( ! $article_bound )"), 'Article guaranteed on all pages');
// v31 NewsArticle Auto-Detect (Gnuboard portable — notice/press/news boards & subpages)
assert(boardPhp.includes('v31 NewsArticle Auto-Detect'), 'v31 NewsArticle Auto-Detect marker in hybrid');
assert(boardPhp.includes("$redue_is_news_context"), 'news context flag in hybrid');
assert(
	boardPhp.includes('/(notice|press|news|media|insight|board)/i') ||
		boardPhp.includes('(notice|press|news|media|insight|board)'),
	'bo_table news/press token match in hybrid',
);
assert(
	boardPhp.includes("$auto_article_type = $redue_is_news_context ? 'NewsArticle' : 'Article'") ||
		boardPhp.includes("$redue_is_news_context ? 'NewsArticle' : 'Article'"),
	'NewsArticle type switch in hybrid',
);
assert(boardPhp.includes('wr_subject') && boardPhp.includes('wr_datetime'), 'Gnuboard write fields for NewsArticle');
assert(boardPhp.includes('/logo.png'), 'NewsArticle image fallback logo.png');
assert(boardPhp.includes("'@type' => 'ImageObject'"), 'publisher logo ImageObject');
{
	const detectPhp = buildNewsArticleAutoDetectPhp();
	assert(detectPhp.includes('$bo_table'), 'detect uses $bo_table global');
	assert(detectPhp.includes("$_GET['bo_table']"), 'detect falls back to $_GET bo_table');
	assert(!/koreaionlab|example\.com/i.test(detectPhp), 'detect has no hardcoded domain');
	const universalPhp = buildUniversalObSeoEnginePhp();
	assert(universalPhp.includes('v31 NewsArticle Auto-Detect'), 'v31 detect in universal engine');
	assert(universalPhp.includes("$redue_is_news_context ? 'NewsArticle' : 'Article'"), 'universal NewsArticle switch');
}
assert(boardPhp.includes('redue-alt-autofix'), 'v14 alt autofix');
assert(boardPhp.includes('redue-js-defer-fix'), 'v15 js defer autofix (defense-in-depth)');
assert(boardPhp.includes("date('Y-01-01T00:00:00+09:00')"), 'v15 Article datePublished default');
assert(boardPhp.includes("'sameAs' => array($origin"), 'Organization sameAs array');
assert(boardPhp.includes("blog.naver.com/' . $domain_host"), 'sameAs Naver blog host');
assert(boardPhp.includes("$origin . '/#person'"), 'Person @id origin/#person');
assert(boardPhp.includes('의료진/연구팀'), 'default Person E-E-A-T name');
assert(boardPhp.includes('의료 코디네이터 / 전문 연구팀'), 'default Person jobTitle');
assert(boardPhp.includes('Description Extender'), 'Description Extender comment');
assert(boardPhp.includes('$_redue_desc_len'), 'runtime description length check');
assert(!/\$legal_name = 'Copyright/i.test(boardPhp), 'legalName has no Copyright English');
assert(!boardPhp.includes("'2페이지'"), 'generated PHP has no 2페이지 token');
// v11: index.php parent / parent_url force-empty
{
	const idxMaps = buildPageMaps({
		siteName: '한국중입자 암치료연구소',
		targetUrl: 'https://example.com',
		pages: [
			{ urlPath: '/', title: '홈', section: '연구소 소개', menu1: '연구소 소개', pageType: 'WebPage' },
			{ urlPath: '/101.php', title: '연구소 소개', pageType: 'AboutPage' },
		],
		navItems: [{ name: '연구소 소개', url: '/101.php' }],
		industryType: 'MEDICAL',
	});
	assert(idxMaps.pageMeta['index.php']?.parent === '', 'index.php parent empty');
	assert(idxMaps.pageMeta['index.php']?.parent_url === '', 'index.php parent_url empty');
	const idxBlock = boardPhp.match(/'index\.php'\s*=>\s*array\(([\s\S]*?)\n\t\t\),/);
	assert(idxBlock, 'index.php page_meta block present');
	assert(/'parent'\s*=>\s*''/.test(idxBlock![1]!), "index.php parent => ''");
	assert(/'parent_url'\s*=>\s*''/.test(idxBlock![1]!), "index.php parent_url => ''");
	assert(boardPhp.includes("$is_main ) {\n\t\t\t$meta['parent'] = '';") || boardPhp.includes("$meta['parent'] = '';"), 'runtime index parent sanitize');
}
{
	const contact = extractOrgContactFromFooter(
		'상호: 중입자암치료지원연구소 | 전화: 02-9876-5432 | 이메일: hello@example.org | 주소: 서울시 서초구 서초대로 77 3층',
	);
	assert(contact.telephone === '02-9876-5432', `phone got=${contact.telephone}`);
	assert(contact.email === 'hello@example.org', `email got=${contact.email}`);
	assert(contact.address?.['@type'] === 'PostalAddress', 'PostalAddress type');
	assert(contact.address?.addressCountry === 'KR', 'KR country');
	assert(/서울/.test(contact.address?.addressRegion || ''), `region got=${contact.address?.addressRegion}`);
	assert(/서초구/.test(contact.address?.addressLocality || ''), `locality got=${contact.address?.addressLocality}`);
}
// v10: 302.php BreadcrumbList parent = 치료정보
{
	const parent302 = resolveParentHierarchy({
		file: '302.php',
		title: '양성자치료',
		section: '양성자치료',
		menu1: '',
		menu2: '',
		nav: [
			{ name: '치료정보', url: '/300.php' },
			{ name: '양성자치료', url: '/302.php' },
			{ name: '중입자치료', url: '/301.php' },
		],
		origin: 'https://example.com',
	});
	assert(parent302.parent === '치료정보', `302 parent 치료정보 got=${parent302.parent}`);
	assert(parent302.parent_url.includes('300.php') || parent302.parent_url.includes('example.com'), '302 parent_url set');
}
{
	const maps302 = buildPageMaps({
		siteName: '한국중입자 암치료연구소',
		targetUrl: 'https://example.com',
		pages: [
			{ urlPath: '/', title: '홈', pageType: 'WebPage' },
			{ urlPath: '/302.php', title: '양성자치료', h1: '양성자치료', pageType: 'MedicalWebPage' },
		],
		navItems: [
			{
				name: '치료정보',
				url: '/300.php',
				children: [
					{ name: '중입자치료', url: '/301.php' },
					{ name: '양성자치료', url: '/302.php' },
				],
			},
		],
		industryType: 'MEDICAL',
	});
	assert(maps302.pageMeta['302.php']?.parent === '치료정보', 'buildPageMaps 302 parent 치료정보');
	assert(maps302.pageMeta['302.php']?.type === 'MedicalWebPage', '302 MedicalWebPage retained');
}
{
	const hubs = resolveNetworkHubByRegion(
		[
			{ name: '일본 병원', url: 'https://example.com/401.php#', hay: '일본 병원', kind: 'hospital' },
			{ name: '독일 병원', url: 'https://example.com/402.php#', hay: '독일 병원', kind: 'hospital' },
		],
		'https://example.com',
	);
	assert(hubs.japan.includes('401.php'), 'region hub japan → 401');
	assert(hubs.germany.includes('402.php'), 'region hub germany → 402');
}
const servicesBucket = buckets.find((b) => b.id === 'main-services');
assert(servicesBucket && servicesBucket.items.some((i) => /사전\s*검토/.test(i.name)), 'main-services has 사전검토');
assert(!servicesBucket!.items.some((i) => /service\s*details/i.test(i.name)), 'main-services clean');
assert(byPath['board.php?bo_table=notice']?.pageType === 'CollectionPage', 'notice pageType CollectionPage');
assert(byPath['board.php?bo_table=qa']?.pageType === 'CollectionPage', 'qa pageType CollectionPage');
// board.php?bo_table=qa must not carry FAQPage in generated $page_schema
assert(
	!/board\.php\?bo_table=qa['"]\s*=>\s*array\([^)]*FAQPage/.test(boardPhp),
	'qa board schema excludes FAQPage',
);

// Optional Smart Clean helpers still available (manual), but inject path must NOT strip them
const dirtyHead = `<?php
if (G5_IS_MOBILE) {
    echo '<meta property="og:url" content="'.$og_url.'">'.PHP_EOL;
    echo '<meta property="og:title" content="'.$og_title.'">'.PHP_EOL;
    echo '<meta property="og:description" content="'.$og_desc.'">'.PHP_EOL;
    echo '<meta name="description" content="'.$desc.'">'.PHP_EOL;
    echo '<meta name="robots" content="index,follow">'.PHP_EOL;
    echo '<meta property="og:image" content="'.$og_img.'">'.PHP_EOL;
    echo '<meta property="og:type" content="article">'.PHP_EOL;
    echo '<link rel="canonical" href="https://koreaionlab.co.kr/">'.PHP_EOL;
} else {
    echo '<meta property="og:title" content="'.$og_title.'">'.PHP_EOL;
    echo '<meta name="description" content="'.$desc.'">'.PHP_EOL;
}
?>
<!doctype html><html><head><meta charset="utf-8">
<meta name="naver-site-verification" content="abc123verification">
<link rel="canonical" href="https://koreaionlab.co.kr/">
<link href="https://koreaionlab.co.kr/" rel="canonical">
</head><body>`;
const cleanedHead = stripHardcodedCanonicalTags(stripHardcodedMetaEchoes(dirtyHead));
assert(!/og:url/.test(cleanedHead), 'manual clean removes og:url echo/meta');
assert(!/og:title/.test(cleanedHead), 'manual clean removes og:title echo');
assert(!/rel=["']canonical["']/.test(cleanedHead), 'manual clean removes static/echo canonical');
assert(/G5_IS_MOBILE/.test(cleanedHead), 'keeps G5_IS_MOBILE branch');
const cleanInjected = injectBeforeClosingHead(dirtyHead, boardPhp);
assert(cleanInjected.ok, 'v22 top inject ok');
assert(cleanInjected.anchor === 'php-open-top', 'v22 php-open-top on dirty head');
// v30: stale static canonical/og:url are stripped at build time; runtime OB also dedups.
assert(cleanInjected.result.includes('naver-site-verification'), 'preserves Naver site verification');
assert(cleanInjected.result.includes('$og_title'), 'preserves existing $og_title echoes');
assert(!/\$og_url/.test(cleanInjected.result), 'strips stale $og_url echo (static pre-inject clean)');
// Stale hardcoded canonicals from dirtyHead removed; engine may reference canonical in echo + OB inject strings.
assert(
	!cleanInjected.result.includes('https://koreaionlab.co.kr/">\n<link href="https://koreaionlab.co.kr/" rel="canonical"'),
	'strips both stale static canonical tags from dirtyHead',
);
assert(
	(cleanInjected.result.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi) || []).length >= 1,
	'v30 engine still emits canonical link markup (echo and/or OB reinject)',
);
assert(cleanInjected.result.includes('$schema_meta_title'), 'dynamic meta title present');
assert(cleanInjected.result.includes('ob_start'), 'v30 inject result registers ob_start');
assert(
	cleanInjected.result.includes('REDUE v30 PRECISION SEO START') ||
		cleanInjected.result.includes('REDUE v30 PRECISION SEO'),
	'v30 precision SEO marker',
);
assert(
	cleanInjected.result.indexOf('REDUE_AI_STUDIO') < cleanInjected.result.indexOf('naver-site-verification'),
	'v30 engine before existing head metas',
);
assert((cleanInjected.result.match(/REDUE_AI_STUDIO:START/g) || []).length === 1, 'single controller inject');
assert((cleanInjected.result.match(/application\/ld\+json/g) || []).length === 1, 'single JSON-LD script');

console.log('OK', {
	primary: targets[0].path,
	caseBRootScore: caseBRootHit?.score,
	ghostPrimary: ghostTargets[0].path,
	ghostThemeScore: ghostTheme?.score,
	phpLen: php.length,
	pages: Object.keys(det.pages),
	mapped: mapped.map((p) => `${sanitizePageFileKey(p.urlPath)}=${p.title}`),
});
