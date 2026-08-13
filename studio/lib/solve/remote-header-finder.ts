/**
 * Universal Remote Header Finder:
 * scan remote tree → detect CMS → rank primary common header targets.
 */

import {
	detectCmsFromPaths,
	type DetectedCmsDisplay,
} from '@/lib/solve/local-folder-scan';
import {
	analyzeGnuboardThemeUsage,
	detectGlobalHeadTargets,
	pickGlobalHeadScanCandidates,
	type GlobalHeaderTarget,
} from '@/lib/solve/source-mapping';
import {
	toAbsoluteRemotePath,
	type RemoteTransport,
	walkRemoteTree,
} from '@/lib/solve/remote-transport';

export type RemoteCmsLabel =
	| '그누보드(테마사용)'
	| '그누보드(테마미사용)'
	| '워드프레스'
	| '카페24'
	| 'Next.js'
	| 'Laravel'
	| 'React'
	| '커스텀 PHP'
	| '순수 Static HTML';

export type RankedRemoteTarget = {
	relativePath: string;
	absolutePath: string;
	score: number;
	badge: string;
	isPrimary: boolean;
	engine: 'php-dynamic' | 'html-static';
};

export type RemoteDiagnoseResult = {
	ok: boolean;
	cmsDisplay: DetectedCmsDisplay;
	cmsLabel: RemoteCmsLabel;
	cmsMessage: string;
	confidence: 'high' | 'medium' | 'low';
	signals: string[];
	scannedPathCount: number;
	truncated: boolean;
	primaryTarget: RankedRemoteTarget | null;
	targets: RankedRemoteTarget[];
	logs: string[];
};

