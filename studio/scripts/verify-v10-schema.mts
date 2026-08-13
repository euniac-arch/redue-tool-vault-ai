/**
 * v20 Full-Pass Spec verification — Perfect Canonical & Defer / OB strip→inject / Dynamic HTTPS / JS Defer / Article Date ISO,
 * Article/FAQ Auto-Fill, Alt JS Auto-Fix, sameAs, Person E-E-A-T,
 * Description Extender + v12 master core.
 */
import {
	generateDynamicPhpSchema,
	generateUniversalPhpSeoEngine,
	buildSchemaMappingJson,
	pagesFromAuditPaths,
	sanitizePageFileKey,
	resolveBrandAndLegalName,
	buildKnowsAboutKeywords,
	buildPageMaps,
	extractOrgContactFromFooter,
} from '../lib/solve/dynamic-php-schema.ts';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const SITE = '한국중입자 암치료연구소';
const FOOTER =
	'상호명: 중입자암치료지원연구소 | 전화: 02-1234-5678 | 이메일: info@carbon-ion.kr | 주소: 서울특별시 강남구 테헤란로 123 5층 | © 2024 All Rights Reserved.';

const pages = pagesFromAuditPaths({
	siteName: SITE,
	collectedUrlPaths: ['/', '/301.php', '/bbs/board.php?bo_table=notice'],
	mainTitle: '2페이지',
	mainH1: '2페이지',
	industryType: 'MEDICAL',
	navItems: [
		{ name: '중입자치료', url: '/301.php' },
		{ name: '공지사항', url: '/bbs/board.php?bo_table=notice' },
	],
	crawledPages: [
		{ urlPath: '/301.php', title: '중입자치료', h1: '중입자치료' },
		{ urlPath: '/bbs/board.php?bo_table=notice', title: '2페이지', h1: '공지사항' },
	],
});

const idx = pages.find((p) => sanitizePageFileKey(p.urlPath) === 'index.php');
assert(idx?.title === SITE, `index.php Title expected brand, got=${idx?.title}`);

const mapping = buildSchemaMappingJson({
	siteName: SITE,
	targetUrl: 'https://example.com',
	pages,
	industryType: 'MEDICAL',
	knowsAbout: ['중입자치료', '2페이지', 'Page 2'],
	footerText: FOOTER,
});

const php = generateDynamicPhpSchema(mapping, {
	siteName: SITE,
	targetUrl: 'https://example.com',
	industryType: 'MEDICAL',
	legalName: 'Copyright 2024 All Rights Reserved.',
	footerText: FOOTER,
});

