/**
 * WordPress Schema Injector Engine — generator for
 * `wp-content/mu-plugins/redue-schema.php` (preferred) or the active theme
 * `functions.php` marker block.
 *
 * Runtime uses WordPress core hooks (`wp_head`) and condition tags, scans
 * child/parent `footer.php` for NAP when globals are empty, and emits one
 * JSON-LD `@graph` (Organization · WebSite · WebPage · Person · BreadcrumbList).
 * Empty keys are omitted (No-Fake-Data).
 */

import { classifyIndustrySchema, isMedicalIndustryBucket } from '@/lib/solve/core/industry-schema';
import {
	buildServiceCatalogSlotPhp,
	phpServiceCatalogLiteral,
	SERVICE_CATALOG_NAME,
	type ServiceCatalogItem,
	type NormalizedServiceNode,
} from '@/lib/solve/core/service-catalog';
import { bindTelephone } from '@/lib/solve/core/telephone';
import { filterOfficialSameAs } from '@/lib/audit/extractors/schema-entity-pack';
import { sanitizeGeneratedPhpSnippet } from '@/lib/solve/php-sanitize';

export const REDUE_WP_SCHEMA_ENGINE_VERSION = '1.2.0';

/** 사업자등록번호 (taxID) — labeled `000-00-00000`. */
export const WP_FOOTER_TAX_ID_RE =
	/(?:사업자\s*(?:등록)?\s*번호|사업자번호|등록번호)\s*[:：]?\s*([0-9]{3}-[0-9]{2}-[0-9]{5})/u;

/** 팩스번호 (faxNumber). */
export const WP_FOOTER_FAX_RE = /(?:팩스|FAX|Fax|F\.)\s*[:：]?\s*([0-9]{2,4}-[0-9]{3,4}-[0-9]{4})/u;

/** 대표자명 (Person name) — Korean 2–4 syllables. */
export const WP_FOOTER_REP_NAME_RE =
	/(?:대표자|대표원장|원장|대표이사|대표)\s*[:：]?\s*([가-힣]{2,4})(?=\s|<|$|\||\/)/u;

/** 대표전화 (telephone). */
export const WP_FOOTER_TELEPHONE_RE =
	/(?:대표전화|전화번호|고객센터|TEL|Tel|T\.)\s*[:：]?\s*([0-9]{2,4}-[0-9]{3,4}-[0-9]{4}|1[568]\d{2}-\d{4})/u;

/** 도로명주소 (streetAddress). */
export const WP_FOOTER_STREET_RE =
	/(?:주소|위치|소재지)?\s*[:：]?\s*([가-힣]+(?:특별시|광역시|도|시|군|구)\s+[가-힣0-9\s·\-\(\),]+(?:로|길|동|리|가|번지|호|층|관|빌딩|호텔)[가-힣0-9\s·\-\(\),]*)/u;

export const WP_REP_NAME_STOPWORDS = [
	'인사말',
	'안내',
	'고객센터',
	'오시는길',
	'바로가기',
	'더보기',
	'자세히보기',
	'이사회',
	'이사',
	'제품으로',
	'제품',
	'대표',
	'문의',
	'상담',
	'진료',
	'정보',
] as const;

export const WP_MEDICAL_ORG_TYPES = [
	'MedicalClinic',
	'Physician',
	'Hospital',
	'Dentist',
	'VeterinaryCare',
	'Pharmacy',
	'MedicalBusiness',
] as const;

export type WordpressSchemaEngineMode = 'mu-plugin' | 'functions-block';

export type WordpressServiceSeed = string | ServiceCatalogItem;

export type WordpressSchemaEngineInput = {
	mode?: WordpressSchemaEngineMode;
	siteName?: string;
	targetUrl?: string;
	industryType?: string | null;
	repName?: string;
	repTitle?: string;
	telephone?: string;
	fax?: string;
	streetAddress?: string;
	taxId?: string;
	logo?: string;
	lat?: string;
	lng?: string;
	legalName?: string;
	sameAs?: string[];
	services?: WordpressServiceSeed[];
	orgTypes?: string[];
	hoursOpens?: string;
	hoursCloses?: string;
};

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function phpSingleQuoted(value: string): string {
	return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function phpStringArray(values: readonly string[]): string {
	if (!values.length) return 'array()';
	return `array(${values.map((v) => phpSingleQuoted(v)).join(', ')})`;
}

function toGlobalRegex(re: RegExp): RegExp {
	return new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
}

/** PHP has no regex literals — emit a single-quoted pattern string for preg_*. */
function toPhpRegexLiteral(re: RegExp): string {
	const body = `/${re.source}/${re.flags}`;
	return `'${body.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function extractWpFooterTaxId(text: string): string {
	const m = WP_FOOTER_TAX_ID_RE.exec(String(text || ''));
	return m ? compact(m[1]) : '';
}

export function extractWpFooterFax(text: string): string {
	const m = WP_FOOTER_FAX_RE.exec(String(text || ''));
	return m ? compact(m[1]) : '';
}

export function extractWpFooterTelephone(text: string): string {
	const m = WP_FOOTER_TELEPHONE_RE.exec(String(text || ''));
	return m ? compact(m[1]) : '';
}

export function extractWpFooterStreetAddress(text: string): string {
	const m = WP_FOOTER_STREET_RE.exec(String(text || ''));
	if (!m) return '';
	return compact(m[1]).replace(/^(?:주소|위치|소재지)\s*[:：]?\s*/u, '');
}

export function extractWpFooterRepName(text: string): string {
	const src = String(text || '');
	const re = toGlobalRegex(WP_FOOTER_REP_NAME_RE);
	let match: RegExpExecArray | null;
	while ((match = re.exec(src))) {
		const candidate = compact(match[1]);
		if (candidate && !(WP_REP_NAME_STOPWORDS as readonly string[]).includes(candidate)) {
			return candidate;
		}
		if (match[0].length === 0) re.lastIndex += 1;
	}
	return '';
}

function unescapePhpSingle(raw: string): string {
	return raw.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
}

function readPhpValue(source: string, start: number): { value: string; end: number } | null {
	let i = start;
	while (i < source.length && /[ \t\r\n]/.test(source[i] || '')) i += 1;
	if (i >= source.length) return null;
	const ch = source[i];
	if (ch === "'" || ch === '"') {
		const quote = ch;
		let out = source[i] || '';
		i += 1;
		while (i < source.length) {
			const c = source[i] || '';
			out += c;
			if (c === '\\') {
				i += 1;
				if (i < source.length) out += source[i];
				i += 1;
				continue;
			}
			if (c === quote) {
				return { value: out, end: i + 1 };
			}
			i += 1;
		}
		return null;
	}
	if (/[a-zA-Z_]/.test(ch || '') || ch === '(') {
		const isArray = source.slice(i, i + 5).toLowerCase() === 'array';
		if (!isArray && ch !== '(') {
			const m = source.slice(i).match(/^(true|false|null|-?\d+(?:\.\d+)?)/i);
			if (!m) return null;
			return { value: m[1] || '', end: i + (m[1] || '').length };
		}
		const open = source.indexOf('(', i);
		if (open < 0) return null;
		let depth = 0;
		let inStr: "'" | '"' | null = null;
		for (let j = open; j < source.length; j++) {
			const c = source[j] || '';
			if (inStr) {
				if (c === '\\') {
					j += 1;
					continue;
				}
				if (c === inStr) inStr = null;
				continue;
			}
			if (c === "'" || c === '"') {
				inStr = c;
				continue;
			}
			if (c === '(') depth += 1;
			else if (c === ')') {
				depth -= 1;
				if (depth === 0) return { value: source.slice(i, j + 1).trim(), end: j + 1 };
			}
		}
	}
	return null;
}

function extractPhpGlobalRaw(source: string, key: string): string {
	const re = new RegExp(`\\$GLOBALS\\s*\\[\\s*['"]${key}['"]\\s*\\]\\s*=\\s*`, 'i');
	const m = re.exec(source);
	if (!m || m.index == null) return '';
	const parsed = readPhpValue(source, m.index + m[0].length);
	return parsed ? parsed.value.trim() : '';
}

function extractPhpGlobalString(source: string, key: string): string {
	const raw = extractPhpGlobalRaw(source, key);
	const m = raw.match(/^'(.*)'$/s) || raw.match(/^"(.*)"$/s);
	if (!m) return '';
	return unescapePhpSingle(m[1] || '');
}

function extractPhpStringList(raw: string): string[] {
	const out: string[] = [];
	const re = /'((?:\\.|[^'])*)'/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(raw))) {
		const v = compact(unescapePhpSingle(m[1] || ''));
		if (v) out.push(v);
	}
	return out;
}

