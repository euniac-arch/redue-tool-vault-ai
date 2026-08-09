import path from 'node:path';

/**
 * `studio/` is a subfolder of the WordPress root in this repo (the same
 * directory that already contains `wp-config.php`), so the sensible
 * default scan target is simply "one level up" from where the Next.js
 * app's process is running.
 */
export function defaultRootPath(): string {
	return path.resolve(process.cwd(), '..');
}
