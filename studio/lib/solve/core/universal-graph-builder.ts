/**
 * Universal Graph Builder — Schema Injector Generator fragments.
 *
 * Every CMS injector (Gnuboard / Youngcart / WordPress / Rhymix / standalone PHP)
 * seeds the same `$GLOBALS['redue_*']` interface and emits one JSON-LD `@graph`
 * with Organization (LLM 5-core), Person KG, WebSite/WebPage, BreadcrumbList,
 * and evidence-only HowTo / FAQPage nodes.
 */

import {
	buildAvailableServices,
	filterOfficialSameAs,
	WEEKDAY_PLUS_SATURDAY,
	type AvailableServiceNode,
} from '@/lib/audit/extractors/schema-entity-pack';
import {
	buildServiceCatalogRuntimePhp,
	buildServiceCatalogSlotPhp,
	phpServiceCatalogLiteral,
} from '@/lib/solve/core/service-catalog';
import { bindTelephone } from '@/lib/solve/core/telephone';

export type UniversalHoursSeed = {
	dayOfWeek?: string | string[];
	opens?: string;
	closes?: string;
};

export type UniversalServiceSeed =
	| string
	| { name: string; url?: string; type?: string; category?: string; description?: string };

export type UniversalGraphGlobalsInput = {
	repName?: string;
	repTitle?: string;
	tel?: string;
	street?: string;
	taxId?: string;
	lat?: string;
	lng?: string;
	services?: UniversalServiceSeed[];
	hours?: UniversalHoursSeed[];
	sameAs?: string[];
	fax?: string;
	logo?: string;
	openingHoursOpens?: string;
	openingHoursCloses?: string;
	pages?: Array<{
		urlPath?: string;
		title?: string;
		section?: string;
		menu1?: string;
		h1?: string;
		selected?: boolean;
	}>;
	navItems?: Array<{ name?: string; url?: string }>;
	industryType?: string | null;
	siteName?: string;
	targetUrl?: string;
	/** When false, `$GLOBALS['redue_street']` stays empty (Gnuboard runtime NAP). */
	bakeStreet?: boolean;
	bindSchemaPerson?: boolean;
};

