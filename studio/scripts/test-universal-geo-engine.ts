/**
 * Universal GEO Engine — regex extraction + generated-JS sanity smoke tests.
 * Run: npx tsx scripts/test-universal-geo-engine.ts
 */
import {
	buildSaasSchemaInjectorSnippet,
	buildUniversalGeoEngineJs,
	classifyGeoLink,
	dedupeSameAs,
	extractGeoFax,
	extractGeoRepName,
	extractGeoStreetAddress,
	extractGeoTaxId,
	extractGeoTelephone,
	fallbackBreadcrumbItems,
	isHomePath,
	isMedicalOrgType,
	isSaasCmsType,
	normalizeCanonicalUrl,
	normalizeGeoServices,
} from '../lib/solve/universal-geo-engine';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const FOOTER = `
상호 : 서울내과의원 | 대표자 : 김원장
사업자등록번호 : 123-45-67890
주소 : 서울특별시 강남구 테헤란로 123 메디컬빌딩 5층
TEL : 02-555-1212 / FAX : 02-555-3434
`;

// --- taxID -------------------------------------------------------------
assert(extractGeoTaxId('사업자등록번호 : 123-45-67890') === '123-45-67890', 'taxId hyphenated labeled');
assert(extractGeoTaxId('사업자번호: 1234567890') === '1234567890', 'taxId 10-digit labeled');
assert(extractGeoTaxId('사업자 123-45-67890 대표 홍길동') === '123-45-67890', 'taxId bare 사업자 label');
assert(extractGeoTaxId('본문에 사업자 정보가 없습니다') === '', 'taxId no false positive');
assert(extractGeoTaxId(FOOTER) === '123-45-67890', 'taxId from footer sample');

// --- fax ----------------------------------------------------------------
assert(extractGeoFax('FAX : 02-555-3434') === '02-555-3434', 'fax FAX labeled');
assert(extractGeoFax('팩스: 031-123-4567') === '031-123-4567', 'fax 팩스 labeled');
assert(extractGeoFax('F. 02-111-2222') === '02-111-2222', 'fax F. labeled');
assert(extractGeoFax(FOOTER) === '02-555-3434', 'fax from footer sample');
assert(extractGeoFax('전화번호만 있는 본문 02-555-1212') === '', 'fax no false positive on tel');

// --- street -------------------------------------------------------------
assert(
	/서울특별시 강남구 테헤란로/.test(extractGeoStreetAddress(FOOTER)),
	'street from footer sample',
);
assert(extractGeoStreetAddress('본문에 주소가 없습니다') === '', 'street no false positive');

// --- rep name ------------------------------------------------------------
assert(extractGeoRepName('대표원장 : 김수의') === '김수의', 'repName 대표원장 labeled');
assert(extractGeoRepName('대표자: John Park') === 'John Park', 'repName latin name');
assert(extractGeoRepName('대표이사 이철수 | 사업자 123-45-67890') === '이철수', 'repName 대표이사 labeled');
assert(extractGeoRepName('대표 안내') === '', 'repName rejects 안내 hallucination');
assert(extractGeoRepName('대표 : 인사말') === '', 'repName rejects 인사말 hallucination');
assert(extractGeoRepName('대표 제품으로 만든 패키지') === '', 'repName rejects 제품으로 hallucination');
assert(extractGeoRepName('대표 : 제품') === '', 'repName rejects 제품 stopword');
assert(extractGeoRepName('대표 : 문의') === '', 'repName rejects 문의 stopword');
assert(extractGeoRepName('대표 : 상담') === '', 'repName rejects 상담 stopword');
assert(extractGeoRepName('대표 : 진료') === '', 'repName rejects 진료 stopword');
assert(extractGeoRepName('대표 : 정보') === '', 'repName rejects 정보 stopword');
assert(extractGeoRepName(FOOTER) === '김원장', 'repName from footer sample');
assert(classifyGeoLink('https://place.naver.com/hospital/123') === 'map', 'place.naver.com → map');
assert(classifyGeoLink('https://goo.gl/maps/abcd') === 'map', 'goo.gl/maps → map');
assert(extractGeoRepName('대표 : 고객센터') === '', 'repName rejects 고객센터 hallucination');
assert(
	extractGeoRepName('대표 : 고객센터 / 대표원장 : 박영희') === '박영희',
	'repName skips hallucinated match and finds next valid candidate',
);

