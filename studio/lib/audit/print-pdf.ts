import { applyThemeClass, isAdminPathname, readThemeForPath } from '@/lib/theme';

const PDF_PRINTING_CLASS = 'pdf-printing';
/** Lightweight print-capture flag — disables shadows / blur / transitions in CSS. */
const PRINT_MODE_CLASS = 'print-mode';
/** Native `window.print()` isolation: hide chrome, show `#pdf-print-area` only. */
const PDF_NATIVE_PRINT_CLASS = 'pdf-native-print';
const PDF_PREVIEW_CAPTURING_CLASS = 'pdf-preview-capturing';
/**
 * Set on `<html>` while a component with its own already-paginated
 * `.pdf-preview-content` A4 sheets (the PDF preview modal, the public A4
 * report page) has real pages mounted. `@media print` keys off this class
 * — instead of the `body:has(.report-preview-modal)` selectors used
 * elsewhere in `globals.css` — so "print my own on-screen pages" keeps
 * working even in engines without `:has()` support, and so the isolation
 * rules never depend on the same-tick timing of a `:has()` re-evaluation.
 */
const PDF_PREVIEW_SURFACE_CLASS = 'pdf-preview-surface-open';
const PDF_PRINT_AREA_ID = 'pdf-print-area';
const PRINT_REPORT_CONTAINER_ID = 'print-report-container';
const PDF_STYLE_BACKUP_ATTR = 'data-pdf-inline-backup';
const TWO_TRACK_SECTION_ID = 'sec-pdf-two-track';
const MOUNT_AUDIT_RESULT_TABS_EVENT = 'redue:mount-audit-result-tabs';
const JPEG_QUALITY = 0.8;
const PAGE_CAPTURE_SELECTOR = '.pdf-page-node, .report-page';
const YIELD_BETWEEN_PAGES_MS = 10;
/**
 * Hard per-page ceiling for a single `html2canvas` capture. A single slow /
 * unreachable external image (favicon, OG thumbnail, competitor logo, etc.)
 * used to be able to block the whole export for tens of seconds because
 * `imageTimeout: 0` disabled html2canvas's own timeout entirely. This cap
 * guarantees no single page can stall the download past a few seconds — the
 * page is silently skipped instead (see `raceWithTimeout` in `captureElement`).
 */
const CAPTURE_TIMEOUT_MS = 6000;
const DEFAULT_PDF_FILENAME = 'A4_진단리포트.pdf';

const FORCED_PRINT_PROPS = ['display', 'visibility', 'height', 'max-height', 'overflow'] as const;

/** Snapshot of the theme before the first `beginPdfLightPrint()` in a session. */
let themeBeforePrint: 'light' | 'dark' | null = null;

/** CSS pixels matching A4 at ~96dpi (210mm × 297mm). */
export const A4_CSS_PX = { width: 794, height: 1123 } as const;
const A4_PT = { width: 595.28, height: 841.89 } as const;
/**
 * A4 sheet inner padding — approximates the requested `12mm 15mm` print
 * margin (12mm ≈ 45px, 15mm ≈ 57px @96dpi) while staying full-bleed at the
 * physical page edge (the margin is baked into `.pdf-page-node-inner`
 * padding in globals.css, not a browser `@page` margin, so the 210×297mm
 * capture math below never drifts from what html2canvas actually paints).
 * Bottom keeps a little extra room for the absolute-positioned page footer.
 */
const PAGE_PAD_TOP_PX = 45;
const PAGE_PAD_BOTTOM_PX = 57;
const PAGE_PAD_SIDE_PX = 57;
const PAGE_GAP_PX = 14;
const BLANK_PAGE_THRESHOLD_PT = 10;
/**
 * Raster scale for html2canvas. `2` (not `1.5`) is intentional: A4_CSS_PX
 * (794×1123) × 2 lands on whole pixels (1588×2246), so html2canvas never has
 * to round a fractional canvas dimension. A non-integer scale (e.g. `1.5` →
 * 1123×1.5 = 1684.5) forces an internal floor/ceil that very slightly skews
 * the canvas aspect ratio away from 794:1123 — every downstream page then
 * drifts by a fraction of a point in `addCanvasPages`, which is exactly the
 * "elements creep toward the top / margins go out of alignment" symptom
 * across a multi-page export. Page-by-page capture + JPEG/FAST keeps 30+
 * sheets inside a few-second budget even at the higher scale.
 */
const HTML2CANVAS_SCALE = 2;
const MAX_PDF_PAGES = 40;

type Html2CanvasFn = (typeof import('html2canvas'))['default'];

export type PdfDownloadProgress = {
	current: number;
	total: number;
};

export type DownloadPreviewPdfOptions = {
	filename?: string;
	onProgress?: (current: number, total: number) => void;
};

const HTML2CANVAS_SAFETY = {
	scale: HTML2CANVAS_SCALE,
	useCORS: true,
	logging: false,
	allowTaint: false,
	backgroundColor: '#ffffff',
	/**
	 * Bounded (was `0` = disabled). An unbounded timeout meant a single
	 * slow/unreachable hotlinked image (broken favicon, dead OG thumbnail,
	 * blocked CORS asset) could make html2canvas hang for as long as the
	 * browser's own network stack takes to give up — tens of seconds,
	 * multiplied across every page that referenced it. 1s is plenty since
	 * every image in the report is already painted on screen (same-origin
	 * cache hit) before capture starts.
	 */
	imageTimeout: 1000,
	removeContainer: true,
	foreignObjectRendering: false,
} as const;

/**
 * `Promise.race` a promise against a hard deadline. Used to guarantee a
 * single `html2canvas(...)` call can never stall the whole export — if it
 * hasn't settled by `ms`, resolve `null` (page gets skipped) and let the
 * capture continue running in the background rather than blocking the UI.
 */
function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
	return new Promise((resolve) => {
		let settled = false;
		const timer = window.setTimeout(() => {
			if (settled) return;
			settled = true;
			resolve(null);
		}, ms);
		promise.then(
			(value) => {
				if (settled) return;
				settled = true;
				window.clearTimeout(timer);
				resolve(value);
			},
			() => {
				if (settled) return;
				settled = true;
				window.clearTimeout(timer);
				resolve(null);
			},
		);
	});
}

const PRETENDARD_LOAD_SPECS = [
	'400 16px Pretendard',
	'500 16px Pretendard',
	'600 16px Pretendard',
	'700 16px Pretendard',
	'800 16px Pretendard',
] as const;

const PDF_FONT_STACK =
	'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

/**
 * Enter a forced light color-scheme for A4 print / html2canvas / Save-as-PDF.
 * ThemeProvider watches this class so the `dark` root class is removed
 * for the duration of the print job (Tailwind `dark:` variants stay off).
 */
export function isPrintCaptureMode(): boolean {
	if (typeof document === 'undefined') return false;
	const root = document.documentElement;
	return root.classList.contains(PDF_PRINTING_CLASS) || root.classList.contains(PRINT_MODE_CLASS);
}

export function beginPdfLightPrint(): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	if (!root.classList.contains(PDF_PRINTING_CLASS) && !root.classList.contains(PRINT_MODE_CLASS)) {
		themeBeforePrint = root.classList.contains('dark') ? 'dark' : 'light';
	}
	root.classList.add(PDF_PRINTING_CLASS, PRINT_MODE_CLASS);
	root.classList.remove('dark');
	root.style.colorScheme = 'light';
}

function backupForcedPrintStyles(el: HTMLElement): void {
	if (el.hasAttribute(PDF_STYLE_BACKUP_ATTR)) return;
	const backup: Record<string, string> = {};
	for (const prop of FORCED_PRINT_PROPS) {
		backup[prop] = el.style.getPropertyValue(prop);
	}
	el.setAttribute(PDF_STYLE_BACKUP_ATTR, JSON.stringify(backup));
}

