/**
 * CMS별 교정 코드 스니펫 — 진단 이슈 코드 → Cafe24/Gnuboard/Next.js/WordPress/React/Laravel
 *
 * Cancer-type leaves (601.php–613.php) are registered in $page_meta / $page_schema and the
 * JSON-LD #cancer-types ItemList by the hybrid engine in `dynamic-php-schema.ts`
 * (`DEFAULT_CANCER_TYPE_PAGES` · `ensureCancerTypeSubpages`). Universal Master Engine snippets
 * below defer to that controller when File Patch / remote patch injects the full hybrid block.
 */

import {
	buildAltAutoFixerScriptTag,
	buildCrawlerOptimizedCanonicalHeadFragment,
	buildJsDeferAutoFixerScriptTag,
	buildUniversalObSeoEnginePhp,
} from '@/lib/solve/dynamic-php-schema';

/** Re-export cancer-type seed map (601–613) for Solve / CMS consumers. */
export {
	DEFAULT_CANCER_TYPE_NAMES,
	DEFAULT_CANCER_TYPE_PAGES,
} from '@/lib/solve/dynamic-php-schema';

export type CmsSnippetPayload = {
	targetUrl?: string;
	title?: string;
	description?: string;
	siteName?: string;
};

/**
 * v30 Universal fallback FAQ Q&A (2 items) — used whenever no page-specific FAQ data is
 * supplied, so every CMS snippet that emits schema also guarantees a parsable FAQPage
 * signal for AI engines (Perplexity/ChatGPT) even on a bare install.
 */
function defaultFaqEntities(siteName: string, origin: string, title?: string) {
	const pageTitle = (title || siteName).trim() || siteName;
	return [
		{
			'@type': 'Question',
			name: `${pageTitle} 관련 안내 및 상담은 어떻게 신청하나요?`,
			acceptedAnswer: {
				'@type': 'Answer',
				text: `${siteName} 공식 웹사이트(${origin})의 안내 메뉴와 문의 창구를 통해 상세한 전문 안내를 받으실 수 있습니다.`,
			},
		},
		{
			'@type': 'Question',
			name: `${siteName} 서비스 이용 문의처는 어디인가요?`,
			acceptedAnswer: {
				'@type': 'Answer',
				text: `웹사이트 상단 고객센터 및 온라인 게시판을 통해 언제든지 문의 남겨주시면 빠르게 답변해 드립니다.`,
			},
		},
	];
}

function hostname(url?: string): string {
	try {
		return url ? new URL(url).hostname.replace(/^www\./, '') : 'example.com';
	} catch {
		return 'example.com';
	}
}

function origin(url?: string): string {
	try {
		return url ? new URL(url).origin : 'https://example.com';
	} catch {
		return 'https://example.com';
	}
}

function enrich(data: CmsSnippetPayload = {}) {
	const targetUrl = data.targetUrl || 'https://example.com';
	const site = data.siteName || hostname(targetUrl);
	const title = (data.title || site).trim() || site;
	const description =
		(data.description || '').trim() ||
		`${title} — ${site} 공식 웹사이트입니다. 핵심 서비스와 최신 정보를 확인하세요.`;
	return { targetUrl, siteName: site, title, description, origin: origin(targetUrl) };
}

/** Shared JSON-LD graph for static HTML / JS CMS targets (Article + FAQ + Person + Org). */
function staticSchemaGraph(d: ReturnType<typeof enrich>, isoPublished: string, isoNow: string) {
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': ['Organization', 'ProfessionalService'],
				'@id': `${d.origin}/#organization`,
				name: d.siteName,
				url: d.origin,
			},
			{
				'@type': 'Article',
				'@id': `${d.targetUrl}#article`,
				headline: d.title,
				description: d.description,
				url: d.targetUrl,
				datePublished: isoPublished,
				dateModified: isoNow,
				publisher: { '@id': `${d.origin}/#organization` },
				author: { '@type': 'Organization', name: d.siteName },
			},
			{
				'@type': 'FAQPage',
				'@id': `${d.targetUrl}#faq`,
				url: d.targetUrl,
				mainEntity: defaultFaqEntities(d.siteName, d.origin, d.title),
			},
			{
				'@type': 'Person',
				'@id': `${d.origin}/#person`,
				name: `${d.siteName} 연구팀/담당자`,
				worksFor: { '@id': `${d.origin}/#organization` },
			},
		],
	};
}

