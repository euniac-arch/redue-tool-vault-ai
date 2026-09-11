import type { MetadataRoute } from 'next';
import { REDUE_SITE_ORIGIN } from '@/lib/schema';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: ['/admin', '/api/'],
			},
			// AI crawlers — explicitly allowed so REDUE can be cited/recommended by
			// generative AI search engines (ChatGPT, Perplexity, Claude, Gemini).
			{ userAgent: 'GPTBot', allow: '/' },
			{ userAgent: 'ChatGPT-User', allow: '/' },
			{ userAgent: 'PerplexityBot', allow: '/' },
			{ userAgent: 'ClaudeBot', allow: '/' },
			{ userAgent: 'Google-Extended', allow: '/' },
		],
		sitemap: `${REDUE_SITE_ORIGIN}/sitemap.xml`,
		host: REDUE_SITE_ORIGIN,
	};
}
