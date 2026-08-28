/**
 * Full Audit + Incremental Delta Cache — discovery, pinpoint hash, cache reuse.
 * Run: npx tsx scripts/test-full-audit-engine.ts
 */
import * as cheerio from 'cheerio';
import {
	collectDiscoveredUrls,
	computeContentHash,
	extractGnuboardPublicRoutes,
	extractPinpointBody,
	extractPublicRoutePatterns,
	formatFullAuditProgress,
	formatVerificationLog,
	isPublicHtmlRoute,
	normalizeAuditPagePath,
	parsePinpointPage,
	runFullAudit,
} from '../lib/audit/full-audit-engine';
import { extractSitemapLocs, parseSitemapXml } from '../lib/audit/sitemap';
import { emptyDeltaCache } from '../lib/audit/full-audit-cache';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const ORIGIN = 'https://clinic.example';

const homeHtml = `<!DOCTYPE html><html><head>
<title>푸른의원</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"MedicalClinic","name":"푸른의원"}</script>
<script>var g5_url = "https://clinic.example"; var g5_bbs_url = "https://clinic.example/bbs"; var g5_bo_table = "";</script>
<script src="/js/wrest.js"></script>
</head><body>
<header id="hd">
  <nav id="gnb" class="gnb">
    <ul class="gnb_1dul">
      <li><a href="/s101.php">병원소개</a>
        <ul class="gnb_2dul"><li><a href="/contents/intro.php">인사말</a></li></ul>
      </li>
      <li><a href="/s201.php">진료안내</a></li>
      <li><a href="/bbs/board.php?bo_table=notice">공지사항</a></li>
    </ul>
  </nav>
</header>
<div id="container">
  <main id="sub_content">
    <h1>푸른의원 메인</h1>
    <p>만성질환과 건강검진을 중심으로 개인별 맞춤 진료를 제공합니다. 초진부터 추적 관찰까지 안내합니다.</p>
  </main>
</div>
<footer id="ft">푸터 저작권 공통문구</footer>
<script>
  var extra = "/bbs/board.php?bo_table=gallery";
  var theme = "/theme/hospital/html/s301.php";
</script>
</body></html>`;

const pages: Record<string, string> = {
	'/': homeHtml,
	'/s101.php': `<html><head><script src="/js/menu.js"></script></head><body><header class="gnb">공통메뉴</header>
<div id="sub_content"><h1>병원소개</h1><h2>연혁</h2><p>2008년 개원 이후 지역 거점 의료기관으로 성장했습니다. 환자 중심 진료를 지향합니다.</p><img src="/img/clinic.jpg"></div>
<footer id="ft">푸터</footer></body></html>`,
	'/s201.php': `<html><body><nav class="gnb">메뉴</nav>
<div id="container"><h1>진료안내</h1><p>내과·건강검진 프로그램을 운영합니다. 예약 후 방문해 주세요.</p></div>
<footer>푸터</footer></body></html>`,
	'/contents/intro.php': `<html><body><header id="hd">헤더</header>
<article><h1>인사말</h1><p>원장 인사말입니다. 최선을 다해 진료하겠습니다.</p></article>
<aside>사이드</aside></body></html>`,
	'/bbs/board.php?bo_table=notice': `<html><body>
<div id="bo_list"><h1>공지사항</h1><p>병원 운영 공지와 새 소식을 게시합니다.</p></div>
</body></html>`,
	'/bbs/board.php?bo_table=gallery': `<html><body>
<div id="bo_list"><h1>갤러리</h1><p>병원 시설과 진료 현장을 소개합니다.</p></div>
</body></html>`,
	'/theme/hospital/html/s301.php': `<html><body>
<div class="sub_content"><h1>테마 서브</h1><p>테마 콘텐츠 페이지입니다. 상세 안내를 확인하세요.</p></div>
</body></html>`,
	'/s401.php': `<html><body>
<div id="sub_content"><h1>사이트맵 전용</h1><p>사이트맵에서만 발견된 공개 페이지입니다.</p></div>
</body></html>`,
};

// —— 1. URL filters ——
assert(normalizeAuditPagePath('/s101.php', ORIGIN) === '/s101.php', 'normalize s101');
assert(normalizeAuditPagePath('/img/logo.png', ORIGIN) === null, 'drop image');
assert(normalizeAuditPagePath('/bbs/login.php', ORIGIN) === null, 'drop login');
assert(normalizeAuditPagePath('https://other.example/s101.php', ORIGIN) === null, 'drop external');
assert(isPublicHtmlRoute('/bbs/board.php?bo_table=notice'), 'board list is public');
assert(!isPublicHtmlRoute('/bbs/board.php?bo_table=notice&wr_id=12'), 'board post skipped from HTML census');
assert(isPublicHtmlRoute('/bbs/board.php?bo_table=notice&wr_id=12', { allowPosts: true }), 'sitemap may keep posts');

