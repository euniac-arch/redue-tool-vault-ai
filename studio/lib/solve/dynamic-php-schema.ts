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
 *    OB strips duplicate canonical/og:url and reinjects one exact pair immediately after
 *    `<meta charset>` / Content-Type charset (Charset-After First-Chunk; falls back to after
 *    `<head>`, then before `</head>`).
 * ⑪ [v30] Full-Document Script Defer: `ob_start()` regex sweeps the ENTIRE buffer (head+body)
 *    and appends `defer` to sync external `<script src>` lacking async/defer/module/ld+json.
 * ⑫ Static source-text defer (`addDeferToScriptTagsInSource`) retained as defense-in-depth
 *    for Gnuboard `add_javascript()` string payloads at patch time.
 * ⑬ Lightweight drop-in: `buildUniversalObSeoEnginePhp()` / `generateUniversalPhpSeoEngine()`
 *    emit the full Universal v30 Master Engine (OB + Article/FAQ/Person schema) for any
 *    common header file with zero CMS-specific hooks (no add_javascript / G5_THEME_PATH).
 * ⑭ v22 Top-Priority Injection: insert engine immediately after the first <?php ONLY.
 *    Never replace the file or strip existing HTML / meta / verification tags from source.
 * ⑮ Article Node is guaranteed on EVERY page (main + subpages + boards). FAQPage is
 *    guaranteed on all non-board pages. Person E-E-A-T node is always emitted.
 * ⑯ [v31] NewsArticle Auto-Detect: when `$bo_table` / URL / title matches notice|press|news|
 *    media|insight|board (or 보도·뉴스·공지…), emit NewsArticle with Google/AI citation fields
 *    (headline, image, datePublished, dateModified, author Organization, publisher+logo) from
 *    Gnuboard globals — no hardcoded domain or board names.
 */

import { dedupeRepeatedPhrase } from '@/lib/audit/brand-name';
import { resolveEngineRepresentative } from '@/lib/audit/extractors/entity';

export const REDUE_SCHEMA_MARKER_START = 'REDUE_AI_STUDIO:START';
export const REDUE_SCHEMA_MARKER_END = 'REDUE_AI_STUDIO:END';

/** Success banner / modal copy for the Universal v30 Master Engine. */
export const REDUE_V30_SCHEMA_PATCH_SUCCESS =
	'✅ head.sub.php Crawler-Optimized Canonical & Schema Engine 패치 완료 (Charset-After First-Chunk · REQUEST_URI+SCRIPT_NAME 이중 감지 · HTTPS 강제 · 중복 canonical 청소 · static $executed 1회 가드 · exact canonical · script defer · Article/NewsArticle(보도·뉴스 자동) /FAQ/Person · Alt Auto-Fix)';

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
• $GLOBALS['schema_faq_items'] = [ ['q'=>'질문','a'=>'답변'], … ]  → FAQPage (서브페이지 우선; 미지정 시 v30 기본 Q&A 2종이 메인·서브 모든 비게시판 페이지에 자동 결합)
• $GLOBALS['schema_person'] = ['name'=>'이름','jobTitle'=>'직함', …]  → Person + worksFor + Organization.founder/physician (관리자 대표자명 또는 푸터/인사말 자동 추출 $rep_name; 미지정 시 {site_name} 의료진/연구팀 Fallback)
• ob_start()가 </head> 직전에 <meta name="author"> / <meta name="representative"> 를 $rep_name 또는 런타임 텍스트 스캔으로 주입
• $GLOBALS['schema_article'] = ['type'=>'Article'|'NewsArticle','headline'=>…, …]  → Article/NewsArticle (datePublished/dateModified 미지정 시 ISO 8601 자동 보완; 미지정 시 브랜드+Description 기반 기본 Article이 메인·서브·게시판 포함 모든 페이지에 자동 결합). v31: $bo_table/URL/제목에 notice|press|news|media|insight|board·보도·뉴스·공지 등이 있으면 NewsArticle로 자동 승격하고 headline·image·dates·author·publisher(logo)를 $config/$g5/$wr에서 주입
• v14 Alt Auto-Fixer: 공통 헤더 최하단 JS가 빈/누락 img[alt]를 $site_name 기반으로 자동 보완
• v15 JS Defer Auto-Fixer: 외부 script[src]에 async/defer 없으면 defer 자동 부여 (클라이언트 보강)
• v16/v30 Canonical Precision: 메인은 path가 index이고 query가 비어 있을 때만 $origin/; 서브페이지·
  /?p=123·board.php?bo_table= 등은 절대 루트로 붕괴하지 않음. 쿼리는 bo_table|co_id|it_id|ca_id|idx|p|page_id|wr_id|id 만 유지
• v32 Crawler-Optimized OB Master Engine: ob_start()로 중복 canonical/og:url 제거 후
  <meta charset>/Content-Type charset 바로 직후(Charset-After First-Chunk) exact 서브페이지 쌍 재주입
  (없으면 <head> 직후 → </head> 직전) + REQUEST_URI·SCRIPT_NAME 이중 경로 감지 + HTTPS 강제 +
  head+body 전문서 regex로 sync <script src>에 defer 부여 (진단봇 First Chunk에도 반영)
• v26 Static Script Defer: addDeferToScriptTagsInSource()가 head.sub.php 소스 자체에서 async/defer 없는
  <script src>(및 add_javascript() 문자열 인자 내부)를 찾아 defer 속성을 직접 파일에 기록 (방어적 보강)
• v22 Top-Priority: 첫 <?php 직후 삽입만 수행 — 기존 meta/Naver verification/HTML/include 절대 삭제 금지
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
$canonical_base = "https://${host}";

