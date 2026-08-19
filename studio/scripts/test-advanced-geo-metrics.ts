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
assert('dynamic empty as-is is 5', dynamicEmpty.asIsShare === RANK_3_SHARE);
assert('dynamic empty clientRank is 4', dynamicEmpty.clientRank === CLIENT_UNRANKED_RANK);
assert('dynamic empty keeps top 2 anonymized names', dynamicEmpty.leaderboard[0]?.name.startsWith('경쟁 A사') && dynamicEmpty.leaderboard[1]?.name?.startsWith('경쟁 B사'));
assert('dynamic empty maps client into #3 slot', emptyClient?.rank === 3 && emptyClient.name.includes('순위 밖'));
assert('dynamic empty leader is 27', dynamicEmpty.competitors[0]?.share === RANK_1_SHARE);
assert('dynamic empty runner is 16', dynamicEmpty.competitors[1]?.share === RANK_2_SHARE);
assert('dynamic empty directory is 52', emptyDirectory?.share === THIRD_PARTY_SHARE && emptyDirectory.isDirectory === true);
assert('dynamic empty to-be in 48-55', dynamicEmpty.toBeShare >= TO_BE_SHARE_MIN && dynamicEmpty.toBeShare <= TO_BE_SHARE_MAX);
assert('dynamic empty gap is 27 - 5', dynamicEmpty.gapToLeader === RANK_1_SHARE - RANK_3_SHARE);
assert('dynamic empty reclaim is to-be - as-is', dynamicEmpty.reclaimGain === dynamicEmpty.toBeShare - dynamicEmpty.asIsShare);
assert(
	'dynamic empty pie is 100',
	dynamicEmpty.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100,
);
assert('dynamic target query includes 추천', dynamicEmpty.targetQuery === '안성 도수치료 추천');
assert(
	'dynamic empty vulnerability names share and to-be',
	dynamicEmpty.vulnerabilityInsight.includes(`${RANK_1_SHARE}%`) &&
		dynamicEmpty.vulnerabilityInsight.includes(`${dynamicEmpty.toBeShare}%`),
);
assert('dynamic empty loss names directory leakage', dynamicEmpty.lossInsight.includes(`${THIRD_PARTY_SHARE}%`));

const dynamicFull = calculateDynamicSov('안성햇살의원', '안성', '도수치료', ['안성본정형외과'], {
	entityScore: 100,
	ragScore: 100,
	hasSchema: true,
});
assert('dynamic full as-is is unranked 5', dynamicFull.asIsShare === RANK_3_SHARE);
assert('dynamic full to-be caps at 55', dynamicFull.toBeShare <= TO_BE_SHARE_MAX);
assert('dynamic full uses anonymized name', dynamicFull.competitors[0]?.name.startsWith('경쟁 A사') && dynamicFull.competitors[0]?.isRealData === true);
assert('dynamic full fallback 2nd name', Boolean(dynamicFull.competitors[1]?.name) && dynamicFull.competitors[1]?.isRealData !== true);

const stripped = calculateDynamicSov(
	'안성햇살의원',
	'안성',
	'도수치료',
	['<b>안성</b>햇살의원', '<b>안성</b>본정형외과', '안성튼튼재활의학과'],
	{ entityScore: 0, ragScore: 0, hasSchema: false },
);
assert('dynamic strips Naver <b> tags', stripped.leaderboard[0]?.name === '안성햇살의원' && stripped.leaderboard[1]?.name?.startsWith('경쟁 B사'));
assert('dynamic keeps client in live #1 slot', stripped.leaderboard[0]?.isClient === true && stripped.asIsShare === RANK_1_SHARE);

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
assert('interior fallback uses anonymized competitor label', interiorGap.competitors[0]?.name.startsWith('경쟁 A사'));

