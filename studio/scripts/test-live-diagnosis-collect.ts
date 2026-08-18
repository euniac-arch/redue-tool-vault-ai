/**
 * Live collector smoke test against public URLs.
 * Run: npx tsx scripts/test-live-diagnosis-collect.ts
 */
import { auditSite } from '../lib/site-auditor';
import { runScorePipeline } from '../lib/audit/scorePipeline';
import { buildOnPageDiagnostic, normalizeChecklistItems } from '../lib/audit/onpage-diagnostic';

const TARGETS = [
	'https://example.com',
	'http://wikipedia.org',
	'https://www.iana.org',
];

async function runOne(url: string) {
	const report = await auditSite(url, 'ko', { forceRefresh: true });
	const onpage = buildOnPageDiagnostic(report);
	const pipeline = runScorePipeline(normalizeChecklistItems(report), report.hasSsl !== false);
	const catSum = onpage.categories.reduce((sum, cat) => sum + cat.rawScore, 0);
	const catMax = onpage.categories.reduce((sum, cat) => sum + cat.maxScore, 0);
	const defects = onpage.categories.reduce((sum, cat) => sum + cat.defectCount, 0);
	const warnings = onpage.categories.reduce((sum, cat) => sum + cat.warningCount, 0);

	const ok =
		Number.isFinite(pipeline.totalEarned) &&
		Number.isFinite(pipeline.normalizedTotalScore) &&
		pipeline.totalEarned <= pipeline.totalMax &&
		pipeline.totalEarned >= 0 &&
		catMax === 122 &&
		Math.abs(catSum - pipeline.totalEarned) < 0.11 &&
		pipeline.defectCount === defects &&
		pipeline.warningCount === warnings &&
		Boolean(report.metrics?.documentTitle || report.metrics?.pageTitle || report.httpStatus);

	console.log(
		[
			ok ? 'ok ' : 'FAIL',
			url,
			`→ ${report.finalUrl || report.url}`,
			`HTTP ${report.httpStatus}`,
			`raw ${pipeline.totalEarned}/${pipeline.totalMax}`,
			`100=${pipeline.normalizedTotalScore}`,
			`title="${(report.metrics?.documentTitle || report.metrics?.pageTitle || '').slice(0, 40)}"`,
			`schema=[${(report.metrics?.schemaTypes || []).slice(0, 6).join(',')}]`,
			`robots=${report.indexStatus?.robotsTxtOk ? 'ok' : 'miss'}`,
			`sitemap=${report.sitemap?.ok ? 'ok' : 'miss'}`,
			`hsts=${report.metrics?.hasHsts ? 'yes' : 'no'}`,
			`ssl=${report.hasSsl ? 'yes' : 'no'}`,
			`결함 ${defects} / 주의 ${warnings}`,
		].join('  '),
	);

	if (!ok) {
		console.error('  integrity', {
			catSum,
			pipelineEarned: pipeline.totalEarned,
			catMax,
			defects,
			pipelineDefects: pipeline.defectCount,
			warnings,
			pipelineWarnings: pipeline.warningCount,
		});
	}
	return ok;
}

async function main() {
	let failed = 0;
	for (const url of TARGETS) {
		try {
			const ok = await runOne(url);
			if (!ok) failed += 1;
		} catch (err) {
			failed += 1;
			console.error(`FAIL ${url} —`, err instanceof Error ? err.message : err);
		}
	}
	if (failed) {
		console.error(`\n${failed} live target(s) failed integrity`);
		process.exit(1);
	}
	console.log('\nall live diagnosis-collect checks passed');
}

main();