function restorePdfDomMutations(): void {
	if (typeof document === 'undefined') return;
	document.querySelectorAll<HTMLElement>(`[${PDF_STYLE_BACKUP_ATTR}]`).forEach((el) => {
		let backup: Record<string, string> = {};
		try {
			backup = JSON.parse(el.getAttribute(PDF_STYLE_BACKUP_ATTR) || '{}') as Record<string, string>;
		} catch {
			backup = {};
		}
		for (const prop of FORCED_PRINT_PROPS) {
			const prev = backup[prop];
			if (prev) el.style.setProperty(prop, prev);
			else el.style.removeProperty(prop);
		}
		el.removeAttribute(PDF_STYLE_BACKUP_ATTR);
	});

	document.querySelectorAll<HTMLElement>('.pdf-print-only, #sec-pdf-two-track').forEach((el) => {
		if (el.hasAttribute(PDF_STYLE_BACKUP_ATTR)) return;
		for (const prop of FORCED_PRINT_PROPS) {
			el.style.removeProperty(prop);
		}
	});
}

function removeEphemeralPdfNodes(): void {
	if (typeof document === 'undefined') return;
	document.querySelectorAll<HTMLElement>('[data-html2canvas-clone], .html2canvas-container').forEach((el) => {
		el.remove();
	});
}

/**
 * Drop print-mode classes, restore theme, and revert every inline style / clone
 * that A4 capture attached to the live diagnostic result tree.
 */
export function endPdfLightPrint(): void {
	if (typeof document === 'undefined') return;
	restorePdfDomMutations();
	removeEphemeralPdfNodes();
	const root = document.documentElement;
	root.classList.remove(
		PDF_PRINTING_CLASS,
		PRINT_MODE_CLASS,
		PDF_NATIVE_PRINT_CLASS,
		PDF_PREVIEW_CAPTURING_CLASS,
	);
	const restoreTo =
		themeBeforePrint ?? readThemeForPath(isAdminPathname(window.location.pathname));
	themeBeforePrint = null;
	applyThemeClass(restoreTo);
}

/** Clear cloned A4 sheets and fully unwind print-mode side effects. */
export function teardownPdfSession(dest?: HTMLElement | null): void {
	clearPdfPreview(dest ?? null);
	endPdfLightPrint();
	unmarkPdfPreviewSurfaceOpen();
}

function waitFrames(count = 1): Promise<void> {
	return new Promise((resolve) => {
		const step = (left: number) => {
			if (left <= 0) {
				resolve();
				return;
			}
			window.requestAnimationFrame(() => step(left - 1));
		};
		step(count);
	});
}

/** Yield so React can paint progress and the main thread is not frozen. */
function yieldToMain(ms = YIELD_BETWEEN_PAGES_MS): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

function releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
	if (!canvas) return;
	try {
		canvas.width = 0;
		canvas.height = 0;
	} catch {
		/* ignore */
	}
}

const ELEMENT_MOUNT_TIMEOUT_MS = 2000;
const ELEMENT_MOUNT_POLL_MS = 50;

function isElementReadyForCapture(el: HTMLElement | null | undefined): el is HTMLElement {
	return Boolean(el && el.isConnected);
}

/**
 * Poll until `getEl()` returns a connected (fully mounted) node, then wait
 * two animation frames so layout has settled. Prevents html2canvas / clone
 * from running against a still-null ref or a dest that hasn't committed.
 */
export async function waitForMountedElement(
	getEl: () => HTMLElement | null | undefined,
	options?: { isAborted?: () => boolean; timeoutMs?: number },
): Promise<HTMLElement | null> {
	if (typeof document === 'undefined') return null;
	const timeoutMs = options?.timeoutMs ?? ELEMENT_MOUNT_TIMEOUT_MS;
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (options?.isAborted?.()) return null;
		const el = getEl() ?? null;
		if (isElementReadyForCapture(el)) {
			await waitFrames(2);
			if (options?.isAborted?.()) return null;
			if (isElementReadyForCapture(el)) return el;
		}
		if (Date.now() >= deadline) {
			const late = getEl() ?? null;
			return isElementReadyForCapture(late) ? late : null;
		}
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, ELEMENT_MOUNT_POLL_MS);
		});
	}
}

/** SVG `className` is an SVGAnimatedString — never call `.includes` on it. */
function elementClassName(el: Element): string {
	const attr = el.getAttribute('class');
	if (typeof attr === 'string') return attr;
	const value = (el as HTMLElement).className;
	return typeof value === 'string' ? value : '';
}

const FONT_WAIT_MS = 400;

/** Wait until Pretendard (and any other document fonts) are fully ready. */
async function waitForWebFonts(): Promise<void> {
	if (typeof document === 'undefined' || !document.fonts) return;
	if (document.fonts.status === 'loaded') return;
	try {
		await Promise.race([
			document.fonts.ready.then(() =>
				Promise.all(PRETENDARD_LOAD_SPECS.map((spec) => document.fonts.load(spec).catch(() => undefined))),
			),
			new Promise<void>((resolve) => window.setTimeout(resolve, FONT_WAIT_MS)),
		]);
	} catch {
		/* ignore */
	}
}

const ASSET_WAIT_MS = 800;

function waitForImg(img: HTMLImageElement): Promise<void> {
	if (img.complete) return Promise.resolve();
	return new Promise((resolve) => {
		const done = () => resolve();
		img.addEventListener('load', done, { once: true });
		img.addEventListener('error', done, { once: true });
		window.setTimeout(done, ASSET_WAIT_MS);
	});
}

/**
 * Wait until fonts, images, and chart surfaces in `root` have painted.
 * Call after `html.pdf-printing` unfolds hidden tab panels.
 */
export async function waitForPdfAssets(
	root?: ParentNode | null,
	isAborted?: () => boolean,
): Promise<void> {
	if (isAborted?.()) return;
	const target = root ?? resolvePrintArea() ?? (typeof document !== 'undefined' ? document : null);
	if (!target) return;

	await waitForWebFonts();
	if (isAborted?.()) return;

	try {
		window.dispatchEvent(new Event('resize'));
	} catch {
		/* ignore */
	}

	const images = Array.from(target.querySelectorAll('img'));
	await Promise.all(images.map((img) => waitForImg(img)));
	if (isAborted?.()) return;
	await waitFrames(1);
}

/**
 * Elements a page/section author can opt an element out of PDF capture with
 * (`no-pdf-capture`), plus native tags that are either unrenderable by
 * html2canvas' canvas backend or notorious for stalling a capture — a
 * cross-origin `<video>`/`<iframe>` frame can block on network / decode work
 * that never resolves within the page-level capture budget.
 */
function isNeverCapturedTag(el: Element): boolean {
	return el.tagName === 'VIDEO' || el.tagName === 'IFRAME';
}

/**
 * Recharts renders every chart as an `<svg class="recharts-surface">` full of
 * `<defs>`/gradients/grid-lines/paths — by far the most expensive node type
 * for html2canvas to walk and rasterize. Individual chart components should
 * already wrap themselves in `.pdf-screen-only` (see `DualScoreSummaryHeader`),
 * but this is a project-wide safety net so a future chart added to the print
 * tree without that wrapper can never reintroduce a 1-minute+ capture stall.
 */
function isHeavyChartSurface(el: Element): boolean {
	return el.tagName.toLowerCase() === 'svg' && el.classList.contains('recharts-surface');
}

function isScreenOnlyElement(el: Element): boolean {
	if (isHeavyChartSurface(el)) return true;
	if (!(el instanceof HTMLElement)) return false;
	if (isNeverCapturedTag(el)) return true;
	// Track 1/2/3 bodies must stay in the capture even when a child still
	// carries a leftover `pdf-screen-only` / `print:hidden` class.
	if (el.classList.contains('audit-result-tab-panel') || el.closest('.audit-result-tab-panel')) {
		return false;
	}
	if (el.classList.contains('print:hidden')) return true;
	if (el.classList.contains('pdf-screen-only')) return true;
	if (el.classList.contains('no-pdf-capture')) return true;
	if (el.closest('.pdf-screen-only, .print\\:hidden, .no-pdf-capture')) return true;
	return false;
}

