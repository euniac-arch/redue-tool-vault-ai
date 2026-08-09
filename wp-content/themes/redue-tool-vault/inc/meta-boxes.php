<?php
/**
 * Custom meta boxes for the "ai_tool" post type.
 *
 * Registers admin fields and persists them to postmeta:
 * - tool_tagline          (text)   한 줄 요약
 * - tool_official_url     (url)    공식 사이트 링크
 * - tool_pricing_type     (select) 요금제
 * - tool_price_amount     (text)   시작 가격
 * - tool_price_currency   (text)   통화 단위
 * - tool_operating_system (text)   지원 환경
 * - tool_rating_score     (number) 추천 점수
 * - tool_submitter_email  (email)  제보자 이메일 (비공개, 프론트엔드 미노출)
 *
 * @package Redue_Tool_Vault
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return the field schema used to render and save the meta box.
 *
 * @return array
 */
function redue_tv_get_tool_meta_fields() {
	return array(
		'tool_tagline'          => array(
			'label'       => __( '한 줄 요약', 'redue-tool-vault' ),
			'type'        => 'text',
			'placeholder' => __( '예: AI 기반 SEO & GEO 자동 스키마 주입 솔루션', 'redue-tool-vault' ),
		),
		'tool_official_url'     => array(
			'label'       => __( '공식 사이트 링크', 'redue-tool-vault' ),
			'type'        => 'url',
			'placeholder' => 'https://redue.ai',
		),
		'tool_pricing_type'     => array(
			'label'   => __( '요금제', 'redue-tool-vault' ),
			'type'    => 'select',
			'options' => array(
				'Free'       => __( 'Free', 'redue-tool-vault' ),
				'Freemium'   => __( 'Freemium', 'redue-tool-vault' ),
				'Paid'       => __( 'Paid', 'redue-tool-vault' ),
				'Free Trial' => __( 'Free Trial', 'redue-tool-vault' ),
			),
		),
		'tool_price_amount'     => array(
			'label'       => __( '시작 가격', 'redue-tool-vault' ),
			'type'        => 'text',
			'placeholder' => '29',
		),
		'tool_price_currency'   => array(
			'label'       => __( '통화 단위', 'redue-tool-vault' ),
			'type'        => 'text',
			'placeholder' => 'USD',
		),
		'tool_operating_system' => array(
			'label'       => __( '지원 환경', 'redue-tool-vault' ),
			'type'        => 'text',
			'placeholder' => __( 'Web, Chrome Extension', 'redue-tool-vault' ),
		),
		'tool_rating_score'     => array(
			'label'       => __( '추천 점수', 'redue-tool-vault' ),
			'type'        => 'number',
			'placeholder' => '4.9',
			'step'        => '0.1',
			'min'         => '0',
			'max'         => '5',
		),
		'tool_submitter_email'  => array(
			'label'       => __( '제보자 이메일 (비공개)', 'redue-tool-vault' ),
			'type'        => 'email',
			'placeholder' => 'reporter@example.com',
		),
	);
}

/**
 * Register the "ai_tool" details meta box.
 */
