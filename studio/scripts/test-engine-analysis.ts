/**
 * Verifies 6-engine scores / reasons are computed from crawl signals
 * (no static 77/52/40/59/60/48 table, no domain PRNG).
 * Run: npx tsx scripts/test-engine-analysis.ts
 */
import {
	buildEngineAnalysisReason,
	buildEngineAnalysisResults,
	detectEnginePlatformSignals,
	httpsEngineCriticalReason,
	scoreChatGpt,
	scoreClova,
	scoreGemini,
	scorePerplexity,
	type EngineScoreSignals,
} from '../lib/audit/engine-analysis';
import { computeExternalReputationFromSignals, type GeoReputationSignals } from '../lib/audit/geo-score';
import { getRatingMeta } from '../lib/geo/rating-meta';
import { HTTPS_ENGINE_SCORE_CAP } from '../lib/audit/scoreCalculator';
import { attachCauseReason, getJosa, withJosa } from '../lib/korean-josa';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const emptyPlatform = detectEnginePlatformSignals({});

function signals(overrides: Partial<EngineScoreSignals> = {}): EngineScoreSignals {
	return {
		technicalPct: 40,
		schemaPct: 30,
		geoPct: 28,
		orgPresent: false,
		orgComplete: false,
		faqPresent: false,
		aiBotsOk: false,
		keywords: ['부산'],
		organizationMissing: ['logo', 'url', 'sameAs'],
		defectCount: 6,
		platform: emptyPlatform,
		...overrides,
	};
}

const weak = signals();
const strongPlatform = detectEnginePlatformSignals({
	schemaTypes: ['MedicalClinic', 'FAQPage', 'Person', 'Organization'],
	jsonLdCorpus: JSON.stringify({
		'@type': 'MedicalClinic',
		sameAs: [
			'https://maps.google.com/?cid=1',
			'https://www.bing.com/maps?ss=1',
			'https://place.naver.com/hospital/1',
			'https://blog.naver.com/clinic',
		],
		telephone: '051-000-0000',
		address: { '@type': 'PostalAddress', streetAddress: '센텀' },
		geo: { '@type': 'GeoCoordinates', latitude: 35.1, longitude: 129.1 },
	}),
});
const strong = signals({
	technicalPct: 88,
	schemaPct: 82,
	geoPct: 80,
	orgPresent: true,
	orgComplete: true,
	faqPresent: true,
	aiBotsOk: true,
	keywords: ['임플란트', '부산', '센텀클리닉'],
	organizationMissing: [],
	defectCount: 0,
	aiBotAccess: { gptbot: true, claudebot: true, perplexitybot: true, 'google-extended': true },
	platform: strongPlatform,
});

const weakResults = buildEngineAnalysisResults(weak, 'ko');
const strongResults = buildEngineAnalysisResults(strong, 'ko');
const weakAgain = buildEngineAnalysisResults(weak, 'ko');

assert('returns all 6 engines', weakResults.length === 6);
assert(
	'engine order is ChatGPT→Clova',
	weakResults.map((r) => r.engine).join(',') === 'chatgpt,perplexity,gemini,claude,copilot,clova',
);
assert(
	'same signals → identical scores (no PRNG)',
	weakResults.every((row, i) => row.score === weakAgain[i].score && row.analysisReason === weakAgain[i].analysisReason),
);

const HARDCODED = [77, 52, 40, 59, 60, 48];
assert(
	'weak scores are not the old static tuple',
	weakResults.map((r) => r.score).join(',') !== HARDCODED.join(','),
	weakResults.map((r) => r.score).join(','),
);

for (const row of strongResults) {
	const weakRow = weakResults.find((w) => w.engine === row.engine);
	assert(`${row.engine} strong > weak`, Boolean(weakRow && row.score > weakRow.score), `${row.score} vs ${weakRow?.score}`);
	assert(`${row.engine} rating matches readiness band`, row.rating === getRatingMeta(row.score).ratingOutOf5);
	assert(`${row.engine} status is derived`, ['optimal', 'partial', 'poor'].includes(row.status));
}

