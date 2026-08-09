<?php
/**
 * The front page template.
 *
 * Step 2: Stripe / Raycast 감성의 4열 카드 그리드로 ai_tool 목록을 노출하는
 * 메인 랜딩 페이지. front-page.php는 워드프레스 템플릿 계층에서 홈페이지
 * 설정(정적 페이지 / 최신글 모두)에 우선하여 사용됩니다.
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

	<section class="hero">
		<span class="hero__eyebrow"><?php esc_html_e( 'Redue Curation', 'redue-tool-vault' ); ?></span>
		<h1 class="hero__title"><?php esc_html_e( '전 세계 숨은 AI & 파워 유저 라이프 툴', 'redue-tool-vault' ); ?></h1>
		<p class="hero__subtitle">
			<?php esc_html_e( '매주 검증된 AI 툴만 엄선해서 소개합니다. SEO, 개발, 생산성 — 카테고리별 베스트 툴을 한눈에 확인해 보세요.', 'redue-tool-vault' ); ?>
		</p>
	</section>

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

	<?php
	$featured_query = new WP_Query(
		array(
			'post_type'      => 'ai_tool',
			'posts_per_page' => 8,
			'meta_key'       => 'tool_rating_score',
			'orderby'        => 'meta_value_num',
			'order'          => 'DESC',
		)
	);
	?>

	<?php if ( $featured_query->have_posts() ) : ?>
		<section class="tool-section">
			<div class="tool-section__head">
				<h2><?php esc_html_e( '이번 주 추천 AI 툴', 'redue-tool-vault' ); ?></h2>
				<a class="tool-section__more" href="<?php echo esc_url( get_post_type_archive_link( 'ai_tool' ) ); ?>">
					<?php esc_html_e( '전체 보기', 'redue-tool-vault' ); ?> &#10230;
				</a>
			</div>
			<div class="tool-grid tool-grid--4col">
				<?php
				while ( $featured_query->have_posts() ) :
					$featured_query->the_post();
					get_template_part( 'template-parts/content', 'tool-card' );
				endwhile;
				?>
			</div>
		</section>
		<?php wp_reset_postdata(); ?>
	<?php else : ?>
		<p class="empty-state">
			<?php esc_html_e( '아직 등록된 AI 툴이 없습니다. 관리자 화면에 접속하면 샘플 데이터가 자동으로 채워집니다.', 'redue-tool-vault' ); ?>
		</p>
	<?php endif; ?>

	<?php if ( ! empty( $categories ) && ! is_wp_error( $categories ) ) : ?>
		<?php foreach ( $categories as $category ) : ?>
			<?php
			$category_query = new WP_Query(
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
			<?php if ( $category_query->have_posts() ) : ?>
				<section class="tool-section">
					<div class="tool-section__head">
						<h2><a href="<?php echo esc_url( get_term_link( $category ) ); ?>"><?php echo esc_html( $category->name ); ?></a></h2>
						<a class="tool-section__more" href="<?php echo esc_url( get_term_link( $category ) ); ?>">
							<?php esc_html_e( '전체 보기', 'redue-tool-vault' ); ?> &#10230;
						</a>
					</div>
					<div class="tool-grid tool-grid--4col">
						<?php
						while ( $category_query->have_posts() ) :
							$category_query->the_post();
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
