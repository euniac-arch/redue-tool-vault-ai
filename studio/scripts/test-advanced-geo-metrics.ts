/**
 * Step 1: next-gen GEO metrics data engine.
 * Run: npx tsx scripts/test-advanced-geo-metrics.ts
 */
import {
	AS_IS_SHARE_MAX,
	AS_IS_SHARE_MIN,
	AS_IS_UNRANKED_MAX,
	CLIENT_UNRANKED_RANK,
	RANK_1_SHARE,
	RANK_2_SHARE,
	RANK_3_SHARE,
	THIRD_PARTY_SHARE,
	TO_BE_SHARE_MAX,
	TO_BE_SHARE_MIN,
	applyKeywordSovToDynamic,
	allocateSymmetricCitationPie,
	buildLlmsTxtContent,
	buildVulnerabilityInsight,
	calculateAsIsBrandShare,
	calculateDynamicSov,
	calculateRankBasedAsIsShare,
	calculateSymmetricSov,
	calculateUnifiedMarketSov,
	computeAdvancedGeoMetrics,
	computeEntityDisambiguation,
	computeFactDensity,
	computeRagChunkingScore,
	computeShareOfVoice,
	DEFAULT_SOV_SHARE_TABLE,
	extractPlaceCid,
	extractTaxId,
	isValidKoreanTaxId,
	resolveKeywordSovShares,
	SOV_SAMPLE_DATA,
	unifiedToDynamicSov,
} from '../lib/audit/advancedGeoMetrics';
import {
	bindCompetitorSov,
	buildSovQueryPresets,
	cleanCompetitorName,
	isSelfBrandName,
	SOV_LEADER_RESIDUAL_RATIO,
	statisticalFallbackNames,
} from '../lib/audit/realCompetitors';
import {
	buildSovIndustryPromptGuide,
	filterIndustryNames,
	looksLikePlaceOrBuildingQuery,
	resolveTargetIndustry,
	rewriteSovSearchQuery,
} from '../lib/audit/sov-industry-guard';
import {
	buildSovNichePromptGuide,
	extractNicheItemTokens,
	filterGenericNonNicheNames,
	resolveNicheOfferingMatch,
} from '../lib/audit/sov-niche-entity';
import { softenComparativeQuery, softenQueryToken } from '../lib/audit/anonymize-competitor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const emptyAsIs = calculateAsIsBrandShare({ entityScore: 0, ragScore: 0, hasSchema: false });
assert('empty GEO as-is is unranked 5', emptyAsIs === AS_IS_SHARE_MIN, String(emptyAsIs));
const structuredAsIs = calculateAsIsBrandShare({ entityScore: 50, ragScore: 50, hasSchema: true });
assert('structured GEO as-is stays at 5', structuredAsIs === RANK_3_SHARE, String(structuredAsIs));
const fullAsIs = calculateAsIsBrandShare({ entityScore: 100, ragScore: 100, hasSchema: true });
assert('full GEO as-is stays at unranked 5', fullAsIs === AS_IS_UNRANKED_MAX, String(fullAsIs));
assert('rank 1 as-is is 27', calculateRankBasedAsIsShare(0, { entityScore: 0, ragScore: 0, hasSchema: false }) === RANK_1_SHARE);
assert('rank 2 as-is is 16', calculateRankBasedAsIsShare(1, { entityScore: 0, ragScore: 0, hasSchema: false }) === RANK_2_SHARE);
assert('rank 3 as-is is 5', calculateRankBasedAsIsShare(2, { entityScore: 0, ragScore: 0, hasSchema: false }) === RANK_3_SHARE);
assert('overall as-is max is rank-1 27', AS_IS_SHARE_MAX === RANK_1_SHARE);

const dynamicEmpty = calculateDynamicSov('안성햇살의원', '안성', '도수치료', ['안성본정형외과', '안성튼튼재활의학과'], {
	entityScore: 0,
	ragScore: 0,
	hasSchema: false,
});
const emptyDirectory = dynamicEmpty.competitors.find((row) => row.isDirectory);
const emptyClient = dynamicEmpty.leaderboard.find((row) => row.isClient);
assert('dynamic empty as-is is generic unranked 5-15', dynamicEmpty.asIsShare >= 5 && dynamicEmpty.asIsShare <= 15);
assert('dynamic empty clientRank is 4', dynamicEmpty.clientRank === CLIENT_UNRANKED_RANK);
assert('dynamic empty uses live listing names', Boolean(dynamicEmpty.leaderboard[0]?.name) && !dynamicEmpty.leaderboard[0]?.name.startsWith('경쟁 A사'));
assert('dynamic empty maps client into #3 slot', emptyClient?.rank === 3 && emptyClient.name.includes('순위 밖'));
assert('dynamic empty leader is residual split', dynamicEmpty.competitors[0]?.share > dynamicEmpty.competitors[1]?.share);
assert('dynamic empty runner is leftover', dynamicEmpty.competitors[1]?.share > 0);
assert('dynamic empty directory is 40-60', (emptyDirectory?.share ?? 0) >= 40 && (emptyDirectory?.share ?? 0) <= 60 && emptyDirectory.isDirectory === true);
assert('dynamic empty to-be exceeds as-is', dynamicEmpty.toBeShare > dynamicEmpty.asIsShare);
assert('dynamic empty gap is leader minus as-is', dynamicEmpty.gapToLeader === (dynamicEmpty.competitors[0]?.share ?? 0) - dynamicEmpty.asIsShare);
assert('dynamic empty reclaim is to-be - as-is', dynamicEmpty.reclaimGain === dynamicEmpty.toBeShare - dynamicEmpty.asIsShare);
assert(
	'dynamic empty pie is 100',
	dynamicEmpty.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100,
);
assert('dynamic target query includes 추천', dynamicEmpty.targetQuery === '안성 도수치료 추천');
assert(
	'dynamic empty vulnerability names share and to-be',
	dynamicEmpty.vulnerabilityInsight.includes(`${dynamicEmpty.competitors[0]?.share}%`) &&
		dynamicEmpty.vulnerabilityInsight.includes(`${dynamicEmpty.toBeShare}%`),
);
assert('dynamic empty loss names directory leakage', dynamicEmpty.lossInsight.includes(`${emptyDirectory?.share}%`));

