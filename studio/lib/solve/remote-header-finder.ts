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
	inferGnuboardThemeName,
	parseCfThemeFromConfig,
	pickGlobalHeadScanCandidates,
	type GlobalHeaderTarget,
} from '@/lib/solve/source-mapping';
import {
	detectCmsFromRootEntries,
	NESTED_WEB_ROOT_DIRS,
	type CmsRootListEntry,
	type CmsRootSignature,
	type CmsSignatureMode,
} from '@/lib/solve/cms-root-signature';
import {
	MAX_REMOTE_SCAN_ENTRIES,
	shouldSkipRemoteScanDir,
	toAbsoluteRemotePath,
	type RemoteListEntry,
	type RemoteTransport,
	walkRemoteTree,
} from '@/lib/solve/remote-transport';

export type { CmsRootListEntry, CmsRootSignature, CmsSignatureMode };
export { detectCmsFromRootEntries };

export type RemoteCmsLabel =
	| '그누보드(테마사용)'
	| '그누보드(테마미사용)'
	| '워드프레스'
	| '라이믹스/XE'
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

export type GnuboardInjectTier = 1 | 2 | 3 | 4 | 5;

/** Root / theme files to probe with SIZE — never a full recursive walk on Cafe24. */
export const GNUBOARD_KEY_FILES = ['head.sub.php', 'head.php', 'index.php'] as const;
export const GNUBOARD_SIGNAL_FILES = ['common.php', 'config.php'] as const;

/** Skip the 2500-path walk once a real Gnuboard header (theme or root) exists. */
export function shouldSkipFullRemoteWalk(
	hits: Array<{ tier: GnuboardInjectTier }>,
): boolean {
	return hits.some((h) => h.tier === 1 || h.tier === 2 || h.tier === 3 || h.tier === 4);
}

export function buildGnuboardLightStructurePaths(paths: string[]): string[] {
	return [
		...new Set(
			paths
				.map((p) => normalizePath(p))
				.filter(Boolean),
		),
	];
}

/**
 * Resolve the on-disk theme folder name (case-insensitive) for a configured
 * `$config['cf_theme']`. No `cf_theme` (empty/missing) means the theme is
 * NOT in use — GnuBoard falls back to the root `/head.sub.php` in that case,
 * so this must return `null` rather than guessing a "site-looking" theme
 * folder name. A ghost/leftover `theme/basic/` (or any other) folder must
 * never be promoted just because it happens to exist on disk.
 */
export function pickGnuboardPinpointTheme(
	themeDirNames: string[],
	cfTheme?: string | null,
): string | null {
	if (!cfTheme) return null;
	const names = themeDirNames
		.map((n) => n.trim())
		.filter((n) => n && !n.startsWith('.') && !shouldSkipRemoteScanDir(n));
	const named = names.find((n) => n.toLowerCase() === cfTheme.toLowerCase());
	return named || cfTheme;
}

/**
 * FTP inject path priority — resolved strictly from `$config['cf_theme']`
 * (never a hardcoded `theme/basic/` guess, never "any theme folder that
 * happens to exist"):
 *  1 - theme/{cf_theme}/head.sub.php (only when cf_theme is set)
 *  2 - theme/{cf_theme}/head.php     (head.sub.php missing in that theme)
 *  3 - head.sub.php                 (theme unused, or theme header missing — root fallback)
 *  4 - head.php                     (root head.sub.php missing)
 *  5 - index.html / index.php       (last resort)
 */
export function gnuboardInjectTier(relativePath: string): GnuboardInjectTier | null {
	const p = normalizePath(relativePath);
	if (/(^|\/)theme\/[^/]+\/head\.sub\.php$/i.test(p)) return 1;
	if (/(^|\/)theme\/[^/]+\/head\.php$/i.test(p)) return 2;
	if (/(^|\/)head\.sub\.php$/i.test(p) && !/(^|\/)theme\//i.test(p)) return 3;
	if (/(^|\/)head\.php$/i.test(p) && !/(^|\/)theme\//i.test(p)) return 4;
	if (/(^|\/)index\.(html|htm|php)$/i.test(p)) return 5;
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

function toSignatureEntries(entries: RemoteListEntry[]): CmsRootListEntry[] {
	return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory }));
}

