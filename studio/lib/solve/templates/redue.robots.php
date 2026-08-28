<?php
/**
 * REDUE robots.txt common builder — single-file CMS-aware generator.
 *
 * Drop this file on the site root (or include it from common.php / functions.php /
 * a Rhymix addon). It detects GnuBoard 5 / YoungCart, WordPress, Rhymix/XE, or a
 * standalone PHP tree and emits an SEO + AI-crawler friendly robots.txt.
 *
 * ── 사용 예시 ────────────────────────────────────────────────────────────
 *
 * 1) 문자열만 생성
 *    require_once __DIR__ . '/redue.robots.php';
 *    $txt = redue_generate_robots_txt();
 *
 * 2) 루트 쓰기 권한이 있을 때 robots.txt 저장
 *    require_once __DIR__ . '/redue.robots.php';
 *    $saved = redue_write_robots_txt(__DIR__); // true | false
 *
 * 3) /robots.txt 실시간 스트리밍 (그누보드 라우트 · nginx try_files · WP rewrite)
 *    require_once __DIR__ . '/redue.robots.php';
 *    redue_serve_robots_txt();
 *
 * 4) 이 파일을 웹에서 직접 요청하면 자동으로 text/plain 스트리밍
 *    RewriteRule ^robots\.txt$ redue.robots.php [L]
 *
 * 옵션 오버라이드:
 *    redue_generate_robots_txt(array(
 *        'cms'    => 'gnuboard',          // gnuboard|wordpress|rhymix|standalone
 *        'origin' => 'https://example.com',
 *        'root'   => '/var/www/html',
 *    ));
 */

if ( ! function_exists( 'redue_robots_docroot' ) ) {
	function redue_robots_docroot( $root = null ) {
		if ( is_string( $root ) && $root !== '' ) {
			return rtrim( str_replace( '\\', '/', $root ), '/' );
		}
		if ( defined( 'G5_PATH' ) && is_string( G5_PATH ) && G5_PATH !== '' ) {
			return rtrim( str_replace( '\\', '/', G5_PATH ), '/' );
		}
		if ( defined( 'ABSPATH' ) && is_string( ABSPATH ) && ABSPATH !== '' ) {
			return rtrim( str_replace( '\\', '/', ABSPATH ), '/' );
		}
		if ( ! empty( $_SERVER['DOCUMENT_ROOT'] ) ) {
			return rtrim( str_replace( '\\', '/', (string) $_SERVER['DOCUMENT_ROOT'] ), '/' );
		}
		$cwd = @getcwd();
		return is_string( $cwd ) && $cwd !== '' ? rtrim( str_replace( '\\', '/', $cwd ), '/' ) : '.';
	}
}

if ( ! function_exists( 'redue_detect_robots_cms' ) ) {
	/**
	 * @return string gnuboard|wordpress|rhymix|standalone
	 */
	function redue_detect_robots_cms( $root = null ) {
		if ( defined( '_GNUBOARD_' ) ) {
			return 'gnuboard';
		}
		if ( defined( 'ABSPATH' ) ) {
			return 'wordpress';
		}
		if ( defined( 'RX_VERSION' ) || defined( '__XE__' ) ) {
			return 'rhymix';
		}

		$base = redue_robots_docroot( $root );
		$bbs  = $base . '/bbs';
		if ( is_dir( $bbs ) && is_file( $base . '/config.php' ) ) {
			return 'gnuboard';
		}
		if ( is_file( $base . '/wp-config.php' ) ) {
			return 'wordpress';
		}
		if ( is_file( $base . '/config.inc.php' ) && is_dir( $base . '/modules' ) ) {
			return 'rhymix';
		}
		return 'standalone';
	}
}

if ( ! function_exists( 'redue_robots_detect_protocol' ) ) {
	function redue_robots_detect_protocol() {
		if ( function_exists( 'redue_detect_site_protocol' ) ) {
			return redue_detect_site_protocol();
		}
		if ( defined( 'G5_URL' ) && is_string( G5_URL ) && preg_match( '#^(https?)://#i', G5_URL, $m ) ) {
			return strtolower( $m[1] );
		}
		if ( function_exists( 'home_url' ) ) {
			$_home = home_url( '/' );
			if ( is_string( $_home ) && preg_match( '#^(https?)://#i', $_home, $m ) ) {
				return strtolower( $m[1] );
			}
		}
		if ( ! empty( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) ) {
			$_fwd = strtolower( trim( (string) $_SERVER['HTTP_X_FORWARDED_PROTO'] ) );
			if ( $_fwd === 'https' || $_fwd === 'http' ) {
				return $_fwd;
			}
		}
		if ( ! empty( $_SERVER['HTTPS'] ) && $_SERVER['HTTPS'] !== 'off' && $_SERVER['HTTPS'] !== '0' ) {
			return 'https';
		}
		if ( isset( $_SERVER['SERVER_PORT'] ) && (string) $_SERVER['SERVER_PORT'] === '443' ) {
			return 'https';
		}
		if ( ! empty( $_SERVER['REQUEST_SCHEME'] ) && strtolower( (string) $_SERVER['REQUEST_SCHEME'] ) === 'https' ) {
			return 'https';
		}
		return 'http';
	}
}

