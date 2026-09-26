import type { SchemaJsonLdConfig } from '@/lib/schema/jsonld';

export const REDUE_SITE_ORIGIN = 'https://reduegeo.com';

/** Canonical homepage. Matches `og:url`. */
export const REDUE_SITE_CANONICAL = `${REDUE_SITE_ORIGIN}/`;

export const REDUE_OG_IMAGE_PATH = '/images/og-image.png';
export const REDUE_OG_IMAGE_WIDTH = 1200;
export const REDUE_OG_IMAGE_HEIGHT = 630;
export const REDUE_OG_IMAGE_ALT = 'RedueGEO — AI가 인용하는 검색 최적화 스튜디오';

/** 80–140자. 검색 스니펫과 AI 인용 문장에 같이 씁니다. */
export const REDUE_META_DESCRIPTION_KO =
	'RedueGEO는 ChatGPT·Perplexity·Gemini가 기업 사이트를 출처로 인용하도록 GEO, SEO, 스키마, E-E-A-T를 진단하고 정비하는 AI 검색 최적화 스튜디오입니다.';

export const REDUE_META_DESCRIPTION_EN =
	'RedueGEO diagnoses and repairs GEO, SEO, schema, and E-E-A-T so ChatGPT, Perplexity, and Gemini cite your website as a source.';

export const REDUE_META_TITLE = 'RedueGEO | AI 검색 최적화(GEO) & SEO 스튜디오';

/**
 * 프로젝트에서 확인되지 않은 사업자 정보.
 * 값이 비어 있으면 JSON-LD에서 해당 속성을 생략합니다. 더미 번호·가명(홍길동)은 넣지 않습니다.
 */
// TODO: 실제 정보 입력 필요
export const REDUE_BUSINESS_NAP = {
	/** TODO: 실제 정보 입력 필요 — 대표 전화번호 */
	telephone: '',
	/** TODO: 실제 정보 입력 필요 — 대표 이메일 */
	email: '',
	/** TODO: 실제 정보 입력 필요 — 도로명 주소 */
	streetAddress: '',
	/** TODO: 실제 정보 입력 필요 — 시·군·구 */
	addressLocality: '',
	/** TODO: 실제 정보 입력 필요 — 시·도 */
	addressRegion: '',
	/** TODO: 실제 정보 입력 필요 — 우편번호 */
	postalCode: '',
};

/**
 * 대표자 Person 노드. `name`이 비어 있거나 직함뿐이면 Person / author 연결을 만들지 않습니다.
 */
// TODO: 실제 정보 입력 필요
export const REDUE_FOUNDER = {
	/** TODO: 실제 정보 입력 필요 — 대표자 실명 */
	name: '',
	/** TODO: 실제 정보 입력 필요 — 예: 대표 */
	jobTitle: '',
	/** TODO: 실제 정보 입력 필요 — 전문성 소개 (경력·전문 분야) */
	description: '',
	/** TODO: 실제 정보 입력 필요 — 출신 학교·기관 */
	alumniOf: '',
	/** TODO: 실제 정보 입력 필요 — 대표자 프로필 URL */
	url: '',
	/** TODO: 실제 정보 입력 필요 — 링크드인 등 개인 공식 프로필 */
	sameAs: [] as string[],
	knowsAbout: ['GEO', '테크니컬 SEO', 'Schema.org', 'E-E-A-T'],
};

/**
 * Organization.sameAs. 빈 문자열은 스키마에서 제거됩니다.
 */