async function resolveWebRootListing(
	transport: RemoteTransport,
): Promise<{ prefix: string; entries: RemoteListEntry[]; logs: string[] }> {
	const logs: string[] = [];
	logs.push(`루트 1-Depth LIST: ${transport.root}`);
	let entries: RemoteListEntry[] = [];
	try {
		entries = await transport.list(transport.root);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logs.push(`루트 LIST 실패: ${message}`);
		return { prefix: '', entries: [], logs };
	}
	logs.push(`루트 항목 ${entries.length}개 — CMS 시그니처 판별`);

	const signature = detectCmsFromRootEntries(toSignatureEntries(entries));
	if (signature.mode !== 'unknown' || signature.nestedWebRoots.length === 0) {
		return { prefix: '', entries, logs };
	}

	for (const name of NESTED_WEB_ROOT_DIRS) {
		if (!signature.nestedWebRoots.includes(name)) continue;
		const abs = toAbsoluteRemotePath(transport.root, name);
		try {
			const nested = await transport.list(abs);
			const nestedSig = detectCmsFromRootEntries(toSignatureEntries(nested));
			logs.push(`${name}/ 1-Depth LIST — 시그니처=${nestedSig.mode}`);
			if (nestedSig.mode !== 'unknown') {
				return { prefix: `${name}/`, entries: nested, logs };
			}
		} catch {
			/* try next hosting prefix */
		}
	}
	return { prefix: '', entries, logs };
}

async function listThemeDirNames(
	transport: RemoteTransport,
	themeDirRel: string,
): Promise<string[]> {
	const abs = toAbsoluteRemotePath(transport.root, themeDirRel);
	let entries: RemoteListEntry[];
	try {
		entries = await transport.list(abs);
	} catch {
		return [];
	}
	return entries
		.filter((e) => e.isDirectory && e.name && !shouldSkipRemoteScanDir(e.name))
		.map((e) => e.name);
}

export type ProbedRemoteHeader = {
	relativePath: string;
	tier: GnuboardInjectTier;
};

export type PinpointProbeResult = {
	primary: string | null;
	hits: ProbedRemoteHeader[];
	keyFiles: string[];
	logs: string[];
	mode: CmsSignatureMode;
	structurePaths: string[];
	signature: CmsRootSignature;
};

/**
 * CMS-signature pinpoint: one root LIST, then SIZE only the winning header.
 * Never walks data/uploads/images or 2500-path trees.
 */
export async function probeRemotePriorityHeaders(
	transport: RemoteTransport,
	opts?: { stopAtFirst?: boolean; light?: boolean; urlPaths?: string[] },
): Promise<PinpointProbeResult> {
	const stopAtFirst = Boolean(opts?.stopAtFirst);
	const listed = await resolveWebRootListing(transport);
	const logs = [...listed.logs];
	const prefix = listed.prefix;
	let signature = detectCmsFromRootEntries(toSignatureEntries(listed.entries));
	logs.push(
		`CMS 시그니처: ${signature.mode || 'unknown'}${signature.signals.length ? ` (${signature.signals.join(', ')})` : ''}`,
	);

	if (signature.needsDbconfigProbe) {
		const dbRel = `${prefix}data/dbconfig.php`;
		if (await remoteFileExists(transport, dbRel)) {
			signature = {
				...signature,
				mode: 'gnuboard',
				signals: [...new Set([...signature.signals, 'data/dbconfig.php'])],
			};
			logs.push(`그누보드 확정: ${dbRel} SIZE 확인`);
		}
	}

	if (signature.mode === 'gnuboard') {
		return pinpointGnuboardTargets(
			transport,
			prefix,
			listed.entries,
			signature,
			logs,
			stopAtFirst,
			opts?.urlPaths,
		);
	}
	if (signature.mode === 'wordpress') {
		return pinpointWordpressTargets(transport, prefix, listed.entries, signature, logs, stopAtFirst);
	}
	if (signature.mode === 'standalone') {
		return pinpointStandaloneTargets(transport, prefix, listed.entries, signature, logs, stopAtFirst);
	}
	return pinpointCustomTargets(transport, prefix, listed.entries, signature, logs, stopAtFirst);
}

