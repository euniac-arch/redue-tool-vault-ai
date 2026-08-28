/**
 * Official llms.txt / llms-full.txt refinement — no Class( dumps, no GNB chrome titles,
 * no virtual FAQ, no UI chrome in descriptions.
 * Run: npx tsx scripts/test-llms-content-engine.ts
 */
import { generateLlmsTxt } from '../lib/audit/llms-txt';
import { buildGnuboardAutomatedRuntimeEnginePhp } from '../lib/solve/dynamic-php-schema';
import { buildGeoRootAssetPack, buildSolveLlmsFullMarkdown } from '../lib/solve/geo-root-assets';
import {
	buildOfficialLlmsFullTxt,
	buildOfficialLlmsTxt,
	cleanLlmsBodyText,
	extractKoreanStreetAddress,
	isLlmsChromeTitle,
	isLlmsInfoMenu,
	isLlmsServiceMenu,
	realLlmsFaqs,
	resolveLlmsPageTitle,
	toLlmsPlainString,
} from '../lib/solve/llms-content-engine';
import { buildRedueLlmsPhpEngine } from '../lib/solve/llms-php-engine';
import { buildSolveLlmsTxtMarkdown } from '../lib/solve/llms-txt-deploy';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('plain string keeps address', toLlmsPlainString('서울 강남구 테헤란로 1') === '서울 강남구 테헤란로 1');
assert('rejects object', toLlmsPlainString({ street: '테헤란로' } as unknown as string) === '');
assert('rejects array', toLlmsPlainString(['서울', '강남'] as unknown as string) === '');
assert('rejects Class(', toLlmsPlainString('Class(PostalAddress)') === '');
assert('rejects Array dump', toLlmsPlainString('Array ( [streetAddress] => 테헤란로 )') === '');
assert('rejects [object Object]', toLlmsPlainString('[object Object]') === '');
assert('rejects JSON-LD address dump', toLlmsPlainString('{"@type":"PostalAddress","addressCountry":"KR"}') === '');