// --- telephone -----------------------------------------------------------
assert(extractGeoTelephone('대표번호 : 02-1234-5678') === '02-1234-5678', 'tel 대표번호 labeled seoul');
assert(extractGeoTelephone('대표전화: 031-123-4567') === '031-123-4567', 'tel 대표전화 labeled');
assert(extractGeoTelephone('전화번호: 010-1234-5678') === '010-1234-5678', 'tel 전화번호 mobile');
assert(extractGeoTelephone('고객센터 1688-1234') === '1688-1234', 'tel 고객센터 16xx');
assert(extractGeoTelephone('TEL 1588-1234') === '1588-1234', 'tel TEL 15xx short form');
assert(extractGeoTelephone('T: 031-123-4567') === '031-123-4567', 'tel single-letter T label');
assert(extractGeoTelephone('T. 02-555-1212') === '02-555-1212', 'tel T. label');
assert(extractGeoTelephone(FOOTER) === '02-555-1212', 'tel from footer sample');

// --- link classification --------------------------------------------------
assert(classifyGeoLink('https://m.place.naver.com/place/12345') === 'map', 'naver place → map');
assert(classifyGeoLink('https://map.naver.com/p/entry/place/12345') === 'map', 'naver map → map');
assert(classifyGeoLink('https://place.map.kakao.com/12345') === 'map', 'kakao map → map');
assert(classifyGeoLink('https://maps.google.com/maps?cid=1') === 'map', 'google maps → map');
assert(classifyGeoLink('https://blog.naver.com/mysite') === 'sns', 'naver blog → sns');
assert(classifyGeoLink('https://cafe.naver.com/mysite') === 'sns', 'naver cafe → sns');
assert(classifyGeoLink('https://post.naver.com/viewer/postView.naver?volumeNo=1') === 'sns', 'naver post → sns');
assert(classifyGeoLink('https://www.linkedin.com/in/mysite') === 'sns', 'linkedin → sns');
assert(classifyGeoLink('https://www.instagram.com/mysite') === 'sns', 'instagram → sns');
assert(classifyGeoLink('https://www.youtube.com/@mysite') === 'sns', 'youtube → sns');
assert(classifyGeoLink('https://www.facebook.com/mysite') === 'sns', 'facebook → sns');
assert(classifyGeoLink('https://www.tiktok.com/@mysite') === 'sns', 'tiktok → sns');
assert(classifyGeoLink('https://twitter.com/mysite') === 'sns', 'twitter → sns');
assert(classifyGeoLink('https://x.com/mysite') === 'sns', 'x.com → sns');
assert(
	classifyGeoLink('https://www.facebook.com/sharer/sharer.php?u=https://example.com') === null,
	'facebook sharer widget excluded',
);
assert(classifyGeoLink('https://twitter.com/intent/tweet?text=hi') === null, 'twitter intent/tweet excluded');
assert(classifyGeoLink('https://example.com/about') === null, 'unrelated link → null');
assert(classifyGeoLink('') === null, 'empty href → null');

// --- dedupe ----------------------------------------------------------------
assert(
	dedupeSameAs([
		'https://blog.naver.com/mysite',
		'https://blog.naver.com/mysite/',
		'https://BLOG.NAVER.COM/mysite',
		'https://www.instagram.com/mysite',
	]).length === 2,
	'dedupe collapses trailing-slash + case duplicates',
);
assert(dedupeSameAs(['', null, undefined, 'https://x.com/a']).length === 1, 'dedupe drops empty entries');

// --- path / canonical / breadcrumb ---------------------------------------
assert(isHomePath('/') === true, 'home /');
assert(isHomePath('/index.html') === true, 'home index.html');
assert(isHomePath('/index.php') === true, 'home index.php');
assert(isHomePath('/about') === false, 'subpage not home');
assert(
	normalizeCanonicalUrl('https://clinic.example.com', '/about', '?tab=1') ===
		'https://clinic.example.com/about?tab=1',
	'canonical origin+path+search',
);
const homeCrumbs = fallbackBreadcrumbItems({
	isHome: true,
	origin: 'https://clinic.example.com',
	pageUrl: 'https://clinic.example.com/',
	homeName: '서울내과의원',
	pageName: '서울내과의원',
});
assert(homeCrumbs.length === 1 && homeCrumbs[0].name === '서울내과의원', 'home breadcrumb 1-level');
const subCrumbs = fallbackBreadcrumbItems({
	isHome: false,
	origin: 'https://clinic.example.com',
	pageUrl: 'https://clinic.example.com/about',
	homeName: '서울내과의원',
	pageName: '병원소개',
});
assert(subCrumbs.length === 2 && subCrumbs[1].name === '병원소개', 'subpage breadcrumb 2-level');

