/**
 * GEO 4-pillar comprehensive score engine.
 * Run: npx tsx scripts/test-geo-score-calculator.ts
 */
import { buildDiagnosisScoreSnapshot } from '../lib/audit/diagnosis-scores';
import {
	GEO_PILLAR_ANCHOR_IDS,
	GEO_PILLAR_IDS,
	GEO_PILLAR_MAX,
	GEO_TOTAL_MAX,
	calculateGeoComprehensiveFromReport,
	calculateGeoComprehensiveScores,
	resolveGeoPillarBadgeCopy,
	resolveGeoPillarBadgeTheme,
	resolveGeoPillarStatus,
	scoreBrandMentionVolume,
	scoreEntityAxisItems,
	type GeoRawSignals,
} from '../lib/audit/geoScoreCalculator';
import { HTTPS_GEO_PENALTY, HTTPS_GRADE_HARD_CAP } from '../lib/audit/scoreCalculator';
import type { AuditCategory, AuditCheckItem, AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const fullPass: GeoRawSignals = {
	hasKnowledgeGraph: true,
	taxId: '123-45-67890',
	placeCid: '123456789012345',
	sameAsCount: 3,
	hasPersonKg: true,
	brandDisambiguated: true,
	allowAiBots: true,
	hasLlmsTxt: true,
	hasSearchIndex: true,
	hasNaverPlace: true,
	napMatchRate: 94,
	hasGoogleMap: true,
	hasBingPlaces: true,
	bodyLength: 2400,
	hasEeatDocs: true,
	mentionCount: 277,
	googleMentionCount: 220,
	googleMentionBenchmark: 220,
	naverMentionCount: 57,
};

const full = calculateGeoComprehensiveScores(fullPass, true, 'ko');
assert('full pass raw is 100', full.rawGeoScore === 100, String(full.rawGeoScore));
assert('full pass final is 100', full.finalGeoScore === 100);
assert('full pass is not capped', full.isCapped === false);
assert('four pillars exist', full.pillarList.length === 4);
assert(
	'each pillar max is 25',
	full.pillarList.every((pillar) => pillar.max === GEO_PILLAR_MAX && pillar.earned === 25),
);
assert(
	'raw equals pillar sum',
	full.rawGeoScore === full.pillarList.reduce((sum, pillar) => sum + pillar.earned, 0),
);
assert(
	'anchors match the four measured cards',
	GEO_PILLAR_IDS.every((id) => full.pillars[id].targetAnchorId === GEO_PILLAR_ANCHOR_IDS[id]),
);

const httpFull = calculateGeoComprehensiveScores(fullPass, false, 'ko');
assert('HTTP full is capped', httpFull.isCapped === true);
assert(
	'HTTP final is min(78, 100-10)',
	httpFull.finalGeoScore === Math.min(HTTPS_GRADE_HARD_CAP, 100 - HTTPS_GEO_PENALTY),
	String(httpFull.finalGeoScore),
);
assert('HTTP raw stays the 4-pillar sum', httpFull.rawGeoScore === 100);

const empty = calculateGeoComprehensiveScores(
	{
		brandDisambiguated: false,
		allowAiBots: false,
		hasSearchIndex: false,
		napMatchRate: 0,
		bodyLength: 0,
		mentionCount: 0,
	},
	true,
	'ko',
);
assert('empty entity earns tax/CID floor + sameAs floor + domain floor', empty.pillars.entity.earned === 2 + 1 + 4, String(empty.pillars.entity.earned));

const measured48: GeoRawSignals = {
	taxId: '433-81-03415',
	placeCid: '',
	sameAsCount: 2,
	hasPersonKg: false,
	brandDisambiguated: true,
	allowAiBots: true,
	hasLlmsTxt: true,
	hasSearchIndex: true,
	hasNaverPlace: true,
	napMatchRate: 94,
	hasGoogleMap: true,
	hasBingPlaces: true,
	bodyLength: 2400,
	hasEeatDocs: true,
	mentionCount: 277,
	googleMentionCount: 220,
	googleMentionBenchmark: 220,
	naverMentionCount: 57,
};
const axis1 = calculateGeoComprehensiveScores(measured48, true, 'ko');
assert('taxID-only + SNS×2 + no CID/KG is 12/25', axis1.pillars.entity.earned === 12, String(axis1.pillars.entity.earned));
assert('12/25 is 48% — 1:1 with entity gauge', axis1.pillars.entity.percentage === 48, String(axis1.pillars.entity.percentage));
assert(
	'axis-1 items are 5 + 3 + 4',
	axis1.pillars.entity.items.map((item) => item.score).join('+') === '5+3+4',
	axis1.pillars.entity.items.map((item) => `${item.id}:${item.score}`).join(', '),
);
assert('12/25 is 보완 필요, not 양호', resolveGeoPillarBadgeCopy(axis1.pillars.entity) === 'needs_work');
assert(
	'CID miss is called out in evidence',
	Boolean(axis1.pillars.entity.items[0].evidence?.includes('433-81-03415')) &&
		Boolean(axis1.pillars.entity.items[0].evidence?.includes('CID')),
	axis1.pillars.entity.items[0].evidence,
);
const syncedItems = scoreEntityAxisItems(measured48, 'ko');
assert(
	'scoreEntityAxisItems matches the pillar',
	syncedItems.reduce((sum, item) => sum + item.score, 0) === 12 && syncedItems[0].passed === false && syncedItems[1].passed === false,
);
assert('empty bots earn index floor only', empty.pillars.bot_index.earned === 5, String(empty.pillars.bot_index.earned));
assert('empty NAP earns naver floor + maps floor', empty.pillars.local_nap.earned === 4 + 4 + 0, String(empty.pillars.local_nap.earned));
assert('empty authority earns density + ref + mention floors', empty.pillars.rag_authority.earned === 5 + 4 + 4, String(empty.pillars.rag_authority.earned));
assert(
	'empty evidence does not invent 94% or 187 mentions',
	!empty.pillars.local_nap.items[0].evidence?.includes('94') &&
		!empty.pillars.rag_authority.items[2].evidence?.includes('187'),
	`${empty.pillars.local_nap.items[0].evidence} / ${empty.pillars.rag_authority.items[2].evidence}`,
);

const belowAvgMentions: GeoRawSignals = {
	...fullPass,
	hasNaverPlace: false,
	napMatchRate: 94,
	hasGoogleMap: false,
	hasBingPlaces: false,
	googleMentionCount: 187,
	googleMentionBenchmark: 220,
	naverMentionCount: 57,
	mentionCount: 244,
};
const below = calculateGeoComprehensiveScores(belowAvgMentions, true, 'ko');
assert(
	'NAP 7+4+0 is 11 when Google Maps and Bing are missing',
	below.pillars.local_nap.earned === 11,
	String(below.pillars.local_nap.earned),
);
assert(
	'below-average Google mentions score 5/7 not 7/7',
	below.pillars.rag_authority.items[2].score === 5 && below.pillars.rag_authority.items[2].passed === false,
	JSON.stringify(below.pillars.rag_authority.items[2]),
);
assert(
	'RAG pillar is 23/25 when mentions are below the regional average',
	below.pillars.rag_authority.earned === 23,
	String(below.pillars.rag_authority.earned),
);
assert(
	'23/25 with a failed mention item is warn, not ok',
	resolveGeoPillarStatus(below.pillars.rag_authority) === 'warn',
);
assert(
	'11/25 NAP is urgent',
	resolveGeoPillarStatus(below.pillars.local_nap) === 'urgent',
);
assert(
	'23/25 header copy is 보완 권장',
	resolveGeoPillarBadgeCopy(below.pillars.rag_authority) === 'recommend',
);
assert(
	'11/25 header copy is 보완 시급',
	resolveGeoPillarBadgeCopy(below.pillars.local_nap) === 'urgent',
);
assert(
	'12/25 header copy is 보완 필요',
	resolveGeoPillarBadgeCopy({ percentage: 48, items: [{ id: 'x', name: 'x', score: 12, maxScore: 25, passed: false }] }) ===
		'needs_work',
);
assert(
	'17/25 header copy is 주의',
	resolveGeoPillarBadgeCopy({ percentage: 68, items: [{ id: 'x', name: 'x', score: 17, maxScore: 25, passed: false }] }) ===
		'warn',
);
assert('urgent theme is rose', resolveGeoPillarBadgeTheme('urgent') === 'rose');
assert('recommend theme is amber', resolveGeoPillarBadgeTheme('recommend') === 'amber');
assert('ok theme is emerald', resolveGeoPillarBadgeTheme('ok') === 'emerald');
assert(
	'mention evidence cites 187 < 220',
	Boolean(below.pillars.rag_authority.items[2].evidence?.includes('187')) &&
		Boolean(below.pillars.rag_authority.items[2].evidence?.includes('220')),
	below.pillars.rag_authority.items[2].evidence,
);
assert('187 vs 220 scores 5', scoreBrandMentionVolume(187, 220).score === 5);
assert('220 vs 220 scores 7', scoreBrandMentionVolume(220, 220).passed === true);
assert('0 vs 220 scores the floor', scoreBrandMentionVolume(0, 220).score === 4);
assert('each empty pillar stays ≤ 25', empty.pillarList.every((pillar) => pillar.earned <= GEO_PILLAR_MAX));
assert('empty raw ≤ 100', empty.rawGeoScore <= GEO_TOTAL_MAX);

function check(id: string, status: AuditCheckItem['status'], weight: number): AuditCheckItem {
	return { id, label: id, status, passed: status === 'pass', weight };
}

function category(id: AuditCategory['id'], score: number, maxScore: number, checks: AuditCheckItem[]): AuditCategory {
	return { id, label: id, score, maxScore, status: 'PASS', statusNote: '', checks };
}

function report(): AuditReport {
	const categories = [
		category('security', 15, 15, [check('https', 'pass', 10), check('response-time', 'pass', 5)]),
		category('geo', 12, 12, [check('llms-txt', 'pass', 6), check('ai-bots-allowed', 'pass', 6)]),
	];
	return {
		url: 'https://clinic.example/',
		lang: 'ko',
		fetchedAt: '2026-08-16T00:00:00.000Z',
		httpStatus: 200,
		responseTimeMs: 80,
		pageSizeBytes: 20_000,
		score: 27,
		maxScore: 122,
		status: 'FAIR',
		statusLabel: '보통',
		hasSsl: true,
		categories,
		checklist: categories.flatMap((item) => item.checks),
		findings: [],
		metrics: {
			titleLength: 20,
			metaDescriptionLength: 80,
			h1Count: 1,
			headingSkipDetected: false,
			imagesTotal: 0,
			imagesMissingAlt: 0,
			imageAltCoveragePct: 100,
			jsonLdBlockCount: 1,
			schemaTypes: ['MedicalClinic', 'Organization'],
			bodyTextLength: 1800,
			renderBlockingScripts: 0,
			hasLlmsTxt: true,
			aiBotAccess: { gptbot: true, perplexitybot: true },
		},
	};
}

const fromReport = calculateGeoComprehensiveFromReport(report(), true, 'ko');
assert('report path returns four pillars', fromReport.pillarList.length === 4);
assert(
	'report raw equals pillar sum',
	fromReport.rawGeoScore === fromReport.pillarList.reduce((sum, pillar) => sum + pillar.earned, 0),
);

const snapshot = buildDiagnosisScoreSnapshot(report(), null, 'ko');
assert(
	'snapshot geoScore is the 4-pillar raw sum',
	snapshot.externalTrustScore === snapshot.geoComprehensive.rawGeoScore &&
		snapshot.scores.geoScore === snapshot.geoComprehensive.rawGeoScore &&
		snapshot.detailed.geoScore === snapshot.geoComprehensive.rawGeoScore,
	`${snapshot.externalTrustScore} vs ${snapshot.geoComprehensive.rawGeoScore}`,
);
assert(
	'snapshot reputation overview matches the same raw sum',
	snapshot.reputation.overview.score === snapshot.geoComprehensive.rawGeoScore,
	`${snapshot.reputation.overview.score} vs ${snapshot.geoComprehensive.rawGeoScore}`,
);
assert(
	'pillar badges stay 1:1 with the headline',
	snapshot.geoComprehensive.pillarList.reduce((sum, pillar) => sum + pillar.earned, 0) === snapshot.externalTrustScore,
);

if (failed) {
	console.error(`\n${failed} assertion(s) failed`);
	process.exit(1);
}
console.log('\nall geo-score-calculator assertions passed');
