import iconv from 'iconv-lite';
import { detectCmsFromHtml, decodeHtmlBuffer } from '../lib/crawling/hybrid-scan';

const cases: Array<[string, string]> = [
	['.jsp jsessionid egovframe', 'JSP / 자체구축 (Legacy)'],
	['.aspx form __VIEWSTATE', 'ASP.NET / Classic ASP'],
	['gnuboard g5_url', '그누보드 (GNUBOARD)'],
	['cdn.imweb.me imweb', '아임웹 (Imweb)'],
	['cafe24.com shop', '카페24 (Cafe24)'],
	['wp-content wordpress', '워드프레스 (WordPress)'],
	['/_next/static/chunks/main.js __NEXT_DATA__', 'Next.js / React (SPA)'],
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

process.exit(failed ? 1 : 0);
