/**
 * Universal SoV leaderboard integrity — brand / specialized / generic intents.
 * Run: npx tsx scripts/test-sov-diagnostic.ts
 */
import {
	applyKeywordSovToDynamic,
	calculateUnifiedMarketSov,
	classifySovQueryIntent,
	resolveKeywordSovShares,
	unifiedToDynamicSov,
} from '../lib/audit/advancedGeoMetrics';
import {
	buildNineoneClinicSovDiagnosticDataset,
	didSovTableRefresh,
	isOutsideTop3,
	isThirdPartyMajority,
	logSovValidationResult,
	NINEONE_CLINIC_BRAND,
	NINEONE_CLINIC_SITE_URL,
	NINEONE_CLINIC_SOV_QUERIES,
	resolveDiagnosticSovPresets,
	resolveSovOwnBadgeTone,
	resolveSovUiTokens,
	shareTableToKeywordSlice,
	sovShareTableFingerprint,
	validateNineoneClinicSovDiagnostic,
	validateSovLeaderboardData,
} from '../lib/audit/sovDiagnosticValidation';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

const BRAND_TOKENS = [NINEONE_CLINIC_BRAND, '나인원', 'nineoneclinic', 'nineone'];
const shareOpts = { brandTokens: BRAND_TOKENS, brandName: NINEONE_CLINIC_BRAND };

const brandShares = resolveKeywordSovShares(NINEONE_CLINIC_SOV_QUERIES[0], shareOpts);
const specializedShares = resolveKeywordSovShares(NINEONE_CLINIC_SOV_QUERIES[1], shareOpts);
const genericShares = resolveKeywordSovShares(NINEONE_CLINIC_SOV_QUERIES[2], { ...shareOpts, clientRank: 4 });

assert('brand query is navigational', classifySovQueryIntent(NINEONE_CLINIC_SOV_QUERIES[0], BRAND_TOKENS) === 'navigational');
assert('equipment query is specialized', classifySovQueryIntent(NINEONE_CLINIC_SOV_QUERIES[1], BRAND_TOKENS) === 'specialized');
assert('category query is generic', classifySovQueryIntent(NINEONE_CLINIC_SOV_QUERIES[2], BRAND_TOKENS) === 'generic');

assert('navigational own is 85-95', brandShares.own >= 85 && brandShares.own <= 95, brandShares);
assert('navigational rank is 1', brandShares.clientRank === 1);
assert('navigational competitors stay under 5 each', brandShares.rank1 <= 5 && brandShares.rank2 <= 5);
assert('navigational third-party is 5-15', brandShares.thirdParty >= 5 && brandShares.thirdParty <= 15);
assert('navigational recapture is 0-10', brandShares.potentialGain >= 0 && brandShares.potentialGain <= 10);
assert(
	'navigational pie is 100',
	brandShares.rank1 + brandShares.rank2 + brandShares.own + brandShares.thirdParty === 100,
);

assert('specialized uncited own is 5-15', specializedShares.own >= 5 && specializedShares.own <= 15, specializedShares);
assert('generic third-party is 40-60', genericShares.thirdParty >= 40 && genericShares.thirdParty <= 60, genericShares);
assert(
	'generic pie is 100',
	genericShares.rank1 + genericShares.rank2 + genericShares.own + genericShares.thirdParty === 100,
);

const fingerprints = NINEONE_CLINIC_SOV_QUERIES.map((query) =>
	sovShareTableFingerprint(shareTableToKeywordSlice(resolveKeywordSovShares(query, shareOpts))),
);
assert('each intent yields a distinct pie', new Set(fingerprints).size === 3, fingerprints.join(' / '));

const dataset = buildNineoneClinicSovDiagnosticDataset();
const brandSlice = dataset.perKeyword?.[NINEONE_CLINIC_SOV_QUERIES[0]];
assert('diagnostic dataset includes brand query', dataset.keywords?.includes(NINEONE_CLINIC_SOV_QUERIES[0]));
assert('dataset brand own is 85+', (brandSlice?.currentSov ?? 0) >= 85);

