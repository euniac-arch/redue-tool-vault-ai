/**
 * Multi-type JSON-LD builders used by the autonomous Self-Healing agent
 * when new posts / CPTs / location pages are detected.
 */

import type { AgentSchemaType } from './agent-store';

export interface SchemaRegenInput {
	name: string;
	description: string;
	url: string;
	domain: string;
}

export function buildSchemaPayload(type: AgentSchemaType, input: SchemaRegenInput): Record<string, unknown> {
	switch (type) {
		case 'Article':
			return {
				'@context': 'https://schema.org',
				'@type': 'Article',
				headline: input.name,
				description: input.description,
				url: input.url,
				mainEntityOfPage: input.url,
				author: { '@type': 'Organization', name: 'REDUE AI' },
				publisher: { '@type': 'Organization', name: input.domain },
				datePublished: new Date().toISOString().slice(0, 10),
			};
		case 'LocalBusiness':
			return {
				'@context': 'https://schema.org',
				'@type': 'LocalBusiness',
				name: input.name,
				description: input.description,
				url: input.url,
				'@id': input.url,
				address: {
					'@type': 'PostalAddress',
					addressCountry: 'KR',
				},
			};
		case 'WebSite':
			return {
				'@context': 'https://schema.org',
				'@type': 'WebSite',
				name: input.name,
				url: input.url,
			};
		case 'SoftwareApplication':
		default:
			return {
				'@context': 'https://schema.org',
				'@type': 'SoftwareApplication',
				name: input.name,
				description: input.description,
				url: input.url,
				applicationCategory: 'BusinessApplication',
				operatingSystem: 'Web',
			};
	}
}

/**
 * PHP block that emits SoftwareApplication / Article / LocalBusiness /
 * WebSite based on WordPress conditionals — used when the agent reinjects
 * after detecting new CPTs or posts.
 */
export function generateAutonomousHeaderBlock(): string {
	return `\t<?php
\t/* REDUE_AI_STUDIO:START v2 — Autonomous Self-Healing Agent */
\tif ( ! function_exists( 'redue_ai_studio_master_schema' ) ) {
\t\tfunction redue_ai_studio_master_schema() {
\t\t\tif ( is_singular( 'ai_tool' ) ) {
\t\t\t\tglobal $post;
\t\t\t\t$schema = array(
\t\t\t\t\t'@context'    => 'https://schema.org',
\t\t\t\t\t'@type'       => 'SoftwareApplication',
\t\t\t\t\t'name'        => get_the_title( $post ),
\t\t\t\t\t'description' => get_post_meta( $post->ID, 'tool_tagline', true ),
\t\t\t\t\t'url'         => get_permalink( $post ),
\t\t\t\t);
\t\t\t} elseif ( is_singular( array( 'post', 'news', 'article' ) ) ) {
\t\t\t\tglobal $post;
\t\t\t\t$schema = array(
\t\t\t\t\t'@context'      => 'https://schema.org',
\t\t\t\t\t'@type'         => 'Article',
\t\t\t\t\t'headline'      => get_the_title( $post ),
\t\t\t\t\t'description'   => get_the_excerpt( $post ),
\t\t\t\t\t'url'           => get_permalink( $post ),
\t\t\t\t\t'datePublished' => get_the_date( 'c', $post ),
\t\t\t\t);
\t\t\t} elseif ( is_post_type_archive( 'local_business' ) || is_page( 'location' ) || is_page( 'contact' ) ) {
\t\t\t\t$schema = array(
\t\t\t\t\t'@context' => 'https://schema.org',
\t\t\t\t\t'@type'    => 'LocalBusiness',
\t\t\t\t\t'name'     => get_bloginfo( 'name' ),
\t\t\t\t\t'url'      => home_url( '/' ),
\t\t\t\t);
\t\t\t} elseif ( is_front_page() ) {
\t\t\t\t$schema = array(
\t\t\t\t\t'@context' => 'https://schema.org',
\t\t\t\t\t'@type'    => 'WebSite',
\t\t\t\t\t'name'     => get_bloginfo( 'name' ),
\t\t\t\t\t'url'      => home_url( '/' ),
\t\t\t\t);
\t\t\t} else {
\t\t\t\treturn;
\t\t\t}
\t\t\techo '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\\n";
\t\t}
\t}
\tadd_action( 'wp_head', 'redue_ai_studio_master_schema' );
\t/* REDUE_AI_STUDIO:END */
\t?>`;
}

export function chooseSchemaTypesForChange(signals: {
	newPost: boolean;
	newCpt: boolean;
	locationPage: boolean;
}): AgentSchemaType[] {
	const types: AgentSchemaType[] = ['SoftwareApplication'];
	if (signals.newPost) types.push('Article');
	if (signals.locationPage || signals.newCpt) types.push('LocalBusiness');
	if (!signals.newPost && !signals.newCpt) types.push('WebSite');
	return Array.from(new Set(types));
}
