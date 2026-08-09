<?php
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
