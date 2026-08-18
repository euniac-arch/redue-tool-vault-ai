/**
 * Step 2: Tab 1 / Tab 2 GEO cards + 24-item checklist.
 * Run: npx tsx scripts/test-advanced-geo-ui.ts
 */
import { computeAdvancedGeoFromReport } from '../lib/audit/advancedGeoFromReport';
import {
	buildLlmsTxtCheckItem,
	ensureLlmsTxtChecklistItem,
	isLlmsTxtDocument,
	LLMS_TXT_CHECK_ID,
	resolveHasLlmsTxt,
} from '../lib/audit/llms-txt-check';
import {
	AS_IS_SHARE_MAX,
	RANK_1_SHARE,
	RANK_3_SHARE,
	THIRD_PARTY_SHARE,
	TO_BE_SHARE_MAX,
	TO_BE_SHARE_MIN,
	buildLlmsTxtContent,
	resolveKeywordSovShares,
} from '../lib/audit/advancedGeoMetrics';
import type { AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

function check(id: string, status: AuditCheckItem['status'] = 'pass'): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight: 5 };
}

const legacyChecks = Array.from({ length: 22 }, (_, i) => check(`item-${i + 1}`));
const missing = ensureLlmsTxtChecklistItem(legacyChecks, {
	lang: 'ko',
	url: 'https://clinic.example/',
	metrics: { hasLlmsTxt: false } as AuditReport['metrics'],
});
const item23 = missing.find((item) => item.id === LLMS_TXT_CHECK_ID);

assert('legacy 22 → 23', missing.length === 23);
assert('item 23 id', item23?.id === 'llms-txt');
assert('missing is Warn', item23?.status === 'warning' && item23.passed === false);
assert('label maps GEO standard', Boolean(item23?.label?.includes('/llms.txt')));
assert('why maps when missing', Boolean(item23?.why?.includes('/llms.txt')));
assert('weight 6 is official GEO slot', item23?.weight === 6);

const present = buildLlmsTxtCheckItem({ lang: 'ko', present: true });
assert('present is Pass', present.status === 'pass' && present.passed);
assert('pass why mapped', Boolean(present.why?.includes('정상 통과')));

assert('html error page is not llms.txt', !isLlmsTxtDocument('<!DOCTYPE html><html><body>404</body></html>', 200));
assert('empty is not llms.txt', !isLlmsTxtDocument('', 200));
assert('404 is not llms.txt', !isLlmsTxtDocument('# Brand', 404));
assert(
	'markdown llms.txt accepted',
	isLlmsTxtDocument('# 센텀우리내과\n\n## NAP\n- name: 센텀우리내과\n', 200),
);

const report = {
	url: 'https://clinic.example/',
	lang: 'ko' as const,
	pageSizeBytes: 80_000,
	footerText: '부산 센텀 센텀우리내과 051-000-0000 사업자등록번호 120-81-47521',
	collectedUrls: ['https://place.naver.com/hospital/123456789012345'],
	siteMeta: {
		domain: 'clinic.example',
		brandName: '센텀우리내과',
		category: '내과',
		primaryKeyword: '내과',
		industryType: 'MEDICAL' as const,
		location: '부산 센텀',
		broadLocation: '부산',
		vertical: 'medical' as const,
		targetUrl: 'https://clinic.example/',
		coreSpecialties: ['내과', '건강검진'],
	},
	metrics: {
		titleLength: 20,
		metaDescriptionLength: 80,
		h1Count: 1,
		headingSkipDetected: false,
		imagesTotal: 0,
		imagesMissingAlt: 0,
		imageAltCoveragePct: 100,
		jsonLdBlockCount: 1,
		schemaTypes: ['MedicalClinic', 'Person'],
		bodyTextLength: 24000,
		renderBlockingScripts: 0,
		jsonLdSnippets: [
			JSON.stringify({
				'@type': 'MedicalClinic',
				taxID: '120-81-47521',
				sameAs: ['https://blog.naver.com/clinic', 'https://www.instagram.com/clinic'],
			}),
		],
		h1Texts: ['센텀우리내과'],
		h2Texts: ['진료시간', '건강검진'],
		hasLlmsTxt: false,
	},
} as Pick<AuditReport, 'url' | 'lang' | 'siteMeta' | 'metrics' | 'pageSizeBytes' | 'footerText' | 'detectedKeywords' | 'collectedUrls'>;

const geo = computeAdvancedGeoFromReport(report);
assert('SoV sums to 100', geo.shareOfVoice.shares.reduce((sum, row) => sum + row.sharePct, 0) === 100);
assert(
	'own share without listings is unranked 5',
	geo.shareOfVoice.asIsShare === RANK_3_SHARE && geo.shareOfVoice.asIsShare <= AS_IS_SHARE_MAX,
	String(geo.shareOfVoice.asIsShare),
);
assert('directory share is reserved', geo.shareOfVoice.directoryShare === THIRD_PARTY_SHARE);
assert('unlisted leader is 27', geo.shareOfVoice.leaderSharePct === RANK_1_SHARE, String(geo.shareOfVoice.leaderSharePct));
assert(
	'to-be in 48-55',
	geo.shareOfVoice.toBeShare >= TO_BE_SHARE_MIN && geo.shareOfVoice.toBeShare <= TO_BE_SHARE_MAX,
	String(geo.shareOfVoice.toBeShare),
);
assert('no live snapshot stays statistical', geo.shareOfVoice.hasRealCompetitorData === false);
assert(
	'dynamicSov has 3 ranking slots + directory',
	geo.dynamicSov.leaderboard.filter((row) => !row.isThirdParty).length === 3 &&
		geo.dynamicSov.leaderboard.some((row) => row.isThirdParty),
);
assert(
	'dynamicSov reclaim matches shareOfVoice',
	geo.dynamicSov.reclaimGain === geo.shareOfVoice.reclaimGain,
	String(geo.dynamicSov.reclaimGain),
);
assert(
	'dynamicSov target query includes 추천',
	geo.dynamicSov.targetQuery === '부산 센텀 내과 추천' || geo.shareOfVoice.targetQuery === '부산 센텀 내과 추천',
	String(geo.dynamicSov.targetQuery || geo.shareOfVoice.targetQuery),
);

