import type { SchemaJsonLdConfig } from '@/lib/schema/jsonld';

export const REDUE_SITE_ORIGIN = 'https://redue-tool-vault-ai.vercel.app';

/**
 * Runtime config for this Next.js app.
 * Empty channel / founder slots are filtered out — never invent 홍길동 or dummy URLs.
 *
 * Customer-site example (clinic):
 *
 * ```ts
 * const clinicSchema: SchemaJsonLdConfig = {
 *   name: '서초내과의원',
 *   url: 'https://clinic.example.com',
 *   logo: 'https://clinic.example.com/logo.png',
 *   description: '서초 소재 내과 의원',
 *   telephone: '02-555-1212',
 *   address: {
 *     streetAddress: '서울 서초구 서초대로 10',
 *     addressLocality: '서초구',
 *     addressRegion: '서울특별시',
 *   },
 *   channels: {
 *     naverBlog: 'https://blog.naver.com/seocho',
 *     naverCafe: 'https://cafe.naver.com/seocho',
 *     naverPlace: 'https://map.naver.com/p/entry/place/123',
 *     instagram: 'https://www.instagram.com/seocho',
 *     youtube: 'https://www.youtube.com/@seocho',
 *     facebook: '',
 *   },
 *   founder: {
 *     name: '김원장',
 *     jobTitle: '대표원장',
 *     sameAs: ['https://www.linkedin.com/in/example'],
 *     alumniOf: '서울대학교 의과대학',
 *     knowsAbout: ['내과', '건강검진'],
 *   },
 * };
 * ```
 */
export const REDUE_SITE_SCHEMA: SchemaJsonLdConfig = {
	name: 'REDUE AI SEO & GEO Studio',
	url: REDUE_SITE_ORIGIN,
	logo: `${REDUE_SITE_ORIGIN}/web/upload/logo.png`,
	description: 'AI 기반 SEO & GEO 자동 주입',
	orgTypes: ['Organization', 'ProfessionalService'],
	inLanguage: 'ko-KR',
	channels: {
		naverBlog: '',
		naverCafe: '',
		naverPlace: '',
		instagram: '',
		youtube: '',
		facebook: '',
	},
	founder: {
		name: '',
		jobTitle: '',
		sameAs: [],
	},
};
