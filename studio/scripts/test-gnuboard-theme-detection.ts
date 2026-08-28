/**
 * Regression test for the Active Theme Checker used by the FTP/SFTP pinpoint
 * prober (`probeRemotePriorityHeaders` → `pinpointGnuboardTargets`).
 *
 * Reproduces the reported bug: a site (e.g. admentor.co.kr) that does NOT use
 * a Gnuboard theme (`$config['cf_theme']` empty) but still has a leftover
 * `theme/basic/head.sub.php` file on disk must inject into the ROOT
 * `/head.sub.php`, never the hardcoded `theme/basic/...` ghost file.
 *
 * Run: npx tsx scripts/test-gnuboard-theme-detection.ts
 */
import { probeRemotePriorityHeaders } from '../lib/solve/remote-header-finder';
import type { RemoteListEntry, RemoteTransport } from '../lib/solve/remote-transport';

let failed = 0;
function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

type FakeFile = { isDirectory: boolean; content?: string };

/** In-memory fake remote filesystem — no real network I/O. */
function makeFakeTransport(files: Record<string, FakeFile>): RemoteTransport {
	const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
	const root = '/www';

	return {
		protocol: 'sftp',
		root,
		async list(dirAbsolute: string): Promise<RemoteListEntry[]> {
			const dirRel = norm(dirAbsolute.replace(root, ''));
			const prefix = dirRel ? `${dirRel}/` : '';
			const seen = new Map<string, RemoteListEntry>();
			for (const [path, meta] of Object.entries(files)) {
				const rel = norm(path);
				if (!rel.startsWith(prefix)) continue;
				const rest = rel.slice(prefix.length);
				if (!rest) continue;
				const [name] = rest.split('/');
				if (seen.has(name)) continue;
				const isDir = rest.includes('/') || meta.isDirectory;
				seen.set(name, {
					name,
					path: `${dirAbsolute}/${name}`,
					relativePath: prefix ? `${prefix}${name}` : name,
					isDirectory: isDir,
					size: meta.content?.length ?? 0,
				});
			}
			return [...seen.values()];
		},
		async readText(absolutePath: string): Promise<string> {
			const rel = norm(absolutePath.replace(root, ''));
			const hit = files[rel];
			if (!hit || hit.isDirectory) throw new Error(`ENOENT: ${absolutePath}`);
			return hit.content ?? '';
		},
		async writeText(): Promise<void> {
			/* no-op for this read-only probe test */
		},
		async ensureDir(): Promise<void> {
			/* no-op */
		},
		async exists(absolutePath: string): Promise<boolean> {
			const rel = norm(absolutePath.replace(root, ''));
			return Boolean(files[rel]);
		},
		async size(absolutePath: string): Promise<number> {
			const rel = norm(absolutePath.replace(root, ''));
			const hit = files[rel];
			if (!hit) throw new Error(`ENOENT: ${absolutePath}`);
			return hit.content?.length ?? 0;
		},
		async close(): Promise<void> {
			/* no-op */
		},
	};
}

