/**
 * Client-side local folder scan for File Patch:
 * recursive FileList filtering, ignore rules, CMS auto-detection.
 */

export const IGNORE_DIR_NAMES = new Set([
	'node_modules',
	'.git',
	'.next',
	'dist',
	'build',
	'vendor',
	'.vscode',
	'.idea',
]);

export const IGNORE_EXTENSIONS = new Set([
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.webp',
	'.mp4',
	'.zip',
	'.pdf',
	'.woff',
	'.ttf',
]);

/** Longest-first so `.blade.php` wins over `.php`. */
const SOURCE_EXTENSIONS = [
	'.blade.php',
	'.tsx',
	'.jsx',
	'.php',
	'.html',
	'.htm',
	'.js',
	'.css',
] as const;

export type DetectedCmsDisplay =
	| 'Cafe24'
	| 'Gnuboard'
	| 'Next.js'
	| 'WordPress'
	| 'React'
	| 'Laravel'
	| 'Custom HTML/PHP';

export type LocalScannedFile = {
	/** Path relative to the selected folder root (webkitRelativePath). */
	relativePath: string;
	file: File;
};

export type LocalFolderScanResult = {
	sourceFiles: LocalScannedFile[];
	totalFiles: number;
	excludedCount: number;
	summary: string;
	cms: {
		display: DetectedCmsDisplay;
		labelKo: string;
		message: string;
		confidence: 'high' | 'medium' | 'low';
		signals: string[];
	};
	preferredPath: string | null;
};

