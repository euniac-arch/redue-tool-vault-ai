/**
 * Smoke test: GNB-first valid page collector (main + 2nd/3rd submenu).
 */
import * as cheerio from 'cheerio';
import {
	extractGnbNavigationPages,
	formatGnbHierarchyTitle,
	gnbPagesToCollectedUrls,
	normalizeGnbHref,
	resolveGnbCollectedPaths,
} from '../lib/audit/extractors/gnb-pages';
import { extractInternalLinks, extractNavItems } from '../lib/audit/parser';
import { generateDynamicPhpSchema, pagesFromAuditPaths } from '../lib/solve/dynamic-php-schema';
import { defaultPageSelected, isNoiseSchemaPage } from '../lib/solve/page-selection';
import { ensureRootDeployMenuRows, isRootDeployPage } from '../lib/solve/geo-root-assets';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const html = `<!DOCTYPE html><html><body>
<header>
  <nav id="gnb">
    <ul>
      <li class="gnb_1dli">
        <a href="/theme/hospital/html/about.php">병원소개</a>
        <ul class="gnb_2dul">
          <li><a href="/theme/hospital/html/about.php">인사말</a></li>
          <li><a href="/theme/hospital/html/staff.php">의료진</a></li>
        </ul>
      </li>
      <li class="gnb_1dli">
        <a href="/theme/hospital/html/sub301.php">진료과목</a>
        <ul>
          <li><a href="/theme/hospital/html/sub301.php">내과</a></li>
          <li>
            <a href="/theme/hospital/tour/index.php">외과</a>
            <ul>
              <li><a href="/theme/hospital/html/sub302.php">복강경</a></li>
            </ul>
          </li>
        </ul>
      </li>
      <li><a href="/bbs/board.php?bo_table=notice">공지사항</a></li>
      <li><a href="javascript:void(0)">이벤트</a></li>
      <li><a href="#top">맨위로</a></li>
      <li><a href="https://other.example/out">외부</a></li>
      <li><a href="/bbs/login.php">로그인</a></li>
    </ul>
  </nav>
</header>
<footer>
  <a href="/dummy/error.php">오류안내</a>
  <a href="/theme/ghost/404.php">유령테마</a>
</footer>
</body></html>`;

const $ = cheerio.load(html);
const gnb = extractGnbNavigationPages($, 'https://clinic.example/');
const urls = gnbPagesToCollectedUrls(gnb);

assert(urls.includes('/theme/hospital/html/about.php'), 'theme about collected');
assert(urls.includes('/theme/hospital/html/staff.php'), 'theme staff collected');
assert(urls.includes('/theme/hospital/html/sub301.php'), 'sub301 collected');
assert(urls.includes('/theme/hospital/tour/index.php'), 'tour index collected');
assert(urls.includes('/theme/hospital/html/sub302.php'), '3rd-depth sub302 collected');
assert(urls.includes('/bbs/board.php?bo_table=notice'), 'board notice collected');
assert(!urls.some((u) => u.includes('javascript')), 'js href dropped');
assert(!urls.includes('#top') && !urls.some((u) => u === '/'), 'hash/home dropped');
assert(!urls.some((u) => u.includes('other.example')), 'external dropped');
assert(!urls.includes('/bbs/login.php'), 'login dropped');
assert(!urls.includes('/dummy/error.php'), 'footer dummy not collected');
assert(!urls.includes('/theme/ghost/404.php'), 'footer ghost not collected');

const staff = gnb.find((p) => p.url.includes('staff.php'));
assert(staff?.menu1 === '병원소개' && staff?.menu2 === '의료진', '2nd depth labels');
const laparoscopic = gnb.find((p) => p.url.includes('sub302.php'));
assert(laparoscopic?.menu1 === '진료과목' && laparoscopic?.depth === 3, '3rd depth kept');

const origin = 'https://clinic.example';
assert(normalizeGnbHref('/about.php', `${origin}/`, origin)?.hrefPath === '/about.php', 'relative href');
assert(normalizeGnbHref('https://clinic.example/theme/hospital/html/sub301.php', `${origin}/`, origin)?.hrefPath === '/theme/hospital/html/sub301.php', 'absolute same-origin');
assert(normalizeGnbHref('https://evil.test/x.php', `${origin}/`, origin) === null, 'cross origin rejected');

const nav = extractNavItems($, `${origin}/`);
assert(nav.some((n) => n.url.includes('bo_table=notice')), 'extractNavItems uses GNB module');
const allLinks = extractInternalLinks($, `${origin}/`);
assert(allLinks.includes('/dummy/error.php'), 'full-DOM collector still sees footer (not used for table)');

