<?php
/**
 * The footer for our theme
 *
 * @package Redue_Tool_Vault
 */
?>

	<footer class="site-footer">
		<div class="site-container">
			<p>
				&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?> &mdash;
				<?php esc_html_e( '전 세계 숨은 AI & 파워 유저 라이프 툴 큐레이션', 'redue-tool-vault' ); ?>
			</p>
		</div>
	</footer>

<?php wp_footer(); ?>
</body>
</html>
