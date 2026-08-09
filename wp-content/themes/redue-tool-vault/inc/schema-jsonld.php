<?php
/**
 * SoftwareApplication JSON-LD structured data for single "ai_tool" pages.
 *
 * Outputs a <script type="application/ld+json"> block in <head> so that
 * Google / Perplexity / other AI crawlers can verify tool metadata.
 *
 * @package Redue_Tool_Vault
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build and echo the SoftwareApplication JSON-LD schema for the current
 * singular ai_tool post.
 */
function redue_tv_output_software_application_schema() {
	if ( ! is_singular( 'ai_tool' ) ) {
		return;
	}

	global $post;

	$name             = get_the_title( $post );
	$operating_system = get_post_meta( $post->ID, 'tool_operating_system', true );
	$tagline          = get_post_meta( $post->ID, 'tool_tagline', true );
	$official_url     = get_post_meta( $post->ID, 'tool_official_url', true );
	$price_amount     = get_post_meta( $post->ID, 'tool_price_amount', true );
	$price_currency   = get_post_meta( $post->ID, 'tool_price_currency', true );
	$rating_score     = get_post_meta( $post->ID, 'tool_rating_score', true );

	// Fall back to the post excerpt when no tagline has been provided.
	if ( empty( $tagline ) ) {
		$tagline = has_excerpt( $post ) ? get_the_excerpt( $post ) : '';
	}

	$schema = array(
		'@context'         => 'https://schema.org',
		'@type'            => 'SoftwareApplication',
		'name'             => $name,
		'operatingSystem'  => $operating_system,
		'applicationCategory' => 'BusinessApplication',
		'description'      => $tagline,
		'url'              => ! empty( $official_url ) ? $official_url : get_permalink( $post ),
	);

	if ( '' !== $price_amount ) {
		$schema['offers'] = array(
			'@type'         => 'Offer',
			'price'         => $price_amount,
			'priceCurrency' => ! empty( $price_currency ) ? $price_currency : 'USD',
		);
	}

	if ( '' !== $rating_score ) {
		$schema['aggregateRating'] = array(
			'@type'       => 'AggregateRating',
			'ratingValue' => $rating_score,
			'ratingCount' => '100',
		);
	}

	// Remove empty top-level scalar values while preserving nested arrays.
	$schema = array_filter(
		$schema,
		function ( $value ) {
			return is_array( $value ) || '' !== $value;
		}
	);

	echo '<script type="application/ld+json">' . "\n";
	echo wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT );
	echo "\n" . '</script>' . "\n";
}
add_action( 'wp_head', 'redue_tv_output_software_application_schema' );
