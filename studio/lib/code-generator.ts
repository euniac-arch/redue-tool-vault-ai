export const MARKER_START = 'REDUE_AI_STUDIO:START';
export const MARKER_END = 'REDUE_AI_STUDIO:END';

/**
 * The dynamic PHP function body shared by both injection targets. It uses
 * real WordPress conditional tags (`is_singular()`, `is_front_page()`) and
 * `get_post_meta()` so the schema actually reflects live post data instead
 * of being static markup — a `SoftwareApplication` schema on `ai_tool`
 * singulars, a `WebSite` schema on the front page.
 */
function buildFunctionBody(): string {
	return `if ( ! function_exists( 'redue_ai_studio_master_schema' ) ) {
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

		echo '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\\n";
	}
}
add_action( 'wp_head', 'redue_ai_studio_master_schema' );`;
}

/**
 * Master schema block for the priority-1 target: inlined directly inside
 * `header.php`'s `<head>`, right before the `<?php wp_head(); ?>` call, so
 * the `add_action()` registration always lands before `wp_head` fires.
 */
export function generateHeaderBlock(): string {
	const body = buildFunctionBody();
	return `\t<?php
\t/* ${MARKER_START} v1 — REDUE AI SEO & GEO Studio 자동 주입 */
\t${body.split('\n').join('\n\t')}
\t/* ${MARKER_END} */
\t?>`;
}

/**
 * Master schema block for the priority-2 fallback target: appended to the
 * bottom of `functions.php` (already inside an open `<?php` context).
 */
export function generateFunctionsBlock(): string {
	const body = buildFunctionBody();
	return `\n/* ${MARKER_START} v1 — REDUE AI SEO & GEO Studio 자동 주입 */
${body}
/* ${MARKER_END} */\n`;
}
