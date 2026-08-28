/**
 * Smoke test: unique per-page Description (body summary + semantic fallback).
 */
import * as cheerio from 'cheerio';
import {
	classifyDescriptionCategory,
	extractMainContentText,
	generateDynamicDescription,
	resolvePageDescription,
	summarizeBodyText,
} from '../lib/audit/extractors/page-description';
import { generateDynamicPhpSchema, pagesFromAuditPaths } from '../lib/solve/dynamic-php-schema';
import { applyPageDescriptionOverrides } from '../lib/solve/page-description-edits';
import type { SolvePageMeta } from '../lib/solve/types';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const SITE = '테스트의원';

const bodyHtml = `<!DOCTYPE html><html><body>
<header><nav>GNB 소개 진료 오시는길</nav></header>
<div class="sub_content">
  <h1>내과진료</h1>
  <p>본 클리닉은 만성질환과 건강검진을 중심으로 개인별 맞춤 진료를 제공합니다. 초진 상담부터 추적 관찰까지 한 흐름으로 안내합니다.</p>
</div>
<footer>저작권</footer>
</body></html>`;
const $body = cheerio.load(bodyHtml);
const extracted = extractMainContentText($body);
assert(extracted.includes('만성질환'), 'body extractor reads .sub_content');
assert(!extracted.includes('GNB'), 'body extractor drops header chrome');
const summary = summarizeBodyText(extracted);
assert([...summary].length <= 130, `summary <=130 got=${[...summary].length}`);
assert([...summary].length >= 30, 'summary has substance');

const fromBody = resolvePageDescription({
	siteName: SITE,
	pageTitle: '내과진료',
	url: '/internal.php',
	bodyText: extracted,
	mainDescription: `${SITE} 공식 홈페이지입니다.`,
});
assert(fromBody.includes('만성질환') || fromBody.includes('맞춤 진료'), 'step1 uses body');
assert(!fromBody.includes('공식 홈페이지입니다'), 'step1 ignores homepage meta');

assert(classifyDescriptionCategory('내과진료', '/internal.php') === 'service', 'service category');
assert(classifyDescriptionCategory('오시는길', '/location.php') === 'location', 'location category');
assert(classifyDescriptionCategory('병원소개', '/intro.php') === 'about', 'about category');
assert(classifyDescriptionCategory('수술후기', '/review.php') === 'review', 'review category');
assert(classifyDescriptionCategory('공지사항', '/bbs/board.php?bo_table=notice') === 'notice', 'notice category');
assert(classifyDescriptionCategory('기타안내', '/etc.php') === 'generic', 'generic category');

const medicalService = generateDynamicDescription(SITE, '내과진료', '/internal.php', {
	industryType: 'MEDICAL',
});
const medicalLocation = generateDynamicDescription(SITE, '오시는길', '/location.php', {
	industryType: 'MEDICAL',
});
const medicalAbout = generateDynamicDescription(SITE, '병원소개', '/about.php', { industryType: 'MEDICAL' });
const medicalReview = generateDynamicDescription(SITE, '수술후기', '/review.php', { industryType: 'MEDICAL' });
const medicalNotice = generateDynamicDescription(SITE, '공지사항', '/bbs/board.php?bo_table=notice', {
	industryType: 'MEDICAL',
});
const medicalNews = generateDynamicDescription(SITE, '뉴스', '/bbs/board.php?bo_table=news', {
	industryType: 'MEDICAL',
});

assert(medicalService.includes('내과진료'), 'service keeps title');
assert(medicalService.includes('전문 의료진'), 'medical service copy');
assert(medicalLocation.includes('오시는길') && medicalLocation.includes('진료 시간'), 'location medical copy');
assert(medicalAbout.includes('병원소개') && medicalAbout.includes('임상 경험'), 'about medical copy');
assert(medicalReview.includes('수술후기') && medicalReview.includes('회복 사례'), 'review medical copy');
assert(medicalNotice.includes('공지사항'), 'notice includes title');
assert(medicalNotice !== medicalNews, 'two boards never share one description');