function compact(value: string | null | undefined): string {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function phpSingleQuoted(value: string): string {
	return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function normalizeHhMm(raw: string | undefined): string {
	const match = compact(raw).match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return '';
	return `${String(Math.min(23, Math.max(0, Number(match[1])))).padStart(2, '0')}:${match[2]}`;
}

function normalizeCoord(raw: string | undefined): string {
	const value = compact(raw);
	return /^-?\d+(\.\d+)?$/.test(value) ? value : '';
}

function phpStringArray(values: readonly string[]): string {
	if (!values.length) return 'array()';
	return `array(${values.map((v) => phpSingleQuoted(v)).join(', ')})`;
}

function phpServicesLiteral(services: AvailableServiceNode[]): string {
	if (!services.length) return 'array()';
	const rows = services.map((service) => {
		const extra: string[] = [];
		if (service.category) extra.push(`'category' => ${phpSingleQuoted(service.category)}`);
		if (service.description) extra.push(`'description' => ${phpSingleQuoted(service.description)}`);
		if (service.url) extra.push(`'url' => ${phpSingleQuoted(service.url)}`);
		const extraPart = extra.length ? `, ${extra.join(', ')}` : '';
		return `\tarray('@type' => ${phpSingleQuoted(service['@type'])}, 'name' => ${phpSingleQuoted(service.name)}${extraPart})`;
	});
	return `array(\n${rows.join(',\n')}\n)`;
}

function phpHoursLiteral(hours: UniversalHoursSeed[], opens: string, closes: string): string {
	if (hours.length > 0) {
		const rows = hours
			.map((row) => {
				const day = row.dayOfWeek;
				const dayPhp = Array.isArray(day)
					? phpStringArray(day.filter(Boolean))
					: day
						? phpSingleQuoted(day)
						: phpStringArray([...WEEKDAY_PLUS_SATURDAY]);
				const o = normalizeHhMm(row.opens) || opens;
				const c = normalizeHhMm(row.closes) || closes;
				if (!o || !c) return '';
				return `\tarray('@type' => 'OpeningHoursSpecification', 'dayOfWeek' => ${dayPhp}, 'opens' => ${phpSingleQuoted(o)}, 'closes' => ${phpSingleQuoted(c)})`;
			})
			.filter(Boolean);
		if (rows.length) return `array(\n${rows.join(',\n')}\n)`;
	}
	if (opens && closes) {
		return `array(\n\tarray('@type' => 'OpeningHoursSpecification', 'dayOfWeek' => ${phpStringArray([...WEEKDAY_PLUS_SATURDAY])}, 'opens' => ${phpSingleQuoted(opens)}, 'closes' => ${phpSingleQuoted(closes)})\n)`;
	}
	return 'array()';
}

function resolveSeedServices(input: UniversalGraphGlobalsInput): AvailableServiceNode[] {
	if (input.services && input.services.length > 0) {
		const out: AvailableServiceNode[] = [];
		for (const item of input.services) {
			if (typeof item === 'string') {
				const name = compact(item);
				if (name) out.push({ '@type': 'Service', name });
				continue;
			}
			const name = compact(item.name);
			if (!name) continue;
			const type = item.type === 'MedicalProcedure' ? 'MedicalProcedure' : 'Service';
			const node: AvailableServiceNode = item.url
				? { '@type': type, name, url: item.url }
				: { '@type': type, name };
			if (compact(item.category)) node.category = compact(item.category);
			if (compact(item.description)) node.description = compact(item.description);
			out.push(node);
		}
		if (out.length) return out;
	}
	const hasPages = Boolean(input.pages && input.pages.length);
	const hasNav = Boolean(input.navItems && input.navItems.length);
	if (!hasPages && !hasNav) return [];
	return buildAvailableServices({
		pages: input.pages,
		navItems: input.navItems,
		industryType: input.industryType,
		siteName: input.siteName,
		origin: input.targetUrl,
	});
}

/**
 * Top-of-file `$GLOBALS` interface for every auto-injection template.
 * Site owners can override these before the controller runs; empty values
 * fall back to CMS config / footer / live DOM extractors.
 */
export function buildUniversalGraphGlobalsSeedPhp(input: UniversalGraphGlobalsInput = {}): string {
	const repName = compact(input.repName);
	const repTitle = compact(input.repTitle);
	const tel = bindTelephone(input.tel || '');
	const street = input.bakeStreet === false ? '' : compact(input.street);
	const taxId = compact(input.taxId);
	const fax = bindTelephone(input.fax || '');
	const logo = compact(input.logo);
	const lat = normalizeCoord(input.lat);
	const lng = normalizeCoord(input.lng);
	const opens = normalizeHhMm(input.openingHoursOpens);
	const closes = normalizeHhMm(input.openingHoursCloses);
	const services = resolveSeedServices(input);
	const sameAs = filterOfficialSameAs(input.sameAs, input.targetUrl);
	const hoursPhp = phpHoursLiteral(input.hours || [], opens, closes);
	const bindPerson = input.bindSchemaPerson !== false;

	const personBind = bindPerson
		? `if ( $GLOBALS['redue_rep_name'] !== '' ) {
	if ( ! isset($GLOBALS['schema_person']) || ! is_array($GLOBALS['schema_person']) ) {
		$GLOBALS['schema_person'] = array();
	}
	if ( empty($GLOBALS['schema_person']['name']) ) {
		$GLOBALS['schema_person']['name'] = $GLOBALS['redue_rep_name'];
	}
	if ( empty($GLOBALS['schema_person']['jobTitle']) && $GLOBALS['redue_rep_title'] !== '' ) {
		$GLOBALS['schema_person']['jobTitle'] = $GLOBALS['redue_rep_title'];
	}
}`
		: '';

	return `// Site-custom meta — 값이 있을 때만 JSON-LD 키 생성 (No-Fake-Data). 비어 있으면 CMS/푸터 폴백.
$GLOBALS['redue_rep_name']  = ${phpSingleQuoted(repName)}; // 대표자명
$GLOBALS['redue_rep_title'] = ${phpSingleQuoted(repTitle)}; // 직함
$GLOBALS['redue_tel'] = ${phpSingleQuoted(tel)}; // 전화번호
$GLOBALS['redue_fax'] = ${phpSingleQuoted(fax)}; // 팩스번호
$GLOBALS['redue_street'] = ${phpSingleQuoted(street)}; // 도로명주소
$GLOBALS['redue_tax_id'] = ${phpSingleQuoted(taxId)}; // 사업자번호
$GLOBALS['redue_lat'] = ${phpSingleQuoted(lat)}; // 위도 (설정값 또는 지도 스크립트 폴백)
$GLOBALS['redue_lng'] = ${phpSingleQuoted(lng)}; // 경도
$GLOBALS['redue_logo'] = ${phpSingleQuoted(logo)}; // 로고 URL (실재할 때만)
${buildServiceCatalogSlotPhp(phpServiceCatalogLiteral(services))}
$GLOBALS['redue_services'] = ${phpServicesLiteral(services)}; // 하위 호환 — catalog 비어 있을 때만 폴백
$GLOBALS['redue_hours'] = ${hoursPhp}; // 영업시간 배열
$GLOBALS['redue_sameas'] = ${phpStringArray(sameAs)}; // SNS 및 플레이스 URL 배열
${personBind}`;
}

/**
 * Runtime PHP helpers shared by every injector:
 * apply $GLOBALS overlays, bind LLM 5-core on Organization,
 * build dynamic BreadcrumbList (bo_table / co_id / wr_id),
 * and guarantee Person ↔ Organization @id cross-refs.
 */
export function buildUniversalGraphRuntimeHelpersPhp(): string {
	return `	if ( ! function_exists( 'redue_jsonld_flags' ) ) {
		function redue_jsonld_flags() {
			return JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT;
		}
	}
	if ( ! function_exists( 'redue_normalize_hours_spec' ) ) {
		function redue_normalize_hours_spec( $hours, $opens = '', $closes = '' ) {
			$out = array();
			if ( is_array($hours) ) {
				foreach ( $hours as $_row ) {
					if ( ! is_array($_row) ) { continue; }
					$_o = isset($_row['opens']) ? trim((string) $_row['opens']) : '';
					$_c = isset($_row['closes']) ? trim((string) $_row['closes']) : '';
					if ( $_o === '' ) { $_o = is_string($opens) ? $opens : ''; }
					if ( $_c === '' ) { $_c = is_string($closes) ? $closes : ''; }
					if ( $_o === '' || $_c === '' ) { continue; }
					$_days = isset($_row['dayOfWeek']) ? $_row['dayOfWeek'] : array('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday');
					$out[] = array(
						'@type' => 'OpeningHoursSpecification',
						'dayOfWeek' => $_days,
						'opens' => $_o,
						'closes' => $_c,
					);
				}
			}
			if ( count($out) === 0 && is_string($opens) && $opens !== '' && is_string($closes) && $closes !== '' ) {
				$out[] = array(
					'@type' => 'OpeningHoursSpecification',
					'dayOfWeek' => array('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
					'opens' => $opens,
					'closes' => $closes,
				);
			}
			return $out;
		}
	}
${buildServiceCatalogRuntimePhp()}
	if ( ! function_exists( 'redue_normalize_sameas_list' ) ) {
		function redue_normalize_sameas_list( $urls, $origin ) {
			$out = array();
			if ( ! is_array($urls) ) { return $out; }
			foreach ( $urls as $_u ) {
				if ( ! is_string($_u) ) { continue; }
				$_u = trim($_u);
				if ( $_u === '' || ! preg_match('#^https?://#i', $_u) ) { continue; }
				$_u = function_exists('redue_align_url_protocol') ? redue_align_url_protocol($_u) : $_u;
				if ( function_exists('redue_is_own_site_url') && redue_is_own_site_url($_u, $origin) ) { continue; }
				if ( ! in_array($_u, $out, true) ) { $out[] = $_u; }
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_apply_graph_globals' ) ) {
		function redue_apply_graph_globals( &$latitude, &$longitude, &$opens, &$closes, &$available_services, &$same_as_array, &$street_address ) {
			if ( isset($GLOBALS['redue_lat']) && is_string($GLOBALS['redue_lat']) && preg_match('/^-?\\d+(\\.\\d+)?$/', trim($GLOBALS['redue_lat'])) ) {
				$latitude = trim($GLOBALS['redue_lat']);
			}
			if ( isset($GLOBALS['redue_lng']) && is_string($GLOBALS['redue_lng']) && preg_match('/^-?\\d+(\\.\\d+)?$/', trim($GLOBALS['redue_lng'])) ) {
				$longitude = trim($GLOBALS['redue_lng']);
			}
			if ( isset($GLOBALS['redue_street']) && is_string($GLOBALS['redue_street']) && trim($GLOBALS['redue_street']) !== '' ) {
				if ( ! is_string($street_address) || trim($street_address) === '' ) {
					$street_address = trim($GLOBALS['redue_street']);
				}
			}
			$_hours = isset($GLOBALS['redue_hours']) && is_array($GLOBALS['redue_hours']) ? $GLOBALS['redue_hours'] : array();
			if ( count($_hours) > 0 ) {
				$_norm = function_exists('redue_normalize_hours_spec')
					? redue_normalize_hours_spec($_hours, $opens, $closes)
					: $_hours;
				if ( is_array($_norm) && count($_norm) > 0 ) {
					if ( ! empty($_norm[0]['opens']) ) { $opens = (string) $_norm[0]['opens']; }
					if ( ! empty($_norm[0]['closes']) ) { $closes = (string) $_norm[0]['closes']; }
					$GLOBALS['redue_hours'] = $_norm;
				}
			}
			$_svc_src = function_exists('redue_resolve_service_catalog_source')
				? redue_resolve_service_catalog_source()
				: ( isset($GLOBALS['redue_services']) && is_array($GLOBALS['redue_services']) ? $GLOBALS['redue_services'] : array() );
			if ( count($_svc_src) > 0 && ( ! is_array($available_services) || count($available_services) === 0 ) ) {
				$_is_med = function_exists('redue_is_medical_org') && redue_is_medical_org();
				$available_services = redue_normalize_service_nodes($_svc_src, $_is_med);
			}
			$_sa_src = isset($GLOBALS['redue_sameas']) && is_array($GLOBALS['redue_sameas']) ? $GLOBALS['redue_sameas'] : array();
			if ( count($_sa_src) > 0 ) {
				$_origin = function_exists('redue_site_origin') ? redue_site_origin() : ( isset($GLOBALS['redue_canonical_url']) ? $GLOBALS['redue_canonical_url'] : '' );
				$_merged = redue_normalize_sameas_list( array_merge( is_array($same_as_array) ? $same_as_array : array(), $_sa_src ), $_origin );
				if ( count($_merged) > 0 ) { $same_as_array = $_merged; }
			}
		}
	}
	if ( ! function_exists( 'redue_has_real_person' ) ) {
		function redue_has_real_person() {
			if ( isset($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) && trim($GLOBALS['redue_rep_name']) !== '' ) {
				if ( function_exists('redue_is_valid_rep_name') && ! redue_is_valid_rep_name($GLOBALS['redue_rep_name']) ) {
					return false;
				}
				return true;
			}
			if ( isset($GLOBALS['schema_person']) && is_array($GLOBALS['schema_person']) && ! empty($GLOBALS['schema_person']['name']) && trim((string) $GLOBALS['schema_person']['name']) !== '' ) {
				$_n = trim((string) $GLOBALS['schema_person']['name']);
				if ( function_exists('redue_is_valid_rep_name') && ! redue_is_valid_rep_name($_n) ) {
					return false;
				}
				return true;
			}
			return false;
		}
	}
	if ( ! function_exists( 'redue_is_dummy_number' ) ) {
		function redue_is_dummy_number( $raw ) {
			$raw = trim((string) $raw);
			if ( $raw === '' ) { return true; }
			$digits = preg_replace('/\\D/', '', $raw);
			if ( ! is_string($digits) || $digits === '' ) { return true; }
			if ( preg_match('/^0+$/', $digits) || preg_match('/^(\\d)\\1+$/', $digits) ) { return true; }
			$_hyphen = preg_replace('/\\s+/', '', $raw);
			return in_array($_hyphen, array('050-0000-0000', '02-0000-0000', '000-000-0000', '000-0000-0000', '000-00-00000', '111-11-11111'), true);
		}
	}
	if ( ! function_exists( 'redue_tax_id_checksum_ok' ) ) {
		function redue_tax_id_checksum_ok( $raw ) {
			$digits = preg_replace('/\\D/', '', (string) $raw);
			if ( ! is_string($digits) || strlen($digits) !== 10 ) { return false; }
			$w = array(1, 3, 7, 1, 3, 7, 1, 3, 5);
			$sum = 0;
			for ( $i = 0; $i < 8; $i++ ) { $sum += intval($digits[$i]) * $w[$i]; }
			$sum += intval($digits[8]) * 5 + intval(floor(intval($digits[8]) * 5 / 10));
			$check = ( 10 - ( $sum % 10 ) ) % 10;
			return $check === intval($digits[9]);
		}
	}
	if ( ! function_exists( 'redue_accept_tax_id' ) ) {
		function redue_accept_tax_id( $raw, $labeled = true ) {
			$raw = trim((string) $raw);
			if ( $raw === '' || ( function_exists('redue_is_dummy_number') && redue_is_dummy_number($raw) ) ) { return ''; }
			$digits = preg_replace('/\\D/', '', $raw);
			if ( ! is_string($digits) || strlen($digits) !== 10 ) { return ''; }
			$hyphen = substr($digits, 0, 3) . '-' . substr($digits, 3, 2) . '-' . substr($digits, 5);
			if ( function_exists('redue_tax_id_checksum_ok') && redue_tax_id_checksum_ok($digits) ) { return $hyphen; }
			if ( $labeled && preg_match('/^\\d{3}-\\d{2}-\\d{5}$/', preg_replace('/\\s+/', '', $raw)) ) { return $hyphen; }
			return '';
		}
	}
	if ( ! function_exists( 'redue_is_catalog_stopword' ) ) {
		function redue_is_catalog_stopword( $name ) {
			$n = trim((string) $name);
			if ( $n === '' ) { return true; }
			$_fold = strtolower(preg_replace('/\\s+/u', '', $n));
			$_stops = array('홈', '메인', 'home', '소개', 'about', 'contact', '문의', '예약', '로그인', '회원가입', '사이트맵', '이용약관', '개인정보처리방침', '개인정보취급방침', '더보기', '바로가기', '오시는길', '찾아오시는길', '인사말', '공지사항', '게시판', '커뮤니티', '갤러리', '위치', '안내', '병원소개', '원장소개', '의료진소개');
			foreach ( $_stops as $_s ) {
				if ( $_fold === strtolower(preg_replace('/\\s+/u', '', $_s)) ) { return true; }
			}
			return false;
		}
	}
	if ( ! function_exists( 'redue_catalog_from_menu' ) ) {
		function redue_catalog_from_menu( $items, $is_medical = false ) {
			$out = array();
			if ( ! is_array($items) ) { return $out; }
			$_type = $is_medical ? 'MedicalProcedure' : 'Service';
			$_seen = array();
			foreach ( $items as $_row ) {
				$_name = '';
				$_url = '';
				if ( is_string($_row) ) { $_name = trim($_row); }
				elseif ( is_array($_row) ) {
					if ( ! empty($_row['name']) ) { $_name = trim((string) $_row['name']); }
					elseif ( ! empty($_row['me_name']) ) { $_name = trim((string) $_row['me_name']); }
					if ( ! empty($_row['url']) ) { $_url = (string) $_row['url']; }
					elseif ( ! empty($_row['item']) ) { $_url = (string) $_row['item']; }
					elseif ( ! empty($_row['me_link']) ) { $_url = (string) $_row['me_link']; }
				}
				if ( $_name === '' || redue_is_catalog_stopword($_name) ) { continue; }
				$_key = strtolower($_name);
				if ( isset($_seen[$_key]) ) { continue; }
				$_seen[$_key] = true;
				$_node = array('@type' => $_type, 'name' => $_name);
				if ( $_url !== '' ) {
					$_node['url'] = function_exists('redue_align_url_protocol') ? redue_align_url_protocol($_url) : $_url;
				}
				$out[] = $_node;
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_extract_official_sameas' ) ) {
		function redue_extract_official_sameas( $html, $origin ) {
			$out = array();
			if ( ! is_string($html) || $html === '' ) { return $out; }
			if ( ! preg_match_all('/<a\\b[^>]*\\bhref=["\\']([^"\\']+)["\\']/i', $html, $mm) ) { return $out; }
			foreach ( $mm[1] as $_href ) {
				$_href = trim((string) $_href);
				if ( $_href === '' || ! preg_match('#^https?://#i', $_href) ) { continue; }
				if ( ! preg_match('#(place\\.naver\\.com|m\\.place\\.naver\\.com|map\\.naver\\.com|blog\\.naver\\.com|place\\.map\\.kakao\\.com|map\\.kakao\\.com|maps\\.google\\.com|goo\\.gl/maps|instagram\\.com|facebook\\.com|youtube\\.com|youtu\\.be|tiktok\\.com|twitter\\.com|x\\.com)#i', $_href) ) { continue; }
				if ( preg_match('#sharer\\.php|/share(?:r)?(?:[?/]|$)|intent/tweet|[?&](?:u|url)=#i', $_href) ) { continue; }
				$out[] = $_href;
			}
			return function_exists('redue_normalize_sameas_list') ? redue_normalize_sameas_list($out, $origin) : $out;
		}
	}
	if ( ! function_exists( 'redue_omit_empty_schema_keys' ) ) {
		function redue_omit_empty_schema_keys( &$node ) {
			if ( ! is_array($node) ) { return; }
			foreach ( array('taxID', 'faxNumber', 'telephone', 'legalName', 'alternateName', 'priceRange', 'currenciesAccepted', 'paymentAccepted', 'email') as $_omit_k ) {
				if ( ! isset($node[$_omit_k]) ) { continue; }
				if ( ! is_string($node[$_omit_k]) || trim((string) $node[$_omit_k]) === '' ) {
					unset($node[$_omit_k]);
				}
			}
			foreach ( array('sameAs', 'availableService', 'knowsAbout', 'medicalSpecialty', 'openingHoursSpecification') as $_omit_arr ) {
				if ( isset($node[$_omit_arr]) && ( ! is_array($node[$_omit_arr]) || count($node[$_omit_arr]) === 0 ) ) {
					unset($node[$_omit_arr]);
				}
			}
			if ( isset($node['hasOfferCatalog']) && ( ! is_array($node['hasOfferCatalog']) || empty($node['hasOfferCatalog']['itemListElement']) ) ) {
				unset($node['hasOfferCatalog']);
			}
			if ( isset($node['geo']) && is_array($node['geo']) ) {
				$_glat = isset($node['geo']['latitude']) ? $node['geo']['latitude'] : '';
				$_glng = isset($node['geo']['longitude']) ? $node['geo']['longitude'] : '';
				if ( $_glat === '' || $_glng === '' || ! is_numeric($_glat) || ! is_numeric($_glng) ) {
					unset($node['geo']);
				}
			}
			if ( isset($node['address']) && is_array($node['address']) && empty($node['address']['streetAddress']) ) {
				unset($node['address']);
			}
			if ( isset($node['logo']) && is_array($node['logo']) && ( empty($node['logo']['url']) || ! is_string($node['logo']['url']) ) ) {
				unset($node['logo']);
			}
		}
	}
	if ( ! function_exists( 'redue_apply_page_graph_links' ) ) {
		function redue_apply_page_graph_links( &$page_node, $origin, $crumb_id = '' ) {
			if ( ! is_array($page_node) ) { return; }
			$_origin = rtrim((string) $origin, '/');
			$page_node['isPartOf'] = array('@id' => $_origin . '/#website');
			$page_node['about'] = array('@id' => $_origin . '/#organization');
			if ( is_string($crumb_id) && $crumb_id !== '' ) {
				$page_node['breadcrumb'] = array('@id' => $crumb_id);
			}
			if ( function_exists('redue_has_real_person') && redue_has_real_person() ) {
				if ( empty($page_node['author']) ) {
					$page_node['author'] = array('@id' => $_origin . '/#person');
				}
			} else {
				unset($page_node['author'], $page_node['reviewedBy']);
			}
		}
	}
	if ( ! function_exists( 'redue_humanize_filename' ) ) {
		function redue_humanize_filename( $file ) {
			$base = preg_replace('/\\.(php|html?|htm)$/i', '', basename((string) $file));
			$base = preg_replace('/[_-]+/', ' ', is_string($base) ? $base : '');
			return trim((string) $base);
		}
	}
	if ( ! function_exists( 'redue_match_gnb_parent' ) ) {
		function redue_match_gnb_parent( $gnb_items, $canonical_url ) {
			if ( ! is_array($gnb_items) || ! is_string($canonical_url) || $canonical_url === '' ) { return null; }
			$_canon_path = parse_url($canonical_url, PHP_URL_PATH);
			$_canon_file = basename(is_string($_canon_path) && $_canon_path !== '' ? $_canon_path : '');
			$_hit = null;
			foreach ( $gnb_items as $_g ) {
				if ( ! is_array($_g) ) { continue; }
				$_url = isset($_g['item']) ? (string) $_g['item'] : ( isset($_g['url']) ? (string) $_g['url'] : '' );
				$_path = parse_url($_url, PHP_URL_PATH);
				$_file = basename(is_string($_path) && $_path !== '' ? $_path : '');
				if ( $_file !== '' && $_canon_file !== '' && strcasecmp($_file, $_canon_file) === 0 ) {
					$_hit = $_g;
					break;
				}
				if ( $_url !== '' && rtrim($_url, '/') === rtrim($canonical_url, '/') ) {
					$_hit = $_g;
					break;
				}
			}
			if ( ! is_array($_hit) ) { return null; }
			$_code = isset($_hit['code']) ? (string) $_hit['code'] : '';
			if ( strlen($_code) > 2 ) {
				$_parent_code = substr($_code, 0, -2);
				foreach ( $gnb_items as $_g ) {
					if ( ! is_array($_g) || empty($_g['code']) ) { continue; }
					if ( (string) $_g['code'] === $_parent_code && ! empty($_g['name']) ) {
						return array(
							'name' => (string) $_g['name'],
							'url' => isset($_g['item']) ? (string) $_g['item'] : ( isset($_g['url']) ? (string) $_g['url'] : '' ),
						);
					}
				}
			}
			return null;
		}
	}
	if ( ! function_exists( 'redue_bind_org_five_core' ) ) {
		function redue_bind_org_five_core( &$org_node, $origin ) {
			if ( ! is_array($org_node) ) { return; }
			if ( empty($org_node['@id']) ) { $org_node['@id'] = rtrim((string) $origin, '/') . '/#organization'; }
			if ( empty($org_node['url']) ) { $org_node['url'] = rtrim((string) $origin, '/'); }
			if ( empty($org_node['logo']) && isset($GLOBALS['redue_logo']) && is_string($GLOBALS['redue_logo']) && trim($GLOBALS['redue_logo']) !== '' ) {
				$org_node['logo'] = array('@type' => 'ImageObject', 'url' => trim($GLOBALS['redue_logo']));
			}
			if ( empty($org_node['taxID']) && isset($GLOBALS['redue_tax_id']) && is_string($GLOBALS['redue_tax_id']) && trim($GLOBALS['redue_tax_id']) !== '' ) {
				$_tax_ok = function_exists('redue_accept_tax_id') ? redue_accept_tax_id($GLOBALS['redue_tax_id']) : trim($GLOBALS['redue_tax_id']);
				if ( $_tax_ok !== '' ) { $org_node['taxID'] = $_tax_ok; }
			}
			if ( empty($org_node['faxNumber']) && isset($GLOBALS['redue_fax']) && is_string($GLOBALS['redue_fax']) && trim($GLOBALS['redue_fax']) !== '' ) {
				$org_node['faxNumber'] = trim($GLOBALS['redue_fax']);
			}
			if ( empty($org_node['taxID']) && function_exists('redue_extract_tax_id') ) {
				$_tax_blob = '';
				if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
					foreach ( array('cf_add_script', 'cf_add_meta', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
						if ( ! empty($GLOBALS['config'][$_ck]) && is_string($GLOBALS['config'][$_ck]) ) {
							$_tax_blob .= ' ' . $GLOBALS['config'][$_ck];
						}
					}
				}
				$_tax = redue_extract_tax_id($_tax_blob);
				if ( $_tax !== '' ) { $org_node['taxID'] = $_tax; }
			}
			$_lat = '';
			$_lng = '';
			if ( ! empty($org_node['geo']) && is_array($org_node['geo']) ) {
				if ( isset($org_node['geo']['latitude']) ) { $_lat = (string) $org_node['geo']['latitude']; }
				if ( isset($org_node['geo']['longitude']) ) { $_lng = (string) $org_node['geo']['longitude']; }
			}
			if ( $_lat === '' && isset($GLOBALS['redue_lat']) ) { $_lat = trim((string) $GLOBALS['redue_lat']); }
			if ( $_lng === '' && isset($GLOBALS['redue_lng']) ) { $_lng = trim((string) $GLOBALS['redue_lng']); }
			if ( $_lat !== '' && $_lng !== '' && is_numeric($_lat) && is_numeric($_lng) ) {
				$org_node['geo'] = array(
					'@type' => 'GeoCoordinates',
					'latitude' => (float) $_lat,
					'longitude' => (float) $_lng,
				);
			} else {
				unset($org_node['geo']);
			}
			$_hours = array();
			if ( ! empty($org_node['openingHoursSpecification']) && is_array($org_node['openingHoursSpecification']) ) {
				$_hours = $org_node['openingHoursSpecification'];
			} elseif ( isset($GLOBALS['redue_hours']) ) {
				$_hours = redue_normalize_hours_spec($GLOBALS['redue_hours']);
			}
			if ( is_array($_hours) && count($_hours) > 0 ) {
				$org_node['openingHoursSpecification'] = $_hours;
			} else {
				unset($org_node['openingHoursSpecification']);
			}
			$_svc = array();
			$_is_med = function_exists('redue_is_medical_org') && redue_is_medical_org();
			if ( ! $_is_med && function_exists('redue_is_medical_schema_type') ) {
				$_is_med = redue_is_medical_schema_type( isset($org_node['@type']) ? $org_node['@type'] : array() );
			}
			if ( ! empty($org_node['availableService']) && is_array($org_node['availableService']) ) {
				$_svc = $org_node['availableService'];
			} else {
				$_svc_src = function_exists('redue_resolve_service_catalog_source')
					? redue_resolve_service_catalog_source()
					: ( isset($GLOBALS['redue_services']) && is_array($GLOBALS['redue_services']) ? $GLOBALS['redue_services'] : array() );
				$_svc = function_exists('redue_normalize_service_nodes')
					? redue_normalize_service_nodes($_svc_src, $_is_med)
					: array();
			}
			if ( function_exists('redue_bind_dual_service_catalog') ) {
				redue_bind_dual_service_catalog($org_node, $_svc);
			} elseif ( is_array($_svc) && count($_svc) > 0 ) {
				$org_node['availableService'] = $_svc;
				if ( empty($org_node['hasOfferCatalog']) ) {
					$_offers = array();
					foreach ( $_svc as $_item ) {
						$_offers[] = array('@type' => 'Offer', 'itemOffered' => $_item);
					}
					$org_node['hasOfferCatalog'] = array(
						'@type' => 'OfferCatalog',
						'name' => '주요 서비스 및 진료 카탈로그',
						'itemListElement' => $_offers,
					);
				}
			} else {
				unset($org_node['availableService'], $org_node['hasOfferCatalog']);
			}
			$_sa = array();
			if ( ! empty($org_node['sameAs']) && is_array($org_node['sameAs']) ) {
				$_sa = $org_node['sameAs'];
			}
			if ( isset($GLOBALS['redue_sameas']) && is_array($GLOBALS['redue_sameas']) ) {
				$_sa = array_merge($_sa, $GLOBALS['redue_sameas']);
			}
			$_sa = redue_normalize_sameas_list($_sa, $origin);
			if ( count($_sa) > 0 ) {
				$org_node['sameAs'] = $_sa;
			} else {
				unset($org_node['sameAs']);
			}
			if ( function_exists('redue_has_real_person') && redue_has_real_person() ) {
				if ( empty($org_node['founder']) ) {
					$org_node['founder'] = array('@id' => rtrim((string) $origin, '/') . '/#person');
				}
				if ( empty($org_node['employee']) ) {
					$org_node['employee'] = array('@id' => rtrim((string) $origin, '/') . '/#person');
				}
			} else {
				unset($org_node['founder'], $org_node['employee'], $org_node['physician']);
			}
			if ( empty($org_node['address']) || ! is_array($org_node['address']) ) {
				$org_node['address'] = array();
			}
			if ( empty($org_node['address']['streetAddress']) && isset($GLOBALS['redue_street']) && is_string($GLOBALS['redue_street']) && trim($GLOBALS['redue_street']) !== '' ) {
				$org_node['address']['streetAddress'] = trim($GLOBALS['redue_street']);
			}
			if ( ! empty($org_node['address']['streetAddress']) ) {
				$org_node['address']['@type'] = 'PostalAddress';
				if ( empty($org_node['address']['addressCountry']) ) { $org_node['address']['addressCountry'] = 'KR'; }
			} else {
				unset($org_node['address']);
			}
			if ( empty($org_node['telephone']) && isset($GLOBALS['redue_tel']) && is_string($GLOBALS['redue_tel']) && trim($GLOBALS['redue_tel']) !== '' ) {
				$_bound_tel = function_exists('redue_format_telephone')
					? redue_format_telephone($GLOBALS['redue_tel'])
					: trim($GLOBALS['redue_tel']);
				if ( $_bound_tel !== '' ) { $org_node['telephone'] = $_bound_tel; }
			}
			if ( function_exists('redue_omit_empty_schema_keys') ) {
				redue_omit_empty_schema_keys($org_node);
			} else {
				foreach ( array('taxID', 'faxNumber', 'telephone') as $_omit_k ) {
					if ( isset($org_node[$_omit_k]) && ( ! is_string($org_node[$_omit_k]) || trim((string) $org_node[$_omit_k]) === '' ) ) {
						unset($org_node[$_omit_k]);
					}
				}
			}
		}
	}
	if ( ! function_exists( 'redue_build_breadcrumb_list' ) ) {
		function redue_build_breadcrumb_list( $origin, $canonical_url, $page_title = '홈' ) {
			global $bo_table, $wr_id, $co_id, $board, $g5_head_title;
			$_origin = rtrim((string) $origin, '/');
			$_canon = is_string($canonical_url) && $canonical_url !== '' ? $canonical_url : ( $_origin . '/' );
			$_title = is_string($page_title) && trim($page_title) !== '' ? trim($page_title) : '홈';
			$items = array(
				array('@type' => 'ListItem', 'position' => 1, 'name' => '홈', 'item' => $_origin . '/'),
			);
			$runtime_bo = ! empty($bo_table) ? (string) $bo_table : ( isset($_GET['bo_table']) ? (string) $_GET['bo_table'] : '' );
			$runtime_wr = ! empty($wr_id) ? (string) $wr_id : ( isset($_GET['wr_id']) ? (string) $_GET['wr_id'] : '' );
			$runtime_co = ! empty($co_id) ? (string) $co_id : ( isset($_GET['co_id']) ? (string) $_GET['co_id'] : '' );
			$is_main = ( $_canon === $_origin . '/' || $_canon === $_origin ) && $runtime_bo === '' && $runtime_wr === '' && $runtime_co === '';
			if ( ! $is_main ) {
				if ( $runtime_wr !== '' && $runtime_bo !== '' ) {
					$_mid = ( isset($board) && is_array($board) && ! empty($board['bo_subject']) )
						? (string) $board['bo_subject']
						: $runtime_bo;
					$items[] = array(
						'@type' => 'ListItem',
						'position' => 2,
						'name' => $_mid,
						'item' => $_origin . '/bbs/board.php?bo_table=' . rawurlencode($runtime_bo),
					);
					$items[] = array('@type' => 'ListItem', 'position' => 3, 'name' => $_title, 'item' => $_canon);
				} elseif ( $runtime_bo !== '' ) {
					$_mid = ( isset($board) && is_array($board) && ! empty($board['bo_subject']) )
						? (string) $board['bo_subject']
						: $runtime_bo;
					$items[] = array('@type' => 'ListItem', 'position' => 2, 'name' => $_mid, 'item' => $_canon);
				} elseif ( $runtime_co !== '' ) {
					$_mid = ( ! empty($g5_head_title) && trim((string) $g5_head_title) !== '' )
						? (string) $g5_head_title
						: $_title;
					if ( $_mid !== '' && $_mid !== '홈' ) {
						$items[] = array('@type' => 'ListItem', 'position' => 2, 'name' => $_mid, 'item' => $_canon);
					}
				} else {
					$_gnb = isset($GLOBALS['redue_gnb_items']) && is_array($GLOBALS['redue_gnb_items'])
						? $GLOBALS['redue_gnb_items']
						: array();
					$_parent = function_exists('redue_match_gnb_parent')
						? redue_match_gnb_parent($_gnb, $_canon)
						: null;
					$_leaf = ( $_title !== '' && $_title !== '홈' )
						? $_title
						: ( function_exists('redue_humanize_filename') ? redue_humanize_filename($_canon) : $_title );
					if ( is_array($_parent) && ! empty($_parent['name']) && $_leaf !== '' && $_leaf !== '홈' ) {
						$items[] = array(
							'@type' => 'ListItem',
							'position' => 2,
							'name' => (string) $_parent['name'],
							'item' => ! empty($_parent['url']) ? (string) $_parent['url'] : $_origin . '/',
						);
						$items[] = array('@type' => 'ListItem', 'position' => 3, 'name' => $_leaf, 'item' => $_canon);
					} elseif ( $_leaf !== '' && $_leaf !== '홈' ) {
						$items[] = array('@type' => 'ListItem', 'position' => 2, 'name' => $_leaf, 'item' => $_canon);
					}
				}
			}
			return array(
				'@type' => 'BreadcrumbList',
				'@id' => $_canon . '#breadcrumb',
				'itemListElement' => $items,
			);
		}
	}
	if ( ! function_exists( 'redue_is_schema_type' ) ) {
		function redue_is_schema_type( $node, $type ) {
			if ( ! is_array($node) || empty($node['@type']) ) { return false; }
			if ( is_string($node['@type']) ) { return $node['@type'] === $type; }
			return is_array($node['@type']) && in_array($type, $node['@type'], true);
		}
	}
	if ( ! function_exists( 'redue_ensure_universal_breadcrumb' ) ) {
		function redue_ensure_universal_breadcrumb( &$graph, $origin, $canonical_url, $page_title = '홈' ) {
			if ( ! is_array($graph) ) { return; }
			foreach ( $graph as $_gn ) {
				if ( function_exists('redue_is_schema_type') && redue_is_schema_type($_gn, 'BreadcrumbList') ) {
					$_crumb_id = is_array($_gn) && ! empty($_gn['@id']) ? $_gn['@id'] : ( $canonical_url . '#breadcrumb' );
					foreach ( $graph as &$_pn ) {
						if ( ! is_array($_pn) ) { continue; }
						if ( redue_is_schema_type($_pn, 'WebPage') || redue_is_schema_type($_pn, 'MedicalWebPage') || redue_is_schema_type($_pn, 'AboutPage') || redue_is_schema_type($_pn, 'ContactPage') || redue_is_schema_type($_pn, 'CollectionPage') || redue_is_schema_type($_pn, 'ProfilePage') || redue_is_schema_type($_pn, 'Article') ) {
							if ( empty($_pn['breadcrumb']) ) {
								$_pn['breadcrumb'] = array('@id' => $_crumb_id);
							}
						}
					}
					unset($_pn);
					return;
				}
			}
			$_crumb = redue_build_breadcrumb_list($origin, $canonical_url, $page_title);
			$graph[] = $_crumb;
			foreach ( $graph as &$_pn ) {
				if ( ! is_array($_pn) ) { continue; }
				if ( redue_is_schema_type($_pn, 'WebPage') || redue_is_schema_type($_pn, 'MedicalWebPage') || redue_is_schema_type($_pn, 'AboutPage') || redue_is_schema_type($_pn, 'ContactPage') || redue_is_schema_type($_pn, 'CollectionPage') || redue_is_schema_type($_pn, 'ProfilePage') || redue_is_schema_type($_pn, 'Article') ) {
					if ( empty($_pn['breadcrumb']) ) {
						$_pn['breadcrumb'] = array('@id' => $_crumb['@id']);
					}
				}
			}
			unset($_pn);
		}
	}
`;
}

/** Call-site: overlay `$GLOBALS['redue_*']` onto controller locals. */
export function buildUniversalGraphApplyPhp(indent = '\t\t'): string {
	return `${indent}if ( ! isset($latitude) ) { $latitude = ""; }
${indent}if ( ! isset($longitude) ) { $longitude = ""; }
${indent}if ( ! isset($opens) ) { $opens = ""; }
${indent}if ( ! isset($closes) ) { $closes = ""; }
${indent}if ( ! isset($available_services) ) { $available_services = array(); }
${indent}if ( ! isset($same_as_array) ) { $same_as_array = array(); }
${indent}if ( ! isset($street_address) ) { $street_address = ""; }
${indent}if ( function_exists('redue_apply_graph_globals') ) {
${indent}	redue_apply_graph_globals($latitude, $longitude, $opens, $closes, $available_services, $same_as_array, $street_address);
${indent}}
`;
}

/** Call-site: fill LLM 5-core + Person KG on `$org_node`. */
export function buildUniversalOrgFiveCoreBindPhp(indent = '\t\t'): string {
	return `${indent}if ( function_exists('redue_bind_org_five_core') ) {
${indent}	redue_bind_org_five_core($org_node, isset($origin) ? $origin : '');
${indent}}
`;
}

/** Call-site: guarantee BreadcrumbList + WebPage.breadcrumb on every page. */
export function buildUniversalBreadcrumbEnsurePhp(opts?: {
	indent?: string;
	originVar?: string;
	canonicalVar?: string;
	titleVar?: string;
}): string {
	const indent = opts?.indent ?? '\t\t';
	const originVar = opts?.originVar ?? 'origin';
	const canonicalVar = opts?.canonicalVar ?? 'canonical_url';
	const titleVar = opts?.titleVar ?? 'page_title';
	return `${indent}if ( function_exists('redue_ensure_universal_breadcrumb') ) {
${indent}	$_crumb_canon = isset($${canonicalVar}) && is_string($${canonicalVar}) && $${canonicalVar} !== ''
${indent}		? $${canonicalVar}
${indent}		: ( isset($page_url) && is_string($page_url) ? $page_url : ( $${originVar} . '/' ) );
${indent}	$_crumb_title = isset($${titleVar}) && is_string($${titleVar}) && $${titleVar} !== ''
${indent}		? $${titleVar}
${indent}		: ( isset($schema_meta_title) && is_string($schema_meta_title) ? $schema_meta_title : '홈' );
${indent}	redue_ensure_universal_breadcrumb($graph, $${originVar}, $_crumb_canon, $_crumb_title);
${indent}}
`;
}

export const UNIVERSAL_GRAPH_GLOBALS = [
	'redue_rep_name',
	'redue_rep_title',
	'redue_tel',
	'redue_fax',
	'redue_street',
	'redue_tax_id',
	'redue_lat',
	'redue_lng',
	'redue_logo',
	'redue_service_catalog',
	'redue_services',
	'redue_hours',
	'redue_sameas',
] as const;
