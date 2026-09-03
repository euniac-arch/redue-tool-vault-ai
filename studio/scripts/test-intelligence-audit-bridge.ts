/**
 * Audit → ASI bridge: read-only signals, no SEO score copy.
 * Run: npx tsx scripts/test-intelligence-audit-bridge.ts
 */
import { ASI_AUDIT_INFLUENCE, extractAsiAuditBridge } from '../lib/ai-search-intelligence/audit-bridge';
import { buildMockAgentReadinessSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-agent-readiness';
import { buildMockEvidenceSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-evidence';
import { buildMockPerceptionSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-perception';
import { buildMockRecommendationSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-recommendation';
import { buildMockWarRoomSnapshot } from '../lib/ai-search-intelligence/mock/build-mock-war-room';
import type { LatestAuditPayload } from '../lib/audit/latest-audit-payload';
import type { AuditReport } from '../lib/site-auditor';

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const url = 'https://sunshineclinic.kr';

const report = {
	url,
	lang: 'ko',
	fetchedAt: '2026-01-01T00:00:00.000Z',
	httpStatus: 200,
	responseTimeMs: 10,
	pageSizeBytes: 1000,
	score: 84,
	maxScore: 100,
	status: 'ok',
	statusLabel: 'ok',
	schemaCoverage: 20,
	geoCitationScore: 30,
	siteMeta: {
		brandName: 'Sunshine Clinic',
		location: '대구',
		primaryKeyword: '흉터 치료',
		faqItems: [],
		sameAs: [],
		schemaOrganizationNames: ['다른상호'],
	},
	metrics: {
		organizationMissing: ['address'],
		personMissing: ['name'],
		hasLlmsTxt: false,
		schemaTypes: [],
	},
	categories: [],
	findings: [],
	checklist: [
		{ id: 'jsonld-present', label: 'jsonld', passed: false, status: 'fail', weight: 1 },
		{ id: 'organization', label: 'org', passed: false, status: 'fail', weight: 1 },
		{ id: 'faq-howto-schema', label: 'faq', passed: false, status: 'fail', weight: 1 },
		{ id: 'llms-txt', label: 'llms', passed: false, status: 'fail', weight: 1 },
	],
} as unknown as AuditReport;

const audit: LatestAuditPayload = {
	auditId: 'test',
	report,
	defectCount: 4,
	score: 84,
	maxScore: 100,
	savedAt: '2026-01-01T00:00:00.000Z',
};

const unboundWar = buildMockWarRoomSnapshot({ url });
const boundWar = buildMockWarRoomSnapshot({ url, audit });
const boundPerception = buildMockPerceptionSnapshot({ url, audit });
const boundRec = buildMockRecommendationSnapshot({ url, audit });
const boundEvidence = buildMockEvidenceSnapshot({ url, audit });
const boundReady = buildMockAgentReadinessSnapshot({ url, audit });
const bridge = extractAsiAuditBridge(audit, url);

assert('unbound still mock', unboundWar?.source === 'mock');
assert('bound is derived', boundWar?.source === 'derived');
assert('seo score preserved on bind', boundWar?.auditBind?.seoScore === 84);
assert('seo is not copied to visibility', boundWar?.kpis.visibility !== 84);
assert(
	'schema lowers trust',
	(boundWar?.kpis.trustScore ?? 0) === (unboundWar?.kpis.trustScore ?? 0) - ASI_AUDIT_INFLUENCE.schemaToTrust,
);
assert(
	'faq lowers recommendation',
	(boundWar?.kpis.recommendationRate ?? 0) ===
		(unboundWar?.kpis.recommendationRate ?? 0) - ASI_AUDIT_INFLUENCE.faqToRecommendation,
);
assert('trust aligns perception', boundWar?.kpis.trustScore === boundPerception?.trustScore);
assert('rec aligns simulator', boundWar?.kpis.recommendationRate === boundRec?.simulator.potential);
assert('rec aligns perception axis', boundWar?.kpis.recommendationRate === boundPerception?.axes.recommendation);
assert('readiness aligns future', boundWar?.kpis.agentReadiness === boundReady?.overall);
assert('local axis dropped', (boundPerception?.axes.local ?? 99) < 90);
assert('citation authority dropped', (boundEvidence?.citations.find((item) => item.kind === 'official')?.relation || '').includes('Citation'));
assert('six mapped links', bridge?.links.length === 6);
assert('all example gaps fire', bridge?.links.every((link) => link.gap) === true);
assert('seven audit signals exposed', Object.keys(bridge?.signals || {}).length === 7);
assert('schema signal matches gap', bridge?.signals.schema === true);
assert('faq signal matches gap', bridge?.signals.faq === true);
assert('citation signal matches gap', bridge?.signals.citation === true);
assert('wrong url does not bind', extractAsiAuditBridge(audit, 'https://other.example') === null);
assert('unbound seo score unchanged', unboundWar?.kpis.visibility === buildMockWarRoomSnapshot({ url })?.kpis.visibility);

if (failed) {
	console.error(`\n${failed} failed`);
	process.exit(1);
}
console.log('\nall passed');
