<?php
/* REDUE_AI_STUDIO:START v25 — Universal Single-Block SEO & Defer Engine */
if ( ! defined('REDUE_AUTOMATED_ENGINE_ACTIVE') ) {
	define('REDUE_AUTOMATED_ENGINE_ACTIVE', true);

	// 1. Dynamic Universal Canonical Resolution
	if ( ! function_exists( 'redue_get_exact_canonical' ) ) {
		function redue_get_exact_canonical() {
			$protocol = 'https://';
			$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : (isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : 'localhost');
			$host = preg_replace('#^https?://#i', '', $host);
			$origin = $protocol . $host;

			$request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
			$parsed_url = parse_url($request_uri);
			$page_path = isset($parsed_url['path']) ? $parsed_url['path'] : '/';
			$page_query = isset($parsed_url['query']) ? $parsed_url['query'] : '';

			$page_base = basename($page_path);
			$is_root_path = ($page_path === '/' || $page_base === '' || $page_base === 'index.php' || $page_base === 'index.html');

			// Parse index-critical query keys BEFORE deciding if this is the
			// site root, otherwise plain-permalink URLs like "/?p=123" or
			// "/?it_id=..." collapse to the homepage canonical (precision bug).
			$valid_query = '';
			if ($page_query !== '') {
				parse_str($page_query, $parsed_qs);
				$allowed_params = array();
				// Filter index-critical query keys across CMS (Gnuboard, WP, Shopping)
				foreach (array('bo_table', 'co_id', 'it_id', 'ca_id', 'idx', 'p', 'page_id', 'wr_id', 'id') as $param_key) {
					if (!empty($parsed_qs[$param_key])) {
						$allowed_params[$param_key] = $parsed_qs[$param_key];
					}
				}
				if (!empty($allowed_params)) {
					$valid_query = '?' . http_build_query($allowed_params);
				}
			}

			$is_main = ($is_root_path && $valid_query === '');

			if ($is_main) {
				$canonical_url = $origin . '/';
			} else {
				$canonical_url = $origin . $page_path . $valid_query;
			}
			return preg_replace('#^http://#i', 'https://', $canonical_url);
		}
	}

	// 2. Global Document Output Buffering & Auto-Injection
	ob_start(function($buffer) {
		if ( ! is_string($buffer) || trim($buffer) === '' ) { return $buffer; }

		$canonical_url = redue_get_exact_canonical();
		$origin = 'https://' . preg_replace('#^https?://#i', '', isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost');

		// A. Clean pre-existing duplicate canonical and og:url tags
		$buffer = preg_replace('/<link\b(?=[^>]*\brel=["\']canonical["\'])[^>]*>\s*/i', '', $buffer);
		$buffer = preg_replace('/<meta\b(?=[^>]*\bproperty=["\']og:url["\'])[^>]*>\s*/i', '', $buffer);

		// B. Auto-build Injection HTML Block (Canonical + og:url + Ultra-Fast DOM Defer Script)
		$inject_html  = "\n<!-- REDUE AUTO-INJECTED SEO & DEFER ENGINE START -->\n";
		$inject_html .= '<link rel="canonical" href="' . htmlspecialchars($canonical_url, ENT_QUOTES, 'UTF-8') . '">' . "\n";
		$inject_html .= '<meta property="og:url" content="' . htmlspecialchars($canonical_url, ENT_QUOTES, 'UTF-8') . '">' . "\n";
		$inject_html .= '<script>' . "\n";
		$inject_html .= '(function(){' . "\n";
		$inject_html .= '  function enforceDefer(){' . "\n";
		$inject_html .= '    var scripts = document.querySelectorAll(\'script[src]:not([async]):not([defer]):not([type="module"])\');' . "\n";
		$inject_html .= '    for(var i=0; i<scripts.length; i++){ scripts[i].setAttribute("defer", "defer"); scripts[i].defer = true; }' . "\n";
		$inject_html .= '  }' . "\n";
		$inject_html .= '  enforceDefer();' . "\n";
		$inject_html .= '  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded", enforceDefer); }' . "\n";
		$inject_html .= '  if(typeof MutationObserver!=="undefined"){ new MutationObserver(enforceDefer).observe(document.documentElement, {childList:true, subtree:true}); }' . "\n";
		$inject_html .= '})();' . "\n";
		$inject_html .= '</script>' . "\n";
		$inject_html .= "<!-- REDUE AUTO-INJECTED ENGINE END -->\n";

		// C. Automatically inject right before </head>
		if ( preg_match('/<\/head>/i', $buffer) ) {
			$buffer = preg_replace('/<\/head>/i', $inject_html . '</head>', $buffer, 1);
		} else {
			$buffer = $inject_html . $buffer;
		}

		// D. Server-side regex fallback for static script tags
		// Exclusions: defer / async (already correct) and type="module"
		// (native ES modules are deferred by spec and must be left untouched).
		$buffer = preg_replace_callback('/<script\b(?![^>]*\b(defer|async)\b)(?![^>]*\btype\s*=\s*["\']module["\'])([^>]*\bsrc\s*=\s*["\'][^"\']+["\'][^>]*)>/i', function($matches) {
			return preg_replace('/>$/', ' defer>', $matches[0]);
		}, $buffer);

		return $buffer;
	});
}
/* REDUE_AI_STUDIO:END */

/**
 * The header for our theme
 *
 * @package Redue_Tool_Vault
 */
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<?php
	/* REDUE_AI_STUDIO:START v1 — REDUE AI SEO & GEO Studio 자동 주입 */
	if ( ! function_exists( 'redue_ai_studio_master_schema' ) ) {
		function redue_ai_studio_master_schema() {
			if ( is_singular( 'ai_tool' ) ) {
				global $post;
				$schema = array(
					'@context'    => 'https://schema.org',
					'@type'       => 'SoftwareApplication',
					'name'        => get_the_title( $post ),
					'description' => get_post_meta( $post->ID, 'tool_tagline', true ),
					'url'         => get_post_meta( $post->ID, 'tool_official_url', true ) ? get_post_meta( $post->ID, 'tool_official_url', true ) : get_permalink( $post ),
				);
			} elseif ( is_front_page() ) {
				$schema = array(
					'@context' => 'https://schema.org',
					'@type'    => 'WebSite',
					'name'     => get_bloginfo( 'name' ),
					'url'      => home_url( '/' ),
				);
			} else {
				return;
			}
	
			echo '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
		}
	}
	add_action( 'wp_head', 'redue_ai_studio_master_schema' );
	/* REDUE_AI_STUDIO:END */
	?>

	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="site-header">
	<div class="site-container">
		<p class="site-title">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php bloginfo( 'name' ); ?></a>
		</p>
		<nav class="main-nav">
			<?php
			wp_nav_menu(
				array(
					'theme_location' => 'primary',
					'fallback_cb'    => false,
					'container'      => false,
				)
			);
			?>
		</nav>
	</div>
</header>
