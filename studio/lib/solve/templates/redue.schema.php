<?php
if (!defined('_GNUBOARD_')) exit;
if (defined('G5_IS_ADMIN') && G5_IS_ADMIN) return;
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') return;

/* REDUE_AI_STUDIO:START — GnuBoard / YoungCart extend/redue.schema.php · Universal 5-core · No-Fake-Data · 관리자·POST 가드 */
/**
 * ═══════════════════════════════════════════════════════════════════════
 *  REDUE Universal Schema Engine — Phase 4 자동 분석 결과 요약
 * ═══════════════════════════════════════════════════════════════════════
 * [1] Protocol (프로토콜)
 *   런타임 자동 감지 — redue_detect_site_protocol() 이 요청 시점의 SSL 여부를 확인해
 *   인증서가 있으면 https, 없으면 http 를 그대로 유지합니다 (강제 https 변환 없음).
 *
 * [2] Industry Mapping (업종 매핑)
 *   런타임 자동 추론 — $config['cf_title'] · _SHOP_/G5_USE_SHOP · 푸터/본문 키워드
 *   의료 → MedicalClinic, Physician, LocalBusiness
 *   쇼핑몰 → OnlineStore, Store, LocalBusiness
 *   일반 → LocalBusiness, Organization
 *   EducationalOrganization 등 무관 타입은 키워드가 있을 때만 사용 (기본값 오염 금지)
 *   컴파일 시드(있을 경우) → LocalBusiness, Organization
 *
 * [3] Subpage Routing (서브페이지 분기 — Type Stacking 금지, 페이지당 단일 @type)
 *   - 사이트맵 데이터 미제공 — 각 요청 URL/제목 패턴을 기준으로 런타임에 자동 분류됨 (about/contact/board/main)
 *
 *   ※ FAQPage/HowTo는 페이지에 실제 존재하는 Q&A/절차가 바인딩된 경우에만 생성됩니다 (가상 데이터 금지).
 *   ※ sameAs는 자사 도메인을 제외한 실제 운영 중인 공식 외부 채널만 포함합니다.
 * ═══════════════════════════════════════════════════════════════════════
 */
if ( ! function_exists( 'run_replace' ) ) {
	function run_replace( $tag, $data = null ) {
		return func_num_args() > 1 ? $data : null;
	}
}
if ( ! function_exists( 'run_event' ) ) {
	function run_event( $tag ) {
		return null;
	}
}

// Site-custom meta — 값이 있을 때만 JSON-LD 키 생성 (No-Fake-Data). 비어 있으면 CMS/푸터 폴백.
$GLOBALS['redue_rep_name']  = ''; // 대표자명
$GLOBALS['redue_rep_title'] = ''; // 직함
$GLOBALS['redue_tel'] = ''; // 전화번호
$GLOBALS['redue_fax'] = ''; // 팩스번호
$GLOBALS['redue_street'] = ''; // 도로명주소
$GLOBALS['redue_tax_id'] = ''; // 사업자번호
$GLOBALS['redue_lat'] = ''; // 위도 (설정값 또는 지도 스크립트 폴백)
$GLOBALS['redue_lng'] = ''; // 경도
$GLOBALS['redue_logo'] = ''; // 로고 URL (실재할 때만)
/* 서비스·진료과목 카탈로그 — 유효 항목이 있을 때만 hasOfferCatalog / availableService 병합 (No-Fake-Data).
 * $redue_service_catalog = array(
 *     array(
 *         'name'        => '정밀 맞춤 진단',
 *         'category'    => '진단 및 분석',
 *         'description' => '환자별 맞춤형 진단 솔루션',
 *         'type'        => 'MedicalProcedure', // 미지정 시 메인 @type에 따라 자동 분기
 *     ),
 * );
 */
$redue_service_catalog = array();
$GLOBALS['redue_service_catalog'] = $redue_service_catalog;
$GLOBALS['redue_services'] = array(); // 하위 호환 — catalog 비어 있을 때만 폴백
$GLOBALS['redue_hours'] = array(); // 영업시간 배열
$GLOBALS['redue_sameas'] = array(); // SNS 및 플레이스 URL 배열
if ( $GLOBALS['redue_rep_name'] !== '' ) {
	if ( ! isset($GLOBALS['schema_person']) || ! is_array($GLOBALS['schema_person']) ) {
		$GLOBALS['schema_person'] = array();
	}
	if ( empty($GLOBALS['schema_person']['name']) ) {
		$GLOBALS['schema_person']['name'] = $GLOBALS['redue_rep_name'];
	}
	if ( empty($GLOBALS['schema_person']['jobTitle']) && $GLOBALS['redue_rep_title'] !== '' ) {
		$GLOBALS['schema_person']['jobTitle'] = $GLOBALS['redue_rep_title'];
	}
}
$GLOBALS['redue_org_type']  = array('LocalBusiness', 'Organization'); // 기본 기관 타입 — 하드코딩 NAP 없이 상단 변수만 참조
$GLOBALS['redue_legal_name'] = '';
$GLOBALS['redue_fax'] = '';
$GLOBALS['redue_strict_nap'] = true;