const mapped = pagesFromAuditPaths({
	siteName: '테스트의원',
	collectedUrlPaths: ['/', '/dummy/error.php', '/theme/ghost/404.php', ...urls],
	mainTitle: '테스트의원',
	industryType: 'MEDICAL',
	navItems: nav,
	crawledPages: [
		{ urlPath: '/theme/hospital/html/staff.php', title: '의료진', h1: '의료진', description: '' },
	],
});
assert(mapped.some((p) => p.urlPath === '/'), 'homepage kept');
assert(mapped.some((p) => p.urlPath.includes('staff.php') && p.fromGnb), 'gnb page flagged');
assert(!mapped.some((p) => p.urlPath.includes('error.php')), 'footer dummy excluded from table');
assert(!mapped.some((p) => p.urlPath.includes('ghost')), 'ghost theme excluded from table');
assert(
	mapped.filter((p) => p.fromGnb && p.urlPath !== '/').every((p) => defaultPageSelected(p)),
	'GNB pages default checked',
);

const withRoots = ensureRootDeployMenuRows(mapped);
for (const path of ['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/rss.php']) {
	const row = withRoots.find((p) => p.urlPath === path);
	assert(row && isRootDeployPage(row) && defaultPageSelected(row), `root asset ${path}`);
	assert(!isNoiseSchemaPage(row), `root ${path} is not noise`);
}

const gnbOnly = resolveGnbCollectedPaths({
	navItems: nav,
	fallbackPaths: ['/dummy/error.php'],
});
assert(gnbOnly.includes('/theme/hospital/html/sub301.php'), 'resolve prefers GNB');
assert(!gnbOnly.includes('/dummy/error.php'), 'fallback dummy unused when GNB exists');

const php = generateDynamicPhpSchema({
	siteName: '테스트의원',
	targetUrl: origin,
	industryType: 'MEDICAL',
	pages: mapped.filter((p) => p.fromGnb || p.urlPath === '/'),
	navItems: nav,
});
assert(php.includes('$seo_schema_map'), 'seo_schema_map compiled');
assert(php.includes('$seo_meta_map'), 'seo_meta_map compiled');
assert(php.includes('$seo_schema_map = $page_schema'), 'schema map aliases page_schema');

const hdHtml = `<!DOCTYPE html><html><body>
<div id="hd" class="hd">
  <div class="select-nav">
    <ul class="depth1">
      <li>
        <a href="#">병원소개</a>
        <ul class="depth2">
          <li><a href="/theme/hospital/html/about.php">인사말</a></li>
          <li><a href="/theme/hospital/tour/index.php">병원 둘러보기</a></li>
        </ul>
      </li>
      <li>
        <a href="/bbs/board.php?bo_table=notice">공지사항</a>
      </li>
      <li><a href="/bbs/login.php">로그인</a></li>
      <li><a href="/bbs/register.php">회원가입</a></li>
      <li><a href="/bbs/member_confirm.php">회원확인</a></li>
      <li><a href="/bbs/password_lost.php">비밀번호찾기</a></li>
    </ul>
  </div>
</div>
<main><a href="/dummy/error.php">본문더미</a></main>
</body></html>`;
const $hd = cheerio.load(hdHtml);
const hdNav = extractGnbNavigationPages($hd, 'https://clinic.example/');
const hdUrls = gnbPagesToCollectedUrls(hdNav);
assert(hdUrls.includes('/theme/hospital/tour/index.php'), 'header #hd depth2 tour collected');
assert(hdUrls.includes('/theme/hospital/html/about.php'), 'header depth2 about collected');
assert(hdUrls.includes('/bbs/board.php?bo_table=notice'), 'header notice collected');
assert(!hdUrls.includes('/bbs/login.php'), 'login.php excluded');
assert(!hdUrls.includes('/bbs/register.php'), 'register.php excluded');
assert(!hdUrls.includes('/bbs/member_confirm.php'), 'member_confirm.php excluded');
assert(!hdUrls.includes('/bbs/password_lost.php'), 'password_lost.php excluded');
assert(!hdUrls.includes('/dummy/error.php'), 'main dummy excluded');
const tour = hdNav.find((p) => p.url.includes('tour/index.php'));
assert(tour?.menu1 === '병원소개' && tour?.menu2 === '병원 둘러보기', 'depth2 hierarchy labels');
assert(
	formatGnbHierarchyTitle(tour?.menu1, tour?.menu2) === '병원소개 > 병원 둘러보기',
	'1차 > 2차 title',
);

const hdMapped = pagesFromAuditPaths({
	siteName: '테스트의원',
	collectedUrlPaths: ['/dummy/error.php'],
	mainTitle: '테스트의원',
	industryType: 'MEDICAL',
	navItems: hdNav,
});
const tourRow = hdMapped.find((p) => p.urlPath.includes('tour/index.php'));
assert(tourRow?.fromGnb && defaultPageSelected(tourRow), 'header depth2 default checked');
assert(tourRow?.section === '병원소개 > 병원 둘러보기', 'table section uses hierarchy title');
assert(tourRow?.description && tourRow.description.length >= 30, 'unique desc assigned');
assert(!hdMapped.some((p) => p.urlPath.includes('error.php')), 'non-header dummy stays out');

console.log('OK gnb-pages', {
	gnbCount: gnb.length,
	tableCount: mapped.length,
	roots: withRoots.filter(isRootDeployPage).length,
});
