/**
 * Universal render-blocking script + missing-alt page URL collectors.
 * Run: npx tsx scripts/test-page-resource-trackers.ts
 */
import * as cheerio from 'cheerio';
import {
	collectImageAltIssues,
} from '../lib/audit/extractors/heading-alt-details';
import {
	collectMissingAltImages,
	collectRenderBlockingScripts,
	displayPageUrl,
	isFrontExposedMenuPage,
	isSyncExternalScript,
	mergeSiteResourceTrackers,
	serializeScriptTag,
} from '../lib/audit/extractors/page-resource-trackers';
import { parseImages, parsePageHtml } from '../lib/audit/parser';
import { parsePinpointPage } from '../lib/audit/full-audit-engine';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(isSyncExternalScript({ src: '/js/menu.js' }), 'plain src is sync');
assert(!isSyncExternalScript({ src: '/js/menu.js', defer: '' }), 'defer skipped');
assert(!isSyncExternalScript({ src: '/js/menu.js', async: 'async' }), 'async skipped');
assert(!isSyncExternalScript({ src: '/js/app.js', type: 'module' }), 'module skipped');
assert(!isSyncExternalScript({}), 'no src skipped');
assert(
	serializeScriptTag({ src: '/js/menu.js' }) === '<script src="/js/menu.js"></script>',
	'serialize full tag',
);
assert(displayPageUrl('https://example.com/theme/basic/contents/s101.php') === '/theme/basic/contents/s101.php', 'page badge path');
assert(displayPageUrl('https://example.com/') === '홈 (/)', 'home badge');
assert(displayPageUrl('https://example.com/', 'en') === 'Home (/)', 'en home badge');
assert(displayPageUrl('https://example.com/index.php') === '홈 (/)', 'index.php home badge');
assert(displayPageUrl('https://example.com/?p=123') === '/?p=123', 'query subpage badge');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <title>장비소개 | 테스트의원</title>
  <script src="/js/jquery.min.js"></script>
  <script src="/js/app.module.js" type="module"></script>
  <script src="/js/deferred.js" defer></script>
  <script type="application/ld+json">{"@type":"MedicalClinic"}</script>
</head>
<body>
  <script src="/js/menu.js"></script>
  <header id="hd"><nav>메뉴</nav></header>
  <main id="contents">
    <h1>장비소개</h1>
    <img src="/img/equipment01.jpg">
    <img src="/img/equipment02.jpg" alt="">
    <img src="/img/photo.jpg" alt="image">
    <img src="/img/ok.jpg" alt="MRI 장비">
  </main>
  <footer id="ft">푸터</footer>
  <script src="/js/footer.js"></script>