/** Returns snippets keyed by cms key (cafe24, gnuboard, …). Empty string = no injectable code. */
export function generateAllCmsSnippets(
	issueCode: string,
	payload: CmsSnippetPayload = {},
): Record<string, string> {
	const d = enrich(payload);
	const code = issueCode.toUpperCase();

	const cafe24 = cafe24Snippet(code, d);
	const gnuboard = gnuboardSnippet(code, d);
	const nextjs = nextjsSnippet(code, d);
	const wordpress = wordpressSnippet(code, d);
	const react = reactSnippet(code, d);
	const laravel = laravelSnippet(code, d);
	const custom = customHtmlPhpSnippet(code, d);
	const universal = universalSnippet(code);

	return { cafe24, gnuboard, nextjs, wordpress, react, laravel, custom, universal };
}

/**
 * v30 Universal Master Engine — CMS-agnostic OB + Article/FAQ/Person schema block for any
 * common header file (head.sub.php / header.php / inc_head.php). Zero CMS-specific wiring.
 */
function universalSnippet(code: string): string {
	switch (code) {
		case 'CANONICAL_MISSING':
		case 'CANONICAL_RELATIVE_PATH':
		case 'RENDER_BLOCKING':
		case 'LCP_POOR':
		case 'SCHEMA_MISSING':
		case 'ORGANIZATION_MISSING':
		case 'WEBSITE_SCHEMA_MISSING':
		case 'ARTICLE_DATE_MISSING':
		case 'META_DESC_MISSING':
		case 'META_DESC_LENGTH_SUBOPTIMAL':
		case 'OG_INCOMPLETE':
		case 'IMAGE_ALT':
			return `<!-- v32 Crawler-Optimized Canonical & Schema Engine — 어떤 PHP 사이트든 공통 헤더 파일( head.sub.php / header.php / inc_head.php ) 맨 위에 그대로 붙여넣으세요.
     Charset-After First-Chunk · REQUEST_URI+SCRIPT_NAME 이중 감지 · HTTPS 강제 · exact 서브페이지 canonical · head+body sync script defer · Article/FAQ/Person schema 단일 블록.
     동일 파일에 이미 redue_dynamic_schema_controller()(하이브리드 풀엔진)가 있다면 중복 주입하지 마세요. -->
${buildUniversalObSeoEnginePhp()}`;
		default:
			return '<!-- v30 Universal Master Engine: 이 이슈는 Universal 탭의 공통 엔진으로 처리합니다. 다른 CMS 탭의 코드를 사용하세요. -->';
	}
}