/** Read root `/config.php` and parse `$config['cf_theme']` (empty string → null). */
async function readRemoteCfTheme(
	transport: RemoteTransport,
	prefix: string,
): Promise<string | null> {
	const rel = `${prefix}config.php`;
	const abs = toAbsoluteRemotePath(transport.root, rel);
	try {
		const source = await transport.readText(abs);
		return parseCfThemeFromConfig(source);
	} catch {
		return null;
	}
}

/**
 * Gnuboard / Youngcart pinpoint (Active Theme Checker, FTP/SFTP):
 * ① `config.php` → `$config['cf_theme']` decides theme vs root — never guessed
 *    from disk listing alone (a leftover `theme/basic/` or any other ghost
 *    folder must NOT win just because it exists).
 * ② cf_theme set  → theme/{cf_theme}/head.sub.php, else theme/{cf_theme}/head.php
 *    (only if that exact file actually exists on disk — verified via SIZE/EXISTS
 *    before ever being returned as a write target).
 * ③ cf_theme empty/missing, or the configured theme has no header file →
 *    fall back to the root header: head.sub.php, then head.php.
 * ④ Absolute last resort: index.php.
 */
async function pinpointGnuboardTargets(
	transport: RemoteTransport,
	prefix: string,
	rootEntries: RemoteListEntry[],
	signature: CmsRootSignature,
	logs: string[],
	stopAtFirst: boolean,
	urlPaths?: string[],
): Promise<PinpointProbeResult> {
	const hits: ProbedRemoteHeader[] = [];
	const keyFiles: string[] = [];
	const structurePaths = buildGnuboardLightStructurePaths(
		rootEntries.map((e) =>
			e.isDirectory ? `${prefix}${e.name}/` : `${prefix}${e.name}`,
		),
	);

	const add = (rel: string, tier: GnuboardInjectTier) => {
		const n = normalizePath(rel);
		if (hits.some((h) => h.relativePath.toLowerCase() === n.toLowerCase())) return;
		hits.push({ relativePath: n, tier });
		keyFiles.push(n);
		structurePaths.push(n);
	};

	logs.push('그누보드 핀포인트 — config.php cf_theme 우선 확인 (테마 폴더 실존만으로는 승격하지 않음)');

	const cfTheme = await readRemoteCfTheme(transport, prefix);
	let themeNames: string[] = [];
	const hasThemeDir = rootEntries.some(
		(e) => e.isDirectory && e.name.toLowerCase() === 'theme',
	);
	if (hasThemeDir) {
		themeNames = await listThemeDirNames(transport, `${prefix}theme`);
		logs.push(`theme/ 목록 ${themeNames.length}개: ${themeNames.join(', ') || '(없음)'}`);
	}

	const liveThemeHints: string[] = [];
	for (const name of themeNames) {
		const themeRel = `${prefix}theme/${name}`;
		let live = false;
		try {
			const kids = await transport.list(toAbsoluteRemotePath(transport.root, themeRel));
			live = kids.some((e) => e.isDirectory && /^(contents|skin)$/i.test(e.name));
		} catch {
			live =
				(await remoteFileExists(transport, `${themeRel}/contents`)) ||
				(await remoteFileExists(transport, `${themeRel}/skin`));
		}
		if (live) liveThemeHints.push(`theme/${name}/contents/`);
	}
	const inferredTheme = inferGnuboardThemeName({
		relativePaths: [
			...structurePaths,
			...themeNames.map((n) => `theme/${n}/head.sub.php`),
			...liveThemeHints,
		],
		urlPaths,
		configSource: cfTheme ? `$config['cf_theme'] = '${cfTheme}';` : '',
	});
	const resolvedTheme = cfTheme || inferredTheme;

	logs.push(
		cfTheme
			? `config.php cf_theme='${cfTheme}' — 테마 사용 사이트로 판단`
			: inferredTheme
				? `config.php cf_theme 미검출 — 라이브 테마 신호 theme/${inferredTheme}/ (contents/skin/URL)`
				: 'config.php cf_theme 비어있음/미검출 — 테마 미사용, 루트 헤더 우선 (ghost theme/ 폴더 무시)',
	);

	if (resolvedTheme) {
		const themeName = pickGnuboardPinpointTheme(themeNames, resolvedTheme) || resolvedTheme;

		const headSubRel = `${prefix}theme/${themeName}/head.sub.php`;
		if (await remoteFileExists(transport, headSubRel)) {
			add(headSubRel, 1);
			logs.push(`테마 head.sub.php 실존 확인 — 1순위 타겟: ${headSubRel}`);
		} else {
			const headPhpRel = `${prefix}theme/${themeName}/head.php`;
			if (await remoteFileExists(transport, headPhpRel)) {
				add(headPhpRel, 2);
				logs.push(`테마에 head.sub.php 없음 — head.php 폴백: ${headPhpRel}`);
			} else {
				logs.push(`theme/${themeName}/ 내 헤더 파일을 찾지 못함 — 루트로 폴백`);
			}
		}
	}

	if (hits.length === 0) {
		const rootHeadSubRel = `${prefix}head.sub.php`;
		if (await remoteFileExists(transport, rootHeadSubRel)) {
			add(rootHeadSubRel, 3);
			logs.push(`루트 head.sub.php 실존 확인 — 타겟: ${rootHeadSubRel}`);
		} else {
			const rootHeadPhpRel = `${prefix}head.php`;
			if (await remoteFileExists(transport, rootHeadPhpRel)) {
				add(rootHeadPhpRel, 4);
				logs.push(`루트 head.sub.php 없음 — head.php 폴백: ${rootHeadPhpRel}`);
			}
		}
	}

	const primary = hits[0]?.relativePath ?? null;
	if (primary) {
		logs.push(`핀포인트 타겟 확정: ${primary}`);
	} else {
		logs.push('그누보드 헤더 핀포인트 실패 — 루트 index.php 폴백 시도');
		const fallback = `${prefix}index.php`;
		if (await remoteFileExists(transport, fallback)) {
			add(fallback, 5);
		}
	}

	return {
		primary: hits[0]?.relativePath ?? null,
		hits,
		keyFiles,
		logs,
		mode: 'gnuboard',
		structurePaths: buildGnuboardLightStructurePaths(structurePaths),
		signature,
	};
}

