<?php
/**
 * Template Name: 소개 (큐레이션 기준)
 *
 * Subpage 5/5: 사이트 소개 / 큐레이션 기준 페이지
 * Redue AI Tool Vault의 큐레이션 원칙과 선정 기준을 설명하는 정적 페이지.
 *
 * @package Redue_Tool_Vault
 */

get_header();

while ( have_posts() ) :
	the_post();
	?>

	<main class="site-container">

		<div class="page-heading">
			<h1><?php the_title(); ?></h1>
		</div>

		<article class="tool-content">
			<?php the_content(); ?>
		</article>

	</main>

	<?php
endwhile;

get_footer();