if ( ! function_exists( 'redue_robots_site_origin' ) ) {
	function redue_robots_site_origin() {
		if ( function_exists( 'redue_site_origin' ) ) {
			return rtrim( (string) redue_site_origin(), '/' );
		}
		$proto = redue_robots_detect_protocol();
		if ( defined( 'G5_URL' ) && is_string( G5_URL ) && G5_URL !== '' ) {
			$rewritten = preg_replace( '#^https?://#i', $proto . '://', rtrim( G5_URL, '/' ) );
			if ( is_string( $rewritten ) && $rewritten !== '' ) {
				$parts = parse_url( $rewritten );
				if ( is_array( $parts ) && ! empty( $parts['host'] ) ) {
					$port = isset( $parts['port'] ) ? ':' . $parts['port'] : '';
					return $proto . '://' . $parts['host'] . $port;
				}
				return $rewritten;
			}
		}
		if ( function_exists( 'home_url' ) ) {
			$_home = home_url( '/' );
			if ( is_string( $_home ) && preg_match( '#^(https?)://([^/]+)#i', $_home, $m ) ) {
				return strtolower( $m[1] ) . '://' . $m[2];
			}
		}
		$host = '';
		if ( ! empty( $_SERVER['HTTP_HOST'] ) ) {
			$host = (string) $_SERVER['HTTP_HOST'];
		} elseif ( ! empty( $_SERVER['SERVER_NAME'] ) ) {
			$host = (string) $_SERVER['SERVER_NAME'];
		}
		$host = preg_replace( '#^https?://#i', '', $host );
		if ( ! is_string( $host ) || $host === '' ) {
			$host = 'localhost';
		}
		return $proto . '://' . $host;
	}
}

if ( ! function_exists( 'redue_robots_cms_rules' ) ) {
	/**
	 * @return array{allow: string[], disallow: string[], label: string}
	 */
	function redue_robots_cms_rules( $cms ) {
		$cms = is_string( $cms ) ? strtolower( trim( $cms ) ) : '';
		if ( $cms === 'gnuboard' || $cms === 'youngcart' || $cms === 'g5' ) {
			return array(
				'label'    => 'GnuBoard 5 / YoungCart 5',
				'allow'    => array( '/data/file/', '/theme/', '/skin/', '/js/', '/css/' ),
				'disallow' => array(
					'/adm/',
					'/admin/',
					'/data/session/',
					'/data/cache/',
					'/data/tmp/',
					'/bbs/write*',
					'/bbs/delete*',
					'/bbs/login*',
					'/bbs/register*',
					'/bbs/password*',
					'/bbs/logout*',
				),
			);
		}
		if ( $cms === 'wordpress' || $cms === 'wp' ) {
			return array(
				'label'    => 'WordPress',
				'allow'    => array(
					'/wp-admin/admin-ajax.php',
					'/wp-content/uploads/',
					'/wp-content/themes/',
					'/wp-content/plugins/',
				),
				'disallow' => array( '/wp-admin/', '/wp-includes/', '/wp-login.php', '/wp-signup.php', '/xmlrpc.php' ),
			);
		}
		if ( $cms === 'rhymix' || $cms === 'xe' ) {
			return array(
				'label'    => 'Rhymix / XE',
				'allow'    => array( '/files/', '/modules/*/tpl/', '/addons/' ),
				'disallow' => array(
					'/admin/',
					'/files/config/',
					'/files/cache/',
					'/*act=dispMember*',
					'/*act=dispEditor*',
				),
			);
		}
		return array(
			'label'    => 'Standalone / other CMS',
			'allow'    => array(),
			'disallow' => array( '/admin/', '/adm/', '/session/', '/cache/', '/tmp/' ),
		);
	}
}

if ( ! function_exists( 'redue_robots_ai_crawlers' ) ) {
	function redue_robots_ai_crawlers() {
		return array(
			'GPTBot',
			'ChatGPT-User',
			'PerplexityBot',
			'ClaudeBot',
			'anthropic-ai',
			'Google-Extended',
			'Applebot-Extended',
			'CCBot',
			'Meta-ExternalAgent',
			'Cohere-ai',
		);
	}
}