function normalizePath(p: string): string {
	return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

function isHtmlOnlySite(paths: string[], cms: DetectedCmsDisplay): boolean {
	if (cms !== 'Custom HTML/PHP' && cms !== 'Cafe24') return false;
	const hasPhp = paths.some((p) => /\.php$/i.test(p));
	const hasHtml = paths.some((p) => /\.(html?|htm)$/i.test(p));
	return hasHtml && !hasPhp;
}

function resolveWpActiveThemeHint(paths: string[]): string | null {
	const themeHeaders = paths
		.map(normalizePath)
		.filter((p) => /^wp-content\/themes\/[^/]+\/header\.php$/i.test(p));
	if (themeHeaders.length === 0) return null;
	if (themeHeaders.length === 1) {
		const m = themeHeaders[0].match(/^wp-content\/themes\/([^/]+)\//i);
		return m?.[1] || null;
	}
	// Prefer non-default themes when multiple header.php exist
	const nonDefault = themeHeaders.filter(
		(p) => !/\/(twenty|twentytwenty|twentytwentyone|twentytwentytwo|twentytwentythree|twentytwentyfour|twentytwentyfive)\//i.test(p),
	);
	const pick = nonDefault[0] || themeHeaders[0];
	const m = pick.match(/^wp-content\/themes\/([^/]+)\//i);
	return m?.[1] || null;
}

export function formatRemoteCmsLabel(opts: {
	cmsDisplay: DetectedCmsDisplay;
	themeActive?: boolean | null;
	staticHtml?: boolean;
}): RemoteCmsLabel {
	if (opts.staticHtml) return '순수 Static HTML';
	switch (opts.cmsDisplay) {
		case 'Gnuboard':
			return opts.themeActive ? '그누보드(테마사용)' : '그누보드(테마미사용)';
		case 'WordPress':
			return '워드프레스';
		case 'Cafe24':
			return '카페24';
		case 'Next.js':
			return 'Next.js';
		case 'Laravel':
			return 'Laravel';
		case 'React':
			return 'React';
		default:
			return '커스텀 PHP';
	}
}

function engineForPath(relativePath: string): 'php-dynamic' | 'html-static' {
	return /\.(php|phtml)$/i.test(relativePath) ? 'php-dynamic' : 'html-static';
}

/** Extra static / custom candidates when CMS heuristics miss. */
function extraStaticCandidates(paths: string[]): string[] {
	const preferred = [
		'header.php',
		'inc/head.php',
		'inc/header.php',
		'common/header.php',
		'common.php',
		'include/head.php',
		'index.php',
		'index.html',
		'main.html',
		'home.html',
	];
	const set = new Set(paths.map((p) => normalizePath(p).toLowerCase()));
	const out: string[] = [];
	for (const p of preferred) {
		const hit = paths.find((x) => normalizePath(x).toLowerCase() === p);
		if (hit) out.push(normalizePath(hit));
		else if (set.has(p)) out.push(p);
	}
	return out;
}

async function readCandidateContents(
	transport: RemoteTransport,
	relativePaths: string[],
): Promise<Record<string, string>> {
	const contents: Record<string, string> = {};
	for (const rel of relativePaths) {
		const abs = toAbsoluteRemotePath(transport.root, rel);
		try {
			const text = await transport.readText(abs);
			contents[normalizePath(rel)] = text;
		} catch {
			/* skip unreadable */
		}
	}
	return contents;
}

/**
 * Connect is already open — walk tree, detect CMS, rank header targets.
 */
export async function diagnoseRemoteHeaderTargets(
	transport: RemoteTransport,
): Promise<RemoteDiagnoseResult> {
	const logs: string[] = [];
	logs.push(`원격 루트 스캔 시작: ${transport.root}`);

	const { relativePaths, truncated } = await walkRemoteTree(transport);
	logs.push(
		`디렉터리 구조 수집 완료 — ${relativePaths.length}개 경로${truncated ? ' (상한 도달, 부분 스캔)' : ''}`,
	);

	const structurePaths = relativePaths.map(normalizePath);
	const cms = detectCmsFromPaths(structurePaths);
	logs.push(cms.message);

	const staticHtml = isHtmlOnlySite(structurePaths, cms.display);
	let themeActive: boolean | null = null;

	// Candidate set for content scoring
	const candidates = new Set<string>([
		...pickGlobalHeadScanCandidates(structurePaths, 48),
		...extraStaticCandidates(structurePaths),
	]);

	// Always try config.php for gnuboard theme check
	if (structurePaths.some((p) => /(^|\/)config\.php$/i.test(p))) {
		const cfg = structurePaths.find((p) => /(^|\/)config\.php$/i.test(p));
		if (cfg) candidates.add(cfg);
	}

	// WP: promote active-theme-ish header
	if (cms.display === 'WordPress') {
		const theme = resolveWpActiveThemeHint(structurePaths);
		if (theme) {
			candidates.add(`wp-content/themes/${theme}/header.php`);
			logs.push(`워드프레스 테마 후보: ${theme}`);
		}
	}

	const contents = await readCandidateContents(transport, [...candidates]);
	logs.push(`헤더 후보 파일 ${Object.keys(contents).length}개 내용 분석`);

	if (cms.display === 'Gnuboard') {
		const themeUsage = analyzeGnuboardThemeUsage({
			relativePaths: structurePaths,
			fileContents: contents,
		});
		themeActive = themeUsage.active;
		logs.push(themeUsage.reason);
	}

	const cmsLabel = formatRemoteCmsLabel({
		cmsDisplay: cms.display,
		themeActive,
		staticHtml,
	});

	let globalTargets: GlobalHeaderTarget[] = detectGlobalHeadTargets({
		relativePaths: structurePaths,
		cms: cms.display,
		fileContents: contents,
		maxTargets: 5,
	});

	// Fallback ranking for static / custom when detector returns empty
	if (globalTargets.length === 0) {
		const fallbacks = extraStaticCandidates(structurePaths);
		globalTargets = fallbacks.slice(0, 3).map((path, i) => ({
			path,
			badge: i === 0 ? '자동 선택됨 / 정적·커스텀 헤더 후보' : '보조 후보',
			score: i === 0 ? 120 : 80 - i * 10,
			pathRank: 80,
		}));
	}

	const targets: RankedRemoteTarget[] = globalTargets.map((t, index) => {
		const relativePath = normalizePath(t.path);
		return {
			relativePath,
			absolutePath: toAbsoluteRemotePath(transport.root, relativePath),
			score: t.score ?? 0,
			badge: t.badge,
			isPrimary: index === 0,
			engine: engineForPath(relativePath),
		};
	});

	// Mark primary explicitly
	if (targets[0]) targets[0].isPrimary = true;

	const primaryTarget = targets[0] || null;
	if (primaryTarget) {
		logs.push(
			`1순위 타겟: ${primaryTarget.relativePath} (Score ${primaryTarget.score}, ${primaryTarget.engine})`,
		);
	} else {
		logs.push('공통 헤더 타겟을 찾지 못했습니다.');
	}

	return {
		ok: Boolean(primaryTarget),
		cmsDisplay: cms.display,
		cmsLabel,
		cmsMessage: `[CMS 자동 감지 결과: ${cmsLabel}]`,
		confidence: cms.confidence,
		signals: cms.signals,
		scannedPathCount: structurePaths.length,
		truncated,
		primaryTarget,
		targets,
		logs,
	};
}
