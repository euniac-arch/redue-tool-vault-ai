import { existsSync, readFileSync } from 'fs';
import nextEnv from '@next/env';
import path from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Root `.env` ships empty OAuth placeholders (`KAKAO_CLIENT_ID=""`).
 * `@next/env` will not overwrite an already-defined key — even an empty
 * string — and a second `loadEnvConfig(studio)` is skipped after the root
 * `.env` was already ingested. Manually apply non-empty studio credentials
 * so Kakao/Google providers actually enable.
 */
const OAUTH_ENV_KEYS = [
	'KAKAO_CLIENT_ID',
	'KAKAO_CLIENT_SECRET',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
];

function parseDotenvFile(filePath) {
	if (!existsSync(filePath)) return {};
	const parsed = {};
	for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq < 1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		parsed[key] = value;
	}
	return parsed;
}

function dropEmptyEnv(keys) {
	for (const key of keys) {
		if (typeof process.env[key] === 'string' && !process.env[key].trim()) {
			delete process.env[key];
		}
	}
}

function applyNonEmptyOAuthKeys(filePath) {
	const parsed = parseDotenvFile(filePath);
	for (const key of OAUTH_ENV_KEYS) {
		const value = (parsed[key] || '').trim();
		if (value) process.env[key] = value;
	}
}

loadEnvConfig(path.join(__dirname, '..'));
dropEmptyEnv(OAUTH_ENV_KEYS);
applyNonEmptyOAuthKeys(path.join(__dirname, '.env'));
applyNonEmptyOAuthKeys(path.join(__dirname, '.env.local'));

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// Keep motion packages in the app transpile graph so webpack does not emit
	// a broken `./vendor-chunks/motion-dom.js` require for server bundles.
	transpilePackages: ['framer-motion', 'motion-dom', 'motion-utils'],
	// mysql2 is only used server-side (best-effort active-theme lookup); keep it
	// out of the client bundle and let API routes require it at runtime.
	experimental: {
		serverComponentsExternalPackages: ['mysql2', 'basic-ftp', 'ssh2-sftp-client', 'ssh2'],
	},
	webpack: (config) => {
		// Suppress noisy webpack.cache.PackFileCacheStrategy / FileSystemInfo
		// warnings (e.g. from next-intl's dynamic imports) that clutter the
		// `npm run dev` console but don't indicate real build errors.
		config.infrastructureLogging = {
			level: 'error',
		};

		return config;
	},
};

export default withNextIntl(nextConfig);