function phpArrayLooksEmpty(raw: string): boolean {
	return !raw || /^array\s*\(\s*\)$/i.test(raw);
}

/**
 * Pull baked `$GLOBALS['redue_*']` seeds from a universal / GnuBoard core
 * snippet so the WordPress engine keeps audit NAP without shipping G5 runtime.
 */
export function extractWordpressSeedsFromCorePhp(php: string): WordpressSchemaEngineInput {
	const src = String(php || '');
	const orgRaw = extractPhpGlobalRaw(src, 'redue_org_type');
	const sameRaw = extractPhpGlobalRaw(src, 'redue_sameas');
	const catalogRaw = extractPhpGlobalRaw(src, 'redue_service_catalog');
	const svcRaw = extractPhpGlobalRaw(src, 'redue_services');
	const services: WordpressServiceSeed[] = [];
	const svcSource = catalogRaw && !phpArrayLooksEmpty(catalogRaw) ? catalogRaw : svcRaw;
	if (svcSource && !phpArrayLooksEmpty(svcSource)) {
		const nameRe = /'name'\s*=>\s*'((?:\\.|[^'])*)'/g;
		let m: RegExpExecArray | null;
		while ((m = nameRe.exec(svcSource))) {
			const name = compact(unescapePhpSingle(m[1] || ''));
			if (name) services.push({ name });
		}
	}
	return {
		repName: extractPhpGlobalString(src, 'redue_rep_name'),
		repTitle: extractPhpGlobalString(src, 'redue_rep_title'),
		telephone: extractPhpGlobalString(src, 'redue_tel'),
		fax: extractPhpGlobalString(src, 'redue_fax'),
		streetAddress: extractPhpGlobalString(src, 'redue_street'),
		taxId: extractPhpGlobalString(src, 'redue_tax_id'),
		logo: extractPhpGlobalString(src, 'redue_logo'),
		lat: extractPhpGlobalString(src, 'redue_lat'),
		lng: extractPhpGlobalString(src, 'redue_lng'),
		legalName: extractPhpGlobalString(src, 'redue_legal_name'),
		sameAs: sameRaw && !phpArrayLooksEmpty(sameRaw) ? extractPhpStringList(sameRaw) : [],
		orgTypes: orgRaw && !phpArrayLooksEmpty(orgRaw) ? extractPhpStringList(orgRaw) : [],
		services,
	};
}

function phpServicesLiteral(services: WordpressServiceSeed[], medical: boolean): string {
	const nodes: NormalizedServiceNode[] = [];
	for (const item of services) {
		if (typeof item === 'string') {
			const name = compact(item);
			if (!name) continue;
			nodes.push({ '@type': medical ? 'MedicalProcedure' : 'Service', name });
			continue;
		}
		const name = compact(item.name);
		if (!name) continue;
		const type: NormalizedServiceNode['@type'] =
			item.type === 'MedicalProcedure' || item.type === 'Service'
				? item.type
				: medical
					? 'MedicalProcedure'
					: 'Service';
		const node: NormalizedServiceNode = { '@type': type, name };
		if (compact(item.category)) node.category = compact(item.category);
		if (compact(item.description)) node.description = compact(item.description);
		if (compact(item.url)) node.url = compact(item.url);
		nodes.push(node);
	}
	if (!nodes.length) return 'array()';
	return phpServiceCatalogLiteral(nodes);
}

function resolveEngineSeeds(input: WordpressSchemaEngineInput) {
	const industry = classifyIndustrySchema({
		industryType: input.industryType,
		siteName: input.siteName,
	});
	const medical = isMedicalIndustryBucket(industry.bucket);
	const orgTypes =
		input.orgTypes && input.orgTypes.length > 0 ? input.orgTypes.filter(Boolean) : industry.orgTypes;
	const sameAs = filterOfficialSameAs(input.sameAs, input.targetUrl);
	return {
		mode: input.mode === 'functions-block' ? 'functions-block' : 'mu-plugin',
		repName: compact(input.repName),
		repTitle: compact(input.repTitle),
		telephone: bindTelephone(input.telephone || ''),
		fax: bindTelephone(input.fax || ''),
		street: compact(input.streetAddress),
		taxId: compact(input.taxId),
		logo: compact(input.logo),
		lat: compact(input.lat),
		lng: compact(input.lng),
		legalName: compact(input.legalName),
		orgTypes,
		medical,
		sameAs,
		servicesPhp: phpServicesLiteral(input.services || [], medical),
		catalogPhp: phpServiceCatalogLiteral(
			(input.services || [])
				.map((item): NormalizedServiceNode | null => {
					if (typeof item === 'string') {
						const name = compact(item);
						return name ? { '@type': medical ? 'MedicalProcedure' : 'Service', name } : null;
					}
					const name = compact(item.name);
					if (!name) return null;
					const type: NormalizedServiceNode['@type'] =
						item.type === 'MedicalProcedure' || item.type === 'Service'
							? item.type
							: medical
								? 'MedicalProcedure'
								: 'Service';
					const node: NormalizedServiceNode = { '@type': type, name };
					if (compact(item.category)) node.category = compact(item.category);
					if (compact(item.description)) node.description = compact(item.description);
					if (compact(item.url)) node.url = compact(item.url);
					return node;
				})
				.filter((n): n is NormalizedServiceNode => Boolean(n)),
		),
	};
}

