import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import iconv from 'iconv-lite';
import jschardet from 'jschardet';

/** Google PageSpeed Insights API v5 — SEO category, mobile strategy. */
export const PSI_SEO_ENDPOINT =
	'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const CRAWL_USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) RedueBot/1.0';

/** Allow crawl of sites with expired / self-signed SSL certificates. */
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

export type HybridScanInput = {
	targetUrl: string;
	category?: string;
	region?: string;
};

export type HybridScanResult = {
	url: string;
	siteName: string;
	description: string;
	category: string;
	region: string;
	cms: string;
	ttfbMs: number;
	hasViewport: boolean;
	isIndexable: boolean;
	seoScore: number;
	/** Whether PageSpeed Insights contributed metrics (vs Cheerio-only fallback). */
	psiUsed: boolean;
	/** Whether an API key was attached to the PSI request. */
	apiKeyUsed: boolean;
	crawledAt: string;
};

type LighthouseResult = {
	audits?: Record<
		string,
		{
			score?: number | null;
			numericValue?: number;
		}
	>;
	categories?: {
		seo?: { score?: number | null };
	};
};

/**
 * Resolve PageSpeed / Google API key from env.
 * Prefer: PAGESPEED_API_KEY → VITE_GOOGLE_MAP_API_KEY → NEXT_PUBLIC_GOOGLE_PAGESPEED_API_KEY
 * then legacy aliases. Empty → PSI without `&key=` (anonymous quota / rate-limit sensitive).
 */
export function resolveGooglePageSpeedApiKey(): string {
	return (
		process.env.PAGESPEED_API_KEY?.trim() ||
		process.env.VITE_GOOGLE_MAP_API_KEY?.trim() ||
		process.env.NEXT_PUBLIC_GOOGLE_PAGESPEED_API_KEY?.trim() ||
		process.env.GOOGLE_PAGESPEED_API_KEY?.trim() ||
		process.env.GOOGLE_API_KEY?.trim() ||
		process.env.NEXT_PUBLIC_PAGESPEED_API_KEY?.trim() ||
		''
	);
}

/** Normalize iconv / jschardet encoding labels to an iconv-lite codec name. */
function resolveIconvEncoding(raw: string | undefined | null): string | null {
	if (!raw) return null;
	const key = raw.trim().toLowerCase().replace(/[_ ]+/g, '-');

	if (
		key === 'euc-kr' ||
		key === 'euckr' ||
		key === 'cp949' ||
		key === 'ms949' ||
		key === 'windows-949' ||
		key === 'ks_c_5601-1987' ||
		key === 'ks-c-5601-1987' ||
		key === 'korean'
	) {
		return 'euc-kr';
	}
	if (key === 'utf-8' || key === 'utf8' || key === 'ascii' || key === 'us-ascii') {
		return 'utf-8';
	}
	if (iconv.encodingExists(key)) return key;
	return null;
}

