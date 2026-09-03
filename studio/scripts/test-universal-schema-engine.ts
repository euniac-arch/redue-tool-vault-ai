/**
 * Universal Schema Injection Engine — no-hallucination + CMS/deploy helpers.
 * Run: npx tsx scripts/test-universal-schema-engine.ts
 */
import {
	detectSiteCms,
	extractSiteFacts,
	buildSchemaTemplate,
	runUniversalSchemaEngine,
	siblingBackupPath,
	hasRedueStudioMarker,
	preparePatchedSource,
} from '../lib/solve/universal-schema';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const emptyFacts = extractSiteFacts({
	origin: 'https://clinic.example.com',
	pages: [{ path: '/', html: '<html><head><title></title></head><body>소개</body></html>' }],
});
const emptyGraph = buildSchemaTemplate(emptyFacts);
const emptyJson = JSON.stringify(emptyGraph.graph);
assert(!emptyJson.includes('홍길동'), 'no 홍길동');
assert(!emptyJson.includes('050-0000-0000'), 'no dummy phone');
assert(!emptyJson.includes('000-00-00000'), 'no dummy tax');
assert(!emptyJson.includes('"대표자명"'), 'no 대표자명');
assert(!emptyGraph.graph['@graph'].some((n) => n['@type'] === 'Person'), 'no Person without name');
assert(!emptyGraph.graph['@graph'].some((n) => n['@type'] === 'FAQPage'), 'no FAQ without Q&A');
assert(!emptyGraph.graph['@graph'].some((n) => n['@type'] === 'VideoObject'), 'no Video without embed');
assert(!emptyJson.includes('"taxID"'), 'no empty taxID key');
assert(!emptyJson.includes('"faxNumber"'), 'no empty fax key');

const liveHtml = `<!doctype html>
<html>
<head>
  <meta property="og:site_name" content="서초내과의원" />
  <title>서초내과의원</title>
  <meta name="description" content="서초 내과 진료 안내" />
</head>
<body>
  <h1>서초내과의원</h1>
  <h2>임플란트 시술</h2>
  <p>임플란트 시술은 본원에서 상담 후 진행합니다.</p>
  <iframe src="https://www.youtube.com/embed/dQw4w9wgGcA" title="병원 소개 영상"></iframe>
  <div class="faq">
    <dt>예약은 어떻게 하나요?</dt>
    <dd>대표전화로 예약하시면 됩니다.</dd>
  </div>
  <footer>
    대표자: 김원장 | 전화: 02-555-1212 | 팩스: 02-555-3434
    주소: 서울특별시 서초구 서초대로 10
    사업자등록번호: 120-81-47521
    <a href="https://blog.naver.com/seocho">네이버 블로그</a>
  </footer>
</body>
</html>`;

const live = extractSiteFacts({
	origin: 'https://clinic.example.com',
	pages: [{ path: '/', html: liveHtml, filePath: 'index.html' }],
	filePaths: ['index.html'],
});
assert(live.nap.siteName === '서초내과의원', `siteName ${live.nap.siteName}`);
assert(live.nap.repName === '김원장', `rep ${live.nap.repName}`);
assert(live.nap.telephone === '02-555-1212', `tel ${live.nap.telephone}`);
assert(live.nap.taxId === '120-81-47521', `tax ${live.nap.taxId}`);
assert(live.nap.faxNumber === '02-555-3434', `fax ${live.nap.faxNumber}`);
assert((live.nap.streetAddress || '').includes('서초'), `street ${live.nap.streetAddress}`);
assert(live.nap.sameAs.some((u) => /blog\.naver\.com/.test(u)), 'sameAs naver blog');
assert(live.pages[0].faq.length >= 1, 'faq extracted');
assert(live.pages[0].videos.some((v) => v.youtubeId === 'dQw4w9wgGcA'), 'youtube id');
assert(live.pages[0].medicalAbout.some((m) => m.name === '임플란트 시술' && m.type === 'MedicalTherapy'), 'medical therapy from heading');
assert(live.cms === 'static-html', `cms ${live.cms}`);

const liveTpl = buildSchemaTemplate(live);
assert(liveTpl.graph['@graph'].some((n) => n['@type'] === 'Person' && n.name === '김원장'), 'Person from footer');
assert(liveTpl.graph['@graph'].some((n) => n['@type'] === 'FAQPage'), 'FAQPage from real Q&A');
assert(liveTpl.graph['@graph'].some((n) => n['@type'] === 'VideoObject'), 'VideoObject from iframe');
assert(liveTpl.graph['@graph'].some((n) => n['@type'] === 'MedicalTherapy'), 'MedicalTherapy node');
assert(liveTpl.graph['@graph'].some((n) => n['@type'] === 'BreadcrumbList'), 'BreadcrumbList');
assert(!JSON.stringify(liveTpl.graph).includes('""'), 'no empty string values');

const noFaq = extractSiteFacts({
	origin: 'https://clinic.example.com',
	pages: [{ path: '/', html: '<html><body><h1>소개</h1><p>본문만 있습니다.</p></body></html>' }],
});
assert(buildSchemaTemplate(noFaq).graph['@graph'].every((n) => n['@type'] !== 'FAQPage'), 'FAQ omitted without Q&A');

assert(detectSiteCms({ html: "<?php if (!defined('_GNUBOARD_')) exit;" }).cms === 'gnuboard', 'gnuboard detect');
assert(detectSiteCms({ filePaths: ['wp-load.php', 'wp-content/themes/a/header.php'] }).cms === 'wordpress', 'wp-load detect');
assert(detectSiteCms({ filePaths: ['index.html', 'about.html'] }).cms === 'static-html', 'static html detect');
assert(detectSiteCms({ filePaths: ['header.php', 'layout.php'] }).cms === 'php', 'php detect');

assert(siblingBackupPath('theme/head.sub.php') === 'theme/head.sub.php.bak_redue', 'bak suffix');
assert(hasRedueStudioMarker('/* REDUE_AI_STUDIO:START */ x /* REDUE_AI_STUDIO:END */'), 'marker detect');

const first = preparePatchedSource('<html><head></head><body></body></html>', {
	relativePath: 'index.html',
	content: '/* REDUE_AI_STUDIO:START */\nONE\n/* REDUE_AI_STUDIO:END */\n',
	mode: 'patch-inject',
});
assert(first.next.includes('ONE'), 'first inject');
const second = preparePatchedSource(first.next, {
	relativePath: 'index.html',
	content: '/* REDUE_AI_STUDIO:START */\nTWO\n/* REDUE_AI_STUDIO:END */\n',
	mode: 'patch-inject',
});
assert(second.replacedExisting, 'replace existing');
assert(second.next.includes('TWO'), 'replaced content');
assert((second.next.match(/REDUE_AI_STUDIO:START/g) || []).length === 1, 'single marker after replace');

const engine = runUniversalSchemaEngine({
	origin: 'https://clinic.example.com',
	pages: [{ path: '/', html: liveHtml, filePath: 'index.html' }],
	filePaths: ['index.html'],
});
assert(engine.plans.length >= 1, 'plans');
assert(engine.plans[0].cms === 'static-html', 'static plan');
assert(engine.plans[0].content.includes('REDUE_AI_STUDIO'), 'plan marker');
assert(engine.cmsNote.includes('정적 HTML'), 'cms note');

console.log('test-universal-schema-engine: ok');
