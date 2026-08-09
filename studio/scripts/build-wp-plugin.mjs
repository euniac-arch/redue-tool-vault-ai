#!/usr/bin/env node
/**
 * CLI: build WordPress.org plugin zip into studio/.data/builds/
 * Usage: node scripts/build-wp-plugin.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
	const apiBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(
		/\/$/,
		''
	);

	const php = `<?php
/**
 * Plugin Name:       REDUE AI SEO & GEO
 * Plugin URI:        https://redue.ai
 * Description:       1-Click master schema sync via REDUE API Key.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            REDUE AI
 * License:           GPL-2.0-or-later
 * Text Domain:       redue-ai-seo
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'REDUE_AI_SEO_VERSION', '1.0.0' );
define( 'REDUE_AI_SEO_API_BASE', '${apiBase}' );

function redue_ai_seo_register_settings() {
	register_setting( 'redue_ai_seo_settings', 'redue_ai_seo_api_key', array(
		'type' => 'string', 'sanitize_callback' => 'sanitize_text_field', 'default' => '',
	) );
}
add_action( 'admin_init', 'redue_ai_seo_register_settings' );

function redue_ai_seo_add_menu() {
	add_options_page( 'REDUE AI SEO & GEO', 'REDUE AI SEO', 'manage_options', 'redue-ai-seo', 'redue_ai_seo_render_settings_page' );
}
add_action( 'admin_menu', 'redue_ai_seo_add_menu' );

function redue_ai_seo_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) { return; }
	$api_key = get_option( 'redue_ai_seo_api_key', '' );
	?>
	<div class="wrap">
		<h1>REDUE AI SEO &amp; GEO</h1>
		<form method="post" action="options.php">
			<?php settings_fields( 'redue_ai_seo_settings' ); ?>
			<table class="form-table"><tr>
				<th scope="row"><label for="redue_ai_seo_api_key">API Key</label></th>
				<td><input type="password" class="regular-text" id="redue_ai_seo_api_key" name="redue_ai_seo_api_key" value="<?php echo esc_attr( $api_key ); ?>" /></td>
			</tr></table>
			<?php submit_button( 'Save & Sync Schema' ); ?>
		</form>
	</div>
	<?php
}

function redue_ai_seo_fetch_schemas() {
	$cached = get_transient( 'redue_ai_seo_schemas' );
	if ( is_array( $cached ) ) { return $cached; }
	$api_key = get_option( 'redue_ai_seo_api_key', '' );
	if ( empty( $api_key ) ) { return array(); }
	$response = wp_remote_post( REDUE_AI_SEO_API_BASE . '/api/v1/schema/generate', array(
		'timeout' => 15,
		'headers' => array(
			'Authorization' => 'Bearer ' . $api_key,
			'Content-Type'  => 'application/json',
		),
		'body' => wp_json_encode( array(
			'domain' => home_url( '/' ),
			'cms_type' => 'wordpress',
			'lang' => ( strpos( get_locale(), 'ko' ) === 0 ) ? 'ko' : 'en',
		) ),
	) );
	if ( is_wp_error( $response ) ) { return array(); }
	$body = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( empty( $body['json_ld'] ) || ! is_array( $body['json_ld'] ) ) { return array(); }
	set_transient( 'redue_ai_seo_schemas', $body['json_ld'], 12 * HOUR_IN_SECONDS );
	return $body['json_ld'];
}

function redue_ai_seo_print_jsonld() {
	foreach ( redue_ai_seo_fetch_schemas() as $schema ) {
		echo '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\\n";
	}
}
add_action( 'wp_head', 'redue_ai_seo_print_jsonld', 5 );

function redue_ai_seo_on_key_update( $old_value, $value ) {
	if ( $old_value !== $value ) { delete_transient( 'redue_ai_seo_schemas' ); }
}
add_action( 'update_option_redue_ai_seo_api_key', 'redue_ai_seo_on_key_update', 10, 2 );
`;

	const readme = `=== REDUE AI SEO & GEO ===
Contributors: redueai
Tags: seo, schema, json-ld, geo, ai-search
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

1-Click REDUE AI master schema sync for WordPress.

== Description ==
Enter your REDUE API Key and JSON-LD syncs site-wide via wp_head.

== Installation ==
1. Upload to /wp-content/plugins/
2. Activate
3. Settings → REDUE AI SEO → paste API Key

== Changelog ==
= 1.0.0 =
* Initial release.
`;

	const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="#0C0D0E"/><rect x="16" y="16" width="96" height="96" rx="18" fill="none" stroke="#22d3ee" stroke-width="4"/><text x="64" y="74" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="#22d3ee">R</text></svg>`;

	const zip = new JSZip();
	zip.file('redue-ai-seo/redue-ai-seo.php', php);
	zip.file('redue-ai-seo/readme.txt', readme);
	zip.file('redue-ai-seo/assets/icon.svg', icon);

	const outDir = path.join(__dirname, '..', '.data', 'builds');
	fs.mkdirSync(outDir, { recursive: true });
	const outFile = path.join(outDir, 'redue-ai-seo-1.0.0.zip');
	const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
	fs.writeFileSync(outFile, buf);
	console.log(`Built ${outFile} (${buf.length} bytes)`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
