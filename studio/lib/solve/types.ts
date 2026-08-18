/**
 * Solve workspace shared types — ported from inspector dashboard audit JSON shape.
 */

export type IssueSeverity = 'PASS' | 'WARN' | 'FAIL' | 'INFO';

export interface SolutionStep {
	title: string;
	detail: string;
}

export interface SolutionGuide {
	code?: string;
	summary: string;
	impact: string;
	difficulty: 'easy' | 'medium' | 'hard' | string;
	steps: SolutionStep[];
	verify: string[];
	hasCode?: boolean;
	cms?: {
		key: string;
		label: string;
		file: string;
		injection?: string;
		adminPath?: string;
		howTo?: string;
		note?: string | null;
	};
}

export interface SolveIssue {
	id?: string;
	code?: string;
	title: string;
	category: string;
	severity: IssueSeverity;
	description?: string;
	impactReason?: string;
	suggestedFix?: string;
	aiExplanation?: string;
	estMinutes?: number;
	solutionGuide?: SolutionGuide;
	cmsCode?: Record<string, string>;
}

/** Per-page metadata carried from audit_payload into Dynamic PHP Schema Generator. */
export interface SolvePageMeta {
	urlPath: string;
	title?: string;
	description?: string;
	h1?: string;
	pageType?: string;
	extraTypes?: string[];
	/** GNB section label → $page_meta['section'] (e.g. 연구소 소개) */
	section?: string;
	/** Breadcrumb depth-1 (LLM mapping JSON menu1) */
	menu1?: string;
	/** Breadcrumb depth-2 (LLM mapping JSON menu2) */
	menu2?: string;
	/** Subpage alt / heading signals for file-target report */
	missingAlt?: number;
	imagesTotal?: number;
	headingSkipDetected?: boolean;
	headingSkipExamples?: string[];
}

/** Per-file issue target row shown under /admin/solve diagnosis summary. */
export interface SolveFileIssueTarget {
	filePath: string;
	issues: string[];
	fixStatus: 'auto' | 'manual';
	badge: string;
}

export interface SolveAuditSnapshot {
	id: string;
	targetUrl: string;
	/** Site-relative paths collected from audit payload for local file mapping. */
	collectedUrlPaths?: string[];
	/** Main + subpage title/meta/type for dynamic PHP $page_meta mapping. */
	pageMetas?: SolvePageMeta[];
	siteName?: string;
	mainTitle?: string;
	mainDescription?: string;
	mainH1?: string;
	industryType?: string;
	/** GNB labels for Parent Fallback Hierarchy / title resolution */
	navItems?: Array<{ name: string; url: string; children?: Array<{ name: string; url: string }>; parent?: string }>;
	/** Footer 사업자 정보 for Organization.legalName */
	footerText?: string;
	/** Explicit legal entity when known (else inferred from footerText) */
	legalName?: string;
	overallScore: number;
	schemaCoveragePercent: number;
	cmsType?: string;
	issues: SolveIssue[];
	/** File-path-keyed issue targeting for diagnosis summary card */
	fileIssueTargets?: SolveFileIssueTarget[];
}

