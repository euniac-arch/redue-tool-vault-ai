import fs from 'node:fs';
import path from 'node:path';
import type { CmsDetectionResult, TargetSelectionResult } from './types';

/**
 * Pick the injection target for a detected WordPress install.
 *
 * Priority 1: `{activeTheme}/header.php` — the master schema block is
 * inlined directly inside `<head>`, before the `wp_head()` call, so the
 * `add_action('wp_head', ...)` registration always happens in time for
 * that same request's `wp_head` firing.
 *
 * Priority 2 (fallback): `{activeTheme}/functions.php` — appended at the
 * end of the file as a normal `wp_head` hook, used only when the theme has
 * no `header.php` to anchor into.
 */
export function selectTarget(cms: CmsDetectionResult): TargetSelectionResult {
	if (cms.cmsType !== 'WORDPRESS' || !cms.activeThemePath) {
		return {
			found: false,
			filePath: null,
			priority: null,
			anchor: null,
			reason: 'WordPress 활성 테마를 확인할 수 없어 주입 대상을 선택할 수 없습니다.',
		};
	}

	const headerPath = path.join(cms.activeThemePath, 'header.php');
	if (fs.existsSync(headerPath)) {
		return {
			found: true,
			filePath: headerPath,
			priority: 1,
			anchor: 'header-head-open',
			reason: `1순위 타겟(header.php)을 사용합니다: ${headerPath}`,
		};
	}

	const functionsPath = path.join(cms.activeThemePath, 'functions.php');
	if (fs.existsSync(functionsPath)) {
		return {
			found: true,
			filePath: functionsPath,
			priority: 2,
			anchor: 'functions-eof',
			reason: `header.php가 없어 2순위 타겟(functions.php 하단)으로 대체합니다: ${functionsPath}`,
		};
	}

	return {
		found: false,
		filePath: null,
		priority: null,
		anchor: null,
		reason: '활성 테마 폴더에서 header.php와 functions.php를 모두 찾을 수 없습니다.',
	};
}
