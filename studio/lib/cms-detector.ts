import fs from 'node:fs';
import path from 'node:path';
import type { CmsDetectionResult, ThemeDetectionMethod } from './types';

/** Default WordPress core themes bundled with every install — never the
 * custom "active" theme we're looking for, used as a fallback heuristic
 * when no database connection is available. */
const DEFAULT_BUNDLED_THEME_PATTERN = /^twentytwenty/i;

interface WpConfigCreds {
	dbName: string | null;
	dbUser: string | null;
	dbPassword: string | null;
	dbHost: string | null;
	tablePrefix: string;
}

function parseWpConfigCreds(wpConfigPath: string): WpConfigCreds {
	const creds: WpConfigCreds = {
		dbName: null,
		dbUser: null,
		dbPassword: null,
		dbHost: null,
		tablePrefix: 'wp_',
	};

	try {
		const contents = fs.readFileSync(wpConfigPath, 'utf8');

		const define = (name: string) => {
			const match = contents.match(
				new RegExp(`define\\(\\s*['"]${name}['"]\\s*,\\s*['"]([^'"]*)['"]`)
			);
			return match ? match[1] : null;
		};

		creds.dbName = define('DB_NAME');
		creds.dbUser = define('DB_USER');
		creds.dbPassword = define('DB_PASSWORD');
		creds.dbHost = define('DB_HOST');

		const prefixMatch = contents.match(/\$table_prefix\s*=\s*['"]([^'"]*)['"]/);
		if (prefixMatch) {
			creds.tablePrefix = prefixMatch[1];
		}
	} catch {
		// Unreadable / missing wp-config.php — caller falls back to heuristics.
	}

	return creds;
}

/**
 * Best-effort lookup of the active theme folder via the WordPress database
 * (`wp_options.template`). This is the source of truth in a real install,
 * but the pipeline must never hang or crash if no DB server is reachable
 * (e.g. in this sandbox), so the connection is short-timeout + try/catch.
 */
async function detectActiveThemeViaDatabase(rootPath: string): Promise<string | null> {
	const wpConfigPath = path.join(rootPath, 'wp-config.php');
	if (!fs.existsSync(wpConfigPath)) {
		return null;
	}

	const creds = parseWpConfigCreds(wpConfigPath);
	if (!creds.dbName || !creds.dbUser || !creds.dbHost) {
		return null;
	}

	try {
		// Imported lazily and only used server-side so a missing/optional
		// dependency never breaks the rest of the app at build time.
		const mysql = await import('mysql2/promise');
		const connection = await mysql.createConnection({
			host: creds.dbHost,
			user: creds.dbUser,
			password: creds.dbPassword ?? '',
			database: creds.dbName,
			connectTimeout: 1500,
		});

		try {
			const [rows] = await connection.query(
				`SELECT option_value FROM \`${creds.tablePrefix}options\` WHERE option_name = 'template' LIMIT 1`
			);
			const row = Array.isArray(rows) ? (rows[0] as { option_value?: string } | undefined) : undefined;
			return row?.option_value ?? null;
		} finally {
			await connection.end().catch(() => undefined);
		}
	} catch {
		// No live MySQL server, wrong creds, or mysql2 unavailable — this is
		// an expected, non-fatal path in sandboxed/offline environments.
		return null;
	}
}

/** Filesystem heuristic: the only theme folder that isn't a WordPress
 * default bundled theme is assumed to be the active custom theme. */
function detectActiveThemeViaHeuristic(themesDir: string): string | null {
	try {
		const entries = fs
			.readdirSync(themesDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.filter((name) => !DEFAULT_BUNDLED_THEME_PATTERN.test(name));

		if (entries.length === 1) {
			return entries[0];
		}

		// Multiple/zero custom candidates: prefer the one with the most
		// recently modified style.css, which is a reasonable proxy for
		// "the theme someone is actively developing/using".
		const withMtime = entries
			.map((name) => {
				const styleCssPath = path.join(themesDir, name, 'style.css');
				try {
					return { name, mtime: fs.statSync(styleCssPath).mtimeMs };
				} catch {
					return null;
				}
			})
			.filter((value): value is { name: string; mtime: number } => value !== null)
			.sort((a, b) => b.mtime - a.mtime);

		return withMtime[0]?.name ?? null;
	} catch {
		return null;
	}
}

export async function detectCms(
	rootPath: string,
	themeOverride?: string | null
): Promise<CmsDetectionResult> {
	const hasWpConfig = fs.existsSync(path.join(rootPath, 'wp-config.php'));
	const hasWpLoad = fs.existsSync(path.join(rootPath, 'wp-load.php'));
	const themesDir = path.join(rootPath, 'wp-content', 'themes');
	const themesDirExists = fs.existsSync(themesDir) && fs.statSync(themesDir).isDirectory();

	const cmsType = hasWpConfig || hasWpLoad ? (themesDirExists ? 'WORDPRESS' : 'UNKNOWN') : 'UNKNOWN';

	if (cmsType !== 'WORDPRESS') {
		return {
			cmsType: 'UNKNOWN',
			rootPath,
			hasWpConfig,
			hasWpLoad,
			themesDir: themesDirExists ? themesDir : null,
			themesDirExists,
			activeTheme: null,
			activeThemePath: null,
			detectionMethod: 'none',
			detectionNote: !hasWpConfig && !hasWpLoad
				? 'wp-config.php / wp-load.php를 찾을 수 없습니다.'
				: 'wp-content/themes 디렉토리를 찾을 수 없습니다.',
		};
	}

	let activeTheme: string | null = null;
	let detectionMethod: ThemeDetectionMethod = 'none';
	let detectionNote = '활성 테마를 판별하지 못했습니다.';

	if (themeOverride && fs.existsSync(path.join(themesDir, themeOverride))) {
		activeTheme = themeOverride;
		detectionMethod = 'override';
		detectionNote = `사용자가 지정한 테마 슬러그(${themeOverride})를 사용했습니다.`;
	} else {
		const dbTheme = await detectActiveThemeViaDatabase(rootPath);
		if (dbTheme && fs.existsSync(path.join(themesDir, dbTheme))) {
			activeTheme = dbTheme;
			detectionMethod = 'database';
			detectionNote = `wp_options.template 조회로 활성 테마(${dbTheme})를 확인했습니다.`;
		} else {
			const heuristicTheme = detectActiveThemeViaHeuristic(themesDir);
			if (heuristicTheme) {
				activeTheme = heuristicTheme;
				detectionMethod = 'heuristic';
				detectionNote = `DB에 연결할 수 없어 기본 번들 테마를 제외한 파일시스템 추정으로 활성 테마(${heuristicTheme})를 판별했습니다.`;
			}
		}
	}

	return {
		cmsType: 'WORDPRESS',
		rootPath,
		hasWpConfig,
		hasWpLoad,
		themesDir,
		themesDirExists: true,
		activeTheme,
		activeThemePath: activeTheme ? path.join(themesDir, activeTheme) : null,
		detectionMethod,
		detectionNote,
	};
}