function resolvePrintArea(): HTMLElement | null {
	return (
		document.getElementById(PDF_PRINT_AREA_ID) ??
		document.getElementById(PRINT_REPORT_CONTAINER_ID) ??
		(document.querySelector('.pdf-print-area, .print-report-container') as HTMLElement | null)
	);
}

/**
 * The curated `AuditReportDocument` print sections that carry Track 1
 * (3-track composite / quick axes / schema / on-page checklist), Track 2
 * (AI-engine citation), and Track 3 (Core Web Vitals) content, plus the
 * roadmap. Each is behind a `DeferredSection` (intersection/idle/`beforeprint`)
 * *and* a deferred reveal — either can still be unmounted/unresolved
 * for a beat after `requestFullReportMount()` fires, especially on a slow first
 * paint. A page count > 0 from whatever happens to be in the DOM at that instant
 * is not proof all three tracks made it into the capture, so callers must poll
 * for these ids before scanning `#pdf-print-area` for page items.
 */
export const REQUIRED_PDF_TRACK_SECTION_IDS = [
	'sec-print-track-1', // Track 1 — 기술 무결성 & Schema (full tab body)
	'sec-print-track-2', // Track 2 — AI 검색 신뢰도 & 인용 (full tab body)
	'sec-print-track-3', // Track 3 — Core Web Vitals (full tab body)
	'sec-pdf-two-track', // 3-track composite diagnosis (print twin of the dashboard card)
	'sec-pdf-quick-axes', // Track 1 — GEO/Schema/technical/infra quick axes
	'sec-pdf-engine-table', // Track 2 — AI engine citation readiness
	'sec-pdf-schema-table', // Track 1 — structured-data graph
	'sec-pdf-cwv', // Track 3 — Core Web Vitals / PSI summary
	'sec-pdf-onpage-grid', // Track 1 — full on-page checklist
	'sec-pdf-roadmap', // cross-track priority roadmap
] as const;

function isSectionPainted(el: Element | null): boolean {
	if (!el || !(el instanceof HTMLElement)) return false;
	return el.getBoundingClientRect().height > 0 || el.scrollHeight > 0;
}

/**
 * Poll until every required Track 1/2/3 print section has actually mounted
 * and painted inside `root` (defaults to `#pdf-print-area`), or `timeoutMs`
 * elapses. Guards against the PDF/print capture silently dropping a track
 * just because its `DeferredSection` reveal hadn't finished yet when the
 * DOM was scanned.
 */
export async function waitForRequiredPdfSections(
	root?: ParentNode | null,
	options?: {
		isAborted?: () => boolean;
		timeoutMs?: number;
		sectionIds?: readonly string[];
	},
): Promise<{ ready: boolean; missingIds: string[] }> {
	const ids = options?.sectionIds ?? REQUIRED_PDF_TRACK_SECTION_IDS;
	const timeoutMs = options?.timeoutMs ?? 2500;
	const pollMs = 50;
	const deadline = Date.now() + timeoutMs;

	// One extra mount request up front in case the caller's own
	// `requestFullReportMount()` fired before this section subscribed its
	// listeners (e.g. very first render of the report).
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new Event(MOUNT_AUDIT_RESULT_TABS_EVENT));
	}
	const initial = root ?? resolvePrintArea();
	if (initial) forcePrintOnlyVisible(initial);

	let missingIds = [...ids];
	for (;;) {
		if (options?.isAborted?.()) return { ready: false, missingIds };
		const target = root ?? resolvePrintArea();
		missingIds = target
			? ids.filter((id) => !isSectionPainted((target as ParentNode).querySelector?.(`#${id}`) ?? null))
			: [...ids];
		if (missingIds.length === 0) return { ready: true, missingIds: [] };
		if (Date.now() >= deadline) return { ready: false, missingIds };
		await new Promise((resolve) => window.setTimeout(resolve, pollMs));
	}
}

function stripCompositeEffects(node: HTMLElement): void {
	node.style.filter = 'none';
	node.style.boxShadow = 'none';
	node.style.textShadow = 'none';
	node.style.backdropFilter = 'none';
	node.style.setProperty('-webkit-backdrop-filter', 'none');
	node.style.animation = 'none';
	node.style.transition = 'none';
}

/** Prevent html2canvas from shrinking/kerning Pretendard glyphs. */
function calibratePdfFonts(node: HTMLElement): void {
	node.style.fontFamily = PDF_FONT_STACK;
	node.style.letterSpacing = 'normal';
	node.style.wordSpacing = 'normal';
	node.style.fontKerning = 'none';
	node.style.fontVariantLigatures = 'none';
	node.style.textRendering = 'geometricPrecision';
	node.style.setProperty('-webkit-font-smoothing', 'antialiased');
	node.style.setProperty('-moz-osx-font-smoothing', 'grayscale');
}

function isTextLevelElement(node: HTMLElement): boolean {
	return /^(P|SPAN|A|LI|TD|TH|LABEL|EM|STRONG|SMALL|B|I|U|H1|H2|H3|H4|H5|H6|TIME|CODE)$/.test(
		node.tagName,
	);
}

function prepareClonedDocument(clonedDoc: Document): void {
	clonedDoc.documentElement.classList.add(PDF_PRINTING_CLASS, PRINT_MODE_CLASS);
	clonedDoc.documentElement.classList.remove('dark');
	clonedDoc.documentElement.style.colorScheme = 'light';

	clonedDoc.querySelectorAll('.pdf-page-node, .pdf-preview-content').forEach((node) => {
		if (!(node instanceof HTMLElement)) return;
		const isPage = node.classList.contains('pdf-page-node');
		node.style.setProperty('overflow', 'visible', 'important');
		node.style.setProperty('height', 'auto', 'important');
		if (isPage) {
			node.style.width = `${A4_CSS_PX.width}px`;
			node.style.setProperty('min-height', `${A4_CSS_PX.height}px`, 'important');
		}
		node.style.backgroundColor = '#ffffff';
		node.style.color = '#0f172a';
		stripCompositeEffects(node);
	});

	clonedDoc
		.querySelectorAll(
			'.pdf-page-node-inner, .pdf-page-item, .audit-report-section, .exec-briefing-card, .pdf-preview-content section, .pdf-preview-content article',
		)
		.forEach((node) => {
			if (!(node instanceof HTMLElement)) return;
			flattenBlockHeight(node);
		});

	clonedDoc
		.querySelectorAll<HTMLElement>('.keyword-pipeline-section, #keyword-pipeline, .pdf-page-node')
		.forEach((node) => unlockKeywordPipeline(node));

	clonedDoc
		.querySelectorAll('.pdf-card-box, .exec-briefing-card article')
		.forEach((node) => {
			if (!(node instanceof HTMLElement)) return;
			preserveCardTopPadding(node);
		});

	clonedDoc.querySelectorAll('.pdf-preview-content *').forEach((node) => {
		if (!(node instanceof HTMLElement)) return;
		stripCompositeEffects(node);
		calibratePdfFonts(node);
		if (isTextLevelElement(node)) {
			node.style.verticalAlign = 'baseline';
		}
	});
}

function revealPrintOnlyNode(el: HTMLElement): void {
	backupForcedPrintStyles(el);
	el.style.setProperty('display', 'block', 'important');
	el.style.setProperty('visibility', 'visible', 'important');
	el.style.setProperty('height', 'auto', 'important');
	el.style.setProperty('max-height', 'none', 'important');
	el.style.setProperty('overflow', 'visible', 'important');
}

function forcePrintOnlyVisible(root: ParentNode): void {
	root.querySelectorAll<HTMLElement>('.pdf-print-only, #sec-pdf-two-track').forEach((el) => {
		revealPrintOnlyNode(el);
	});
}

function isRenderablePageItem(el: HTMLElement): boolean {
	if (isScreenOnlyElement(el)) return false;
	if (el.id === TWO_TRACK_SECTION_ID || el.classList.contains('pdf-print-only')) {
		revealPrintOnlyNode(el);
		// 3-track composite must stay in the A4 pack even if layout hasn't
		// painted a measurable box yet (display:none leftover / first frame).
		if (el.id === TWO_TRACK_SECTION_ID) return true;
	}
	if (el.offsetHeight < 2 && el.scrollHeight < 2) return false;
	return true;
}