const liveGeo = computeAdvancedGeoFromReport({
	...report,
	realCompetitors: {
		query: '부산 센텀 내과 추천',
		names: ['센텀튼튼내과', '해운대본내과'],
		isRealData: [true, true],
		source: 'naver',
		lossInsight: '부산 센텀 지역 "내과" AI 추천 질의에서 센텀튼튼내과 등이 인용 점유율 100%를 독점하고 있습니다.',
		fetchedAt: '2026-08-16T00:00:00.000Z',
	},
});
assert(
	'live snapshot binds real names',
	liveGeo.shareOfVoice.shares.some((row) => row.name === '센텀튼튼내과'),
);
assert('live snapshot marks real data', liveGeo.shareOfVoice.hasRealCompetitorData === true);
assert('live snapshot leader is 27', liveGeo.shareOfVoice.leaderSharePct === RANK_1_SHARE, String(liveGeo.shareOfVoice.leaderSharePct));
assert(
	'live snapshot own share is unranked 5',
	liveGeo.shareOfVoice.asIsShare === RANK_3_SHARE && liveGeo.shareOfVoice.asIsShare <= AS_IS_SHARE_MAX,
	String(liveGeo.shareOfVoice.asIsShare),
);
assert(
	'live snapshot gap matches max(0, leader - as-is)',
	liveGeo.shareOfVoice.gapToLeader === Math.max(0, liveGeo.shareOfVoice.leaderSharePct - liveGeo.shareOfVoice.asIsShare),
);

const rankedGeo = computeAdvancedGeoFromReport({
	...report,
	realCompetitors: {
		query: '부산 센텀 내과',
		names: ['센텀튼튼내과', '해운대본내과'],
		rankedNames: ['센텀우리내과', '센텀튼튼내과', '해운대본내과'],
		clientRank: 1,
		isRealData: [true, true],
		source: 'naver',
		lossInsight: '부산 센텀 지역 "내과" AI 추천 질의에서 센텀우리내과가 1위입니다.',
		fetchedAt: '2026-08-16T00:00:00.000Z',
	},
});
const rankedShares = resolveKeywordSovShares('부산 센텀 내과');
assert('ranked snapshot as-is follows keyword #1 share', rankedGeo.shareOfVoice.asIsShare === rankedShares.rank1);
assert('ranked snapshot clientRank is 1', rankedGeo.shareOfVoice.clientRank === 1);
assert('ranked snapshot #2 follows keyword runner share', rankedGeo.shareOfVoice.leaderSharePct === rankedShares.rank2);
assert('ranked snapshot gap is 0 when client leads', rankedGeo.shareOfVoice.gapToLeader === 0);
assert('ranked snapshot leaderboard keeps client at #1', rankedGeo.dynamicSov.leaderboard[0]?.isClient === true);
assert(
	'ranked snapshot pie is 100',
	rankedGeo.shareOfVoice.shares.reduce((sum, row) => sum + row.sharePct, 0) === 100,
);
assert(
	'live snapshot vulnerability names leader share',
	liveGeo.shareOfVoice.vulnerabilityInsight?.includes(`${liveGeo.shareOfVoice.leaderSharePct}%`) === true,
);
assert('entity score in 0-100', geo.entityDisambiguation.score >= 0 && geo.entityDisambiguation.score <= 100);
assert('taxId from footer/json-ld', geo.entityDisambiguation.breakdown.taxId.valid);
assert('placeCid from collected URL', geo.entityDisambiguation.breakdown.placeCid.value === '123456789012345');
assert('rag score in 0-100', geo.ragChunking.score >= 0 && geo.ragChunking.score <= 100);
assert('fact score in 0-100', geo.factDensity.score >= 0 && geo.factDensity.score <= 100);
assert('industry defaultCategory is 의료기관', geo.industry.defaultCategory === '의료기관', geo.industry.defaultCategory);
assert('llms markdown built', geo.llmsTxt.includes('# 센텀우리내과') && geo.llmsTxt.includes('## NAP'));
assert('hasLlmsTxt false from metrics', geo.hasLlmsTxt === false);
assert('resolveHasLlmsTxt false', resolveHasLlmsTxt(report) === false);

const llms = buildLlmsTxtContent({
	brandName: '센텀우리내과',
	location: '부산 센텀',
	legacyIndustry: 'MEDICAL',
	services: ['내과', '건강검진'],
	lang: 'ko',
});
assert('module 5 markdown has brand + NAP', llms.includes('# 센텀우리내과') && llms.includes('## NAP') && llms.includes('## FAQ'));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall advanced GEO UI / checklist-24 assertions passed');
