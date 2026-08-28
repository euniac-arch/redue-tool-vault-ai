/**
 * Image-alt / multiple-H1 / heading-skip pinpoint collectors.
 * Run: npx tsx scripts/test-heading-alt-details.ts
 */
import * as cheerio from 'cheerio';
import {
	classifyImageAlt,
	collectH1Elements,
	collectHeadingOutline,
	collectImageAltIssues,
	displayImageSrc,
	formatPageDisplay,
	isHomePagePath,
	isStopwordAlt,
	meaningfulPageDisplay,
	missingHeadingLevels,
	normalizeImageAltIssues,
	normalizeImageSrc,
	suggestImageAltText,
	thumbnailSrcCandidates,
} from '../lib/audit/extractors/heading-alt-details';
import { parseHeadings, parseImages, parsePageHtml } from '../lib/audit/parser';
import { collectBoundImageAltIssues } from '../lib/audit/hydrate-checklist-details';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

assert(classifyImageAlt(false, undefined) === '누락', 'missing attr → 누락');
assert(classifyImageAlt(true, '') === '공백', 'empty alt → 공백');
assert(classifyImageAlt(true, '   ') === '공백', 'whitespace alt → 공백');
assert(classifyImageAlt(true, 'image') === '불용어 사용', 'image stopword');
assert(classifyImageAlt(true, '사진') === '불용어 사용', '사진 stopword');
assert(classifyImageAlt(true, '1') === '불용어 사용', 'numeric stopword');
assert(classifyImageAlt(true, '진료 안내') === null, 'meaningful alt passes');
assert(classifyImageAlt(true, '', { role: 'presentation' }) === null, 'decorative empty skipped');
assert(classifyImageAlt(false, undefined, { ariaLabel: '원장 사진' }) === null, 'aria-label covers missing alt');
assert(isStopwordAlt('IMG 02'), 'IMG 02 is stopword');
assert(missingHeadingLevels(1, 3) === 'H2', 'H1→H3 missing H2');
assert(missingHeadingLevels(2, 5) === 'H3, H4', 'H2→H5 missing H3 H4');

const html = `<!DOCTYPE html>
<html lang="ko">
<head><title>연구소 소개 | 테스트의원</title></head>
<body>
<header><h1 class="logo">사이트명</h1></header>
<main id="contents">
  <h1 class="sub_title">연구소 소개</h1>
  <img src="/images/hero.jpg">
  <img src="/images/staff.png" alt="">
  <img src="/images/photo.jpg" alt="image">
  <img src="/images/doc-kim.jpg" alt="김원장 진료">
  <img src="/images/spacer.gif" alt="" role="presentation">
  <h3>연구 성과</h3>
  <h3>논문</h3>
</main>
<footer><h1>푸터</h1></footer>
</body>
</html>`;

const $ = cheerio.load(html);
const images = parseImages($, { pageUrl: 'https://example.com/101.php', pageTitle: '연구소 소개' });
assert(images.total === 5, `total=${images.total}`);
assert(images.missingAlt === 3, `missingAlt=${images.missingAlt}`);
assert(images.imageAltIssues.length === 3, `issues=${images.imageAltIssues.length}`);
assert(images.imageAltIssues[0]?.issue === '누락' && images.imageAltIssues[0]?.src.includes('hero.jpg'), 'hero missing');
assert(images.imageAltIssues[1]?.issue === '공백', 'staff empty');
assert(images.imageAltIssues[2]?.issue === '불용어 사용', 'photo stopword');
assert(images.imageAltIssues.every((row) => row.selector.length > 0), 'each image has selector');
assert(images.imageAltIssues[0]?.href === 'https://example.com/images/hero.jpg', 'resolved href');
assert(images.imageAltIssues[0]?.pageUrl === 'https://example.com/101.php', 'page_url bound');
assert(images.imageAltIssues[0]?.issueType === 'missing', 'issue_type missing');
assert(images.imageAltIssues[0]?.imgSrc === '/images/hero.jpg', 'raw img_src');
assert(Boolean(images.imageAltIssues[0]?.suggestedAlt), 'suggested alt present');
assert(images.missing_images.length === images.missingAlt, 'missing_images length matches missingAlt');
assert(images.details?.missing_images.length === 3, 'details.missing_images bound');
assert(images.missing_images[0]?.issue === 'alt 누락', 'missing_images issue label');
assert(images.missing_images[1]?.issue === '공백(alt="")', 'empty alt label');
assert(images.missing_images[2]?.issue === '불용어(image/사진 등)', 'stopword label');
assert(images.missing_images[0]?.page_url === 'https://example.com/101.php', 'page_url on missing_images');
assert(images.missing_images[0]?.img_src === '/images/hero.jpg', 'img_src on missing_images');
assert(Boolean(images.missing_images[0]?.suggested_alt), 'suggested_alt on missing_images');
assert(
	normalizeImageAltIssues([{ page_url: '/s101.php', img_src: '/img/equipment01.jpg', current_alt: '', issue: 'alt 누락', suggested_alt: '장비' }])[0]
		?.imgSrc === '/img/equipment01.jpg',
	'snake_case missing_images hydrates',
);

