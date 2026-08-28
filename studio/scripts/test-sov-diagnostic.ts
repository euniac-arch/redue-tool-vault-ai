/**
 * Nine One Clinic SoV leaderboard integrity + UI token validation.
 * Run: npx tsx scripts/test-sov-diagnostic.ts
 */
import {
	applyKeywordSovToDynamic,
	calculateUnifiedMarketSov,
	CLIENT_UNRANKED_RANK,
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
	NINEONE_CLINIC_SOV_BASELINE,
	NINEONE_CLINIC_SOV_QUERIES,
	resolveDiagnosticSovPresets,
	resolveSovOwnBadgeTone,
	resolveSovUiTokens,
	shareTableToKeywordSlice,
	SOV_OWN_BADGE_TONE_CLASSES,
	SOV_OWN_SHARE_TONE_CLASSES,
	SOV_VALIDATION_PASS_MESSAGE,
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

const dataset = buildNineoneClinicSovDiagnosticDataset();
const result = validateNineoneClinicSovDiagnostic(dataset);
logSovValidationResult(result);

assert('recommend query uses 27/16/5/52 baseline', dataset.rank1 === 27 && dataset.rank2 === 16 && dataset.currentSov === 5 && dataset.thirdParty === 52);
assert('target SoV is 48', dataset.targetSov === 48);
assert('gap is +43%p', dataset.potentialGain === 43 && 48 - 5 === 43);
assert('pie sums to 100', (dataset.rank1 ?? 0) + (dataset.rank2 ?? 0) + (dataset.currentSov ?? 0) + (dataset.thirdParty ?? 0) === 100);
assert('validator passes Nine One Clinic dataset', result.valid, result.errors.map((issue) => issue.message).join(' | '));
assert('pass message is clinic-specific', result.message === SOV_VALIDATION_PASS_MESSAGE);
assert('shareSum100 check', result.checks.shareSum100);
assert('gapFormula check', result.checks.gapFormula);
assert('keywordsPresent check', result.checks.keywordsPresent);
assert('perKeywordTables check', result.checks.perKeywordTables);
assert('keywordTablesRefresh check', result.checks.keywordTablesRefresh);
assert('third-party 52 is majority', result.checks.thirdPartyMajority && isThirdPartyMajority(52));
assert('unranked tone is danger', result.ui.ownBadgeTone === 'danger');
assert('3rd-party bar width is 52', result.ui.thirdPartyBarWidth === 52);
assert('danger badge class is rose', result.ui.ownBadgeClassName === SOV_OWN_BADGE_TONE_CLASSES.danger);
assert('danger share class is rose', result.ui.ownShareClassName === SOV_OWN_SHARE_TONE_CLASSES.danger);

assert(
	'all three diagnostic queries are present',
	NINEONE_CLINIC_SOV_QUERIES.every((query) => dataset.keywords?.includes(query)),
);
assert('query 1 intent is recommend', classifySovQueryIntent(NINEONE_CLINIC_SOV_QUERIES[0]) === 'recommend');
assert('query 2 intent is base', classifySovQueryIntent(NINEONE_CLINIC_SOV_QUERIES[1]) === 'base');
assert('query 3 intent is custom', classifySovQueryIntent(NINEONE_CLINIC_SOV_QUERIES[2]) === 'custom');

const recommendShares = resolveKeywordSovShares(NINEONE_CLINIC_SOV_QUERIES[0]);
assert(
	'engine recommend table matches spec',
	recommendShares.own === 5 &&
		recommendShares.rank1 === 27 &&
		recommendShares.rank2 === 16 &&
		recommendShares.thirdParty === 52 &&
		recommendShares.targetSov === 48 &&
		recommendShares.potentialGain === 43,
);

const fingerprints = NINEONE_CLINIC_SOV_QUERIES.map((query) =>
	sovShareTableFingerprint(shareTableToKeywordSlice(resolveKeywordSovShares(query))),
);
assert('each target query yields a distinct pie', new Set(fingerprints).size === 3, fingerprints.join(' / '));

let previousSlice = shareTableToKeywordSlice(recommendShares);
for (const query of NINEONE_CLINIC_SOV_QUERIES.slice(1)) {
	const nextSlice = shareTableToKeywordSlice(resolveKeywordSovShares(query));
	assert(`click #${query} refreshes the rank table`, didSovTableRefresh(previousSlice, nextSlice));
	assert(`#${query} pie still sums to 100`, nextSlice.rank1 + nextSlice.rank2 + nextSlice.currentSov + nextSlice.thirdParty === 100);
	assert(`#${query} gap formula holds`, nextSlice.potentialGain === nextSlice.targetSov - nextSlice.currentSov);
	previousSlice = nextSlice;
}

const presets = resolveDiagnosticSovPresets({
	brandName: NINEONE_CLINIC_BRAND,
	siteUrl: NINEONE_CLINIC_SITE_URL,
	fallback: ['다른 질의 추천', '다른 질의', '다른 질의 잘하는곳'],
});
assert('clinic presets pin the three diagnostic queries', presets[0] === NINEONE_CLINIC_SOV_QUERIES[0] && presets[2] === NINEONE_CLINIC_SOV_QUERIES[2]);
assert(
	'other sites keep generated presets',
	resolveDiagnosticSovPresets({ brandName: '센텀우리내과', fallback: ['부산 센텀 내과 추천'] })[0] === '부산 센텀 내과 추천',
);

const unified = calculateUnifiedMarketSov(
	NINEONE_CLINIC_BRAND,
	'대구 동구',
	'울트라클리어엘리트',
	['동구피부과의원', '동대구역피부클리닉', '메리어트피부과'],
	{ targetQuery: NINEONE_CLINIC_SOV_QUERIES[0] },
);
assert('unified unranked clientRank is 4', unified.clientRank === CLIENT_UNRANKED_RANK);
assert('unified as-is is 5', unified.asIsShare === 5);
assert('unified to-be is 48', unified.toBeShare === 48);
assert('unified reclaim is 43', unified.reclaimGain === 43);
assert(
	'unified pie is 100',
	unified.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100,
);
assert('unified labels client outside top 3', /순위 밖|3위 밖/.test(unified.leaderboard.find((row) => row.isClient)?.name || ''));

const dynamic = unifiedToDynamicSov(unified, { targetSiteName: NINEONE_CLINIC_BRAND });
const liveValidation = validateSovLeaderboardData({
	brandName: NINEONE_CLINIC_BRAND,
	siteUrl: NINEONE_CLINIC_SITE_URL,
	currentSov: dynamic.asIsShare,
	targetSov: dynamic.toBeShare,
	potentialGain: dynamic.reclaimGain,
	rank1: dynamic.leaderboard.find((row) => row.rank === 1)?.share,
	rank2: dynamic.leaderboard.find((row) => row.rank === 2)?.share,
	thirdParty: dynamic.directoryShare,
	clientRank: dynamic.clientRank,
	rankText: NINEONE_CLINIC_SOV_BASELINE.rankText,
	leaderboard: dynamic.leaderboard,
	keywords: NINEONE_CLINIC_SOV_QUERIES,
	perKeyword: dataset.perKeyword,
});
assert('live unified payload validates', liveValidation.valid, liveValidation.errors.map((issue) => issue.message).join(' | '));

let applied = dynamic;
let previousApplied = {
	rank1: dynamic.leaderboard.find((row) => row.rank === 1)?.share ?? 0,
	rank2: dynamic.leaderboard.find((row) => row.rank === 2)?.share ?? 0,
	currentSov: dynamic.asIsShare,
	thirdParty: dynamic.directoryShare,
	targetSov: dynamic.toBeShare,
};
for (const query of NINEONE_CLINIC_SOV_QUERIES) {
	applied = applyKeywordSovToDynamic(applied, query, {
		region: '대구 동구',
		mainService: '피부미용',
		targetSiteName: NINEONE_CLINIC_BRAND,
	});
	const nextApplied = {
		rank1: applied.leaderboard.find((row) => row.rank === 1)?.share ?? 0,
		rank2: applied.leaderboard.find((row) => row.rank === 2)?.share ?? 0,
		currentSov: applied.asIsShare,
		thirdParty: applied.directoryShare,
		targetSov: applied.toBeShare,
	};
	assert(`applyKeywordSovToDynamic keeps 100 for #${query}`, applied.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100);
	if (query !== NINEONE_CLINIC_SOV_QUERIES[0]) {
		assert(`applyKeywordSovToDynamic refreshes #${query}`, didSovTableRefresh(previousApplied, nextApplied));
	}
	previousApplied = nextApplied;
}

const brokenSum = validateSovLeaderboardData({
	...dataset,
	thirdParty: 40,
	perKeyword: undefined,
	requireNineoneQueries: false,
});
assert('sum mismatch is rejected', !brokenSum.valid && brokenSum.errors.some((issue) => issue.code === 'SHARE_SUM'));

const brokenGap = validateSovLeaderboardData({
	...dataset,
	potentialGain: 10,
	perKeyword: undefined,
	requireNineoneQueries: false,
});
assert('gap mismatch is rejected', !brokenGap.valid && brokenGap.errors.some((issue) => issue.code === 'GAP_MISMATCH'));

const missingKeyword = validateSovLeaderboardData({
	...dataset,
	keywords: [NINEONE_CLINIC_SOV_QUERIES[0]],
	requireNineoneQueries: true,
});
assert(
	'missing diagnostic keyword is rejected',
	!missingKeyword.valid && missingKeyword.errors.some((issue) => issue.code === 'KEYWORD_MISSING' && issue.message.includes(NINEONE_CLINIC_SOV_QUERIES[1])),
);

const staleKeywords = validateSovLeaderboardData({
	...dataset,
	perKeyword: {
		[NINEONE_CLINIC_SOV_QUERIES[0]]: shareTableToKeywordSlice(recommendShares),
		[NINEONE_CLINIC_SOV_QUERIES[1]]: shareTableToKeywordSlice(recommendShares),
	},
});
assert('identical keyword pies are rejected as stale', !staleKeywords.valid && staleKeywords.errors.some((issue) => issue.code === 'KEYWORD_STALE'));

assert('isOutsideTop3 honors rank 4', isOutsideTop3(4, '3위 밖'));
assert('isOutsideTop3 rejects rank 2', !isOutsideTop3(2, '2위'));
assert('unranked 5% tone is danger', resolveSovOwnBadgeTone({ clientRank: 4, currentSov: 5 }) === 'danger');
assert('unranked 8% tone is warning', resolveSovOwnBadgeTone({ clientRank: 4, currentSov: 8 }) === 'warning');
assert('ranked tone is ok', resolveSovOwnBadgeTone({ clientRank: 1, currentSov: 27 }) === 'ok');
assert('49% is not majority', !isThirdPartyMajority(49));
assert('ui tokens mark 52 as majority', resolveSovUiTokens({ clientRank: 4, currentSov: 5, thirdParty: 52 }).thirdPartyIsMajority);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\n정합성 검증 완료: 나인원의원 SoV 데이터 100% 일치');
console.log('all assertions passed');
