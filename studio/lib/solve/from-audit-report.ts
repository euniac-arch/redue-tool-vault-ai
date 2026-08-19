import { dedupeRepeatedPhrase } from '@/lib/audit/brand-name';
import type { AuditCheckItem, AuditReport } from '@/lib/site-auditor';
import { pagesFromAuditPaths, sanitizeMainPageTitle } from '@/lib/solve/dynamic-php-schema';
import { generateAllCmsSnippets } from '@/lib/solve/cms-snippets';
import { buildFileIssueTargetReport } from '@/lib/solve/file-issue-report';
import { getIssueSolutionGuide } from '@/lib/solve/issue-solution-guide';
import { extractAuditUrlPaths } from '@/lib/solve/source-mapping';
import { toSolveCmsDisplay, type IssueSeverity, type SolveAuditSnapshot, type SolveIssue } from '@/lib/solve/types';

/** Free-audit check id → solution-guide issue code */
const CHECK_ID_TO_ISSUE_CODE: Record<string, string | ((check: AuditCheckItem) => string)> = {
	title: (c) => (c.status === 'fail' || (!c.passed && !c.status) ? 'TITLE_MISSING' : 'TITLE_LENGTH_SUBOPTIMAL'),
	'meta-description': (c) =>
		c.status === 'fail' || (!c.passed && !c.status) ? 'META_DESC_MISSING' : 'META_DESC_LENGTH_SUBOPTIMAL',
	'og-tags': 'OG_INCOMPLETE',
	canonical: (c) => {
		const ev = (c.evidence || '').toLowerCase();
		if (ev.includes('relative') || (ev.includes('href=') && !ev.includes('http'))) {
			return 'CANONICAL_RELATIVE_PATH';
		}
		return 'CANONICAL_MISSING';
	},
	'single-h1': (c) => {
		const ev = (c.evidence || '').toLowerCase();
		if (ev.includes('no <h1') || ev.includes('0') || c.status === 'fail') return 'H1_MISSING';
		return 'H1_MULTIPLE';
	},
	'heading-skip': 'H1_MULTIPLE',
	'jsonld-present': 'SCHEMA_MISSING',
	organization: 'ORGANIZATION_MISSING',
	'article-fields': (c) => {
		const ev = (c.evidence || '').toLowerCase();
		if (ev.includes('datepublished') || ev.includes('datemodified') || ev.includes('date')) {
			return 'ARTICLE_DATE_MISSING';
		}
		return 'SCHEMA_MISSING';
	},
	'news-article': (c) => {
		const ev = (c.evidence || '').toLowerCase();
		if (ev.includes('datepublished') || ev.includes('datemodified') || ev.includes('date')) {
			return 'ARTICLE_DATE_MISSING';
		}
		return 'SCHEMA_MISSING';
	},
	'website-schema': 'WEBSITE_SCHEMA_MISSING',
	'person-eeat': 'SCHEMA_MISSING',
	'faq-howto-schema': 'SCHEMA_MISSING',
	'ai-bots-allowed': 'GPTBOT_BLOCKED',
	'html-lang': 'GENERIC',
	'image-alt': 'IMAGE_ALT',
	'heading-structure': 'H1_MISSING',
	'response-time': 'LCP_POOR',
	'page-weight': 'LCP_POOR',
	'render-blocking': 'RENDER_BLOCKING',
	'crawlable-text': 'GENERIC',
	'eeat-author': 'SCHEMA_MISSING',
};

const CATEGORY_LABEL: Record<string, string> = {
	security: '보안 / 인프라',
	seo: 'SEO / Meta',
	schema: 'GEO / Schema',
	geo: 'GEO / AI',
	performance: '성능 / 접근성',
	accessibility: '접근성',
};

function toSeverity(check: AuditCheckItem): IssueSeverity {
	if (check.status === 'pass' || check.passed) return 'PASS';
	if (check.status === 'warning') return 'WARN';
	return 'FAIL';
}

function resolveIssueCode(check: AuditCheckItem): string {
	const mapped = CHECK_ID_TO_ISSUE_CODE[check.id];
	if (!mapped) return check.id?.toUpperCase?.().replace(/-/g, '_') || 'GENERIC';
	return typeof mapped === 'function' ? mapped(check) : mapped;
}

function estMinutesFor(code: string, severity: IssueSeverity): number {
	if (severity === 'PASS') return 0;
	const hard = ['LCP_POOR', 'SCHEMA_MISSING', 'NOT_HTTPS'];
	if (hard.includes(code)) return 45;
	if (code === 'RENDER_BLOCKING' || code === 'ARTICLE_DATE_MISSING') return 10;
	if (severity === 'WARN') return 15;
	return 25;
}

export function collectFailedChecks(report: AuditReport): Array<AuditCheckItem & { categoryId: string }> {
	const out: Array<AuditCheckItem & { categoryId: string }> = [];
	for (const cat of report.categories || []) {
		for (const check of cat.checks || []) {
			if (check.status === 'pass' || check.passed) continue;
			out.push({ ...check, categoryId: cat.id });
		}
	}
	if (out.length === 0 && Array.isArray(report.checklist)) {
		for (const check of report.checklist) {
			if (check.status === 'pass' || check.passed) continue;
			out.push({ ...check, categoryId: 'seo' });
		}
	}
	return out;
}

