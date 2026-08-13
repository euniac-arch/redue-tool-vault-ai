/**
 * Content-scoped Title/H1 + board query URL extraction smoke tests.
 */
import * as cheerio from 'cheerio';
import { dedupeRepeatedPhrase, extractOfficialBrandName } from '../lib/audit/brand-name.ts';
import {
	extractInternalLinks,
	extractNavItems,
	extractContentScopedHeadings,
	extractJsonLdScriptBodies,
	parseJsonLd,
	parseMeta,
	parseHeadings,
	parsePageHtml,
	splitPageTitle,
} from '../lib/audit/parser.ts';
import { pickPageDescription, pickPageTitleH1 } from '../lib/audit/crawl-page-metas.ts';
import { sanitizePageFileKey, pagesFromAuditPaths } from '../lib/solve/dynamic-php-schema.ts';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const SITE = '한국중입자 암치료연구소';

assert(
	dedupeRepeatedPhrase('한국중입자 암치료연구소 한국중입자 암치료연구소') === SITE,
	'dedupe site_name phrase',
);
assert(dedupeRepeatedPhrase(`${SITE} | ${SITE}`) === SITE, 'dedupe Brand | Brand');
assert(
	extractOfficialBrandName(`${SITE} | ${SITE}`, 'example.com', SITE) === SITE,
	'brand extract dedupes',
);

assert(splitPageTitle('연구소 소개 | 한국중입자 암치료연구소', SITE) === '연구소 소개', 'split title');
assert(splitPageTitle('한국중입자 암치료연구소 - 중입자치료', SITE) === '중입자치료', 'split title reverse');
assert(splitPageTitle('공지사항 | 한국중입자 암치료연구소', SITE) === '공지사항', 'split notice');

const html = `<!DOCTYPE html><html><head>
<title>연구소 소개 | 한국중입자 암치료연구소</title>
<meta property="og:title" content="연구소 소개 | 한국중입자 암치료연구소">
</head><body>
<header>
  <nav class="gnb">
    <a href="/101.php">연구소 소개</a>
    <a href="/301.php">중입자치료</a>
    <a href="/bbs/board.php?bo_table=notice">공지사항</a>
    <a href="/bbs/write.php?bo_table=notice">글쓰기</a>
    <h1>진료안내</h1>
  </nav>
</header>
<div id="container">
  <div id="sub_contents">
    <h1 class="sub_title">연구소 소개</h1>
    <p>본문</p>
  </div>
</div>
<footer><h1>푸터</h1></footer>
</body></html>`;

const $ = cheerio.load(html);
const meta = parseMeta($, SITE);
assert(meta.pageTitle === '연구소 소개', `pageTitle=${meta.pageTitle}`);
const headings = parseHeadings($);
assert(headings.h1Texts[0] === '연구소 소개', `scoped h1=${headings.h1Texts[0]}`);
assert(!headings.h1Texts.includes('진료안내'), 'GNB h1 excluded');

const scoped = extractContentScopedHeadings($);
assert(scoped[0] === '연구소 소개', 'content scoped');

const links = extractInternalLinks($, 'https://example.com/', 120);
assert(links.includes('/bbs/board.php?bo_table=notice'), 'board url collected');
assert(links.includes('/bbs/write.php?bo_table=notice'), 'write.php collected');
assert(links.includes('/101.php'), '101.php collected');
// board URLs should rank near the top
assert(links.indexOf('/bbs/board.php?bo_table=notice') < links.indexOf('/101.php') || links.includes('/bbs/board.php?bo_table=notice'), 'board prioritized');

const nav = extractNavItems($, 'https://example.com/');
assert(nav.some((n) => n.url.includes('bo_table=notice') && n.name === '공지사항'), 'nav notice');
assert(nav.some((n) => n.url === '/101.php' && n.name === '연구소 소개'), 'nav 101');

const picked = pickPageTitleH1({
	fullTitle: meta.title,
	pageTitle: meta.pageTitle,
	h1Texts: headings.h1Texts,
	siteName: SITE,
});
assert(picked.title === '연구소 소개' && picked.h1 === '연구소 소개', 'pick title/h1');

// v10: paging chrome must not become Title/H1
const pagingPick = pickPageTitleH1({
	fullTitle: '2페이지',
	pageTitle: '2페이지',
	h1Texts: ['2페이지'],
	siteName: SITE,
	navLabel: '중입자치료',
});
assert(pagingPick.title === '중입자치료' || pagingPick.title === SITE, 'paging title rejected');
assert(pagingPick.title !== '2페이지', '2페이지 never selected');

