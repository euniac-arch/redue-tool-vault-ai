import { generateAllCmsSnippets } from './cms-snippets';
import { getIssueSolutionGuide } from './issue-solution-guide';
import type { SolveAuditSnapshot, SolveIssue } from './types';

function buildIssue(
	code: string,
	title: string,
	category: string,
	severity: SolveIssue['severity'],
	estMinutes: number,
	cmsType = 'WordPress',
): SolveIssue {
	const guide = getIssueSolutionGuide(code, cmsType, { title, description: title });
	const cmsCode = generateAllCmsSnippets(code, {
		targetUrl: 'https://example.com',
		title: 'Example Site',
		siteName: 'Example',
		description: 'Example site description for SEO demo snippets.',
	});
	return {
		code,
		title,
		category,
		severity,
		estMinutes,
		description: guide.summary,
		solutionGuide: guide,
		cmsCode,
	};
}

/** Demo audit used when no AuditLead is selected — mirrors inspector dashboard sample shape. */
export function buildDemoSolveAudit(): SolveAuditSnapshot {
	const issues: SolveIssue[] = [
		buildIssue('CANONICAL_MISSING', 'Canonical 태그 누락', 'SEO / Meta', 'FAIL', 20),
		buildIssue('SCHEMA_MISSING', 'JSON-LD Schema 미적용', 'GEO / Schema', 'FAIL', 45),
		buildIssue('H1_MISSING', 'H1 태그 누락', 'SEO / Meta', 'FAIL', 15),
		buildIssue('SITEMAP_NOT_FOUND', 'sitemap.xml 미발견', '크롤링', 'WARN', 30),
		buildIssue('NOT_HTTPS', 'HTTPS 미적용', '보안', 'WARN', 60),
		buildIssue('TITLE_MISSING', 'Title 태그 최적화 필요', 'SEO / Meta', 'WARN', 15),
	];

	const failWarn = issues.filter((i) => i.severity !== 'PASS').length;
	return {
		id: 'demo',
		targetUrl: 'https://example.com',
		overallScore: 62,
		schemaCoveragePercent: Math.max(0, 100 - failWarn * 12),
		cmsType: 'WordPress',
		issues,
	};
}