function dropNested(items: HTMLElement[]): HTMLElement[] {
	return items.filter(
		(el, _, all) => !all.some((other) => other !== el && other.contains(el)),
	);
}

function isPageCaptureNode(el: Element): boolean {
	return el.classList.contains('pdf-page-node') || el.classList.contains('report-page');
}

/**
 * Collect already-paginated A4 sheets. Never fall back to the full-height
 * report container — that path rasterizes the entire DOM into one canvas.
 */
function collectReportPageNodes(root: HTMLElement): HTMLElement[] {
	const fromTree = Array.from(root.querySelectorAll<HTMLElement>(PAGE_CAPTURE_SELECTOR));
	if (root.matches?.(PAGE_CAPTURE_SELECTOR)) {
		fromTree.unshift(root);
	}
	const unique = [...new Set(fromTree)].filter(
		(el) => el.isConnected && (el.offsetWidth > 0 || el.scrollWidth > 0),
	);
	return dropNested(unique);
}

function isCaptureIgnoredNode(node: Element, captureEl: HTMLElement): boolean {
	if (node === captureEl || captureEl.contains(node) || node.contains(captureEl)) {
		return false;
	}
	if (isPageCaptureNode(node)) return true;
	if (isScreenOnlyElement(node) || isNeverCapturedTag(node)) return true;
	if (
		node.classList.contains('pdf-preview-chrome') ||
		node.classList.contains('no-pdf-capture') ||
		node.classList.contains('pdf-download-spinner') ||
		node.classList.contains('pdf-generating-loader')
	) {
		return true;
	}
	if (node.id === PDF_PRINT_AREA_ID) return true;
	return false;
}

function isolateClonedCapture(clonedDoc: Document, clonedEl: Element): void {
	clonedDoc.querySelectorAll(PAGE_CAPTURE_SELECTOR).forEach((node) => {
		if (node !== clonedEl && !clonedEl.contains(node)) node.remove();
	});
	const livePrint = clonedDoc.getElementById(PDF_PRINT_AREA_ID);
	if (livePrint && livePrint !== clonedEl && !livePrint.contains(clonedEl)) {
		livePrint.remove();
	}
	clonedDoc
		.querySelectorAll(
			'.pdf-preview-chrome, .pdf-download-spinner, .pdf-generating-loader, .no-pdf-capture',
		)
		.forEach((node) => node.remove());
}

function stripCloneMotion(root: HTMLElement): void {
	stripCompositeEffects(root);
	root.style.transition = 'none';
	root.style.animation = 'none';
	root.querySelectorAll<HTMLElement>('*').forEach((node) => {
		stripCompositeEffects(node);
		node.style.transition = 'none';
		node.style.animation = 'none';
	});
}

function pageContentHeight(): number {
	return A4_CSS_PX.height - PAGE_PAD_TOP_PX - PAGE_PAD_BOTTOM_PX;
}

function expandTallItems(items: HTMLElement[], maxHeight: number): HTMLElement[] {
	const out: HTMLElement[] = [];
	for (const el of items) {
		if (el.scrollHeight <= maxHeight) {
			out.push(el);
			continue;
		}
		const kids = Array.from(el.children).filter(
			(child): child is HTMLElement =>
				child instanceof HTMLElement && isRenderablePageItem(child),
		);
		if (kids.length >= 2) {
			out.push(...expandTallItems(kids, maxHeight));
		} else {
			out.push(el);
		}
	}
	return out;
}

/**
 * Prefer explicit `.pdf-page-item` cards. Fall back to report sections so a
 * missing class never reverts to a single full-height canvas capture.
 */
function collectPdfPageItems(root: HTMLElement): HTMLElement[] {
	forcePrintOnlyVisible(root);
	const maxHeight = pageContentHeight();
	const twoTrack = root.querySelector<HTMLElement>(`#${TWO_TRACK_SECTION_ID}`);
	if (twoTrack) revealPrintOnlyNode(twoTrack);

	const marked = Array.from(root.querySelectorAll<HTMLElement>('.pdf-page-item')).filter(
		isRenderablePageItem,
	);
	const sections = Array.from(
		root.querySelectorAll<HTMLElement>(
			'.audit-print-header, .audit-report-section, .exec-briefing-card, .audit-print-footer',
		),
	).filter(isRenderablePageItem);

	const combined = dropNested([
		...new Set(marked.length > 0 ? [...marked, ...sections] : sections),
	]);

	if (
		twoTrack &&
		!combined.some((el) => el === twoTrack || el.contains(twoTrack) || twoTrack.contains(el))
	) {
		const headerIdx = combined.findIndex((el) => el.classList.contains('audit-print-header'));
		combined.splice(headerIdx >= 0 ? headerIdx + 1 : 0, 0, twoTrack);
	}

	const expanded = expandTallItems(combined.length > 0 ? combined : [root], maxHeight);
	return expanded.filter(isRenderablePageItem);
}

function rewriteCloneIds(root: HTMLElement, prefix: string): void {
	const idMap = new Map<string, string>();
	root.querySelectorAll('[id]').forEach((node) => {
		const oldId = node.id;
		if (!oldId) return;
		const next = `${prefix}${oldId}`;
		idMap.set(oldId, next);
		node.id = next;
	});

	const replaceUrl = (value: string) => {
		let next = value;
		idMap.forEach((newId, oldId) => {
			next = next.replaceAll(`url(#${oldId})`, `url(#${newId})`);
			next = next.replaceAll(`url("#${oldId}")`, `url("#${newId}")`);
		});
		return next;
	};

	root.querySelectorAll('*').forEach((node) => {
		for (const attr of Array.from(node.attributes)) {
			if (attr.value.includes('url(#')) {
				node.setAttribute(attr.name, replaceUrl(attr.value));
			}
			if (
				(attr.name === 'href' || attr.name === 'xlink:href') &&
				attr.value.startsWith('#')
			) {
				const mapped = idMap.get(attr.value.slice(1));
				if (mapped) node.setAttribute(attr.name, `#${mapped}`);
			}
		}
	});
}

function copyCanvasPixels(sourceRoot: HTMLElement, cloneRoot: HTMLElement): void {
	const srcCanvases = sourceRoot.querySelectorAll('canvas');
	const dstCanvases = cloneRoot.querySelectorAll('canvas');
	srcCanvases.forEach((src, index) => {
		const dst = dstCanvases[index];
		if (!(dst instanceof HTMLCanvasElement)) return;
		dst.width = src.width;
		dst.height = src.height;
		const ctx = dst.getContext('2d');
		if (ctx) ctx.drawImage(src, 0, 0);
	});
}

function isKeywordPipelineNode(node: HTMLElement): boolean {
	return (
		node.classList.contains('keyword-pipeline-section') ||
		node.classList.contains('keyword-pipeline-grid') ||
		node.classList.contains('keyword-chip-wrapper') ||
		node.classList.contains('keyword-as-is-box') ||
		node.classList.contains('keyword-as-is-source-list') ||
		node.classList.contains('keyword-source-pipeline') ||
		node.id === 'keyword-pipeline' ||
		Boolean(node.closest('.keyword-pipeline-section, #keyword-pipeline'))
	);
}

/**
 * Force every cloned block to stay inside the A4 content width.
 * Dashboard media queries (`lg:flex-row`, `min-w-[40rem]`, nowrap chips)
 * still match the live viewport, so without this pass charts and track
 * cards paint past the 680px sheet and get clipped.
 */
