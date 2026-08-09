import type { PortfolioItem } from './portfolio-types';

/**
 * These samples mirror the exact JSON output produced at runtime by the
 * `redue_ai_studio_master_schema()` block injected into `header.php` in
 * Step 3 ([studio/lib/code-generator.ts](./code-generator.ts)) — same
 * `@context`/`@type` shape, populated with the real Step 2 dummy-tool data
 * ([wp-content/themes/redue-tool-vault/inc/dummy-data.php](../../wp-content/themes/redue-tool-vault/inc/dummy-data.php))
 * and the portfolio's own site info, so the verification modal shows what
 * a crawler actually sees on the live pages.
 */

export interface SchemaSample {
	label: string;
	appliesWhen: string;
	json: Record<string, unknown>;
}

export function buildWebsiteSchemaSample(item: PortfolioItem): SchemaSample {
	return {
		label: 'WebSite 스키마',
		appliesWhen: 'is_front_page() — 메인 화면',
		json: {
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'Redue AI Tool Vault',
			url: item.domainUrl,
		},
	};
}

export function buildSoftwareApplicationSchemaSample(item: PortfolioItem): SchemaSample {
	// Same tool used to seed the theme in Step 2's inc/dummy-data.php.
	const sampleTool = {
		title: 'Redue SEO Studio',
		tagline: 'AI 기반 SEO & GEO 자동 스키마 주입 솔루션',
		officialUrl: 'https://redue.ai',
	};

	return {
		label: 'SoftwareApplication 스키마',
		appliesWhen: `is_singular('ai_tool') — 예시: ${item.domainUrl}/tool/${item.sampleToolSlug}`,
		json: {
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: sampleTool.title,
			description: sampleTool.tagline,
			url: sampleTool.officialUrl,
		},
	};
}
