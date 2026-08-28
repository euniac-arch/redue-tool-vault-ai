/**
 * Remote FTP hang guards: light Gnuboard probe, skip full walk, timeline progress.
 * Run: npx tsx scripts/test-remote-patch-hang.ts
 */
import {
	buildGnuboardLightStructurePaths,
	detectCmsFromRootEntries,
	GNUBOARD_KEY_FILES,
	pickGnuboardPinpointTheme,
	shouldSkipFullRemoteWalk,
} from '../lib/solve/remote-header-finder';
import {
	FTP_TIMEOUT_MS,
	MAX_REMOTE_SCAN_DEPTH,
	MAX_REMOTE_SCAN_ENTRIES,
	shouldSkipRemoteScanDir,
	withRemoteTimeout,
} from '../lib/solve/remote-transport';
import { inferRemotePatchProgress } from '../lib/solve/remote-patch-stream';

let failed = 0;

function assert(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		console.log(`ok  ${label}`);
		return;
	}
	failed += 1;
	console.error(`fail ${label}${detail != null ? ` — ${String(detail)}` : ''}`);
}

assert('ftp timeout is 10000ms', FTP_TIMEOUT_MS === 10_000);
assert('scan depth cap is 2', MAX_REMOTE_SCAN_DEPTH === 2);
assert('scan file cap is 50', MAX_REMOTE_SCAN_ENTRIES === 50);

for (const dir of ['data', 'uploads', 'images', 'img', 'node_modules', '.git', 'cache', 'session']) {
	assert(`skip ${dir}/`, shouldSkipRemoteScanDir(dir) === true);
}
assert('do not skip theme/', shouldSkipRemoteScanDir('theme') === false);
assert('do not skip wp-content/', shouldSkipRemoteScanDir('wp-content') === false);

const gnuSig = detectCmsFromRootEntries([
	{ name: 'common.php', isDirectory: false },
	{ name: 'data', isDirectory: true },
	{ name: 'theme', isDirectory: true },
	{ name: 'uploads', isDirectory: true },
]);
assert('root LIST common.php → gnuboard', gnuSig.mode === 'gnuboard');
assert('gnuboard wants dbconfig probe when data/ exists', gnuSig.needsDbconfigProbe === false);

const dataOnly = detectCmsFromRootEntries([{ name: 'data', isDirectory: true }]);
assert('data/ only → gnuboard + dbconfig probe', dataOnly.mode === 'gnuboard' && dataOnly.needsDbconfigProbe);

const wpSig = detectCmsFromRootEntries([{ name: 'wp-config.php', isDirectory: false }]);
assert('wp-config.php → wordpress', wpSig.mode === 'wordpress');

const customSig = detectCmsFromRootEntries([
	{ name: 'index.html', isDirectory: false },
	{ name: 'images', isDirectory: true },
]);
assert('index.html → custom', customSig.mode === 'custom');

assert(
	'cf_theme wins when that folder exists',
	pickGnuboardPinpointTheme(['shop', 'basic'], 'shop') === 'shop',
);
assert(
	'cf_theme matches case-insensitively',
	pickGnuboardPinpointTheme(['Hospital', 'basic'], 'hospital') === 'Hospital',
);
assert(
	'empty cf_theme → null (root mode, never guess a theme folder)',
	pickGnuboardPinpointTheme(['basic', 'hospital'], null) === null,
);
assert(
	'empty cf_theme → null even when only a site-looking theme folder exists',
	pickGnuboardPinpointTheme(['shop'], null) === null,
);
assert(
	'empty cf_theme → null even when only theme/basic/ exists (ghost folder must not win)',
	pickGnuboardPinpointTheme(['basic'], null) === null,
);
assert(
	'cf_theme set but folder missing from listing → falls back to cf_theme name itself',
	pickGnuboardPinpointTheme([], 'shop') === 'shop',
);
assert(
	'key files include head.sub.php / head.php / index.php',
	GNUBOARD_KEY_FILES.includes('head.sub.php') &&
		GNUBOARD_KEY_FILES.includes('head.php') &&
		GNUBOARD_KEY_FILES.includes('index.php'),
);

