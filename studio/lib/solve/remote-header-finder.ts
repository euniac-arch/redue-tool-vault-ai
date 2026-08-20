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

/** Web-root prefixes used by hosting panels (Cafe24, cPanel, etc.). */
export const GNUBOARD_WEB_ROOT_PREFIXES = ['', 'www/', 'html/', 'public_html/'] as const;

export type GnuboardInjectTier = 1 | 2 | 3 | 4;

/**
 * FTP inject path priority (before any root fallback):
 *  1 - theme/basic/head.sub.php (+ www/html/public_html)
 *  2 - theme/{name}/head.sub.php
 *  3 - head.sub.php (root)
 *  4 - index.html / index.php
 */
export function gnuboardInjectTier(relativePath: string): GnuboardInjectTier | null {
	const p = normalizePath(relativePath);
	if (/(^|\/)theme\/basic\/head\.sub\.php$/i.test(p)) return 1;
	if (/(^|\/)theme\/[^/]+\/head\.sub\.php$/i.test(p)) return 2;
	if (/(^|\/)head\.sub\.php$/i.test(p) && !/(^|\/)theme\//i.test(p)) return 3;
	if (/(^|\/)index\.(html|htm|php)$/i.test(p)) return 4;
	return null;
}

export function gnuboardPrefixOrder(relativePath: string): number {
	const p = normalizePath(relativePath).toLowerCase();
	if (p.startsWith('www/')) return 1;
	if (p.startsWith('html/')) return 2;
	if (p.startsWith('public_html/')) return 3;
	return 0;
}

/** Pick the first existing path using Gnuboard theme-first order. */
export function pickPreferredGnuboardInjectPath(paths: string[]): string | null {
	const ranked = paths
		.map((p) => ({ p: normalizePath(p), tier: gnuboardInjectTier(p) }))
		.filter((x): x is { p: string; tier: GnuboardInjectTier } => x.tier != null)
		.sort(
			(a, b) =>
				a.tier - b.tier || gnuboardPrefixOrder(a.p) - gnuboardPrefixOrder(b.p) || a.p.localeCompare(b.p),
		);
	return ranked[0]?.p ?? null;
}

async function remoteFileExists(transport: RemoteTransport, relativePath: string): Promise<boolean> {
	const abs = toAbsoluteRemotePath(transport.root, relativePath);
	try {
		return await transport.exists(abs);
	} catch {
		return false;
	}
}

async function listThemeHeadSubFiles(
	transport: RemoteTransport,
	themeDirRel: string,
): Promise<string[]> {
	const abs = toAbsoluteRemotePath(transport.root, themeDirRel);
	let entries;
	try {
		entries = await transport.list(abs);
	} catch {
		return [];
	}
	const hits: string[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory || !entry.name || entry.name.startsWith('.')) continue;
		const rel = `${themeDirRel.replace(/\/+$/, '')}/${entry.name}/head.sub.php`;
		if (await remoteFileExists(transport, rel)) hits.push(normalizePath(rel));
	}
	return hits;
}

export type ProbedRemoteHeader = {
	relativePath: string;
	tier: GnuboardInjectTier;
};

/**
 * Probe known Gnuboard/theme header paths via FTP exists/list — does not rely on a full tree walk.
 */
