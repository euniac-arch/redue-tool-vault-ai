<?php
/**
 * One-time dummy data seeder for the "ai_tool" custom post type.
 *
 * Registers 5 representative AI tools so that the CPT, meta box fields,
 * taxonomy terms and templates built in Step 1 can be verified immediately
 * on a fresh local install, without having to fill in the admin forms by
 * hand.
 *
 * Safety:
 * - Guarded by an option flag (`redue_tv_dummy_data_seeded`) so the whole
 *   routine only ever runs to completion once.
 * - Each tool is additionally checked against its slug before insertion,
 *   so re-running the seeder (e.g. after resetting the option) never
 *   creates duplicate posts.
 *
 * @package Redue_Tool_Vault
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The 5 dummy "ai_tool" entries used to verify Step 1's CPT/template setup.
 *
 * @return array[]
 */
function redue_tv_get_dummy_tools() {
	return array(
		array(
			'title'         => 'Redue SEO Studio',
			'category'      => 'seo-marketing',
			'tagline'       => 'AI 기반 SEO & GEO 자동 스키마 주입 솔루션',
			'content'       => 'Redue SEO Studio는 AI가 사이트 전반의 스키마 마크업과 GEO(생성형 검색엔진 최적화) 신호를 자동으로 진단하고 주입해 주는 올인원 SEO 자동화 툴입니다. 크롤링 리포트부터 구조화 데이터 검증까지 한 번에 처리할 수 있어 마케팅팀의 반복 작업을 크게 줄여줍니다. 매주 업데이트되는 AI 검색엔진 트렌드에 맞춰 스키마 템플릿이 자동으로 최신화되는 점이 가장 큰 강점입니다.',
			'official_url'  => 'https://redue.ai',
			'pricing_type'  => 'Paid',
			'price_amount'  => '29',
			'price_currency' => 'USD',
			'os'            => 'Web',
			'rating'        => '4.9',
		),
		array(
			'title'         => 'Cursor AI Code Editor',
			'category'      => 'developer-design',
			'tagline'       => '코드베이스를 이해하는 AI 네이티브 코드 에디터',
			'content'       => 'Cursor는 VS Code 기반의 AI 네이티브 코드 에디터로, 코드베이스 전체를 이해하는 에이전트가 리팩터링, 버그 수정, 신규 기능 구현을 대화형으로 도와줍니다. Tab 자동완성과 멀티파일 편집 기능이 특히 뛰어나며, 실제 프로덕션 코드베이스에서도 안정적으로 동작합니다. 개발 속도를 체감할 수 있는 몇 안 되는 AI 툴 중 하나입니다.',
			'official_url'  => 'https://cursor.com',
			'pricing_type'  => 'Freemium',
			'price_amount'  => '20',
			'price_currency' => 'USD',
			'os'            => 'macOS, Windows, Linux',
			'rating'        => '4.8',
		),
		array(
			'title'         => 'Raycast Command Center',
			'category'      => 'productivity',
			'tagline'       => '단축키 하나로 모든 것을 실행하는 커맨드 팔레트',
			'content'       => 'Raycast는 macOS의 스포트라이트를 대체하는 커맨드 팔레트 앱으로, 클립보드 히스토리, 스니펫, 캘린더, AI 채팅까지 하나의 단축키로 실행할 수 있습니다. 확장 프로그램 생태계가 매우 활발해 팀 협업 도구와도 손쉽게 연동됩니다. 생산성 파워 유저라면 반드시 사용해봐야 할 필수 유틸리티입니다.',
			'official_url'  => 'https://www.raycast.com',
			'pricing_type'  => 'Freemium',
			'price_amount'  => '8',
			'price_currency' => 'USD',
			'os'            => 'macOS',
			'rating'        => '4.9',
		),
		array(
			'title'         => 'PostHog Product Analytics',
			'category'      => 'seo-marketing',
			'tagline'       => '분석 · 세션 리플레이 · A/B 테스트를 한 번에',
			'content'       => 'PostHog는 제품 애널리틱스, 세션 리플레이, 피처 플래그, A/B 테스트를 하나의 대시보드에서 제공하는 오픈소스 기반 프로덕트 분석 플랫폼입니다. 셀프 호스팅과 클라우드 옵션을 모두 지원해 데이터 주권이 중요한 팀에게도 적합합니다. 무료 티어만으로도 스타트업 초기 단계에 필요한 대부분의 분석 기능을 사용할 수 있습니다.',
			'official_url'  => 'https://posthog.com',
			'pricing_type'  => 'Freemium',
			'price_amount'  => '0',
			'price_currency' => 'USD',
			'os'            => 'Web, Self-hosted',
			'rating'        => '4.7',
		),
		array(
			'title'         => 'v0 by Vercel',
			'category'      => 'developer-design',
			'tagline'       => '프롬프트로 바로 동작하는 UI 컴포넌트를 생성',
			'content'       => 'v0는 텍스트 프롬프트만으로 React와 Tailwind 기반의 실제 동작하는 UI 컴포넌트를 생성해주는 Vercel의 생성형 디자인 툴입니다. 생성된 코드는 그대로 Next.js 프로젝트에 복사해 붙여넣을 수 있어 프로토타이핑 속도가 압도적으로 빠릅니다. 디자이너와 개발자 사이의 협업 간극을 좁혀주는 도구로 각광받고 있습니다.',
			'official_url'  => 'https://v0.dev',
			'pricing_type'  => 'Freemium',
			'price_amount'  => '20',
			'price_currency' => 'USD',
			'os'            => 'Web',
			'rating'        => '4.6',
		),
	);
}

