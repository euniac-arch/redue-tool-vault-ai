import type { MetadataRoute } from 'next';
import { REDUE_SITE_ORIGIN } from '@/lib/schema';

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: '*',
			allow: '/',
			disallow: ['/admin', '/api/'],
		},
		sitemap: `${REDUE_SITE_ORIGIN}/sitemap.xml`,
		host: REDUE_SITE_ORIGIN,
	};
}