export const CMS_TAB_META: Record<string, { label: string; file: string; admin: string }> = {
	cafe24: { label: 'Cafe24', file: 'layout/basic/layout.html', admin: '쇼핑몰관리 → 디자인 → HTML/CSS 편집' },
	gnuboard: {
		label: 'Gnuboard / YoungCart',
		file: 'theme/{테마}/head.sub.php',
		admin: 'FTP — head.sub.php (실제 <head>)에 주입 · head.php는 레이아웃',
	},
	nextjs: { label: 'Next.js', file: 'app/layout.tsx', admin: '프로젝트 layout.tsx 수정 후 배포' },
	wordpress: {
		label: 'WordPress',
		file: 'wp-content/themes/{theme}/header.php',
		admin: '테마 header.php — wp_head() 직전 또는 </head> 직전',
	},
	react: { label: 'React', file: 'public/index.html', admin: 'public/index.html 또는 react-helmet' },
	laravel: { label: 'Laravel', file: 'layouts/app.blade.php', admin: 'Blade 레이아웃 파일 수정' },
	custom: {
		label: 'Custom HTML/PHP',
		file: 'head.php / header.html / index.html',
		admin: 'FTP 또는 호스팅 파일 관리자로 공통 <head> 파일 수정',
	},
	universal: {
		label: 'Universal v30 Precision Canonical & Full-Document Defer',
		file: 'head.sub.php / header.php / inc_head.php (공통 헤더 파일 최상단)',
		admin: 'CMS 무관 — 공통 헤더 맨 위에 v30 단일 블록 붙여넣기 (exact subpage canonical + head/body defer + Article/FAQ/Person)',
	},
};

export const CMS_DISPLAY_OPTIONS = [
	'Cafe24',
	'Gnuboard',
	'Next.js',
	'WordPress',
	'React',
	'Laravel',
	'Custom HTML/PHP',
] as const;

export function displayCmsToKey(cmsType: string): string {
	const raw = (cmsType || '').trim();
	const lower = raw.toLowerCase();
	if (/그누보드|gnuboard|youngcart|영카트/.test(raw) || /gnuboard|youngcart/.test(lower)) {
		return 'gnuboard';
	}
	if (/wordpress|워드프레스/.test(lower) || raw.includes('워드프레스')) return 'wordpress';
	if (/cafe24|카페24/.test(lower) || raw.includes('카페24')) return 'cafe24';
	if (/next/.test(lower)) return 'nextjs';
	if (/laravel/.test(lower)) return 'laravel';
	if (/^react$/i.test(raw) || lower.includes('react')) return 'react';
	if (/imweb|아임웹|makeshop|메이크샵|godomall|고도몰|jsp|asp|커스텀|custom|자체구축/.test(lower) || raw.includes('커스텀') || raw.includes('아임웹')) {
		return 'custom';
	}
	const map: Record<string, string> = {
		Cafe24: 'cafe24',
		Gnuboard: 'gnuboard',
		'Next.js': 'nextjs',
		WordPress: 'wordpress',
		React: 'react',
		Laravel: 'laravel',
		'Custom HTML/PHP': 'custom',
	};
	return map[raw] || map[cmsType] || 'custom';
}

/** Map audit/HTML CMS labels onto Solve workspace select values. */
export function toSolveCmsDisplay(cmsType: string | null | undefined): string {
	if (!cmsType || cmsType === 'UNKNOWN') return 'Custom HTML/PHP';
	const key = displayCmsToKey(cmsType);
	const labels: Record<string, string> = {
		cafe24: 'Cafe24',
		gnuboard: 'Gnuboard',
		nextjs: 'Next.js',
		wordpress: 'WordPress',
		react: 'React',
		laravel: 'Laravel',
		custom: 'Custom HTML/PHP',
	};
	return labels[key] || 'Custom HTML/PHP';
}

export function difficultyLabel(level: string | undefined): string {
	const map: Record<string, string> = { easy: '쉬움', medium: '보통', hard: '어려움' };
	return map[level || ''] || '보통';
}

export function severityBadge(severity: IssueSeverity): string {
	if (severity === 'FAIL') return 'FAIL';
	if (severity === 'WARN') return 'WARN';
	if (severity === 'PASS') return 'PASS';
	return severity;
}

export function getCmsHowTo(cmsKey: string, hasCode: boolean): string {
	const meta = CMS_TAB_META[cmsKey] || CMS_TAB_META.nextjs;
	if (hasCode) {
		return `${meta.admin} — ${meta.file}의 <head> 영역에 아래 코드를 붙여넣으세요.`;
	}
	return `${meta.admin}에서 위 단계에 따라 설정을 변경하세요.`;
}