const dynamicFull = calculateDynamicSov('안성햇살의원', '안성', '도수치료', ['안성본정형외과'], {
	entityScore: 100,
	ragScore: 100,
	hasSchema: true,
});
assert('dynamic full as-is is unranked 5-15', dynamicFull.asIsShare >= 5 && dynamicFull.asIsShare <= 15);
assert('dynamic full to-be exceeds as-is', dynamicFull.toBeShare > dynamicFull.asIsShare);
assert('dynamic full uses live listing name', Boolean(dynamicFull.competitors[0]?.name) && dynamicFull.competitors[0]?.isRealData === true && !dynamicFull.competitors[0]?.name.startsWith('경쟁 A사'));
assert('dynamic full fallback 2nd name', Boolean(dynamicFull.competitors[1]?.name) && dynamicFull.competitors[1]?.isRealData !== true);

const stripped = calculateDynamicSov(
	'안성햇살의원',
	'안성',
	'도수치료',
	['<b>안성</b>햇살의원', '<b>안성</b>본정형외과', '안성튼튼재활의학과'],
	{ entityScore: 0, ragScore: 0, hasSchema: false },
);
assert('dynamic strips Naver <b> tags', stripped.leaderboard[0]?.name === '안성햇살의원');
assert('dynamic keeps client in live #1 slot', stripped.leaderboard[0]?.isClient === true && stripped.clientRank === 1);

const legalGap = calculateDynamicSov(
	'강남법무법인',
	'강남',
	'이혼전문변호사',
	[],
	{ entityScore: 40, ragScore: 30, hasSchema: true },
	{ categoryName: '법률사무소' },
);
assert('legal target query includes 추천', legalGap.targetQuery === '강남 이혼전문변호사 추천');
assert(
	'legal empty listings fill distinct non-self slots',
	legalGap.competitors.filter((row) => !row.isDirectory).length >= 2 &&
		legalGap.competitors.every((row) => !/강남법무법인/.test(row.name)),
	legalGap.competitors.map((row) => row.name).join(', '),
);

const interiorGap = calculateDynamicSov(
	'마포공간스튜디오',
	'마포',
	'아파트인테리어',
	[],
	{ entityScore: 20, ragScore: 10, hasSchema: false },
	{ categoryName: '시공 업체' },
);
assert('interior target query includes 추천', interiorGap.targetQuery === '마포 아파트인테리어 추천');
assert('interior fallback uses listing label not 경쟁 A사', Boolean(interiorGap.competitors[0]?.name) && !interiorGap.competitors[0]?.name.startsWith('경쟁 A사'));

const sov = computeShareOfVoice({
	brandName: '센텀우리내과',
	location: '부산 센텀',
	industryType: 'medical',
	lang: 'ko',
});
const sovSum = sov.shares.reduce((acc, row) => acc + row.sharePct, 0);
assert('own share without listings is unranked 5-15', sov.ownSharePct >= 5 && sov.ownSharePct <= 15 && sov.asIsShare === sov.ownSharePct);
assert('competitor count is 2', sov.competitorCount === 2);
assert('shares sum to 100', sovSum === 100, String(sovSum));
assert('own row is on the leaderboard', sov.shares.some((row) => row.isOwn));
assert('directory share is reserved', sov.directoryShare >= 40 && sov.directoryShare <= 60);
assert(
	'ranking competitors take leftover pool',
	sov.shares.filter((row) => !row.isOwn && !row.isDirectory).reduce((acc, row) => acc + row.sharePct, 0) ===
		100 - sov.asIsShare - sov.directoryShare,
);
assert('unlisted leader exceeds own', sov.leaderSharePct > sov.asIsShare, String(sov.leaderSharePct));
assert('gap equals leader minus as-is', sov.gapToLeader === sov.leaderSharePct - sov.asIsShare);
assert('to-be exceeds as-is', sov.toBeShare > sov.asIsShare);
assert(
	'sov vulnerability insight is generated',
	Boolean(sov.vulnerabilityInsight?.includes(`${sov.toBeShare}%`)),
);