const collected = collectImageAltIssues($, { pageTitle: '연구소 소개' });
assert(collected.total === 3, 'collector total');

const headings = parseHeadings($);
assert(headings.h1Count === 3, `h1Count=${headings.h1Count}`);
assert(headings.h1Elements.length === 3, `h1Elements=${headings.h1Elements.length}`);
assert(headings.h1Elements[0]?.text === '사이트명', 'first raw h1 is header');
assert(headings.h1Elements[1]?.text === '연구소 소개', 'content h1');
assert(headings.h1Elements.every((el) => el.selector.length > 0), 'each h1 has selector');
assert(headings.hasSkip, 'heading skip detected');
assert(headings.headingSkips.length >= 1, 'heading_skips collected');
assert(headings.headingSkips[0]?.from === 'H1' && headings.headingSkips[0]?.to === 'H3', 'H1→H3 skip');
assert(headings.headingSkips[0]?.text === '연구 성과', 'skip text');
assert(headings.headingOutline.some((node) => node.skip && node.level === 3), 'outline marks skip');

const outline = collectHeadingOutline($);
assert(outline.skips[0]?.selector.includes('h3') || outline.skips[0]?.selector.length > 0, 'skip selector');
assert(collectH1Elements($).length === 3, 'collectH1Elements');

const page = parsePageHtml($, 'https://example.com/101.php', '테스트의원', html);
assert(page.images.imageAltIssues.length === 3, 'parsePageHtml images');
assert(page.images.missing_images.length === 3, 'parsePageHtml missing_images bound');
assert(
	collectBoundImageAltIssues(
		{ id: 'image-alt', label: '이미지 alt 커버리지 (63% · 9/24 누락)', passed: false, weight: 4 },
		{
			titleLength: 0,
			metaDescriptionLength: 0,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 24,
			imagesMissingAlt: 9,
			imageAltCoveragePct: 63,
			jsonLdBlockCount: 0,
			schemaTypes: [],
			bodyTextLength: 0,
			renderBlockingScripts: 0,
			missing_images: page.images.missing_images,
		},
	).length === 3,
	'hydrate recovers missing_images onto image-alt item',
);
assert(page.headings.h1Elements.length === 3, 'parsePageHtml h1_elements');
assert(page.headings.headingSkips.length >= 1, 'parsePageHtml heading_skips');

assert(
	suggestImageAltText({ src: '/images/doc-kim.jpg', nearby: '연구소 소개' }) === '연구소 소개',
	'nearby caption preferred',
);
assert(
	suggestImageAltText({ src: '/images/doc-kim.jpg', pageTitle: '연구소 소개' }) === '연구소 소개 doc kim',
	'page title + stem',
);
assert(
	suggestImageAltText({ src: '/images/image.jpg', pageTitle: '연구소 소개' }) === '연구소 소개 안내 이미지',
	'generic stem falls back to guide image',
);
assert(
	suggestImageAltText({ src: '/images/image.jpg', pageTitle: 'About', lang: 'en' }) === 'About guide image',
	'en guide image fallback',
);