if ( ! function_exists( 'redue_generate_robots_txt' ) ) {
	/**
	 * Build a complete robots.txt body. No filesystem write.
	 *
	 * @param array|string|null $opts Origin string, or array(cms, origin, root).
	 * @return string
	 */
	function redue_generate_robots_txt( $opts = null ) {
		$cms    = '';
		$origin = '';
		$root   = null;
		if ( is_string( $opts ) && $opts !== '' ) {
			$origin = rtrim( $opts, '/' );
		} elseif ( is_array( $opts ) ) {
			if ( ! empty( $opts['cms'] ) ) {
				$cms = strtolower( (string) $opts['cms'] );
			}
			if ( ! empty( $opts['origin'] ) ) {
				$origin = rtrim( (string) $opts['origin'], '/' );
			}
			if ( ! empty( $opts['root'] ) ) {
				$root = $opts['root'];
			}
		}
		if ( $cms === '' ) {
			$cms = redue_detect_robots_cms( $root );
		}
		if ( $origin === '' ) {
			$origin = redue_robots_site_origin();
		}
		$rules = redue_robots_cms_rules( $cms );
		$lines = array(
			'# REDUE AI SEO & GEO Studio — CMS-aware robots.txt',
			'# Generated by redue_generate_robots_txt() · detected=' . $cms . ' (' . $rules['label'] . ')',
			'',
			'User-agent: *',
			'Allow: /',
		);
		foreach ( $rules['allow'] as $path ) {
			$lines[] = 'Allow: ' . $path;
		}
		foreach ( $rules['disallow'] as $path ) {
			$lines[] = 'Disallow: ' . $path;
		}
		$lines[] = '';
		foreach ( redue_robots_ai_crawlers() as $bot ) {
			$lines[] = 'User-agent: ' . $bot;
			$lines[] = 'Allow: /';
			$lines[] = '';
		}
		if ( $origin !== '' ) {
			$lines[] = 'Sitemap: ' . $origin . '/sitemap.xml';
			$lines[] = '# AI Context Index (llms.txt)';
			$lines[] = '# LLMs: ' . $origin . '/llms.txt';
		} else {
			$lines[] = 'Sitemap: /sitemap.xml';
			$lines[] = '# AI Context Index (llms.txt)';
			$lines[] = '# LLMs: /llms.txt';
		}
		$lines[] = '';
		return implode( "\n", $lines );
	}
}

if ( ! function_exists( 'redue_write_robots_txt' ) ) {
	/**
	 * Write robots.txt to the document root when the directory (or existing file) is writable.
	 *
	 * @param string|null $root Document root. Defaults to G5_PATH / ABSPATH / DOCUMENT_ROOT / cwd.
	 * @param array|null  $opts Forwarded to redue_generate_robots_txt().
	 * @return bool
	 */
	function redue_write_robots_txt( $root = null, $opts = null ) {
		$base = redue_robots_docroot( $root );
		$path = $base . '/robots.txt';
		$dir_ok  = is_dir( $base ) && is_writable( $base );
		$file_ok = is_file( $path ) && is_writable( $path );
		if ( ! $dir_ok && ! $file_ok ) {
			return false;
		}
		$body_opts = is_array( $opts ) ? $opts : array();
		if ( empty( $body_opts['root'] ) ) {
			$body_opts['root'] = $base;
		}
		$body = redue_generate_robots_txt( $body_opts );
		$ok   = @file_put_contents( $path, $body );
		return $ok !== false;
	}
}

if ( ! function_exists( 'redue_serve_robots_txt' ) ) {
	/**
	 * Stream robots.txt for a live /robots.txt request.
	 *
	 * @param array|string|null $opts Forwarded to redue_generate_robots_txt().
	 * @return void
	 */
	function redue_serve_robots_txt( $opts = null ) {
		if ( ! headers_sent() ) {
			header( 'Content-Type: text/plain; charset=utf-8' );
			header( 'X-Content-Type-Options: nosniff' );
			header( 'Cache-Control: public, max-age=3600' );
		}
		echo redue_generate_robots_txt( $opts );
		if ( function_exists( 'fastcgi_finish_request' ) ) {
			fastcgi_finish_request();
		}
		exit;
	}
}

if ( ! defined( 'REDUE_ROBOTS_AS_LIBRARY' ) ) {
	$__redue_robots_script = isset( $_SERVER['SCRIPT_FILENAME'] ) ? (string) $_SERVER['SCRIPT_FILENAME'] : '';
	$__redue_robots_self   = isset( __FILE__ ) ? (string) __FILE__ : '';
	$__redue_robots_direct = $__redue_robots_script !== ''
		&& $__redue_robots_self !== ''
		&& @realpath( $__redue_robots_script ) === @realpath( $__redue_robots_self );
	if ( $__redue_robots_direct && php_sapi_name() !== 'cli' ) {
		redue_serve_robots_txt();
	}
	unset( $__redue_robots_script, $__redue_robots_self, $__redue_robots_direct );
}