// TODO: 실제 정보 입력 필요
export const REDUE_OFFICIAL_CHANNELS = {
	instagram: 'https://www.instagram.com/redueai',
	youtube: 'https://www.youtube.com/@redueai',
	/** TODO: 실제 정보 입력 필요 */
	linkedin: '',
	/** TODO: 실제 정보 입력 필요 */
	facebook: '',
	/** TODO: 실제 정보 입력 필요 — 공식 블로그 */
	naverBlog: '',
	/** TODO: 실제 정보 입력 필요 */
	naverCafe: '',
	/** TODO: 실제 정보 입력 필요 — 네이버 플레이스 */
	naverPlace: '',
};

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
	name: 'RedueGEO',
	url: REDUE_SITE_ORIGIN,
	logo: `${REDUE_SITE_ORIGIN}${REDUE_OG_IMAGE_PATH}`,
	description: REDUE_META_DESCRIPTION_KO,
	orgTypes: ['Organization', 'LocalBusiness'],
	inLanguage: 'ko-KR',
	pageUrl: REDUE_SITE_CANONICAL,
	pageName: 'RedueGEO',
	pageType: 'WebPage',
	telephone: REDUE_BUSINESS_NAP.telephone,
	email: REDUE_BUSINESS_NAP.email,
	contactUrl: `${REDUE_SITE_ORIGIN}/contact`,
	address: {
		streetAddress: REDUE_BUSINESS_NAP.streetAddress,
		addressLocality: REDUE_BUSINESS_NAP.addressLocality,
		addressRegion: REDUE_BUSINESS_NAP.addressRegion,
		postalCode: REDUE_BUSINESS_NAP.postalCode,
		addressCountry: 'KR',
	},
	searchUrlTemplate: `${REDUE_SITE_ORIGIN}/prompts?q={search_term_string}`,
	breadcrumbs: [{ name: '홈', url: REDUE_SITE_CANONICAL }],
	channels: {
		instagram: REDUE_OFFICIAL_CHANNELS.instagram,
		youtube: REDUE_OFFICIAL_CHANNELS.youtube,
		linkedin: REDUE_OFFICIAL_CHANNELS.linkedin,
		facebook: REDUE_OFFICIAL_CHANNELS.facebook,
		naverBlog: REDUE_OFFICIAL_CHANNELS.naverBlog,
		naverCafe: REDUE_OFFICIAL_CHANNELS.naverCafe,
		naverPlace: REDUE_OFFICIAL_CHANNELS.naverPlace,
	},
	founder: {
		name: REDUE_FOUNDER.name,
		jobTitle: REDUE_FOUNDER.jobTitle,
		description: REDUE_FOUNDER.description,
		alumniOf: REDUE_FOUNDER.alumniOf,
		url: REDUE_FOUNDER.url,
		sameAs: REDUE_FOUNDER.sameAs,
		knowsAbout: REDUE_FOUNDER.knowsAbout,
	},
	about: {
		name: 'RedueGEO 소개',
		url: `${REDUE_SITE_ORIGIN}/about`,
		description:
			'RedueGEO는 홈페이지를 다시 만들지 않고 GEO·SEO·스키마·E-E-A-T를 정비해, ChatGPT·Perplexity·Gemini가 기업을 공식 출처로 인용하도록 돕는 AI 검색 최적화 스튜디오입니다.',
	},
	faqs: [
		{
			question: '기존 홈페이지를 새로 만들어야 하나요?',
			answer:
				'아닙니다. 사이트 재구축 없이 기존 홈페이지를 유지한 채 적용됩니다. 헤더에 REDUE 스키마 엔진을 주입하고 루트에 /llms.txt를 배포하므로 디자인과 기존 기능은 그대로입니다.',
		},
		{
			question: '작업 후 바로 ChatGPT나 Perplexity에 반영되나요?',
			answer:
				'AI 크롤러 수집 주기에 따라 통상 3~7영업일 안에 순차 반영되며, /llms.txt 배포로 인덱싱 속도를 높입니다.',
		},
		{
			question: '그누보드, 워드프레스 등 어떤 홈페이지에도 적용 가능한가요?',
			answer:
				'그누보드, 워드프레스, 아임웹, 카페24, 쇼피파이와 커스텀 React·Vue·HTML 환경에 적용할 수 있습니다.',
		},
		{
			question: 'AI 검색 1위 추천이 보장되나요?',
			answer:
				'각 AI 엔진 가이드라인에 맞춘 스키마와 엔티티 신호를 구축하지만, 특정 순위를 영구 보증하지는 않습니다.',
		},
	],
};
