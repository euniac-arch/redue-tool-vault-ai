/**
 * Diagnosis collector + 122-point score pipeline integrity.
 * Run: npx tsx scripts/test-diagnosis-engine.ts
 */
import * as cheerio from 'cheerio';
import { coerceHttpUrl, isPunycodeHost, resolveRedirectLocation, toPunycodeHref } from '../lib/audit/normalize-url';
import {
	extractHydrationSignals,
	parseJsonLd,
	parseJsonLdDocument,
	parseMicrodata,
	parsePageHtml,
	repairJsonLdText,
} from '../lib/audit/parser';
import { extractSitemapUrlsFromRobots, parseSitemapXml } from '../lib/audit/sitemap';
import { hasUnsafeRedirect } from '../lib/audit/fetch-page';
import { parseAiBotAccessFromRobots, resolveAiBotsAllowed } from '../lib/audit/robots-ai-bots';
import { clampEarned, runScorePipeline } from '../lib/audit/scorePipeline';
import { buildOnPageDiagnostic, normalizeChecklistItems } from '../lib/audit/onpage-diagnostic';
import type { AuditCategory, AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(id: string, status: AuditCheckItem['status'], weight: number): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight };
}

function category(
	id: AuditCategory['id'],
	score: number,
	maxScore: number,
	checks: AuditCheckItem[],
): AuditCategory {
	return { id, label: id, score, maxScore, status: 'PASS', statusNote: '', checks };
}

// —— 1. Punycode / Hangul domain ————————————————————————————————
const hangul = coerceHttpUrl('한국.kr');
assert('bare Hangul host gets https', hangul.protocol === 'https:');
assert('Hangul host is Punycode', isPunycodeHost(hangul.hostname), hangul.hostname);
assert('href is ASCII', /^https:\/\/xn--/i.test(toPunycodeHref('https://한국.kr/소개')));
assert('already-punycode host stays ASCII', coerceHttpUrl('https://xn--3e0b707e.kr').hostname.startsWith('xn--'));
assert(
	'relative Location resolves',
	resolveRedirectLocation('https://example.com/a', '/b')?.href === 'https://example.com/b',
);

// —— 2. JSON-LD repair / @graph / array ———————————————————————————
const trailing = parseJsonLdDocument(`{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "레드유",
  "url": "https://redue.ai/",
}`);
assert('trailing-comma JSON-LD parses', Boolean(trailing && (trailing as { name?: string }).name === '레드유'));
assert('repair strips trailing comma', repairJsonLdText('{"a":1,}').includes('"a":1'));

const graphHtml = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"MedicalBusiness","name":"햇살의원","url":"https://clinic.example/","telephone":"031-000-0000","address":{"streetAddress":"안성"},"logo":"https://clinic.example/l.png","sameAs":["https://blog.example"]},
  {"@type":["FAQPage"],"mainEntity":[]},
  {"@type":"Person","name":"김원장","jobTitle":"대표원장"}
]}
</script>
</head></html>`;
const graph$ = cheerio.load(graphHtml);
const graph = parseJsonLd(graph$, graphHtml);
assert('graph types include MedicalBusiness', graph.types.includes('MedicalBusiness'));
assert('graph types include FAQPage', graph.types.includes('FAQPage'));
assert('graph types include Person', graph.types.includes('Person'));
assert('NAP name extracted', graph.nap.name === '햇살의원');
assert('NAP telephone extracted', graph.nap.telephone === '031-000-0000');
assert('local NAP complete → no missing', graph.organizationMissing.length === 0, graph.organizationMissing.join(','));

// —— 3. Microdata ———————————————————————————————————————————————
const microHtml = `<div itemscope itemtype="https://schema.org/LocalBusiness">
  <span itemprop="name">로컬샵</span>
  <a itemprop="url" href="https://shop.example/"></a>
  <span itemprop="telephone">02-111-2222</span>
</div>`;
const micro$ = cheerio.load(microHtml);
const microNodes = parseMicrodata(micro$);
assert('microdata type is LocalBusiness', microNodes[0]?.['@type'] === 'LocalBusiness');
assert('microdata name', microNodes[0]?.name === '로컬샵');
const microParsed = parseJsonLd(micro$, microHtml);
assert('microdata folds into schema types', microParsed.types.includes('LocalBusiness'));

// —— 4. CSR hydration ————————————————————————————————————————————
const nextHtml = `<html><head></head><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
	props: {
		pageProps: {
			seo: { title: '하이드레이션 타이틀', description: '하이드레이션 설명 텍스트입니다.'.repeat(4) },
			schema: { '@type': 'Organization', name: '하이드레이션', url: 'https://spa.example/' },
		},
	},
})}</script>
</body></html>`;
const hydra = extractHydrationSignals(nextHtml);
assert('Next hydration title', hydra.title === '하이드레이션 타이틀');
assert('Next hydration schema @type', hydra.schemaNodes.some((n) => n['@type'] === 'Organization'));
const nextParsed = parsePageHtml(cheerio.load(nextHtml), 'https://spa.example/', undefined, nextHtml);
assert('CSR title recovered', nextParsed.meta.title === '하이드레이션 타이틀');
assert('CSR schema recovered', nextParsed.schema.types.includes('Organization'));

// —— 5. Sitemap / robots ——————————————————————————————————————————
const robotsTxt = `User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml
User-agent: GPTBot
Disallow: /
`;
assert(
	'robots Sitemap: extracted',
	extractSitemapUrlsFromRobots(robotsTxt)[0] === 'https://example.com/sitemap.xml',
);
const sitemapXml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://example.com/</loc></url>
<url><loc>https://example.com/about</loc></url>
</urlset>`;
const sitemap = parseSitemapXml(sitemapXml);
assert('sitemap urlset valid', sitemap.valid && sitemap.urlCount === 2 && !sitemap.isIndex);
assert('HTML is not a sitemap', parseSitemapXml('<html><title>sitemap</title></html>').valid === false);
const access = parseAiBotAccessFromRobots(robotsTxt);
assert('GPTBot blocked in sample robots', access.gptbot === false);
assert('Perplexity allowed via *', access.perplexitybot === true);
assert('resolveAiBotsAllowed false when GPTBot blocked', resolveAiBotsAllowed(access) === false);