const gangnam = computeShareOfVoice({ location: '강남', industryType: 'beauty', lang: 'ko' });
assert('SoV always uses 2 ranking competitors', gangnam.competitorCount === 2, String(gangnam.competitorCount));
assert(
	'fallback names use listing labels not 경쟁 A사',
	gangnam.shares.some((row) => !row.isOwn && !row.isDirectory && Boolean(row.name)) &&
		gangnam.shares.every((row) => !row.name.startsWith('경쟁 A사')),
	gangnam.shares.map((row) => row.name).join(', '),
);

const own8 = computeShareOfVoice({
	brandName: '자사',
	location: '강남',
	industryType: 'legal',
	ownSharePct: 8,
	lang: 'ko',
});
assert('own share override is honored', own8.ownSharePct === 8);
assert('own share override keeps client on leaderboard', own8.shares.some((row) => row.isOwn && row.sharePct === 8));

const geoScored = computeShareOfVoice({
	brandName: '안성햇살의원',
	location: '안성',
	primaryKeyword: '도수치료',
	industryType: 'medical',
	lang: 'ko',
	geoReadinessScore: { entityScore: 0, ragScore: 0, hasSchema: false },
	competitors: [
		{ name: '안성본정형외과', isRealData: true },
		{ name: '안성튼튼재활의학과', isRealData: true },
	],
});
assert('geo-scored empty as-is is unranked 5-15', geoScored.asIsShare >= 5 && geoScored.asIsShare <= 15);
assert('geo-scored leader exceeds own', geoScored.leaderSharePct > geoScored.asIsShare, String(geoScored.leaderSharePct));
assert('geo-scored insight includes directory leakage', geoScored.lossInsight?.includes(`${geoScored.directoryShare}%`) === true);

const entityEmpty = computeEntityDisambiguation();
assert('empty entity score is 0', entityEmpty.score === 0);

const entityFull = computeEntityDisambiguation({
	taxId: '120-81-47521',
	placeCid: '123456789012345',
	sameAs: [
		'https://blog.naver.com/clinic',
		'https://www.instagram.com/clinic',
		'https://place.naver.com/hospital/1',
		'https://www.youtube.com/@clinic',
	],
	representativeKgLinked: true,
});
assert('full entity score is 100', entityFull.score === 100, String(entityFull.score));
assert('tax id checksum accepted', isValidKoreanTaxId('120-81-47521'));
assert('tax id from 사업자등록번호 label', extractTaxId('사업자등록번호: 120-81-47521') === '120-81-47521');
assert(
	'place CID from Naver Place URL',
	extractPlaceCid('https://place.naver.com/hospital/123456789012345') === '123456789012345',
);
assert('place CID from Google cid=', extractPlaceCid('https://maps.google.com/?cid=987654321000') === '987654321000');
assert(
	'place CID from Kakao place URL',
	extractPlaceCid('https://place.map.kakao.com/135792468') === '135792468',
);
assert(
	'place identity from goo.gl/maps is present',
	Boolean(extractPlaceCid('https://goo.gl/maps/abcdEFGHijkl')),
);
assert('schema taxID field', extractTaxId('{"@type":"MedicalClinic","taxID":"120-81-47521"}') === '120-81-47521');
assert('vatID field', extractTaxId('{"vatID":"1208147521"}') === '120-81-47521');

const kgLinked = computeEntityDisambiguation({
	jsonLdCorpus: JSON.stringify({
		'@graph': [
			{ '@type': 'Person', '@id': '#person', name: '배우리', worksFor: { '@id': '#org' } },
			{ '@type': 'MedicalClinic', '@id': '#org', founder: { '@id': '#person' } },
		],
	}),
});
assert('Person KG 20점', kgLinked.breakdown.representativeKg.linked && kgLinked.breakdown.representativeKg.score === 20);

const kgUnlinked = computeEntityDisambiguation({
	jsonLdCorpus: JSON.stringify({ '@type': 'Person', name: '배우리', jobTitle: '대표원장' }),
});
assert('Person without worksFor/founder is 0 KG', kgUnlinked.breakdown.representativeKg.linked === false);

const mapDom = computeEntityDisambiguation({
	html: '<a href="https://map.naver.com/p/entry/place/123456789012345">place</a><a href="https://www.instagram.com/clinic">sns</a>',
});
assert('DOM map+SNS count as sameAs', mapDom.breakdown.sameAs.count >= 2, String(mapDom.breakdown.sameAs.count));
assert('DOM sameAs urls stored', mapDom.breakdown.sameAs.urls.length >= 2, String(mapDom.breakdown.sameAs.urls.length));
assert('DOM naver place CID present', mapDom.breakdown.placeCid.present === true);

const html =
	'<html><head><style>.x{color:red}</style></head><body><main><article><section><p>월요일 오전 9:00부터 진료합니다. 초진 15,000원, 야간진료 주 3회, 본인부담 30%입니다.</p></section></article></main></body></html>';
const rag = computeRagChunkingScore({ html });
assert('RAG semantic tags all present', rag.semantic.article && rag.semantic.section && rag.semantic.main);
assert('RAG score in 0-100', rag.score >= 0 && rag.score <= 100);
assert('thin HTML meets 25% text ratio', rag.meetsRecommendedRatio === true);