/**
 * Whether a dummy "ai_tool" post already exists for the given title.
 *
 * Uses the post slug (not the deprecated get_page_by_title()) so this is
 * safe to call repeatedly.
 *
 * @param string $title Tool title.
 * @return bool
 */
function redue_tv_dummy_tool_exists( $title ) {
	$existing = get_page_by_path( sanitize_title( $title ), OBJECT, 'ai_tool' );
	return ! empty( $existing );
}

/**
 * Insert the 5 dummy "ai_tool" posts, once.
 *
 * Runs on `admin_init` so it fires the moment an administrator opens
 * /wp-admin, and self-disables via the `redue_tv_dummy_data_seeded` option
 * so it truly only executes one time.
 */
function redue_tv_seed_dummy_tools() {
	if ( get_option( 'redue_tv_dummy_data_seeded' ) ) {
		return;
	}

	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	foreach ( redue_tv_get_dummy_tools() as $tool ) {
		if ( redue_tv_dummy_tool_exists( $tool['title'] ) ) {
			continue;
		}

		$post_id = wp_insert_post(
			array(
				'post_type'    => 'ai_tool',
				'post_status'  => 'publish',
				'post_title'   => sanitize_text_field( $tool['title'] ),
				'post_name'    => sanitize_title( $tool['title'] ),
				'post_content' => wp_kses_post( $tool['content'] ),
				'post_excerpt' => sanitize_text_field( $tool['tagline'] ),
			),
			true
		);

		if ( is_wp_error( $post_id ) || ! $post_id ) {
			continue;
		}

		update_post_meta( $post_id, 'tool_tagline', sanitize_text_field( $tool['tagline'] ) );
		update_post_meta( $post_id, 'tool_official_url', esc_url_raw( $tool['official_url'] ) );
		update_post_meta( $post_id, 'tool_pricing_type', sanitize_text_field( $tool['pricing_type'] ) );
		update_post_meta( $post_id, 'tool_price_amount', sanitize_text_field( $tool['price_amount'] ) );
		update_post_meta( $post_id, 'tool_price_currency', sanitize_text_field( $tool['price_currency'] ) );
		update_post_meta( $post_id, 'tool_operating_system', sanitize_text_field( $tool['os'] ) );
		update_post_meta( $post_id, 'tool_rating_score', sanitize_text_field( $tool['rating'] ) );

		wp_set_object_terms( $post_id, $tool['category'], 'tool_category', false );
	}

	update_option( 'redue_tv_dummy_data_seeded', 1 );
}
add_action( 'admin_init', 'redue_tv_seed_dummy_tools' );
