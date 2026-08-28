import { detectCmsType } from '@/lib/solve/adapters/detect-cms';
import {
	buildGnuboardHeadRenderCallBlock,
	gnuboardAdapter,
	GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH,
} from '@/lib/solve/adapters/gnuboard';
import { rhymixAdapter, RHYMIX_ADDON_RELATIVE_PATH } from '@/lib/solve/adapters/rhymix';
import { saasAdapter } from '@/lib/solve/adapters/saas';
import { standaloneAdapter } from '@/lib/solve/adapters/standalone';
import {
	normalizeRelPath,
	type CmsAdapter,
	type CmsAdapterId,
	type CmsWritePlan,
} from '@/lib/solve/adapters/types';
import { wordpressAdapter, WORDPRESS_MU_PLUGIN_RELATIVE_PATH } from '@/lib/solve/adapters/wordpress';
import { sanitizeGeneratedPhpSnippet } from '@/lib/solve/php-sanitize';

export type { CmsAdapter, CmsAdapterContext, CmsAdapterId, CmsInjectionStrategy, CmsWritePlan } from '@/lib/solve/adapters/types';
export type { DetectCmsTypeInput, DetectCmsTypeResult, DetectedCmsAdapterId } from '@/lib/solve/adapters/detect-cms';
export { detectCmsType } from '@/lib/solve/adapters/detect-cms';
export {
	gnuboardAdapter,
	GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH,
	buildGnuboardExtendEngineFile,
	buildGnuboardHeadRenderCallBlock,
	buildGnuboardLlmsBootHookPhp,
} from '@/lib/solve/adapters/gnuboard';
export { wordpressAdapter, WORDPRESS_MU_PLUGIN_RELATIVE_PATH } from '@/lib/solve/adapters/wordpress';
export {
	buildWordpressSchemaEnginePhp,
	extractWordpressSeedsFromCorePhp,
	extractWpFooterFax,
	extractWpFooterRepName,
	extractWpFooterStreetAddress,
	extractWpFooterTaxId,
	extractWpFooterTelephone,
	REDUE_WP_SCHEMA_ENGINE_VERSION,
} from '@/lib/solve/wp-schema-engine';
export { rhymixAdapter, RHYMIX_ADDON_RELATIVE_PATH } from '@/lib/solve/adapters/rhymix';
export { saasAdapter } from '@/lib/solve/adapters/saas';
export { standaloneAdapter } from '@/lib/solve/adapters/standalone';

const ADAPTERS: Record<CmsAdapterId, CmsAdapter> = {
	gnuboard: gnuboardAdapter,
	wordpress: wordpressAdapter,
	rhymix: rhymixAdapter,
	saas: saasAdapter,
	standalone: standaloneAdapter,
};

export function normalizeCmsAdapterId(cmsType?: string | null): CmsAdapterId {
	const raw = String(cmsType || '').trim();
	const lower = raw.toLowerCase();
	if (/그누보드|gnuboard|youngcart|영카트|\bg5\b/.test(raw) || /gnuboard|youngcart/.test(lower)) {
		return 'gnuboard';
	}
	if (/wordpress|워드프레스|\bwp\b/.test(lower) || raw.includes('워드프레스')) {
		return 'wordpress';
	}
	if (/rhymix|라이믹스|xpressengine|xpress.engine|\bxe\b/.test(lower) || raw.includes('라이믹스')) {
		return 'rhymix';
	}
	if (
		/cafe24|카페24|imweb|아임웹|makeshop|메이크샵|godomall|고도몰|doothost|saas/.test(lower) ||
		raw.includes('카페24') ||
		raw.includes('아임웹')
	) {
		return 'saas';
	}
	if (
		/standalone|스탠드얼론|laravel|custom|커스텀|자체구축/.test(lower) ||
		raw.includes('커스텀')
	) {
		return 'standalone';
	}
	return detectCmsType({ html: raw }).id === 'saas' ? 'saas' : 'standalone';
}

export function isPhpCmsAdapter(cmsType?: string | null): boolean {
	return normalizeCmsAdapterId(cmsType) !== 'saas';
}

export function resolveCmsAdapter(cmsType?: string | null): CmsAdapter {
	return ADAPTERS[normalizeCmsAdapterId(cmsType)];
}