// —— 6. Redirect safety ——————————————————————————————————————————
assert(
	'https→http is unsafe',
	hasUnsafeRedirect([{ from: 'https://a.com/', to: 'http://a.com/', status: 301 }]),
);
assert(
	'http→https is safe',
	!hasUnsafeRedirect([{ from: 'http://a.com/', to: 'https://a.com/', status: 301 }]),
);

// —— 7. Score pipeline fail-safe + 122 mapping ————————————————————
assert('NaN earned clamps to 0', clampEarned(Number.NaN, 15) === 0);
assert('overflow earned clamps to max', clampEarned(99, 15) === 15);
assert('negative earned clamps to 0', clampEarned(-4, 15) === 0);

const report = {
	url: 'https://example.com/',
	hasSsl: true,
	lang: 'ko' as const,
	score: 69.5,
	maxScore: 122,
	categories: [
		category('security', 10, 15, [check('https', 'pass', 10), check('response-time', 'warning', 5)]),
		category('performance', 10.5, 12, [
			check('page-weight', 'pass', 5),
			check('render-blocking', 'warning', 3),
			check('image-alt', 'pass', 4),
		]),
		category('seo', 20, 29, [
			check('title', 'pass', 5),
			check('meta-description', 'pass', 5),
			check('og-tags', 'fail', 5),
			check('canonical', 'pass', 5),
			check('single-h1', 'pass', 4),
			check('heading-skip', 'warning', 3),
			check('html-lang', 'pass', 2),
		]),
		category('schema', 18, 36, [
			check('jsonld-present', 'pass', 8),
			check('organization', 'pass', 7),
			check('article-fields', 'fail', 6),
			check('faq-howto-schema', 'fail', 6),
			check('news-article', 'warning', 5),
			check('website-schema', 'pass', 4),
		]),
		category('geo', 11, 30, [
			check('llms-txt', 'fail', 6),
			check('ai-bots-allowed', 'pass', 6),
			check('crawlable-text', 'pass', 5),
			check('person-eeat', 'fail', 5),
			check('eeat-author', 'warning', 4),
			check('heading-structure', 'pass', 4),
		]),
	],
	checklist: [] as AuditCheckItem[],
} as AuditReport;
report.checklist = report.categories.flatMap((c) => c.checks);

const onpage = buildOnPageDiagnostic(report);
const pipeline = runScorePipeline(normalizeChecklistItems(report), true);
assert('pipeline max is 122', pipeline.totalMax === 122);
assert('pipeline earned === onpage raw', pipeline.totalEarned === onpage.totalRawScore, `${pipeline.totalEarned} vs ${onpage.totalRawScore}`);
assert(
	'normalizedTotalScore === round(raw/122*100)',
	pipeline.normalizedTotalScore === Math.round((pipeline.totalEarned / 122) * 100),
);
assert(
	'5-category sum === pipeline earned',
	onpage.categories.reduce((sum, cat) => sum + cat.rawScore, 0) === pipeline.totalEarned,
);
assert(
	'defect counts match pipeline',
	onpage.categories.reduce((sum, cat) => sum + cat.defectCount, 0) === pipeline.defectCount,
);
assert(
	'warning counts match pipeline',
	onpage.categories.reduce((sum, cat) => sum + cat.warningCount, 0) === pipeline.warningCount,
);

const geo = onpage.categories.find((c) => c.id === 'geo')!;
assert('GEO max is 30', geo.maxScore === 30);
assert('GEO defects are fail-only (2)', geo.defectCount === 2, String(geo.defectCount));
assert('GEO warnings are warning-only (1)', geo.warningCount === 1, String(geo.warningCount));

const blockedGeo = structuredClone(report);
const bots = blockedGeo.categories.find((c) => c.id === 'geo')!.checks.find((c) => c.id === 'ai-bots-allowed')!;
bots.status = 'fail';
bots.passed = false;
blockedGeo.checklist = blockedGeo.categories.flatMap((c) => c.checks);
const blockedOnpage = buildOnPageDiagnostic(blockedGeo);
const blockedGeoCat = blockedOnpage.categories.find((c) => c.id === 'geo')!;
assert('AI bot block drops GEO raw', blockedGeoCat.rawScore < geo.rawScore);
assert('AI bot block increments GEO defects', blockedGeoCat.defectCount === geo.defectCount + 1);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall diagnosis-engine assertions passed');