function cafe24Snippet(code: string, d: ReturnType<typeof enrich>): string {
	const isoNow = new Date().toISOString();
	const isoPublished = `${new Date().getUTCFullYear()}-01-01T00:00:00+09:00`;
	switch (code) {
		case 'CANONICAL_MISSING':
		case 'CANONICAL_RELATIVE_PATH':
			return `<!-- REDUE v30: Cafe24 Canonical + og:url (PHP 헤더가 있으면 Universal Master Engine 권장 — exact 현재 페이지 URL) -->
<link rel="canonical" href="${d.targetUrl}" />
<meta property="og:url" content="${d.targetUrl}" />`;
		case 'META_DESC_MISSING':
		case 'META_DESC_LENGTH_SUBOPTIMAL':
			return `<!-- REDUE v30: Cafe24 Meta Description -->
<meta name="description" content="${escapeAttr(d.description)}" />`;
		case 'TITLE_MISSING':
		case 'TITLE_LENGTH_SUBOPTIMAL':
			return `<!-- REDUE: Cafe24 Title -->
<title>${escapeAttr(d.title)} | ${escapeAttr(d.siteName)}</title>`;
		case 'OG_INCOMPLETE':
			return `<!-- REDUE v30: Cafe24 Open Graph -->
<meta property="og:title" content="${escapeAttr(d.title)}" />
<meta property="og:description" content="${escapeAttr(d.description)}" />
<meta property="og:url" content="${d.targetUrl}" />
<meta property="og:type" content="website" />
<meta property="og:image" content="${d.origin}/og-image.png" />`;
		case 'SCHEMA_MISSING':
		case 'ORGANIZATION_MISSING':
		case 'WEBSITE_SCHEMA_MISSING':
		case 'ARTICLE_DATE_MISSING': {
			const graph = staticSchemaGraph(d, isoPublished, isoNow);
			return `<!-- REDUE v30: Cafe24 Article + FAQPage + Person (전 페이지 보장) — layout/basic/layout.html </head> -->
<script type="application/ld+json">
${JSON.stringify(graph)}
</script>`;
		}
		case 'RENDER_BLOCKING':
		case 'LCP_POOR':
			return `<!-- REDUE v30 JS Defer Auto-Fixer — layout/basic/layout.html </head> 직전 (PHP면 Universal Master Engine 권장: 전문서 defer) -->
${buildJsDeferAutoFixerScriptTag()}`;
		case 'H1_MISSING':
			return `<!-- REDUE: Cafe24 H1 — 본문 상단에 페이지당 1개 -->
<h1 class="redue-page-title">${escapeAttr(d.title)}</h1>`;
		case 'H1_MULTIPLE':
			return `<!-- REDUE: Cafe24 — 로고/배너 H1을 div로 변경하고 본문 제목만 H1 유지 -->
<!-- <h1> → <div class="logo"> -->`;
		case 'IMAGE_ALT':
			return `<!-- REDUE v30 Alt Auto-Fixer — layout/basic/layout.html </head> 직전 -->
${buildAltAutoFixerScriptTag(d.siteName)}`;
		case 'SITEMAP_NOT_FOUND':
		case 'ROBOTS_SITEMAP_MISSING':
		case 'GPTBOT_BLOCKED':
			return `# robots.txt (FTP 루트)
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: ${d.origin}/sitemap.xml`;
		default:
			return `<!-- REDUE Cafe24: ${code} — layout/basic/layout.html <head>에 메타·스키마를 보강하세요 -->`;
	}
}

function gnuboardSnippet(code: string, d: ReturnType<typeof enrich>): string {
	const originHost = (() => {
		try {
			return new URL(d.targetUrl || d.origin || 'https://koreaionlab.co.kr').hostname;
		} catch {
			return 'koreaionlab.co.kr';
		}
	})();
	switch (code) {
		case 'CANONICAL_MISSING':
		case 'CANONICAL_RELATIVE_PATH':
			return `<!-- head.sub.php: <meta charset="utf-8"> 바로 직후에 붙여넣기 — Crawler-Optimized Hardcoded Canonical
     First-Chunk 진단봇 대응 · HTTPS 대표 도메인 고정 · REQUEST_URI+SCRIPT_NAME 이중 감지 · 서브페이지/게시판 고유 URL -->
${buildCrawlerOptimizedCanonicalHeadFragment(originHost)}

<!-- (권장) 스키마·defer·중복 청소까지 필요하면 아래 Universal 엔진을 파일 최상단 <?php 직후에 추가 — Canonical 태그는 OB가 charset 직후로 재배치 -->
${buildUniversalObSeoEnginePhp()}`;
		case 'SCHEMA_MISSING':
		case 'ORGANIZATION_MISSING':
		case 'WEBSITE_SCHEMA_MISSING':
		case 'ARTICLE_DATE_MISSING':
		case 'RENDER_BLOCKING':
		case 'LCP_POOR':
		case 'META_DESC_MISSING':
		case 'META_DESC_LENGTH_SUBOPTIMAL':
		case 'OG_INCOMPLETE':
		case 'IMAGE_ALT':
			return `<!-- head.sub.php 첫 <?php 직후(또는 파일 최상단)에 삽입 — Crawler-Optimized Canonical & Schema Engine
     Charset-After First-Chunk · REQUEST_URI+SCRIPT_NAME 이중 감지 · HTTPS 강제 · G5_URL/cf_title 자동 감지 · 중복 canonical/og:url 청소 · static $executed 1회 가드
     exact 서브페이지 canonical + head+body script defer + Article/FAQ/Person · 풀 하이브리드와 동시 사용 금지 -->
${buildUniversalObSeoEnginePhp()}`;
		case 'TITLE_MISSING':
		case 'TITLE_LENGTH_SUBOPTIMAL':
			return `<?php echo '<title>' . htmlspecialchars('${escapePhp(d.title)}') . '</title>'; ?>`;
		case 'H1_MISSING':
			return `<!-- REDUE: Gnuboard H1 -->
<h1 class="redue-page-title"><?php echo get_text($g5['title']); ?></h1>`;
		case 'GPTBOT_BLOCKED':
		case 'SITEMAP_NOT_FOUND':
		case 'ROBOTS_SITEMAP_MISSING':
			return `# robots.txt
User-agent: *
Allow: /
User-agent: GPTBot
Allow: /
Sitemap: ${d.origin}/sitemap.xml`;
		default:
			return `<?php /* REDUE Gnuboard v30: ${code} — theme/*/head.sub.php 최상단에 Universal Master Engine 삽입 */ ?>
${buildUniversalObSeoEnginePhp()}`;
	}
}

