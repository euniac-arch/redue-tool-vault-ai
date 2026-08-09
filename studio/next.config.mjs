import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// mysql2 is only used server-side (best-effort active-theme lookup); keep it
	// out of the client bundle and let API routes require it at runtime.
	experimental: {
		serverComponentsExternalPackages: ['mysql2'],
	},
};

export default withNextIntl(nextConfig);