export async function probeRemotePriorityHeaders(
	transport: RemoteTransport,
	opts?: { stopAtFirst?: boolean },
): Promise<{
	primary: string | null;
	hits: ProbedRemoteHeader[];
	logs: string[];
}> {
	const logs: string[] = [];
	const hits: ProbedRemoteHeader[] = [];
	const seen = new Set<string>();
	const stopAtFirst = Boolean(opts?.stopAtFirst);

	const add = (rel: string, tier: GnuboardInjectTier) => {
		const n = normalizePath(rel);
		const key = n.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		hits.push({ relativePath: n, tier });
		return true;
	};

	logs.push('그누보드 테마 우선 경로 탐색 시작 (루트보다 theme/ 우선)');

	for (const prefix of GNUBOARD_WEB_ROOT_PREFIXES) {
		const rel = `${prefix}theme/basic/head.sub.php`;
		if (await remoteFileExists(transport, rel)) {
			add(rel, 1);
			logs.push(`1순위 발견: ${rel}`);
			if (stopAtFirst) {
				return { primary: rel, hits, logs };
			}
		}
	}

	for (const prefix of GNUBOARD_WEB_ROOT_PREFIXES) {
		const themeDir = `${prefix}theme`;
		const found = await listThemeHeadSubFiles(transport, themeDir);
		if (found.length > 0) {
			logs.push(`${themeDir}/ 하위 테마 스캔: ${found.length}개 head.sub.php`);
		}
		for (const rel of found) {
			if (/\/theme\/basic\/head\.sub\.php$/i.test(rel)) {
				add(rel, 1);
			} else {
				add(rel, 2);
				logs.push(`2순위(다른 테마) 발견: ${rel}`);
			}
			if (stopAtFirst && hits.length > 0) {
				return { primary: hits[0].relativePath, hits, logs };
			}
		}
	}

	for (const prefix of GNUBOARD_WEB_ROOT_PREFIXES) {
		const rel = `${prefix}head.sub.php`;
		if (await remoteFileExists(transport, rel)) {
			add(rel, 3);
			logs.push(`3순위(루트) 발견: ${rel}`);
			if (stopAtFirst) {
				return { primary: rel, hits, logs };
			}
		}
	}

	for (const prefix of GNUBOARD_WEB_ROOT_PREFIXES) {
		for (const name of ['index.html', 'index.php', 'index.htm'] as const) {
			const rel = `${prefix}${name}`;
			if (await remoteFileExists(transport, rel)) {
				add(rel, 4);
				logs.push(`4순위(폴백) 발견: ${rel}`);
				if (stopAtFirst) {
					return { primary: rel, hits, logs };
				}
			}
		}
	}

	hits.sort(
		(a, b) =>
			a.tier - b.tier ||
			gnuboardPrefixOrder(a.relativePath) - gnuboardPrefixOrder(b.relativePath) ||
			a.relativePath.localeCompare(b.relativePath),
	);
	const primary = hits[0]?.relativePath ?? null;
	if (primary) {
		logs.push(`테마 우선 탐색 확정: ${primary}`);
	} else {
		logs.push('테마 우선 탐색: 지정 경로에서 타겟을 찾지 못함 — 전체 트리 스캔으로 이관');
	}
	return { primary, hits, logs };
}

function probedToRanked(
	hit: ProbedRemoteHeader,
	root: string,
	isPrimary: boolean,
): RankedRemoteTarget {
	const badge =
		hit.tier === 1
			? '그누보드 테마 우선 / theme/basic/head.sub.php'
			: hit.tier === 2
				? '그누보드 테마 스캔 / theme/*/head.sub.php'
				: hit.tier === 3
					? '루트 기본 경로 / head.sub.php'
					: '폴백 / index.html · index.php';
	return {
		relativePath: hit.relativePath,
		absolutePath: toAbsoluteRemotePath(root, hit.relativePath),
		score: hit.tier === 1 ? 300 : hit.tier === 2 ? 260 : hit.tier === 3 ? 180 : 80,
		badge,
		isPrimary,
		engine: engineForPath(hit.relativePath),
	};
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

	const probed = await probeRemotePriorityHeaders(transport);
	logs.push(...probed.logs);

	const { relativePaths, truncated } = await walkRemoteTree(transport);
	logs.push(
		`디렉터리 구조 수집 완료 — ${relativePaths.length}개 경로${truncated ? ' (상한 도달, 부분 스캔)' : ''}`,
	);

	const structurePaths = [
		...new Set([
			...probed.hits.map((h) => normalizePath(h.relativePath)),
			...relativePaths.map(normalizePath),
		]),
	];
	const cms = detectCmsFromPaths(structurePaths);
	logs.push(cms.message);

	const staticHtml = isHtmlOnlySite(structurePaths, cms.display);
	let themeActive: boolean | null = null;

	// Candidate set for content scoring — theme-first probe hits are always read
	const candidates = new Set<string>([
		...probed.hits.map((h) => h.relativePath),
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
		const themeFileHit = probed.hits.some((h) => h.tier === 1 || h.tier === 2);
		themeActive = themeUsage.active || themeFileHit;
		logs.push(
			themeUsage.active
				? themeUsage.reason
				: themeFileHit
					? `테마 경로 실존 — ${probed.primary || 'theme/*/head.sub.php'} 우선 주입`
					: themeUsage.reason,
		);
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

	let targets: RankedRemoteTarget[] = globalTargets.map((t, index) => {
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

	// Theme-first probe wins over root ranking when a priority file exists.
	if (probed.hits.length > 0) {
		const probedRanked = probed.hits.map((hit, i) =>
			probedToRanked(hit, transport.root, i === 0),
		);
		const seen = new Set(probedRanked.map((t) => t.relativePath.toLowerCase()));
		targets = [
			...probedRanked,
			...targets.filter((t) => !seen.has(t.relativePath.toLowerCase())),
		].map((t, i) => ({ ...t, isPrimary: i === 0 }));
	}

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