const result = validateNineoneClinicSovDiagnostic({
	...dataset,
	currentSov: brandShares.own,
	targetSov: brandShares.targetSov,
	potentialGain: brandShares.potentialGain,
	rank1: brandShares.rank1,
	rank2: brandShares.rank2,
	thirdParty: brandShares.thirdParty,
	clientRank: 1,
	rankText: '1위',
	perKeyword: Object.fromEntries(
		NINEONE_CLINIC_SOV_QUERIES.map((query) => [
			query,
			shareTableToKeywordSlice(resolveKeywordSovShares(query, shareOpts)),
		]),
	),
	requireNineoneQueries: true,
});
logSovValidationResult(result);
assert('validator passes brand-aware dataset', result.valid, result.errors.map((issue) => issue.message).join(' | '));

const unifiedBrand = calculateUnifiedMarketSov(
	NINEONE_CLINIC_BRAND,
	'대구 동구',
	'울트라클리어엘리트',
	['동구피부과의원', '동대구역피부클리닉', '메리어트피부과'],
	{ targetQuery: NINEONE_CLINIC_SOV_QUERIES[0], brandAliases: BRAND_TOKENS },
);
assert('brand query forces clientRank 1', unifiedBrand.clientRank === 1);
assert('brand query own is 85+', unifiedBrand.asIsShare >= 85, unifiedBrand.asIsShare);
assert('brand query labels client as #1', unifiedBrand.leaderboard[0]?.isClient === true && unifiedBrand.leaderboard[0]?.rank === 1);
assert(
	'brand query pie is 100',
	unifiedBrand.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100,
);
assert('brand query does not use 경쟁 A사', !unifiedBrand.leaderboard.some((row) => /경쟁\s*[AB]사/.test(row.name)));

const unifiedGeneric = calculateUnifiedMarketSov(
	NINEONE_CLINIC_BRAND,
	'대구 동구',
	'피부미용',
	['동구피부과의원', '동대구역피부클리닉', '메리어트피부과'],
	{ targetQuery: NINEONE_CLINIC_SOV_QUERIES[2], brandAliases: BRAND_TOKENS },
);
assert('generic query keeps live unranked slot', unifiedGeneric.clientRank >= 3);
assert('generic own stays well below brand own', unifiedGeneric.asIsShare < 20 && unifiedGeneric.asIsShare < unifiedBrand.asIsShare);

const dynamic = unifiedToDynamicSov(unifiedGeneric, {
	targetSiteName: NINEONE_CLINIC_BRAND,
	brandAliases: BRAND_TOKENS,
});
const rebound = applyKeywordSovToDynamic(dynamic, NINEONE_CLINIC_SOV_QUERIES[0], {
	region: '대구 동구',
	mainService: '피부미용',
	targetSiteName: NINEONE_CLINIC_BRAND,
	brandAliases: BRAND_TOKENS,
});
assert('tab switch to brand query rebinds rank 1', rebound.clientRank === 1 && rebound.asIsShare >= 85);
assert('tab switch pie stays 100', rebound.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100);
assert('tab switch insight follows the brand query', rebound.lossInsight.includes('대구 나인원의원'));

const backToGeneric = applyKeywordSovToDynamic(rebound, NINEONE_CLINIC_SOV_QUERIES[2], {
	region: '대구 동구',
	mainService: '피부미용',
	targetSiteName: NINEONE_CLINIC_BRAND,
	brandAliases: BRAND_TOKENS,
});
assert(
	'tab switch back to generic refreshes the pie',
	didSovTableRefresh(
		{ rank1: rebound.leaderboard.find((row) => row.rank === 1 && !row.isClient)?.share ?? 0, rank2: rebound.leaderboard.find((row) => row.rank === 2)?.share ?? 0, currentSov: rebound.asIsShare, thirdParty: rebound.directoryShare, targetSov: rebound.toBeShare },
		{ rank1: backToGeneric.leaderboard.find((row) => row.rank === 1 && !row.isClient)?.share ?? 0, rank2: backToGeneric.leaderboard.find((row) => row.rank === 2)?.share ?? 0, currentSov: backToGeneric.asIsShare, thirdParty: backToGeneric.directoryShare, targetSov: backToGeneric.toBeShare },
	),
);