function redue_tv_add_tool_meta_boxes() {
	add_meta_box(
		'redue_tv_tool_details',
		__( 'AI 툴 상세 정보', 'redue-tool-vault' ),
		'redue_tv_render_tool_meta_box',
		'ai_tool',
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'redue_tv_add_tool_meta_boxes' );

/**
 * Render the meta box fields.
 *
 * @param WP_Post $post Current post object.
 */
function redue_tv_render_tool_meta_box( $post ) {
	wp_nonce_field( 'redue_tv_save_tool_meta', 'redue_tv_tool_meta_nonce' );

	$fields = redue_tv_get_tool_meta_fields();
	echo '<table class="form-table" role="presentation"><tbody>';

	foreach ( $fields as $key => $field ) {
		$value = get_post_meta( $post->ID, $key, true );
		echo '<tr>';
		echo '<th scope="row"><label for="' . esc_attr( $key ) . '">' . esc_html( $field['label'] ) . '</label></th>';
		echo '<td>';

		if ( 'select' === $field['type'] ) {
			echo '<select name="' . esc_attr( $key ) . '" id="' . esc_attr( $key ) . '" class="regular-text">';
			foreach ( $field['options'] as $option_value => $option_label ) {
				printf(
					'<option value="%1$s"%2$s>%3$s</option>',
					esc_attr( $option_value ),
					selected( $value, $option_value, false ),
					esc_html( $option_label )
				);
			}
			echo '</select>';
		} elseif ( 'number' === $field['type'] ) {
			printf(
				'<input type="number" step="%1$s" min="%2$s" max="%3$s" name="%4$s" id="%4$s" value="%5$s" placeholder="%6$s" class="regular-text" />',
				esc_attr( $field['step'] ?? '1' ),
				esc_attr( $field['min'] ?? '' ),
				esc_attr( $field['max'] ?? '' ),
				esc_attr( $key ),
				esc_attr( $value ),
				esc_attr( $field['placeholder'] ?? '' )
			);
		} elseif ( 'url' === $field['type'] ) {
			printf(
				'<input type="url" name="%1$s" id="%1$s" value="%2$s" placeholder="%3$s" class="regular-text" />',
				esc_attr( $key ),
				esc_url( $value ),
				esc_attr( $field['placeholder'] ?? '' )
			);
		} elseif ( 'email' === $field['type'] ) {
			printf(
				'<input type="email" name="%1$s" id="%1$s" value="%2$s" placeholder="%3$s" class="regular-text" />',
				esc_attr( $key ),
				esc_attr( $value ),
				esc_attr( $field['placeholder'] ?? '' )
			);
		} else {
			printf(
				'<input type="text" name="%1$s" id="%1$s" value="%2$s" placeholder="%3$s" class="regular-text" />',
				esc_attr( $key ),
				esc_attr( $value ),
				esc_attr( $field['placeholder'] ?? '' )
			);
		}

		echo '</td>';
		echo '</tr>';
	}

	echo '</tbody></table>';
}

/**
 * Sanitize a single field value according to its declared type.
 *
 * @param string $type  Field type.
 * @param mixed  $value Raw value.
 * @return string
 */
function redue_tv_sanitize_tool_field( $type, $value ) {
	switch ( $type ) {
		case 'url':
			return esc_url_raw( wp_unslash( $value ) );
		case 'email':
			return sanitize_email( wp_unslash( $value ) );
		case 'number':
			return is_numeric( $value ) ? (string) floatval( $value ) : '';
		case 'select':
			return sanitize_text_field( wp_unslash( $value ) );
		default:
			return sanitize_text_field( wp_unslash( $value ) );
	}
}

/**
 * Persist the meta box fields to postmeta on save.
 *
 * @param int $post_id Post ID.
 */
function redue_tv_save_tool_meta( $post_id ) {
	if ( ! isset( $_POST['redue_tv_tool_meta_nonce'] ) ||
		! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['redue_tv_tool_meta_nonce'] ) ), 'redue_tv_save_tool_meta' ) ) {
		return;
	}

	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}

	if ( isset( $_POST['post_type'] ) && 'ai_tool' !== $_POST['post_type'] ) {
		return;
	}

	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	$fields = redue_tv_get_tool_meta_fields();

	foreach ( $fields as $key => $field ) {
		if ( isset( $_POST[ $key ] ) ) {
			$sanitized = redue_tv_sanitize_tool_field( $field['type'], $_POST[ $key ] );
			update_post_meta( $post_id, $key, $sanitized );
		} else {
			delete_post_meta( $post_id, $key );
		}
	}
}
add_action( 'save_post_ai_tool', 'redue_tv_save_tool_meta' );

/**
 * Expose the ai_tool meta fields to the REST API / Gutenberg (optional, read-only exposure).
 */
function redue_tv_register_tool_meta_rest() {
	$fields = redue_tv_get_tool_meta_fields();
	foreach ( $fields as $key => $field ) {
		register_post_meta(
			'ai_tool',
			$key,
			array(
				'show_in_rest' => true,
				'single'       => true,
				'type'         => 'string',
				'auth_callback' => function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);
	}
}
add_action( 'init', 'redue_tv_register_tool_meta_rest' );