function containA4Overflow(root: HTMLElement, maxWidth: number): void {
	const limit = Math.max(160, Math.floor(maxWidth));
	root.style.width = '100%';
	root.style.maxWidth = '100%';
	root.style.minWidth = '0';
	root.style.boxSizing = 'border-box';
	root.style.overflowX = 'hidden';

	root.querySelectorAll<HTMLElement>('*').forEach((el) => {
		el.style.boxSizing = 'border-box';
		el.style.maxWidth = '100%';

		const styleWidth = el.style.width;
		if (styleWidth.endsWith('px') && parseFloat(styleWidth) > limit) {
			el.style.width = '100%';
		}
		const styleMin = el.style.minWidth;
		if (styleMin.endsWith('px') && parseFloat(styleMin) > limit) {
			el.style.minWidth = '0';
		}
		const className = elementClassName(el);
		if (el.style.minWidth.includes('rem') || className.includes('min-w-[')) {
			el.style.minWidth = '0';
		}

		const whiteSpace = el.style.whiteSpace || className.includes('whitespace-nowrap');
		if (whiteSpace === 'nowrap' || className.includes('whitespace-nowrap')) {
			el.style.whiteSpace = 'normal';
		}

		const tag = el.tagName;
		if (tag === 'TABLE') {
			el.style.width = '100%';
			el.style.minWidth = '0';
			el.style.tableLayout = 'fixed';
		}
		if (tag === 'PRE' || tag === 'CODE') {
			el.style.whiteSpace = 'pre-wrap';
			el.style.wordBreak = 'break-word';
			el.style.overflowWrap = 'anywhere';
		}
		if (tag === 'IMG' || tag === 'SVG' || tag === 'CANVAS' || tag === 'VIDEO') {
			el.style.maxWidth = '100%';
			el.style.height = 'auto';
		}
	});
}

function flattenBlockHeight(node: HTMLElement): void {
	const keyword = isKeywordPipelineNode(node);
	node.style.setProperty('height', 'auto', 'important');
	node.style.setProperty('min-height', keyword ? 'auto' : '0', 'important');
	node.style.setProperty('max-height', 'none', 'important');
	node.style.setProperty('overflow', 'visible', 'important');
	node.style.setProperty('page-break-inside', keyword ? 'auto' : 'avoid', 'important');
	node.style.setProperty('break-inside', keyword ? 'auto' : 'avoid', 'important');
}

function unlockKeywordPipeline(root: HTMLElement): void {
	const section = root.matches?.('.keyword-pipeline-section, #keyword-pipeline')
		? root
		: root.querySelector<HTMLElement>('.keyword-pipeline-section, #keyword-pipeline');
	if (section) {
		section.style.setProperty('height', 'auto', 'important');
		section.style.setProperty('min-height', 'auto', 'important');
		section.style.setProperty('max-height', 'none', 'important');
		section.style.setProperty('overflow', 'visible', 'important');
		section.style.setProperty('page-break-inside', 'auto', 'important');
		section.style.setProperty('break-inside', 'auto', 'important');
	}

	root.querySelectorAll<HTMLElement>('.keyword-pipeline-grid, .keyword-chip-wrapper, .keyword-as-is-box, .keyword-as-is-source-list, .keyword-source-pipeline').forEach((node) => {
		node.style.setProperty('height', 'auto', 'important');
		node.style.setProperty('min-height', 'auto', 'important');
		node.style.setProperty('max-height', 'none', 'important');
		node.style.setProperty('overflow', 'visible', 'important');
	});

	root.querySelectorAll<HTMLElement>('.keyword-chip-wrapper').forEach((node) => {
		node.style.setProperty('display', 'flex', 'important');
		node.style.setProperty('flex-wrap', 'wrap', 'important');
		node.style.setProperty('gap', '8px', 'important');
	});
}

/** Keep a 24px gap above badges so html2canvas does not collapse flex padding. */
function preserveCardTopPadding(node: HTMLElement): void {
	node.style.setProperty('display', 'block', 'important');
	node.style.setProperty('box-sizing', 'border-box', 'important');
	node.style.setProperty('padding-top', '24px', 'important');
	const first = node.firstElementChild;
	if (first instanceof HTMLElement) {
		first.style.setProperty('display', 'block', 'important');
		first.style.setProperty('margin-top', '0', 'important');
	}
}

/** Unfold AI engine / accordion bodies that are collapsed on screen. */
function expandPrintCollapsibles(root: HTMLElement): void {
	root.querySelectorAll<HTMLElement>('.pdf-expand-in-print').forEach((el) => {
		el.style.setProperty('height', 'auto', 'important');
		el.style.setProperty('max-height', 'none', 'important');
		el.style.setProperty('opacity', '1', 'important');
		el.style.setProperty('overflow', 'visible', 'important');
		el.style.setProperty('grid-template-rows', '1fr', 'important');
		el.style.visibility = 'visible';
		el.removeAttribute('aria-hidden');
	});
	root.querySelectorAll<HTMLElement>('[aria-hidden="true"]').forEach((el) => {
		const h = el.style.height;
		if (h !== '0px' && h !== '0') return;
		el.style.setProperty('height', 'auto', 'important');
		el.style.setProperty('opacity', '1', 'important');
		el.style.setProperty('overflow', 'visible', 'important');
		el.removeAttribute('aria-hidden');
	});
}

function freezeChartBoxes(source: HTMLElement, clone: HTMLElement): void {
	const srcAll = [source, ...Array.from(source.querySelectorAll<HTMLElement>('*'))];
	const dstAll = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
	srcAll.forEach((src, index) => {
		const dst = dstAll[index];
		if (!dst) return;
		const tag = src.tagName;
		const isChart =
			tag === 'CANVAS' ||
			tag === 'SVG' ||
			src.classList.contains('recharts-wrapper') ||
			src.classList.contains('recharts-responsive-container');
		if (!isChart) return;
		const cap = A4_CSS_PX.width - PAGE_PAD_SIDE_PX * 2;
		const w = src.offsetWidth;
		const h = src.offsetHeight;
		if (w > 0) dst.style.width = `${Math.min(w, cap)}px`;
		if (h > 0) dst.style.height = `${h}px`;
		dst.style.maxWidth = '100%';
		dst.style.boxSizing = 'border-box';
	});
}

function clonePreviewItem(source: HTMLElement, prefix: string): HTMLElement {
	const clone = source.cloneNode(true) as HTMLElement;
	const keepTabBody = source.classList.contains('audit-result-tab-panel');
	// `svg.recharts-surface` is stripped unconditionally (not gated on `keepTabBody`)
	// — a chart has no place in a printed A4 sheet either way, and dropping it here
	// (before pagination/measurement) avoids paying its layout cost twice.
	clone.querySelectorAll('.pdf-screen-only, .print\\:hidden, .no-pdf-capture, video, iframe, svg.recharts-surface').forEach((node) => {
		if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) return;
		if (keepTabBody && node.closest('.audit-result-tab-panel')) return;
		node.remove();
	});
	clone.querySelectorAll('button').forEach((node) => {
		if (
			node.classList.contains('keyword-chip') ||
			node.closest('.keyword-chip-wrapper, .keyword-pipeline-section')
		) {
			return;
		}
		const replacement = document.createElement('div');
		replacement.className = node.className;
		replacement.replaceChildren(...Array.from(node.childNodes));
		node.replaceWith(replacement);
	});
	rewriteCloneIds(clone, prefix);
	copyCanvasPixels(source, clone);
	freezeChartBoxes(source, clone);

	clone.style.width = '100%';
	clone.style.maxWidth = '100%';
	clone.style.minWidth = '0';
	clone.style.boxSizing = 'border-box';
	flattenBlockHeight(clone);
	expandPrintCollapsibles(clone);
	clone.classList.add('bg-white', 'text-slate-900');
	stripCompositeEffects(clone);
	clone
		.querySelectorAll<HTMLElement>(
			'section, article, .pdf-page-item, .audit-report-section, .exec-briefing-card',
		)
		.forEach((node) => flattenBlockHeight(node));
	unlockKeywordPipeline(clone);
	clone
		.querySelectorAll<HTMLElement>('.pdf-card-box, .exec-briefing-card article')
		.forEach((node) => preserveCardTopPadding(node));
	clone.querySelectorAll<HTMLElement>('*').forEach((node) => {
		stripCompositeEffects(node);
		if (node.style.transform) node.style.transform = 'none';
	});
	return clone;
}

