<?php
/**
 * REDUE AI STUDIO — Universal Multi-CMS Schema & Meta Auto-Injection Engine
 * File: /extend/redue.schema.php
 * Primary Targets : GnuBoard 5 / Youngcart 5 (동일 코어) — 기타 CMS(WordPress, Rhymix/XE, 커스텀 PHP)도 자동 감지 지원
 *
 * ────────────────────────────────────────────────────────────────────────
 *  핵심 동작
 *  1) CMS 환경 자동 감지 → 알맞은 훅/버퍼에 자동 바인딩 (수동 설정 불필요)
 *  2) $GLOBALS['redue_entity_type'] 값으로 업종 무관 최상위 노드 타입을 동적 지정
 *     (미지정 시 기본값 Organization — No hardcoded industry guessing)
 *  3) 대표자/주소/좌표/SNS/영업시간/서비스카탈로그/FAQ/영상/영카트 상품 등
 *     "실제 값이 존재하는 항목만" @graph 에 병합 — 재귀 array_filter 로
 *     빈 문자열("")·빈 배열([])이 JSON-LD 에 절대 남지 않는 100% Null-Safe 구조
 *  4) description / og:description 은 네이버 서치어드바이저 기준 80자 컷오프
 *     (mb_substr(...,0,78,'UTF-8').'..') 로 자동 정제 후 Schema·OG·Twitter에 1:1 동기화
 *  5) redue_auto_patch_head_sub() — 활성 테마(head.sub.php)에 컨트롤러 호출 코드를
 *     1회성으로 자동 삽입(Self-Patching)하여 <head> 내부에서 메타/JSON-LD를 정확히 출력
 * ────────────────────────────────────────────────────────────────────────
 */

if (defined('G5_IS_ADMIN') && G5_IS_ADMIN) { return; }
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') { return; }

/* ═══════════════════════════════════════════════════════════════════════
 * 1. 엔티티 & 기본 비즈니스 메타 설정 (No-Fake-Data — 실제 값만 기입)
 * ═══════════════════════════════════════════════════════════════════════ */
$GLOBALS['redue_rep_name']   = '배우리';
$GLOBALS['redue_rep_title']  = '대표원장';
$GLOBALS['redue_tel']        = '053-746-9191';
$GLOBALS['redue_fax']        = '053-746-9192';
$GLOBALS['redue_tax_id']     = '202-03-99357';
$GLOBALS['redue_legal_name'] = '나인원의원';
$GLOBALS['redue_street']     = '대구 동구 동부로26길 6 대구메리어트호텔 및 서비스드레지던스 203-205호';
$GLOBALS['redue_lat']        = 35.8754951;
$GLOBALS['redue_lng']        = 128.6276741;

/* 업종/최상위 노드 타입 — 문자열 또는 배열, 미지정 시 자동 기본값 'Organization'
 * 예: 'MedicalClinic', 'LocalBusiness', array('Restaurant','FoodEstablishment'),
 *     'Store' (영카트5 쇼핑몰), 'LegalService' 등 — 업종 자유 지정
 */
$GLOBALS['redue_entity_type'] = array('MedicalClinic', 'LocalBusiness');

/* Open Graph / Twitter 카드용 대표 이미지 — 절대경로 URL이 실제 존재할 때만 사용 (No-Fake-Data) */
$GLOBALS['redue_og_image'] = '';

$GLOBALS['redue_same_as'] = array(
	'https://map.naver.com/p/entry/place/1531248795',
	'https://m.place.naver.com/hospital/1531248795/home',
	'https://www.google.com/maps/place/%EB%82%98%EC%9D%B8%EC%9B%90%EC%9D%98%EC%9B%90/data=!4m6!3m5!1s0x3565e1618f9f64bf:0x2703ee43a570d7e!8m2!3d35.8754951!4d128.6276741!16s%2Fg%2F11swgg1twc',
	'https://pf.kakao.com/_Lbxamb',
	'https://blog.naver.com/9nine1one',
	'https://www.instagram.com/9oneclinic',
	'https://www.youtube.com/watch?v=0qaZmo6E7Qw',
);

/* 영업시간 — 실제 값이 있을 때만 openingHoursSpecification 생성 (No-Fake-Data)
 * $GLOBALS['redue_hours'] = array(
 *     array('days' => array('Monday','Tuesday','Wednesday','Thursday','Friday'), 'opens' => '10:00', 'closes' => '19:00'),
 * );
 */
$GLOBALS['redue_hours'] = array();

/* 서비스·진료과목·상품 카탈로그 — 유효 항목이 있을 때만 hasOfferCatalog / availableService 병합 (No-Fake-Data)
 * $GLOBALS['redue_service_catalog'] = array(
 *     array('name' => '정밀 맞춤 진단', 'category' => '진단 및 분석', 'description' => '환자별 맞춤형 진단 솔루션'),
 * );
 */
$GLOBALS['redue_service_catalog'] = array();