if ( ! defined('REDUE_UNIVERSAL_ENGINE_ACTIVE') ) {
	define('REDUE_UNIVERSAL_ENGINE_ACTIVE', true);

	if ( ! function_exists( 'redue_detect_site_protocol' ) ) {
		function redue_detect_site_protocol() {
			if ( defined('G5_URL') && is_string(G5_URL) && preg_match('#^(https?)://#i', G5_URL, $m) ) {
				return strtolower($m[1]);
			}
			if ( function_exists('home_url') ) {
				$_home = home_url('/');
				if ( is_string($_home) && preg_match('#^(https?)://#i', $_home, $m) ) {
					return strtolower($m[1]);
				}
			}
			if ( ! empty($_SERVER['HTTP_X_FORWARDED_PROTO']) ) {
				$_fwd = strtolower(trim((string) $_SERVER['HTTP_X_FORWARDED_PROTO']));
				if ( $_fwd === 'https' || $_fwd === 'http' ) { return $_fwd; }
			}
			if ( ! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' && $_SERVER['HTTPS'] !== '0' ) {
				return 'https';
			}
			if ( isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443' ) {
				return 'https';
			}
			if ( ! empty($_SERVER['REQUEST_SCHEME']) && strtolower((string) $_SERVER['REQUEST_SCHEME']) === 'https' ) {
				return 'https';
			}
			return 'http';
		}
	}
	if ( ! function_exists( 'redue_site_origin' ) ) {
		function redue_site_origin() {
			$proto = redue_detect_site_protocol();
			if ( defined('G5_URL') && G5_URL !== '' ) {
				return preg_replace('#^https?://#i', $proto . '://', rtrim(G5_URL, '/'));
			}
			$host = '';
			if ( ! empty($_SERVER['HTTP_HOST']) ) { $host = (string) $_SERVER['HTTP_HOST']; }
			elseif ( ! empty($_SERVER['SERVER_NAME']) ) { $host = (string) $_SERVER['SERVER_NAME']; }
			if ( $host === '' ) { $host = 'localhost'; }
			$host = preg_replace('#^https?://#i', '', $host);
			return $proto . '://' . $host;
		}
	}
	if ( ! function_exists( 'redue_align_url_protocol' ) ) {
		function redue_align_url_protocol( $url ) {
			if ( ! is_string($url) || $url === '' ) { return $url; }
			if ( ! preg_match('#^https?://#i', $url) ) { return $url; }
			return preg_replace('#^https?://#i', redue_detect_site_protocol() . '://', $url);
		}
	}
	if ( ! function_exists( 'redue_is_own_site_url' ) ) {
		function redue_is_own_site_url( $url, $origin ) {
			$uh = parse_url($url, PHP_URL_HOST);
			$oh = parse_url($origin, PHP_URL_HOST);
			if ( ! is_string($uh) || ! is_string($oh) || $uh === '' || $oh === '' ) { return false; }
			$uh = preg_replace('#^www\.#i', '', strtolower($uh));
			$oh = preg_replace('#^www\.#i', '', strtolower($oh));
			return $uh === $oh;
		}
	}
	if ( ! function_exists( 'redue_plain_text' ) ) {
		function redue_plain_text( $html ) {
			$plain = preg_replace('/<script\b[^>]*>[\s\S]*?<\/script>/i', ' ', is_string($html) ? $html : '');
			$plain = preg_replace('/<style\b[^>]*>[\s\S]*?<\/style>/i', ' ', is_string($plain) ? $plain : '');
			$plain = html_entity_decode(strip_tags(is_string($plain) ? $plain : ''), ENT_QUOTES, 'UTF-8');
			return is_string($plain) ? trim(preg_replace('/\s+/u', ' ', $plain)) : '';
		}
	}
	if ( ! function_exists( 'redue_format_telephone' ) ) {
		function redue_format_telephone( $raw ) {
			if ( ! is_string($raw) || $raw === '' ) { return ''; }
			$raw = preg_replace('/^tel:/i', '', trim($raw));
			$parts = preg_split('/[?,;]/', is_string($raw) ? $raw : '');
			$raw = is_array($parts) && isset($parts[0]) ? trim((string) $parts[0]) : '';
			$digits = preg_replace('/[^\d]/', '', $raw);
			if ( ! is_string($digits) ) { return ''; }
			if ( strpos($digits, '82') === 0 && strlen($digits) >= 10 ) {
				$digits = '0' . substr($digits, 2);
			}
			$len = strlen($digits);
			if ( $len < 8 || $len > 12 ) { return ''; }
			if ( preg_match('/^(\d)\1+$/', $digits) ) { return ''; }
			if ( strpos($digits, '02') === 0 ) {
				$rest = substr($digits, 2);
				$rl = strlen($rest);
				if ( $rl === 8 ) { return '02-' . substr($rest, 0, 4) . '-' . substr($rest, 4); }
				if ( $rl === 7 ) { return '02-' . substr($rest, 0, 3) . '-' . substr($rest, 3); }
			}
			if ( preg_match('/^050\d/', $digits) && $len >= 11 ) {
				return substr($digits, 0, 4) . '-' . substr($digits, 4, 4) . '-' . substr($digits, 8);
			}
			if ( preg_match('/^01[016789]/', $digits) && $len === 11 ) {
				return substr($digits, 0, 3) . '-' . substr($digits, 3, 4) . '-' . substr($digits, 7);
			}
			if ( preg_match('/^(15|16|18)\d{2}/', $digits) && $len === 8 ) {
				return substr($digits, 0, 4) . '-' . substr($digits, 4);
			}
			if ( $len === 11 ) {
				return substr($digits, 0, 3) . '-' . substr($digits, 3, 4) . '-' . substr($digits, 7);
			}
			if ( $len === 10 ) {
				return substr($digits, 0, 3) . '-' . substr($digits, 3, 3) . '-' . substr($digits, 6);
			}
			if ( $len === 9 && strpos($digits, '02') !== 0 ) {
				return substr($digits, 0, 2) . '-' . substr($digits, 2, 3) . '-' . substr($digits, 5);
			}
			return $raw;
		}
	}
	if ( ! function_exists( 'redue_extract_telephone' ) ) {
		function redue_extract_telephone( $text ) {
			if ( ! is_string($text) || $text === '' ) { return ''; }
			if ( preg_match('/(?:대표번호|대표전화|TEL|Tel|전화|문의|상담|고객센터)?\s*[:：]?\s*((02[-\s]?\d{3,4}[-\s]?\d{4}|0[3-6][1-5][-\s]?\d{3,4}[-\s]?\d{4}|1[568]\d{2}[-\s]?\d{4}|010[-\s]?\d{4}[-\s]?\d{4}|070[-\s]?\d{3,4}[-\s]?\d{4}|050\d{1}[-\s]?\d{3,4}[-\s]?\d{4}|080[-\s]?\d{3,4}[-\s]?\d{4}|01[16789][-\s]?\d{3,4}[-\s]?\d{4}))/u', $text, $m) ) {
				$_hit = trim( ! empty($m[1]) ? $m[1] : $m[0] );
				$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_hit) : $_hit;
				if ( $_fmt !== '' ) { return $_fmt; }
			}
			if ( preg_match('/(?:대표번호|대표전화|TEL|Tel|전화|문의|상담|고객센터)?\s*[:：]?\s*((0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}|1[568]\d{2}[-\s]?\d{4}))/u', $text, $m) ) {
				$_hit = trim( ! empty($m[1]) ? $m[1] : $m[0] );
				$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_hit) : $_hit;
				if ( $_fmt !== '' ) { return $_fmt; }
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_extract_tel_href' ) ) {
		function redue_extract_tel_href( $html ) {
			if ( ! is_string($html) || $html === '' ) { return ''; }
			if ( preg_match('/<a\b[^>]*\bhref=["']tel:([^"']+)["'][^>]*>/i', $html, $m) ) {
				$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($m[1]) : trim($m[1]);
				return is_string($_fmt) ? $_fmt : '';
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_resolve_cms_telephone' ) ) {
		function redue_resolve_cms_telephone() {
			$_scan_keys = function( $arr ) {
				if ( ! is_array($arr) ) { return ''; }
				foreach ( array('cf_tel', 'cf_phone', 'tel', 'phone', 'telephone', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
					if ( empty($arr[$_ck]) || ! is_string($arr[$_ck]) || trim($arr[$_ck]) === '' ) { continue; }
					if ( $_ck === 'cf_tel' || $_ck === 'cf_phone' || $_ck === 'tel' || $_ck === 'phone' || $_ck === 'telephone' ) {
						$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($arr[$_ck]) : trim($arr[$_ck]);
						if ( $_fmt !== '' ) { return $_fmt; }
					}
					if ( function_exists('redue_extract_telephone') ) {
						$_hit = redue_extract_telephone($arr[$_ck]);
						if ( $_hit !== '' ) { return $_hit; }
					}
				}
				foreach ( $arr as $_k => $_v ) {
					if ( ! is_string($_k) || ! is_string($_v) || trim($_v) === '' ) { continue; }
					if ( ! preg_match('/tel|phone|전화|문의|상담/i', $_k) ) { continue; }
					$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_v) : '';
					if ( $_fmt !== '' ) { return $_fmt; }
					if ( function_exists('redue_extract_telephone') ) {
						$_hit = redue_extract_telephone($_v);
						if ( $_hit !== '' ) { return $_hit; }
					}
				}
				return '';
			};
			if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
				$_hit = $_scan_keys($GLOBALS['config']);
				if ( $_hit !== '' ) { return $_hit; }
			}
			if ( isset($GLOBALS['site_config']) && is_array($GLOBALS['site_config']) ) {
				$_hit = $_scan_keys($GLOBALS['site_config']);
				if ( $_hit !== '' ) { return $_hit; }
			}
			if ( function_exists('get_option') ) {
				foreach ( array('phone', 'telephone', 'phone_number', 'contact_phone', 'company_phone', 'woocommerce_store_phone', 'blog_phone', 'redue_telephone', 'theme_phone', 'store_phone', 'business_phone') as $_ok ) {
					$_ov = get_option($_ok);
					if ( is_string($_ov) && trim($_ov) !== '' ) {
						$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_ov) : trim($_ov);
						if ( $_fmt !== '' ) { return $_fmt; }
						if ( function_exists('redue_extract_telephone') ) {
							$_hit = redue_extract_telephone($_ov);
							if ( $_hit !== '' ) { return $_hit; }
						}
					}
				}
			}
			if ( function_exists('get_theme_mod') ) {
				foreach ( array('phone', 'telephone', 'phone_number', 'contact_phone') as $_tm ) {
					$_tv = get_theme_mod($_tm);
					if ( is_string($_tv) && trim($_tv) !== '' ) {
						$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_tv) : trim($_tv);
						if ( $_fmt !== '' ) { return $_fmt; }
					}
				}
			}
			if ( class_exists('Context') && method_exists('Context', 'get') ) {
				foreach ( array('phone', 'tel', 'telephone', 'site_phone') as $_rk ) {
					$_rv = @Context::get($_rk);
					if ( is_string($_rv) && trim($_rv) !== '' ) {
						$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_rv) : trim($_rv);
						if ( $_fmt !== '' ) { return $_fmt; }
					}
				}
				$_mod = @Context::get('site_module_info');
				if ( is_object($_mod) ) {
					foreach ( array('phone', 'tel', 'telephone') as $_rk ) {
						if ( ! empty($_mod->$_rk) && is_string($_mod->$_rk) ) {
							$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($_mod->$_rk) : trim($_mod->$_rk);
							if ( $_fmt !== '' ) { return $_fmt; }
						}
					}
				}
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_resolve_universal_telephone' ) ) {
		function redue_resolve_universal_telephone( $html = '' ) {
			if ( isset($GLOBALS['redue_tel']) && is_string($GLOBALS['redue_tel']) && trim($GLOBALS['redue_tel']) !== '' ) {
				$_fmt = function_exists('redue_format_telephone') ? redue_format_telephone($GLOBALS['redue_tel']) : trim($GLOBALS['redue_tel']);
				if ( $_fmt !== '' ) { return $_fmt; }
			}
			if ( function_exists('redue_resolve_cms_telephone') ) {
				$_cms = redue_resolve_cms_telephone();
				if ( is_string($_cms) && $_cms !== '' ) { return $_cms; }
			}
			if ( is_string($html) && $html !== '' ) {
				if ( function_exists('redue_extract_tel_href') ) {
					$_href = redue_extract_tel_href($html);
					if ( $_href !== '' ) { return $_href; }
				}
				if ( preg_match_all('/<script\b[^>]*>([\s\S]*?)<\/script>/i', $html, $scripts) && ! empty($scripts[1]) ) {
					foreach ( $scripts[1] as $_sc ) {
						$_hit = function_exists('redue_extract_telephone') ? redue_extract_telephone($_sc) : '';
						if ( $_hit !== '' ) { return $_hit; }
					}
				}
			}
			if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
				foreach ( array('cf_add_script', 'cf_add_meta', 'cf_analytics', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
					if ( empty($GLOBALS['config'][$_ck]) || ! is_string($GLOBALS['config'][$_ck]) ) { continue; }
					$_hit = function_exists('redue_extract_telephone') ? redue_extract_telephone($GLOBALS['config'][$_ck]) : '';
					if ( $_hit !== '' ) { return $_hit; }
					if ( function_exists('redue_extract_tel_href') ) {
						$_href = redue_extract_tel_href($GLOBALS['config'][$_ck]);
						if ( $_href !== '' ) { return $_href; }
					}
				}
			}
			if ( is_string($html) && $html !== '' && function_exists('redue_extract_telephone') ) {
				$_plain = function_exists('redue_plain_text') ? redue_plain_text($html) : strip_tags($html);
				$_hit = redue_extract_telephone(is_string($_plain) ? $_plain : $html);
				if ( $_hit !== '' ) { return $_hit; }
				$_hit = redue_extract_telephone($html);
				if ( $_hit !== '' ) { return $_hit; }
			}
			return '';
		}
	}

	if ( ! function_exists( 'redue_extract_street_address' ) ) {
		function redue_extract_street_address( $text ) {
			if ( ! is_string($text) || $text === '' ) { return ''; }
			if ( preg_match('/(?:주소|위치|ADDRESS|소재지)?\s*[:：]?\s*((?:서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣\d\-~,()·\s]+(?:로|길|동|리|읍|면|가|층|호|번지))/u', $text, $m) ) {
				$_hit = trim( ! empty($m[1]) ? $m[1] : $m[0] );
				$_hit = preg_replace('/^(?:주소|위치|ADDRESS|소재지)\s*[:：]?\s*/u', '', is_string($_hit) ? $_hit : '');
				if ( is_string($_hit) && $_hit !== '' && preg_match('/' . preg_quote($_hit, '/') . '\s+(\d[\d-]{0,8}(?:\s*[가-힣\d호층동번지]+)?)/u', $text, $_num) ) {
					$_hit = trim($_hit) . ' ' . trim($_num[1]);
				}
				return trim(preg_replace('/\s+/u', ' ', is_string($_hit) ? $_hit : ''));
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_read_php_plain' ) ) {
		function redue_read_php_plain( $path ) {
			if ( ! is_string($path) || $path === '' || ! is_file($path) ) { return ''; }
			$raw = @file_get_contents($path);
			if ( ! is_string($raw) || $raw === '' ) { return ''; }
			return function_exists('redue_plain_text') ? redue_plain_text($raw) : trim(strip_tags($raw));
		}
	}
	if ( ! function_exists( 'redue_scan_site_file_corpus' ) ) {
		function redue_scan_site_file_corpus() {
			static $cached = null;
			if ( is_string($cached) ) { return $cached; }
			$blob = '';
			$paths = array();
			if ( defined('G5_THEME_PATH') && G5_THEME_PATH ) {
				$paths[] = G5_THEME_PATH . '/tail.php';
				$paths[] = G5_THEME_PATH . '/tail.sub.php';
				$paths[] = G5_THEME_PATH . '/head.php';
			}
			if ( defined('G5_PATH') && G5_PATH ) {
				$paths[] = G5_PATH . '/tail.php';
				$paths[] = G5_PATH . '/tail.sub.php';
			}
			if ( defined('G5_DATA_PATH') && G5_DATA_PATH && is_dir(G5_DATA_PATH . '/content') ) {
				$_files = @glob(G5_DATA_PATH . '/content/*');
				if ( is_array($_files) ) {
					foreach ( $_files as $_cf ) {
						if ( is_file($_cf) ) { $paths[] = $_cf; }
					}
				}
			}
			foreach ( $paths as $_p ) {
				$blob .= ' ' . redue_read_php_plain($_p);
			}
			if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
				foreach ( array('cf_title', 'cf_tel', 'cf_phone', 'cf_admin_name', 'cf_add_script', 'cf_add_meta', 'cf_analytics', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
					if ( ! empty($GLOBALS['config'][$_ck]) && is_string($GLOBALS['config'][$_ck]) ) {
						$blob .= ' ' . $GLOBALS['config'][$_ck];
					}
				}
			}
			$cached = trim(preg_replace('/\s+/u', ' ', $blob));
			return $cached;
		}
	}
	if ( ! function_exists( 'redue_extract_fax' ) ) {
		function redue_extract_fax( $text ) {
			if ( ! is_string($text) || $text === '' ) { return ''; }
			if ( preg_match('/(?:FAX|Fax|팩스)\s*[:：]?\s*((?:0\d{1,2}|070)[-\s.]?\d{3,4}[-\s.]?\d{4})/u', $text, $m) ) {
				return function_exists('redue_format_telephone') ? redue_format_telephone($m[1]) : trim($m[1]);
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_extract_tax_id' ) ) {
		function redue_extract_tax_id( $text ) {
			if ( ! is_string($text) || $text === '' ) { return ''; }
			if ( preg_match('/(?:사업자\s*등록\s*번호|사업자번호|사업자)\s*[:：]?\s*(\d{3}-\d{2}-\d{5}|\d{10})/u', $text, $m) ) {
				return trim($m[1]);
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_auto_detect_footer_info' ) ) {
		function redue_auto_detect_footer_info() {
			static $executed = false;
			static $cached = null;
			if ( $executed ) { return; }
			$executed = true;

			if ( ! is_string($cached) ) {
				$cached = '';
				if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
					foreach ( array('cf_title', 'cf_tel', 'cf_phone', 'cf_admin_name', 'cf_add_script', 'cf_add_meta', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
						if ( ! empty($GLOBALS['config'][$_ck]) && is_string($GLOBALS['config'][$_ck]) ) {
							$cached .= "\n" . $GLOBALS['config'][$_ck];
						}
					}
				}
				$candidates = array(
					defined('G5_THEME_PATH') ? G5_THEME_PATH . '/tail.php' : '',
					defined('G5_THEME_PATH') ? G5_THEME_PATH . '/tail.sub.php' : '',
					defined('G5_PATH') ? G5_PATH . '/tail.php' : '',
					defined('G5_PATH') ? G5_PATH . '/tail.sub.php' : '',
					( isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : '' ) . '/theme/basic/tail.php',
				);
				foreach ( $candidates as $_p ) {
					if ( ! is_string($_p) || $_p === '' || ! is_file($_p) ) { continue; }
					$_raw = @file_get_contents($_p);
					if ( ! is_string($_raw) || trim($_raw) === '' ) { continue; }
					$cached .= "\n" . $_raw;
				}
			}
			if ( $cached === '' ) { return; }

			$plain = function_exists('redue_plain_text') ? redue_plain_text($cached) : trim(strip_tags($cached));
			$hay = $cached . "\n" . ( is_string($plain) ? $plain : '' );

			if ( empty($GLOBALS['redue_tax_id']) || ! is_string($GLOBALS['redue_tax_id']) || trim($GLOBALS['redue_tax_id']) === '' ) {
				$_tax = function_exists('redue_extract_tax_id') ? redue_extract_tax_id($hay) : '';
				if ( $_tax === '' && preg_match('/(?:사업자\s*(?:등록)?\s*번호|사업자번호|등록번호)\s*[:：]?\s*([0-9]{3}-[0-9]{2}-[0-9]{5}|[0-9]{10})/u', $hay, $m) ) {
					$_tax = trim($m[1]);
				}
				if ( $_tax !== '' ) {
					$GLOBALS['redue_tax_id'] = function_exists('redue_accept_tax_id') ? redue_accept_tax_id($_tax, true) : $_tax;
				}
			}
			if ( empty($GLOBALS['redue_fax']) || ! is_string($GLOBALS['redue_fax']) || trim($GLOBALS['redue_fax']) === '' ) {
				$_fax = function_exists('redue_extract_fax') ? redue_extract_fax($hay) : '';
				if ( $_fax === '' && preg_match('/(?:팩스|FAX|Fax|F\.)\s*[:：]?\s*([0-9]{2,4}-[0-9]{3,4}-[0-9]{4})/u', $hay, $m) ) {
					$_fax = trim($m[1]);
				}
				if ( $_fax !== '' ) { $GLOBALS['redue_fax'] = $_fax; }
			}
			if ( empty($GLOBALS['redue_tel']) || ! is_string($GLOBALS['redue_tel']) || trim($GLOBALS['redue_tel']) === '' ) {
				if ( function_exists('redue_extract_telephone') ) {
					$_tel = redue_extract_telephone($hay);
					if ( $_tel !== '' ) { $GLOBALS['redue_tel'] = $_tel; }
				}
			}
			if ( empty($GLOBALS['redue_rep_name']) || ! is_string($GLOBALS['redue_rep_name']) || trim($GLOBALS['redue_rep_name']) === '' ) {
				if ( preg_match_all('/(?:대표자|대표원장|원장|대표이사|대표)\s*[:：]?\s*([가-힣]{2,4})(?=\s|<|$|\||\/)/u', $hay, $mm) ) {
					$_stops = array('제품으로', '대표', '문의', '안내', '상담', '진료', '정보');
					foreach ( $mm[1] as $_cand ) {
						$_cand = trim((string) $_cand);
						if ( $_cand === '' || in_array($_cand, $_stops, true) ) { continue; }
						if ( function_exists('redue_is_valid_rep_name') && ! redue_is_valid_rep_name($_cand) ) { continue; }
						$GLOBALS['redue_rep_name'] = $_cand;
						if ( ! isset($GLOBALS['schema_person']) || ! is_array($GLOBALS['schema_person']) ) {
							$GLOBALS['schema_person'] = array();
						}
						if ( empty($GLOBALS['schema_person']['name']) ) {
							$GLOBALS['schema_person']['name'] = $_cand;
						}
						break;
					}
				}
			}
			if ( empty($GLOBALS['redue_street']) || ! is_string($GLOBALS['redue_street']) || trim($GLOBALS['redue_street']) === '' ) {
				$_street = function_exists('redue_extract_street_address') ? redue_extract_street_address($hay) : '';
				if ( $_street === '' && preg_match('/(?:주소|위치|소재지)?\s*[:：]?\s*([가-힣]+(?:특별시|광역시|도|시|군|구)\s+[가-힣0-9\s·\-\(\),]+(?:로|길|동|리|가|번지|호|층|관|빌딩|호텔)[가-힣0-9\s·\-\(\),]*)/u', $hay, $m) ) {
					$_street = trim(preg_replace('/\s+/u', ' ', $m[1]));
				}
				if ( $_street !== '' ) { $GLOBALS['redue_street'] = $_street; }
			}
			if ( function_exists('redue_extract_official_sameas') ) {
				$_origin = function_exists('redue_site_origin') ? redue_site_origin() : '';
				$_sa = redue_extract_official_sameas($hay, $_origin);
				if ( is_array($_sa) && count($_sa) > 0 ) {
					$_prev = isset($GLOBALS['redue_sameas']) && is_array($GLOBALS['redue_sameas']) ? $GLOBALS['redue_sameas'] : array();
					$GLOBALS['redue_sameas'] = function_exists('redue_normalize_sameas_list')
						? redue_normalize_sameas_list(array_merge($_prev, $_sa), $_origin)
						: array_values(array_unique(array_merge($_prev, $_sa)));
				}
			}
		}
	}

	if ( ! function_exists( 'redue_is_shop_context' ) ) {
		function redue_is_shop_context() {
			return ( defined('_SHOP_') && _SHOP_ ) || ( defined('G5_USE_SHOP') && G5_USE_SHOP );
		}
	}
	if ( ! function_exists( 'redue_industry_haystack' ) ) {
		function redue_industry_haystack() {
			$hay = '';
			if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
				foreach ( array('cf_title', 'cf_1', 'cf_2', 'cf_3', 'cf_add_meta') as $_ck ) {
					if ( ! empty($GLOBALS['config'][$_ck]) && is_string($GLOBALS['config'][$_ck]) ) {
						$hay .= ' ' . $GLOBALS['config'][$_ck];
					}
				}
			}
			if ( isset($GLOBALS['g5_head_title']) && is_string($GLOBALS['g5_head_title']) ) {
				$hay .= ' ' . $GLOBALS['g5_head_title'];
			}
			if ( function_exists('redue_scan_site_file_corpus') ) {
				$hay .= ' ' . redue_scan_site_file_corpus();
			}
			return trim(preg_replace('/\s+/u', ' ', $hay));
		}
	}
	if ( ! function_exists( 'redue_sanitize_org_types' ) ) {
		function redue_sanitize_org_types( $types ) {
			$out = array();
			if ( is_string($types) && trim($types) !== '' ) { $types = array($types); }
			if ( ! is_array($types) ) { return $out; }
			foreach ( $types as $t ) {
				$t = trim((string) $t);
				if ( $t === '' || in_array($t, $out, true) ) { continue; }
				$out[] = $t;
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_infer_org_types' ) ) {
		function redue_infer_org_types() {
			if ( function_exists('redue_is_shop_context') && redue_is_shop_context() ) {
				return array('OnlineStore', 'Store', 'LocalBusiness');
			}
			$hay = function_exists('redue_industry_haystack') ? redue_industry_haystack() : '';
			$seed = isset($GLOBALS['redue_org_type']) ? redue_sanitize_org_types($GLOBALS['redue_org_type']) : array();
			$live_medical = (bool) preg_match('/병원|의원|클리닉|치과|한의|의료|진료|암치료|physician|clinic|hospital|dentist|veterinary|동물병원|수의사/iu', $hay);
			$live_edu = (bool) preg_match('/학원|교육기관|과외|입시|보습|학교|academy|tutoring|hagwon/iu', $hay);
			if ( $live_medical ) {
				if ( preg_match('/동물병원|수의사|veterinary|VeterinaryCare/iu', $hay) ) {
					return array('VeterinaryCare', 'LocalBusiness');
				}
				if ( preg_match('/치과|dentist|Dentist/iu', $hay) ) {
					return array('Dentist', 'MedicalClinic', 'LocalBusiness');
				}
				return array('MedicalClinic', 'Physician', 'LocalBusiness');
			}
			if ( preg_match('/법률|법무|변호사|attorney|law\s*firm/iu', $hay) ) {
				return array('LegalService', 'LocalBusiness', 'Organization');
			}
			if ( preg_match('/세무|회계|노무|accounting|bookkeep/iu', $hay) ) {
				return array('AccountingService', 'LocalBusiness', 'Organization');
			}
			if ( $live_edu ) {
				return array('EducationalOrganization', 'LocalBusiness', 'Organization');
			}
			if ( preg_match('/쇼핑몰|스토어|온라인몰|커머스|영카트|youngcart|ecommerce|e-commerce/iu', $hay) ) {
				return array('OnlineStore', 'Store', 'LocalBusiness');
			}
			if ( count($seed) > 0 ) {
				$filtered = array();
				foreach ( $seed as $t ) {
					if ( preg_match('/MedicalClinic|VeterinaryCare|Physician|Hospital|Dentist/i', $t) && $hay !== '' && ! $live_medical ) { continue; }
					if ( $t === 'EducationalOrganization' && $hay !== '' && ! $live_edu ) { continue; }
					$filtered[] = $t;
				}
				if ( count($filtered) > 0 ) { return $filtered; }
			}
			return array('LocalBusiness', 'Organization');
		}
	}
	if ( ! function_exists( 'redue_is_medical_org' ) ) {
		function redue_is_medical_org() {
			$hay = '';
			$types = function_exists('redue_infer_org_types') ? redue_infer_org_types() : ( isset($GLOBALS['redue_org_type']) ? $GLOBALS['redue_org_type'] : array() );
			$hay .= is_array($types) ? implode(' ', $types) : (string) $types;
			if ( isset($GLOBALS['config']['cf_title']) ) { $hay .= ' ' . $GLOBALS['config']['cf_title']; }
			return (bool) preg_match('/MedicalClinic|VeterinaryCare|Physician|Hospital|Dentist|병원|의원|클리닉|치과|한의|의료|암치료|진료/iu', $hay);
		}
	}
	if ( ! function_exists( 'redue_is_nav_dump_description' ) ) {
		function redue_is_nav_dump_description( $text, $gnb_items = array() ) {
			$plain = trim(preg_replace('/\s+/u', ' ', (string) $text));
			if ( $plain === '' ) { return true; }
			$names = array();
			if ( is_array($gnb_items) ) {
				foreach ( $gnb_items as $_g ) {
					if ( is_array($_g) && ! empty($_g['name']) ) { $names[] = trim((string) $_g['name']); }
				}
			}
			if ( count($names) >= 3 ) {
				$hits = 0;
				foreach ( $names as $_n ) {
					if ( $_n === '' ) { continue; }
					if ( function_exists('mb_strpos') ? mb_strpos($plain, $_n) !== false : strpos($plain, $_n) !== false ) { $hits++; }
				}
				if ( $hits >= 3 && $hits >= ( count($names) * 0.5 ) ) { return true; }
			}
			$_tokens = preg_split('/[\s|\/>·•,\/]+/u', $plain);
			if ( is_array($_tokens) && count($_tokens) >= 6 ) {
				$_short = 0;
				$_total = 0;
				foreach ( $_tokens as $_t ) {
					if ( $_t === '' ) { continue; }
					$_total++;
					$_len = function_exists('mb_strlen') ? mb_strlen($_t, 'UTF-8') : strlen($_t);
					if ( $_len <= 6 ) { $_short++; }
				}
				if ( $_total > 0 && ( $_short / $_total ) >= 0.85 ) { return true; }
			}
			return false;
		}
	}
	if ( ! function_exists( 'redue_compose_official_description' ) ) {
		function redue_compose_official_description( $site_name, $page_title, $is_main = false ) {
			$site = trim(strip_tags((string) $site_name));
			$page = trim(strip_tags((string) $page_title));
			if ( $site === '' ) { $site = '웹사이트'; }
			if ( $is_main || $page === '' || $page === $site ) {
				return $site . ' 공식 웹사이트입니다.';
			}
			$page = preg_replace('/\s*[|\-–—]\s+' . preg_quote($site, '/') . '\s*$/u', '', $page);
			$page = trim(is_string($page) ? $page : '');
			return $site . ' ' . $page . ' 공식 안내입니다.';
		}
	}
	if ( ! function_exists( 'redue_summarize_body_text' ) ) {
		function redue_summarize_body_text( $text, $max = 140 ) {
			$plain = function_exists('redue_plain_text') ? redue_plain_text($text) : trim(preg_replace('/\s+/u', ' ', strip_tags((string) $text)));
			$plain = trim(is_string($plain) ? $plain : '');
			if ( $plain === '' ) { return ''; }
			if ( function_exists('mb_substr') ) { return mb_substr($plain, 0, (int) $max, 'UTF-8'); }
			return substr($plain, 0, (int) $max);
		}
	}
	if ( ! function_exists( 'redue_refine_page_description' ) ) {
		function redue_refine_page_description( $desc, $site_name, $page_title, $is_main, $gnb_items = array() ) {
			$desc = trim((string) $desc);
			if ( $desc === '' || ( function_exists('redue_is_nav_dump_description') && redue_is_nav_dump_description($desc, $gnb_items) ) ) {
				return function_exists('redue_compose_official_description')
					? redue_compose_official_description($site_name, $page_title, $is_main)
					: trim((string) $site_name);
			}
			return $desc;
		}
	}
	/* Checklist 16/17: subpages keep a single @type; the homepage uses an industry
	 * composite (e.g. MedicalWebPage+AboutPage+WebPage) so AI crawlers see both
	 * the entity page and the about/service surface. */
	if ( ! function_exists( 'redue_composite_page_types' ) ) {
		function redue_composite_page_types( $is_main, $current_types = null, $is_about = false ) {
			if ( $is_main ) {
				$is_medical = function_exists('redue_is_medical_org') && redue_is_medical_org();
				if ( $is_medical ) {
					return array('MedicalWebPage', 'AboutPage', 'WebPage');
				}
				return array('AboutPage', 'WebPage');
			}
			if ( $is_about ) {
				return 'AboutPage';
			}
			$types = array();
			if ( is_array($current_types) ) { $types = $current_types; }
			elseif ( is_string($current_types) && $current_types !== '' ) { $types = array($current_types); }
			foreach ( $types as $t ) {
				if ( is_string($t) && $t !== '' && $t !== 'WebPage' ) { return $t; }
			}
			return count($types) > 0 && is_string($types[0]) && $types[0] !== '' ? $types[0] : 'WebPage';
		}
	}
	if ( ! function_exists( 'redue_infer_kr_address_parts' ) ) {
		function redue_infer_kr_address_parts( $text ) {
			$out = array( 'region' => '', 'locality' => '' );
			if ( ! is_string($text) || $text === '' ) { return $out; }
			if ( preg_match('/(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|제주특별자치도|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|서울시|부산시|대구시|인천시|광주시|대전시|울산시|세종시|제주시|서울|부산|대구|인천|광주|대전|울산|세종|제주|경기|강원)/u', $text, $m) ) {
				$raw = $m[1];
				$map = array( '서울특별시' => '서울', '서울시' => '서울', '부산광역시' => '부산', '부산시' => '부산', '대구광역시' => '대구', '대구시' => '대구', '인천광역시' => '인천', '인천시' => '인천', '광주광역시' => '광주', '대전광역시' => '대전', '대전시' => '대전', '울산광역시' => '울산', '울산시' => '울산', '세종특별자치시' => '세종', '세종시' => '세종', '제주특별자치도' => '제주', '제주시' => '제주', '경기도' => '경기', '강원도' => '강원', '충청북도' => '충북', '충청남도' => '충남', '전라북도' => '전북', '전라남도' => '전남', '경상북도' => '경북', '경상남도' => '경남' );
				$out['region'] = isset($map[$raw]) ? $map[$raw] : $raw;
			}
			if ( preg_match('/(강남|서초|송파|마포|강서|관악|영등포|노원|종로|용산|성동|광진|은평|양천|구로|금천|동작|중랑|성북|강북|도봉|강동)구?/u', $text, $lm) ) {
				$stem = preg_replace('/구$/', '', $lm[1]);
				$out['locality'] = $stem . '구';
				if ( $out['region'] === '' ) { $out['region'] = '서울'; }
			} elseif ( preg_match('/([가-힣]{1,8}(?:시|군|구))/u', $text, $lm2) ) {
				$out['locality'] = $lm2[1];
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_complete_postal_address' ) ) {
		function redue_complete_postal_address( $addr, $site_name = '', $domain_host = '', $street = '', $locality = '', $region = '' ) {
			if ( ! is_array($addr) ) { $addr = array(); }
			$addr['@type'] = 'PostalAddress';
			$addr['addressCountry'] = 'KR';
			$blob = trim( implode( ' ', array_filter( array(
				isset($addr['streetAddress']) ? (string) $addr['streetAddress'] : '',
				is_string($street) ? $street : '',
				is_string($locality) ? $locality : '',
				is_string($region) ? $region : '',
			) ) ) );
			$parts = function_exists('redue_infer_kr_address_parts') ? redue_infer_kr_address_parts($blob) : array( 'region' => '', 'locality' => '' );
			if ( empty($addr['streetAddress']) && is_string($street) && trim($street) !== '' ) { $addr['streetAddress'] = trim($street); }
			if ( empty($addr['addressLocality']) && is_string($locality) && trim($locality) !== '' ) { $addr['addressLocality'] = trim($locality); }
			if ( empty($addr['addressRegion']) && is_string($region) && trim($region) !== '' ) { $addr['addressRegion'] = trim($region); }
			if ( empty($addr['addressLocality']) && ! empty($parts['locality']) ) { $addr['addressLocality'] = $parts['locality']; }
			if ( empty($addr['addressRegion']) && ! empty($parts['region']) ) { $addr['addressRegion'] = $parts['region']; }
			if ( empty($addr['streetAddress']) && empty($addr['addressLocality']) && empty($addr['addressRegion']) ) {
				return array( '@type' => 'PostalAddress', 'addressCountry' => 'KR' );
			}
			return $addr;
		}
	}
	if ( ! function_exists( 'redue_infer_page_schema_type' ) ) {
		function redue_infer_page_schema_type( $hay, $is_medical = false ) {
			$h = is_string($hay) ? $hay : '';
			if ( preg_match('/wr_id=/i', $h) ) { return 'Article'; }
			if ( ( preg_match('/board\.php/i', $h) && preg_match('/bo_table=/i', $h) ) || preg_match('/[?&]bo_table=/i', $h) ) { return 'CollectionPage'; }
			if ( preg_match('/content\.php|[?&]co_id=/i', $h) ) { return 'AboutPage'; }
			if ( preg_match('/의료진|프로필|원장진|전문의|강사진|임원|doctor|staff|\bteam\b|의료\s*진/ui', $h) ) { return 'ProfilePage'; }
			if ( preg_match('/연락처|문의|오시는|찾아오시는|견적|상담|지점|contact|location|map\.php/ui', $h) ) { return 'ContactPage'; }
			if ( preg_match('/소개|인사말|시설|장비|둘러보기|철학|연혁|about|company|greeting|조직도|개요|facility|equipment/ui', $h) ) { return 'AboutPage'; }
			if ( $is_medical && preg_match('/진료|수술|시술|치료|질환|암종|암치료|서비스/ui', $h) && ! preg_match('/서비스\s*소개/ui', $h) ) { return 'MedicalWebPage'; }
			if ( $is_medical && preg_match('/(?:^|[\/\\])((?:ultra|s|sub|page)?\d{2,}|[a-z]{1,12}\d{2,})\.php/i', $h) ) {
				return 'MedicalWebPage';
			}
			return 'WebPage';
		}
	}
	if ( ! function_exists( 'redue_resolve_site_name' ) ) {
		function redue_resolve_site_name() {
			if ( isset($GLOBALS['config']['cf_title']) && is_string($GLOBALS['config']['cf_title']) && trim($GLOBALS['config']['cf_title']) !== '' ) {
				return trim(strip_tags($GLOBALS['config']['cf_title']));
			}
			if ( function_exists('get_bloginfo') ) {
				$_wp = get_bloginfo('name');
				if ( is_string($_wp) && trim($_wp) !== '' ) { return trim(strip_tags($_wp)); }
			}
			if ( isset($GLOBALS['g5']['title']) && is_string($GLOBALS['g5']['title']) && trim($GLOBALS['g5']['title']) !== '' ) {
				return trim(strip_tags($GLOBALS['g5']['title']));
			}
			if ( isset($GLOBALS['g5_head_title']) && is_string($GLOBALS['g5_head_title']) && trim($GLOBALS['g5_head_title']) !== '' ) {
				return trim(strip_tags($GLOBALS['g5_head_title']));
			}
			if ( class_exists('Context') && method_exists('Context', 'get') ) {
				$_rx = @Context::get('site_title');
				if ( is_string($_rx) && trim($_rx) !== '' ) { return trim(strip_tags($_rx)); }
				$_rx = @Context::get('site_module_info');
				if ( is_object($_rx) && ! empty($_rx->browser_title) ) { return trim(strip_tags((string) $_rx->browser_title)); }
			}
			$_host = '';
			if ( ! empty($_SERVER['HTTP_HOST']) ) { $_host = (string) $_SERVER['HTTP_HOST']; }
			elseif ( ! empty($_SERVER['SERVER_NAME']) ) { $_host = (string) $_SERVER['SERVER_NAME']; }
			$_host = preg_replace('#^https?://#i', '', $_host);
			$_host = preg_replace('#:\d+$#', '', $_host);
			return $_host !== '' ? $_host : '웹사이트';
		}
	}
	if ( ! function_exists( 'redue_normalize_rep_title' ) ) {
		function redue_normalize_rep_title( $raw ) {
			$t = trim((string) $raw);
			if ( $t === '' ) { return ''; }
			if ( preg_match('/^c\.?e\.?o\.?$/i', $t) ) { return 'CEO'; }
			if ( $t === '대표자명' ) { return '대표자'; }
			return $t;
		}
	}
	if ( ! function_exists( 'redue_is_valid_rep_name' ) ) {
		function redue_is_valid_rep_name( $name ) {
			$name = trim((string) $name);
			if ( $name === '' || ! preg_match('/^[가-힣]{2,4}$/u', $name) ) { return false; }
			if ( preg_match('/^(사진|이미지|로고|서명|사인|프로필|안내|소개|배너|비주얼|썸네일|아이콘|의료진|연구팀)$/u', $name) ) { return false; }
			if ( preg_match('/병원|연구소|센터|안내|소개|진료안내|고객센터|상담실|의료진|연구팀/u', $name) ) { return false; }
			if ( preg_match('/^(대표원장|대표자명?|원장|수의사|의료진|대표이사|이사장|대표)$/u', $name) ) { return false; }
			return true;
		}
	}
	if ( ! function_exists( 'redue_parse_rep_from_text' ) ) {
		function redue_parse_rep_from_text( $text ) {
			$text = trim(preg_replace('/\s+/u', ' ', html_entity_decode((string) $text, ENT_QUOTES, 'UTF-8')));
			if ( $text === '' ) { return null; }
			if ( preg_match('/(?:대표원장|원장|대표이사|대표|CEO|이사장)\s*([가-힣]{2,4})/u', $text, $m) && redue_is_valid_rep_name($m[1]) ) {
				preg_match('/(대표원장|원장|대표이사|대표|CEO|이사장)/u', $m[0], $t);
				return array('name' => trim($m[1]), 'title' => redue_normalize_rep_title(isset($t[1]) ? $t[1] : ''));
			}
			if ( preg_match('/([가-힣]{2,4})\s*(?:대표원장|원장|대표이사|대표)/u', $text, $m) && redue_is_valid_rep_name($m[1]) ) {
				preg_match('/(대표원장|원장|대표이사|대표)/u', $m[0], $t);
				return array('name' => trim($m[1]), 'title' => redue_normalize_rep_title(isset($t[1]) ? $t[1] : ''));
			}
			return null;
		}
	}
	if ( ! function_exists( 'redue_parse_rep_from_filename' ) ) {
		function redue_parse_rep_from_filename( $src ) {
			$path = preg_replace('/[?#].*$/', '', (string) $src);
			$base = basename(str_replace('\\', '/', $path));
			$stem = preg_replace('/\.[a-z0-9]+$/i', '', $base);
			$decoded = is_string($stem) ? $stem : '';
			if ( function_exists('rawurldecode') ) {
				$try = @rawurldecode($decoded);
				if ( is_string($try) && $try !== '' ) { $decoded = $try; }
			}
			if ( preg_match('/(?:sign|ceo|director|rep)[_-]?([가-힣]{2,4}|[a-zA-Z]+)/i', $decoded, $m) && redue_is_valid_rep_name($m[1]) ) {
				return array('name' => trim($m[1]), 'title' => '');
			}
			if ( preg_match('/([가-힣]{2,4})/u', $decoded, $m) && redue_is_valid_rep_name($m[1]) ) {
				return array('name' => trim($m[1]), 'title' => '');
			}
			return null;
		}
	}
	if ( ! function_exists( 'redue_extract_rep_from_imgs' ) ) {
		function redue_extract_rep_from_imgs( $html ) {
			if ( ! is_string($html) || $html === '' ) { return null; }
			if ( ! preg_match_all('/<img\b([^>]*)>/i', $html, $imgs, PREG_SET_ORDER) ) { return null; }
			foreach ( $imgs as $img ) {
				$attrs = $img[1];
				foreach ( array('alt', 'title') as $attr ) {
					if ( preg_match('/\b' . $attr . '\s*=\s*(["\'])([^"\']*)\1/i', $attrs, $am) ) {
						$hit = redue_parse_rep_from_text(trim($am[2]));
						if ( $hit ) { return $hit; }
					}
				}
				$src = '';
				if ( preg_match('/\bsrc\s*=\s*(["\'])([^"\']*)\1/i', $attrs, $sm) ) { $src = $sm[2]; }
				elseif ( preg_match('/\bdata-src\s*=\s*(["\'])([^"\']*)\1/i', $attrs, $sm) ) { $src = $sm[2]; }
				if ( $src !== '' ) {
					$hit = redue_parse_rep_from_filename($src);
					if ( $hit ) { return $hit; }
				}
			}
			return null;
		}
	}
	if ( ! function_exists( 'redue_extract_nearby_rep' ) ) {
		function redue_extract_nearby_rep( $html, $offset, $window = 480 ) {
			$start = max(0, (int) $offset - (int) $window);
			$slice = substr((string) $html, $start, ((int) $window * 2) + 120);
			if ( preg_match_all('/<(h[1-6]|p|strong|b|em|span)[^>]*>([^<]{2,48})<\/\1>/iu', $slice, $ms, PREG_SET_ORDER) ) {
				foreach ( $ms as $m ) {
					$hit = redue_parse_rep_from_text($m[2]);
					if ( $hit ) { return $hit; }
				}
			}
			$plain = function_exists('redue_plain_text') ? redue_plain_text($slice) : trim(strip_tags($slice));
			return redue_parse_rep_from_text($plain);
		}
	}
	if ( ! function_exists( 'redue_compose_rep_img_alt' ) ) {
		function redue_compose_rep_img_alt( $site_name, $name, $title ) {
			$parts = array();
			foreach ( array($site_name, $name, redue_normalize_rep_title($title)) as $p ) {
				$p = trim((string) $p);
				if ( $p !== '' && ! in_array($p, $parts, true) ) { $parts[] = $p; }
			}
			return trim(implode(' ', $parts));
		}
	}
	if ( ! function_exists( 'redue_bind_rep_globals' ) ) {
		function redue_bind_rep_globals( $name, $title ) {
			$name = trim((string) $name);
			$title = redue_normalize_rep_title($title);
			if ( $name === '' || ! redue_is_valid_rep_name($name) ) { return; }
			if ( empty($GLOBALS['redue_rep_name']) || ! is_string($GLOBALS['redue_rep_name']) || trim($GLOBALS['redue_rep_name']) === '' ) {
				$GLOBALS['redue_rep_name'] = $name;
			}
			if ( $title !== '' && ( empty($GLOBALS['redue_rep_title']) || ! is_string($GLOBALS['redue_rep_title']) || trim($GLOBALS['redue_rep_title']) === '' ) ) {
				$GLOBALS['redue_rep_title'] = $title;
			}
		}
	}

	if ( ! function_exists( 'redue_resolve_rep_identity' ) ) {
		function redue_resolve_rep_identity() {
			$name = '';
			$title = '';
			if ( isset($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) ) {
				$name = trim($GLOBALS['redue_rep_name']);
			}
			if ( isset($GLOBALS['redue_rep_title']) && is_string($GLOBALS['redue_rep_title']) ) {
				$title = function_exists('redue_normalize_rep_title') ? redue_normalize_rep_title($GLOBALS['redue_rep_title']) : trim($GLOBALS['redue_rep_title']);
			}
			if ( $name === '' && isset($GLOBALS['config']['cf_admin_name']) && is_string($GLOBALS['config']['cf_admin_name']) ) {
				$_admin = trim(strip_tags($GLOBALS['config']['cf_admin_name']));
				if ( $_admin !== '' && function_exists('redue_is_valid_rep_name') && redue_is_valid_rep_name($_admin) ) {
					$name = $_admin;
				} elseif ( $_admin !== '' && preg_match('/^[가-힣]{2,4}$/u', $_admin) ) {
					$name = $_admin;
				}
			}
			if ( $name === '' || $title === '' ) {
				$blob = function_exists('redue_scan_site_file_corpus') ? redue_scan_site_file_corpus() : '';
				$hit = function_exists('redue_parse_rep_from_text') ? redue_parse_rep_from_text($blob) : null;
				if ( is_array($hit) ) {
					if ( $name === '' && ! empty($hit['name']) ) { $name = (string) $hit['name']; }
					if ( $title === '' && ! empty($hit['title']) ) { $title = (string) $hit['title']; }
				}
			}
			return array('name' => $name, 'title' => $title);
		}
	}
	if ( ! function_exists( 'redue_img_alt_from_src' ) ) {
		function redue_img_alt_from_src( $src, $site_name, $page_name ) {
			$path = preg_replace('/[?#].*$/', '', (string) $src);
			$base = basename(str_replace('\\', '/', $path));
			$stem = preg_replace('/\.[a-z0-9]+$/i', '', $base);
			$stem = is_string($stem) ? $stem : '';
			$decoded = $stem;
			if ( function_exists('rawurldecode') ) {
				$try = @rawurldecode($stem);
				if ( is_string($try) && $try !== '' ) { $decoded = $try; }
			}
			if ( preg_match('/logo|로고/i', $decoded) ) {
				return $site_name . ' 로고';
			}
			if ( preg_match('/^(sub\d+|s?\d{2,4})(_\d+)?$/i', $decoded) || preg_match('/banner|visual|main[_-]?img|bg[_-]?/i', $decoded) ) {
				return ($page_name !== '' ? $page_name : $site_name) . ' 안내 이미지';
			}
			$label = trim(preg_replace('/[-_]+/', ' ', $decoded));
			if ( $label !== '' && ! preg_match('/^[a-z0-9]{1,3}$/i', $label) && function_exists('mb_strlen') && mb_strlen($label, 'UTF-8') >= 2 ) {
				return $site_name . ' ' . $label . ' 이미지';
			}
			return trim($site_name . ' ' . $page_name . ' 안내 이미지');
		}
	}
	if ( ! function_exists( 'redue_transform_img_alts' ) ) {
		function redue_transform_img_alts( $buffer, $site_name, $page_name ) {
			if ( ! is_string($buffer) || $buffer === '' ) { return $buffer; }
			if ( ! preg_match_all('/<img\b([^>]*?)(\/?)>/i', $buffer, $all, PREG_SET_ORDER | PREG_OFFSET_CAPTURE) ) {
				return $buffer;
			}
			$out = '';
			$last = 0;
			foreach ( $all as $m ) {
				$full = $m[0][0];
				$pos = (int) $m[0][1];
				$attrs = $m[1][0];
				$slash = $m[2][0];
				$out .= substr($buffer, $last, $pos - $last);
				$existing = '';
				if ( preg_match('/\balt\s*=\s*(["\'])([^"\']*)\1/i', $attrs, $am) ) {
					$existing = trim($am[2]);
				}
				if ( $existing !== '' ) {
					if ( function_exists('redue_parse_rep_from_text') && function_exists('redue_bind_rep_globals') ) {
						$exist_hit = redue_parse_rep_from_text($existing);
						if ( is_array($exist_hit) ) { redue_bind_rep_globals($exist_hit['name'], $exist_hit['title']); }
					}
					$out .= $full;
					$last = $pos + strlen($full);
					continue;
				}
				$src = '';
				if ( preg_match('/\bsrc\s*=\s*(["\'])([^"\']*)\1/i', $attrs, $sm) ) { $src = $sm[2]; }
				$title = '';
				if ( preg_match('/\btitle\s*=\s*(["\'])([^"\']+)\1/i', $attrs, $tm) ) {
					$title = trim($tm[2]);
				} elseif ( preg_match('/\baria-label\s*=\s*(["\'])([^"\']+)\1/i', $attrs, $tm) ) {
					$title = trim($tm[2]);
				}
				$alt = '';
				$rep_hit = null;
				if ( function_exists('redue_extract_nearby_rep') ) {
					$rep_hit = redue_extract_nearby_rep($buffer, $pos);
				}
				if ( ! is_array($rep_hit) && $title !== '' && function_exists('redue_parse_rep_from_text') ) {
					$rep_hit = redue_parse_rep_from_text($title);
				}
				if ( ! is_array($rep_hit) && $src !== '' && function_exists('redue_parse_rep_from_filename') ) {
					$rep_hit = redue_parse_rep_from_filename($src);
				}
				if ( is_array($rep_hit) && ! empty($rep_hit['name']) ) {
					if ( function_exists('redue_bind_rep_globals') ) {
						redue_bind_rep_globals($rep_hit['name'], isset($rep_hit['title']) ? $rep_hit['title'] : '');
					}
					$alt = function_exists('redue_compose_rep_img_alt')
						? redue_compose_rep_img_alt($site_name, $rep_hit['name'], isset($rep_hit['title']) ? $rep_hit['title'] : '')
						: trim($site_name . ' ' . $rep_hit['name'] . ' ' . (isset($rep_hit['title']) ? $rep_hit['title'] : ''));
				}
				if ( $alt === '' && $title !== '' ) { $alt = $title; }
				if ( $alt === '' && ! empty($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) && preg_match('/sign|ceo|director|rep|원장|대표/i', $src) ) {
					$alt = function_exists('redue_compose_rep_img_alt')
						? redue_compose_rep_img_alt($site_name, $GLOBALS['redue_rep_name'], isset($GLOBALS['redue_rep_title']) ? $GLOBALS['redue_rep_title'] : '')
						: trim($site_name . ' ' . $GLOBALS['redue_rep_name']);
				}
				if ( $alt === '' ) { $alt = redue_img_alt_from_src($src, $site_name, $page_name); }
				$alt = trim($alt);
				if ( $alt === '' ) { $alt = $site_name . ' 이미지'; }
				$alt_esc = htmlspecialchars($alt, ENT_QUOTES, 'UTF-8');
				if ( preg_match('/\balt\s*=\s*(["\'])[^"\']*\1/i', $attrs) ) {
					$attrs = preg_replace('/\balt\s*=\s*(["\'])[^"\']*\1/i', 'alt="' . $alt_esc . '"', $attrs, 1);
				} elseif ( preg_match('/\balt\s*=/i', $attrs) ) {
					$attrs = preg_replace('/\balt\s*=\s*[^\s>]*/i', 'alt="' . $alt_esc . '"', $attrs, 1);
				} else {
					$attrs = rtrim($attrs) . ' alt="' . $alt_esc . '"';
				}
				$out .= '<img' . $attrs . $slash . '>';
				$last = $pos + strlen($full);
			}
			$out .= substr($buffer, $last);
			return $out;
		}
	}
	if ( ! function_exists( 'redue_optimize_document_title' ) ) {
		function redue_optimize_document_title( $buffer, $site_name, $page_name, $is_main ) {
			$has_title = preg_match('/<title\b[^>]*>([\s\S]*?)<\/title>/i', $buffer, $tm);
			$current = $has_title ? trim(html_entity_decode(strip_tags($tm[1]), ENT_QUOTES, 'UTF-8')) : '';
			$len = function_exists('mb_strlen') ? mb_strlen($current, 'UTF-8') : strlen($current);
			if ( $len >= 10 && $len <= 60 ) { return $buffer; }
			if ( $len < 10 ) {
				if ( $is_main ) {
					$new = $site_name . ' — 공식 안내 및 전문 서비스';
				} else {
					$page = ( $page_name !== '' && $page_name !== $site_name ) ? $page_name : '안내';
					$new = $page . ' | ' . $site_name . ' 공식';
				}
				$new_len_soft = function_exists('mb_strlen') ? mb_strlen($new, 'UTF-8') : strlen($new);
				if ( $new_len_soft > 35 ) {
					$new = function_exists('mb_substr') ? mb_substr($new, 0, 35, 'UTF-8') : substr($new, 0, 35);
				}
			} else {
				$new = $current;
			}
			$new_len = function_exists('mb_strlen') ? mb_strlen($new, 'UTF-8') : strlen($new);
			if ( $new_len > 60 ) {
				$new = function_exists('mb_substr') ? mb_substr($new, 0, 60, 'UTF-8') : substr($new, 0, 60);
			}
			$new_esc = htmlspecialchars(trim($new), ENT_QUOTES, 'UTF-8');
			if ( $has_title ) {
				return preg_replace('/<title\b[^>]*>[\s\S]*?<\/title>/i', '<title>' . $new_esc . '</title>', $buffer, 1);
			}
			if ( preg_match('/(<head\b[^>]*>)/i', $buffer) ) {
				return preg_replace('/(<head\b[^>]*>)/i', '$1<title>' . $new_esc . '</title>', $buffer, 1);
			}
			return $buffer;
		}
	}
	if ( ! function_exists( 'redue_echo_canonical_pair' ) ) {
		function redue_echo_canonical_pair() {
			static $done = false;
			if ( $done ) { return; }
			$url = '';
			if ( function_exists('redue_get_exact_canonical') ) {
				$url = redue_get_exact_canonical();
			} elseif ( isset($GLOBALS['exact_canonical_url']) && is_string($GLOBALS['exact_canonical_url']) ) {
				$url = $GLOBALS['exact_canonical_url'];
			} elseif ( isset($GLOBALS['redue_canonical_url']) && is_string($GLOBALS['redue_canonical_url']) ) {
				$url = $GLOBALS['redue_canonical_url'];
			}
			if ( ! is_string($url) || $url === '' ) { return; }
			$done = true;
			$esc = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
			$origin = preg_replace('#^(https?://[^/]+).*#', '$1', $url);
			if ( ! is_string($origin) || $origin === '' ) { $origin = $url; }
			$llms_href = htmlspecialchars(rtrim($origin, '/') . '/llms.txt', ENT_QUOTES, 'UTF-8');
			echo '<!-- REDUE v30 PRECISION SEO START — SEO Standard Canonical Pair (Bot Optimized Top Position) -->' . "\n";
			echo '<link rel="canonical" href="' . $esc . '">' . "\n";
			echo '<meta property="og:url" content="' . $esc . '">' . "\n";
			echo '<link rel="help" type="text/markdown" href="' . $llms_href . '" title="LLMs Context">' . "\n";
			echo '<link rel="alternate" type="text/markdown" href="' . $llms_href . '">' . "\n";
			if ( isset($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) && trim($GLOBALS['redue_rep_name']) !== '' ) {
				$rep_esc = htmlspecialchars(trim($GLOBALS['redue_rep_name']), ENT_QUOTES, 'UTF-8');
				echo '<meta name="author" content="' . $rep_esc . '">' . "\n";
				echo '<meta name="representative" content="' . $rep_esc . '">' . "\n";
			}
			echo '<!-- REDUE v30 PRECISION SEO END -->' . "\n";
		}
	}
	if ( ! function_exists( 'redue_collect_page_body_html' ) ) {
		function redue_collect_page_body_html() {
			global $view, $write, $co;
			$html = '';
			if ( isset($view) && is_array($view) && ! empty($view['wr_content']) && is_string($view['wr_content']) ) {
				$html .= ' ' . $view['wr_content'];
			}
			if ( isset($write) && is_array($write) && ! empty($write['wr_content']) && is_string($write['wr_content']) ) {
				$html .= ' ' . $write['wr_content'];
			}
			if ( isset($co) && is_array($co) && ! empty($co['co_content']) && is_string($co['co_content']) ) {
				$html .= ' ' . $co['co_content'];
			}
			if ( isset($GLOBALS['schema_page_html']) && is_string($GLOBALS['schema_page_html']) ) {
				$html .= ' ' . $GLOBALS['schema_page_html'];
			}
			return $html;
		}
	}
	if ( ! function_exists( 'redue_extract_faq_items' ) ) {
		function redue_extract_faq_items( $html ) {
			$out = array();
			if ( ! is_string($html) || trim($html) === '' ) { return $out; }
			$seen = array();
			if ( preg_match_all('/<dt[^>]*>([\s\S]{4,160})<\/dt>\s*<dd[^>]*>([\s\S]{4,400})<\/dd>/i', $html, $m, PREG_SET_ORDER) ) {
				foreach ( $m as $row ) {
					$q = function_exists('redue_plain_text') ? redue_plain_text($row[1]) : trim(strip_tags($row[1]));
					$a = function_exists('redue_plain_text') ? redue_plain_text($row[2]) : trim(strip_tags($row[2]));
					if ( $q === '' || $a === '' || isset($seen[$q]) ) { continue; }
					$seen[$q] = true;
					$out[] = array('q' => $q, 'a' => $a);
					if ( count($out) >= 8 ) { return $out; }
				}
			}
			if ( preg_match_all('/<details[^>]*>\s*<summary[^>]*>([\s\S]{4,160})<\/summary>([\s\S]{4,400})<\/details>/i', $html, $m, PREG_SET_ORDER) ) {
				foreach ( $m as $row ) {
					$q = function_exists('redue_plain_text') ? redue_plain_text($row[1]) : trim(strip_tags($row[1]));
					$a = function_exists('redue_plain_text') ? redue_plain_text($row[2]) : trim(strip_tags($row[2]));
					if ( $q === '' || $a === '' || isset($seen[$q]) ) { continue; }
					$seen[$q] = true;
					$out[] = array('q' => $q, 'a' => $a);
					if ( count($out) >= 8 ) { return $out; }
				}
			}
			$plain = function_exists('redue_plain_text') ? redue_plain_text($html) : trim(strip_tags($html));
			if ( is_string($plain) && $plain !== '' && preg_match_all('/(?:Q|질문)\s*[.).:]?\s*(.{6,80}?)\s*(?:A|답변)\s*[.).:]?\s*(.{8,200})/ui', $plain, $m, PREG_SET_ORDER) ) {
				foreach ( $m as $row ) {
					$q = trim($row[1]);
					$a = trim($row[2]);
					if ( $q === '' || $a === '' || isset($seen[$q]) ) { continue; }
					$seen[$q] = true;
					$out[] = array('q' => $q, 'a' => $a);
					if ( count($out) >= 8 ) { break; }
				}
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_extract_howto_steps' ) ) {
		function redue_extract_howto_steps( $html ) {
			$steps = array();
			if ( ! is_string($html) || trim($html) === '' ) { return $steps; }
			if ( ! preg_match('/예약|내원|방문|접수|절차|단계|step|howto/ui', $html) ) { return $steps; }
			if ( preg_match_all('/<li[^>]*>([\s\S]{8,180})<\/li>/i', $html, $m) ) {
				foreach ( $m[1] as $raw ) {
					$text = function_exists('redue_plain_text') ? redue_plain_text($raw) : trim(strip_tags($raw));
					if ( ! is_string($text) ) { continue; }
					$len = function_exists('mb_strlen') ? mb_strlen($text, 'UTF-8') : strlen($text);
					if ( $len < 6 || $len > 180 ) { continue; }
					$name = function_exists('mb_substr') ? mb_substr($text, 0, 40, 'UTF-8') : substr($text, 0, 40);
					$steps[] = array(
						'position' => count($steps) + 1,
						'name' => $name,
						'text' => $text,
					);
					if ( count($steps) >= 6 ) { break; }
				}
			}
			return $steps;
		}
	}

	if ( ! function_exists( 'redue_jsonld_flags' ) ) {
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
	if ( ! function_exists( 'redue_is_medical_schema_type' ) ) {
		function redue_is_medical_schema_type( $types ) {
			if ( is_string($types) ) { $types = array($types); }
			if ( ! is_array($types) ) { return false; }
			$_med = array('MedicalClinic', 'Physician', 'Hospital', 'Dentist', 'VeterinaryCare', 'Pharmacy', 'MedicalBusiness');
			foreach ( $types as $_t ) {
				if ( in_array((string) $_t, $_med, true) ) { return true; }
			}
			return false;
		}
	}
	if ( ! function_exists( 'redue_resolve_service_item_type' ) ) {
		function redue_resolve_service_item_type( $explicit, $is_medical = false ) {
			$_raw = is_string($explicit) ? trim($explicit) : '';
			if ( $_raw === 'MedicalProcedure' || $_raw === 'Service' ) { return $_raw; }
			return $is_medical ? 'MedicalProcedure' : 'Service';
		}
	}
	if ( ! function_exists( 'redue_resolve_service_catalog_source' ) ) {
		function redue_resolve_service_catalog_source() {
			if ( isset($GLOBALS['redue_service_catalog']) && is_array($GLOBALS['redue_service_catalog']) && count($GLOBALS['redue_service_catalog']) > 0 ) {
				return $GLOBALS['redue_service_catalog'];
			}
			if ( isset($GLOBALS['redue_services']) && is_array($GLOBALS['redue_services']) && count($GLOBALS['redue_services']) > 0 ) {
				return $GLOBALS['redue_services'];
			}
			return array();
		}
	}
	if ( ! function_exists( 'redue_normalize_service_nodes' ) ) {
		function redue_normalize_service_nodes( $services, $is_medical = false ) {
			$out = array();
			if ( ! is_array($services) || count($services) === 0 ) { return $out; }
			$_seen = array();
			foreach ( $services as $_svc ) {
				if ( is_string($_svc) ) {
					$_name = trim($_svc);
					if ( $_name === '' ) { continue; }
					$_key = strtolower($_name);
					if ( isset($_seen[$_key]) ) { continue; }
					$_seen[$_key] = true;
					$out[] = array('@type' => redue_resolve_service_item_type('', $is_medical), 'name' => $_name);
					continue;
				}
				if ( ! is_array($_svc) ) { continue; }
				$_name = '';
				if ( ! empty($_svc['name']) ) { $_name = trim((string) $_svc['name']); }
				elseif ( ! empty($_svc['itemOffered']) && is_array($_svc['itemOffered']) && ! empty($_svc['itemOffered']['name']) ) {
					$_name = trim((string) $_svc['itemOffered']['name']);
				}
				if ( $_name === '' ) { continue; }
				$_key = strtolower($_name);
				if ( isset($_seen[$_key]) ) { continue; }
				$_seen[$_key] = true;
				$_explicit = '';
				if ( ! empty($_svc['type']) && is_string($_svc['type']) ) { $_explicit = trim($_svc['type']); }
				elseif ( ! empty($_svc['@type']) && is_string($_svc['@type']) ) { $_explicit = trim((string) $_svc['@type']); }
				$_node = array(
					'@type' => redue_resolve_service_item_type($_explicit, $is_medical),
					'name' => $_name,
				);
				if ( ! empty($_svc['category']) && is_string($_svc['category']) && trim($_svc['category']) !== '' ) {
					$_node['category'] = trim($_svc['category']);
				}
				if ( ! empty($_svc['description']) && is_string($_svc['description']) && trim($_svc['description']) !== '' ) {
					$_node['description'] = trim($_svc['description']);
				}
				if ( ! empty($_svc['url']) && is_string($_svc['url']) ) {
					$_node['url'] = function_exists('redue_align_url_protocol')
						? redue_align_url_protocol($_svc['url'])
						: $_svc['url'];
				}
				$out[] = $_node;
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_bind_dual_service_catalog' ) ) {
		function redue_bind_dual_service_catalog( &$org_node, $services ) {
			if ( ! is_array($org_node) ) { return; }
			if ( ! is_array($services) || count($services) === 0 ) {
				unset($org_node['availableService'], $org_node['hasOfferCatalog']);
				return;
			}
			$_offers = array();
			foreach ( $services as $_item ) {
				if ( ! is_array($_item) || empty($_item['name']) ) { continue; }
				$_offers[] = array('@type' => 'Offer', 'itemOffered' => $_item);
			}
			if ( count($_offers) === 0 ) {
				unset($org_node['availableService'], $org_node['hasOfferCatalog']);
				return;
			}
			$org_node['availableService'] = $services;
			$org_node['hasOfferCatalog'] = array(
				'@type' => 'OfferCatalog',
				'name' => '주요 서비스 및 진료 카탈로그',
				'itemListElement' => $_offers,
			);
		}
	}
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
			if ( isset($GLOBALS['redue_lat']) && is_string($GLOBALS['redue_lat']) && preg_match('/^-?\d+(\.\d+)?$/', trim($GLOBALS['redue_lat'])) ) {
				$latitude = trim($GLOBALS['redue_lat']);
			}
			if ( isset($GLOBALS['redue_lng']) && is_string($GLOBALS['redue_lng']) && preg_match('/^-?\d+(\.\d+)?$/', trim($GLOBALS['redue_lng'])) ) {
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
			$digits = preg_replace('/\D/', '', $raw);
			if ( ! is_string($digits) || $digits === '' ) { return true; }
			if ( preg_match('/^0+$/', $digits) || preg_match('/^(\d)\1+$/', $digits) ) { return true; }
			$_hyphen = preg_replace('/\s+/', '', $raw);
			return in_array($_hyphen, array('050-0000-0000', '02-0000-0000', '000-000-0000', '000-0000-0000', '000-00-00000', '111-11-11111'), true);
		}
	}
	if ( ! function_exists( 'redue_tax_id_checksum_ok' ) ) {
		function redue_tax_id_checksum_ok( $raw ) {
			$digits = preg_replace('/\D/', '', (string) $raw);
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
			$digits = preg_replace('/\D/', '', $raw);
			if ( ! is_string($digits) || strlen($digits) !== 10 ) { return ''; }
			$hyphen = substr($digits, 0, 3) . '-' . substr($digits, 3, 2) . '-' . substr($digits, 5);
			if ( function_exists('redue_tax_id_checksum_ok') && redue_tax_id_checksum_ok($digits) ) { return $hyphen; }
			if ( $labeled && preg_match('/^\d{3}-\d{2}-\d{5}$/', preg_replace('/\s+/', '', $raw)) ) { return $hyphen; }
			return '';
		}
	}
	if ( ! function_exists( 'redue_is_catalog_stopword' ) ) {
		function redue_is_catalog_stopword( $name ) {
			$n = trim((string) $name);
			if ( $n === '' ) { return true; }
			$_fold = strtolower(preg_replace('/\s+/u', '', $n));
			$_stops = array('홈', '메인', 'home', '소개', 'about', 'contact', '문의', '예약', '로그인', '회원가입', '사이트맵', '이용약관', '개인정보처리방침', '개인정보취급방침', '더보기', '바로가기', '오시는길', '찾아오시는길', '인사말', '공지사항', '게시판', '커뮤니티', '갤러리', '위치', '안내', '병원소개', '원장소개', '의료진소개');
			foreach ( $_stops as $_s ) {
				if ( $_fold === strtolower(preg_replace('/\s+/u', '', $_s)) ) { return true; }
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
			if ( ! preg_match_all('/<a\b[^>]*\bhref=["\']([^"\']+)["\']/i', $html, $mm) ) { return $out; }
			foreach ( $mm[1] as $_href ) {
				$_href = trim((string) $_href);
				if ( $_href === '' || ! preg_match('#^https?://#i', $_href) ) { continue; }
				if ( ! preg_match('#(place\.naver\.com|m\.place\.naver\.com|map\.naver\.com|blog\.naver\.com|place\.map\.kakao\.com|map\.kakao\.com|maps\.google\.com|goo\.gl/maps|instagram\.com|facebook\.com|youtube\.com|youtu\.be|tiktok\.com|twitter\.com|x\.com)#i', $_href) ) { continue; }
				if ( preg_match('#sharer\.php|/share(?:r)?(?:[?/]|$)|intent/tweet|[?&](?:u|url)=#i', $_href) ) { continue; }
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
			$base = preg_replace('/\.(php|html?|htm)$/i', '', basename((string) $file));
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

	if ( ! function_exists( 'redue_strip_duplicate_canonicals' ) ) {
		function redue_strip_duplicate_canonicals( $buffer ) {
			$buffer = preg_replace('/<link\b(?=[^>]*\brel\s*=\s*["\']?canonical["\']?)[^>]*>\s*(?:<\/link>)?/is', '', $buffer);
			$buffer = preg_replace('/<meta\b(?=[^>]*\bproperty\s*=\s*["\']og:url["\'])[^>]*>\s*/i', '', $buffer);
			$buffer = preg_replace('/^[ \t]*">[ \t]*\r?\n/m', '', $buffer);
			$buffer = preg_replace('/<!--\s*REDUE v30 PRECISION SEO START[\s\S]*?REDUE v30 PRECISION SEO END\s*-->\s*/i', '', $buffer);
			return $buffer;
		}
	}

	// 1. 그누보드 전역변수 기반 동적 Canonical URL 추출 (수동 정제)
	//    path가 / 이어도 $_GET(bo_table 등)이 있으면 서브/게시판 — /index.php 단독은 / 로 정제
	//    REQUEST_URI + SCRIPT_NAME 이중 감지로 진단봇 경로 유실 복구
	if ( ! function_exists( 'redue_get_exact_canonical' ) ) {
		function redue_get_exact_canonical() {
			// 0) 실제 작동 프로토콜만 사용 — SSL 미설치 사이트에 https:// 강제 금지 (Mixed Content 방지)
			$site_domain = function_exists('redue_site_origin') ? redue_site_origin() : '';
			if ( $site_domain === '' ) {
				$proto = function_exists('redue_detect_site_protocol') ? redue_detect_site_protocol() : 'http';
				$host = '';
				if ( ! empty($_SERVER['HTTP_HOST']) ) { $host = (string) $_SERVER['HTTP_HOST']; }
				elseif ( ! empty($_SERVER['SERVER_NAME']) ) { $host = (string) $_SERVER['SERVER_NAME']; }
				if ( $host === '' ) { $host = 'localhost'; }
				$host = preg_replace('#^https?://#i', '', $host);
				$site_domain = $proto . '://' . $host;
			}

			// 2) 요청 URI 경로 — REQUEST_URI + SCRIPT_NAME 이중 감지 (302.php / 101.php 유실 방지)
			$request_uri = isset($_SERVER['REQUEST_URI']) ? (string)$_SERVER['REQUEST_URI'] : '';
			$parsed_url = $request_uri !== '' ? parse_url($request_uri) : false;
			$page_path = (is_array($parsed_url) && isset($parsed_url['path']) && is_string($parsed_url['path']) && $parsed_url['path'] !== '')
				? $parsed_url['path']
				: '';
			$script_name = isset($_SERVER['SCRIPT_NAME']) ? str_replace('\\', '/', (string)$_SERVER['SCRIPT_NAME']) : '';
			if ( ($page_path === '' || $page_path === '/' || $page_path === '/index.php') && $script_name !== '' && $script_name !== '/' && $script_name !== '/index.php' && substr($script_name, -4) === '.php' ) {
				$page_path = $script_name;
			}
			if ( $page_path === '' ) {
				$page_path = '/';
			}

			// 3) 허용 파라미터 정제 (게시판·내용보기·모바일/페이지 등) — $_GET 우선, REQUEST_URI 쿼리 폴백
			$allowed_params = array('bo_table', 'wr_id', 'co_id', 'idx', 'p', 'page_id', 'id');
			$query_string = '';
			$param_src = array();
			if ( ! empty($_GET) && is_array($_GET) ) {
				$param_src = $_GET;
			} else if ( is_array($parsed_url) && ! empty($parsed_url['query']) ) {
				parse_str($parsed_url['query'], $param_src);
			}
			if ( ! empty($param_src) && is_array($param_src) ) {
				$filtered = array();
				foreach ( $allowed_params as $key ) {
					if ( isset($param_src[$key]) && trim((string)$param_src[$key]) !== '' ) {
						$filtered[$key] = trim((string)$param_src[$key]);
					}
				}
				if ( ! empty($filtered) ) {
					$query_string = '?' . http_build_query($filtered);
				}
			}

			// 4) 메인 vs 서브 동적 판단 — path가 /|/index.php 이어도 query 있으면 서브페이지
			if ( ($page_path === '/' || $page_path === '/index.php' || $page_path === '') && $query_string === '' ) {
				$final_canonical = $site_domain . '/';
			} else {
				// index.php 단독 경로는 / 로 정제 (쿼리 유지: /?bo_table=…)
				if ( $page_path === '/index.php' ) {
					$page_path = '/';
				}
				$final_canonical = $site_domain . $page_path . $query_string;
			}
			return function_exists('redue_align_url_protocol') ? redue_align_url_protocol($final_canonical) : $final_canonical;
		}
	}

	// 2. Bind exact URL — 값만 준비하고 즉시 echo 하지 않음(v33). 실제 출력은
	//    redue_dynamic_schema_controller_body() 안에서 charset 메타 태그 직후 렌더링
	//    호출 시점에만 발생하므로, 이 상수 블록이 문서 최상단에 삽입되어도
	//    화면에는 아무 것도 출력되지 않는다 (상단 덤프 방지).
	if ( function_exists('redue_get_exact_canonical') ) {
		$exact_canonical_url = redue_get_exact_canonical();
		$GLOBALS['exact_canonical_url'] = $exact_canonical_url;
		$GLOBALS['redue_canonical_url'] = $exact_canonical_url;
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller_safe' ) ) {
	function redue_dynamic_schema_controller_safe() {
		static $executed = false;
		if ( $executed ) return;
		$executed = true;
		try {
			if ( function_exists( 'redue_dynamic_schema_controller_body' ) ) {
				redue_dynamic_schema_controller_body();
			}
		} catch (\Exception $_redue_schema_err) {} catch (\Throwable $_redue_schema_err) {}
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller' ) ) {
	function redue_dynamic_schema_controller() {
		redue_dynamic_schema_controller_safe();
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller_body' ) ) {
	function redue_dynamic_schema_controller_body() {
		if ( function_exists( 'redue_auto_detect_footer_info' ) ) {
			redue_auto_detect_footer_info();
		}
		global $config, $g5, $g5_head_title, $bo_table, $wr_id, $co_id, $view, $write, $board;

		$origin = function_exists('redue_site_origin')
			? redue_site_origin()
			: (defined('G5_URL') && G5_URL !== ''
				? rtrim(G5_URL, '/')
				: ((function_exists('redue_detect_site_protocol') ? redue_detect_site_protocol() : 'http') . '://' . preg_replace('#:\d+$#', '', isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost')));
		$site_name = function_exists('redue_resolve_site_name')
			? redue_resolve_site_name()
			: ( ! empty($config['cf_title']) ? trim(strip_tags((string) $config['cf_title'])) : '' );
		if ( $site_name === '' ) { $site_name = '웹사이트'; }
		$canonical_url = function_exists('redue_get_exact_canonical') ? redue_get_exact_canonical() : ($origin . '/');
		$is_main = ($canonical_url === $origin . '/' || $canonical_url === $origin);

		$page_title = $site_name;
		$page_desc = $site_name;
		$page_type = 'WebPage';
		$image_url = isset($GLOBALS['redue_logo']) && is_string($GLOBALS['redue_logo']) && trim($GLOBALS['redue_logo']) !== ''
			? trim($GLOBALS['redue_logo'])
			: '';
		$domain_host = parse_url($origin, PHP_URL_HOST);
		if ( ! is_string($domain_host) || $domain_host === '' ) {
			$domain_host = preg_replace('#^https?://#i', '', $origin);
			$domain_host = preg_replace('#/.*$#', '', $domain_host);
		}
		$opens = '';
		$closes = '';
		$latitude = '';
		$longitude = '';
		$is_accepting_new_patients = false;
		$medical_specialty = array();
		$same_as_extra = array();
		$available_services = array();
		$price_range = '';
		$currencies_accepted = '';
		$payment_accepted = '';

		$same_as_array = array();
		if ( is_array($same_as_extra) ) {
			foreach ( $same_as_extra as $_redue_sa ) {
				if ( ! is_string($_redue_sa) || $_redue_sa === '' ) { continue; }
				if ( function_exists('redue_is_own_site_url') && redue_is_own_site_url($_redue_sa, $origin) ) { continue; }
				if ( ! in_array($_redue_sa, $same_as_array, true) ) {
					$same_as_array[] = $_redue_sa;
				}
			}
		}
		if ( is_array($available_services) ) {
			foreach ( $available_services as &$_svc ) {
				if ( empty($_svc['url']) || ! is_string($_svc['url']) ) { continue; }
				if ( preg_match('#^https?://#i', $_svc['url']) ) {
					$_svc['url'] = function_exists('redue_align_url_protocol') ? redue_align_url_protocol($_svc['url']) : $_svc['url'];
				} else {
					$_svc['url'] = rtrim($origin, '/') . '/' . ltrim($_svc['url'], '/');
				}
			}
			unset($_svc);
		}
		$speakable_spec = array(
			'@type' => 'SpeakableSpecification',
			'cssSelector' => array('meta[name="description"]', 'h1', '.summary', '.faq-answer'),
		);
		if ( ! isset($postal_code) ) { $postal_code = ""; }
		if ( ! isset($street_address) ) { $street_address = isset($GLOBALS['redue_street']) && is_string($GLOBALS['redue_street']) ? trim($GLOBALS['redue_street']) : ""; }
		if ( ! isset($locality) ) { $locality = ""; }
		if ( ! isset($region) ) { $region = ""; }
		if ( ! isset($latitude) ) { $latitude = ""; }
		if ( ! isset($longitude) ) { $longitude = ""; }
		if ( ! isset($opens) ) { $opens = ""; }
		if ( ! isset($closes) ) { $closes = ""; }
		if ( ! isset($available_services) ) { $available_services = array(); }
		if ( ! isset($same_as_array) ) { $same_as_array = array(); }
		if ( ! isset($street_address) ) { $street_address = ""; }
		if ( function_exists('redue_apply_graph_globals') ) {
			redue_apply_graph_globals($latitude, $longitude, $opens, $closes, $available_services, $same_as_array, $street_address);
		}

		$schema_pages = array();
		$knows_about = is_array($medical_specialty) ? $medical_specialty : array();
		if ( count($knows_about) === 0 && is_array($available_services) ) {
			foreach ( $available_services as $_ks ) {
				if ( is_array($_ks) && ! empty($_ks['name']) ) { $knows_about[] = (string) $_ks['name']; }
			}
		}

		$runtime_bo = !empty($bo_table) ? (string) $bo_table : (isset($_GET['bo_table']) ? (string) $_GET['bo_table'] : '');
		$runtime_wr = !empty($wr_id) ? (string) $wr_id : (isset($_GET['wr_id']) ? (string) $_GET['wr_id'] : '');
		$runtime_co = !empty($co_id) ? (string) $co_id : (isset($_GET['co_id']) ? (string) $_GET['co_id'] : '');

		$org_types = function_exists('redue_infer_org_types')
			? redue_infer_org_types()
			: ( ! empty($GLOBALS['redue_org_type']) ? $GLOBALS['redue_org_type'] : array('LocalBusiness', 'Organization') );
		$org_type_hay = is_array($org_types) ? implode(' ', $org_types) : (string) $org_types;
		$is_medical_org = (bool) preg_match('/MedicalClinic|VeterinaryCare|Physician|Hospital|Dentist/i', $org_type_hay);
		$_route_hay = $canonical_url . ' '
			. ( isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '' ) . ' '
			. ( isset($_SERVER['SCRIPT_NAME']) ? (string) $_SERVER['SCRIPT_NAME'] : '' );

		if ( $is_main && $runtime_bo === '' && $runtime_wr === '' && $runtime_co === '' ) {
			$page_title = $site_name;
			$page_desc = function_exists('redue_compose_official_description')
				? redue_compose_official_description($site_name, $site_name, true)
				: ( $site_name . ' 공식 웹사이트입니다.' );
			$page_type = 'WebPage';
		} elseif ( $runtime_wr !== '' && ( !empty($view['wr_subject']) || !empty($write['wr_subject']) ) ) {
			$subj = !empty($view['wr_subject']) ? $view['wr_subject'] : $write['wr_subject'];
			$cont = !empty($view['wr_content']) ? $view['wr_content'] : (isset($write['wr_content']) ? $write['wr_content'] : '');
			$page_title = trim(strip_tags((string) $subj));
			$page_desc = function_exists('redue_summarize_body_text')
				? redue_summarize_body_text($cont, 140)
				: (function_exists('mb_substr') ? mb_substr(trim(preg_replace('/\s+/', ' ', strip_tags((string) $cont))), 0, 140, 'UTF-8') : substr(trim(preg_replace('/\s+/', ' ', strip_tags((string) $cont))), 0, 140));
			if ( $page_desc === '' ) { $page_desc = $page_title; }
			$page_type = 'Article';
		} elseif ( $runtime_bo !== '' ) {
			$page_title = ! empty($board['bo_subject']) ? (string) $board['bo_subject'] : $runtime_bo;
			$page_desc = function_exists('redue_compose_official_description')
				? redue_compose_official_description($site_name, $page_title, false)
				: ( $site_name . ' ' . $page_title . ' 공식 안내입니다.' );
			$page_type = 'CollectionPage';
		} elseif ( $runtime_co !== '' ) {
			$page_title = !empty($g5_head_title) ? (string) $g5_head_title : $runtime_co;
			$page_desc = function_exists('redue_compose_official_description')
				? redue_compose_official_description($site_name, $page_title, false)
				: ( $site_name . ' ' . $page_title . ' 공식 안내입니다.' );
			$page_type = function_exists('redue_infer_page_schema_type')
				? redue_infer_page_schema_type($page_title . ' ' . $_route_hay, $is_medical_org)
				: 'WebPage';
		} elseif ( !empty($g5_head_title) ) {
			$page_title = (string) $g5_head_title;
			$page_desc = function_exists('redue_compose_official_description')
				? redue_compose_official_description($site_name, $page_title, false)
				: ( $site_name . ' ' . $page_title . ' 공식 안내입니다.' );
			$page_type = function_exists('redue_infer_page_schema_type')
				? redue_infer_page_schema_type($page_title . ' ' . $_route_hay, $is_medical_org)
				: 'WebPage';
		}

		$seo_meta_map = array();
		$seo_req = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
		$seo_path = parse_url($seo_req, PHP_URL_PATH);
		$seo_query = parse_url($seo_req, PHP_URL_QUERY);
		$seo_file = basename(is_string($seo_path) && $seo_path !== '' ? $seo_path : '/');
		if ( $seo_file === '' || $seo_file === '/' || $seo_file === '.' ) { $seo_file = 'index.php'; }
		if ( is_string($seo_query) && $seo_query !== '' ) {
			parse_str($seo_query, $seo_qs);
			foreach ( array('bo_table', 'co_id', 'it_id', 'ca_id') as $id_key ) {
				if ( isset($seo_qs[$id_key]) && $seo_qs[$id_key] !== '' && preg_match('/^[a-zA-Z0-9_-]{1,40}$/', (string) $seo_qs[$id_key]) ) {
					$seo_file = $seo_file . '?' . $id_key . '=' . $seo_qs[$id_key];
					break;
				}
			}
		}
		$seo_rel = ltrim(is_string($seo_path) ? $seo_path : '', '/');
		if ( $seo_rel !== '' && isset($seo_meta_map[$seo_rel]) && $seo_meta_map[$seo_rel] !== '' ) {
			$page_desc = $seo_meta_map[$seo_rel];
		} elseif ( isset($seo_meta_map[$seo_file]) && $seo_meta_map[$seo_file] !== '' ) {
			$page_desc = $seo_meta_map[$seo_file];
		} elseif ( $runtime_bo !== '' && isset($seo_meta_map['board.php?bo_table=' . $runtime_bo]) && $seo_meta_map['board.php?bo_table=' . $runtime_bo] !== '' ) {
			$page_desc = $seo_meta_map['board.php?bo_table=' . $runtime_bo];
		}
		$page_file = $seo_file;
		$page_base = $seo_file;
		$gnb_items = array();
		if ( isset($g5['menu_table']) && $g5['menu_table'] !== '' && function_exists('sql_query') && function_exists('sql_fetch_array') ) {
			$sql = " select me_code, me_name, me_link from {$g5['menu_table']} where me_use = '1' order by me_code, me_order, me_id asc ";
			$result = @sql_query($sql, false);
			if ( $result ) {
				$pos = 1;
				while ( $row = sql_fetch_array($result) ) {
					if ( empty($row['me_name']) ) { continue; }
					$m_link = isset($row['me_link']) ? (string) $row['me_link'] : '';
					$m_link = preg_match('#^https?://#i', $m_link) ? $m_link : $origin . '/' . ltrim($m_link, '/');
					$m_link = function_exists('redue_align_url_protocol') ? redue_align_url_protocol($m_link) : $m_link;
					$gnb_items[] = array(
						'@type' => 'ListItem',
						'position' => $pos++,
						'name' => (string) $row['me_name'],
						'item' => $m_link,
						'code' => isset($row['me_code']) ? (string) $row['me_code'] : '',
					);
				}
			}
		}
		$GLOBALS['redue_gnb_items'] = $gnb_items;
		if ( ( ! is_array($available_services) || count($available_services) === 0 ) && function_exists('redue_catalog_from_menu') ) {
			$_gnb_svc = redue_catalog_from_menu($gnb_items, isset($is_medical_org) ? (bool) $is_medical_org : false);
			if ( is_array($_gnb_svc) && count($_gnb_svc) > 0 ) { $available_services = $_gnb_svc; }
		}
		if ( ! isset($schema_pages) || ! is_array($schema_pages) ) { $schema_pages = array(); }
		$_sp_key = isset($page_file) ? $page_file : ( isset($seo_file) ? $seo_file : ( isset($page_base) ? $page_base : '' ) );
		if ( is_string($_sp_key) && $_sp_key !== '' && isset($schema_pages[$_sp_key]) && is_array($schema_pages[$_sp_key]) && ! empty($schema_pages[$_sp_key]['type']) ) {
			$page_type = $schema_pages[$_sp_key]['type'];
		} elseif ( isset($page_base) && is_string($page_base) && isset($schema_pages[$page_base]) && is_array($schema_pages[$page_base]) && ! empty($schema_pages[$page_base]['type']) ) {
			$page_type = $schema_pages[$page_base]['type'];
		} elseif ( function_exists('redue_infer_page_schema_type') && ( ! isset($page_type) || $page_type === 'WebPage' ) ) {
			$_sp_hay = ( isset($page_title) ? $page_title : '' ) . ' ' . ( isset($canonical_url) ? $canonical_url : '' ) . ' ' . ( isset($schema_meta_title) ? $schema_meta_title : '' ) . ' ' . ( isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '' ) . ' ' . ( isset($_SERVER['SCRIPT_NAME']) ? (string) $_SERVER['SCRIPT_NAME'] : '' );
			$_sp_medical = isset($is_medical_org) ? (bool) $is_medical_org : ( function_exists('redue_is_medical_org') && redue_is_medical_org() );
			$_sp_inferred = redue_infer_page_schema_type($_sp_hay, $_sp_medical);
			if ( $_sp_inferred !== 'WebPage' ) { $page_type = $_sp_inferred; }
		}
		if ( ! empty($gnb_items) && is_array($gnb_items) ) {
			foreach ( $gnb_items as $_gnb ) {
				if ( empty($_gnb['item']) || empty($_gnb['name']) ) { continue; }
				$_gnb_path = parse_url((string) $_gnb['item'], PHP_URL_PATH);
				$_gnb_file = basename(is_string($_gnb_path) && $_gnb_path !== '' ? $_gnb_path : (string) $_gnb['item']);
				if ( $_gnb_file === '' || $_gnb_file === '/' || $_gnb_file === '.' ) { continue; }
				if ( isset($schema_pages[$_gnb_file]) ) { continue; }
				$_gnb_medical = isset($is_medical_org) ? (bool) $is_medical_org : ( function_exists('redue_is_medical_org') && redue_is_medical_org() );
				$schema_pages[$_gnb_file] = array(
					'type' => function_exists('redue_infer_page_schema_type') ? redue_infer_page_schema_type((string) $_gnb['name'] . ' ' . (string) $_gnb['item'], $_gnb_medical) : 'WebPage',
					'name' => (string) $_gnb['name'],
					'url' => (string) $_gnb['item'],
				);
			}
		}
		if ( function_exists('redue_refine_page_description') ) {
			$page_desc = redue_refine_page_description($page_desc, $site_name, $page_title, ( $is_main && $runtime_bo === '' && $runtime_wr === '' && $runtime_co === '' ), $gnb_items);
		}

		if ( function_exists('redue_echo_canonical_pair') ) { redue_echo_canonical_pair(); }
		echo '<meta name="description" content="' . htmlspecialchars($page_desc, ENT_QUOTES, 'UTF-8') . '">' . "\n";
		echo '<meta property="og:title" content="' . htmlspecialchars($page_title, ENT_QUOTES, 'UTF-8') . '">' . "\n";
		echo '<meta property="og:description" content="' . htmlspecialchars($page_desc, ENT_QUOTES, 'UTF-8') . '">' . "\n";
		echo '<meta property="og:type" content="' . ($page_type === 'Article' ? 'article' : 'website') . '">' . "\n";
		echo '<meta property="og:image" content="' . htmlspecialchars($image_url, ENT_QUOTES, 'UTF-8') . '">' . "\n";
		echo '<meta property="og:site_name" content="' . htmlspecialchars($site_name, ENT_QUOTES, 'UTF-8') . '">' . "\n";
		echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
		echo '<meta name="twitter:title" content="' . htmlspecialchars($page_title, ENT_QUOTES, 'UTF-8') . '">' . "\n";
		echo '<meta name="twitter:description" content="' . htmlspecialchars($page_desc, ENT_QUOTES, 'UTF-8') . '">' . "\n";
		echo '<meta name="twitter:image" content="' . htmlspecialchars($image_url, ENT_QUOTES, 'UTF-8') . '">' . "\n";

		$graph = array();

		$alternate_name = '';
		if ( $alternate_name === '' && ! empty($g5_head_title) && is_string($g5_head_title) ) {
			$_alt_title = trim(preg_replace('/\s*[|\-–—]\s+.+$/u', '', strip_tags((string) $g5_head_title)));
			if ( $_alt_title !== '' && $_alt_title !== $site_name ) { $alternate_name = $_alt_title; }
		}
		$org_node = array(
			'@type' => $org_types,
			'@id' => $origin . '/#organization',
			'name' => $site_name,
			'url' => $origin,
		);
		if ( $alternate_name !== '' && $alternate_name !== $site_name ) {
			$org_node['alternateName'] = $alternate_name;
		}
		if ( is_array($available_services) && count($available_services) > 0 ) {
			$org_node['availableService'] = $available_services;
		}
		if ( is_array($same_as_array) && count($same_as_array) > 0 ) {
			$org_node['sameAs'] = $same_as_array;
		}
		if ( is_string($price_range) && trim($price_range) !== '' ) {
			$org_node['priceRange'] = $price_range;
		}
		if ( is_string($currencies_accepted) && trim($currencies_accepted) !== '' ) {
			$org_node['currenciesAccepted'] = $currencies_accepted;
		}
		if ( is_string($payment_accepted) && trim($payment_accepted) !== '' ) {
			$org_node['paymentAccepted'] = $payment_accepted;
		}
		if ( is_array($knows_about) && count($knows_about) > 0 ) {
			$org_node['knowsAbout'] = $knows_about;
		}
		if ( $is_medical_org && is_array($medical_specialty) && count($medical_specialty) > 0 ) {
			$org_node['medicalSpecialty'] = $medical_specialty;
		}
		if ( is_string($latitude) && $latitude !== '' && is_string($longitude) && $longitude !== '' && is_numeric($latitude) && is_numeric($longitude) ) {
			$org_node['geo'] = array(
				'@type' => 'GeoCoordinates',
				'latitude' => (float) $latitude,
				'longitude' => (float) $longitude,
			);
		}
		if ( is_string($opens) && $opens !== '' && is_string($closes) && $closes !== '' ) {
			$org_node['openingHoursSpecification'] = array(
				array(
					'@type' => 'OpeningHoursSpecification',
					'dayOfWeek' => array('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
					'opens' => $opens,
					'closes' => $closes,
				),
			);
		}


		$_redue_cfg_blob = '';
		if ( isset($config) && is_array($config) ) {
			foreach ( array('cf_tel', 'cf_phone', 'cf_add_script', 'cf_add_meta', 'cf_analytics', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
				if ( ! empty($config[$_ck]) && is_string($config[$_ck]) ) {
					$_redue_cfg_blob .= ' ' . $config[$_ck];
				}
			}
		}
		if ( function_exists('redue_scan_site_file_corpus') ) {
			$_file_blob = redue_scan_site_file_corpus();
			if ( is_string($_file_blob) && $_file_blob !== '' ) { $_redue_cfg_blob .= ' ' . $_file_blob; }
		}
		if ( empty($org_node['telephone']) && function_exists('redue_resolve_universal_telephone') ) {
			$_uni_tel = redue_resolve_universal_telephone('');
			if ( $_uni_tel !== '' ) { $org_node['telephone'] = $_uni_tel; }
		}
		if ( empty($org_node['telephone']) ) {
			if ( function_exists('redue_resolve_cms_telephone') ) {
				$_cms_tel = redue_resolve_cms_telephone();
				if ( $_cms_tel !== '' ) { $org_node['telephone'] = $_cms_tel; }
			}
			if ( empty($org_node['telephone']) && ! empty($config['cf_tel']) && is_string($config['cf_tel']) && trim($config['cf_tel']) !== '' ) {
				$org_node['telephone'] = trim($config['cf_tel']);
			} elseif ( empty($org_node['telephone']) && function_exists('redue_extract_telephone') ) {
				$_tel = redue_extract_telephone($_redue_cfg_blob);
				if ( $_tel !== '' ) { $org_node['telephone'] = $_tel; }
			}
		}
		if ( ! empty($org_node['telephone']) && function_exists('redue_format_telephone') ) {
			$_fmt_tel = redue_format_telephone($org_node['telephone']);
			if ( $_fmt_tel !== '' ) { $org_node['telephone'] = $_fmt_tel; }
		}
		$_has_street = isset($org_node['address']) && is_array($org_node['address']) && ! empty($org_node['address']['streetAddress']);
		if ( ! $_has_street && function_exists('redue_extract_street_address') ) {
			$_addr = redue_extract_street_address($_redue_cfg_blob);
			if ( $_addr !== '' ) {
				$org_node['address'] = array(
					'@type' => 'PostalAddress',
					'streetAddress' => $_addr,
					'addressCountry' => 'KR',
				);
			}
		}

		if ( empty($org_node['telephone']) && isset($GLOBALS['redue_tel']) && is_string($GLOBALS['redue_tel']) && trim($GLOBALS['redue_tel']) !== '' ) {
			$_seed_tel = function_exists('redue_format_telephone') ? redue_format_telephone($GLOBALS['redue_tel']) : trim($GLOBALS['redue_tel']);
			if ( $_seed_tel !== '' ) { $org_node['telephone'] = $_seed_tel; }
		}
		if ( empty($org_node['telephone']) && isset($telephone) && is_string($telephone) && trim($telephone) !== '' ) {
			$org_node['telephone'] = function_exists('redue_format_telephone') ? redue_format_telephone($telephone) : trim($telephone);
		}
		if ( empty($org_node['telephone']) && function_exists('redue_resolve_universal_telephone') ) {
			$_uni_nap = redue_resolve_universal_telephone('');
			if ( $_uni_nap !== '' ) { $org_node['telephone'] = $_uni_nap; }
		}
		if ( empty($org_node['telephone']) && function_exists('redue_extract_telephone') ) {
			$_nap_blob = isset($_redue_cfg_blob) ? $_redue_cfg_blob : '';
			if ( $_nap_blob === '' && isset($config) && is_array($config) ) {
				foreach ( array('cf_tel', 'cf_phone', 'cf_add_script', 'cf_add_meta', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
					if ( ! empty($config[$_ck]) && is_string($config[$_ck]) ) { $_nap_blob .= ' ' . $config[$_ck]; }
				}
			}
			$_nap_tel = redue_extract_telephone($_nap_blob);
			if ( $_nap_tel !== '' ) { $org_node['telephone'] = $_nap_tel; }
		}
		if ( ! isset($org_node['address']) || ! is_array($org_node['address']) ) {
			$org_node['address'] = array('@type' => 'PostalAddress', 'addressCountry' => 'KR');
		}
		if ( empty($org_node['address']['streetAddress']) ) {
			$_nap_addr = '';
			if ( isset($street_address) && is_string($street_address) && trim($street_address) !== '' ) {
				$_nap_addr = trim($street_address);
			} elseif ( function_exists('redue_extract_street_address') ) {
				$_nap_blob_addr = isset($_nap_blob) ? $_nap_blob : ( isset($_redue_cfg_blob) ? $_redue_cfg_blob : '' );
				$_nap_addr = redue_extract_street_address($_nap_blob_addr);
			}
			if ( $_nap_addr !== '' ) { $org_node['address']['streetAddress'] = $_nap_addr; }
			$org_node['address']['@type'] = 'PostalAddress';
			$org_node['address']['addressCountry'] = 'KR';
		}
		if ( isset($locality) && is_string($locality) && $locality !== '' && empty($org_node['address']['addressLocality']) ) {
			$org_node['address']['addressLocality'] = $locality;
		}
		if ( isset($region) && is_string($region) && $region !== '' && empty($org_node['address']['addressRegion']) ) {
			$org_node['address']['addressRegion'] = $region;
		}
		if ( isset($postal_code) && is_string($postal_code) && $postal_code !== '' && empty($org_node['address']['postalCode']) ) {
			$org_node['address']['postalCode'] = $postal_code;
		}

		if ( empty($org_node['address']['streetAddress']) ) {
			unset($org_node['address']);
		} else {
			$org_node['address']['@type'] = 'PostalAddress';
			$org_node['address']['addressCountry'] = 'KR';
			if ( function_exists('redue_infer_kr_address_parts') ) {
				$_parts = redue_infer_kr_address_parts($org_node['address']['streetAddress']);
				if ( empty($org_node['address']['addressLocality']) && ! empty($_parts['locality']) ) {
					$org_node['address']['addressLocality'] = $_parts['locality'];
				}
				if ( empty($org_node['address']['addressRegion']) && ! empty($_parts['region']) ) {
					$org_node['address']['addressRegion'] = $_parts['region'];
				}
			}
		}


		if ( empty($org_node['telephone']) && !empty($config['cf_add_script']) && preg_match('/(?:0\d{1,2}-\d{3,4}-\d{4}|1[568]\d{2}-\d{4})/', $config['cf_add_script'], $tel_m) ) {
			$org_node['telephone'] = $tel_m[0];
		}
		if ( empty($org_node['faxNumber']) && isset($GLOBALS['redue_fax']) && is_string($GLOBALS['redue_fax']) && trim($GLOBALS['redue_fax']) !== '' ) {
			$org_node['faxNumber'] = trim($GLOBALS['redue_fax']);
		}
		if ( empty($org_node['faxNumber']) && function_exists('redue_extract_fax') ) {
			$_fax = redue_extract_fax(isset($_redue_cfg_blob) ? $_redue_cfg_blob : '');
			if ( $_fax !== '' ) { $org_node['faxNumber'] = $_fax; }
		}
		if ( empty($org_node['taxID']) && isset($GLOBALS['redue_tax_id']) && is_string($GLOBALS['redue_tax_id']) && trim($GLOBALS['redue_tax_id']) !== '' ) {
			$org_node['taxID'] = trim($GLOBALS['redue_tax_id']);
		}
		if ( empty($org_node['taxID']) && function_exists('redue_extract_tax_id') ) {
			$_tax = redue_extract_tax_id(isset($_redue_cfg_blob) ? $_redue_cfg_blob : '');
			if ( $_tax !== '' ) { $org_node['taxID'] = $_tax; }
		}
		if ( empty($org_node['legalName']) && isset($GLOBALS['redue_legal_name']) && is_string($GLOBALS['redue_legal_name']) && trim($GLOBALS['redue_legal_name']) !== '' ) {
			$org_node['legalName'] = trim($GLOBALS['redue_legal_name']);
		}
		$_area_served = array();
		if ( ! empty($org_node['address']['addressLocality']) ) {
			$_area_served[] = array('@type' => 'AdministrativeArea', 'name' => (string) $org_node['address']['addressLocality']);
		}
		if ( ! empty($org_node['address']['addressRegion']) ) {
			$_area_served[] = array('@type' => 'AdministrativeArea', 'name' => (string) $org_node['address']['addressRegion']);
		}
		if ( count($_area_served) > 0 ) {
			$org_node['areaServed'] = $_area_served;
		}
		if ( function_exists('redue_has_real_person') ? redue_has_real_person() : ( isset($GLOBALS['redue_rep_name']) && trim((string) $GLOBALS['redue_rep_name']) !== '' ) ) {
			$org_node['founder'] = array('@id' => $origin . '/#person');
			$org_node['employee'] = array('@id' => $origin . '/#person');
			if ( isset($is_medical_org) && $is_medical_org ) {
				$org_node['physician'] = array('@id' => $origin . '/#person');
			}
		}
		if ( function_exists('redue_bind_org_five_core') ) {
			redue_bind_org_five_core($org_node, isset($origin) ? $origin : '');
		}

		$graph[] = $org_node;
		$graph[] = array(
			'@type' => 'WebSite',
			'@id' => $origin . '/#website',
			'name' => $site_name,
			'url' => $origin,
			'publisher' => array('@id' => $origin . '/#organization'),
		);

		if ( $is_main && $runtime_bo === '' && $runtime_wr === '' && $runtime_co === '' ) {
			if ( ! empty($gnb_items) ) {
				$graph[] = array(
					'@type' => 'ItemList',
					'@id' => $origin . '/#gnb',
					'name' => 'GNB Navigation',
					'itemListElement' => $gnb_items,
				);
			}
			$_has_part = array();
			if ( isset($schema_pages) && is_array($schema_pages) ) {
				foreach ( $schema_pages as $_sp_file => $_sp ) {
					if ( ! is_array($_sp) ) { continue; }
					if ( $_sp_file === 'index.php' || $_sp_file === 'index.html' || $_sp_file === 'index.htm' ) { continue; }
					$_sp_url = ! empty($_sp['url']) ? (string) $_sp['url'] : ( rtrim($origin, '/') . '/' . ltrim((string) $_sp_file, '/') );
					$_sp_type = ! empty($_sp['type']) ? (string) $_sp['type'] : 'WebPage';
					$_has_part[] = array(
						'@type' => $_sp_type,
						'@id' => $_sp_url . '#webpage',
						'name' => ! empty($_sp['name']) ? (string) $_sp['name'] : (string) $_sp_file,
						'url' => $_sp_url,
					);
				}
			}
			if ( empty($_has_part) && ! empty($gnb_items) ) {
				foreach ( $gnb_items as $_gnb ) {
					if ( empty($_gnb['item']) || empty($_gnb['name']) ) { continue; }
					$_has_part[] = array(
						'@type' => 'WebPage',
						'@id' => $_gnb['item'] . '#webpage',
						'name' => (string) $_gnb['name'],
						'url' => $_gnb['item'],
					);
				}
			}
			$_main_page_types = function_exists('redue_composite_page_types')
				? redue_composite_page_types(true, $page_type)
				: $page_type;
			$_main_page = array(
				'@type' => $_main_page_types,
				'@id' => $canonical_url . '#webpage',
				'name' => $page_title,
				'headline' => $page_title,
				'description' => $page_desc,
				'url' => $canonical_url,
				'isPartOf' => array('@id' => $origin . '/#website'),
				'about' => array('@id' => $origin . '/#organization'),
				'mainEntity' => array('@id' => $origin . '/#organization'),
				'hasPart' => $_has_part,
			);
			if ( function_exists('redue_apply_page_graph_links') ) {
				redue_apply_page_graph_links($_main_page, $origin, $canonical_url . '#breadcrumb');
			}
			$graph[] = $_main_page;
		} else {
			$_page_is_about = (bool) preg_match('/소개|인사말|시설|장비|about|company|greeting|연혁|조직도|개요/ui', $page_title . ' ' . $canonical_url);
			if ( $_page_is_about && function_exists('redue_composite_page_types') ) {
				$page_type = redue_composite_page_types(false, $page_type, true);
			}
			if ( function_exists('redue_build_breadcrumb_list') ) {
				$graph[] = redue_build_breadcrumb_list($origin, $canonical_url, $page_title);
			}
			$page_node = array(
				'@type' => $page_type,
				'@id' => $canonical_url . '#webpage',
				'name' => $page_title,
				'description' => $page_desc,
				'url' => $canonical_url,
				'isPartOf' => array('@id' => $origin . '/#website'),
				'about' => array('@id' => $origin . '/#organization'),
				'mainEntity' => array('@id' => $origin . '/#organization'),
				'breadcrumb' => array('@id' => $canonical_url . '#breadcrumb'),
			);
			if ( function_exists('redue_apply_page_graph_links') ) {
				redue_apply_page_graph_links($page_node, $origin, $canonical_url . '#breadcrumb');
			}
			if ( ( is_string($page_type) && $page_type === 'Article' ) || ( is_array($page_type) && in_array('Article', $page_type, true) ) ) {
				$page_node['headline'] = $page_title;
				$published = '';
				if ( !empty($view['wr_datetime']) ) { $published = (string) $view['wr_datetime']; }
				elseif ( !empty($write['wr_datetime']) ) { $published = (string) $write['wr_datetime']; }
				$ts = $published !== '' ? strtotime($published) : false;
				if ( $ts ) { $page_node['datePublished'] = date('c', $ts); }
				$_author_name = '';
				if ( ! empty($view['wr_name']) ) { $_author_name = trim(strip_tags((string) $view['wr_name'])); }
				elseif ( ! empty($write['wr_name']) ) { $_author_name = trim(strip_tags((string) $write['wr_name'])); }
				elseif ( function_exists('redue_has_real_person') && redue_has_real_person() ) {
					$_author_name = isset($GLOBALS['redue_rep_name']) ? trim((string) $GLOBALS['redue_rep_name']) : '';
				}
				if ( $_author_name !== '' ) {
					$page_node['author'] = array(
						'@type' => 'Person',
						'@id' => $origin . '/#person',
						'name' => $_author_name,
					);
				}
			}
			$_is_service_page = ( is_string($page_type) && ( $page_type === 'MedicalWebPage' || $page_type === 'WebPage' ) )
				|| ( is_array($page_type) && ( in_array('MedicalWebPage', $page_type, true) || in_array('WebPage', $page_type, true) ) );
			if ( $_is_service_page && $runtime_bo === '' && $runtime_wr === '' && ! $_page_is_about && $page_type !== 'ContactPage' && $page_type !== 'CollectionPage' && $page_type !== 'ProfilePage' ) {
				$graph[] = array(
					'@type' => $is_medical_org ? 'MedicalProcedure' : 'Service',
					'@id' => $canonical_url . '#service',
					'name' => $page_title,
					'url' => $canonical_url,
					'provider' => array('@id' => $origin . '/#organization'),
				);
				$page_node['mainEntity'] = array('@id' => $canonical_url . '#service');
			}
			$graph[] = $page_node;
		}

		$_howto_steps = isset($GLOBALS['schema_howto_steps']) && is_array($GLOBALS['schema_howto_steps'])
			? $GLOBALS['schema_howto_steps']
			: array();
		if ( ( ! is_array($_howto_steps) || count($_howto_steps) === 0 ) && function_exists('redue_extract_howto_steps') ) {
			$_howto_html = function_exists('redue_collect_page_body_html') ? redue_collect_page_body_html() : '';
			$_howto_steps = redue_extract_howto_steps($_howto_html);
		}
		$_howto_entities = array();
		if ( is_array($_howto_steps) ) {
			foreach ( $_howto_steps as $_hs ) {
				if ( ! is_array($_hs) ) { continue; }
				$_hn = isset($_hs['name']) ? trim((string) $_hs['name']) : '';
				$_ht = isset($_hs['text']) ? trim((string) $_hs['text']) : $_hn;
				if ( $_hn === '' || $_ht === '' ) { continue; }
				$_howto_entities[] = array(
					'@type' => 'HowToStep',
					'position' => isset($_hs['position']) ? (int) $_hs['position'] : ( count($_howto_entities) + 1 ),
					'name' => $_hn,
					'text' => $_ht,
				);
			}
		}
		if ( count($_howto_entities) > 0 ) {
			$_howto_url = isset($canonical_url) && is_string($canonical_url) && $canonical_url !== ''
				? $canonical_url
				: ( isset($page_url) && is_string($page_url) ? $page_url : ( $origin . '/' ) );
			$graph[] = array(
				'@type' => 'HowTo',
				'@id' => $_howto_url . '#howto',
				'name' => $site_name . ' 이용 절차',
				'step' => $_howto_entities,
			);
		}


		$is_board_list = preg_match('/board\.php\?bo_table=/', $canonical_url);
		if ( ! $is_board_list ) {
			$faq_items = isset($GLOBALS['schema_faq_items']) && is_array($GLOBALS['schema_faq_items']) ? $GLOBALS['schema_faq_items'] : null;
			if ( ( ! is_array($faq_items) || count($faq_items) === 0 ) && isset($schema_faq_items) && is_array($schema_faq_items) && count($schema_faq_items) > 0 ) {
				$faq_items = $schema_faq_items;
			}
			if ( ( ! is_array($faq_items) || count($faq_items) === 0 ) && function_exists('redue_extract_faq_items') ) {
				$faq_items = redue_extract_faq_items( function_exists('redue_collect_page_body_html') ? redue_collect_page_body_html() : '' );
			}
			$faq_entities = array();
			if ( is_array($faq_items) ) {
				foreach ( $faq_items as $fi ) {
					if ( ! is_array($fi) ) { continue; }
					$q = '';
					$a = '';
					if ( isset($fi['q']) ) { $q = $fi['q']; }
					elseif ( isset($fi['question']) ) { $q = $fi['question']; }
					elseif ( isset($fi['name']) ) { $q = $fi['name']; }
					if ( isset($fi['a']) ) { $a = $fi['a']; }
					elseif ( isset($fi['answer']) ) { $a = $fi['answer']; }
					elseif ( isset($fi['text']) ) { $a = $fi['text']; }
					$q = is_string($q) ? trim($q) : '';
					$a = is_string($a) ? trim($a) : '';
					if ( $q === '' || $a === '' ) { continue; }
					$faq_entities[] = array(
						'@type' => 'Question',
						'name' => $q,
						'acceptedAnswer' => array('@type' => 'Answer', 'text' => $a),
					);
				}
			}
			if ( count($faq_entities) > 0 ) {
				$graph[] = array(
					'@type' => 'FAQPage',
					'@id' => $canonical_url . '#faq',
					'url' => $canonical_url,
					'mainEntity' => $faq_entities,
				);
			}

		}
		if ( function_exists('redue_resolve_rep_identity') ) {
			$_rep_id = redue_resolve_rep_identity();
			if ( ( ! isset($rep_name) || ! is_string($rep_name) || trim($rep_name) === '' ) && ! empty($_rep_id['name']) ) {
				$rep_name = $_rep_id['name'];
			}
			if ( ( ! isset($rep_title) || ! is_string($rep_title) || trim($rep_title) === '' ) && ! empty($_rep_id['title']) ) {
				$rep_title = $_rep_id['title'];
			}
		}
		if ( ! isset($rep_name) || ! is_string($rep_name) ) {
			$rep_name = isset($GLOBALS['redue_rep_name']) ? trim((string) $GLOBALS['redue_rep_name']) : '';
		}
		if ( ! isset($rep_title) || ! is_string($rep_title) ) {
			$rep_title = isset($GLOBALS['redue_rep_title']) ? trim((string) $GLOBALS['redue_rep_title']) : '';
		}
		$person = null;
		if ( isset($GLOBALS['schema_person']) && is_array($GLOBALS['schema_person']) ) {
			$person = $GLOBALS['schema_person'];
		} elseif ( isset($schema_person) && is_array($schema_person) ) {
			$person = $schema_person;
		}
		$person_eeat_name = ( is_string($rep_name) && $rep_name !== '' )
			? $rep_name
			: ( is_array($person) && ! empty($person['name']) ? trim((string) $person['name']) : '' );
		if ( $person_eeat_name !== '' ) {
		$person_eeat_title = ( is_string($rep_title) && $rep_title !== '' )
			? $rep_title
			: ( is_array($person) && ! empty($person['jobTitle']) ? trim((string) $person['jobTitle']) : '' );
		$person_url = ( is_array($person) && ! empty($person['url']) )
			? ( function_exists('redue_align_url_protocol') ? redue_align_url_protocol($person['url']) : $person['url'] )
			: ( rtrim($origin, '/') . '/' );
		$person_node = array(
			'@type' => 'Person',
			'@id' => $origin . '/#person',
			'name' => $person_eeat_name,
			'worksFor' => array('@id' => $origin . '/#organization'),
			'url' => $person_url,
		);
		if ( $person_eeat_title !== '' ) {
			$person_node['jobTitle'] = $person_eeat_title;
		}
		if ( is_array($person) && ! empty($person['image']) ) {
			$person_node['image'] = function_exists('redue_align_url_protocol')
				? redue_align_url_protocol($person['image'])
				: $person['image'];
		}
		if ( is_array($person) && ! empty($person['description']) ) { $person_node['description'] = $person['description']; }
		$_alumni = '';
		if ( is_array($person) && ! empty($person['alumniOf']) ) {
			$_alumni = is_array($person['alumniOf']) && ! empty($person['alumniOf']['name'])
				? (string) $person['alumniOf']['name']
				: ( is_string($person['alumniOf']) ? $person['alumniOf'] : '' );
		}
		if ( $_alumni !== '' ) {
			$person_node['alumniOf'] = array('@type' => 'EducationalOrganization', 'name' => $_alumni);
		}
		$_knows = array();
		if ( is_array($person) && ! empty($person['knowsAbout']) && is_array($person['knowsAbout']) ) {
			$_knows = $person['knowsAbout'];
		} elseif ( isset($knows_about) && is_array($knows_about) && count($knows_about) > 0 ) {
			$_knows = $knows_about;
		} elseif ( isset($medical_specialty) && is_array($medical_specialty) && count($medical_specialty) > 0 ) {
			$_knows = $medical_specialty;
		}
		if ( ( ! is_array($_knows) || count($_knows) === 0 ) && isset($available_services) && is_array($available_services) ) {
			foreach ( $available_services as $_ks ) {
				if ( is_array($_ks) && ! empty($_ks['name']) ) { $_knows[] = (string) $_ks['name']; }
			}
		}
		if ( is_array($_knows) && count($_knows) > 0 ) {
			$person_node['knowsAbout'] = array_values(array_filter(array_map('strval', $_knows)));
		}
		$graph[] = $person_node;
		}

		if ( function_exists('redue_ensure_universal_breadcrumb') ) {
			$_crumb_canon = isset($canonical_url) && is_string($canonical_url) && $canonical_url !== ''
				? $canonical_url
				: ( isset($page_url) && is_string($page_url) ? $page_url : ( $origin . '/' ) );
			$_crumb_title = isset($page_title) && is_string($page_title) && $page_title !== ''
				? $page_title
				: ( isset($schema_meta_title) && is_string($schema_meta_title) ? $schema_meta_title : '홈' );
			redue_ensure_universal_breadcrumb($graph, $origin, $_crumb_canon, $_crumb_title);
		}


		echo '<script type="application/ld+json">' . "\n" .
			json_encode(array('@context' => 'https://schema.org', '@graph' => $graph), function_exists('redue_jsonld_flags') ? redue_jsonld_flags() : (JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) .
			"\n" . '</script>' . "\n";
	}
}

if ( ! function_exists( 'redue_llms_plain_string' ) ) {
	function redue_llms_plain_string( $value ) {
		if ( ! is_string($value) ) { return ''; }
		$text = html_entity_decode($value, ENT_QUOTES, 'UTF-8');
		$text = preg_replace('/<[^>]+>/', ' ', is_string($text) ? $text : '');
		$text = is_string($text) ? trim(preg_replace('/\s+/u', ' ', $text)) : '';
		if ( $text === '' ) { return ''; }
		if ( preg_match('/^(Array|Object|stdClass)\b/i', $text) ) { return ''; }
		if ( preg_match('/^Class\s*\(/i', $text) ) { return ''; }
		if ( preg_match('/\[object Object\]/i', $text) ) { return ''; }
		if ( preg_match('/__PHP_Incomplete_Class/i', $text) ) { return ''; }
		if ( preg_match('/^\{["\'@]/', $text) && preg_match('/@type|PostalAddress|addressCountry/i', $text) ) { return ''; }
		return $text;
	}
}
if ( ! function_exists( 'redue_llms_extract_address' ) ) {
	function redue_llms_extract_address( $value ) {
		$text = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($value) : '';
		if ( $text === '' ) { return ''; }
		if ( function_exists('redue_extract_street_address') ) {
			$hit = redue_extract_street_address($text);
			$hit = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($hit) : ( is_string($hit) ? trim($hit) : '' );
			if ( $hit !== '' ) { return $hit; }
		}
		if ( preg_match('/(?:서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣\d\-~,()·\s]{2,48}(?:로|길|동|번지|호)/u', $text, $m) ) {
			return function_exists('redue_llms_plain_string') ? redue_llms_plain_string($m[0]) : trim($m[0]);
		}
		return '';
	}
}
if ( ! function_exists( 'redue_llms_file_title' ) ) {
	function redue_llms_file_title( $stem ) {
		$stem = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($stem) : '';
		$stem = strtolower(preg_replace('/\.(php|html?|htm|phtml)$/i', '', $stem));
		if ( isset($GLOBALS['redue_llms_file_map']) && is_array($GLOBALS['redue_llms_file_map']) && ! empty($GLOBALS['redue_llms_file_map'][$stem]) && is_string($GLOBALS['redue_llms_file_map'][$stem]) ) {
			return trim($GLOBALS['redue_llms_file_map'][$stem]);
		}
		$map = array(
			's101' => '병원소개', '101' => '병원소개', 'intro' => '병원소개', 'about' => '병원소개', 'company' => '회사소개',
			's102' => '의료진', '102' => '의료진', 'staff' => '의료진', 'doctor' => '의료진',
			's103' => '오시는길', '103' => '오시는길', 'location' => '오시는길', 'map' => '오시는길', 'contact' => '오시는길',
			's104' => '둘러보기', '104' => '둘러보기', 'tour' => '둘러보기', 'facility' => '시설안내',
			's201' => '눈성형', '201' => '눈성형',
			's202' => '코성형', '202' => '코성형',
			's203' => '가슴성형', '203' => '가슴성형',
			's204' => '안면윤곽', '204' => '안면윤곽',
			's301' => '피부시술', '301' => '피부시술',
		);
		return isset($map[$stem]) ? $map[$stem] : '';
	}
}
if ( ! function_exists( 'redue_llms_is_chrome_title' ) ) {
	function redue_llms_is_chrome_title( $title, $site_name = '' ) {
		$name = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($title) : '';
		$brand = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($site_name) : '';
		if ( $name === '' ) { return true; }
		$nf = preg_replace('/\s+/u', '', $name);
		$bf = preg_replace('/\s+/u', '', $brand);
		if ( $bf !== '' && ( $nf === $bf || $nf === $bf . '본점' ) ) { return true; }
		if ( preg_match('/본점$/u', $name) && ( $bf === '' || (function_exists('mb_strpos') ? mb_strpos($nf, $bf) : strpos($nf, $bf)) === 0 ) ) { return true; }
		if ( preg_match('/로고|logo|^home$|^메인$|^홈으로$/iu', $name) ) { return true; }
		return false;
	}
}
if ( ! function_exists( 'redue_llms_is_info_menu' ) ) {
	function redue_llms_is_info_menu( $name ) {
		$label = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($name) : '';
		if ( $label === '' ) { return false; }
		return (bool) preg_match('/병원소개|의원소개|클리닉소개|회사소개|연구소소개|센터소개|장비소개|시설소개|시설안내|둘러보기|인사말|원장인사|연혁|조직도|층별안내|오시는\s*길|찾아오시는|찾아오는\s*길|진료시간|운영시간|비급여|공지사항|갤러리|커뮤니티|이용약관|개인정보|로그인|회원가입|상담문의|온라인\s*예약|의료진|원장소개|about|contact|location|directions|tour|greeting|privacy|sitemap/iu', $label);
	}
}
if ( ! function_exists( 'redue_llms_is_service_menu' ) ) {
	function redue_llms_is_service_menu( $name ) {
		$label = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($name) : '';
		if ( $label === '' || ( function_exists('redue_llms_is_info_menu') && redue_llms_is_info_menu($label) ) ) { return false; }
		if ( preg_match('/성형|시술|수술|진료|치료|클리닉|임플란트|교정|보톡스|필러|리프팅|피부|내과|외과|소아|산부|정형|재활|도수|통증|암|중입자|줄기세포|검진|케어|프로그램|상품|제품|서비스/u', $label) ) { return true; }
		$len = function_exists('mb_strlen') ? mb_strlen($label, 'UTF-8') : strlen($label);
		return $len >= 2 && $len <= 24 && ! preg_match('/메뉴|게시판|검색/u', $label);
	}
}
if ( ! function_exists( 'redue_llms_clean_body' ) ) {
	function redue_llms_clean_body( $value, $stopwords = array() ) {
		$text = is_string($value) ? $value : '';
		if ( $text === '' ) { return ''; }
		$text = preg_replace('/<script\b[^>]*>[\s\S]*?<\/script>/i', ' ', $text);
		$text = preg_replace('/<style\b[^>]*>[\s\S]*?<\/style>/i', ' ', is_string($text) ? $text : '');
		$text = function_exists('redue_plain_text') ? redue_plain_text(is_string($text) ? $text : '') : ( function_exists('redue_llms_plain_string') ? redue_llms_plain_string($text) : trim(strip_tags(is_string($text) ? $text : '')) );
		$text = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($text) : $text;
		if ( ! is_string($text) || $text === '' ) { return ''; }
		$text = preg_replace('/로그인|로그아웃|회원가입|회원정보|비밀번호\s*찾기|글쓰기|비회원|아이디\s*찾기|Zoom|게시판\s*검색|글쓴이|조회\s*\d*|날짜|Total\s*\d+\s*건|\d+\s*페이지|페이지\s*\d+|문의하기|진료시간|오시는길|찾아오시는\s*길|상담예약|온라인예약|더보기|바로가기|맨위로|\bTOP\b/iu', ' ', $text);
		if ( is_array($stopwords) ) {
			foreach ( $stopwords as $_sw ) {
				$_sw = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($_sw) : '';
				if ( $_sw !== '' && ( function_exists('mb_strlen') ? mb_strlen($_sw, 'UTF-8') : strlen($_sw) ) >= 2 ) {
					$text = str_replace($_sw, ' ', is_string($text) ? $text : '');
				}
			}
		}
		$text = is_string($text) ? trim(preg_replace('/\s+/u', ' ', $text)) : '';
		if ( $text === '' ) { return ''; }
		$parts = preg_split('/(?<=[.!?다요음니다])\s+/u', $text);
		$picked = array();
		if ( is_array($parts) ) {
			foreach ( $parts as $_p ) {
				$_p = trim(is_string($_p) ? $_p : '');
				if ( $_p === '' || preg_match('/^(home|메인|메뉴)$/iu', $_p) ) { continue; }
				$len = function_exists('mb_strlen') ? mb_strlen($_p, 'UTF-8') : strlen($_p);
				if ( $len < 8 ) { continue; }
				$picked[] = $_p;
				if ( count($picked) >= 2 ) { break; }
			}
		}
		$out = count($picked) > 0 ? implode(' ', $picked) : $text;
		if ( function_exists('mb_substr') ) { return mb_substr($out, 0, 280, 'UTF-8'); }
		return substr($out, 0, 280);
	}
}
if ( ! function_exists( 'redue_llms_page_title' ) ) {
	function redue_llms_page_title( $menu_name, $heading, $head_title, $file_stem, $site_name ) {
		$site = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($site_name) : '';
		$head = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($head_title) : '';
		if ( $site !== '' && $head !== '' ) {
			$head = preg_replace('/\s*[|\-–—:>]\s*' . preg_quote($site, '/') . '\s*$/u', '', $head);
			$head = preg_replace('/^' . preg_quote($site, '/') . '\s*[|\-–—:>]\s*/u', '', is_string($head) ? $head : '');
			$head = trim(str_replace($site, ' ', is_string($head) ? $head : ''));
			$head = is_string($head) ? trim(preg_replace('/\s+/u', ' ', $head)) : '';
		}
		$cands = array(
			function_exists('redue_llms_plain_string') ? redue_llms_plain_string($menu_name) : '',
			function_exists('redue_llms_plain_string') ? redue_llms_plain_string($heading) : '',
			$head,
			function_exists('redue_llms_file_title') ? redue_llms_file_title($file_stem) : '',
		);
		foreach ( $cands as $_c ) {
			if ( ! is_string($_c) || $_c === '' ) { continue; }
			if ( function_exists('redue_llms_is_chrome_title') && redue_llms_is_chrome_title($_c, $site) ) { continue; }
			if ( $site !== '' && preg_replace('/\s+/u', '', $_c) === preg_replace('/\s+/u', '', $site) ) { continue; }
			return $_c;
		}
		return '';
	}
}
if ( ! function_exists( 'redue_llms_collect_menus' ) ) {
	function redue_llms_collect_menus( $origin, $site_name ) {
		global $g5;
		$out = array();
		$origin = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($origin) : '';
		$origin = rtrim($origin, '/');
		if ( isset($g5['menu_table']) && $g5['menu_table'] !== '' && function_exists('sql_query') && function_exists('sql_fetch_array') ) {
			$sql = " select me_name, me_link from {$g5['menu_table']} where me_use = '1' order by me_order, me_id asc ";
			$result = @sql_query($sql, false);
			if ( $result ) {
				while ( $row = sql_fetch_array($result) ) {
					$name = isset($row['me_name']) && is_string($row['me_name']) ? redue_llms_plain_string($row['me_name']) : '';
					$link = isset($row['me_link']) && is_string($row['me_link']) ? trim($row['me_link']) : '';
					if ( $name === '' || $link === '' ) { continue; }
					if ( preg_match('/javascript:|^#|^mailto:|^tel:/i', $link) ) { continue; }
					$url = preg_match('#^https?://#i', $link) ? $link : $origin . '/' . ltrim($link, '/');
					$path = parse_url($url, PHP_URL_PATH);
					$stem = is_string($path) ? basename($path) : '';
					$title = function_exists('redue_llms_page_title')
						? redue_llms_page_title($name, '', '', $stem, $site_name)
						: $name;
					if ( $title === '' ) { continue; }
					$out[] = array(
						'name' => $title,
						'url' => function_exists('redue_align_url_protocol') ? redue_align_url_protocol($url) : $url,
						'stem' => $stem,
						'kind' => ( function_exists('redue_llms_is_service_menu') && redue_llms_is_service_menu($title) ) ? 'service' : 'info',
					);
				}
			}
		}
		return $out;
	}
}
if ( ! function_exists( 'redue_llms_read_page_html' ) ) {
	function redue_llms_read_page_html( $url, $stem ) {
		$stem = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($stem) : '';
		$paths = array();
		if ( $stem !== '' ) {
			if ( defined('G5_THEME_PATH') && G5_THEME_PATH ) {
				$paths[] = G5_THEME_PATH . '/' . $stem;
				$paths[] = G5_THEME_PATH . '/skin/' . $stem;
			}
			if ( defined('G5_PATH') && G5_PATH ) {
				$paths[] = G5_PATH . '/' . $stem;
				$paths[] = G5_PATH . '/bbs/' . $stem;
			}
		}
		$html = '';
		foreach ( $paths as $_p ) {
			if ( ! is_string($_p) || ! is_file($_p) ) { continue; }
			$raw = @file_get_contents($_p);
			if ( is_string($raw) && $raw !== '' ) { $html .= ' ' . $raw; }
		}
		if ( $html === '' && function_exists('redue_collect_page_body_html') ) {
			$html = redue_collect_page_body_html();
		}
		return is_string($html) ? $html : '';
	}
}
if ( ! function_exists( 'redue_llms_extract_heading' ) ) {
	function redue_llms_extract_heading( $html, $site_name ) {
		if ( ! is_string($html) || $html === '' ) { return ''; }
		if ( preg_match('/<(?:h2|h3)[^>]*>([\s\S]{2,80})<\/(?:h2|h3)>/i', $html, $m) ) {
			$h = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($m[1]) : trim(strip_tags($m[1]));
			if ( $h !== '' && ! ( function_exists('redue_llms_is_chrome_title') && redue_llms_is_chrome_title($h, $site_name) ) ) { return $h; }
		}
		if ( preg_match('/<(?:div|p|span)[^>]*class=["\'][^"\']*sub_title[^"\']*["\'][^>]*>([\s\S]{2,80})<\//i', $html, $m) ) {
			$h = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($m[1]) : trim(strip_tags($m[1]));
			if ( $h !== '' && ! ( function_exists('redue_llms_is_chrome_title') && redue_llms_is_chrome_title($h, $site_name) ) ) { return $h; }
		}
		return '';
	}
}
if ( ! function_exists( 'redue_llms_collect_faqs' ) ) {
	function redue_llms_collect_faqs() {
		$out = array();
		$seen = array();
		$push = function( $q, $a ) use ( &$out, &$seen ) {
			$q = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($q) : '';
			$a = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($a) : '';
			if ( $q === '' || $a === '' ) { return; }
			if ( preg_match('/어디서 받나요|실비보험|가상|템플릿/u', $q) ) { return; }
			$ql = function_exists('mb_strlen') ? mb_strlen($q, 'UTF-8') : strlen($q);
			$al = function_exists('mb_strlen') ? mb_strlen($a, 'UTF-8') : strlen($a);
			if ( $ql < 6 || $al < 8 ) { return; }
			if ( isset($seen[$q]) ) { return; }
			$seen[$q] = true;
			$out[] = array('q' => $q, 'a' => $a);
		};
		if ( isset($GLOBALS['schema_faq_items']) && is_array($GLOBALS['schema_faq_items']) ) {
			foreach ( $GLOBALS['schema_faq_items'] as $_f ) {
				if ( ! is_array($_f) ) { continue; }
				$push( isset($_f['q']) ? $_f['q'] : '', isset($_f['a']) ? $_f['a'] : '' );
				if ( count($out) >= 8 ) { return $out; }
			}
		}
		$html = '';
		if ( function_exists('redue_collect_page_body_html') ) {
			$html .= ' ' . redue_collect_page_body_html();
		}
		if ( function_exists('redue_scan_site_file_corpus') ) {
			$html .= ' ' . redue_scan_site_file_corpus();
		}
		if ( function_exists('redue_extract_faq_items') && is_string($html) && trim($html) !== '' ) {
			foreach ( redue_extract_faq_items($html) as $_f ) {
				if ( ! is_array($_f) ) { continue; }
				$push( isset($_f['q']) ? $_f['q'] : '', isset($_f['a']) ? $_f['a'] : '' );
				if ( count($out) >= 8 ) { return $out; }
			}
		}
		return $out;
	}
}
if ( ! function_exists( 'redue_llms_hours' ) ) {
	function redue_llms_hours() {
		if ( ! empty($GLOBALS['redue_opens']) && ! empty($GLOBALS['redue_closes']) && is_string($GLOBALS['redue_opens']) && is_string($GLOBALS['redue_closes']) ) {
			return trim($GLOBALS['redue_opens']) . '-' . trim($GLOBALS['redue_closes']);
		}
		$blob = function_exists('redue_scan_site_file_corpus') ? redue_scan_site_file_corpus() : '';
		$blob = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($blob) : ( is_string($blob) ? $blob : '' );
		if ( $blob !== '' && preg_match('/(?:진료|운영|영업)\s*시간\s*[:：]?\s*(\d{1,2}:\d{2})\s*[\-~–—]\s*(\d{1,2}:\d{2})/u', $blob, $m) ) {
			return $m[1] . '-' . $m[2];
		}
		return '';
	}
}
if ( ! function_exists( 'redue_llms_industry_label' ) ) {
	function redue_llms_industry_label() {
		$types = function_exists('redue_infer_org_types') ? redue_infer_org_types() : array();
		$hay = is_array($types) ? implode(' ', $types) : ( function_exists('redue_llms_plain_string') ? redue_llms_plain_string($types) : '' );
		if ( preg_match('/Veterinary|동물병원/i', $hay) ) { return '동물병원'; }
		if ( preg_match('/Dentist|치과/i', $hay) ) { return '치과'; }
		if ( preg_match('/MedicalClinic|Physician|Hospital|병의원|병원|의원/i', $hay) ) { return '병의원'; }
		if ( preg_match('/OnlineStore|Store|쇼핑몰|영카트/i', $hay) ) { return '쇼핑몰'; }
		if ( preg_match('/LegalService|법률|법무/i', $hay) ) { return '법률'; }
		if ( preg_match('/Educational|학원|교육/i', $hay) ) { return '교육'; }
		if ( preg_match('/Accounting|세무|회계/i', $hay) ) { return '세무·회계'; }
		return $hay !== '' ? $hay : '';
	}
}
if ( ! function_exists( 'redue_llms_resolve_nap' ) ) {
	function redue_llms_resolve_nap() {
		$blob = '';
		if ( function_exists('redue_scan_site_file_corpus') ) {
			$blob .= ' ' . redue_scan_site_file_corpus();
		}
		if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
			foreach ( array('cf_title', 'cf_tel', 'cf_phone', 'cf_admin_name', 'cf_1', 'cf_2', 'cf_3', 'cf_add_meta') as $_ck ) {
				if ( ! empty($GLOBALS['config'][$_ck]) && is_string($GLOBALS['config'][$_ck]) ) {
					$blob .= ' ' . $GLOBALS['config'][$_ck];
				}
			}
		}
		$blob = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($blob) : trim(preg_replace('/\s+/u', ' ', is_string($blob) ? $blob : ''));
		$address = '';
		if ( isset($GLOBALS['redue_street']) && is_string($GLOBALS['redue_street']) ) {
			$address = redue_llms_extract_address($GLOBALS['redue_street']);
		}
		if ( $address === '' ) {
			$address = redue_llms_extract_address($blob);
		}
		$tel = '';
		if ( function_exists('redue_resolve_universal_telephone') ) {
			$tel = redue_resolve_universal_telephone($blob);
		}
		$tel = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($tel) : ( is_string($tel) ? $tel : '' );
		$rep = '';
		if ( function_exists('redue_resolve_rep_identity') ) {
			$_id = redue_resolve_rep_identity();
			if ( is_array($_id) && ! empty($_id['name']) && is_string($_id['name']) ) {
				$rep = redue_llms_plain_string($_id['name']);
			}
		}
		if ( $rep === '' && isset($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) ) {
			$rep = redue_llms_plain_string($GLOBALS['redue_rep_name']);
		}
		if ( $rep === '' && isset($GLOBALS['config']['cf_admin_name']) && is_string($GLOBALS['config']['cf_admin_name']) ) {
			$rep = redue_llms_plain_string($GLOBALS['config']['cf_admin_name']);
		}
		return array(
			'address' => $address,
			'telephone' => $tel,
			'representative' => $rep,
			'hours' => function_exists('redue_llms_hours') ? redue_llms_hours() : '',
		);
	}
}
if ( ! function_exists( 'redue_llms_build_dataset' ) ) {
	function redue_llms_build_dataset() {
		$origin = function_exists('redue_site_origin') ? redue_site_origin() : '';
		$origin = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($origin) : ( is_string($origin) ? $origin : '' );
		$origin = rtrim($origin, '/');
		$site = function_exists('redue_resolve_site_name') ? redue_resolve_site_name() : '';
		$site = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($site) : ( is_string($site) ? $site : '' );
		if ( $site === '' ) { $site = '웹사이트'; }
		$nap = function_exists('redue_llms_resolve_nap') ? redue_llms_resolve_nap() : array();
		$menus = function_exists('redue_llms_collect_menus') ? redue_llms_collect_menus($origin, $site) : array();
		$services = array();
		$info = array();
		$stops = array();
		foreach ( $menus as $_m ) {
			if ( ! is_array($_m) || empty($_m['name']) || ! is_string($_m['name']) ) { continue; }
			$stops[] = $_m['name'];
			$html = function_exists('redue_llms_read_page_html') ? redue_llms_read_page_html(isset($_m['url']) ? $_m['url'] : '', isset($_m['stem']) ? $_m['stem'] : '') : '';
			$heading = function_exists('redue_llms_extract_heading') ? redue_llms_extract_heading($html, $site) : '';
			$title = function_exists('redue_llms_page_title')
				? redue_llms_page_title($_m['name'], $heading, '', isset($_m['stem']) ? $_m['stem'] : '', $site)
				: $_m['name'];
			if ( $title === '' ) { continue; }
			$desc = function_exists('redue_llms_clean_body') ? redue_llms_clean_body($html, array($title, $site)) : '';
			$row = array(
				'name' => $title,
				'url' => isset($_m['url']) && is_string($_m['url']) ? $_m['url'] : $origin . '/',
				'desc' => $desc,
			);
			if ( function_exists('redue_llms_is_service_menu') && redue_llms_is_service_menu($title) ) {
				$services[] = $row;
			} else {
				$info[] = $row;
			}
		}
		$intro_src = '';
		if ( function_exists('redue_scan_site_file_corpus') ) {
			$intro_src = redue_scan_site_file_corpus();
		}
		return array(
			'site' => $site,
			'origin' => $origin,
			'nap' => is_array($nap) ? $nap : array(),
			'services' => $services,
			'info' => $info,
			'menus' => $menus,
			'intro' => function_exists('redue_llms_clean_body') ? redue_llms_clean_body($intro_src, $stops) : '',
			'industry' => function_exists('redue_llms_industry_label') ? redue_llms_industry_label() : '',
			'faqs' => function_exists('redue_llms_collect_faqs') ? redue_llms_collect_faqs() : array(),
		);
	}
}
if ( ! function_exists( 'redue_generate_llms_txt' ) ) {
	function redue_generate_llms_txt() {
		$data = function_exists('redue_llms_build_dataset') ? redue_llms_build_dataset() : array();
		$site = isset($data['site']) && is_string($data['site']) ? $data['site'] : '웹사이트';
		$origin = isset($data['origin']) && is_string($data['origin']) ? $data['origin'] : '';
		$nap = isset($data['nap']) && is_array($data['nap']) ? $data['nap'] : array();
		$services = isset($data['services']) && is_array($data['services']) ? $data['services'] : array();
		$info = isset($data['info']) && is_array($data['info']) ? $data['info'] : array();
		$intro = isset($data['intro']) && is_string($data['intro']) && $data['intro'] !== '' ? $data['intro'] : ( $site . ' 공식 웹사이트입니다.' );
		$industry = isset($data['industry']) && is_string($data['industry']) ? $data['industry'] : '';
		$faqs = isset($data['faqs']) && is_array($data['faqs']) ? $data['faqs'] : array();
		$lines = array('# ' . $site, '', $intro, '', '## 핵심 정보', '');
		if ( $industry !== '' ) { $lines[] = '- 업종: ' . $industry; }
		if ( ! empty($nap['representative']) && is_string($nap['representative']) ) { $lines[] = '- 대표자: ' . $nap['representative']; }
		if ( ! empty($nap['telephone']) && is_string($nap['telephone']) ) { $lines[] = '- 연락처: ' . $nap['telephone']; }
		if ( ! empty($nap['address']) && is_string($nap['address']) ) { $lines[] = '- 주소: ' . $nap['address']; }
		if ( ! empty($nap['hours']) && is_string($nap['hours']) ) { $lines[] = '- 운영시간: ' . $nap['hours']; }
		if ( $origin !== '' ) { $lines[] = '- 공식 도메인: ' . $origin; }
		$svc_n = 0;
		foreach ( $services as $_s ) {
			if ( ! is_array($_s) || empty($_s['name']) || ! is_string($_s['name']) ) { continue; }
			if ( $svc_n === 0 ) { $lines[] = ''; $lines[] = '## 주요 서비스 및 진료과목'; $lines[] = ''; }
			$lines[] = '- ' . $_s['name'];
			$svc_n++;
			if ( $svc_n >= 8 ) { break; }
		}
		$links = array_merge($info, $services);
		$link_n = 0;
		foreach ( $links as $_l ) {
			if ( ! is_array($_l) || empty($_l['name']) || ! is_string($_l['name']) || empty($_l['url']) || ! is_string($_l['url']) ) { continue; }
			if ( $link_n === 0 ) { $lines[] = ''; $lines[] = '## 주요 안내 링크'; $lines[] = ''; }
			$lines[] = '- [' . $_l['name'] . '](' . $_l['url'] . ')';
			$link_n++;
			if ( $link_n >= 16 ) { break; }
		}
		$faq_n = 0;
		foreach ( $faqs as $_f ) {
			if ( ! is_array($_f) || empty($_f['q']) || ! is_string($_f['q']) || empty($_f['a']) || ! is_string($_f['a']) ) { continue; }
			if ( $faq_n === 0 ) { $lines[] = ''; $lines[] = '## FAQ'; $lines[] = ''; }
			$lines[] = '### ' . $_f['q'];
			$lines[] = '';
			$lines[] = $_f['a'];
			$lines[] = '';
			$faq_n++;
			if ( $faq_n >= 8 ) { break; }
		}
		$md = implode("\n", $lines);
		$md = preg_replace("/\n{3,}/", "\n\n", is_string($md) ? $md : '');
		return is_string($md) ? trim($md) . "\n" : '';
	}
}
if ( ! function_exists( 'redue_generate_llms_full_txt' ) ) {
	function redue_generate_llms_full_txt() {
		$data = function_exists('redue_llms_build_dataset') ? redue_llms_build_dataset() : array();
		$site = isset($data['site']) && is_string($data['site']) ? $data['site'] : '웹사이트';
		$origin = isset($data['origin']) && is_string($data['origin']) ? $data['origin'] : '';
		$nap = isset($data['nap']) && is_array($data['nap']) ? $data['nap'] : array();
		$services = isset($data['services']) && is_array($data['services']) ? $data['services'] : array();
		$info = isset($data['info']) && is_array($data['info']) ? $data['info'] : array();
		$menus = isset($data['menus']) && is_array($data['menus']) ? $data['menus'] : array();
		$intro = isset($data['intro']) && is_string($data['intro']) && $data['intro'] !== '' ? $data['intro'] : ( $site . ' 공식 웹사이트 엔티티 개요입니다.' );
		$industry = isset($data['industry']) && is_string($data['industry']) ? $data['industry'] : '';
		$faqs = isset($data['faqs']) && is_array($data['faqs']) ? $data['faqs'] : array();
		$lines = array('# ' . $site . ' — 심층 인용 전문 (llms-full)', '', '## 상세 소개 및 엔티티 개요', '', $intro);
		if ( $industry !== '' ) { $lines[] = ''; $lines[] = '업종: ' . $industry; }
		$lines[] = '';
		$lines[] = '## 운영 정보';
		$lines[] = '';
		if ( ! empty($nap['representative']) && is_string($nap['representative']) ) { $lines[] = '- 대표자: ' . $nap['representative']; }
		if ( ! empty($nap['telephone']) && is_string($nap['telephone']) ) { $lines[] = '- 연락처: ' . $nap['telephone']; }
		if ( ! empty($nap['address']) && is_string($nap['address']) ) { $lines[] = '- 주소: ' . $nap['address']; }
		if ( ! empty($nap['hours']) && is_string($nap['hours']) ) { $lines[] = '- 운영시간: ' . $nap['hours']; }
		if ( $origin !== '' ) { $lines[] = '- 공식 도메인: ' . $origin; }
		$lines[] = '';
		$lines[] = '## 서비스 및 안내 상세';
		$lines[] = '';
		$details = array_merge($services, $info);
		if ( count($details) === 0 ) {
			$lines[] = $site . '의 상세 안내는 공식 홈페이지를 확인해 주세요.';
		} else {
			foreach ( $details as $_d ) {
				if ( ! is_array($_d) || empty($_d['name']) || ! is_string($_d['name']) ) { continue; }
				$desc = ! empty($_d['desc']) && is_string($_d['desc']) ? $_d['desc'] : ( $site . ' ' . $_d['name'] . ' 안내 페이지입니다.' );
				$url = ! empty($_d['url']) && is_string($_d['url']) ? $_d['url'] : $origin . '/';
				$lines[] = '### ' . $_d['name'];
				$lines[] = '';
				$lines[] = $desc;
				$lines[] = '';
				$lines[] = '- URL: ' . $url;
				$lines[] = '';
			}
		}
		$nav_n = 0;
		foreach ( $menus as $_m ) {
			if ( ! is_array($_m) || empty($_m['name']) || ! is_string($_m['name']) || empty($_m['url']) || ! is_string($_m['url']) ) { continue; }
			if ( $nav_n === 0 ) { $lines[] = '## 사이트 전체 메뉴 구조'; $lines[] = ''; }
			$lines[] = '- [' . $_m['name'] . '](' . $_m['url'] . ')';
			$nav_n++;
		}
		$faq_n = 0;
		foreach ( $faqs as $_f ) {
			if ( ! is_array($_f) || empty($_f['q']) || ! is_string($_f['q']) || empty($_f['a']) || ! is_string($_f['a']) ) { continue; }
			if ( $faq_n === 0 ) { $lines[] = ''; $lines[] = '## FAQ'; $lines[] = ''; }
			$lines[] = '### ' . $_f['q'];
			$lines[] = '';
			$lines[] = $_f['a'];
			$lines[] = '';
			$faq_n++;
		}
		if ( $origin !== '' ) {
			$lines[] = '';
			$lines[] = '## 관련 표준 파일';
			$lines[] = '';
			$lines[] = '- ' . $origin . '/llms.txt';
			$lines[] = '- ' . $origin . '/llms-full.txt';
			$lines[] = '- ' . $origin . '/sitemap.xml';
			$lines[] = '- ' . $origin . '/robots.txt';
		}
		$md = implode("\n", $lines);
		$md = preg_replace("/\n{3,}/", "\n\n", is_string($md) ? $md : '');
		return is_string($md) ? trim($md) . "\n" : '';
	}
}
if ( ! function_exists( 'redue_llms_refresh_root_files' ) ) {
	function redue_llms_refresh_root_files( $force = false ) {
		static $done = false;
		if ( $done && ! $force ) { return; }
		$done = true;
		$root = defined('G5_PATH') && is_string(G5_PATH) ? G5_PATH : '';
		if ( $root === '' || ! is_dir($root) ) { return; }
		$txt = $root . '/llms.txt';
		$full = $root . '/llms-full.txt';
		$ttl = 21600;
		if ( ! $force && is_file($txt) && ( time() - (int) @filemtime($txt) ) < $ttl ) { return; }
		$md = function_exists('redue_generate_llms_txt') ? redue_generate_llms_txt() : '';
		$mdf = function_exists('redue_generate_llms_full_txt') ? redue_generate_llms_full_txt() : '';
		if ( is_string($md) && $md !== '' ) { @file_put_contents($txt, $md, LOCK_EX); }
		if ( is_string($mdf) && $mdf !== '' ) { @file_put_contents($full, $mdf, LOCK_EX); }
	}
}
if ( ! function_exists( 'redue_llms_maybe_serve' ) ) {
	function redue_llms_maybe_serve() {
		if ( defined('G5_IS_ADMIN') && G5_IS_ADMIN ) { return; }
		$path = '';
		if ( ! empty($_SERVER['REQUEST_URI']) ) {
			$p = parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH);
			$path = is_string($p) ? $p : '';
		}
		$kind = '';
		if ( isset($_GET['redue_llms']) && is_string($_GET['redue_llms']) ) {
			$kind = strtolower(trim($_GET['redue_llms']));
		} elseif ( preg_match('#/(llms-full)\.txt$#i', $path) ) {
			$kind = 'full';
		} elseif ( preg_match('#/(llms)\.txt$#i', $path) ) {
			$kind = 'txt';
		}
		if ( $kind !== 'txt' && $kind !== 'full' && $kind !== '1' ) { return; }
		$md = ( $kind === 'full' )
			? ( function_exists('redue_generate_llms_full_txt') ? redue_generate_llms_full_txt() : '' )
			: ( function_exists('redue_generate_llms_txt') ? redue_generate_llms_txt() : '' );
		if ( ! is_string($md) || $md === '' ) { return; }
		if ( ! headers_sent() ) {
			header('Content-Type: text/markdown; charset=UTF-8');
			header('X-Content-Type-Options: nosniff');
			header('Cache-Control: public, max-age=3600');
		}
		echo $md;
		exit;
	}
}
if ( ! function_exists( 'redue_llms_boot' ) ) {
	function redue_llms_boot() {
		if ( defined('G5_IS_ADMIN') && G5_IS_ADMIN ) { return; }
		if ( isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST' ) { return; }
		if ( empty($_GET['redue_llms']) && !(isset($_SERVER['REQUEST_URI']) && preg_match('#/llms(-full)?\.txt#i', $_SERVER['REQUEST_URI'])) ) { return; }
		if ( function_exists('redue_llms_maybe_serve') ) { redue_llms_maybe_serve(); }
	}
}

// 4. Phase 1 — 렌더링 전용 함수. 여기서는 절대 즉시 실행/즉시 echo 하지 않는다.
//    실제 출력은 charset 메타 태그 바로 아래(REDUE_AI_STUDIO_RENDER 블록)의
//    렌더 호출문에서만 수행되어 문서 최상단 출력 덤프를 방지한다.
if ( ! function_exists( 'redue_render_full_schema' ) ) {
	function redue_render_full_schema() {
		ob_start();
		redue_dynamic_schema_controller_safe();
		$out = ob_get_clean();
		return is_string( $out ) ? $out : '';
	}
}
/* REDUE_AI_STUDIO:END */
if (defined('G5_IS_ADMIN') && G5_IS_ADMIN) return;
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') return;
if (!empty($_GET['redue_llms']) || (isset($_SERVER['REQUEST_URI']) && preg_match('#/llms(-full)?\.txt#i', $_SERVER['REQUEST_URI']))) {
	try {
		if (function_exists('redue_llms_maybe_serve')) {
			redue_llms_maybe_serve();
		}
	} catch (\Exception $_redue_extend_boot) {} catch (\Throwable $_redue_extend_boot) {}
}

