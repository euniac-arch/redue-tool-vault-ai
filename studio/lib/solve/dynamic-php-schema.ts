/**
 * Hybrid Schema Builder v30 — Precision Canonical & Full-Document Defer Master Engine:
 * ① All JSON-LD is emitted once from head.sub.php via redue_dynamic_schema_controller().
 * ② Subpages bind data only through $GLOBALS['schema_faq_items'|'schema_person'|'schema_article'];
 *    the controller scans those globals and dynamically expands @graph (no per-page JSON-LD).
 * ③ Quality rules: HTTPS URLs, homepage WebPage + GEO ItemLists, board CollectionPage
 *    (FAQPage ban only — Article is guaranteed on EVERY page), MedicalWebPage only on
 *    301–304/600 medical content, ghost URL filter.
 * ④ v9/v10 core retained: brand≠legalName, region URL 1:1, cancer ListItem (no Service),
 *    action-service filter for #main-services, og:type precision, Parent Fallback Hierarchy,
 *    paging-title reject, labeled legalName (copyright/year blocked).
 * ⑤ v11 Core Retained: index parent/parent_url force-empty; footer telephone/email/PostalAddress
 *    bind on Organization+ProfessionalService; legalName isolated from brand when distinct.
 * ⑥ v12 Full-Pass Retained: Organization sameAs (origin + Naver blog host), default Person E-E-A-T
 *    node on main/sub @graph, Meta Description Extender (75–150 chars), main 4× ItemList binding.
 * ⑦ v14 retained: Article + FAQPage schema auto-filler; vanilla JS Alt Auto-Fixer.
 * ⑧ v15 retained: Canonical/og:url coherence, client JS Defer Auto-Fixer, Article date ISO 8601.
 * ⑨ v16 Canonical Precision retained: main → origin/; query strip to identity keys only
 *    (bo_table, co_id, it_id, ca_id, idx, p, page_id, wr_id, id); HTTPS normalize.
 * ⑩ [v32] Crawler-Optimized Canonical: `redue_get_exact_canonical()` collapses to `/` ONLY when
 *    path is exactly `/` or `/index.php` AND allowlisted identity query is empty — never flattens
 *    `/sub01/index.php`, `301.php`, `board.php?bo_table=…`, or `/?bo_table=` / `/?p=123`
 *    (path `/` with GET still counts as subpage). `/index.php` alone is normalized to `/`.
 *    Path dual-detects `REQUEST_URI` + `SCRIPT_NAME` (bot path loss). HTTPS origin forced.
 *    OB strips every duplicate canonical/og:url (quoted + unquoted rel) and reinjects one
 *    exact pair immediately after `<head>` (Head-After First-Chunk; charset / `</head>` fallback).
 * ⑱ [v33 100-Point Pack] Shared OB transformer (all industries):
 *    · LocalBusiness/Organization telephone from `$config['cf_tel']` else buffer/footer regex
 *    · PostalAddress.streetAddress from 전국 시/도 주소 정규식
 *    · Main/about `@type` arrays: MEDICAL → MedicalWebPage+AboutPage+WebPage,
 *      else AboutPage+WebPage; WebSite/WebPage `@id` always present
 *    · Global Alt Transformer rewrites empty/missing `<img alt>` from nearby 대표자 heading / filename / page name
 *    · `<title>` shorter than 10 chars is expanded to the 10–60 golden range
 * ⑪ [v30] Full-Document Script Defer: `ob_start()` regex sweeps the ENTIRE buffer (head+body)
 *    and appends `defer` to sync external `<script src>` lacking async/defer/module/ld+json.
 * ⑫ Static source-text defer (`addDeferToScriptTagsInSource`) retained as defense-in-depth
 *    for Gnuboard `add_javascript()` string payloads at patch time.
 * ⑬ Lightweight drop-in: `buildUniversalObSeoEnginePhp()` / `generateUniversalPhpSeoEngine()`
 *    emit the full Universal v30 Master Engine (OB + Article/FAQ/Person schema) for any
 *    common header file with zero CMS-specific hooks (no add_javascript / G5_THEME_PATH).
 * ⑭ v22 Top-Priority Injection: insert engine immediately after the first <?php ONLY.
 *    Strip theme description/og:title/og:description/og:image (PHP-aware) + leftover
 *    quote-gt closers. Keep charset / robots / naver-site-verification / viewport.
 * ⑮ Article Node is guaranteed on EVERY page (main + subpages + boards). FAQPage is
 *    guaranteed on all non-board pages. Person E-E-A-T node is always emitted.
 * ⑯ [v31] NewsArticle Auto-Detect: when `$bo_table` / URL / title matches notice|press|news|
 *    media|insight|board (or 보도·뉴스·공지…), emit NewsArticle with Google/AI citation fields
 *    (headline, image, datePublished, dateModified, author Organization, publisher+logo) from
 *    Gnuboard globals — no hardcoded domain or board names.
 * ⑰ [Universal Dynamic] Gnuboard head.sub.php engine drops static $page_meta and compile-time
 *    NAP. `$GLOBALS['redue_org_type']` + `$config`/`$g5_menu`/`$view`/`$board`/`$g5_head_title`
 *    drive Organization+WebSite+GNB, CollectionPage, Article, and BreadcrumbList+WebPage.
 */

import { dedupeRepeatedPhrase } from '@/lib/audit/brand-name';
import { resolveEngineRepresentative } from '@/lib/audit/extractors/entity';
import { buildImageRepSemanticsPhp } from '@/lib/audit/extractors/image-rep-semantics';
import { formatGnbHierarchyTitle } from '@/lib/audit/extractors/gnb-pages';
import { resolvePageDescription } from '@/lib/audit/extractors/page-description';
import {
	SCHEMA_CURRENCIES_ACCEPTED_FALLBACK,
	SCHEMA_PAYMENT_ACCEPTED_FALLBACK,
	SCHEMA_PRICE_RANGE_FALLBACK,
	buildAvailableServices,
	filterOfficialSameAs,
} from '@/lib/audit/extractors/schema-entity-pack';
import {
	buildEvidenceFaqHowToHelpersPhp,
	buildEvidenceFaqInjectPhp,
	buildForceCompleteNapPhp,
	buildHowToAutoInjectPhp,
	buildOrgFounderIdRefPhp,
	buildPersonEeatNodePhp,
	extractNapFromCorpus,
	resolveCompleteNap,
} from '@/lib/solve/core/eeat-citation';
import {
	classifyIndustrySchema,
	orgTypesToPhpArray,
	splitAlternateName,
	type IndustrySchemaInput,
} from '@/lib/solve/core/industry-schema';
import { KR_STREET_ADDRESS_RE_PHP } from '@/lib/solve/core/entity-patterns';
import {
	bindTelephone,
	buildTelephoneRuntimeHelpersPhp,
	formatKoreanTelephone,
} from '@/lib/solve/core/telephone';
import {
	buildUniversalBreadcrumbEnsurePhp,
	buildUniversalGraphApplyPhp,
	buildUniversalGraphGlobalsSeedPhp,
	buildUniversalGraphRuntimeHelpersPhp,
	buildUniversalOrgFiveCoreBindPhp,
} from '@/lib/solve/core/universal-graph-builder';
import { buildRedueLlmsPhpEngine } from '@/lib/solve/llms-php-engine';
import {
	humanizePathLabel,
	hydrateSolvePageMeta,
	isCmsPathToken,
	looksLikeRawUrlOrPath,
} from '@/lib/solve/page-meta-hydrate';
import {
	buildGnuboardLegacyCompatPhp,
	cleanPhpTemplate,
	healGnuboardHeadSubSource,
	isGnuboardHeadSubPath,
	isGnuboardThemeRelativePath,
	sanitizeGeneratedPhpSnippet,
	sanitizePhpCode,
	sanitizePhpForDeploy,
	stripGnuboardThemeSelfDelegation,
	stripOrphanedReduePhpFunctions,
} from '@/lib/solve/php-sanitize';

export {
	cleanPhpTemplate,
	healGnuboardHeadSubSource,
	isGnuboardHeadSubPath,
	sanitizeGeneratedPhpSnippet,
	sanitizePhpCode,
	sanitizePhpForDeploy,
	stripOrphanedReduePhpFunctions,
} from '@/lib/solve/php-sanitize';

export const REDUE_SCHEMA_MARKER_START = 'REDUE_AI_STUDIO:START';
export const REDUE_SCHEMA_MARKER_END = 'REDUE_AI_STUDIO:END';

/**
 * Phase-2 render-call marker. The engine block (functions/vars only, no output)
 * is injected right after the `_GNUBOARD_` guard; this second block is a tiny
 * `echo redue_render_full_schema();` call injected right after `<meta charset>`
 * so JSON-LD/canonical/OG output never lands before `<!doctype html>`.
 */
export const REDUE_SCHEMA_RENDER_MARKER_START = 'REDUE_AI_STUDIO_RENDER:START';
export const REDUE_SCHEMA_RENDER_MARKER_END = 'REDUE_AI_STUDIO_RENDER:END';

/** Success banner / modal copy for the Universal v30 Master Engine. */
export const REDUE_V30_SCHEMA_PATCH_SUCCESS =
	'✅ CMS 어댑터 패치 완료 — 그누보드: /extend/redue.schema.php 엔진 분리 + head.sub.php charset 직후 5줄 렌더 (관리자 CSRF/POST 차단) · 워드프레스: mu-plugins · 라이믹스: addon · SaaS: 정적 JSON-LD';

/** @deprecated Use REDUE_V30_SCHEMA_PATCH_SUCCESS */
export const REDUE_V29_SCHEMA_PATCH_SUCCESS = REDUE_V30_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V30_SCHEMA_PATCH_SUCCESS */
export const REDUE_V26_SCHEMA_PATCH_SUCCESS = REDUE_V30_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V30_SCHEMA_PATCH_SUCCESS */
export const REDUE_V23_SCHEMA_PATCH_SUCCESS = REDUE_V26_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V26_SCHEMA_PATCH_SUCCESS */
export const REDUE_V22_SCHEMA_PATCH_SUCCESS = REDUE_V23_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V22_SCHEMA_PATCH_SUCCESS */
export const REDUE_V20_SCHEMA_PATCH_SUCCESS = REDUE_V22_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V22_SCHEMA_PATCH_SUCCESS */
export const REDUE_V19_SCHEMA_PATCH_SUCCESS = REDUE_V22_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V17_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V16_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V15_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V14_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V12_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V11_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V10_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V9_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V8_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** @deprecated Use REDUE_V20_SCHEMA_PATCH_SUCCESS */
export const REDUE_V7_SCHEMA_PATCH_SUCCESS = REDUE_V20_SCHEMA_PATCH_SUCCESS;

/** Short developer guide shown in completion modal / report. */
export const REDUE_V20_SCHEMA_EXTENSION_GUIDE = `특수 확장 변수 (서브페이지에서 JSON-LD 직접 출력 금지 — 데이터만 바인딩):
• $GLOBALS['schema_faq_items'] = [ ['q'=>'질문','a'=>'답변'], … ]  → FAQPage (페이지 본문/게시글에서 실제 Q&A가 추출된 경우에만 생성. 비어 있으면 FAQPage 노드 생략)
• $GLOBALS['schema_person'] = ['name'=>'이름','jobTitle'=>'직함', …]  → Person + worksFor + Organization.founder/physician (관리자 대표자명 또는 푸터/인사말 자동 추출 $rep_name; 미지정 시 {site_name} 의료진/연구팀 Fallback)
• ob_start()가 </head> 직전에 <meta name="author"> / <meta name="representative"> 를 $rep_name 또는 런타임 텍스트 스캔으로 주입
• $GLOBALS['schema_article'] = ['type'=>'Article'|'NewsArticle','headline'=>…, …]  → Article/NewsArticle (datePublished/dateModified 미지정 시 ISO 8601 자동 보완; 미지정 시 브랜드+Description 기반 기본 Article이 메인·서브·게시판 포함 모든 페이지에 자동 결합). v31: $bo_table/URL/제목에 notice|press|news|media|insight|board·보도·뉴스·공지 등이 있으면 NewsArticle로 자동 승격하고 headline·image·dates·author·publisher(logo)를 $config/$g5/$wr에서 주입
• v14 Alt Auto-Fixer: 공통 헤더 최하단 JS가 빈/누락 img[alt]를 $site_name 기반으로 자동 보완
• v15 JS Defer Auto-Fixer: 외부 script[src]에 async/defer 없으면 defer 자동 부여 (클라이언트 보강)
• v16/v30 Canonical Precision: 메인은 path가 index이고 query가 비어 있을 때만 $origin/; 서브페이지·
  /?p=123·board.php?bo_table= 등은 절대 루트로 붕괴하지 않음. 쿼리는 bo_table|co_id|it_id|ca_id|idx|p|page_id|wr_id|id 만 유지
• v32/v33 Crawler-Optimized OB Master Engine: ob_start()로 중복 canonical/og:url 제거 후
  <head> 바로 직후(Head-After First-Chunk) exact 서브페이지 쌍 재주입
  (없으면 charset 직후 → </head> 직전) + REQUEST_URI·SCRIPT_NAME 이중 경로 감지 + HTTPS 강제 +
  head+body 전문서 regex로 sync <script src>에 defer 부여 (진단봇 First Chunk에도 반영)
• v33 100-Point Pack: LocalBusiness telephone/address 버퍼 자동추출 · 메인/소개 AboutPage 복합 @type
  · WebSite/WebPage @id 보장 · Global Alt Transformer · 짧은 <title> 10–60자 보정
• v26 Static Script Defer: addDeferToScriptTagsInSource()가 head.sub.php 소스 자체에서 async/defer 없는
  <script src>(및 add_javascript() 문자열 인자 내부)를 찾아 defer 속성을 직접 파일에 기록 (방어적 보강)
• v22 Top-Priority: 첫 <?php 직후 삽입 — charset/robots/Naver verification/HTML/include 보존. 엔진이 동적 처리하는 description/og:title/og:description/og:image 및 찌꺼기 quote-gt는 제거
• Universal drop-in: buildUniversalObSeoEnginePhp() / generateUniversalPhpSeoEngine() — v30 Master Engine
  (OB + Article/FAQ/Person schema + Alt Auto-Fix)를 공통 헤더 맨 위에 단일 블록으로 삽입`;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V19_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V17_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V16_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V15_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V14_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V12_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V11_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V10_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V9_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V8_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/** @deprecated Use REDUE_V20_SCHEMA_EXTENSION_GUIDE */
export const REDUE_V7_SCHEMA_EXTENSION_GUIDE = REDUE_V20_SCHEMA_EXTENSION_GUIDE;

/**
 * @deprecated Removed in v26 — ob_start() based whole-document canonical/defer rewriting is no
 * longer used anywhere in this module. Output buffering can leave crawler/SEO-audit HTTP clients
 * reading an incomplete or delayed buffer flush, so canonical/og:url are now computed and echoed
 * natively with zero buffering (see `buildExactCanonicalPhpBlock` + `buildCanonicalLinkEchoPhp`),
 * and script `defer` is written directly into the file source (see `addDeferToScriptTagsInSource`).
 * Kept only as a no-op stub so any stale external references fail loudly instead of silently
 * reintroducing ob_start().
 */
export function buildRedueDocumentObCleanerPhp(): string {
	return '';
}

/**
 * v32 Crawler-Optimized Hardcoded Canonical Engine — plain PHP, zero output buffering.
 * Forces HTTPS representative origin (`https://{defaultHost}`), dual-detects path via
 * `REQUEST_URI` + `SCRIPT_NAME` (diagnostic bots often lose one), and allowlists identity
 * query keys. Insert immediately after the FIRST `<?php` in head.sub.php; pair with
 * `buildCanonicalLinkHtmlTag()` right after `<meta charset>` (First-Chunk safe).
 */
