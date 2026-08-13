import {
	evaluateLocation,
	extractAddressesFromHtml,
	targetRegionFromKeyword,
} from '../lib/crawling/location-filter';
import { findLocationPageUrls } from '../lib/crawling/contact-info';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const seoulFooter = `
<html>
<body>
  <h1>전국 부산 판매 전문 업체</h1>
  <p>부산, 대구, 광주 어디든 배송합니다. 부산 당일배송 가능.</p>
  <footer>
    <p>주소: 서울특별시 강남구 테헤란로 123, 10층</p>
    <p>TEL: 02-1234-5678</p>
  </footer>
</body>
</html>
`;

const busanJsonLd = `
<html>
<head>
<script type="application/ld+json">
{"@type":"Organization","name":"해운대클리닉","address":{"@type":"PostalAddress","addressRegion":"부산광역시","addressLocality":"해운대구","streetAddress":"센텀동로 99"}}
</script>
</head>
<body>
  <p>서울 고객도 환영합니다.</p>
  <footer>오시는 길: 부산광역시 해운대구 센텀동로 99</footer>
</body>
</html>
`;

const noAddress = `
<html>
<body>
  <h1>부산 판매 1위 쇼핑몰</h1>
  <p>부산 전역 무료배송. 서울 본사에서 운영합니다만 주소는 공개하지 않습니다.</p>
</body>
</html>
`;

const seoulAddresses = extractAddressesFromHtml(seoulFooter);
assert(
	seoulAddresses.some((a) => a.includes('서울')),
	`seoul footer address missed: ${seoulAddresses.join(' | ')}`,
);
assert(
	!seoulAddresses.some((a) => a.includes('부산')),
	`body '부산 판매' leaked into address: ${seoulAddresses.join(' | ')}`,
);

const seoulEval = evaluateLocation(seoulAddresses, '부산');
assert(seoulEval.verdict === 'out_of_region', `seoul HQ should skip, got=${seoulEval.verdict}`);
assert(!seoulEval.checkLocationNeeded, 'out_of_region must not set check_location_needed');

const busanAddresses = extractAddressesFromHtml(busanJsonLd);
assert(
	busanAddresses.some((a) => a.includes('부산')),
	`busan json-ld missed: ${busanAddresses.join(' | ')}`,
);
const busanEval = evaluateLocation(busanAddresses, '부산');
assert(busanEval.verdict === 'in_region', `busan address should keep, got=${busanEval.verdict}`);

const unknownEval = evaluateLocation(extractAddressesFromHtml(noAddress), '부산');
assert(unknownEval.verdict === 'unknown', `unparsed should be unknown, got=${unknownEval.verdict}`);
assert(unknownEval.checkLocationNeeded, 'unparsed address must set check_location_needed');

assert(targetRegionFromKeyword('부산 판매') === '부산', 'keyword metro parse failed');
assert(targetRegionFromKeyword('부산광역시 사하구 치과') === '부산', '부산광역시 prefix failed');
assert(targetRegionFromKeyword('서울 강남 피부과') === '서울', 'seoul keyword failed');
assert(targetRegionFromKeyword('판매') === null, 'no-metro keyword should skip filter');

const both = evaluateLocation(
	['서울특별시 강남구 테헤란로 1', '부산광역시 해운대구 우동'],
	'부산',
);
assert(both.verdict === 'in_region', 'branch in Busan should keep even with Seoul HQ');

const locationHome = `
<footer>
  <a href="/about">회사소개</a>
  <a href="/contact">contact</a>
</footer>
`;
const locUrls = findLocationPageUrls(locationHome, 'https://shop.example.co.kr/');
assert(
	locUrls.some((u) => u.includes('/about')),
	`about link missed: ${locUrls.join(',')}`,
);
assert(
	locUrls.some((u) => u.includes('/contact')),
	`contact link missed: ${locUrls.join(',')}`,
);

console.log('location-filter tests passed');