/**
 * Complete WordPress MU-plugin / functions.php source.
 * Copy to `wp-content/mu-plugins/redue-schema.php` or insert the marker block
 * at the top of the active theme `functions.php`.
 */
export function buildWordpressSchemaEnginePhp(input: WordpressSchemaEngineInput = {}): string {
	const s = resolveEngineSeeds(input);
	const pluginHeader =
		s.mode === 'mu-plugin'
			? `/**
 * Plugin Name: REDUE Schema Injector
 * Description: Must-Use 스키마 자동주입 — wp_head 최상단 5-core JSON-LD. 테마 업데이트 시에도 유실되지 않습니다.
 * Version: ${REDUE_WP_SCHEMA_ENGINE_VERSION}
 * Author: REDUE AI Studio
 */

`
			: '';

	const php = `<?php
${pluginHeader}if ( ! defined( 'ABSPATH' ) ) {
	return;
}

/* REDUE_AI_STUDIO:START — WordPress Schema Injector Engine · mu-plugins/redue-schema.php · 조건 태그 · Footer Scanner · No-Fake-Data */

if ( ! defined( 'REDUE_WP_SCHEMA_ENGINE' ) ) {
	define( 'REDUE_WP_SCHEMA_ENGINE', '${REDUE_WP_SCHEMA_ENGINE_VERSION}' );
}

// Site-custom meta — 값이 있을 때만 JSON-LD 키 생성 (No-Fake-Data). 비어 있으면 코어 옵션/푸터 폴백.
$GLOBALS['redue_rep_name']  = ${phpSingleQuoted(s.repName)}; // 대표자명
$GLOBALS['redue_rep_title'] = ${phpSingleQuoted(s.repTitle)}; // 직함
$GLOBALS['redue_tel']       = ${phpSingleQuoted(s.telephone)}; // 전화번호
$GLOBALS['redue_fax']       = ${phpSingleQuoted(s.fax)}; // 팩스번호
$GLOBALS['redue_street']    = ${phpSingleQuoted(s.street)}; // 도로명주소
$GLOBALS['redue_tax_id']    = ${phpSingleQuoted(s.taxId)}; // 사업자번호
$GLOBALS['redue_lat']       = ${phpSingleQuoted(s.lat)}; // 위도
$GLOBALS['redue_lng']       = ${phpSingleQuoted(s.lng)}; // 경도
$GLOBALS['redue_logo']      = ${phpSingleQuoted(s.logo)}; // 로고 URL (실재할 때만)
$GLOBALS['redue_legal_name'] = ${phpSingleQuoted(s.legalName)};
$GLOBALS['redue_sameas']    = ${phpStringArray(s.sameAs)}; // SNS 및 지도 링크
${buildServiceCatalogSlotPhp(s.catalogPhp)}
$GLOBALS['redue_services']  = ${s.servicesPhp}; // 하위 호환 — catalog 비어 있을 때만 폴백
$GLOBALS['redue_org_type']  = ${phpStringArray(s.orgTypes)};
$GLOBALS['redue_is_medical'] = ${s.medical ? 'true' : 'false'};

if ( ! function_exists( 'redue_wp_jsonld_flags' ) ) {
	function redue_wp_jsonld_flags() {
		return JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT;
	}
}

if ( ! function_exists( 'redue_wp_trim' ) ) {
	function redue_wp_trim( $value ) {
		return is_string( $value ) ? trim( $value ) : '';
	}
}

if ( ! function_exists( 'redue_wp_omit_empty' ) ) {
	function redue_wp_omit_empty( &$node ) {
		if ( ! is_array( $node ) ) { return; }
		foreach ( array( 'taxID', 'faxNumber', 'telephone', 'legalName', 'alternateName', 'email', 'description', 'headline', 'datePublished', 'dateModified', 'image', 'jobTitle' ) as $_k ) {
			if ( ! isset( $node[ $_k ] ) ) { continue; }
			if ( ! is_string( $node[ $_k ] ) || trim( (string) $node[ $_k ] ) === '' ) {
				unset( $node[ $_k ] );
			}
		}
		foreach ( array( 'sameAs', 'availableService', 'knowsAbout', 'medicalSpecialty', 'openingHoursSpecification' ) as $_arr ) {
			if ( isset( $node[ $_arr ] ) && ( ! is_array( $node[ $_arr ] ) || count( $node[ $_arr ] ) === 0 ) ) {
				unset( $node[ $_arr ] );
			}
		}
		if ( isset( $node['hasOfferCatalog'] ) && ( ! is_array( $node['hasOfferCatalog'] ) || empty( $node['hasOfferCatalog']['itemListElement'] ) ) ) {
			unset( $node['hasOfferCatalog'] );
		}
		if ( isset( $node['geo'] ) && is_array( $node['geo'] ) ) {
			$_lat = isset( $node['geo']['latitude'] ) ? $node['geo']['latitude'] : '';
			$_lng = isset( $node['geo']['longitude'] ) ? $node['geo']['longitude'] : '';
			if ( $_lat === '' || $_lng === '' || ! is_numeric( $_lat ) || ! is_numeric( $_lng ) ) {
				unset( $node['geo'] );
			}
		}
		if ( isset( $node['address'] ) && is_array( $node['address'] ) && empty( $node['address']['streetAddress'] ) ) {
			unset( $node['address'] );
		}
		if ( isset( $node['logo'] ) && is_array( $node['logo'] ) && ( empty( $node['logo']['url'] ) || ! is_string( $node['logo']['url'] ) ) ) {
			unset( $node['logo'] );
		}
		if ( isset( $node['author'] ) && is_array( $node['author'] ) && empty( $node['author']['@id'] ) ) {
			unset( $node['author'] );
		}
	}
}

if ( ! function_exists( 'redue_wp_scan_footer_files' ) ) {
	/**
	 * WP Footer Scanner — child theme → parent theme → ABSPATH theme fallback.
	 */
	function redue_wp_scan_footer_files() {
		$paths = array();
		if ( function_exists( 'get_stylesheet_directory' ) ) {
			$paths[] = get_stylesheet_directory() . '/footer.php';
			$paths[] = get_stylesheet_directory() . '/header.php';
		}
		if ( function_exists( 'get_template_directory' ) ) {
			$paths[] = get_template_directory() . '/footer.php';
			$paths[] = get_template_directory() . '/header.php';
		}
		if ( defined( 'ABSPATH' ) && function_exists( 'get_template' ) ) {
			$paths[] = ABSPATH . 'wp-content/themes/' . get_template() . '/footer.php';
			$paths[] = ABSPATH . 'wp-content/themes/' . get_template() . '/header.php';
		}
		$text = '';
		$seen = array();
		foreach ( $paths as $_p ) {
			if ( ! is_string( $_p ) || $_p === '' ) { continue; }
			$_real = @realpath( $_p );
			$_key  = $_real ? $_real : $_p;
			if ( isset( $seen[ $_key ] ) ) { continue; }
			$seen[ $_key ] = true;
			if ( ! is_readable( $_p ) ) { continue; }
			$_chunk = @file_get_contents( $_p );
			if ( is_string( $_chunk ) && $_chunk !== '' ) {
				$text .= "\\n" . $_chunk;
			}
		}
		return $text;
	}
}

if ( ! function_exists( 'redue_wp_extract_footer_entities' ) ) {
	function redue_wp_extract_footer_entities( $html ) {
		$src = is_string( $html ) ? $html : '';
		$plain = $src;
		if ( function_exists( 'wp_strip_all_tags' ) ) {
			$plain = wp_strip_all_tags( $src );
		} else {
			$plain = preg_replace( '/<[^>]+>/', ' ', $src );
			$plain = is_string( $plain ) ? $plain : $src;
		}
		$out = array(
			'taxID'         => '',
			'faxNumber'     => '',
			'repName'       => '',
			'telephone'     => '',
			'streetAddress' => '',
			'sameAs'        => array(),
		);
		if ( preg_match( ${phpSingleQuoted('PLACEHOLDER_TAX')}, $plain, $m ) ) {
			$out['taxID'] = trim( $m[1] );
		}
		if ( preg_match( ${phpSingleQuoted('PLACEHOLDER_FAX')}, $plain, $m ) ) {
			$out['faxNumber'] = trim( $m[1] );
		}
		if ( preg_match_all( ${phpSingleQuoted('PLACEHOLDER_REP')}, $plain, $mm, PREG_SET_ORDER ) ) {
			$_stop = array( ${WP_REP_NAME_STOPWORDS.map((w) => phpSingleQuoted(w)).join(', ')} );
			foreach ( $mm as $_row ) {
				$_name = isset( $_row[1] ) ? trim( $_row[1] ) : '';
				if ( $_name !== '' && ! in_array( $_name, $_stop, true ) ) {
					$out['repName'] = $_name;
					break;
				}
			}
		}
		if ( preg_match( ${phpSingleQuoted('PLACEHOLDER_TEL')}, $plain, $m ) ) {
			$out['telephone'] = trim( $m[1] );
		}
		if ( preg_match( ${phpSingleQuoted('PLACEHOLDER_STREET')}, $plain, $m ) ) {
			$out['streetAddress'] = trim( preg_replace( '/^(?:주소|위치|소재지)\\s*[:：]?\\s*/u', '', $m[1] ) );
		}
		$out['sameAs'] = array();
		if ( preg_match_all( '/<a\\b[^>]*\\bhref=["\\']([^"\\']+)["\\']/i', $src, $mm ) ) {
			foreach ( $mm[1] as $_href ) {
				$_href = trim( (string) $_href );
				if ( $_href === '' || ! preg_match( '#^https?://#i', $_href ) ) { continue; }
				if ( ! preg_match( '#(place\\.naver\\.com|m\\.place\\.naver\\.com|map\\.naver\\.com|blog\\.naver\\.com|place\\.map\\.kakao\\.com|map\\.kakao\\.com|maps\\.google\\.com|goo\\.gl/maps|instagram\\.com|facebook\\.com|youtube\\.com|youtu\\.be|tiktok\\.com|twitter\\.com|x\\.com)#i', $_href ) ) { continue; }
				if ( preg_match( '#sharer\\.php|/share(?:r)?(?:[?/]|$)|intent/tweet|[?&](?:u|url)=#i', $_href ) ) { continue; }
				$out['sameAs'][] = $_href;
			}
		}
		return $out;
	}
}

if ( ! function_exists( 'redue_wp_core_option_identity' ) ) {
	function redue_wp_core_option_identity() {
		$out = array(
			'telephone'     => '',
			'streetAddress' => '',
			'logo'          => '',
		);
		if ( function_exists( 'get_option' ) ) {
			foreach ( array( 'woocommerce_store_phone', 'options_phone', 'phone' ) as $_k ) {
				$_v = redue_wp_trim( get_option( $_k ) );
				if ( $_v !== '' ) { $out['telephone'] = $_v; break; }
			}
			$_addr_parts = array();
			foreach ( array( 'woocommerce_store_address', 'woocommerce_store_address_2', 'woocommerce_store_city' ) as $_k ) {
				$_v = redue_wp_trim( get_option( $_k ) );
				if ( $_v !== '' ) { $_addr_parts[] = $_v; }
			}
			if ( count( $_addr_parts ) > 0 ) {
				$out['streetAddress'] = implode( ' ', $_addr_parts );
			}
		}
		if ( $out['telephone'] === '' && function_exists( 'get_theme_mod' ) ) {
			foreach ( array( 'phone', 'telephone', 'contact_phone' ) as $_k ) {
				$_v = redue_wp_trim( get_theme_mod( $_k ) );
				if ( $_v !== '' ) { $out['telephone'] = $_v; break; }
			}
		}
		if ( $out['streetAddress'] === '' && function_exists( 'get_theme_mod' ) ) {
			foreach ( array( 'address', 'contact_address', 'location' ) as $_k ) {
				$_v = redue_wp_trim( get_theme_mod( $_k ) );
				if ( $_v !== '' ) { $out['streetAddress'] = $_v; break; }
			}
		}
		if ( function_exists( 'get_theme_mod' ) && function_exists( 'wp_get_attachment_image_url' ) ) {
			$_logo_id = get_theme_mod( 'custom_logo' );
			if ( $_logo_id ) {
				$_logo = wp_get_attachment_image_url( $_logo_id, 'full' );
				if ( is_string( $_logo ) && $_logo !== '' ) {
					$out['logo'] = $_logo;
				}
			}
		}
		if ( $out['logo'] === '' && function_exists( 'get_site_icon_url' ) ) {
			$_icon = get_site_icon_url( 512 );
			if ( is_string( $_icon ) && $_icon !== '' ) {
				$out['logo'] = $_icon;
			}
		}
		return $out;
	}
}

if ( ! function_exists( 'redue_wp_resolve_identity' ) ) {
	function redue_wp_resolve_identity() {
		$core   = redue_wp_core_option_identity();
		$footer = redue_wp_extract_footer_entities( redue_wp_scan_footer_files() );
		$g      = function( $key ) {
			return isset( $GLOBALS[ $key ] ) && is_string( $GLOBALS[ $key ] ) ? trim( $GLOBALS[ $key ] ) : '';
		};
		$id = array(
			'taxID'         => $g( 'redue_tax_id' ) !== '' ? $g( 'redue_tax_id' ) : $footer['taxID'],
			'faxNumber'     => $g( 'redue_fax' ) !== '' ? $g( 'redue_fax' ) : $footer['faxNumber'],
			'repName'       => $g( 'redue_rep_name' ) !== '' ? $g( 'redue_rep_name' ) : $footer['repName'],
			'repTitle'      => $g( 'redue_rep_title' ),
			'telephone'     => $g( 'redue_tel' ) !== '' ? $g( 'redue_tel' ) : ( $core['telephone'] !== '' ? $core['telephone'] : $footer['telephone'] ),
			'streetAddress' => $g( 'redue_street' ) !== '' ? $g( 'redue_street' ) : ( $core['streetAddress'] !== '' ? $core['streetAddress'] : $footer['streetAddress'] ),
			'logo'          => $g( 'redue_logo' ) !== '' ? $g( 'redue_logo' ) : $core['logo'],
			'lat'           => $g( 'redue_lat' ),
			'lng'           => $g( 'redue_lng' ),
			'legalName'     => $g( 'redue_legal_name' ),
			'sameAs'        => isset( $footer['sameAs'] ) && is_array( $footer['sameAs'] ) ? $footer['sameAs'] : array(),
		);
		return $id;
	}
}

if ( ! function_exists( 'redue_wp_is_medical' ) ) {
	function redue_wp_is_medical( $org_types, $corpus = '' ) {
		if ( ! empty( $GLOBALS['redue_is_medical'] ) ) { return true; }
		if ( is_array( $org_types ) ) {
			foreach ( $org_types as $_t ) {
				if ( in_array( $_t, array( ${WP_MEDICAL_ORG_TYPES.map((t) => phpSingleQuoted(t)).join(', ')} ), true ) ) {
					return true;
				}
			}
		}
		return (bool) preg_match( '/의원|병원|클리닉|한의|치과|동물병원|의료|진료/u', is_string( $corpus ) ? $corpus : '' );
	}
}

if ( ! function_exists( 'redue_wp_home' ) ) {
	function redue_wp_home() {
		if ( function_exists( 'home_url' ) ) {
			return rtrim( home_url( '/' ), '/' ) . '/';
		}
		return '/';
	}
}

if ( ! function_exists( 'redue_wp_current_url' ) ) {
	function redue_wp_current_url() {
		if ( function_exists( 'is_front_page' ) && function_exists( 'is_home' ) && ( is_front_page() || is_home() ) ) {
			return redue_wp_home();
		}
		if ( function_exists( 'wp_get_canonical_url' ) ) {
			$_c = wp_get_canonical_url();
			if ( is_string( $_c ) && $_c !== '' ) { return $_c; }
		}
		if ( function_exists( 'get_permalink' ) ) {
			$_p = get_permalink();
			if ( is_string( $_p ) && $_p !== '' ) { return $_p; }
		}
		return redue_wp_home();
	}
}

if ( ! function_exists( 'redue_wp_page_description' ) ) {
	function redue_wp_page_description() {
		if ( function_exists( 'get_the_ID' ) && function_exists( 'get_post_meta' ) ) {
			$_id = get_the_ID();
			if ( $_id ) {
				foreach ( array( '_yoast_wpseo_metadesc', 'rank_math_description', '_genesis_description', 'description' ) as $_k ) {
					$_v = redue_wp_trim( get_post_meta( $_id, $_k, true ) );
					if ( $_v !== '' ) { return $_v; }
				}
			}
		}
		if ( function_exists( 'get_the_excerpt' ) ) {
			$_ex = get_the_excerpt();
			if ( is_string( $_ex ) ) {
				$_plain = function_exists( 'wp_strip_all_tags' ) ? wp_strip_all_tags( $_ex ) : preg_replace( '/<[^>]+>/', ' ', $_ex );
				$_plain = is_string( $_plain ) ? trim( $_plain ) : '';
				if ( $_plain !== '' ) { return $_plain; }
			}
		}
		if ( function_exists( 'get_bloginfo' ) ) {
			return redue_wp_trim( get_bloginfo( 'description' ) );
		}
		return '';
	}
}

if ( ! function_exists( 'redue_wp_build_breadcrumbs' ) ) {
	function redue_wp_build_breadcrumbs( $page_url ) {
		$home = redue_wp_home();
		$items = array( array( 'name' => '홈', 'url' => $home ) );
		if ( function_exists( 'is_front_page' ) && function_exists( 'is_home' ) && ( is_front_page() || is_home() ) ) {
			return $items;
		}
		if ( function_exists( 'is_single' ) && is_single() ) {
			if ( function_exists( 'get_the_category' ) ) {
				$_cats = get_the_category();
				if ( is_array( $_cats ) && ! empty( $_cats[0] ) && ! empty( $_cats[0]->name ) ) {
					$_cat_url = function_exists( 'get_category_link' ) ? get_category_link( $_cats[0] ) : '';
					$items[] = array(
						'name' => (string) $_cats[0]->name,
						'url'  => is_string( $_cat_url ) && $_cat_url !== '' ? $_cat_url : $home,
					);
				}
			}
			$_title = function_exists( 'get_the_title' ) ? get_the_title() : '';
			if ( is_string( $_title ) && $_title !== '' ) {
				$items[] = array( 'name' => $_title, 'url' => $page_url );
			}
			return $items;
		}
		if ( function_exists( 'is_page' ) && is_page() ) {
			global $post;
			if ( isset( $post ) && is_object( $post ) && ! empty( $post->post_parent ) && function_exists( 'get_post_ancestors' ) ) {
				$_anc = array_reverse( get_post_ancestors( $post ) );
				foreach ( $_anc as $_aid ) {
					$_n = function_exists( 'get_the_title' ) ? get_the_title( $_aid ) : '';
					$_u = function_exists( 'get_permalink' ) ? get_permalink( $_aid ) : '';
					if ( is_string( $_n ) && $_n !== '' ) {
						$items[] = array(
							'name' => $_n,
							'url'  => is_string( $_u ) && $_u !== '' ? $_u : $home,
						);
					}
				}
			}
			$_title = function_exists( 'get_the_title' ) ? get_the_title() : '';
			if ( is_string( $_title ) && $_title !== '' ) {
				$items[] = array( 'name' => $_title, 'url' => $page_url );
			}
			return $items;
		}
		if ( ( function_exists( 'is_category' ) && is_category() ) || ( function_exists( 'is_archive' ) && is_archive() ) ) {
			$_label = '';
			$_url   = $page_url;
			if ( function_exists( 'is_category' ) && is_category() && function_exists( 'single_cat_title' ) ) {
				$_label = single_cat_title( '', false );
				if ( function_exists( 'get_category_link' ) && function_exists( 'get_queried_object_id' ) ) {
					$_cl = get_category_link( get_queried_object_id() );
					if ( is_string( $_cl ) && $_cl !== '' ) { $_url = $_cl; }
				}
			} elseif ( function_exists( 'is_tag' ) && is_tag() && function_exists( 'single_tag_title' ) ) {
				$_label = single_tag_title( '', false );
			} elseif ( function_exists( 'get_the_archive_title' ) ) {
				$_raw = get_the_archive_title();
				$_label = function_exists( 'wp_strip_all_tags' ) ? trim( wp_strip_all_tags( $_raw ) ) : trim( preg_replace( '/<[^>]+>/', ' ', is_string( $_raw ) ? $_raw : '' ) );
			}
			if ( is_string( $_label ) && $_label !== '' ) {
				$items[] = array( 'name' => $_label, 'url' => $_url );
			}
		}
		return $items;
	}
}

if ( ! function_exists( 'redue_wp_page_branch' ) ) {
	function redue_wp_page_branch( $is_medical ) {
		$page_url = redue_wp_current_url();
		$desc     = redue_wp_page_description();
		$branch   = array(
			'types'         => $is_medical ? array( 'MedicalWebPage' ) : array( 'WebPage' ),
			'name'          => '',
			'description'   => $desc,
			'headline'      => '',
			'datePublished' => '',
			'dateModified'  => '',
			'author'        => null,
			'ogType'        => 'website',
		);
		if ( function_exists( 'is_front_page' ) && function_exists( 'is_home' ) && ( is_front_page() || is_home() ) ) {
			$branch['types'] = $is_medical
				? array( 'MedicalWebPage', 'AboutPage', 'WebPage' )
				: array( 'AboutPage', 'WebPage' );
			if ( $branch['description'] === '' && function_exists( 'get_bloginfo' ) ) {
				$branch['description'] = redue_wp_trim( get_bloginfo( 'description' ) );
			}
			if ( function_exists( 'get_bloginfo' ) ) {
				$branch['name'] = redue_wp_trim( get_bloginfo( 'name' ) );
			}
			return $branch;
		}
		if ( function_exists( 'is_single' ) && is_single() ) {
			$branch['types']    = array( 'Article' );
			$branch['ogType']   = 'article';
			$branch['headline'] = function_exists( 'get_the_title' ) ? redue_wp_trim( get_the_title() ) : '';
			$branch['name']     = $branch['headline'];
			if ( function_exists( 'get_the_date' ) ) {
				$branch['datePublished'] = redue_wp_trim( get_the_date( 'c' ) );
			}
			if ( function_exists( 'get_the_modified_date' ) ) {
				$branch['dateModified'] = redue_wp_trim( get_the_modified_date( 'c' ) );
			}
			return $branch;
		}
		if ( function_exists( 'is_page' ) && is_page() ) {
			$branch['types'] = $is_medical ? array( 'MedicalWebPage' ) : array( 'WebPage' );
			$branch['name']  = function_exists( 'get_the_title' ) ? redue_wp_trim( get_the_title() ) : '';
			return $branch;
		}
		if ( ( function_exists( 'is_category' ) && is_category() ) || ( function_exists( 'is_archive' ) && is_archive() ) ) {
			$branch['types'] = array( 'CollectionPage' );
			if ( function_exists( 'is_category' ) && is_category() && function_exists( 'single_cat_title' ) ) {
				$branch['name'] = redue_wp_trim( single_cat_title( '', false ) );
			} elseif ( function_exists( 'get_the_archive_title' ) ) {
				$_raw = get_the_archive_title();
				$branch['name'] = function_exists( 'wp_strip_all_tags' ) ? trim( wp_strip_all_tags( $_raw ) ) : trim( preg_replace( '/<[^>]+>/', ' ', is_string( $_raw ) ? $_raw : '' ) );
			}
			return $branch;
		}
		return $branch;
	}
}

if ( ! function_exists( 'redue_wp_nav_services' ) ) {
	function redue_wp_nav_services() {
		$out = array();
		if ( ! function_exists( 'wp_get_nav_menu_items' ) ) { return $out; }
		$menu_id = 0;
		if ( function_exists( 'get_nav_menu_locations' ) ) {
			$_locs = get_nav_menu_locations();
			if ( is_array( $_locs ) ) {
				foreach ( array( 'primary', 'main', 'header', 'gnb', 'menu-1' ) as $_loc ) {
					if ( ! empty( $_locs[ $_loc ] ) ) { $menu_id = (int) $_locs[ $_loc ]; break; }
				}
				if ( ! $menu_id ) {
					$_first = reset( $_locs );
					if ( $_first ) { $menu_id = (int) $_first; }
				}
			}
		}
		if ( ! $menu_id ) { return $out; }
		$_items = wp_get_nav_menu_items( $menu_id );
		if ( ! is_array( $_items ) ) { return $out; }
		$_stops = array( '홈', '메인', 'home', '소개', 'about', 'contact', '문의', '예약', '로그인', '회원가입', '사이트맵', '이용약관', '개인정보처리방침', '더보기', '바로가기', '오시는길', '인사말', '공지사항', '게시판', '커뮤니티', '갤러리' );
		foreach ( $_items as $_it ) {
			if ( ! is_object( $_it ) || empty( $_it->title ) ) { continue; }
			$_name = trim( (string) $_it->title );
			if ( $_name === '' || in_array( $_name, $_stops, true ) ) { continue; }
			$_node = array( 'name' => $_name );
			if ( ! empty( $_it->url ) && is_string( $_it->url ) ) { $_node['url'] = $_it->url; }
			$out[] = $_node;
		}
		return $out;
	}
}

if ( ! function_exists( 'redue_wp_resolve_service_item_type' ) ) {
	function redue_wp_resolve_service_item_type( $explicit, $is_medical ) {
		$_raw = is_string( $explicit ) ? trim( $explicit ) : '';
		if ( $_raw === 'MedicalProcedure' || $_raw === 'Service' ) { return $_raw; }
		return $is_medical ? 'MedicalProcedure' : 'Service';
	}
}

if ( ! function_exists( 'redue_wp_resolve_service_catalog_source' ) ) {
	function redue_wp_resolve_service_catalog_source() {
		$_src = array();
		if ( isset( $GLOBALS['redue_service_catalog'] ) && is_array( $GLOBALS['redue_service_catalog'] ) && count( $GLOBALS['redue_service_catalog'] ) > 0 ) {
			$_src = $GLOBALS['redue_service_catalog'];
		} elseif ( isset( $GLOBALS['redue_services'] ) && is_array( $GLOBALS['redue_services'] ) && count( $GLOBALS['redue_services'] ) > 0 ) {
			$_src = $GLOBALS['redue_services'];
		}
		if ( function_exists( 'apply_filters' ) ) {
			$_filtered = apply_filters( 'redue_service_catalog', $_src );
			if ( is_array( $_filtered ) ) { $_src = $_filtered; }
		}
		return is_array( $_src ) ? $_src : array();
	}
}

if ( ! function_exists( 'redue_wp_normalize_services' ) ) {
	function redue_wp_normalize_services( $services, $is_medical ) {
		$out = array();
		if ( ! is_array( $services ) || count( $services ) === 0 ) { return $out; }
		$_seen = array();
		foreach ( $services as $_svc ) {
			if ( is_string( $_svc ) ) {
				$_name = trim( $_svc );
				if ( $_name === '' ) { continue; }
				$_key = strtolower( $_name );
				if ( isset( $_seen[ $_key ] ) ) { continue; }
				$_seen[ $_key ] = true;
				$out[] = array( '@type' => redue_wp_resolve_service_item_type( '', $is_medical ), 'name' => $_name );
				continue;
			}
			if ( ! is_array( $_svc ) ) { continue; }
			$_name = isset( $_svc['name'] ) ? trim( (string) $_svc['name'] ) : '';
			if ( $_name === '' ) { continue; }
			$_key = strtolower( $_name );
			if ( isset( $_seen[ $_key ] ) ) { continue; }
			$_seen[ $_key ] = true;
			$_explicit = '';
			if ( ! empty( $_svc['type'] ) && is_string( $_svc['type'] ) ) { $_explicit = trim( $_svc['type'] ); }
			elseif ( ! empty( $_svc['@type'] ) && is_string( $_svc['@type'] ) ) { $_explicit = trim( (string) $_svc['@type'] ); }
			$_node = array(
				'@type' => redue_wp_resolve_service_item_type( $_explicit, $is_medical ),
				'name'  => $_name,
			);
			if ( ! empty( $_svc['category'] ) && is_string( $_svc['category'] ) && trim( $_svc['category'] ) !== '' ) {
				$_node['category'] = trim( $_svc['category'] );
			}
			if ( ! empty( $_svc['description'] ) && is_string( $_svc['description'] ) && trim( $_svc['description'] ) !== '' ) {
				$_node['description'] = trim( $_svc['description'] );
			}
			if ( ! empty( $_svc['url'] ) && is_string( $_svc['url'] ) ) {
				$_node['url'] = $_svc['url'];
			}
			$out[] = $_node;
		}
		return $out;
	}
}

if ( ! function_exists( 'redue_wp_bind_service_catalog' ) ) {
	function redue_wp_bind_service_catalog( &$org, $services ) {
		if ( ! is_array( $org ) ) { return; }
		if ( ! is_array( $services ) || count( $services ) === 0 ) {
			unset( $org['availableService'], $org['hasOfferCatalog'] );
			return;
		}
		$_offers = array();
		foreach ( $services as $_item ) {
			if ( ! is_array( $_item ) || empty( $_item['name'] ) ) { continue; }
			$_offers[] = array( '@type' => 'Offer', 'itemOffered' => $_item );
		}
		if ( count( $_offers ) === 0 ) {
			unset( $org['availableService'], $org['hasOfferCatalog'] );
			return;
		}
		$org['availableService'] = $services;
		$org['hasOfferCatalog'] = array(
			'@type'           => 'OfferCatalog',
			'name'            => '${SERVICE_CATALOG_NAME}',
			'itemListElement' => $_offers,
		);
	}
}

if ( ! function_exists( 'redue_wp_echo_head_meta' ) ) {
	function redue_wp_echo_head_meta( $canonical, $title, $description, $og_type ) {
		$_esc_url = function_exists( 'esc_url' ) ? 'esc_url' : null;
		$_esc_attr = function_exists( 'esc_attr' ) ? 'esc_attr' : null;
		$_url = function( $v ) use ( $_esc_url ) {
			return $_esc_url ? call_user_func( $_esc_url, $v ) : htmlspecialchars( (string) $v, ENT_QUOTES, 'UTF-8' );
		};
		$_attr = function( $v ) use ( $_esc_attr ) {
			return $_esc_attr ? call_user_func( $_esc_attr, $v ) : htmlspecialchars( (string) $v, ENT_QUOTES, 'UTF-8' );
		};
		echo '<link rel="help" href="/llms.txt" title="LLMs Context" />' . "\\n";
		if ( is_string( $canonical ) && $canonical !== '' ) {
			echo '<link rel="canonical" href="' . $_url( $canonical ) . '" />' . "\\n";
			echo '<meta property="og:url" content="' . $_attr( $canonical ) . '" />' . "\\n";
		}
		if ( is_string( $title ) && $title !== '' ) {
			echo '<meta property="og:title" content="' . $_attr( $title ) . '" />' . "\\n";
		}
		if ( is_string( $description ) && $description !== '' ) {
			echo '<meta property="og:description" content="' . $_attr( $description ) . '" />' . "\\n";
		}
		echo '<meta property="og:type" content="' . $_attr( $og_type ? $og_type : 'website' ) . '" />' . "\\n";
	}
}

if ( ! function_exists( 'redue_wp_build_graph' ) ) {
	function redue_wp_build_graph() {
		$home    = redue_wp_home();
		$origin  = rtrim( $home, '/' );
		$page_url = redue_wp_current_url();
		$id      = redue_wp_resolve_identity();
		$org_types = isset( $GLOBALS['redue_org_type'] ) && is_array( $GLOBALS['redue_org_type'] )
			? $GLOBALS['redue_org_type']
			: array( 'LocalBusiness', 'Organization' );
		$corpus = ( function_exists( 'get_bloginfo' ) ? get_bloginfo( 'name' ) . ' ' . get_bloginfo( 'description' ) : '' ) . ' ' . $id['streetAddress'] . ' ' . $id['repName'];
		$is_medical = redue_wp_is_medical( $org_types, $corpus );
		$branch = redue_wp_page_branch( $is_medical );
		$site_name = function_exists( 'get_bloginfo' ) ? redue_wp_trim( get_bloginfo( 'name' ) ) : '';
		if ( $site_name === '' ) { $site_name = $origin; }

		$org = array(
			'@type' => $org_types,
			'@id'   => $origin . '/#organization',
			'name'  => $site_name,
			'url'   => $home,
		);
		if ( $id['legalName'] !== '' && $id['legalName'] !== $site_name ) {
			$org['legalName'] = $id['legalName'];
		}
		if ( $id['telephone'] !== '' && ! preg_match( '/^0+$/', preg_replace( '/\\D/', '', $id['telephone'] ) ) ) { $org['telephone'] = $id['telephone']; }
		if ( $id['faxNumber'] !== '' && ! preg_match( '/^0+$/', preg_replace( '/\\D/', '', $id['faxNumber'] ) ) ) { $org['faxNumber'] = $id['faxNumber']; }
		if ( $id['taxID'] !== '' && ! preg_match( '/^(0+|1+)$/', preg_replace( '/\\D/', '', $id['taxID'] ) ) ) { $org['taxID'] = $id['taxID']; }
		if ( $id['streetAddress'] !== '' ) {
			$org['address'] = array(
				'@type'         => 'PostalAddress',
				'streetAddress' => $id['streetAddress'],
			);
		}
		if ( $id['lat'] !== '' && $id['lng'] !== '' && is_numeric( $id['lat'] ) && is_numeric( $id['lng'] ) ) {
			$org['geo'] = array(
				'@type'     => 'GeoCoordinates',
				'latitude'  => $id['lat'],
				'longitude' => $id['lng'],
			);
		}
		if ( $id['logo'] !== '' ) {
			$org['logo'] = array(
				'@type' => 'ImageObject',
				'url'   => $id['logo'],
			);
			$org['image'] = $id['logo'];
		}
		$_same = isset( $GLOBALS['redue_sameas'] ) && is_array( $GLOBALS['redue_sameas'] ) ? $GLOBALS['redue_sameas'] : array();
		if ( isset( $id['sameAs'] ) && is_array( $id['sameAs'] ) ) {
			$_same = array_merge( $_same, $id['sameAs'] );
		}
		$_same_clean = array();
		foreach ( $_same as $_u ) {
			if ( is_string( $_u ) && preg_match( '#^https?://#i', $_u ) ) {
				$_same_clean[] = $_u;
			}
		}
		if ( count( $_same_clean ) > 0 ) { $org['sameAs'] = array_values( array_unique( $_same_clean ) ); }
		$_svc_src = function_exists( 'redue_wp_resolve_service_catalog_source' )
			? redue_wp_resolve_service_catalog_source()
			: ( isset( $GLOBALS['redue_services'] ) && is_array( $GLOBALS['redue_services'] ) ? $GLOBALS['redue_services'] : array() );
		if ( count( $_svc_src ) === 0 && function_exists( 'redue_wp_nav_services' ) ) {
			$_svc_src = redue_wp_nav_services();
		}
		$_svc = redue_wp_normalize_services( $_svc_src, $is_medical );
		redue_wp_bind_service_catalog( $org, $_svc );
		redue_wp_omit_empty( $org );

		$website = array(
			'@type'     => 'WebSite',
			'@id'       => $origin . '/#website',
			'url'       => $home,
			'name'      => $site_name,
			'publisher' => array( '@id' => $origin . '/#organization' ),
		);
		if ( $branch['description'] !== '' ) {
			$website['description'] = $branch['description'];
		}
		redue_wp_omit_empty( $website );

		$crumbs = redue_wp_build_breadcrumbs( $page_url );
		$crumb_id = $page_url . '#breadcrumb';
		$crumb_els = array();
		$_pos = 1;
		foreach ( $crumbs as $_c ) {
			if ( empty( $_c['name'] ) ) { continue; }
			$_el = array(
				'@type'    => 'ListItem',
				'position' => $_pos,
				'name'     => $_c['name'],
			);
			if ( ! empty( $_c['url'] ) ) { $_el['item'] = $_c['url']; }
			$crumb_els[] = $_el;
			$_pos += 1;
		}
		$breadcrumb = array(
			'@type'           => 'BreadcrumbList',
			'@id'             => $crumb_id,
			'itemListElement' => $crumb_els,
		);

		$page = array(
			'@type'    => $branch['types'],
			'@id'      => $page_url . '#webpage',
			'url'      => $page_url,
			'isPartOf' => array( '@id' => $origin . '/#website' ),
			'about'    => array( '@id' => $origin . '/#organization' ),
			'breadcrumb' => array( '@id' => $crumb_id ),
		);
		if ( $branch['name'] !== '' ) { $page['name'] = $branch['name']; }
		if ( $branch['description'] !== '' ) { $page['description'] = $branch['description']; }
		if ( $branch['headline'] !== '' ) { $page['headline'] = $branch['headline']; }
		if ( $branch['datePublished'] !== '' ) { $page['datePublished'] = $branch['datePublished']; }
		if ( $branch['dateModified'] !== '' ) { $page['dateModified'] = $branch['dateModified']; }
		if ( $id['repName'] !== '' && in_array( 'Article', $branch['types'], true ) ) {
			$page['author'] = array( '@id' => $origin . '/#person' );
		}
		redue_wp_omit_empty( $page );

		$graph = array( $org, $website, $page, $breadcrumb );
		if ( $id['repName'] !== '' ) {
			$person = array(
				'@type'    => 'Person',
				'@id'      => $origin . '/#person',
				'name'     => $id['repName'],
				'worksFor' => array( '@id' => $origin . '/#organization' ),
			);
			if ( $id['repTitle'] !== '' ) { $person['jobTitle'] = $id['repTitle']; }
			if ( $id['telephone'] !== '' ) { $person['telephone'] = $id['telephone']; }
			redue_wp_omit_empty( $person );
			$graph[] = $person;
			$org['founder'] = array( '@id' => $origin . '/#person' );
			$org['employee'] = array( '@id' => $origin . '/#person' );
			$graph[0] = $org;
		}

		return array(
			'graph'       => $graph,
			'canonical'   => $page_url,
			'title'       => $branch['name'] !== '' ? $branch['name'] : $site_name,
			'description' => $branch['description'],
			'ogType'      => $branch['ogType'],
		);
	}
}

if ( ! function_exists( 'redue_wp_should_skip_request' ) ) {
	function redue_wp_should_skip_request() {
		if ( function_exists( 'is_admin' ) && is_admin() ) { return true; }
		if ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) { return true; }
		if ( function_exists( 'wp_doing_cron' ) && wp_doing_cron() ) { return true; }
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) { return true; }
		return false;
	}
}

if ( ! function_exists( 'redue_wp_dynamic_schema_controller' ) ) {
	function redue_wp_dynamic_schema_controller() {
		if ( redue_wp_should_skip_request() ) { return; }
		if ( function_exists( 'remove_action' ) ) {
			remove_action( 'wp_head', 'rel_canonical' );
		}
		$built = redue_wp_build_graph();
		if ( ! is_array( $built ) || empty( $built['graph'] ) ) { return; }
		redue_wp_echo_head_meta( $built['canonical'], $built['title'], $built['description'], $built['ogType'] );
		$payload = array(
			'@context' => 'https://schema.org',
			'@graph'   => $built['graph'],
		);
		echo '<script type="application/ld+json">' . "\\n"
			. json_encode( $payload, redue_wp_jsonld_flags() )
			. "\\n" . '</script>' . "\\n";
	}
}

if ( ! function_exists( 'redue_wp_echo_full_schema' ) ) {
	function redue_wp_echo_full_schema() {
		redue_wp_dynamic_schema_controller();
	}
}

if ( ! function_exists( 'redue_render_full_schema' ) ) {
	function redue_render_full_schema() {
		ob_start();
		redue_wp_dynamic_schema_controller();
		$out = ob_get_clean();
		return is_string( $out ) ? $out : '';
	}
}

if ( function_exists( 'add_action' ) ) {
	add_action( 'wp_head', 'redue_wp_dynamic_schema_controller', 1 );
}

/* REDUE_AI_STUDIO:END */
`;

	// Inject real regex literals (must stay unquoted PHP /…/u patterns).
	const withRegex = php
		.replace(phpSingleQuoted('PLACEHOLDER_TAX'), toPhpRegexLiteral(WP_FOOTER_TAX_ID_RE))
		.replace(phpSingleQuoted('PLACEHOLDER_FAX'), toPhpRegexLiteral(WP_FOOTER_FAX_RE))
		.replace(phpSingleQuoted('PLACEHOLDER_REP'), toPhpRegexLiteral(WP_FOOTER_REP_NAME_RE))
		.replace(phpSingleQuoted('PLACEHOLDER_TEL'), toPhpRegexLiteral(WP_FOOTER_TELEPHONE_RE))
		.replace(phpSingleQuoted('PLACEHOLDER_STREET'), toPhpRegexLiteral(WP_FOOTER_STREET_RE));

	return sanitizeGeneratedPhpSnippet(withRegex);
}