</body>
</html>`;

const $ = cheerio.load(html);
const pageUrl = 'https://example.com/theme/basic/contents/s101.php';
const scripts = collectRenderBlockingScripts($, { pageUrl });
assert(scripts.length === 2, `head+early body scripts=${scripts.length}`);
assert(scripts[0]?.scriptSrc === '/js/jquery.min.js' && scripts[0]?.isHead, 'jquery in head');
assert(scripts[0]?.fullTag.includes('src="/js/jquery.min.js"'), 'full_tag jquery');
assert(scripts[0]?.recommendation.includes('defer'), 'head rec = defer');
assert(scripts[1]?.scriptSrc === '/js/menu.js' && !scripts[1]?.isHead, 'menu.js early body');
assert(scripts[1]?.recommendation.includes('</body>'), 'body rec = move to footer');
assert(scripts.every((row) => row.pageUrl === pageUrl), 'each script has page_url');
assert(!scripts.some((row) => row.scriptSrc.includes('footer.js')), 'footer sync script ignored');
assert(!scripts.some((row) => row.scriptSrc.includes('deferred') || row.scriptSrc.includes('module')), 'async/defer/module ignored');

const alts = collectMissingAltImages($, { pageUrl, pageTitle: '장비소개' });
assert(alts.total === 3, `missing alt total=${alts.total}`);
assert(alts.issues[0]?.pageUrl === pageUrl, 'alt page_url bound');
assert(alts.issues[0]?.imgSrc === '/img/equipment01.jpg', 'raw img_src');
assert(alts.issues[0]?.issueType === 'missing', 'issue_type missing');
assert(alts.issues[1]?.issueType === 'empty', 'issue_type empty');
assert(alts.issues[2]?.issueType === 'stopword', 'issue_type stopword');
assert(alts.images[0]?.suggestedAlt.length > 0, 'suggested_alt present');

const parsed = parsePageHtml($, pageUrl, '테스트의원', html);
assert(parsed.renderBlockingScripts === 2, `parsePageHtml count=${parsed.renderBlockingScripts}`);
assert(parsed.renderBlockingScriptItems[0]?.fullTag.startsWith('<script'), 'parsePageHtml full_tag');
assert(parsed.images.imageAltIssues[0]?.pageUrl === pageUrl, 'parsePageHtml alt page_url');

const pinpoint = parsePinpointPage({
	html,
	urlPath: '/theme/basic/contents/s101.php',
	origin: 'https://example.com',
	siteName: '테스트의원',
});
assert(pinpoint.renderBlockingScriptItems?.length === 2, 'pinpoint scripts');
assert(pinpoint.imageAltIssues?.length === 3, 'pinpoint alt issues');
assert(
	pinpoint.imageAltIssues?.[0]?.pageUrl === 'https://example.com/theme/basic/contents/s101.php',
	'pinpoint alt absolute page url',
);

const wpHtml = `<!DOCTYPE html><html><head>
<title>About</title>
<script src="https://cdn.example/wp-includes/js/jquery.min.js"></script>
</head><body>
<div id="page"><main id="content"><h1>About</h1><img src="/wp-content/uploads/hero.jpg"></main></div>
<script src="/wp-content/themes/x/footer.js"></script>
</body></html>`;
const $wp = cheerio.load(wpHtml);
const wpScripts = collectRenderBlockingScripts($wp, { pageUrl: 'https://wp.example/about/' });
assert(wpScripts.length === 1 && wpScripts[0]?.isHead, 'wordpress head jquery only');
assert(collectImageAltIssues($wp, { pageUrl: 'https://wp.example/about/' }).issues[0]?.pageUrl === 'https://wp.example/about/', 'wp alt page');

const merged = mergeSiteResourceTrackers({
	homepageUrl: 'https://example.com/',
	homepageScripts: parsed.renderBlockingScriptItems,
	homepageAltIssues: parsed.images.imageAltIssues,
	homepageImagesTotal: parsed.images.total,
	homepageMissingAlt: parsed.images.missingAlt,
	homepageImageSrcs: parsed.images.imageSrcs,
	pageMetas: [
		{
			urlPath: '/sub02.php',
			imagesTotal: 2,
			missingAlt: 1,
			imageAltIssues: [
				{
					src: '/img/room.jpg',
					imgSrc: '/img/room.jpg',
					alt: '',
					issue: '공백',
					issueType: 'empty',
					selector: 'img',
					pageUrl: 'https://example.com/sub02.php',
					suggestedAlt: '진료실',
				},
			],
			renderBlockingScriptItems: [
				{
					pageUrl: 'https://example.com/sub02.php',
					scriptSrc: '/js/menu.js',
					fullTag: '<script src="/js/menu.js"></script>',
					isHead: false,
					recommendation: '하단 </body> 직전으로 이동',
					recommendationKind: 'move_to_body_end',
				},
			],
		},
	],
});
assert(merged.renderBlockingScriptItems.length === 3, `merged scripts=${merged.renderBlockingScriptItems.length}`);
assert(merged.imageAltIssues.length === 4, `merged alts=${merged.imageAltIssues.length}`);
assert(merged.imagesTotal === 5, `merged unique totals=${merged.imagesTotal}`);
assert(merged.imagesMissingAlt === 4, `merged missing=${merged.imagesMissingAlt}`);
assert(merged.uniqueScriptSrcCount === 2, `unique srcs=${merged.uniqueScriptSrcCount}`);
assert(merged.missingAltImages.every((row) => row.pageUrl), 'snake-schema mapper keeps page_url');
assert(merged.missing_images.length === merged.imagesMissingAlt, 'missing_images length matches missing_count');
assert(merged.missing_images[0]?.issue, 'missing_images has issue label');

assert(isFrontExposedMenuPage({ urlPath: '/s101.php', source: 'gnb' }), 'gnb menu kept');
assert(isFrontExposedMenuPage({ urlPath: '/s201.php', source: 'sitemap' }), 'sitemap page kept');
assert(
	!isFrontExposedMenuPage({ urlPath: '/bbs/board.php?bo_table=notice&wr_id=12', source: 'sitemap' }),
	'board post dropped',
);
assert(!isFrontExposedMenuPage({ urlPath: '/theme/hidden.php', source: 'bfs' }), 'bfs dropped');
assert(
	isFrontExposedMenuPage(
		{ urlPath: '/contents/intro.php', source: 'html_link' },
		{ frontPagePaths: ['/contents/intro.php'] },
	),
	'GNB allowlist keeps html_link if it is a real menu',
);
assert(
	!isFrontExposedMenuPage(
		{ urlPath: '/random.php', source: 'html_link' },
		{ frontPagePaths: ['/contents/intro.php'] },
	),
	'non-menu html_link dropped when GNB list exists',
);

const scopedHtml = `<html><body>
<header id="hd"><img src="/img/logo.png"><img src="/img/sns.png"></header>
<main id="contents"><img src="/img/hero.jpg"><img src="/img/ok.jpg" alt="시설"></main>
<footer id="ft"><img src="/img/award.png"></footer>
</body></html>`;
const $scoped = cheerio.load(scopedHtml);
const contentImgs = parseImages($scoped, {
	pageUrl: 'https://example.com/s101.php',
	pageTitle: '병원소개',
	scope: 'content',
});
assert(contentImgs.total === 2, `content scope total=${contentImgs.total}`);
assert(contentImgs.missingAlt === 1 && contentImgs.imageAltIssues[0]?.imgSrc === '/img/hero.jpg', 'content missing is hero');
assert(!contentImgs.imageAltIssues.some((row) => /logo|sns|award/.test(row.imgSrc || row.src)), 'chrome imgs excluded');

const frontImgs = parseImages($scoped, { pageUrl: 'https://example.com/', scope: 'front' });
assert(frontImgs.total === 5, `front scope keeps chrome+main total=${frontImgs.total}`);

const filtered = mergeSiteResourceTrackers({
	homepageUrl: 'https://example.com/',
	homepageScripts: [],
	homepageAltIssues: [],
	homepageImagesTotal: 2,
	homepageMissingAlt: 0,
	homepageImageSrcs: ['/img/logo.png', '/img/ok.jpg'],
	frontPagePaths: ['/s101.php'],
	pageMetas: [
		{
			urlPath: '/s101.php',
			source: 'gnb',
			imagesTotal: 2,
			missingAlt: 1,
			imageSrcs: ['/img/hero.jpg', '/img/ok.jpg'],
			imageAltIssues: [
				{
					src: '/img/hero.jpg',
					imgSrc: '/img/hero.jpg',
					alt: '',
					issue: '누락',
					issueType: 'missing',
					selector: 'img',
					pageUrl: 'https://example.com/s101.php',
					suggestedAlt: '병원소개',
				},
			],
		},
		{
			urlPath: '/deep.php',
			source: 'bfs',
			imagesTotal: 400,
			missingAlt: 390,
			imageSrcs: Array.from({ length: 40 }, (_, i) => `/img/deep-${i}.jpg`),
			imageAltIssues: [
				{
					src: '/img/deep-0.jpg',
					imgSrc: '/img/deep-0.jpg',
					alt: '',
					issue: '누락',
					issueType: 'missing',
					selector: 'img',
					pageUrl: 'https://example.com/deep.php',
				},
			],
		},
	],
});
assert(filtered.imagesTotal === 3, `menu-only unique total=${filtered.imagesTotal}`);
assert(filtered.imagesMissingAlt === 1, `menu-only missing=${filtered.imagesMissingAlt}`);
assert(!filtered.imageAltIssues.some((row) => (row.imgSrc || '').includes('deep')), 'bfs alt rows dropped');

const fromSnake = mergeSiteResourceTrackers({
	homepageUrl: 'https://example.com/',
	homepageScripts: [],
	homepageAltIssues: [],
	homepageImagesTotal: 1,
	homepageMissingAlt: 0,
	homepageImageSrcs: ['/img/ok.jpg'],
	pageMetas: [
		{
			urlPath: '/theme/basic/contents/s101.php',
			source: 'gnb',
			imagesTotal: 1,
			missingAlt: 1,
			imageSrcs: ['/img/equipment01.jpg'],
			missing_images: [
				{
					page_url: '/theme/basic/contents/s101.php',
					img_src: '/img/equipment01.jpg',
					current_alt: '',
					issue: 'alt 누락',
					suggested_alt: '장비소개 — equipment01',
				},
			],
		},
	],
});
assert(fromSnake.missing_images.length === 1, 'snake missing_images rebound into merge');
assert(fromSnake.imagesMissingAlt === fromSnake.missing_images.length, 'count synced to array');
assert(fromSnake.imageAltIssues[0]?.imgSrc === '/img/equipment01.jpg', 'snake row became imageAltIssues');

console.log('all page-resource-tracker assertions passed');
