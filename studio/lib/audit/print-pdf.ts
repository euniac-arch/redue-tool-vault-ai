const PDF_PRINTING_CLASS = 'pdf-printing';
const PDF_PREVIEW_CAPTURING_CLASS = 'pdf-preview-capturing';
const PDF_PRINT_AREA_ID = 'pdf-print-area';

/** CSS pixels matching A4 at ~96dpi (210mm × 297mm). */
export const A4_CSS_PX = { width: 794, height: 1123 } as const;
const A4_PT = { width: 595.28, height: 841.89 } as const;
const PAGE_PAD_PX = 36;
const PAGE_GAP_PX = 14;
const BLANK_PAGE_THRESHOLD_PT = 10;
/** High-res capture — A4 pages stay well under the browser canvas limit. */
const HTML2CANVAS_SCALE = 2;
const MAX_PDF_PAGES = 40;

type Html2CanvasFn = (typeof import('html2canvas'))['default'];

const HTML2CANVAS_SAFETY = {
	backgroundColor: '#ffffff',
	scale: HTML2CANVAS_SCALE,
	letterRendering: true,
	useCORS: true,
	allowTaint: false,
	logging: false,
	foreignObjectRendering: false,
	imageTimeout: 15_000,
	removeContainer: true,
} as const;

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
export function beginPdfLightPrint(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.add(PDF_PRINTING_CLASS);
	document.documentElement.classList.remove('dark');
	document.documentElement.style.colorScheme = 'light';
}

export function endPdfLightPrint(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.remove(PDF_PRINTING_CLASS);
	document.documentElement.classList.remove(PDF_PREVIEW_CAPTURING_CLASS);
}

function waitFrames(count = 3): Promise<void> {
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

/** Wait until Pretendard (and any other document fonts) are fully ready. */
async function waitForWebFonts(): Promise<void> {
	if (typeof document === 'undefined' || !document.fonts) return;
	try {
		await document.fonts.ready;
		await Promise.all(PRETENDARD_LOAD_SPECS.map((spec) => document.fonts.load(spec).catch(() => undefined)));
		await document.fonts.ready;
	} catch {
		/* ignore */
	}
}

async function waitForLayout(): Promise<void> {
	await waitForWebFonts();
	await waitFrames(4);
}

const ASSET_WAIT_MS = 12_000;

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

	await waitForLayout();
	if (isAborted?.()) return;

	try {
		window.dispatchEvent(new Event('resize'));
	} catch {
		/* ignore */
	}

	const images = Array.from(target.querySelectorAll('img'));
	await Promise.all([...images.map((img) => waitForImg(img)), waitForWebFonts()]);
	if (isAborted?.()) return;
	await waitFrames(6);
}

function isScreenOnlyElement(el: Element): boolean {
	if (!(el instanceof HTMLElement)) return false;
	if (el.classList.contains('print:hidden')) return true;
	if (el.classList.contains('pdf-screen-only')) return true;
	if (el.closest('.pdf-screen-only, .print\\:hidden')) return true;
	return false;
}

function resolvePrintArea(): HTMLElement | null {
	return (
		document.getElementById(PDF_PRINT_AREA_ID) ??
		(document.querySelector('.pdf-print-area') as HTMLElement | null)
	);
}

function fallbackWindowPrint(): void {
	const restore = () => {
		endPdfLightPrint();
		window.removeEventListener('afterprint', restore);
	};
	window.addEventListener('afterprint', restore);
	window.print();
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
	clonedDoc.documentElement.classList.add(PDF_PRINTING_CLASS);
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

function isRenderablePageItem(el: HTMLElement): boolean {
	if (isScreenOnlyElement(el)) return false;
	if (el.offsetHeight < 2 && el.scrollHeight < 2) return false;
	return true;
}

function dropNested(items: HTMLElement[]): HTMLElement[] {
	return items.filter(
		(el, _, all) => !all.some((other) => other !== el && other.contains(el)),
	);
}

function pageContentHeight(): number {
	return A4_CSS_PX.height - PAGE_PAD_PX * 2;
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
	const maxHeight = pageContentHeight();
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
		const w = src.offsetWidth;
		const h = src.offsetHeight;
		if (w > 0) dst.style.width = `${w}px`;
		if (h > 0) dst.style.height = `${h}px`;
	});
}