// --- services / medical ---------------------------------------------------
assert(isMedicalOrgType(['MedicalClinic', 'LocalBusiness']) === true, 'medical org detected');
assert(isMedicalOrgType(['Organization', 'LocalBusiness']) === false, 'generic org not medical');
const medicalSvcs = normalizeGeoServices(['임플란트', '스케일링'], ['MedicalClinic']);
assert(medicalSvcs.length === 2 && medicalSvcs[0]['@type'] === 'MedicalProcedure', 'medical service type');
assert(normalizeGeoServices([''], ['MedicalClinic']).length === 0, 'empty service omitted');
assert(isSaasCmsType('Cafe24') && isSaasCmsType('아임웹') && isSaasCmsType('고도몰'), 'saas cms detect');
assert(!isSaasCmsType('Gnuboard'), 'gnu is not saas');

// --- generated JS sanity ----------------------------------------------------
const js = buildUniversalGeoEngineJs();
assert(js.includes('window.REDUE_CONFIG'), 'engine reads window.REDUE_CONFIG');
assert(js.includes('window.__REDUE_GEO_CONFIG__'), 'engine still reads window.__REDUE_GEO_CONFIG__');
assert(js.includes('__REDUE_SCHEMA_INJECTED__'), 'engine sets one-shot inject flag');
assert(js.includes("id === 'redue-universal-schema'") || js.includes('redue-universal-schema'), 'engine references redue-universal-schema id');
assert(js.includes('@graph'), 'engine emits @graph');
assert(js.includes('application/ld+json'), 'engine emits application/ld+json script type');
assert(js.includes('BreadcrumbList'), 'engine emits BreadcrumbList');
assert(js.includes('llms.txt'), 'engine inserts llms.txt help link');
assert(js.includes('LLMs Context'), 'engine help link title');
assert(js.includes('faxNumber'), 'engine binds faxNumber');
assert(js.includes('streetAddress'), 'engine binds streetAddress');
assert(js.includes('availableService'), 'engine binds availableService');
assert(js.includes('hasOfferCatalog'), 'engine binds hasOfferCatalog');
assert(js.includes('serviceCatalog'), 'engine reads serviceCatalog slot');
assert(js.includes('주요 서비스 및 진료 카탈로그'), 'engine catalog title');
assert(js.includes('MedicalWebPage'), 'engine can emit MedicalWebPage');
assert(js.includes('worksFor'), 'engine links Person.worksFor');
assert(js.includes('employee'), 'engine links Organization.employee when Person exists');
assert(js.includes('header nav a') && js.includes('.gnb a'), 'engine crawls header/GNB for catalog');
assert(js.includes('050-0000-0000'), 'engine rejects dummy 050 phone');
assert(!/"repTitle":"대표원장"/.test(js), 'engine default repTitle is empty');
assert(js.includes('DOMContentLoaded'), 'engine waits for DOMContentLoaded');
assert(!/\brequire\(/.test(js), 'no require() — zero-dependency');
assert(!/\bimport\s/.test(js), 'no import statement — zero-dependency');
assert(!/jquery|\$\(/i.test(js), 'no jQuery reference');
assert(!/=>/.test(js), 'no arrow functions — IE11-safe');
assert(!/\bconst\s|\blet\s/.test(js), 'no const/let — IE11-safe');
assert(js.length < 40_000, 'engine stays lightweight (<40KB before minification)');
assert(!js.toLowerCase().includes('</script>'), 'engine body has no closing script tag');

// Syntax validity check — `new Function` parses the body without executing DOM-only code.
new Function(js);

const snippet = buildSaasSchemaInjectorSnippet({
	name: '서울내과의원',
	orgType: ['MedicalClinic', 'LocalBusiness'],
	latitude: '37.5',
	longitude: '127.0',
	sameAs: ['https://blog.naver.com/clinic'],
	services: ['건강검진'],
});
assert(snippet.includes('<script>'), 'snippet is a script tag');
assert(snippet.includes('window.REDUE_CONFIG'), 'snippet exposes REDUE_CONFIG');
assert(snippet.includes('서울내과의원'), 'snippet bakes site name');
assert(snippet.includes('37.5'), 'snippet bakes latitude');
assert(snippet.includes('건강검진'), 'snippet bakes services');
assert(snippet.includes('__REDUE_SCHEMA_INJECTED__'), 'snippet includes injector flag');
assert((snippet.match(/<script>/g) || []).length === 1, 'snippet is a single script tag');

console.log('universal-geo-engine: all assertions passed', js.length, 'bytes');