async function pinpointWordpressTargets(
	transport: RemoteTransport,
	prefix: string,
	rootEntries: RemoteListEntry[],
	signature: CmsRootSignature,
	logs: string[],
	stopAtFirst: boolean,
): Promise<PinpointProbeResult> {
	const hits: ProbedRemoteHeader[] = [];
	const keyFiles: string[] = [];
	const structurePaths = buildGnuboardLightStructurePaths(
		rootEntries.map((e) =>
			e.isDirectory ? `${prefix}${e.name}/` : `${prefix}${e.name}`,
		),
	);
	logs.push('워드프레스 핀포인트 — functions.php (wp_head 훅) 우선, header.php 폴백');

	const themesDir = `${prefix}wp-content/themes`;
	const themeNames = await listThemeDirNames(transport, themesDir);
	const preferred =
		themeNames.find((n) => !/^twenty/i.test(n)) || themeNames[0] || null;
	const candidates = [
		preferred ? `${themesDir}/${preferred}/functions.php` : null,
		preferred ? `${themesDir}/${preferred}/header.php` : null,
		`${prefix}functions.php`,
		`${prefix}header.php`,
		`${prefix}index.php`,
	].filter((p): p is string => Boolean(p));

	for (const rel of candidates) {
		if (await remoteFileExists(transport, rel)) {
			const n = normalizePath(rel);
			const tier: GnuboardInjectTier = /functions\.php$/i.test(n)
				? 1
				: /header\.php$/i.test(n)
					? 2
					: 4;
			hits.push({ relativePath: n, tier });
			keyFiles.push(n);
			structurePaths.push(n);
			logs.push(`워드프레스 타겟: ${n}`);
			if (stopAtFirst) break;
		}
	}

	return {
		primary: hits[0]?.relativePath ?? null,
		hits,
		keyFiles,
		logs,
		mode: 'wordpress',
		structurePaths: buildGnuboardLightStructurePaths(structurePaths),
		signature,
	};
}

