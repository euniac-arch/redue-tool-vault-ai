<?php
/**
 * The main template file
 *
 * Fallback template used when no more specific template matches the query.
 *
 * @package Redue_Tool_Vault
 */

get_header();
?>

<main class="site-container">

	<div class="page-heading">
		<h1><?php is_home() ? _e( 'Redue AI Tool Vault', 'redue-tool-vault' ) : the_title(); ?></h1>
		<p><?php esc_html_e( '전 세계 숨은 AI & 파워 유저 라이프 툴 큐레이션', 'redue-tool-vault' ); ?></p>
	</div>

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
		<p><?php esc_html_e( '표시할 콘텐츠가 없습니다.', 'redue-tool-vault' ); ?></p>
	<?php endif; ?>

</main>

<?php
get_footer();
