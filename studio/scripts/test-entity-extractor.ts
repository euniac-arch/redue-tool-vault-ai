/**
 * Person representative name + jobTitle extractor.
 * Run: npx tsx scripts/test-entity-extractor.ts
 */
import {
	extractRepresentative,
	formatRepresentativeLabel,
	formatRepresentativeParen,
	isNoiseRepresentativeName,
	resolveEngineRepresentative,
} from '../lib/audit/extractors/entity';
import {
	detectPersonKnowledgeGraph,
	extractPlaceIdentity,
	extractTaxIdPrecise,
	parseUniversalEntity,
} from '../lib/audit/extractors/universal-entity';
import { collectGreetingCandidateUrls, isGreetingPagePath } from '../lib/audit/extractors/representative-pages';
import { buildEeatAuditData } from '../lib/audit/eeat-audit';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const colon = extractRepresentative('사업자등록번호 120-81-47521 대표 : 홍길동 전화 02-000-0000');
assert('대표 : 홍길동 name', colon.name === '홍길동', colon.name);
assert('대표 : 홍길동 title', colon.jobTitle === '대표', colon.jobTitle);
assert('대표 : 홍길동 extracted', colon.isExtracted === true);

const labeled = extractRepresentative('대표자: 김민수');
assert('대표자: 김민수 name', labeled.name === '김민수', labeled.name);
assert('대표자 title', labeled.jobTitle === '대표자', labeled.jobTitle);

const director = extractRepresentative('푸터 대표이사 이영희 주소 서울');
assert('대표이사 이영희 name', director.name === '이영희', director.name);
assert('대표이사 title is not 이사', director.jobTitle === '대표이사', director.jobTitle);

const ceo = extractRepresentative('CEO John Doe | All Rights Reserved');
assert('CEO John Doe name', ceo.name === 'John Doe', ceo.name);
assert('CEO title', ceo.jobTitle === 'CEO', ceo.jobTitle);

const directorKo = extractRepresentative('의료진 소개 원장 박서준');
assert('원장 박서준 name', directorKo.name === '박서준', directorKo.name);
assert('원장 title', directorKo.jobTitle === '원장', directorKo.jobTitle);

const jsonLd = extractRepresentative(
	`{"@context":"https://schema.org","@type":"Person","name":"최수아","jobTitle":"대표변호사"}`,
);
assert('JSON-LD Person name', jsonLd.name === '최수아', jsonLd.name);
assert('JSON-LD Person jobTitle', jsonLd.jobTitle === '대표변호사', jsonLd.jobTitle);

const founder = extractRepresentative(
	`{"@type":"MedicalClinic","founder":{"@type":"Person","name":"김중입"}}`,
);
assert('JSON-LD founder name', founder.name === '김중입', founder.name);
assert('JSON-LD founder extracted', founder.isExtracted === true);

const phoneLabel = extractRepresentative('푸터 대표번호 : 02-1234-5678 상담전화 010-000-0000');
assert('대표번호 is not captured as a person', phoneLabel.isExtracted === false, phoneLabel.name);

const missing = extractRepresentative('상호: 레드유 주식회사 사업자등록번호 120-81-47521');
assert('missing name fallback', missing.name === '미검출 (수동 입력 필요)', missing.name);
assert('missing isExtracted false', missing.isExtracted === false);

const enMissing = extractRepresentative('Company Inc. All rights reserved', 'en');
assert('en missing fallback', enMissing.name === 'Not detected (manual input required)', enMissing.name);

assert(
	'display formats name + title',
	formatRepresentativeLabel('홍길동', '대표') === '홍길동 대표',
);
assert(
	'display keeps fallback name',
	formatRepresentativeLabel(undefined, '대표원장') === '미검출 (수동 입력 필요) 대표원장',
);