async function pinpointStandaloneTargets(
	transport: RemoteTransport,
	prefix: string,
	rootEntries: RemoteListEntry[],
	signature: CmsRootSignature,
	logs: string[],
	stopAtFirst: boolean,
): Promise<PinpointProbeResult> {
	const hits: ProbedRemoteHeader[] = [];
	const keyFiles: string[] = [];
	const structurePaths = buildGnuboardLightStructurePaths(
		rootEntries.map((e) =>
			e.isDirectory ? `${prefix}${e.name}/` : `${prefix}${e.name}`,
		),
	);
	logs.push('라이믹스/XE/Standalone 핀포인트 — 공통 헤더 템플릿 최상단 인클루드');

	const candidates = [
		`${prefix}common/header.php`,
		`${prefix}inc/header.php`,
		`${prefix}include/header.php`,
		`${prefix}header.php`,
		`${prefix}head.php`,
		`${prefix}index.php`,
	];

	const layoutsDir = `${prefix}layouts`;
	const layoutNames = await listThemeDirNames(transport, layoutsDir);
	for (const name of layoutNames.slice(0, 4)) {
		candidates.unshift(`${layoutsDir}/${name}/header.php`);
		candidates.unshift(`${layoutsDir}/${name}/layout.php`);
	}

	for (const rel of candidates) {
		if (await remoteFileExists(transport, rel)) {
			const n = normalizePath(rel);
			hits.push({ relativePath: n, tier: /header\.php$/i.test(n) ? 1 : 3 });
			keyFiles.push(n);
			structurePaths.push(n);
			logs.push(`Standalone 타겟: ${n}`);
			if (stopAtFirst) break;
		}
	}

	return {
		primary: hits[0]?.relativePath ?? null,
		hits,
		keyFiles,
		logs,
		mode: 'standalone',
		structurePaths: buildGnuboardLightStructurePaths(structurePaths),
		signature,
	};
}

async function pinpointCustomTargets(
	transport: RemoteTransport,
	prefix: string,
	rootEntries: RemoteListEntry[],
	signature: CmsRootSignature,
	logs: string[],
	stopAtFirst: boolean,
): Promise<PinpointProbeResult> {
	const hits: ProbedRemoteHeader[] = [];
	const keyFiles: string[] = [];
	const structurePaths = buildGnuboardLightStructurePaths(
		rootEntries.map((e) =>
			e.isDirectory ? `${prefix}${e.name}/` : `${prefix}${e.name}`,
		),
	);
	logs.push('커스텀 웹 핀포인트 — 루트 index.html / index.php 만 확인');

	for (const name of ['index.php', 'index.html', 'index.htm', 'header.php'] as const) {
		const rel = `${prefix}${name}`;
		const listed = rootEntries.some(
			(e) => !e.isDirectory && e.name.toLowerCase() === name,
		);
		if (!listed && !(await remoteFileExists(transport, rel))) continue;
		const n = normalizePath(rel);
		hits.push({ relativePath: n, tier: 4 });
		keyFiles.push(n);
		structurePaths.push(n);
		logs.push(`커스텀 타겟: ${n}`);
		if (stopAtFirst) break;
	}

	return {
		primary: hits[0]?.relativePath ?? null,
		hits,
		keyFiles,
		logs,
		mode: signature.mode === 'unknown' ? 'custom' : signature.mode,
		structurePaths: buildGnuboardLightStructurePaths(structurePaths),
		signature,
	};
}

