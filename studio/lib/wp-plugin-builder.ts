/**
 * WordPress.org-ready plugin source templates for the REDUE AI SEO & GEO
 * 1-Click sync plugin. Built into a zip by `scripts/build-wp-plugin.mjs`
 * and `/api/builder/wp-plugin`.
 */

export const WP_PLUGIN_SLUG = 'redue-ai-seo';
export const WP_PLUGIN_MAIN = 'redue-ai-seo.php';

export function buildPluginPhp(apiBaseUrl: string): string {
	const base = apiBaseUrl.replace(/\/$/, '');
	return `<?php
/**
 * Plugin Name:       REDUE AI SEO & GEO
 * Plugin URI:        https://redue.ai
 * Description:       1-Click master schema sync. Enter your REDUE API Key and SoftwareApplication / Article / LocalBusiness / WebSite JSON-LD is injected site-wide via wp_head.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            REDUE AI
 * Author URI:        https://redue.ai
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       redue-ai-seo
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'REDUE_AI_SEO_VERSION', '1.0.0' );
define( 'REDUE_AI_SEO_API_BASE', '${base}' );

/**
 * Settings: API Key storage.
 */
function redue_ai_seo_register_settings() {
	register_setting(
		'redue_ai_seo_settings',
		'redue_ai_seo_api_key',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => '',
		)
	);
}
add_action( 'admin_init', 'redue_ai_seo_register_settings' );

function redue_ai_seo_add_menu() {
	add_options_page(
		'REDUE AI SEO & GEO',
		'REDUE AI SEO',
		'manage_options',
		'redue-ai-seo',
		'redue_ai_seo_render_settings_page'
	);
}
add_action( 'admin_menu', 'redue_ai_seo_add_menu' );

function redue_ai_seo_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$api_key = get_option( 'redue_ai_seo_api_key', '' );
	?>
	<div class="wrap">
		<h1><?php echo esc_html__( 'REDUE AI SEO & GEO', 'redue-ai-seo' ); ?></h1>
		<p><?php echo esc_html__( 'Enter your REDUE API Key (redue_live_sk_...) to sync master schema site-wide in one click.', 'redue-ai-seo' ); ?></p>
		<form method="post" action="options.php">
			<?php settings_fields( 'redue_ai_seo_settings' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="redue_ai_seo_api_key"><?php echo esc_html__( 'API Key', 'redue-ai-seo' ); ?></label></th>
					<td>
						<input type="password" class="regular-text" id="redue_ai_seo_api_key" name="redue_ai_seo_api_key" value="<?php echo esc_attr( $api_key ); ?>" autocomplete="off" />
						<p class="description"><?php echo esc_html__( 'Issued from the REDUE Developer Center.', 'redue-ai-seo' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button( __( 'Save & Sync Schema', 'redue-ai-seo' ) ); ?>
		</form>
	</div>
	<?php
}

/**
 * Fetch schema payload from REDUE PaaS and cache for 12 hours.
 *
 * @return array<int,array<string,mixed>>
 */
function redue_ai_seo_fetch_schemas() {
	$cached = get_transient( 'redue_ai_seo_schemas' );
	if ( is_array( $cached ) ) {
		return $cached;
	}

	$api_key = get_option( 'redue_ai_seo_api_key', '' );
	if ( empty( $api_key ) ) {
		return array();
	}

	$domain = home_url( '/' );
	$response = wp_remote_post(
		REDUE_AI_SEO_API_BASE . '/api/v1/schema/generate',
		array(
			'timeout' => 15,
			'headers' => array(
				'Authorization' => 'Bearer ' . $api_key,
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
			),
			'body'    => wp_json_encode(
				array(
					'domain'   => $domain,
					'cms_type' => 'wordpress',
					'lang'     => ( strpos( get_locale(), 'ko' ) === 0 ) ? 'ko' : 'en',
				)
			),
		)
	);

	if ( is_wp_error( $response ) ) {
		return array();
	}

	$code = wp_remote_retrieve_response_code( $response );
	$body = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( $code < 200 || $code >= 300 || empty( $body['json_ld'] ) || ! is_array( $body['json_ld'] ) ) {
		return array();
	}

	set_transient( 'redue_ai_seo_schemas', $body['json_ld'], 12 * HOUR_IN_SECONDS );
	return $body['json_ld'];
}

/**
 * Print JSON-LD in wp_head — 1-Click site-wide master schema sync.
 */
function redue_ai_seo_print_jsonld() {
	$schemas = redue_ai_seo_fetch_schemas();
	if ( empty( $schemas ) ) {
		return;
	}
	foreach ( $schemas as $schema ) {
		echo '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\\n";
	}
}
add_action( 'wp_head', 'redue_ai_seo_print_jsonld', 5 );

/**
 * Bust cache when API key is updated.
 */
function redue_ai_seo_on_key_update( $old_value, $value ) {
	if ( $old_value !== $value ) {
		delete_transient( 'redue_ai_seo_schemas' );
	}
}
add_action( 'update_option_redue_ai_seo_api_key', 'redue_ai_seo_on_key_update', 10, 2 );
`;
}

export function buildPluginReadme(): string {
	return `=== REDUE AI SEO & GEO ===
Contributors: redueai
Tags: seo, schema, json-ld, geo, ai-search
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

1-Click REDUE AI master schema sync for WordPress. Enter your API Key and JSON-LD is injected site-wide.

== Description ==

REDUE AI SEO & GEO connects your WordPress site to the REDUE PaaS schema engine.

* Enter a \`redue_live_sk_\` API Key from the Developer Center
* SoftwareApplication / WebSite (and related GEO) JSON-LD syncs automatically
* Works with the Autonomous Self-Healing agent on the REDUE platform

== Installation ==

1. Upload the \`redue-ai-seo\` folder to \`/wp-content/plugins/\`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings → REDUE AI SEO and paste your API Key
4. Click Save & Sync Schema

== Frequently Asked Questions ==

= Where do I get an API Key? =

Sign in to REDUE AI Studio → Developer Center and create a key.

= Does this modify theme files? =

No. Schema is printed via the \`wp_head\` action only.

== Changelog ==

= 1.0.0 =
* Initial WordPress.org-ready release.
`;
}

export function buildPluginAssetSvg(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="REDUE AI">
  <rect width="128" height="128" rx="24" fill="#0C0D0E"/>
  <rect x="16" y="16" width="96" height="96" rx="18" fill="none" stroke="#22d3ee" stroke-width="4"/>
  <text x="64" y="74" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28" font-weight="700" fill="#22d3ee">R</text>
</svg>
`;
}