/** Wrap the complete JSON-LD graph controller (Org+Person+WebPage+HowTo+FAQPage) for the target CMS. */
export function applyCmsAdapterWrap(
	corePhp: string,
	cmsType?: string | null,
	targetPath?: string,
	ctx?: { siteName?: string; targetUrl?: string },
): string {
	if (!isPhpCmsAdapter(cmsType)) {
		const adapter = resolveCmsAdapter(cmsType);
		return adapter.wrapCoreSnippet(corePhp, {
			cmsType: cmsType || undefined,
			targetPath,
			siteName: ctx?.siteName,
			targetUrl: ctx?.targetUrl,
		});
	}
	const adapter = resolveCmsAdapter(cmsType);
	const wrapped = adapter.wrapCoreSnippet(corePhp, {
		cmsType: cmsType || undefined,
		targetPath,
		siteName: ctx?.siteName,
		targetUrl: ctx?.targetUrl,
	});
	return sanitizeGeneratedPhpSnippet(wrapped);
}

export function pickCmsInjectTarget(
	relativePaths: string[],
	cmsType?: string | null,
): string | null {
	return resolveCmsAdapter(cmsType).pickTarget(relativePaths.map(normalizeRelPath));
}

export function isWordpressFunctionsTarget(relativePath?: string | null): boolean {
	return /(^|\/)functions\.php$/i.test(normalizeRelPath(relativePath || ''));
}

/**
 * Multi-file injection plan: engine file (create) + header patch (render-only / inject).
 * GnuBoard → `/extend/redue.schema.php` + 5-line `head.sub.php` render call.
 */
export function planCmsInjection(opts: {
	cmsType?: string | null;
	corePhp: string;
	headerPath?: string | null;
	siteName?: string;
	targetUrl?: string;
}): CmsWritePlan[] {
	const adapter = resolveCmsAdapter(opts.cmsType);
	const headerPath = opts.headerPath ? normalizeRelPath(opts.headerPath) : null;
	const ctx = {
		cmsType: opts.cmsType || undefined,
		targetPath: headerPath || adapter.engineFilePath,
		siteName: opts.siteName,
		targetUrl: opts.targetUrl,
	};
	const engine = applyCmsAdapterWrap(opts.corePhp, opts.cmsType, ctx.targetPath, {
		siteName: opts.siteName,
		targetUrl: opts.targetUrl,
	});

	if (adapter.id === 'gnuboard') {
		const head = headerPath || 'head.sub.php';
		return [
			{
				relativePath: GNUBOARD_EXTEND_ENGINE_RELATIVE_PATH,
				mode: 'create',
				content: engine,
				description: '그누보드 /extend/redue.schema.php — 공통 엔진 100% 덮어쓰기',
			},
			{
				relativePath: head,
				mode: 'patch-render-only',
				content: buildGnuboardHeadRenderCallBlock(),
				description: 'head.sub.php — charset 직후 5줄 렌더 호출 (엔진 제거)',
			},
		];
	}

	if (adapter.id === 'wordpress') {
		return [
			{
				relativePath: WORDPRESS_MU_PLUGIN_RELATIVE_PATH,
				mode: 'create',
				content: engine,
				description:
					'WordPress Must-Use 플러그인 — wp_head + redue_wp_dynamic_schema_controller · Footer Scanner · 조건 태그',
			},
		];
	}

	if (adapter.id === 'rhymix') {
		return [
			{
				relativePath: RHYMIX_ADDON_RELATIVE_PATH,
				mode: 'create',
				content: engine,
				description: '라이믹스 애드온 — before_display_content 헤더 등록',
			},
		];
	}

	if (adapter.id === 'saas') {
		return [
			{
				relativePath: headerPath || 'index.html',
				mode: 'patch-inject',
				content: engine,
				description: 'SaaS 클라이언트 스키마 자동주입 엔진 (Header Code / Custom Code)',
			},
		];
	}

	return [
		{
			relativePath: headerPath || adapter.pickTarget([]) || 'header.php',
			mode: 'patch-inject',
			content: engine,
			description: '스탠드얼론 공통 헤더 최상단 인클루드',
		},
	];
}
