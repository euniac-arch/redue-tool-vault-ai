/**
 * 4-step CEO name sequential search (footer → greeting/img → doctor/img → fallback).
 * Run: npx tsx scripts/test-ceo-name.ts
 */
import {
	DEFAULT_CEO_NAME_FALLBACK,
	bindCeoName,
	extractCeoFromDoctorHtml,
	extractCeoNameFromImageRefs,
	isValidKoreanCeoName,
	resolveCeoNameSequential,
} from '../lib/audit/extractors/ceo-name';
import {
	collectDoctorCandidateUrls,
	collectGreetingCandidateUrls,
	isDoctorTeamPage,
	isGreetingCeoPage,
	isGreetingPagePath,
} from '../lib/audit/extractors/representative-pages';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const footerHtml = `
<html><body>
  <header>본문에는 의료진 김가짜</header>
  <footer class="ft_info">상호: 테스트의원 | 대표자 : 홍길동 | 전화 02-000-0000</footer>
</body></html>`;

const footerHit = resolveCeoNameSequential({
	html: footerHtml,
	greetingHtml: '<div>대표원장 이영희 배상</div>',
	doctorHtml: '<div class="doctor-list"><div><h3>박서준</h3><p>대표원장</p></div></div>',
});
assert('step1 footer wins', footerHit.source === 'footer' && footerHit.name === '홍길동', `${footerHit.source}:${footerHit.name}`);
assert('step1 extracted', footerHit.isExtracted === true);

const copyrightHit = resolveCeoNameSequential({
	html: `<div class="copyright">원장 : 최수아 All Rights Reserved</div>`,
});
assert('step1 .copyright', copyrightHit.name === '최수아', copyrightHit.name);

const greetingOnly = resolveCeoNameSequential({
	html: '<html><body><p>환영합니다</p></body></html>',
	greetingPages: [
		{
			url: '/ceo_message.php',
			title: '인사말',
			html: '<div class="sign">대표원장 이영희 배상</div>',
		},
	],
});
assert('step2 greeting signature', greetingOnly.source === 'greeting' && greetingOnly.name === '이영희', `${greetingOnly.source}:${greetingOnly.name}`);

const encoded = encodeURIComponent('김중입');
const greetingImage = resolveCeoNameSequential({
	html: '<p>소개 페이지</p>',
	greetingPages: [
		{
			url: '/about.php',
			title: '병원소개',
			html: `<div class="ceo-sign" style="background-image:url('/img/${encoded}.png')"></div>`,
		},
	],
});
assert('step2 greeting bg image decode', greetingImage.name === '김중입', greetingImage.name);
assert(
	'image helper decodes hangul filename',
	extractCeoNameFromImageRefs(`style="background-image:url('/img/${encoded}.png')"`) === '김중입',
);

const greetingImgAlt = resolveCeoNameSequential({
	html: '<p>소개 페이지</p>',
	greetingPages: [
		{
			url: '/ceo_message.php',
			title: '인사말',
			html: `<img src="/sign.png" alt="연대영 대표원장">`,
		},
	],
});
assert(
	'step2 img alt 1순위',
	greetingImgAlt.source === 'greeting' && greetingImgAlt.name === '연대영',
	`${greetingImgAlt.source}:${greetingImgAlt.name}`,
);
assert('step2 img alt title', greetingImgAlt.jobTitle === '대표원장', greetingImgAlt.jobTitle);

const greetingSignSrc = resolveCeoNameSequential({
	html: '<p>소개</p>',
	greetingPages: [
		{
			url: '/about.php',
			title: '병원소개',
			html: `<img src="/img/sign_${encodeURIComponent('최수아')}.png" alt="">`,
		},
	],
});
assert('step2 sign_ filename', greetingSignSrc.name === '최수아', greetingSignSrc.name);

const doctorOnly = resolveCeoNameSequential({
	html: '<p>홈</p>',
	doctorPages: [
		{
			url: '/doctor.php',
			title: '의료진 소개',
			html: `
        <div class="doctor-list">
          <div class="doctor_card"><h3>박서준</h3><strong>대표원장</strong></div>
          <div class="doctor_card"><h3>이민호</h3><span>원장</span></div>
        </div>`,
		},
	],
});
assert('step3 first doctor card', doctorOnly.source === 'doctor' && doctorOnly.name === '박서준', `${doctorOnly.source}:${doctorOnly.name}`);