export function mapAuditReportToSolveSnapshot(
	report: AuditReport,
	opts?: { id?: string | null; cmsType?: string },
): SolveAuditSnapshot {
	const cmsType = toSolveCmsDisplay(opts?.cmsType || report.cmsType || '');
	const siteName = dedupeRepeatedPhrase(
		report.siteMeta?.brandName ||
			report.metrics?.pageTitle ||
			(() => {
				try {
					return new URL(report.url).hostname.replace(/^www\./, '');
				} catch {
					return report.url;
				}
			})(),
	);

	const payload = {
		targetUrl: report.url,
		title: report.metrics?.pageTitle || siteName,
		description: report.metrics?.metaDescription || '',
		siteName,
	};

	const failed = collectFailedChecks(report);
	const issues: SolveIssue[] = failed.map((check) => {
		const code = resolveIssueCode(check);
		const severity = toSeverity(check);
		const guide = getIssueSolutionGuide(code, cmsType, {
			title: check.label,
			description: check.why || check.label,
			impactReason: check.impact,
			cmsCode: true,
		});
		const cmsCode = generateAllCmsSnippets(code, payload);
		const hasInjectable = Object.values(cmsCode).some((s) => s && !s.includes('수정 --'));

		return {
			id: check.id,
			code,
			title: check.label,
			category: CATEGORY_LABEL[check.categoryId] || check.categoryId || '진단',
			severity,
			description: guide.summary,
			impactReason: check.impact || guide.impact,
			suggestedFix: check.why,
			estMinutes: estMinutesFor(code, severity),
			solutionGuide: {
				...guide,
				hasCode: hasInjectable || guide.hasCode,
			},
			cmsCode,
		};
	});

	const schemaCoveragePercent =
		typeof report.schemaCoverage === 'number'
			? Math.round(report.schemaCoverage)
			: Math.round((report.score / Math.max(report.maxScore, 1)) * 100);

	const evidenceUrls: string[] = [];
	for (const cat of report.categories || []) {
		for (const check of cat.checks || []) {
			if (check.evidence) evidenceUrls.push(check.evidence);
		}
	}
	for (const check of report.checklist || []) {
		if (check.evidence) evidenceUrls.push(check.evidence);
	}

	const collectedUrlPaths = extractAuditUrlPaths({
		url: report.url,
		baseOrigin: report.url,
		collectedUrls: [...(report.collectedUrls || []), ...evidenceUrls],
		urls: (report as AuditReport & { urls?: string[] }).urls,
		findings: report.findings,
	});

	const mainTitle = sanitizeMainPageTitle(report.metrics?.pageTitle || siteName, siteName);
	const mainDescription = report.metrics?.metaDescription || '';
	const mainH1 = sanitizeMainPageTitle(report.metrics?.h1Texts?.[0] || mainTitle, siteName);
	const industryType = report.siteMeta?.industryType;
	const schemaTypeBucket: string[] = [];
	for (const f of report.findings || []) {
		const hits = `${f.title || ''} ${f.detail || ''}`.match(
			/\b(Organization|LocalBusiness|WebSite|AboutPage|ContactPage|MedicalWebPage|CollectionPage|FAQPage|ItemList|HowTo|Person|Article|Product|BreadcrumbList)\b/g,
		);
		if (hits) schemaTypeBucket.push(...hits);
	}
	const schemaTypes = schemaTypeBucket.length > 0 ? schemaTypeBucket : undefined;

	const pageMetas = pagesFromAuditPaths({
		targetUrl: report.url,
		siteName,
		collectedUrlPaths,
		mainTitle,
		mainDescription,
		mainH1,
		industryType,
		pageTypes: schemaTypes?.length ? [...new Set(schemaTypes)] : undefined,
		navItems: report.navItems,
		crawledPages: report.pageMetas,
	});

	const fileIssueTargets = buildFileIssueTargetReport(report, { issues });

	return {
		id: opts?.id || 'payload',
		targetUrl: report.url,
		collectedUrlPaths,
		pageMetas,
		siteName,
		mainTitle,
		mainDescription,
		mainH1,
		industryType,
		navItems: report.navItems,
		footerText: report.footerText,
		representativeName: report.siteMeta?.representativeName,
		representativeTitle: report.siteMeta?.representativeJobTitle,
		openingHoursOpens: report.siteMeta?.openingHours?.opens,
		openingHoursCloses: report.siteMeta?.openingHours?.closes,
		latitude: report.siteMeta?.geo?.latitude,
		longitude: report.siteMeta?.geo?.longitude,
		sameAs: report.siteMeta?.sameAs,
		medicalSpecialty: report.siteMeta?.medicalSpecialty,
		isAcceptingNewPatients: report.siteMeta?.isAcceptingNewPatients ?? true,
		postalCode: report.siteMeta?.postalCode,
		streetAddress: report.siteMeta?.streetAddress,
		addressLocality: report.siteMeta?.addressLocality,
		addressRegion: report.siteMeta?.addressRegion,
		overallScore: Math.round(report.score),
		schemaCoveragePercent,
		cmsType,
		issues,
		fileIssueTargets,
	};
}

/** Parse stored AuditLead.reportJson into a solve snapshot (or null). */
export function solveSnapshotFromReportJson(
	reportJson: string,
	opts: { id: string; cmsType?: string },
): SolveAuditSnapshot | null {
	try {
		const report = JSON.parse(reportJson) as AuditReport;
		if (!report?.url || !Array.isArray(report.categories)) return null;
		return mapAuditReportToSolveSnapshot(report, opts);
	} catch {
		return null;
	}
}
