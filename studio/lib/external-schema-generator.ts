import * as cheerio from 'cheerio';
import { assertPublicHttpUrl } from './ssrf-guard';
import { generateHeaderBlock } from './code-generator';

export type ExternalCmsType = 'wordpress' | 'generic';
export type ExternalLang = 'ko' | 'en';

export interface ExternalScanMeta {
	title: string;
	description: string;
	image: string | null;
	canonical: string | null;
}

export interface ExternalGenerateResult {
	domain: string;
	scanned: ExternalScanMeta;
	jsonLd: Record<string, unknown>[];
	metaTags: Record<string, string>;
	phpSnippet: string | null;
}

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = 'Mozilla/5.0 (compatible; ReduAiSchemaBot/1.0; +https://redue.ai/api/v1)';

const FALLBACKS: Record<ExternalLang, { name: string; description: string }> = {
	ko: { name: 'AI-Powered Site', description: 'AI 기반 SEO & GEO 최적화 대상 사이트' },
	en: { name: 'AI-Powered Site', description: 'A site optimized for SEO & GEO by REDUE AI' },
};

/** Best-effort fetch + cheerio scan of the target domain's homepage — never throws; falls back to sensible defaults. */
async function scanDomain(url: URL): Promise<ExternalScanMeta> {
	try {
		const res = await fetch(url.toString(), {
			headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			redirect: 'follow',
		});
		const html = await res.text();
		const $ = cheerio.load(html);
		return {
			title: $('title').first().text().trim() || url.hostname,
			description: $('meta[name="description"]').attr('content')?.trim() || '',
			image: $('meta[property="og:image"]').attr('content')?.trim() || null,
			canonical: $('link[rel="canonical"]').attr('href')?.trim() || url.toString(),
		};
	} catch {
		return { title: url.hostname, description: '', image: null, canonical: url.toString() };
	}
}

/**
 * Core of `POST /api/v1/schema/generate` — scans the given public domain
 * (after SSRF validation) and returns a `SoftwareApplication` + `WebSite`
 * JSON-LD pair, a matching meta-tag block, and (for `cms_type: "wordpress"`)
 * the same idempotent `header.php` PHP block produced by the internal
 * scanner in `lib/code-generator.ts`.
 */
export async function generateExternalSchema(rawDomain: string, cmsType: ExternalCmsType, lang: ExternalLang): Promise<ExternalGenerateResult> {
	const url = await assertPublicHttpUrl(rawDomain);
	const scanned = await scanDomain(url);
	const fallback = FALLBACKS[lang] ?? FALLBACKS.ko;

	const name = scanned.title || fallback.name;
	const description = scanned.description || fallback.description;
	const canonicalUrl = scanned.canonical || url.toString();

	const jsonLd: Record<string, unknown>[] = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name,
			url: url.origin,
			...(scanned.image ? { image: scanned.image } : {}),
		},
		{
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name,
			description,
			url: canonicalUrl,
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web',
		},
	];

	const metaTags: Record<string, string> = {
		title: name,
		description,
		canonical: canonicalUrl,
		'og:title': name,
		'og:description': description,
		'og:url': canonicalUrl,
		'og:type': 'website',
		...(scanned.image ? { 'og:image': scanned.image } : {}),
	};

	return {
		domain: url.toString(),
		scanned,
		jsonLd,
		metaTags,
		phpSnippet: cmsType === 'wordpress' ? generateHeaderBlock() : null,
	};
}