if (!defined('REDUE_UNIVERSAL_SCHEMA_ENGINE')) {
	define('REDUE_UNIVERSAL_SCHEMA_ENGINE', '2.0.0');

	/* ═══════════════════════════════════════════════════════════════════
	 * 2. 유튜브 실시간 정규식 감지 함수 (watch / youtu.be / embed / shorts / iframe 전부 커버)
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!function_exists('redue_detect_youtube_videos')) {
		function redue_detect_youtube_videos($html) {
			if (empty($html) || !is_string($html)) return array();
			$pattern = '/(?:https?:)?(?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i';
			if (preg_match_all($pattern, $html, $matches)) {
				return array_values(array_unique($matches[1]));
			}
			return array();
		}
	}

	/* ═══════════════════════════════════════════════════════════════════
	 * 3. 환경별 프로토콜 / Origin / Canonical 판별 함수
	 *    HTTPS·443 포트·프록시 헤더(X-Forwarded-Proto) 자동 감지 + 추적 파라미터
	 *    (utm_*, gclid, fbclid 등)만 제거하고 CMS rewrite 파라미터(bo_table, mid 등)는 보존
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!function_exists('redue_jsonld_flags')) {
		function redue_jsonld_flags() {
			return JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT;
		}
	}

	if (!function_exists('redue_trim')) {
		function redue_trim($v) {
			return is_string($v) ? trim($v) : '';
		}
	}

	if (!function_exists('redue_esc_attr')) {
		function redue_esc_attr($v) {
			return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
		}
	}

	if (!function_exists('redue_truncate_text')) {
		function redue_truncate_text($text, $len = 160) {
			$text = is_string($text) ? trim(preg_replace('/\s+/u', ' ', $text)) : '';
			if ($text === '') return '';
			if (function_exists('mb_strlen') && mb_strlen($text, 'UTF-8') > $len) {
				return mb_substr($text, 0, $len, 'UTF-8') . '…';
			}
			if (!function_exists('mb_strlen') && strlen($text) > $len) {
				return substr($text, 0, $len) . '…';
			}
			return $text;
		}
	}

	/* 네이버 서치어드바이저 80자 컷오프 — description / og:description 전용 정제 함수
	 * 78자로 자르고 '..' 두 개의 점을 붙여 총 노출 길이가 80자를 넘지 않도록 보장한다.
	 */
	if (!function_exists('redue_truncate_meta_description')) {
		function redue_truncate_meta_description($text, $limit = 80) {
			$text = is_string($text) ? trim(preg_replace('/\s+/u', ' ', $text)) : '';
			if ($text === '') return '';
			if (function_exists('mb_strlen')) {
				if (mb_strlen($text, 'UTF-8') > $limit) {
					return mb_substr($text, 0, $limit - 2, 'UTF-8') . '..';
				}
				return $text;
			}
			if (strlen($text) > $limit) {
				return substr($text, 0, $limit - 2) . '..';
			}
			return $text;
		}
	}

	if (!function_exists('redue_plain_text')) {
		function redue_plain_text($html) {
			if (!is_string($html) || $html === '') return '';
			$plain = preg_replace('/<script\b[^>]*>[\s\S]*?<\/script>/i', ' ', $html);
			$plain = preg_replace('/<style\b[^>]*>[\s\S]*?<\/style>/i', ' ', is_string($plain) ? $plain : '');
			$plain = html_entity_decode(strip_tags(is_string($plain) ? $plain : ''), ENT_QUOTES, 'UTF-8');
			$plain = preg_replace('/\s+/u', ' ', is_string($plain) ? $plain : '');
			return is_string($plain) ? trim($plain) : '';
		}
	}

	/* ═══════════════════════════════════════════════════════════════════
	 * 3a. 재귀적 Null-Safe 필터 — @graph 전체를 순회하며 null / "" / [] 을
	 *     완전히 제거하고, 리스트형(순번 키) 배열은 재색인(array_values)하여
	 *     JSON 인코딩 시 object로 오인되는 것을 방지한다.
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!function_exists('redue_is_sequential_array')) {
		function redue_is_sequential_array($arr) {
			if (!is_array($arr)) return false;
			foreach (array_keys($arr) as $k) {
				if (!is_int($k)) return false;
			}
			return true;
		}
	}

	if (!function_exists('redue_recursive_filter')) {
		function redue_recursive_filter($data) {
			if (!is_array($data)) return $data;
			$is_list = redue_is_sequential_array($data);
			$out = array();
			foreach ($data as $k => $v) {
				$v = redue_recursive_filter($v);
				if ($v === null) continue;
				if (is_string($v) && trim($v) === '') continue;
				if (is_array($v) && count($v) === 0) continue;
				$out[$k] = $v;
			}
			if ($is_list) { $out = array_values($out); }
			return $out;
		}
	}

	if (!function_exists('redue_detect_site_protocol')) {
		function redue_detect_site_protocol() {
			if (defined('G5_URL') && is_string(G5_URL) && preg_match('#^(https?)://#i', G5_URL, $m)) {
				return strtolower($m[1]);
			}
			if (function_exists('home_url')) {
				$home = home_url('/');
				if (is_string($home) && preg_match('#^(https?)://#i', $home, $m)) {
					return strtolower($m[1]);
				}
			}
			if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
				$fwd = strtolower(trim(explode(',', (string) $_SERVER['HTTP_X_FORWARDED_PROTO'])[0]));
				if ($fwd === 'https' || $fwd === 'http') return $fwd;
			}
			if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' && $_SERVER['HTTPS'] !== '0') {
				return 'https';
			}
			if (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443') {
				return 'https';
			}
			if (!empty($_SERVER['REQUEST_SCHEME']) && strtolower((string) $_SERVER['REQUEST_SCHEME']) === 'https') {
				return 'https';
			}
			return 'http';
		}
	}

	if (!function_exists('redue_align_url_protocol')) {
		function redue_align_url_protocol($url) {
			if (!is_string($url) || $url === '' || !preg_match('#^https?://#i', $url)) return $url;
			return preg_replace('#^https?://#i', redue_detect_site_protocol() . '://', $url);
		}
	}

	if (!function_exists('redue_site_origin')) {
		function redue_site_origin() {
			$proto = redue_detect_site_protocol();
			if (defined('G5_URL') && G5_URL !== '') {
				return rtrim(preg_replace('#^https?://#i', $proto . '://', (string) G5_URL), '/');
			}
			if (function_exists('home_url')) {
				$home = home_url('/');
				if (is_string($home) && $home !== '') {
					return rtrim(preg_replace('#^https?://#i', $proto . '://', $home), '/');
				}
			}
			$host = '';
			if (!empty($_SERVER['HTTP_HOST'])) { $host = (string) $_SERVER['HTTP_HOST']; }
			elseif (!empty($_SERVER['SERVER_NAME'])) { $host = (string) $_SERVER['SERVER_NAME']; }
			if ($host === '') { $host = 'localhost'; }
			$host = preg_replace('#^https?://#i', '', $host);
			return $proto . '://' . $host;
		}
	}

	if (!function_exists('redue_clean_query_string')) {
		function redue_clean_query_string($qs) {
			if (!is_string($qs) || $qs === '') return '';
			parse_str($qs, $params);
			if (!is_array($params) || count($params) === 0) return '';
			$strip = array(
				'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
				'gclid', 'fbclid', 'msclkid', 'yclid', 'gad_source', 'gbraid', 'wbraid',
				'PHPSESSID', 'sid', 'session', 'ref', 'fbtoken', '_ga', 'igshid', 'spm',
			);
			foreach ($strip as $k) { unset($params[$k]); }
			if (count($params) === 0) return '';
			return http_build_query($params);
		}
	}

	if (!function_exists('redue_resolve_canonical_url')) {
		function redue_resolve_canonical_url($origin) {
			if (defined('ABSPATH')) {
				if (function_exists('is_front_page') && function_exists('is_home') && (is_front_page() || is_home()) && function_exists('home_url')) {
					return rtrim(home_url('/'), '/') . '/';
				}
				if (function_exists('wp_get_canonical_url')) {
					$c = wp_get_canonical_url();
					if (is_string($c) && $c !== '') return redue_align_url_protocol($c);
				}
				if (function_exists('get_permalink')) {
					$p = get_permalink();
					if (is_string($p) && $p !== '') return redue_align_url_protocol($p);
				}
				if (function_exists('home_url')) return rtrim(home_url('/'), '/') . '/';
			}
			if ((defined('RX_VERSION') || defined('__XE__')) && class_exists('Context') && method_exists('Context', 'getRequestUri')) {
				$url = @Context::getRequestUri();
				if (is_string($url) && $url !== '') return redue_align_url_protocol($url);
			}
			$path = '/';
			$query = '';
			if (!empty($_SERVER['REQUEST_URI'])) {
				$req = (string) $_SERVER['REQUEST_URI'];
				$p = parse_url($req, PHP_URL_PATH);
				$q = parse_url($req, PHP_URL_QUERY);
				if (is_string($p) && $p !== '') { $path = $p; }
				if (is_string($q)) { $query = $q; }
			}
			$clean_query = redue_clean_query_string($query);
			return rtrim($origin, '/') . $path . ($clean_query !== '' ? '?' . $clean_query : '');
		}
	}

	/* ═══════════════════════════════════════════════════════════════════
	 * 3b. 출력 버퍼 캡처 — 어떤 CMS든 렌더링된 최종 HTML 전체를 확보해
	 *     유튜브/FAQ 탐지의 최후 소스로 사용 (ob_get_contents, 논-디스트럭티브)
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!isset($GLOBALS['redue_ob_level'])) { $GLOBALS['redue_ob_level'] = null; }

	if (!function_exists('redue_start_capture_buffer')) {
		function redue_start_capture_buffer() {
			if ($GLOBALS['redue_ob_level'] !== null) return;
			if (!function_exists('ob_start')) return;
			if (@ob_start()) {
				$GLOBALS['redue_ob_level'] = ob_get_level();
			}
		}
	}

	if (!function_exists('redue_get_captured_buffer')) {
		function redue_get_captured_buffer() {
			if (empty($GLOBALS['redue_ob_level'])) return '';
			if (!function_exists('ob_get_level') || !function_exists('ob_get_contents')) return '';
			if (ob_get_level() < $GLOBALS['redue_ob_level']) return '';
			$c = @ob_get_contents();
			return is_string($c) ? $c : '';
		}
	}

	if (!function_exists('redue_should_skip_universal_engine')) {
		function redue_should_skip_universal_engine() {
			if (defined('G5_IS_ADMIN') && G5_IS_ADMIN) return true;
			if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'POST') return true;
			if (defined('ABSPATH')) {
				if (function_exists('is_admin') && is_admin()) return true;
				if (function_exists('wp_doing_ajax') && wp_doing_ajax()) return true;
				if (function_exists('wp_doing_cron') && wp_doing_cron()) return true;
				if (defined('REST_REQUEST') && REST_REQUEST) return true;
				if (defined('XMLRPC_REQUEST') && XMLRPC_REQUEST) return true;
				if (function_exists('is_feed') && is_feed()) return true;
			}
			return false;
		}
	}

	/* ═══════════════════════════════════════════════════════════════════
	 * 3c. CMS별 페이지 컨텍스트(제목/설명/본문/발행일) 추출 — 자동 감지
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!function_exists('redue_resolve_site_name')) {
		function redue_resolve_site_name() {
			if (defined('_GNUBOARD_')) {
				global $config;
				if (!empty($config['cf_title']) && is_string($config['cf_title'])) {
					return trim(strip_tags($config['cf_title']));
				}
			} elseif (defined('ABSPATH') && function_exists('get_bloginfo')) {
				$n = redue_trim(get_bloginfo('name'));
				if ($n !== '') return $n;
			} elseif ((defined('RX_VERSION') || defined('__XE__')) && class_exists('Context')) {
				$n = @Context::get('site_title');
				if (is_string($n) && trim($n) !== '') return trim($n);
			}
			return !empty($GLOBALS['redue_legal_name']) ? $GLOBALS['redue_legal_name'] : '웹사이트';
		}
	}

	/* 영카트5 상품 상세(item.php) 컨텍스트 — $it 전역이 존재하고 유효할 때만 동작 (No-Fake-Data) */
	if (!function_exists('redue_yc5_item_context')) {
		function redue_yc5_item_context() {
			global $it;
			if (!isset($it) || !is_array($it) || empty($it['it_id'])) return null;
			$name = '';
			if (!empty($it['it_name']) && is_string($it['it_name'])) { $name = trim(strip_tags($it['it_name'])); }
			if ($name === '') return null;

			$desc_src = '';
			if (!empty($it['it_basic']) && is_string($it['it_basic'])) { $desc_src = $it['it_basic']; }
			elseif (!empty($it['it_explan']) && is_string($it['it_explan'])) { $desc_src = $it['it_explan']; }

			$price = 0;
			if (isset($it['it_price']) && is_numeric($it['it_price']) && (float) $it['it_price'] > 0) {
				$price = (float) $it['it_price'];
			} elseif (isset($it['it_cust_price']) && is_numeric($it['it_cust_price']) && (float) $it['it_cust_price'] > 0) {
				$price = (float) $it['it_cust_price'];
			}

			$image = '';
			if (!empty($it['it_img1']) && is_string($it['it_img1']) && preg_match('#^https?://#i', $it['it_img1'])) {
				$image = $it['it_img1'];
			}

			$availability = '';
			if (isset($it['it_stock_qty']) && is_numeric($it['it_stock_qty'])) {
				$availability = ((int) $it['it_stock_qty'] > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
			}

			$category = '';
			if (!empty($it['ca_id']) && is_string($it['ca_id'])) { $category = trim($it['ca_id']); }

			return array(
				'id' => (string) $it['it_id'],
				'name' => $name,
				'description' => redue_plain_text($desc_src),
				'price' => $price,
				'image' => $image,
				'availability' => $availability,
				'category' => $category,
			);
		}
	}

	if (!function_exists('redue_gnuboard_page_context')) {
		function redue_gnuboard_page_context() {
			global $g5_head_title, $config, $view, $write, $board, $bo_table, $wr_id, $co_id, $it;

			$item = redue_yc5_item_context();
			if (is_array($item)) {
				return array(
					'platform' => 'gnuboard',
					'is_home' => false,
					'type' => 'product',
					'title' => $item['name'],
					'description' => $item['description'],
					'body_html' => (!empty($it['it_basic']) && is_string($it['it_basic'])) ? $it['it_basic'] : '',
					'published' => '',
					'modified' => '',
					'product' => $item,
				);
			}

			$bo = !empty($bo_table) ? (string) $bo_table : (isset($_GET['bo_table']) ? (string) $_GET['bo_table'] : '');
			$wr = !empty($wr_id) ? (string) $wr_id : (isset($_GET['wr_id']) ? (string) $_GET['wr_id'] : '');
			$co = !empty($co_id) ? (string) $co_id : (isset($_GET['co_id']) ? (string) $_GET['co_id'] : '');
			$request_path = !empty($_SERVER['REQUEST_URI']) ? parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH) : '';
			$request_path = is_string($request_path) ? $request_path : '';
			$is_index_request = ($request_path === '' || rtrim($request_path, '/') === '' || preg_match('#/index\.php$#i', $request_path));
			$is_home = ($bo === '' && $wr === '' && $co === '' && $is_index_request);
			$type = 'page';
			if ($is_home) { $type = 'home'; }
			elseif ($wr !== '') { $type = 'article'; }
			elseif ($bo !== '') { $type = 'list'; }
			$title = '';
			if (!empty($g5_head_title) && is_string($g5_head_title)) { $title = trim(strip_tags($g5_head_title)); }
			elseif (!empty($config['cf_title']) && is_string($config['cf_title'])) { $title = trim(strip_tags($config['cf_title'])); }
			$body = '';
			if (!empty($view['wr_content'])) { $body = (string) $view['wr_content']; }
			elseif (!empty($write['wr_content'])) { $body = (string) $write['wr_content']; }
			$published = '';
			if (!empty($view['wr_datetime'])) { $published = date('c', strtotime((string) $view['wr_datetime'])); }
			return array(
				'platform' => 'gnuboard',
				'is_home' => $is_home,
				'type' => $type,
				'title' => $title,
				'description' => redue_plain_text($body),
				'body_html' => $body,
				'published' => $published,
				'modified' => '',
			);
		}
	}

	if (!function_exists('redue_wordpress_page_context')) {
		function redue_wordpress_page_context() {
			$is_home = function_exists('is_front_page') && function_exists('is_home') && (is_front_page() || is_home());
			$type = 'page';
			if ($is_home) { $type = 'home'; }
			elseif (function_exists('is_single') && is_single()) { $type = 'article'; }
			elseif ((function_exists('is_category') && is_category()) || (function_exists('is_archive') && is_archive())) { $type = 'list'; }
			$title = function_exists('get_the_title') ? redue_trim(get_the_title()) : '';
			$body = '';
			global $post;
			if (!empty($post) && function_exists('get_the_content')) {
				$body = (string) get_the_content(null, false, $post);
			}
			$desc = '';
			if (function_exists('get_the_excerpt')) { $desc = redue_plain_text((string) get_the_excerpt()); }
			if ($desc === '') { $desc = redue_plain_text($body); }
			if ($desc === '' && $is_home && function_exists('get_bloginfo')) { $desc = redue_trim(get_bloginfo('description')); }
			$published = function_exists('get_the_date') ? redue_trim(get_the_date('c')) : '';
			$modified = function_exists('get_the_modified_date') ? redue_trim(get_the_modified_date('c')) : '';
			return array(
				'platform' => 'wordpress',
				'is_home' => $is_home,
				'type' => $type,
				'title' => $title,
				'description' => $desc,
				'body_html' => $body,
				'published' => $published,
				'modified' => $modified,
			);
		}
	}

	if (!function_exists('redue_rhymix_page_context')) {
		function redue_rhymix_page_context() {
			$title = '';
			$body = '';
			$is_home = true;
			$type = 'home';
			if (class_exists('Context')) {
				$document_srl = @Context::get('document_srl');
				$mid = @Context::get('mid');
				if (!empty($document_srl)) {
					$type = 'article';
					$is_home = false;
					if (function_exists('getModel')) {
						$oDocumentModel = @getModel('document');
						if (is_object($oDocumentModel) && method_exists($oDocumentModel, 'getDocument')) {
							$oDocument = $oDocumentModel->getDocument($document_srl);
							if (is_object($oDocument)) {
								if (method_exists($oDocument, 'getTitleText')) { $title = (string) $oDocument->getTitleText(); }
								if (method_exists($oDocument, 'getContentText')) { $body = (string) $oDocument->getContentText(); }
								elseif (method_exists($oDocument, 'get')) { $body = (string) $oDocument->get('content'); }
							}
						}
					}
				} elseif (!empty($mid)) {
					$type = 'list';
					$is_home = false;
				}
				if ($title === '') {
					$bt = @Context::get('browser_title');
					if (is_string($bt) && trim($bt) !== '') { $title = trim($bt); }
				}
			}
			return array(
				'platform' => 'rhymix',
				'is_home' => $is_home,
				'type' => $type,
				'title' => $title,
				'description' => redue_plain_text($body),
				'body_html' => $body,
				'published' => '',
				'modified' => '',
			);
		}
	}

	if (!function_exists('redue_custom_page_context')) {
		function redue_custom_page_context() {
			$html = redue_get_captured_buffer();
			$title = '';
			if (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $m)) {
				$title = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES, 'UTF-8'));
			}
			$desc = '';
			if (preg_match('/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']/i', $html, $m)) {
				$desc = trim(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'));
			}
			$body = '';
			if (preg_match('/<body[^>]*>([\s\S]*?)<\/body>/i', $html, $m)) {
				$body = $m[1];
			}
			if ($desc === '') { $desc = redue_plain_text($body); }
			$path = '/';
			if (!empty($_SERVER['REQUEST_URI'])) {
				$p = parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH);
				if (is_string($p) && $p !== '') { $path = $p; }
			}
			$is_home = ($path === '/' || $path === '' || preg_match('#/(index)\.(php|html?)$#i', $path));
			return array(
				'platform' => 'custom',
				'is_home' => (bool) $is_home,
				'type' => $is_home ? 'home' : 'page',
				'title' => $title,
				'description' => $desc,
				'body_html' => $body,
				'published' => '',
				'modified' => '',
			);
		}
	}

	if (!function_exists('redue_resolve_page_context')) {
		function redue_resolve_page_context() {
			if (defined('_GNUBOARD_')) return redue_gnuboard_page_context();
			if (defined('ABSPATH')) return redue_wordpress_page_context();
			if (defined('RX_VERSION') || defined('__XE__')) return redue_rhymix_page_context();
			return redue_custom_page_context();
		}
	}

	/* ═══════════════════════════════════════════════════════════════════
	 * 3d. 업종 무관 동적 엔티티 타입 리졸버 — $GLOBALS['redue_entity_type'] 기반
	 *     (한국어 키워드 정규식 추론 없음 — 명시적 설정만 신뢰하는 범용 구조)
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!function_exists('redue_resolve_entity_type')) {
		function redue_resolve_entity_type() {
			$raw = isset($GLOBALS['redue_entity_type']) ? $GLOBALS['redue_entity_type'] : '';
			if (!is_array($raw) && !is_string($raw)) { $raw = ''; }
			if (is_array($raw)) {
				$clean = array();
				foreach ($raw as $t) {
					$t = is_string($t) ? trim($t) : '';
					if ($t !== '') { $clean[] = $t; }
				}
				if (count($clean) > 0) { return array_values(array_unique($clean)); }
				return 'Organization';
			}
			$raw = trim($raw);
			return $raw !== '' ? $raw : 'Organization';
		}
	}

	if (!function_exists('redue_entity_type_contains')) {
		function redue_entity_type_contains($needle, $entity_type) {
			$types = is_array($entity_type) ? $entity_type : array($entity_type);
			foreach ($types as $t) {
				if (is_string($t) && stripos($t, $needle) !== false) return true;
			}
			return false;
		}
	}

	if (!function_exists('redue_resolve_page_types')) {
		function redue_resolve_page_types($ctx, $is_medical) {
			$type = isset($ctx['type']) ? $ctx['type'] : 'page';
			if ($type === 'product') { return array('ItemPage'); }
			if ($type === 'home') {
				return $is_medical ? array('MedicalWebPage', 'AboutPage', 'WebPage') : array('AboutPage', 'WebPage');
			}
			if ($type === 'article') { return array('Article'); }
			if ($type === 'list') { return array('CollectionPage'); }
			return $is_medical ? array('MedicalWebPage') : array('WebPage');
		}
	}

	if (!function_exists('redue_infer_kr_address_parts')) {
		function redue_infer_kr_address_parts($street) {
			$out = array('locality' => '', 'region' => '');
			if (!is_string($street) || $street === '') return $out;
			if (preg_match('/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별시|광역시|특별자치시|특별자치도|도)?\s*([가-힣]{1,6}(?:시|군|구))?/u', $street, $m)) {
				$out['region'] = isset($m[1]) ? $m[1] : '';
				$out['locality'] = isset($m[2]) ? $m[2] : '';
			}
			return $out;
		}
	}

	if (!function_exists('redue_normalize_service_catalog')) {
		function redue_normalize_service_catalog($services, $is_medical) {
			$out = array();
			if (!is_array($services) || count($services) === 0) return $out;
			$seen = array();
			foreach ($services as $svc) {
				if (is_string($svc)) {
					$name = trim($svc);
					if ($name === '') continue;
					$key = strtolower($name);
					if (isset($seen[$key])) continue;
					$seen[$key] = true;
					$out[] = array('@type' => $is_medical ? 'MedicalProcedure' : 'Service', 'name' => $name);
					continue;
				}
				if (!is_array($svc) || empty($svc['name'])) continue;
				$name = trim((string) $svc['name']);
				if ($name === '') continue;
				$key = strtolower($name);
				if (isset($seen[$key])) continue;
				$seen[$key] = true;
				$type = !empty($svc['type']) ? (string) $svc['type'] : ($is_medical ? 'MedicalProcedure' : 'Service');
				$node = array('@type' => $type, 'name' => $name);
				if (!empty($svc['category']) && is_string($svc['category'])) { $node['category'] = trim($svc['category']); }
				if (!empty($svc['description']) && is_string($svc['description'])) { $node['description'] = trim($svc['description']); }
				$out[] = $node;
			}
			return $out;
		}
	}

	if (!function_exists('redue_bind_service_catalog')) {
		function redue_bind_service_catalog(&$org, $services) {
			if (!is_array($services) || count($services) === 0) return;
			$offers = array();
			foreach ($services as $item) {
				$offers[] = array('@type' => 'Offer', 'itemOffered' => $item);
			}
			$org['availableService'] = $services;
			$org['hasOfferCatalog'] = array(
				'@type' => 'OfferCatalog',
				'name' => '주요 서비스 및 상품 카탈로그',
				'itemListElement' => $offers,
			);
		}
	}

	if (!function_exists('redue_build_organization')) {
		function redue_build_organization($origin, $home, $entity_types, $is_medical) {
			$g = function ($k) {
				return isset($GLOBALS[$k]) && is_string($GLOBALS[$k]) ? trim($GLOBALS[$k]) : '';
			};
			$site_name = redue_resolve_site_name();
			$legal = $g('redue_legal_name');

			$org = array(
				'@type' => $entity_types,
				'@id' => $origin . '/#organization',
				'name' => $legal !== '' ? $legal : $site_name,
				'url' => $home,
			);
			if ($legal !== '' && $site_name !== '' && $legal !== $site_name) {
				$org['alternateName'] = $site_name;
			}

			$tel = $g('redue_tel');
			if ($tel !== '') { $org['telephone'] = $tel; }
			$fax = $g('redue_fax');
			if ($fax !== '') { $org['faxNumber'] = $fax; }
			$tax = $g('redue_tax_id');
			if ($tax !== '') { $org['taxID'] = $tax; }

			$street = $g('redue_street');
			if ($street !== '') {
				$org['address'] = array('@type' => 'PostalAddress', 'streetAddress' => $street, 'addressCountry' => 'KR');
				$parts = redue_infer_kr_address_parts($street);
				if ($parts['locality'] !== '') { $org['address']['addressLocality'] = $parts['locality']; }
				if ($parts['region'] !== '') { $org['address']['addressRegion'] = $parts['region']; }
			}

			$lat = isset($GLOBALS['redue_lat']) ? $GLOBALS['redue_lat'] : '';
			$lng = isset($GLOBALS['redue_lng']) ? $GLOBALS['redue_lng'] : '';
			if ($lat !== '' && $lng !== '' && is_numeric($lat) && is_numeric($lng)) {
				$org['geo'] = array('@type' => 'GeoCoordinates', 'latitude' => (float) $lat, 'longitude' => (float) $lng);
			}

			$hours = isset($GLOBALS['redue_hours']) && is_array($GLOBALS['redue_hours']) ? $GLOBALS['redue_hours'] : array();
			$spec = array();
			foreach ($hours as $h) {
				if (!is_array($h) || empty($h['opens']) || empty($h['closes']) || empty($h['days'])) continue;
				$spec[] = array(
					'@type' => 'OpeningHoursSpecification',
					'dayOfWeek' => $h['days'],
					'opens' => $h['opens'],
					'closes' => $h['closes'],
				);
			}
			if (count($spec) > 0) { $org['openingHoursSpecification'] = $spec; }

			$same = isset($GLOBALS['redue_same_as']) && is_array($GLOBALS['redue_same_as']) ? $GLOBALS['redue_same_as'] : array();
			$same_clean = array();
			foreach ($same as $u) {
				if (is_string($u) && preg_match('#^https?://#i', trim($u))) { $same_clean[] = trim($u); }
			}
			if (count($same_clean) > 0) { $org['sameAs'] = array_values(array_unique($same_clean)); }

			$catalog_src = isset($GLOBALS['redue_service_catalog']) && is_array($GLOBALS['redue_service_catalog']) ? $GLOBALS['redue_service_catalog'] : array();
			$services = redue_normalize_service_catalog($catalog_src, $is_medical);
			redue_bind_service_catalog($org, $services);

			$rep = $g('redue_rep_name');
			if ($rep !== '') {
				$org['founder'] = array('@id' => $origin . '/#person');
				$org['employee'] = array('@id' => $origin . '/#person');
				if ($is_medical) { $org['physician'] = array('@id' => $origin . '/#person'); }
			}

			return $org;
		}
	}

	if (!function_exists('redue_build_person')) {
		function redue_build_person($origin) {
			$rep = isset($GLOBALS['redue_rep_name']) ? trim((string) $GLOBALS['redue_rep_name']) : '';
			if ($rep === '') return null;
			$title = isset($GLOBALS['redue_rep_title']) ? trim((string) $GLOBALS['redue_rep_title']) : '';
			$person = array(
				'@type' => 'Person',
				'@id' => $origin . '/#person',
				'name' => $rep,
				'worksFor' => array('@id' => $origin . '/#organization'),
			);
			if ($title !== '') { $person['jobTitle'] = $title; }
			$tel = isset($GLOBALS['redue_tel']) ? trim((string) $GLOBALS['redue_tel']) : '';
			if ($tel !== '') { $person['telephone'] = $tel; }
			return $person;
		}
	}

	if (!function_exists('redue_build_product')) {
		function redue_build_product($origin, $canonical, $product) {
			if (!is_array($product) || empty($product['name'])) return null;
			$node = array(
				'@type' => 'Product',
				'@id' => $canonical . '#product',
				'name' => $product['name'],
				'url' => $canonical,
			);
			if (!empty($product['description'])) { $node['description'] = redue_truncate_text($product['description'], 500); }
			if (!empty($product['image'])) { $node['image'] = $product['image']; }
			if (!empty($product['category'])) { $node['category'] = $product['category']; }

			if (!empty($product['price']) && (float) $product['price'] > 0) {
				$offer = array(
					'@type' => 'Offer',
					'url' => $canonical,
					'priceCurrency' => 'KRW',
					'price' => (string) $product['price'],
					'seller' => array('@id' => $origin . '/#organization'),
				);
				if (!empty($product['availability'])) { $offer['availability'] = $product['availability']; }
				$node['offers'] = $offer;
			}
			return $node;
		}
	}

	if (!function_exists('redue_build_breadcrumbs')) {
		function redue_build_breadcrumbs($origin, $canonical, $ctx) {
			$home = rtrim($origin, '/') . '/';
			$items = array(array('name' => '홈', 'url' => $home));
			if (!empty($ctx['is_home'])) return $items;
			$title = isset($ctx['title']) ? trim((string) $ctx['title']) : '';
			if ($title !== '') {
				$items[] = array('name' => $title, 'url' => $canonical);
			}
			return $items;
		}
	}

	if (!function_exists('redue_build_breadcrumb_node')) {
		function redue_build_breadcrumb_node($canonical, $crumbs) {
			$els = array();
			$pos = 1;
			foreach ($crumbs as $c) {
				if (empty($c['name'])) continue;
				$el = array('@type' => 'ListItem', 'position' => $pos, 'name' => $c['name']);
				if (!empty($c['url'])) { $el['item'] = $c['url']; }
				$els[] = $el;
				$pos++;
			}
			if (count($els) < 2) return null;
			return array('@type' => 'BreadcrumbList', '@id' => $canonical . '#breadcrumb', 'itemListElement' => $els);
		}
	}

	if (!function_exists('redue_extract_faq_items')) {
		function redue_extract_faq_items($html) {
			$items = array();
			if (!is_string($html) || $html === '') return $items;
			if (preg_match_all('/<dt[^>]*>(.*?)<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/is', $html, $m, PREG_SET_ORDER)) {
				foreach ($m as $row) {
					$q = redue_plain_text($row[1]);
					$a = redue_plain_text($row[2]);
					if ($q !== '' && $a !== '' && mb_strlen($q, 'UTF-8') <= 200 && mb_strlen($a, 'UTF-8') <= 2000) {
						$items[] = array('q' => $q, 'a' => $a);
					}
				}
			}
			if (count($items) === 0 && preg_match_all('/<summary[^>]*>(.*?)<\/summary>(.*?)<\/details>/is', $html, $m, PREG_SET_ORDER)) {
				foreach ($m as $row) {
					$q = redue_plain_text($row[1]);
					$a = redue_plain_text($row[2]);
					if ($q !== '' && $a !== '') { $items[] = array('q' => $q, 'a' => $a); }
				}
			}
			if (count($items) === 0 && is_string($html) && strlen($html) < 250000) {
				$plain = redue_plain_text($html);
				if (preg_match_all('/(?:^|\s)Q[.:\s]\s*(.+?)\s*A[.:\s]\s*(.+?)(?=(?:\sQ[.:\s])|$)/us', $plain, $m, PREG_SET_ORDER)) {
					foreach ($m as $row) {
						$q = trim($row[1]);
						$a = trim($row[2]);
						if ($q !== '' && $a !== '' && mb_strlen($q, 'UTF-8') <= 200 && mb_strlen($a, 'UTF-8') <= 2000) {
							$items[] = array('q' => $q, 'a' => $a);
						}
					}
				}
			}
			if (count($items) > 20) { $items = array_slice($items, 0, 20); }
			return $items;
		}
	}

	if (!function_exists('redue_build_video_objects')) {
		function redue_build_video_objects($video_ids, $origin, $canonical, $page_title, $page_desc) {
			$out = array();
			if (!is_array($video_ids) || count($video_ids) === 0) return $out;
			$has_person = isset($GLOBALS['redue_rep_name']) && trim((string) $GLOBALS['redue_rep_name']) !== '';
			foreach ($video_ids as $vid) {
				if (!is_string($vid) || !preg_match('/^[a-zA-Z0-9_-]{11}$/', $vid)) continue;
				$node = array(
					'@type' => 'VideoObject',
					'@id' => $canonical . '#video-' . $vid,
					'name' => trim((string) $page_title) !== '' ? $page_title . ' - 공식 안내 영상' : '공식 안내 영상',
					'thumbnailUrl' => 'https://img.youtube.com/vi/' . $vid . '/maxresdefault.jpg',
					'embedUrl' => 'https://www.youtube.com/embed/' . $vid,
					'contentUrl' => 'https://www.youtube.com/watch?v=' . $vid,
					'publisher' => array('@id' => $origin . '/#organization'),
				);
				if (trim((string) $page_desc) !== '') { $node['description'] = $page_desc; }
				if ($has_person) { $node['author'] = array('@id' => $origin . '/#person'); }
				$out[] = $node;
			}
			return $out;
		}
	}

	/* ═══════════════════════════════════════════════════════════════════
	 * 3e. Open Graph / Twitter 메타태그 렌더러 — Schema 데이터와 1:1 동기화
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!function_exists('redue_render_meta_tags')) {
		function redue_render_meta_tags($origin, $canonical, $site_name, $page_title, $page_desc, $ctx, $image) {
			$og_type = (isset($ctx['type']) && $ctx['type'] === 'article') ? 'article' : 'website';
			$full_title = ($site_name !== '' && $page_title !== '' && $page_title !== $site_name)
				? ($page_title . ' - ' . $site_name)
				: ($page_title !== '' ? $page_title : $site_name);

			$out = "\n<!-- REDUE AI SCHEMA: Meta / Open Graph / Twitter Sync -->\n";
			$out .= '<link rel="canonical" href="' . redue_esc_attr($canonical) . '" />' . "\n";
			if ($page_desc !== '') {
				$out .= '<meta name="description" content="' . redue_esc_attr($page_desc) . '" />' . "\n";
			}
			$out .= '<meta property="og:type" content="' . redue_esc_attr($og_type) . '" />' . "\n";
			if ($full_title !== '') {
				$out .= '<meta property="og:title" content="' . redue_esc_attr($full_title) . '" />' . "\n";
			}
			if ($page_desc !== '') {
				$out .= '<meta property="og:description" content="' . redue_esc_attr($page_desc) . '" />' . "\n";
			}
			$out .= '<meta property="og:url" content="' . redue_esc_attr($canonical) . '" />' . "\n";
			if ($site_name !== '') {
				$out .= '<meta property="og:site_name" content="' . redue_esc_attr($site_name) . '" />' . "\n";
			}
			if ($image !== '') {
				$out .= '<meta property="og:image" content="' . redue_esc_attr($image) . '" />' . "\n";
			}
			$out .= '<meta name="twitter:card" content="' . ($image !== '' ? 'summary_large_image' : 'summary') . '" />' . "\n";
			if ($full_title !== '') {
				$out .= '<meta name="twitter:title" content="' . redue_esc_attr($full_title) . '" />' . "\n";
			}
			if ($page_desc !== '') {
				$out .= '<meta name="twitter:description" content="' . redue_esc_attr($page_desc) . '" />' . "\n";
			}
			if ($image !== '') {
				$out .= '<meta name="twitter:image" content="' . redue_esc_attr($image) . '" />' . "\n";
			}
			return $out;
		}
	}

	/* ═══════════════════════════════════════════════════════════════════
	 * 4. 동적 스키마 컨트롤러 본체
	 *    - 출력 버퍼 + CMS 본문 변수에서 HTML 수집 → 유튜브/FAQ/영카트 상품 실시간 탐지
	 *    - Organization(동적 타입)/Person/WebSite/WebPage/BreadcrumbList/FAQPage/
	 *      VideoObject/Product 를 하나의 @graph 로 동시 구성 후 재귀 Null-Safe 필터 적용
	 *    - OG/Twitter 메타태그를 Schema 데이터와 1:1 동기화하여 함께 출력
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!function_exists('redue_dynamic_schema_controller_body')) {
		function redue_dynamic_schema_controller_body($captured_html = '') {
			$origin = redue_site_origin();
			$home = rtrim($origin, '/') . '/';
			$canonical = redue_resolve_canonical_url($origin);
			$ctx = redue_resolve_page_context();
			$site_name = redue_resolve_site_name();
			$entity_types = redue_resolve_entity_type();
			$is_medical = redue_entity_type_contains('Medical', $entity_types);

			$body_html = trim((isset($ctx['body_html']) ? (string) $ctx['body_html'] : '') . ' ' . (is_string($captured_html) ? $captured_html : ''));
			$video_ids = redue_detect_youtube_videos($body_html);

			$page_types = redue_resolve_page_types($ctx, $is_medical);
			$page_title = (isset($ctx['title']) && trim((string) $ctx['title']) !== '') ? trim((string) $ctx['title']) : $site_name;
			$page_desc_raw = isset($ctx['description']) ? trim((string) $ctx['description']) : '';
			if ($page_desc_raw === '') {
				$page_desc_raw = (isset($ctx['type']) && $ctx['type'] === 'home')
					? ($site_name . ' 공식 웹사이트입니다.')
					: ($site_name . ' ' . $page_title . ' 공식 안내입니다.');
			}
			/* 네이버 서치어드바이저 80자 컷오프 — Schema description 과 OG/Twitter 메타를 1:1 동기화 */
			$page_desc = redue_truncate_meta_description($page_desc_raw);

			$image = isset($GLOBALS['redue_og_image']) && is_string($GLOBALS['redue_og_image']) ? trim($GLOBALS['redue_og_image']) : '';
			if ($image !== '' && !preg_match('#^https?://#i', $image)) { $image = ''; }
			if ($image === '' && isset($ctx['product']['image']) && is_string($ctx['product']['image'])) {
				$image = $ctx['product']['image'];
			}

			$graph = array();
			$graph[] = redue_build_organization($origin, $home, $entity_types, $is_medical);
			$graph[] = array(
				'@type' => 'WebSite',
				'@id' => $origin . '/#website',
				'url' => $home,
				'name' => $site_name,
				'publisher' => array('@id' => $origin . '/#organization'),
			);

			$crumbs = redue_build_breadcrumbs($origin, $canonical, $ctx);
			$breadcrumb_node = redue_build_breadcrumb_node($canonical, $crumbs);
			if (is_array($breadcrumb_node)) { $graph[] = $breadcrumb_node; }

			$page = array(
				'@type' => $page_types,
				'@id' => $canonical . '#webpage',
				'url' => $canonical,
				'name' => $page_title,
				'description' => $page_desc,
				'isPartOf' => array('@id' => $origin . '/#website'),
				'about' => array('@id' => $origin . '/#organization'),
			);
			if (is_array($breadcrumb_node)) { $page['breadcrumb'] = array('@id' => $breadcrumb_node['@id']); }
			if (in_array('Article', (array) $page_types, true)) {
				$page['headline'] = $page_title;
				if (!empty($ctx['published'])) { $page['datePublished'] = $ctx['published']; }
				if (!empty($ctx['modified'])) { $page['dateModified'] = $ctx['modified']; }
				if (!empty($GLOBALS['redue_rep_name'])) { $page['author'] = array('@id' => $origin . '/#person'); }
			}
			$graph[] = $page;

			$person = redue_build_person($origin);
			if (is_array($person)) { $graph[] = $person; }

			if (isset($ctx['product']) && is_array($ctx['product'])) {
				$product_node = redue_build_product($origin, $canonical, $ctx['product']);
				if (is_array($product_node)) { $graph[] = $product_node; }
			}

			$faq_items = redue_extract_faq_items($body_html);
			$faq_entities = array();
			foreach ($faq_items as $fi) {
				if (empty($fi['q']) || empty($fi['a'])) continue;
				$faq_entities[] = array(
					'@type' => 'Question',
					'name' => $fi['q'],
					'acceptedAnswer' => array('@type' => 'Answer', 'text' => $fi['a']),
				);
			}
			if (count($faq_entities) > 0) {
				$graph[] = array(
					'@type' => 'FAQPage',
					'@id' => $canonical . '#faq',
					'url' => $canonical,
					'mainEntity' => $faq_entities,
				);
			}

			$video_nodes = redue_build_video_objects($video_ids, $origin, $canonical, $page_title, $page_desc);
			foreach ($video_nodes as $vn) { $graph[] = $vn; }

			$payload = array('@context' => 'https://schema.org', '@graph' => $graph);
			/* 규칙 1-2: 재귀 Null-Safe 필터 — 빈 문자열("")/빈 배열([]) 을 @graph 전체에서 완전 제거 */
			$payload = redue_recursive_filter($payload);

			echo redue_render_meta_tags($origin, $canonical, $site_name, $page_title, $page_desc, $ctx, $image);
			echo '<script type="application/ld+json">' . "\n"
				. json_encode($payload, redue_jsonld_flags())
				. "\n" . '</script>' . "\n";
		}
	}

	if (!function_exists('redue_dynamic_schema_controller')) {
		function redue_dynamic_schema_controller() {
			static $executed = false;
			if ($executed) return;
			$executed = true;
			$captured = isset($GLOBALS['redue_precaptured_html']) ? (string) $GLOBALS['redue_precaptured_html'] : redue_get_captured_buffer();
			try {
				redue_dynamic_schema_controller_body($captured);
			} catch (\Exception $redue_schema_err) {
			} catch (\Throwable $redue_schema_err) {
			}
		}
	}

	if (!function_exists('redue_render_full_schema')) {
		/** 문자열로 반환 — Rhymix Context::addHtmlHeader() / 커스텀 PHP 스플라이스 용도 */
		function redue_render_full_schema() {
			$GLOBALS['redue_precaptured_html'] = redue_get_captured_buffer();
			ob_start();
			redue_dynamic_schema_controller();
			$out = ob_get_clean();
			unset($GLOBALS['redue_precaptured_html']);
			return is_string($out) ? $out : '';
		}
	}

	if (!function_exists('redue_php_fallback_shutdown')) {
		/** 순수 PHP / 커스텀 CMS — 버퍼링된 전체 페이지에 </body> 직전으로 스키마를 자동 스플라이스 */
		function redue_php_fallback_shutdown() {
			$schema_html = redue_render_full_schema();
			if ($schema_html === '') return;
			if (!empty($GLOBALS['redue_ob_level']) && function_exists('ob_get_level') && ob_get_level() >= $GLOBALS['redue_ob_level']) {
				$buffered = @ob_get_clean();
				if (!is_string($buffered)) { $buffered = ''; }
				if (stripos($buffered, '</body>') !== false) {
					$buffered = preg_replace('/<\/body>/i', $schema_html . '</body>', $buffered, 1);
				} elseif (stripos($buffered, '</html>') !== false) {
					$buffered = preg_replace('/<\/html>/i', $schema_html . '</html>', $buffered, 1);
				} else {
					$buffered .= $schema_html;
				}
				echo $buffered;
			} else {
				echo $schema_html;
			}
		}
	}

	/* ═══════════════════════════════════════════════════════════════════
	 * 5. head.sub.php 1회성 자동 패치 (Self-Patching Installer)
	 *    - 활성 테마(G5_THEME_PATH) 우선, 없으면 루트(G5_PATH)의 head.sub.php 탐색
	 *    - 마커 문자열(redue_dynamic_schema_controller)이 이미 있으면 재삽입하지 않음
	 *    - 패치 직전 원본 파일을 타임스탬프 백업(.redue-bak-YmdHis)한 뒤 </head> 직전에 삽입
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!function_exists('redue_auto_patch_head_sub')) {
		function redue_auto_patch_head_sub() {
			if (!defined('_GNUBOARD_')) return false;

			static $done = null;
			if ($done !== null) return $done;

			$marker = 'redue_dynamic_schema_controller';
			$candidates = array();
			if (defined('G5_THEME_PATH') && is_string(G5_THEME_PATH) && G5_THEME_PATH !== '') {
				$candidates[] = rtrim(G5_THEME_PATH, '/\\') . '/head.sub.php';
			}
			if (defined('G5_PATH') && is_string(G5_PATH) && G5_PATH !== '') {
				$candidates[] = rtrim(G5_PATH, '/\\') . '/head.sub.php';
			}

			$patch_code = "<?php\n// REDUE_AI_SCHEMA:START\n"
				. "if (function_exists('redue_dynamic_schema_controller')) {\n"
				. "\tredue_dynamic_schema_controller();\n"
				. "}\n// REDUE_AI_SCHEMA:END\n?>\n";

			foreach (array_unique($candidates) as $target) {
				if ($target === '' || !is_file($target) || !is_readable($target)) continue;

				$content = @file_get_contents($target);
				if (!is_string($content)) continue;

				if (strpos($content, $marker) !== false) {
					$done = true;
					return true;
				}

				if (!is_writable($target)) continue;

				$backup = $target . '.redue-bak-' . date('YmdHis');
				@copy($target, $backup);

				if (stripos($content, '</head>') !== false) {
					$new_content = preg_replace('/<\/head>/i', $patch_code . '</head>', $content, 1);
				} else {
					$new_content = $content . "\n" . $patch_code;
				}

				if (is_string($new_content) && $new_content !== $content) {
					$written = @file_put_contents($target, $new_content, LOCK_EX);
					if ($written !== false) {
						$done = true;
						return true;
					}
				}
			}

			$done = false;
			return false;
		}
	}

	/* ═══════════════════════════════════════════════════════════════════
	 * 6. 멀티 CMS 훅 자동 등록 레이어
	 * ═══════════════════════════════════════════════════════════════════ */
	if (!redue_should_skip_universal_engine()) {
		redue_start_capture_buffer();

		if (defined('_GNUBOARD_')) {
			/* 1순위: head.sub.php 셀프 패치 — <head> 내부에서 메타/JSON-LD를 정확히 출력 */
			try { redue_auto_patch_head_sub(); } catch (\Throwable $redue_patch_err) { }

			/* 안전망: 패치가 아직 반영되지 않았거나 실패한 경우를 대비한 tail_sub 폴백
			 * (redue_dynamic_schema_controller 내부의 static $executed 가드로 중복 출력은 없음) */
			if (function_exists('add_event')) {
				add_event('tail_sub', 'redue_dynamic_schema_controller', 10, 0);
			} elseif (function_exists('register_shutdown_function')) {
				register_shutdown_function('redue_php_fallback_shutdown');
			}
		} elseif (defined('ABSPATH')) {
			if (function_exists('add_action')) {
				add_action('wp_head', 'redue_dynamic_schema_controller', 99);
			} elseif (function_exists('register_shutdown_function')) {
				register_shutdown_function('redue_php_fallback_shutdown');
			}
		} elseif (defined('RX_VERSION') || defined('__XE__')) {
			// 라이믹스 / XE — 애드온 호출 위치(before_display_content)일 경우 헤더에 직접 바인딩,
			// 그 외(단일 파일 include 등)에는 셧다운 훅으로 폴백
			if (isset($called_position) && $called_position === 'before_display_content' && class_exists('Context') && method_exists('Context', 'addHtmlHeader')) {
				Context::addHtmlHeader(redue_render_full_schema());
			} elseif (function_exists('register_shutdown_function')) {
				register_shutdown_function('redue_php_fallback_shutdown');
			}
		} else {
			// 순수 PHP / 커스텀 CMS — register_shutdown_function + 출력 버퍼 자동 캡처
			if (function_exists('register_shutdown_function')) {
				register_shutdown_function('redue_php_fallback_shutdown');
			}
		}
	}
}