function nextjsSnippet(code: string, d: ReturnType<typeof enrich>): string {
	const isoNow = new Date().toISOString();
	const isoPublished = `${new Date().getUTCFullYear()}-01-01T00:00:00+09:00`;
	switch (code) {
		case 'CANONICAL_MISSING':
		case 'CANONICAL_RELATIVE_PATH':
			return `// app/layout.tsx or page metadata — REDUE v30 Canonical (exact current page URL)
export const metadata = {
  alternates: { canonical: '${d.targetUrl}' },
  openGraph: { url: '${d.targetUrl}' },
};`;
		case 'META_DESC_MISSING':
		case 'META_DESC_LENGTH_SUBOPTIMAL':
		case 'TITLE_MISSING':
		case 'TITLE_LENGTH_SUBOPTIMAL':
		case 'OG_INCOMPLETE':
			return `// app/layout.tsx — merge into existing metadata (do not replace file)
export const metadata = {
  title: '${escapeJs(d.title)}',
  description: '${escapeJs(d.description)}',
  alternates: { canonical: '${d.targetUrl}' },
  openGraph: {
    title: '${escapeJs(d.title)}',
    description: '${escapeJs(d.description)}',
    url: '${d.targetUrl}',
    type: 'website',
  },
};`;
		case 'SCHEMA_MISSING':
		case 'ORGANIZATION_MISSING':
		case 'WEBSITE_SCHEMA_MISSING':
		case 'ARTICLE_DATE_MISSING':
			return `// JSON-LD in layout — REDUE v30 Article + FAQPage + Person (전 페이지 보장)
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': ['Organization', 'ProfessionalService'], '@id': '${d.origin}/#organization', name: '${escapeJs(d.siteName)}', url: '${d.origin}' },
      {
        '@type': 'Article',
        '@id': '${d.targetUrl}#article',
        headline: '${escapeJs(d.title)}',
        description: '${escapeJs(d.description)}',
        url: '${d.targetUrl}',
        datePublished: '${isoPublished}',
        dateModified: '${isoNow}',
        publisher: { '@id': '${d.origin}/#organization' },
        author: { '@type': 'Organization', name: '${escapeJs(d.siteName)}' },
      },
      {
        '@type': 'FAQPage',
        '@id': '${d.targetUrl}#faq',
        url: '${d.targetUrl}',
        mainEntity: [
          {
            '@type': 'Question',
            name: '${escapeJs(d.title)} 관련 안내 및 상담은 어떻게 신청하나요?',
            acceptedAnswer: { '@type': 'Answer', text: '${escapeJs(d.siteName)} 공식 웹사이트(${d.origin})의 안내 메뉴와 문의 창구를 통해 상세한 전문 안내를 받으실 수 있습니다.' },
          },
          {
            '@type': 'Question',
            name: '${escapeJs(d.siteName)} 서비스 이용 문의처는 어디인가요?',
            acceptedAnswer: { '@type': 'Answer', text: '웹사이트 상단 고객센터 및 온라인 게시판을 통해 언제든지 문의 남겨주시면 빠르게 답변해 드립니다.' },
          },
        ],
      },
      {
        '@type': 'Person',
        '@id': '${d.origin}/#person',
        name: '${escapeJs(d.siteName)} 연구팀/담당자',
        worksFor: { '@id': '${d.origin}/#organization' },
      },
    ],
  }) }}
/>`;
		case 'RENDER_BLOCKING':
		case 'LCP_POOR':
			return `// app/layout.tsx <head> — REDUE v30 JS Defer Auto-Fixer (prefer next/script strategy="afterInteractive")
${buildJsDeferAutoFixerScriptTag()}`;
		case 'H1_MISSING':
			return `// page.tsx — keep existing UI; ensure one topical H1
<h1>${escapeJs(d.title)}</h1>`;
		case 'IMAGE_ALT':
			return `// app/layout.tsx <head> — REDUE v30 Alt Auto-Fixer
${buildAltAutoFixerScriptTag(d.siteName)}`;
		case 'GPTBOT_BLOCKED':
		case 'SITEMAP_NOT_FOUND':
		case 'ROBOTS_SITEMAP_MISSING':
			return `# public/robots.txt
User-Agent: *
Allow: /
User-Agent: GPTBot
Allow: /
Sitemap: ${d.origin}/sitemap.xml`;
		default:
			return `/* REDUE Next.js v30: ${code} — layout.tsx metadata / JSON-LD merge only */`;
	}
}

