/**
 * GnuBoard filesystem NAP recon + theme path — no dummy addresses.
 * Run: npx tsx scripts/test-gnuboard-site-recon.ts
 */
import {
	pickGnuboardReconPaths,
	reconGnuboardSite,
	resolveGnuboardHeadSubPath,
	summarizeGnuboardRecon,
} from '../lib/solve/gnuboard-site-recon';
import { buildGnuboardAutomatedRuntimeEnginePhp } from '../lib/solve/dynamic-php-schema';
import { buildGnuboardExtendEngineFile, buildGnuboardHeadRenderCallBlock, planCmsInjection } from '../lib/solve/adapters';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const files: Record<string, string> = {
	'config.php': `<?php
$config['cf_theme'] = 'hospital';
$config['cf_title'] = '푸른동물병원';
$config['cf_tel'] = '02-1234-5678';
`,
	'theme/hospital/head.sub.php': `<?php
if (!defined('_GNUBOARD_')) exit;
?>
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title><?php echo $g5_head_title; ?></title>
</head>
`,
	'theme/hospital/tail.php': `
<footer>
  <p>상호 : 푸른동물병원</p>
  <p>대표원장 : 박수의</p>
  <p>주소 : 서울 강남구 테헤란로 123 3층</p>
  <p>TEL : 02-1234-5678</p>
  <p>FAX : 02-1234-5679</p>
  <p>사업자등록번호 : 123-45-67890</p>
  <p>진료시간 평일 10:00 ~ 19:00</p>
  <p>오시는 길 2호선 강남역 3번 출구 도보 5분</p>
  <a href="https://blog.naver.com/pureunvet">블로그</a>
</footer>
`,
	'theme/hospital/sub/contact.php': `
<h1>오시는 길</h1>
<p>지하철 2호선 강남역 3번 출구에서 도보 5분입니다.</p>
<p>Q. 예약은 어떻게 하나요?</p>
<p>A. 대표전화 02-1234-5678로 예약하시면 됩니다.</p>
`,
	'theme/basic/head.sub.php': '<?php /* ghost theme */ ?>',
};

const paths = Object.keys(files);
const recon = reconGnuboardSite({ relativePaths: paths, fileContents: files });

assert(recon.themeName === 'hospital', `theme hospital, got ${recon.themeName}`);
assert(recon.headSubPath === 'theme/hospital/head.sub.php', `head path ${recon.headSubPath}`);
assert(recon.enginePath === 'extend/redue.schema.php', 'engine path');
assert(recon.legalName === '푸른동물병원', `legal ${recon.legalName}`);
assert(recon.representativeName === '박수의', `rep ${recon.representativeName}`);
assert(/테헤란로 123/.test(recon.streetAddress), `street ${recon.streetAddress}`);
assert(recon.telephone === '02-1234-5678', `tel ${recon.telephone}`);
assert(recon.fax === '02-1234-5679', `fax ${recon.fax}`);
assert(recon.taxId === '123-45-67890', `tax ${recon.taxId}`);
assert(recon.openingHoursOpens === '10:00', `opens ${recon.openingHoursOpens}`);
assert(recon.openingHoursCloses === '19:00', `closes ${recon.openingHoursCloses}`);
assert(recon.hoursDetected, 'hours detected');
assert(/강남역/.test(recon.transitText), `transit ${recon.transitText}`);
assert(recon.sameAs.some((u) => /blog\.naver\.com\/pureunvet/.test(u)), 'sameAs blog');
assert(recon.faqItems.length > 0, 'faq from contact page');
assert(!recon.streetAddress.includes('소재지'), 'no invented 소재지');
assert(recon.latitude === '', 'no dummy geo');
assert(summarizeGnuboardRecon(recon).some((l) => l.includes('활성 테마')), 'summary theme');

const ghost = reconGnuboardSite({
	relativePaths: ['config.php', 'head.sub.php', 'theme/basic/head.sub.php', 'tail.php'],
	fileContents: {
		'config.php': "<?php\n$config['cf_theme'] = '';\n$config['cf_title'] = '루트병원';\n",
		'head.sub.php': '<?php if (!defined("_GNUBOARD_")) exit; ?><meta charset="utf-8">',
		'theme/basic/head.sub.php': 'ghost',
		'tail.php': '<footer>상호 : 루트병원 대표 : 김원장 주소 : 부산 해운대구 센텀동로 1 TEL 051-111-2222</footer>',
	},
});
assert(ghost.themeName === null, 'empty cf_theme → no theme');
assert(ghost.headSubPath === 'head.sub.php', `root head ${ghost.headSubPath}`);
assert(/센텀동로/.test(ghost.streetAddress), `ghost street ${ghost.streetAddress}`);
assert(ghost.telephone === '051-111-2222', `ghost tel ${ghost.telephone}`);