const ratingCases: Array<{ score: number; stars: number; rating: number; status: string }> = [
	{ score: 21, stars: 2, rating: 2.0, status: 'low' },
	{ score: 28, stars: 2, rating: 2.0, status: 'low' },
	{ score: 32, stars: 2, rating: 2.0, status: 'low' },
	{ score: 40, stars: 3, rating: 3.0, status: 'moderate' },
	{ score: 58, stars: 3, rating: 3.0, status: 'moderate' },
	{ score: 19, stars: 1, rating: 1.0, status: 'veryLow' },
	{ score: 80, stars: 5, rating: 5.0, status: 'excellent' },
];
for (const row of ratingCases) {
	const meta = getRatingMeta(row.score, 'ko');
	assert(
		`${row.score}점 → ★${row.stars} / ${row.rating.toFixed(1)} / ${row.status}`,
		meta.filledStars === row.stars && meta.ratingOutOf5 === row.rating && meta.statusKey === row.status,
		`${meta.filledStars} ${meta.ratingOutOf5} ${meta.statusKey}`,
	);
}

assert('이/가: 신호 없음 → 이', getJosa('신호 없음', '이/가') === '이');
assert('이/가: 결함 14건 → 이', getJosa('결함 14건', '이/가') === '이');
assert('이/가: 스키마 부재 → 가', getJosa('스키마 부재', '이/가') === '가');
assert('으로/로: 서울 → 로 (ㄹ 받침)', getJosa('서울', '으로/로') === '로');
assert('으로/로: 부산 → 으로', getJosa('부산', '으로/로') === '으로');
assert('은/는: 안성 → 은', withJosa('안성', '은/는') === '안성은');
assert('을/를: 스포츠재활 → 을', withJosa('스포츠재활', '을/를') === '스포츠재활을');
assert('을/를: 아동발달센터 → 를', withJosa('아동발달센터', '을/를') === '아동발달센터를');
assert('을/를: 성형외과 → 를', withJosa('성형외과', '을/를') === '성형외과를');
assert('과/와: 스포츠재활 → 과', withJosa('스포츠재활', '과/와') === '스포츠재활과');
assert(
	'attachCauseReason: 신호 없음이 원인입니다',
	attachCauseReason('구글맵·Geo 좌표 신호 없음') === '구글맵·Geo 좌표 신호 없음이 원인입니다.',
);
assert(
	'attachCauseReason: 14건이 원인입니다',
	attachCauseReason('온페이지 결함 14건') === '온페이지 결함 14건이 원인입니다.',
);
assert(
	'attachCauseReason: 스키마 부재가 원인입니다',
	attachCauseReason('스키마 부재') === '스키마 부재가 원인입니다.',
);

function byEngine(rows: typeof weakResults, id: (typeof weakResults)[number]['engine']) {
	const row = rows.find((item) => item.engine === id);
	if (!row) throw new Error(`missing engine ${id}`);
	return row;
}

