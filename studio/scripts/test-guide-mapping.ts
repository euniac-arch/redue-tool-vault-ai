/**
 * Guide mapping integrity + Korean particles.
 * Run: npx tsx scripts/test-guide-mapping.ts
 */
import { evaluateGuideAnalysis, type SiteAuditResult } from '../lib/analysis/evaluateAiBottlenecks';
import { buildGuideFaq } from '../lib/guide/from-audit';
import { distributeSubScoresFromTrust, sanitizeGuideScores } from '../lib/guide/scores';
import { getKoreanParticle, withKoreanParticle } from '../lib/utils/korean';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`, detail ?? '');
}

assert('particle 원 → 은', getKoreanParticle('나인원의원', '은/는') === '은');
assert('particle 원 → 을', getKoreanParticle('나인원의원', '을/를') === '을');
assert('particle 과 → 는', getKoreanParticle('피부과', '은/는') === '는');
assert('with 은/는', withKoreanParticle('나인원의원', '은/는') === '나인원의원은');
assert('no parenthetical 은(는)', !withKoreanParticle('나인원의원', '은/는').includes('(은)'));

const nanScores = sanitizeGuideScores({
	observedSeoScore: Number.NaN,
	seoMaxScore: undefined,
	aiTrustScore: 'x' as unknown as number,
	aiPotentialScore: Number.POSITIVE_INFINITY,
	subScores: { specialty: Number.NaN, localPresence: 88 },
});
assert('NaN SEO → 0', nanScores.observedSeoScore === 0);
assert('missing max → 125', nanScores.seoMaxScore === 125);
assert('NaN trust → 0', nanScores.aiTrustScore === 0);
assert('Infinity potential → 0', nanScores.aiPotentialScore === 0);
assert('mapped localPresence kept', nanScores.subScores.localPresence === 88);
assert('NaN specialty → 0 not 75', nanScores.subScores.specialty === 0);

// Genuinely missing (undefined) KPI fields fall back to presentable placeholders,
// not 0 — this only applies to fields that were never provided at all.
const missingScores = sanitizeGuideScores({});
assert('missing observedSeoScore → 125 default', missingScores.observedSeoScore === 125, missingScores.observedSeoScore);
assert('missing aiTrustScore → 85 default', missingScores.aiTrustScore === 85, missingScores.aiTrustScore);
assert('missing aiPotentialScore → 80 default', missingScores.aiPotentialScore === 80, missingScores.aiPotentialScore);
assert(
	'missing subScores distribute from the default trust score (85)',
	Object.values(missingScores.subScores).every((n) => n === 85),
	missingScores.subScores,
);

// A literal, explicitly-provided score of 0 is still real measured data — not "missing" —
// so it must never be silently swapped for a placeholder.
const zeroScores = sanitizeGuideScores({ observedSeoScore: 0, aiTrustScore: 0, aiPotentialScore: 0 });
assert('explicit 0 SEO score is kept, not defaulted', zeroScores.observedSeoScore === 0);
assert('explicit 0 trust score is kept, not defaulted', zeroScores.aiTrustScore === 0);
assert('explicit 0 potential score is kept, not defaulted', zeroScores.aiPotentialScore === 0);

// Partial subScores keep the measured fields and only backfill the missing axes.
const partialSubScores = sanitizeGuideScores({ aiTrustScore: 60, subScores: { specialty: 95 } });
assert('measured specialty kept over trust-derived fallback', partialSubScores.subScores.specialty === 95);
assert('missing localPresence backfilled from trust score', partialSubScores.subScores.localPresence === 60);

assert('distributeSubScoresFromTrust spreads one value across all 5 axes', (() => {
	const dist = distributeSubScoresFromTrust(42);
	return Object.values(dist).every((n) => n === 42);
})());

const faq = buildGuideFaq({
	brandName: '나인원의원',
	region: '대구 동구',
	address: '대구광역시 동구 동부로 26길 6',
	industry: '피부과',
	coreFeatures: ['울트라클리어', '덴서티'],
});
assert('faq uses 은', faq.answer.includes('나인원의원은'));
assert('faq uses 를', faq.question.includes('울트라클리어·덴서티를') || faq.answer.includes('울트라클리어·덴서티를'));
assert('faq has no (을)를', !faq.question.includes('(을)') && !faq.answer.includes('(를)'));

const audit: SiteAuditResult = {
	brandName: '나인원의원',
	industry: '피부과',
	coreFeatures: ['울트라클리어', '덴서티'],
	seoScore: 125,
	seoMaxScore: 125,
	aiTrustScore: 93,
	aiPotentialScore: 81,
	subScores: { specialty: 100, localPresence: 72, authority: 100, uniqueness: 100, awareness: 100 },
	schemaCoverage: 90,
	geoCitationScore: 70,
	hasLlmsTxt: false,
	hasSitemap: true,
	hasFaq: true,
	hasLocalBusiness: true,
	hasGeoCoordinates: true,
	googleMapsLinked: true,
	naverPlaceLinked: true,
	naverPlaceMenuCount: 4,
	coreFeatureCount: 2,
	bodyLength: 800,
	isHttps: true,
};

const analysis = evaluateGuideAnalysis(audit);
assert('observed SEO 125 not overwritten', analysis.observedSeoScore === 125, analysis.observedSeoScore);
assert('trust 93 not default 75', analysis.aiTrustScore === 93, analysis.aiTrustScore);
assert('potential 81 not default 75', analysis.aiPotentialScore === 81, analysis.aiPotentialScore);
assert('sub specialty 100', analysis.subScores.specialty === 100);
assert('sub local 72', analysis.subScores.localPresence === 72);
assert('briefing has no 이(가)', !analysis.channelBriefing.aiSearch.description.includes('(가)'));
assert('briefing names features', analysis.channelBriefing.aiSearch.description.includes('울트라클리어'));

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
