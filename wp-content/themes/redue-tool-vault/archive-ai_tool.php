<?php
/**
 * Template for displaying the "ai_tool" post type archive.
 *
 * Subpage 2/5: 전체 AI 툴 아카이브 페이지 (All Tools Archive)
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
		<h1><?php esc_html_e( '전체 AI 툴 큐레이션', 'redue-tool-vault' ); ?></h1>
		<p><?php esc_html_e( '전 세계 숨은 AI & 파워 유저 라이프 툴을 한 곳에서 만나보세요.', 'redue-tool-vault' ); ?></p>
	</div>

	<?php if ( ! empty( $categories ) && ! is_wp_error( $categories ) ) : ?>
		<nav class="category-tabs">
			<a href="<?php echo esc_url( get_post_type_archive_link( 'ai_tool' ) ); ?>" class="is-active">
				<?php esc_html_e( '전체', 'redue-tool-vault' ); ?>
			</a>
			<?php foreach ( $categories as $category ) : ?>
				<a href="<?php echo esc_url( get_term_link( $category ) ); ?>">
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
		<p><?php esc_html_e( '등록된 AI 툴이 없습니다.', 'redue-tool-vault' ); ?></p>
	<?php endif; ?>

</main>

<?php
get_footer();