assert(
	'Gemini weak reason names Organization / LocalBusiness readiness gaps',
	/Organization|LocalBusiness/.test(byEngine(weakResults, 'gemini').analysisReason),
	byEngine(weakResults, 'gemini').analysisReason,
);
assert(
	'Korean engine reasons avoid 이(가) placeholders',
	weakResults.every((row) => !row.analysisReason.includes('이(가)') && !row.analysisReason.includes('가(이)')),
	weakResults.map((row) => row.analysisReason).join(' | '),
);
assert(
	'engine reasons do not claim a direct AI ranking cause',
	weakResults.every((row) => !row.analysisReason.includes('원인입니다') && !row.analysisReason.includes('노출하지')),
	weakResults.map((row) => row.analysisReason).join(' | '),
);
assert(
	'ChatGPT weak factors mention Bing Places as a profile signal',
	byEngine(weakResults, 'chatgpt').causeFactors.some((factor) => /Bing Places/.test(factor.detail)),
	byEngine(weakResults, 'chatgpt').causeFactors.map((factor) => factor.detail).join(' | '),
);
assert('Perplexity weak reason names FAQ', /FAQ/.test(byEngine(weakResults, 'perplexity').analysisReason), byEngine(weakResults, 'perplexity').analysisReason);
assert(
	'Perplexity FAQ is Content/Search Intent, not Entity',
	byEngine(weakResults, 'perplexity').causeFactors.some((factor) => factor.category === 'searchIntent' && /FAQ/.test(factor.detail)) &&
		!byEngine(weakResults, 'perplexity').causeFactors.some((factor) => factor.category === 'entity'),
	byEngine(weakResults, 'perplexity').causeFactors.map((factor) => `${factor.category}:${factor.detail}`).join(' | '),
);
assert(
	'Perplexity official docs are Citation, not Structured Data',
	byEngine(weakResults, 'perplexity').causeFactors.some((factor) => factor.category === 'citation' && /공식 문서/.test(factor.detail)) &&
		!byEngine(weakResults, 'perplexity').causeFactors.some((factor) => factor.category === 'structuredData'),
	byEngine(weakResults, 'perplexity').causeFactors.map((factor) => `${factor.category}:${factor.title}`).join(' | '),
);
assert(
	'Claude weak factors mention ClaudeBot as a crawl-allow signal',
	byEngine(weakResults, 'claude').causeFactors.some((factor) => /ClaudeBot/.test(factor.detail)),
	byEngine(weakResults, 'claude').causeFactors.map((factor) => factor.detail).join(' | '),
);
assert('Clova weak reason names 네이버', /네이버/.test(byEngine(weakResults, 'clova').analysisReason), byEngine(weakResults, 'clova').analysisReason);
assert(
	'engines do not share the same forced 4-category set',
	new Set(weakResults.flatMap((row) => row.causeFactors.map((factor) => factor.category))).size > 4,
	weakResults.map((row) => row.causeFactors.map((factor) => factor.category).join('+')).join(' || '),
);
assert(
	'weak engines expose categorized cause factors',
	weakResults.every((row) => row.causeFactors.length >= 2 && row.readinessScore === row.score && row.visibility !== undefined),
	weakResults.map((row) => `${row.engine}:${row.causeFactors.length}`).join(', '),
);
assert(
	'ChatGPT copy does not claim Bing Places blocks exposure',
	byEngine(weakResults, 'chatgpt').causeFactors.every((factor) => !/노출되지/.test(factor.detail) && !/노출하지/.test(factor.detail)),
	byEngine(weakResults, 'chatgpt').causeFactors.map((factor) => factor.detail).join(' | '),
);

assert(
	'strong engines do not invent cause factors',
	strongResults.every((row) => row.causeFactors.length === 0),
	strongResults.map((row) => `${row.engine}:${row.causeFactors.map((factor) => factor.id).join('+')}`).join(', '),
);
assert('Gemini strong reason is a strength (no 원인입니다)', !byEngine(strongResults, 'gemini').analysisReason.includes('원인입니다'), byEngine(strongResults, 'gemini').analysisReason);
assert(
	'ChatGPT strong mentions readiness baseline (no invented visibility)',
	/준비 기반|readiness/.test(byEngine(strongResults, 'chatgpt').analysisReason),
	byEngine(strongResults, 'chatgpt').analysisReason,
);

const geminiNoMaps = scoreGemini(signals({ orgComplete: true, orgPresent: true, schemaPct: 80, platform: emptyPlatform }));
const geminiWithMaps = scoreGemini(strong);
assert('Gemini score rises with LocalBusiness + Maps sameAs', geminiWithMaps > geminiNoMaps);

