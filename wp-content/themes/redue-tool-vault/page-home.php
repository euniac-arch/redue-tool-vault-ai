<?php
/**
 * Template Name: 홈 (큐레이션 랜딩)
 *
 * Subpage 4/5: 홈페이지 큐레이션 랜딩 템플릿
 * 카테고리별 추천 AI 툴을 노출하는 매거진형 홈 화면.
 * 워드프레스 관리자 > 설정 > 읽기 에서 이 페이지를 "홈페이지에 표시"로
 * 지정하여 사용합니다.
 *
 * @package Redue_Tool_Vault
 */

get_header();

$categories = get_terms(
	array(
		'taxonomy'   => 'tool_category',
		'hide_empty' => false,
	)
);
?>

<main class="site-container">

	<div class="page-heading">
		<h1><?php esc_html_e( 'Redue AI Tool Vault', 'redue-tool-vault' ); ?></h1>
		<p><?php esc_html_e( '전 세계 숨은 AI & 파워 유저 라이프 툴 큐레이션 — 매주 검증된 툴만 엄선합니다.', 'redue-tool-vault' ); ?></p>
	</div>

	<?php while ( have_posts() ) : ?>
		<?php the_post(); ?>
		<div class="tool-content"><?php the_content(); ?></div>
	<?php endwhile; ?>

	<?php if ( ! empty( $categories ) && ! is_wp_error( $categories ) ) : ?>
		<?php foreach ( $categories as $category ) : ?>
			<?php
			$tools_query = new WP_Query(
				array(
					'post_type'      => 'ai_tool',
					'posts_per_page' => 4,
					'tax_query'      => array(
						array(
							'taxonomy' => 'tool_category',
							'field'    => 'term_id',
							'terms'    => $category->term_id,
						),
					),
				)
			);
			?>
			<?php if ( $tools_query->have_posts() ) : ?>
				<section class="category-section">
					<div class="page-heading" style="margin-top:48px;">
						<h1 style="font-size:22px;">
							<a href="<?php echo esc_url( get_term_link( $category ) ); ?>"><?php echo esc_html( $category->name ); ?></a>
						</h1>
					</div>
					<div class="tool-grid">
						<?php
						while ( $tools_query->have_posts() ) :
							$tools_query->the_post();
							get_template_part( 'template-parts/content', 'tool-card' );
						endwhile;
						?>
					</div>
				</section>
				<?php wp_reset_postdata(); ?>
			<?php endif; ?>
		<?php endforeach; ?>
	<?php endif; ?>

</main>

<?php
get_footer();