function createPageNode(pageIndex: number): { page: HTMLElement; inner: HTMLElement } {
	const page = document.createElement('article');
	page.className = 'pdf-page-node report-page bg-white text-slate-900';
	page.setAttribute('data-pdf-page', String(pageIndex + 1));
	page.setAttribute('aria-label', `A4 page ${pageIndex + 1}`);
	page.style.width = `${A4_CSS_PX.width}px`;
	page.style.minWidth = `${A4_CSS_PX.width}px`;
	page.style.maxWidth = `${A4_CSS_PX.width}px`;
	page.style.height = `${A4_CSS_PX.height}px`;
	page.style.minHeight = `${A4_CSS_PX.height}px`;
	page.style.maxHeight = `${A4_CSS_PX.height}px`;
	page.style.margin = '0';
	page.style.padding = '0';

	const inner = document.createElement('div');
	inner.className = 'pdf-page-node-inner pdf-a4-fit';
	page.appendChild(inner);

	const footer = document.createElement('p');
	footer.className = 'pdf-page-node-footer';
	footer.setAttribute('data-pdf-page-footer', 'true');
	page.appendChild(footer);

	return { page, inner };
}

function stampPageFooters(pages: HTMLElement[]): void {
	const total = pages.length;
	pages.forEach((page, index) => {
		const footer = page.querySelector<HTMLElement>('[data-pdf-page-footer]');
		if (!footer) return;
		footer.textContent = `REDUE AI · Technical Audit Report · ${index + 1} / ${total}`;
	});
}

function explodeTallClone(
	host: HTMLElement,
	clone: HTMLElement,
	maxHeight: number,
): HTMLElement[] {
	if (clone.parentElement !== host) host.appendChild(clone);
	const height = Math.ceil(clone.getBoundingClientRect().height || clone.scrollHeight);
	if (height <= maxHeight) {
		host.removeChild(clone);
		return [clone];
	}
	const kids = Array.from(clone.children).filter(
		(child): child is HTMLElement =>
			child instanceof HTMLElement && (child.offsetHeight > 1 || child.scrollHeight > 1),
	);
	if (kids.length < 2) {
		host.removeChild(clone);
		return [clone];
	}
	const out: HTMLElement[] = [];
	for (const kid of kids) {
		flattenBlockHeight(kid);
		expandPrintCollapsibles(kid);
		unlockKeywordPipeline(kid);
		out.push(...explodeTallClone(host, kid, maxHeight));
	}
	if (clone.parentElement === host) host.removeChild(clone);
	return out;
}

/**
 * Build on-screen A4 pages (794×1123) inside `.pdf-preview-content`
 * from the live `#pdf-print-area` (tracks 1–3 unfolded + executive briefing).
 */
export async function mountPdfPreviewPages(
	dest: HTMLElement,
	options?: { isAborted?: () => boolean },
): Promise<{ pageCount: number }> {
	const aborted = () => Boolean(options?.isAborted?.());

	const readyDest = await waitForMountedElement(() => dest, { isAborted: aborted });
	if (!readyDest) {
		console.error('PDF Preview Error:', new Error('Preview destination is not mounted'));
		return { pageCount: 0 };
	}

	dest.replaceChildren();

	beginPdfLightPrint();
	const source = await waitForMountedElement(() => resolvePrintArea(), {
		isAborted: aborted,
		timeoutMs: 2500,
	});
	if (!source) {
		return { pageCount: 0 };
	}

	await waitForPdfAssets(source, aborted);
	if (aborted()) return { pageCount: 0 };

	// Make sure Track 1/2/3 curated sections have actually painted before we
	// scan the DOM for page items — otherwise a still-deferred/unresolved
	// section is silently absent from the capture even though pageCount > 0.
	const { ready, missingIds } = await waitForRequiredPdfSections(source, { isAborted: aborted });
	if (aborted()) return { pageCount: 0 };
	if (!ready && typeof console !== 'undefined') {
		console.warn('[pdf-print] Track section(s) missing from capture after wait:', missingIds);
	}

	forcePrintOnlyVisible(source);
	const items = collectPdfPageItems(source);
	if (aborted() || items.length === 0) {
		return { pageCount: 0 };
	}

	const contentWidth = A4_CSS_PX.width - PAGE_PAD_SIDE_PX * 2;
	/** Leave a safety band so line-box rounding never clips the last card. */
	const contentHeight = pageContentHeight() - 40;
	const prefix = `pdfpv-${Date.now()}-`;

	const measureHost = document.createElement('div');
	measureHost.className = 'pdf-preview-measure-host pdf-a4-fit bg-white text-slate-900';
	measureHost.style.width = `${contentWidth}px`;
	measureHost.style.maxWidth = `${contentWidth}px`;
	measureHost.style.boxSizing = 'border-box';
	dest.appendChild(measureHost);

	const measured: { clone: HTMLElement; height: number }[] = [];
	items.forEach((item, index) => {
		const clone = clonePreviewItem(item, `${prefix}${index}-`);
		for (const piece of explodeTallClone(measureHost, clone, contentHeight)) {
			containA4Overflow(piece, contentWidth);
			measureHost.appendChild(piece);
			const height = Math.ceil(piece.getBoundingClientRect().height || piece.scrollHeight);
			measureHost.removeChild(piece);
			if (height >= 2) measured.push({ clone: piece, height });
		}
	});

	measureHost.remove();

	const pages: HTMLElement[] = [];
	let current = createPageNode(0);
	dest.appendChild(current.page);
	pages.push(current.page);
	let used = 0;

	const startNewPage = () => {
		current = createPageNode(pages.length);
		dest.appendChild(current.page);
		pages.push(current.page);
		used = 0;
	};

	for (const { clone, height } of measured) {
		if (height < 2) continue;

		const needed = used === 0 ? height : height + PAGE_GAP_PX;
		if (used > 0 && used + needed > contentHeight) {
			startNewPage();
		}

		current.inner.appendChild(clone);
		containA4Overflow(clone, contentWidth);
		used = used === 0 ? height : used + PAGE_GAP_PX + height;

		if (used > contentHeight && current.inner.childElementCount === 1) {
			current.page.classList.add('pdf-page-node--tall');
		}

		if (pages.length >= MAX_PDF_PAGES || aborted()) break;
	}

	if (aborted()) {
		dest.replaceChildren();
		return { pageCount: 0 };
	}

	stampPageFooters(pages);
	dest.querySelectorAll<HTMLElement>('.pdf-page-node-inner').forEach((inner) => {
		containA4Overflow(inner, contentWidth);
	});
	await waitFrames(1);
	if (aborted()) {
		dest.replaceChildren();
		return { pageCount: 0 };
	}
	reflowOverflowingPages(dest);
	if (aborted()) {
		dest.replaceChildren();
		return { pageCount: 0 };
	}
	return { pageCount: dest.querySelectorAll('.pdf-page-node').length };
}

function reflowOverflowingPages(dest: HTMLElement): void {
	const limit = A4_CSS_PX.height + 4;
	let guard = 0;
	while (guard++ < MAX_PDF_PAGES) {
		const pages = Array.from(dest.querySelectorAll<HTMLElement>('.pdf-page-node'));
		let moved = false;
		for (let i = 0; i < pages.length; i++) {
			const page = pages[i];
			const inner = page.querySelector<HTMLElement>('.pdf-page-node-inner');
			if (!inner) continue;
			const height = Math.ceil(page.getBoundingClientRect().height || page.scrollHeight);
			if (height <= limit) continue;
			if (inner.childElementCount <= 1) {
				page.classList.add('pdf-page-node--tall');
				continue;
			}
			const last = inner.lastElementChild;
			if (!(last instanceof HTMLElement)) continue;
			let next = pages[i + 1];
			if (!next) {
				const created = createPageNode(pages.length);
				dest.appendChild(created.page);
				next = created.page;
			}
			const nextInner = next.querySelector<HTMLElement>('.pdf-page-node-inner');
			if (!nextInner) continue;
			nextInner.insertBefore(last, nextInner.firstChild);
			moved = true;
			break;
		}
		if (!moved) break;
	}
	stampPageFooters(Array.from(dest.querySelectorAll<HTMLElement>('.pdf-page-node')));
}