async function run() {
	// Case: admentor.co.kr-like site — root head.sub.php is the real common
	// header, cf_theme is empty, but a ghost theme/basic/head.sub.php exists.
	const rootModeSite = makeFakeTransport({
		'common.php': { isDirectory: false, content: '<?php // gnuboard core' },
		'data': { isDirectory: true },
		'config.php': { isDirectory: false, content: "<?php\n$config['cf_theme'] = '';\n" },
		'head.sub.php': {
			isDirectory: false,
			content: '<!doctype html><html><head><title>root</title></head><body></body></html>',
		},
		'theme': { isDirectory: true },
		'theme/basic': { isDirectory: true },
		'theme/basic/head.sub.php': {
			isDirectory: false,
			content: '<!doctype html><html><head><title>ghost theme</title></head><body></body></html>',
		},
	});

	const rootResult = await probeRemotePriorityHeaders(rootModeSite, { light: true });
	assert(
		'root-mode site (cf_theme empty) picks root head.sub.php, not ghost theme/basic/',
		rootResult.primary === 'head.sub.php',
		rootResult.primary,
	);
	assert('root-mode site hit tier is 3 (root fallback)', rootResult.hits[0]?.tier === 3, rootResult.hits[0]?.tier);

	// Case: a real theme site (cf_theme set + theme file exists) still wins tier 1.
	const themeModeSite = makeFakeTransport({
		'common.php': { isDirectory: false, content: '<?php // gnuboard core' },
		'data': { isDirectory: true },
		'config.php': { isDirectory: false, content: "<?php\n$config['cf_theme'] = 'hospital';\n" },
		'head.sub.php': {
			isDirectory: false,
			content: '<!doctype html><html><head><title>root</title></head><body></body></html>',
		},
		'theme': { isDirectory: true },
		'theme/hospital': { isDirectory: true },
		'theme/hospital/head.sub.php': {
			isDirectory: false,
			content: '<!doctype html><html><head><title>hospital theme</title></head><body></body></html>',
		},
	});

	const themeResult = await probeRemotePriorityHeaders(themeModeSite, { light: true });
	assert(
		'theme-mode site (cf_theme=hospital) picks theme/hospital/head.sub.php',
		themeResult.primary === 'theme/hospital/head.sub.php',
		themeResult.primary,
	);
	assert('theme-mode site hit tier is 1', themeResult.hits[0]?.tier === 1, themeResult.hits[0]?.tier);

	// Case: cf_theme set but the configured theme folder has no header file →
	// must fall back to root, never crash or silently pick another theme.
	const brokenThemeSite = makeFakeTransport({
		'common.php': { isDirectory: false, content: '<?php // gnuboard core' },
		'data': { isDirectory: true },
		'config.php': { isDirectory: false, content: "<?php\n$config['cf_theme'] = 'missing';\n" },
		'head.sub.php': {
			isDirectory: false,
			content: '<!doctype html><html><head><title>root</title></head><body></body></html>',
		},
		'theme': { isDirectory: true },
		'theme/basic': { isDirectory: true },
		'theme/basic/head.sub.php': {
			isDirectory: false,
			content: '<!doctype html><html><head><title>ghost</title></head><body></body></html>',
		},
	});

	const brokenResult = await probeRemotePriorityHeaders(brokenThemeSite, { light: true });
	assert(
		'cf_theme points to a non-existent theme folder → falls back to root head.sub.php',
		brokenResult.primary === 'head.sub.php',
		brokenResult.primary,
	);

	// Case: nineoneclinic-like — cf_theme lives in MySQL so config.php is empty,
	// root head.sub.php is the official dispatcher, and live pages live under
	// theme/basic/contents/*.php. Must inject the theme header, not the root stub.
	const clinicSite = makeFakeTransport({
		'common.php': { isDirectory: false, content: '<?php // gnuboard core' },
		'data': { isDirectory: true },
		'config.php': { isDirectory: false, content: "<?php\n$config['cf_theme'] = '';\n" },
		'head.sub.php': {
			isDirectory: false,
			content:
				"<?php\nif (!defined('_GNUBOARD_')) exit;\nif (defined('G5_THEME_PATH') && is_file(G5_THEME_PATH.'/head.sub.php')) { include_once(G5_THEME_PATH.'/head.sub.php'); return; }\n?><!doctype html><html><head><title>root stub</title></head></html>",
		},
		'theme': { isDirectory: true },
		'theme/basic': { isDirectory: true },
		'theme/basic/head.sub.php': {
			isDirectory: false,
			content: '<!doctype html><html><head><meta charset="utf-8"><title>나인원의원</title></head></html>',
		},
		'theme/basic/contents': { isDirectory: true },
		'theme/basic/contents/s101.php': { isDirectory: false, content: '<?php /* 인사말 */ ?>' },
	});

	const clinicResult = await probeRemotePriorityHeaders(clinicSite, {
		light: true,
		urlPaths: ['/', '/theme/basic/contents/s101.php', '/theme/basic/contents/s201.php'],
	});
	assert(
		'theme-contents site (cf_theme empty, live /theme/basic/contents) picks theme/basic/head.sub.php',
		clinicResult.primary === 'theme/basic/head.sub.php',
		clinicResult.primary,
	);

	if (failed > 0) {
		console.error(`\n${failed} assertion(s) failed`);
		process.exit(1);
	}
	console.log('\ngnuboard theme detection ok');
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