function probedToRanked(
	hit: ProbedRemoteHeader,
	root: string,
	isPrimary: boolean,
): RankedRemoteTarget {
	const name = hit.relativePath.split('/').pop() || hit.relativePath;
	const badge =
		hit.tier === 1
			? `1순위 주입 타겟(테마 head.sub.php) / ${name}`
			: hit.tier === 2
				? `2순위 주입 타겟(테마 head.php) / ${name}`
				: hit.tier === 3
					? `루트 폴백(head.sub.php) / ${name}`
					: hit.tier === 4
						? `루트 폴백(head.php) / ${name}`
						: `폴백 / ${name}`;
	return {
		relativePath: hit.relativePath,
		absolutePath: toAbsoluteRemotePath(root, hit.relativePath),
		score:
			hit.tier === 1
				? 320
				: hit.tier === 2
					? 300
					: hit.tier === 3
						? 120
						: hit.tier === 4
							? 100
							: 80,
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
		case 'Rhymix / XE':
			return '라이믹스/XE';
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
		'functions.php',
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
	opts?: { urlPaths?: string[] },
): Promise<RemoteDiagnoseResult> {
	const logs: string[] = [];
	logs.push(`CMS 시그니처 핀포인트 탐색: ${transport.root} (최대 ${MAX_REMOTE_SCAN_ENTRIES}개 / 2-Depth)`);

	const probed = await probeRemotePriorityHeaders(transport, {
		light: true,
		urlPaths: opts?.urlPaths,
	});
	logs.push(...probed.logs);

	let relativePaths: string[] = buildGnuboardLightStructurePaths([
		...probed.structurePaths,
		...probed.hits.map((h) => h.relativePath),
		...probed.keyFiles,
	]);
	let truncated = false;
	const pinpointDone =
		probed.mode === 'gnuboard' ||
		probed.mode === 'wordpress' ||
		probed.mode === 'standalone' ||
		shouldSkipFullRemoteWalk(probed.hits);

	if (pinpointDone) {
		logs.push(
			`${probed.mode} 핀포인트 완료 — 재귀 스캔 생략 (블랙리스트 data/uploads/images 제외)`,
		);
	} else {
		const walked = await walkRemoteTree(transport, {
			maxDepth: 2,
			maxEntries: MAX_REMOTE_SCAN_ENTRIES,
		});
		relativePaths = buildGnuboardLightStructurePaths([
			...relativePaths,
			...walked.relativePaths,
		]);
		truncated = walked.truncated;
		logs.push(
			`2-Depth 보조 스캔 ${walked.relativePaths.length}개${truncated ? ' (50개 상한)' : ''}`,
		);
	}

	const structurePaths = [
		...new Set([
			...probed.hits.map((h) => normalizePath(h.relativePath)),
			...probed.keyFiles.map(normalizePath),
			...relativePaths.map(normalizePath),
		]),
	];
	const cms = detectCmsFromPaths(structurePaths);
	if (probed.mode === 'gnuboard') cms.display = 'Gnuboard';
	if (probed.mode === 'wordpress') cms.display = 'WordPress';
	if (probed.mode === 'standalone') cms.display = 'Rhymix / XE';
	logs.push(cms.message);

	const staticHtml = isHtmlOnlySite(structurePaths, cms.display);
	let themeActive: boolean | null = null;

	// Pinpoint: read only the confirmed header (never 48-file download).
	const candidates = new Set<string>(
		pinpointDone
			? [...probed.hits.map((h) => h.relativePath), ...probed.keyFiles].slice(0, 3)
			: [
					...probed.hits.map((h) => h.relativePath),
					...pickGlobalHeadScanCandidates(structurePaths, 8),
					...extraStaticCandidates(structurePaths),
				].slice(0, 8),
	);

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
		themeActive = themeFileHit || themeUsage.active;
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