const sov = computeShareOfVoice({
	brandName: '센텀우리내과',
	location: '부산 센텀',
	industryType: 'medical',
	lang: 'ko',
});
const sovSum = sov.shares.reduce((acc, row) => acc + row.sharePct, 0);
assert('own share without listings is unranked 5', sov.ownSharePct === RANK_3_SHARE && sov.asIsShare === RANK_3_SHARE);
assert('competitor count is 2', sov.competitorCount === 2);
assert('shares sum to 100', sovSum === 100, String(sovSum));
assert('own row is on the leaderboard', sov.shares.some((row) => row.isOwn));
assert('directory share is reserved', sov.directoryShare === THIRD_PARTY_SHARE);
assert(
	'ranking competitors take leftover pool',
	sov.shares.filter((row) => !row.isOwn && !row.isDirectory).reduce((acc, row) => acc + row.sharePct, 0) ===
		100 - sov.asIsShare - sov.directoryShare,
);
assert('unlisted leader is 27', sov.leaderSharePct === RANK_1_SHARE, String(sov.leaderSharePct));
assert('gap equals leader minus as-is', sov.gapToLeader === sov.leaderSharePct - sov.asIsShare);
assert('to-be in 48-55', sov.toBeShare >= TO_BE_SHARE_MIN && sov.toBeShare <= TO_BE_SHARE_MAX);
assert(
	'sov vulnerability insight is generated',
	Boolean(sov.vulnerabilityInsight?.includes(`${sov.toBeShare}%`)),
);

