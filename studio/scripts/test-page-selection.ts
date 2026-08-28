/**
 * Smoke test: smart-default page picker + persistence merge.
 */
import { buildSchemaMappingJson } from '../lib/solve/dynamic-php-schema';
import {
	buildAiFriendlyRobotsTxt,
	buildGeoRootAssetPack,
	buildSelectedPagesSitemapXml,
	resolveSitemapUrlWeight,
	buildSolveLlmsFullMarkdown,
	ensureRootDeployMenuRows,
	excludeRootDeployFromSchemaPages,
	isRootDeployPage,
	resolveRootDeployFlags,
} from '../lib/solve/geo-root-assets';
import {
	buildSolveLlmsTxtMarkdown,
	ensureLlmsTxtMenuRow,
	excludeLlmsTxtFromSchemaPages,
	isLlmsTxtDeployPage,
} from '../lib/solve/llms-txt-deploy';
import {
	defaultPageSelected,
	isNoiseSchemaPage,
	pageSelectionKey,
	resolvePageSelection,
	filterSelectedPages,
} from '../lib/solve/page-selection';
import { applyPageDescriptionOverrides } from '../lib/solve/page-description-edits';
import { ensureCitationMenuRows, FAQ_GUIDE_TITLE, HOWTO_GUIDE_TITLE } from '../lib/solve/core/eeat-citation';
import type { SolvePageMeta } from '../lib/solve/types';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const servicePages: SolvePageMeta[] = [
	{ urlPath: '/', title: '병원 메인', section: '메인' },
	{ urlPath: '/intro.php', title: '병원소개', section: '병원소개' },
	{ urlPath: '/internal.php', title: '내과진료', section: '내과진료' },
	{ urlPath: '/surgery.php', title: '외과진료', menu1: '외과진료' },
	{ urlPath: '/location.php', title: '오시는길', section: '오시는길' },
	{ urlPath: '/review.php', title: '수술후기', section: '수술후기' },
	{ urlPath: '/bbs/board.php?bo_table=notice', title: '공지사항', section: '공지사항' },
	{ urlPath: '/llms.txt', title: 'llms.txt', section: 'AI / GEO' },
];

const noisePages: SolvePageMeta[] = [
	{ urlPath: '/error.php', title: '오류안내', section: '오류안내' },
	{ urlPath: '/404.php', title: '404', section: '404' },
	{ urlPath: '/h1-debug.php', title: 'H1', section: 'H1' },
	{ urlPath: '/defer-check.php', title: 'Defer', section: 'Defer' },
	{ urlPath: '/service-details.html', title: 'Service Details' },
];

for (const page of servicePages) {
	assert(defaultPageSelected(page), `service stays checked: ${page.urlPath}`);
	assert(!isNoiseSchemaPage(page), `service is not noise: ${page.urlPath}`);
}

const citationRows = ensureCitationMenuRows(
	servicePages.filter((p) => p.urlPath !== '/location.php'),
	{ siteName: '테스트병원', allowVirtual: true, hasFaqContent: true, hasHowToContent: true },
);
assert(citationRows.some((p) => p.title === FAQ_GUIDE_TITLE && defaultPageSelected(p)), 'faq citation checked');
assert(citationRows.some((p) => p.title === HOWTO_GUIDE_TITLE && defaultPageSelected(p)), 'howto citation checked');
assert(
	!ensureCitationMenuRows(servicePages, { siteName: '테스트병원' }).some((p) => p.virtual),
	'default hydration omits dummy FAQ/HowTo',
);

for (const page of noisePages) {
	assert(isNoiseSchemaPage(page), `noise detected: ${page.title || page.urlPath}`);
	assert(!defaultPageSelected(page), `noise starts unchecked: ${page.title || page.urlPath}`);
}

assert(pageSelectionKey({ urlPath: '' }) === '/', 'empty path keys as /');
assert(pageSelectionKey({ urlPath: '/intro.php' }) === '/intro.php', 'urlPath is key');