const eeat = buildEeatAuditData({
	lang: 'ko',
	specialties: ['웹개발'],
	broadLocation: '서울',
	industryType: 'B2B_MFG',
	footerText: '대표 : 홍길동 사업자등록번호 120-81-47521',
	orgPresent: false,
	orgComplete: false,
});
assert('eeat personName from footer', eeat.data.personName === '홍길동', eeat.data.personName);
assert('eeat personJobTitle from footer', eeat.data.personJobTitle === '대표', eeat.data.personJobTitle);

assert('stopword 제품으로 is noise', isNoiseRepresentativeName('제품으로') === true);
assert('stopword 진료 is noise', isNoiseRepresentativeName('진료') === true);
assert('stopword 정보 is noise', isNoiseRepresentativeName('정보') === true);
const productFalse = extractRepresentative('본문 대표 제품으로 만든 패키지 안내 문의');
assert('대표 제품으로 is not a person', productFalse.isExtracted === false, productFalse.name);
assert('paren display 배우리 (대표원장)', formatRepresentativeParen('배우리', '대표원장') === '배우리 (대표원장)');

const schemaWins = extractRepresentative(`
  <footer>대표 제품으로 상담 안내</footer>
  <script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'Person',
		name: '배우리',
		jobTitle: '대표원장',
		worksFor: { '@id': 'https://clinic.example/#org' },
	})}</script>
`);
assert('JSON-LD Person wins over footer 제품으로', schemaWins.name === '배우리', schemaWins.name);
assert('JSON-LD Person jobTitle 대표원장', schemaWins.jobTitle === '대표원장', schemaWins.jobTitle);

const taxFromSchema = extractTaxIdPrecise(
	JSON.stringify({ '@type': 'MedicalClinic', taxID: '1208147521', vatID: '' }),
);
assert('schema taxID 10-digit normalized', taxFromSchema === '120-81-47521', taxFromSchema);
assert(
	'DOM 사업자 등록 번호 spaced',
	extractTaxIdPrecise('사업자 등록 번호 : 120-81-47521') === '120-81-47521',
);

const placeHtml = `
  <a href="https://map.naver.com/p/entry/place/123456789012345">네이버</a>
  <a href="https://place.map.kakao.com/987654321">카카오</a>
  <a href="https://maps.google.com/?cid=111222333444">구글</a>
`;
const place = extractPlaceIdentity(placeHtml);
assert('place CID from naver map link', place.cid === '123456789012345', place.cid);
assert('place urls include kakao', place.urls.some((u) => /place\.map\.kakao\.com/.test(u)));
assert('place urls include google', place.urls.some((u) => /maps\.google\.com/.test(u)));

const kgHtml = JSON.stringify({
	'@context': 'https://schema.org',
	'@graph': [
		{
			'@type': 'Person',
			'@id': 'https://clinic.example/#person',
			name: '배우리',
			jobTitle: '대표원장',
			worksFor: { '@id': 'https://clinic.example/#org' },
		},
		{
			'@type': 'MedicalClinic',
			'@id': 'https://clinic.example/#org',
			name: '테스트의원',
			founder: { '@id': 'https://clinic.example/#person' },
		},
	],
});
const kg = detectPersonKnowledgeGraph(kgHtml);
assert('Person KG bidirectional @id linked', kg.linked === true);
assert('Person KG name 배우리', kg.personName === '배우리', kg.personName);

const jobTitleOnly = detectPersonKnowledgeGraph(
	JSON.stringify({ '@type': 'Person', name: '배우리', jobTitle: '대표원장' }),
);
assert('jobTitle-only Person is not linked KG', jobTitleOnly.linked === false);

