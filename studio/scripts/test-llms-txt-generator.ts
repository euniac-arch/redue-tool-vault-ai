/**
 * On-page NAP extractor + `/llms.txt` generator.
 * Run: npx tsx scripts/test-llms-txt-generator.ts
 */
import { extractRepresentative } from '../lib/audit/extractors/entity';
import {
	extractNapFromCorpus,
	extractOnpageNapFromHtml,
	formatKoreanTelephone,
	KR_PHONE_RE,
} from '../lib/audit/extractors/nap';
import {
	extractSiteDiagnostic,
	generateLlmsTxt,
	type SiteDiagnosticResult,
} from '../lib/audit/llms-txt';
import { napFromAuditReport } from '../lib/geo/prescription-patches';
import type { AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const KOREAIONLAB_FOOTER_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <title>한국중입자 암치료연구소</title>
  <meta name="description" content="중입자·양성자 암치료 상담 연구소">
  <meta name="keywords" content="중입자치료, 세포치료, 줄기세포치료">
</head>
<body>
  <header>
    <nav>
      <a href="/301.php">중입자치료</a>
      <a href="/302.php">세포치료</a>
      <a href="/303.php">줄기세포치료</a>
      <a href="/501.php">상담문의</a>
    </nav>
    <a href="tel:02-1234-5678">대표번호 02-1234-5678</a>
  </header>
  <h1>해외 중입자 치료 상담</h1>
  <h2>중입자치료</h2>
  <h2>세포치료</h2>
  <footer id="ft">
    <div class="ft_info">
      상호 : 한국중입자 암치료연구소
      대표자 : 김중입
      사업자등록번호 : 123-45-67890
      주소 : 서울특별시 서초구 서초대로 77길 55, 3층
      대표번호 : 02-1234-5678
      TEL : 02-1234-5678
      상담전화 02.1234.5678
      Copyright © 한국중입자 암치료연구소 All Rights Reserved.
    </div>
  </footer>
</body>
</html>`;

const KOREAIONLAB_JSONLD_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <title>한국중입자 암치료연구소</title>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"MedicalClinic","name":"한국중입자 암치료연구소","telephone":"+82-2-3456-7890","address":{"@type":"PostalAddress","addressCountry":"KR","addressRegion":"서울특별시","addressLocality":"서초구","streetAddress":"서초대로 77길 55"},"founder":{"@type":"Person","name":"이대표"}}
  </script>
</head>
<body>
  <footer>Copyright 2026</footer>
</body>
</html>`;

const TABLE_FOOTER_HTML = `<html><body>
<footer>
  <table>
    <tr><th>대표원장</th><td>박서준</td></tr>
    <tr><th>주소</th><td>서울시 강남구 테헤란로 123</td></tr>
    <tr><th>전화</th><td><a href="tel:02-555-1234">02-555-1234</a></td></tr>
  </table>
</footer>
</body></html>`;

assert('format 02-1234-5678', formatKoreanTelephone('0212345678') === '02-1234-5678');
assert('format +82-2-1234-5678', formatKoreanTelephone('+82-2-1234-5678') === '02-1234-5678');
assert('format tel href', formatKoreanTelephone('tel:02-1234-5678') === '02-1234-5678');
assert('format 010', formatKoreanTelephone('01012345678') === '010-1234-5678');
KR_PHONE_RE.lastIndex = 0;
assert('KR_PHONE_RE matches 02-1234-5678', KR_PHONE_RE.test('02-1234-5678'));

const pipeCorpus = extractNapFromCorpus(
	'상호: 한국중입자 암치료연구소 | 대표자: 김중입 | 전화: 02-9876-5432 | 주소: 서울특별시 서초구 서초대로 77길 55, 3층',
);
assert('corpus telephone', pipeCorpus.telephone === '02-9876-5432', pipeCorpus.telephone);
assert('corpus address has 서초', /서초/.test(pipeCorpus.address), pipeCorpus.address);
assert('corpus street has 서초대로', /서초대로/.test(pipeCorpus.streetAddress), pipeCorpus.streetAddress);

const footerOnly = extractOnpageNapFromHtml(KOREAIONLAB_FOOTER_HTML, 'https://koreaionlab.co.kr/');
assert('footer tel href wins', footerOnly.telephone === '02-1234-5678', footerOnly.telephone);
assert('footer full address', /서초/.test(footerOnly.address) && /서초대로/.test(footerOnly.address), footerOnly.address);
assert('footer services include 중입자치료', footerOnly.services.includes('중입자치료'), String(footerOnly.services));

const footerRep = extractRepresentative(KOREAIONLAB_FOOTER_HTML);
assert('footer 대표자 김중입', footerRep.isExtracted && footerRep.name === '김중입', footerRep.name);
assert('footer jobTitle 대표자', footerRep.jobTitle === '대표자', footerRep.jobTitle);

const jsonLdPage = extractOnpageNapFromHtml(KOREAIONLAB_JSONLD_HTML, 'https://koreaionlab.co.kr/');
assert('jsonld telephone normalized', jsonLdPage.telephone === '02-3456-7890', jsonLdPage.telephone);
assert('jsonld address locality 서초구', jsonLdPage.addressLocality === '서초구', jsonLdPage.addressLocality);
const jsonLdRep = extractRepresentative(KOREAIONLAB_JSONLD_HTML);
assert('jsonld founder 이대표', jsonLdRep.isExtracted && jsonLdRep.name === '이대표', jsonLdRep.name);

const tablePage = extractOnpageNapFromHtml(TABLE_FOOTER_HTML, 'https://clinic.example/');
assert('table tel: href', tablePage.telephone === '02-555-1234', tablePage.telephone);
assert('table address 강남', /강남/.test(tablePage.address), tablePage.address);
const tableRep = extractRepresentative(TABLE_FOOTER_HTML);
assert('table 대표원장 박서준', tableRep.name === '박서준', tableRep.name);
assert('table title 대표원장', tableRep.jobTitle === '대표원장', tableRep.jobTitle);

const physician = extractRepresentative(
	`{"@type":"MedicalClinic","physician":{"@type":"Physician","name":"최원장","jobTitle":"대표원장"}}`,
);
assert('physician JSON-LD name', physician.name === '최원장', physician.name);
assert('physician JSON-LD title', physician.jobTitle === '대표원장', physician.jobTitle);

const noRepFromPhoneLabel = extractRepresentative('대표번호 : 02-1234-5678 상담전화 02-000-0000');
assert('대표번호 is not a person name', noRepFromPhoneLabel.isExtracted === false, noRepFromPhoneLabel.name);

const diagnostic = extractSiteDiagnostic(KOREAIONLAB_FOOTER_HTML, {
	url: 'https://koreaionlab.co.kr/',
	lang: 'ko',
});
assert('diagnostic brand', /중입자/.test(diagnostic.brandName), diagnostic.brandName);
assert('diagnostic telephone', diagnostic.telephone === '02-1234-5678', diagnostic.telephone);
assert('diagnostic address not empty', Boolean(diagnostic.address) && diagnostic.address !== '미기재', diagnostic.address);
assert('diagnostic representative', diagnostic.representativeName === '김중입', diagnostic.representativeName);
assert('diagnostic services', diagnostic.services.length >= 1, String(diagnostic.services));

const md = generateLlmsTxt(diagnostic);
assert('llms heading', md.startsWith('# '));
assert('llms renders telephone', md.includes('02-1234-5678'), md);
assert('llms renders address not 미기재', /address: .*(서초|서울)/.test(md) && !md.includes('address: 미기재'), md);
assert('llms renders representative', md.includes('김중입') && !md.includes('미등록'), md);
assert('llms has NAP section', md.includes('## NAP') && md.includes('## 서비스'));

const empty: SiteDiagnosticResult = {
	brandName: '빈사이트',
	description: '설명',
	industry: '병의원',
	schemaType: 'MedicalClinic',
	representativeTitle: '대표자',
	representativeName: '',
	services: ['상담'],
	address: '',
	telephone: '',
	url: 'https://empty.example',
	faqs: [{ question: 'Q1', answer: 'A1' }],
	lang: 'ko',
};
const emptyMd = generateLlmsTxt(empty);
assert('empty telephone fallback 미기재', emptyMd.includes('telephone: 미기재'), emptyMd);
assert('empty address fallback 미기재', emptyMd.includes('address: 미기재'), emptyMd);
assert('empty representative fallback 미등록', emptyMd.includes('name: 미등록'), emptyMd);

const reportNap = napFromAuditReport({
	url: 'https://koreaionlab.co.kr/',
	siteMeta: {
		domain: 'koreaionlab.co.kr',
		brandName: '한국중입자 암치료연구소',
		category: '중입자치료',
		primaryKeyword: '중입자치료',
		industryType: 'MEDICAL',
		location: '서울',
		broadLocation: '서울',
		vertical: 'medical',
		targetUrl: 'https://koreaionlab.co.kr/',
		telephone: '02-1234-5678',
		address: '서울특별시 서초구 서초대로 77길 55, 3층',
		representativeName: '김중입',
	},
	footerText:
		'상호 : 한국중입자 암치료연구소 대표자 : 김중입 주소 : 서울특별시 서초구 서초대로 77길 55, 3층 대표번호 : 02-1234-5678',
	categories: [],
	findings: [],
} as AuditReport);
assert('audit NAP telephone from siteMeta', reportNap.telephone === '02-1234-5678', reportNap.telephone);
assert('audit NAP address from siteMeta', /서초/.test(reportNap.address || ''), reportNap.address);

const footerFallbackNap = napFromAuditReport({
	url: 'https://koreaionlab.co.kr/',
	siteMeta: {
		domain: 'koreaionlab.co.kr',
		brandName: '한국중입자 암치료연구소',
		category: '중입자치료',
		primaryKeyword: '중입자치료',
		industryType: 'MEDICAL',
		location: '서울',
		broadLocation: '서울',
		vertical: 'medical',
		targetUrl: 'https://koreaionlab.co.kr/',
	},
	footerText:
		'상호: 한국중입자 암치료연구소 | 전화: 02-1111-2222 | 주소: 서울시 서초구 서초대로 10',
	categories: [],
	findings: [],
} as AuditReport);
assert('audit NAP telephone from footerText', footerFallbackNap.telephone === '02-1111-2222', footerFallbackNap.telephone);
assert('audit NAP address from footerText', /서초/.test(footerFallbackNap.address || ''), footerFallbackNap.address);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall llms.txt generator assertions passed');
