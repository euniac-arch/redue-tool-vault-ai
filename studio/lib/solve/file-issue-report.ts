/**
 * Per-file issue target report for /admin/solve — maps audit Fail/Warn
 * signals onto site-relative paths with auto-fix vs manual badges.
 */

import type { AuditReport } from '@/lib/site-auditor';
import type { SolveAuditSnapshot, SolveIssue } from '@/lib/solve/types';

export type FileIssueFixStatus = 'auto' | 'manual';

export type FileIssueTargetRow = {
	/** Site-relative path, e.g. `/sub/about.html` or `/` */
	filePath: string;
	issues: string[];
	fixStatus: FileIssueFixStatus;
	/** UI badge copy */
	badge: string;
};

export const FILE_ISSUE_BADGE_AUTO = '[JS 동적 엔진 자동 보완 완료]';
export const FILE_ISSUE_BADGE_MANUAL = '[수동/개별 수정 권장]';

const AUTO_FIX_CHECK_IDS = new Set([
	'image-alt',
	'jsonld-present',
	'organization',
	'article-fields',
	'news-article',
	'website-schema',
	'person-eeat',
	'faq-howto-schema',
	'eeat-author',
	'meta-description',
	'og-tags',
	'canonical',
	'title',
	'render-blocking',
]);

const AUTO_FIX_ISSUE_CODES = new Set([
	'IMAGE_ALT',
	'SCHEMA_MISSING',
	'ORGANIZATION_MISSING',
	'WEBSITE_SCHEMA_MISSING',
	'ARTICLE_DATE_MISSING',
	'META_DESC_MISSING',
	'META_DESC_LENGTH_SUBOPTIMAL',
	'TITLE_MISSING',
	'TITLE_LENGTH_SUBOPTIMAL',
	'OG_INCOMPLETE',
	'CANONICAL_MISSING',
	'CANONICAL_RELATIVE_PATH',
	'RENDER_BLOCKING',
	'GENERIC',
]);

function normalizePath(path: string): string {
	const raw = String(path || '').trim() || '/';
	if (raw === '/' || raw === 'index.php' || raw === '/index.php' || raw === '/index.html') {
		return '/';
	}
	return raw.startsWith('/') ? raw : `/${raw}`;
}

function pathFromUrl(url: string, base?: string): string {
	try {
		const u = new URL(url, base || 'https://example.com');
		return normalizePath(`${u.pathname}${u.search}` || '/');
	} catch {
		return normalizePath(url);
	}
}

function issueLabelFromCheck(id: string, evidence?: string, metrics?: AuditReport['metrics']): string | null {
	switch (id) {
		case 'image-alt': {
			const n = metrics?.imagesMissingAlt;
			return typeof n === 'number' && n > 0 ? `alt 누락 ${n}개` : 'alt 누락/커버리지 부족';
		}
		case 'heading-skip':
		case 'heading-structure': {
			const ex = metrics?.headingSkipExamples?.slice(0, 2).join(', ');
			return ex ? `헤딩 비약 감지 (${ex})` : '헤딩 계층 비약 감지';
		}
		case 'single-h1':
			return evidence?.includes('0') || /no <h1/i.test(evidence || '')
				? 'H1 누락'
				: 'H1 중복/다중';
		case 'article-fields':
		case 'news-article': {
			const ev = (evidence || '').toLowerCase();
			if (ev.includes('datepublished') || ev.includes('datemodified') || ev.includes('date')) {
				return 'Article datePublished/dateModified 누락';
			}
			return 'Article 스키마 누락';
		}
		case 'faq-howto-schema':
			return 'FAQPage/HowTo 스키마 누락';
		case 'jsonld-present':
			return 'JSON-LD 스키마 누락';
		case 'organization':
			return 'Organization 스키마 누락';
		case 'person-eeat':
		case 'eeat-author':
			return 'Person E-E-A-T 누락';
		case 'website-schema':
			return 'WebSite 스키마 누락';
		case 'meta-description':
			return '메타 description 미흡';
		case 'og-tags':
			return 'Open Graph 미흡';
		case 'canonical':
			return 'Canonical 미흡';
		case 'title':
			return 'Title 미흡';
		case 'render-blocking':
			return '렌더링 차단 스크립트(defer 미적용)';
		default:
			return null;
	}
}

function isAutoFixable(checkId: string, issueCode?: string): boolean {
	if (AUTO_FIX_CHECK_IDS.has(checkId)) return true;
	if (issueCode && AUTO_FIX_ISSUE_CODES.has(issueCode)) {
		/* Heading hierarchy needs content edits — not auto */
		if (checkId === 'heading-skip' || checkId === 'heading-structure' || checkId === 'single-h1') {
			return false;
		}
		if (issueCode === 'H1_MISSING' || issueCode === 'H1_MULTIPLE') {
			return false;
		}
		/* LCP_POOR stays manual; RENDER_BLOCKING is covered by JS Defer Auto-Fixer */
		if (issueCode === 'LCP_POOR' && checkId !== 'render-blocking') {
			return false;
		}
		return true;
	}
	if (checkId === 'heading-skip' || checkId === 'heading-structure' || checkId === 'single-h1') {
		return false;
	}
	return false;
}

/**
 * Build file-targeted issue rows from a full audit report (+ optional solve issues).
 */
