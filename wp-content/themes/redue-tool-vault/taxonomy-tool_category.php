<?php
/**
 * Template for displaying "tool_category" taxonomy archives.
 *
 * Subpage 3/5: 카테고리별 아카이브 페이지
 * (예: SEO & 마케팅 / 개발자 & 디자이너 / 생산성 & 라이프)
 *
 * @package Redue_Tool_Vault
 */

get_header();

$current_term = get_queried_object();
$categories   = get_terms(
	array(
		'taxonomy'   => 'tool_category',
		'hide_empty' => false,
	)
);
?>

<main class="site-container">

	<div class="page-heading">
		<h1><?php echo esc_html( $current_term->name ); ?></h1>
		<?php if ( ! empty( $current_term->description ) ) : ?>
			<p><?php echo esc_html( $current_term->description ); ?></p>
		<?php endif; ?>
	</div>

	<?php if ( ! empty( $categories ) && ! is_wp_error( $categories ) ) : ?>
		<nav class="category-tabs">
			<a href="<?php echo esc_url( get_post_type_archive_link( 'ai_tool' ) ); ?>">
				<?php esc_html_e( '전체', 'redue-tool-vault' ); ?>
			</a>
			<?php foreach ( $categories as $category ) : ?>
				<a href="<?php echo esc_url( get_term_link( $category ) ); ?>"
					class="<?php echo ( $category->term_id === $current_term->term_id ) ? 'is-active' : ''; ?>">
					<?php echo esc_html( $category->name ); ?>
				</a>
			<?php endforeach; ?>
		</nav>
	<?php endif; ?>

	<?php if ( have_posts() ) : ?>
		<div class="tool-grid">
			<?php
			while ( have_posts() ) :
				the_post();
				get_template_part( 'template-parts/content', 'tool-card' );
			endwhile;
			?>
		</div>
		<?php the_posts_pagination(); ?>
	<?php else : ?>
		<p><?php esc_html_e( '이 카테고리에 등록된 AI 툴이 없습니다.', 'redue-tool-vault' ); ?></p>
	<?php endif; ?>

</main>

<?php
get_footer();