assert(
	'skip walk after cf_theme head.sub.php (tier 1)',
	shouldSkipFullRemoteWalk([{ tier: 1 }]) === true,
);
assert(
	'skip walk after cf_theme head.php (tier 2)',
	shouldSkipFullRemoteWalk([{ tier: 2 }]) === true,
);
assert(
	'skip walk after root head.sub.php (tier 3)',
	shouldSkipFullRemoteWalk([{ tier: 3 }]) === true,
);
assert(
	'skip walk after root head.php (tier 4)',
	shouldSkipFullRemoteWalk([{ tier: 4 }]) === true,
);
assert(
	'do not skip walk on index-only fallback (tier 5)',
	shouldSkipFullRemoteWalk([{ tier: 5 }]) === false,
);
assert('do not skip walk when empty', shouldSkipFullRemoteWalk([]) === false);

const light = buildGnuboardLightStructurePaths([
	'theme/basic/head.sub.php',
	'/theme/basic/head.sub.php',
	'head.php',
	'index.php',
]);
assert('light paths are de-duped', light.length === 3);
assert(
	'light paths keep theme/basic/head.sub.php',
	light.includes('theme/basic/head.sub.php'),
);

assert(
	'progress 백업',
	inferRemotePatchProgress('[40%] 타겟 파일 원본 다운로드 및 백업 생성 (head.sub.php.bak)') === 40,
);
assert(
	'progress 주입',
	inferRemotePatchProgress('[진행 40%] 공통 헤더 원본 백업(head.sub.php.bak) 및 스키마/OG/Canonical 주입 업로드') === 40,
);
assert(
	'progress robots',
	inferRemotePatchProgress('[진행 60%] 루트 /www/robots.txt AI 친화형 파일 생성 및 업로드 완료') === 60,
);
assert(
	'progress sitemap',
	inferRemotePatchProgress('[진행 75%] 루트 /www/sitemap.xml — 헤더 선택 14개 + 메인 도메인 배포 완료') === 75,
);
assert(
	'progress 완료',
	inferRemotePatchProgress('[완료 100%] SEO & GEO 풀패키지 원격 패치 5종 배포 및 무결성 검증 성공!') === 100,
);
assert(
	'progress llms.txt',
	inferRemotePatchProgress('[진행 90%] 루트 /www/llms.txt 및 /www/llms-full.txt AI 지식 자산 배포 완료') === 90,
);
assert(
	'progress payload build',
	inferRemotePatchProgress('[진행 20%] 헤더 메뉴 선택 14개 URL 기반 메타/스키마/sitemap.xml 페이로드 동적 빌드 완료') === 20,
);
assert(
	'progress skip robots',
	inferRemotePatchProgress('[건너뜀] robots.txt 배포 제외됨') === 60,
);
assert(
	'progress skip sitemap',
	inferRemotePatchProgress('[건너뜀] sitemap.xml 배포 제외됨') === 75,
);
assert(
	'progress skip llms-full',
	inferRemotePatchProgress('[건너뜀] llms-full.txt 배포 제외됨') === 90,
);

async function runAsyncChecks() {
	const value = await withRemoteTimeout(Promise.resolve('ok'), 50, 'fast');
	assert('timeout helper resolves in time', value === 'ok');

	let timedOut = false;
	try {
		await withRemoteTimeout(new Promise(() => undefined), 20, 'hang-test');
	} catch (err) {
		timedOut = err instanceof Error && /원격 타임아웃/.test(err.message);
	}
	assert('timeout helper rejects hang', timedOut);
}

runAsyncChecks()
	.then(() => {
		if (failed > 0) {
			console.error(`\n${failed} assertion(s) failed`);
			process.exit(1);
		}
		console.log('\nremote-patch hang guards ok');
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
