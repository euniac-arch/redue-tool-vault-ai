/**
 * Generic SoV engine — query entity decomposition + strict co-occurrence.
 * Run: npx tsx scripts/test-generic-sov.ts
 */
import {
	allocateGenericSovPie,
	calculateGenericSoV,
	decomposeQueryEntity,
	ENTITY_MATCH_EXACT,
	ENTITY_MATCH_NONE,
	ENTITY_MATCH_PARTIAL,
	rankWeightFor,
	scoreEntityMatch,
} from '../lib/audit/generic-sov';
import { calculateUnifiedMarketSov } from '../lib/audit/advancedGeoMetrics';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

const equipmentQuery = '대구 동구 울트라클리어엘리트 추천';
const genericQuery = '대구 동구 피부과 추천';

const equipment = decomposeQueryEntity(equipmentQuery, {
	region: '대구 동구',
	mainService: '피부미용',
	productTokens: ['울트라클리어엘리트'],
});
assert('equipment query extracts location', equipment.locations.includes('대구') && equipment.locations.includes('동구'));
assert('equipment query extracts core entity', equipment.coreEntities.some((token) => /울트라클리어엘리트/.test(token)));
assert('equipment query extracts intent', equipment.intents.includes('추천'));
assert('equipment query is strict', equipment.strictEntityCheck === true);

const generic = decomposeQueryEntity(genericQuery, { region: '대구 동구', mainService: '피부과' });
assert('generic category is not a core entity', generic.coreEntities.length === 0, generic.coreEntities);
assert('generic query is not strict', generic.strictEntityCheck === false);

const implant = decomposeQueryEntity('부산 해운대 임플란트 추천', { region: '부산 해운대' });
assert('implant is a core specialty entity', implant.coreEntities.includes('임플란트') && implant.strictEntityCheck);

const aligner = decomposeQueryEntity('강남 인비절라인 잘하는곳', { region: '강남' });
assert('invisalign is a core entity', aligner.coreEntities.some((token) => /인비절라인/.test(token)));

const legal = decomposeQueryEntity('강남 상속전문 변호사 추천', { region: '서울 강남', mainService: '법률 상담' });
assert('legal specialty is a core entity', legal.coreEntities.some((token) => /상속전문/.test(token)) && legal.strictEntityCheck);

const pension = decomposeQueryEntity('제주 펜션 온수풀 추천', { region: '제주', mainService: '펜션' });
assert('pension facility is a core entity', pension.coreEntities.includes('온수풀') && !pension.coreEntities.includes('펜션'));

const brandQuery = decomposeQueryEntity('대구 나인원의원', {
	region: '대구',
	brandTokens: ['나인원의원', '나인원'],
});
assert('brand token is not a core entity', !brandQuery.strictEntityCheck, brandQuery.coreEntities);

assert('rank 1 weight is 10', rankWeightFor(1) === 10);
assert('rank 2 weight is 7', rankWeightFor(2) === 7);
assert('rank 3 weight is 5', rankWeightFor(3) === 5);

assert('exact entity match', scoreEntityMatch('울트라클리어엘리트 도입 병원', ['울트라클리어엘리트']).score === ENTITY_MATCH_EXACT);
assert('partial entity match', scoreEntityMatch('울트라클리어 시술', ['울트라클리어엘리트']).score === ENTITY_MATCH_PARTIAL);
assert('missing entity is locked to 0.05', scoreEntityMatch('대구 피부과 추천 1위', ['울트라클리어엘리트']).score === ENTITY_MATCH_NONE);

const distorted = calculateGenericSoV({
	targetQuery: equipmentQuery,
	region: '대구 동구',
	mainService: '피부미용',
	productTokens: ['울트라클리어엘리트'],
	candidates: [
		{
			name: '황금피부과',
			rank: 1,
			snippet: '대구 동구 피부과 추천, 보톡스 필러 리프팅',
		},
		{
			name: '준피부과의원',
			rank: 2,
			snippet: '대구 피부과 잘하는 곳',
		},
		{
			name: '나인원의원',
			rank: 4,
			snippet: '대구 동구 울트라클리어엘리트 도입 병원',
			isClient: true,
			holdsCoreEntity: true,
			aiCitationCount: 2,
		},
	],
});