assert(
	resolveGnuboardHeadSubPath({ relativePaths: paths, themeName: 'hospital' }) ===
		'theme/hospital/head.sub.php',
	'resolve theme head',
);
assert(pickGnuboardReconPaths(paths).includes('theme/hospital/tail.php'), 'pick tail');

const empty = reconGnuboardSite({
	relativePaths: ['config.php', 'head.sub.php'],
	fileContents: {
		'config.php': "<?php\n$config['cf_theme'] = '';\n",
		'head.sub.php': '<?php',
	},
});
assert(empty.streetAddress === '', 'no dummy street');
assert(empty.telephone === '', 'no dummy tel');
assert(empty.representativeName === '', 'no dummy rep');

const clinic = reconGnuboardSite({
	relativePaths: [
		'config.php',
		'head.sub.php',
		'theme/basic/head.sub.php',
		'theme/basic/contents/s101.php',
	],
	fileContents: {
		'config.php': "<?php\n$config['cf_theme'] = '';\n$config['cf_title'] = '나인원의원';\n",
		'head.sub.php':
			"<?php if (is_file(G5_THEME_PATH.'/head.sub.php')) { include_once(G5_THEME_PATH.'/head.sub.php'); return; } ?>",
		'theme/basic/head.sub.php': '<meta charset="utf-8">',
		'theme/basic/contents/s101.php': '<?php echo "인사말"; ?>',
	},
	urlPaths: ['/theme/basic/contents/s101.php', '/theme/basic/contents/s201.php'],
});
assert(clinic.themeName === 'basic', `clinic theme ${clinic.themeName}`);
assert(clinic.headSubPath === 'theme/basic/head.sub.php', `clinic head ${clinic.headSubPath}`);

const engine = buildGnuboardAutomatedRuntimeEnginePhp({
	siteName: recon.brandName,
	industryType: 'MEDICAL',
	telephone: recon.telephone,
	streetAddress: recon.streetAddress,
	representativeName: recon.representativeName,
	representativeTitle: recon.representativeTitle,
	fax: recon.fax,
	taxId: recon.taxId,
	openingHoursOpens: recon.openingHoursOpens,
	openingHoursCloses: recon.openingHoursCloses,
	sameAs: recon.sameAs,
});
assert(engine.includes("if (!defined('_GNUBOARD_'))") || engine.includes('redue_render_full_schema'), 'engine fn');
assert(engine.includes('redue_scan_site_file_corpus'), 'runtime file corpus');
assert(engine.includes('redue_extract_fax'), 'fax helper');
assert(engine.includes('redue_extract_tax_id'), 'tax helper');
assert(engine.includes('박수의'), 'seed real rep');
assert(engine.includes('02-1234-5678'), 'seed real tel');
assert(engine.includes('123-45-67890'), 'seed tax');
assert(!engine.includes('37.4837'), 'no seocho dummy coord');
assert(!engine.includes('김수의'), 'no dummy 김수의');
assert(!engine.includes('maeumvet'), 'no dummy sns');
assert(!/소재지/.test(engine) || engine.includes('redue_strict_nap'), 'strict nap flag');

const wrapped = buildGnuboardExtendEngineFile(engine);
assert(wrapped.includes('G5_IS_ADMIN'), 'admin guard');
assert(wrapped.includes("REQUEST_METHOD'] === 'POST'"), 'post guard');
assert(wrapped.includes('function redue_render_full_schema'), 'render fn');

const plans = planCmsInjection({
	cmsType: 'Gnuboard',
	corePhp: engine,
	headerPath: recon.headSubPath,
});
assert(plans[0]?.relativePath === 'extend/redue.schema.php', 'plan engine path');
assert(plans[1]?.relativePath === 'theme/hospital/head.sub.php', `plan head ${plans[1]?.relativePath}`);
assert(plans[1]?.content.includes('redue_render_full_schema'), 'head render call');
assert(!plans[1]?.content.includes('function redue_dynamic_schema'), 'head has no engine');

const renderOnly = buildGnuboardHeadRenderCallBlock();
assert((renderOnly.match(/\n/g) || []).length <= 8, 'head render is 5-line class');

console.log('ok  gnuboard-site-recon', recon.legalName, recon.headSubPath);