const doctorNameClass = extractCeoFromDoctorHtml(`
  <div class="doctor-list">
    <div class="doctor-card"><span class="doctor-name">정수현</span><p>수의사</p></div>
  </div>
`);
assert('step3 .doctor-name + 수의사', doctorNameClass?.name === '정수현', doctorNameClass?.name);

const doctorImgAlt = extractCeoFromDoctorHtml(`
  <div class="doctor-list">
    <div class="doctor-card"><img alt="정수현 대표원장" src="/staff1.jpg"></div>
  </div>
`);
assert('step3 first card img alt', doctorImgAlt?.name === '정수현', doctorImgAlt?.name);
assert('step3 first card img title', doctorImgAlt?.jobTitle === '대표원장', doctorImgAlt?.jobTitle);

const fallback = resolveCeoNameSequential({
	html: '<html><body><p>상호만 있는 사이트</p></body></html>',
});
assert('step4 fallback name', fallback.name === DEFAULT_CEO_NAME_FALLBACK, fallback.name);
assert('step4 fallback source', fallback.source === 'fallback' && fallback.isExtracted === false);

assert('bind empty → 대표원장', bindCeoName('') === '대표원장');
assert('bind keeps 홍길동', bindCeoName('홍길동') === '홍길동');
assert('valid korean name', isValidKoreanCeoName('홍길동') === true);
assert('title is not a person name', isValidKoreanCeoName('대표원장') === false);
assert('제품으로 is not a person name', isValidKoreanCeoName('제품으로') === false);

const productFooter = resolveCeoNameSequential({
	html: `<html><body><footer>상호: 테스트 | 대표 제품으로 만든 안내 | 전화 02-000-0000</footer></body></html>`,
});
assert(
	'footer 대표 제품으로 rejected',
	productFooter.name !== '제품으로' && (productFooter.source === 'fallback' || productFooter.isExtracted === false),
	`${productFooter.source}:${productFooter.name}`,
);

const schemaCeo = resolveCeoNameSequential({
	html: `<html><body>
    <footer>대표 제품으로 상담 안내</footer>
    <script type="application/ld+json">${JSON.stringify({
			'@type': 'Person',
			name: '배우리',
			jobTitle: '대표원장',
		})}</script>
  </body></html>`,
});
assert('schema Person is 1st priority', schemaCeo.source === 'schema' && schemaCeo.name === '배우리', `${schemaCeo.source}:${schemaCeo.name}`);
assert('schema Person title', schemaCeo.jobTitle === '대표원장', schemaCeo.jobTitle);

assert('ceo_message is greeting', isGreetingPagePath('/ceo_message.php') === true);
assert('about title greeting', isGreetingCeoPage('/intro.php', '병원소개') === true);
assert('index is not greeting', isGreetingCeoPage('/index.php', '메인') === false);
assert('doctor.php is doctor', isDoctorTeamPage('/doctor.php', '의료진') === true);
assert('원장인사말 is greeting not doctor', isGreetingCeoPage('/greeting.php', '원장인사말') === true);
assert('원장인사말 not doctor', isDoctorTeamPage('/greeting.php', '원장인사말') === false);

const greetUrls = collectGreetingCandidateUrls({
	origin: 'https://clinic.example.com',
	collectedUrls: ['/board.php?bo_table=notice', '/ceo_message.php'],
	navItems: [{ name: '인사말', url: '/about.php' }],
});
assert('collect ceo_message', greetUrls.some((u) => /ceo_message\.php/.test(u)));

const doctorUrls = collectDoctorCandidateUrls({
	origin: 'https://clinic.example.com',
	collectedUrls: ['/internal.php', '/doctor.php'],
	navItems: [{ name: '의료진', url: '/team.php' }],
});
assert('collect doctor.php', doctorUrls.some((u) => /doctor\.php/.test(u)));
assert('collect team from nav', doctorUrls.some((u) => /team\.php/.test(u)));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall ceo-name assertions passed');
