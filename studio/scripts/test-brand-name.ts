/**
 * Official site name from og:title / <title>, not the domain slug.
 * Run: npx tsx scripts/test-brand-name.ts
 */
import * as cheerio from 'cheerio';
import {
	extractOfficialBrandName,
	looksLikeDomainBrand,
	titleBrandHead,
} from '../lib/audit/brand-name';
import { extractSiteMetadata } from '../lib/audit/site-metadata';
import { resolveTargetBrandName } from '../lib/audit/target-entity';
import type { AuditReport } from '../lib/site-auditor';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

const OG = '나인원의원 | 대구 여의사 피부·성형 리프팅 & 안티에이징';
const DOMAIN = 'nineoneclinic.com';

assert(titleBrandHead(OG) === '나인원의원', `title head ${titleBrandHead(OG)}`);
assert(looksLikeDomainBrand('Nineoneclinic', DOMAIN), 'Nineoneclinic is domain slug');
assert(!looksLikeDomainBrand('나인원의원', DOMAIN), 'Korean clinic is not domain slug');

assert(
	extractOfficialBrandName(OG, DOMAIN, 'Nineoneclinic') === '나인원의원',
	`og:title wins over schema slug, got ${extractOfficialBrandName(OG, DOMAIN, 'Nineoneclinic')}`,
);
assert(
	extractOfficialBrandName('부산 임플란트 잘하는 곳 365드림치과의원', 'dream-dental.co.kr') ===
		'365드림치과의원',
	'dream dental from SEO title',
);
assert(
	extractOfficialBrandName('중입자 암치료 연구소', 'koreaionlab.co.kr') === '중입자 암치료 연구소',
	'institute title without 의원 suffix',
);

const html = `<!DOCTYPE html><html><head>
<title>Nineoneclinic</title>
<meta property="og:title" content="${OG}">
<meta property="og:site_name" content="Nineoneclinic">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"MedicalClinic","name":"Nineoneclinic"}</script>
</head><body><h1>메인</h1></body></html>`;
const $ = cheerio.load(html);
const meta = extractSiteMetadata($, `https://${DOMAIN}/`, 'ko', html);
assert(meta.ogTitle === OG, `ogTitle stored ${meta.ogTitle}`);
assert(meta.brandName === '나인원의원', `extractSiteMetadata brand=${meta.brandName}`);

const stale = resolveTargetBrandName({
	url: `https://${DOMAIN}/`,
	siteMeta: {
		domain: DOMAIN,
		brandName: 'Nineoneclinic',
		ogTitle: OG,
		title: 'Nineoneclinic',
		category: '',
		primaryKeyword: '',
		industryType: 'MEDICAL',
		location: '대구',
		broadLocation: '대구',
		vertical: 'medical',
		targetUrl: `https://${DOMAIN}/`,
	},
} as AuditReport);
assert(stale === '나인원의원', `stale report recovered brand=${stale}`);

const ogSiteHtml = `<!DOCTYPE html><html><head>
<title>삼삼물산 | 공식 홈페이지</title>
<meta property="og:site_name" content="삼삼물산">
</head><body></body></html>`;
const $samsam = cheerio.load(ogSiteHtml);
const samsamMeta = extractSiteMetadata($samsam, 'https://samsammulsan.com/', 'ko', ogSiteHtml);
assert(samsamMeta.ogSiteName === '삼삼물산', `ogSiteName stored ${samsamMeta.ogSiteName}`);
assert(samsamMeta.brandName === '삼삼물산', `samsam brand=${samsamMeta.brandName}`);

console.log('test-brand-name: ok');
