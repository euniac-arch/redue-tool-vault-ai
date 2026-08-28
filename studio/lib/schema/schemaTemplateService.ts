/**
 * CMS별 스키마 주입 템플릿 생성기.
 * 관리자 `/admin/schema-library` 워크벤치가 입력값에 따라 실시간 코드를 렌더링한다.
 */

import { isValidSchemaUrl } from '@/lib/schema/jsonld';
import { generateRssFeedCode, RSS_PHP_INSTALL_GUIDE, RSS_PHP_RELATIVE_PATH } from '@/lib/solve/rss-php-engine';

export type SchemaCmsPlatform = 'gnuboard' | 'wordpress' | 'rhymix' | 'html';

export type SchemaBusinessType = 'MedicalBusiness' | 'Physician' | 'LocalBusiness';

export type SchemaSameAsItem = {
	id: string;
	label: string;
	url: string;
};

export type SchemaTemplateParams = {
	businessName: string;
	businessType: SchemaBusinessType;
	representativeName: string;
	siteUrl: string;
	telephone: string;
	streetAddress: string;
	openingHours: string;
	sameAs: SchemaSameAsItem[];
	services: string[];
};

export type SchemaTemplateResult = {
	cms: SchemaCmsPlatform;
	language: 'php' | 'html';
	filename: string;
	code: string;
	jsonLd: Record<string, unknown>;
	scriptTag: string;
	guide: SchemaInstallGuide;
	rssFilename: string;
	rssCode: string;
	rssGuide: SchemaInstallGuide;
};

export type SchemaInstallGuide = {
	title: string;
	path: string;
	steps: string[];
};

export const SCHEMA_CMS_TABS: ReadonlyArray<{
	id: SchemaCmsPlatform;
	label: string;
	shortLabel: string;
	language: 'php' | 'html';
	filename: string;
}> = [
	{ id: 'gnuboard', label: '그누보드 5 (Gnuboard)', shortLabel: '그누보드 5', language: 'php', filename: 'redue.schema.php' },
	{ id: 'wordpress', label: '워드프레스 (WordPress)', shortLabel: '워드프레스', language: 'php', filename: 'redue-schema.php' },
	{ id: 'rhymix', label: '라이믹스 (Rhymix)', shortLabel: '라이믹스', language: 'php', filename: 'redue_schema.addon.php' },
	{ id: 'html', label: '표준 HTML/SPA', shortLabel: 'HTML/SPA', language: 'html', filename: 'redue-schema.html' },
];

export const SCHEMA_BUSINESS_TYPES: ReadonlyArray<{
	value: SchemaBusinessType;
	label: string;
	hint: string;
}> = [
	{ value: 'MedicalBusiness', label: 'MedicalBusiness', hint: '병·의원, 클리닉, 치과, 한의원' },
	{ value: 'Physician', label: 'Physician', hint: '의사 개인 + 진료 기관' },
	{ value: 'LocalBusiness', label: 'LocalBusiness', hint: '로컬 상점·서비스 사업장' },
];

export const EMPTY_SCHEMA_TEMPLATE_PARAMS: SchemaTemplateParams = {
	businessName: '',
	businessType: 'MedicalBusiness',
	representativeName: '',
	siteUrl: '',
	telephone: '',
	streetAddress: '',
	openingHours: '',
	sameAs: [
		{ id: 'blog', label: '공식 블로그', url: '' },
		{ id: 'instagram', label: '인스타그램', url: '' },
		{ id: 'naver-place', label: '네이버 플레이스', url: '' },
	],
	services: [],
};

/** 병의원 표준 샘플 — '기본 샘플 데이터 불러오기' */
export const SCHEMA_LIBRARY_SAMPLE: SchemaTemplateParams = {
	businessName: '서초피부과의원',
	businessType: 'MedicalBusiness',
	representativeName: '김민준',
	siteUrl: 'https://www.seochoskin.co.kr',
	telephone: '02-555-1212',
	streetAddress: '서울특별시 서초구 강남대로 123, 5층',
	openingHours: 'Mo-Fr 09:30-18:30, Sa 09:30-14:00',
	sameAs: [
		{ id: 'blog', label: '공식 블로그', url: 'https://blog.naver.com/seochoskin' },
		{ id: 'instagram', label: '인스타그램', url: 'https://www.instagram.com/seochoskin' },
		{ id: 'naver-place', label: '네이버 플레이스', url: 'https://map.naver.com/p/entry/place/1234567890' },
	],
	services: ['덴서티 리프팅', '피부 안티에이징'],
};

export const GOOGLE_RICH_RESULTS_TEST_URL = 'https://search.google.com/test/rich-results';