const fact = computeFactDensity({ html });
assert('fact density > 0', fact.score > 0 && fact.quantitativeTokenCount > 0);
assert('fact categories include numbers and times', fact.categories.numbers > 0 && fact.categories.times > 0);

const llms = buildLlmsTxtContent({
	brandName: '센텀우리내과',
	location: '부산 센텀',
	industryType: 'medical',
	services: ['내과', '건강검진', '야간진료'],
	nap: { name: '센텀우리내과', telephone: '051-000-0000', address: '부산 해운대구 센텀' },
	representativeName: '김원장',
	url: 'https://centum-clinic.example',
	lang: 'ko',
});
assert('llms has brand h1', llms.startsWith('# 센텀우리내과'));
assert('llms has industry', llms.includes('업종: 병의원'));
assert('llms has 3 services', llms.includes('1. 내과') && llms.includes('2. 건강검진') && llms.includes('3. 야간진료'));
assert('llms has NAP', llms.includes('051-000-0000') && llms.includes('부산 해운대구 센텀'));
assert('llms has representative', llms.includes('## 대표원장') && llms.includes('김원장'));
assert('llms has FAQ section', llms.includes('## FAQ') && (llms.match(/^### /gm) || []).length === 3);

const legal = computeAdvancedGeoMetrics({
	brandName: '강남법무법인',
	location: '강남',
	title: '이혼소송 변호사',
	lang: 'ko',
});
assert('registry detects legal', legal.industry.type === 'legal', legal.industry.type);
assert('legal representative title', legal.industry.representativeTitle === '대표변호사');
assert('legal schema', legal.industry.schemaType === 'LegalService');
assert('composite llms uses 대표변호사', legal.llmsTxt.includes('## 대표변호사'));

assert('Naver title strips <b> tags', cleanCompetitorName('<b>안성</b>본정형외과') === '안성본정형외과');
assert('self-exclusion matches containment', isSelfBrandName('안성햇살의원 본점', '안성햇살의원'));
assert('self-exclusion skips unrelated', !isSelfBrandName('안성본정형외과', '안성햇살의원'));
assert('self-exclusion matches hangul transliteration', isSelfBrandName('메이드인헤븐', 'Made in Heaven'));
assert('self-exclusion matches case variant', isSelfBrandName('MADE IN HEAVEN', 'Made in Heaven'));

const selfVariants = calculateUnifiedMarketSov(
	'Made in Heaven',
	'부산',
	'행사 섭외 에이전시',
	['MADE IN HEAVEN', '메이드인헤븐', 'Made in Heaven'],
	{ targetQuery: '행사 섭외 에이전시 추천', categoryName: '에이전시' },
);
assert(
	'self variants collapse to one client slot',
	selfVariants.leaderboard.filter((row) => row.isClient && !row.isThirdParty).length === 1,
	selfVariants.leaderboard,
);
assert(
	'self variants fill remaining ranks with distinct peers',
	selfVariants.leaderboard.filter((row) => !row.isClient && !row.isThirdParty).every((row) => !/made|heaven|메이드/i.test(row.name)) &&
		new Set(selfVariants.leaderboard.filter((row) => !row.isThirdParty).map((row) => row.name.replace(/\s+/g, '').toLowerCase())).size === 3,
	selfVariants.leaderboard,
);
assert(
	'statistical fallback uses search-listing label',
	statisticalFallbackNames('안성', '의원')[0] === '안성 1위 검색 노출처',
);

const liveSov = bindCompetitorSov({
	clientName: '안성햇살의원',
	region: '안성',
	mainService: '도수치료',
	categoryName: '의원',
	realNames: ['안성본정형외과', '안성튼튼재활의학과'],
	source: 'naver',
});
assert(
	'live SoV leader is competitor-pool * 0.62',
	liveSov.competitors[0]?.share === Math.round((100 - liveSov.directoryShare) * SOV_LEADER_RESIDUAL_RATIO),
);
assert(
	'live SoV runner is remainder of competitor pool',
	liveSov.competitors[1]?.share === 100 - liveSov.directoryShare - liveSov.competitors[0].share,
);
assert('live SoV brand share is 0 without GEO', liveSov.brandShare === 0);
assert('live SoV marks real names', liveSov.competitors[0]?.isRealData === true && liveSov.competitors[1]?.isRealData === true);
assert('live SoV uses real listing names', liveSov.competitors[0]?.name === '안성본정형외과');

const bound = computeShareOfVoice({
	brandName: '안성햇살의원',
	location: '안성',
	primaryKeyword: '도수치료',
	industryType: 'medical',
	lang: 'ko',
	competitors: liveSov.competitors.map((row) => ({
		name: row.name,
		weight: row.share,
		isRealData: row.isRealData,
	})),
	targetQuery: liveSov.targetQuery,
	lossInsight: liveSov.lossInsight,
});
const boundShares = resolveKeywordSovShares(liveSov.targetQuery);
assert('bound SoV uses 2 live competitors', bound.competitorCount === 2 && bound.hasRealCompetitorData);
assert('bound leader follows keyword table', bound.leaderSharePct === boundShares.rank1, String(bound.leaderSharePct));
assert('bound own share follows keyword table', bound.ownSharePct === boundShares.own, String(bound.ownSharePct));
assert('bound first ranking name is a live listing', Boolean(bound.shares.find((row) => !row.isOwn && !row.isDirectory)?.name) && !bound.shares.find((row) => !row.isOwn && !row.isDirectory)?.name.startsWith('경쟁 A사'));
assert('bound to-be follows keyword table', bound.toBeShare === boundShares.targetSov, String(bound.toBeShare));
assert(
	'bound vulnerability names leader share',
	bound.vulnerabilityInsight?.includes(`${bound.leaderSharePct}%`) === true,
);

const insight = buildVulnerabilityInsight({
	leaderName: '안성본정형외과',
	leaderShare: 70,
	toBeShare: 45,
	reclaimPotential: 42,
});
assert('vulnerability template includes structured-data goal', insight.includes('구조화 데이터') && insight.includes('목표로 최적화'));
assert('vulnerability template includes recapture target', insight.includes('45%'));
assert('vulnerability template includes leader share', insight.includes('70%'));

const fallbackBound = bindCompetitorSov({
	clientName: '안성햇살의원',
	region: '안성',
	mainService: '도수치료',
	realNames: [],
	source: 'fallback',
});
assert(
	'empty API fills non-self category or listing names',
	Boolean(fallbackBound.competitors[0]?.name) && !isSelfBrandName(fallbackBound.competitors[0]?.name || '', '안성햇살의원'),
	fallbackBound.competitors[0]?.name,
);
assert('empty API is not real data', fallbackBound.source === 'fallback' && !fallbackBound.competitors[0]?.isRealData);

const market = ['안성햇살의원', '안성본정형외과', '안성튼튼재활의학과'];
const geoEmpty = { entityScore: 0, ragScore: 0, hasSchema: false };
const firstPlace = calculateSymmetricSov('안성햇살의원', '안성', '도수치료', market, geoEmpty);
const secondPlace = calculateSymmetricSov('안성본정형외과', '안성', '도수치료', market, geoEmpty);
const thirdPlace = calculateSymmetricSov('안성튼튼재활의학과', '안성', '도수치료', market, geoEmpty);
const firstPie = allocateSymmetricCitationPie(0, RANK_1_SHARE);
const secondPie = allocateSymmetricCitationPie(1, RANK_2_SHARE);
assert('symmetric #1 as-is is client at rank 1', firstPlace.clientRank === 1 && firstPlace.asIsShare >= 20);
assert('symmetric #2 as-is is client at rank 2', secondPlace.asIsShare > 0 && secondPlace.clientRank === 2);
assert('symmetric #3 as-is is client at rank 3', thirdPlace.asIsShare > 0 && thirdPlace.clientRank === 3);
assert('symmetric #1 keeps client in slot 1', firstPlace.leaderboard[0]?.isClient === true && firstPlace.leaderboard[0]?.share === firstPlace.asIsShare);
assert('symmetric #1 assigns remaining share to live peers', Boolean(firstPlace.competitors[0]?.name) && !firstPlace.competitors[0]?.name.startsWith('경쟁'));
assert('symmetric #2 assigns #1 the live leader name', Boolean(secondPlace.competitors[0]?.name) && !secondPlace.competitors[0]?.name.startsWith('경쟁 A사'));
assert(
	'symmetric pies stay independent per audited brand',
	firstPlace.asIsShare !== secondPlace.asIsShare || firstPlace.brandName !== secondPlace.brandName,
);
assert('symmetric #1 gap is 0', firstPlace.gapToLeader === 0);
assert('symmetric #2 gap is positive', secondPlace.gapToLeader > 0);
assert(
	'symmetric #1 pie is 100',
	firstPlace.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100,
);
assert(
	'symmetric #2 pie is 100',
	secondPlace.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100,
);
assert('symmetric #1 competitor is not dominant', firstPlace.competitors[0]?.isDominant === false);
assert('symmetric #2 competitor is dominant', secondPlace.competitors[0]?.isDominant === true);

const rankedSov = computeShareOfVoice({
	brandName: '안성햇살의원',
	location: '안성',
	primaryKeyword: '도수치료',
	industryType: 'medical',
	lang: 'ko',
	rawSearchResults: market,
	geoReadinessScore: geoEmpty,
});
assert('ranked SoV client is #1', rankedSov.clientRank === 1 && rankedSov.asIsShare >= 20);
assert('ranked SoV leader competitor is the next live listing', rankedSov.leaderSharePct > 0 && rankedSov.leaderSharePct < rankedSov.asIsShare);
assert('ranked SoV gap is 0 when client leads', rankedSov.gapToLeader === 0);
assert('ranked SoV shares sum to 100', rankedSov.shares.reduce((acc, row) => acc + row.sharePct, 0) === 100);
assert('ranked SoV leaderboard includes client', rankedSov.leaderboard.some((row) => row.isClient && row.rank === 1));

const unifiedOutside = calculateUnifiedMarketSov('안성햇살의원', '안성', '도수치료', ['안성본정형외과', '안성튼튼재활의학과', '안성바른의원']);
assert('unified outside clientRank is 4', unifiedOutside.clientRank === CLIENT_UNRANKED_RANK);
assert('unified outside as-is is 5-15', unifiedOutside.asIsShare >= 5 && unifiedOutside.asIsShare <= 15);
assert('unified outside to-be exceeds as-is', unifiedOutside.toBeShare > unifiedOutside.asIsShare);
assert('unified outside reclaim is to-be minus as-is', unifiedOutside.reclaimGain === unifiedOutside.toBeShare - unifiedOutside.asIsShare);
assert('unified outside keeps top 2 live names', Boolean(unifiedOutside.leaderboard[0]?.name) && !unifiedOutside.leaderboard[0]?.isClient && !unifiedOutside.leaderboard[0]?.name.startsWith('경쟁 A사'));
assert('unified outside replaces #3 with client', unifiedOutside.leaderboard[2]?.isClient === true && unifiedOutside.leaderboard[2]?.name.includes('순위 밖'));

const unifiedFirst = calculateUnifiedMarketSov('안성햇살의원', '안성', '도수치료', ['안성햇살의원', '안성본정형외과', '안성튼튼재활의학과']);
assert('unified #1 to-be exceeds as-is', unifiedFirst.toBeShare > unifiedFirst.asIsShare && unifiedFirst.clientRank === 1);
assert('unified #1 reclaim is to-be minus as-is', unifiedFirst.reclaimGain === unifiedFirst.toBeShare - unifiedFirst.asIsShare);
assert('unified #1 keeps client in live slot', unifiedFirst.clientRank === 1 && unifiedFirst.leaderboard[0]?.isClient === true);
assert('unified #1 shows live competitors after the client', !unifiedFirst.leaderboard[1]?.isClient && unifiedFirst.leaderboard[1]?.share > 0);

const unifiedFourth = calculateUnifiedMarketSov(
	'안성햇살의원',
	'안성',
	'도수치료',
	['안성본정형외과', '안성튼튼재활의학과', '안성바른의원', '안성햇살의원', '안성열린의원'],
);
assert('unified #4 clientRank is 4', unifiedFourth.clientRank === 4 && unifiedFourth.asIsShare >= 5 && unifiedFourth.asIsShare <= 15);
assert('unified #4 keeps live #1 and #2', Boolean(unifiedFourth.leaderboard[0]?.name) && !unifiedFourth.leaderboard[0]?.isClient && !unifiedFourth.leaderboard[0]?.name.startsWith('경쟁 A사'));
assert('unified #4 labels actual rank', unifiedFourth.leaderboard[2]?.isClient === true && unifiedFourth.leaderboard[2]?.name.includes('4위'));

const presets = buildSovQueryPresets('안성', '도수치료', '추나치료');
assert('preset1 is region + mainService + 추천', presets[0] === '안성 도수치료 추천', presets);
assert('preset2 is region + subService', presets[1] === '안성 추나치료', presets);
assert('preset3 is region + subService + 잘하는곳', presets[2] === '안성 추나치료 잘하는곳', presets);
const presetsFallback = buildSovQueryPresets('안성', '도수치료');
assert('preset3 falls back to 도수치료', presetsFallback[2] === '안성 도수치료 잘하는곳', presetsFallback);
const enPresets = buildSovQueryPresets('Gangnam', 'physical therapy', 'manual therapy', 'en');
assert('en preset1 uses recommended', enPresets[0] === 'Gangnam physical therapy recommended', enPresets);
assert('en preset3 uses best-in', enPresets[2] === 'best manual therapy in Gangnam', enPresets);

const customQuerySov = bindCompetitorSov({
	clientName: '안성햇살의원',
	region: '안성',
	mainService: '도수치료',
	categoryName: '의원',
	realNames: ['안성본정형외과', '안성튼튼재활의학과'],
	source: 'naver',
	targetQuery: '안성 도수치료 잘하는곳',
});
assert('bindCompetitorSov honors custom targetQuery', customQuerySov.targetQuery === '안성 도수치료 잘하는곳');

const industryCtx = {
	categoryName: 'dermatology_clinic',
	mainService: '피부미용',
	region: '대구 동구',
	query: '대구 동구 메리어트 2층',
};
assert('marriott floor is a place query', looksLikePlaceOrBuildingQuery('대구 동구 메리어트 2층'));
assert(
	'place query rewrites to regional dermatology search',
	rewriteSovSearchQuery('대구 동구 메리어트 2층', industryCtx) === '대구 동구 피부과',
	rewriteSovSearchQuery('대구 동구 메리어트 2층', industryCtx),
);
assert(
	'industry guard drops hotel and buffet names',
	filterIndustryNames(['대구 메리어트 호텔', '어반키친', '나인원의원', '메리어트피부과'], industryCtx).join('|') ===
		'나인원의원|메리어트피부과',
);

const marriottBound = bindCompetitorSov({
	clientName: '나인원의원',
	region: '대구 동구',
	mainService: '피부미용',
	categoryName: 'dermatology_clinic',
	realNames: ['대구 메리어트 호텔', '어반키친', '나인원의원'],
	source: 'naver',
	targetQuery: '대구 동구 메리어트 2층',
	brandAliases: ['나인원', 'nineoneclinic'],
});
assert('marriott bind keeps display query', marriottBound.targetQuery === '대구 동구 메리어트 2층');
assert('marriott bind ranks the clinic first', marriottBound.clientRank === 1);
assert(
	'marriott bind competitors are clinics',
	marriottBound.competitors.every((row) => /의원|클리닉|피부과/.test(row.name) && !/호텔|키친|뷔페/.test(row.name)),
	marriottBound.competitors.map((row) => row.name).join(' / '),
);

const fromSchema = resolveTargetIndustry({
	schemaTypes: ['MedicalBusiness'],
	categoryName: 'dermatology_clinic',
	mainService: '피부미용',
});
assert('schema MedicalBusiness resolves medical', fromSchema.type === 'medical' && /Dermatology/i.test(fromSchema.label), fromSchema.label);
const legalIndustry = resolveTargetIndustry({ schemaTypes: ['LegalService'], mainService: '법률 상담' });
assert('schema LegalService resolves legal', legalIndustry.type === 'legal' && /Law Firm/i.test(legalIndustry.label), legalIndustry.label);
assert(
	'legal building query rewrites to regional law search',
	/법률|법무/.test(
		rewriteSovSearchQuery('강남 센터원 12층', {
			schemaTypes: ['LegalService'],
			mainService: '법률 상담',
			region: '서울 강남',
			industryType: 'legal',
		}),
	),
	rewriteSovSearchQuery('강남 센터원 12층', {
		schemaTypes: ['LegalService'],
		mainService: '법률 상담',
		region: '서울 강남',
		industryType: 'legal',
	}),
);
assert(
	'legal guard drops realtor and tax office',
	filterIndustryNames(['강남부동산', '세무법인 한빛', '법무법인 광장'], {
		industryType: 'legal',
		schemaTypes: ['LegalService'],
		mainService: '법률 상담',
	}).join('|') === '법무법인 광장',
);
const prompt = buildSovIndustryPromptGuide(
	{ schemaTypes: ['MedicalBusiness'], categoryName: 'dermatology_clinic', mainService: '피부미용' },
	'대구 동구 메리어트 2층',
);
assert('universal prompt names targetIndustry', /주요 업종: Medical \/ Dermatology/i.test(prompt), prompt);
assert('universal prompt names the query', prompt.includes('대구 동구 메리어트 2층'));

assert(
	'niche token strips region and category',
	extractNicheItemTokens('대구 동구 울트라클리어엘리트 추천', {
		region: '대구 동구',
		mainService: '피부미용',
		productTokens: ['울트라클리어엘리트'],
	}).includes('울트라클리어엘리트'),
);
assert(
	'offering match is true when the site lists the device',
	resolveNicheOfferingMatch({
		query: '대구 동구 울트라클리어엘리트 추천',
		productTokens: ['울트라클리어엘리트', '덴서티'],
	}).hasNicheItem === true,
);
assert(
	'offering match is false when the site lacks the device',
	resolveNicheOfferingMatch({
		query: '서울 강남 덴서티 추천',
		productTokens: ['울트라클리어엘리트'],
	}).hasNicheItem === false,
);
assert(
	'generic clinics without the device are dropped',
	filterGenericNonNicheNames(['준피부과의원', '울트라클리어엘리트센터', '미담한의원'], ['울트라클리어엘리트']).join('|') ===
		'울트라클리어엘리트센터',
);
const nichePrompt = buildSovNichePromptGuide({
	query: '대구 동구 울트라클리어엘리트 추천',
	productTokens: ['울트라클리어엘리트'],
});
assert('niche prompt forbids generic brand ranking', /일반 브랜드/.test(nichePrompt) && /1위/.test(nichePrompt));

assert('sample mock pies were removed', Object.keys(SOV_SAMPLE_DATA).length === 0);
assert('default table is a computed generic pie', DEFAULT_SOV_SHARE_TABLE.own + DEFAULT_SOV_SHARE_TABLE.rank1 + DEFAULT_SOV_SHARE_TABLE.rank2 + DEFAULT_SOV_SHARE_TABLE.thirdParty === 100);

const brandTokens = ['스카이피부과의원', '스카이'];
const brandQueryShares = resolveKeywordSovShares('부산 동래 스카이피부과의원', { brandTokens, brandName: '스카이피부과의원' });
const genericQueryShares = resolveKeywordSovShares('부산 동래 피부과 추천', { brandTokens, brandName: '스카이피부과의원', clientRank: 4 });
assert('brand query own is 85-95', brandQueryShares.own >= 85 && brandQueryShares.clientRank === 1);
assert('generic recommend is not the old 27/16/5 mock', genericQueryShares.own !== 5 || genericQueryShares.rank1 !== 27);
assert('generic third-party is 40-60', genericQueryShares.thirdParty >= 40 && genericQueryShares.thirdParty <= 60);

const keywordMarket = ['동래준피부과의원', '미담한의원 동래', '작은거인한의원'];
const baseKeywordSov = calculateUnifiedMarketSov('스카이피부과의원', '부산 동래', '피부과', keywordMarket, {
	targetQuery: '부산 동래 스카이피부과의원',
	brandAliases: brandTokens,
});
const recommendKeywordSov = calculateUnifiedMarketSov('스카이피부과의원', '부산 동래', '피부과', keywordMarket, {
	targetQuery: '부산 동래 피부과 추천',
	brandAliases: brandTokens,
});
const bestKeywordSov = calculateUnifiedMarketSov('스카이피부과의원', '부산 동래', '피부과', keywordMarket, {
	targetQuery: '부산 동래 피부시술 잘하는곳',
	brandAliases: brandTokens,
});
assert('keyword brand query is rank 1', baseKeywordSov.clientRank === 1 && baseKeywordSov.asIsShare >= 85);
assert('keyword brand client sits in slot 1', baseKeywordSov.leaderboard[0]?.isClient === true);
assert('keyword recommend stays generic unranked', recommendKeywordSov.clientRank >= 3 && recommendKeywordSov.asIsShare <= 15);
assert(
	'keyword pies stay at 100',
	baseKeywordSov.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100 &&
		bestKeywordSov.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100,
);
assert('keyword shares differ across brand vs category tabs', baseKeywordSov.asIsShare !== recommendKeywordSov.asIsShare);

const rebound = applyKeywordSovToDynamic(
	unifiedToDynamicSov(recommendKeywordSov, { lang: 'ko', brandAliases: brandTokens }),
	'부산 동래 스카이피부과의원',
	{ region: '부산 동래', mainService: '피부과', lang: 'ko', brandAliases: brandTokens, targetSiteName: '스카이피부과의원' },
);
assert('applyKeywordSovToDynamic rebinds brand query to rank 1', rebound.clientRank === 1 && rebound.asIsShare >= 85);
assert('applyKeywordSovToDynamic does not invent 경쟁 A사', !rebound.leaderboard.some((row) => /경쟁\s*[AB]사/.test(row.name)));
assert('applyKeywordSovToDynamic updates insight percents', rebound.lossInsight.includes(`${rebound.asIsShare}%`));
assert(
	'applyKeywordSovToDynamic binds lossInsight to the selected keyword, not mainService',
	rebound.lossInsight.includes('"부산 동래 스카이피부과의원"') && !rebound.lossInsight.includes('"피부과"'),
);

const otherKeywordBound = applyKeywordSovToDynamic(
	unifiedToDynamicSov(recommendKeywordSov, { lang: 'ko', brandAliases: brandTokens }),
	'부산 동래 피부시술 잘하는곳',
	{ region: '부산 동래', mainService: '피부과', lang: 'ko', brandAliases: brandTokens, targetSiteName: '스카이피부과의원' },
);
assert(
	'switching keyword chips re-syncs the summary text to the new keyword',
	otherKeywordBound.lossInsight.includes('"부산 동래 피부시술 잘하는곳"') &&
		!otherKeywordBound.lossInsight.includes(rebound.lossInsight),
);

assert(
	'soften 울트라클리어엘리트 잘하는 곳',
	softenComparativeQuery('대구 울트라클리어엘리트 잘하는 곳') === '대구 울트라클리어엘리트 도입 안내',
);
assert(
	'soften 울트라클리어엘리트 후기',
	softenComparativeQuery('대구 울트라클리어엘리트 후기') === '대구 울트라클리어엘리트 시스템 안내',
);
assert(
	'soften 성형외과 잘하는 곳',
	softenComparativeQuery('대구 성형외과 잘하는 곳') === '대구 성형외과 위치 및 진료시간 안내',
);
assert(
	'soften 치료 솔루션 추천',
	softenComparativeQuery('대구에서 치료 솔루션 의원 잘하는 곳 추천해줘') ===
		'대구에서 정밀 진료 시스템 갖춘 곳 안내해줘',
);
assert('soften token 잘하는 곳', softenQueryToken('잘하는 곳') === '안내');
assert('soften token 후기', softenQueryToken('후기') === '정보 안내');
assert(
	'soften combo + 후기',
	softenComparativeQuery('대구 + 성형외과 + 후기') === '대구 + 성형외과 + 정보 안내',
);

const dirtyPrimaryKeywordMetrics = computeAdvancedGeoMetrics({
	lang: 'ko',
	brandName: '마음반려동물의료원',
	primaryKeyword: '병원장 인사말 병원 둘러보기 반려동물 병원',
	location: '수원',
});
const dirtyTargetQuery = dirtyPrimaryKeywordMetrics.shareOfVoice.targetQuery || '';
assert(
	'targetQuery strips GNB chrome from a dirty primaryKeyword',
	!/인사말|둘러보기/.test(dirtyTargetQuery),
	dirtyTargetQuery,
);
assert(
	'targetQuery never repeats 병원',
	(dirtyTargetQuery.match(/병원/g) || []).length <= 1,
	dirtyTargetQuery,
);
assert(
	'targetQuery stays within 2-5 tokens',
	(() => {
		const count = dirtyTargetQuery.split(/\s+/).filter(Boolean).length;
		return count >= 2 && count <= 5;
	})(),
	dirtyTargetQuery,
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');
