/**
 * Browser-safe CMS root signature — 1-depth listing only, no FTP/SFTP/fs.
 * Shared by detect-cms (client File Patch) and remote-header-finder (server).
 */

export type CmsSignatureMode = 'gnuboard' | 'wordpress' | 'standalone' | 'custom' | 'unknown';

export type CmsRootListEntry = {
	name: string;
	isDirectory: boolean;
};

export type CmsRootSignature = {
	mode: CmsSignatureMode;
	signals: string[];
	needsDbconfigProbe: boolean;
	hasThemeDir: boolean;
	hasConfigPhp: boolean;
	nestedWebRoots: string[];
};

export const NESTED_WEB_ROOT_DIRS = ['www', 'html', 'public_html', 'public', 'httpdocs'] as const;

/**
 * CMS type from a single 1-depth listing (no recursion).
 * Gnuboard: common.php or data/ (then SIZE data/dbconfig.php)
 * WordPress: wp-config.php
 * Custom: index.html / index.php
 */
export function detectCmsFromRootEntries(entries: CmsRootListEntry[]): CmsRootSignature {
	const files = new Set<string>();
	const dirs = new Set<string>();
	for (const entry of entries) {
		const name = String(entry.name || '').trim();
		if (!name || name === '.' || name === '..') continue;
		const key = name.toLowerCase();
		if (entry.isDirectory) dirs.add(key);
		else files.add(key);
	}

	const signals: string[] = [];
	const hasCommon = files.has('common.php');
	const hasDbconfig = files.has('dbconfig.php');
	const hasDataDir = dirs.has('data');
	const hasThemeDir = dirs.has('theme');
	const hasConfigPhp = files.has('config.php');
	const hasHeadSub = files.has('head.sub.php');
	const hasWpConfig = files.has('wp-config.php');
	const hasIndexHtml = files.has('index.html') || files.has('index.htm');
	const hasIndexPhp = files.has('index.php');
	const hasConfigInc = files.has('config.inc.php');
	const hasCommonDir = dirs.has('common');
	const hasModulesDir = dirs.has('modules');
	const hasFilesDir = dirs.has('files');
	const hasLayoutsDir = dirs.has('layouts');
	const rhymixHit =
		hasConfigInc ||
		(hasCommonDir && hasModulesDir && hasFilesDir && !hasHeadSub && !hasDbconfig);

	if (hasCommon) signals.push('common.php');
	if (hasDbconfig) signals.push('dbconfig.php');
	if (hasDataDir) signals.push('data/');
	if (hasThemeDir) signals.push('theme/');
	if (hasHeadSub) signals.push('head.sub.php');
	if (hasWpConfig) signals.push('wp-config.php');
	if (dirs.has('wp-content')) signals.push('wp-content/');
	if (hasConfigInc) signals.push('config.inc.php');
	if (hasCommonDir && hasModulesDir) signals.push('common/+modules/');
	if (hasLayoutsDir) signals.push('layouts/');
	if (hasIndexHtml) signals.push('index.html');
	if (hasIndexPhp) signals.push('index.php');

	const nestedWebRoots = NESTED_WEB_ROOT_DIRS.filter((name) => dirs.has(name));
	const gnuboardHit = hasCommon || hasDbconfig || hasDataDir || (hasThemeDir && (hasHeadSub || dirs.has('bbs')));

	if (gnuboardHit) {
		return {
			mode: 'gnuboard',
			signals,
			needsDbconfigProbe: hasDataDir && !hasCommon && !hasDbconfig,
			hasThemeDir,
			hasConfigPhp,
			nestedWebRoots,
		};
	}
	if (hasWpConfig || dirs.has('wp-content') || dirs.has('wp-includes')) {
		return {
			mode: 'wordpress',
			signals,
			needsDbconfigProbe: false,
			hasThemeDir: false,
			hasConfigPhp,
			nestedWebRoots,
		};
	}
	if (rhymixHit) {
		return {
			mode: 'standalone',
			signals,
			needsDbconfigProbe: false,
			hasThemeDir: hasLayoutsDir,
			hasConfigPhp,
			nestedWebRoots,
		};
	}
	if (hasIndexHtml || hasIndexPhp) {
		return {
			mode: 'custom',
			signals,
			needsDbconfigProbe: false,
			hasThemeDir,
			hasConfigPhp,
			nestedWebRoots,
		};
	}
	return {
		mode: 'unknown',
		signals,
		needsDbconfigProbe: false,
		hasThemeDir,
		hasConfigPhp,
		nestedWebRoots,
	};
}
