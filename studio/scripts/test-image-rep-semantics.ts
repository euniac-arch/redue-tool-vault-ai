/**
 * Shared image alt/title/filename representative semantics.
 * Run: npx tsx scripts/test-image-rep-semantics.ts
 */
import {
	IMG_ALT_NAME_THEN_TITLE_RE,
	IMG_ALT_TITLE_THEN_NAME_RE,
	IMG_FILENAME_REP_RE,
	IMG_FILENAME_REP_SOURCE,
	buildImageRepSemanticsPhp,
	composeRepImageAlt,
	extractImageRepFromFilename,
	extractImageRepFromHtml,
	extractImageRepFromText,
	extractNearbyImageRep,
	isValidImgRepName,
	suggestRepImageAlt,
} from '../lib/audit/extractors/image-rep-semantics';
import {
	extractCeoNameFromImageRefs,
	resolveCeoNameSequential,
} from '../lib/audit/extractors/ceo-name';
import { buildUniversalSeoRuntimeHelpersPhp } from '../lib/solve/dynamic-php-schema';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const titleThen = '대표원장 연대영'.match(IMG_ALT_TITLE_THEN_NAME_RE);
assert('title→name regex', titleThen?.[1] === '연대영', titleThen?.[1]);

const nameThen = '연대영 대표원장'.match(IMG_ALT_NAME_THEN_TITLE_RE);
assert('name→title regex', nameThen?.[1] === '연대영', nameThen?.[1]);

const signFile = 'sign_연대영.png'.match(IMG_FILENAME_REP_RE);
assert('sign_한글 filename', signFile?.[1] === '연대영', signFile?.[1]);

assert('ceo_park filename prefix matches', IMG_FILENAME_REP_RE.test('ceo_park.jpg'));
assert('director prefix matches', IMG_FILENAME_REP_RE.test('director-김철수.webp'));

const fromAlt = extractImageRepFromText('연대영 대표원장');
assert('alt text name', fromAlt?.name === '연대영', fromAlt?.name);
assert('alt text title', fromAlt?.jobTitle === '대표원장', fromAlt?.jobTitle);

const fromTitleFirst = extractImageRepFromText('대표이사 박지성');
assert('title-first name', fromTitleFirst?.name === '박지성', fromTitleFirst?.name);
assert('title-first job', fromTitleFirst?.jobTitle === '대표이사', fromTitleFirst?.jobTitle);

assert('noise 원장 사진 rejected', extractImageRepFromText('원장 사진') === null);
assert('noise 대표 이미지 rejected', extractImageRepFromText('대표 이미지') === null);
assert('valid name', isValidImgRepName('연대영') === true);
assert('title is not a name', isValidImgRepName('대표원장') === false);

const fromSignFile = extractImageRepFromFilename('/img/sign_연대영.png');
assert('filename sign_한글', fromSignFile?.name === '연대영' && fromSignFile.source === 'img-filename', fromSignFile?.name);

const encoded = encodeURIComponent('김중입');
assert(
	'encoded hangul filename',
	extractImageRepFromFilename(`/img/${encoded}.png`)?.name === '김중입',
);

const htmlAlt = `<div class="ceo"><img src="/photo.jpg" alt="연대영 대표원장"></div>`;
const htmlAltHit = extractImageRepFromHtml(htmlAlt);
assert('html img alt is 1순위', htmlAltHit?.name === '연대영' && htmlAltHit.source === 'img-alt', `${htmlAltHit?.source}:${htmlAltHit?.name}`);
assert('html img alt title', htmlAltHit?.jobTitle === '대표원장', htmlAltHit?.jobTitle);

const htmlFile = `<img src="/uploads/sign_최수아.png" alt="">`;
const htmlFileHit = extractImageRepFromHtml(htmlFile);
assert('html empty alt falls to filename', htmlFileHit?.name === '최수아', htmlFileHit?.name);

const nearby = extractNearbyImageRep('<section><h3>연대영 대표원장</h3><img src="/a.jpg"></section>', 40);
assert('nearby h3 name', nearby?.name === '연대영', nearby?.name);
assert('nearby h3 title', nearby?.jobTitle === '대표원장', nearby?.jobTitle);

