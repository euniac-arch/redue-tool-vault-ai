import nextEnv from '@next/env';
import path from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Repo-root `.env` (e.g. PAGESPEED_API_KEY) — studio/.env still wins on conflicts. */
loadEnvConfig(path.join(__dirname, '..'));

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
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
