<?php
/**
 * The base configuration for WordPress
 *
 * Local development configuration for the "Redue AI Tool Vault" project.
 *
 * @package WordPress
 */

// ** Database settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'redue_tool_vault' );

/** Database username */
define( 'DB_USER', 'root' );

/** Database password */
define( 'DB_PASSWORD', '' );

/** Database hostname */
define( 'DB_HOST', 'localhost' );

/** Database charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The database collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication unique keys and salts.
 *
 * These are local-development placeholder values. Replace with values from
 * https://api.wordpress.org/secret-key/1.1/salt/ before deploying to production.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'r$3vD9!kQzL2mN8pX4wA7bC1eF6gH0jK-redue-local-dev' );
define( 'SECURE_AUTH_KEY',  'tY5uI2oP9aS3dF7gH1jK4lZ8xC6vB0nM-redue-local-dev' );
define( 'LOGGED_IN_KEY',    'qW1eR4tY7uI0oP3aS6dF9gH2jK5lZ8xC-redue-local-dev' );
define( 'NONCE_KEY',        'vB3nM6xC9zL2kJ5hG8fD1sA4pO7iU0yT-redue-local-dev' );
define( 'AUTH_SALT',        'mN8bV5cX2zL9kJ6hG3fD0sA7pO4iU1yT-redue-local-dev' );
define( 'SECURE_AUTH_SALT', 'wE2rT5yU8iO1pA4sD7fG0hJ3kL6zX9cV-redue-local-dev' );
define( 'LOGGED_IN_SALT',   'jH4gF7dS0aP3oI6uY9tR2eW5qZ8xC1vB-redue-local-dev' );
define( 'NONCE_SALT',       'kL7jH0gF3dS6aP9oI2uY5tR8eW1qZ4xC-redue-local-dev' );

/**#@-*/

/**
 * WordPress database table prefix.
 */
$table_prefix = 'wp_';

/**
 * For developers: WordPress debugging mode.
 */
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );

/** WordPress locale (Korean). */
define( 'WPLANG', 'ko_KR' );

/* Add any custom values between this line and the "stop editing" line. */



/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';
