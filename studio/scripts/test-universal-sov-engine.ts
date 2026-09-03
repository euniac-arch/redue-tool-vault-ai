/**
 * Universal SoV engine — brand aliases, citation ownership, query-level schema.
 * Run: npx tsx scripts/test-universal-sov-engine.ts
 */
import * as cheerio from 'cheerio';
import { extractSiteMetadata } from '../lib/audit/site-metadata';
import {
	allocateCitationAwareShares,
	buildTargetBrandTokens,
	buildUniversalQuerySov,
	buildUniversalSovSystemPrompt,
	classifyCitationOwnership,
	classifyQuerySovIntent,
	computeIntentAwareSovShares,
	domainHeadAliases,
	extractBrandAliasesFromMeta,
	normalizeBrandAlias,
	parseUniversalQuerySov,
	queryContainsBrandToken,
	stripBrandLegalSuffix,
	textMentionsBrand,
	toUniversalRank,
} from '../lib/audit/universal-sov-engine';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

const exampleAliases = domainHeadAliases('https://example.com/about');
assert('example.com head is example', exampleAliases.some((alias) => normalizeBrandAlias(alias) === 'example'));
assert('example.com hangul is 익스플', exampleAliases.some((alias) => alias.includes('익스플')));

const bakery = extractBrandAliasesFromMeta({
	targetUrl: 'https://www.sunsweetbakery.co.kr/',
	brandName: '선스윗베이커리',
	pageTitle: '선스윗베이커리 | 성수 빵집',
	ogTitle: '선스윗베이커리',
	ogSiteName: '선스윗베이커리',
	organizationName: '선스윗베이커리',
	schemaOrganizationNames: ['선스윗베이커리', 'Sunsweet Bakery'],
});
assert('bakery canonical is 선스윗베이커리', bakery.canonicalBrand.includes('선스윗'));
assert(
	'bakery aliases include schema latin',
	bakery.brandAliases.some((alias) => normalizeBrandAlias(alias).includes('sunsweet')),
);
assert('bakery aliases include domain head', bakery.brandAliases.some((alias) => /sunsweet/i.test(alias)));

const html = `<!DOCTYPE html><html><head>
<title>아로마랩 | 제주 향수</title>
<meta property="og:title" content="아로마랩 공식몰">
<meta property="og:site_name" content="아로마랩">
<script type="application/ld+json">${JSON.stringify({
	'@context': 'https://schema.org',
	'@type': ['Organization', 'LocalBusiness'],
	name: '아로마랩',
	alternateName: 'Aroma Lab',
	legalName: '주식회사 아로마랩',
})}</script>
<script type="application/ld+json">${JSON.stringify({
	'@context': 'https://schema.org',
	'@type': 'MedicalBusiness',
	name: '아로마랩 클리닉',
})}</script>
</head><body><h1>아로마랩</h1></body></html>`;
const $ = cheerio.load(html);
const meta = extractSiteMetadata($, 'https://aromalab.co.kr/', 'ko', html);
assert('meta brandAliases present', (meta.brandAliases?.length ?? 0) >= 2, meta.brandAliases);
assert('meta picks Organization.name', meta.organizationName === '아로마랩' || (meta.schemaOrganizationNames ?? []).includes('아로마랩'));
assert(
	'meta collects MedicalBusiness.name',
	(meta.schemaOrganizationNames ?? []).some((name) => name.includes('아로마랩')),
);
assert('meta aliases include domain head', (meta.brandAliases ?? []).some((alias) => /aromalab/i.test(alias)));

const owned = classifyCitationOwnership({
	title: '아로마랩 공식 소개',
	url: 'https://aromalab.co.kr/about',
	snippet: '브랜드 스토리',
	targetUrl: 'https://aromalab.co.kr/',
	brandAliases: bakery.brandAliases.concat(['아로마랩', 'aromalab']),
});
assert('official URL is owned', owned.ownership === 'owned' && owned.isTargetMention);

const earned = classifyCitationOwnership({
	title: '제주에서 아로마랩 향수 써본 후기',
	url: 'https://blog.naver.com/travel/123',
	snippet: '아로마랩이 제일 무난했어요',
	targetUrl: 'https://aromalab.co.kr/',
	brandAliases: ['아로마랩', 'aromalab'],
});
assert('naver blog with brand is brand_earned', earned.ownership === 'brand_earned' && earned.isTargetMention);

const unbranded = classifyCitationOwnership({
	title: '제주 향수 추천 BEST 5',
	url: 'https://blog.naver.com/travel/999',
	snippet: '시중에서 구하기 쉬운 브랜드 위주',
	targetUrl: 'https://aromalab.co.kr/',
	brandAliases: ['아로마랩', 'aromalab'],
});
assert('unbranded third-party has no mention', unbranded.ownership === 'unbranded_third_party' && !unbranded.isTargetMention);