function wordpressSnippet(code: string, d: ReturnType<typeof enrich>): string {
	switch (code) {
		case 'CANONICAL_MISSING':
		case 'CANONICAL_RELATIVE_PATH':
		case 'SCHEMA_MISSING':
		case 'ORGANIZATION_MISSING':
		case 'WEBSITE_SCHEMA_MISSING':
		case 'ARTICLE_DATE_MISSING':
		case 'RENDER_BLOCKING':
		case 'LCP_POOR':
		case 'META_DESC_MISSING':
		case 'META_DESC_LENGTH_SUBOPTIMAL':
		case 'OG_INCOMPLETE':
		case 'IMAGE_ALT':
			return `<?php
/* REDUE v30 Precision Canonical & Full-Document Defer Master Engine — header.php / functions.php 최상단(또는 테마 header.php 맨 위)에 붙여넣기.
 * /?p=123 등 쿼리형 서브페이지도 루트로 붕괴하지 않습니다. Yoast/RankMath 사용 시에도 OB가 중복 canonical을 제거합니다. */
?>
${buildUniversalObSeoEnginePhp()}`;
		case 'TITLE_MISSING':
		case 'TITLE_LENGTH_SUBOPTIMAL':
			return `<?php
add_filter('pre_get_document_title', function () {
  return '${escapePhp(d.title)} | ' . get_bloginfo('name');
});`;
		case 'H1_MISSING':
			return `<!-- REDUE: WordPress H1 — 테마 템플릿 -->
<h1 class="entry-title"><?php the_title(); ?></h1>`;
		case 'GPTBOT_BLOCKED':
		case 'SITEMAP_NOT_FOUND':
		case 'ROBOTS_SITEMAP_MISSING':
			return `# robots.txt (WordPress 루트 또는 SEO 플러그인)
User-agent: *
Allow: /
User-agent: GPTBot
Allow: /
Sitemap: ${d.origin}/sitemap_index.xml`;
		default:
			return `<?php /* REDUE WordPress v30: ${code} — header.php 최상단에 Universal Master Engine */ ?>
${buildUniversalObSeoEnginePhp()}`;
	}
}