assert(isHomePagePath('https://example.com/'), 'home origin is home');
assert(isHomePagePath('https://example.com/index.php'), 'index.php is home');
assert(isHomePagePath('https://example.com/index.html'), 'index.html is home');
assert(isHomePagePath(''), 'empty path is home');
assert(!isHomePagePath('https://example.com/?p=123'), 'query home is a subpage');
assert(!isHomePagePath('/about/intro'), 'subpage is not home');
assert(formatPageDisplay('https://example.com/') === '홈 (/)', 'ko home label');
assert(formatPageDisplay('https://example.com/', 'en') === 'Home (/)', 'en home label');
assert(formatPageDisplay('https://example.com/index.php') === '홈 (/)', 'index.php home label');
assert(formatPageDisplay('https://example.com/?p=123') === '/?p=123', 'query path preserved');
assert(formatPageDisplay('https://example.com/about/intro') === '/about/intro', 'subpage path');
assert(formatPageDisplay('https://example.com/contents/s101.php') === '/contents/s101.php', 'php subpage path');
assert(meaningfulPageDisplay('https://example.com/', '/') === '', 'vague / hidden');
assert(meaningfulPageDisplay('http://nineoneclinic.com/', '홈 (/)') === '', 'home label hidden');
assert(meaningfulPageDisplay('/about/intro') === '/about/intro', 'menu path kept');
assert(
	thumbnailSrcCandidates('http://nineoneclinic.com/theme/basic/images/eq_pico.jpg')[0] ===
		'https://nineoneclinic.com/theme/basic/images/eq_pico.jpg',
	'http thumb upgraded to https',
);
assert(
	thumbnailSrcCandidates('http://nineoneclinic.com/theme/basic/images/eq_pico.jpg')[1] ===
		'http://nineoneclinic.com/theme/basic/images/eq_pico.jpg',
	'original http kept as fallback',
);

assert(
	normalizeImageSrc('//cdn.example.com/a.jpg', { pageUrl: 'https://clinic.test/page' }) ===
		'https://cdn.example.com/a.jpg',
	'protocol-relative src',
);
assert(
	normalizeImageSrc('/assets/hero.jpg', { pageUrl: 'https://clinic.test/about' }) ===
		'https://clinic.test/assets/hero.jpg',
	'root-relative src',
);
assert(
	normalizeImageSrc('./images/staff.png', { pageUrl: 'https://clinic.test/dept/' }) ===
		'https://clinic.test/dept/images/staff.png',
	'relative src',
);
assert(
	normalizeImageSrc('/theme/img/x.jpg', { origin: 'https://clinic.test', pageUrl: '/s101.php' }) ===
		'https://clinic.test/theme/img/x.jpg',
	'origin + path-only page url',
);
assert(displayImageSrc('data:image/png;base64,aaaa').startsWith('data:image/'), 'short data uri kept');
assert(displayImageSrc(`data:image/png;base64,${'a'.repeat(80)}`).endsWith('…'), 'long data uri truncated');
assert(normalizeImageSrc(`data:image/png;base64,${'a'.repeat(9000)}`) === '', 'oversized data uri skipped');

const homeCollected = collectImageAltIssues($, {
	pageUrl: 'https://example.com/',
	pageTitle: '테스트의원',
});
assert(homeCollected.missing_images[0]?.page_display === '홈 (/)', 'collector home page_display');
assert(
	homeCollected.missing_images[0]?.normalized_src === 'https://example.com/images/hero.jpg',
	'collector normalized_src',
);
assert(homeCollected.missing_alt_images[0]?.issue_type === 'missing', 'missing_alt_images issue_type');
assert(homeCollected.missing_images[0]?.issue_type === 'missing', 'missing_images issue_type');

const contextHtml = `<html><body>
<figure>
  <img src="/img/lab.jpg">
  <figcaption>실험실 전경</figcaption>
</figure>
<section aria-label="의료진 소개">
  <img src="/img/staff.jpg" alt="">
</section>
<section>
  <h2>장비 안내</h2>
  <img src="//cdn.example.com/mri.jpg" alt="image">
</section>
</body></html>`;
const $ctx = cheerio.load(contextHtml);
const ctxIssues = collectImageAltIssues($ctx, {
	pageUrl: 'https://clinic.test/about/intro',
	pageTitle: '병원소개',
	origin: 'https://clinic.test',
});
assert(ctxIssues.missing_images[0]?.suggested_alt === '실험실 전경', 'figcaption suggested alt');
assert(ctxIssues.missing_images[1]?.suggested_alt === '의료진 소개', 'parent aria-label suggested alt');
assert(ctxIssues.missing_images[2]?.suggested_alt === '장비 안내', 'preceding h2 suggested alt');
assert(
	ctxIssues.missing_images[2]?.normalized_src === 'https://cdn.example.com/mri.jpg',
	'protocol-relative normalized',
);
assert(ctxIssues.missing_images[0]?.page_display === '/about/intro', 'subpage page_display');

console.log('all heading-alt-detail assertions passed');