assert('negated mention is ignored', !textMentionsBrand('아로마랩은 언급되지 않았습니다.', ['아로마랩']));
assert('positive mention matches', textMentionsBrand('오늘은 아로마랩을 추천합니다.', ['아로마랩']));

const allocated = allocateCitationAwareShares({
	own: 5,
	thirdParty: 52,
	rank1: 27,
	rank2: 16,
	citations: [owned, earned, unbranded],
});
assert('earned citation pulls share from third-party', allocated.own > 5 && allocated.thirdParty < 52);
assert(
	'citation-aware pie stays 100',
	allocated.own + allocated.thirdParty + allocated.rank1 + allocated.rank2 === 100,
	allocated,
);

const querySov = buildUniversalQuerySov({
	query: '제주 향수 추천',
	context: { targetUrl: 'https://aromalab.co.kr/', brandAliases: ['아로마랩'], canonicalBrand: '아로마랩' },
	clientRank: 4,
	asIsShare: 5,
	thirdPartyShare: 52,
	leaderboard: [
		{ rank: 1, name: '경쟁 A', share: 27 },
		{ rank: 2, name: '경쟁 B', share: 16 },
		{ rank: 3, name: '아로마랩 (순위 밖)', share: 5, isClient: true },
		{ rank: 0, name: '3자 분산', share: 52, isThirdParty: true },
	],
	citations: [
		{ title: earned.title, url: earned.url, snippet: '아로마랩이 제일 무난했어요' },
		{ title: unbranded.title, url: unbranded.url, snippet: unbranded.title },
	],
});
assert('unranked maps to rank 0', querySov.rank === 0 && toUniversalRank(4) === 0);
assert('query is independent', querySov.query === '제주 향수 추천');
assert('earned citation isTargetMention', querySov.citations.some((row) => row.isTargetMention));
assert('target competitor flagged', querySov.topCompetitors.some((row) => row.isTarget));

const prompt = buildUniversalSovSystemPrompt({
	targetUrl: 'https://aromalab.co.kr/',
	brandAliases: ['아로마랩', 'aromalab'],
	canonicalBrand: '아로마랩',
});
assert('prompt injects brandAliases', prompt.includes('아로마랩') && prompt.includes('brandAliases'));
assert('prompt injects targetUrl', prompt.includes('https://aromalab.co.kr/'));
assert('prompt asks for UniversalQuerySov fields', prompt.includes('targetBrandScore') && prompt.includes('isTargetMention'));

const parsed = parseUniversalQuerySov({
	query: '제주 향수 추천',
	rank: 2,
	targetBrandScore: 16,
	thirdPartyShare: 52,
	topCompetitors: [{ rank: 2, name: '아로마랩', sharePercent: 16, isTarget: true }],
	citations: [{ title: '공식', url: 'https://aromalab.co.kr/', isTargetMention: true }],
});
assert('parser keeps rank 2', parsed?.rank === 2 && parsed.targetBrandScore === 16);

const nineoneTokens = buildTargetBrandTokens(
	['나인원의원', '대구 나인원의원'],
	'나인원의원',
	'nineoneclinic.com',
);
assert('nineone tokens include 나인원', nineoneTokens.some((token) => /나인원/.test(token)), nineoneTokens);
assert('nineone tokens include domain head', nineoneTokens.some((token) => /nineone/i.test(token)), nineoneTokens);
assert('suffix strip of 나인원의원 is 나인원', stripBrandLegalSuffix('나인원의원') === '나인원');
assert('대구 나인원의원 is a brand query', queryContainsBrandToken('대구 나인원의원', nineoneTokens));
assert(
	'대구 나인원의원 classifies navigational',
	classifyQuerySovIntent('대구 나인원의원', nineoneTokens) === 'navigational',
);
assert(
	'울트라클리어엘리트 classifies specialized',
	classifyQuerySovIntent('대구 동구 울트라클리어엘리트 추천', nineoneTokens) === 'specialized',
);
assert(
	'동대구역 피부미용 classifies generic',
	classifyQuerySovIntent('동대구역 동구 피부미용', nineoneTokens) === 'generic',
);

const brandPie = computeIntentAwareSovShares({
	query: '대구 나인원의원',
	brandTokens: nineoneTokens,
});
assert('navigational own 85-95', brandPie.own >= 85 && brandPie.own <= 95 && brandPie.clientRank === 1, brandPie);
assert('navigational competitors <=5', brandPie.rank1 <= 5 && brandPie.rank2 <= 5);
assert('navigational third-party 5-15', brandPie.thirdParty >= 5 && brandPie.thirdParty <= 15);
assert('navigational pie 100', brandPie.own + brandPie.rank1 + brandPie.rank2 + brandPie.thirdParty === 100);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall universal SoV engine assertions passed');
