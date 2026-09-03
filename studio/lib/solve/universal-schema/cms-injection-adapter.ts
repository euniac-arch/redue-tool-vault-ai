/**
 * CmsInjectionAdapter — non-destructive, CMS-specific injection plans.
 * GnuBoard: extend/redue.schema.php + head.sub render hook.
 * WordPress: mu-plugins/redue-schema.php + wp_head.
 * PHP: header.php / head.php / layout.php require_once (or auto_prepend).
 * Static HTML: </head> marker wrap, replace-on-repatch.
 */

import { planCmsInjection, type CmsWritePlan } from '@/lib/solve/adapters';
import {
	REDUE_SCHEMA_MARKER_END,
	REDUE_SCHEMA_MARKER_START,
	generateSchemaInjector,
} from '@/lib/solve/dynamic-php-schema';
import { injectBeforeClosingHead } from '@/lib/solve/source-mapping';
import type { BuiltSchemaTemplate, DetectedSiteCms, ExtractedSiteFacts } from '@/lib/solve/universal-schema/types';

export const STATIC_HTML_MARKER_START = `/* ${REDUE_SCHEMA_MARKER_START} */`;
export const STATIC_HTML_MARKER_END = `/* ${REDUE_SCHEMA_MARKER_END} */`;

export type UniversalInjectionPlan = CmsWritePlan & {
	cms: DetectedSiteCms;
	tryCatchWrapped: boolean;
};

function cmsToAdapterId(cms: DetectedSiteCms): string {
	if (cms === 'gnuboard') return 'gnuboard';
	if (cms === 'wordpress') return 'wordpress';
	if (cms === 'static-html') return 'saas';
	return 'standalone';
}

function wrapStaticHtmlSnippet(inner: string): string {
	return `${STATIC_HTML_MARKER_START}\n${inner.trim()}\n${STATIC_HTML_MARKER_END}\n`;
}

function wrapPhpTryCatch(php: string): string {
	const body = php.replace(/^<\?php\s*/i, '').replace(/\?>\s*$/i, '').trim();
	if (body.includes('try {') && /catch\s*\(/i.test(body)) return php;
	return `<?php
try {
${body
	.split('\n')
	.map((line) => (line ? `\t${line}` : line))
	.join('\n')}
} catch (Throwable $_redue_schema_e) {
	/* Universal Schema Injection Engine — fail closed, never break the host page */
}
?>`;
}

export function buildStaticHtmlHeadBlock(template: BuiltSchemaTemplate): string {
	return wrapStaticHtmlSnippet(template.htmlHeadSnippet);
}

export function injectStaticHtmlHead(source: string, template: BuiltSchemaTemplate): string {
	const snippet = buildStaticHtmlHeadBlock(template);
	const injected = injectBeforeClosingHead(source, snippet, { targetPath: 'index.html' });
	if (injected.ok) return injected.result;
	if (/<\/head>/i.test(source)) {
		return source.replace(/<\/head>/i, `${snippet}</head>`);
	}
	return `${source.trimEnd()}\n${snippet}`;
}

/**
 * Build CMS write plans. Engine PHP is generated from live facts only
 * (empty NAP fields stay unset in the controller globals).
 */
export function planUniversalCmsInjection(opts: {
	facts: ExtractedSiteFacts;
	corePhp?: string;
	headerPath?: string | null;
	templates?: BuiltSchemaTemplate[];
	htmlTargets?: string[];
}): UniversalInjectionPlan[] {
	const cms = opts.facts.cms;
	const siteName = opts.facts.nap.siteName;
	const targetUrl = opts.facts.origin;

	if (cms === 'static-html') {
		const template = opts.templates?.[0];
		const snippet = template ? buildStaticHtmlHeadBlock(template) : wrapStaticHtmlSnippet('<!-- redue schema: no verified facts -->');
		const targets = opts.htmlTargets?.length
			? opts.htmlTargets
			: opts.facts.pages.map((page) => page.filePath).filter((path): path is string => Boolean(path));
		const files = targets.length ? targets : ['index.html'];
		return files.map((relativePath) => ({
			relativePath,
			mode: 'patch-inject' as const,
			content: snippet,
			description: '정적 HTML — </head> 직전 REDUE_AI_STUDIO 마커 주입 (중복 시 교체)',
			cms,
			tryCatchWrapped: true,
		}));
	}

	const corePhp =
		opts.corePhp ||
		generateSchemaInjector(
			{
				siteName: siteName || opts.facts.origin.replace(/^https?:\/\//, ''),
				targetUrl,
				pages: (opts.facts.pages.length
					? opts.facts.pages
					: [{ path: '/', title: undefined, description: undefined, h1: undefined, faq: [], videos: [], medicalAbout: [] }]
				).map((page) => ({
					urlPath: page.path,
					title: page.title,
					description: page.description,
					h1: page.h1,
				})),
			},
			{
				siteName,
				targetUrl,
				cmsType: cmsToAdapterId(cms),
				representativeName: opts.facts.nap.repName,
				representativeTitle: opts.facts.nap.repTitle,
				telephone: opts.facts.nap.telephone,
				fax: opts.facts.nap.faxNumber,
				taxId: opts.facts.nap.taxId,
				streetAddress: opts.facts.nap.streetAddress,
				addressLocality: opts.facts.nap.addressLocality,
				addressRegion: opts.facts.nap.addressRegion,
				postalCode: opts.facts.nap.postalCode,
				latitude: opts.facts.nap.latitude,
				longitude: opts.facts.nap.longitude,
				sameAs: opts.facts.nap.sameAs,
			},
		);

	const plans = planCmsInjection({
		cmsType: cmsToAdapterId(cms),
		corePhp: wrapPhpTryCatch(corePhp),
		headerPath: opts.headerPath,
		siteName,
		targetUrl,
	});

	return plans.map((plan) => ({
		...plan,
		cms,
		tryCatchWrapped: true,
	}));
}

export function describeCmsInjection(cms: DetectedSiteCms): string {
	if (cms === 'gnuboard') {
		return '그누보드/영카트 — extend/redue.schema.php 단독 생성 + add_event(head_sub) / add_replace(head_title) 훅. 코어 파일 수정 없음.';
	}
	if (cms === 'wordpress') {
		return '워드프레스 — wp-content/mu-plugins/redue-schema.php (Must-Use) + wp_head. 테마 업데이트와 무관.';
	}
	if (cms === 'static-html') {
		return '정적 HTML — 각 파일 </head> 직전 REDUE_AI_STUDIO 마커 블록 삽입/교체.';
	}
	return '순수 PHP — header.php / head.php / layout.php 최상단 require_once 또는 auto_prepend_file 대응.';
}
