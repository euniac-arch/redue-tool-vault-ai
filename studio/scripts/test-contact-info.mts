import {
	extractEmailsFromHtml,
	extractPhoneNumbersFromHtml,
	extractSocialLinks,
	findContactPageUrls,
	htmlHasForm,
	isContactRelatedUrl,
	isPlausibleEmail,
	pickContactFormUrl,
} from '../lib/crawling/contact-info';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const homepage = `
<!doctype html>
<html>
<head><title>Clinic</title></head>
<body>
  <header>
    <nav id="gnb">
      <a href="/about">会社概要</a>
      <a href="/contact-us">お問い合わせ</a>
      <a href="https://other.example.net/contact">외부</a>
    </nav>
  </header>
  <p>Welcome. logo@2x.png is not an email.</p>
  <footer>
    <a href="mailto:info@clinic.example.co.jp">메일</a>
  </footer>
</body>
</html>
`;

const emails = extractEmailsFromHtml(homepage);
assert(emails[0] === 'info@clinic.example.co.jp', `first email got=${emails[0]}`);
assert(!emails.some((e) => e.includes('logo@2x')), 'image false-positive leaked');

assert(isPlausibleEmail('cs@hospital.co.kr'), 'valid email rejected');
assert(!isPlausibleEmail('image@2x.png'), 'png TLD accepted');
assert(!isPlausibleEmail('user@example.com'), 'placeholder domain accepted');

const noEmailHome = `
<html>
  <footer>
    <a href="/inquiry">inquiry</a>
    <a href="/company/about">about</a>
  </footer>
</html>
`;
const contactUrls = findContactPageUrls(noEmailHome, 'https://www.clinic.example.co.jp/');
assert(
	contactUrls.some((u) => u.includes('/inquiry')),
	`missing inquiry link: ${contactUrls.join(',')}`,
);
assert(
	contactUrls.some((u) => u.includes('/about')),
	`missing about link: ${contactUrls.join(',')}`,
);
assert(
	!contactUrls.some((u) => u.includes('other.example')),
	'cross-origin contact link leaked',
);

const contactPage = `
<html>
  <body>
    <h1>문의하기</h1>
    <form action="/send" method="post">
      <input name="name" />
      <textarea name="message"></textarea>
    </form>
  </body>
</html>
`;
assert(htmlHasForm(contactPage), 'form not detected');
assert(isContactRelatedUrl('https://clinic.example.co.jp/contact-us'), 'contact-us url missed');

const formUrl = pickContactFormUrl([
	{ url: 'https://clinic.example.co.jp/contact-us', html: contactPage, isContactPage: true },
]);
assert(formUrl === 'https://clinic.example.co.jp/contact-us', `form url got=${formUrl}`);

const koreanHome = `
<footer>
  <a href="/bbs/content.php?co_id=company">회사소개</a>
  <a href="mailto:hello@skin-clinic.co.kr?subject=문의">이메일</a>
</footer>
`;
const krEmails = extractEmailsFromHtml(koreanHome);
assert(krEmails[0] === 'hello@skin-clinic.co.kr', `mailto query stripped got=${krEmails[0]}`);
const krLinks = findContactPageUrls(koreanHome, 'https://skin-clinic.co.kr/');
assert(
	krLinks.some((u) => u.includes('co_id=company')),
	`KR about link missed: ${krLinks.join(',')}`,
);

const socialHome = `
<footer>
  <a href="https://pf.kakao.com/_abcClinic">카카오톡 채널</a>
  <a href="https://open.kakao.com/o/xyzOpen">오픈채팅</a>
  <a href="//www.instagram.com/clinic.official">Instagram</a>
  <a href="https://talk.naver.com/wc/abc123">네이버 톡톡</a>
  <a href="tel:051-123-4567">전화</a>
  <p>TEL : 051-123-4567</p>
</footer>
`;
const social = extractSocialLinks(socialHome);
assert(
	social.kakaoChannelUrl === 'https://pf.kakao.com/_abcClinic',
	`kakao got=${social.kakaoChannelUrl}`,
);
assert(
	social.instagramUrl === 'https://www.instagram.com/clinic.official',
	`instagram got=${social.instagramUrl}`,
);
assert(
	social.naverTalkUrl === 'https://talk.naver.com/wc/abc123',
	`naver talk got=${social.naverTalkUrl}`,
);

const openChatOnly = extractSocialLinks(
	'<a href="https://open.kakao.com/o/xyzOpen">오픈채팅</a>',
);
assert(
	openChatOnly.kakaoChannelUrl === 'https://open.kakao.com/o/xyzOpen',
	`open chat got=${openChatOnly.kakaoChannelUrl}`,
);

const phones = extractPhoneNumbersFromHtml(socialHome);
assert(phones[0] === '051-123-4567', `phone got=${phones[0]}`);

const noSocial = extractSocialLinks('<footer><a href="/about">about</a></footer>');
assert(!noSocial.kakaoChannelUrl && !noSocial.instagramUrl && !noSocial.naverTalkUrl, 'false social match');

console.log('contact-info parser tests passed');
