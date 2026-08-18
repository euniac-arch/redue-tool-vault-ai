import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { extractSiteMetadata } from '../lib/audit/site-metadata';
import { formatTargetCategory } from '../lib/audit/target-entity';
import { detectCmsFromHtml, decodeHtmlBuffer } from '../lib/crawling/hybrid-scan';

const cases: Array<[string, string]> = [
	['.jsp jsessionid egovframe', 'JSP / 자체구축 (Legacy)'],
	['.aspx form __VIEWSTATE', 'ASP.NET / Classic ASP'],
	['gnuboard g5_url', '그누보드 (GNUBOARD)'],
	['cdn.imweb.me imweb', '아임웹 (Imweb)'],
	['cafe24.com shop', '카페24 (Cafe24)'],
	['wp-content wordpress', '워드프레스 (WordPress)'],
	['/_next/static/chunks/main.js __NEXT_DATA__', 'Next.js / React (SPA)'],
	// Gnuboard 5 landing pages (no board.php / /bbs/)
	['<script>var g5_url = "https://sunshineclinic.kr"; var g5_bbs_url = g5_url+"/bbs"; var g5_is_member = "0";</script>', '그누보드 (GNUBOARD)'],
	['<link rel="stylesheet" href="/theme/basic/css/default.css"><script src="/js/wrest.js"></script>', '그누보드 (GNUBOARD)'],
	['<script src="/js/common.js?ver=191202"></script><link href="/theme/clinic/css/style.css" rel="stylesheet">', '그누보드 (GNUBOARD)'],
	['<script src="/wp-includes/js/jquery.min.js?ver=6.4"></script> wp-content', '워드프레스 (WordPress)'],
];

let failed = 0;
for (const [html, expect] of cases) {
	const got = detectCmsFromHtml(html);
	const ok = got === expect;
	if (!ok) failed += 1;
	console.log(ok ? 'OK' : 'FAIL', '|', got, '| expected:', expect);
}

const euc = iconv.encode('<meta charset="euc-kr"><title>한글테스트</title>', 'euc-kr');
const decoded = decodeHtmlBuffer(euc, 'text/html; charset=euc-kr');
const decodeOk = decoded.includes('한글테스트');
if (!decodeOk) failed += 1;
console.log(decodeOk ? 'OK' : 'FAIL', '| EUC-KR decode:', decoded.slice(0, 80));

function classifyCategory(html: string, url: string) {
	const $ = cheerio.load(html);
	const meta = extractSiteMetadata($, url, 'ko', html);
	return formatTargetCategory(meta, 'ko');
}

const categoryCases: Array<[string, string, string]> = [
	[
		'<html><head><title>선샤인의원</title><meta property="og:description" content="부산 사하구 뷰티웰빙센터"></head></html>',
		'https://sunshineclinic.kr/',
		'의료 / 일반의원',
	],
	[
		'<html><head><title>OO성형외과</title><meta name="description" content="쌍꺼풀 지방흡입 보톡스"></head></html>',
		'https://plastic.example.kr/',
		'의료 / 성형외과',
	],
	[
		'<html><head><title>OO정형외과의원</title><meta property="og:description" content="통증의학과 재활 케어"></head></html>',
		'https://ortho.example.kr/',
		'의료 / 정형외과',
	],
];

for (const [html, url, expect] of categoryCases) {
	const got = classifyCategory(html, url);
	const ok = got === expect;
	if (!ok) failed += 1;
	console.log(ok ? 'OK' : 'FAIL', '|', got, '| expected:', expect);
}

process.exit(failed ? 1 : 0);
