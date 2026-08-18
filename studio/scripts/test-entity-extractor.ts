/**
 * Person representative name + jobTitle extractor.
 * Run: npx tsx scripts/test-entity-extractor.ts
 */
import {
	extractRepresentative,
	formatRepresentativeLabel,
} from '../lib/audit/extractors/entity';
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

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall entity extractor assertions passed');