// 0. HTTP/HTTPS 환경변수 정제 — 진단봇이 HTTP·헤더 없이 와도 HTTPS 대표 도메인 고정
if ( ! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ) { /* keep */ }
$_SERVER['HTTPS'] = 'on';
$_SERVER['SERVER_PORT'] = '443';
if ( empty($_SERVER['HTTP_HOST']) ) {
	$_SERVER['HTTP_HOST'] = '${host}';
}
$_SERVER['HTTP_HOST'] = preg_replace('#^https?://#i', '', (string)$_SERVER['HTTP_HOST']);
$_SERVER['HTTP_HOST'] = preg_replace('#:\\d+$#', '', $_SERVER['HTTP_HOST']);

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
$exact_canonical_url = preg_replace('#^http://#i', 'https://', $final_canonical_url);
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
<link rel="canonical" href="<?php echo htmlspecialchars($exact_canonical_url, ENT_QUOTES, 'UTF-8'); ?>">
<meta property="og:url" content="<?php echo htmlspecialchars($exact_canonical_url, ENT_QUOTES, 'UTF-8'); ?>">
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
	'Crawler-Optimized Canonical & Schema Engine (Charset-After First-Chunk) — G5_URL·$config[cf_title]·$g5_head_title 자동 감지, REQUEST_URI+SCRIPT_NAME 이중 경로, HTTPS 강제, ob_start()로 중복 canonical/og:url 청소 후 <meta charset> 바로 직후 1쌍 재주입(없으면 <head> 직후 → </head> 직전), redue_dynamic_schema_controller()는 static $executed로 1회만 실행. 서브페이지 exact canonical · head+body script defer · Article/NewsArticle(보도·뉴스 게시판 자동) /FAQ/Person · Alt Auto-Fix. Gnuboard/Youngcart head.sub.php(또는 header.php) 최상단에 붙여넣으세요.';

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
		$buffer = preg_replace('/<meta\\b(?=[^>]*\\bname=["\\']author["\\'])[^>]*>\\s*/i', '', $buffer);
		$buffer = preg_replace('/<meta\\b(?=[^>]*\\bname=["\\']representative["\\'])[^>]*>\\s*/i', '', $buffer);
		$buffer = preg_replace('/<link\\b(?=[^>]*\\brel=["\\'](?:help|alternate)["\\'])(?=[^>]*llms\\.txt)[^>]*>\\s*/i', '', $buffer);
		$llms_origin = preg_replace('#^(https?://[^/]+).*#', '$1', $canonical_url);
		if ( ! is_string($llms_origin) || $llms_origin === '' ) { $llms_origin = $canonical_url; }
		$llms_href = htmlspecialchars(rtrim($llms_origin, '/') . '/llms.txt', ENT_QUOTES, 'UTF-8');
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
		if ( preg_match('/<\\/head>/i', $buffer) ) {
			$buffer = preg_replace('/<\\/head>/i', $rep_tags . '</head>', $buffer, 1);
		}
`;
}

export function buildUniversalObRegistrationPhp(): string {
	return `if ( ! defined('REDUE_UNIVERSAL_ENGINE_ACTIVE') ) {
	define('REDUE_UNIVERSAL_ENGINE_ACTIVE', true);

	// 1. 그누보드 전역변수 기반 동적 Canonical URL 추출 (수동 정제)
	//    path가 / 이어도 $_GET(bo_table 등)이 있으면 서브/게시판 — /index.php 단독은 / 로 정제
	//    REQUEST_URI + SCRIPT_NAME 이중 감지로 진단봇 경로 유실 복구
	if ( ! function_exists( 'redue_get_exact_canonical' ) ) {
		function redue_get_exact_canonical() {
			// 0) HTTP/HTTPS 환경 정제 — 진단봇이 HTTP·헤더 없이 와도 HTTPS 강제
			$_SERVER['HTTPS'] = 'on';
			$_SERVER['SERVER_PORT'] = '443';

			// 1) 대표 도메인: G5_URL 자동 참조 (타 그누보드 공통) → HTTP_HOST 폴백 → HTTPS 강제
			if ( defined('G5_URL') && G5_URL !== '' ) {
				$site_domain = rtrim(G5_URL, '/');
			} else {
				$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
				$host = preg_replace('#^https?://#i', '', $host);
				$host = preg_replace('#:\\d+$#', '', $host);
				$site_domain = 'https://' . $host;
			}
			$site_domain = preg_replace('#^http://#i', 'https://', $site_domain);

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
			return preg_replace('#^http://#i', 'https://', $final_canonical);
		}
	}

	// 2. 출력 버퍼링(ob_start): 중복 canonical/og:url 제거 후 charset 직후(First-Chunk) 1쌍 주입
	ob_start(function($buffer) {
		if ( ! is_string($buffer) || trim($buffer) === '' ) { return $buffer; }

		$canonical_url = redue_get_exact_canonical();

		// A. Strip ALL existing canonical & og:url tags (theme / controller echo / duplicates)
		$buffer = preg_replace('/<link\\b(?=[^>]*\\brel=["\\']canonical["\\'])[^>]*>\\s*/i', '', $buffer);
		$buffer = preg_replace('/<meta\\b(?=[^>]*\\bproperty=["\\']og:url["\\'])[^>]*>\\s*/i', '', $buffer);
		$buffer = preg_replace('/<link\\b(?=[^>]*\\brel=["\\'](?:help|alternate)["\\'])(?=[^>]*llms\\.txt)[^>]*>\\s*/i', '', $buffer);
		$buffer = preg_replace('/<!--\\s*REDUE v30 PRECISION SEO START[\\s\\S]*?REDUE v30 PRECISION SEO END\\s*-->\\s*/i', '', $buffer);

		// B. Charset-After First-Chunk Injection: purified pair right after charset (before large CSS)
		$seo_tags  = "\\n<!-- REDUE v30 PRECISION SEO START — SEO Standard Canonical Pair (Bot Optimized Top Position) -->\\n";
		$seo_tags .= '<link rel="canonical" href="' . htmlspecialchars($canonical_url, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		$seo_tags .= '<meta property="og:url" content="' . htmlspecialchars($canonical_url, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		$llms_origin = preg_replace('#^(https?://[^/]+).*#', '$1', $canonical_url);
		if ( ! is_string($llms_origin) || $llms_origin === '' ) { $llms_origin = $canonical_url; }
		$llms_href = htmlspecialchars(rtrim($llms_origin, '/') . '/llms.txt', ENT_QUOTES, 'UTF-8');
		$seo_tags .= '<link rel="help" type="text/markdown" href="' . $llms_href . '" title="LLMs Context">' . "\\n";
		$seo_tags .= '<link rel="alternate" type="text/markdown" href="' . $llms_href . '">' . "\\n";
		if ( isset($GLOBALS['redue_rep_name']) && is_string($GLOBALS['redue_rep_name']) && trim($GLOBALS['redue_rep_name']) !== '' ) {
			$rep_esc_ob = htmlspecialchars(trim($GLOBALS['redue_rep_name']), ENT_QUOTES, 'UTF-8');
			$seo_tags .= '<meta name="author" content="' . $rep_esc_ob . '">' . "\\n";
			$seo_tags .= '<meta name="representative" content="' . $rep_esc_ob . '">' . "\\n";
		}
		$seo_tags .= "<!-- REDUE v30 PRECISION SEO END -->\\n";

		$charset_re = '/(<meta\\b[^>]*(?:\\bcharset\\s*=|http-equiv=["\\']Content-Type["\\'][^>]*charset)[^>]*>)/i';
		if ( preg_match($charset_re, $buffer) ) {
			$buffer = preg_replace($charset_re, '$1' . $seo_tags, $buffer, 1);
		} else if ( preg_match('/(<head\\b[^>]*>)/i', $buffer) ) {
			$buffer = preg_replace('/(<head\\b[^>]*>)/i', '$1' . $seo_tags, $buffer, 1);
		} else if ( preg_match('/<\\/head>/i', $buffer) ) {
			$buffer = preg_replace('/<\\/head>/i', $seo_tags . '</head>', $buffer, 1);
		} else {
			$buffer = $seo_tags . $buffer;
		}

		// C. Global Full-Document Script Defer Transformer (Head + Body wide sweep)
		$buffer = preg_replace_callback('/<script\\b(?![^>]*\\b(defer|async|type=["\\']module["\\']|type=["\\']application\\/ld\\+json["\\'])\\b)([^>]*\\bsrc\\s*=\\s*["\\'][^"\\']+["\\'][^>]*)>/i', function($matches) {
			return preg_replace('/>$/', ' defer>', $matches[0]);
		}, $buffer);
${buildRepresentativeObMetaPhp()}
		return $buffer;
	});
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
			$redue_article_image = ( isset($origin) ? rtrim($origin, '/') : '' ) . '/logo.png';
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
 *   2. `ob_start()` strips duplicates and reinjects one clean pair after charset (Charset-After; `<head>` / `</head>` fallback)
 *   3. Full-document server-side `defer` on sync external `<script src>` tags (head + body)
 *   4. Article graph node on EVERY page (main + subpages); NewsArticle auto on news/press boards & subpages
 *   5. FAQPage on all non-board pages (universal 2-item fallback when unbound)
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
		industryType: 'MEDICAL',
	});
	const seedPhp = buildRepresentativeGlobalsSeedPhp(compiled.name, compiled.jobTitle || '대표원장');
	return `<?php
/* ${REDUE_SCHEMA_MARKER_START} — Crawler-Optimized Canonical & Schema Engine (Charset-After First-Chunk · v32) */
${seedPhp}
${buildUniversalObRegistrationPhp()}

// 3. 스키마 컨트롤러 중복 실행 방지 가드 (여러 번 호출되어도 단 1회만 실행)
if ( ! function_exists( 'redue_dynamic_schema_controller_safe' ) ) {
	function redue_dynamic_schema_controller_safe() {
		static $executed = false;
		if ( $executed ) return;
		$executed = true;

		if ( function_exists( 'redue_dynamic_schema_controller_body' ) ) {
			redue_dynamic_schema_controller_body();
		}
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller' ) ) {
	function redue_dynamic_schema_controller() {
		redue_dynamic_schema_controller_safe();
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller_body' ) ) {
	function redue_dynamic_schema_controller_body() {
		global $config, $g5_head_title;

		$site_name = (isset($config['cf_title']) && $config['cf_title'] !== '')
			? $config['cf_title']
			: (isset($GLOBALS['g5']['title']) && !empty($GLOBALS['g5']['title']) ? strip_tags($GLOBALS['g5']['title']) : '웹사이트');
		$site_title = (isset($g5_head_title) && $g5_head_title !== '')
			? $g5_head_title
			: $site_name;
		$origin = (defined('G5_URL') && G5_URL !== '')
			? rtrim(G5_URL, '/')
			: ('https://' . preg_replace('#^https?://#i', '', isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost'));
		$origin = preg_replace('#^http://#i', 'https://', $origin);
		$schema_meta_image = $origin . '/logo.png';
		$domain_host = parse_url($origin, PHP_URL_HOST);
		if ( ! is_string($domain_host) || $domain_host === '' ) {
			$domain_host = preg_replace('#^https?://#i', '', $origin);
			$domain_host = preg_replace('#/.*$#', '', $domain_host);
		}

${buildRepresentativeResolvePhp(compiled.name, compiled.jobTitle || '대표원장')}
${buildGeoAeoBindingsPhp({
	siteName: 'Site',
	pages: [],
	industryType: 'MEDICAL',
	openingHoursOpens: opts?.openingHoursOpens,
	openingHoursCloses: opts?.openingHoursCloses,
	latitude: opts?.latitude,
	longitude: opts?.longitude,
	sameAs: opts?.sameAs,
	medicalSpecialty: opts?.medicalSpecialty,
	isAcceptingNewPatients: opts?.isAcceptingNewPatients,
})}

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

		echo '<meta name="description" content="' . htmlspecialchars($schema_meta_description, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:title" content="' . htmlspecialchars($schema_meta_title, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:description" content="' . htmlspecialchars($schema_meta_description, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:type" content="' . htmlspecialchars($schema_meta_og_type, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:image" content="' . htmlspecialchars($schema_meta_image, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:site_name" content="' . htmlspecialchars($site_name, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:locale" content="ko_KR">' . "\\n";

		$graph = array();

		// Organization & WebPage Node
		$org_types = array('Organization', 'MedicalClinic', 'ProfessionalService');
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
				'latitude' => $latitude,
				'longitude' => $longitude,
			),
			'openingHoursSpecification' => array(
				array(
					'@type' => 'OpeningHoursSpecification',
					'dayOfWeek' => array('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'),
					'opens' => $opens,
					'closes' => $closes,
				),
			),
			'speakable' => $speakable_spec,
		);
${buildOrgFounderPhysicianPhp('\t\t')}
		$graph[] = $org_node;

		$graph[] = array(
			'@type' => 'WebPage',
			'@id' => $page_url . '#webpage',
			'name' => $schema_meta_title,
			'headline' => $schema_meta_title,
			'description' => $schema_meta_description,
			'url' => $page_url,
			'isPartOf' => array('@type' => 'WebSite', 'url' => $origin, 'name' => $site_name),
			'reviewedBy' => array('@id' => $origin . '/#person'),
			'speakable' => $speakable_spec,
		);

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

		// FAQPage Node
		$is_board = preg_match('/board\\.php\\?bo_table=/', $page_url);
		if ( ! $is_board ) {
			$faq_items = isset($GLOBALS['schema_faq_items']) && is_array($GLOBALS['schema_faq_items']) ? $GLOBALS['schema_faq_items'] : array(
				array(
					'q' => $schema_meta_title . ' 관련 안내 및 상담은 어떻게 신청하나요?',
					'a' => $site_name . ' 공식 웹사이트(' . $origin . ')의 안내 메뉴와 문의 창구를 통해 상세한 전문 안내를 받으실 수 있습니다.'
				),
				array(
					'q' => $site_name . ' 서비스 이용 문의처는 어디인가요?',
					'a' => '웹사이트 상단 고객센터 및 온라인 게시판을 통해 언제든지 문의 남겨주시면 빠르게 답변해 드립니다.'
				)
			);

			$faq_entities = array();
			foreach ($faq_items as $fi) {
				if (!empty($fi['q']) && !empty($fi['a'])) {
					$faq_entities[] = array(
						'@type' => 'Question',
						'name' => $fi['q'],
						'acceptedAnswer' => array('@type' => 'Answer', 'text' => $fi['a'])
					);
				}
			}
			if (!empty($faq_entities)) {
				$graph[] = array(
					'@type' => 'FAQPage',
					'@id' => $page_url . '#faq',
					'url' => $page_url,
					'mainEntity' => $faq_entities
				);
			}
		}

		// Person E-E-A-T Node
		$person = null;
		if ( isset($GLOBALS['schema_person']) && is_array($GLOBALS['schema_person']) ) {
			$person = $GLOBALS['schema_person'];
		}
		$person_eeat_name = ( is_string($rep_name) && $rep_name !== '' )
			? $rep_name
			: ( is_array($person) && ! empty($person['name']) ? $person['name'] : ( $site_name . ' 의료진/연구팀' ) );
		$person_eeat_title = ( is_string($rep_title) && $rep_title !== '' )
			? $rep_title
			: ( is_array($person) && ! empty($person['jobTitle']) ? $person['jobTitle'] : '의료 코디네이터 / 전문 연구팀' );
		$graph[] = array(
			'@type' => 'Person',
			'@id' => $origin . '/#person',
			'name' => $person_eeat_name,
			'jobTitle' => $person_eeat_title,
			'worksFor' => array('@id' => $origin . '/#organization')
		);

		// Single JSON-LD Output
		$payload = array('@context' => 'https://schema.org', '@graph' => $graph);
		echo '<script type="application/ld+json">' . "\\n" . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\\n" . '</script>' . "\\n";

		// Image Alt Auto-Fixer
		echo '<script id="redue-alt-autofix">(function(){var site=' . json_encode($site_name, JSON_UNESCAPED_UNICODE) . ';function fix(){try{var imgs=document.querySelectorAll("img");for(var i=0;i<imgs.length;i++){var img=imgs[i];var cur=img.getAttribute("alt");if(cur!=null&&String(cur).trim()!=="")continue;var kw=img.getAttribute("title")||img.getAttribute("aria-label")||"";if(!kw&&img.getAttribute("src")){try{var path=String(img.getAttribute("src")).split("?")[0];var base=path.substring(path.lastIndexOf("/")+1).replace(/\\.[a-z0-9]+$/i,"");kw=decodeURIComponent(base).replace(/[-_]+/g," ").trim();}catch(e0){}}img.setAttribute("alt",(kw&&kw.length>1?kw+" — ":"")+site);}}catch(e){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fix);else fix();if(typeof MutationObserver!=="undefined"){try{new MutationObserver(fix).observe(document.documentElement,{childList:true,subtree:true});}catch(e2){}}})();</script>' . "\\n";
	}
}
redue_dynamic_schema_controller();
/* ${REDUE_SCHEMA_MARKER_END} */
?>
`;
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
	/** Optional pre-built LLM mapping JSON (preferred over pages[]) */
	mappingJson?: SchemaMappingJson;
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
	'robots',
	'og:image',
] as const;

function phpSingleQuoted(value: string): string {
	return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Compile-time `$GLOBALS['redue_rep_*']` seed so ob_start can inject author meta. */
function buildRepresentativeGlobalsSeedPhp(name: string, title: string): string {
	return `$GLOBALS['redue_rep_name'] = ${phpSingleQuoted(name)};
$GLOBALS['redue_rep_title'] = ${phpSingleQuoted(title)};
if ( $GLOBALS['redue_rep_name'] !== '' ) {
	if ( ! isset($GLOBALS['schema_person']) || ! is_array($GLOBALS['schema_person']) ) {
		$GLOBALS['schema_person'] = array();
	}
	if ( empty($GLOBALS['schema_person']['name']) ) {
		$GLOBALS['schema_person']['name'] = $GLOBALS['redue_rep_name'];
	}
	if ( empty($GLOBALS['schema_person']['jobTitle']) && $GLOBALS['redue_rep_title'] !== '' ) {
		$GLOBALS['schema_person']['jobTitle'] = $GLOBALS['redue_rep_title'];
	}
}`;
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
	return `${indent}if ( is_string($rep_name) && $rep_name !== '' ) {
${indent}	$org_node['founder'] = array(
${indent}		'@type' => 'Person',
${indent}		'name' => $rep_name,
${indent}		'jobTitle' => $rep_title !== '' ? $rep_title : '대표자',
${indent}	);
${indent}	$org_node['physician'] = array(
${indent}		'@type' => 'Physician',
${indent}		'name' => $rep_name,
${indent}		'jobTitle' => $rep_title !== '' ? $rep_title : '대표자',
${indent}	);
${indent}}`;
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
function buildGeoAeoBindingsPhp(input: DynamicPhpSchemaInput): string {
	const opens = normalizeEngineHhMm(input.openingHoursOpens, '09:00');
	const closes = normalizeEngineHhMm(input.openingHoursCloses, '18:00');
	const latitude = normalizeEngineCoord(input.latitude, '37.4837');
	const longitude = normalizeEngineCoord(input.longitude, '127.0324');
	const industry = String(input.industryType || '').toUpperCase();
	const specialties =
		input.medicalSpecialty && input.medicalSpecialty.length > 0
			? input.medicalSpecialty.filter(Boolean)
			: industry === 'MEDICAL'
				? ['Oncologic', 'RadiationTherapy']
				: [];
	const sameAs = (input.sameAs || []).filter((url) => /^https?:\/\//i.test(url));
	const accepting = input.isAcceptingNewPatients !== false;
	const postal = String(input.postalCode || '').replace(/\D/g, '').slice(0, 5);
	const street = String(input.streetAddress || '').trim();
	const locality = String(input.addressLocality || '').trim();
	const region = String(input.addressRegion || '').trim();

	return `		$opens = ${phpSingleQuoted(opens)};
		$closes = ${phpSingleQuoted(closes)};
		$latitude = ${phpSingleQuoted(latitude)};
		$longitude = ${phpSingleQuoted(longitude)};
		$is_accepting_new_patients = ${accepting ? 'true' : 'false'};
		$medical_specialty = ${specialties.length ? phpStringList(specialties, '\t\t') : 'array()'};
		$same_as_extra = ${sameAs.length ? phpStringList(sameAs, '\t\t') : 'array()'};
		$postal_code = ${phpSingleQuoted(postal)};
		$street_address = ${phpSingleQuoted(street)};
		$locality = ${phpSingleQuoted(locality)};
		$region = ${phpSingleQuoted(region)};
		$same_as_array = array($origin);
		if ( is_array($same_as_extra) ) {
			foreach ( $same_as_extra as $_redue_sa ) {
				if ( is_string($_redue_sa) && $_redue_sa !== '' && ! in_array($_redue_sa, $same_as_array, true) ) {
					$same_as_array[] = $_redue_sa;
				}
			}
		}
		if ( is_string($domain_host) && $domain_host !== '' ) {
			$_redue_naver_blog = 'https://blog.naver.com/' . $domain_host;
			if ( ! in_array($_redue_naver_blog, $same_as_array, true) ) {
				$same_as_array[] = $_redue_naver_blog;
			}
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

/** Force https:// for origin / canonical / OG / JSON-LD @id URL assembly. */
export function enforceHttps(url: string): string {
	const raw = String(url || '').trim();
	if (!raw) return raw;
	return raw.replace(/^http:\/\//i, 'https://');
}

/** Resolve site origin with HTTPS enforcement. */
export function resolveHttpsOrigin(targetUrl?: string, fallback = 'https://example.com'): string {
	try {
		if (!targetUrl) return enforceHttps(fallback);
		return enforceHttps(new URL(targetUrl).origin);
	} catch {
		return enforceHttps(fallback);
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
	return identity ? `${file}?${identity}` : file;
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
	return /소개|인사말|오시는|길찾기|추천사|연혁|조직도|고객센터|공지|뉴스|소식|상담.?예약|문의|연락처|contact|about|company|intro|history|greeting|directions|hospital.?network|제휴.?병원|협력.?병원|해외.?병원|병원.?안내|서비스.?소개/.test(
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
	return /치료|시술|therapy|treatment|질환|암종|carcinoma|세포치료|줄기세포|백신|중입자|양성자|방사선|네오안티젠|medicalcondition|적용.?대상|cancer.?type|종양.?치료/.test(
		h,
	);
}

function inferPageTypeFromPath(urlPath: string, _industryType?: string, titleHint?: string): string {
	const hay = `${urlPath} ${titleHint || ''}`.toLowerCase();
	// Board list: always CollectionPage (FAQPage ban on board.php?bo_table=*)
	if (isBoardListPath(hay)) return 'CollectionPage';
	// Actual treatment / disease content only
	if (isMedicalContentPage(hay)) return 'MedicalWebPage';
	// Dedicated FAQ landing (not a board list)
	if (/(?:^|\/)faq(?:\.php|\/|$)|자주.?묻는|자주하는.?질문/.test(hay) && !/board\.php/.test(hay)) {
		return 'FAQPage';
	}
	if (/product|item|goods|shop|상품/.test(hay) && !isSimpleInfoPage(hay)) return 'ItemList';
	if (/doctor|staff|의료진|의료\s*진|팀\b|team|person/.test(hay)) return 'ProfilePage';
	// Intro / greeting / directions / service intro / hospital / CS → WebPage
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
	if (normalized === 'MedicalWebPage' && !isMedicalContentPage(hay)) return 'WebPage';
	if ((normalized === 'AboutPage' || normalized === 'ContactPage') && !isMedicalContentPage(hay)) {
		return 'WebPage';
	}
	if (!pageType?.trim() || NON_PAGE_SCHEMA_TYPES.has(pageType.trim()) || normalized === 'WebPage') {
		return inferPageTypeFromPath(fileOrPath, undefined, `${title} ${section}`);
	}
	return normalized;
}

function titleFromPath(urlPath: string, siteName: string): string {
	const file = basenameFromPath(urlPath).replace(/\.(php|html?|htm|phtml)$/i, '');
	if (!file || file === 'index') return siteName;
	return file
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Bare numeric/code filenames (101, s101, a1) that should not become human titles. */
function isCodeLikeFileStem(stem: string): boolean {
	const s = stem.trim();
	if (!s || s === 'index') return false;
	return /^[a-z]?\d{1,6}$/i.test(s) || /^\d+[a-z]?$/i.test(s);
}

function findNavNameForFile(
	file: string,
	nav?: Array<{ name: string; url: string }>,
): string | undefined {
	if (!nav?.length) return undefined;
	const fileKey = (sanitizePageFileKey(file) || file).toLowerCase();
	const key = basenameFromPath(file).toLowerCase();
	const stem = key.replace(/\.(php|html?|htm|phtml)$/i, '');
	const fileIdentity = extractPageIdentityQuery(file);
	for (const n of nav) {
		if (!n?.name || !n?.url) continue;
		const navFile = sanitizePageFileKey(n.url);
		if (!navFile) continue;
		if (navFile.toLowerCase() === fileKey) return n.name.trim();
		const navIdentity = extractPageIdentityQuery(n.url);
		const navBase = basenameFromPath(navFile).toLowerCase();
		// Identity-query pages must match basename + bo_table/co_id (board ≠ write)
		if (fileIdentity || navIdentity) {
			if (fileIdentity && navIdentity && fileIdentity === navIdentity && navBase === key) {
				return n.name.trim();
			}
			continue;
		}
		if (navFile.toLowerCase() === key) return n.name.trim();
		const navStem = navBase.replace(/\.(php|html?|htm|phtml)$/i, '');
		if (navStem === stem) return n.name.trim();
	}
	return undefined;
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
	if (!t || isPagingNoiseTitle(t)) return brand;
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
		if (!t || isPagingNoiseTitle(t)) return true;
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

function fallbackDescription(title: string, siteName: string, existing?: string): string {
	return extendMetaDescription(existing || '', siteName, title);
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
	const humanTitle = title && !isCodeLikeFileStem(title) ? title : '';

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
		const parent = segments[segments.length - 2].replace(/[-_]+/g, ' ');
		menu1 = parent;
		menu2 = title || fileStem;
	} else if (typeMenu1[pageType] && humanTitle && normLabel(humanTitle) !== normLabel(typeMenu1[pageType])) {
		// Category from page type + leaf title (avoid menu1 === title collapse)
		menu1 = typeMenu1[pageType];
		menu2 = humanTitle;
	} else if (humanTitle && humanTitle !== fileStem) {
		menu1 = humanTitle;
		menu2 = '';
	} else if (typeMenu1[pageType]) {
		menu1 = typeMenu1[pageType];
		menu2 = isCodeLikeFileStem(fileStem) ? title : title || fileStem;
	} else if (fileStem && fileStem !== 'index') {
		menu1 = title || fileStem;
		menu2 = '';
	}

	return { menu1, menu2 };
}

function defaultKnowsAbout(industryType?: string, _siteName?: string): string[] {
	const industry = (industryType || 'GENERAL').toUpperCase();
	if (industry === 'MEDICAL') {
		// Concrete medical / coordination topics only — no vague menu chrome
		return ['중입자치료', '해외 암치료', '해외 의료 코디네이션', '전문병원 연계', '적합성 사전 검토'];
	}
	if (industry === 'LOCAL_STORE') {
		return ['매장안내', '상품정보'];
	}
	if (industry === 'B2B_MFG') {
		return ['제품', '제조', '기술력'];
	}
	return ['전문 상담'];
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
		text.match(FOOTER_PHONE_LABELED_RE)?.[1] || text.match(FOOTER_PHONE_BARE_RE)?.[1];
	if (phoneHit) {
		const tel = phoneHit.replace(/\s+/g, '-').replace(/\.{2,}/g, '.').trim();
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
	if (contact.address) {
		const a = contact.address;
		lines.push(`${indent}'address' => array(`);
		lines.push(`${indent}\t'@type' => 'PostalAddress',`);
		if (a.postalCode) {
			lines.push(`${indent}\t'postalCode' => ${phpSingleQuoted(a.postalCode)},`);
		} else {
			lines.push(`${indent}\t'postalCode' => $postal_code,`);
		}
		lines.push(`${indent}\t'streetAddress' => ${phpSingleQuoted(a.streetAddress)},`);
		lines.push(`${indent}\t'addressLocality' => ${phpSingleQuoted(a.addressLocality)},`);
		lines.push(`${indent}\t'addressRegion' => ${phpSingleQuoted(a.addressRegion)},`);
		lines.push(`${indent}\t'addressCountry' => 'KR',`);
		lines.push(`${indent}),`);
	}
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

		// #cancer-types: authoritative 1:1 leaf map → /601.php … /613.php (never hub /600.php)
		for (const prev of cancerTypes) usedNames.delete(normLabel(prev.name));
		cancerTypes.length = 0;
		for (const t of DEFAULT_CANCER_TYPE_PAGES) {
			pushUnique(cancerTypes, t.name, `${origin}/${t.file}`);
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
	const list =
		input.pages.length > 0
			? input.pages
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
			desc: fallbackDescription(title, input.siteName, page.description),
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
		const description = fallbackDescription(title, input.siteName, row.desc);
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
	// MEDICAL industry still seeds #cancer-types ItemList → keep $page_meta in sync
	return (industryType || '').toUpperCase() === 'MEDICAL';
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

function phpStringList(values: string[], indent = '\t\t\t'): string {
	if (values.length === 0) return 'array()';
	return `array(\n${values.map((v) => `${indent}\t${phpSingleQuoted(v)},`).join('\n')}\n${indent})`;
}

/**
 * Generate the dynamic PHP schema controller block for </head> injection.
 * Uses parse_url(REQUEST_URI) → $page_meta / $page_schema → SEO meta + conditional $graph[] → json_encode.
 */
export function buildDynamicPhpSchemaController(input: DynamicPhpSchemaInput): string {
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

	const imageUrl = enforceHttps(input.imageUrl || mapping.imageUrl || `${origin}/logo.png`);
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
	const orgTypePhp =
		(input.industryType || '').toUpperCase() === 'MEDICAL'
			? `array('Organization', 'ProfessionalService', 'MedicalClinic')`
			: `array('Organization', 'ProfessionalService')`;
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

	return `<?php
/* ${REDUE_SCHEMA_MARKER_START} v32 — Crawler-Optimized Canonical & Schema Engine (Charset-After First-Chunk · REQUEST_URI+SCRIPT_NAME · Exact Subpage Canonical · Head+Body Script Defer · Article Guaranteed All Pages · FAQPage Non-Board · Person E-E-A-T · Alt JS Auto-Fix · Description Extender · sameAs · v12 Master Core: Index Parent · PostalAddress · legalName · og:type · Parent Fallback · CollectionPage · ItemList) */
${buildRepresentativeGlobalsSeedPhp(compiledRep.name, compiledRep.jobTitle)}
${buildUniversalObRegistrationPhp()}

if ( ! function_exists( 'redue_dynamic_schema_controller_safe' ) ) {
	function redue_dynamic_schema_controller_safe() {
		static $executed = false;
		if ( $executed ) return;
		$executed = true;
		if ( function_exists( 'redue_dynamic_schema_controller_body' ) ) {
			redue_dynamic_schema_controller_body();
		}
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller' ) ) {
	function redue_dynamic_schema_controller() {
		redue_dynamic_schema_controller_safe();
	}
}

if ( ! function_exists( 'redue_dynamic_schema_controller_body' ) ) {
	function redue_dynamic_schema_controller_body() {
		global $config, $g5_head_title;

		$origin = ${phpSingleQuoted(origin)};
		/* Gnuboard auto-detect: prefer G5_URL over audit-time origin (no hardcoded domain) */
		if ( defined('G5_URL') && G5_URL !== '' ) {
			$origin = rtrim(G5_URL, '/');
		}
		/* HTTPS enforcement: normalize any http:// origin leakage */
		$origin = preg_replace('#^http://#i', 'https://', $origin);
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
		$telephone = ${phpSingleQuoted(orgContact.telephone || '')};
		$email = ${phpSingleQuoted(orgContact.email || '')};
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
		$schema_meta_image = preg_replace('#^http://#i', 'https://', ${phpSingleQuoted(imageUrl)});
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

		$page_schema = ${phpAssocArray(schemaEntries)};

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
		/* v11 Index Parent Sanitization — main page never has upper hierarchy */
		if ( $is_main ) {
			$meta['parent'] = '';
			$meta['parent_url'] = '';
		}
		if ( ! empty($meta['parent_url']) ) {
			$meta['parent_url'] = preg_replace('#^http://#i', 'https://', $meta['parent_url']);
		}
		$types = isset($page_schema[$page_file])
			? $page_schema[$page_file]
			: (isset($page_schema[$page_base]) ? $page_schema[$page_base] : array($meta['type'], 'BreadcrumbList'));

		/* v30 Dynamic Canonical Overrider — single source: redue_get_exact_canonical()
		   (path / + bo_table kept; /index.php → /; never basename-collapse /sub01/index.php) */
		$schema_meta_canonical = function_exists('redue_get_exact_canonical')
			? redue_get_exact_canonical()
			: ( $is_main ? ( $origin . '/' ) : ( $origin . $page_path ) );
		$schema_meta_canonical = preg_replace('#^http://#i', 'https://', $schema_meta_canonical);
		$GLOBALS['redue_canonical_url'] = $schema_meta_canonical;
		$page_url = $schema_meta_canonical;

		$schema_meta_title = isset($meta['title']) ? $meta['title'] : $site_name;
		/* Fallback: Gnuboard runtime head title when page_meta has no distinct title */
		if ( ( ! isset($meta['title']) || $meta['title'] === '' || $meta['title'] === $site_name ) && isset($g5_head_title) && $g5_head_title !== '' ) {
			$schema_meta_title = $g5_head_title;
		}
		$schema_meta_description = isset($meta['description']) && $meta['description'] !== '' ? $meta['description'] : $schema_meta_title;
		/* v12 Description Extender — synthesize 75~150 char optimized meta description */
		$_redue_desc_len = function_exists('mb_strlen') ? mb_strlen($schema_meta_description, 'UTF-8') : strlen($schema_meta_description);
		if ( $_redue_desc_len < 75 ) {
			$schema_meta_description = trim($schema_meta_description . ' ' . $site_name . '에서 관련 전문 정보와 상담 안내를 확인하실 수 있습니다.');
			$_redue_desc_len = function_exists('mb_strlen') ? mb_strlen($schema_meta_description, 'UTF-8') : strlen($schema_meta_description);
		}
		if ( $_redue_desc_len < 75 ) {
			$schema_meta_description = trim($schema_meta_description . ' 방문객에게 신뢰할 수 있는 최신 안내와 전문 상담을 제공합니다.');
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
		/* v32: Canonical/og:url HTML tags are injected ONLY by ob_start() (Charset-After First-Chunk after meta charset, else after <head> / before </head>). Direct echo disabled to prevent duplicate tags. */
		// echo '<link rel="canonical" href="' . htmlspecialchars($schema_meta_canonical, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:title" content="' . htmlspecialchars($schema_meta_title, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:description" content="' . htmlspecialchars($schema_meta_description, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		// echo '<meta property="og:url" content="' . htmlspecialchars($schema_meta_canonical, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:type" content="' . htmlspecialchars($schema_meta_og_type, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:image" content="' . htmlspecialchars($schema_meta_image, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:site_name" content="' . htmlspecialchars($site_name, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		echo '<meta property="og:locale" content="ko_KR">' . "\\n";
		if ( $schema_meta_og_type === 'article' && $schema_meta_section !== '' ) {
			echo '<meta property="article:section" content="' . htmlspecialchars($schema_meta_section, ENT_QUOTES, 'UTF-8') . '">' . "\\n";
		}

		$graph = array();

		if ( $is_main ) {
			$org_node = array(
				'@type' => ${orgTypePhp},
				'@id' => $origin . '/#organization',
				'name' => $site_name,
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
					'latitude' => $latitude,
					'longitude' => $longitude,
				),
				'openingHoursSpecification' => array(
					array(
						'@type' => 'OpeningHoursSpecification',
						'dayOfWeek' => array('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'),
						'opens' => $opens,
						'closes' => $closes,
					),
				),
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
			if ( $telephone !== '' && empty($org_node['telephone']) ) { $org_node['telephone'] = $telephone; }
			if ( $email !== '' && empty($org_node['email']) ) { $org_node['email'] = $email; }
			if ( $telephone === '' ) { unset($org_node['telephone']); }
			if ( $email === '' ) { unset($org_node['email']); }
${buildOrgFounderPhysicianPhp('\t\t\t')}
			$graph[] = $org_node;
			$graph[] = array(
				'@type' => 'WebSite',
				'@id' => $origin . '/#website',
				'name' => $site_name,
				'url' => $origin,
				'publisher' => array('@id' => $origin . '/#organization'),
				'inLanguage' => 'ko-KR',
			);
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
			$graph[] = array(
				'@type' => $meta['type'],
				'@id' => $page_url . '#webpage',
				'name' => $meta['title'],
				'headline' => $meta['h1'],
				'description' => $meta['description'],
				'url' => $page_url,
				'isPartOf' => array('@id' => $origin . '/#website'),
				'about' => array('@id' => $origin . '/#organization'),
				'primaryImageOfPage' => array('@id' => $origin . '/#primaryimage'),
			);
			if ( $meta['type'] === 'MedicalWebPage' ) {
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

			$page_node = array(
				'@type' => $meta['type'],
				'@id' => $page_url . '#webpage',
				'name' => $meta['title'],
				'headline' => $meta['h1'],
				'description' => $meta['description'],
				'url' => $page_url,
				'isPartOf' => array('@type' => 'WebSite', 'url' => $origin, 'name' => $site_name),
				'breadcrumb' => array('@id' => $page_url . '#breadcrumb'),
			);
			if ( ! empty($meta['parent']) ) {
				$page_node['isPartOf'] = array(
					array('@type' => 'WebSite', 'url' => $origin, 'name' => $site_name),
					array(
						'@type' => 'CollectionPage',
						'name' => $meta['parent'],
						'url' => ! empty($meta['parent_url']) ? $meta['parent_url'] : ($origin . '/'),
					),
				);
			}
			$graph[] = $page_node;
			if ( $meta['type'] === 'MedicalWebPage' ) {
				$graph[count($graph) - 1]['reviewedBy'] = array('@id' => $origin . '/#person');
				$graph[count($graph) - 1]['speakable'] = $speakable_spec;
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
			if ( in_array('HowTo', $types, true) ) {
				$graph[] = array(
					'@type' => 'HowTo',
					'@id' => $page_url . '#howto',
					'name' => $meta['h1'],
					'description' => $meta['description'],
					'step' => array(
						array(
							'@type' => 'HowToStep',
							'position' => 1,
							'name' => $meta['title'],
							'text' => $meta['description'] !== '' ? $meta['description'] : $meta['h1'],
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

		/* FAQPage — $GLOBALS['schema_faq_items'] preferred (subpage bind); else v30 universal default Q&A */
		$faq_items = null;
		if ( isset($GLOBALS['schema_faq_items']) && is_array($GLOBALS['schema_faq_items']) && count($GLOBALS['schema_faq_items']) > 0 ) {
			$faq_items = $GLOBALS['schema_faq_items'];
		} elseif ( isset($schema_faq_items) && is_array($schema_faq_items) && count($schema_faq_items) > 0 ) {
			$faq_items = $schema_faq_items;
		}
		/* v14 Schema Auto-Filler — [v30] UNIVERSAL: default FAQPage Q&A on EVERY non-board page. */
		if ( ( ! is_array($faq_items) || count($faq_items) === 0 ) && ! $is_board_list ) {
			$faq_items = array(
				array(
					'q' => $schema_meta_title . ' 관련 안내 및 상담은 어떻게 신청하나요?',
					'a' => $site_name . ' 공식 웹사이트(' . $origin . ')의 안내 메뉴와 문의 창구를 통해 상세한 전문 안내를 받으실 수 있습니다.',
				),
				array(
					'q' => $site_name . ' 서비스 이용 문의처는 어디인가요?',
					'a' => '웹사이트 상단 고객센터 및 온라인 게시판을 통해 언제든지 문의 남겨주시면 빠르게 답변해 드립니다.',
				),
			);
		}
		if ( is_array($faq_items) && ! $is_board_list ) {
			$faq_entities = array();
			foreach ( $faq_items as $fi ) {
				if ( ! is_array($fi) ) { continue; }
				$q = '';
				$a = '';
				if ( isset($fi['q']) ) { $q = $fi['q']; }
				elseif ( isset($fi['question']) ) { $q = $fi['question']; }
				elseif ( isset($fi['name']) ) { $q = $fi['name']; }
				if ( isset($fi['a']) ) { $a = $fi['a']; }
				elseif ( isset($fi['answer']) ) { $a = $fi['answer']; }
				elseif ( isset($fi['text']) ) { $a = $fi['text']; }
				$q = is_string($q) ? trim($q) : '';
				$a = is_string($a) ? trim($a) : '';
				if ( $q === '' || $a === '' ) { continue; }
				$faq_entities[] = array(
					'@type' => 'Question',
					'name' => $q,
					'acceptedAnswer' => array(
						'@type' => 'Answer',
						'text' => $a,
					),
				);
			}
			if ( count($faq_entities) > 0 ) {
				$graph[] = array(
					'@type' => 'FAQPage',
					'@id' => $page_url . '#faq',
					'url' => $page_url,
					'mainEntity' => $faq_entities,
				);
			}
		}

		/* Person E-E-A-T — $rep_name / $GLOBALS['schema_person'] preferred; else {site_name} 의료진/연구팀 */
		$person = null;
		if ( isset($GLOBALS['schema_person']) && is_array($GLOBALS['schema_person']) ) {
			$person = $GLOBALS['schema_person'];
		} elseif ( isset($schema_person) && is_array($schema_person) ) {
			$person = $schema_person;
		}
		$person_eeat_name = ( is_string($rep_name) && $rep_name !== '' )
			? $rep_name
			: ( is_array($person) && ! empty($person['name']) ? $person['name'] : ( $site_name . ' 의료진/연구팀' ) );
		$person_eeat_title = ( is_string($rep_title) && $rep_title !== '' )
			? $rep_title
			: ( is_array($person) && ! empty($person['jobTitle']) ? $person['jobTitle'] : '의료 코디네이터 / 전문 연구팀' );
		$person_url = ( is_array($person) && ! empty($person['url']) )
			? preg_replace('#^http://#i', 'https://', $person['url'])
			: $page_url;
		$person_node = array(
			'@type' => 'Person',
			'@id' => $origin . '/#person',
			'name' => $person_eeat_name,
			'url' => $person_url,
			'jobTitle' => $person_eeat_title,
			'worksFor' => array(
				'@id' => $origin . '/#organization',
			),
		);
		if ( is_array($person) && ! empty($person['image']) ) {
			$person_node['image'] = preg_replace('#^http://#i', 'https://', $person['image']);
		}
		if ( is_array($person) && ! empty($person['description']) ) { $person_node['description'] = $person['description']; }
		$graph[] = $person_node;

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
						'url' => $schema_meta_image !== '' ? $schema_meta_image : ( $origin . '/logo.png' ),
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
						'url' => $schema_meta_image !== '' ? $schema_meta_image : ( $origin . '/logo.png' ),
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
			json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) .
			"\\n" . '</script>' . "\\n";

		/* v14 JS Alt Auto-Fixer — common header bottom; empty/missing img[alt] → $site_name */
		echo '<script id="redue-alt-autofix">(function(){var site=' . json_encode($site_name, JSON_UNESCAPED_UNICODE) . ';function fix(){try{var imgs=document.querySelectorAll("img");for(var i=0;i<imgs.length;i++){var img=imgs[i];var cur=img.getAttribute("alt");if(cur!=null&&String(cur).trim()!=="")continue;var kw=img.getAttribute("title")||img.getAttribute("aria-label")||img.getAttribute("data-alt")||"";if(!kw&&img.getAttribute("src")){try{var path=String(img.getAttribute("src")).split("?")[0];var base=path.substring(path.lastIndexOf("/")+1).replace(/\\.[a-z0-9]+$/i,"");kw=decodeURIComponent(base).replace(/[-_]+/g," ").replace(/\\s+/g," ").trim();}catch(e0){}}img.setAttribute("alt",(kw&&kw.length>1?kw+" — ":"")+site);}}catch(e){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fix);else fix();if(typeof MutationObserver!=="undefined"){try{new MutationObserver(function(){fix();}).observe(document.documentElement,{childList:true,subtree:true});}catch(e2){}}})();</script>' . "\\n";

		/* v15 client JS Defer Auto-Fixer — defense-in-depth; primary fix is v30 full-document OB defer + static addDeferToScriptTagsInSource() */
		echo '<script id="redue-js-defer-fix">(function(){function autoDefer(){try{var scripts=document.querySelectorAll("script[src]");for(var i=0;i<scripts.length;i++){var s=scripts[i];var src=s.getAttribute("src")||"";if(src&&!s.hasAttribute("defer")&&!s.hasAttribute("async")&&s.id!=="redue-js-defer-fix"&&s.id!=="redue-alt-autofix"){s.setAttribute("defer","defer");}}}catch(e){}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",autoDefer);}else{autoDefer();}})();</script>' . "\\n";
	}
}
redue_dynamic_schema_controller();
/* ${REDUE_SCHEMA_MARKER_END} */
?>`;
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
	},
): string {
	// SchemaMappingJson path (LLM compact output)
	if ('pages' in mappingOrInput && !Array.isArray((mappingOrInput as DynamicPhpSchemaInput).pages)) {
		const mapping = parseSchemaMappingJson(mappingOrInput) || (mappingOrInput as SchemaMappingJson);
		const siteName = siteOpts?.siteName || mapping.siteName || 'Site';
		return buildDynamicPhpSchemaController({
			siteName,
			targetUrl: siteOpts?.targetUrl ? enforceHttps(siteOpts.targetUrl) : undefined,
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
			mappingJson: mapping,
		});
	}

	const input = mappingOrInput as DynamicPhpSchemaInput;
	return buildDynamicPhpSchemaController({
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
	});
}

/** Remove previously injected REDUE schema blocks (PHP or HTML comment wrappers). */
export function stripRedueSchemaBlocks(source: string): string {
	let out = String(source || '');
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

/**
 * Smart Clean (v20/v17, v26 build-time only): remove static / theme-default canonical + og:url
 * tags and the PHP echo lines that emit them. Since v26 has no ob_start() runtime cleaner
 * anymore, this static pre-inject pass is the ONLY place duplicate canonical/og:url tags get
 * removed — always call this before injecting the v26 direct canonical engine.
 */
export function stripHardcodedCanonicalTags(source: string): string {
	let out = String(source || '');
	// HTML <link rel="canonical" …> (any attribute order)
	out = out.replace(/<link\b(?=[^>]*\brel\s*=\s*["']canonical["'])[^>]*>\s*/gi, '');
	// HTML <meta property="og:url" …> (any attribute order) — kept in sync with canonical
	out = out.replace(/<meta\b(?=[^>]*\bproperty\s*=\s*["']og:url["'])[^>]*>\s*/gi, '');
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
 * Pre-inject cleanup for the v26 no-OB pipeline: strip prior REDUE blocks, then strip any
 * static/theme-default canonical + og:url tags so the direct engine's echo is never duplicated
 * (there is no runtime buffer cleaner anymore to catch this at the end of the request).
 */
export function prepareHeadSourceForInject(source: string): string {
	return stripHardcodedCanonicalTags(stripRedueSchemaBlocks(source));
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
	navItems?: Array<{ name: string; url: string }>;
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

	const paths = [...(opts.collectedUrlPaths || [])];
	for (const c of opts.crawledPages || []) {
		if (c.urlPath && !paths.includes(c.urlPath)) paths.push(c.urlPath);
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
		const navName = findNavNameForFile(file, opts.navItems);
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
		const menus = isMain
			? { menu1: '', menu2: '' }
			: inferMenuLabels(urlPath, pageType, crawledH1 || crawledTitle || navName || pathTitle);
		const title = isMain
			? safeMainTitle
			: resolveHumanPageTitle({
					file,
					title: pathTitle,
					section: crawledTitle || menus.menu1,
					menu1: menus.menu1,
					menu2: menus.menu2,
					navName,
					siteName: site,
					mainTitle: safeMainTitle,
					h1: crawledH1,
				});
		const section = isMain
			? site
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

		pages.push({
			urlPath: hrefForMeta,
			title,
			description: isMain
				? extendMetaDescription(opts.mainDescription || '', site, safeMainTitle)
				: fallbackDescription(title, site, pageDesc),
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
		});
	}

	return pages;
}
