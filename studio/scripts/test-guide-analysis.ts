/**
 * Guide KPI / channel briefing / 6-engine analysis.
 * Run: npx tsx scripts/test-guide-analysis.ts
 */
import { evaluateGuideAnalysis, type SiteAuditResult } from '../lib/analysis/evaluateAiBottlenecks';
import { NINEONE_GUIDE_SAMPLE } from '../lib/guide/sample';
import { emptyGuideData } from '../lib/guide/sample';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}`, detail ?? '');
}

const audit: SiteAuditResult = {
	brandName: '나인원의원',
	brandNameEng: 'Nine One Clinic',
	address: '대구광역시 동구 동부로 26길 6',
	industry: '흉터 치료',
	seoScore: 125,
	seoMaxScore: 125,
	schemaCoverage: 92,
	geoCitationScore: 68,
	hasLlmsTxt: false,
	hasSitemap: true,
	hasFaq: false,
	hasArticle: true,
	hasMedicalCausalText: false,
	hasLocalBusiness: true,
	hasGeoCoordinates: true,
	googleMapsLinked: false,
	naverPlaceLinked: true,
	naverBlogLinked: false,
	naverPlaceMenuCount: 2,
	coreFeatureCount: 3,
	bodyLength: 620,
	isHttps: true,
	napNameKo: '나인원의원',
	napAddress: '대구광역시 동구 동부로 26길 6',
};

const analysis = evaluateGuideAnalysis(audit, [
	{ engine: 'chatgpt', mentionType: 'simple_mention', isCited: false },
	{ engine: 'perplexity', mentionType: 'none', isCited: false },
]);

assert('returns 6 engine diagnoses', analysis.aiEngineDiagnoses.length === 6);
assert(
	'engine ids complete',
	analysis.aiEngineDiagnoses.map((row) => row.engine).join(',') ===
		'chatgpt,gemini,perplexity,claude,copilot,navercue',
);
assert('SEO score mapped', analysis.observedSeoScore === 125);
assert('SEO max mapped', analysis.seoMaxScore === 125);
assert('AI trust in 0-100', analysis.aiTrustScore >= 0 && analysis.aiTrustScore <= 100);
assert('AI potential in 0-100', analysis.aiPotentialScore >= 0 && analysis.aiPotentialScore <= 100);
assert('subScores specialty present', analysis.subScores.specialty >= 0);
assert('channel briefing has 3 cards', Boolean(analysis.channelBriefing.aiSearch.statusBadge));
assert('google briefing mentions SEO', analysis.channelBriefing.googleSearch.description.includes('SEO'));
assert('perplexity critical when FAQ+freshness missing', analysis.aiEngineDiagnoses.find((row) => row.engine === 'perplexity')?.status === 'CRITICAL');

const sample = NINEONE_GUIDE_SAMPLE;
assert('sample slug nineone', sample.slug === 'nineone');
assert('sample KPI 125/75/75', sample.observedSeoScore === 125 && sample.aiTrustScore === 75 && sample.aiPotentialScore === 75);
assert('sample has 6 engines', sample.aiEngineDiagnoses.length === 6);
assert('sample channel amber/blue/green', sample.channelBriefing.aiSearch.badgeType === 'amber' && sample.channelBriefing.googleSearch.badgeType === 'blue' && sample.channelBriefing.naverPlace.badgeType === 'green');

const empty = emptyGuideData();
assert('empty diagnoses 6', empty.aiEngineDiagnoses.length === 6);
assert('empty briefing placeholder', empty.channelBriefing.aiSearch.statusBadge === '진단 대기');

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