const uniq = new Set([medicalService, medicalLocation, medicalAbout, medicalReview, medicalNotice, medicalNews]);
assert(uniq.size === 6, 'all medical category sentences unique');

const bizService = generateDynamicDescription('한빛제조', '제품라인', '/product.php', {
	industryType: 'B2B_MFG',
});
assert(bizService.includes('제품라인'), 'non-medical keeps title');
assert(!bizService.includes('전문 의료진'), 'non-medical skips clinic copy');
assert(bizService.includes('핵심 서비스') || bizService.includes('이용 절차'), 'generic service copy');
const bizAbout = generateDynamicDescription('한빛제조', '회사소개', '/about.php', { industryType: 'B2B_MFG' });
assert(bizAbout.includes('핵심 역량') && !bizAbout.includes('임상 경험'), 'non-medical about copy');

const mapped = pagesFromAuditPaths({
	siteName: SITE,
	collectedUrlPaths: ['/', '/intro.php', '/internal.php', '/location.php', '/bbs/board.php?bo_table=notice'],
	mainTitle: SITE,
	mainDescription: `${SITE} 공식 홈페이지입니다. 진료 안내를 확인하세요.`,
	industryType: 'MEDICAL',
	navItems: [
		{ name: '병원소개', url: '/intro.php' },
		{ name: '내과진료', url: '/internal.php' },
		{ name: '오시는길', url: '/location.php' },
		{ name: '공지사항', url: '/bbs/board.php?bo_table=notice' },
	],
	crawledPages: [
		{ urlPath: '/intro.php', title: '병원소개', h1: '병원소개', description: `${SITE} 공식 홈페이지입니다. 진료 안내를 확인하세요.` },
		{ urlPath: '/internal.php', title: '내과진료', h1: '내과진료', description: '' },
		{ urlPath: '/location.php', title: '오시는길', h1: '오시는길' },
	],
});
const intro = mapped.find((p) => p.urlPath === '/intro.php');
const internal = mapped.find((p) => p.urlPath === '/internal.php');
const location = mapped.find((p) => p.urlPath === '/location.php');
const notice = mapped.find((p) => p.urlPath.includes('bo_table=notice'));
assert(intro && internal && location && notice, 'mapped rows exist');
assert(intro.description !== `${SITE} 공식 홈페이지입니다. 진료 안내를 확인하세요.`, 'homepage copy dropped');
assert(intro.description !== internal.description, 'intro != internal');
assert(internal.description !== location.description, 'internal != location');
assert(notice.description !== intro.description, 'notice != intro');
assert(internal.description?.includes('내과진료'), 'internal title bound');
assert(notice.description?.includes('공지사항'), 'notice title bound');

const php = generateDynamicPhpSchema({
	siteName: SITE,
	targetUrl: 'https://clinic.example',
	industryType: 'MEDICAL',
	pages: mapped,
});
assert(php.includes('$seo_meta_map'), 'seo_meta_map compiled');
assert(php.includes('$seo_meta_map[$page_file]'), 'runtime reads seo_meta_map');
assert(php.includes('og:description'), 'og:description echo');
assert(php.includes('내과진료'), 'internal desc in php');
assert(php.includes('공지사항'), 'notice desc in php');

const rows: SolvePageMeta[] = [
	{ urlPath: '/intro.php', title: '병원소개', description: intro.description },
	{ urlPath: '/internal.php', title: '내과진료', description: internal.description },
];
const edited = applyPageDescriptionOverrides(rows, {
	'/internal.php': '관리자가 수정한 내과 고유 설명입니다. 맞춤 검진과 상담을 안내합니다.',
});
assert(edited[0].description === intro.description, 'unedited row kept');
assert(edited[1].description?.includes('관리자가 수정한'), 'inline override applied');

console.log('OK page-description', {
	bodyChars: [...summary].length,
	categories: uniq.size,
	phpHasMap: php.includes('$seo_meta_map'),
});
