import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const API2PDF_ENDPOINT = 'https://v2.api2pdf.com/chrome/pdf/html';
const DEFAULT_FILENAME = 'A4_진단리포트.pdf';
const MAX_HTML_CHARS = 3_500_000;
const API2PDF_TIMEOUT_MS = 25_000;

type GeneratePdfBody = {
	html?: unknown;
	filename?: unknown;
	fileName?: unknown;
};

function sanitizeFilename(value: unknown): string {
	const raw = String(value ?? '').trim() || DEFAULT_FILENAME;
	const withoutPath = raw.replace(/^.*[/\\]/, '');
	const stripped = withoutPath.replace(/[?%*:|"<>]/g, '-').replace(/\.pdf$/i, '');
	const base = stripped.slice(0, 120).trim() || 'A4_진단리포트';
	return `${base}.pdf`;
}

function hasPaginatedA4Sheets(html: string): boolean {
	return html.includes('pdf-page-node');
}

function buildChromeOptions(html: string) {
	/**
	 * Pre-paginated `.pdf-page-node` sheets are already 210×297mm with the
	 * 15mm-equivalent padding baked into `.pdf-page-node-inner`. Extra Chrome
	 * margins would push each sheet onto a second physical page.
	 * Raw Track 1–3 fragments use the requested 15mm box.
	 */
	const margin = hasPaginatedA4Sheets(html)
		? { top: '0', bottom: '0', left: '0', right: '0' }
		: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' };

	return {
		format: 'A4',
		printBackground: true,
		width: '8.27in',
		height: '11.69in',
		margin,
		marginTop: margin.top,
		marginBottom: margin.bottom,
		marginLeft: margin.left,
		marginRight: margin.right,
		/**
		 * `waitForNetworkIdle` + `networkidle0` made Api2Pdf hold the page
		 * open until Chrome saw zero in-flight network connections for a
		 * beat — a single slow/analytics/font-CDN request (or one that
		 * never quite settles) drags every request out to Api2Pdf's ~60s
		 * network-idle ceiling. The HTML we send is a fully-inlined,
		 * self-contained snapshot (fonts/CSS collected up front, canvases
		 * flattened to `<img>`), so there is nothing left to wait on — a
		 * fixed short delay for layout/paint is enough and keeps this
		 * bounded to a couple of seconds end-to-end.
		 */
		waitForNetworkIdle: false,
		delay: 500,
		preferCSSPageSize: hasPaginatedA4Sheets(html),
	};
}

function pickFileUrl(payload: Record<string, unknown>): string | null {
	const candidates = [payload.FileUrl, payload.fileUrl, payload.file_url];
	for (const value of candidates) {
		if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value;
	}
	return null;
}

/**
 * POST /api/generate-pdf — Chrome Headless A4 PDF via Api2Pdf v2.
 * Body: `{ html, filename }` → `{ FileUrl }` or application/pdf binary.
 */
export async function POST(request: Request) {
	const apiKey = process.env.API2PDF_API_KEY?.trim();
	if (!apiKey) {
		return NextResponse.json(
			{ error: 'PDF 생성 서비스가 설정되지 않았습니다.', Success: false },
			{ status: 503 },
		);
	}

	let body: GeneratePdfBody;
	try {
		body = (await request.json()) as GeneratePdfBody;
	} catch {
		return NextResponse.json({ error: '잘못된 요청 본문입니다.', Success: false }, { status: 400 });
	}

	const html = typeof body.html === 'string' ? body.html.trim() : '';
	if (!html) {
		return NextResponse.json({ error: '변환할 HTML이 없습니다.', Success: false }, { status: 400 });
	}
	if (html.length > MAX_HTML_CHARS) {
		return NextResponse.json(
			{ error: '보고서 HTML이 너무 큽니다. 페이지를 줄인 뒤 다시 시도해 주세요.', Success: false },
			{ status: 413 },
		);
	}

	const fileName = sanitizeFilename(body.fileName ?? body.filename ?? DEFAULT_FILENAME);

	let upstream: Response;
	try {
		upstream = await fetch(API2PDF_ENDPOINT, {
			method: 'POST',
			headers: {
				Authorization: apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				html,
				inlinePdf: false,
				fileName,
				options: buildChromeOptions(html),
			}),
			signal: AbortSignal.timeout(API2PDF_TIMEOUT_MS),
		});
	} catch {
		return NextResponse.json(
			{ error: 'PDF 생성 서버에 연결하지 못했습니다.', Success: false },
			{ status: 502 },
		);
	}

	const contentType = upstream.headers.get('content-type') ?? '';
	if (contentType.includes('application/pdf')) {
		const bytes = await upstream.arrayBuffer();
		if (!upstream.ok || bytes.byteLength === 0) {
			return NextResponse.json(
				{ error: 'PDF 바이너리를 받지 못했습니다.', Success: false },
				{ status: 502 },
			);
		}
		return new NextResponse(bytes, {
			status: 200,
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
			},
		});
	}

	let payload: Record<string, unknown> = {};
	try {
		payload = (await upstream.json()) as Record<string, unknown>;
	} catch {
		return NextResponse.json(
			{ error: 'PDF 생성 응답을 해석하지 못했습니다.', Success: false },
			{ status: 502 },
		);
	}

	const fileUrl = pickFileUrl(payload);
	const success = payload.Success !== false;
	const upstreamError =
		typeof payload.Error === 'string' && payload.Error.trim()
			? payload.Error.trim()
			: typeof payload.error === 'string' && payload.error.trim()
				? payload.error.trim()
				: null;

	if (!upstream.ok || !success || !fileUrl) {
		const status = upstream.status === 401 || upstream.status === 403 ? 502 : upstream.status || 502;
		return NextResponse.json(
			{
				error: upstreamError || 'PDF 생성에 실패했습니다.',
				Success: false,
			},
			{ status: status >= 400 && status < 600 ? status : 502 },
		);
	}

	return NextResponse.json({
		ok: true,
		Success: true,
		FileUrl: fileUrl,
		fileName,
	});
}
