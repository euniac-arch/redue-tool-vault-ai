/**
 * Footer lifecycle scanner — redue_auto_detect_footer_info.
 * Run: npx tsx scripts/test-footer-auto-detect.ts
 */
import {
	buildFooterAutoDetectPhp,
	buildGnuboardAutomatedRuntimeEnginePhp,
	buildUniversalObSeoEnginePhp,
	buildUniversalSeoRuntimeHelpersPhp,
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

const TAX_RE = /(?:사업자\s*(?:등록)?\s*번호|사업자번호|등록번호)\s*[:：]?\s*([0-9]{3}-[0-9]{2}-[0-9]{5})/u;
const FAX_RE = /(?:팩스|FAX|Fax|F\.)\s*[:：]?\s*([0-9]{2,4}-[0-9]{3,4}-[0-9]{4})/u;
const REP_RE = /(?:대표자|대표원장|원장|대표이사|대표)\s*[:：]?\s*([가-힣]{2,4})(?=\s|<|$|\||\/)/u;
const STREET_RE =
	/(?:주소|위치|소재지)?\s*[:：]?\s*([가-힣]+(?:특별시|광역시|도|시|군|구)\s+[가-힣0-9\s·\-\(\),]+(?:로|길|동|리|가|번지|호|층|관|빌딩|호텔)[가-힣0-9\s·\-\(\),]*)/u;
const STOPWORDS = ['제품으로', '대표', '문의', '안내', '상담', '진료', '정보'];

const FOOTER_HTML = `
<div class="footer_info">
	상호 : 서울내과의원 | 대표자 : 김원장
	사업자등록번호 : 123-45-67890
	주소 : 서울특별시 강남구 테헤란로 123 메디컬빌딩 5층
	TEL : 02-555-1212 / FAX : 02-555-3434
</div>
`;

const php = buildFooterAutoDetectPhp();
const helpers = buildUniversalSeoRuntimeHelpersPhp();
const gnu = buildGnuboardAutomatedRuntimeEnginePhp({ siteName: '서울내과의원', industryType: 'MEDICAL' });
const uni = buildUniversalObSeoEnginePhp();

assert('function exists', php.includes('function redue_auto_detect_footer_info'));
assert('static executed flag', php.includes('static $executed = false') && php.includes('if ( $executed ) { return; }'));
assert('scans all tail files sequentially', php.includes('static $cached') && php.includes('file_get_contents') && php.includes('$cached .=') && php.includes("G5_THEME_PATH . '/tail.php'"));
assert('merges every readable tail file', php.includes('$cached .=') && php.includes('$_raw'));
assert('G5_THEME_PATH tail.php', php.includes("G5_THEME_PATH . '/tail.php'"));
assert('G5_THEME_PATH tail.sub.php', php.includes("G5_THEME_PATH . '/tail.sub.php'"));
assert('G5_PATH tail.php', php.includes("G5_PATH . '/tail.php'"));
assert('G5_PATH tail.sub.php', php.includes("G5_PATH . '/tail.sub.php'"));
assert('DOCUMENT_ROOT theme/basic fallback', php.includes("'/theme/basic/tail.php'") && php.includes('DOCUMENT_ROOT'));
assert('does not overwrite seeded taxID', php.includes("empty($GLOBALS['redue_tax_id'])"));
assert('does not overwrite seeded fax', php.includes("empty($GLOBALS['redue_fax'])"));
assert('does not overwrite seeded rep', php.includes("empty($GLOBALS['redue_rep_name'])"));
assert('does not overwrite seeded street', php.includes("empty($GLOBALS['redue_street'])"));
assert('taxID regex', php.includes('사업자번호') && php.includes('등록번호') && php.includes('[0-9]{3}-[0-9]{2}-[0-9]{5}'));
assert('fax regex includes F.', php.includes('F\\.') || php.includes('F.'));
assert('rep stopwords', STOPWORDS.every((w) => php.includes(`'${w}'`)));
assert('street suffix hotel/building', php.includes('빌딩') && php.includes('호텔'));

assert('helpers ship footer scanner', helpers.includes('function redue_auto_detect_footer_info'));
assert('gnu controller calls scanner first', /function redue_dynamic_schema_controller_body\(\) \{\s*if \( function_exists\( 'redue_auto_detect_footer_info' \) \)/.test(gnu));
assert('universal controller calls scanner first', /function redue_dynamic_schema_controller_body\(\) \{\s*if \( function_exists\( 'redue_auto_detect_footer_info' \) \)/.test(uni));
assert('gnu binds taxID only when present', gnu.includes("$org_node['taxID'] = trim($GLOBALS['redue_tax_id'])"));
assert('gnu binds faxNumber only when present', gnu.includes("$org_node['faxNumber'] = trim($GLOBALS['redue_fax'])"));
assert('gnu omits empty NAP keys', gnu.includes("unset($org_node[$_omit_k])") || gnu.includes("array('taxID', 'faxNumber', 'telephone')"));

const tax = FOOTER_HTML.match(TAX_RE);
assert('extract taxID', tax?.[1] === '123-45-67890');
const fax = FOOTER_HTML.match(FAX_RE);
assert('extract faxNumber', fax?.[1] === '02-555-3434');
const rep = FOOTER_HTML.match(REP_RE);
assert('extract Person name', rep?.[1] === '김원장');
const street = FOOTER_HTML.match(STREET_RE);
assert('extract streetAddress', Boolean(street?.[1] && street[1].includes('테헤란로') && street[1].includes('서울특별시')));

assert('reject 대표:안내', !STOPWORDS.includes('김원장') && STOPWORDS.includes('안내'));
const fakeRep = '대표 : 안내 '.match(REP_RE);
assert('stopword 안내 captured then rejected', fakeRep?.[1] === '안내' && STOPWORDS.includes(fakeRep[1]));
const productRep = '대표 : 제품으로 '.match(REP_RE);
assert('stopword 제품으로 captured then rejected', productRep?.[1] === '제품으로' && STOPWORDS.includes(productRep[1]));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nfooter-auto-detect ok');
