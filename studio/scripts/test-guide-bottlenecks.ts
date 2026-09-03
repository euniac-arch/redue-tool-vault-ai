/**
 * 6대 AI 엔진: 통과 항목 제외, 미해결 결함 ↔ 조치 1:1.
 * Run: npx tsx scripts/test-guide-bottlenecks.ts
 */
import {
	checkBotAllowed,
	evaluateAiBottlenecks,
	siteAuditFromReport,
	type SiteAuditResult,
} from '../lib/analysis/evaluateAiBottlenecks';
import type { AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`, detail ?? '');
}

const GPT_ALLOW_ROBOTS = `User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /`;

const allClear: SiteAuditResult = {
	robotsTxt: GPT_ALLOW_ROBOTS,
	hasLlmsTxt: true,
	sameAs: ['https://www.yna.co.kr/view/AKR20260301000000'],
	schemaGeo: { latitude: 35.879, longitude: 128.628 },
	mapGeo: { latitude: 35.879, longitude: 128.628 },
	hasYoutubeCaptions: true,
	hasSitemap: true,
	lastIndexedAt: new Date().toISOString(),
	hasFaq: true,
	bodyLength: 1800,
	hasMedicalCausalText: true,
	schemaTypes: ['Physician', 'LocalBusiness'],
	bingPlacesLinked: true,
	napNameKo: '나인원의원',
	napNameEn: 'Nine One Clinic',
	napAddress: '대구광역시 동구 동부로 26길 6',
	naverPlaceMenuCount: 4,
	naverKinExpertSignal: true,
};

const optimal = evaluateAiBottlenecks(allClear);
assert('all-clear yields 6 engines', optimal.length === 6);
assert(
	'all-clear every engine OPTIMAL',
	optimal.every((row) => row.status === 'OPTIMAL'),
	optimal.map((row) => `${row.engine}:${row.status}`),
);
assert(
	'OPTIMAL statusText',
	optimal.every((row) => row.statusText === '신호 최적화 완료'),
);
assert(
	'OPTIMAL cause copy',
	optimal.every((row) =>
		row.detectedCause.includes('모든 필수 온/오프페이지 신호가 정상적으로 식별'),
	),
);
assert(
	'OPTIMAL single maintain action',
	optimal.every((row) => row.actionItems.length === 1 && row.actionItems[0].includes('데이터 상태를 유지')),
);

const mixed: SiteAuditResult = {
	...allClear,
	hasLlmsTxt: true,
	robotsTxt: GPT_ALLOW_ROBOTS,
	sameAs: [],
	hasFaq: false,
	hasYoutubeCaptions: true,
	schemaGeo: allClear.schemaGeo,
	mapGeo: allClear.mapGeo,
};

const mixedRows = evaluateAiBottlenecks(mixed, [
	{ engine: 'chatgpt', mentionType: 'simple_mention', isCited: false },
]);
const chatgpt = mixedRows.find((row) => row.engine === 'chatgpt')!;
const gemini = mixedRows.find((row) => row.engine === 'gemini')!;
const perplexity = mixedRows.find((row) => row.engine === 'perplexity')!;

assert('chatgpt keeps only citation defect', chatgpt.actionItems.length === 1, chatgpt);
assert(
	'chatgpt cause is citation only',
	chatgpt.detectedCause.includes('인용(Citation) 신호 부재') &&
		!chatgpt.detectedCause.includes('llms.txt') &&
		!chatgpt.detectedCause.includes('Allow 선언되지'),
	chatgpt.detectedCause,
);
assert(
	'passed llms never listed as cause',
	!chatgpt.detectedCause.includes('루트에 있어') && !chatgpt.detectedCause.includes('차단은 확인되지'),
);
assert('chatgpt action 1:1', chatgpt.actionItems[0].includes('보도자료'));
assert('gemini OPTIMAL when geo+CC pass', gemini.status === 'OPTIMAL', gemini);
assert('perplexity FAQ-only defect', perplexity.actionItems.length === 1 && perplexity.status === 'WARNING', perplexity);
assert(
	'perplexity omits freshness when sitemap is recent',
	!perplexity.detectedCause.includes('60일') && perplexity.detectedCause.includes('FAQPage'),
	perplexity.detectedCause,
);

const naverLow = evaluateAiBottlenecks({
	...allClear,
	naverPlaceMenuCount: 1,
	naverKinExpertSignal: true,
}).find((row) => row.engine === 'navercue')!;
assert('naver menu count interpolates', naverLow.detectedCause.includes('1개로 등록 부족'), naverLow.detectedCause);
assert('naver kin passed is omitted', !naverLow.detectedCause.includes('지식iN'), naverLow.detectedCause);
assert('naver single action', naverLow.actionItems.length === 1 && naverLow.actionItems[0].includes('메뉴 3개'));

const gptBlocked = evaluateAiBottlenecks({
	hasLlmsTxt: false,
	robotsTxt: 'User-agent: *\nAllow: /',
});
const gpt = gptBlocked.find((row) => row.engine === 'chatgpt')!;
const gptCauses = gpt.detectedCause.split('\n').filter(Boolean);
assert('implicit * Allow is not explicit GPTBot Allow', gptCauses.some((line) => line.includes('Allow 선언되지')));
assert('cause/action counts match', gptCauses.length === gpt.actionItems.length, {
	causes: gptCauses,
	actions: gpt.actionItems,
});
assert('no leftover generic FAQ action on chatgpt', !gpt.actionItems.some((item) => item.includes('FAQ JSON-LD에')));

// —— checkBotAllowed regression: most persisted audit history never stores the
// raw robots.txt text, only the structured `aiBotAccess` boolean map computed
// at scan time. Without consulting that map, ChatGPT's Allow-declared bottleneck
// fired for every single site, even ones that explicitly allow GPTBot. ——
const CHATGPT_UAS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User'];

assert(
	'structured aiBotAccess map alone is enough — no raw robotsTxt needed',
	checkBotAllowed({ aiBotAccess: { gptbot: true, perplexitybot: true, claudebot: true, 'google-extended': true } }, CHATGPT_UAS),
);
assert(
	'explicit aiBotAccess block without raw text is still detected as blocked',
	!checkBotAllowed({ aiBotAccess: { gptbot: false } }, CHATGPT_UAS),
);
assert('no signal at all (no map, no raw text) is not allowed', !checkBotAllowed({}, CHATGPT_UAS));
assert(
	'raw robotsTxt text still works when aiBotAccess is absent',
	checkBotAllowed({ robotsTxt: GPT_ALLOW_ROBOTS }, CHATGPT_UAS),
);
assert(
	'checkBotAllowed is reusable for any other bot family (not just ChatGPT)',
	checkBotAllowed({ aiBotAccess: { claudebot: true } }, ['ClaudeBot', 'anthropic-ai']),
);

const gptAllowedViaLiveScanOnly = evaluateAiBottlenecks({
	hasLlmsTxt: true,
	bingPlacesLinked: true,
	sameAs: ['https://www.yna.co.kr/view/AKR20260301000000'],
	aiBotAccess: { gptbot: true, perplexitybot: true, claudebot: true, 'google-extended': true },
	// robotsTxt intentionally omitted — mirrors real siteAuditFromReport() output,
	// which never persists the raw robots.txt text.
}).find((row) => row.engine === 'chatgpt')!;
assert(
	'chatgpt: aiBotAccess.gptbot=true suppresses the Allow-not-declared warning even with no raw robotsTxt',
	!gptAllowedViaLiveScanOnly.detectedCause.includes('Allow 선언되지'),
	gptAllowedViaLiveScanOnly.detectedCause,
);
assert('chatgpt fully OPTIMAL via structured signals alone', gptAllowedViaLiveScanOnly.status === 'OPTIMAL', gptAllowedViaLiveScanOnly);

// —— ChatGPT Bing Places / SearchGPT local-index regression ——
const chatgptNoBing = evaluateAiBottlenecks({
	robotsTxt: GPT_ALLOW_ROBOTS,
	hasLlmsTxt: true,
	sameAs: ['https://www.yna.co.kr/view/AKR20260301000000'],
	bingPlacesLinked: false,
}).find((row) => row.engine === 'chatgpt')!;
assert(
	'missing Bing Places link triggers the SearchGPT local-index cause',
	chatgptNoBing.detectedCause.includes('Bing Places 미연동'),
	chatgptNoBing.detectedCause,
);
const chatgptWithBing = evaluateAiBottlenecks({
	robotsTxt: GPT_ALLOW_ROBOTS,
	hasLlmsTxt: true,
	sameAs: ['https://www.yna.co.kr/view/AKR20260301000000'],
	bingPlacesLinked: true,
}).find((row) => row.engine === 'chatgpt')!;
assert(
	'Bing Places linked omits the SearchGPT local-index cause',
	!chatgptWithBing.detectedCause.includes('Bing Places 미연동'),
	chatgptWithBing.detectedCause,
);

// —— Gemini geo-match regression: fully dynamic, no business/coordinate is
// hardcoded in evaluateAiBottlenecks.ts itself — every value here comes from
// the fixture, proving the logic works for any tenant's own lat/lng. ——
function reportWithGeo(
	source: 'map' | 'jsonld' | 'locality' | 'default' | null,
	schemaCoords: { lat: string; lng: string } | null,
	brandName = '테스트 사업장',
): AuditReport {
	return {
		url: 'https://example.com',
		score: 100,
		maxScore: 125,
		categories: [],
		checklist: [],
		findings: [],
		detectedKeywords: [],
		collectedUrls: [],
		footerText: '',
		siteMeta: {
			brandName,
			...(source
				? { geo: { latitude: '36.1234567', longitude: '129.7654321', source } }
				: {}),
		},
		metrics: {
			hasSitemap: true,
			jsonLdFullCorpus: schemaCoords
				? JSON.stringify({
						'@type': 'LocalBusiness',
						geo: { '@type': 'GeoCoordinates', latitude: schemaCoords.lat, longitude: schemaCoords.lng },
					})
				: '',
		},
	} as unknown as AuditReport;
}

// Case A — schema coords equal the map/GBP anchor 1:1 (same lat/lng), merged
// siteMeta.geo tagged 'jsonld' (map-script regex didn't fire) → must pass.
const matchedAudit = siteAuditFromReport(
	reportWithGeo('jsonld', { lat: '36.1234567', lng: '129.7654321' }, '부산 호텔 A'),
);
assert(
	"'jsonld'-sourced siteMeta.geo is accepted as the map anchor (not just 'map')",
	matchedAudit.mapGeo?.latitude === 36.1234567 && matchedAudit.mapGeo?.longitude === 129.7654321,
	matchedAudit.mapGeo,
);
const geminiMatched = evaluateAiBottlenecks({ ...matchedAudit, hasYoutubeCaptions: true }).find(
	(row) => row.engine === 'gemini',
)!;
assert(
	'identical schema/GBP coordinates yield no geo cause at all',
	!geminiMatched.detectedCause.includes('좌표'),
	geminiMatched.detectedCause,
);
assert('gemini OPTIMAL once geo matches and captions exist', geminiMatched.status === 'OPTIMAL', geminiMatched);

// Case B — schema has no GeoCoordinates whatsoever → "미등록", not "불일치".
const missingSchemaAudit = siteAuditFromReport(reportWithGeo('map', null, '서울 병원 B'));
const geminiMissing = evaluateAiBottlenecks({ ...missingSchemaAudit, hasYoutubeCaptions: true }).find(
	(row) => row.engine === 'gemini',
)!;
assert(
	'no schema geo at all branches to the "미등록" cause',
	geminiMissing.detectedCause.includes('좌표 미등록') && !geminiMissing.detectedCause.includes('불일치'),
	geminiMissing.detectedCause,
);

// Case C — schema coords exist but no verifiable map anchor at all (extraction
// fell back to the generic 'default' centroid) → treated as "불일치", not "미등록",
// since we cannot positively confirm a match either.
const noAnchorAudit = siteAuditFromReport(
	reportWithGeo('default', { lat: '35.1000000', lng: '129.0500000' }, '대구 의원 C'),
);
assert("'default' fallback centroid is rejected as an unverified map anchor", noAnchorAudit.mapGeo == null, noAnchorAudit.mapGeo);
const geminiNoAnchor = evaluateAiBottlenecks({ ...noAnchorAudit, hasYoutubeCaptions: true }).find(
	(row) => row.engine === 'gemini',
)!;
assert(
	'schema geo present but no map anchor branches to the "불일치" cause',
	geminiNoAnchor.detectedCause.includes('불일치') && !geminiNoAnchor.detectedCause.includes('미등록'),
	geminiNoAnchor.detectedCause,
);

// Case D — schema coords exist and diverge from a genuinely different map anchor.
const mismatchedAudit = siteAuditFromReport(
	reportWithGeo('locality', { lat: '33.4996000', lng: '126.5312000' }, '제주 리조트 D'),
);
mismatchedAudit.mapGeo = { latitude: 37.5665, longitude: 126.978 };
const geminiMismatch = evaluateAiBottlenecks({ ...mismatchedAudit, hasYoutubeCaptions: true }).find(
	(row) => row.engine === 'gemini',
)!;
assert(
	'genuinely distant coordinates branch to the "불일치" cause',
	geminiMismatch.detectedCause.includes('불일치') && !geminiMismatch.detectedCause.includes('미등록'),
	geminiMismatch.detectedCause,
);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