const pack = parseUniversalEntity(`
  <script type="application/ld+json">${kgHtml}</script>
  <footer>사업자등록번호 120-81-47521 대표원장 : 가짜이름</footer>
  <a href="https://blog.naver.com/clinic">blog</a>
  <a href="https://place.naver.com/hospital/123456789012345">place</a>
`);
assert('pack representative from Person schema', pack.representative.name === '배우리', pack.representative.name);
assert('pack taxID from footer/schema', pack.taxId === '120-81-47521', pack.taxId);
assert('pack sameAs >= 2', pack.sameAs.length >= 2, String(pack.sameAs.length));
assert('pack schema sameAs matches pack.sameAs', pack.schema.sameAs.count === pack.sameAs.length, `${pack.schema.sameAs.count} vs ${pack.sameAs.length}`);
assert('pack personKg linked', pack.personKg.linked === true);

const snsOnlyPack = parseUniversalEntity(
	['https://www.instagram.com/clinic', 'https://blog.naver.com/clinic', 'https://www.facebook.com/clinic', 'https://www.youtube.com/@clinic', 'https://pf.kakao.com/_clinic'].join('\n'),
);
assert('SNS-only pack count is 5', snsOnlyPack.sameAs.length === 5, String(snsOnlyPack.sameAs.length));
assert('SNS-only schema count is 5', snsOnlyPack.schema.sameAs.count === 5, String(snsOnlyPack.schema.sameAs.count));
assert('SNS-only schema is complete', snsOnlyPack.schema.sameAs.complete === true);
assert('SNS-only has no place', snsOnlyPack.schema.sameAs.placeCount === 0, String(snsOnlyPack.schema.sameAs.placeCount));

assert('stopword 병원 is noise', isNoiseRepresentativeName('병원') === true);
assert('stopword 연구소 is noise', isNoiseRepresentativeName('연구소') === true);
assert('stopword 센터 is noise', isNoiseRepresentativeName('센터') === true);
assert('stopword 안내 is noise', isNoiseRepresentativeName('안내') === true);
assert('stopword 소개 is noise', isNoiseRepresentativeName('소개') === true);
assert('real name is not noise', isNoiseRepresentativeName('김중입') === false);

const stopwordHit = extractRepresentative('상호: 한국중입자 | 대표자: 연구소 | 전화 02-000-0000');
assert('stopword 연구소 not extracted as name', stopwordHit.isExtracted === false, stopwordHit.name);

const labeledPipe = extractRepresentative('대표원장 | 이서준 서울특별시 서초구');
assert('user regex 대표원장 | 이서준', labeledPipe.isExtracted && labeledPipe.name === '이서준', labeledPipe.name);
assert('user regex title 대표원장', labeledPipe.jobTitle === '대표원장', labeledPipe.jobTitle);

const resolvedEmpty = resolveEngineRepresentative({ industryType: 'MEDICAL' });
assert('empty detect keeps blank name', resolvedEmpty.name === '' && resolvedEmpty.isExtracted === false, resolvedEmpty.name);
assert('no invented title without name', resolvedEmpty.jobTitle === '', resolvedEmpty.jobTitle);

const resolvedAdmin = resolveEngineRepresentative({
	adminName: '박서준',
	adminTitle: '대표원장',
	htmlCorpus: '대표자: 김민수',
	industryType: 'MEDICAL',
});
assert('admin override wins over footer', resolvedAdmin.name === '박서준', resolvedAdmin.name);
assert('admin title wins', resolvedAdmin.jobTitle === '대표원장', resolvedAdmin.jobTitle);

assert('102.php is greeting', isGreetingPagePath('/102.php') === true);
assert('about is greeting', isGreetingPagePath('/about') === true);
assert('ceo_message is greeting', isGreetingPagePath('/ceo_message.php') === true);
assert('index is not greeting', isGreetingPagePath('/index.php') === false);
const greetingUrls = collectGreetingCandidateUrls({
	origin: 'https://clinic.example.com',
	collectedUrls: ['/board.php?bo_table=notice', '/102.php'],
	navItems: [{ name: '인사말', url: '/about.php' }],
});
assert('greeting urls include 102.php', greetingUrls.some((u) => /102\.php/.test(u)));
assert('greeting urls include about from nav', greetingUrls.some((u) => /about\.php/.test(u)));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall entity extractor assertions passed');