const presets = resolveDiagnosticSovPresets({
	brandName: NINEONE_CLINIC_BRAND,
	siteUrl: NINEONE_CLINIC_SITE_URL,
	location: '대구',
	fallback: ['동대구역 동구 피부미용', '대구 동구 울트라클리어엘리트 추천'],
});
assert('clinic presets lead with the brand query', /나인원/.test(presets[0]), presets);

const brokenSum = validateSovLeaderboardData({
	...dataset,
	currentSov: 10,
	targetSov: 35,
	potentialGain: 25,
	rank1: 25,
	rank2: 15,
	thirdParty: 40,
	clientRank: 4,
	perKeyword: undefined,
	requireNineoneQueries: false,
	keywords: [],
});
assert('sum mismatch is rejected', !brokenSum.valid && brokenSum.errors.some((issue) => issue.code === 'SHARE_SUM'));

assert('isOutsideTop3 honors rank 4', isOutsideTop3(4, '3위 밖'));
assert('isOutsideTop3 rejects rank 2', !isOutsideTop3(2, '2위'));
assert('unranked 5% tone is danger', resolveSovOwnBadgeTone({ clientRank: 4, currentSov: 5 }) === 'danger');
assert('ranked tone is ok', resolveSovOwnBadgeTone({ clientRank: 1, currentSov: 90 }) === 'ok');
assert('49% is not majority', !isThirdPartyMajority(49));
assert('ui tokens mark 52 as majority', resolveSovUiTokens({ clientRank: 4, currentSov: 10, thirdParty: 52 }).thirdPartyIsMajority);

const placeQuery = '대구 동구 메리어트 2층';
const hotelLeak = calculateUnifiedMarketSov(
	NINEONE_CLINIC_BRAND,
	'대구 동구',
	'피부미용',
	['대구 메리어트 호텔', '어반키친', NINEONE_CLINIC_BRAND],
	{
		targetQuery: placeQuery,
		categoryName: 'dermatology_clinic',
		brandAliases: BRAND_TOKENS,
	},
);
const hotelLeakNames = hotelLeak.leaderboard.filter((row) => !row.isThirdParty).map((row) => row.name);
assert(
	'place query drops hotel and buffet',
	!hotelLeakNames.some((name) => /호텔|메리어트(?!.*(?:의원|피부과|클리닉))|키친|뷔페|어반/i.test(name)),
	hotelLeakNames.join(' / '),
);
assert(
	'place query keeps the clinic as #1 when no other clinic is in the building',
	hotelLeak.leaderboard[0]?.isClient === true && hotelLeak.leaderboard[0]?.name.includes('나인원'),
	hotelLeak.leaderboard[0]?.name,
);
assert(
	'place monopoly grants 80-95 own share',
	hotelLeak.placeMonopoly === true && hotelLeak.asIsShare >= 80 && hotelLeak.asIsShare <= 95,
	String(hotelLeak.asIsShare),
);
assert(
	'place query fills nearby dermatology peers',
	hotelLeak.leaderboard.filter((row) => !row.isClient && !row.isThirdParty).every((row) => /의원|클리닉|피부과/.test(row.name)),
	hotelLeakNames.join(' / '),
);

const hotelOnly = calculateUnifiedMarketSov(
	NINEONE_CLINIC_BRAND,
	'대구 동구',
	'피부미용',
	['대구 메리어트 호텔', '어반키친 뷔페'],
	{
		targetQuery: placeQuery,
		categoryName: '의료기관',
		brandAliases: BRAND_TOKENS,
	},
);
assert(
	'empty same-building clinic still monopolizes rank 1',
	hotelOnly.leaderboard[0]?.isClient === true,
	hotelOnly.leaderboard[0]?.name,
);
assert(
	'empty same-building clinic still excludes F&B',
	!hotelOnly.leaderboard.some((row) => /호텔|키친|뷔페|어반/i.test(row.name)),
	hotelOnly.leaderboard.map((row) => row.name).join(' / '),
);