const KR_REGION_RE =
	/^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)\s+(.+)$/;

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function createId(prefix: string): string {
	return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createSameAsItem(label = '추가 채널', url = ''): SchemaSameAsItem {
	return { id: createId('sameas'), label, url };
}

export function cloneSchemaTemplateParams(params: SchemaTemplateParams): SchemaTemplateParams {
	return {
		...params,
		sameAs: params.sameAs.map((item) => ({ ...item })),
		services: [...params.services],
	};
}

export function getCmsTab(cms: SchemaCmsPlatform) {
	return SCHEMA_CMS_TABS.find((tab) => tab.id === cms) ?? SCHEMA_CMS_TABS[0];
}

export function buildGoogleRichResultsUrl(siteUrl?: string): string {
	const url = compact(siteUrl);
	if (!isValidSchemaUrl(url)) return GOOGLE_RICH_RESULTS_TEST_URL;
	return `${GOOGLE_RICH_RESULTS_TEST_URL}?url=${encodeURIComponent(url)}`;
}

function normalizeOrigin(raw: string): string {
	const url = compact(raw);
	if (!isValidSchemaUrl(url)) return '';
	try {
		return new URL(url).origin.replace(/\/+$/, '');
	} catch {
		return url.replace(/\/+$/, '');
	}
}

function collectSameAs(items: SchemaSameAsItem[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of items) {
		const url = compact(item.url);
		if (!isValidSchemaUrl(url) || seen.has(url)) continue;
		seen.add(url);
		out.push(url);
	}
	return out;
}

function parseOpeningHours(raw: string): string[] {
	return compact(raw)
		.split(/[,;\n]+/)
		.map((part) => part.trim())
		.filter(Boolean);
}

function parseKoreanAddress(raw: string): {
	streetAddress: string;
	addressLocality?: string;
	addressRegion?: string;
	addressCountry: string;
} {
	const streetAddress = compact(raw);
	if (!streetAddress) {
		return { streetAddress: '', addressCountry: 'KR' };
	}

	const regionMatch = streetAddress.match(KR_REGION_RE);
	if (!regionMatch) {
		return { streetAddress, addressCountry: 'KR' };
	}

	const addressRegion = regionMatch[1];
	const rest = compact(regionMatch[2]);
	const localityMatch = rest.match(/^(\S+(?:구|시|군))\s+(.+)$/);
	if (!localityMatch) {
		return { streetAddress, addressRegion, addressCountry: 'KR' };
	}

	return {
		streetAddress,
		addressRegion,
		addressLocality: localityMatch[1],
		addressCountry: 'KR',
	};
}

function serviceOffers(services: string[]): Array<Record<string, unknown>> {
	return services
		.map((name) => compact(name))
		.filter(Boolean)
		.map((name) => ({
			'@type': 'Offer',
			itemOffered: {
				'@type': 'Service',
				name,
			},
		}));
}

function omitEmpty<T extends Record<string, unknown>>(node: T): T {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(node)) {
		if (value == null) continue;
		if (typeof value === 'string' && !value.trim()) continue;
		if (Array.isArray(value) && value.length === 0) continue;
		if (typeof value === 'object' && !Array.isArray(value)) {
			const nested = omitEmpty(value as Record<string, unknown>);
			if (Object.keys(nested).length === 0) continue;
			out[key] = nested;
			continue;
		}
		out[key] = value;
	}
	return out as T;
}

/** JSON-LD script 내부에 `</script>`가 깨지지 않도록 `<`를 이스케이프한다. */
export function stringifyJsonLd(jsonLd: unknown): string {
	return JSON.stringify(jsonLd, null, 2).replace(/</g, '\\u003c');
}

export function formatSchemaScriptTag(jsonLd: unknown): string {
	return `<script type="application/ld+json">\n${stringifyJsonLd(jsonLd)}\n</script>`;
}

/**
 * 폼 입력으로 Schema.org `@graph`를 구성한다.
 * Physician은 대표자 Person을 주체로, 상호가 있으면 MedicalBusiness를 worksFor로 연결한다.
 */
