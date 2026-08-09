<?php
/**
 * Template for displaying a single "ai_tool" post.
 *
 * Subpage 1/5: 툴 상세 페이지 (Tool Detail Page)
 * Reads the custom meta fields registered in inc/meta-boxes.php and renders
 * the tool hero section, followed by a 2-column layout: left spec sidebar
 * (가격 / 지원 OS / 공식 URL 버튼) and right review content area.
 * The SoftwareApplication JSON-LD schema is injected separately into
 * <head> via inc/schema-jsonld.php (wp_head hook).
 *
 * @package Redue_Tool_Vault
 */

get_header();

while ( have_posts() ) :
	the_post();

	$tagline      = get_post_meta( get_the_ID(), 'tool_tagline', true );
	$official_url = get_post_meta( get_the_ID(), 'tool_official_url', true );
	$pricing_type = get_post_meta( get_the_ID(), 'tool_pricing_type', true );
	$price_amount = get_post_meta( get_the_ID(), 'tool_price_amount', true );
	$currency     = get_post_meta( get_the_ID(), 'tool_price_currency', true );
	$os           = get_post_meta( get_the_ID(), 'tool_operating_system', true );
	$rating       = get_post_meta( get_the_ID(), 'tool_rating_score', true );
	$categories   = get_the_terms( get_the_ID(), 'tool_category' );
	$badge_class  = $pricing_type ? redue_tv_get_pricing_badge_class( $pricing_type ) : '';
	$price_label  = redue_tv_format_tool_price( $pricing_type, $price_amount, $currency );
	?>

	<main class="site-container">

		<section class="tool-hero">
			<?php if ( has_post_thumbnail() ) : ?>
				<?php the_post_thumbnail( 'medium', array( 'class' => 'tool-hero__thumb' ) ); ?>
			<?php endif; ?>

			<div class="tool-hero__info">
				<?php if ( $categories && ! is_wp_error( $categories ) ) : ?>
					<div class="tool-card__meta">
						<?php foreach ( $categories as $cat ) : ?>
							<span class="badge badge--category"><?php echo esc_html( $cat->name ); ?></span>
						<?php endforeach; ?>
						<?php if ( $pricing_type ) : ?>
							<span class="badge <?php echo esc_attr( $badge_class ); ?>"><?php echo esc_html( $pricing_type ); ?></span>
						<?php endif; ?>
					</div>
				<?php endif; ?>

				<h1 class="tool-hero__title"><?php the_title(); ?></h1>

				<?php if ( $tagline ) : ?>
					<p class="tool-hero__tagline"><?php echo esc_html( $tagline ); ?></p>
				<?php endif; ?>

				<?php if ( '' !== $rating ) : ?>
					<p class="tool-hero__rating">&#9733; <strong><?php echo esc_html( $rating ); ?></strong> / 5</p>
				<?php endif; ?>
			</div>
		</section>

		<div class="tool-detail-grid">

			<aside class="tool-detail-sidebar">
				<dl class="tool-spec-list">
					<?php if ( $pricing_type ) : ?>
						<div class="tool-spec">
							<dt><?php esc_html_e( '가격', 'redue-tool-vault' ); ?></dt>
							<dd><?php echo esc_html( $price_label ); ?></dd>
						</div>
					<?php endif; ?>

					<?php if ( $os ) : ?>
						<div class="tool-spec">
							<dt><?php esc_html_e( '지원 OS', 'redue-tool-vault' ); ?></dt>
							<dd><?php echo esc_html( $os ); ?></dd>
						</div>
					<?php endif; ?>

					<?php if ( '' !== $rating ) : ?>
						<div class="tool-spec">
							<dt><?php esc_html_e( '추천 점수', 'redue-tool-vault' ); ?></dt>
							<dd>&#9733; <?php echo esc_html( $rating ); ?> / 5</dd>
						</div>
					<?php endif; ?>
				</dl>

				<?php if ( $official_url ) : ?>
					<a class="btn-cta btn-cta--block" href="<?php echo esc_url( $official_url ); ?>" target="_blank" rel="noopener noreferrer nofollow">
						<?php esc_html_e( '공식 사이트 방문하기', 'redue-tool-vault' ); ?> &rarr;
					</a>
				<?php endif; ?>
			</aside>

			<article class="tool-detail-content tool-content">
				<?php the_content(); ?>
			</article>

		</div>

	</main>

	<?php
endwhile;

get_footer();
