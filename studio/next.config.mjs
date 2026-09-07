import { existsSync, readFileSync } from 'fs';
import nextEnv from '@next/env';
import path from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Root `.env` ships empty placeholders (`KAKAO_CLIENT_ID=""`, `GEMINI_API_KEY=""`).
 * `@next/env` will not overwrite an already-defined key — even an empty
 * string — and a second `loadEnvConfig(studio)` is skipped after the root
 * `.env` was already ingested. Drop empties, then apply non-empty studio
 * credentials so OAuth + Gemini/Perplexity actually enable.
 */
const OAUTH_ENV_KEYS = [
	'KAKAO_CLIENT_ID',
	'KAKAO_CLIENT_SECRET',
	'GOOGLE_CLIENT_ID',
	'GOOGLE_CLIENT_SECRET',
];

const LLM_ENV_KEYS = [
	'OPENAI_API_KEY',
	'ANTHROPIC_API_KEY',
	'GEMINI_API_KEY',
	'GOOGLE_GENERATIVE_AI_API_KEY',
	'GOOGLE_API_KEY',
	'GOOGLE_AI_API_KEY',
	'PERPLEXITY_API_KEY',
	'PPLX_API_KEY',
	'OPENAI_MODEL',
	'ANTHROPIC_MODEL',
	'GEMINI_MODEL',
	'PERPLEXITY_MODEL',
	'ASI_MODE',
];

const OVERRIDE_ENV_KEYS = [...OAUTH_ENV_KEYS, ...LLM_ENV_KEYS];

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

function applyNonEmptyEnvKeys(filePath, keys) {
	const parsed = parseDotenvFile(filePath);
	for (const key of keys) {
		const value = (parsed[key] || '').trim();
		if (value) process.env[key] = value;
	}
}

loadEnvConfig(path.join(__dirname, '..'));
dropEmptyEnv(OVERRIDE_ENV_KEYS);
applyNonEmptyEnvKeys(path.join(__dirname, '.env'), OVERRIDE_ENV_KEYS);
applyNonEmptyEnvKeys(path.join(__dirname, '.env.local'), OVERRIDE_ENV_KEYS);

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	async redirects() {
		return [
			{ source: '/cases', destination: '/portfolio', permanent: false },
			{ source: '/cases/case-study/:id', destination: '/portfolio/case-study/:id', permanent: false },
			{ source: '/cases/:id', destination: '/portfolio/case-study/:id', permanent: false },
		];
	},
	// Keep motion packages in the app transpile graph so webpack does not emit
	// a broken `./vendor-chunks/motion-dom.js` require for server bundles.
	transpilePackages: ['framer-motion', 'motion-dom', 'motion-utils'],
	// mysql2 is only used server-side (best-effort active-theme lookup); keep it
	// out of the client bundle and let API routes require it at runtime.
	experimental: {
		serverComponentsExternalPackages: ['mysql2', 'basic-ftp', 'ssh2-sftp-client', 'ssh2', 'youtube-transcript', 'nodemailer'],
	},
	webpack: (config, { isServer }) => {
		// Suppress noisy webpack.cache.PackFileCacheStrategy / FileSystemInfo
		// warnings (e.g. from next-intl's dynamic imports) that clutter the
		// `npm run dev` console but don't indicate real build errors.
		config.infrastructureLogging = {
			level: 'error',
		};

		// Defense-in-depth: if a server-only module (fs, net, tls, child_process)
		// is ever accidentally pulled into the client bundle via a 'use client'
		// import chain, fail soft instead of crashing the whole build with
		// "UnhandledSchemeError" on bare or `node:`-prefixed specifiers.
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				'node:fs': false,
				'node:fs/promises': false,
				path: false,
				'node:path': false,
				net: false,
				'node:net': false,
				tls: false,
				'node:tls': false,
				child_process: false,
				'node:child_process': false,
			};
		}

		return config;
	},
};

export default withNextIntl(nextConfig);
