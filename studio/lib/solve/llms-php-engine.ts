/**
 * GnuBoard 5 / YoungCart 5 runtime: live /llms.txt + /llms-full.txt builder.
 * Interpolated into extend/redue.schema.php. Never invents FAQ. Never stringifies objects.
 */

export function buildRedueLlmsPhpEngine(): string {
	return `
if ( ! function_exists( 'redue_llms_plain_string' ) ) {
	function redue_llms_plain_string( $value ) {
		if ( ! is_string($value) ) { return ''; }
		$text = html_entity_decode($value, ENT_QUOTES, 'UTF-8');
		$text = preg_replace('/<[^>]+>/', ' ', is_string($text) ? $text : '');
		$text = is_string($text) ? trim(preg_replace('/\\s+/u', ' ', $text)) : '';
		if ( $text === '' ) { return ''; }
		if ( preg_match('/^(Array|Object|stdClass)\\b/i', $text) ) { return ''; }
		if ( preg_match('/^Class\\s*\\(/i', $text) ) { return ''; }
		if ( preg_match('/\\[object Object\\]/i', $text) ) { return ''; }
		if ( preg_match('/__PHP_Incomplete_Class/i', $text) ) { return ''; }
		if ( preg_match('/^\\{["\\'@]/', $text) && preg_match('/@type|PostalAddress|addressCountry/i', $text) ) { return ''; }
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
		if ( preg_match('/(?:서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣\\d\\-~,()·\\s]{2,48}(?:로|길|동|번지|호)/u', $text, $m) ) {
			return function_exists('redue_llms_plain_string') ? redue_llms_plain_string($m[0]) : trim($m[0]);
		}
		return '';
	}
}
if ( ! function_exists( 'redue_llms_file_title' ) ) {
	function redue_llms_file_title( $stem ) {
		$stem = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($stem) : '';
		$stem = strtolower(preg_replace('/\\.(php|html?|htm|phtml)$/i', '', $stem));
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
		$nf = preg_replace('/\\s+/u', '', $name);
		$bf = preg_replace('/\\s+/u', '', $brand);
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
		return (bool) preg_match('/병원소개|의원소개|클리닉소개|회사소개|연구소소개|센터소개|장비소개|시설소개|시설안내|둘러보기|인사말|원장인사|연혁|조직도|층별안내|오시는\\s*길|찾아오시는|찾아오는\\s*길|진료시간|운영시간|비급여|공지사항|갤러리|커뮤니티|이용약관|개인정보|로그인|회원가입|상담문의|온라인\\s*예약|의료진|원장소개|about|contact|location|directions|tour|greeting|privacy|sitemap/iu', $label);
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
		$text = preg_replace('/<script\\b[^>]*>[\\s\\S]*?<\\/script>/i', ' ', $text);
		$text = preg_replace('/<style\\b[^>]*>[\\s\\S]*?<\\/style>/i', ' ', is_string($text) ? $text : '');
		$text = function_exists('redue_plain_text') ? redue_plain_text(is_string($text) ? $text : '') : ( function_exists('redue_llms_plain_string') ? redue_llms_plain_string($text) : trim(strip_tags(is_string($text) ? $text : '')) );
		$text = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($text) : $text;
		if ( ! is_string($text) || $text === '' ) { return ''; }
		$text = preg_replace('/로그인|로그아웃|회원가입|회원정보|비밀번호\\s*찾기|글쓰기|비회원|아이디\\s*찾기|Zoom|게시판\\s*검색|글쓴이|조회\\s*\\d*|날짜|Total\\s*\\d+\\s*건|\\d+\\s*페이지|페이지\\s*\\d+|문의하기|진료시간|오시는길|찾아오시는\\s*길|상담예약|온라인예약|더보기|바로가기|맨위로|\\bTOP\\b/iu', ' ', $text);
		if ( is_array($stopwords) ) {
			foreach ( $stopwords as $_sw ) {
				$_sw = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($_sw) : '';
				if ( $_sw !== '' && ( function_exists('mb_strlen') ? mb_strlen($_sw, 'UTF-8') : strlen($_sw) ) >= 2 ) {
					$text = str_replace($_sw, ' ', is_string($text) ? $text : '');
				}
			}
		}
		$text = is_string($text) ? trim(preg_replace('/\\s+/u', ' ', $text)) : '';
		if ( $text === '' ) { return ''; }
		$parts = preg_split('/(?<=[.!?다요음니다])\\s+/u', $text);
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
			$head = preg_replace('/\\s*[|\\-–—:>]\\s*' . preg_quote($site, '/') . '\\s*$/u', '', $head);
			$head = preg_replace('/^' . preg_quote($site, '/') . '\\s*[|\\-–—:>]\\s*/u', '', is_string($head) ? $head : '');
			$head = trim(str_replace($site, ' ', is_string($head) ? $head : ''));
			$head = is_string($head) ? trim(preg_replace('/\\s+/u', ' ', $head)) : '';
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
			if ( $site !== '' && preg_replace('/\\s+/u', '', $_c) === preg_replace('/\\s+/u', '', $site) ) { continue; }
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
		if ( preg_match('/<(?:h2|h3)[^>]*>([\\s\\S]{2,80})<\\/(?:h2|h3)>/i', $html, $m) ) {
			$h = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($m[1]) : trim(strip_tags($m[1]));
			if ( $h !== '' && ! ( function_exists('redue_llms_is_chrome_title') && redue_llms_is_chrome_title($h, $site_name) ) ) { return $h; }
		}
		if ( preg_match('/<(?:div|p|span)[^>]*class=["\\'][^"\\']*sub_title[^"\\']*["\\'][^>]*>([\\s\\S]{2,80})<\\//i', $html, $m) ) {
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
		if ( $blob !== '' && preg_match('/(?:진료|운영|영업)\\s*시간\\s*[:：]?\\s*(\\d{1,2}:\\d{2})\\s*[\\-~–—]\\s*(\\d{1,2}:\\d{2})/u', $blob, $m) ) {
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
		$blob = function_exists('redue_llms_plain_string') ? redue_llms_plain_string($blob) : trim(preg_replace('/\\s+/u', ' ', is_string($blob) ? $blob : ''));
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
		$md = implode("\\n", $lines);
		$md = preg_replace("/\\n{3,}/", "\\n\\n", is_string($md) ? $md : '');
		return is_string($md) ? trim($md) . "\\n" : '';
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
		$md = implode("\\n", $lines);
		$md = preg_replace("/\\n{3,}/", "\\n\\n", is_string($md) ? $md : '');
		return is_string($md) ? trim($md) . "\\n" : '';
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
		} elseif ( preg_match('#/(llms-full)\\.txt$#i', $path) ) {
			$kind = 'full';
		} elseif ( preg_match('#/(llms)\\.txt$#i', $path) ) {
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
		if ( empty($_GET['redue_llms']) && !(isset($_SERVER['REQUEST_URI']) && preg_match('#/llms(-full)?\\.txt#i', $_SERVER['REQUEST_URI'])) ) { return; }
		if ( function_exists('redue_llms_maybe_serve') ) { redue_llms_maybe_serve(); }
	}
}
`.replace(/^\n/, '');
}
