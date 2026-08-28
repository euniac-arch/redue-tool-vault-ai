/**
 * Universal LocalBusiness telephone extract + bind + PHP seed.
 * Run: npx tsx scripts/test-telephone.ts
 */
import {
	bindTelephone,
	extractTelHrefFromHtml,
	extractTelephoneFromHtml,
	extractTelephoneFromText,
	formatKoreanTelephone,
	resolveUniversalTelephone,
} from '../lib/solve/core/telephone';
import {
	buildGnuboardAutomatedRuntimeEnginePhp,
	buildUniversalSeoRuntimeHelpersPhp,
	extractOrgContactFromFooter,
	generateDynamicPhpSchema,
} from '../lib/solve/dynamic-php-schema';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('format 02-1234-5678', formatKoreanTelephone('0212345678') === '02-1234-5678');
assert('format 02-123-4567', formatKoreanTelephone('021234567') === '02-123-4567');
assert('format 031-123-4567', formatKoreanTelephone('0311234567') === '031-123-4567');
assert('format 1588-1234', formatKoreanTelephone('15881234') === '1588-1234');
assert('format 010-1234-5678', formatKoreanTelephone('01012345678') === '010-1234-5678');
assert('format 070-1234-5678', formatKoreanTelephone('07012345678') === '070-1234-5678');
assert('format 0504', formatKoreanTelephone('05041234567') === '0504-1234-567');
assert('format +82-2', formatKoreanTelephone('+82-2-1234-5678') === '02-1234-5678');
assert('format tel: href', formatKoreanTelephone('tel:02-1234-5678') === '02-1234-5678');
assert('bind empty stays empty', bindTelephone('') === '');
assert('bind formats workspace', bindTelephone('02 1234 5678') === '02-1234-5678');

assert('extract labeled 대표번호', extractTelephoneFromText('대표번호 : 02-1234-5678') === '02-1234-5678');
assert('extract 대표전화', extractTelephoneFromText('대표전화 031-123-4567') === '031-123-4567');
assert('extract 고객센터 1588', extractTelephoneFromText('고객센터 1588-1234') === '1588-1234');
assert('extract 상담 010', extractTelephoneFromText('상담 010-1234-5678') === '010-1234-5678');
assert('extract 070', extractTelephoneFromText('문의 070-123-4567') === '070-123-4567');

assert(
	'extract tel: href',
	extractTelHrefFromHtml('<a href="tel:02-9876-5432">전화</a>') === '02-9876-5432',
);
assert(
	'extract html tel: wins over body',
	extractTelephoneFromHtml('<footer><a href="tel:031-111-2222">031</a> 다른 번호 02-0000-0000</footer>') ===
		'031-111-2222',
);
assert(
	'extract html script',
	extractTelephoneFromHtml('<script>var tel="1588-0000";</script>') === '1588-0000',
);

assert(
	'step1 workspace wins',
	resolveUniversalTelephone({
		workspaceTel: '02-1111-2222',
		cmsTel: '031-333-4444',
		html: '<a href="tel:010-0000-0000">x</a>',
	}) === '02-1111-2222',
);
assert(
	'step2 cms when workspace empty',
	resolveUniversalTelephone({
		workspaceTel: '',
		cmsTel: '031-333-4444',
		html: '<a href="tel:010-0000-0000">x</a>',
	}) === '031-333-4444',
);
assert(
	'step3 tel href when cms empty',
	resolveUniversalTelephone({
		html: '<footer><a href="tel:070-1234-5678">상담</a></footer>',
	}) === '070-1234-5678',
);
assert(
	'step4 labeled footer',
	resolveUniversalTelephone({
		corpus: '상호 레드유 대표번호 : 02-555-1212 주소 서울',
	}) === '02-555-1212',
);

const footer = extractOrgContactFromFooter('전화: 02-9876-5432 | 이메일: hello@example.org | 주소: 서울시 서초구 서초대로 77 3층');
assert('footer contact formatted', footer.telephone === '02-9876-5432', footer.telephone);

const helpers = buildUniversalSeoRuntimeHelpersPhp();
assert('php format helper', helpers.includes('redue_format_telephone'));
assert('php extract helper', helpers.includes('redue_extract_telephone'));
assert('php tel href', helpers.includes('redue_extract_tel_href') && helpers.includes('href=["\']tel:'));
assert('php cms resolver', helpers.includes('redue_resolve_cms_telephone'));
assert('php universal resolver', helpers.includes('redue_resolve_universal_telephone'));
assert('php step1 redue_tel', helpers.includes("$GLOBALS['redue_tel']"));
assert('php labeled prefix', helpers.includes('대표번호|대표전화|TEL|Tel|전화|문의|상담|고객센터'));
assert('php wp options', helpers.includes('woocommerce_store_phone') && helpers.includes('get_theme_mod'));
assert('php rhymix context', helpers.includes("Context::get") && helpers.includes('site_phone'));

const wpPhp = generateDynamicPhpSchema(
	{
		siteName: '레드유클리닉',
		targetUrl: 'https://clinic.example',
		cmsType: 'WordPress',
		footerText: '대표번호 : 02-1234-5678',
		telephone: '02-9999-8888',
		pages: [{ urlPath: '/', title: '홈', pageType: 'WebPage' }],
	},
	{ siteName: '레드유클리닉', targetUrl: 'https://clinic.example', cmsType: 'WordPress', telephone: '02-9999-8888' },
);
assert('wp seeds redue_tel', wpPhp.includes("$GLOBALS['redue_tel'] = '02-9999-8888'"));
assert('wp binds org telephone', wpPhp.includes("'telephone' => $telephone") || wpPhp.includes("$org_node['telephone']"));
assert('wp never unsets telephone', !wpPhp.includes("unset($org_node['telephone'])"));

const gnuSeeded = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '서울내과의원',
	industryType: 'MEDICAL',
	telephone: '02-1234-5678',
});
assert('gnu seeds workspace tel', gnuSeeded.includes("$GLOBALS['redue_tel'] = '02-1234-5678'"));
assert('gnu no compile-time $telephone assign', !gnuSeeded.includes("$telephone = '02-1234-5678'"));
assert('gnu still has cf_tel fallback', gnuSeeded.includes("$config['cf_tel']"));
assert('gnu uses universal resolver', gnuSeeded.includes('redue_resolve_universal_telephone'));

const gnuEmpty = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: '서울내과의원',
	industryType: 'MEDICAL',
});
assert('gnu empty seed when unset', gnuEmpty.includes("$GLOBALS['redue_tel'] = '';"));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall telephone engine assertions passed');