// —— 2. Regex + Gnuboard pattern census ——
const patterned = extractPublicRoutePatterns(homeHtml, ORIGIN);
assert(patterned.includes('/s101.php'), 's101.php from GNB href');
assert(patterned.includes('/s201.php'), 's201.php');
assert(patterned.includes('/contents/intro.php'), 'contents/*.php');
assert(patterned.includes('/bbs/board.php?bo_table=notice'), 'notice board');
assert(patterned.includes('/bbs/board.php?bo_table=gallery'), 'gallery from JS');
assert(patterned.includes('/theme/hospital/html/s301.php'), 'theme php from JS');
const gnu = extractGnuboardPublicRoutes(homeHtml, ORIGIN);
assert(gnu.some((p) => p.includes('bo_table=notice')), 'gnuboard board scan');

const sitemapXml = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <loc>https://clinic.example/s401.php</loc>
  <loc>https://clinic.example/s101.php</loc>
</urlset>`;
const parsedSm = parseSitemapXml(sitemapXml);
assert(parsedSm.valid && parsedSm.urlCount === 2, 'sitemap urlset count');
assert(extractSitemapLocs(sitemapXml).includes('https://clinic.example/s401.php'), 'sitemap loc');

const discovered = collectDiscoveredUrls({
	origin: ORIGIN,
	mainUrl: `${ORIGIN}/`,
	homepageHtml: homeHtml,
	robotsText: 'User-agent: *\nAllow: /\nSitemap: https://clinic.example/sitemap.xml\n',
	sitemapLocs: extractSitemapLocs(sitemapXml),
	navItems: [
		{ name: '병원소개', url: '/s101.php' },
		{ name: '진료안내', url: '/s201.php' },
	],
});
assert(discovered.urls.includes('/s401.php'), 'sitemap-only page registered');
assert(discovered.sources.get('/s401.php') === 'sitemap', 's401 source=sitemap');
assert(discovered.urls.includes('/contents/intro.php'), 'contents page queued');
assert(discovered.urls.includes('/bbs/board.php?bo_table=gallery'), 'JS board queued');

// —— 3. Pinpoint body (chrome stripped) + hash ——
const $home = cheerio.load(homeHtml);
const body = extractPinpointBody($home);
assert(body.includes('만성질환'), 'pinpoint reads #sub_content');
assert(!body.includes('공통문구'), 'pinpoint drops footer');
assert(!body.includes('병원소개'), 'pinpoint drops GNB');
const parsedHome = parsePinpointPage({
	html: homeHtml,
	urlPath: '/',
	origin: ORIGIN,
	siteName: '푸른의원',
});
assert(parsedHome.h1.includes('푸른의원') || parsedHome.h1.includes('메인'), `h1=${parsedHome.h1}`);
assert(parsedHome.content_hash.length === 64, 'sha-256 hex');
assert(parsedHome.summary.length > 10, '2-3 line summary');
const sameHome = parsePinpointPage({
	html: homeHtml,
	urlPath: '/',
	origin: ORIGIN,
	siteName: '푸른의원',
});
assert(sameHome.content_hash === parsedHome.content_hash, 'hash is deterministic for identical HTML');
const changed = computeContentHash(parsedHome.h1, `${body} 변경`);
assert(changed !== parsedHome.content_hash, 'hash changes when body changes');

const parsedIntro = parsePinpointPage({
	html: pages['/s101.php'],
	urlPath: '/s101.php',
	origin: ORIGIN,
	siteName: '푸른의원',
});

// Adding alt="" to an <img> doesn't move the body-text/H1 corpus at all — the hash
// must still change, otherwise the delta cache would keep serving the stale missing-alt
// list forever (the exact staleness bug this signature exists to close).
const introAltFixedHtml = pages['/s101.php'].replace(
	'<img src="/img/clinic.jpg">',
	'<img src="/img/clinic.jpg" alt="병원 전경">',
);
const parsedIntroAltFixed = parsePinpointPage({
	html: introAltFixedHtml,
	urlPath: '/s101.php',
	origin: ORIGIN,
	siteName: '푸른의원',
});
assert(
	parsedIntroAltFixed.content_hash !== parsedIntro.content_hash,
	'alt-only fix changes content_hash even though body text is unchanged',
);
assert(parsedIntroAltFixed.missingAlt === 0, 'alt-fixed page has 0 missing alt');
assert(parsedIntro.renderBlockingScriptItems?.some((row) => row.scriptSrc === '/js/menu.js'), 's101 tracks head script');
assert(parsedIntro.renderBlockingScriptItems?.[0]?.fullTag.includes('src="/js/menu.js"'), 's101 full_tag');
assert(parsedIntro.imageAltIssues?.some((row) => (row.imgSrc || row.src).includes('clinic.jpg')), 's101 missing alt + page');
assert(parsedIntro.imageAltIssues?.[0]?.pageUrl?.includes('/s101.php'), 's101 alt page_url');

// —— 4. Full run + incremental cache ——
async function main() {
const fetchHtml = async (url: string) => {
	const path = normalizeAuditPagePath(url, ORIGIN) || '/';
	const html = pages[path];
	return html ? { ok: true, text: html } : { ok: false, text: '' };
};

const messages: string[] = [];
const first = await runFullAudit({
	origin: ORIGIN,
	mainUrl: `${ORIGIN}/`,
	homepageHtml: homeHtml,
	robotsText: 'User-agent: *\nAllow: /\n',
	sitemapLocs: extractSitemapLocs(sitemapXml),
	siteName: '푸른의원',
	navItems: [
		{ name: '병원소개', url: '/s101.php' },
		{ name: '진료안내', url: '/s201.php' },
		{ name: '공지사항', url: '/bbs/board.php?bo_table=notice' },
	],
	fetchHtml,
	cache: emptyDeltaCache(ORIGIN),
	persistCache: false,
	maxBfsRounds: 1,
	onProgress: (p) => messages.push(p.message),
});

assert(first.mode === 'full', `mode full, got ${first.mode}`);
assert(first.pagesFound >= 6, `found>=6 got=${first.pagesFound} ${first.discoveredUrls.join(',')}`);
assert(first.pagesParsed === first.pagesFound, `found===parsed ${first.verification.log}`);
assert(first.cacheMisses >= 6, `first run analyzes pages, misses=${first.cacheMisses}`);
assert(first.discoveredUrls.includes('/s401.php'), 'sitemap page fetched');
assert(first.discoveredUrls.includes('/bbs/board.php?bo_table=gallery'), 'cms board fetched');
assert(first.pageMetas.some((p) => p.urlPath === '/s101.php' && p.h1.includes('병원소개')), 'pageMeta h1');
assert(first.pageMetas.every((p) => p.urlPath !== '/'), 'homepage excluded from pageMetas');
assert(messages.some((m) => /전체 \d+개 페이지 중 \d+번째 페이지 정밀 분석 중/.test(m)), `analyze msg ${messages.join(' | ')}`);
assert(first.verification.log.includes('Total Pages Found='), 'verification log');

const secondMsgs: string[] = [];
const second = await runFullAudit({
	origin: ORIGIN,
	mainUrl: `${ORIGIN}/`,
	homepageHtml: homeHtml,
	robotsText: '',
	sitemapLocs: extractSitemapLocs(sitemapXml),
	siteName: '푸른의원',
	navItems: [
		{ name: '병원소개', url: '/s101.php' },
		{ name: '진료안내', url: '/s201.php' },
	],
	fetchHtml,
	cache: first.cache,
	persistCache: false,
	maxBfsRounds: 1,
	onProgress: (p) => secondMsgs.push(p.message),
});
assert(second.mode === 'incremental', 'second is incremental');
assert(second.cacheHits >= 5, `cache hits ${second.cacheHits}`);
assert(second.cacheMisses === 0, `no misses on unchanged site, got ${second.cacheMisses}`);
assert(
	/전체 \d+개 중 \d+개 캐시 재사용, 변경된 0개 페이지 신규 분석 완료/.test(second.progressMessage),
	`incremental done: ${second.progressMessage}`,
);

const changedPages = { ...pages, '/s201.php': pages['/s201.php'].replace('내과·건강검진', '내과·소아과 건강검진') };
const third = await runFullAudit({
	origin: ORIGIN,
	mainUrl: `${ORIGIN}/`,
	homepageHtml: homeHtml,
	robotsText: '',
	sitemapLocs: extractSitemapLocs(sitemapXml),
	siteName: '푸른의원',
	fetchHtml: async (url) => {
		const path = normalizeAuditPagePath(url, ORIGIN) || '/';
		const html = changedPages[path];
		return html ? { ok: true, text: html } : { ok: false, text: '' };
	},
	cache: second.cache,
	persistCache: false,
	maxBfsRounds: 1,
});
assert(third.mode === 'incremental', 'third incremental');
assert(third.cacheMisses === 1, `only s201 re-analyzed, misses=${third.cacheMisses}`);
assert(third.cacheHits >= 4, `other pages reused, hits=${third.cacheHits}`);
assert(/변경된 1개 페이지 신규 분석 완료/.test(third.progressMessage), third.progressMessage);

// —— 5. Alt-only edit must invalidate the delta cache even WITHOUT forceRefresh ——
// (regression test for the caching bug: body text/H1 are unchanged, only `alt` was
// added to <img src="/img/clinic.jpg"> on /s101.php.)
const altFixedPages = { ...changedPages, '/s101.php': introAltFixedHtml };
const fourth = await runFullAudit({
	origin: ORIGIN,
	mainUrl: `${ORIGIN}/`,
	homepageHtml: homeHtml,
	robotsText: '',
	sitemapLocs: extractSitemapLocs(sitemapXml),
	siteName: '푸른의원',
	fetchHtml: async (url) => {
		const path = normalizeAuditPagePath(url, ORIGIN) || '/';
		const html = altFixedPages[path];
		return html ? { ok: true, text: html } : { ok: false, text: '' };
	},
	cache: third.cache,
	persistCache: false,
	maxBfsRounds: 1,
});
assert(fourth.mode === 'incremental', 'fourth incremental (no forceRefresh)');
assert(fourth.cacheMisses === 1, `only s101 re-analyzed for its alt fix, misses=${fourth.cacheMisses}`);
const s101Fixed = fourth.pages.find((p) => p.urlPath === '/s101.php');
assert(s101Fixed?.missingAlt === 0, `alt fix must be reflected without forceRefresh, got=${s101Fixed?.missingAlt}`);

// —— 6. `forceRefresh` must bypass delta-cache reuse entirely, even when nothing changed ——
const fifth = await runFullAudit({
	origin: ORIGIN,
	mainUrl: `${ORIGIN}/`,
	homepageHtml: homeHtml,
	robotsText: '',
	sitemapLocs: extractSitemapLocs(sitemapXml),
	siteName: '푸른의원',
	fetchHtml: async (url) => {
		const path = normalizeAuditPagePath(url, ORIGIN) || '/';
		const html = altFixedPages[path];
		return html ? { ok: true, text: html } : { ok: false, text: '' };
	},
	cache: fourth.cache,
	forceRefresh: true,
	persistCache: false,
	maxBfsRounds: 1,
});
assert(fifth.mode === 'full', `forceRefresh must report mode=full, got ${fifth.mode}`);
// Every URL that the mock `fetchHtml` can actually serve must be re-analyzed from the
// live HTML (cacheHit=false) — forceRefresh must never resurrect a stale hash-matched
// snapshot for a page that fetched successfully. The only acceptable `cacheHit: true`
// rows are for `/board.php?...` variants that this fixture's `fetchHtml` never serves
// (a genuine live-fetch failure, where falling back to the last-known-good cache is
// still correct behavior even under forceRefresh).
for (const page of fifth.pages) {
	const liveHtml = altFixedPages[page.urlPath];
	if (liveHtml) {
		assert(page.cacheHit === false, `forceRefresh must re-parse ${page.urlPath} instead of reusing cache`);
	}
}
const s101Forced = fifth.pages.find((p) => p.urlPath === '/s101.php');
assert(s101Forced?.missingAlt === 0, 'forceRefresh keeps reflecting the live alt fix');

const progress = formatFullAuditProgress({
	phase: 'analyze',
	mode: 'full',
	pagesFound: 32,
	pagesParsed: 17,
	currentIndex: 18,
	cacheHits: 0,
	cacheMisses: 18,
	lang: 'ko',
});
assert(progress.message === '전체 32개 페이지 중 18번째 페이지 정밀 분석 중... [56%]', progress.message);
assert(formatVerificationLog(32, 30, ['/a', '/b']).includes('Found=32 Parsed=30 missing=2'), 'verify log');

console.log('test-full-audit-engine: ok');
console.log(`  first: found=${first.pagesFound} parsed=${first.pagesParsed} ${first.progressMessage}`);
console.log(`  second: ${second.progressMessage}`);
console.log(`  third: ${third.progressMessage}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