export function clearPdfPreview(dest: HTMLElement | null): void {
	if (!dest) return;
	dest.replaceChildren();
}

async function captureElement(
	html2canvas: Html2CanvasFn,
	el: HTMLElement,
): Promise<HTMLCanvasElement | null> {
	const captureWidth = A4_CSS_PX.width;
	const isTall = el.classList.contains('pdf-page-node--tall');
	const captureHeight = isTall
		? Math.max(A4_CSS_PX.height, Math.ceil(el.scrollHeight) || A4_CSS_PX.height)
		: A4_CSS_PX.height;

	try {
		const capturePromise = html2canvas(el, {
			...HTML2CANVAS_SAFETY,
			scrollX: 0,
			scrollY: 0,
			x: 0,
			y: 0,
			width: captureWidth,
			height: captureHeight,
			windowWidth: captureWidth,
			windowHeight: captureHeight,
			ignoreElements: (node) => node instanceof Element && isCaptureIgnoredNode(node, el),
			onclone: (clonedDoc, clonedEl) => {
				if (clonedEl instanceof Element) {
					isolateClonedCapture(clonedDoc, clonedEl);
				}
				prepareClonedDocument(clonedDoc);
				const printRoot =
					clonedDoc.getElementById(PRINT_REPORT_CONTAINER_ID) ??
					clonedDoc.getElementById(PDF_PRINT_AREA_ID) ??
					clonedDoc.querySelector<HTMLElement>('.print-report-container, .pdf-print-area');
				if (printRoot) {
					printRoot.style.display = 'block';
					printRoot.style.visibility = 'visible';
					printRoot.style.height = 'auto';
					printRoot.style.overflow = 'visible';
				}
				const twoTrack = clonedDoc.getElementById(TWO_TRACK_SECTION_ID);
				if (twoTrack instanceof HTMLElement) {
					twoTrack.style.setProperty('display', 'block', 'important');
					twoTrack.style.setProperty('visibility', 'visible', 'important');
					twoTrack.style.setProperty('height', 'auto', 'important');
					twoTrack.style.setProperty('overflow', 'visible', 'important');
				}
				clonedDoc.querySelectorAll<HTMLElement>('.pdf-print-only').forEach((node) => {
					node.style.setProperty('display', 'block', 'important');
					node.style.setProperty('visibility', 'visible', 'important');
					node.style.setProperty('overflow', 'visible', 'important');
				});
				// Belt-and-suspenders: the live preview zoom (`.pdf-preview-zoom-wrapper`)
				// is reset to 100% by the caller before capture starts, but a clone
				// taken mid-transition (or via `window.print()`'s own reflow) must
				// never carry a scaled ancestor into the raster — a scaled ancestor
				// shifts every descendant's captured box relative to its real A4 slot.
				clonedDoc
					.querySelectorAll<HTMLElement>('.pdf-preview-zoom-wrapper')
					.forEach((wrapper) => {
						wrapper.style.setProperty('zoom', '1', 'important');
						wrapper.style.setProperty('transform', 'none', 'important');
					});
				if (!(clonedEl instanceof HTMLElement)) return;
				stripCloneMotion(clonedEl);
				clonedEl.style.position = 'relative';
				clonedEl.style.left = '0';
				clonedEl.style.top = '0';
				clonedEl.style.right = 'auto';
				clonedEl.style.margin = '0';
				clonedEl.style.padding = '0';
				clonedEl.style.transform = 'none';
				clonedEl.style.transformOrigin = 'top left';
				clonedEl.style.width = `${captureWidth}px`;
				clonedEl.style.height = `${captureHeight}px`;
				clonedEl.style.setProperty('min-height', `${captureHeight}px`, 'important');
				clonedEl.style.setProperty('max-height', `${captureHeight}px`, 'important');
				clonedEl.style.setProperty('overflow', isTall ? 'visible' : 'hidden', 'important');
				calibratePdfFonts(clonedEl);
			},
		});
		const canvas = await raceWithTimeout(capturePromise, CAPTURE_TIMEOUT_MS);
		if (!canvas) {
			console.warn('[pdf-print] Page capture exceeded time budget — skipped:', el);
			return null;
		}
		if (!canvas.width || !canvas.height) return null;
		return canvas;
	} catch (error) {
		console.error('PDF Generation Detailed Error:', error);
		return null;
	}
}

function unlockOverflowAncestors(from: HTMLElement): () => void {
	const changed: Array<{ el: HTMLElement; overflow: string; filter: string }> = [];
	let node: HTMLElement | null = from.parentElement;
	while (node && node !== document.documentElement) {
		changed.push({
			el: node,
			overflow: node.style.overflow,
			filter: node.style.filter,
		});
		node.style.overflow = 'visible';
		node.style.filter = 'none';
		node.style.setProperty('backdrop-filter', 'none');
		node = node.parentElement;
	}
	return () => {
		for (const entry of changed) {
			entry.el.style.overflow = entry.overflow;
			entry.el.style.filter = entry.filter;
			entry.el.style.removeProperty('backdrop-filter');
		}
	};
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement): string | null {
	try {
		return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
	} catch {
		return null;
	}
}

function isFinitePositive(value: number): boolean {
	return Number.isFinite(value) && value > 0;
}

function addJpegImage(
	pdf: import('jspdf').jsPDF,
	canvas: HTMLCanvasElement,
	x: number,
	y: number,
	imgWidth: number,
	imgHeight: number,
): void {
	const jpeg = canvasToJpegDataUrl(canvas);
	try {
		if (jpeg) {
			pdf.addImage(jpeg, 'JPEG', x, y, imgWidth, imgHeight, undefined, 'FAST');
			return;
		}
		pdf.addImage(canvas, 'JPEG', x, y, imgWidth, imgHeight, undefined, 'FAST');
	} catch (error) {
		console.warn('[pdf-print] addImage JPEG/FAST failed:', error);
	}
}

function addCanvasPages(
	pdf: import('jspdf').jsPDF,
	canvas: HTMLCanvasElement,
	freshPage: boolean,
): void {
	const pageWidth = Number(pdf.internal.pageSize.getWidth()) || A4_PT.width;
	const pageHeight = Number(pdf.internal.pageSize.getHeight()) || A4_PT.height;
	const canvasW = Number(canvas.width);
	const canvasH = Number(canvas.height);
	if (!isFinitePositive(pageWidth) || !isFinitePositive(pageHeight)) return;
	if (!isFinitePositive(canvasW) || !isFinitePositive(canvasH)) return;

	const imgWidth = pageWidth;
	const imgHeight = (canvasH * imgWidth) / canvasW;
	if (!isFinitePositive(imgHeight)) return;

	if (freshPage) {
		pdf.addPage();
	}

	/* One A4 preview sheet → one PDF page. Only slice when content is
	   genuinely taller than A4 (tall unsplittable cards), never for leftover
	   blank canvas from height:100% / windowHeight inflation. */
	if (imgHeight <= pageHeight + BLANK_PAGE_THRESHOLD_PT) {
		const drawHeight = Math.min(imgHeight, pageHeight);
		if (!isFinitePositive(drawHeight)) return;
		addJpegImage(pdf, canvas, 0, 0, imgWidth, drawHeight);
		return;
	}

	let heightLeft = imgHeight;
	let position = 0;
	let page = 0;

	addJpegImage(pdf, canvas, 0, position, imgWidth, imgHeight);
	heightLeft -= pageHeight;
	page += 1;

	while (heightLeft > BLANK_PAGE_THRESHOLD_PT && page < MAX_PDF_PAGES) {
		position = -(imgHeight - heightLeft);
		if (!Number.isFinite(position) || !isFinitePositive(imgHeight)) break;
		pdf.addPage();
		addJpegImage(pdf, canvas, 0, position, imgWidth, imgHeight);
		heightLeft -= pageHeight;
		page += 1;
	}
}