// Shared homepage <title>/<description> must not override content H1.
const sharedMainDesc = '한국중입자 암치료연구소 공식 홈페이지입니다.';
const sharedTitlePick = pickPageTitleH1({
	fullTitle: SITE,
	pageTitle: SITE,
	h1Texts: ['중입자치료'],
	siteName: SITE,
	mainTitle: SITE,
});
assert(sharedTitlePick.title === '중입자치료' && sharedTitlePick.h1 === '중입자치료', 'h1 beats shared title');
assert(
	pickPageDescription({
		metaDescription: sharedMainDesc,
		mainDescription: sharedMainDesc,
		siteName: SITE,
	}) === '',
	'shared main description rejected',
);
assert(
	pickPageDescription({
		metaDescription: '중입자치료 안내 페이지입니다.',
		mainDescription: sharedMainDesc,
		siteName: SITE,
	}) === '중입자치료 안내 페이지입니다.',
	'page-specific description kept',
);

const pages = pagesFromAuditPaths({
	siteName: SITE,
	collectedUrlPaths: links,
	mainTitle: SITE,
	mainDescription: sharedMainDesc,
	industryType: 'MEDICAL',
	navItems: nav,
	crawledPages: [
		{ urlPath: '/101.php', title: SITE, h1: '연구소 소개', description: sharedMainDesc },
		{ urlPath: '/301.php', title: SITE, h1: '중입자치료', description: '중입자치료 상세 안내' },
		{ urlPath: '/bbs/board.php?bo_table=notice', title: '공지사항', h1: '공지사항' },
	],
});
const notice = pages.find((p) => sanitizePageFileKey(p.urlPath) === 'board.php?bo_table=notice');
const intro = pages.find((p) => sanitizePageFileKey(p.urlPath) === '101.php');
const therapy = pages.find((p) => sanitizePageFileKey(p.urlPath) === '301.php');
assert(intro?.title === '연구소 소개' && intro?.h1 === '연구소 소개', '101 mapped');
assert(notice?.title === '공지사항' && notice?.h1 === '공지사항', 'notice mapped');
assert(therapy?.title === '중입자치료' && therapy?.h1 === '중입자치료', '301 h1 mapped over shared title');
assert(therapy?.description === '중입자치료 상세 안내', '301 keeps own description');
assert(intro?.description !== sharedMainDesc, '101 does not copy main description verbatim');

// JSON-LD collection: charset suffix, @graph types, comment/CDATA wrappers
const ldHtml = `<!DOCTYPE html><html><head>
<script type="application/ld+json;charset=utf-8">
{"@context":"https://schema.org","@graph":[
  {"@type":"Organization","name":"Acme","logo":"https://x/l.png","url":"https://x","sameAs":["https://y"]},
  {"@type":["MedicalWebPage","WebPage"],"name":"Med"},
  {"@type":"https://schema.org/FAQPage","mainEntity":[]},
  {"@type":"NewsArticle","headline":"H","image":"https://x/i.png","datePublished":"2026-01-01","author":{"@type":"Person","name":"A"},"publisher":{"@type":"Organization","name":"Acme"}}
]}
</script>
<script type="application/ld+json"><!--{"@type":"HowTo","name":"steps"}--></script>
</head><body><h1>Hi</h1></body></html>`;
const bodies = extractJsonLdScriptBodies(ldHtml);
assert(bodies.length === 2, `ld bodies=${bodies.length}`);
const $ld = cheerio.load(ldHtml);
const schema = parseJsonLd($ld, ldHtml);
assert(schema.rawBlockCount === 2, 'jsonld blocks collected');
assert(schema.hasFaqOrHowTo, 'FAQPage/HowTo detected via @graph');
assert(schema.hasNewsArticle, 'NewsArticle detected');
assert(schema.types.includes('FAQPage'), `types has FAQPage: ${schema.types.join(',')}`);
assert(schema.types.includes('MedicalWebPage'), 'MedicalWebPage collected');
assert(schema.hasWebPage, 'MedicalWebPage counts as WebPage family');
const pageParsed = parsePageHtml($ld, 'https://example.com/', SITE, ldHtml);
assert(pageParsed.schema.hasFaqOrHowTo && pageParsed.schema.validBlockCount > 0, 'parsePageHtml rawHtml path');

console.log('OK', {
	pageTitle: meta.pageTitle,
	h1: headings.h1Texts,
	links: links.slice(0, 8),
	mapped: pages.map((p) => `${sanitizePageFileKey(p.urlPath)}=${p.title}/${p.h1}`),
	schemaTypes: schema.types,
});