const chatgptNoBing = scoreChatGpt(signals({ aiBotsOk: true, schemaPct: 80, platform: emptyPlatform }));
const chatgptBing = scoreChatGpt(strong);
assert('ChatGPT score rises with Bing Places sameAs', chatgptBing > chatgptNoBing);

const clovaNoNaver = scoreClova(signals({ geoPct: 80, keywords: ['a', 'b', 'c'], platform: emptyPlatform }));
const clovaNaver = scoreClova(strong);
assert('Clova score rises with Naver Place + blog', clovaNaver > clovaNoNaver);

const faqOff = scorePerplexity(signals({ geoPct: 70, platform: emptyPlatform }));
const faqOn = scorePerplexity(signals({ geoPct: 70, faqPresent: true, platform: strongPlatform }));
assert('Perplexity score rises when FAQ is present', faqOn > faqOff);

const missingReason = buildEngineAnalysisReason(
	'gemini',
	signals({ organizationMissing: ['logo', 'sameAs'] }),
	'ko',
);
assert('Gemini reason interpolates missing org fields', missingReason.includes('logo') && missingReason.includes('sameAs'), missingReason);
assert('Gemini reason does not claim Maps block Gemini exposure', !missingReason.includes('노출되지'), missingReason);

const geoSignals: GeoReputationSignals = {
	domain: 'example-clinic.kr',
	technicalPct: 40,
	schemaPct: 30,
	geoPct: 28,
	orgPresent: false,
	orgComplete: false,
	faqPresent: false,
	aiBotsOk: false,
	keywords: ['부산'],
	defectCount: 6,
	platform: emptyPlatform,
};
const a = computeExternalReputationFromSignals(geoSignals, 'ko');
const b = computeExternalReputationFromSignals(geoSignals, 'ko');
assert(
	'reputation resolver is stable (no domain jitter)',
	a.overview.score === b.overview.score &&
		a.aiEngines.every((engine, i) => engine.score === b.aiEngines[i].score && engine.analysisReason === b.aiEngines[i].analysisReason),
);
assert('bingPlacesRegistered is false without sameAs evidence', a.digitalFootprint.bingPlacesRegistered === false);
assert('NAP issue does not invent Maps↔Naver mismatch', !a.brandTrust.napIssue?.includes('구글맵과 네이버 플레이스'));

const linked = computeExternalReputationFromSignals(
	{
		...geoSignals,
		orgPresent: true,
		orgComplete: true,
		faqPresent: true,
		aiBotsOk: true,
		schemaPct: 82,
		platform: strongPlatform,
	},
	'ko',
);
assert('bingPlacesRegistered is true when Bing sameAs exists', linked.digitalFootprint.bingPlacesRegistered === true);
assert('exposure cards expose EngineAnalysisResult fields', linked.aiEngines.every((e) => e.engineName && e.status && typeof e.rating === 'number' && e.analysisReason));

const httpStrong = buildEngineAnalysisResults({ ...strong, isHttps: false, defectCount: 3 }, 'ko');
assert(
	'HTTP engines lose 15–20 points and stay at or below 64',
	httpStrong.every((row) => {
		const httpsRow = strongResults.find((s) => s.engine === row.engine);
		return Boolean(httpsRow && row.score <= HTTPS_ENGINE_SCORE_CAP && row.score <= httpsRow.score - 15);
	}),
	httpStrong.map((r) => `${r.engine}:${r.score}`).join(', '),
);
assert(
	'HTTP engines cannot be 상위 노출 중',
	httpStrong.every((row) => row.status !== 'optimal'),
	httpStrong.map((r) => `${r.engine}:${r.status}`).join(', '),
);
assert(
	'HTTP Why copy is the HTTPS critical sentence',
	httpStrong.every((row) => row.analysisReason === httpsEngineCriticalReason(3, 'ko')),
	httpStrong[0]?.analysisReason,
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall engine-analysis assertions passed');
