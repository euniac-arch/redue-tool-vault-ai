import {
	getCleanFileName,
	toSitePath,
	toWebpPath,
	type PageSpeedSnapshot,
	type PsiImageOpportunity,
	type PsiRenderBlockingResource,
	type PsiScriptExecution,
} from './pagespeed';

export interface DuplicateJqueryWarning {
	versions: string[];
	files: string[];
	urls: string[];
}

export interface PageSpeedPrescription {
	lcpImagePath: string;
	lcpWebpPath: string;
	lcpFileName: string;
	blockingScriptPath: string;
	blockingScriptName: string;
	fontFileName: string | null;
	duplicateJquery: DuplicateJqueryWarning | null;
}

const JQUERY_CORE =
	/jquery(?:[-.]?(?:min|slim|compat))?[-.]?(\d+\.\d+(?:\.\d+)?)?/i;
const JQUERY_PLUGIN =
	/jquery[-.]?(ui|migrate|fancybox|modal|cookie|validate|colorbox|lazy|unveil|easing|mousewheel|touchswipe|waypoints)/i;

function isJsResource(url: string, fileName: string): boolean {
	return /\.(js|mjs|cjs)(\?|#|$)/i.test(url) || /\.(js|mjs|cjs)$/i.test(fileName);
}

function isImagePath(path: string): boolean {
	return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(path);
}

function collectResourceUrls(snapshot: PageSpeedSnapshot): string[] {
	return [
		...snapshot.renderBlocking.map((r) => r.url),
		...(snapshot.scriptExecution ?? []).map((r) => r.url),
		...(snapshot.cacheResources ?? []).map((r) => r.url),
		...snapshot.images.map((r) => r.url),
	];
}

/** Detect multiple jQuery core versions (1.12.4 + 3.5.1, etc.). */
export function detectDuplicateJquery(snapshot: PageSpeedSnapshot): DuplicateJqueryWarning | null {
	const hits: { file: string; url: string; version: string | null }[] = [];
	const seen = new Set<string>();
	for (const url of collectResourceUrls(snapshot)) {
		const file = getCleanFileName(url);
		if (!/jquery/i.test(url) && !/jquery/i.test(file)) continue;
		if (JQUERY_PLUGIN.test(file) && !/jquery-\d/i.test(file)) continue;
		if (!JQUERY_CORE.test(file) && !/\/jquery(?:[-.]|@|$)/i.test(url) && !/^jquery/i.test(file)) {
			continue;
		}
		const version =
			file.match(/jquery[-.]?(\d+\.\d+(?:\.\d+)?)/i)?.[1] ??
			url.match(/jquery[@/-](\d+\.\d+(?:\.\d+)?)/i)?.[1] ??
			null;
		const key = `${file}|${version ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		hits.push({ file, url, version });
	}

	const versions = [...new Set(hits.map((h) => h.version).filter((v): v is string => Boolean(v)))];
	if (versions.length < 2) return null;

	return {
		versions: versions.sort(),
		files: hits.map((h) => h.file),
		urls: hits.map((h) => h.url),
	};
}

function pickLcpImagePath(snapshot: PageSpeedSnapshot): string {
	const fromLcp = snapshot.lcpElement?.src;
	if (fromLcp && isImagePath(fromLcp)) return toSitePath(fromLcp);

	const images = snapshot.images ?? [];
	const ranked = [...images].sort((a, b) => {
		const waste = (b.wastedBytes ?? 0) - (a.wastedBytes ?? 0);
		if (waste !== 0) return waste;
		return (b.bytes ?? 0) - (a.bytes ?? 0);
	});
	const top: PsiImageOpportunity | undefined = ranked[0];
	if (top?.url) return toSitePath(top.url);

	if (fromLcp) return toSitePath(fromLcp);
	return '/images/hero.jpg';
}

function pickBlockingScript(snapshot: PageSpeedSnapshot): { path: string; name: string } {
	const blockingJs = (snapshot.renderBlocking ?? []).filter((r: PsiRenderBlockingResource) =>
		isJsResource(r.url, r.fileName),
	);
	blockingJs.sort((a, b) => {
		const delay = (b.wastedMs ?? 0) - (a.wastedMs ?? 0);
		if (delay !== 0) return delay;
		return (b.wastedBytes ?? b.bytes ?? 0) - (a.wastedBytes ?? a.bytes ?? 0);
	});
	if (blockingJs[0]) {
		return { path: toSitePath(blockingJs[0].url), name: blockingJs[0].fileName };
	}

	const scripts = [...(snapshot.scriptExecution ?? [])].sort(
		(a: PsiScriptExecution, b: PsiScriptExecution) => (b.totalMs ?? 0) - (a.totalMs ?? 0),
	);
	if (scripts[0]) {
		return { path: toSitePath(scripts[0].url), name: scripts[0].fileName };
	}

	return { path: '/js/app.js', name: 'app.js' };
}

export function buildPageSpeedPrescription(snapshot: PageSpeedSnapshot): PageSpeedPrescription {
	const lcpImagePath = pickLcpImagePath(snapshot);
	const lcpWebpPath = toWebpPath(lcpImagePath);
	const blocking = pickBlockingScript(snapshot);
	const heaviestFont = [...snapshot.fonts].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))[0];

	return {
		lcpImagePath,
		lcpWebpPath,
		lcpFileName: getCleanFileName(lcpImagePath),
		blockingScriptPath: blocking.path,
		blockingScriptName: blocking.name,
		fontFileName: heaviestFont?.fileName ?? null,
		duplicateJquery: detectDuplicateJquery(snapshot),
	};
}

export function buildDeferJsCode(scriptPath: string): string {
	return `<!-- 렌더링 차단 스크립트: defer + DOMContentLoaded 안전 래핑 -->
<script src="${scriptPath}" defer></script>
<script defer>
  document.addEventListener('DOMContentLoaded', function () {
    // DOM 준비 후에만 무거운 초기화 실행
    if (typeof window.initHeavyWidgets === 'function') {
      window.initHeavyWidgets();
    }
  });
</script>`;
}

export function buildWebpLcpCode(origPath: string, webpPath: string): string {
	const origName = getCleanFileName(origPath);
	return `<!-- LCP 히어로 이미지: WebP + fetchpriority + 크기 예약 -->
<link rel="preload" as="image" href="${webpPath}" fetchpriority="high" />
<img
  src="${webpPath}"
  srcset="${webpPath} 1x"
  width="1200"
  height="630"
  alt="메인 비주얼"
  fetchpriority="high"
  decoding="async"
/>
<!-- ${origName} → WebP 변환 예: npx @squoosh/cli --webp auto ${origName} -->`;
}

export function buildFontCdnCode(fontFileName: string | null): string {
	const hint = fontFileName
		? `<!-- ${fontFileName} 풀셋 대신 Pretendard CDN (서브셋 + woff2) -->`
		: `<!-- 대용량 로컬 폰트 대신 Pretendard CDN (서브셋 + woff2) -->`;
	return `${hint}
<link
  rel="stylesheet"
  as="style"
  crossorigin
  href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
/>
<style>
  body {
    font-family: "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  }
</style>`;
}