export function buildLibraryJsonLd(params: SchemaTemplateParams): Record<string, unknown> {
	const businessName = compact(params.businessName) || '상호명을 입력하세요';
	const representativeName = compact(params.representativeName);
	const origin = normalizeOrigin(params.siteUrl) || 'https://example.com';
	const pageUrl = `${origin}/`;
	const orgId = `${origin}/#organization`;
	const personId = `${origin}/#physician`;
	const sameAs = collectSameAs(params.sameAs);
	const hours = parseOpeningHours(params.openingHours);
	const address = parseKoreanAddress(params.streetAddress);
	const offers = serviceOffers(params.services);
	const knowsAbout = params.services.map(compact).filter(Boolean);
	const telephone = compact(params.telephone);

	const postalAddress = omitEmpty({
		'@type': 'PostalAddress',
		streetAddress: address.streetAddress,
		addressLocality: address.addressLocality || '',
		addressRegion: address.addressRegion || '',
		addressCountry: address.addressCountry,
	});

	const orgNode = omitEmpty({
		'@type': params.businessType === 'Physician' ? 'MedicalBusiness' : params.businessType,
		'@id': orgId,
		name: businessName,
		url: pageUrl,
		telephone,
		address: address.streetAddress ? postalAddress : undefined,
		openingHours: hours.length === 1 ? hours[0] : hours,
		sameAs,
		knowsAbout,
		makesOffer: offers,
		founder: representativeName ? { '@id': personId } : undefined,
		employee: representativeName && params.businessType !== 'Physician' ? { '@id': personId } : undefined,
	});

	const personNode = representativeName
		? omitEmpty({
				'@type': 'Physician',
				'@id': personId,
				name: representativeName,
				jobTitle: params.businessType === 'LocalBusiness' ? '대표' : '대표원장',
				worksFor: { '@id': orgId },
				url: pageUrl,
				telephone,
				knowsAbout,
			})
		: null;

	const graph: Array<Record<string, unknown>> = [];

	if (params.businessType === 'Physician') {
		if (personNode) {
			graph.push(
				omitEmpty({
					...personNode,
					'@type': 'Physician',
					address: address.streetAddress ? postalAddress : undefined,
					openingHours: hours.length === 1 ? hours[0] : hours,
					sameAs,
					makesOffer: offers,
				}),
			);
			graph.push(orgNode);
		} else {
			graph.push(
				omitEmpty({
					...orgNode,
					'@type': 'Physician',
				}),
			);
		}
	} else {
		graph.push(orgNode);
		if (personNode) graph.push(personNode);
	}

	graph.push(
		omitEmpty({
			'@type': 'WebSite',
			'@id': `${origin}/#website`,
			name: businessName,
			url: pageUrl,
			inLanguage: 'ko-KR',
			publisher: { '@id': orgId },
		}),
	);

	return {
		'@context': 'https://schema.org',
		'@graph': graph,
	};
}

function phpFileBanner(title: string, saveAs: string): string {
	return `<?php
/**
 * REDUE Schema Injector — ${title}
 * Generated by /admin/schema-library
 * Save as: ${saveAs}
 */`;
}

function phpEchoScriptFromNowdoc(jsonLd: Record<string, unknown>): string {
	const json = stringifyJsonLd(jsonLd);
	return `$redue_schema_json = <<<'REDUE_JSONLD'
${json}
REDUE_JSONLD;
    echo '<script type="application/ld+json">' . "\\n" . $redue_schema_json . "\\n</script>\\n";`;
}

export function buildGnuboardSchemaTemplate(jsonLd: Record<string, unknown>): string {
	const echoBlock = phpEchoScriptFromNowdoc(jsonLd);
	return `${phpFileBanner('Gnuboard 5', 'extend/redue.schema.php')}
if (!defined('_GNUBOARD_')) exit;
if (defined('G5_IS_ADMIN') && G5_IS_ADMIN) return;
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') return;

if (!function_exists('redue_inject_schema')) {
    function redue_inject_schema() {
        ${echoBlock}
    }
}

if (function_exists('add_event')) {
    add_event('tail_sub', 'redue_inject_schema');
} else {
    // add_event 미지원 테마: head.sub.php / tail.sub.php 에서 직접 호출
    redue_inject_schema();
}
`;
}

export function buildWordpressSchemaTemplate(jsonLd: Record<string, unknown>): string {
	const echoBlock = phpEchoScriptFromNowdoc(jsonLd);
	return `${phpFileBanner('WordPress', '테마 functions.php 하단 또는 wp-content/mu-plugins/redue-schema.php')}
if (!defined('ABSPATH')) exit;

if (!function_exists('redue_inject_schema')) {
    function redue_inject_schema() {
        ${echoBlock}
    }
}

add_action('wp_head', 'redue_inject_schema');
`;
}

export function buildRhymixSchemaTemplate(jsonLd: Record<string, unknown>): string {
	const script = formatSchemaScriptTag(jsonLd);
	return `${phpFileBanner('Rhymix / XE', 'addons/redue_schema/redue_schema.addon.php 또는 레이아웃 header')}
if (!defined('__XE__') && !defined('RX_VERSION')) {
    return;
}

$redue_schema_html = <<<'REDUE_JSONLD'
${script}
REDUE_JSONLD;

if (class_exists('Context') && method_exists('Context', 'addHtmlHeader')) {
    if (!method_exists('Context', 'getResponseMethod') || Context::getResponseMethod() === 'HTML') {
        Context::addHtmlHeader($redue_schema_html);
    }
}
`;
}