const leader = distorted.leaderboard[0];
assert('client with the device leads the board', leader?.isClient === true && leader.name === '나인원의원', leader);
assert('gold dermatology is excluded from top 3', !distorted.leaderboard.some((row) => /황금/.test(row.name)));
assert(
	'gold dermatology is locked to 0.05',
	distorted.scores.find((row) => /황금/.test(row.name))?.entityMatchScore === ENTITY_MATCH_NONE,
);
assert('client SoV is the majority slice', (distorted.scores.find((row) => row.isClient)?.sovPercent ?? 0) >= 70);
assert('eligible percents sum to 100', distorted.leaderboard.reduce((sum, row) => sum + row.sovPercent, 0) === 100);

const pie = allocateGenericSovPie(distorted);
assert('allocated pie puts client at rank 1', pie?.clientRank === 1 && (pie?.own ?? 0) >= 70);
assert('allocated pie sums to 100', pie != null && pie.own + pie.rank1 + pie.rank2 + pie.thirdParty === 100);

const genericMarket = calculateGenericSoV({
	targetQuery: genericQuery,
	region: '대구 동구',
	mainService: '피부과',
	candidates: [
		{ name: '황금피부과', rank: 1 },
		{ name: '나인원의원', rank: 3, isClient: true },
	],
});
assert('generic keyword keeps both clinics', genericMarket.leaderboard.some((row) => /황금/.test(row.name)));
assert('generic keyword is not strict', genericMarket.query.strictEntityCheck === false);
assert('generic rank-1 still outranks rank-3 when entity scores are equal', genericMarket.leaderboard[0]?.name === '황금피부과');

const unified = calculateUnifiedMarketSov(
	'나인원의원',
	'대구 동구',
	'피부미용',
	[
		{ name: '황금피부과', snippet: '대구 피부과 추천 1위 보톡스 필러' },
		{ name: '준피부과의원', snippet: '동구 피부과 예약' },
		{ name: '나인원의원', snippet: '울트라클리어엘리트 도입' },
	],
	{
		targetQuery: equipmentQuery,
		productTokens: ['울트라클리어엘리트'],
		offeringCorpus: '울트라클리어엘리트 덴서티 흉터 치료',
		brandAliases: ['나인원', 'nineoneclinic'],
		aiCitations: [{ name: '나인원의원', count: 2 }],
	},
);
assert('unified board ranks the device clinic first', unified.clientRank === 1 && unified.leaderboard[0]?.isClient === true);
assert('unified own share reflects entity ownership', unified.asIsShare >= 70 && unified.asIsShare <= 95, unified.asIsShare);
assert(
	'unified drops gold dermatology from the top 3',
	!unified.leaderboard.some((row) => /황금/.test(row.name)),
	unified.leaderboard.map((row) => row.name).join(' / '),
);
assert('unified pie is 100', unified.leaderboard.reduce((sum, row) => sum + row.share, 0) === 100);

const dental = calculateUnifiedMarketSov(
	'스마일치과',
	'부산 해운대',
	'치과',
	[
		{ name: '해운대탑치과', snippet: '해운대 치과 임플란트 교정' },
		{ name: '부산미치과', snippet: '일반 스케일링 검진' },
		{ name: '스마일치과', snippet: '인비절라인 전문 클리닉' },
	],
	{
		targetQuery: '부산 해운대 인비절라인 추천',
		productTokens: ['인비절라인'],
		offeringCorpus: '인비절라인 투명교정',
	},
);
assert('dental aligner query keeps the clinic that names it', dental.leaderboard.some((row) => /스마일/.test(row.name)) && dental.clientRank === 1);
assert('dental aligner query drops the scaling-only clinic', !dental.leaderboard.some((row) => /부산미치과/.test(row.name)));

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\n정합성 검증 완료: 범용 calculateGenericSoV 엔티티 동시출현 / SoV 정규화');
console.log('all assertions passed');
