<?php
/**
 * Redue AI Tool Vault - Theme functions and definitions
 *
 * @package Redue_Tool_Vault
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'REDUE_TV_VERSION', '1.1.0' );
define( 'REDUE_TV_DIR', get_template_directory() );
define( 'REDUE_TV_URI', get_template_directory_uri() );

/**
 * Theme setup.
 */
function redue_tv_setup() {
	load_theme_textdomain( 'redue-tool-vault', REDUE_TV_DIR . '/languages' );

	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'custom-logo' );
	add_theme_support( 'automatic-feed-links' );

	register_nav_menus(
		array(
			'primary' => __( '주 메뉴', 'redue-tool-vault' ),
		)
	);
}
add_action( 'after_setup_theme', 'redue_tv_setup' );

/**
 * Enqueue theme styles and scripts.
 */
function redue_tv_enqueue_assets() {
	wp_enqueue_style( 'redue-tv-style', get_stylesheet_uri(), array(), REDUE_TV_VERSION );
}
add_action( 'wp_enqueue_scripts', 'redue_tv_enqueue_assets' );

/**
 * Include theme modules.
 *
 * - Custom Post Type & Taxonomy: ai_tool / tool_category
 * - Custom meta boxes for ai_tool fields
 * - SoftwareApplication JSON-LD structured data
 * - One-time dummy data seeder (Step 2)
 */
require_once REDUE_TV_DIR . '/inc/custom-post-types.php';
require_once REDUE_TV_DIR . '/inc/meta-boxes.php';
require_once REDUE_TV_DIR . '/inc/schema-jsonld.php';
require_once REDUE_TV_DIR . '/inc/dummy-data.php';

/**
 * Template helpers shared by the card grid and single tool templates.
 */

/**
 * Map a pricing type to a CSS badge modifier class for color coding.
 *
 * @param string $pricing_type One of Free / Freemium / Paid / Free Trial.
 * @return string
 */
function redue_tv_get_pricing_badge_class( $pricing_type ) {
	$map = array(
		'Free'       => 'badge--free',
		'Freemium'   => 'badge--freemium',
		'Paid'       => 'badge--paid',
		'Free Trial' => 'badge--trial',
	);

	return isset( $map[ $pricing_type ] ) ? $map[ $pricing_type ] : 'badge--default';
}

/**
 * Format a tool's price for display, e.g. "$29/mo" or "무료".
 *
 * @param string $pricing_type Pricing type label.
 * @param string $amount       Starting price amount.
 * @param string $currency     Currency code (default USD).
 * @return string
 */
function redue_tv_format_tool_price( $pricing_type, $amount, $currency = 'USD' ) {
	$symbols = array(
		'USD' => '$',
		'KRW' => '₩',
		'EUR' => '€',
		'JPY' => '¥',
	);
	$symbol  = isset( $symbols[ strtoupper( $currency ) ] ) ? $symbols[ strtoupper( $currency ) ] : '';

	if ( '' === $amount || ( is_numeric( $amount ) && 0.0 === (float) $amount ) ) {
		return __( '무료', 'redue-tool-vault' );
	}

	return sprintf( '%s%s / mo', $symbol, $amount );
}

/**
 * Return a stable accent color for a tool's fallback logo avatar.
 *
 * @param int $post_id Post ID.
 * @return string Hex color.
 */
function redue_tv_get_tool_logo_color( $post_id ) {
	$palette = array( '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6' );
	return $palette[ $post_id % count( $palette ) ];
}