assert(
	'compose site+name+title',
	composeRepImageAlt('마음반려동물의료원', '연대영', '대표원장') === '마음반려동물의료원 연대영 대표원장',
);

assert(
	'suggest nearby alt',
	suggestRepImageAlt({
		siteName: '마음반려동물의료원',
		nearbyHtml: '<h3>연대영 대표원장</h3>',
	}) === '마음반려동물의료원 연대영 대표원장',
);

assert(
	'suggest keeps existing alt',
	suggestRepImageAlt({
		siteName: '마음반려동물의료원',
		existingAlt: '연대영 대표원장',
		nearbyHtml: '<h3>다른이름 원장</h3>',
	}) === '연대영 대표원장',
);

const greetingAlt = resolveCeoNameSequential({
	html: '<p>홈</p>',
	greetingPages: [
		{
			url: '/ceo_message.php',
			title: '인사말',
			html: `<div class="sign"><img src="/sign.png" alt="연대영 대표원장"></div>`,
		},
	],
});
assert(
	'step2 img alt binds ceo_name',
	greetingAlt.source === 'greeting' && greetingAlt.name === '연대영',
	`${greetingAlt.source}:${greetingAlt.name}`,
);
assert('step2 img alt binds rep_title', greetingAlt.jobTitle === '대표원장', greetingAlt.jobTitle);

const greetingSignFile = resolveCeoNameSequential({
	html: '<p>홈</p>',
	greetingPages: [
		{
			url: '/about.php',
			title: '병원소개',
			html: `<p>인사드립니다</p><img src="/img/sign_홍길동.png">`,
		},
	],
});
assert('step2 sign filename', greetingSignFile.name === '홍길동', greetingSignFile.name);

const doctorAlt = resolveCeoNameSequential({
	html: '<p>홈</p>',
	doctorPages: [
		{
			url: '/doctor.php',
			title: '의료진',
			html: `
        <div class="doctor-list">
          <div class="doctor_card"><img alt="박서준 대표원장" src="/d1.jpg"></div>
          <div class="doctor_card"><img alt="이민호 원장" src="/d2.jpg"></div>
        </div>`,
		},
	],
});
assert('step3 first card img alt', doctorAlt.source === 'doctor' && doctorAlt.name === '박서준', `${doctorAlt.source}:${doctorAlt.name}`);

assert(
	'image helper reads alt before filename',
	extractCeoNameFromImageRefs('<img src="/ceo_park.jpg" alt="이영희 대표">') === '이영희',
);

const php = buildImageRepSemanticsPhp();
assert('php parse text helper', php.includes('redue_parse_rep_from_text'));
assert('php filename helper', php.includes('redue_parse_rep_from_filename'));
assert('php nearby helper', php.includes('redue_extract_nearby_rep'));
assert('php compose helper', php.includes('redue_compose_rep_img_alt'));
assert('php img scan helper', php.includes('redue_extract_rep_from_imgs'));
assert('php bind globals', php.includes("GLOBALS['redue_rep_name']"));
assert('php filename prefix source', php.includes(IMG_FILENAME_REP_SOURCE) || php.includes('sign|ceo|director|rep'));
assert('php title-then-name source', php.includes('대표원장|원장|대표이사|대표|CEO|이사장'));

const helpers = buildUniversalSeoRuntimeHelpersPhp();
assert('helpers ship image-rep parser', helpers.includes('redue_parse_rep_from_text'));
assert('helpers nearby heading', helpers.includes('redue_extract_nearby_rep'));
assert('helpers compose site+name+title', helpers.includes('redue_compose_rep_img_alt'));
assert('helpers bind redue_rep_name', helpers.includes('redue_bind_rep_globals'));
assert('helpers still have logo alt', helpers.includes('로고'));
assert('helpers still have coded-filename alt', helpers.includes('안내 이미지'));
assert('transformer uses nearby context', helpers.includes('redue_extract_nearby_rep($buffer, $pos)'));
assert('transformer adopts existing alt', helpers.includes('redue_parse_rep_from_text($existing)'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall image-rep-semantics assertions passed');