const all = [...servicePages, ...noisePages];
const initial = resolvePageSelection(all, null);
assert(initial.size === servicePages.length, `smart default selected ${initial.size}`);
assert(initial.has('/'), 'main selected');
assert(!initial.has('/error.php'), 'error unchecked');
assert(initial.has('/llms.txt'), 'llms.txt stays checked for GEO deploy');
assert(isLlmsTxtDeployPage({ urlPath: '/llms.txt', title: 'llms.txt' }), 'llms identity');
assert(!isNoiseSchemaPage({ urlPath: '/llms.txt', title: 'llms.txt' }), 'llms is not noise');
assert(defaultPageSelected({ urlPath: '/llms.txt', title: 'llms.txt' }), 'llms default checked');
for (const path of ['/robots.txt', '/sitemap.xml', '/llms-full.txt', '/rss.php']) {
	assert(isRootDeployPage({ urlPath: path }), `root identity ${path}`);
	assert(!isNoiseSchemaPage({ urlPath: path, title: path }), `root not noise ${path}`);
	assert(defaultPageSelected({ urlPath: path, title: path }), `root default checked ${path}`);
}

const afterUser = resolvePageSelection(all, {
	selectedKeys: ['/', '/intro.php'],
	knownKeys: all.map(pageSelectionKey),
	savedAt: '2026-01-01T00:00:00.000Z',
});
assert(afterUser.size === 2, 'persisted selection restored');
assert(afterUser.has('/intro.php') && !afterUser.has('/internal.php'), 'user uncheck kept');

const reanalyzed = resolvePageSelection(
	[...all, { urlPath: '/new.php', title: '신규진료', section: '신규진료' }],
	{
		selectedKeys: ['/', '/intro.php'],
		knownKeys: all.map(pageSelectionKey),
		savedAt: '2026-01-01T00:00:00.000Z',
	},
);
assert(reanalyzed.has('/new.php'), 'new service page smart-checked after reanalyze');
assert(!reanalyzed.has('/internal.php'), 'previous uncheck still persisted');

const selected = filterSelectedPages(all, initial);
assert(selected.every((p) => defaultPageSelected(p)), 'filter keeps only selected');
assert(selected.length === servicePages.length, 'filter count matches smart default');

const mixedMap = buildSchemaMappingJson({
	siteName: 'TestClinic',
	targetUrl: 'https://clinic.example',
	pages: [
		{ urlPath: '/', title: '메인', selected: true },
		{ urlPath: '/intro.php', title: '병원소개', selected: true },
		{ urlPath: '/error.php', title: '오류안내', selected: false },
		{ urlPath: '/llms.txt', title: 'llms.txt', selected: false },
	],
});
assert(mixedMap.pages['index.php'], 'selected main stays in map');
assert(mixedMap.pages['intro.php'], 'selected intro stays in map');
assert(!mixedMap.pages['error.php'], 'unselected error excluded from map');
assert(!Object.keys(mixedMap.pages).some((k) => /llms/i.test(k)), 'llms.txt excluded from map');

const emptyMap = buildSchemaMappingJson({
	siteName: 'TestClinic',
	targetUrl: 'https://clinic.example',
	pages: [],
	allowEmptyPageMap: true,
});
assert(Object.keys(emptyMap.pages).length === 0, 'empty selection stays empty');

const selectedLlmsMap = buildSchemaMappingJson({
	siteName: 'TestClinic',
	targetUrl: 'https://clinic.example',
	pages: [
		{ urlPath: '/', title: '메인', selected: true },
		{ urlPath: '/llms.txt', title: 'llms.txt', selected: true },
	],
});
assert(selectedLlmsMap.pages['index.php'], 'main stays when llms also selected');
assert(!Object.keys(selectedLlmsMap.pages).some((k) => /llms/i.test(k)), 'checked llms.txt still excluded from $page_meta');

const rootCheckedMap = buildSchemaMappingJson({
	siteName: 'TestClinic',
	targetUrl: 'https://clinic.example',
	pages: [
		{ urlPath: '/', title: '메인', selected: true },
		{ urlPath: '/robots.txt', title: 'Robots.Txt', selected: true },
		{ urlPath: '/sitemap.xml', title: 'Sitemap.Xml', selected: true },
		{ urlPath: '/llms-full.txt', title: 'Llms-Full.Txt', selected: true },
	],
});
assert(rootCheckedMap.pages['index.php'], 'main stays when root files also selected');
assert(
	!Object.keys(rootCheckedMap.pages).some((k) => /robots|sitemap|llms/i.test(k)),
	'checked root assets stay out of $page_meta',
);