function resolveDownloadOptions(
	filenameOrOptions: string | DownloadPreviewPdfOptions | undefined,
): { filename: string; onProgress?: (current: number, total: number) => void } {
	if (typeof filenameOrOptions === 'string' || filenameOrOptions === undefined) {
		return { filename: filenameOrOptions?.trim() || DEFAULT_PDF_FILENAME };
	}
	return {
		filename: filenameOrOptions.filename?.trim() || DEFAULT_PDF_FILENAME,
		onProgress: filenameOrOptions.onProgress,
	};
}

/**
 * A4 PDF via html2canvas + jsPDF. Captures each `.pdf-page-node` / `.report-page`
 * sheet in sequence (never the whole report as one canvas).
 */
export async function downloadPreviewPdf(
	previewRoot: HTMLElement,
	filenameOrOptions: string | DownloadPreviewPdfOptions = DEFAULT_PDF_FILENAME,
): Promise<void> {
	if (typeof window === 'undefined') return;
	const { filename, onProgress } = resolveDownloadOptions(filenameOrOptions);

	// Bottleneck diagnostics — leave these in: they are the fastest way to
	// confirm a regression is capture-bound vs. jsPDF-bound vs. asset-bound
	// without having to re-instrument the profiler every time.
	console.time('PDF_DOWNLOAD_TOTAL');
	try {
		const dest = await waitForMountedElement(() => previewRoot);
		if (!dest) {
			throw new Error('PDF capture target is not mounted');
		}

		const targets = collectReportPageNodes(dest);
		if (targets.length === 0 || !targets[0]?.isConnected) {
			throw new Error('No A4 page nodes (.pdf-page-node / .report-page) to capture');
		}

		const html2canvas = (await import('html2canvas')).default;
		const { jsPDF } = await import('jspdf');

		const alreadyPrinting = isPrintCaptureMode();
		beginPdfLightPrint();
		document.documentElement.classList.add(PDF_PREVIEW_CAPTURING_CLASS);
		const restoreOverflow = unlockOverflowAncestors(targets[0]);

		try {
			// Unbounded font settle — deliberately *not* the ~400ms-capped
			// `waitForWebFonts()` used during pagination. Any font metric that
			// is still swapping in mid-capture shifts every line box under it,
			// which reads as "the whole page slid up" once rasterized. Must run
			// right before the capture loop, not just once back when the pages
			// were built, since layout can still nudge between then and now.
			if (typeof document !== 'undefined' && document.fonts) {
				await document.fonts.ready;
			}
			await waitFrames(2);
			console.time('PDF_CAPTURE_PHASE');
			const pdf = new jsPDF({
				orientation: 'portrait',
				unit: 'pt',
				format: 'a4',
				compress: true,
			});

			const total = Math.min(targets.length, MAX_PDF_PAGES);
			onProgress?.(0, total);

			let written = 0;
			let skipped = 0;

			for (let i = 0; i < targets.length; i++) {
				if (written >= MAX_PDF_PAGES) break;
				onProgress?.(i + 1, total);
				await yieldToMain(YIELD_BETWEEN_PAGES_MS);

				const el = targets[i];
				if (!isElementReadyForCapture(el)) {
					skipped += 1;
					continue;
				}

				const canvas = await captureElement(html2canvas, el);
				if (!canvas || !isFinitePositive(canvas.width) || !isFinitePositive(canvas.height)) {
					skipped += 1;
					releaseCanvas(canvas);
					continue;
				}

				addCanvasPages(pdf, canvas, written > 0);
				written += 1;
				releaseCanvas(canvas);
			}
			console.timeEnd('PDF_CAPTURE_PHASE');

			if (skipped > 0) {
				console.warn(`[pdf-print] ${skipped}/${targets.length} page(s) skipped (timeout or empty capture).`);
			}

			if (written === 0) {
				throw new Error('html2canvas produced no printable pages');
			}

			console.time('PDF_JSPDF_SAVE_PHASE');
			onProgress?.(total, total);
			pdf.save(filename);
			console.timeEnd('PDF_JSPDF_SAVE_PHASE');
		} finally {
			restoreOverflow();
			document.documentElement.classList.remove(PDF_PREVIEW_CAPTURING_CLASS);
			if (!alreadyPrinting) endPdfLightPrint();
		}
	} catch (err) {
		console.error('PDF Generation Detailed Error:', err);
		throw err;
	} finally {
		console.timeEnd('PDF_DOWNLOAD_TOTAL');
	}
}

/**
 * Mark / unmark that a `.pdf-preview-content` A4 sheet stack is currently
 * mounted and paginated (see `PDF_PREVIEW_SURFACE_CLASS`). Call once the
 * preview has real pages, not just while the container is open — printing
 * before pages exist should still fall back to `openSystemPrint()`'s
 * `#pdf-print-area` reveal path.
 */
export function markPdfPreviewSurfaceOpen(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.add(PDF_PREVIEW_SURFACE_CLASS);
}

export function unmarkPdfPreviewSurfaceOpen(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.remove(PDF_PREVIEW_SURFACE_CLASS);
}

/**
 * Print the already-built on-screen A4 sheets (`.pdf-preview-content` →
 * `.pdf-page-node` / `.report-page`) directly. Used by the PDF preview
 * modal and the public A4 report view's "quick print" button instead of
 * `openSystemPrint()`.
 *
 * `openSystemPrint()` targets the separate, normally off-screen/hidden
 * `#pdf-print-area` (the live dashboard result tree) via the
 * `html.pdf-native-print` rules in `globals.css` — those rules also hide
 * `.pdf-preview-root` (this component's own root) as part of "hide
 * everything except the print target". When `#pdf-print-area` sits
 * *nested inside* that same root (the public A4 view renders it inside its
 * own off-screen `.pdf-preview-measure-host`), hiding the root hides the
 * print target too and `window.print()` sees nothing to paint — a blank
 * page. Printing the surface's own pages sidesteps that entirely: nothing
 * needs to be revealed from a hidden subtree, it is already fully painted
 * on screen.
 */
export function printPdfPreviewPages(): void {
	if (typeof window === 'undefined') return;
	const preview = document.querySelector<HTMLElement>('.pdf-preview-content');
	const hasPages = Boolean(preview && collectReportPageNodes(preview).length > 0);
	if (!hasPages) {
		openSystemPrint();
		return;
	}
	beginPdfLightPrint();
	window.requestAnimationFrame(() => {
		window.print();
	});
}

/**
 * Instant system print dialog — no html2canvas. `@media print` + `.print-mode`
 * hide chrome and page-break Track 1 → 2 → 3.
 */
export function openSystemPrint(): void {
	if (typeof window === 'undefined') return;

	beginPdfLightPrint();
	document.documentElement.classList.add(PDF_NATIVE_PRINT_CLASS, PRINT_MODE_CLASS);
	window.dispatchEvent(new Event(MOUNT_AUDIT_RESULT_TABS_EVENT));
	const source = resolvePrintArea();
	if (source) forcePrintOnlyVisible(source);

	const previewOpen = Boolean(document.querySelector('.report-preview-modal, .report-a4-view'));
	const restore = () => {
		document.documentElement.classList.remove(PDF_NATIVE_PRINT_CLASS);
		if (!previewOpen) endPdfLightPrint();
		window.removeEventListener('afterprint', restore);
	};
	window.addEventListener('afterprint', restore);
	window.requestAnimationFrame(() => {
		window.print();
	});
}

/** A4 PDF via html2canvas + jsPDF when paginated A4 sheets are mounted; otherwise window.print(). */
export async function printAuditPdf(
	options?: DownloadPreviewPdfOptions,
): Promise<void> {
	if (typeof window === 'undefined') return;

	const preview = document.querySelector<HTMLElement>('.pdf-preview-content');
	const previewPages = preview ? collectReportPageNodes(preview).length : 0;
	if (preview && previewPages > 0) {
		await downloadPreviewPdf(preview, options ?? DEFAULT_PDF_FILENAME);
		return;
	}

	const printArea = resolvePrintArea();
	if (printArea && collectReportPageNodes(printArea).length > 0) {
		await downloadPreviewPdf(printArea, options ?? DEFAULT_PDF_FILENAME);
		return;
	}

	openSystemPrint();
}

export const generatePDF = printAuditPdf;
