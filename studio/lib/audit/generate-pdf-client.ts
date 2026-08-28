const DEFAULT_FILENAME = 'A4_진단리포트.pdf';
const GENERATE_PDF_PATH = '/api/generate-pdf';

const TRACK_SECTION_IDS = [
	'sec-print-track-1',
	'sec-print-track-2',
	'sec-print-track-3',
] as const;

const PRETENDARD_CDN =
	'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';

const SCREEN_ONLY_SELECTOR =
	'.pdf-preview-chrome, .pdf-screen-only, .print\\:hidden, .no-pdf-capture, video, iframe';

function collectDocumentCss(): { css: string; linkHrefs: string[] } {
	const cssChunks: string[] = [];
	const linkHrefs: string[] = [];
	if (typeof document === 'undefined') return { css: '', linkHrefs };

	for (const sheet of Array.from(document.styleSheets)) {
		try {
			const rules = Array.from(sheet.cssRules)
				.map((rule) => rule.cssText)
				.join('\n');
			if (rules) cssChunks.push(rules);
		} catch {
			if (sheet.href) linkHrefs.push(sheet.href);
		}
	}

	return { css: cssChunks.join('\n'), linkHrefs };
}

function absolutizeUrl(value: string, base: string): string {
	const trimmed = value.trim();
	if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
	if (/^(https?:|mailto:|tel:|#)/i.test(trimmed)) return trimmed;
	try {
		return new URL(trimmed, base).href;
	} catch {
		return trimmed;
	}
}

function absolutizeTree(root: HTMLElement, base: string): void {
	root.querySelectorAll<HTMLElement>('[src], [href], [srcset]').forEach((el) => {
		const src = el.getAttribute('src');
		if (src) el.setAttribute('src', absolutizeUrl(src, base));
		const href = el.getAttribute('href');
		if (href && el.tagName !== 'A') el.setAttribute('href', absolutizeUrl(href, base));
		const srcset = el.getAttribute('srcset');
		if (srcset) {
			el.setAttribute(
				'srcset',
				srcset
					.split(',')
					.map((part) => {
						const [url, descriptor] = part.trim().split(/\s+/, 2);
						return descriptor
							? `${absolutizeUrl(url, base)} ${descriptor}`
							: absolutizeUrl(url, base);
					})
					.join(', '),
			);
		}
	});
}

function snapshotCanvases(source: HTMLElement, clone: HTMLElement): void {
	const srcCanvases = source.querySelectorAll('canvas');
	const destCanvases = clone.querySelectorAll('canvas');
	srcCanvases.forEach((canvas, index) => {
		const dest = destCanvases[index];
		if (!dest) return;
		try {
			const img = document.createElement('img');
			img.src = canvas.toDataURL('image/png');
			img.alt = canvas.getAttribute('aria-label') || canvas.getAttribute('alt') || '';
			img.width = canvas.width;
			img.height = canvas.height;
			img.className = canvas.className;
			const style = canvas.getAttribute('style');
			if (style) img.setAttribute('style', style);
			dest.replaceWith(img);
		} catch {
			dest.remove();
		}
	});
}

function extractTrackHtml(root: HTMLElement): string {
	const clone = root.cloneNode(true) as HTMLElement;
	snapshotCanvases(root, clone);
	clone.querySelectorAll(SCREEN_ONLY_SELECTOR).forEach((node) => node.remove());
	absolutizeTree(clone, window.location.origin);

	const pages = Array.from(clone.querySelectorAll<HTMLElement>('.pdf-page-node'));
	if (pages.length > 0) {
		return pages.map((page) => page.outerHTML).join('\n');
	}

	const tracks = TRACK_SECTION_IDS.map(
		(id) => clone.querySelector(`#${id}`) ?? document.getElementById(id),
	).filter((el): el is HTMLElement => el instanceof HTMLElement);

	if (tracks.length > 0) {
		return tracks
			.map((el) => {
				if (clone.contains(el)) return el.outerHTML;
				const live = document.getElementById(el.id);
				if (!live) return el.outerHTML;
				const liveClone = live.cloneNode(true) as HTMLElement;
				snapshotCanvases(live, liveClone);
				liveClone.querySelectorAll(SCREEN_ONLY_SELECTOR).forEach((node) => node.remove());
				absolutizeTree(liveClone, window.location.origin);
				return liveClone.outerHTML;
			})
			.join('\n');
	}

	return clone.innerHTML;
}

function buildStandaloneHtml(fragment: string): string {
	const { css, linkHrefs } = collectDocumentCss();
	const extraLinks = linkHrefs
		.map((href) => `<link rel="stylesheet" href="${href.replace(/"/g, '&quot;')}">`)
		.join('\n');
	const hasPages = fragment.includes('pdf-page-node');

	return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>A4 진단리포트</title>
<link rel="stylesheet" href="${PRETENDARD_CDN}" />
${extraLinks}
<style>${css}</style>
<style>
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff !important;
  color: #0f172a !important;
  color-scheme: light;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-family: Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Noto Sans KR", "Malgun Gothic", sans-serif;
}
.pdf-preview-chrome, .pdf-screen-only, .print\\:hidden { display: none !important; }
.pdf-page-node { box-shadow: none !important; }
@page { size: A4; margin: ${hasPages ? '0' : '15mm'}; }
@page pdf-sheet { size: A4; margin: 0; }
.pdf-page-node {
  page: pdf-sheet;
  page-break-after: always !important;
  break-after: page !important;
}
.pdf-page-node:last-child {
  page-break-after: auto !important;
  break-after: auto !important;
}
</style>
</head>
<body class="pdf-printing print-mode">
<div class="pdf-preview-content pdf-a4-fit bg-white text-slate-900">${fragment}</div>
</body>
</html>`;
}

function triggerDownload(url: string, filename: string): void {
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.rel = 'noopener';
	anchor.target = '_blank';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}

async function downloadFromUrl(url: string, filename: string): Promise<void> {
	try {
		const res = await fetch(url);
		if (res.ok) {
			const blob = await res.blob();
			const objectUrl = URL.createObjectURL(blob);
			triggerDownload(objectUrl, filename);
			window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
			return;
		}
	} catch {
		/* cross-origin or blocked — fall through to a tagged <a> click */
	}
	triggerDownload(url, filename);
}

/**
 * Serialize Track 1–3 (or mounted A4 preview sheets) and download via Api2Pdf.
 */
export async function downloadA4ReportPdf(
	container: HTMLElement,
	filename = DEFAULT_FILENAME,
): Promise<void> {
	if (typeof window === 'undefined') return;

	const fragment = extractTrackHtml(container).trim();
	if (!fragment) {
		throw new Error('No A4 report HTML to convert');
	}

	const html = buildStandaloneHtml(fragment);
	const res = await fetch(GENERATE_PDF_PATH, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ html, filename }),
	});

	const contentType = res.headers.get('content-type') ?? '';
	if (contentType.includes('application/pdf')) {
		if (!res.ok) {
			throw new Error('PDF binary response failed');
		}
		const blob = await res.blob();
		const objectUrl = URL.createObjectURL(blob);
		triggerDownload(objectUrl, filename);
		window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
		return;
	}

	let payload: Record<string, unknown> = {};
	try {
		payload = (await res.json()) as Record<string, unknown>;
	} catch {
		throw new Error('Invalid PDF API response');
	}

	if (!res.ok) {
		const message =
			typeof payload.error === 'string' && payload.error.trim()
				? payload.error
				: 'PDF generation failed';
		throw new Error(message);
	}

	const fileUrl =
		(typeof payload.FileUrl === 'string' && payload.FileUrl) ||
		(typeof payload.fileUrl === 'string' && payload.fileUrl) ||
		'';
	if (!fileUrl) {
		throw new Error('PDF FileUrl missing');
	}

	await downloadFromUrl(fileUrl, filename);
}

export const DEFAULT_A4_PDF_FILENAME = DEFAULT_FILENAME;
