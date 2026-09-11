/**
 * Studio test groups. Keep ASI and SEO/GEO score suites independent.
 *
 *   node scripts/run-tests.mjs
 *   node scripts/run-tests.mjs asi
 *   node scripts/run-tests.mjs score
 *   node scripts/run-tests.mjs provider
 *   node scripts/run-tests.mjs integration
 *   node scripts/run-tests.mjs audit-engine
 */

export const TEST_GROUPS = {
	asi: [
		'scripts/test-intelligence-nav.ts',
		'scripts/test-intelligence-war-room.ts',
		'scripts/test-intelligence-perception.ts',
		'scripts/test-intelligence-recommendation.ts',
		'scripts/test-intelligence-simulator.ts',
		'scripts/test-intelligence-evidence.ts',
		'scripts/test-intelligence-future.ts',
		'scripts/test-intelligence-audit-bridge.ts',
		'scripts/test-intelligence-core.ts',
		'scripts/test-intelligence-parser.ts',
		'scripts/test-intelligence-core-models.ts',
		'scripts/test-intelligence-opportunity.ts',
		'scripts/test-intelligence-evidence-explorer.ts',
		'scripts/test-intelligence-competitor-gap.ts',
		'scripts/test-intelligence-competitor-pipeline.ts',
		'scripts/test-intelligence-target-engine.ts',
		'scripts/test-intelligence-query-engine.ts',
		'scripts/test-intelligence-universal-architecture.ts',
		'scripts/test-intelligence-next-action.ts',
		'scripts/test-intelligence-visibility.ts',
		'scripts/test-intelligence-loop.ts',
		'scripts/test-intelligence-system.ts',
		'scripts/test-intelligence-ia.ts',
		'scripts/test-intelligence-entitlement.ts',
		'scripts/test-intelligence-admin-qa.ts',
		'scripts/test-intelligence-admin-verify.ts',
		'scripts/test-intelligence-access.ts',
		'scripts/test-intelligence-providers-connection.ts',
		'scripts/test-intelligence-query-plan.ts',
		'scripts/test-intelligence-history.ts',
		'scripts/test-intelligence-remeasure.ts',
		'scripts/test-intelligence-quota.ts',
		'scripts/test-intelligence-guard.ts',
		'scripts/test-intelligence-cost.ts',
		'scripts/test-intelligence-security.ts',
		'scripts/test-intelligence-provenance.ts',
		'scripts/test-intelligence-qa.ts',
		'scripts/test-intelligence-final.ts',
		'scripts/test-intelligence-ui.ts',
		'scripts/test-intelligence-envelope.ts',
		'scripts/test-intelligence-control-bar.ts',
		'scripts/test-intelligence-lazy-modules.ts',
		'scripts/test-intelligence-site-context.ts',
	],
	score: [
		'scripts/test-audit-score-calculator.ts',
		'scripts/test-geo-score-calculator.ts',
		'scripts/test-live-check-score.ts',
		'scripts/test-score-integrity.ts',
		'scripts/test-score-pipeline-sync.ts',
		'scripts/test-diagnostic-score-sync.ts',
		'scripts/test-history-measured-score.ts',
		'scripts/test-guide-analysis.ts',
		'scripts/test-guide-bottlenecks.ts',
		'scripts/test-smart-hashtags.ts',
		'scripts/test-guide-mapping.ts',
		'scripts/test-guide-history-picker.ts',
		'scripts/test-geo-work-guide.ts',
		'scripts/test-generic-sov.ts',
		'scripts/test-sov-live-measure.ts',
		'scripts/test-audit-pdf-lock.ts',
	],
	provider: [
		'scripts/test-intelligence-providers.ts',
		'scripts/test-intelligence-providers-live.ts',
		'scripts/test-intelligence-providers-health.ts',
	],
	integration: ['scripts/test-intelligence-envelope.ts', 'scripts/test-intelligence-api.ts'],
	'audit-engine': ['scripts/test-full-audit-engine.ts'],
};

export const DEFAULT_GROUPS = ['score', 'asi', 'provider', 'integration', 'audit-engine'];