function clonePreviewItem(source: HTMLElement, prefix: string): HTMLElement {
	const clone = source.cloneNode(true) as HTMLElement;
	clone.querySelectorAll('.pdf-screen-only, .print\\:hidden').forEach((node) => node.remove());
	clone.querySelectorAll('button').forEach((node) => {
		if (
			node.classList.contains('keyword-chip') ||
			node.closest('.keyword-chip-wrapper, .keyword-pipeline-section')
		) {
			return;
		}
		node.remove();
	});
	rewriteCloneIds(clone, prefix);
	copyCanvasPixels(source, clone);
	freezeChartBoxes(source, clone);

	clone.style.width = '100%';
	clone.style.maxWidth = '100%';
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
	page.className = 'pdf-page-node bg-white text-slate-900';
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
	inner.className = 'pdf-page-node-inner';
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
 * from the live `#pdf-print-area` (tabs 1–2 unfolded + executive briefing).
 */
export async function mountPdfPreviewPages(
	dest: HTMLElement,
	options?: { isAborted?: () => boolean },
): Promise<{ pageCount: number }> {
	const aborted = () => Boolean(options?.isAborted?.());
	dest.replaceChildren();

	beginPdfLightPrint();
	const source = resolvePrintArea();
	if (!source) {
		return { pageCount: 0 };
	}

	await waitForPdfAssets(source, aborted);
	if (aborted()) return { pageCount: 0 };

	const items = collectPdfPageItems(source);
	if (aborted() || items.length === 0) {
		return { pageCount: 0 };
	}

	const contentWidth = A4_CSS_PX.width - PAGE_PAD_PX * 2;
	/** Leave a safety band so line-box rounding never clips the last card. */
	const contentHeight = pageContentHeight() - 40;
	const prefix = `pdfpv-${Date.now()}-`;

	const measureHost = document.createElement('div');
	measureHost.className = 'pdf-preview-measure-host bg-white text-slate-900';
	measureHost.style.width = `${contentWidth}px`;
	dest.appendChild(measureHost);

	const measured: { clone: HTMLElement; height: number }[] = [];
	items.forEach((item, index) => {
		const clone = clonePreviewItem(item, `${prefix}${index}-`);
		for (const piece of explodeTallClone(measureHost, clone, contentHeight)) {
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
	await waitFrames(2);
	if (aborted()) {
		dest.replaceChildren();
		return { pageCount: 0 };
	}
	reflowOverflowingPages(dest);
	await waitForPdfAssets(dest, aborted);
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
		const canvas = await html2canvas(el, {
			...HTML2CANVAS_SAFETY,
			scrollX: 0,
			scrollY: 0,
			x: 0,
			y: 0,
			width: captureWidth,
			height: captureHeight,
			windowWidth: captureWidth,
			windowHeight: captureHeight,
			ignoreElements: (node) =>
				node instanceof Element &&
				(isScreenOnlyElement(node) || node.classList.contains('pdf-preview-chrome')),
			onclone: (clonedDoc, clonedEl) => {
				prepareClonedDocument(clonedDoc);
				if (!(clonedEl instanceof HTMLElement)) return;
				clonedEl.style.position = 'relative';
				clonedEl.style.left = '0';
				clonedEl.style.top = '0';
				clonedEl.style.right = 'auto';
				clonedEl.style.margin = '0';
				clonedEl.style.padding = '0';
				clonedEl.style.transform = 'none';
				clonedEl.style.width = `${captureWidth}px`;
				clonedEl.style.height = `${captureHeight}px`;
				clonedEl.style.setProperty('min-height', `${captureHeight}px`, 'important');
				clonedEl.style.setProperty('max-height', `${captureHeight}px`, 'important');
				clonedEl.style.setProperty('overflow', isTall ? 'visible' : 'hidden', 'important');
				calibratePdfFonts(clonedEl);
			},
		});
		if (!canvas.width || !canvas.height) return null;
		return canvas;
	} catch {
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

function addCanvasPages(
	pdf: import('jspdf').jsPDF,
	canvas: HTMLCanvasElement,
	freshPage: boolean,
): void {
	const pageWidth = pdf.internal.pageSize.getWidth();
	const pageHeight = pdf.internal.pageSize.getHeight();
	const imgWidth = pageWidth;
	const imgHeight = (canvas.height * imgWidth) / canvas.width;
	const imgData = canvas.toDataURL('image/jpeg', 0.95);

	if (freshPage) {
		pdf.addPage();
	}

	/* One A4 preview sheet → one PDF page. Only slice when content is
	   genuinely taller than A4 (tall unsplittable cards), never for leftover
	   blank canvas from height:100% / windowHeight inflation. */
	if (imgHeight <= pageHeight + BLANK_PAGE_THRESHOLD_PT) {
		pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
		return;
	}

	let heightLeft = imgHeight;
	let position = 0;
	let page = 0;

	pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
	heightLeft -= pageHeight;
	page += 1;

	while (heightLeft > BLANK_PAGE_THRESHOLD_PT && page < MAX_PDF_PAGES) {
		position = -(imgHeight - heightLeft);
		pdf.addPage();
		pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
		heightLeft -= pageHeight;
		page += 1;
	}
}

/**
 * Capture fully laid-out `.pdf-page-node` sheets inside `.pdf-preview-content`.
 * Scrolls to origin and uses scale: 2 so text is not clipped.
 */
export async function downloadPreviewPdf(
	previewRoot: HTMLElement,
	filename = 'REDUE-AI-Audit-Report.pdf',
): Promise<void> {
	if (typeof window === 'undefined') return;

	window.scrollTo(0, 0);
	previewRoot.scrollTop = 0;
	const overlay = previewRoot.closest('.pdf-preview-root');
	if (overlay instanceof HTMLElement) overlay.scrollTop = 0;
	await waitForWebFonts();
	document.documentElement.classList.add(PDF_PREVIEW_CAPTURING_CLASS);
	const restoreOverflow = unlockOverflowAncestors(previewRoot);

	const pages = Array.from(previewRoot.querySelectorAll<HTMLElement>('.pdf-page-node'));
	if (pages.length === 0) {
		restoreOverflow();
		document.documentElement.classList.remove(PDF_PREVIEW_CAPTURING_CLASS);
		throw new Error('No A4 preview pages to capture');
	}

	try {
		const html2canvas = (await import('html2canvas')).default;
		const { jsPDF } = await import('jspdf');

		const pdf = new jsPDF({
			unit: 'pt',
			format: [A4_PT.width, A4_PT.height],
			compress: true,
		});

		let wrotePage = false;
		for (const page of pages) {
			window.scrollTo(0, 0);
			page.scrollIntoView({ block: 'start', inline: 'nearest' });
			await waitFrames(2);
			window.scrollTo(0, 0);

			const canvas = await captureElement(html2canvas, page);
			if (!canvas) continue;
			addCanvasPages(pdf, canvas, wrotePage);
			wrotePage = true;
		}

		if (!wrotePage) {
			throw new Error('html2canvas produced no pages');
		}

		pdf.save(filename);
	} finally {
		restoreOverflow();
		document.documentElement.classList.remove(PDF_PREVIEW_CAPTURING_CLASS);
	}
}

/** A4 PDF via preview pages when mounted; otherwise window.print() fallback. */
export async function printAuditPdf(): Promise<void> {
	if (typeof window === 'undefined') return;

	await waitForWebFonts();

	const preview = document.querySelector<HTMLElement>('.pdf-preview-content');
	const previewPages = preview?.querySelectorAll('.pdf-page-node').length ?? 0;
	if (preview && previewPages > 0) {
		await downloadPreviewPdf(preview);
		return;
	}

	beginPdfLightPrint();
	await waitForLayout();
	fallbackWindowPrint();
}

export const generatePDF = printAuditPdf;
