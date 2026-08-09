<?php
/**
 * Custom Post Type: ai_tool (AI 툴 큐레이션)
 * Custom Taxonomy: tool_category (툴 카테고리)
 *
 * @package Redue_Tool_Vault
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "ai_tool" custom post type.
 */
function redue_tv_register_ai_tool_cpt() {
	$labels = array(
		'name'                  => _x( 'AI 툴 큐레이션', 'Post type general name', 'redue-tool-vault' ),
		'singular_name'         => _x( 'AI 툴', 'Post type singular name', 'redue-tool-vault' ),
		'menu_name'             => _x( 'AI 툴 큐레이션', 'Admin Menu text', 'redue-tool-vault' ),
		'name_admin_bar'        => _x( 'AI 툴', 'Add New on Toolbar', 'redue-tool-vault' ),
		'add_new'               => __( '새로 추가', 'redue-tool-vault' ),
		'add_new_item'          => __( '새 AI 툴 추가', 'redue-tool-vault' ),
		'new_item'              => __( '새 AI 툴', 'redue-tool-vault' ),
		'edit_item'             => __( 'AI 툴 편집', 'redue-tool-vault' ),
		'view_item'             => __( 'AI 툴 보기', 'redue-tool-vault' ),
		'all_items'             => __( '전체 AI 툴', 'redue-tool-vault' ),
		'search_items'          => __( 'AI 툴 검색', 'redue-tool-vault' ),
		'not_found'             => __( '등록된 AI 툴이 없습니다.', 'redue-tool-vault' ),
		'not_found_in_trash'    => __( '휴지통에 AI 툴이 없습니다.', 'redue-tool-vault' ),
		'featured_image'        => __( '툴 대표 이미지', 'redue-tool-vault' ),
		'set_featured_image'    => __( '대표 이미지 설정', 'redue-tool-vault' ),
		'remove_featured_image' => __( '대표 이미지 제거', 'redue-tool-vault' ),
		'use_featured_image'    => __( '대표 이미지로 사용', 'redue-tool-vault' ),
		'archives'              => __( 'AI 툴 아카이브', 'redue-tool-vault' ),
	);

	$args = array(
		'labels'             => $labels,
		'public'             => true,
		'publicly_queryable' => true,
		'show_ui'            => true,
		'show_in_menu'       => true,
		'show_in_nav_menus'  => true,
		'show_in_admin_bar'  => true,
		'show_in_rest'       => true,
		'query_var'          => true,
		'capability_type'    => 'post',
		'has_archive'        => true,
		'hierarchical'       => false,
		'menu_position'      => 5,
		'menu_icon'          => 'dashicons-admin-tools',
		'supports'           => array( 'title', 'editor', 'thumbnail', 'excerpt' ),
		'rewrite'            => array(
			'slug'       => 'tool',
			'with_front' => false,
		),
	);

	register_post_type( 'ai_tool', $args );
}
add_action( 'init', 'redue_tv_register_ai_tool_cpt' );

/**
 * Register the "tool_category" custom taxonomy for the "ai_tool" post type.
 */
function redue_tv_register_tool_category_taxonomy() {
	$labels = array(
		'name'              => _x( '툴 카테고리', 'taxonomy general name', 'redue-tool-vault' ),
		'singular_name'     => _x( '툴 카테고리', 'taxonomy singular name', 'redue-tool-vault' ),
		'search_items'      => __( '카테고리 검색', 'redue-tool-vault' ),
		'all_items'         => __( '전체 카테고리', 'redue-tool-vault' ),
		'parent_item'       => __( '상위 카테고리', 'redue-tool-vault' ),
		'parent_item_colon' => __( '상위 카테고리:', 'redue-tool-vault' ),
		'edit_item'         => __( '카테고리 편집', 'redue-tool-vault' ),
		'update_item'       => __( '카테고리 업데이트', 'redue-tool-vault' ),
		'add_new_item'      => __( '새 카테고리 추가', 'redue-tool-vault' ),
		'new_item_name'     => __( '새 카테고리 이름', 'redue-tool-vault' ),
		'menu_name'         => __( '툴 카테고리', 'redue-tool-vault' ),
	);

	$args = array(
		'labels'            => $labels,
		'hierarchical'      => true,
		'public'            => true,
		'show_ui'           => true,
		'show_admin_column' => true,
		'show_in_nav_menus' => true,
		'show_in_rest'      => true,
		'query_var'         => true,
		'rewrite'           => array(
			'slug'       => 'tool-category',
			'with_front' => false,
		),
	);

	register_taxonomy( 'tool_category', array( 'ai_tool' ), $args );
}
add_action( 'init', 'redue_tv_register_tool_category_taxonomy' );

/**
 * Register the default "tool_category" terms if they don't already exist.
 *
 * - seo-marketing      : SEO & 마케팅
 * - developer-design   : 개발자 & 디자이너
 * - productivity       : 생산성 & 라이프
 */
function redue_tv_register_default_tool_categories() {
	$default_terms = array(
		'seo-marketing'    => 'SEO & 마케팅',
		'developer-design' => '개발자 & 디자이너',
		'productivity'     => '생산성 & 라이프',
	);

	foreach ( $default_terms as $slug => $name ) {
		if ( ! term_exists( $slug, 'tool_category' ) ) {
			wp_insert_term(
				$name,
				'tool_category',
				array( 'slug' => $slug )
			);
		}
	}
}
add_action( 'init', 'redue_tv_register_default_tool_categories', 20 );

/**
 * Flush rewrite rules once after the CPT/taxonomy are (re)registered.
 * This runs a single time and is safe to keep, it self-disables via an option flag.
 */
function redue_tv_maybe_flush_rewrite_rules() {
	if ( ! get_option( 'redue_tv_rewrite_flushed' ) ) {
		flush_rewrite_rules();
		update_option( 'redue_tv_rewrite_flushed', 1 );
	}
}
add_action( 'init', 'redue_tv_maybe_flush_rewrite_rules', 30 );
