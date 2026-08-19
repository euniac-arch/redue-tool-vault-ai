/**
 * Person representative name + jobTitle extractor.
 * Run: npx tsx scripts/test-entity-extractor.ts
 */
import {
	extractRepresentative,
	formatRepresentativeLabel,
	isNoiseRepresentativeName,
	resolveEngineRepresentative,
} from '../lib/audit/extractors/entity';
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
assert('medical default title 대표원장', resolvedEmpty.jobTitle === '대표원장', resolvedEmpty.jobTitle);

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