const withEnsured = ensureLlmsTxtMenuRow(servicePages.filter((p) => p.urlPath !== '/llms.txt'));
assert(withEnsured.some(isLlmsTxtDeployPage), 'ensure injects llms.txt row');
assert(excludeLlmsTxtFromSchemaPages(withEnsured).every((p) => !isLlmsTxtDeployPage(p)), 'schema filter drops llms');

const withRoots = ensureRootDeployMenuRows(servicePages.filter((p) => !isRootDeployPage(p)));
assert(withRoots.some((p) => p.urlPath === '/robots.txt' && p.title === 'Robots.Txt'), 'ensure robots row');
assert(withRoots.some((p) => p.urlPath === '/sitemap.xml' && p.title === 'Sitemap.Xml'), 'ensure sitemap row');
assert(withRoots.some((p) => p.urlPath === '/llms.txt'), 'ensure llms row');
assert(withRoots.some((p) => p.urlPath === '/rss.php' && p.title === 'Rss.Php'), 'ensure rss.php row');
const rootTail = withRoots.slice(-5).map((p) => p.urlPath);
assert(
	rootTail[0] === '/robots.txt' &&
		rootTail[1] === '/sitemap.xml' &&
		rootTail[2] === '/llms.txt' &&
		rootTail[3] === '/llms-full.txt' &&
		rootTail[4] === '/rss.php',
	'root rows pinned to table bottom',
);
assert(
	excludeRootDeployFromSchemaPages(withRoots).every((p) => !isRootDeployPage(p)),
	'schema filter drops all root assets',
);
const flagsOn = resolveRootDeployFlags(withRoots.map((p) => ({ ...p, selected: true })));
assert(
	flagsOn.deployRobotsTxt &&
		flagsOn.deploySitemapXml &&
		flagsOn.deployLlmsTxt &&
		flagsOn.deployLlmsFullTxt &&
		flagsOn.deployRssPhp,
	'all root flags on',
);
const flagsOff = resolveRootDeployFlags(
	withRoots.map((p) => ({ ...p, selected: !isRootDeployPage(p) })),
);
assert(
	!flagsOff.deployRobotsTxt &&
		!flagsOff.deploySitemapXml &&
		!flagsOff.deployLlmsTxt &&
		!flagsOff.deployLlmsFullTxt &&
		!flagsOff.deployRssPhp,
	'unchecked root flags off',
);

const llmsMd = buildSolveLlmsTxtMarkdown({
	siteName: '테스트의원',
	targetUrl: 'https://clinic.example',
	industryType: 'MEDICAL',
	pages: [
		{ urlPath: '/', title: '병원소개' },
		{ urlPath: '/internal.php', title: '내과진료' },
		{ urlPath: '/llms.txt', title: 'llms.txt' },
	],
	navItems: [{ name: '외과진료', url: '/surgery.php' }],
	streetAddress: '서울시 강남구 테헤란로 1',
	representativeName: '홍길동',
	representativeTitle: '대표원장',
});
assert(llmsMd.includes('# 테스트의원'), 'llms markdown brand');
assert(llmsMd.includes('내과진료'), 'llms markdown service/url map');
assert(llmsMd.includes('https://clinic.example/internal.php'), 'llms markdown absolute url');
assert(!llmsMd.includes('/llms.txt)'), 'llms markdown does not list itself as a page');