const gangnam = computeShareOfVoice({ location: '강남', industryType: 'beauty', lang: 'ko' });
assert('SoV always uses 2 ranking competitors', gangnam.competitorCount === 2, String(gangnam.competitorCount));
assert(
	'fallback names use anonymized competitor labels',
	gangnam.shares.some((row) => !row.isOwn && row.name.startsWith('경쟁 A사')),
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
assert('geo-scored empty as-is is unranked 5', geoScored.asIsShare === RANK_3_SHARE);
assert('geo-scored leader is 27', geoScored.leaderSharePct === RANK_1_SHARE, String(geoScored.leaderSharePct));
assert('geo-scored insight includes directory leakage', geoScored.lossInsight?.includes(`${THIRD_PARTY_SHARE}%`) === true);

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
assert('live SoV uses anonymized names', liveSov.competitors[0]?.name.startsWith('경쟁 A사'));

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
assert('bound first ranking name is anonymized', bound.shares.find((row) => !row.isOwn && !row.isDirectory)?.name.startsWith('경쟁 A사'));
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
assert('symmetric #1 as-is is 27', firstPlace.asIsShare === RANK_1_SHARE && firstPlace.clientRank === 1);
assert('symmetric #2 as-is is 16', secondPlace.asIsShare === RANK_2_SHARE && secondPlace.clientRank === 2);
assert('symmetric #3 as-is is 5', thirdPlace.asIsShare === RANK_3_SHARE && thirdPlace.clientRank === 3);
assert('symmetric #1 keeps client in slot 1', firstPlace.leaderboard[0]?.isClient === true && firstPlace.leaderboard[0]?.share === RANK_1_SHARE);
assert('symmetric #1 assigns #2 the runner share', firstPlace.competitors[0]?.name?.startsWith('경쟁 B사') && firstPlace.competitors[0]?.share === RANK_2_SHARE);
assert('symmetric #2 assigns #1 the leader share', secondPlace.competitors[0]?.name.startsWith('경쟁 A사') && secondPlace.competitors[0]?.share === RANK_1_SHARE);
assert(
	'symmetric pies match whoever is audited',
	firstPlace.asIsShare === secondPlace.competitors[0]?.share &&
		secondPlace.asIsShare === firstPlace.competitors[0]?.share,
);
assert('symmetric #1 gap is 0', firstPlace.gapToLeader === 0);
assert('symmetric #2 gap is 11', secondPlace.gapToLeader === RANK_1_SHARE - RANK_2_SHARE);
assert(
	'symmetric #1 pie is 100',
	firstPlace.asIsShare + firstPie.comp1Share + firstPie.comp2Share + firstPie.directoryShare === 100,
);
assert(
	'symmetric #2 pie is 100',
	secondPlace.asIsShare + secondPie.comp1Share + secondPie.comp2Share + secondPie.directoryShare === 100,
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
assert('ranked SoV client is #1 at 27', rankedSov.asIsShare === RANK_1_SHARE && rankedSov.clientRank === 1);
assert('ranked SoV leader competitor is #2 at 16', rankedSov.leaderSharePct === RANK_2_SHARE);
assert('ranked SoV gap is 0 when client leads', rankedSov.gapToLeader === 0);
assert('ranked SoV shares sum to 100', rankedSov.shares.reduce((acc, row) => acc + row.sharePct, 0) === 100);
assert('ranked SoV leaderboard includes client', rankedSov.leaderboard.some((row) => row.isClient && row.rank === 1));

const unifiedOutside = calculateUnifiedMarketSov('안성햇살의원', '안성', '도수치료', ['안성본정형외과', '안성튼튼재활의학과', '안성바른의원']);
assert('unified outside clientRank is 4', unifiedOutside.clientRank === CLIENT_UNRANKED_RANK);
assert('unified outside as-is is 5', unifiedOutside.asIsShare === RANK_3_SHARE);
assert('unified outside to-be is 48', unifiedOutside.toBeShare === TO_BE_SHARE_MIN);
assert('unified outside reclaim is 43', unifiedOutside.reclaimGain === TO_BE_SHARE_MIN - RANK_3_SHARE);
assert('unified outside keeps top 2', unifiedOutside.leaderboard[0]?.name.startsWith('경쟁 A사') && unifiedOutside.leaderboard[1]?.name?.startsWith('경쟁 B사'));
assert('unified outside replaces #3 with client', unifiedOutside.leaderboard[2]?.isClient === true && unifiedOutside.leaderboard[2]?.name.includes('순위 밖'));

const unifiedFirst = calculateUnifiedMarketSov('안성햇살의원', '안성', '도수치료', ['안성햇살의원', '안성본정형외과', '안성튼튼재활의학과']);
assert('unified #1 to-be is 55', unifiedFirst.toBeShare === TO_BE_SHARE_MAX && unifiedFirst.asIsShare === RANK_1_SHARE);
assert('unified #1 reclaim is 28', unifiedFirst.reclaimGain === TO_BE_SHARE_MAX - RANK_1_SHARE);
assert('unified #1 keeps client in live slot', unifiedFirst.clientRank === 1 && unifiedFirst.leaderboard[0]?.isClient === true);
assert('unified #1 shows competitors at 16 and 5', unifiedFirst.leaderboard[1]?.share === RANK_2_SHARE && unifiedFirst.leaderboard[2]?.share === RANK_3_SHARE && !unifiedFirst.leaderboard[1]?.isClient);

const unifiedFourth = calculateUnifiedMarketSov(
	'안성햇살의원',
	'안성',
	'도수치료',
	['안성본정형외과', '안성튼튼재활의학과', '안성바른의원', '안성햇살의원', '안성열린의원'],
);
assert('unified #4 clientRank is 4', unifiedFourth.clientRank === 4 && unifiedFourth.asIsShare === RANK_3_SHARE);
assert('unified #4 keeps live #1 and #2', unifiedFourth.leaderboard[0]?.name.startsWith('경쟁 A사') && unifiedFourth.leaderboard[1]?.name?.startsWith('경쟁 B사'));
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

const sampleBase = SOV_SAMPLE_DATA['#부산 동래 피부과'];
const sampleRecommend = SOV_SAMPLE_DATA['#부산 동래 피부과 추천'];
const sampleBest = SOV_SAMPLE_DATA['#부산 동래 피부시술 잘하는곳'];
assert('sample recommend matches default baseline', sampleRecommend.rank1.share === DEFAULT_SOV_SHARE_TABLE.rank1 && sampleRecommend.thirdPartyShare === DEFAULT_SOV_SHARE_TABLE.thirdParty);
assert(
	'sample keywords have distinct pies',
	sampleBase.rank1.share !== sampleRecommend.rank1.share &&
		sampleBest.currentSov !== sampleRecommend.currentSov &&
		sampleBase.targetSov !== sampleBest.targetSov,
);
assert(
	'sample pies sum to 100',
	sampleBase.rank1.share + sampleBase.rank2.share + sampleBase.currentSov + sampleBase.thirdPartyShare === 100 &&
		sampleBest.rank1.share + sampleBest.rank2.share + sampleBest.currentSov + sampleBest.thirdPartyShare === 100,
);

const hashedBase = resolveKeywordSovShares('#부산 동래 피부과');
assert('hash lookup honors sample base', hashedBase.rank1 === 31 && hashedBase.own === 4 && hashedBase.thirdParty === 46 && hashedBase.targetSov === 45 && hashedBase.potentialGain === 41);
assert('recommend intent keeps 27/16/5/52', resolveKeywordSovShares('안성 도수치료 추천').rank1 === 27 && resolveKeywordSovShares('안성 도수치료 추천').thirdParty === 52);

const keywordMarket = ['동래준피부과의원', '미담한의원 동래', '작은거인한의원'];
const baseKeywordSov = calculateUnifiedMarketSov('스카이피부과의원', '부산 동래', '피부과', keywordMarket, {
	targetQuery: '부산 동래 피부과',
});
const recommendKeywordSov = calculateUnifiedMarketSov('스카이피부과의원', '부산 동래', '피부과', keywordMarket, {
	targetQuery: '부산 동래 피부과 추천',
});
const bestKeywordSov = calculateUnifiedMarketSov('스카이피부과의원', '부산 동래', '피부과', keywordMarket, {
	targetQuery: '부산 동래 피부시술 잘하는곳',
});
assert('keyword base as-is is 4', baseKeywordSov.asIsShare === 4 && baseKeywordSov.toBeShare === 45 && baseKeywordSov.reclaimGain === 41);
assert('keyword base leader is 31', baseKeywordSov.leaderboard[0]?.share === 31 && baseKeywordSov.leaderboard[1]?.share === 19);
assert('keyword base directory is 46', baseKeywordSov.leaderboard.find((row) => row.isThirdParty)?.share === 46);
assert('keyword recommend stays on baseline', recommendKeywordSov.asIsShare === 5 && recommendKeywordSov.toBeShare === 48 && recommendKeywordSov.reclaimGain === 43);
assert('keyword recommend leader is 27', recommendKeywordSov.leaderboard[0]?.share === 27 && recommendKeywordSov.leaderboard[1]?.share === 16);
assert('keyword best as-is is 7', bestKeywordSov.asIsShare === 7 && bestKeywordSov.toBeShare === 52 && bestKeywordSov.reclaimGain === 45);
assert('keyword best leader is 29', bestKeywordSov.leaderboard[0]?.share === 29 && bestKeywordSov.leaderboard[1]?.share === 18);
assert(
	'keyword pies stay at 100',
	baseKeywordSov.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100 &&
		bestKeywordSov.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100,
);
assert('keyword shares differ across tabs', baseKeywordSov.asIsShare !== recommendKeywordSov.asIsShare && recommendKeywordSov.toBeShare !== bestKeywordSov.toBeShare);

const rebound = applyKeywordSovToDynamic(
	unifiedToDynamicSov(recommendKeywordSov, { lang: 'ko' }),
	'부산 동래 피부과',
	{ region: '부산 동래', mainService: '피부과', lang: 'ko' },
);
assert('applyKeywordSovToDynamic rebinds percents instantly', rebound.asIsShare === 4 && rebound.toBeShare === 45 && rebound.directoryShare === 46 && rebound.reclaimGain === 41);
assert('applyKeywordSovToDynamic keeps anonymized competitor names', rebound.leaderboard[0]?.name.startsWith('경쟁 A사'));
assert('applyKeywordSovToDynamic updates insight percents', rebound.lossInsight.includes('4%') && rebound.lossInsight.includes('46%'));
assert(
	'applyKeywordSovToDynamic binds lossInsight to the selected keyword, not mainService',
	rebound.lossInsight.includes('"부산 동래 피부과"') && !rebound.lossInsight.includes('"피부과"'),
);

const otherKeywordBound = applyKeywordSovToDynamic(
	unifiedToDynamicSov(recommendKeywordSov, { lang: 'ko' }),
	'부산 동래 피부시술 잘하는곳',
	{ region: '부산 동래', mainService: '피부과', lang: 'ko' },
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

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall assertions passed');