function normalizePath(p: string): string {
	return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

function basename(relativePath: string): string {
	const parts = normalizePath(relativePath).split('/');
	return parts[parts.length - 1] || '';
}

function extensionOf(fileName: string): string {
	const lower = fileName.toLowerCase();
	if (lower.endsWith('.blade.php')) return '.blade.php';
	const idx = lower.lastIndexOf('.');
	return idx >= 0 ? lower.slice(idx) : '';
}

/** True when path sits under an ignored directory (dev/system). */
export function isUnderIgnoredDir(relativePath: string): boolean {
	const parts = normalizePath(relativePath).split('/').filter(Boolean);
	for (let i = 0; i < parts.length - 1; i++) {
		if (IGNORE_DIR_NAMES.has(parts[i])) return true;
		// Skip prior REDUE auto-backup trees
		if (/^_redue_backup_/i.test(parts[i]) || parts[i] === '_redue_backups') return true;
	}
	return false;
}

export function isIgnoredPath(relativePath: string): boolean {
	if (isUnderIgnoredDir(relativePath)) return true;
	const ext = extensionOf(basename(relativePath));
	return IGNORE_EXTENSIONS.has(ext);
}

export function isSourceFilePath(relativePath: string): boolean {
	const name = basename(relativePath).toLowerCase();
	return SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function pathHasSegment(paths: string[], segment: string): boolean {
	const needle = segment.toLowerCase();
	return paths.some((p) =>
		normalizePath(p)
			.toLowerCase()
			.split('/')
			.includes(needle),
	);
}

function pathEndsWith(paths: string[], fileName: string): boolean {
	const needle = fileName.toLowerCase();
	return paths.some((p) => basename(p).toLowerCase() === needle);
}

function pathIncludes(paths: string[], fragment: string): boolean {
	const needle = fragment.toLowerCase().replace(/\\/g, '/');
	return paths.some((p) => normalizePath(p).toLowerCase().includes(needle));
}

export function detectCmsFromPaths(relativePaths: string[]): LocalFolderScanResult['cms'] {
	const paths = relativePaths.map(normalizePath);
	const signals: string[] = [];

	const hasWpContent = pathHasSegment(paths, 'wp-content');
	const hasWpIncludes = pathHasSegment(paths, 'wp-includes');
	const hasWpConfig = pathEndsWith(paths, 'wp-config.php');
	const hasFunctionsPhp =
		pathEndsWith(paths, 'functions.php') && (hasWpContent || hasWpIncludes || hasWpConfig);
	if (hasWpContent) signals.push('wp-content');
	if (hasWpIncludes) signals.push('wp-includes');
	if (hasWpConfig) signals.push('wp-config.php');
	if (hasFunctionsPhp) signals.push('functions.php');

	const wpScore =
		(hasWpContent ? 2 : 0) + (hasWpIncludes ? 2 : 0) + (hasWpConfig ? 2 : 0) + (hasFunctionsPhp ? 1 : 0);

	const hasBbs = pathHasSegment(paths, 'bbs');
	const hasData = pathHasSegment(paths, 'data');
	const hasHeadPhp = pathEndsWith(paths, 'head.php');
	const hasHeadSubPhp = pathEndsWith(paths, 'head.sub.php');
	const hasTailPhp = pathEndsWith(paths, 'tail.php');
	const hasDbconfig = pathEndsWith(paths, 'dbconfig.php');
	const hasShop = pathHasSegment(paths, 'shop');
	const hasYoungcart =
		pathIncludes(paths, 'youngcart') ||
		pathEndsWith(paths, 'shop.config.php') ||
		(hasShop && (hasBbs || hasDbconfig || hasHeadSubPhp));
	if (hasBbs) signals.push('/bbs/');
	if (hasData) signals.push('/data/');
	if (hasHeadSubPhp) signals.push('head.sub.php');
	if (hasHeadPhp) signals.push('head.php');
	if (hasTailPhp) signals.push('tail.php');
	if (hasDbconfig) signals.push('dbconfig.php');
	if (hasYoungcart) signals.push('YoungCart/shop');

	const gnuScore =
		(hasBbs ? 2 : 0) +
		(hasData ? 1 : 0) +
		(hasHeadSubPhp ? 2 : 0) +
		(hasHeadPhp ? 1 : 0) +
		(hasTailPhp ? 1 : 0) +
		(hasDbconfig ? 2 : 0) +
		(hasYoungcart ? 1 : 0);

	const hasNextConfig =
		pathEndsWith(paths, 'next.config.js') ||
		pathEndsWith(paths, 'next.config.mjs') ||
		pathEndsWith(paths, 'next.config.ts');
	const hasAppLayout =
		pathIncludes(paths, '/app/layout.tsx') || pathIncludes(paths, '/app/layout.js');
	const hasPagesApp = pathIncludes(paths, '/pages/_app.');
	const nextScore = (hasNextConfig ? 2 : 0) + (hasAppLayout ? 2 : 0) + (hasPagesApp ? 1 : 0);
	if (hasNextConfig) signals.push('next.config.*');
	if (hasAppLayout) signals.push('app/layout.tsx');

	const hasArtisan = pathEndsWith(paths, 'artisan');
	const hasBlade = paths.some((p) => basename(p).toLowerCase().endsWith('.blade.php'));
	const hasVendorLaravel = pathIncludes(paths, '/vendor/laravel/');
	const laravelScore = (hasArtisan ? 2 : 0) + (hasBlade ? 2 : 0) + (hasVendorLaravel ? 1 : 0);
	if (hasArtisan) signals.push('artisan');
	if (hasBlade) signals.push('*.blade.php');

	const hasPackageJson = pathEndsWith(paths, 'package.json');
	const hasReactIndex =
		pathIncludes(paths, '/src/app.jsx') ||
		pathIncludes(paths, '/src/app.tsx') ||
		pathIncludes(paths, '/src/main.jsx') ||
		pathIncludes(paths, '/src/main.tsx') ||
		pathIncludes(paths, '/public/index.html');
	const reactScore =
		!hasNextConfig && hasPackageJson && hasReactIndex ? 2 : !hasNextConfig && hasReactIndex ? 1 : 0;
	if (reactScore > 0) signals.push('React entry');

	const hasCafe24Layout =
		pathIncludes(paths, '/layout/basic/layout.html') || pathIncludes(paths, 'layout.html');
	const cafe24Score =
		hasCafe24Layout && !hasWpContent && gnuScore < 3
			? pathIncludes(paths, '/layout/basic/')
				? 3
				: 1
			: 0;
	if (cafe24Score > 0) signals.push('Cafe24 layout');

	const hasIndexHtml = pathEndsWith(paths, 'index.html');
	const hasMainHtml = pathEndsWith(paths, 'main.html');
	const hasIndexPhp = pathEndsWith(paths, 'index.php');
	const customHtmlPhpSignals = [hasHeadPhp, hasIndexHtml, hasMainHtml, hasIndexPhp].filter(Boolean)
		.length;

	type Candidate = {
		display: DetectedCmsDisplay;
		labelKo: string;
		score: number;
		confidence: 'high' | 'medium' | 'low';
	};

	const candidates: Candidate[] = [
		{
			display: 'WordPress',
			labelKo: '워드프레스(WordPress)',
			score: wpScore,
			confidence: wpScore >= 4 ? 'high' : wpScore >= 2 ? 'medium' : 'low',
		},
		{
			display: 'Gnuboard',
			labelKo: hasYoungcart ? '그누보드/영카트(Gnuboard·YoungCart)' : '그누보드(Gnuboard)',
			score: gnuScore,
			confidence: gnuScore >= 4 ? 'high' : gnuScore >= 2 ? 'medium' : 'low',
		},
		{
			display: 'Next.js',
			labelKo: 'Next.js',
			score: nextScore,
			confidence: nextScore >= 3 ? 'high' : nextScore >= 2 ? 'medium' : 'low',
		},
		{
			display: 'Laravel',
			labelKo: 'Laravel',
			score: laravelScore,
			confidence: laravelScore >= 3 ? 'high' : laravelScore >= 2 ? 'medium' : 'low',
		},
		{
			display: 'React',
			labelKo: 'React',
			score: reactScore,
			confidence: reactScore >= 2 ? 'medium' : 'low',
		},
		{
			display: 'Cafe24',
			labelKo: '카페24(Cafe24)',
			score: cafe24Score,
			confidence: cafe24Score >= 3 ? 'high' : cafe24Score >= 1 ? 'medium' : 'low',
		},
	];

	candidates.sort((a, b) => b.score - a.score);
	const best = candidates[0];

	if (best && best.score >= 2) {
		return {
			display: best.display,
			labelKo: best.labelKo,
			message: `[CMS 자동 감지 결과: ${best.labelKo} 감지됨]`,
			confidence: best.confidence,
			signals: [...new Set(signals)],
		};
	}

	if (customHtmlPhpSignals >= 1 || paths.some((p) => /\.(php|html|htm)$/i.test(p))) {
		const labelKo = '커스텀 HTML/PHP';
		return {
			display: 'Custom HTML/PHP',
			labelKo,
			message: `[CMS 자동 감지 결과: ${labelKo} 감지됨]`,
			confidence: customHtmlPhpSignals >= 2 ? 'medium' : 'low',
			signals: [
				...(hasHeadPhp ? ['head.php'] : []),
				...(hasIndexHtml ? ['index.html'] : []),
				...(hasMainHtml ? ['main.html'] : []),
				...(hasIndexPhp ? ['index.php'] : []),
			],
		};
	}

	return {
		display: 'Custom HTML/PHP',
		labelKo: '커스텀 HTML/PHP',
		message: '[CMS 자동 감지 결과: 커스텀 HTML/PHP (기본값)]',
		confidence: 'low',
		signals: [],
	};
}

const PREFERRED_BY_CMS: Record<DetectedCmsDisplay, RegExp[]> = {
	/** Prefer head.sub.php (real <html>/<head>); head.php is layout-only. */
	Gnuboard: [
		/theme\/[^/]+\/head\.sub\.php$/i,
		/\/head\.sub\.php$/i,
		/^head\.sub\.php$/i,
		/\/head\.php$/i,
		/^head\.php$/i,
		/\/tail\.php$/i,
		/\/index\.php$/i,
	],
	WordPress: [
		/wp-content\/themes\/[^/]+\/header\.php$/i,
		/\/header\.php$/i,
		/^header\.php$/i,
		/\/functions\.php$/i,
		/\/footer\.php$/i,
		/\/index\.php$/i,
	],
	Cafe24: [/layout\.html$/i, /\/head\.html$/i, /index\.html$/i],
	'Next.js': [/\/app\/layout\.tsx$/i, /\/app\/layout\.js$/i, /\/pages\/_document\./i],
	React: [/\/public\/index\.html$/i, /\/src\/(app|main)\.(tsx|jsx)$/i],
	Laravel: [/layouts\/.+\.blade\.php$/i, /app\.blade\.php$/i],
	'Custom HTML/PHP': [
		/\/head\.php$/i,
		/^head\.php$/i,
		/\/header\.html$/i,
		/\/header\.php$/i,
		/\/index\.html$/i,
		/\/main\.html$/i,
		/\/index\.php$/i,
		/\/sub\.php$/i,
	],
};

export function pickPreferredSourcePath(
	relativePaths: string[],
	cms: DetectedCmsDisplay,
): string | null {
	const normalized = relativePaths.map(normalizePath);
	const patterns = PREFERRED_BY_CMS[cms] || PREFERRED_BY_CMS['Custom HTML/PHP'];
	for (const re of patterns) {
		const hit = normalized.find((p) => re.test(p));
		if (hit) return hit;
	}
	return normalized[0] || null;
}

export function scanLocalFolderFiles(fileList: FileList | File[]): LocalFolderScanResult {
	const files = Array.from(fileList);
	const sourceFiles: LocalScannedFile[] = [];

	for (const file of files) {
		const relativePath = normalizePath(file.webkitRelativePath || file.name);
		if (!relativePath) continue;
		if (isIgnoredPath(relativePath)) continue;
		if (!isSourceFilePath(relativePath)) continue;
		sourceFiles.push({ relativePath, file });
	}

	sourceFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'ko'));

	const totalFiles = files.length;
	const excludedCount = Math.max(0, totalFiles - sourceFiles.length);

	// Structure signals from all files outside ignored dirs (media still helps detect /data/, /wp-content/, …)
	const structurePaths = files
		.map((f) => normalizePath(f.webkitRelativePath || f.name))
		.filter((p) => p && !isUnderIgnoredDir(p));
	const cms = detectCmsFromPaths(structurePaths.length > 0 ? structurePaths : sourceFiles.map((f) => f.relativePath));

	const preferredPath = pickPreferredSourcePath(
		sourceFiles.map((f) => f.relativePath),
		cms.display,
	);

	const summary = `[총 ${sourceFiles.length}개 소스 파일 스캔 완료 (개발/미디어 파일 ${excludedCount}개 제외됨)]`;

	return {
		sourceFiles,
		totalFiles,
		excludedCount,
		summary,
		cms,
		preferredPath,
	};
}