const robots = buildAiFriendlyRobotsTxt('https://clinic.example/about', 'gnuboard');
assert(robots.includes('User-agent: GPTBot'), 'robots allows GPTBot');
assert(robots.includes('User-agent: PerplexityBot'), 'robots allows PerplexityBot');
assert(robots.includes('User-agent: ClaudeBot'), 'robots allows ClaudeBot');
assert(robots.includes('User-agent: Google-Extended'), 'robots allows Google-Extended');
assert(robots.includes('User-agent: Meta-ExternalAgent'), 'robots allows Meta-ExternalAgent');
assert(robots.includes('User-agent: Cohere-ai'), 'robots allows Cohere-ai');
assert(robots.includes('Allow: /theme/'), 'robots allows gnuboard theme assets');
assert(robots.includes('Disallow: /bbs/write*'), 'robots blocks gnuboard write');
assert(robots.includes('Disallow: /bbs/login*'), 'robots blocks gnuboard login');
assert(robots.includes('Sitemap: https://clinic.example/sitemap.xml'), 'robots sitemap line');
assert(robots.includes('# LLMs: https://clinic.example/llms.txt'), 'robots llms index comment');

const sitemap = buildSelectedPagesSitemapXml({
	targetUrl: 'https://clinic.example',
	selectedPages: [
		{ urlPath: '/', title: '메인' },
		{ urlPath: '/internal.php', title: '내과진료' },
		{ urlPath: '/llms.txt', title: 'llms.txt' },
	],
	lastmod: '2026-08-21',
});
assert(sitemap.includes('<loc>https://clinic.example/</loc>'), 'sitemap home loc');
assert(sitemap.includes('<loc>https://clinic.example/internal.php</loc>'), 'sitemap sub loc');
assert(sitemap.includes('<lastmod>2026-08-21</lastmod>'), 'sitemap lastmod');
assert(sitemap.includes('<changefreq>daily</changefreq>'), 'sitemap home changefreq');
assert(sitemap.includes('<priority>1.0</priority>'), 'sitemap home priority');
assert(!sitemap.includes('llms.txt'), 'sitemap excludes llms.txt');
assert(!sitemap.includes('robots.txt'), 'sitemap excludes robots.txt');
assert(!sitemap.includes('sitemap.xml'), 'sitemap excludes itself');
assert(!sitemap.includes('llms-full.txt'), 'sitemap excludes llms-full.txt');
assert(
	sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'),
	'sitemap xmlns standard',
);
{
	const tags = [...sitemap.matchAll(/<\/?([a-z0-9:]+)/gi)].map((m) => m[1].toLowerCase());
	const allowed = new Set(['urlset', 'url', 'loc', 'lastmod', 'changefreq', 'priority']);
	assert(
		tags.every((tag) => allowed.has(tag)),
		`sitemap only standard tags: ${[...new Set(tags.filter((t) => !allowed.has(t)))].join(',')}`,
	);
}

assert(resolveSitemapUrlWeight({ urlPath: '/', title: '메인' }).priority === '1.0', 'weight home 1.0');
assert(resolveSitemapUrlWeight({ urlPath: '/doctor.php', title: '대표 의료진' }).priority === '0.9', 'weight doctor 0.9');
assert(resolveSitemapUrlWeight({ urlPath: '/sub301.php', title: '임플란트' }).priority === '0.9', 'weight sub301 0.9');
assert(resolveSitemapUrlWeight({ urlPath: '/701.php', title: '교정' }).priority === '0.9', 'weight 701.php 0.9');
assert(resolveSitemapUrlWeight({ urlPath: '/location.php', title: '오시는길' }).priority === '0.8', 'weight location 0.8');
assert(resolveSitemapUrlWeight({ urlPath: '/ceo_message.php', title: '인사말' }).priority === '0.6', 'weight greeting 0.6');
assert(resolveSitemapUrlWeight({ urlPath: '/about.php', title: '병원소개' }).priority === '0.6', 'weight about 0.6');
assert(
	resolveSitemapUrlWeight({ urlPath: '/bbs/board.php?bo_table=notice', title: '공지사항' }).priority === '0.7',
	'weight board 0.7',
);
assert(
	resolveSitemapUrlWeight({ urlPath: '/bbs/board.php?bo_table=notice', title: '공지사항' }).changefreq === 'weekly',
	'weight board weekly',
);