const street = extractKoreanStreetAddress('푸터 주소 : 대구광역시 중구 동성로 1 3층 TEL 053-111-2222');
assert('regex address is a single string', street.includes('대구') && street.includes('동성로') && !/Class\(|Array|\{/.test(street), street);

assert('chrome brand+본점 rejected', isLlmsChromeTitle('대구메리어트호텔 본점', '대구메리어트호텔'));
assert('chrome logo rejected', isLlmsChromeTitle('대구메리어트호텔', '대구메리어트호텔'));
assert('real page title kept', !isLlmsChromeTitle('눈성형', '대구메리어트호텔'));

assert(
	'menu me_name wins',
	resolveLlmsPageTitle({
		menuName: '눈성형',
		heading: '대구메리어트호텔 본점',
		headTitle: '대구메리어트호텔 본점 | 대구메리어트호텔',
		fileStem: 's201.php',
		siteName: '대구메리어트호텔',
	}) === '눈성형',
);
assert(
	'sub_title / h2 wins over chrome head title',
	resolveLlmsPageTitle({
		menuName: '대구메리어트호텔 본점',
		heading: '병원소개',
		headTitle: '대구메리어트호텔',
		fileStem: 's101.php',
		siteName: '대구메리어트호텔',
	}) === '병원소개',
);
assert(
	'filename map s201',
	resolveLlmsPageTitle({
		headTitle: '대구메리어트호텔',
		fileStem: 's201',
		siteName: '대구메리어트호텔',
	}) === '눈성형',
);

const dirty =
	'로그인 회원가입 문의하기 진료시간 오시는길 + - Total 40건 1 페이지 게시판 검색 글쓴이 조회 날짜 본원 눈성형은 개인 맞춤으로 진행합니다. 상담 후 일정을 안내합니다.';
const cleaned = cleanLlmsBodyText(dirty, ['문의하기', '진료시간', '오시는길']);
assert('strips login/gnb/zoom/board chrome', !/로그인|회원가입|Total|페이지|글쓴이|조회/.test(cleaned), cleaned);
assert('keeps real sentences', /눈성형/.test(cleaned) && /맞춤/.test(cleaned), cleaned);

assert('info menu 병원소개', isLlmsInfoMenu('병원소개') && isLlmsInfoMenu('장비소개') && isLlmsInfoMenu('오시는길') && isLlmsInfoMenu('둘러보기'));
assert('service menu 눈성형', isLlmsServiceMenu('눈성형') && isLlmsServiceMenu('내과진료') && !isLlmsServiceMenu('병원소개'));

assert('virtual FAQ templates dropped', realLlmsFaqs([{ question: '병원소개는 어디서 받나요?', answer: '홈페이지에서 확인' }]).length === 0);
assert(
	'real FAQ kept',
	realLlmsFaqs([{ question: '주차는 가능한가요?', answer: '본관 지하 주차장을 이용하시면 됩니다.' }]).length === 1,
);

const md = buildOfficialLlmsTxt({
	siteName: '테스트의원',
	origin: 'https://clinic.example',
	industry: 'MEDICAL',
	representativeName: '홍길동',
	telephone: '02-1234-5678',
	address: '서울시 강남구 테헤란로 1',
	openingHours: '09:00–18:00',
	intro: '로그인 회원가입 강남 테스트의원에서 내과 진료를 합니다.',
	menus: [
		{ name: '병원소개', url: '/intro.php', description: '연혁과 진료 철학을 안내합니다.' },
		{ name: '내과진료', url: '/internal.php', description: '내과 맞춤 진료' },
		{ name: '대구메리어트호텔 본점', url: '/index.php', description: '로고' },
		{ name: '장비소개', url: '/equip.php' },
	],
	faqs: [],
});
assert('txt h1 brand', md.startsWith('# 테스트의원'));
assert('txt core section', md.includes('## 핵심 정보') && md.includes('대표자: 홍길동') && md.includes('02-1234-5678'));
assert('txt address plain', md.includes('테헤란로') && !/Class\(|Array \(/.test(md));
assert(
	'txt services exclude info',
	md.includes('- 내과진료') && !md.split('## 주요 안내 링크')[0].includes('- 병원소개'),
);
assert('txt info still linked', md.includes('[병원소개](https://clinic.example/intro.php)'));
assert('txt omits FAQ when empty', !md.includes('## FAQ'));
assert('txt no virtual template', !md.includes('병원소개는 어디서') && !md.includes('실비보험'));
assert('txt no chrome title', !md.includes('대구메리어트호텔 본점'));
assert('txt no login leftover', !md.includes('로그인') && !md.includes('회원가입'));

const full = buildOfficialLlmsFullTxt({
	siteName: '테스트의원',
	origin: 'https://clinic.example',
	industry: 'MEDICAL',
	representativeName: '홍길동',
	telephone: '02-1234-5678',
	address: '서울시 강남구 테헤란로 1',
	openingHours: '09:00–18:00',
	intro: '테스트의원 공식 안내입니다.',
	menus: [
		{ name: '병원소개', url: '/intro.php', description: '연혁과 진료 철학을 안내합니다.' },
		{ name: '내과진료', url: '/internal.php', description: '내과 맞춤 진료' },
	],
});
assert('full h1', full.includes('# 테스트의원 — 심층 인용 전문 (llms-full)'));
assert('full sections', full.includes('## 상세 소개 및 엔티티 개요') && full.includes('## 운영 정보') && full.includes('## 서비스 및 안내 상세'));
assert('full unique titles', full.includes('### 병원소개') && full.includes('### 내과진료'));
assert('full cleaned desc', full.includes('내과 맞춤 진료'));
assert('full menu tree', full.includes('## 사이트 전체 메뉴 구조'));
assert('full std files', full.includes('/llms.txt') && full.includes('/sitemap.xml') && full.includes('/robots.txt'));
assert('full omits FAQ', !full.includes('## FAQ'));
assert('full no invented 대표원장 fallback pair', !full.includes('대표원장) ('));

const solveMd = buildSolveLlmsTxtMarkdown({
	siteName: '테스트의원',
	targetUrl: 'https://clinic.example',
	industryType: 'MEDICAL',
	pages: [
		{ urlPath: '/', title: '병원소개' },
		{ urlPath: '/internal.php', title: '내과진료' },
		{ urlPath: '/llms.txt', title: 'llms.txt' },
	],
	navItems: [{ name: '외과진료', url: '/surgery.php' }],
	streetAddress: '서울시 강남구 테헤란로 1',
	representativeName: '홍길동',
});
assert('solve txt brand', solveMd.includes('# 테스트의원'));
assert('solve txt service', solveMd.includes('내과진료') && solveMd.includes('외과진료'));
assert('solve txt no self link', !solveMd.includes('/llms.txt)'));
assert('solve txt no invented FAQ', !solveMd.includes('## FAQ'));

const solveFull = buildSolveLlmsFullMarkdown({
	siteName: '테스트의원',
	targetUrl: 'https://clinic.example',
	industryType: 'MEDICAL',
	pages: [
		{ urlPath: '/', title: '메인', description: '공식 홈' },
		{ urlPath: '/internal.php', title: '내과진료', description: '내과 맞춤 진료' },
	],
	openingHoursOpens: '09:00',
	openingHoursCloses: '18:00',
	streetAddress: '서울시 강남구 테헤란로 1',
	representativeName: '홍길동',
});
assert('solve full title', solveFull.includes('llms-full'));
assert('solve full desc', solveFull.includes('내과 맞춤 진료'));
assert('solve full hours', solveFull.includes('09:00–18:00'));

const pack = buildGeoRootAssetPack({
	siteName: '테스트의원',
	targetUrl: 'https://clinic.example',
	pages: [
		{ urlPath: '/', title: '메인' },
		{ urlPath: '/intro.php', title: '병원소개' },
	],
});
assert('pack llms brand', pack.llmsTxt.includes('# 테스트의원'));
assert('pack llms-full heading', pack.llmsFullTxt.includes('심층 인용'));

const emptyFaqMd = generateLlmsTxt({
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
	faqs: [],
	lang: 'ko',
});
assert('diagnostic omits empty FAQ', !emptyFaqMd.includes('## FAQ'));

const php = buildRedueLlmsPhpEngine();
assert('php generate txt', php.includes('function redue_generate_llms_txt()'));
assert('php generate full', php.includes('function redue_generate_llms_full_txt()'));
assert('php is_string guard', php.includes('if ( ! is_string($value) ) { return \'\'; }'));
assert('php class dump reject', php.includes('Class\\s*\\(') || php.includes('Class\\s*\\\\('));
assert('php rejects leftover virtual FAQ questions', php.includes('어디서 받나요') && php.includes('redue_llms_collect_faqs'));
assert('php g5_menu me_name', php.includes('me_name') && php.includes('menu_table'));
assert('php file map s101', php.includes("'s101' => '병원소개'") && php.includes("'s201' => '눈성형'"));
assert('php omit FAQ unless real', php.includes("## FAQ") && php.includes('redue_llms_collect_faqs'));
assert('php boot serve/refresh', php.includes('redue_llms_boot') && php.includes('redue_llms_maybe_serve') && php.includes('redue_llms_refresh_root_files'));
assert('php boot gated on admin', /function redue_llms_boot\(\)[\s\S]*G5_IS_ADMIN/.test(php));
assert('php boot gated on POST', /function redue_llms_boot\(\)[\s\S]*REQUEST_METHOD/.test(php));
assert('php boot gated on llms route', /function redue_llms_boot\(\)[\s\S]*redue_llms/.test(php) && /llms\(-full\)\?\\.txt/.test(php));

const gnu = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '테스트의원',
	industryType: 'MEDICAL',
});
assert('engine ships llms builders', gnu.includes('function redue_generate_llms_txt()') && gnu.includes('function redue_generate_llms_full_txt()'));
assert('engine still one render wrapper ob_start', (gnu.match(/ob_start\(\);/g) || []).length === 1);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall llms content engine assertions passed');