export function buildFileIssueTargetReport(
	report: AuditReport,
	opts?: { issues?: SolveIssue[] },
): FileIssueTargetRow[] {
	const mainPath = pathFromUrl(report.url);
	const byPath = new Map<string, { issues: string[]; auto: boolean; manual: boolean }>();

	const ensure = (path: string) => {
		const key = normalizePath(path);
		let row = byPath.get(key);
		if (!row) {
			row = { issues: [], auto: false, manual: false };
			byPath.set(key, row);
		}
		return row;
	};

	const pushIssue = (path: string, label: string, auto: boolean) => {
		const row = ensure(path);
		if (!row.issues.includes(label)) row.issues.push(label);
		if (auto) row.auto = true;
		else row.manual = true;
	};

	const failedChecks: Array<{ id: string; evidence?: string; status?: string; passed?: boolean }> = [];
	for (const cat of report.categories || []) {
		for (const check of cat.checks || []) {
			if (check.status === 'pass' || check.passed) continue;
			failedChecks.push(check);
		}
	}
	if (failedChecks.length === 0 && Array.isArray(report.checklist)) {
		for (const check of report.checklist) {
			if (check.status === 'pass' || check.passed) continue;
			failedChecks.push(check);
		}
	}

	const issueCodeById = new Map<string, string>();
	for (const issue of opts?.issues || []) {
		if (issue.id && issue.code) issueCodeById.set(issue.id, issue.code);
	}

	for (const check of failedChecks) {
		const label = issueLabelFromCheck(check.id, check.evidence, report.metrics);
		if (!label) continue;
		const auto = isAutoFixable(check.id, issueCodeById.get(check.id));
		pushIssue(mainPath, label, auto);
	}

	/* Subpage signals from crawled page metas */
	for (const page of report.pageMetas || []) {
		const path = normalizePath(page.urlPath);
		const missingAlt = (page as { missingAlt?: number }).missingAlt;
		const imagesTotal = (page as { imagesTotal?: number }).imagesTotal;
		const headingSkip = (page as { headingSkipDetected?: boolean }).headingSkipDetected;
		const skipEx = (page as { headingSkipExamples?: string[] }).headingSkipExamples;

		if (typeof missingAlt === 'number' && missingAlt > 0) {
			pushIssue(path, `alt 누락 ${missingAlt}개${imagesTotal ? ` / 이미지 ${imagesTotal}개` : ''}`, true);
		}
		if (headingSkip) {
			const ex = skipEx?.slice(0, 2).join(', ');
			pushIssue(path, ex ? `헤딩 비약 감지 (${ex})` : '헤딩 계층 비약 감지', false);
		}
	}

	/* Ensure collected paths appear when main has image-alt fails (coverage note) */
	if ((report.metrics?.imagesMissingAlt || 0) > 0) {
		ensure(mainPath);
	}

	return [...byPath.entries()]
		.filter(([, v]) => v.issues.length > 0)
		.map(([filePath, v]) => {
			/* Spec: if any manual issue remains → manual badge; else auto (JS/schema engine) */
			const finalStatus: FileIssueFixStatus = v.manual ? 'manual' : 'auto';
			return {
				filePath,
				issues: v.issues,
				fixStatus: finalStatus,
				badge: finalStatus === 'auto' ? FILE_ISSUE_BADGE_AUTO : FILE_ISSUE_BADGE_MANUAL,
			};
		})
		.sort((a, b) => {
			if (a.filePath === '/') return -1;
			if (b.filePath === '/') return 1;
			return a.filePath.localeCompare(b.filePath, 'ko');
		});
}

/** Build from Solve snapshot when full AuditReport is unavailable. */
export function buildFileIssueTargetReportFromSnapshot(
	audit: SolveAuditSnapshot,
): FileIssueTargetRow[] {
	const mainPath = pathFromUrl(audit.targetUrl);
	const byPath = new Map<string, { issues: string[]; manual: boolean }>();

	const ensure = (path: string) => {
		const key = normalizePath(path);
		let row = byPath.get(key);
		if (!row) {
			row = { issues: [], manual: false };
			byPath.set(key, row);
		}
		return row;
	};

	for (const issue of audit.issues || []) {
		if (issue.severity === 'PASS') continue;
		const id = issue.id || '';
		const code = issue.code || '';
		const auto = isAutoFixable(id, code);
		const label =
			issueLabelFromCheck(id, issue.suggestedFix) ||
			issue.title ||
			code ||
			'이슈';
		const row = ensure(mainPath);
		if (!row.issues.includes(label)) row.issues.push(label);
		if (!auto) row.manual = true;
	}

	for (const page of audit.pageMetas || []) {
		const path = normalizePath(page.urlPath);
		const missingAlt = (page as { missingAlt?: number }).missingAlt;
		const headingSkip = (page as { headingSkipDetected?: boolean }).headingSkipDetected;
		const skipEx = (page as { headingSkipExamples?: string[] }).headingSkipExamples;
		if (typeof missingAlt === 'number' && missingAlt > 0) {
			const row = ensure(path);
			const label = `alt 누락 ${missingAlt}개`;
			if (!row.issues.includes(label)) row.issues.push(label);
		}
		if (headingSkip) {
			const row = ensure(path);
			const label = skipEx?.length
				? `헤딩 비약 감지 (${skipEx.slice(0, 2).join(', ')})`
				: '헤딩 계층 비약 감지';
			if (!row.issues.includes(label)) row.issues.push(label);
			row.manual = true;
		}
	}

	return [...byPath.entries()]
		.filter(([, v]) => v.issues.length > 0)
		.map(([filePath, v]) => ({
			filePath,
			issues: v.issues,
			fixStatus: (v.manual ? 'manual' : 'auto') as FileIssueFixStatus,
			badge: v.manual ? FILE_ISSUE_BADGE_MANUAL : FILE_ISSUE_BADGE_AUTO,
		}))
		.sort((a, b) => {
			if (a.filePath === '/') return -1;
			if (b.filePath === '/') return 1;
			return a.filePath.localeCompare(b.filePath, 'ko');
		});
}