function reactSnippet(code: string, d: ReturnType<typeof enrich>): string {
	const isoNow = new Date().toISOString();
	const isoPublished = `${new Date().getUTCFullYear()}-01-01T00:00:00+09:00`;
	switch (code) {
		case 'SCHEMA_MISSING':
		case 'ORGANIZATION_MISSING':
		case 'ARTICLE_DATE_MISSING':
		case 'WEBSITE_SCHEMA_MISSING': {
			const graph = staticSchemaGraph(d, isoPublished, isoNow);
			return `<!-- REDUE v30 Article + FAQPage + Person — public/index.html <head> -->
<script type="application/ld+json">
${JSON.stringify(graph)}
</script>`;
		}
		case 'CANONICAL_MISSING':
		case 'CANONICAL_RELATIVE_PATH':
			return `<!-- REDUE v30 Canonical — public/index.html <head> (exact current page URL) -->
<link rel="canonical" href="${d.targetUrl}" />
<meta property="og:url" content="${d.targetUrl}" />`;
		case 'RENDER_BLOCKING':
		case 'LCP_POOR':
			return `<!-- REDUE v30 JS Defer Auto-Fixer — public/index.html <head> -->
${buildJsDeferAutoFixerScriptTag()}`;
		case 'H1_MISSING':
			return `// App root — one topical H1
<h1>${escapeJs(d.title)}</h1>`;
		case 'IMAGE_ALT':
			return `<!-- public/index.html <head> — REDUE v30 Alt Auto-Fixer -->
${buildAltAutoFixerScriptTag(d.siteName)}`;
		default:
			return `<!-- public/index.html <head> -->
<title>${escapeAttr(d.title)}</title>
<meta name="description" content="${escapeAttr(d.description)}" />
<link rel="canonical" href="${d.targetUrl}" />`;
	}
}

function laravelSnippet(code: string, d: ReturnType<typeof enrich>): string {
	switch (code) {
		case 'SCHEMA_MISSING':
		case 'ORGANIZATION_MISSING':
		case 'ARTICLE_DATE_MISSING':
		case 'WEBSITE_SCHEMA_MISSING':
		case 'CANONICAL_MISSING':
		case 'CANONICAL_RELATIVE_PATH':
		case 'RENDER_BLOCKING':
		case 'LCP_POOR':
		case 'META_DESC_MISSING':
		case 'META_DESC_LENGTH_SUBOPTIMAL':
		case 'OG_INCOMPLETE':
		case 'IMAGE_ALT':
			return `{{-- REDUE v30 Precision Canonical & Full-Document Defer Master Engine — layouts/app.blade.php 최상단 --}}
${buildUniversalObSeoEnginePhp()}`;
		case 'H1_MISSING':
			return `{{-- Blade — 페이지당 H1 1개 --}}
<h1>{{ $pageTitle ?? '${escapeJs(d.title)}' }}</h1>`;
		default:
			return `{{-- layouts/app.blade.php — REDUE v30 --}}
${buildUniversalObSeoEnginePhp()}`;
	}
}

/** Generic HTML/PHP sites (Cafe24-like static head, Imweb exports, custom FTP sites). */
function customHtmlPhpSnippet(code: string, d: ReturnType<typeof enrich>): string {
	switch (code) {
		case 'CANONICAL_MISSING':
		case 'CANONICAL_RELATIVE_PATH':
		case 'SCHEMA_MISSING':
		case 'ORGANIZATION_MISSING':
		case 'WEBSITE_SCHEMA_MISSING':
		case 'ARTICLE_DATE_MISSING':
		case 'RENDER_BLOCKING':
		case 'LCP_POOR':
		case 'META_DESC_MISSING':
		case 'META_DESC_LENGTH_SUBOPTIMAL':
		case 'OG_INCOMPLETE':
		case 'IMAGE_ALT':
			return `<?php
/* REDUE v30 Precision Canonical & Full-Document Defer Master Engine — head.php / index.php 최상단 */
?>
${buildUniversalObSeoEnginePhp()}`;
		case 'TITLE_MISSING':
		case 'TITLE_LENGTH_SUBOPTIMAL':
			return `<!-- REDUE: Custom HTML/PHP Title -->
<title>${escapeAttr(d.title)} | ${escapeAttr(d.siteName)}</title>`;
		case 'H1_MISSING':
			return `<!-- REDUE: Custom HTML/PHP H1 — 본문 상단 -->
<h1>${escapeAttr(d.title)}</h1>`;
		default:
			return `<!-- REDUE Custom HTML/PHP v30: ${code} — head.php 최상단에 Universal Master Engine -->
${buildUniversalObSeoEnginePhp()}`;
	}
}

function escapeAttr(s: string): string {
	return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeJs(s: string): string {
	return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapePhp(s: string): string {
	return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
