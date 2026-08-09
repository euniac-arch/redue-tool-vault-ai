<?php
/**
 * Template Name: 툴 제보하기 (Submit a Tool)
 *
 * 방문자가 새로운 AI 툴을 제보할 수 있는 폼 페이지.
 * 제출 시 "ai_tool" 포스트를 상태 "검토 대기(pending)"로 생성하고,
 * 제보자 이메일은 비공개 메타(tool_submitter_email)로 저장합니다.
 *
 * @package Redue_Tool_Vault
 */

get_header();

$notice   = '';
$notice_type = 'success';
$old      = array(
	'tool_name'        => '',
	'tool_url'         => '',
	'tool_description' => '',
	'reporter_email'   => '',
);

if ( 'POST' === $_SERVER['REQUEST_METHOD'] && isset( $_POST['redue_tv_submit_tool_nonce'] ) &&
	wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['redue_tv_submit_tool_nonce'] ) ), 'redue_tv_submit_tool' ) ) {

	$old['tool_name']        = isset( $_POST['tool_name'] ) ? sanitize_text_field( wp_unslash( $_POST['tool_name'] ) ) : '';
	$old['tool_url']         = isset( $_POST['tool_url'] ) ? esc_url_raw( wp_unslash( $_POST['tool_url'] ) ) : '';
	$old['tool_description'] = isset( $_POST['tool_description'] ) ? sanitize_text_field( wp_unslash( $_POST['tool_description'] ) ) : '';
	$old['reporter_email']   = isset( $_POST['reporter_email'] ) ? sanitize_email( wp_unslash( $_POST['reporter_email'] ) ) : '';

	if ( '' === $old['tool_name'] || '' === $old['tool_url'] || '' === $old['tool_description'] || ! is_email( $old['reporter_email'] ) ) {
		$notice      = __( '모든 항목을 올바르게 입력해 주세요.', 'redue-tool-vault' );
		$notice_type = 'error';
	} else {
		$post_id = wp_insert_post(
			array(
				'post_type'    => 'ai_tool',
				'post_status'  => 'pending',
				'post_title'   => $old['tool_name'],
				'post_content' => $old['tool_description'],
				'post_excerpt' => $old['tool_description'],
			),
			true
		);

		if ( ! is_wp_error( $post_id ) && $post_id ) {
			update_post_meta( $post_id, 'tool_official_url', $old['tool_url'] );
			update_post_meta( $post_id, 'tool_tagline', $old['tool_description'] );
			update_post_meta( $post_id, 'tool_submitter_email', $old['reporter_email'] );

			$notice      = __( '소중한 제보 감사합니다! 검토 후 큐레이션 목록에 등록해 드릴게요.', 'redue-tool-vault' );
			$notice_type = 'success';
			$old         = array(
				'tool_name'        => '',
				'tool_url'         => '',
				'tool_description' => '',
				'reporter_email'   => '',
			);
		} else {
			$notice      = __( '제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'redue-tool-vault' );
			$notice_type = 'error';
		}
	}
}

while ( have_posts() ) :
	the_post();
	?>

	<main class="site-container">

		<div class="page-heading">
			<h1><?php the_title(); ?></h1>
			<p><?php esc_html_e( '알고 있는 숨은 AI 툴을 제보해 주세요. 검토 후 큐레이션 목록에 추가해 드립니다.', 'redue-tool-vault' ); ?></p>
		</div>

		<div class="submit-form-wrap">

			<?php if ( $notice ) : ?>
				<div class="form-notice form-notice--<?php echo esc_attr( $notice_type ); ?>">
					<?php echo esc_html( $notice ); ?>
				</div>
			<?php endif; ?>

			<?php if ( get_the_content() ) : ?>
				<div class="tool-content submit-form-intro"><?php the_content(); ?></div>
			<?php endif; ?>

			<form method="post" class="submit-tool-form" novalidate>
				<?php wp_nonce_field( 'redue_tv_submit_tool', 'redue_tv_submit_tool_nonce' ); ?>

				<div class="form-field">
					<label for="tool_name"><?php esc_html_e( '툴 이름', 'redue-tool-vault' ); ?></label>
					<input type="text" id="tool_name" name="tool_name" required
						placeholder="<?php esc_attr_e( '예: Redue SEO Studio', 'redue-tool-vault' ); ?>"
						value="<?php echo esc_attr( $old['tool_name'] ); ?>">
				</div>

				<div class="form-field">
					<label for="tool_url"><?php esc_html_e( 'URL', 'redue-tool-vault' ); ?></label>
					<input type="url" id="tool_url" name="tool_url" required
						placeholder="https://example.com"
						value="<?php echo esc_attr( $old['tool_url'] ); ?>">
				</div>

				<div class="form-field">
					<label for="tool_description"><?php esc_html_e( '한 줄 설명', 'redue-tool-vault' ); ?></label>
					<textarea id="tool_description" name="tool_description" rows="3" required
						placeholder="<?php esc_attr_e( '이 툴이 무엇을 해결해 주는지 한 줄로 소개해 주세요.', 'redue-tool-vault' ); ?>"><?php echo esc_textarea( $old['tool_description'] ); ?></textarea>
				</div>

				<div class="form-field">
					<label for="reporter_email"><?php esc_html_e( '제보자 이메일', 'redue-tool-vault' ); ?></label>
					<input type="email" id="reporter_email" name="reporter_email" required
						placeholder="you@example.com"
						value="<?php echo esc_attr( $old['reporter_email'] ); ?>">
					<p class="form-field__hint"><?php esc_html_e( '등록 여부 안내를 위해서만 사용하며, 사이트에 공개되지 않습니다.', 'redue-tool-vault' ); ?></p>
				</div>

				<button type="submit" class="btn-cta btn-cta--block"><?php esc_html_e( '제보하기', 'redue-tool-vault' ); ?> &rarr;</button>
			</form>

		</div>

	</main>

	<?php
endwhile;

get_footer();