function extractCharsetFromHtmlPeek(htmlPeek: string): string | null {
	const metaCharset =
		htmlPeek.match(/<meta[^>]+charset\s*=\s*["']?\s*([a-zA-Z0-9_\-:]+)/i)?.[1] ||
		htmlPeek.match(
			/<meta[^>]+http-equiv\s*=\s*["']?content-type["']?[^>]+content\s*=\s*["'][^"']*charset=([a-zA-Z0-9_\-:]+)/i,
		)?.[1] ||
		htmlPeek.match(
			/<meta[^>]+content\s*=\s*["'][^"']*charset=([a-zA-Z0-9_\-:]+)[^"']*["'][^>]+http-equiv\s*=\s*["']?content-type/i,
		)?.[1];
	return metaCharset ? metaCharset.trim() : null;
}

function extractCharsetFromContentType(contentType: string | undefined): string | null {
	if (!contentType) return null;
	return contentType.match(/charset\s*=\s*["']?([a-zA-Z0-9_\-:]+)/i)?.[1]?.trim() ?? null;
}

/**
 * Decode HTML ArrayBuffer/Buffer with EUC-KR / CP949 / UTF-8 auto-detection.
 * Prevents Korean mojibake on legacy domestic sites.
 */
export function decodeHtmlBuffer(
	data: ArrayBuffer | Buffer | Uint8Array,
	contentType?: string,
): string {
	const buffer = Buffer.isBuffer(data)
		? data
		: Buffer.from(data instanceof ArrayBuffer ? data : data.buffer);

	const utf8Peek = buffer.toString('utf-8');
	const headerCharset = extractCharsetFromContentType(contentType);
	const metaCharset = extractCharsetFromHtmlPeek(utf8Peek.slice(0, 8_192));

	let detectedEncoding: string | undefined;
	try {
		const detected = jschardet.detect(buffer);
		if (detected?.encoding && detected.confidence >= 0.2) {
			detectedEncoding = detected.encoding;
		}
	} catch {
		// jschardet is best-effort; fall through to meta / UTF-8
	}

	const peekLower = utf8Peek.slice(0, 8_192).toLowerCase();
	const forcesEucKr =
		peekLower.includes('charset=euc-kr') ||
		peekLower.includes('charset="euc-kr"') ||
		peekLower.includes("charset='euc-kr'") ||
		peekLower.includes('charset=cp949') ||
		peekLower.includes('charset=ms949') ||
		peekLower.includes('charset=ks_c_5601');

	const resolved =
		resolveIconvEncoding(headerCharset) ||
		resolveIconvEncoding(metaCharset) ||
		(forcesEucKr ? 'euc-kr' : null) ||
		resolveIconvEncoding(detectedEncoding) ||
		'utf-8';

	if (resolved === 'utf-8') {
		return utf8Peek;
	}

	try {
		return iconv.decode(buffer, resolved);
	} catch {
		if (resolved !== 'euc-kr') {
			try {
				return iconv.decode(buffer, 'euc-kr');
			} catch {
				return utf8Peek;
			}
		}
		return utf8Peek;
	}
}

/**
 * Domestic CMS / framework / tech-stack heuristics from raw HTML.
 * Covers JSP, ASP, PHP boards, builders, and React/Next SPA signals.
 */
export function detectCmsFromHtml(html: string): string {
	const htmlString = html.toLowerCase();

	if (htmlString.includes('gnuboard') || htmlString.includes('g5_url') || htmlString.includes('g5_')) {
		if (
			htmlString.includes('youngcart') ||
			htmlString.includes('yc4_') ||
			htmlString.includes('/shop/item.php')
		) {
			return '그누보드 / 영카트 (GNUBOARD)';
		}
		return '그누보드 (GNUBOARD)';
	}
	if (htmlString.includes('imweb') || htmlString.includes('cdn.imweb.me')) {
		return '아임웹 (Imweb)';
	}
	if (htmlString.includes('cafe24') || htmlString.includes('cafe24.com')) {
		return '카페24 (Cafe24)';
	}
	if (
		htmlString.includes('wp-content') ||
		htmlString.includes('wp-includes') ||
		htmlString.includes('wordpress')
	) {
		return '워드프레스 (WordPress)';
	}
	if (
		htmlString.includes('.jsp') ||
		htmlString.includes('jsessionid') ||
		htmlString.includes('egovframe') ||
		htmlString.includes('egovframework')
	) {
		return 'JSP / 자체구축 (Legacy)';
	}
	if (
		htmlString.includes('.aspx') ||
		htmlString.includes('.asp') ||
		htmlString.includes('__viewstate') ||
		htmlString.includes('asp.net')
	) {
		return 'ASP.NET / Classic ASP';
	}
	if (
		htmlString.includes('_next') ||
		htmlString.includes('__next') ||
		htmlString.includes('__next_data__') ||
		htmlString.includes('/_next/')
	) {
		return 'Next.js / React (SPA)';
	}
	if (htmlString.includes('makeshop') || htmlString.includes('makeshop.co.kr')) {
		return '메이크샵 (Makeshop)';
	}
	if (htmlString.includes('godomall') || htmlString.includes('godo.co.kr')) {
		return '고도몰 (Godomall)';
	}

	return '자체구축 / 기타';
}

function buildPsiUrl(targetUrl: string, apiKey: string): string {
	const encodedUrl = encodeURIComponent(targetUrl);
	const apiKeyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';
	return `${PSI_SEO_ENDPOINT}?url=${encodedUrl}&category=SEO&strategy=MOBILE${apiKeyParam}`;
}

/**
 * 2-step hybrid collect: Cheerio meta/CMS (encoding-safe) → Google PSI SEO metrics.
 */
export async function runHybridScan(input: HybridScanInput): Promise<HybridScanResult> {
	const targetUrl = input.targetUrl;
	const googleApiKey = resolveGooglePageSpeedApiKey();
	const apiKeyUsed = Boolean(googleApiKey);

	// ── 1) Cheerio: encoding-safe HTML + CMS (arraybuffer + iconv) ────
	const startTime = Date.now();
	const htmlRes = await axios.get<ArrayBuffer>(targetUrl, {
		headers: { 'User-Agent': CRAWL_USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
		timeout: 8_000,
		responseType: 'arraybuffer',
		httpsAgent: insecureHttpsAgent,
		maxRedirects: 5,
		validateStatus: (s) => s >= 200 && s < 400,
	});
	const localTtfb = Date.now() - startTime;

	const contentType =
		typeof htmlRes.headers['content-type'] === 'string'
			? htmlRes.headers['content-type']
			: undefined;
	const html = decodeHtmlBuffer(htmlRes.data, contentType);
	const $ = cheerio.load(html);

	const siteTitle =
		$('title').first().text().trim() ||
		$('meta[property="og:title"]').attr('content')?.trim() ||
		'';
	const description =
		$('meta[name="description"]').attr('content')?.trim() ||
		$('meta[property="og:description"]').attr('content')?.trim() ||
		'';
	const hasHtmlViewport = $('meta[name="viewport"]').length > 0;
	const detectedCMS = detectCmsFromHtml(html);

	// ── 2) Google PageSpeed Insights (SEO / mobile) ───────────────────
	let googleData: LighthouseResult | null = null;
	let psiUsed = false;

	try {
		const googleApiUrl = buildPsiUrl(targetUrl, googleApiKey);
		const googleRes = await axios.get<{ lighthouseResult?: LighthouseResult }>(googleApiUrl, {
			timeout: 15_000,
			headers: { Accept: 'application/json' },
			httpsAgent: insecureHttpsAgent,
			validateStatus: (s) => s >= 200 && s < 300,
		});
		googleData = googleRes.data?.lighthouseResult ?? null;
		psiUsed = Boolean(googleData);
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.warn(
			'[hybrid-scan] Google PageSpeed API 호출 실패, Cheerio 실측으로 폴백:',
			message,
		);
	}

	const ttfbMs = Math.round(
		googleData?.audits?.['server-response-time']?.numericValue ?? localTtfb,
	);
	const isViewportOk = googleData
		? googleData.audits?.['viewport']?.score === 1
		: hasHtmlViewport;
	const isCrawlable = googleData
		? googleData.audits?.['is-crawlable']?.score === 1
		: true;
	const seoScore = googleData
		? Math.round((googleData.categories?.seo?.score ?? 0) * 100)
		: 80;

	return {
		url: targetUrl,
		siteName: siteTitle || targetUrl,
		description,
		category: input.category || '기타',
		region: input.region || '전국',
		cms: detectedCMS,
		ttfbMs,
		hasViewport: isViewportOk,
		isIndexable: isCrawlable,
		seoScore,
		psiUsed,
		apiKeyUsed,
		crawledAt: new Date().toISOString(),
	};
}