const legalPlace = calculateUnifiedMarketSov(
	'바른법률사무소',
	'서울 강남',
	'법률 상담',
	['센터원 타워', '강남 맛집 라운지', '강남부동산중개', '세무법인 한빛', '바른법률사무소'],
	{
		targetQuery: '강남 센터원 12층',
		categoryName: '법률사무소',
		industryType: 'legal',
		schemaTypes: ['LegalService'],
		brandAliases: ['바른법률'],
	},
);
assert('legal place query is monopoly #1', legalPlace.leaderboard[0]?.isClient === true && legalPlace.asIsShare >= 80);
assert(
	'legal place query drops tower / F&B / realtor / tax',
	!legalPlace.leaderboard.some((row) => /타워|맛집|부동산|세무/.test(row.name)),
	legalPlace.leaderboard.map((row) => row.name).join(' / '),
);

const restaurantPlace = calculateUnifiedMarketSov(
	'어반키친',
	'대구 동구',
	'뷔페',
	['대구 메리어트 호텔', '어반키친', '동구 고깃집'],
	{
		targetQuery: '대구 동구 메리어트 2층 입점',
		categoryName: '식당',
		industryType: 'restaurant',
		schemaTypes: ['Restaurant'],
	},
);
assert(
	'restaurant target keeps F&B and drops the hotel',
	restaurantPlace.leaderboard.some((row) => /고깃집|키친/.test(row.name)) &&
		!restaurantPlace.leaderboard.some((row) => /호텔/.test(row.name)),
	restaurantPlace.leaderboard.map((row) => row.name).join(' / '),
);

const nicheQuery = '대구 동구 울트라클리어엘리트 추천';
const nicheHeld = calculateUnifiedMarketSov(
	NINEONE_CLINIC_BRAND,
	'대구 동구',
	'피부미용',
	['준피부과의원', '미담한의원', '예일의원', NINEONE_CLINIC_BRAND],
	{
		targetQuery: nicheQuery,
		categoryName: 'dermatology_clinic',
		productTokens: ['울트라클리어엘리트', '덴서티'],
		brandAliases: BRAND_TOKENS,
	},
);
assert('niche offering forces client rank 1', nicheHeld.clientRank === 1 && nicheHeld.leaderboard[0]?.isClient === true);
assert(
	'niche offering grants 70-95 own share',
	nicheHeld.nicheLeadership === true && nicheHeld.asIsShare >= 70 && nicheHeld.asIsShare <= 95,
	String(nicheHeld.asIsShare),
);
assert(
	'niche offering drops generic clinics without the equipment',
	!nicheHeld.leaderboard.some((row) => /준피부과|미담|예일/.test(row.name)),
	nicheHeld.leaderboard.map((row) => row.name).join(' / '),
);
assert(
	'niche insight names the specialty',
	/울트라클리어엘리트/.test(nicheHeld.lossInsight) && /특화/.test(nicheHeld.lossInsight),
	nicheHeld.lossInsight,
);

const nicheMissing = calculateUnifiedMarketSov(
	NINEONE_CLINIC_BRAND,
	'대구 동구',
	'피부미용',
	['준피부과의원', '미담한의원'],
	{
		targetQuery: '서울 강남 덴서티 추천',
		productTokens: ['울트라클리어엘리트'],
		brandAliases: BRAND_TOKENS,
	},
);
assert(
	'unoffered niche item does not grant leadership',
	nicheMissing.nicheLeadership !== true && nicheMissing.asIsShare < 70,
	String(nicheMissing.asIsShare),
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\n정합성 검증 완료: 범용 SoV 엔진 브랜드/특화/일반 질의 바인딩');
console.log('all assertions passed');
