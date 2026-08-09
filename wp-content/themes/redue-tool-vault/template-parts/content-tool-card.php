<?php
/**
 * Template part for displaying an ai_tool card inside grid listings.
 *
 * Stripe / Raycast inspired card: logo + pricing badge on top, title +
 * tagline in the middle, rating / category tag / CTA link at the bottom.
 *
 * @package Redue_Tool_Vault
 */

$tagline      = get_post_meta( get_the_ID(), 'tool_tagline', true );
$pricing_type = get_post_meta( get_the_ID(), 'tool_pricing_type', true );
$rating       = get_post_meta( get_the_ID(), 'tool_rating_score', true );
$badge_class  = $pricing_type ? redue_tv_get_pricing_badge_class( $pricing_type ) : '';
$logo_color   = redue_tv_get_tool_logo_color( get_the_ID() );
$initial      = function_exists( 'mb_substr' )
	? mb_strtoupper( mb_substr( get_the_title(), 0, 1 ), 'UTF-8' )
	: strtoupper( substr( get_the_title(), 0, 1 ) );

$terms        = get_the_terms( get_the_ID(), 'tool_category' );
$primary_term = ( $terms && ! is_wp_error( $terms ) ) ? $terms[0] : null;
?>

<article <?php post_class( 'tool-card' ); ?>>
	<a class="tool-card__link" href="<?php the_permalink(); ?>">

		<div class="tool-card__top">
			<div class="tool-card__logo" <?php echo has_post_thumbnail() ? '' : 'style="background:' . esc_attr( $logo_color ) . ';"'; ?>>
				<?php if ( has_post_thumbnail() ) : ?>
					<?php the_post_thumbnail( 'thumbnail' ); ?>
				<?php else : ?>
					<span><?php echo esc_html( $initial ); ?></span>
				<?php endif; ?>
			</div>

			<?php if ( $pricing_type ) : ?>
				<span class="badge <?php echo esc_attr( $badge_class ); ?>"><?php echo esc_html( $pricing_type ); ?></span>
			<?php endif; ?>
		</div>

		<h3 class="tool-card__title"><?php the_title(); ?></h3>

		<?php if ( $tagline ) : ?>
			<p class="tool-card__tagline"><?php echo esc_html( $tagline ); ?></p>
		<?php endif; ?>

		<div class="tool-card__footer">
			<div class="tool-card__footer-meta">
				<?php if ( '' !== $rating ) : ?>
					<span class="tool-card__rating">&#9733; <?php echo esc_html( $rating ); ?></span>
				<?php endif; ?>
				<?php if ( $primary_term ) : ?>
					<span class="badge badge--category"><?php echo esc_html( $primary_term->name ); ?></span>
				<?php endif; ?>
			</div>
			<span class="tool-card__cta"><?php esc_html_e( '상세보기', 'redue-tool-vault' ); ?> &#10230;</span>
		</div>

	</a>
</article>