export function buildHtmlSchemaTemplate(jsonLd: Record<string, unknown>): string {
	return `<!-- REDUE Schema Injector — 표준 HTML / SPA
     <head> 하단 또는 </body> 직전에 붙여넣으세요. -->
${formatSchemaScriptTag(jsonLd)}
`;
}

export const SCHEMA_INSTALL_GUIDES: Record<SchemaCmsPlatform, SchemaInstallGuide> = {
	gnuboard: {
		title: '그누보드 5 적용 가이드',
		path: '루트/extend/redue.schema.php',
		steps: [
			'루트/extend/redue.schema.php 로 저장하여 업로드하세요.',
			'그누보드는 /extend/*.php 를 common.php에서 자동 로드합니다. 별도 include는 필요 없습니다.',
			'add_event(\'tail_sub\') 훅이 없는 구버전이면 theme/basic/head.sub.php 또는 tail.sub.php 하단에 동일 함수를 호출하세요.',
			'적용 후 프론트 페이지 소스에서 application/ld+json 이 출력되는지 확인하세요.',
		],
	},
	wordpress: {
		title: '워드프레스 적용 가이드',
		path: '테마 functions.php',
		steps: [
			'테마 functions.php 하단에 붙여넣으세요.',
			'자식 테마를 쓰면 자식 테마 functions.php에 넣어야 테마 업데이트 후에도 유지됩니다.',
			'권장: wp-content/mu-plugins/redue-schema.php 로 저장하면 테마 교체와 무관하게 wp_head에 주입됩니다.',
			'캐시 플러그인을 쓰는 경우 저장 후 캐시를 비우고 페이지 소스를 확인하세요.',
		],
	},
	rhymix: {
		title: '라이믹스 적용 가이드',
		path: 'addons/redue_schema/redue_schema.addon.php',
		steps: [
			'addons/redue_schema/redue_schema.addon.php 로 저장한 뒤 애드온을 활성화하세요.',
			'애드온 사용이 어려우면 레이아웃 layout.html / header.php 의 </head> 직전에 Context::addHtmlHeader 블록을 붙여넣으세요.',
			'레이아웃만 수정할 때는 생성된 <script type="application/ld+json"> 블록만 직접 삽입해도 됩니다.',
			'적용 후 HTML 소스와 리치 결과 테스트로 JSON-LD 노출을 확인하세요.',
		],
	},
	html: {
		title: '표준 HTML / SPA 적용 가이드',
		path: 'index.html <head>',
		steps: [
			'생성된 <script type="application/ld+json"> 블록을 index.html 또는 공통 레이아웃의 <head> 하단에 붙여넣으세요.',
			'React/Next/Vite SPA는 public/index.html 또는 루트 레이아웃 컴포넌트에 동일 태그를 넣습니다.',
			'CSR 전용 앱은 초기 HTML에 스키마가 있어야 크롤러가 읽습니다. 클라이언트 only 주입은 피하세요.',
			'배포 후 Google 리치 검색결과 테스트로 유효성을 확인하세요.',
		],
	},
};

export function generateSchemaTemplate(
	cms: SchemaCmsPlatform,
	params: SchemaTemplateParams,
): SchemaTemplateResult {
	const tab = getCmsTab(cms);
	const jsonLd = buildLibraryJsonLd(params);
	const scriptTag = formatSchemaScriptTag(jsonLd);

	let code = '';
	switch (cms) {
		case 'gnuboard':
			code = buildGnuboardSchemaTemplate(jsonLd);
			break;
		case 'wordpress':
			code = buildWordpressSchemaTemplate(jsonLd);
			break;
		case 'rhymix':
			code = buildRhymixSchemaTemplate(jsonLd);
			break;
		default:
			code = buildHtmlSchemaTemplate(jsonLd);
			break;
	}

	return {
		cms,
		language: tab.language,
		filename: tab.filename,
		code,
		jsonLd,
		scriptTag,
		guide: SCHEMA_INSTALL_GUIDES[cms],
		rssFilename: RSS_PHP_RELATIVE_PATH,
		rssCode: generateRssFeedCode({
			siteName: params.businessName,
			siteUrl: params.siteUrl,
			description: params.services.filter(Boolean).join(', ') || params.businessName,
			telephone: params.telephone,
			address: params.streetAddress,
		}),
		rssGuide: {
			title: RSS_PHP_INSTALL_GUIDE.title,
			path: RSS_PHP_INSTALL_GUIDE.path,
			steps: [...RSS_PHP_INSTALL_GUIDE.steps],
		},
	};
}