export function buildExactCanonicalPhpBlock(defaultHost = 'koreaionlab.co.kr'): string {
	const safeHost = String(defaultHost || 'koreaionlab.co.kr')
		.replace(/^https?:\/\//i, '')
		.replace(/\/+$/, '')
		.replace(/[^a-zA-Z0-9.-]/g, '');
	const host = safeHost || 'koreaionlab.co.kr';
	return `/* ${REDUE_SCHEMA_MARKER_START} v32 — Crawler-Optimized Hardcoded Canonical Engine */
/* =================================================================
 * [REDUE AI STUDIO] Crawler-Optimized Hardcoded Canonical Engine
 * ================================================================= */
$__redue_proto = 'http';
if ( ! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' && $_SERVER['HTTPS'] !== '0' ) { $__redue_proto = 'https'; }
elseif ( isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443' ) { $__redue_proto = 'https'; }
elseif ( ! empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https' ) { $__redue_proto = 'https'; }
$canonical_base = $__redue_proto . "://${host}";

if ( empty($_SERVER['HTTP_HOST']) ) {
	$_SERVER['HTTP_HOST'] = '${host}';
}
$_SERVER['HTTP_HOST'] = preg_replace('#^https?://#i', '', (string)$_SERVER['HTTP_HOST']);

// 1. 접속 요청 경로 정밀 추적 — REQUEST_URI + SCRIPT_NAME 이중 감지 (진단봇 유실 방지)
$raw_uri = isset($_SERVER['REQUEST_URI']) ? (string)$_SERVER['REQUEST_URI'] : '';
$parsed_uri = $raw_uri !== '' ? parse_url($raw_uri) : false;
$uri_path = (is_array($parsed_uri) && isset($parsed_uri['path']) && is_string($parsed_uri['path']) && $parsed_uri['path'] !== '')
	? $parsed_uri['path']
	: '';
$script_name = isset($_SERVER['SCRIPT_NAME']) ? (string)$_SERVER['SCRIPT_NAME'] : '';
if ( $script_name !== '' ) {
	$script_name = str_replace('\\\\', '/', $script_name);
}
// REQUEST_URI 경로가 비었거나 루트로 붕괴된 경우 SCRIPT_NAME으로 서브페이지 복구 (302.php, 101.php 등)
if ( ($uri_path === '' || $uri_path === '/' || $uri_path === '/index.php') && $script_name !== '' && $script_name !== '/' && $script_name !== '/index.php' && substr($script_name, -4) === '.php' ) {
	$uri_path = $script_name;
}
if ( $uri_path === '' ) {
	$uri_path = '/';
}

// 2. 허용 파라미터 정제 (bo_table, wr_id 등) — $_GET 우선, REQUEST_URI 쿼리 폴백
$allowed_params = array('bo_table', 'wr_id', 'co_id', 'idx', 'p', 'page_id', 'id', 'it_id', 'ca_id');
$query_parts = array();
$param_src = array();
if ( ! empty($_GET) && is_array($_GET) ) {
	$param_src = $_GET;
} else if ( is_array($parsed_uri) && ! empty($parsed_uri['query']) ) {
	parse_str($parsed_uri['query'], $param_src);
}
if ( ! empty($param_src) && is_array($param_src) ) {
	foreach ( $allowed_params as $param_key ) {
		if ( isset($param_src[$param_key]) && trim((string)$param_src[$param_key]) !== '' ) {
			$query_parts[$param_key] = trim((string)$param_src[$param_key]);
		}
	}
}
$query_str = ! empty($query_parts) ? '?' . http_build_query($query_parts) : '';

// 3. 메인 vs 서브페이지 고유 Canonical 정밀 판별
if ( ($uri_path === '/' || $uri_path === '/index.php' || $uri_path === '') && $query_str === '' ) {
	$final_canonical_url = $canonical_base . '/';
} else {
	if ( $uri_path === '/index.php' ) {
		$uri_path = '/';
	}
	$final_canonical_url = $canonical_base . $uri_path . $query_str;
}
$exact_canonical_url = $final_canonical_url;
$final_canonical_url = $exact_canonical_url;
/* ${REDUE_SCHEMA_MARKER_END} */
`;
}

/**
 * v32 native HTML for `<link rel="canonical">` + `og:url`.
 * Insert immediately after `<meta charset>` / Content-Type charset (Bot Optimized Top Position)
 * so First-Chunk diagnostic crawlers see the pair before large CSS/JS blocks.
 * Depends on `$exact_canonical_url` from `buildExactCanonicalPhpBlock()`.
 */
export function buildCanonicalLinkHtmlTag(): string {
	return `<!-- SEO Standard Canonical & OpenGraph URL Pair (Bot Optimized Top Position) -->
<link rel="canonical" href="<?php echo htmlspecialchars(isset($exact_canonical_url) && $exact_canonical_url !== '' ? $exact_canonical_url : (function_exists('redue_get_exact_canonical') ? redue_get_exact_canonical() : ''), ENT_QUOTES, 'UTF-8'); ?>">
<meta property="og:url" content="<?php echo htmlspecialchars(isset($exact_canonical_url) && $exact_canonical_url !== '' ? $exact_canonical_url : (function_exists('redue_get_exact_canonical') ? redue_get_exact_canonical() : ''), ENT_QUOTES, 'UTF-8'); ?>">
`;
}

/**
 * Ready-to-paste head.sub.php fragment: PHP calc + canonical/og pair for placement
 * immediately after `<meta charset="utf-8">` (before viewport / CSS / theme metas).
 */
export function buildCrawlerOptimizedCanonicalHeadFragment(
	defaultHost = 'koreaionlab.co.kr',
): string {
	return `<?php
${buildExactCanonicalPhpBlock(defaultHost).trimEnd()}
?>
${buildCanonicalLinkHtmlTag().trimEnd()}
`;
}

/**
 * v26 variant of the canonical echo meant for use INSIDE an already-open PHP block (e.g. the
 * full hybrid `redue_dynamic_schema_controller()`), where `echo` statements — not raw HTML — are
 * required. Prints the exact same tags as `buildCanonicalLinkHtmlTag()`.
 */
export function buildCanonicalLinkEchoPhp(canonicalVarName = 'exact_canonical_url'): string {
	return `echo '<link rel="canonical" href="' . htmlspecialchars($${canonicalVarName}, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
echo '<meta property="og:url" content="' . htmlspecialchars($${canonicalVarName}, ENT_QUOTES, 'UTF-8') . '">' . "\\n";`;
}

/**
 * v26 static (build-time) script defer engine — replaces the old ob_start() whole-document
 * scanner. Rewrites `<script src="…">` tags lacking `defer`/`async` to add `defer` DIRECTLY in
 * the source text (no PHP output buffering, no runtime DOM Observer). Also reaches into Gnuboard
 * `add_javascript('<script src="…"></script>')` string payloads so footer-queued scripts get the
 * same static rewrite. Inline scripts (no `src`) are never touched.
 */
export function addDeferToScriptTagsInSource(source: string): string {
	if (!source) return source;

	const addDeferToTag = (tag: string): string => tag.replace(/\s*>$/, ' defer>');
	// Skip tags that already have defer/async, or are module / JSON-LD (never defer those).
	const scriptSrcNoDeferRe = () =>
		/<script\b(?![^>]*\b(?:defer|async|type=["']module["']|type=["']application\/ld\+json["'])\b)[^>]*\bsrc\s*=\s*(["'])[^"']*\1[^>]*>/gi;

	let out = source.replace(scriptSrcNoDeferRe(), (m) => addDeferToTag(m));

	// Gnuboard add_javascript('<script src="...">...</script>') string payloads
	const addJavascriptCallRe = /(add_javascript\s*\(\s*['"])([\s\S]*?)(['"]\s*\))/gi;
	out = out.replace(addJavascriptCallRe, (_match, prefix, body, suffix) => {
		const patchedBody = String(body).replace(scriptSrcNoDeferRe(), (m: string) => addDeferToTag(m));
		return `${prefix}${patchedBody}${suffix}`;
	});

	return out;
}

/**
 * Vanilla JS Alt Auto-Fixer (no outer &lt;script&gt; tags).
 * When `siteNameLiteral` is set, embeds a JSON string; otherwise expects PHP `var site=$site_name` prep.
 */
export function buildAltAutoFixerJsBody(siteNameLiteral?: string): string {
	const siteInit =
		siteNameLiteral !== undefined
			? `var site=${JSON.stringify(siteNameLiteral)};`
			: 'var site=(typeof window!=="undefined"&&window.__REDUE_SITE_NAME)||"Site";';
	return `(function(){${siteInit}function fix(){try{var imgs=document.querySelectorAll("img");for(var i=0;i<imgs.length;i++){var img=imgs[i];var cur=img.getAttribute("alt");if(cur!=null&&String(cur).trim()!=="")continue;var kw=img.getAttribute("title")||img.getAttribute("aria-label")||img.getAttribute("data-alt")||"";if(!kw&&img.getAttribute("src")){try{var path=String(img.getAttribute("src")).split("?")[0];var base=path.substring(path.lastIndexOf("/")+1).replace(/\\.[a-z0-9]+$/i,"");kw=decodeURIComponent(base).replace(/[-_]+/g," ").replace(/\\s+/g," ").trim();}catch(e0){}}img.setAttribute("alt",(kw&&kw.length>1?kw+" — ":"")+site);}}catch(e){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fix);else fix();if(typeof MutationObserver!=="undefined"){try{new MutationObserver(function(){fix();}).observe(document.documentElement,{childList:true,subtree:true});}catch(e2){}}})();`;
}

/** Full &lt;script&gt; tag for static HTML inject paths. */
export function buildAltAutoFixerScriptTag(siteName: string): string {
	return `<script id="redue-alt-autofix">${buildAltAutoFixerJsBody(siteName || 'Site')}</script>`;
}

/**
 * Vanilla JS Defer Auto-Fixer (no outer &lt;script&gt; tags).
 * Marks external script[src] without async/defer as defer (render-blocking red-light).
 */
export function buildJsDeferAutoFixerJsBody(): string {
	return `(function(){function autoDefer(){try{var scripts=document.querySelectorAll("script[src]");for(var i=0;i<scripts.length;i++){var s=scripts[i];var src=s.getAttribute("src")||"";if(src&&!s.hasAttribute("defer")&&!s.hasAttribute("async")&&s.id!=="redue-js-defer-fix"&&s.id!=="redue-alt-autofix"){s.setAttribute("defer","defer");}}}catch(e){}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",autoDefer);}else{autoDefer();}})();`;
}

/** Full &lt;script&gt; tag for static HTML / CMS inject paths. */
export function buildJsDeferAutoFixerScriptTag(): string {
	return `<script id="redue-js-defer-fix">${buildJsDeferAutoFixerJsBody()}</script>`;
}

/**
 * @deprecated v23 Ultra-Fast DOM Script Defer Engine (client-side MutationObserver approach).
 * Superseded in v26 by `addDeferToScriptTagsInSource()`, which writes `defer` directly into the
 * file source at patch time instead of forcing it on at runtime via JS. Kept only for CMS targets
 * that still reference this tag; new engines should not emit it.
 */
export function buildJsDomDeferEngineJsBody(): string {
	return `(function(){function forceDefer(){try{var scripts=document.querySelectorAll("script[src]");for(var i=0;i<scripts.length;i++){var s=scripts[i];if(!s.hasAttribute("defer")&&!s.hasAttribute("async")&&s.id!=="redue-dom-defer-engine"){s.setAttribute("defer","defer");s.defer=true;}}}catch(e){}}forceDefer();if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",forceDefer);}window.addEventListener("load",forceDefer);if(typeof MutationObserver!=="undefined"){try{new MutationObserver(forceDefer).observe(document.documentElement,{childList:true,subtree:true});}catch(e2){}}})();`;
}

/** Full &lt;script&gt; tag for static HTML inject paths. */
export function buildJsDomDeferEngineScriptTag(): string {
	return `<script id="redue-dom-defer-engine">${buildJsDomDeferEngineJsBody()}</script>`;
}

/**
 * Universal v30 Master Engine — returns the full self-contained `<?php … ?>` block
 * (OB + schema controller). Alias of `buildUniversalObSeoEnginePhp()`.
 */
export function generateUniversalPhpSeoEngine(opts?: {
	representativeName?: string;
	representativeTitle?: string;
	openingHoursOpens?: string;
	openingHoursCloses?: string;
	latitude?: string;
	longitude?: string;
	sameAs?: string[];
	medicalSpecialty?: string[];
	isAcceptingNewPatients?: boolean;
}): string {
	return buildUniversalObSeoEnginePhp(opts);
}

/** Short developer guide shown alongside the v30 Universal Master Engine snippet/tab. */
export const REDUE_V30_UNIVERSAL_OB_ENGINE_GUIDE =
	'Universal JSON-LD Schema Engine (Charset-After Direct Echo) — G5_URL·$config[cf_title]·$g5_head_title 자동 감지, REQUEST_URI+SCRIPT_NAME 이중 경로, 실제 작동 프로토콜(http/https) 일치(HTTPS 강제 금지), charset 직후 또는 title 상단에서 직접 echo. 자사 홈페이지는 sameAs에서 제외하고 외부 공식 채널만 등록. 화면에 없는 FAQPage/HowTo는 생성하지 않음. LocalBusiness NAP·AboutPage/ContactPage·Person E-E-A-T. redue_dynamic_schema_controller()는 static $executed로 1회만 실행. Gnuboard/Youngcart head.sub.php(또는 header.php) 최상단에 붙여넣으세요.';

/** @deprecated Use REDUE_V30_UNIVERSAL_OB_ENGINE_GUIDE */
export const REDUE_V29_UNIVERSAL_OB_ENGINE_GUIDE = REDUE_V30_UNIVERSAL_OB_ENGINE_GUIDE;

/** @deprecated Use REDUE_V30_UNIVERSAL_OB_ENGINE_GUIDE */
export const REDUE_V27_UNIVERSAL_OB_ENGINE_GUIDE = REDUE_V30_UNIVERSAL_OB_ENGINE_GUIDE;

/**
 * Shared OB registration fragment used by both the lightweight Universal v30 drop-in and the
 * full hybrid `redue_dynamic_schema_controller()` path.
 * Auto-detects Gnuboard `G5_URL` when present; never hardcodes domain/brand.
 */
function buildRepresentativeObMetaPhp(): string {
	return `
		// D. Representative meta — $GLOBALS['redue_rep_name'] / schema_person, else footer/인사말 scan
		$rep_name = '';
		$rep_title = '';
		if ( isset($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) ) {
			$rep_name = trim($GLOBALS['redue_rep_name']);
		}
		if ( isset($GLOBALS['redue_rep_title']) && is_string($GLOBALS['redue_rep_title']) ) {
			$rep_title = trim($GLOBALS['redue_rep_title']);
		}
		if ( $rep_name === '' && isset($GLOBALS['schema_person']) && is_array($GLOBALS['schema_person']) && ! empty($GLOBALS['schema_person']['name']) ) {
			$rep_name = trim((string) $GLOBALS['schema_person']['name']);
			if ( ! empty($GLOBALS['schema_person']['jobTitle']) ) {
				$rep_title = trim((string) $GLOBALS['schema_person']['jobTitle']);
			}
		}
		if ( $rep_name === '' ) {
			$plain = preg_replace('/<script\\b[^>]*>[\\s\\S]*?<\\/script>/i', ' ', $buffer);
			$plain = preg_replace('/<style\\b[^>]*>[\\s\\S]*?<\\/style>/i', ' ', is_string($plain) ? $plain : $buffer);
			$plain = html_entity_decode(strip_tags(is_string($plain) ? $plain : $buffer), ENT_QUOTES, 'UTF-8');
			if ( is_string($plain) && preg_match('/(?:대표자|대표원장|대표이사|대표(?!공인|변호|세무|번호|전화)|원장)(?!번호|전화|문의|상담|메일)\\s*[:|：]?\\s*([가-힣]{2,5}|[a-zA-Z][a-zA-Z\\s.]{1,19})/u', $plain, $rep_m) ) {
				$candidate = trim($rep_m[1]);
				if ( $candidate !== '' && ! preg_match('/병원|연구소|센터|안내|소개|진료안내|고객센터/u', $candidate) && ! preg_match('/^(대표자명?|대표이사|대표원장|대표자|원장)$/u', $candidate) ) {
					$rep_name = $candidate;
					if ( $rep_title === '' && preg_match('/(대표자|대표원장|대표이사|대표|원장)/u', $rep_m[0], $rep_t) ) {
						$rep_title = $rep_t[1];
					}
				}
			}
		}
		if ( $rep_name === '' && function_exists('redue_extract_rep_from_imgs') ) {
			$img_hit = redue_extract_rep_from_imgs($buffer);
			if ( is_array($img_hit) && ! empty($img_hit['name']) ) {
				$rep_name = trim((string) $img_hit['name']);
				if ( $rep_title === '' && ! empty($img_hit['title']) ) {
					$rep_title = trim((string) $img_hit['title']);
				}
			}
		}
		$buffer = preg_replace('/<meta\\b(?=[^>]*\\bname=["\\']author["\\'])[^>]*>\\s*/i', '', $buffer);
		$buffer = preg_replace('/<meta\\b(?=[^>]*\\bname=["\\']representative["\\'])[^>]*>\\s*/i', '', $buffer);
		$buffer = preg_replace('/<link\\b(?=[^>]*\\brel=["\\'](?:help|alternate)["\\'])(?=[^>]*llms\\.txt)[^>]*>\\s*/i', '', $buffer);
		$buffer = preg_replace('/<link\\b(?=[^>]*\\brel=["\\']alternate["\\'])(?=[^>]*rss\\.php)[^>]*>\\s*/i', '', $buffer);
		$llms_origin = preg_replace('#^(https?://[^/]+).*#', '$1', $canonical_url);
		if ( ! is_string($llms_origin) || $llms_origin === '' ) { $llms_origin = $canonical_url; }
		$llms_href = htmlspecialchars(rtrim($llms_origin, '/') . '/llms.txt', ENT_QUOTES, 'UTF-8');
		$rss_href = htmlspecialchars(rtrim($llms_origin, '/') . '/rss.php', ENT_QUOTES, 'UTF-8');
		$rep_tags = '';
		if ( $rep_name !== '' ) {
			$GLOBALS['redue_rep_name'] = $rep_name;
			if ( $rep_title !== '' ) { $GLOBALS['redue_rep_title'] = $rep_title; }
			$rep_esc = htmlspecialchars($rep_name, ENT_QUOTES, 'UTF-8');
			$rep_tags .= "\\n" . '<meta name="author" content="' . $rep_esc . '">' . "\\n";
			$rep_tags .= '<meta name="representative" content="' . $rep_esc . '">' . "\\n";
		}
		$rep_tags .= '<link rel="help" type="text/markdown" href="' . $llms_href . '" title="LLMs Context">' . "\\n";
		$rep_tags .= '<link rel="alternate" type="text/markdown" href="' . $llms_href . '">' . "\\n";
		$rep_tags .= '<link rel="alternate" type="application/rss+xml" title="RSS 2.0" href="' . $rss_href . '">' . "\\n";
		if ( preg_match('/<\\/head>/i', $buffer) ) {
			$buffer = preg_replace('/<\\/head>/i', $rep_tags . '</head>', $buffer, 1);
		}
`;
}

/**
 * Head-time footer scanner — reads tail.php from disk before the CMS includes it.
 * Fills empty `$GLOBALS['redue_*']` NAP fields only (never overwrites seeded values).
 */
export function buildFooterAutoDetectPhp(): string {
	return `	if ( ! function_exists( 'redue_auto_detect_footer_info' ) ) {
		function redue_auto_detect_footer_info() {
			static $executed = false;
			static $cached = null;
			if ( $executed ) { return; }
			$executed = true;

			if ( ! is_string($cached) ) {
				$cached = '';
				if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
					foreach ( array('cf_title', 'cf_tel', 'cf_phone', 'cf_admin_name', 'cf_add_script', 'cf_add_meta', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
						if ( ! empty($GLOBALS['config'][$_ck]) && is_string($GLOBALS['config'][$_ck]) ) {
							$cached .= "\\n" . $GLOBALS['config'][$_ck];
						}
					}
				}
				$candidates = array(
					defined('G5_THEME_PATH') ? G5_THEME_PATH . '/tail.php' : '',
					defined('G5_THEME_PATH') ? G5_THEME_PATH . '/tail.sub.php' : '',
					defined('G5_PATH') ? G5_PATH . '/tail.php' : '',
					defined('G5_PATH') ? G5_PATH . '/tail.sub.php' : '',
					( isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : '' ) . '/theme/basic/tail.php',
				);
				foreach ( $candidates as $_p ) {
					if ( ! is_string($_p) || $_p === '' || ! is_file($_p) ) { continue; }
					$_raw = @file_get_contents($_p);
					if ( ! is_string($_raw) || trim($_raw) === '' ) { continue; }
					$cached .= "\\n" . $_raw;
				}
			}
			if ( $cached === '' ) { return; }

			$plain = function_exists('redue_plain_text') ? redue_plain_text($cached) : trim(strip_tags($cached));
			$hay = $cached . "\\n" . ( is_string($plain) ? $plain : '' );

			if ( empty($GLOBALS['redue_tax_id']) || ! is_string($GLOBALS['redue_tax_id']) || trim($GLOBALS['redue_tax_id']) === '' ) {
				$_tax = function_exists('redue_extract_tax_id') ? redue_extract_tax_id($hay) : '';
				if ( $_tax === '' && preg_match('/(?:사업자\\s*(?:등록)?\\s*번호|사업자번호|등록번호)\\s*[:：]?\\s*([0-9]{3}-[0-9]{2}-[0-9]{5}|[0-9]{10})/u', $hay, $m) ) {
					$_tax = trim($m[1]);
				}
				if ( $_tax !== '' ) {
					$GLOBALS['redue_tax_id'] = function_exists('redue_accept_tax_id') ? redue_accept_tax_id($_tax, true) : $_tax;
				}
			}
			if ( empty($GLOBALS['redue_fax']) || ! is_string($GLOBALS['redue_fax']) || trim($GLOBALS['redue_fax']) === '' ) {
				$_fax = function_exists('redue_extract_fax') ? redue_extract_fax($hay) : '';
				if ( $_fax === '' && preg_match('/(?:팩스|FAX|Fax|F\\.)\\s*[:：]?\\s*([0-9]{2,4}-[0-9]{3,4}-[0-9]{4})/u', $hay, $m) ) {
					$_fax = trim($m[1]);
				}
				if ( $_fax !== '' ) { $GLOBALS['redue_fax'] = $_fax; }
			}
			if ( empty($GLOBALS['redue_tel']) || ! is_string($GLOBALS['redue_tel']) || trim($GLOBALS['redue_tel']) === '' ) {
				if ( function_exists('redue_extract_telephone') ) {
					$_tel = redue_extract_telephone($hay);
					if ( $_tel !== '' ) { $GLOBALS['redue_tel'] = $_tel; }
				}
			}
			if ( empty($GLOBALS['redue_rep_name']) || ! is_string($GLOBALS['redue_rep_name']) || trim($GLOBALS['redue_rep_name']) === '' ) {
				if ( preg_match_all('/(?:대표자|대표원장|원장|대표이사|대표)\\s*[:：]?\\s*([가-힣]{2,4})(?=\\s|<|$|\\||\\/)/u', $hay, $mm) ) {
					$_stops = array('제품으로', '대표', '문의', '안내', '상담', '진료', '정보');
					foreach ( $mm[1] as $_cand ) {
						$_cand = trim((string) $_cand);
						if ( $_cand === '' || in_array($_cand, $_stops, true) ) { continue; }
						if ( function_exists('redue_is_valid_rep_name') && ! redue_is_valid_rep_name($_cand) ) { continue; }
						$GLOBALS['redue_rep_name'] = $_cand;
						if ( ! isset($GLOBALS['schema_person']) || ! is_array($GLOBALS['schema_person']) ) {
							$GLOBALS['schema_person'] = array();
						}
						if ( empty($GLOBALS['schema_person']['name']) ) {
							$GLOBALS['schema_person']['name'] = $_cand;
						}
						break;
					}
				}
			}
			if ( empty($GLOBALS['redue_street']) || ! is_string($GLOBALS['redue_street']) || trim($GLOBALS['redue_street']) === '' ) {
				$_street = function_exists('redue_extract_street_address') ? redue_extract_street_address($hay) : '';
				if ( $_street === '' && preg_match('/(?:주소|위치|소재지)?\\s*[:：]?\\s*([가-힣]+(?:특별시|광역시|도|시|군|구)\\s+[가-힣0-9\\s·\\-\\(\\),]+(?:로|길|동|리|가|번지|호|층|관|빌딩|호텔)[가-힣0-9\\s·\\-\\(\\),]*)/u', $hay, $m) ) {
					$_street = trim(preg_replace('/\\s+/u', ' ', $m[1]));
				}
				if ( $_street !== '' ) { $GLOBALS['redue_street'] = $_street; }
			}
			if ( function_exists('redue_extract_official_sameas') ) {
				$_origin = function_exists('redue_site_origin') ? redue_site_origin() : '';
				$_sa = redue_extract_official_sameas($hay, $_origin);
				if ( is_array($_sa) && count($_sa) > 0 ) {
					$_prev = isset($GLOBALS['redue_sameas']) && is_array($GLOBALS['redue_sameas']) ? $GLOBALS['redue_sameas'] : array();
					$GLOBALS['redue_sameas'] = function_exists('redue_normalize_sameas_list')
						? redue_normalize_sameas_list(array_merge($_prev, $_sa), $_origin)
						: array_values(array_unique(array_merge($_prev, $_sa)));
				}
			}
		}
	}
`;
}

/**
 * v33 shared PHP helpers used by every head.sub.php engine (universal / automated / hybrid).
 * Telephone, Korean street address, img alt, title length, JSON-LD graph patch.
 */
export function buildUniversalSeoRuntimeHelpersPhp(): string {
	return `	if ( ! function_exists( 'redue_detect_site_protocol' ) ) {
		function redue_detect_site_protocol() {
			if ( defined('G5_URL') && is_string(G5_URL) && preg_match('#^(https?)://#i', G5_URL, $m) ) {
				return strtolower($m[1]);
			}
			if ( function_exists('home_url') ) {
				$_home = home_url('/');
				if ( is_string($_home) && preg_match('#^(https?)://#i', $_home, $m) ) {
					return strtolower($m[1]);
				}
			}
			if ( ! empty($_SERVER['HTTP_X_FORWARDED_PROTO']) ) {
				$_fwd = strtolower(trim((string) $_SERVER['HTTP_X_FORWARDED_PROTO']));
				if ( $_fwd === 'https' || $_fwd === 'http' ) { return $_fwd; }
			}
			if ( ! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' && $_SERVER['HTTPS'] !== '0' ) {
				return 'https';
			}
			if ( isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443' ) {
				return 'https';
			}
			if ( ! empty($_SERVER['REQUEST_SCHEME']) && strtolower((string) $_SERVER['REQUEST_SCHEME']) === 'https' ) {
				return 'https';
			}
			return 'http';
		}
	}
	if ( ! function_exists( 'redue_site_origin' ) ) {
		function redue_site_origin() {
			$proto = redue_detect_site_protocol();
			if ( defined('G5_URL') && G5_URL !== '' ) {
				return preg_replace('#^https?://#i', $proto . '://', rtrim(G5_URL, '/'));
			}
			$host = '';
			if ( ! empty($_SERVER['HTTP_HOST']) ) { $host = (string) $_SERVER['HTTP_HOST']; }
			elseif ( ! empty($_SERVER['SERVER_NAME']) ) { $host = (string) $_SERVER['SERVER_NAME']; }
			if ( $host === '' ) { $host = 'localhost'; }
			$host = preg_replace('#^https?://#i', '', $host);
			return $proto . '://' . $host;
		}
	}
	if ( ! function_exists( 'redue_align_url_protocol' ) ) {
		function redue_align_url_protocol( $url ) {
			if ( ! is_string($url) || $url === '' ) { return $url; }
			if ( ! preg_match('#^https?://#i', $url) ) { return $url; }
			return preg_replace('#^https?://#i', redue_detect_site_protocol() . '://', $url);
		}
	}
	if ( ! function_exists( 'redue_is_own_site_url' ) ) {
		function redue_is_own_site_url( $url, $origin ) {
			$uh = parse_url($url, PHP_URL_HOST);
			$oh = parse_url($origin, PHP_URL_HOST);
			if ( ! is_string($uh) || ! is_string($oh) || $uh === '' || $oh === '' ) { return false; }
			$uh = preg_replace('#^www\\.#i', '', strtolower($uh));
			$oh = preg_replace('#^www\\.#i', '', strtolower($oh));
			return $uh === $oh;
		}
	}
	if ( ! function_exists( 'redue_plain_text' ) ) {
		function redue_plain_text( $html ) {
			$plain = preg_replace('/<script\\b[^>]*>[\\s\\S]*?<\\/script>/i', ' ', is_string($html) ? $html : '');
			$plain = preg_replace('/<style\\b[^>]*>[\\s\\S]*?<\\/style>/i', ' ', is_string($plain) ? $plain : '');
			$plain = html_entity_decode(strip_tags(is_string($plain) ? $plain : ''), ENT_QUOTES, 'UTF-8');
			return is_string($plain) ? trim(preg_replace('/\\s+/u', ' ', $plain)) : '';
		}
	}
${buildTelephoneRuntimeHelpersPhp()}
	if ( ! function_exists( 'redue_extract_street_address' ) ) {
		function redue_extract_street_address( $text ) {
			if ( ! is_string($text) || $text === '' ) { return ''; }
			if ( preg_match('${KR_STREET_ADDRESS_RE_PHP}', $text, $m) ) {
				$_hit = trim( ! empty($m[1]) ? $m[1] : $m[0] );
				$_hit = preg_replace('/^(?:주소|위치|ADDRESS|소재지)\\s*[:：]?\\s*/u', '', is_string($_hit) ? $_hit : '');
				if ( is_string($_hit) && $_hit !== '' && preg_match('/' . preg_quote($_hit, '/') . '\\s+(\\d[\\d-]{0,8}(?:\\s*[가-힣\\d호층동번지]+)?)/u', $text, $_num) ) {
					$_hit = trim($_hit) . ' ' . trim($_num[1]);
				}
				return trim(preg_replace('/\\s+/u', ' ', is_string($_hit) ? $_hit : ''));
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_read_php_plain' ) ) {
		function redue_read_php_plain( $path ) {
			if ( ! is_string($path) || $path === '' || ! is_file($path) ) { return ''; }
			$raw = @file_get_contents($path);
			if ( ! is_string($raw) || $raw === '' ) { return ''; }
			return function_exists('redue_plain_text') ? redue_plain_text($raw) : trim(strip_tags($raw));
		}
	}
	if ( ! function_exists( 'redue_scan_site_file_corpus' ) ) {
		function redue_scan_site_file_corpus() {
			static $cached = null;
			if ( is_string($cached) ) { return $cached; }
			$blob = '';
			$paths = array();
			if ( defined('G5_THEME_PATH') && G5_THEME_PATH ) {
				$paths[] = G5_THEME_PATH . '/tail.php';
				$paths[] = G5_THEME_PATH . '/tail.sub.php';
				$paths[] = G5_THEME_PATH . '/head.php';
			}
			if ( defined('G5_PATH') && G5_PATH ) {
				$paths[] = G5_PATH . '/tail.php';
				$paths[] = G5_PATH . '/tail.sub.php';
			}
			if ( defined('G5_DATA_PATH') && G5_DATA_PATH && is_dir(G5_DATA_PATH . '/content') ) {
				$_files = @glob(G5_DATA_PATH . '/content/*');
				if ( is_array($_files) ) {
					foreach ( $_files as $_cf ) {
						if ( is_file($_cf) ) { $paths[] = $_cf; }
					}
				}
			}
			foreach ( $paths as $_p ) {
				$blob .= ' ' . redue_read_php_plain($_p);
			}
			if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
				foreach ( array('cf_title', 'cf_tel', 'cf_phone', 'cf_admin_name', 'cf_add_script', 'cf_add_meta', 'cf_analytics', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
					if ( ! empty($GLOBALS['config'][$_ck]) && is_string($GLOBALS['config'][$_ck]) ) {
						$blob .= ' ' . $GLOBALS['config'][$_ck];
					}
				}
			}
			$cached = trim(preg_replace('/\\s+/u', ' ', $blob));
			return $cached;
		}
	}
	if ( ! function_exists( 'redue_extract_fax' ) ) {
		function redue_extract_fax( $text ) {
			if ( ! is_string($text) || $text === '' ) { return ''; }
			if ( preg_match('/(?:FAX|Fax|팩스)\\s*[:：]?\\s*((?:0\\d{1,2}|070)[-\\s.]?\\d{3,4}[-\\s.]?\\d{4})/u', $text, $m) ) {
				return function_exists('redue_format_telephone') ? redue_format_telephone($m[1]) : trim($m[1]);
			}
			return '';
		}
	}
	if ( ! function_exists( 'redue_extract_tax_id' ) ) {
		function redue_extract_tax_id( $text ) {
			if ( ! is_string($text) || $text === '' ) { return ''; }
			if ( preg_match('/(?:사업자\\s*등록\\s*번호|사업자번호|사업자)\\s*[:：]?\\s*(\\d{3}-\\d{2}-\\d{5}|\\d{10})/u', $text, $m) ) {
				return trim($m[1]);
			}
			return '';
		}
	}
${buildFooterAutoDetectPhp()}
	if ( ! function_exists( 'redue_is_shop_context' ) ) {
		function redue_is_shop_context() {
			return ( defined('_SHOP_') && _SHOP_ ) || ( defined('G5_USE_SHOP') && G5_USE_SHOP );
		}
	}
	if ( ! function_exists( 'redue_industry_haystack' ) ) {
		function redue_industry_haystack() {
			$hay = '';
			if ( isset($GLOBALS['config']) && is_array($GLOBALS['config']) ) {
				foreach ( array('cf_title', 'cf_1', 'cf_2', 'cf_3', 'cf_add_meta') as $_ck ) {
					if ( ! empty($GLOBALS['config'][$_ck]) && is_string($GLOBALS['config'][$_ck]) ) {
						$hay .= ' ' . $GLOBALS['config'][$_ck];
					}
				}
			}
			if ( isset($GLOBALS['g5_head_title']) && is_string($GLOBALS['g5_head_title']) ) {
				$hay .= ' ' . $GLOBALS['g5_head_title'];
			}
			if ( function_exists('redue_scan_site_file_corpus') ) {
				$hay .= ' ' . redue_scan_site_file_corpus();
			}
			return trim(preg_replace('/\\s+/u', ' ', $hay));
		}
	}
	if ( ! function_exists( 'redue_sanitize_org_types' ) ) {
		function redue_sanitize_org_types( $types ) {
			$out = array();
			if ( is_string($types) && trim($types) !== '' ) { $types = array($types); }
			if ( ! is_array($types) ) { return $out; }
			foreach ( $types as $t ) {
				$t = trim((string) $t);
				if ( $t === '' || in_array($t, $out, true) ) { continue; }
				$out[] = $t;
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_infer_org_types' ) ) {
		function redue_infer_org_types() {
			if ( function_exists('redue_is_shop_context') && redue_is_shop_context() ) {
				return array('OnlineStore', 'Store', 'LocalBusiness');
			}
			$hay = function_exists('redue_industry_haystack') ? redue_industry_haystack() : '';
			$seed = isset($GLOBALS['redue_org_type']) ? redue_sanitize_org_types($GLOBALS['redue_org_type']) : array();
			$live_medical = (bool) preg_match('/병원|의원|클리닉|치과|한의|의료|진료|암치료|physician|clinic|hospital|dentist|veterinary|동물병원|수의사/iu', $hay);
			$live_edu = (bool) preg_match('/학원|교육기관|과외|입시|보습|학교|academy|tutoring|hagwon/iu', $hay);
			if ( $live_medical ) {
				if ( preg_match('/동물병원|수의사|veterinary|VeterinaryCare/iu', $hay) ) {
					return array('VeterinaryCare', 'LocalBusiness');
				}
				if ( preg_match('/치과|dentist|Dentist/iu', $hay) ) {
					return array('Dentist', 'MedicalClinic', 'LocalBusiness');
				}
				return array('MedicalClinic', 'Physician', 'LocalBusiness');
			}
			if ( preg_match('/법률|법무|변호사|attorney|law\\s*firm/iu', $hay) ) {
				return array('LegalService', 'LocalBusiness', 'Organization');
			}
			if ( preg_match('/세무|회계|노무|accounting|bookkeep/iu', $hay) ) {
				return array('AccountingService', 'LocalBusiness', 'Organization');
			}
			if ( $live_edu ) {
				return array('EducationalOrganization', 'LocalBusiness', 'Organization');
			}
			if ( preg_match('/쇼핑몰|스토어|온라인몰|커머스|영카트|youngcart|ecommerce|e-commerce/iu', $hay) ) {
				return array('OnlineStore', 'Store', 'LocalBusiness');
			}
			if ( count($seed) > 0 ) {
				$filtered = array();
				foreach ( $seed as $t ) {
					if ( preg_match('/MedicalClinic|VeterinaryCare|Physician|Hospital|Dentist/i', $t) && $hay !== '' && ! $live_medical ) { continue; }
					if ( $t === 'EducationalOrganization' && $hay !== '' && ! $live_edu ) { continue; }
					$filtered[] = $t;
				}
				if ( count($filtered) > 0 ) { return $filtered; }
			}
			return array('LocalBusiness', 'Organization');
		}
	}
	if ( ! function_exists( 'redue_is_medical_org' ) ) {
		function redue_is_medical_org() {
			$hay = '';
			$types = function_exists('redue_infer_org_types') ? redue_infer_org_types() : ( isset($GLOBALS['redue_org_type']) ? $GLOBALS['redue_org_type'] : array() );
			$hay .= is_array($types) ? implode(' ', $types) : (string) $types;
			if ( isset($GLOBALS['config']['cf_title']) ) { $hay .= ' ' . $GLOBALS['config']['cf_title']; }
			return (bool) preg_match('/MedicalClinic|VeterinaryCare|Physician|Hospital|Dentist|병원|의원|클리닉|치과|한의|의료|암치료|진료/iu', $hay);
		}
	}
	if ( ! function_exists( 'redue_is_nav_dump_description' ) ) {
		function redue_is_nav_dump_description( $text, $gnb_items = array() ) {
			$plain = trim(preg_replace('/\\s+/u', ' ', (string) $text));
			if ( $plain === '' ) { return true; }
			$names = array();
			if ( is_array($gnb_items) ) {
				foreach ( $gnb_items as $_g ) {
					if ( is_array($_g) && ! empty($_g['name']) ) { $names[] = trim((string) $_g['name']); }
				}
			}
			if ( count($names) >= 3 ) {
				$hits = 0;
				foreach ( $names as $_n ) {
					if ( $_n === '' ) { continue; }
					if ( function_exists('mb_strpos') ? mb_strpos($plain, $_n) !== false : strpos($plain, $_n) !== false ) { $hits++; }
				}
				if ( $hits >= 3 && $hits >= ( count($names) * 0.5 ) ) { return true; }
			}
			$_tokens = preg_split('/[\\s|\\/>·•,\\/]+/u', $plain);
			if ( is_array($_tokens) && count($_tokens) >= 6 ) {
				$_short = 0;
				$_total = 0;
				foreach ( $_tokens as $_t ) {
					if ( $_t === '' ) { continue; }
					$_total++;
					$_len = function_exists('mb_strlen') ? mb_strlen($_t, 'UTF-8') : strlen($_t);
					if ( $_len <= 6 ) { $_short++; }
				}
				if ( $_total > 0 && ( $_short / $_total ) >= 0.85 ) { return true; }
			}
			return false;
		}
	}
	if ( ! function_exists( 'redue_compose_official_description' ) ) {
		function redue_compose_official_description( $site_name, $page_title, $is_main = false ) {
			$site = trim(strip_tags((string) $site_name));
			$page = trim(strip_tags((string) $page_title));
			if ( $site === '' ) { $site = '웹사이트'; }
			if ( $is_main || $page === '' || $page === $site ) {
				return $site . ' 공식 웹사이트입니다.';
			}
			$page = preg_replace('/\\s*[|\\-–—]\\s+' . preg_quote($site, '/') . '\\s*$/u', '', $page);
			$page = trim(is_string($page) ? $page : '');
			return $site . ' ' . $page . ' 공식 안내입니다.';
		}
	}
	if ( ! function_exists( 'redue_summarize_body_text' ) ) {
		function redue_summarize_body_text( $text, $max = 140 ) {
			$plain = function_exists('redue_plain_text') ? redue_plain_text($text) : trim(preg_replace('/\\s+/u', ' ', strip_tags((string) $text)));
			$plain = trim(is_string($plain) ? $plain : '');
			if ( $plain === '' ) { return ''; }
			if ( function_exists('mb_substr') ) { return mb_substr($plain, 0, (int) $max, 'UTF-8'); }
			return substr($plain, 0, (int) $max);
		}
	}
	if ( ! function_exists( 'redue_refine_page_description' ) ) {
		function redue_refine_page_description( $desc, $site_name, $page_title, $is_main, $gnb_items = array() ) {
			$desc = trim((string) $desc);
			if ( $desc === '' || ( function_exists('redue_is_nav_dump_description') && redue_is_nav_dump_description($desc, $gnb_items) ) ) {
				return function_exists('redue_compose_official_description')
					? redue_compose_official_description($site_name, $page_title, $is_main)
					: trim((string) $site_name);
			}
			return $desc;
		}
	}
	/* Checklist 16/17: subpages keep a single @type; the homepage uses an industry
	 * composite (e.g. MedicalWebPage+AboutPage+WebPage) so AI crawlers see both
	 * the entity page and the about/service surface. */
	if ( ! function_exists( 'redue_composite_page_types' ) ) {
		function redue_composite_page_types( $is_main, $current_types = null, $is_about = false ) {
			if ( $is_main ) {
				$is_medical = function_exists('redue_is_medical_org') && redue_is_medical_org();
				if ( $is_medical ) {
					return array('MedicalWebPage', 'AboutPage', 'WebPage');
				}
				return array('AboutPage', 'WebPage');
			}
			if ( $is_about ) {
				return 'AboutPage';
			}
			$types = array();
			if ( is_array($current_types) ) { $types = $current_types; }
			elseif ( is_string($current_types) && $current_types !== '' ) { $types = array($current_types); }
			foreach ( $types as $t ) {
				if ( is_string($t) && $t !== '' && $t !== 'WebPage' ) { return $t; }
			}
			return count($types) > 0 && is_string($types[0]) && $types[0] !== '' ? $types[0] : 'WebPage';
		}
	}
	if ( ! function_exists( 'redue_infer_kr_address_parts' ) ) {
		function redue_infer_kr_address_parts( $text ) {
			$out = array( 'region' => '', 'locality' => '' );
			if ( ! is_string($text) || $text === '' ) { return $out; }
			if ( preg_match('/(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|제주특별자치도|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|서울시|부산시|대구시|인천시|광주시|대전시|울산시|세종시|제주시|서울|부산|대구|인천|광주|대전|울산|세종|제주|경기|강원)/u', $text, $m) ) {
				$raw = $m[1];
				$map = array( '서울특별시' => '서울', '서울시' => '서울', '부산광역시' => '부산', '부산시' => '부산', '대구광역시' => '대구', '대구시' => '대구', '인천광역시' => '인천', '인천시' => '인천', '광주광역시' => '광주', '대전광역시' => '대전', '대전시' => '대전', '울산광역시' => '울산', '울산시' => '울산', '세종특별자치시' => '세종', '세종시' => '세종', '제주특별자치도' => '제주', '제주시' => '제주', '경기도' => '경기', '강원도' => '강원', '충청북도' => '충북', '충청남도' => '충남', '전라북도' => '전북', '전라남도' => '전남', '경상북도' => '경북', '경상남도' => '경남' );
				$out['region'] = isset($map[$raw]) ? $map[$raw] : $raw;
			}
			if ( preg_match('/(강남|서초|송파|마포|강서|관악|영등포|노원|종로|용산|성동|광진|은평|양천|구로|금천|동작|중랑|성북|강북|도봉|강동)구?/u', $text, $lm) ) {
				$stem = preg_replace('/구$/', '', $lm[1]);
				$out['locality'] = $stem . '구';
				if ( $out['region'] === '' ) { $out['region'] = '서울'; }
			} elseif ( preg_match('/([가-힣]{1,8}(?:시|군|구))/u', $text, $lm2) ) {
				$out['locality'] = $lm2[1];
			}
			return $out;
		}
	}
	if ( ! function_exists( 'redue_complete_postal_address' ) ) {
		function redue_complete_postal_address( $addr, $site_name = '', $domain_host = '', $street = '', $locality = '', $region = '' ) {
			if ( ! is_array($addr) ) { $addr = array(); }
			$addr['@type'] = 'PostalAddress';
			$addr['addressCountry'] = 'KR';
			$blob = trim( implode( ' ', array_filter( array(
				isset($addr['streetAddress']) ? (string) $addr['streetAddress'] : '',
				is_string($street) ? $street : '',
				is_string($locality) ? $locality : '',
				is_string($region) ? $region : '',
			) ) ) );
			$parts = function_exists('redue_infer_kr_address_parts') ? redue_infer_kr_address_parts($blob) : array( 'region' => '', 'locality' => '' );
			if ( empty($addr['streetAddress']) && is_string($street) && trim($street) !== '' ) { $addr['streetAddress'] = trim($street); }
			if ( empty($addr['addressLocality']) && is_string($locality) && trim($locality) !== '' ) { $addr['addressLocality'] = trim($locality); }
			if ( empty($addr['addressRegion']) && is_string($region) && trim($region) !== '' ) { $addr['addressRegion'] = trim($region); }
			if ( empty($addr['addressLocality']) && ! empty($parts['locality']) ) { $addr['addressLocality'] = $parts['locality']; }
			if ( empty($addr['addressRegion']) && ! empty($parts['region']) ) { $addr['addressRegion'] = $parts['region']; }
			if ( empty($addr['streetAddress']) && empty($addr['addressLocality']) && empty($addr['addressRegion']) ) {
				return array( '@type' => 'PostalAddress', 'addressCountry' => 'KR' );
			}
			return $addr;
		}
	}
	if ( ! function_exists( 'redue_infer_page_schema_type' ) ) {
		function redue_infer_page_schema_type( $hay, $is_medical = false ) {
			$h = is_string($hay) ? $hay : '';
			if ( preg_match('/wr_id=/i', $h) ) { return 'Article'; }
			if ( ( preg_match('/board\\.php/i', $h) && preg_match('/bo_table=/i', $h) ) || preg_match('/[?&]bo_table=/i', $h) ) { return 'CollectionPage'; }
			if ( preg_match('/content\\.php|[?&]co_id=/i', $h) ) { return 'AboutPage'; }
			if ( preg_match('/의료진|프로필|원장진|전문의|강사진|임원|doctor|staff|\\bteam\\b|의료\\s*진/ui', $h) ) { return 'ProfilePage'; }
			if ( preg_match('/연락처|문의|오시는|찾아오시는|견적|상담|지점|contact|location|map\\.php/ui', $h) ) { return 'ContactPage'; }
			if ( preg_match('/소개|인사말|시설|장비|둘러보기|철학|연혁|about|company|greeting|조직도|개요|facility|equipment/ui', $h) ) { return 'AboutPage'; }
			if ( $is_medical && preg_match('/진료|수술|시술|치료|질환|암종|암치료|서비스/ui', $h) && ! preg_match('/서비스\\s*소개/ui', $h) ) { return 'MedicalWebPage'; }
			if ( $is_medical && preg_match('/(?:^|[\\/\\\\])((?:ultra|s|sub|page)?\\d{2,}|[a-z]{1,12}\\d{2,})\\.php/i', $h) ) {
				return 'MedicalWebPage';
			}
			return 'WebPage';
		}
	}
	if ( ! function_exists( 'redue_resolve_site_name' ) ) {
		function redue_resolve_site_name() {
			if ( isset($GLOBALS['config']['cf_title']) && is_string($GLOBALS['config']['cf_title']) && trim($GLOBALS['config']['cf_title']) !== '' ) {
				return trim(strip_tags($GLOBALS['config']['cf_title']));
			}
			if ( function_exists('get_bloginfo') ) {
				$_wp = get_bloginfo('name');
				if ( is_string($_wp) && trim($_wp) !== '' ) { return trim(strip_tags($_wp)); }
			}
			if ( isset($GLOBALS['g5']['title']) && is_string($GLOBALS['g5']['title']) && trim($GLOBALS['g5']['title']) !== '' ) {
				return trim(strip_tags($GLOBALS['g5']['title']));
			}
			if ( isset($GLOBALS['g5_head_title']) && is_string($GLOBALS['g5_head_title']) && trim($GLOBALS['g5_head_title']) !== '' ) {
				return trim(strip_tags($GLOBALS['g5_head_title']));
			}
			if ( class_exists('Context') && method_exists('Context', 'get') ) {
				$_rx = @Context::get('site_title');
				if ( is_string($_rx) && trim($_rx) !== '' ) { return trim(strip_tags($_rx)); }
				$_rx = @Context::get('site_module_info');
				if ( is_object($_rx) && ! empty($_rx->browser_title) ) { return trim(strip_tags((string) $_rx->browser_title)); }
			}
			$_host = '';
			if ( ! empty($_SERVER['HTTP_HOST']) ) { $_host = (string) $_SERVER['HTTP_HOST']; }
			elseif ( ! empty($_SERVER['SERVER_NAME']) ) { $_host = (string) $_SERVER['SERVER_NAME']; }
			$_host = preg_replace('#^https?://#i', '', $_host);
			$_host = preg_replace('#:\\d+$#', '', $_host);
			return $_host !== '' ? $_host : '웹사이트';
		}
	}
${buildImageRepSemanticsPhp()}
	if ( ! function_exists( 'redue_resolve_rep_identity' ) ) {
		function redue_resolve_rep_identity() {
			$name = '';
			$title = '';
			if ( isset($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) ) {
				$name = trim($GLOBALS['redue_rep_name']);
			}
			if ( isset($GLOBALS['redue_rep_title']) && is_string($GLOBALS['redue_rep_title']) ) {
				$title = function_exists('redue_normalize_rep_title') ? redue_normalize_rep_title($GLOBALS['redue_rep_title']) : trim($GLOBALS['redue_rep_title']);
			}
			if ( $name === '' && isset($GLOBALS['config']['cf_admin_name']) && is_string($GLOBALS['config']['cf_admin_name']) ) {
				$_admin = trim(strip_tags($GLOBALS['config']['cf_admin_name']));
				if ( $_admin !== '' && function_exists('redue_is_valid_rep_name') && redue_is_valid_rep_name($_admin) ) {
					$name = $_admin;
				} elseif ( $_admin !== '' && preg_match('/^[가-힣]{2,4}$/u', $_admin) ) {
					$name = $_admin;
				}
			}
			if ( $name === '' || $title === '' ) {
				$blob = function_exists('redue_scan_site_file_corpus') ? redue_scan_site_file_corpus() : '';
				$hit = function_exists('redue_parse_rep_from_text') ? redue_parse_rep_from_text($blob) : null;
				if ( is_array($hit) ) {
					if ( $name === '' && ! empty($hit['name']) ) { $name = (string) $hit['name']; }
					if ( $title === '' && ! empty($hit['title']) ) { $title = (string) $hit['title']; }
				}
			}
			return array('name' => $name, 'title' => $title);
		}
	}
	if ( ! function_exists( 'redue_img_alt_from_src' ) ) {
		function redue_img_alt_from_src( $src, $site_name, $page_name ) {
			$path = preg_replace('/[?#].*$/', '', (string) $src);
			$base = basename(str_replace('\\\\', '/', $path));
			$stem = preg_replace('/\\.[a-z0-9]+$/i', '', $base);
			$stem = is_string($stem) ? $stem : '';
			$decoded = $stem;
			if ( function_exists('rawurldecode') ) {
				$try = @rawurldecode($stem);
				if ( is_string($try) && $try !== '' ) { $decoded = $try; }
			}
			if ( preg_match('/logo|로고/i', $decoded) ) {
				return $site_name . ' 로고';
			}
			if ( preg_match('/^(sub\\d+|s?\\d{2,4})(_\\d+)?$/i', $decoded) || preg_match('/banner|visual|main[_-]?img|bg[_-]?/i', $decoded) ) {
				return ($page_name !== '' ? $page_name : $site_name) . ' 안내 이미지';
			}
			$label = trim(preg_replace('/[-_]+/', ' ', $decoded));
			if ( $label !== '' && ! preg_match('/^[a-z0-9]{1,3}$/i', $label) && function_exists('mb_strlen') && mb_strlen($label, 'UTF-8') >= 2 ) {
				return $site_name . ' ' . $label . ' 이미지';
			}
			return trim($site_name . ' ' . $page_name . ' 안내 이미지');
		}
	}
	if ( ! function_exists( 'redue_transform_img_alts' ) ) {
		function redue_transform_img_alts( $buffer, $site_name, $page_name ) {
			if ( ! is_string($buffer) || $buffer === '' ) { return $buffer; }
			if ( ! preg_match_all('/<img\\b([^>]*?)(\\/?)>/i', $buffer, $all, PREG_SET_ORDER | PREG_OFFSET_CAPTURE) ) {
				return $buffer;
			}
			$out = '';
			$last = 0;
			foreach ( $all as $m ) {
				$full = $m[0][0];
				$pos = (int) $m[0][1];
				$attrs = $m[1][0];
				$slash = $m[2][0];
				$out .= substr($buffer, $last, $pos - $last);
				$existing = '';
				if ( preg_match('/\\balt\\s*=\\s*(["\\'])([^"\\']*)\\1/i', $attrs, $am) ) {
					$existing = trim($am[2]);
				}
				if ( $existing !== '' ) {
					if ( function_exists('redue_parse_rep_from_text') && function_exists('redue_bind_rep_globals') ) {
						$exist_hit = redue_parse_rep_from_text($existing);
						if ( is_array($exist_hit) ) { redue_bind_rep_globals($exist_hit['name'], $exist_hit['title']); }
					}
					$out .= $full;
					$last = $pos + strlen($full);
					continue;
				}
				$src = '';
				if ( preg_match('/\\bsrc\\s*=\\s*(["\\'])([^"\\']*)\\1/i', $attrs, $sm) ) { $src = $sm[2]; }
				$title = '';
				if ( preg_match('/\\btitle\\s*=\\s*(["\\'])([^"\\']+)\\1/i', $attrs, $tm) ) {
					$title = trim($tm[2]);
				} elseif ( preg_match('/\\baria-label\\s*=\\s*(["\\'])([^"\\']+)\\1/i', $attrs, $tm) ) {
					$title = trim($tm[2]);
				}
				$alt = '';
				$rep_hit = null;
				if ( function_exists('redue_extract_nearby_rep') ) {
					$rep_hit = redue_extract_nearby_rep($buffer, $pos);
				}
				if ( ! is_array($rep_hit) && $title !== '' && function_exists('redue_parse_rep_from_text') ) {
					$rep_hit = redue_parse_rep_from_text($title);
				}
				if ( ! is_array($rep_hit) && $src !== '' && function_exists('redue_parse_rep_from_filename') ) {
					$rep_hit = redue_parse_rep_from_filename($src);
				}
				if ( is_array($rep_hit) && ! empty($rep_hit['name']) ) {
					if ( function_exists('redue_bind_rep_globals') ) {
						redue_bind_rep_globals($rep_hit['name'], isset($rep_hit['title']) ? $rep_hit['title'] : '');
					}
					$alt = function_exists('redue_compose_rep_img_alt')
						? redue_compose_rep_img_alt($site_name, $rep_hit['name'], isset($rep_hit['title']) ? $rep_hit['title'] : '')
						: trim($site_name . ' ' . $rep_hit['name'] . ' ' . (isset($rep_hit['title']) ? $rep_hit['title'] : ''));
				}
				if ( $alt === '' && $title !== '' ) { $alt = $title; }
				if ( $alt === '' && ! empty($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) && preg_match('/sign|ceo|director|rep|원장|대표/i', $src) ) {
					$alt = function_exists('redue_compose_rep_img_alt')
						? redue_compose_rep_img_alt($site_name, $GLOBALS['redue_rep_name'], isset($GLOBALS['redue_rep_title']) ? $GLOBALS['redue_rep_title'] : '')
						: trim($site_name . ' ' . $GLOBALS['redue_rep_name']);
				}
				if ( $alt === '' ) { $alt = redue_img_alt_from_src($src, $site_name, $page_name); }
				$alt = trim($alt);
				if ( $alt === '' ) { $alt = $site_name . ' 이미지'; }
				$alt_esc = htmlspecialchars($alt, ENT_QUOTES, 'UTF-8');
				if ( preg_match('/\\balt\\s*=\\s*(["\\'])[^"\\']*\\1/i', $attrs) ) {
					$attrs = preg_replace('/\\balt\\s*=\\s*(["\\'])[^"\\']*\\1/i', 'alt="' . $alt_esc . '"', $attrs, 1);
				} elseif ( preg_match('/\\balt\\s*=/i', $attrs) ) {
					$attrs = preg_replace('/\\balt\\s*=\\s*[^\\s>]*/i', 'alt="' . $alt_esc . '"', $attrs, 1);
				} else {
					$attrs = rtrim($attrs) . ' alt="' . $alt_esc . '"';
				}
				$out .= '<img' . $attrs . $slash . '>';
				$last = $pos + strlen($full);
			}
			$out .= substr($buffer, $last);
			return $out;
		}
	}
	if ( ! function_exists( 'redue_optimize_document_title' ) ) {
		function redue_optimize_document_title( $buffer, $site_name, $page_name, $is_main ) {
			$has_title = preg_match('/<title\\b[^>]*>([\\s\\S]*?)<\\/title>/i', $buffer, $tm);
			$current = $has_title ? trim(html_entity_decode(strip_tags($tm[1]), ENT_QUOTES, 'UTF-8')) : '';
			$len = function_exists('mb_strlen') ? mb_strlen($current, 'UTF-8') : strlen($current);
			if ( $len >= 10 && $len <= 60 ) { return $buffer; }
			if ( $len < 10 ) {
				if ( $is_main ) {
					$new = $site_name . ' — 공식 안내 및 전문 서비스';
				} else {
					$page = ( $page_name !== '' && $page_name !== $site_name ) ? $page_name : '안내';
					$new = $page . ' | ' . $site_name . ' 공식';
				}
				$new_len_soft = function_exists('mb_strlen') ? mb_strlen($new, 'UTF-8') : strlen($new);
				if ( $new_len_soft > 35 ) {
					$new = function_exists('mb_substr') ? mb_substr($new, 0, 35, 'UTF-8') : substr($new, 0, 35);
				}
			} else {
				$new = $current;
			}
			$new_len = function_exists('mb_strlen') ? mb_strlen($new, 'UTF-8') : strlen($new);
			if ( $new_len > 60 ) {
				$new = function_exists('mb_substr') ? mb_substr($new, 0, 60, 'UTF-8') : substr($new, 0, 60);
			}
			$new_esc = htmlspecialchars(trim($new), ENT_QUOTES, 'UTF-8');
			if ( $has_title ) {
				return preg_replace('/<title\\b[^>]*>[\\s\\S]*?<\\/title>/i', '<title>' . $new_esc . '</title>', $buffer, 1);
			}
			if ( preg_match('/(<head\\b[^>]*>)/i', $buffer) ) {
				return preg_replace('/(<head\\b[^>]*>)/i', '$1<title>' . $new_esc . '</title>', $buffer, 1);
			}
			return $buffer;
		}
	}
	if ( ! function_exists( 'redue_echo_canonical_pair' ) ) {
		function redue_echo_canonical_pair() {
			static $done = false;
			if ( $done ) { return; }
			$url = '';
			if ( function_exists('redue_get_exact_canonical') ) {
				$url = redue_get_exact_canonical();
			} elseif ( isset($GLOBALS['exact_canonical_url']) && is_string($GLOBALS['exact_canonical_url']) ) {
				$url = $GLOBALS['exact_canonical_url'];
			} elseif ( isset($GLOBALS['redue_canonical_url']) && is_string($GLOBALS['redue_canonical_url']) ) {
				$url = $GLOBALS['redue_canonical_url'];
			}
			if ( ! is_string($url) || $url === '' ) { return; }
			$done = true;
			$esc = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
			$origin = preg_replace('#^(https?://[^/]+).*#', '$1', $url);
			if ( ! is_string($origin) || $origin === '' ) { $origin = $url; }
			$llms_href = htmlspecialchars(rtrim($origin, '/') . '/llms.txt', ENT_QUOTES, 'UTF-8');
			$rss_href = htmlspecialchars(rtrim($origin, '/') . '/rss.php', ENT_QUOTES, 'UTF-8');
			echo '<!-- REDUE v30 PRECISION SEO START — SEO Standard Canonical Pair (Bot Optimized Top Position) -->' . "\\n";
			echo '<link rel="canonical" href="' . $esc . '">' . "\\n";
			echo '<meta property="og:url" content="' . $esc . '">' . "\\n";
			echo '<link rel="help" type="text/markdown" href="' . $llms_href . '" title="LLMs Context">' . "\\n";
			echo '<link rel="alternate" type="text/markdown" href="' . $llms_href . '">' . "\\n";
			echo '<link rel="alternate" type="application/rss+xml" title="RSS 2.0" href="' . $rss_href . '">' . "\\n";
			if ( isset($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) && trim($GLOBALS['redue_rep_name']) !== '' ) {
				$rep_esc = htmlspecialchars(trim($GLOBALS['redue_rep_name']), ENT_QUOTES, 'UTF-8');
				echo '<meta name="author" content="' . $rep_esc . '">' . "\\n";
				echo '<meta name="representative" content="' . $rep_esc . '">' . "\\n";
			}
			echo '<!-- REDUE v30 PRECISION SEO END -->' . "\\n";
		}
	}
${buildEvidenceFaqHowToHelpersPhp()}
${buildUniversalGraphRuntimeHelpersPhp()}
	if ( ! function_exists( 'redue_strip_duplicate_canonicals' ) ) {
		function redue_strip_duplicate_canonicals( $buffer ) {
			$buffer = preg_replace('/<link\\b(?=[^>]*\\brel\\s*=\\s*["\\']?canonical["\\']?)[^>]*>\\s*(?:<\\/link>)?/is', '', $buffer);
			$buffer = preg_replace('/<meta\\b(?=[^>]*\\bproperty\\s*=\\s*["\\']og:url["\\'])[^>]*>\\s*/i', '', $buffer);
			$buffer = preg_replace('/^[ \\t]*">[ \\t]*\\r?\\n/m', '', $buffer);
			$buffer = preg_replace('/<!--\\s*REDUE v30 PRECISION SEO START[\\s\\S]*?REDUE v30 PRECISION SEO END\\s*-->\\s*/i', '', $buffer);
			return $buffer;
		}
	}
`;
}

/** Runtime NAP bind from $config + helper extractors — shared by all schema controllers. */
function buildRuntimeNapBindPhp(orgVar = 'org_node', opts?: { inventAddress?: boolean }): string {
	return `
		$_redue_cfg_blob = '';
		if ( isset($config) && is_array($config) ) {
			foreach ( array('cf_tel', 'cf_phone', 'cf_add_script', 'cf_add_meta', 'cf_analytics', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
				if ( ! empty($config[$_ck]) && is_string($config[$_ck]) ) {
					$_redue_cfg_blob .= ' ' . $config[$_ck];
				}
			}
		}
		if ( function_exists('redue_scan_site_file_corpus') ) {
			$_file_blob = redue_scan_site_file_corpus();
			if ( is_string($_file_blob) && $_file_blob !== '' ) { $_redue_cfg_blob .= ' ' . $_file_blob; }
		}
		if ( empty($${orgVar}['telephone']) && function_exists('redue_resolve_universal_telephone') ) {
			$_uni_tel = redue_resolve_universal_telephone('');
			if ( $_uni_tel !== '' ) { $${orgVar}['telephone'] = $_uni_tel; }
		}
		if ( empty($${orgVar}['telephone']) ) {
			if ( function_exists('redue_resolve_cms_telephone') ) {
				$_cms_tel = redue_resolve_cms_telephone();
				if ( $_cms_tel !== '' ) { $${orgVar}['telephone'] = $_cms_tel; }
			}
			if ( empty($${orgVar}['telephone']) && ! empty($config['cf_tel']) && is_string($config['cf_tel']) && trim($config['cf_tel']) !== '' ) {
				$${orgVar}['telephone'] = trim($config['cf_tel']);
			} elseif ( empty($${orgVar}['telephone']) && function_exists('redue_extract_telephone') ) {
				$_tel = redue_extract_telephone($_redue_cfg_blob);
				if ( $_tel !== '' ) { $${orgVar}['telephone'] = $_tel; }
			}
		}
		if ( ! empty($${orgVar}['telephone']) && function_exists('redue_format_telephone') ) {
			$_fmt_tel = redue_format_telephone($${orgVar}['telephone']);
			if ( $_fmt_tel !== '' ) { $${orgVar}['telephone'] = $_fmt_tel; }
		}
		$_has_street = isset($${orgVar}['address']) && is_array($${orgVar}['address']) && ! empty($${orgVar}['address']['streetAddress']);
		if ( ! $_has_street && function_exists('redue_extract_street_address') ) {
			$_addr = redue_extract_street_address($_redue_cfg_blob);
			if ( $_addr !== '' ) {
				$${orgVar}['address'] = array(
					'@type' => 'PostalAddress',
					'streetAddress' => $_addr,
					'addressCountry' => 'KR',
				);
			}
		}
${buildForceCompleteNapPhp(orgVar, { inventAddress: opts?.inventAddress })}
`;
}

export function buildUniversalObRegistrationPhp(): string {
	return `if ( ! defined('REDUE_UNIVERSAL_ENGINE_ACTIVE') ) {
	define('REDUE_UNIVERSAL_ENGINE_ACTIVE', true);

${buildUniversalSeoRuntimeHelpersPhp()}
	// 1. 그누보드 전역변수 기반 동적 Canonical URL 추출 (수동 정제)
	//    path가 / 이어도 $_GET(bo_table 등)이 있으면 서브/게시판 — /index.php 단독은 / 로 정제
	//    REQUEST_URI + SCRIPT_NAME 이중 감지로 진단봇 경로 유실 복구
	if ( ! function_exists( 'redue_get_exact_canonical' ) ) {
		function redue_get_exact_canonical() {
			// 0) 실제 작동 프로토콜만 사용 — SSL 미설치 사이트에 https:// 강제 금지 (Mixed Content 방지)
			$site_domain = function_exists('redue_site_origin') ? redue_site_origin() : '';
			if ( $site_domain === '' ) {
				$proto = function_exists('redue_detect_site_protocol') ? redue_detect_site_protocol() : 'http';
				$host = '';
				if ( ! empty($_SERVER['HTTP_HOST']) ) { $host = (string) $_SERVER['HTTP_HOST']; }
				elseif ( ! empty($_SERVER['SERVER_NAME']) ) { $host = (string) $_SERVER['SERVER_NAME']; }
				if ( $host === '' ) { $host = 'localhost'; }
				$host = preg_replace('#^https?://#i', '', $host);
				$site_domain = $proto . '://' . $host;
			}

			// 2) 요청 URI 경로 — REQUEST_URI + SCRIPT_NAME 이중 감지 (302.php / 101.php 유실 방지)
			$request_uri = isset($_SERVER['REQUEST_URI']) ? (string)$_SERVER['REQUEST_URI'] : '';
			$parsed_url = $request_uri !== '' ? parse_url($request_uri) : false;
			$page_path = (is_array($parsed_url) && isset($parsed_url['path']) && is_string($parsed_url['path']) && $parsed_url['path'] !== '')
				? $parsed_url['path']
				: '';
			$script_name = isset($_SERVER['SCRIPT_NAME']) ? str_replace('\\\\', '/', (string)$_SERVER['SCRIPT_NAME']) : '';
			if ( ($page_path === '' || $page_path === '/' || $page_path === '/index.php') && $script_name !== '' && $script_name !== '/' && $script_name !== '/index.php' && substr($script_name, -4) === '.php' ) {
				$page_path = $script_name;
			}
			if ( $page_path === '' ) {
				$page_path = '/';
			}

			// 3) 허용 파라미터 정제 (게시판·내용보기·모바일/페이지 등) — $_GET 우선, REQUEST_URI 쿼리 폴백
			$allowed_params = array('bo_table', 'wr_id', 'co_id', 'idx', 'p', 'page_id', 'id');
			$query_string = '';
			$param_src = array();
			if ( ! empty($_GET) && is_array($_GET) ) {
				$param_src = $_GET;
			} else if ( is_array($parsed_url) && ! empty($parsed_url['query']) ) {
				parse_str($parsed_url['query'], $param_src);
			}
			if ( ! empty($param_src) && is_array($param_src) ) {
				$filtered = array();
				foreach ( $allowed_params as $key ) {
					if ( isset($param_src[$key]) && trim((string)$param_src[$key]) !== '' ) {
						$filtered[$key] = trim((string)$param_src[$key]);
					}
				}
				if ( ! empty($filtered) ) {
					$query_string = '?' . http_build_query($filtered);
				}
			}

			// 4) 메인 vs 서브 동적 판단 — path가 /|/index.php 이어도 query 있으면 서브페이지
			if ( ($page_path === '/' || $page_path === '/index.php' || $page_path === '') && $query_string === '' ) {
				$final_canonical = $site_domain . '/';
			} else {
				// index.php 단독 경로는 / 로 정제 (쿼리 유지: /?bo_table=…)
				if ( $page_path === '/index.php' ) {
					$page_path = '/';
				}
				$final_canonical = $site_domain . $page_path . $query_string;
			}
			return function_exists('redue_align_url_protocol') ? redue_align_url_protocol($final_canonical) : $final_canonical;
		}
	}

	// 2. Bind exact URL — 값만 준비하고 즉시 echo 하지 않음(v33). 실제 출력은
	//    redue_dynamic_schema_controller_body() 안에서 charset 메타 태그 직후 렌더링
	//    호출 시점에만 발생하므로, 이 상수 블록이 문서 최상단에 삽입되어도
	//    화면에는 아무 것도 출력되지 않는다 (상단 덤프 방지).
	if ( function_exists('redue_get_exact_canonical') ) {
		$exact_canonical_url = redue_get_exact_canonical();
		$GLOBALS['exact_canonical_url'] = $exact_canonical_url;
		$GLOBALS['redue_canonical_url'] = $exact_canonical_url;
	}
}`;
}

/**
 * PHP fragment: detect Gnuboard news/press boards & subpages, then extract NewsArticle fields
 * from `$bo_table` / `$wr` / `$view` / `$g5_head_title` / `$config` (no hardcoded domain or board names).
 *
 * Sets runtime vars:
 *   `$redue_is_news_context`, `$redue_article_headline`, `$redue_article_image`,
 *   `$redue_date_published`, `$redue_date_modified`
 *
 * Expected caller locals: `$origin`, `$site_name`, optional `$schema_meta_image`,
 * `$schema_meta_title` / `$site_title`, `$page_path`, `$request_uri`, `$page_qs`, `$meta`.
 */
export function buildNewsArticleAutoDetectPhp(): string {
	return `		/* v31 NewsArticle Auto-Detect — portable Gnuboard ($bo_table / URL / title; no hardcoded domain) */
		global $bo_table, $wr, $view, $write;
		$redue_bo_table = '';
		if ( isset($bo_table) && is_string($bo_table) && $bo_table !== '' ) {
			$redue_bo_table = $bo_table;
		} elseif ( isset($_GET['bo_table']) && is_string($_GET['bo_table']) && $_GET['bo_table'] !== '' ) {
			$redue_bo_table = $_GET['bo_table'];
		} elseif ( isset($page_qs) && is_array($page_qs) && ! empty($page_qs['bo_table']) && is_string($page_qs['bo_table']) ) {
			$redue_bo_table = $page_qs['bo_table'];
		}
		$redue_is_news_context = false;
		/* Match news/press tokens inside $bo_table only — never treat board.php filename as news */
		if ( $redue_bo_table !== '' && preg_match('/(notice|press|news|media|insight|board)/i', $redue_bo_table) ) {
			$redue_is_news_context = true;
		}
		$redue_news_path_hay = '';
		if ( isset($page_path) && is_string($page_path) ) { $redue_news_path_hay .= ' ' . $page_path; }
		if ( isset($request_uri) && is_string($request_uri) ) { $redue_news_path_hay .= ' ' . $request_uri; }
		if ( isset($schema_meta_title) && is_string($schema_meta_title) ) { $redue_news_path_hay .= ' ' . $schema_meta_title; }
		if ( isset($site_title) && is_string($site_title) ) { $redue_news_path_hay .= ' ' . $site_title; }
		if ( isset($meta) && is_array($meta) ) {
			if ( ! empty($meta['h1']) ) { $redue_news_path_hay .= ' ' . $meta['h1']; }
			if ( ! empty($meta['section']) ) { $redue_news_path_hay .= ' ' . $meta['section']; }
			if ( ! empty($meta['title']) ) { $redue_news_path_hay .= ' ' . $meta['title']; }
		}
		if ( preg_match('/(notice|press|news|media|insight|보도자료|보도|뉴스|공지|언론|미디어|인사이트)/ui', $redue_news_path_hay) ) {
			$redue_is_news_context = true;
		}
		/* Extract post fields from Gnuboard write/view globals when present */
		$redue_article_headline = '';
		$redue_wr_datetime = '';
		$redue_article_image = '';
		foreach ( array( (isset($wr) ? $wr : null), (isset($view) ? $view : null), (isset($write) ? $write : null) ) as $_redue_row ) {
			if ( ! is_array($_redue_row) ) { continue; }
			if ( $redue_article_headline === '' && ! empty($_redue_row['wr_subject']) && is_string($_redue_row['wr_subject']) ) {
				$redue_article_headline = trim(strip_tags($_redue_row['wr_subject']));
			}
			if ( $redue_wr_datetime === '' && ! empty($_redue_row['wr_datetime']) && is_string($_redue_row['wr_datetime']) ) {
				$redue_wr_datetime = $_redue_row['wr_datetime'];
			}
			if ( $redue_article_image === '' && ! empty($_redue_row['wr_image']) && is_string($_redue_row['wr_image']) ) {
				$redue_article_image = $_redue_row['wr_image'];
			}
		}
		/* First image attachment (common Gnuboard $view['file'] shape) */
		if ( $redue_article_image === '' && isset($view) && is_array($view) && isset($view['file']) && is_array($view['file']) ) {
			foreach ( $view['file'] as $_redue_f ) {
				if ( ! is_array($_redue_f) ) { continue; }
				$_redue_img = '';
				if ( ! empty($_redue_f['path']) && ! empty($_redue_f['file']) ) {
					$_redue_img = rtrim((string) $_redue_f['path'], '/') . '/' . (string) $_redue_f['file'];
				} elseif ( ! empty($_redue_f['path']) && is_string($_redue_f['path']) ) {
					$_redue_img = $_redue_f['path'];
				}
				if ( $_redue_img !== '' && preg_match('/\\.(jpe?g|png|gif|webp|svg)(\\?|$)/i', $_redue_img) ) {
					$redue_article_image = $_redue_img;
					break;
				}
			}
		}
		if ( $redue_article_headline === '' ) {
			if ( isset($g5_head_title) && is_string($g5_head_title) && $g5_head_title !== '' ) {
				$redue_article_headline = $g5_head_title;
			} elseif ( isset($schema_meta_title) && is_string($schema_meta_title) && $schema_meta_title !== '' ) {
				$redue_article_headline = $schema_meta_title;
			} elseif ( isset($site_title) && is_string($site_title) && $site_title !== '' ) {
				$redue_article_headline = $site_title;
			} else {
				$redue_article_headline = $site_name;
			}
		}
		if ( $redue_article_image !== '' && ! preg_match('#^https?://#i', $redue_article_image) && isset($origin) ) {
			$redue_article_image = rtrim($origin, '/') . '/' . ltrim($redue_article_image, '/');
		}
		if ( $redue_article_image !== '' ) {
			$redue_article_image = preg_replace('#^http://#i', 'https://', $redue_article_image);
		} elseif ( isset($schema_meta_image) && is_string($schema_meta_image) && $schema_meta_image !== '' ) {
			$redue_article_image = preg_replace('#^http://#i', 'https://', $schema_meta_image);
		} else {
			$redue_article_image = '';
		}
		$redue_date_published = date('Y-01-01T00:00:00+09:00');
		if ( $redue_wr_datetime !== '' ) {
			$_redue_ts = strtotime($redue_wr_datetime);
			if ( $_redue_ts ) {
				$redue_date_published = date('Y-m-d', $_redue_ts) . 'T' . date('H:i:s', $_redue_ts) . '+09:00';
			}
		}
		$redue_date_modified = date('c');
`;
}

/**
 * Universal Auto-Detect Clean Canonical & Schema Engine — Gnuboard/Youngcart-aware drop-in.
 * Uses `G5_URL`, `$config['cf_title']`, `$g5_head_title` when present (no hardcoded domain/brand).
 * `redue_dynamic_schema_controller()` is idempotent via `static $executed` even if called twice.
 *
 * Guarantees:
 *   1. Exact subpage canonical/og:url (never collapses 301.php / board.php?bo_table= / /?p=123 to /)
 *   2. Direct `echo` of one canonical/OG pair after charset (Charset-After; no output-buffer rewrite)
 *   3. Full-document server-side `defer` on sync external `<script src>` tags (head + body)
 *   4. Article graph node on EVERY page (main + subpages); NewsArticle auto on news/press boards & subpages
 *   5. FAQPage only when live Q&A is extracted from the page body (never invent a fallback array)
 *   6. Person E-E-A-T node + Alt Auto-Fixer
 */
export function buildUniversalObSeoEnginePhp(opts?: {
	representativeName?: string;
	representativeTitle?: string;
	openingHoursOpens?: string;
	openingHoursCloses?: string;
	latitude?: string;
	longitude?: string;
	sameAs?: string[];
	medicalSpecialty?: string[];
	isAcceptingNewPatients?: boolean;
}): string {
	const compiled = resolveEngineRepresentative({
		adminName: opts?.representativeName,
		adminTitle: opts?.representativeTitle,
		industryType: undefined,
	});
	return sanitizeGeneratedPhpSnippet(`<?php
/* ${REDUE_SCHEMA_MARKER_START} — Crawler-Optimized Canonical & Schema Engine (Charset-After First-Chunk · v32) */
${buildUniversalGraphGlobalsSeedPhp({
	repName: compiled.name,
	repTitle: compiled.jobTitle || '',
	lat: opts?.latitude,
	lng: opts?.longitude,
	openingHoursOpens: opts?.openingHoursOpens,
	openingHoursCloses: opts?.openingHoursCloses,
	sameAs: opts?.sameAs,
	bakeStreet: false,
})}
${buildUniversalObRegistrationPhp()}

// 3. 스키마 컨트롤러 중복 실행 방지 가드 (여러 번 호출되어도 단 1회만 실행)
if ( ! function_exists( 'redue_dynamic_schema_controller_safe' ) ) {
	function redue_dynamic_schema_controller_safe() {
		static $executed = false;
		if ( $executed ) return;
		$executed = true;
		try {
			if ( function_exists( 'redue_dynamic_schema_controller_body' ) ) {
				redue_dynamic_schema_controller_body();
			}
		} catch (\\Exception $_redue_schema_err) {} catch (\\Throwable $_redue_schema_err) {}
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller' ) ) {
	function redue_dynamic_schema_controller() {
		redue_dynamic_schema_controller_safe();
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller_body' ) ) {
	function redue_dynamic_schema_controller_body() {
		if ( function_exists( 'redue_auto_detect_footer_info' ) ) {
			redue_auto_detect_footer_info();
		}
		global $config, $g5_head_title;

		$site_name = (isset($config['cf_title']) && $config['cf_title'] !== '')
			? $config['cf_title']
			: (isset($GLOBALS['g5']['title']) && !empty($GLOBALS['g5']['title']) ? strip_tags($GLOBALS['g5']['title']) : '웹사이트');
		$site_title = (isset($g5_head_title) && $g5_head_title !== '')
			? $g5_head_title
			: $site_name;
		$origin = function_exists('redue_site_origin')
			? redue_site_origin()
			: ((defined('G5_URL') && G5_URL !== '')
				? rtrim(G5_URL, '/')
				: ((function_exists('redue_detect_site_protocol') ? redue_detect_site_protocol() : 'http') . '://' . preg_replace('#^https?://#i', '', isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost')));
		$schema_meta_image = isset($GLOBALS['redue_logo']) && is_string($GLOBALS['redue_logo']) && trim($GLOBALS['redue_logo']) !== ''
			? trim($GLOBALS['redue_logo'])
			: '';
		$domain_host = parse_url($origin, PHP_URL_HOST);
		if ( ! is_string($domain_host) || $domain_host === '' ) {
			$domain_host = preg_replace('#^https?://#i', '', $origin);
			$domain_host = preg_replace('#/.*$#', '', $domain_host);
		}

${buildRepresentativeResolvePhp(compiled.name, compiled.jobTitle || '')}
${buildGeoAeoBindingsPhp({
	siteName: 'Site',
	pages: [],
	industryType: undefined,
	openingHoursOpens: opts?.openingHoursOpens,
	openingHoursCloses: opts?.openingHoursCloses,
	latitude: opts?.latitude,
	longitude: opts?.longitude,
	sameAs: opts?.sameAs,
	medicalSpecialty: opts?.medicalSpecialty,
	isAcceptingNewPatients: opts?.isAcceptingNewPatients,
})}
${buildUniversalGraphApplyPhp()}

		$page_url = redue_get_exact_canonical();
		$request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
		$page_path = parse_url($request_uri, PHP_URL_PATH);
		$page_base = basename(is_string($page_path) ? $page_path : '/');

		$schema_meta_title = $site_title;
		$schema_meta_description = $site_name . ' 공식 웹사이트입니다. 상세 안내 및 전문 정보를 확인하실 수 있습니다.';

${buildNewsArticleAutoDetectPhp()}
		$schema_meta_og_type = $redue_is_news_context ? 'article' : 'website';
		if ( isset($GLOBALS['schema_article']) && is_array($GLOBALS['schema_article']) && count($GLOBALS['schema_article']) > 0 ) {
			$schema_meta_og_type = 'article';
		}

		if ( function_exists('redue_echo_canonical_pair') ) { redue_echo_canonical_pair(); }
		echo '<meta name="description" content="' . htmlspecialchars($schema_meta_description, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:title" content="' . htmlspecialchars($schema_meta_title, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:description" content="' . htmlspecialchars($schema_meta_description, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:type" content="' . htmlspecialchars($schema_meta_og_type, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:image" content="' . htmlspecialchars($schema_meta_image, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:site_name" content="' . htmlspecialchars($site_name, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:locale" content="ko_KR">' . "\\n";
		echo '<meta name="twitter:card" content="summary_large_image">' . "\\n";
		echo '<meta name="twitter:title" content="' . htmlspecialchars($schema_meta_title, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta name="twitter:description" content="' . htmlspecialchars($schema_meta_description, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta name="twitter:image" content="' . htmlspecialchars($schema_meta_image, ENT_QUOTES, 'UTF-8') . '">' . "\\n";

		$graph = array();

		// Organization & WebPage Node
		$org_types = function_exists('redue_infer_org_types')
			? redue_infer_org_types()
			: ( ! empty($GLOBALS['redue_org_type'])
				? $GLOBALS['redue_org_type']
				: array('LocalBusiness', 'Organization') );
		$org_node = array(
			'@type' => $org_types,
			'@id' => $origin . '/#organization',
			'name' => $site_name,
			'url' => $origin,
			'logo' => array('@type' => 'ImageObject', 'url' => $schema_meta_image),
			'isAcceptingNewPatients' => $is_accepting_new_patients,
			'medicalSpecialty' => $medical_specialty,
			'sameAs' => $same_as_array,
			'address' => array(
				'@type' => 'PostalAddress',
				'postalCode' => $postal_code,
				'streetAddress' => $street_address,
				'addressLocality' => $locality,
				'addressRegion' => $region,
				'addressCountry' => 'KR',
			),
			'geo' => array(
				'@type' => 'GeoCoordinates',
				'latitude' => (float) $latitude,
				'longitude' => (float) $longitude,
			),
			'openingHoursSpecification' => array(
				array(
					'@type' => 'OpeningHoursSpecification',
					'dayOfWeek' => array('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
					'opens' => $opens,
					'closes' => $closes,
				),
			),
			'availableService' => $available_services,
			'priceRange' => $price_range,
			'currenciesAccepted' => $currencies_accepted,
			'paymentAccepted' => $payment_accepted,
			'speakable' => $speakable_spec,
		);
${buildOrgFounderPhysicianPhp('\t\t')}
${buildRuntimeNapBindPhp('org_node')}
${buildUniversalOrgFiveCoreBindPhp()}
		$graph[] = $org_node;

		$graph[] = array(
			'@type' => 'WebSite',
			'@id' => $origin . '/#website',
			'name' => $site_name,
			'url' => $origin,
			'publisher' => array('@id' => $origin . '/#organization'),
			'inLanguage' => 'ko-KR',
		);

		$_page_is_main = ( $page_url === $origin . '/' || $page_url === $origin );
		$_page_is_about = ! $_page_is_main && (bool) preg_match('/소개|인사말|시설|장비|about|company|greeting|연혁|조직도|개요/ui', $schema_meta_title . ' ' . $page_url);
		$_page_types = function_exists('redue_composite_page_types')
			? redue_composite_page_types($_page_is_main, 'WebPage', $_page_is_about)
			: ( $_page_is_main ? 'WebPage' : ( $_page_is_about ? 'AboutPage' : 'WebPage' ) );
		if ( ! $_page_is_main && function_exists('redue_infer_page_schema_type') ) {
			$_inferred = redue_infer_page_schema_type($schema_meta_title . ' ' . $page_url, function_exists('redue_is_medical_org') && redue_is_medical_org());
			if ( $_inferred !== 'WebPage' ) { $_page_types = $_inferred; }
		}
		$_page_node = array(
			'@type' => $_page_types,
			'@id' => $page_url . '#webpage',
			'name' => $schema_meta_title,
			'headline' => $schema_meta_title,
			'description' => $schema_meta_description,
			'url' => $page_url,
			'isPartOf' => array('@id' => $origin . '/#website'),
			'about' => array('@id' => $origin . '/#organization'),
			'mainEntity' => array('@id' => $origin . '/#organization'),
			'author' => array('@id' => $origin . '/#person'),
			'reviewedBy' => array('@id' => $origin . '/#person'),
			'speakable' => $speakable_spec,
		);
		$graph[] = $_page_node;

		// Article / NewsArticle Node — news/press boards & subpages → NewsArticle (Google/AI citation fields)
		$article = isset($GLOBALS['schema_article']) && is_array($GLOBALS['schema_article']) ? $GLOBALS['schema_article'] : array();
		$article_type = $redue_is_news_context ? 'NewsArticle' : 'Article';
		if ( ! empty($article['type']) && $article['type'] === 'NewsArticle' ) {
			$article_type = 'NewsArticle';
		} elseif ( ! empty($article['type']) && $article['type'] === 'Article' && ! $redue_is_news_context ) {
			$article_type = 'Article';
		}
		$graph[] = array(
			'@type' => $article_type,
			'@id' => $page_url . '#article',
			'headline' => ! empty($article['headline']) ? $article['headline'] : $redue_article_headline,
			'description' => ! empty($article['description']) ? $article['description'] : $schema_meta_description,
			'url' => $page_url,
			'image' => ! empty($article['image']) ? preg_replace('#^http://#i', 'https://', $article['image']) : $redue_article_image,
			'datePublished' => ! empty($article['datePublished']) ? $article['datePublished'] : $redue_date_published,
			'dateModified' => ! empty($article['dateModified']) ? $article['dateModified'] : $redue_date_modified,
			'mainEntityOfPage' => array('@id' => $page_url . '#webpage'),
			'author' => ! empty($article['author']) && is_array($article['author'])
				? $article['author']
				: array(
					'@type' => 'Organization',
					'@id' => $origin . '/#organization',
					'name' => $site_name,
				),
			'publisher' => array(
				'@type' => 'Organization',
				'@id' => $origin . '/#organization',
				'name' => $site_name,
				'url' => $origin,
				'logo' => array(
					'@type' => 'ImageObject',
					'url' => $schema_meta_image,
				),
			),
			'reviewedBy' => array('@id' => $origin . '/#person'),
			'speakable' => $speakable_spec,
		);

		// FAQPage Node — skip entirely when page body has no Q&A
		$is_board = preg_match('/board\\.php\\?bo_table=/', $page_url);
		if ( ! $is_board ) {
${buildEvidenceFaqInjectPhp('page_url')}
		}

${buildHowToAutoInjectPhp()}
		// Person E-E-A-T Node
${buildPersonEeatNodePhp()}
${buildUniversalBreadcrumbEnsurePhp({ canonicalVar: 'page_url', titleVar: 'schema_meta_title' })}

		// Single JSON-LD Output
		$payload = array('@context' => 'https://schema.org', '@graph' => $graph);
		echo '<script type="application/ld+json">' . "\\n" . json_encode($payload, function_exists('redue_jsonld_flags') ? redue_jsonld_flags() : (JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) . "\\n" . '</script>' . "\\n";

		// Image Alt Auto-Fixer
		echo '<script id="redue-alt-autofix">(function(){var site=' . json_encode($site_name, JSON_UNESCAPED_UNICODE) . ';function fix(){try{var imgs=document.querySelectorAll("img");for(var i=0;i<imgs.length;i++){var img=imgs[i];var cur=img.getAttribute("alt");if(cur!=null&&String(cur).trim()!=="")continue;var kw=img.getAttribute("title")||img.getAttribute("aria-label")||"";if(!kw&&img.getAttribute("src")){try{var path=String(img.getAttribute("src")).split("?")[0];var base=path.substring(path.lastIndexOf("/")+1).replace(/\\.[a-z0-9]+$/i,"");kw=decodeURIComponent(base).replace(/[-_]+/g," ").trim();}catch(e0){}}img.setAttribute("alt",(kw&&kw.length>1?kw+" — ":"")+site);}}catch(e){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fix);else fix();if(typeof MutationObserver!=="undefined"){try{new MutationObserver(fix).observe(document.documentElement,{childList:true,subtree:true});}catch(e2){}}})();</script>' . "\\n";
	}
}
redue_dynamic_schema_controller();
/* ${REDUE_SCHEMA_MARKER_END} */
?>
`);
}

/** Compact per-page row — the only shape LLM should return (token-efficient). */
export type SchemaMappingPage = {
	title: string;
	desc: string;
	schemaType: string;
	/** GNB / section label (e.g. 연구소 소개) — preferred over bare filenames */
	section?: string;
	/** Breadcrumb depth-1 label (e.g. 예담소개) */
	menu1?: string;
	/** Breadcrumb depth-2 label (e.g. 소개) */
	menu2?: string;
	h1?: string;
	extraTypes?: string[];
};

/**
 * Token-efficient LLM output contract:
 * `{ pages: { "s101.php": { title, desc, schemaType, section, menu1, menu2 } } }`
 */
export type SchemaMappingJson = {
	pages: Record<string, SchemaMappingPage>;
	/** Optional GNB labels when LLM can infer nav */
	nav?: SchemaNavItem[];
	siteName?: string;
	imageUrl?: string;
	/** Organization.knowsAbout keywords */
	knowsAbout?: string[];
};

/** GNB nav row — flat or nested (children enable Parent Fallback Hierarchy). */
export type SchemaNavItem = {
	name: string;
	url: string;
	children?: Array<{ name: string; url: string }>;
	/** Explicit 1차 상위 메뉴 when nav was flattened */
	parent?: string;
};

export type AuditPageMeta = {
	/** Site-relative path or filename key, e.g. `/about.php` or `about.php` */
	urlPath: string;
	title?: string;
	description?: string;
	h1?: string;
	/** Schema.org page type: AboutPage, ContactPage, MedicalWebPage, ItemList, … */
	pageType?: string;
	/** Extra schema node types for this page (HowTo, Person, FAQPage, …) */
	extraTypes?: string[];
	/** GNB section / menu label for $page_meta['section'] */
	section?: string;
	menu1?: string;
	menu2?: string;
	/** When false, exclude from $page_meta / schema mapping. */
	selected?: boolean;
	/** True when this row came from a live GNB href. */
	fromGnb?: boolean;
	/** Virtual FAQ/HowTo citation row (not a live crawl URL). */
	virtual?: boolean;
};

export type DynamicPhpSchemaInput = {
	siteName: string;
	targetUrl?: string;
	/** Main + subpage metadata from audit_payload */
	pages: AuditPageMeta[];
	/** Industry hint for MedicalWebPage / GEO ItemList buckets */
	industryType?: string;
	cmsType?: string;
	/** Optional logo / hero image absolute URL */
	imageUrl?: string;
	/** GNB / nav labels for SiteNavigationElement + Parent Fallback (optional nested children) */
	navItems?: SchemaNavItem[];
	/** Organization.knowsAbout keyword list (semantic terms only — not menu labels) */
	knowsAbout?: string[];
	/** Organization.legalName — legal entity (footer/copyright); kept distinct from brand siteName */
	legalName?: string;
	/** Footer / copyright corpus for legalName extraction when legalName omitted */
	copyrightText?: string;
	/** Extra footer / 사업자 정보 blob for brand vs legal entity split */
	footerText?: string;
	/** Organization.areaServed place names from audit (e.g. 대한민국, 일본) */
	areaServed?: string[];
	/** Detected or admin-overridden representative legal name (Person / founder). */
	representativeName?: string;
	/** Detected or admin-overridden jobTitle (대표원장 / 대표자). */
	representativeTitle?: string;
	/** Weekday opening hours (HH:mm) — default 09:00–18:00. */
	openingHoursOpens?: string;
	openingHoursCloses?: string;
	latitude?: string;
	longitude?: string;
	/** Maps / SNS entity links compiled into Organization.sameAs. */
	sameAs?: string[];
	/** Schema.org MedicalSpecialty names (Oncologic, RadiationTherapy, …). */
	medicalSpecialty?: string[];
	isAcceptingNewPatients?: boolean;
	postalCode?: string;
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	/** Compiled footer / CMS telephone — baked into Organization.telephone. */
	telephone?: string;
	fax?: string;
	taxId?: string;
	/** Optional pre-built LLM mapping JSON (preferred over pages[]) */
	mappingJson?: SchemaMappingJson;
	/** When true, an empty pages[] stays empty (no synthetic homepage row). */
	allowEmptyPageMap?: boolean;
};

type PageMetaRow = {
	title: string;
	description: string;
	section: string;
	h1: string;
	type: string;
	menu1: string;
	menu2: string;
	/** Breadcrumb parent label (section / GNB) */
	parent: string;
	/** Absolute URL for breadcrumb parent */
	parent_url: string;
};

/** Hardcoded meta keys stripped from head.sub.php before dynamic inject (duplicate prevention). */
export const HARDCODED_META_ECHO_KEYS = [
	'og:url',
	'og:title',
	'og:description',
	'og:type',
	'description',
	'og:image',
] as const;

/**
 * Theme HTML metas the dynamic engine already emits.
 * Keep charset / robots / naver-site-verification / viewport.
 */
export const HARDCODED_HTML_META_KEYS = [
	'description',
	'og:title',
	'og:description',
	'og:image',
] as const;

/**
 * Match a start-to-end `<meta>` / `<link>` that may embed `<?php … ?>` in attributes.
 * `[^>]*` is unsafe: `content="<?php echo $x; ?>">` stops at `?>` and leaves leftover `">`.
 * Built per call so `/g` lastIndex never leaks across replacements.
 */
function phpAwareMetaTagRe(): RegExp {
	return /<meta\b(?:[^<]|<\?php[\s\S]*?\?>)*?>/gi;
}
function phpAwareLinkTagRe(): RegExp {
	return /<link\b(?:[^<]|<\?php[\s\S]*?\?>)*?>/gi;
}

function htmlTagAttrValue(tag: string, attr: string): string {
	const re = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'i');
	return (re.exec(tag)?.[1] || '').trim().toLowerCase();
}

function phpSingleQuoted(value: string): string {
	return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Runtime `$rep_name` / `$rep_title` resolve inside the schema controller body. */
function buildRepresentativeResolvePhp(compiledName: string, compiledTitle: string): string {
	return `		$rep_name = ${phpSingleQuoted(compiledName)};
		$rep_title = ${phpSingleQuoted(compiledTitle)};
		if ( isset($GLOBALS['schema_person']) && is_array($GLOBALS['schema_person']) && ! empty($GLOBALS['schema_person']['name']) ) {
			$_redue_pn = trim((string) $GLOBALS['schema_person']['name']);
			if ( $_redue_pn !== '' ) {
				$rep_name = $_redue_pn;
				if ( ! empty($GLOBALS['schema_person']['jobTitle']) ) {
					$rep_title = trim((string) $GLOBALS['schema_person']['jobTitle']);
				}
			}
		} elseif ( isset($schema_person) && is_array($schema_person) && ! empty($schema_person['name']) ) {
			$_redue_pn = trim((string) $schema_person['name']);
			if ( $_redue_pn !== '' ) {
				$rep_name = $_redue_pn;
				if ( ! empty($schema_person['jobTitle']) ) {
					$rep_title = trim((string) $schema_person['jobTitle']);
				}
			}
		}
		if ( ! is_string($rep_name) ) { $rep_name = ''; }
		if ( ! is_string($rep_title) ) { $rep_title = ''; }
		$GLOBALS['redue_rep_name'] = $rep_name;
		$GLOBALS['redue_rep_title'] = $rep_title;
		if ( $rep_name !== '' ) {
			if ( ! isset($GLOBALS['schema_person']) || ! is_array($GLOBALS['schema_person']) ) {
				$GLOBALS['schema_person'] = array();
			}
			if ( empty($GLOBALS['schema_person']['name']) ) {
				$GLOBALS['schema_person']['name'] = $rep_name;
			}
			if ( empty($GLOBALS['schema_person']['jobTitle']) && $rep_title !== '' ) {
				$GLOBALS['schema_person']['jobTitle'] = $rep_title;
			}
		}`;
}

function buildOrgFounderPhysicianPhp(indent = '\t\t\t'): string {
	return buildOrgFounderIdRefPhp(indent);
}

function normalizeEngineHhMm(raw: string | undefined, fallback: string): string {
	const match = String(raw || '')
		.trim()
		.match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return fallback;
	return `${String(Math.min(23, Math.max(0, Number(match[1])))).padStart(2, '0')}:${match[2]}`;
}

function normalizeEngineCoord(raw: string | undefined, fallback: string): string {
	const value = String(raw || '').trim();
	return /^-?\d+(\.\d+)?$/.test(value) ? value : fallback;
}

/** Compile GEO/AEO bindings: hours, geo, sameAs, medicalSpecialty, speakable, postalCode. */
function buildGeoAeoBindingsPhp(
	input: DynamicPhpSchemaInput,
	opts?: { includePostalBinds?: boolean; strictRealNap?: boolean },
): string {
	const opens = normalizeEngineHhMm(input.openingHoursOpens, opts?.strictRealNap ? '' : '09:00');
	const closes = normalizeEngineHhMm(input.openingHoursCloses, opts?.strictRealNap ? '' : '18:00');
	const latitude = normalizeEngineCoord(input.latitude, opts?.strictRealNap ? '' : '37.4837');
	const longitude = normalizeEngineCoord(input.longitude, opts?.strictRealNap ? '' : '127.0324');
	const industry = String(input.industryType || '').toUpperCase();
	const specialtyHay = `${input.siteName || ''} ${industry} ${(input.medicalSpecialty || []).join(' ')}`;
	const specialties =
		input.medicalSpecialty && input.medicalSpecialty.length > 0
			? input.medicalSpecialty.filter(Boolean)
			: industry === 'MEDICAL' && /암|중입자|oncolog|radiation|양성자/i.test(specialtyHay)
				? ['Oncologic', 'RadiationTherapy']
				: [];
	const sameAs = filterOfficialSameAs(input.sameAs, input.targetUrl);
	const accepting = opts?.strictRealNap
		? input.isAcceptingNewPatients === true
		: input.isAcceptingNewPatients !== false;
	const postal = String(input.postalCode || '').replace(/\D/g, '').slice(0, 5);
	const street = String(input.streetAddress || '').trim();
	const locality = String(input.addressLocality || '').trim();
	const region = String(input.addressRegion || '').trim();
	const services = buildAvailableServices({
		pages: input.pages,
		navItems: input.navItems,
		industryType: input.industryType,
		siteName: input.siteName,
		origin: input.targetUrl,
	});
	const servicesPhp = services.length
		? `array(\n${services
				.map((service) => {
					const urlPart = service.url
						? `, 'url' => ${phpSingleQuoted(service.url)}`
						: '';
					return `\t\t\tarray('@type' => ${phpSingleQuoted(service['@type'])}, 'name' => ${phpSingleQuoted(service.name)}${urlPart}),`;
				})
				.join('\n')}\n\t\t)`
		: 'array()';

	return `		$opens = ${phpSingleQuoted(opens)};
		$closes = ${phpSingleQuoted(closes)};
		$latitude = ${phpSingleQuoted(latitude)};
		$longitude = ${phpSingleQuoted(longitude)};
		$is_accepting_new_patients = ${accepting ? 'true' : 'false'};
		$medical_specialty = ${specialties.length ? phpStringList(specialties, '\t\t') : 'array()'};
		$same_as_extra = ${sameAs.length ? phpStringList(sameAs, '\t\t') : 'array()'};
		$available_services = ${servicesPhp};
		$price_range = ${opts?.strictRealNap ? "''" : phpSingleQuoted(SCHEMA_PRICE_RANGE_FALLBACK)};
		$currencies_accepted = ${opts?.strictRealNap ? "''" : phpSingleQuoted(SCHEMA_CURRENCIES_ACCEPTED_FALLBACK)};
		$payment_accepted = ${opts?.strictRealNap ? "''" : phpSingleQuoted(SCHEMA_PAYMENT_ACCEPTED_FALLBACK)};
${
	opts?.includePostalBinds === false
		? ''
		: `		$postal_code = ${phpSingleQuoted(postal)};
		$street_address = ${phpSingleQuoted(street)};
		$locality = ${phpSingleQuoted(locality)};
		$region = ${phpSingleQuoted(region)};
`
}
		$same_as_array = array();
		if ( is_array($same_as_extra) ) {
			foreach ( $same_as_extra as $_redue_sa ) {
				if ( ! is_string($_redue_sa) || $_redue_sa === '' ) { continue; }
				if ( function_exists('redue_is_own_site_url') && redue_is_own_site_url($_redue_sa, $origin) ) { continue; }
				if ( ! in_array($_redue_sa, $same_as_array, true) ) {
					$same_as_array[] = $_redue_sa;
				}
			}
		}
		if ( is_array($available_services) ) {
			foreach ( $available_services as &$_svc ) {
				if ( empty($_svc['url']) || ! is_string($_svc['url']) ) { continue; }
				if ( preg_match('#^https?://#i', $_svc['url']) ) {
					$_svc['url'] = function_exists('redue_align_url_protocol') ? redue_align_url_protocol($_svc['url']) : $_svc['url'];
				} else {
					$_svc['url'] = rtrim($origin, '/') . '/' . ltrim($_svc['url'], '/');
				}
			}
			unset($_svc);
		}
		$speakable_spec = array(
			'@type' => 'SpeakableSpecification',
			'cssSelector' => array('meta[name="description"]', 'h1', '.summary', '.faq-answer'),
		);`;
}

function tryDecodeUriComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/** Legacy helper — keeps https rewrite for callers that already know the site is SSL. Runtime PHP never uses this. */
export function enforceHttps(url: string): string {
	const raw = String(url || '').trim();
	if (!raw) return raw;
	return raw.replace(/^http:\/\//i, 'https://');
}

/** Resolve site origin using the live/audited protocol (http or https). */
export function resolveHttpsOrigin(targetUrl?: string, fallback = 'https://example.com'): string {
	try {
		if (!targetUrl) return new URL(fallback).origin;
		return new URL(targetUrl).origin;
	} catch {
		try {
			return new URL(fallback).origin;
		} catch {
			return fallback.replace(/\/+$/, '');
		}
	}
}

/** Dev leftover / stub basenames that must never enter $page_meta / ItemList. */
const DEV_LEFTOVER_BASENAME_RE =
	/^(breadcrumb|bread_crumb|lnb|gnb|aside|sidebar|footer|header|inc|include|common|popup|layer|dummy|temp|test|sample|stub|prototype|service[-_\s]?details)(\.|$)/i;

/** Testing / ghost path segments that must never enter schema maps. */
const DEV_GARBAGE_PATH_RE =
	/(^|\/)(dummy|temp|test|sample|stub|prototype|garbage|breadcrumb|service[-_\s]?details)([._\-/]|$)/i;

/** 1–2 digit numeric stubs (e.g. 23.php) — section codes are typically 3+ digits (101.php). */
const SHORT_NUMERIC_STUB_RE = /^\d{1,2}\.(php|phtml|html?|htm)$/i;

/**
 * Query keys that identify distinct content pages (Gnuboard / Youngcart / WP / custom).
 * Arbitrary tracking params (?utm_*=…, ?x=1) remain garbage and stay excluded from $page_meta.
 */
export const PAGE_IDENTITY_QUERY_KEYS = [
	'bo_table',
	'co_id',
	'it_id',
	'ca_id',
	'idx',
	'p',
	'page_id',
	'wr_id',
	'id',
] as const;

const PAGE_IDENTITY_QUERY_RE =
	/(?:^|[?&])(bo_table|co_id|it_id|ca_id|idx|p|page_id|wr_id|id)=([a-zA-Z0-9_-]{1,40})/i;

/** Extract allowlisted identity query (e.g. `bo_table=notice`) or null. */
export function extractPageIdentityQuery(urlOrPath: string): string | null {
	const raw = String(urlOrPath || '').trim().split('#')[0] || '';
	const qIdx = raw.indexOf('?');
	if (qIdx < 0) return null;
	const search = raw.slice(qIdx + 1);
	try {
		const params = new URLSearchParams(search);
		for (const key of PAGE_IDENTITY_QUERY_KEYS) {
			const value = params.get(key);
			if (value && /^[a-zA-Z0-9_-]{1,40}$/.test(value)) {
				return `${key}=${value}`;
			}
		}
	} catch {
		const m = raw.match(PAGE_IDENTITY_QUERY_RE);
		if (m) return `${m[1]!.toLowerCase()}=${m[2]}`;
	}
	return null;
}

function pathWithoutQuery(urlOrPath: string): string {
	return (String(urlOrPath || '').split('#')[0] || '').split('?')[0] || '';
}

/**
 * True when a parsed filename/path is HTML debris, query junk, or percent-encoded garbage
 * (e.g. `title%3E.php`, `%3Cmeta.php`, `foo.php?x=1`).
 * Allowlisted board/content identity queries (`board.php?bo_table=notice`) are kept.
 */
export function isGarbagePageFile(fileOrPath: string): boolean {
	const raw = String(fileOrPath || '').trim();
	if (!raw) return true;

	const withQuery = raw.split('#')[0] || '';
	// Site root is always valid (maps to index.php)
	if (withQuery === '/' || withQuery === '') return false;

	const identity = extractPageIdentityQuery(withQuery);
	const pathOnly = pathWithoutQuery(withQuery);

	// Non-identity query strings remain garbage (tracking / noise)
	if (/[?&=]/.test(withQuery) && !identity) return true;

	const base = pathOnly.replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';
	if (!base || base === '.' || base === '..') return true;

	// Any percent-encoding → exclude (title%3E.php, %3Chtml, etc.)
	if (/%[0-9a-f]{2}/i.test(base) || /%[0-9a-f]{2}/i.test(pathOnly)) return true;

	const decoded = tryDecodeUriComponent(base);
	if (/[<>"'`]/.test(base) || /[<>"'`]/.test(decoded)) return true;
	if (/%3[ce]/i.test(base) || /%3[ce]/i.test(pathOnly)) return true;

	// Tag / attribute debris often seen after broken HTML href parsing
	if (/^(title|html|head|body|meta|link|script|style|div|span|img|href|src|class|id)([\W_]|$)/i.test(decoded)) {
		return true;
	}

	// Dev leftovers: Breadcrumb.php, service-details.html, Service Details, 23.php, /test/…
	if (DEV_LEFTOVER_BASENAME_RE.test(decoded) || DEV_LEFTOVER_BASENAME_RE.test(base)) return true;
	if (DEV_GARBAGE_PATH_RE.test(pathOnly) || DEV_GARBAGE_PATH_RE.test(decoded)) return true;
	if (SHORT_NUMERIC_STUB_RE.test(decoded) || SHORT_NUMERIC_STUB_RE.test(base)) return true;
	if (/\s/.test(decoded) || /service[-_\s]*details/i.test(decoded) || /service[-_\s]*details/i.test(base)) {
		return true;
	}

	// Must look like a real page filename (extension or simple slug)
	const stem = decoded.replace(/\.(php|phtml|html?|htm)$/i, '');
	if (!stem || stem.length > 80) return true;
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(decoded) && !/^[a-zA-Z0-9][a-zA-Z0-9._/-]*\.(php|phtml|html?|htm)$/i.test(decoded)) {
		// Allow Korean / unicode stems that are still clean (no encoding)
		if (/[^\w.\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF-]/u.test(decoded.replace(/\.(php|phtml|html?|htm)$/i, ''))) {
			return true;
		}
	}

	return false;
}

function basenameFromPath(urlPath: string): string {
	const cleaned = pathWithoutQuery(urlPath) || '/';
	if (cleaned === '/' || cleaned === '') return 'index.php';
	const parts = cleaned.replace(/\/+$/, '').split('/');
	const last = parts[parts.length - 1] || 'index.php';
	if (!last || last === '') return 'index.php';
	if (!/\.[a-z0-9]+$/i.test(last)) return `${last}.php`;
	return last;
}

/**
 * Safe page file key or null when garbage.
 * Identity-query pages keep a stable key: `board.php?bo_table=notice`.
 */
export function sanitizePageFileKey(urlPath: string): string | null {
	const raw = String(urlPath || '').trim();
	const pathOnly = pathWithoutQuery(raw);
	if (pathOnly === '/' || pathOnly === '') return 'index.php';
	if (isGarbagePageFile(urlPath)) return null;
	const file = basenameFromPath(urlPath);
	if (isGarbagePageFile(file)) return null;
	const identity = extractPageIdentityQuery(raw);
	if (identity) return `${file}?${identity}`;
	const rel = pathOnly.replace(/\\/g, '/').replace(/^\//, '');
	if (/^index\.(php|html?|htm)$/i.test(file) && rel.includes('/')) {
		return rel;
	}
	return file;
}

/** Non-page entity types that must not become $page_meta['type']. */
const NON_PAGE_SCHEMA_TYPES = new Set([
	'Organization',
	'ProfessionalService',
	'LocalBusiness',
	'WebSite',
	'BreadcrumbList',
	'ImageObject',
	'Person',
	'Service',
	'HowTo',
]);

function normalizePageType(raw: string | undefined, _industryType?: string): string {
	const t = (raw || '').trim();
	if (!t || NON_PAGE_SCHEMA_TYPES.has(t)) return 'WebPage';
	return t;
}

/** True for Gnuboard board list URLs (`board.php?bo_table=*`). */
export function isBoardListPath(urlPath: string): boolean {
	const hay = String(urlPath || '').toLowerCase();
	return /board\.php/i.test(hay) && /(?:^|[?&])bo_table=/i.test(hay);
}

/**
 * @deprecated Board lists are always CollectionPage — FAQ board tables must not emit FAQPage.
 * Kept for callers that still probe FAQ-named tables.
 */
export function isFaqBoardPath(urlPath: string): boolean {
	const hay = String(urlPath || '').toLowerCase();
	return /(?:^|[?&])bo_table=(faq|qna|qa)(?:&|$)/i.test(hay);
}

/** Simple info / intro / hospital directory / customer-service pages → WebPage. */
export function isSimpleInfoPage(hay: string): boolean {
	const h = String(hay || '').toLowerCase();
	return /소개|인사말|오시는|길찾기|추천사|연혁|조직도|고객센터|공지|뉴스|소식|상담.?예약|문의|연락처|contact|about|company|intro|history|greeting|directions|hospital.?network|제휴.?병원|협력.?병원|해외.?병원|병원.?안내|서비스.?소개|시설|장비|둘러보기|의료진|프로필|facility|equipment/.test(
		h,
	);
}

/**
 * True only when the page is actual medical treatment / disease content.
 * Intro, greeting, hospital directory, and customer-service pages are excluded.
 * Filename codes 301–304.php / 600.php hub / 601–613.php cancer leaves are always medical content pages.
 */
export function isMedicalContentPage(hay: string): boolean {
	const h = String(hay || '').toLowerCase();
	if (!h) return false;
	if (isBoardListPath(h)) return false;
	// Dedicated medical content files (treatment hubs + cancer-type hub/leaves)
	if (
		/(?:^|\/)(?:301|302|303|304|6(?:0[0-9]|1[0-3]))\.php(?:[?#]|$)/i.test(h) ||
		/^(?:301|302|303|304|6(?:0[0-9]|1[0-3]))\.php(?:[?#]|$)/i.test(h.trim())
	) {
		return true;
	}
	// Informational shells are never MedicalWebPage even on MEDICAL industry sites
	if (isSimpleInfoPage(h) && !/치료|시술|therapy|treatment|질환|암종|세포|줄기|백신|중입자|양성자/.test(h)) {
		return false;
	}
	return /치료|시술|therapy|treatment|질환|암종|carcinoma|세포치료|줄기세포|백신|중입자|양성자|방사선|네오안티젠|medicalcondition|적용.?대상|cancer.?type|종양.?치료|진료|수술/.test(
		h,
	);
}

function isMedicalIndustryHint(industryType?: string, hay = ''): boolean {
	return /MEDICAL/i.test(String(industryType || '')) || /병원|의원|클리닉|치과|한의|동물병원|veterinary|clinic|hospital|dentist/.test(hay);
}

function inferPageTypeFromPath(urlPath: string, industryType?: string, titleHint?: string): string {
	const hay = `${urlPath} ${titleHint || ''}`.toLowerCase();
	// Board list: always CollectionPage (FAQPage ban on board.php?bo_table=*)
	if (isBoardListPath(hay)) return 'CollectionPage';
	if (/연락처|문의|오시는|찾아오시는|견적|상담|지점|contact|location|map\.php/i.test(hay) && !isMedicalContentPage(hay)) {
		return 'ContactPage';
	}
	if (/doctor|staff|의료진|의료\s*진|프로필|원장진|전문의|강사진|임원|팀\b|team|person/i.test(hay)) {
		return 'ProfilePage';
	}
	if (/소개|인사말|시설|장비|둘러보기|철학|연혁|about|company|greeting|조직도|개요|facility|equipment/i.test(hay)) {
		return 'AboutPage';
	}
	const medicalIndustry = isMedicalIndustryHint(industryType, hay);
	if (medicalIndustry && isMedicalContentPage(hay)) return 'MedicalWebPage';
	if (medicalIndustry && /진료|수술|시술|치료|서비스/i.test(hay) && !/서비스\s*소개/i.test(hay)) {
		return 'MedicalWebPage';
	}
	if (isMedicalContentPage(hay)) return 'MedicalWebPage';
	// Dedicated FAQ landing (not a board list) — page type only; FAQ nodes still require live Q&A
	if (/(?:^|\/)faq(?:\.php|\/|$)|자주.?묻는|자주하는.?질문/.test(hay) && !/board\.php/.test(hay)) {
		return 'FAQPage';
	}
	if (/product|item|goods|shop|상품/.test(hay) && !isSimpleInfoPage(hay)) return 'ItemList';
	return 'WebPage';
}

/** Board lists always coerce to CollectionPage — including bo_table=qa/faq/qna. */
export function coerceBoardPageType(fileOrPath: string, pageType: string): string {
	if (isBoardListPath(fileOrPath) || (/board\.php/i.test(fileOrPath) && /bo_table=/i.test(fileOrPath))) {
		return 'CollectionPage';
	}
	return pageType || 'WebPage';
}

/**
 * Refine assigned schema type from audit/LLM hints using semantic path+title signals.
 * Prevents MedicalWebPage / FAQPage overuse on informational and board pages.
 */
/** True for homepage keys (`/`, `index.php`, `index.html`). */
export function isHomepageFile(fileOrPath: string): boolean {
	const raw = String(fileOrPath || '').trim();
	if (!raw || raw === '/' || raw === '') return true;
	const pathOnly = pathWithoutQuery(raw);
	if (pathOnly === '/' || pathOnly === '') return true;
	const base = basenameFromPath(pathOnly).toLowerCase();
	return base === 'index.php' || base === 'index.html' || base === 'index.htm' || base === 'main.html';
}

export function refineAssignedPageType(
	fileOrPath: string,
	pageType: string,
	title = '',
	section = '',
): string {
	// Main page is always WebPage (never MedicalWebPage / Article shell)
	if (isHomepageFile(fileOrPath)) return 'WebPage';
	if (isBoardListPath(fileOrPath)) return 'CollectionPage';

	const hay = `${fileOrPath} ${title} ${section}`;
	const normalized = normalizePageType(pageType);

	if (normalized === 'FAQPage' && /board\.php/i.test(fileOrPath)) return 'CollectionPage';
	if (normalized === 'MedicalWebPage' && !isMedicalContentPage(hay)) {
		if (/소개|인사말|시설|장비|둘러보기|about|company|greeting|연혁|조직도|개요|facility|equipment/i.test(hay)) {
			return 'AboutPage';
		}
		if (/연락처|문의|오시는|찾아오시는|contact|location/i.test(hay)) return 'ContactPage';
		if (/의료진|프로필|원장진|전문의|doctor|staff|team/i.test(hay)) return 'ProfilePage';
		return 'WebPage';
	}
	if (normalized === 'AboutPage' || normalized === 'ContactPage' || normalized === 'ProfilePage') {
		return normalized;
	}
	if (!pageType?.trim() || NON_PAGE_SCHEMA_TYPES.has(pageType.trim()) || normalized === 'WebPage') {
		return inferPageTypeFromPath(fileOrPath, undefined, `${title} ${section}`);
	}
	return normalized;
}

function titleFromPath(urlPath: string, siteName: string): string {
	const human = humanizePathLabel(urlPath);
	if (human && !looksLikeRawUrlOrPath(human)) return human;
	const file = basenameFromPath(urlPath).replace(/\.(php|html?|htm|phtml)$/i, '');
	if (!file || file === 'index' || isCmsPathToken(file) || isCodeLikeFileStem(file)) return siteName;
	return file.replace(/[-_]+/g, ' ').trim() || siteName;
}

/** Bare numeric/code filenames (101, s101, a1) that should not become human titles. */
function isCodeLikeFileStem(stem: string): boolean {
	const s = stem.trim();
	if (!s || s === 'index') return false;
	return /^[a-z]?\d{1,6}$/i.test(s) || /^\d+[a-z]?$/i.test(s);
}

function findNavItemForFile<T extends { name: string; url: string }>(
	file: string,
	nav?: T[],
): T | undefined {
	if (!nav?.length) return undefined;
	const fileKey = (sanitizePageFileKey(file) || file).toLowerCase();
	const key = basenameFromPath(file).toLowerCase();
	const stem = key.replace(/\.(php|html?|htm|phtml)$/i, '');
	const fileIdentity = extractPageIdentityQuery(file);
	for (const n of nav) {
		if (!n?.name || !n?.url) continue;
		if (looksLikeRawUrlOrPath(n.name) || isCmsPathToken(n.name)) continue;
		const navFile = sanitizePageFileKey(n.url);
		if (!navFile) continue;
		if (navFile.toLowerCase() === fileKey) return n;
		const navIdentity = extractPageIdentityQuery(n.url);
		const navBase = basenameFromPath(navFile).toLowerCase();
		if (fileIdentity || navIdentity) {
			if (fileIdentity && navIdentity && fileIdentity === navIdentity && navBase === key) {
				return n;
			}
			continue;
		}
		if (navFile.toLowerCase() === key) return n;
		const navStem = navBase.replace(/\.(php|html?|htm|phtml)$/i, '');
		if (navStem === stem) return n;
	}
	return undefined;
}

function findNavNameForFile(
	file: string,
	nav?: Array<{ name: string; url: string }>,
): string | undefined {
	const name = findNavItemForFile(file, nav)?.name.trim();
	if (!name || looksLikeRawUrlOrPath(name) || isCmsPathToken(name)) return undefined;
	return name;
}

/**
 * Prefer GNB menu / section labels over bare filenames like "101".
 * Resolution order: explicit title (if human) → nav → section → menu1 → menu2 → path title.
 */
function normLabel(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

/** Paging chrome — reject from Title / knowsAbout ("2페이지", "Page 2", …). */
export const PAGING_TITLE_NOISE_RE = /(^[0-9]+페이지$|^Page\s*[0-9]+$)/i;

/** True when a crawled/meta title is pure pagination noise. */
export function isPagingNoiseTitle(value: string): boolean {
	return PAGING_TITLE_NOISE_RE.test(String(value || '').replace(/\s+/g, ' ').trim());
}

/**
 * Homepage / index title sanitizer.
 * Rejects paging noise and empty parse failures → brand (siteName) fallback.
 */
export function sanitizeMainPageTitle(title: string | undefined, siteName: string): string {
	const brand = dedupeRepeatedPhrase(siteName || '') || siteName || 'Site';
	const t = String(title || '').replace(/\s+/g, ' ').trim();
	if (!t || isPagingNoiseTitle(t) || looksLikeRawUrlOrPath(t)) return brand;
	if (brand && /[가-힣]{2,}/.test(brand) && /^[A-Za-z0-9][A-Za-z0-9._-]{1,40}$/.test(t)) {
		return brand;
	}
	return t;
}

/** Drop paging noise; return undefined when the label is unusable. */
export function rejectPagingTitle(value: string | undefined): string | undefined {
	const t = String(value || '').replace(/\s+/g, ' ').trim();
	if (!t || isPagingNoiseTitle(t)) return undefined;
	return t;
}

export function resolveHumanPageTitle(opts: {
	file: string;
	title?: string;
	section?: string;
	menu1?: string;
	menu2?: string;
	navName?: string;
	siteName: string;
	/** Homepage title — reject when subpage inherited the shared chrome title. */
	mainTitle?: string;
	h1?: string;
}): string {
	const stem = basenameFromPath(opts.file).replace(/\.(php|html?|htm|phtml)$/i, '');
	const pathTitle = titleFromPath(opts.file, opts.siteName);
	const siteN = normLabel(opts.siteName);
	const mainN = normLabel(opts.mainTitle || '');
	const isRejected = (value: string): boolean => {
		const t = value.trim();
		if (!t || isPagingNoiseTitle(t) || looksLikeRawUrlOrPath(t) || isCmsPathToken(t)) return true;
		const n = normLabel(t);
		if (siteN && n === siteN) return true;
		if (mainN && n === mainN) return true;
		return false;
	};

	const raw = rejectPagingTitle(opts.title) || '';
	const h1 = rejectPagingTitle(opts.h1) || '';
	const rawIsCode =
		!raw ||
		raw === stem ||
		raw === pathTitle ||
		isCodeLikeFileStem(raw) ||
		(isCodeLikeFileStem(stem) && raw.toLowerCase() === stem.toLowerCase());

	// Prefer page-body H1 over a shared homepage <title> copied into every template.
	if (h1 && !isRejected(h1) && !isCodeLikeFileStem(h1)) return h1;
	if (raw && !rawIsCode && !isRejected(raw)) return raw;
	if (opts.navName?.trim() && !isRejected(opts.navName)) return opts.navName.trim();
	if (opts.section?.trim() && !isRejected(opts.section)) return opts.section.trim();
	if (opts.menu1?.trim() && !isRejected(opts.menu1)) return opts.menu1.trim();
	if (opts.menu2?.trim() && !isRejected(opts.menu2)) return opts.menu2.trim();
	if (raw && !isRejected(raw)) return raw;
	if (h1 && !isPagingNoiseTitle(h1)) return h1;
	const human = humanizePathLabel(opts.file);
	if (human && !looksLikeRawUrlOrPath(human) && !isRejected(human)) return human;
	return pathTitle;
}

function resolveSection(opts: {
	section?: string;
	menu1?: string;
	menu2?: string;
	title: string;
	navName?: string;
}): string {
	return (
		opts.section?.trim() ||
		opts.menu1?.trim() ||
		opts.navName?.trim() ||
		opts.menu2?.trim() ||
		opts.title
	);
}

/** Audit pass band is 70–160; synthesizer targets 75–150 for stable margin. */
const META_DESC_MIN = 75;
const META_DESC_MAX = 150;

/**
 * Description Extender — pad short meta descriptions and trim oversize copy
 * into the 75–150 character optimization band (audit checklist: 70–160).
 */
export function extendMetaDescription(
	raw: string,
	siteName: string,
	title?: string,
): string {
	const site = (siteName || '').trim() || '공식 사이트';
	const t = (title || '').trim();
	let d = (raw || '').trim();
	if (!d) {
		d =
			t && t !== site
				? `${site} ${t} — 상세 안내 및 전문 정보를 확인하세요`
				: `${site} 공식 안내 페이지 — 서비스·진료·상담 정보를 확인하세요`;
	}
	const pads = [
		` ${site}에서 관련 전문 정보와 상담 안내를 확인하실 수 있습니다.`,
		` 방문객에게 신뢰할 수 있는 최신 안내와 전문 상담을 제공합니다.`,
		` 공식 채널을 통해 상세 내용과 이용 방법을 안내합니다.`,
	];
	let padIdx = 0;
	while ([...d].length < META_DESC_MIN && padIdx < pads.length * 3) {
		d = `${d}${pads[padIdx % pads.length]}`.trim();
		padIdx += 1;
	}
	if ([...d].length > META_DESC_MAX) {
		const chars = [...d].slice(0, META_DESC_MAX);
		let cut = chars.join('');
		const sp = cut.lastIndexOf(' ');
		if (sp >= META_DESC_MIN - 5) cut = cut.slice(0, sp);
		d = cut.trim();
	}
	if ([...d].length < META_DESC_MIN) {
		d = `${d}${pads[0]}`.trim();
		if ([...d].length > META_DESC_MAX) d = [...d].slice(0, META_DESC_MAX).join('').trim();
	}
	return d;
}

function fallbackDescription(
	title: string,
	siteName: string,
	existing?: string,
	extra?: { url?: string; gnb?: string; industryType?: string; mainDescription?: string },
): string {
	return resolvePageDescription({
		siteName,
		pageTitle: title,
		url: extra?.url || '',
		gnb: extra?.gnb,
		industryType: extra?.industryType,
		existingMeta: existing,
		mainDescription: extra?.mainDescription,
	});
}

/** Infer breadcrumb menu labels from path / page type (deterministic fallback). */
export function inferMenuLabels(
	urlPath: string,
	pageType: string,
	title: string,
): { menu1: string; menu2: string } {
	const path = (urlPath || '').split('?')[0].replace(/\/+/g, '/');
	const segments = path.replace(/^\//, '').split('/').filter(Boolean);
	const fileStem = basenameFromPath(urlPath).replace(/\.(php|html?|htm)$/i, '');
	const fileKey = `${fileStem}.php`.toLowerCase();
	const humanTitle =
		title &&
		!isCodeLikeFileStem(title) &&
		!looksLikeRawUrlOrPath(title) &&
		!isCmsPathToken(title)
			? title
			: '';

	const typeMenu1: Record<string, string> = {
		AboutPage: '소개',
		ContactPage: '문의',
		FAQPage: 'FAQ',
		CollectionPage: '게시판',
		ItemList: '서비스',
		ProfilePage: '의료진',
		MedicalWebPage: '치료정보',
		Article: '소식',
		Product: '상품',
	};

	let menu1 = '';
	let menu2 = '';

	// Category hubs first (avoid 600–613 / 401 collapsing into 치료정보)
	if (/^6(?:0[0-9]|1[0-3])\.php$/i.test(fileKey)) {
		menu1 = '적용 대상암';
		menu2 =
			humanTitle && normLabel(humanTitle) !== normLabel('적용 대상암')
				? humanTitle
				: /^600\.php$/i.test(fileKey)
					? ''
					: humanTitle || fileStem;
		return { menu1, menu2 };
	}
	if (/^(401|402)\.php$/i.test(fileKey)) {
		menu1 = '해외 병원 네트워크';
		menu2 =
			humanTitle && normLabel(humanTitle) !== normLabel('해외 병원 네트워크') ? humanTitle : '';
		return { menu1, menu2 };
	}
	// Treatment leaves (301–304) / medical content → 치료정보 ➔ current page
	if (
		/^(301|302|303|304)\.php$/i.test(fileKey) ||
		(isMedicalContentPage(urlPath) && !/^(101|201)\.php$/i.test(fileKey))
	) {
		menu1 = '치료정보';
		menu2 = humanTitle || fileStem;
		return { menu1, menu2 };
	}

	if (segments.length >= 2) {
		const parentStem = segments[segments.length - 2].replace(/\.(php|html?|htm)$/i, '');
		if (!isCmsPathToken(parentStem) && !looksLikeRawUrlOrPath(parentStem)) {
			menu1 = humanizePathLabel(`/${parentStem}`) || parentStem.replace(/[-_]+/g, ' ');
			menu2 = humanTitle || humanizePathLabel(urlPath) || '';
		}
	}
	if (!menu1 && typeMenu1[pageType] && humanTitle && normLabel(humanTitle) !== normLabel(typeMenu1[pageType])) {
		menu1 = typeMenu1[pageType];
		menu2 = humanTitle;
	} else if (!menu1 && humanTitle && humanTitle !== fileStem) {
		menu1 = humanTitle;
		menu2 = '';
	} else if (!menu1 && typeMenu1[pageType]) {
		menu1 = typeMenu1[pageType];
		menu2 = isCodeLikeFileStem(fileStem) ? humanTitle : humanTitle || humanizePathLabel(urlPath);
	} else if (!menu1 && fileStem && fileStem !== 'index' && !isCmsPathToken(fileStem) && !isCodeLikeFileStem(fileStem)) {
		menu1 = humanTitle || humanizePathLabel(urlPath);
		menu2 = '';
	}

	return { menu1, menu2 };
}

function defaultKnowsAbout(industryType?: string, siteName?: string): string[] {
	return classifyIndustrySchema({ industryType, siteName }).knowsAbout;
}

/** Menu / board chrome labels that must not enter Organization.knowsAbout. */
const KNOWS_ABOUT_MENU_NOISE_RE =
	/^(bbs|board|게시판|공지|공지사항|뉴스|소식|갤러리|자료실|고객센터|문의|홈|home|qa|faq|qna|login|member|회원|로그인|사이트맵|sitemap|main|index|service\s*details|서비스\s*상세|서비스\s*소개)$/i;

/** Vague / garbage labels banned from knowsAbout and ItemList names. */
const ITEM_LIST_NAME_NOISE_RE =
	/^(service\s*details|서비스\s*상세|서비스\s*소개|service\s*intro(?:duction)?|맞춤\s*치료|전문\s*의료\s*상담|주요\s*서비스|서비스|공지사항|공지|뉴스|소식)$/i;

/** Menu/page chrome that must never bind into #main-services action nodes. */
const ACTION_SERVICE_MENU_NOISE_RE =
	/서비스\s*소개|service\s*details|service\s*intro(?:duction)?|공지사항|\b공지\b|뉴스|소식|안내\s*사항|게시판|\bbbs\b|사이트맵|sitemap|about\s*service|페이지\s*안내|메뉴\s*소개/i;

/** Delivered coordination / support service signals (action services). */
const ACTION_SERVICE_SIGNAL_RE =
	/사전\s*검토|적합성|병원\s*(연계|연결)|전\s*과정\s*지원|해외\s*치료\s*지원|치료\s*지원|코디네이션|eligibility|hospital-support|treatment-support|전문병원\s*연결|해외\s*전문병원|연계\s*지원|상담\s*지원/;

function isKnowsAboutNoise(term: string): boolean {
	const t = term.trim();
	if (!t || t.length < 2 || t.length > 40) return true;
	if (isPagingNoiseTitle(t)) return true;
	if (KNOWS_ABOUT_MENU_NOISE_RE.test(t)) return true;
	if (ITEM_LIST_NAME_NOISE_RE.test(t)) return true;
	if (/^bo_table=/i.test(t)) return true;
	if (/게시판|공지사항|^bbs$/i.test(t)) return true;
	if (/service[-_\s]*details/i.test(t)) return true;
	if (/서비스\s*소개/i.test(t)) return true;
	if (/맞춤\s*치료|전문\s*의료\s*상담/i.test(t)) return true;
	return false;
}

function isItemListNameNoise(term: string): boolean {
	const t = term.trim();
	if (!t || isKnowsAboutNoise(t)) return true;
	if (ITEM_LIST_NAME_NOISE_RE.test(t)) return true;
	if (/service[-_\s]*details/i.test(t)) return true;
	if (ACTION_SERVICE_MENU_NOISE_RE.test(t)) return true;
	return false;
}

/**
 * Cancer-type subpages — #cancer-types ItemList + $page_meta/$page_schema registration.
 * Hub: 600.php · Leaves: 601.php–613.php (live koreaionlab.co.kr mapping).
 */
export const DEFAULT_CANCER_TYPE_PAGES = [
	{ name: '전립선암', file: '601.php' },
	{ name: '폐암', file: '602.php' },
	{ name: '간암', file: '603.php' },
	{ name: '담도암', file: '604.php' },
	{ name: '육종', file: '605.php' },
	{ name: '대장암 수술 후 재발', file: '606.php' },
	{ name: '두경부암', file: '607.php' },
	{ name: '부인과암', file: '608.php' },
	{ name: '신장암', file: '609.php' },
	{ name: '식도암', file: '610.php' },
	{ name: '췌장암', file: '611.php' },
	{ name: '안구종양', file: '612.php' },
	{ name: '전이암·재발암', file: '613.php' },
] as const;

/** Medical GEO seed names — expanded as individual ListItem nodes (not a single hub label). */
export const DEFAULT_CANCER_TYPE_NAMES = DEFAULT_CANCER_TYPE_PAGES.map((c) => c.name);

/** Hub / category labels that must not become #cancer-types ListItems. */
export function isCancerHubLabel(name: string): boolean {
	const t = String(name || '').trim();
	if (!t) return true;
	if (DEFAULT_CANCER_TYPE_NAMES.some((n) => normLabel(n) === normLabel(t))) return false;
	return /적용\s*대상|cancer\s*type|질환\s*안내|대상암|중입자치료\s*대상/i.test(t);
}

/** Resolve a cancer-type ListItem URL to its dedicated leaf (601–613), never the 600 hub. */
export function resolveCancerTypePageUrl(name: string, origin: string, candidateUrl?: string): string {
	const httpsOrigin = enforceHttps(origin).replace(/\/+$/, '');
	const seed = DEFAULT_CANCER_TYPE_PAGES.find((s) => normLabel(s.name) === normLabel(name));
	if (seed) return `${httpsOrigin}/${seed.file}`;
	if (candidateUrl) {
		try {
			const base = basenameFromPath(new URL(candidateUrl).pathname).toLowerCase();
			if (/^6(?:0[1-9]|1[0-3])\.php$/.test(base)) {
				return enforceHttps(candidateUrl.split('#')[0] || candidateUrl);
			}
		} catch {
			/* ignore */
		}
	}
	return `${httpsOrigin}/600.php`;
}

/** Partner hospital seeds with country/region for #hospital-network URL 1:1 mapping. */
export const HOSPITAL_NETWORK_SEEDS = [
	{ name: 'QST 병원', region: 'japan' as const },
	{ name: '오사카중입자선센터', region: 'japan' as const },
	{ name: '군마대학', region: 'japan' as const },
	{ name: '가나가와현립암센터', region: 'japan' as const },
	{ name: '야마가타대학', region: 'japan' as const },
	{ name: '효고현립', region: 'japan' as const },
	{ name: '큐슈국제', region: 'japan' as const },
	{ name: 'HIT', region: 'germany' as const },
	{ name: 'MIT', region: 'germany' as const },
] as const;

export type HospitalNetworkRegion = 'japan' | 'germany' | 'default';

export const DEFAULT_HOSPITAL_NETWORK_NAMES = HOSPITAL_NETWORK_SEEDS.map((h) => h.name);

/** 3대 서비스 — #main-services */
export const DEFAULT_MAIN_SERVICE_NAMES = [
	'적합성 사전 검토',
	'해외 전문병원 연결',
	'해외 치료 지원',
] as const;

/** True when label is a real delivered service (not menu/page chrome). */
export function isActionServiceName(term: string): boolean {
	const t = term.trim();
	if (!t || isItemListNameNoise(t) || ACTION_SERVICE_MENU_NOISE_RE.test(t)) return false;
	if (DEFAULT_MAIN_SERVICE_NAMES.some((n) => normLabel(n) === normLabel(t))) return true;
	return ACTION_SERVICE_SIGNAL_RE.test(t);
}

/**
 * Labeled business-name capture (v10/v11).
 * Order: 상호명/사업자명/회사명 before bare 상호 so longer labels win.
 */
const LABELED_LEGAL_CAPTURE_RE =
	/(?:상호명|법인명|사업자명|회사명|상호)\s*[:：]\s*([^\n|<>]{2,80})/i;

/** Copyright / year sentences — never harvest as legalName sources or candidates. */
const LEGAL_NAME_COPYRIGHT_SENTENCE_RE =
	/copyright|all\s*rights?\s*reserved|©|ⓒ|&copy;|\b(19|20)\d{2}\b/i;

function cleanLegalCandidate(raw: string): string {
	return String(raw || '')
		.replace(/\s*[|/·].*$/, '')
		.replace(/\s*(All\s*Rights?\s*Reserved\.?|무단전재.*|사업자등록번호.*|대표자?[:：].*|전화[:：].*)$/i, '')
		.replace(/^\d{4}\s*[-–.]?\s*/, '')
		.replace(/^(?:©|ⓒ|&copy;|copyright(?:\s*\(c\))?)\s*/i, '')
		.trim();
}

/** True when a string is copyright boilerplate / year-tainted and must not bind to legalName. */
export function isBlockedLegalNameText(value: string): boolean {
	const t = String(value || '').replace(/\s+/g, ' ').trim();
	if (!t) return true;
	if (LEGAL_NAME_COPYRIGHT_SENTENCE_RE.test(t)) return true;
	if (/^(copyright|all\s*rights?\s*reserved)/i.test(t)) return true;
	return false;
}

function isPlausibleLabeledLegalName(cand: string): boolean {
	if (!cand || cand.length < 2 || cand.length > 60) return false;
	if (/^[\d\-\s.:]+$/.test(cand)) return false;
	if (isBlockedLegalNameText(cand)) return false;
	return true;
}

/**
 * Extract a legal entity from footer 사업자 정보 (v10).
 * Only "상호명:" / "법인명:" / "상호:" labeled values are accepted.
 * Copyright / ⓒ / All rights reserved / year-bearing sentences are never harvested.
 */
export function extractLegalEntityFromCorpus(corpus: string, _brandName: string): string | null {
	const text = String(corpus || '').trim();
	if (!text) return null;

	const tryLabeled = (blob: string): string | null => {
		const hit = blob.match(LABELED_LEGAL_CAPTURE_RE);
		if (!hit?.[1]) return null;
		const cand = cleanLegalCandidate(hit[1]);
		if (!isPlausibleLabeledLegalName(cand)) return null;
		return cand;
	};

	// Whole-corpus labeled match first (mixed footer: 상호 + trailing copyright OK)
	const whole = tryLabeled(text);
	if (whole) return whole;

	for (const seg of text.split(/[\n|;]/)) {
		const s = seg.trim();
		if (!s) continue;
		// Pure copyright / year sentences are blocked as harvest sources
		if (isBlockedLegalNameText(s) && !LABELED_LEGAL_CAPTURE_RE.test(s)) continue;
		const hit = tryLabeled(s);
		if (hit) return hit;
	}
	return null;
}

/**
 * Brand (Organization.name) vs legal entity (Organization.legalName) split.
 * When footer 사업자 상호 ≠ brand, legalName is isolated; else brand fallback.
 */
export function resolveBrandAndLegalName(opts: {
	siteName: string;
	legalName?: string;
	copyrightText?: string;
	footerText?: string;
	pageMeta?: Record<string, PageMetaRow>;
}): { brandName: string; legalName: string } {
	const brandName = dedupeRepeatedPhrase(opts.siteName || 'Site') || 'Site';
	const brandKey = normLabel(brandName);
	const explicitRaw = (opts.legalName || '').trim();
	const explicit =
		explicitRaw && !isBlockedLegalNameText(explicitRaw) ? explicitRaw : '';

	// Footer 사업자 정보 preferred when it differs from brand (Legal Entity Isolation)
	const corpus = [opts.footerText, opts.copyrightText].filter(Boolean).join('\n');
	const extracted = extractLegalEntityFromCorpus(corpus, brandName);
	if (extracted && !isBlockedLegalNameText(extracted) && normLabel(extracted) !== brandKey) {
		return { brandName, legalName: extracted };
	}

	if (explicit && normLabel(explicit) !== brandKey) {
		return { brandName, legalName: explicit };
	}

	if (extracted && !isBlockedLegalNameText(extracted)) {
		return { brandName, legalName: extracted };
	}

	return { brandName, legalName: brandName };
}

/** Parsed Organization contact fields from footer scan. */
export type OrgContactInfo = {
	telephone?: string;
	email?: string;
	address?: {
		'@type': 'PostalAddress';
		streetAddress: string;
		addressLocality: string;
		addressRegion: string;
		addressCountry: 'KR';
		postalCode?: string;
	};
};

const FOOTER_PHONE_LABELED_RE =
	/(?:전화(?:번호)?|TEL|Tel|T)\s*[:：]?\s*((?:\+?82[-\s]?)?0?\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4})/;
const FOOTER_PHONE_BARE_RE =
	/(?:^|[^\w@.])((?:0\d{1,2}|\+82[-\s]?\d{1,2})[-\s.]?\d{3,4}[-\s.]?\d{4})(?:$|[^\w@])/;
const FOOTER_EMAIL_LABELED_RE =
	/(?:이메일|E-?mail|메일|Email)\s*[:：]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
const FOOTER_EMAIL_BARE_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

/** Korean region tokens (특별시/광역시/도) for PostalAddress.addressRegion. */
const KR_REGION_RE =
	/(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|제주특별자치도|강원특별자치도|전북특별자치도|경기도|강원도|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|서울시|부산시|대구시|인천시|광주시|대전시|울산시|세종시|제주시|서울|부산|대구|인천|광주|대전|울산|세종|제주)/;

const KR_LOCALITY_RE = /([가-힣]{1,10}(?:시|군|구))/;
const KR_STREET_TAIL_RE =
	/([가-힣0-9\s\-]+?(?:로|길|동|가|읍|면|리)\s*[0-9\-]*(?:\s*[0-9호동층]+)?(?:\s*[0-9]+층)?)/;

/**
 * Parse telephone / email / PostalAddress from footer 사업자·연락처 corpus (v11).
 * Patterns: 02-… phones, …@… emails, …시/구/동/길/층 addresses.
 */
export function extractOrgContactFromFooter(footerText: string): OrgContactInfo {
	const text = String(footerText || '').replace(/\s+/g, ' ').trim();
	if (!text) return {};

	const out: OrgContactInfo = {};

	const phoneHit =
		text.match(FOOTER_PHONE_LABELED_RE)?.[1] || text.match(FOOTER_PHONE_BARE_RE)?.[1] || extractNapFromCorpus(text).telephone;
	if (phoneHit) {
		const tel = formatKoreanTelephone(phoneHit) || phoneHit.replace(/\s+/g, '-').replace(/\.{2,}/g, '.').trim();
		if (tel.length >= 9 && tel.length <= 20) out.telephone = tel;
	}

	const emailHit =
		text.match(FOOTER_EMAIL_LABELED_RE)?.[1] || text.match(FOOTER_EMAIL_BARE_RE)?.[1];
	if (emailHit && !/example\.com$/i.test(emailHit)) {
		out.email = emailHit.trim();
	}

	const addrLabeled = text.match(
		/(?:주소|소재지|주소지)\s*[:：]?\s*([가-힣0-9\s\-.,()]{8,120})/,
	);
	const addrBlob = (addrLabeled?.[1] || text).trim();
	const regionHit = addrBlob.match(KR_REGION_RE);
	if (regionHit) {
		const afterRegion = addrBlob.slice((regionHit.index || 0) + regionHit[0].length).trim();
		const localityHit = afterRegion.match(KR_LOCALITY_RE);
		const locality = localityHit?.[1]?.trim() || '';
		const afterLocality = locality
			? afterRegion.slice((localityHit!.index || 0) + localityHit![0].length).trim()
			: afterRegion;
		const streetHit = afterLocality.match(KR_STREET_TAIL_RE);
		let street = (streetHit?.[1] || afterLocality)
			.replace(/^(?:주소|소재지|주소지)\s*[:：]?\s*/, '')
			.replace(/\s*(?:전화|TEL|이메일|E-?mail|메일|상호|사업자).*$/i, '')
			.replace(/[|,;]+$/, '')
			.trim();
		// Keep 시/구 signal in locality when region was abbreviated (서울 → 서울특별시-style keep as-is)
		const region = regionHit[1];
		if (street.length >= 2 || locality) {
			const postalHit =
				text.match(/(?:우편번호|우편|ZIP)\s*[:：]?\s*(\d{5})/i)?.[1] || text.match(/\b(\d{5})\b/)?.[1];
			out.address = {
				'@type': 'PostalAddress',
				streetAddress: street || locality,
				addressLocality: locality || street.split(/\s+/)[0] || '',
				addressRegion: region,
				addressCountry: 'KR',
				...(postalHit ? { postalCode: postalHit } : {}),
			};
			// Prefer street as road/jibun; if street fell back to locality, clear duplicate locality noise
			if (out.address.streetAddress === out.address.addressLocality && afterLocality) {
				out.address.streetAddress = afterLocality
					.replace(/\s*(?:전화|TEL|이메일|E-?mail|메일|상호|사업자).*$/i, '')
					.trim() || out.address.streetAddress;
			}
		}
	}

	return out;
}

/** Emit PHP array fragment for Organization telephone/email/address (optional keys). */
function phpOrgContactBindings(contact: OrgContactInfo, indent = '\t\t\t\t'): string {
	const lines: string[] = [];
	if (contact.telephone) {
		lines.push(`${indent}'telephone' => ${phpSingleQuoted(contact.telephone)},`);
	}
	if (contact.email) {
		lines.push(`${indent}'email' => ${phpSingleQuoted(contact.email)},`);
	}
	const a = contact.address;
	lines.push(`${indent}'address' => array(`);
	lines.push(`${indent}\t'@type' => 'PostalAddress',`);
	if (a?.postalCode) {
		lines.push(`${indent}\t'postalCode' => ${phpSingleQuoted(a.postalCode)},`);
	} else {
		lines.push(`${indent}\t'postalCode' => $postal_code,`);
	}
	lines.push(
		`${indent}\t'streetAddress' => ${a?.streetAddress ? phpSingleQuoted(a.streetAddress) : '$street_address'},`,
	);
	lines.push(
		`${indent}\t'addressLocality' => ${a?.addressLocality ? phpSingleQuoted(a.addressLocality) : '$locality'},`,
	);
	lines.push(`${indent}\t'addressRegion' => ${a?.addressRegion ? phpSingleQuoted(a.addressRegion) : '$region'},`);
	lines.push(`${indent}\t'addressCountry' => 'KR',`);
	lines.push(`${indent}),`);
	return lines.join('\n');
}

/** 4대 치료 — #treatments → 301~304.php */
export const DEFAULT_TREATMENT_NAMES = [
	{ name: '중입자치료', file: '301.php' },
	{ name: '양성자치료', file: '302.php' },
	{ name: 'BNCT 중성자포획치료', file: '303.php' },
	{ name: '세포·면역치료', file: '304.php' },
] as const;

function absoluteUrlFromNav(url: string, origin: string): string {
	const httpsOrigin = enforceHttps(origin).replace(/\/+$/, '');
	const raw = String(url || '').trim();
	if (!raw) return `${httpsOrigin}/`;
	if (/^https?:\/\//i.test(raw)) return enforceHttps(raw);
	const hashIdx = raw.indexOf('#');
	const pathPart = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
	const hash = hashIdx >= 0 ? raw.slice(hashIdx) : '';
	const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
	return `${httpsOrigin}${path}${hash}`;
}

/** Top-level GNB category inferred from file code / title (Parent Fallback Hierarchy). */
export function inferTopCategoryForFile(
	file: string,
	title = '',
): { name: string; aliases: string[]; nameRe: RegExp; hubFile?: string } | null {
	const f = String(file || '').toLowerCase();
	const hay = `${f} ${title}`;
	if (isBoardListPath(file) || /board\.php/i.test(f)) {
		return { name: '게시판', aliases: ['고객센터', '커뮤니티'], nameRe: /게시판|고객센터|커뮤니티/ };
	}
	// Cancer hub (600) + leaves (601–613) → parent 적용 대상암 @ /600.php
	if (/(?:^|[/?])6(?:0[0-9]|1[0-3])\.php(?:[?#]|$)/i.test(f) || /암종|적용\s*대상/.test(title)) {
		return {
			name: '적용 대상암',
			aliases: ['암종정보', '암종', '대상암', '중입자치료 대상암'],
			nameRe: /적용\s*대상|암종|대상암/,
			hubFile: '600.php',
		};
	}
	if (/(?:^|[/?])(401|402)\.php(?:[?#]|$)/i.test(f) || /병원\s*네트워크|제휴\s*병원|해외\s*병원/.test(title)) {
		return {
			name: '해외 병원 네트워크',
			aliases: ['병원안내', '제휴병원', '병원 네트워크'],
			nameRe: /병원\s*네트워크|제휴\s*병원|해외\s*병원/,
			hubFile: /402/.test(f) ? '402.php' : '401.php',
		};
	}
	if (
		/(?:^|[/?])(301|302|303|304)\.php(?:[?#]|$)/i.test(f) ||
		(isMedicalContentPage(hay) &&
			!/(?:^|[/?])(?:101|201|6(?:0[0-9]|1[0-3])|401|402)\.php(?:[?#]|$)/i.test(f))
	) {
		return {
			name: '치료정보',
			aliases: ['치료안내', '진료안내', '치료'],
			nameRe: /치료\s*정보|치료\s*안내|진료\s*안내/,
			hubFile: '301.php',
		};
	}
	return null;
}

/**
 * Reverse-trace GNB menu structure for a missing breadcrumb parent.
 * Supports nested `children`, explicit `parent` on leaves, and file-code category hubs.
 */
export function reverseTraceGnbParent(opts: {
	file: string;
	title: string;
	nav?: SchemaNavItem[];
	origin: string;
}): { parent: string; parent_url: string } | null {
	const home = opts.origin.replace(/\/+$/, '') + '/';
	const nav = opts.nav || [];
	const fileKey = (sanitizePageFileKey(opts.file) || opts.file).toLowerCase();
	const titleN = normLabel(opts.title);

	const asParent = (name: string, url?: string): { parent: string; parent_url: string } | null => {
		const label = (name || '').trim();
		if (!label || normLabel(label) === titleN) return null;
		const parentUrl = url ? absoluteUrlFromNav(url, opts.origin) : home;
		const parentFile = url ? sanitizePageFileKey(url) : null;
		if (parentFile && parentFile.toLowerCase() === fileKey) return null;
		return { parent: label, parent_url: parentUrl || home };
	};

	// ① Nested children: current leaf under a 1차 GNB node
	for (const n of nav) {
		if (!n.children?.length) continue;
		const hit = n.children.some((c) => {
			const ck = sanitizePageFileKey(c.url);
			return ck != null && ck.toLowerCase() === fileKey;
		});
		if (hit) {
			const resolved = asParent(n.name, n.url);
			if (resolved) return resolved;
		}
	}

	// ② Explicit parent on flattened leaf nav row
	const selfNav = nav.find((n) => {
		const nk = sanitizePageFileKey(n.url);
		return nk != null && nk.toLowerCase() === fileKey;
	});
	if (selfNav?.parent?.trim()) {
		const parentNav = nav.find((n) => normLabel(n.name) === normLabel(selfNav.parent || ''));
		const resolved = asParent(selfNav.parent, parentNav?.url);
		if (resolved) return resolved;
	}

	// ③ File-code / semantic category → match GNB hub label (e.g. 치료정보)
	const category = inferTopCategoryForFile(opts.file, opts.title);
	if (category) {
		const catNav = nav.find(
			(n) =>
				normLabel(n.name) === normLabel(category.name) ||
				category.aliases.some((a) => normLabel(n.name) === normLabel(a)) ||
				category.nameRe.test(n.name),
		);
		if (catNav) {
			const resolved = asParent(catNav.name, catNav.url);
			if (resolved) return resolved;
		}
		// No GNB hub URL — bind category label (+ hubFile when known, e.g. 601→600.php)
		const hubUrl = category.hubFile ? `/${category.hubFile}` : undefined;
		const resolved = asParent(category.name, hubUrl);
		if (resolved) return resolved;
	}

	return null;
}

/**
 * Assign breadcrumb parent / parent_url for subpages (section hierarchy).
 * v9: when parent is empty, reverse-trace GNB for 1차 상위 메뉴 (Parent Fallback Hierarchy).
 * Board lists default parent to "게시판" when no GNB section match exists.
 * v11: homepage (index.php / index.html / /) always returns empty parent + parent_url.
 */
export function resolveParentHierarchy(opts: {
	file: string;
	title: string;
	section: string;
	menu1: string;
	menu2: string;
	nav?: SchemaNavItem[];
	origin: string;
}): { parent: string; parent_url: string } {
	// Index Parent Sanitization — no upper hierarchy on main page
	if (isHomepageFile(opts.file)) {
		return { parent: '', parent_url: '' };
	}

	const home = opts.origin.replace(/\/+$/, '') + '/';
	const parentLabel = (opts.menu1 || opts.section || '').trim();
	const titleN = normLabel(opts.title);
	const fileKey = (sanitizePageFileKey(opts.file) || opts.file).toLowerCase();

	if (parentLabel && normLabel(parentLabel) !== titleN) {
		const navHit = (opts.nav || []).find((n) => normLabel(n.name) === normLabel(parentLabel));
		if (navHit?.url) {
			const parentUrl = absoluteUrlFromNav(navHit.url, opts.origin);
			const parentFile = sanitizePageFileKey(navHit.url);
			// Avoid parent pointing at the same page
			if (parentFile && parentFile.toLowerCase() !== fileKey) {
				return { parent: parentLabel, parent_url: parentUrl };
			}
		}
		return { parent: parentLabel, parent_url: home };
	}

	// v9 Parent Fallback — GNB reverse-trace when menu1/section collapsed into title
	const gnbParent = reverseTraceGnbParent({
		file: opts.file,
		title: opts.title,
		nav: opts.nav,
		origin: opts.origin,
	});
	if (gnbParent?.parent) return gnbParent;

	if (isBoardListPath(opts.file) || /board\.php/i.test(opts.file)) {
		return { parent: '게시판', parent_url: home };
	}

	if (opts.menu2 && opts.menu1 && normLabel(opts.menu1) !== titleN) {
		return { parent: opts.menu1, parent_url: home };
	}

	return { parent: '', parent_url: '' };
}

type MainListBucket = {
	id: string;
	name: string;
	items: Array<{ name: string; url: string }>;
};

type ItemListKind = 'services' | 'treatments' | 'cancer' | 'hospital';

/** Semantic bucket classifier for homepage ItemList graph nodes (audit-driven). */
export function classifyItemListKind(hay: string, pageType?: string): ItemListKind | null {
	const h = String(hay || '').toLowerCase();
	if (!h || /board\.php|공지|뉴스|bbs|login|member/.test(h)) return null;

	// Coordination / support services first (hash anchors like #hospital-support must not → hospital)
	if (
		/적합성|사전\s*검토|전\s*과정\s*지원|해외\s*치료\s*지원|코디네이션|eligibility|hospital-support|treatment-support|사전검토|해외병원연계/.test(
			h,
		)
	) {
		return 'services';
	}

	if (
		/네트워크|제휴|협력|파트너|partner|해외\s*병원\s*네트워크|병원\s*안내|particle|중입자.?센터|입자선|제휴\s*병원|협력\s*병원/.test(
			h,
		) &&
		!/치료\s*정보|시술\s*안내|연결\b|지원\b/.test(h)
	) {
		return 'hospital';
	}
	// Named partner hospitals (QST, HIT, …) without “network” chrome
	if (/\b(qst|hit|mit)\b|오사카중입자|군마대학|가나가와|야마가타|효고현립|큐슈국제/.test(h)) {
		return 'hospital';
	}
	if (/암종|적용\s*대상|cancer\s*type|carcinoma|대상암|\w암\b|종양\b|질환/.test(h) && !/병원/.test(h)) {
		return 'cancer';
	}
	if (
		pageType === 'MedicalWebPage' ||
		/치료|시술|therapy|treatment|세포치료|줄기세포|백신|중입자|양성자|방사선/.test(h)
	) {
		if (/연결\b|지원\b|코디|검토/.test(h) && !/중입자치료|양성자치료|세포치료/.test(h)) {
			return 'services';
		}
		return 'treatments';
	}
	if (/서비스|service|상담|지원|프로그램|코디|검토|안내/.test(h) || pageType === 'ItemList') {
		return 'services';
	}
	return null;
}

function findHubUrl(
	candidates: Array<{ name: string; url: string; hay: string; kind: ItemListKind | null }>,
	kind: ItemListKind,
	origin: string,
): string {
	const hit = candidates.find((c) => c.kind === kind);
	return hit?.url || `${origin}/`;
}

function candidateBasename(url: string): string {
	try {
		return basenameFromPath(new URL(url).pathname).toLowerCase();
	} catch {
		const path = (url.split('#')[0] || url).split('?')[0] || '';
		return basenameFromPath(path).toLowerCase();
	}
}

function stripUrlHash(url: string): string {
	return enforceHttps((url.split('#')[0] || url).replace(/\/+$/, '') || url);
}

/** Classify partner hospital / network label into country region for URL binding. */
export function classifyHospitalRegion(nameOrHay: string): HospitalNetworkRegion {
	const h = String(nameOrHay || '');
	if (/\b(hit|mit)\b|하이델베르크|마르부르크|독일|germany|deutschland|heidelberg|marburg/i.test(h)) {
		return 'germany';
	}
	if (
		/\b(qst)\b|오사카|군마|가나가와|야마가타|효고|큐슈|일본|japan|중입자선|니혼|도쿄|osaka|gunma/i.test(h)
	) {
		return 'japan';
	}
	return 'default';
}

/**
 * Country/category → hub URL 1:1 cross-validation.
 * 일본 병원 카테고리 ➔ /401.php · 독일 병원 카테고리 ➔ /402.php (audit labels override defaults).
 */
export function resolveNetworkHubByRegion(
	candidates: Array<{ name: string; url: string; hay: string; kind: ItemListKind | null }>,
	origin: string,
): Record<HospitalNetworkRegion, string> {
	const httpsOrigin = origin.replace(/\/+$/, '');
	let japanUrl = '';
	let germanyUrl = '';
	let defaultUrl = '';

	const scoreRegionUrl = (region: 'japan' | 'germany', url: string, hay: string, base: string) => {
		const clean = stripUrlHash(url);
		const preferred = region === 'japan' ? '401.php' : '402.php';
		const labelHit =
			region === 'japan'
				? /일본|japan|니혼/i.test(hay)
				: /독일|germany|deutschland/i.test(hay);
		const fileHit = base === preferred;
		if (!labelHit && !fileHit) return;
		const current = region === 'japan' ? japanUrl : germanyUrl;
		// Prefer explicit country label + preferred file; then preferred file; then labeled URL
		const prefer =
			(labelHit && fileHit) ||
			(!current && fileHit) ||
			(!current && labelHit) ||
			(fileHit && current && !current.toLowerCase().includes(preferred));
		if (prefer) {
			if (region === 'japan') japanUrl = clean;
			else germanyUrl = clean;
		}
	};

	for (const c of candidates) {
		const base = candidateBasename(c.url);
		const hay = `${c.name} ${c.hay} ${c.url}`;
		scoreRegionUrl('japan', c.url, hay, base);
		scoreRegionUrl('germany', c.url, hay, base);
		if (!defaultUrl && (c.kind === 'hospital' || /네트워크|제휴|협력|partner/i.test(hay))) {
			defaultUrl = stripUrlHash(c.url);
		}
	}

	// File-level fallback cross-check even without country labels in nav text
	for (const c of candidates) {
		const base = candidateBasename(c.url);
		if (base === '401.php' && !japanUrl) japanUrl = stripUrlHash(c.url);
		if (base === '402.php' && !germanyUrl) germanyUrl = stripUrlHash(c.url);
	}

	if (!japanUrl) japanUrl = `${httpsOrigin}/401.php`;
	if (!germanyUrl) germanyUrl = `${httpsOrigin}/402.php`;
	if (!defaultUrl) defaultUrl = japanUrl;

	return { japan: japanUrl, germany: germanyUrl, default: defaultUrl };
}

/** Classify nav/pages into main GEO ItemList buckets for homepage graph. */
export function buildMainPageItemListBuckets(opts: {
	origin: string;
	pageMeta: Record<string, PageMetaRow>;
	nav?: Array<{ name: string; url: string }>;
	knowsAbout?: string[];
	industryType?: string;
}): MainListBucket[] {
	const origin = enforceHttps(opts.origin).replace(/\/+$/, '');
	const industry = (opts.industryType || 'GENERAL').toUpperCase();
	/** Name-only uniqueness (array_unique by item) — same treatment must not map to 301.php + 302.php. */
	const usedNames = new Set<string>();

	const pushUnique = (
		bucket: Array<{ name: string; url: string }>,
		name: string,
		url: string,
	) => {
		const label = name.trim();
		if (!label || isItemListNameNoise(label)) return;
		const key = normLabel(label);
		if (!key || usedNames.has(key)) return;
		usedNames.add(key);
		bucket.push({ name: label, url: enforceHttps(url) });
	};

	const services: Array<{ name: string; url: string }> = [];
	const treatments: Array<{ name: string; url: string }> = [];
	const cancerTypes: Array<{ name: string; url: string }> = [];
	const hospitalNetwork: Array<{ name: string; url: string }> = [];

	const candidates: Array<{ name: string; url: string; hay: string; kind: ItemListKind | null }> = [];

	// Prefer nav (keeps #fragment anchors for precise service binding)
	for (const n of opts.nav || []) {
		if (!n?.name || !n?.url || isGarbagePageFile(n.url.split('#')[0] || n.url)) continue;
		if (isItemListNameNoise(n.name)) continue;
		const file = sanitizePageFileKey(n.url);
		if (!file || file === 'index.php' || file === 'index.html') continue;
		const hay = `${n.name} ${n.url}`;
		const kind = classifyItemListKind(hay);
		candidates.push({
			name: n.name.trim(),
			url: absoluteUrlFromNav(n.url, origin),
			hay: hay.toLowerCase(),
			kind,
		});
	}

	const navFiles = new Set(
		(opts.nav || [])
			.map((n) => sanitizePageFileKey(n.url)?.toLowerCase())
			.filter(Boolean) as string[],
	);

	for (const [file, row] of Object.entries(opts.pageMeta)) {
		if (file === 'index.php' || file === 'index.html' || isGarbagePageFile(file)) continue;
		if (navFiles.has(file.toLowerCase())) continue; // nav already contributed (possibly with hash)
		const name = (row.section || row.title || file).trim();
		if (isItemListNameNoise(name) || isKnowsAboutNoise(name)) continue;
		const hay = `${name} ${file} ${row.type}`;
		const kind = classifyItemListKind(hay, row.type);
		candidates.push({
			name,
			url: absoluteUrlFromNav(`/${file}`, origin),
			hay: hay.toLowerCase(),
			kind,
		});
	}

	const regionHubs = resolveNetworkHubByRegion(candidates, origin);
	const hospitalHub = regionHubs.default || regionHubs.japan || `${origin}/401.php`;
	const treatmentHub = findHubUrl(candidates, 'treatments', origin);
	const serviceHub = findHubUrl(candidates, 'services', origin);

	for (const c of candidates) {
		if (c.kind === 'hospital') {
			// Hub / category pages (해외 병원 네트워크, 일본 병원) are containers — expand real hospitals below
			if (
				/네트워크|안내|partner|제휴\s*병원|협력\s*병원|일본\s*병원|독일\s*병원/i.test(c.name) &&
				!/QST|HIT|MIT|대학|센터/i.test(c.name)
			) {
				continue;
			}
			const region = classifyHospitalRegion(`${c.name} ${c.hay}`);
			const hub = regionHubs[region] || regionHubs.default;
			pushUnique(hospitalNetwork, c.name, hub);
		} else if (c.kind === 'cancer') {
			// Hub labels ("적용 대상암") are expanded into per-cancer ListItems below
			if (isCancerHubLabel(c.name)) continue;
			pushUnique(cancerTypes, c.name, resolveCancerTypePageUrl(c.name, origin, c.url));
		} else if (c.kind === 'treatments') pushUnique(treatments, c.name, c.url);
		else if (c.kind === 'services') {
			// Action Service Filter: drop menu/page chrome (서비스 소개, 공지사항, …)
			if (!isActionServiceName(c.name)) continue;
			pushUnique(services, c.name, c.url);
		}
	}

	// Expand semantic knowsAbout terms onto the matching hub URL (not bare origin)
	for (const k of opts.knowsAbout || []) {
		const t = k.trim();
		if (!t || isKnowsAboutNoise(t) || isItemListNameNoise(t)) continue;
		const hay = t.toLowerCase();
		const kind = classifyItemListKind(hay);
		if (kind === 'cancer' && cancerTypes.length < 13) {
			if (isCancerHubLabel(t)) continue;
			pushUnique(cancerTypes, t, resolveCancerTypePageUrl(t, origin));
		} else if (kind === 'hospital' && hospitalNetwork.length < 12) {
			const region = classifyHospitalRegion(t);
			pushUnique(hospitalNetwork, t, regionHubs[region] || hospitalHub);
		} else if (kind === 'treatments' && treatments.length < 4) pushUnique(treatments, t, treatmentHub);
		else if (kind === 'services' && services.length < 3 && isActionServiceName(t)) {
			pushUnique(services, t, serviceHub);
		}
	}

	if (industry === 'MEDICAL') {
		// #main-services: bind real coordination services only (Action Service Filter)
		const coordBase =
			candidates.find((c) => /201\.php|eligibility|hospital-support|treatment-support/i.test(c.url))?.url ||
			(serviceHub !== `${origin}/` ? serviceHub : `${origin}/201.php`);
		const coordPath = (coordBase.split('#')[0] || coordBase).replace(/\/+$/, '');
		// Drop any chrome that slipped in before seeding canonical action services
		for (let i = services.length - 1; i >= 0; i--) {
			if (!isActionServiceName(services[i]!.name)) {
				usedNames.delete(normLabel(services[i]!.name));
				services.splice(i, 1);
			}
		}
		for (const name of DEFAULT_MAIN_SERVICE_NAMES) {
			const nameKey = normLabel(name);
			const navHit = candidates.find((c) => {
				if (c.kind !== 'services') return false;
				if (!isActionServiceName(c.name)) return false;
				const ck = normLabel(c.name);
				return ck === nameKey || ck.includes(nameKey.slice(0, 6)) || nameKey.includes(ck.slice(0, 6));
			});
			let url = navHit?.url;
			if (!url) {
				if (/병원|hospital|연계|연결/i.test(name)) url = `${coordPath}#hospital-support`;
				else if (/치료\s*지원|treatment/i.test(name)) url = `${coordPath}#treatment-support`;
				else url = `${coordPath}#eligibility-review`;
			}
			pushUnique(services, name, url);
		}

		// #treatments: bind 4대 치료 → 301~304.php (name-unique; never duplicate across URLs)
		for (const t of DEFAULT_TREATMENT_NAMES) {
			if (treatments.length >= 4) break;
			const nameKey = normLabel(t.name);
			const navHit = candidates.find((c) => {
				if (c.kind !== 'treatments') return false;
				const ck = normLabel(c.name);
				return ck === nameKey || ck.includes(nameKey.slice(0, 4)) || nameKey.includes(ck.slice(0, 4));
			});
			const url = navHit?.url || `${origin}/${t.file}`;
			pushUnique(treatments, t.name, url);
		}

		// #cancer-types: 1:1 leaf map only when the live GNB/page map already has a cancer hub.
		const hasCancerHub =
			Boolean(opts.pageMeta['600.php']) ||
			DEFAULT_CANCER_TYPE_PAGES.some((c) => Boolean(opts.pageMeta[c.file])) ||
			(opts.nav || []).some((n) => /적용\s*대상|암종|대상암/i.test(n.name || ''));
		if (hasCancerHub) {
			for (const prev of cancerTypes) usedNames.delete(normLabel(prev.name));
			cancerTypes.length = 0;
			for (const t of DEFAULT_CANCER_TYPE_PAGES) {
				pushUnique(cancerTypes, t.name, `${origin}/${t.file}`);
			}
		}

		// #hospital-network: expand partner hospitals with country URL 1:1 (일본→401, 독일→402)
		for (const seed of HOSPITAL_NETWORK_SEEDS) {
			if (hospitalNetwork.length >= 9) break;
			const url = regionHubs[seed.region] || regionHubs.default || hospitalHub;
			pushUnique(hospitalNetwork, seed.name, url);
		}
	} else if (services.length === 0) {
		for (const k of (opts.knowsAbout || []).slice(0, 3)) {
			if (!isKnowsAboutNoise(k) && !isItemListNameNoise(k) && isActionServiceName(k)) {
				pushUnique(services, k, serviceHub);
			}
		}
		if (services.length === 0) pushUnique(services, '전문 상담', `${origin}/`);
	}

	const buckets: MainListBucket[] = [
		{ id: 'main-services', name: '주요 서비스', items: services.slice(0, 3) },
		{ id: 'treatments', name: '주요 치료 정보', items: treatments.slice(0, 4) },
		{ id: 'cancer-types', name: '적용 대상 / 질환', items: cancerTypes.slice(0, 13) },
		{ id: 'hospital-network', name: '병원 네트워크', items: hospitalNetwork.slice(0, 9) },
	];

	if (industry !== 'MEDICAL') {
		return buckets.filter((b) => b.id === 'main-services' || b.items.length > 0);
	}
	return buckets.filter((b) => b.items.length > 0);
}

/** Flat ListItem (position/name/url) — required for #cancer-types / #hospital-network (no Service type). */
function phpPlainListItems(
	items: Array<{ name: string; url: string }>,
	indent = '\t\t\t\t',
): string {
	return items
		.map(
			(item, i) => `${indent}array(
${indent}\t'@type' => 'ListItem',
${indent}\t'position' => ${i + 1},
${indent}\t'name' => ${phpSingleQuoted(item.name)},
${indent}\t'url' => ${phpSingleQuoted(item.url)},
${indent}),`,
		)
		.join('\n');
}

/** ListItem wrapping Service — used for #main-services / #treatments action nodes only. */
function phpServiceListItems(
	items: Array<{ name: string; url: string }>,
	indent = '\t\t\t\t',
): string {
	return items
		.map(
			(item, i) => `${indent}array(
${indent}\t'@type' => 'ListItem',
${indent}\t'position' => ${i + 1},
${indent}\t'item' => array(
${indent}\t\t'@type' => 'Service',
${indent}\t\t'name' => ${phpSingleQuoted(item.name)},
${indent}\t\t'url' => ${phpSingleQuoted(item.url)},
${indent}\t\t'provider' => array('@id' => $origin . '/#organization'),
${indent}\t),
${indent}),`,
		)
		.join('\n');
}

function phpBucketListItems(bucketId: string, items: Array<{ name: string; url: string }>): string {
	// Semantic precision: disease / partner lists must not claim @type Service
	if (bucketId === 'cancer-types' || bucketId === 'hospital-network') {
		return phpPlainListItems(items);
	}
	return phpServiceListItems(items);
}

export function buildKnowsAboutKeywords(input: {
	knowsAbout?: string[];
	mappingKnowsAbout?: string[];
	industryType?: string;
	siteName: string;
	pageMeta: Record<string, PageMetaRow>;
}): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const push = (v?: string) => {
		const t = (v || '').trim();
		if (!t || isKnowsAboutNoise(t)) return;
		if (normLabel(t) === normLabel(input.siteName)) return;
		const key = t.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		out.push(t);
	};

	for (const k of input.knowsAbout || []) push(k);
	for (const k of input.mappingKnowsAbout || []) push(k);

	// Only semantic treatment / service / disease page titles — never board/menu chrome
	for (const row of Object.values(input.pageMeta)) {
		const hay = `${row.title} ${row.section} ${row.type}`;
		const kind = classifyItemListKind(hay, row.type);
		if (row.type === 'MedicalWebPage' || kind === 'treatments' || kind === 'services' || kind === 'cancer') {
			if (row.title && row.title !== input.siteName) push(row.title);
			if (row.section && row.section !== row.title) push(row.section);
		}
	}

	for (const k of defaultKnowsAbout(input.industryType, input.siteName)) push(k);

	return out.slice(0, 16);
}

/** Build Organization.areaServed from audit hints + corpus country signals. */
export function buildAreaServed(input: {
	areaServed?: string[];
	pageMeta: Record<string, PageMetaRow>;
	knowsAbout: string[];
	siteName: string;
}): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const push = (v?: string) => {
		const t = (v || '').trim();
		if (!t || seen.has(t)) return;
		seen.add(t);
		out.push(t);
	};

	for (const a of input.areaServed || []) push(a);

	const corpus = [
		input.siteName,
		...input.knowsAbout,
		...Object.values(input.pageMeta).flatMap((r) => [r.title, r.description, r.section]),
	].join(' ');

	if (/일본|japan/i.test(corpus)) push('일본');
	if (/독일|germany|deutschland/i.test(corpus)) push('독일');
	if (/미국|u\.?s\.?a|america/i.test(corpus)) push('미국');
	if (/중국|china/i.test(corpus)) push('중국');
	if (/대한민국|한국|korea|\.kr\b/i.test(corpus) || out.length === 0) push('대한민국');

	// Stable order: home country first when present
	const home = out.filter((x) => x === '대한민국');
	const rest = out.filter((x) => x !== '대한민국');
	return [...home, ...rest].slice(0, 8);
}

/**
 * Build the compact SchemaMappingJson that an LLM would emit.
 * Deterministic / zero-token path from audit_payload — use when LLM is skipped.
 */
export function buildSchemaMappingJson(input: DynamicPhpSchemaInput): SchemaMappingJson {
	const pages: Record<string, SchemaMappingPage> = {};
	const selectedPages = (input.pages || []).filter((page) => page.selected !== false);
	const list =
		selectedPages.length > 0
			? selectedPages
			: input.allowEmptyPageMap
				? []
				: [
						{
							urlPath: '/',
							title: input.siteName,
							description: '',
							h1: input.siteName,
							pageType: normalizePageType(undefined, input.industryType),
						},
					];

	const navHint = input.navItems || input.mappingJson?.nav;

	for (const page of list) {
		if (/(^|\/)(robots\.txt|sitemap\.xml|llms\.txt|llms-full\.txt)(\?|$)/i.test(String(page.urlPath || '').trim())) continue;
		const file = sanitizePageFileKey(page.urlPath);
		if (!file) continue;

		const navName = findNavNameForFile(file, navHint);
		const provisionalTitle = page.title || navName || page.h1 || titleFromPath(page.urlPath, input.siteName);
		const schemaType = refineAssignedPageType(
			file,
			page.pageType || inferPageTypeFromPath(page.urlPath, input.industryType, provisionalTitle),
			provisionalTitle,
			page.section || '',
		);
		const menus =
			page.menu1 || page.menu2
				? { menu1: page.menu1 || '', menu2: page.menu2 || '' }
				: inferMenuLabels(page.urlPath, schemaType, provisionalTitle);

		const title = resolveHumanPageTitle({
			file,
			title: page.title,
			section: page.section,
			menu1: menus.menu1,
			menu2: menus.menu2,
			navName,
			siteName: input.siteName,
			h1: page.h1,
		});
		const section = resolveSection({
			section: page.section,
			menu1: menus.menu1,
			menu2: menus.menu2,
			title,
			navName,
		});
		const finalType = refineAssignedPageType(file, schemaType, title, section);

		pages[file] = {
			title,
			desc: fallbackDescription(title, input.siteName, page.description, {
				url: page.urlPath,
				gnb: [page.section, menus.menu1, menus.menu2, navName].filter(Boolean).join(' '),
				industryType: input.industryType,
			}),
			schemaType: finalType,
			section,
			menu1: menus.menu1 || undefined,
			menu2: menus.menu2 || undefined,
			h1: page.h1?.trim() || title,
			extraTypes: page.extraTypes?.length
				? page.extraTypes.filter((t) => !(finalType === 'CollectionPage' && t === 'FAQPage'))
				: undefined,
		};
	}

	const origin = resolveHttpsOrigin(input.targetUrl, '');
	const nav =
		input.navItems && input.navItems.length > 0
			? input.navItems
					.filter((n) => n.name && n.url && !isGarbagePageFile(n.url.split('#')[0] || n.url))
					.map((n) => ({
						name: n.name,
						url: origin ? absoluteUrlFromNav(n.url, origin) : n.url,
					}))
			: Object.entries(pages)
					.filter(([file]) => file !== 'index.php' && file !== 'index.html')
					.slice(0, 8)
					.map(([file, meta]) => ({
						name: meta.section || meta.menu1 || meta.title || file,
						url: origin ? absoluteUrlFromNav(`/${file}`, origin) : `/${file}`,
					}));

	return {
		pages,
		nav,
		siteName: input.siteName,
		imageUrl: input.imageUrl ? enforceHttps(input.imageUrl) : undefined,
		knowsAbout: input.knowsAbout,
	};
}

/** Parse / normalize LLM (or tool) output into SchemaMappingJson. */
export function parseSchemaMappingJson(raw: unknown): SchemaMappingJson | null {
	if (!raw || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	const pagesRaw = obj.pages;
	if (!pagesRaw || typeof pagesRaw !== 'object') return null;

	const pages: Record<string, SchemaMappingPage> = {};
	for (const [key, value] of Object.entries(pagesRaw as Record<string, unknown>)) {
		if (!value || typeof value !== 'object') continue;
		const file = sanitizePageFileKey(String(key));
		if (!file) continue;

		const row = value as Record<string, unknown>;
		const titleRaw = String(row.title ?? row.name ?? '').trim();
		const desc = String(row.desc ?? row.description ?? '').trim();
		const section =
			row.section != null
				? String(row.section).trim()
				: row.menu1 != null
					? String(row.menu1).trim()
					: undefined;
		const menu1 = row.menu1 != null ? String(row.menu1) : undefined;
		const menu2 = row.menu2 != null ? String(row.menu2) : undefined;
		const title =
			resolveHumanPageTitle({
				file,
				title: titleRaw,
				section,
				menu1,
				menu2,
				siteName: file,
			}) || file;
		const schemaType = refineAssignedPageType(
			file,
			String(row.schemaType ?? row.pageType ?? row.type ?? 'WebPage').trim() || 'WebPage',
			title,
			section || '',
		);

		pages[file] = {
			title,
			desc,
			schemaType,
			section: section || title,
			menu1,
			menu2,
			h1: row.h1 != null ? String(row.h1) : title,
			extraTypes: Array.isArray(row.extraTypes)
				? row.extraTypes
						.map((t) => String(t))
						.filter((t) => t && !(schemaType === 'CollectionPage' && t === 'FAQPage'))
				: undefined,
		};
	}
	if (Object.keys(pages).length === 0) return null;

	const nav = Array.isArray(obj.nav)
		? obj.nav
				.filter((n): n is { name: string; url: string } =>
					Boolean(n && typeof n === 'object' && (n as { name?: string }).name && (n as { url?: string }).url),
				)
				.filter((n) => !isGarbagePageFile(n.url))
				.map((n) => ({ name: String(n.name), url: String(n.url) }))
		: undefined;

	const knowsAbout = Array.isArray(obj.knowsAbout)
		? obj.knowsAbout.map((k) => String(k).trim()).filter(Boolean)
		: undefined;

	return {
		pages,
		nav,
		siteName: obj.siteName != null ? String(obj.siteName) : undefined,
		imageUrl: obj.imageUrl != null ? String(obj.imageUrl) : undefined,
		knowsAbout,
	};
}

/** Convert compact mapping JSON → AuditPageMeta[] for internal builders. */
export function schemaMappingToAuditPages(mapping: SchemaMappingJson): AuditPageMeta[] {
	return Object.entries(mapping.pages).map(([file, row]) => ({
		urlPath: `/${file}`,
		title: row.title,
		description: row.desc,
		h1: row.h1 || row.title,
		pageType: row.schemaType,
		extraTypes: row.extraTypes,
		section: row.section || row.menu1 || row.title,
		menu1: row.menu1,
		menu2: row.menu2,
	}));
}

/** Single-@type route row compiled into `$schema_pages`. */
export type SchemaPageRoute = {
	file: string;
	type: string;
	name: string;
	url: string;
};

/**
 * Build `$schema_pages` from crawled GNB + selected subpages.
 * AboutPage (소개/시설/장비) · ProfilePage (의료진) · ContactPage (오시는길) ·
 * MedicalWebPage (진료/수술) · WebPage (일반 기업 서비스).
 */
export function buildSchemaPageRoutes(input: {
	pages?: AuditPageMeta[];
	navItems?: SchemaNavItem[];
	pageMeta?: Record<string, PageMetaRow>;
	industryType?: string;
	siteName?: string;
	origin?: string;
	targetUrl?: string;
}): SchemaPageRoute[] {
	const origin = resolveHttpsOrigin(input.origin || input.targetUrl, '');
	const site = input.siteName || 'Site';
	const seen = new Set<string>();
	const out: SchemaPageRoute[] = [];
	const push = (rawFile: string, type: string, name: string, url: string) => {
		const file = sanitizePageFileKey(rawFile);
		if (!file || isGarbagePageFile(file)) return;
		const key = file.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		const refined = refineAssignedPageType(file, type, name, name);
		out.push({
			file,
			type: refined,
			name: name || file,
			url: origin ? absoluteUrlFromNav(url || `/${file}`, origin) : url || `/${file}`,
		});
	};

	if (input.pageMeta) {
		for (const [file, meta] of Object.entries(input.pageMeta)) {
			push(file, meta.type, meta.title || meta.section || file, `/${file}`);
		}
	}
	for (const page of input.pages || []) {
		if (page.selected === false) continue;
		const file = sanitizePageFileKey(page.urlPath);
		if (!file) continue;
		const title = page.title || titleFromPath(page.urlPath, site);
		const type = refineAssignedPageType(
			file,
			page.pageType || inferPageTypeFromPath(page.urlPath, input.industryType, title),
			title,
			page.section || '',
		);
		push(file, type, title, page.urlPath);
	}
	const walkNav = (items?: Array<{ name: string; url: string; children?: Array<{ name: string; url: string }> }>) => {
		for (const n of items || []) {
			if (!n?.url || !n.name) continue;
			const type = inferPageTypeFromPath(n.url, input.industryType, n.name);
			push(n.url, type, n.name, n.url);
			if (n.children?.length) walkNav(n.children);
		}
	};
	walkNav(input.navItems);
	return out;
}

function buildSchemaPagesPhp(routes: SchemaPageRoute[], indent = '\t\t'): string {
	if (!routes.length) return `${indent}$schema_pages = array();`;
	const entries = routes.map((r) => [r.file, { type: r.type, name: r.name, url: r.url }] as [string, Record<string, string>]);
	return `${indent}$schema_pages = ${phpAssocArray(entries, indent)};`;
}

/** Runtime overlay: `$schema_pages` lookup, then title/URL classifier. */
function buildSchemaPagesResolvePhp(indent = '\t\t'): string {
	return `${indent}if ( ! isset($schema_pages) || ! is_array($schema_pages) ) { $schema_pages = array(); }
${indent}$_sp_key = isset($page_file) ? $page_file : ( isset($seo_file) ? $seo_file : ( isset($page_base) ? $page_base : '' ) );
${indent}if ( is_string($_sp_key) && $_sp_key !== '' && isset($schema_pages[$_sp_key]) && is_array($schema_pages[$_sp_key]) && ! empty($schema_pages[$_sp_key]['type']) ) {
${indent}	$page_type = $schema_pages[$_sp_key]['type'];
${indent}} elseif ( isset($page_base) && is_string($page_base) && isset($schema_pages[$page_base]) && is_array($schema_pages[$page_base]) && ! empty($schema_pages[$page_base]['type']) ) {
${indent}	$page_type = $schema_pages[$page_base]['type'];
${indent}} elseif ( function_exists('redue_infer_page_schema_type') && ( ! isset($page_type) || $page_type === 'WebPage' ) ) {
${indent}	$_sp_hay = ( isset($page_title) ? $page_title : '' ) . ' ' . ( isset($canonical_url) ? $canonical_url : '' ) . ' ' . ( isset($schema_meta_title) ? $schema_meta_title : '' ) . ' ' . ( isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '' ) . ' ' . ( isset($_SERVER['SCRIPT_NAME']) ? (string) $_SERVER['SCRIPT_NAME'] : '' );
${indent}	$_sp_medical = isset($is_medical_org) ? (bool) $is_medical_org : ( function_exists('redue_is_medical_org') && redue_is_medical_org() );
${indent}	$_sp_inferred = redue_infer_page_schema_type($_sp_hay, $_sp_medical);
${indent}	if ( $_sp_inferred !== 'WebPage' ) { $page_type = $_sp_inferred; }
${indent}}
${indent}if ( ! empty($gnb_items) && is_array($gnb_items) ) {
${indent}	foreach ( $gnb_items as $_gnb ) {
${indent}		if ( empty($_gnb['item']) || empty($_gnb['name']) ) { continue; }
${indent}		$_gnb_path = parse_url((string) $_gnb['item'], PHP_URL_PATH);
${indent}		$_gnb_file = basename(is_string($_gnb_path) && $_gnb_path !== '' ? $_gnb_path : (string) $_gnb['item']);
${indent}		if ( $_gnb_file === '' || $_gnb_file === '/' || $_gnb_file === '.' ) { continue; }
${indent}		if ( isset($schema_pages[$_gnb_file]) ) { continue; }
${indent}		$_gnb_medical = isset($is_medical_org) ? (bool) $is_medical_org : ( function_exists('redue_is_medical_org') && redue_is_medical_org() );
${indent}		$schema_pages[$_gnb_file] = array(
${indent}			'type' => function_exists('redue_infer_page_schema_type') ? redue_infer_page_schema_type((string) $_gnb['name'] . ' ' . (string) $_gnb['item'], $_gnb_medical) : 'WebPage',
${indent}			'name' => (string) $_gnb['name'],
${indent}			'url' => (string) $_gnb['item'],
${indent}		);
${indent}	}
${indent}}`;
}

function buildHasPartFromSchemaPagesPhp(indent = '\t\t\t'): string {
	return `${indent}$_has_part = array();
${indent}if ( isset($schema_pages) && is_array($schema_pages) ) {
${indent}	foreach ( $schema_pages as $_sp_file => $_sp ) {
${indent}		if ( ! is_array($_sp) ) { continue; }
${indent}		if ( $_sp_file === 'index.php' || $_sp_file === 'index.html' || $_sp_file === 'index.htm' ) { continue; }
${indent}		$_sp_url = ! empty($_sp['url']) ? (string) $_sp['url'] : ( rtrim($origin, '/') . '/' . ltrim((string) $_sp_file, '/') );
${indent}		$_sp_type = ! empty($_sp['type']) ? (string) $_sp['type'] : 'WebPage';
${indent}		$_has_part[] = array(
${indent}			'@type' => $_sp_type,
${indent}			'@id' => $_sp_url . '#webpage',
${indent}			'name' => ! empty($_sp['name']) ? (string) $_sp['name'] : (string) $_sp_file,
${indent}			'url' => $_sp_url,
${indent}		);
${indent}	}
${indent}}`;
}

/** Collapse audit pages / mapping JSON into filename-keyed meta + schema maps. */
export function buildPageMaps(input: DynamicPhpSchemaInput): {
	pageMeta: Record<string, PageMetaRow>;
	pageSchema: Record<string, string[]>;
	mainFile: string;
} {
	const mapping = input.mappingJson || buildSchemaMappingJson(input);
	const navHint = input.navItems || mapping.nav;
	const origin = resolveHttpsOrigin(input.targetUrl);
	const pageMeta: Record<string, PageMetaRow> = {};
	const pageSchema: Record<string, string[]> = {};
	let mainFile = 'index.php';
	let i = 0;

	for (const [rawFile, row] of Object.entries(mapping.pages)) {
		const file = sanitizePageFileKey(rawFile);
		if (!file) continue;

		if (i === 0) mainFile = file;
		i += 1;

		const navName = findNavNameForFile(file, navHint);
		const menus =
			row.menu1 || row.menu2
				? { menu1: row.menu1 || '', menu2: row.menu2 || '' }
				: inferMenuLabels(
						file,
						normalizePageType(row.schemaType, input.industryType),
						row.title || navName || titleFromPath(file, input.siteName),
					);

		const title = resolveHumanPageTitle({
			file,
			title: row.title,
			section: row.section,
			menu1: menus.menu1,
			menu2: menus.menu2,
			navName,
			siteName: input.siteName,
			h1: row.h1,
		});
		const section = resolveSection({
			section: row.section,
			menu1: menus.menu1,
			menu2: menus.menu2,
			title,
			navName,
		});
		const pageType = refineAssignedPageType(file, row.schemaType || 'WebPage', title, section);
		const description = fallbackDescription(title, input.siteName, row.desc, {
			url: file,
			gnb: [section, menus.menu1, menus.menu2, navName].filter(Boolean).join(' '),
			industryType: input.industryType,
		});
		const h1 = row.h1?.trim() || title;
		const parent = resolveParentHierarchy({
			file,
			title,
			section,
			menu1: menus.menu1,
			menu2: menus.menu2,
			nav: navHint,
			origin,
		});

		pageMeta[file] = {
			title,
			description,
			section,
			h1,
			type: pageType,
			menu1: menus.menu1,
			menu2: menus.menu2,
			parent: parent.parent,
			parent_url: parent.parent_url ? enforceHttps(parent.parent_url) : '',
		};

		// Homepage: WebPage + BreadcrumbList; parent/parent_url force-empty (Index Parent Sanitization)
		if (isHomepageFile(file)) {
			pageMeta[file].type = 'WebPage';
			pageMeta[file].parent = '';
			pageMeta[file].parent_url = '';
			pageSchema[file] = ['WebPage', 'BreadcrumbList'];
			continue;
		}

		const schemas = new Set<string>([pageType, 'BreadcrumbList']);
		for (const extra of row.extraTypes || []) {
			if (
				extra &&
				extra !== 'Article' &&
				extra !== 'MedicalWebPage' &&
				!(pageType === 'CollectionPage' && extra === 'FAQPage')
			) {
				schemas.add(extra);
			}
		}
		if (pageType === 'FAQPage') schemas.add('FAQPage');
		if (pageType === 'CollectionPage') schemas.add('CollectionPage');
		if (pageType === 'ItemList') schemas.add('ItemList');
		if (pageType === 'ProfilePage') schemas.add('Person');
		if (/howto/i.test((row.extraTypes || []).join(' '))) schemas.add('HowTo');
		pageSchema[file] = [...schemas];
	}

	if (Object.keys(pageMeta).length === 0) {
		pageMeta['index.php'] = {
			title: input.siteName,
			description: fallbackDescription(input.siteName, input.siteName, ''),
			section: input.siteName,
			h1: input.siteName,
			type: 'WebPage',
			menu1: '',
			menu2: '',
			parent: '',
			parent_url: '',
		};
		pageSchema['index.php'] = ['WebPage', 'BreadcrumbList'];
		mainFile = 'index.php';
	}

	if (mainFile !== 'index.php' && !pageMeta['index.php']) {
		pageMeta['index.php'] = {
			...pageMeta[mainFile],
			type: 'WebPage',
			parent: '',
			parent_url: '',
		};
		pageSchema['index.php'] = ['WebPage', 'BreadcrumbList'];
	}
	// Final homepage sanitization — WebPage only + empty parent/parent_url (v11)
	for (const home of ['index.php', 'index.html', 'index.htm'] as const) {
		if (!pageMeta[home] && home !== 'index.php') continue;
		if (pageMeta[home]) {
			pageMeta[home] = {
				...pageMeta[home],
				type: 'WebPage',
				parent: '',
				parent_url: '',
			};
			pageSchema[home] = ['WebPage', 'BreadcrumbList'];
		}
	}
	if (!pageMeta['index.html'] && pageMeta['index.php']) {
		pageMeta['index.html'] = {
			...pageMeta['index.php'],
			type: 'WebPage',
			parent: '',
			parent_url: '',
		};
		pageSchema['index.html'] = ['WebPage', 'BreadcrumbList'];
	}

	// Register cancer-type leaves 601–613 in $page_meta / $page_schema (parent → 600.php)
	ensureCancerTypeSubpages(pageMeta, pageSchema, {
		origin,
		siteName: input.siteName,
		industryType: input.industryType,
		nav: navHint,
	});

	return { pageMeta, pageSchema, mainFile };
}

/** True when the site has a cancer hub/leaf signal so 601–613 should be registered. */
function shouldRegisterCancerTypeSubpages(
	pageMeta: Record<string, PageMetaRow>,
	nav?: Array<{ name: string; url: string; parent?: string; children?: Array<{ name: string; url: string }> }>,
	industryType?: string,
): boolean {
	if (pageMeta['600.php']) return true;
	if (DEFAULT_CANCER_TYPE_PAGES.some((c) => Boolean(pageMeta[c.file]))) return true;
	if (
		(nav || []).some((n) => {
			const key = sanitizePageFileKey(n.url)?.toLowerCase();
			if (key === '600.php' || (key != null && /^6(?:0[1-9]|1[0-3])\.php$/.test(key))) return true;
			return /적용\s*대상|암종|대상암/i.test(n.name || '');
		})
	) {
		return true;
	}
	// Only when the crawled site actually exposes a cancer hub / leaf — never invent
	// koreaionlab 601–613 pages for an unrelated clinic.
	return false;
}

/**
 * Ensure 601.php–613.php exist in $page_meta / $page_schema as MedicalWebPage
 * with breadcrumb parent pointing at hub 600.php (crawler discovery).
 */
function ensureCancerTypeSubpages(
	pageMeta: Record<string, PageMetaRow>,
	pageSchema: Record<string, string[]>,
	opts: {
		origin: string;
		siteName: string;
		industryType?: string;
		nav?: Array<{ name: string; url: string; parent?: string; children?: Array<{ name: string; url: string }> }>;
	},
): void {
	if (!shouldRegisterCancerTypeSubpages(pageMeta, opts.nav, opts.industryType)) return;

	const origin = enforceHttps(opts.origin).replace(/\/+$/, '');
	const hubUrl = `${origin}/600.php`;

	if (!pageMeta['600.php']) {
		pageMeta['600.php'] = {
			title: '적용 대상암',
			description: fallbackDescription('적용 대상암', opts.siteName, ''),
			section: '적용 대상암',
			h1: '적용 대상암',
			type: 'MedicalWebPage',
			menu1: '적용 대상암',
			menu2: '',
			parent: '',
			parent_url: '',
		};
		pageSchema['600.php'] = ['MedicalWebPage', 'BreadcrumbList'];
	}

	for (const c of DEFAULT_CANCER_TYPE_PAGES) {
		const existing = pageMeta[c.file];
		if (existing) {
			if (existing.type !== 'MedicalWebPage' && isMedicalContentPage(c.file)) {
				existing.type = 'MedicalWebPage';
			}
			if (!existing.parent?.trim() || normLabel(existing.parent) === normLabel(existing.title)) {
				existing.parent = '적용 대상암';
			}
			if (!existing.parent_url?.trim() || /\/600\.php$/i.test(existing.parent_url) === false) {
				existing.parent_url = hubUrl;
			}
			if (!existing.menu1?.trim()) existing.menu1 = '적용 대상암';
			if (!existing.menu2?.trim()) existing.menu2 = existing.title || c.name;
			if (!existing.section?.trim()) existing.section = '적용 대상암';
			const schemas = new Set(pageSchema[c.file] || [existing.type, 'BreadcrumbList']);
			schemas.add('MedicalWebPage');
			schemas.add('BreadcrumbList');
			pageSchema[c.file] = [...schemas];
			continue;
		}

		pageMeta[c.file] = {
			title: c.name,
			description: fallbackDescription(c.name, opts.siteName, ''),
			section: '적용 대상암',
			h1: c.name,
			type: 'MedicalWebPage',
			menu1: '적용 대상암',
			menu2: c.name,
			parent: '적용 대상암',
			parent_url: hubUrl,
		};
		pageSchema[c.file] = ['MedicalWebPage', 'BreadcrumbList'];
	}
}

function phpAssocArray(
	entries: Array<[string, Record<string, string> | string[]]>,
	indent = '\t',
): string {
	if (entries.length === 0) return 'array()';
	const lines: string[] = ['array('];
	for (const [key, value] of entries) {
		if (Array.isArray(value)) {
			const inner = value.map((v) => phpSingleQuoted(v)).join(', ');
			lines.push(`${indent}\t${phpSingleQuoted(key)} => array(${inner}),`);
		} else {
			lines.push(`${indent}\t${phpSingleQuoted(key)} => array(`);
			for (const [k, v] of Object.entries(value)) {
				lines.push(`${indent}\t\t${phpSingleQuoted(k)} => ${phpSingleQuoted(v)},`);
			}
			lines.push(`${indent}\t),`);
		}
	}
	lines.push(`${indent})`);
	return lines.join('\n');
}

function phpStringMap(entries: Array<[string, string]>, indent = '\t'): string {
	if (entries.length === 0) return 'array()';
	const lines: string[] = ['array('];
	for (const [key, value] of entries) {
		lines.push(`${indent}\t${phpSingleQuoted(key)} => ${phpSingleQuoted(value)},`);
	}
	lines.push(`${indent})`);
	return lines.join('\n');
}

function phpStringList(values: string[], indent = '\t\t\t'): string {
	if (values.length === 0) return 'array()';
	return `array(\n${values.map((v) => `${indent}\t${phpSingleQuoted(v)},`).join('\n')}\n${indent})`;
}

export function isGnuboardCmsType(cmsType?: string): boolean {
	const s = String(cmsType || '').toLowerCase();
	return /gnuboard|그누보드|youngcart|영카트|\bg5\b/.test(s);
}

/**
 * Fresh industry → Schema.org @type mapping per diagnosis.
 * Uses title / description / GNB / footer from the *current* site only.
 */
function gnuboardOrgTypePhp(industryType?: string, siteName?: string, extra?: IndustrySchemaInput): string {
	return orgTypesToPhpArray(
		classifyIndustrySchema({
			industryType,
			siteName,
			title: extra?.title,
			description: extra?.description,
			menuTexts: extra?.menuTexts,
			body: extra?.body,
			footerText: extra?.footerText,
		}).orgTypes,
	);
}

function industryCorpusFromSchemaInput(input: {
	siteName?: string;
	industryType?: string;
	footerText?: string;
	pages?: Array<{ title?: string; section?: string; h1?: string }>;
	navItems?: Array<{ name?: string }>;
}): IndustrySchemaInput {
	const menuTexts = [
		...(input.navItems || []).map((n) => n.name || ''),
		...(input.pages || []).flatMap((p) => [p.title || '', p.section || '', p.h1 || '']),
	].filter(Boolean);
	return {
		industryType: input.industryType,
		siteName: input.siteName,
		title: input.siteName,
		description: menuTexts.join(' '),
		menuTexts,
		footerText: input.footerText,
	};
}

/** Human-readable @type list from a PHP `array('A', 'B')` literal, e.g. "A, B". */
function phpArrayLiteralToReadableList(phpArrayLiteral: string): string {
	return phpArrayLiteral
		.replace(/^array\(\s*/, '')
		.replace(/\s*\)$/, '')
		.split(',')
		.map((s) => s.trim().replace(/^'/, '').replace(/'$/, ''))
		.filter(Boolean)
		.join(', ');
}

/**
 * Phase 4 output guide: top-of-file analysis comment stating the detected
 * [1] protocol, [2] industry/org-type mapping, [3] subpage @type routing —
 * required so the final code is self-documenting for the target project.
 */
function buildEngineAnalysisHeaderComment(opts: {
	targetUrl?: string;
	protocolMode: 'runtime-detect' | 'static-origin';
	orgTypesPhp: string;
	pages: Array<{ urlPath: string; title?: string; pageType?: string }>;
}): string {
	const protocolLine =
		opts.protocolMode === 'runtime-detect'
			? " *   런타임 자동 감지 — redue_detect_site_protocol() 이 요청 시점의 SSL 여부를 확인해\n *   인증서가 있으면 https, 없으면 http 를 그대로 유지합니다 (강제 https 변환 없음)."
			: ` *   ${opts.targetUrl && /^https:\/\//i.test(opts.targetUrl) ? 'HTTPS (SSL 적용됨)' : 'HTTP (SSL 미적용 — https 강제 변환 없음)'} — 감지된 origin: ${opts.targetUrl || '(런타임 결정)'}  `;

	const orgTypesReadable = phpArrayLiteralToReadableList(opts.orgTypesPhp);

	const pageLines = opts.pages.length
		? opts.pages
				.map((p) => {
					const isMain = p.urlPath === '/' || p.urlPath === '';
					const type = isMain ? 'WebPage (mainEntity=Organization, hasPart=주요 서비스)' : p.pageType || 'WebPage';
					const label = `${p.urlPath}${p.title ? ` (${p.title})` : ''}`;
					return ` *   - ${label.padEnd(28)} → ${type}`;
				})
				.join('\n')
		: ' *   - 사이트맵 데이터 미제공 — 각 요청 URL/제목 패턴을 기준으로 런타임에 자동 분류됨 (about/contact/board/main)';

	return `/**
 * ═══════════════════════════════════════════════════════════════════════
 *  REDUE Universal Schema Engine — Phase 4 자동 분석 결과 요약
 * ═══════════════════════════════════════════════════════════════════════
 * [1] Protocol (프로토콜)
${protocolLine}
 *
 * [2] Industry Mapping (업종 매핑)
 *   런타임 자동 추론 — $config['cf_title'] · _SHOP_/G5_USE_SHOP · 푸터/본문 키워드
 *   의료 → MedicalClinic, Physician, LocalBusiness
 *   쇼핑몰 → OnlineStore, Store, LocalBusiness
 *   일반 → LocalBusiness, Organization
 *   EducationalOrganization 등 무관 타입은 키워드가 있을 때만 사용 (기본값 오염 금지)
 *   컴파일 시드(있을 경우) → ${orgTypesReadable}
 *
 * [3] Subpage Routing (서브페이지 분기 — Type Stacking 금지, 페이지당 단일 @type)
${pageLines}
 *
 *   ※ FAQPage/HowTo는 페이지에 실제 존재하는 Q&A/절차가 바인딩된 경우에만 생성됩니다 (가상 데이터 금지).
 *   ※ sameAs는 자사 도메인을 제외한 실제 운영 중인 공식 외부 채널만 포함합니다.
 * ═══════════════════════════════════════════════════════════════════════
 */
`;
}

/**
 * Fully automated Gnuboard Universal Dynamic engine: no static $page_meta,
 * no compile-time address/phone/industry payload from another site.
 * Reads $config / $g5_head_title / $board / $view / g5_menu at request time.
 */
export function buildGnuboardAutomatedRuntimeEnginePhp(input: {
	siteName?: string;
	industryType?: string;
	/** Workspace seed for `$GLOBALS['redue_tel']` — runtime still falls back to CMS/DOM. */
	telephone?: string;
	/** Real street extracted from this site's footer/theme — never a dummy. */
	streetAddress?: string;
	addressLocality?: string;
	addressRegion?: string;
	postalCode?: string;
	legalName?: string;
	fax?: string;
	taxId?: string;
	representativeName?: string;
	representativeTitle?: string;
	pages?: AuditPageMeta[];
	navItems?: SchemaNavItem[];
	footerText?: string;
	openingHoursOpens?: string;
	openingHoursCloses?: string;
	latitude?: string;
	longitude?: string;
	sameAs?: string[];
	medicalSpecialty?: string[];
	isAcceptingNewPatients?: boolean;
}): string {
	const industryInput = industryCorpusFromSchemaInput(input);
	const industryProfile = classifyIndustrySchema(industryInput);
	const compiledRep = resolveEngineRepresentative({
		adminName: input.representativeName,
		adminTitle: input.representativeTitle,
		industryType: input.industryType,
	});
	const repName = String(compiledRep.name || '').trim();
	const repTitle = String(input.representativeTitle || (compiledRep.isExtracted ? compiledRep.jobTitle : '') || '').trim();
	const seededTel = bindTelephone(input.telephone || '');
	const orgTypes = gnuboardOrgTypePhp(input.industryType, input.siteName, industryInput);
	const alternateHint = splitAlternateName(input.siteName || '');
	const seoMetaEntries: Array<[string, string]> = [];
	for (const page of input.pages || []) {
		const file = sanitizePageFileKey(page.urlPath);
		if (!file || isGarbagePageFile(file)) continue;
		const desc = String(page.description || '').trim();
		if (desc) seoMetaEntries.push([file, desc]);
	}
	const schemaRoutes = buildSchemaPageRoutes({
		pages: input.pages,
		navItems: input.navItems,
		industryType: input.industryType,
		siteName: input.siteName,
	});
	const analysisHeaderPhp = buildEngineAnalysisHeaderComment({
		targetUrl: undefined,
		protocolMode: 'runtime-detect',
		orgTypesPhp: orgTypes,
		pages: (input.pages || []).map((p) => ({ urlPath: p.urlPath, title: p.title, pageType: p.pageType })),
	});

	return sanitizeGeneratedPhpSnippet(`<?php
${analysisHeaderPhp}/* ${REDUE_SCHEMA_MARKER_START} — REDUE AUTOMATED UNIVERSAL SCHEMA ENGINE (GnuBoard Dynamic) */

${buildGnuboardLegacyCompatPhp()}
${buildUniversalGraphGlobalsSeedPhp({
	repName,
	repTitle,
	tel: seededTel,
	street: input.streetAddress,
	taxId: input.taxId,
	fax: input.fax,
	lat: input.latitude,
	lng: input.longitude,
	openingHoursOpens: input.openingHoursOpens,
	openingHoursCloses: input.openingHoursCloses,
	sameAs: input.sameAs,
	pages: input.pages,
	navItems: input.navItems,
	industryType: input.industryType,
	siteName: input.siteName,
	bakeStreet: false,
})}
$GLOBALS['redue_org_type']  = ${orgTypes}; // 기본 기관 타입 — 하드코딩 NAP 없이 상단 변수만 참조
$GLOBALS['redue_legal_name'] = ${phpSingleQuoted(String(input.legalName || '').trim())};
$GLOBALS['redue_fax'] = ${phpSingleQuoted(String(input.fax || '').trim())};
$GLOBALS['redue_strict_nap'] = true;

${buildUniversalObRegistrationPhp()}

if ( ! function_exists( 'redue_dynamic_schema_controller_safe' ) ) {
	function redue_dynamic_schema_controller_safe() {
		static $executed = false;
		if ( $executed ) return;
		$executed = true;
		try {
			if ( function_exists( 'redue_dynamic_schema_controller_body' ) ) {
				redue_dynamic_schema_controller_body();
			}
		} catch (\\Exception $_redue_schema_err) {} catch (\\Throwable $_redue_schema_err) {}
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller' ) ) {
	function redue_dynamic_schema_controller() {
		redue_dynamic_schema_controller_safe();
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller_body' ) ) {
	function redue_dynamic_schema_controller_body() {
		if ( function_exists( 'redue_auto_detect_footer_info' ) ) {
			redue_auto_detect_footer_info();
		}
		global $config, $g5, $g5_head_title, $bo_table, $wr_id, $co_id, $view, $write, $board;

		$origin = function_exists('redue_site_origin')
			? redue_site_origin()
			: (defined('G5_URL') && G5_URL !== ''
				? rtrim(G5_URL, '/')
				: ((function_exists('redue_detect_site_protocol') ? redue_detect_site_protocol() : 'http') . '://' . preg_replace('#:\\d+$#', '', isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost')));
		$site_name = function_exists('redue_resolve_site_name')
			? redue_resolve_site_name()
			: ( ! empty($config['cf_title']) ? trim(strip_tags((string) $config['cf_title'])) : '' );
		if ( $site_name === '' ) { $site_name = '웹사이트'; }
		$canonical_url = function_exists('redue_get_exact_canonical') ? redue_get_exact_canonical() : ($origin . '/');
		$is_main = ($canonical_url === $origin . '/' || $canonical_url === $origin);

		$page_title = $site_name;
		$page_desc = $site_name;
		$page_type = 'WebPage';
		$image_url = isset($GLOBALS['redue_logo']) && is_string($GLOBALS['redue_logo']) && trim($GLOBALS['redue_logo']) !== ''
			? trim($GLOBALS['redue_logo'])
			: '';
		$domain_host = parse_url($origin, PHP_URL_HOST);
		if ( ! is_string($domain_host) || $domain_host === '' ) {
			$domain_host = preg_replace('#^https?://#i', '', $origin);
			$domain_host = preg_replace('#/.*$#', '', $domain_host);
		}
${buildGeoAeoBindingsPhp({
	siteName: input.siteName || 'Site',
	pages: input.pages || [],
	industryType: input.industryType,
	navItems: input.navItems,
	openingHoursOpens: input.openingHoursOpens,
	openingHoursCloses: input.openingHoursCloses,
	latitude: input.latitude,
	longitude: input.longitude,
	sameAs: input.sameAs,
	medicalSpecialty: input.medicalSpecialty,
	isAcceptingNewPatients: input.isAcceptingNewPatients,
}, { includePostalBinds: false, strictRealNap: true })}
		if ( ! isset($postal_code) ) { $postal_code = ""; }
		if ( ! isset($street_address) ) { $street_address = isset($GLOBALS['redue_street']) && is_string($GLOBALS['redue_street']) ? trim($GLOBALS['redue_street']) : ""; }
		if ( ! isset($locality) ) { $locality = ""; }
		if ( ! isset($region) ) { $region = ""; }
${buildUniversalGraphApplyPhp()}
${buildSchemaPagesPhp(schemaRoutes)}
		$knows_about = is_array($medical_specialty) ? $medical_specialty : array();
		if ( count($knows_about) === 0 && is_array($available_services) ) {
			foreach ( $available_services as $_ks ) {
				if ( is_array($_ks) && ! empty($_ks['name']) ) { $knows_about[] = (string) $_ks['name']; }
			}
		}

		$runtime_bo = !empty($bo_table) ? (string) $bo_table : (isset($_GET['bo_table']) ? (string) $_GET['bo_table'] : '');
		$runtime_wr = !empty($wr_id) ? (string) $wr_id : (isset($_GET['wr_id']) ? (string) $_GET['wr_id'] : '');
		$runtime_co = !empty($co_id) ? (string) $co_id : (isset($_GET['co_id']) ? (string) $_GET['co_id'] : '');

		$org_types = function_exists('redue_infer_org_types')
			? redue_infer_org_types()
			: ( ! empty($GLOBALS['redue_org_type']) ? $GLOBALS['redue_org_type'] : array('LocalBusiness', 'Organization') );
		$org_type_hay = is_array($org_types) ? implode(' ', $org_types) : (string) $org_types;
		$is_medical_org = (bool) preg_match('/MedicalClinic|VeterinaryCare|Physician|Hospital|Dentist/i', $org_type_hay);
		$_route_hay = $canonical_url . ' '
			. ( isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '' ) . ' '
			. ( isset($_SERVER['SCRIPT_NAME']) ? (string) $_SERVER['SCRIPT_NAME'] : '' );

		if ( $is_main && $runtime_bo === '' && $runtime_wr === '' && $runtime_co === '' ) {
			$page_title = $site_name;
			$page_desc = function_exists('redue_compose_official_description')
				? redue_compose_official_description($site_name, $site_name, true)
				: ( $site_name . ' 공식 웹사이트입니다.' );
			$page_type = 'WebPage';
		} elseif ( $runtime_wr !== '' && ( !empty($view['wr_subject']) || !empty($write['wr_subject']) ) ) {
			$subj = !empty($view['wr_subject']) ? $view['wr_subject'] : $write['wr_subject'];
			$cont = !empty($view['wr_content']) ? $view['wr_content'] : (isset($write['wr_content']) ? $write['wr_content'] : '');
			$page_title = trim(strip_tags((string) $subj));
			$page_desc = function_exists('redue_summarize_body_text')
				? redue_summarize_body_text($cont, 140)
				: (function_exists('mb_substr') ? mb_substr(trim(preg_replace('/\\s+/', ' ', strip_tags((string) $cont))), 0, 140, 'UTF-8') : substr(trim(preg_replace('/\\s+/', ' ', strip_tags((string) $cont))), 0, 140));
			if ( $page_desc === '' ) { $page_desc = $page_title; }
			$page_type = 'Article';
		} elseif ( $runtime_bo !== '' ) {
			$page_title = ! empty($board['bo_subject']) ? (string) $board['bo_subject'] : $runtime_bo;
			$page_desc = function_exists('redue_compose_official_description')
				? redue_compose_official_description($site_name, $page_title, false)
				: ( $site_name . ' ' . $page_title . ' 공식 안내입니다.' );
			$page_type = 'CollectionPage';
		} elseif ( $runtime_co !== '' ) {
			$page_title = !empty($g5_head_title) ? (string) $g5_head_title : $runtime_co;
			$page_desc = function_exists('redue_compose_official_description')
				? redue_compose_official_description($site_name, $page_title, false)
				: ( $site_name . ' ' . $page_title . ' 공식 안내입니다.' );
			$page_type = function_exists('redue_infer_page_schema_type')
				? redue_infer_page_schema_type($page_title . ' ' . $_route_hay, $is_medical_org)
				: 'WebPage';
		} elseif ( !empty($g5_head_title) ) {
			$page_title = (string) $g5_head_title;
			$page_desc = function_exists('redue_compose_official_description')
				? redue_compose_official_description($site_name, $page_title, false)
				: ( $site_name . ' ' . $page_title . ' 공식 안내입니다.' );
			$page_type = function_exists('redue_infer_page_schema_type')
				? redue_infer_page_schema_type($page_title . ' ' . $_route_hay, $is_medical_org)
				: 'WebPage';
		}

		$seo_meta_map = ${phpStringMap(seoMetaEntries)};
		$seo_req = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
		$seo_path = parse_url($seo_req, PHP_URL_PATH);
		$seo_query = parse_url($seo_req, PHP_URL_QUERY);
		$seo_file = basename(is_string($seo_path) && $seo_path !== '' ? $seo_path : '/');
		if ( $seo_file === '' || $seo_file === '/' || $seo_file === '.' ) { $seo_file = 'index.php'; }
		if ( is_string($seo_query) && $seo_query !== '' ) {
			parse_str($seo_query, $seo_qs);
			foreach ( array('bo_table', 'co_id', 'it_id', 'ca_id') as $id_key ) {
				if ( isset($seo_qs[$id_key]) && $seo_qs[$id_key] !== '' && preg_match('/^[a-zA-Z0-9_-]{1,40}$/', (string) $seo_qs[$id_key]) ) {
					$seo_file = $seo_file . '?' . $id_key . '=' . $seo_qs[$id_key];
					break;
				}
			}
		}
		$seo_rel = ltrim(is_string($seo_path) ? $seo_path : '', '/');
		if ( $seo_rel !== '' && isset($seo_meta_map[$seo_rel]) && $seo_meta_map[$seo_rel] !== '' ) {
			$page_desc = $seo_meta_map[$seo_rel];
		} elseif ( isset($seo_meta_map[$seo_file]) && $seo_meta_map[$seo_file] !== '' ) {
			$page_desc = $seo_meta_map[$seo_file];
		} elseif ( $runtime_bo !== '' && isset($seo_meta_map['board.php?bo_table=' . $runtime_bo]) && $seo_meta_map['board.php?bo_table=' . $runtime_bo] !== '' ) {
			$page_desc = $seo_meta_map['board.php?bo_table=' . $runtime_bo];
		}
		$page_file = $seo_file;
		$page_base = $seo_file;
		$gnb_items = array();
		if ( isset($g5['menu_table']) && $g5['menu_table'] !== '' && function_exists('sql_query') && function_exists('sql_fetch_array') ) {
			$sql = " select me_code, me_name, me_link from {$g5['menu_table']} where me_use = '1' order by me_code, me_order, me_id asc ";
			$result = @sql_query($sql, false);
			if ( $result ) {
				$pos = 1;
				while ( $row = sql_fetch_array($result) ) {
					if ( empty($row['me_name']) ) { continue; }
					$m_link = isset($row['me_link']) ? (string) $row['me_link'] : '';
					$m_link = preg_match('#^https?://#i', $m_link) ? $m_link : $origin . '/' . ltrim($m_link, '/');
					$m_link = function_exists('redue_align_url_protocol') ? redue_align_url_protocol($m_link) : $m_link;
					$gnb_items[] = array(
						'@type' => 'ListItem',
						'position' => $pos++,
						'name' => (string) $row['me_name'],
						'item' => $m_link,
						'code' => isset($row['me_code']) ? (string) $row['me_code'] : '',
					);
				}
			}
		}
		$GLOBALS['redue_gnb_items'] = $gnb_items;
		if ( ( ! is_array($available_services) || count($available_services) === 0 ) && function_exists('redue_catalog_from_menu') ) {
			$_gnb_svc = redue_catalog_from_menu($gnb_items, isset($is_medical_org) ? (bool) $is_medical_org : false);
			if ( is_array($_gnb_svc) && count($_gnb_svc) > 0 ) { $available_services = $_gnb_svc; }
		}
${buildSchemaPagesResolvePhp()}
		if ( function_exists('redue_refine_page_description') ) {
			$page_desc = redue_refine_page_description($page_desc, $site_name, $page_title, ( $is_main && $runtime_bo === '' && $runtime_wr === '' && $runtime_co === '' ), $gnb_items);
		}

		if ( function_exists('redue_echo_canonical_pair') ) { redue_echo_canonical_pair(); }
		echo '<meta name="description" content="' . htmlspecialchars($page_desc, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:title" content="' . htmlspecialchars($page_title, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:description" content="' . htmlspecialchars($page_desc, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:type" content="' . ($page_type === 'Article' ? 'article' : 'website') . '">' . "\\n";
		echo '<meta property="og:image" content="' . htmlspecialchars($image_url, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:site_name" content="' . htmlspecialchars($site_name, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta name="twitter:card" content="summary_large_image">' . "\\n";
		echo '<meta name="twitter:title" content="' . htmlspecialchars($page_title, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta name="twitter:description" content="' . htmlspecialchars($page_desc, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta name="twitter:image" content="' . htmlspecialchars($image_url, ENT_QUOTES, 'UTF-8') . '">' . "\\n";

		$graph = array();

		$alternate_name = ${phpSingleQuoted(alternateHint.alternateName || '')};
		if ( $alternate_name === '' && ! empty($g5_head_title) && is_string($g5_head_title) ) {
			$_alt_title = trim(preg_replace('/\\s*[|\\-–—]\\s+.+$/u', '', strip_tags((string) $g5_head_title)));
			if ( $_alt_title !== '' && $_alt_title !== $site_name ) { $alternate_name = $_alt_title; }
		}
		$org_node = array(
			'@type' => $org_types,
			'@id' => $origin . '/#organization',
			'name' => $site_name,
			'url' => $origin,
		);
		if ( $alternate_name !== '' && $alternate_name !== $site_name ) {
			$org_node['alternateName'] = $alternate_name;
		}
		if ( is_array($available_services) && count($available_services) > 0 ) {
			$org_node['availableService'] = $available_services;
		}
		if ( is_array($same_as_array) && count($same_as_array) > 0 ) {
			$org_node['sameAs'] = $same_as_array;
		}
		if ( is_string($price_range) && trim($price_range) !== '' ) {
			$org_node['priceRange'] = $price_range;
		}
		if ( is_string($currencies_accepted) && trim($currencies_accepted) !== '' ) {
			$org_node['currenciesAccepted'] = $currencies_accepted;
		}
		if ( is_string($payment_accepted) && trim($payment_accepted) !== '' ) {
			$org_node['paymentAccepted'] = $payment_accepted;
		}
		if ( is_array($knows_about) && count($knows_about) > 0 ) {
			$org_node['knowsAbout'] = $knows_about;
		}
		if ( $is_medical_org && is_array($medical_specialty) && count($medical_specialty) > 0 ) {
			$org_node['medicalSpecialty'] = $medical_specialty;
		}
		if ( is_string($latitude) && $latitude !== '' && is_string($longitude) && $longitude !== '' && is_numeric($latitude) && is_numeric($longitude) ) {
			$org_node['geo'] = array(
				'@type' => 'GeoCoordinates',
				'latitude' => (float) $latitude,
				'longitude' => (float) $longitude,
			);
		}
		if ( is_string($opens) && $opens !== '' && is_string($closes) && $closes !== '' ) {
			$org_node['openingHoursSpecification'] = array(
				array(
					'@type' => 'OpeningHoursSpecification',
					'dayOfWeek' => array('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
					'opens' => $opens,
					'closes' => $closes,
				),
			);
		}

${buildRuntimeNapBindPhp('org_node', { inventAddress: false })}
		if ( empty($org_node['telephone']) && !empty($config['cf_add_script']) && preg_match('/(?:0\\d{1,2}-\\d{3,4}-\\d{4}|1[568]\\d{2}-\\d{4})/', $config['cf_add_script'], $tel_m) ) {
			$org_node['telephone'] = $tel_m[0];
		}
		if ( empty($org_node['faxNumber']) && isset($GLOBALS['redue_fax']) && is_string($GLOBALS['redue_fax']) && trim($GLOBALS['redue_fax']) !== '' ) {
			$org_node['faxNumber'] = trim($GLOBALS['redue_fax']);
		}
		if ( empty($org_node['faxNumber']) && function_exists('redue_extract_fax') ) {
			$_fax = redue_extract_fax(isset($_redue_cfg_blob) ? $_redue_cfg_blob : '');
			if ( $_fax !== '' ) { $org_node['faxNumber'] = $_fax; }
		}
		if ( empty($org_node['taxID']) && isset($GLOBALS['redue_tax_id']) && is_string($GLOBALS['redue_tax_id']) && trim($GLOBALS['redue_tax_id']) !== '' ) {
			$org_node['taxID'] = trim($GLOBALS['redue_tax_id']);
		}
		if ( empty($org_node['taxID']) && function_exists('redue_extract_tax_id') ) {
			$_tax = redue_extract_tax_id(isset($_redue_cfg_blob) ? $_redue_cfg_blob : '');
			if ( $_tax !== '' ) { $org_node['taxID'] = $_tax; }
		}
		if ( empty($org_node['legalName']) && isset($GLOBALS['redue_legal_name']) && is_string($GLOBALS['redue_legal_name']) && trim($GLOBALS['redue_legal_name']) !== '' ) {
			$org_node['legalName'] = trim($GLOBALS['redue_legal_name']);
		}
		$_area_served = array();
		if ( ! empty($org_node['address']['addressLocality']) ) {
			$_area_served[] = array('@type' => 'AdministrativeArea', 'name' => (string) $org_node['address']['addressLocality']);
		}
		if ( ! empty($org_node['address']['addressRegion']) ) {
			$_area_served[] = array('@type' => 'AdministrativeArea', 'name' => (string) $org_node['address']['addressRegion']);
		}
		if ( count($_area_served) > 0 ) {
			$org_node['areaServed'] = $_area_served;
		}
${buildOrgFounderPhysicianPhp('\t\t')}
${buildUniversalOrgFiveCoreBindPhp()}
		$graph[] = $org_node;
		$graph[] = array(
			'@type' => 'WebSite',
			'@id' => $origin . '/#website',
			'name' => $site_name,
			'url' => $origin,
			'publisher' => array('@id' => $origin . '/#organization'),
		);

		if ( $is_main && $runtime_bo === '' && $runtime_wr === '' && $runtime_co === '' ) {
			if ( ! empty($gnb_items) ) {
				$graph[] = array(
					'@type' => 'ItemList',
					'@id' => $origin . '/#gnb',
					'name' => 'GNB Navigation',
					'itemListElement' => $gnb_items,
				);
			}
${buildHasPartFromSchemaPagesPhp('\t\t\t')}
			if ( empty($_has_part) && ! empty($gnb_items) ) {
				foreach ( $gnb_items as $_gnb ) {
					if ( empty($_gnb['item']) || empty($_gnb['name']) ) { continue; }
					$_has_part[] = array(
						'@type' => 'WebPage',
						'@id' => $_gnb['item'] . '#webpage',
						'name' => (string) $_gnb['name'],
						'url' => $_gnb['item'],
					);
				}
			}
			$_main_page_types = function_exists('redue_composite_page_types')
				? redue_composite_page_types(true, $page_type)
				: $page_type;
			$_main_page = array(
				'@type' => $_main_page_types,
				'@id' => $canonical_url . '#webpage',
				'name' => $page_title,
				'headline' => $page_title,
				'description' => $page_desc,
				'url' => $canonical_url,
				'isPartOf' => array('@id' => $origin . '/#website'),
				'about' => array('@id' => $origin . '/#organization'),
				'mainEntity' => array('@id' => $origin . '/#organization'),
				'hasPart' => $_has_part,
			);
			if ( function_exists('redue_apply_page_graph_links') ) {
				redue_apply_page_graph_links($_main_page, $origin, $canonical_url . '#breadcrumb');
			}
			$graph[] = $_main_page;
		} else {
			$_page_is_about = (bool) preg_match('/소개|인사말|시설|장비|about|company|greeting|연혁|조직도|개요/ui', $page_title . ' ' . $canonical_url);
			if ( $_page_is_about && function_exists('redue_composite_page_types') ) {
				$page_type = redue_composite_page_types(false, $page_type, true);
			}
			if ( function_exists('redue_build_breadcrumb_list') ) {
				$graph[] = redue_build_breadcrumb_list($origin, $canonical_url, $page_title);
			}
			$page_node = array(
				'@type' => $page_type,
				'@id' => $canonical_url . '#webpage',
				'name' => $page_title,
				'description' => $page_desc,
				'url' => $canonical_url,
				'isPartOf' => array('@id' => $origin . '/#website'),
				'about' => array('@id' => $origin . '/#organization'),
				'mainEntity' => array('@id' => $origin . '/#organization'),
				'breadcrumb' => array('@id' => $canonical_url . '#breadcrumb'),
			);
			if ( function_exists('redue_apply_page_graph_links') ) {
				redue_apply_page_graph_links($page_node, $origin, $canonical_url . '#breadcrumb');
			}
			if ( ( is_string($page_type) && $page_type === 'Article' ) || ( is_array($page_type) && in_array('Article', $page_type, true) ) ) {
				$page_node['headline'] = $page_title;
				$published = '';
				if ( !empty($view['wr_datetime']) ) { $published = (string) $view['wr_datetime']; }
				elseif ( !empty($write['wr_datetime']) ) { $published = (string) $write['wr_datetime']; }
				$ts = $published !== '' ? strtotime($published) : false;
				if ( $ts ) { $page_node['datePublished'] = date('c', $ts); }
				$_author_name = '';
				if ( ! empty($view['wr_name']) ) { $_author_name = trim(strip_tags((string) $view['wr_name'])); }
				elseif ( ! empty($write['wr_name']) ) { $_author_name = trim(strip_tags((string) $write['wr_name'])); }
				elseif ( function_exists('redue_has_real_person') && redue_has_real_person() ) {
					$_author_name = isset($GLOBALS['redue_rep_name']) ? trim((string) $GLOBALS['redue_rep_name']) : '';
				}
				if ( $_author_name !== '' ) {
					$page_node['author'] = array(
						'@type' => 'Person',
						'@id' => $origin . '/#person',
						'name' => $_author_name,
					);
				}
			}
			$_is_service_page = ( is_string($page_type) && ( $page_type === 'MedicalWebPage' || $page_type === 'WebPage' ) )
				|| ( is_array($page_type) && ( in_array('MedicalWebPage', $page_type, true) || in_array('WebPage', $page_type, true) ) );
			if ( $_is_service_page && $runtime_bo === '' && $runtime_wr === '' && ! $_page_is_about && $page_type !== 'ContactPage' && $page_type !== 'CollectionPage' && $page_type !== 'ProfilePage' ) {
				$graph[] = array(
					'@type' => $is_medical_org ? 'MedicalProcedure' : 'Service',
					'@id' => $canonical_url . '#service',
					'name' => $page_title,
					'url' => $canonical_url,
					'provider' => array('@id' => $origin . '/#organization'),
				);
				$page_node['mainEntity'] = array('@id' => $canonical_url . '#service');
			}
			$graph[] = $page_node;
		}

${buildHowToAutoInjectPhp()}
		$is_board_list = preg_match('/board\\.php\\?bo_table=/', $canonical_url);
		if ( ! $is_board_list ) {
${buildEvidenceFaqInjectPhp('canonical_url')}
		}
${buildPersonEeatNodePhp()}
${buildUniversalBreadcrumbEnsurePhp()}

		echo '<script type="application/ld+json">' . "\\n" .
			json_encode(array('@context' => 'https://schema.org', '@graph' => $graph), function_exists('redue_jsonld_flags') ? redue_jsonld_flags() : (JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) .
			"\\n" . '</script>' . "\\n";
	}
}

${buildRedueLlmsPhpEngine()}
// 4. Phase 1 — 렌더링 전용 함수. 여기서는 절대 즉시 실행/즉시 echo 하지 않는다.
//    실제 출력은 charset 메타 태그 바로 아래(REDUE_AI_STUDIO_RENDER 블록)의
//    렌더 호출문에서만 수행되어 문서 최상단 출력 덤프를 방지한다.
if ( ! function_exists( 'redue_render_full_schema' ) ) {
	function redue_render_full_schema() {
		ob_start();
		redue_dynamic_schema_controller_safe();
		$out = ob_get_clean();
		return is_string( $out ) ? $out : '';
	}
}
/* ${REDUE_SCHEMA_MARKER_END} */
?>

<?php
/* ${REDUE_SCHEMA_RENDER_MARKER_START} */
if (function_exists('redue_render_full_schema')) {
    echo redue_render_full_schema();
}
/* ${REDUE_SCHEMA_RENDER_MARKER_END} */
?>`);
}

/**
 * Generate the dynamic PHP schema controller block for </head> injection.
 * Gnuboard → runtime engine (no $page_meta). Other CMS → mapped $page_meta controller.
 */
export function buildDynamicPhpSchemaController(input: DynamicPhpSchemaInput): string {
	if (isGnuboardCmsType(input.cmsType)) {
		return buildGnuboardAutomatedRuntimeEnginePhp({
			siteName: input.siteName,
			industryType: input.industryType,
			telephone: input.telephone,
			streetAddress: input.streetAddress,
			addressLocality: input.addressLocality,
			addressRegion: input.addressRegion,
			postalCode: input.postalCode,
			legalName: input.legalName,
			representativeName: input.representativeName,
			representativeTitle: input.representativeTitle,
			pages: input.pages,
			navItems: input.navItems,
			footerText: input.footerText,
			openingHoursOpens: input.openingHoursOpens,
			openingHoursCloses: input.openingHoursCloses,
			latitude: input.latitude,
			longitude: input.longitude,
			sameAs: input.sameAs,
			medicalSpecialty: input.medicalSpecialty,
			isAcceptingNewPatients: input.isAcceptingNewPatients,
			fax: input.fax,
			taxId: input.taxId,
		});
	}

	const origin = resolveHttpsOrigin(input.targetUrl);
	const site = dedupeRepeatedPhrase(input.mappingJson?.siteName || input.siteName || 'Site') || 'Site';
	const { pageMeta, pageSchema, mainFile } = buildPageMaps(input);

	const metaEntries = Object.entries(pageMeta).filter(([file]) => !isGarbagePageFile(file)) as Array<
		[string, PageMetaRow]
	>;
	const schemaEntries = Object.entries(pageSchema).filter(([file]) => !isGarbagePageFile(file)) as Array<
		[string, string[]]
	>;

	const mapping = input.mappingJson || buildSchemaMappingJson(input);
	const nav =
		input.navItems && input.navItems.length > 0
			? input.navItems
					.filter((n) => n.name && n.url && !isGarbagePageFile(n.url.split('#')[0] || n.url))
					.map((n) => ({ name: n.name, url: absoluteUrlFromNav(n.url, origin) }))
			: mapping.nav && mapping.nav.length > 0
				? mapping.nav
						.filter((n) => n.name && n.url && !isGarbagePageFile(n.url.split('#')[0] || n.url))
						.map((n) => ({ name: n.name, url: absoluteUrlFromNav(n.url, origin) }))
				: Object.entries(pageMeta)
						.filter(([file]) => file !== 'index.php' && file !== 'index.html' && !isGarbagePageFile(file))
						.slice(0, 8)
						.map(([file, meta]) => ({
							name: meta.section || meta.menu1 || meta.title || file,
							url: absoluteUrlFromNav(`/${file}`, origin),
						}));

	const navPhp = nav
		.map(
			(n, i) =>
				`\t\t\tarray('@type' => 'ListItem', 'position' => ${i + 1}, 'name' => ${phpSingleQuoted(n.name)}, 'item' => ${phpSingleQuoted(enforceHttps(n.url))}),`,
		)
		.join('\n');
	const schemaRoutes = buildSchemaPageRoutes({
		pages: input.pages,
		navItems: input.navItems || nav,
		pageMeta,
		industryType: input.industryType,
		siteName: site,
		origin,
		targetUrl: input.targetUrl,
	});
	/* Phase 2 Rule 3: main WebPage.hasPart → typed $schema_pages subpages (no invented links). */
	const hasPartPhp = schemaRoutes
		.filter((r) => r.file !== 'index.php' && r.file !== 'index.html' && r.file !== 'index.htm')
		.slice(0, 16)
		.map((r) => {
			const u = enforceHttps(r.url);
			return `\t\t\t\tarray('@type' => ${phpSingleQuoted(r.type)}, '@id' => ${phpSingleQuoted(u)} . '#webpage', 'name' => ${phpSingleQuoted(r.name)}, 'url' => ${phpSingleQuoted(u)}),`;
		})
		.join('\n');

	const imageUrl = enforceHttps(input.imageUrl || mapping.imageUrl || '');
	const knowsAbout = buildKnowsAboutKeywords({
		knowsAbout: input.knowsAbout,
		mappingKnowsAbout: mapping.knowsAbout,
		industryType: input.industryType,
		siteName: site,
		pageMeta,
	});
	const knowsAboutPhp = phpStringList(knowsAbout, '\t\t\t');
	const areaServed = buildAreaServed({
		areaServed: input.areaServed,
		pageMeta,
		knowsAbout,
		siteName: site,
	});
	const areaServedPhp = phpStringList(areaServed, '\t\t\t\t');

	const { brandName, legalName } = resolveBrandAndLegalName({
		siteName: site,
		legalName: input.legalName,
		copyrightText: input.copyrightText,
		footerText: input.footerText,
		pageMeta,
	});
	const orgContact = extractOrgContactFromFooter(
		[input.footerText, input.copyrightText].filter(Boolean).join('\n'),
	);
	const completeNap = resolveCompleteNap({
		corpus: [input.footerText, input.copyrightText].filter(Boolean).join('\n'),
		telephone: input.telephone || orgContact.telephone,
		streetAddress: input.streetAddress || orgContact.address?.streetAddress,
		addressLocality: input.addressLocality || orgContact.address?.addressLocality,
		addressRegion: input.addressRegion || orgContact.address?.addressRegion,
		postalCode: input.postalCode || orgContact.address?.postalCode,
		siteName: site,
		targetUrl: input.targetUrl || origin,
	});
	if (completeNap.telephone) orgContact.telephone = formatKoreanTelephone(completeNap.telephone) || completeNap.telephone;
	if (completeNap.streetAddress) {
		orgContact.address = {
			'@type': 'PostalAddress',
			streetAddress: completeNap.streetAddress,
			addressLocality: completeNap.addressLocality || orgContact.address?.addressLocality || '',
			addressRegion: completeNap.addressRegion || orgContact.address?.addressRegion || '',
			addressCountry: 'KR',
			...(completeNap.postalCode ? { postalCode: completeNap.postalCode } : {}),
		};
	}
	if (!input.postalCode && orgContact.address?.postalCode) {
		input = { ...input, postalCode: orgContact.address.postalCode };
	}
	if (!input.streetAddress && orgContact.address?.streetAddress) {
		input = { ...input, streetAddress: orgContact.address.streetAddress };
	}
	if (!input.addressLocality && orgContact.address?.addressLocality) {
		input = { ...input, addressLocality: orgContact.address.addressLocality };
	}
	if (!input.addressRegion && orgContact.address?.addressRegion) {
		input = { ...input, addressRegion: orgContact.address.addressRegion };
	}
	const orgContactPhp = phpOrgContactBindings(orgContact);
	const compiledRep = resolveEngineRepresentative({
		adminName: input.representativeName,
		adminTitle: input.representativeTitle,
		htmlCorpus: [input.footerText, input.copyrightText].filter(Boolean).join('\n'),
		industryType: input.industryType,
	});
	const orgTypePhp = gnuboardOrgTypePhp(
		input.industryType,
		site,
		industryCorpusFromSchemaInput({
			siteName: site,
			industryType: input.industryType,
			footerText: input.footerText,
			pages: input.pages,
			navItems: input.navItems,
		}),
	);
	const mainBuckets = buildMainPageItemListBuckets({
		origin,
		pageMeta,
		nav,
		knowsAbout,
		industryType: input.industryType,
	});
	const mainBucketPhp = mainBuckets
		.map((bucket) => {
			const itemsPhp = phpBucketListItems(bucket.id, bucket.items);
			return `\t\t\t$graph[] = array(
				'@type' => 'ItemList',
				'@id' => $origin . '/#${bucket.id}',
				'name' => ${phpSingleQuoted(bucket.name)},
				'itemListElement' => array(
${itemsPhp}
				),
			);`;
		})
		.join('\n');

	const analysisHeaderPhp = buildEngineAnalysisHeaderComment({
		targetUrl: origin,
		protocolMode: 'static-origin',
		orgTypesPhp: orgTypePhp,
		pages: [
			{ urlPath: '/', title: site },
			...metaEntries
				.filter(([file]) => file !== mainFile)
				.map(([file, meta]) => ({
					urlPath: `/${file}`,
					title: meta.title,
					pageType: meta.type,
				})),
		],
	});

	return sanitizeGeneratedPhpSnippet(`<?php
${analysisHeaderPhp}/* ${REDUE_SCHEMA_MARKER_START} v32 — Crawler-Optimized Canonical & Schema Engine (Charset-After First-Chunk · REQUEST_URI+SCRIPT_NAME · Exact Subpage Canonical · Head+Body Script Defer · Article Guaranteed All Pages · FAQPage Non-Board · Person E-E-A-T · Alt JS Auto-Fix · Description Extender · sameAs · v12 Master Core: Index Parent · PostalAddress · legalName · og:type · Parent Fallback · CollectionPage · ItemList) */
${buildUniversalGraphGlobalsSeedPhp({
	repName: compiledRep.name,
	repTitle: compiledRep.jobTitle,
	tel: orgContact.telephone || input.telephone || '',
	street: input.streetAddress || orgContact.address?.streetAddress || '',
	taxId: input.taxId,
	lat: input.latitude,
	lng: input.longitude,
	openingHoursOpens: input.openingHoursOpens,
	openingHoursCloses: input.openingHoursCloses,
	sameAs: input.sameAs,
	pages: input.pages,
	navItems: input.navItems,
	industryType: input.industryType,
	siteName: site,
	targetUrl: input.targetUrl || origin,
	bakeStreet: true,
})}
${buildUniversalObRegistrationPhp()}

if ( ! function_exists( 'redue_dynamic_schema_controller_safe' ) ) {
	function redue_dynamic_schema_controller_safe() {
		static $executed = false;
		if ( $executed ) return;
		$executed = true;
		try {
			if ( function_exists( 'redue_dynamic_schema_controller_body' ) ) {
				redue_dynamic_schema_controller_body();
			}
		} catch (\\Exception $_redue_schema_err) {} catch (\\Throwable $_redue_schema_err) {}
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller' ) ) {
	function redue_dynamic_schema_controller() {
		redue_dynamic_schema_controller_safe();
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller_body' ) ) {
	function redue_dynamic_schema_controller_body() {
		if ( function_exists( 'redue_auto_detect_footer_info' ) ) {
			redue_auto_detect_footer_info();
		}
		global $config, $g5_head_title;

		$origin = ${phpSingleQuoted(origin)};
		/* CMS auto-detect: prefer live G5_URL / home_url protocol over audit-time origin */
		if ( function_exists('redue_site_origin') ) {
			$_live_origin = redue_site_origin();
			if ( is_string($_live_origin) && $_live_origin !== '' ) { $origin = $_live_origin; }
		} elseif ( defined('G5_URL') && G5_URL !== '' ) {
			$origin = rtrim(G5_URL, '/');
		}
		$domain_host = parse_url($origin, PHP_URL_HOST);
		if ( ! is_string($domain_host) || $domain_host === '' ) {
			$domain_host = preg_replace('#^https?://#i', '', $origin);
			$domain_host = preg_replace('#/.*$#', '', $domain_host);
		}
		$site_name = ${phpSingleQuoted(brandName)};
		if ( isset($config['cf_title']) && $config['cf_title'] !== '' ) {
			$site_name = $config['cf_title'];
		}
		$legal_name = ${phpSingleQuoted(legalName)};
${buildRepresentativeResolvePhp(compiledRep.name, compiledRep.jobTitle)}
${buildGeoAeoBindingsPhp(input)}
${buildUniversalGraphApplyPhp()}
		$telephone = ${phpSingleQuoted(orgContact.telephone || '')};
		$email = ${phpSingleQuoted(orgContact.email || '')};
		if ( isset($GLOBALS['redue_tel']) && is_string($GLOBALS['redue_tel']) && trim($GLOBALS['redue_tel']) !== '' ) {
			$_seed_tel = function_exists('redue_format_telephone') ? redue_format_telephone($GLOBALS['redue_tel']) : trim($GLOBALS['redue_tel']);
			if ( $_seed_tel !== '' ) { $telephone = $_seed_tel; }
		}
		if ( $telephone === '' && function_exists('redue_resolve_universal_telephone') ) {
			$_uni = redue_resolve_universal_telephone('');
			if ( $_uni !== '' ) { $telephone = $_uni; }
		}
		if ( $telephone === '' && isset($config['cf_tel']) && is_string($config['cf_tel']) && trim($config['cf_tel']) !== '' ) {
			$telephone = trim($config['cf_tel']);
		}
		if ( $telephone === '' && function_exists('redue_extract_telephone') && isset($config) && is_array($config) ) {
			$_cfg_blob = '';
			foreach ( array('cf_tel', 'cf_add_script', 'cf_add_meta', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
				if ( ! empty($config[$_ck]) && is_string($config[$_ck]) ) { $_cfg_blob .= ' ' . $config[$_ck]; }
			}
			$_tel_rt = redue_extract_telephone($_cfg_blob);
			if ( $_tel_rt !== '' ) { $telephone = $_tel_rt; }
		}
		if ( $telephone !== '' && function_exists('redue_format_telephone') ) {
			$_fmt_tel = redue_format_telephone($telephone);
			if ( $_fmt_tel !== '' ) { $telephone = $_fmt_tel; }
		}
		if ( $street_address === '' && function_exists('redue_extract_street_address') && isset($config) && is_array($config) ) {
			$_cfg_blob_addr = isset($_cfg_blob) ? $_cfg_blob : '';
			if ( $_cfg_blob_addr === '' ) {
				foreach ( array('cf_add_script', 'cf_add_meta', 'cf_1', 'cf_2', 'cf_3') as $_ck ) {
					if ( ! empty($config[$_ck]) && is_string($config[$_ck]) ) { $_cfg_blob_addr .= ' ' . $config[$_ck]; }
				}
			}
			$_addr_rt = redue_extract_street_address($_cfg_blob_addr);
			if ( $_addr_rt !== '' ) { $street_address = $_addr_rt; }
		}
		if ( $street_address === '' && ${phpSingleQuoted(orgContact.address?.streetAddress || '')} !== '' ) {
			$street_address = ${phpSingleQuoted(orgContact.address?.streetAddress || '')};
		}
		if ( $locality === '' && ${phpSingleQuoted(orgContact.address?.addressLocality || '')} !== '' ) {
			$locality = ${phpSingleQuoted(orgContact.address?.addressLocality || '')};
		}
		if ( $region === '' && ${phpSingleQuoted(orgContact.address?.addressRegion || '')} !== '' ) {
			$region = ${phpSingleQuoted(orgContact.address?.addressRegion || '')};
		}
		$main_file = ${phpSingleQuoted(mainFile)};
		$schema_meta_image = function_exists('redue_align_url_protocol')
			? redue_align_url_protocol(${phpSingleQuoted(imageUrl)})
			: ${phpSingleQuoted(imageUrl)};
		$area_served = ${areaServedPhp};

		$request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
		$page_path = parse_url($request_uri, PHP_URL_PATH);
		if ( ! is_string($page_path) || $page_path === '' ) {
			$page_path = '/';
		}
		$page_query = parse_url($request_uri, PHP_URL_QUERY);
		$page_base = basename($page_path);
		if ( $page_base === '' || $page_base === '/' || $page_base === '.' ) {
			$page_base = 'index.php';
		}
		/* Reject dangerous path debris only — NEVER force path/query to / (canonical false-positive guard) */
		if ( preg_match('/[<>]/', $page_base) ) {
			$page_base = 'index.php';
		}
		/* CMS Universal Key Mapping: board.php?bo_table=notice → distinct $page_meta row */
		$page_file = $page_base;
		$has_identity_query = false;
		if ( is_string($page_query) && $page_query !== '' ) {
			parse_str($page_query, $page_qs);
			foreach ( array('bo_table', 'co_id', 'it_id', 'ca_id', 'idx', 'p', 'page_id', 'wr_id', 'id') as $id_key ) {
				if ( isset($page_qs[$id_key]) && $page_qs[$id_key] !== '' && preg_match('/^[a-zA-Z0-9_-]{1,40}$/', $page_qs[$id_key]) ) {
					$page_file = $page_base . '?' . $id_key . '=' . $page_qs[$id_key];
					$has_identity_query = true;
					break;
				}
			}
		}
		/* Exact homepage only — NEVER basename===index.php (/sub01/index.php must stay subpage).
		   Path / or /index.php WITH bo_table/wr_id/… is a board/sub page, not main. */
		$is_main_path = (
			$page_path === '/' ||
			$page_path === '/index.php' ||
			$page_path === '' ||
			$page_path === '/' . $main_file
		);
		$is_main = $is_main_path && ! $has_identity_query;
		/* Keep /?bo_table=… out of main even if page_query parse missed */
		if ( $is_main_path && ! empty($_GET) && is_array($_GET) ) {
			foreach ( array('bo_table', 'wr_id', 'co_id', 'idx', 'p', 'page_id', 'id') as $_redue_idk ) {
				if ( isset($_GET[$_redue_idk]) && $_GET[$_redue_idk] !== '' ) {
					$is_main = false;
					$has_identity_query = true;
					break;
				}
			}
		}

		$page_meta = ${phpAssocArray(metaEntries)};
		$seo_meta_map = ${phpStringMap(metaEntries.map(([file, row]) => [file, row.description || '']))};

		$page_schema = ${phpAssocArray(schemaEntries)};
		$seo_schema_map = $page_schema;
${buildSchemaPagesPhp(schemaRoutes)}
		$rel_path = ltrim((string) $page_path, '/');
		if ( $rel_path !== '' && ( isset($page_meta[$rel_path]) || isset($seo_meta_map[$rel_path]) || isset($seo_schema_map[$rel_path]) ) ) {
			$page_file = $rel_path;
		}

		/* Runtime coerce: board.php?bo_table=* → CollectionPage always (FAQPage ban on board lists; Article still guaranteed via auto-fill) */
		if ( preg_match('/board\\.php\\?bo_table=/', $page_file) ) {
			if ( isset($page_meta[$page_file]) ) {
				$page_meta[$page_file]['type'] = 'CollectionPage';
			}
			if ( isset($page_schema[$page_file]) ) {
				$page_schema[$page_file] = array_values(array_diff($page_schema[$page_file], array('FAQPage', 'MedicalWebPage')));
				if ( ! in_array('CollectionPage', $page_schema[$page_file], true) ) {
					$page_schema[$page_file][] = 'CollectionPage';
				}
			}
		}

		$meta = isset($page_meta[$page_file])
			? $page_meta[$page_file]
			: (isset($page_meta[$page_base]) ? $page_meta[$page_base] : array(
			'title' => $site_name,
			'description' => $site_name,
			'section' => $site_name,
			'h1' => $site_name,
			'type' => 'WebPage',
			'menu1' => '',
			'menu2' => '',
			'parent' => '',
			'parent_url' => '',
		));
		if ( ! isset($meta['section']) || $meta['section'] === '' ) {
			$meta['section'] = ! empty($meta['menu1']) ? $meta['menu1'] : $meta['title'];
		}
		if ( ! isset($meta['parent']) ) { $meta['parent'] = ''; }
		if ( ! isset($meta['parent_url']) ) { $meta['parent_url'] = ''; }
		$page_type = isset($meta['type']) ? $meta['type'] : 'WebPage';
${buildSchemaPagesResolvePhp()}
		if ( isset($page_type) && is_string($page_type) && $page_type !== '' ) {
			$meta['type'] = $page_type;
		}
		/* v11 Index Parent Sanitization — main page never has upper hierarchy */
		if ( $is_main ) {
			$meta['parent'] = '';
			$meta['parent_url'] = '';
		}
		if ( ! empty($meta['parent_url']) ) {
			$meta['parent_url'] = function_exists('redue_align_url_protocol') ? redue_align_url_protocol($meta['parent_url']) : $meta['parent_url'];
		}
		$types = isset($seo_schema_map[$page_file])
			? $seo_schema_map[$page_file]
			: (isset($page_schema[$page_file])
				? $page_schema[$page_file]
				: (isset($page_schema[$page_base]) ? $page_schema[$page_base] : array($meta['type'], 'BreadcrumbList')));

		/* v30 Dynamic Canonical Overrider — single source: redue_get_exact_canonical()
		   (path / + bo_table kept; /index.php → /; never basename-collapse /sub01/index.php) */
		$schema_meta_canonical = function_exists('redue_get_exact_canonical')
			? redue_get_exact_canonical()
			: ( $is_main ? ( $origin . '/' ) : ( $origin . $page_path ) );
		$schema_meta_canonical = function_exists('redue_align_url_protocol') ? redue_align_url_protocol($schema_meta_canonical) : $schema_meta_canonical;
		$GLOBALS['redue_canonical_url'] = $schema_meta_canonical;
		$page_url = $schema_meta_canonical;

		$schema_meta_title = isset($meta['title']) ? $meta['title'] : $site_name;
		/* Fallback: Gnuboard runtime head title when page_meta has no distinct title */
		if ( ( ! isset($meta['title']) || $meta['title'] === '' || $meta['title'] === $site_name ) && isset($g5_head_title) && $g5_head_title !== '' ) {
			$schema_meta_title = $g5_head_title;
		}
		$schema_meta_description = $schema_meta_title;
		if ( isset($seo_meta_map[$page_file]) && $seo_meta_map[$page_file] !== '' ) {
			$schema_meta_description = $seo_meta_map[$page_file];
		} elseif ( isset($seo_meta_map[$page_base]) && $seo_meta_map[$page_base] !== '' ) {
			$schema_meta_description = $seo_meta_map[$page_base];
		} elseif ( isset($meta['description']) && $meta['description'] !== '' ) {
			$schema_meta_description = $meta['description'];
		}
		/* v12 Description Extender — pad short copy with page-unique title, not a shared template */
		$_redue_desc_len = function_exists('mb_strlen') ? mb_strlen($schema_meta_description, 'UTF-8') : strlen($schema_meta_description);
		if ( $_redue_desc_len < 75 ) {
			$schema_meta_description = trim($schema_meta_description . ' ' . $schema_meta_title . ' 페이지에서 ' . $site_name . '의 핵심 안내를 확인하세요.');
			$_redue_desc_len = function_exists('mb_strlen') ? mb_strlen($schema_meta_description, 'UTF-8') : strlen($schema_meta_description);
		}
		if ( $_redue_desc_len < 75 ) {
			$schema_meta_description = trim($schema_meta_description . ' ' . $schema_meta_title . ' 관련 이용 방법과 상담 안내를 제공합니다.');
			$_redue_desc_len = function_exists('mb_strlen') ? mb_strlen($schema_meta_description, 'UTF-8') : strlen($schema_meta_description);
		}
		if ( $_redue_desc_len > 150 ) {
			$schema_meta_description = function_exists('mb_substr')
				? mb_substr($schema_meta_description, 0, 150, 'UTF-8')
				: substr($schema_meta_description, 0, 150);
			$schema_meta_description = rtrim($schema_meta_description);
		}
		$meta['description'] = $schema_meta_description;
		$schema_meta_section = isset($meta['section']) ? $meta['section'] : $schema_meta_title;
${buildNewsArticleAutoDetectPhp()}
		/* v9 Meta Precision: website for WebPage/CollectionPage; article only for Article/NewsArticle (+ schema_article bind / news auto-detect) */
		$schema_meta_og_type = 'website';
		$page_type_og = isset($meta['type']) ? $meta['type'] : 'WebPage';
		if ( $page_type_og === 'Article' || $page_type_og === 'NewsArticle' || $page_type_og === 'BlogPosting' ) {
			$schema_meta_og_type = 'article';
		}
		if ( $redue_is_news_context ) {
			$schema_meta_og_type = 'article';
		}
		if ( ( isset($GLOBALS['schema_article']) && is_array($GLOBALS['schema_article']) && count($GLOBALS['schema_article']) > 0 )
			|| ( isset($schema_article) && is_array($schema_article) && count($schema_article) > 0 ) ) {
			$schema_meta_og_type = 'article';
		}

		echo '<meta name="description" content="' . htmlspecialchars($schema_meta_description, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		/* Native canonical echo — 1회 가드. OB가 <head> 직후로 재배치·중복 제거. */
		if ( function_exists('redue_echo_canonical_pair') ) { redue_echo_canonical_pair(); }
		echo '<meta property="og:title" content="' . htmlspecialchars($schema_meta_title, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:description" content="' . htmlspecialchars($schema_meta_description, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:type" content="' . htmlspecialchars($schema_meta_og_type, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:image" content="' . htmlspecialchars($schema_meta_image, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:site_name" content="' . htmlspecialchars($site_name, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:locale" content="ko_KR">' . "\\n";
		echo '<meta name="twitter:card" content="summary_large_image">' . "\\n";
		echo '<meta name="twitter:title" content="' . htmlspecialchars($schema_meta_title, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta name="twitter:description" content="' . htmlspecialchars($schema_meta_description, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta name="twitter:image" content="' . htmlspecialchars($schema_meta_image, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		if ( $schema_meta_og_type === 'article' && $schema_meta_section !== '' ) {
			echo '<meta property="article:section" content="' . htmlspecialchars($schema_meta_section, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		}

		$graph = array();
		$knows_about = ${knowsAboutPhp};

		$org_node = array(
				'@type' => ${orgTypePhp},
				'@id' => $origin . '/#organization',
				'name' => $site_name,
				'alternateName' => $legal_name !== '' && $legal_name !== $site_name ? $legal_name : $site_name,
				'legalName' => $legal_name,
				'url' => $origin,
				'logo' => array(
					'@type' => 'ImageObject',
					'url' => $schema_meta_image,
				),
				'image' => $schema_meta_image,
				'telephone' => $telephone,
				'email' => $email,
				'isAcceptingNewPatients' => $is_accepting_new_patients,
				'medicalSpecialty' => $medical_specialty,
				'sameAs' => $same_as_array,
				'geo' => array(
					'@type' => 'GeoCoordinates',
					'latitude' => (float) $latitude,
					'longitude' => (float) $longitude,
				),
				'openingHoursSpecification' => array(
					array(
						'@type' => 'OpeningHoursSpecification',
						'dayOfWeek' => array('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'),
						'opens' => $opens,
						'closes' => $closes,
					),
				),
				'availableService' => $available_services,
				'priceRange' => $price_range,
				'currenciesAccepted' => $currencies_accepted,
				'paymentAccepted' => $payment_accepted,
				'speakable' => $speakable_spec,
${orgContactPhp ? `${orgContactPhp}\n` : ''}				'contactPoint' => array(
					'@type' => 'ContactPoint',
					'contactType' => 'customer support',
					'availableLanguage' => array('Korean', 'English'),
					'areaServed' => $area_served,
				),
				'areaServed' => $area_served,
				'knowsAbout' => ${knowsAboutPhp},
			);
			if ( empty($org_node['address']) || ! is_array($org_node['address']) ) {
				$org_node['address'] = array(
					'@type' => 'PostalAddress',
					'postalCode' => $postal_code,
					'streetAddress' => $street_address,
					'addressLocality' => $locality,
					'addressRegion' => $region,
					'addressCountry' => 'KR',
				);
			} elseif ( ! empty($postal_code) && empty($org_node['address']['postalCode']) ) {
				$org_node['address']['postalCode'] = $postal_code;
			}
			if ( $telephone !== '' ) { $org_node['telephone'] = $telephone; }
			if ( $email !== '' && empty($org_node['email']) ) { $org_node['email'] = $email; }
			if ( $email === '' ) { unset($org_node['email']); }
${buildRuntimeNapBindPhp('org_node')}
${buildOrgFounderPhysicianPhp('\t\t\t')}
${buildUniversalOrgFiveCoreBindPhp('\t\t\t')}
		$graph[] = $org_node;
		$graph[] = array(
			'@type' => 'WebSite',
			'@id' => $origin . '/#website',
			'name' => $site_name,
			'url' => $origin,
			'publisher' => array('@id' => $origin . '/#organization'),
			'inLanguage' => 'ko-KR',
		);
		if ( $is_main ) {
			$graph[] = array(
				'@type' => 'ItemList',
				'@id' => $origin . '/#gnb',
				'name' => 'GNB Navigation',
				'itemListElement' => array(
${navPhp}
				),
			);
${mainBucketPhp}
			$graph[] = array(
				'@type' => 'ImageObject',
				'@id' => $origin . '/#primaryimage',
				'url' => $schema_meta_image,
				'caption' => $site_name,
			);
			$_main_page_types = function_exists('redue_composite_page_types')
				? redue_composite_page_types(true, $meta['type'])
				: 'WebPage';
			$graph[] = array(
				'@type' => $_main_page_types,
				'@id' => $page_url . '#webpage',
				'name' => $meta['title'],
				'headline' => $meta['h1'],
				'description' => $meta['description'],
				'url' => $page_url,
				'isPartOf' => array('@id' => $origin . '/#website'),
				'about' => array('@id' => $origin . '/#organization'),
				'mainEntity' => array('@id' => $origin . '/#organization'),
				'hasPart' => array(
${hasPartPhp}
				),
				'author' => array('@id' => $origin . '/#person'),
				'primaryImageOfPage' => array('@id' => $origin . '/#primaryimage'),
			);
			if ( $meta['type'] === 'MedicalWebPage' || ( is_array($_main_page_types) && in_array('MedicalWebPage', $_main_page_types, true) ) ) {
				$graph[count($graph) - 1]['reviewedBy'] = array('@id' => $origin . '/#person');
				$graph[count($graph) - 1]['speakable'] = $speakable_spec;
			}
		} else {
			$crumb_items = array(
				array(
					'@type' => 'ListItem',
					'position' => 1,
					'name' => 'Home',
					'item' => $origin . '/',
				),
			);
			$pos = 2;
			/* v9: prefer baked parent; skip menu1/section when identical to current title (no duplicate crumb) */
			if ( ! empty($meta['parent']) ) {
				$crumb_items[] = array(
					'@type' => 'ListItem',
					'position' => $pos,
					'name' => $meta['parent'],
					'item' => ! empty($meta['parent_url']) ? $meta['parent_url'] : ($origin . '/'),
				);
				$pos++;
			} else if ( ! empty($meta['menu1']) && $meta['menu1'] !== $meta['title'] ) {
				$crumb_items[] = array(
					'@type' => 'ListItem',
					'position' => $pos,
					'name' => $meta['menu1'],
					'item' => ! empty($meta['parent_url']) ? $meta['parent_url'] : $page_url,
				);
				$pos++;
			} else if ( ! empty($meta['section']) && $meta['section'] !== $meta['title'] ) {
				$crumb_items[] = array(
					'@type' => 'ListItem',
					'position' => $pos,
					'name' => $meta['section'],
					'item' => $page_url,
				);
				$pos++;
			}
			if ( ! empty($meta['menu2']) ) {
				$crumb_items[] = array(
					'@type' => 'ListItem',
					'position' => $pos,
					'name' => $meta['menu2'],
					'item' => $page_url,
				);
			} else {
				$crumb_items[] = array(
					'@type' => 'ListItem',
					'position' => $pos,
					'name' => $meta['title'],
					'item' => $page_url,
				);
			}

			$graph[] = array(
				'@type' => 'BreadcrumbList',
				'@id' => $page_url . '#breadcrumb',
				'itemListElement' => $crumb_items,
			);

			$_sub_is_about = (bool) preg_match('/소개|인사말|시설|장비|about|company|greeting|연혁|조직도|개요/ui', (isset($meta['title']) ? $meta['title'] : '') . ' ' . (isset($meta['section']) ? $meta['section'] : '') . ' ' . $page_url);
			$_sub_page_types = function_exists('redue_composite_page_types')
				? redue_composite_page_types(false, $meta['type'], $_sub_is_about)
				: ( $_sub_is_about ? 'AboutPage' : $meta['type'] );
			$page_node = array(
				'@type' => $_sub_page_types,
				'@id' => $page_url . '#webpage',
				'name' => $meta['title'],
				'headline' => $meta['h1'],
				'description' => $meta['description'],
				'url' => $page_url,
				'isPartOf' => array('@id' => $origin . '/#website'),
				'about' => array('@id' => $origin . '/#organization'),
				'mainEntity' => array('@id' => $origin . '/#organization'),
				'breadcrumb' => array('@id' => $page_url . '#breadcrumb'),
				'author' => array('@id' => $origin . '/#person'),
			);
			$graph[] = $page_node;
			if ( $meta['type'] === 'MedicalWebPage' ) {
				$graph[count($graph) - 1]['reviewedBy'] = array('@id' => $origin . '/#person');
				$graph[count($graph) - 1]['speakable'] = $speakable_spec;
			}
			/* Rule 5: detail service/treatment page → Service|MedicalProcedure node, mainEntity-linked. */
			$_is_sub_service_page = ( $_sub_page_types === 'MedicalWebPage' || $_sub_page_types === 'WebPage' ) && ! $_sub_is_about;
			if ( $_is_sub_service_page ) {
				$_is_medical_org_sub = function_exists('redue_is_medical_org') && redue_is_medical_org();
				$graph[] = array(
					'@type' => $_is_medical_org_sub ? 'MedicalProcedure' : 'Service',
					'@id' => $page_url . '#service',
					'name' => $meta['title'],
					'url' => $page_url,
					'provider' => array('@id' => $origin . '/#organization'),
				);
				$graph[count($graph) - 2]['mainEntity'] = array('@id' => $page_url . '#service');
			}

			if ( in_array('ItemList', $types, true) || $meta['type'] === 'ItemList' ) {
				$graph[] = array(
					'@type' => 'ItemList',
					'@id' => $page_url . '#itemlist',
					'name' => $meta['h1'],
					'itemListElement' => array(
						array(
							'@type' => 'ListItem',
							'position' => 1,
							'name' => $meta['title'],
							'url' => $page_url,
						),
					),
				);
			}
		}

		/*
		 * ─── v9 Context Variable Injection (v8 solid core retained) ───
		 * Subpages MUST NOT emit JSON-LD script tags — bind data only before include head.sub.php:
		 *   $GLOBALS['schema_faq_items'] = array( array('q'=>'질문','a'=>'답변') );
		 *   $GLOBALS['schema_person'] = array( 'name'=>'홍길동', 'jobTitle'=>'전문의' );
		 *   $GLOBALS['schema_article'] = array( 'type'=>'NewsArticle', 'headline'=>'제목', 'datePublished'=>'2024-01-01' );
		 *   → schema_article also forces og:type=article
		 */
		$is_board_list = ( $meta['type'] === 'CollectionPage' || preg_match('/board\\.php\\?bo_table=/', $page_file) );

		/* FAQPage — live bind or page-body extract only. Empty data → skip node entirely. */
		if ( ! $is_board_list ) {
${buildEvidenceFaqInjectPhp('page_url')}
		}

${buildHowToAutoInjectPhp()}
		/* Person E-E-A-T — $rep_name / $GLOBALS['schema_person'] preferred; else {site_name} 대표 */
${buildPersonEeatNodePhp()}
${buildUniversalBreadcrumbEnsurePhp({ canonicalVar: 'page_url', titleVar: 'schema_meta_title' })}

		/* Article / NewsArticle — $GLOBALS['schema_article'] preferred; else v30/v31 auto-fill (NewsArticle on news/press) */
		$article = null;
		$article_bound = false;
		if ( isset($GLOBALS['schema_article']) && is_array($GLOBALS['schema_article']) ) {
			$article = $GLOBALS['schema_article'];
		} elseif ( isset($schema_article) && is_array($schema_article) ) {
			$article = $schema_article;
		}
		if ( is_array($article) && ( ! empty($article['headline']) || ! empty($article['name']) || ! empty($article['title']) ) ) {
			$article_type = $redue_is_news_context ? 'NewsArticle' : 'Article';
			if ( ! empty($article['type']) && $article['type'] === 'NewsArticle' ) {
				$article_type = 'NewsArticle';
			} elseif ( ! empty($article['type']) && $article['type'] === 'Article' && ! $redue_is_news_context ) {
				$article_type = 'Article';
			}
			$headline = ! empty($article['headline'])
				? $article['headline']
				: ( ! empty($article['name']) ? $article['name'] : $article['title'] );
			$article_node = array(
				'@type' => $article_type,
				'@id' => $page_url . '#article',
				'headline' => $headline,
				'url' => $page_url,
				'image' => ! empty($article['image'])
					? preg_replace('#^http://#i', 'https://', $article['image'])
					: $redue_article_image,
				'mainEntityOfPage' => array('@id' => $page_url . '#webpage'),
				'isPartOf' => array('@type' => 'WebSite', 'url' => $origin, 'name' => $site_name),
				'author' => array(
					'@type' => 'Organization',
					'@id' => $origin . '/#organization',
					'name' => $site_name,
				),
				'publisher' => array(
					'@type' => 'Organization',
					'@id' => $origin . '/#organization',
					'name' => $site_name,
					'url' => $origin,
					'logo' => array(
						'@type' => 'ImageObject',
						'url' => $schema_meta_image !== '' ? $schema_meta_image : '',
					),
				),
			);
			if ( ! empty($article['description']) ) { $article_node['description'] = $article['description']; }
			/* v15 Schema Date Auto-Fix — required Article/NewsArticle ISO 8601 dates */
			$article_node['datePublished'] = ! empty($article['datePublished'])
				? $article['datePublished']
				: $redue_date_published;
			$article_node['dateModified'] = ! empty($article['dateModified'])
				? $article['dateModified']
				: $redue_date_modified;
			if ( ! empty($article['author']) ) {
				if ( is_array($article['author']) ) {
					$article_node['author'] = $article['author'];
				} else {
					$article_node['author'] = array(
						'@type' => 'Organization',
						'name' => $article['author'],
					);
				}
			}
			$article_node['reviewedBy'] = array('@id' => $origin . '/#person');
			$article_node['speakable'] = $speakable_spec;
			$graph[] = $article_node;
			$article_bound = true;
		}
		/* v14 Schema Auto-Filler — [v30/v31] GUARANTEED on EVERY page; NewsArticle when news/press context */
		if ( ! $article_bound ) {
			$auto_article_type = $redue_is_news_context ? 'NewsArticle' : 'Article';
			$graph[] = array(
				'@type' => $auto_article_type,
				'@id' => $page_url . '#article',
				'headline' => $redue_article_headline !== '' ? $redue_article_headline : ( $schema_meta_title !== '' ? $schema_meta_title : $site_name ),
				'description' => $schema_meta_description,
				'url' => $page_url,
				'image' => $redue_article_image,
				/* v15 Schema Date Auto-Fix */
				'datePublished' => $redue_date_published,
				'dateModified' => $redue_date_modified,
				'mainEntityOfPage' => array('@id' => $page_url . '#webpage'),
				'isPartOf' => array('@type' => 'WebSite', 'url' => $origin, 'name' => $site_name),
				'author' => array(
					'@type' => 'Organization',
					'@id' => $origin . '/#organization',
					'name' => $site_name,
				),
				'publisher' => array(
					'@type' => 'Organization',
					'@id' => $origin . '/#organization',
					'name' => $site_name,
					'url' => $origin,
					'logo' => array(
						'@type' => 'ImageObject',
						'url' => $schema_meta_image !== '' ? $schema_meta_image : '',
					),
				),
				'reviewedBy' => array('@id' => $origin . '/#person'),
				'speakable' => $speakable_spec,
			);
		}

		/* Single JSON-LD Output Guarantee — exactly one script tag from this controller */
		$payload = array(
			'@context' => 'https://schema.org',
			'@graph' => $graph,
		);
		echo '<script type="application/ld+json">' . "\\n" .
			json_encode($payload, function_exists('redue_jsonld_flags') ? redue_jsonld_flags() : (JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)) .
			"\\n" . '</script>' . "\\n";

		/* v14 JS Alt Auto-Fixer — common header bottom; empty/missing img[alt] → $site_name */
		echo '<script id="redue-alt-autofix">(function(){var site=' . json_encode($site_name, JSON_UNESCAPED_UNICODE) . ';function fix(){try{var imgs=document.querySelectorAll("img");for(var i=0;i<imgs.length;i++){var img=imgs[i];var cur=img.getAttribute("alt");if(cur!=null&&String(cur).trim()!=="")continue;var kw=img.getAttribute("title")||img.getAttribute("aria-label")||img.getAttribute("data-alt")||"";if(!kw&&img.getAttribute("src")){try{var path=String(img.getAttribute("src")).split("?")[0];var base=path.substring(path.lastIndexOf("/")+1).replace(/\\.[a-z0-9]+$/i,"");kw=decodeURIComponent(base).replace(/[-_]+/g," ").replace(/\\s+/g," ").trim();}catch(e0){}}img.setAttribute("alt",(kw&&kw.length>1?kw+" — ":"")+site);}}catch(e){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fix);else fix();if(typeof MutationObserver!=="undefined"){try{new MutationObserver(function(){fix();}).observe(document.documentElement,{childList:true,subtree:true});}catch(e2){}}})();</script>' . "\\n";

		/* v15 client JS Defer Auto-Fixer — defense-in-depth; primary fix is v30 full-document OB defer + static addDeferToScriptTagsInSource() */
		echo '<script id="redue-js-defer-fix">(function(){function autoDefer(){try{var scripts=document.querySelectorAll("script[src]");for(var i=0;i<scripts.length;i++){var s=scripts[i];var src=s.getAttribute("src")||"";if(src&&!s.hasAttribute("defer")&&!s.hasAttribute("async")&&s.id!=="redue-js-defer-fix"&&s.id!=="redue-alt-autofix"){s.setAttribute("defer","defer");}}}catch(e){}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",autoDefer);}else{autoDefer();}})();</script>' . "\\n";
	}
}
redue_dynamic_schema_controller();
/* ${REDUE_SCHEMA_MARKER_END} */
?>`);
}

/**
 * Backend template builder (Zero Token Cost).
 * Accepts either compact LLM SchemaMappingJson or full DynamicPhpSchemaInput.
 * Returns the complete dynamic PHP schema controller string ready for </head> inject.
 */
export function generateDynamicPhpSchema(
	mappingOrInput: SchemaMappingJson | DynamicPhpSchemaInput,
	siteOpts?: {
		siteName?: string;
		targetUrl?: string;
		industryType?: string;
		cmsType?: string;
		imageUrl?: string;
		navItems?: SchemaNavItem[];
		knowsAbout?: string[];
		legalName?: string;
		copyrightText?: string;
		footerText?: string;
		areaServed?: string[];
		representativeName?: string;
		representativeTitle?: string;
		openingHoursOpens?: string;
		openingHoursCloses?: string;
		latitude?: string;
		longitude?: string;
		sameAs?: string[];
		medicalSpecialty?: string[];
		isAcceptingNewPatients?: boolean;
		postalCode?: string;
		streetAddress?: string;
		addressLocality?: string;
		addressRegion?: string;
		telephone?: string;
		fax?: string;
		taxId?: string;
	},
): string {
	// SchemaMappingJson path (LLM compact output)
	if ('pages' in mappingOrInput && !Array.isArray((mappingOrInput as DynamicPhpSchemaInput).pages)) {
		const mapping = parseSchemaMappingJson(mappingOrInput) || (mappingOrInput as SchemaMappingJson);
		const siteName = siteOpts?.siteName || mapping.siteName || 'Site';
		return sanitizeGeneratedPhpSnippet(buildDynamicPhpSchemaController({
			siteName,
			targetUrl: siteOpts?.targetUrl || undefined,
			pages: schemaMappingToAuditPages(mapping),
			industryType: siteOpts?.industryType,
			cmsType: siteOpts?.cmsType,
			imageUrl: siteOpts?.imageUrl || mapping.imageUrl,
			navItems: siteOpts?.navItems || mapping.nav,
			knowsAbout: siteOpts?.knowsAbout || mapping.knowsAbout,
			legalName: siteOpts?.legalName,
			copyrightText: siteOpts?.copyrightText,
			footerText: siteOpts?.footerText,
			areaServed: siteOpts?.areaServed,
			representativeName: siteOpts?.representativeName,
			representativeTitle: siteOpts?.representativeTitle,
			openingHoursOpens: siteOpts?.openingHoursOpens,
			openingHoursCloses: siteOpts?.openingHoursCloses,
			latitude: siteOpts?.latitude,
			longitude: siteOpts?.longitude,
			sameAs: siteOpts?.sameAs,
			medicalSpecialty: siteOpts?.medicalSpecialty,
			isAcceptingNewPatients: siteOpts?.isAcceptingNewPatients,
			postalCode: siteOpts?.postalCode,
			streetAddress: siteOpts?.streetAddress,
			addressLocality: siteOpts?.addressLocality,
			addressRegion: siteOpts?.addressRegion,
			telephone: siteOpts?.telephone,
			fax: siteOpts?.fax,
			taxId: siteOpts?.taxId,
			mappingJson: mapping,
		}));
	}

	const input = mappingOrInput as DynamicPhpSchemaInput;
	return sanitizeGeneratedPhpSnippet(buildDynamicPhpSchemaController({
		...input,
		siteName: siteOpts?.siteName || input.siteName,
		targetUrl: siteOpts?.targetUrl ?? input.targetUrl,
		industryType: siteOpts?.industryType ?? input.industryType,
		cmsType: siteOpts?.cmsType ?? input.cmsType,
		imageUrl: siteOpts?.imageUrl ?? input.imageUrl,
		navItems: siteOpts?.navItems ?? input.navItems,
		knowsAbout: siteOpts?.knowsAbout ?? input.knowsAbout,
		legalName: siteOpts?.legalName ?? input.legalName,
		copyrightText: siteOpts?.copyrightText ?? input.copyrightText,
		footerText: siteOpts?.footerText ?? input.footerText,
		areaServed: siteOpts?.areaServed ?? input.areaServed,
		representativeName: siteOpts?.representativeName ?? input.representativeName,
		representativeTitle: siteOpts?.representativeTitle ?? input.representativeTitle,
		openingHoursOpens: siteOpts?.openingHoursOpens ?? input.openingHoursOpens,
		openingHoursCloses: siteOpts?.openingHoursCloses ?? input.openingHoursCloses,
		latitude: siteOpts?.latitude ?? input.latitude,
		longitude: siteOpts?.longitude ?? input.longitude,
		sameAs: siteOpts?.sameAs ?? input.sameAs,
		medicalSpecialty: siteOpts?.medicalSpecialty ?? input.medicalSpecialty,
		isAcceptingNewPatients: siteOpts?.isAcceptingNewPatients ?? input.isAcceptingNewPatients,
		postalCode: siteOpts?.postalCode ?? input.postalCode,
		streetAddress: siteOpts?.streetAddress ?? input.streetAddress,
		addressLocality: siteOpts?.addressLocality ?? input.addressLocality,
		addressRegion: siteOpts?.addressRegion ?? input.addressRegion,
		telephone: siteOpts?.telephone ?? input.telephone,
		fax: siteOpts?.fax ?? input.fax,
		taxId: siteOpts?.taxId ?? input.taxId,
	}));
}

/**
 * Schema Injector Generator — CMS-agnostic public entry.
 * Emits the complete auto-injection PHP (protocol helpers + `$GLOBALS` interface
 * + Organization 5-core + Person KG + WebSite/WebPage + BreadcrumbList +
 * evidence-only HowTo/FAQPage) for Gnuboard, Youngcart, WordPress, Rhymix, or standalone PHP.
 */
export function generateSchemaInjector(
	input: DynamicPhpSchemaInput,
	siteOpts?: Parameters<typeof generateDynamicPhpSchema>[1],
): string {
	return generateDynamicPhpSchema(input, siteOpts);
}

/** Remove previously injected REDUE schema blocks (PHP or HTML comment wrappers). */
export function stripRedueSchemaBlocks(source: string): string {
	let out = String(source || '');
	// Render-call block (Phase 2 of the 2-phase injection) must be stripped BEFORE the
	// engine block below, otherwise its outer `REDUE_AI_STUDIO_RENDER:START` text would
	// never match the (narrower) engine-only regexes and would survive re-patch as a stale dup.
	out = out.replace(
		/<\?php\s*\/\*\s*REDUE_AI_STUDIO_RENDER:START[\s\S]*?REDUE_AI_STUDIO_RENDER:END\s*\*\/\s*\?>\s*/gi,
		'',
	);
	out = out.replace(
		/\/\*\s*REDUE_AI_STUDIO_RENDER:START[\s\S]*?REDUE_AI_STUDIO_RENDER:END\s*\*\//gi,
		'',
	);
	out = out.replace(
		/<\?php\s*\/\*\s*REDUE_AI_STUDIO:START[\s\S]*?REDUE_AI_STUDIO:END\s*\*\/\s*\?>\s*/gi,
		'',
	);
	out = out.replace(/\/\*\s*REDUE_AI_STUDIO:START[\s\S]*?REDUE_AI_STUDIO:END\s*\*\//gi, '');
	out = out.replace(/<!--\s*REDUE SEO\/GEO Auto-Inject[\s\S]*?<!--\s*\/REDUE SEO\/GEO Auto-Inject\s*-->\s*/gi, '');
	out = out.replace(/<!--\s*REDUE v30 PRECISION SEO START[\s\S]*?REDUE v30 PRECISION SEO END\s*-->\s*/gi, '');
	out = out.replace(/<\?php\s*redue_dynamic_schema_controller\s*\(\s*\)\s*;\s*\?>\s*/gi, '');
	out = stripPhpDefinedConstantBlock(out, 'REDUE_UNIVERSAL_ENGINE_ACTIVE');
	return out;
}

/** Brace-aware strip of leftover `if (!defined('CONST')) { ... }` engine guards. */
function stripPhpDefinedConstantBlock(source: string, constant: string): string {
	const needles = [`defined('${constant}')`, `defined("${constant}")`];
	let out = source;
	for (const needle of needles) {
		let idx = out.indexOf(needle);
		while (idx >= 0) {
			const ifIdx = out.lastIndexOf('if', idx);
			if (ifIdx < 0 || idx - ifIdx > 96) {
				idx = out.indexOf(needle, idx + needle.length);
				continue;
			}
			const braceStart = out.indexOf('{', idx);
			if (braceStart < 0) break;
			let depth = 0;
			let end = -1;
			for (let i = braceStart; i < out.length; i++) {
				const ch = out[i];
				if (ch === '{') depth += 1;
				else if (ch === '}') {
					depth -= 1;
					if (depth === 0) {
						end = i + 1;
						break;
					}
				}
			}
			if (end < 0) break;
			out = `${out.slice(0, ifIdx)}${out.slice(end)}`;
			idx = out.indexOf(needle);
		}
	}
	return out;
}

/**
 * Smart Clean: remove hardcoded OG/meta echo lines from head.sub.php
 * (typically inside `if (G5_IS_MOBILE)` / `else` branches) before dynamic inject.
 * Prevents duplicate description / og:* tags alongside the v9 controller.
 */
export function stripHardcodedMetaEchoes(source: string): string {
	let out = String(source || '');
	for (const key of HARDCODED_META_ECHO_KEYS) {
		const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// echo '<meta property="og:title" …';  /  echo "<meta name=\"description\" …";
		const lineRe = new RegExp(
			`^[ \\t]*echo\\s+[^;\\n]*<meta\\s+(?:property|name)\\s*=\\s*(?:\\\\?["'])${escaped}(?:\\\\?["'])[^;\\n]*;[ \\t]*\\r?\\n?`,
			'gim',
		);
		out = out.replace(lineRe, '');
	}
	// Collapse runs of blank lines left by removals (keep single newline)
	out = out.replace(/\n{3,}/g, '\n\n');
	return out;
}

/** Drop orphan `">` left when a PHP-in-attribute `<meta>` was cut at `?>`. */
export function stripOrphanMetaClosers(source: string): string {
	return String(source || '').replace(/^[ \t]*"\s*>[ \t]*\r?\n?/gm, '');
}

/**
 * Remove theme `<meta name|property="…">` copies the engine emits dynamically.
 * PHP-aware so `content="<?php echo $x; ?>">` does not leave leftover `">`.
 */
export function stripHardcodedHtmlMetas(
	source: string,
	keys: readonly string[] = HARDCODED_HTML_META_KEYS,
): string {
	const keySet = new Set(keys.map((k) => k.toLowerCase()));
	return String(source || '').replace(phpAwareMetaTagRe(), (tag) => {
		const key = htmlTagAttrValue(tag, 'property') || htmlTagAttrValue(tag, 'name');
		return key && keySet.has(key) ? '' : tag;
	});
}

/**
 * Smart Clean (v20/v17, v26 build-time only): remove static / theme-default canonical + og:url
 * tags and the PHP echo lines that emit them. Since v26 has no ob_start() runtime cleaner
 * anymore, this static pre-inject pass is the ONLY place duplicate canonical/og:url tags get
 * removed — always call this before injecting the v26 direct canonical engine.
 */
export function stripHardcodedCanonicalTags(source: string): string {
	let out = String(source || '');
	// HTML <link rel="canonical" …> (PHP-aware — quoted or unquoted rel)
	out = out.replace(phpAwareLinkTagRe(), (tag) =>
		/\brel\s*=\s*["']?canonical["']?/i.test(tag) ? '' : tag,
	);
	// HTML <meta property="og:url" …> — kept in sync with canonical
	out = out.replace(phpAwareMetaTagRe(), (tag) =>
		htmlTagAttrValue(tag, 'property') === 'og:url' ? '' : tag,
	);
	// PHP echo lines that print a canonical link or og:url meta
	out = out.replace(
		/^[ \t]*echo\s+[^;\n]*rel\s*=\s*(?:\\?["'])canonical(?:\\?["'])[^;\n]*;[ \t]*\r?\n?/gim,
		'',
	);
	out = out.replace(
		/^[ \t]*echo\s+[^;\n]*property\s*=\s*(?:\\?["'])og:url(?:\\?["'])[^;\n]*;[ \t]*\r?\n?/gim,
		'',
	);
	out = out.replace(/\n{3,}/g, '\n\n');
	return out;
}

/**
 * Phase 3: keep only the FIRST literal `<title>…</title>` in a static header template
 * so a theme-hardcoded title never fights with a second title tag echoed elsewhere.
 * PHP-aware (`<?php echo $x; ?>` inside the title body does not break the match) and
 * skips `<title>` occurrences nested inside `<?php … ?>` string literals.
 */
export function stripDuplicateTitleTags(source: string): string {
	const re = /<title\b[^>]*>(?:[^<]|<(?!\/title>))*?<\/title>/gi;
	let seen = false;
	return String(source || '').replace(re, (match) => {
		if (seen) return '';
		seen = true;
		return match;
	});
}

/**
 * Pre-inject cleanup: prior REDUE blocks, stale canonical/og:url, theme description/OG
 * metas (PHP-aware), PHP echo duplicates, duplicate `<title>` tags, and leftover `">` closers.
 */
export function prepareHeadSourceForInject(source: string, targetPath?: string): string {
	let out = stripRedueSchemaBlocks(source);
	if (isGnuboardHeadSubPath(targetPath) || /function\s+redue_/.test(out)) {
		out = stripOrphanedReduePhpFunctions(out);
	}
	if (isGnuboardThemeRelativePath(targetPath)) {
		out = stripGnuboardThemeSelfDelegation(out);
	}
	out = stripHardcodedCanonicalTags(out);
	out = stripHardcodedMetaEchoes(out);
	out = stripHardcodedHtmlMetas(out);
	out = stripDuplicateTitleTags(out);
	out = stripOrphanMetaClosers(out);
	return cleanPhpTemplate(out.replace(/\n{3,}/g, '\n\n'));
}

/** True when target path should receive the dynamic PHP controller (not static JSON-LD). */
export function shouldUseDynamicPhpSchema(relativePath: string): boolean {
	return /\.(php|phtml)$/i.test(relativePath.replace(/\\/g, '/'));
}

export type CrawledPageMetaHint = {
	urlPath: string;
	title?: string;
	h1?: string;
	description?: string;
};

/**
 * Build AuditPageMeta[] from solve/audit snapshot fields.
 * Main page uses full metrics; sub URLs prefer crawled Title/H1, then nav labels.
 * Garbage / encoded paths are excluded; allowlisted board queries are kept.
 */
export function pagesFromAuditPaths(opts: {
	targetUrl?: string;
	siteName: string;
	collectedUrlPaths?: string[];
	mainTitle?: string;
	mainDescription?: string;
	mainH1?: string;
	industryType?: string;
	pageTypes?: string[];
	navItems?: Array<{ name: string; url: string; menu1?: string; menu2?: string; parent?: string }>;
	/** Live-crawled per-URL title/h1 overrides (content-scoped). */
	crawledPages?: CrawledPageMetaHint[];
}): AuditPageMeta[] {
	const site = dedupeRepeatedPhrase(opts.siteName) || opts.siteName;
	const industry = opts.industryType;
	const crawledByKey = new Map<string, CrawledPageMetaHint>();
	for (const c of opts.crawledPages || []) {
		const key = sanitizePageFileKey(c.urlPath);
		if (key) crawledByKey.set(key.toLowerCase(), c);
	}

	const navPaths = (opts.navItems || [])
		.map((n) => String(n.url || '').trim().split('#')[0] || '')
		.filter(Boolean);
	const preferGnb = navPaths.length > 0;
	const paths = preferGnb ? [...navPaths] : [...(opts.collectedUrlPaths || [])];
	if (!preferGnb) {
		for (const c of opts.crawledPages || []) {
			if (c.urlPath && !paths.includes(c.urlPath)) paths.push(c.urlPath);
		}
	} else {
		for (const c of opts.crawledPages || []) {
			if (!c.urlPath || paths.includes(c.urlPath)) continue;
			const crawledKey = (sanitizePageFileKey(c.urlPath) || '').toLowerCase();
			const inNav = navPaths.some((href) => (sanitizePageFileKey(href) || '').toLowerCase() === crawledKey);
			if (inNav) paths.push(c.urlPath);
		}
	}
	if (opts.targetUrl) {
		try {
			const u = new URL(opts.targetUrl);
			const href = `${u.pathname}${u.search}` || '/';
			if (!paths.includes(href) && !paths.includes(u.pathname)) {
				paths.unshift(href === '' ? '/' : href);
			}
		} catch {
			paths.unshift('/');
		}
	}
	if (paths.length === 0) paths.push('/');
	// Always keep a homepage row when we have main metrics (subpage link lists often omit `/`)
	const hasRootPath = paths.some((p) => {
		if (p === '/' || p === '') return true;
		try {
			const u = new URL(p, 'https://example.com');
			return u.pathname === '/' && !u.search;
		} catch {
			return false;
		}
	});
	if (!hasRootPath) paths.unshift('/');

	// Ensure homepage/index is processed first so subpage priority ranking cannot steal "main"
	paths.sort((a, b) => {
		const rootScore = (p: string) => {
			if (p === '/' || p === '') return 0;
			try {
				const u = new URL(p, 'https://example.com');
				if (u.pathname === '/' && !u.search) return 0;
			} catch {
				/* ignore */
			}
			const key = (sanitizePageFileKey(p) || '').toLowerCase();
			if (key === 'index.php' || key === 'index.html' || key === 'index.htm') return 1;
			return 2;
		};
		return rootScore(a) - rootScore(b);
	});

	const seen = new Set<string>();
	const pages: AuditPageMeta[] = [];
	// Main/index: reject paging noise ("2페이지") → brand fallback
	const safeMainTitle = sanitizeMainPageTitle(opts.mainTitle, site);
	const safeMainH1 = sanitizeMainPageTitle(opts.mainH1 || opts.mainTitle, site);

	for (let i = 0; i < paths.length; i++) {
		const urlPath = paths[i];
		const isRoot =
			urlPath === '/' ||
			urlPath === '' ||
			(() => {
				try {
					const u = new URL(urlPath, 'https://example.com');
					return u.pathname === '/' && !u.search;
				} catch {
					return false;
				}
			})();

		if (!isRoot && isGarbagePageFile(urlPath)) continue;

		const file = isRoot ? 'index.php' : sanitizePageFileKey(urlPath);
		if (!file) continue;

		const key = file.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);

		const crawled = crawledByKey.get(key);
		const isMain = key === 'index.php' || key === 'index.html' || key === 'index.htm' || isRoot;
		const navHit = findNavItemForFile(file, opts.navItems);
		const navName = navHit?.name.trim();
		const crawledTitle = rejectPagingTitle(crawled?.title);
		const crawledH1 = rejectPagingTitle(crawled?.h1);
		const crawledDesc = (crawled?.description || '').trim();
		const mainDesc = (opts.mainDescription || '').trim();
		// Drop homepage meta description when it was copied into every subpage template.
		const pageDesc =
			!crawledDesc ||
			(mainDesc && normLabel(crawledDesc) === normLabel(mainDesc)) ||
			normLabel(crawledDesc) === normLabel(site)
				? ''
				: crawledDesc;
		const pathTitle = isMain
			? safeMainTitle
			: crawledTitle || crawledH1 || navName || titleFromPath(urlPath, site);
		const titleHint = `${crawledH1 || ''} ${crawledTitle || ''} ${navName || ''} ${pathTitle}`;
		const inferred = inferPageTypeFromPath(urlPath, industry, titleHint);
		const pageType = isMain
			? 'WebPage'
			: refineAssignedPageType(file, inferred, pathTitle, crawledH1 || crawledTitle || navName || '');
		const inferredMenus = inferMenuLabels(urlPath, pageType, crawledH1 || crawledTitle || navName || pathTitle);
		const menus = isMain
			? { menu1: '', menu2: '' }
			: {
					menu1: navHit?.menu1 || navHit?.parent || inferredMenus.menu1,
					menu2: navHit?.menu2 || inferredMenus.menu2,
				};
		const hierarchyTitle = formatGnbHierarchyTitle(menus.menu1, menus.menu2);
		const title = isMain
			? safeMainTitle
			: resolveHumanPageTitle({
					file,
					title: pathTitle,
					section: crawledTitle || menus.menu2 || menus.menu1,
					menu1: menus.menu1,
					menu2: menus.menu2,
					navName,
					siteName: site,
					mainTitle: safeMainTitle,
					h1: crawledH1,
				});
		const section = isMain
			? site
			: hierarchyTitle.includes(' > ')
				? hierarchyTitle
				: resolveSection({
						section: crawledH1 || crawledTitle || menus.menu1,
						menu1: menus.menu1,
						menu2: menus.menu2,
						title,
						navName,
					});
		const h1 = isMain
			? safeMainH1
			: crawledH1 || title;
		const finalType = isMain ? 'WebPage' : refineAssignedPageType(file, pageType, title, section);

		const hrefForMeta = isRoot
			? '/'
			: urlPath.startsWith('/')
				? urlPath.split('#')[0]!
				: `/${file}`;

		pages.push(
			hydrateSolvePageMeta(
				{
					urlPath: hrefForMeta,
					title,
					description: isMain
						? extendMetaDescription(opts.mainDescription || '', site, safeMainTitle)
						: fallbackDescription(title, site, pageDesc, {
								url: hrefForMeta,
								gnb: [hierarchyTitle, navName, menus.menu1, menus.menu2, section]
									.filter(Boolean)
									.join(' '),
								industryType: industry,
								mainDescription: mainDesc,
							}),
					h1,
					pageType: finalType,
					extraTypes: isMain
						? opts.pageTypes
								?.slice(1)
								.filter(
									(t) =>
										!NON_PAGE_SCHEMA_TYPES.has(t) &&
										t !== 'FAQPage' &&
										t !== 'Article' &&
										t !== 'MedicalWebPage' &&
										t !== 'WebPage',
								)
						: undefined,
					section,
					menu1: menus.menu1 || undefined,
					menu2: menus.menu2 || undefined,
					fromGnb: Boolean(navHit) || isMain,
				},
				{
					siteName: site,
					mainTitle: safeMainTitle,
					mainDescription: mainDesc,
					industryType: industry,
					navItems: opts.navItems,
				},
			),
		);
	}

	return pages;
}