const legal = resolveBrandAndLegalName({
	siteName: SITE,
	legalName: 'Copyright 2024 All Rights Reserved.',
	footerText: FOOTER,
});
assert(legal.legalName === '중입자암치료지원연구소', `legalName got=${legal.legalName}`);
assert(legal.brandName === SITE, 'brand isolated from legalName');
assert(/\$legal_name = '중입자암치료지원연구소'/.test(php), 'PHP legal_name bound');
assert(!/\$legal_name = 'Copyright/i.test(php), 'PHP legal_name has no Copyright English');

const maps = buildPageMaps({
	siteName: SITE,
	targetUrl: 'https://example.com',
	pages,
	industryType: 'MEDICAL',
	footerText: FOOTER,
});
assert(maps.pageMeta['index.php']?.parent === '', 'index parent empty');
assert(maps.pageMeta['index.php']?.parent_url === '', 'index parent_url empty');

const knows = buildKnowsAboutKeywords({
	knowsAbout: ['중입자치료', '2페이지', 'Page 2'],
	siteName: SITE,
	pageMeta: maps.pageMeta,
	industryType: 'MEDICAL',
});
assert(!knows.includes('2페이지'), 'knowsAbout purged 2페이지');
assert(!knows.includes('Page 2'), 'knowsAbout purged Page 2');
assert(!php.includes("'2페이지'"), 'generated head.sub.php has no 2페이지');
assert(php.includes('v30'), 'v30 engine marker');
assert(php.includes('ob_start'), 'v30 Universal Master Engine registers ob_start');
assert(php.includes('REDUE_UNIVERSAL_ENGINE_ACTIVE'), 'v30 OB guard constant');
assert(php.includes('redue_get_exact_canonical'), 'v30 canonical helper');
assert(
	php.includes('$final_canonical') ||
		php.includes('$is_main_path') ||
		php.includes('$is_main && $page_query === \'\'') ||
		php.includes('$is_main && ( ! is_string($page_query) || $page_query === \'\' )'),
	'v30 never collapses query subpages to root',
);
assert(
	php.includes("\$page_path === '/index.php'") && php.includes('$query_string'),
	'v30 index.php + identity query stay subpage',
);
assert(!php.includes('redue_canonical_ob_cleaner'), 'legacy OB cleaner name removed');
assert(php.includes('http_build_query'), 'v30 canonical query filter');
assert(
	php.includes('rel="canonical" href="') && php.includes('property="og:url"'),
	'v30 canonical + og:url present',
);
assert(php.includes("'idx'") || php.includes("'page_id'") || php.includes("'wr_id'"), 'v30 CMS identity keys');
assert(php.includes("'id'"), 'v30 identity key includes id');
assert(php.includes("'sameAs' => array($origin"), 'Organization sameAs');
assert(php.includes("$origin . '/#person'"), 'Person E-E-A-T @id');
assert(php.includes('Description Extender'), 'Description Extender');
assert(php.includes("v14 Schema Auto-Filler"), 'Article/FAQ auto-filler comment');
assert(
	php.includes("$redue_is_news_context ? 'NewsArticle' : 'Article'") ||
		php.includes("'@type' => 'Article'") ||
		php.includes("'@type' => $auto_article_type"),
	'main Article/NewsArticle auto-fill',
);
assert(php.includes('v31 NewsArticle Auto-Detect'), 'v31 NewsArticle Auto-Detect');
assert(php.includes("'@type' => 'FAQPage'"), 'main FAQPage auto-fill');
assert(php.includes('관련 안내 및 상담은 어떻게 신청하나요?'), 'default FAQ Q1');
assert(php.includes('서비스 이용 문의처는 어디인가요?'), 'default FAQ Q2');
assert(php.includes('redue-alt-autofix'), 'Alt Auto-Fixer script id');
assert(php.includes('querySelectorAll("img")'), 'Alt Auto-Fixer img scan');
assert(php.includes('redue-js-defer-fix'), 'JS Defer Auto-Fixer script id');
assert(php.includes('v15 Schema Date Auto-Fix') || php.includes("date('Y-01-01T00:00:00+09:00')"), 'Article datePublished auto');
assert(php.includes("'datePublished'") || php.includes('datePublished'), 'datePublished field');
assert(php.includes("'dateModified'") || php.includes('dateModified'), 'dateModified field');
assert(php.includes('! $article_bound') || php.includes('!$article_bound') || php.includes("if ( ! $article_bound )"), 'Article guaranteed without board ban');

const typeA = generateUniversalPhpSeoEngine();
assert(typeA.includes('redue_get_exact_canonical'), 'Type A v30 canonical helper');
assert(typeA.includes('http_build_query'), 'Type A canonical precision');
assert(typeA.includes('v30'), 'Type A v30 Universal Master Engine marker');
assert(
	typeA.includes('$final_canonical') ||
		typeA.includes('$is_main && $query_string === \'\'') ||
		typeA.includes('$is_main && $page_query === \'\''),
	'Type A keeps /?p=123 and board query pages',
);
assert(
	typeA.includes("'bo_table'") && typeA.includes('$query_string === \'\''),
	'Type A path=/ with bo_table is not root-collapsed',
);
assert(typeA.includes('REDUE v30 PRECISION SEO START'), 'Type A PRECISION SEO START marker');
assert(typeA.includes('SEO Standard Canonical Pair'), 'Type A SEO Standard Canonical Pair marker');
assert(typeA.includes("</title>") && typeA.includes('preg_match'), 'Type A Title-Below Injection after </title>');
assert(!/^\s*echo '<link rel="canonical"/m.test(typeA), 'Type A has no live controller canonical echo');
assert(typeA.includes('ob_start'), 'Type A v30 uses ob_start for canonical/defer');
assert(typeA.includes('preg_replace_callback'), 'Type A v30 server-side script defer');
assert(
	typeA.includes("$redue_is_news_context ? 'NewsArticle' : 'Article'") ||
		typeA.includes("'@type' => 'Article'") ||
		typeA.includes("'@type' => !empty($article['type'])"),
	'Type A emits Article/NewsArticle',
);
assert(typeA.includes('v31 NewsArticle Auto-Detect'), 'Type A v31 NewsArticle Auto-Detect');
assert(typeA.includes('FAQPage'), 'Type A emits FAQPage');
assert(typeA.includes('redue-alt-autofix'), 'Type A Alt Auto-Fixer');
assert(
	typeA.includes('Title-Below Injection') || typeA.includes('REDUE v30 PRECISION SEO'),
	'Type A Title-Below / PRECISION engine marker',
);
assert(typeA.includes('redue_dynamic_schema_controller_safe'), 'Type A static $executed guard');
assert(typeA.includes("defined('G5_URL')") || typeA.includes('G5_URL'), 'Type A G5_URL auto-detect');
assert(typeA.includes("$config['cf_title']"), 'Type A cf_title auto-detect');
assert(typeA.includes('$g5_head_title'), 'Type A g5_head_title auto-detect');
assert(
	maps.pageMeta['index.php']?.title === SITE,
	`page_meta index title got=${maps.pageMeta['index.php']?.title}`,
);

const idxBlock = php.match(/'index\.php'\s*=>\s*array\(([\s\S]*?)\n\t\t\),/);
assert(idxBlock, 'index.php page_meta in head.sub.php');
assert(/'parent'\s*=>\s*''/.test(idxBlock![1]!), "head.sub.php index parent => ''");
assert(/'parent_url'\s*=>\s*''/.test(idxBlock![1]!), "head.sub.php index parent_url => ''");

const contact = extractOrgContactFromFooter(FOOTER);
assert(contact.telephone === '02-1234-5678', `telephone got=${contact.telephone}`);
assert(contact.email === 'info@carbon-ion.kr', `email got=${contact.email}`);
assert(contact.address?.['@type'] === 'PostalAddress', 'PostalAddress');
assert(php.includes("'telephone' => '02-1234-5678'"), 'PHP telephone');
assert(php.includes("'email' => 'info@carbon-ion.kr'"), 'PHP email');
assert(php.includes("'@type' => 'PostalAddress'"), 'PHP PostalAddress');
assert(php.includes("'addressCountry' => 'KR'"), 'PHP addressCountry KR');

console.log('VERIFY_PASS', {
	indexTitle: idx?.title,
	legalName: legal.legalName,
	indexParent: maps.pageMeta['index.php']?.parent,
	indexParentUrl: maps.pageMeta['index.php']?.parent_url,
	telephone: contact.telephone,
	email: contact.email,
	address: contact.address,
	knowsAbout: knows,
	phpLegal: php.match(/\$legal_name = '[^']+'/)?.[0],
	phpIndexTitle: php.match(/'index\.php'\s*=>\s*array\([\s\S]*?'title'\s*=>\s*'[^']+'/)?.[0],
});