const weighted = buildSelectedPagesSitemapXml({
	targetUrl: 'https://maumah.co.kr/about',
	selectedPages: [
		{ urlPath: '/sub301.php', title: '임플란트', fromGnb: true, selected: true },
		{ urlPath: '/location.php', title: '오시는길', fromGnb: true, selected: true },
		{ urlPath: '/ceo_message.php', title: '인사말', fromGnb: true, selected: true },
		{ urlPath: '/bbs/board.php?bo_table=notice', title: '공지', fromGnb: true, selected: true },
		{ urlPath: '/hidden.php', title: '숨김', selected: false },
		{ urlPath: '/index.php', title: '홈', selected: true },
	],
	lastmod: '2026-08-21',
});
assert(weighted.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'weighted xml decl');
assert(weighted.indexOf('https://maumah.co.kr/') < weighted.indexOf('/sub301.php'), 'home loc first');
assert(weighted.includes('<priority>1.0</priority>'), 'auto home 1.0');
assert(weighted.includes('<loc>https://maumah.co.kr/sub301.php</loc>'), 'checked gnb url 1:1');
assert(weighted.includes('<priority>0.9</priority>'), 'clinic priority');
assert(weighted.includes('<priority>0.8</priority>'), 'location priority');
assert(weighted.includes('<priority>0.6</priority>'), 'about priority');
assert(weighted.includes('<priority>0.7</priority>'), 'board priority');
assert(!weighted.includes('/hidden.php'), 'unchecked page excluded');
assert(!weighted.includes('/index.php'), 'index.php collapsed to origin/');
assert((weighted.match(/<loc>https:\/\/maumah\.co\.kr\/<\/loc>/g) || []).length === 1, 'single home loc');

const homeOnly = buildSelectedPagesSitemapXml({
	targetUrl: 'https://maumah.co.kr/',
	selectedPages: [{ urlPath: '/tour.php', title: '둘러보기', selected: true }],
	lastmod: '2026-08-21',
});
assert(homeOnly.includes('<loc>https://maumah.co.kr/</loc>'), 'home auto prepended');
assert(homeOnly.includes('<loc>https://maumah.co.kr/tour.php</loc>'), 'tour kept');
assert(homeOnly.indexOf('https://maumah.co.kr/</loc>') < homeOnly.indexOf('/tour.php'), 'prepended home stays first');

const llmsFull = buildSolveLlmsFullMarkdown({
	siteName: '테스트의원',
	targetUrl: 'https://clinic.example',
	industryType: 'MEDICAL',
	pages: [
		{ urlPath: '/', title: '메인', description: '공식 홈' },
		{ urlPath: '/internal.php', title: '내과진료', description: '내과 맞춤 진료' },
	],
	openingHoursOpens: '09:00',
	openingHoursCloses: '18:00',
	streetAddress: '서울시 강남구 테헤란로 1',
	representativeName: '홍길동',
});
assert(llmsFull.includes('llms-full'), 'full file self title');
assert(llmsFull.includes('내과 맞춤 진료'), 'full file page detail');
assert(llmsFull.includes('09:00–18:00'), 'full file hours');

const pack = buildGeoRootAssetPack({
	siteName: '테스트의원',
	targetUrl: 'https://clinic.example',
	pages: [
		{ urlPath: '/', title: '메인' },
		{ urlPath: '/intro.php', title: '병원소개' },
	],
});
assert(pack.pageCount === 2, 'pack page count');
assert(pack.robotsTxt.includes('Sitemap:'), 'pack robots');
assert(pack.sitemapXml.includes('병원소개') === false && pack.sitemapXml.includes('/intro.php'), 'pack sitemap url');
assert(pack.llmsTxt.includes('# 테스트의원'), 'pack llms');
assert(pack.llmsFullTxt.includes('심층 인용'), 'pack llms-full');
assert(pack.rssPhp.includes("include_once('./common.php')") && pack.rssPhp.includes('xmlns:atom='), 'pack rss.php');

const descBound = applyPageDescriptionOverrides(servicePages, {
	'/internal.php': '관리자 수정 내과 Description',
});
assert(
	descBound.find((p) => p.urlPath === '/internal.php')?.description === '관리자 수정 내과 Description',
	'inline desc override binds to matching row',
);
assert(
	descBound.find((p) => p.urlPath === '/intro.php')?.description === undefined,
	'unedited desc stays original',
);

console.log('OK page-selection', {
	service: servicePages.length,
	noise: noisePages.length,
	initial: initial.size,
});
